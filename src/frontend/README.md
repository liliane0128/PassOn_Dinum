# Frontend — Pass‘on

Interface de Pass‘on : **React + JavaScript**, compilée par **Vite**, avec le
design system de la Suite Numérique (`@gouvfr-lasuite/ui-components`).

**Pas de TypeScript** : tout est en `.jsx`/`.js`, sur demande explicite
(voir `PLAN.md`). Le README d'origine, généré par le template Vite, annonçait
l'inverse.

## Lancer le projet

En développement, serveur Vite avec rechargement à chaud sur
**http://localhost:5173** (données mockées, backend non nécessaire) :

```bash
npm install
npm run dev
```

Avec le reste de la pile (nginx + Django sur un seul port,
**http://localhost:8090**), depuis la racine du dépôt :

```bash
make up
```

Dans ce second mode l'appli est compilée dans l'image Docker : une modification
du front n'apparaît qu'après un nouveau `make up`. Pour travailler sur
l'interface, utilise `npm run dev`. Voir
[`src/server/README.md`](../server/README.md).

## Commandes disponibles

| Commande | Effet |
| --- | --- |
| `npm run dev` | serveur de développement (rechargement à chaud) |
| `npm run build` | compile l'appli dans `dist/` — c'est ce que sert nginx |
| `npm run preview` | sert le contenu de `dist/` pour vérifier une compilation |
| `npm run lint` | analyse le code avec [Oxlint](https://oxc.rs) |

Les règles sont dans `.oxlintrc.json`. Aux règles par défaut s'ajoutent
`no-use-before-define` (une constante lue avant sa déclaration lève une
`ReferenceError` au rendu : l'écran devient blanc, sans message),
`react/rules-of-hooks` et `no-unused-vars`. Voir la
[documentation des règles](https://oxc.rs/docs/guide/usage/linter/rules).

`oxlint` n'est pas toujours installé localement ; à défaut :

```bash
docker run --rm -v "$PWD":/work -w /work node:22-alpine npx oxlint@1.81.0 src
```

## Où lire la suite

- **`PLAN.md`** — le périmètre du produit : ce qui est fait, ce qui reste à
  faire, et les décisions prises en cours de route.
- **`DOCUMENTATION.md`** — comment le code est construit, fichier par fichier :
  les routes, les Context (authentification, résumés, thème), les données
  mockées, ce qui vient du kit et ce qui a été écrit à la main.

## À savoir sur les dépendances

`package.json` contient un champ `overrides` qui force une version unique de
`react-aria` et `react-stately`. Ce n'est pas décoratif : sans lui, les ~47
sous-paquets `@react-aria/*` du kit installent chacun leur propre copie
complète de ces librairies, et `node_modules` passe de 375 Mo à 2,9 Go. Le
détail est expliqué à la fin de `DOCUMENTATION.md`.
