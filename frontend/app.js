const API_BASE = "https://wrongly-maybe-darkened.ngrok-free.dev";

// ngrok (plan gratuit) affiche une page d'avertissement HTML sur chaque requête
// tant que ce header n'est pas présent, ce qui casse les appels fetch/JSON.
function apiFetch(path, options = {}) {
  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { "ngrok-skip-browser-warning": "true", ...(options.headers || {}) },
  });
}
const DEFAULT_CENTER = [45.9237, 6.8694]; // Chamonix

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch((err) => {
      console.error("Échec de l'enregistrement du service worker :", err);
    });
  });
}

// ---------- Installation PWA (Chrome / Android) ----------

let deferredInstallPrompt = null;

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  document.getElementById("btn-install-app").classList.remove("hidden");
});

document.getElementById("btn-install-app").addEventListener("click", async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  document.getElementById("btn-install-app").classList.add("hidden");
});

window.addEventListener("appinstalled", () => {
  document.getElementById("btn-install-app").classList.add("hidden");
});

function getOrCreateUserId() {
  const key = "randoapp_user_id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

const USER_ID = getOrCreateUserId();

const TYPE_META = {
  eboulement: { emoji: "🪨", label: "Éboulement" },
  sentier_bloque: { emoji: "🚧", label: "Sentier bloqué" },
  pont_casse: { emoji: "🌉", label: "Pont cassé" },
  animal: { emoji: "🐾", label: "Animal dangereux" },
  autre: { emoji: "❓", label: "Autre" },
};

// Table de correspondance des codes WMO (weather_code) renvoyés par Open-Meteo
const WMO_META = {
  0: { emoji: "☀️", label: "Ciel dégagé" },
  1: { emoji: "🌤️", label: "Plutôt dégagé" },
  2: { emoji: "⛅", label: "Partiellement nuageux" },
  3: { emoji: "☁️", label: "Couvert" },
  45: { emoji: "🌫️", label: "Brouillard" },
  48: { emoji: "🌫️", label: "Brouillard givrant" },
  51: { emoji: "🌦️", label: "Bruine légère" },
  53: { emoji: "🌦️", label: "Bruine modérée" },
  55: { emoji: "🌦️", label: "Bruine forte" },
  56: { emoji: "🌧️", label: "Bruine verglaçante" },
  57: { emoji: "🌧️", label: "Bruine verglaçante forte" },
  61: { emoji: "🌧️", label: "Pluie légère" },
  63: { emoji: "🌧️", label: "Pluie modérée" },
  65: { emoji: "🌧️", label: "Pluie forte" },
  66: { emoji: "🌧️", label: "Pluie verglaçante" },
  67: { emoji: "🌧️", label: "Pluie verglaçante forte" },
  71: { emoji: "🌨️", label: "Neige légère" },
  73: { emoji: "🌨️", label: "Neige modérée" },
  75: { emoji: "🌨️", label: "Neige forte" },
  77: { emoji: "🌨️", label: "Grains de neige" },
  80: { emoji: "🌦️", label: "Averses légères" },
  81: { emoji: "🌦️", label: "Averses modérées" },
  82: { emoji: "⛈️", label: "Averses violentes" },
  85: { emoji: "🌨️", label: "Averses de neige" },
  86: { emoji: "🌨️", label: "Averses de neige fortes" },
  95: { emoji: "⛈️", label: "Orage" },
  96: { emoji: "⛈️", label: "Orage avec grêle" },
  99: { emoji: "⛈️", label: "Orage violent avec grêle" },
};

// Codes correspondant à un temps dangereux (pluie forte, orage, neige forte)
const CODES_ALERTE = new Set([65, 67, 75, 82, 86, 95, 96, 99]);

function meteoInfo(code) {
  return WMO_META[code] || { emoji: "❓", label: "Conditions inconnues" };
}

const map = L.map("map").setView(DEFAULT_CENTER, 13);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "&copy; OpenStreetMap contributors",
  maxZoom: 19,
}).addTo(map);

// Couches météo OpenWeatherMap (Weather Maps 1.0), désactivées par défaut
const OWM_API_KEY = "66729b814266daf0e5544857f8033736";
const OWM_ATTRIBUTION = '&copy; <a href="https://openweathermap.org">OpenWeatherMap</a>';

function owmLayer(layerName) {
  return L.tileLayer(
    `https://tile.openweathermap.org/map/${layerName}/{z}/{x}/{y}.png?appid=${OWM_API_KEY}`,
    { attribution: OWM_ATTRIBUTION, opacity: 0.6, maxZoom: 19 }
  );
}

const coucheNuages = owmLayer("clouds_new");
const couchePluie = owmLayer("precipitation_new");
const coucheVent = owmLayer("wind_new");

const btnMeteoLayersToggle = document.getElementById("btn-meteo-layers-toggle");
const meteoLayersPopover = document.getElementById("meteo-layers-popover");
const chkPluie = document.getElementById("chk-pluie");
const chkNuages = document.getElementById("chk-nuages");
const chkVent = document.getElementById("chk-vent");

btnMeteoLayersToggle.addEventListener("click", () => {
  meteoLayersPopover.classList.toggle("hidden");
});

function wireCoucheToggle(checkbox, layer) {
  checkbox.addEventListener("change", () => {
    if (checkbox.checked) {
      layer.addTo(map);
    } else {
      map.removeLayer(layer);
    }
  });
}

wireCoucheToggle(chkPluie, couchePluie);
wireCoucheToggle(chkNuages, coucheNuages);
wireCoucheToggle(chkVent, coucheVent);

const traceLayer = L.featureGroup().addTo(map);
const signalementsLayer = L.layerGroup().addTo(map);
let departMarker = null;
let arriveeMarker = null;
let pendingMarker = null;
let lastCenter = { lat: DEFAULT_CENTER[0], lon: DEFAULT_CENTER[1] };
let pickMode = null; // null | 'depart' | 'arrivee' | 'signalement'
let departLatLng = null;
let arriveeLatLng = null;
let signalementLatLng = null;
let currentItineraireId = null;

const arriveeIcon = L.divIcon({
  html: '<span style="font-size:26px;">🏁</span>',
  className: "",
  iconSize: [28, 28],
  iconAnchor: [14, 26],
});

const mapEl = document.getElementById("map");
const btnPickDepart = document.getElementById("btn-pick-depart");
const btnPickArrivee = document.getElementById("btn-pick-arrivee");
const btnPickSignalement = document.getElementById("btn-pick-signalement");
const departCoordsEl = document.getElementById("depart-coords");
const arriveeCoordsEl = document.getElementById("arrivee-coords");
const arriveeSectionEl = document.getElementById("arrivee-section");
const modeSelect = document.getElementById("mode-itineraire");
const signalementCoordsEl = document.getElementById("signalement-coords");
const formItineraire = document.getElementById("form-itineraire");
const btnGenerer = document.getElementById("btn-generer");
const resultatEl = document.getElementById("resultat-itineraire");
const resDistanceEl = document.getElementById("res-distance");
const resDeniveleEl = document.getElementById("res-denivele");
const meteoPanelEl = document.getElementById("meteo-panel");
const meteoIconEl = document.getElementById("meteo-icon");
const meteoTempEl = document.getElementById("meteo-temp");
const meteoDescEl = document.getElementById("meteo-desc");
const meteoAlertEl = document.getElementById("meteo-alert");
const btnMarquerFait = document.getElementById("btn-marquer-fait");
const marquerFaitMsgEl = document.getElementById("marquer-fait-msg");
const itineraireErrorEl = document.getElementById("itineraire-error");
const formSignalement = document.getElementById("form-signalement");
const btnSignaler = document.getElementById("btn-signaler");
const signalementMsgEl = document.getElementById("signalement-msg");
const btnRefreshSignalements = document.getElementById("btn-refresh-signalements");
const historiqueListeEl = document.getElementById("historique-liste");
const historiqueVideEl = document.getElementById("historique-vide");
const btnRefreshHistorique = document.getElementById("btn-refresh-historique");
const btnGeoloc = document.getElementById("btn-geoloc");
const geolocErrorEl = document.getElementById("geoloc-error");
const pickingBanner = document.getElementById("picking-banner");
const pickingBannerText = document.getElementById("picking-banner-text");
const btnPickingCancel = document.getElementById("btn-picking-cancel");

// ---------- Bottom sheets / barre d'onglets ----------

const SHEETS = ["itineraire", "historique", "signalement"];

function closeAllSheets() {
  for (const name of SHEETS) {
    document.getElementById(`sheet-${name}`).classList.remove("open");
  }
  document.querySelectorAll(".tab-btn").forEach((btn) => btn.classList.remove("active"));
}

function openSheet(name) {
  closeAllSheets();
  document.getElementById(`sheet-${name}`).classList.add("open");
  document.querySelector(`.tab-btn[data-sheet="${name}"]`).classList.add("active");
}

document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const name = btn.dataset.sheet;
    const isOpen = document.getElementById(`sheet-${name}`).classList.contains("open");
    if (isOpen) {
      closeAllSheets();
    } else {
      openSheet(name);
    }
  });
});

document.querySelectorAll(".sheet-close").forEach((btn) => {
  btn.addEventListener("click", () => closeAllSheets());
});

openSheet("itineraire");

// ---------- Sélection d'un point sur la carte ----------

let pickOriginSheet = null;

const PICKING_BANNER_TEXTS = {
  depart: "Touchez la carte pour choisir le point de départ",
  arrivee: "Touchez la carte pour choisir le point d'arrivée",
  signalement: "Touchez la carte pour choisir la position du signalement",
};

function setPickMode(mode) {
  pickMode = mode;
  btnPickDepart.classList.toggle("active", mode === "depart");
  btnPickArrivee.classList.toggle("active", mode === "arrivee");
  btnPickSignalement.classList.toggle("active", mode === "signalement");
  mapEl.classList.toggle("picking", mode !== null);

  if (mode) {
    pickOriginSheet = SHEETS.find((name) =>
      document.getElementById(`sheet-${name}`).classList.contains("open")
    );
    closeAllSheets();
    pickingBannerText.textContent = PICKING_BANNER_TEXTS[mode];
    pickingBanner.classList.remove("hidden");
  } else {
    pickingBanner.classList.add("hidden");
    if (pickOriginSheet) {
      openSheet(pickOriginSheet);
      pickOriginSheet = null;
    }
  }
}

btnPickDepart.addEventListener("click", () => {
  setPickMode(pickMode === "depart" ? null : "depart");
});

btnPickArrivee.addEventListener("click", () => {
  setPickMode(pickMode === "arrivee" ? null : "arrivee");
});

btnPickSignalement.addEventListener("click", () => {
  setPickMode(pickMode === "signalement" ? null : "signalement");
});

btnPickingCancel.addEventListener("click", () => setPickMode(null));

// ---------- Géolocalisation ----------

function updateBtnGenererState() {
  const arriveeRequise = modeSelect.value === "point_a_point";
  btnGenerer.disabled = !departLatLng || (arriveeRequise && !arriveeLatLng);
}

function placerDepart(lat, lon, recentrer) {
  const latlng = L.latLng(lat, lon);
  departLatLng = latlng;
  if (departMarker) departMarker.remove();
  departMarker = L.marker(latlng, { title: "Point de départ" }).addTo(map);
  departCoordsEl.textContent = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
  updateBtnGenererState();
  if (recentrer) map.setView(latlng, 14);
}

function placerArrivee(lat, lon) {
  const latlng = L.latLng(lat, lon);
  arriveeLatLng = latlng;
  if (arriveeMarker) arriveeMarker.remove();
  arriveeMarker = L.marker(latlng, { title: "Point d'arrivée", icon: arriveeIcon }).addTo(map);
  arriveeCoordsEl.textContent = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
  updateBtnGenererState();
}

modeSelect.addEventListener("change", () => {
  const pointAPoint = modeSelect.value === "point_a_point";
  arriveeSectionEl.classList.toggle("hidden", !pointAPoint);

  if (!pointAPoint) {
    if (pickMode === "arrivee") setPickMode(null);
    if (arriveeMarker) {
      arriveeMarker.remove();
      arriveeMarker = null;
    }
    arriveeLatLng = null;
    arriveeCoordsEl.textContent = "Aucun point sélectionné";
  }

  updateBtnGenererState();
});

btnGeoloc.addEventListener("click", () => {
  geolocErrorEl.classList.add("hidden");

  if (!navigator.geolocation) {
    geolocErrorEl.textContent = "Géolocalisation non disponible sur cet appareil.";
    geolocErrorEl.classList.remove("hidden");
    return;
  }

  btnGeoloc.disabled = true;
  btnGeoloc.textContent = "Localisation en cours...";

  navigator.geolocation.getCurrentPosition(
    (position) => {
      placerDepart(position.coords.latitude, position.coords.longitude, true);
      btnGeoloc.disabled = false;
      btnGeoloc.textContent = "📍 Utiliser ma position actuelle";
    },
    (err) => {
      geolocErrorEl.textContent =
        err.code === err.PERMISSION_DENIED
          ? "Permission de localisation refusée."
          : "Impossible de récupérer votre position.";
      geolocErrorEl.classList.remove("hidden");
      btnGeoloc.disabled = false;
      btnGeoloc.textContent = "📍 Utiliser ma position actuelle";
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
});

map.on("click", (e) => {
  if (pickMode === "depart") {
    placerDepart(e.latlng.lat, e.latlng.lng);
    setPickMode(null);
  } else if (pickMode === "arrivee") {
    placerArrivee(e.latlng.lat, e.latlng.lng);
    setPickMode(null);
  } else if (pickMode === "signalement") {
    signalementLatLng = e.latlng;
    if (pendingMarker) pendingMarker.remove();
    pendingMarker = L.marker(e.latlng, {
      title: "Nouveau signalement",
      opacity: 0.7,
    }).addTo(map);
    signalementCoordsEl.textContent = `${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}`;
    btnSignaler.disabled = false;
    setPickMode(null);
  }
});

function signalementIcon(type, pending) {
  const meta = TYPE_META[type] || TYPE_META.autre;
  return L.divIcon({
    html: `<span style="font-size:22px;">${meta.emoji}${pending ? "⏳" : ""}</span>`,
    className: "",
    iconSize: [28, 24],
    iconAnchor: [14, 12],
  });
}

// ---------- Mode hors-ligne : file d'attente + cache local ----------

const PENDING_KEY = "randoapp_pending_signalements";
const CACHE_KEY = "randoapp_signalements_cache";

function getPendingSignalements() {
  try {
    return JSON.parse(localStorage.getItem(PENDING_KEY)) || [];
  } catch {
    return [];
  }
}

function savePendingSignalements(list) {
  localStorage.setItem(PENDING_KEY, JSON.stringify(list));
}

function addPendingSignalement(entry) {
  const list = getPendingSignalements();
  list.push(entry);
  savePendingSignalements(list);
}

function removePendingSignalement(tempId) {
  savePendingSignalements(getPendingSignalements().filter((e) => e.tempId !== tempId));
}

function saveSignalementsCache(lat, lon, data) {
  localStorage.setItem(
    CACHE_KEY,
    JSON.stringify({ lat, lon, data, cachedAt: new Date().toISOString() })
  );
}

function getSignalementsCache() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY));
  } catch {
    return null;
  }
}

const pendingInfoEl = document.getElementById("pending-info");
const pendingInfoTextEl = document.getElementById("pending-info-text");
const btnSyncNow = document.getElementById("btn-sync-now");
const signalementsCacheNoticeEl = document.getElementById("signalements-cache-notice");

function updatePendingUI() {
  const queue = getPendingSignalements();
  if (queue.length === 0) {
    pendingInfoEl.classList.add("hidden");
  } else {
    pendingInfoTextEl.textContent = `📤 ${queue.length} signalement(s) en attente d'envoi (hors-ligne).`;
    pendingInfoEl.classList.remove("hidden");
  }
}

let lastKnownSignalements = [];

function renderAllSignalements() {
  signalementsLayer.clearLayers();

  for (const s of lastKnownSignalements) {
    const meta = TYPE_META[s.type] || TYPE_META.autre;
    const expireDate = new Date(s.expire_at).toLocaleDateString("fr-FR");
    const popup = `
      <strong>${meta.emoji} ${meta.label}</strong><br>
      ${s.description ? `${s.description}<br>` : ""}
      👍 ${s.upvotes} confirmation(s)<br>
      Expire le ${expireDate}
    `;
    L.marker([s.lat, s.lon], { icon: signalementIcon(s.type, false) })
      .bindPopup(popup)
      .addTo(signalementsLayer);
  }

  for (const p of getPendingSignalements()) {
    const meta = TYPE_META[p.type] || TYPE_META.autre;
    const popup = `
      <strong>${meta.emoji} ${meta.label}</strong><br>
      ${p.description ? `${p.description}<br>` : ""}
      ⏳ En attente d'envoi (hors-ligne)
    `;
    L.marker([p.lat, p.lon], { icon: signalementIcon(p.type, true) })
      .bindPopup(popup)
      .addTo(signalementsLayer);
  }

  updatePendingUI();
}

async function fetchSignalementsProches(lat, lon) {
  lastCenter = { lat, lon };
  try {
    const resp = await apiFetch(
      `/signalements/proches?lat=${lat}&lon=${lon}&rayon_km=5`
    );
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const signalements = await resp.json();
    lastKnownSignalements = signalements;
    saveSignalementsCache(lat, lon, signalements);
    signalementsCacheNoticeEl.classList.add("hidden");
  } catch (err) {
    console.error("Erreur chargement signalements :", err);
    const cache = getSignalementsCache();
    if (cache) {
      lastKnownSignalements = cache.data;
      const cachedAt = new Date(cache.cachedAt).toLocaleString("fr-FR");
      signalementsCacheNoticeEl.textContent = `⚠️ Hors-ligne : signalements affichés depuis le cache (${cachedAt}).`;
      signalementsCacheNoticeEl.classList.remove("hidden");
    } else {
      lastKnownSignalements = [];
    }
  }
  renderAllSignalements();
}

function queueSignalementOffline(payload) {
  const entry = { tempId: crypto.randomUUID(), ...payload, createdAt: new Date().toISOString() };
  addPendingSignalement(entry);
  renderAllSignalements();

  signalementMsgEl.textContent =
    "Pas de réseau : signalement enregistré sur l'appareil, il sera envoyé automatiquement dès que la connexion revient.";
  signalementMsgEl.classList.remove("hidden", "msg-error", "msg-success");
  signalementMsgEl.classList.add("msg-info");

  formSignalement.reset();
  if (pendingMarker) {
    pendingMarker.remove();
    pendingMarker = null;
  }
  signalementLatLng = null;
  signalementCoordsEl.textContent = "Aucune position sélectionnée";
  btnSignaler.disabled = true;
  btnSignaler.textContent = "Envoyer le signalement";
}

let syncEnCours = false;

async function syncPendingSignalements() {
  if (syncEnCours) return;
  const queue = getPendingSignalements();
  if (queue.length === 0) return;
  syncEnCours = true;

  for (const entry of queue) {
    try {
      const resp = await apiFetch(`/signalements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: entry.lat,
          lon: entry.lon,
          type: entry.type,
          description: entry.description,
        }),
      });

      if (!resp.ok) {
        console.error("Signalement en attente rejeté par le serveur, abandonné:", await resp.text());
      }
      removePendingSignalement(entry.tempId);
    } catch (err) {
      break; // toujours hors-ligne, on retentera plus tard
    }
  }

  renderAllSignalements();
  syncEnCours = false;
}

window.addEventListener("online", syncPendingSignalements);
setInterval(() => {
  if (navigator.onLine) syncPendingSignalements();
}, 20000);

btnSyncNow.addEventListener("click", syncPendingSignalements);

btnRefreshSignalements.addEventListener("click", () => {
  fetchSignalementsProches(lastCenter.lat, lastCenter.lon);
});

async function fetchMeteo(lat, lon) {
  try {
    const resp = await apiFetch(`/meteo?lat=${lat}&lon=${lon}`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();

    const current = data.current;
    const info = meteoInfo(current.weather_code);
    meteoIconEl.textContent = info.emoji;
    meteoTempEl.textContent = Math.round(current.temperature_2m);
    meteoDescEl.textContent = info.label;

    const codeAujourdhui = data.daily.weather_code[0];
    const probaAujourdhui = data.daily.precipitation_probability_max[0];
    const risqueOrage = CODES_ALERTE.has(current.weather_code) || CODES_ALERTE.has(codeAujourdhui);
    const risquePluieForte = probaAujourdhui >= 70;

    if (risqueOrage || risquePluieForte) {
      meteoAlertEl.textContent = risqueOrage
        ? "⚠️ Alerte : orage ou pluie forte prévu(e) aujourd'hui."
        : `⚠️ Alerte : ${probaAujourdhui}% de risque de pluie aujourd'hui.`;
      meteoAlertEl.classList.remove("hidden");
    } else {
      meteoAlertEl.classList.add("hidden");
    }

    meteoPanelEl.classList.remove("hidden");
  } catch (err) {
    console.error("Erreur chargement météo :", err);
    meteoPanelEl.classList.add("hidden");
  }
}

function resetMarquerFait(itineraireId) {
  currentItineraireId = itineraireId;
  marquerFaitMsgEl.classList.add("hidden");
  btnMarquerFait.disabled = false;
  btnMarquerFait.textContent = `✅ Marquer comme fait (${new Date().toLocaleDateString("fr-FR")})`;
  btnMarquerFait.classList.remove("hidden");
}

btnMarquerFait.addEventListener("click", async () => {
  if (!currentItineraireId) return;

  btnMarquerFait.disabled = true;
  marquerFaitMsgEl.classList.add("hidden");

  try {
    const resp = await apiFetch(`/historique`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: USER_ID,
        itineraire_id: currentItineraireId,
      }),
    });

    const data = await resp.json();
    if (!resp.ok) throw new Error(data.detail || `Erreur HTTP ${resp.status}`);

    btnMarquerFait.textContent = "✔️ Marqué comme fait";
    marquerFaitMsgEl.textContent = "Rando ajoutée à votre historique.";
    marquerFaitMsgEl.classList.remove("hidden", "msg-error");
    marquerFaitMsgEl.classList.add("msg-success");
    fetchHistorique();
  } catch (err) {
    btnMarquerFait.disabled = false;
    marquerFaitMsgEl.textContent = err.message;
    marquerFaitMsgEl.classList.remove("hidden", "msg-success");
    marquerFaitMsgEl.classList.add("msg-error");
  }
});

async function fetchHistorique() {
  try {
    const resp = await apiFetch(`/historique?user_id=${USER_ID}`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const entries = await resp.json();

    historiqueListeEl.innerHTML = "";
    historiqueVideEl.classList.toggle("hidden", entries.length > 0);

    for (const entry of entries) {
      const li = document.createElement("li");
      const date = new Date(entry.date_realisation).toLocaleDateString("fr-FR");
      const itin = entry.itineraire;
      if (itin) {
        li.innerHTML = `
          <strong>${date}</strong><br>
          Distance : ${itin.distance_km?.toFixed(2) ?? "?"} km —
          Dénivelé : ${Math.round(itin.denivele_m ?? 0)} m<br>
          Départ : ${itin.point_depart_lat.toFixed(4)}, ${itin.point_depart_lon.toFixed(4)}
        `;
      } else {
        li.innerHTML = `<strong>${date}</strong><br>Itinéraire supprimé`;
      }
      historiqueListeEl.appendChild(li);
    }
  } catch (err) {
    console.error("Erreur chargement historique :", err);
  }
}

btnRefreshHistorique.addEventListener("click", fetchHistorique);

formItineraire.addEventListener("submit", async (e) => {
  e.preventDefault();
  const mode = modeSelect.value;
  if (!departLatLng || (mode === "point_a_point" && !arriveeLatLng)) return;

  itineraireErrorEl.classList.add("hidden");
  resultatEl.classList.add("hidden");
  meteoPanelEl.classList.add("hidden");
  btnMarquerFait.classList.add("hidden");
  btnGenerer.disabled = true;
  btnGenerer.textContent = "Génération en cours...";

  try {
    const resp = await apiFetch(`/itineraires/generer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        point_depart_lat: departLatLng.lat,
        point_depart_lon: departLatLng.lng,
        duree_dispo: parseFloat(document.getElementById("duree").value),
        niveau: document.getElementById("niveau").value,
        mode,
        ...(mode === "point_a_point"
          ? { point_arrivee_lat: arriveeLatLng.lat, point_arrivee_lon: arriveeLatLng.lng }
          : {}),
      }),
    });

    const data = await resp.json();
    if (!resp.ok) {
      throw new Error(data.detail || `Erreur HTTP ${resp.status}`);
    }

    traceLayer.clearLayers();
    L.geoJSON(data.trace_geojson, {
      style: { color: "#2c7be5", weight: 4 },
    }).addTo(traceLayer);
    map.fitBounds(traceLayer.getBounds(), { padding: [30, 30] });

    resDistanceEl.textContent = data.distance_km.toFixed(2);
    resDeniveleEl.textContent = Math.round(data.denivele_m);
    resultatEl.classList.remove("hidden");

    fetchSignalementsProches(departLatLng.lat, departLatLng.lng);
    fetchMeteo(departLatLng.lat, departLatLng.lng);
    resetMarquerFait(data.id);
  } catch (err) {
    itineraireErrorEl.textContent = err.message;
    itineraireErrorEl.classList.remove("hidden");
  } finally {
    updateBtnGenererState();
    btnGenerer.textContent = "Générer l'itinéraire";
  }
});

formSignalement.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!signalementLatLng) return;

  signalementMsgEl.classList.add("hidden");
  btnSignaler.disabled = true;
  btnSignaler.textContent = "Envoi en cours...";

  const description = document.getElementById("description-signalement").value.trim();
  const payload = {
    lat: signalementLatLng.lat,
    lon: signalementLatLng.lng,
    type: document.getElementById("type-signalement").value,
    description: description || null,
  };

  if (!navigator.onLine) {
    queueSignalementOffline(payload);
    return;
  }

  try {
    const resp = await apiFetch(`/signalements`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await resp.json();
    if (!resp.ok) {
      throw new Error(data.detail || `Erreur HTTP ${resp.status}`);
    }

    signalementMsgEl.textContent = "Signalement envoyé, merci !";
    signalementMsgEl.classList.remove("hidden", "msg-error", "msg-info");
    signalementMsgEl.classList.add("msg-success");

    formSignalement.reset();
    if (pendingMarker) {
      pendingMarker.remove();
      pendingMarker = null;
    }
    signalementLatLng = null;
    signalementCoordsEl.textContent = "Aucune position sélectionnée";

    fetchSignalementsProches(data.lat, data.lon);
  } catch (err) {
    if (err instanceof TypeError) {
      // Échec réseau (pas de réponse du serveur) plutôt qu'une erreur applicative : on met en file d'attente
      queueSignalementOffline(payload);
      return;
    }
    signalementMsgEl.textContent = err.message;
    signalementMsgEl.classList.remove("hidden", "msg-success", "msg-info");
    signalementMsgEl.classList.add("msg-error");
  } finally {
    btnSignaler.disabled = !signalementLatLng;
    btnSignaler.textContent = "Envoyer le signalement";
  }
});

fetchSignalementsProches(DEFAULT_CENTER[0], DEFAULT_CENTER[1]);
fetchHistorique();
