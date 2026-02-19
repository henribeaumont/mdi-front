/**
 * ============================================================
 * MDI QUIZ / SONDAGE V3.8
 * ============================================================
 * ✅ Tout V3.7 préservé (ZÉRO RÉGRESSION)
 * ✅ NOUVEAU : émission overlay:online / présence
 *    → deux voyants télécommande :
 *      • Connexion serveur
 *      • Affichage dans OBS (vert dès que le quiz est visible,
 *        quelque soit l'état : question, options, results, reveal, winner)
 * ============================================================
 */

const SERVER_URL = "https://magic-digital-impact-live.onrender.com";
const OVERLAY_NAME = "quiz_ou_sondage";

/* UI Refs */
const elQuiz = document.getElementById("quiz-container");
const elSecurity = document.getElementById("security-screen");
const elQuestion = document.getElementById("question");
const elWinner = document.getElementById("winner");
const elWinnerName = document.getElementById("winnerName");
const answerEls = Array.from(document.querySelectorAll(".answer"));
const answers = {
  A: { el: document.querySelector('.answer[data-choice="A"]'), txt: document.getElementById("txtA"), pct: document.getElementById("pctA") },
  B: { el: document.querySelector('.answer[data-choice="B"]'), txt: document.getElementById("txtB"), pct: document.getElementById("pctB") },
  C: { el: document.querySelector('.answer[data-choice="C"]'), txt: document.getElementById("txtC"), pct: document.getElementById("pctC") },
  D: { el: document.querySelector('.answer[data-choice="D"]'), txt: document.getElementById("txtD"), pct: document.getElementById("pctD") }
};

/* -------- State -------- */
let isAuthorized = false;
let AUTH_MODE = "strict";
let ROOM_ID = "";
let ROOM_KEY = "";
let socket = null;

/* -------- Presence -------- */
function emitPresence(displaying) {
  if (!socket || !ROOM_ID) return;
  socket.emit("overlay:presence_update", {
    room: ROOM_ID,
    overlay: OVERLAY_NAME,
    displaying
  });
}

/* -------- Boot -------- */
function setBootTransparent() {
  elQuiz.style.display = "none";
  elSecurity.style.display = "none";
  document.documentElement.className = "";
  document.documentElement.removeAttribute("data-mdi-state");
}

function showDenied() {
  isAuthorized = false;
  document.documentElement.classList.add("mdi-denied");
  document.documentElement.classList.remove("mdi-ready");
  elQuiz.style.display = "none";
  elSecurity.style.display = "flex";
}

function showAuthorized() {
  isAuthorized = true;
  document.documentElement.classList.remove("mdi-denied");
  document.documentElement.classList.add("mdi-ready");
  elSecurity.style.display = "none";
}

setBootTransparent();

/* -------- Visuels -------- */
function resetVisuals() {
  answerEls.forEach(el => {
    el.classList.remove("is-correct");
    el.removeAttribute("data-rank");
    el.style.setProperty("--gauge-width", "0%");
  });
  document.documentElement.classList.remove(
    "mdi-show-results",
    "mdi-show-winner",
    "mdi-dim-others",
    "mdi-dim-answers",
    "mdi-options-hidden"
  );
}

function updateVisuals(state, data) {
  let qType = "poll";
  let correctOpt = null;
  if (data?.question) {
    if (data.question.type) qType = data.question.type;
    if (data.question.correct) correctOpt = data.question.correct;
    elQuestion.textContent = data.question.prompt || "Question sans titre";
    const opts = data.question.options || {};
    ["A","B","C","D"].forEach(k => answers[k].txt.textContent = opts[k] || "—");
  }

  const p = data?.percents || {};
  const stats = ["A","B","C","D"].map(k => ({ key: k, val: Number(p[k]) || 0 }));
  stats.forEach(item => {
    answers[item.key].pct.textContent = Math.round(item.val) + "%";
  });

  if (state === "results" || state === "reveal" || state === "winner") {
    document.documentElement.classList.add("mdi-show-results");
    if (qType === "poll") {
      const sortedValues = [...new Set(stats.map(s => s.val))].sort((a, b) => b - a);
      stats.forEach(item => {
        const rank = sortedValues.indexOf(item.val) + 1;
        answers[item.key].el.setAttribute("data-rank", rank);
        answers[item.key].el.style.setProperty("--gauge-width", item.val + "%");
      });
    } else if (qType === "quiz") {
      if ((state === "reveal" || state === "winner") && correctOpt) {
        document.documentElement.classList.add("mdi-dim-others");
        const winEl = answers[correctOpt].el;
        if (winEl) {
          winEl.classList.add("is-correct");
          if (state === "winner") winEl.classList.add("force-visible");
        }
      }
    }
  }

  if (state === "winner") {
    elWinnerName.textContent = data?.winnerName || "Gagnant";
    document.documentElement.classList.add("mdi-show-winner");
    document.documentElement.classList.add("mdi-dim-answers");
  }
}

/* -------- State Machine -------- */
function applyState(state, data) {
  if (AUTH_MODE === "strict" && !isAuthorized) return;

  if (!state || state === "idle") {
    setBootTransparent();
    emitPresence(false);
    return;
  }

  let uiState = state;
  if (state === "question") uiState = "prompt";
  if (state === "options")  uiState = "open";

  document.documentElement.setAttribute("data-mdi-state", uiState);
  elQuiz.style.display = "grid";
  if (isAuthorized) elSecurity.style.display = "none";

  resetVisuals();
  updateVisuals(uiState, data);

  if (uiState === "prompt") {
    document.documentElement.classList.add("mdi-options-hidden");
  } else if (uiState === "open") {
    document.documentElement.classList.add("mdi-options-hidden");
    setTimeout(() => {
      requestAnimationFrame(() => {
        document.documentElement.classList.remove("mdi-options-hidden");
      });
    }, 100);
  }

  emitPresence(true);
}

/* -------- CSS Vars -------- */
function readCssVars() {
  const s = getComputedStyle(document.documentElement);
  AUTH_MODE = s.getPropertyValue("--auth-mode").trim().replace(/"/g, "") || "strict";
  ROOM_ID   = s.getPropertyValue("--room-id").trim().replace(/"/g, "") || "";
  ROOM_KEY  = s.getPropertyValue("--room-key").trim().replace(/"/g, "") || "";
}

/* -------- Socket -------- */
function initSocket() {
  socket = io(SERVER_URL, { transports: ["websocket", "polling"] });

  socket.on("connect", () => {
    console.log("✅ [QUIZ] Connecté");
    if (AUTH_MODE === "strict") {
      socket.emit("overlay:join", { room: ROOM_ID, key: ROOM_KEY, overlay: OVERLAY_NAME });
    } else {
      socket.emit("rejoindre_salle", ROOM_ID);
    }
    // Signaler la présence en ligne
    socket.emit("overlay:online", { room: ROOM_ID, overlay: OVERLAY_NAME });
  });

  socket.on("disconnect", () => {
    console.log("🔴 [QUIZ] Déconnecté");
  });

  socket.on("overlay:forbidden", () => showDenied());

  socket.on("overlay:state", (payload) => {
    if (payload?.overlay !== OVERLAY_NAME) return;
    showAuthorized();
    applyState(payload.state, payload.data);
  });
}

/* -------- Boot — attendre les CSS vars OBS -------- */
const t = setInterval(() => {
  readCssVars();
  if (ROOM_ID && ROOM_KEY) { clearInterval(t); initSocket(); }
}, 200);
