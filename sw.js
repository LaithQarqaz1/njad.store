const SITE_PWA_CACHE = "njad-pwa-v20260408-08";
const SITE_PWA_SHELL = [
  "/",
  "/index.html",
  "/header.css",
  "/site-core.js?v=20260404-02",
  "/header.js?v=20260408-10"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(SITE_PWA_CACHE);
      await Promise.all(SITE_PWA_SHELL.map(async (asset) => {
        try {
          await cache.add(new Request(asset, { cache: "reload" }));
        } catch (_) {}
      }));
    } catch (_) {}
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => {
        if (key === SITE_PWA_CACHE || !/^njad-pwa-/i.test(String(key || ""))) return Promise.resolve(false);
        return caches.delete(key);
      }));
    } catch (_) {}
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
  const shouldHandle =
    pathname === "/" ||
    pathname === "/index.html" ||
    pathname === "/header.css" ||
    pathname === "/site-core.js" ||
    pathname === "/header.js";
  if (!shouldHandle) return;
  event.respondWith((async () => {
    try {
      const cache = await caches.open(SITE_PWA_CACHE);
      const cached = await cache.match(request, { ignoreSearch: false });
      if (cached) return cached;
      const response = await fetch(request);
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
