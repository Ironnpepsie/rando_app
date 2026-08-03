from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import auth
import models
import schemas
from database import get_db

router = APIRouter(prefix="/auth", tags=["auth"])


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
