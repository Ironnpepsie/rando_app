import os

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db
from services import tts

router = APIRouter(prefix="/guide", tags=["guide"])

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")


def _generer_texte(nom: str, description_courte: str | None, niveau: str) -> str:
    if not ANTHROPIC_API_KEY:
        base = f"Vous voici à {nom}."
        if description_courte:
            base += f" {description_courte}"
        return base

    import anthropic

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    prompt = (
        f"Rédige un court texte (3-4 phrases, ton chaleureux et informatif) pour un guide "
        f"audio de randonnée décrivant le point d'intérêt '{nom}'. "
        f"Niveau de la rando: {niveau}. "
        + (f"Contexte: {description_courte}. " if description_courte else "")
        + "Réponds uniquement avec le texte, sans préambule."
    )
    message = client.messages.create(
        model="claude-sonnet-5",
        max_tokens=300,
        messages=[{"role": "user", "content": prompt}],
    )
    return message.content[0].text.strip()


@router.post("/generer", response_model=schemas.GuideGenererResponse)
def generer_guide(payload: schemas.GuideGenererRequest, db: Session = Depends(get_db)):
    itineraire = db.get(models.Itineraire, payload.itineraire_id)
    if itineraire is None:
        raise HTTPException(status_code=404, detail="Itinéraire introuvable")

    points = []
    for poi in payload.points_interet:
        texte = _generer_texte(poi.nom, poi.description_courte, itineraire.niveau.value)
        audio_url = tts.generer_audio(texte)
        points.append(schemas.GuidePoint(nom=poi.nom, texte=texte, audio_url=audio_url))

    return schemas.GuideGenererResponse(itineraire_id=itineraire.id, points=points)
