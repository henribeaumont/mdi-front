# ARCHITECTURE.md — MDI Live Frontend

> Structure du repo `mdi-front`. Dernière mise à jour : mars 2026.

---

## Arborescence du repo

```
mdi-front/
│
├── overlays/                          # Overlays OBS — déployés sur Vercel (1 projet par overlay)
│   ├── commentaires/                  # Commentaires — V1.1 — Triptyque
│   │   ├── index.html                 #   Structure HTML
│   │   ├── style.css                  #   Styles + variables CSS personnalisables
│   │   └── script.js                  #   Logique Socket.io
│   ├── confettis/                     # Confettis — V5.5 — Triptyque
│   │   ├── index.html
│   │   ├── style.css
│   │   └── script.js
│   ├── decompte_bonhomme/             # Décompte Bonhomme — V5.5 — Triptyque
│   │   ├── index.html
│   │   ├── style.css
│   │   └── script.js
│   ├── decompte_poker/                # Décompte Poker (jetons) — V5.5 — Triptyque
│   │   ├── index.html
│   │   ├── style.css
│   │   └── script.js
│   ├── emojis_tornado/                # Tornade d'emojis — Monofichier
│   │   ├── index.html
│   │   ├── style.css
│   │   └── script.js
│   ├── match_equipes/                 # Match Équipes (score) — V1.1 — Triptyque
│   │   ├── index.html
│   │   ├── style.css
│   │   └── script.js
│   ├── mot_magique/                   # Mot Magique — V5.5 — Triptyque
│   │   ├── index.html
│   │   ├── style.css
│   │   └── script.js
│   ├── nuage_de_mots/                 # Nuage de mots — V6.7 — Monofichier
│   │   ├── index.html
│   │   ├── style.css
│   │   └── script.js
│   ├── quiz/                          # Quiz / Sondage — V3.8 — Monofichier
│   │   ├── index.html
│   │   ├── style.css
│   │   └── script.js
│   ├── roue_loto/                     # Roue Loto — V6.9 — Monofichier
│   │   ├── index.html
│   │   ├── style.css
│   │   └── script.js
│   ├── timer_chrono/                  # Timer / Chrono — V2.1 — Triptyque
│   │   ├── index.html
│   │   ├── style.css
│   │   └── script.js
│   └── tug_of_war/                    # Tug of War (vote) — Monofichier
│       ├── index.html
│       ├── style.css
│       └── script.js
│
├── obs-css/                           # Fichiers CSS prêts-à-coller dans OBS (1 par overlay)
│   ├── commentaires.css               #   CSS OBS pédagogique — Commentaires
│   ├── confettis.css                  #   CSS OBS pédagogique — Confettis
│   ├── decompte_bonhomme.css          #   CSS OBS pédagogique — Décompte Bonhomme
│   ├── decompte_poker.css             #   CSS OBS pédagogique — Décompte Poker
│   ├── emojis_tornado.css             #   CSS OBS pédagogique — Tornade d'emojis
│   ├── match_equipes.css              #   CSS OBS pédagogique — Match Équipes
│   ├── mot_magique.css                #   CSS OBS pédagogique — Mot Magique
│   ├── nuage_de_mots.css              #   CSS OBS pédagogique — Nuage de mots
│   ├── quiz.css                       #   CSS OBS pédagogique — Quiz / Sondage
│   ├── roue_loto.css                  #   CSS OBS pédagogique — Roue Loto
│   ├── timer_chrono.css               #   CSS OBS pédagogique — Timer / Chrono
│   └── tug_of_war.css                 #   CSS OBS pédagogique — Tug of War
│
├── remote/                            # Télécommande animateur — V3.6
│   └── index.html                     #   Interface de contrôle live (monofichier)
│
├── extension/                         # Extension Chrome "MDI Live Watchtower" — V2.2
│   ├── manifest.json                  #   Permissions + déclaration content scripts
│   ├── content.js                     #   Observation DOM + envoi Socket.io — V11.9
│   ├── popup.html                     #   Interface saisie room_id
│   ├── popup.js                       #   Logique popup
│   ├── socket.io.js                   #   Librairie Socket.io 4.7.5 bundlée
│   └── icon.png                       #   Icône extension 128×128
│
├── admin/                             # Interface admin (gestion clients / questions quiz)
│   └── index.html
│
├── editor/                            # Éditeur (usage interne uniquement)
│   └── index.html
│
└── docs/                              # Documentation projet
    ├── ARCHITECTURE.md                #   Ce fichier — structure, versions, déploiement
    ├── CONTEXT.md                     #   Source de vérité projet (règles, état, bugs)
    ├── CSS_OBS_GUIDE.md               #   Guide CSS OBS pour clients (référence SaaS)
    └── store/
        ├── checklist_soumission.md    #   Checklist soumission Chrome Web Store
        ├── description_en.md          #   Fiche Web Store en anglais
        ├── description_fr.md          #   Fiche Web Store en français
        └── privacy_policy.md          #   Politique de confidentialité
```

---

## Versions actuelles des composants

| Composant | Fichier | Version | Statut |
|-----------|---------|---------|--------|
| Serveur Node.js | `server.js` (repo séparé) | V5.16 | ✅ Production |
| Télécommande | `remote/index.html` | V3.6 | ✅ Production |
| Extension Chrome — manifest | `extension/manifest.json` | V2.2 | ✅ Production |
| Extension Chrome — contenu | `extension/content.js` | V11.9 | ✅ Production |
| Socket.io (bundlé + CDN) | `socket.io.js` / CDN | 4.7.5 | ✅ Production |
| Commentaires | `overlays/commentaires/` | V1.1 | ✅ Production |
| Match Équipes | `overlays/match_equipes/` | V1.1 | ✅ Production |
| Timer / Chrono | `overlays/timer_chrono/` | V2.1 | ✅ Production |
| Quiz / Sondage | `overlays/quiz/` | V3.8 | ✅ Production |
| Nuage de mots | `overlays/nuage_de_mots/` | V6.7 | ✅ Production |
| Roue Loto | `overlays/roue_loto/` | V6.9 | ✅ Production |
| Confettis | `overlays/confettis/` | V5.5 | ✅ Production |
| Décompte Bonhomme | `overlays/decompte_bonhomme/` | V5.5 | ✅ Production |
| Décompte Poker | `overlays/decompte_poker/` | V5.5 | ✅ Production |
| Mot Magique | `overlays/mot_magique/` | V5.5 | ✅ Production |
| Tug of War | `overlays/tug_of_war/` | — | ✅ Production |
| Tornade d'emojis | `overlays/emojis_tornado/` | — | ✅ Production |

> ⚠️ `confettis/index.html` utilise encore Socket.io `4.7.2` au lieu de `4.7.5` — bug connu, audit mars 2026.

---

## URLs de production

### Serveur backend

| Endpoint | URL |
|----------|-----|
| Serveur principal | `https://magic-digital-impact-live.onrender.com` |
| Health check | `https://magic-digital-impact-live.onrender.com/health` |
| Debug questions | `https://magic-digital-impact-live.onrender.com/debug/questions?room={room}` |
| API Stream Deck | `https://magic-digital-impact-live.onrender.com/api/control` |

### Overlays Vercel

Chaque overlay est un **projet Vercel indépendant**, déployé depuis son sous-dossier.

| Overlay | URL de production |
|---------|------------------|
| Commentaires | `https://commentaires.vercel.app` |
| Confettis | `https://confettis.vercel.app` |
| Décompte Bonhomme | `https://decompte-bonhomme.vercel.app` |
| Décompte Poker | `https://decompte-poker.vercel.app` |
| Tornade d'emojis | `https://emojis-tornado.vercel.app` |
| Match Équipes | `https://match-equipes.vercel.app` |
| Mot Magique | `https://mot-magique.vercel.app` |
| Nuage de mots | `https://nuage-de-mots.vercel.app` |
| Quiz / Sondage | `https://quiz.vercel.app` |
| Roue Loto | `https://roue-loto.vercel.app` |
| Timer / Chrono | `https://timer-chrono.vercel.app` |
| Tug of War | `https://tug-of-war.vercel.app` |
| Télécommande | URL Vercel dédiée (projet séparé) |

> Les URLs exactes peuvent varier selon le nom du projet Vercel. Vérifier dans le dashboard : https://vercel.com/dashboard

---

## Workflow de déploiement

### Déployer une modification sur Vercel (overlays / télécommande)

Vercel est connecté au repo GitHub via intégration automatique.

```
1. Modifier le fichier concerné dans overlays/[nom-overlay]/
2. git add overlays/[nom-overlay]/
3. git commit -m "fix: description de la modification"
4. git push origin [branche]
```

- Si la branche est `main` → **déploiement automatique en production**
- Si c'est une autre branche → Vercel crée une **URL de prévisualisation** (preview deployment)
- Le déploiement prend ~30 secondes, visible dans https://vercel.com/dashboard

> ⚠️ Chaque overlay est un projet Vercel **indépendant**. Pousser un changement dans `overlays/quiz/` ne redéploie que le projet `quiz` — les autres ne sont pas affectés.

### Déployer une modification sur Render (serveur backend)

Le serveur est dans un **repo séparé** (mdi-server ou équivalent). Render est connecté à ce repo.

```
1. Modifier server.js dans le repo backend
2. git push origin main
```

- Render détecte le push et relance automatiquement le service (~2 minutes)
- Vérifier le redémarrage : https://magic-digital-impact-live.onrender.com/health
- En cas d'erreur, consulter les logs dans le dashboard Render

> ⚠️ Render met le service en veille après 15 min d'inactivité (plan gratuit). Le premier appel prend ~10 secondes pour réveiller le serveur.

---

## Variables d'environnement Render

Ces variables sont configurées dans le dashboard Render → Service → Environment. **Ne jamais les committer en clair dans le repo.**

| Variable | Description | Exemple |
|----------|-------------|---------|
| `PORT` | Port d'écoute du serveur | `3000` |
| `ADMIN_SECRET` | Clé d'accès aux routes d'administration | `MDI_SUPER_ADMIN_2026` |
| `SUPABASE_URL` | URL du projet Supabase | `https://xxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé service Supabase (accès total, côté serveur uniquement) | `eyJxxx...` |

> ⚠️ `SUPABASE_SERVICE_ROLE_KEY` ne doit **jamais** être exposée côté client ou dans un fichier HTML/JS frontend.

---

## Types d'overlay

### Monofichier (ancienne norme)
Tout le HTML, CSS et JS dans un seul `index.html`.
Overlays concernés : `nuage_de_mots`, `roue_loto`, `quiz`, `tug_of_war`, `emojis_tornado`.

> ⚠️ Migration vers triptyque = dette technique connue. Ne pas migrer sans instruction explicite.

### Triptyque (nouvelle norme)
Séparation stricte `index.html` / `style.css` / `script.js`.
Overlays concernés : `commentaires`, `confettis`, `decompte_bonhomme`, `decompte_poker`, `match_equipes`, `mot_magique`, `timer_chrono`.

---

## Conventions de nommage

| Règle | Valeur |
|-------|--------|
| Dossiers overlays | `snake_case` minuscule |
| Fichier overlay monofichier | `index.html` seul |
| Fichier overlay triptyque | `index.html` + `style.css` + `script.js` |
| Variable URL serveur | `SERVER_URL` (constante en haut de chaque script) |
| Versions | Dans le commentaire d'en-tête du fichier, **jamais** dans le nom de fichier |

> ⚠️ `confettis/script.js`, `decompte_poker/script.js` et `mot_magique/script.js` utilisent encore `ADRESSE_SERVEUR` au lieu de `SERVER_URL` — incohérence connue à corriger.

---

## Bugs connus (audit mars 2026)

| # | Fichier(s) | Problème | Priorité |
|---|-----------|---------|---------|
| 1 | `confettis/index.html` | Socket.io `4.7.2` au lieu de `4.7.5` | Moyenne |
| 2 | `confettis/script.js`, `decompte_poker/script.js`, `mot_magique/script.js` | Variable `ADRESSE_SERVEUR` au lieu de `SERVER_URL` | Moyenne |
| 3 | `extension/content.js` | Teams silencieux — sélecteurs DOM obsolètes | Haute |
| 4 | `extension/manifest.json` (V2.1) | Capture de tous les onglets — périmètre trop large | Haute |

---

*Pour les règles d'architecture Socket.io, l'état serveur complet et les handlers, voir `docs/CONTEXT.md`.*
*Pour le guide d'utilisation du CSS OBS destiné aux clients, voir `docs/CSS_OBS_GUIDE.md`.*
