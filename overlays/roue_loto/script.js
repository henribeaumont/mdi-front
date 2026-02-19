/**
 * ============================================================
 * MDI ROUE LOTO - V6.9
 * ============================================================
 * ✅ Tout V6.8 préservé (ZÉRO RÉGRESSION)
 * ✅ NOUVEAU : émission overlay:online / overlay:offline
 *    → deux voyants télécommande :
 *      • Connexion serveur
 *      • Affichage dans OBS (vert dès que l'overlay est visible,
 *        quelque soit l'état : collecting, ready, spinning, winner)
 * ============================================================
 */

const SERVER_URL = "https://magic-digital-impact-live.onrender.com";
const OVERLAY_TYPE = "roue_loto";

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
function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

const elSecurity = document.getElementById("security-screen");
const elApp = document.getElementById("app");
const wheelCanvas = document.getElementById("wheel");
const wheelCtx = wheelCanvas.getContext("2d");
const elWinnerName = document.getElementById("winnerName");
const confettiCanvas = document.getElementById("confetti");
const confettiCtx = confettiCanvas.getContext("2d");

let STATE = "idle";
let participants = [];
let winnerIndex = -1;
let wheelAngle = 0;
let spinning = false;
let spinStartTs = 0;
let spinDurationMs = 4200;
let spinStartAngle = 0;
let targetAngle = 0;
let lastSpinAt = 0;
let spinDirection = "cw";
let pointerSide = "left";
let maxParticipants = 48;
let spinCooldownMs = 1800;
let consecutifMode = false;
let currentRoom = "";

/* -------- Presence -------- */
function emitPresence(displaying) {
  if (!currentRoom) return;
  socket.emit("overlay:presence_update", {
    room: currentRoom,
    overlay: OVERLAY_TYPE,
    displaying
  });
}

function readConfig() {
  spinDirection = cssVar("--spin-direction", "cw").toLowerCase();
  spinDirection = (spinDirection === "ccw") ? "ccw" : "cw";
  pointerSide = cssVar("--pointer-side", "left").toLowerCase();
  pointerSide = (pointerSide === "right") ? "right" : "left";
  document.documentElement.setAttribute("data-pointer-side", pointerSide);
  const flip = cssOnOff("--pointer-rotate-180", true);
  document.documentElement.classList.toggle("mdi-pointer-flip", !!flip);
  maxParticipants = clamp(cssNum("--max-participants", 48), 4, 200);
  spinCooldownMs = clamp(cssNum("--spin-cooldown-ms", 1800), 500, 12000);
}

const basePalette = [
  "#2ecc71","#e74c3c","#3b82f6","#f1c40f",
  "#9b59b6","#1abc9c","#e67e22","#ec4899",
  "#22c55e","#ef4444","#60a5fa","#f59e0b"
];

function resizeWheelCanvas() {
  const cssSize = cssNum("--wheel-size", 820);
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  wheelCanvas.style.width = cssSize + "px";
  wheelCanvas.style.height = cssSize + "px";
  wheelCanvas.width = Math.floor(cssSize * dpr);
  wheelCanvas.height = Math.floor(cssSize * dpr);
  wheelCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawWheel();
}

function drawWheel() {
  const cssSize = cssNum("--wheel-size", 820);
  const stroke = cssNum("--wheel-stroke", 16);
  const textSize = cssNum("--wheel-text-size", 30);
  const textWeight = cssNum("--wheel-text-weight", 900);
  const W = cssSize, H = cssSize;
  const cx = W / 2, cy = H / 2;
  const r = (W / 2) - stroke - 6;

  wheelCtx.clearRect(0, 0, W, H);
  wheelCtx.save();
  wheelCtx.translate(cx, cy);
  wheelCtx.rotate(wheelAngle);

  if (participants.length === 0) {
    wheelCtx.beginPath();
    wheelCtx.arc(0, 0, r, 0, Math.PI * 2);
    wheelCtx.fillStyle = "rgba(10,15,30,0.65)";
    wheelCtx.fill();
    wheelCtx.lineWidth = stroke;
    wheelCtx.strokeStyle = "rgba(255,255,255,0.18)";
    wheelCtx.stroke();
    wheelCtx.restore();
    return;
  }

  const n = participants.length;
  const slice = (Math.PI * 2) / n;

  for (let i = 0; i < n; i++) {
    const a0 = i * slice;
    const a1 = a0 + slice;

    wheelCtx.beginPath();
    wheelCtx.moveTo(0, 0);
    wheelCtx.arc(0, 0, r, a0, a1);
    wheelCtx.closePath();
    wheelCtx.fillStyle = basePalette[i % basePalette.length];
    wheelCtx.fill();

    if (i === winnerIndex) {
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

    const label = participants[i].name || participants[i];
    const mid = a0 + slice / 2;

    wheelCtx.save();
    wheelCtx.rotate(mid);
    wheelCtx.fillStyle = "rgba(255,255,255,0.96)";
    wheelCtx.font = `${textWeight} ${textSize}px Montserrat, sans-serif`;
    wheelCtx.textBaseline = "middle";
    wheelCtx.lineWidth = 4;
    wheelCtx.strokeStyle = "rgba(0,0,0,0.35)";

    const maxChars = 14;
    const safeLabel = String(label).length > maxChars
      ? (String(label).slice(0, maxChars - 1) + "…")
      : label;
    const tx = Math.max(120, r * 0.26);

    if (pointerSide === "left") {
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
  wheelCtx.arc(0, 0, r, 0, Math.PI * 2);
  wheelCtx.lineWidth = stroke;
  wheelCtx.strokeStyle = "rgba(255,255,255,0.22)";
  wheelCtx.stroke();
  wheelCtx.restore();
}

let confetti = [];
let confettiEndTs = 0;

function resizeConfetti() {
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  confettiCanvas.width = Math.floor(window.innerWidth * dpr);
  confettiCanvas.height = Math.floor(window.innerHeight * dpr);
  confettiCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function rand01() {
  const u = new Uint32Array(1);
  crypto.getRandomValues(u);
  return u[0] / 0xFFFFFFFF;
}

function startConfetti() {
  if (!cssOnOff("--winner-confetti", true)) return;
  document.documentElement.classList.add("mdi-confetti");
  resizeConfetti();
  const density = clamp(cssNum("--confetti-density", 180), 30, 600);
  const dur = clamp(cssNum("--confetti-duration-ms", 2200), 600, 8000);
  confetti = [];
  confettiEndTs = performance.now() + dur;
  for (let i = 0; i < density; i++) {
    confetti.push({
      x: rand01() * window.innerWidth,
      y: -20 - rand01() * 200,
      s: 6 + rand01() * 10,
      vx: (rand01() - 0.5) * 2.2,
      vy: 2.0 + rand01() * 4.5,
      rot: rand01() * Math.PI * 2,
      vr: (rand01() - 0.5) * 0.25,
      col: basePalette[i % basePalette.length]
    });
  }
  requestAnimationFrame(tickConfetti);
}

function tickConfetti(ts) {
  confettiCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  if (ts >= confettiEndTs) {
    document.documentElement.classList.remove("mdi-confetti");
    confetti = [];
    return;
  }
  for (const p of confetti) {
    p.x += p.vx * 3.2;
    p.y += p.vy * 3.6;
    p.rot += p.vr;
    const alpha = clamp((confettiEndTs - ts) / 500, 0, 1);
    confettiCtx.save();
    confettiCtx.translate(p.x, p.y);
    confettiCtx.rotate(p.rot);
    confettiCtx.globalAlpha = alpha;
    confettiCtx.fillStyle = p.col;
    confettiCtx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.7);
    confettiCtx.restore();
  }
  requestAnimationFrame(tickConfetti);
}

function normalizeText(raw) {
  return String(raw || "").replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim();
}
function keyOfName(name) { return normalizeText(name).toLowerCase(); }
function normalizeAngle(a) { let x = a % (Math.PI * 2); if (x < 0) x += Math.PI * 2; return x; }
function pickRandomIndex(n) {
  const u = new Uint32Array(1);
  crypto.getRandomValues(u);
  return u[0] % n;
}
function pointerTargetAngle() { return (pointerSide === "left") ? Math.PI : 0; }

function spin() {
  const now = Date.now();
  if (spinning) return;
  if (STATE !== "ready") return;
  if (participants.length < 2) return;
  if (now - lastSpinAt < spinCooldownMs) return;

  lastSpinAt = now;
  spinning = true;
  STATE = "spinning";

  const n = participants.length;
  const selected = pickRandomIndex(n);
  const slice = (Math.PI * 2) / n;
  const selectedCenter = selected * slice + slice / 2;
  const pointerAngle = pointerTargetAngle();
  const desired = pointerAngle - selectedCenter;
  const extraTurns = 6 + Math.floor(rand01() * 4);
  const dir = (spinDirection === "cw") ? +1 : -1;

  spinStartAngle = wheelAngle;
  targetAngle = desired + dir * extraTurns * Math.PI * 2;
  spinDurationMs = clamp(3800 + Math.floor(rand01() * 2200), 3400, 6500);
  spinStartTs = performance.now();

  requestAnimationFrame(tickSpin);

  function tickSpin(ts) {
    const t = clamp((ts - spinStartTs) / spinDurationMs, 0, 1);
    const e = 1 - Math.pow(1 - t, 3);
    wheelAngle = spinStartAngle + (targetAngle - spinStartAngle) * e;
    drawWheel();
    if (t < 1) { requestAnimationFrame(tickSpin); return; }

    spinning = false;
    const ang = normalizeAngle(pointerAngle - wheelAngle);
    const idx = Math.floor(ang / slice) % n;
    winnerIndex = (idx + n) % n;
    drawWheel();

    const winnerName = participants[winnerIndex]?.name || participants[winnerIndex] || "";
    elWinnerName.textContent = winnerName;
    document.documentElement.classList.add("mdi-show-winner");
    STATE = "winner";
    startConfetti();

    socket.emit("roue:winner_selected", {
      room: currentRoom,
      winnerName,
      winnerIndex
    });
    console.log(`🏆 [ROUE] Gagnant: "${winnerName}" (index ${winnerIndex})`);
  }
}

function hideWinner() {
  document.documentElement.classList.remove("mdi-show-winner");
  elWinnerName.textContent = "";
  winnerIndex = -1;
}

function clearAll() {
  participants = [];
  winnerIndex = -1;
  spinning = false;
  wheelAngle = 0;
  STATE = "idle";
  consecutifMode = false;
  hideWinner();
  drawWheel();
}

function applyParticipantsFromServer(serverList) {
  if (!Array.isArray(serverList)) return;
  participants = serverList.map(p =>
    typeof p === "string" ? { name: p, key: p.toLowerCase() } : p
  );
  drawWheel();
}

/* -------- Socket.io -------- */
const socket = io(SERVER_URL, {
  transports: ["websocket", "polling"],
  reconnection: true
});

socket.on("connect", () => {
  console.log("✅ [ROUE] Connecté");
  if (currentRoom) {
    socket.emit("overlay:online", { room: currentRoom, overlay: OVERLAY_TYPE });
  }
});

socket.on("disconnect", () => {
  console.log("🔴 [ROUE] Déconnecté");
});

socket.on("overlay:state", (payload) => {
  if (payload.overlay !== OVERLAY_TYPE) return;
  console.log("📡 [ROUE] État:", payload.state, payload.data);

  if (payload.data) {
    if (payload.data.participants !== undefined) applyParticipantsFromServer(payload.data.participants);
    if (payload.data.consecutifMode !== undefined) {
      consecutifMode = Boolean(payload.data.consecutifMode);
      console.log(`🔁 [ROUE] Mode consécutif: ${consecutifMode ? "ON" : "OFF"}`);
    }
  }

  if (payload.state === "idle") {
    elApp.classList.remove("show");
    setTimeout(() => { elApp.classList.add("hidden"); clearAll(); }, 800);
    emitPresence(false);
    return;
  }

  if (payload.state === "active") {
    elSecurity.classList.add("hidden");
    elApp.classList.remove("hidden");
    requestAnimationFrame(() => elApp.classList.add("show"));
    STATE = "idle";
    drawWheel();
    emitPresence(true);
  }
});

socket.on("roue:start_collect", () => {
  console.log("📝 [ROUE] Démarrage collecte");
  clearAll();
  STATE = "collecting";
  drawWheel();
  emitPresence(true);
});

socket.on("roue:stop_collect", () => {
  console.log("🔒 [ROUE] Fermeture collecte");
  if (STATE === "collecting") STATE = "ready";
});

socket.on("roue:spin", () => {
  console.log("🎡 [ROUE] SPIN");
  spin();
});

socket.on("roue:reset", () => {
  console.log("🔄 [ROUE] Reset");
  clearAll();
  drawWheel();
  emitPresence(false);
});

socket.on("raw_vote", (data) => {
  if (!data || !data.vote) return;
  if (STATE !== "collecting") return;
  const name = normalizeText(data.vote);
  const key = keyOfName(name);
  if (!name) return;
  if (participants.length >= maxParticipants) return;
  if (!participants.some(p => keyOfName(p.name || p) === key)) {
    participants.push({ name, key });
    drawWheel();
    console.log(`➕ [ROUE] Participant chat: ${name} (total: ${participants.length})`);
  }
});

socket.on("overlay:forbidden", () => {
  console.error("❌ [ROUE] Accès refusé");
  elSecurity.classList.remove("hidden");
  elApp.classList.add("hidden");
});

async function init() {
  await new Promise(resolve => setTimeout(resolve, 800));

  const authMode = cssVar("--auth-mode", "strict");
  const room = cssVar("--room-id", "").trim();
  const key = cssVar("--room-key", "").trim();

  currentRoom = room;
  readConfig();
  resizeWheelCanvas();
  resizeConfetti();

  console.log(`🔐 [ROUE] Auth: ${authMode}, Room: ${room}`);

  if (!room) {
    console.error("❌ [ROUE] Aucun room-id");
    elSecurity.classList.remove("hidden");
    return;
  }

  if (authMode === "strict") {
    if (!key) {
      console.error("❌ [ROUE] Mode strict sans key");
      elSecurity.classList.remove("hidden");
      return;
    }
    socket.emit("overlay:join", { room, key, overlay: OVERLAY_TYPE });
  } else {
    socket.emit("overlay:join", { room, key: "", overlay: OVERLAY_TYPE });
  }

  socket.emit("overlay:online", { room, overlay: OVERLAY_TYPE });
  socket.emit("rejoindre_salle", room);
  console.log("✅ [ROUE] Init terminée");
}

socket.on("connect", init);

window.addEventListener("resize", () => {
  resizeWheelCanvas();
  resizeConfetti();
});

drawWheel();
