/* MDI Word Cloud (Test overlay) — Anti-flicker + gating START/STOP */

const boot = document.getElementById("boot");
const denied = document.getElementById("denied");
const app = document.getElementById("app");
const meta = document.getElementById("meta");
const chips = document.getElementById("chips");

const btnStart = document.getElementById("start");
const btnStop = document.getElementById("stop");
const btnClear = document.getElementById("clear");

function cssVar(name){
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim().replace(/^["']|["']$/g,"");
}

function showDenied(){
  denied.classList.remove("hidden");
  app.classList.add("hidden");
  boot.classList.remove("hidden");
}

function showApp(){
  denied.classList.add("hidden");
  app.classList.remove("hidden");
  boot.classList.remove("hidden");
}

function onlyWordsAndNumbers(str){
  const s = String(str||"").trim();
  if (!s) return "";
  const tokens = (s.match(/[\p{L}\p{N}]+/gu) || []);
  return tokens.join(" ").trim();
}

let socket = null;
let sessionActive = false;
let counts = new Map();
let totalAccepted = 0;

function render(){
  const items = Array.from(counts.entries())
    .sort((a,b)=> b[1]-a[1])
    .slice(0, 40);

  chips.innerHTML = "";
  for (const [word, c] of items){
    const el = document.createElement("div");
    el.className = "chip";
    el.innerHTML = `<span class="word">${word}</span><span class="count">${c}</span>`;
    chips.appendChild(el);
  }
  meta.textContent = `session=${sessionActive ? "ON":"OFF"} | unique=${counts.size} | total=${totalAccepted}`;
}

function clearAll(){
  counts = new Map();
  totalAccepted = 0;
  render();
}

function addText(vote){
  const cleaned = onlyWordsAndNumbers(vote);
  if (!cleaned) return;

  // ici on compte par "phrase" (mots + nombres) ; tu peux aussi splitter en mots
  counts.set(cleaned, (counts.get(cleaned) || 0) + 1);
  totalAccepted += 1;
  render();
}

function setSession(on){
  sessionActive = on;
  btnStart.disabled = on;
  btnStop.disabled = !on;
  render();
}

function init(){
  // Anti-flicker : on ne montre rien tant que auth pas OK
  const roomId = cssVar("--room-id");
  const roomKey = cssVar("--room-key");

  if (!roomId || !roomKey){
    showDenied();
    return;
  }

  socket = io("https://magic-digital-impact-live.onrender.com", { transports: ["websocket","polling"] });

  socket.on("connect", () => {
    console.log("[WC] connected");
    // ⚠️ adapte ici si ton serveur attend overlay:join
    socket.emit("rejoindre_salle", roomId);
    showApp();
    render();
  });

  socket.on("overlay:forbidden", () => showDenied());

  socket.on("raw_vote", (payload) => {
    // gating : on ne prend RIEN tant que START n'a pas été fait
    if (!sessionActive) return;
    const vote = payload?.vote ?? "";
    addText(vote);
  });

  // Contrôles (si tu ajoutes des control:* côté serveur plus tard)
  socket.on("control:wordcloud_start", () => setSession(true));
  socket.on("control:wordcloud_stop", () => setSession(false));
  socket.on("control:wordcloud_clear", () => { clearAll(); setSession(false); });
}

btnStart.addEventListener("click", () => setSession(true));
btnStop.addEventListener("click", () => setSession(false));
btnClear.addEventListener("click", () => { clearAll(); setSession(false); });

init();
