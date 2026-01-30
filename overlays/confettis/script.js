/**
 * MDI - CONFETTI OVERLAY (V5.5 SaaS Pro)
 * - Supporte les mots déclencheurs depuis le chat
 * - Paramétrage intégral via CSS OBS
 */

const ADRESSE_SERVEUR = "https://magic-digital-impact-live.onrender.com";
const OVERLAY_TYPE = "confetti";

// ---------- CSS helpers (Extraction des réglages OBS) ----------
function cssVar(name, fallback = "") {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name);
  return (v || "").trim() || fallback;
}
function stripQuotes(s) {
  return String(s || "").trim().replace(/^['"]+|['"]+$/g, "");
}
function lower(s) {
  return stripQuotes(s).toLowerCase();
}
function cssInt(name, fallback) {
  const v = parseInt(stripQuotes(cssVar(name, "")), 10);
  return Number.isFinite(v) ? v : fallback;
}
function cssNum(name, fallback) {
  const v = parseFloat(stripQuotes(cssVar(name, "")));
  return Number.isFinite(v) ? v : fallback;
}
function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
function parseColors(raw, fallbackColors) {
  const s = stripQuotes(raw);
  if (!s) return fallbackColors;
  const parts = s.split(",").map((x) => x.trim()).filter(Boolean);
  return parts.length ? parts : fallbackColors;
}
function randomInRange(min, max) {
  return Math.random() * (max - min) + min;
}

// ---------- Auth config (Lecture CSS OBS) ----------
function readConfig() {
  const room = stripQuotes(cssVar("--room-id", "DEMO_CLIENT"));
  const key = stripQuotes(cssVar("--room-key", ""));
  const authMode = lower(cssVar("--auth-mode", "strict"));
  const triggers = stripQuotes(cssVar("--confetti-triggers", "BRAVO,MERCI,TOP,WOW,GG,FEU"));
  
  return { room, key, overlay: OVERLAY_TYPE, authMode, triggers: triggers.toUpperCase().split(",") };
}

// ---------- Gestion de l'affichage / Sécurité ----------
let estAutorise = false;
let hardForbidden = false;

function showSecurity(show) {
  const deny = document.getElementById("security-screen");
  if (!deny) return;
  if (show) {
    deny.classList.remove("hidden");
    document.documentElement.classList.add("mdi-locked");
  } else {
    deny.classList.add("hidden");
    document.documentElement.classList.remove("mdi-locked");
  }
}

function hardLock() {
  hardForbidden = true;
  estAutorise = false;
  showSecurity(true);
}

function unlock() {
  if (hardForbidden) return;
  estAutorise = true;
  showSecurity(false);
}

// ---------- Moteur Confetti (Canvas) ----------
const myCanvas = document.getElementById("my-canvas");
const myConfetti = confetti.create(myCanvas, { resize: true, useWorker: true });

function getCanonList(mode, rainColumns = 9) {
  const cols = clamp(rainColumns, 3, 40);
  switch ((mode || "").toLowerCase()) {
    case "top-sides": return [{ x: 0.08, y: 0.05, angle: 100 }, { x: 0.92, y: 0.05, angle: 80 }];
    case "top-rain":
      let list = [];
      for (let i = 0; i < cols; i++) list.push({ x: (i + 0.5) / cols, y: 0.03, angle: 90 });
      return list;
    case "center": return [{ x: 0.5, y: 0.5, angle: 90 }];
    case "corners+sides":
      return [
        { x: 0.05, y: 0.05, angle: 45 }, { x: 0.95, y: 0.05, angle: 135 },
        { x: 0.05, y: 0.95, angle: 315 }, { x: 0.95, y: 0.95, angle: 225 },
        { x: 0.03, y: 0.5, angle: 0 }, { x: 0.97, y: 0.5, angle: 180 }
      ];
    default: return [{ x: 0.05, y: 0.95, angle: 315 }, { x: 0.95, y: 0.95, angle: 225 }];
  }
}

function lancerCelebration() {
  if (!estAutorise || hardForbidden) return;

  const bursts = clamp(cssInt("--confetti-bursts", 6), 1, 60);
  const duration = clamp(cssInt("--confetti-duration-ms", 2200), 200, 20000);
  const particleCount = clamp(cssInt("--confetti-particle-count", 70), 1, 500);
  const colors = parseColors(cssVar("--confetti-colors", ""), ["#FFD700", "#FF0000", "#00BFFF", "#FFFFFF"]);
  const canons = getCanonList(stripQuotes(cssVar("--confetti-canons", "corners+sides")), cssInt("--confetti-rain-columns", 10));
  
  let fired = 0;
  const gap = Math.floor(duration / bursts);

  const timer = setInterval(() => {
    if (fired >= bursts) return clearInterval(timer);
    
    canons.forEach(c => {
      myConfetti({
        particleCount,
        angle: c.angle,
        spread: cssInt("--confetti-spread", 360),
        origin: { x: c.x, y: c.y },
        colors: colors,
        startVelocity: cssInt("--confetti-start-velocity", 45),
        scalar: randomInRange(cssNum("--confetti-size-min", 1.2), cssNum("--confetti-size-max", 2.2))
      });
    });
    fired++;
  }, gap);
}

// ---------- Initialisation & Sockets ----------
async function start() {
  // Attente pour que OBS injecte les variables CSS
  await new Promise(r => setTimeout(r, 1000));
  const cfg = readConfig();

  const socket = io(ADRESSE_SERVEUR, { transports: ["websocket", "polling"] });

  socket.on("connect", () => {
    socket.emit("overlay:join", { room: cfg.room, key: cfg.key, overlay: cfg.overlay });
  });

  socket.on("overlay:forbidden", (p) => hardLock());
  
  socket.on("overlay:state", (payload) => {
    if (payload?.overlay === cfg.overlay) {
      unlock();
      // Auto-fire au démarrage si configuré
      if (lower(cssVar("--confetti-auto", "off")) === "on") lancerCelebration();
    }
  });

  // Détection des mots dans le chat (Universal)
  socket.on("raw_vote", (data) => {
    const msg = data.vote.toUpperCase().trim();
    if (cfg.triggers.some(t => msg.includes(t.trim()))) {
      lancerCelebration();
    }
  });

  // Compatibilité ancien mode
  socket.on("declencher_explosion", () => lancerCelebration());
}

start().catch(e => console.error("Erreur Confetti:", e));