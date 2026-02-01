/**
 * MDI WORD CLOUD - V5.9 SaaS (Lead Edition)
 * - Anti-bruit renforcé (Regex pour le hashtag)
 * - Logs de debug intégrés pour OBS
 * - Gestion de l'asynchronisme des variables CSS OBS
 */

const SERVER_URL = "https://magic-digital-impact-live.onrender.com";
const OVERLAY_TYPE = "word_cloud";

/* --- UTILS --- */
function cssVar(name, fallback = "") {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name);
  const val = v ? v.trim().replace(/^['"]+|['"]+$/g, "") : fallback;
  return val;
}

/* --- UI --- */
const elSecurity = document.getElementById("security-screen");
const elCloud = document.getElementById("cloud-container");
const zone = document.getElementById("word-zone");
const container = document.getElementById("cloud-container");
const measureZone = document.getElementById("measure-zone");

function showDenied(reason) {
  console.error("❌ Accès Refusé:", reason);
  elCloud.classList.add("hidden");
  elSecurity.classList.remove("hidden");
}

function showCloud() {
  elSecurity.classList.add("hidden");
  elCloud.classList.remove("hidden");
}

/* --- LOGIQUE MÉTIER --- */
let dbMots = {};
let lastMessagesCache = new Set();
let globalColorIndex = 0;

function resetEcran() {
  zone.innerHTML = "";
  dbMots = {};
  globalColorIndex = 0;
}

function traiterMessage(texteBrut) {
  if (!texteBrut) return;
  
  // Nettoyage agressif
  let texte = String(texteBrut).trim();
  console.log("📩 Reçu brut:", texte);

  // --- FILTRE HASHTAG (Regex souple : autorise les espaces avant le #) ---
  const match = texte.match(/^\s*#\s*(\S+.*)$/);
  if (!match) {
    console.log("⏭️ Ignoré (pas de #)");
    return;
  }

  // Le mot est le premier groupe de capture
  let motFinal = match[1].trim();
  if (!motFinal) return;

  // Anti-doublon (2s)
  const cacheKey = motFinal.toUpperCase();
  if (lastMessagesCache.has(cacheKey)) return;
  lastMessagesCache.add(cacheKey);
  setTimeout(() => lastMessagesCache.delete(cacheKey), 2000);

  if (motFinal.toUpperCase() === "RESET") { resetEcran(); return; }

  const key = motFinal.toUpperCase();
  if (dbMots[key]) {
    dbMots[key].count++;
  } else {
    const palette = [
      cssVar("--color-1", "#F054A2"),
      cssVar("--color-2", "#FFFAE4"),
      cssVar("--color-3", "#F9AD48"),
      cssVar("--color-4", "#FBCAEF"),
      cssVar("--color-5", "#71CCFD")
    ];
    dbMots[key] = {
      text: motFinal,
      count: 1,
      color: palette[globalColorIndex]
    };
    globalColorIndex = (globalColorIndex + 1) % palette.length;
  }
  calculerEtAfficherNuage();
}

/* --- MOTEUR VISUEL --- */
function calculerEtAfficherNuage() {
  let listeMots = Object.values(dbMots);
  listeMots.sort((a, b) => b.count - a.count);
  
  const W = container.clientWidth || 650;
  const H = container.clientHeight || 850;
  
  // Simplification du placement pour test
  appliquerAuDom(listeMots, W, H);
}

function appliquerAuDom(liste, W, H) {
  liste.forEach((mot, index) => {
    let el = document.getElementById(`mot-${mot.text.replace(/\s+/g, '-')}`);
    if (!el) {
      el = document.createElement("div");
      el.id = `mot-${mot.text.replace(/\s+/g, '-')}`;
      el.className = "mot mdi-in";
      el.innerText = mot.text;
      el.style.color = mot.color;
      zone.appendChild(el);
    }
    
    // Placement simple en spirale pour debug
    const angle = index * 0.8;
    const radius = index * 25;
    const x = (W/2) + Math.cos(angle) * radius;
    const y = (H/2) + Math.sin(angle) * radius;
    
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.fontSize = `${Math.max(20, 80 - (index * 5))}px`;
    el.style.opacity = 1;
  });
}

/* --- INITIALISATION --- */
const socket = io(SERVER_URL, { transports: ["websocket"] });

async function init() {
  console.log("🚀 Initialisation de l'overlay...");
  
  // Boucle d'attente des variables CSS (max 5 secondes)
  let room = "";
  let attempts = 0;
  while (!room && attempts < 10) {
    room = cssVar("--room-id");
    if (!room) {
      console.log("⏳ Attente de --room-id...");
      await new Promise(r => setTimeout(r, 500));
      attempts++;
    }
  }

  const key = cssVar("--room-key");
  const authMode = cssVar("--auth-mode", "strict");

  console.log(`📡 Connexion: Room=${room}, Mode=${authMode}`);

  if (!room && authMode === "strict") {
    showDenied("Variable --room-id manquante dans le CSS OBS");
    return;
  }

  socket.emit("overlay:join", { room, key, overlay: OVERLAY_TYPE });

  socket.on("connect", () => console.log("✅ Connecté au serveur Render"));
  
  socket.on("overlay:state", (p) => {
    console.log("📩 État reçu:", p);
    if (p.overlay === OVERLAY_TYPE) showCloud();
  });

  socket.on("raw_vote", (data) => {
    traiterMessage(data.vote);
  });

  socket.on("overlay:forbidden", () => showDenied("Clé de salle invalide ou inactive"));
}

init();
