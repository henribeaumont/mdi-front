const ADRESSE_SERVEUR = "https://magic-digital-impact-live.onrender.com";
const OVERLAY_TYPE = "mot_magique";

let estAutorise = false;
let triggerCount = 0;
let participantsActifs = 1;

const wordEl = document.getElementById("golden-word");
const containerEl = document.getElementById("container");
const securityEl = document.getElementById("security-screen");

const socket = io(ADRESSE_SERVEUR, { transports: ["websocket", "polling"] });

function cssVar(name, fallback) {
    let val = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return val ? val.replace(/^['"]+|['"]+$/g, "") : fallback;
}

async function init() {
    // Petit délai pour laisser OBS injecter le CSS
    await new Promise(r => setTimeout(r, 400));

    const room = cssVar("--room-id", "");
    const key = cssVar("--room-key", "");

    if (!room || !key) { 
        securityEl.classList.remove("hidden");
        return; 
    }

    socket.emit('overlay:join', { room, key, overlay: OVERLAY_TYPE });

    socket.on('overlay:forbidden', () => {
        securityEl.classList.remove("hidden");
    });
    
    socket.on('overlay:state', (payload) => {
        if (payload?.overlay === OVERLAY_TYPE) {
            estAutorise = true;
            participantsActifs = payload.room_count || 1;
            
            // 1. Appliquer les textes et config
            syncConfig(); 
            
            // 2. Afficher d'un seul coup
            containerEl.classList.add("ready");
        }
    });

    socket.on('room:user_count', (count) => {
        participantsActifs = count;
        updateLogic();
    });

    socket.on('raw_vote', (data) => {
        if (!estAutorise) return;
        const vote = String(data.vote || "").trim().toUpperCase();
        if (vote === "RESET") { resetSession(); return; }
        
        const trigger = cssVar("--trigger-chat", "GG").toUpperCase();
        if (vote === trigger) {
            triggerCount++;
            updateLogic();
        }
    });

    setInterval(syncConfig, 2000);
}

function syncConfig() {
    if (!estAutorise) return;
    const newDisplay = cssVar("--display-word", "VICTOIRE");
    if (wordEl.innerText !== newDisplay) {
        wordEl.innerText = newDisplay;
    }
    updateLogic();
}

function updateLogic() {
    const total = Math.max(1, participantsActifs);
    const ratio = Math.min(triggerCount, total) / total;
    const threshold = parseFloat(cssVar("--threshold", "0.9"));

    if (ratio >= threshold) {
        wordEl.classList.add("activated");
    } else {
        if (cssVar("--sticky", "false") !== "true") {
            wordEl.classList.remove("activated");
        }
    }
}

function resetSession() {
    triggerCount = 0;
    wordEl.classList.remove("activated");
    updateLogic();
}

init();
