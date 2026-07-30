// scripts/write-frontend-config.mjs
//
// COMPATIBILITY SHIM. This used to be the frontend's config writer, with its own
// copy of the env parsing AND a hardcoded store-name default — which is exactly
// how one store's brand followed the template into the next one.
//
// The single source of truth is now store.identity.json (+ the GitHub Actions
// repository variables that override it), and the writer is
// scripts/apply-store-identity.mjs, which additionally keeps index.html,
// manifest.webmanifest, robots.txt, sitemap.xml, web.config and
// backend/wrangler.toml in sync with it.
//
// This file stays so that older workflow definitions and any local muscle memory
// keep working. It writes the same site_settings.js and __/firebase/init.json,
// via the same code path.

await import("./apply-store-identity.mjs");
