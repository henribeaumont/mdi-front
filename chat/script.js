const SERVER_URL = "https://magic-digital-impact-live.onrender.com";
const OVERLAY_NAME_FOR_AUTH = "commentaires";

const $ = (id) => document.getElementById(id);

const elStatus = $("status");
const elDot = $("dot");
const elRoom = $("room");
const elKey = $("key");
const elConnect = $("connect");
const elDisconnect = $("disconnect");
const elList = $("list");
const elFilter = $("filter");
const elHide = $("hide");
const elClear = $("clear");

let socket = null;
let items = [];
let seq = 0;

// id du message actuellement affiché à l'écran
let activeId = null;

function setStatus(text, ok){
  elStatus.textContent = text;
  elDot.style.background = ok ? "var(--ok)" : "var(--bad)";
}

function normalizeText(raw){
  return String(raw||"").replace(/\u00A0/g," ").replace(/\s+/g," ").trim();
}

function setHideButtonState(){
  const hasActive = Boolean(activeId);
  elHide.classList.toggle("danger", hasActive);
  elHide.textContent = hasActive ? "Masquer (ON)" : "Masquer";
}

function render(){
  const q = normalizeText(elFilter.value).toLowerCase();
  elList.innerHTML = "";

  const list = [...items].sort((a,b) => (b.pinned - a.pinned) || (b.ts - a.ts));

  for (const it of list){
    if (q && !(`${it.user} ${it.text}`.toLowerCase().includes(q))) continue;

    const div = document.createElement("div");
    div.className = "item"
      + (it.pinned ? " pinned" : "")
      + (it.id === activeId ? " active" : "");

    const badge = document.createElement("div");
    badge.className = "badge";
    badge.textContent = it.pinned ? "PIN" : "MSG";

    const body = document.createElement("div");
    body.className = "body";

    const meta = document.createElement("div");
    meta.className = "meta";

    const author = document.createElement("span");
    author.textContent = it.user ? it.user : "—";

    const time = document.createElement("span");
    time.textContent = new Date(it.ts).toLocaleTimeString([], {hour:"2-digit", minute:"2-digit", second:"2-digit"});

    meta.appendChild(author);
    meta.appendChild(time);

    const msg = document.createElement("div");
    msg.className = "msg";
    msg.textContent = it.text;

    body.appendChild(meta);
    body.appendChild(msg);

    div.appendChild(badge);
    div.appendChild(body);

    div.addEventListener("click", (e) => {
      if (!socket || !socket.connected) return;

      if (e.shiftKey){
        it.pinned = !it.pinned;
        render();
        return;
      }

      const room = normalizeText(elRoom.value);

      // 🔥 Envoi affiche
      socket.emit("control:commentaires", {
        room,
        action: "show",
        text: it.text,
        user: it.user
      });

      // UI: on met en surbrillance verte
      activeId = it.id;
      setHideButtonState();
      render();
    });

    elList.appendChild(div);
  }
}

function addItem(text, user){
  const t = normalizeText(text);
  if (!t) return;
  const u = normalizeText(user);

  // Anti-doublons
  const sig = (u + "|" + t).toLowerCase();
  const already = items.slice(0, 80).some(x => x.sig === sig);
  if (already) return;

  items.unshift({
    id: `m${Date.now()}_${seq++}`,
    text: t,
    user: u,
    ts: Date.now(),
    pinned:false,
    sig
  });

  if (items.length > 250) items.pop();
  render();
}

function setConnectedUi(isOn){
  elDisconnect.disabled = !isOn;
  elConnect.disabled = isOn;

  elHide.disabled = !isOn;
  elClear.disabled = !isOn;

  if (!isOn){
    activeId = null;
    setHideButtonState();
    render();
  }
}

function connect(){
  const room = normalizeText(elRoom.value);
  const key  = normalizeText(elKey.value);

  if (!room || !key){
    setStatus("ID_SALLE / ROOM_KEY manquants", false);
    return;
  }

  if (socket) socket.disconnect();
  socket = io(SERVER_URL, { transports: ["websocket","polling"] });

  socket.on("connect", () => {
    setStatus("Connecté", true);
    setConnectedUi(true);

    // Join SaaS (auth + join room côté serveur)
    socket.emit("overlay:join", { room, key, overlay: OVERLAY_NAME_FOR_AUTH });
  });

  socket.on("overlay:forbidden", () => {
    setStatus("FORBIDDEN (ID_SALLE / ROOM_KEY)", false);
  });

  socket.on("disconnect", () => {
    setStatus("Déconnecté", false);
    setConnectedUi(false);
  });

  // flux universel
  socket.on("raw_vote", (data) => {
    addItem(data?.vote ?? "", data?.user ?? "");
  });
}

function disconnect(){
  if (!socket) return;
  socket.disconnect();
  socket = null;
  setStatus("Déconnecté", false);
  setConnectedUi(false);
}

elConnect.addEventListener("click", connect);
elDisconnect.addEventListener("click", disconnect);

elFilter.addEventListener("input", render);

elHide.addEventListener("click", () => {
  if (!socket || !socket.connected) return;
  const room = normalizeText(elRoom.value);

  socket.emit("control:commentaires", { room, action: "hide" });

  // UI
  activeId = null;
  setHideButtonState();
  render();
});

elClear.addEventListener("click", () => {
  items = [];
  activeId = null;
  setHideButtonState();
  render();
});

setStatus("Déconnecté", false);
setHideButtonState();
render();
