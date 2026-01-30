// MDI COMPTEUR DE MAINS - V5.5 SaaS
// Compte les votes sur un mot-clé et affiche des bonhommes avec la main levée.

const SERVER_URL = "https://magic-digital-impact-live.onrender.com";
const OVERLAY_TYPE = "count_hands"; // Doit correspondre au type d'overlay dans OBS CSS

// ---------- Helpers CSS (Récupération des variables OBS) ----------
function cssVar(name, fallback = "") {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim().replace(/^['"]+|['"]+$/g, "");
}
function stripQuotes(s) {
  return String(s || "").trim().replace(/^['"]+|['"]+$/g, "");
}
function lower(s) {
  return stripQuotes(s).toLowerCase();
}
function cssInt(name, fallback) {
  const v = parseInt(stripQuotes(cssVar(name, "")), 10);
  return Number.isFinite(v) ? v : fallback;
}
function cssNum(name, fallback) {
    const v = parseFloat(stripQuotes(cssVar(name, "")));
    return Number.isFinite(v) ? v : fallback;
}


// ---------- Auth & Triggers config ----------
function readConfig() {
  const room = stripQuotes(cssVar("--room-id", "DEMO_CLIENT"));
  const key = stripQuotes(cssVar("--room-key", ""));
  const triggersRaw = stripQuotes(cssVar("--hand-triggers", "QUI,OUI,MOI,ME"));
  
  return { 
    room, 
    key, 
    overlay: OVERLAY_TYPE, 
    triggers: triggersRaw.toUpperCase().split(",").map(t => t.trim()).filter(Boolean),
    titleText: stripQuotes(cssVar("--hand-title-text", "Mains levées")),
    personSize: cssInt("--hand-person-size", 70), // Taille du personnage
    maxDisplayCount: cssInt("--hand-max-display", 20), // Max personnes à afficher
    autoReset: lower(cssVar("--hand-auto-reset", "true")) === "true",
    
    // Couleurs des bonhommes
    fillHead: cssVar("--hand-fill-head", "#FBCFE8"),
    strokeHead: cssVar("--hand-stroke-head", "#be185d"),
    fillBody: cssVar("--hand-fill-body", "#FBCFE8"),
    strokeBody: cssVar("--hand-stroke-body", "#be185d"),
    textColor: cssVar("--hand-text-color", "#ffffff"),
  };
}

// ---------- UI / Sécurité ----------
let estAutorise = false;
let hardForbidden = false;
let currentConfig = null; // Stocke la config lue au démarrage

function showSecurity(show) {
  const deny = document.getElementById("security-screen");
  if (!deny) return;
  if (show) {
    deny.classList.remove("hidden");
    document.body.style.backgroundColor = "black";
  } else {
    deny.classList.add("hidden");
    document.body.style.backgroundColor = "transparent";
  }
}

function hardLock() {
  hardForbidden = true;
  estAutorise = false;
  showSecurity(true);
}

function unlock() {
  if (hardForbidden) return;
  estAutorise = true;
  showSecurity(false);
  if (currentConfig.autoReset) {
      resetCounter(); // Reset si auto-reset est activé
  }
}

// ---------- Moteur de dessin (Canvas) ----------
const canvas = document.getElementById('mainCanvas');
const ctx = canvas.getContext('2d');

let count = 0;
let lastDrawTime = 0;
let animateFrame = null;

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    draw();
}

// Nouveau dessin de personnage (main levée)
function drawPerson(ctx, x, y, size, fillHead, strokeHead, fillBody, strokeBody) {
    const headRadius = size * 0.2;
    const bodyWidth = size * 0.5;
    const bodyHeight = size * 0.6;
    const armLength = size * 0.4;
    const armWidth = size * 0.15;

    // Corps
    ctx.fillStyle = fillBody;
    ctx.strokeStyle = strokeBody;
    ctx.lineWidth = 3;
    ctx.fillRect(x - bodyWidth / 2, y + headRadius, bodyWidth, bodyHeight);
    ctx.strokeRect(x - bodyWidth / 2, y + headRadius, bodyWidth, bodyHeight);

    // Tête
    ctx.beginPath();
    ctx.arc(x, y + headRadius, headRadius, 0, Math.PI * 2);
    ctx.fillStyle = fillHead;
    ctx.fill();
    ctx.strokeStyle = strokeHead;
    ctx.stroke();

    // Bras levé
    ctx.beginPath();
    ctx.moveTo(x + bodyWidth / 2 - 2, y + headRadius + armLength * 0.3);
    ctx.lineTo(x + bodyWidth / 2 + armLength, y + headRadius - armLength * 0.7);
    ctx.lineWidth = armWidth;
    ctx.lineCap = 'round';
    ctx.stroke();
}


function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!estAutorise) return;

    const cfg = currentConfig;
    const personSize = cfg.personSize;
    const maxCols = Math.floor(canvas.width / (personSize + 10)); // + espace
    const maxRows = Math.floor(canvas.height / (personSize + 10));
    
    let currentX = 20;
    let currentY = canvas.height - 20 - personSize; // Commence en bas
    let countDisplayed = 0;

    ctx.font = `900 ${cssInt("--hand-title-font-size", 48)}px Montserrat`;
    ctx.fillStyle = cfg.textColor;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(cfg.titleText, 20, 20);

    ctx.font = `900 ${cssInt("--hand-count-font-size", 80)}px Montserrat`;
    ctx.fillText(count.toString(), 20, 20 + cssInt("--hand-title-font-size", 48) + 10); // Sous le titre

    for (let i = 0; i < count && i < cfg.maxDisplayCount; i++) {
        if (currentX + personSize > canvas.width - 20) {
            currentX = 20;
            currentY -= (personSize + 10); // Remonte d'une ligne
            if (currentY < 20 + cssInt("--hand-title-font-size", 48) + cssInt("--hand-count-font-size", 80) + 20) {
                // Arrêter si on dépasse la zone du texte du titre
                break; 
            }
        }
        
        drawPerson(
            ctx,
            currentX + personSize / 2, 
            currentY - personSize / 2, // Centrer le personnage
            personSize,
            cfg.fillHead, cfg.strokeHead, cfg.fillBody, cfg.strokeBody
        );
        currentX += (personSize + 10);
        countDisplayed++;
    }
}

function incrementCounter() {
    count++;
    draw();
}

function resetCounter() {
    count = 0;
    draw();
}

// ---------- Initialisation & Sockets ----------
const socket = io(SERVER_URL, { transports: ["websocket", "polling"] });

async function start() {
  await new Promise(r => setTimeout(r, 1000));
  currentConfig = readConfig(); // Lecture des réglages OBS au démarrage

  socket.on("connect", () => {
    socket.emit("overlay:join", { room: currentConfig.room, key: currentConfig.key, overlay: currentConfig.overlay });
  });

  socket.on("overlay:forbidden", () => hardLock());
  
  socket.on("overlay:state", (payload) => {
    if (payload?.overlay === currentConfig.overlay) {
      unlock();
    }
  });

  socket.on("raw_vote", (data) => {
    const msg = data.vote.toUpperCase().trim();
    if (msg === "RESET") {
        resetCounter();
        return;
    }
    if (currentConfig.triggers.some(t => msg.includes(t))) {
      incrementCounter();
    }
  });

  window.addEventListener('resize', resizeCanvas);
  resizeCanvas(); // Appel initial pour dessiner
}

start().catch(e => console.error("Compteur de Mains Erreur:", e));