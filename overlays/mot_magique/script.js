const ADRESSE_SERVEUR = "https://magic-digital-impact-live.onrender.com";
const OVERLAY_TYPE = "mot_magique";

let estAutorise = false;
let triggerCount = 0;
let participantsActifs = 1;
let currentProgress = 0;
let currentRoom = "";

// Config pilotable depuis la télécommande (priorité sur les CSS vars OBS)
let CONFIG = { word: "MOTIVÉ", trigger: "GO", threshold: 0.8 };

const wordEl = document.getElementById("golden-word");
const containerEl = document.getElementById("container");
const securityEl = document.getElementById("security-screen");

const socket = io(ADRESSE_SERVEUR, { transports: ["websocket", "polling"] });

socket.on("connect", () => {
    if (currentRoom) socket.emit("overlay:online", { room: currentRoom, overlay: OVERLAY_TYPE });
});

function cssVar(name, fallback) {
    let val = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return val ? val.replace(/^['"]+|['"]+$/g, "") : fallback;
}

// Parse une couleur hex (#rrggbb, #rgb) ou rgb(r,g,b) en {r, g, b}
function parseColor(str) {
    str = (str || "#888888").trim().replace(/^['"]|['"]$/g, "");
    let m = str.match(/^#([0-9a-fA-F]{6})$/);
    if (m) {
        const n = parseInt(m[1], 16);
        return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    }
    m = str.match(/^#([0-9a-fA-F]{3})$/);
    if (m) {
        const h = m[1];
        return { r: parseInt(h[0]+h[0], 16), g: parseInt(h[1]+h[1], 16), b: parseInt(h[2]+h[2], 16) };
    }
    m = str.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
    if (m) return { r: +m[1], g: +m[2], b: +m[3] };
    return { r: 136, g: 136, b: 136 };
}

// Interpolation linéaire entre deux couleurs
function lerpColor(a, b, t) {
    return {
        r: Math.round(a.r + (b.r - a.r) * t),
        g: Math.round(a.g + (b.g - a.g) * t),
        b: Math.round(a.b + (b.b - a.b) * t)
    };
}

// Met à jour l'affichage selon progress (0 = état initial, 1 = état final)
function updateVisuals(progress) {
    const startSize = parseFloat(cssVar("--start-size", "72")) || 72;
    const endSize   = parseFloat(cssVar("--end-size",   "140")) || 140;
    const currentSize = startSize + (endSize - startSize) * progress;
    wordEl.style.fontSize = `${currentSize.toFixed(2)}px`;

    const startColor = parseColor(cssVar("--start-color", "#6b6b6b"));
    const endColor   = parseColor(cssVar("--end-color",   "#ffd700"));
    const col = lerpColor(startColor, endColor, progress);
    wordEl.style.color = `rgb(${col.r},${col.g},${col.b})`;

    if (progress > 0) {
        const sa = (progress * 0.85).toFixed(2);
        const wa = (progress * 0.40).toFixed(2);
        const r = endColor.r, g = endColor.g, b = endColor.b;
        wordEl.style.textShadow =
            `0 0 ${Math.round(15 * progress)}px rgba(${r},${g},${b},${sa}), ` +
            `0 0 ${Math.round(35 * progress)}px rgba(255,255,255,${wa})`;
    } else {
        wordEl.style.textShadow = "";
    }

    if (progress >= 1) {
        wordEl.classList.add("shimmer");
    } else {
        wordEl.classList.remove("shimmer");
    }
}

function applyServerConfig(data) {
    // Priorité : données télécommande > CSS vars OBS > valeurs par défaut
    CONFIG.word      = data?.word      || cssVar("--display-word", "MOTIVÉ");
    CONFIG.trigger   = (data?.trigger  || cssVar("--trigger-chat",  "GO")).toUpperCase();
    CONFIG.threshold = data?.threshold != null
        ? data.threshold
        : (parseFloat(cssVar("--threshold", "0.8")) || 0.8);
}

async function init() {
    await new Promise(r => setTimeout(r, 400));

    const room = cssVar("--room-id", "");
    const key  = cssVar("--room-key", "");

    if (!room || !key) {
        securityEl.classList.remove("hidden");
        return;
    }

    currentRoom = room;
    socket.emit('overlay:join', { room, key, overlay: OVERLAY_TYPE });
    socket.emit('overlay:online', { room, overlay: OVERLAY_TYPE });

    socket.on('overlay:forbidden', () => {
        securityEl.classList.remove("hidden");
    });

    socket.on('overlay:state', (payload) => {
        if (payload?.overlay !== OVERLAY_TYPE) return;

        if (payload.state === "idle") {
            estAutorise = false;
            triggerCount = 0;
            currentProgress = 0;
            updateVisuals(0);
            containerEl.classList.remove("ready");
            return;
        }

        estAutorise = true;
        participantsActifs = payload.room_count || 1;

        applyServerConfig(payload.data);
        syncConfig();
        containerEl.classList.add("ready");
    });

    socket.on('room:user_count', (count) => {
        participantsActifs = count;
        updateLogic();
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

    setInterval(syncConfig, 2000);
}

function syncConfig() {
    if (!estAutorise) return;
    if (wordEl.innerText !== CONFIG.word) {
        wordEl.innerText = CONFIG.word;
    }
    updateLogic();
}

function updateLogic() {
    const offset    = Math.max(0, parseInt(cssVar("--participants-offset", "2")) || 0);
    const total     = Math.max(1, participantsActifs - offset);
    const threshold = CONFIG.threshold;

    const ratio    = Math.min(triggerCount, total) / total;
    const progress = Math.min(ratio / threshold, 1.0);

    if (cssVar("--sticky", "false") === "true") {
        currentProgress = Math.max(currentProgress, progress);
    } else {
        currentProgress = progress;
    }

    updateVisuals(currentProgress);
}

function resetSession() {
    triggerCount = 0;
    currentProgress = 0;
    updateVisuals(0);
}

init();
