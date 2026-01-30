/**
 * MDI TUG OF WAR - V10 (FONT SIZE CONTROL)
 * - Ajout de la gestion de la taille de police via CSS
 * - Variable: --label-font-size
 */

const SERVER_URL = "https://magic-digital-impact-live.onrender.com";
const OVERLAY_TYPE = "tug_of_war";

// --- UTILITAIRES ---
function cssVar(name) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v ? v.replace(/^['"]|['"]$/g, "") : "";
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// --- ATTENTE CSS OBS ---
async function waitForObsConfig() {
  for (let i = 0; i < 30; i++) {
    const room = cssVar("--room-id");
    const key = cssVar("--room-key");
    if (room && key && room !== "DEMO_CLIENT") return; 
    await wait(100);
  }
  console.log("⚠️ Fin de l'attente OBS.");
}

// --- CONFIGURATION ---
let CONFIG = {
  nameL: "OUI", 
  nameR: "NON",
  triggerL: "O",
  triggerR: "N"
};

function updateConfig() {
  CONFIG.nameL = cssVar("--name-left") || "OUI";
  CONFIG.nameR = cssVar("--name-right") || "NON";
  CONFIG.triggerL = (cssVar("--trigger-left") || "O").toUpperCase();
  CONFIG.triggerR = (cssVar("--trigger-right") || "N").toUpperCase();
  
  // --- NOUVEAU : TAILLE DE POLICE ---
  // Lit la variable CSS ou met 60px par défaut
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
  const countL = votes[CONFIG.triggerL] || 0;
  const countR = votes[CONFIG.triggerR] || 0;
  const total = countL + countR;
  
  let percentL = 50;
  if (total > 0) {
    percentL = (countL / total) * 100;
  }
  
  const bar = document.getElementById("bar-fill");
  const cur = document.getElementById("cursor");
  if(bar) bar.style.width = percentL + "%";
  if(cur) cur.style.left = percentL + "%";
}

// --- MAIN BOOT ---
(async function demarrer() {
  await waitForObsConfig();
  updateConfig();
  
  const params = new URLSearchParams(window.location.search);
  const room = params.get("room") || cssVar("--room-id");
  const key = params.get("key") || cssVar("--room-key");

  if(!room || !key) {
    console.error("⛔ Config manquante");
    document.getElementById("security-screen").classList.remove("hidden");
    return;
  }

  console.log(`🔌 Connexion vers ${room}...`);
  const socket = io(SERVER_URL, { transports: ["websocket", "polling"] });

  socket.on("connect", () => {
    socket.emit("overlay:join", { room, key, overlay: OVERLAY_TYPE });
  });

  socket.on("overlay:state", (payload) => {
    if(payload.state === "reset") {
      updateDisplay({}); 
      return;
    }

    if (payload.overlay === OVERLAY_TYPE && payload.data && payload.data.votes) {
      document.getElementById("container").classList.remove("hidden");
      document.getElementById("security-screen").classList.add("hidden");
      updateConfig(); 
      updateDisplay(payload.data.votes);
    }
  });

  socket.on("overlay:forbidden", () => {
    document.getElementById("container").classList.add("hidden");
    document.getElementById("security-screen").classList.remove("hidden");
  });
})();
