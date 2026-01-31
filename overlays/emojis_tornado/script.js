/**
 * MDI EMOJIS TORNADO - V6 SaaS (ZERO FLICKER)
 * Overlay : emojis_tornado
 * - Sécurité via CSS OBS : --room-id / --room-key (+ --auth-mode)
 * - Validation côté serveur : overlay:state (sinon overlay:forbidden)
 * - Canal universel : raw_vote
 * - Extraction emojis robuste (Extended_Pictographic + fallback)
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

/* =========================
   UI (anti-flicker + denied)
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
    // test "emoji-like" (Unicode property)
    return /\p{Extended_Pictographic}/u.test(s);
  } catch {
    // fallback large
    return /[\u2190-\u3299\u{1F000}-\u{1FAFF}]/u.test(s);
  }
}

function extractEmojisFromText(text) {
  if (!text) return [];
  const s = String(text);

  // 1) Meilleur cas : segmentation grapheme (gère ZWJ / variations)
  if (typeof Intl !== "undefined" && Intl.Segmenter) {
    const seg = new Intl.Segmenter("fr", { granularity: "grapheme" });
    const out = [];
    for (const part of seg.segment(s)) {
      const g = part.segment;
      if (isProbablyEmojiSegment(g)) out.push(g);
    }
    return out;
  }

  // 2) Regex fallback
  try {
    const re = /\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*/gu;
    return Array.from(s.matchAll(re)).map(m => m[0]);
  } catch {
    // 3) super fallback
    const re2 = /[\u2190-\u3299\u{1F000}-\u{1FAFF}]/gu;
    return s.match(re2) || [];
  }
}

/* =========================
   PARTICULES / PHYSIQUE
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

function rand(a, b) { return a + Math.random() * (b - a); }
function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

/* config runtime (depuis CSS OBS) */
function readConfig() {
  const density = clamp(cssNum("--particle-density", 0.15), 0.01, 0.7);
  const maxP    = clamp(cssNum("--particle-max", 80), 10, 400);

  const op      = clamp(cssNum("--particle-opacity", 0.85), 0.05, 1);
  const sizeMin = clamp(cssNum("--particle-size-min", 25), 10, 200);
  const sizeMax = clamp(cssNum("--particle-size-max", 55), sizeMin, 260);

  const spread  = clamp(cssNum("--particle-spread", 0.40), 0.10, 1.0);
  const vBase   = clamp(cssNum("--velocity-base", 2.5), 0.4, 9);

  const onlyEmoji = cssBool("--only-emoji-messages", true);
  const autoReset = cssBool("--auto-reset", false);

  return { density, maxP, op, sizeMin, sizeMax, spread, vBase, onlyEmoji, autoReset };
}

let CONFIG = readConfig();

const particles = [];
let running = false;
let lastT = performance.now();
let rafId = null;

/**
 * Particule :
 * - émerge en bas/centre (avec spread)
 * - vortex vers le haut (swirl)
 */
function spawnEmoji(emoji, count) {
  CONFIG = readConfig(); // live update si OBS change vars
  const { density, maxP, sizeMin, sizeMax, spread, vBase } = CONFIG;

  const finalCount = Math.max(1, Math.floor(count * density * 10)); // density pilote quantité
  const cx = W * 0.5;
  const baseY = H * 0.85;

  for (let i = 0; i < finalCount; i++) {
    if (particles.length >= maxP) break;

    const x = cx + rand(-1, 1) * (W * 0.25 * spread);
    const y = baseY + rand(-20, 20);

    const size = rand(sizeMin, sizeMax);
    const up = vBase * rand(0.8, 1.35);

    particles.push({
      emoji,
      x, y,
      vx: rand(-0.6, 0.6) * up,
      vy: rand(-1.6, -0.9) * up,  // vers le haut
      rot: rand(-0.7, 0.7),
      vr: rand(-0.06, 0.06),
      life: rand(2.2, 3.6),
      age: 0,
      size,
      swirl: rand(0.9, 1.5) * (1 + spread),
    });
  }
}

function step(dt) {
  CONFIG = readConfig();
  ctx.clearRect(0, 0, W, H);

  const { op } = CONFIG;

  // centre du vortex
  const vx = W * 0.5;
  const vy = H * 0.35;

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.age += dt;
    if (p.age >= p.life) {
      particles.splice(i, 1);
      continue;
    }

    // vortex
    const dx = p.x - vx;
    const dy = p.y - vy;
    const dist = Math.max(60, Math.hypot(dx, dy));

    // attraction + rotation tangentielle
    const pull = (140 / dist) * p.swirl;
    const tang = (110 / dist) * p.swirl;

    p.vx += (-dx / dist) * pull * dt;
    p.vy += (-dy / dist) * pull * dt;

    p.vx += (-dy / dist) * tang * dt;
    p.vy += ( dx / dist) * tang * dt;

    // légère gravité (stabilise)
    p.vy += 18 * dt;

    // drag
    p.vx *= Math.pow(0.985, dt * 60);
    p.vy *= Math.pow(0.985, dt * 60);

    p.x += p.vx;
    p.y += p.vy;
    p.rot += p.vr;

    // fade in/out
    const t = p.age / p.life;
    const fade =
      t < 0.12 ? (t / 0.12) :
      t > 0.88 ? ((1 - t) / 0.12) :
      1;

    drawEmoji(p, op * fade);
  }
}

function drawEmoji(p, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rot);
  ctx.font = `${Math.floor(p.size)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji", ui-sans-serif, system-ui`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(p.emoji, 0, 0);
  ctx.restore();
}

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
   SOCKET + AUTH (CSS OBS)
========================= */
const socket = io(SERVER_URL, { transports: ["websocket", "polling"] });

async function init() {
  // Laisse à OBS le temps d'injecter le CSS personnalisé
  await new Promise(r => setTimeout(r, 600));

  const authMode = (cssVar("--auth-mode", "strict") || "strict").toLowerCase();
  const room = cssVar("--room-id", "");
  const key  = cssVar("--room-key", "");

  // En strict : room+key obligatoires
  if (authMode === "strict") {
    if (!room || !key) {
      showSecurityDenied();
      return;
    }
  } else {
    // legacy toléré mais déconseillé : si pas room => denied (sécurité minimale)
    if (!room) {
      showSecurityDenied();
      return;
    }
  }

  // Demande d'accès au serveur
  socket.emit("overlay:join", { room, key, overlay: OVERLAY_TYPE });

  socket.on("overlay:forbidden", () => {
    showSecurityDenied();
  });

  socket.on("overlay:state", (payload) => {
    if (payload?.overlay !== OVERLAY_TYPE) return;

    // Option auto reset
    CONFIG = readConfig();
    if (CONFIG.autoReset) {
      particles.length = 0;
    }

    // ✅ Affichage unique après validation serveur (anti-flicker)
    showOverlay();
    start();
  });

  // Canal universel
  socket.on("raw_vote", (data) => {
    // data.vote contient message / mot / emoji selon extension
    const voteText = (data?.vote ?? "").toString().trim();
    if (!voteText) return;

    const emojis = extractEmojisFromText(voteText);

    // Si mode "only emoji messages" : ignore si aucun emoji
    CONFIG = readConfig();
    if (CONFIG.onlyEmoji && emojis.length === 0) return;

    // Spawn : si emojis présents => chacun peut alimenter la tornade
    if (emojis.length > 0) {
      // plus il y a d'emojis dans le message, plus on spawn (mais capé par particle-max)
      for (const e of emojis) spawnEmoji(e, 1);
    } else {
      // sinon, fallback : on affiche une étincelle neutre (optionnel)
      // Ici : on ne fait rien (comportement strict)
    }
  });

  // Reset télécommande (si ton serveur l'envoie)
  socket.on("overlay:reset", () => {
    particles.length = 0;
  });
}

init();
