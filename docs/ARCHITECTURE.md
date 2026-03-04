# ARCHITECTURE.md — MDI Live Frontend

> Structure du repo `mdi-front`. Dernière mise à jour : mars 2026.

---

## Structure du repo

```
mdi-front/
│
├── overlays/                          # Overlays OBS (déployés sur Vercel)
│   ├── nuage_de_mots/                 # Nuage de mots — V6.7 — Monofichier
│   │   └── index.html
│   ├── roue_loto/                     # Roue loto — V6.9 — Monofichier
│   │   └── index.html
│   ├── quiz/                          # Quiz/Sondage — V3.8 — Monofichier
│   │   └── index.html
│   ├── tug_of_war/                    # Tug of War — Monofichier
│   │   └── index.html
│   ├── emojis_tornado/                # Emojis Tornado — Monofichier
│   │   └── index.html
│   ├── timer_chrono/                  # Timer/Chrono — V2.1 — Triptyque
│   │   ├── index.html
│   │   ├── style.css
│   │   └── script.js
│   ├── commentaires/                  # Commentaires — V1.1 — Triptyque
│   │   ├── index.html
│   │   ├── style.css
│   │   └── script.js
│   ├── match_equipes/                 # Match Équipes — V1.1 — Triptyque
│   │   ├── index.html
│   │   ├── style.css
│   │   └── script.js
│   ├── confettis/                     # Confettis — V5.5 — Triptyque
│   │   ├── index.html
│   │   ├── style.css
│   │   └── script.js
│   ├── decompte_bonhomme/             # Décompte Bonhomme — V5.5 — Triptyque
│   │   ├── index.html
│   │   ├── style.css
│   │   └── script.js
│   ├── decompte_poker/                # Décompte Poker — V5.5 — Triptyque
│   │   ├── index.html
│   │   ├── style.css
│   │   └── script.js
│   └── mot_magique/                   # Mot Magique — V5.5 — Triptyque
│       ├── index.html
│       ├── style.css
│       └── script.js
│
├── remote/                            # Télécommande animateur — V3.6
│   └── index.html
│
├── admin/                             # Interface admin (gestion clients/questions)
│   └── index.html
│
├── chat/                              # Interface chat (affichage messages)
│   └── index.html
│
├── editor/                            # Éditeur (usage interne)
│   └── index.html
│
└── docs/                              # Documentation projet
    ├── ARCHITECTURE.md                # Ce fichier
    └── CONTEXT.md                     # Source de vérité projet (règles, état, bugs)
```

---

## Conventions de nommage

| Règle | Valeur |
|-------|--------|
| Dossiers overlays | `snake_case` minuscule |
| Fichier overlay monofichier | `index.html` |
| Fichier overlay triptyque | `index.html` + `style.css` + `script.js` |
| Variable URL serveur | `SERVER_URL` (constante en haut de chaque script) |
| Versions | Dans le commentaire d'en-tête du fichier, **jamais** dans le nom de fichier |

---

## Types d'overlay

### Monofichier (ancienne norme)
Tout le HTML, CSS et JS dans un seul `index.html`.
Overlays concernés : `nuage_de_mots`, `roue_loto`, `quiz`, `tug_of_war`, `emojis_tornado`.

> ⚠️ Migration vers triptyque = dette technique connue. Ne pas migrer sans instruction explicite.

### Triptyque (nouvelle norme)
Séparation stricte `index.html` / `style.css` / `script.js`.
Overlays concernés : `timer_chrono`, `commentaires`, `match_equipes`, `confettis`, `decompte_bonhomme`, `decompte_poker`, `mot_magique`.

---

## Déploiement

| Composant | Plateforme | URL |
|-----------|-----------|-----|
| Chaque overlay | Vercel (déploiement indépendant) | `https://[nom-overlay].vercel.app` |
| Télécommande (`remote/`) | Vercel | `https://[remote].vercel.app` |
| Serveur backend | Render | `https://magic-digital-impact-live.onrender.com` |

> Chaque overlay est un projet Vercel indépendant. Changer le nom d'un dossier impacte l'URL de déploiement.

---

## Dépendances frontend

| Dépendance | Version | Chargement |
|------------|---------|-----------|
| Socket.io client | `4.7.5` | CDN (`cdn.socket.io`) |

> ⚠️ `confettis/index.html` utilise encore `4.7.2` — à mettre à jour (bug connu, audit mars 2026).

---

## Bugs connus (audit mars 2026)

| # | Fichier(s) | Problème | Priorité |
|---|-----------|---------|---------|
| 1 | `confettis/index.html` | Socket.io `4.7.2` au lieu de `4.7.5` | Moyenne |
| 2 | `confettis/script.js`, `decompte_poker/script.js`, `mot_magique/script.js` | Variable `ADRESSE_SERVEUR` au lieu de `SERVER_URL` | Moyenne |
| 3 | Extension Chrome (repo séparé) | Teams silencieux + capture tous onglets | Haute |

---

*Pour les règles d'architecture Socket.io, l'état serveur, et les handlers complets, voir `docs/CONTEXT.md`.*
