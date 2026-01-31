const SERVER_URL = "https://magic-digital-impact-live.onrender.com";
const OVERLAY_NAME = "roue_loto";

/* ---------------- CSS Vars ---------------- */
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
function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }

/* ---------------- Boot / Security ---------------- */
const elSecurity = document.getElementById("security-screen");
const elApp = document.getElementById("app");
const elWinnerName = document.getElementById("winnerName");

function setBootTransparent(){
  elSecurity.style.display = "none";
  elApp.style.display = "none";
  document.documentElement.classList.remove(
    "mdi-ready","mdi-denied","mdi-confetti","mdi-show-winner","mdi-pointer-flip"
  );
  document.documentElement.removeAttribute("data-pointer-side");
}
function showDenied(){
  document.documentElement.classList.remove("mdi-ready");
  document.documentElement.classList.add("mdi-denied");
  elApp.style.display = "none";
  elSecurity.style.display = "flex";
  document.body.style.backgroundColor = "black";
}
function showReady(){
  document.documentElement.classList.remove("mdi-denied");
  document.documentElement.classList.add("mdi-ready");
  elSecurity.style.display = "none";
  elApp.style.display = "grid";
  document.body.style.backgroundColor = "transparent";
}
function hideWinner(){
  document.documentElement.classList.remove("mdi-show-winner");
  elWinnerName.textContent = "";
}

/* ---------------- Config ---------------- */
let spinTrigger = "SPIN";
let resetTrigger = "RESET";
let collectStartTrigger = "INSCRIVEZ UN PSEUDO";
let collectStopTrigger  = "STOP INSCRIPTION";
let collectClearTrigger = "CLEAR INSCRIPTION";

let blockSpinWhileCollecting = true;
let spinCooldownMs = 1800;
let replayTtlMs = 300000;

let minNameLen = 1;
let maxNameLen = 18;
let maxParticipants = 48;

let clearOnStart = true;
let pointerSide = "right";
let collectWarmupMs = 1200;

function readConfig(){
  spinTrigger  = (cssVar("--spin-trigger","SPIN") || "SPIN").trim().toUpperCase();
  resetTrigger = (cssVar("--reset-trigger","RESET") || "RESET").trim().toUpperCase();

  collectStartTrigger = (cssVar("--collect-start-trigger","INSCRIVEZ UN PSEUDO") || "INSCRIVEZ UN PSEUDO").trim().toUpperCase();
  collectStopTrigger  = (cssVar("--collect-stop-trigger","STOP INSCRIPTION") || "STOP INSCRIPTION").trim().toUpperCase();
  collectClearTrigger = (cssVar("--collect-clear-trigger","CLEAR INSCRIPTION") || "CLEAR INSCRIPTION").trim().toUpperCase();

  blockSpinWhileCollecting = cssOnOff("--block-spin-while-collecting", true);

  spinCooldownMs = clamp(cssNum("--spin-cooldown-ms", 1800), 500, 12000);
  replayTtlMs = clamp(cssNum("--replay-ttl-ms", 300000), 30000, 900000);

  minNameLen = clamp(cssNum("--min-name-length", 1), 1, 6);
  maxNameLen = clamp(cssNum("--max-name-length", 18), 6, 40);
  maxParticipants = clamp(cssNum("--max-participants", 48), 4, 120);

  clearOnStart = cssOnOff("--clear-on-start", true);

  pointerSide = (cssVar("--pointer-side","right") || "right").trim().toLowerCase();
  pointerSide = (pointerSide === "left") ? "left" : "right";
  document.documentElement.setAttribute("data-pointer-side", pointerSide);

  const flip = cssOnOff("--pointer-rotate-180", true);
  document.documentElement.classList.toggle("mdi-pointer-flip", !!flip);

  collectWarmupMs = clamp(cssNum("--collect-warmup-ms", 1200), 0, 6000);
}

/* ---------------- TEXT-ONLY Anti replay (robuste avec user aléatoire) ---------------- */
function normTextKey(text){
  return String(text || "").trim().toUpperCase().replace(/\s+/g, " ");
}

const TTL_TEXT = new Map(); // textKey -> ts
function isReplayTTL_textOnly(text){
  const now = Date.now();
  const k = normTextKey(text);
  if (!k) return true;

  const prev = TTL_TEXT.get(k) || 0;
  if (prev && (now - prev) < replayTtlMs) return true;
  TTL_TEXT.set(k, now);

  if (TTL_TEXT.size > 1500){
    const limit = now - replayTtlMs;
    for (const [key, ts] of TTL_TEXT.entries()){
      if (ts < limit) TTL_TEXT.delete(key);
    }
  }
  return false;
}

/* ---------------- Barrier anti-reliquat ----------------
   Avant START : on ignore tout.
   Au START : on active COLLECTING mais on ignore aussi pendant warmupMs
              (reflush des vieux messages du chat).
*/
let phase = "IDLE"; // IDLE | COLLECTING | READY
let barrierUntilTs = 0;
const seenBeforeStart = new Set(); // textKey vu avant START (blacklist hard)

function noteBeforeStart(text){
  const k = normTextKey(text);
  if (k) seenBeforeStart.add(k);
}
function isBeforeStartText(text){
  return seenBeforeStart.has(normTextKey(text));
}

/* ---------------- Names ---------------- */
function normalizeName(raw){
  let t = String(raw || "").trim();
  t = t.replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim();
  return t;
}
function keyOf(name){ return normalizeName(name).toLowerCase(); }

function isValidName(name){
  const t = normalizeName(name);
  if (!t) return false;

  const up = t.toUpperCase();
  if (up === spinTrigger || up === resetTrigger) return false;
  if (up === collectStartTrigger || up === collectStopTrigger || up === collectClearTrigger) return false;
  if (/^[ABCD]$/.test(up)) return false;

  if (t.length < minNameLen || t.length > maxNameLen) return false;
  if (t.split(" ").filter(Boolean).length > 2) return false;

  if (!/^[0-9A-Za-zÀ-ÖØ-öø-ÿ _'’-]+$/.test(t)) return false;
  return true;
}

/* ---------------- Wheel render ---------------- */
const wheelCanvas = document.getElementById("wheel");
const wheelCtx = wheelCanvas.getContext("2d");

let wheelAngle = 0;
let spinning = false;
let spinStartTs = 0;
let spinDurationMs = 4200;
let spinStartAngle = 0;
let targetAngle = 0;

const basePalette = [
  "#2ecc71","#e74c3c","#3b82f6","#f1c40f",
  "#9b59b6","#1abc9c","#e67e22","#ec4899",
  "#22c55e","#ef4444","#60a5fa","#f59e0b"
];

let participants = [];
let winnerIndex = -1;

function resizeWheelCanvas(){
  const cssSize = cssNum("--wheel-size", 820);
  const dpr = Math.max(1, window.devicePixelRatio || 1);

  wheelCanvas.style.width = cssSize + "px";
  wheelCanvas.style.height = cssSize + "px";
  wheelCanvas.width = Math.floor(cssSize * dpr);
  wheelCanvas.height = Math.floor(cssSize * dpr);

  wheelCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawWheel();
}

function drawWheel(){
  const cssSize = cssNum("--wheel-size", 820);
  const stroke = cssNum("--wheel-stroke", 16);
  const textSize = cssNum("--wheel-text-size", 30);
  const textWeight = cssNum("--wheel-text-weight", 900);

  const W = cssSize, H = cssSize;
  const cx = W/2, cy = H/2;
  const r = (W/2) - stroke - 6;

  wheelCtx.clearRect(0,0,W,H);

  wheelCtx.save();
  wheelCtx.translate(cx, cy);
  wheelCtx.rotate(wheelAngle);

  if (participants.length === 0){
    wheelCtx.beginPath();
    wheelCtx.arc(0,0,r,0,Math.PI*2);
    wheelCtx.fillStyle = "rgba(10,15,30,0.65)";
    wheelCtx.fill();
    wheelCtx.lineWidth = stroke;
    wheelCtx.strokeStyle = "rgba(255,255,255,0.18)";
    wheelCtx.stroke();
    wheelCtx.restore();
    return;
  }

  const n = participants.length;
  const slice = (Math.PI*2) / n;

  for (let i=0;i<n;i++){
    const a0 = i*slice;
    const a1 = a0 + slice;

    wheelCtx.beginPath();
    wheelCtx.moveTo(0,0);
    wheelCtx.arc(0,0,r,a0,a1);
    wheelCtx.closePath();

    wheelCtx.fillStyle = basePalette[i % basePalette.length];
    wheelCtx.fill();

    if (i === winnerIndex){
      wheelCtx.save();
      wheelCtx.shadowColor = "rgba(255,255,255,0.65)";
      wheelCtx.shadowBlur = 22;
      wheelCtx.lineWidth = 10;
      wheelCtx.strokeStyle = "rgba(255,255,255,0.85)";
      wheelCtx.stroke();
      wheelCtx.restore();
    } else {
      wheelCtx.lineWidth = 2;
      wheelCtx.strokeStyle = "rgba(0,0,0,0.18)";
      wheelCtx.stroke();
    }

    const label = participants[i].name;
    const mid = a0 + slice/2;

    wheelCtx.save();
    wheelCtx.rotate(mid);

    wheelCtx.fillStyle = "rgba(255,255,255,0.96)";
    wheelCtx.font = `${textWeight} ${textSize}px Montserrat, sans-serif`;
    wheelCtx.textAlign = "left";
    wheelCtx.textBaseline = "middle";

    const maxChars = 14;
    const safeLabel = label.length > maxChars ? (label.slice(0, maxChars-1) + "…") : label;

    const tx = Math.max(120, r*0.26);
    wheelCtx.lineWidth = 4;
    wheelCtx.strokeStyle = "rgba(0,0,0,0.35)";
    wheelCtx.strokeText(safeLabel, tx, 0);
    wheelCtx.fillText(safeLabel, tx, 0);

    wheelCtx.restore();
  }

  wheelCtx.beginPath();
  wheelCtx.arc(0,0,r,0,Math.PI*2);
  wheelCtx.lineWidth = stroke;
  wheelCtx.strokeStyle = "rgba(255,255,255,0.22)";
  wheelCtx.stroke();

  wheelCtx.restore();
}

/* ---------------- Confetti ---------------- */
const confettiCanvas = document.getElementById("confetti");
const confettiCtx = confettiCanvas.getContext("2d");
let confetti = [];
let confettiEndTs = 0;

function resizeConfetti(){
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  confettiCanvas.width = Math.floor(window.innerWidth * dpr);
  confettiCanvas.height = Math.floor(window.innerHeight * dpr);
  confettiCtx.setTransform(dpr,0,0,dpr,0,0);
}

function rand01(){
  const u = new Uint32Array(1);
  crypto.getRandomValues(u);
  return u[0] / 0xFFFFFFFF;
}

function startConfetti(){
  if (!cssOnOff("--winner-confetti", true)) return;

  document.documentElement.classList.add("mdi-confetti");
  resizeConfetti();

  const density = clamp(cssNum("--confetti-density", 180), 30, 600);
  const dur = clamp(cssNum("--confetti-duration-ms", 2200), 600, 8000);

  confetti = [];
  confettiEndTs = performance.now() + dur;

  for (let i=0;i<density;i++){
    const x = rand01() * window.innerWidth;
    const y = -20 - rand01()*200;
    const s = 6 + rand01()*10;
    const vx = (rand01()-0.5)*2.2;
    const vy = 2.0 + rand01()*4.5;
    const rot = rand01()*Math.PI*2;
    const vr = (rand01()-0.5)*0.25;
    const col = basePalette[i % basePalette.length];
    confetti.push({x,y,s,vx,vy,rot,vr,col});
  }
  requestAnimationFrame(tickConfetti);
}

function tickConfetti(ts){
  confettiCtx.clearRect(0,0,window.innerWidth, window.innerHeight);
  if (ts >= confettiEndTs){
    document.documentElement.classList.remove("mdi-confetti");
    confetti = [];
    return;
  }
  for (const p of confetti){
    p.x += p.vx * 3.2;
    p.y += p.vy * 3.6;
    p.rot += p.vr;
    const t = (confettiEndTs - ts) / 500;
    const alpha = clamp(t, 0, 1);

    confettiCtx.save();
    confettiCtx.translate(p.x, p.y);
    confettiCtx.rotate(p.rot);
    confettiCtx.globalAlpha = alpha;
    confettiCtx.fillStyle = p.col;
    confettiCtx.fillRect(-p.s/2, -p.s/2, p.s, p.s*0.7);
    confettiCtx.restore();
  }
  requestAnimationFrame(tickConfetti);
}

/* ---------------- Session helpers ---------------- */
function clearAllForNewSession(){
  participants = [];
  winnerIndex = -1;
  spinning = false;
  wheelAngle = 0;
  hideWinner();
  drawWheel();
}

/* ---------------- Participants ---------------- */
function addParticipant(message){
  const clean = normalizeName(message);
  if (!isValidName(clean)) return;

  const k = keyOf(clean);
  if (participants.some(p => p.key === k)) return;
  if (participants.length >= maxParticipants) return;

  participants.push({ name: clean, key: k });
  winnerIndex = -1;
  hideWinner();
  drawWheel();
}

/* ---------------- Spin (blindé) ---------------- */
let lastSpinAt = 0;

function normalizeAngle(a){
  let x = a % (Math.PI*2);
  if (x < 0) x += Math.PI*2;
  return x;
}
function pickRandomIndex(n){
  const u = new Uint32Array(1);
  crypto.getRandomValues(u);
  return u[0] % n;
}
function pointerTargetAngle(){
  return (pointerSide === "left") ? Math.PI : 0;
}

function spin(){
  const now = Date.now();

  if (spinning) return;
  if (phase !== "READY") return;
  if (participants.length < 2) return;
  if (now - lastSpinAt < spinCooldownMs) return;

  lastSpinAt = now;
  hideWinner();
  spinning = true;

  const n = participants.length;
  const selected = pickRandomIndex(n);
  const slice = (Math.PI*2)/n;
  const selectedCenter = selected*slice + slice/2;

  const pointerAngle = pointerTargetAngle();
  const desired = pointerAngle - selectedCenter;

  const extraTurns = 6 + Math.floor(rand01()*4);
  const extra = extraTurns * Math.PI*2;

  spinStartAngle = wheelAngle;
  targetAngle = desired - extra;
  spinDurationMs = clamp(3800 + Math.floor(rand01()*2200), 3400, 6500);
  spinStartTs = performance.now();

  requestAnimationFrame(tickSpin);

  function tickSpin(ts){
    const t = clamp((ts - spinStartTs)/spinDurationMs, 0, 1);
    const e = 1 - Math.pow(1 - t, 3);

    wheelAngle = spinStartAngle + (targetAngle - spinStartAngle) * e;
    drawWheel();

    if (t < 1){
      requestAnimationFrame(tickSpin);
      return;
    }

    spinning = false;

    const ang = normalizeAngle(pointerAngle - wheelAngle);
    const idx = Math.floor(ang / slice) % n;
    winnerIndex = (idx + n) % n;

    drawWheel();
    elWinnerName.textContent = participants[winnerIndex]?.name || "";
    document.documentElement.classList.add("mdi-show-winner");
    startConfetti();
  }
}

/* ---------------- Socket / Auth ---------------- */
let socket = null;
let AUTH_MODE = "strict";
let ROOM_ID = "";
let ROOM_KEY = "";

function readAuthVars(){
  const s = getComputedStyle(document.documentElement);
  AUTH_MODE = (s.getPropertyValue("--auth-mode").trim().replace(/"/g,"") || "strict").toLowerCase();
  ROOM_ID = s.getPropertyValue("--room-id").trim().replace(/"/g,"") || "";
  ROOM_KEY = s.getPropertyValue("--room-key").trim().replace(/"/g,"") || "";
}

function initSocket(){
  socket = io(SERVER_URL, { transports: ["websocket","polling"] });

  socket.on("connect", () => {
    if (AUTH_MODE === "strict"){
      socket.emit("overlay:join", { room: ROOM_ID, key: ROOM_KEY, overlay: OVERLAY_NAME });
    } else {
      socket.emit("rejoindre_salle", ROOM_ID);
    }
  });

  socket.on("overlay:forbidden", () => showDenied());

  socket.on("overlay:state", (payload) => {
    if (!payload || payload.overlay !== OVERLAY_NAME) return;

    showReady();
    readConfig();

    if ((cssVar("--auto-reset","false") || "false") === "true"){
      clearAllForNewSession();
    } else {
      hideWinner();
      drawWheel();
    }

    // Reset logique de session
    phase = "IDLE";
    barrierUntilTs = 0;
    // seenBeforeStart: volontairement conservé pendant la vie de la page,
    // car il sert à blacklister l'historique du chat déjà relu.
  });

  socket.on("raw_vote", (data) => {
    if (!data) return;
    readConfig();

    const msg = String(data.vote || "").trim();
    if (!msg) return;

    // Anti-spam robuste: texte-only (user est aléatoire côté extension)
    if (isReplayTTL_textOnly(msg)) return;

    const up = normTextKey(msg);

    // ---- IDLE : on ignore tout, sauf les commandes START / CLEAR / RESET
    if (phase === "IDLE") {
      if (up === collectStartTrigger) {
        if (clearOnStart) clearAllForNewSession();
        hideWinner();
        phase = "COLLECTING";

        // barrière anti-reliquat : on ignore les "flush" de vieux messages
        barrierUntilTs = Date.now() + collectWarmupMs;

        // IMPORTANT: on ne “blackliste” pas le START lui-même,
        // sinon tu peux te bloquer sur un second START.
        return;
      }

      if (up === collectClearTrigger || up === resetTrigger) {
        clearAllForNewSession();
        phase = "IDLE";
        barrierUntilTs = 0;
        return;
      }

      // tout ce qu'on voit en IDLE = historisé comme reliquat
      noteBeforeStart(msg);
      return;
    }

    // ---- Après START : on ignore TOUT ce qui appartenait à l'historique
    // et on ignore aussi pendant la fenêtre warmup
    if (Date.now() < barrierUntilTs) {
      noteBeforeStart(msg);
      return;
    }
    if (isBeforeStartText(msg)) return;

    // ---- CLEAR / RESET : revient en IDLE (re-collect possible)
    if (up === collectClearTrigger || up === resetTrigger) {
      clearAllForNewSession();
      phase = "IDLE";
      barrierUntilTs = 0;
      return;
    }

    // ---- STOP : fige (READY)
    if (up === collectStopTrigger) {
      phase = "READY";
      return;
    }

    // ---- START pendant session : relance une nouvelle collecte
    if (up === collectStartTrigger) {
      if (clearOnStart) clearAllForNewSession();
      hideWinner();
      phase = "COLLECTING";
      barrierUntilTs = Date.now() + collectWarmupMs;
      return;
    }

    // ---- SPIN : uniquement READY, jamais en auto
    if (up === spinTrigger) {
      if (blockSpinWhileCollecting && phase === "COLLECTING") return;
      if (phase !== "READY") return;
      spin();
      return;
    }

    // ---- Inscription : uniquement COLLECTING
    if (phase !== "COLLECTING") return;
    addParticipant(msg);
  });
}

/* ---------------- Init ---------------- */
function init(){
  setBootTransparent();

  const poll = setInterval(() => {
    readAuthVars();
    readConfig();

    if (AUTH_MODE === "legacy"){
      if (!ROOM_ID) return;
      clearInterval(poll);
      resizeWheelCanvas();
      resizeConfetti();
      initSocket();
      return;
    }

    if (ROOM_ID && ROOM_KEY){
      clearInterval(poll);
      resizeWheelCanvas();
      resizeConfetti();
      initSocket();
    }
  }, 200);

  setTimeout(() => {
    readAuthVars();
    if (AUTH_MODE === "strict" && (!ROOM_ID || !ROOM_KEY)){
      showDenied();
    }
  }, 1400);

  window.addEventListener("resize", () => {
    resizeWheelCanvas();
    resizeConfetti();
  });

  resizeWheelCanvas();
  resizeConfetti();
  hideWinner();
  drawWheel();
}

init();
