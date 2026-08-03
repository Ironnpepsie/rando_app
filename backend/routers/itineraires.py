from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import auth
import models
import schemas
from database import get_db
from services import routing_client
from services.routing_client import RoutingError

router = APIRouter(prefix="/itineraires", tags=["itineraires"])


@router.post("/generer", response_model=schemas.ItineraireOut)
def generer_itineraire(
    payload: schemas.ItineraireGenererRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    try:
        resultat = routing_client.generer_itineraire_rando(
            lat=payload.point_depart_lat,
            lon=payload.point_depart_lon,
            duree_dispo_h=payload.duree_dispo,
            niveau=payload.niveau.value,
            mode=payload.mode.value,
            arrivee_lat=payload.point_arrivee_lat,
            arrivee_lon=payload.point_arrivee_lon,
        )
    except RoutingError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    itineraire = models.Itineraire(
        user_id=current_user.id,
        point_depart_lat=payload.point_depart_lat,
        point_depart_lon=payload.point_depart_lon,
        duree_dispo=payload.duree_dispo,
        niveau=payload.niveau,
        mode=payload.mode,
        point_arrivee_lat=payload.point_arrivee_lat,
        point_arrivee_lon=payload.point_arrivee_lon,
        trace_geojson=resultat["geojson"],
        distance_km=resultat["distance_km"],
        denivele_m=resultat["denivele_m"],
    )
    db.add(itineraire)
    db.commit()
    db.refresh(itineraire)
    return itineraire


@router.get("/{itineraire_id}", response_model=schemas.ItineraireOut)
def obtenir_itineraire(itineraire_id: int, db: Session = Depends(get_db)):
    itineraire = db.get(models.Itineraire, itineraire_id)
    if itineraire is None:
        raise HTTPException(status_code=404, detail="Itinéraire introuvable")
    return itineraire
