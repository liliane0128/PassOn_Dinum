export type SourceKind = "docs" | "drive";

export interface SourceItem {
  id: string;
  kind: SourceKind;
  name: string;
  url: string;
}

export interface DocumentAssocie {
  id: string;
  name: string;
  date: string;
  proprietaire: string;
  /** Where to open it, when the item carried a link. */
  url?: string;
  /** Why it is ranked where it is ("Échéance 31 oct. · lié à un blocage"). */
  priorityLabel?: string;
}

export interface AttentionPoint {
  id: string;
  label: string;
  /** The items this point was drawn from; empty for a hand-written one. */
  evidence?: { id: string; title?: string; url?: string }[];
}

export interface Contact {
  id: string;
  name: string;
  role: string;
  email: string;
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  status: "actif" | "en_depart";
}

export interface Passation {
  id: string;
  title: string;
  status: "Générée par l'agent" | "Brouillon";
  lastUpdated: string;
  completude: number;
  resume: string;
  sources: SourceItem[];
  attentionPoints: AttentionPoint[];
  documents: DocumentAssocie[];
  documentsTotal: number;
  contacts: Contact[];
  contactsTotal: number;
  validated: boolean;
  validatedAt?: string;
}
