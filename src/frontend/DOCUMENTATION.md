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

  api/
    auth.js                  → connexion, déconnexion, session en cours.
    items.js                  → mails et documents d'un collaborateur.
    handover.js               → passation : lecture, écriture, validation, envoi.
    collaborators.js          → recherche, ajout et retrait d'un membre d'équipe.
    dossier.js                → génération du résumé par l'IA.

  context/
    AuthContext.jsx          → qui est connecté (rôle et équipe compris),
                                login()/logout().
    SummaryContext.jsx        → les passations, en cache au-dessus de l'API.
    ItemsContext.jsx          → les mails et documents, idem.

  data/
    mockData.js              → ce qu'il reste de fictif : la liste de
                                collaborateurs qui alimente le sélecteur
                                « contacts clés » du résumé.
```

## Comment ça se lance (`main.jsx`)

```jsx
createRoot(document.getElementById("root")).render(
  <ThemeProvider>              {/* thème clair/sombre + CunninghamProvider */}
    <BrowserRouter>
      <CollaboratorsProvider>  {/* liste mockée, pour le sélecteur de contacts */}
        <AuthProvider>         {/* qui est connecté, son rôle, son équipe */}
          <ItemsProvider>      {/* mails et documents */}
            <SummaryProvider>  {/* passations */}
              <App />
            </SummaryProvider>
          </ItemsProvider>
        </AuthProvider>
      </CollaboratorsProvider>
    </BrowserRouter>
  </ThemeProvider>,
);
```

L'ordre compte : `ItemsProvider` et `SummaryProvider` lisent `useAuth()` pour
savoir de qui charger les données et pour vider leur cache au changement
d'utilisateur, ils doivent donc être **sous** `AuthProvider`.

Chaque couche rend quelque chose de disponible à tout ce qui est en dessous d'elle,
via le mécanisme de **Context** de React (voir plus bas) :

1. **`StrictMode`** : mode de développement React qui aide à repérer des bugs (aucun
   effet en production).
2. **`CunninghamProvider`** : couleurs/typographie/traductions du kit de la Suite.
3. **`BrowserRouter`** : active la navigation par URL.
4. **`AuthProvider`** : "qui est connecté" (`currentUser`, son rôle, son équipe)
   et les fonctions `login`/`logout`.
5. **`ItemsProvider`** : les mails et documents d'un collaborateur.
6. **`SummaryProvider`** : les passations — c'est ce qui permet à l'espace manager
   et à l'espace employé de lire et modifier **la même**, puisque les deux Context
   lisent la même API.

## Les Context : comment "qui est connecté" circule dans l'appli

Un `Context` React, c'est une boîte de données accessible depuis n'importe quel
composant en dessous du `Provider` qui la fournit, sans avoir à la faire passer de
composant en composant ("prop drilling"). Deux fichiers dans `src/context/` :

**`AuthContext.jsx`** : contient un `useState` pour `currentUser` (le collaborateur
connecté, ou `null`), et deux fonctions **asynchrones** (elles parlent au backend,
voir « La connexion réelle » plus bas) :
- `login(email, password)` : envoie les identifiants à `POST /api/auth/login/`, qui
  les fait vérifier par Drive. Renvoie `{ user }` en cas de succès, `{ error: "<code>" }`
  sinon — `LoginPage` traduit le code en message et sait tout de suite vers quelle page
  rediriger.
- `logout()` : ferme la session côté serveur (`POST /api/auth/logout/`) puis remet
  `currentUser` à `null`.

Le hook `useAuth()` (défini dans le même fichier) est juste un raccourci pour aller
lire ce Context depuis n'importe quel composant : `const { currentUser, logout } = useAuth();`.

**`SummaryContext.jsx`** : un cache au-dessus de l'API des passations
(`api/handover.js`). `getSummary(id)` renvoie ce qui est en cache et déclenche
la lecture si besoin ; `updateSummary(id, patch)` enregistre (toute
modification repasse la passation en non validée, côté serveur comme ici) et
`validateSummary(id)` valide. Un échec d'enregistrement est signalé et la
version réellement enregistrée est relue — une modification perdue en silence
serait pire qu'un message d'erreur.

Chaque élément de liste reçoit un `id` à l'entrée du cache, y compris si le
serveur n'en fournit pas : c'est par lui qu'une puce est retrouvée pour être
modifiée ou supprimée.

Les deux Context survivent au rafraîchissement, parce que ni l'un ni l'autre ne
détient la vérité : la connexion repose sur un cookie de session posé par le
backend, que `AuthProvider` retrouve au démarrage, et les passations sont
enregistrées en base. Leur contenu est vidé au changement d'utilisateur — ce
qu'une session a lu ne doit pas rester en mémoire pour la suivante.

## La connexion réelle

Il n'y a **pas de compte propre à Pass'on** : on se connecte avec ses identifiants
**Drive**, et c'est l'instance Drive locale qui dit si le couple email/mot de passe est
bon. Le mot de passe n'est jamais comparé dans le navigateur, et n'est stocké nulle
part de notre côté.

```
LoginPage ──► AuthContext.login() ──► api/auth.js ──► POST /api/auth/login/
                                                          │  (Django)
                                                          ▼
                                                    Drive + Keycloak
```

- **`src/api/auth.js`** : les trois appels réseau (`me`, `login`, `logout`). Chaque
  requête part avec `credentials: "same-origin"` pour emporter le cookie de session, et
  les POST ajoutent l'en-tête `X-CSRFToken` lu dans le cookie `csrftoken` — le
  mécanisme standard de Django. C'est `GET /api/auth/me/` qui pose ce cookie, donc il
  est appelé au démarrage de l'appli.
- **`AuthContext`** expose en plus `restoring` : au chargement de la page, on ne sait
  pas encore qui est connecté tant que `GET /api/auth/me/` n'a pas répondu. `App.jsx`
  n'affiche aucune route pendant ce temps, sinon une page protégée renverrait vers
  l'écran de connexion à chaque rafraîchissement.
- **`toAppUser()`** (dans `AuthContext.jsx`) ne fait plus que mettre en forme ce
  que le backend renvoie : rôle, poste, équipe et manager viennent de la base
  (`passon.Collaborator`), plus des données mockées. `AuthContext` expose aussi
  `team`, l'équipe du manager connecté, et `sessionExpired()`, appelé dès qu'un
  appel répond 401 pour renvoyer proprement vers l'écran de connexion.

Détails backend (routes, codes d'erreur, poignée de main CSRF) :
[`src/backend/accounts/README.md`](../backend/accounts/README.md).

## D'où viennent les mails et les documents affichés

Tout passe par `GET /api/collaborators/<id>/items/` (`src/api/items.js`), pour
soi comme pour son équipe, mais la provenance n'est pas la même :

- **L'utilisateur connecté** : ses fichiers Drive et ses mails Messages, lus en
  direct. Le backend n'interroge que les services pour lesquels la session
  contient des identifiants, donc quelqu'un connecté à Drive mais absent du
  Keycloak de Messages reçoit ses fichiers sans ses mails.
- **Un membre de son équipe** (vue manager) : la photo prise lors de la dernière
  connexion de l'intéressé. Drive ne répond que pour la session qu'on lui
  présente, et on n'a que celle de la personne connectée. La réponse indique
  quand la photo a été prise, et l'interface l'affiche : des documents vieux de
  trois semaines ne doivent pas passer pour ceux d'aujourd'hui.

`src/context/ItemsContext.jsx` tient cet arbitrage dans une seule fonction,
`getItems(collaboratorId)` : les composants (`CollaboratorItemsList`,
`EmployeePage`, la section « documents importants » de `SummaryDetails`)
l'appellent sans savoir d'où viennent les données. Rien n'est mocké ici : tant
que la requête n'a pas abouti la liste affiche « chargement », et ce qui n'a
jamais été synchronisé le dit, plutôt que d'afficher des éléments fictifs.

Les éléments réels portent un champ `refId` — l'identifiant tel que le backend
le connaît (`"drive:<uuid>"`), celui qu'utilise le résumé généré par l'IA dans
ses « documents importants ». C'est ce qui permet de comparer un document
choisi à la main et un document proposé par l'IA sans se tromper.

## Page de connexion (`LoginPage.jsx`)

Un formulaire contrôlé classique : `email`/`password` en state React, `Input` et
`InputPassword` du kit (ce dernier ajoute juste un bouton œil pour afficher/masquer
le mot de passe). À la soumission, `login(email, password)` est **attendu** (`await`) ;
le bouton affiche « Connexion... » et les champs sont désactivés pendant l'appel.

En cas d'échec, le code renvoyé par le backend est traduit en message sous le champ
mot de passe : identifiants refusés, Drive injoignable, Drive trop lent, serveur
inaccessible. Distinguer ces cas évite de chercher une faute de frappe quand c'est le
service qui est éteint. En cas de succès, on navigue vers `/manager` ou `/moi` selon
`user.accountRole`.

Le `<details>`/`<summary>` sous le formulaire rappelle qu'il faut ses identifiants
Drive, et donne les comptes de démonstration de Drive.

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

Il n'en reste qu'un usage : **`data/mockData.js`** alimente le sélecteur
« contacts clés » du résumé (`SummaryDetails.jsx`), qui propose encore une liste
de collaborateurs fictifs. Tout le reste vient du backend — identité et rôle à
la connexion, équipe, passations, mails et documents.

`mockSummaries.js` et `utils/collaboratorItems.js` ont été supprimés le jour où
les passations et les éléments sont passés en base : plus personne ne les
importait.

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
