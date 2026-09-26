# 🌿 Mon Stand — App Marché Artisanal

Application web pour gérer un stand artisanal : pointage, inventaire, caisse multi-devises, clôture et export PDF.

---

## ✅ Ce que fait l'app

- **Pointage** : arrivée/départ, calcul des heures, statut payé/non payé
- **Stock** : inventaire complet, quantités, prix CFP + prix de vente en AUD/USD/EUR/NZD/JPY (calculés automatiquement ou fixés à la main)
- **Caisse** : panier, promos 2ème unité, remise manuelle, encaissement multi-devises ou TPE carte
- **Clôture** : résumé journalier, export PDF, historique des journées passées
- **Taux de change** : récupérés automatiquement depuis Internet, modifiables manuellement
- **Hors ligne** : fonctionne sans connexion une fois chargée (données sauvegardées sur le téléphone)
- **Export complet** : toutes les données du téléphone dans un fichier JSON (Config → Export complet)

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

Le franc CFP est arrimé à l'euro : **1 € = 119,332 CFP** (fixe, non modifiable).  
Les autres devises (AUD, USD, NZD, JPY) sont calculées à partir des taux de l'euro publiés par la BCE, via [Frankfurter API](https://frankfurter.dev) (gratuit, sans clé), avec [open.er-api.com](https://open.er-api.com) en secours.  
Les taux sont récupérés automatiquement au démarrage et gardent leurs décimales (1 ¥ ≈ 0,66 CFP).  
En cas de problème de connexion, les derniers taux enregistrés sont utilisés.  
Tu peux toujours modifier manuellement via le bouton **📊 Taux** en haut de l'app.

## 💱 Prix en devise

Chaque article a un prix de vente dans chaque devise (AUD, USD, EUR, NZD, JPY) :
- **Calculé** (par défaut) : prix CFP ÷ taux du jour, arrondi au **5 le plus proche** (…20, 25, 30…) ; au-delà de **1 000** (ex. JPY), arrondi à la **centaine la plus proche**. Exemple : 2 000 CFP → 25 AUD, 20 USD, 3 000 ¥.
- **Manuel** : dans **Stock → ✏️**, saisir le montant dans la devise voulue. Il ne bouge plus avec les taux. Le bouton **Manuel ✕** remet le prix calculé.

À la caisse, le total en devise est la **somme des prix en devise** des articles (2 colliers à 25 AUD = 50 AUD). La 2ème unité en promo est arrondie de la même façon ; une remise panier (en CFP) est convertie puis le total ré-arrondi.

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
👉 Faire régulièrement **Config → Export complet (JSON)** et garder le fichier : il contient stock, ventes, heures, historique, taux et réglages (sans le PIN). C'est aussi ce fichier qui servira à passer à la v2.

---

*Développé avec ❤️ pour le marché artisanal.*
