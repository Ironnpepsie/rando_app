from fastapi import APIRouter, Depends, HTTPException
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
