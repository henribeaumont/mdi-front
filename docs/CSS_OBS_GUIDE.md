# Guide CSS OBS — MDI Live

> Ce guide est destiné aux animateurs qui utilisent MDI Live avec OBS Studio.
> Pas besoin d'être développeur — il suffit de copier-coller et de remplir deux cases.

---

## Les 3 règles d'or OBS

Avant tout, retenez ces trois règles. Elles s'appliquent à **tous** les overlays sans exception.

---

### Règle n°1 — On ne modifie que le bloc `:root { }`

Dans OBS, chaque source navigateur a un champ "CSS personnalisé".
Ce champ ne doit contenir **que le bloc `:root { }`** — rien d'autre.
Le reste du CSS est déjà intégré dans la page : inutile de le recopier.

✅ Ce qu'il faut coller :
```css
:root {
  --room-id:  "ABC123";
  --room-key: "maclesecrète";
}
html, body {
  background: rgba(0,0,0,0) !important;
}
```

❌ Ce qu'il ne faut pas faire :
- Coller le fichier CSS entier
- Coller des commentaires (les lignes qui commencent par `/*`)
- Laisser le champ vide (l'overlay ne se connectera pas)

---

### Règle n°2 — Les guillemets sont obligatoires

Vos identifiants doivent toujours être entre guillemets doubles `"..."`.

✅ Correct :
```css
--room-id:  "H_Perso";
--room-key: "monmotdepasse";
```

❌ Incorrect (l'overlay ne se connectera pas) :
```css
--room-id:  H_Perso;
--room-key: monmotdepasse;
```

---

### Règle n°3 — Le fond doit être transparent

La ligne `background: rgba(0,0,0,0) !important;` rend le fond de la source transparent,
ce qui permet à l'overlay de s'afficher proprement par-dessus votre scène OBS.
Ne la supprimez pas.

---

## Comment utiliser ce guide

Pour chaque overlay que vous utilisez :

1. Trouvez la section correspondante ci-dessous
2. Copiez **uniquement** le bloc `:root { }` et la ligne `background`
3. Dans OBS → clic droit sur la source → **Propriétés** → champ **CSS personnalisé**
4. Collez le bloc, remplacez `VOTRE_ROOM_ID` et `VOTRE_ROOM_KEY` par vos identifiants
5. Cliquez OK

Vos identifiants (`room_id` et `room_key`) vous ont été fournis par MDI lors de la création de votre compte.

---

---

## 1. Commentaires

Affiche les messages du chat de vos participants en direct sur votre scène OBS.

```css
:root {

  /* ── OBLIGATOIRE ── Vos identifiants MDI Live ── */
  --room-id:   "VOTRE_ROOM_ID";   /* Remplacez par votre identifiant de salle  */
  --room-key:  "VOTRE_ROOM_KEY";  /* Remplacez par votre clé secrète           */
  --auth-mode: "strict";          /* Ne pas modifier                           */

  /* ── FOND DU PANNEAU ── Couleur de l'encadré derrière les commentaires ── */
  --panel-bg-gradient-start: #1a1a2e;  /* Couleur de départ du dégradé de fond  */
  --panel-bg-gradient-end:   #16213e;  /* Couleur d'arrivée du dégradé de fond  */
  --panel-bg-angle:          135deg;   /* Angle du dégradé (0=horizontal, 90=vertical) */
  --panel-bg-opacity:        0.90;     /* Transparence : 0=invisible → 1=opaque */

  /* ── CONTOUR ── Bordure autour du panneau ── */
  --panel-border-width:  2px;     /* Épaisseur de la bordure                   */
  --panel-border-color:  #00d4ff; /* Couleur de la bordure (bleu cyan par défaut) */
  --panel-border-radius: 16px;    /* Arrondi des coins                         */

  /* ── DIMENSIONS ── Taille du panneau ── */
  --panel-padding-x: 30px;   /* Marge intérieure gauche et droite             */
  --panel-padding-y: 20px;   /* Marge intérieure haut et bas                  */
  --panel-min-width: 600px;  /* Largeur minimale du panneau                   */
  --panel-max-width: 1200px; /* Largeur maximale du panneau                   */

  /* ── AFFICHAGE ── Options d'affichage ── */
  --show-author:          "on";  /* "on" = affiche le nom de l'auteur | "off" = masque le nom */
  --panel-border-enabled: "on";  /* "on" = avec contour autour du panneau | "off" = sans      */

  /* ── NOM DE L'AUTEUR ── Le nom du participant qui a écrit le message ── */
  --author-color:       #00d4ff;     /* Couleur du nom                        */
  --author-font-size:   16px;        /* Taille du nom                         */
  --author-font-weight: 700;         /* Graisse : 400=normal, 700=gras        */
  --author-font-family: "Montserrat"; /* Police de caractères                 */

  /* ── TEXTE DU MESSAGE ── Le contenu du commentaire ── */
  --message-color:          #ffffff;      /* Couleur du texte                  */
  --message-font-size:      20px;         /* Taille du texte                   */
  --message-font-weight:    400;          /* Graisse : 400=normal, 700=gras    */
  --message-font-family:    "Montserrat"; /* Police de caractères              */
  --message-line-height:    1.4;          /* Interligne                        */
  --message-text-transform: none;         /* none=normal | uppercase=MAJUSCULES */
}

html, body {
  background: rgba(0,0,0,0) !important;
}
```

---

## 2. Confettis

Lance une pluie de confettis sur votre scène, déclenchée depuis votre panneau de contrôle
ou automatiquement quand les participants écrivent un mot comme BRAVO, GG, WOW.

```css
:root {

  /* ── OBLIGATOIRE ── Vos identifiants MDI Live ── */
  --room-id:   "VOTRE_ROOM_ID";   /* Remplacez par votre identifiant de salle  */
  --room-key:  "VOTRE_ROOM_KEY";  /* Remplacez par votre clé secrète           */
  --auth-mode: "strict";          /* Ne pas modifier                           */
}

html, body {
  background: rgba(0,0,0,0) !important;
}
```

> Les confettis n'ont pas de personnalisation visuelle ici — tout se contrôle depuis le panneau de contrôle.

---

## 3. Décompte Bonhomme

Affiche un bonhomme schématique qui lève la main. Le compteur monte chaque fois qu'un participant
écrit un mot déclencheur dans le chat (par défaut : MOI, OUI, 1).

```css
:root {

  /* ── OBLIGATOIRE ── Vos identifiants MDI Live ── */
  --room-id:   "VOTRE_ROOM_ID";   /* Remplacez par votre identifiant de salle  */
  --room-key:  "VOTRE_ROOM_KEY";  /* Remplacez par votre clé secrète           */
  --auth-mode: "strict";          /* Ne pas modifier                           */

  /* ── DISQUE DE SCORE ── Le cercle qui affiche le nombre de votes ── */
  --disk-fill:   #222222;  /* Couleur de fond du disque (noir par défaut)      */
  --disk-stroke: #FFCC00;  /* Couleur du contour du disque (jaune par défaut)  */
  --text-color:  #FFFFFF;  /* Couleur du chiffre affiché (blanc par défaut)    */

  /* ── MAIN ── La main levée du bonhomme ── */
  --hand-fill: #F9AD48;    /* Couleur de la main (orange chair par défaut)     */
}

html, body {
  background: rgba(0,0,0,0) !important;
}
```

---

## 4. Décompte Poker (jetons)

Affiche des piles de jetons de poker. Chaque message déclencheur dans le chat (par défaut : MOI, OUI, 1)
ajoute un jeton à la pile. Les participants peuvent écrire RESET dans le chat pour tout remettre à zéro.

```css
:root {

  /* ── OBLIGATOIRE ── Vos identifiants MDI Live ── */
  --room-id:   "VOTRE_ROOM_ID";   /* Remplacez par votre identifiant de salle  */
  --room-key:  "VOTRE_ROOM_KEY";  /* Remplacez par votre clé secrète           */
  --auth-mode: "strict";          /* Ne pas modifier                           */

  /* ── BADGE DE SCORE ── L'étiquette qui affiche le total de jetons ── */
  --poker-score-bg:   #FFC107;  /* Couleur de fond du badge (jaune/or par défaut) */
  --poker-score-text: #000000;  /* Couleur du chiffre dans le badge (noir)        */
}

html, body {
  background: rgba(0,0,0,0) !important;
}
```

---

## 5. Tornade d'emojis

Anime les emojis envoyés par vos participants dans un tourbillon à l'écran.
Plus les participants envoient d'emojis, plus la tornade est dense.

```css
:root {

  /* ── OBLIGATOIRE ── Vos identifiants MDI Live ── */
  --room-id:   "VOTRE_ROOM_ID";   /* Remplacez par votre identifiant de salle  */
  --room-key:  "VOTRE_ROOM_KEY";  /* Remplacez par votre clé secrète           */
  --auth-mode: "strict";          /* Ne pas modifier                           */

  /* ── FORME DE LA TORNADE ── */
  --tornado-density:    0.30;  /* Densité des emojis : 0.1=épars → 0.5=dense  */
  --tornado-width:      0.40;  /* Largeur : 0.2=étroite → 0.8=large           */
  --tornado-height:     1.00;  /* Hauteur : 0.5=mi-écran → 1.0=plein écran    */
  --tornado-rise-speed: 1.00;  /* Vitesse : 0.5=lent → 2.0=rapide             */

  /* ── EMOJIS ── */
  --emoji-opacity:       0.90;   /* Opacité : 0=invisible → 1=opaque          */
  --only-emoji-messages: "on";   /* "on" = seuls les messages contenant un emoji
                                    sont affichés | "off" = tous les messages  */

  /* ── EMOJIS DE DÉMARRAGE ── Emojis affichés au lancement, avant les votes ── */
  --seed-enabled: "on";                /* "on" ou "off"                        */
  --seed-emojis:  "✨,🔥,❤️,😂";      /* Liste séparée par des virgules       */
  --seed-mode:    "blend";             /* Ne pas modifier                      */

  /* ── AVANCÉ ── À ne modifier qu'en cas de besoin particulier ── */
  --particle-max:   220;  /* Nombre max d'emojis simultanés à l'écran         */
  --history-window: 220;  /* Taille de l'historique pour éviter les doublons  */
  --auto-reset:     "false";  /* "true" = remise à zéro automatique           */
}

html, body {
  background: rgba(0,0,0,0) !important;
}
```

---

## 6. Match Équipes

Affiche le score en direct entre deux équipes. Vous gérez les points depuis votre panneau de contrôle.

```css
:root {

  /* ── OBLIGATOIRE ── Vos identifiants MDI Live ── */
  --room-id:   "VOTRE_ROOM_ID";   /* Remplacez par votre identifiant de salle  */
  --room-key:  "VOTRE_ROOM_KEY";  /* Remplacez par votre clé secrète           */
  --auth-mode: "strict";          /* Ne pas modifier                           */

  /* ── COULEURS DES ÉQUIPES ── */
  --team-a-color: #3b82f6;  /* Couleur de l'équipe gauche (bleu par défaut)   */
  --team-b-color: #ef4444;  /* Couleur de l'équipe droite (rouge par défaut)  */

  /* ── FOND DU PANNEAU ── */
  --panel-bg-gradient-start: #1a1a2e;  /* Couleur de départ du dégradé         */
  --panel-bg-gradient-end:   #16213e;  /* Couleur d'arrivée du dégradé         */
  --panel-bg-angle:          135deg;   /* Angle du dégradé                     */
  --panel-bg-opacity:        0.90;     /* Transparence : 0=invisible → 1=opaque */

  /* ── CONTOUR ── */
  --panel-border-width:  2px;
  --panel-border-color:  #ffffff;  /* Couleur de la bordure (blanc par défaut) */
  --panel-border-radius: 16px;

  /* ── NOMS DES ÉQUIPES ── */
  --name-font-size:   24px;
  --name-font-weight: 700;
  --name-font-family: "Montserrat";

  /* ── SCORES ── */
  --score-color:       #ffffff;
  --score-font-size:   48px;        /* Taille des chiffres du score            */
  --score-font-weight: 900;
  --score-font-family: "Montserrat";
}

html, body {
  background: rgba(0,0,0,0) !important;
}
```

---

## 7. Mot Magique

Affiche un mot à l'écran qui "s'active" (change de couleur et grossit) lorsqu'assez de participants
ont écrit le mot déclencheur dans le chat. Idéal pour créer un effet de vote collectif.

```css
:root {

  /* ── OBLIGATOIRE ── Vos identifiants MDI Live ── */
  --room-id:   "VOTRE_ROOM_ID";   /* Remplacez par votre identifiant de salle  */
  --room-key:  "VOTRE_ROOM_KEY";  /* Remplacez par votre clé secrète           */
  --auth-mode: "strict";          /* Ne pas modifier                           */

  /* ── FOND DU PANNEAU ── */
  --panel-bg-color:   #0A0F1E;  /* Couleur de fond de l'encadré               */
  --panel-bg-opacity: 0.80;     /* Transparence : 0=invisible → 1=opaque      */
  --panel-radius:     22px;     /* Arrondi des coins                          */
  --panel-padding-x:  40px;     /* Marge intérieure gauche/droite             */
  --panel-padding-y:  20px;     /* Marge intérieure haut/bas                  */

  /* ── MOT EN ATTENTE ── Avant que le seuil de votes soit atteint ── */
  --start-color: #6b6b6b;  /* Couleur du mot avant activation (gris par défaut) */
  --start-size:  72px;     /* Taille du mot avant activation                    */

  /* ── MOT ACTIVÉ ── Quand le seuil de votes est dépassé ── */
  --end-color: #ffd700;  /* Couleur du mot activé (or par défaut)               */
  --end-size:  140px;    /* Taille du mot activé (plus grand pour l'effet)      */

  /* ── MOT ET DÉCLENCHEUR ── Ce que vous et vos participants configurez ── */
  --display-word: "VICTOIRE";  /* Mot affiché à l'écran (en majuscules)             */
  --trigger-chat: "GG";        /* Mot que les participants tapent dans Teams         */
  --threshold:    0.9;         /* Part de participants requis : 0.5=50% | 0.9=90%   */
  --sticky:       "false";     /* "true" = reste activé même si le ratio redescend  */

  /* ── POLICE ── */
  --font-family: "Montserrat";
}

html, body {
  background: rgba(0,0,0,0) !important;
}
```

> **Comment ça marche :** L'overlay affiche `--display-word` en gris. Quand assez de participants
> ont écrit `--trigger-chat` dans le chat Teams (selon `--threshold`), le mot s'anime en couleur.
> Envoyer `RESET` dans le chat remet le compteur à zéro.

---

## 8. Nuage de mots

Affiche un nuage de mots en temps réel à partir des réponses de vos participants.
Les mots les plus répétés apparaissent en plus grand.

```css
:root {

  /* ── OBLIGATOIRE ── Vos identifiants MDI Live ── */
  --room-id:   "VOTRE_ROOM_ID";   /* Remplacez par votre identifiant de salle  */
  --room-key:  "VOTRE_ROOM_KEY";  /* Remplacez par votre clé secrète           */
  --auth-mode: "strict";          /* Ne pas modifier                           */

  /* ── TAILLE ET POSITION ── Position du nuage sur votre écran ── */
  --cloud-width:  650px;  /* Largeur du nuage (en pixels)                     */
  --cloud-height: 850px;  /* Hauteur du nuage (en pixels)                     */
  --cloud-right:   50px;  /* Distance depuis le bord droit de l'écran         */
}

html, body {
  background: rgba(0,0,0,0) !important;
}
```

---

## 9. Quiz / Sondage

Affiche une question et ses options de réponse en direct. Les participants votent en tapant
A, B, C ou D dans le chat. Les résultats s'affichent en temps réel.

```css
:root {

  /* ── OBLIGATOIRE ── Vos identifiants MDI Live ── */
  --room-id:   "VOTRE_ROOM_ID";   /* Remplacez par votre identifiant de salle  */
  --room-key:  "VOTRE_ROOM_KEY";  /* Remplacez par votre clé secrète           */
  --auth-mode: "strict";          /* Ne pas modifier                           */

  /* ── MISE EN PAGE ── */
  --panel-gap:   18px;           /* Espace entre la question et les réponses   */
  --font-family: "Montserrat";   /* Police de caractères                       */
}

html, body {
  background: rgba(0,0,0,0) !important;
}
```

---

## 10. Roue Loto

Affiche une roue de la fortune avec les noms des participants. Vous lancez la rotation depuis
votre panneau de contrôle. La roue s'arrête sur un gagnant tiré au sort.

```css
:root {

  /* ── OBLIGATOIRE ── Vos identifiants MDI Live ── */
  --room-id:   "VOTRE_ROOM_ID";   /* Remplacez par votre identifiant de salle  */
  --room-key:  "VOTRE_ROOM_KEY";  /* Remplacez par votre clé secrète           */
  --auth-mode: "strict";          /* Ne pas modifier                           */

  /* ── TAILLE DE LA ROUE ── */
  --wheel-size:       820px;  /* Diamètre de la roue en pixels                */
  --wheel-stroke:      16px;  /* Épaisseur des lignes entre les cases          */
  --wheel-text-size:   30px;  /* Taille des noms sur la roue                  */
  --wheel-text-weight: 900;   /* Graisse du texte : 400=normal, 900=très gras */

  /* ── FLÈCHE ── La flèche qui indique le gagnant ── */
  --pointer-side:       "left";   /* Côté de la flèche : "left" ou "right"    */
  --pointer-size:        34px;
  --pointer-color:      #ffffff;  /* Couleur de la flèche (blanc par défaut)  */
  --pointer-rotate-180: "on";     /* "on" ou "off" — retourne la flèche       */
  --pointer-overlap:     1.15;    /* Chevauchement de la flèche sur la roue   */

  /* ── ROTATION ── */
  --spin-direction: "cw";  /* Sens de rotation : "cw"=horaire | "ccw"=anti-horaire */

  /* ── CONFETTIS AU TIRAGE ── */
  --winner-confetti:     "on";   /* Confettis à l'arrivée : "on" ou "off"     */
  --confetti-density:     180;   /* Quantité : 50=peu → 200=beaucoup          */
  --confetti-duration-ms: 2200;  /* Durée des confettis en millisecondes      */

  /* ── DIVERS ── */
  --label-rotate-180: "off";
  --max-participants:   48;      /* Nombre maximum de participants sur la roue */
}

html, body {
  background: rgba(0,0,0,0) !important;
}
```

---

## 11. Timer / Chrono

Affiche un compte à rebours ou un chronomètre sur votre scène. Vous contrôlez le démarrage,
la pause et la remise à zéro depuis votre panneau de contrôle.

```css
:root {

  /* ── OBLIGATOIRE ── Vos identifiants MDI Live ── */
  --room-id:   "VOTRE_ROOM_ID";   /* Remplacez par votre identifiant de salle  */
  --room-key:  "VOTRE_ROOM_KEY";  /* Remplacez par votre clé secrète           */
  --auth-mode: "strict";          /* Ne pas modifier                           */

  /* ── FOND DU PANNEAU ── */
  --panel-bg-color: #0A0F1E;  /* Couleur de fond de l'encadré                 */
  --panel-opacity:  0.78;     /* Transparence : 0=invisible → 1=opaque        */
  --panel-radius:   22px;     /* Arrondi des coins                            */
  --panel-pad-x:    28px;     /* Marge intérieure gauche/droite               */
  --panel-pad-y:    18px;     /* Marge intérieure haut/bas                    */

  /* ── TEXTE DU TEMPS ── Les chiffres affichés ── */
  --time-color:       #ffffff;       /* Couleur des chiffres (blanc par défaut) */
  --time-font-size:   72px;          /* Taille des chiffres                     */
  --time-font-family: "Montserrat";  /* Police de caractères                    */
}

html, body {
  background: rgba(0,0,0,0) !important;
}
```

---

## 12. Tug of War (Vote en direct)

Affiche une barre de progression qui se déplace en temps réel selon les votes des participants.
Chaque fois qu'un participant écrit le mot de son équipe dans le chat, la barre penche de son côté.

```css
:root {

  /* ── OBLIGATOIRE ── Vos identifiants MDI Live ── */
  --room-id:   "VOTRE_ROOM_ID";   /* Remplacez par votre identifiant de salle  */
  --room-key:  "VOTRE_ROOM_KEY";  /* Remplacez par votre clé secrète           */
  --auth-mode: "strict";          /* Ne pas modifier                           */

  /* ── NOMS DES ÉQUIPES ── Texte affiché de chaque côté ── */
  --name-left:  "OUI";   /* Nom de l'équipe gauche                            */
  --name-right: "NON";   /* Nom de l'équipe droite                            */

  /* ── TOUCHES DE VOTE ── Mot que les participants tapent dans le chat ── */
  --trigger-left:  "O";  /* Mot pour voter pour l'équipe gauche               */
  --trigger-right: "N";  /* Mot pour voter pour l'équipe droite               */

  /* ── COULEURS ── */
  --color-left:  #2ecc71;  /* Couleur de l'équipe gauche (vert par défaut)    */
  --color-right: #e74c3c;  /* Couleur de l'équipe droite (rouge par défaut)   */

  /* ── FOND DU PANNEAU ── */
  --panel-bg-color:   #0A0F1E;
  --panel-bg-opacity: 0.75;    /* Transparence : 0=invisible → 1=opaque       */
  --panel-radius:     22px;
  --panel-padding:    25px;

  /* ── TEXTE D'AIDE ── Le petit texte qui explique comment voter ── */
  --hint-color:     #ffffff;
  --hint-opacity:   0.92;
  --hint-font-size: 25px;
}

html, body {
  background: rgba(0,0,0,0) !important;
}
```

---

## Besoin d'aide ?

- Votre `room_id` et votre `room_key` se trouvent dans votre espace client MDI Live.
- Si l'overlay affiche "ACCESS DENIED" en rouge, vérifiez que vos identifiants sont corrects
  et que les guillemets sont bien présents autour de chaque valeur.
- Si l'overlay ne s'affiche pas du tout, vérifiez que la source navigateur OBS est bien **visible**
  (l'œil ne doit pas être barré dans la liste des sources).
