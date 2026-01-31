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

// Initialisation immédiate sans délai d'attente
function init() {
    const room = cssVar("--room-id", "");
    const key = cssVar("--room-key", "");

    if (!room || !key) { showDenied(); return; }

    socket.emit('overlay:join', { room, key, overlay: OVERLAY_TYPE });

    socket.on('overlay:forbidden', showDenied);
    
    socket.on('overlay:state', (payload) => {
        if (payload?.overlay === OVERLAY_TYPE) {
            estAutorise = true;
            participantsActifs = payload.room_count || 1;
            
            // On pré-remplit les valeurs AVANT d'afficher
            syncConfig(); 
            
            // AFFICHAGE UNIQUE : Fini le tressautement
            securityEl.classList.add("hidden");
            containerEl.classList.remove("hidden");
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
        if (vote === cssVar("--trigger-chat", "GG").toUpperCase()) {
            triggerCount++;
            updateLogic();
        }
    });

    setInterval(syncConfig, 2000);
}

function syncConfig() {
    if (!estAutorise) return;
    const newDisplay = cssVar("--display-word", "VICTOIRE");
    if (wordEl.innerText !== newDisplay) wordEl.innerText = newDisplay;
    updateLogic();
}

function updateLogic() {
    const total = Math.max(1, participantsActifs);
    const ratio = Math.min(triggerCount, total) / total;
    const threshold = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--threshold")) || 0.9;

    if (ratio >= threshold) wordEl.classList.add("activated");
    else if (cssVar("--sticky", "false") !== "true") wordEl.classList.remove("activated");
}

function showDenied() {
    containerEl.classList.add("hidden");
    securityEl.classList.remove("hidden");
}

function resetSession() {
    triggerCount = 0;
    wordEl.classList.remove("activated");
    updateLogic();
}

init();
