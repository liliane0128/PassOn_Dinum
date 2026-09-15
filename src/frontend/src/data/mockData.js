export const collaborators = [
  {
    id: "c1",
    firstName: "Amélie",
    lastName: "Rousseau",
    role: "Cheffe de projet",
    team: "Produit",
  },
  {
    id: "c2",
    firstName: "Thomas",
    lastName: "Lefèvre",
    role: "Développeur backend",
    team: "Tech",
  },
  {
    id: "c3",
    firstName: "Sofia",
    lastName: "Martins",
    role: "Designer UX/UI",
    team: "Produit",
  },
  {
    id: "c4",
    firstName: "Karim",
    lastName: "Belhadj",
    role: "Responsable RH",
    team: "RH",
  },
];

export const emails = [
  {
    id: "e1",
    collaboratorId: "c1",
    from: "Direction de projet",
    subject: "Point d'avancement projet Q3",
    preview:
      "Bonjour, pouvez-vous m'envoyer le statut de vos tâches avant vendredi...",
    receivedAt: "2026-09-14T08:32:00",
  },
  {
    id: "e2",
    collaboratorId: "c1",
    from: "Karim Belhadj",
    subject: "Entretien annuel - planification",
    preview:
      "Merci de choisir un créneau dans le calendrier partagé pour...",
    receivedAt: "2026-09-12T11:00:00",
  },
  {
    id: "e3",
    collaboratorId: "c2",
    from: "Amélie Rousseau",
    subject: "Revue de code - module authentification",
    preview: "J'ai poussé les changements sur la branche feature/auth, peux-tu...",
    receivedAt: "2026-09-13T17:10:00",
  },
  {
    id: "e4",
    collaboratorId: "c3",
    from: "Amélie Rousseau",
    subject: "Maquettes v2 disponibles",
    preview: "Les nouvelles maquettes sont prêtes pour relecture, lien Figma...",
    receivedAt: "2026-09-11T15:45:00",
  },
];

export const documents = [
  {
    id: "d1",
    collaboratorId: "c1",
    title: "Cahier des charges - V1",
    type: "pdf",
    updatedAt: "2026-09-10T09:00:00",
    sizeKb: 1240,
  },
  {
    id: "d2",
    collaboratorId: "c1",
    title: "Budget prévisionnel 2026",
    type: "sheet",
    updatedAt: "2026-09-08T10:15:00",
    sizeKb: 88,
  },
  {
    id: "d3",
    collaboratorId: "c2",
    title: "Spécifications techniques API",
    type: "doc",
    updatedAt: "2026-09-12T14:20:00",
    sizeKb: 340,
  },
  {
    id: "d4",
    collaboratorId: "c3",
    title: "Présentation comité de pilotage",
    type: "slide",
    updatedAt: "2026-09-13T16:00:00",
    sizeKb: 5600,
  },
];
