/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Every Django route the middleware (middleware.ts) proxies to ends in "/"
  // (APPEND_SLASH), and none of them are real pages in this app, so without
  // this flag Next's own trailing-slash redirect answers with a 308 before
  // the request ever reaches middleware. Harmless when API_PROXY_TARGET is
  // unset -- there's nothing under /api/ in Docker for this to matter to,
  // nginx already owns that path there.
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
