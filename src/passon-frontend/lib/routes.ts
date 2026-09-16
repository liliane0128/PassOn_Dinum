/**
 * Public paths, as the browser sees them through nginx (:8091).
 *
 * `/dashboard` is also this app's own internal route (see
 * app/dashboard/page.tsx) -- "/" just redirects to it -- so these constants
 * work the same whether nginx is in front or not.
 */
export const DASHBOARD_PATH = "/dashboard";
export const LOGIN_PATH = "/login";
/** Where the handover itself is read and edited. */
export const PASSATION_PATH = "/gerer-ma-passation";
