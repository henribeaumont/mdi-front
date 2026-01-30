/**
 * MDI - CONFETTI OVERLAY (V5.5 SaaS Pro - Fixed Range)
 * - Gestion de la gravité liée au --confetti-range
 * - Détection des mots triggers du chat
 * - Sécurité SaaS Strict
 */

const ADRESSE_SERVEUR = "https://magic-digital-impact-live.onrender.com";
const OVERLAY_TYPE = "confetti";

// ---------- CSS helpers (Extraction OBS) ----------
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

// ---------- Auth & Triggers config ----------
function readConfig() {
  const room = stripQuotes(cssVar("--room-id", "DEMO_CLIENT"));
  const key = stripQuotes(cssVar("--room-key", ""));
  const authMode = lower(cssVar("--auth-mode", "strict"));
  const triggersRaw = stripQuotes(cssVar("--confetti-triggers", "BRAVO,MERCI,TOP,WOW,GG,FEU"));
  
  return { 
    room, 
    key, 
    overlay: OVERLAY_TYPE, 
    authMode, 
    triggers: triggersRaw.toUpperCase().split(",").map(t => t.trim()).filter(Boolean) 
  };
}

// ---------- UI / Sécurité ----------
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

// ---------- Moteur Confetti ----------
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

  // Lecture des paramètres de base
  const bursts = clamp(cssInt("--confetti-bursts", 6), 1, 60);
  const duration = clamp(cssInt("--confetti-duration-ms", 2200), 200, 20000);
  const particleCount = clamp(cssInt("--confetti-particle-count", 70), 1, 500);
  const startVelocityBase = clamp(cssNum("--confetti-start-velocity", 45), 0, 200);
  const ticksBase = clamp(cssInt("--confetti-ticks", 120), 20, 600);
  const colors = parseColors(cssVar("--confetti-colors", ""), ["#FFD700", "#FF0000", "#00BFFF", "#FFFFFF"]);
  const canons = getCanonList(stripQuotes(cssVar("--confetti-canons", "corners+sides")), cssInt("--confetti-rain-columns", 10));

  // --- LOGIQUE PORTÉE (RANGE) CORRIGÉE ---
  const range = clamp(cssNum("--confetti-range", 0.7), 0, 1);
  
  // 1. Vitesse : plus de range = plus de propulsion
  const velocityMul = 0.5 + (range * 1.5);
  const startVelocity = clamp(startVelocityBase * velocityMul, 5, 250);

  // 2. Gravité : plus de range = gravité faible (effet "flottant")
  // Range 1.0 => Gravité 0.3 | Range 0.0 => Gravité 2.0
  const gravity = clamp(2.0 - (range * 1.7), 0.3, 2.0);

  // 3. Durée de vie : on l'augmente pour que les particules ne disparaissent pas trop tôt
  const ticks = clamp(Math.floor(ticksBase * (1 + range)), 20, 1000);

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
        startVelocity: startVelocity,
        gravity: gravity, // Application de la gravité corrigée
        ticks: ticks,
        scalar: randomInRange(cssNum("--confetti-size-min", 1.2), cssNum("--confetti-size-max", 2.2))
      });
    });
    fired++;
  }, gap);
}

// ---------- Initialisation ----------
async function start() {
  await new Promise(r => setTimeout(r, 1000));
  const cfg = readConfig();

  const socket = io(ADRESSE_SERVEUR, { transports: ["websocket", "polling"] });

  socket.on("connect", () => {
    socket.emit("overlay:join", { room: cfg.room, key: cfg.key, overlay: cfg.overlay });
  });

  socket.on("overlay:forbidden", () => hardLock());
  
  socket.on("overlay:state", (payload) => {
    if (payload?.overlay === cfg.overlay) {
      unlock();
      if (lower(cssVar("--confetti-auto", "off")) === "on") lancerCelebration();
    }
  });

  socket.on("raw_vote", (data) => {
    const msg = data.vote.toUpperCase().trim();
    if (cfg.triggers.some(t => msg.includes(t))) {
      lancerCelebration();
    }
  });

  socket.on("declencher_explosion", () => lancerCelebration());
}

start().catch(e => console.error("Confetti Error:", e));
