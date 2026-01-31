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
let collectStopTrigger = "STOP INSCRIPTION";
let collectClearTrigger = "CLEAR INSCRIPTION";

let pointerSide = "right";

let minNameLen = 1;
let maxNameLen = 18;
let maxParticipants = 48;

/* ✅ Safety anti-ghost spin */
let spinCooldownMs = 1600;

/* ✅ Collect windows */
let collectWarmupMs = 800;         // ignore shortly after collect start
let replayTtlMs = 300000;          // 5 min anti replay

function readConfig(){
  spinTrigger = (cssVar("--spin-trigger","SPIN") || "SPIN").trim().toUpperCase();
  resetTrigger = (cssVar("--reset-trigger","RESET") || "RESET").trim().toUpperCase();

  collectStartTrigger = (cssVar("--collect-start-trigger","INSCRIVEZ UN PSEUDO") || "INSCRIVEZ UN PSEUDO").trim().toUpperCase();
  collectStopTrigger  = (cssVar("--collect-stop-trigger","STOP INSCRIPTION") || "STOP INSCRIPTION").trim().toUpperCase();
  collectClearTrigger = (cssVar("--collect-clear-trigger","CLEAR INSCRIPTION") || "CLEAR INSCRIPTION").trim().toUpperCase();

  pointerSide = (cssVar("--pointer-side","right") || "right").trim().toLowerCase();
  pointerSide = (pointerSide === "left") ? "left" : "right";
  document.documentElement.setAttribute("data-pointer-side", pointerSide);

  const flip = cssOnOff("--pointer-rotate-180", true);
  document.documentElement.classList.toggle("mdi-pointer-flip", !!flip);

  minNameLen = clamp(cssNum("--min-name-length", 1), 1, 6);
  maxNameLen = clamp(cssNum("--max-name-length", 18), 6, 40);
  maxParticipants = clamp(cssNum("--max-participants", 48), 4, 120);

  spinCooldownMs = clamp(cssNum("--spin-cooldown-ms", 1600), 500, 8000);

  collectWarmupMs = clamp(cssNum("--collect-warmup-ms", 800), 0, 8000);
  replayTtlMs = clamp(cssNum("--replay-ttl-ms", 300000), 30000, 900000);
}

/* ---------------- Canvas: Wheel ---------------- */
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

/* ---------------- Controlled Collection (the fix) ---------------- */
/**
 * ✅ Collecte ARMÉE :
 * - Tant qu'on n'a pas reçu collectStartTrigger => on ignore tout
 * - Une fois armé => on accepte les prénoms
 * - On peut STOP / CLEAR / RESTART dans la même session
 */
let collecting = false;
let collectingEnabledAt = 0;

/* fingerprints anti replay (ignore repeated DOM spam) */
const FP = new Map();
function fingerprint(user, text){
  const u = (user && String(user).trim()) ? String(user).trim().toLowerCase() : "";
  const t = String(text || "").trim().toLowerCase();
  return u ? `${u}::${t}` : `::${t}`;
}
function seenRecently(user, text){
  const now = Date.now();
  const fp = fingerprint(user, text);
  const prev = FP.get(fp) || 0;
  if (prev && (now - prev) < replayTtlMs) return true;
  FP.set(fp, now);

  if (FP.size > 1400){
    const limit = now - replayTtlMs;
    for (const [k, ts] of FP.entries()){
      if (ts < limit) FP.delete(k);
    }
  }
  return false;
}

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

function clearParticipants(){
  participants = [];
  winnerIndex = -1;
  spinning = false;
  wheelAngle = 0;
  hideWinner();
  drawWheel();
}

/* ---------------- Spin (secured) ---------------- */
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

  /* ✅ Hard guards */
  if (spinning) return;
  if (now - lastSpinAt < spinCooldownMs) return;         // anti double-trigger
  if (participants.length < 2) return;                   // pas assez de monde
  if (collecting && cssOnOff("--block-spin-while-collecting", true)) return; // option safety

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

    /* Par défaut : collecte OFF tant que START pas reçu */
    collecting = false;
    collectingEnabledAt = 0;

    if ((cssVar("--auto-reset","false") || "false") === "true"){
      clearParticipants();
    }
  });

  socket.on("raw_vote", (data) => {
    if (!data) return;
    readConfig();

    const msg = String(data.vote || "").trim();
    if (!msg) return;

    const user = data.user || "";
    if (seenRecently(user, msg)) return; // anti replay global

    const up = msg.toUpperCase();

    /* ----------- COMMANDES COLLECTE ----------- */
    if (up === collectStartTrigger){
      collecting = true;
      collectingEnabledAt = Date.now();
      hideWinner();               // propre
      return;
    }

    if (up === collectStopTrigger){
      collecting = false;
      return;
    }

    if (up === collectClearTrigger){
      collecting = false;
      clearParticipants();        // permet de rejouer une nouvelle session
      return;
    }

    /* ----------- COMMANDES SPIN/RESET ----------- */
    if (up === resetTrigger){
      collecting = false;
      clearParticipants();
      return;
    }

    if (up === spinTrigger){
      // ✅ anti-ghost: ignore si reçu trop tôt après start collecte
      if (collectingEnabledAt && (Date.now() - collectingEnabledAt) < collectWarmupMs) return;
      spin();
      return;
    }

    /* ----------- INSCRIPTION ----------- */
    if (!collecting) return; // ✅ le coeur du fix: tout avant START est ignoré

    // anti-ghost: ignore très court après START (DOM replay)
    if (collectingEnabledAt && (Date.now() - collectingEnabledAt) < collectWarmupMs) return;

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
