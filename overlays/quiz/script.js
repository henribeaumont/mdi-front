/* ==========================================================
   MDI QUIZ / SONDAGE — SaaS Ready (OBS-safe)
   - Boot TRANSPARENT (ne masque jamais la caméra)
   - Attente des variables CSS OBS (--room-id/--room-key)
   - Auth strict fiable
   - États: idle, prompt, open, results, reveal, winner
   ========================================================== */

const SERVER_URL = "https://magic-digital-impact-live.onrender.com";
const OVERLAY_NAME = "quiz_ou_sondage";

/* --------------------- Helpers CSS vars --------------------- */
function cssVar(name, fallback = "") {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}
function stripQuotes(s) {
  return String(s || "").trim().replace(/^["']|["']$/g, "");
}
function parseNumber(s, fallback) {
  const n = Number(String(s).trim());
  return Number.isFinite(n) ? n : fallback;
}
function hexToRgba(hex, alpha) {
  const h = String(hex || "").trim();
  const m = h.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!m) return `rgba(0,0,0,${alpha})`;
  const r = parseInt(m[1], 16);
  const g = parseInt(m[2], 16);
  const b = parseInt(m[3], 16);
  const a = Math.max(0, Math.min(1, alpha));
  return `rgba(${r},${g},${b},${a})`;
}
function applyHexBg(el, hexVar, opacityVar, fallbackHex, fallbackOpacity) {
  const hex = stripQuotes(cssVar(hexVar, fallbackHex));
  const op = parseNumber(cssVar(opacityVar, fallbackOpacity), fallbackOpacity);
  el.style.background = hexToRgba(hex, op);
}
function applyGradientBg(el, startVar, endVar, opacityVar, fallbackStart, fallbackEnd, fallbackOpacity) {
  const s = stripQuotes(cssVar(startVar, fallbackStart));
  const e = stripQuotes(cssVar(endVar, fallbackEnd));
  const op = parseNumber(cssVar(opacityVar, fallbackOpacity), fallbackOpacity);
  el.style.background = `linear-gradient(180deg, ${hexToRgba(s, op)}, ${hexToRgba(e, op)})`;
}

/* --------------------- UI Elements --------------------- */
const elQuiz = document.getElementById("quiz-container");
const elSecurity = document.getElementById("security-screen");
const elQuestion = document.getElementById("question");
const elWinner = document.getElementById("winner");
const elWinnerName = document.getElementById("winnerName");
const answerEls = Array.from(document.querySelectorAll(".answer"));

const answers = {
  A: { txt: document.getElementById("txtA"), pct: document.getElementById("pctA") },
  B: { txt: document.getElementById("txtB"), pct: document.getElementById("pctB") },
  C: { txt: document.getElementById("txtC"), pct: document.getElementById("pctC") },
  D: { txt: document.getElementById("txtD"), pct: document.getElementById("pctD") }
};

/* --------------------- Boot: TRANSPARENT --------------------- */
function setBootTransparent() {
  document.documentElement.classList.remove(
    "mdi-ready",
    "mdi-denied",
    "mdi-show-results",
    "mdi-show-winner",
    "mdi-dim-answers",
    "mdi-options-hidden"
  );
  document.documentElement.removeAttribute("data-mdi-state");
  elQuiz.style.display = "none";
  elQuiz.setAttribute("aria-hidden", "true");
  elSecurity.setAttribute("aria-hidden", "true");
}
setBootTransparent();

/* --------------------- Theme from OBS CSS vars --------------------- */
function applyThemeFromCssVars() {
  const panelQuestion = document.querySelector(".panel-question");
  const panelAnswers = document.querySelector(".panel-answers");
  const question = document.querySelector(".question");

  // Fond panels (HEX + opacité)
  applyHexBg(panelQuestion, "--panel-q-bg-hex", "--panel-q-bg-opacity", "#585858", 0.60);
  applyHexBg(panelAnswers,  "--panel-a-bg-hex", "--panel-a-bg-opacity", "#585858", 0.75);

  // Fond question / réponses (dégradés)
  applyGradientBg(question, "--question-bg-start", "--question-bg-end", "--question-bg-opacity", "#0A0F1E", "#3A3F75", 1.0);

  answerEls.forEach((a) => {
    applyGradientBg(a, "--answer-bg-start", "--answer-bg-end", "--answer-bg-opacity", "#0A1A2E", "#203B56", 1.0);
  });
}
applyThemeFromCssVars();
window.addEventListener("resize", applyThemeFromCssVars);

/* --------------------- Security UI --------------------- */
let isAuthorized = false;

function showDenied() {
  isAuthorized = false;
  document.documentElement.classList.remove("mdi-ready");
  document.documentElement.classList.add("mdi-denied");
  document.documentElement.removeAttribute("data-mdi-state");

  elQuiz.style.display = "none";
  elQuiz.setAttribute("aria-hidden", "true");
  elSecurity.setAttribute("aria-hidden", "false");
}

function showAuthorized() {
  isAuthorized = true;
  document.documentElement.classList.remove("mdi-denied");
  document.documentElement.classList.add("mdi-ready");
  elSecurity.setAttribute("aria-hidden", "true");
}

/* --------------------- State machine --------------------- */
function setIdleTransparent() {
  elQuiz.style.display = "none";
  elQuiz.setAttribute("aria-hidden", "true");
  document.documentElement.classList.remove("mdi-show-results", "mdi-show-winner", "mdi-dim-answers", "mdi-options-hidden");
  document.documentElement.removeAttribute("data-mdi-state");
}

function setVisibleQuiz() {
  elQuiz.style.display = "grid";
  elQuiz.setAttribute("aria-hidden", "false");
}

function clearOptionDelays() {
  answerEls.forEach((el) => (el.style.transitionDelay = "0ms"));
}

function staggerRevealOptions() {
  const stagger = parseNumber(cssVar("--option-stagger-ms", 750), 750);
  document.documentElement.classList.add("mdi-options-hidden");
  answerEls.forEach((el, idx) => {
    el.style.transitionDelay = `${idx * stagger}ms`;
  });
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.documentElement.classList.remove("mdi-options-hidden");
    });
  });
}

function setQuestionAndAnswers(data) {
  if (typeof data?.question === "string") elQuestion.textContent = data.question;

  if (data?.answers && typeof data.answers === "object") {
    ["A", "B", "C", "D"].forEach((k) => {
      if (typeof data.answers[k] === "string") answers[k].txt.textContent = data.answers[k];
    });
  }
}

function setPercents(data) {
  const p = data?.percents || data?.percentages || {};
  ["A", "B", "C", "D"].forEach((k) => {
    const n = Number(p[k]);
    answers[k].pct.textContent = Number.isFinite(n) ? `${Math.round(n)}%` : "0%";
  });
}

function hideWinner() {
  document.documentElement.classList.remove("mdi-show-winner", "mdi-dim-answers");
  elWinner.setAttribute("aria-hidden", "true");
}
function showWinner(name) {
  elWinnerName.textContent = String(name || "").trim() || "—";
  document.documentElement.classList.add("mdi-show-winner", "mdi-dim-answers");
  elWinner.setAttribute("aria-hidden", "false");

  // IMPORTANT: dim simultané => pas de delays restants
  clearOptionDelays();
}

function showResults(on) {
  if (on) document.documentElement.classList.add("mdi-show-results");
  else document.documentElement.classList.remove("mdi-show-results");
}

function applyState(state, data) {
  // En strict: si pas autorisé => rien (transparent)
  if (AUTH_MODE === "strict" && !isAuthorized) return;

  if (!state || state === "idle") {
    setIdleTransparent();
    return;
  }

  // expose l'état au CSS (animation panels)
  document.documentElement.setAttribute("data-mdi-state", state);

  setVisibleQuiz();
  hideWinner();
  showResults(false);

  setQuestionAndAnswers(data);

  switch (state) {
    case "prompt":
      // panel question only (panel answers reste invisible via CSS)
      document.documentElement.classList.add("mdi-options-hidden");
      clearOptionDelays();
      break;

    case "open": {
      // 1) panel réponses fade-in (CSS)
      // 2) puis options stagger (JS), après le fade panel
      const panelFade = parseNumber(cssVar("--answers-panel-fade-ms", 260), 260);
      clearOptionDelays();
      setTimeout(() => {
        staggerRevealOptions();
      }, Math.max(0, panelFade));
      break;
    }

    case "results":
      clearOptionDelays();
      setPercents(data);
      showResults(true);
      break;

    case "reveal":
      clearOptionDelays();
      setPercents(data);
      showResults(true);
      break;

    case "winner":
      clearOptionDelays();
      setPercents(data);
      showResults(true);
      showWinner(data?.winnerName || data?.winner || "");
      break;

    default:
      clearOptionDelays();
      break;
  }
}

/* --------------------- Auth / Socket (OBS-safe) --------------------- */
let socket = null;
let AUTH_MODE = "strict";
let ROOM_ID = "";
let ROOM_KEY = "";

let authResolved = false;
let authStarted = false;

function readAuthVars() {
  AUTH_MODE = stripQuotes(cssVar("--auth-mode", "strict")) || "strict";
  ROOM_ID = stripQuotes(cssVar("--room-id", "")) || "";
  ROOM_KEY = stripQuotes(cssVar("--room-key", "")) || "";
}

function startSocket() {
  if (authStarted) return;
  authStarted = true;

  socket = io(SERVER_URL, {
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: 10
  });

  socket.on("connect", () => {
    console.log("✅ [QUIZ] connected", socket.id);

    if (AUTH_MODE === "strict") {
      socket.emit("overlay:join", { room: ROOM_ID, key: ROOM_KEY, overlay: OVERLAY_NAME });
    } else {
      socket.emit("rejoindre_salle", ROOM_ID);
    }
  });

  socket.on("overlay:forbidden", (payload) => {
    console.warn("⛔ [QUIZ] forbidden", payload);
    authResolved = true;
    showDenied();
  });

  socket.on("statut_connexion", (status) => {
    if (AUTH_MODE !== "strict") {
      if (status === "OK") {
        authResolved = true;
        showAuthorized();
        socket.emit("overlay:get_state", { room: ROOM_ID, key: ROOM_KEY, overlay: OVERLAY_NAME });
      } else {
        authResolved = true;
        showDenied();
      }
    }
  });

  socket.on("overlay:state", (payload) => {
    if (payload?.overlay !== OVERLAY_NAME) return;

    // Recevoir un state => accès OK
    if (!authResolved) {
      authResolved = true;
      showAuthorized();
    }
    applyState(payload?.state, payload?.data || {});
  });

  socket.on("connect_error", (err) => {
    console.warn("❌ [QUIZ] connect_error", err?.message || err);
    // IMPORTANT: on ne met PAS denied ici (transitoire).
  });
}

/* Attendre que OBS applique le CSS personnalisé */
function initAuthOBS() {
  setBootTransparent();

  const maxTries = 18;      // 18 * 200ms = 3600ms
  const intervalMs = 200;
  let tries = 0;

  const t = setInterval(() => {
    tries++;
    readAuthVars();

    const strictReady = (AUTH_MODE === "strict" && ROOM_ID && ROOM_KEY);
    const legacyReady = (AUTH_MODE !== "strict" && ROOM_ID);

    if (strictReady || legacyReady) {
      clearInterval(t);
      startSocket();
      return;
    }

    if (tries >= maxTries) {
      clearInterval(t);
      console.warn("[QUIZ] Auth vars not found in time => denied");
      showDenied();
    }
  }, intervalMs);
}

initAuthOBS();