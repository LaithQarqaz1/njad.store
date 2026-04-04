// Quick-edit defaults: static frontend Firebase config lives here for GitHub/static hosting.
// Backend workers must still use secret bindings separately.
var SITE_CORE_PROJECT_TOKEN = "njadstore1";
var SITE_CORE_FIREBASE_FRONTEND_CONFIG = {
  apiKey: "AIzaSyBaJE8eTuSZUfjLw3lj-788iTvR7YJvWj8",
  authDomain: SITE_CORE_PROJECT_TOKEN + ".firebaseapp.com",
  projectId: SITE_CORE_PROJECT_TOKEN,
  storageBucket: SITE_CORE_PROJECT_TOKEN + ".firebasestorage.app",
  messagingSenderId: "1072422740336",
  appId: "1:1072422740336:web:28abfc7058d310379dafb5",
  measurementId: "G-T2J947YL3L"
};
var SITE_CORE_CANONICAL_API_HOST = ["api", "njad", "store"].join(".");
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
    storeName: "",
    tickerText: "",
    waBadgeBrand: ""
  }
};

try { window.__SITE_CORE_DEFAULT_RUNTIME__ = SITE_CORE_DEFAULT_RUNTIME; } catch {}

// Shared runtime/bootstrap and app helpers used by header.js and related pages.

(function (global) {
  "use strict";

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

  var RUNTIME_CACHE_KEY = "site:runtime-config:v1";
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

  function fetchRuntimeConfigSync(urls) {
    if (!Array.isArray(urls) || !urls.length || typeof global.XMLHttpRequest !== "function") return null;
    for (var i = 0; i < urls.length; i += 1) {
      var url = String(urls[i] || "").trim();
      if (!url) continue;
      try {
        var xhr = new global.XMLHttpRequest();
        xhr.open("GET", url, false);
        xhr.setRequestHeader("Accept", "application/json");
        xhr.send(null);
        if (xhr.status >= 200 && xhr.status < 300) {
          var runtime = normalizeRuntimePayload(xhr.responseText);
          if (runtime) return runtime;
        }
      } catch (_) {}
    }
    return null;
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
  if (!isRuntimeBootstrapReady(bootstrapSeed) || !isFreshRuntimeCache(cachedRuntimeEntry)) {
    var fetchedRuntime = fetchRuntimeConfigSync(buildRuntimeConfigUrls(bootstrapSeed));
    if (fetchedRuntime) {
      discovered = mergeObjects(discovered, fetchedRuntime);
      writeRuntimeCache(discovered);
    }
  }
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
  return new Promise(function (resolve) {
    try {
      var add = function (src) {
        var s = document.createElement("script");
        s.src = src;
        s.defer = true;
        s.onload = check;
        document.head.appendChild(s);
      };
      function check(){
        if (typeof firebase !== "undefined" && firebase.auth && firebase.firestore) resolve(true);
      }
      add("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
      add("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js");
      add("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js");
      setTimeout(function(){ resolve(false); }, 4000);
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
