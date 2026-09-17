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

- **Les chemins publics et les routes de l'application sont les mêmes chaînes.**
  Le tableau de bord vit dans `app/dashboard/`, et nginx relaie `/dashboard`
  sans rien retirer. Ce n'était pas le cas au départ — le préfixe était retiré
  et le tableau de bord était le `/` de l'application — ce qui donnait deux sens
  à une même URL : un `<Link href="/">` dans l'interface menait à la page
  d'accueil statique au lieu du tableau de bord. Les chemins publics sont
  rassemblés dans `lib/routes.ts` ; `window.location` reste utilisé pour les
  redirections après connexion, qui doivent recharger la page.
- **`restoring` avant toute décision.** La session est restaurée par un appel
  asynchrone ; rediriger avant sa réponse renverrait vers la connexion une
  personne déjà connectée, à chaque rafraîchissement.
- **Le garde est côté client.** Il empêche d'afficher la page, mais le contenu
  des composants serveur part quand même dans la charge utile RSC. Tant que ce
  contenu vient de `mock-data.ts`, cela ne divulgue rien ; le jour où il viendra
  de l'API, la vérification devra remonter côté serveur (middleware Next ou
  composant serveur lisant le cookie).

L'application n'est joignable avec sa session que par **http://localhost:8090**,
où nginx sert la page d'accueil, relaie les routes de l'application vers son
conteneur (`passon_frontend:3001`) et `/api/` vers Django — une seule origine,
condition du cookie de session et de la vérification CSRF. Lancé seul par
`npm run dev`, le serveur Next répond sur :3001, mais sans `/api/` derrière lui :
la connexion y échoue avec « Serveur injoignable ».

## Les quatre rubriques de la carte

Le tableau de bord affiche le résumé, les points de blocage, les contacts clés
et les documents prioritaires de la personne connectée, à partir de ses
documents (Drive) et, si le déploiement lit le mail, de ses mails (Messages).
**Le code de génération n'a pas été modifié** : trois routes existantes
suffisent.

Le mail peut être retiré côté serveur (`DINUM_ENABLED_SERVICES`, voir
[connectors](../backend/connectors/README.md)). L'interface n'a rien à changer
pour cela : elle affiche les éléments qu'on lui donne, et sans mail il ne
reste que des documents — les contacts viennent alors des seuls propriétaires
de documents, et la rubrique dit « 2 dossiers » là où elle disait
« 3 échanges ».

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
| `lib/contacts-from-items.ts` | déduit les contacts des expéditeurs des mails et des propriétaires des documents |
| `lib/documents-priority.ts` | classe les documents par urgence |
| `components/passation/PriorityDocsSection.tsx` | l'affichage des documents prioritaires |

Ce qu'il faut savoir :

- **Ce qui est branché.** `PassationBoard` part encore du jeu de démonstration,
  mais y remplace désormais tout ce que la carte montre : titre, date de
  dernière mise à jour, complétude, résumé, points de blocage, contacts clés,
  documents prioritaires et décompte des sources. Ce qui subsiste du jeu de
  démonstration n'est plus affiché ; il reste le point de départ de l'objet, et
  la liste d'équipe de `PriorityDocsSection` (le menu « transférer la
  propriété », toujours simulé).
- **La rubrique des documents n'a pas été retouchée.** `PriorityDocsSection`
  est restée telle quelle : seules les données qu'elle reçoit ont changé. Le
  classement se fait donc en amont, dans `lib/documents-priority.ts`, et se lit
  dans l'ordre des lignes.
- **Le classement des documents : l'échéance d'abord, le contexte ensuite.**
  Un document cité par une seule puce peut primer sur un document cité trois
  fois — ce qui rend un document urgent, c'est d'avoir une date. Une date n'est
  retenue que si la fiche la confirme : soit une échéance cite le document, soit
  la date d'une échéance est écrite dans le texte du document. Une date trouvée
  dans un document sans échéance correspondante est ignorée : une date de
  réunion et une date limite se ressemblent trop. À égalité d'urgence, le
  contexte départage (blocage, puis action, puis décision, puis récence), et
  chaque ligne affiche la raison de son rang.
- **Citée ou seulement mentionnée.** Le classement distingue les deux :
  `priorityLabel` vaut « Échéance 31 oct. » quand une échéance cite le document,
  et « Mentionne l'échéance du 31 oct. » quand la date est seulement présente
  dans son texte. La nuance compte — une même date peut apparaître dans
  plusieurs documents, comme « 30 septembre » ici — mais elle n'est pas affichée
  aujourd'hui : la rubrique montre le nom, la date et le propriétaire, comme
  avant.
- **Les contacts viennent des éléments lus, pas du modèle.** Son invite ne
  demande pas de contacts : `contactsFromItems()` compte donc les expéditeurs
  des mails **et les propriétaires des documents**, les plus fréquents d'abord,
  et une génération les enregistre en même temps que le reste. Tant que rien
  n'est enregistré, ils sont déduits à l'affichage, si bien que la rubrique
  n'est jamais vide par accident. Les demander au modèle supposerait de
  modifier son invite, donc de toucher au code IA.
- **Les documents comptent autant que les mails.** Un collègue qui a partagé un
  dossier est quelqu'un que le successeur devra appeler, et comme le mail est
  appelé à disparaître du produit, cette propriété devient la seule trace de
  qui travaille sur quoi. Le libellé dit ce qui a été compté — « 3 échanges »,
  « 2 dossiers », ou les deux séparés par un point médian — plutôt que de faire
  passer un document pour un échange.
- **Le propriétaire d'un document est joignable.** Drive ne publie que le nom
  de son créateur ; le backend résout l'adresse via sa recherche
  d'utilisateurs, une fois par listing, et la renvoie dans `authorEmail`
  (voir [connectors](../backend/connectors/README.md)). Un contact déduit d'un
  document a donc une adresse, comme un contact déduit d'un mail. La recherche
  couvre le domaine de la personne connectée et ceux des collaborateurs déjà
  connus de l'application — un propriétaire hors de tous ces domaines reste
  sans adresse, et c'est le nom qui sert alors.
- **La personne connectée n'apparaît jamais dans ses propres contacts.**
  L'exclusion se fait sur l'adresse *et* sur le nom. L'adresse suffit dès que
  le backend a pu la résoudre ; le nom (`full_name`, pris dans la session)
  reste le filet pour les propriétaires qu'il n'a pas pu résoudre, sans quoi
  chacun figurerait parmi ses propres contacts dès qu'il possède un document.
- **La rubrique `contacts` a été ajoutée au backend** (`handover_views.py`),
  à côté de `contactIds` qui sert à l'ancien frontend : les deux coexistent,
  l'une porte des identifiants de collaborateurs, l'autre des entrées
  {nom, rôle, adresse}.
- **Attention aux noms de champs des éléments** : `item_views.py` sérialise le
  type dans `type` (« mail » ou « doc »), le nom de l'expéditeur dans `subtitle`
  et son adresse dans `authorEmail` — il n'y a ni `kind` ni `author` dans cette
  charge utile, quels que soient les noms des champs du modèle.
- **L'adresse de l'auteur est conservée à part.** `extraction.py` construit
  `author` comme `sender.name || sender.email` : le nom l'emporte, et l'adresse
  était perdue, si bien qu'aucun contact n'était joignable. Un champ
  `author_email` a donc été ajouté à côté (et une colonne dans
  `CollaboratorItem`, migration `0003`), pour l'expéditeur d'un mail comme pour
  le créateur d'un document. `author` est inchangé et
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
- **La validation est enregistrée côté serveur.** Le bouton « Valider » appelle
  `…/handover/validate/`, et l'état partagé (`PassationStatusProvider`) est
  ensuite rafraîchi depuis la réponse, jamais depuis le clic : la ligne de la
  personne sous « Mon équipe » lit le même drapeau et affiche donc « Validée »
  au chargement suivant. Seule la personne concernée peut valider — un manager
  peut corriger une fiche, pas déclarer à sa place qu'elle est validée — et
  toute modification ultérieure remet le drapeau à faux côté serveur, ce que
  l'interface suit dans les deux sens.
