#!/usr/bin/env node
// Deterministic storefront build: generates the LOADED artifacts from the
// canonical sources in src-frontend/.
//
//   node scripts/build-frontend.mjs           build + write outputs + rewrite index.html ?v=
//   node scripts/build-frontend.mjs --check   rebuild in memory, exit 1 if any committed
//                                             output differs (CI drift gate; no writes)
//
// Outputs (repo root, committed):
//   site-bundle.js   CORE: site-startup + site-core + site-inline-app + header + otp-form
//   chunk-login.js   intl-tel-input vendor + login-inline      (route: login)
//   chunk-wallet.js  wallet-inline                             (routes: wallet/transfer/dafaati)
//   chunk-orders.js  calendar-inline (the orders page)         (route: orders)
//   chunk-reviews.js qr-code-styling + site-qr + reviews-inline (routes: reviews/security/invite/referrals/dafaati)
//   site-bundle.css  minified from src-frontend/site-bundle.css
//
// Everything is a CLASSIC script in ONE shared global scope, so:
//   - esbuild runs in transform mode per section with minifyIdentifiers OFF
//     (renaming would break bare cross-section references), whitespace+syntax on;
//   - sections are joined with the original `/* Source: name */` banners and a
//     defensive `;` separator;
//   - chunk loading order is enforced at runtime by __loadRouteChunk (awaited in
//     loadInline) — the core injects window.__CHUNK_MANIFEST__ so chunk URLs are
//     version-locked to this exact build.
// The output is DETERMINISTIC (no timestamps) so CI can rebuild + byte-compare.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
// Sources are normalized to LF before transforming so the output hash is
// identical regardless of git's checkout line endings (core.autocrlf).
const SRC = (f) => readFileSync(join(ROOT, "src-frontend", f), "utf8").replace(/\r\n/g, "\n");

// Where the generated assets live, and the URL prefix the page loads them from.
// Keeping them out of the repo root means a store folder shows only hand-written
// files at the top level — and the copy allowlist can ship one directory.
const DIST_DIR = join("src-frontend", "dist");
const DIST_URL = "src-frontend/dist/";
// Local Windows uses the vendored exe; CI installs esbuild@0.27.2 (same pinned
// version — esbuild output is deterministic across platforms per version).
// STORE_ESBUILD comes first for a store folder generated from this template:
// that copy carries no .tools/ and no node_modules, so without it every
// transform fails and the bundle ships VERBATIM — several times its real size,
// with only a warning to say so. The desktop manager points this at the
// template's own vendored binary.
const ESBUILD = [
  process.env.STORE_ESBUILD,
  join(ROOT, ".tools", "esbuild", "package", "esbuild.exe"),
  join(ROOT, "node_modules", ".bin", process.platform === "win32" ? "esbuild.cmd" : "esbuild")
].find((p) => p && existsSync(p)) || "esbuild";

// Section order MUST match the historical bundle order (cross-section top-level
// statements ran in this order for years — keep it).
const SECTIONS = [
  { name: "site-startup.js",   src: "site-startup.js",             chunk: "core" },
  { name: "site-core.js",      src: "site-core.js",                chunk: "core" },
  { name: "qr-code-styling.js", src: "qr-code-styling.js",         chunk: "reviews" },
  { name: "site-qr.js",        src: "site-qr.js",                  chunk: "reviews" },
  { name: "reviews-inline.js", src: "reviews-inline.js",           chunk: "reviews" },
  { name: "site-inline-app.js", src: "site-inline-app.js",         chunk: "core" },
  { name: "header.js",         src: "header.js",                   chunk: "core" },
  { name: "wallet-inline.js",  src: "wallet-inline.js",            chunk: "wallet" },
  { name: "calendar-inline.js", src: "calendar-inline.js",         chunk: "orders" },
  { name: "vendor/intl-tel-input/18.1.1/js/intlTelInput.min.js", src: "vendor-intlTelInput.min.js", chunk: "login" },
  { name: "vendor/intl-tel-input/18.1.1/js/utils.js",            src: "vendor-utils.js",            chunk: "login" },
  { name: "login-inline.js",   src: "login-inline.js",             chunk: "login" },
  { name: "otp-form.js",       src: "otp-form.js",                 chunk: "core" },
  // The whole deposit inline subsystem (route impl + countries/methods UI) plus
  // the app's base64 HTML (~190KB that minification can't shrink) ship only when
  // the deposit/edaa route opens; the router keeps a template fallback and
  // late-binds window.depositRoute (resolveDepositRouteImpl).
  { name: "deposit-inline.js",  src: "deposit-inline.js",          chunk: "deposit" },
  { name: "deposit-app-blob.js", src: "deposit-app-blob.js",       chunk: "deposit" },
  // Support chat subsystem — loaded on first interaction / idle (stub in header.js).
  { name: "support-chat.js",   src: "support-chat.js",             chunk: "support" },
  // Account-family route builders (settings/security/telegram/levels/api/transfer),
  // registered on window.__inlineRoutes; the router holds lazy thunks.
  { name: "route-account.js",  src: "route-account.js",            chunk: "account" },
  // Accounts marketplace («سوق الحسابات») storefront route, registered on
  // window.__inlineRoutes.accounts; loaded on first #/accounts navigation.
  { name: "route-accounts.js", src: "route-accounts.js",           chunk: "accountsmarket" },
  // «موقع رشق» storefront route (SMM services), registered on
  // window.__inlineRoutes.rashq; loaded on first #/rashq navigation.
  { name: "route-rashq.js",    src: "route-rashq.js",              chunk: "rashq" }
];

const CHUNK_FILES = {
  core: "site-bundle.js",
  login: "chunk-login.js",
  wallet: "chunk-wallet.js",
  orders: "chunk-orders.js",
  reviews: "chunk-reviews.js",
  deposit: "chunk-deposit.js",
  support: "chunk-support.js",
  account: "chunk-account.js",
  accountsmarket: "chunk-accounts.js",
  rashq: "chunk-rashq.js"
};

function esbuildTransform(source, loader) {
  const args = [
    `--loader=${loader}`,
    "--charset=utf8",
    "--minify-whitespace",
    "--minify-syntax",
    ...(loader === "js" ? ["--target=es2019"] : [])
  ];
  const run = spawnSync(ESBUILD, args, {
    input: Buffer.from(source, "utf8"),
    maxBuffer: 256 * 1024 * 1024
  });
  if (run.status !== 0) {
    const err = run.stderr ? run.stderr.toString("utf8") : "esbuild failed";
    throw new Error(err.slice(0, 2000));
  }
  return run.stdout.toString("utf8");
}

function minifySection(name, source) {
  try {
    return esbuildTransform(source, "js");
  } catch (err) {
    console.warn(`build-frontend: WARN — ${name} not minified (${String(err.message).split("\n")[0]}); emitted verbatim.`);
    return source;
  }
}

const shortHash = (text) => createHash("sha256").update(text, "utf8").digest("hex").slice(0, 10);

// 1) Minify every section once.
const minified = new Map();
for (const sec of SECTIONS) {
  minified.set(sec.name, minifySection(sec.name, SRC(sec.src)));
}

const joinSections = (names) =>
  names.map((n) => `/* Source: ${n} */\n${minified.get(n)}\n;`).join("\n");

// 2) Assemble the non-core chunks first (their hashes feed the core manifest).
const outputs = new Map(); // file -> content
const manifest = {};
for (const [chunk, file] of Object.entries(CHUNK_FILES)) {
  if (chunk === "core") continue;
  const names = SECTIONS.filter((s) => s.chunk === chunk).map((s) => s.name);
  const body = `/* Generated by scripts/build-frontend.mjs — DO NOT EDIT. Sources: src-frontend/ */\n${joinSections(names)}\n`;
  outputs.set(file, body);
  manifest[file] = shortHash(body);
}

// 3) Assemble the core with the chunk manifest injected up top.
{
  const names = SECTIONS.filter((s) => s.chunk === "core").map((s) => s.name);
  const preamble =
    `/* Generated by scripts/build-frontend.mjs — DO NOT EDIT. Sources: src-frontend/ */\n` +
    `window.__CHUNK_MANIFEST__=${JSON.stringify(manifest)};\n`;
  outputs.set(CHUNK_FILES.core, preamble + joinSections(names) + "\n");
}

// 4) CSS.
{
  const css = SRC("site-bundle.css");
  let out;
  try {
    out = esbuildTransform(css, "css");
  } catch (err) {
    console.warn(`build-frontend: WARN — CSS not minified (${String(err.message).split("\n")[0]}); emitted verbatim.`);
    out = css;
  }
  outputs.set("site-bundle.css", out);
}

// 5) index.html ?v= rewrite (core + css only; chunks are versioned via the manifest).
{
  const htmlPath = join(ROOT, "index.html");
  let html = readFileSync(htmlPath, "utf8").replace(/\r\n/g, "\n");
  const coreHash = shortHash(outputs.get(CHUNK_FILES.core));
  const cssHash = shortHash(outputs.get("site-bundle.css"));
  // Match the full href/src so the DIST_DIR prefix is preserved rather than
  // silently rewritten back to a bare filename.
  html = html.replace(/[\w./-]*site-bundle\.js\?v=[^"']*/g, `${DIST_URL}site-bundle.js?v=${coreHash}`);
  html = html.replace(/[\w./-]*site-bundle\.css\?v=[^"']*/g, `${DIST_URL}site-bundle.css?v=${cssHash}`);
  outputs.set("index.html", html);
}

// 6) Write or check.
const checkMode = process.argv.includes("--check");
let drift = 0;
for (const [file, content] of outputs) {
  // index.html stays at the site root: it is the Pages entry point and the
  // service worker's scope follows the page that registers it. Every generated
  // ASSET lives under src-frontend/dist, so the repo root holds no build output.
  const dest = file === "index.html" ? join(ROOT, file) : join(ROOT, DIST_DIR, file);
  const existing = existsSync(dest) ? readFileSync(dest, "utf8") : null;
  const same = existing !== null && existing === content;
  if (checkMode) {
    console.log(`${same ? "ok   " : "DRIFT"} ${file} (${content.length} chars)`);
    if (!same) drift += 1;
  } else {
    writeFileSync(dest, content);
    console.log(`wrote ${file} (${content.length} chars)${same ? " [unchanged]" : ""}`);
  }
}
if (checkMode && drift) {
  console.error(`build-frontend: ${drift} output(s) drifted — run \`node scripts/build-frontend.mjs\` and commit.`);
  process.exit(1);
}
