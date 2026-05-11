// Quick-edit defaults: static frontend Firebase config lives here for GitHub/static hosting.
// Backend workers must still use secret bindings separately.
var SITE_CORE_PROJECT_TOKEN = "njadstore1";
var SITE_CORE_AUTH_DOMAIN = "njad.store";
var SITE_CORE_FIREBASE_FRONTEND_CONFIG = {
  apiKey: "AIzaSyBaJE8eTuSZUfjLw3lj-788iTvR7YJvWj8",
  authDomain: SITE_CORE_AUTH_DOMAIN,
  projectId: SITE_CORE_PROJECT_TOKEN,
  storageBucket: SITE_CORE_PROJECT_TOKEN + ".firebasestorage.app",
  messagingSenderId: "1072422740336",
  appId: "1:1072422740336:web:28abfc7058d310379dafb5",
  measurementId: "G-T2J947YL3L"
};
var SITE_CORE_CANONICAL_API_HOST = "api.njad.store";
var SITE_CORE_CANONICAL_API_BASE = "https://" + SITE_CORE_CANONICAL_API_HOST;

var SITE_CORE_DEFAULT_RUNTIME = {
  firebase: SITE_CORE_FIREBASE_FRONTEND_CONFIG,
  workers: {
    routerBase: SITE_CORE_CANONICAL_API_BASE,
    routerBaseStorageKey: "MANWAL_ROUTER_BASE",
    legacyWorkerStorageKey: "edaa:worker",
    authAction: "auth"
  },
  brand: {
    storeName: "njad.store",
    tickerText: "",
    waBadgeBrand: ""
  }
};

try { window.__SITE_CORE_DEFAULT_RUNTIME__ = SITE_CORE_DEFAULT_RUNTIME; } catch {}

// Shared runtime/bootstrap and app helpers used by header.js and related pages.

(function (global) {
  "use strict";

  function installAuthSessionStorageBundle() {
    try {
      var storage = global.localStorage;
      if (!storage) return;
      var proto = Object.getPrototypeOf(storage);
      if (!proto || proto.__siteAuthSessionBundlePatched) return;

      var nativeGetItem = proto.getItem;
      var nativeSetItem = proto.setItem;
      var nativeRemoveItem = proto.removeItem;
      var nativeKey = proto.key;
      var BUNDLE_KEY = "auth:session:bundle:v1";
      var CURRENCY_STATE_KEY = "currency:state:v1";
      var SITE_APPEARANCE_KEY = "site:appearance:v1";
      var PROFILE_PREFIX = "auth:profile:cache:";
      var API_ACCESS_PREFIX = "api:access:enabled:";
      var BALANCE_PREFIX = "balance:cache:";
      var directKeys = {
        "session:device:id": true,
        "session:device:seed": true,
        "sessionKeyInfo": true,
        "postLoginPayload": true,
        "auth:lastLoggedIn": true,
        "auth:lastUid": true,
        "session:lastUid": true,
        "auth:lastAccountNo": true
      };
      var currencyKeys = {
        "currency:selected": true,
        "currency:rates:cache": true
      };
      var appearanceKeys = {
        "site:theme:v1": "theme",
        "site:media:v1": "media",
        "site:wa-join:v1": "waJoin"
      };

      function isLocalStorageTarget(target) {
        try { return target === storage || target === global.localStorage; }
        catch (_) { return false; }
      }

      function safeKey(value) {
        return String(value == null ? "" : value);
      }

      function parseJsonObject(raw) {
        try {
          var parsed = JSON.parse(String(raw || ""));
          return parsed && typeof parsed === "object" ? parsed : null;
        } catch (_) {
          return null;
        }
      }

      function readJsonStorage(key) {
        try {
          var raw = nativeGetItem.call(storage, key);
          var parsed = raw ? JSON.parse(raw) : {};
          return parsed && typeof parsed === "object" ? parsed : {};
        } catch (_) {
          return {};
        }
      }

      function hasMeaningfulStorageValues(value) {
        try {
          var src = value && typeof value === "object" ? value : {};
          return Object.keys(src).some(function (key) {
            return key !== "v" && key !== "updatedAt";
          });
        } catch (_) {
          return false;
        }
      }

      function writeJsonStorage(key, value) {
        try {
          var src = value && typeof value === "object" ? value : {};
          if (!hasMeaningfulStorageValues(src)) {
            nativeRemoveItem.call(storage, key);
            return src;
          }
          src.v = src.v || 1;
          src.updatedAt = Date.now();
          nativeSetItem.call(storage, key, JSON.stringify(src));
          return src;
        } catch (_) {
          return value;
        }
      }

      function parseCountriesStorageKey(key) {
        var match = /^edaa:(deposit|withdraw):countries(?::(meta))?:v3:(.+)$/i.exec(safeKey(key));
        if (!match) return null;
        return {
          flow: String(match[1] || "deposit").toLowerCase() === "withdraw" ? "withdraw" : "deposit",
          kind: match[2] ? "meta" : "data",
          scope: String(match[3] || "").trim()
        };
      }

      function getCountriesBundleKey(info) {
        return "edaa:" + info.flow + ":countries:bundle:v3:" + info.scope;
      }

      function parseUserStateStorageKey(key) {
        var k = safeKey(key);
        if (k.indexOf(API_ACCESS_PREFIX) === 0) {
          return { uid: k.slice(API_ACCESS_PREFIX.length).trim(), field: "apiAccessEnabled" };
        }
        if (k.indexOf(BALANCE_PREFIX) === 0) {
          return { uid: k.slice(BALANCE_PREFIX.length).trim(), field: "balance" };
        }
        return null;
      }

      function getUserStateBundleKey(info) {
        return "auth:user-state:v1:" + info.uid;
      }

      function readBundle() {
        try {
          var raw = nativeGetItem.call(storage, BUNDLE_KEY);
          var parsed = raw ? JSON.parse(raw) : {};
          return parsed && typeof parsed === "object" ? parsed : {};
        } catch (_) {
          return {};
        }
      }

      function hasObjectValues(obj) {
        try { return !!(obj && typeof obj === "object" && Object.keys(obj).length); }
        catch (_) { return false; }
      }

      function compactBundle(source) {
        var src = source && typeof source === "object" ? source : {};
        var out = { v: 1, updatedAt: Date.now() };
        if (hasObjectValues(src.device)) {
          out.device = {};
          if (src.device.id) out.device.id = String(src.device.id);
          if (src.device.seed) out.device.seed = String(src.device.seed);
        }
        if (hasObjectValues(src.sessionKeyInfo)) out.sessionKeyInfo = src.sessionKeyInfo;
        if (hasObjectValues(src.postLoginPayload)) out.postLoginPayload = src.postLoginPayload;
        if (hasObjectValues(src.last)) {
          out.last = {};
          if (src.last.loggedIn != null && src.last.loggedIn !== "") out.last.loggedIn = String(src.last.loggedIn);
          if (src.last.uid) out.last.uid = String(src.last.uid);
          if (src.last.accountNo != null && src.last.accountNo !== "") out.last.accountNo = String(src.last.accountNo);
        }
        if (hasObjectValues(src.profiles)) {
          out.profiles = {};
          Object.keys(src.profiles).forEach(function (uid) {
            var key = String(uid || "").trim();
            if (!key) return;
            var profile = src.profiles[uid];
            if (profile && typeof profile === "object") out.profiles[key] = profile;
          });
        }
        return out;
      }

      function writeBundle(bundle) {
        try {
          var compact = compactBundle(bundle);
          nativeSetItem.call(storage, BUNDLE_KEY, JSON.stringify(compact));
          return compact;
        } catch (_) {
          return bundle;
        }
      }

      function ensureNested(bundle) {
        if (!bundle.device || typeof bundle.device !== "object") bundle.device = {};
        if (!bundle.last || typeof bundle.last !== "object") bundle.last = {};
        if (!bundle.profiles || typeof bundle.profiles !== "object") bundle.profiles = {};
        return bundle;
      }

      function isVirtualAuthKey(key) {
        var k = safeKey(key);
        return !!(directKeys[k] || k.indexOf(PROFILE_PREFIX) === 0);
      }

      function isVirtualStorageKey(key) {
        var k = safeKey(key);
        return !!(
          isVirtualAuthKey(k) ||
          currencyKeys[k] ||
          Object.prototype.hasOwnProperty.call(appearanceKeys, k) ||
          parseCountriesStorageKey(k) ||
          parseUserStateStorageKey(k)
        );
      }

      function getVirtualAuthValue(key) {
        var k = safeKey(key);
        var bundle = readBundle();
        var sessionInfo = bundle.sessionKeyInfo && typeof bundle.sessionKeyInfo === "object" ? bundle.sessionKeyInfo : null;
        var postLogin = bundle.postLoginPayload && typeof bundle.postLoginPayload === "object" ? bundle.postLoginPayload : null;
        var last = bundle.last && typeof bundle.last === "object" ? bundle.last : {};
        var device = bundle.device && typeof bundle.device === "object" ? bundle.device : {};
        if (k === "session:device:id") return device.id || (sessionInfo && sessionInfo.deviceId) || (postLogin && postLogin.deviceId) || null;
        if (k === "session:device:seed") return device.seed || null;
        if (k === "sessionKeyInfo") return sessionInfo ? JSON.stringify(sessionInfo) : null;
        if (k === "postLoginPayload") return postLogin ? JSON.stringify(postLogin) : null;
        if (k === "auth:lastUid" || k === "session:lastUid") return last.uid || (sessionInfo && sessionInfo.uid) || (postLogin && postLogin.uid) || null;
        if (k === "auth:lastAccountNo") return last.accountNo || (postLogin && postLogin.accountNo) || null;
        if (k === "auth:lastLoggedIn") {
          if (last.loggedIn != null && last.loggedIn !== "") return String(last.loggedIn);
          return (last.uid || (sessionInfo && sessionInfo.uid) || (postLogin && postLogin.uid)) ? "1" : null;
        }
        if (k.indexOf(PROFILE_PREFIX) === 0) {
          var uid = k.slice(PROFILE_PREFIX.length).trim();
          var profile = uid && bundle.profiles && bundle.profiles[uid];
          return profile ? JSON.stringify(profile) : null;
        }
        return null;
      }

      function setVirtualAuthValue(key, value) {
        var k = safeKey(key);
        var raw = String(value == null ? "" : value);
        var bundle = ensureNested(readBundle());
        if (k === "session:device:id") {
          bundle.device.id = raw;
        } else if (k === "session:device:seed") {
          bundle.device.seed = raw;
        } else if (k === "sessionKeyInfo") {
          var sessionInfo = parseJsonObject(raw);
          if (sessionInfo) {
            bundle.sessionKeyInfo = sessionInfo;
            if (sessionInfo.deviceId) bundle.device.id = String(sessionInfo.deviceId);
            if (sessionInfo.uid) bundle.last.uid = String(sessionInfo.uid);
          } else {
            delete bundle.sessionKeyInfo;
          }
        } else if (k === "postLoginPayload") {
          var postLogin = parseJsonObject(raw);
          if (postLogin) {
            bundle.postLoginPayload = postLogin;
            if (postLogin.deviceId) bundle.device.id = String(postLogin.deviceId);
            if (postLogin.uid) bundle.last.uid = String(postLogin.uid);
            if (postLogin.accountNo != null && postLogin.accountNo !== "") bundle.last.accountNo = String(postLogin.accountNo);
            bundle.last.loggedIn = "1";
          } else {
            delete bundle.postLoginPayload;
          }
        } else if (k === "auth:lastLoggedIn") {
          bundle.last.loggedIn = raw;
        } else if (k === "auth:lastUid" || k === "session:lastUid") {
          bundle.last.uid = raw;
        } else if (k === "auth:lastAccountNo") {
          bundle.last.accountNo = raw;
        } else if (k.indexOf(PROFILE_PREFIX) === 0) {
          var uid = k.slice(PROFILE_PREFIX.length).trim();
          if (uid) {
            var profile = parseJsonObject(raw);
            if (profile) bundle.profiles[uid] = profile;
            else delete bundle.profiles[uid];
          }
        }
        writeBundle(bundle);
      }

      function removeVirtualAuthValue(key) {
        var k = safeKey(key);
        var bundle = ensureNested(readBundle());
        if (k === "session:device:id") delete bundle.device.id;
        else if (k === "session:device:seed") delete bundle.device.seed;
        else if (k === "sessionKeyInfo") delete bundle.sessionKeyInfo;
        else if (k === "postLoginPayload") delete bundle.postLoginPayload;
        else if (k === "auth:lastLoggedIn") delete bundle.last.loggedIn;
        else if (k === "auth:lastUid" || k === "session:lastUid") delete bundle.last.uid;
        else if (k === "auth:lastAccountNo") delete bundle.last.accountNo;
        else if (k.indexOf(PROFILE_PREFIX) === 0) {
          var uid = k.slice(PROFILE_PREFIX.length).trim();
          if (uid && bundle.profiles) delete bundle.profiles[uid];
        }
        writeBundle(bundle);
      }

      function getVirtualCountriesValue(info) {
        var bundle = readJsonStorage(getCountriesBundleKey(info));
        var payload = info.kind === "meta" ? bundle.meta : bundle.data;
        return payload && typeof payload === "object" ? JSON.stringify(payload) : null;
      }

      function setVirtualCountriesValue(info, value) {
        if (!info || !info.scope) return;
        var key = getCountriesBundleKey(info);
        var bundle = readJsonStorage(key);
        var payload = parseJsonObject(value);
        if (payload) bundle[info.kind === "meta" ? "meta" : "data"] = payload;
        else delete bundle[info.kind === "meta" ? "meta" : "data"];
        writeJsonStorage(key, bundle);
      }

      function removeVirtualCountriesValue(info) {
        if (!info || !info.scope) return;
        var key = getCountriesBundleKey(info);
        var bundle = readJsonStorage(key);
        delete bundle[info.kind === "meta" ? "meta" : "data"];
        writeJsonStorage(key, bundle);
      }

      function getVirtualUserStateValue(info) {
        if (!info || !info.uid) return null;
        var bundle = readJsonStorage(getUserStateBundleKey(info));
        var value = bundle[info.field];
        return value == null ? null : String(value);
      }

      function setVirtualUserStateValue(info, value) {
        if (!info || !info.uid) return;
        var key = getUserStateBundleKey(info);
        var bundle = readJsonStorage(key);
        bundle[info.field] = String(value == null ? "" : value);
        writeJsonStorage(key, bundle);
      }

      function removeVirtualUserStateValue(info) {
        if (!info || !info.uid) return;
        var key = getUserStateBundleKey(info);
        var bundle = readJsonStorage(key);
        delete bundle[info.field];
        writeJsonStorage(key, bundle);
      }

      function getVirtualCurrencyValue(key) {
        var bundle = readJsonStorage(CURRENCY_STATE_KEY);
        if (key === "currency:selected") return bundle.selected ? String(bundle.selected) : null;
        if (key === "currency:rates:cache") {
          return bundle.ratesCache && typeof bundle.ratesCache === "object"
            ? JSON.stringify(bundle.ratesCache)
            : null;
        }
        return null;
      }

      function setVirtualCurrencyValue(key, value) {
        var bundle = readJsonStorage(CURRENCY_STATE_KEY);
        if (key === "currency:selected") {
          bundle.selected = String(value == null ? "" : value);
        } else if (key === "currency:rates:cache") {
          var rates = parseJsonObject(value);
          if (rates) bundle.ratesCache = rates;
          else delete bundle.ratesCache;
        }
        writeJsonStorage(CURRENCY_STATE_KEY, bundle);
      }

      function removeVirtualCurrencyValue(key) {
        var bundle = readJsonStorage(CURRENCY_STATE_KEY);
        if (key === "currency:selected") delete bundle.selected;
        else if (key === "currency:rates:cache") delete bundle.ratesCache;
        writeJsonStorage(CURRENCY_STATE_KEY, bundle);
      }

      function getVirtualAppearanceValue(key) {
        var field = appearanceKeys[safeKey(key)];
        if (!field) return null;
        var bundle = readJsonStorage(SITE_APPEARANCE_KEY);
        var value = bundle[field];
        return value && typeof value === "object" ? JSON.stringify(value) : null;
      }

      function setVirtualAppearanceValue(key, value) {
        var field = appearanceKeys[safeKey(key)];
        if (!field) return;
        var bundle = readJsonStorage(SITE_APPEARANCE_KEY);
        var parsed = parseJsonObject(value);
        if (parsed) bundle[field] = parsed;
        else delete bundle[field];
        writeJsonStorage(SITE_APPEARANCE_KEY, bundle);
      }

      function removeVirtualAppearanceValue(key) {
        var field = appearanceKeys[safeKey(key)];
        if (!field) return;
        var bundle = readJsonStorage(SITE_APPEARANCE_KEY);
        delete bundle[field];
        writeJsonStorage(SITE_APPEARANCE_KEY, bundle);
      }

      function takeNativeVirtualValue(key) {
        try {
          var raw = nativeGetItem.call(storage, key);
          if (raw == null) return null;
          setVirtualStorageValue(key, raw);
          nativeRemoveItem.call(storage, key);
          return raw;
        } catch (_) {
          return null;
        }
      }

      function getVirtualStorageValue(key) {
        var k = safeKey(key);
        var migrated = takeNativeVirtualValue(k);
        if (migrated != null) return migrated;
        if (isVirtualAuthKey(k)) return getVirtualAuthValue(k);
        var countryInfo = parseCountriesStorageKey(k);
        if (countryInfo) return getVirtualCountriesValue(countryInfo);
        var userStateInfo = parseUserStateStorageKey(k);
        if (userStateInfo) return getVirtualUserStateValue(userStateInfo);
        if (currencyKeys[k]) return getVirtualCurrencyValue(k);
        if (Object.prototype.hasOwnProperty.call(appearanceKeys, k)) return getVirtualAppearanceValue(k);
        return null;
      }

      function setVirtualStorageValue(key, value) {
        var k = safeKey(key);
        if (isVirtualAuthKey(k)) {
          setVirtualAuthValue(k, value);
          return;
        }
        var countryInfo = parseCountriesStorageKey(k);
        if (countryInfo) {
          setVirtualCountriesValue(countryInfo, value);
          return;
        }
        var userStateInfo = parseUserStateStorageKey(k);
        if (userStateInfo) {
          setVirtualUserStateValue(userStateInfo, value);
          return;
        }
        if (currencyKeys[k]) {
          setVirtualCurrencyValue(k, value);
          return;
        }
        if (Object.prototype.hasOwnProperty.call(appearanceKeys, k)) {
          setVirtualAppearanceValue(k, value);
        }
      }

      function removeVirtualStorageValue(key) {
        var k = safeKey(key);
        if (isVirtualAuthKey(k)) {
          removeVirtualAuthValue(k);
          return;
        }
        var countryInfo = parseCountriesStorageKey(k);
        if (countryInfo) {
          removeVirtualCountriesValue(countryInfo);
          return;
        }
        var userStateInfo = parseUserStateStorageKey(k);
        if (userStateInfo) {
          removeVirtualUserStateValue(userStateInfo);
          return;
        }
        if (currencyKeys[k]) {
          removeVirtualCurrencyValue(k);
          return;
        }
        if (Object.prototype.hasOwnProperty.call(appearanceKeys, k)) {
          removeVirtualAppearanceValue(k);
        }
      }

      function migrateLegacyAuthKeys() {
        var changed = false;
        function migrate(key) {
          try {
            var raw = nativeGetItem.call(storage, key);
            if (raw == null) return;
            setVirtualStorageValue(key, raw);
            nativeRemoveItem.call(storage, key);
            changed = true;
          } catch (_) {}
        }
        Object.keys(directKeys).forEach(migrate);
        Object.keys(currencyKeys).forEach(migrate);
        Object.keys(appearanceKeys).forEach(migrate);
        try {
          var keys = [];
          for (var i = 0; i < storage.length; i += 1) {
            var key = String(nativeKey.call(storage, i) || "");
            if (
              key.indexOf(PROFILE_PREFIX) === 0 ||
              parseCountriesStorageKey(key) ||
              parseUserStateStorageKey(key)
            ) {
              keys.push(key);
            }
          }
          keys.forEach(migrate);
        } catch (_) {}
        if (changed) writeBundle(readBundle());
      }

      migrateLegacyAuthKeys();

      proto.getItem = function (key) {
        if (isLocalStorageTarget(this) && isVirtualStorageKey(key)) return getVirtualStorageValue(key);
        return nativeGetItem.call(this, key);
      };
      proto.setItem = function (key, value) {
        if (isLocalStorageTarget(this) && isVirtualStorageKey(key)) {
          setVirtualStorageValue(key, value);
          return;
        }
        return nativeSetItem.call(this, key, value);
      };
      proto.removeItem = function (key) {
        if (isLocalStorageTarget(this) && isVirtualStorageKey(key)) {
          removeVirtualStorageValue(key);
          return;
        }
        return nativeRemoveItem.call(this, key);
      };

      proto.__siteAuthSessionBundlePatched = true;
      try { global.__AUTH_SESSION_BUNDLE_STORAGE_KEY__ = BUNDLE_KEY; } catch (_) {}
      try { global.__CURRENCY_STATE_BUNDLE_STORAGE_KEY__ = CURRENCY_STATE_KEY; } catch (_) {}
      try { global.__SITE_APPEARANCE_BUNDLE_STORAGE_KEY__ = SITE_APPEARANCE_KEY; } catch (_) {}
    } catch (_) {}
  }

  function runLocalStorageMaintenance() {
    try {
      var storage = global.localStorage;
      if (!storage) return;
      var googleFlowDebugEnabled = false;
      try {
        googleFlowDebugEnabled = !!(
          storage.getItem("site:google:flow:debug") === "1" ||
          /(?:^|[?&])googleFlowDebug=1(?:&|$)/.test(String(global.location && global.location.search || ""))
        );
      } catch (_) {}
      var staleKeys = [
        "site:state:secure:v1",
        "site:state:v1",
        "i18n:runtime",
        "site:google:redirect:early:status:v1",
        "admin:credentials:password:v1"
      ];
      if (!googleFlowDebugEnabled) staleKeys.push("site:google:flow:logs:v1");
      staleKeys.forEach(function (key) {
        try { storage.removeItem(key); } catch (_) {}
      });

      var staleCountriesPattern = /^edaa:(?:deposit|withdraw):countries(?::meta)?:v[12]$/;
      for (var i = storage.length - 1; i >= 0; i -= 1) {
        var key = "";
        try { key = String(storage.key(i) || ""); } catch (_) { key = ""; }
        if (!key) continue;
        if (staleCountriesPattern.test(key)) {
          try { storage.removeItem(key); } catch (_) {}
        }
      }
    } catch (_) {}
  }

  installAuthSessionStorageBundle();
  runLocalStorageMaintenance();
  try { global.__runSiteLocalStorageMaintenance = runLocalStorageMaintenance; } catch (_) {}

  function isPlainObject(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
  }

  function mergeObjects(base, extra) {
    var out = Object.assign({}, isPlainObject(base) ? base : {});
    if (!isPlainObject(extra)) return out;
    Object.keys(extra).forEach(function (key) {
      var nextValue = extra[key];
      if (isPlainObject(out[key]) && isPlainObject(nextValue)) {
        out[key] = mergeObjects(out[key], nextValue);
        return;
      }
      if (nextValue !== undefined) out[key] = nextValue;
    });
    return out;
  }

  function trimText(value, fallback) {
    var text = String(value == null ? "" : value).trim();
    return text || String(fallback == null ? "" : fallback).trim();
  }

  function normalizeHttpBase(value) {
    var raw = String(value == null ? "" : value).trim();
    if (!raw) return "";
    try {
      var candidate = /^https?:\/\//i.test(raw) ? raw : ("https://" + raw);
      var parsed = new URL(candidate);
      if (!/^https?:$/i.test(parsed.protocol)) return "";
      var hostname = String(parsed.hostname || "").trim().toLowerCase();
      if (hostname === "njad.store") hostname = SITE_CORE_CANONICAL_API_HOST;
      var canonicalHost = (/^api\./i.test(hostname) && hostname !== SITE_CORE_CANONICAL_API_HOST && /\.(?:shop|store)$/i.test(hostname))
        ? SITE_CORE_CANONICAL_API_HOST
        : hostname;
      var cleanPath = String(parsed.pathname || "").replace(/\/+$/, "");
      return parsed.protocol + "//" + canonicalHost + (parsed.port ? (":" + parsed.port) : "") + (cleanPath && cleanPath !== "/" ? cleanPath : "");
    } catch (_) {
      var noQuery = raw.split("#")[0].split("?")[0].replace(/\/+$/, "");
      if (!noQuery) return "";
      return /^https?:\/\//i.test(noQuery) ? noQuery : ("https://" + noQuery);
    }
  }

  function normalizeAdminPath(value, fallback) {
    var raw = trimText(value, fallback || "/admin");
    if (!raw) return "/admin";
    return raw.charAt(0) === "/" ? raw : ("/" + raw.replace(/^\/+/, ""));
  }

  function isLocalLikeHost(hostname) {
    var host = String(hostname == null ? "" : hostname).trim().toLowerCase();
    if (!host) return true;
    if (host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0" || host === "[::1]") return true;
    if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return true;
    return false;
  }

  function isWorkerRuntimeDevPort(port) {
    var normalized = String(port == null ? "" : port).trim();
    return normalized === "8787" || normalized === "8788" || normalized === "8789" || normalized === "8790";
  }

  function shouldProbeDerivedRuntimeConfigBase(base, currentRuntime) {
    var normalizedBase = normalizeHttpBase(base);
    if (!normalizedBase) return false;
    try {
      var parsed = new URL(normalizedBase);
      if (!isLocalLikeHost(parsed.hostname)) return true;
      if (isWorkerRuntimeDevPort(parsed.port)) return true;
      var runtime = normalizeRuntimePayload(currentRuntime) || {};
      var explicitBase = normalizeHttpBase(runtime.workers && runtime.workers.routerBase);
      return !!explicitBase && explicitBase === normalizedBase;
    } catch (_) {
      return true;
    }
  }

  function deriveWorkerBaseCandidatesFromLocation(loc) {
    var list = [];
    var seen = {};

    function push(value) {
      var normalized = normalizeHttpBase(value);
      if (!normalized || seen[normalized]) return;
      seen[normalized] = true;
      list.push(normalized);
    }

    try {
      if (!loc) return list;
      var origin = normalizeHttpBase(loc.origin || "");
      var protocol = String(loc.protocol || "https:").toLowerCase();
      var hostname = String(loc.hostname || "").trim().toLowerCase();
      if (!hostname) {
        push(origin);
        return list;
      }
      if (isLocalLikeHost(hostname)) {
        push(origin);
        return list;
      }
      var parts = hostname.split(".").filter(Boolean);
      if (!parts.length) {
        push(origin);
        return list;
      }
      if (parts[0] === "api") push(protocol + "//" + hostname);
      if (parts.length > 2) {
        push(protocol + "//" + ["api"].concat(parts.slice(1)).join("."));
        push(protocol + "//api." + hostname);
      } else {
        push(protocol + "//api." + hostname);
      }
      push(origin);
    } catch (_) {}

    return list;
  }

  function normalizeRuntimePayload(payload) {
    var parsed = payload;
    if (typeof parsed === "string") {
      var text = parsed.trim();
      if (!text) return null;
      try {
        parsed = JSON.parse(text);
      } catch (_) {
        return null;
      }
    }
    if (!isPlainObject(parsed)) return null;
    var source = isPlainObject(parsed.runtime) ? parsed.runtime : parsed;
    return {
      firebase: isPlainObject(source.firebase) ? source.firebase : {},
      workers: isPlainObject(source.workers) ? source.workers : {},
      brand: isPlainObject(source.brand) ? source.brand : {}
    };
  }

  function hasUsableFirebaseConfig(config) {
    var cfg = isPlainObject(config) ? config : {};
    return !!(
      trimText(cfg.apiKey, "") &&
      trimText(cfg.authDomain, "") &&
      trimText(cfg.projectId, "") &&
      trimText(cfg.appId, "")
    );
  }

  function isRuntimeBootstrapReady(config) {
    var runtime = normalizeRuntimePayload(config) || {};
    var workerBase = normalizeHttpBase(runtime.workers && runtime.workers.routerBase);
    return !!workerBase;
  }

  function readStorageValue(key) {
    var safeKey = String(key == null ? "" : key).trim();
    if (!safeKey) return "";
    try {
      return String(global.localStorage && global.localStorage.getItem(safeKey) || "").trim();
    } catch (_) {
      return "";
    }
  }

  var RUNTIME_CACHE_KEY = "site:runtime-config:v2";
  var RUNTIME_CACHE_TTL_MS = 10 * 60 * 1000;

  function readRuntimeCache() {
    try {
      var raw = readStorageValue(RUNTIME_CACHE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (isPlainObject(parsed) && isPlainObject(parsed.runtime)) {
        return {
          savedAt: Number(parsed.savedAt || 0),
          runtime: normalizeRuntimePayload(parsed.runtime) || {}
        };
      }
      var direct = normalizeRuntimePayload(parsed);
      if (!direct) return null;
      return { savedAt: 0, runtime: direct };
    } catch (_) {
      return null;
    }
  }

  function writeRuntimeCache(runtime) {
    try {
      var normalized = normalizeRuntimePayload(runtime);
      if (!normalized) return;
      global.localStorage.setItem(RUNTIME_CACHE_KEY, JSON.stringify({
        savedAt: Date.now(),
        runtime: normalized
      }));
    } catch (_) {}
  }

  function isFreshRuntimeCache(entry) {
    var savedAt = Number(entry && entry.savedAt || 0);
    if (!savedAt || !Number.isFinite(savedAt)) return false;
    return (Date.now() - savedAt) <= RUNTIME_CACHE_TTL_MS;
  }

  function appendUnique(list, seen, value) {
    var text = String(value == null ? "" : value).trim();
    if (!text || seen[text]) return;
    seen[text] = true;
    list.push(text);
  }

  function appendRuntimeConfigUrls(list, seen, base) {
    var normalizedBase = normalizeHttpBase(base);
    if (!normalizedBase) return;
    try {
      var parsed = new URL(normalizedBase);
      var actionUrl = new URL(parsed.toString());
      actionUrl.searchParams.set("action", "site-runtime-config");
      appendUnique(list, seen, actionUrl.toString());

      var modeUrl = new URL(parsed.toString());
      modeUrl.searchParams.set("mode", "site-runtime-config");
      appendUnique(list, seen, modeUrl.toString());

      appendUnique(list, seen, parsed.origin + "/site-runtime-config.json");
      appendUnique(list, seen, parsed.origin + "/site-runtime-config");
      if (parsed.pathname && parsed.pathname !== "/") {
        appendUnique(list, seen, parsed.toString().replace(/\/+$/, "") + "/site-runtime-config.json");
      }
    } catch (_) {}
  }

  function buildRuntimeConfigUrls(currentRuntime) {
    var urls = [];
    var seen = {};
    var runtime = normalizeRuntimePayload(currentRuntime) || {};
    var workerCfg = isPlainObject(runtime.workers) ? runtime.workers : {};
    var storageKeys = [
      workerCfg.routerBaseStorageKey,
      workerCfg.legacyWorkerStorageKey,
      "MANWAL_ROUTER_BASE",
      "edaa:worker"
    ];

    appendRuntimeConfigUrls(urls, seen, workerCfg.routerBase);
    for (var i = 0; i < storageKeys.length; i += 1) {
      appendRuntimeConfigUrls(urls, seen, readStorageValue(storageKeys[i]));
    }

    var derivedBases = deriveWorkerBaseCandidatesFromLocation(global.location);
    for (var j = 0; j < derivedBases.length; j += 1) {
      if (!shouldProbeDerivedRuntimeConfigBase(derivedBases[j], runtime)) continue;
      appendRuntimeConfigUrls(urls, seen, derivedBases[j]);
    }

    return urls;
  }

  function fetchRuntimeConfigAsync(urls) {
    if (!Array.isArray(urls) || !urls.length || typeof global.fetch !== "function") return Promise.resolve(null);
    for (var i = 0; i < urls.length; i += 1) {
      var url = String(urls[i] || "").trim();
      if (!url) continue;
      return new Promise(function (resolve) {
        var done = false;
        var timer = 0;
        var controller = null;
        function finish(value) {
          if (done) return;
          done = true;
          try { if (timer) global.clearTimeout(timer); } catch (_) {}
          resolve(value || null);
        }
        try {
          if (typeof global.AbortController === "function") {
            controller = new global.AbortController();
            timer = global.setTimeout(function () {
              try { controller.abort(); } catch (_) {}
              finish(null);
            }, 3500);
          }
          global.fetch(url, {
            headers: { Accept: "application/json" },
            cache: "no-store",
            signal: controller ? controller.signal : undefined
          })
            .then(function (res) {
              if (!res || !res.ok) return null;
              return res.text();
            })
            .then(function (text) {
              finish(normalizeRuntimePayload(text));
            })
            .catch(function () {
              finish(null);
            });
        } catch (_) {
          finish(null);
        }
      }).then(function (runtime) {
        if (runtime) return runtime;
        return fetchRuntimeConfigAsync(urls.slice(i + 1));
      });
    }
    return Promise.resolve(null);
  }

  var defaults = mergeObjects(
    SITE_CORE_DEFAULT_RUNTIME,
    isPlainObject(global.__SITE_CORE_DEFAULT_RUNTIME__) ? global.__SITE_CORE_DEFAULT_RUNTIME__ : {}
  );

  var existing = normalizeRuntimePayload(global.__SITE_RUNTIME_CONFIG__) || {
    firebase: {},
    workers: {},
    brand: {}
  };
  var cachedRuntimeEntry = readRuntimeCache();
  var discovered = (cachedRuntimeEntry && cachedRuntimeEntry.runtime) ? cachedRuntimeEntry.runtime : {
    firebase: {},
    workers: {},
    brand: {}
  };
  var bootstrapSeed = mergeObjects(discovered, existing);
  var shouldRefreshRuntimeConfig = !isRuntimeBootstrapReady(bootstrapSeed) || !isFreshRuntimeCache(cachedRuntimeEntry);
  var mergedExisting = mergeObjects(discovered, existing);
  var derivedWorkerBases = deriveWorkerBaseCandidatesFromLocation(global.location);
  var derivedWorkerBase = derivedWorkerBases.length ? derivedWorkerBases[0] : "";
  var runtime = {
    firebase: mergeObjects(mergedExisting.firebase, defaults.firebase),
    workers: mergeObjects(defaults.workers, mergedExisting.workers),
    brand: mergeObjects(defaults.brand, mergedExisting.brand)
  };

  try { delete runtime.firebase.databaseURL; } catch (_) { runtime.firebase.databaseURL = undefined; }
  runtime.workers.routerBase = normalizeHttpBase(runtime.workers.routerBase) || derivedWorkerBase || defaults.workers.routerBase;
  runtime.workers.routerBaseStorageKey = trimText(runtime.workers.routerBaseStorageKey, defaults.workers.routerBaseStorageKey);
  runtime.workers.legacyWorkerStorageKey = trimText(runtime.workers.legacyWorkerStorageKey, defaults.workers.legacyWorkerStorageKey);
  runtime.workers.authAction = trimText(runtime.workers.authAction, defaults.workers.authAction);
  try { delete runtime.workers.adminPath; } catch (_) { runtime.workers.adminPath = undefined; }
  runtime.brand.storeName = trimText(runtime.brand.storeName, defaults.brand.storeName);
  runtime.brand.tickerText = trimText(runtime.brand.tickerText, defaults.brand.tickerText);
  runtime.brand.waBadgeBrand = trimText(runtime.brand.waBadgeBrand, runtime.brand.storeName || defaults.brand.waBadgeBrand);

  global.__SITE_RUNTIME_CONFIG__ = runtime;
  try {
    var priorFirebaseEnvOk = (typeof global.__FIREBASE_ENV_OK__ === "boolean") ? global.__FIREBASE_ENV_OK__ : true;
    global.__FIREBASE_ENV_OK__ = priorFirebaseEnvOk && hasUsableFirebaseConfig(runtime.firebase);
    global.__SKIP_FIREBASE__ = !global.__FIREBASE_ENV_OK__;
  } catch (_) {}

  global.__getSiteFirebaseConfig = function () {
    var cfg = global.__SITE_RUNTIME_CONFIG__.firebase || {};
    return hasUsableFirebaseConfig(cfg) ? Object.assign({}, cfg) : null;
  };

  global.__getSiteFirebaseRuntimeConfig = function () {
    return Object.assign({}, global.__SITE_RUNTIME_CONFIG__.firebase || {});
  };

  global.__getSiteFirebaseProjectId = function () {
    var cfg = global.__SITE_RUNTIME_CONFIG__.firebase || {};
    return trimText(cfg.projectId, "");
  };

  global.__getSiteWorkersConfig = function () {
    return Object.assign({}, global.__SITE_RUNTIME_CONFIG__.workers || {});
  };

  global.__getSiteBrandConfig = function () {
    return Object.assign({}, global.__SITE_RUNTIME_CONFIG__.brand || {});
  };

  global.__normalizeSiteWorkerBase = normalizeHttpBase;

  global.__getSiteWorkerBaseDefault = function (options) {
    var opts = options || {};
    var base = normalizeHttpBase(global.__SITE_RUNTIME_CONFIG__.workers && global.__SITE_RUNTIME_CONFIG__.workers.routerBase) || derivedWorkerBase || defaults.workers.routerBase;
    return opts.trailingSlash && base ? (base + "/") : base;
  };

  global.__getSiteWorkerBase = function (options) {
    var opts = options || {};
    var cfg = global.__SITE_RUNTIME_CONFIG__.workers || {};
    var keys = [];
    if (opts.storageKey) keys.push(String(opts.storageKey).trim());
    if (cfg.routerBaseStorageKey) keys.push(String(cfg.routerBaseStorageKey).trim());
    if (cfg.legacyWorkerStorageKey) keys.push(String(cfg.legacyWorkerStorageKey).trim());
    var normalized = "";
    if (opts.allowStorageOverride === true) {
      for (var i = 0; i < keys.length; i += 1) {
        var key = keys[i];
        if (!key) continue;
        try {
          normalized = normalizeHttpBase(global.localStorage && global.localStorage.getItem(key));
        } catch (_) {
          normalized = "";
        }
        if (normalized) break;
      }
    }
    normalized = normalized || global.__getSiteWorkerBaseDefault({ trailingSlash: false });
    return opts.trailingSlash && normalized ? (normalized + "/") : normalized;
  };

  try {
    global.__FIREBASE_RUNTIME_CONFIG__ = Object.assign({}, runtime.firebase || {});
    global.__FIREBASE_CONFIG__ = hasUsableFirebaseConfig(runtime.firebase) ? Object.assign({}, runtime.firebase) : null;
  } catch (_) {
    global.__FIREBASE_RUNTIME_CONFIG__ = Object.assign({}, runtime.firebase || {});
    global.__FIREBASE_CONFIG__ = hasUsableFirebaseConfig(runtime.firebase) ? Object.assign({}, runtime.firebase) : null;
  }

  function applyRuntimeConfig(nextDiscovered) {
    var nextMergedExisting = mergeObjects(nextDiscovered || {}, existing);
    var nextRuntime = {
      firebase: mergeObjects(nextMergedExisting.firebase, defaults.firebase),
      workers: mergeObjects(defaults.workers, nextMergedExisting.workers),
      brand: mergeObjects(defaults.brand, nextMergedExisting.brand)
    };
    try { delete nextRuntime.firebase.databaseURL; } catch (_) { nextRuntime.firebase.databaseURL = undefined; }
    nextRuntime.workers.routerBase = normalizeHttpBase(nextRuntime.workers.routerBase) || derivedWorkerBase || defaults.workers.routerBase;
    nextRuntime.workers.routerBaseStorageKey = trimText(nextRuntime.workers.routerBaseStorageKey, defaults.workers.routerBaseStorageKey);
    nextRuntime.workers.legacyWorkerStorageKey = trimText(nextRuntime.workers.legacyWorkerStorageKey, defaults.workers.legacyWorkerStorageKey);
    nextRuntime.workers.authAction = trimText(nextRuntime.workers.authAction, defaults.workers.authAction);
    try { delete nextRuntime.workers.adminPath; } catch (_) { nextRuntime.workers.adminPath = undefined; }
    nextRuntime.brand.storeName = trimText(nextRuntime.brand.storeName, defaults.brand.storeName);
    nextRuntime.brand.tickerText = trimText(nextRuntime.brand.tickerText, defaults.brand.tickerText);
    nextRuntime.brand.waBadgeBrand = trimText(nextRuntime.brand.waBadgeBrand, nextRuntime.brand.storeName || defaults.brand.waBadgeBrand);
    global.__SITE_RUNTIME_CONFIG__ = nextRuntime;
    global.__FIREBASE_RUNTIME_CONFIG__ = Object.assign({}, nextRuntime.firebase || {});
    global.__FIREBASE_CONFIG__ = hasUsableFirebaseConfig(nextRuntime.firebase) ? Object.assign({}, nextRuntime.firebase) : null;
    try {
      global.__FIREBASE_ENV_OK__ = hasUsableFirebaseConfig(nextRuntime.firebase);
      global.__SKIP_FIREBASE__ = !global.__FIREBASE_ENV_OK__;
    } catch (_) {}
    try { global.dispatchEvent(new CustomEvent("site:runtime-config-ready", { detail: { runtime: nextRuntime } })); } catch (_) {}
  }

  function refreshRuntimeConfigAsync() {
    return fetchRuntimeConfigAsync(buildRuntimeConfigUrls(bootstrapSeed)).then(function (fetchedRuntime) {
      if (!fetchedRuntime) return null;
      discovered = mergeObjects(discovered, fetchedRuntime);
      writeRuntimeCache(discovered);
      applyRuntimeConfig(discovered);
      return global.__SITE_RUNTIME_CONFIG__;
    });
  }

  global.__refreshSiteRuntimeConfig = refreshRuntimeConfigAsync;
  if (shouldRefreshRuntimeConfig) {
    var scheduleRuntimeRefresh = function () { refreshRuntimeConfigAsync().catch(function () {}); };
    try {
      if (typeof global.requestIdleCallback === "function") {
        global.requestIdleCallback(scheduleRuntimeRefresh, { timeout: 2500 });
      } else {
        global.setTimeout(scheduleRuntimeRefresh, 800);
      }
    } catch (_) {
      global.setTimeout(scheduleRuntimeRefresh, 800);
    }
  }
})(window);

(function(){
  try {
    if (typeof SKIP_HEADER !== "undefined" && SKIP_HEADER) return;
    if (typeof firebase !== "undefined" && window.__ORIG_FIREBASE__) {
      if (window.__ORIG_FIREBASE__.auth) {
        firebase.auth = window.__ORIG_FIREBASE__.auth;
      }
      if (window.__ORIG_FIREBASE__.firestore) {
        firebase.firestore = window.__ORIG_FIREBASE__.firestore;
      }
    }
  } catch {}
  try {
    if (typeof window.__FIREBASE_ENV_OK__ === "boolean") {
      window.__SKIP_FIREBASE__ = !window.__FIREBASE_ENV_OK__;
    }
  } catch {}
})();

function navigateTo(href){
  try { sessionStorage.setItem("nav:fromHome", "1"); } catch {}
  var targetKey = href;
  var currentKey = location.pathname + location.search + location.hash;
  try {
    var targetUrl = new URL(href, location.href);
    targetKey = targetUrl.pathname + targetUrl.search + targetUrl.hash;
  } catch {}
  if (targetKey === currentKey){
    try {
      sessionStorage.removeItem("nav:loader:expected");
      sessionStorage.removeItem("nav:loader:showAt");
    } catch {}
    try { hidePageLoader(); } catch {}
    return;
  }
  var proceed = function () {
    try { showPageLoader(); } catch {}
    setTimeout(function(){ window.location.href = href; }, 120);
  };
  try {
    closeSidebarWithAnimation(220).finally(proceed);
  } catch {
    proceed();
  }
}

function navigateHomeHash(targetHash, routeKey){
  var file = (location.pathname.split("/").pop() || "").toLowerCase();
  var isHome = file === "" || file === "index.html";
  var keyLower = String(routeKey || "").toLowerCase();
  var isWalletFlowRoute = (keyLower === "deposit" || keyLower === "edaa" || keyLower === "withdraw" || keyLower === "sahb");
  try {
    var navKey = String(targetHash || "").trim() + "::" + keyLower;
    var navNow = Date.now();
    var lastNav = window.__LAST_HOME_HASH_NAV__ || null;
    if (lastNav && lastNav.key === navKey && (navNow - Number(lastNav.at || 0)) < 900) {
      try { console.info("[home-hash-nav] duplicate navigation skipped", { targetHash: targetHash, routeKey: keyLower }); } catch {}
      return;
    }
    window.__LAST_HOME_HASH_NAV__ = { key: navKey, at: navNow };
  } catch {}
  try { sessionStorage.setItem("nav:fromHome", "1"); } catch {}
  if (isHome) {
    var already = (location.hash || "") === targetHash;
    var proceedHome = function () {
      if (already){
        if (!isWalletFlowRoute) {
          try {
            sessionStorage.removeItem("nav:loader:expected");
            sessionStorage.removeItem("nav:loader:showAt");
          } catch {}
          try { if (typeof window.__setInlineWalletRoutePending === "function") window.__setInlineWalletRoutePending(false); } catch {}
          try { hidePageLoader(); } catch {}
        } else {
          try {
            if (typeof window.__setInlineWalletRoutePending === "function") window.__setInlineWalletRoutePending(true);
            if (typeof window.__holdPageLoader === "function") window.__holdPageLoader();
            window.__INLINE_WALLET_BOOT_HOLD__ = true;
          } catch {}
        }
        var key = routeKey || String(targetHash || "").replace(/^#\//, "");
        if (key && typeof window.__reloadInlineRoute === "function"){
          try { window.__INLINE_FORCE_ROUTE__ = key; } catch {}
          try { window.__reloadInlineRoute(key); } catch {}
        } else if (key){
          try { window.__INLINE_FORCE_ROUTE__ = null; } catch {}
        }
        return;
      }
      try {
        if (isWalletFlowRoute) {
          if (typeof window.__setInlineWalletRoutePending === "function") window.__setInlineWalletRoutePending(true);
          if (typeof window.__holdPageLoader === "function") window.__holdPageLoader();
          else showPageLoader({ hold: true });
          window.__INLINE_WALLET_BOOT_HOLD__ = true;
        } else {
          try {
            if (typeof window.__setInlineRouteTransitionPending === "function") {
              window.__setInlineRouteTransitionPending(true, { token: Date.now(), key: keyLower || routeKey || "" });
            }
          } catch {}
          try { if (typeof window.__setInlineWalletRoutePending === "function") window.__setInlineWalletRoutePending(false); } catch {}
          showPageLoader();
        }
      } catch {}
      setTimeout(function () { window.location.hash = targetHash; }, 80);
    };
    try {
      closeSidebarWithAnimation(220).finally(proceedHome);
    } catch {
      proceedHome();
    }
  } else {
    navigateTo("index.html" + targetHash);
  }
}

async function ensureFirebaseCompat(){
  try { if (typeof window.__FIREBASE_ENV_OK__ === "boolean" && !window.__FIREBASE_ENV_OK__) return false; } catch {}
  if (typeof firebase !== "undefined" && firebase.auth && firebase.firestore) return true;
  try {
    if (typeof window.__loadFirebaseCompat === "function") {
      var loaded = await window.__loadFirebaseCompat();
      if (loaded && typeof firebase !== "undefined" && firebase.auth && firebase.firestore) return true;
    }
  } catch {}
  return new Promise(function (resolve) {
    try {
      var settled = false;
      var sources = [
        "/vendor/firebase/9.23.0/firebase-app-compat.js",
        "/vendor/firebase/9.23.0/firebase-auth-compat.js",
        "/vendor/firebase/9.23.0/firebase-firestore-compat.js"
      ];
      var isScriptReady = function (src) {
        var url = String(src || "").toLowerCase();
        if (url.indexOf("firebase-auth-compat") >= 0) {
          return typeof firebase !== "undefined" && firebase && typeof firebase.initializeApp === "function" && typeof firebase.auth === "function";
        }
        if (url.indexOf("firebase-firestore-compat") >= 0) {
          return typeof firebase !== "undefined" && firebase && typeof firebase.initializeApp === "function" && typeof firebase.firestore === "function";
        }
        return typeof firebase !== "undefined" && firebase && typeof firebase.initializeApp === "function";
      };
      var add = function (src) {
        return new Promise(function (done) {
          try {
            if (isScriptReady(src)) return done(true);
            var scripts = Array.prototype.slice.call(document.querySelectorAll("script")).filter(function (node) {
              var dataSrc = node && node.dataset ? String(node.dataset.firebaseSrc || "") : "";
              var rawSrc = node && node.getAttribute ? String(node.getAttribute("src") || "") : "";
              var resolvedSrc = node && node.src ? String(node.src) : "";
              return dataSrc === src || rawSrc === src || resolvedSrc === src;
            });
            var existing = scripts.find(function (node) {
              return !(node.dataset && (node.dataset.loaded === "1" || node.dataset.failed === "1"));
            });
            var timer = null;
            var finish = function () {
              try { if (timer) clearTimeout(timer); } catch {}
              done(isScriptReady(src));
            };
            if (existing) {
              existing.addEventListener("load", function () {
                try { if (existing.dataset) existing.dataset.loaded = "1"; } catch {}
                finish();
              }, { once: true });
              existing.addEventListener("error", function () {
                try { if (existing.dataset) existing.dataset.failed = "1"; } catch {}
                finish();
              }, { once: true });
              timer = setTimeout(finish, 7000);
              return;
            }
            var s = document.createElement("script");
            s.src = src;
            s.defer = true;
            s.async = false;
            try { s.dataset.firebaseSrc = src; } catch {}
            s.onload = function () {
              try { s.dataset.loaded = "1"; } catch {}
              finish();
            };
            s.onerror = function () {
              try { s.dataset.failed = "1"; } catch {}
              finish();
            };
            timer = setTimeout(finish, 7000);
            document.head.appendChild(s);
          } catch { done(false); }
        });
      };
      function check(){
        if (settled) return;
        if (typeof firebase !== "undefined" && firebase.auth && firebase.firestore) {
          settled = true;
          resolve(true);
        }
      }
      sources.reduce(function (chain, src) {
        return chain.then(function (ok) {
          if (!ok) return false;
          return add(src);
        });
      }, Promise.resolve(true)).then(function () {
        check();
        if (!settled) {
          settled = true;
          resolve(false);
        }
      });
      setTimeout(function(){
        if (settled) return;
        settled = true;
        resolve(false);
      }, 18000);
    } catch { resolve(false); }
  });
}

async function initFirebaseApp(){
  try {
    try { if (typeof window.__FIREBASE_ENV_OK__ === "boolean" && !window.__FIREBASE_ENV_OK__) return false; } catch {}
    var ok = await ensureFirebaseCompat();
    if (!ok || typeof firebase === "undefined") return false;
    if (!firebase.apps || !firebase.apps.length){
      try {
        var firebaseConfig = window.__getSiteFirebaseConfig
          ? window.__getSiteFirebaseConfig()
          : (window.__FIREBASE_CONFIG__ || {});
        if (!firebaseConfig || !firebaseConfig.apiKey) return false;
        firebase.initializeApp(firebaseConfig);
      } catch {}
    }
    try { window.dispatchEvent(new Event("firebase:ready")); } catch {}
    return true;
  } catch { return false; }
}

try {
  window.navigateTo = navigateTo;
  window.navigateHomeHash = navigateHomeHash;
  window.ensureFirebaseCompat = ensureFirebaseCompat;
  window.initFirebaseApp = initFirebaseApp;
} catch {}
