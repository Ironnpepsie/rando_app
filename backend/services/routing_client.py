import math
import os
import random

import httpx

ORS_API_KEY = os.getenv("ORS_API_KEY")
ORS_BASE_URL = "https://api.openrouteservice.org/v2/directions/foot-hiking/geojson"

# Vitesse de marche moyenne estimée (km/h), utilisée pour convertir la durée
# disponible en distance cible pour le round-trip ORS.
VITESSE_PAR_NIVEAU = {
    "facile": 3.5,
    "moyen": 3.0,
    "difficile": 2.5,
}


class RoutingError(Exception):
    pass


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    rayon_terre_km = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    a = (
        math.sin(delta_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    )
    return rayon_terre_km * 2 * math.asin(math.sqrt(a))


def _fallback_point_a_point(lat: float, lon: float, arrivee_lat: float, arrivee_lon: float) -> dict:
    """Ligne droite factice entre départ et arrivée, utilisée en l'absence
    de clé ORS_API_KEY (mode dev / démo hors-ligne)."""
    distance_km = _haversine_km(lat, lon, arrivee_lat, arrivee_lon)
    coords = [[lon, lat], [arrivee_lon, arrivee_lat]]
    return {
        "geojson": {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": {"type": "LineString", "coordinates": coords},
                    "properties": {"summary": {"distance": distance_km * 1000, "ascent": 0}},
                }
            ],
        },
        "distance_km": distance_km,
        "denivele_m": 0.0,
    }


def _fallback_boucle(lat: float, lon: float, distance_km: float) -> dict:
    """Boucle carrée factice autour du point de départ, utilisée en l'absence
    de clé ORS_API_KEY (mode dev / démo hors-ligne)."""
    cote_km = distance_km / 4
    delta_lat = cote_km / 111.0
    delta_lon = cote_km / (111.0 * math.cos(math.radians(lat)) or 1)

    coords = [
        [lon, lat],
        [lon + delta_lon, lat],
        [lon + delta_lon, lat + delta_lat],
        [lon, lat + delta_lat],
        [lon, lat],
    ]
    return {
        "geojson": {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": {"type": "LineString", "coordinates": coords},
                    "properties": {"summary": {"distance": distance_km * 1000, "ascent": 0}},
                }
            ],
        },
        "distance_km": distance_km,
        "denivele_m": 0.0,
    }


def generer_itineraire_rando(
    lat: float,
    lon: float,
    duree_dispo_h: float,
    niveau: str,
    mode: str = "boucle",
    arrivee_lat: float | None = None,
    arrivee_lon: float | None = None,
) -> dict:
    vitesse = VITESSE_PAR_NIVEAU.get(niveau, 3.0)
    distance_cible_m = duree_dispo_h * vitesse * 1000

    if mode == "point_a_point":
        if not ORS_API_KEY:
            return _fallback_point_a_point(lat, lon, arrivee_lat, arrivee_lon)
        body = {
            "coordinates": [[lon, lat], [arrivee_lon, arrivee_lat]],
            "elevation": True,
        }
    else:
        if not ORS_API_KEY:
            return _fallback_boucle(lat, lon, distance_cible_m / 1000)
        body = {
            "coordinates": [[lon, lat]],
            "elevation": True,
            "options": {
                "round_trip": {
                    "length": distance_cible_m,
                    "points": 5,
                    "seed": random.randint(0, 10_000),
                }
            },
        }

    headers = {"Authorization": ORS_API_KEY, "Content-Type": "application/json"}

    try:
        resp = httpx.post(ORS_BASE_URL, json=body, headers=headers, timeout=20)
        resp.raise_for_status()
    except httpx.HTTPError as exc:
        raise RoutingError(f"Erreur appel OpenRouteService: {exc}") from exc

    geojson = resp.json()
    properties = geojson["features"][0]["properties"]
    return {
        "geojson": geojson,
        "distance_km": properties["summary"]["distance"] / 1000,
        "denivele_m": properties.get("ascent", 0.0),
    }
