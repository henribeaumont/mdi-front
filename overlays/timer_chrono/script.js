/**
 * ============================================================
 * MDI TIMER/CHRONO V2.0
 * ============================================================
 * ✅ Auth stricte hardcodée (pas de --auth-mode)
 * ✅ Mode TIMER : MM:SS (compte à rebours)
 * ✅ Mode CHRONO : MM:SS:CC (centièmes haute précision 10ms)
 * ✅ Pilotage télécommande + Stream Deck
 * ✅ Boutons +/- désactivés pendant run
 * ✅ Panel responsive au contenu
 * ✅ Fondu entrée/sortie
 * ============================================================ */

const SERVER_URL = "https://magic-digital-impact-live.onrender.com";
const OVERLAY_TYPE = "timer_chrono";

/* ============================================================
   HELPERS CSS OBS
   ============================================================ */
function cssVar(name, fallback = "") {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name);
  return v ? v.trim().replace(/^['"]+|['"]+$/g, "") : fallback;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

/* ============================================================
   DOM ELEMENTS
   ============================================================ */
const elSecurity = document.getElementById("security-screen");
const elApp = document.getElementById("app");
const elPanel = document.getElementById("panel");
const elTime = document.getElementById("time");

function showDenied() {
  elApp.classList.add("hidden");
  elSecurity.classList.remove("hidden");
  document.body.style.backgroundColor = "black";
}

function showReady() {
  elSecurity.classList.add("hidden");
  elApp.classList.remove("hidden");
  elApp.classList.add("show");
  document.body.style.backgroundColor = "transparent";
}

/* ============================================================
   STATE
   ============================================================ */
let MODE = "timer"; // "timer" | "chrono"
let STATE = "idle"; // "idle" | "running" | "paused" | "done"

// Timer : remainingMs (millisecondes restantes)
// Chrono : elapsedMs (millisecondes écoulées)
let remainingMs = 60000; // 1 minute par défaut
let elapsedMs = 0;

let lastTickTime = 0;
let animationFrameId = null;

/* ============================================================
   FORMATTING
   ============================================================ */
function pad2(n) {
  return String(n).padStart(2, "0");
}

function formatTimer(ms) {
  // TIMER : MM:SS (toujours)
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const mm = Math.floor(totalSec / 60);
  const ss = totalSec % 60;
  return `${pad2(mm)}:${pad2(ss)}`;
}

function formatChrono(ms) {
  // CHRONO : MM:SS:CC (centièmes plus petits)
  const totalMs = Math.max(0, Math.floor(ms));
  const totalSec = Math.floor(totalMs / 1000);
  const mm = Math.floor(totalSec / 60);
  const ss = totalSec % 60;
  const cc = Math.floor((totalMs % 1000) / 10); // Centièmes (0-99)
  
  return `${pad2(mm)}:${pad2(ss)}:<span class="centimes">${pad2(cc)}</span>`;
}

function updateDisplay() {
  if (MODE === "timer") {
    elTime.textContent = formatTimer(remainingMs);
  } else {
    elTime.innerHTML = formatChrono(elapsedMs);
  }
}

/* ============================================================
   ENGINE (HAUTE PRÉCISION 10ms)
   ============================================================ */
function resetEngine() {
  STATE = "idle";
  elapsedMs = 0;
  remainingMs = 60000; // Reset au temps par défaut (sera écrasé par serveur)
  
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
  if (STATE === "done" && MODE === "timer") {
    console.warn("⚠️ [TIMER] Timer fini, reset d'abord");
    return;
  }
  
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
  
  // Animation pulse
  elPanel.classList.remove("is-done");
  void elPanel.offsetWidth; // Force reflow
  elPanel.classList.add("is-done");
  
  console.log("🏁 [TIMER] Fini !");
}

function loop(timestamp) {
  if (STATE !== "running") return;
  
  const dt = timestamp - lastTickTime;
  lastTickTime = timestamp;
  
  if (MODE === "timer") {
    // Timer : décrémenter
    remainingMs -= dt;
    
    if (remainingMs <= 0) {
      finishTimer();
      return;
    }
  } else {
    // Chrono : incrémenter
    elapsedMs += dt;
    
    // Limite max : 99:59:99
    const MAX_MS = (99 * 60 + 59) * 1000 + 990; // 99:59:99
    if (elapsedMs > MAX_MS) {
      elapsedMs = MAX_MS;
    }
  }
  
  updateDisplay();
  animationFrameId = requestAnimationFrame(loop);
}

/* ============================================================
   SOCKET.IO CONTROL HANDLERS
   ============================================================ */
function handleControl(payload) {
  const action = String(payload?.action || "").toLowerCase();
  
  console.log(`🎮 [TIMER] Control: ${action}`, payload);
  
  // === MODE ===
  if (action === "set_mode") {
    const newMode = String(payload?.mode || "").toLowerCase();
    if (newMode === "chrono" || newMode === "timer") {
      MODE = newMode;
      resetEngine();
      console.log(`🔄 [TIMER] Mode changé: ${MODE}`);
    }
    return;
  }
  
  // === SET TIME (en secondes) ===
  if (action === "set_time") {
    const seconds = parseInt(payload?.seconds, 10);
    if (Number.isFinite(seconds) && seconds >= 0) {
      const ms = clamp(seconds * 1000, 0, 99 * 60 * 1000 + 59 * 1000); // Max 99:59
      
      if (MODE === "timer") {
        remainingMs = ms;
      } else {
        elapsedMs = 0; // Chrono démarre toujours à 0
      }
      
      // Si en cours, on garde running, sinon idle
      if (STATE !== "running") {
        STATE = "idle";
      }
      
      updateDisplay();
      console.log(`⏱️ [TIMER] Temps configuré: ${seconds}s`);
    }
    return;
  }
  
  // === INCREMENT/DECREMENT (désactivé si running) ===
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
      // Chrono : pas d'incrément (démarre toujours à 0)
      
      updateDisplay();
      console.log(`➕➖ [TIMER] Ajusté: ${deltaSeconds > 0 ? '+' : ''}${deltaSeconds}s`);
    }
    return;
  }
  
  // === START ===
  if (action === "start") {
    startEngine();
    return;
  }
  
  // === PAUSE ===
  if (action === "pause") {
    pauseEngine();
    return;
  }
  
  // === TOGGLE PAUSE ===
  if (action === "toggle_pause") {
    togglePause();
    return;
  }
  
  // === RESET ===
  if (action === "reset") {
    resetEngine();
    return;
  }
}

/* ============================================================
   SOCKET.IO CONNECTION
   ============================================================ */
let socket = null;

async function init() {
  // Attendre injection CSS OBS
  await new Promise(resolve => setTimeout(resolve, 800));
  
  // Auth stricte TOUJOURS (hardcodée)
  const room = cssVar("--room-id", "").trim();
  const key = cssVar("--room-key", "").trim();
  
  console.log(`🔐 [TIMER] Auth: Room=${room}`);
  
  if (!room || !key) {
    console.error("❌ [TIMER] Room ou Key manquante");
    showDenied();
    return;
  }
  
  // Reset initial
  resetEngine();
  
  // Connexion Socket.io
  socket = io(SERVER_URL, {
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: 20
  });
  
  socket.on("connect", () => {
    console.log("✅ [TIMER] Connecté au serveur");
    socket.emit("overlay:join", { room, key, overlay: OVERLAY_TYPE });
  });
  
  socket.on("overlay:forbidden", (payload) => {
    console.error("❌ [TIMER] Accès refusé:", payload?.reason);
    showDenied();
  });
  
  socket.on("overlay:state", (payload) => {
    if (payload?.overlay !== OVERLAY_TYPE) return;
    
    console.log("📡 [TIMER] État reçu:", payload.state, payload.data);
    
    // Si idle, masquer
    if (payload.state === "idle") {
      elApp.classList.remove("show");
      setTimeout(() => {
        resetEngine();
      }, 800);
      return;
    }
    
    // Si active, afficher
    if (payload.state === "active") {
      showReady();
      
      // Appliquer config serveur si présente
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
      
      resetEngine();
      updateDisplay();
    }
  });
  
  // Event control dédié timer
  socket.on("control:timer_chrono", (payload) => {
    handleControl(payload || {});
  });
}

init();
