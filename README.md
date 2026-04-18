# 🌿 Mon Stand — App Marché Artisanal

Application web pour gérer un stand artisanal : pointage, inventaire, caisse multi-devises, clôture et export PDF.

---

## ✅ Ce que fait l'app

- **Pointage** : arrivée/départ, calcul des heures, statut payé/non payé
- **Stock** : inventaire complet, quantités, prix CFP + conversions automatiques AUD/USD/EUR/NZD/JPY
- **Caisse** : panier, promos 2ème unité, remise manuelle, encaissement multi-devises ou TPE carte
- **Clôture** : résumé journalier, export PDF, historique des journées passées
- **Taux de change** : récupérés automatiquement depuis Internet, modifiables manuellement
- **Hors ligne** : fonctionne sans connexion une fois chargée (données sauvegardées sur le téléphone)

---

## 🚀 Mise en ligne (GitHub Pages, gratuit, 10 minutes)

### Étape 1 — Créer un compte GitHub
1. Aller sur [github.com](https://github.com)
2. Cliquer **Sign up**
3. Créer un compte (email + mot de passe)
4. Confirmer l'email reçu

### Étape 2 — Créer un dépôt
1. Connecté sur GitHub, cliquer le **+** en haut à droite → **New repository**
2. Nom du dépôt : `mon-stand`
3. Cocher **Public**
4. Cocher **Add a README file**
5. Cliquer **Create repository**

### Étape 3 — Mettre le fichier en ligne
1. Dans ton dépôt, cliquer **Add file** → **Upload files**
2. Glisser-déposer le fichier `index.html` (et `inventaire.json` si tu veux le garder)
3. Cliquer **Commit changes**

### Étape 4 — Activer GitHub Pages
1. Dans ton dépôt, aller dans **Settings** (en haut à droite)
2. Dans le menu gauche, cliquer **Pages**
3. Sous **Branch**, sélectionner `main` puis `/ (root)`
4. Cliquer **Save**
5. Attendre 2 minutes, puis l'URL apparaît :  
   `https://TON-PSEUDO.github.io/mon-stand/`

### Étape 5 — Ajouter l'app à l'écran d'accueil
**Sur iPhone (Safari) :**
1. Ouvrir l'URL dans Safari
2. Taper l'icône **Partager** (carré avec flèche vers le haut)
3. Taper **"Sur l'écran d'accueil"**
4. Taper **Ajouter**

**Sur Android (Chrome) :**
1. Ouvrir l'URL dans Chrome
2. Taper les **3 points** en haut à droite
3. Taper **"Ajouter à l'écran d'accueil"**
4. Taper **Ajouter**

---

## 🔄 Mettre à jour l'app

Pour mettre une nouvelle version :
1. Aller sur GitHub dans ton dépôt
2. Cliquer sur `index.html`
3. Cliquer l'icône **crayon** (Edit)
4. Coller le nouveau contenu
5. Cliquer **Commit changes**

L'URL reste la même, les données sur le téléphone ne sont pas effacées.

---

## 📊 Taux de change

L'app utilise [Frankfurter API](https://api.frankfurter.app) (gratuit, sans clé).  
Les taux sont récupérés automatiquement au démarrage.  
En cas de problème de connexion, les derniers taux enregistrés sont utilisés.  
Tu peux toujours modifier manuellement via le bouton **📊 Taux** en haut de l'app.

---

## ⚠️ À personnaliser

Dans l'app, section **Stock** :
- Vérifier les quantités initiales (issues des cahiers photos)
- Corriger les prix des articles sans prix (Bourgoir, Boîte déco)
- Ajouter les promos 2ème unité article par article (bouton ✏️ → champ Promo)

---

## 💾 Données

Toutes les données sont stockées **localement sur le téléphone** (pas de compte, pas de cloud).  
Si le navigateur est vidé, les données sont perdues.  
👉 Pour la V2 : synchronisation Google Sheets optionnelle (à activer).

---

*Développé avec ❤️ pour le marché artisanal.*
