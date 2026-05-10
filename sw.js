const SITE_PWA_CACHE = "njadstore1-pwa-v20260510-21";
const SITE_PWA_BUILD = "20260510-21";
const SITE_PWA_FETCH_TIMEOUT_MS = 8000;
const SITE_FIREBASE_HELPER_ORIGIN = "https://njadstore1.firebaseapp.com";
const SITE_FIREBASE_INIT_JSON = JSON.stringify({
  apiKey: "AIzaSyBaJE8eTuSZUfjLw3lj-788iTvR7YJvWj8",
  authDomain: "njad.store",
  projectId: "njadstore1",
  storageBucket: "njadstore1.firebasestorage.app",
  messagingSenderId: "1072422740336",
  appId: "1:1072422740336:web:28abfc7058d310379dafb5",
  measurementId: "G-T2J947YL3L"
});
const SITE_PWA_SHELL = [
  "/",
  "/index.html",
  "/header.css?v=20260509-02",
  "/site-core.js?v=20260510-20",
  "/header.js?v=20260510-21",
  "/qr-code-styling.js?v=20260510-01",
  "/site-qr.js?v=20260510-01",
  "/reviews-inline.js?v=20260510-01",
  "/wallet-inline.js?v=20260510-01",
  "/calendar-inline.js?v=20260510-01",
  "/login-inline.js?v=20260510-20",
  "/manifest.webmanifest",
  "/vendor/intl-tel-input/18.1.1/css/intlTelInput.min.css",
  "/vendor/intl-tel-input/18.1.1/img/flags.png",
  "/vendor/intl-tel-input/18.1.1/img/flags@2x.png",
  "/vendor/intl-tel-input/18.1.1/js/intlTelInput.min.js",
  "/vendor/intl-tel-input/18.1.1/js/utils.js",
  "/vendor/lottie-player/2.0.12/lottie-player.js",
  "/vendor/firebase/9.23.0/firebase-app-compat.js",
  "/vendor/firebase/9.23.0/firebase-auth-compat.js",
  "/vendor/firebase/9.23.0/firebase-firestore-compat.js"
];

function fetchWithTimeout(request, options = {}, timeoutMs = SITE_PWA_FETCH_TIMEOUT_MS) {
  const finalOptions = Object.assign({}, options || {});
  let controller = null;
  let timer = 0;
  try {
    if (typeof AbortController !== "undefined") {
      controller = new AbortController();
      finalOptions.signal = controller.signal;
      timer = setTimeout(() => {
        try { controller.abort(); } catch (_) {}
      }, Math.max(2500, Number(timeoutMs) || SITE_PWA_FETCH_TIMEOUT_MS));
    }
  } catch (_) {
    controller = null;
    timer = 0;
  }
  return fetch(request, finalOptions).finally(() => {
    if (timer) {
      try { clearTimeout(timer); } catch (_) {}
    }
  });
}

function firebaseAuthHelperResponse(kind) {
  let body = "";
  if (kind === "handler") {
    body = [
      "<!DOCTYPE html><html><head>",
      "<meta name=viewport content=\"width=device-width, initial-scale=1\">",
      "<meta http-equiv=\"Content-Type\" content=\"text/html; charset=utf-8\">",
      "<script type=\"text/javascript\" src=\"/__/auth/experiments.js\"></script>",
      "<script type=\"text/javascript\" src=\"/__/auth/handler.js\"></script>",
      "<script type=\"text/javascript\" nonce=\"firebase-auth-helper\">",
      "var POST_BODY = '{' + '{POST_BODY}' + '}';",
      "fireauth.oauthhelper.widget.initialize();",
      "</script>",
      "</head><body></body></html>"
    ].join("");
  } else if (kind === "iframe") {
    body = [
      "<!DOCTYPE html><html><head>",
      "<meta name=viewport content=\"width=device-width, initial-scale=1\">",
      "<meta http-equiv=\"Content-Type\" content=\"text/html; charset=utf-8\">",
      "<script type=\"text/javascript\" src=\"/__/auth/iframe.js\"></script>",
      "<script type=\"text/javascript\" nonce=\"firebase-auth-helper\">",
      "fireauth.iframe.AuthRelay.initialize();",
      "</script>",
      "</head><body></body></html>"
    ].join("");
  } else if (kind === "links") {
    body = [
      "<!DOCTYPE html><html><head>",
      "<meta name=viewport content=\"width=device-width, initial-scale=1\">",
      "<meta http-equiv=\"Content-Type\" content=\"text/html; charset=utf-8\">",
      "<script type=\"text/javascript\" src=\"/__/auth/links.js\"></script>",
      "</head><body></body></html>"
    ].join("");
  }
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

function firebaseAuthHelperKind(pathname) {
  const path = String(pathname || "").replace(/\/+$/, "");
  if (path === "/__/auth/handler" || path === "/__/auth/handler.html" || path === "/__/auth/handler/index.html") return "handler";
  if (path === "/__/auth/iframe" || path === "/__/auth/iframe.html" || path === "/__/auth/iframe/index.html") return "iframe";
  if (path === "/__/auth/links" || path === "/__/auth/links.html" || path === "/__/auth/links/index.html") return "links";
  return "";
}

function firebaseAuthRemoteScript(pathname) {
  const path = String(pathname || "");
  if (path === "/__/auth/experiments.js") return SITE_FIREBASE_HELPER_ORIGIN + "/__/auth/experiments.js";
  if (path === "/__/auth/handler.js") return SITE_FIREBASE_HELPER_ORIGIN + "/__/auth/handler.js";
  if (path === "/__/auth/iframe.js") return SITE_FIREBASE_HELPER_ORIGIN + "/__/auth/iframe.js";
  if (path === "/__/auth/links.js") return SITE_FIREBASE_HELPER_ORIGIN + "/__/auth/links.js";
  return "";
}

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(Promise.resolve());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    let deletedOldCache = false;
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => {
        if (key === SITE_PWA_CACHE || !/^njadstore1-pwa-/i.test(String(key || ""))) return Promise.resolve(false);
        return caches.delete(key).then((deleted) => {
          deletedOldCache = deletedOldCache || !!deleted;
          return deleted;
        });
      }));
    } catch (_) {}
    try { await self.clients.claim(); } catch (_) {}
    if (deletedOldCache) {
      try {
        const clientsList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        await Promise.all(clientsList.map((client) => {
          try {
            const url = new URL(client.url);
            if (url.origin !== self.location.origin) return Promise.resolve(false);
            client.postMessage({ type: "SITE_PWA_UPDATED", build: SITE_PWA_BUILD });
            return Promise.resolve(true);
          } catch (_) {
            return Promise.resolve(false);
          }
        }));
      } catch (_) {}
    }
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (!request || request.method !== "GET") return;
  let url = null;
  try {
    url = new URL(request.url);
  } catch (_) {
    return;
  }
  if (!url || url.origin !== self.location.origin) return;
  const pathname = String(url.pathname || "");
  const acceptHeader = String(request.headers.get("accept") || "");
  const lastSegment = pathname.split("/").pop() || "";
  const looksLikeFile = /\.[a-z0-9]{1,12}$/i.test(lastSegment);
  const isNavigationRequest =
    request.mode === "navigate" ||
    (!!acceptHeader && acceptHeader.includes("text/html") && !looksLikeFile);
  const authHelperKind = firebaseAuthHelperKind(pathname);
  if (authHelperKind) {
    event.respondWith(Promise.resolve(firebaseAuthHelperResponse(authHelperKind)));
    return;
  }
  if (pathname === "/__/firebase/init.json") {
    event.respondWith(Promise.resolve(new Response(SITE_FIREBASE_INIT_JSON, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
      }
    })));
    return;
  }
  const remoteAuthScript = firebaseAuthRemoteScript(pathname);
  if (remoteAuthScript) {
    event.respondWith((async () => {
      try {
        const response = await fetchWithTimeout(request, { cache: "reload" });
        if (response && response.ok) return response;
      } catch (_) {}
      return fetchWithTimeout(remoteAuthScript, { cache: "reload", mode: "no-cors" });
    })());
    return;
  }
  const shouldHandle =
    isNavigationRequest ||
    pathname === "/" ||
    pathname === "/index.html" ||
    pathname === "/header.css" ||
    pathname === "/site-core.js" ||
    pathname === "/header.js" ||
    pathname === "/qr-code-styling.js" ||
    pathname === "/site-qr.js" ||
    pathname === "/reviews-inline.js" ||
    pathname === "/wallet-inline.js" ||
    pathname === "/calendar-inline.js" ||
    pathname === "/login-inline.js" ||
    pathname === "/manifest.webmanifest";
  if (!shouldHandle) return;
  event.respondWith((async () => {
    try {
      const cache = await caches.open(SITE_PWA_CACHE);
      if (isNavigationRequest || pathname === "/" || pathname === "/index.html") {
        try {
          const fresh = await fetchWithTimeout(request, { cache: "reload" });
          if (fresh && fresh.ok) {
            try {
              await cache.put(request, fresh.clone());
              await cache.put("/index.html", fresh.clone());
            } catch (_) {}
            return fresh;
          }
        } catch (_) {}
        const cached = await cache.match(request, { ignoreSearch: false })
          || await cache.match("/index.html", { ignoreSearch: false })
          || await cache.match("/", { ignoreSearch: false });
        if (cached) {
          event.waitUntil((async () => {
            try {
              const fresh = await fetchWithTimeout(request, { cache: "reload" });
              if (fresh && fresh.ok) {
                await cache.put(request, fresh.clone());
                try { await cache.put("/index.html", fresh.clone()); } catch (_) {}
              }
            } catch (_) {}
          })());
          return cached;
        }
        return fetchWithTimeout("/index.html", { cache: "reload" });
      }
      const cached = await cache.match(request, { ignoreSearch: false });
      if (cached) {
        if (
          pathname === "/header.css" ||
          pathname === "/site-core.js" ||
          pathname === "/header.js" ||
          pathname === "/qr-code-styling.js" ||
          pathname === "/site-qr.js" ||
          pathname === "/reviews-inline.js" ||
          pathname === "/wallet-inline.js" ||
          pathname === "/calendar-inline.js" ||
          pathname === "/login-inline.js" ||
          pathname === "/manifest.webmanifest"
        ) {
          event.waitUntil((async () => {
            try {
              const response = await fetchWithTimeout(request, { cache: "reload" });
              if (response && response.ok) await cache.put(request, response.clone());
            } catch (_) {}
          })());
        }
        return cached;
      }
      const response = await fetchWithTimeout(request, { cache: "reload" });
      if (response && response.ok) {
        try { await cache.put(request, response.clone()); } catch (_) {}
      }
      return response;
    } catch (_) {
      try {
        const cache = await caches.open(SITE_PWA_CACHE);
        const fallback = await cache.match(request, { ignoreSearch: false });
        if (fallback) return fallback;
      } catch (__){}
      return new Response("", { status: 504, statusText: "Gateway Timeout" });
    }
  })());
});
