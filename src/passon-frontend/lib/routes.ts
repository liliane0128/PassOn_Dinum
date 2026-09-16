/**
 * Public paths, as the browser sees them through nginx (:8091).
 *
 * They are not the app's own route names: nginx maps `/dashboard` onto this
 * app's `/`. So anything that navigates across that boundary has to use these
 * constants with `window.location`, never the Next router, which only knows
 * the app's internal routes.
 */
export const DASHBOARD_PATH = "/dashboard";
export const LOGIN_PATH = "/login";
