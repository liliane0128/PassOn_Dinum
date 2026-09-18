import { Passation, TeamMember } from "./types";

export const currentUser = {
  name: "Lili Wang",
  initials: "LW",
  jobTitle: "Cheffe de projet — Dossier Continuity",
};

// Manager view (Sidebar's "Mon équipe" / app/equipe): Julie Bonnet's team in
// the Service Achats (see lib/demo-data.ts's MANAGER_PERSONA). Marie is the
// only one actually leaving -- everyone else here is filler to make the list
// read as a real team rather than a single row.
export const teamMembers: TeamMember[] = [
  { id: "team-1", name: "Karim Haddad", role: "Gestionnaire des marchés publics", status: "actif" },
  { id: "team-10", name: "Marie Lambert", role: "Gestionnaire des marchés publics", status: "en_depart" },
  { id: "team-2", name: "Ahmed Belkacem", role: "Chargé de mission achats", status: "actif" },
  { id: "team-3", name: "Léa Girard", role: "Comptable", status: "actif" },
  { id: "team-4", name: "Nora Benali", role: "Assistante administrative", status: "actif" },
  { id: "team-5", name: "Thomas Petit", role: "Chargé de mission achats", status: "actif" },
  { id: "team-6", name: "Sarah Fontaine", role: "Assistante administrative", status: "actif" },
  { id: "team-7", name: "Yanis Cherif", role: "Gestionnaire de contrats", status: "actif" },
  { id: "team-8", name: "Camille Roussel", role: "Contrôleuse de gestion", status: "actif" },
  { id: "team-9", name: "Hugo Meunier", role: "Chargé de mission achats", status: "actif" },
];

export const passation: Passation = {
  id: "passation-dossier-continuity",
  title: "Passation — Projet Dossier Continuity",
  status: "Générée par l'agent",
  lastUpdated: "12 sept. 2026 à 16:24",
  completude: 95,
  resume:
    "Le projet Dossier Continuity vise à améliorer la continuité du traitement des dossiers administratifs lors des départs ou mouvements de personnels. Le périmètre actuel concerne la gestion des signaux de dossier (blocage, risque, incohérence, prêt) et la passation en un clic après départ.",
  // The raw files behind the generated passation, grouped by service in the
  // "Sources" tab. url points at where that service actually serves the item
  // (see connectors/generation.py in the backend for the real equivalent).
  sources: [
    {
      id: "src-doc-1",
      kind: "docs",
      name: "Spécifications fonctionnelles",
      url: "http://localhost:8071/api/v1.0/documents/doc-001/",
    },
    {
      id: "src-doc-2",
      kind: "docs",
      name: "Roadmap projet",
      url: "http://localhost:8071/api/v1.0/documents/doc-002/",
    },
    {
      id: "src-drive-1",
      kind: "drive",
      name: "Maquette UI.fig",
      url: "http://localhost:8072/api/v1.0/items/drive-001/",
    },
  ],
  attentionPoints: [
    {
      id: "attn-1",
      label:
        "La mise en œuvre dans le module Fichiers est complexe (selon retour DINUM).",
    },
    {
      id: "attn-2",
      label:
        "Prévoir une discussion avec les PMs La Suite pour une éventuelle intégration dans Mail.",
    },
    {
      id: "attn-3",
      label: "Vérifier la conformité RGPD pour le traitement des emails.",
    },
  ],
  // proprietaire starts out as the departing agent (currentUser) for every
  // document -- these were theirs before the handover.
  documents: [
    {
      id: "doc-1",
      name: "Spécifications fonctionnelles",
      date: "10 sept. 2026",
      proprietaire: currentUser.name,
    },
    {
      id: "doc-2",
      name: "Maquette UI",
      date: "08 sept. 2026",
      proprietaire: currentUser.name,
    },
    {
      id: "doc-3",
      name: "Roadmap projet",
      date: "02 sept. 2026",
      proprietaire: currentUser.name,
    },
  ],
  documentsTotal: 5,
  contacts: [
    {
      id: "contact-1",
      name: "Marion Lefèvre",
      role: "PM La Suite Numérique",
      email: "marion.lefevre@numerique.gouv.fr",
    },
    {
      id: "contact-2",
      name: "Thomas Bernard",
      role: "DINUM – Chef de projet",
      email: "thomas.bernard@dinum.gouv.fr",
    },
    {
      id: "contact-3",
      name: "Sophie Martin",
      role: "Support technique",
      email: "sophie.martin@numerique.gouv.fr",
    },
  ],
  contactsTotal: 6,
  validated: false,
};
