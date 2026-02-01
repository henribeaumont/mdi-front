/**
 * MDI WORD CLOUD – V5.8
 * - Session timestamp (anti-historique / anti-scroll)
 * - Mots + chiffres uniquement
 * - Aucun bouton extension
 * - Compatible extension initiale
 */

const SERVER_URL = "https://magic-digital-impact-live.onrender.com";
const OVERLAY_TYPE = "word_cloud";

/* ================= UTILS ================= */

function cssVar(name, fallback = "") {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name);
  return v ? v.trim().replace(/^['"]|['"]$/g, "") : fallback;
}

function isQuizToken(v) {
  return /^[ABCD]$/.test(String(v || "").trim().toUpperCase());
}

function cleanWordsOnly(txt) {
  try {
    return (txt.match(/[\p{L}\p{N}]+/gu) || []).join(" ");
  } catch {
    return (txt.match(/[A-Za-z0-9]+/g) || []).join(" ");
  }
}

/* ================= UI ================= */

const elSecurity = document.getElementById("security-screen");
const elCloud = document.getElementById("cloud-container");
const zone = document.getElementById("word-zone");
const measureZone = document.getElementById("measure-zone");

function showDenied() {
  elCloud.classList.add("hidden");
  elSecurity.classList.remove("hidden");
  document.body.style.background = "black";
}

function showCloud() {
  elSecurity.classList.add("hidden");
  elCloud.classList.remove("hidden");
  document.body.style.background = "transparent";
}

/* ================= DATA ================= */

let dbMots = {};
let colorIndex = 0;

function getPalette() {
  return [
    cssVar("--color-1", "#F054A2"),
    cssVar("--color-2", "#2ecc71"),
    cssVar("--color-3", "#F9AD48"),
    cssVar("--color-4", "#3b82f6"),
    cssVar("--color-5", "#ffffff")
  ];
}

function resetNuage() {
  dbMots = {};
  zone.innerHTML = "";
  colorIndex = 0;
}

/* ================= MOTEUR ================= */

function traiterMessage(raw) {
  if (!raw) return;

  let txt = String(raw).trim();
  if (isQuizToken(txt)) return;

  // mots + chiffres seulement
  txt = cleanWordsOnly(txt);
  if (!txt || txt.length > 60) return;

  const key = txt.toUpperCase();

  if (!dbMots[key]) {
    const palette = getPalette();
    dbMots[key] = {
      text: key,
      count: 1,
      color: palette[colorIndex]
    };
    colorIndex = (colorIndex + 1) % palette.length;
  } else {
    dbMots[key].count++;
  }

  requestAnimationFrame(render);
}

function render() {
  const mots = Object.values(dbMots).sort((a,b) => b.count - a.count);
  if (!mots.length) return;

  const W = elCloud.clientWidth;
  const H = elCloud.clientHeight;
  const CX = W / 2;
  const CY = H / 2;

  let angle = 0;
  let radius = 0;

  mots.forEach((m, i) => {
    let el = document.getElementById("mot-" + m.text);
    if (!el) {
      el = document.createElement("div");
      el.id = "mot-" + m.text;
      el.className = "mot is-new";
      el.innerText = m.text;
      el.style.color = m.color;
      zone.appendChild(el);
      requestAnimationFrame(() => el.classList.add("mdi-in"));
    }

    measureZone.style.fontSize = (90 - i * 3) + "px";
    measureZone.innerText = m.text;

    el.style.fontSize = measureZone.style.fontSize;
    el.style.left = CX + radius * Math.cos(angle) + "px";
    el.style.top = CY + radius * Math.sin(angle) + "px";

    angle += 0.6;
    radius += 6;
  });
}

/* ================= SOCKET ================= */

const socket = io(SERVER_URL, { transports: ["websocket", "polling"] });

async function init() {
  await new Promise(r => setTimeout(r, 500));

  const room = cssVar("--room-id");
  const key  = cssVar("--room-key");
  const mode = cssVar("--auth-mode", "strict");

  if (!room || (mode === "strict" && !key)) {
    showDenied();
    return;
  }

  socket.emit("overlay:join", { room, key, overlay: OVERLAY_TYPE });

  socket.on("overlay:forbidden", showDenied);

  socket.on("overlay:state", (p) => {
    if (p?.overlay !== OVERLAY_TYPE) return;

    // 🔥 FRONTIÈRE TEMPORELLE (clé du fix)
    if (window.chrome?.runtime) {
      chrome.runtime.sendMessage({
        type: "MDI_SESSION_START",
        ts: Date.now()
      });
    }

    resetNuage();
    showCloud();
  });

  socket.on("raw_vote", (d) => {
    traiterMessage(d?.vote);
  });
}

init();
