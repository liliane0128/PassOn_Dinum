import type { Handover, Item } from "./handover";

/**
 * Demo mode: presenting this app must never depend on the network being up
 * or fast -- not Django, not Groq. Set NEXT_PUBLIC_DEMO_MODE=true (see
 * docker-compose.yml's `frontend` service) to make both "generate a
 * passation" entry points -- the dashboard's button and gerer-ma-passation's
 * own Régénérer -- skip every fetch/PATCH and run off the fixture below
 * instead. Login is untouched: only what happens after it is swapped.
 */
export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

/**
 * Marie's manager, for the "Manager" view (Header's role switch): a purely
 * cosmetic swap, not a second account -- there is only ever the one real
 * session. Julie Bonnet is not invented for this: she is already Marie's
 * "Responsable du service Achats" contact in the handover below, so this is
 * the same person, seen from the other side of the handover.
 */
export const MANAGER_PERSONA = {
  full_name: "Julie Bonnet",
  jobTitle: "Responsable du service Achats",
};

/**
 * A fictional handover: Marie Lambert, gestionnaire des marchés publics in a
 * French local authority, about to leave. Content picked to be recognisable
 * as *government* work rather than generic office life, and the blockers are
 * deliberately mundane -- a late supplier report, a solo admin login, an
 * invoice stuck on someone else's desk -- the kind of thing a handover sheet
 * exists for, not a dramatic crisis.
 */
export const DEMO_ITEMS: Item[] = [
  {
    id: "drive:d1",
    type: "doc",
    title: "Dossier de consultation des entreprises (DCE) — marché maintenance informatique",
    subtitle: "Marie Lambert",
    date: "2026-09-05T10:00:00Z",
    url: "",
  },
  {
    id: "drive:d2",
    type: "doc",
    title: "Rapport d'audit de sécurité (version provisoire)",
    subtitle: "Marc Delattre",
    date: "2026-09-10T09:30:00Z",
    url: "",
  },
  {
    id: "drive:d3",
    type: "doc",
    title: "Convention de partenariat — prestataire nettoyage",
    subtitle: "Marie Lambert",
    date: "2026-09-12T14:00:00Z",
    url: "",
  },
  {
    id: "drive:d4",
    type: "doc",
    title: "Grille d'évaluation des offres — appel d'offres nettoyage",
    subtitle: "Marie Lambert",
    date: "2026-09-08T11:15:00Z",
    url: "",
  },
  {
    id: "messages:m1",
    type: "mail",
    title: "Relance audit de sécurité",
    subtitle: "Marc Delattre",
    authorEmail: "m.delattre@inforeseau.fr",
    date: "2026-09-10T09:00:00Z",
    preview: "Bonjour, je me permets de relancer une nouvelle fois au sujet du rapport d'audit, toujours pas transmis...",
  },
  {
    id: "messages:m2",
    type: "mail",
    title: "Compte-rendu comité des marchés",
    subtitle: "Julie Bonnet",
    authorEmail: "julie.bonnet@collectivite.fr",
    date: "2026-08-28T16:00:00Z",
  },
  {
    id: "messages:m3",
    type: "mail",
    title: "Litige facture nettoyage",
    subtitle: "Nathalie Perrin",
    authorEmail: "nathalie.perrin@collectivite.fr",
    date: "2026-09-12T08:45:00Z",
  },
];

export function buildDemoHandover(collaboratorId: string): Handover {
  return {
    collaboratorId,
    validated: false,
    updatedAt: new Date().toISOString(),
    text:
      "Marie assurait la gestion des marchés publics du service Achats : renouvellement du " +
      "marché de maintenance informatique, appel d'offres pour le nettoyage des locaux et " +
      "suivi budgétaire de la direction. Le dossier informatique est le plus urgent : il " +
      "dépend d'un rapport d'audit externe toujours pas livré, à quelques jours du comité " +
      "des marchés.",
    actions: [
      {
        label: "Relancer la société Inforéseau pour obtenir le rapport d'audit de sécurité manquant.",
        evidence: [{ id: "drive:d2", title: "Rapport d'audit de sécurité (version provisoire)" }],
      },
      {
        label: "Finaliser la grille d'évaluation avant l'ouverture des plis de l'appel d'offres nettoyage.",
        evidence: [{ id: "drive:d4", title: "Grille d'évaluation des offres — appel d'offres nettoyage" }],
      },
      {
        label: "Former la remplaçante à la validation des bons de commande sur Chorus Pro.",
        evidence: [],
      },
    ],
    decisions: [
      {
        label:
          "Le marché de maintenance informatique sera reconduit pour 3 ans avec le prestataire actuel, sous réserve de la remise du rapport d'audit.",
        evidence: [{ id: "drive:d1", title: "Dossier de consultation des entreprises (DCE)" }],
      },
      {
        label: "Le budget complémentaire de 15 000 € pour la mise en accessibilité de l'accueil a été validé en commission permanente.",
        evidence: [],
      },
    ],
    deadlines: [
      {
        label:
          "Dépôt du dossier de renouvellement du marché de maintenance informatique avant le comité, sous peine de rupture de service à l'échéance du contrat actuel.",
        date: "2026-10-15",
        evidence: [{ id: "drive:d1", title: "Dossier de consultation des entreprises (DCE)" }],
      },
      {
        label: "Réponse à l'appel d'offres de nettoyage des locaux à envoyer avant la clôture.",
        date: "2026-09-30",
        evidence: [{ id: "drive:d4", title: "Grille d'évaluation des offres — appel d'offres nettoyage" }],
      },
    ],
    blockers: [
      {
        label:
          "Le rapport d'audit de sécurité d'Inforéseau, indispensable pour chiffrer le renouvellement, n'est toujours pas arrivé malgré deux relances.",
        evidence: [{ id: "drive:d2", title: "Rapport d'audit de sécurité (version provisoire)" }],
      },
      {
        label:
          "L'accès administrateur à la plateforme des marchés publics PLACE n'est enregistré qu'au nom de Marie : personne d'autre dans le service ne peut publier ou modifier une consultation tant qu'il n'est pas transféré.",
        evidence: [],
      },
      {
        label:
          "Une facture contestée du prestataire de nettoyage est en attente d'arbitrage du contrôle de gestion, au risque de dépasser le délai légal de paiement de 30 jours.",
        evidence: [{ id: "drive:d3", title: "Convention de partenariat — prestataire nettoyage" }],
      },
    ],
    documents: [
      { id: "drive:d1", title: "Dossier de consultation des entreprises (DCE) — marché maintenance informatique", url: "" },
      { id: "drive:d2", title: "Rapport d'audit de sécurité (version provisoire)", url: "" },
      { id: "drive:d3", title: "Convention de partenariat — prestataire nettoyage", url: "" },
      { id: "drive:d4", title: "Grille d'évaluation des offres — appel d'offres nettoyage", url: "" },
    ],
    contacts: [
      { name: "Marc Delattre", role: "Inforéseau — audit de sécurité en retard", email: "m.delattre@inforeseau.fr" },
      { name: "Julie Bonnet", role: "Responsable du service Achats", email: "julie.bonnet@collectivite.fr" },
      { name: "Nathalie Perrin", role: "Contrôleuse de gestion — arbitrage facture", email: "nathalie.perrin@collectivite.fr" },
      { name: "Amadou Diallo", role: "Remplaçant temporaire pendant la transition", email: "amadou.diallo@collectivite.fr" },
    ],
  };
}
