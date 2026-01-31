/**
 * MDI EMOJIS TORNADO - V6.1 SaaS (TRUE TORNADO)
 * Overlay : emojis_tornado
 *
 * Objectifs :
 * - Tornade continue (pas un spawn ponctuel)
 * - Répartition proportionnelle selon les emojis vus dans le chat (fenêtre glissante)
 * - Profondeur 3D : taille + parallax + variation de taille à l'ascension
 * - CSS OBS : vitesse ascension / largeur / transparence / densité
 *
 * Sécurité :
 * - auth via CSS OBS --room-id / --room-key
 * - overlay:join => overlay:state (OK) / overlay:forbidden (DENIED)
 * - anti-flicker : container hidden jusqu'à overlay:state
 */

const SERVER_URL   = "https://magic-digital-impact-live.onrender.com";
const OVERLAY_TYPE = "emojis_tornado";

/* =========================
   UTILITAIRES CSS VAR
========================= */
function cssVar(name, fallback = "") {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name);
  if (!v) return fallback;
  return v.trim().replace(/^['"]+|['"]+$/g, "");
}
function cssNum(name, fallback) {
  const v = cssVar(name, "");
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function cssBool(name, fallback = false) {
  const v = cssVar(name, "");
  if (!v) return fallback;
  return v === "true" || v === "on" || v === "1";
}
function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
function rand(a, b) { return a + Math.random() * (b - a); }

/* =========================
   UI
========================= */
function showSecurityDenied() {
  document.getElementById("container").classList.add("hidden");
  document.getElementById("security-screen").classList.remove("hidden");
  document.body.style.backgroundColor = "rgba(0,0,0,1)";
}
function showOverlay() {
  document.getElementById("security-screen").classList.add("hidden");
  document.getElementById("container").classList.remove("hidden");
  document.body.style.backgroundColor = "transparent";
}

/* =========================
   EMOJI EXTRACTION ROBUSTE
========================= */
function isProbablyEmojiSegment(seg) {
  if (!seg) return false;
  const s = String(seg).trim();
  if (!s) return false;
  try {
    return /\p{Extended_Pictographic}/u.test(s);
  } catch {
    return /[\u2190-\u3299\u{1F000}-\u{1FAFF}]/u.test(s);
  }
}

function extractEmojisFromText(text) {
  if (!text) return [];
  const s = String(text);

  // Grapheme segmentation = meilleur pour ZWJ/variations
  if (typeof Intl !== "undefined" && Intl.Segmenter) {
    const seg = new Intl.Segmenter("fr", { granularity: "grapheme" });
    const out = [];
    for (const part of seg.segment(s)) {
      const g = part.segment;
      if (isProbablyEmojiSegment(g)) out.push(g);
    }
    return out;
  }

  // fallback regex
  try {
    const re = /\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*/gu;
    return Array.from(s.matchAll(re)).map(m => m[0]);
  } catch {
    const re2 = /[\u2190-\u3299\u{1F000}-\u{1FAFF}]/gu;
    return s.match(re2) || [];
  }
}

/* =========================
   CONFIG (depuis CSS OBS)
========================= */
function readConfig() {
  const density = clamp(cssNum("--tornado-density", 0.30), 0.05, 1.0);
  const width   = clamp(cssNum("--tornado-width", 0.40), 0.10, 1.0);
  const rise    = clamp(cssNum("--tornado-rise-speed", 1.00), 0.30, 3.0);
  const op      = clamp(cssNum("--emoji-opacity", 0.90), 0.05, 1.0);

  const maxP    = clamp(cssNum("--particle-max", 220), 40, 600);
  const histW   = clamp(cssNum("--history-window", 220), 30, 1000);

  const onlyEmoji = cssBool("--only-emoji-messages", true);
  const autoReset = cssBool("--auto-reset", false);

  return { density, width, rise, op, maxP, histW, onlyEmoji, autoReset };
}

let CONFIG = readConfig();

/* =========================
   DISTRIBUTION PROPORTIONNELLE
   - on maintient une fenêtre glissante des emojis reçus
   - on tire au hasard pondéré selon les occurrences
========================= */
const emojiCounts = new Map();   // emoji => count
let totalEmojiCount = 0;
const emojiHistoryQueue = [];    // liste des emojis vus (fenêtre glissante)

/**
 * Ajoute une liste d'emojis à la distribution (fenêtre glissante)
 */
function feedEmojiStats(emojis) {
  CONFIG = readConfig();
  const limit = CONFIG.histW;

  for (const e of emojis) {
    // add
    emojiHistoryQueue.push(e);
    emojiCounts.set(e, (emojiCounts.get(e) || 0) + 1);
    totalEmojiCount++;

    // trim window
    while (emojiHistoryQueue.length > limit) {
      const old = emojiHistoryQueue.shift();
      const prev = emojiCounts.get(old) || 0;
      if (prev <= 1) emojiCounts.delete(old);
      else emojiCounts.set(old, prev - 1);
      totalEmojiCount = Math.max(0, totalEmojiCount - 1);
    }
  }
}

/**
 * Tirage pondéré : respecte les proportions
 * Fallback : si pas de stats => étincelle par défaut
 */
function pickEmojiWeighted() {
  if (totalEmojiCount <= 0 || emojiCounts.size === 0) return "✨";
  const r = Math.random() * totalEmojiCount;
  let acc = 0;
  for (const [emoji, c] of emojiCounts.entries()) {
    acc += c;
    if (r <= acc) return emoji;
  }
  // fallback de sécurité
  return emojiCounts.keys().next().value || "✨";
}

/* =========================
   MOTEUR "TORNADE CONTINUE" + "PROFONDEUR"
========================= */
const canvas = document.getElementById("stage");
const ctx = canvas.getContext("2d", { alpha: true });

let W = 1920, H = 1080, DPR = 1;

function resize() {
  DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  W = Math.floor(window.innerWidth);
  H = Math.floor(window.innerHeight);
  canvas.width = Math.floor(W * DPR);
  canvas.height = Math.floor(H * DPR);
  canvas.style.width = W + "px";
  canvas.style.height = H + "px";
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
window.addEventListener("resize", resize);
resize();

/**
 * Particule (pseudo 3D):
 * - y monte de bas -> haut
 * - angle tourne autour de l'axe (vortex)
 * - radius dépend de width + "z" (profondeur)
 * - z (0..1) : 0 = loin (petit, bouge moins), 1 = proche (grand, bouge plus)
 * - size évolue pendant l'ascension (donne de la profondeur)
 */
const particles = [];

function spawnContinuous(count) {
  CONFIG = readConfig();
  const { width, rise, maxP } = CONFIG;

  const cx = W * 0.5;
  const baseY = H * 1.05;          // un peu sous l’écran
  const topY  = H * -0.15;         // un peu au-dessus

  for (let i = 0; i < count; i++) {
    if (particles.length >= maxP) break;

    const emoji = pickEmojiWeighted();

    const z = Math.random();                // profondeur
    const angle = rand(0, Math.PI * 2);
    const y = baseY + rand(0, H * 0.25);

    const radiusMax = (W * 0.28) * width;
    const radius = rand(radiusMax * 0.20, radiusMax) * (0.35 + 0.65 * z);

    // vitesse : plus proche => plus rapide légèrement
    const vy = (H * 0.10) * rise * (0.65 + 0.55 * z); // px/sec
    const spin = rand(1.4, 3.2) * (0.55 + 0.9 * z);   // rad/sec

    // taille base: varie selon profondeur
    const baseSize = (18 + z * 42) * (0.85 + 0.3 * rise); // px

    particles.push({
      emoji,
      y, baseY, topY,
      cx,
      angle,
      radius,
      vy,
      spin,
      z,
      baseSize,
      wobble: rand(0.6, 1.6),
      wobbleSpeed: rand(0.6, 1.5),
      life: rand(3.0, 5.0)
    });
  }
}

function step(dt) {
  CONFIG = readConfig();
  const { op, width, rise } = CONFIG;

  ctx.clearRect(0, 0, W, H);

  // tri par profondeur : loin d’abord, proche ensuite (effet 3D)
  particles.sort((a, b) => a.z - b.z);

  const cx = W * 0.5;
  const radiusMax = (W * 0.28) * width;

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];

    // montée
    p.y -= p.vy * dt;

    // rotation vortex
    p.angle += p.spin * dt;

    // petit wobble (tremblement latéral)
    const wob = Math.sin((p.y * 0.008) + performance.now() * 0.0015 * p.wobbleSpeed) * (10 * p.wobble);

    // recalcul radius selon profondeur (et légère variation)
    const r = clamp(p.radius + wob, radiusMax * 0.12, radiusMax);

    // position 2D projetée
    const x = cx + Math.cos(p.angle) * r * (0.65 + 0.35 * p.z);
    const y = p.y;

    // alpha : loin => plus transparent, proche => plus opaque
    const depthAlpha = 0.35 + 0.65 * p.z;

    // variation de taille pendant l'ascension :
    // en bas -> un peu plus gros, en haut -> un peu plus petit (effet perspective)
    const progress = clamp((p.baseY - p.y) / (p.baseY - p.topY), 0, 1);
    const sizePulse = 0.85 + 0.25 * Math.sin(progress * Math.PI); // grossit au milieu
    const size = p.baseSize * sizePulse;

    // culling : hors écran haut
    if (p.y < p.topY) {
      particles.splice(i, 1);
      continue;
    }

    // draw
    ctx.save();
    ctx.globalAlpha = op * depthAlpha;
    ctx.translate(x, y);
    // rotation légère pour “vivant”
    ctx.rotate(Math.sin(p.angle) * 0.08);
    ctx.font = `${Math.floor(size)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji", ui-sans-serif, system-ui`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(p.emoji, 0, 0);
    ctx.restore();
  }

  // maintien d'une tornade continue :
  // target = densité * surface (adaptatif à la taille écran) + rise (plus vite => plus d’émission)
  const target = Math.floor((W * H) / 45000 * CONFIG.density * (0.9 + 0.4 * rise));
  const missing = Math.max(0, target - particles.length);

  // spawn par petits paquets pour lisser
  if (missing > 0) {
    spawnContinuous(Math.min(18, missing));
  }
}

/* boucle */
let running = false;
let lastT = performance.now();
let rafId = null;

function loop(now) {
  const dt = Math.min(0.033, (now - lastT) / 1000);
  lastT = now;
  step(dt);
  rafId = requestAnimationFrame(loop);
}
function start() {
  if (running) return;
  running = true;
  lastT = performance.now();
  rafId = requestAnimationFrame(loop);
}
function stop() {
  running = false;
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;
}

/* =========================
   SOCKET + AUTH
========================= */
const socket = io(SERVER_URL, { transports: ["websocket", "polling"] });

async function init() {
  await new Promise(r => setTimeout(r, 600)); // injection CSS OBS

  const authMode = (cssVar("--auth-mode", "strict") || "strict").toLowerCase();
  const room = cssVar("--room-id", "");
  const key  = cssVar("--room-key", "");

  if (authMode === "strict") {
    if (!room || !key) { showSecurityDenied(); return; }
  } else {
    if (!room) { showSecurityDenied(); return; }
  }

  socket.emit("overlay:join", { room, key, overlay: OVERLAY_TYPE });

  socket.on("overlay:forbidden", () => {
    showSecurityDenied();
  });

  socket.on("overlay:state", (payload) => {
    if (payload?.overlay !== OVERLAY_TYPE) return;

    CONFIG = readConfig();
    if (CONFIG.autoReset) {
      particles.length = 0;
      emojiCounts.clear();
      emojiHistoryQueue.length = 0;
      totalEmojiCount = 0;
    }

    // ✅ Anti-flicker : apparition seulement après validation serveur
    showOverlay();
    start();
  });

  socket.on("raw_vote", (data) => {
    const voteText = (data?.vote ?? "").toString().trim();
    if (!voteText) return;

    const emojis = extractEmojisFromText(voteText);

    CONFIG = readConfig();
    if (CONFIG.onlyEmoji && emojis.length === 0) return;

    // Alimente la distribution => modifie la tornade en temps réel (proportions)
    if (emojis.length > 0) {
      feedEmojiStats(emojis);
      // Petit boost instantané quand un message emoji arrive
      spawnContinuous(Math.min(10, emojis.length * 3));
    }
  });

  socket.on("overlay:reset", () => {
    particles.length = 0;
    emojiCounts.clear();
    emojiHistoryQueue.length = 0;
    totalEmojiCount = 0;
  });
}

init();
