/**
 * Public paths, as the browser sees them through nginx (:8091).
 *
 * They are not the app's own route names: nginx maps `/dashboard` onto this
 * app's `/`. So anything that navigates across that boundary has to use these
 * constants with `window.location`, never the Next router, which only knows
 * the app's internal routes.
 */

// Same local-only bypass as lib/auth.ts's MOCK_AUTH: without nginx in front
// (running this app standalone for NEXT_PUBLIC_MOCK_AUTH), "/dashboard" isn't
// a route this app actually has -- only nginx maps it to "/". Everyone else
// keeps the real path, since the env var is unset for them.
const MOCK_AUTH =
  process.env.NEXT_PUBLIC_MOCK_AUTH === "true" &&
  process.env.NODE_ENV !== "production";

export const DASHBOARD_PATH = MOCK_AUTH ? "/" : "/dashboard";
export const LOGIN_PATH = "/login";
