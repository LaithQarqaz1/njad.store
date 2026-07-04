(function(){
  'use strict';
  if (window.__LOGIN_INLINE_BOOTED__) return;
  window.__LOGIN_INLINE_BOOTED__ = true;

  let lastLoginEmail = "";
  let lastLoginPassword = "";
  let activeModalId = null;
  let verificationTimer = null;
  let resetBusy = false;
  let pendingTotpResolve = null;
  let pendingTotpEmailRequest = null;
  let pendingTotpEmailBusy = false;
  let pendingTotpLostRequest = null;
  let pendingTotpLostVerify = null;
  let pendingTotpLostDisable = null;
  let pendingTotpLostBusy = false;
  let pendingTotpLostMode = false;
  let pendingTotpEmailSent = false;
  let pendingTotpLostSent = false;
  let loginBound = false;
  let modalBound = false;
  let googleBusy = false;
  const TOTP_EMAIL_RESEND_COOLDOWN_SECONDS = 60;
  let pendingTotpEmailCooldownUntilMs = 0;
  let pendingTotpLostCooldownUntilMs = 0;
  let pendingTotpCooldownTimer = null;
  let totpModalMethod = "";

  const firebaseConfig = window.__getSiteFirebaseConfig
    ? window.__getSiteFirebaseConfig()
    : (window.__FIREBASE_CONFIG__ || null);

  // Firebase frontend config is fetched asynchronously (runtime-config) and cached, so the value
  // captured above is null on a cold first load and only becomes available after a reload. Resolve
  // it live on every read so Google sign-in works on the first load too.
  function resolveSiteFirebaseConfig() {
    try {
      if (typeof window.__getSiteFirebaseConfig === "function") {
        const live = window.__getSiteFirebaseConfig();
        if (live && typeof live === "object") return live;
      }
    } catch (_) {}
    try {
      const fallback = window.__FIREBASE_CONFIG__;
      if (fallback && typeof fallback === "object") return fallback;
    } catch (_) {}
    return (firebaseConfig && typeof firebaseConfig === "object") ? firebaseConfig : null;
  }

  function readSiteSetting(path, fallback) {
    try {
      if (typeof window.__getSiteSetting === "function") {
        const value = window.__getSiteSetting(path, fallback);
        return value == null ? fallback : value;
      }
    } catch (_) {}
    return fallback;
  }

  function normalizeGoogleRedirectOrigin(value) {
    const text = String(value || "").trim().replace(/\/+$/, "");
    if (!text) return "";
    try { return new URL(text).origin; } catch (_) { return text; }
  }

  function hasFirebaseWebConfig() {
    const cfg = resolveSiteFirebaseConfig();
    if (!cfg) return false;
    return !!(
      String(cfg.apiKey || "").trim() &&
      String(cfg.authDomain || "").trim() &&
      String(cfg.projectId || "").trim() &&
      String(cfg.appId || "").trim()
    );
  }

  function getFirebaseFrontendUnavailableMessage(feature = "") {
    const key = String(feature || "").trim().toLowerCase();
    if (key === "google") {
      return "تسجيل Google غير مفعّل في هذه الواجهة لأن Firebase frontend config غير منشور. تسجيل البريد وكلمة المرور يعمل عبر الراوتر الموحد فقط.";
    }
    if (key === "reset") {
      return "استعادة كلمة المرور من الواجهة غير متاحة لأن Firebase frontend config غير منشور.";
    }
    if (key === "verification") {
      return "إعادة إرسال رابط التحقق من الواجهة غير متاحة لأن Firebase frontend config غير منشور.";
    }
    return "ميزات Firebase في الواجهة غير مفعلة هنا، والاعتماد الحالي يتم عبر الراوتر الموحد فقط.";
  }

  let auth = null;
  let db = null;
  let firebaseReady = false;
  let googleProvider = null;
  const LEGAL_CONSENT_STORAGE_KEY = "site:legal:consent:v1";
  const LEGAL_CONSENT_VERSION = "2026-02-18";
  const GOOGLE_FLOW_LOG_KEY = "site:google:flow:logs:v1";
  const GOOGLE_FLOW_TASK_KEY = "site:google:flow:task:v1";
  const GOOGLE_REDIRECT_PENDING_KEY = "site:google:redirect:pending:v1";
  const GOOGLE_REDIRECT_PENDING_TTL_MS = 15 * 60 * 1000;
  const GOOGLE_REDIRECT_NAVIGATION_LOADER_GRACE_MS = 1800;
  const GOOGLE_AUTHORIZED_ORIGIN = normalizeGoogleRedirectOrigin(
    readSiteSetting("auth.googleRedirectOrigin", "") ||
    (firebaseConfig && firebaseConfig.authDomain ? ("https://" + firebaseConfig.authDomain) : "") ||
    (window.location && window.location.origin) ||
    ""
  );
  const GOOGLE_AUTHORIZED_REDIRECT_URI = String(
    readSiteSetting("auth.googleRedirectUri", "") ||
    (GOOGLE_AUTHORIZED_ORIGIN + String(readSiteSetting("auth.googleRedirectPath", "/__/auth/handler") || "/__/auth/handler"))
  ).trim();
  const TOTP_RECOVERY_DISABLED_SIGNAL = "__totp_recovery_disabled__";
  const GOOGLE_FLOW_LOG_LIMIT = 30;
  const GOOGLE_FLOW_DEBUG_STORAGE_KEY = "site:google:flow:debug";
  const googleFlowMemoryLogs = [];
  let googleFlowStorageDebugEnabled = null;
  const FIREBASE_COMPAT_SOURCES = [
    "/vendor/firebase/9.23.0/firebase-app-compat.js",
    "/vendor/firebase/9.23.0/firebase-auth-compat.js",
    "/vendor/firebase/9.23.0/firebase-firestore-compat.js"
  ];
  const FIREBASE_COMPAT_SCRIPT_TIMEOUT_MS = 7000;
  const FIREBASE_COMPAT_FAILURE_COOLDOWN_MS = 15000;
  let firebaseCompatLoadPromise = null;
  let firebaseCompatLastFailureAt = 0;
  let authPersistenceReady = false;
  let authPersistencePromise = null;
  let googleRedirectResultHandled = false;

  function maskDebugUid(uid = "") {
    const raw = String(uid || "").trim();
    if (!raw) return "";
    if (raw.length <= 8) return raw;
    return raw.slice(0, 4) + "..." + raw.slice(-4);
  }

  function normalizeDebugValue(value, depth = 0) {
    if (depth > 2) return "[depth-limit]";
    if (value === null || value === undefined) return value;
    const t = typeof value;
    if (t === "string") return value.slice(0, 240);
    if (t === "number" || t === "boolean") return value;
    if (Array.isArray(value)) {
      return value.slice(0, 12).map((item) => normalizeDebugValue(item, depth + 1));
    }
    if (t === "object") {
      const out = {};
      const keys = Object.keys(value).slice(0, 24);
      keys.forEach((key) => {
        if (/(token|password|secret|session|authkey|customtoken|idtoken|refresh)/i.test(key)) {
          out[key] = "[redacted]";
          return;
        }
        out[key] = normalizeDebugValue(value[key], depth + 1);
      });
      return out;
    }
    return String(value);
  }

  function isGoogleFlowStorageDebugEnabled() {
    if (googleFlowStorageDebugEnabled !== null) return googleFlowStorageDebugEnabled;
    let enabled = false;
    try {
      enabled = !!(
        window.__GOOGLE_FLOW_DEBUG__ === true ||
        /(?:^|[?&])googleFlowDebug=1(?:&|$)/.test(String(location.search || "")) ||
        localStorage.getItem(GOOGLE_FLOW_DEBUG_STORAGE_KEY) === "1"
      );
    } catch (_) {
      enabled = false;
    }
    googleFlowStorageDebugEnabled = enabled;
    if (!enabled) {
      try { localStorage.removeItem(GOOGLE_FLOW_LOG_KEY); } catch (_) {}
    }
    return enabled;
  }

  function readGoogleFlowLogs() {
    if (!isGoogleFlowStorageDebugEnabled()) return googleFlowMemoryLogs.slice();
    try {
      const raw = localStorage.getItem(GOOGLE_FLOW_LOG_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (_) {
      return [];
    }
  }

  function writeGoogleFlowLogs(list) {
    if (!isGoogleFlowStorageDebugEnabled()) return;
    try { localStorage.setItem(GOOGLE_FLOW_LOG_KEY, JSON.stringify(list)); } catch (_) {}
  }

  function readGoogleFlowTask() {
    try {
      const raw = localStorage.getItem(GOOGLE_FLOW_TASK_KEY);
      if (!raw) return null;
      const payload = JSON.parse(raw);
      return payload && typeof payload === "object" ? payload : null;
    } catch (_) {
      return null;
    }
  }

  function setGoogleFlowTask(task, meta = {}) {
    const payload = {
      task: String(task || "").slice(0, 120),
      ts: Date.now(),
      at: new Date().toISOString(),
      path: (() => {
        try { return location.pathname + location.search + location.hash; } catch (_) { return ""; }
      })(),
      meta: normalizeDebugValue(meta)
    };
    try { localStorage.setItem(GOOGLE_FLOW_TASK_KEY, JSON.stringify(payload)); } catch (_) {}
  }

  function clearGoogleFlowTask() {
    try { localStorage.removeItem(GOOGLE_FLOW_TASK_KEY); } catch (_) {}
  }

  function pushGoogleFlowLog(step, meta = {}) {
    const entry = {
      ts: Date.now(),
      at: new Date().toISOString(),
      step: String(step || "").slice(0, 120),
      path: (() => {
        try { return location.pathname + location.search + location.hash; } catch (_) { return ""; }
      })(),
      meta: normalizeDebugValue(meta)
    };
    googleFlowMemoryLogs.push(entry);
    if (googleFlowMemoryLogs.length > GOOGLE_FLOW_LOG_LIMIT) {
      googleFlowMemoryLogs.splice(0, googleFlowMemoryLogs.length - GOOGLE_FLOW_LOG_LIMIT);
    }
    writeGoogleFlowLogs(googleFlowMemoryLogs.slice());
  }

  function getErrorMeta(err) {
    return {
      code: String((err && err.code) || ""),
      message: String((err && err.message) || "").slice(0, 240)
    };
  }

  function logGoogleConsole(level, message, meta) {
    try {
      const payload = meta && typeof meta === "object" ? normalizeDebugValue(meta) : {};
      const fn = (level === "error" && console && console.error)
        ? console.error
        : (level === "warn" && console && console.warn)
          ? console.warn
          : console.log;
      if (typeof fn === "function") fn.call(console, "[GoogleLogin] " + String(message || ""), payload);
    } catch (_) {}
  }

  try {
    window.__googleFlowDebug = {
      getLogs: () => readGoogleFlowLogs(),
      getTask: () => readGoogleFlowTask(),
      printLatest: () => {
        try {
          const logs = readGoogleFlowLogs();
          const latest = logs.slice(-12);
          console.table(latest.map((item) => ({
            at: item && item.at ? item.at : "",
            step: item && item.step ? item.step : "",
            meta: item && item.meta ? JSON.stringify(item.meta).slice(0, 220) : ""
          })));
        } catch (_) {}
      },
      clear: () => {
        try { googleFlowMemoryLogs.splice(0, googleFlowMemoryLogs.length); } catch (_) {}
        try { localStorage.removeItem(GOOGLE_FLOW_LOG_KEY); } catch (_) {}
        clearGoogleFlowTask();
      }
    };
  } catch (_) {}

  pushGoogleFlowLog("login_inline_boot", {
    currentTask: (() => {
      const task = readGoogleFlowTask();
      return task && task.task ? task.task : "";
    })()
  });

  function isFirebaseProtocolSupported() {
    try {
      const p = String((location && location.protocol) || "").toLowerCase();
      return p === "http:" || p === "https:" || p === "chrome-extension:";
    } catch (_) {
      return false;
    }
  }

  function hasUsableStorage(name) {
    try {
      const store = window && window[name];
      if (!store) return false;
      const key = "__fb_storage_test__" + Math.random().toString(36).slice(2);
      store.setItem(key, "1");
      store.removeItem(key);
      return true;
    } catch (_) {
      return false;
    }
  }

  function shouldBypassSkipFirebase() {
    let skip = false;
    try { skip = window.__SKIP_FIREBASE__ === true; } catch (_) { skip = false; }
    if (!skip) return false;
    if (!hasFirebaseWebConfig()) return false;
    if (!isFirebaseProtocolSupported()) return false;
    // If Firebase auth runtime already exists, prefer trying it rather than blocking by stale skip flag.
    try {
      if (hasFirebaseCompatRuntime() && firebase && typeof firebase.auth === "function") return true;
    } catch (_) {}
    if (!hasUsableStorage("localStorage")) return false;
    if (!hasUsableStorage("sessionStorage")) return false;
    return true;
  }

  function tryBypassSkipFirebaseForLogin() {
    if (!shouldBypassSkipFirebase()) return false;
    try { window.__SKIP_FIREBASE__ = false; } catch (_) {}
    pushGoogleFlowLog("firebase_skip_bypassed_for_login");
    return true;
  }

  function hasFirebaseCompatRuntime() {
    return typeof firebase !== "undefined" && !!firebase && typeof firebase.initializeApp === "function";
  }

  function hasFirebaseAuthCompatRuntime() {
    return hasFirebaseCompatRuntime() && typeof firebase.auth === "function";
  }

  function hasFirebaseFirestoreCompatRuntime() {
    return hasFirebaseCompatRuntime() && typeof firebase.firestore === "function";
  }

  function hasFirebaseCompatFullRuntime() {
    return hasFirebaseCompatRuntime() && hasFirebaseAuthCompatRuntime() && hasFirebaseFirestoreCompatRuntime();
  }

  function isFirebaseCompatSourceReady(src) {
    const url = String(src || "").toLowerCase();
    if (url.indexOf("firebase-auth-compat") >= 0) {
      return hasFirebaseAuthCompatRuntime() && !!(firebase.auth && firebase.auth.GoogleAuthProvider);
    }
    if (url.indexOf("firebase-firestore-compat") >= 0) {
      return hasFirebaseFirestoreCompatRuntime();
    }
    return hasFirebaseCompatRuntime();
  }

  function getFirebaseCompatScriptNodes(src) {
    try {
      return Array.from(document.querySelectorAll("script")).filter((node) => {
        if (!node) return false;
        const dataSrc = node.dataset && node.dataset.firebaseSrc ? String(node.dataset.firebaseSrc) : "";
        const rawSrc = node.getAttribute ? String(node.getAttribute("src") || "") : "";
        const resolvedSrc = node.src ? String(node.src) : "";
        return dataSrc === src || rawSrc === src || resolvedSrc === src;
      });
    } catch (_) {
      return [];
    }
  }

  function loadScriptOnce(src, timeoutMs = FIREBASE_COMPAT_SCRIPT_TIMEOUT_MS) {
    return new Promise((resolve, reject) => {
      let script = null;
      let done = false;
      let timer = null;
      const finish = (ok) => {
        if (done) return;
        done = true;
        try { if (timer) clearTimeout(timer); } catch (_) {}
        try {
          if (script) {
            script.removeEventListener("load", onLoad);
            script.removeEventListener("error", onError);
          }
        } catch (_) {}
        if (ok) resolve(true);
        else reject(new Error("firebase_load_failed"));
      };
      const onLoad = () => {
        try { if (script && script.dataset) script.dataset.loaded = "1"; } catch (_) {}
        finish(isFirebaseCompatSourceReady(src));
      };
      const onError = () => finish(false);
      try {
        const scripts = getFirebaseCompatScriptNodes(src);
        if (isFirebaseCompatSourceReady(src)) {
          scripts.forEach((node) => { try { if (node.dataset) node.dataset.loaded = "1"; } catch (_) {} });
          resolve(true);
          return;
        }
        script = scripts.find((node) => !(node.dataset && (node.dataset.loaded === "1" || node.dataset.failed === "1"))) || null;
        if (script) {
          if (isFirebaseCompatSourceReady(src)) {
            try { if (script.dataset) script.dataset.loaded = "1"; } catch (_) {}
            resolve(true);
            return;
          }
          script.addEventListener("load", onLoad, { once: true });
          script.addEventListener("error", onError, { once: true });
          timer = setTimeout(() => finish(isFirebaseCompatSourceReady(src)), Math.max(2000, Number(timeoutMs) || 0));
          return;
        }
        script = document.createElement("script");
        script.src = src;
        script.defer = true;
        script.async = false;
        script.dataset.firebaseSrc = src;
        script.addEventListener("load", onLoad, { once: true });
        script.addEventListener("error", () => {
          try { if (script && script.dataset) script.dataset.failed = "1"; } catch (_) {}
          onError();
        }, { once: true });
        timer = setTimeout(() => finish(isFirebaseCompatSourceReady(src)), Math.max(2000, Number(timeoutMs) || 0));
        (document.head || document.documentElement).appendChild(script);
      } catch (_) {
        finish(false);
      }
    });
  }

  function loadFirebaseCompatFallback() {
    if (hasFirebaseCompatFullRuntime()) return Promise.resolve(true);
    if (firebaseCompatLastFailureAt && (Date.now() - firebaseCompatLastFailureAt) < FIREBASE_COMPAT_FAILURE_COOLDOWN_MS) {
      return Promise.resolve(false);
    }
    if (firebaseCompatLoadPromise) return firebaseCompatLoadPromise;
    firebaseCompatLoadPromise = FIREBASE_COMPAT_SOURCES.reduce((chain, src) => {
      return chain.then((ok) => {
        if (!ok) return false;
        return loadScriptOnce(src)
          .then(() => true)
          .catch(() => false);
      });
    }, Promise.resolve(true))
      .then((ok) => !!ok && hasFirebaseCompatFullRuntime())
      .catch(() => false)
      .finally(() => {
        if (!hasFirebaseCompatFullRuntime()) {
          firebaseCompatLastFailureAt = Date.now();
          window.setTimeout(function(){
            if ((Date.now() - firebaseCompatLastFailureAt) >= FIREBASE_COMPAT_FAILURE_COOLDOWN_MS) {
              firebaseCompatLoadPromise = null;
            }
          }, FIREBASE_COMPAT_FAILURE_COOLDOWN_MS);
        }
      });
    return firebaseCompatLoadPromise;
  }

  function ensureFirebaseCompat(){
    if (firebaseReady && auth) return true;
    let skip = false;
    try { skip = window.__SKIP_FIREBASE__ === true; } catch (_) { skip = false; }
    const skipBypassed = skip && shouldBypassSkipFirebase();
    if (skipBypassed) {
      try { window.__SKIP_FIREBASE__ = false; } catch (_) {}
      pushGoogleFlowLog("firebase_skip_bypassed_runtime");
      logGoogleConsole("warn", "firebase_skip_bypassed_runtime", {
        hasFirebase: hasFirebaseCompatRuntime(),
        hasAuthFn: typeof firebase !== "undefined" && firebase && typeof firebase.auth === "function"
      });
    }
    if (skip && !skipBypassed) return false;
    if (!hasFirebaseCompatRuntime()) return false;
    try {
      const liveFirebaseConfig = resolveSiteFirebaseConfig();
      if ((!firebase.apps || !firebase.apps.length) && liveFirebaseConfig) {
        firebase.initializeApp(liveFirebaseConfig);
      } else if (firebase.apps && firebase.apps.length) {
        firebase.app();
      }
    } catch (_) {}
    try {
      auth = (firebase && typeof firebase.auth === "function") ? firebase.auth() : null;
    } catch (_) {
      auth = null;
    }
    try {
      db = (firebase && typeof firebase.firestore === "function") ? firebase.firestore() : null;
    } catch (_) {
      db = null;
    }
    firebaseReady = !!auth;
    return firebaseReady;
  }

  async function ensureFirebaseCompatAsync(){
    if (ensureFirebaseCompat()) return true;
    if (!isFirebaseProtocolSupported()) return false;
    if (firebaseCompatLastFailureAt && (Date.now() - firebaseCompatLastFailureAt) < FIREBASE_COMPAT_FAILURE_COOLDOWN_MS) {
      return false;
    }
    tryBypassSkipFirebaseForLogin();
    const loaders = [];
    if (typeof window.__loadFirebaseCompat === "function") {
      loaders.push({ name: "window_loader", fn: () => window.__loadFirebaseCompat() });
    }
    loaders.push({ name: "inline_loader", fn: () => loadFirebaseCompatFallback() });
    for (let i = 0; i < loaders.length; i++) {
      const loader = loaders[i];
      try {
        const ok = await loader.fn();
        pushGoogleFlowLog("firebase_compat_loader_done", { loader: loader.name, ok: !!ok });
        if (ok) logGoogleConsole("log", "firebase_compat_loader_done", { loader: loader.name, ok: !!ok });
      } catch (_) {
        pushGoogleFlowLog("firebase_compat_loader_error", { loader: loader.name });
        logGoogleConsole("error", "firebase_compat_loader_error", { loader: loader.name });
      }
      if (ensureFirebaseCompat()) return true;
    }
    let skipFlag = null;
    try { skipFlag = window.__SKIP_FIREBASE__ === true; } catch (_) { skipFlag = null; }
    pushGoogleFlowLog("firebase_compat_unavailable", {
      skipFlag: skipFlag,
      hasFirebase: hasFirebaseCompatRuntime(),
      hasAuthFn: typeof firebase !== "undefined" && firebase && typeof firebase.auth === "function",
      hasFirestoreFn: typeof firebase !== "undefined" && firebase && typeof firebase.firestore === "function",
      protocol: (() => { try { return String(location.protocol || ""); } catch (_) { return ""; } })()
    });
    logGoogleConsole("warn", "firebase_compat_unavailable", {
      skipFlag: skipFlag,
      hasFirebase: hasFirebaseCompatRuntime(),
      hasAuthFn: typeof firebase !== "undefined" && firebase && typeof firebase.auth === "function",
      hasFirestoreFn: typeof firebase !== "undefined" && firebase && typeof firebase.firestore === "function",
      protocol: (() => { try { return String(location.protocol || ""); } catch (_) { return ""; } })()
    });
    firebaseCompatLastFailureAt = Date.now();
    return false;
  }

  function resolveFirebaseLocalPersistence() {
    try {
      const persistence = firebase?.auth?.Auth?.Persistence?.LOCAL;
      if (persistence) return persistence;
    } catch (_) {}
    try {
      const persistence = window?.firebase?.auth?.Auth?.Persistence?.LOCAL;
      if (persistence) return persistence;
    } catch (_) {}
    return null;
  }

  async function ensureAuthPersistenceLocal() {
    if (authPersistenceReady) return true;
    if (authPersistencePromise) return authPersistencePromise;
    authPersistencePromise = (async () => {
      await ensureFirebaseCompatAsync();
      if (!auth || typeof auth.setPersistence !== "function") {
        authPersistenceReady = true;
        return true;
      }
      const persistence = resolveFirebaseLocalPersistence();
      if (!persistence) {
        authPersistenceReady = true;
        return true;
      }
      try {
        await auth.setPersistence(persistence);
        authPersistenceReady = true;
        return true;
      } catch (err) {
        pushGoogleFlowLog("firebase_auth_persistence_failed", { error: getErrorMeta(err) });
        logGoogleConsole("warn", "firebase_auth_persistence_failed", { error: getErrorMeta(err) });
        return false;
      }
    })().finally(() => {
      authPersistencePromise = null;
    });
    return authPersistencePromise;
  }

  function ensureGoogleProvider(){
    if (!ensureFirebaseCompat()) return null;
    if (!googleProvider && firebase && firebase.auth && typeof firebase.auth.GoogleAuthProvider === 'function') {
      googleProvider = new firebase.auth.GoogleAuthProvider();
      try { googleProvider.setCustomParameters({ prompt: 'select_account' }); } catch (_) {}
    }
    return googleProvider;
  }

  const DEVICE_ID_STORAGE_KEY = "session:device:id";
  const DEVICE_INSTANCE_SEED_STORAGE_KEY = "session:device:seed";
  function generateDeviceId(){
    try {
      if (window.crypto && typeof window.crypto.randomUUID === "function") {
        return window.crypto.randomUUID();
      }
    } catch (_) {}
    const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
    const size = 24;
    let out = "";
    try {
      if (window.crypto && typeof window.crypto.getRandomValues === "function") {
        const buf = new Uint8Array(size);
        window.crypto.getRandomValues(buf);
        for (let i = 0; i < size; i++) out += alphabet[buf[i] % alphabet.length];
        return out;
      }
    } catch (_) {}
    for (let i = 0; i < size; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
    return out;
  }
  function readStoredDeviceIdFromSession(){
    try {
      const raw = localStorage.getItem("sessionKeyInfo");
      if (!raw) return "";
      const parsed = JSON.parse(raw);
      const deviceId = String(parsed && parsed.deviceId || "").trim();
      if (deviceId) {
        try { localStorage.setItem(DEVICE_ID_STORAGE_KEY, deviceId); } catch (_) {}
        return deviceId;
      }
    } catch (_) {}
    return "";
  }
  function getDeviceInstanceSeed(){
    try {
      const cached = localStorage.getItem(DEVICE_INSTANCE_SEED_STORAGE_KEY);
      if (cached) return cached;
    } catch (_) {}
    const seed = generateDeviceId();
    try { localStorage.setItem(DEVICE_INSTANCE_SEED_STORAGE_KEY, seed); } catch (_) {}
    return seed;
  }
  function ensureDeviceId(){
    try {
      const cached = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
      if (cached) return cached;
    } catch (_) {}
    const fromSession = readStoredDeviceIdFromSession();
    if (fromSession) return fromSession;
    const id = generateDeviceId();
    try { localStorage.setItem(DEVICE_ID_STORAGE_KEY, id); } catch (_) {}
    return id;
  }
  function getDeviceId(){
    return ensureDeviceId();
  }
  function collectDeviceInfo(){
    try {
      const nav = navigator || {};
      const uaData = nav.userAgentData || {};
      const scr = window.screen || {};
      const userAgent = String(nav.userAgent || "").trim();
      const rawPlatform = String(uaData.platform || nav.platform || "").trim();
      const brands = Array.isArray(uaData.brands) ? uaData.brands.map((b) => String(b && b.brand || "").trim()).filter(Boolean) : [];
      const text = `${rawPlatform} ${brands.join(", ")} ${userAgent}`.toLowerCase();
      const platform = /android/.test(text) ? "Android"
        : /iphone/.test(text) ? "iPhone"
        : /ipad/.test(text) ? "iPad"
        : /ipod|ios/.test(text) ? "iOS"
        : /windows|win32|win64/.test(text) ? "Windows"
        : /mac os|macos|macintosh/.test(text) ? "macOS"
        : /linux|x11/.test(text) ? "Linux"
        : rawPlatform;
      const browser = /brave/.test(text) ? "Brave"
        : (/edg\//.test(text) || /microsoft edge| edge\b/.test(text)) ? "Edge"
        : /opr\/|opera/.test(text) ? "Opera"
        : /vivaldi/.test(text) ? "Vivaldi"
        : /samsungbrowser|samsung internet/.test(text) ? "Samsung Internet"
        : /firefox|fxios/.test(text) ? "Firefox"
        : /duckduckgo/.test(text) ? "DuckDuckGo"
        : /yabrowser/.test(text) ? "Yandex"
        : (/google chrome|chrome\//.test(text) || /chrome\b/.test(text)) ? "Chrome"
        : (/safari/.test(text) && !/chrome|chromium|crios|edg|opr|brave|vivaldi/.test(text)) ? "Safari"
        : /chromium/.test(text) ? "Chromium"
        : "";
      const label = [platform, browser].filter(Boolean).join(" - ").trim();
      return {
        label: label || "",
        userAgent: userAgent,
        platform: platform,
        language: String(nav.language || ""),
        timezone: (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch { return ""; } })(),
        vendor: String(nav.vendor || "").trim(),
        screenWidth: Number(scr.width) || 0,
        screenHeight: Number(scr.height) || 0,
        viewportWidth: Number(window.innerWidth) || 0,
        viewportHeight: Number(window.innerHeight) || 0,
        pixelRatio: Number(window.devicePixelRatio) || 1,
        colorDepth: Number(scr.colorDepth) || 0,
        hardwareConcurrency: Number(nav.hardwareConcurrency) || 0,
        deviceMemory: Number(nav.deviceMemory) || 0,
        touchPoints: Number(nav.maxTouchPoints) || 0,
        fingerprintVersion: "v2",
        instanceSeed: getDeviceInstanceSeed()
      };
    } catch (_) {
      return {};
    }
  }
  try { if (!window.getDeviceFingerprint) window.getDeviceFingerprint = getDeviceId; } catch (_) {}

  const dispatchLocalEvent = (name, detail = {}) => {
    try {
      if (typeof window.dispatchEvent === "function" && typeof window.CustomEvent === "function") {
        window.dispatchEvent(new CustomEvent(name, { detail }));
      }
    } catch (_) {}
  };
  const notifySessionKeyUpdated = (payload = {}) => {
    dispatchLocalEvent("sessionkey:updated", {
      uid: String(payload.uid || payload.userUid || payload.user_uid || ""),
      sessionKey: String(payload.sessionKey || payload.session_key || ""),
      deviceId: String(payload.deviceId || payload.device_id || "")
    });
  };
  const notifyAuthUiFromPayload = (payload = {}) => {
    if (!payload || typeof payload !== "object") return;
    const uid = String(payload.uid || payload.userUid || payload.user_uid || "").trim();
    if (!uid) return;
    const authUser = { ...payload, uid };
    try { window.__AUTH_LAST_USER__ = authUser; } catch (_) {}
    try { if (typeof window.__applyAuthUi === "function") window.__applyAuthUi(authUser); } catch (_) {}
    try { if (typeof window.__syncSupportFloatingAuthVisibility === "function") window.__syncSupportFloatingAuthVisibility(authUser); } catch (_) {}
    try { if (typeof window.__syncSupportChatVisibility === "function") window.__syncSupportChatVisibility(authUser); } catch (_) {}
    dispatchLocalEvent("auth:ui-state", { logged: true, user: authUser });
  };

  const saveSessionLocal = (obj = {}) => {
    const payload = { ...obj };
    if (!payload.deviceId) payload.deviceId = getDeviceId();
    try { if (payload.deviceId) localStorage.setItem(DEVICE_ID_STORAGE_KEY, String(payload.deviceId)); } catch (_) {}
    try { localStorage.setItem("sessionKeyInfo", JSON.stringify(payload)); } catch (_) {}
    notifySessionKeyUpdated(payload);
  };
  const getSessionLocal = () => {
    try { return JSON.parse(localStorage.getItem("sessionKeyInfo") || "null"); } catch (_) { return null; }
  };
  const POST_LOGIN_STORAGE_KEY = "postLoginPayload";
  const TRANSIENT_AUTH_PREFIX = "__SITE_AUTH__:";
  const GUEST_PROVIDER_GAMES_CACHE_KEY = "catalog:cache:v9:guest:provider-games";
  const normalizeAccountNo = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Math.trunc(n);
  };
  const extractAccountNo = (payload = {}) => {
    if (!payload || typeof payload !== "object") return 0;
    return normalizeAccountNo(payload.accountNo ?? payload.account_no ?? payload.rank);
  };
  const clearGuestProviderGamesCatalogCache = () => {
    try { localStorage.removeItem(GUEST_PROVIDER_GAMES_CACHE_KEY); } catch (_) {}
    try { window.__CATALOG_TREE_CACHE__ = null; } catch (_) {}
    try { window.__CATALOG_CATALOG_CACHE__ = null; } catch (_) {}
    try {
      if (typeof window.dispatchEvent === "function" && typeof window.CustomEvent === "function") {
        window.dispatchEvent(new CustomEvent("catalog:guest-cache-cleared", {
          detail: { key: GUEST_PROVIDER_GAMES_CACHE_KEY }
        }));
      }
    } catch (_) {}
  };
  const savePostLoginPayload = (payload = {}) => {
    const data = { ...payload, ts: Date.now() };
    if (!data.deviceId) data.deviceId = getDeviceId();
    clearGuestProviderGamesCatalogCache();
    try { localStorage.setItem(POST_LOGIN_STORAGE_KEY, JSON.stringify(data)); } catch (_) {}
    try { window.name = TRANSIENT_AUTH_PREFIX + JSON.stringify(data); } catch (_) {}
    try { window.__POST_LOGIN_PAYLOAD__ = data; } catch (_) {}
    notifyAuthUiFromPayload(data);
  };
  const readPostLoginPayload = () => {
    try {
      const raw = localStorage.getItem(POST_LOGIN_STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data && typeof data === "object") return data;
      }
    } catch (_) {}
    try {
      if (typeof window.name === "string" && window.name.startsWith(TRANSIENT_AUTH_PREFIX)) {
        const json = window.name.slice(TRANSIENT_AUTH_PREFIX.length);
        const data = JSON.parse(json);
        return (data && typeof data === "object") ? data : null;
      }
    } catch (_) {}
    return null;
  };

  function canUseFirebaseAuth() {
    if (!hasFirebaseWebConfig()) return false;
    try {
      if (window.__SKIP_FIREBASE__ === true && !shouldBypassSkipFirebase()) return false;
    } catch (_) {}
    try {
      const p = location.protocol;
      if (p !== "http:" && p !== "https:" && p !== "chrome-extension:") return false;
    } catch (_) {
      return false;
    }
    return true;
  }

  function byId(id){
    return document.getElementById(id);
  }

  function blurActiveEditableElement(){
    try {
      const active = document && document.activeElement ? document.activeElement : null;
      if (!active || active === document.body) return;
      const tag = String(active.tagName || "").toUpperCase();
      if ((tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || active.isContentEditable) && typeof active.blur === "function") {
        active.blur();
      }
    } catch (_) {}
  }

  function readStoredLegalConsent(){
    try {
      const raw = localStorage.getItem(LEGAL_CONSENT_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      if (parsed.accepted !== true) return null;
      return parsed;
    } catch (_) {
      return null;
    }
  }

  function getLegalConsentCheckbox(){
    return byId("registerLegalConsent");
  }

  function getLegalConsentWrap(){
    const checkbox = getLegalConsentCheckbox();
    return checkbox && checkbox.closest ? checkbox.closest(".legal-consent-wrap") : null;
  }

  function hasStoredLegalConsent(){
    return !!readStoredLegalConsent();
  }

  function hasLegalConsent(){
    const checkbox = getLegalConsentCheckbox();
    if (checkbox) return !!checkbox.checked;
    return hasStoredLegalConsent();
  }

  function bindLegalRouteLinks(){
    try {
      const root = byId("loginInline");
      if (!root) return;
      const links = root.querySelectorAll('.legal-consent-links a[href]');
      links.forEach((link) => {
        if (!link || link.__z3LegalRouteBound) return;
        link.__z3LegalRouteBound = true;
        link.addEventListener("click", (event) => {
          try { if (event && typeof event.preventDefault === "function") event.preventDefault(); } catch (_) {}
          try { if (event && typeof event.stopPropagation === "function") event.stopPropagation(); } catch (_) {}
          try { if (event && typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation(); } catch (_) {}
          const href = String(link.getAttribute("href") || "").trim().toLowerCase();
          const key = href.indexOf("#/terms") === 0 ? "terms" : (href.indexOf("#/privacy") === 0 ? "privacy" : "");
          if (!key) return;
          try { location.hash = `#/${key}`; } catch (_) {}
        });
      });
    } catch (_) {}
  }

  function syncRegisterConsentState(){
    const checkbox = getLegalConsentCheckbox();
    const submitBtn = byId("registerSubmitBtn");
    const consentWrap = checkbox ? checkbox.closest(".legal-consent-wrap") : null;
    const checked = !!(checkbox && checkbox.checked);

    if (submitBtn) {
      submitBtn.disabled = !checked;
      submitBtn.setAttribute("aria-disabled", checked ? "false" : "true");
    }
    if (consentWrap) {
      consentWrap.classList.toggle("is-checked", checked);
      consentWrap.classList.toggle("is-unchecked", !checked);
    }
  }

  function normalizeLegalConsentUi(){
    try {
      const root = byId("loginInline");
      if (!root) return;
      const titles = root.querySelectorAll(".legal-consent-title");
      titles.forEach((node) => {
        try { node.remove(); } catch (_) {
          try { node.textContent = ""; } catch (__){ }
          try { node.style.display = "none"; } catch (__){ }
        }
      });
      const bodyBlocks = root.querySelectorAll(".legal-consent-body");
      bodyBlocks.forEach((block) => {
        try {
          const lines = block.querySelectorAll("p,div,span");
          lines.forEach((line) => {
            const txt = (line.textContent || "").replace(/\s+/g, " ").trim();
            if (txt && txt.indexOf("موافقة إلزامية") !== -1) {
              line.remove();
            }
          });
        } catch (_) {}
      });
    } catch (_) {}
  }

  function showLegalConsentError(message, targetEl){
    const text = message || (window.__I18N__ && typeof window.__I18N__.t === "function"
      ? window.__I18N__.t("legal.consent.requiredAccount", "يجب الموافقة على سياسة الخصوصية وشروط الاستخدام لإكمال إنشاء الحساب.")
      : "يجب الموافقة على سياسة الخصوصية وشروط الاستخدام لإكمال إنشاء الحساب.");
    const legalError = byId("registerLegalError");
    if (legalError) legalError.textContent = text;
    try {
      const wrap = getLegalConsentWrap();
      if (wrap) wrap.classList.add("has-error");
    } catch (_) {}
    if (targetEl) {
      targetEl.style.color = "var(--danger, #ef4444)";
      targetEl.textContent = text;
    }
  }

  function clearLegalConsentError(){
    const legalError = byId("registerLegalError");
    if (legalError) legalError.textContent = "";
    try {
      const wrap = getLegalConsentWrap();
      if (wrap) wrap.classList.remove("has-error");
    } catch (_) {}
  }

  function storeLegalConsent(source){
    const payload = {
      accepted: true,
      version: LEGAL_CONSENT_VERSION,
      source: source || "register",
      ts: Date.now()
    };
    try { localStorage.setItem(LEGAL_CONSENT_STORAGE_KEY, JSON.stringify(payload)); } catch (_) {}
    const checkbox = getLegalConsentCheckbox();
    if (checkbox) checkbox.checked = true;
    syncRegisterConsentState();
  }

  const NETWORK_TIMEOUT_MS = 4500;
  let requestLoaderCount = 0;
  let googleRedirectLoaderActive = false;
  function readFreshGoogleRedirectPending(){
    let payload = null;
    try {
      const raw = localStorage.getItem(GOOGLE_REDIRECT_PENDING_KEY);
      if (!raw) return null;
      payload = JSON.parse(raw);
    } catch (_) {
      try { localStorage.removeItem(GOOGLE_REDIRECT_PENDING_KEY); } catch (_) {}
      return null;
    }
    if (!payload || typeof payload !== "object") {
      try { localStorage.removeItem(GOOGLE_REDIRECT_PENDING_KEY); } catch (_) {}
      return null;
    }
    const startedAt = Number(payload.startedAt || payload.ts || 0) || 0;
    if (!startedAt || Date.now() - startedAt > GOOGLE_REDIRECT_PENDING_TTL_MS) {
      try { localStorage.removeItem(GOOGLE_REDIRECT_PENDING_KEY); } catch (_) {}
      try { sessionStorage.removeItem("site:google:entry"); } catch (_) {}
      return null;
    }
    return payload;
  }
  function writeGoogleRedirectPending(entryPoint){
    const safeEntry = entryPoint === "register" ? "register" : "login";
    const payload = {
      mode: "redirect",
      entryPoint: safeEntry,
      startedAt: Date.now(),
      href: String(location.href || ""),
      authDomain: getFirebaseAuthDomainSafe(),
      redirectUri: GOOGLE_AUTHORIZED_REDIRECT_URI
    };
    try { localStorage.setItem(GOOGLE_REDIRECT_PENDING_KEY, JSON.stringify(payload)); } catch (_) {}
    try { sessionStorage.setItem("site:google:entry", safeEntry); } catch (_) {}
    try { document.documentElement.classList.add("google-redirect-pending"); } catch (_) {}
    try { window.__GOOGLE_REDIRECT_EARLY_STARTED_AT__ = Date.now(); } catch (_) {}
    return payload;
  }
  function clearGoogleRedirectPending(){
    try { localStorage.removeItem(GOOGLE_REDIRECT_PENDING_KEY); } catch (_) {}
    try { sessionStorage.removeItem("site:google:entry"); } catch (_) {}
  }
  function hasGoogleRedirectPendingIntent(){
    const pending = readFreshGoogleRedirectPending();
    try { document.documentElement.classList.toggle("google-redirect-pending", !!pending); } catch (_) {}
    if (pending) {
      try { window.__GOOGLE_REDIRECT_EARLY_STARTED_AT__ = Number(pending.startedAt || pending.ts || Date.now()) || Date.now(); } catch (_) {}
    }
    return !!pending;
  }
  function forceGooglePreloaderVisible(){
    try {
      const el = byId("preloader");
      if (!el) return;
      el.classList.remove("hidden", "closing");
      el.classList.add("showing-instant");
      el.setAttribute("aria-hidden", "false");
      el.style.display = "flex";
      el.style.opacity = "1";
      el.style.visibility = "visible";
      el.style.pointerEvents = "auto";
    } catch (_) {}
  }
  function forceGooglePreloaderHidden(){
    try {
      const el = byId("preloader");
      if (!el) return;
      el.classList.add("hidden");
      el.classList.remove("google-redirect-early", "showing-instant", "entering", "preparing-intro", "closing");
      el.setAttribute("aria-hidden", "true");
      el.style.opacity = "0";
      el.style.visibility = "hidden";
      el.style.pointerEvents = "none";
      el.style.display = "none";
    } catch (_) {}
  }
  function showRequestLoader(){
    requestLoaderCount += 1;
    if (requestLoaderCount !== 1) return;
    try { document.documentElement.classList.add("auth-request-loader-pending"); } catch (_) {}
    let handledByPageLoader = false;
    try {
      if (typeof window.__holdPageLoader === "function") {
        window.__holdPageLoader();
        handledByPageLoader = true;
      }
    } catch (_) {}
    if (!handledByPageLoader) {
      try { window.__LOADER_HOLD_ACTIVE__ = true; } catch (_) {}
      try {
        if (typeof showPageLoader === "function") {
          showPageLoader({ hold: true, replay: true });
          handledByPageLoader = true;
        }
      } catch (_) {}
    }
    forceGooglePreloaderVisible();
  }
  function hideRequestLoader(){
    if (requestLoaderCount > 0) requestLoaderCount -= 1;
    if (requestLoaderCount !== 0) return;
    try { document.documentElement.classList.remove("auth-request-loader-pending"); } catch (_) {}
    try {
      if (typeof window.__releasePageLoader === "function") {
        window.__releasePageLoader();
        return;
      }
    } catch (_) {}
    try { window.__LOADER_HOLD_ACTIVE__ = false; } catch (_) {}
    try {
      if (typeof hidePageLoader === "function") {
        hidePageLoader();
        return;
      }
    } catch (_) {}
    try {
      const el = byId("preloader");
      if (el) {
        el.classList.add("hidden");
        el.style.opacity = "0";
        setTimeout(() => { try { el.style.display = "none"; } catch (_) {} }, 300);
      }
    } catch (_) {}
  }

  function getGoogleRedirectLoader(){
    try {
      return byId("preloader");
    } catch (_) {
      return null;
    }
  }

  function setGoogleRedirectLoaderText(title, copy){
    try {
      const loader = getGoogleRedirectLoader();
      if (!loader) return;
      const label = String(title || copy || "جارِ التحميل").trim();
      loader.setAttribute("role", "status");
      loader.setAttribute("aria-live", "polite");
      if (label) {
        loader.setAttribute("aria-label", label);
        loader.dataset.googleLoaderLabel = label;
      }
    } catch (_) {}
  }

  function showGoogleRedirectLoader(title, copy){
    try { document.documentElement.classList.add("google-redirect-pending"); } catch (_) {}
    try { window.__GOOGLE_REDIRECT_EARLY_STARTED_AT__ = window.__GOOGLE_REDIRECT_EARLY_STARTED_AT__ || Date.now(); } catch (_) {}
    setGoogleRedirectLoaderText(
      title || "جاري إكمال تسجيل الدخول عبر Google...",
      copy || "تم اختيار الحساب، نجهّز الجلسة الآن."
    );
    if (!googleRedirectLoaderActive) {
      googleRedirectLoaderActive = true;
      let held = false;
      try {
        if (typeof window.__holdPageLoader === "function") {
          window.__holdPageLoader();
          held = true;
        }
      } catch (_) {}
      if (!held) {
        try { window.__LOADER_HOLD_ACTIVE__ = true; } catch (_) {}
        try {
          if (typeof showPageLoader === "function") {
            showPageLoader({ hold: true, replay: true });
            held = true;
          }
        } catch (_) {}
      }
    }
    try {
      const legacyLoader = byId("googleRedirectLoader");
      if (legacyLoader) {
        legacyLoader.classList.add("hidden");
        legacyLoader.setAttribute("aria-hidden", "true");
      }
    } catch (_) {}
    forceGooglePreloaderVisible();
    setGoogleRedirectLoaderText(
      title || "جاري إكمال تسجيل الدخول عبر Google...",
      copy || "تم اختيار الحساب، نجهّز الجلسة الآن."
    );
  }

  function hideGoogleRedirectLoader(){
    try { document.documentElement.classList.remove("google-redirect-pending"); } catch (_) {}
    const shouldRelease = googleRedirectLoaderActive;
    googleRedirectLoaderActive = false;
    try {
      const loader = byId("googleRedirectLoader");
      if (loader) {
        loader.classList.add("hidden");
        loader.setAttribute("aria-hidden", "true");
      }
    } catch (_) {}
    if (!shouldRelease) {
      let keepLoader = false;
      try { keepLoader = !!window.__LOADER_HOLD_ACTIVE__; } catch (_) { keepLoader = false; }
      if (!keepLoader) forceGooglePreloaderHidden();
      return;
    }
    try {
      if (typeof window.__releasePageLoader === "function") {
        window.__releasePageLoader();
        return;
      }
    } catch (_) {}
    try { window.__LOADER_HOLD_ACTIVE__ = false; } catch (_) {}
    try {
      if (typeof hidePageLoader === "function") {
        hidePageLoader();
        return;
      }
    } catch (_) {}
  }

  function cleanupLoginRouteTransientState(){
    try {
      if (verificationTimer) {
        clearTimeout(verificationTimer);
        verificationTimer = null;
      }
    } catch (_) {}
    try { stopTotpModalCooldownTimer(); } catch (_) {}
    try {
      pendingTotpEmailBusy = false;
      pendingTotpLostBusy = false;
      pendingTotpLostMode = false;
      pendingTotpEmailSent = false;
      pendingTotpLostSent = false;
      pendingTotpEmailCooldownUntilMs = 0;
      pendingTotpLostCooldownUntilMs = 0;
      googleBusy = false;
      resetBusy = false;
    } catch (_) {}
    try {
      const root = byId("loginInline");
      if (root) {
        root.querySelectorAll(".modal:not(.hidden)").forEach((modal) => {
          const modalId = String(modal && modal.id || "").trim();
          if (modalId) closeModal(modalId);
          else modal.classList.add("hidden");
        });
        root.classList.add("hidden");
      }
    } catch (_) {}
    try {
      const host = byId("loginInlineHost");
      if (host) {
        host.style.display = "none";
        host.setAttribute("aria-hidden", "true");
      }
    } catch (_) {}
    try {
      if (document.body) {
        document.body.classList.remove("login-route-active");
        if (String(document.body.getAttribute("data-inline-route") || "").toLowerCase() === "login") {
          document.body.removeAttribute("data-inline-route");
        }
      }
    } catch (_) {}
    try { document.documentElement.classList.remove("pre-login-route"); } catch (_) {}
    try { hideGoogleRedirectLoader(); } catch (_) {}
    try { activeModalId = null; } catch (_) {}
    try { updateBodyModalState(); } catch (_) {}
    try { releaseLoginRouteEntryLoader(); } catch (_) {}
  }

  function releaseLoginRouteEntryLoader(){
    if (hasGoogleRedirectPendingIntent()) {
      forceGooglePreloaderVisible();
      return;
    }
    try { document.documentElement.classList.remove("auth-request-loader-pending"); } catch (_) {}
    try { requestLoaderCount = 0; } catch (_) {}
    try { hideRequestLoader(); } catch (_) {}
    try {
      const pre = byId("preloader");
      if (pre) {
        pre.classList.add("hidden");
        pre.classList.remove("entering", "preparing-intro");
        pre.setAttribute("aria-hidden", "true");
        pre.style.pointerEvents = "none";
        pre.style.visibility = "hidden";
        pre.style.opacity = "0";
      }
    } catch (_) {}
    try {
      sessionStorage.removeItem("nav:loader:expected");
      sessionStorage.removeItem("nav:loader:showAt");
    } catch (_) {}
    try {
      if (typeof window.__resetPageLoaderHold === "function") {
        window.__resetPageLoaderHold();
      } else if (typeof hidePageLoader === "function") {
        hidePageLoader({ force: true });
      }
    } catch (_) {}
  }

  function getManualRouterBase() {
    try {
      if (window.__getSiteWorkerBase) {
        const base = window.__getSiteWorkerBase({ trailingSlash: true });
        if (base) return base;
      }
    } catch (_) {}
    try {
      if (window.__getSiteWorkerBaseDefault) {
        return window.__getSiteWorkerBaseDefault({ trailingSlash: true });
      }
    } catch (_) {}
    try { return String(location.origin || "").replace(/\/+$/, "") + "/"; } catch (_) {}
    return "/";
  }

  function getSameOriginPingUrl() {
    try {
      if (location && typeof location.origin === "string" && /^https?:/i.test(location.origin)) {
        const base = location.origin.replace(/\/+$/, "");
        return `${base}/robots.txt?ping=${Date.now()}`;
      }
    } catch (_) {}
    return "";
  }

  function getManualPingUrl() {
    try {
      const base = getManualRouterBase();
      if (!base) return "";
      const url = new URL(base);
      url.searchParams.set("ping", "1");
      url.searchParams.set("_t", String(Date.now()));
      return url.toString();
    } catch (_) {}
    return "";
  }

  function getNetworkCheckUrls() {
    const urls = [];
    const manual = getManualPingUrl();
    if (manual) urls.push(manual);
    const origin = getSameOriginPingUrl();
    if (origin) urls.push(origin);
    urls.push("https://www.gstatic.com/generate_204");
    return urls;
  }

  async function pingUrlOnce(url, timeoutMs){
    const fetchOptions = { method: "GET", mode: "no-cors", cache: "no-store" };
    let controller;
    let timer;
    if (typeof AbortController !== "undefined") {
      controller = new AbortController();
      fetchOptions.signal = controller.signal;
      timer = setTimeout(() => controller.abort(), timeoutMs);
    }
    try {
      await fetch(url, fetchOptions);
      return { ok: true };
    } catch (error) {
      if (error && error.name === "AbortError") {
        return { ok: false, code: "network/timeout" };
      }
      return { ok: false, code: "network/ping-blocked" };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async function pingNetwork(timeoutMs = NETWORK_TIMEOUT_MS) {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      return { ok: false, code: "network/offline" };
    }
    const urls = getNetworkCheckUrls();
    if (!urls.length) return { ok: true };
    const perTimeout = Math.max(1500, Math.floor(timeoutMs / Math.max(1, urls.length)));
    let sawTimeout = false;
    for (const url of urls) {
      const result = await pingUrlOnce(url, perTimeout);
      if (result.ok) return { ok: true };
      if (result.code === "network/timeout") sawTimeout = true;
    }
    return { ok: false, code: sawTimeout ? "network/timeout" : "network/ping-blocked" };
  }

  async function ensureNetworkHealthy(targetEl, timeoutMs) {
    showRequestLoader();
    try {
      const status = await pingNetwork(timeoutMs);
      if (status.ok) return true;
      if (targetEl) {
        targetEl.style.color = "var(--danger, #ef4444)";
        targetEl.textContent = translateFirebaseError(status.code || "network/fetch-failed");
      }
      try { console.error("network check failed", status); } catch (_) {}
      return false;
    } finally {
      hideRequestLoader();
    }
  }

  function setButtonBusy(btn, busy = false) {
    if (!btn) return;
    btn.disabled = !!busy;
    btn.classList.toggle("is-loading", !!busy);
    if (busy) btn.setAttribute("aria-busy", "true");
    else btn.removeAttribute("aria-busy");
  }

  async function withNetworkRetry(task) {
    return task();
  }

  const MANUAL_ROUTER_DEFAULT = getManualRouterBase();

  function buildManualAuthUrl() {
    const base = getManualRouterBase();
    try {
      const url = new URL(base);
      if (!url.searchParams.has("action")) url.searchParams.set("action", "auth");
      return url.toString();
    } catch (_) {
      return MANUAL_ROUTER_DEFAULT + "?action=auth";
    }
  }

  function normalizeManualAuthIdentity(value) {
    return String(value || "").trim().toLowerCase().slice(0, 180);
  }

  function buildManualAuthRequestKey(action = "", payload = {}) {
    const body = payload && typeof payload === "object" ? payload : {};
    const normalizedAction = String(action || "").trim().toLowerCase();
    const normalizedPurpose = String(body.purpose || body.reason || body.flow || body.for || "").trim().toLowerCase();
    const normalizedEmail = normalizeManualAuthIdentity(body.email);
    const normalizedUid = normalizeManualAuthIdentity(body.uid);
    const identity =
      normalizedEmail ||
      normalizedUid ||
      (body.idToken ? "idtoken" : "") ||
      (body.sessionKey ? "session" : "") ||
      (body.deviceId ? normalizeManualAuthIdentity(body.deviceId) : "") ||
      "anon";
    return [normalizedAction, normalizedPurpose, identity].join("|");
  }

  function getManualAuthRecentDuplicate(key, windowMs) {
    return null;
  }

  function createManualAuthLocalDuplicateError(action, payload, originalError = null) {
    const normalizedAction = String(action || "").trim().toLowerCase();
    const channelLabel = normalizedAction === "telegram_otp_request" ? "تيليغرام" : "";
    const err = new Error(
      channelLabel
        ? `تم تجاهل طلب مكرر لإرسال رمز ${channelLabel}.`
        : "تم تجاهل طلب مكرر قيد المعالجة."
    );
    err.code = normalizedAction === "telegram_otp_request"
      ? "telegram_otp_rate_limited"
      : "auth/too-many-requests";
    err.payload = originalError && originalError.payload ? originalError.payload : null;
    err.details = {
      action: normalizedAction,
      purpose: String(payload && (payload.purpose || payload.reason || payload.flow || payload.for) || "").trim().toLowerCase()
    };
    return err;
  }

  function collectManualAuthErrorTokens(payload) {
    const tokens = [];
    const push = (value) => {
      const text = String(value || "").trim();
      if (!text) return;
      tokens.push(text);
    };
    if (!payload || typeof payload !== "object") return tokens;
    push(payload.code);
    push(payload.error);
    push(payload.message);
    push(payload.hint);
    push(payload.context);
    const details = payload.details && typeof payload.details === "object" ? payload.details : null;
    if (details) {
      push(details.code);
      push(details.message);
      const inner = details.error && typeof details.error === "object" ? details.error : null;
      if (inner) {
        push(inner.code);
        push(inner.message);
        const errs = Array.isArray(inner.errors) ? inner.errors : [];
        errs.forEach((item) => {
          if (!item || typeof item !== "object") return;
          push(item.code);
          push(item.message);
          push(item.reason);
        });
      }
    }
    return tokens;
  }

  function resolveManualAuthErrorCode(payload, fallbackCode) {
    const fallback = String(fallbackCode || "").trim();
    const direct = fallback.toUpperCase();
    if (/^TOTP[_-]/.test(direct)) return fallback.toLowerCase();
    if (/^EMAIL[_-]OTP[_-]/.test(direct)) return fallback.toLowerCase();
    if (/^TELEGRAM[_-]OTP[_-]/.test(direct)) return fallback.toLowerCase();
    if (direct.includes("INVALID_LOGIN_CREDENTIALS")) return "auth/invalid-login-credentials";
    if (direct.includes("INVALID_PASSWORD")) return "auth/invalid-login-credentials";
    if (direct.includes("EMAIL_NOT_FOUND")) return "auth/invalid-login-credentials";
    if (direct.includes("INVALID_EMAIL")) return "auth/invalid-email";
    if (direct.includes("USER_DISABLED")) return "auth/disabled";
    if (direct.includes("TOO_MANY_ATTEMPTS_TRY_LATER")) return "auth/too-many-requests";
    if (direct.includes("OPERATION_NOT_ALLOWED")) return "auth/operation-not-allowed";

    const upperTokens = collectManualAuthErrorTokens(payload).map((item) => item.toUpperCase());
    const has = (snippet) => upperTokens.some((item) => item.includes(snippet));

    if (has("INVALID_LOGIN_CREDENTIALS") || has("INVALID_PASSWORD") || has("EMAIL_NOT_FOUND")) {
      return "auth/invalid-login-credentials";
    }
    if (has("INVALID_EMAIL")) return "auth/invalid-email";
    if (has("USER_DISABLED")) return "auth/disabled";
    if (has("TOO_MANY_ATTEMPTS_TRY_LATER")) return "auth/too-many-requests";
    if (has("OPERATION_NOT_ALLOWED")) return "auth/operation-not-allowed";
    if (has("EMAIL_EXISTS")) return "auth/email-already-in-use";
    if (has("WEAK_PASSWORD")) return "auth/weak-password";
    if (has("TOTP_REQUIRED")) return "totp_required";
    if (has("TOTP_CODE_INVALID")) return "totp_code_invalid";
    if (has("TOTP_NOT_CONFIGURED")) return "totp_not_configured";
    if (has("TELEGRAM_OTP_REQUIRED")) return "telegram_otp_required";
    if (has("TELEGRAM_OTP_INVALID")) return "telegram_otp_invalid";
    if (has("TELEGRAM_OTP_EXPIRED")) return "telegram_otp_expired";
    if (has("TELEGRAM_OTP_LOCKED")) return "telegram_otp_locked";
    if (has("TELEGRAM_OTP_RATE_LIMITED")) return "telegram_otp_rate_limited";
    if (has("TELEGRAM_OTP_UNAVAILABLE")) return "telegram_otp_unavailable";
    if (has("TELEGRAM_OTP_SEND_FAILED")) return "telegram_otp_send_failed";
    if (has("BANNED")) return "auth/banned";

    if (fallback) return fallback;
    return "auth/unknown";
  }

  function createWritableManualAuthError(source, code) {
    const safeCode = String(code || "").trim() || "auth/unknown";
    const message = source && source.message
      ? String(source.message)
      : String(source || safeCode || "auth/unknown");
    const err = new Error(message || safeCode);
    err.code = safeCode;
    if (source && source.payload) err.payload = source.payload;
    if (source && source.details) err.details = source.details;
    if (source && source.status) err.status = source.status;
    if (source && source.name) err.name = source.name;
    if (source) err.originalError = source;
    return err;
  }

  async function callManualAuth(action = "login", payload = {}, targetErrorEl) {
    const manualUrl = buildManualAuthUrl();
    if (!manualUrl || typeof manualUrl !== "string") {
      const err = new Error("manual_url_invalid");
      err.code = "network/url-invalid";
      if (targetErrorEl) {
        targetErrorEl.style.color = "var(--danger, #ef4444)";
        targetErrorEl.textContent = "رابط الخادم غير صالح، تحقق من MANWAL_ROUTER_BASE.";
      }
      throw err;
    }
    const body = { action, ...payload };
    if (!body.deviceId) body.deviceId = getDeviceId();
    if (!body.deviceInfo) {
      const info = collectDeviceInfo();
      if (info && Object.keys(info).length) body.deviceInfo = info;
    }
    try {
      const htmlEl = (typeof document !== "undefined" && document.documentElement) ? document.documentElement : null;
      const lang = String((body.lang || body.language || (htmlEl && htmlEl.lang) || (navigator && navigator.language) || "")).trim();
      if (lang) {
        if (!body.language) body.language = lang;
        if (!body.lang) body.lang = lang;
      }
      if (!body.dir) {
        const dir = String((htmlEl && htmlEl.dir) || "").trim().toLowerCase();
        if (dir === "rtl" || dir === "ltr") body.dir = dir;
      }
    } catch (_) {}
    showRequestLoader();
    const runPromise = (async () => {
    try {
      const controller = (typeof AbortController !== "undefined") ? new AbortController() : null;
      const timer = controller ? setTimeout(() => controller.abort(), 15000) : null;
      const res = await fetch(manualUrl, {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller ? controller.signal : undefined
      });
      if (timer) clearTimeout(timer);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.success === false) {
        const err = new Error(data?.error || "تعذر إتمام الطلب.");
        err.code = resolveManualAuthErrorCode(data, data?.code || `auth/http-${res.status}`);
        err.payload = data;
        if (targetErrorEl) {
          targetErrorEl.style.color = "var(--danger, #ef4444)";
          targetErrorEl.textContent = translateFirebaseError(err);
        }
        throw err;
      }
      return data;
    } catch (err) {
      const fallbackCode = (err && err.name === "AbortError") ? "network/timeout" : "network/fetch-failed";
      const sourceCode = (err && err.name === "AbortError") ? fallbackCode : (err && err.code ? err.code : fallbackCode);
      const resolvedCode = resolveManualAuthErrorCode(err && err.payload ? err.payload : null, sourceCode) || fallbackCode;
      const safeErr = createWritableManualAuthError(err, resolvedCode);
      const authLike = /^auth\//.test(String(safeErr.code || "")) || /^totp[_-]/.test(String(safeErr.code || "")) || /^telegram_otp[_-]/.test(String(safeErr.code || ""));
      if (targetErrorEl) {
        targetErrorEl.style.color = "var(--danger, #ef4444)";
        if (authLike) {
          targetErrorEl.textContent = translateFirebaseError(safeErr);
        } else {
          targetErrorEl.textContent = "تعذر الاتصال بالخادم، تحقق من عنوان المانوال أو الشبكة.";
          if (manualUrl) targetErrorEl.textContent += ` (${manualUrl})`;
        }
      }
      try {
        const fallbackEl = byId("loginError") || byId("registerError");
        if (fallbackEl && fallbackEl !== targetErrorEl) {
          fallbackEl.style.color = "var(--danger, #ef4444)";
          if (authLike) {
            fallbackEl.textContent = translateFirebaseError(safeErr);
          } else {
            fallbackEl.textContent = "تعذر الاتصال بالخادم، تحقق من عنوان المانوال أو الشبكة.";
            if (manualUrl) fallbackEl.textContent += ` (${manualUrl})`;
          }
        }
      } catch (_) {}
      throw safeErr;
    } finally {
      hideRequestLoader();
    }
    })();
    return await runPromise;
  }

  function hideTotpRow() {
    const totpRow = byId('totpRow');
    const totpInput = byId('totpInput');
    if (totpRow) totpRow.style.display = "none";
    if (totpInput) totpInput.value = "";
  }

  function normalizeTotpCode(value) {
    return String(value || "").replace(/\D/g, "").slice(0, 6);
  }

  function normalizeTotpChallengeMethod(value) {
    const raw = String(value || "").trim().toLowerCase();
    if (raw === "totp") return "app";
    if (raw === "app" || raw === "telegram") return raw;
    if (raw === "tg" || raw === "telegram_bot" || raw === "bot") return "telegram";
    return "";
  }

  function isTotpCodeDeliveryMethod(method) {
    return method === "telegram";
  }

  function getTotpCodeDeliveryLabel(method) {
    return method === "telegram" ? "تيليغرام" : "التطبيق";
  }

  function getTotpCodeDeliveryButtonHtml(method, requestedBefore = false) {
    return requestedBefore
      ? '<i class="fa-brands fa-telegram"></i> إعادة إرسال رمز عبر تيليغرام'
      : '<i class="fa-brands fa-telegram"></i> إرسال رمز عبر تيليغرام';
  }

  function resolveTotpChallengeMethodFromError(err, fallback = "") {
    const details = (err && err.payload && err.payload.details && typeof err.payload.details === "object")
      ? err.payload.details
      : {};
    const direct = normalizeTotpChallengeMethod(
      details.preferredFactor ||
      details.enabledVia
    );
    if (direct) return direct;

    const factors = Array.isArray(details.factors)
      ? details.factors.map((item) => String(item || "").trim().toLowerCase())
      : [];
    const hasTotp = factors.includes("totp") || factors.includes("app");
    const hasTelegram = factors.includes("telegram") || factors.includes("tg") || factors.includes("bot");
    if (hasTelegram && !hasTotp) return "telegram";
    if (hasTotp && !hasTelegram) return "app";

    const fallbackMethod = normalizeTotpChallengeMethod(fallback);
    const code = String(err && err.code || "").trim().toLowerCase();
    if (hasTotp || hasTelegram) {
      if (fallbackMethod) return fallbackMethod;
      if (code.startsWith("telegram_otp_")) return "telegram";
      if (code.startsWith("totp_")) return "app";
      if (hasTelegram) return "telegram";
      if (hasTotp) return "app";
    }
    if (code.startsWith("telegram_otp_")) return "telegram";
    if (code.startsWith("totp_")) return "app";
    return fallbackMethod;
  }

  function resolveTotpRequest(code) {
    if (!pendingTotpResolve) return;
    const resolver = pendingTotpResolve;
    pendingTotpResolve = null;
    pendingTotpEmailRequest = null;
    pendingTotpEmailBusy = false;
    pendingTotpLostRequest = null;
    pendingTotpLostVerify = null;
    pendingTotpLostDisable = null;
    pendingTotpLostBusy = false;
    pendingTotpLostMode = false;
    pendingTotpEmailSent = false;
    pendingTotpLostSent = false;
    totpModalMethod = "";
    renderTotpModalRequestButtons();
    resolver(code);
  }

  function getTotpModalCooldownRemaining() {
    // Frontend resend timer removed: the server is the sole authority for the
    // resend cooldown. It returns the retry message (with the remaining time)
    // when blocked; when it doesn't, the user can send again immediately.
    return 0;
  }

  function stopTotpModalCooldownTimer() {
    if (!pendingTotpCooldownTimer) return;
    try { clearInterval(pendingTotpCooldownTimer); } catch (_) {}
    pendingTotpCooldownTimer = null;
  }

  function renderTotpModalRequestButtons() {
    const totpLoginEmailBtn = byId("totpLoginEmailBtn");
    const totpLoginLostBtn = byId("totpLoginLostBtn");
    const method = normalizeTotpChallengeMethod(totpModalMethod);
    const totpLoginError = byId("totpLoginError");

    if (totpLoginError) {
      const text = String(totpLoginError.textContent || "").trim();
      if (/^يمكنك إعادة الإرسال بعد \d+ ثانية\.$/.test(text)) {
        totpLoginError.textContent = "";
      }
    }

    if (totpLoginEmailBtn) {
      const canRequestEmail = isTotpCodeDeliveryMethod(method) && !!pendingTotpEmailRequest;
      if (!canRequestEmail) {
        totpLoginEmailBtn.style.setProperty("display", "none", "important");
        totpLoginEmailBtn.disabled = false;
        totpLoginEmailBtn.innerHTML = getTotpCodeDeliveryButtonHtml(method || "email", false);
      } else {
        totpLoginEmailBtn.style.display = "inline-flex";
        if (pendingTotpEmailBusy) {
          totpLoginEmailBtn.disabled = true;
          totpLoginEmailBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري الإرسال...';
        } else {
          const remaining = getTotpModalCooldownRemaining("email");
          if (remaining > 0) {
            totpLoginEmailBtn.disabled = true;
            totpLoginEmailBtn.innerHTML =
              '<i class="fa-solid fa-clock-rotate-left"></i> إعادة الإرسال بعد ' + remaining + " ث";
          } else {
            const requestedBefore = pendingTotpEmailCooldownUntilMs > 0;
            totpLoginEmailBtn.disabled = false;
            totpLoginEmailBtn.innerHTML = getTotpCodeDeliveryButtonHtml(method, requestedBefore);
          }
        }
      }
    }

    if (totpLoginLostBtn) {
      const canRecover = method === "app" && !!pendingTotpLostRequest && !!pendingTotpLostVerify && !!pendingTotpLostDisable;
      if (!canRecover) {
        totpLoginLostBtn.style.setProperty("display", "none", "important");
        totpLoginLostBtn.disabled = true;
        totpLoginLostBtn.textContent = "فقدت حماية Google Authenticator؟";
      } else {
        totpLoginLostBtn.style.display = "inline-block";
        if (pendingTotpLostBusy) {
          totpLoginLostBtn.disabled = true;
          totpLoginLostBtn.textContent = pendingTotpLostMode
            ? "جاري إعادة إرسال الرمز..."
            : "جاري إرسال رمز الاسترجاع...";
        } else if (!pendingTotpLostMode) {
          totpLoginLostBtn.disabled = false;
          totpLoginLostBtn.textContent = "فقدت حماية Google Authenticator؟";
        } else {
          const remaining = getTotpModalCooldownRemaining("lost");
          if (remaining > 0) {
            totpLoginLostBtn.disabled = true;
            totpLoginLostBtn.textContent = "إعادة الإرسال بعد " + remaining + " ث";
          } else {
            totpLoginLostBtn.disabled = false;
            totpLoginLostBtn.textContent = "إعادة إرسال رمز الاسترجاع";
          }
        }
      }
    }
  }

  function ensureTotpModalCooldownTimer() {
    renderTotpModalRequestButtons();
    if (getTotpModalCooldownRemaining("email") <= 0 && getTotpModalCooldownRemaining("lost") <= 0) {
      stopTotpModalCooldownTimer();
      return;
    }
    if (pendingTotpCooldownTimer) return;
    pendingTotpCooldownTimer = setInterval(() => {
      renderTotpModalRequestButtons();
      if (getTotpModalCooldownRemaining("email") <= 0 && getTotpModalCooldownRemaining("lost") <= 0) {
        stopTotpModalCooldownTimer();
      }
    }, 1000);
  }

  function startTotpModalCooldown() {
    // Frontend resend timer removed: no local countdown is started after a send.
    // The server alone decides when a resend is allowed and returns that message.
  }

  function getRetryAfterSecondsFromError(err) {
    if (!err || typeof err !== "object") return 0;
    const payload = err.payload && typeof err.payload === "object" ? err.payload : null;
    const details = payload && payload.details && typeof payload.details === "object" ? payload.details : null;
    const direct = Number(
      err.retryAfterSeconds ??
      (payload && payload.retryAfterSeconds) ??
      (details && details.retryAfterSeconds) ??
      0
    );
    return Number.isFinite(direct) && direct > 0 ? Math.trunc(direct) : 0;
  }

  function setTotpLoginInputVisible(visible) {
    const totpLoginInput = byId("totpLoginInput");
    const totpLoginConfirm = byId("totpLoginConfirm");
    if (!totpLoginInput) return;
    const wrap = totpLoginInput.closest(".input-group");
    if (wrap) wrap.style.display = visible ? "" : "none";
    totpLoginInput.disabled = !visible;
    if (!visible) totpLoginInput.value = "";
    if (totpLoginConfirm) {
      // Keep confirm button in sync with input visibility/busy state to avoid stuck disabled state.
      const busy = !!(pendingTotpLostBusy || pendingTotpEmailBusy);
      totpLoginConfirm.disabled = busy || !visible;
    }
  }

  async function requestTotpEmailCodeFromModal() {
    if (!pendingTotpEmailRequest || pendingTotpEmailBusy) return;
    const totpLoginError = byId("totpLoginError");
    const totpLoginSubtitle = byId("totpLoginSubtitle");
    const totpLoginInput = byId("totpLoginInput");
    const requestMethod = normalizeTotpChallengeMethod(totpModalMethod);
    const channelLabel = getTotpCodeDeliveryLabel(requestMethod);
    const remaining = getTotpModalCooldownRemaining("email");
    if (remaining > 0) {
      if (!pendingTotpEmailSent && totpLoginSubtitle) {
        totpLoginSubtitle.textContent = "تعذر إرسال الرمز حاليًا. اتبع الرسالة الظاهرة بالأسفل.";
      }
      if (!pendingTotpEmailSent) setTotpLoginInputVisible(false);
      if (totpLoginError) totpLoginError.textContent = "";
      renderTotpModalRequestButtons();
      return;
    }
    pendingTotpEmailBusy = true;
    renderTotpModalRequestButtons();
    if (totpLoginError) {
      totpLoginError.style.color = "var(--muted, #6b7280)";
      totpLoginError.textContent = `جاري إرسال رمز التحقق إلى ${channelLabel}...`;
    }
    try {
      const payload = await pendingTotpEmailRequest();
      const rawDeliveryChannel = payload && String(payload.deliveryChannel || "").trim().toLowerCase();
      const deliveryChannel = rawDeliveryChannel === "push"
        ? "push"
        : "telegram";
      const target = (payload && payload.to) ? String(payload.to) : "";
      const cooldownSeconds = Number(
        (payload && (payload.resendAfterSeconds ?? payload.retryAfterSeconds)) ?? TOTP_EMAIL_RESEND_COOLDOWN_SECONDS
      );
      startTotpModalCooldown("email", cooldownSeconds);
      pendingTotpEmailSent = true;
      if (totpLoginSubtitle) {
        totpLoginSubtitle.textContent = deliveryChannel === "push"
          ? "ادخل الكود الذي وصلك عبر إشعار Firebase على جهازك."
          : "ادخل الكود المستلم على تيليغرام.";
      }
      setTotpLoginInputVisible(true);
      if (totpLoginInput) {
        try { totpLoginInput.focus(); } catch (_) {}
      }
      if (totpLoginError) {
        totpLoginError.style.color = "var(--success, #22c55e)";
        totpLoginError.textContent = deliveryChannel === "push"
          ? "تم إرسال رمز التحقق عبر إشعار Firebase على جهازك."
          : (target
            ? `تم إرسال رمز التحقق إلى ${target}.`
            : "تم إرسال رمز التحقق إلى تيليغرام.");
      }
    } catch (err) {
      const retryAfterSeconds = getRetryAfterSecondsFromError(err);
      if (retryAfterSeconds > 0) startTotpModalCooldown("email", retryAfterSeconds);
      if (!pendingTotpEmailSent && totpLoginSubtitle) {
        totpLoginSubtitle.textContent = "تعذر إرسال الرمز حاليًا. اتبع الرسالة الظاهرة بالأسفل.";
      }
      if (totpLoginError) {
        totpLoginError.style.color = "var(--danger, #ef4444)";
        totpLoginError.textContent = translateFirebaseError(err);
      }
    } finally {
      pendingTotpEmailBusy = false;
      const inputVisible = !isTotpCodeDeliveryMethod(normalizeTotpChallengeMethod(totpModalMethod)) || pendingTotpEmailSent;
      setTotpLoginInputVisible(inputVisible);
      renderTotpModalRequestButtons();
    }
  }

  async function requestTotpLostRecoveryFromModal() {
    if (!pendingTotpLostRequest || pendingTotpLostBusy) return;
    const totpLoginError = byId("totpLoginError");
    const totpLoginSubtitle = byId("totpLoginSubtitle");
    const totpLoginInput = byId("totpLoginInput");
    const totpLoginConfirm = byId("totpLoginConfirm");
    const remaining = getTotpModalCooldownRemaining("lost");
    if (remaining > 0) {
      pendingTotpLostMode = pendingTotpLostSent;
      if (pendingTotpLostMode) {
        if (totpLoginSubtitle) {
          totpLoginSubtitle.textContent = "ادخل الكود المستلم على تيليغرام.";
        }
        if (totpLoginInput) {
          try { totpLoginInput.focus(); } catch (_) {}
        }
      }
      if (totpLoginError) totpLoginError.textContent = "";
      renderTotpModalRequestButtons();
      return;
    }

    pendingTotpLostBusy = true;
    if (totpLoginConfirm) totpLoginConfirm.disabled = true;
    renderTotpModalRequestButtons();
    if (totpLoginError) {
      totpLoginError.style.color = "var(--muted, #6b7280)";
      totpLoginError.textContent = "جاري إرسال رمز الاسترجاع إلى تيليغرام...";
    }
    try {
      const payload = await pendingTotpLostRequest();
      const deliveryChannel = payload && String(payload.deliveryChannel || "").trim().toLowerCase() === "push"
        ? "push"
        : "email";
      const target = (payload && payload.to) ? String(payload.to) : "";
      const cooldownSeconds = Number(
        (payload && (payload.resendAfterSeconds ?? payload.retryAfterSeconds)) ?? TOTP_EMAIL_RESEND_COOLDOWN_SECONDS
      );
      startTotpModalCooldown("lost", cooldownSeconds);
      pendingTotpLostSent = true;
      pendingTotpLostMode = true;
      if (totpLoginSubtitle) {
        totpLoginSubtitle.textContent = deliveryChannel === "push"
          ? "ادخل الكود الذي وصلك عبر إشعار Firebase على جهازك."
          : "ادخل الكود المستلم على تيليغرام.";
      }
      if (totpLoginInput) {
        totpLoginInput.value = "";
        try { totpLoginInput.focus(); } catch (_) {}
      }
      if (totpLoginError) {
        totpLoginError.style.color = "var(--success, #22c55e)";
        totpLoginError.textContent = deliveryChannel === "push"
          ? "تم إرسال رمز الاسترجاع عبر إشعار Firebase على جهازك."
          : (target ? `تم إرسال رمز الاسترجاع إلى ${target}.` : "تم إرسال رمز الاسترجاع إلى تيليغرام.");
      }
    } catch (err) {
      const retryAfterSeconds = getRetryAfterSecondsFromError(err);
      if (retryAfterSeconds > 0) startTotpModalCooldown("lost", retryAfterSeconds);
      if (totpLoginError) {
        totpLoginError.style.color = "var(--danger, #ef4444)";
        totpLoginError.textContent = translateFirebaseError(err);
      }
    } finally {
      pendingTotpLostBusy = false;
      const inputVisible = pendingTotpLostMode || normalizeTotpChallengeMethod(totpModalMethod) !== "telegram";
      setTotpLoginInputVisible(inputVisible);
      renderTotpModalRequestButtons();
    }
  }

  function openTotpModal(opts){
    const options = opts || {};
    const totpLoginModal = byId("totpLoginModal");
    if (!totpLoginModal) return;
    const totpLoginSubtitle = byId("totpLoginSubtitle");
    const totpLoginError = byId("totpLoginError");
    const totpLoginInput = byId("totpLoginInput");
    const method = normalizeTotpChallengeMethod(options.method);
    const autoRequestEmail = options && options.autoRequestEmail === true;
    pendingTotpEmailRequest = (typeof options.requestEmailCode === "function") ? options.requestEmailCode : null;
    pendingTotpEmailBusy = false;
    pendingTotpLostRequest = options && options.lostRecovery && typeof options.lostRecovery.requestEmailCode === "function"
      ? options.lostRecovery.requestEmailCode
      : null;
    pendingTotpLostVerify = options && options.lostRecovery && typeof options.lostRecovery.verifyEmailCode === "function"
      ? options.lostRecovery.verifyEmailCode
      : null;
    pendingTotpLostDisable = options && options.lostRecovery && typeof options.lostRecovery.disableWithEmailCode === "function"
      ? options.lostRecovery.disableWithEmailCode
      : null;
    pendingTotpLostBusy = false;
    pendingTotpEmailSent = isTotpCodeDeliveryMethod(method) && options && options.emailCodeSent === true;
    pendingTotpLostSent = method === "app" && options && options.lostEmailCodeSent === true;
    pendingTotpLostMode = pendingTotpLostSent;
    const emailCooldownActive = isTotpCodeDeliveryMethod(method) && getTotpModalCooldownRemaining("email") > 0;
    totpModalMethod = method;
    if (totpLoginSubtitle) {
      let fallbackSubtitle = "أدخل رمز Google Authenticator المكوّن من 6 أرقام.";
      if (isTotpCodeDeliveryMethod(method)) {
        fallbackSubtitle = pendingTotpEmailSent
          ? "ادخل الكود المستلم على تيليغرام."
          : (emailCooldownActive
            ? "تعذر إرسال الرمز حاليًا. اتبع الرسالة الظاهرة بالأسفل."
            : "اضغط على زر إرسال رمز عبر تيليغرام أولاً.");
      } else if (pendingTotpLostMode) {
        fallbackSubtitle = "ادخل الكود المستلم على تيليغرام.";
      }
      totpLoginSubtitle.textContent = (isTotpCodeDeliveryMethod(method) && !pendingTotpEmailSent)
        ? fallbackSubtitle
        : (options.subtitle || fallbackSubtitle);
    }
    if (totpLoginError) {
      totpLoginError.style.color = "var(--danger, #ef4444)";
      totpLoginError.textContent = options.error || "";
    }
    if (totpLoginInput) totpLoginInput.value = "";
    setTotpLoginInputVisible(!isTotpCodeDeliveryMethod(method) || pendingTotpEmailSent);
    renderTotpModalRequestButtons();
    ensureTotpModalCooldownTimer();
    showModal("totpLoginModal");
    if (isTotpCodeDeliveryMethod(method) && pendingTotpEmailRequest && autoRequestEmail && !pendingTotpEmailSent) {
      Promise.resolve().then(() => requestTotpEmailCodeFromModal()).catch(() => {});
    }
    setTimeout(() => {
      if (totpLoginInput && !totpLoginInput.disabled) {
        try { totpLoginInput.focus(); } catch (_) {}
      }
    }, 60);
  }

  function requestTotpCodeWithModal(opts){
    if (!byId("totpLoginModal") || !byId("totpLoginInput")) return Promise.resolve("");
    if (pendingTotpResolve) resolveTotpRequest("");
    return new Promise((resolve) => {
      pendingTotpResolve = resolve;
      openTotpModal(opts || {});
    });
  }

  async function confirmTotpModal() {
    const totpLoginInput = byId("totpLoginInput");
    const totpLoginError = byId("totpLoginError");
    const totpLoginConfirm = byId("totpLoginConfirm");
    const totpLoginLostBtn = byId("totpLoginLostBtn");
    if (!totpLoginInput) return;
    const code = normalizeTotpCode(totpLoginInput.value);
    if (totpLoginInput.value !== code) totpLoginInput.value = code;
    if (code.length !== 6) {
      if (totpLoginError) totpLoginError.textContent = "يرجى إدخال رمز تحقق من 6 أرقام.";
      return;
    }

    if (pendingTotpLostMode && pendingTotpLostVerify && pendingTotpLostDisable) {
      pendingTotpLostBusy = true;
      if (totpLoginConfirm) totpLoginConfirm.disabled = true;
      if (totpLoginLostBtn) totpLoginLostBtn.disabled = true;
      if (totpLoginError) {
        totpLoginError.style.color = "var(--muted, #6b7280)";
        totpLoginError.textContent = "جاري التحقق من رمز تيليغرام...";
      }
      try {
        await pendingTotpLostVerify(code);
        const confirmed = window.confirm("الرمز صحيح. هل تريد حذف مصادقة Google Authenticator المفقودة؟");
        if (!confirmed) {
          if (totpLoginError) {
            totpLoginError.style.color = "var(--muted, #6b7280)";
            totpLoginError.textContent = "تم التحقق من الرمز. يمكنك الإلغاء أو المتابعة لاحقًا.";
          }
          return;
        }
        if (totpLoginError) {
          totpLoginError.style.color = "var(--muted, #6b7280)";
          totpLoginError.textContent = "جاري حذف مصادقة Google Authenticator...";
        }
        await pendingTotpLostDisable(code);
        if (totpLoginError) {
          totpLoginError.style.color = "var(--success, #22c55e)";
          totpLoginError.textContent = "تم حذف مصادقة Google Authenticator بنجاح.";
        }
        resolveTotpRequest(TOTP_RECOVERY_DISABLED_SIGNAL);
        closeModal("totpLoginModal");
      } catch (err) {
        if (totpLoginError) {
          totpLoginError.style.color = "var(--danger, #ef4444)";
          totpLoginError.textContent = translateFirebaseError(err);
        }
      } finally {
        pendingTotpLostBusy = false;
        if (totpLoginConfirm) totpLoginConfirm.disabled = false;
        if (totpLoginLostBtn) totpLoginLostBtn.disabled = false;
      }
      return;
    }

    resolveTotpRequest(code);
    closeModal("totpLoginModal");
  }

  function updateFormTitle(form){
    const formTitleEl = byId("formTitle");
    if (!formTitleEl) return;
    if (form === "register") formTitleEl.textContent = "إنشاء حساب";
    else if (form === "reset") formTitleEl.textContent = "استعادة كلمة المرور";
    else formTitleEl.textContent = "تسجيل الدخول";
  }

  function switchForm(form){
    const loginForm = byId("loginForm");
    const resetForm = byId("resetForm");
    const registerForm = byId("registerForm");
    const resetEmailInput = byId("resetEmail");
    const resetMessageEl = byId("resetMessage");
    const resetStatusEl = byId("resetStatus");
    const emailInput = byId('emailInput');
    if (!loginForm || !resetForm || !registerForm) return;
    loginForm.classList.add("hidden");
    resetForm.classList.add("hidden");
    registerForm.classList.add("hidden");
    hideTotpRow();
    if (form === "login") loginForm.classList.remove("hidden");
    else if (form === "reset") {
      resetForm.classList.remove("hidden");
      const fallbackEmail = (emailInput?.value || '').trim() || (lastLoginEmail || '').trim();
      if (resetEmailInput && fallbackEmail) resetEmailInput.value = fallbackEmail;
      if (resetStatusEl) { resetStatusEl.textContent = "جاهز للإرسال"; resetStatusEl.className = "pill muted"; }
      if (resetMessageEl) { resetMessageEl.textContent = ""; }
    }
    else if (form === "register") {
      registerForm.classList.remove("hidden");
      normalizeLegalConsentUi();
      clearLegalConsentError();
      syncRegisterConsentState();
    }
    updateFormTitle(form);
  }

  function updateBodyModalState() {
    try {
      const hasOpenModal = document.querySelector('.modal:not(.hidden)');
      const bodyEl = document.body || document.documentElement;
      if (!bodyEl) return;
      if (hasOpenModal) bodyEl.classList.add('modal-open');
      else bodyEl.classList.remove('modal-open');
    } catch (_) {}
  }

  function showModal(modalId = "emailVerificationModal") {
    const modal = byId(modalId);
    if (!modal) return;
    modal.classList.remove("hidden");
    activeModalId = modalId;
    updateBodyModalState();
  }

  function closeModal(modalId) {
    const targetId = modalId || activeModalId;
    if (!targetId) return;
    if (targetId === "totpLoginModal") {
      resolveTotpRequest("");
    }
    const modal = byId(targetId);
    if (!modal) return;
    modal.classList.add("hidden");
    if (activeModalId === targetId) activeModalId = null;
    updateBodyModalState();
  }

  const firebaseErrorMessages = {
    "auth/invalid-email": "صيغة البريد الإلكتروني غير صحيحة.",
    "auth/missing-email": "يرجى إدخال البريد الإلكتروني.",
    "auth/missing-credentials": "يرجى إدخال البريد وكلمة المرور.",
    "auth/missing-fields": "يرجى إدخال جميع الحقول المطلوبة.",
    "auth/user-not-found": "لا يوجد حساب مرتبط بهذا البريد.",
    "auth/wrong-password": "كلمة المرور غير صحيحة.",
    "auth/invalid-credential": "بيانات تسجيل الدخول غير صحيحة، تأكد من البريد وكلمة المرور.",
    "auth/invalid-login-credentials": "بيانات تسجيل الدخول غير صحيحة، تأكد من البريد وكلمة المرور.",
    "auth/invalid-credentials": "بيانات تسجيل الدخول غير صحيحة، تأكد من البريد وكلمة المرور.",
    "auth/invalid_credentials": "بيانات تسجيل الدخول غير صحيحة، تأكد من البريد وكلمة المرور.",
    "auth/unknown": "تعذر إتمام الطلب. حاول مرة أخرى.",
    "auth-unavailable": "تسجيل Google غير متاح حاليًا. تحقق من إعداد Firebase أو من اتصال الشبكة ثم أعد المحاولة.",
    "auth/firebase-sdk-load-failed": "تعذر تحميل مكتبات Firebase. تحقق من اتصال الشبكة أو مانع الإعلانات/VPN ثم أعد المحاولة.",
    "auth/firebase-auth-sdk-missing": "تم تحميل Firebase جزئيًا لكن مكتبة المصادقة غير متاحة. أعد تحميل الصفحة ثم حاول مجددًا.",
    "auth/firebase-blocked-env": "تم تعطيل Firebase في هذه البيئة تلقائيًا. افتح الموقع عبر HTTPS/localhost وتأكد من السماح بالتخزين المحلي.",
    "auth/popup-closed-by-user": "تم إغلاق نافذة Google قبل إكمال تسجيل الدخول.",
    "auth/popup-no-result": "لم يرجع Google بيانات الحساب إلى الصفحة. أغلق نافذة Google إن بقيت مفتوحة ثم حاول مرة أخرى.",
    "auth/cancelled-popup-request": "تم إلغاء محاولة تسجيل Google. حاول مرة أخرى.",
    "auth/popup-blocked": "تعذر فتح تسجيل Google بشكل صحيح. أعد المحاولة في نفس النافذة.",
    "auth/missing-initial-state": "تعذر إكمال تسجيل Google بسبب فقدان حالة التحويل. افتح الموقع من الرابط واسمح بالتخزين المحلي ثم حاول مرة أخرى.",
    "auth/unauthorized-domain": "دومين غير مصرح.",
    "auth/invalid-api-key": "إعداد Firebase غير صحيح (API Key).",
    "auth/app-not-authorized": "تطبيق Firebase غير مصرح لهذه العملية.",
    "auth/web-storage-unsupported": "المتصفح لا يدعم التخزين المطلوب لتسجيل الدخول.",
    "auth/operation-not-supported-in-this-environment": "تسجيل Google غير مدعوم في هذه البيئة.",
    "auth/internal-error": "حدث خطأ داخلي أثناء تسجيل Google. أعد المحاولة.",
    "auth/too-many-requests": "تم حظر المحاولات مؤقتًا بسبب العديد من الطلبات. حاول لاحقًا.",
    "auth/email-already-in-use": "هذا البريد مستخدم بالفعل.",
    "auth/weak-password": "كلمة المرور ضعيفة، يرجى استخدام كلمة أقوى.",
    "auth/network-request-failed": "فشل الاتصال بالخادم، تحقق من الشبكة.",
    "auth/operation-not-allowed": "تم تعطيل هذا النوع من التسجيل في الوقت الحالي.",
    "auth/requires-recent-login": "يرجى تسجيل الدخول من جديد لإكمال العملية.",
    "auth/banned": "تم حظر حسابك.",
    "totp-required": "يرجى إدخال رمز المصادقة الثنائية.",
    "totp-code-invalid": "رمز التحقق غير صحيح.",
    "totp-not-configured": "إعدادات التحقق بخطوتين غير مكتملة.",
    "email-otp-removed": "تم إيقاف الإرسال المخصص عبر البريد (Brevo/Resend). استخدم تيليغرام أو تطبيق المصادقة.",
    "network/url-invalid": "رابط خادم المانوال غير صالح.",
    "network/fetch-failed": "تعذر الاتصال بالخادم، تحقق من عنوان المانوال أو الشبكة.",
    "network/blocked": "يبدو أن المتصفح يمنع الاتصال (Mixed Content/VPN). استخدم HTTPS لخادم المانوال.",
    "network/offline": "لا يوجد اتصال بالإنترنت حاليًا. فعّل البيانات أو اتصل بشبكة Wi-Fi أخرى ثم أعد المحاولة.",
    "network/timeout": "الاتصال بطيء أو غير مستقر، تعذر الوصول إلى الخادم. أعد المحاولة بعد لحظات أو غيّر الشبكة.",
    "network/ping-blocked": "يبدو أن جدار الحماية أو خدمة VPN تمنع الاتصال بخوادم المتجر. عطّل الحجب مؤقتًا ثم أعد المحاولة.",
    "firebase-web-api-key-missing": "مفتاح Firebase Web API غير مضبوط داخل الـ worker."
  };

  firebaseErrorMessages["firebase-web-api-key-missing"] = "مفتاح Firebase Web API غير مضبوط داخل الـ worker.";

  function getCurrentHostnameSafe() {
    try {
      return String(location.hostname || "").trim().toLowerCase();
    } catch (_) {
      return "";
    }
  }

  function getFirebaseAuthDomainSafe() {
    try {
      const liveCfg = resolveSiteFirebaseConfig();
      return String((liveCfg && liveCfg.authDomain) || "").trim().toLowerCase();
    } catch (_) {
      return "";
    }
  }

  function buildPreferredHostedAppUrl(hash = "#/login") {
    const safeHash = String(hash || "#/login").trim() || "#/login";
    try {
      const canonicalUrl = new URL(GOOGLE_AUTHORIZED_ORIGIN);
      canonicalUrl.hash = safeHash;
      return canonicalUrl.toString();
    } catch (_) {}
    try {
      const fallbackUrl = new URL("index.html", window.location.href);
      fallbackUrl.hash = safeHash;
      return fallbackUrl.toString();
    } catch (_) {
      return "";
    }
  }

  function buildPasswordResetActionSettings() {
    const url = buildPreferredHostedAppUrl("#/login");
    if (!url) return null;
    return { url };
  }

  function getUnauthorizedDomainMessage() {
    const host = getCurrentHostnameSafe();
    const hostText = host || "غير معروف";
    return "دومين غير مصرح: " + hostText;
  }

  function normalizeUiErrorCode(code) {
    const raw = String(code || "").trim();
    if (!raw) return "";
    const lower = raw.toLowerCase();
    const authMatch = lower.match(/auth\/[a-z0-9-]+/);
    if (authMatch && authMatch[0]) return authMatch[0];
    if (lower.includes("auth_unavailable") || lower.includes("google_user_missing")) return "auth-unavailable";
    if (lower.includes("missing initial state") || lower.includes("storage-partitioned")) return "auth/missing-initial-state";
    if (lower.includes("popup blocked")) return "auth/popup-blocked";
    if (lower.includes("unauthorized-domain")) return "auth/unauthorized-domain";
    if (lower.includes("invalid_login_credentials")) return "auth/invalid-login-credentials";
    if (lower.includes("email_not_found") || lower.includes("invalid_password")) return "auth/invalid-login-credentials";
    if (lower.includes("too_many_attempts_try_later")) return "auth/too-many-requests";
    if (lower.includes("operation_not_allowed")) return "auth/operation-not-allowed";
    if (lower.includes("failed to fetch")) return "network/fetch-failed";
    if (lower.includes("network request failed")) return "auth/network-request-failed";
    if (lower.includes("networkerror")) return "network/fetch-failed";
    if (lower.includes("aborterror") || lower.includes("timed out") || lower.includes("timeout")) return "network/timeout";
    return lower.replace(/_/g, "-");
  }

  function collectUiErrorMessageCandidates(input) {
    const values = [];
    const seen = new Set();
    const push = (value) => {
      const text = String(value == null ? "" : value).trim();
      if (!text || seen.has(text)) return;
      seen.add(text);
      values.push(text);
    };
    if (typeof input === "string" || typeof input === "number") {
      push(input);
      return values;
    }
    if (!input || typeof input !== "object") return values;
    push(input.code);
    push(input.message);
    push(input.error);
    push(input.hint);
    const payload = input.payload && typeof input.payload === "object" ? input.payload : null;
    if (payload) {
      collectManualAuthErrorTokens(payload).forEach(push);
    }
    return values;
  }

  function isUiCodeLike(text) {
    return /^[a-z0-9_./:-]+$/i.test(String(text || "").trim());
  }

  function isHumanReadableErrorMessage(text) {
    const value = String(text || "").trim();
    if (!value) return false;
    if (/[\u0600-\u06FF]/.test(value)) return true;
    if (isUiCodeLike(value)) return false;
    if (/\s/.test(value)) return true;
    return /[.!?،؛]/.test(value);
  }

  function translateFirebaseError(input) {
    const candidates = collectUiErrorMessageCandidates(input);
    const key = normalizeUiErrorCode(candidates[0] || input);
    if (!candidates.length && !key) return "حدث خطأ غير متوقڡ حاول مرة أخرى.";
    for (const candidate of candidates) {
      const candidateKey = normalizeUiErrorCode(candidate);
      if (!candidateKey) continue;
      if (candidateKey === "auth/unauthorized-domain") return getUnauthorizedDomainMessage();
      if (firebaseErrorMessages[candidateKey]) return firebaseErrorMessages[candidateKey];
      if (candidateKey.includes("too-many-requests")) return firebaseErrorMessages["auth/too-many-requests"];
    }
    for (const candidate of candidates) {
      if (isHumanReadableErrorMessage(candidate)) return candidate;
    }
    if (key === "auth/unauthorized-domain") return getUnauthorizedDomainMessage();
    if (firebaseErrorMessages[key]) return firebaseErrorMessages[key];
    if (key.includes("too-many-requests")) return firebaseErrorMessages["auth/too-many-requests"];
    if (key.startsWith("auth/http-")) return firebaseErrorMessages["network/fetch-failed"];
    if (key.startsWith("network/")) return firebaseErrorMessages["network/fetch-failed"];
    if (key.startsWith("auth/")) return firebaseErrorMessages["auth/unknown"];
    return "حدث خطأ غير متوقڡ حاول مرة أخرى.";
  }

  function setCriterionState(element, satisfied) {
    if (!element) return;
    element.classList.toggle("criterion-met", satisfied);
    const icon = element.querySelector(".icon");
    if (icon) {
      icon.classList.toggle("fa-check", satisfied);
      icon.classList.toggle("fa-xmark", !satisfied);
      icon.style.color = satisfied ? "var(--success, #22c55e)" : "var(--danger, #ef4444)";
    }
    element.style.color = satisfied ? "#16a34a" : "";
  }

  function validatePassword() {
    const registerPasswordInput = byId("registerPassword");
    if (!registerPasswordInput) return;
    const passwordCriteriaEls = {
      minLength: byId("minLength"),
      hasNumber: byId("hasNumber"),
      hasUpper: byId("hasUpper"),
      hasLower: byId("hasLower"),
      hasSymbol: byId("hasSymbol")
    };
    const strengthIndicator = byId("strengthIndicator");
    const strengthText = byId("strengthText");
    const value = registerPasswordInput.value || "";
    const hasMin = value.length >= 6;
    const hasNumber = /\d/.test(value);
    const hasUpper = /[A-Z]/.test(value);
    const hasLower = /[a-z]/.test(value);
    const hasSymbol = /[^A-Za-z0-9]/.test(value);
    const optionalCount = [hasNumber, hasUpper, hasLower, hasSymbol].filter(Boolean).length;

    setCriterionState(passwordCriteriaEls.minLength, hasMin);
    setCriterionState(passwordCriteriaEls.hasNumber, hasNumber);
    setCriterionState(passwordCriteriaEls.hasUpper, hasUpper);
    setCriterionState(passwordCriteriaEls.hasLower, hasLower);
    setCriterionState(passwordCriteriaEls.hasSymbol, hasSymbol);

    if (!strengthIndicator || !strengthText) return;
    if (!value) {
      strengthIndicator.style.width = "0%";
      strengthIndicator.style.backgroundColor = "#e5e7eb";
      strengthText.textContent = "";
      return;
    }

    const score = (hasMin ? 1 : 0) + optionalCount;
    const percent = Math.min(100, Math.max(20, Math.round((score / 5) * 100)));

    let barColor = "#ef4444";
    let label = "ضعيفة";
    if (percent >= 80) { barColor = "#22c55e"; label = "قوية"; }
    else if (percent >= 60) { barColor = "#f59e0b"; label = "متوسطة"; }
    else if (percent >= 40) { barColor = "#f97316"; label = "ضعيفة"; }

    strengthIndicator.style.width = percent + "%";
    strengthIndicator.style.backgroundColor = barColor;

    if (!hasMin) {
      strengthText.style.color = "var(--danger, #ef4444)";
      strengthText.textContent = "كلمة المرور يجب ألا تقل عن 6 أحرف.";
    } else if (optionalCount < 3) {
      const remaining = 3 - optionalCount;
      strengthText.style.color = "#f59e0b";
      strengthText.textContent = `أضف ${remaining} متطلبات اختيارية (أرقام/حروف/رموز) لزيادة الأمان.`;
    } else {
      strengthText.style.color = barColor;
      strengthText.textContent = `قوة كلمة المرور: ${label}`;
    }
  }

  async function sendResetLink() {
    const resetEmailInput = byId("resetEmail");
    const resetMessageEl = byId("resetMessage");
    const resetStatusEl = byId("resetStatus");
    const resetSubmitBtn = byId("resetSubmitBtn");
    if (!resetEmailInput || !resetMessageEl) return;
    const email = resetEmailInput.value.trim();
    resetMessageEl.style.color = "var(--danger, #ef4444)";
    resetMessageEl.textContent = "";

    if (!email) {
      resetMessageEl.textContent = "يرجى إدخال بريدك الإلكتروني.";
      if (resetStatusEl) { resetStatusEl.textContent = "أدخل بريدًا صحيحًا"; resetStatusEl.className = "pill"; }
      return;
    }
    if (!canUseFirebaseAuth() && !hasFirebaseWebConfig()) {
      resetMessageEl.textContent = getFirebaseFrontendUnavailableMessage("reset");
      if (resetStatusEl) { resetStatusEl.textContent = "غير متاح"; resetStatusEl.className = "pill"; }
      return;
    }
    if (resetBusy) return;
    resetBusy = true;
    showRequestLoader();

    try {
      setButtonBusy(resetSubmitBtn, true);
      if (resetStatusEl) { resetStatusEl.textContent = "جارٍ الإرسال..."; resetStatusEl.className = "pill muted"; }
      const networkReady = await ensureNetworkHealthy(resetMessageEl);
      if (!networkReady) return;
      await ensureFirebaseCompatAsync();
      if (!auth || typeof auth.sendPasswordResetEmail !== "function") {
        throw new Error("auth_unavailable");
      }
      try {
        const uiLang = String((document && document.documentElement && document.documentElement.lang) || "ar").trim();
        if (uiLang) auth.languageCode = uiLang;
      } catch (_) {}
      const resetActionSettings = buildPasswordResetActionSettings();
      await withNetworkRetry(() => {
        if (resetActionSettings) {
          return auth.sendPasswordResetEmail(email, resetActionSettings);
        }
        return auth.sendPasswordResetEmail(email);
      }, 1);
      resetMessageEl.style.color = "var(--success, #22c55e)";
      resetMessageEl.textContent = "تم إرسال رابط الاستعادة إلى بريدك الإلكتروني.";
      if (resetStatusEl) { resetStatusEl.textContent = "تم الإرسال"; resetStatusEl.className = "pill success"; }
      showModal("resetSuccessModal");
    } catch (error) {
      resetMessageEl.textContent = translateFirebaseError(error);
      if (resetStatusEl) { resetStatusEl.textContent = "تعذر الإرسال"; resetStatusEl.className = "pill"; }
    } finally {
      resetBusy = false;
      setButtonBusy(resetSubmitBtn, false);
      hideRequestLoader();
    }
  }

  async function sendVerificationNow() {
    const verificationMessage = byId("verificationMessage");
    const resendVerificationBtn = byId("resendVerificationBtn");
    if (verificationMessage) {
      verificationMessage.style.color = "var(--danger, #ef4444)";
      verificationMessage.textContent = "";
    }

    if (!canUseFirebaseAuth() && !hasFirebaseWebConfig()) {
      if (verificationMessage) {
        verificationMessage.textContent = getFirebaseFrontendUnavailableMessage("verification");
      }
      return;
    }

    await ensureFirebaseCompatAsync();
    const user = auth ? auth.currentUser : null;

    if (!user) {
      if (verificationMessage) {
        verificationMessage.textContent = "يرجى تسجيل الدخول أولًا لإعادة إرسال رابط التأكيد.";
      }
      return;
    }

    try {
      showRequestLoader();
      if (resendVerificationBtn) {
        resendVerificationBtn.disabled = true;
        resendVerificationBtn.classList.add("disabled");
      }
      const networkReady = await ensureNetworkHealthy(verificationMessage);
      if (!networkReady) return;
      if (typeof user.sendEmailVerification !== "function") throw new Error("auth_unavailable");
      await withNetworkRetry(() => user.sendEmailVerification(), 1);
      if (verificationMessage) {
        verificationMessage.style.color = "var(--success, #22c55e)";
        verificationMessage.textContent = "تم إرسال رسالة التأكيد، تحقق من بريدك الوارد أو الرسائل غير المرغوبة.";
      }
    } catch (error) {
      if (verificationMessage) {
        verificationMessage.textContent = translateFirebaseError(error);
      }
    } finally {
      hideRequestLoader();
      clearTimeout(verificationTimer);
      verificationTimer = setTimeout(() => {
        if (resendVerificationBtn) {
          resendVerificationBtn.disabled = false;
          resendVerificationBtn.classList.remove("disabled");
        }
        if (verificationMessage && verificationMessage.style.color === "var(--success, #22c55e)") {
          verificationMessage.style.color = "";
        }
      }, 1500);
    }
  }

  function goHome(){
    try {
      if (typeof window.navigateHome === 'function') {
        window.navigateHome();
        return;
      }
    } catch (_) {}
    try { window.location.hash = '#/'; } catch (_) { window.location.href = 'index.html'; }
  }

  function releaseGoogleLoaderIfRedirectChooserStillVisible(entryPoint){
    const startedAt = Date.now();
    setTimeout(function(){
      try {
        const pending = readFreshGoogleRedirectPending();
        if (!pending) return;
        if (document.visibilityState && document.visibilityState !== "visible") return;
        if ((Date.now() - startedAt) < GOOGLE_REDIRECT_NAVIGATION_LOADER_GRACE_MS) return;
        pushGoogleFlowLog("google_redirect_loader_released_before_navigation", {
          entryPoint,
          elapsedMs: Date.now() - startedAt
        });
        hideGoogleRedirectLoader();
      } catch (_) {}
    }, GOOGLE_REDIRECT_NAVIGATION_LOADER_GRACE_MS);
  }

  function beginPostLoginNavigationLoader(){
    try { window.__AUTH_POST_LOGIN_NAV_PENDING__ = true; } catch (_) {}
    try { document.documentElement.classList.add("auth-request-loader-pending"); } catch (_) {}
    try { if (document.body) document.body.classList.add("auth-request-loader-pending"); } catch (_) {}
    try {
      if (typeof window.__holdPageLoader === "function") {
        window.__holdPageLoader();
      } else if (typeof showPageLoader === "function") {
        showPageLoader({ hold: true, replay: true });
      } else {
        forceGooglePreloaderVisible();
      }
    } catch (_) {}
  }

  function finishPostLoginNavigationLoader(){
    try { window.__AUTH_POST_LOGIN_NAV_PENDING__ = false; } catch (_) {}
    try { document.documentElement.classList.remove("auth-request-loader-pending"); } catch (_) {}
    try { if (document.body) document.body.classList.remove("auth-request-loader-pending"); } catch (_) {}
    try {
      if (typeof window.__releasePageLoader === "function") {
        window.__releasePageLoader();
      } else if (typeof hidePageLoader === "function") {
        hidePageLoader();
      } else {
        forceGooglePreloaderHidden();
      }
    } catch (_) {}
  }

  function schedulePostLoginNavigationLoaderRelease(){
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      try { window.removeEventListener("hashchange", finish); } catch (_) {}
      setTimeout(finishPostLoginNavigationLoader, 450);
    };
    try { window.addEventListener("hashchange", finish, { once: true }); } catch (_) {}
    setTimeout(finish, 1300);
  }

  function goHomeAfterAuthSuccess(){
    beginPostLoginNavigationLoader();
    try {
      goHome();
    } finally {
      schedulePostLoginNavigationLoaderRelease();
    }
  }

  function clearAuthLocalArtifacts() {
    try { localStorage.removeItem("sessionKeyInfo"); } catch (_) {}
    try { localStorage.removeItem(POST_LOGIN_STORAGE_KEY); } catch (_) {}
    try {
      if (typeof window.name === "string" && window.name.startsWith(TRANSIENT_AUTH_PREFIX)) {
        window.name = "";
      }
    } catch (_) {}
    try { delete window.__POST_LOGIN_PAYLOAD__; } catch (_) {}
  }

  async function logoutBannedAccountNow(buttonEl) {
    try {
      if (buttonEl) {
        buttonEl.disabled = true;
        buttonEl.style.opacity = ".75";
        buttonEl.textContent = "جاري تسجيل الخروج...";
      }
    } catch (_) {}
    try { if (auth && typeof auth.signOut === "function") await auth.signOut(); } catch (_) {}
    clearAuthLocalArtifacts();
    try {
      if (typeof window.performClientLogout === "function") {
        window.performClientLogout();
        return;
      }
    } catch (_) {}
    try {
      window.dispatchEvent(new Event("hashchange"));
      return;
    } catch (_) {}
    try { window.location.reload(); } catch (_) {}
  }

  const BANNED_OVERLAY_SUPPORT_META = Object.freeze({
    whatsapp: { label: "واتساب", icon: "fa-brands fa-whatsapp" },
    telegram: { label: "تيليغرام", icon: "fa-brands fa-telegram" },
    instagram: { label: "إنستغرام", icon: "fa-brands fa-instagram" },
    facebook: { label: "فيسبوك", icon: "fa-brands fa-facebook-f" },
    email: { label: "البريد", icon: "fa-solid fa-envelope" }
  });

  function ensureBannedOverlayStyles() {
    try {
      if (document.getElementById("ban-block-overlay-inline-style")) return;
      const style = document.createElement("style");
      style.id = "ban-block-overlay-inline-style";
      style.textContent = `
        #ban-block-overlay-login .ban-support-note{
          margin:14px 0 10px;
          line-height:1.7;
          font-size:.96rem;
          color:#ffd6d6;
          font-weight:800;
          text-align:center;
        }
        #ban-block-overlay-login .ban-support-links{
          display:grid;
          grid-template-columns:repeat(2, minmax(0, 1fr));
          gap:10px;
        }
        #ban-block-overlay-login .ban-support-links.is-sidebar-style{
          display:flex;
          flex-wrap:wrap;
          gap:8px;
          align-items:center;
          justify-content:center;
        }
        #ban-block-overlay-login .ban-support-link{
          min-height:48px;
          padding:12px 14px;
          border-radius:999px;
          border:1px solid rgba(255,145,145,0.26);
          background:rgba(255,255,255,0.05);
          color:#fff2f2;
          text-decoration:none;
          display:flex;
          align-items:center;
          justify-content:center;
          gap:9px;
          font-weight:800;
          font-size:.94rem;
          transition:transform .14s ease, border-color .18s ease, background-color .18s ease, box-shadow .18s ease;
        }
        #ban-block-overlay-login .ban-support-link:hover{
          transform:translateY(-1px);
          border-color:rgba(255,145,145,0.48);
          background:rgba(255,255,255,0.09);
          box-shadow:0 14px 28px rgba(0,0,0,0.22);
        }
        #ban-block-overlay-login .ban-support-link:focus-visible{
          outline:2px solid rgba(255,205,205,0.75);
          outline-offset:2px;
        }
        #ban-block-overlay-login .ban-support-link i{
          font-size:1rem;
        }
        #ban-block-overlay-login .ban-support-links.is-sidebar-style .support-icon{
          width:32px;
          height:32px;
          min-height:32px;
          padding:0 !important;
          display:inline-flex;
          align-items:center;
          justify-content:center;
          border-radius:50%;
          background:transparent !important;
          box-shadow:none !important;
          border:none !important;
          position:relative;
        }
        #ban-block-overlay-login .ban-support-links.is-sidebar-style .support-icon img{
          width:32px !important;
          height:32px !important;
          object-fit:contain;
          display:block;
          filter:none !important;
        }
        #ban-block-overlay-login .ban-support-links.is-sidebar-style .support-icon i{
          font-size:18px;
          color:#f8fafc;
        }
        #ban-block-overlay-login .ban-support-links.is-sidebar-style .support-icon:hover{
          transform:none;
          box-shadow:none;
        }
        #ban-block-overlay-login .ban-support-links.is-sidebar-style .support-dock__link{
          width:32px;
          height:32px;
          min-height:32px;
          padding:0 !important;
          display:inline-flex;
          align-items:center;
          justify-content:center;
          border-radius:50%;
          background:transparent !important;
          box-shadow:none !important;
          border:none !important;
          text-decoration:none;
          position:relative;
        }
        #ban-block-overlay-login .ban-support-links.is-sidebar-style .support-dock__link img{
          width:32px !important;
          height:32px !important;
          object-fit:contain;
          display:block;
        }
        #ban-block-overlay-login .ban-support-links.is-sidebar-style .support-dock__link i{
          font-size:18px;
          color:#f8fafc;
        }
        #ban-block-overlay-login .ban-support-links.is-sidebar-style .support-badge,
        #ban-block-overlay-login .ban-support-links.is-sidebar-style .support-dock__badge{
          position:absolute;
          top:-3px;
          left:auto;
          right:-5px;
          bottom:auto;
          min-width:16px;
          height:16px;
          padding:0 4px;
          border-radius:999px;
          display:inline-flex;
          align-items:center;
          justify-content:center;
          background:var(--site-accent-runtime-strong, var(--primary-dark, var(--accent-theme, #414391)));
          color:#ffffff;
          border:2px solid #ffffff;
          box-shadow:0 4px 10px rgba(var(--site-accent-rgb, 106, 111, 232), 0.18);
          font-size:9px;
          font-weight:900;
          line-height:1;
          direction:ltr;
          pointer-events:none;
          z-index:1;
        }
        #ban-block-overlay-login .ban-support-links.is-sidebar-style .support-badge .support-badge__text,
        #ban-block-overlay-login .ban-support-links.is-sidebar-style .support-dock__badge .support-badge__text{
          display:block;
          transform:translateY(-1px);
        }
        @media (max-width: 520px){
          #ban-block-overlay-login .ban-support-links{
            grid-template-columns:1fr;
          }
          #ban-block-overlay-login .ban-support-links.is-sidebar-style{
            display:flex;
          }
        }
      `;
      (document.head || document.documentElement || document.body).appendChild(style);
    } catch (_) {}
  }

  function bannedOverlayEscapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function bannedOverlayNormalizeText(value) {
    return String(value == null ? "" : value)
      .toLowerCase()
      .replace(/[ًٌٍَُِّْـ]/g, "")
      .replace(/[إأآا]/g, "ا")
      .replace(/ى/g, "ي")
      .replace(/ة/g, "ه")
      .replace(/\s+/g, " ")
      .trim();
  }

  function bannedOverlaySafeParseJson(value) {
    if (!value) return null;
    if (typeof value === "object") return value;
    try {
      return JSON.parse(String(value));
    } catch (_) {
      return null;
    }
  }

  function bannedOverlayReadJsonStorage(key) {
    try {
      const raw = localStorage.getItem(key);
      return bannedOverlaySafeParseJson(raw);
    } catch (_) {
      return null;
    }
  }

  function readBannedOverlayResolvedSiteState() {
    try {
      const raw = (typeof window.__getResolvedSiteStateData === "function")
        ? window.__getResolvedSiteStateData()
        : window.__SITE_STATE_DATA__;
      if (!raw || typeof raw !== "object") return null;
      if (raw.siteState && typeof raw.siteState === "object" && !raw.levels) return raw.siteState;
      return raw;
    } catch (_) {
      return null;
    }
  }

  function normalizeBannedOverlaySupportHref(type, value) {
    const raw = String(value == null ? "" : value).trim();
    if (!raw) return "";
    if (type === "email") {
      const email = raw.replace(/^mailto:/i, "").trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "";
      return `mailto:${email}`;
    }
    if (type === "whatsapp") {
      if (/^(https?:\/\/|whatsapp:)/i.test(raw)) return raw.slice(0, 2000);
      if (/^(wa\.me\/|chat\.whatsapp\.com\/)/i.test(raw)) return `https://${raw}`.slice(0, 2000);
      const digits = raw.replace(/[^\d]/g, "");
      return digits.length >= 8 ? `https://wa.me/${digits}`.slice(0, 2000) : "";
    }
    if (type === "telegram") {
      if (/^tg:\/\/resolve\?/i.test(raw)) return raw;
      if (/^https?:\/\/t\.me\//i.test(raw)) return raw.slice(0, 2000);
      if (/^@[\w.]{3,}$/i.test(raw)) return `https://t.me/${raw.slice(1)}`;
      if (/^[\w.]{3,}$/i.test(raw) && !raw.includes("/")) return `https://t.me/${raw}`;
      return "";
    }
    if (type === "facebook") {
      if (/^https?:\/\//i.test(raw)) return raw.slice(0, 2000);
      const handle = raw.replace(/^@/, "").trim();
      return /^[\w.]{2,}$/i.test(handle) ? `https://facebook.com/${handle}`.slice(0, 2000) : "";
    }
    if (type === "instagram") {
      if (/^https?:\/\//i.test(raw)) return raw.slice(0, 2000);
      const handle = raw.replace(/^@/, "").trim();
      return /^[\w.]{2,}$/i.test(handle) ? `https://instagram.com/${handle}`.slice(0, 2000) : "";
    }
    if (/^https?:\/\//i.test(raw)) return raw.slice(0, 2000);
    return "";
  }

  function inferBannedOverlaySupportType(labelLike, href) {
    const text = bannedOverlayNormalizeText(`${labelLike || ""} ${href || ""}`);
    if (!text) return "";
    if (
      /wa\.me|chat\.whatsapp|whatsapp|واتساب|واتس|واتس اب/.test(text) ||
      /(?:^|\s)(wa)(?:\s|$)/.test(text)
    ) return "whatsapp";
    if (
      /t\.me|tg:\/\/|telegram|تيليجرام|تيليغرام|تليجرام|تليغرام/.test(text)
    ) return "telegram";
    if (/instagram|انستجرام|انستغرام|انستا/.test(text)) return "instagram";
    if (/facebook|فيسبوك|fb\.com|m\.me/.test(text)) return "facebook";
    if (/mailto:|email|mail|ايميل|بريد/.test(text) || /@/.test(String(href || ""))) return "email";
    return "";
  }

  function upsertBannedOverlaySupportItem(list, seen, type, rawHref) {
    const meta = BANNED_OVERLAY_SUPPORT_META[type];
    if (!meta) return;
    const href = normalizeBannedOverlaySupportHref(type, rawHref);
    if (!href) return;
    const key = `${type}|${href.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    list.push({
      key: type,
      href,
      label: meta.label,
      icon: meta.icon
    });
  }

  function extractBannedOverlaySupportItems(raw, list, seen) {
    if (!raw) return;
    if (Array.isArray(raw)) {
      raw.forEach((item) => {
        if (!item) return;
        if (typeof item === "string") {
          const inferred = inferBannedOverlaySupportType(item, item);
          upsertBannedOverlaySupportItem(list, seen, inferred, item);
          return;
        }
        if (typeof item !== "object") return;
        const labelLike = [
          item.platform,
          item.type,
          item.slug,
          item.key,
          item.id,
          item.className,
          item.label,
          item.name,
          item.title
        ].join(" ");
        const hrefLike =
          item.href ?? item.url ?? item.link ?? item.value ?? item.text ?? item.address ??
          item.username ?? item.handle ?? item.account ?? item.email ?? "";
        const inferred = inferBannedOverlaySupportType(labelLike, hrefLike);
        upsertBannedOverlaySupportItem(list, seen, inferred, hrefLike);
      });
      return;
    }
    if (typeof raw !== "object") {
      const inferred = inferBannedOverlaySupportType(raw, raw);
      upsertBannedOverlaySupportItem(list, seen, inferred, raw);
      return;
    }

    const singleEntryLabelLike = [
      raw.platform,
      raw.type,
      raw.slug,
      raw.key,
      raw.id,
      raw.className,
      raw.label,
      raw.name,
      raw.title
    ].join(" ");
    const singleEntryHrefLike =
      raw.href ?? raw.url ?? raw.link ?? raw.value ?? raw.text ?? raw.address ??
      raw.username ?? raw.handle ?? raw.account ?? raw.email ?? "";
    upsertBannedOverlaySupportItem(
      list,
      seen,
      inferBannedOverlaySupportType(singleEntryLabelLike, singleEntryHrefLike),
      singleEntryHrefLike
    );

    const direct = {
      whatsapp:
        raw.whatsappUrl ?? raw.whatsapp_url ?? raw.whatsappLink ?? raw.whatsapp_link ?? raw.whatsapp ?? raw.wa,
      telegram:
        raw.telegramBotLink ?? raw.telegram_bot_link ?? raw.telegramLink ?? raw.telegram_link ?? raw.telegramUrl ?? raw.telegram_url ?? raw.telegram,
      facebook:
        raw.facebookUrl ?? raw.facebook_url ?? raw.facebookLink ?? raw.facebook_link ?? raw.facebook,
      instagram:
        raw.instagramUrl ?? raw.instagram_url ?? raw.instagramLink ?? raw.instagram_link ?? raw.instagram,
      email:
        raw.email ?? raw.mail
    };

    Object.keys(direct).forEach((type) => {
      upsertBannedOverlaySupportItem(list, seen, type, direct[type]);
    });

    [
      raw.siteState,
      raw.support,
      raw.links,
      raw.contactLinks,
      raw.supportLinks,
      raw.linkMap,
      raw.map,
      raw.contacts,
      raw.contactMethods,
      raw.items,
      raw.list
    ].forEach((entry) => {
      if (!entry) return;
      if (entry === raw) return;
      extractBannedOverlaySupportItems(entry, list, seen);
    });
  }

  function readBannedOverlaySupportTemplate() {
    const section = document.querySelector("#sidebar .support-section") || document.querySelector(".support-section");
    const anchor = section ? section.querySelector("a[href]") : null;
    return {
      anchorClassName: String(anchor?.className || "").trim(),
      anchorStyle: String(anchor?.getAttribute("style") || "").trim()
    };
  }

  function primeBannedOverlaySupportSources() {
    try {
      if (typeof window.__ensureSupportSectionMounted === "function") {
        window.__ensureSupportSectionMounted();
      }
    } catch (_) {}
    try {
      if (typeof window.__applySupportContactsConfig === "function") {
        const resolved = readBannedOverlayResolvedSiteState();
        if (resolved && typeof resolved === "object") {
          window.__applySupportContactsConfig(resolved);
        } else {
          const cached = bannedOverlayReadJsonStorage("site:support:v1");
          if (cached && typeof cached === "object") {
            window.__applySupportContactsConfig(cached);
          }
        }
      }
    } catch (_) {}
  }

  function readBannedOverlaySidebarSupportAnchors() {
    try {
      primeBannedOverlaySupportSources();
      const collect = (root, selector) => {
        const out = [];
        const seen = new Set();
        if (!root || typeof root.querySelectorAll !== "function") return;
        Array.from(root.querySelectorAll(selector)).forEach((anchor) => {
          if (!anchor || typeof anchor.cloneNode !== "function") return;
          const key = String(anchor.getAttribute("data-contact-key") || anchor.getAttribute("href") || "").trim().toLowerCase();
          if (!key) return;
          if (seen.has(key)) return;
          seen.add(key);
          out.push(anchor);
        });
        return out;
      };
      const section = document.querySelector("#sidebar .support-section") || document.querySelector(".support-section");
      const sidebarAnchors = collect(section, ".support-icons a.support-icon[href], .support-icons a.support-icon[data-contact-key]") || [];
      if (sidebarAnchors.length) return sidebarAnchors;
      const floating = document.getElementById("supportFloatingWidgetItems");
      return collect(floating, "a.support-dock__link[href], a.support-dock__link[data-contact-key]") || [];
    } catch (_) {
      return [];
    }
  }

  function bindBannedOverlaySupportObservers(overlay) {
    try {
      if (!overlay || overlay.__banSupportObserverBound) return;
      overlay.__banSupportObserverBound = true;
      const refresh = () => {
        try {
          if (!overlay.isConnected) return;
          renderBannedOverlaySupportButtons(overlay);
        } catch (_) {}
      };
      const targets = [
        { node: document.getElementById("supportFloatingWidgetItems"), options: { childList: true, subtree: true, attributes: true, attributeFilter: ["href", "class", "style", "hidden"] } },
        { node: document.querySelector("#sidebar .support-section"), options: { childList: true, subtree: true, attributes: true, attributeFilter: ["href", "class", "style", "hidden"] } },
        { node: document.querySelector(".support-section"), options: { childList: true, subtree: true, attributes: true, attributeFilter: ["href", "class", "style", "hidden"] } },
        { node: document.body, options: { childList: true, subtree: false } }
      ].filter((entry) => !!entry.node);
      const observers = [];
      targets.forEach((entry) => {
        try {
          const observer = new MutationObserver(() => refresh());
          observer.observe(entry.node, entry.options);
          observers.push(observer);
        } catch (_) {}
      });
      overlay.__banSupportObservers = observers;
    } catch (_) {}
  }

  function collectBannedOverlaySupportItems() {
    const list = [];
    const seen = new Set();
    primeBannedOverlaySupportSources();

    try {
      const section = document.querySelector("#sidebar .support-section") || document.querySelector(".support-section");
      if (section) {
        section.querySelectorAll("a[href]").forEach((anchor) => {
          const href = String(anchor.getAttribute("href") || "").trim();
          const labelLike = [
            anchor.textContent,
            anchor.getAttribute("aria-label"),
            anchor.className
          ].join(" ");
          const inferred = inferBannedOverlaySupportType(labelLike, href);
          upsertBannedOverlaySupportItem(list, seen, inferred, href);
        });
      }
    } catch (_) {}

    extractBannedOverlaySupportItems(readBannedOverlayResolvedSiteState(), list, seen);

    try {
      extractBannedOverlaySupportItems(window.__SUPPORT_LINKS_MAP__, list, seen);
    } catch (_) {}
    try {
      extractBannedOverlaySupportItems(window.__SUPPORT_CONTACTS_RENDERED__, list, seen);
    } catch (_) {}
    try {
      upsertBannedOverlaySupportItem(list, seen, "telegram", window.__TELEGRAM_LINK_BOT_URL__);
    } catch (_) {}

    ["site:support:v1", "site:support:contacts:v1", "site:support:links:v1"].forEach((key) => {
      extractBannedOverlaySupportItems(bannedOverlayReadJsonStorage(key), list, seen);
    });

    const order = ["whatsapp", "telegram", "instagram", "facebook", "email"];
    return list.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
  }

  function renderBannedOverlaySupportButtons(overlay) {
    try {
      if (!overlay) return;
      ensureBannedOverlayStyles();
      const noteEl = overlay.querySelector("#banSupportNoteInline");
      const linksEl = overlay.querySelector("#banSupportLinksInline");
      if (!noteEl || !linksEl) return;

      const sidebarAnchors = readBannedOverlaySidebarSupportAnchors();
      if (sidebarAnchors.length) {
        linksEl.className = "ban-support-links is-sidebar-style";
        linksEl.innerHTML = "";
        sidebarAnchors.forEach((anchor) => {
          try {
            const clone = anchor.cloneNode(true);
            const href = String(clone.getAttribute("href") || "").trim();
            if (href && href !== "#" && !/^mailto:/i.test(href)) {
              clone.setAttribute("target", "_blank");
              clone.setAttribute("rel", "noopener noreferrer");
            }
            linksEl.appendChild(clone);
          } catch (_) {}
        });
        noteEl.style.display = "block";
        linksEl.style.display = "flex";
        return;
      }

      const items = collectBannedOverlaySupportItems();
      if (!items.length) {
        noteEl.style.display = "none";
        linksEl.style.display = "none";
        linksEl.innerHTML = "";
        return;
      }
      const template = readBannedOverlaySupportTemplate();
      linksEl.className = "ban-support-links";
      linksEl.innerHTML = "";

      items.forEach((item) => {
        const anchor = document.createElement("a");
        if (template.anchorClassName) anchor.className = template.anchorClassName;
        if (template.anchorStyle) anchor.setAttribute("style", template.anchorStyle);
        anchor.classList.add("ban-support-link");
        anchor.setAttribute("href", item.href);
        if (!/^mailto:/i.test(item.href)) {
          anchor.setAttribute("target", "_blank");
          anchor.setAttribute("rel", "noopener noreferrer");
        }
        anchor.innerHTML = `<i class="${item.icon}" aria-hidden="true"></i><span>${bannedOverlayEscapeHtml(item.label)}</span>`;
        linksEl.appendChild(anchor);
      });

      noteEl.style.display = "block";
      linksEl.style.display = "grid";
    } catch (_) {}
  }

  function scheduleBannedOverlaySupportRefresh(overlay) {
    try {
      if (!overlay) return;
      const timers = Array.isArray(overlay.__banSupportRefreshTimers)
        ? overlay.__banSupportRefreshTimers
        : [];
      timers.forEach((timerId) => {
        try { clearTimeout(timerId); } catch (_) {}
      });
      overlay.__banSupportRefreshTimers = [180, 900, 2200].map((delay) => (
        setTimeout(() => {
          try {
            if (!overlay.isConnected) return;
            renderBannedOverlaySupportButtons(overlay);
          } catch (_) {}
        }, delay)
      ));
    } catch (_) {}
  }

  function showLocalBannedOverlay(reason, webuid) {
    try {
      let overlay = document.getElementById("ban-block-overlay-login");
      if (!overlay) {
        ensureBannedOverlayStyles();
        overlay = document.createElement("div");
        overlay.id = "ban-block-overlay-login";
        overlay.setAttribute("role", "alertdialog");
        overlay.setAttribute("aria-label", "تم حظر الحساب");
        overlay.style.position = "fixed";
        overlay.style.inset = "0";
        overlay.style.display = "flex";
        overlay.style.alignItems = "center";
        overlay.style.justifyContent = "center";
        overlay.style.padding = "18px";
        overlay.style.background = "linear-gradient(175deg,#010208 0%, #040812 56%, #02040a 100%)";
        overlay.style.zIndex = "20000";
        overlay.style.overflow = "hidden";

        const lines = document.createElement("div");
        lines.style.position = "absolute";
        lines.style.inset = "0";
        lines.style.pointerEvents = "none";
        lines.style.opacity = ".93";
        lines.style.backgroundImage = [
          "radial-gradient(circle at 45% 40%, rgba(120,18,18,0.18), rgba(0,0,0,0) 62%)",
          "repeating-linear-gradient(-35deg, rgba(116,14,18,0.56) 0 44px, rgba(20,6,18,0.88) 44px 88px)"
        ].join(",");
        lines.style.mixBlendMode = "normal";
        overlay.appendChild(lines);

        const card = document.createElement("div");
        card.style.position = "relative";
        card.style.maxWidth = "520px";
        card.style.width = "100%";
        card.style.background = "linear-gradient(180deg, rgba(27,4,6,0.96) 0%, rgba(16,3,5,0.98) 100%)";
        card.style.color = "#ffe0e0";
        card.style.borderRadius = "14px";
        card.style.boxShadow = "0 24px 70px rgba(0,0,0,0.65), inset 0 0 0 1px rgba(255,76,76,0.22)";
        card.style.border = "2px solid rgba(219,45,45,0.88)";
        card.style.overflow = "hidden";
        card.innerHTML = `
          <div style="padding:18px 20px;background:linear-gradient(180deg,#c42929 0%, #9f1f1f 100%);border-bottom:1px solid rgba(255,120,120,0.42);text-align:center;">
            <h2 style="margin:0;font-size:2rem;line-height:1.2;color:#fff8f8;font-weight:900;">حسابك محظور</h2>
          </div>
          <div style="padding:20px 22px 22px;">
            <p style="margin:0 0 14px;line-height:1.8;font-size:1rem;color:#ffcfcf;">تم إيقاف هذا الحساب ولا يمكن متابعة الاستخدام حالياً.</p>
            <p id="banReasonTextInline" style="margin:0 0 8px;line-height:1.7;font-size:1rem;color:#ff8f8f;display:none;"></p>
            <p id="banWebuidTextInline" style="margin:0 0 16px;line-height:1.7;font-size:.95rem;color:#ffb9b9;opacity:.95;display:none;"></p>
            <button id="banLogoutBtnInline" type="button" style="width:100%;padding:12px 14px;border-radius:10px;border:1px solid rgba(255,145,145,0.45);background:linear-gradient(180deg,#ed3a3a 0%,#b11f1f 100%);color:#fff;font-weight:900;font-size:1rem;cursor:pointer;">حسنًا</button>
            <p id="banSupportNoteInline" class="ban-support-note" style="display:none;">يرجى التواصل مع الدعم لحل المشكلة.</p>
            <div id="banSupportLinksInline" class="ban-support-links" style="display:none;"></div>
          </div>
        `;
        overlay.appendChild(card);
        (document.body || document.documentElement).appendChild(overlay);

        const btn = overlay.querySelector("#banLogoutBtnInline");
        if (btn) {
          btn.addEventListener("click", (event) => {
            try { event.preventDefault(); event.stopPropagation(); } catch (_) {}
            logoutBannedAccountNow(btn);
          }, true);
        }

        if (!overlay.__banSupportStateBound) {
          overlay.__banSupportStateBound = true;
          overlay.__banSupportStateListener = () => {
            try {
              if (!overlay.isConnected) return;
              renderBannedOverlaySupportButtons(overlay);
              scheduleBannedOverlaySupportRefresh(overlay);
            } catch (_) {}
          };
          try {
            window.addEventListener("site-state-updated", overlay.__banSupportStateListener);
          } catch (_) {}
        }
        bindBannedOverlaySupportObservers(overlay);
      }

      const cleanReason = (typeof reason === "string" ? reason.trim() : "");
      const reasonEl = overlay.querySelector("#banReasonTextInline");
      if (reasonEl) {
        reasonEl.textContent = cleanReason ? ("سبب الحظر: " + cleanReason) : "";
        reasonEl.style.display = cleanReason ? "block" : "none";
      }
      const cleanWebuid = (webuid == null ? "" : String(webuid)).trim();
      const webuidEl = overlay.querySelector("#banWebuidTextInline");
      if (webuidEl) {
        webuidEl.textContent = cleanWebuid ? ("الايدي: \u2066" + cleanWebuid + "\u2069") : "";
        webuidEl.style.display = cleanWebuid ? "block" : "none";
      }
      renderBannedOverlaySupportButtons(overlay);
      bindBannedOverlaySupportObservers(overlay);
      scheduleBannedOverlaySupportRefresh(overlay);
      return true;
    } catch (_) {
      return false;
    }
  }

  function presentBannedAccountDialog(reason, webuid) {
    try {
      const globalHandler = (typeof window.handleBannedAccount === "function")
        ? window.handleBannedAccount
        : ((typeof handleBannedAccount === "function") ? handleBannedAccount : null);
      if (typeof globalHandler === "function") {
        globalHandler(reason, webuid);
        return true;
      }
    } catch (_) {}
    return showLocalBannedOverlay(reason, webuid);
  }

  // Firebase is disabled in this frontend, so a banned account now comes back as an "auth/banned"
  // error from the unified router instead of via the Firestore session watcher. Show the same
  // full-screen custom overlay (with the admin ban reason + account id) here.
  function showRouterBannedOverlay(err) {
    const code = err && err.code ? String(err.code) : "";
    if (code !== "auth/banned") return false;
    let reason = "";
    let webuid = "";
    try {
      const payload = (err && err.payload && typeof err.payload === "object") ? err.payload : null;
      const details = (payload && payload.details && typeof payload.details === "object") ? payload.details : null;
      if (details) {
        reason = String(details.banReason || details.reason || "").trim();
        webuid = String(details.webuid || details.webUid || details.uidNo || "").trim();
      }
      if (!reason && payload) reason = String(payload.banReason || payload.reason || "").trim();
      if (!webuid && payload) webuid = String(payload.webuid || payload.webUid || "").trim();
    } catch (_) {}
    try { showLocalBannedOverlay(reason, webuid); } catch (_) { return false; }
    return true;
  }

  async function assertNotBanned(uid, targetErrorEl) {
    try {
      await ensureFirebaseCompatAsync();
      if (!db || typeof db.collection !== "function") {
        pushGoogleFlowLog("ban_check_skipped_db_unavailable", { uid: maskDebugUid(uid) });
        logGoogleConsole("warn", "ban_check_skipped_db_unavailable", { uid: maskDebugUid(uid) });
        return true;
      }
      const snap = await db.collection("users").doc(uid).get();
      const data = snap.exists ? (snap.data() || {}) : {};
      if (data.isBanned === true) {
        const reason = (typeof data.banReason === "string" ? data.banReason.trim() : "");
        const webuid = String(data.webuid || data.webUid || data.uidNo || uid || "").trim();
        if (targetErrorEl) {
          targetErrorEl.style.color = "var(--danger, #ef4444)";
          if (reason) {
            targetErrorEl.textContent = `تم حظر حسابك. سبب الحظر: ${reason}`;
          } else {
            targetErrorEl.textContent = "تم حظر حسابك.";
          }
        }
        pushGoogleFlowLog("ban_check_blocked", { uid: maskDebugUid(uid), hasReason: !!reason });
        const shown = presentBannedAccountDialog(reason, webuid);
        if (!shown) {
          try { if (auth) await auth.signOut(); } catch (_) {}
          clearAuthLocalArtifacts();
        }
        return false;
      }
    } catch (err) {
      pushGoogleFlowLog("ban_check_failed_open", {
        uid: maskDebugUid(uid),
        error: getErrorMeta(err)
      });
      logGoogleConsole("warn", "ban_check_failed_open", {
        uid: maskDebugUid(uid),
        error: getErrorMeta(err)
      });
      return true;
    }
    return true;
  }

  async function performManualLogin(event) {
    if (event && typeof event.preventDefault === "function") event.preventDefault();
    const submitLogin = byId('submitLogin');
    const emailInput = byId('emailInput');
    const passwordInput = byId('passwordInput');
    const loginError = byId('loginError') || byId('registerError');
    if (!submitLogin || !emailInput || !passwordInput || !loginError) return;
    if (submitLogin.disabled || submitLogin.getAttribute("aria-busy") === "true") return;
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();
    loginError.textContent = "";

    if (!email || !password) {
      loginError.textContent = "يرجى إدخال البريد الإلكتروني وكلمة المرور.";
      return;
    }

    lastLoginEmail = email;
    lastLoginPassword = password;
    let manualLoginLoaderVisible = false;
    const showManualLoginLoader = function(){
      if (manualLoginLoaderVisible) {
        forceGooglePreloaderVisible();
        return;
      }
      showRequestLoader();
      manualLoginLoaderVisible = true;
    };
    const hideManualLoginLoader = function(){
      if (!manualLoginLoaderVisible) return;
      hideRequestLoader();
      manualLoginLoaderVisible = false;
    };
    showManualLoginLoader();
    setButtonBusy(submitLogin, true);

    try {
      const networkReady = await ensureNetworkHealthy(loginError);
      if (!networkReady) return;

    let loginResult = null;
    let totpCode = "";
    let totpMethod = "";
    let totpEmailRequested = false;
    let totpEmailSent = false;
    while (true) {
        try {
          showManualLoginLoader();
          const loginPayload = {
            email,
            password,
            ...(totpCode
              ? (totpMethod === "telegram"
                ? { telegramCode: totpCode }
                : (totpMethod === "app" ? { code: totpCode } : { code: totpCode, telegramCode: totpCode }))
              : {})
          };
          loginResult = await callManualAuth("login", loginPayload, loginError);
          break;
        } catch (err) {
          const code = err && err.code ? String(err.code) : "";
          if ([
            "totp_required",
            "totp_code_invalid",
            "telegram_otp_required",
            "telegram_otp_invalid",
            "telegram_otp_expired"
          ].includes(code)) {
            hideManualLoginLoader();
            loginError.textContent = "";
            totpMethod = resolveTotpChallengeMethodFromError(err, totpMethod);
            const subtitle = totpMethod === "telegram"
              ? "ادخل الكود المستلم على تيليغرام."
              : "أدخل رمز Google Authenticator المكوّن من 6 أرقام.";
            const errorText = (code === "telegram_otp_invalid")
              ? "رمز تيليغرام غير صحيح."
              : (code === "totp_code_invalid")
                ? "رمز التطبيق غير صحيح."
                : (code === "telegram_otp_expired" ? "انتهت صلاحية رمز تيليغرام، اطلب رمزًا جديدًا." : "");
            if (isTotpCodeDeliveryMethod(totpMethod) && code === "telegram_otp_expired") {
              totpEmailRequested = false;
              totpEmailSent = false;
            }
            const inputCode = await requestTotpCode(subtitle, errorText, {
              method: totpMethod,
              emailCodeSent: totpEmailSent,
              requestEmailCode: isTotpCodeDeliveryMethod(totpMethod)
                ? (async () => {
                  totpEmailRequested = true;
                  const payload = await requestLoginTelegramOtpCode(email, password, loginError);
                  totpEmailSent = true;
                  return payload;
                })
                : null,
              autoRequestEmail: isTotpCodeDeliveryMethod(totpMethod) && !totpEmailRequested,
              lostRecovery: totpMethod === "app"
                ? {
                  requestEmailCode: () => requestLoginRecoveryTelegramOtpCode(email, password, loginError),
                  verifyEmailCode: (telegramCode) => verifyLostTotpWithLoginCredentials(email, password, telegramCode, loginError),
                  disableWithEmailCode: (telegramCode) => disableLostTotpWithLoginCredentials(email, password, telegramCode, loginError)
                }
                : null
            });
            if (!inputCode) return;
            if (inputCode === TOTP_RECOVERY_DISABLED_SIGNAL) {
              totpCode = "";
              totpMethod = "";
              totpEmailRequested = false;
              totpEmailSent = false;
              continue;
            }
            totpCode = inputCode;
            continue;
          }
          if (code === "totp_not_configured") {
            loginError.textContent = translateFirebaseError(code);
            return;
          }
          throw err;
        }
      }

      if (false && loginResult && loginResult.admin === true) {
        loginError.textContent = "تسجيل دخول الإدارة غير متاح من الواجهة العامة.";
        return;
      }

      const sessionKey = loginResult.sessionKey || "";
      const ttlSeconds = Number(loginResult.ttlSeconds) || 0;
      if (sessionKey) saveSessionLocal({ uid: loginResult.uid, sessionKey, deviceId: loginResult.deviceId || getDeviceId(), ts: Date.now(), ttlSeconds });

      const basePayload = {
        uid: loginResult.uid || "",
        email: loginResult.email || email,
        token: loginResult.idToken || loginResult.id_token || "",
        sessionKey,
        customToken: loginResult.customToken || loginResult.custom_token || "",
        authkey: loginResult.authkey || loginResult.authKey || "",
        accountNo: extractAccountNo(loginResult),
        displayName: loginResult.displayName || loginResult.name || "",
        name: loginResult.name || loginResult.displayName || "",
        username: loginResult.username || "",
        photoURL: loginResult.photoURL || loginResult.photoUrl || ""
      };
      if (basePayload.token || basePayload.customToken || basePayload.sessionKey) {
        savePostLoginPayload(basePayload);
      }

      let user = null;
      const canFirebase = canUseFirebaseAuth() && !!basePayload.customToken;
      if (canFirebase) {
        await ensureFirebaseCompatAsync();
        if (auth && typeof auth.signInWithCustomToken === "function") {
          try {
            await ensureAuthPersistenceLocal();
            await auth.signInWithCustomToken(basePayload.customToken);
            user = auth.currentUser;
          } catch (_) {
            user = null;
          }
        }
      }

      if (user) {
        const allowed = await assertNotBanned(user.uid, loginError);
        if (!allowed) return;
      }

      let idToken = basePayload.token;
      if (user && typeof user.getIdToken === "function") {
        try { idToken = await user.getIdToken(true); } catch (_) { idToken = basePayload.token; }
      }
      if (!idToken) {
        loginError.textContent = "تعذر تأكيد الجلسة، أعد تسجيل الدخول.";
        return;
      }

      savePostLoginPayload({
        ...basePayload,
        uid: (user && user.uid) ? user.uid : basePayload.uid,
        email: (user && user.email) ? user.email : basePayload.email,
        token: idToken || basePayload.token,
        authkey: basePayload.authkey || "",
        displayName: (user && user.displayName) ? user.displayName : (basePayload.displayName || basePayload.name || ""),
        name: (user && user.displayName) ? user.displayName : (basePayload.name || basePayload.displayName || ""),
        username: basePayload.username || "",
        photoURL: (user && user.photoURL) ? user.photoURL : (basePayload.photoURL || "")
      });
      goHomeAfterAuthSuccess();
    } catch (err) {
      try { console.error("performManualLogin error", err); } catch (_) {}
      const code = err && err.code ? String(err.code) : "";
      if (showRouterBannedOverlay(err)) return;
      loginError.textContent = translateFirebaseError(err || code);
    } finally {
      setButtonBusy(submitLogin, false);
      hideManualLoginLoader();
    }
  }

  async function confirmUnverifiedLogin() {
    if (canUseFirebaseAuth()) {
      await ensureFirebaseCompatAsync();
    }
    const loginError = byId('loginError') || byId('registerError');
    const user = auth ? auth.currentUser : null;
    const cached = readPostLoginPayload() || {};

    try {
      if (user) {
        const allowed = await assertNotBanned(user.uid, loginError);
        if (!allowed) return;
      }
      const sessionInfo = getSessionLocal() || {};
      const sessionKey = sessionInfo.sessionKey || cached.sessionKey || "";
      if (!sessionKey) {
        if (loginError) loginError.textContent = "رمز الجلسة غير متوفر. أعد تسجيل الدخول.";
        return;
      }

      let idToken = "";
      if (user && typeof user.getIdToken === "function") {
        try { idToken = await user.getIdToken(true); } catch (_) { idToken = ""; }
      }
      if (!idToken) {
        idToken = cached.token || cached.idToken || "";
      }
      if (!idToken) {
        if (loginError) loginError.textContent = "تعذر تأكيد الجلسة، أعد تسجيل الدخول.";
        return;
      }

      savePostLoginPayload({
        uid: (user && user.uid) ? user.uid : (cached.uid || ""),
        email: (user && user.email) ? user.email : (cached.email || ""),
        token: idToken,
        sessionKey,
        customToken: cached.customToken || cached.custom_token || "",
        authkey: cached.authkey || cached.authKey || "",
        accountNo: extractAccountNo(cached),
        displayName: (user && user.displayName) ? user.displayName : (cached.displayName || cached.name || ""),
        name: (user && user.displayName) ? user.displayName : (cached.name || cached.displayName || ""),
        username: cached.username || "",
        photoURL: (user && user.photoURL) ? user.photoURL : (cached.photoURL || cached.photoUrl || "")
      });
      goHomeAfterAuthSuccess();
    } catch (err) {
      if (loginError) loginError.textContent = translateFirebaseError(err);
    }
  }

  // REFERRAL: the invite landing (#/invite/{webuid}) stashes the inviter's
  // webuid in localStorage; account creation relays it to the backend — which
  // does ALL the validation (invalid/self/duplicate referrals are ignored
  // server-side) — then the stash is cleared so it is never reused.
  const REFERRAL_INVITER_STASH_KEY = 'edaa:referral:inviter:v1';
  // Reads the inviter webuid stashed by the /invite/{webuid} landing. Prints a
  // clear client-side line so the sign-up flow is debuggable in the browser
  // console: whether a referral is present and will be attached to the request.
  function readReferralInviterWebuid() {
    try {
      const raw = localStorage.getItem(REFERRAL_INVITER_STASH_KEY);
      if (!raw) {
        try { console.info('[referral] لا توجد دعوة مخزّنة — تسجيل عادي (لن تُرسل إحالة)'); } catch (_) {}
        return '';
      }
      const parsed = JSON.parse(raw);
      const webuid = String((parsed && parsed.webuid) || '').trim();
      if (/^[0-9]{1,15}$/.test(webuid)) {
        try { console.info('[referral] دعوة مخزّنة webuid=' + webuid + ' — ستُرفق بطلب إنشاء الحساب'); } catch (_) {}
        return webuid;
      }
      try { console.warn('[referral] الدعوة المخزّنة غير صالحة (webuid=' + webuid + ') — لن تُرسل'); } catch (_) {}
      return '';
    } catch (_) { return ''; }
  }
  function clearReferralInviterStash() {
    try { localStorage.removeItem(REFERRAL_INVITER_STASH_KEY); } catch (_) {}
  }
  // The account was created, but the server declined the referral for a
  // same-device / same-IP policy — let the new user know (their account is fine;
  // only the invite bonus was rejected). Delayed so the toast lands after the
  // post-auth navigation settles. Benign non-links never set referralRejected.
  function notifyReferralRejectedIfNeeded(authResult) {
    try {
      if (!authResult || authResult.referralRejected !== true) return;
      const reason = String(authResult.referralRejectReason || '');
      const text = reason === 'same_ip_blocked'
        ? 'تعذّر تفعيل الإحالة: لا يمكن قبول دعوة من نفس الشبكة.'
        : reason === 'same_device_blocked'
          ? 'تعذّر تفعيل الإحالة: لا يمكن قبول دعوة من نفس الجهاز.'
          : 'تعذّر تفعيل الإحالة لهذه الدعوة.';
      setTimeout(function () {
        try { if (typeof window !== 'undefined' && typeof window.showToast === 'function') window.showToast(text, 'warning', 6000); } catch (_) {}
      }, 900);
    } catch (_) {}
  }

  async function register() {
    const username = (byId('usernameInput')?.value || '').trim();
    const email = (byId('registerEmail')?.value || '').trim();
    const password = (byId('registerPassword')?.value || '').trim();
    const msg = byId('registerError');
    const registerSubmitBtn = byId('registerSubmitBtn');
    clearLegalConsentError();
    if (msg) { msg.textContent = ""; msg.style.color = ""; }

    if (!username || !email || !password) {
      if (msg) {
        msg.style.color = "var(--danger, #ef4444)";
        msg.textContent = "يرجى إدخال جميع الحقول.";
      }
      return;
    }

    if (!hasLegalConsent()) {
      showLegalConsentError(window.__I18N__ && typeof window.__I18N__.t === "function"
        ? window.__I18N__.t("legal.consent.requiredFirst", "يجب الموافقة على سياسة الخصوصية وشروط الاستخدام أولًا.")
        : "يجب الموافقة على سياسة الخصوصية وشروط الاستخدام أولًا.", msg);
      try { switchForm("register"); } catch (_) {}
      const checkbox = getLegalConsentCheckbox();
      try { checkbox && checkbox.focus(); } catch (_) {}
      return;
    }

    const phone = (window.iti && typeof window.iti.getNumber === 'function') ? window.iti.getNumber() : "";

    showRequestLoader();
    setButtonBusy(registerSubmitBtn, true);
    try {
      const networkReady = await ensureNetworkHealthy(msg);
      if (!networkReady) return;

      const referrerWebuid = readReferralInviterWebuid();
      const registerResult = await callManualAuth("register", {
        username, email, password, phone,
        ...(referrerWebuid ? { referrerWebuid } : {})
      }, msg);
      const sessionKey = registerResult.sessionKey || "";
      const ttlSeconds = Number(registerResult.ttlSeconds) || 0;
      if (sessionKey && registerResult.uid) {
        saveSessionLocal({ uid: registerResult.uid, sessionKey, deviceId: registerResult.deviceId || getDeviceId(), ts: Date.now(), ttlSeconds });
      }
      // The account now exists — the referral (if any) was linked server-side;
      // drop the stash so it can never be attached to another account.
      if (registerResult && registerResult.uid) clearReferralInviterStash();
      notifyReferralRejectedIfNeeded(registerResult);

      const basePayload = {
        uid: registerResult.uid || "",
        email: registerResult.email || email,
        token: registerResult.idToken || registerResult.id_token || "",
        sessionKey,
        customToken: registerResult.customToken || registerResult.custom_token || "",
        authkey: registerResult.authkey || registerResult.authKey || "",
        accountNo: extractAccountNo(registerResult),
        displayName: registerResult.displayName || registerResult.name || "",
        name: registerResult.name || registerResult.displayName || "",
        username: registerResult.username || username || "",
        photoURL: registerResult.photoURL || registerResult.photoUrl || ""
      };

      let user = null;
      const canFirebase = canUseFirebaseAuth() && !!basePayload.customToken;
      if (canFirebase) {
        await ensureFirebaseCompatAsync();
        if (auth && typeof auth.signInWithCustomToken === 'function') {
          try {
            await ensureAuthPersistenceLocal();
            await auth.signInWithCustomToken(basePayload.customToken);
            user = auth.currentUser;
          } catch (_) {
            user = null;
          }
        }
      }

      if (user) {
        const allowed = await assertNotBanned(user.uid, msg);
        if (!allowed) {
          try { if (auth) await auth.signOut(); } catch (_) {}
          return;
        }
      }

      let idToken = basePayload.token;
      if (user && typeof user.getIdToken === 'function') {
        try { idToken = await user.getIdToken(true); } catch (_) { idToken = basePayload.token; }
      }
      if (idToken) {
        storeLegalConsent("register_email");
        savePostLoginPayload({
          ...basePayload,
          uid: (user && user.uid) ? user.uid : basePayload.uid,
          email: (user && user.email) ? user.email : basePayload.email,
          token: idToken || basePayload.token,
          authkey: basePayload.authkey || "",
          displayName: (user && user.displayName) ? user.displayName : (basePayload.displayName || basePayload.name || ""),
          name: (user && user.displayName) ? user.displayName : (basePayload.name || basePayload.displayName || ""),
          username: basePayload.username || "",
          photoURL: (user && user.photoURL) ? user.photoURL : (basePayload.photoURL || "")
        });
        goHomeAfterAuthSuccess();
        return;
      }

      if (msg) {
        storeLegalConsent("register_email");
        msg.style.color = "var(--success, #22c55e)";
        msg.textContent = "تم إنشاء الحساب بنجاح.";
      }
    } catch (err) {
      if (showRouterBannedOverlay(err)) return;
      if (msg) {
        msg.style.color = "var(--danger, #ef4444)";
        msg.textContent = translateFirebaseError(err) || "تعذر إكمال العملية، حاول مرة أخرى.";
      }
    } finally {
      setButtonBusy(registerSubmitBtn, false);
      syncRegisterConsentState();
      hideRequestLoader();
    }
  }

  function normalizeGoogleUsername(displayName, email) {
    const raw = (displayName || (email ? email.split('@')[0] : '') || '').trim();
    if (!raw) return '';
    return raw
      .replace(/[^\p{L}\p{N}_\s-]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 24);
  }

  function isGoogleProviderUser(user) {
    if (!user) return false;
    try {
      const providers = Array.isArray(user.providerData) ? user.providerData : [];
      return providers.some((item) => String((item && item.providerId) || "").toLowerCase() === "google.com");
    } catch (_) {
      return false;
    }
  }

  const GOOGLE_USERNAME_MODAL = 'completeProfileModal';
  const GOOGLE_PHONE_MODAL = 'googlePhoneModal';

  const googleFlowState = {
    entry: 'login',
    user: null,
    isNewUser: false,
    profile: { username: '', phone: '' }
  };

  async function requestTotpCode(message, errorText, options = {}) {
    const method = normalizeTotpChallengeMethod(options && options.method);
    const defaultSubtitle = method === "telegram"
      ? "ادخل الكود المستلم على تيليغرام."
      : "أدخل رمز Google Authenticator المكوّن من 6 أرقام.";
    return requestTotpCodeWithModal({
      method,
      subtitle: message || defaultSubtitle,
      error: errorText || "",
      emailCodeSent: options && options.emailCodeSent === true,
      lostEmailCodeSent: options && options.lostEmailCodeSent === true,
      requestEmailCode: options && typeof options.requestEmailCode === "function" ? options.requestEmailCode : null,
      autoRequestEmail: options && options.autoRequestEmail === true,
      lostRecovery: options && options.lostRecovery ? options.lostRecovery : null
    });
  }

  async function requestLoginTelegramOtpCode(email, password, targetErrorEl) {
    const cleanEmail = String(email || "").trim();
    const cleanPassword = String(password || "");
    if (!cleanEmail || !cleanPassword) {
      const err = new Error("auth/missing-credentials");
      err.code = "auth/missing-credentials";
      throw err;
    }
    return callManualAuth("telegram_otp_request", {
      purpose: "login",
      email: cleanEmail,
      password: cleanPassword
    }, targetErrorEl);
  }

  async function requestLoginRecoveryTelegramOtpCode(email, password, targetErrorEl) {
    const cleanEmail = String(email || "").trim();
    const cleanPassword = String(password || "");
    if (!cleanEmail || !cleanPassword) {
      const err = new Error("auth/missing-credentials");
      err.code = "auth/missing-credentials";
      throw err;
    }
    return callManualAuth("telegram_otp_request", {
      purpose: "totp_disable",
      email: cleanEmail,
      password: cleanPassword
    }, targetErrorEl);
  }

  async function disableLostTotpWithLoginCredentials(email, password, telegramCode, targetErrorEl) {
    const cleanEmail = String(email || "").trim();
    const cleanPassword = String(password || "");
    const cleanCode = normalizeTotpCode(telegramCode);
    if (!cleanEmail || !cleanPassword || cleanCode.length !== 6) {
      const err = new Error("auth/missing-credentials");
      err.code = "auth/missing-credentials";
      throw err;
    }
    return callManualAuth("totp_recovery_disable", {
      email: cleanEmail,
      password: cleanPassword,
      telegramCode: cleanCode,
      method: "telegram",
      enabledVia: "telegram",
      preferredFactor: "telegram"
    }, targetErrorEl);
  }

  async function verifyLostTotpWithLoginCredentials(email, password, telegramCode, targetErrorEl) {
    const cleanEmail = String(email || "").trim();
    const cleanPassword = String(password || "");
    const cleanCode = normalizeTotpCode(telegramCode);
    if (!cleanEmail || !cleanPassword || cleanCode.length !== 6) {
      const err = new Error("auth/missing-credentials");
      err.code = "auth/missing-credentials";
      throw err;
    }
    return callManualAuth("totp_recovery_verify", {
      email: cleanEmail,
      password: cleanPassword,
      telegramCode: cleanCode,
      method: "telegram",
      enabledVia: "telegram",
      preferredFactor: "telegram"
    }, targetErrorEl);
  }

  async function requestGoogleTelegramOtpCode(user, targetErrorEl) {
    if (!user || typeof user.getIdToken !== "function") {
      const err = new Error("auth/missing-credentials");
      err.code = "auth/missing-credentials";
      throw err;
    }
    const idToken = await user.getIdToken(true);
    return callManualAuth("telegram_otp_request", {
      purpose: "login",
      idToken
    }, targetErrorEl);
  }

  async function requestGoogleRecoveryTelegramOtpCode(user, targetErrorEl) {
    if (!user || typeof user.getIdToken !== "function") {
      const err = new Error("auth/missing-credentials");
      err.code = "auth/missing-credentials";
      throw err;
    }
    const idToken = await user.getIdToken(true);
    return callManualAuth("telegram_otp_request", {
      purpose: "totp_disable",
      idToken
    }, targetErrorEl);
  }

  async function disableLostTotpWithGoogleToken(user, telegramCode, targetErrorEl) {
    if (!user || typeof user.getIdToken !== "function") {
      const err = new Error("auth/missing-credentials");
      err.code = "auth/missing-credentials";
      throw err;
    }
    const cleanCode = normalizeTotpCode(telegramCode);
    if (cleanCode.length !== 6) {
      const err = new Error("telegram_otp_required");
      err.code = "telegram_otp_required";
      throw err;
    }
    const idToken = await user.getIdToken(true);
    return callManualAuth("totp_recovery_disable", {
      idToken,
      telegramCode: cleanCode,
      method: "telegram",
      enabledVia: "telegram",
      preferredFactor: "telegram"
    }, targetErrorEl);
  }

  async function verifyLostTotpWithGoogleToken(user, telegramCode, targetErrorEl) {
    if (!user || typeof user.getIdToken !== "function") {
      const err = new Error("auth/missing-credentials");
      err.code = "auth/missing-credentials";
      throw err;
    }
    const cleanCode = normalizeTotpCode(telegramCode);
    if (cleanCode.length !== 6) {
      const err = new Error("telegram_otp_required");
      err.code = "telegram_otp_required";
      throw err;
    }
    const idToken = await user.getIdToken(true);
    return callManualAuth("totp_recovery_verify", {
      idToken,
      telegramCode: cleanCode,
      method: "telegram",
      enabledVia: "telegram",
      preferredFactor: "telegram"
    }, targetErrorEl);
  }

  async function syncGoogleSession(targetErrorEl) {
    const user = googleFlowState.user;
    if (!user) throw new Error("google_user_missing");
    const idToken = await user.getIdToken();
    // REFERRAL: a first-time Google sign-in creates the account server-side —
    // relay the stashed inviter webuid; the backend links ONLY when the sync
    // actually created the account (existing accounts are never re-linked).
    const googleReferrerWebuid = readReferralInviterWebuid();
    const payload = {
      idToken,
      uid: user.uid || '',
      email: user.email || '',
      provider: 'google',
      rotateSession: false,
      username: googleFlowState.profile.username || '',
      phone: googleFlowState.profile.phone || '',
      displayName: user.displayName || '',
      photoURL: user.photoURL || '',
      ...(googleReferrerWebuid ? { referrerWebuid: googleReferrerWebuid } : {})
    };
    let totpCode = "";
    let totpMethod = "";
    let totpEmailRequested = false;
    let totpEmailSent = false;
    while (true) {
      try {
        showGoogleRedirectLoader(
          "جاري تأكيد جلسة Google...",
          "ننتظر رد الخادم لإكمال الدخول."
        );
        const result = await callManualAuth("sync", {
          ...payload,
          ...(totpCode
            ? (totpMethod === "telegram"
              ? { telegramCode: totpCode }
              : (totpMethod === "app" ? { code: totpCode } : { code: totpCode, telegramCode: totpCode }))
            : {})
        }, targetErrorEl);
        const sessionKey = result.sessionKey || "";
        const ttlSeconds = Number(result.ttlSeconds) || 0;
        if (sessionKey) saveSessionLocal({ uid: result.uid, sessionKey, deviceId: result.deviceId || getDeviceId(), ts: Date.now(), ttlSeconds });
        // Signed in with an account — the invitation intent is consumed
        // (linked server-side if this sync created the account).
        clearReferralInviterStash();
        notifyReferralRejectedIfNeeded(result);
        return { result, idToken };
      } catch (err) {
        const code = err && err.code ? String(err.code) : "";
        if ([
          "totp_required",
          "totp_code_invalid",
          "telegram_otp_required",
          "telegram_otp_invalid",
          "telegram_otp_expired"
        ].includes(code)) {
          if (targetErrorEl) targetErrorEl.textContent = "";
          hideGoogleRedirectLoader();
          totpMethod = resolveTotpChallengeMethodFromError(err, totpMethod);
          const subtitle = totpMethod === "telegram"
            ? "ادخل الكود المستلم على تيليغرام."
            : "أدخل رمز Google Authenticator المكوّن من 6 أرقام.";
          const errorText = (code === "telegram_otp_invalid")
            ? "رمز تيليغرام غير صحيح."
            : (code === "totp_code_invalid")
              ? "رمز التطبيق غير صحيح."
              : (code === "telegram_otp_expired" ? "انتهت صلاحية رمز تيليغرام، اطلب رمزًا جديدًا." : "");
          if (isTotpCodeDeliveryMethod(totpMethod) && code === "telegram_otp_expired") {
            totpEmailRequested = false;
            totpEmailSent = false;
          }
          const inputCode = await requestTotpCode(subtitle, errorText, {
            method: totpMethod,
            emailCodeSent: totpEmailSent,
            requestEmailCode: isTotpCodeDeliveryMethod(totpMethod)
              ? (async () => {
                totpEmailRequested = true;
                const payload = await requestGoogleTelegramOtpCode(user, targetErrorEl);
                totpEmailSent = true;
                return payload;
              })
              : null,
            autoRequestEmail: isTotpCodeDeliveryMethod(totpMethod) && !totpEmailRequested,
            lostRecovery: totpMethod === "app"
              ? {
                requestEmailCode: () => requestGoogleRecoveryTelegramOtpCode(user, targetErrorEl),
                verifyEmailCode: (telegramCode) => verifyLostTotpWithGoogleToken(user, telegramCode, targetErrorEl),
                disableWithEmailCode: (telegramCode) => disableLostTotpWithGoogleToken(user, telegramCode, targetErrorEl)
              }
              : null
          });
          if (!inputCode) {
            const cancelErr = new Error("totp_cancelled");
            cancelErr.code = "totp_cancelled";
            throw cancelErr;
          }
          if (inputCode === TOTP_RECOVERY_DISABLED_SIGNAL) {
            totpCode = "";
            totpMethod = "";
            totpEmailRequested = false;
            totpEmailSent = false;
            continue;
          }
          totpCode = inputCode;
          continue;
        }
        if (code === "totp_not_configured" && targetErrorEl) {
          targetErrorEl.textContent = translateFirebaseError(code);
        }
        throw err;
      }
    }
  }

  function shouldUseGoogleFinalizeLocalFallback(error) {
    const code = normalizeUiErrorCode(error?.code || error?.message || "");
    if (!code) return false;
    if (code.startsWith("network/")) return true;
    if (code.startsWith("auth/http-")) return true;
    if (code === "auth/network-request-failed") return true;
    if (code === "auth/internal-error") return true;
    if (code === "auth/unknown") return true;
    return false;
  }

  function resetGoogleFlow() {
    pushGoogleFlowLog("google_flow_reset", { entry: googleFlowState.entry });
    googleFlowState.entry = 'login';
    googleFlowState.user = null;
    googleFlowState.isNewUser = false;
    googleFlowState.profile = { username: '', phone: '' };
  }

  async function finalizeGoogleLogin() {
    const entryPoint = googleFlowState.entry === 'register' ? 'register' : 'login';
    const loginError = (entryPoint === 'register' ? byId('registerError') : byId('loginError')) || byId('loginError');
    if (!googleFlowState.user) return;
    const uidMasked = maskDebugUid(googleFlowState.user && googleFlowState.user.uid);
    pushGoogleFlowLog("google_finalize_start", { uid: uidMasked, isNewUser: !!googleFlowState.isNewUser });
    setGoogleFlowTask("google_finalize_session_sync", { uid: uidMasked, entry: googleFlowState.entry });
    showGoogleRedirectLoader(
      "جاري تجهيز جلسة الحساب...",
      "نحفظ تسجيل الدخول ونجهّز بيانات حسابك."
    );
    try { closeModal(GOOGLE_USERNAME_MODAL); } catch (_) {}
    try { closeModal(GOOGLE_PHONE_MODAL); } catch (_) {}
    try {
      const allowed = await assertNotBanned(googleFlowState.user.uid, loginError);
      if (!allowed) {
        pushGoogleFlowLog("google_finalize_blocked_banned", { uid: uidMasked });
        setGoogleFlowTask("google_finalize_blocked_banned", { uid: uidMasked });
        hideGoogleRedirectLoader();
        resetGoogleFlow();
        return;
      }
      const { result, idToken } = await syncGoogleSession(loginError);
      const sessionKey = result.sessionKey || "";
      savePostLoginPayload({
        uid: googleFlowState.user.uid,
        email: googleFlowState.user.email || '',
        token: idToken,
        sessionKey,
        customToken: result.customToken || "",
        authkey: result.authkey || result.authKey || "",
        accountNo: extractAccountNo(result),
        displayName: googleFlowState.user.displayName || '',
        name: googleFlowState.user.displayName || '',
        username: googleFlowState.profile.username || '',
        photoURL: googleFlowState.user.photoURL || ''
      });
      if (googleFlowState.isNewUser) {
        storeLegalConsent("register_google");
      }
      pushGoogleFlowLog("google_finalize_success", {
        uid: uidMasked,
        isNewUser: !!googleFlowState.isNewUser,
        hasSessionKey: !!sessionKey
      });
      clearGoogleFlowTask();
      resetGoogleFlow();
      hideGoogleRedirectLoader();
      goHomeAfterAuthSuccess();
    } catch (error) {
      if (error?.code === "totp_cancelled") {
        pushGoogleFlowLog("google_finalize_totp_cancelled", { uid: uidMasked });
        setGoogleFlowTask("google_finalize_waiting_totp", { uid: uidMasked });
        hideGoogleRedirectLoader();
        return;
      }
      // A banned account comes back from the router as "auth/banned": show the same
      // full-screen custom overlay (reason + account id + support) instead of inline text.
      if (showRouterBannedOverlay(error)) {
        pushGoogleFlowLog("google_finalize_blocked_banned", { uid: uidMasked });
        setGoogleFlowTask("google_finalize_blocked_banned", { uid: uidMasked });
        hideGoogleRedirectLoader();
        resetGoogleFlow();
        return;
      }
      const normalizedCode = normalizeUiErrorCode(error?.code || error?.message || "");
      if (
        normalizedCode === "auth/missing-fields" ||
        normalizedCode === "auth/missing-credentials"
      ) {
        if (!googleFlowState.profile.username) {
          pushGoogleFlowLog("google_finalize_requires_username_after_sync", { uid: uidMasked });
          const googleUsernameInput = byId("googleUsernameInput");
          const googleUsernameError = byId("googleUsernameError");
          if (googleUsernameInput) {
            googleUsernameInput.value = normalizeGoogleUsername(
              googleFlowState.user && googleFlowState.user.displayName,
              googleFlowState.user && googleFlowState.user.email
            );
          }
          if (googleUsernameError) googleUsernameError.textContent = "";
          hideGoogleRedirectLoader();
          showModal(GOOGLE_USERNAME_MODAL);
          return;
        }
        if (!googleFlowState.profile.phone) {
          pushGoogleFlowLog("google_finalize_requires_phone_after_sync", { uid: uidMasked });
          const phoneSaveError = byId("phoneSaveError");
          if (phoneSaveError) phoneSaveError.textContent = "";
          hideGoogleRedirectLoader();
          showModal(GOOGLE_PHONE_MODAL);
          return;
        }
      }
      if (shouldUseGoogleFinalizeLocalFallback(error) && googleFlowState.user) {
        try {
          const fallbackToken = await googleFlowState.user.getIdToken();
          if (fallbackToken) {
            savePostLoginPayload({
              uid: googleFlowState.user.uid || "",
              email: googleFlowState.user.email || "",
              token: fallbackToken,
              sessionKey: "",
              customToken: "",
              authkey: "",
              accountNo: 0,
              displayName: googleFlowState.user.displayName || "",
              name: googleFlowState.user.displayName || "",
              username: googleFlowState.profile.username || "",
              photoURL: googleFlowState.user.photoURL || ""
            });
            if (googleFlowState.isNewUser) {
              storeLegalConsent("register_google");
            }
            pushGoogleFlowLog("google_finalize_local_fallback_success", {
              uid: uidMasked,
              normalizedCode
            });
            setGoogleFlowTask("google_finalize_local_fallback_success", {
              uid: uidMasked,
              normalizedCode
            });
            resetGoogleFlow();
            hideGoogleRedirectLoader();
            goHomeAfterAuthSuccess();
            return;
          }
        } catch (fallbackErr) {
          pushGoogleFlowLog("google_finalize_local_fallback_failed", {
            uid: uidMasked,
            error: getErrorMeta(fallbackErr)
          });
          logGoogleConsole("warn", "google_finalize_local_fallback_failed", {
            uid: uidMasked,
            error: getErrorMeta(fallbackErr)
          });
        }
      }
      pushGoogleFlowLog("google_finalize_error", { uid: uidMasked, error: getErrorMeta(error) });
      setGoogleFlowTask("google_finalize_error", { uid: uidMasked, error: getErrorMeta(error) });
      hideGoogleRedirectLoader();
      if (loginError) loginError.textContent = translateFirebaseError(error);
    }
  }

  async function applyGoogleAuthResult(result, targetErrorEl = null) {
    const user = result && result.user ? result.user : null;
    if (!user) {
      pushGoogleFlowLog("google_apply_result_no_user");
      return false;
    }
    const uidMasked = maskDebugUid(user.uid);
    googleFlowState.user = user;
    googleFlowState.isNewUser = !!(result && result.additionalUserInfo && result.additionalUserInfo.isNewUser);
    pushGoogleFlowLog("google_apply_result_start", { uid: uidMasked, isNewUser: !!googleFlowState.isNewUser });
    setGoogleFlowTask("google_apply_result", { uid: uidMasked, isNewUser: !!googleFlowState.isNewUser });

    if (googleFlowState.isNewUser && !hasLegalConsent()) {
      pushGoogleFlowLog("google_apply_requires_legal_consent", { uid: uidMasked });
      setGoogleFlowTask("google_waiting_legal_consent", { uid: uidMasked });
      hideGoogleRedirectLoader();
      const consentMessage = window.__I18N__ && typeof window.__I18N__.t === "function"
        ? window.__I18N__.t("legal.consent.googlePrompt", "لإنشاء حساب جديد عبر Google يجب الموافقة على سياسة الخصوصية وشروط الاستخدام. هل توافق الآن؟")
        : "لإنشاء حساب جديد عبر Google يجب الموافقة على سياسة الخصوصية وشروط الاستخدام. هل توافق الآن؟";
      let accepted = false;
      try {
        accepted = window.confirm(consentMessage) === true;
      } catch (_) {
        accepted = false;
      }
      if (!accepted) {
        showLegalConsentError(window.__I18N__ && typeof window.__I18N__.t === "function"
          ? window.__I18N__.t("legal.consent.googleRequired", "يجب الموافقة على سياسة الخصوصية وشروط الاستخدام لإكمال التسجيل عبر Google.")
          : "يجب الموافقة على سياسة الخصوصية وشروط الاستخدام لإكمال التسجيل عبر Google.");
        if (targetErrorEl) {
          targetErrorEl.textContent = window.__I18N__ && typeof window.__I18N__.t === "function"
            ? window.__I18N__.t("legal.consent.googleCanceled", "تم إلغاء المتابعة. وافق على سياسة الخصوصية وشروط الاستخدام ثم أعد المحاولة.")
            : "تم إلغاء المتابعة. وافق على سياسة الخصوصية وشروط الاستخدام ثم أعد المحاولة.";
        }
        try { if (auth && auth.currentUser) await auth.signOut(); } catch (_) {}
        resetGoogleFlow();
        return true;
      }
      storeLegalConsent("register_google");
      clearLegalConsentError();
      if (targetErrorEl) targetErrorEl.textContent = "";
      pushGoogleFlowLog("google_apply_legal_consent_confirmed", { uid: uidMasked });
    }

    let existingData = {};
    let profileLookupFailed = false;
    const fastFinalizeExisting = !!(
      !googleFlowState.isNewUser &&
      result &&
      (
        result.__fromEarlyRedirect ||
        result.__fromRedirectResult ||
        result.__fromAuthState ||
        result.__fromEarlyAuthState ||
        result.__fromEarlyCurrentUser ||
        result.__fromCurrentUserFallback
      )
    );
    try {
      if (fastFinalizeExisting) {
        profileLookupFailed = true;
        pushGoogleFlowLog("google_apply_profile_lookup_skipped_fast", { uid: uidMasked });
      } else if (db && typeof db.collection === 'function') {
        const snap = await db.collection('users').doc(user.uid).get();
        existingData = snap.exists ? (snap.data() || {}) : {};
      } else {
        profileLookupFailed = true;
      }
    } catch (err) {
      profileLookupFailed = true;
      pushGoogleFlowLog("google_apply_profile_lookup_failed", {
        uid: uidMasked,
        error: getErrorMeta(err)
      });
      logGoogleConsole("warn", "google_apply_profile_lookup_failed", {
        uid: uidMasked,
        error: getErrorMeta(err)
      });
    }

    googleFlowState.profile = {
      username: existingData.username || '',
      phone: existingData.phone || ''
    };

    if (!googleFlowState.isNewUser && profileLookupFailed) {
      pushGoogleFlowLog("google_apply_existing_user_skip_profile_gate", { uid: uidMasked });
      setGoogleFlowTask("google_finalize_pending", { uid: uidMasked, source: "profile_lookup_failed" });
      await finalizeGoogleLogin();
      return true;
    }

    if (!googleFlowState.profile.username) {
      pushGoogleFlowLog("google_apply_requires_username", { uid: uidMasked });
      setGoogleFlowTask("google_waiting_username", { uid: uidMasked });
      hideGoogleRedirectLoader();
      const googleUsernameInput = byId('googleUsernameInput');
      const googleUsernameError = byId('googleUsernameError');
      if (googleUsernameInput) {
        googleUsernameInput.value = normalizeGoogleUsername(user.displayName, user.email);
      }
      if (googleUsernameError) googleUsernameError.textContent = '';
      showModal(GOOGLE_USERNAME_MODAL);
      setTimeout(() => { try { googleUsernameInput && googleUsernameInput.focus(); } catch (_) {} }, 50);
      return true;
    }

    if (!googleFlowState.profile.phone) {
      pushGoogleFlowLog("google_apply_requires_phone", { uid: uidMasked });
      setGoogleFlowTask("google_waiting_phone", { uid: uidMasked });
      hideGoogleRedirectLoader();
      const phoneSaveError = byId('phoneSaveError');
      if (phoneSaveError) phoneSaveError.textContent = '';
      showModal(GOOGLE_PHONE_MODAL);
      const googlePhoneInput = byId('googlePhoneInput');
      setTimeout(() => { try { googlePhoneInput && googlePhoneInput.focus(); } catch (_) {} }, 60);
      return true;
    }

    pushGoogleFlowLog("google_apply_ready_finalize", { uid: uidMasked });
    setGoogleFlowTask("google_finalize_pending", { uid: uidMasked });
    showGoogleRedirectLoader(
      "جاري تجهيز جلسة الحساب...",
      "اكتمل تسجيل Google، نربط الحساب بالمتجر الآن."
    );
    await finalizeGoogleLogin();
    return true;
  }

  function createFirebaseAuthError(code, message) {
    const err = new Error(message || code || "auth/unknown");
    err.code = code || "auth/unknown";
    return err;
  }

  function canUseGoogleRedirectStorage() {
    return hasUsableStorage("localStorage") && hasUsableStorage("sessionStorage");
  }

  async function startGoogleRedirectSignIn(entryPoint, provider) {
    const canRedirect = auth && typeof auth.signInWithRedirect === "function";
    if (!canRedirect) {
      pushGoogleFlowLog("google_signin_redirect_not_supported", { entryPoint });
      setGoogleFlowTask("google_signin_redirect_not_supported", { entryPoint });
      throw createFirebaseAuthError("auth/operation-not-supported-in-this-environment");
    }
    if (!canUseGoogleRedirectStorage()) {
      pushGoogleFlowLog("google_signin_redirect_storage_unavailable", { entryPoint });
      setGoogleFlowTask("google_signin_redirect_storage_unavailable", { entryPoint });
      throw createFirebaseAuthError("auth/web-storage-unsupported");
    }
    writeGoogleRedirectPending(entryPoint);
    showGoogleRedirectLoader(
      "جاري فتح تسجيل Google...",
      "سيتم اختيار الحساب في نفس النافذة، ثم نكمل الجلسة داخل الموقع."
    );
    releaseGoogleLoaderIfRedirectChooserStillVisible(entryPoint);
    pushGoogleFlowLog("google_signin_redirect_start", {
      entryPoint,
      authDomain: getFirebaseAuthDomainSafe(),
      redirectUri: GOOGLE_AUTHORIZED_REDIRECT_URI
    });
    setGoogleFlowTask("google_signin_redirect_start", { entryPoint });
    await auth.signInWithRedirect(provider);
  }


  async function handleGoogleSignIn(entryPoint = 'login', triggerBtn = null) {
    if (googleBusy) {
      pushGoogleFlowLog("google_signin_ignored_busy", { entryPoint });
      return;
    }
    googleBusy = true;
    pushGoogleFlowLog("google_signin_start", { entryPoint });
    setGoogleFlowTask("google_signin_start", { entryPoint });
    const loginError = (entryPoint === 'register' ? byId('registerError') : byId('loginError')) || byId('loginError');
    if (loginError) loginError.textContent = '';
    if (triggerBtn) setButtonBusy(triggerBtn, true);
    try { closeModal(GOOGLE_USERNAME_MODAL); } catch (_) {}
    try { closeModal(GOOGLE_PHONE_MODAL); } catch (_) {}

    try {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        pushGoogleFlowLog("google_signin_blocked_offline", { entryPoint });
        setGoogleFlowTask("google_signin_blocked_offline", { entryPoint });
        if (loginError) {
          loginError.textContent = translateFirebaseError("network/offline");
        }
        return;
      }
      if (!canUseFirebaseAuth() && !hasFirebaseWebConfig()) {
        // Cold first load: the Firebase frontend config may not have arrived yet (it is fetched
        // asynchronously and cached). Pull it on demand before giving up, so Google sign-in works
        // on the first load instead of only after a page reload.
        let recoveredFirebaseConfig = false;
        try {
          if (typeof window.__refreshSiteRuntimeConfig === "function") {
            await window.__refreshSiteRuntimeConfig();
            recoveredFirebaseConfig = hasFirebaseWebConfig();
          }
        } catch (_) {}
        if (!recoveredFirebaseConfig) {
          const unavailableMsg = getFirebaseFrontendUnavailableMessage("google");
          pushGoogleFlowLog("google_signin_disabled_no_frontend_config", { entryPoint });
          setGoogleFlowTask("google_signin_disabled_no_frontend_config", { entryPoint });
          if (loginError) loginError.textContent = unavailableMsg;
          return;
        }
        pushGoogleFlowLog("google_signin_frontend_config_recovered", { entryPoint });
      }
      googleFlowState.entry = entryPoint;
      const firebaseReadyNow = await ensureFirebaseCompatAsync();
      const provider = ensureGoogleProvider();
      if (!auth || !provider) {
        let skipFlag = null;
        try { skipFlag = window.__SKIP_FIREBASE__ === true; } catch (_) { skipFlag = null; }
        const hasFirebase = hasFirebaseCompatRuntime();
        const hasAuthFn = typeof firebase !== "undefined" && firebase && typeof firebase.auth === "function";
        const hasProviderCtor = typeof firebase !== "undefined" && firebase && firebase.auth && typeof firebase.auth.GoogleAuthProvider === "function";
        const diagnostic = {
          entryPoint,
          firebaseReadyNow: !!firebaseReadyNow,
          skipFlag,
          hasFirebase,
          hasAuthFn,
          hasProviderCtor,
          hasAuth: !!auth,
          hasProvider: !!provider
        };
        pushGoogleFlowLog("google_signin_auth_unavailable", {
          entryPoint,
          firebaseReadyNow: !!firebaseReadyNow,
          skipFlag,
          hasFirebase,
          hasAuthFn,
          hasProviderCtor,
          hasAuth: !!auth,
          hasProvider: !!provider
        });
        setGoogleFlowTask("google_signin_auth_unavailable", {
          entryPoint,
          firebaseReadyNow: !!firebaseReadyNow,
          skipFlag
        });
        logGoogleConsole("error", "google_signin_auth_unavailable", diagnostic);
        const e = new Error('auth_unavailable');
        if (!hasFirebase) e.code = 'auth/firebase-sdk-load-failed';
        else if (!hasAuthFn || !hasProviderCtor) e.code = 'auth/firebase-auth-sdk-missing';
        else if (skipFlag === true) e.code = 'auth/firebase-blocked-env';
        else e.code = 'auth-unavailable';
        throw e;
      }
      await ensureAuthPersistenceLocal();
      await startGoogleRedirectSignIn(entryPoint, provider);
      return;
    } catch (err) {
      clearGoogleRedirectPending();
      hideGoogleRedirectLoader();
      const errorMeta = getErrorMeta(err);
      const normalizedCode = normalizeUiErrorCode(err?.code || err?.message || "");
      const isUserCancelledGoogleFlow =
        normalizedCode === "auth/popup-closed-by-user" ||
        normalizedCode === "auth/cancelled-popup-request";
      if (isUserCancelledGoogleFlow) clearGoogleFlowTask();
      pushGoogleFlowLog("google_signin_error", { entryPoint, error: errorMeta, normalizedCode });
      logGoogleConsole("error", "google_signin_error", { entryPoint, error: errorMeta, normalizedCode });
      if (normalizedCode === "auth/unauthorized-domain") {
        const host = getCurrentHostnameSafe();
        const authDomain = getFirebaseAuthDomainSafe();
        pushGoogleFlowLog("google_signin_unauthorized_domain", { entryPoint, host, authDomain });
        setGoogleFlowTask("google_signin_unauthorized_domain", { entryPoint, host, authDomain });
      } else if (!isUserCancelledGoogleFlow) {
        setGoogleFlowTask("google_signin_error", { entryPoint, error: errorMeta, normalizedCode });
      }
      if (loginError) {
        loginError.textContent = isUserCancelledGoogleFlow ? "" : translateFirebaseError(err);
      }
    } finally {
      googleBusy = false;
      pushGoogleFlowLog("google_signin_end", { entryPoint });
      if (triggerBtn) setButtonBusy(triggerBtn, false);
    }
  }

  async function processGoogleRedirectResult(){
    if (googleRedirectResultHandled) return false;
    googleRedirectResultHandled = true;
    try {
      const pendingRedirect = readFreshGoogleRedirectPending();
      const hasPendingRedirect = !!pendingRedirect;
      if (!hasPendingRedirect) {
        pushGoogleFlowLog("google_redirect_result_skipped_no_pending");
        hideGoogleRedirectLoader();
        return false;
      }
      showGoogleRedirectLoader(
        "جاري إكمال تسجيل الدخول عبر Google...",
        "تم اختيار الحساب، نتحقق من الجلسة الآن."
      );
      const ready = await ensureFirebaseCompatAsync();
      if (!ready || !auth || typeof auth.getRedirectResult !== "function") {
        hideGoogleRedirectLoader();
        return false;
      }
      pushGoogleFlowLog("google_redirect_result_check");
      const entryPoint = (() => {
        try { return sessionStorage.getItem("site:google:entry") || pendingRedirect.entryPoint || "login"; } catch (_) { return pendingRedirect.entryPoint || "login"; }
      })();
      googleFlowState.entry = entryPoint === "register" ? "register" : "login";
      const targetErrorEl = (googleFlowState.entry === "register" ? byId("registerError") : byId("loginError")) || byId("loginError");
      const result = await auth.getRedirectResult();
      let finalResult = result && result.user ? result : null;
      if (finalResult) finalResult.__fromRedirectResult = true;
      if (!finalResult) {
        let fallbackUser = null;
        try { fallbackUser = auth.currentUser || null; } catch (_) { fallbackUser = null; }
        if (!fallbackUser && typeof auth.onAuthStateChanged === "function") {
          fallbackUser = await new Promise(function(resolve){
            var settled = false;
            var unsubscribe = null;
            function finish(user){
              if (settled) return;
              settled = true;
              try { if (unsubscribe) unsubscribe(); } catch (_) {}
              resolve(user || null);
            }
            try {
              unsubscribe = auth.onAuthStateChanged(function(user){ finish(user); }, function(){ finish(null); });
            } catch (_) {
              finish(null);
            }
            setTimeout(function(){ finish(null); }, 1800);
          });
        }
        if (fallbackUser) {
          finalResult = { user: fallbackUser, additionalUserInfo: { isNewUser: false }, __fromCurrentUserFallback: true };
          pushGoogleFlowLog("google_redirect_current_user_fallback", { hasUser: true });
        }
      }
      if (!finalResult || !finalResult.user) {
        pushGoogleFlowLog("google_redirect_result_empty_cancelled");
        hideGoogleRedirectLoader();
        if (targetErrorEl) targetErrorEl.textContent = "";
        clearGoogleRedirectPending();
        clearGoogleFlowTask();
        return false;
      }
      clearGoogleRedirectPending();
      try { document.documentElement.classList.add("google-redirect-pending"); } catch (_) {}
      pushGoogleFlowLog("google_redirect_result_user", {
        entryPoint: googleFlowState.entry,
        hasUser: true,
        isNewUser: !!(finalResult.additionalUserInfo && finalResult.additionalUserInfo.isNewUser)
      });
      if (targetErrorEl) targetErrorEl.textContent = "";
      setGoogleRedirectLoaderText(
        "تم استلام حساب Google...",
        "نجهّز حسابك داخل المتجر الآن."
      );
      await applyGoogleAuthResult(finalResult, targetErrorEl);
      return true;
    } catch (err) {
      googleRedirectResultHandled = false;
      clearGoogleRedirectPending();
      hideGoogleRedirectLoader();
      const targetErrorEl = byId("loginError") || byId("registerError");
      const normalizedCode = normalizeUiErrorCode(err?.code || err?.message || "");
      const isUserCancelledGoogleFlow =
        normalizedCode === "auth/popup-closed-by-user" ||
        normalizedCode === "auth/cancelled-popup-request";
      if (isUserCancelledGoogleFlow) clearGoogleFlowTask();
      if (targetErrorEl) targetErrorEl.textContent = isUserCancelledGoogleFlow ? "" : translateFirebaseError(err);
      pushGoogleFlowLog("google_redirect_result_error", { error: getErrorMeta(err), normalizedCode });
      logGoogleConsole("warn", "google_redirect_result_error", { error: getErrorMeta(err), normalizedCode });
      return false;
    }
  }

  async function submitGoogleUsername() {
    const googleUsernameInput = byId('googleUsernameInput');
    const googleUsernameError = byId('googleUsernameError');
    if (!googleFlowState.user || !googleUsernameInput) return;
    const uidMasked = maskDebugUid(googleFlowState.user && googleFlowState.user.uid);
    const value = (googleUsernameInput.value || '').trim();
    if (value.length < 3) {
      pushGoogleFlowLog("google_username_invalid", { uid: uidMasked, length: value.length });
      if (googleUsernameError) googleUsernameError.textContent = "يرجى إدخال اسم مستخدم لا يقل عن 3 أحرف.";
      return;
    }
    pushGoogleFlowLog("google_username_submitted", { uid: uidMasked, length: value.length });
    setGoogleFlowTask("google_username_submitted", { uid: uidMasked });
    if (googleUsernameError) googleUsernameError.textContent = '';
    googleFlowState.profile.username = value;
    closeModal(GOOGLE_USERNAME_MODAL);
    if (!googleFlowState.profile.phone) {
      pushGoogleFlowLog("google_username_waiting_phone", { uid: uidMasked });
      setGoogleFlowTask("google_waiting_phone", { uid: uidMasked });
      const phoneSaveError = byId('phoneSaveError');
      if (phoneSaveError) phoneSaveError.textContent = '';
      showModal(GOOGLE_PHONE_MODAL);
    } else {
      pushGoogleFlowLog("google_username_go_finalize", { uid: uidMasked });
      setGoogleFlowTask("google_finalize_pending", { uid: uidMasked });
      await finalizeGoogleLogin();
    }
  }

  async function submitGooglePhone() {
    const googlePhoneInput = byId('googlePhoneInput');
    const phoneSaveError = byId('phoneSaveError');
    if (!googleFlowState.user || !googlePhoneInput) return;
    const savePhoneBtn = byId('savePhoneBtn');
    const uidMasked = maskDebugUid(googleFlowState.user && googleFlowState.user.uid);
    let phoneValue = '';
    try {
      phoneValue = (window.googlePhoneIti && typeof window.googlePhoneIti.getNumber === 'function')
        ? window.googlePhoneIti.getNumber()
        : googlePhoneInput.value;
    } catch (_) {
      phoneValue = googlePhoneInput.value;
    }
    phoneValue = (phoneValue || '').trim();
    if (!phoneValue || phoneValue.replace(/\D/g, '').length < 6) {
      pushGoogleFlowLog("google_phone_invalid", { uid: uidMasked, digits: phoneValue.replace(/\D/g, '').length });
      if (phoneSaveError) phoneSaveError.textContent = "يرجى إدخال رقم هاتف صالح.";
      return;
    }
    pushGoogleFlowLog("google_phone_submitted", { uid: uidMasked, digits: phoneValue.replace(/\D/g, '').length });
    setGoogleFlowTask("google_phone_submitted", { uid: uidMasked });
    if (phoneSaveError) phoneSaveError.textContent = '';
    googleFlowState.profile.phone = phoneValue;
    pushGoogleFlowLog("google_phone_go_finalize", { uid: uidMasked });
    setGoogleFlowTask("google_finalize_pending", { uid: uidMasked });
    try {
      if (savePhoneBtn) setButtonBusy(savePhoneBtn, true);
      await finalizeGoogleLogin();
    } catch (err) {
      pushGoogleFlowLog("google_phone_finalize_error", { uid: uidMasked, error: getErrorMeta(err) });
      logGoogleConsole("error", "google_phone_finalize_error", { uid: uidMasked, error: getErrorMeta(err) });
      if (phoneSaveError) phoneSaveError.textContent = translateFirebaseError(err);
    } finally {
      if (savePhoneBtn) setButtonBusy(savePhoneBtn, false);
    }
  }

  function normalizeLoginPhoneCountryCode(value, fallback = "sy") {
    const raw = String(value == null ? "" : value).trim().toLowerCase();
    const clean = raw.replace(/[^a-z]/g, "").slice(0, 2);
    if (/^[a-z]{2}$/.test(clean)) return clean;
    const fallbackClean = String(fallback == null ? "" : fallback).trim().toLowerCase().replace(/[^a-z]/g, "").slice(0, 2);
    return /^[a-z]{2}$/.test(fallbackClean) ? fallbackClean : "sy";
  }

  function readLoginJsonStorage(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch (_) {
      return null;
    }
  }

  function readThemeDefaultPhoneCountry(theme) {
    if (!theme || typeof theme !== "object") return "";
    return (
      theme.defaultPhoneCountry ??
      theme.default_phone_country ??
      theme.phoneDefaultCountry ??
      theme.phone_default_country ??
      theme.initialPhoneCountry ??
      theme.initial_phone_country ??
      theme.defaultCountry ??
      theme.default_country ??
      ""
    );
  }

  function getLoginDefaultPhoneCountry() {
    const sources = [];
    try { if (window.__ACTIVE_SITE_THEME_STATE__) sources.push(window.__ACTIVE_SITE_THEME_STATE__); } catch (_) {}
    try { if (window.__PENDING_SITE_THEME__) sources.push(window.__PENDING_SITE_THEME__); } catch (_) {}
    try {
      if (typeof window.__getResolvedSiteStateData === "function") {
        const state = window.__getResolvedSiteStateData();
        if (state && typeof state === "object") {
          const siteState = state.siteState && typeof state.siteState === "object" && !state.levels
            ? state.siteState
            : state;
          if (siteState && siteState.theme) sources.push(siteState.theme);
        }
      }
    } catch (_) {}
    const cachedTheme = readLoginJsonStorage("site:theme:v1");
    if (cachedTheme) sources.push(cachedTheme);
    for (let i = 0; i < sources.length; i++) {
      const value = readThemeDefaultPhoneCountry(sources[i]);
      if (value != null && String(value).trim()) return normalizeLoginPhoneCountryCode(value, "sy");
    }
    return "sy";
  }

  function buildLoginPreferredPhoneCountries(defaultCountry) {
    const base = [
      normalizeLoginPhoneCountryCode(defaultCountry, "sy"),
      "sy",
      "jo",
      "sa",
      "eg",
      "iq",
      "ae",
      "tr",
      "us"
    ];
    return base.filter((country, index, arr) => country && arr.indexOf(country) === index);
  }

  function readLoginSelectedPhoneCountry(instance) {
    try {
      const data = instance && typeof instance.getSelectedCountryData === "function"
        ? instance.getSelectedCountryData()
        : null;
      const clean = String(data && data.iso2 || "").trim().toLowerCase().replace(/[^a-z]/g, "").slice(0, 2);
      return /^[a-z]{2}$/.test(clean) ? clean : "";
    } catch (_) {
      return "";
    }
  }

  function syncLoginPhoneInputDefaultCountry(input, instance, defaultCountry) {
    if (!input || !instance || typeof instance.setCountry !== "function") return;
    const nextCountry = normalizeLoginPhoneCountryCode(defaultCountry, "sy");
    const previousDefault = normalizeLoginPhoneCountryCode(input.dataset.defaultPhoneCountry || "", nextCountry);
    const selectedCountry = readLoginSelectedPhoneCountry(instance);
    const hasDigits = String(input.value || "").replace(/\D/g, "").length > 0;
    input.dataset.defaultPhoneCountry = nextCountry;
    if (!hasDigits || !selectedCountry || selectedCountry === previousDefault) {
      try { instance.setCountry(nextCountry); } catch (_) {}
    }
  }

  function initPhoneInputs(){
    if (typeof window.intlTelInput !== 'function') {
      setTimeout(initPhoneInputs, 250);
      return;
    }
    const defaultPhoneCountry = getLoginDefaultPhoneCountry();
    const preferredCountries = buildLoginPreferredPhoneCountries(defaultPhoneCountry);
    const phoneInput = byId('phoneInput');
    if (phoneInput && !phoneInput.dataset.itiBound) {
      phoneInput.dataset.defaultPhoneCountry = defaultPhoneCountry;
      window.iti = window.intlTelInput(phoneInput, {
        initialCountry: defaultPhoneCountry,
        separateDialCode: true,
        preferredCountries: preferredCountries,
        utilsScript: "/vendor/intl-tel-input/18.1.1/js/utils.js"
      });
      phoneInput.dataset.itiBound = "1";
    } else if (phoneInput && window.iti) {
      syncLoginPhoneInputDefaultCountry(phoneInput, window.iti, defaultPhoneCountry);
    }
    const googlePhoneInput = byId('googlePhoneInput');
    if (googlePhoneInput && !googlePhoneInput.dataset.itiBound) {
      googlePhoneInput.dataset.defaultPhoneCountry = defaultPhoneCountry;
      window.googlePhoneIti = window.intlTelInput(googlePhoneInput, {
        initialCountry: defaultPhoneCountry,
        separateDialCode: true,
        preferredCountries: preferredCountries,
        utilsScript: "/vendor/intl-tel-input/18.1.1/js/utils.js"
      });
      googlePhoneInput.dataset.itiBound = "1";
    } else if (googlePhoneInput && window.googlePhoneIti) {
      syncLoginPhoneInputDefaultCountry(googlePhoneInput, window.googlePhoneIti, defaultPhoneCountry);
    }
  }

  function scheduleLoginPhoneCountrySync(){
    setTimeout(function(){
      try { initPhoneInputs(); } catch (_) {}
    }, 0);
  }

  window.addEventListener("storage", function(ev){
    if (ev && ev.key && ev.key !== "site:theme:v1") return;
    scheduleLoginPhoneCountrySync();
  });
  window.addEventListener("site:theme", scheduleLoginPhoneCountrySync);
  window.addEventListener("site-state-updated", scheduleLoginPhoneCountrySync);
  window.addEventListener("theme:change", scheduleLoginPhoneCountrySync);

  function bindLoginDom(){
    const loginForm = byId("loginForm");
    if (!loginForm) return false;
    if (loginBound && loginForm.__loginDomBound === true) return true;
    loginBound = true;
    loginForm.__loginDomBound = true;

    const registerForm = byId("registerForm");
    if (loginForm) {
      loginForm.addEventListener("submit", (ev) => {
        ev.preventDefault();
        performManualLogin(ev);
      });
    }
    if (registerForm) {
      registerForm.addEventListener("submit", (ev) => {
        ev.preventDefault();
        if (typeof window.register === "function") window.register();
      });
    }

    const submitLogin = byId("submitLogin");
    if (submitLogin) {
      try { submitLogin.type = "button"; } catch (_) {}
      submitLogin.addEventListener('click', performManualLogin);
    }

    const showResetBtn = byId("showReset");
    if (showResetBtn) {
      try { showResetBtn.type = "button"; } catch (_) {}
      showResetBtn.onclick = (event) => {
        try { event && event.preventDefault(); } catch (_) {}
        switchForm("reset");
      };
    }

    const toggleRegisterBtn = byId("toggleRegister");
    if (toggleRegisterBtn) {
      try { toggleRegisterBtn.type = "button"; } catch (_) {}
      toggleRegisterBtn.onclick = (event) => {
        try { event && event.preventDefault(); } catch (_) {}
        switchForm("register");
      };
    }

    const registerPasswordInput = byId("registerPassword");
    if (registerPasswordInput) {
      registerPasswordInput.addEventListener('input', validatePassword);
      validatePassword();
    }

    const registerLegalConsent = getLegalConsentCheckbox();
    if (registerLegalConsent) {
      if (hasStoredLegalConsent()) registerLegalConsent.checked = true;
      registerLegalConsent.addEventListener("change", () => {
        syncRegisterConsentState();
        if (registerLegalConsent.checked) clearLegalConsentError();
      });

      try {
        const consentBody = byId("loginInline")?.querySelector(".legal-consent-body");
        if (consentBody && !consentBody.__z3ConsentBound) {
          consentBody.__z3ConsentBound = true;
          consentBody.addEventListener("click", (event) => {
            const target = event && event.target ? event.target : null;
            const targetEl = target && target.nodeType === 1
              ? target
              : (target && target.parentElement ? target.parentElement : null);
            const clickedLink = !!(targetEl && targetEl.closest && targetEl.closest("a[href]"));
            if (clickedLink) return;
            registerLegalConsent.checked = !registerLegalConsent.checked;
            registerLegalConsent.dispatchEvent(new Event("change", { bubbles: true }));
          });
        }
      } catch (_) {}
    }
    normalizeLegalConsentUi();
    bindLegalRouteLinks();
    clearLegalConsentError();
    syncRegisterConsentState();

    const googleButtons = [byId('googleLogin'), byId('googleLoginRegister')].filter(Boolean);
    googleButtons.forEach((btn) => {
      try { btn.type = 'button'; } catch (_) {}
      try {
        btn.style.touchAction = 'manipulation';
        btn.style.webkitTapHighlightColor = 'transparent';
      } catch (_) {}
      if (!btn.dataset.googleTapBound) {
        btn.dataset.googleTapBound = '1';
        const runGoogleTap = (event) => {
          try {
            if (event) {
              event.preventDefault();
              event.stopPropagation();
            }
          } catch (_) {}
          const now = Date.now();
          const last = Number(btn.__lastGoogleTapAt || 0);
          if (last && now - last < 900) return false;
          btn.__lastGoogleTapAt = now;
          const entry = btn.id === 'googleLoginRegister' ? 'register' : 'login';
          try {
            if (typeof window.__triggerGoogleLogin === 'function') {
              window.__triggerGoogleLogin(entry, btn);
            } else {
              handleGoogleSignIn(entry, btn);
            }
          } catch (_) {}
          return false;
        };
        btn.addEventListener('click', runGoogleTap, true);
        btn.addEventListener('touchend', runGoogleTap, { capture: true, passive: false });
      }
    });

    const savePhoneBtn = byId('savePhoneBtn');
    if (savePhoneBtn) {
      savePhoneBtn.addEventListener('click', (event) => {
        event.preventDefault();
        submitGooglePhone();
      });
    }

    const totpLoginInput = byId("totpLoginInput");
    const totpLoginConfirm = byId("totpLoginConfirm");
    const totpLoginClose = byId("totpLoginClose");
    const totpLoginEmailBtn = byId("totpLoginEmailBtn");
    const totpLoginLostBtn = byId("totpLoginLostBtn");
    const totpLoginError = byId("totpLoginError");
    if (totpLoginInput) {
      totpLoginInput.addEventListener("input", () => {
        const clean = normalizeTotpCode(totpLoginInput.value);
        if (totpLoginInput.value !== clean) totpLoginInput.value = clean;
        if (totpLoginError) {
          totpLoginError.style.color = "var(--danger, #ef4444)";
          totpLoginError.textContent = "";
        }
      });
      totpLoginInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          confirmTotpModal();
        }
      });
    }
    if (totpLoginConfirm) {
      totpLoginConfirm.addEventListener("click", (event) => {
        event.preventDefault();
        confirmTotpModal();
      });
    }
    if (totpLoginClose) {
      totpLoginClose.addEventListener("click", (event) => {
        event.preventDefault();
        resolveTotpRequest("");
        closeModal("totpLoginModal");
      });
    }
    if (totpLoginEmailBtn) {
      totpLoginEmailBtn.addEventListener("click", (event) => {
        event.preventDefault();
        requestTotpEmailCodeFromModal();
      });
    }
    if (totpLoginLostBtn) {
      totpLoginLostBtn.addEventListener("click", (event) => {
        event.preventDefault();
        requestTotpLostRecoveryFromModal();
      });
    }

    if (!modalBound) {
      modalBound = true;
      document.addEventListener("click", (event) => {
        const target = event.target;
        if (!target) return;
        if (target.classList && target.classList.contains("modal") && !target.classList.contains("hidden")) {
          if (target.closest && !target.closest('#loginInline')) return;
          closeModal(target.id);
        }
      });
      document.addEventListener("keydown", (event) => {
        if (event.key !== "Escape") return;
        const openModal = document.querySelector('#loginInline .modal:not(.hidden)');
        if (openModal) closeModal(openModal.id);
      });
    }

    return true;
  }

  async function initLoginRoute(){
    pushGoogleFlowLog("login_route_init_start");
    blurActiveEditableElement();
    releaseLoginRouteEntryLoader();
    try {
      const host = byId("loginInlineHost");
      if (host) {
        host.style.display = "";
        host.setAttribute("aria-hidden", "false");
      }
    } catch (_) {}
    try {
      const root = byId("loginInline");
      if (root) root.classList.remove("hidden");
    } catch (_) {}
    bindLoginDom();
    try { switchForm('login'); } catch (_) {}
    if (canUseFirebaseAuth()) {
      processGoogleRedirectResult().catch(() => false);
      ensureFirebaseCompatAsync().catch(() => false);
      ensureAuthPersistenceLocal().catch(() => false);
    }
    initPhoneInputs();
    return true;
  }

  window.__initLoginRoute = initLoginRoute;
  window.__loginRouteOnShow = function(){
    pushGoogleFlowLog("login_route_on_show");
    blurActiveEditableElement();
    releaseLoginRouteEntryLoader();
    try {
      const host = byId("loginInlineHost");
      if (host) {
        host.style.display = "";
        host.setAttribute("aria-hidden", "false");
      }
    } catch (_) {}
    try {
      const root = byId("loginInline");
      if (root) root.classList.remove("hidden");
    } catch (_) {}
    try { switchForm('login'); } catch (_) {}
    if (canUseFirebaseAuth()) {
      processGoogleRedirectResult().catch(() => false);
      ensureFirebaseCompatAsync().catch(() => false);
      ensureAuthPersistenceLocal().catch(() => false);
    }
    try { initPhoneInputs(); } catch (_) {}
  };
  window.__cleanupLoginRouteTransientState = cleanupLoginRouteTransientState;
  window.__manualLogin = performManualLogin;

  // Handle hash-first rendering race: if login route is already visible when this file loads,
  // initialize immediately so redirect-result flow is not missed.
  (function bootLoginRouteIfVisible(){
    const isLoginHash = () => String(location.hash || "").toLowerCase().startsWith("#/login");
    const run = () => {
      if (!isLoginHash()) return;
      if (!byId("loginForm")) return;
      pushGoogleFlowLog("login_route_boot_visible_hash");
      try { initLoginRoute(); } catch (_) {}
    };
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", run, { once: true });
    } else {
      setTimeout(run, 0);
    }
    window.addEventListener("hashchange", () => {
      if (!isLoginHash()) {
        cleanupLoginRouteTransientState();
        return;
      }
      setTimeout(run, 0);
    });
    window.addEventListener("pageshow", (event) => {
      if (!event || event.persisted !== true) return;
      if (!isLoginHash()) {
        cleanupLoginRouteTransientState();
        return;
      }
      setTimeout(run, 0);
    });
  })();

  window.submitGoogleUsername = submitGoogleUsername;
  window.submitGooglePhone = submitGooglePhone;
  window.sendResetLink = sendResetLink;
  window.sendVerificationNow = sendVerificationNow;
  window.validatePassword = validatePassword;
  window.register = register;
  window.showModal = showModal;
  window.closeModal = closeModal;
  window.switchForm = switchForm;
  window.confirmUnverifiedLogin = confirmUnverifiedLogin;
  window.__triggerGoogleLogin = function(entryPoint, btn){
    try {
      const safeEntry = entryPoint === 'register' ? 'register' : 'login';
      if (btn) {
        try { btn.disabled = true; } catch (_) {}
        setTimeout(() => { try { btn.disabled = false; } catch (_) {} }, 4000);
      }
      handleGoogleSignIn(safeEntry, btn || null);
    } catch (_) {}
    return false;
  };
})();
