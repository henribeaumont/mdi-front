/**
 * MDI TUG OF WAR - V5.6 SaaS (ZERO FLICKER)
 * - Gestion du canal universel 'raw_vote'
 * - Authentification stricte
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

/* --- LOGIQUE DE JEU --- */
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

/* --- CONNEXION --- */
const socket = io(SERVER_URL, { transports: ["websocket", "polling"] });

async function init() {
  // Attente pour s'assurer qu'OBS a injecté le CSS personnalisé
  await new Promise(r => setTimeout(r, 600));

  const room = cssVar("--room-id");
  const key = cssVar("--room-key");

  if (!room || !key) {
    showSecurityDenied();
    return;
  }

  // Demande d'accès au serveur
  socket.emit("overlay:join", { room, key, overlay: OVERLAY_TYPE });

  socket.on("overlay:forbidden", () => {
    showSecurityDenied();
  });

  socket.on("overlay:state", (payload) => {
    if (payload?.overlay === OVERLAY_TYPE) {
      applyVisualConfig();
      
      // Reset si configuré dans OBS
      if (cssVar("--auto-reset") === "true") {
        scoreLeft = 0; scoreRight = 0; votersSeen.clear();
      }
      
      updateDisplay();
      showGame(); // Apparition unique et fluide
    }
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
