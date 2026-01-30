/**
 * MDI TUG OF WAR - V9 (OBS SYNC FIX)
 * - Attend le chargement du CSS OBS avant de démarrer
 * - Message d'erreur standardisé (Access Denied)
 * - Logique CSS Driven (O/N, 1/2...)
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

// --- ATTENTE CSS OBS (CRUCIAL) ---
async function waitForObsConfig() {
  // On tente pendant 3 secondes max de trouver la clé
  for (let i = 0; i < 30; i++) {
    const room = cssVar("--room-id");
    const key = cssVar("--room-key");
    
    // Si on a les infos, on arrête d'attendre
    if (room && key && room !== "DEMO_CLIENT") return; 
    
    await wait(100); // On attend 100ms
  }
  console.log("⚠️ Fin de l'attente OBS, utilisation des valeurs trouvées.");
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
  
  // On récupère les triggers définis dans le CSS
  CONFIG.triggerL = (cssVar("--trigger-left") || "O").toUpperCase();
  CONFIG.triggerR = (cssVar("--trigger-right") || "N").toUpperCase();
  
  // Mise à jour de l'affichage
  const elL = document.getElementById("name-left");
  const elR = document.getElementById("name-right");
  const trL = document.getElementById("trig-left");
  const trR = document.getElementById("trig-right");

  if(elL) elL.innerText = CONFIG.nameL;
  if(elR) elR.innerText = CONFIG.nameR;
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
  
  // 1. On attend que OBS injecte le CSS
  await waitForObsConfig();
  
  // 2. On lit la config
  updateConfig();
  
  // 3. Lecture finale des identifiants
  // Priorité : URL > CSS > Défaut
  const params = new URLSearchParams(window.location.search);
  const room = params.get("room") || cssVar("--room-id");
  const key = params.get("key") || cssVar("--room-key");

  // 4. Vérification Sécurité
  if(!room || !key) {
    console.error("⛔ Config manquante (Room ou Key introuvable)");
    // On laisse l'écran de sécurité par défaut (ACCÈS REFUSÉ)
    document.getElementById("security-screen").classList.remove("hidden");
    return; // STOP
  }

  // 5. Connexion
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
      // Sésame ouvre-toi
      document.getElementById("container").classList.remove("hidden");
      document.getElementById("security-screen").classList.add("hidden");
      
      updateConfig(); // Rafraichissement dynamique du CSS
      updateDisplay(payload.data.votes);
    }
  });

  socket.on("overlay:forbidden", () => {
    console.warn("⛔ Accès interdit par le serveur");
    document.getElementById("container").classList.add("hidden");
    document.getElementById("security-screen").classList.remove("hidden");
  });

})();
