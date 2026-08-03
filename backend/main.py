import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect

import models
from database import Base, engine
from routers import auth, geocode, guide, historique, itineraires, meteo, photos, sentiers, signalements


def _migrer_colonnes_itineraires():
    """create_all() ne modifie pas les tables déjà existantes : ajoute à la main
    les colonnes du mode point à point si la base a été créée avant leur ajout."""
    with engine.connect() as conn:
        colonnes = {row[1] for row in conn.exec_driver_sql("PRAGMA table_info(itineraires)")}
        if "mode" not in colonnes:
            conn.exec_driver_sql(
                "ALTER TABLE itineraires ADD COLUMN mode VARCHAR NOT NULL DEFAULT 'boucle'"
            )
        if "point_arrivee_lat" not in colonnes:
            conn.exec_driver_sql("ALTER TABLE itineraires ADD COLUMN point_arrivee_lat FLOAT")
        if "point_arrivee_lon" not in colonnes:
            conn.exec_driver_sql("ALTER TABLE itineraires ADD COLUMN point_arrivee_lon FLOAT")
        if "user_id" not in colonnes:
            conn.exec_driver_sql("ALTER TABLE itineraires ADD COLUMN user_id INTEGER")
        conn.commit()


def _migrer_vers_comptes_utilisateurs():
    """Passage au système de comptes utilisateurs (JWT) : signalements et
    historique étaient liés à une identité anonyme localStorage (createur_id /
    user_id texte), incompatible avec la nouvelle FK vers users.id. Comme
    convenu, ces données ne sont pas migrées : on repart d'un schéma propre
    pour ces deux tables (elles seront recréées par create_all juste après)."""
    inspecteur = inspect(engine)
    tables = inspecteur.get_table_names()
    if "users" in tables:
        return  # déjà migré
    with engine.connect() as conn:
        if "signalements" in tables:
            conn.exec_driver_sql("DROP TABLE signalements")
        if "rando_historique" in tables:
            conn.exec_driver_sql("DROP TABLE rando_historique")
        conn.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    _migrer_vers_comptes_utilisateurs()
    Base.metadata.create_all(bind=engine)
    _migrer_colonnes_itineraires()
    yield


app = FastAPI(title="RandoApp API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(itineraires.router)
app.include_router(geocode.router)
app.include_router(signalements.router)
app.include_router(meteo.router)
app.include_router(guide.router)
app.include_router(historique.router)
app.include_router(sentiers.router)
app.include_router(photos.router)


@app.get("/health")
def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
