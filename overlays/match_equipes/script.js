/**
 * ============================================================
 * MDI MATCH ÉQUIPES V1.1
 * ============================================================
 * ✅ Tout V1.0 préservé (ZÉRO RÉGRESSION)
 * ✅ NOUVEAU : émission overlay:online / présence
 *    → deux voyants télécommande :
 *      • Connexion serveur
 *      • Affichage dans OBS (vert dès que le panel est visible)
 * ✅ NOUVEAU : auto-activation à la connexion
 *    → l'overlay demande lui-même son activation au serveur
 *      sans attendre la télécommande
 * ============================================================
 */

const SERVER_URL = "https://magic-digital-impact-live.onrender.com";
const OVERLAY_TYPE = "match_equipes";

function cssVar(name, fallback = "") {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name);
  return v ? v.trim().replace(/^['"]+|['"]+$/g, "") : fallback;
}
function cssOnOff(name, fallbackOn = true) {
  const v = (cssVar(name, "") || "").toLowerCase();
  if (!v) return fallbackOn;
  return v === "on" || v === "true" || v === "1";
}

const container = document.getElementById("match-container");
const securityScreen = document.getElementById("security-screen");
const panel = document.getElementById("match-panel");
const teamANameEl = document.getElementById("teamAName");
const teamAScoreEl = document.getElementById("teamAScore");
const teamBNameEl = document.getElementById("teamBName");
const teamBScoreEl = document.getElementById("teamBScore");

let STATE = "idle";
let teamAScore = 0;
let teamBScore = 0;
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

function updateDisplay(data) {
  if (!data) return;

  // Si la télécommande fournit un nom/couleur, elle écrase le CSS OBS ; sinon CSS OBS reprend le contrôle
  if (data.teamA?.name) document.documentElement.style.setProperty("--team-a-name", data.teamA.name);
  else document.documentElement.style.removeProperty("--team-a-name");
  if (data.teamA?.color) document.documentElement.style.setProperty("--team-a-color", data.teamA.color);
  else document.documentElement.style.removeProperty("--team-a-color");
  if (data.teamB?.name) document.documentElement.style.setProperty("--team-b-name", data.teamB.name);
  else document.documentElement.style.removeProperty("--team-b-name");
  if (data.teamB?.color) document.documentElement.style.setProperty("--team-b-color", data.teamB.color);
  else document.documentElement.style.removeProperty("--team-b-color");

  const teamAName = cssVar("--team-a-name", "Équipe A");
  const teamBName = cssVar("--team-b-name", "Équipe B");
  teamANameEl.textContent = teamAName;
  teamBNameEl.textContent = teamBName;

  const newTeamAScore = data.teamA?.score || 0;
  const newTeamBScore = data.teamB?.score || 0;

  if (newTeamAScore !== teamAScore) {
    teamAScoreEl.classList.remove("animate");
    void teamAScoreEl.offsetWidth;
    teamAScoreEl.classList.add("animate");
    teamAScore = newTeamAScore;
  }
  if (newTeamBScore !== teamBScore) {
    teamBScoreEl.classList.remove("animate");
    void teamBScoreEl.offsetWidth;
    teamBScoreEl.classList.add("animate");
    teamBScore = newTeamBScore;
  }

  teamAScoreEl.textContent = teamAScore;
  teamBScoreEl.textContent = teamBScore;

  const borderEnabled = cssOnOff("--panel-border-enabled", true);
  if (borderEnabled) { panel.classList.remove("no-border"); }
  else { panel.classList.add("no-border"); }

  console.log(`📊 [MATCH] ${teamAName} ${teamAScore} - ${teamBScore} ${teamBName}`);
}

function showOverlay(data) {
  securityScreen.classList.add("hidden");
  container.classList.remove("hidden");
  if (data) updateDisplay(data);
  requestAnimationFrame(() => {
    container.classList.add("show");
    container.classList.add("animate-in");
  });
  emitPresence(true);
}

/* -------- Socket.io -------- */
const socket = io(SERVER_URL, {
  transports: ["websocket", "polling"],
  reconnection: true
});

socket.on("connect", () => {
  console.log("✅ [MATCH] Connecté");
  if (currentRoom) {
    socket.emit("overlay:online", { room: currentRoom, overlay: OVERLAY_TYPE });
  }
});

socket.on("disconnect", () => {
  console.log("🔴 [MATCH] Déconnecté");
});

socket.on("overlay:state", (payload) => {
  if (payload.overlay !== OVERLAY_TYPE) return;
  console.log(`📡 [MATCH] État:`, payload.state, payload.data);
  STATE = payload.state;

  if (STATE === "idle") {
    container.classList.remove("show");
    setTimeout(() => {
      container.classList.add("hidden");
      teamAScore = 0;
      teamBScore = 0;
      teamAScoreEl.textContent = "0";
      teamBScoreEl.textContent = "0";
    }, 600);
    emitPresence(false);
    return;
  }

  if (STATE === "active") {
    showOverlay(payload.data);
  }
});

socket.on("overlay:forbidden", (payload) => {
  console.error("❌ [MATCH] Accès refusé:", payload.reason);
  securityScreen.classList.remove("hidden");
  container.classList.add("hidden");
});

async function init() {
  await new Promise(resolve => setTimeout(resolve, 800));

  const authMode = cssVar("--auth-mode", "strict");
  const room = cssVar("--room-id", "").trim();
  const key = cssVar("--room-key", "").trim();

  currentRoom = room;
  console.log(`🔐 [MATCH] Auth: ${authMode}, Room: ${room}`);

  if (!room) {
    console.error("❌ [MATCH] Aucun room-id");
    securityScreen.classList.remove("hidden");
    return;
  }

  if (authMode === "strict") {
    if (!key) {
      console.error("❌ [MATCH] Mode strict sans key");
      securityScreen.classList.remove("hidden");
      return;
    }
    socket.emit("overlay:join", { room, key, overlay: OVERLAY_TYPE });
  } else {
    socket.emit("overlay:join", { room, key: "", overlay: OVERLAY_TYPE });
  }

  // ✅ Signaler la présence en ligne
  socket.emit("overlay:online", { room, overlay: OVERLAY_TYPE });

  // ✅ Auto-activation : demander l'état actuel au serveur
  // Le serveur répond avec overlay:state → showOverlay() si active
  // Si le serveur n'a pas encore d'état actif, la télécommande
  // déclenchera l'activation à sa connexion (comportement V5.14 inchangé)
  console.log("✅ [MATCH] Auth envoyée — en attente état serveur");
}

socket.on("connect", init);
