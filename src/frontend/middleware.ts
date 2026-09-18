import { NextRequest, NextResponse } from "next/server";

/**
 * Local-dev-only bridge: every fetch in this app is a relative /api/... call,
 * same-origin, because in the Dockerized setup nginx sits in front and
 * forwards /api/ to Django while everything else comes here (see
 * src/server/conf.d/default.conf). Run this dev server on its own -- no
 * nginx -- and those calls have nowhere to land. Setting API_PROXY_TARGET
 * (e.g. http://localhost:8000, in a .env.local -- see .env.local.example)
 * makes this middleware do what nginx normally does.
 *
 * Middleware rather than next.config.mjs's `rewrites()`: a rewrite rebuilds
 * the destination from a `:path*` param, which drops a trailing slash --
 * every Django route ends in one (APPEND_SLASH), so the request would land
 * one character short, Django would 301 back to the slashed version, and
 * that redirect would loop through this same rewrite forever. Reading
 * `request.nextUrl.pathname` as a plain string sidesteps that: it is forwarded
 * exactly as received.
 *
 * Unset by default, so this is a no-op inside Docker -- nginx already
 * intercepts /api/ before it ever reaches this app there.
 */
const target = process.env.API_PROXY_TARGET;

export function middleware(request: NextRequest) {
  if (!target) return NextResponse.next();
  const destination = new URL(request.nextUrl.pathname + request.nextUrl.search, target);
  return NextResponse.rewrite(destination);
}

export const config = {
  matcher: "/api/:path*",
};
