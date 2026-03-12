/**
 * MDI TUG OF WAR - V5.7 SaaS (CONFIG TÉLÉCOMMANDE)
 * - Gestion du canal universel 'raw_vote'
 * - Authentification stricte
 * - Configuration (noms, couleurs, triggers) pilotable depuis la télécommande
 */

const SERVER_URL = "https://magic-digital-impact-live.onrender.com";
const OVERLAY_TYPE = "tug_of_war";

/* --- UTILITAIRES --- */
function cssVar(name, fallback = "") {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name);
  if (!v) return fallback;
  return v.trim().replace(/^['"]+|['"]+$/g, "");
}

/* --- INTERFACE --- */
function showSecurityDenied() {
  document.getElementById("container").classList.add("hidden");
  document.getElementById("security-screen").classList.remove("hidden");
  document.body.style.backgroundColor = "rgba(0,0,0,1)";
}

function showGame() {
  document.getElementById("security-screen").classList.add("hidden");
  document.getElementById("container").classList.remove("hidden");
  document.body.style.backgroundColor = "transparent";
}

function hideGame() {
  document.getElementById("container").classList.add("hidden");
  document.getElementById("security-screen").classList.add("hidden");
  document.body.style.backgroundColor = "transparent";
}

/* --- LOGIQUE DE JEU --- */
let scoreLeft = 0;
let scoreRight = 0;
const votersSeen = new Set();
let CONFIG = { nameL: "OUI", nameR: "NON", trigL: "O", trigR: "N" };
let currentRoom = "";

function updateDisplay() {
  const total = scoreLeft + scoreRight;
  const percentLeft = total > 0 ? (scoreLeft / total) * 100 : 50;
  document.getElementById("bar-fill").style.width = percentLeft + "%";
  document.getElementById("cursor").style.left = percentLeft + "%";
}

function applyVisualConfig(data) {
  // Priorité : données remote > CSS OBS > valeurs par défaut
  CONFIG.nameL = data?.nameLeft    || cssVar("--name-left",  "OUI");
  CONFIG.nameR = data?.nameRight   || cssVar("--name-right", "NON");
  CONFIG.trigL = (data?.triggerLeft  || cssVar("--trigger-left",  "O")).toUpperCase();
  CONFIG.trigR = (data?.triggerRight || cssVar("--trigger-right", "N")).toUpperCase();

  document.getElementById("name-left").innerText  = CONFIG.nameL;
  document.getElementById("name-right").innerText = CONFIG.nameR;
  document.getElementById("trig-left").innerText  = CONFIG.trigL;
  document.getElementById("trig-right").innerText = CONFIG.trigR;

  // Couleurs : appliquées directement sur les éléments (bypass CSS var OBS)
  const colorL = data?.colorLeft  || cssVar("--color-left",  "#2ecc71");
  const colorR = data?.colorRight || cssVar("--color-right", "#e74c3c");

  document.querySelector(".team-label.left").style.color  = colorL;
  document.querySelector(".team-label.right").style.color = colorR;

  const barFill = document.getElementById("bar-fill");
  barFill.style.background  = colorL;
  barFill.style.boxShadow   = `0 0 20px ${colorL}`;

  document.querySelector(".bar-container").style.background = colorR;
}

/* --- CONNEXION --- */
const socket = io(SERVER_URL, { transports: ["websocket", "polling"] });

socket.on("connect", () => {
  if (currentRoom) socket.emit("overlay:online", { room: currentRoom, overlay: OVERLAY_TYPE });
});

async function init() {
  // Attente pour s'assurer qu'OBS a injecté le CSS personnalisé
  await new Promise(r => setTimeout(r, 600));

  const room = cssVar("--room-id");
  const key = cssVar("--room-key");

  if (!room || !key) {
    showSecurityDenied();
    return;
  }

  currentRoom = room;
  // Demande d'accès au serveur
  socket.emit("overlay:join", { room, key, overlay: OVERLAY_TYPE });
  socket.emit("overlay:online", { room, overlay: OVERLAY_TYPE });

  socket.on("overlay:forbidden", () => {
    showSecurityDenied();
  });

  socket.on("overlay:state", (payload) => {
    if (payload?.overlay !== OVERLAY_TYPE) return;

    if (payload.state === "idle") {
      scoreLeft = 0; scoreRight = 0; votersSeen.clear();
      updateDisplay();
      hideGame();
      return;
    }

    applyVisualConfig(payload.data);

    // Reset si configuré dans OBS
    if (cssVar("--auto-reset") === "true") {
      scoreLeft = 0; scoreRight = 0; votersSeen.clear();
    }

    updateDisplay();
    showGame(); // Apparition unique et fluide
  });

  // Écoute des votes via le canal agnostique du serveur
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
