#!/usr/bin/env node
// scripts/apply-store-identity.mjs
//
// Writes the resolved store identity (scripts/store-identity.mjs) into every
// file that carries brand-specific values, so a store is configured in ONE place
// and never by hand-editing scattered files.
//
//   node scripts/apply-store-identity.mjs
//        render from environment variables, falling back to store.identity.json
//
//   node scripts/apply-store-identity.mjs --check
//        render in memory and exit 1 on any difference (deploy-time gate)
//
//   node scripts/apply-store-identity.mjs --check --source=file
//        ignore the environment entirely — the repo self-consistency gate that
//        proves the committed files match the committed store.identity.json
//
//   node scripts/apply-store-identity.mjs --dir frontend-dist
//        render only the static web files, into an already-copied output dir
//
// TARGETS
//   site_settings.js          fully generated  (runtime config for the storefront)
//   __/firebase/init.json     fully generated  (Firebase Auth helper pages)
//   index.html                marked regions   (SEO stays complete and committed)
//   manifest.webmanifest      patched fields
//   robots.txt                fully generated
//   sitemap.xml              fully generated
//   web.config                marked region    (canonical-host redirect)
//   backend/wrangler.toml     marked regions   (worker name / routes / D1 / vars)
//
// Marked regions look like `<!-- store-identity:head -->…<!-- /store-identity:head -->`
// (or `# store-identity:name` … `# /store-identity:name` in TOML). Everything
// outside a region is hand-maintained and never touched.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { ROOT, resolveIdentity, buildSiteSettings } from "./store-identity.mjs";

const argv = process.argv.slice(2);
const CHECK = argv.includes("--check");
const SOURCE = argv.includes("--source=file") ? "file" : "env";
const dirArg = argv.find((a) => a.startsWith("--dir="));
const OUT_DIR = dirArg ? resolve(ROOT, dirArg.slice("--dir=".length)) : ROOT;
const STATIC_ONLY = OUT_DIR !== ROOT;

const identity = resolveIdentity({ source: SOURCE });

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const results = [];

/** Register a rendered file. `transform` receives the current text (or null). */
function emit(relPath, transform, { root = OUT_DIR, optional = false } = {}) {
  const dest = join(root, relPath);
  if (!existsSync(dest)) {
    if (optional) return;
    throw new Error(`apply-store-identity: missing target ${relPath}`);
  }
  const current = readFileSync(dest, "utf8");
  // Compare and write in LF so a CRLF checkout never reports phantom drift.
  const currentLf = current.replace(/\r\n/g, "\n");
  const next = transform(currentLf);
  results.push({ relPath, dest, changed: next !== currentLf, next, hadCrlf: current.includes("\r\n") });
}

function emitNew(relPath, content, { root = OUT_DIR } = {}) {
  const dest = join(root, relPath);
  const current = existsSync(dest) ? readFileSync(dest, "utf8").replace(/\r\n/g, "\n") : null;
  results.push({ relPath, dest, changed: current !== content, next: content, hadCrlf: false });
}

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Replace the body of a marked region, keeping the markers themselves.
 *  The opening marker MUST be a complete single-line comment: an unterminated
 *  one would make the generated body land inside a comment (which silently
 *  blanked the whole <head> once) — so it is validated, not assumed. */
function replaceRegion(text, name, body, { open, close, openLine }) {
  const startMarker = open.replace("NAME", name);
  const endMarker = close.replace("NAME", name);
  const pattern = new RegExp(
    `(${escapeRegExp(startMarker)}[^\\n]*\\n)[\\s\\S]*?(^[ \\t]*${escapeRegExp(endMarker)})`,
    "m"
  );
  const found = text.match(pattern);
  if (!found) {
    throw new Error(
      `apply-store-identity: region "${name}" not found. Expected ${startMarker} … ${endMarker}`
    );
  }
  if (openLine && !openLine.test(found[1].trimEnd())) {
    throw new Error(
      `apply-store-identity: the opening marker of region "${name}" must be a complete ` +
      `single-line comment (got: ${found[1].trim()}). Move any explanation to the lines above it.`
    );
  }
  return text.replace(pattern, (_, head, tail) => `${head}${body}\n${tail}`);
}

const HTML_REGION = {
  open: "<!-- store-identity:NAME",
  close: "<!-- /store-identity:NAME -->",
  openLine: /-->$/
};
const TOML_REGION = { open: "# store-identity:NAME", close: "# /store-identity:NAME" };

// ---------------------------------------------------------------------------
// site_settings.js  +  __/firebase/init.json
// ---------------------------------------------------------------------------

export function renderSiteSettings(settings) {
  return `(function (global) {
  "use strict";

  // GENERATED by scripts/apply-store-identity.mjs from store.identity.json (or
  // the GitHub Actions repository variables that override it). DO NOT EDIT.

  var defaultSettings = ${JSON.stringify(settings, null, 4)};

  function isPlainObject(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
  }

  function clone(value) {
    if (Array.isArray(value)) return value.slice();
    if (!isPlainObject(value)) return value;
    var out = {};
    Object.keys(value).forEach(function (key) {
      out[key] = clone(value[key]);
    });
    return out;
  }

  function merge(base, extra) {
    var out = clone(isPlainObject(base) ? base : {});
    if (!isPlainObject(extra)) return out;
    Object.keys(extra).forEach(function (key) {
      var nextValue = extra[key];
      if (isPlainObject(out[key]) && isPlainObject(nextValue)) {
        out[key] = merge(out[key], nextValue);
        return;
      }
      if (nextValue !== undefined) out[key] = clone(nextValue);
    });
    return out;
  }

  function getByPath(source, path, fallback) {
    var parts = String(path || "").split(".").filter(Boolean);
    var cursor = source;
    for (var i = 0; i < parts.length; i += 1) {
      if (!cursor || typeof cursor !== "object" || !(parts[i] in cursor)) return fallback;
      cursor = cursor[parts[i]];
    }
    return cursor === undefined ? fallback : clone(cursor);
  }

  var settings = merge(defaultSettings, isPlainObject(global.__SITE_SETTINGS__) ? global.__SITE_SETTINGS__ : {});
  var runtimeDefaults = {
    firebase: clone(settings.firebase || {}),
    workers: clone(settings.workers || {}),
    brand: clone(settings.brand || {})
  };

  global.__SITE_SETTINGS__ = settings;
  global.__SITE_CORE_DEFAULT_RUNTIME__ = runtimeDefaults;
  global.__FIREBASE_RUNTIME_CONFIG__ = clone(settings.firebase || {});
  global.__FIREBASE_CONFIG__ = clone(settings.firebase || {});
  global.__SITE_FIREBASE_HELPER_ORIGIN__ = getByPath(settings, "auth.firebaseHelperOrigin", "");
  global.__SITE_GOOGLE_REDIRECT_ORIGIN__ = getByPath(settings, "auth.googleRedirectOrigin", "");
  global.__SITE_GOOGLE_REDIRECT_URI__ = getByPath(settings, "auth.googleRedirectUri", "");
  global.__SITE_ICON__ = "";
  global.__SITE_SHARE_PREVIEW__ = "";

  global.__getSiteSettings = function () {
    return clone(settings);
  };

  global.__getSiteSetting = function (path, fallback) {
    return getByPath(settings, path, fallback);
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
`;
}

const settings = buildSiteSettings(identity, SOURCE === "file" ? {} : process.env);
const siteSettingsJs = renderSiteSettings(settings);
// index.html loads site_settings.js with a ?v= cache key. It used to be a frozen
// string, so a browser that had cached the file kept the PREVIOUS store's
// Firebase project and router base for as long as the cache lived. Key it to the
// content instead, exactly like build-frontend.mjs does for the bundles.
const SETTINGS_VERSION = createHash("sha256").update(siteSettingsJs, "utf8").digest("hex").slice(0, 10);
// Generated assets live in src-frontend/dist, not the repo root — see
// scripts/build-frontend.mjs. Only hand-written files stay at the top level.
const DIST_DIR = join("src-frontend", "dist");
emitNew(join(DIST_DIR, "site_settings.js"), siteSettingsJs);
emitNew(join("__", "firebase", "init.json"), `${JSON.stringify(identity.firebase, null, 2)}\n`);

// ---------------------------------------------------------------------------
// index.html — two marked regions; the rest of the head stays hand-written
// ---------------------------------------------------------------------------

// The storefront rewrites <meta name="theme-color"> at runtime from the admin's
// light/dark theme (src-frontend/header.js), so this is only the value the page
// carries before the bundle runs. It is a constant on purpose — a per-store
// identity field here would be dead config that the panel immediately overrides.
const INITIAL_THEME_COLOR = "#0C0C0C";

function renderHeadRegion() {
  const { brand, hosts, seo, turnstile, r2 } = identity;
  const site = hosts.siteOrigin;
  const title = escapeHtml(seo.title);
  const name = escapeHtml(brand.name);
  const lines = [
    `  <title>${title}</title>`,
    `  <meta name="application-name" content="${name}">`,
    `  <meta name="apple-mobile-web-app-title" content="${name}">`,
    `  <meta name="author" content="${name}">`,
    `  <meta name="theme-color" content="${INITIAL_THEME_COLOR}">`,
    `  <link rel="canonical" href="${escapeHtml(site)}/">`,
    `  <link rel="alternate" href="${escapeHtml(site)}/" hreflang="ar">`,
    `  <link rel="alternate" href="${escapeHtml(site)}/" hreflang="x-default">`
  ];
  if (turnstile.siteKey) {
    lines.push(`  <meta name="turnstile-sitekey" content="${escapeHtml(turnstile.siteKey)}">`);
  }
  lines.push(
    "",
    `  <meta name="description" content="${escapeHtml(seo.description)}">`,
    `  <meta name="keywords" content="${escapeHtml(seo.keywords.join(", "))}">`,
    "",
    `  <meta property="og:url" content="${escapeHtml(site)}/">`,
    `  <meta property="og:title" content="${title}">`,
    `  <meta property="og:description" content="${escapeHtml(seo.shortDescription)}">`,
    `  <meta property="og:image:alt" content="${name}">`,
    `  <meta property="og:site_name" content="${title}">`,
    `  <meta name="twitter:title" content="${title}">`,
    `  <meta name="twitter:description" content="${escapeHtml(seo.shortDescription)}">`,
    `  <meta name="twitter:image:alt" content="${name}">`
  );
  if (r2.publicUrl) {
    lines.push(
      "",
      `  <!-- This store's R2 bucket — it serves every logo/banner/product image (the LCP). -->`,
      `  <link rel="preconnect" href="${escapeHtml(r2.publicUrl)}" crossorigin>`
    );
  }
  return lines.join("\n");
}

function renderJsonLdRegion() {
  const { brand, hosts } = identity;
  const site = `${hosts.siteOrigin}/`;
  const block = (id, data) =>
    `  <script id="${id}" type="application/ld+json">\n` +
    `${JSON.stringify(data, null, 2).split("\n").map((l) => `  ${l}`).join("\n")}\n` +
    `  </script>`;

  return [
    block("siteWebJsonLd", {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: brand.name,
      url: site,
      inLanguage: "ar",
      potentialAction: {
        "@type": "SearchAction",
        target: `${site}#/?q={search_term_string}`,
        "query-input": "required name=search_term_string"
      }
    }),
    block("siteOrgJsonLd", {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: brand.name,
      url: site
    }),
    block("siteNavigationJsonLd", {
      "@context": "https://schema.org",
      "@type": "SiteNavigationElement",
      name: ["الرئيسية", "تسجيل الدخول", "الطلبات", "المحفظة"],
      url: [site, `${site}#/login`, `${site}#/orders`, `${site}#/wallet`]
    })
  ].join("\n");
}

emit("index.html", (html) => {
  let out = replaceRegion(html, "head", renderHeadRegion(), HTML_REGION);
  out = replaceRegion(out, "jsonld", renderJsonLdRegion(), HTML_REGION);
  out = out.replace(/site_settings\.js\?v=[^"']*/g, `site_settings.js?v=${SETTINGS_VERSION}`);
  return out;
});

// ---------------------------------------------------------------------------
// manifest.webmanifest — patch the brand fields, keep everything else
// ---------------------------------------------------------------------------

emit("manifest.webmanifest", (text) => {
  const manifest = JSON.parse(text);
  manifest.name = identity.seo.title;
  manifest.short_name = identity.brand.shortName;
  manifest.theme_color = INITIAL_THEME_COLOR;
  manifest.background_color = INITIAL_THEME_COLOR;
  return `${JSON.stringify(manifest, null, 2)}\n`;
});

// ---------------------------------------------------------------------------
// robots.txt / sitemap.xml — fully generated
// ---------------------------------------------------------------------------

const SITEMAP_ROUTES = [
  { path: "/", changefreq: "daily", priority: "1.0" },
  { path: "/reviews", changefreq: "weekly", priority: "0.5" },
  { path: "/privacy", changefreq: "yearly", priority: "0.3" },
  { path: "/terms", changefreq: "yearly", priority: "0.3" }
];

emitNew(
  "robots.txt",
  [
    "User-agent: *",
    "Allow: /",
    "",
    `Sitemap: ${identity.hosts.siteOrigin}/sitemap.xml`,
    `Host: ${identity.hosts.siteHost}`,
    ""
  ].join("\n")
);

emitNew(
  "sitemap.xml",
  [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...SITEMAP_ROUTES.map(
      (r) =>
        `  <url><loc>${identity.hosts.siteOrigin}${r.path}</loc>` +
        `<lastmod>${identity.seo.sitemapLastmod}</lastmod>` +
        `<changefreq>${r.changefreq}</changefreq>` +
        `<priority>${r.priority}</priority></url>`
    ),
    "</urlset>",
    ""
  ].join("\n")
);

// ---------------------------------------------------------------------------
// CNAME — the custom domain GitHub Pages serves this store from
// ---------------------------------------------------------------------------
//
// GENERATED rather than hand-written, because publishing replaces the repo's
// whole file tree: a CNAME that is not in the generated set simply vanishes on
// the next publish, and with it the custom domain — the store drops onto
// <owner>.github.io and every link, cookie and OAuth callback breaks at once.
//
// It carries the SITE host, not the zone: a store served from a subdomain must
// not claim the apex. An identity with no site origin yet emits nothing at all,
// since an EMPTY CNAME unsets the domain just as effectively as a missing one.
if (identity.hosts.siteHost) {
  emitNew("CNAME", `${identity.hosts.siteHost}\n`);
}

// ---------------------------------------------------------------------------
// web.config — the canonical-host redirect rule
// ---------------------------------------------------------------------------

emit("web.config", (xml) =>
  replaceRegion(
    xml,
    "canonical-host",
    identity.hosts.wwwCanonicalRedirect
      ? [
          `        <rule name="Force apex host" stopProcessing="true">`,
          `          <match url="(.*)" ignoreCase="true" />`,
          `          <conditions logicalGrouping="MatchAll">`,
          `            <add input="{HTTPS}" pattern="on" ignoreCase="true" />`,
          `            <add input="{HTTP_HOST}" pattern="^www\\.${escapeRegExp(identity.hosts.siteHost)}$" ignoreCase="true" />`,
          `          </conditions>`,
          `          <action type="Redirect" url="${escapeHtml(identity.hosts.siteOrigin)}/{R:1}" redirectType="Permanent" />`,
          `        </rule>`
        ].join("\n")
      : `        <!-- www canonical redirect disabled for this store. -->`,
    HTML_REGION
  )
);

// ---------------------------------------------------------------------------
// backend/wrangler.toml — repo-only (never rendered into frontend-dist)
// ---------------------------------------------------------------------------

if (!STATIC_ONLY) {
  // A store published as a static site carries no `backend/` at all — the
  // Worker lives elsewhere, and its absence is normal, not an error. But a
  // `backend/` that EXISTS without its wrangler.toml is a broken checkout, and
  // that must still stop the run rather than quietly leave a Worker unstamped.
  const hasBackendDir = existsSync(join(OUT_DIR, "backend"));

  emit(
    join("backend", "wrangler.toml"),
    (toml) => {
      const { cloudflare, hosts, email } = identity;
      let out = replaceRegion(toml, "worker", `name = "${cloudflare.workerName}"`, TOML_REGION);
      out = replaceRegion(
        out,
        "email-sender",
        [
          "send_email = [",
          `  { name = "EMAIL", allowed_sender_addresses = ["${email.notificationsFrom}"] }`,
          "]"
        ].join("\n"),
        TOML_REGION
      );
      out = replaceRegion(
        out,
        "routes",
        [
          "routes = [",
          `  { pattern = "${hostWithPort(hosts.adminOrigin)}", zone_name = "${hosts.zoneName}", custom_domain = true },`,
          `  { pattern = "${hostWithPort(hosts.apiOrigin)}", zone_name = "${hosts.zoneName}", custom_domain = true }`,
          "]"
        ].join("\n"),
        TOML_REGION
      );
      out = replaceRegion(
        out,
        "d1",
        [
          `database_name = "${cloudflare.d1DatabaseName}"`,
          `database_id = "${cloudflare.d1DatabaseId}"`
        ].join("\n"),
        TOML_REGION
      );
      const { r2, sms } = identity;
      // CRITICAL with `keep_vars = true`: a var that is ABSENT from this file
      // keeps whatever is set in the Cloudflare dashboard, but a var written as
      // `KEY = ""` OVERWRITES it with an empty string on the next deploy. An
      // unfilled identity field must therefore emit nothing at all — otherwise
      // generating this file would silently break a store whose value only ever
      // lived in the dashboard.
      const vars = [];
      const put = (key, value, comment = null) => {
        const text = String(value == null ? "" : value).trim();
        if (!text) {
          vars.push(`# ${key} — not set in store.identity.json; the dashboard value (if any) is kept.`);
          return;
        }
        if (comment) vars.push(...comment);
        vars.push(`${key} = "${text}"`);
      };

      put("SITE_ORIGIN", hosts.siteOrigin);
      put("API_ORIGIN", hosts.apiOrigin);
      put("ADMIN_ORIGIN", hosts.adminOrigin);
      put("NOTIFY_FROM_EMAIL", email.notificationsFrom);
      put("NOTIFY_FROM_NAME", email.notificationsFromName);
      put("SMS_WEBHOOK_URL", hosts.apiOrigin ? `${hosts.apiOrigin}/sms/webhook` : "");
      put("SMS_SITE_ID", cloudflare.workerName);
      put("SMS_GATEWAY_DIRECTORY_URL", sms.directoryUrl);
      vars.push(
        "",
        "# This store's short identifier, from the PWA short name. The Worker",
        "# derives its session cookie, its contact-encryption key and its catalog",
        "# export format from it (src/core/store-slug.js), so each store owns its",
        "# own — no store shares another's cookie or key.",
        "#",
        "# LEGACY_STORE_SLUGS lists the slugs this store used BEFORE. Reads still",
        "# accept them, which is what keeps a rename from signing everyone out and",
        "# from orphaning already-encrypted contacts. Clear it once every session",
        "# has rolled over and every stored contact has been written again."
      );
      put("STORE_SLUG", identity.storeSlug);
      put("LEGACY_STORE_SLUGS", (identity.legacyStoreSlugs || []).join(","));
      vars.push(
        "",
        "# R2 image storage. The two CREDENTIALS (R2_ACCESS_KEY_ID and",
        "# R2_SECRET_ACCESS_KEY) are NOT here and never will be — this file is",
        "# committed. Set them per store with `wrangler secret put`."
      );
      put("R2_BUCKET_NAME", r2.bucketName);
      put("R2_PUBLIC_URL", r2.publicUrl);
      put("R2_ACCOUNT_ID", r2.accountId);

      out = replaceRegion(out, "vars", vars.join("\n"), TOML_REGION);
      return out;
    },
    { optional: !hasBackendDir }
  );
}

function hostWithPort(origin) {
  try {
    return new URL(origin).host;
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// write / check
// ---------------------------------------------------------------------------

let drift = 0;
for (const item of results) {
  if (CHECK) {
    if (item.changed) drift += 1;
    console.log(`${item.changed ? "DRIFT" : "ok   "} ${item.relPath}`);
    continue;
  }
  if (!item.changed) {
    console.log(`ok    ${item.relPath} [unchanged]`);
    continue;
  }
  mkdirSync(dirname(item.dest), { recursive: true });
  writeFileSync(item.dest, item.hadCrlf ? item.next.replace(/\n/g, "\r\n") : item.next, "utf8");
  console.log(`wrote ${item.relPath}`);
}

if (CHECK && drift) {
  console.error(
    `\napply-store-identity: ${drift} file(s) do not match the store identity` +
    `${SOURCE === "file" ? " in store.identity.json" : " resolved from the environment"}.\n` +
    `Run \`npm run identity\` and commit the result.`
  );
  process.exit(1);
}

console.log(
  `\nstore identity applied: ${identity.brand.name} — ${identity.hosts.siteOrigin} ` +
  `(api ${identity.hosts.apiOrigin}, firebase ${identity.firebase.projectId})`
);
