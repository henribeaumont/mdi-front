/**
 * ============================================================
 * MDI COMMENTAIRES V1.1
 * ============================================================
 * ✅ Tout V1.0 préservé (ZÉRO RÉGRESSION)
 * ✅ NOUVEAU : émission overlay:online / présence
 *    → deux voyants télécommande :
 *      • Connexion serveur
 *      • Affichage dans OBS (vert quand un commentaire est affiché)
 * ============================================================
 */

const SERVER_URL = "https://magic-digital-impact-live.onrender.com";
const OVERLAY_TYPE = "commentaires";

function cssVar(name, fallback = "") {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name);
  return v ? v.trim().replace(/^['"]+|['"]+$/g, "") : fallback;
}
function cssOnOff(name, fallbackOn = true) {
  const v = (cssVar(name, "") || "").toLowerCase();
  if (!v) return fallbackOn;
  return v === "on" || v === "true" || v === "1";
}

const container = document.getElementById("comment-container");
const securityScreen = document.getElementById("security-screen");
const panel = document.getElementById("comment-panel");
const authorEl = document.getElementById("comment-author");
const textEl = document.getElementById("comment-text");

let STATE = "idle";
let currentComment = null;
let currentRoom = "";

/* -------- Presence -------- */
function emitPresence(displaying) {
  if (!currentRoom) return;
  socket.emit("overlay:presence_update", {
    room: currentRoom,
    overlay: OVERLAY_TYPE,
    displaying
  });
}

function showComment(comment) {
  if (!comment) return;
  currentComment = comment;

  const showAuthor = cssOnOff("--show-author", true);
  if (showAuthor && comment.author) {
    authorEl.textContent = comment.author;
    authorEl.classList.remove("hidden-author");
  } else {
    authorEl.classList.add("hidden-author");
  }

  textEl.textContent = comment.text;

  const borderEnabled = cssOnOff("--panel-border-enabled", true);
  if (borderEnabled) {
    panel.classList.remove("no-border");
  } else {
    panel.classList.add("no-border");
  }

  panel.classList.remove("animate-in");
  void panel.offsetWidth;
  panel.classList.add("animate-in");

  emitPresence(true);
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
  emitPresence(false);
  console.log("🔴 [COMMENTAIRES] Masqué");
}

const socket = io(SERVER_URL, {
  transports: ["websocket", "polling"],
  reconnection: true
});

socket.on("connect", () => {
  console.log("✅ [COMMENTAIRES] Connecté");
  if (currentRoom) {
    socket.emit("overlay:online", { room: currentRoom, overlay: OVERLAY_TYPE });
  }
});

socket.on("disconnect", () => {
  console.log("🔴 [COMMENTAIRES] Déconnecté");
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
    emitPresence(false);
    return;
  }

  if (STATE === "active") {
    securityScreen.classList.add("hidden");
    if (payload.data && payload.data.current) {
      container.classList.remove("hidden");
      requestAnimationFrame(() => {
        container.classList.add("show");
        showComment(payload.data.current);
      });
      // emitPresence(true) est appelé dans showComment
    } else {
      if (!container.classList.contains("hidden")) {
        hideComment();
      }
      // Overlay actif mais rien affiché : connexion OK, affichage OFF
      emitPresence(false);
    }
  }
});

socket.on("overlay:forbidden", (payload) => {
  console.error("❌ [COMMENTAIRES] Accès refusé:", payload.reason);
  securityScreen.classList.remove("hidden");
  container.classList.add("hidden");
});

async function init() {
  await new Promise(resolve => setTimeout(resolve, 800));

  const authMode = cssVar("--auth-mode", "strict");
  const room = cssVar("--room-id", "").trim();
  const key = cssVar("--room-key", "").trim();

  currentRoom = room;
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

  socket.emit("overlay:online", { room, overlay: OVERLAY_TYPE });
  console.log("✅ [COMMENTAIRES] Auth envoyée");
}

socket.on("connect", init);
