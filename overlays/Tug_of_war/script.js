/**
 * MDI TUG OF WAR - V5.5 SaaS
 * Adapté pour écouter le canal universel 'raw_vote'
 */

const SERVER_URL = "https://magic-digital-impact-live.onrender.com";
const OVERLAY_TYPE = "tug_of_war";

/* --- UTILS --- */
function cssVar(name, fallback = "") {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name);
  return v ? v.trim().replace(/^['"]+|['"]+$/g, "") : fallback;
}

const wait = (ms) => new Promise(r => setTimeout(r, ms));

/* --- UI CONTROLS --- */
function lockScreen() {
  document.getElementById("container").classList.add("hidden");
  document.getElementById("security-screen").classList.remove("hidden");
}

function unlockScreen() {
  document.getElementById("security-screen").classList.add("hidden");
  document.getElementById("container").classList.remove("hidden");
}

/* --- GAME LOGIC --- */
let scoreLeft = 0;
let scoreRight = 0;
const votersSeen = new Set();
let CONFIG = { nameL: "OUI", nameR: "NON", trigL: "O", trigR: "N" };

function resetScores() {
  scoreLeft = 0;
  scoreRight = 0;
  votersSeen.clear();
  updateDisplay();
}

function updateDisplay() {
  const total = scoreLeft + scoreRight;
  const percentLeft = total > 0 ? (scoreLeft / total) * 100 : 50;
  document.getElementById("bar-fill").style.width = percentLeft + "%";
  document.getElementById("cursor").style.left = percentLeft + "%";
}

function lireConfigurationCSS() {
  CONFIG.nameL = cssVar("--name-left", "OUI");
  CONFIG.nameR = cssVar("--name-right", "NON");
  CONFIG.trigL = cssVar("--trigger-left", "O").toUpperCase();
  CONFIG.trigR = cssVar("--trigger-right", "N").toUpperCase();

  document.getElementById("name-left").innerText = CONFIG.nameL;
  document.getElementById("name-right").innerText = CONFIG.nameR;
  document.getElementById("trig-left").innerText = CONFIG.trigL;
  document.getElementById("trig-right").innerText = CONFIG.trigR;
  
  // Appliquer les couleurs
  document.documentElement.style.setProperty("--color-left", cssVar("--color-left", "#2ecc71"));
  document.documentElement.style.setProperty("--color-right", cssVar("--color-right", "#e74c3c"));
}

/* --- SOCKET & BOOT --- */
const socket = io(SERVER_URL, { transports: ["websocket", "polling"] });

async function boot() {
  // Attente du chargement CSS OBS
  await wait(500);
  
  const room = cssVar("--room-id", "");
  const key = cssVar("--room-key", "");
  const authMode = cssVar("--auth-mode", "strict");
  const autoReset = cssVar("--auto-reset", "false");

  if (authMode === "strict" && (!room || !key)) {
    lockScreen();
    return;
  }

  socket.on("connect", () => {
    socket.emit("overlay:join", { room, key, overlay: OVERLAY_TYPE });
  });

  socket.on("overlay:forbidden", () => lockScreen());

  socket.on("overlay:state", (payload) => {
    if (payload?.overlay !== OVERLAY_TYPE) return;
    unlockScreen();
    lireConfigurationCSS();
    if (autoReset === "true") resetScores();
    else updateDisplay();
  });

  // ÉCOUTE DU CANAL UNIVERSEL
  socket.on("raw_vote", (data) => {
    const vote = (data.vote || "").trim().toUpperCase();
    const user = data.user || "Anonyme";
    const oneVoteOnly = cssVar("--tug-one-vote-per-person", "off") === "on";

    if (!vote) return;
    if (oneVoteOnly && votersSeen.has(user) && user !== "Anonyme") return;

    if (vote === CONFIG.trigL) {
      scoreLeft++;
      if (oneVoteOnly) votersSeen.add(user);
      updateDisplay();
    } else if (vote === CONFIG.trigR) {
      scoreRight++;
      if (oneVoteOnly) votersSeen.add(user);
      updateDisplay();
    } else if (vote === "RESET") {
      resetScores();
    }
  });
}

boot();
