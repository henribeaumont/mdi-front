/**
 * ============================================================
 * MDI NUAGE DE MOTS - V6.7.1
 * ============================================================
 * Base : V6.7 ORIGINAL — aucune logique modifiée
 * Ajout minimal : overlay:online émis UNE SEULE FOIS à la connexion
 * (voyant télécommande) — jamais dans overlay:state ni sur les votes
 * ============================================================
 */

const SERVER_URL = "https://magic-digital-impact-live.onrender.com";
const OVERLAY_TYPE = "nuage_de_mots";

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
function cssPx(name, fallbackPx) {
  const raw = cssVar(name, "");
  const n = parseFloat(String(raw).replace(",", "."));
  return Number.isFinite(n) ? n : fallbackPx;
}
function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

/* -------- DOM -------- */
const zone = document.getElementById("word-zone");
const container = document.getElementById("cloud-container");
const securityScreen = document.getElementById("security-screen");
const measureZone = document.getElementById("measure-zone");

/* -------- State -------- */
let STATE = "idle";
let dbMots = {};
let globalColorIndex = 0;
let wordPositions = [];

/* ✅ Anti-spam render */
let renderScheduled = false;
function scheduleRender() {
  if (renderScheduled) return;
  renderScheduled = true;
  requestAnimationFrame(() => {
    renderScheduled = false;
    render();
  });
}

function getPalette() {
  return [
    cssVar("--color-1", "#F054A2"),
    cssVar("--color-2", "#2ecc71"),
    cssVar("--color-3", "#F9AD48"),
    cssVar("--color-4", "#3b82f6"),
    cssVar("--color-5", "#ffffff")
  ];
}

function resetEcran() {
  zone.innerHTML = "";
  dbMots = {};
  globalColorIndex = 0;
  wordPositions = [];
  console.log("🔄 [NUAGE] Reset complet");
}

function measureText(text, fontSize) {
  measureZone.style.fontSize = fontSize + "px";
  measureZone.textContent = text;
  return {
    width: measureZone.offsetWidth,
    height: measureZone.offsetHeight
  };
}

function hasCollision(x, y, width, height) {
  const margin = 15;
  for (const pos of wordPositions) {
    const overlapX = !(x + width + margin < pos.x || x > pos.x + pos.width + margin);
    const overlapY = !(y + height + margin < pos.y || y > pos.y + pos.height + margin);
    if (overlapX && overlapY) return true;
  }
  return false;
}

function findFreePosition(width, height) {
  const W = container.clientWidth;
  const H = container.clientHeight;
  const cx = W / 2;
  const cy = H / 2;
  const maxAttempts = 800;
  let angle = Math.random() * Math.PI * 2;
  let radius = 20;
  const radiusStep = 10;
  const angleStep = 0.3;

  for (let i = 0; i < maxAttempts; i++) {
    const x = cx + Math.cos(angle) * radius - width / 2;
    const y = cy + Math.sin(angle) * radius - height / 2;
    if (x >= 0 && x + width <= W && y >= 0 && y + height <= H) {
      if (!hasCollision(x, y, width, height)) return { x, y };
    }
    angle += angleStep;
    radius += radiusStep * (angleStep / (Math.PI * 2));
  }
  return {
    x: Math.max(0, Math.min(W - width, cx - width / 2 + (Math.random() - 0.5) * 100)),
    y: Math.max(0, Math.min(H - height, cy - height / 2 + (Math.random() - 0.5) * 100))
  };
}

function render() {
  const W = container.clientWidth;
  const H = container.clientHeight;
  if (!W || !H) { scheduleRender(); return; }

  const words = Object.values(dbMots);
  if (!words.length) { zone.innerHTML = ""; wordPositions = []; return; }

  const uppercase = cssOnOff("--uppercase", false);
  words.sort((a, b) => b.count - a.count);
  wordPositions = [];

  const maxCount = Math.max(...words.map(w => w.count), 1);
  const minCount = Math.min(...words.map(w => w.count), 1);
  const minPx = clamp(cssPx("--cloud-font-min", 30), 10, 300);
  const maxPx = clamp(cssPx("--cloud-font-max", 120), 10, 300);
  const safeMax = Math.max(minPx, maxPx);

  words.forEach((mot) => {
    const displayText = uppercase ? mot.text.toUpperCase() : mot.text;
    let el = document.getElementById(`mot-${mot.text.replace(/\s+/g, '-')}`);
    const ratio = maxCount > minCount ? (mot.count - minCount) / (maxCount - minCount) : 1;
    const fontSize = Math.floor(minPx + (ratio * (safeMax - minPx)));
    const { width, height } = measureText(displayText, fontSize);

    if (!el) {
      el = document.createElement("div");
      el.id = `mot-${mot.text.replace(/\s+/g, '-')}`;
      el.className = "mot is-new";
      el.style.color = mot.color;
      el.style.fontSize = `${fontSize}px`;
      zone.appendChild(el);
      requestAnimationFrame(() => el.classList.add("mdi-in"));
    } else {
      el.style.fontSize = `${fontSize}px`;
    }

    el.textContent = displayText;
    const pos = findFreePosition(width, height);
    el.style.left = `${pos.x}px`;
    el.style.top = `${pos.y}px`;
    wordPositions.push({ x: pos.x, y: pos.y, width, height, element: el });
  });
}

/* -------- Socket.io -------- */
const socket = io(SERVER_URL, {
  transports: ["websocket", "polling"],
  reconnection: true
});

socket.on("connect", () => {
  console.log("✅ [NUAGE] Connecté");
});

socket.on("overlay:state", (payload) => {
  if (payload.overlay !== OVERLAY_TYPE) return;

  console.log(`📡 [NUAGE] État:`, payload.state, payload.data);
  STATE = payload.state;

  if (STATE === "idle") {
    container.classList.remove("show");
    setTimeout(() => {
      container.classList.add("hidden");
      resetEcran();
    }, 800);
    return;
  }

  if (STATE === "active") {
    securityScreen.classList.add("hidden");
    container.classList.remove("hidden");
    requestAnimationFrame(() => container.classList.add("show"));

    if (payload.data && payload.data.words) {
      const serverWords = payload.data.words;
      const palette = getPalette();
      dbMots = {};
      Object.keys(serverWords).forEach((key, index) => {
        dbMots[key] = {
          text: key,
          count: serverWords[key],
          color: palette[index % 5]
        };
      });
      globalColorIndex = Object.keys(dbMots).length;
      scheduleRender();
    }
  }
});

socket.on("overlay:forbidden", (payload) => {
  console.error("❌ [NUAGE] Accès refusé:", payload.reason);
  securityScreen.classList.remove("hidden");
  container.classList.add("hidden");
});

/* -------- Auth (OBS CSS vars) -------- */
async function init() {
  await new Promise(resolve => setTimeout(resolve, 800));

  const authMode = cssVar("--auth-mode", "strict");
  const room = cssVar("--room-id", "").trim();
  const key = cssVar("--room-key", "").trim();

  console.log(`🔐 [NUAGE] Auth: ${authMode}, Room: ${room}`);

  if (!room) {
    console.error("❌ [NUAGE] Aucun room-id");
    securityScreen.classList.remove("hidden");
    return;
  }

  if (authMode === "strict") {
    if (!key) {
      console.error("❌ [NUAGE] Mode strict sans key");
      securityScreen.classList.remove("hidden");
      return;
    }
    socket.emit("overlay:join", { room, key, overlay: OVERLAY_TYPE });
  } else {
    socket.emit("overlay:join", { room, key: "", overlay: OVERLAY_TYPE });
  }

  // ✅ Seul ajout V6.7.1 : signaler la présence pour les voyants télécommande
  // Émis UNE SEULE FOIS ici — jamais dans overlay:state, jamais sur les votes
  socket.emit("overlay:online", { room, overlay: OVERLAY_TYPE });

  console.log("✅ [NUAGE] Auth envoyée");
}

socket.on("connect", init);
