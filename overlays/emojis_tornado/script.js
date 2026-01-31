const SERVER_URL   = "https://magic-digital-impact-live.onrender.com";
const OVERLAY_TYPE = "emojis_tornado";

/* ===== CSS VARS ===== */
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

/* ===== UI ===== */
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

/* ===== EMOJI EXTRACTION ===== */
function isProbablyEmojiSegment(seg) {
  if (!seg) return false;
  const s = String(seg).trim();
  if (!s) return false;
  try { return /\p{Extended_Pictographic}/u.test(s); }
  catch { return /[\u2190-\u3299\u{1F000}-\u{1FAFF}]/u.test(s); }
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

/* ===== CONFIG ===== */
function parseEmojiCSV(csv) {
  const raw = String(csv || "").split(",").map(x => x.trim()).filter(Boolean);
  const out = [];
  for (const item of raw) {
    const ems = extractEmojisFromText(item);
    if (ems.length) out.push(ems[0]);
  }
  return out;
}
function readConfig() {
  const density = clamp(cssNum("--tornado-density", 0.30), 0.05, 1.0);
  const width   = clamp(cssNum("--tornado-width", 0.40), 0.10, 1.0);
  const rise    = clamp(cssNum("--tornado-rise-speed", 1.00), 0.30, 3.0);
  const op      = clamp(cssNum("--emoji-opacity", 0.90), 0.05, 1.0);
  const height  = clamp(cssNum("--tornado-height", 1.00), 0.30, 1.20);

  const maxP    = clamp(cssNum("--particle-max", 220), 40, 700);
  const histW   = clamp(cssNum("--history-window", 220), 20, 2000);

  const onlyEmoji = cssBool("--only-emoji-messages", true);
  const autoReset = cssBool("--auto-reset", false);

  const seedEnabled = cssBool("--seed-enabled", true);
  const seedEmojis  = parseEmojiCSV(cssVar("--seed-emojis", "✨,🔥,❤️,😂"));
  const seedMode    = (cssVar("--seed-mode", "blend") || "blend").toLowerCase();

  return { density, width, rise, op, height, maxP, histW, onlyEmoji, autoReset, seedEnabled, seedEmojis, seedMode };
}

let CONFIG = readConfig();

/* ===== DISTRIBUTION CHAT ===== */
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

  if (CONFIG.seedMode === "seed-only") return hasSeed ? pickFromSeedList(CONFIG.seedEmojis) : null;
  if (CONFIG.seedMode === "chat-only") return hasChat ? pickWeightedFromMap(chatCounts, chatTotal) : null;

  if (hasChat) return pickWeightedFromMap(chatCounts, chatTotal);
  return hasSeed ? pickFromSeedList(CONFIG.seedEmojis) : null;
}

/* ===== CANVAS ===== */
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

/* ===== PARTICULES ===== */
const particles = [];

/* easing util */
function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function spawnBatch(count) {
  CONFIG = readConfig();
  const { width, rise, height, maxP } = CONFIG;

  const cx = W * 0.5;
  const baseY = H * 1.08;

  // height=1 => topY ~ -0.02H
  const topY  = H * (1 - height) * 1.02 * -1;

  const radiusMax = (W * 0.28) * width;

  for (let i = 0; i < count; i++) {
    if (particles.length >= maxP) break;

    const emoji = pickEmoji();
    if (!emoji) break;

    const z = Math.random();
    const angle = rand(0, Math.PI * 2);
    const y = baseY + rand(0, H * 0.30);

    const radius = rand(radiusMax * 0.20, radiusMax) * (0.35 + 0.65 * z);
    const vy = (H * 0.15) * rise * (0.65 + 0.55 * z);
    const spin = rand(1.6, 3.6) * (0.55 + 0.9 * z);
    const baseSize = (18 + z * 44);

    // ✅ fade params (en % du trajet)
    const fadeInSpan  = rand(0.06, 0.12); // 6% → 12% du trajet
    const fadeOutSpan = rand(0.10, 0.18); // 10% → 18% du trajet

    particles.push({
      emoji,
      y,
      baseY,
      topY,
      angle,
      radius,
      vy,
      spin,
      z,
      baseSize,
      wobble: rand(0.7, 1.9),
      wobbleSpeed: rand(0.7, 1.7),
      fadeInSpan,
      fadeOutSpan
    });
  }
}

function step(dt) {
  CONFIG = readConfig();
  const { op, width, rise, density } = CONFIG;

  ctx.clearRect(0, 0, W, H);

  particles.sort((a, b) => a.z - b.z);

  const cx = W * 0.5;
  const radiusMax = (W * 0.28) * width;

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];

    p.y -= p.vy * dt;
    p.angle += p.spin * dt;

    // progress 0 (bas) → 1 (haut)
    const progress = clamp((p.baseY - p.y) / (p.baseY - p.topY), 0, 1);

    // ✅ fade-in / fade-out doux (pas de pop)
    const aIn  = smoothstep(0.00, p.fadeInSpan, progress);
    const aOut = 1.0 - smoothstep(1.0 - p.fadeOutSpan, 1.00, progress);
    const fade = aIn * aOut;

    // suppression quand totalement sorti OU invisible
    if (p.y < p.topY || fade <= 0.001) {
      particles.splice(i, 1);
      continue;
    }

    const wob = Math.sin((p.y * 0.008) + performance.now() * 0.0015 * p.wobbleSpeed) * (10 * p.wobble);
    const r = clamp(p.radius + wob, radiusMax * 0.12, radiusMax);

    const x = cx + Math.cos(p.angle) * r * (0.65 + 0.35 * p.z);
    const y = p.y;

    const depthAlpha = 0.35 + 0.65 * p.z;

    const sizePulse = 0.80 + 0.34 * Math.sin(progress * Math.PI);
    const size = p.baseSize * sizePulse;

    ctx.save();
    ctx.globalAlpha = op * depthAlpha * fade;
    ctx.translate(x, y);
    ctx.rotate(Math.sin(p.angle) * 0.08);
    ctx.font = `${Math.floor(size)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji", ui-sans-serif, system-ui`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(p.emoji, 0, 0);
    ctx.restore();
  }

  // Tornade continue
  const canSpawn = !!pickEmoji();
  const baseTarget = Math.floor((W * H) / 45000 * density * (0.95 + 0.45 * rise));
  const target = canSpawn ? baseTarget : 0;

  const missing = Math.max(0, target - particles.length);
  if (missing > 0) spawnBatch(Math.min(22, missing));
}

/* ===== LOOP ===== */
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

/* ===== SOCKET + AUTH ===== */
const socket = io(SERVER_URL, { transports: ["websocket", "polling"] });

async function init() {
  await new Promise(r => setTimeout(r, 650));

  const authMode = (cssVar("--auth-mode", "strict") || "strict").toLowerCase();
  const room = cssVar("--room-id", "");
  const key  = cssVar("--room-key", "");

  if (authMode === "strict") {
    if (!room || !key) { showSecurityDenied(); return; }
  } else {
    if (!room) { showSecurityDenied(); return; }
  }

  socket.emit("overlay:join", { room, key, overlay: OVERLAY_TYPE });

  socket.on("overlay:forbidden", () => showSecurityDenied());

  socket.on("overlay:state", (payload) => {
    if (payload?.overlay !== OVERLAY_TYPE) return;

    CONFIG = readConfig();

    if (CONFIG.autoReset) {
      particles.length = 0;
      chatCounts.clear();
      chatQueue.length = 0;
      chatTotal = 0;
    }

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
      chatAddEmojis(emojis);
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
