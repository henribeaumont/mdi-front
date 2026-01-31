/**
 * MDI EMOJIS TORNADO - V6.2 SaaS (TRUE TORNADO + PROPORTIONS + SEED)
 * Overlay : emojis_tornado
 *
 * Ajouts V6.2 :
 * - Seed emojis configurables via CSS OBS (démarrage non vide si voulu)
 * - Proportionnalité plus fidèle (zéro fallback polluant)
 * - Turnover plus rapide => proportions visibles plus proches du chat
 * - Croix rouge gérée en CSS (fiable)
 *
 * Sécurité :
 * - auth via CSS OBS --room-id / --room-key
 * - overlay:join => overlay:state (OK) / overlay:forbidden (DENIED)
 * - anti-flicker : container hidden jusqu'à overlay:state
 */

const SERVER_URL   = "https://magic-digital-impact-live.onrender.com";
const OVERLAY_TYPE = "emojis_tornado";

/* =========================
   CSS VARS
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
   EMOJI EXTRACTION
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

  if (typeof Intl !== "undefined" && Intl.Segmenter) {
    const seg = new Intl.Segmenter("fr", { granularity: "grapheme" });
    const out = [];
    for (const part of seg.segment(s)) {
      const g = part.segment;
      if (isProbablyEmojiSegment(g)) out.push(g);
    }
    return out;
  }

  try {
    const re = /\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*/gu;
    return Array.from(s.matchAll(re)).map(m => m[0]);
  } catch {
    const re2 = /[\u2190-\u3299\u{1F000}-\u{1FAFF}]/gu;
    return s.match(re2) || [];
  }
}

/* =========================
   CONFIG
========================= */
function parseEmojiCSV(csv) {
  const raw = String(csv || "").split(",").map(x => x.trim()).filter(Boolean);
  // On ne conserve que les segments emojis
  const out = [];
  for (const item of raw) {
    const ems = extractEmojisFromText(item);
    if (ems.length) out.push(ems[0]); // un emoji par item
  }
  return out;
}

function readConfig() {
  const density = clamp(cssNum("--tornado-density", 0.30), 0.05, 1.0);
  const width   = clamp(cssNum("--tornado-width", 0.40), 0.10, 1.0);
  const rise    = clamp(cssNum("--tornado-rise-speed", 1.00), 0.30, 3.0);
  const op      = clamp(cssNum("--emoji-opacity", 0.90), 0.05, 1.0);

  const maxP    = clamp(cssNum("--particle-max", 220), 40, 700);
  const histW   = clamp(cssNum("--history-window", 220), 20, 2000);

  const onlyEmoji = cssBool("--only-emoji-messages", true);
  const autoReset = cssBool("--auto-reset", false);

  const seedEnabled = cssBool("--seed-enabled", true);
  const seedEmojis  = parseEmojiCSV(cssVar("--seed-emojis", "✨,🔥,❤️,😂"));
  const seedMode    = (cssVar("--seed-mode", "blend") || "blend").toLowerCase(); 
  // "seed-only" | "blend" | "chat-only"

  return { density, width, rise, op, maxP, histW, onlyEmoji, autoReset, seedEnabled, seedEmojis, seedMode };
}

let CONFIG = readConfig();

/* =========================
   DISTRIBUTIONS
   A) chatDistribution : fenêtre glissante d'emojis vus dans le chat
   B) seedDistribution : liste fixe au démarrage (optionnelle)

   Pick strategy :
   - seed-only : on tire uniquement dans la seed
   - chat-only : uniquement chat (tornade vide tant que chat vide)
   - blend     : chat prioritaire, seed en secours si chat vide
========================= */
const chatCounts = new Map();
let chatTotal = 0;
const chatQueue = [];

function chatAddEmojis(emojis) {
  CONFIG = readConfig();
  const limit = CONFIG.histW;

  for (const e of emojis) {
    chatQueue.push(e);
    chatCounts.set(e, (chatCounts.get(e) || 0) + 1);
    chatTotal++;

    while (chatQueue.length > limit) {
      const old = chatQueue.shift();
      const prev = chatCounts.get(old) || 0;
      if (prev <= 1) chatCounts.delete(old);
      else chatCounts.set(old, prev - 1);
      chatTotal = Math.max(0, chatTotal - 1);
    }
  }
}

function pickWeightedFromMap(map, total) {
  if (total <= 0) return null;
  const r = Math.random() * total;
  let acc = 0;
  for (const [emoji, c] of map.entries()) {
    acc += c;
    if (r <= acc) return emoji;
  }
  // fallback de sécurité
  return map.keys().next().value || null;
}

function pickFromSeedList(seedList) {
  if (!seedList || seedList.length === 0) return null;
  return seedList[Math.floor(Math.random() * seedList.length)];
}

function pickEmoji() {
  CONFIG = readConfig();

  const hasChat = chatTotal > 0 && chatCounts.size > 0;
  const hasSeed = CONFIG.seedEnabled && CONFIG.seedEmojis.length > 0;

  if (CONFIG.seedMode === "seed-only") {
    return hasSeed ? pickFromSeedList(CONFIG.seedEmojis) : null;
  }

  if (CONFIG.seedMode === "chat-only") {
    return hasChat ? pickWeightedFromMap(chatCounts, chatTotal) : null;
  }

  // blend (par défaut) : chat si dispo, seed sinon
  if (hasChat) return pickWeightedFromMap(chatCounts, chatTotal);
  return hasSeed ? pickFromSeedList(CONFIG.seedEmojis) : null;
}

/* =========================
   RENDER / PHYSIQUE TORNADO
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
 * Particule pseudo-3D :
 * - y monte
 * - angle tourne
 * - z profondeur : taille, vitesse, alpha, parallax
 * - taille varie en fonction de la progression (donne du relief)
 */
const particles = [];

function spawnBatch(count) {
  CONFIG = readConfig();
  const { width, rise, maxP } = CONFIG;

  const cx = W * 0.5;
  const baseY = H * 1.05;
  const topY  = H * -0.15;

  const radiusMax = (W * 0.28) * width;

  for (let i = 0; i < count; i++) {
    if (particles.length >= maxP) break;

    const emoji = pickEmoji();
    if (!emoji) break; // rien à spawn (chat vide + seed off)

    const z = Math.random();
    const angle = rand(0, Math.PI * 2);
    const y = baseY + rand(0, H * 0.25);

    const radius = rand(radiusMax * 0.20, radiusMax) * (0.35 + 0.65 * z);

    // montée : plus proche => un peu plus rapide
    const vy = (H * 0.13) * rise * (0.65 + 0.55 * z); // px/sec

    // rotation : plus proche => plus de “vortex”
    const spin = rand(1.6, 3.6) * (0.55 + 0.9 * z);

    // turnover (important pour proportions visibles)
    // plus rise est grand, plus la vie est courte pour renouveler vite
    const life = clamp(rand(2.2, 3.4) / (0.75 + 0.35 * rise), 1.2, 4.0);

    const baseSize = (18 + z * 44); // px
    particles.push({
      emoji,
      y, baseY, topY,
      angle,
      radius,
      vy,
      spin,
      z,
      baseSize,
      wobble: rand(0.7, 1.9),
      wobbleSpeed: rand(0.7, 1.7),
      age: 0,
      life
    });
  }
}

function step(dt) {
  CONFIG = readConfig();
  const { op, width, rise, density } = CONFIG;

  ctx.clearRect(0, 0, W, H);

  // tri profondeur (loin => proche)
  particles.sort((a, b) => a.z - b.z);

  const cx = W * 0.5;
  const radiusMax = (W * 0.28) * width;

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.age += dt;

    // monte
    p.y -= p.vy * dt;
    p.angle += p.spin * dt;

    // expire par âge ou hors champ
    if (p.age >= p.life || p.y < p.topY) {
      particles.splice(i, 1);
      continue;
    }

    // wobble
    const wob = Math.sin((p.y * 0.008) + performance.now() * 0.0015 * p.wobbleSpeed) * (10 * p.wobble);

    // radius dynamique (borné)
    const r = clamp(p.radius + wob, radiusMax * 0.12, radiusMax);

    // projection 2D + parallax
    const x = cx + Math.cos(p.angle) * r * (0.65 + 0.35 * p.z);
    const y = p.y;

    // alpha profondeur
    const depthAlpha = 0.35 + 0.65 * p.z;

    // taille varie pendant ascension (grossit puis rétrécit)
    const progress = clamp((p.baseY - p.y) / (p.baseY - p.topY), 0, 1);
    const sizePulse = 0.82 + 0.30 * Math.sin(progress * Math.PI);
    const size = p.baseSize * sizePulse;

    ctx.save();
    ctx.globalAlpha = op * depthAlpha;

    ctx.translate(x, y);
    ctx.rotate(Math.sin(p.angle) * 0.08);

    ctx.font = `${Math.floor(size)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji", ui-sans-serif, system-ui`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(p.emoji, 0, 0);

    ctx.restore();
  }

  // Tornade continue : cible adaptative
  // NOTE: si pas d’emojis (chat vide + seed off), target = 0 => overlay vide (volontaire)
  const canSpawn = !!pickEmoji();
  const baseTarget = Math.floor((W * H) / 45000 * density * (0.95 + 0.45 * rise));
  const target = canSpawn ? baseTarget : 0;

  const missing = Math.max(0, target - particles.length);
  if (missing > 0) {
    // spawn lissé
    spawnBatch(Math.min(22, missing));
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

/* =========================
   SOCKET + AUTH
========================= */
const socket = io(SERVER_URL, { transports: ["websocket", "polling"] });

async function init() {
  await new Promise(r => setTimeout(r, 650)); // injection CSS OBS

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
      chatCounts.clear();
      chatQueue.length = 0;
      chatTotal = 0;
    }

    // apparition après validation serveur
    showOverlay();
    start();
  });

  socket.on("raw_vote", (data) => {
    const voteText = (data?.vote ?? "").toString().trim();
    if (!voteText) return;

    const emojis = extractEmojisFromText(voteText);

    CONFIG = readConfig();
    if (CONFIG.onlyEmoji && emojis.length === 0) return;

    if (emojis.length > 0) {
      // 🔥 Alimente la distribution chat => proportions
      chatAddEmojis(emojis);

      // boost immédiat (sans casser proportions : ça ne modifie pas les stats, juste l'affichage rapide)
      spawnBatch(Math.min(14, emojis.length * 4));
    }
  });

  socket.on("overlay:reset", () => {
    particles.length = 0;
    chatCounts.clear();
    chatQueue.length = 0;
    chatTotal = 0;
  });
}

init();
