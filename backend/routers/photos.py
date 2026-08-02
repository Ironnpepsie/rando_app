import httpx
from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/photos", tags=["photos"])

COMMONS_API_URL = "https://commons.wikimedia.org/w/api.php"
HEADERS = {"User-Agent": "RandoApp/1.0 (https://github.com/Ironnpepsie/rando_app)"}


@router.get("/proches")
def photos_proches(lat: float, lon: float, rayon_m: int = 1200, limite: int = 4):
    params = {
        "action": "query",
        "generator": "geosearch",
        "ggscoord": f"{lat}|{lon}",
        "ggsradius": min(rayon_m, 10000),  # 10 km = rayon max autorisé par Commons geosearch
        "ggsnamespace": 6,  # namespace "File:"
        "ggslimit": limite,
        "prop": "imageinfo",
        "iiprop": "url",
        "iiurlwidth": 400,
        "format": "json",
        "origin": "*",
    }
    try:
        resp = httpx.get(COMMONS_API_URL, params=params, headers=HEADERS, timeout=10)
        resp.raise_for_status()
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Erreur appel Wikimedia Commons: {exc}") from exc

    pages = resp.json().get("query", {}).get("pages", {})
    photos = []
    for page in pages.values():
        infos = page.get("imageinfo") or []
        if not infos:
            continue
        info = infos[0]
        if not info.get("thumburl"):
            continue
        photos.append(
            {
                "titre": page.get("title", "").removeprefix("File:"),
                "url_miniature": info["thumburl"],
                "url_page": info.get("descriptionurl"),
            }
        )
    return photos
