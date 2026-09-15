// Calls the backend's handover summary endpoint (src/backend/connectors,
// see its README.md). In mock mode (DINUM_USE_MOCK=true on the backend, the
// default while Docs/Drive/Messages aren't wired up here), no session
// credentials are required -- see connectors/README.md's "Mock mode"
// section for what a real (non-mock) call would need instead.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export async function generateDossier() {
  const response = await fetch(`${API_BASE_URL}/api/dossier/`);

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error ?? `Request failed (${response.status})`);
  }

  return response.json();
}
