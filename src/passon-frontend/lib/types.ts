export type SourceKind = "email" | "docs" | "drive";

export interface SourceTag {
  kind: SourceKind;
  count: number;
}

export interface DocumentAssocie {
  id: string;
  name: string;
  date: string;
  proprietaire: string;
}

export interface AttentionPoint {
  id: string;
  label: string;
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
  sourcesCount: number;
  resume: string;
  sourceTags: SourceTag[];
  attentionPoints: AttentionPoint[];
  documents: DocumentAssocie[];
  documentsTotal: number;
  contacts: Contact[];
  contactsTotal: number;
  validated: boolean;
  validatedAt?: string;
}
