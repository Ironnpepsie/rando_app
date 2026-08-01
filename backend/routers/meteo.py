import httpx
from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/meteo", tags=["meteo"])

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"


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
