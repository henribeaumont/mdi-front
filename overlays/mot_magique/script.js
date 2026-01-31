const ADRESSE_SERVEUR = "https://magic-digital-impact-live.onrender.com";
const OVERLAY_TYPE = "mot_magique";

let estAutorise = false;
let triggerCount = 0;

// Config par défaut
let CONFIG = {
    display: "VICTOIRE",
    trigger: "GG",
    threshold: 0.8,
    participantsTotal: 10,
    sticky: false,
    showStats: false
};

const wordEl = document.getElementById("golden-word");
const statsEl = document.getElementById("stats");
const containerEl = document.getElementById("container");
const securityEl = document.getElementById("security-screen");

function cssVar(name, fallback) {
    let val = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    if (!val) return fallback;
    return val.replace(/^['"]+|['"]+$/g, "");
}

const socket = io(ADRESSE_SERVEUR, { transports: ["websocket", "polling"] });

async function init() {
    await new Promise(r => setTimeout(r, 800)); // Attente OBS
    const room = cssVar("--room-id", "");
    const key = cssVar("--room-key", "");

    if (!room || !key) { showDenied(); return; }

    socket.emit('overlay:join', { room, key, overlay: OVERLAY_TYPE });

    socket.on('overlay:forbidden', showDenied);
    socket.on('overlay:state', (payload) => {
        if (payload?.overlay === OVERLAY_TYPE) {
            estAutorise = true;
            securityEl.classList.add("hidden");
            containerEl.classList.remove("hidden");
            syncConfig();
        }
    });

    socket.on('raw_vote', (data) => {
        if (!estAutorise) return;
        const vote = String(data.vote || "").trim().toUpperCase();
        
        if (vote === "RESET") { resetSession(); return; }
        if (vote === CONFIG.trigger) {
            triggerCount++;
            updateLogic();
        }
    });

    // Sync continue de la config (pour changements en direct dans OBS)
    setInterval(syncConfig, 1000);
}

function syncConfig() {
    if (!estAutorise) return;
    const styles = getComputedStyle(document.documentElement);
    
    CONFIG.display = cssVar("--display-word", "VICTOIRE");
    CONFIG.trigger = cssVar("--trigger-chat", "GG").toUpperCase();
    CONFIG.threshold = parseFloat(styles.getPropertyValue("--threshold")) || 0.8;
    CONFIG.participantsTotal = parseInt(styles.getPropertyValue("--participants-total")) || 10;
    
    const stickyRaw = cssVar("--sticky", "false");
    CONFIG.sticky = (stickyRaw === "true" || stickyRaw === "1");
    
    const statsRaw = cssVar("--show-stats", "false");
    CONFIG.showStats = (statsRaw === "true" || statsRaw === "1");

    if (wordEl.innerText !== CONFIG.display) wordEl.innerText = CONFIG.display;
    updateLogic();
}

function updateLogic() {
    const total = Math.max(1, CONFIG.participantsTotal);
    const clampedCount = Math.min(triggerCount, total);
    const ratio = clampedCount / total;
    const percent = Math.round(ratio * 100);

    if (CONFIG.showStats) {
        statsEl.classList.remove("hidden");
        statsEl.innerText = `${percent}% (${clampedCount}/${total})`;
    } else {
        statsEl.classList.add("hidden");
    }

    if (ratio >= CONFIG.threshold) {
        wordEl.classList.add("activated");
    } else {
        if (!CONFIG.sticky) wordEl.classList.remove("activated");
    }
}

function resetSession() {
    triggerCount = 0;
    wordEl.classList.remove("activated");
    updateLogic();
}

function showDenied() {
    securityEl.classList.remove("hidden");
    containerEl.classList.add("hidden");
}

init();