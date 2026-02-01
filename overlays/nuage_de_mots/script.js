/**
 * MDI WORD CLOUD - V6.0 SaaS
 * Support complet du CSS OBS pédagogique (Préfixe, TTL, Room)
 */

const SERVER_URL = "https://magic-digital-impact-live.onrender.com";
const OVERLAY_TYPE = "word_cloud";

/* --- LECTEUR DE CONFIG OBS --- */
function cssVar(name, fallback = "") {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name);
  return v ? v.trim().replace(/^['"]+|['"]+$/g, "") : fallback;
}

/* --- UI --- */
const elSecurity = document.getElementById("security-screen");
const elCloud = document.getElementById("cloud-container");
const zone = document.getElementById("word-zone");
const container = document.getElementById("cloud-container");
const measureZone = document.getElementById("measure-zone");

function showDenied() {
  elCloud.classList.add("hidden");
  elSecurity.classList.remove("hidden");
}

function showCloud() {
  elSecurity.classList.add("hidden");
  elCloud.classList.remove("hidden");
}

/* --- MOTEUR --- */
let dbMots = {};
let dedupeCache = new Map(); // Cache intelligent avec expiration
let globalColorIndex = 0;

function resetEcran() {
  zone.innerHTML = "";
  dbMots = {};
  dedupeCache.clear();
  globalColorIndex = 0;
}

function traiterMessage(texteBrut) {
  if (!texteBrut) return;
  let texte = String(texteBrut).trim();

  // 1. GESTION DU PRÉFIXE (#)
  const prefixMode = cssVar("--wc-prefix-mode", "on");
  const prefix = cssVar("--wc-prefix", "#");

  if (prefixMode === "on") {
    if (!texte.startsWith(prefix)) return;
    texte = texte.substring(prefix.length).trim();
  }
  
  if (!texte) return;
  if (texte.toUpperCase() === "RESET") { resetEcran(); return; }

  // 2. ANTI-DOUBLON (DEDUP)
  const ttl = parseInt(cssVar("--wc-dedup-ttl-ms", "600000"));
  const key = texte.toUpperCase();
  const now = Date.now();

  if (dedupeCache.has(key) && (now - dedupeCache.get(key) < ttl)) {
    return; // Ignoré car déjà vu récemment
  }
  dedupeCache.set(key, now);

  // 3. MISE À JOUR DB
  if (dbMots[key]) {
    dbMots[key].count++;
  } else {
    const palette = [
      cssVar("--color-1", "#F054A2"), cssVar("--color-2", "#2ecc71"),
      cssVar("--color-3", "#F9AD48"), cssVar("--color-4", "#3b82f6"),
      cssVar("--color-5", "#ffffff")
    ];
    dbMots[key] = { text: texte, count: 1, color: palette[globalColorIndex] };
    globalColorIndex = (globalColorIndex + 1) % palette.length;
  }
  
  calculerEtAfficherNuage();
}

function calculerEtAfficherNuage() {
  let listeMots = Object.values(dbMots);
  listeMots.sort((a, b) => b.count - a.count);
  
  const W = container.clientWidth;
  const H = container.clientHeight;
  
  // Placement simplifié pour validation immédiate
  listeMots.forEach((mot, index) => {
    let el = document.getElementById(`mot-${mot.text.replace(/\s+/g, '-')}`);
    if (!el) {
      el = document.createElement("div");
      el.id = `mot-${mot.text.replace(/\s+/g, '-')}`;
      el.className = "mot mdi-in";
      el.innerText = mot.text;
      el.style.color = mot.color;
      zone.appendChild(el);
    }
    const angle = index * 0.8;
    const radius = index * 20;
    el.style.left = `${(W/2) + Math.cos(angle) * radius}px`;
    el.style.top = `${(H/2) + Math.sin(angle) * radius}px`;
    el.style.fontSize = `${Math.max(20, 80 - (index * 3))}px`;
  });
}

/* --- CONNEXION --- */
const socket = io(SERVER_URL, { transports: ["websocket"] });

async function init() {
  // Attente pour laisser le temps à OBS d'injecter le CSS
  await new Promise(r => setTimeout(r, 1000));

  const room = cssVar("--room-id");
  const key = cssVar("--room-key");
  const authMode = cssVar("--auth-mode", "strict");

  if (!room || (authMode === "strict" && !key)) {
    showDenied();
    return;
  }

  socket.emit("overlay:join", { room, key, overlay: OVERLAY_TYPE });

  socket.on("overlay:state", (p) => {
    if (p.overlay === OVERLAY_TYPE) {
      if (cssVar("--auto-reset") === "true") resetEcran();
      showCloud();
    }
  });

  socket.on("raw_vote", (data) => traiterMessage(data.vote));
  socket.on("overlay:forbidden", () => showDenied());
}

init();
