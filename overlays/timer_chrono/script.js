/**
 * MDI TIMER/CHRONO - V1
 * - ZÉRO FLICKER : UI cachée tant que overlay:state OK + auth OK
 * - Sécurité : écran "ACCÈS REFUSÉ"
 * - Mode : chrono | timer (countdown)
 * - Paramétrage via CSS OBS
 * - Contrôle : socket "control:timer_chrono" + fallback triggers raw_vote
 */

const SERVER_URL = "https://magic-digital-impact-live.onrender.com";
const OVERLAY_TYPE = "timer_chrono";

/* ---------- CSS utils ---------- */
function cssVar(name, fallback = "") {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name);
  return v ? v.trim().replace(/^['"]+|['"]+$/g, "") : fallback;
}
function cssNum(name, fallback) {
  const n = Number(cssVar(name, ""));
  return Number.isFinite(n) ? n : fallback;
}
function cssOnOff(name, fallbackOn = true) {
  const v = (cssVar(name, "") || "").toLowerCase();
  if (!v) return fallbackOn;
  return v === "on" || v === "true" || v === "1";
}
function clamp(n,a,b){ return Math.max(a, Math.min(b,n)); }

/* ---------- UI ---------- */
const elSecurity = document.getElementById("security-screen");
const elApp = document.getElementById("app");
const elPanel = document.getElementById("panel");
const elTime = document.getElementById("time");

function setBootHidden(){
  elApp.classList.add("hidden");
  elSecurity.classList.add("hidden");
  document.body.style.backgroundColor = "transparent";
}
function showDenied(){
  elApp.classList.add("hidden");
  elSecurity.classList.remove("hidden");
  document.body.style.backgroundColor = "black";
}
function showReady(){
  elSecurity.classList.add("hidden");
  elApp.classList.remove("hidden");
  document.body.style.backgroundColor = "transparent";
}

/* ---------- Config (CSS OBS) ---------- */
let AUTH_MODE = "strict";
let ROOM_ID = "";
let ROOM_KEY = "";

let MODE = "timer"; // timer | chrono
let START_SECONDS = 60;

let TRG_START = "START";
let TRG_PAUSE = "PAUSE";
let TRG_RESET = "RESET";
let CMD_MATCH_MODE = "exact"; // exact | startswith | contains

function readAuthVars(){
  AUTH_MODE = (cssVar("--auth-mode","strict") || "strict").toLowerCase();
  ROOM_ID = cssVar("--room-id","");
  ROOM_KEY = cssVar("--room-key","");
}
function parseTimeToSeconds(raw){
  const t = (raw || "").toString().trim();
  if (!t) return 0;

  // format numérique pur => secondes
  if (/^\d+$/.test(t)) return clamp(parseInt(t,10), 0, 99*3600 + 59*60 + 59);

  // formats MM:SS ou HH:MM:SS
  const parts = t.split(":").map(p => p.trim());
  if (parts.some(p => !/^\d+$/.test(p))) return 0;

  if (parts.length === 2){
    const mm = parseInt(parts[0],10);
    const ss = parseInt(parts[1],10);
    return clamp(mm*60 + ss, 0, 99*3600 + 59*60 + 59);
  }
  if (parts.length === 3){
    const hh = parseInt(parts[0],10);
    const mm = parseInt(parts[1],10);
    const ss = parseInt(parts[2],10);
    return clamp(hh*3600 + mm*60 + ss, 0, 99*3600 + 59*60 + 59);
  }
  return 0;
}
function readConfig(){
  MODE = (cssVar("--mode","timer") || "timer").toLowerCase();
  MODE = (MODE === "chrono") ? "chrono" : "timer";

  START_SECONDS = parseTimeToSeconds(cssVar("--start-time","60"));
  if (!Number.isFinite(START_SECONDS)) START_SECONDS = 60;

  TRG_START = (cssVar("--trigger-start","START") || "START").trim();
  TRG_PAUSE = (cssVar("--trigger-pause","PAUSE") || "PAUSE").trim();
  TRG_RESET = (cssVar("--trigger-reset","RESET") || "RESET").trim();

  CMD_MATCH_MODE = (cssVar("--cmd-match-mode","exact") || "exact").trim().toLowerCase();
  if (!["exact","startswith","contains"].includes(CMD_MATCH_MODE)) CMD_MATCH_MODE = "exact";
}

function normalizeText(raw){
  return String(raw||"").replace(/\u00A0/g," ").replace(/\s+/g," ").trim();
}
function normKey(raw){ return normalizeText(raw).toUpperCase(); }
function cmdMatch(message, trigger){
  const msg = normKey(message);
  const trg = normKey(trigger);
  if (!msg || !trg) return false;
  if (CMD_MATCH_MODE === "exact") return msg === trg;
  if (CMD_MATCH_MODE === "startswith") return msg.startsWith(trg);
  return msg.includes(trg);
}

/* ---------- Time formatting ---------- */
function pad2(n){ return String(n).padStart(2,"0"); }
function formatSeconds(total){
  total = Math.max(0, Math.floor(total));
  const hh = Math.floor(total/3600);
  const mm = Math.floor((total%3600)/60);
  const ss = total%60;

  // Responsive au contenu : auto (HH:MM:SS si besoin)
  if (hh > 0) return `${pad2(hh)}:${pad2(mm)}:${pad2(ss)}`;
  if (mm > 0) return `${pad2(mm)}:${pad2(ss)}`;
  return `${ss}`; // SS seul
}

/* ---------- Engine ---------- */
let running = false;
let done = false;

// Chrono : elapsedSec
// Timer  : remainingSec
let elapsedSec = 0;
let remainingSec = START_SECONDS;

let lastTickPerf = 0;
let carryMs = 0;

function applyDisplay(){
  const val = (MODE === "chrono") ? elapsedSec : remainingSec;
  elTime.textContent = formatSeconds(val);
}

function resetEngine(){
  running = false;
  done = false;
  carryMs = 0;
  lastTickPerf = 0;

  elapsedSec = 0;
  remainingSec = START_SECONDS;

  elPanel.classList.remove("is-done");
  applyDisplay();
}

function startEngine(){
  if (done && MODE === "timer") return; // timer fini => reset d'abord
  if (running) return;
  running = true;
  lastTickPerf = performance.now();
  requestAnimationFrame(loop);
}

function pauseEngine(){
  running = false;
}

function togglePause(){
  if (running) pauseEngine();
  else startEngine();
}

function finishTimer(){
  done = true;
  running = false;
  remainingSec = 0;
  applyDisplay();

  if (cssOnOff("--done-pulse", true)){
    elPanel.classList.remove("is-done");
    // reflow
    void elPanel.offsetWidth;
    elPanel.classList.add("is-done");
  }
}

function loop(ts){
  if (!running) return;

  const dt = ts - lastTickPerf;
  lastTickPerf = ts;

  carryMs += dt;

  // tick à la seconde (robuste)
  while (carryMs >= 1000){
    carryMs -= 1000;

    if (MODE === "chrono"){
      elapsedSec += 1;
      if (elapsedSec > 99*3600 + 59*60 + 59) elapsedSec = 99*3600 + 59*60 + 59;
    } else {
      remainingSec -= 1;
      if (remainingSec <= 0){
        finishTimer();
        return;
      }
    }
  }

  applyDisplay();
  requestAnimationFrame(loop);
}

/* ---------- Socket / Control ---------- */
let socket = null;

function handleControl(payload){
  const action = (payload?.action || "").toString().toLowerCase();

  // action: set { mode?, startTime? }
  if (action === "set"){
    if (payload?.mode){
      MODE = (String(payload.mode).toLowerCase() === "chrono") ? "chrono" : "timer";
    }
    if (payload?.startTime != null){
      START_SECONDS = parseTimeToSeconds(String(payload.startTime));
    }
    resetEngine();
    return;
  }

  if (action === "start"){
    startEngine();
    return;
  }

  if (action === "pause" || action === "toggle"){
    togglePause();
    return;
  }

  if (action === "reset"){
    resetEngine();
    return;
  }
}

async function init(){
  setBootHidden();

  // attendre injection OBS
  await new Promise(r => setTimeout(r, 650));

  readAuthVars();
  readConfig();

  if (AUTH_MODE === "strict"){
    if (!ROOM_ID || !ROOM_KEY) { showDenied(); return; }
  } else {
    if (!ROOM_ID) { showDenied(); return; }
  }

  resetEngine();

  socket = io(SERVER_URL, { transports: ["websocket","polling"] });

  socket.emit("overlay:join", { room: ROOM_ID, key: ROOM_KEY, overlay: OVERLAY_TYPE });

  socket.on("overlay:forbidden", () => showDenied());

  socket.on("overlay:state", (payload) => {
    if (payload?.overlay !== OVERLAY_TYPE) return;

    // relire config à chaque state (OBS peut changer les vars)
    readConfig();
    resetEngine();
    showReady();
  });

  // Contrôle “propre” (Stream Deck -> server -> socket)
  socket.on("control:timer_chrono", (payload) => {
    handleControl(payload || {});
  });

  // Fallback via chat (si tu veux)
  socket.on("raw_vote", (data) => {
    const msg = normalizeText(data?.vote ?? "");
    if (!msg) return;

    // si tu veux désactiver le fallback chat : mets --chat-control: "off"
    const chatControl = cssOnOff("--chat-control", false); // défaut OFF
    if (!chatControl) return;

    if (cmdMatch(msg, TRG_START)) { startEngine(); return; }
    if (cmdMatch(msg, TRG_PAUSE)) { togglePause(); return; }
    if (cmdMatch(msg, TRG_RESET)) { resetEngine(); return; }
  });
}

init();