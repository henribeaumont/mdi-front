/**
 * ============================================================
 * MDI MATCH ÉQUIPES V1.0
 * ============================================================
 * Pattern EXACT du nuage_de_mots.js V6.7
 * ============================================================ */

const SERVER_URL = "https://magic-digital-impact-live.onrender.com";
const OVERLAY_TYPE = "match_equipes";

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
const container = document.getElementById("match-container");
const securityScreen = document.getElementById("security-screen");
const panel = document.getElementById("match-panel");
const teamANameEl = document.getElementById("teamAName");
const teamAScoreEl = document.getElementById("teamAScore");
const teamBNameEl = document.getElementById("teamBName");
const teamBScoreEl = document.getElementById("teamBScore");

/* -------- State -------- */
let STATE = "idle";
let teamAScore = 0;
let teamBScore = 0;

/* -------- Affichage -------- */
function updateDisplay(data) {
  if (!data) return;
  
  // Noms équipes (CSS OBS ou serveur)
  const teamAName = cssVar("--team-a-name", data.teamA?.name || "ÉQUIPE A");
  const teamBName = cssVar("--team-b-name", data.teamB?.name || "ÉQUIPE B");
  
  teamANameEl.textContent = teamAName;
  teamBNameEl.textContent = teamBName;
  
  // Scores
  const newTeamAScore = data.teamA?.score || 0;
  const newTeamBScore = data.teamB?.score || 0;
  
  // Animation si score change
  if (newTeamAScore !== teamAScore) {
    teamAScoreEl.classList.remove("animate");
    void teamAScoreEl.offsetWidth; // Force reflow
    teamAScoreEl.classList.add("animate");
    teamAScore = newTeamAScore;
  }
  
  if (newTeamBScore !== teamBScore) {
    teamBScoreEl.classList.remove("animate");
    void teamBScoreEl.offsetWidth; // Force reflow
    teamBScoreEl.classList.add("animate");
    teamBScore = newTeamBScore;
  }
  
  teamAScoreEl.textContent = teamAScore;
  teamBScoreEl.textContent = teamBScore;
  
  // Gérer border
  const borderEnabled = cssOnOff("--panel-border-enabled", true);
  if (borderEnabled) {
    panel.classList.remove("no-border");
  } else {
    panel.classList.add("no-border");
  }
  
  console.log(`📊 [MATCH] ${teamAName} ${teamAScore} - ${teamBScore} ${teamBName}`);
}

/* -------- Socket.io -------- */
const socket = io(SERVER_URL, {
  transports: ["websocket", "polling"],
  reconnection: true
});

socket.on("connect", () => {
  console.log("✅ [MATCH] Connecté");
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
    return;
  }

  if (STATE === "active") {
    securityScreen.classList.add("hidden");
    container.classList.remove("hidden");
    
    // Update display
    if (payload.data) {
      updateDisplay(payload.data);
    }
    
    // Show avec animation
    requestAnimationFrame(() => {
      container.classList.add("show");
      container.classList.add("animate-in");
    });
  }
});

socket.on("overlay:forbidden", (payload) => {
  console.error("❌ [MATCH] Accès refusé:", payload.reason);
  securityScreen.classList.remove("hidden");
  container.classList.add("hidden");
});

/* -------- Auth (OBS CSS vars) -------- */
async function init() {
  await new Promise(resolve => setTimeout(resolve, 800));

  const authMode = cssVar("--auth-mode", "strict");
  const room = cssVar("--room-id", "").trim();
  const key = cssVar("--room-key", "").trim();

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

  console.log("✅ [MATCH] Auth envoyée");
}

socket.on("connect", init);
