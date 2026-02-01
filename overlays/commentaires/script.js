const SERVER_URL = "https://magic-digital-impact-live.onrender.com";
const OVERLAY_NAME = "commentaires";

/* ---------------- CSS Vars ---------------- */
function cssVar(name, fallback = "") {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name);
  return v ? v.trim().replace(/^['"]+|['"]+$/g, "") : fallback;
}
function cssNum(name, fallback) {
  const n = Number(cssVar(name, ""));
  return Number.isFinite(n) ? n : fallback;
}

/* ---------------- Boot / Security ---------------- */
const elSecurity = document.getElementById("security-screen");
const elApp = document.getElementById("app");
const elMeta = document.getElementById("meta");
const elText = document.getElementById("text");

function setBootTransparent(){
  elSecurity.style.display = "none";
  elApp.style.display = "none";
  document.documentElement.classList.remove("mdi-ready","mdi-denied","mdi-show");
  document.documentElement.removeAttribute("data-position");
}
function showDenied(){
  document.documentElement.classList.remove("mdi-ready","mdi-show");
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
function hidePanel(){
  document.documentElement.classList.remove("mdi-show");
}
function showPanel(){
  document.documentElement.classList.add("mdi-show");
}

/* ---------------- Auth vars ---------------- */
let AUTH_MODE = "strict";
let ROOM_ID = "";
let ROOM_KEY = "";

function readAuthVars(){
  const s = getComputedStyle(document.documentElement);
  AUTH_MODE = (s.getPropertyValue("--auth-mode").trim().replace(/"/g,"") || "strict").toLowerCase();
  ROOM_ID = s.getPropertyValue("--room-id").trim().replace(/"/g,"") || "";
  ROOM_KEY = s.getPropertyValue("--room-key").trim().replace(/"/g,"") || "";
}

function applyUiVars(){
  const pos = (cssVar("--position","bottom") || "bottom").trim().toLowerCase();
  document.documentElement.setAttribute("data-position", (pos === "top") ? "top" : "bottom");
}

/* ---------------- Socket ---------------- */
let socket = null;

function handleRemotePayload(p){
  if (!p) return;
  const action = String(p.action || "").toLowerCase();

  if (action === "hide") {
    hidePanel();
    return;
  }
  if (action === "clear") {
    elMeta.textContent = "";
    elText.textContent = "";
    hidePanel();
    return;
  }
  if (action === "show") {
    const user = String(p.user || "").trim();
    const text = String(p.text || "").trim();
    if (!text) return;

    elMeta.textContent = user ? user : "";
    elMeta.style.display = user ? "block" : "none";
    elText.textContent = text;

    showPanel();

    const autoHide = cssNum("--auto-hide-ms", 0);
    if (autoHide > 0) {
      clearTimeout(window.__mdiHideT);
      window.__mdiHideT = setTimeout(() => hidePanel(), autoHide);
    }
  }
}

function initSocket(){
  socket = io(SERVER_URL, { transports: ["websocket","polling"] });

  socket.on("connect", () => {
    socket.emit("overlay:join", { room: ROOM_ID, key: ROOM_KEY, overlay: OVERLAY_NAME });
  });

  socket.on("overlay:forbidden", () => showDenied());

  socket.on("overlay:state", (payload) => {
    if (!payload || payload.overlay !== OVERLAY_NAME) return;
    applyUiVars();
    showReady();
    hidePanel();
  });

  // ✅ event officiel
  socket.on("control:commentaires", handleRemotePayload);

  // ✅ fallback (au cas où le serveur émet encore l'ancien event)
  socket.on("control:chat_display_remote", handleRemotePayload);
}

/* ---------------- Init (anti-flicker) ---------------- */
function init(){
  setBootTransparent();

  const poll = setInterval(() => {
    readAuthVars();

    if (AUTH_MODE === "legacy"){
      if (!ROOM_ID) return;
      clearInterval(poll);
      initSocket();
      return;
    }

    if (ROOM_ID && ROOM_KEY){
      clearInterval(poll);
      initSocket();
    }
  }, 200);

  setTimeout(() => {
    readAuthVars();
    if (AUTH_MODE === "strict" && (!ROOM_ID || !ROOM_KEY)) showDenied();
  }, 1400);
}

init();
