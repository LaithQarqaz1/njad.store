#!/usr/bin/env node
// scripts/check-placeholders.mjs
//
// THE SECOND GATE. The template ships PLACEHOLDERS, not a real store: the repo
// says `Store###Name` and `https://store-domain.invalid` everywhere the
// generator writes. That makes every identity-controlled string visible at a
// glance — but it also means a store that never received its real values would
// go live literally calling itself "Store###Name".
//
// So this refuses to let a placeholder survive into a rendered store. Run it
// AFTER the identity has been applied:
//
//   node scripts/check-placeholders.mjs              scan the repo, exit 1 on any hit
//   node scripts/check-placeholders.mjs --dir DIR    scan a built/published tree
//   node scripts/check-placeholders.mjs --list       report only, always exit 0
//
// It is deliberately NOT part of `npm run check:identity`: in the TEMPLATE the
// placeholders are correct and expected. It runs where a real store is produced
// — the desktop manager's sync, and CI after applying the repository variables.
//
// The strings come from the schema, so a placeholder that uses `.invalid`
// instead of `###` (because the value is parsed as a URL, where `#` would start
// a fragment) is caught just the same.

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { ROOT, SCHEMA } from "./store-identity.mjs";

const argv = process.argv.slice(2);
const LIST_ONLY = argv.includes("--list");
const dirArg = argv.find((a) => a.startsWith("--dir="));
const SCAN_ROOT = dirArg ? resolve(dirArg.slice("--dir=".length)) : ROOT;

// Files that necessarily SPELL the placeholders: the two that define them, and
// the scripts/docs that explain the convention. Scanning these would report the
// definition itself as an unconfigured value.
const SOURCE_FILES = new Set([
  "store.identity.json",
  "store.identity.schema.json",
  "scripts/check-placeholders.mjs",
  "STORE_SETUP.md"
]);

const IGNORED_PREFIXES = ["node_modules/", "test-results/", ".git/", "frontend-dist/"];
const BINARY_EXT = /\.(png|jpe?g|gif|webp|ico|woff2?|ttf|eot|pdf|zip|jar|apk|keystore|so|dll|exe|mp3|mp4)$/i;

/** Every placeholder the schema declares, longest first so the report names the
 *  most specific one rather than a fragment of it. */
export function collectPlaceholders(schema = SCHEMA) {
  const out = new Set();
  const add = (value) => {
    const text = String(value == null ? "" : value).trim();
    if (text.length < 8) return;
    // Two recognisable shapes:
    //   * the markers — ###, the reserved .invalid TLD, the word "placeholder";
    //   * a STRUCTURED all-zero value, for fields whose format is fixed and
    //     cannot carry a marker (wrangler rejects a D1 id that is not a UUID).
    //
    // The zero run must sit inside a separated structure ("-" or ":"). A bare
    // digit run like a zeroed sender id is NOT searchable: it is a substring of
    // unrelated ids and flagged an ordinary test fixture. A bare date is
    // excluded for the same reason.
    if (/###|\.invalid|placeholder/i.test(text) || (/0{6,}/.test(text) && /[-:]/.test(text))) {
      out.add(text);
    }
  };

  for (const field of schema.fields || []) {
    const ph = field.placeholder;
    if (!ph) continue;
    if (typeof ph === "object") {
      for (const value of Object.values(ph)) add(value);
      continue;
    }
    // A list placeholder is stored as CSV; each item is searched on its own.
    if (field.type === "list") {
      for (const item of String(ph).split(",")) add(item);
      continue;
    }
    add(ph);
  }
  return [...out].sort((a, b) => b.length - a.length);
}

function scannedFiles(root) {
  // Inside a git repo, ask git — it skips node_modules and build caches for free.
  try {
    const out = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024
    });
    const files = out.split("\0").filter(Boolean);
    if (files.length) return files;
  } catch {}

  const found = [];
  const walk = (rel) => {
    for (const entry of readdirSync(join(root, rel) || root, { withFileTypes: true })) {
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

function readText(absPath) {
  try {
    if (statSync(absPath).size > 32 * 1024 * 1024) return null;
    const buf = readFileSync(absPath);
    if (buf.subarray(0, 1024).includes(0)) return null;
    return buf.toString("utf8");
  } catch {
    return null;
  }
}

function main() {
  const placeholders = collectPlaceholders();
  if (!placeholders.length) {
    console.warn("check-placeholders: ⚠ the schema declares no placeholders — nothing was verified.");
    return 0;
  }
  if (!existsSync(SCAN_ROOT)) {
    console.error(`check-placeholders: no such directory: ${SCAN_ROOT}`);
    return 1;
  }

  const findings = [];
  let scanned = 0;

  for (const relPath of scannedFiles(SCAN_ROOT)) {
    const normalized = relPath.split(sep).join("/");
    if (SOURCE_FILES.has(normalized)) continue;
    if (IGNORED_PREFIXES.some((p) => normalized.startsWith(p))) continue;
    if (BINARY_EXT.test(normalized)) continue;

    const abs = join(SCAN_ROOT, normalized);
    if (!existsSync(abs)) continue;
    const text = readText(abs);
    if (text === null) continue;
    scanned += 1;

    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i += 1) {
      const hit = placeholders.find((p) => lines[i].includes(p));
      if (hit) findings.push({ file: normalized, line: i + 1, placeholder: hit, text: lines[i].trim().slice(0, 140) });
    }
  }

  console.log(
    `check-placeholders: scanned ${scanned} file(s) in ${SCAN_ROOT} for ` +
    `${placeholders.length} placeholder(s).`
  );

  if (!findings.length) {
    console.log("\nNo placeholders left. Every identity value was filled in for this store.");
    return 0;
  }

  const byFile = new Map();
  for (const f of findings) {
    if (!byFile.has(f.file)) byFile.set(f.file, []);
    byFile.get(f.file).push(f);
  }

  console.error(`\n${findings.length} placeholder(s) still present — this store has NOT been configured:\n`);
  for (const [file, hits] of byFile) {
    console.error(`  ${file}  (${hits.length})`);
    for (const hit of hits.slice(0, 6)) {
      console.error(`    ${String(hit.line).padStart(6)}: ${hit.text}`);
    }
    if (hits.length > 6) console.error(`    ... and ${hits.length - 6} more`);
  }

  const missing = [...new Set(findings.map((f) => f.placeholder))];
  console.error(
    `\nUnfilled values: ${missing.join(", ")}\n` +
    `Fill them in the store's identity (the desktop manager's form, or the\n` +
    `repository variables in Settings → Secrets and variables → Actions), then\n` +
    `run \`npm run identity\` again. See STORE_SETUP.md.`
  );

  return LIST_ONLY ? 0 : 1;
}

const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) process.exit(main());
