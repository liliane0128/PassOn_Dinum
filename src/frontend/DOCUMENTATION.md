# Documentation — comment le projet est construit

Ce document explique ce qui existe actuellement dans le projet, pourquoi, et comment les
différentes parties s'articulent. Le but : que tu puisses relire le code toi-même et
comprendre chaque décision, pas juste "que ça marche".

## Les outils utilisés, et pourquoi

| Outil | Rôle | Pourquoi celui-ci |
|---|---|---|
| **Vite** | Sert le projet en développement, et le compile pour la production (`npm run build`) | Rapide, configuration minimale, standard actuel pour un projet React |
| **React** | Librairie pour construire l'interface à base de composants | Demandé, et cohérent avec l'écosystème de `suitenumerique/docs` |
| **react-router-dom** | Gère la navigation entre les "pages" (`/`, `/manager`, `/moi`) sans recharger la page | Permet des URLs propres |
| **@gouvfr-lasuite/ui-components** | Le design system officiel de la Suite Numérique (composants + styles) | Demandé explicitement : rester cohérent avec la charte graphique de `suitenumerique/docs` |

Pas de TypeScript (retiré sur ta demande) : tout est en `.jsx`/`.js`.

## Structure des fichiers

```
src/
  main.jsx              → point d'entrée. Monte React, installe les providers
                           globaux (voir plus bas), importe le CSS du kit.
  App.jsx                → définit les routes.
  index.css               → reset CSS minimal.

  pages/
    LoginPage.jsx / .css    → page de connexion (email + mot de passe).
    ManagerPage.jsx / .css  → espace manager : équipe + résumé éditable.
    EmployeePage.jsx / .css → espace employé : son résumé + ses documents.

  context/
    AuthContext.jsx          → qui est connecté, fonctions login()/logout().
    SummaryContext.jsx        → les résumés IA (lecture + modification), partagés
                                entre l'espace manager et l'espace employé.

  data/
    mockData.js              → données fictives : collaborateurs (avec email,
                                mot de passe, rôle de compte, manager), mails,
                                documents.
    mockSummaries.js          → résumé IA fictif par collaborateur employé (texte
                                de départ, en attendant un vrai appel IA).
```

## Comment ça se lance (`main.jsx`)

```jsx
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <CunninghamProvider theme="default">
      <BrowserRouter>
        <AuthProvider>
          <SummaryProvider>
            <App />
          </SummaryProvider>
        </AuthProvider>
      </BrowserRouter>
    </CunninghamProvider>
  </StrictMode>,
);
```

Chaque couche rend quelque chose de disponible à tout ce qui est en dessous d'elle,
via le mécanisme de **Context** de React (voir plus bas) :

1. **`StrictMode`** : mode de développement React qui aide à repérer des bugs (aucun
   effet en production).
2. **`CunninghamProvider`** : couleurs/typographie/traductions du kit de la Suite.
3. **`BrowserRouter`** : active la navigation par URL.
4. **`AuthProvider`** : rend disponible "qui est connecté" (`currentUser`) et les
   fonctions `login`/`logout` à toutes les pages.
5. **`SummaryProvider`** : rend disponibles les résumés IA (lecture et modification)
   à toutes les pages — c'est ce qui permet à l'espace manager et à l'espace employé
   de lire/modifier **le même** résumé sans se le transmettre explicitement.

## Les Context : comment "qui est connecté" circule dans l'appli

Un `Context` React, c'est une boîte de données accessible depuis n'importe quel
composant en dessous du `Provider` qui la fournit, sans avoir à la faire passer de
composant en composant ("prop drilling"). Deux fichiers dans `src/context/` :

**`AuthContext.jsx`** : contient un `useState` pour `currentUser` (le collaborateur
connecté, ou `null`), et deux fonctions :
- `login(email, password)` : cherche dans `mockData.js` un collaborateur dont l'email
  et le mot de passe correspondent. Si trouvé, il devient `currentUser` et la fonction
  le retourne (pour que `LoginPage` sache tout de suite vers quelle page rediriger,
  sans attendre un nouveau rendu).
- `logout()` : remet `currentUser` à `null`.

Le hook `useAuth()` (défini dans le même fichier) est juste un raccourci pour aller
lire ce Context depuis n'importe quel composant : `const { currentUser, logout } = useAuth();`.

**`SummaryContext.jsx`** : contient un `useState` pour `summaries` (un objet
`{ [collaboratorId]: { text, validated } }`, initialisé depuis `mockSummaries.js`),
et trois fonctions : `getSummary(id)`, `updateSummary(id, text)` (remet aussi
`validated` à `false`), `validateSummary(id)` (passe `validated` à `true`).

⚠️ Ces deux Context ne vivent qu'en mémoire côté navigateur : un rafraîchissement de
page déconnecte l'utilisateur et remet les résumés à leur valeur de départ. C'est
attendu pour un prototype sans backend (voir `PLAN.md`).

## Page de connexion (`LoginPage.jsx`)

Un formulaire contrôlé classique : `email`/`password` en state React, `Input` et
`InputPassword` du kit (ce dernier ajoute juste un bouton œil pour afficher/masquer
le mot de passe). À la soumission, `login(email, password)` est appelé ; s'il ne
trouve personne, un état `error` local affiche un message sous le champ mot de passe
(`state="error"` sur les composants du kit). S'il trouve quelqu'un, on navigue vers
`/manager` ou `/moi` selon `user.accountRole`.

Un `<details>`/`<summary>` HTML (repliable nativement, pas besoin de JS) affiche les
comptes de test — email + rôle de chacun, mot de passe commun "demo" — puisqu'il n'y
a pas de vrai backend pour l'instant.

## Espace manager (`ManagerPage.jsx`)

1. **Protection de la route** : si `currentUser` est `null` ou n'a pas
   `accountRole === "manager"`, le composant retourne `<Navigate to="/" replace />` —
   un composant fourni par `react-router-dom` qui redirige immédiatement sans qu'on
   ait besoin d'un `useEffect`.

2. **L'équipe** : `collaborators.filter((c) => c.managerId === currentUser.id)` — la
   hiérarchie tient dans ce seul champ `managerId` pour l'instant (voir `PLAN.md` pour
   la vraie table de relations à venir).

3. **Sélection** : `selectedId` (state) retient quel collaborateur de l'équipe est
   affiché ; cliquer sur un nom dans la colonne de gauche appelle `handleSelect`, qui
   change `selectedId` et recharge le brouillon (`draftText`) depuis le résumé actuel
   de la personne sélectionnée.

4. **Édition libre** : le manager tape dans un simple `<textarea>` ; le bouton
   "Enregistrer" (désactivé tant que `draftText` égale le texte déjà enregistré)
   appelle `updateSummary(selected.id, draftText)`.

5. **Mise en page en trois colonnes maison** (`display: flex` avec `flex: 1` / `flex: 2` /
   `flex: 1` sur les trois `<div>`), pas de composant `MainLayout` du kit ici — voir
   plus bas pourquoi.

## Espace employé (`EmployeePage.jsx`)

Même principe de protection de route (`accountRole === "employee"`).

- **Résumé** : `draftText` (state local) initialisé depuis
  `getSummary(currentUser.id).text`. Deux actions : "Enregistrer les modifications"
  (sauvegarde sans valider) et "Valider ce résumé" (sauvegarde **et** valide en un
  clic — utile si l'employé n'a pas encore cliqué "Enregistrer" avant de valider).
  Un `Badge` (`success`/`warning` du kit) affiche le statut `validated`.
- **Documents** : même calcul qu'avant (mails + documents du collaborateur, triés par
  date) dans un `useMemo`. Affichés en liste dans la colonne de droite ; cliquer sur
  un élément le déplie **sur place** (accordéon, `expandedKey` en state) pour montrer
  son détail, plutôt que de l'ouvrir dans une colonne séparée — plus adapté à une
  colonne étroite (1/3 de la largeur) qu'un panneau dédié.

## Pourquoi plus de `MainLayout` du kit sur ces deux pages

Les versions précédentes de ce projet utilisaient `MainLayout` (en-tête + panneaux
gauche/droit) fourni par le kit. Mais ce composant impose des largeurs de panneaux en
pixels fixes et un mécanisme d'ouverture/fermeture — alors qu'ici on veut des colonnes
**toujours visibles**, dans des proportions précises (1/4-2/4-1/4, 2/3-1/3). On a donc
construit ces deux pages avec un simple en-tête maison (`<header>`) + un conteneur
`display: flex` pour les colonnes, en utilisant toujours les **variables CSS (tokens)**
du kit pour les couleurs/espacements, mais plus le composant `MainLayout` lui-même.
Bénéfice mesuré : le JS de production est passé d'environ 695 Ko à 373 Ko, `MainLayout`
embarquant tout le système de panneaux redimensionnables (`react-resizable-panels`)
qu'on n'utilise plus du tout.

## Les données mockées

- **`data/mockData.js`** : `collaborators` (avec `email`, `password`, `accountRole`
  `"manager"` ou `"employee"`, `managerId`), `emails`, `documents` (reliés à un
  collaborateur par `collaboratorId`, comme une clé étrangère de base de données
  relationnelle, en très simplifié).
- **`data/mockSummaries.js`** : un texte de résumé + un statut `validated` par
  collaborateur **employé** (les managers n'ont pas de résumé pour eux-mêmes dans ce
  modèle). Le state réel (modifiable pendant que l'appli tourne) vit dans
  `SummaryContext`, initialisé depuis ce fichier au démarrage.

Le jour où un vrai backend arrive : `mockData.js` et `mockSummaries.js` disparaissent,
`AuthContext` fait un vrai appel d'authentification au lieu de comparer une liste en
dur, et `SummaryContext` lit/écrit sur une API au lieu d'un simple `useState`.

## Ce qui vient du kit vs. ce qu'on a écrit nous-mêmes

- **Composants du kit** : `Button`, `Input`, `InputPassword`, `Badge`,
  `CunninghamProvider`.
- **CSS écrit à la main** (un fichier par page) : il n'existe pas de composant "espace
  à trois colonnes" ou "résumé éditable" tout fait dans le kit, donc on a stylé nos
  propres éléments — mais en réutilisant systématiquement les **variables CSS
  (tokens)** du kit (`var(--c--globals--colors--brand-550)`,
  `var(--c--globals--spacings--sm)`...) plutôt que des couleurs ou tailles en dur.
  C'est ce qui garantit que l'interface reste visuellement cohérente avec le reste de
  la Suite Numérique, même là où on code nous-mêmes.

## Comment l'appli est servie (ajout du 2026-09-15)

Deux façons de lancer le front, selon ce que tu fais :

- **En développement** : `npm run dev` comme avant, serveur Vite sur
  http://localhost:5173, rechargement à chaud. C'est ce qu'il faut utiliser pour
  travailler sur l'interface.
- **Avec tout le reste** : `make up` à la racine du dépôt. Un serveur **nginx**
  compile l'appli (`npm run build`) et sert le résultat sur
  http://localhost:8090, en renvoyant au passage tout ce qui commence par
  `/api/` vers le Django du projet.

L'intérêt du second mode : le front et l'API sont sur **la même origine**. Le
jour où `mockData.js` sera remplacé par de vrais appels réseau, il suffira
d'écrire `fetch("/api/...")` — pas d'URL de backend à configurer, pas de CORS à
gérer, et les cookies de session fonctionnent naturellement. C'est aussi ce qui
fait qu'un rafraîchissement sur `/manager` ou `/moi` ne renvoie pas une erreur
404 : nginx est configuré pour retourner `index.html` sur toute URL qui ne
correspond pas à un fichier, et laisser React Router décider de la suite.

Attention : dans ce mode l'appli est **compilée dans l'image Docker**, donc une
modification du front n'apparaît qu'après un nouveau `make up`. Les détails de
configuration sont dans [`src/server/README.md`](../server/README.md).

## Le nettoyage disque du 2026-09-15

En construisant cette version, `node_modules` a été trouvé à 2,9 Go — beaucoup trop
pour ce projet. La cause : `@gouvfr-lasuite/ui-components` dépend d'une quarantaine de
sous-paquets `@react-aria/*`, dont chacun redéclare en dépendance la librairie complète
`react-aria` (et `react-stately`) dans une version légèrement différente de celle
utilisée à la racine du projet. npm ne pouvant pas fusionner des versions
incompatibles, il installait une copie complète (~49 Mo) **dans chacun** des ~47
sous-paquets. Le champ [`overrides`](https://docs.npmjs.com/cli/v10/configuring-npm/package-json#overrides)
dans `package.json` force maintenant une version unique de `react-aria`/`react-stately`
pour tout le projet — sûr ici car on n'utilise aucun composant du kit qui dépend de
cette zone (calendrier, sélecteur de date...). Résultat : 2,9 Go → 375 Mo.
