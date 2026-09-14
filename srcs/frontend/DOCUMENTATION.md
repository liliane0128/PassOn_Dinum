# Documentation — comment le projet est construit

Ce document explique ce qui existe actuellement dans le projet, pourquoi, et comment les
différentes parties s'articulent. Le but : que tu puisses relire le code toi-même et
comprendre chaque décision, pas juste "que ça marche".

## Les outils utilisés, et pourquoi

| Outil | Rôle | Pourquoi celui-ci |
|---|---|---|
| **Vite** | Sert le projet en développement, et le compile pour la production (`npm run build`) | Rapide, configuration minimale, standard actuel pour un projet React |
| **React** | Librairie pour construire l'interface à base de composants | Demandé, et cohérent avec l'écosystème de `suitenumerique/docs` |
| **react-router-dom** | Gère la navigation entre les "pages" (`/`, `/utilisateur/:slug`) sans recharger la page | Permet des URLs propres et partageables |
| **@gouvfr-lasuite/ui-components** | Le design system officiel de la Suite Numérique (composants + styles) | Demandé explicitement : rester cohérent avec la charte graphique de `suitenumerique/docs` |

Pas de TypeScript (retiré sur ta demande) : tout est en `.jsx`/`.js`.

## Structure des fichiers

```
src/
  main.jsx              → point d'entrée. Monte React dans la page HTML, installe les
                           "providers" globaux (voir plus bas), importe le CSS du kit.
  App.jsx                → définit les routes (quelle page s'affiche pour quelle URL).
  index.css               → reset CSS minimal (marges à zéro, hauteur 100%).

  pages/
    HomePage.jsx / .css    → la page d'accueil (formulaire prénom/nom).
    UserPage.jsx / .css    → la page qui affiche mails + documents d'un collaborateur.

  data/
    mockData.js             → données fictives (collaborateurs, mails, documents),
                               le temps qu'il n'y ait pas de vraie API branchée.

  utils/
    user.js                 → fonctions utilitaires : transformer "Amélie Rousseau" en
                               slug d'URL "amelie-rousseau", et retrouver un collaborateur
                               à partir de ce slug.
```

## Comment ça se lance (`main.jsx`)

```jsx
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <CunninghamProvider theme="default">
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </CunninghamProvider>
  </StrictMode>,
);
```

Trois couches imbriquées, de l'extérieur vers l'intérieur :

1. **`StrictMode`** : un mode de développement de React qui aide à repérer des bugs
   (il n'a aucun effet en production, tu peux l'ignorer pour l'instant).
2. **`CunninghamProvider`** : fourni par le kit de la Suite. Il rend disponibles à tous
   les composants en dessous les couleurs, la typographie, les traductions du kit
   ("Cunningham" est le nom interne du moteur de design system de la Suite Numérique).
   Sans lui, les composants du kit (`Button`, `Input`...) ne s'afficheraient pas
   correctement.
3. **`BrowserRouter`** : active la navigation par URL. Sans lui, `react-router-dom`
   ne fonctionne pas.

Juste au-dessus, `main.jsx` importe aussi trois fichiers CSS/police qui ne sont pas du
code mais des feuilles de style : le CSS du kit (`@gouvfr-lasuite/ui-components/style`),
la police Roboto, et les icônes Material Icons — tous fournis par le kit.

## Le routing (`App.jsx`)

```jsx
<Routes>
  <Route path="/" element={<HomePage />} />
  <Route path="/utilisateur/:slug" element={<UserPage />} />
</Routes>
```

`:slug` est un **paramètre d'URL** : `/utilisateur/amelie-rousseau` fait que
`UserPage` peut lire `"amelie-rousseau"` via le hook `useParams()`.

## Page d'accueil (`HomePage.jsx`)

Un formulaire contrôlé : chaque champ (`Input` du kit) a sa valeur stockée dans le
state React (`useState`), et se met à jour à chaque frappe (`onChange`). À la
soumission (`onSubmit`), on transforme prénom+nom en slug (`slugify`, dans
`utils/user.js`) et on navigue vers `/utilisateur/<slug>` avec `useNavigate()`.

On passe aussi `state: { firstName, lastName }` à `navigate()` — c'est un moyen de
transmettre des données à la page suivante sans les mettre dans l'URL (pas utilisé
pour l'instant dans `UserPage`, mais disponible si besoin).

## Page collaborateur (`UserPage.jsx`)

C'est la page la plus dense. Détail des étapes :

1. **Récupérer le collaborateur** : `useParams()` donne le `slug` de l'URL,
   `findCollaboratorBySlug(slug)` (dans `utils/user.js`) cherche dans
   `data/mockData.js` un collaborateur dont le prénom+nom slugifié correspond.
   Si rien ne correspond → on affiche un message d'erreur et on s'arrête là
   (`return` anticipé, avant le layout complet).

2. **Construire la liste des éléments** (`useMemo`) : on filtre `emails` et
   `documents` du fichier mock pour ne garder que ceux du collaborateur trouvé, on
   les met dans une forme commune (`{ type, id, icon, title, subtitle, date, ... }`)
   pour pouvoir les afficher avec le même code, puis on trie par date décroissante.
   `useMemo` évite de refaire ce calcul à chaque rendu si rien n'a changé — un détail
   de performance, pas indispensable pour l'instant vu le peu de données, mais bonne
   pratique dès que la liste peut grossir.

3. **Deux états locaux** :
   - `filter` (`"all" | "mail" | "doc"`) : quel type est sélectionné dans le panneau
     gauche.
   - `selected` (un élément de la liste, ou `null`) : quel élément est affiché en
     détail dans le panneau droit. `null` = panneau fermé.

4. **Le layout** : on utilise `MainLayout` du kit, qui fabrique à lui seul la
   structure "en-tête + panneau gauche + centre + panneau droit". On lui passe du
   contenu à chaque emplacement :
   - `icon` → ce qui s'affiche en haut à gauche (lien retour vers l'accueil).
   - `rightHeaderContent` → ce qui s'affiche en haut à droite (avatar + nom du
     collaborateur).
   - `leftPanelContent` → les boutons de filtre.
   - `children` (entre les balises `<MainLayout>...</MainLayout>`) → le centre,
     donc la liste.
   - `rightPanelContent` + `rightPanelIsOpen` → le détail, affiché seulement quand
     `selected` n'est pas `null`.

   ⚠️ Piège rencontré en construisant cette page : les props de `MainLayout` pour
   l'en-tête s'appellent `icon` et `rightHeaderContent`, pas `leftIcon`/`rightIcon`
   comme on pourrait s'y attendre en lisant seulement le composant `Header`. Le nom
   exact des props d'un composant de bibliothèque n'est pas toujours intuitif — en
   cas de doute, il faut lire le code source du composant (ici dans
   `node_modules/@gouvfr-lasuite/ui-components/dist/components/layout/`).

5. **Le panneau droit ne se redimensionne pas nativement** dans le kit (largeur fixe
   de 300px, non modifiable via une prop). On a surchargé le CSS du kit
   (`.c__right-panel.open` dans `UserPage.css`) pour l'agrandir par défaut et ajouter
   `resize: horizontal`, une propriété CSS native qui fait apparaître une poignée de
   redimensionnement (coin bas-droit) sans JavaScript.

## Les données mockées (`data/mockData.js`)

Trois tableaux simples : `collaborators`, `emails`, `documents`. Chaque mail/document
a un champ `collaboratorId` qui le relie à un collaborateur — c'est la même logique
qu'une vraie base de données relationnelle (clé étrangère), en version très
simplifiée. Le jour où on branche une vraie API, ce fichier disparaît et les
composants qui l'utilisent (`UserPage.jsx`) iront chercher les mêmes données via des
requêtes réseau (probablement avec `fetch` ou `react-query`, comme dans le vrai
projet `docs`).

## Ce qui vient du kit vs. ce qu'on a écrit nous-mêmes

- **Composants du kit** (boîtes noires réutilisées telles quelles) : `Button`,
  `Input`, `MainLayout`, `Badge`, `UserAvatar`, `CunninghamProvider`.
- **CSS écrit à la main** (`HomePage.css`, `UserPage.css`) : il n'existe pas de
  composant "Card" ou "liste d'éléments" tout fait dans le kit pour notre cas
  d'usage précis, donc on a stylé nos propres éléments (`<button className="user-page__item">`,
  etc.) — mais en réutilisant systématiquement les **variables CSS (tokens)** du kit
  (`var(--c--globals--colors--brand-550)`, `var(--c--globals--spacings--sm)`...) plutôt
  que des couleurs ou tailles en dur. C'est ce qui garantit que notre interface reste
  visuellement cohérente avec le reste de la Suite Numérique, même là où on code
  nous-mêmes.
