# Guide Stream Deck — MDI Live

> Ce guide explique comment piloter vos overlays MDI Live depuis un Stream Deck
> en utilisant le plugin **Web Request** (ou tout plugin capable d'envoyer une requête HTTP POST).

---

## Prérequis

- Un Stream Deck (matériel ou logiciel)
- Le plugin **Web Request** installé dans le logiciel Stream Deck
- Vos identifiants MDI Live : `room_id` et `room_key`

---

## Configuration générale d'un bouton

Chaque bouton utilise les mêmes paramètres de base :

| Champ | Valeur |
|-------|--------|
| **URL** | `https://magic-digital-impact-live.onrender.com/api/control` |
| **Méthode** | `POST` |
| **Header 1** | `x-room-id` → votre identifiant de room (ex: `H_Perso`) |
| **Header 2** | `x-room-key` → votre clé secrète |
| **Header 3** | `Content-Type` → `application/json` |
| **Body** | JSON spécifique à chaque action (voir ci-dessous) |

> ⚠️ Le serveur est hébergé sur Render (plan gratuit). Si personne ne l'a utilisé
> depuis 15 minutes, la première requête peut prendre 20–30 secondes à répondre.
> Appuyez une fois, attendez avant de réappuyer.

---

## Actions disponibles par overlay

### Timer / Chrono

| Bouton | Body JSON |
|--------|-----------|
| Afficher l'overlay | `{"action": "timer_on"}` |
| Masquer l'overlay | `{"action": "timer_off"}` |
| Lancer | `{"action": "timer_start"}` |
| Pause / Reprendre | `{"action": "timer_toggle_pause"}` |
| Remettre à zéro | `{"action": "timer_reset"}` |
| Régler sur 5 min | `{"action": "timer_preset", "payload": {"seconds": 300}}` |
| Régler sur 10 min | `{"action": "timer_preset", "payload": {"seconds": 600}}` |
| Régler sur 15 min | `{"action": "timer_preset", "payload": {"seconds": 900}}` |
| + 10 min | `{"action": "timer_add_10min"}` |
| − 10 min | `{"action": "timer_sub_10min"}` |
| + 1 min | `{"action": "timer_add_1min"}` |
| − 1 min | `{"action": "timer_sub_1min"}` |
| + 10 sec | `{"action": "timer_add_10sec"}` |
| − 10 sec | `{"action": "timer_sub_10sec"}` |
| + 1 sec | `{"action": "timer_add_1sec"}` |
| − 1 sec | `{"action": "timer_sub_1sec"}` |
| Mode compte à rebours | `{"action": "timer_mode_timer"}` |
| Mode chronomètre | `{"action": "timer_mode_chrono"}` |

---

### Commentaires

| Bouton | Body JSON |
|--------|-----------|
| Activer l'overlay | `{"action": "commentaires_on"}` |
| Désactiver l'overlay | `{"action": "commentaires_off"}` |
| Masquer le commentaire affiché | `{"action": "comment_hide"}` |

> Note : afficher un commentaire spécifique (`comment_show`) nécessite un `messageId`
> généré dynamiquement — ce bouton est géré depuis la télécommande web, pas le Stream Deck.

---

### Match Équipes

| Bouton | Body JSON |
|--------|-----------|
| Activer l'overlay | `{"action": "match_on"}` |
| Désactiver l'overlay | `{"action": "match_off"}` |
| Équipe A + 1 | `{"action": "match_team_a_increment"}` |
| Équipe A − 1 | `{"action": "match_team_a_decrement"}` |
| Équipe B + 1 | `{"action": "match_team_b_increment"}` |
| Équipe B − 1 | `{"action": "match_team_b_decrement"}` |
| Remettre à zéro | `{"action": "match_reset"}` |

---

### Nuage de mots

| Bouton | Body JSON |
|--------|-----------|
| Activer l'overlay | `{"action": "nuage_on"}` |
| Désactiver l'overlay | `{"action": "nuage_off"}` |

> La gestion des mots (incrément, suppression, effacement) se fait depuis la télécommande web.

---

### Roue Loto

| Bouton | Body JSON |
|--------|-----------|
| Activer l'overlay | `{"action": "roue_on"}` |
| Désactiver l'overlay | `{"action": "roue_off"}` |
| Ouvrir les inscriptions | `{"action": "roue_start_collect"}` |
| Fermer les inscriptions | `{"action": "roue_stop_collect"}` |
| Lancer la roue | `{"action": "roue_spin"}` |
| Remettre à zéro | `{"action": "roue_reset"}` |
| Mode consécutif ON | `{"action": "roue_consecutif_on"}` |
| Mode consécutif OFF | `{"action": "roue_consecutif_off"}` |

---

### Quiz / Sondage

| Bouton | Body JSON |
|--------|-----------|
| Charger une question | `{"action": "quiz_load", "payload": {"question_key": "CLE_DE_VOTRE_QUESTION"}}` |
| Afficher les options | `{"action": "quiz_show_options"}` |
| Afficher les résultats | `{"action": "quiz_show_results"}` |
| Révéler la bonne réponse | `{"action": "quiz_reveal"}` |
| Remettre à zéro | `{"action": "quiz_reset"}` |

> La `question_key` se trouve dans votre éditeur de questions MDI Live.

---

### Confettis

| Bouton | Body JSON |
|--------|-----------|
| Activer l'overlay | `{"action": "confettis_on"}` |
| Désactiver l'overlay | `{"action": "confettis_off"}` |
| Explosion de confettis | `{"action": "confettis_explosion"}` |

---

### Mot Magique

| Bouton | Body JSON |
|--------|-----------|
| Activer l'overlay | `{"action": "mot_magique_on"}` |
| Désactiver l'overlay | `{"action": "mot_magique_off"}` |

> La logique de vote (mot affiché, trigger, seuil) se configure via les CSS OBS.

---

### Tug of War

| Bouton | Body JSON |
|--------|-----------|
| Activer l'overlay | `{"action": "tug_of_war_on"}` |
| Désactiver l'overlay | `{"action": "tug_of_war_off"}` |

---

### Décompte Bonhomme

| Bouton | Body JSON |
|--------|-----------|
| Activer l'overlay | `{"action": "decompte_bonhomme_on"}` |
| Désactiver l'overlay | `{"action": "decompte_bonhomme_off"}` |

---

### Décompte Poker

| Bouton | Body JSON |
|--------|-----------|
| Activer l'overlay | `{"action": "decompte_poker_on"}` |
| Désactiver l'overlay | `{"action": "decompte_poker_off"}` |

---

### Tornade d'emojis

| Bouton | Body JSON |
|--------|-----------|
| Activer l'overlay | `{"action": "emojis_tornado_on"}` |
| Désactiver l'overlay | `{"action": "emojis_tornado_off"}` |

---

## Exemple de profil Stream Deck recommandé

Organisation suggérée pour une session type :

```
┌─────────────┬─────────────┬─────────────┬─────────────┐
│  TIMER      │  TIMER      │  TIMER      │  CONFETTIS  │
│  Lancer     │  Pause      │  Reset      │  Explosion  │
├─────────────┼─────────────┼─────────────┼─────────────┤
│  TIMER      │  TIMER      │  MATCH      │  MATCH      │
│  + 1 min    │  − 1 min    │  Équipe A+  │  Équipe B+  │
├─────────────┼─────────────┼─────────────┼─────────────┤
│  NUAGE      │  NUAGE      │  ROUE       │  ROUE       │
│  ON         │  OFF        │  ON         │  Lancer     │
├─────────────┼─────────────┼─────────────┼─────────────┤
│  QUIZ       │  QUIZ       │  QUIZ       │  QUIZ       │
│  Options    │  Résultats  │  Révéler    │  Reset      │
└─────────────┴─────────────┴─────────────┴─────────────┘
```

---

## Dépannage

| Symptôme | Cause probable | Solution |
|----------|----------------|----------|
| Pas de réponse (30s) | Serveur en veille (Render gratuit) | Attendre, puis réessayer |
| Overlay ne réagit pas | Overlay non connecté à OBS | Vérifier la source OBS est visible |
| Erreur 401 / forbidden | Mauvais `room_id` ou `room_key` | Vérifier les headers du bouton |
| Erreur 404 | Action incorrecte | Vérifier l'orthographe exacte de l'action |
