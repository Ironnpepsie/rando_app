import httpx
from fastapi import APIRouter, HTTPException

from services.routing_client import ORS_API_KEY

router = APIRouter(prefix="/geocode", tags=["geocode"])

ORS_GEOCODE_URL = "https://api.openrouteservice.org/geocode/search"


@router.get("/search")
def rechercher_lieu(q: str, lat: float | None = None, lon: float | None = None):
    if not ORS_API_KEY:
        raise HTTPException(status_code=503, detail="Géocodage indisponible : clé ORS non configurée")

    params = {"api_key": ORS_API_KEY, "text": q, "size": 5}
    if lat is not None and lon is not None:
        # Favorise les résultats proches de la zone actuellement affichée sur la carte
        params["focus.point.lat"] = lat
        params["focus.point.lon"] = lon

    try:
        resp = httpx.get(ORS_GEOCODE_URL, params=params, timeout=10)
        resp.raise_for_status()
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Erreur appel géocodage: {exc}") from exc

    return resp.json()
