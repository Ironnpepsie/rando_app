from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

import auth
import models
import schemas
from database import get_db
from routers.historique import calculer_stats_utilisateur

router = APIRouter(prefix="/amis", tags=["amis"])


def _relation_entre(db: Session, user_id_a: int, user_id_b: int) -> models.Friendship | None:
    return (
        db.query(models.Friendship)
        .filter(
            or_(
                and_(models.Friendship.user_id == user_id_a, models.Friendship.friend_id == user_id_b),
                and_(models.Friendship.user_id == user_id_b, models.Friendship.friend_id == user_id_a),
            )
        )
        .first()
    )


def _sont_amis(db: Session, user_id_a: int, user_id_b: int) -> bool:
    relation = _relation_entre(db, user_id_a, user_id_b)
    return relation is not None and relation.status == models.FriendshipStatusEnum.accepted


@router.get("/recherche", response_model=list[schemas.UserRechercheResult])
def rechercher_utilisateurs(
    q: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    q = q.strip()
    if len(q) < 2:
        return []
    motif = f"%{q}%"
    utilisateurs = (
        db.query(models.User)
        .filter(models.User.id != current_user.id)
        .filter(or_(models.User.nom.ilike(motif), models.User.email.ilike(motif)))
        .limit(20)
        .all()
    )

    resultats = []
    for u in utilisateurs:
        relation = _relation_entre(db, current_user.id, u.id)
        if relation is None:
            statut, friendship_id = "aucune", None
        elif relation.status == models.FriendshipStatusEnum.accepted:
            statut, friendship_id = "ami", relation.id
        elif relation.user_id == current_user.id:
            statut, friendship_id = "demande_envoyee", relation.id
        else:
            statut, friendship_id = "demande_recue", relation.id
        resultats.append(
            schemas.UserRechercheResult(
                id=u.id,
                nom=u.nom,
                email=u.email,
                photo_base64=u.photo_base64,
                statut_amitie=statut,
                friendship_id=friendship_id,
            )
        )
    return resultats


@router.post("/demandes", response_model=schemas.FriendshipOut, status_code=201)
def envoyer_demande(
    payload: schemas.FriendshipCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    if payload.friend_id == current_user.id:
        raise HTTPException(status_code=400, detail="Impossible de s'ajouter soi-même en ami")

    cible = db.get(models.User, payload.friend_id)
    if cible is None:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")

    if _relation_entre(db, current_user.id, cible.id) is not None:
        raise HTTPException(status_code=409, detail="Une relation existe déjà avec cet utilisateur")

    relation = models.Friendship(user_id=current_user.id, friend_id=cible.id)
    db.add(relation)
    db.commit()
    db.refresh(relation)
    return schemas.FriendshipOut(
        id=relation.id, status=relation.status, created_at=relation.created_at, utilisateur=cible
    )


@router.get("/demandes", response_model=list[schemas.FriendshipOut])
def lister_demandes_recues(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    relations = (
        db.query(models.Friendship)
        .filter(
            models.Friendship.friend_id == current_user.id,
            models.Friendship.status == models.FriendshipStatusEnum.pending,
        )
        .all()
    )
    return [
        schemas.FriendshipOut(
            id=r.id,
            status=r.status,
            created_at=r.created_at,
            utilisateur=db.get(models.User, r.user_id),
        )
        for r in relations
    ]


@router.post("/demandes/{friendship_id}/accepter", response_model=schemas.FriendshipOut)
def accepter_demande(
    friendship_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    relation = db.get(models.Friendship, friendship_id)
    if relation is None or relation.friend_id != current_user.id:
        raise HTTPException(status_code=404, detail="Demande introuvable")
    if relation.status != models.FriendshipStatusEnum.pending:
        raise HTTPException(status_code=409, detail="Cette demande n'est plus en attente")

    relation.status = models.FriendshipStatusEnum.accepted
    db.commit()
    db.refresh(relation)
    return schemas.FriendshipOut(
        id=relation.id,
        status=relation.status,
        created_at=relation.created_at,
        utilisateur=db.get(models.User, relation.user_id),
    )


@router.delete("/demandes/{friendship_id}", status_code=204)
def refuser_ou_supprimer_relation(
    friendship_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """Selon le statut et le rôle de l'utilisateur courant, sert à la fois à : refuser une
    demande reçue, annuler une demande envoyée, ou retirer un ami déjà accepté."""
    relation = db.get(models.Friendship, friendship_id)
    if relation is None or current_user.id not in (relation.user_id, relation.friend_id):
        raise HTTPException(status_code=404, detail="Relation introuvable")
    db.delete(relation)
    db.commit()


@router.get("", response_model=list[schemas.FriendshipOut])
def lister_amis(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    relations = (
        db.query(models.Friendship)
        .filter(
            models.Friendship.status == models.FriendshipStatusEnum.accepted,
            or_(
                models.Friendship.user_id == current_user.id,
                models.Friendship.friend_id == current_user.id,
            ),
        )
        .all()
    )
    resultats = []
    for r in relations:
        autre_id = r.friend_id if r.user_id == current_user.id else r.user_id
        resultats.append(
            schemas.FriendshipOut(
                id=r.id,
                status=r.status,
                created_at=r.created_at,
                utilisateur=db.get(models.User, autre_id),
            )
        )
    return resultats


@router.get("/{friend_id}/profil", response_model=schemas.ProfilAmiOut)
def profil_ami(
    friend_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    if not _sont_amis(db, current_user.id, friend_id):
        raise HTTPException(status_code=403, detail="Vous n'êtes pas ami avec cet utilisateur")
    ami = db.get(models.User, friend_id)
    if ami is None:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")

    return schemas.ProfilAmiOut(utilisateur=ami, stats=calculer_stats_utilisateur(db, friend_id))


@router.get("/{friend_id}/historique", response_model=list[schemas.RandoHistoriqueOut])
def historique_ami(
    friend_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    if not _sont_amis(db, current_user.id, friend_id):
        raise HTTPException(status_code=403, detail="Vous n'êtes pas ami avec cet utilisateur")
    return (
        db.query(models.RandoHistorique)
        .filter(models.RandoHistorique.user_id == friend_id)
        .order_by(models.RandoHistorique.date_realisation.desc())
        .all()
    )
