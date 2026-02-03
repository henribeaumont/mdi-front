/**
 * ============================================================
 * MDI COMMENTAIRES V1.0
 * ============================================================
 * Pattern EXACT du nuage_de_mots.js V6.7
 * ============================================================ */

const SERVER_URL = "https://magic-digital-impact-live.onrender.com";
const OVERLAY_TYPE = "commentaires";

/* -------- Helpers CSS Vars (OBS) -------- */
function cssVar(name, fallback = "") {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name);
  return v ? v.trim().replace(/^['"]+|['"]+$/g, "") : fallback;
}

function cssOnOff(name, fallbackOn = true) {
  const v = (cssVar(name, "") || "").toLowerCase();
  if (!v) return fallbackOn;
  return v === "on" || v === "true" || v === "1";
}

/* -------- DOM -------- */
const container = document.getElementById("comment-container");
const securityScreen = document.getElementById("security-screen");
const panel = document.getElementById("comment-panel");
const authorEl = document.getElementById("comment-author");
const textEl = document.getElementById("comment-text");

/* -------- State -------- */
let STATE = "idle";
let currentComment = null;

/* -------- Affichage -------- */
function showComment(comment) {
  if (!comment) return;
  
  currentComment = comment;
  
  // Gérer affichage auteur
  const showAuthor = cssOnOff("--show-author", true);
  if (showAuthor && comment.author) {
    authorEl.textContent = comment.author;
    authorEl.classList.remove("hidden-author");
  } else {
    authorEl.classList.add("hidden-author");
  }
  
  // Afficher message
  textEl.textContent = comment.text;
  
  // Gérer border
  const borderEnabled = cssOnOff("--panel-border-enabled", true);
  if (borderEnabled) {
    panel.classList.remove("no-border");
  } else {
    panel.classList.add("no-border");
  }
  
  // Animation
  panel.classList.remove("animate-in");
  void panel.offsetWidth; // Force reflow
  panel.classList.add("animate-in");
  
  console.log("💬 [COMMENTAIRES] Affichage:", comment);
}

function hideComment() {
  currentComment = null;
  
  container.classList.remove("show");
  setTimeout(() => {
    container.classList.add("hidden");
    authorEl.textContent = "";
    textEl.textContent = "";
  }, 600);
  
  console.log("🔴 [COMMENTAIRES] Masqué");
}

/* -------- Socket.io -------- */
const socket = io(SERVER_URL, {
  transports: ["websocket", "polling"],
  reconnection: true
});

socket.on("connect", () => {
  console.log("✅ [COMMENTAIRES] Connecté");
});

socket.on("overlay:state", (payload) => {
  if (payload.overlay !== OVERLAY_TYPE) return;

  console.log(`📡 [COMMENTAIRES] État:`, payload.state, payload.data);
  STATE = payload.state;

  if (STATE === "idle") {
    container.classList.remove("show");
    setTimeout(() => {
      container.classList.add("hidden");
      authorEl.textContent = "";
      textEl.textContent = "";
      currentComment = null;
    }, 600);
    return;
  }

  if (STATE === "active") {
    securityScreen.classList.add("hidden");
    
    // Vérifier si un commentaire doit être affiché
    if (payload.data && payload.data.current) {
      const comment = payload.data.current;
      
      container.classList.remove("hidden");
      requestAnimationFrame(() => {
        container.classList.add("show");
        showComment(comment);
      });
    } else {
      // Pas de commentaire à afficher, masquer
      if (!container.classList.contains("hidden")) {
        hideComment();
      }
    }
  }
});

socket.on("overlay:forbidden", (payload) => {
  console.error("❌ [COMMENTAIRES] Accès refusé:", payload.reason);
  securityScreen.classList.remove("hidden");
  container.classList.add("hidden");
});

/* -------- Auth (OBS CSS vars) -------- */
async function init() {
  await new Promise(resolve => setTimeout(resolve, 800));

  const authMode = cssVar("--auth-mode", "strict");
  const room = cssVar("--room-id", "").trim();
  const key = cssVar("--room-key", "").trim();

  console.log(`🔐 [COMMENTAIRES] Auth: ${authMode}, Room: ${room}`);

  if (!room) {
    console.error("❌ [COMMENTAIRES] Aucun room-id");
    securityScreen.classList.remove("hidden");
    return;
  }

  if (authMode === "strict") {
    if (!key) {
      console.error("❌ [COMMENTAIRES] Mode strict sans key");
      securityScreen.classList.remove("hidden");
      return;
    }
    socket.emit("overlay:join", { room, key, overlay: OVERLAY_TYPE });
  } else {
    socket.emit("overlay:join", { room, key: "", overlay: OVERLAY_TYPE });
  }

  console.log("✅ [COMMENTAIRES] Auth envoyée");
}

socket.on("connect", init);
