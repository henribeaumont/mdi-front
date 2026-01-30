/**
 * MDI DECOMPTE BONHOMME - V5.5 SaaS
 * Écoute le canal universel 'raw_vote'
 */

const SERVER_URL = "https://magic-digital-impact-live.onrender.com";
const OVERLAY_TYPE = "decompte_bonhomme";

function cssVar(name, fallback = "") {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim().replace(/^['"]+|['"]+$/g, "") || fallback;
}

let globalCount = 0;
let estAutorise = false;
const scoreEl = document.getElementById('hero-score');

// --- CONNEXION SaaS ---
const socket = io(SERVER_URL, { transports: ['websocket', 'polling'] });

async function init() {
    await new Promise(r => setTimeout(r, 800)); // Attente OBS
    const room = cssVar("--room-id");
    const key = cssVar("--room-key");

    if (!room || !key) { showDenied(); return; }

    socket.emit('overlay:join', { room, key, overlay: OVERLAY_TYPE });

    socket.on('overlay:forbidden', showDenied);

    socket.on('overlay:state', (payload) => {
        if (payload?.overlay === OVERLAY_TYPE) {
            showScene();
            estAutorise = true;
        }
    });

    socket.on('raw_vote', (data) => {
        if (!estAutorise) return;
        traiterMessage(data.vote);
    });
}

function traiterMessage(msgRaw) {
    const msg = msgRaw.trim().toUpperCase();
    const triggers = cssVar("--hand-triggers", "MOI,OUI,1").toUpperCase().split(",");

    if (msg === "RESET") {
        globalCount = 0;
        updateDisplay();
        return;
    }

    if (triggers.some(t => msg.includes(t.trim()))) {
        globalCount++;
        updateDisplay();
    }
}

function updateDisplay() {
    if (!scoreEl) return;
    scoreEl.innerText = globalCount;
    
    // Animation Pop
    scoreEl.classList.remove('bump-anim');
    void scoreEl.offsetWidth; 
    scoreEl.classList.add('bump-anim');
}

function showDenied() {
    document.getElementById("security-screen").classList.remove("hidden");
    document.getElementById("scene").classList.add("hidden");
}

function showScene() {
    document.getElementById("security-screen").classList.add("hidden");
    document.getElementById("scene").classList.remove("hidden");
}

init();
