/**
 * MDI WORD CLOUD - V5.8 SaaS (Lead Edition)
 * - Filtrage par préfixe # (Anti-bruit)
 * - Déduplication par cache temporel
 * - Zéro flicker & Auth Strict
 */

const SERVER_URL = "https://magic-digital-impact-live.onrender.com";
const OVERLAY_TYPE = "word_cloud";

/* --- UTILS --- */
function cssVar(name, fallback = "") {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name);
  return v ? v.trim().replace(/^['"]+|['"]+$/g, "") : fallback;
}

/* --- UI STATES --- */
const elSecurity = document.getElementById("security-screen");
const elCloud = document.getElementById("cloud-container");

function showDenied() {
  elCloud.classList.add("hidden");
  elSecurity.classList.remove("hidden");
  document.body.style.backgroundColor = "rgba(0,0,0,0.9)"; // Fond sombre pour le refus
}
function showCloud() {
  elSecurity.classList.add("hidden");
  elCloud.classList.remove("hidden");
  document.body.style.backgroundColor = "transparent";
}

/* --- MOTEUR NUAGE --- */
let dbMots = {};
let lastMessagesCache = new Set(); // Cache anti-doublon (2s)
let globalColorIndex = 0;

const TAILLE_BASE_MAX = 130;
const TAILLE_MIN = 20;
const MARGE_ENTRE_MOTS = 15;
const PADDING_CADRE = 40;

const zone = document.getElementById("word-zone");
const container = document.getElementById("cloud-container");
const measureZone = document.getElementById("measure-zone");

function getPalette() {
  return [
    cssVar("--color-1", "#F054A2"),
    cssVar("--color-2", "#FFFAE4"),
    cssVar("--color-3", "#F9AD48"),
    cssVar("--color-4", "#FBCAEF"),
    cssVar("--color-5", "#71CCFD")
  ];
}

function resetEcran() {
  zone.innerHTML = "";
  dbMots = {};
  globalColorIndex = 0;
}

function traiterMessage(texteBrut) {
  if (!texteBrut) return;
  let texte = String(texteBrut).trim();

  // --- 1. FILTRE BARRIÈRE # ---
  // Si le message ne commence pas par #, on l'ignore (bruit du chat)
  if (!texte.startsWith("#")) return;
  
  // On retire le # pour l'affichage
  texte = texte.substring(1).trim();
  if (!texte) return;

  // --- 2. ANTI-DOUBLON TEMPOREL (2 secondes) ---
  // Évite que l'extension renvoie 2x le même message suite à un scroll DOM
  const cacheKey = texte.toUpperCase();
  if (lastMessagesCache.has(cacheKey)) return;
  lastMessagesCache.add(cacheKey);
  setTimeout(() => lastMessagesCache.delete(cacheKey), 2000);

  // --- 3. TRAITEMENT CLASSIQUE ---
  if (texte.toUpperCase() === "RESET") { resetEcran(); return; }
  if (texte.length > 50) return; // Sécurité longueur

  const key = texte.toUpperCase();
  if (dbMots[key]) {
    dbMots[key].count++;
  } else {
    const palette = getPalette();
    dbMots[key] = {
      text: texte, // On garde la casse d'origine ou texte
      count: 1,
      color: palette[globalColorIndex]
    };
    globalColorIndex = (globalColorIndex + 1) % palette.length;
  }
  requestAnimationFrame(calculerEtAfficherNuage);
}

// Logic de placement (conservée et optimisée)
function calculerEtAfficherNuage() {
  let listeMots = Object.values(dbMots);
  listeMots.sort((a, b) => b.count - a.count);
  if (listeMots.length === 0) return;

  const maxCount = listeMots[0].count;
  const W = container.clientWidth || 650;
  const H = container.clientHeight || 850;
  const CX = W / 2;
  const CY = H / 2;

  let globalScale = 1.0;
  let success = false;
  let tentatives = 0;

  while (!success && tentatives < 30) {
    let collisionMap = [];
    let overflowDetected = false;

    for (let motData of listeMots) {
      let ratio = motData.count / maxCount;
      let baseSize = (listeMots.indexOf(motData) === 0) ? TAILLE_BASE_MAX : 50;
      let targetSize = Math.max(TAILLE_MIN, (baseSize + (ratio * (TAILLE_BASE_MAX - 60))) * globalScale);
      measureZone.style.fontSize = targetSize + "px";
      measureZone.innerText = motData.text;
      if (measureZone.offsetWidth + MARGE_ENTRE_MOTS > W - (PADDING_CADRE * 2)) {
        overflowDetected = true; break;
      }
    }

    if (overflowDetected) { globalScale *= 0.9; tentatives++; continue; }

    for (let motData of listeMots) {
      let ratio = motData.count / maxCount;
      let baseSize = (listeMots.indexOf(motData) === 0) ? TAILLE_BASE_MAX : 50;
      let targetFontSize = Math.max(TAILLE_MIN, (baseSize + (ratio * (TAILLE_BASE_MAX - 60))) * globalScale);
      measureZone.style.fontSize = targetFontSize + "px";
      measureZone.innerText = motData.text;
      let boxW = (measureZone.offsetWidth || (targetFontSize * 0.7 * motData.text.length)) + MARGE_ENTRE_MOTS;
      let boxH = (measureZone.offsetHeight || targetFontSize) + MARGE_ENTRE_MOTS;
      let centrePos = trouverPlaceSpirale(boxW, boxH, CX, CY, W, H, collisionMap);
      if (centrePos) {
        motData.tempRenderInfo = { x: centrePos.x, y: centrePos.y, fontSize: targetFontSize };
        collisionMap.push({ x: centrePos.x - (boxW / 2), y: centrePos.y - (boxH / 2), w: boxW, h: boxH });
      } else { overflowDetected = true; break; }
    }
    if (!overflowDetected) success = true;
    else { globalScale *= 0.9; tentatives++; }
  }
  appliquerAuDom(listeMots);
}

function trouverPlaceSpirale(w, h, cx, cy, containerW, containerH, obstacles) {
  let angle = 0; let radius = 0;
  while (radius < Math.max(containerW, containerH)) {
    let spiralX = cx + (radius * Math.cos(angle));
    let spiralY = cy + (radius * Math.sin(angle));
    let rectX = spiralX - (w / 2); let rectY = spiralY - (h / 2);
    if (!(rectX < PADDING_CADRE || rectY < PADDING_CADRE || rectX + w > containerW - PADDING_CADRE || rectY + h > containerH - PADDING_CADRE)) {
      if (!obstacles.some(obs => rectX < obs.x + obs.w && rectX + w > obs.x && rectY < obs.y + obs.h && rectY + h > obs.y)) {
        return { x: spiralX, y: spiralY };
      }
    }
    angle += 0.5;
    radius += (5 * 0.5) / (1 + radius * 0.005);
  }
  return null;
}

function appliquerAuDom(liste) {
  liste.forEach(mot => {
    if (!mot.tempRenderInfo) return;
    let el = document.getElementById(`mot-${mot.text}`);
    const isNew = !el;
    if (!el) {
      el = document.createElement("div");
      el.id = `mot-${mot.text}`;
      el.className = "mot is-new";
      el.innerText = mot.text;
      el.style.color = mot.color;
      el.style.left = "50%";
      el.style.top = "50%";
      zone.appendChild(el);
    }
    el.style.left = mot.tempRenderInfo.x + "px";
    el.style.top = mot.tempRenderInfo.y + "px";
    el.style.fontSize = mot.tempRenderInfo.fontSize + "px";
    if (isNew) {
      requestAnimationFrame(() => el.classList.add("mdi-in"));
    }
  });
}

/* --- CONNEXION & AUTH --- */
const socket = io(SERVER_URL, { transports: ["websocket", "polling"] });

async function init() {
  // Boot invisible
  document.body.style.backgroundColor = "transparent";
  
  // Attente injection CSS OBS
  await new Promise(r => setTimeout(r, 800));

  const authMode = (cssVar("--auth-mode", "strict")).toLowerCase();
  const room = cssVar("--room-id", "");
  const key  = cssVar("--room-key", "");

  if (authMode === "strict" && (!room || !key)) { showDenied(); return; }
  if (!room) { showDenied(); return; }

  socket.emit("overlay:join", { room, key, overlay: OVERLAY_TYPE });

  socket.on("overlay:forbidden", () => showDenied());
  
  socket.on("overlay:state", (payload) => {
    if (payload?.overlay !== OVERLAY_TYPE) return;
    showCloud();
  });

  socket.on("raw_vote", (data) => {
    traiterMessage(data?.vote);
  });
}

init();
