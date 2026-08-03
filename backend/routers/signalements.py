import math

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import auth
import models
import schemas
from database import get_db
from services import reliability

router = APIRouter(prefix="/signalements", tags=["signalements"])


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


@router.post("", response_model=schemas.SignalementOut)
def creer_signalement(
    payload: schemas.SignalementCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    signalement = models.Signalement(**payload.model_dump(), user_id=current_user.id)
    db.add(signalement)
    db.commit()
    db.refresh(signalement)
    return signalement


@router.get("/proches", response_model=list[schemas.SignalementOut])
def signalements_proches(
    lat: float,
    lon: float,
    rayon_km: float = 5.0,
    db: Session = Depends(get_db),
):
    candidats = (
        db.query(models.Signalement)
        .filter(models.Signalement.statut != models.SignalementStatut.invalide)
        .all()
    )

    resultats = []
    for s in candidats:
        reliability.recalculer_statut(s)
        if s.statut != models.SignalementStatut.actif:
            continue
        if _haversine_km(lat, lon, s.lat, s.lon) <= rayon_km:
            resultats.append(s)

    db.commit()
    return resultats


@router.delete("/{signalement_id}", status_code=204)
def supprimer_signalement(
    signalement_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    signalement = db.get(models.Signalement, signalement_id)
    if signalement is None:
        raise HTTPException(status_code=404, detail="Signalement introuvable")

    if signalement.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Vous n'êtes pas l'auteur de ce signalement")

    db.delete(signalement)
    db.commit()


@router.post("/{signalement_id}/confirmer", response_model=schemas.SignalementOut)
def confirmer_signalement(
    signalement_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    signalement = db.get(models.Signalement, signalement_id)
    if signalement is None:
        raise HTTPException(status_code=404, detail="Signalement introuvable")

    reliability.recalculer_statut(signalement)
    if signalement.statut != models.SignalementStatut.actif:
        raise HTTPException(status_code=409, detail="Signalement non actif")

    reliability.confirmer(signalement)
    db.commit()
    db.refresh(signalement)
    return signalement
