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
let collectStopTrigger  = "PRET?";
let collectClearTrigger = "CLEAR INSCRIPTION";

let cmdMatchMode = "exact"; // exact | startsWith | contains
let spinCooldownMs = 1800;
let blockSpinWhileCollecting = true;
let clearOnStart = true;

let minNameLen = 1;
let maxNameLen = 18;
let maxParticipants = 48;

/* Anti-reliquat robust: baseline index size */
let baselineMaxMessages = 6000;

/* Sens de rotation: cw (droite) / ccw (gauche) */
let spinDirection = "cw"; // cw | ccw

let pointerSide = "right";

function readConfig(){
  spinTrigger  = (cssVar("--spin-trigger","SPIN") || "SPIN").trim();
  resetTrigger = (cssVar("--reset-trigger","RESET") || "RESET").trim();

  collectStartTrigger = (cssVar("--collect-start-trigger","INSCRIVEZ UN PSEUDO") || "INSCRIVEZ UN PSEUDO").trim();
  collectStopTrigger  = (cssVar("--collect-stop-trigger","PRET?") || "PRET?").trim();
  collectClearTrigger = (cssVar("--collect-clear-trigger","CLEAR INSCRIPTION") || "CLEAR INSCRIPTION").trim();

  cmdMatchMode = (cssVar("--cmd-match-mode","exact") || "exact").trim().toLowerCase();
  if (!["exact","startswith","contains"].includes(cmdMatchMode)) cmdMatchMode = "exact";

  spinCooldownMs = clamp(cssNum("--spin-cooldown-ms", 1800), 500, 12000);
  blockSpinWhileCollecting = cssOnOff("--block-spin-while-collecting", true);
  clearOnStart = cssOnOff("--clear-on-start", true);

  minNameLen = clamp(cssNum("--min-name-length", 1), 1, 6);
  maxNameLen = clamp(cssNum("--max-name-length", 18), 6, 40);
  maxParticipants = clamp(cssNum("--max-participants", 48), 4, 200);

  baselineMaxMessages = clamp(cssNum("--baseline-max-messages", 6000), 500, 20000);

  spinDirection = (cssVar("--spin-direction","cw") || "cw").trim().toLowerCase();
  spinDirection = (spinDirection === "ccw") ? "ccw" : "cw";

  pointerSide = (cssVar("--pointer-side","right") || "right").trim().toLowerCase();
  pointerSide = (pointerSide === "left") ? "left" : "right";
  document.documentElement.setAttribute("data-pointer-side", pointerSide);

  const flipPointer = cssOnOff("--pointer-rotate-180", true);
  document.documentElement.classList.toggle("mdi-pointer-flip", !!flipPointer);
}

/* ---------------- Text normalization / command match ---------------- */
function normalizeText(raw){
  let t = String(raw || "");
  t = t.replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim();
  return t;
}
function normKey(raw){
  return normalizeText(raw).toUpperCase();
}
function extractPayload(text){
  const t = normalizeText(text);
  const m = t.match(/^.{1,24}:\s*(.+)$/); // "Name: payload"
  if (m && m[1]) return m[1].trim();
  return t;
}
function cmdMatch(message, trigger){
  const msg = normKey(extractPayload(message));
  const trg = normKey(trigger);
  if (!msg || !trg) return false;

  if (cmdMatchMode === "exact") return msg === trg;
  if (cmdMatchMode === "startswith") return msg.startsWith(trg);
  return msg.includes(trg); // contains
}

/* ---------------- Robust anti-reliquat baseline ---------------- */
class LRUSet {
  constructor(max = 5000){
    this.max = max;
    this.map = new Map(); // key -> true
  }
  has(key){ return this.map.has(key); }
  add(key){
    if (!key) return;
    if (this.map.has(key)) {
      this.map.delete(key);
      this.map.set(key, true);
      return;
    }
    this.map.set(key, true);
    while (this.map.size > this.max){
      const oldest = this.map.keys().next().value;
      this.map.delete(oldest);
    }
  }
  clear(){ this.map.clear(); }
  snapshotSet(){ return new Set(this.map.keys()); }
  setMax(n){
    this.max = n;
    while (this.map.size > this.max){
      const oldest = this.map.keys().next().value;
      this.map.delete(oldest);
    }
  }
}

const preStartIndex = new LRUSet(6000);
let baselineSet = new Set();

/* ---------------- Names ---------------- */
function keyOfName(name){ return normalizeText(name).toLowerCase(); }

function isValidName(raw){
  const t = normalizeText(extractPayload(raw));
  if (!t) return false;

  // Interdit si commande
  if (cmdMatch(t, collectStartTrigger)) return false;
  if (cmdMatch(t, collectStopTrigger))  return false;
  if (cmdMatch(t, spinTrigger))         return false;
  if (cmdMatch(t, collectClearTrigger)) return false;
  if (cmdMatch(t, resetTrigger))        return false;

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

    // ✅ IMPORTANT : définir la police AVANT de dessiner (sinon texte minuscule)
    wheelCtx.fillStyle = "rgba(255,255,255,0.96)";
    wheelCtx.font = `${textWeight} ${textSize}px Montserrat, sans-serif`;
    wheelCtx.textBaseline = "middle";
    wheelCtx.lineWidth = 4;
    wheelCtx.strokeStyle = "rgba(0,0,0,0.35)";

    const maxChars = 14;
    const safeLabel = label.length > maxChars ? (label.slice(0, maxChars-1) + "…") : label;

    const tx = Math.max(120, r*0.26);

    // ✅ Flip 180° SANS changer de camembert :
    // on retourne l’axe, puis on écrit à -tx avec align right.
    const flipLabel = cssOnOff("--label-rotate-180", false);
    if (flipLabel) {
      wheelCtx.rotate(Math.PI);
      wheelCtx.textAlign = "right";
      wheelCtx.strokeText(safeLabel, -tx, 0);
      wheelCtx.fillText(safeLabel, -tx, 0);
    } else {
      wheelCtx.textAlign = "left";
      wheelCtx.strokeText(safeLabel, tx, 0);
      wheelCtx.fillText(safeLabel, tx, 0);
    }

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
  const payload = extractPayload(message);
  if (!isValidName(payload)) return;

  const msgKey = normKey(payload);

  if (baselineSet.has(msgKey)) return;

  const clean = normalizeText(payload);
  const k = keyOfName(clean);
  if (participants.some(p => p.key === k)) return;
  if (participants.length >= maxParticipants) return;

  participants.push({ name: clean, key: k });
  winnerIndex = -1;
  hideWinner();
  drawWheel();
}

/* ---------------- Spin ---------------- */
let phase = "IDLE"; // IDLE | COLLECTING | READY
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

  // ✅ CORRECTION : cw = horaire, ccw = anti-horaire
  const dir = (spinDirection === "cw") ? +1 : -1;

  spinStartAngle = wheelAngle;
  targetAngle = desired + dir * extra;
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

/* timestamp/session : overlay actif ? */
let sessionActive = false;

function readAuthVars(){
  const s = getComputedStyle(document.documentElement);
  AUTH_MODE = (s.getPropertyValue("--auth-mode").trim().replace(/"/g,"") || "strict").toLowerCase();
  ROOM_ID = s.getPropertyValue("--room-id").trim().replace(/"/g,"") || "";
  ROOM_KEY = s.getPropertyValue("--room-key").trim().replace(/"/g,"") || "";
}

function startSessionTimestamp(){
  sessionActive = true;
  try{
    if (window.chrome?.runtime?.sendMessage){
      window.chrome.runtime.sendMessage({
        type: "MDI_SESSION_START",
        ts: Date.now(),
        overlay: OVERLAY_NAME
      });
    }
  }catch(e){}
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
    preStartIndex.setMax(baselineMaxMessages);

    startSessionTimestamp();

    if ((cssVar("--auto-reset","false") || "false") === "true"){
      clearAllForNewSession();
      preStartIndex.clear();
    } else {
      hideWinner();
      drawWheel();
    }

    phase = "IDLE";
    baselineSet = new Set();
  });

  socket.on("raw_vote", (data) => {
    if (!data) return;
    if (!sessionActive) return;

    readConfig();
    preStartIndex.setMax(baselineMaxMessages);

    const raw = String(data.vote || "");
    const msg = normalizeText(raw);
    if (!msg) return;

    const msgKey = normKey(extractPayload(msg));

    // En IDLE, on indexe tout ce qui passe
    if (phase === "IDLE") {
      preStartIndex.add(msgKey);
    }

    // --- Commandes
    if (cmdMatch(msg, collectClearTrigger) || cmdMatch(msg, resetTrigger)) {
      clearAllForNewSession();
      preStartIndex.clear();
      baselineSet = new Set();
      phase = "IDLE";
      return;
    }

    if (cmdMatch(msg, collectStartTrigger)) {
      if (clearOnStart) clearAllForNewSession();

      baselineSet = preStartIndex.snapshotSet();
      baselineSet.add(msgKey);

      phase = "COLLECTING";
      hideWinner();
      return;
    }

    if (cmdMatch(msg, collectStopTrigger)) {
      if (phase === "COLLECTING") phase = "READY";
      return;
    }

    if (cmdMatch(msg, spinTrigger)) {
      if (blockSpinWhileCollecting && phase === "COLLECTING") return;
      if (phase !== "READY") return;
      spin();
      return;
    }

    // --- Collecte
    if (phase !== "COLLECTING") return;
    addParticipant(msg);
  });
}

/* ---------------- Init ---------------- */
function init(){
  setBootTransparent();
  sessionActive = false;

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
