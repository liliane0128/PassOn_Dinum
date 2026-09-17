import { redirect } from "next/navigation";
import { DASHBOARD_PATH } from "@/lib/routes";

/**
 * Only reachable when this app runs on its own (`npm run dev -- -p 3001`).
 *
 * Behind nginx, "/" is the static landing page served from disk and never
 * reaches this app -- which is why the entry screen lives at /dashboard here
 * too: the app's own routes and the public URLs are the same strings.
 */
export default function RootPage() {
  redirect(DASHBOARD_PATH);
}
