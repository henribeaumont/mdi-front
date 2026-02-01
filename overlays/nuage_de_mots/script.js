/**
 * MDI WORD CLOUD - V5.7.1 SaaS (patch minimal)
 * - ZÉRO FLICKER (invisible tant que state OK)
 * - Auth strict/legacy
 * - Écran ✖ ACCÈS REFUSÉ / ACCESS DENIED si échec
 * - Nouveau mot en fondu (fade-in)
 * - Ignore quiz A/B/C/D
 * - Écoute raw_vote
 *
 * ✅ Fix #1: "Depuis activation uniquement"
 *    -> WARMUP absorbant (baseline) juste après overlay:state
 * ✅ Fix #2: "Mots + chiffres uniquement" (pas d'emojis / pas de ponctuation)
 */

const SERVER_URL = "https://magic-digital-impact-live.onrender.com";
const OVERLAY_TYPE = "word_cloud";

/* --- UTILS --- */
function cssVar(name, fallback = "") {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name);
  return v ? v.trim().replace(/^['"]+|['"]+$/g, "") : fallback;
}
function cssBool(name, fallback = false) {
  const v = cssVar(name, "");
  if (!v) return fallback;
  return v === "true" || v === "on" || v === "1";
}
function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

function isQuizToken(txt) {
  return /^[ABCD]$/.test(String(txt || "").trim().toUpperCase());
}

/* ✅ extraction "mots + chiffres" only (Unicode, accents OK) */
function keepWordsAndNumbersOnly(input) {
  const s = String(input || "")
    .replace(/\u00A0/g, " ")
    .replace(/\u200B/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!s) return "";

  try {
    // Lettres (toutes langues) + Nombres ; supprime emojis/ponctuation/symboles
    const tokens = s.match(/[\p{L}\p{N}]+/gu) || [];
    return tokens.join(" ").trim();
  } catch {
    // fallback ASCII
    const tokens = s.match(/[A-Za-z0-9]+/g) || [];
    return tokens.join(" ").trim();
  }
}

/* --- UI --- */
const elSecurity = document.getElementById("security-screen");
const elCloud = document.getElementById("cloud-container");

function setBootHidden() {
  elCloud.classList.add("hidden");
  elSecurity.classList.add("hidden");
  document.body.style.backgroundColor = "transparent";
}
function showDenied() {
  elCloud.classList.add("hidden");
  elSecurity.classList.remove("hidden");
  document.body.style.backgroundColor = "black";
}
function showCloud() {
  elSecurity.classList.add("hidden");
  elCloud.classList.remove("hidden");
  document.body.style.backgroundColor = "transparent";
}

/* --- MOTEUR VISUEL --- */
let dbMots = {};
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

/* ==========================================================
   ✅ Fix #1 — Baseline “depuis activation”
   - warmup: on absorbe (sans afficher) les votes qui arrivent juste après l'activation
   - baselineSet: on ignore ensuite toute signature déjà vue en warmup
   ========================================================== */
let overlayReady = false;
let warmupActive = false;
let warmupTimer = null;

// Durée warmup (ms). Ajustable via CSS si tu veux : --warmup-ms: "1200";
function getWarmupMs() {
  const v = cssVar("--warmup-ms", "1200");
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? clamp(n, 200, 5000) : 1200;
}

let baselineSet = new Set(); // signatures absorbées pendant warmup

function beginWarmup() {
  baselineSet = new Set();
  warmupActive = true;

  const ms = getWarmupMs();
  clearTimeout(warmupTimer);
  warmupTimer = setTimeout(() => {
    warmupActive = false;
    // console.log("[MDI][WC] warmup end. baseline size:", baselineSet.size);
  }, ms);

  // console.log("[MDI][WC] warmup start", ms, "ms");
}

/* ✅ signature stable (après nettoyage mots/chiffres) */
function signatureOf(cleanText) {
  return String(cleanText || "").toUpperCase();
}

/* ✅ traitement message (patch safe) */
function traiterMessage(texteBrut) {
  if (!texteBrut) return;

  // Tant que l’overlay n’est pas READY (overlay:state), on ignore tout
  if (!overlayReady) return;

  // 1) string
  let texte = String(texteBrut).trim();

  // Ignore quiz
  if (isQuizToken(texte)) return;

  // RESET
  if (texte.toUpperCase() === "RESET") { resetEcran(); return; }

  // ✅ Filtre mots + chiffres uniquement
  texte = keepWordsAndNumbersOnly(texte);

  if (!texte) return;

  // Limites raisonnables (inchangées)
  if (texte.length > 60) return;
  if (texte.split(" ").filter(Boolean).length > 6) return;

  const key = signatureOf(texte);

  // ✅ Fix #1 : warmup/baseline
  if (warmupActive) {
    baselineSet.add(key);       // on absorbe l'historique re-rendu
    return;                     // sans afficher
  }
  if (baselineSet.has(key)) {
    // élément déjà présent pendant warmup => on ignore (évite historique)
    return;
  }

  // Ajout au nuage
  if (dbMots[key]) {
    dbMots[key].count++;
  } else {
    const palette = getPalette();
    dbMots[key] = {
      text: key,
      count: 1,
      color: palette[globalColorIndex],
      _isNew: true
    };
    globalColorIndex = (globalColorIndex + 1) % palette.length;
  }

  requestAnimationFrame(calculerEtAfficherNuage);
}

// --- Placement spirale (inchangé) ---
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
      } else {
        overflowDetected = true; break;
      }
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

/* ✅ DOM apply + fade-in nouveaux mots (inchangé) */
function appliquerAuDom(liste) {
  liste.forEach(mot => {
    if (!mot.tempRenderInfo) return;

    let el = document.getElementById(`mot-${mot.text}`);
    const isNew = !el;

    if (!el) {
      el = document.createElement("div");
      el.id = `mot-${mot.text}`;
      el.className = "mot";
      el.innerText = mot.text;
      el.style.color = mot.color;

      el.style.left = "50%";
      el.style.top = "50%";
      el.style.transform = "translate(-50%, -50%) scale(0.92)";
      el.style.opacity = 0;

      el.classList.add("is-new");
      zone.appendChild(el);
    }

    el.style.left = mot.tempRenderInfo.x + "px";
    el.style.top = mot.tempRenderInfo.y + "px";
    el.style.fontSize = mot.tempRenderInfo.fontSize + "px";

    if (isNew) {
      requestAnimationFrame(() => {
        el.classList.add("mdi-in");
      });

      setTimeout(() => {
        el.classList.remove("is-new");
        el.classList.remove("mdi-in");
        el.style.opacity = 1;
        el.style.transform = "translate(-50%, -50%)";
      }, 650);
    } else {
      el.style.opacity = 1;
      el.style.transform = "translate(-50%, -50%)";
    }

    mot._isNew = false;
  });
}

/* --- CONNEXION SaaS (ZÉRO FLICKER + AUTH MODE) --- */
const socket = io(SERVER_URL, { transports: ["websocket", "polling"] });

async function init() {
  setBootHidden();

  // Attente OBS injection CSS personnalisé
  await new Promise(r => setTimeout(r, 650));

  const authMode = (cssVar("--auth-mode", "strict") || "strict").toLowerCase();
  const room = cssVar("--room-id", "");
  const key  = cssVar("--room-key", "");

  // Strict: room+key obligatoires
  if (authMode === "strict") {
    if (!room || !key) { showDenied(); return; }
  } else {
    if (!room) { showDenied(); return; }
  }

  socket.emit("overlay:join", { room, key, overlay: OVERLAY_TYPE });

  socket.on("overlay:forbidden", () => {
    showDenied();
  });

  socket.on("overlay:state", (payload) => {
    if (payload?.overlay !== OVERLAY_TYPE) return;

    // ✅ Fix: on (ré)arme la session "depuis activation"
    overlayReady = true;
    beginWarmup();

    // Auto reset si demandé
    if (cssBool("--auto-reset", false) === true || cssVar("--auto-reset") === "true") {
      resetEcran();
    }

    showCloud();
  });

  socket.on("raw_vote", (data) => {
    const v = (data?.vote ?? "").toString();
    traiterMessage(v);
  });
}

init();
