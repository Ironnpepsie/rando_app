import math

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/sentiers", tags=["sentiers"])

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
OPEN_ELEVATION_URL = "https://api.open-elevation.com/api/v1/lookup"
HEADERS = {"User-Agent": "RandoApp/1.0 (https://github.com/Ironnpepsie/rando_app)"}

RAYON_POI_TRACE_M = 300  # distance max pour associer un point d'intérêt à un sentier
DISTANCE_MIN_KM = 1  # exclut les fragments trop courts pour être une vraie suggestion
DISTANCE_MAX_KM = 25  # exclut les GR multi-jours qui ne font que traverser la zone
MAX_SUGGESTIONS = 5
MAX_ECHANTILLONS_ELEVATION = 30

RAYON_POINTS_PRATIQUES_M = 300  # distance max pour associer un point pratique au tracé
RAYON_POINTS_PRATIQUES_MAX_M = 1000  # borne haute acceptée en entrée
MAX_ECHANTILLONS_TRACE = 200

# (clé tag, valeur tag) -> type de point pratique renvoyé au frontend
TAGS_POINTS_PRATIQUES = {
    ("tourism", "alpine_hut"): "refuge",
    ("tourism", "wilderness_hut"): "refuge",
    ("amenity", "drinking_water"): "eau",
    ("amenity", "shelter"): "abri",
}


class PointsPratiquesRequest(BaseModel):
    trace: list[list[float]]  # [[lat, lon], ...] (une éventuelle 3e valeur elevation est ignorée)
    rayon_m: float = RAYON_POINTS_PRATIQUES_M


def _haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    rayon_terre_m = 6371000.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    a = (
        math.sin(delta_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    )
    return rayon_terre_m * 2 * math.asin(math.sqrt(a))


def _distance_ligne_m(coords: list[tuple[float, float]]) -> float:
    return sum(_haversine_m(*coords[i], *coords[i + 1]) for i in range(len(coords) - 1))


def _echantillonner(coords: list[tuple[float, float]], n: int) -> list[tuple[float, float]]:
    if len(coords) <= n:
        return coords
    pas = len(coords) / n
    return [coords[int(i * pas)] for i in range(n)]


def _denivele_positif(coords: list[tuple[float, float]]) -> float | None:
    """Interroge Open-Elevation sur un échantillon de points du tracé.
    Retourne None (plutôt que 0) si l'API échoue, pour distinguer "pas de dénivelé"
    de "dénivelé inconnu" côté frontend."""
    echantillon = _echantillonner(coords, MAX_ECHANTILLONS_ELEVATION)
    locations = [{"latitude": lat, "longitude": lon} for lat, lon in echantillon]
    try:
        resp = httpx.post(
            OPEN_ELEVATION_URL, json={"locations": locations}, headers=HEADERS, timeout=15
        )
        resp.raise_for_status()
        elevations = [pt["elevation"] for pt in resp.json()["results"]]
    except (httpx.HTTPError, KeyError, ValueError):
        return None

    denivele = 0.0
    for i in range(len(elevations) - 1):
        diff = elevations[i + 1] - elevations[i]
        if diff > 0:
            denivele += diff
    return denivele


@router.get("/suggestions")
def suggerer_sentiers(lat: float, lon: float, rayon_km: float = 10):
    rayon_km = min(rayon_km, 20)
    rayon_m = rayon_km * 1000

    requete_sentiers = f"""
    [out:json][timeout:25];
    relation["route"="hiking"](around:{rayon_m},{lat},{lon});
    out geom;
    """
    requete_pois = f"""
    [out:json][timeout:25];
    (
      node["natural"="peak"](around:{rayon_m},{lat},{lon});
      node["tourism"="viewpoint"](around:{rayon_m},{lat},{lon});
    );
    out body;
    """

    try:
        resp_sentiers = httpx.post(
            OVERPASS_URL, data={"data": requete_sentiers}, headers=HEADERS, timeout=30
        )
        resp_sentiers.raise_for_status()
        resp_pois = httpx.post(
            OVERPASS_URL, data={"data": requete_pois}, headers=HEADERS, timeout=30
        )
        resp_pois.raise_for_status()
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Erreur appel Overpass: {exc}") from exc

    elements_sentiers = resp_sentiers.json().get("elements", [])
    pois = [
        (el["lat"], el["lon"])
        for el in resp_pois.json().get("elements", [])
        if el.get("type") == "node"
    ]

    candidats = []
    for rel in elements_sentiers:
        if rel.get("type") != "relation":
            continue

        coords: list[tuple[float, float]] = []
        for membre in rel.get("members", []):
            geom = membre.get("geometry")
            if geom:
                coords.extend((pt["lat"], pt["lon"]) for pt in geom)
        if len(coords) < 2:
            continue

        distance_m = _distance_ligne_m(coords)
        distance_km = distance_m / 1000
        if not (DISTANCE_MIN_KM <= distance_km <= DISTANCE_MAX_KM):
            continue

        coords_echantillon = _echantillonner(coords, 100)
        nb_pois = sum(
            1
            for poi_lat, poi_lon in pois
            if min(_haversine_m(poi_lat, poi_lon, c[0], c[1]) for c in coords_echantillon)
            <= RAYON_POI_TRACE_M
        )

        tags = rel.get("tags", {})
        candidats.append(
            {
                "id": rel["id"],
                "nom": tags.get("name") or f"Sentier #{rel['id']}",
                "distance_km": round(distance_km, 2),
                "nb_pois": nb_pois,
                "coords": coords,
            }
        )

    def distance_au_point(candidat):
        return min(_haversine_m(lat, lon, c[0], c[1]) for c in candidat["coords"])

    candidats.sort(key=distance_au_point)
    candidats = candidats[:MAX_SUGGESTIONS]

    suggestions = []
    for c in candidats:
        suggestions.append(
            {
                "id": c["id"],
                "nom": c["nom"],
                "distance_km": c["distance_km"],
                "denivele_m": _denivele_positif(c["coords"]),
                "nb_pois": c["nb_pois"],
                "trace_geojson": {
                    "type": "FeatureCollection",
                    "features": [
                        {
                            "type": "Feature",
                            "properties": {},
                            "geometry": {
                                "type": "LineString",
                                "coordinates": [[lon, lat] for lat, lon in c["coords"]],
                            },
                        }
                    ],
                },
            }
        )

    return suggestions


@router.post("/points-pratiques")
def points_pratiques(payload: PointsPratiquesRequest):
    trace = [(pt[0], pt[1]) for pt in payload.trace]
    if len(trace) < 1:
        return []
    rayon_m = min(payload.rayon_m, RAYON_POINTS_PRATIQUES_MAX_M)

    lats = [pt[0] for pt in trace]
    lons = [pt[1] for pt in trace]
    marge_deg = (rayon_m / 111000) + 0.005  # marge de bbox pour ne pas rater un point en bordure
    sud, nord = min(lats) - marge_deg, max(lats) + marge_deg
    ouest, est = min(lons) - marge_deg, max(lons) + marge_deg

    # nwr (pas juste node) : les refuges gérés/en dur sont très souvent cartographiés comme
    # un bâtiment (way), pas comme un simple point ; un node-only query les rate silencieusement.
    requete = f"""
    [out:json][timeout:25];
    (
      nwr["tourism"="alpine_hut"]({sud},{ouest},{nord},{est});
      nwr["tourism"="wilderness_hut"]({sud},{ouest},{nord},{est});
      nwr["amenity"="drinking_water"]({sud},{ouest},{nord},{est});
      nwr["amenity"="shelter"]({sud},{ouest},{nord},{est});
    );
    out center;
    """

    try:
        resp = httpx.post(OVERPASS_URL, data={"data": requete}, headers=HEADERS, timeout=30)
        resp.raise_for_status()
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Erreur appel Overpass: {exc}") from exc

    trace_echantillon = _echantillonner(trace, MAX_ECHANTILLONS_TRACE)

    points = []
    for el in resp.json().get("elements", []):
        tags = el.get("tags", {})

        type_point = None
        for (cle, valeur), nom_type in TAGS_POINTS_PRATIQUES.items():
            if tags.get(cle) == valeur:
                type_point = nom_type
                break
        if type_point is None:
            continue

        # node : lat/lon directement ; way/relation : centre renvoyé par "out center"
        if el["type"] == "node":
            lat, lon = el["lat"], el["lon"]
        else:
            centre = el.get("center")
            if not centre:
                continue
            lat, lon = centre["lat"], centre["lon"]

        distance_min = min(_haversine_m(lat, lon, c[0], c[1]) for c in trace_echantillon)
        if distance_min > rayon_m:
            continue

        points.append(
            {
                "id": el["id"],
                "type": type_point,
                "nom": tags.get("name"),
                "lat": lat,
                "lon": lon,
            }
        )

    return points
