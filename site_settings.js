(function (global) {
  "use strict";

  var defaultSettings = {
    "firebase": {},
    "workers": {
        "routerBase": "",
        "routerBaseStorageKey": "MANWAL_ROUTER_BASE",
        "legacyWorkerStorageKey": "edaa:worker",
        "routerHostAliases": [],
        "authAction": "auth"
    },
    "auth": {
        "googleRedirectOrigin": "",
        "googleRedirectPath": "/__/auth/handler",
        "googleRedirectUri": "",
        "firebaseHelperOrigin": ""
    },
    "brand": {
        "storeName": "Njad store",
        "tickerText": "",
        "waBadgeBrand": ""
    },
    "media": {
        "siteIcon": "",
        "sitePreview": ""
    },
    "pwa": {
        "legacyCachePrefixes": [
            "static-",
            "images-",
            "pages-"
        ]
    }
};

  function isPlainObject(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
  }

  function clone(value) {
    if (Array.isArray(value)) return value.slice();
    if (!isPlainObject(value)) return value;
    var out = {};
    Object.keys(value).forEach(function (key) {
      out[key] = clone(value[key]);
    });
    return out;
  }

  function merge(base, extra) {
    var out = clone(isPlainObject(base) ? base : {});
    if (!isPlainObject(extra)) return out;
    Object.keys(extra).forEach(function (key) {
      var nextValue = extra[key];
      if (isPlainObject(out[key]) && isPlainObject(nextValue)) {
        out[key] = merge(out[key], nextValue);
        return;
      }
      if (nextValue !== undefined) out[key] = clone(nextValue);
    });
    return out;
  }

  function getByPath(source, path, fallback) {
    var parts = String(path || "").split(".").filter(Boolean);
    var cursor = source;
    for (var i = 0; i < parts.length; i += 1) {
      if (!cursor || typeof cursor !== "object" || !(parts[i] in cursor)) return fallback;
      cursor = cursor[parts[i]];
    }
    return cursor === undefined ? fallback : clone(cursor);
  }

  var settings = merge(defaultSettings, isPlainObject(global.__SITE_SETTINGS__) ? global.__SITE_SETTINGS__ : {});
  var runtimeDefaults = {
    firebase: clone(settings.firebase || {}),
    workers: clone(settings.workers || {}),
    brand: clone(settings.brand || {})
  };

  global.__SITE_SETTINGS__ = settings;
  global.__SITE_CORE_DEFAULT_RUNTIME__ = runtimeDefaults;
  global.__FIREBASE_RUNTIME_CONFIG__ = clone(settings.firebase || {});
  global.__FIREBASE_CONFIG__ = clone(settings.firebase || {});
  global.__SITE_FIREBASE_HELPER_ORIGIN__ = getByPath(settings, "auth.firebaseHelperOrigin", "");
  global.__SITE_GOOGLE_REDIRECT_ORIGIN__ = getByPath(settings, "auth.googleRedirectOrigin", "");
  global.__SITE_GOOGLE_REDIRECT_URI__ = getByPath(settings, "auth.googleRedirectUri", "");
  global.__SITE_ICON__ = "";
  global.__SITE_SHARE_PREVIEW__ = "";

  global.__getSiteSettings = function () {
    return clone(settings);
  };

  global.__getSiteSetting = function (path, fallback) {
    return getByPath(settings, path, fallback);
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
