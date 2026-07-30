(function(global){
      var SITE_MEDIA_CACHE_KEY = "site:media:v1";
      var DEFAULT_LOADER_LOGO = global.__resolveSiteMediaFallbackUrl
        ? String(global.__resolveSiteMediaFallbackUrl("loader") || "").trim()
        : "";

      function normalizeText(value){
        return String(value == null ? "" : value).trim();
      }

      function resolveAbsoluteUrl(value){
        var text = normalizeText(value);
        if (!text) return "";
        if (/^data:/i.test(text) || /^blob:/i.test(text) || /^[a-z]+:/i.test(text)) return text;
        if (/^\/\//.test(text)) return global.location.protocol + text;
        try {
          if (text.charAt(0) !== "/") {
            text = "/" + text.replace(/^[./\\]+/, "");
          }
          return new URL(text, global.location.origin).href;
        } catch (_) {
          return text;
        }
      }

      function readCachedMediaValue(keys){
        try {
          var raw = global.localStorage && global.localStorage.getItem(SITE_MEDIA_CACHE_KEY);
          if (!raw) return "";
          var parsed = JSON.parse(raw);
          if (!parsed || typeof parsed !== "object") return "";
          var readValue = function(source, path){
            var parts = String(path || "").split(".").filter(Boolean);
            var cursor = source;
            for (var idx = 0; idx < parts.length; idx += 1) {
              if (!cursor || typeof cursor !== "object") return "";
              cursor = cursor[parts[idx]];
            }
            return normalizeText(cursor);
          };
          var list = Array.isArray(keys) ? keys : [];
          for (var i = 0; i < list.length; i += 1) {
            var key = String(list[i] || "").trim();
            if (!key) continue;
            var candidate = readValue(parsed, key);
            if (candidate) return candidate;
          }
          return "";
        } catch (_) {
          return "";
        }
      }

      function readCachedLoaderLogo(){
        return readCachedMediaValue([
          "loaderLogo", "loader_logo", "loaderImage", "loader_image", "preloaderLogo", "preloader_logo", "loader",
          "siteImage", "site_image", "appSettings.siteImage", "appSettings.site_image", "app_settings.siteImage", "app_settings.site_image",
          "siteIcon", "site_icon", "icon", "iconUrl", "icon_url", "favicon", "faviconUrl", "favicon_url",
          "windowIcon", "window_icon", "windowImage", "window_image",
          "headerLogo", "header_logo", "logo", "logoUrl", "logo_url"
        ]);
      }

      function resolveLoaderLogo(overrideLogo){
        var direct = normalizeText(overrideLogo);
        if (direct) return direct;
        try {
          direct = normalizeText(global.__SITE_LOADER_IMAGE__);
          if (direct) return direct;
        } catch (_) {}
        try {
          direct = normalizeText(global.__SITE_ICON__);
          if (direct) return direct;
        } catch (_) {}
        direct = readCachedLoaderLogo();
        if (direct) return direct;
        if (DEFAULT_LOADER_LOGO) return DEFAULT_LOADER_LOGO;
        try {
          return normalizeText(global.__resolveSiteMediaFallbackUrl ? global.__resolveSiteMediaFallbackUrl("loader") : "");
        } catch (_) {
          return "";
        }
      }

      function revokeObjectUrl(target){
        if (!target || !target.__qrPreviewUrl) return;
        try {
          global.URL.revokeObjectURL(target.__qrPreviewUrl);
        } catch (_) {}
        delete target.__qrPreviewUrl;
      }

      function clearQrTarget(target){
        if (!target) return;
        revokeObjectUrl(target);
        delete target.__qrInstance;
        try {
          target.removeAttribute("data-qr-mode");
          target.removeAttribute("data-qr-ready");
        } catch (_) {}
        while (target.firstChild) target.removeChild(target.firstChild);
      }

      function clamp(value, min, max){
        return Math.max(min, Math.min(max, value));
      }

      function getSize(options){
        var raw = Number(options && options.size);
        if (!isFinite(raw)) raw = 220;
        return clamp(Math.round(raw), 120, 1024);
      }

      function waitForQrLogo(target, timeoutMs){
        return new Promise(function(resolve){
          var startedAt = Date.now();
          var maxWait = Math.max(150, Number(timeoutMs) || 0);
          function check(){
            if (!target) {
              resolve(null);
              return;
            }
            var node = null;
            try {
              node = target.querySelector("svg image");
            } catch (_) {
              node = null;
            }
            if (node) {
              resolve(node);
              return;
            }
            if (Date.now() - startedAt >= maxWait) {
              resolve(null);
              return;
            }
            global.setTimeout(check, 24);
          }
          check();
        });
      }

      function applyMonochromeLogoStyle(target){
        return waitForQrLogo(target, 1200).then(function(logoNode){
          if (!logoNode) return false;
          try {
            logoNode.setAttribute("style", "filter: grayscale(1) brightness(0) contrast(1.6); opacity: 1;");
            return true;
          } catch (_) {
            return false;
          }
        });
      }

      async function buildPreviewUrl(instance, target, extension){
        if (!instance || !target || !global.URL || typeof global.URL.createObjectURL !== "function") return "";
        try {
          var blob = await instance.getRawData(extension || "svg");
          if (!blob) return "";
          revokeObjectUrl(target);
          target.__qrPreviewUrl = global.URL.createObjectURL(blob);
          return target.__qrPreviewUrl;
        } catch (_) {
          return "";
        }
      }

      async function renderStyledQrCode(target, data, options){
        var result = { ok: false, url: "", instance: null };
        var QRCodeStylingCtor = global.QRCodeStyling;
        var text = normalizeText(data);
        if (!target) return result;

        clearQrTarget(target);
        if (!text || typeof QRCodeStylingCtor !== "function") return result;

        var size = getSize(options);
        var logo = resolveLoaderLogo(options && options.logo);
        var darkColor = normalizeText(options && options.darkColor) || "#000000";
        var lightColor = normalizeText(options && options.lightColor) || "#ffffff";
        var qr = new QRCodeStylingCtor({
          width: size,
          height: size,
          type: "svg",
          data: text,
          image: resolveAbsoluteUrl(logo),
          margin: 0,
          qrOptions: {
            errorCorrectionLevel: "H"
          },
          imageOptions: {
            hideBackgroundDots: true,
            imageSize: 0.36,
            margin: Math.max(4, Math.round(size * 0.025)),
            saveAsBlob: false
          },
          dotsOptions: {
            color: darkColor,
            type: "dots"
          },
          cornersSquareOptions: {
            color: darkColor,
            type: "extra-rounded"
          },
          cornersDotOptions: {
            color: darkColor,
            type: "dot"
          },
          backgroundOptions: {
            color: lightColor
          }
        });

        qr.append(target);
        target.__qrInstance = qr;
        target.setAttribute("data-qr-mode", "styled");
        target.setAttribute("data-qr-ready", "true");
        await applyMonochromeLogoStyle(target);
        result.ok = true;
        result.instance = qr;
        result.url = await buildPreviewUrl(qr, target, options && options.previewExtension || "svg");
        return result;
      }

      function renderFallbackQrCode(target, src, alt){
        if (!target) return null;
        var imageSrc = normalizeText(src);
        clearQrTarget(target);
        if (!imageSrc) return null;
        var img = document.createElement("img");
        img.src = imageSrc;
        img.alt = normalizeText(alt) || "QR Code";
        img.loading = "lazy";
        img.decoding = "async";
        img.className = "qr-fallback-image";
        target.appendChild(img);
        target.setAttribute("data-qr-mode", "fallback");
        target.setAttribute("data-qr-ready", "true");
        return img;
      }

      global.Za3emQr = {
        clearQrTarget: clearQrTarget,
        resolveLoaderLogo: resolveLoaderLogo,
        renderStyledQrCode: renderStyledQrCode,
        renderFallbackQrCode: renderFallbackQrCode
      };
    })(window);

;
