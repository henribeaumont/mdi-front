/**
 * MDI CHAT DISPLAY REMOTE - V1
 * - ZÉRO FLICKER : invisible tant que overlay:state OK + auth OK
 * - Sécurité : écran ACCESS DENIED
 * - Reçoit raw_vote, empile en queue
 * - Affiche UNIQUEMENT sur commande : control:chat_display_remote
 */

const SERVER_URL = "https://magic-digital-impact-live.onrender.com";
const OVERLAY_TYPE = "chat_display_remote";

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
const elCard = document.getElementById("card");
const elMeta = document.getElementById("meta");
const elAuthor = document.getElementById("author");
const elText = document.getElementById("text");

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

/* ---------- Filtering ---------- */
function normalizeText(raw){
  return String(raw||"").replace(/\u00A0/g," ").replace(/\s+/g," ").trim();
}
function isQuizToken(txt){
  return /^[ABCD]$/.test(String(txt||"").trim().toUpperCase());
}
function shouldAcceptMessage(text){
  const t = normalizeText(text);
  if (!t && cssOnOff("--ignore-empty", true)) return false;
  if (cssOnOff("--ignore-quiz-abcd", true) && isQuizToken(t)) return false;
  return true;
}

/* ---------- Queue ---------- */
const MAX_QUEUE = 200;
let queue = []; // { text, user?, ts }
let lastMsg = null;

/* ---------- Show/Hide engine ---------- */
let hideTimer = null;

function hardHide(){
  clearTimeout(hideTimer);
  hideTimer = null;
  elCard.classList.add("is-hidden");
  elCard.classList.remove("is-visible","is-hiding");
  elCard.setAttribute("aria-hidden","true");
}
function showCard(payload){
  clearTimeout(hideTimer);
  hideTimer = null;

  const text = normalizeText(payload?.text ?? "");
  const user = normalizeText(payload?.user ?? "");

  elText.textContent = text || "";
  if (user){
    elAuthor.textContent = user;
    elMeta.classList.remove("hidden");
  } else {
    elAuthor.textContent = "";
    elMeta.classList.add("hidden");
  }

  elCard.classList.remove("is-hidden","is-hiding");
  // next frame to allow transition
  requestAnimationFrame(() => {
    elCard.classList.add("is-visible");
    elCard.setAttribute("aria-hidden","false");
  });

  const autoHide = cssOnOff("--auto-hide", true);
  const autoMs = clamp(cssNum("--auto-hide-ms", 6000), 800, 60000);

  if (autoHide){
    hideTimer = setTimeout(() => {
      hideCard();
    }, autoMs);
  }
}
function hideCard(){
  clearTimeout(hideTimer);
  hideTimer = null;

  if (elCard.classList.contains("is-hidden")) return;

  elCard.classList.remove("is-visible");
  elCard.classList.add("is-hiding");

  const outMs = clamp(cssNum("--anim-out-ms", 220), 80, 2000);
  setTimeout(() => {
    hardHide();
  }, outMs + 20);
}

/* ---------- Control channel ---------- */
function handleControl(payload){
  const action = String(payload?.action || "").toLowerCase();

  if (action === "hide"){
    hideCard();
    return;
  }

  if (action === "clear"){
    queue = [];
    lastMsg = null;
    hideCard();
    return;
  }

  // show text direct (telecommande)
  if (action === "show"){
    const text = normalizeText(payload?.text ?? "");
    if (!text) return;
    showCard({ text, user: payload?.user ?? "" });
    return;
  }

  // push last message from queue
  if (action === "push"){
    const offset = Number.isFinite(Number(payload?.offset)) ? parseInt(payload.offset,10) : 0;
    const idx = queue.length - 1 - Math.max(0, offset);
    const item = queue[idx] || null;
    if (!item) return;
    lastMsg = item;
    showCard({ text: item.text, user: item.user || "" });
    return;
  }

  // replay last displayed
  if (action === "replay"){
    if (!lastMsg) return;
    showCard({ text: lastMsg.text, user: lastMsg.user || "" });
    return;
  }
}

/* ---------- Socket / Auth ---------- */
let socket = null;
let AUTH_MODE = "strict";
let ROOM_ID = "";
let ROOM_KEY = "";

function readAuthVars(){
  AUTH_MODE = (cssVar("--auth-mode","strict") || "strict").toLowerCase();
  ROOM_ID = cssVar("--room-id","");
  ROOM_KEY = cssVar("--room-key","");
}

async function init(){
  setBootHidden();

  // Attente injection OBS
  await new Promise(r => setTimeout(r, 650));

  readAuthVars();

  if (AUTH_MODE === "strict"){
    if (!ROOM_ID || !ROOM_KEY) { showDenied(); return; }
  } else {
    if (!ROOM_ID) { showDenied(); return; }
  }

  socket = io(SERVER_URL, { transports: ["websocket","polling"] });

  socket.emit("overlay:join", { room: ROOM_ID, key: ROOM_KEY, overlay: OVERLAY_TYPE });

  socket.on("overlay:forbidden", () => showDenied());

  socket.on("overlay:state", (payload) => {
    if (payload?.overlay !== OVERLAY_TYPE) return;
    showReady();
    hardHide();
    queue = [];
    lastMsg = null;
  });

  socket.on("raw_vote", (data) => {
    const text = normalizeText(data?.vote ?? "");
    const user = normalizeText(data?.user ?? "");

    if (!shouldAcceptMessage(text)) return;

    const item = { text, user, ts: Date.now() };
    queue.push(item);
    if (queue.length > MAX_QUEUE) queue.shift();
  });

  // Commandes télécommande (Stream Deck)
  socket.on("control:chat_display_remote", (payload) => {
    handleControl(payload || {});
  });
}

init();