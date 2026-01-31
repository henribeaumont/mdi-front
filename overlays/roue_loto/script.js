/* ==========================================================
   MDI • ROUE LOTO — V1.0 SaaS (ZERO FLICKER)
   - Overlay name: "roue_loto"
   - Auth strict/legacy via CSS OBS
   - Collecte participants via raw_vote (prénom/pseudo)
   - Tirage au sort déclenchable par:
       A) overlay:state state="spin" (pilotage serveur/telecommande)
       B) chat: "SPIN" (fallback)
   - Reset par:
       A) overlay:state state="reset" / "idle"
       B) chat: "RESET"
   ========================================================== */

const SERVER_URL = "https://magic-digital-impact-live.onrender.com";
const OVERLAY_NAME = "roue_loto";

/* ---------------- CSS Vars ---------------- */
function cssVar(name, fallback = "") {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name);
  return v ? v.trim().replace(/^['"]+|['"]+$/g, "") : fallback;
}
function cssNum(name, fallback) {
  const v = cssVar(name, "");
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function cssStr(name, fallback) {
  const v = cssVar(name, "");
  return v ? v : fallback;
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
const elCenterLabel = document.getElementById("centerLabel");
const elCenterSub = document.getElementById("centerSub");

function setBootTransparent(){
  elSecurity.style.display = "none";
  elApp.style.display = "none";
  document.documentElement.classList.remove("mdi-ready", "mdi-denied", "mdi-confetti");
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

/* ---------------- Canvas: Wheel ---------------- */
const wheelCanvas = document.getElementById("wheel");
const wheelCtx = wheelCanvas.getContext("2d");

let wheelAngle = 0;           // radians (rotation actuelle)
let targetAngle = 0;
let spinning = false;
let spinStartTs = 0;
let spinDurationMs = 4200;
let spinStartAngle = 0;

const basePalette = [
  "#2ecc71", "#e74c3c", "#3b82f6", "#f1c40f",
  "#9b59b6", "#1abc9c", "#e67e22", "#ec4899",
  "#22c55e", "#ef4444", "#60a5fa", "#f59e0b"
];

let participants = []; // [{name, key}]
let winnerIndex = -1;

/* HiDPI sizing */
function resizeWheelCanvas(){
  const cssSize = cssNum("--wheel-size", 820);
  const dpr = Math.max(1, window.devicePixelRatio || 1);

  wheelCanvas.style.width = cssSize + "px";
  wheelCanvas.style.height = cssSize + "px";

  wheelCanvas.width = Math.floor(cssSize * dpr);
  wheelCanvas.height = Math.floor(cssSize * dpr);

  wheelCtx.setTransform(dpr, 0, 0, dpr, 0, 0); // draw in CSS pixels
  drawWheel();
}

function drawWheel(){
  const cssSize = cssNum("--wheel-size", 820);
  const stroke = cssNum("--wheel-stroke", 16);
  const textSize = cssNum("--wheel-text-size", 30);
  const textWeight = cssNum("--wheel-text-weight", 900);

  const W = cssSize;
  const H = cssSize;
  const cx = W/2, cy = H/2;
  const r = (W/2) - stroke - 6;

  // clear
  wheelCtx.clearRect(0,0,W,H);

  // background circle
  wheelCtx.save();
  wheelCtx.translate(cx, cy);
  wheelCtx.rotate(wheelAngle);

  // no participants
  if (participants.length === 0){
    wheelCtx.beginPath();
    wheelCtx.arc(0,0,r,0,Math.PI*2);
    wheelCtx.fillStyle = "#0A0F1E";
    wheelCtx.fill();

    wheelCtx.lineWidth = stroke;
    wheelCtx.strokeStyle = "rgba(255,255,255,0.18)";
    wheelCtx.stroke();

    wheelCtx.fillStyle = "rgba(255,255,255,0.92)";
    wheelCtx.font = `900 ${Math.max(22, textSize)}px Montserrat, sans-serif`;
    wheelCtx.textAlign = "center";
    wheelCtx.textBaseline = "middle";
    wheelCtx.fillText("Aucun participant", 0, -10);
    wheelCtx.font = `800 ${Math.max(18, textSize-8)}px Montserrat, sans-serif`;
    wheelCtx.fillText("Tapez votre prénom", 0, 26);

    wheelCtx.restore();
    return;
  }

  const n = participants.length;
  const slice = (Math.PI*2) / n;

  for (let i=0;i<n;i++){
    const a0 = i*slice;
    const a1 = a0 + slice;

    // Slice fill
    wheelCtx.beginPath();
    wheelCtx.moveTo(0,0);
    wheelCtx.arc(0,0,r,a0,a1);
    wheelCtx.closePath();

    const color = basePalette[i % basePalette.length];
    wheelCtx.fillStyle = color;
    wheelCtx.fill();

    // Highlight winner slice (slight glow)
    if (i === winnerIndex){
      wheelCtx.save();
      wheelCtx.shadowColor = "rgba(255,255,255,0.65)";
      wheelCtx.shadowBlur = 26;
      wheelCtx.lineWidth = 10;
      wheelCtx.strokeStyle = "rgba(255,255,255,0.85)";
      wheelCtx.stroke();
      wheelCtx.restore();
    } else {
      wheelCtx.lineWidth = 2;
      wheelCtx.strokeStyle = "rgba(0,0,0,0.18)";
      wheelCtx.stroke();
    }

    // Text
    const label = participants[i].name;
    const mid = a0 + slice/2;

    wheelCtx.save();
    wheelCtx.rotate(mid);

    // Text color contrast (simple)
    wheelCtx.fillStyle = "rgba(255,255,255,0.96)";
    wheelCtx.font = `${textWeight} ${textSize}px Montserrat, sans-serif`;
    wheelCtx.textAlign = "left";
    wheelCtx.textBaseline = "middle";

    // Place text along radius
    const tx = Math.max(120, r*0.26);
    // Fit if long
    const maxChars = 14;
    const safeLabel = label.length > maxChars ? (label.slice(0, maxChars-1) + "…") : label;

    // small stroke for readability
    wheelCtx.lineWidth = 4;
    wheelCtx.strokeStyle = "rgba(0,0,0,0.35)";
    wheelCtx.strokeText(safeLabel, tx, 0);
    wheelCtx.fillText(safeLabel, tx, 0);

    wheelCtx.restore();
  }

  // Outer ring
  wheelCtx.beginPath();
  wheelCtx.arc(0,0,r,0,Math.PI*2);
  wheelCtx.lineWidth = stroke;
  wheelCtx.strokeStyle = "rgba(255,255,255,0.22)";
  wheelCtx.stroke();

  // Inner circle
  wheelCtx.beginPath();
  wheelCtx.arc(0,0,r*0.18,0,Math.PI*2);
  wheelCtx.fillStyle = "rgba(10,15,30,0.55)";
  wheelCtx.fill();
  wheelCtx.lineWidth = 6;
  wheelCtx.strokeStyle = "rgba(255,255,255,0.18)";
  wheelCtx.stroke();

  wheelCtx.restore();
}

function updateCenter(){
  const n = participants.length;
  elCenterSub.textContent = `${n} participant${n>1?"s":""}`;
  if (spinning){
    elCenterLabel.textContent = "TIRAGE…";
    return;
  }
  if (winnerIndex >= 0 && participants[winnerIndex]){
    elCenterLabel.textContent = participants[winnerIndex].name;
  } else {
    elCenterLabel.textContent = n ? "PRÊT" : "EN ATTENTE…";
  }
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
  const enabled = cssOnOff("--winner-confetti", true);
  if (!enabled) return;

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
    confetti.push({x,y,s,vx,vy,rot,vr,col,life: 1});
  }

  requestAnimationFrame(tickConfetti);
}

function tickConfetti(ts){
  confettiCtx.clearRect(0,0,window.innerWidth, window.innerHeight);

  // stop
  if (ts >= confettiEndTs){
    document.documentElement.classList.remove("mdi-confetti");
    confetti = [];
    return;
  }

  // draw/update
  for (const p of confetti){
    p.x += p.vx * 3.2;
    p.y += p.vy * 3.6;
    p.rot += p.vr;
    // fade near end
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

/* ---------------- Participants logic ---------------- */
function normalizeName(raw){
  let t = String(raw || "").trim();
  t = t.replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim();
  return t;
}

function isValidName(name){
  const minLen = clamp(cssNum("--min-name-length", 1), 1, 6);
  const maxLen = clamp(cssNum("--max-name-length", 18), 6, 40);

  const t = normalizeName(name);
  if (!t) return false;

  // Commands / reserved
  const up = t.toUpperCase();
  if (up === "RESET" || up === "SPIN") return false;
  if (/^[ABCD]$/.test(up)) return false; // ignore quiz tokens

  // Length
  if (t.length < minLen || t.length > maxLen) return false;

  // Limit to 2 words
  if (t.split(" ").filter(Boolean).length > 2) return false;

  // Whitelist basic chars (letters incl accents, digits, space, underscore, dash, apostrophe)
  // keeps it readable & avoids UI injections
  if (!/^[0-9A-Za-zÀ-ÖØ-öø-ÿ _'’-]+$/.test(t)) return false;

  return true;
}

function keyOf(name){
  return normalizeName(name).toLowerCase();
}

function addParticipant(name){
  const maxP = clamp(cssNum("--max-participants", 48), 4, 120);

  const clean = normalizeName(name);
  if (!isValidName(clean)) return;

  const k = keyOf(clean);
  if (participants.some(p => p.key === k)) return;
  if (participants.length >= maxP) return;

  participants.push({ name: clean, key: k });
  winnerIndex = -1;
  drawWheel();
  updateCenter();
}

function resetParticipants(){
  participants = [];
  winnerIndex = -1;
  spinning = false;
  wheelAngle = 0;
  drawWheel();
  updateCenter();
}

/* ---------------- Spin logic ---------------- */
function pickRandomIndex(n){
  if (n <= 0) return -1;
  // crypto random int
  const u = new Uint32Array(1);
  crypto.getRandomValues(u);
  return u[0] % n;
}

// pointer is at "top" (0 angle). Our wheel rotates; winner is slice under pointer.
// We compute final wheelAngle so that the selected slice center aligns to -PI/2 (top).
function spin(){
  if (spinning) return;

  const n = participants.length;
  if (n < 2){
    winnerIndex = (n === 1) ? 0 : -1;
    drawWheel();
    updateCenter();
    if (winnerIndex === 0) startConfetti();
    return;
  }

  spinning = true;
  winnerIndex = -1;
  updateCenter();

  const selected = pickRandomIndex(n);
  const slice = (Math.PI*2)/n;
  const selectedCenter = selected*slice + slice/2;

  // We want: wheelAngle_final + selectedCenter == -PI/2 (top)
  // => wheelAngle_final = -PI/2 - selectedCenter
  const desired = (-Math.PI/2) - selectedCenter;

  // add extra turns for animation
  const extraTurns = 5 + Math.floor(rand01()*4); // 5..8
  const extra = extraTurns * Math.PI*2;

  spinStartAngle = wheelAngle;
  targetAngle = desired - extra; // rotate backwards multiple turns (looks natural)

  // duration slightly random
  spinDurationMs = clamp(3600 + Math.floor(rand01()*2200), 3200, 6200);
  spinStartTs = performance.now();

  requestAnimationFrame(tickSpin);

  function tickSpin(ts){
    const t = clamp((ts - spinStartTs)/spinDurationMs, 0, 1);

    // easeOutCubic
    const e = 1 - Math.pow(1 - t, 3);

    wheelAngle = spinStartAngle + (targetAngle - spinStartAngle) * e;
    drawWheel();

    if (t < 1){
      requestAnimationFrame(tickSpin);
      return;
    }

    // Finalize: determine winner from final angle
    spinning = false;

    // Compute winner slice under pointer
    const ang = normalizeAngle((-wheelAngle - Math.PI/2)); // convert to wheel-local angle under pointer
    const idx = Math.floor(ang / slice) % n;
    winnerIndex = (idx + n) % n;

    drawWheel();
    updateCenter();
    startConfetti();
  }
}

function normalizeAngle(a){
  let x = a % (Math.PI*2);
  if (x < 0) x += Math.PI*2;
  return x;
}

/* ---------------- Socket / Auth ---------------- */
let socket = null;
let AUTH_MODE = "strict";
let ROOM_ID = "";
let ROOM_KEY = "";

function readCssVars(){
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
    if (!payload) return;

    // If this is our overlay => authorization OK
    if (payload.overlay === OVERLAY_NAME){
      showReady();

      // Optional auto-reset on display
      if (cssStr("--auto-reset", "false") === "true"){
        resetParticipants();
      }

      // Control by server state
      const st = String(payload.state || "").toLowerCase();
      if (st === "spin"){
        spin();
      } else if (st === "reset" || st === "idle"){
        resetParticipants();
      }
      return;
    }

    // ignore other overlays
  });

  // Universal raw_vote
  socket.on("raw_vote", (data) => {
    if (!data) return;
    const msg = String(data.vote || "").trim();
    if (!msg) return;

    const up = msg.toUpperCase();

    // Fallback controls via chat
    if (up === "RESET"){ resetParticipants(); return; }
    if (up === "SPIN"){ spin(); return; }

    // otherwise treat as name
    addParticipant(msg);
  });
}

/* ---------------- Init ---------------- */
function init(){
  setBootTransparent();

  // Wait for OBS CSS injection
  const poll = setInterval(() => {
    readCssVars();

    if (AUTH_MODE === "legacy"){
      if (!ROOM_ID){ return; }
      clearInterval(poll);
      resizeWheelCanvas();
      resizeConfetti();
      initSocket();
      return;
    }

    // strict
    if (ROOM_ID && ROOM_KEY){
      clearInterval(poll);
      resizeWheelCanvas();
      resizeConfetti();
      initSocket();
    }
  }, 200);

  // If missing keys, after a small grace period => denied (strict)
  setTimeout(() => {
    readCssVars();
    if (AUTH_MODE === "strict" && (!ROOM_ID || !ROOM_KEY)){
      showDenied();
    }
  }, 1400);

  window.addEventListener("resize", () => {
    resizeWheelCanvas();
    resizeConfetti();
  });

  updateCenter();
  resizeWheelCanvas();
}

init();