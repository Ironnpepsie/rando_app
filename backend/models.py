import enum
from datetime import datetime, timedelta

from sqlalchemy import (
    Column,
    Integer,
    Float,
    String,
    Text,
    DateTime,
    Enum,
    ForeignKey,
    JSON,
)
from sqlalchemy.orm import relationship

from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=True)  # null si compte Google uniquement
    nom = Column(String, nullable=False)
    google_id = Column(String, unique=True, index=True, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class NiveauEnum(str, enum.Enum):
    facile = "facile"
    moyen = "moyen"
    difficile = "difficile"


class ModeItineraireEnum(str, enum.Enum):
    boucle = "boucle"
    point_a_point = "point_a_point"


class SignalementType(str, enum.Enum):
    eboulement = "eboulement"
    sentier_bloque = "sentier_bloque"
    pont_casse = "pont_casse"
    animal = "animal"
    autre = "autre"


class SignalementStatut(str, enum.Enum):
    actif = "actif"
    expire = "expire"
    invalide = "invalide"


# Durée de validité par défaut avant expiration auto, selon le type de signalement
EXPIRATION_PAR_TYPE = {
    SignalementType.eboulement: timedelta(days=15),
    SignalementType.sentier_bloque: timedelta(days=15),
    SignalementType.pont_casse: timedelta(days=15),
    SignalementType.animal: timedelta(days=2),
    SignalementType.autre: timedelta(days=7),
}


class Itineraire(Base):
    __tablename__ = "itineraires"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    point_depart_lat = Column(Float, nullable=False)
    point_depart_lon = Column(Float, nullable=False)
    duree_dispo = Column(Float, nullable=False)  # heures
    niveau = Column(Enum(NiveauEnum), nullable=False)
    mode = Column(Enum(ModeItineraireEnum), nullable=False, default=ModeItineraireEnum.boucle)
    point_arrivee_lat = Column(Float, nullable=True)
    point_arrivee_lon = Column(Float, nullable=True)
    trace_geojson = Column(JSON, nullable=True)
    distance_km = Column(Float, nullable=True)
    denivele_m = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    historiques = relationship("RandoHistorique", back_populates="itineraire")


class Signalement(Base):
    __tablename__ = "signalements"

    id = Column(Integer, primary_key=True, index=True)
    lat = Column(Float, nullable=False)
    lon = Column(Float, nullable=False)
    type = Column(Enum(SignalementType), nullable=False)
    description = Column(Text, nullable=True)
    photo_url = Column(String, nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    upvotes = Column(Integer, default=0)
    score_fiabilite = Column(Integer, default=1)
    expire_at = Column(DateTime, nullable=False)
    statut = Column(Enum(SignalementStatut), default=SignalementStatut.actif)

    def __init__(self, **kwargs):
        if "expire_at" not in kwargs:
            type_ = kwargs.get("type")
            duree = EXPIRATION_PAR_TYPE.get(type_, timedelta(days=7))
            kwargs["expire_at"] = datetime.utcnow() + duree
        super().__init__(**kwargs)


class RandoHistorique(Base):
    __tablename__ = "rando_historique"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    itineraire_id = Column(Integer, ForeignKey("itineraires.id"), nullable=False)
    date_realisation = Column(DateTime, default=datetime.utcnow)
    notes = Column(Text, nullable=True)

    # Stats réelles enregistrées via le GPS pendant la navigation (feature "Terminer
    # la rando"), distinctes des stats prévues de l'itinéraire. Restent nulles pour
    # les entrées créées via "Marquer comme fait" sans suivi GPS.
    trace_reelle = Column(JSON, nullable=True)  # [[lat, lon, ele, timestamp_iso], ...]
    distance_reelle_km = Column(Float, nullable=True)
    denivele_positif_reel_m = Column(Float, nullable=True)
    denivele_negatif_reel_m = Column(Float, nullable=True)
    duree_reelle_s = Column(Float, nullable=True)
    vitesse_moyenne_kmh = Column(Float, nullable=True)
    vitesse_max_kmh = Column(Float, nullable=True)

    itineraire = relationship("Itineraire", back_populates="historiques")
