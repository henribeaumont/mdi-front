/* commentaires.js — OVERLAY: "commentaires"
   - Auth/join : overlay:join { room, key, overlay:"commentaires" }
   - Collecte : raw_vote => AUTO SHOW (pour test mécanique collecte)
   - Pilotage optionnel : control:set_state show/hide (si télécommande plus tard)
*/

const SERVER_URL = "https://magic-digital-impact-live.onrender.com";
const OVERLAY_NAME = "commentaires";

// ===== Utils =====
const clean = (t) =>
  String(t ?? "")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function getParamAny(names){
  try{
    const u = new URL(location.href);
    for(const n of names){
      const v = clean(u.searchParams.get(n));
      if(v) return v;
    }
  }catch(_){}
  return "";
}

function safeJsonParse(x){
  try{ return JSON.parse(x); }catch(_){ return null; }
}

// ===== DOM =====
const elCard = document.getElementById("card");
const elText = document.getElementById("text");
const elAuthor = document.getElementById("author");
const elSep = document.getElementById("sep");

// ===== State =====
let socket = null;

// ⚠️ IMPORTANT: on accepte plusieurs noms de params pour éviter les pièges
let room = "";
let key  = "";

// Auto-hide timer
let hideTimer = null;
const AUTO_HIDE_MS = 8000; // ajuste si tu veux

// Anti-doublons (évite rafales identiques)
const seen = new Map(); // sig -> ts
const DEDUPE_WINDOW_MS = 1200;

function sigOf(text, user){
  return (clean(user) + "|" + clean(text)).toLowerCase();
}

function pruneSeen(now){
  for(const [k, ts] of seen.entries()){
    if(now - ts > DEDUPE_WINDOW_MS) seen.delete(k);
  }
}

// ===== UI =====
function setLoadingDone(){
  document.body.classList.remove("is-loading");
}

function showCard(text, user){
  const t = clean(text);
  const u = clean(user);

  if(!t){
    hideCard();
    return;
  }

  elText.textContent = t;

  if(u){
    elAuthor.textContent = u;
    elAuthor.style.display = "";
    elSep.style.display = "";
  }else{
    elAuthor.textContent = "";
    elAuthor.style.display = "none";
    elSep.style.display = "none";
  }

  elCard.classList.remove("hidden");
  elCard.classList.add("show");

  // auto-hide
  if(hideTimer) clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    hideCard();
  }, AUTO_HIDE_MS);
}

function hideCard(){
  elCard.classList.remove("show");
  if(hideTimer){
    clearTimeout(hideTimer);
    hideTimer = null;
  }
}

// ===== Connect =====
function connect(){
  // ✅ récup params depuis URL
  // Tu peux utiliser : ?room=ID_SALLE&key=ROOM_KEY
  // ou ?ID_SALLE=...&ROOM_KEY=... etc.
  room = getParamAny(["room","ID_SALLE","id_salle","idsalle","id"]);
  key  = getParamAny(["key","ROOM_KEY","room_key","roomKey","k"]);

  // Fallback possible via hash JSON
  // ex: ...#{"room":"...","key":"..."}
  if((!room || !key) && location.hash && location.hash.length > 2){
    const maybe = safeJsonParse(decodeURIComponent(location.hash.slice(1)));
    if(maybe && typeof maybe === "object"){
      room = room || clean(maybe.room || maybe.ID_SALLE);
      key  = key  || clean(maybe.key  || maybe.ROOM_KEY);
    }
  }

  socket = io(SERVER_URL, { transports: ["websocket", "polling"] });

  socket.on("connect", () => {
    // IMPORTANT: join AVEC key
    if(room && key){
      socket.emit("overlay:join", { room, key, overlay: OVERLAY_NAME });
      console.log("➡️ overlay:join envoyé", { room, key: "***", overlay: OVERLAY_NAME });
    } else {
      console.warn("⚠️ room/key manquants dans l'URL. Ajoute ?room=...&key=...");
    }

    // Anti-flicker: on rend visible après connection socket
    setLoadingDone();
  });

  socket.on("overlay:forbidden", () => {
    console.error("⛔ overlay:forbidden — check ID_SALLE/ROOM_KEY");
    hideCard();
  });

  socket.on("disconnect", () => {
    console.warn("🔌 disconnect");
    hideCard();
  });

  // ===== 1) Collecte brute => AUTO SHOW (test) =====
  socket.on("raw_vote", (data) => {
    const text = clean(data?.vote);
    const user = clean(data?.user);

    if(!text) return;

    // anti-doublons
    const now = Date.now();
    pruneSeen(now);
    const sig = sigOf(text, user);
    const last = seen.get(sig);
    if(last && (now - last) < DEDUPE_WINDOW_MS) return;
    seen.set(sig, now);

    // ✅ affichage direct (mode test collecte)
    showCard(text, user);
  });

  // ===== 2) Pilotage optionnel (télécommande) =====
  socket.on("control:set_state", (payload) => {
    if(payload?.overlay && clean(payload.overlay) !== OVERLAY_NAME) return;

    const state = clean(payload?.state);

    if(state === "show"){
      const text = clean(payload?.data?.text ?? payload?.text);
      const user = clean(payload?.data?.user ?? payload?.user);
      showCard(text, user);
    }

    if(state === "hide"){
      hideCard();
    }
  });

  // Compat ancien event
  socket.on("control:commentaires", (payload) => {
    const action = clean(payload?.action);
    if(action === "show") showCard(payload?.text, payload?.user);
    if(action === "hide") hideCard();
  });
}

// Start
connect();
