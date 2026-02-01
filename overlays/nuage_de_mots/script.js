
/**
 * MDI WORD CLOUD - V5.7 SaaS
 * - ZÉRO FLICKER (invisible tant que state OK)
 * - Auth strict/legacy
 * - Affiche ✖ ACCÈS REFUSÉ / ACCESS DENIED en cas d'échec
 * - Nouveau mot en fondu (fade-in)
 * - Ignore quiz A/B/C/D
 * - Écoute raw_vote
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

/* ✅ traitement message (patch safe) */
function traiterMessage(texteBrut) {
  if (!texteBrut) return;

  let texte = String(texteBrut).trim();

  // Ignore quiz
  if (isQuizToken(texte)) return;

  // Normalisation soft (préserve emojis)
  texte = texte.replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim();

  if (!texte) return;

  // RESET
  if (texte.toUpperCase() === "RESET") { resetEcran(); return; }

  // Limites raisonnables
  if (texte.length > 60) return;
  if (texte.split(" ").filter(Boolean).length > 6) return;

  const key = texte.toUpperCase();

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

/* ✅ DOM apply + fade-in nouveaux mots */
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

      // Start centered small (safe)
      el.style.left = "50%";
      el.style.top = "50%";
      el.style.transform = "translate(-50%, -50%) scale(0.92)";
      el.style.opacity = 0;

      // ✅ mark new
      el.classList.add("is-new");
      zone.appendChild(el);
    }

    el.style.left = mot.tempRenderInfo.x + "px";
    el.style.top = mot.tempRenderInfo.y + "px";
    el.style.fontSize = mot.tempRenderInfo.fontSize + "px";

    if (isNew) {
      // déclenche le fondu après insertion (sinon transition skip)
      requestAnimationFrame(() => {
        el.classList.add("mdi-in"); // opacity -> 1 / scale -> 1
      });

      // nettoyage classes après anim (optionnel, mais évite de rester "new")
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

    // reset flag
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
    // Legacy: room seulement (mais on garde un refus si pas de room)
    if (!room) { showDenied(); return; }
  }

  socket.emit("overlay:join", { room, key, overlay: OVERLAY_TYPE });

  socket.on("overlay:forbidden", () => {
    showDenied();
  });

  socket.on("overlay:state", (payload) => {
    if (payload?.overlay !== OVERLAY_TYPE) return;

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
