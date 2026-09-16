# Plan — Pass'on

## Objectif du projet

Interface interne d'entreprise permettant, quand un collaborateur est absent ou change de poste, de retrouver rapidement où il en était : résumé IA de son activité (mails, documents), consultable et modifiable par lui-même et par son manager. En React, avec la charte graphique et les composants de la Suite Numérique (`@gouvfr-lasuite/ui-components`).

## Fait

- [x] Projet React + JavaScript (Vite), sans TypeScript.
- [x] Intégration du design system de la Suite Numérique (`@gouvfr-lasuite/ui-components` + `@gouvfr-lasuite/ui-tokens`).
- [x] Routing avec `react-router-dom`.
- [x] **Refonte complète en login + rôles** (2026-09-15, changement de programme demandé) : l'ancienne page de recherche par nom (`/utilisateur/:slug`) est retirée, remplacée par une authentification par email/mot de passe et deux parcours distincts selon le rôle du compte.
  - [x] **Page de connexion** (`/`) : email + mot de passe (`Input`/`InputPassword` du kit). Comptes mockés dans `src/data/mockData.js` (pas de vrai backend pour l'instant — il arrivera plus tard) : identifiants de test affichés directement sur la page.
  - [x] **Espace manager** (`/manager`) : trois colonnes — équipe (1/4), résumé du collaborateur sélectionné, éditable librement par le manager (2/4), partage du résumé (1/4).
  - [x] **Partage de résumé** (2026-09-15) : dans la 3ᵉ colonne de l'espace manager, sélection de destinataires (cases à cocher, tous les collaborateurs sauf celui dont c'est le résumé) puis bouton "Envoyer". L'envoi est **simulé** — pas de vrai mail pour l'instant (voir ci-dessous) — mais garde une trace visible ("Envois récents") pour que l'action ait un retour concret.
  - [x] **Espace employé** (`/moi`) : résumé IA de son propre compte au centre (2/3), éditable, avec un badge Validé/Non validé et un bouton "Valider ce résumé" ; liste de ses mails/documents à droite (1/3), chaque élément dépliable pour voir son détail.
- [x] Résumé IA **partagé et éditable** (`src/context/SummaryContext.jsx`) : un seul texte par collaborateur employé, modifiable par lui-même ou son manager, avec un statut `validated` remis à `false` à chaque modification.
- [x] **Résumé enrichi en 6 sections structurées** (2026-09-15, sur ta demande, données factices) : actions en cours, décisions importantes, deadlines, points de blocage, contacts clés, documents importants — affichées sous le texte libre, modifiables (ajout/suppression) par l'employé et par son manager, sur les deux pages (`src/components/SummaryDetails.jsx`, partagé entre les deux). Les contacts clés pointent vers de vrais collaborateurs mockés, les documents importants vers les vrais mails/documents du collaborateur concerné (réutilise `src/utils/collaboratorItems.js`, factorisé à cette occasion depuis la page employé). Chaque ajout/suppression est enregistré immédiatement (pas de bouton "Enregistrer" séparé pour ces sections, contrairement au texte libre) et repasse le résumé en non-validé, comme pour le texte.
- [x] Authentification mockée (`src/context/AuthContext.jsx`) : `login(email, password)` cherche une correspondance dans `mockData.js`, redirige vers `/manager` ou `/moi` selon `accountRole`.
- [x] Hiérarchie simple via un champ `managerId` sur chaque collaborateur mocké — en attendant la vraie table de relations N-1/N+1 que tu as mentionnée côté base de données.
- [x] Nettoyage disque (2026-09-15) : doublon massif dans `node_modules` (react-aria/react-stately installés en double dans chacun des 47 sous-paquets `@react-aria/*`, ~2 Go) corrigé via `overrides` dans `package.json` → node_modules passé de 2,9 Go à 375 Mo. Fichiers désormais inutiles supprimés (`HomePage`, `UserPage`, `utils/user.js`).
- [x] **Améliorations UI/UX** (2026-09-15) :
  - Protection contre la perte de saisie : changer de collaborateur sélectionné (manager) ou se déconnecter avec un résumé modifié non enregistré déclenche une confirmation avant d'abandonner les modifications.
  - Notifications de confirmation (`useToastProvider` du kit, déjà branché via `CunninghamProvider` mais pas utilisé jusque-là) après un enregistrement, une validation ou un partage de résumé.
  - Bascule thème clair/sombre (`src/context/ThemeContext.jsx` + `src/components/ThemeToggle.jsx`), mémorisée dans `localStorage`, disponible sur les 3 pages — s'appuie sur le thème sombre déjà fourni par le kit (`cunningham-theme--dark`).
  - Email mémorisé sur la page de login (`localStorage`) pour ne pas avoir à le retaper à chaque connexion.
  - Les `<textarea>` de résumé sont maintenant associés à leur titre via `aria-labelledby`, pour les lecteurs d'écran.
  - **Correctifs mode sombre** (suite à tes retours avec capture d'écran) : `.manager-page`/`.employee-page` n'avaient aucun fond défini (seules les petites cartes changeaient de couleur) ; `body` n'avait aucune couleur de texte par défaut (le titre "Pass'on" restait noir) ; les éléments de formulaire natifs (`<textarea>`, `<button>` faits main) n'héritent pas la couleur du parent par défaut dans les navigateurs — ajouté une règle globale `button, input, textarea, select { color: inherit }` pour corriger ça partout d'un coup plutôt qu'au cas par cas.
- [x] **Bandeau de bas de page** (2026-09-15) : repris de la structure du footer de lasuite.numerique.gouv.fr sur les 3 pages (`src/components/AppFooter.jsx`) — bloc "Nous contacter" (remplace "S'abonner à la newsletter"/"Démarrer avec LaSuite" du site original, sur ta demande), puis bande d'identité Pass'on. Les pages sont passées de "hauteur figée à l'écran" à "défilement naturel de toute la page" (`height` → `min-height`) pour que le bandeau se découvre en scrollant, comme sur le site d'origine.
  - **Retiré le composant `Footer` officiel du kit** (logo gouv, liens legifrance/service-public/data.gouv, mentions légales) initialement ajouté le même jour : ce projet n'est pas un service de l'État, pas le droit d'afficher cette identité institutionnelle dessus (ton retour du 2026-09-15).
  - **Contenu recentré et agrandi** (titre/texte/bouton du bloc contact centrés en colonne plutôt qu'étalés, tailles et espacements augmentés).
  - **Premier écran garanti identique à avant, sur les 3 pages** : `.login-page__main`/`.manager-page__viewport`/`.employee-page__viewport` ont chacun un `min-height: 100dvh` dédié, séparé du bandeau — sans ça, le contenu principal (`flex: 1`) partageait l'espace disponible avec le bandeau et se retrouvait légèrement compressé dès le premier écran au lieu de rester identique à avant.

## Reste à faire

### Fonctionnel
- [ ] **Vraie table de relations hiérarchiques** (N-1/N+1) côté base de données, pour remplacer le champ `managerId` mocké — tu as indiqué que ça se précisera plus tard.
- [x] **Vraie authentification** (2026-09-15) : la connexion se fait avec les identifiants **Drive**, vérifiés par l'instance Drive locale via son flux OIDC/Keycloak (`POST /api/auth/login/`). Plus aucun mot de passe dans le code, et la session survit au rechargement de la page (cookie de session serveur). Voir `src/backend/accounts/README.md`.
- [ ] **Rôle et hiérarchie côté backend** : Drive ne connaît ni `accountRole` ni `managerId`. En attendant, `toAppUser()` (dans `AuthContext.jsx`) relie le compte Drive au collaborateur mocké de même email pour retrouver son rôle ; un compte Drive sans équivalent mocké ouvre l'espace employé avec un contenu vide. C'est la dernière dépendance de la connexion aux données mockées.
- [ ] **Résumé IA réel** : remplacer `mockSummaries.js` par un vrai appel à un modèle IA à partir des mails/documents.
- [ ] Décider si l'employé peut voir le statut "vu par le manager" ou une trace des modifications du manager sur son résumé (actuellement le manager peut modifier sans que l'employé soit notifié).
- [ ] **Envoi réel par mail** : le partage de résumé depuis l'espace manager est aujourd'hui simulé (juste gardé en mémoire, perdu au rafraîchissement) — à brancher sur un vrai envoi de mail quand le backend sera là.
- [ ] Étendre le rôle manager pour gérer plusieurs niveaux de hiérarchie (un manager de managers) si besoin.

### Données réelles
- [x] **Documents réels** (2026-09-16) : les fichiers Drive de l'utilisateur connecté, via `GET /api/extraction/items/`.
- [x] **Mails réels** (2026-09-16) : ceux de Messages, dès lors que le compte existe aussi dans son Keycloak (voir `src/backend/accounts/README.md`).
- [x] **Résumé IA sur données réelles** : `/api/dossier/` génère le résumé à partir de ces éléments, avec un lien cliquable par document.
- [ ] **Données des autres collaborateurs** : la vue manager reste mockée, faute de session pour les comptes des autres. À traiter côté backend (compte de service, délégation, ou consentement).
- [ ] Remplacer le reste de `src/data/mockData.js` (résumés, hiérarchie) par des appels API.

### Technique / qualité
- [ ] Tests (actuellement aucun test automatisé).
- [ ] Gestion des erreurs réseau une fois les vraies API branchées.
- [ ] Accessibilité : reste à vérifier la navigation clavier complète sur les listes dépliables (les `<textarea>` de résumé ont désormais un `aria-labelledby`, fait le 2026-09-15).
- [ ] Page non adaptée aux petits écrans (mobile/tablette) — mise en page en colonnes fixes sans media queries, à traiter consciemment plus tard si besoin.
- [ ] Découpage du bundle si le projet grossit encore (actuellement ~373 Ko JS / ~1,6 Mo CSS avant compression).
- [ ] Session persistée (le rafraîchissement de page déconnecte actuellement l'utilisateur, puisque `currentUser` ne vit qu'en mémoire React).

## Décisions prises en cours de route

- **JavaScript plutôt que TypeScript**, sur ta demande explicite (2026-09-14).
- **Comptes mockés avec identifiants visibles sur la page de login** plutôt qu'email libre sans mot de passe (2026-09-15, sur ta demande) : cohérent avec le fait qu'un vrai backend d'authentification arrive bientôt — pas la peine de bâtir un système de comptes plus élaboré en attendant.
- **Un seul résumé partagé par collaborateur employé**, modifiable par lui-même et par son manager (2026-09-15, recommandation acceptée), plutôt que deux versions séparées (brouillon employé / notes manager).
- **Résumé passé en texte libre éditable** plutôt qu'en segments avec citations cliquables vers les documents sources : les deux mécanismes sont difficilement conciliables (un texte librement modifiable par un humain ne peut pas garder une structure de citations fiable). Le système de citations construit le 2026-09-15 (avant ce changement de programme) a donc été retiré côté résumé — pour l'employé, la liste de documents reste consultable séparément (colonne de droite), avec détail dépliable au clic.
- **Pas de `MainLayout` du kit** pour les pages manager/employé : ces pages ont leur propre en-tête et leur propre découpage en colonnes proportionnelles (1/4-2/4-1/4 et 2/3-1/3), plus simples à obtenir avec une mise en page maison qu'en pliant le composant du kit à ce besoin (bénéfice notable : le bundle JS a baissé d'environ 320 Ko en n'utilisant plus le système de panneaux redimensionnables du kit, qu'on ne réutilise plus).
- Le projet vit dans un dépôt git dédié, `Relais_Dinum` (branche `frontend`), sous `srcs/frontend/`.
- **Nom du produit : "Pass'on"** (2026-09-15, sur ta demande), remplace "Continuité d'activité" affiché en haut des trois pages et en titre de ce document.
- **Bleu du kit assombri en mode sombre, sur manager/employé uniquement** (2026-09-15, sur ta demande, couleur Pantone "Crowdflower" `#171036`) : `brand-550`/`brand-650` (boutons, sélection d'équipe) restaient identiques en clair et en sombre dans le kit, ce qui les rendait trop vifs sur fond sombre. Première tentative : surcharger `brand-550`/`brand-650` directement (les couleurs "brutes") — a rendu boutons/bordures/icônes quasi invisibles, le fond de page en sombre étant lui-même un gris presque noir (`#1B1C1D`) de luminosité proche de `#171036`. Corrigé en ne surchargeant que les tokens de **fond** (`background--semantic--brand--primary/tertiary`), pas les tokens bruts utilisés aussi par nos icônes/bordures (qui gardent le bleu clair du kit, pour rester lisibles) ; ajouté un léger contour aux boutons primaires pour que leur forme reste identifiable sur le fond de page. La page de login garde le bleu d'origine du kit. Ajustement suivant : le panneau "Mon résumé IA" de l'espace employé utilisait aussi ce fond bleu nuit, alors que le panneau "Documents utilisés" à côté restait neutre — retiré pour que les deux panneaux partagent la même couleur de fond neutre (le bleu nuit reste uniquement sur le bandeau "Nous contacter" en bas de page).
- **Fondu clair/sombre** (2026-09-15, sur ta demande) : transition de 200ms sur fond/texte/bordure à la bascule de thème (`src/index.css`), désactivée si l'utilisateur préfère moins d'animations (`prefers-reduced-motion`). Ajustement : le champ "Adresse mail" du kit définit sa propre transition (bordure/ombre) sans le fond, plus spécifique donc prioritaire sur la nôtre — son fond changeait instantanément pendant que le reste s'animait ; complété la transition du kit pour y inclure le fond, avec la même durée.
- **Un seul défilement par page, pas de zones imbriquées** (2026-09-15, suite à ton retour "le bandeau a disparu") : les colonnes de manager/employé avaient chacune leur propre `overflow-y: auto`, pensé quand leur contenu tenait toujours à l'écran. Depuis l'ajout des 6 sections du résumé, la colonne centrale peut devenir bien plus haute que l'écran — en scrollant dedans, on reste piégé dans son défilement interne sans jamais atteindre celui de la page qui mène au bandeau. Retiré ces `overflow-y: auto` internes : toutes les colonnes grandissent maintenant naturellement, un seul défilement (celui de la page) mène jusqu'au bandeau, quelle que soit la longueur du résumé.
