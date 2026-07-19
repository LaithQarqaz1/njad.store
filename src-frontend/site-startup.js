/* Generated startup scripts moved after page markup. Build 20260518-03. */

;
/* index.html inline script moved from line 8. */
(function(){
      try {
        var path = String(location.pathname || "").replace(/\/+$/, "");
        var search = String(location.search || "");
        var hash = String(location.hash || "");
        var map = {
          "/__/auth/handler.html": "/__/auth/handler",
          "/__/auth/handler/index.html": "/__/auth/handler",
          "/__/auth/iframe.html": "/__/auth/iframe",
          "/__/auth/iframe/index.html": "/__/auth/iframe",
          "/__/auth/links.html": "/__/auth/links"
        };
        if (map[path]) {
          if (/^#\//.test(hash)) hash = "";
          location.replace(map[path] + search + hash);
        }
      } catch (_) {}
    })();

;
/* index.html inline script moved from line 28. */
(function(){
      var googleRedirectPending = false;
      var startupFailsafeStartedAt = Date.now();
      try { window.__STARTUP_FAILSAFE_STARTED_AT__ = startupFailsafeStartedAt; } catch (_) {}
      try {
        var raw = localStorage.getItem("site:google:redirect:pending:v1");
        if (raw) {
          var payload = JSON.parse(raw);
          var startedAt = Number(payload && (payload.startedAt || payload.ts) || 0) || 0;
          googleRedirectPending = !!(startedAt && Date.now() - startedAt <= 15 * 60 * 1000);
        }
        if (!googleRedirectPending) {
          localStorage.removeItem("site:google:redirect:pending:v1");
          localStorage.removeItem("site:google:redirect:early:status:v1");
        }
      } catch (_) {
        try { localStorage.removeItem("site:google:redirect:pending:v1"); } catch (_) {}
        try { localStorage.removeItem("site:google:redirect:early:status:v1"); } catch (_) {}
        googleRedirectPending = false;
      }
      try {
        document.documentElement.classList.toggle("google-redirect-pending", googleRedirectPending);
        document.documentElement.classList.remove("auth-request-loader-pending");
        if (googleRedirectPending) {
          window.__LOADER_HOLD_ACTIVE__ = true;
          window.__GOOGLE_REDIRECT_EARLY_STARTED_AT__ = Date.now();
        }
      } catch (_) {}
      function hideStartupLoader(){
        try {
          if (window.__LOADER_HOLD_ACTIVE__ === true) return;
          if (window.__LEVELS_INLINE_LOADING__ === true) return;
          if (window.__CATALOG_INLINE_LOADING__ === true) return;
          if (Number(window.__CATALOG_PAGE_LOADER_ACTIVE_COUNT__ || 0) > 0) return;
          if (document.documentElement.classList.contains("levels-loader-pending")) return;
          if (document.body && document.body.classList.contains("levels-loader-pending")) return;
          if (document.documentElement.classList.contains("catalog-loader-pending")) return;
          if (document.body && document.body.classList.contains("catalog-loader-pending")) return;
          if (document.documentElement.classList.contains("inline-wallet-route-pending")) return;
          var el = document.getElementById("preloader");
          if (!el) return;
          el.classList.add("hidden");
          el.classList.remove("google-redirect-early", "showing-instant", "entering", "preparing-intro", "closing");
          el.setAttribute("aria-hidden", "true");
          el.style.display = "none";
          el.style.opacity = "0";
          el.style.visibility = "hidden";
          el.style.pointerEvents = "none";
        } catch (_) {}
      }
      function getStartupRouteKey(){
        try {
          var raw = String(location.hash || "").replace(/^#\/?/, "").trim().toLowerCase();
          return raw.split("/").filter(Boolean)[0] || "";
        } catch (_) {}
        return "";
      }
      function isProtectedStartupRoute(){
        var key = getStartupRouteKey();
        return key === "deposit" || key === "edaa" || key === "security";
      }
      function isExternalStartupOpen(){
        try {
          var ua = String(navigator.userAgent || "").toLowerCase();
          var ref = String(document.referrer || "").toLowerCase();
          var search = String(location.search || "").toLowerCase();
          return /whatsapp|fb_iab|fban|fbav|instagram|telegram|line/.test(ua) ||
            /whatsapp|wa\.me|chat\.whatsapp|facebook|instagram|telegram|t\.co|bit\.ly/.test(ref) ||
            /(?:[?&](?:utm_source|source|src|ref)=whatsapp\b|whatsapp|wa_)/.test(search);
        } catch (_) {}
        return false;
      }
      function canForceStartupLoader(){
        try {
          if (isProtectedStartupRoute()) {
            var routeStartedAt = Number(window.__STARTUP_FAILSAFE_STARTED_AT__ || startupFailsafeStartedAt || 0) || 0;
            return !routeStartedAt || (Date.now() - routeStartedAt) > 10000;
          }
          if (!document.documentElement.classList.contains("google-redirect-pending")) return true;
          var startedAt = Number(window.__GOOGLE_REDIRECT_EARLY_STARTED_AT__ || 0) || 0;
          return !startedAt || (Date.now() - startedAt) > 2500;
        } catch (_) {}
        return true;
      }
      function removeStartupClass(node, name){
        try {
          if (node && node.classList) node.classList.remove(name);
        } catch (_) {}
      }
      function forceHideStartupLoader(reason){
        try {
          if (!canForceStartupLoader()) return;
          var catalogLoaderActive = false;
          try {
            catalogLoaderActive =
              window.__CATALOG_INLINE_LOADING__ === true ||
              Number(window.__CATALOG_PAGE_LOADER_ACTIVE_COUNT__ || 0) > 0 ||
              document.documentElement.classList.contains("catalog-loader-pending") ||
              !!(document.body && document.body.classList.contains("catalog-loader-pending"));
          } catch (_) {
            catalogLoaderActive = false;
          }
          if (catalogLoaderActive && reason !== "startup-long") return;
          try {
            var levelsLoaderActive =
              window.__LEVELS_INLINE_LOADING__ === true ||
              document.documentElement.classList.contains("levels-loader-pending") ||
              !!(document.body && document.body.classList.contains("levels-loader-pending"));
            if (levelsLoaderActive && reason !== "startup-long") return;
          } catch (_) {}
          window.__LOADER_HOLD_ACTIVE__ = false;
          window.__INLINE_WALLET_ROUTE_PENDING__ = false;
          removeStartupClass(document.documentElement, "google-redirect-pending");
          removeStartupClass(document.documentElement, "auth-request-loader-pending");
          removeStartupClass(document.documentElement, "pre-inline-route");
          removeStartupClass(document.documentElement, "pre-login-route");
          removeStartupClass(document.documentElement, "inline-wallet-route-pending");
          removeStartupClass(document.documentElement, "inline-route-pending");
          if (document.body) {
            removeStartupClass(document.body, "auth-request-loader-pending");
            removeStartupClass(document.body, "login-route-active");
            removeStartupClass(document.body, "inline-wallet-route-pending");
            removeStartupClass(document.body, "inline-route-pending");
          }
          try { if (typeof window.__resetPageLoaderHold === "function") window.__resetPageLoaderHold(); } catch (_) {}
          hideStartupLoader();
          var el = document.getElementById("preloader");
          if (el && reason) el.setAttribute("data-startup-failsafe", String(reason).slice(0, 60));
        } catch (_) {}
      }
      try { window.__startupTimedFailsafeDisabled = true; } catch (_) {}
      try { window.__forceHideStartupLoader = forceHideStartupLoader; } catch (_) {}
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", hideStartupLoader, false);
      } else {
        hideStartupLoader();
      }
    })();

;
/* index.html inline script moved from line 165. */
(function(){
      function normalizeText(value){
        var text = String(value == null ? "" : value).trim();
        var lower = text.toLowerCase();
        if (lower === "undefined" || lower === "null") return "";
        return text;
      }
      function isBlockedSitePreviewUrl(value){
        return false;
      }
      function absoluteSiteUrl(value){
        var text = normalizeText(value);
        if (!text) return "";
        try {
          return new URL(text, window.location.href).href;
        } catch (_) {
          return text;
        }
      }
      function guessPreviewImageType(value){
        var text = normalizeText(value).toLowerCase();
        var dataMatch = text.match(/^data:(image\/[^;,]+)/);
        if (dataMatch && dataMatch[1]) return dataMatch[1];
        if (/\.svg(?:[?#]|$)/.test(text)) return "image/svg+xml";
        if (/\.webp(?:[?#]|$)/.test(text)) return "image/webp";
        if (/\.jpe?g(?:[?#]|$)/.test(text)) return "image/jpeg";
        if (/\.avif(?:[?#]|$)/.test(text)) return "image/avif";
        return "image/png";
      }
      function readSiteSetting(path, fallback){
        try {
          if (typeof window.__getSiteSetting === "function") {
            var value = window.__getSiteSetting(path, fallback);
            return value == null ? fallback : value;
          }
        } catch (_) {}
        return fallback;
      }
      var DEFAULT_SITE_PREVIEW_URL = "";
      function readCachedSiteIcon(){
        try {
          var raw = localStorage.getItem("site:media:v1");
          if (!raw) return "";
          var parsed = JSON.parse(raw);
          if (!parsed || typeof parsed !== "object") return "";
          var readValue = function(source, path){
            var parts = String(path || "").split(".").filter(Boolean);
            var cursor = source;
            for (var i = 0; i < parts.length; i += 1) {
              if (!cursor || typeof cursor !== "object") return "";
              cursor = cursor[parts[i]];
            }
            return normalizeText(cursor);
          };
          return normalizeText(
            readValue(parsed, "siteImage") ||
            readValue(parsed, "site_image") ||
            readValue(parsed, "appSettings.siteImage") ||
            readValue(parsed, "appSettings.site_image") ||
            readValue(parsed, "app_settings.siteImage") ||
            readValue(parsed, "app_settings.site_image") ||
            readValue(parsed, "siteIcon") ||
            readValue(parsed, "site_icon") ||
            readValue(parsed, "icon") ||
            readValue(parsed, "iconUrl") ||
            readValue(parsed, "icon_url") ||
            readValue(parsed, "favicon") ||
            readValue(parsed, "faviconUrl") ||
            readValue(parsed, "favicon_url") ||
            readValue(parsed, "windowIcon") ||
            readValue(parsed, "window_icon") ||
            readValue(parsed, "windowImage") ||
            readValue(parsed, "window_image") ||
            readValue(parsed, "headerLogo") ||
            readValue(parsed, "header_logo") ||
            readValue(parsed, "logo") ||
            readValue(parsed, "logoUrl") ||
            readValue(parsed, "logo_url") ||
            ""
          );
        } catch (_) {
          return "";
        }
      }
      function readCachedSitePreview(){
        try {
          var raw = localStorage.getItem("site:media:v1");
          if (!raw) return "";
          var parsed = JSON.parse(raw);
          if (!parsed || typeof parsed !== "object") return "";
          var readValue = function(source, path){
            var parts = String(path || "").split(".").filter(Boolean);
            var cursor = source;
            for (var i = 0; i < parts.length; i += 1) {
              if (!cursor || typeof cursor !== "object") return "";
              cursor = cursor[parts[i]];
            }
            return normalizeText(cursor);
          };
          return normalizeText(
            readValue(parsed, "sitePreview") ||
            readValue(parsed, "site_preview") ||
            readValue(parsed, "shareImage") ||
            readValue(parsed, "share_image") ||
            readValue(parsed, "ogImage") ||
            readValue(parsed, "og_image") ||
            readValue(parsed, "siteImage") ||
            readValue(parsed, "site_image") ||
            readValue(parsed, "appSettings.siteImage") ||
            readValue(parsed, "appSettings.site_image") ||
            readValue(parsed, "app_settings.siteImage") ||
            readValue(parsed, "app_settings.site_image") ||
            ""
          );
        } catch (_) {
          return "";
        }
      }
      function applySiteIcon(url){
        var href = normalizeText(url);
        if (!href) return;
        try {
          if (!document.querySelector('link[rel="icon"]')) {
            var iconLink = document.createElement("link");
            iconLink.rel = "icon";
            document.head.appendChild(iconLink);
          }
          if (!document.querySelector('link[rel="apple-touch-icon"]')) {
            var appleLink = document.createElement("link");
            appleLink.rel = "apple-touch-icon";
            document.head.appendChild(appleLink);
          }
          document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]').forEach(function(node){
            if (node) {
              node.setAttribute("href", href);
              try { node.removeAttribute("type"); } catch (_) {}
            }
          });
        } catch (_) {}
      }
      function setMetaContent(selector, value){
        try {
          var node = document.querySelector(selector);
          if (node) node.setAttribute("content", normalizeText(value));
        } catch (_) {}
      }
      function applySitePreview(url){
        var href = absoluteSiteUrl(url);
        if (!href) return;
        if (isBlockedSitePreviewUrl(href)) return;
        try { window.__SITE_SHARE_PREVIEW__ = href; } catch (_) {}
        setMetaContent('meta[property="og:image"]', href);
        setMetaContent('meta[property="og:image:secure_url"]', href);
        setMetaContent('meta[property="og:image:type"]', guessPreviewImageType(href));
        setMetaContent('meta[name="twitter:image"]', href);
        setMetaContent('meta[name="twitter:image:src"]', href);
        setMetaContent('meta[itemprop="image"]', href);
        try {
          var webJsonLd = document.getElementById("siteWebJsonLd");
          if (webJsonLd) {
            var webParsed = JSON.parse(webJsonLd.textContent || "{}");
            if (webParsed && typeof webParsed === "object") {
              webParsed.image = href;
              if (webParsed.publisher && typeof webParsed.publisher === "object") {
                var publisher = webParsed.publisher;
                var publisherLogo = (publisher.logo && typeof publisher.logo === "object") ? publisher.logo : {};
                publisher.logo = Object.assign({}, publisherLogo, { url: href });
                webParsed.publisher = publisher;
              }
              webJsonLd.textContent = JSON.stringify(webParsed, null, 2);
            }
          }
        } catch (_) {}
        try {
          var orgJsonLd = document.getElementById("siteOrgJsonLd");
          if (orgJsonLd) {
            var orgParsed = JSON.parse(orgJsonLd.textContent || "{}");
            if (orgParsed && typeof orgParsed === "object") {
              orgParsed.logo = href;
              orgJsonLd.textContent = JSON.stringify(orgParsed, null, 2);
            }
          }
        } catch (_) {}
      }
      try { window.__SITE_ICON__ = ""; } catch (_) {}
      try { window.__SITE_SHARE_PREVIEW__ = ""; } catch (_) {}
    })();

;
/* index.html inline script moved from line 350. */
(function(){
      function normalizeText(value){
        var text = String(value == null ? "" : value).trim();
        var lower = text.toLowerCase();
        if (lower === "undefined" || lower === "null") return "";
        return text;
      }
      var DEFAULT_STATIC_STORE_NAME = "Njad store";
      var SITE_ARABIC_STORE_NAME = "\u0646\u062c\u0627\u062f \u0633\u062a\u0648\u0631";
      var LEGACY_STORE_NAME_PATTERN = new RegExp("$^");
      function hasArabicStoreName(value){
        return /\u0646\u062c\u0627\u062f \u0633\u062a\u0648\u0631/.test(String(value == null ? "" : value));
      }
      function normalizeStoreNameValue(value, fallback){
        var text = normalizeText(value).slice(0, 160);
        if (text && !LEGACY_STORE_NAME_PATTERN.test(text)) return text;
        var fallbackText = normalizeText(fallback || DEFAULT_STATIC_STORE_NAME).slice(0, 160);
        return fallbackText && !LEGACY_STORE_NAME_PATTERN.test(fallbackText) ? fallbackText : DEFAULT_STATIC_STORE_NAME;
      }
      function buildSeoStoreTitle(value){
        // App/tab title is the admin's Design store name ONLY — no hardcoded brand suffix.
        return normalizeStoreNameValue(value, DEFAULT_STATIC_STORE_NAME) || DEFAULT_STATIC_STORE_NAME;
      }
      function readJson(key){
        try {
          var raw = localStorage.getItem(String(key || "").trim());
          if (!raw) return null;
          var parsed = JSON.parse(raw);
          return parsed && typeof parsed === "object" ? parsed : null;
        } catch (_) {
          return null;
        }
      }
      function readValue(source, path){
        try {
          var parts = String(path || "").split(".").filter(Boolean);
          var cursor = source;
          for (var i = 0; i < parts.length; i += 1) {
            if (!cursor || typeof cursor !== "object") return "";
            cursor = cursor[parts[i]];
          }
          return normalizeText(cursor);
        } catch (_) {
          return "";
        }
      }
      function setMetaContent(selector, value){
        try {
          var node = document.querySelector(selector);
          if (node) node.setAttribute("content", normalizeText(value));
        } catch (_) {}
      }
      function readManifestName(){
        var brand = readJson("site:brand:v1") || {};
        return normalizeStoreNameValue(
          readValue(brand, "storeName") ||
          readValue(brand, "store_name") ||
          readValue(brand, "siteName") ||
          readValue(brand, "site_name") ||
          document.title ||
          (window.location && window.location.hostname) ||
          DEFAULT_STATIC_STORE_NAME,
          DEFAULT_STATIC_STORE_NAME
        ) || DEFAULT_STATIC_STORE_NAME;
      }
      function readCurrentRouteKey(){
        try {
          var bodyRoute = String(document.body && document.body.getAttribute("data-inline-route") || "").trim().toLowerCase();
          if (bodyRoute) return bodyRoute;
        } catch (_) {}
        try {
          var raw = String(window.location && window.location.hash || "").replace(/^#\/?/, "").trim().toLowerCase();
          return (raw.split("/").filter(Boolean)[0] || "");
        } catch (_) {
          return "";
        }
      }
      function applyCachedDocumentTitle(name){
        try {
          if (typeof window.__refreshCatalogGameTitle === "function") {
            window.__refreshCatalogGameTitle();
            return;
          }
        } catch (_) {}
        try {
          if (typeof window.__updateDocumentTitleForRoute === "function") {
            window.__updateDocumentTitleForRoute(readCurrentRouteKey());
            return;
          }
        } catch (_) {}
        try { document.title = buildSeoStoreTitle(name); } catch (_) {}
      }
      function applyCachedStoreName(){
        var name = readManifestName();
        if (!name) return;
        try {
          var brand = (window.__SITE_BRAND__ && typeof window.__SITE_BRAND__ === "object") ? window.__SITE_BRAND__ : {};
          window.__SITE_BRAND__ = Object.assign({}, brand, { storeName: name });
        } catch (_) {}
        try { window.__SITE_STORE_NAME__ = name; } catch (_) {}
        applyCachedDocumentTitle(name);
        var seoTitle = buildSeoStoreTitle(name);
        setMetaContent('meta[name="application-name"]', name);
        setMetaContent('meta[name="apple-mobile-web-app-title"]', name);
        setMetaContent('meta[property="og:title"]', seoTitle);
        setMetaContent('meta[property="og:site_name"]', seoTitle);
        setMetaContent('meta[name="twitter:title"]', seoTitle);
      }
      function readManifestIcon(){
        var media = readJson("site:media:v1") || {};
        var fromMedia = normalizeText(
          window.__SITE_ICON__ ||
          readValue(media, "siteImage") ||
          readValue(media, "site_image") ||
          readValue(media, "appSettings.siteImage") ||
          readValue(media, "appSettings.site_image") ||
          readValue(media, "app_settings.siteImage") ||
          readValue(media, "app_settings.site_image") ||
          readValue(media, "siteIcon") ||
          readValue(media, "site_icon") ||
          readValue(media, "icon") ||
          readValue(media, "iconUrl") ||
          readValue(media, "icon_url") ||
          readValue(media, "favicon") ||
          readValue(media, "faviconUrl") ||
          readValue(media, "favicon_url") ||
          readValue(media, "windowIcon") ||
          readValue(media, "window_icon") ||
          readValue(media, "windowImage") ||
          readValue(media, "window_image") ||
          readValue(media, "headerLogo") ||
          readValue(media, "header_logo") ||
          readValue(media, "logo") ||
          readValue(media, "logoUrl") ||
          readValue(media, "logo_url") ||
          ""
        );
        if (fromMedia) return fromMedia;
        try {
          var link = document.querySelector('link[rel="icon"], link[rel="apple-touch-icon"]');
          var href = normalizeText(link && (link.getAttribute("href") || link.href));
          if (href) return href;
        } catch (_) {}
        return "";
      }
      function revokeOldManifestUrl(){
        var current = normalizeText(window.__SITE_PWA_MANIFEST_URL__);
        if (!current) return;
        try { URL.revokeObjectURL(current); } catch (_) {}
        try { window.__SITE_PWA_MANIFEST_URL__ = ""; } catch (_) {}
      }
      function getDynamicManifestLink(){
        var link = document.getElementById("dynamicSiteManifestLink");
        if (!link) {
          try {
            link = document.createElement("link");
            link.id = "dynamicSiteManifestLink";
            link.rel = "manifest";
            document.head.appendChild(link);
          } catch (_) {
            link = null;
          }
        }
        return link;
      }
      function setManifestLinkHref(href, isObjectUrl){
        var manifestUrl = normalizeText(href);
        if (!manifestUrl) return "";
        var previousObjectUrl = normalizeText(window.__SITE_PWA_MANIFEST_URL__);
        var link = getDynamicManifestLink();
        if (link && link.getAttribute("href") !== manifestUrl) link.setAttribute("href", manifestUrl);
        try { window.__SITE_PWA_MANIFEST_URL__ = isObjectUrl ? manifestUrl : ""; } catch (_) {}
        if (previousObjectUrl && previousObjectUrl !== manifestUrl) {
          try { URL.revokeObjectURL(previousObjectUrl); } catch (_) {}
        }
        return manifestUrl;
      }
      function setStaticManifestLink(){
        var href = "/manifest.webmanifest?v=20260613-share-preview-01";
        setManifestLinkHref(href, false);
        revokeOldManifestUrl();
        return href;
      }
      function resolveAbsoluteManifestUrl(value, fallback){
        var raw = normalizeText(value || fallback);
        if (!raw) return "";
        try {
          var base = normalizeText(window.location && window.location.origin) || normalizeText(window.location && window.location.href) || "/";
          return new URL(raw, base).href;
        } catch (_) {
          return raw;
        }
      }
      function escapeManifestSvgAttr(value){
        return String(value == null ? "" : value)
          .replace(/&/g, "&amp;")
          .replace(/"/g, "&quot;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
      }
      function guessManifestIconType(value){
        var text = normalizeText(value).toLowerCase();
        var dataMatch = text.match(/^data:(image\/[^;,]+)/);
        if (dataMatch && dataMatch[1]) return dataMatch[1];
        if (/\.svg(?:[?#]|$)/.test(text)) return "image/svg+xml";
        if (/\.webp(?:[?#]|$)/.test(text)) return "image/webp";
        if (/\.jpe?g(?:[?#]|$)/.test(text)) return "image/jpeg";
        if (/\.avif(?:[?#]|$)/.test(text)) return "image/avif";
        return "image/png";
      }
      function buildContainedManifestIconDataUrl(iconUrl){
        var href = resolveAbsoluteManifestUrl(iconUrl, "");
        if (!href) return "";
        var safeHref = escapeManifestSvgAttr(href);
        var svg = [
          '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">',
          '<rect width="512" height="512" fill="transparent"/>',
          '<image href="', safeHref, '" x="48" y="48" width="416" height="416" preserveAspectRatio="xMidYMid meet"/>',
          '</svg>'
        ].join("");
        return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
      }
      function buildDynamicManifestPayload(){
        var name = readManifestName() || DEFAULT_STATIC_STORE_NAME;
        var shortName = normalizeText(name).slice(0, 24) || "Njad store";
        // Reuse the shared installable-icon pipeline (raw-URL floor + async PNG
        // rasterization) so the manifest always carries a usable, visible icon and the
        // app installs as a real PWA (not a bookmark shortcut).
        var icons = [];
        try {
          if (typeof getSiteInstallIconEntries === "function") {
            icons = getSiteInstallIconEntries(readManifestIcon()) || [];
          }
        } catch (_) { icons = []; }
        return {
          id: resolveAbsoluteManifestUrl("/?source=pwa", "/?source=pwa"),
          name: name,
          short_name: shortName,
          start_url: resolveAbsoluteManifestUrl("/?source=pwa", "/?source=pwa"),
          scope: resolveAbsoluteManifestUrl("/", "/"),
          display: "standalone",
          display_override: ["fullscreen", "standalone", "minimal-ui"],
          background_color: "#0C0C0C",
          theme_color: "#0C0C0C",
          lang: "ar",
          dir: "rtl",
          prefer_related_applications: false,
          icons: icons,
          shortcuts: [
            { name: "\u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062f\u062e\u0648\u0644", short_name: "\u0627\u0644\u062f\u062e\u0648\u0644", url: resolveAbsoluteManifestUrl("/login", "/login") },
            { name: "\u0627\u0644\u0625\u0639\u062f\u0627\u062f\u0627\u062a", short_name: "\u0625\u0639\u062f\u0627\u062f\u0627\u062a", url: resolveAbsoluteManifestUrl("/settings", "/settings") },
            { name: "\u0637\u0644\u0628\u0627\u062a\u064a", short_name: "\u0637\u0644\u0628\u0627\u062a\u064a", url: resolveAbsoluteManifestUrl("/orders", "/orders") },
            { name: "\u0627\u0644\u0645\u062d\u0641\u0638\u0629", short_name: "\u0645\u062d\u0641\u0638\u0629", url: resolveAbsoluteManifestUrl("/wallet", "/wallet") }
          ]
        };
      }
      var dynamicManifestBlobMemo = { json: "", href: "" };
      function setDynamicManifestLink(){
        // Build the manifest from the admin's Design store name (readManifestName →
        // brand.storeName) and serve it as a blob so the INSTALLED app carries the
        // admin's name, not the hardcoded static file. Any failure falls back to the
        // static /manifest.webmanifest so install never breaks. While the payload is
        // unchanged the previous blob URL is reused (no refetch churn).
        try {
          var payload = buildDynamicManifestPayload();
          if (payload && window.URL && typeof window.URL.createObjectURL === "function" && typeof Blob === "function") {
            var json = JSON.stringify(payload);
            if (json === dynamicManifestBlobMemo.json && dynamicManifestBlobMemo.href) {
              return setManifestLinkHref(dynamicManifestBlobMemo.href, true);
            }
            var blob = new Blob([json], { type: "application/manifest+json" });
            var blobUrl = window.URL.createObjectURL(blob);
            if (blobUrl) {
              dynamicManifestBlobMemo = { json: json, href: blobUrl };
              return setManifestLinkHref(blobUrl, true);
            }
          }
        } catch (_) {}
        return setStaticManifestLink();
      }
      function applyDynamicManifest(){
        return setDynamicManifestLink();
        var unusedStaticManifestShortcuts = [
          { name: "تسجيل الدخول", short_name: "الدخول", url: resolveAbsoluteManifestUrl("/login", "/login") },
          { name: "الإعدادات", short_name: "إعدادات", url: resolveAbsoluteManifestUrl("/settings", "/settings") },
          { name: "طلباتي", short_name: "طلباتي", url: resolveAbsoluteManifestUrl("/orders", "/orders") },
          { name: "المحفظة", short_name: "المحفظة", url: resolveAbsoluteManifestUrl("/wallet", "/wallet") }
        ];
      }
      try { window.__refreshDynamicSiteManifestHead = applyDynamicManifest; } catch (_) {}
      applyCachedStoreName();
      applyDynamicManifest();
      document.addEventListener("DOMContentLoaded", function(){
        applyCachedStoreName();
        applyDynamicManifest();
      }, { once: true });
      try {
        window.addEventListener("storage", function(ev){
          if (ev && ev.key === "site:brand:v1") {
            applyCachedStoreName();
            applyDynamicManifest();
          }
        });
      } catch (_) {}
    })();

;
/* index.html inline script moved from line 603. */
(function () {
      try {
        var params = new URLSearchParams(window.location.search);
        var action = params.get("action") || params.get("catalogAction") || params.get("catalog_action") || params.get("game") || params.get("catalogGame") || params.get("catalog_game");
        if (action && !/catalog-game.html$/i.test(window.location.pathname)) {
          params.delete("action");
          params.delete("catalogAction");
          params.delete("catalog_action");
          params.delete("game");
          params.delete("catalogGame");
          params.delete("catalog_game");
          var hash = "#/" + encodeURIComponent(action);
          var search = params.toString();
          var nextUrl = window.location.pathname + (search ? "?" + search : "") + hash;
          history.replaceState({}, "", nextUrl);
        }
      } catch (err) {
        void err;
      }
    })();

;
/* index.html inline script moved from line 625. */
(function () {
      try {
        var existingHash = String(window.location.hash || "").trim();
        if (existingHash && existingHash !== "#") return;

        var pathname = String(window.location.pathname || "/").replace(/\/{2,}/g, "/");
        if (!pathname || pathname === "/" || /\/index\.html$/i.test(pathname)) return;

        var rawSegments = pathname.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
        if (!rawSegments.length) return;

        var routeKeys = {
          "404": 1,
          "games": 1,
          "deposit": 1,
          "edaa": 1,
          "login": 1,
          "settings": 1,
          "telegram": 1,
          "security": 1,
          "orders": 1,
          "dafaati": 1,
          "api": 1,
          "reviews": 1,
          "agents": 1,
          "favorites": 1,
          "privacy": 1,
          "terms": 1,
          "transfer": 1,
          "wallet": 1,
          "invite": 1,
          "referrals": 1
        };
        var categoryKeys = {
          "games": 1,
          "subscription": 1,
          "subscriptions": 1,
          "units": 1,
          "payments": 1,
          "chat": 1,
          "activations": 1,
          "accounts": 1,
          "misc": 1,
          "numbers": 1,
          "currency": 1,
          "internet": 1
        };

        var firstRaw = rawSegments[0] || "";
        try { firstRaw = decodeURIComponent(firstRaw); } catch (_) {}
        var first = String(firstRaw || "").trim().toLowerCase().replace(/\.html$/i, "");

        var hashSegments = rawSegments.slice();
        if (first && (routeKeys[first] || categoryKeys[first] || /^\d+$/.test(first))) {
          hashSegments[0] = first;
        } else {
          hashSegments = ["404"].concat(rawSegments);
        }

        var encodedSegments = hashSegments.map(function (part) {
          var decoded = part;
          try { decoded = decodeURIComponent(part || ""); } catch (_) {}
          return encodeURIComponent(String(decoded || "").trim());
        }).filter(Boolean);
        if (!encodedSegments.length) return;

        var nextHash = "#/" + encodedSegments.join("/");
        var nextUrl = "/" + String(window.location.search || "") + nextHash;
        history.replaceState({
          key: encodedSegments[0] || "",
          path: pathname,
          pathSource: "rewrite"
        }, "", nextUrl);
      } catch (err) {
        void err;
      }
    })();

;
/* index.html inline script moved from line 704. */
(function(){
      function isInlineLikeHash(hash){
        var raw = String(hash || "").replace(/^#\/?/, "").trim().toLowerCase();
        if (!raw || raw === "/") return false;
        var key = raw.split("/").filter(Boolean)[0] || "";
        if (!key) return false;
        if (key === "privacy" || key === "terms") return false;
        return true;
      }
      function isLoginHash(hash){
        var raw = String(hash || "").replace(/^#\/?/, "").trim().toLowerCase();
        if (!raw || raw === "/") return false;
        var key = raw.split("/").filter(Boolean)[0] || "";
        return key === "login";
      }
      function syncEarlyInlineFlag(){
        try {
          var inlineLike = isInlineLikeHash(location.hash);
          var loginLike = isLoginHash(location.hash);
          document.documentElement.classList.toggle("pre-inline-route", inlineLike);
          document.documentElement.classList.toggle("pre-login-route", loginLike);
          if (document.body) document.body.classList.toggle("login-route-active", loginLike);
        } catch(_){}
      }
      try { syncEarlyInlineFlag(); } catch(_){}
      try { window.addEventListener("hashchange", syncEarlyInlineFlag); } catch(_){}
      try { window.addEventListener("popstate", syncEarlyInlineFlag); } catch(_){}
      try { window.addEventListener("pageshow", syncEarlyInlineFlag); } catch(_){}
      try { document.addEventListener("DOMContentLoaded", syncEarlyInlineFlag); } catch(_){}
    })();

;
/* index.html inline script moved from line 736. */
(function(){
      var CRITICAL_SHELL_ASSETS = [
        { href: "site-bundle.css?v=20260620-deposit-confirm-accent-01", as: "style" },
        { href: "site-bundle.js?v=20260704-referral-redeem-ui-04", as: "script" }
      ];
      var LEGACY_SW_CACHE_PREFIXES = (function(){
        try {
          var prefixes = window.__getSiteSetting ? window.__getSiteSetting("pwa.legacyCachePrefixes", []) : [];
          return Array.isArray(prefixes) ? prefixes : [];
        } catch (_) {
          return [];
        }
      })();

      function normalizeHref(href){
        try {
          return new URL(String(href || "").trim(), window.location.href).href;
        } catch (_) {
          return "";
        }
      }

      function isLegacyServiceWorkerCache(name){
        var text = String(name || "").trim().toLowerCase();
        if (!text) return false;
        for (var i = 0; i < LEGACY_SW_CACHE_PREFIXES.length; i += 1) {
          if (text.indexOf(LEGACY_SW_CACHE_PREFIXES[i]) === 0) return true;
        }
        return false;
      }

      function headHasLink(rel, href){
        try {
          var resolved = normalizeHref(href);
          if (!resolved || !document.head) return false;
          var nodes = document.head.querySelectorAll('link[rel="' + rel + '"]');
          for (var i = 0; i < nodes.length; i += 1) {
            var current = normalizeHref(nodes[i].getAttribute("href") || nodes[i].href || "");
            if (current && current === resolved) return true;
          }
        } catch (_) {}
        return false;
      }

      function appendHeadHint(rel, href, as){
        if (!document.head || !href || headHasLink(rel, href)) return;
        try {
          var link = document.createElement("link");
          link.rel = rel;
          link.href = href;
          if (as) link.as = as;
          if (as === "image") link.fetchPriority = "low";
          document.head.appendChild(link);
        } catch (_) {}
      }

      async function unregisterLegacyServiceWorkers(){
        if (!("serviceWorker" in navigator)) return [];
        try {
          var registrations = await navigator.serviceWorker.getRegistrations();
          return await Promise.all((registrations || []).map(function(registration){
            try { return registration.unregister(); } catch (_) { return false; }
          }));
        } catch (_) {
          return [];
        }
      }

      async function clearLegacyServiceWorkerCaches(){
        if (!("caches" in window)) return [];
        try {
          var cacheNames = await caches.keys();
          return await Promise.all((cacheNames || [])
            .filter(isLegacyServiceWorkerCache)
            .map(function(cacheName){
              try { return caches.delete(cacheName); } catch (_) { return false; }
            }));
        } catch (_) {
          return [];
        }
      }

      function warmCriticalShellAssets(){
        return;
      }

      function disableLegacyServiceWorkerOnce(){
        if (window.__LEGACY_SW_DISABLE_PROMISE__) return window.__LEGACY_SW_DISABLE_PROMISE__;
        window.__LEGACY_SW_DISABLE_PROMISE__ = Promise.all([
          unregisterLegacyServiceWorkers(),
          clearLegacyServiceWorkerCaches()
        ]).catch(function(){});
        return window.__LEGACY_SW_DISABLE_PROMISE__;
      }

      try {
        window.__SITE_SW_DISABLED__ = true;
        window.__SITE_SERVICE_WORKER_DISABLED__ = true;
        window.__SITE_CRITICAL_SHELL_ASSETS__ = CRITICAL_SHELL_ASSETS.map(function(entry){ return entry.href; });
        window.__disableLegacyServiceWorker = disableLegacyServiceWorkerOnce;
      } catch (_) {}

      function scheduleLegacyServiceWorkerCleanup(){
        var run = function(){
          try { disableLegacyServiceWorkerOnce(); } catch (_) {}
        };
        var runWhenIdle = function(){
          try {
            if (typeof window.requestIdleCallback === "function") {
              window.requestIdleCallback(run, { timeout: 5000 });
              return;
            }
          } catch (_) {}
          try { window.setTimeout(run, 2500); } catch (_) { run(); }
        };
        try {
          if (document.readyState === "complete") runWhenIdle();
          else window.addEventListener("load", runWhenIdle, { once: true });
        } catch (_) {
          runWhenIdle();
        }
      }

      try { disableLegacyServiceWorkerOnce(); } catch (_) {}
      try { scheduleLegacyServiceWorkerCleanup(); } catch (_) {}

      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", warmCriticalShellAssets, { once: true });
      } else {
        warmCriticalShellAssets();
      }
    })();

;
/* index.html inline script moved from line 973. */
(function(){
    function createMemoryStorage(){
      let store = {};
      return {
        getItem: function(key){
          return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
        },
        setItem: function(key, value){
          store[key] = String(value);
        },
        removeItem: function(key){
          delete store[key];
        },
        clear: function(){
          store = {};
        },
        key: function(index){
          const keys = Object.keys(store);
          return keys[index] || null;
        },
        get length(){
          return Object.keys(store).length;
        }
      };
    }

    function ensureStorage(name){
      let ok = true;
      let storage = null;
      try { storage = window[name]; } catch (_) { storage = null; }
      if (!storage) ok = false;
      if (ok){
        try {
          const key = "__test__" + Math.random().toString(36).slice(2);
          storage.setItem(key, "1");
          storage.removeItem(key);
        } catch (_) {
          ok = false;
        }
      }
      if (!ok){
        const mem = createMemoryStorage();
        try { Object.defineProperty(window, name, { value: mem, configurable: true }); }
        catch (_) { try { window[name] = mem; } catch (__){ } }
      }
      return ok;
    }

    const localOk = ensureStorage("localStorage");
    const sessionOk = ensureStorage("sessionStorage");
    const storageOk = !!(localOk && sessionOk);
    let protocolOk = true;
    let hostname = "";
    try {
      const p = location && location.protocol;
      protocolOk = (p === "http:" || p === "https:" || p === "chrome-extension:");
      hostname = location && location.hostname ? String(location.hostname).toLowerCase() : "";
    } catch (_) { protocolOk = false; }

    const webEnvOk = protocolOk && storageOk;
    // Allow Firebase on any http/https host as long as protocol/storage are suitable.
    const firebaseEnvOk = webEnvOk;
    try { window.__STORAGE_OK__ = storageOk; } catch(_){}
    try { window.__WEB_ENV_OK__ = webEnvOk; } catch(_){}
    try { window.__FIREBASE_ENV_OK__ = firebaseEnvOk; } catch(_){}
    try { window.__SKIP_FIREBASE__ = !firebaseEnvOk; } catch(_){}
  })();

;
/* index.html inline script moved from line 1042. */
(function(){
    var holdCount = 0;
    function getInlineWalletFlowKindFromHash(hash){
      try {
        var raw = String(hash || '').replace(/^#\/?/, '').trim().toLowerCase();
        var first = raw.split('/').filter(Boolean)[0] || '';
        if (first === 'deposit' || first === 'edaa') return 'deposit';
      } catch(_){}
      return '';
    }
    function setHoldActive(active){
      try { window.__LOADER_HOLD_ACTIVE__ = !!active; } catch(_){}
    }
    function setInlineWalletRoutePending(active){
      var next = !!active;
      try {
        if (document.documentElement) document.documentElement.classList.toggle('inline-wallet-route-pending', next);
        if (document.body) document.body.classList.toggle('inline-wallet-route-pending', next);
      } catch(_){}
      try {
        var pre = document.getElementById('preloader');
        if (pre && next) {
          pre.classList.remove('hidden');
          pre.classList.remove('closing');
          pre.removeAttribute('aria-hidden');
          pre.setAttribute('aria-busy', 'true');
          pre.style.display = 'flex';
          pre.style.opacity = '1';
          pre.style.visibility = 'visible';
          pre.style.pointerEvents = 'auto';
          var loader = pre.querySelector ? pre.querySelector('.loader') : null;
          if (!loader && document && typeof document.createElement === 'function') {
            loader = document.createElement('div');
            loader.className = 'loader';
            loader.setAttribute('aria-hidden', 'true');
            pre.appendChild(loader);
          }
          if (loader) {
            try { loader.removeAttribute('hidden'); } catch(_){}
            loader.style.display = 'grid';
            loader.style.visibility = 'visible';
            loader.style.opacity = '1';
            loader.style.transform = 'scale(1)';
            loader.style.width = '128px';
            loader.style.height = '128px';
            loader.style.position = 'relative';
            loader.style.borderRadius = '50%';
          }
          try { if (typeof window.__primePageLoaderIntro === 'function') window.__primePageLoaderIntro(pre); } catch(_){}
        } else if (pre && !next) {
          try { pre.removeAttribute('aria-busy'); } catch(_){}
        }
      } catch(_){}
      try { window.__INLINE_WALLET_ROUTE_PENDING__ = next; } catch(_){}
      try { window.__DEPOSIT_INLINE_LOADING__ = next; } catch(_){}
    }
    function show(replay){
      try { if (typeof showPageLoader === "function") showPageLoader({ hold: true, replay: replay === true }); } catch(_){}
    }
    function hide(){
      try { if (typeof hidePageLoader === "function") hidePageLoader(); } catch(_){}
    }
    try {
      window.__setInlineWalletRoutePending = setInlineWalletRoutePending;
      window.__holdPageLoader = function(){
        var shouldReplay = holdCount === 0;
        holdCount += 1;
        setHoldActive(true);
        // Always re-show while held in case another flow hid it unexpectedly.
        show(shouldReplay);
      };
      window.__releasePageLoader = function(){
        var securityLock = false;
        try { securityLock = window.__SECURITY_CONFIG_LOADING__ === true; } catch(_){}
        if (securityLock) {
          if (holdCount <= 0) holdCount = 1;
          setHoldActive(true);
          show(true);
          return;
        }
        if (holdCount > 0) holdCount -= 1;
        if (holdCount === 0) {
          try {
            if (Number(window.__SERVER_REQUEST_LOADER_PENDING_COUNT__ || 0) > 0) {
              setHoldActive(false);
              show(false);
              return;
            }
          } catch(_){}
          setHoldActive(false);
          hide();
        }
      };
      window.__resetPageLoaderHold = function(){
        var securityLock = false;
        try { securityLock = window.__SECURITY_CONFIG_LOADING__ === true; } catch(_){}
        if (securityLock) return;
        try {
          if (Number(window.__SERVER_REQUEST_LOADER_PENDING_COUNT__ || 0) > 0) {
            holdCount = 0;
            setHoldActive(false);
            show(false);
            return;
          }
        } catch(_){}
        holdCount = 0;
        setHoldActive(false);
        hide();
      };
    } catch(_){}
    try {
      window.__LAST_INLINE_WALLET_FLOW_KIND__ = getInlineWalletFlowKindFromHash(location.hash);
    } catch(_){}
    try {
      window.addEventListener('hashchange', function(){
        var nextFlow = getInlineWalletFlowKindFromHash(location.hash);
        var prevFlow = '';
        try { prevFlow = String(window.__LAST_INLINE_WALLET_FLOW_KIND__ || '').trim().toLowerCase(); } catch(_){}
        try { window.__LAST_INLINE_WALLET_FLOW_KIND__ = nextFlow; } catch(_){}
        if (nextFlow && nextFlow !== prevFlow) {
          setInlineWalletRoutePending(true);
        }
      });
    } catch(_){}
  })();

;
/* index.html inline script moved from line 1156. */
(function () {
    var selected = "ar";
    var langForDom = "ar";
    var dirForDom = "rtl";
    try {
      var root = document.documentElement;
      if (!root) return;
      root.setAttribute("lang", langForDom);
      root.setAttribute("dir", dirForDom);
      root.setAttribute("data-lang", selected);
    } catch (_) {}
  })();

;
/* index.html inline script moved from line 1174. */
(function(){
    if (typeof window === "undefined" || typeof document === "undefined") return;
    if (window.__CUSTOM_VIEWPORT_SCROLLBAR_ATTACHED__) return;
    window.__CUSTOM_VIEWPORT_SCROLLBAR_ATTACHED__ = true;
    var desktopScrollbarMedia = null;
    try {
      desktopScrollbarMedia = window.matchMedia("(min-width: 992px) and (hover: hover) and (pointer: fine)");
    } catch (_) {
      desktopScrollbarMedia = null;
    }
    function shouldUseCustomViewportScrollbar(){
      try {
        if ((window.innerWidth || 0) < 992) return false;
      } catch (_) {
        return false;
      }
      try {
        if (desktopScrollbarMedia) return !!desktopScrollbarMedia.matches;
      } catch (_) {}
      return false;
    }
    try {
      document.documentElement.classList.toggle("custom-viewport-scrollbar", shouldUseCustomViewportScrollbar());
    } catch (_) {}

    function initCustomViewportScrollbar(){
      var root = document.documentElement;
      var body = document.body;
      if (!root || !body) return;
      var host = null;
      var track = null;
      var thumb = null;
      var resizeObserver = null;
      var fallbackTimer = 0;
      var dragging = false;
      var dragPointerId = null;
      var dragStartClientY = 0;
      var dragStartThumbOffset = 0;
      var lastMetrics = {
        maxScroll: 0,
        trackHeight: 0,
        thumbHeight: 0,
        maxThumbOffset: 0,
        thumbOffset: 0
      };

      var rafId = 0;
      function ensureHost(){
        if (host && host.isConnected && track && track.isConnected && thumb && thumb.isConnected) return true;
        host = document.getElementById("appViewportScrollbar");
        if (!host) {
          host = document.createElement("div");
          host.id = "appViewportScrollbar";
          host.className = "app-viewport-scrollbar";
          host.setAttribute("aria-hidden", "true");
          host.innerHTML = '<div class="app-viewport-scrollbar__track"><div class="app-viewport-scrollbar__thumb"></div></div>';
          body.appendChild(host);
        }
        track = host.querySelector(".app-viewport-scrollbar__track");
        thumb = host.querySelector(".app-viewport-scrollbar__thumb");
        if (!host.__viewportScrollbarBound && track && thumb) {
          host.__viewportScrollbarBound = true;
          track.addEventListener("pointerdown", function(event){
            if (!shouldUseCustomViewportScrollbar()) return;
            if (!event || event.button !== 0) return;
            if (event.target === thumb) return;
            event.preventDefault();
            update();
            var rect = track.getBoundingClientRect();
            var clickOffset = event.clientY - rect.top - (lastMetrics.thumbHeight / 2);
            scrollToThumbOffset(clickOffset, { smooth: true });
          });
          thumb.addEventListener("pointerdown", function(event){
            if (!shouldUseCustomViewportScrollbar()) return;
            if (!event || event.button !== 0) return;
            event.preventDefault();
            update();
            dragging = true;
            dragPointerId = event.pointerId;
            dragStartClientY = event.clientY;
            dragStartThumbOffset = lastMetrics.thumbOffset || 0;
            host.classList.add("is-dragging");
            try { thumb.setPointerCapture(event.pointerId); } catch (_) {}
          });
          thumb.addEventListener("pointermove", function(event){
            if (!dragging) return;
            if (dragPointerId != null && event.pointerId !== dragPointerId) return;
            event.preventDefault();
            var deltaY = event.clientY - dragStartClientY;
            scrollToThumbOffset(dragStartThumbOffset + deltaY, { smooth: false });
          });
          function finishDrag(event){
            if (!dragging) return;
            if (event && dragPointerId != null && event.pointerId !== dragPointerId) return;
            dragging = false;
            dragPointerId = null;
            host.classList.remove("is-dragging");
            try { if (thumb) thumb.releasePointerCapture(event.pointerId); } catch (_) {}
            update();
          }
          thumb.addEventListener("pointerup", finishDrag);
          thumb.addEventListener("pointercancel", finishDrag);
          thumb.addEventListener("lostpointercapture", finishDrag);
        }
        return !!(track && thumb);
      }
      function applyMode(active){
        try { root.classList.toggle("custom-viewport-scrollbar", !!active); } catch (_) {}
        if (!host) return;
        host.classList.toggle("is-disabled", !active);
        if (!active) host.classList.add("is-hidden");
      }
      function scheduleUpdate(){
        if (rafId) return;
        rafId = window.requestAnimationFrame(function(){
          rafId = 0;
          update();
        });
      }
      function syncNow(){
        update();
      }
      function ensureLiveSync(){
        return;
      }
      function scrollToThumbOffset(offset, options){
        options = options && typeof options === "object" ? options : {};
        var smooth = options.smooth === true;
        var scroller = document.scrollingElement || root;
        var maxThumbOffset = Math.max(Number(lastMetrics.maxThumbOffset || 0), 0);
        var clampedOffset = Math.max(0, Math.min(maxThumbOffset, Number(offset) || 0));
        var ratio = maxThumbOffset > 0 ? (clampedOffset / maxThumbOffset) : 0;
        var nextScrollTop = ratio * Math.max(Number(lastMetrics.maxScroll || 0), 0);
        if (Math.abs(clampedOffset - maxThumbOffset) <= 1) nextScrollTop = Math.max(Number(lastMetrics.maxScroll || 0), 0);
        if (clampedOffset <= 1) nextScrollTop = 0;
        if (smooth) {
          try {
            if (scroller && typeof scroller.scrollTo === "function") {
              scroller.scrollTo({ top: nextScrollTop, behavior: "smooth" });
            } else {
              window.scrollTo({ top: nextScrollTop, behavior: "smooth" });
            }
          } catch (_) {
            try { window.scrollTo(0, nextScrollTop); } catch (__){}
          }
          scheduleUpdate();
          return;
        }
        var prevRootScrollBehavior = "";
        var prevBodyScrollBehavior = "";
        try {
          prevRootScrollBehavior = String(root.style.scrollBehavior || "");
          root.style.scrollBehavior = "auto";
        } catch (_) {}
        try {
          prevBodyScrollBehavior = String(body.style.scrollBehavior || "");
          body.style.scrollBehavior = "auto";
        } catch (_) {}
        try { if (scroller) scroller.scrollTop = nextScrollTop; } catch (_) {}
        try { root.scrollTop = nextScrollTop; } catch (_) {}
        try { body.scrollTop = nextScrollTop; } catch (_) {}
        try {
          var currentTop = 0;
          try {
            currentTop = Math.max(
              Number(scroller && scroller.scrollTop || 0) || 0,
              Number(root.scrollTop || 0) || 0,
              Number(body.scrollTop || 0) || 0,
              Number(window.pageYOffset || 0) || 0
            );
          } catch (_) { currentTop = 0; }
          if (Math.abs(currentTop - nextScrollTop) > 1) window.scrollTo(0, nextScrollTop);
        } catch (_) {}
        try { root.style.scrollBehavior = prevRootScrollBehavior; } catch (_) {}
        try { body.style.scrollBehavior = prevBodyScrollBehavior; } catch (_) {}
        if (thumb) {
          thumb.style.top = clampedOffset + "px";
          thumb.style.transform = "none";
        }
        update();
      }

      function update(){
        var active = shouldUseCustomViewportScrollbar();
        if (active && !ensureHost()) return;
        applyMode(active);
        if (!active || !host || !thumb) return;
        var scroller = document.scrollingElement || root;
        var viewportHeight = Math.max(
          scroller && scroller.clientHeight ? scroller.clientHeight : 0,
          root.clientHeight || 0,
          window.innerHeight || 0
        );
        var scrollHeight = Math.max(
          scroller && scroller.scrollHeight ? scroller.scrollHeight : 0,
          viewportHeight
        );
        var scrollTop = 0;
        try {
          scrollTop = Math.max(
            Number(scroller && scroller.scrollTop || 0) || 0,
            Number(root.scrollTop || 0) || 0,
            Number(body.scrollTop || 0) || 0,
            Number(window.pageYOffset || 0) || 0
          );
        } catch (_) {
          scrollTop = 0;
        }

        var maxScroll = Math.max(scrollHeight - viewportHeight, 0);
        var trackHeight = Math.max((track && track.clientHeight) || host.clientHeight || (viewportHeight - 8), 24);
        var thumbHeight = maxScroll > 0
          ? Math.max((viewportHeight / Math.max(scrollHeight, 1)) * trackHeight, 28)
          : Math.max(trackHeight - 2, 28);
        thumbHeight = Math.min(thumbHeight, trackHeight);

        var maxThumbOffset = Math.max(trackHeight - thumbHeight, 0);
        if (scrollTop >= (maxScroll - 1)) scrollTop = maxScroll;
        if (scrollTop <= 1) scrollTop = 0;
        var ratio = maxScroll > 0 ? (scrollTop / maxScroll) : 0;
        var thumbOffset = Math.max(0, Math.min(maxThumbOffset, maxThumbOffset * ratio));
        lastMetrics.maxScroll = maxScroll;
        lastMetrics.trackHeight = trackHeight;
        lastMetrics.thumbHeight = thumbHeight;
        lastMetrics.maxThumbOffset = maxThumbOffset;
        lastMetrics.thumbOffset = thumbOffset;

        thumb.style.height = thumbHeight + "px";
        thumb.style.top = thumbOffset + "px";
        thumb.style.transform = "none";
        host.classList.toggle("is-static", maxScroll <= 0);
        host.classList.toggle("is-hidden", viewportHeight <= 0 || trackHeight <= 0);
      }

      window.addEventListener("scroll", syncNow, { passive: true });
      document.addEventListener("scroll", syncNow, { passive: true, capture: true });
      window.addEventListener("wheel", syncNow, { passive: true });
      window.addEventListener("pointermove", function(){
        if (!dragging) return;
        update();
      }, { passive: true });
      window.addEventListener("resize", scheduleUpdate, { passive: true });
      window.addEventListener("load", scheduleUpdate, { once: true });
      window.addEventListener("hashchange", function(){
        syncNow();
        setTimeout(syncNow, 30);
        setTimeout(syncNow, 140);
      }, { passive: true });
      document.addEventListener("readystatechange", scheduleUpdate);
      if (window.visualViewport && typeof window.visualViewport.addEventListener === "function") {
        window.visualViewport.addEventListener("resize", scheduleUpdate, { passive: true });
        window.visualViewport.addEventListener("scroll", syncNow, { passive: true });
      }
      if (desktopScrollbarMedia) {
        try {
          if (typeof desktopScrollbarMedia.addEventListener === "function") {
            desktopScrollbarMedia.addEventListener("change", syncNow);
          } else if (typeof desktopScrollbarMedia.addListener === "function") {
            desktopScrollbarMedia.addListener(syncNow);
          }
        } catch (_) {}
      }

      if (typeof ResizeObserver === "function") {
        resizeObserver = new ResizeObserver(function(){ scheduleUpdate(); });
        try { resizeObserver.observe(root); } catch (_) {}
        try { resizeObserver.observe(body); } catch (_) {}
      } else {
        fallbackTimer = window.setInterval(scheduleUpdate, 250);
      }

      syncNow();
      setTimeout(syncNow, 32);
      setTimeout(syncNow, 96);
      setTimeout(syncNow, 220);
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", initCustomViewportScrollbar, { once: true });
    } else {
      initCustomViewportScrollbar();
    }
  })();

;
/* index.html inline script moved from line 1461. */
(function () {
    function normalizeThemeMode(value) {
      var text = String(value || '').trim().toLowerCase();
      return text === 'dark' || text === 'light' ? text : '';
    }
    function readCachedDefaultThemeMode() {
      try {
        var cachedThemeRaw = localStorage.getItem('site:theme:v1');
        if (!cachedThemeRaw) return '';
        var cachedTheme = JSON.parse(cachedThemeRaw) || {};
        return normalizeThemeMode(
          cachedTheme.defaultMode ||
          cachedTheme.default_mode ||
          cachedTheme.defaultThemeMode ||
          cachedTheme.default_theme_mode
        );
      } catch (_) {}
      return '';
    }
    var theme = 'dark';
    try {
      var t = localStorage.getItem('theme');
      t = normalizeThemeMode(t) || readCachedDefaultThemeMode() || 'dark';
      theme = t;
    } catch (e) { theme = 'dark'; }

    var root = document.documentElement;
    root.setAttribute('data-theme', theme);

    var metaCS = document.querySelector('meta[name="color-scheme"]');
    if (!metaCS) { metaCS = document.createElement('meta'); metaCS.name = 'color-scheme'; document.head.appendChild(metaCS); }
    metaCS.setAttribute('content', theme === 'dark' ? 'dark light' : 'light dark');

    var metaTC = document.querySelector('meta[name="theme-color"]');
    if (!metaTC) { metaTC = document.createElement('meta'); metaTC.name = 'theme-color'; document.head.appendChild(metaTC); }
    metaTC.setAttribute('content', theme === 'dark' ? '#0C0C0C' : '#DCDCDC');

    var cs = document.getElementById('critical-theme');
    if (cs) {
      cs.textContent = cs.textContent.replace(
        /color-scheme:\s*(dark|light)\s*;/,
        'color-scheme:' + (theme === 'dark' ? 'dark' : 'light') + ';'
      );
    }
  })();

;
/* index.html inline script moved from line 1509. */
(function(){
    var DEFAULT_SITE_THEME_COLOR = '#64748b';
    var LEGACY_DYNAMIC_ACCENT_FALLBACK_COLORS = {
      '#5c5ebf': true,
      '#7a7cd0': true,
      '#414391': true,
      '#3b3e8c': true,
      '#969cff': true,
      '#7076eb': true,
      '#4f55cd': true,
      '#9c9ede': true,
      '#b9bbef': true,
      '#cbd5ff': true,
      '#cfc6ff': true,
      '#dbe4ff': true,
      '#c4b5fd': true,
      '#c7d2fe': true,
      '#a5b4fc': true,
      '#6366f1': true,
      '#8b5cf6': true
    };
    var SITE_THEME_PRESET_COLORS = {
      snow: '#5c5ebf',
      winter: '#5c5ebf',
      'ثلج': '#5c5ebf',
      ramadan: '#3a936f',
      'رمضان': '#3a936f',
      eid: '#f59e0b',
      'عيد': '#f59e0b',
      fall: '#c97a22',
      autumn: '#c97a22',
      'خريف': '#c97a22'
    };
    function normHex(value){
      var raw = String(value || '').trim();
      if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw.toLowerCase();
      if (/^#[0-9a-fA-F]{3}$/.test(raw)) {
        return ('#' + raw[1] + raw[1] + raw[2] + raw[2] + raw[3] + raw[3]).toLowerCase();
      }
      var compact = raw.toLowerCase().replace(/[^0-9a-f]/g, '');
      if (/^[0-9a-f]{6}$/.test(compact)) return ('#' + compact);
      if (/^[0-9a-f]{3}$/.test(compact)) {
        return ('#' + compact[0] + compact[0] + compact[1] + compact[1] + compact[2] + compact[2]).toLowerCase();
      }
      return '';
    }
    function resolveThemePresetColor(name){
      var key = String(name || '').trim().toLowerCase();
      if (!key) return '';
      return normHex(SITE_THEME_PRESET_COLORS[key] || '');
    }
    function isLegacyThemeFallback(cached){
      var src = cached && typeof cached === 'object' ? cached : {};
      var name = String(src.name || src.theme || src.themeName || src.theme_name || '').trim();
      var color = normHex(src.color || src.accent || src.primary || '');
      var balance = normHex(
        src.textColorLight ||
        src.text_color_light ||
        src.textColorDark ||
        src.text_color_dark ||
        src.textColor ||
        src.text_color ||
        src.balanceColorLight ||
        src.balance_color_light ||
        src.balanceTextLight ||
        src.balance_text_light ||
        src.balanceColorDark ||
        src.balance_color_dark ||
        src.balanceTextDark ||
        src.balance_text_dark ||
        src.balanceColor ||
        src.balance_color ||
        ''
      );
      return !name && color === '#64748b' && !balance;
    }
    function hexToRgb(hex){
      var clean = normHex(hex);
      if (!clean) return null;
      return {
        r: parseInt(clean.slice(1, 3), 16),
        g: parseInt(clean.slice(3, 5), 16),
        b: parseInt(clean.slice(5, 7), 16)
      };
    }
    function mix(baseHex, targetHex, ratio){
      var base = hexToRgb(baseHex);
      var target = hexToRgb(targetHex);
      if (!base || !target) return baseHex;
      var t = Math.max(0, Math.min(1, Number(ratio) || 0));
      var r = Math.round(base.r + (target.r - base.r) * t);
      var g = Math.round(base.g + (target.g - base.g) * t);
      var b = Math.round(base.b + (target.b - base.b) * t);
      return '#' + [r, g, b].map(function(v){ return v.toString(16).padStart(2, '0'); }).join('');
    }
    function channelToLinear(v){
      var n = Math.max(0, Math.min(255, Number(v) || 0)) / 255;
      return n <= 0.03928 ? (n / 12.92) : Math.pow((n + 0.055) / 1.055, 2.4);
    }
    function luminance(rgb){
      if (!rgb) return 0;
      var r = channelToLinear(rgb.r);
      var g = channelToLinear(rgb.g);
      var b = channelToLinear(rgb.b);
      return (0.2126 * r) + (0.7152 * g) + (0.0722 * b);
    }
    function sanitizeAccent(baseHex){
      var clean = normHex(baseHex);
      return clean || '';
    }
    function normalizeGridCount(raw, fallback, min, max){
      var value = parseInt(raw, 10);
      var safeFallback = parseInt(fallback, 10);
      var safeMin = parseInt(min, 10);
      var safeMax = parseInt(max, 10);
      if (!isFinite(safeFallback)) safeFallback = 1;
      if (!isFinite(safeMin)) safeMin = 1;
      if (!isFinite(safeMax)) safeMax = safeFallback;
      if (!isFinite(value)) value = safeFallback;
      if (value < safeMin) value = safeMin;
      if (value > safeMax) value = safeMax;
      return value;
    }
    function normalizeImageShape(raw, fallback){
      var safeFallback = String(fallback || '1/1').trim() || '1/1';
      var text = String(raw == null ? '' : raw).trim().toLowerCase();
      if (!text) return safeFallback;
      text = text.replace(/\s+/g, '');
      if (text === 'square' || text === '1:1' || text === '1/1') return '1/1';
      if (text === 'portrait' || text === '3:4' || text === '3/4') return '3/4';
      if (text === 'landscape' || text === '4:3' || text === '4/3') return '4/3';
      return safeFallback;
    }
    function normalizeImageCorners(raw, fallback){
      function parseValue(rawValue, rawFallback){
        var text = String(rawValue == null ? '' : rawValue).trim().toLowerCase();
        if (!text) {
          return rawFallback === undefined ? null : parseValue(rawFallback, undefined);
        }
        if (text === 'none' || text === 'off' || text === 'flat' || text === 'square' || text === '0') {
          return 'none';
        }
        text = text
          .replace(/top[-_ ]left/g, 'tl')
          .replace(/top[-_ ]right/g, 'tr')
          .replace(/bottom[-_ ]right/g, 'br')
          .replace(/bottom[-_ ]left/g, 'bl')
          .replace(/left[-_ ]top/g, 'tl')
          .replace(/right[-_ ]top/g, 'tr')
          .replace(/right[-_ ]bottom/g, 'br')
          .replace(/left[-_ ]bottom/g, 'bl');
        if (text === 'all' || text === 'full' || text === 'rounded') return 'tl,tr,br,bl';
        if (text === 'top' || text === 'toponly' || text === 'upper') return 'tl,tr';
        if (text === 'bottom' || text === 'bottomonly' || text === 'lower') return 'br,bl';
        var active = {};
        text.split(/[^a-z]+/g).forEach(function(token){
          if (token === 'tl' || token === 'tr' || token === 'br' || token === 'bl') active[token] = true;
        });
        var ordered = ['tl', 'tr', 'br', 'bl'].filter(function(token){ return !!active[token]; });
        if (!ordered.length) {
          return rawFallback === undefined ? 'tl,tr' : parseValue(rawFallback, undefined);
        }
        return ordered.join(',');
      }
      return parseValue(raw, fallback);
    }
    function normalizeTitleSize(raw, fallback){
      function parseValue(value){
        if (typeof value === 'number') return value;
        var text = String(value == null ? '' : value).trim().toLowerCase();
        if (!text) return NaN;
        if (/^-?\d+(?:\.\d+)?rem$/.test(text)) return parseFloat(text) * 16;
        return parseFloat(text);
      }
      var parsed = parseValue(raw);
      var fallbackValue = parseValue(fallback);
      var resolved = isFinite(parsed) ? parsed : (isFinite(fallbackValue) ? fallbackValue : 15);
      return Math.max(12, Math.min(40, Math.round(resolved)));
    }
    function buildCornerRadiusValue(mask, radiusPx){
      var normalizedMask = normalizeImageCorners(mask, 'tl,tr');
      var active = normalizedMask === 'none'
        ? []
        : normalizedMask.split(',').map(function(token){ return String(token || '').trim(); }).filter(Boolean);
      var activeMap = {};
      active.forEach(function(token){ activeMap[token] = true; });
      var safeRadius = Math.max(0, Math.min(48, Math.round(Number(radiusPx) || 18)));
      return [
        activeMap.tl ? (safeRadius + 'px') : '0px',
        activeMap.tr ? (safeRadius + 'px') : '0px',
        activeMap.br ? (safeRadius + 'px') : '0px',
        activeMap.bl ? (safeRadius + 'px') : '0px'
      ].join(' ');
    }
    try {
      var cachedRaw = localStorage.getItem('site:theme:v1');
      var cached = cachedRaw ? (JSON.parse(cachedRaw) || {}) : {};
      var cachedColor =
        cached.siteMainColor ||
        cached.site_main_color ||
        cached.siteAccentColor ||
        cached.site_accent_color ||
        cached.themeColor ||
        cached.theme_color ||
        cached.mainColor ||
        cached.main_color ||
        cached.primaryColor ||
        cached.primary_color ||
        cached.accentColor ||
        cached.accent_color ||
        cached.brandColor ||
        cached.brand_color ||
        cached.color ||
        cached.accent ||
        cached.primary ||
        '';
      if (isLegacyThemeFallback(cached)) cachedColor = '';
      var base = sanitizeAccent(cachedColor || '');
      var sharedTextColor = normHex(
        cached.textColor ||
        cached.text_color ||
        cached.balanceColor ||
        cached.balance_color ||
        cached.balanceTextColor ||
        cached.balance_text_color ||
        ''
      );
      var balanceTextLight = normHex(
        cached.textColorLight ||
        cached.text_color_light ||
        cached.textLightColor ||
        cached.text_light_color ||
        cached.balanceColorLight ||
        cached.balance_color_light ||
        cached.balanceTextLight ||
        cached.balance_text_light ||
        cached.balanceColor ||
        cached.balance_color ||
        sharedTextColor ||
        ''
      );
      var balanceTextDark = normHex(
        cached.textColorDark ||
        cached.text_color_dark ||
        cached.textDarkColor ||
        cached.text_dark_color ||
        cached.balanceColorDark ||
        cached.balance_color_dark ||
        cached.balanceTextDark ||
        cached.balance_text_dark ||
        cached.balanceColor ||
        cached.balance_color ||
        sharedTextColor ||
        ''
      );
      var categoryGridDesktop = normalizeGridCount(
        cached.categoryGridDesktop ||
        cached.category_grid_desktop ||
        cached.categoryCardsDesktop ||
        cached.category_cards_desktop ||
        cached.categoriesDesktop ||
        cached.categories_desktop ||
        5,
        5,
        2,
        6
      );
      var categoryGridMobile = normalizeGridCount(
        cached.categoryGridMobile ||
        cached.category_grid_mobile ||
        cached.categoryCardsMobile ||
        cached.category_cards_mobile ||
        cached.categoriesMobile ||
        cached.categories_mobile ||
        3,
        3,
        1,
        4
      );
      var productGridDesktop = normalizeGridCount(
        cached.productGridDesktop ||
        cached.product_grid_desktop ||
        cached.productCardsDesktop ||
        cached.product_cards_desktop ||
        cached.productsDesktop ||
        cached.products_desktop ||
        5,
        5,
        2,
        6
      );
      var productGridMobile = normalizeGridCount(
        cached.productGridMobile ||
        cached.product_grid_mobile ||
        cached.productCardsMobile ||
        cached.product_cards_mobile ||
        cached.productsMobile ||
        cached.products_mobile ||
        3,
        3,
        1,
        4
      );
      var categoryImageShape = normalizeImageShape(
        cached.categoryImageShape ||
        cached.category_image_shape ||
        cached.categoryCardShape ||
        cached.category_card_shape ||
        '1/1',
        '1/1'
      );
      var categoryImageCorners = normalizeImageCorners(
        cached.categoryImageCorners ||
        cached.category_image_corners ||
        cached.categoryCardCorners ||
        cached.category_card_corners ||
        'tl,tr',
        'tl,tr'
      );
      var categoryTitleSize = normalizeTitleSize(
        cached.categoryTitleSize ||
        cached.category_title_size ||
        cached.categoryCardTitleSize ||
        cached.category_card_title_size ||
        15,
        15
      );
      var productImageShape = normalizeImageShape(
        cached.productImageShape ||
        cached.product_image_shape ||
        cached.productCardShape ||
        cached.product_card_shape ||
        '1/1',
        '1/1'
      );
      var productImageCorners = normalizeImageCorners(
        cached.productImageCorners ||
        cached.product_image_corners ||
        cached.productCardCorners ||
        cached.product_card_corners ||
        'tl,tr',
        'tl,tr'
      );
      var productTitleSize = normalizeTitleSize(
        cached.productTitleSize ||
        cached.product_title_size ||
        cached.productCardTitleSize ||
        cached.product_card_title_size ||
        15,
        15
      );
      var rgb = hexToRgb(base);
      if (!rgb) return;
      var strong = mix(base, '#000000', 0.18);
      var deeper = mix(base, '#000000', 0.32);
      var light = mix(base, '#ffffff', 0.62);
      var surface = mix(base, '#000000', 0.88);
      var surfaceAlt = mix(base, '#000000', 0.82);
      var root = document.documentElement;
      if (!root || !root.style) return;
      root.style.setProperty('--accent-theme', base);
      root.style.setProperty('--primary', base);
      root.style.setProperty('--primary-2', strong);
      root.style.setProperty('--primary-dark', deeper);
      root.style.setProperty('--primary-light', light);
      root.style.setProperty('--site-accent-rgb', rgb.r + ', ' + rgb.g + ', ' + rgb.b);
      root.style.setProperty('--site-accent-runtime', base);
      root.style.setProperty('--site-accent-runtime-strong', strong);
      root.style.setProperty('--site-accent-runtime-deep', deeper);
      root.style.setProperty('--site-accent-runtime-light', light);
      root.style.setProperty('--site-accent-runtime-surface', surface);
      root.style.setProperty('--site-accent-runtime-surface-alt', surfaceAlt);
      root.style.setProperty('--site-accent-runtime-soft', 'rgba(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ', .18)');
      root.style.setProperty('--site-accent-runtime-soft-2', 'rgba(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ', .35)');
      root.style.setProperty('--site-accent-runtime-shadow', 'rgba(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ', .26)');
      root.style.setProperty('--site-accent-runtime-focus', 'rgba(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ', .32)');
      root.style.setProperty('--site-category-grid-desktop', String(categoryGridDesktop));
      root.style.setProperty('--site-category-grid-mobile', String(categoryGridMobile));
      root.style.setProperty('--site-category-image-shape', String(categoryImageShape));
      root.style.setProperty('--site-category-image-radius', String(buildCornerRadiusValue(categoryImageCorners, 18)));
      root.style.setProperty('--site-category-title-size', String(categoryTitleSize) + 'px');
      root.style.setProperty('--site-product-grid-desktop', String(productGridDesktop));
      root.style.setProperty('--site-product-grid-mobile', String(productGridMobile));
      root.style.setProperty('--site-product-image-shape', String(productImageShape));
      root.style.setProperty('--site-product-image-radius', String(buildCornerRadiusValue(productImageCorners, 18)));
      root.style.setProperty('--site-product-title-size', String(productTitleSize) + 'px');
      function applyLayoutGridVarsFromSource(source){
        if (!source || typeof source !== 'object' || !root || !root.style) return;
        var themeSource = source;
        if (themeSource.siteState && typeof themeSource.siteState === 'object' && !themeSource.levels) {
          themeSource = themeSource.siteState;
        }
        if (themeSource.theme && typeof themeSource.theme === 'object') {
          themeSource = themeSource.theme;
        } else if (themeSource.siteTheme && typeof themeSource.siteTheme === 'object') {
          themeSource = themeSource.siteTheme;
        }
        root.style.setProperty('--site-category-grid-desktop', String(normalizeGridCount(
          themeSource.categoryGridDesktop ||
          themeSource.category_grid_desktop ||
          themeSource.categoryCardsDesktop ||
          themeSource.category_cards_desktop ||
          themeSource.categoriesDesktop ||
          themeSource.categories_desktop ||
          categoryGridDesktop,
          categoryGridDesktop,
          2,
          6
        )));
        root.style.setProperty('--site-category-grid-mobile', String(normalizeGridCount(
          themeSource.categoryGridMobile ||
          themeSource.category_grid_mobile ||
          themeSource.categoryCardsMobile ||
          themeSource.category_cards_mobile ||
          themeSource.categoriesMobile ||
          themeSource.categories_mobile ||
          categoryGridMobile,
          categoryGridMobile,
          1,
          4
        )));
        root.style.setProperty('--site-category-image-shape', String(normalizeImageShape(
          themeSource.categoryImageShape ||
          themeSource.category_image_shape ||
          themeSource.categoryCardShape ||
          themeSource.category_card_shape ||
          categoryImageShape,
          categoryImageShape
        )));
        root.style.setProperty('--site-category-image-radius', String(buildCornerRadiusValue(
          normalizeImageCorners(
            themeSource.categoryImageCorners ||
            themeSource.category_image_corners ||
            themeSource.categoryCardCorners ||
            themeSource.category_card_corners ||
            categoryImageCorners,
            categoryImageCorners
          ),
          18
        )));
        root.style.setProperty('--site-category-title-size', String(normalizeTitleSize(
          themeSource.categoryTitleSize ||
          themeSource.category_title_size ||
          themeSource.categoryCardTitleSize ||
          themeSource.category_card_title_size ||
          categoryTitleSize,
          categoryTitleSize
        )) + 'px');
        root.style.setProperty('--site-product-grid-desktop', String(normalizeGridCount(
          themeSource.productGridDesktop ||
          themeSource.product_grid_desktop ||
          themeSource.productCardsDesktop ||
          themeSource.product_cards_desktop ||
          themeSource.productsDesktop ||
          themeSource.products_desktop ||
          productGridDesktop,
          productGridDesktop,
          2,
          6
        )));
        root.style.setProperty('--site-product-grid-mobile', String(normalizeGridCount(
          themeSource.productGridMobile ||
          themeSource.product_grid_mobile ||
          themeSource.productCardsMobile ||
          themeSource.product_cards_mobile ||
          themeSource.productsMobile ||
          themeSource.products_mobile ||
          productGridMobile,
          productGridMobile,
          1,
          4
        )));
        root.style.setProperty('--site-product-image-shape', String(normalizeImageShape(
          themeSource.productImageShape ||
          themeSource.product_image_shape ||
          themeSource.productCardShape ||
          themeSource.product_card_shape ||
          productImageShape,
          productImageShape
        )));
        root.style.setProperty('--site-product-image-radius', String(buildCornerRadiusValue(
          normalizeImageCorners(
            themeSource.productImageCorners ||
            themeSource.product_image_corners ||
            themeSource.productCardCorners ||
            themeSource.product_card_corners ||
            productImageCorners,
            productImageCorners
          ),
          18
        )));
        root.style.setProperty('--site-product-title-size', String(normalizeTitleSize(
          themeSource.productTitleSize ||
          themeSource.product_title_size ||
          themeSource.productCardTitleSize ||
          themeSource.product_card_title_size ||
          productTitleSize,
          productTitleSize
        )) + 'px');
      }
      try {
        var runtimeThemeSource = (typeof window.__getResolvedSiteStateData === 'function')
          ? window.__getResolvedSiteStateData()
          : window.__SITE_STATE_DATA__;
        applyLayoutGridVarsFromSource(runtimeThemeSource);
      } catch(_){}
      try {
        window.addEventListener('site-state-updated', function(){
          try {
            var nextThemeSource = (typeof window.__getResolvedSiteStateData === 'function')
              ? window.__getResolvedSiteStateData()
              : window.__SITE_STATE_DATA__;
            applyLayoutGridVarsFromSource(nextThemeSource);
          } catch(_){}
        });
      } catch(_){}
      if (balanceTextLight) {
        root.style.setProperty('--site-text-light', balanceTextLight);
        root.style.setProperty('--site-muted-light', balanceTextLight);
        root.style.setProperty('--balance-text-light', balanceTextLight);
        root.style.setProperty('--balance-currency-light', balanceTextLight);
      }
      if (balanceTextDark) {
        root.style.setProperty('--site-text-dark', balanceTextDark);
        root.style.setProperty('--site-muted-dark', balanceTextDark);
        root.style.setProperty('--balance-text-dark', balanceTextDark);
        root.style.setProperty('--balance-currency-dark', balanceTextDark);
      }
    } catch (_) {}
  })();

;
/* index.html inline script moved from line 2061. */
(function(){
      try {
        var loaderStartedAt = Number(sessionStorage.getItem('nav:loader:showAt') || 0) || 0;
        var staleLoader = !loaderStartedAt || (Date.now() - loaderStartedAt) > 2200;
        if (staleLoader) {
          sessionStorage.removeItem('nav:loader:expected');
          sessionStorage.removeItem('nav:loader:showAt');
        }
      } catch (_) {}
    })();

;
/* index.html inline script moved from line 2074. */
(function(){
      if (window.__getSiteWorkerBaseDefault && window.__getSiteWorkerBase) return;
      function readSetting(path, fallback){
        try {
          if (typeof window.__getSiteSetting === "function") {
            var value = window.__getSiteSetting(path, fallback);
            return value == null ? fallback : value;
          }
        } catch (_) {}
        return fallback;
      }
      var workerSettings = (function(){
        try {
          if (typeof window.__getSiteWorkersConfig === "function") return window.__getSiteWorkersConfig() || {};
        } catch (_) {}
        try { return readSetting("workers", {}) || {}; } catch (_) { return {}; }
      })();
      var API_BASE = String(workerSettings.routerBase || "").trim();
      var routerHostAliases = Array.isArray(workerSettings.routerHostAliases)
        ? workerSettings.routerHostAliases.map(function(host){ return String(host || "").trim().toLowerCase(); }).filter(Boolean)
        : [];
      var canonicalApiHost = (function(){
        try { return API_BASE ? new URL(/^https?:\/\//i.test(API_BASE) ? API_BASE : ("https://" + API_BASE)).hostname.toLowerCase() : ""; }
        catch (_) { return ""; }
      })();
      function normalizeBase(value){
        var raw = String(value == null ? "" : value).trim();
        if (!raw) return "";
        try {
          var candidate = /^https?:\/\//i.test(raw) ? raw : ("https://" + raw);
          var parsed = new URL(candidate);
          if (!/^https?:$/i.test(parsed.protocol)) return "";
          var host = String(parsed.hostname || "").trim().toLowerCase();
          if (canonicalApiHost && routerHostAliases.indexOf(host) !== -1) host = canonicalApiHost;
          if (canonicalApiHost && /^api\./i.test(host) && host !== canonicalApiHost && /\.(?:shop|store)$/i.test(host)) host = canonicalApiHost;
          var path = String(parsed.pathname || "").replace(/\/+$/, "");
          return parsed.protocol + "//" + host + (parsed.port ? (":" + parsed.port) : "") + (path && path !== "/" ? path : "");
        } catch (_) {
          return /^https?:\/\//i.test(raw) ? raw.replace(/\/+$/, "") : "";
        }
      }
      if (!window.__normalizeSiteWorkerBase) window.__normalizeSiteWorkerBase = normalizeBase;
      if (!window.__getSiteWorkerBaseDefault) {
        window.__getSiteWorkerBaseDefault = function(options){
          var base = normalizeBase(API_BASE);
          return options && options.trailingSlash && base ? (base + "/") : base;
        };
      }
      if (!window.__getSiteWorkerBase) {
        window.__getSiteWorkerBase = function(options){
          var opts = options || {};
          var base = "";
          if (opts.allowStorageOverride === true) {
            [workerSettings.routerBaseStorageKey, workerSettings.legacyWorkerStorageKey].some(function(key){
              if (!key) return false;
              try { base = normalizeBase(localStorage.getItem(key)); } catch (_) { base = ""; }
              return !!base;
            });
          }
          base = base || window.__getSiteWorkerBaseDefault({ trailingSlash: false });
          return opts.trailingSlash && base ? (base + "/") : base;
        };
      }
    })();

;
