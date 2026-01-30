/**
 * MDI TUG OF WAR - V5.5 SaaS (ÉDITION SÉCURISÉE)
 * - Correction de la détection des variables OBS
 * - Authentification stricte via socket.emit("overlay:join")
 */

const SERVER_URL = "https://magic-digital-impact-live.onrender.com";
const OVERLAY_TYPE = "tug_of_war";

/* --- 1. RÉCUPÉRATION RIGOUREUSE DU CSS OBS --- */
function cssVar(name, fallback = "") {
  // getComputedStyle est la seule méthode fiable pour lire le champ CSS d'OBS
  const v = getComputedStyle(document.documentElement).getPropertyValue(name);
  if (!v) return fallback;
  return v.trim().replace(/^['"]+|['"]+$/g, ""); // Nettoyage des guillemets
}

/* --- 2. GESTION DE L'INTERFACE --- */
function showSecurityDenied() {
  document.getElementById("container").classList.add("hidden");
  document.getElementById("security-screen").classList.remove("hidden");
  document.body.style.backgroundColor = "rgba(0,0,0,1)"; // Fond noir en cas d'erreur
}

function showGame() {
  document.getElementById("security-screen").classList.add("hidden");
  document.getElementById("container").classList.remove("hidden");
  document.body.style.backgroundColor = "transparent"; 
}

/* --- 3. LOGIQUE DE JEU --- */
let scoreLeft = 0;
let scoreRight = 0;
const votersSeen = new Set();
let CONFIG = { nameL: "OUI", nameR: "NON", trigL: "O", trigR: "N" };

function updateDisplay() {
  const total = scoreLeft + scoreRight;
  const percentLeft = total > 0 ? (scoreLeft / total) * 100 : 50;
  document.getElementById("bar-fill").style.width = percentLeft + "%";
  document.getElementById("cursor").style.left = percentLeft + "%";
}

function applyVisualConfig() {
  CONFIG.nameL = cssVar("--name-left", "OUI");
  CONFIG.nameR = cssVar("--name-right", "NON");
  CONFIG.trigL = cssVar("--trigger-left", "O").toUpperCase();
  CONFIG.trigR = cssVar("--trigger-right", "N").toUpperCase();

  document.getElementById("name-left").innerText = CONFIG.nameL;
  document.getElementById("name-right").innerText = CONFIG.nameR;
  document.getElementById("trig-left").innerText = CONFIG.trigL;
  document.getElementById("trig-right").innerText = CONFIG.trigR;
}

/* --- 4. CONNEXION ET AUTHENTIFICATION --- */
const socket = io(SERVER_URL, { transports: ["websocket", "polling"] });

async function init() {
  console.log("[MDI] Initialisation de l'authentification...");

  // On attend un court instant que OBS injecte le CSS personnalisé
  await new Promise(r => setTimeout(r, 800));

  const room = cssVar("--room-id");
  const key = cssVar("--room-key");

  // Rigueur : Si les identifiants manquent, on bloque tout de suite
  if (!room || !key) {
    console.error("[MDI] Erreur : --room-id ou --room-key manquant dans le CSS OBS.");
    showSecurityDenied();
    return;
  }

  // Envoi de la demande de connexion sécurisée au serveur
  socket.emit("overlay:join", { 
    room: room, 
    key: key, 
    overlay: OVERLAY_TYPE 
  });

  // Réponse du serveur si la clé est mauvaise
  socket.on("overlay:forbidden", () => {
    console.error("[MDI] Accès refusé par le serveur.");
    showSecurityDenied();
  });

  // Réponse du serveur si tout est OK
  socket.on("overlay:state", (payload) => {
    if (payload?.overlay === OVERLAY_TYPE) {
      applyVisualConfig();
      showGame(); 
      if (cssVar("--auto-reset") === "true") {
        scoreLeft = 0; scoreRight = 0; votersSeen.clear();
      }
      updateDisplay();
    }
  });

  // Écoute des votes en temps réel
  socket.on("raw_vote", (data) => {
    const vote = (data.vote || "").trim().toUpperCase();
    const user = data.user || "Anonyme";
    const uniqueVote = cssVar("--tug-one-vote-per-person") === "on";

    if (uniqueVote && votersSeen.has(user) && user !== "Anonyme") return;

    if (vote === CONFIG.trigL) {
      scoreLeft++;
      if (uniqueVote) votersSeen.add(user);
      updateDisplay();
    } else if (vote === CONFIG.trigR) {
      scoreRight++;
      if (uniqueVote) votersSeen.add(user);
      updateDisplay();
    }
  });
}

init();
