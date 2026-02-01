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

let cmdMatchMode = "exact";
let spinCooldownMs = 1800;
let blockSpinWhileCollecting = true;
let clearOnStart = true;

let minNameLen = 1;
let maxNameLen = 18;
let maxParticipants = 48;

let baselineMaxMessages = 6000;

let spinDirection = "cw";
let pointerSide = "right";

function readConfig(){
  spinTrigger  = cssVar("--spin-trigger","SPIN").trim();
  resetTrigger = cssVar("--reset-trigger","RESET").trim();

  collectStartTrigger = cssVar("--collect-start-trigger","INSCRIVEZ UN PSEUDO").trim();
  collectStopTrigger  = cssVar("--collect-stop-trigger","PRET?").trim();
  collectClearTrigger = cssVar("--collect-clear-trigger","CLEAR INSCRIPTION").trim();

  cmdMatchMode = cssVar("--cmd-match-mode","exact").toLowerCase();
  if (!["exact","startswith","contains"].includes(cmdMatchMode)) cmdMatchMode = "exact";

  spinCooldownMs = clamp(cssNum("--spin-cooldown-ms", 1800), 500, 12000);
  blockSpinWhileCollecting = cssOnOff("--block-spin-while-collecting", true);
  clearOnStart = cssOnOff("--clear-on-start", true);

  minNameLen = clamp(cssNum("--min-name-length", 1), 1, 6);
  maxNameLen = clamp(cssNum("--max-name-length", 18), 6, 40);
  maxParticipants = clamp(cssNum("--max-participants", 48), 4, 200);

  baselineMaxMessages = clamp(cssNum("--baseline-max-messages", 6000), 500, 20000);

  spinDirection = cssVar("--spin-direction","cw").toLowerCase();
  spinDirection = (spinDirection === "ccw") ? "ccw" : "cw";

  pointerSide = cssVar("--pointer-side","right").toLowerCase();
  pointerSide = (pointerSide === "left") ? "left" : "right";
  document.documentElement.setAttribute("data-pointer-side", pointerSide);

  document.documentElement.classList.toggle(
    "mdi-pointer-flip",
    cssOnOff("--pointer-rotate-180", true)
  );
}

/* ---------------- Text helpers ---------------- */
function normalizeText(raw){
  return String(raw || "").replace(/\u00A0/g," ").replace(/\s+/g," ").trim();
}
function normKey(raw){ return normalizeText(raw).toUpperCase(); }
function extractPayload(text){
  const t = normalizeText(text);
  const m = t.match(/^.{1,24}:\s*(.+)$/);
  return m && m[1] ? m[1].trim() : t;
}
function cmdMatch(message, trigger){
  const msg = normKey(extractPayload(message));
  const trg = normKey(trigger);
  if (!msg || !trg) return false;
  if (cmdMatchMode === "exact") return msg === trg;
  if (cmdMatchMode === "startswith") return msg.startsWith(trg);
  return msg.includes(trg);
}

/* ---------------- LRU baseline ---------------- */
class LRUSet {
  constructor(max = 5000){ this.max = max; this.map = new Map(); }
  add(k){
    if (!k) return;
    if (this.map.has(k)) this.map.delete(k);
    this.map.set(k,true);
    while (this.map.size > this.max){
      this.map.delete(this.map.keys().next().value);
    }
  }
  snapshotSet(){ return new Set(this.map.keys()); }
  clear(){ this.map.clear(); }
  setMax(n){ this.max = n; }
}

const preStartIndex = new LRUSet(6000);
let baselineSet = new Set();

/* ---------------- Names ---------------- */
function isValidName(raw){
  const t = normalizeText(extractPayload(raw));
  if (!t) return false;
  if (t.length < minNameLen || t.length > maxNameLen) return false;
  if (t.split(" ").length > 2) return false;
  if (!/^[0-9A-Za-zÀ-ÖØ-öø-ÿ _'’-]+$/.test(t)) return false;
  return true;
}
function keyOfName(n){ return normalizeText(n).toLowerCase(); }

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
  "#9b59b6","#1abc9c","#e67e22","#ec4899"
];

let participants = [];
let winnerIndex = -1;

function resizeWheelCanvas(){
  const cssSize = cssNum("--wheel-size", 820);
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  wheelCanvas.style.width = cssSize + "px";
  wheelCanvas.style.height = cssSize + "px";
  wheelCanvas.width = cssSize * dpr;
  wheelCanvas.height = cssSize * dpr;
  wheelCtx.setTransform(dpr,0,0,dpr,0,0);
  drawWheel();
}

function drawWheel(){
  const cssSize = cssNum("--wheel-size", 820);
  const stroke = cssNum("--wheel-stroke", 16);
  const textSize = cssNum("--wheel-text-size", 30);
  const textWeight = cssNum("--wheel-text-weight", 900);

  const cx = cssSize/2, cy = cssSize/2;
  const r = cx - stroke - 6;

  wheelCtx.clearRect(0,0,cssSize,cssSize);
  wheelCtx.save();
  wheelCtx.translate(cx,cy);
  wheelCtx.rotate(wheelAngle);

  if (!participants.length){
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
  const slice = (Math.PI*2)/n;

  for (let i=0;i<n;i++){
    const a0 = i*slice, a1 = a0+slice;
    wheelCtx.beginPath();
    wheelCtx.moveTo(0,0);
    wheelCtx.arc(0,0,r,a0,a1);
    wheelCtx.fillStyle = basePalette[i%basePalette.length];
    wheelCtx.fill();

    const mid = a0 + slice/2;
    const label = participants[i].name;

    wheelCtx.save();
    wheelCtx.rotate(mid);

    // 🔤 rotation 180° du texte si demandé
    if (cssOnOff("--label-rotate-180", false)) {
      wheelCtx.rotate(Math.PI);
    }

    wheelCtx.font = `${textWeight} ${textSize}px Montserrat`;
    wheelCtx.fillStyle = "#fff";
    wheelCtx.textAlign = "left";
    wheelCtx.textBaseline = "middle";

    const safe = label.length > 14 ? label.slice(0,13)+"…" : label;
    wheelCtx.strokeStyle = "rgba(0,0,0,0.35)";
    wheelCtx.lineWidth = 4;
    wheelCtx.strokeText(safe, r*0.28, 0);
    wheelCtx.fillText(safe, r*0.28, 0);
    wheelCtx.restore();
  }

  wheelCtx.restore();
}

/* ---------------- Spin ---------------- */
let phase = "IDLE";
let lastSpinAt = 0;

function normalizeAngle(a){
  let x = a % (Math.PI*2);
  return x < 0 ? x + Math.PI*2 : x;
}
function pointerTargetAngle(){
  return (pointerSide === "left") ? Math.PI : 0;
}
function spin(){
  if (spinning || phase !== "READY" || participants.length < 2) return;
  if (Date.now() - lastSpinAt < spinCooldownMs) return;
  lastSpinAt = Date.now();

  spinning = true;
  const n = participants.length;
  const slice = (Math.PI*2)/n;
  const selected = Math.floor(Math.random()*n);
  const desired = pointerTargetAngle() - (selected*slice + slice/2);

  const extraTurns = 6 + Math.floor(Math.random()*4);
  const extra = extraTurns * Math.PI*2;

  // ✅ CORRECTION SENS ROTATION
  const dir = (spinDirection === "cw") ? +1 : -1;

  spinStartAngle = wheelAngle;
  targetAngle = desired + dir*extra;
  spinDurationMs = 4200;
  spinStartTs = performance.now();

  requestAnimationFrame(function tick(ts){
    const t = clamp((ts-spinStartTs)/spinDurationMs,0,1);
    wheelAngle = spinStartAngle + (targetAngle-spinStartAngle)*(1-Math.pow(1-t,3));
    drawWheel();
    if (t<1) return requestAnimationFrame(tick);

    spinning = false;
    const ang = normalizeAngle(pointerTargetAngle()-wheelAngle);
    winnerIndex = Math.floor(ang/slice)%n;
    elWinnerName.textContent = participants[winnerIndex].name;
    document.documentElement.classList.add("mdi-show-winner");
  });
}

/* ---------------- Socket ---------------- */
let socket;
let AUTH_MODE, ROOM_ID, ROOM_KEY;

function readAuthVars(){
  AUTH_MODE = cssVar("--auth-mode","strict").toLowerCase();
  ROOM_ID = cssVar("--room-id","");
  ROOM_KEY = cssVar("--room-key","");
}

function initSocket(){
  socket = io(SERVER_URL,{transports:["websocket","polling"]});
  socket.on("connect",()=>{
    socket.emit("overlay:join",{room:ROOM_ID,key:ROOM_KEY,overlay:OVERLAY_NAME});
  });
  socket.on("overlay:forbidden",showDenied);
  socket.on("overlay:state",p=>{
    if(p?.overlay!==OVERLAY_NAME) return;
    showReady();
    readConfig();
    participants=[];
    phase="IDLE";
    drawWheel();
  });
  socket.on("raw_vote",d=>{
    const msg = normalizeText(d?.vote);
    if(!msg) return;

    if(phase==="IDLE") preStartIndex.add(normKey(msg));

    if(cmdMatch(msg,collectStartTrigger)){
      baselineSet = preStartIndex.snapshotSet();
      phase="COLLECTING";
      return;
    }
    if(cmdMatch(msg,collectStopTrigger)){ phase="READY"; return; }
    if(cmdMatch(msg,spinTrigger)){ spin(); return; }

    if(phase!=="COLLECTING") return;
    if(baselineSet.has(normKey(msg))) return;
    if(!isValidName(msg)) return;

    const k = keyOfName(msg);
    if(participants.some(p=>p.key===k)) return;
    participants.push({name:msg,key:k});
    drawWheel();
  });
}

/* ---------------- Init ---------------- */
function init(){
  setBootTransparent();
  const poll=setInterval(()=>{
    readAuthVars(); readConfig();
    if(ROOM_ID && ROOM_KEY){
      clearInterval(poll);
      resizeWheelCanvas();
      initSocket();
    }
  },200);
  resizeWheelCanvas();
}
init();
