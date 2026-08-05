from datetime import datetime
from typing import Optional, Any

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator

from models import (
    NiveauEnum,
    ModeItineraireEnum,
    SignalementType,
    SignalementStatut,
    FriendshipStatusEnum,
)


# --- Auth / User ---

class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    nom: str
    photo_base64: Optional[str] = None
    created_at: datetime


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    nom: str = Field(min_length=1)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    token: str
    user: UserOut


class PhotoProfilRequest(BaseModel):
    photo_base64: str = Field(min_length=1)


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
    user_id: Optional[int] = None
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
    user_id: int
    created_at: datetime
    upvotes: int
    score_fiabilite: int
    expire_at: datetime
    statut: SignalementStatut


# --- RandoHistorique ---

class RandoHistoriqueCreate(BaseModel):
    itineraire_id: int
    notes: Optional[str] = None
    # Stats réelles optionnelles, calculées côté client à partir des positions GPS
    # enregistrées pendant la navigation ("Terminer la rando"). Absentes lorsque
    # l'entrée vient d'un simple "Marquer comme fait" sans suivi GPS.
    trace_reelle: Optional[Any] = None
    distance_reelle_km: Optional[float] = None
    denivele_positif_reel_m: Optional[float] = None
    denivele_negatif_reel_m: Optional[float] = None
    duree_reelle_s: Optional[float] = None
    vitesse_moyenne_kmh: Optional[float] = None
    vitesse_max_kmh: Optional[float] = None


class RandoHistoriqueOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    itineraire_id: int
    date_realisation: datetime
    notes: Optional[str] = None
    itineraire: Optional[ItineraireResume] = None
    distance_reelle_km: Optional[float] = None
    denivele_positif_reel_m: Optional[float] = None
    denivele_negatif_reel_m: Optional[float] = None
    duree_reelle_s: Optional[float] = None
    vitesse_moyenne_kmh: Optional[float] = None
    vitesse_max_kmh: Optional[float] = None


class HistoriqueStats(BaseModel):
    nb_sorties: int
    distance_totale_km: float
    denivele_positif_cumule_m: float
    duree_totale_s: float
    record_distance_km: Optional[float] = None
    record_denivele_m: Optional[float] = None


# --- Amis ---

class UserPublicOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nom: str
    photo_base64: Optional[str] = None


class UserRechercheResult(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nom: str
    email: EmailStr
    photo_base64: Optional[str] = None
    # "aucune" | "ami" | "demande_envoyee" | "demande_recue"
    statut_amitie: str
    friendship_id: Optional[int] = None


class FriendshipCreate(BaseModel):
    friend_id: int


class FriendshipOut(BaseModel):
    id: int
    status: FriendshipStatusEnum
    created_at: datetime
    # L'autre utilisateur de la relation, du point de vue de l'utilisateur courant.
    utilisateur: UserPublicOut


class ProfilAmiOut(BaseModel):
    utilisateur: UserPublicOut
    stats: HistoriqueStats


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
