const API_BASE = "https://randoapp-production.up.railway.app";

function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = { ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(`${API_BASE}${path}`, { ...options, headers });
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

// ---------- Authentification ----------

const TOKEN_KEY = "randoapp_token";
const USER_KEY = "randoapp_user";

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY));
  } catch {
    return null;
  }
}

function setSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  currentUser = user;
}

function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  currentUser = null;
}

let currentUser = getStoredUser();

const authScreenEl = document.getElementById("auth-screen");
const formLogin = document.getElementById("form-login");
const formRegister = document.getElementById("form-register");
const authErrorEl = document.getElementById("auth-error");
const authTabs = document.querySelectorAll(".auth-tab");
const profilNomEl = document.getElementById("profil-nom");
const profilEmailEl = document.getElementById("profil-email");
const btnLogout = document.getElementById("btn-logout");
const btnVoirStats = document.getElementById("btn-voir-stats");
const btnStatsRetour = document.getElementById("btn-stats-retour");
const statsDistanceTotaleEl = document.getElementById("stats-distance-totale");
const statsDeniveleCumuleEl = document.getElementById("stats-denivele-cumule");
const statsNbSortiesEl = document.getElementById("stats-nb-sorties");
const statsDureeTotaleEl = document.getElementById("stats-duree-totale");
const statsRecordDistanceEl = document.getElementById("stats-record-distance");
const statsRecordDeniveleEl = document.getElementById("stats-record-denivele");
const statsVideEl = document.getElementById("stats-vide");
const profilPhotoEl = document.getElementById("profil-photo");
const profilPhotoPlaceholderEl = document.getElementById("profil-photo-placeholder");
const btnChangerPhoto = document.getElementById("btn-changer-photo");
const inputPhotoProfil = document.getElementById("input-photo-profil");
const photoProfilMsgEl = document.getElementById("photo-profil-msg");
const btnVoirAmis = document.getElementById("btn-voir-amis");
const btnAmisRetour = document.getElementById("btn-amis-retour");
const amisRechercheInput = document.getElementById("amis-recherche-input");
const amisRechercheResultatsEl = document.getElementById("amis-recherche-resultats");
const amisDemandesTitreEl = document.getElementById("amis-demandes-titre");
const amisDemandesListeEl = document.getElementById("amis-demandes-liste");
const amisListeEl = document.getElementById("amis-liste");
const amisVideEl = document.getElementById("amis-vide");
const btnAmiProfilRetour = document.getElementById("btn-ami-profil-retour");
const amiProfilTitreEl = document.getElementById("ami-profil-titre");
const amiProfilPhotoEl = document.getElementById("ami-profil-photo");
const amiProfilPhotoPlaceholderEl = document.getElementById("ami-profil-photo-placeholder");
const amiProfilNomEl = document.getElementById("ami-profil-nom");
const amiStatsDistanceTotaleEl = document.getElementById("ami-stats-distance-totale");
const amiStatsDeniveleCumuleEl = document.getElementById("ami-stats-denivele-cumule");
const amiStatsNbSortiesEl = document.getElementById("ami-stats-nb-sorties");
const amiStatsDureeTotaleEl = document.getElementById("ami-stats-duree-totale");
const amiHistoriqueListeEl = document.getElementById("ami-historique-liste");
const amiHistoriqueVideEl = document.getElementById("ami-historique-vide");
const amiRefaireMsgEl = document.getElementById("ami-refaire-msg");

function showAuthScreen() {
  authScreenEl.classList.remove("hidden");
}

function hideAuthScreen() {
  authScreenEl.classList.add("hidden");
}

// Échappe une chaîne avant de l'insérer dans du HTML construit dynamiquement (nom/email
// d'autres utilisateurs affichés via la recherche d'amis, contenu non fiable côté client).
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

function afficherPhoto(photoBase64, imgEl, placeholderEl) {
  if (photoBase64) {
    imgEl.src = photoBase64;
    imgEl.classList.remove("hidden");
    placeholderEl.classList.add("hidden");
  } else {
    imgEl.classList.add("hidden");
    placeholderEl.classList.remove("hidden");
  }
}

function afficherProfil() {
  if (!currentUser) return;
  profilNomEl.textContent = currentUser.nom;
  profilEmailEl.textContent = currentUser.email;
  afficherPhoto(currentUser.photo_base64, profilPhotoEl, profilPhotoPlaceholderEl);
}

function afficherMsgPhotoProfil(text, cls) {
  photoProfilMsgEl.textContent = text;
  photoProfilMsgEl.classList.remove("hidden", "msg-error", "msg-success", "msg-info");
  photoProfilMsgEl.classList.add(cls);
}

btnChangerPhoto.addEventListener("click", () => inputPhotoProfil.click());

inputPhotoProfil.addEventListener("change", async () => {
  const file = inputPhotoProfil.files[0];
  inputPhotoProfil.value = "";
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    afficherMsgPhotoProfil("Le fichier sélectionné n'est pas une image.", "msg-error");
    return;
  }
  if (file.size > 2_000_000) {
    afficherMsgPhotoProfil("Image trop volumineuse (2 Mo max).", "msg-error");
    return;
  }

  try {
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Lecture du fichier impossible."));
      reader.readAsDataURL(file);
    });

    const resp = await apiFetch("/auth/photo", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photo_base64: dataUrl }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.detail || `Erreur HTTP ${resp.status}`);

    currentUser = data;
    localStorage.setItem(USER_KEY, JSON.stringify(data));
    afficherProfil();
    photoProfilMsgEl.classList.add("hidden");
  } catch (err) {
    afficherMsgPhotoProfil(err.message, "msg-error");
  }
});

function afficherErreurAuth(message) {
  authErrorEl.textContent = message;
  authErrorEl.classList.remove("hidden");
}

authTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    authTabs.forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    const cible = tab.dataset.authTab;
    formLogin.classList.toggle("hidden", cible !== "login");
    formRegister.classList.toggle("hidden", cible !== "register");
    authErrorEl.classList.add("hidden");
  });
});

formLogin.addEventListener("submit", async (e) => {
  e.preventDefault();
  authErrorEl.classList.add("hidden");
  const submitBtn = formLogin.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  try {
    const resp = await apiFetch("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: document.getElementById("login-email").value.trim(),
        password: document.getElementById("login-password").value,
      }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.detail || `Erreur HTTP ${resp.status}`);
    setSession(data.token, data.user);
    afficherProfil();
    hideAuthScreen();
    formLogin.reset();
  } catch (err) {
    afficherErreurAuth(err.message);
  } finally {
    submitBtn.disabled = false;
  }
});

formRegister.addEventListener("submit", async (e) => {
  e.preventDefault();
  authErrorEl.classList.add("hidden");
  const submitBtn = formRegister.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  try {
    const resp = await apiFetch("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nom: document.getElementById("register-nom").value.trim(),
        email: document.getElementById("register-email").value.trim(),
        password: document.getElementById("register-password").value,
      }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.detail || `Erreur HTTP ${resp.status}`);
    setSession(data.token, data.user);
    afficherProfil();
    hideAuthScreen();
    formRegister.reset();
  } catch (err) {
    afficherErreurAuth(err.message);
  } finally {
    submitBtn.disabled = false;
  }
});

btnLogout.addEventListener("click", async () => {
  try {
    await apiFetch("/auth/logout", { method: "POST" });
  } catch {
    // best-effort : la déconnexion est de toute façon gérée côté client
  }
  clearSession();
  showAuthScreen();
  closeAllSheets();
});

async function fetchStats() {
  try {
    const resp = await apiFetch("/historique/stats");
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const stats = await resp.json();

    statsVideEl.classList.toggle("hidden", stats.nb_sorties > 0);
    statsDistanceTotaleEl.textContent = stats.distance_totale_km.toFixed(2);
    statsDeniveleCumuleEl.textContent = Math.round(stats.denivele_positif_cumule_m);
    statsNbSortiesEl.textContent = stats.nb_sorties;
    statsDureeTotaleEl.textContent = formatDureeS(stats.duree_totale_s);
    statsRecordDistanceEl.textContent =
      stats.record_distance_km != null ? stats.record_distance_km.toFixed(2) : "—";
    statsRecordDeniveleEl.textContent =
      stats.record_denivele_m != null ? Math.round(stats.record_denivele_m) : "—";
  } catch (err) {
    console.error("Erreur chargement des statistiques :", err);
  }
}

btnVoirStats.addEventListener("click", () => {
  openSheet("stats");
  document.querySelector('.tab-btn[data-sheet="profil"]')?.classList.add("active");
  fetchStats();
});

btnStatsRetour.addEventListener("click", () => openSheet("profil"));

async function verifierSession() {
  if (!getToken()) {
    showAuthScreen();
    return;
  }
  // Affichage optimiste depuis le cache local (évite un flash de l'écran de
  // connexion) pendant la vérification en arrière-plan du token auprès du serveur.
  afficherProfil();
  hideAuthScreen();
  try {
    const resp = await apiFetch("/auth/me");
    if (!resp.ok) throw new Error("session invalide");
    const user = await resp.json();
    currentUser = user;
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    afficherProfil();
    hideAuthScreen();
  } catch {
    clearSession();
    showAuthScreen();
  }
}

verifierSession();

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

// Anime la valeur affichée dans un stat-card de 0 jusqu'à endValue (ease-out).
function animateCountUp(el, endValue, { duration = 700, decimals = 0 } = {}) {
  const startTime = performance.now();

  function format(value) {
    return decimals > 0 ? value.toFixed(decimals) : Math.round(value).toString();
  }

  function tick(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = format(endValue * eased);
    if (progress < 1) requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
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
    {
      attribution: OWM_ATTRIBUTION,
      opacity: 0.6,
      maxZoom: 19,
      // Les tuiles météo OWM n'ont de vraies données que jusqu'au zoom 10 (au-delà,
      // l'API renvoie un PNG transparent 200 OK, donc la couche "disparaît" sans
      // erreur visible). maxNativeZoom fait upscaler les tuiles du zoom 10 au lieu
      // d'aller chercher des tuiles vides à un zoom plus poussé.
      maxNativeZoom: 10,
    }
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
const chkOrage = document.getElementById("chk-orage");

btnMeteoLayersToggle.addEventListener("click", () => {
  meteoLayersPopover.classList.toggle("hidden");
});

// Active/désactive une couche avec un fondu d'opacité doux plutôt qu'un affichage brutal.
function fadeTileLayer(layer, active) {
  if (active) {
    layer.addTo(map);
    // Le conteneur n'existe qu'une fois la couche ajoutée à la carte (première activation).
    const container = layer.getContainer ? layer.getContainer() : null;
    if (container) {
      container.style.transition = "none";
      container.style.opacity = "0";
      requestAnimationFrame(() => {
        container.style.transition = "opacity 0.35s ease";
        container.style.opacity = "1";
      });
    }
  } else {
    const container = layer.getContainer ? layer.getContainer() : null;
    if (container) {
      container.style.transition = "opacity 0.25s ease";
      container.style.opacity = "0";
      setTimeout(() => map.removeLayer(layer), 250);
    } else {
      map.removeLayer(layer);
    }
  }
}

function wireCoucheToggle(checkbox, layer) {
  checkbox.addEventListener("change", () => {
    fadeTileLayer(layer, checkbox.checked);
  });
}

wireCoucheToggle(chkPluie, couchePluie);
wireCoucheToggle(chkNuages, coucheNuages);
wireCoucheToggle(chkVent, coucheVent);

const traceLayer = L.featureGroup().addTo(map);
const signalementsLayer = L.layerGroup().addTo(map);
const orageLayer = L.layerGroup();
const pointsPratiquesLayer = L.layerGroup();
let departMarker = null;
let arriveeMarker = null;
let pendingMarker = null;
let lastCenter = { lat: DEFAULT_CENTER[0], lon: DEFAULT_CENTER[1] };
let pickMode = null; // null | 'depart' | 'arrivee' | 'signalement'
let departLatLng = null;
let arriveeLatLng = null;
let signalementLatLng = null;
let currentItineraireId = null;
let currentTraceCoords = null; // [[lat, lon], ...] du dernier itinéraire généré, pour la distance restante GPS
// Instructions turn-by-turn ORS (properties.segments[0].steps), null si non disponibles
// (suggestion Overpass, ou fallback dev sans clé ORS_API_KEY).
let currentSteps = null;

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
const rowDistanceRestanteEl = document.getElementById("row-distance-restante");
const resDistanceRestanteEl = document.getElementById("res-distance-restante");
const rowDeniveleRestantEl = document.getElementById("row-denivele-restant");
const resDeniveleRestantEl = document.getElementById("res-denivele-restant");
const rowTempsRestantEl = document.getElementById("row-temps-restant");
const resTempsRestantEl = document.getElementById("res-temps-restant");
const rowHeureArriveeEl = document.getElementById("row-heure-arrivee");
const resHeureArriveeEl = document.getElementById("res-heure-arrivee");
const btnDemarrerNav = document.getElementById("btn-demarrer-nav");
const btnTerminerNav = document.getElementById("btn-terminer-nav");
const terminerNavMsgEl = document.getElementById("terminer-nav-msg");
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
const btnGpsToggle = document.getElementById("btn-gps-toggle");
const gpsErrorBanner = document.getElementById("gps-error-banner");
const gpsErrorText = document.getElementById("gps-error-text");
const btnGpsErrorClose = document.getElementById("btn-gps-error-close");
const navInstructionBanner = document.getElementById("nav-instruction-banner");
const navInstructionIconeEl = document.getElementById("nav-instruction-icone");
const navInstructionConsigneEl = document.getElementById("nav-instruction-consigne");
const navInstructionDistanceEl = document.getElementById("nav-instruction-distance");
const btnRotationToggle = document.getElementById("btn-rotation-toggle");
const photosGalerieEl = document.getElementById("photos-galerie");
const btnChercherSuggestions = document.getElementById("btn-chercher-suggestions");
const suggestionsMsgEl = document.getElementById("suggestions-msg");
const suggestionsListeEl = document.getElementById("suggestions-liste");
const btnPointsPratiquesToggle = document.getElementById("btn-points-pratiques-toggle");

// ---------- Bottom sheets / barre d'onglets ----------

const SHEETS = [
  "itineraire",
  "suggestions",
  "historique",
  "signalement",
  "profil",
  "stats",
  "amis",
  "ami-profil",
];

function closeAllSheets() {
  for (const name of SHEETS) {
    document.getElementById(`sheet-${name}`).classList.remove("open");
  }
  document.querySelectorAll(".tab-btn").forEach((btn) => btn.classList.remove("active"));
}

function openSheet(name) {
  closeAllSheets();
  document.getElementById(`sheet-${name}`).classList.add("open");
  // Certaines sheets (ex. "stats") ne sont pas rattachées à un onglet de la tabbar.
  document.querySelector(`.tab-btn[data-sheet="${name}"]`)?.classList.add("active");
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

// ---------- Glisser pour fermer un panneau (façon Google Maps / Uber) ----------

const SEUIL_FERMETURE_SHEET_RATIO = 1 / 3; // fraction de la hauteur du panneau à dépasser pour le fermer
const SEUIL_DEADZONE_SHEET_PX = 6; // ignore les micros-mouvements pour ne pas gêner un simple tap

// Anime la sortie complète du panneau vers le bas avant de le fermer "pour de vrai"
// (retrait de la classe "open", cohérent avec le bouton ✕). Le nettoyage final réutilise
// la classe "dragging" (transition: none) pour repasser instantanément à l'état fermé
// normal sans provoquer de sursaut visuel entre les deux animations.
function fermerSheetAvecAnimation(sheetEl) {
  sheetEl.classList.remove("dragging");
  sheetEl.style.transform = "translateY(100%)";
  sheetEl.addEventListener(
    "transitionend",
    function onEnd(e) {
      if (e.propertyName !== "transform") return;
      sheetEl.removeEventListener("transitionend", onEnd);
      sheetEl.classList.add("dragging");
      closeAllSheets();
      sheetEl.style.transform = "";
      void sheetEl.offsetHeight; // force le reflow avant de réactiver la transition
      sheetEl.classList.remove("dragging");
    },
    { once: true }
  );
}

// Rend un panneau fermable en le faisant glisser vers le bas au doigt (ou à la souris,
// pour les tests). Utilisable depuis n'importe où sur le panneau : si le geste démarre
// dans le corps scrollable, on laisse le défilement natif agir tant qu'il n'est pas
// remonté en haut (scrollTop === 0) — au-delà, glisser encore vers le bas ferme le panneau.
function rendreSheetGlissable(sheetEl) {
  const bodyEl = sheetEl.querySelector(".sheet-body");
  let suivi = false;
  let glissementCommence = false;
  let pointerId = null;
  let startY = 0;
  let delta = 0;
  let hauteurSheet = 0;

  function annulerGlissementVisuel() {
    glissementCommence = false;
    delta = 0;
    sheetEl.classList.remove("dragging");
    sheetEl.style.transform = "";
  }

  sheetEl.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (!sheetEl.classList.contains("open")) return;
    suivi = true;
    glissementCommence = false;
    pointerId = e.pointerId;
    startY = e.clientY;
    delta = 0;
    hauteurSheet = sheetEl.offsetHeight;
  });

  sheetEl.addEventListener(
    "pointermove",
    (e) => {
      if (!suivi || e.pointerId !== pointerId) return;
      const deltaCourant = e.clientY - startY;

      if (deltaCourant <= 0 || (bodyEl.scrollTop > 0 && !glissementCommence)) {
        if (glissementCommence) annulerGlissementVisuel();
        return;
      }

      if (!glissementCommence) {
        if (deltaCourant < SEUIL_DEADZONE_SHEET_PX) return;
        glissementCommence = true;
        sheetEl.classList.add("dragging");
      }

      delta = deltaCourant;
      sheetEl.style.transform = `translateY(${delta}px)`;
      e.preventDefault();
    },
    { passive: false }
  );

  function onRelache(e) {
    if (!suivi || e.pointerId !== pointerId) return;
    suivi = false;
    pointerId = null;
    if (!glissementCommence) return; // simple tap/clic : on ne touche à rien

    if (delta > hauteurSheet * SEUIL_FERMETURE_SHEET_RATIO) {
      fermerSheetAvecAnimation(sheetEl);
      glissementCommence = false;
      delta = 0;
    } else {
      annulerGlissementVisuel(); // rebond doux vers la position ouverte
    }
  }

  sheetEl.addEventListener("pointerup", onRelache);
  sheetEl.addEventListener("pointercancel", onRelache);
}

for (const name of SHEETS) {
  rendreSheetGlissable(document.getElementById(`sheet-${name}`));
}

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

// ---------- Suivi GPS en direct ----------

const gpsIcon = L.divIcon({
  html: '<div class="gps-dot"></div>',
  className: "",
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

// Flèche orientée façon Google Maps/Waze, utilisée à la place du simple point pendant
// la navigation. La rotation de .gps-puck-arrow est appliquée directement en DOM
// (plutôt que de recréer l'icône à chaque position) pour rester fluide et sans flash.
const gpsArrowIcon = L.divIcon({
  html: '<div class="gps-puck"><div class="gps-puck-arrow"></div></div>',
  className: "",
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

let gpsWatchId = null;
let gpsMarker = null;
let gpsActive = false;
let gpsMarkerModeNav = false; // dernier mode (icône simple / flèche) appliqué au marqueur
let dernierCapAffiche = null; // dernier cap appliqué à la flèche (évite les à-coups au 1er fix)

function haversineMetres(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Cap initial (bearing) en degrés, 0-360° depuis le nord, entre deux points GPS.
// Utilisé comme repli quand l'API Geolocation ne fournit pas de heading fiable.
function calculerCapDegres(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const toDeg = (r) => (r * 180) / Math.PI;
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const deltaLambda = toRad(lon2 - lon1);
  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

// Trouve le point du tracé le plus proche de la position donnée (index + distance).
function pointTraceLePlusProche(userLatLng) {
  let idxProche = 0;
  let distProche = Infinity;

  for (let i = 0; i < currentTraceCoords.length; i++) {
    const [lat, lon] = currentTraceCoords[i];
    const d = haversineMetres(userLatLng.lat, userLatLng.lng, lat, lon);
    if (d < distProche) {
      distProche = d;
      idxProche = i;
    }
  }
  return { idxProche, distProche };
}

// Distance restante = distance jusqu'au point du tracé le plus proche
// + longueur du tracé restant depuis ce point jusqu'à l'arrivée.
function distanceRestanteSurTrace(idxProche, distProche) {
  let restant = distProche;
  for (let i = idxProche; i < currentTraceCoords.length - 1; i++) {
    const [lat1, lon1] = currentTraceCoords[i];
    const [lat2, lon2] = currentTraceCoords[i + 1];
    restant += haversineMetres(lat1, lon1, lat2, lon2);
  }
  return restant;
}

// Dénivelé positif restant depuis le point le plus proche jusqu'à l'arrivée.
function deniveleRestantSurTrace(idxProche) {
  let denivele = 0;
  for (let i = idxProche; i < currentTraceCoords.length - 1; i++) {
    const ele1 = currentTraceCoords[i][2] ?? 0;
    const ele2 = currentTraceCoords[i + 1][2] ?? 0;
    if (ele2 > ele1) denivele += ele2 - ele1;
  }
  return denivele;
}

// Distance et dénivelé positif entre deux points quelconques du tracé (utilisé pour
// afficher "distance/dénivelé jusqu'à ce point pratique" depuis le départ ou la
// position GPS actuelle, pas seulement jusqu'à l'arrivée).
function distanceEntreIndicesSurTrace(idxA, idxB) {
  const debut = Math.min(idxA, idxB);
  const fin = Math.max(idxA, idxB);
  let distance = 0;
  for (let i = debut; i < fin; i++) {
    const [lat1, lon1] = currentTraceCoords[i];
    const [lat2, lon2] = currentTraceCoords[i + 1];
    distance += haversineMetres(lat1, lon1, lat2, lon2);
  }
  return distance;
}

function deniveleEntreIndicesSurTrace(idxA, idxB) {
  const debut = Math.min(idxA, idxB);
  const fin = Math.max(idxA, idxB);
  let denivele = 0;
  for (let i = debut; i < fin; i++) {
    const ele1 = currentTraceCoords[i][2] ?? 0;
    const ele2 = currentTraceCoords[i + 1][2] ?? 0;
    if (ele2 > ele1) denivele += ele2 - ele1;
  }
  return denivele;
}

function showGpsError(text) {
  gpsErrorText.textContent = text;
  gpsErrorBanner.classList.remove("hidden");
}

btnGpsErrorClose.addEventListener("click", () => gpsErrorBanner.classList.add("hidden"));

// Applique/actualise l'icône flèche orientée du marqueur GPS pendant la navigation
// (icône simple sinon), et fait tourner la flèche selon le cap réel (heading natif de
// l'API Geolocation si dispo, sinon cap calculé entre les deux dernières positions).
function mettreAJourIconeEtCapGps(latlng, latlngPrecedent, position) {
  if (gpsMarkerModeNav !== navigationActive) {
    gpsMarker.setIcon(navigationActive ? gpsArrowIcon : gpsIcon);
    gpsMarkerModeNav = navigationActive;
    dernierCapAffiche = null;
  }
  if (!navigationActive) return;

  let cap = null;
  const headingNatif = position.coords.heading;
  if (typeof headingNatif === "number" && !isNaN(headingNatif)) {
    cap = headingNatif;
  } else if (latlngPrecedent && haversineMetres(latlngPrecedent.lat, latlngPrecedent.lng, latlng.lat, latlng.lng) >= 2) {
    // Sous ~2m, la position peut juste "trembler" sur place (bruit GPS) : on garde le
    // dernier cap connu plutôt que de faire tourner la flèche au hasard.
    cap = calculerCapDegres(latlngPrecedent.lat, latlngPrecedent.lng, latlng.lat, latlng.lng);
  }

  if (cap != null) {
    dernierCapAffiche = cap;
    const arrowEl = gpsMarker.getElement()?.querySelector(".gps-puck-arrow");
    if (arrowEl) arrowEl.style.transform = `rotate(${cap}deg)`;
  }
}

function onGpsPosition(position) {
  const latlng = L.latLng(position.coords.latitude, position.coords.longitude);
  const latlngPrecedent = gpsMarker ? gpsMarker.getLatLng() : null;
  const premiereFoisEnNavigation = navigationActive && gpsMarkerModeNav !== navigationActive;

  if (gpsMarker) {
    gpsMarker.setLatLng(latlng);
  } else {
    gpsMarker = L.marker(latlng, { icon: gpsIcon, zIndexOffset: 1000 }).addTo(map);
  }
  mettreAJourIconeEtCapGps(latlng, latlngPrecedent, position);

  if (navigationActive) {
    traceReellePoints.push({
      lat: latlng.lat,
      lon: latlng.lng,
      ele: position.coords.altitude,
      t: position.timestamp ?? Date.now(),
    });
  }

  if (currentTraceCoords && currentTraceCoords.length > 1) {
    const { idxProche, distProche } = pointTraceLePlusProche(latlng);
    const restantM = distanceRestanteSurTrace(idxProche, distProche);
    resDistanceRestanteEl.textContent = (restantM / 1000).toFixed(2);
    rowDistanceRestanteEl.classList.remove("hidden");

    if (navigationActive) {
      const deniveleRestantVal = deniveleRestantSurTrace(idxProche);
      resDeniveleRestantEl.textContent = Math.round(deniveleRestantVal);
      rowDeniveleRestantEl.classList.remove("hidden");

      const tempsRestantMin = estimerTempsRestantMin(restantM / 1000, deniveleRestantVal);
      resTempsRestantEl.textContent = formatDureeS(tempsRestantMin * 60);
      rowTempsRestantEl.classList.remove("hidden");

      const heureArrivee = new Date(Date.now() + tempsRestantMin * 60000);
      resHeureArriveeEl.textContent = heureArrivee.toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
      });
      rowHeureArriveeEl.classList.remove("hidden");

      if (traceParcourueLine) {
        traceParcourueLine.setLatLngs(
          currentTraceCoords.slice(0, idxProche + 1).map(([lat, lon]) => [lat, lon])
        );
      }

      const horsTrace = distProche > SEUIL_HORS_TRACE_M;
      if (horsTrace && !horsTraceActif) {
        showGpsError(`⚠️ Vous semblez vous être éloigné(e) du tracé (~${Math.round(distProche)} m).`);
      } else if (!horsTrace && horsTraceActif) {
        gpsErrorBanner.classList.add("hidden");
      }
      horsTraceActif = horsTrace;

      mettreAJourInstructionNavigation(idxProche);

      // Zoom serré façon appli de nav dès le passage en navigation, mais on respecte
      // ensuite un zoom manuel de l'utilisateur (on ne le force plus sur les ticks suivants).
      const zoomCible = premiereFoisEnNavigation ? ZOOM_NAVIGATION : map.getZoom();
      map.setView(latlng, zoomCible, { animate: premiereFoisEnNavigation });
      appliquerRotationCarte();
    }
  }
}

function onGpsError(err) {
  stopGpsTracking();
  showGpsError(
    err.code === err.PERMISSION_DENIED
      ? "Permission de localisation refusée."
      : "Impossible de suivre votre position en direct."
  );
}

function startGpsTracking() {
  if (!navigator.geolocation) {
    showGpsError("Géolocalisation non disponible sur cet appareil.");
    return;
  }
  gpsActive = true;
  btnGpsToggle.classList.add("active");
  gpsWatchId = navigator.geolocation.watchPosition(onGpsPosition, onGpsError, {
    enableHighAccuracy: true,
    maximumAge: 5000,
    timeout: 15000,
  });
}

function stopGpsTracking() {
  gpsActive = false;
  btnGpsToggle.classList.remove("active");
  if (gpsWatchId !== null) {
    navigator.geolocation.clearWatch(gpsWatchId);
    gpsWatchId = null;
  }
  if (gpsMarker) {
    gpsMarker.remove();
    gpsMarker = null;
  }
  rowDistanceRestanteEl.classList.add("hidden");
  if (navigationActive) arreterNavigation();
}

btnGpsToggle.addEventListener("click", () => {
  if (gpsActive) {
    stopGpsTracking();
  } else {
    startGpsTracking();
  }
});

// ---------- Mode navigation guidée ----------

const SEUIL_HORS_TRACE_M = 80;
const ZOOM_NAVIGATION = 17; // zoom serré "sur le sentier" appliqué au démarrage de la navigation
const SEUIL_INSTRUCTION_IMMINENTE_M = 60; // sous ce seuil, on annonce déjà la manœuvre suivante

// Type codes ORS/OSRM standard (properties.segments[].steps[].type) -> icône + libellé FR.
const TYPES_INSTRUCTION = {
  0: { icone: "⬅️", libelle: "Le sentier tourne à gauche" },
  1: { icone: "➡️", libelle: "Le sentier tourne à droite" },
  2: { icone: "↩️", libelle: "Le sentier tourne fortement à gauche" },
  3: { icone: "↪️", libelle: "Le sentier tourne fortement à droite" },
  4: { icone: "↖️", libelle: "Le sentier oblique légèrement à gauche" },
  5: { icone: "↗️", libelle: "Le sentier oblique légèrement à droite" },
  6: { icone: "⬆️", libelle: "Continuez tout droit" },
  7: { icone: "🔄", libelle: "Prenez le rond-point" },
  8: { icone: "🔄", libelle: "Sortez du rond-point" },
  9: { icone: "↩️", libelle: "Faites demi-tour" },
  10: { icone: "🏁", libelle: "Vous arrivez à destination" },
  11: { icone: "🚶", libelle: "Départ" },
  12: { icone: "⬅️", libelle: "Restez à gauche" },
  13: { icone: "➡️", libelle: "Restez à droite" },
};

function afficherInstructionNavigation(step, distanceM, imminente) {
  const meta = TYPES_INSTRUCTION[step.type] || { icone: "➜", libelle: step.instruction };
  navInstructionIconeEl.textContent = meta.icone;
  navInstructionConsigneEl.textContent = meta.libelle;
  navInstructionDistanceEl.textContent = `${imminente ? "dans" : "sur"} ${Math.round(distanceM)} m`;
  navInstructionBanner.classList.remove("hidden");
}

// Détermine l'étape ORS en cours (celle dont l'intervalle way_points contient idxProche) et
// affiche soit sa propre consigne + distance restante dans cette étape (loin de la prochaine
// manœuvre), soit la consigne de l'étape SUIVANTE quand on s'en approche (< 60m).
function mettreAJourInstructionNavigation(idxProche) {
  if (!currentSteps || currentSteps.length === 0) {
    navInstructionBanner.classList.add("hidden");
    return;
  }

  const idxEtapeActuelle = currentSteps.findIndex(
    (s) => idxProche >= s.way_points[0] && idxProche < s.way_points[1]
  );
  const etapeActuelle =
    idxEtapeActuelle >= 0 ? currentSteps[idxEtapeActuelle] : currentSteps[currentSteps.length - 1];
  const idxFinEtape = etapeActuelle.way_points[1];
  const distanceRestanteM = distanceEntreIndicesSurTrace(idxProche, idxFinEtape);

  if (distanceRestanteM <= SEUIL_INSTRUCTION_IMMINENTE_M) {
    const etapeSuivante = currentSteps[idxEtapeActuelle + 1];
    if (etapeSuivante) {
      afficherInstructionNavigation(etapeSuivante, distanceRestanteM, true);
      return;
    }
  }
  afficherInstructionNavigation(etapeActuelle, distanceRestanteM, false);
}

let navigationActive = false;
let traceParcourueLine = null;
let horsTraceActif = false;
let traceReellePoints = []; // positions GPS enregistrées pendant la navigation, pour les stats réelles

function demarrerNavigation() {
  if (!currentTraceCoords) return;
  navigationActive = true;
  horsTraceActif = false;
  traceReellePoints = [];
  btnDemarrerNav.classList.add("hidden");
  btnTerminerNav.classList.remove("hidden");
  terminerNavMsgEl.classList.add("hidden");
  btnRotationToggle.classList.remove("hidden");
  traceParcourueLine = L.polyline([], { color: "#999", weight: 5, opacity: 0.85 }).addTo(map);
  if (!gpsActive) startGpsTracking();
}

// Arrête aussi le suivi GPS : la navigation en est propriétaire tant qu'elle est active.
function arreterNavigation() {
  navigationActive = false;
  btnDemarrerNav.classList.remove("hidden");
  btnTerminerNav.classList.add("hidden");
  btnRotationToggle.classList.add("hidden");
  if (traceParcourueLine) {
    traceParcourueLine.remove();
    traceParcourueLine = null;
  }
  rowDeniveleRestantEl.classList.add("hidden");
  rowTempsRestantEl.classList.add("hidden");
  rowHeureArriveeEl.classList.add("hidden");
  gpsErrorBanner.classList.add("hidden");
  navInstructionBanner.classList.add("hidden");
  desactiverRotationCarte();
  horsTraceActif = false;
  stopGpsTracking();
}

// ---------- Rotation de la carte selon le cap (façon Waze), en option ----------

let rotationCapActive = false;

function desactiverInteractionsCarte() {
  map.dragging.disable();
  map.doubleClickZoom.disable();
  map.scrollWheelZoom.disable();
  map.touchZoom.disable();
  map.boxZoom.disable();
  map.keyboard.disable();
}

function reactiverInteractionsCarte() {
  map.dragging.enable();
  map.doubleClickZoom.enable();
  map.scrollWheelZoom.enable();
  map.touchZoom.enable();
  map.boxZoom.enable();
  map.keyboard.enable();
}

// Leaflet ne gère pas nativement la rotation (pas de plugin dédié ici) : on tourne #map
// dans son ensemble via CSS, puis on contre-tourne les contrôles (zoom, attribution) pour
// qu'ils restent lisibles et fixes à l'écran. La flèche GPS se retrouve automatiquement
// "à l'endroit" par composition des deux rotations (carte -cap + flèche +cap = 0), sans
// code supplémentaire. Comme la rotation CSS désynchronise le calcul pixel<->latlng
// interne de Leaflet (drag, clic pour choisir un point...), les interactions manuelles
// sont désactivées tant que ce mode est actif.
function appliquerRotationCarte() {
  if (!rotationCapActive || dernierCapAffiche == null) return;
  mapEl.style.transform = `rotate(${-dernierCapAffiche}deg)`;
  const controles = mapEl.querySelector(".leaflet-control-container");
  if (controles) controles.style.transform = `rotate(${dernierCapAffiche}deg)`;
}

function activerRotationCarte() {
  rotationCapActive = true;
  btnRotationToggle.classList.add("active");
  desactiverInteractionsCarte();
  appliquerRotationCarte();
}

function desactiverRotationCarte() {
  rotationCapActive = false;
  btnRotationToggle.classList.remove("active");
  mapEl.style.transform = "";
  const controles = mapEl.querySelector(".leaflet-control-container");
  if (controles) controles.style.transform = "";
  reactiverInteractionsCarte();
}

btnRotationToggle.addEventListener("click", () => {
  if (rotationCapActive) {
    desactiverRotationCarte();
  } else {
    activerRotationCarte();
  }
});

// Calcule les stats réelles (distance, dénivelé +/-, durée, vitesses) à partir
// des positions GPS enregistrées pendant la navigation. Retourne null si trop
// peu de points ont été enregistrés pour un calcul significatif.
function calculerStatsReelles(points) {
  if (points.length < 2) return null;

  let distanceM = 0;
  let denivelePositifM = 0;
  let deniveleNegatifM = 0;
  let vitesseMaxKmh = 0;

  let dernierPointAvecEle = points[0].ele != null ? points[0] : null;

  for (let i = 1; i < points.length; i++) {
    const prec = points[i - 1];
    const courant = points[i];
    const segmentM = haversineMetres(prec.lat, prec.lon, courant.lat, courant.lon);
    distanceM += segmentM;

    const dtMs = courant.t - prec.t;
    if (dtMs >= 1000) {
      const vitesseKmh = (segmentM / 1000) / (dtMs / 3600000);
      if (vitesseKmh > vitesseMaxKmh) vitesseMaxKmh = vitesseKmh;
    }

    if (courant.ele != null) {
      if (dernierPointAvecEle) {
        const deltaEle = courant.ele - dernierPointAvecEle.ele;
        if (deltaEle > 0) denivelePositifM += deltaEle;
        else deniveleNegatifM += -deltaEle;
      }
      dernierPointAvecEle = courant;
    }
  }

  const dureeS = (points[points.length - 1].t - points[0].t) / 1000;
  const distanceKm = distanceM / 1000;
  const vitesseMoyenneKmh = dureeS > 0 ? distanceKm / (dureeS / 3600) : 0;

  return {
    distanceKm,
    denivelePositifM,
    deniveleNegatifM,
    dureeS,
    vitesseMoyenneKmh,
    vitesseMaxKmh,
  };
}

// ---------- Estimation du temps restant / heure d'arrivée en navigation ----------

const VITESSE_MARCHE_DEFAUT_KMH = 4; // estimation standard tant qu'on n'a pas assez de recul GPS
const DUREE_MIN_POUR_VITESSE_REELLE_S = 120; // sous ce seuil, la vitesse mesurée est trop bruitée

// Vitesse de marche à utiliser pour l'ETA : mesurée en temps réel sur la portion déjà
// parcourue de la rando en cours dès qu'il y a assez de recul, sinon valeur par défaut.
function estimerVitesseActuelleKmh() {
  const stats = calculerStatsReelles(traceReellePoints);
  if (!stats || stats.dureeS < DUREE_MIN_POUR_VITESSE_REELLE_S) return VITESSE_MARCHE_DEFAUT_KMH;
  return stats.vitesseMoyenneKmh > 0.5 ? stats.vitesseMoyenneKmh : VITESSE_MARCHE_DEFAUT_KMH;
}

// Règle de Naismith simplifiée : temps de marche à plat + 10 min par 100 m de dénivelé
// positif restant, en plus de la vitesse mesurée/estimée.
function estimerTempsRestantMin(distanceRestanteKm, deniveleRestantM) {
  const vitesseKmh = estimerVitesseActuelleKmh();
  const tempsBaseMin = (distanceRestanteKm / vitesseKmh) * 60;
  const tempsDeniveleMin = (deniveleRestantM / 100) * 10;
  return tempsBaseMin + tempsDeniveleMin;
}

async function terminerRando() {
  const points = traceReellePoints;
  const itineraireId = currentItineraireId;

  arreterNavigation();

  const stats = calculerStatsReelles(points);
  if (!stats) {
    terminerNavMsgEl.textContent =
      "Pas assez de positions GPS enregistrées pour calculer des statistiques.";
    terminerNavMsgEl.classList.remove("hidden", "msg-success");
    terminerNavMsgEl.classList.add("msg-error");
    return;
  }

  if (!itineraireId) {
    terminerNavMsgEl.textContent =
      `Rando terminée : ${stats.distanceKm.toFixed(2)} km, ` +
      `${Math.round(stats.denivelePositifM)} m D+ (non enregistrée : itinéraire non sauvegardé).`;
    terminerNavMsgEl.classList.remove("hidden", "msg-error");
    terminerNavMsgEl.classList.add("msg-info");
    return;
  }

  try {
    const resp = await apiFetch(`/historique`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        itineraire_id: itineraireId,
        distance_reelle_km: stats.distanceKm,
        denivele_positif_reel_m: stats.denivelePositifM,
        denivele_negatif_reel_m: stats.deniveleNegatifM,
        duree_reelle_s: stats.dureeS,
        vitesse_moyenne_kmh: stats.vitesseMoyenneKmh,
        vitesse_max_kmh: stats.vitesseMaxKmh,
        trace_reelle: points.map((p) => [p.lat, p.lon, p.ele, new Date(p.t).toISOString()]),
      }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.detail || `Erreur HTTP ${resp.status}`);

    terminerNavMsgEl.textContent =
      `Rando enregistrée : ${stats.distanceKm.toFixed(2)} km, ` +
      `${Math.round(stats.denivelePositifM)} m D+.`;
    terminerNavMsgEl.classList.remove("hidden", "msg-error", "msg-info");
    terminerNavMsgEl.classList.add("msg-success");
    fetchHistorique();
  } catch (err) {
    terminerNavMsgEl.textContent = err.message;
    terminerNavMsgEl.classList.remove("hidden", "msg-success", "msg-info");
    terminerNavMsgEl.classList.add("msg-error");
  }
}

btnDemarrerNav.addEventListener("click", demarrerNavigation);
btnTerminerNav.addEventListener("click", terminerRando);

// ---------- Risque d'orage (grille de points sur la zone visible) ----------

function orageMarker(point) {
  return L.circleMarker([point.lat, point.lon], {
    radius: 14,
    color: "#c99400",
    weight: 2,
    fillColor: "#ffdd33",
    fillOpacity: 0.85,
  }).bindPopup(
    `⛈️ <strong>Risque d'orage élevé</strong><br>` +
      `Heure estimée : ${point.heure_estimee ? point.heure_estimee.slice(11, 16) : "?"}<br>` +
      `Probabilité de précipitation : ${point.probabilite_precip}%<br>` +
      `CAPE : ${Math.round(point.cape)} J/kg`,
    { autoPan: false }
  );
}

async function fetchOrageGrille() {
  const bounds = map.getBounds();
  const params = new URLSearchParams({
    lat_min: bounds.getSouth(),
    lat_max: bounds.getNorth(),
    lon_min: bounds.getWest(),
    lon_max: bounds.getEast(),
  });
  try {
    const resp = await apiFetch(`/meteo/orage-grille?${params}`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const points = await resp.json();
    orageLayer.clearLayers();
    for (const point of points) {
      orageMarker(point).addTo(orageLayer);
    }
  } catch (err) {
    console.error("Erreur chargement risque orage :", err);
  }
}

chkOrage.addEventListener("change", () => {
  if (chkOrage.checked) {
    orageLayer.addTo(map);
    fetchOrageGrille();
  } else {
    map.removeLayer(orageLayer);
    orageLayer.clearLayers();
  }
});

map.on("moveend", () => {
  if (chkOrage.checked) fetchOrageGrille();
});

// ---------- Points pratiques le long du tracé (refuges, points d'eau, abris) ----------

const POINTS_PRATIQUES_META = {
  refuge: { emoji: "🏠", label: "Refuge" },
  eau: { emoji: "💧", label: "Point d'eau" },
  abri: { emoji: "⛺", label: "Abri" },
};

function pointPratiqueIcon(type) {
  const meta = POINTS_PRATIQUES_META[type] || { emoji: "❓", label: "Point pratique" };
  return L.divIcon({
    html: `<div class="map-badge map-badge-anim"><span>${meta.emoji}</span></div>`,
    className: "",
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

// Fait disparaître en fondu les marqueurs d'un layerGroup avant de le retirer de la carte.
function fadeOutMarkerLayer(layerGroup, delay = 220) {
  layerGroup.eachLayer((l) => {
    const el = l.getElement ? l.getElement() : null;
    if (el) {
      el.style.transition = `opacity ${delay}ms ease`;
      el.style.opacity = "0";
    }
  });
  setTimeout(() => map.removeLayer(layerGroup), delay);
}

// Construit le contenu du popup d'un point pratique au moment de l'ouverture (pas à la
// création du marqueur) afin que la distance/le dénivelé reflètent la position GPS
// actuelle en navigation, plutôt qu'une valeur figée calculée au chargement.
function pointPratiquePopupHtml(p) {
  const meta = POINTS_PRATIQUES_META[p.type] || { emoji: "❓", label: "Point pratique" };
  let infoParcours = "";

  if (currentTraceCoords && currentTraceCoords.length > 1) {
    const origineLatLng = navigationActive && gpsMarker ? gpsMarker.getLatLng() : departLatLng;
    if (origineLatLng) {
      const { idxProche: idxOrigine } = pointTraceLePlusProche(origineLatLng);
      const { idxProche: idxPoint } = pointTraceLePlusProche(L.latLng(p.lat, p.lon));
      const distanceKm = distanceEntreIndicesSurTrace(idxOrigine, idxPoint) / 1000;
      const deniveleM = deniveleEntreIndicesSurTrace(idxOrigine, idxPoint);
      const depuis = navigationActive ? "votre position" : "le départ";
      infoParcours = `<br>📏 ${distanceKm.toFixed(2)} km — ⬆️ ${Math.round(deniveleM)} m depuis ${depuis}`;
    }
  }

  return `<strong>${meta.emoji} ${meta.label}</strong>${p.nom ? `<br>${p.nom}` : ""}${infoParcours}`;
}

async function fetchPointsPratiques(traceCoords) {
  pointsPratiquesLayer.clearLayers();
  if (!traceCoords || traceCoords.length === 0) return;

  try {
    const resp = await apiFetch(`/sentiers/points-pratiques`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        trace: traceCoords.map(([lat, lon]) => [lat, lon]),
        rayon_m: 300,
      }),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const points = await resp.json();

    for (const p of points) {
      L.marker([p.lat, p.lon], { icon: pointPratiqueIcon(p.type) })
        .bindPopup(() => pointPratiquePopupHtml(p))
        .addTo(pointsPratiquesLayer);
    }
  } catch (err) {
    console.error("Erreur chargement points pratiques :", err);
  }
}

btnPointsPratiquesToggle.addEventListener("click", () => {
  const actif = btnPointsPratiquesToggle.classList.toggle("active");
  if (actif) {
    pointsPratiquesLayer.addTo(map);
    fetchPointsPratiques(currentTraceCoords);
  } else {
    fadeOutMarkerLayer(pointsPratiquesLayer);
  }
});

// ---------- Recherche de lieu (géocodage OpenRouteService) ----------

const searchInput = document.getElementById("search-input");
const searchResultsEl = document.getElementById("search-results");
let searchDebounceTimer = null;
let searchResultMarker = null;

function renderSearchResults(features) {
  searchResultsEl.innerHTML = "";

  if (features.length === 0) {
    const div = document.createElement("div");
    div.className = "search-result-item";
    div.textContent = "Aucun résultat";
    searchResultsEl.appendChild(div);
    searchResultsEl.classList.remove("hidden");
    return;
  }

  for (const feature of features) {
    const div = document.createElement("div");
    div.className = "search-result-item";
    div.textContent = feature.properties.label;
    div.addEventListener("click", () => selectionnerLieu(feature));
    searchResultsEl.appendChild(div);
  }
  searchResultsEl.classList.remove("hidden");
}

function selectionnerLieu(feature) {
  const [lon, lat] = feature.geometry.coordinates;
  map.setView([lat, lon], 14);

  if (searchResultMarker) searchResultMarker.remove();
  searchResultMarker = L.marker([lat, lon]).addTo(map).bindPopup(feature.properties.label).openPopup();

  searchInput.value = feature.properties.label;
  searchResultsEl.classList.add("hidden");
  searchResultsEl.innerHTML = "";
}

async function rechercherLieu(query) {
  const centre = map.getCenter();
  const params = new URLSearchParams({ q: query, lat: centre.lat, lon: centre.lng });
  try {
    const resp = await apiFetch(`/geocode/search?${params}`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    renderSearchResults(data.features || []);
  } catch (err) {
    console.error("Erreur recherche de lieu :", err);
    searchResultsEl.innerHTML = '<div class="search-result-item">Erreur de recherche</div>';
    searchResultsEl.classList.remove("hidden");
  }
}

searchInput.addEventListener("input", () => {
  clearTimeout(searchDebounceTimer);
  const query = searchInput.value.trim();
  if (query.length < 3) {
    searchResultsEl.classList.add("hidden");
    return;
  }
  searchDebounceTimer = setTimeout(() => rechercherLieu(query), 400);
});

searchInput.addEventListener("focus", () => {
  if (searchResultsEl.innerHTML.trim() !== "") searchResultsEl.classList.remove("hidden");
});

document.addEventListener("click", (e) => {
  if (!e.target.closest("#search-bar-container")) {
    searchResultsEl.classList.add("hidden");
  }
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
    html: `<div class="map-badge${pending ? " pending" : ""}"><span>${meta.emoji}${pending ? "⏳" : ""}</span></div>`,
    className: "",
    iconSize: [32, 32],
    iconAnchor: [16, 16],
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
    const estProprietaire = currentUser && s.user_id === currentUser.id;
    const popup = `
      <strong>${meta.emoji} ${meta.label}</strong><br>
      ${s.description ? `${s.description}<br>` : ""}
      👍 ${s.upvotes} confirmation(s)<br>
      Expire le ${expireDate}
      ${estProprietaire ? `<br><button type="button" class="btn-supprimer-signalement" data-id="${s.id}">🗑️ Supprimer</button>` : ""}
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
      <br><button type="button" class="btn-supprimer-signalement" data-temp-id="${p.tempId}">🗑️ Supprimer</button>
    `;
    L.marker([p.lat, p.lon], { icon: signalementIcon(p.type, true) })
      .bindPopup(popup)
      .addTo(signalementsLayer);
  }

  updatePendingUI();
}

async function supprimerSignalement(id) {
  const resp = await apiFetch(`/signalements/${id}`, { method: "DELETE" });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  lastKnownSignalements = lastKnownSignalements.filter((s) => s.id !== Number(id));
  saveSignalementsCache(lastCenter.lat, lastCenter.lon, lastKnownSignalements);
}

document.addEventListener("click", async (e) => {
  const btn = e.target.closest(".btn-supprimer-signalement");
  if (!btn) return;

  if (btn.dataset.tempId) {
    removePendingSignalement(btn.dataset.tempId);
    map.closePopup();
    renderAllSignalements();
    return;
  }

  btn.disabled = true;
  btn.textContent = "Suppression...";
  try {
    await supprimerSignalement(btn.dataset.id);
    map.closePopup();
    renderAllSignalements();
  } catch (err) {
    console.error("Erreur suppression signalement :", err);
    btn.disabled = false;
    btn.textContent = "🗑️ Supprimer";
  }
});

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

// Formate une durée en secondes en "Xh YYmin" (ou juste "YYmin" si < 1h).
function formatDureeS(s) {
  const totalMin = Math.round(s / 60);
  const h = Math.floor(totalMin / 60);
  const min = totalMin % 60;
  return h > 0 ? `${h}h ${String(min).padStart(2, "0")}min` : `${min}min`;
}

// Construit le contenu HTML (en-tête + comparaison prévu/réalisé) d'une entrée
// d'historique, partagé entre "mon historique" et l'historique consulté d'un ami.
function historiqueEntryHtml(entry) {
  const date = new Date(entry.date_realisation).toLocaleDateString("fr-FR");
  const itin = entry.itineraire;
  const enTete = itin
    ? `
      <strong>${date}</strong><br>
      Départ : ${itin.point_depart_lat.toFixed(4)}, ${itin.point_depart_lon.toFixed(4)}
    `
    : `<strong>${date}</strong><br>Itinéraire supprimé`;

  const aDesStatsReelles = entry.distance_reelle_km != null;
  const comparaison = !itin
    ? ""
    : aDesStatsReelles
    ? `
      <div class="prevu-realise">
        <div class="prevu-realise-col">
          <span class="prevu-realise-label">Prévu</span>
          <span>${itin.distance_km?.toFixed(2) ?? "?"} km</span>
          <span>${Math.round(itin.denivele_m ?? 0)} m D+</span>
        </div>
        <div class="prevu-realise-col prevu-realise-reel">
          <span class="prevu-realise-label">Réalisé</span>
          <span>${entry.distance_reelle_km.toFixed(2)} km</span>
          <span>${Math.round(entry.denivele_positif_reel_m ?? 0)} m D+ / ${Math.round(entry.denivele_negatif_reel_m ?? 0)} m D-</span>
          <span>${formatDureeS(entry.duree_reelle_s)} — ${entry.vitesse_moyenne_kmh.toFixed(1)} km/h moy. (max ${entry.vitesse_max_kmh.toFixed(1)})</span>
        </div>
      </div>
    `
    : `
      Distance prévue : ${itin.distance_km?.toFixed(2) ?? "?"} km —
      Dénivelé prévu : ${Math.round(itin.denivele_m ?? 0)} m<br>
    `;

  return enTete + comparaison;
}

async function fetchHistorique() {
  try {
    const resp = await apiFetch(`/historique`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const entries = await resp.json();

    historiqueListeEl.innerHTML = "";
    historiqueVideEl.classList.toggle("hidden", entries.length > 0);

    for (const entry of entries) {
      const li = document.createElement("li");
      li.innerHTML = historiqueEntryHtml(entry);
      historiqueListeEl.appendChild(li);
    }
  } catch (err) {
    console.error("Erreur chargement historique :", err);
  }
}

btnRefreshHistorique.addEventListener("click", fetchHistorique);

// ---------- Système d'amis ----------

btnVoirAmis.addEventListener("click", () => {
  openSheet("amis");
  document.querySelector('.tab-btn[data-sheet="profil"]')?.classList.add("active");
  amisRechercheInput.value = "";
  amisRechercheResultatsEl.innerHTML = "";
  amisRechercheResultatsEl.classList.add("hidden");
  chargerDemandesRecues();
  chargerListeAmis();
});

btnAmisRetour.addEventListener("click", () => openSheet("profil"));
btnAmiProfilRetour.addEventListener("click", () => openSheet("amis"));

// Construit l'élément <li> commun (avatar + nom [+ email]) utilisé dans les 3 listes
// d'amis (recherche, demandes reçues, amis). Le conteneur ".ami-actions", vide, est
// laissé à charge de l'appelant pour y placer les boutons pertinents (ou le retirer).
function creerAmiLi({ id, nom, email, photo_base64 }, cliquable) {
  const li = document.createElement("li");
  li.className = "amis-liste-item" + (cliquable ? " cliquable" : "");
  li.dataset.userId = id;

  const avatarHtml = photo_base64
    ? `<img class="ami-avatar" src="${photo_base64}" alt="">`
    : `<span class="ami-avatar-placeholder">🧑</span>`;

  li.innerHTML = `
    ${avatarHtml}
    <div class="ami-info">
      <div class="ami-nom">${escapeHtml(nom)}</div>
      ${email ? `<div class="ami-email">${escapeHtml(email)}</div>` : ""}
    </div>
    <div class="ami-actions"></div>
  `;
  return li;
}

// Boutons d'action adaptés au statut de la relation avec cet utilisateur.
function actionsPourStatut(statut, friendshipId, userId) {
  const div = document.createElement("div");
  div.className = "ami-actions";

  function bouton(texte, classe, onClick, disabled) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = classe;
    btn.textContent = texte;
    btn.disabled = !!disabled;
    if (onClick) btn.addEventListener("click", onClick);
    div.appendChild(btn);
    return btn;
  }

  if (statut === "aucune") {
    bouton("➕ Ajouter", "btn-mini btn-mini-accent", (e) => envoyerDemandeAmi(userId, e.target));
  } else if (statut === "demande_envoyee") {
    bouton("⏳ Envoyée", "btn-mini", null, true);
    bouton("Annuler", "btn-mini", (e) => supprimerRelation(friendshipId, e.target));
  } else if (statut === "demande_recue") {
    bouton("✔️ Accepter", "btn-mini btn-mini-accent", (e) => accepterDemande(friendshipId, e.target));
    bouton("✕ Refuser", "btn-mini", (e) => supprimerRelation(friendshipId, e.target));
  } else if (statut === "ami") {
    bouton("✓ Ami", "btn-mini", null, true);
  }

  return div;
}

function rafraichirRechercheAmisSiActive() {
  const q = amisRechercheInput.value.trim();
  if (q.length >= 2) rechercherAmis(q);
}

async function envoyerDemandeAmi(friendId, btn) {
  btn.disabled = true;
  try {
    const resp = await apiFetch("/amis/demandes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ friend_id: friendId }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.detail || `Erreur HTTP ${resp.status}`);
    rafraichirRechercheAmisSiActive();
  } catch (err) {
    console.error("Erreur envoi demande d'ami :", err);
    btn.disabled = false;
  }
}

async function accepterDemande(friendshipId, btn) {
  btn.disabled = true;
  try {
    const resp = await apiFetch(`/amis/demandes/${friendshipId}/accepter`, { method: "POST" });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    chargerDemandesRecues();
    chargerListeAmis();
    rafraichirRechercheAmisSiActive();
  } catch (err) {
    console.error("Erreur acceptation demande d'ami :", err);
    btn.disabled = false;
  }
}

// Sert à la fois à refuser une demande reçue, annuler une demande envoyée, ou retirer
// un ami déjà accepté (le backend distingue le cas via le statut de la relation).
async function supprimerRelation(friendshipId, btn) {
  btn.disabled = true;
  try {
    const resp = await apiFetch(`/amis/demandes/${friendshipId}`, { method: "DELETE" });
    if (!resp.ok && resp.status !== 204) throw new Error(`HTTP ${resp.status}`);
    chargerDemandesRecues();
    chargerListeAmis();
    rafraichirRechercheAmisSiActive();
  } catch (err) {
    console.error("Erreur suppression de la relation d'amitié :", err);
    btn.disabled = false;
  }
}

function renderRechercheAmis(resultats) {
  amisRechercheResultatsEl.innerHTML = "";
  if (resultats.length === 0) {
    amisRechercheResultatsEl.classList.add("hidden");
    return;
  }
  for (const u of resultats) {
    const li = creerAmiLi(u, false);
    li.querySelector(".ami-actions").replaceWith(actionsPourStatut(u.statut_amitie, u.friendship_id, u.id));
    amisRechercheResultatsEl.appendChild(li);
  }
  amisRechercheResultatsEl.classList.remove("hidden");
}

async function rechercherAmis(q) {
  try {
    const resp = await apiFetch(`/amis/recherche?q=${encodeURIComponent(q)}`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    renderRechercheAmis(await resp.json());
  } catch (err) {
    console.error("Erreur recherche d'amis :", err);
  }
}

let amisRechercheDebounceTimer = null;

amisRechercheInput.addEventListener("input", () => {
  clearTimeout(amisRechercheDebounceTimer);
  const q = amisRechercheInput.value.trim();
  if (q.length < 2) {
    amisRechercheResultatsEl.innerHTML = "";
    amisRechercheResultatsEl.classList.add("hidden");
    return;
  }
  amisRechercheDebounceTimer = setTimeout(() => rechercherAmis(q), 400);
});

async function chargerDemandesRecues() {
  try {
    const resp = await apiFetch("/amis/demandes");
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const demandes = await resp.json();

    amisDemandesListeEl.innerHTML = "";
    amisDemandesTitreEl.classList.toggle("hidden", demandes.length === 0);
    for (const d of demandes) {
      const li = creerAmiLi(d.utilisateur, false);
      li.querySelector(".ami-actions").replaceWith(actionsPourStatut("demande_recue", d.id, d.utilisateur.id));
      amisDemandesListeEl.appendChild(li);
    }
  } catch (err) {
    console.error("Erreur chargement des demandes d'amis :", err);
  }
}

async function chargerListeAmis() {
  try {
    const resp = await apiFetch("/amis");
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const amis = await resp.json();

    amisListeEl.innerHTML = "";
    amisVideEl.classList.toggle("hidden", amis.length > 0);
    for (const a of amis) {
      const li = creerAmiLi(a.utilisateur, true);
      li.querySelector(".ami-actions").remove();
      li.addEventListener("click", () => ouvrirProfilAmi(a.utilisateur.id, a.utilisateur.nom));
      amisListeEl.appendChild(li);
    }
  } catch (err) {
    console.error("Erreur chargement de la liste d'amis :", err);
  }
}

function renderHistoriqueAmi(entries) {
  amiHistoriqueListeEl.innerHTML = "";
  amiHistoriqueVideEl.classList.toggle("hidden", entries.length > 0);

  for (const entry of entries) {
    const li = document.createElement("li");
    li.innerHTML = historiqueEntryHtml(entry);

    if (entry.itineraire) {
      const btnRefaire = document.createElement("button");
      btnRefaire.type = "button";
      btnRefaire.className = "btn-secondary btn-refaire";
      btnRefaire.textContent = "🔁 Refaire cette rando";
      btnRefaire.addEventListener("click", () => refaireRandoAmi(entry.itineraire.id, btnRefaire));
      li.appendChild(btnRefaire);
    }

    amiHistoriqueListeEl.appendChild(li);
  }
}

async function ouvrirProfilAmi(friendId, nomAffiche) {
  amiProfilTitreEl.textContent = nomAffiche;
  amiRefaireMsgEl.classList.add("hidden");
  amiHistoriqueListeEl.innerHTML = "";
  amiHistoriqueVideEl.classList.add("hidden");
  openSheet("ami-profil");
  document.querySelector('.tab-btn[data-sheet="profil"]')?.classList.add("active");

  try {
    const resp = await apiFetch(`/amis/${friendId}/profil`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();

    afficherPhoto(data.utilisateur.photo_base64, amiProfilPhotoEl, amiProfilPhotoPlaceholderEl);
    amiProfilNomEl.textContent = data.utilisateur.nom;

    const stats = data.stats;
    animateCountUp(amiStatsDistanceTotaleEl, stats.distance_totale_km, { decimals: 2 });
    animateCountUp(amiStatsDeniveleCumuleEl, stats.denivele_positif_cumule_m);
    amiStatsNbSortiesEl.textContent = stats.nb_sorties;
    amiStatsDureeTotaleEl.textContent = formatDureeS(stats.duree_totale_s);
  } catch (err) {
    console.error("Erreur chargement du profil ami :", err);
  }

  try {
    const resp = await apiFetch(`/amis/${friendId}/historique`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    renderHistoriqueAmi(await resp.json());
  } catch (err) {
    console.error("Erreur chargement de l'historique de l'ami :", err);
  }
}

async function refaireRandoAmi(itineraireId, btn) {
  btn.disabled = true;
  btn.textContent = "Chargement...";
  amiRefaireMsgEl.classList.add("hidden");
  try {
    const resp = await apiFetch(`/itineraires/${itineraireId}`);
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.detail || `Erreur HTTP ${resp.status}`);

    chargerItineraireDansLaCarte(data);
    openSheet("itineraire");
  } catch (err) {
    amiRefaireMsgEl.textContent = err.message;
    amiRefaireMsgEl.classList.remove("hidden", "msg-success", "msg-info");
    amiRefaireMsgEl.classList.add("msg-error");
  } finally {
    btn.disabled = false;
    btn.textContent = "🔁 Refaire cette rando";
  }
}

// ---------- Aperçu photo du parcours (Wikimedia Commons) ----------

async function fetchApercuPhotos(traceCoords) {
  photosGalerieEl.innerHTML = "";
  photosGalerieEl.classList.add("hidden");
  if (!traceCoords || traceCoords.length === 0) return;

  const nbPoints = Math.min(4, traceCoords.length);
  const indices = [];
  for (let i = 0; i < nbPoints; i++) {
    const idx =
      nbPoints === 1 ? 0 : Math.round((i * (traceCoords.length - 1)) / (nbPoints - 1));
    indices.push(idx);
  }

  try {
    const resultats = await Promise.all(
      indices.map(async (idx) => {
        const [lat, lon] = traceCoords[idx];
        const resp = await apiFetch(`/photos/proches?lat=${lat}&lon=${lon}&rayon_m=1200&limite=2`);
        if (!resp.ok) return [];
        return resp.json();
      })
    );

    const titresVus = new Set();
    const photos = [];
    for (const liste of resultats) {
      for (const photo of liste) {
        if (titresVus.has(photo.titre)) continue;
        titresVus.add(photo.titre);
        photos.push(photo);
        if (photos.length >= 4) break;
      }
      if (photos.length >= 4) break;
    }

    if (photos.length === 0) return; // pas de photo trouvée à proximité : on n'affiche rien, pas de fallback

    for (const photo of photos) {
      const a = document.createElement("a");
      a.href = photo.url_page;
      a.target = "_blank";
      a.rel = "noopener";
      const img = document.createElement("img");
      img.src = photo.url_miniature;
      img.alt = photo.titre;
      img.loading = "lazy";
      a.appendChild(img);
      photosGalerieEl.appendChild(a);
    }
    photosGalerieEl.classList.remove("hidden");
  } catch (err) {
    console.error("Erreur chargement photos :", err);
  }
}

// ---------- Sentiers à proximité (Overpass) ----------

function renderSuggestions(suggestions) {
  suggestionsListeEl.innerHTML = "";

  if (suggestions.length === 0) {
    suggestionsMsgEl.textContent = "Aucun sentier trouvé à proximité.";
    suggestionsMsgEl.classList.remove("hidden", "msg-error");
    suggestionsMsgEl.classList.add("msg-info");
    return;
  }

  suggestionsMsgEl.classList.add("hidden");

  for (const s of suggestions) {
    const li = document.createElement("li");
    const denivele = s.denivele_m != null ? `${Math.round(s.denivele_m)} m` : "inconnu";
    li.innerHTML = `
      <strong>🥾 ${s.nom}</strong><br>
      Distance : ${s.distance_km.toFixed(2)} km — Dénivelé : ${denivele}<br>
      📍 ${s.nb_pois} point(s) d'intérêt sur le trajet
    `;
    li.addEventListener("click", () => chargerSuggestion(s));
    suggestionsListeEl.appendChild(li);
  }
}

function chargerSuggestion(suggestion) {
  itineraireErrorEl.classList.add("hidden");
  resultatEl.classList.add("hidden");
  rowDistanceRestanteEl.classList.add("hidden");
  rowDeniveleRestantEl.classList.add("hidden");
  rowTempsRestantEl.classList.add("hidden");
  rowHeureArriveeEl.classList.add("hidden");
  meteoPanelEl.classList.add("hidden");
  photosGalerieEl.classList.add("hidden");
  photosGalerieEl.innerHTML = "";
  if (navigationActive) arreterNavigation();
  btnDemarrerNav.classList.add("hidden");
  btnTerminerNav.classList.add("hidden");

  traceLayer.clearLayers();
  L.geoJSON(suggestion.trace_geojson, {
    style: { color: "#fc4c02", weight: 4 },
  }).addTo(traceLayer);
  map.fitBounds(traceLayer.getBounds(), { padding: [30, 30] });

  const traceCoords = suggestion.trace_geojson.features?.[0]?.geometry?.coordinates;
  currentTraceCoords = traceCoords ? traceCoords.map(([lon, lat]) => [lat, lon]) : null;
  currentSteps = null; // pas d'instructions turn-by-turn pour un sentier Overpass

  animateCountUp(resDistanceEl, suggestion.distance_km, { decimals: 2 });
  if (suggestion.denivele_m != null) {
    animateCountUp(resDeniveleEl, suggestion.denivele_m);
  } else {
    resDeniveleEl.textContent = "?";
  }
  resultatEl.classList.remove("hidden");

  // Pas d'itinéraire persisté en base pour une suggestion Overpass : "Marquer comme fait" n'a pas de sens ici.
  currentItineraireId = null;
  btnMarquerFait.classList.add("hidden");

  if (currentTraceCoords && currentTraceCoords.length > 0) {
    btnDemarrerNav.classList.remove("hidden");
    const [lat, lon] = currentTraceCoords[0];
    fetchMeteo(lat, lon);
    fetchSignalementsProches(lat, lon);
    fetchApercuPhotos(currentTraceCoords);
    if (btnPointsPratiquesToggle.classList.contains("active")) {
      fetchPointsPratiques(currentTraceCoords);
    }
  }

  openSheet("itineraire");
}

btnChercherSuggestions.addEventListener("click", async () => {
  suggestionsListeEl.innerHTML = "";
  suggestionsMsgEl.textContent = "Recherche en cours...";
  suggestionsMsgEl.classList.remove("hidden", "msg-error", "msg-success");
  suggestionsMsgEl.classList.add("msg-info");
  btnChercherSuggestions.disabled = true;

  const centre = map.getCenter();
  try {
    const resp = await apiFetch(
      `/sentiers/suggestions?lat=${centre.lat}&lon=${centre.lng}&rayon_km=10`
    );
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.detail || `Erreur HTTP ${resp.status}`);
    renderSuggestions(data);
  } catch (err) {
    console.error("Erreur recherche de sentiers :", err);
    suggestionsMsgEl.textContent = "Erreur lors de la recherche de sentiers. Réessayez plus tard.";
    suggestionsMsgEl.classList.remove("hidden", "msg-success", "msg-info");
    suggestionsMsgEl.classList.add("msg-error");
  } finally {
    btnChercherSuggestions.disabled = false;
  }
});

// Affiche un itinéraire déjà généré (ItineraireOut complet, avec trace_geojson) sur la
// carte et réinitialise l'état associé. Partagé entre la génération d'un nouvel
// itinéraire et le chargement de l'itinéraire d'un ami via "Refaire cette rando".
function chargerItineraireDansLaCarte(data) {
  itineraireErrorEl.classList.add("hidden");
  resultatEl.classList.add("hidden");
  rowDistanceRestanteEl.classList.add("hidden");
  rowDeniveleRestantEl.classList.add("hidden");
  rowTempsRestantEl.classList.add("hidden");
  rowHeureArriveeEl.classList.add("hidden");
  meteoPanelEl.classList.add("hidden");
  photosGalerieEl.classList.add("hidden");
  photosGalerieEl.innerHTML = "";
  btnMarquerFait.classList.add("hidden");
  if (navigationActive) arreterNavigation();
  btnDemarrerNav.classList.add("hidden");
  btnTerminerNav.classList.add("hidden");

  modeSelect.value = data.mode;
  arriveeSectionEl.classList.toggle("hidden", data.mode !== "point_a_point");
  placerDepart(data.point_depart_lat, data.point_depart_lon, false);
  if (data.mode === "point_a_point" && data.point_arrivee_lat != null) {
    placerArrivee(data.point_arrivee_lat, data.point_arrivee_lon);
  }

  traceLayer.clearLayers();
  L.geoJSON(data.trace_geojson, {
    style: { color: "#fc4c02", weight: 4 },
  }).addTo(traceLayer);
  map.fitBounds(traceLayer.getBounds(), { padding: [30, 30] });

  const traceCoords = data.trace_geojson.features?.[0]?.geometry?.coordinates;
  currentTraceCoords = traceCoords ? traceCoords.map(([lon, lat, ele]) => [lat, lon, ele]) : null;
  currentSteps = data.trace_geojson.features?.[0]?.properties?.segments?.[0]?.steps || null;

  animateCountUp(resDistanceEl, data.distance_km, { decimals: 2 });
  animateCountUp(resDeniveleEl, data.denivele_m);
  resultatEl.classList.remove("hidden");

  fetchSignalementsProches(data.point_depart_lat, data.point_depart_lon);
  fetchMeteo(data.point_depart_lat, data.point_depart_lon);
  if (currentTraceCoords) fetchApercuPhotos(currentTraceCoords);
  if (currentTraceCoords && btnPointsPratiquesToggle.classList.contains("active")) {
    fetchPointsPratiques(currentTraceCoords);
  }
  resetMarquerFait(data.id);
  btnDemarrerNav.classList.remove("hidden");
}

formItineraire.addEventListener("submit", async (e) => {
  e.preventDefault();
  const mode = modeSelect.value;
  if (!departLatLng || (mode === "point_a_point" && !arriveeLatLng)) return;

  itineraireErrorEl.classList.add("hidden");
  resultatEl.classList.add("hidden");
  rowDistanceRestanteEl.classList.add("hidden");
  rowDeniveleRestantEl.classList.add("hidden");
  rowTempsRestantEl.classList.add("hidden");
  rowHeureArriveeEl.classList.add("hidden");
  meteoPanelEl.classList.add("hidden");
  photosGalerieEl.classList.add("hidden");
  photosGalerieEl.innerHTML = "";
  btnMarquerFait.classList.add("hidden");
  if (navigationActive) arreterNavigation();
  btnDemarrerNav.classList.add("hidden");
  btnTerminerNav.classList.add("hidden");
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

    chargerItineraireDansLaCarte(data);
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
if (getToken()) fetchHistorique();
