# PassOn — Frontend

Conversion en React / TypeScript de la maquette de l'écran de résultat PassOn
(projet hackathon DINUM x 42 — assistant de passation).

Stack : Next.js 14 (App Router), TypeScript, Tailwind CSS, lucide-react.

## Démarrer

```bash
npm install
npm run dev
```

Ouvrir http://localhost:3000

## Structure

```
app/
  layout.tsx        Layout racine (police, meta)
  page.tsx           Page d'accueil (Header + Sidebar + contenu + AgentPanel)
  globals.css         Tailwind + styles globaux
components/
  Header.tsx          Barre du haut (logo, recherche, notifications, utilisateur)
  Sidebar.tsx          Navigation latérale gauche
  AgentPanel.tsx        Panneau latéral droit "Agent PassOn" (étapes, sources analysées)
  icons/
    MarianneMark.tsx     Logo tricolore
  passation/
    PassationCard.tsx      Carte principale (en-tête, complétude, onglets)
    SectionCard.tsx         Wrapper commun pour les blocs de contenu
    ResumeSection.tsx        Bloc "Résumé"
    PointsAttentionSection.tsx  Bloc "Points d'attention"
    ContactsSection.tsx       Bloc "Contacts clés"
    ActionsSection.tsx        Bloc "Actions en cours"
    EcheancesSection.tsx      Bloc "Échéances"
    DocumentsSection.tsx      Bloc "Documents associés"
lib/
  types.ts            Types TypeScript du domaine (Passation, ActionItem, ...)
  mock-data.ts          Données d'exemple (à remplacer par les appels API)
  cn.ts               Petit helper de classNames
```

## Brancher les vraies données

Toutes les données affichées viennent de `lib/mock-data.ts`, typées via
`lib/types.ts`. Pour brancher l'API du backend (DRF), il suffit de remplacer
l'import de `passation`, `agentSteps` et `sourceStats` dans `app/page.tsx`
et `components/AgentPanel.tsx` par un appel `fetch`/`useEffect` (ou un
Server Component `async` qui appelle directement l'API DRF côté serveur),
en conservant les mêmes types.

## Style

Le rendu est fait avec Tailwind CSS, pas avec Cunningham (le design system de
La Suite Numérique) : les couleurs (`brand.*` dans `tailwind.config.ts`),
espacements et rayons sont calés à la main sur la maquette pour un rendu
visuel équivalent, sans le coût d'intégration de Cunningham. Si le projet a
besoin d'un alignement pixel-perfect avec Docs/Drive plus tard, remplacer les
classes utilitaires par les composants Cunningham est possible section par
section, sans changer la structure des données.

## Connexion

Il n'y a pas de compte PassOn : on se connecte avec ses identifiants **Drive**,
que le backend Django fait vérifier par l'instance Drive locale, puis réessaie
sur Messages. Rien n'est vérifié côté navigateur et aucun mot de passe n'est
conservé ici. Le détail du parcours OIDC est dans
[`../backend/accounts/README.md`](../backend/accounts/README.md).

| Fichier | Rôle |
| --- | --- |
| `lib/auth.ts` | les trois appels (`me`, `login`, `logout`), le jeton CSRF et les messages d'erreur |
| `context/AuthContext.tsx` | la session pour toute l'application, restaurée au chargement |
| `app/login/page.tsx` | le formulaire |
| `components/RequireSession.tsx` | le garde : sans session, redirection vers `/login` |
| `lib/routes.ts` | les chemins publics, ceux que voit le navigateur |

Trois points à connaître avant d'y toucher :

- **Les chemins publics ne sont pas les routes de l'application.** nginx fait
  correspondre `/dashboard` au `/` de cette application. Toute navigation qui
  traverse cette frontière passe donc par `window.location` et les constantes de
  `lib/routes.ts`, jamais par le routeur Next, qui ne connaît que les routes
  internes.
- **`restoring` avant toute décision.** La session est restaurée par un appel
  asynchrone ; rediriger avant sa réponse renverrait vers la connexion une
  personne déjà connectée, à chaque rafraîchissement.
- **Le garde est côté client.** Il empêche d'afficher la page, mais le contenu
  des composants serveur part quand même dans la charge utile RSC. Tant que ce
  contenu vient de `mock-data.ts`, cela ne divulgue rien ; le jour où il viendra
  de l'API, la vérification devra remonter côté serveur (middleware Next ou
  composant serveur lisant le cookie).

L'application n'est joignable avec sa session que par **http://localhost:8091**,
où nginx sert la page d'accueil, relaie `/login` et `/dashboard` vers ce serveur
Next, et `/api/` vers Django — une seule origine, condition du cookie de session
et de la vérification CSRF.
