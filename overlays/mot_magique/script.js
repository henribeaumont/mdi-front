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
            
            // On synchronise le texte AVANT d'afficher le container
            syncConfig(); 
            
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
        
        const trigger = cssVar("--trigger-chat", "GG").toUpperCase();
        if (vote === trigger) {
            triggerCount++;
            updateLogic();
        }
    });

    // Synchronisation périodique des variables CSS OBS
    setInterval(syncConfig, 2000);
}

function syncConfig() {
    if (!estAutorise) return;
    const newDisplay = cssVar("--display-word", "VICTOIRE");
    
    // Évite le tressautement en ne mettant à jour que si nécessaire
    if (wordEl.innerText !== newDisplay) {
        wordEl.innerText = newDisplay;
    }
    updateLogic();
}

function updateLogic() {
    const total = Math.max(1, participantsActifs);
    const clampedCount = Math.min(triggerCount, total);
    const ratio = clampedCount / total;
    
    const threshold = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--threshold")) || 0.9;
    const showStats = cssVar("--show-stats", "false") === "true";

    const statsEl = document.getElementById("stats");
    if (showStats) {
        statsEl.classList.remove("hidden");
        statsEl.innerText = `${Math.round(ratio * 100)}% (${clampedCount}/${total})`;
    } else {
        statsEl.classList.add("hidden");
    }

    if (ratio >= threshold) {
        wordEl.classList.add("activated");
    } else {
        if (cssVar("--sticky", "false") !== "true") {
            wordEl.classList.remove("activated");
        }
    }
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
