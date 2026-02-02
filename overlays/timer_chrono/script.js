/**
 * ============================================================
 * MDI TIMER/CHRONO V2.0
 * ============================================================
 * Pattern EXACT du nuage de mots V6.7
 * ============================================================ */

const SERVER_URL = "https://magic-digital-impact-live.onrender.com";
const OVERLAY_TYPE = "timer_chrono";

/* -------- Helpers CSS Vars (OBS) -------- */
function cssVar(name, fallback = "") {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name);
  return v ? v.trim().replace(/^['"]+|['"]+$/g, "") : fallback;
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

/* -------- DOM -------- */
const elSecurity = document.getElementById("security-screen");
const elApp = document.getElementById("app");
const elPanel = document.getElementById("panel");
const elTime = document.getElementById("time");

/* -------- State -------- */
let STATE = "idle";
let MODE = "timer";
let remainingMs = 60000;
let elapsedMs = 0;
let lastTickTime = 0;
let animationFrameId = null;

/* -------- Formatting -------- */
function pad2(n) {
  return String(n).padStart(2, "0");
}

function formatTimer(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const mm = Math.floor(totalSec / 60);
  const ss = totalSec % 60;
  return `${pad2(mm)}:${pad2(ss)}`;
}

function formatChrono(ms) {
  const totalMs = Math.max(0, Math.floor(ms));
  const totalSec = Math.floor(totalMs / 1000);
  const mm = Math.floor(totalSec / 60);
  const ss = totalSec % 60;
  const cc = Math.floor((totalMs % 1000) / 10);
  
  return `${pad2(mm)}:${pad2(ss)}:<span class="centimes">${pad2(cc)}</span>`;
}

function updateDisplay() {
  if (MODE === "timer") {
    elTime.textContent = formatTimer(remainingMs);
  } else {
    elTime.innerHTML = formatChrono(elapsedMs);
  }
}

/* -------- Engine -------- */
function resetEngine() {
  STATE = "idle";
  elapsedMs = 0;
  remainingMs = 60000;
  
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  
  elPanel.classList.remove("is-done");
  elApp.classList.remove("state-running", "state-paused");
  elApp.classList.add("state-idle");
  
  updateDisplay();
  console.log("🔄 [TIMER] Reset engine");
}

function startEngine() {
  if (STATE === "running") return;
  if (STATE === "done" && MODE === "timer") return;
  
  STATE = "running";
  elApp.classList.remove("state-idle", "state-paused");
  elApp.classList.add("state-running");
  
  lastTickTime = performance.now();
  animationFrameId = requestAnimationFrame(loop);
  
  console.log("▶️ [TIMER] Start");
}

function pauseEngine() {
  if (STATE !== "running") return;
  
  STATE = "paused";
  elApp.classList.remove("state-running");
  elApp.classList.add("state-paused");
  
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  
  console.log("⏸️ [TIMER] Pause");
}

function togglePause() {
  if (STATE === "running") {
    pauseEngine();
  } else if (STATE === "paused" || STATE === "idle") {
    startEngine();
  }
}

function finishTimer() {
  STATE = "done";
  remainingMs = 0;
  
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  
  updateDisplay();
  
  elPanel.classList.remove("is-done");
  void elPanel.offsetWidth;
  elPanel.classList.add("is-done");
  
  console.log("🏁 [TIMER] Fini !");
}

function loop(timestamp) {
  if (STATE !== "running") return;
  
  const dt = timestamp - lastTickTime;
  lastTickTime = timestamp;
  
  if (MODE === "timer") {
    remainingMs -= dt;
    
    if (remainingMs <= 0) {
      finishTimer();
      return;
    }
  } else {
    elapsedMs += dt;
    
    const MAX_MS = (99 * 60 + 59) * 1000 + 990;
    if (elapsedMs > MAX_MS) {
      elapsedMs = MAX_MS;
    }
  }
  
  updateDisplay();
  animationFrameId = requestAnimationFrame(loop);
}

/* -------- Control Handlers -------- */
function handleControl(payload) {
  const action = String(payload?.action || "").toLowerCase();
  
  console.log(`🎮 [TIMER] Control: ${action}`, payload);
  
  if (action === "set_mode") {
    const newMode = String(payload?.mode || "").toLowerCase();
    if (newMode === "chrono" || newMode === "timer") {
      MODE = newMode;
      resetEngine();
      console.log(`🔄 [TIMER] Mode changé: ${MODE}`);
    }
    return;
  }
  
  if (action === "set_time") {
    const seconds = parseInt(payload?.seconds, 10);
    if (Number.isFinite(seconds) && seconds >= 0) {
      const ms = clamp(seconds * 1000, 0, 99 * 60 * 1000 + 59 * 1000);
      
      if (MODE === "timer") {
        remainingMs = ms;
      } else {
        elapsedMs = 0;
      }
      
      if (STATE !== "running") {
        STATE = "idle";
      }
      
      updateDisplay();
      console.log(`⏱️ [TIMER] Temps configuré: ${seconds}s`);
    }
    return;
  }
  
  if (action === "increment_time" || action === "decrement_time") {
    if (STATE === "running") {
      console.warn("⚠️ [TIMER] Modification interdite pendant run");
      return;
    }
    
    const deltaSeconds = parseInt(payload?.seconds, 10);
    if (Number.isFinite(deltaSeconds)) {
      const deltaMs = deltaSeconds * 1000;
      
      if (MODE === "timer") {
        remainingMs = clamp(remainingMs + deltaMs, 0, 99 * 60 * 1000 + 59 * 1000);
      }
      
      updateDisplay();
      console.log(`➕➖ [TIMER] Ajusté: ${deltaSeconds > 0 ? '+' : ''}${deltaSeconds}s`);
    }
    return;
  }
  
  if (action === "start") {
    startEngine();
    return;
  }
  
  if (action === "pause") {
    pauseEngine();
    return;
  }
  
  if (action === "toggle_pause") {
    togglePause();
    return;
  }
  
  if (action === "reset") {
    resetEngine();
    return;
  }
}

/* -------- Socket.io -------- */
const socket = io(SERVER_URL, {
  transports: ["websocket", "polling"],
  reconnection: true,
  reconnectionAttempts: 20
});

socket.on("overlay:state", (payload) => {
  if (payload?.overlay !== OVERLAY_TYPE) return;

  console.log(`📡 [TIMER] État:`, payload.state, payload.data);
  STATE = payload.state;

  if (STATE === "idle") {
    elApp.classList.remove("show");
    setTimeout(() => {
      elApp.classList.add("hidden");
      resetEngine();
    }, 800);
    return;
  }

  if (STATE === "active") {
    elSecurity.classList.add("hidden");
    elApp.classList.remove("hidden");
    requestAnimationFrame(() => elApp.classList.add("show"));

    if (payload.data) {
      if (payload.data.mode) {
        MODE = payload.data.mode;
      }
      if (payload.data.seconds != null) {
        const ms = payload.data.seconds * 1000;
        if (MODE === "timer") {
          remainingMs = ms;
        } else {
          elapsedMs = 0;
        }
      }
    }

    updateDisplay();
  }
});

socket.on("control:timer_chrono", (payload) => {
  handleControl(payload || {});
});

socket.on("overlay:forbidden", (payload) => {
  console.error("❌ [TIMER] Accès refusé:", payload?.reason);
  elSecurity.classList.remove("hidden");
  elApp.classList.add("hidden");
});

/* -------- Auth (OBS CSS vars) -------- */
async function init() {
  await new Promise(resolve => setTimeout(resolve, 800));

  const authMode = cssVar("--auth-mode", "strict");
  const room = cssVar("--room-id", "").trim();
  const key = cssVar("--room-key", "").trim();

  console.log(`🔐 [TIMER] Auth: ${authMode}, Room: ${room}`);

  if (!room) {
    console.error("❌ [TIMER] Aucun room-id");
    elSecurity.classList.remove("hidden");
    return;
  }

  if (authMode === "strict") {
    if (!key) {
      console.error("❌ [TIMER] Mode strict sans key");
      elSecurity.classList.remove("hidden");
      return;
    }
    socket.emit("overlay:join", { room, key, overlay: OVERLAY_TYPE });
  } else {
    socket.emit("overlay:join", { room, key: "", overlay: OVERLAY_TYPE });
  }

  console.log("✅ [TIMER] Auth envoyée");
}

socket.on("connect", init);
