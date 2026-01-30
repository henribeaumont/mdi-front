/**
 * MDI TUG OF WAR - V11 (STABLE DISPLAY)
 * - S'affiche immédiatement (même avec 0 votes) pour éviter le clignotement
 * - Gère la taille de police CSS
 * - Attend la config OBS proprement
 */

const SERVER_URL = "https://magic-digital-impact-live.onrender.com";
const OVERLAY_TYPE = "tug_of_war";

function cssVar(name) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v ? v.replace(/^['"]|['"]$/g, "") : "";
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// --- ATTENTE CSS ---
async function waitForObsConfig() {
  // On attend un peu que OBS injecte le CSS
  for (let i = 0; i < 30; i++) {
    const room = cssVar("--room-id");
    const key = cssVar("--room-key");
    // Si on trouve une config valide (différente du défaut HTML si besoin)
    if (room && key) return; 
    await wait(100);
  }
}

// --- CONFIG ---
let CONFIG = {
  nameL: "OUI", nameR: "NON",
  triggerL: "O", triggerR: "N"
};

function updateConfig() {
  CONFIG.nameL = cssVar("--name-left") || "OUI";
  CONFIG.nameR = cssVar("--name-right") || "NON";
  CONFIG.triggerL = (cssVar("--trigger-left") || "O").toUpperCase();
  CONFIG.triggerR = (cssVar("--trigger-right") || "N").toUpperCase();
  
  const fontSize = cssVar("--label-font-size") || "60px";

  const elL = document.getElementById("name-left");
  const elR = document.getElementById("name-right");
  const trL = document.getElementById("trig-left");
  const trR = document.getElementById("trig-right");

  if(elL) { elL.innerText = CONFIG.nameL; elL.style.fontSize = fontSize; }
  if(elR) { elR.innerText = CONFIG.nameR; elR.style.fontSize = fontSize; }
  if(trL) trL.innerText = CONFIG.triggerL;
  if(trR) trR.innerText = CONFIG.triggerR;
}

function updateDisplay(votes) {
  // Protection si votes est vide/undefined
  const safeVotes = votes || {};
  const countL = safeVotes[CONFIG.triggerL] || 0;
  const countR = safeVotes[CONFIG.triggerR] || 0;
  const total = countL + countR;
  
  let percentL = 50;
  if (total > 0) {
    percentL = (countL / total) * 100;
  }
  
  document.getElementById("bar-fill").style.width = percentL + "%";
  document.getElementById("cursor").style.left = percentL + "%";
}

// --- BOOT ---
(async function demarrer() {
  await waitForObsConfig();
  updateConfig();
  
  const params = new URLSearchParams(window.location.search);
  const room = params.get("room") || cssVar("--room-id");
  const key = params.get("key") || cssVar("--room-key");

  if(!room || !key) {
    // Si vraiment pas de config, on affiche l'erreur
    document.getElementById("security-screen").classList.remove("hidden");
    return;
  }

  // Si on a la config, ON AFFICHE L'INTERFACE TOUT DE SUITE (pour éviter le trésautement)
  document.getElementById("container").classList.remove("hidden");
  document.getElementById("security-screen").classList.add("hidden");

  const socket = io(SERVER_URL, { transports: ["websocket", "polling"] });

  socket.on("connect", () => {
    socket.emit("overlay:join", { room, key, overlay: OVERLAY_TYPE });
  });

  socket.on("overlay:state", (payload) => {
    if(payload.state === "reset") {
      updateDisplay({}); 
      return;
    }

    if (payload.overlay === OVERLAY_TYPE) {
      // On s'assure que c'est visible
      document.getElementById("container").classList.remove("hidden");
      
      updateConfig(); // On relit le CSS au cas où
      
      if (payload.data && payload.data.votes) {
        updateDisplay(payload.data.votes);
      }
    }
  });

  socket.on("overlay:forbidden", () => {
    document.getElementById("container").classList.add("hidden");
    document.getElementById("security-screen").classList.remove("hidden");
  });
})();
