const SERVER_URL = "https://magic-digital-impact-live.onrender.com";
const OVERLAY_TYPE = "decompte_bonhomme";

function cssVar(name, fallback = "") {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim().replace(/^['"]+|['"]+$/g, "") || fallback;
}

let globalCount = 0;
let estAutorise = false;
const scoreEl = document.getElementById('hero-score');
const diskEl = document.getElementById('score-disk');

const socket = io(SERVER_URL, { transports: ['websocket', 'polling'] });

async function init() {
    // DÉLAI NÉCESSAIRE pour laisser le socket se connecter
    await new Promise(r => setTimeout(r, 800));
    
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
    
    // RESPONSIVE TEXT
    const len = String(globalCount).length;
    if (len <= 2) scoreEl.style.fontSize = "60px";
    else if (len === 3) scoreEl.style.fontSize = "48px";
    else if (len === 4) scoreEl.style.fontSize = "38px";
    else scoreEl.style.fontSize = "32px";

    // Animation Pop sur le disque
    diskEl.classList.remove('bump-anim');
    void diskEl.offsetWidth; 
    diskEl.classList.add('bump-anim');
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
