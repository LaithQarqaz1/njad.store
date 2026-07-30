#!/usr/bin/env node
// scripts/check-brand-leaks.mjs
//
// THE GATE. This template is deployed as several different stores, and the
// recurring failure is a brand token left behind in a file the generator does
// not own: you search the project, replace the name, and it still turns up
// somewhere — a comment, a test fixture, a package name, a default fallback.
//
// This script hunts every token of the CURRENT store's identity (plus any
// `retiredBrandTokens`, i.e. the brands this repo was copied from) and fails the
// build when one appears OUTSIDE:
//   - store.identity.json itself (the source)
//   - the files apply-store-identity.mjs generates
//   - the explicit allowlist below, each entry with a reason
//
//   node scripts/check-brand-leaks.mjs            report + exit 1 on any leak
//   node scripts/check-brand-leaks.mjs --list     report only, always exit 0
//
// Scope: files tracked by git (so node_modules, build caches and untracked
// scratch files are never scanned). Outside a repo — a freshly generated store
// folder — it walks the disk instead, skipping .git and node_modules.

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { ROOT, resolveIdentity } from "./store-identity.mjs";

const LIST_ONLY = process.argv.includes("--list");

// ---------------------------------------------------------------------------
// what the generator owns — a token here is correct, not a leak
// ---------------------------------------------------------------------------
const GENERATED_FILES = new Set([
  "store.identity.json",
  "src-frontend/dist/site_settings.js",
  "__/firebase/init.json",
  "index.html",
  "manifest.webmanifest",
  "robots.txt",
  "sitemap.xml",
  "web.config",
  // The Pages custom domain. It IS the store's hostname spelled out, so it can
  // only ever be generated — see apply-store-identity.mjs.
  "CNAME",
  "backend/wrangler.toml",
  // Build outputs of src-frontend/ — they inherit whatever the sources hold, and
  // the sources are scanned. Flagging both would double every finding.
  "src-frontend/dist/site-bundle.js",
  "src-frontend/dist/site-bundle.css",
  "src-frontend/dist/chunk-login.js",
  "src-frontend/dist/chunk-wallet.js",
  "src-frontend/dist/chunk-orders.js",
  "src-frontend/dist/chunk-reviews.js",
  "src-frontend/dist/chunk-deposit.js",
  "src-frontend/dist/chunk-support.js",
  "src-frontend/dist/chunk-account.js",
  "src-frontend/dist/chunk-accounts.js",
  // Compiled admin-panel bundles (generated from src/admin-panel).
  "backend/admin-panel-dist.js",
  "backend/admin-developer-dist.js"
]);

const IGNORED_PREFIXES = [
  "node_modules/",
  "test-results/",
  "vendor/",
  ".tools/"
];

const IGNORED_SUFFIXES = [
  "package-lock.json",
  // Local scratch/repro files: they routinely embed the absolute repo path,
  // which contains the store name because the FOLDER is named after it.
  ".tmp.mjs",
  ".tmp.js"
];

// Historical records of work done ON this specific store (debugging logs,
// security write-ups, migration notes). Rewriting the hostnames inside them
// would falsify the record, so they are skipped — but they should be DELETED,
// not carried over, when this repo is copied to a new store.
const HISTORICAL_DOCS = new Set([
  "backend/خطة_اصلاح_الكاتلوج.md",
  // Records the cutover as it happened, naming the cookie by the name it had at
  // the time. That name is derived from STORE_SLUG now; renaming it here would
  // describe a past event with a value that did not exist then.
  "backend/CATALOG_ROWS_CUTOVER.md",
  "FINAL_SECURITY_REPORT.md",
  "ADVERSARIAL_REVIEW.md",
  "SECURITY_REMEDIATION.md",
  "V1-VERIFICATION.md"
]);

// This file IS the allowlist registry: it necessarily spells out the tokens it
// permits. Scanning it would report every entry as a leak.
const SELF = "scripts/check-brand-leaks.mjs";

// ---------------------------------------------------------------------------
// allowlist — every entry needs a reason, and stale entries are reported
// ---------------------------------------------------------------------------
//
// INTENTIONALLY EMPTY as of 2026-07-28.
//
// It used to hold the identifiers that spelled one store's brand but were not
// configuration — the session cookie, the contact-encryption KDF label and salt,
// and the catalog export format. Each is a key that EXISTING DATA sits under, so
// they could not simply be renamed.
//
// They are now derived from the store's PWA short name (STORE_SLUG) in
// backend/src/core/store-slug.js, and reads still accept the previous slug
// (LEGACY_STORE_SLUGS) — so nobody was signed out and no ciphertext was orphaned.
//
// Add an entry here only for an identifier that genuinely CANNOT be renamed, and
// always with the reason. The script reports entries that match nothing, so a
// stale exemption cannot quietly widen the gate.
const ALLOWED_PATTERNS = [];

// RENAMED 2026-07-28 and no longer needing an exemption: the admin-panel
// localStorage keys (store-admin-*), the Developer section's global mount
// function and UMD name, the npm package names, and the deposit CustomEvent.
// All were internal identifiers with no stored data behind them, so they were
// simply renamed to `store-*` rather than kept on this list.

// ---------------------------------------------------------------------------

// Tracked files PLUS new untracked ones that are not gitignored. A brand-new
// file is exactly where a fresh hardcoded name lands, and it would sail past a
// tracked-only scan until after it was committed.
function trackedFiles() {
  // Inside a repo, ask git: it skips node_modules and build caches for free.
  try {
    const out = execFileSync(
      "git",
      ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
      // stderr ignored on purpose: outside a repo git prints a fatal, and that
      // is not a failure here — it is the signal to walk the disk instead.
      { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] }
    );
    const files = out.split("\0").filter(Boolean);
    if (files.length) return Array.from(new Set(files));
  } catch {
    // fall through to the walk
  }

  // A store folder generated by the desktop manager is NOT a repo until the
  // operator runs `git init`. The gate has to run there too: that copy is
  // precisely what gets published, and skipping it is how another store's name
  // would reach a live site.
  const found = [];
  const walk = (rel) => {
    for (const entry of readdirSync(rel ? join(ROOT, rel) : ROOT, { withFileTypes: true })) {
      const next = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (entry.name === ".git" || entry.name === "node_modules") continue;
        walk(next);
      } else if (entry.isFile()) {
        found.push(next);
      }
    }
  };
  walk("");
  return found;
}

function isScanned(relPath) {
  const normalized = relPath.split(sep).join("/");
  if (normalized === SELF) return false;
  if (GENERATED_FILES.has(normalized)) return false;
  if (HISTORICAL_DOCS.has(normalized)) return false;
  if (IGNORED_PREFIXES.some((p) => normalized.startsWith(p))) return false;
  if (IGNORED_SUFFIXES.some((s) => normalized.endsWith(s))) return false;
  return true;
}

const BINARY_EXT = /\.(png|jpe?g|gif|webp|ico|woff2?|ttf|eot|pdf|zip|jar|apk|keystore|so|dll|exe|mp3|mp4)$/i;

function readText(absPath) {
  try {
    const buf = readFileSync(absPath);
    // A NUL byte in the first KB means binary; skip rather than emit noise.
    if (buf.subarray(0, 1024).includes(0)) return null;
    return buf.toString("utf8");
  } catch {
    return null;
  }
}

/** Blank out every allowed span so the token search cannot see it, while
 *  preserving offsets (and newlines) so reported line numbers stay correct. */
function maskAllowed(text, usedReasons) {
  let masked = text;
  for (const entry of ALLOWED_PATTERNS) {
    masked = masked.replace(entry.pattern, (match) => {
      usedReasons.add(entry.reason);
      return " ".repeat(match.length);
    });
  }
  return masked;
}

/**
 * Match brand tokens at IDENTIFIER BOUNDARIES, not as bare substrings.
 *
 * A raw substring search is unusable here: a store called "Sahm" matched inside
 * `i(sAhm)inix`, and a three-letter Arabic brand matched inside ordinary Arabic
 * words. So a hit must not be glued to a letter or digit on the left, nor
 * continue into a lowercase letter on the right — while `acmeStore` (camelCase)
 * and `acme.store` still match.
 *
 * A brand whose token IS a common word (a dictionary noun, a name that appears
 * in a dependency) will still collide; that is what `ignoreBrandTokens` in
 * store.identity.json is for, and emptying the token list now warns loudly.
 */
export function makeTokenMatcher(tokens) {
  // Longest first, so `acmestore` wins over `acme` at the same position.
  const ordered = [...tokens].sort((a, b) => b.length - a.length);
  const re = new RegExp(ordered.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "gi");

  // Boundary tests live OUTSIDE the regex on purpose: with the /i flag a
  // character class is case-folded, so an in-pattern `(?![a-z])` lookahead also
  // rejects uppercase — which silently made `acmeStore` invisible.
  const gluedBefore = (ch) => !!ch && /[A-Za-z0-9_؀-ۿ]/.test(ch);
  const continuesAfter = (ch) => !!ch && /[a-z0-9؀-ۿ]/.test(ch);

  return {
    test(text) {
      const source = String(text || "");
      re.lastIndex = 0;
      let match;
      while ((match = re.exec(source)) !== null) {
        if (match[0].length === 0) { re.lastIndex += 1; continue; }
        const before = source[match.index - 1];
        const after = source[match.index + match[0].length];
        if (gluedBefore(before)) continue;
        if (continuesAfter(after)) continue;
        return true;
      }
      return false;
    }
  };
}

function main() {
  const identity = resolveIdentity({ source: "file", strict: false });
  const tokens = Array.from(
    new Set(
      [...identity.brandTokens, ...identity.retiredBrandTokens]
        .map((t) => String(t || "").trim().toLowerCase())
        .filter((t) => t.length >= 3)
    )
  ).sort((a, b) => b.length - a.length);

  if (!tokens.length) {
    // Not an error (a store may genuinely have no distinctive token), but a
    // SILENT pass here looks identical to a real one — and the usual cause is
    // an over-broad ignoreBrandTokens that switched the gate off by accident.
    console.warn(
      "check-brand-leaks: ⚠ NO brand tokens to search for — this check did nothing.\n" +
      "  Every derived token was filtered out by ignoreBrandTokens, or the identity\n" +
      "  has no brand name / domain yet. Nothing was verified."
    );
    return 0;
  }

  const matcher = makeTokenMatcher(tokens);

  const findings = [];
  const usedReasons = new Set();
  let scanned = 0;

  for (const relPath of trackedFiles()) {
    if (!isScanned(relPath)) continue;
    const abs = join(ROOT, relPath);
    if (!existsSync(abs) || BINARY_EXT.test(relPath)) continue;

    const normalized = relPath.split(sep).join("/");
    // A brand token in the PATH itself is a leak the content scan cannot see.
    if (matcher.test(normalized)) {
      findings.push({ file: normalized, line: 0, text: "(brand token in the file NAME)" });
    }

    const text = readText(abs);
    if (text === null) continue;
    scanned += 1;

    const masked = maskAllowed(text, usedReasons);
    const lines = masked.split("\n");
    const rawLines = text.split("\n");
    for (let i = 0; i < lines.length; i += 1) {
      if (!matcher.test(lines[i])) continue;
      findings.push({ file: normalized, line: i + 1, text: rawLines[i].trim().slice(0, 160) });
    }
  }

  console.log(
    `check-brand-leaks: scanned ${scanned} tracked file(s) for ${tokens.length} brand token(s): ${tokens.join(", ")}`
  );

  const staleAllowances = ALLOWED_PATTERNS.filter((e) => !usedReasons.has(e.reason));
  if (staleAllowances.length) {
    console.log(`\n${staleAllowances.length} allowlist entr(ies) matched nothing and can be deleted:`);
    for (const entry of staleAllowances) console.log(`  - ${entry.pattern}`);
  }

  if (!findings.length) {
    console.log("\nNo brand leaks. Every brand-specific value comes from store.identity.json.");
    return 0;
  }

  console.log(`\n${findings.length} brand leak(s) — these will follow this repo into the NEXT store:\n`);
  const byFile = new Map();
  for (const f of findings) {
    if (!byFile.has(f.file)) byFile.set(f.file, []);
    byFile.get(f.file).push(f);
  }
  for (const [file, items] of [...byFile].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`  ${file}  (${items.length})`);
    for (const item of items.slice(0, 6)) {
      console.log(`    ${String(item.line).padStart(6)}: ${item.text}`);
    }
    if (items.length > 6) console.log(`    ... and ${items.length - 6} more`);
  }

  console.log(
    `\nFix each one by reading the value from the store identity instead:\n` +
    `  frontend  window.__getSiteSetting("brand.storeName" | "seo.siteOrigin" | ...)\n` +
    `  backend   env.SITE_ORIGIN / env.NOTIFY_FROM_EMAIL / env.SMS_SITE_ID (wrangler.toml [vars])\n` +
    `  scripts   resolveIdentity() from scripts/store-identity.mjs\n` +
    `If a hit is an internal identifier that CANNOT be renamed safely, add it to\n` +
    `ALLOWED_PATTERNS in this file WITH the reason it cannot change.`
  );
  return LIST_ONLY ? 0 : 1;
}

// Only scan when invoked as a command — importing this file (for tests, or to
// reuse buildTokenRegex) must not exit the process.
const invokedDirectly = process.argv[1]
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) process.exit(main());
