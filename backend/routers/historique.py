from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

import auth
import models
import schemas
from database import get_db

router = APIRouter(prefix="/historique", tags=["historique"])


@router.post("", response_model=schemas.RandoHistoriqueOut)
def marquer_realisee(
    payload: schemas.RandoHistoriqueCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    itineraire = db.get(models.Itineraire, payload.itineraire_id)
    if itineraire is None:
        raise HTTPException(status_code=404, detail="Itinéraire introuvable")

    entree = models.RandoHistorique(**payload.model_dump(), user_id=current_user.id)
    db.add(entree)
    db.commit()
    db.refresh(entree)
    return entree


@router.get("", response_model=list[schemas.RandoHistoriqueOut])
def lister_historique(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    return (
        db.query(models.RandoHistorique)
        .filter(models.RandoHistorique.user_id == current_user.id)
        .order_by(models.RandoHistorique.date_realisation.desc())
        .all()
    )


def calculer_stats_utilisateur(db: Session, user_id: int) -> schemas.HistoriqueStats:
    # Seules les sorties avec des stats réelles enregistrées (suivi GPS terminé)
    # comptent dans les cumuls : une entrée "Marquer comme fait" sans trace GPS
    # n'a pas de distance_reelle_km et n'est donc pas comptabilisée ici.
    resultat = (
        db.query(
            func.count(models.RandoHistorique.id),
            func.coalesce(func.sum(models.RandoHistorique.distance_reelle_km), 0.0),
            func.coalesce(func.sum(models.RandoHistorique.denivele_positif_reel_m), 0.0),
            func.coalesce(func.sum(models.RandoHistorique.duree_reelle_s), 0.0),
            func.max(models.RandoHistorique.distance_reelle_km),
            func.max(models.RandoHistorique.denivele_positif_reel_m),
        )
        .filter(
            models.RandoHistorique.user_id == user_id,
            models.RandoHistorique.distance_reelle_km.isnot(None),
        )
        .one()
    )
    nb_sorties, distance_totale, denivele_cumule, duree_totale, record_distance, record_denivele = resultat

    return schemas.HistoriqueStats(
        nb_sorties=nb_sorties,
        distance_totale_km=distance_totale,
        denivele_positif_cumule_m=denivele_cumule,
        duree_totale_s=duree_totale,
        record_distance_km=record_distance,
        record_denivele_m=record_denivele,
    )


@router.get("/stats", response_model=schemas.HistoriqueStats)
def statistiques_personnelles(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    return calculer_stats_utilisateur(db, current_user.id)
