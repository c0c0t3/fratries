# Fratries Photo — app temps réel (2 utilisateurs)

## Contexte
Photographe scolaire (Fotoline). Le jour des photos de fratries, **deux personnes** (Alain et Tom) vont chercher des enfants d'une même famille dans des classes de bâtiments différents et les amènent au **studio, installé dans le bâtiment Vosges**. Il faut une mini-app web mobile, **temps réel**, pour que chacun voie en direct quelles fratries sont prises en charge, au studio, ou terminées.

Langue de l'app et du code (commentaires, libellés UI) : **français**. Utilisateurs : informels, sur téléphone, debout dans une cour d'école → gros boutons, lisible en plein soleil, une main.

## Stack imposée
- **Front : HTML / CSS / JavaScript vanilla** (ES modules). Pas de framework, pas de build lourd. Un `index.html` + `app.js` + `style.css`. (Vite acceptable si vraiment utile, sinon non.)
- **Données temps réel : Firebase Firestore** (NoSQL, SDK JS modulaire via CDN ou npm). **Pas de SQL, pas de serveur.**
- **Hébergement : Netlify** (site statique) déployé depuis **GitHub**.
- Pas de backend, pas de fonctions serverless, sauf nécessité absolue.

## Données
Le fichier `data/fratries.json` est la source de vérité (généré depuis le planning Excel validé). Ne pas le recalculer ni réordonner : **l'ordre est déjà optimisé**.

Structure :
- `meta` : année, studio (Vosges), chemin `Vosges > Foch > Maternelle > Filles`.
- `classes` : `{ "PS MS mono 1": { batiment, etage, enseignant } }` (16 classes).
- `fratries[]` (88) : `id` (ex. `T1-002`), `tournee` (1-4), `tourneeBatiment`, `ordre` (rang global dans la tournée, à respecter), `famille`, `priorite` (`avec_maternelle` | `sans_maternelle`), `classeDepart` (classe où aller en premier = « troupeau »), `arretsSuivants` (texte : où récupérer les frères/sœurs ensuite), `enfants[]` (`prenom`, `niveau`, `classe`, `lieu`, `ordre` ①②③, `remarque`), `statut`, `par`, `maj`.
- `sansFratrie[]` (7) : élèves seuls, **affichés dans un onglet à part, non planifiés** (infos à vérifier).

Total attendu : **197 élèves** (190 en fratrie + 7 seuls). Afficher un compteur de contrôle quelque part (ex. page « Contrôle »).

### Tournées (dans l'ordre)
1. **Tournée 1 — Maternelle** (~40 m du studio) : 59 familles / 131 élèves. Toutes les fratries ayant un enfant en maternelle, y compris celles qui poussent jusqu'à Filles. Structurée en **blocs par classe de départ** (`classeDepart`, PS d'abord), puis sous-groupes par `arretsSuivants`.
2. **Tournée 2 — Filles** (> 40 m) : 16 familles / 33 élèves (sans maternelle).
3. **Tournée 3 — Foch** (~20 m) : 10 familles / 20 élèves.
4. **Tournée 4 — Vosges** (studio) : 3 familles / 6 élèves.

Règles métier : **une seule personne prend toute la fratrie** (jamais coupée entre Alain et Tom) ; fratries avec maternelle prioritaires ; on va d'abord au bloc de la classe de départ (« troupeau »), puis on récupère les autres enfants en revenant vers le studio.

## Modèle Firestore
Collection `fratries`, **un document par fratrie**, `id` = `fratries[].id`.

```
fratries/{id} = {
  statut: "a_chercher" | "en_route" | "au_studio" | "photographie" | "absent",
  par: "Alain" | "Tom" | null,        // qui s'en occupe
  maj: Timestamp,                       // serverTimestamp()
  note: string                          // ex. "frère absent aujourd'hui"
}
```
Les données statiques (noms, classes, ordre) restent dans `fratries.json` côté client ; **Firestore ne stocke que l'état vivant** (statut/par/maj/note). Jointure par `id`. Cela limite les données personnelles dans le cloud et simplifie le seed.

Transitions typiques : `a_chercher` → `en_route` (par = moi) → `au_studio` → `photographie`. Autoriser retour arrière et `absent`.

**Anti-collision** : prendre une fratrie = transaction Firestore (`runTransaction`) qui vérifie `statut === "a_chercher"` ; sinon afficher « déjà pris par Tom ».

## Écrans / UX (mobile first)
1. **Choix de l'utilisateur** au premier lancement : Alain / Tom (mémorisé en `localStorage`).
2. **Liste d'une tournée** (onglets T1…T4 + « Seuls » + « Contrôle ») :
   - bandeau prioritaire « AVEC MATERNELLE » / « SANS MATERNELLE » comme dans l'Excel ;
   - bandeaux de bloc « ALLER EN CLASSE : PS MS mono 1 (RDC, Carole) — N enfants » ;
   - sous-bandeaux « puis aller chercher en … » ;
   - une **carte par fratrie** : famille en gros, enfants avec ①②③, classe + lieu (bâtiment/étage) + couleur du bâtiment (Maternelle vert, Foch bleu, Vosges rouge, Filles violet), enseignant ;
   - **un gros bouton d'action** selon l'état (« Je prends » → « Au studio » → « Photographié ») ; appui long ou menu pour « Absent » / annuler / note.
   - carte colorée selon statut et affichant « Tom » / « Alain » ; fratries terminées repliées/grisées en bas du bloc.
3. **Filtre rapide** : « Mes fratries », « Restantes », « Tout ».
4. **En-tête** : progression (ex. `34 / 88 photographiées`) + compteur d'élèves, indicateur de connexion (en ligne / hors ligne / synchronisation).
5. **Contrôle** : totaux par tournée et par statut, total élèves = 197.
Pas de login compliqué ; pas d'animations lourdes ; contraste fort ; zones tactiles ≥ 48 px ; pas de zoom involontaire (`font-size` ≥ 16 px sur les champs).

## Temps réel & hors-ligne
- `onSnapshot` sur la collection `fratries` : tout changement apparaît chez l'autre en quelques centaines de ms.
- **Persistance locale Firestore activée** (`persistentLocalCache`, `persistentMultipleTabManager`) : le wifi est mauvais dans la cour ; les écritures faites hors ligne se resynchronisent seules. Montrer l'état « en attente de synchronisation ».
- Aucune perte de données si on rafraîchit la page.

## Mise en place Firebase (projet à créer de zéro)
1. Créer un projet Firebase (console.firebase.google.com), ajouter une **Web app**, récupérer la config.
2. Activer **Firestore** (mode production, région `eur3` ou `europe-west`).
3. Activer **Authentication → Anonyme**. L'app se connecte en anonyme au chargement.
4. Règles Firestore (à adapter) : lecture/écriture **uniquement si `request.auth != null`**, et validation du schéma (statut dans la liste, `par` ∈ {Alain, Tom, null}, seuls les champs autorisés).
5. Protection supplémentaire : **code d'accès partagé** saisi au premier lancement (simple écran), stocké en `localStorage` ; l'app ne charge `fratries.json` ni ne se connecte à Firestore sans lui. Le code n'est pas dans le dépôt public (variable ou saisi à la main). Activer **App Check** si simple à faire.
6. Script de **seed** `scripts/seed.mjs` (Node + `firebase-admin` ou SDK client) qui crée les 88 documents avec `statut: "a_chercher"`. Idempotent. Un script `scripts/reset.mjs` remet tout à `a_chercher`.
7. Ne **jamais** committer de clé privée de service account. La config Web Firebase n'est pas secrète, mais les règles doivent protéger les données.

## Déploiement
- Dépôt GitHub → site Netlify (build : aucune, ou `vite build` si Vite). Fichier `netlify.toml` minimal.
- `fratries.json` : servi avec l'app. **Dépôt GitHub privé** (noms d'enfants). Si le site Netlify doit être protégé davantage : mot de passe du site Netlify ou le code d'accès ci-dessus.
- PWA légère (`manifest.webmanifest`, icône) pour l'ajouter à l'écran d'accueil ; service worker optionnel (Firestore gère déjà le cache de données).

## RGPD / données d'enfants (mineurs)
- Minimum nécessaire : prénom, famille, niveau, classe. **Rien d'autre.**
- Dépôt **privé**, pas de dépôt public avec `fratries.json`.
- Accès restreint (auth + règles + code).
- **Suppression après l'événement** : script `scripts/purge.mjs` qui supprime la collection Firestore, et retrait de `fratries.json` du site/dépôt.
- Pas d'analytics, pas de trackers, pas de police web tierce inutile.

## Qualité / tests
- Vérifier que `fratries.json` contient bien 88 fratries et 197 élèves (190 + 7) au chargement ; sinon afficher une alerte.
- Tester deux navigateurs en parallèle : prise simultanée d'une même fratrie (la transaction doit en refuser une).
- Tester le mode avion : écrire, repasser en ligne, vérifier la synchro.
- Tester sur un petit écran (≈ 360 px de large) et en mode sombre/clair.

## Hors périmètre (pour l'instant)
Pas d'import Excel dans l'app, pas de gestion multi-écoles, pas de statistiques, pas de notifications push. Le planning (ordre, tournées) est figé dans `fratries.json`.

## Points ouverts à valider avec Alain
- 3 fusions de noms non confirmées, signalées dans le planning : `DE BALLLIENCOURT` → `DE BAILLIENCOURT`, `MATHERN` → `MATTERN`, `SA` → `SA MOREL`. À afficher avec un petit badge « à vérifier » (voir `remarque` des enfants).
- 7 élèves sans fratrie à vérifier (dont DIEN WENDLING Cyriaque, dont la sœur n'est plus dans le fichier).
- Taille max d'un « troupeau » par aller-retour : non limitée pour le moment (blocs jusqu'à 12 enfants).
