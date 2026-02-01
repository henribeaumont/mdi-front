/**
 * MDI WORD CLOUD - V6.1 DEBUG FORCE
 * - Affiche les logs de connexion directement sur l'écran
 * - Tolérance maximale sur les variables CSS
 */

const SERVER_URL = "https://magic-digital-impact-live.onrender.com";
const OVERLAY_TYPE = "word_cloud";

/* --- LECTEUR CONFIG --- */
function cssVar(name, fallback = "") {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name);
    return v ? v.trim().replace(/^['"]+|['"]+$/g, "") : fallback;
}

// Zone de log pour voir ce qui se passe dans OBS
const debugDiv = document.createElement('div');
debugDiv.style = "position:absolute; top:10px; left:10px; color:white; font-family:monospace; font-size:12px; background:rgba(0,0,0,0.7); z-index:9999; padding:10px; border-radius:5px;";
document.body.appendChild(debugDiv);

function logDebug(msg) {
    debugDiv.innerHTML += `<div>> ${msg}</div>`;
    console.log(msg);
}

/* --- UI --- */
const zone = document.getElementById("word-zone");
const container = document.getElementById("cloud-container");

function showCloud() {
    document.getElementById("security-screen").classList.add("hidden");
    container.classList.remove("hidden");
}

/* --- LOGIQUE --- */
let dbMots = {};

function traiterMessage(v) {
    logDebug(`Message reçu: ${v}`);
    let texte = String(v).trim();

    // Filtre simple pour test
    if (!texte.startsWith("#")) {
        logDebug("Ignoré: pas de #");
        return;
    }

    const mot = texte.replace("#", "").trim().toUpperCase();
    if (!dbMots[mot]) dbMots[mot] = { count: 0 };
    dbMots[mot].count++;

    renderSimple();
}

function renderSimple() {
    zone.innerHTML = "";
    Object.keys(dbMots).forEach((m, i) => {
        const div = document.createElement("div");
        div.className = "mot mdi-in";
        div.style = `position:absolute; left:50%; top:${50 + (i*40)}px; color:white; font-size:30px; transform:translateX(-50%);`;
        div.innerText = `${m} (${dbMots[m].count})`;
        zone.appendChild(div);
    });
}

/* --- CONNEXION --- */
logDebug("Initialisation socket...");
const socket = io(SERVER_URL, { transports: ["websocket"] });

async function init() {
    await new Promise(r => setTimeout(r, 1000));
    
    const room = cssVar("--room-id", "H_Perso");
    const key = cssVar("--room-key", "H2208");

    logDebug(`Tentative Join Room: ${room}`);
    socket.emit("overlay:join", { room, key, overlay: OVERLAY_TYPE });

    socket.on("connect", () => logDebug("✅ Serveur Connecté !"));
    socket.on("connect_error", (e) => logDebug(`❌ Erreur Connexion: ${e.message}`));

    socket.on("overlay:state", (p) => {
        logDebug("📩 État reçu du serveur");
        showCloud();
    });

    socket.on("raw_vote", (data) => {
        traiterMessage(data.vote);
    });

    socket.on("overlay:forbidden", () => logDebug("❌ Erreur: Clé/Room invalide"));
}

init();
