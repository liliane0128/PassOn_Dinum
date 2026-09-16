import { redirect } from "next/navigation";
import { DASHBOARD_PATH } from "@/lib/routes";

/**
 * Only reachable when this app is run on its own (`npm run dev -- -p 3001`).
 *
 * Behind nginx, "/" is the static homepage served from disk and never reaches
 * this app at all -- which is exactly why the dashboard lives at /dashboard
 * here too: the app's own routes and the public URLs are the same strings, so
 * a <Link href="/dashboard"> cannot land somewhere else than a typed URL.
 */
export default function RootPage() {
  redirect(DASHBOARD_PATH);
}
