const ADRESSE_SERVEUR = "https://magic-digital-impact-live.onrender.com";
const OVERLAY_TYPE = "decompte_poker";

function cssVar(name, fallback = "") {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim().replace(/^['"]+|['"]+$/g, "") || fallback;
}

// --- CONFIGURATION ---
let globalCount = 0;
let estAutorise = false;
const container = document.getElementById('stacks-container');
const scoreEl = document.getElementById('floating-score');
const gameScene = document.getElementById('game-scene');

const socket = io(ADRESSE_SERVEUR, { transports: ['websocket', 'polling'] });

async function init() {
    await new Promise(r => setTimeout(r, 800)); // Attente OBS
    const room = cssVar("--room-id");
    const key = cssVar("--room-key");

    if (!room || !key) { showDenied(); return; }
    socket.emit('overlay:join', { room, key, overlay: OVERLAY_TYPE });

    socket.on('overlay:forbidden', showDenied);
    socket.on('overlay:state', (payload) => {
        if (payload?.overlay === OVERLAY_TYPE) {
            document.getElementById("security-screen").classList.add("hidden");
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
    const triggers = cssVar("--poker-triggers", "MOI,OUI,1").toUpperCase().split(",");

    if (msg === "RESET") { resetGame(); return; }
    if (triggers.some(t => msg.includes(t.trim()))) {
        ajouterJeton();
    }
}

function ajouterJeton() {
    globalCount++;
    scoreEl.innerText = globalCount;
    scoreEl.classList.remove('bump');
    void scoreEl.offsetWidth; 
    scoreEl.classList.add('bump');

    const stackLimit = parseInt(cssVar("--poker-stack-limit", "15"));
    const maxStacks = parseInt(cssVar("--poker-max-stacks", "8"));
    let stackIndex = Math.floor((globalCount - 1) / stackLimit);

    if (stackIndex >= maxStacks) {
        const lastStack = document.getElementById(`stack-${maxStacks - 1}`);
        if (lastStack) updateScorePosition(lastStack);
        return; 
    }

    let currentStack = document.getElementById(`stack-${stackIndex}`);
    if (!currentStack) {
        currentStack = document.createElement('div');
        currentStack.id = `stack-${stackIndex}`;
        currentStack.className = 'stack';
        container.appendChild(currentStack);
    }

    const chip = document.createElement('div');
    chip.className = 'chip';
    currentStack.appendChild(chip);
    updateScorePosition(currentStack);
}

function updateScorePosition(targetStack) {
    setTimeout(() => {
        const stackRect = targetStack.getBoundingClientRect();
        const containerRect = gameScene.getBoundingClientRect();
        const relativeLeft = stackRect.left - containerRect.left;
        const relativeBottom = targetStack.offsetHeight; 
        const centerOffset = (stackRect.width / 2) - (scoreEl.offsetWidth / 2);
        
        scoreEl.style.left = (relativeLeft + centerOffset) + "px";
        scoreEl.style.bottom = (relativeBottom + 20) + "px"; 
    }, 50);
}

function resetGame() {
    container.innerHTML = "";
    globalCount = 0;
    scoreEl.innerText = "0";
    scoreEl.style.left = "0px";
    scoreEl.style.bottom = "0px";
}

function showDenied() {
    document.getElementById("security-screen").classList.remove("hidden");
}

init();