const SITE_PWA_BUILD = "20260606-catalog-empty-cache-01";
try { importScripts("/site_settings.js?v=20260518-03"); } catch (_) {}
const SITE_SETTINGS = (self.__getSiteSettings ? self.__getSiteSettings() : self.__SITE_SETTINGS__) || {};
const SITE_FIREBASE_HELPER_ORIGIN = String(
  (SITE_SETTINGS.auth && SITE_SETTINGS.auth.firebaseHelperOrigin) ||
  self.__SITE_FIREBASE_HELPER_ORIGIN__ ||
  ""
).replace(/\/+$/, "");
const SITE_FIREBASE_INIT_JSON = JSON.stringify((SITE_SETTINGS.firebase && typeof SITE_SETTINGS.firebase === "object") ? SITE_SETTINGS.firebase : {});
const SITE_LEGACY_SW_CACHE_PREFIXES = Array.isArray(SITE_SETTINGS.pwa && SITE_SETTINGS.pwa.legacyCachePrefixes)
  ? SITE_SETTINGS.pwa.legacyCachePrefixes
  : [];

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
  if (!SITE_FIREBASE_HELPER_ORIGIN) return "";
  const path = String(pathname || "");
  if (path === "/__/auth/experiments.js") return SITE_FIREBASE_HELPER_ORIGIN + "/__/auth/experiments.js";
  if (path === "/__/auth/handler.js") return SITE_FIREBASE_HELPER_ORIGIN + "/__/auth/handler.js";
  if (path === "/__/auth/iframe.js") return SITE_FIREBASE_HELPER_ORIGIN + "/__/auth/iframe.js";
  if (path === "/__/auth/links.js") return SITE_FIREBASE_HELPER_ORIGIN + "/__/auth/links.js";
  return "";
}

async function clearSiteCaches() {
  if (typeof caches === "undefined") return;
  try {
    const keys = await caches.keys();
    await Promise.all((keys || []).map((key) => {
      const name = String(key || "");
      if (SITE_LEGACY_SW_CACHE_PREFIXES.some((prefix) => prefix && name.indexOf(String(prefix)) === 0)) {
        return caches.delete(key).catch(() => false);
      }
      return Promise.resolve(false);
    }));
  } catch (_) {}
}

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(clearSiteCaches());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    await clearSiteCaches();
    try {
      const clientsList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      await Promise.all(clientsList.map((client) => {
        try {
          client.postMessage({ type: "SITE_PWA_CACHE_DISABLED", build: SITE_PWA_BUILD });
        } catch (_) {}
        return Promise.resolve(true);
      }));
    } catch (_) {}
    try { await self.registration.unregister(); } catch (_) {}
    try { await self.clients.claim(); } catch (_) {}
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
    event.respondWith(fetch(remoteAuthScript, { cache: "no-store", mode: "no-cors" }));
    return;
  }
  event.respondWith(fetch(request, { cache: "no-store" }));
});
