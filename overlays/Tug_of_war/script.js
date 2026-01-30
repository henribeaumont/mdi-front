/**
 * MDI TUG OF WAR - V8 (CSS DRIVEN)
 * - Lit --trigger-left / --trigger-right du CSS
 * - Cherche ces clés exactes dans les votes reçus du serveur
 */

const SERVER_URL = "https://magic-digital-impact-live.onrender.com";
const OVERLAY_TYPE = "tug_of_war";

// Fonction utilitaire CSS
function cssVar(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  // Retire les guillemets si présents
  return v ? v.replace(/^['"]|['"]$/g, "") : fallback;
}

// Configuration dynamique
let CONFIG = {
  nameL: "OUI", 
  nameR: "NON",
  triggerL: "O", // Valeur par défaut si CSS vide
  triggerR: "N"
};

function updateConfig() {
  CONFIG.nameL = cssVar("--name-left", "OUI");
  CONFIG.nameR = cssVar("--name-right", "NON");
  
  // ICI : On récupère tes triggers personnalisés (ex: "O", "N", "1", "2", "P", "B")
  CONFIG.triggerL = cssVar("--trigger-left", "O").toUpperCase();
  CONFIG.triggerR = cssVar("--trigger-right", "N").toUpperCase();
  
  // Mise à jour de l'affichage
  document.getElementById("name-left").innerText = CONFIG.nameL;
  document.getElementById("name-right").innerText = CONFIG.nameR;
  document.getElementById("trig-left").innerText = CONFIG.triggerL;
  document.getElementById("trig-right").innerText = CONFIG.triggerR;
}

// Mise à jour Jauge
function updateDisplay(votes) {
  // On va chercher dans l'objet votes LA CLÉ qui correspond au CSS
  // Si CSS dit "O", on cherche votes["O"]
  const countL = votes[CONFIG.triggerL] || 0;
  const countR = votes[CONFIG.triggerR] || 0;
  
  const total = countL + countR;
  
  let percentL = 50;
  if (total > 0) {
    percentL = (countL / total) * 100;
  }
  
  document.getElementById("bar-fill").style.width = percentL + "%";
  document.getElementById("cursor").style.left = percentL + "%";
}

// Connexion Socket
const socket = io(SERVER_URL, { transports: ["websocket", "polling"] });
const params = new URLSearchParams(window.location.search);
const room = params.get("room") || cssVar("--room-id", "DEMO_CLIENT");
const key = params.get("key") || cssVar("--room-key", "");

// Init
updateConfig();

if(!room || !key) {
  document.getElementById("security-screen").classList.remove("hidden");
  document.querySelector(".mdi-msg").innerText = "Configuration manquante";
} else {
  socket.on("connect", () => {
    socket.emit("overlay:join", { room, key, overlay: OVERLAY_TYPE });
  });

  socket.on("overlay:state", (payload) => {
    // Si reset
    if(payload.state === "reset") {
      updateDisplay({}); 
      return;
    }

    // Si données actives
    if (payload.overlay === OVERLAY_TYPE && payload.data && payload.data.votes) {
      document.getElementById("container").classList.remove("hidden");
      document.getElementById("security-screen").classList.add("hidden");
      
      // On relit la config au cas où le CSS a changé dynamiquement
      updateConfig();
      
      // On met à jour avec les votes reçus
      updateDisplay(payload.data.votes);
    }
  });

  socket.on("overlay:forbidden", () => {
    document.getElementById("security-screen").classList.remove("hidden");
  });
}