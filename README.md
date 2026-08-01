# RandoApp

App de génération d'itinéraires de rando avec guide audio contextuel et
signalements communautaires en temps quasi-réel.

## Backend

```bash
cd backend
python3 -m venv venv
./venv/bin/pip install -r requirements.txt
cp .env.example .env   # renseigner ORS_API_KEY et ANTHROPIC_API_KEY
./venv/bin/uvicorn main:app --reload
```

API disponible sur http://localhost:8000, docs sur http://localhost:8000/docs.

Sans `ORS_API_KEY`, `/itineraires/generer` retourne une boucle factice
(dépannage dev). Sans `ANTHROPIC_API_KEY`, `/guide/generer` retourne un texte
gabarit basique.

## Frontend

Frontend statique en vanilla JS (`frontend/`) : carte Leaflet/OpenStreetMap,
formulaire de génération d'itinéraire, affichage du tracé et des signalements
proches, formulaire de création de signalement.

```bash
cd frontend
python3 -m http.server 5500
```

Ouvrir http://localhost:5500 (le backend doit tourner sur http://127.0.0.1:8000,
voir `API_BASE` dans `app.js`).
