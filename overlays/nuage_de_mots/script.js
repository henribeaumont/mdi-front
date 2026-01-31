/**
 * MDI WORD CLOUD - V5.6 SaaS (PATCH SAFE)
 * - Écoute raw_vote
 * - Ignore quiz A/B/C/D
 * - Tolérance texte étendue
 * - ZÉRO régression sur le moteur graphique
 */

const SERVER_URL = "https://magic-digital-impact-live.onrender.com";
const OVERLAY_TYPE = "word_cloud";

/* --- UTILS --- */
function cssVar(name, fallback = "") {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name);
  return v ? v.trim().replace(/^['"]+|['"]+$/g, "") : fallback;
}

function isQuizToken(txt) {
  return /^[ABCD]$/.test(txt);
}

/* --- UI --- */
function showDenied() {
  document.getElementById("cloud-container").classList.add("hidden");
  document.getElementById("security-screen").classList.remove("hidden");
  document.body.style.backgroundColor = "black";
}

function showCloud() {
  document.getElementById("security-screen").classList.add("hidden");
  document.getElementById("cloud-container").classList.remove("hidden");
  document.body.style.backgroundColor = "transparent";
}

/* --- MOTEUR VISUEL --- */
let dbMots = {}; 
let globalColorIndex = 0;

const TAILLE_BASE_MAX = 130; 
const TAILLE_MIN = 20;
const MARGE_ENTRE_MOTS = 15; 
const PADDING_CADRE = 40; 

const zone = document.getElementById('word-zone');
const container = document.getElementById('cloud-container');
const measureZone = document.getElementById('measure-zone'); 

function getPalette() {
  return [
    cssVar("--color-1", "#F054A2"),
    cssVar("--color-2", "#FFFAE4"),
    cssVar("--color-3", "#F9AD48"),
    cssVar("--color-4", "#FBCAEF"),
    cssVar("--color-5", "#71CCFD")
  ];
}

/* ==================================================
   PATCH IMPORTANT ICI
================================================== */
function traiterMessage(texteBrut) {
  if (!texteBrut) return;

  let texte = String(texteBrut).trim();

  // 🔒 Ignore quiz
  if (isQuizToken(texte)) return;

  // Normalisation soft (on garde emojis & accents)
  texte = texte.replace(/\s+/g, " ").trim();

  // Sécurité anti bruit
  if (!texte) return;
  if (texte.length > 60) return;        // ⬅️ élargi
  if (texte.split(" ").length > 6) return;

  // RESET manuel
  if (texte.toUpperCase() === "RESET") {
    resetEcran();
    return;
  }

  const key = texte.toUpperCase();

  if (dbMots[key]) {
    dbMots[key].count++;
  } else {
    const palette = getPalette();
    dbMots[key] = {
      text: key,
      count: 1,
      color: palette[globalColorIndex]
    };
    globalColorIndex = (globalColorIndex + 1) % palette.length;
  }

  requestAnimationFrame(calculerEtAfficherNuage);
}
