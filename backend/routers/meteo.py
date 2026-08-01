from datetime import datetime, timedelta, timezone

import httpx
from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/meteo", tags=["meteo"])

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"

# Grille de points interrogés sur la zone visible (N x N)
TAILLE_GRILLE = 4

# Seuils empiriques pour un risque d'orage "élevé" en montagne : une
# instabilité significative (CAPE) combinée à une probabilité de précipitation
# notable dans les 3 prochaines heures.
SEUIL_CAPE = 500
SEUIL_PROBA_PRECIP = 40


@router.get("")
def obtenir_meteo(lat: float, lon: float):
    params = {
        "latitude": lat,
        "longitude": lon,
        "current": "temperature_2m,precipitation,weather_code,wind_speed_10m",
        "daily": "temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code",
        "timezone": "auto",
    }
    try:
        resp = httpx.get(OPEN_METEO_URL, params=params, timeout=10)
        resp.raise_for_status()
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Erreur appel Open-Meteo: {exc}") from exc

    return resp.json()


def _index_heure_actuelle(heures: list[str], decalage_utc_s: int) -> int:
    maintenant_local = (datetime.now(timezone.utc) + timedelta(seconds=decalage_utc_s)).replace(
        tzinfo=None
    )
    for i, h in enumerate(heures):
        if datetime.fromisoformat(h) >= maintenant_local:
            return i
    return max(len(heures) - 1, 0)


@router.get("/orage-grille")
def obtenir_orage_grille(lat_min: float, lat_max: float, lon_min: float, lon_max: float):
    n = TAILLE_GRILLE
    pas_lat = (lat_max - lat_min) / (n - 1) if n > 1 else 0
    pas_lon = (lon_max - lon_min) / (n - 1) if n > 1 else 0
    points = [
        (lat_min + i * pas_lat, lon_min + j * pas_lon) for i in range(n) for j in range(n)
    ]

    params = {
        "latitude": ",".join(str(p[0]) for p in points),
        "longitude": ",".join(str(p[1]) for p in points),
        "hourly": "cape,precipitation_probability",
        "forecast_days": 1,
        "timezone": "auto",
    }
    try:
        resp = httpx.get(OPEN_METEO_URL, params=params, timeout=10)
        resp.raise_for_status()
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Erreur appel Open-Meteo: {exc}") from exc

    donnees = resp.json()
    # Open-Meteo renvoie un objet unique (pas une liste) quand un seul point est demandé
    if isinstance(donnees, dict):
        donnees = [donnees]

    resultats = []
    for (lat, lon), point in zip(points, donnees):
        horaire = point["hourly"]
        heures = horaire["time"]
        capes = horaire["cape"]
        probas = horaire["precipitation_probability"]

        idx = _index_heure_actuelle(heures, point.get("utc_offset_seconds", 0))
        fenetre = range(idx, min(idx + 3, len(heures)))

        cape_max, proba_max, heure_pic = 0, 0, None
        for i in fenetre:
            if capes[i] is not None and capes[i] > cape_max:
                cape_max = capes[i]
                heure_pic = heures[i]
            if probas[i] is not None and probas[i] > proba_max:
                proba_max = probas[i]

        if cape_max >= SEUIL_CAPE and proba_max >= SEUIL_PROBA_PRECIP:
            resultats.append(
                {
                    "lat": lat,
                    "lon": lon,
                    "cape": cape_max,
                    "probabilite_precip": proba_max,
                    "heure_estimee": heure_pic,
                }
            )

    return resultats
