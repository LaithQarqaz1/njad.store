// scripts/store-identity.mjs
//
// Resolves THE store identity — every value that differs between the stores
// built from this template (brand names, hosts, Firebase project, Turnstile key,
// Cloudflare worker/D1 names, notification sender).
//
// RESOLUTION ORDER, highest wins:
//   1. environment variables  — GitHub Actions repository variables/secrets
//   2. FRONTEND_STORE_IDENTITY — one JSON blob carrying any subset of the tree
//   3. store.identity.json     — the committed per-store file
//   4. derived defaults        — e.g. adminOrigin = admin.<zone>
//   5. hard failure            — when strict (CI) and a required value is missing
//
// Nothing here writes files. The writers are:
//   scripts/apply-store-identity.mjs   static files + wrangler.toml + site_settings.js
//   scripts/check-brand-leaks.mjs      CI gate against hand-written brand tokens

import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const IDENTITY_FILE = join(ROOT, "store.identity.json");

// ---------------------------------------------------------------------------
// the schema IS the list of per-store values
// ---------------------------------------------------------------------------
//
// store.identity.schema.json declares every field once: its env-var aliases, the
// scope it belongs to, whether it is required, and its Arabic label. Everything
// below is derived from it, and tools/store-manager renders its form from the
// same file — so adding one entry there adds the field EVERYWHERE, with no code
// change and no chance of the two lists disagreeing.

export const SCHEMA_FILE = join(ROOT, "store.identity.schema.json");

function loadSchema() {
  try {
    const parsed = JSON.parse(readFileSync(SCHEMA_FILE, "utf8"));
    if (!parsed || !Array.isArray(parsed.fields)) {
      throw new Error("missing a `fields` array");
    }
    return parsed;
  } catch (err) {
    throw new Error(`store.identity.schema.json could not be read: ${err.message}`);
  }
}

export const SCHEMA = loadSchema();

/** Every field except the ones handled as their own sub-tree (firebase). */
const SCALAR_FIELDS = SCHEMA.fields.filter((f) => f.path !== "firebase" && f.type !== "list");
const LIST_FIELDS = SCHEMA.fields.filter((f) => f.type === "list");
const FIREBASE_FIELD_DEF = SCHEMA.fields.find((f) => f.path === "firebase") || { subfields: [] };

// Historical aliases live in the schema's `env` arrays, so an existing store
// repo whose variables are already named WORKES_URL / FIREBASE_SET keeps
// deploying without a rename.
const ENV_KEYS = Object.fromEntries(
  SCALAR_FIELDS.filter((f) => Array.isArray(f.env) && f.env.length).map((f) => [f.path, f.env])
);

const CSV_ENV_KEYS = {
  ...Object.fromEntries(
    LIST_FIELDS.filter((f) => Array.isArray(f.env) && f.env.length).map((f) => [f.path, f.env])
  ),
  ...Object.fromEntries(
    Object.entries(SCHEMA.lists || {})
      .filter(([, def]) => Array.isArray(def.env) && def.env.length)
      .map(([name, def]) => [name, def.env])
  )
};

const FIREBASE_BLOB_KEYS = FIREBASE_FIELD_DEF.env || [];

/** Per-subfield overrides (FRONTEND_FIREBASE_API_KEY and friends) are generated
 *  from the subfield name, so a new Firebase key needs only a schema entry. */
function firebaseFieldEnvKeys(key) {
  const upper = key.replace(/([A-Z])/g, "_$1").toUpperCase();
  const extra = { apiKey: ["WEB_API_KEY"], projectId: ["PROJECT_ID"], storageBucket: ["STORAGE_BUCKET"] };
  return [
    `FRONTEND_FIREBASE_${upper}`,
    `PUBLIC_FIREBASE_${upper}`,
    `FIREBASE_${upper}`,
    ...(extra[key] || [])
  ];
}

const FIREBASE_FIELD_KEYS = Object.fromEntries(
  (FIREBASE_FIELD_DEF.subfields || []).map((sub) => [sub.key, firebaseFieldEnvKeys(sub.key)])
);

export const FIREBASE_FIELDS = Object.keys(FIREBASE_FIELD_KEYS);

/** path -> scope, for the "a scope is defined wholly or not at all" rule. */
const SCOPE_OF = Object.fromEntries(
  SCHEMA.fields.filter((f) => f.scope && f.path !== "firebase").map((f) => [f.path, f.scope])
);

/** The primary value of each scope: supplying it via the environment retires
 *  store.identity.json as a fallback for the rest of that scope. */
const SCOPE_PRIMARIES = SCHEMA.fields.reduce((acc, f) => {
  if (f.scope && f.primary) (acc[f.scope] = acc[f.scope] || []).push(f.path);
  return acc;
}, {});

/** Dropped AND unreplaceable AND unsafe to leave empty. */
const REQUIRED_IF_DROPPED = new Set(
  SCHEMA.fields.filter((f) => f.blockIfDropped).map((f) => f.path)
);

const REQUIRED_FIELDS = SCHEMA.fields.filter((f) => f.required);

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function readEnv(env, keys) {
  for (const key of keys) {
    const value = env[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function getPath(source, path) {
  let cursor = source;
  for (const part of String(path).split(".")) {
    if (!isPlainObject(cursor)) return undefined;
    cursor = cursor[part];
  }
  return cursor;
}

function splitCsv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

/** Same rule as backend/src/core/store-slug.js normalizeSlug — the two MUST
 *  agree, or the Worker would look for a cookie the generator never wrote. */
function slugify(value) {
  return String(value == null ? "" : value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

/**
 * Accepts what humans actually paste into a GitHub Actions variable: strict
 * JSON, a JS object literal with unquoted keys and single quotes, a
 * `const firebaseConfig = {…};` snippet, or a JSON-encoded string of any of
 * those. Returns {} when nothing parses — callers decide whether that is fatal.
 */
export function parseLooseEnvObject(rawValue) {
  if (isPlainObject(rawValue)) return rawValue;
  const rawText = String(rawValue || "").trim();
  if (!rawText) return {};

  const attempts = [];
  const pushAttempt = (value) => {
    const text = String(value || "").trim();
    if (text && !attempts.includes(text)) attempts.push(text);
  };

  pushAttempt(rawText);
  pushAttempt(rawText.replace(/^\s*(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*=\s*/i, "").replace(/;+\s*$/, ""));

  try {
    const parsedString = JSON.parse(rawText);
    if (typeof parsedString === "string") pushAttempt(parsedString);
  } catch {}

  for (const candidate of attempts.slice()) {
    const wrapped = /^[[{]/.test(candidate) ? candidate : `{${candidate}}`;
    pushAttempt(wrapped);

    let normalized = wrapped
      .replace(/^\uFEFF/, "")
      .replace(/([{,\r\n]\s*)([A-Za-z_$][\w$.-]*)\s*:/g, '$1"$2":')
      .replace(/,\s*([}\]])/g, "$1");
    normalized = normalized.replace(/([}"\]0-9A-Za-z])\s*(\r?\n)\s*(?="[^"]+"\s*:)/g, "$1,$2");
    pushAttempt(normalized);
    pushAttempt(
      normalized.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_, inner) =>
        `"${String(inner || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
      )
    );
  }

  for (const attempt of attempts) {
    try {
      const parsed = JSON.parse(attempt);
      if (isPlainObject(parsed)) return parsed;
    } catch {}
  }

  return {};
}

// ---------------------------------------------------------------------------
// URL normalization
// ---------------------------------------------------------------------------

export function normalizeHttpBase(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const parsed = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (!/^https?:$/i.test(parsed.protocol)) return "";
    const path = String(parsed.pathname || "").replace(/\/+$/, "");
    return `${parsed.protocol}//${parsed.hostname}${parsed.port ? `:${parsed.port}` : ""}${path && path !== "/" ? path : ""}`;
  } catch {
    return "";
  }
}

export function normalizeOrigin(value) {
  const base = normalizeHttpBase(value);
  if (!base) return "";
  try {
    return new URL(base).origin;
  } catch {
    return "";
  }
}

export function hostOf(value) {
  const base = normalizeHttpBase(value);
  if (!base) return "";
  try {
    return new URL(base).hostname.toLowerCase();
  } catch {
    return "";
  }
}

/** shop.store -> shop.store ; www.shop.store -> shop.store ; a.b.co.uk -> b.co.uk
 *  (good enough for the two-label public suffixes this template is deployed on;
 *  set hosts.zoneName explicitly for anything else). */
function apexOf(hostname) {
  const labels = String(hostname || "").split(".").filter(Boolean);
  if (labels.length <= 2) return labels.join(".");
  const twoLabelSuffixes = new Set(["co.uk", "com.tr", "com.sa", "com.au", "co.il", "com.br"]);
  const lastTwo = labels.slice(-2).join(".");
  return twoLabelSuffixes.has(lastTwo) ? labels.slice(-3).join(".") : lastTwo;
}

// ---------------------------------------------------------------------------
// resolution
// ---------------------------------------------------------------------------

// Words that appear in a brand name but are far too common to hunt for.
const GENERIC_TOKENS = new Set([
  "store", "shop", "market", "app", "web", "site", "the", "and", "for",
  "com", "net", "org", "store1", "متجر", "ستور", "موقع", "سوق"
]);

/** Every placeholder string the schema declares, lowercased, for the check below. */
const PLACEHOLDER_TEXT = (() => {
  const parts = [];
  for (const field of SCHEMA.fields || []) {
    const ph = field.placeholder;
    if (!ph) continue;
    if (typeof ph === "object") parts.push(...Object.values(ph).map(String));
    else parts.push(String(ph));
  }
  return parts.join("\n").toLowerCase();
})();

/** Is this derived token just a fragment of a template placeholder? */
function isFromPlaceholder(token) {
  const text = String(token || "").trim().toLowerCase();
  return text.length >= 3 && PLACEHOLDER_TEXT.includes(text);
}

function readIdentityFile() {
  if (!existsSync(IDENTITY_FILE)) return {};
  try {
    const parsed = JSON.parse(readFileSync(IDENTITY_FILE, "utf8"));
    return isPlainObject(parsed) ? parsed : {};
  } catch (err) {
    throw new Error(`store.identity.json is not valid JSON: ${err.message}`);
  }
}

/**
 * @param {object}  [options]
 * @param {"env"|"file"} [options.source="env"]  "file" ignores the environment —
 *        used by the repo self-consistency gate so a CI variable can never make
 *        the committed files look drifted.
 * @param {object}  [options.env=process.env]
 * @param {boolean} [options.strict]  throw on missing required values
 *        (defaults to FRONTEND_CONFIG_STRICT=1 or CI=true).
 */
export function resolveIdentity(options = {}) {
  const source = options.source === "file" ? "file" : "env";
  const env = source === "file" ? {} : (options.env || process.env);
  // `options.identity` replaces the on-disk file layer entirely. The desktop
  // manager uses it to preview EXACTLY what a saved profile would produce —
  // derived values and all — without writing anything first.
  const file = isPlainObject(options.identity) ? options.identity : readIdentityFile();
  const blob = parseLooseEnvObject(readEnv(env, ["FRONTEND_STORE_IDENTITY", "STORE_IDENTITY"]));

  // ---- scope guard -------------------------------------------------------
  // The whole point of this module is that a half-overridden identity can never
  // ship. When the environment supplies a scope's PRIMARY value (the store name,
  // the site origin, the Firebase project), store.identity.json is no longer a
  // valid fallback for the rest of that scope — its values belong to a DIFFERENT
  // store and would silently leak the old brand (the old short_name under a new
  // name, the previous domain's Turnstile key, the previous store's D1 id).
  // Those file values are dropped, not used; strict mode then names the exact
  // variable that must replace each one.
  const envHas = (path) => {
    if (ENV_KEYS[path] && readEnv(env, ENV_KEYS[path])) return true;
    if (CSV_ENV_KEYS[path] && readEnv(env, CSV_ENV_KEYS[path])) return true;
    const fromBlob = getPath(blob, path);
    return fromBlob !== undefined && fromBlob !== null && String(fromBlob).trim() !== "";
  };
  const envHasFirebase = () =>
    !!readEnv(env, FIREBASE_BLOB_KEYS) ||
    isPlainObject(blob.firebase) ||
    FIREBASE_FIELDS.some((field) => readEnv(env, FIREBASE_FIELD_KEYS[field]));

  // A scope counts as redefined by the environment when ANY of its primaries is
  // supplied there. Both the scopes and their primaries come from the schema.
  const scopeOverridden = Object.fromEntries(
    Object.entries(SCOPE_PRIMARIES).map(([scope, paths]) => [
      scope,
      scope === "firebase" ? envHasFirebase() : paths.some((p) => envHas(p))
    ])
  );
  const droppedFileValues = [];
  const fileAllowed = (path) => {
    const scope = SCOPE_OF[path];
    if (!scope || !scopeOverridden[scope]) return true;
    const fromFile = getPath(file, path);
    if (fromFile !== undefined && fromFile !== null && String(fromFile).trim() !== "") {
      droppedFileValues.push({ path, scope, value: fromFile });
    }
    return false;
  };

  // scalar: env var > identity blob > store.identity.json (scope permitting)
  const pick = (path) => {
    const fromEnv = ENV_KEYS[path] ? readEnv(env, ENV_KEYS[path]) : "";
    if (fromEnv) return fromEnv;
    const fromBlob = getPath(blob, path);
    if (typeof fromBlob === "string" && fromBlob.trim()) return fromBlob.trim();
    if (typeof fromBlob === "number") return String(fromBlob);
    if (!fileAllowed(path)) return "";
    const fromFile = getPath(file, path);
    if (typeof fromFile === "string" && fromFile.trim()) return fromFile.trim();
    if (typeof fromFile === "number") return String(fromFile);
    return "";
  };

  const pickBool = (path, fallback) => {
    const raw = pick(path);
    if (raw) return /^(1|true|yes|on)$/i.test(raw);
    const fromBlob = getPath(blob, path);
    if (typeof fromBlob === "boolean") return fromBlob;
    const fromFile = getPath(file, path);
    if (typeof fromFile === "boolean") return fromFile;
    return fallback;
  };

  const pickList = (path) => {
    const keys = CSV_ENV_KEYS[path];
    const fromEnv = keys ? readEnv(env, keys) : "";
    if (fromEnv) return splitCsv(fromEnv);
    const candidates = [getPath(blob, path)];
    if (fileAllowed(path)) candidates.push(getPath(file, path));
    for (const candidate of candidates) {
      if (Array.isArray(candidate)) return candidate.map((item) => String(item).trim()).filter(Boolean);
      if (typeof candidate === "string" && candidate.trim()) return splitCsv(candidate);
    }
    return [];
  };

  // ---- firebase ----------------------------------------------------------
  const firebaseBlob = parseLooseEnvObject(readEnv(env, FIREBASE_BLOB_KEYS));
  const firebaseSources = [
    isPlainObject(firebaseBlob.firebase) ? firebaseBlob.firebase : firebaseBlob,
    isPlainObject(blob.firebase) ? blob.firebase : {}
  ];
  // Same scope rule: a partially-supplied Firebase config must never be topped
  // up from the previous store's project.
  if (!scopeOverridden.firebase) {
    firebaseSources.push(isPlainObject(file.firebase) ? file.firebase : {});
  } else if (isPlainObject(file.firebase)) {
    for (const field of FIREBASE_FIELDS) {
      if (String(file.firebase[field] ?? "").trim()) {
        droppedFileValues.push({ path: `firebase.${field}`, scope: "firebase", value: file.firebase[field] });
      }
    }
  }
  const firebase = {};
  for (const field of FIREBASE_FIELDS) {
    let value = readEnv(env, FIREBASE_FIELD_KEYS[field]);
    if (!value) {
      // snake_case is accepted too — some dashboards export it that way.
      const snake = field.replace(/[A-Z]/g, (ch) => `_${ch.toLowerCase()}`);
      for (const src of firebaseSources) {
        const candidate = src?.[field] ?? src?.[snake];
        if (candidate !== undefined && String(candidate).trim()) {
          value = String(candidate).trim();
          break;
        }
      }
    }
    if (value) firebase[field] = value;
  }

  // ---- hosts -------------------------------------------------------------
  const explicitSiteOrigin = normalizeOrigin(pick("hosts.siteOrigin"));
  const authDomain = String(firebase.authDomain || "").trim();
  const siteOrigin =
    explicitSiteOrigin ||
    (authDomain && !/\.firebaseapp\.com$/i.test(authDomain) ? normalizeOrigin(authDomain) : "");
  const siteHost = hostOf(siteOrigin);
  const zoneName = (pick("hosts.zoneName") || apexOf(siteHost)).toLowerCase();
  const apiOrigin = normalizeHttpBase(pick("hosts.apiOrigin")) || (zoneName ? `https://api.${zoneName}` : "");
  const adminOrigin = normalizeOrigin(pick("hosts.adminOrigin")) || (zoneName ? `https://admin.${zoneName}` : "");
  // The store's R2 bucket serves every image, so its public domain is BOTH the
  // Worker's R2_PUBLIC_URL and the origin the page preconnects to. Like the API
  // and admin hosts it is derived from the zone, so typing the site domain is
  // enough to configure a store.
  const r2PublicUrl =
    normalizeOrigin(pick("r2.publicUrl")) || (zoneName ? `https://img.${zoneName}` : "");

  // ---- brand + seo -------------------------------------------------------
  const name = pick("brand.name");
  const nameAr = pick("brand.nameAr");
  const shortName = pick("brand.shortName") || name.split(/\s+/)[0] || "";
  const composedTitle = [name, nameAr].filter(Boolean).join(" | ");
  const title = pick("seo.title") || composedTitle;

  // An empty description used to fall back to the bare title, which reads as a
  // name and nothing else in a search result. The schema carries a default
  // sentence instead, so a new store starts with a usable snippet it can edit.
  const defaults = SCHEMA.defaults || {};
  const withSuffix = (suffix) => [title, suffix].filter(Boolean).join(" ").trim();
  const description = pick("seo.description") || withSuffix(defaults.seoDescriptionSuffix);
  const shortDescription =
    pick("seo.shortDescription") || withSuffix(defaults.seoShortDescriptionSuffix) || description;

  // This store's own name and domain come FIRST, then whatever the operator
  // typed, then the generic defaults. Prepending the name automatically is the
  // point: it is the one keyword a store must have and the easiest to forget.
  const keywords = unique([
    name,
    nameAr,
    siteHost,
    ...pickList("seo.keywords"),
    ...(pickList("seo.keywords").length ? [] : defaults.seoKeywords || [])
  ]);
  const sitemapLastmod = pick("seo.sitemapLastmod") || new Date().toISOString().slice(0, 10);

  const projectId = String(firebase.projectId || "").trim();
  const workerName = pick("cloudflare.workerName") || projectId || "";
  const notificationsFrom =
    pick("email.notificationsFrom") || (zoneName ? `no-reply@${zoneName}` : "");

  // Tokens the leak scanner hunts for outside generated files. Auto-derived so a
  // fresh store needs no extra configuration: the zone labels (minus the public
  // suffix), each brand word, and the Firebase project id.
  //
  // A PLACEHOLDER is not a brand. When a value is still the template's marker,
  // deriving from it produces tokens like "invalid" and "store-domain" that
  // match ordinary words all over the vendored SDKs — thousands of false leaks
  // that drown the real signal. So anything that came from a placeholder is
  // dropped here; the placeholder gate (check-placeholders.mjs) is what reports
  // those values, and it reports them accurately.
  const derivedTokens = unique([
    ...String(zoneName || "").split(".").slice(0, -1),
    ...String(siteHost || "").split(".").filter((label) => label !== "www"),
    ...name.split(/[\s._-]+/),
    ...nameAr.split(/[\s._-]+/),
    shortName,
    projectId,
    workerName
  ]).filter(
    (token) =>
      token.length >= 3 &&
      !GENERIC_TOKENS.has(token.toLowerCase()) &&
      !isFromPlaceholder(token)
  );

  const identity = {
    source,
    // NOTE: ticker text, the WhatsApp badge name and theme colours are NOT here
    // on purpose — the store admin edits them in the panel (siteState) after
    // deployment, and a deploy-time copy would just be overwritten.
    brand: { name, nameAr, shortName },
    hosts: {
      siteOrigin,
      siteHost,
      apiOrigin,
      adminOrigin,
      zoneName,
      wwwCanonicalRedirect: pickBool("hosts.wwwCanonicalRedirect", true)
    },
    r2: {
      publicUrl: r2PublicUrl,
      bucketName: pick("r2.bucketName"),
      accountId: pick("r2.accountId")
    },
    sms: {
      directoryUrl: normalizeHttpBase(pick("sms.directoryUrl"))
    },
    seo: { title, description, shortDescription, keywords, sitemapLastmod },
    firebase,
    turnstile: { siteKey: pick("turnstile.siteKey") },
    email: {
      notificationsFrom,
      notificationsFromName: pick("email.notificationsFromName") || nameAr || name
    },
    cloudflare: {
      workerName,
      d1DatabaseName: pick("cloudflare.d1DatabaseName") || workerName,
      d1DatabaseId: pick("cloudflare.d1DatabaseId")
    },
    // Auto-derivation can produce a token that collides with something entirely
    // unrelated already in the project (a provider key, a library, a folder). The
    // fix is to name the collision, not to weaken the whole check.
    // The short identifier the Worker derives its session cookie, contact-KDF
    // key and catalog export format from. Taken from the PWA short name so it
    // is something the operator already chose and recognises.
    storeSlug: slugify(shortName) || slugify(name) || "store",
    // The slugs this store used before. Reads still accept them — see
    // backend/src/core/store-slug.js for why dropping them signs everyone out.
    legacyStoreSlugs: unique(
      pickList("retiredBrandTokens").map(slugify)
    ).filter((s) => s && s !== (slugify(shortName) || slugify(name))),
    brandTokens: (() => {
      const ignore = new Set(pickList("ignoreBrandTokens").map((t) => t.toLowerCase()));
      return unique([...pickList("brandTokens"), ...derivedTokens]).filter(
        (token) => !ignore.has(String(token).toLowerCase())
      );
    })(),
    retiredBrandTokens: pickList("retiredBrandTokens"),
    ignoreBrandTokens: pickList("ignoreBrandTokens"),
    // Values that store.identity.json still holds but that this run refused to
    // use, because the environment redefined the scope they belong to.
    droppedFileValues
  };

  const strict =
    options.strict !== undefined
      ? !!options.strict
      : env.FRONTEND_CONFIG_STRICT === "1" || env.CI === "true";
  if (strict) assertIdentity(identity);
  else if (droppedFileValues.length) warnDroppedFileValues(identity);
  return identity;
}

/** Env var suggestions for the paths the scope guard can drop. */
function envKeyHint(path) {
  if (path === "firebase" || path.startsWith("firebase.")) {
    return FIREBASE_BLOB_KEYS[0] || "FRONTEND_FIREBASE_SET";
  }
  const keys = ENV_KEYS[path] || CSV_ENV_KEYS[path];
  return keys ? keys[0] : `FRONTEND_STORE_IDENTITY (${path})`;
}

function describeDropped(identity) {
  return identity.droppedFileValues
    .map(({ path, scope }) => `  - ${path} (scope "${scope}") → set ${envKeyHint(path)}`)
    .join("\n");
}

function warnDroppedFileValues(identity) {
  console.warn(
    `store-identity: the environment redefines this store, so these ` +
    `store.identity.json values were IGNORED (they belong to the previous store):\n` +
    `${describeDropped(identity)}\n`
  );
}

export function assertIdentity(identity) {
  // Required fields (and required Firebase subfields) come from the schema.
  const missing = [];
  for (const field of REQUIRED_FIELDS) {
    if (field.path === "firebase") {
      for (const sub of field.subfields || []) {
        if (sub.required && !String(identity.firebase[sub.key] || "").trim()) {
          missing.push(`firebase.${sub.key} (${envKeyHint("firebase")})`);
        }
      }
      continue;
    }
    if (!getPath(identity, field.path)) missing.push(`${field.path} (${envKeyHint(field.path)})`);
  }
  if (missing.length) {
    throw new Error(
      `Missing store identity values: ${missing.join(", ")}.\n` +
      `Set them as GitHub Actions repository variables or in store.identity.json — see STORE_SETUP.md.`
    );
  }
  // A half-overridden identity is the failure this module exists to prevent.
  // Most dropped values are harmless: they are either re-derived from the new
  // primaries (title, zone, admin origin, worker name) or legitimately optional
  // (image host, ticker). These are NOT: an empty Turnstile key silently breaks
  // the widget, and an empty D1 id makes `wrangler deploy` reject the config —
  // and keeping the OLD store's values there would be far worse than either.
  const blocking = (identity.droppedFileValues || []).filter(
    ({ path }) => REQUIRED_IF_DROPPED.has(path) && !getPath(identity, path)
  );
  if (blocking.length) {
    throw new Error(
      `Half-overridden store identity. The environment redefines this store, so ` +
      `store.identity.json is no longer a valid fallback — and these have no ` +
      `replacement and cannot be derived:\n` +
      `${blocking.map(({ path }) => `  - ${path} → set ${envKeyHint(path)}`).join("\n")}\n\n` +
      `Either set those variables too, or drop the overriding variables and let ` +
      `store.identity.json define the store on its own — see STORE_SETUP.md.`
    );
  }
  if (identity.droppedFileValues && identity.droppedFileValues.length) {
    warnDroppedFileValues(identity);
  }
  return identity;
}

/** The runtime settings object shipped as site_settings.js (and __/firebase/init.json). */
export function buildSiteSettings(identity, env = process.env) {
  const { brand, hosts, seo, firebase, turnstile } = identity;
  const googleRedirectPath =
    readEnv(env, ["FRONTEND_GOOGLE_REDIRECT_PATH", "GOOGLE_REDIRECT_PATH"]) || "/__/auth/handler";
  const firebaseHelperOrigin = normalizeOrigin(
    readEnv(env, ["FRONTEND_FIREBASE_HELPER_ORIGIN", "PUBLIC_FIREBASE_HELPER_ORIGIN", "FIREBASE_HELPER_ORIGIN"]) ||
    (firebase.projectId ? `https://${firebase.projectId}.firebaseapp.com` : "")
  );
  const routerHostAliases = unique([
    ...splitCsv(readEnv(env, ["FRONTEND_ROUTER_HOST_ALIASES", "PUBLIC_ROUTER_HOST_ALIASES", "ROUTER_HOST_ALIASES"])),
    hosts.siteHost
  ]);
  const legacyCachePrefixes = unique([
    firebase.projectId ? `${firebase.projectId}-pwa-` : "",
    "static-",
    "images-",
    "pages-"
  ]);

  return {
    firebase,
    workers: {
      routerBase: hosts.apiOrigin,
      routerBaseStorageKey: "MANWAL_ROUTER_BASE",
      legacyWorkerStorageKey: "edaa:worker",
      routerHostAliases,
      authAction: "auth"
    },
    auth: {
      googleRedirectOrigin: hosts.siteOrigin,
      googleRedirectPath,
      googleRedirectUri:
        readEnv(env, ["FRONTEND_GOOGLE_REDIRECT_URI", "GOOGLE_REDIRECT_URI"]) ||
        (hosts.siteOrigin ? `${hosts.siteOrigin}${googleRedirectPath}` : ""),
      firebaseHelperOrigin
    },
    brand: {
      storeName: brand.name,
      // storeNameAr / storeShortName are the ONLY source for the Arabic brand in
      // the storefront — src-frontend must never hardcode a brand string again.
      storeNameAr: brand.nameAr,
      storeShortName: brand.shortName
      // tickerText / waBadgeBrand deliberately absent: the admin panel owns
      // them at runtime (siteState), and site-core.js already falls back to
      // storeName when they are unset.
    },
    seo: {
      title: seo.title,
      description: seo.description,
      shortDescription: seo.shortDescription,
      siteOrigin: hosts.siteOrigin
    },
    security: {
      turnstileSiteKey: turnstile.siteKey
    },
    media: {
      siteIcon: readEnv(env, ["FRONTEND_SITE_ICON", "PUBLIC_SITE_ICON", "SITE_ICON"]),
      sitePreview: readEnv(env, ["FRONTEND_SITE_PREVIEW", "PUBLIC_SITE_PREVIEW", "SITE_PREVIEW"]),
      // The R2 bucket public domain — every product/banner image is served
      // from it, so the storefront preconnects to it.
      imagesOrigin: identity.r2.publicUrl
    },
    pwa: {
      legacyCachePrefixes
    }
  };
}
