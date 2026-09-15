// Exemple statique : dans la vraie appli, tout ce contenu (texte + sections
// structurées) serait généré par un modèle d'IA à partir des mails/documents
// du collaborateur. Ici c'est écrit à la main pour avoir un point de départ
// à éditer/valider.
//
// `validated` : passe à true quand le collaborateur concerné valide son propre
// résumé (bouton "Valider" sur sa page) ; toute nouvelle modification (texte
// ou n'importe quelle section ci-dessous) repasse le résumé en non-validé.
//
// `contactIds` référence des ids de `collaborators` (mockData.js).
// `documents` référence des { type: "mail"|"doc", id } de `mockData.js`.
//
// Note : un manager n'a pas de résumé pour lui-même dans ce modèle (seuls les
// comptes "employee" en ont un) — voir accountRole/managerId dans mockData.js.

export const summaries = {
  c2: {
    text: "Thomas travaille sur le module d'authentification. Amélie Rousseau attend sa revue de code, en lien avec les spécifications techniques de l'API qu'il a rédigées.",
    validated: false,
    actions: [
      { id: "a1", label: "Finaliser la revue de code du module d'authentification" },
      { id: "a2", label: "Écrire les tests d'intégration pour l'API" },
    ],
    decisions: [
      { id: "d1", label: "Passage à des jetons JWT plutôt qu'à des sessions serveur pour l'authentification" },
    ],
    deadlines: [
      { id: "dl1", label: "Livraison du module d'authentification", date: "2026-09-30" },
    ],
    blockers: [
      { id: "b1", label: "En attente de la validation sécurité de l'équipe infra" },
    ],
    contactIds: ["c1"],
    documents: [
      { type: "mail", id: "e3" },
      { type: "doc", id: "d3" },
    ],
  },
  c3: {
    text: "Sofia a livré une nouvelle version des maquettes, à mettre en cohérence avec la présentation pour le comité de pilotage qu'elle a préparée.",
    validated: false,
    actions: [
      { id: "a1", label: "Finaliser les maquettes v2" },
      { id: "a2", label: "Préparer la présentation du comité de pilotage" },
    ],
    decisions: [
      { id: "d1", label: "Nouvelle palette de couleurs validée en comité" },
    ],
    deadlines: [
      { id: "dl1", label: "Présentation au comité de pilotage", date: "2026-09-20" },
    ],
    blockers: [
      { id: "b1", label: "En attente des retours utilisateurs sur le prototype" },
    ],
    contactIds: ["c1"],
    documents: [
      { type: "mail", id: "e4" },
      { type: "doc", id: "d4" },
    ],
  },
  c4: {
    text: "",
    validated: false,
    actions: [],
    decisions: [],
    deadlines: [],
    blockers: [],
    contactIds: [],
    documents: [],
  },
};
