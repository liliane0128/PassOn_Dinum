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
