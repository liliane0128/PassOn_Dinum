# Plan — Espace collaborateur

## Objectif du projet

Interface interne d'entreprise qui regroupe, pour un collaborateur donné, ses mails, ses documents et (plus tard) d'autres informations. En React, avec la charte graphique et les composants de la Suite Numérique (`@gouvfr-lasuite/ui-components`).

## Fait

- [x] Projet React + JavaScript (Vite), sans TypeScript.
- [x] Intégration du design system de la Suite Numérique (`@gouvfr-lasuite/ui-components` + `@gouvfr-lasuite/ui-tokens`), CSS et polices officielles chargées globalement.
- [x] Routing avec `react-router-dom` (URLs partageables).
- [x] **Page d'accueil** (`/`) : saisie libre Prénom + Nom, redirection vers l'espace du collaborateur.
- [x] **Page collaborateur** (`/utilisateur/:slug`) :
  - Layout 3 zones du kit (`MainLayout`) : filtre par type à gauche, liste au centre, détail à droite.
  - Filtre Tous / Mails / Documents avec compteurs.
  - Liste triée par date, clic sur un élément → détail dans le panneau droit.
  - Panneau droit agrandi par défaut et redimensionnable à la souris (ajout du 2026-09-14, suite à ton retour).
  - État "utilisateur introuvable" si le nom saisi ne correspond à aucun collaborateur mocké.
- [x] Données mockées (`src/data/mockData.js`) : 4 collaborateurs, mails et documents fictifs associés.

## Reste à faire

### Fonctionnel
- [ ] **Système de rôles/hiérarchie** : un utilisateur ne peut voir que les infos de son N-1 ou plus (mentionné par toi, pas encore défini précisément — à spécifier : qui décide de la hiérarchie ? comment on l'authentifie ? un simple champ "manager" dans les données mock suffit-il pour commencer ?).
- [ ] Remplacer la recherche par nom en texte libre par une vraie authentification (ou au minimum une liste fiable d'utilisateurs), le texte libre n'étant qu'un raccourci de développement.
- [ ] Ajouter d'autres types d'informations que mails/documents (mentionné comme "et plus tard" — à préciser : calendrier ? annuaire ? tickets ?).
- [ ] Recherche/filtre textuel dans la liste centrale (au-delà du filtre par type).
- [ ] Pagination ou chargement progressif si la liste devient longue.

### Données réelles
- [ ] Brancher une vraie source de mails (API Gmail/Outlook, ou IMAP interne).
- [ ] Brancher une vraie source de documents (GED d'entreprise, Nextcloud, SharePoint...).
- [ ] Remplacer `src/data/mockData.js` par des appels API (probable ajout de `react-query`/`fetch`, gestion des états de chargement et d'erreur).

### Technique / qualité
- [ ] Tests (actuellement aucun test automatisé).
- [ ] Gestion des erreurs réseau une fois les vraies API branchées.
- [ ] Accessibilité : vérifier la navigation clavier complète sur les listes et le panneau de détail.
- [ ] Découpage du bundle (`build.rolldownOptions` / `import()` dynamique) — le kit UI est volumineux (~700 Ko JS, ~1,6 Mo CSS avant compression), à surveiller si le projet grossit.
- [ ] Décider si on reste sur des routes "publiques" en clair (`/utilisateur/:slug`) ou si on passe à une session utilisateur (cookie/token) une fois l'authentification réelle branchée.

## Décisions prises en cours de route

- **JavaScript plutôt que TypeScript**, sur ta demande explicite (2026-09-14).
- **Composants du kit officiel** plutôt que composants recodés à la main, pour rester fidèle à la charte et gagner du temps (`Input`, `Button`, `MainLayout`, `Badge`, `UserAvatar`).
- **Layout 3 zones** (filtre / liste / détail) choisi comme le plus lisible pour ce type d'usage (façon client mail), après validation.
- **Slug d'URL** généré à partir du prénom/nom (accents et casse ignorés) plutôt qu'un identifiant technique, pour rester lisible tant qu'il n'y a pas de vraie authentification.
