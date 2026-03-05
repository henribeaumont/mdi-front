// ==================================================
// MDI LIVE WATCHTOWER - V11.10
// - Zoom / Meet / Teams / WebinarJam
// - ✅ PAS de captation pendant la frappe (pas de characterData observer)
// - ✅ Préserve les emojis (Zoom surtout)
// - ✅ Nettoie le bruit (timestamp, "Nom :", etc.)
// - ✅ Quiz: envoie A/B/C/D propre si détecté
// - ✅ BLACKLIST étendue pour overlay commentaires
// - ✅ Détection intelligente : Word Cloud (1-2 mots courts) vs Commentaires (4+ mots)
// - Ne casse pas les overlays qui lisent raw_vote (emoji_tornado, word_cloud, tug_of_war, etc.)
//
// CHANGELOG V11.10 :
// [A] Teams : correction critique — node.matches() + node.querySelector()
//     V11.9 utilisait uniquement querySelector() (cherche les descendants),
//     ce qui ratait les cas où le node ajouté EST lui-même l'élément message.
// [B] Teams : ajout des sélecteurs New Teams 2024/2025
//     → [data-tid="chat-pane-message"], [data-tid="messageBodyContent"],
//        div[class*="message-body"]
// [C] Teams : fallback universel div[dir="auto"]
//     Résistant aux changements de DOM — Teams utilise cet attribut
//     pour tout contenu textuel utilisateur, quelle que soit la version.
// ==================================================
let CLIENT_ID = "DEMO_CLIENT";
let socket = null;
// Toujours Anonyme => ne bloque pas les tests + compatible serveur actuel
const USER_NAME = "Anonyme";
// Phrases UI à ignorer (bilingue)
const BLACKLIST = [
  "RÉUNION AVEC", "MEETING WITH","AUCUN MESSAGE POUR LE MOMENT", "CONVERSATION",
  "TAPEZ UN NOUVEAU MESSAGE", "TYPE A NEW MESSAGE",
  "MODIFIER", "SUPPRIMER", "RÉPONDRE",
  "KEEP", "EPINGLER", "ÉPINGLER",
  "AUCUN COMMENTAIRE EN ATTENTE", "NO COMMENTS PENDING",
  "AUCUN COMMENTAIRE", "NO COMMENT",
  "EN ATTENTE", "PENDING"
];
// --- Chargement room-id depuis popup ---
console.log(`[MDI] Script chargé sur: ${location.href.substring(0, 100)}`);
if (typeof chrome !== "undefined" && chrome.storage) {
  chrome.storage.local.get(["mdi_room_id"], (result) => {
    if (result.mdi_room_id) CLIENT_ID = result.mdi_room_id;
    initSocket();
  });
} else {
  initSocket();
}
// --- Socket.io ---
function initSocket() {
  if (socket) return;
  if (typeof io !== "function") {
    console.warn("❌ [MDI] io() introuvable. Vérifie manifest.json -> content_scripts: ['socket.io.js','content.js']");
    return;
  }
  socket = io("https://magic-digital-impact-live.onrender.com", {
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: 20
  });
  socket.on("connect", () => {
    console.log(`✅ [MDI] Connecté. Join room: ${CLIENT_ID}`);
    socket.emit("rejoindre_salle", CLIENT_ID);
  });
  socket.on("connect_error", (err) => {
    console.warn("❌ [MDI] connect_error:", err?.message || err);
  });
}
// --- Utils ---
function normalizeSpaces(s) {
  return String(s || "")
    .replace(/\u00A0/g, " ")
    .replace(/\u200B/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
function takeLastUsefulLine(s) {
  const lines = String(s || "").split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  return lines.length ? lines[lines.length - 1] : "";
}
function stripLeadingTime(s) {
  // "12:34" ou "12:34:56"
  return String(s || "").replace(/^\s*\d{1,2}:\d{2}(?::\d{2})?\s+/, "").trim();
}
function stripLeadingNamePrefix(s) {
  // "Henri : A" -> "A" (limite à 40 chars avant :)
  const t = String(s || "").trim();
  const m = t.match(/^(.{1,40}?)(?:\s*[:：]\s+)(.+)$/);
  if (m) return m[2].trim();
  return t;
}
function isBlacklisted(s) {
  const up = String(s || "").toUpperCase();
  return BLACKLIST.some(x => up.includes(x));
}
// Détecte un token quiz A/B/C/D
function extractQuizToken(s) {
  const u = normalizeSpaces(s).toUpperCase().trim();

  // STRICT : Seulement si le message COMPLET est A/B/C/D (avec éventuels séparateurs)
  const exact = u.match(/^([ABCD])[\)\]\.\!\?:,\-\s]*$/);
  if (exact) return exact[1];

  // Ne PAS détecter A/B/C/D dans un mot plus long
  return null;
}
// Emoji detect (pour ne pas casser emoji_tornado)
function hasEmoji(str) {
  try {
    return /\p{Extended_Pictographic}/u.test(str || "");
  } catch {
    return /[\u2190-\u3299\u{1F000}-\u{1FAFF}]/u.test(str || "");
  }
}
// Zoom: convertir <img>/<span> emoji vers caractère emoji (si dispo dans alt/aria)
function extractZoomTextPreserveEmojis(domElement) {
  if (!domElement) return "";
  const clone = domElement.cloneNode(true);
  const nodes = clone.querySelectorAll("img, span, i, div");
  nodes.forEach((el) => {
    const raw =
      el.getAttribute("alt") ||
      el.getAttribute("data-emoji") ||
      el.getAttribute("aria-label") ||
      el.getAttribute("title") ||
      "";
    const val = String(raw).trim();
    if (val && hasEmoji(val)) {
      const textNode = document.createTextNode(` ${val} `);
      if (el.parentNode) el.parentNode.replaceChild(textNode, el);
    }
  });
  return (clone.innerText || clone.textContent || "").trim();
}
// Nettoyage final + validation "MDI"
function cleanAndValidate(rawText) {
  console.log(`🔍 [RAW] "${rawText}"`);
  if (!rawText) return null;
  let t = String(rawText);
  t = takeLastUsefulLine(t);
  t = normalizeSpaces(t);
  t = stripLeadingTime(t);
  t = stripLeadingNamePrefix(t);
  t = normalizeSpaces(t);
  console.log(`🧹 [CLEAN] "${t}"`);
  if (!t) return null;
  if (isBlacklisted(t)) { console.log(`❌ BLACKLISTÉ`); return null; }
  // Commande reset
  if (t.toUpperCase() === "RESET") return "RESET";
  // Quiz: si un token A/B/C/D est détecté, on n'envoie QUE la lettre
  const quiz = extractQuizToken(t);
  if (quiz) return quiz;
  // Limites pour word cloud ET commentaires
  // - Word cloud : idéalement 1-6 mots
  // - Commentaires : jusqu'à 20 mots, 200 chars
  const words = t.split(/\s+/).filter(Boolean);

  // === LOGIQUE INTELLIGENTE MULTI-OVERLAYS ===

  // Word Cloud : stricte (1-2 mots, max 15 chars/mot)
  if (words.length <= 2) {
    const allWordsShort = words.every(w => w.length <= 15);
    if (allWordsShort) {
      return t; // ✅ Parfait pour word cloud
    }
  }

  // Commentaires : flexible (4+ mots, jusqu'à 500 chars)
  if (words.length >= 4 && t.length <= 500) {
    return t; // ✅ Parfait pour commentaires
  }

  // Zone grise (3 mots) : on envoie quand même, le serveur filtrera
  if (words.length === 3 && t.length <= 100) {
    return t; // ✅ Peut servir aux deux
  }

  // Trop long ou incohérent
  return null;
}
// --- Envoi serveur ---
function envoyerVote(voteFinal) {
  if (!voteFinal) return;
  if (!socket) return;
  socket.emit("nouveau_vote", {
    room: CLIENT_ID,
    vote: voteFinal,
    user: USER_NAME
  });
  console.log(`⚡ [MDI] -> "${voteFinal}"`);
}
// --- Anti-spam dédup ---
const seenNodes = new WeakSet();
// ==================================================
// OBSERVER (PAS DE characterData => pas de frappe)
// On écoute UNIQUEMENT les nodes ajoutés (= message publié)
// ==================================================
const observateur = new MutationObserver((mutations) => {
  const host = location.hostname;
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (!node || node.nodeType !== 1) continue;
      // === GOOGLE MEET ===
      if (host.includes("google.com")) {
        const msg = node.hasAttribute?.("data-message-id")
          ? node
          : node.querySelector?.("div[data-message-id]");
        if (msg && !seenNodes.has(msg)) {
          const raw = msg.innerText || msg.textContent || "";
          const clean = cleanAndValidate(raw);
          if (clean) envoyerVote(clean);
          seenNodes.add(msg);
        }
        continue;
      }
      // === ZOOM ===
      if (host.includes("zoom.us")) {
        const cible =
          node.classList?.contains("chat-message__content")
            ? node
            : node.querySelector?.(".chat-message__content") ||
              node.querySelector?.(".new-chat-message__text-box");
        if (cible && !seenNodes.has(cible)) {
          const raw = extractZoomTextPreserveEmojis(cible);
          const clean = cleanAndValidate(raw);
          if (clean) envoyerVote(clean);
          seenNodes.add(cible);
        }
        continue;
      }
      // === TEAMS ===
      if (host.includes("teams")) {
        console.log(`[MDI-TEAMS] node: <${node.tagName}> tid="${node.getAttribute?.('data-tid')||''}" class="${String(node.className||'').substring(0,60)}"`);
        // Cherche sur le node lui-même (node.matches) ET ses descendants (node.querySelector)
        const TEAMS_SELECTORS = [
          '[data-tid="message-body"]',
          '[data-tid="chat-pane-message"]',
          '[data-tid="messageBodyContent"]',
          '[class*="ui-chat__item__message"]',
          'p[class*="text-module"]',
          'div[class*="message-body"]',
        ];
        let cible = null;
        for (const sel of TEAMS_SELECTORS) {
          if (node.matches?.(sel)) { cible = node; break; }
          const found = node.querySelector?.(sel);
          if (found) { cible = found; break; }
        }
        // Fallback universel : div[dir="auto"] = conteneur texte directionnel
        // utilisé par Teams pour tout contenu textuel utilisateur.
        if (!cible) {
          const dirAuto = node.matches?.('div[dir="auto"]') ? node
            : node.querySelector?.('div[dir="auto"]');
          if (dirAuto) {
            const txt = (dirAuto.innerText || dirAuto.textContent || "").trim();
            if (txt.length >= 2) cible = dirAuto;
          }
        }
        // Rejeter les nœuds dans la zone de saisie (compose box)
        if (cible) {
          let cur = cible;
          while (cur) {
            if (cur.getAttribute?.('role') === 'textbox' ||
                cur.getAttribute?.('data-tid') === 'ckeditor') {
              cible = null; break;
            }
            cur = cur.parentElement;
          }
        }
        if (cible && !seenNodes.has(cible)) {
          const raw = cible.innerText || cible.textContent || "";
          const clean = cleanAndValidate(raw);
          if (clean) envoyerVote(clean);
          seenNodes.add(cible);
        }
        continue;
      }
      // === WEBINARJAM ===
      if (host.includes("webinarjam")) {
        const msgWJ = node.classList?.contains("message") ? node : node.querySelector?.(".message");
        if (msgWJ && !seenNodes.has(msgWJ)) {
          const raw = msgWJ.innerText || msgWJ.textContent || "";
          const clean = cleanAndValidate(raw);
          if (clean) envoyerVote(clean);
          seenNodes.add(msgWJ);
        }
        continue;
      }
    }
  }
});
observateur.observe(document.body, { childList: true, subtree: true });
