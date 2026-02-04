/* ==========================================
   🔧 CONFIGURATION
========================================== */
const SERVER_URL = "https://magic-digital-impact-live.onrender.com";
const OVERLAY_TYPE = "decompte_bonhomme";

/* ==========================================
   🛠️ HELPERS
========================================== */
function cssVar(name, fallback = "") {
    return getComputedStyle(document.documentElement)
        .getPropertyValue(name)
        .trim()
        .replace(/^['"]+|['"]+$/g, "") || fallback;
}

/* ==========================================
   🌐 SOCKET.IO
========================================== */
const socket = io(SERVER_URL, { 
    transports: ['websocket', 'polling'] 
});

/* ==========================================
   📊 ÉTAT GLOBAL
========================================== */
let globalCount = 0;
let estAutorise = false;

/* ==========================================
   🎯 ÉLÉMENTS DOM
========================================== */
const scoreEl = document.getElementById('hero-score');
const diskEl = document.getElementById('score-disk');

/* ==========================================
   🚀 INITIALISATION
========================================== */
async function init() {
    console.log("[BONHOMME] Initialisation...");
    
    // Attendre 800ms pour laisser le CSS se charger
    await new Promise(r => setTimeout(r, 800));
    
    // Récupérer les identifiants depuis le CSS OBS
    const room = cssVar("--room-id");
    const key = cssVar("--room-key");

    if (!room || !key) { 
        console.error("[BONHOMME] ❌ Room ID ou Key manquant");
        showDenied(); 
        return; 
    }

    console.log(`[BONHOMME] 🔌 Connexion à la room: ${room}`);
    socket.emit('overlay:join', { 
        room, 
        key, 
        overlay: OVERLAY_TYPE 
    });

    // Écouter les événements Socket.io
    socket.on('overlay:forbidden', () => {
        console.error("[BONHOMME] ❌ Accès refusé");
        showDenied();
    });

    socket.on('overlay:state', (payload) => {
        if (payload?.overlay === OVERLAY_TYPE) {
            console.log("[BONHOMME] ✅ Overlay autorisé");
            showScene();
            estAutorise = true;
        }
    });

    socket.on('raw_vote', (data) => {
        if (!estAutorise) return;
        traiterMessage(data.vote);
    });
}

/* ==========================================
   💬 TRAITEMENT DES MESSAGES CHAT
========================================== */
function traiterMessage(msgRaw) {
    const msg = msgRaw.trim().toUpperCase();
    const triggers = cssVar("--hand-triggers", "MOI,OUI,1").toUpperCase().split(",");

    // Reset du compteur
    if (msg === "RESET") {
        console.log("[BONHOMME] 🔄 Reset du compteur");
        globalCount = 0;
        updateDisplay();
        return;
    }

    // Vérifier si le message contient un trigger
    const triggerFound = triggers.some(t => msg.includes(t.trim()));
    
    if (triggerFound) {
        globalCount++;
        console.log(`[BONHOMME] 👋 Nouveau vote ! Total: ${globalCount}`);
        updateDisplay();
    }
}

/* ==========================================
   🎨 MISE À JOUR DE L'AFFICHAGE
========================================== */
function updateDisplay() {
    if (!scoreEl) return;
    
    scoreEl.innerText = globalCount;
    
    // Ajustement responsive de la taille du texte
    const len = String(globalCount).length;
    if (len <= 2) {
        scoreEl.style.fontSize = "60px";
    } else if (len === 3) {
        scoreEl.style.fontSize = "48px";
    } else if (len === 4) {
        scoreEl.style.fontSize = "38px";
    } else {
        scoreEl.style.fontSize = "32px";
    }

    // Animation bump sur le disque
    diskEl.classList.remove('bump-anim');
    void diskEl.offsetWidth; // Force reflow
    diskEl.classList.add('bump-anim');
}

/* ==========================================
   🔒 GESTION SÉCURITÉ
========================================== */
function showDenied() {
    document.getElementById("security-screen").classList.remove("hidden");
    document.getElementById("scene").classList.add("hidden");
}

function showScene() {
    document.getElementById("security-screen").classList.add("hidden");
    document.getElementById("scene").classList.remove("hidden");
}

/* ==========================================
   🎬 DÉMARRAGE
========================================== */
init();
