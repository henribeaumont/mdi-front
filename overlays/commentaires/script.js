/* commentaires.js
   Overlay = "commentaires"
   - Auth/join : overlay:join { room, key, overlay:"commentaires" }
   - Collecte : socket.on("raw_vote", ...)
   - Display : socket.on("control:set_state", ...) show/hide
*/

const SERVER_URL = "https://magic-digital-impact-live.onrender.com";
const OVERLAY_NAME = "commentaires";

// Utilitaires
const clean = (t) =>
  String(t ?? "")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function getParam(name){
  try{
    const u = new URL(location.href);
    return clean(u.searchParams.get(name));
  }catch(_){
    return "";
  }
}

function safeJsonParse(x){
  try{ return JSON.parse(x); }catch(_){ return null; }
}

// DOM
const elCard = document.getElementById("card");
const elText = document.getElementById("text");
const elAuthor = document.getElementById("author");
const elSep = document.getElementById("sep");

// État
let socket = null;
let room = "";
let key = "";

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
}

function hideCard(){
  elCard.classList.remove("show");
}

// Connexion
function connect(){
  // ✅ Les overlays OBS passent souvent room/key dans l’URL
  // ex: .../commentaires.html?room=XXX&key=YYY
  room = getParam("room");
  key  = getParam("key");

  // Fallback: parfois ils sont fournis en hash JSON
  // ex: ...#{"room":"...","key":"..."}
  if((!room || !key) && location.hash && location.hash.length > 2){
    const maybe = safeJsonParse(decodeURIComponent(location.hash.slice(1)));
    if(maybe && typeof maybe === "object"){
      room = room || clean(maybe.room);
      key  = key  || clean(maybe.key);
    }
  }

  socket = io(SERVER_URL, { transports: ["websocket", "polling"] });

  socket.on("connect", () => {
    // Auth join (entitlements)
    if(room && key){
      socket.emit("overlay:join", { room, key, overlay: OVERLAY_NAME });
    }
    // prêt (anti-flicker)
    setLoadingDone();
  });

  socket.on("overlay:forbidden", () => {
    // On reste invisible pour éviter un overlay "vide"
    hideCard();
  });

  socket.on("disconnect", () => {
    // Par sécurité, on masque
    hideCard();
  });

  // 1) Collecte brute (extension → server → overlay)
  socket.on("raw_vote", (data) => {
    // data attendu : { vote: "texte", user: "nom" }
    const text = clean(data?.vote);
    const user = clean(data?.user);

    if(!text) return;

    const now = Date.now();
    pruneSeen(now);
    const sig = sigOf(text, user);

    // Anti-doublons
    const last = seen.get(sig);
    if(last && (now - last) < DEDUPE_WINDOW_MS) return;
    seen.set(sig, now);

    // Ici on NE force pas l'affichage automatique,
    // parce que tu pilotes l'affichage via la télécommande.
    // Donc on ne fait rien d'autre que "collecter".
    // (Si un jour tu veux auto-afficher, tu pourras appeler showCard(text,user))
  });

  // 2) Pilotage affichage (télécommande → server → overlay)
  socket.on("control:set_state", (payload) => {
    // payload attendu :
    // { overlay:"commentaires", state:"show|hide", data:{text, user} }
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

  // Optionnel : compat ancien event spécifique
  socket.on("control:commentaires", (payload) => {
    // payload attendu (ancien) : { action:"show|hide", text, user }
    const action = clean(payload?.action);
    if(action === "show"){
      showCard(payload?.text, payload?.user);
    }
    if(action === "hide"){
      hideCard();
    }
  });
}

// Démarrage
connect();
