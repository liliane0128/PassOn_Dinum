/**
 * Client for the stored handover and for the generator.
 *
 * Only what the wired sections need, on purpose: the résumé and the points de
 * blocage. Documents prioritaires and contacts clés still show their demo
 * fixture, and wiring them is a later step.
 *
 *   GET   /api/collaborators/<id>/items/     the person's documents and mails
 *   GET   /api/dossier/                      one model pass over them -> a sheet
 *   GET   /PATCH /api/collaborators/<id>/handover/   the stored sheet
 *
 * `/api/dossier/` generates and stores nothing, so a generation is followed by
 * a PATCH -- that is what makes the résumé survive a reload. The same split
 * the previous frontend used, and it needs no change to the generation code.
 *
 * Every call is relative and carries the session cookie: that cookie is how
 * the backend finds the Drive and Messages credentials obtained at login.
 */

export interface EvidenceRef {
  id: string;
  title?: string;
  url?: string;
  excerpt?: string;
}

/** One bulleted line of a generated sheet, with what backs it. */
export interface Bullet {
  label: string;
  evidence?: EvidenceRef[];
}

/**
 * The stored sheet.
 *
 * `text` and `blockers` are displayed; the other sections are read all the
 * same. A whole generation is saved, so they are what the card's completeness
 * figure is measured against -- a real count of what the pass found, rather
 * than a number chosen by hand.
 */
export interface Handover {
  collaboratorId: string;
  text: string;
  validated: boolean;
  updatedAt: string;
  blockers?: Bullet[];
  actions?: unknown[];
  decisions?: unknown[];
  deadlines?: unknown[];
  documents?: unknown[];
}

export interface Item {
  id: string;
  kind: "mail" | "document" | string;
  title: string;
  author?: string;
  date?: string;
}

export interface ItemsResponse {
  items: Item[];
  errors?: Record<string, string>;
  fetchedAt?: string | null;
  isOwn?: boolean;
}

/** What the generator returns. Only `text` is displayed for now. */
export interface GeneratedDossier {
  text: string;
  [section: string]: unknown;
}

export class ApiError extends Error {
  status: number;
  code: string | null;

  constructor(status: number, code: string | null) {
    super(code ? `${code} (${status})` : `request failed (${status})`);
    this.status = status;
    this.code = code;
  }
}

function csrfToken(): string {
  const match = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

async function asJson<T>(response: Response): Promise<T> {
  if (response.ok) return (await response.json()) as T;
  const body = await response.json().catch(() => ({}));
  throw new ApiError(response.status, (body as { error?: string }).error ?? null);
}

export async function fetchHandover(collaboratorId: string): Promise<Handover> {
  return asJson<Handover>(
    await fetch(`/api/collaborators/${collaboratorId}/handover/`, {
      credentials: "same-origin",
    })
  );
}

export async function fetchItems(
  collaboratorId: string
): Promise<ItemsResponse> {
  return asJson<ItemsResponse>(
    await fetch(`/api/collaborators/${collaboratorId}/items/`, {
      credentials: "same-origin",
    })
  );
}

/**
 * One pass of the pipeline: read the person's documents and mails, then write
 * a sheet from them. Slow by nature -- every item's content is fetched before
 * the model is called -- and rate-limited upstream, which is why nothing here
 * calls it on its own.
 */
export async function generateDossier(): Promise<GeneratedDossier> {
  return asJson<GeneratedDossier>(
    await fetch("/api/dossier/", { credentials: "same-origin" })
  );
}

/**
 * Store the sheet.
 *
 * The whole generated payload is sent, not just `text`: a generation costs one
 * slot of a rate-limited quota, and the backend already has a field for each
 * section. The other sections are stored and simply not displayed yet, so the
 * step that wires them needs no second pass.
 */
export async function saveHandover(
  collaboratorId: string,
  patch: Record<string, unknown>
): Promise<Handover> {
  return asJson<Handover>(
    await fetch(`/api/collaborators/${collaboratorId}/handover/`, {
      method: "PATCH",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": csrfToken(),
      },
      body: JSON.stringify(patch),
    })
  );
}

/** Messages someone can act on, for the codes these endpoints answer with. */
const ERRORS: Record<string, string> = {
  no_data_to_summarize:
    "Aucun document ni mail à résumer pour ce compte. Déposez des fichiers dans votre Drive, ou vérifiez que Messages est démarré.",
  llm_not_configured:
    "La clé du modèle n'est pas configurée sur le serveur (GROQ_API_KEY).",
  llm_error:
    "Le modèle n'a pas répondu. Sur l'offre gratuite, une seule génération par minute est possible : réessayez dans un instant.",
  llm_empty_response: "Le modèle a répondu vide. Réessayez.",
  authentication_required: "Session expirée. Reconnectez-vous.",
  not_authenticated: "Session expirée. Reconnectez-vous.",
};

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code && ERRORS[error.code]) return ERRORS[error.code];
    if (error.status === 429) return ERRORS.llm_error;
  }
  return "La génération a échoué. Réessayez dans un instant.";
}
