/* ==========================================================
   MDI OVERLAY — LOGIQUE SONDAGE & QUIZ (V3.5)
   ========================================================== */
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

/* --- 1. BOOT & AUTH --- */
let isAuthorized = false;
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

/* --- 2. LOGIQUE VISUELLE (POLL & QUIZ) --- */
function resetVisuals() {
  answerEls.forEach(el => {
    el.classList.remove("is-correct");
    el.removeAttribute("data-rank");
    el.style.setProperty("--gauge-width", "0%");
  });
  document.documentElement.classList.remove("mdi-show-results", "mdi-show-winner", "mdi-dim-others");
}

function updateVisuals(state, data) {
  // Reset
  resetVisuals();
  
  // A. Mise à jour textes
  let qType = "poll"; // default
  let correctOpt = null;

  if (data?.question) {
    // Format V3.5 : { question: { prompt: "...", type: "quiz", correct: "A", options: {...} } }
    if (data.question.type) qType = data.question.type;
    if (data.question.correct) correctOpt = data.question.correct;
    
    elQuestion.textContent = data.question.prompt || "Question sans titre";
    const opts = data.question.options || {};
    ["A","B","C","D"].forEach(k => {
      answers[k].txt.textContent = opts[k] || "—";
    });
  }

  // B. Mise à jour pourcentages & Ranks (Poll)
  const p = data?.percents || {};
  const stats = ["A","B","C","D"].map(k => ({ key: k, val: Number(p[k]) || 0 }));
  
  // Affichage textuel %
  stats.forEach(item => {
    answers[item.key].pct.textContent = Math.round(item.val) + "%";
  });

  // Si Resultats (Poll ou Quiz)
  if (state === "results" || state === "reveal" || state === "winner") {
    document.documentElement.classList.add("mdi-show-results");

    if (qType === "poll") {
      // --- LOGIQUE SONDAGE (Jauges Couleur) ---
      // Trier pour le rang : Plus grand score = Rank 1
      const sorted = [...stats].sort((a,b) => b.val - a.val);
      
      stats.forEach(item => {
        const rankIndex = sorted.findIndex(s => s.key === item.key); // 0 = 1er
        const rank = rankIndex + 1;
        const el = answers[item.key].el;
        
        el.setAttribute("data-rank", rank); // Active la couleur CSS (Vert/Jaune...)
        el.style.setProperty("--gauge-width", item.val + "%"); // Remplit la jauge
      });
    } 
    else if (qType === "quiz") {
      // --- LOGIQUE QUIZ (Bonne réponse) ---
      if ((state === "reveal" || state === "winner") && correctOpt) {
        document.documentElement.classList.add("mdi-dim-others");
        const winEl = answers[correctOpt].el;
        if(winEl) winEl.classList.add("is-correct");
      }
    }
  }

  // C. Winner Screen
  if (state === "winner") {
    elWinnerName.textContent = data?.winnerName || "Gagnant";
    document.documentElement.classList.add("mdi-show-winner");
  }
}

/* --- 3. STATE MACHINE --- */
function applyState(state, data) {
  if (AUTH_MODE === "strict" && !isAuthorized) return;
  if (!state || state === "idle") {
    setBootTransparent();
    return;
  }
  
  // Mapping "question" -> "prompt" pour CSS
  let uiState = (state === "question") ? "prompt" : state;
  document.documentElement.setAttribute("data-mdi-state", uiState);
  
  // Visible
  elQuiz.style.display = "grid";
  if(isAuthorized) elSecurity.style.display = "none";

  updateVisuals(uiState, data);
}

/* --- 4. SOCKET & AUTH --- */
let socket = null;
let AUTH_MODE = "strict";
let ROOM_ID = "";
let ROOM_KEY = "";

function readCssVars() {
  const s = getComputedStyle(document.documentElement);
  AUTH_MODE = s.getPropertyValue("--auth-mode").trim().replace(/"/g, "") || "strict";
  ROOM_ID = s.getPropertyValue("--room-id").trim().replace(/"/g, "") || "";
  ROOM_KEY = s.getPropertyValue("--room-key").trim().replace(/"/g, "") || "";
}

function initSocket() {
  socket = io(SERVER_URL, { transports: ["websocket", "polling"] });
  
  socket.on("connect", () => {
    if(AUTH_MODE==="strict") socket.emit("overlay:join", { room: ROOM_ID, key: ROOM_KEY, overlay: OVERLAY_NAME });
    else socket.emit("rejoindre_salle", ROOM_ID);
  });

  socket.on("overlay:forbidden", () => showDenied());
  
  socket.on("overlay:state", (payload) => {
    if(payload?.overlay !== OVERLAY_NAME) return;
    showAuthorized();
    applyState(payload.state, payload.data);
  });
}

// Boucle d'attente OBS CSS
const t = setInterval(() => {
  readCssVars();
  if(ROOM_ID && ROOM_KEY) {
    clearInterval(t);
    initSocket();
  }
}, 200);
