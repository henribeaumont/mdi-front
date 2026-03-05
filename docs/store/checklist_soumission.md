# Checklist soumission Chrome Web Store — MDI Live Watchtower

---

## Étape 1 — Créer le compte Google Developer

- [ ] Aller sur https://chrome.google.com/webstore/devconsole
- [ ] Se connecter avec un compte Google
- [ ] Payer les **5$ uniques** d'inscription
- [ ] Accepter les conditions d'utilisation développeur

---

## Étape 2 — Préparer la politique de confidentialité

- [ ] Copier le contenu de `docs/store/privacy_policy.md`
- [ ] Publier la page sur **https://henri-beaumont.com/mdi-live-privacy**
- [ ] Vérifier que la page est accessible publiquement

---

## Étape 3 — Préparer les assets visuels

Les captures d'écran sont **obligatoires** (minimum 1, maximum 5).
Format : **1280×800 px** ou **640×400 px**, PNG ou JPEG.

- [ ] Screenshot 1 : popup de l'extension avec un Room ID saisi
- [ ] Screenshot 2 : overlay Nuage de mots actif pendant une session Zoom/Meet
- [ ] Screenshot 3 : overlay Quiz avec votes en cours
- [ ] (optionnel) Screenshot 4 : overlay Commentaires ou Timer

Icône promotionnelle (optionnel mais recommandé) :
- [ ] Tile 440×280 px (petite bannière Store)

> L'icône 128×128 est déjà prête dans `extension/icon.png` ✅

---

## Étape 4 — Packager l'extension

Dans Chrome :
1. Ouvrir `chrome://extensions`
2. Activer le **mode développeur**
3. Cliquer **"Empaqueter l'extension"**
4. Pointer vers le dossier `extension/`
5. Chrome génère un fichier `.crx` et une clé `.pem` — **conserver la clé .pem précieusement**

Ou via la Developer Console directement : uploader le dossier `extension/` en ZIP.

```bash
# Créer le ZIP depuis le terminal (Mac)
cd /chemin/vers/mdi-front
zip -r mdi-live-watchtower-v2.2.zip extension/ --exclude "*.DS_Store"
```

---

## Étape 5 — Soumettre sur la Developer Console

1. Aller sur https://chrome.google.com/webstore/devconsole
2. Cliquer **"Nouvel élément"**
3. Uploader le ZIP de l'extension
4. Remplir la fiche Store :
   - **Nom** : MDI Live Watchtower
   - **Description courte** : (copier depuis `docs/store/description_fr.md`)
   - **Description longue** : (copier depuis `docs/store/description_fr.md`)
   - **Catégorie** : Productivity
   - **Langue** : Français
   - **URL politique de confidentialité** : https://henri-beaumont.com/mdi-live-privacy
   - **URL page d'accueil** : https://henri-beaumont.com
   - **Screenshots** : uploader les captures préparées à l'étape 3
5. Dans **"Visibilité"** → choisir **"Non répertoriée"** (accès par lien direct uniquement)
6. Soumettre pour examen

---

## Étape 6 — Après validation (2 à 7 jours)

- [ ] Récupérer le lien direct d'installation Chrome Web Store
- [ ] Transmettre le lien aux clients
- [ ] Mettre à jour `CONTEXT.md` avec le lien officiel
- [ ] Supprimer les instructions "mode développeur" de la documentation client

---

## Points de vigilance pour la review Google

| Point | Statut |
|-------|--------|
| `matches` restreint aux domaines ciblés | ✅ V2.2 |
| `all_frames: true` supprimé | ✅ V2.2 |
| Pas de `<all_urls>` | ✅ V2.2 |
| `host_permissions` déclaré pour le serveur | ✅ V2.2 |
| Politique de confidentialité publique | ⬜ À publier |
| Screenshots fournis | ⬜ À préparer |
| Justification des permissions dans la fiche | ⬜ À rédiger si demandé |

---

## Mises à jour futures

Pour chaque mise à jour de l'extension :
1. Bumper `"version"` dans `manifest.json`
2. Committer sur `main`
3. Générer un nouveau ZIP
4. Uploader dans la Developer Console → **"Nouvelle version"**
5. Soumettre — re-review Google (généralement plus rapide que la première fois)
