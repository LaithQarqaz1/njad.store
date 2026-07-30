#!/usr/bin/env node
// Parity check between site-bundle.js (the LIVE concatenated bundle index.html
// loads) and its per-section source files. The bundle is split on the
// `/* Source: <file> */` banner lines it already carries.
//
//   node scripts/check-bundle-parity.mjs                 report per-section drift
//   node scripts/check-bundle-parity.mjs --extract-missing
//       write the sections that have NO standalone source file yet
//       (site-startup/site-core/qr-code-styling/site-qr/reviews-inline)
//       into src-frontend/, verbatim.
//   node scripts/check-bundle-parity.mjs --dump <section> <outfile>
//       write one section's bundle content to a file (for manual diffing).
//
// Exit code 0 = every section byte-matches its source (ignoring CRLF/LF and
// trailing whitespace-only edge lines); 1 = drift somewhere.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BUNDLE = join(ROOT, "site-bundle.js");

// Sections that exist ONLY inside the bundle live in src-frontend/ once extracted.
const BUNDLE_ONLY = new Set([
  "site-startup.js", "site-core.js", "qr-code-styling.js", "site-qr.js", "reviews-inline.js"
]);

// CANONICAL SOURCE POLICY (2026-07-18): src-frontend/ holds the build inputs for
// EVERY section, extracted byte-exact from the LIVE bundle. The root standalone
// files (header.js, wallet-inline.js, ...) had bidirectional drift against the
// live bundle (patches that only hit the bundle + source-side work that never
// shipped) — they are kept as reference but are NOT build inputs. Reconcile them
// deliberately, never blindly.
const SRC_NAME = (name) => name.startsWith("vendor/")
  ? "vendor-" + name.split("/").pop()
  : name;

function sourcePathFor(name) {
  return join(ROOT, "src-frontend", SRC_NAME(name));
}

function splitBundleSections(text) {
  const re = /^\/\* Source: (.+?) \*\/\r?\n/gm;
  const banners = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    banners.push({ name: m[1].trim(), bodyStart: m.index + m[0].length, bannerStart: m.index });
  }
  const sections = [];
  for (let i = 0; i < banners.length; i += 1) {
    const end = i + 1 < banners.length ? banners[i + 1].bannerStart : text.length;
    sections.push({ name: banners[i].name, content: text.slice(banners[i].bodyStart, end) });
  }
  return sections;
}

const norm = (s) => String(s).replace(/\r\n/g, "\n").replace(/\n+$/, "") + "\n";

const bundleText = readFileSync(BUNDLE, "utf8");
const sections = splitBundleSections(bundleText);
const mode = process.argv[2] || "";

if (mode === "--dump") {
  const wanted = String(process.argv[3] || "");
  const out = String(process.argv[4] || "");
  const sec = sections.find((s) => s.name === wanted);
  if (!sec || !out) { console.error("usage: --dump <sectionName> <outfile>"); process.exit(1); }
  writeFileSync(out, sec.content);
  console.log(`dumped ${wanted} (${sec.content.length} chars) -> ${out}`);
  process.exit(0);
}

if (mode === "--extract-missing" || mode === "--extract-all") {
  mkdirSync(join(ROOT, "src-frontend"), { recursive: true });
  for (const sec of sections) {
    if (mode === "--extract-missing" && !BUNDLE_ONLY.has(sec.name)) continue;
    const dest = sourcePathFor(sec.name);
    if (existsSync(dest)) { console.log(`skip (exists): ${dest}`); continue; }
    writeFileSync(dest, sec.content);
    console.log(`extracted ${sec.name} (${sec.content.length} chars) -> ${dest}`);
  }
  process.exit(0);
}

let drift = 0;
for (const sec of sections) {
  const srcPath = sourcePathFor(sec.name);
  if (!existsSync(srcPath)) {
    console.log(`MISSING SOURCE  ${sec.name}  (run --extract-missing for bundle-only sections)`);
    drift += 1;
    continue;
  }
  const src = readFileSync(srcPath, "utf8");
  if (norm(src) === norm(sec.content)) {
    console.log(`ok              ${sec.name}`);
  } else {
    const a = norm(sec.content).split("\n");
    const b = norm(src).split("\n");
    const setA = new Set(a);
    const setB = new Set(b);
    const onlyBundle = a.filter((l) => !setB.has(l)).length;
    const onlySource = b.filter((l) => !setA.has(l)).length;
    console.log(`DRIFT           ${sec.name}  bundle-only-lines=${onlyBundle}  source-only-lines=${onlySource}`);
    drift += 1;
  }
}
process.exit(drift ? 1 : 0);
