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

## Le résumé, les points de blocage et les contacts clés

Le tableau de bord affiche le résumé, les points de blocage et les contacts
clés de la personne connectée, à partir de ses documents (Drive) et de ses
mails (Messages). **Le code de génération
n'a pas été modifié** : trois routes existantes suffisent.

```
GET   /api/collaborators/<id>/items/     ses documents et ses mails
GET   /api/dossier/                      une passe du modèle sur ces éléments
PATCH /api/collaborators/<id>/handover/  enregistre la fiche
```

`/api/dossier/` ne fait que générer : il ne stocke rien. La génération est donc
suivie d'un PATCH, sans quoi le résumé disparaîtrait au rechargement — le même
découpage que dans l'ancien frontend.

| Fichier | Rôle |
| --- | --- |
| `lib/handover.ts` | les appels et les messages d'erreur |
| `components/passation/PassationBoard.tsx` | charge, génère, enregistre |
| `components/passation/ResumeSection.tsx` | l'affichage et l'édition du résumé |
| `components/passation/PointsAttentionSection.tsx` | l'affichage et l'édition des points de blocage |
| `components/passation/ContactsSection.tsx` | l'affichage et l'édition des contacts |
| `lib/contacts-from-items.ts` | déduit les contacts des expéditeurs des mails |

Ce qu'il faut savoir :

- **Ce qui est branché, et ce qui ne l'est pas.** `PassationBoard` part du jeu
  de démonstration et n'y remplace que ce qui est réel : le titre (le nom de la
  personne connectée), la date de dernière mise à jour, la complétude, le
  résumé, les points de blocage, les contacts clés et le décompte des sources.
  Seuls les documents prioritaires viennent encore de `mock-data.ts`.
  Construire une passation entière donnerait l'illusion que le reste est réel.
- **Les contacts viennent des mails, pas du modèle.** Son invite ne demande pas
  de contacts : `contactsFromItems()` compte donc les expéditeurs des mails lus,
  les plus fréquents d'abord, en laissant de côté la personne connectée
  elle-même, et une génération les enregistre en même temps que le reste. Tant que rien n'est enregistré, ils sont déduits à l'affichage, si
  bien que la rubrique n'est jamais vide par accident. Les demander au modèle
  supposerait de modifier son invite, donc de toucher au code IA.
- **La rubrique `contacts` a été ajoutée au backend** (`handover_views.py`),
  à côté de `contactIds` qui sert à l'ancien frontend : les deux coexistent,
  l'une porte des identifiants de collaborateurs, l'autre des entrées
  {nom, rôle, adresse}.
- **Attention aux noms de champs des éléments** : `item_views.py` sérialise le
  type dans `type` (« mail » ou « doc »), le nom de l'expéditeur dans `subtitle`
  et son adresse dans `authorEmail` — il n'y a ni `kind` ni `author` dans cette
  charge utile, quels que soient les noms des champs du modèle.
- **L'adresse de l'expéditeur est conservée à part.** `extraction.py` construit
  `author` comme `sender.name || sender.email` : le nom l'emporte, et l'adresse
  était perdue, si bien qu'aucun contact n'était joignable. Un champ
  `author_email` a donc été ajouté à côté (et une colonne dans
  `CollaboratorItem`, migration `0003`). `author` est inchangé et
  `generation._trimmed()` n'envoie au modèle que `id/title/author/date/content`
  : son entrée est identique au caractère près.
- **Les sources ne sont pas affichées.** Chaque point généré porte pourtant les
  éléments dont il provient (`evidence`, rempli côté backend à partir des
  documents réellement lus). Ils sont conservés et transmis tels quels à
  l'enregistrement — reformuler un point garde ses sources — mais la rubrique
  n'affiche que le texte, sur demande.
- **Les modifications des points de blocage sont enregistrées** à la fermeture
  de l'éditeur, comme le résumé. La liste entière est envoyée : le PATCH
  remplace la rubrique, si bien qu'ajouter, corriger et retirer sont un seul et
  même appel.
- **La complétude se mesure sur la fiche enregistrée**, pas sur ce que la page
  affiche : la part des six rubriques revenues non vides. Une passe complète
  donne donc 100 %, même si seul le résumé est montré.
- **Un résumé vide se génère tout seul, une fois.** Arriver sur une fiche vide
  ne mérite pas un clic : la génération part d'elle-même. Elle ne doit en
  revanche jamais devenir une boucle — la chaîne lit le contenu de chaque
  document et de chaque mail avant d'appeler le modèle, et l'offre gratuite
  n'autorise qu'une génération par minute environ, si bien qu'un échec qui
  relance au rendu suivant épuiserait le quota en quelques secondes. D'où
  `autoAttempted` : une seule tentative automatique par personne et par
  chargement de page, qu'elle réussisse ou non ; ensuite, seul le bouton
  génère. Il dit « Générer le résumé » tant qu'il n'y en a pas, « Régénérer le
  résumé » ensuite.
- **Vider le résumé relance donc une génération** au chargement suivant, et
  immédiatement si la fiche n'était pas vide à l'arrivée. Pour écrire son propre
  texte, mieux vaut remplacer le contenu que le vider.
- **Les étiquettes de sources sont réelles.** `Email (n)` et `Drive (n)` sous le
  résumé comptent les éléments effectivement lus, et non plus ceux du jeu de
  démonstration.
- **Une modification à la main est enregistrée** à la fermeture de l'éditeur
  (le bouton ✓ de la rubrique), pas à chaque frappe, ce qui ferait un PATCH par
  caractère.
- **Toute la fiche générée est enregistrée**, pas seulement le texte : une
  génération coûte un créneau d'un quota limité, et les rubriques non affichées
  attendent simplement l'étape qui les branchera.
