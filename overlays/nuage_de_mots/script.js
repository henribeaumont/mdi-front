/**
 * MDI WORD CLOUD - V6.2 (HOTFIX FLUX)
 * Réconciliation Extension (Legacy) + Overlay (SaaS)
 */

const SERVER_URL = "https://magic-digital-impact-live.onrender.com";
const OVERLAY_TYPE = "word_cloud";

function cssVar(name, fallback = "") {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name);
  return v ? v.trim().replace(/^['"]+|['"]+$/g, "") : fallback;
}

const zone = document.getElementById("word-zone");
const container = document.getElementById("cloud-container");

/* --- MOTEUR --- */
let dbMots = {};
let dedupeCache = new Map();
let globalColorIndex = 0;

function resetEcran() {
  zone.innerHTML = "";
  dbMots = {};
  dedupeCache.clear();
}

function traiterMessage(v) {
  let texte = String(v || "").trim();
  const prefixMode = cssVar("--wc-prefix-mode", "on");
  const prefix = cssVar("--wc-prefix", "#");

  // FILTRE PREFIXE
  if (prefixMode === "on") {
    if (!texte.startsWith(prefix)) return;
    texte = texte.substring(prefix.length).trim();
  }
  
  if (!texte || texte.toUpperCase() === "RESET") { if(texte) resetEcran(); return; }

  // DEDUP (10 sec par défaut pour test)
  const key = texte.toUpperCase();
  if (dedupeCache.has(key)) return;
  dedupeCache.set(key, true);
  setTimeout(() => dedupeCache.delete(key), 10000);

  if (dbMots[key]) {
    dbMots[key].count++;
  } else {
    const palette = [cssVar("--color-1", "#F054A2"), cssVar("--color-2", "#2ecc71"), cssVar("--color-3", "#F9AD48"), cssVar("--color-4", "#3b82f6"), cssVar("--color-5", "#ffffff")];
    dbMots[key] = { text: texte, count: 1, color: palette[globalColorIndex % 5] };
    globalColorIndex++;
  }
  render();
}

function render() {
  const W = container.clientWidth;
  const H = container.clientHeight;
  Object.values(dbMots).forEach((mot, i) => {
    let el = document.getElementById(`mot-${mot.text.replace(/\s+/g, '-')}`);
    if (!el) {
      el = document.createElement("div");
      el.id = `mot-${mot.text.replace(/\s+/g, '-')}`;
      el.className = "mot mdi-in";
      el.innerText = mot.text;
      el.style.color = mot.color;
      zone.appendChild(el);
    }
    el.style.left = `${(W/2) + (Math.cos(i) * (i * 20))}px`;
    el.style.top = `${(H/2) + (Math.sin(i) * (i * 20))}px`;
    el.style.fontSize = `${Math.max(20, 70 - (i * 2))}px`;
  });
}

/* --- CONNEXION --- */
const socket = io(SERVER_URL, { transports: ["websocket"] });

async function init() {
  await new Promise(r => setTimeout(r, 1000));
  const room = cssVar("--room-id");
  const key = cssVar("--room-key");

  if (!room) return;

  // 1. Join SaaS (pour l'auth et l'état)
  socket.emit("overlay:join", { room, key, overlay: OVERLAY_TYPE });
  
  // 2. IMPORTANT : Join Legacy (pour entendre l'extension content.js)
  // C'est ici que ton server.js attend l'extension
  socket.emit("rejoindre_salle", room);

  socket.on("overlay:state", (p) => {
    if (p.overlay === OVERLAY_TYPE) {
        document.getElementById("security-screen").classList.add("hidden");
        container.classList.remove("hidden");
    }
  });

  // Écoute le canal de l'extension
  socket.on("raw_vote", (data) => {
    traiterMessage(data.vote);
  });
}

init();
