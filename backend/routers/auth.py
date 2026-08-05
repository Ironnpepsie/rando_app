from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import auth
import models
import schemas
from database import get_db

router = APIRouter(prefix="/auth", tags=["auth"])

# ~2 Mo d'image d'origine une fois décodée (base64 ajoute environ 33% de volume).
TAILLE_MAX_PHOTO_B64 = 2_800_000


@router.post("/register", response_model=schemas.AuthResponse)
def register(payload: schemas.RegisterRequest, db: Session = Depends(get_db)):
    existant = db.query(models.User).filter(models.User.email == payload.email).first()
    if existant is not None:
        raise HTTPException(status_code=409, detail="Un compte existe déjà avec cet email")

    user = models.User(
        email=payload.email,
        password_hash=auth.hash_password(payload.password),
        nom=payload.nom,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = auth.create_access_token(user.id)
    return schemas.AuthResponse(token=token, user=user)


@router.post("/login", response_model=schemas.AuthResponse)
def login(payload: schemas.LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == payload.email).first()
    if (
        user is None
        or user.password_hash is None
        or not auth.verify_password(payload.password, user.password_hash)
    ):
        raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")

    token = auth.create_access_token(user.id)
    return schemas.AuthResponse(token=token, user=user)


@router.post("/google")
def google_login():
    # Structure prête pour la connexion Google OAuth : reste à brancher la
    # vérification du id_token une fois le Client ID Google Cloud fourni.
    raise HTTPException(status_code=501, detail="Connexion Google pas encore disponible")


@router.post("/logout")
def logout():
    # JWT sans état côté serveur : la déconnexion consiste à supprimer le
    # token côté client, rien à invalider ici.
    return {"ok": True}


@router.get("/me", response_model=schemas.UserOut)
def me(current_user: models.User = Depends(auth.get_current_user)):
    return current_user


@router.put("/photo", response_model=schemas.UserOut)
def mettre_a_jour_photo(
    payload: schemas.PhotoProfilRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    if len(payload.photo_base64) > TAILLE_MAX_PHOTO_B64:
        raise HTTPException(status_code=413, detail="Photo trop volumineuse (2 Mo max)")

    current_user.photo_base64 = payload.photo_base64
    db.commit()
    db.refresh(current_user)
    return current_user
