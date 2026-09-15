const API_BASE_URL = "http://localhost:8000/api";

// Calls the backend's /api/dossier/ endpoint (connectors/generation.py),
// which returns a JSON handover summary already shaped like SummaryContext's
// model (text/actions/decisions/deadlines/blockers/documents) -- see that
// file's module docstring. In DINUM_USE_MOCK mode (backend .env) this needs
// no credentials at all.
export async function generateDossier() {
  const response = await fetch(`${API_BASE_URL}/dossier/`);
  if (!response.ok) {
    let detail = null;
    try {
      detail = await response.json();
    } catch {
      // Non-JSON error body (e.g. a Django debug HTML page): ignore, keep detail null.
    }
    throw new Error(
      detail?.error ? `${detail.error} (${response.status})` : `Request failed (${response.status})`,
    );
  }
  return response.json();
}
