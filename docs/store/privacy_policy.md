# Politique de confidentialité — MDI Live Watchtower

> À publier sur : https://henri-beaumont.com/mdi-live-privacy
> Dernière mise à jour : mars 2026

---

## Qui sommes-nous ?

MDI Live Watchtower est une extension Chrome développée par Henri Beaumont dans le cadre de la plateforme MDI Live (henri-beaumont.com).

---

## Données collectées

### Identifiant de salle (Room ID)
L'extension stocke localement sur votre appareil l'identifiant de salle que vous saisissez dans le popup de l'extension (`chrome.storage.local`). Cette donnée **ne quitte jamais votre appareil** et n'est pas transmise à des tiers.

### Messages de chat
L'extension lit les messages visibles dans le chat de votre session (Zoom, Google Meet, Microsoft Teams, WebinarJam / EverWebinar) et les transmet au serveur MDI Live associé à votre salle. Les messages sont envoyés de manière **anonyme** — aucun nom d'utilisateur réel n'est transmis.

---

## Ce que nous ne collectons pas

- Aucune donnée personnelle identifiable (nom, email, adresse IP)
- Aucun historique de navigation
- Aucune donnée provenant d'autres onglets ou sites web
- Aucune donnée en dehors des 6 domaines ciblés (zoom.us, meet.google.com, teams.microsoft.com, teams.live.com, webinarjam.com, everwebinar.com)

---

## Transmission des données

Les messages de chat captés sont transmis via WebSocket sécurisé (HTTPS/WSS) au serveur MDI Live :
`https://magic-digital-impact-live.onrender.com`

Ce serveur est exclusivement utilisé pour alimenter les overlays interactifs de la session en cours. Les données ne sont pas conservées au-delà de la durée de la session.

---

## Stockage local

L'identifiant de salle (Room ID) est stocké via `chrome.storage.local` sur votre appareil uniquement. Il peut être modifié ou supprimé à tout moment depuis le popup de l'extension.

---

## Partage avec des tiers

Aucune donnée n'est vendue, partagée ou transmise à des tiers.

---

## Contact

Pour toute question : henri-beaumont.com

---

*English version available upon request.*
