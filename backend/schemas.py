from datetime import datetime
from typing import Optional, Any

from pydantic import BaseModel, ConfigDict, model_validator

from models import NiveauEnum, ModeItineraireEnum, SignalementType, SignalementStatut


# --- Itineraire ---

class ItineraireGenererRequest(BaseModel):
    point_depart_lat: float
    point_depart_lon: float
    duree_dispo: float
    niveau: NiveauEnum
    mode: ModeItineraireEnum = ModeItineraireEnum.boucle
    point_arrivee_lat: Optional[float] = None
    point_arrivee_lon: Optional[float] = None

    @model_validator(mode="after")
    def _valider_point_arrivee(self):
        if self.mode == ModeItineraireEnum.point_a_point and (
            self.point_arrivee_lat is None or self.point_arrivee_lon is None
        ):
            raise ValueError(
                "point_arrivee_lat et point_arrivee_lon sont requis en mode point_a_point"
            )
        return self


class ItineraireOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    point_depart_lat: float
    point_depart_lon: float
    duree_dispo: float
    niveau: NiveauEnum
    mode: ModeItineraireEnum
    point_arrivee_lat: Optional[float] = None
    point_arrivee_lon: Optional[float] = None
    trace_geojson: Optional[Any] = None
    distance_km: Optional[float] = None
    denivele_m: Optional[float] = None
    created_at: datetime


class ItineraireResume(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    point_depart_lat: float
    point_depart_lon: float
    duree_dispo: float
    niveau: NiveauEnum
    mode: ModeItineraireEnum
    point_arrivee_lat: Optional[float] = None
    point_arrivee_lon: Optional[float] = None
    distance_km: Optional[float] = None
    denivele_m: Optional[float] = None
    created_at: datetime


# --- Signalement ---

class SignalementCreate(BaseModel):
    lat: float
    lon: float
    type: SignalementType
    description: Optional[str] = None
    photo_url: Optional[str] = None


class SignalementOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    lat: float
    lon: float
    type: SignalementType
    description: Optional[str] = None
    photo_url: Optional[str] = None
    created_at: datetime
    upvotes: int
    score_fiabilite: int
    expire_at: datetime
    statut: SignalementStatut


# --- RandoHistorique ---

class RandoHistoriqueCreate(BaseModel):
    user_id: str
    itineraire_id: int
    notes: Optional[str] = None


class RandoHistoriqueOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: str
    itineraire_id: int
    date_realisation: datetime
    notes: Optional[str] = None
    itineraire: Optional[ItineraireResume] = None


# --- Guide audio ---

class PointInteret(BaseModel):
    nom: str
    lat: float
    lon: float
    description_courte: Optional[str] = None


class GuideGenererRequest(BaseModel):
    itineraire_id: int
    points_interet: list[PointInteret]


class GuidePoint(BaseModel):
    nom: str
    texte: str
    audio_url: Optional[str] = None


class GuideGenererResponse(BaseModel):
    itineraire_id: int
    points: list[GuidePoint]
