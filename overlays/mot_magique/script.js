const ADRESSE_SERVEUR = "https://magic-digital-impact-live.onrender.com";
const OVERLAY_TYPE = "mot_magique"; // <--- CE NOM DOIT ÊTRE DANS SUPABASE

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

    // On demande au serveur de rejoindre avec le type "mot_magique"
    socket.emit('overlay:join', { room, key, overlay: OVERLAY_TYPE });

    socket.on('overlay:forbidden', showDenied);
    
    socket.on('overlay:state', (payload) => {
        if (payload?.overlay === OVERLAY_TYPE) {
            estAutorise = true;
            participantsActifs = payload.room_count || 1;
            
            syncConfig(); // Prépare le texte avant affichage
            
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

    setInterval(syncConfig, 2000);
}

function syncConfig() {
    if (!estAutorise) return;
    const newDisplay = cssVar("--display-word", "VICTOIRE");
    // Mise à jour seulement si changement pour éviter le tressautement
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
