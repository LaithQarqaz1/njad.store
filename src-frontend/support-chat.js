/* Support chat subsystem — extracted from header.js (2026-07-19). Ships as
   chunk-support.js, loaded on first user interaction or shortly after load
   (see the loader stub in header.js). Top-level header.js declarations stay
   reachable here: classic scripts share one global script scope. */
(function(){
  try {
    if (window.__siteSupportChatMounted) return;
    window.__siteSupportChatMounted = true;

    var supportChatState = {
      open: false,
      loading: false,
      sending: false,
      pollTimer: 0,
      badgePollTimer: 0,
      markReadTimer: 0,
      pollDelayMs: 60000,
      badgePollDelayMs: 60000,
      realtimeUnsubscribe: null,
      realtimeStarting: false,
      realtimeReady: false,
      realtimeDisabled: false,
      realtimeError: '',
      realtimeRunId: 0,
      markReadInFlight: false,
      thread: null,
      imageFile: null,
      lastThreadFetchAt: 0,
      lastThreadVersion: '',
      lastIncomingMessageKey: '',
      lastNotifyAt: 0,
      lastRenderedMessagesVersion: '',
      hasRenderedMessages: false,
      titleBase: '',
      aiTypedMessageKeys: {},
      selectedMessageKeys: []
    };
    var supportChatAuthUser = null;
    var supportChatPageLoaderCount = 0;

    function isSupportChatDocumentVisible(){
      try {
        return !(document && document.hidden);
      } catch (_) {
        return true;
      }
    }

    function isSupportChatActive(){
      return supportChatState.open === true && isSupportChatDocumentVisible();
    }

    function isSupportAiAuthorName(value){
      return /^(?:\u0627\u0644\u0645\u0633\u0627\u0639\u062f \u0627\u0644\u0630\u0643\u064a|ai|assistant|support ai)$/i.test(String(value || '').trim());
    }

    function supportMessageLooksLikeTicketRequest(text){
      var raw = String(text || '').trim();
      if (!raw) return false;
      var compact = raw.replace(/\s+/g, ' ');
      var hasObjection = /(?:اعتراض|اعترض|شكوى|اشتكي|مشكلة|خطأ|خطاء|لم يصل|ما وصل|ما\s+وصل|ناقص|تأخر|تاخر|تأخير|تاخير|dispute|complaint|problem)/i.test(compact);
      var hasOrder = /(?:طلب|الطلب|اوردر|أوردر|order|رقم|كود|#|\d{4,})/i.test(compact);
      if (hasObjection && hasOrder) return true;
      return /(?:الدعم الفني|موظف|ادمن|أدمن|انسان|إنسان|بشري|شخص)/i.test(compact);
    }

    function supportThreadMessages(thread){
      var source = thread && typeof thread === 'object' ? thread : {};
      return Array.isArray(source.messages) ? source.messages.map(normalizeSupportMessage) : [];
    }

    function supportThreadHasHumanAdminReply(thread){
      return supportThreadMessages(thread).some(function(message){
        return message && message.sender === 'admin' && !isSupportAiAuthorName(message.authorName);
      });
    }

    function supportThreadHasTicketRequest(thread){
      return supportThreadMessages(thread).some(function(message){
        return message && message.sender === 'user' && supportMessageLooksLikeTicketRequest(message.text || '');
      });
    }

    function supportThreadHasTicketSystemEvent(thread){
      return supportThreadMessages(thread).some(function(message){
        return message && message.sender === 'system' && /(?:إعادة\s+فتح|فتح)\s+(?:ال)?تذكرة/.test(String(message.text || ''));
      });
    }

    function isSupportThreadTicketOpen(thread){
      var source = thread && typeof thread === 'object' ? thread : {};
      var status = String(source.status || '').trim().toLowerCase();
      if (status === 'closed' || status === 'resolved') return false;
      if (source.humanTicketOpen === true) return true;
      return supportThreadHasHumanAdminReply(source);
    }

    function escapeSupport(value){
      return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function normalizeSupportMediaUrl(value){
      var text = String(value == null ? '' : value).trim();
      var lower = text.toLowerCase();
      if (!text || lower === 'undefined' || lower === 'null') return '';
      return text.slice(0, 2000);
    }

    function sanitizeSupportImageUrl(value){
      var text = normalizeSupportMediaUrl(value);
      if (!text || /^(?:javascript|vbscript|data):/i.test(text)) return '';
      try {
        var parsed = new URL(text, window.location.href);
        var protocol = String(parsed.protocol || '').toLowerCase();
        if (protocol === 'http:' || protocol === 'https:' || protocol === 'blob:') return parsed.href;
      } catch (_) {}
      return '';
    }

    function readSupportCachedSiteMediaValue(path){
      try {
        var raw = localStorage.getItem('site:media:v1');
        if (!raw) return '';
        var parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return '';
        var parts = String(path || '').split('.').filter(Boolean);
        var cursor = parsed;
        for (var i = 0; i < parts.length; i += 1) {
          if (!cursor || typeof cursor !== 'object') return '';
          cursor = cursor[parts[i]];
        }
        return normalizeSupportMediaUrl(cursor);
      } catch (_) {
        return '';
      }
    }

    function resolveSupportSiteImageUrl(preferredUrl){
      var candidates = [
        preferredUrl,
        (function(){
          try { return window.__SITE_ICON__; } catch (_) { return ''; }
        })(),
        (function(){
          try {
            return typeof window.__resolveSiteMediaFallbackUrl === 'function'
              ? window.__resolveSiteMediaFallbackUrl('icon')
              : '';
          } catch (_) {
            return '';
          }
        })(),
        readSupportCachedSiteMediaValue('siteImage'),
        readSupportCachedSiteMediaValue('site_image'),
        readSupportCachedSiteMediaValue('appSettings.siteImage'),
        readSupportCachedSiteMediaValue('appSettings.site_image'),
        readSupportCachedSiteMediaValue('app_settings.siteImage'),
        readSupportCachedSiteMediaValue('app_settings.site_image'),
        readSupportCachedSiteMediaValue('siteIcon'),
        readSupportCachedSiteMediaValue('site_icon'),
        readSupportCachedSiteMediaValue('iconUrl'),
        readSupportCachedSiteMediaValue('icon_url'),
        readSupportCachedSiteMediaValue('favicon'),
        readSupportCachedSiteMediaValue('faviconUrl'),
        readSupportCachedSiteMediaValue('favicon_url'),
        readSupportCachedSiteMediaValue('headerLogo'),
        readSupportCachedSiteMediaValue('header_logo'),
        readSupportCachedSiteMediaValue('logoUrl'),
        readSupportCachedSiteMediaValue('logo_url'),
        (function(){
          try {
            var link = document.querySelector('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]');
            return link ? link.getAttribute('href') : '';
          } catch (_) {
            return '';
          }
        })()
      ];
      for (var i = 0; i < candidates.length; i += 1) {
        var next = normalizeSupportMediaUrl(candidates[i]);
        if (next) return next;
      }
      return '';
    }

    function applySupportChatSiteImage(url){
      var icon = document.querySelector('#siteSupportChatPanel .site-support-chat__icon');
      var image = document.getElementById('siteSupportChatSiteImage');
      if (!icon || !image) return;
      var next = resolveSupportSiteImageUrl(url);
      if (!next) {
        try { image.hidden = true; } catch (_) {}
        try { image.removeAttribute('src'); } catch (_) {}
        icon.classList.remove('has-site-image');
        return;
      }
      if (image.getAttribute('src') !== next) {
        image.setAttribute('src', next);
      }
      image.hidden = false;
      icon.classList.add('has-site-image');
    }

    function readSupportSessionInfo(){
      try {
        var parsed = JSON.parse(localStorage.getItem('sessionKeyInfo') || 'null');
        return parsed && typeof parsed === 'object' ? parsed : {};
      } catch (_) {
        return {};
      }
    }

    function getSupportAuth(){
      try {
        if (typeof firebase !== 'undefined' && firebase && typeof firebase.auth === 'function') {
          return firebase.auth();
        }
      } catch (_) {}
      return null;
    }

    async function ensureSupportAuthReady(){
      try {
        if (typeof window.__ensureAuthReady === 'function') {
          await window.__ensureAuthReady();
          return true;
        }
      } catch (_) {}
      try {
        if (typeof window.initFirebaseApp === 'function') {
          await window.initFirebaseApp();
          return true;
        }
      } catch (_) {}
      try {
        if (typeof window.__loadFirebaseCompat === 'function') {
          await window.__loadFirebaseCompat();
        }
      } catch (_) {}
      try {
        if (
          typeof firebase !== 'undefined' &&
          firebase &&
          typeof firebase.initializeApp === 'function' &&
          (!firebase.apps || !firebase.apps.length)
        ) {
          var cfg = window.__getSiteFirebaseConfig
            ? window.__getSiteFirebaseConfig()
            : (window.__FIREBASE_CONFIG__ || {});
          if (cfg && cfg.apiKey) firebase.initializeApp(cfg);
        }
      } catch (_) {}
      try {
        if (
          typeof firebase !== 'undefined' &&
          firebase &&
          typeof firebase.auth === 'function' &&
          !firebase.auth().currentUser &&
          typeof tryRestoreAuthFromPostLogin === 'function'
        ) {
          await tryRestoreAuthFromPostLogin();
        }
      } catch (_) {}
      return typeof firebase !== 'undefined' && firebase && typeof firebase.auth === 'function';
    }

    function getSupportFallbackUser(){
      try {
        if (window.__AUTH_LAST_USER__ && window.__AUTH_LAST_USER__.uid) return window.__AUTH_LAST_USER__;
      } catch (_) {}
      try {
        if (typeof buildFallbackUserFromPayload === 'function') {
          var fallback = buildFallbackUserFromPayload(readPostLoginPayload && readPostLoginPayload());
          if (fallback && fallback.uid) return fallback;
        }
      } catch (_) {}
      return null;
    }

    function waitForSupportUser(){
      return new Promise(function(resolve){
        var auth = getSupportAuth();
        var fallbackUser = getSupportFallbackUser();
        if (!auth) {
          resolve(fallbackUser || null);
          return;
        }
        if (auth.currentUser) {
          resolve(auth.currentUser);
          return;
        }
        var done = false;
        var timer = setTimeout(function(){
          if (done) return;
          done = true;
          try { if (typeof unsub === 'function') unsub(); } catch (_) {}
          resolve(auth.currentUser || fallbackUser || null);
        }, 2500);
        var unsub = null;
        try {
          unsub = auth.onAuthStateChanged(function(user){
            if (done) return;
            done = true;
            clearTimeout(timer);
            try { if (typeof unsub === 'function') unsub(); } catch (_) {}
            resolve(user || fallbackUser || getSupportFallbackUser() || null);
          });
        } catch (_) {
          clearTimeout(timer);
          resolve(auth.currentUser || fallbackUser || null);
        }
      });
    }

    function getSupportVisibleUser(user){
      try {
        if (user && user.uid) return user;
      } catch (_) {}
      try {
        var auth = getSupportAuth();
        if (auth && auth.currentUser && auth.currentUser.uid) return auth.currentUser;
      } catch (_) {}
      try {
        if (window.__AUTH_LAST_USER__ && window.__AUTH_LAST_USER__.uid) return window.__AUTH_LAST_USER__;
      } catch (_) {}
      return getSupportFallbackUser();
    }

    function isSupportChatCustomerLoggedIn(user){
      try {
        if (window.__LOGOUT_IN_PROGRESS__) return false;
      } catch (_) {}
      var activeUser = getSupportVisibleUser(user || supportChatAuthUser || null);
      var sessionInfo = readSupportSessionInfo();
      var userUid = String(activeUser && activeUser.uid || '').trim();
      var sessionUid = String(sessionInfo.uid || sessionInfo.useruid || '').trim();
      var sessionKey = String(sessionInfo.sessionKey || sessionInfo.session_key || '').trim();
      if (!activeUser || !userUid || !sessionKey) return false;
      if (sessionUid && sessionUid !== userUid) return false;
      return true;
    }

    function syncSupportChatVisibility(user){
      supportChatAuthUser = user || null;
      var allowed = isSupportChatCustomerLoggedIn(supportChatAuthUser);
      var fab = document.getElementById('siteSupportChatFab');
      var panel = document.getElementById('siteSupportChatPanel');
      if (!allowed) {
        if (supportChatState.open) setSupportChatOpen(false);
        stopSupportPolling();
        stopSupportBadgePolling();
        stopSupportRealtime();
      }
      try {
        if (fab) {
          fab.hidden = !allowed;
          fab.classList.toggle('support-auth-hidden', !allowed);
          fab.setAttribute('aria-hidden', allowed ? 'false' : 'true');
        }
      } catch (_) {}
      try {
        if (panel && !allowed) {
          try {
            var active = document.activeElement;
            if (active && panel.contains(active)) {
              if (fab && !fab.hidden && typeof fab.focus === 'function') fab.focus({ preventScroll: true });
              else if (typeof active.blur === 'function') active.blur();
            }
          } catch (_) {}
          panel.hidden = true;
          panel.setAttribute('aria-hidden', 'true');
          try { panel.setAttribute('inert', ''); } catch (_) {}
        } else if (panel) {
          panel.setAttribute('aria-hidden', supportChatState.open ? 'false' : 'true');
          try {
            if (supportChatState.open) panel.removeAttribute('inert');
            else panel.setAttribute('inert', '');
          } catch (_) {}
        }
      } catch (_) {}
      try {
        if (typeof window.__refreshWaJoinShortcutLayout === 'function') {
          window.__refreshWaJoinShortcutLayout();
        }
      } catch (_) {}
      return allowed;
    }

    function normalizeSupportApiBase(value){
      var raw = String(value == null ? '' : value).trim();
      if (!raw) return '';
      try {
        if (window.__normalizeSiteWorkerBase) {
          var normalized = String(window.__normalizeSiteWorkerBase(raw) || '').trim();
          if (normalized) return normalized.replace(/\/+$/, '') + '/';
        }
      } catch (_) {}
      try {
        var parsed = new URL(raw, window.location.href);
        if (!/^https?:$/i.test(parsed.protocol)) return '';
        parsed.search = '';
        parsed.hash = '';
        return parsed.toString().replace(/\/+$/, '') + '/';
      } catch (_) {
        return '';
      }
    }

    function isSupportStaticLocalBase(value){
      try {
        var parsed = new URL(String(value || ''), window.location.href);
        var host = String(parsed.hostname || '').trim().toLowerCase();
        var port = String(parsed.port || '').trim();
        var local = host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '[::1]' || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host);
        if (!local) return false;
        return !/^(8787|8788|8789|8790)$/.test(port);
      } catch (_) {
        return false;
      }
    }

    function getSupportWorkerBase(){
      var candidates = [];
      try {
        if (window.__getSiteWorkerBase) {
          candidates.push(window.__getSiteWorkerBase({ trailingSlash: true, allowStorageOverride: true }));
        }
      } catch (_) {}
      try {
        if (window.__getSiteWorkerBaseDefault) {
          candidates.push(window.__getSiteWorkerBaseDefault({ trailingSlash: true }));
        }
      } catch (_) {}
      try {
        candidates.push(
          window.API_BASE_URL,
          window.__API_BASE__,
          window.API_BASE,
          document.documentElement && document.documentElement.getAttribute('data-api-base')
        );
      } catch (_) {}
      try {
        candidates.push(
          localStorage.getItem('MANWAL_ROUTER_BASE'),
          localStorage.getItem('edaa:worker'),
          localStorage.getItem('apiBase'),
          localStorage.getItem('workerBase')
        );
      } catch (_) {}
      try {
        candidates.push(window.__getSiteSetting ? window.__getSiteSetting("workers.routerBase", "") : "");
      } catch (_) {}
      for (var i = 0; i < candidates.length; i += 1) {
        var base = normalizeSupportApiBase(candidates[i]);
        if (base && !isSupportStaticLocalBase(base)) return base;
      }
      return '';
    }

    function getSupportEndpoint(mode, params){
      var workerBase = getSupportWorkerBase();
      var url = workerBase ? new URL(workerBase, window.location.href) : new URL(window.location.href);
      url.search = '';
      url.hash = '';
      url.searchParams.set('action', 'pru');
      url.searchParams.set('mode', String(mode || 'support-thread'));
      Object.keys(params || {}).forEach(function(key){
        var value = params[key];
        if (value == null || value === '') return;
        url.searchParams.set(key, String(value));
      });
      return url.toString();
    }

    function getSupportFetchCredentials(requestUrl){
      // api.njad.store is cross-origin but SAME-SITE; the njad_sess HttpOnly
      // cookie only travels on credentialed requests (site-core's fetch patch
      // enforces this too — keep this helper aligned so it never downgrades).
      try {
        var target = new URL(requestUrl, window.location.href);
        void target;
        return 'include';
      } catch (_) {
        return 'include';
      }
    }

    var SUPPORT_AI_GUARD_COOKIE_NAME = 'z3_support_ai_guard';

    function readSupportCookie(name){
      var target = String(name || '').trim();
      if (!target) return '';
      var parts = String(document.cookie || '').split(';');
      for (var i = 0; i < parts.length; i += 1) {
        var item = parts[i].trim();
        var eq = item.indexOf('=');
        var key = eq >= 0 ? item.slice(0, eq) : item;
        if (key !== target) continue;
        var raw = eq >= 0 ? item.slice(eq + 1) : '';
        try { return decodeURIComponent(raw); } catch (_) { return raw; }
      }
      return '';
    }

    function writeSupportCookie(name, value, maxAgeSeconds){
      var key = String(name || '').trim();
      var text = String(value || '').trim();
      if (!key || !text) return;
      var cookie = key + '=' + encodeURIComponent(text) + '; Path=/; Max-Age=' + String(Math.max(60, Number(maxAgeSeconds) || 21600)) + '; SameSite=Lax';
      if (String(location.protocol || '').toLowerCase() === 'https:') cookie += '; Secure';
      document.cookie = cookie;
    }

    function createSupportAiGuardToken(){
      var alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
      var bytes = new Uint8Array(32);
      try {
        if (window.crypto && typeof window.crypto.getRandomValues === 'function') {
          window.crypto.getRandomValues(bytes);
        } else {
          for (var i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
        }
      } catch (_) {
        for (var j = 0; j < bytes.length; j += 1) bytes[j] = Math.floor(Math.random() * 256);
      }
      var out = '';
      for (var k = 0; k < bytes.length; k += 1) out += alphabet[bytes[k] % alphabet.length];
      return out;
    }

    function ensureSupportAiGuardToken(){
      var token = readSupportCookie(SUPPORT_AI_GUARD_COOKIE_NAME);
      if (!/^[A-Za-z0-9_-]{24,160}$/.test(token)) token = createSupportAiGuardToken();
      writeSupportCookie(SUPPORT_AI_GUARD_COOKIE_NAME, token, 21600);
      return token;
    }

    async function buildSupportAuthPayload(){
      await ensureSupportAuthReady();
      var user = await waitForSupportUser();
      var sessionInfo = readSupportSessionInfo();
      var uid = String((user && user.uid) || sessionInfo.uid || sessionInfo.useruid || '').trim();
      var sessionKey = String(sessionInfo.sessionKey || sessionInfo.session_key || '').trim();
      if (!user || !uid) throw new Error('يرجى تسجيل الدخول لفتح الدعم الفني.');
      if (!sessionKey) throw new Error('انتهت الجلسة، يرجى تسجيل الدخول من جديد.');
      var idToken = '';
      if (typeof user.getIdToken === 'function') {
        try { idToken = String(await user.getIdToken(false) || '').trim(); }
        catch (_) { idToken = String(await user.getIdToken(true) || '').trim(); }
      }
      if (!idToken) throw new Error('تعذر التحقق من تسجيل الدخول.');
      return { user: user, uid: uid, sessionKey: sessionKey, idToken: idToken };
    }

    function isSupportSessionExpiredPayload(payload, response){
      var code = String(
        (payload && (payload.code || payload.errorCode || payload.error_code)) ||
        ''
      ).trim().toLowerCase();
      if (code === 'session_expired') return true;
      var text = String((payload && (payload.error || payload.message)) || '').trim();
      return Number(response && response.status) === 401 && /session_expired|انتهت صلاحية رمز الجلسة|انتهت صلاحية الجلسة/i.test(text);
    }

    async function refreshSupportSessionOnce(auth){
      try {
        if (!auth || !auth.user || typeof auth.user.getIdToken !== 'function') return null;
        var freshToken = String(await auth.user.getIdToken(true) || '').trim();
        if (!freshToken || typeof window.__syncCatalogAuthFromToken !== 'function') return null;
        var basePayload = {};
        try {
          if (typeof readPostLoginPayload === 'function') basePayload = readPostLoginPayload() || {};
        } catch (_) {}
        basePayload = Object.assign({}, basePayload || {}, {
          uid: auth.uid,
          idToken: freshToken,
          token: freshToken,
          sessionKey: auth.sessionKey,
          session_key: auth.sessionKey
        });
        var synced = await window.__syncCatalogAuthFromToken(freshToken, basePayload);
        if (!synced || !synced.sessionKey) return null;
        return buildSupportAuthPayload();
      } catch (_) {
        return null;
      }
    }

    async function callSupportApi(mode, options){
      var opts = options || {};
      var method = String(opts.method || 'GET').toUpperCase();
      var auth = await buildSupportAuthPayload();
      var params = method === 'GET'
        ? { useruid: auth.uid, sessionKey: auth.sessionKey }
        : {};
      if (method === 'GET' && opts.params && typeof opts.params === 'object') {
        Object.keys(opts.params).forEach(function(key){
          params[key] = opts.params[key];
        });
      }
      var body = opts.body && typeof opts.body === 'object' ? opts.body : {};
      var supportAiGuardToken = method === 'POST' && String(mode || '').trim() === 'support-message'
        ? ensureSupportAiGuardToken()
        : '';
      var send = async function(nextAuth){
        var nextParams = Object.assign({}, params || {});
        if (method === 'GET') {
          nextParams.useruid = nextAuth.uid;
          nextParams.sessionKey = nextAuth.sessionKey;
        }
        var requestUrl = getSupportEndpoint(mode, nextParams);
        var headers = {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + nextAuth.idToken,
          'X-SessionKey': nextAuth.sessionKey
        };
        if (supportAiGuardToken) headers['X-Support-AI-Guard'] = supportAiGuardToken;
        var requestBody = Object.assign({}, body, {
          useruid: nextAuth.uid,
          sessionKey: nextAuth.sessionKey
        });
        if (supportAiGuardToken) requestBody.supportAiGuard = supportAiGuardToken;
        var response = await fetch(requestUrl, {
          method: method,
          cache: 'no-store',
          credentials: getSupportFetchCredentials(requestUrl),
          headers: headers,
          body: method === 'GET' ? undefined : JSON.stringify(requestBody)
        });
        var text = await response.text();
        var payload = {};
        try { payload = text ? JSON.parse(text) : {}; } catch (_) { payload = { raw: text }; }
        return { response: response, payload: payload };
      };
      var result = await send(auth);
      var response = result.response;
      var payload = result.payload;
      if (!response.ok && isSupportSessionExpiredPayload(payload, response)) {
        var refreshedAuth = await refreshSupportSessionOnce(auth);
        if (refreshedAuth && refreshedAuth.sessionKey) {
          result = await send(refreshedAuth);
          response = result.response;
          payload = result.payload;
        }
      }
      if (!response.ok) {
        throw new Error(String(payload.error || payload.message || payload.hint || payload.code || ('HTTP ' + response.status)));
      }
      return payload;
    }

    function supportFileToBase64(file){
      return new Promise(function(resolve, reject){
        if (!file) {
          resolve('');
          return;
        }
        var reader = new FileReader();
        reader.onload = function(){
          var raw = String(reader.result || '');
          var comma = raw.indexOf(',');
          resolve(comma >= 0 ? raw.slice(comma + 1) : raw);
        };
        reader.onerror = function(){
          reject(new Error('تعذر قراءة الصورة.'));
        };
        reader.readAsDataURL(file);
      });
    }

    async function uploadSupportImageFile(file){
      if (!file) return '';
      var type = String(file.type || '').toLowerCase();
      if (!type.startsWith('image/')) throw new Error('اختر ملف صورة فقط.');
      if (Number(file.size || 0) > (5 * 1024 * 1024)) throw new Error('حجم الصورة يتجاوز 5MB.');
      var auth = await buildSupportAuthPayload();
      var data = await supportFileToBase64(file);
      if (!data) throw new Error('تعذر قراءة الصورة.');
      var send = async function(nextAuth){
        var requestUrl = getSupportEndpoint('user-upload-image');
        var response = await fetch(requestUrl, {
          method: 'POST',
          cache: 'no-store',
          credentials: getSupportFetchCredentials(requestUrl),
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + nextAuth.idToken,
            'X-SessionKey': nextAuth.sessionKey
          },
          body: JSON.stringify({
            filename: file.name || 'support-image',
            mimeType: file.type || '',
            data: data,
            folder: 'users/support',
            entity: 'support-chat',
            key: nextAuth.uid
          })
        });
        var text = await response.text();
        var payload = {};
        try { payload = text ? JSON.parse(text) : {}; } catch (_) { payload = { raw: text }; }
        return { response: response, payload: payload };
      };
      var result = await send(auth);
      var response = result.response;
      var payload = result.payload;
      if (!response.ok && isSupportSessionExpiredPayload(payload, response)) {
        var refreshedAuth = await refreshSupportSessionOnce(auth);
        if (refreshedAuth && refreshedAuth.sessionKey) {
          result = await send(refreshedAuth);
          response = result.response;
          payload = result.payload;
        }
      }
      if (!response.ok) {
        throw new Error(String(payload.error || payload.message || payload.hint || payload.code || ('HTTP ' + response.status)));
      }
      var imageUrl = String(payload.imageUrl || payload.url || '').trim();
      if (!imageUrl) throw new Error('تم رفع الصورة لكن لم يصل رابط صالح.');
      return imageUrl;
    }

    // ---- Support voice messages (record → upload → send) --------------------
    async function uploadSupportVoiceBlob(blob){
      if (!blob) return '';
      var type = String(blob.type || 'audio/webm').toLowerCase().split(';')[0] || 'audio/webm';
      if (Number(blob.size || 0) > (25 * 1024 * 1024)) throw new Error('حجم التسجيل يتجاوز 25MB.');
      var ext = type.indexOf('ogg') >= 0 ? 'ogg' : (type.indexOf('mp4') >= 0 ? 'm4a' : (type.indexOf('mpeg') >= 0 ? 'mp3' : 'webm'));
      var auth = await buildSupportAuthPayload();
      var data = await supportFileToBase64(blob);
      if (!data) throw new Error('تعذر قراءة التسجيل.');
      var send = async function(nextAuth){
        var requestUrl = getSupportEndpoint('user-upload-image');
        var response = await fetch(requestUrl, {
          method: 'POST',
          cache: 'no-store',
          credentials: getSupportFetchCredentials(requestUrl),
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + nextAuth.idToken,
            'X-SessionKey': nextAuth.sessionKey
          },
          body: JSON.stringify({
            filename: 'voice.' + ext,
            mimeType: type,
            data: data,
            entity: 'support-chat-audio',
            kind: 'audio',
            key: nextAuth.uid
          })
        });
        var text = await response.text();
        var payload = {};
        try { payload = text ? JSON.parse(text) : {}; } catch (_) { payload = { raw: text }; }
        return { response: response, payload: payload };
      };
      var result = await send(auth);
      var response = result.response;
      var payload = result.payload;
      if (!response.ok && isSupportSessionExpiredPayload(payload, response)) {
        var refreshedAuth = await refreshSupportSessionOnce(auth);
        if (refreshedAuth && refreshedAuth.sessionKey) {
          result = await send(refreshedAuth);
          response = result.response;
          payload = result.payload;
        }
      }
      if (!response.ok) {
        throw new Error(String(payload.error || payload.message || payload.hint || payload.code || ('HTTP ' + response.status)));
      }
      var audioUrl = String(payload.audioUrl || payload.url || '').trim();
      if (!audioUrl) throw new Error('تم رفع التسجيل لكن لم يصل رابط صالح.');
      return audioUrl;
    }

    var supportVoiceRec = { recorder: null, chunks: [], stream: null, recording: false, startedAt: 0, _cancel: false };

    function updateSupportVoiceButton(){
      var btn = document.getElementById('siteSupportChatVoice');
      if (!btn) return;
      btn.classList.toggle('is-recording', !!supportVoiceRec.recording);
      btn.setAttribute('aria-label', supportVoiceRec.recording ? 'إيقاف وإرسال التسجيل' : 'تسجيل رسالة صوتية');
      btn.innerHTML = supportVoiceRec.recording
        ? '<i class="fa-solid fa-stop" aria-hidden="true"></i>'
        : '<i class="fa-solid fa-microphone" aria-hidden="true"></i>';
    }

    async function startSupportVoiceRecording(){
      if (supportVoiceRec.recording) return;
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof MediaRecorder === 'undefined') {
        setSupportChatStatus('التسجيل الصوتي غير مدعوم في هذا المتصفح.');
        return;
      }
      try {
        var stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        var mime = '';
        ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'].some(function(t){
          if (typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported(t)) { mime = t; return true; }
          return false;
        });
        var rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
        supportVoiceRec.recorder = rec;
        supportVoiceRec.chunks = [];
        supportVoiceRec.stream = stream;
        supportVoiceRec.recording = true;
        supportVoiceRec.startedAt = Date.now();
        supportVoiceRec._cancel = false;
        rec.ondataavailable = function(ev){ if (ev.data && ev.data.size) supportVoiceRec.chunks.push(ev.data); };
        rec.onstop = function(){ finishSupportVoiceRecording(); };
        rec.start();
        updateSupportVoiceButton();
        setSupportChatStatus('🎤 جاري التسجيل... اضغط لإيقاف الإرسال.');
      } catch (err) {
        supportVoiceRec.recording = false;
        updateSupportVoiceButton();
        var name = err && err.name ? String(err.name) : '';
        var msg;
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
          // Browser won't re-prompt after a saved "block" — guide the user to reset it.
          msg = !window.isSecureContext
            ? 'التسجيل الصوتي يتطلب اتصالاً آمناً (HTTPS).'
            : 'إذن الميكروفون مرفوض. اضغط على قفل العنوان في المتصفح ← الميكروفون ← اسمح، ثم أعد المحاولة.';
        } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
          msg = 'لا يوجد ميكروفون متاح على هذا الجهاز.';
        } else if (name === 'NotReadableError' || name === 'TrackStartError') {
          msg = 'الميكروفون مستخدم من تطبيق آخر. أغلقه ثم أعد المحاولة.';
        } else {
          msg = 'تعذر الوصول للميكروفون' + (name ? ' (' + name + ')' : '') + '. تأكد من السماح بالإذن.';
        }
        setSupportChatStatus(msg);
      }
    }

    function stopSupportVoiceRecording(cancel){
      supportVoiceRec._cancel = !!cancel;
      try { if (supportVoiceRec.recorder && supportVoiceRec.recording) supportVoiceRec.recorder.stop(); } catch (_) {}
    }

    async function finishSupportVoiceRecording(){
      var wasCancel = supportVoiceRec._cancel;
      supportVoiceRec._cancel = false;
      var chunks = supportVoiceRec.chunks.slice();
      var recorder = supportVoiceRec.recorder;
      var durationMs = Date.now() - (supportVoiceRec.startedAt || Date.now());
      try { if (supportVoiceRec.stream) supportVoiceRec.stream.getTracks().forEach(function(t){ try { t.stop(); } catch (_) {} }); } catch (_) {}
      supportVoiceRec.recording = false;
      supportVoiceRec.recorder = null;
      supportVoiceRec.stream = null;
      supportVoiceRec.chunks = [];
      updateSupportVoiceButton();
      if (wasCancel) { setSupportChatStatus(''); return; }
      if (!chunks.length || durationMs < 400) { setSupportChatStatus('التسجيل قصير جداً.'); return; }
      var type = (recorder && recorder.mimeType) || 'audio/webm';
      await submitSupportVoiceMessage(new Blob(chunks, { type: type }));
    }

    async function submitSupportVoiceMessage(blob){
      if (supportChatState.sending) return;
      supportChatState.sending = true;
      setSupportSendButtonBusy(true);
      try {
        setSupportChatStatus('جاري إرسال التسجيل...');
        var audioUrl = await uploadSupportVoiceBlob(blob);
        var payload = await callSupportApi('support-message', { method: 'POST', body: { audioUrl: audioUrl } });
        clearSupportMessageSelection({ render: false });
        if (payload && Array.isArray(payload.messages)) {
          renderSupportThread(mergeSupportThreadMessages(payload.thread || null, payload.messages), { notify: false });
        } else {
          renderSupportThread(payload.thread || null, { notify: false });
        }
        setSupportChatStatus('');
      } catch (err) {
        setSupportChatStatus(err && err.message ? err.message : 'تعذر إرسال التسجيل.');
      } finally {
        supportChatState.sending = false;
        setSupportSendButtonBusy(false);
      }
    }

    function toggleSupportVoiceRecording(){
      if (supportVoiceRec.recording) stopSupportVoiceRecording(false);
      else startSupportVoiceRecording();
    }

    function normalizeSupportMessage(raw){
      var source = raw && typeof raw === 'object' ? raw : {};
      var senderRaw = String(source.sender || source.from || '').trim().toLowerCase();
      var sender = senderRaw === 'admin' || senderRaw === 'support'
        ? 'admin'
        : (senderRaw === 'system' || senderRaw === 'notice' || senderRaw === 'event' ? 'system' : 'user');
      return {
        id: String(source.id || source.messageId || ''),
        sender: sender,
        text: String(source.text || source.message || source.body || '').trim(),
        imageUrl: sanitizeSupportImageUrl(source.imageUrl || source.image_url || ''),
        audioUrl: sanitizeSupportImageUrl(source.audioUrl || source.audio_url || source.voiceUrl || source.voice_url || ''),
        cards: normalizeSupportCards(source.cards || source.supportCards || source.cardList || []),
        authorName: String(source.authorName || source.author || source.name || '').trim(),
        createdAt: String(source.createdAt || source.created_at || '').trim()
      };
    }

    function normalizeSupportCard(raw){
      var source = raw && typeof raw === 'object' ? raw : {};
      var type = String(source.type || source.kind || '').trim().toLowerCase();
      var action = String(source.action || source.actionCode || source.code || '').trim().toLowerCase();
      if (['product', 'deposit', 'order', 'support'].indexOf(type) < 0) return null;
      if (['open_product', 'open_deposit', 'start_objection', 'open_ticket'].indexOf(action) < 0) return null;
      var id = String(source.id || source.cardId || source.productId || source.methodId || source.orderCode || (action === 'open_ticket' ? 'open_ticket' : '') || '').trim();
      var title = String(source.title || source.name || source.label || '').trim();
      if (!id && !title) return null;
      return {
        id: id,
        type: type,
        action: action,
        title: title,
        subtitle: String(source.subtitle || source.description || source.meta || '').trim(),
        priceText: String(source.priceText || source.price_text || '').trim(),
        statusText: String(source.statusText || source.statusLabel || source.status || '').trim(),
        imageUrl: sanitizeSupportImageUrl(source.imageUrl || source.image_url || source.image || source.logoUrl || source.logo_url || source.logo || source.iconUrl || source.icon_url || source.icon || source.cardImageUrl || source.card_image_url || source.thumbnailUrl || source.thumbnail_url || ''),
        productId: String(source.productId || source.product_id || '').trim(),
        gameSlug: String(source.gameSlug || source.game_slug || source.catalogSlug || source.slug || '').trim(),
        sectionId: String(source.sectionId || source.section_id || source.categoryId || source.category_id || '').trim(),
        methodId: String(source.methodId || source.method_id || '').trim(),
        country: String(source.country || source.countryName || '').trim(),
        orderCode: String(source.orderCode || source.order_code || '').trim(),
        available: source.available === false ? false : true
      };
    }

    function normalizeSupportCards(rawCards){
      var seen = {};
      return (Array.isArray(rawCards) ? rawCards : []).map(normalizeSupportCard).filter(function(card){
        if (!card) return false;
        var key = [card.type, card.action, card.productId, card.gameSlug, card.methodId, card.orderCode, card.id, card.title].join('|').toLowerCase();
        if (seen[key]) return false;
        seen[key] = true;
        return true;
      }).slice(0, 12);
    }

    function getSupportCardsSignature(cards){
      return normalizeSupportCards(cards).map(function(card){
        return [card.type, card.action, card.id, card.productId, card.gameSlug, card.methodId, card.orderCode, card.title, card.priceText].join(':');
      }).join(',');
    }

    function renderSupportCards(cards){
      var list = normalizeSupportCards(cards);
      if (!list.length) return '';
      var ticketOnly = list.length === 1 && list[0].type === 'support' && list[0].action === 'open_ticket';
      return '<div class="site-support-chat__cards' + (ticketOnly ? ' is-ticket-prompt' : '') + '" role="list">' + list.map(function(card){
        if (card.type === 'support' && card.action === 'open_ticket') {
          var ticketData = [
            'data-support-card-action="' + escapeSupport(card.action) + '"',
            'data-card-type="' + escapeSupport(card.type) + '"',
            'data-card-id="' + escapeSupport(card.id || 'open_ticket') + '"'
          ].join(' ');
          return '<button class="site-support-chat__ticket-btn" type="button" role="listitem" ' + ticketData + '>فتح تذكرة</button>';
        }
        var icon = card.type === 'deposit' ? 'fa-wallet' : (card.type === 'order' ? 'fa-receipt' : (card.type === 'support' ? 'fa-ticket' : 'fa-bag-shopping'));
        var cta = card.action === 'open_ticket' ? 'فتح تذكرة' : (card.action === 'open_deposit' ? 'إيداع' : (card.action === 'start_objection' ? 'اعتراض' : 'شراء'));
        var cardImageUrl = sanitizeSupportImageUrl(card.imageUrl);
        var media = cardImageUrl
          ? '<span class="site-support-chat__card-media"><img src="' + escapeSupport(cardImageUrl) + '" alt=""></span>'
          : '<span class="site-support-chat__card-media is-empty"><i class="fa-solid ' + icon + '" aria-hidden="true"></i></span>';
        var data = [
          'data-support-card-action="' + escapeSupport(card.action) + '"',
          'data-card-type="' + escapeSupport(card.type) + '"',
          'data-card-id="' + escapeSupport(card.id) + '"',
          'data-product-id="' + escapeSupport(card.productId || card.id) + '"',
          'data-game-slug="' + escapeSupport(card.gameSlug) + '"',
          'data-section-id="' + escapeSupport(card.sectionId) + '"',
          'data-method-id="' + escapeSupport(card.methodId || card.id) + '"',
          'data-country="' + escapeSupport(card.country) + '"',
          'data-order-code="' + escapeSupport(card.orderCode || card.id) + '"'
        ].join(' ');
        return [
          '<button class="site-support-chat__card" type="button" role="listitem" ' + data + '>',
            media,
            '<span class="site-support-chat__card-body">',
              '<strong>' + escapeSupport(card.title) + '</strong>',
              card.subtitle ? '<small>' + escapeSupport(card.subtitle) + '</small>' : '',
              (card.priceText || card.statusText) ? '<em>' + escapeSupport(card.priceText || card.statusText) + '</em>' : '',
            '</span>',
            '<span class="site-support-chat__card-cta">' + escapeSupport(cta) + '</span>',
          '</button>'
        ].join('');
      }).join('') + '</div>';
    }

    function getSupportContactKind(href){
      var text = String(href || '').trim().toLowerCase();
      if (!text) return '';
      if (text.indexOf('wa.me/') >= 0 || text.indexOf('whatsapp.com/') >= 0 || text.indexOf('whatsapp:') === 0) return 'whatsapp';
      if (text.indexOf('t.me/') >= 0 || text.indexOf('telegram.me/') >= 0 || text.indexOf('telegram:') === 0 || text.indexOf('tg:') === 0) return 'telegram';
      if (text.indexOf('facebook.com/') >= 0 || text.indexOf('fb.com/') >= 0) return 'facebook';
      if (text.indexOf('instagram.com/') >= 0) return 'instagram';
      if (text.indexOf('mailto:') === 0) return 'email';
      return '';
    }

    function getSupportContactIcon(kind){
      if (kind === 'whatsapp') return 'fa-brands fa-whatsapp';
      if (kind === 'telegram') return 'fa-brands fa-telegram';
      if (kind === 'facebook') return 'fa-brands fa-facebook-f';
      if (kind === 'instagram') return 'fa-brands fa-instagram';
      if (kind === 'email') return 'fa-solid fa-envelope';
      return 'fa-solid fa-link';
    }

    function getSupportContactFallbackLabel(kind, group){
      if (kind === 'whatsapp') return group ? 'مجموعة واتساب' : 'واتساب';
      if (kind === 'telegram') return 'تيليجرام';
      if (kind === 'facebook') return 'فيسبوك';
      if (kind === 'instagram') return 'إنستغرام';
      if (kind === 'email') return 'البريد الإلكتروني';
      return 'رابط التواصل';
    }

    function cleanSupportContactHref(value){
      var text = String(value || '').trim().replace(/[)\].,،؛!?؟]+$/g, '');
      if (/^(https?:|mailto:|tel:|tg:|telegram:|whatsapp:)/i.test(text)) return text;
      return '';
    }

    function extractSupportContactLinksFromText(text){
      var rawText = String(text || '');
      if (!rawText.trim()) return { text: '', links: [] };
      var seen = {};
      var links = [];
      var keptLines = [];
      rawText.split(/\r?\n/).forEach(function(line){
        var rawLine = String(line || '');
        var urlMatch = rawLine.match(/(?:https?:\/\/|mailto:|tel:|tg:|telegram:|whatsapp:)[^\s<>"']+/i);
        if (!urlMatch) {
          keptLines.push(rawLine);
          return;
        }
        var href = cleanSupportContactHref(urlMatch[0]);
        var kind = getSupportContactKind(href);
        if (!href || !kind) {
          keptLines.push(rawLine);
          return;
        }
        var label = rawLine
          .replace(urlMatch[0], '')
          .replace(/^[\s>*\-–—•]+/g, '')
          .replace(/^\d+[\).\-]\s*/g, '')
          .replace(/[:：\-\s]+$/g, '')
          .trim();
        var group = kind === 'whatsapp' && (/chat\.whatsapp\.com/i.test(href) || /(?:مجموعة|جروب|group|community)/i.test(label));
        var key = href.toLowerCase();
        if (!seen[key]) {
          seen[key] = true;
          links.push({
            href: href,
            kind: kind,
            label: label || getSupportContactFallbackLabel(kind, group),
            group: group
          });
        }
      });
      return {
        text: keptLines.join('\n').replace(/\n{3,}/g, '\n\n').trim(),
        links: links.slice(0, 8)
      };
    }

    function renderSupportContactLinks(links){
      var list = Array.isArray(links) ? links : [];
      if (!list.length) return '';
      return '<div class="site-support-chat__contact-links" role="list">' + list.map(function(link){
        var kind = String(link && link.kind || 'link').trim().toLowerCase() || 'link';
        var label = String(link && link.label || '').trim() || getSupportContactFallbackLabel(kind, link && link.group);
        var href = String(link && link.href || '').trim();
        if (!href) return '';
        var icon = getSupportContactIcon(kind);
        var groupBadge = link && link.group
          ? '<span class="site-support-chat__contact-badge" aria-hidden="true"><i class="fa-solid fa-user-group"></i></span>'
          : '';
        return [
          '<a class="site-support-chat__contact-btn is-' + escapeSupport(kind) + (link && link.group ? ' is-group' : '') + '"',
            ' href="' + escapeSupport(href) + '" target="_blank" rel="noopener noreferrer"',
            ' data-support-contact-link="1" role="listitem" aria-label="' + escapeSupport(label) + '">',
            '<span class="site-support-chat__contact-icon" aria-hidden="true"><i class="' + escapeSupport(icon) + '"></i>' + groupBadge + '</span>',
            '<span class="site-support-chat__contact-label">' + escapeSupport(label) + '</span>',
          '</a>'
        ].join('');
      }).join('') + '</div>';
    }

    function formatSupportTime(value){
      var ms = Date.parse(String(value || ''));
      if (!Number.isFinite(ms) || ms <= 0) return '';
      try {
        return new Date(ms).toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' });
      } catch (_) {
        return '';
      }
    }

    function getSupportIncomingMessageKey(thread){
      var messages = Array.isArray(thread && thread.messages)
        ? thread.messages.map(normalizeSupportMessage)
        : [];
      for (var i = messages.length - 1; i >= 0; i -= 1) {
        var message = messages[i];
        if (message && message.sender === 'admin') {
          return [
            message.id,
            message.createdAt,
            message.text,
            message.imageUrl
          ].join('|');
        }
      }
      return '';
    }

    function playSupportIncomingTone(){
      if (window.__ENABLE_SUPPORT_CHAT_TONE__ !== true) return;
      try {
        var audio = new Audio('https://image2url.com/r2/default/audio/1775222006071-0c6196c2-357e-4a1c-9499-a3ada1f41078.mp3');
        audio.volume = 0.36;
        var played = audio.play();
        if (played && typeof played.catch === 'function') played.catch(function(){});
      } catch (_) {}
    }

    function ensureSupportNotificationPermission(){
      try {
        if (!('Notification' in window)) return;
        if (Notification.permission === 'default') {
          Notification.requestPermission().catch(function(){});
        }
      } catch (_) {}
    }

    function notifySupportIncomingMessage(thread){
      var now = Date.now();
      if (now - Number(supportChatState.lastNotifyAt || 0) < 1200) return;
      supportChatState.lastNotifyAt = now;
      var messages = Array.isArray(thread && thread.messages)
        ? thread.messages.map(normalizeSupportMessage)
        : [];
      var latest = null;
      for (var i = messages.length - 1; i >= 0; i -= 1) {
        if (messages[i] && messages[i].sender === 'admin') {
          latest = messages[i];
          break;
        }
      }
      var body = latest && latest.text
        ? latest.text
        : (latest && latest.imageUrl ? 'وصلت صورة جديدة من الدعم.' : 'وصلت رسالة جديدة من الدعم.');
      setSupportChatStatus('وصلت رسالة جديدة من الدعم.');
      window.setTimeout(function(){
        if (supportChatState.open) setSupportChatStatus('');
      }, 2600);
      playSupportIncomingTone();
      try {
        if (supportChatState.titleBase === '') supportChatState.titleBase = document.title || '';
        if (document && !supportChatState.open) {
          document.title = 'رسالة دعم جديدة - ' + supportChatState.titleBase;
          window.setTimeout(function(){
            if (!supportChatState.open && supportChatState.titleBase) document.title = supportChatState.titleBase;
          }, 4500);
        }
      } catch (_) {}
      try {
        if ('Notification' in window && Notification.permission === 'granted' && !supportChatState.open) {
          new Notification('الدعم الفني', {
            body: body.slice(0, 180),
            tag: 'support-chat-message'
          });
        }
      } catch (_) {}
    }

    function setSupportChatStatus(text){
      var status = document.getElementById('siteSupportChatStatus');
      if (!status) return;
      var value = String(text || '').trim();
      if (!value) {
        status.textContent = '';
        return;
      }
      var loading = /(?:جاري|جارٍ|تحميل|رفع|إرسال|انتظار)/i.test(value);
      status.innerHTML = (loading
        ? '<span class="site-support-chat__status-loader" aria-hidden="true"><span></span><span></span><span></span></span>'
        : '') + escapeSupport(value);
    }

    function renderSupportBadge(thread){
      var badge = document.getElementById('siteSupportChatBadge');
      if (!badge) return;
      var unread = Math.max(0, Number(thread && thread.unreadUser || 0) || 0);
      badge.textContent = unread ? String(unread) : '';
      badge.hidden = !unread;
    }

    function syncSupportTicketCloseButton(thread){
      var button = document.getElementById('siteSupportChatCloseTicket');
      if (!button) return;
      var open = isSupportThreadTicketOpen(thread || supportChatState.thread);
      button.hidden = !open;
      button.classList.toggle('is-visible', open);
      button.disabled = !!supportChatState.sending;
      button.setAttribute('aria-hidden', open ? 'false' : 'true');
    }

    function getSupportMessagesBelowViewportCount(list){
      if (!list) return 0;
      try {
        var viewportBottom = list.getBoundingClientRect().bottom;
        var rows = list.querySelectorAll('.site-support-chat__bubble, .site-support-chat__system');
        var count = 0;
        Array.prototype.forEach.call(rows, function(row){
          if (!row || !row.getBoundingClientRect) return;
          if (row.getBoundingClientRect().bottom > viewportBottom + 8) count += 1;
        });
        return count;
      } catch (_) {
        return 0;
      }
    }

    function isSupportMessagesNearBottom(list){
      if (!list) return true;
      try {
        return (Number(list.scrollHeight || 0) - Number(list.scrollTop || 0) - Number(list.clientHeight || 0)) <= 96;
      } catch (_) {
        return true;
      }
    }

    function shouldSupportAutoScroll(list){
      if (!list) return true;
      return isSupportMessagesNearBottom(list) || getSupportMessagesBelowViewportCount(list) <= 4;
    }

    function updateSupportJumpButton(){
      var button = document.getElementById('siteSupportChatJump');
      var list = document.getElementById('siteSupportChatMessages');
      if (!button || !list) return;
      var count = getSupportMessagesBelowViewportCount(list);
      var show = count > 4;
      button.hidden = !show;
      button.classList.toggle('is-visible', show);
      button.setAttribute('aria-label', show ? 'النزول إلى آخر الرسائل' : 'أنت في آخر المحادثة');
    }

    function scrollSupportMessagesToBottom(options){
      var opts = options || {};
      var list = document.getElementById('siteSupportChatMessages');
      if (!list) return;
      var run = function(){
        if (opts.force !== true && !shouldSupportAutoScroll(list)) {
          updateSupportJumpButton();
          return;
        }
        try { list.scrollTop = list.scrollHeight; } catch (_) {}
        updateSupportJumpButton();
      };
      run();
      if (opts.defer === false) return;
      try { window.requestAnimationFrame(run); } catch (_) {}
      setTimeout(run, 80);
      setTimeout(run, 260);
      setTimeout(run, 700);
    }

    function getSupportMessageKey(thread, message){
      var m = normalizeSupportMessage(message);
      var uid = String(thread && thread.userUid || '').trim();
      return [uid, m.id, m.sender, m.createdAt, m.text, m.imageUrl, getSupportCardsSignature(m.cards)].join('|');
    }

    function getSupportSelectedMessageKeys(){
      return Array.isArray(supportChatState.selectedMessageKeys)
        ? supportChatState.selectedMessageKeys.map(function(key){ return String(key || '').trim(); }).filter(Boolean)
        : [];
    }

    function isSupportMessageSelected(key){
      key = String(key || '').trim();
      return !!key && getSupportSelectedMessageKeys().indexOf(key) >= 0;
    }

    function setSupportSelectedMessageKeys(keys){
      var seen = {};
      supportChatState.selectedMessageKeys = (Array.isArray(keys) ? keys : [])
        .map(function(key){ return String(key || '').trim(); })
        .filter(function(key){
          if (!key || seen[key]) return false;
          seen[key] = true;
          return true;
        });
    }

    function getSupportSelectedMessageEntries(thread){
      var selected = new Set(getSupportSelectedMessageKeys());
      if (!selected.size) return [];
      var messages = Array.isArray(thread && thread.messages) ? thread.messages.map(normalizeSupportMessage) : [];
      return messages.map(function(message){
        var key = getSupportMessageKey(thread, message);
        return { key: key, message: message };
      }).filter(function(entry){
        return selected.has(entry.key);
      });
    }

    function updateSupportSelectionBar(){
      var bar = document.getElementById('siteSupportChatSelectionBar');
      if (!bar) return;
      var count = getSupportSelectedMessageEntries(supportChatState.thread || {}).length;
      bar.hidden = count <= 0;
      bar.classList.toggle('is-active', count > 0);
      var countEl = bar.querySelector('[data-support-selection-count]');
      if (countEl) countEl.textContent = String(count);
    }

    function clearSupportMessageSelection(options){
      var opts = options || {};
      if (!getSupportSelectedMessageKeys().length) return;
      supportChatState.selectedMessageKeys = [];
      updateSupportSelectionBar();
      if (opts.render !== false) {
        try {
          var list = document.getElementById('siteSupportChatMessages');
          if (list) {
            Array.prototype.forEach.call(list.querySelectorAll('[data-support-message-key]'), function(row){
              row.classList.remove('is-selected');
              row.setAttribute('aria-selected', 'false');
            });
          }
        } catch (_) {}
      }
    }

    function toggleSupportMessageSelection(key){
      key = String(key || '').trim();
      if (!key) return;
      var keys = getSupportSelectedMessageKeys();
      var index = keys.indexOf(key);
      if (index >= 0) keys.splice(index, 1);
      else keys.push(key);
      setSupportSelectedMessageKeys(keys);
      updateSupportSelectionBar();
      try {
        var list = document.getElementById('siteSupportChatMessages');
        if (list) {
          Array.prototype.forEach.call(list.querySelectorAll('[data-support-message-key]'), function(row){
            var selected = isSupportMessageSelected(row.getAttribute('data-support-message-key') || '');
            row.classList.toggle('is-selected', selected);
            row.setAttribute('aria-selected', selected ? 'true' : 'false');
          });
        }
      } catch (_) {}
    }

    function formatSupportSelectedMessagesForCopy(thread){
      return getSupportSelectedMessageEntries(thread || {}).map(function(entry){
        var message = normalizeSupportMessage(entry.message);
        var author = message.sender === 'user' ? 'أنت' : 'الدعم الفني';
        var time = formatSupportTime(message.createdAt);
        var parts = [(time ? '[' + time + '] ' : '') + author + ':'];
        if (message.text) parts.push(message.text);
        if (message.imageUrl) parts.push('[صورة] ' + message.imageUrl);
        return parts.join('\n');
      }).join('\n\n');
    }

    async function copySupportSelectedMessages(){
      var text = formatSupportSelectedMessagesForCopy(supportChatState.thread || {});
      if (!text) {
        setSupportChatStatus('حدد رسالة واحدة على الأقل للنسخ.');
        return;
      }
      var ok = false;
      try {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
          await navigator.clipboard.writeText(text);
          ok = true;
        }
      } catch (_) {
        ok = false;
      }
      if (!ok) {
        var textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        try { ok = document.execCommand('copy'); } catch (_) { ok = false; }
        textarea.remove();
      }
      if (ok) {
        clearSupportMessageSelection();
      }
      setSupportChatStatus(ok ? 'تم نسخ الرسائل المحددة.' : 'تعذر النسخ تلقائياً.');
    }

    function renderSupportMessagesLoading(){
      var list = document.getElementById('siteSupportChatMessages');
      if (!list) return;
      supportChatState.selectedMessageKeys = [];
      updateSupportSelectionBar();
      list.setAttribute('aria-busy', 'true');
      if (!list.querySelector('.site-support-chat__bubble')) {
        list.innerHTML = '<div class="site-support-chat__loading"><span class="site-support-chat__spinner" aria-hidden="true"><span></span></span><div>جاري تحميل المحادثة...</div></div>';
      }
      try { list.scrollTop = 0; } catch (_) {}
      updateSupportJumpButton();
    }

    function renderSupportMessages(thread){
      var list = document.getElementById('siteSupportChatMessages');
      if (!list) return;
      list.removeAttribute('aria-busy');
      var messages = Array.isArray(thread && thread.messages) ? thread.messages.map(normalizeSupportMessage) : [];
      var firstRender = !supportChatState.hasRenderedMessages;
      var lastMessage = messages.length ? messages[messages.length - 1] : null;
      var shouldStickToBottom = firstRender || (lastMessage && lastMessage.sender === 'user') || shouldSupportAutoScroll(list);
      if (!messages.length && supportChatState.loading) {
        renderSupportMessagesLoading();
        return;
      }
      if (!messages.length) {
        list.innerHTML = '<div class="site-support-chat__empty">لا توجد رسائل بعد.</div>';
        updateSupportSelectionBar();
        supportChatState.hasRenderedMessages = true;
        if (shouldStickToBottom) scrollSupportMessagesToBottom({ force: firstRender, defer: !firstRender });
        else updateSupportJumpButton();
        return;
      }
      list.innerHTML = messages.map(function(message){
        var system = message.sender === 'system';
        var own = message.sender === 'user';
        var isAi = !own && isSupportAiAuthorName(message.authorName);
        var messageKey = getSupportMessageKey(thread || {}, message);
        var contactPayload = !own
          ? extractSupportContactLinksFromText(message.text)
          : { text: message.text, links: [] };
        var displayText = String(contactPayload.text || '');
        var contactLinksHtml = renderSupportContactLinks(contactPayload.links);
        var shouldTypeAi = isAi && !!displayText && !firstRender && !supportChatState.aiTypedMessageKeys[messageKey];
        if (isAi && firstRender) supportChatState.aiTypedMessageKeys[messageKey] = true;
        var selectedClass = isSupportMessageSelected(messageKey) ? ' is-selected' : '';
        if (system) {
          var ticketEventClass = /(?:إغلاق|فتح|إعادة\s+فتح)\s+(?:ال)?تذكرة/.test(String(message.text || '')) ? ' is-ticket-event' : '';
          return [
            '<div class="site-support-chat__system' + ticketEventClass + '" aria-live="polite">',
              '<i class="fa-solid fa-circle-info" aria-hidden="true"></i>',
              '<div class="site-support-chat__system-copy">',
                message.text ? '<strong>' + escapeSupport(message.text).replace(/\n/g, '<br>') + '</strong>' : '',
                '<span>' + escapeSupport(formatSupportTime(message.createdAt)) + '</span>',
              '</div>',
            '</div>'
          ].join('');
        }
        var messageImageUrl = sanitizeSupportImageUrl(message.imageUrl);
        var imageHtml = messageImageUrl
          ? '<button class="site-support-chat__image-btn" type="button" data-support-image="' + escapeSupport(messageImageUrl) + '" aria-label="عرض الصورة"><img src="' + escapeSupport(messageImageUrl) + '" alt=""></button>'
          : '';
        var messageAudioUrl = sanitizeSupportImageUrl(message.audioUrl);
        var audioHtml = messageAudioUrl
          ? '<audio class="site-support-chat__audio" controls preload="none" src="' + escapeSupport(messageAudioUrl) + '"></audio>'
          : '';
        var cardsHtml = renderSupportCards(message.cards);
        return [
          '<div class="site-support-chat__bubble ' + (own ? 'is-user' : 'is-admin') + (isAi ? ' is-ai' : '') + (shouldTypeAi ? ' is-typing' : '') + selectedClass + '" data-support-message-key="' + escapeSupport(messageKey) + '" role="button" tabindex="0" aria-selected="' + (selectedClass ? 'true' : 'false') + '">',
            '<span class="site-support-chat__select-mark" aria-hidden="true"><i class="fa-solid fa-check"></i></span>',
            displayText
              ? (shouldTypeAi
                ? '<div class="site-support-chat__text" data-support-ai-typing="1" data-support-ai-text="' + escapeSupport(displayText) + '"></div>'
                : '<div class="site-support-chat__text">' + escapeSupport(displayText).replace(/\n/g, '<br>') + '</div>')
              : '',
            contactLinksHtml,
            cardsHtml,
            imageHtml,
            audioHtml,
            '<span class="site-support-chat__meta">' + escapeSupport(formatSupportTime(message.createdAt)) + (isAi ? '<b>AI</b>' : '') + '</span>',
          '</div>'
        ].join('');
      }).join('');
      try {
        list.querySelectorAll('img').forEach(function(img){
          if (!img || img.complete) return;
          if (shouldStickToBottom) {
            img.addEventListener('load', function(){ scrollSupportMessagesToBottom(); }, { once: true });
            img.addEventListener('error', function(){ scrollSupportMessagesToBottom(); }, { once: true });
          }
        });
      } catch (_) {}
      updateSupportSelectionBar();
      supportChatState.hasRenderedMessages = true;
      animateSupportAiTyping(list, shouldStickToBottom);
      if (shouldStickToBottom) scrollSupportMessagesToBottom({ force: firstRender, defer: !firstRender });
      else updateSupportJumpButton();
    }

    function animateSupportAiTyping(list, shouldStickToBottom){
      if (!list) return;
      try {
        Array.prototype.forEach.call(list.querySelectorAll('[data-support-ai-typing="1"]'), function(node){
          var bubble = node.closest ? node.closest('.site-support-chat__bubble') : null;
          var key = bubble ? String(bubble.getAttribute('data-support-message-key') || '') : '';
          var fullText = String(node.getAttribute('data-support-ai-text') || '');
          node.removeAttribute('data-support-ai-typing');
          node.removeAttribute('data-support-ai-text');
          node.textContent = '';
          var index = 0;
          var chunkSize = Math.max(1, Math.ceil(fullText.length / 80));
          var step = function(){
            index = Math.min(fullText.length, index + chunkSize);
            node.textContent = fullText.slice(0, index);
            if (shouldStickToBottom) scrollSupportMessagesToBottom({ defer: false });
            if (index < fullText.length) {
              setTimeout(step, 12);
              return;
            }
            if (bubble) bubble.classList.remove('is-typing');
            if (key) supportChatState.aiTypedMessageKeys[key] = true;
          };
          step();
        });
      } catch (_) {}
    }

    function showSupportChatPageLoader(){
      supportChatPageLoaderCount += 1;
      if (supportChatPageLoaderCount !== 1) return;
      try { document.documentElement.classList.add('site-support-chat-loader-pending'); } catch (_) {}
      try { if (document.body) document.body.classList.add('site-support-chat-loader-pending'); } catch (_) {}
      try {
        if (typeof showPageLoader === 'function') {
          showPageLoader({ hold: true, replay: true });
          return;
        }
      } catch (_) {}
      try {
        var el = document.getElementById('preloader');
        if (!el) return;
        el.classList.remove('hidden', 'closing', 'auto-hide');
        el.style.display = 'flex';
        el.style.opacity = '1';
        el.style.visibility = 'visible';
        el.style.pointerEvents = 'auto';
      } catch (_) {}
    }

    function hideSupportChatPageLoader(){
      supportChatPageLoaderCount = Math.max(0, supportChatPageLoaderCount - 1);
      if (supportChatPageLoaderCount > 0) return;
      try { document.documentElement.classList.remove('site-support-chat-loader-pending'); } catch (_) {}
      try { if (document.body) document.body.classList.remove('site-support-chat-loader-pending'); } catch (_) {}
      try {
        if (typeof hidePageLoader === 'function') {
          hidePageLoader();
          return;
        }
      } catch (_) {}
      try {
        var el = document.getElementById('preloader');
        if (!el) return;
        el.classList.add('hidden');
        el.style.display = 'none';
        el.style.opacity = '0';
        el.style.visibility = 'hidden';
        el.style.pointerEvents = 'none';
      } catch (_) {}
    }

    function getSupportThreadVersion(thread){
      var messages = Array.isArray(thread && thread.messages) ? thread.messages.map(normalizeSupportMessage) : [];
      var last = messages.length ? messages[messages.length - 1] : null;
      return [
        thread && thread.updatedAt,
        thread && thread.unreadUser,
        thread && thread.unreadAdmin,
        messages.length,
        last && last.id,
        last && last.createdAt,
        last && last.text,
        last && last.imageUrl
      ].join('|');
    }

    function getSupportMessagesVersion(thread){
      var messages = Array.isArray(thread && thread.messages) ? thread.messages.map(normalizeSupportMessage) : [];
      return messages.map(function(message){
        return [
          message.id,
          message.sender,
          message.authorName,
          message.createdAt,
          message.text,
          message.imageUrl,
          getSupportCardsSignature(message.cards)
        ].join('|');
      }).join('||');
    }

    function renderSupportThread(thread, options){
      var opts = options || {};
      var incomingKey = getSupportIncomingMessageKey(thread || {});
      var previousIncomingKey = String(supportChatState.lastIncomingMessageKey || '');
      var previousThreadVersion = String(supportChatState.lastThreadVersion || '');
      var nextThreadVersion = getSupportThreadVersion(thread || {});
      var nextMessagesVersion = getSupportMessagesVersion(thread || {});
      supportChatState.thread = thread || supportChatState.thread || null;
      renderSupportBadge(supportChatState.thread);
      syncSupportTicketCloseButton(supportChatState.thread);
      if (!supportChatState.hasRenderedMessages || supportChatState.lastRenderedMessagesVersion !== nextMessagesVersion || opts.forceRender === true) {
        renderSupportMessages(supportChatState.thread);
        supportChatState.lastRenderedMessagesVersion = nextMessagesVersion;
      }
      if (incomingKey) {
        if (previousIncomingKey && previousIncomingKey !== incomingKey && opts.notify !== false) {
          notifySupportIncomingMessage(supportChatState.thread);
        }
        supportChatState.lastIncomingMessageKey = incomingKey;
      }
      supportChatState.lastThreadVersion = nextThreadVersion;
      if (isSupportChatActive()) {
        if (isSupportThreadTicketOpen(supportChatState.thread)) {
          if (supportChatState.realtimeDisabled) startSupportPolling();
          else startSupportRealtime().catch(function(){});
        } else {
          stopSupportPolling();
          stopSupportRealtime();
        }
      }
      return !!(previousThreadVersion && nextThreadVersion && previousThreadVersion !== nextThreadVersion);
    }

    function mergeSupportThreadMessages(threadMeta, messages){
      var base = supportChatState.thread && typeof supportChatState.thread === 'object' ? supportChatState.thread : {};
      var meta = threadMeta && typeof threadMeta === 'object' ? threadMeta : {};
      var currentMessages = Array.isArray(base.messages) ? base.messages.map(normalizeSupportMessage) : [];
      var nextMessages = currentMessages.slice();
      var seen = {};
      nextMessages.forEach(function(message){
        if (message && message.id) seen[String(message.id)] = true;
      });
      (Array.isArray(messages) ? messages : []).forEach(function(raw){
        var message = normalizeSupportMessage(raw);
        if (!message.id || seen[String(message.id)]) return;
        seen[String(message.id)] = true;
        nextMessages.push(message);
      });
      nextMessages.sort(function(a, b){
        return (Date.parse(a.createdAt || '') || 0) - (Date.parse(b.createdAt || '') || 0);
      });
      return Object.assign({}, base, meta, { messages: nextMessages });
    }

    function supportRealtimeDocId(uid){
      var clean = String(uid || '')
        .trim()
        .replace(/[^\\w.\\-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 140);
      return clean || 'user';
    }

    async function getSupportFirestore(){
      try {
        if (typeof window.initFirebaseApp === 'function') {
          await window.initFirebaseApp();
        } else if (typeof window.ensureFirebaseCompat === 'function') {
          await window.ensureFirebaseCompat();
        } else if (typeof window.__loadFirebaseCompat === 'function') {
          await window.__loadFirebaseCompat();
        }
      } catch (_) {}
      if (typeof firebase === 'undefined' || !firebase || typeof firebase.firestore !== 'function') {
        throw new Error('تعذر تشغيل التحديث الفوري للدعم.');
      }
      try {
        if ((!firebase.apps || !firebase.apps.length)) {
          var cfg = window.__getSiteFirebaseConfig
            ? window.__getSiteFirebaseConfig()
            : (window.__FIREBASE_CONFIG__ || {});
          if (cfg && cfg.apiKey) firebase.initializeApp(cfg);
        }
      } catch (_) {}
      if (!firebase.apps || !firebase.apps.length) {
        throw new Error('إعدادات Firebase غير جاهزة للتحديث الفوري.');
      }
      return firebase.firestore();
    }

    function supportIsRealtimePermissionError(err){
      var text = err && err.message ? String(err.message) : '';
      var code = String(err && err.code ? err.code : '').trim().toLowerCase();
      return code === 'permission-denied' ||
        code === 'permission_denied' ||
        /missing or insufficient permissions|permission denied|insufficient permissions/i.test(text);
    }

    function markSupportThreadReadFromRealtime(){
      if (!isSupportChatActive() || supportChatState.markReadInFlight) return;
      var thread = supportChatState.thread || {};
      if (!(Number(thread.unreadUser || 0) > 0)) return;
      var minThreadFetchMs = Math.max(60000, Number(supportChatState.pollDelayMs || 0) || 60000);
      var nowMs = Date.now();
      var remainingMs = supportChatState.lastThreadFetchAt
        ? minThreadFetchMs - (nowMs - supportChatState.lastThreadFetchAt)
        : 0;
      if (remainingMs > 0) {
        if (!supportChatState.markReadTimer) {
          supportChatState.markReadTimer = setTimeout(function(){
            supportChatState.markReadTimer = 0;
            markSupportThreadReadFromRealtime();
          }, remainingMs);
        }
        return;
      }
      supportChatState.lastThreadFetchAt = nowMs;
      supportChatState.markReadInFlight = true;
      callSupportApi('support-thread', {
        method: 'GET',
        params: {
          markRead: '1',
          force: '1'
        }
      }).then(function(payload){
        if (isSupportChatActive() && payload && payload.thread) renderSupportThread(payload.thread, { notify: false });
      }).catch(function(){}).finally(function(){
        supportChatState.markReadInFlight = false;
      });
    }

    function stopSupportRealtime(){
      supportChatState.realtimeRunId = Number(supportChatState.realtimeRunId || 0) + 1;
      if (typeof supportChatState.realtimeUnsubscribe === 'function') {
        try { supportChatState.realtimeUnsubscribe(); } catch (_) {}
      }
      supportChatState.realtimeUnsubscribe = null;
      if (supportChatState.realtimeRetryTimer) { try { clearTimeout(supportChatState.realtimeRetryTimer); } catch (_) {} supportChatState.realtimeRetryTimer = 0; }
      if (supportChatState.realtimeHeartbeat) { try { clearInterval(supportChatState.realtimeHeartbeat); } catch (_) {} supportChatState.realtimeHeartbeat = 0; }
      if (supportChatState.realtimeSock) { try { supportChatState.realtimeSock.close(); } catch (_) {} supportChatState.realtimeSock = null; }
      supportChatState.realtimeStarting = false;
      supportChatState.realtimeReady = false;
      supportChatState.realtimeRetries = 0;
    }

    // WS endpoint for the SupportChatRoom Durable Object push channel. The
    // Worker validates the Firebase token during the HTTP upgrade; role=user
    // pins threadId to the caller's own uid.
    function supportRealtimeWsUrl(auth){
      var base = getSupportWorkerBase();
      if (!base) return '';
      var url;
      try { url = new URL(base, window.location.href); } catch (_) { return ''; }
      url.protocol = (url.protocol === 'http:') ? 'ws:' : 'wss:';
      url.pathname = '/ws/support/chat';
      url.search = '';
      url.hash = '';
      url.searchParams.set('token', auth.idToken);
      url.searchParams.set('role', 'user');
      url.searchParams.set('uid', auth.uid);
      url.searchParams.set('threadId', auth.uid);
      try {
        var name = String((auth.user && auth.user.displayName) || '').trim();
        if (name) url.searchParams.set('username', name);
      } catch (_) {}
      // The session key is NOT put in the WS URL anymore (secrets don't belong
      // in URLs); the same-site njad_sess HttpOnly cookie rides the handshake,
      // and the server's WS auth is the Firebase idToken either way.
      return url.toString();
    }

    function supportShouldPollFallback(){
      return supportChatState.realtimeDisabled === true && isSupportThreadTicketOpen(supportChatState.thread);
    }

    function stopSupportPolling(){
      if (!supportChatState.pollTimer) return;
      clearTimeout(supportChatState.pollTimer);
      supportChatState.pollTimer = 0;
    }

    function scheduleSupportPolling(delayMs){
      stopSupportPolling();
      if (!isSupportChatActive() || !supportShouldPollFallback()) return;
      var delay = Number(delayMs);
      if (!Number.isFinite(delay) || delay < 0) delay = Number(supportChatState.pollDelayMs || 0);
      delay = Math.max(60000, delay || 60000);
      supportChatState.pollTimer = setTimeout(function(){
        supportRunPollingCycle();
      }, delay);
    }

    function supportRunPollingCycle(){
      if (!isSupportChatActive() || !supportShouldPollFallback()) {
        stopSupportPolling();
        return;
      }
      supportChatState.pollTimer = 0;
      Promise.resolve(loadSupportThread(true, { markRead: true, notify: false, force: true }))
        .catch(function(){})
        .finally(function(){
          if (!isSupportChatActive()) {
            stopSupportPolling();
            return;
          }
          if (supportShouldPollFallback()) scheduleSupportPolling();
          else stopSupportPolling();
        });
    }

    function startSupportPolling(){
      if (!isSupportChatActive()) {
        stopSupportPolling();
        return false;
      }
      if (!supportShouldPollFallback()) {
        stopSupportPolling();
        return false;
      }
      if (supportChatState.pollTimer) return true;
      scheduleSupportPolling(supportChatState.pollDelayMs);
      return true;
    }

    async function startSupportRealtime(){
      // Real-time push via the SupportChatRoom Durable Object (/ws/support/chat).
      // Any inbound event (an admin reply written over REST pings the DO, which
      // broadcasts {type:"refresh"}) triggers an immediate silent refetch of the
      // thread. Sending stays on the REST path, and the 60s polling remains the
      // correctness fallback: whenever the socket is down realtimeDisabled=true
      // routes every lifecycle call site back to startSupportPolling().
      if (!isSupportChatActive()) {
        stopSupportRealtime();
        return false;
      }
      if (typeof WebSocket !== 'function') {
        supportChatState.realtimeDisabled = true;
        if (supportShouldPollFallback()) startSupportPolling();
        return false;
      }
      if (supportChatState.realtimeSock || supportChatState.realtimeStarting) return true;
      var runId = Number(supportChatState.realtimeRunId || 0) + 1;
      supportChatState.realtimeRunId = runId;
      supportChatState.realtimeStarting = true;
      try {
        var auth = await buildSupportAuthPayload();
        if (!isSupportChatActive() || supportChatState.realtimeRunId !== runId) return false;
        var wsUrl = supportRealtimeWsUrl(auth);
        if (!wsUrl) throw new Error('ws_base_unavailable');
        var sock = new WebSocket(wsUrl);
        supportChatState.realtimeSock = sock;
        sock.onopen = function(){
          if (supportChatState.realtimeRunId !== runId) return;
          supportChatState.realtimeDisabled = false;
          supportChatState.realtimeReady = true;
          supportChatState.realtimeError = '';
          supportChatState.realtimeRetries = 0;
          if (supportChatState.realtimeHeartbeat) { try { clearInterval(supportChatState.realtimeHeartbeat); } catch (_) {} }
          supportChatState.realtimeHeartbeat = setInterval(function(){
            try { if (sock.readyState === 1) sock.send(JSON.stringify({ type: 'ping' })); } catch (_) {}
          }, 30000);
          stopSupportPolling();
        };
        sock.onmessage = function(event){
          if (supportChatState.realtimeRunId !== runId) return;
          var data = null;
          try { data = JSON.parse(String(event.data || '')); } catch (_) { data = null; }
          var type = data && data.type ? String(data.type).toLowerCase() : '';
          if (type === 'message' || type === 'refresh' || type === 'history') {
            supportChatState.lastThreadFetchAt = 0; // bypass the silent-fetch 60s throttle for push
            loadSupportThread(true, { markRead: supportChatState.open === true, notify: true, force: true }).catch(function(){});
          }
        };
        var onGone = function(){
          if (supportChatState.realtimeSock === sock) supportChatState.realtimeSock = null;
          if (supportChatState.realtimeHeartbeat) { try { clearInterval(supportChatState.realtimeHeartbeat); } catch (_) {} supportChatState.realtimeHeartbeat = 0; }
          if (supportChatState.realtimeRunId !== runId) return;
          supportChatState.realtimeReady = false;
          supportChatState.realtimeDisabled = true;
          if (isSupportChatActive() && supportShouldPollFallback()) startSupportPolling();
          var tries = Number(supportChatState.realtimeRetries || 0);
          supportChatState.realtimeRetries = tries + 1;
          var delay = Math.min(30000, 1500 * Math.pow(2, tries));
          if (supportChatState.realtimeRetryTimer) { try { clearTimeout(supportChatState.realtimeRetryTimer); } catch (_) {} }
          supportChatState.realtimeRetryTimer = setTimeout(function(){
            supportChatState.realtimeRetryTimer = 0;
            if (!isSupportChatActive() || supportChatState.realtimeRunId !== runId) return;
            supportChatState.realtimeDisabled = false;
            startSupportRealtime().catch(function(){});
          }, delay);
        };
        sock.onclose = onGone;
        sock.onerror = function(){ try { sock.close(); } catch (_) {} };
        return true;
      } catch (err) {
        supportChatState.realtimeError = err && err.message ? err.message : 'realtime_failed';
        supportChatState.realtimeDisabled = true;
        if (supportShouldPollFallback()) startSupportPolling();
        return false;
      } finally {
        if (supportChatState.realtimeRunId === runId) {
          supportChatState.realtimeStarting = false;
        }
      }
    }

    async function loadSupportThread(silent, options){
      var opts = options || {};
      if (!isSupportChatActive() && !opts.allowInactive) {
        return { success: true, ok: true, skipped: true, inactive: true };
      }
      if (supportChatState.loading) return;
      var minThreadFetchMs = Math.max(60000, Number(supportChatState.pollDelayMs || 0) || 60000);
      var nowMs = Date.now();
      if (silent && supportChatState.lastThreadFetchAt && (nowMs - supportChatState.lastThreadFetchAt) < minThreadFetchMs) {
        return { success: true, ok: true, skipped: true, throttled: true };
      }
      supportChatState.lastThreadFetchAt = nowMs;
      supportChatState.loading = true;
      if (!silent) setSupportChatStatus('جاري تحميل المحادثة...');
      var usePageLoader = !silent && isSupportChatActive();
      if (usePageLoader) {
        showSupportChatPageLoader();
        renderSupportMessagesLoading();
      }
      try {
        var markRead = opts.markRead != null ? opts.markRead : isSupportChatActive();
        var payload = await callSupportApi('support-thread', {
          method: 'GET',
          params: {
            markRead: markRead ? '1' : '0',
            force: opts.force ? '1' : ''
          }
        });
        if (!isSupportChatActive() && !opts.allowInactive) {
          return Object.assign({}, payload || {}, { skippedRender: true, inactive: true });
        }
        supportChatState.loading = false;
        var changed = renderSupportThread(payload.thread || null, { notify: opts.notify !== false });
        if (!opts.keepStatus) setSupportChatStatus('');
        payload.__changed = changed;
        return payload;
      } catch (err) {
        if (!silent) setSupportChatStatus(err && err.message ? err.message : 'تعذر تحميل الدعم الفني.');
        throw err;
      } finally {
        supportChatState.loading = false;
        if (usePageLoader) hideSupportChatPageLoader();
      }
    }

    function stopSupportBadgePolling(){
      if (!supportChatState.badgePollTimer) return;
      clearTimeout(supportChatState.badgePollTimer);
      supportChatState.badgePollTimer = 0;
    }

    function scheduleSupportBadgePolling(delayMs){
      stopSupportBadgePolling();
    }

    function startSupportBadgePolling(){
      stopSupportBadgePolling();
    }

    var supportImageViewerState = { url: '', scale: 1 };

    function supportImageViewerFilename(url){
      try {
        var parsed = new URL(String(url || ''), window.location.href);
        var name = decodeURIComponent((parsed.pathname.split('/').pop() || '').split('?')[0] || '');
        return name || 'support-image';
      } catch (_) {
        return 'support-image';
      }
    }

    function clampSupportImageScale(value){
      var next = Number(value);
      if (!Number.isFinite(next)) next = 1;
      return Math.max(.5, Math.min(4, Math.round(next * 100) / 100));
    }

    function updateSupportImageViewerScale(){
      var viewer = document.getElementById('siteSupportImageViewer');
      if (!viewer) return;
      var img = viewer.querySelector('[data-support-viewer-image]');
      var label = viewer.querySelector('[data-support-viewer-scale]');
      var scale = clampSupportImageScale(supportImageViewerState.scale);
      supportImageViewerState.scale = scale;
      if (img) {
        img.style.transform = 'scale(' + scale + ')';
        img.classList.toggle('is-zoomed', scale > 1);
      }
      if (label) label.textContent = Math.round(scale * 100) + '%';
    }

    function closeSupportImageViewer(){
      var viewer = document.getElementById('siteSupportImageViewer');
      if (!viewer) return;
      viewer.hidden = true;
      supportImageViewerState.url = '';
      supportImageViewerState.scale = 1;
      var img = viewer.querySelector('[data-support-viewer-image]');
      if (img) {
        img.removeAttribute('src');
        img.style.transform = 'scale(1)';
      }
    }

    async function downloadSupportImage(url){
      var safeUrl = String(url || '').trim();
      if (!safeUrl) return;
      var filename = supportImageViewerFilename(safeUrl);
      try {
        var res = await fetch(safeUrl, { mode: 'cors', credentials: 'omit', cache: 'no-store' });
        if (res && res.ok) {
          var blob = await res.blob();
          var objectUrl = URL.createObjectURL(blob);
          var link = document.createElement('a');
          link.href = objectUrl;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          link.remove();
          setTimeout(function(){ try { URL.revokeObjectURL(objectUrl); } catch (_) {} }, 1200);
          return;
        }
      } catch (_) {}
      var fallback = document.createElement('a');
      fallback.href = safeUrl;
      fallback.target = '_blank';
      fallback.rel = 'noopener noreferrer';
      fallback.download = filename;
      document.body.appendChild(fallback);
      fallback.click();
      fallback.remove();
    }

    function ensureSupportImageViewer(){
      var existing = document.getElementById('siteSupportImageViewer');
      if (existing) return existing;
      var viewer = document.createElement('div');
      viewer.id = 'siteSupportImageViewer';
      viewer.className = 'site-support-image-viewer';
      viewer.hidden = true;
      viewer.setAttribute('role', 'dialog');
      viewer.setAttribute('aria-modal', 'true');
      viewer.setAttribute('aria-label', 'عارض الصورة');
      viewer.innerHTML = [
        '<div class="site-support-image-viewer__bar">',
          '<button type="button" data-support-viewer-close aria-label="إغلاق"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>',
          '<div class="site-support-image-viewer__actions">',
            '<button type="button" data-support-viewer-zoom-out aria-label="تصغير"><i class="fa-solid fa-magnifying-glass-minus" aria-hidden="true"></i></button>',
            '<span data-support-viewer-scale>100%</span>',
            '<button type="button" data-support-viewer-zoom-in aria-label="تكبير"><i class="fa-solid fa-magnifying-glass-plus" aria-hidden="true"></i></button>',
            '<button type="button" data-support-viewer-download aria-label="تنزيل"><i class="fa-solid fa-download" aria-hidden="true"></i></button>',
          '</div>',
        '</div>',
        '<div class="site-support-image-viewer__stage" data-support-viewer-stage>',
          '<img data-support-viewer-image alt="">',
        '</div>'
      ].join('');
      document.body.appendChild(viewer);
      viewer.querySelector('[data-support-viewer-close]').addEventListener('click', closeSupportImageViewer);
      viewer.querySelector('[data-support-viewer-zoom-out]').addEventListener('click', function(){
        supportImageViewerState.scale = clampSupportImageScale(supportImageViewerState.scale - .25);
        updateSupportImageViewerScale();
      });
      viewer.querySelector('[data-support-viewer-zoom-in]').addEventListener('click', function(){
        supportImageViewerState.scale = clampSupportImageScale(supportImageViewerState.scale + .25);
        updateSupportImageViewerScale();
      });
      viewer.querySelector('[data-support-viewer-download]').addEventListener('click', function(){
        downloadSupportImage(supportImageViewerState.url).catch(function(){});
      });
      viewer.addEventListener('click', function(ev){
        if (ev && ev.target === viewer) closeSupportImageViewer();
      });
      var stage = viewer.querySelector('[data-support-viewer-stage]');
      if (stage) {
        stage.addEventListener('wheel', function(ev){
          if (!ev) return;
          ev.preventDefault();
          supportImageViewerState.scale = clampSupportImageScale(supportImageViewerState.scale + (ev.deltaY < 0 ? .15 : -.15));
          updateSupportImageViewerScale();
        }, { passive: false });
      }
      return viewer;
    }

    function openSupportImageViewer(url){
      var safeUrl = sanitizeSupportImageUrl(url);
      if (!safeUrl) return;
      var viewer = ensureSupportImageViewer();
      supportImageViewerState.url = safeUrl;
      supportImageViewerState.scale = 1;
      var img = viewer.querySelector('[data-support-viewer-image]');
      if (img) {
        img.src = safeUrl;
        img.alt = supportImageViewerFilename(safeUrl);
      }
      viewer.hidden = false;
      updateSupportImageViewerScale();
    }

    function setSupportChatOpen(open){
      var panel = document.getElementById('siteSupportChatPanel');
      var fab = document.getElementById('siteSupportChatFab');
      if (!panel || !fab) return;
      if (open && !isSupportChatCustomerLoggedIn(supportChatAuthUser)) {
        syncSupportChatVisibility(null);
        return;
      }
      syncSupportChatViewportHeight();
      supportChatState.open = !!open;
      if (!supportChatState.open) {
        try {
          var focused = document.activeElement;
          if (focused && panel.contains(focused)) {
            if (!fab.hidden && typeof fab.focus === 'function') fab.focus({ preventScroll: true });
            else if (typeof focused.blur === 'function') focused.blur();
          }
        } catch (_) {}
      } else {
        try { panel.removeAttribute('inert'); } catch (_) {}
      }
      panel.hidden = !supportChatState.open;
      panel.setAttribute('aria-hidden', supportChatState.open ? 'false' : 'true');
      try {
        if (supportChatState.open) panel.removeAttribute('inert');
        else panel.setAttribute('inert', '');
      } catch (_) {}
      fab.setAttribute('aria-expanded', supportChatState.open ? 'true' : 'false');
      try {
        document.documentElement.classList.toggle('site-support-page-open', supportChatState.open);
        document.body.classList.toggle('site-support-page-open', supportChatState.open);
      } catch (_) {}
      if (supportChatState.open) {
        try {
          var active = document.activeElement;
          var tag = active && active.tagName ? String(active.tagName).toUpperCase() : '';
          if (active && (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || active.isContentEditable) && typeof active.blur === 'function') {
            active.blur();
          }
        } catch (_) {}
        try {
          if (supportChatState.titleBase) document.title = supportChatState.titleBase;
        } catch (_) {}
        ensureSupportNotificationPermission();
        loadSupportThread(false, { markRead: true, notify: false, force: true }).catch(function(){});
        startSupportPolling();
        setTimeout(function(){
          scrollSupportMessagesToBottom({ force: true, defer: false });
        }, 80);
      } else {
        closeSupportImageViewer();
        clearSupportMessageSelection({ render: false });
        stopSupportPolling();
        stopSupportBadgePolling();
        stopSupportRealtime();
        setSupportChatStatus('');
      }
    }

    function syncSupportChatViewportHeight(){
      var height = 0;
      try { height = Math.max(height, Number(window.innerHeight || 0)); } catch (_) {}
      try { height = Math.max(height, Number(document.documentElement && document.documentElement.clientHeight || 0)); } catch (_) {}
      if (!height || !Number.isFinite(height)) return;
      var value = Math.max(320, Math.round(height)) + 'px';
      try { document.documentElement.style.setProperty('--site-support-chat-vh', value); } catch (_) {}
      try {
        var panel = document.getElementById('siteSupportChatPanel');
        if (panel) panel.style.setProperty('--site-support-chat-vh', value);
      } catch (_) {}
    }

    function setSupportSelectedImage(file){
      supportChatState.imageFile = file || null;
      var preview = document.getElementById('siteSupportChatPreview');
      var attach = document.getElementById('siteSupportChatAttach');
      if (preview) {
        if (supportChatState.imageFile) {
          preview.hidden = false;
          preview.textContent = 'تم اختيار صورة: ' + String(supportChatState.imageFile.name || 'صورة');
        } else {
          preview.hidden = true;
          preview.textContent = '';
        }
      }
      if (attach) attach.classList.toggle('has-image', !!supportChatState.imageFile);
    }

    function clearSupportSelectedImage(){
      var fileInput = document.getElementById('siteSupportChatImage');
      try { if (fileInput) fileInput.value = ''; } catch (_) {}
      setSupportSelectedImage(null);
    }

    function setSupportSendButtonBusy(busy){
      var sendBtn = document.getElementById('siteSupportChatSend');
      if (!sendBtn) return;
      sendBtn.disabled = !!busy;
      sendBtn.classList.toggle('is-sending', !!busy);
      sendBtn.setAttribute('aria-busy', busy ? 'true' : 'false');
      sendBtn.setAttribute('aria-label', 'إرسال');
      sendBtn.innerHTML = busy
        ? '<span class="site-support-chat__send-loader" aria-hidden="true"><span></span><span></span><span></span></span>'
        : '<i class="fa-solid fa-paper-plane" aria-hidden="true"></i>';
      syncSupportTicketCloseButton();
    }

    async function submitSupportMessage(){
      if (supportChatState.sending) return;
      var input = document.getElementById('siteSupportChatInput');
      var text = input ? String(input.value || '').trim() : '';
      var imageFile = supportChatState.imageFile || null;
      if (!text && !imageFile) {
        setSupportChatStatus('اكتب رسالتك أو أرفق صورة أولاً.');
        return;
      }
      supportChatState.sending = true;
      setSupportSendButtonBusy(true);
      try {
        setSupportChatStatus('');
        var imageUrl = imageFile ? await uploadSupportImageFile(imageFile) : '';
        var payload = await callSupportApi('support-message', {
          method: 'POST',
          body: { text: text, imageUrl: imageUrl }
        });
        if (input) input.value = '';
        clearSupportSelectedImage();
        clearSupportMessageSelection({ render: false });
        if (payload && Array.isArray(payload.messages)) {
          renderSupportThread(mergeSupportThreadMessages(payload.thread || null, payload.messages), { notify: false });
        } else {
          renderSupportThread(payload.thread || null, { notify: false });
        }
        setSupportChatStatus('');
      } catch (err) {
        setSupportChatStatus(err && err.message ? err.message : 'تعذر إرسال الرسالة.');
      } finally {
        supportChatState.sending = false;
        setSupportSendButtonBusy(false);
      }
    }

    async function submitSupportCloseTicket(){
      if (supportChatState.sending) return;
      if (!isSupportThreadTicketOpen(supportChatState.thread)) {
        syncSupportTicketCloseButton();
        return;
      }
      supportChatState.sending = true;
      setSupportSendButtonBusy(true);
      try {
        setSupportChatStatus('');
        var payload = await callSupportApi('support-message', {
          method: 'POST',
          body: {
            action: 'close_ticket',
            type: 'close_ticket',
            chatId: String((supportChatAuthUser && supportChatAuthUser.uid) || (supportChatState.thread && supportChatState.thread.userUid) || '')
          }
        });
        clearSupportMessageSelection({ render: false });
        if (payload && Array.isArray(payload.messages)) {
          renderSupportThread(mergeSupportThreadMessages(payload.thread || null, payload.messages), { notify: false });
        } else {
          renderSupportThread(payload.thread || null, { notify: false });
        }
        setSupportChatStatus(payload && payload.message ? payload.message : 'تم إغلاق التذكرة.');
      } catch (err) {
        setSupportChatStatus(err && err.message ? err.message : 'تعذر إغلاق التذكرة.');
      } finally {
        supportChatState.sending = false;
        setSupportSendButtonBusy(false);
        syncSupportTicketCloseButton();
      }
    }

    function navigateSupportRoute(routeKey, hashValue){
      var route = String(routeKey || '').trim();
      var hash = String(hashValue || (route ? '#/' + route : '')).trim();
      try {
        if (route && typeof navigate === 'function') {
          navigate(route);
          return true;
        }
      } catch (_) {}
      try {
        if (hash && typeof window.navigateHomeHash === 'function') {
          window.navigateHomeHash(hash, route || hash.replace(/^#\/?/, ''));
          return true;
        }
      } catch (_) {}
      try {
        if (hash) {
          if (String(location.hash || '') !== hash) location.hash = hash;
          else if (route && typeof window.__reloadInlineRoute === 'function') window.__reloadInlineRoute(route);
          return true;
        }
      } catch (_) {}
      return false;
    }

    // `__manual_branch__<realId>` are synthetic wrapper keys the catalog tree builder
    // flattens away (products get re-homed under the real category), so the D1
    // load-section endpoint only knows the bare id. Strip the prefix so section
    // lookups target the real section instead of a 404-ing wrapper key.
    function stripSupportManualBranchId(id){
      var v = String(id == null ? '' : id).trim();
      if (!v) return '';
      var m = v.match(/^__manual_branch__(?:__|[_-])?(.+)$/i);
      return (m && m[1]) ? m[1].trim() : v;
    }

    // Resolve the owning-section slug (game key) for a product id from any cached
    // catalog so the support "buy" card can open the product's real section even when
    // the AI card carries no gameSlug. Mirrors resolveFavoriteCatalogSlugByItemId /
    // resolveCatalogGameKeyByItemId, but self-contained so it also works in header.js.
    function resolveSupportCatalogSlugByItemId(itemId, fallback){
      var lookup = String(itemId == null ? '' : itemId).trim().toLowerCase();
      var resolved = String(fallback || '').trim();
      if (!lookup) return resolved;
      var catalogs = [];
      try {
        if (window.__CATALOG_CATALOG_CACHE__ && window.__CATALOG_CATALOG_CACHE__.items) {
          catalogs.push(window.__CATALOG_CATALOG_CACHE__);
        }
      } catch (_) {}
      try {
        for (var li = 0; li < localStorage.length; li += 1) {
          var storeKey = String(localStorage.key(li) || '');
          if (storeKey.indexOf('catalog:cache:v9:') !== 0) continue;
          var raw = localStorage.getItem(storeKey);
          if (!raw) continue;
          var parsedCache = JSON.parse(raw);
          if (parsedCache && parsedCache.catalog && parsedCache.catalog.items) {
            catalogs.push(parsedCache.catalog);
          }
        }
      } catch (_) {}
      for (var c = 0; c < catalogs.length; c += 1) {
        var items = catalogs[c] && catalogs[c].items;
        if (!items || typeof items !== 'object') continue;
        var gameKeys = Object.keys(items);
        for (var g = 0; g < gameKeys.length; g += 1) {
          var gameKey = gameKeys[g];
          var bucket = items[gameKey];
          if (!bucket || typeof bucket !== 'object') continue;
          var itemKeys = Object.keys(bucket);
          for (var i = 0; i < itemKeys.length; i += 1) {
            var itemKey = itemKeys[i];
            var meta = bucket[itemKey] && typeof bucket[itemKey] === 'object' ? bucket[itemKey] : {};
            var candidates = [itemKey, meta.id, meta.itemId, meta.item_id, meta.catalogItemId, meta.providerItemId, meta.provider_item_id, meta.itemKey, meta.item_key, meta.key];
            for (var k = 0; k < candidates.length; k += 1) {
              if (String(candidates[k] == null ? '' : candidates[k]).trim().toLowerCase() === lookup) {
                return String(gameKey || resolved || '').trim();
              }
            }
          }
        }
      }
      return resolved;
    }

    function openSupportProductCard(button){
      var productId = String(button && (button.getAttribute('data-product-id') || button.getAttribute('data-card-id')) || '').trim();
      var gameSlug = String(button && button.getAttribute('data-game-slug') || '').trim();
      var sectionId = String(button && button.getAttribute('data-section-id') || '').trim();
      if (!productId && !gameSlug && !sectionId) {
        setSupportChatStatus('تعذر فتح المنتج من الكرت.');
        return;
      }
      var resolvedSlug = gameSlug;
      if (productId) {
        try { resolvedSlug = resolveSupportCatalogSlugByItemId(productId, gameSlug) || gameSlug; } catch (_) { resolvedSlug = gameSlug; }
      }
      try { if (button && typeof button.blur === 'function') button.blur(); } catch (_) {}
      try { setSupportChatOpen(false); } catch (_) {}

      function applyPendingState(slug){
        try {
          window.__CATALOG_INLINE_ITEM_ID__ = productId || '';
          window.__CATALOG_INLINE_ITEM_SLUG__ = slug || productId || '';
          window.__CATALOG_INLINE_FORCE_MODAL__ = productId ? '1' : '';
          window.__CATALOG_INLINE_MODAL_ONLY__ = '';
          window.__CATALOG_INLINE_MODAL_ONLY_SOURCE__ = 'support';
          window.__CATALOG_INLINE_KEEP_PAGE_FOR_FORCE_MODAL__ = productId ? '1' : '';
          window.__CATALOG_SUPPRESS_CATEGORY_FETCH_UNTIL__ = Date.now() + 8000;
          window.__CATALOG_PRODUCT_CLICK_LOCK_UNTIL__ = Date.now() + 8000;
          window.__CATALOG_PRODUCT_CLICK_LOCK_SLUG__ = slug || productId || '';
        } catch (_) {}
      }
      function openInlineNow(slug){
        applyPendingState(slug);
        try {
          if (slug && typeof window.__openCatalogInline === 'function') {
            window.__openCatalogInline(slug, 'games');
            return;
          }
        } catch (_) {}
        if (slug) {
          navigateSupportRoute('games', '#/games/' + encodeURIComponent(slug));
        } else {
          navigateSupportRoute('games', '#/games');
        }
      }

      // Hydrate ONLY the product's real owning section (load-section&id=…) through the
      // D1 lazy engine before opening, so clicking "buy" never triggers the whole
      // catalog load-categories request — and never a burst of wrong-section loads.
      var d1 = null;
      try { d1 = window.__catalogD1; } catch (_) { d1 = null; }
      var canLazy = !!(productId && d1 && typeof d1.isEnabled === 'function' && d1.isEnabled() && typeof d1.hydrateSection === 'function');
      if (!canLazy) { openInlineNow(resolvedSlug); return; }
      // Hydrate exactly ONE section id, then open the product modal on the game-bucket
      // key the product now lives under (falling back to the section id itself). The
      // raw __manual_branch__ wrapper is stripped to the bare id load-section knows.
      function hydrateSectionThenOpen(rawSectionId){
        var target = stripSupportManualBranchId(rawSectionId);
        if (!target) { openInlineNow(resolvedSlug); return; }
        Promise.resolve(d1.hydrateSection(target, { pathParts: [target], silentRender: true }))
          .then(function(){
            var found = '';
            try { found = resolveSupportCatalogSlugByItemId(productId, ''); } catch (_) { found = ''; }
            openInlineNow(found || resolvedSlug || target);
          }, function(){ openInlineNow(resolvedSlug || target); });
      }
      // The product's REAL owning section id (catalog_products.node_id) is the only
      // reliable source: the card-carried sectionId can be a stale/synthetic wrapper
      // (e.g. __manual_branch__…) that points at the WRONG section, so trusting it and
      // iterating the card's ids fired extra load-section requests for sections the
      // product isn't even in. Ask D1 for the authoritative id and hydrate ONLY that.
      // The card ids stay as a fallback for the rare case locate-product yields nothing.
      function openViaCardFallback(){
        var fallbackId = stripSupportManualBranchId(sectionId) || resolvedSlug || gameSlug;
        if (fallbackId) { hydrateSectionThenOpen(fallbackId); return; }
        openInlineNow(resolvedSlug);
      }
      if (typeof d1.locateProductSection === 'function') {
        Promise.resolve(d1.locateProductSection(productId)).then(function(locatedId){
          var authoritative = String(locatedId || '').trim();
          if (authoritative) { hydrateSectionThenOpen(authoritative); return; }
          openViaCardFallback();
        }, function(){ openViaCardFallback(); });
      } else {
        openViaCardFallback();
      }
    }

    function tryOpenSupportDepositMethod(methodId, country, attempt){
      var id = String(methodId || '').trim();
      var tries = Number(attempt || 0);
      if (!id) return;
      try {
        if (typeof window.__depositInlineOpenMethodById === 'function') {
          Promise.resolve(window.__depositInlineOpenMethodById(id, { country: country || '', source: 'support_chat' }))
            .then(function(ok){
              if (ok) return;
              if (tries < 18) setTimeout(function(){ tryOpenSupportDepositMethod(id, country, tries + 1); }, 350);
            })
            .catch(function(){
              if (tries < 18) setTimeout(function(){ tryOpenSupportDepositMethod(id, country, tries + 1); }, 350);
            });
          return;
        }
      } catch (_) {}
      try {
        var escaped = (window.CSS && CSS.escape) ? CSS.escape(id) : id.replace(/"/g, '\\"');
        var card = document.querySelector('#depositInlineApp [data-method-id="' + escaped + '"]');
        if (card && typeof card.click === 'function') {
          card.click();
          return;
        }
      } catch (_) {}
      if (tries < 18) setTimeout(function(){ tryOpenSupportDepositMethod(id, country, tries + 1); }, 350);
    }

    function openSupportDepositCard(button){
      var methodId = String(button && (button.getAttribute('data-method-id') || button.getAttribute('data-card-id')) || '').trim();
      var country = String(button && button.getAttribute('data-country') || '').trim();
      try {
        window.__SUPPORT_PENDING_DEPOSIT_METHOD__ = { methodId: methodId, country: country, ts: Date.now() };
        sessionStorage.setItem('support:pendingDepositMethod', JSON.stringify(window.__SUPPORT_PENDING_DEPOSIT_METHOD__));
      } catch (_) {}
      try { setSupportChatOpen(false); } catch (_) {}
      navigateSupportRoute('deposit', '#/deposit');
      if (methodId) setTimeout(function(){ tryOpenSupportDepositMethod(methodId, country, 0); }, 450);
    }

    async function submitSupportObjection(orderCode, reason){
      if (supportChatState.sending) return;
      var code = String(orderCode || '').trim();
      var cleanReason = String(reason || '').trim();
      if (!cleanReason) return;
      supportChatState.sending = true;
      try {
        setSupportChatStatus('جاري رفع الاعتراض...');
        var text = (code ? ('\u0627\u0639\u062a\u0631\u0627\u0636 \u0639\u0644\u0649 \u0627\u0644\u0637\u0644\u0628 ' + code) : '\u0627\u0639\u062a\u0631\u0627\u0636 \u0639\u0644\u0649 \u0637\u0644\u0628') + '\n\u0627\u0644\u0633\u0628\u0628: ' + cleanReason;
        var payload = await callSupportApi('support-message', {
          method: 'POST',
          body: {
            action: 'order_objection',
            text: text,
            message: text,
            chatId: String((supportChatAuthUser && supportChatAuthUser.uid) || (supportChatState.thread && supportChatState.thread.userUid) || ''),
            objection: {
              orderCode: code,
              reason: cleanReason
            }
          }
        });
        clearSupportMessageSelection({ render: false });
        if (payload && Array.isArray(payload.messages)) {
          renderSupportThread(mergeSupportThreadMessages(payload.thread || null, payload.messages), { notify: false });
        } else {
          renderSupportThread(payload.thread || null, { notify: false });
        }
        setSupportChatStatus('تم رفع الاعتراض للإدارة.');
      } catch (err) {
        setSupportChatStatus(err && err.message ? err.message : 'تعذر رفع الاعتراض.');
      } finally {
        supportChatState.sending = false;
      }
    }

    async function submitSupportOpenTicket(){
      if (supportChatState.sending) return;
      supportChatState.sending = true;
      setSupportSendButtonBusy(true);
      try {
        setSupportChatStatus('جاري فتح تذكرة الدعم...');
        var payload = await callSupportApi('support-message', {
          method: 'POST',
          body: {
            action: 'open_ticket',
            type: 'open_ticket',
            chatId: String((supportChatAuthUser && supportChatAuthUser.uid) || (supportChatState.thread && supportChatState.thread.userUid) || '')
          }
        });
        clearSupportMessageSelection({ render: false });
        if (payload && Array.isArray(payload.messages)) {
          renderSupportThread(mergeSupportThreadMessages(payload.thread || null, payload.messages), { notify: false });
        } else {
          renderSupportThread(payload.thread || null, { notify: false });
        }
        setSupportChatStatus(payload && payload.message ? payload.message : 'تم فتح تذكرة الدعم.');
      } catch (err) {
        setSupportChatStatus(err && err.message ? err.message : 'تعذر فتح تذكرة الدعم.');
      } finally {
        supportChatState.sending = false;
        setSupportSendButtonBusy(false);
      }
    }

    function handleSupportCardAction(button){
      var action = String(button && button.getAttribute('data-support-card-action') || '').trim();
      if (action === 'open_ticket') {
        submitSupportOpenTicket().catch(function(){});
        return;
      }
      if (action === 'open_product') {
        openSupportProductCard(button);
        return;
      }
      if (action === 'open_deposit') {
        openSupportDepositCard(button);
        return;
      }
      if (action === 'start_objection') {
        var orderCode = String(button && button.getAttribute('data-order-code') || '').trim();
        var promptText = orderCode
          ? 'اكتب سبب الاعتراض على الطلب ' + orderCode + ':'
          : 'اكتب سبب الاعتراض لو سمحت:';
        var reason = '';
        try { reason = window.prompt(promptText) || ''; } catch (_) { reason = ''; }
        reason = String(reason || '').trim();
        if (!reason) {
          setSupportChatStatus('اكتب سبب الاعتراض حتى نقدر نرفعه للإدارة.');
          return;
        }
        submitSupportObjection(orderCode, reason).catch(function(){});
      }
    }

    function mountSupportChat(){
      if (!document.body) {
        setTimeout(mountSupportChat, 50);
        return;
      }
      if (document.getElementById('siteSupportChatFab')) return;
      var style = document.createElement('style');
      style.textContent = `
        #siteSupportChatFab{
          --support-chat-fab-lift:0px;
          position:fixed;
          left:max(12px,calc(env(safe-area-inset-left,0px) + 12px));
          bottom:calc(max(82px,calc(env(safe-area-inset-bottom,0px) + 82px)) + var(--support-chat-fab-lift,0px));
          z-index:9301;
          width:56px;
          height:54px;
          border:0;
          border-radius:50% 50% 50% 14px;
          display:grid;
          place-items:center;
          cursor:pointer;
          color:#fff;
          background:linear-gradient(
            145deg,
            var(--site-accent-runtime-light, var(--primary-light, var(--accent-theme, #cbd5e1))) 0%,
            var(--site-accent-runtime, var(--accent-theme, #64748b)) 58%,
            var(--site-accent-runtime-strong, var(--primary-dark, var(--accent-theme, #334155))) 100%
          );
          box-shadow:0 16px 28px rgba(var(--site-accent-rgb,107,114,128),.3),0 8px 18px rgba(9,14,38,.18);
          transition:bottom .24s cubic-bezier(.22,1,.36,1),transform .18s ease,box-shadow .18s ease;
        }
        #siteSupportChatFab i{font-size:1.28rem}
        #siteSupportChatBadge{
          position:absolute;
          top:-5px;
          right:-5px;
          min-width:22px;
          height:22px;
          padding:0 6px;
          border-radius:999px;
          display:grid;
          place-items:center;
          background:#fb7185;
          color:#fff;
          font-size:.74rem;
          font-weight:900;
          border:2px solid #101720;
        }
        #siteSupportChatBadge[hidden]{display:none!important}
        #siteSupportChatFab[hidden],
        #siteSupportChatFab.support-auth-hidden{
          display:none!important;
        }
        html.site-support-page-open,
        body.site-support-page-open{
          overflow:hidden!important;
        }
        body.site-support-page-open #siteSupportChatFab{
          display:none!important;
        }
        html.site-support-chat-loader-pending #preloader,
        body.site-support-chat-loader-pending #preloader,
        html.site-support-chat-loader-pending #preloader.hidden,
        body.site-support-chat-loader-pending #preloader.hidden,
        html.site-support-chat-loader-pending #preloader.closing,
        body.site-support-chat-loader-pending #preloader.closing{
          display:flex!important;
          opacity:1!important;
          visibility:visible!important;
          pointer-events:auto!important;
          z-index:2147483000!important;
        }
        #siteSupportChatPanel{
          position:fixed;
          inset:0;
          z-index:2147482000;
          width:auto;
          height:100vh;
          height:100dvh;
          border-radius:0;
          overflow:hidden;
          border:0;
          background:#020403;
          color:#f8fafc;
          box-shadow:none;
          display:grid;
          grid-template-rows:auto auto minmax(0,1fr) auto;
          direction:rtl;
        }
        #siteSupportChatPanel:not([hidden]){
          top:0!important;
          right:0!important;
          bottom:0!important;
          left:0!important;
          width:100vw!important;
          max-width:100vw!important;
          height:var(--site-support-chat-vh, 100vh)!important;
          min-height:var(--site-support-chat-vh, 100vh)!important;
          max-height:var(--site-support-chat-vh, 100vh)!important;
          display:flex!important;
          flex-direction:column;
          align-items:stretch;
          justify-content:stretch;
        }
        #siteSupportChatPanel[hidden]{display:none!important}
        .site-support-chat__head{
          min-height:calc(72px + env(safe-area-inset-top,0px));
          padding:calc(12px + env(safe-area-inset-top,0px)) max(16px,calc((100vw - 820px)/2)) 12px;
          border-bottom:1px solid rgba(148,163,184,.18);
          background:linear-gradient(180deg,#0b0f14,#080c10);
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:10px;
        }
        .site-support-chat__title{
          display:flex;
          align-items:center;
          gap:10px;
          min-width:0;
          flex:1 1 auto;
        }
        .site-support-chat__icon{
          width:42px;
          height:42px;
          border-radius:999px;
          display:grid;
          place-items:center;
          position:relative;
          flex:0 0 auto;
          overflow:visible;
          color:#22c55e;
          background:rgba(34,197,94,.13);
          border:1px solid rgba(34,197,94,.25);
        }
        .site-support-chat__site-image{
          width:100%;
          height:100%;
          border-radius:999px;
          object-fit:cover;
          display:block;
          background:#0f172a;
        }
        .site-support-chat__site-image[hidden]{
          display:none!important;
        }
        .site-support-chat__support-mark{
          display:grid;
          place-items:center;
          line-height:1;
        }
        .site-support-chat__icon.has-site-image{
          color:#dcfce7;
          background:#0f172a;
          border-color:rgba(34,197,94,.42);
          box-shadow:0 10px 24px rgba(0,0,0,.2);
        }
        .site-support-chat__icon.has-site-image .site-support-chat__support-mark{
          position:absolute;
          left:-5px;
          bottom:-5px;
          width:22px;
          height:22px;
          border-radius:999px;
          background:#064e3b;
          border:2px solid #0b0f14;
          color:#bbf7d0;
          font-size:.7rem;
          box-shadow:0 6px 14px rgba(0,0,0,.28);
        }
        .site-support-chat__icon:not(.has-site-image) .site-support-chat__support-mark{
          font-size:1rem;
        }
        .site-support-chat__title strong{display:block;font-size:.98rem}
        .site-support-chat__title span{display:block;color:#9ca3af;font-size:.76rem;margin-top:2px}
        .site-support-chat__head-actions{
          display:flex;
          align-items:center;
          gap:8px;
          flex:0 0 auto;
        }
        .site-support-chat__close-ticket{
          min-height:40px;
          border:1px solid rgba(248,113,113,.38);
          border-radius:999px;
          background:linear-gradient(180deg,rgba(127,29,29,.42),rgba(69,10,10,.34));
          color:#fee2e2;
          display:inline-flex;
          align-items:center;
          justify-content:center;
          gap:8px;
          padding:0 14px;
          font-size:.78rem;
          font-weight:900;
          line-height:1;
          white-space:nowrap;
          cursor:pointer;
          box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 8px 22px rgba(127,29,29,.22);
          transition:background .16s ease,border-color .16s ease,transform .16s ease,color .16s ease;
        }
        .site-support-chat__close-ticket:hover{
          border-color:rgba(252,165,165,.62);
          background:linear-gradient(180deg,rgba(153,27,27,.56),rgba(91,12,12,.44));
          transform:translateY(-1px);
        }
        .site-support-chat__close-ticket[hidden]{
          display:none!important;
        }
        .site-support-chat__close-ticket:disabled{
          opacity:.58;
          cursor:not-allowed;
        }
        .site-support-chat__close{
          width:40px;
          height:40px;
          border:1px solid rgba(148,163,184,.22);
          border-radius:999px;
          background:rgba(15,23,42,.58);
          color:#f8fafc;
          display:grid;
          place-items:center;
          box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 8px 20px rgba(0,0,0,.2);
          transition:background .16s ease,border-color .16s ease,transform .16s ease;
        }
        .site-support-chat__close:hover{
          border-color:rgba(226,232,240,.38);
          background:rgba(30,41,59,.74);
          transform:translateY(-1px);
        }
        .site-support-chat__selection-bar{
          min-height:54px;
          padding:8px max(16px,calc((100vw - 820px)/2));
          background:#008069;
          color:#fff;
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:12px;
          border-bottom:1px solid rgba(0,0,0,.12);
        }
        .site-support-chat__selection-bar[hidden]{
          display:none!important;
        }
        .site-support-chat__selection-title{
          min-width:0;
          display:flex;
          align-items:center;
          gap:10px;
          font-weight:900;
        }
        .site-support-chat__selection-title small{
          display:block;
          margin-top:2px;
          color:rgba(255,255,255,.76);
          font-size:.72rem;
          font-weight:800;
        }
        .site-support-chat__selection-copy,
        .site-support-chat__selection-clear{
          width:40px;
          height:40px;
          border:0;
          border-radius:999px;
          background:rgba(255,255,255,.12);
          color:#fff;
          display:grid;
          place-items:center;
          cursor:pointer;
        }
        .site-support-chat__selection-copy:hover,
        .site-support-chat__selection-clear:hover{
          background:rgba(255,255,255,.2);
        }
        .site-support-chat__messages{
          flex:1 1 auto;
          min-height:0;
          height:auto;
          overflow:auto;
          padding:18px max(16px,calc((100vw - 820px)/2));
          display:flex;
          flex-direction:column;
          gap:10px;
          background-color:#efeae2;
          background-image:
            linear-gradient(45deg, rgba(17,27,33,.035) 25%, transparent 25%),
            linear-gradient(-45deg, rgba(17,27,33,.035) 25%, transparent 25%),
            linear-gradient(45deg, transparent 75%, rgba(17,27,33,.035) 75%),
            linear-gradient(-45deg, transparent 75%, rgba(17,27,33,.035) 75%);
          background-size:34px 34px;
          background-position:0 0,0 17px,17px -17px,-17px 0;
          overscroll-behavior:contain;
        }
        .site-support-chat__jump{
          position:absolute;
          left:50%;
          bottom:calc(102px + max(10px,env(safe-area-inset-bottom,0px)));
          width:42px;
          height:42px;
          border:0;
          border-radius:999px;
          display:grid;
          place-items:center;
          z-index:3;
          color:#f8fafc;
          background:rgba(15,23,42,.92);
          box-shadow:0 16px 32px rgba(0,0,0,.28);
          cursor:pointer;
          opacity:0;
          pointer-events:none;
          transform:translate(-50%,8px) scale(.94);
          transition:opacity .16s ease,transform .16s ease,background .16s ease;
        }
        .site-support-chat__jump.is-visible:not([hidden]){
          opacity:1;
          pointer-events:auto;
          transform:translate(-50%,0) scale(1);
        }
        .site-support-chat__jump:hover{
          background:#111827;
        }
        .site-support-chat__jump[hidden]{display:none!important}
        html[data-theme="dark"] .site-support-chat__messages,
        body.dark-mode .site-support-chat__messages{
          background-color:#0b141a;
          background-image:
            linear-gradient(45deg, rgba(233,237,239,.035) 25%, transparent 25%),
            linear-gradient(-45deg, rgba(233,237,239,.035) 25%, transparent 25%),
            linear-gradient(45deg, transparent 75%, rgba(233,237,239,.035) 75%),
            linear-gradient(-45deg, transparent 75%, rgba(233,237,239,.035) 75%);
        }
        .site-support-chat__empty{
          flex:1 1 auto;
          min-height:240px;
          display:grid;
          place-items:center;
          text-align:center;
          color:#9ca3af;
          line-height:1.8;
        }
        .site-support-chat__loading{
          flex:1 1 auto;
          min-height:240px;
          display:grid;
          place-items:center;
          align-content:center;
          gap:12px;
          text-align:center;
          color:#475569;
          line-height:1.8;
        }
        html[data-theme="dark"] .site-support-chat__loading,
        body.dark-mode .site-support-chat__loading{
          color:#cbd5e1;
        }
        .site-support-chat__spinner{
          width:52px;
          height:26px;
          border-radius:999px;
          display:inline-flex;
          align-items:center;
          justify-content:center;
          gap:6px;
          background:rgba(34,197,94,.14);
        }
        .site-support-chat__spinner::before,
        .site-support-chat__spinner::after,
        .site-support-chat__spinner span{
          content:"";
          width:6px;
          height:6px;
          border-radius:999px;
          background:#22c55e;
          animation:siteSupportTypingDots 1s ease-in-out infinite;
        }
        .site-support-chat__spinner span{animation-delay:.12s}
        .site-support-chat__spinner::after{animation-delay:.24s}
        @keyframes siteSupportTypingDots{
          0%,80%,100%{transform:translateY(0);opacity:.45}
          40%{transform:translateY(-4px);opacity:1}
        }
        .site-support-chat__bubble{
          position:relative;
          max-width:min(72%,560px);
          padding:10px 12px;
          border-radius:18px;
          display:grid;
          gap:6px;
          line-height:1.75;
          word-break:break-word;
          box-shadow:0 10px 20px rgba(0,0,0,.18);
          cursor:pointer;
          transition:box-shadow .14s ease, filter .14s ease;
        }
        .site-support-chat__bubble.is-selected{
          box-shadow:0 0 0 2px rgba(0,168,132,.85),0 10px 20px rgba(0,0,0,.18);
          filter:saturate(1.08);
        }
        .site-support-chat__select-mark{
          position:absolute;
          top:-8px;
          left:-8px;
          width:25px;
          height:25px;
          border-radius:999px;
          display:grid;
          place-items:center;
          background:#00a884;
          color:#fff;
          font-size:.72rem;
          opacity:0;
          transform:scale(.86);
          pointer-events:none;
          box-shadow:0 8px 16px rgba(0,0,0,.24);
          transition:opacity .14s ease, transform .14s ease;
        }
        .site-support-chat__bubble.is-selected .site-support-chat__select-mark{
          opacity:1;
          transform:scale(1);
        }
        .site-support-chat__bubble.is-user{
          align-self:flex-end;
          background:var(--site-accent-runtime, var(--accent-theme, #64748b));
          color:#fff;
          border-bottom-left-radius:6px;
        }
        .site-support-chat__bubble.is-admin{
          align-self:flex-start;
          background:#17212f;
          color:#eef2f7;
          border-bottom-right-radius:6px;
        }
        .site-support-chat__system{
          align-self:center;
          max-width:min(86%,520px);
          padding:8px 12px;
          border-radius:16px;
          background:rgba(148,163,184,.12);
          color:#94a3b8;
          font-size:.78rem;
          line-height:1.65;
          text-align:right;
          box-shadow:none;
          display:flex;
          align-items:flex-start;
          gap:8px;
        }
        .site-support-chat__system i{
          width:24px;
          height:24px;
          border-radius:999px;
          display:inline-grid;
          place-items:center;
          flex:0 0 24px;
          margin-top:1px;
          background:rgba(148,163,184,.16);
          color:#cbd5e1;
          font-size:.72rem;
        }
        .site-support-chat__system.is-ticket-event{
          background:linear-gradient(180deg,rgba(79,70,229,.12),rgba(15,23,42,.08));
          border:1px solid rgba(148,163,184,.18);
          color:#dbe4f0;
        }
        .site-support-chat__system.is-ticket-event i{
          background:var(--site-accent-runtime, var(--accent-theme, #64748b));
          color:#fff;
        }
        .site-support-chat__system-copy{
          min-width:0;
        }
        .site-support-chat__system strong{
          font-weight:700;
          color:inherit;
        }
        .site-support-chat__system span{
          display:block;
          margin-top:2px;
          color:rgba(148,163,184,.78);
          font-size:.66rem;
          direction:ltr;
        }
        .site-support-chat__bubble span{
          color:rgba(255,255,255,.72);
          font-size:.7rem;
          direction:ltr;
        }
        .site-support-chat__meta{
          display:inline-flex;
          align-items:center;
          gap:6px;
          justify-self:end;
        }
        .site-support-chat__meta b{
          display:inline-grid;
          place-items:center;
          min-width:24px;
          height:16px;
          padding:0 5px;
          border-radius:999px;
          background:rgba(34,197,94,.18);
          color:#bbf7d0;
          font-size:.62rem;
          line-height:1;
          font-weight:900;
          direction:ltr;
        }
        .site-support-chat__bubble.is-ai{
          box-shadow:0 0 0 1px rgba(34,197,94,.2),0 10px 20px rgba(0,0,0,.18);
        }
        .site-support-chat__text{
          white-space:pre-wrap;
        }
        .site-support-chat__bubble.is-ai.is-typing .site-support-chat__text::after{
          content:"";
          display:inline-block;
          width:2px;
          height:1em;
          margin-inline-start:2px;
          vertical-align:-0.12em;
          background:currentColor;
          opacity:.8;
          animation:siteSupportTypingCaret .7s steps(2,end) infinite;
        }
        @keyframes siteSupportTypingCaret{
          0%,45%{opacity:.85}
          46%,100%{opacity:.12}
        }
        .site-support-chat__bubble img{
          max-width:210px;
          border-radius:14px;
          display:block;
        }
        .site-support-chat__cards{
          width:min(620px,100%);
          max-width:100%;
          display:flex;
          gap:14px;
          overflow-x:auto;
          overflow-y:hidden;
          padding:6px 2px 12px;
          margin-top:4px;
          scroll-snap-type:x proximity;
          scrollbar-width:thin;
        }
        .site-support-chat__cards.is-ticket-prompt{
          width:100%;
          display:block;
          overflow:visible;
          padding:8px 0 0;
          margin-top:6px;
          scroll-snap-type:none;
        }
        .site-support-chat__bubble:has(.site-support-chat__cards){
          max-width:min(96%,680px);
        }
        .site-support-chat__bubble:has(.site-support-chat__cards.is-ticket-prompt){
          max-width:min(88%,360px);
        }
        .site-support-chat__ticket-btn{
          width:100%;
          min-height:38px;
          border:0;
          border-radius:12px;
          display:grid;
          place-items:center;
          padding:0 14px;
          background:#229ed9;
          color:#fff;
          font-size:.86rem;
          font-weight:900;
          line-height:1.2;
          box-shadow:none;
          cursor:pointer;
          direction:rtl;
          text-align:center;
        }
        .site-support-chat__ticket-btn:hover{
          transform:none;
          filter:brightness(1.05);
        }
        .site-support-chat__contact-links{
          width:100%;
          max-width:100%;
          display:flex;
          flex-wrap:wrap;
          gap:8px;
          margin-top:8px;
          direction:rtl;
        }
        .site-support-chat__contact-btn{
          min-width:0;
          min-height:38px;
          border-radius:999px;
          display:inline-flex;
          align-items:center;
          gap:8px;
          padding:6px 10px 6px 14px;
          background:rgba(37,211,102,.14);
          border:1px solid rgba(37,211,102,.28);
          color:#dcfce7;
          text-decoration:none;
          font-size:.82rem;
          font-weight:900;
          line-height:1.2;
          box-shadow:none;
          max-width:100%;
          transition:transform .16s ease,filter .16s ease,border-color .16s ease;
        }
        .site-support-chat__contact-btn:hover{
          transform:translateY(-1px);
          filter:brightness(1.08);
          border-color:rgba(37,211,102,.5);
          text-decoration:none;
        }
        .site-support-chat__bubble .site-support-chat__contact-icon{
          position:relative;
          width:28px;
          height:28px;
          border-radius:999px;
          display:grid;
          place-items:center;
          flex:0 0 auto;
          background:#25d366;
          color:#fff;
          box-shadow:0 8px 18px rgba(37,211,102,.24);
        }
        .site-support-chat__bubble .site-support-chat__contact-icon i{
          font-size:1rem;
          line-height:1;
        }
        .site-support-chat__bubble .site-support-chat__contact-badge{
          position:absolute;
          right:-3px;
          bottom:-3px;
          width:14px;
          height:14px;
          border-radius:999px;
          display:grid;
          place-items:center;
          background:#0f172a;
          color:#bbf7d0;
          border:1px solid rgba(255,255,255,.34);
          font-size:.48rem;
        }
        .site-support-chat__bubble .site-support-chat__contact-label{
          min-width:0;
          overflow:hidden;
          text-overflow:ellipsis;
          white-space:nowrap;
          direction:rtl;
          color:inherit;
          font-size:.82rem;
        }
        .site-support-chat__contact-btn.is-telegram{
          background:rgba(34,158,217,.14);
          border-color:rgba(34,158,217,.28);
          color:#e0f2fe;
        }
        .site-support-chat__contact-btn.is-telegram .site-support-chat__contact-icon{background:#229ed9}
        .site-support-chat__contact-btn.is-facebook .site-support-chat__contact-icon{background:#1877f2}
        .site-support-chat__contact-btn.is-instagram .site-support-chat__contact-icon{background:#e4405f}
        .site-support-chat__contact-btn.is-email .site-support-chat__contact-icon{background:#64748b}
        .site-support-chat__card{
          flex:0 0 clamp(132px,28vw,174px);
          width:clamp(132px,28vw,174px);
          min-height:0;
          border:0;
          border-radius:0;
          background:transparent;
          color:#f8fafc;
          display:flex;
          flex-direction:column;
          align-items:stretch;
          gap:8px;
          padding:0;
          text-align:center;
          direction:rtl;
          line-height:1.45;
          cursor:pointer;
          box-shadow:none;
          scroll-snap-align:start;
        }
        .site-support-chat__card:hover{
          transform:translateY(-2px);
        }
        .site-support-chat__card-media{
          width:100%;
          aspect-ratio:1 / 1;
          height:auto;
          border-radius:14px;
          overflow:hidden;
          display:grid;
          place-items:center;
          background:linear-gradient(135deg,rgba(34,197,94,.14),rgba(15,23,42,.94));
          color:#86efac;
          border:1px solid rgba(148,163,184,.18);
          box-shadow:0 14px 28px rgba(0,0,0,.22);
        }
        .site-support-chat__bubble .site-support-chat__card-media,
        .site-support-chat__bubble .site-support-chat__card-body,
        .site-support-chat__bubble .site-support-chat__card-cta{
          direction:rtl;
          font-size:inherit;
        }
        .site-support-chat__card-media img{
          width:100%;
          height:100%;
          max-width:none;
          border-radius:0;
          object-fit:cover;
        }
        .site-support-chat__card-body{
          min-width:0;
          display:grid;
          align-content:center;
          gap:2px;
          direction:rtl;
          padding:0 2px;
        }
        .site-support-chat__card-body strong,
        .site-support-chat__card-body small,
        .site-support-chat__card-body em{
          display:block;
          min-width:0;
          overflow:hidden;
          text-overflow:ellipsis;
          white-space:nowrap;
        }
        .site-support-chat__card-body strong{
          color:#fff;
          font-size:.84rem;
          line-height:1.45;
        }
        .site-support-chat__card-body small{
          color:#cbd5e1;
          font-size:.72rem;
          line-height:1.45;
        }
        .site-support-chat__card-body em{
          color:#bbf7d0;
          font-size:.74rem;
          font-style:normal;
          font-weight:900;
        }
        .site-support-chat__card-cta{
          align-self:center;
          min-width:62px;
          min-height:30px;
          padding:0 14px;
          border-radius:999px;
          display:grid;
          place-items:center;
          background:#22c55e;
          color:#052e16;
          font-size:.74rem;
          font-weight:900;
          white-space:nowrap;
        }
        .site-support-chat__bubble .site-support-chat__card-cta{
          color:#052e16;
          font-size:.78rem;
        }
        @media (max-width:520px){
          .site-support-chat__cards{
            width:100%;
            gap:12px;
            padding-bottom:10px;
          }
          .site-support-chat__card{
            flex-basis:136px;
            width:136px;
          }
        }
        .site-support-chat__image-btn{
          padding:0;
          border:0;
          border-radius:14px;
          background:transparent;
          width:auto;
          height:auto;
          min-width:0;
          min-height:0;
          display:block;
          cursor:zoom-in;
          overflow:hidden;
          justify-self:start;
        }
        .site-support-chat__image-btn img{
          transition:filter .16s ease,transform .16s ease;
        }
        .site-support-chat__image-btn:hover img{
          filter:brightness(.92);
          transform:scale(1.015);
        }
        .site-support-image-viewer{
          position:fixed;
          inset:0;
          z-index:2147483646;
          background:rgba(5,8,12,.97);
          color:#f8fafc;
          display:grid;
          grid-template-rows:auto minmax(0,1fr);
          direction:ltr;
        }
        .site-support-image-viewer[hidden]{display:none!important}
        .site-support-image-viewer__bar{
          min-height:62px;
          padding:12px max(14px,env(safe-area-inset-right)) 10px max(14px,env(safe-area-inset-left));
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:12px;
          background:linear-gradient(180deg,rgba(8,13,19,.96),rgba(8,13,19,.72));
          border-bottom:1px solid rgba(255,255,255,.08);
        }
        .site-support-image-viewer__bar button{
          width:42px;
          height:42px;
          border:1px solid rgba(255,255,255,.12);
          border-radius:999px;
          background:rgba(255,255,255,.08);
          color:#fff;
          display:grid;
          place-items:center;
          cursor:pointer;
        }
        .site-support-image-viewer__actions{
          display:flex;
          align-items:center;
          gap:8px;
        }
        .site-support-image-viewer__actions span{
          min-width:54px;
          text-align:center;
          color:#d1d5db;
          font-size:.82rem;
          font-weight:800;
        }
        .site-support-image-viewer__stage{
          min-height:0;
          overflow:auto;
          display:grid;
          place-items:center;
          padding:18px;
        }
        .site-support-image-viewer__stage img{
          max-width:92vw;
          max-height:82vh;
          border-radius:10px;
          object-fit:contain;
          box-shadow:0 24px 80px rgba(0,0,0,.42);
          transform-origin:center center;
          transition:transform .14s ease;
          cursor:zoom-in;
        }
        .site-support-image-viewer__stage img.is-zoomed{
          cursor:zoom-out;
        }
        .site-support-chat__form{
          padding:12px max(16px,calc((100vw - 820px)/2)) 10px;
          border-top:1px solid rgba(148,163,184,.18);
          background:#0b0f14;
          display:grid;
          grid-template-columns:46px 46px minmax(0,1fr) 52px;
          gap:10px;
          align-items:center;
        }
        .site-support-chat__composer{
          flex:0 0 auto;
          min-height:0;
          background:#0b0f14;
        }
        .site-support-chat__attach{
          width:46px;
          height:46px;
          border:1px solid rgba(255,255,255,.12);
          border-radius:999px;
          display:grid;
          place-items:center;
          color:#d1d5db;
          background:#111820;
          cursor:pointer;
        }
        .site-support-chat__attach.has-image{
          color:#fff;
          background:#0f766e;
        }
        .site-support-chat__file{display:none!important}
        .site-support-chat__voice{
          width:46px;
          height:46px;
          border:1px solid rgba(255,255,255,.12);
          border-radius:999px;
          display:grid;
          place-items:center;
          color:#d1d5db;
          background:#111820;
          cursor:pointer;
          flex:0 0 auto;
        }
        .site-support-chat__voice.is-recording{
          color:#fff;
          background:#e11d48;
          border-color:#e11d48;
          animation:siteSupportVoicePulse 1s ease-in-out infinite;
        }
        @keyframes siteSupportVoicePulse{0%,100%{box-shadow:0 0 0 0 rgba(225,29,72,.5)}50%{box-shadow:0 0 0 6px rgba(225,29,72,0)}}
        .site-support-chat__audio{
          display:block;
          width:210px;
          max-width:100%;
          height:40px;
          margin-top:6px;
        }
        .site-support-chat__preview{
          padding:8px max(16px,calc((100vw - 820px)/2)) 0;
          color:#d1fae5;
          background:#0b0f14;
          font-size:.78rem;
          text-align:right;
        }
        .site-support-chat__preview[hidden]{display:none!important}
        .site-support-chat__form input{
          width:100%;
          height:50px;
          border-radius:999px;
          border:1px solid #293240;
          background:#111820;
          color:#f8fafc;
          padding:0 18px;
          outline:none;
          font:inherit;
        }
        .site-support-chat__form input::placeholder{color:#8f9aaa}
        .site-support-chat__form button:not(.site-support-chat__attach):not(.site-support-chat__voice){
          width:52px;
          height:52px;
          border:0;
          border-radius:999px;
          display:grid;
          place-items:center;
          color:#fff;
          background:#22c55e;
          cursor:pointer;
          transition:transform .16s ease,filter .16s ease,background .16s ease;
        }
        .site-support-chat__form button:not(.site-support-chat__attach):not(:disabled):hover{
          transform:translateY(-1px);
          filter:brightness(1.05);
        }
        .site-support-chat__form button:disabled{opacity:.72;cursor:not-allowed}
        .site-support-chat__form button.is-sending{
          background:#16a34a;
        }
        .site-support-chat__send-loader{
          width:26px;
          height:14px;
          display:inline-flex;
          align-items:center;
          justify-content:center;
          gap:4px;
        }
        .site-support-chat__send-loader span{
          width:5px;
          height:5px;
          border-radius:999px;
          background:#fff;
          animation:siteSupportTypingDots .9s ease-in-out infinite;
        }
        .site-support-chat__send-loader span:nth-child(2){animation-delay:.12s}
        .site-support-chat__send-loader span:nth-child(3){animation-delay:.24s}
        .site-support-chat__status-loader{
          display:inline-flex;
          align-items:center;
          justify-content:center;
          gap:4px;
          margin-inline-end:8px;
          vertical-align:middle;
        }
        .site-support-chat__status-loader span{
          width:5px;
          height:5px;
          border-radius:999px;
          background:#9ca3af;
          animation:siteSupportTypingDots .9s ease-in-out infinite;
        }
        .site-support-chat__status-loader span:nth-child(2){animation-delay:.12s}
        .site-support-chat__status-loader span:nth-child(3){animation-delay:.24s}
        #siteSupportChatStatus{
          min-height:0;
          padding:0 max(16px,calc((100vw - 820px)/2)) max(10px,env(safe-area-inset-bottom,0px));
          color:#9ca3af;
          background:#0b0f14;
          font-size:.74rem;
          text-align:center;
        }
        #siteSupportChatStatus:empty{
          display:none;
        }
        html.pre-login-route #siteSupportChatFab,
        html.pre-login-route #siteSupportChatPanel,
        body.login-route-active #siteSupportChatFab,
        body.login-route-active #siteSupportChatPanel,
        body[data-inline-route="login"] #siteSupportChatFab,
        body[data-inline-route="login"] #siteSupportChatPanel,
        body:has(#loginInline:not(.hidden)) #siteSupportChatFab,
        body:has(#loginInline:not(.hidden)) #siteSupportChatPanel{
          display:none!important;
        }
        @media (max-width:640px){
          #siteSupportChatFab{
            left:max(10px,calc(env(safe-area-inset-left,0px) + 10px));
            bottom:calc(max(154px,calc(env(safe-area-inset-bottom,0px) + 154px)) + var(--support-chat-fab-lift,0px));
            width:54px;
            height:52px;
            z-index:9101;
          }
          #siteSupportChatPanel{
            inset:0;
            width:auto;
            height:var(--site-support-chat-vh, 100vh);
            min-height:var(--site-support-chat-vh, 100vh);
            border-radius:0;
            z-index:2147482000;
          }
          .site-support-chat__head{
            padding-right:16px;
            padding-left:16px;
          }
          .site-support-chat__close-ticket{
            min-height:38px;
            padding:0 10px;
            font-size:.74rem;
          }
          .site-support-chat__selection-bar{
            padding-right:14px;
            padding-left:14px;
          }
          .site-support-chat__messages{
            padding-right:14px;
            padding-left:14px;
          }
          .site-support-chat__form{
            padding-right:12px;
            padding-left:12px;
          }
          #siteSupportChatStatus{
            padding-right:12px;
            padding-left:12px;
          }
          .site-support-chat__bubble{max-width:90%}
        }
      `;
      document.head.appendChild(style);

      var fab = document.createElement('button');
      fab.id = 'siteSupportChatFab';
      fab.type = 'button';
      fab.setAttribute('aria-label', 'الدعم الفني');
      fab.setAttribute('aria-expanded', 'false');
      fab.innerHTML = '<i class="fa-solid fa-headset" aria-hidden="true"></i><span id="siteSupportChatBadge" hidden></span>';

      var panel = document.createElement('section');
      panel.id = 'siteSupportChatPanel';
      panel.hidden = true;
      panel.setAttribute('inert', '');
      panel.setAttribute('aria-label', 'محادثة الدعم الفني');
      panel.setAttribute('role', 'main');
      panel.innerHTML = [
        '<header class="site-support-chat__head">',
          '<div class="site-support-chat__title">',
            '<span class="site-support-chat__icon"><img id="siteSupportChatSiteImage" class="site-support-chat__site-image" alt="" hidden><i class="fa-solid fa-headset site-support-chat__support-mark" aria-hidden="true"></i></span>',
          '<div><strong>الدعم الفني</strong><span>فريق الدعم</span></div>',
          '</div>',
          '<div class="site-support-chat__head-actions">',
            '<button class="site-support-chat__close-ticket" id="siteSupportChatCloseTicket" type="button" hidden aria-hidden="true" aria-label="قفل التذكرة"><i class="fa-solid fa-lock" aria-hidden="true"></i><span>قفل التذكرة</span></button>',
            '<button class="site-support-chat__close" id="siteSupportChatClose" type="button" aria-label="رجوع"><i class="fa-solid fa-arrow-right-long" aria-hidden="true"></i></button>',
          '</div>',
        '</header>',
        '<div id="siteSupportChatSelectionBar" class="site-support-chat__selection-bar" hidden>',
          '<button class="site-support-chat__selection-clear" type="button" data-support-clear-selection aria-label="إلغاء التحديد"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>',
          '<div class="site-support-chat__selection-title"><div><span><span data-support-selection-count>0</span> محددة</span><small>يمكنك نسخ الرسائل المحددة</small></div></div>',
          '<button class="site-support-chat__selection-copy" type="button" data-support-copy-selection aria-label="نسخ"><i class="fa-solid fa-copy" aria-hidden="true"></i></button>',
        '</div>',
        '<div id="siteSupportChatMessages" class="site-support-chat__messages">',
          '<div class="site-support-chat__empty">لا توجد رسائل بعد.</div>',
        '</div>',
        '<button id="siteSupportChatJump" class="site-support-chat__jump" type="button" hidden aria-label="النزول إلى آخر الرسائل"><i class="fa-solid fa-arrow-down" aria-hidden="true"></i></button>',
        '<div class="site-support-chat__composer">',
          '<div id="siteSupportChatPreview" class="site-support-chat__preview" hidden></div>',
          '<form id="siteSupportChatForm" class="site-support-chat__form">',
            '<button id="siteSupportChatAttach" class="site-support-chat__attach" type="button" aria-label="إرفاق صورة"><i class="fa-solid fa-paperclip" aria-hidden="true"></i></button>',
            '<button id="siteSupportChatVoice" class="site-support-chat__voice" type="button" aria-label="تسجيل رسالة صوتية"><i class="fa-solid fa-microphone" aria-hidden="true"></i></button>',
            '<input id="siteSupportChatImage" class="site-support-chat__file" type="file" accept="image/*" />',
            '<input id="siteSupportChatInput" type="text" autocomplete="off" placeholder="اكتب رسالتك هنا..." />',
            '<button id="siteSupportChatSend" type="submit" aria-label="إرسال"><i class="fa-solid fa-paper-plane" aria-hidden="true"></i></button>',
          '</form>',
          '<div id="siteSupportChatStatus"></div>',
        '</div>'
      ].join('');

      document.body.appendChild(fab);
      document.body.appendChild(panel);
      var supportSiteImage = panel.querySelector('#siteSupportChatSiteImage');
      if (supportSiteImage) {
        supportSiteImage.addEventListener('load', function(){
          var icon = panel.querySelector('.site-support-chat__icon');
          if (icon) icon.classList.add('has-site-image');
          supportSiteImage.hidden = false;
        });
        supportSiteImage.addEventListener('error', function(){
          var icon = panel.querySelector('.site-support-chat__icon');
          supportSiteImage.hidden = true;
          try { supportSiteImage.removeAttribute('src'); } catch (_) {}
          if (icon) icon.classList.remove('has-site-image');
        });
      }
      applySupportChatSiteImage();
      var supportMessagesList = panel.querySelector('#siteSupportChatMessages');
      var supportJumpButton = panel.querySelector('#siteSupportChatJump');
      if (supportMessagesList) {
        supportMessagesList.addEventListener('scroll', updateSupportJumpButton, { passive: true });
      }
      if (supportJumpButton) {
        supportJumpButton.addEventListener('click', function(){
          scrollSupportMessagesToBottom({ force: true, defer: false });
        });
      }
      syncSupportChatVisibility(window.__AUTH_LAST_USER__ || null);
      try {
        if (typeof window.__refreshWaJoinShortcutLayout === 'function') {
          window.__refreshWaJoinShortcutLayout();
        }
      } catch (_) {}

      fab.addEventListener('click', function(){
        if (!syncSupportChatVisibility(supportChatAuthUser)) return;
        setSupportChatOpen(!supportChatState.open);
      });
      panel.querySelector('#siteSupportChatClose').addEventListener('click', function(){
        setSupportChatOpen(false);
      });
      var supportCloseTicketButton = panel.querySelector('#siteSupportChatCloseTicket');
      if (supportCloseTicketButton) {
        supportCloseTicketButton.addEventListener('click', function(ev){
          if (ev) ev.preventDefault();
          submitSupportCloseTicket().catch(function(){});
        });
      }
      panel.addEventListener('click', function(ev){
        var clearSelection = ev && ev.target && ev.target.closest
          ? ev.target.closest('[data-support-clear-selection]')
          : null;
        if (clearSelection) {
          ev.preventDefault();
          clearSupportMessageSelection();
          return;
        }
        var copySelection = ev && ev.target && ev.target.closest
          ? ev.target.closest('[data-support-copy-selection]')
          : null;
        if (copySelection) {
          ev.preventDefault();
          copySupportSelectedMessages().catch(function(){});
          return;
        }
        var cardButton = ev && ev.target && ev.target.closest
          ? ev.target.closest('[data-support-card-action]')
          : null;
        if (cardButton) {
          ev.preventDefault();
          ev.stopPropagation();
          handleSupportCardAction(cardButton);
          return;
        }
        var contactLink = ev && ev.target && ev.target.closest
          ? ev.target.closest('[data-support-contact-link]')
          : null;
        if (contactLink) return;
        var row = ev && ev.target && ev.target.closest
          ? ev.target.closest('[data-support-message-key]')
          : null;
        var button = ev && ev.target && ev.target.closest
          ? ev.target.closest('[data-support-image]')
          : null;
        if (row) {
          var selectedCount = getSupportSelectedMessageKeys().length;
          if (selectedCount || !button) {
            ev.preventDefault();
            toggleSupportMessageSelection(row.getAttribute('data-support-message-key') || '');
            return;
          }
        }
        if (!button) return;
        ev.preventDefault();
        openSupportImageViewer(sanitizeSupportImageUrl(button.getAttribute('data-support-image') || ''));
      });
      panel.addEventListener('keydown', function(ev){
        if (!ev || (ev.key !== 'Enter' && ev.key !== ' ')) return;
        if (ev.target && ev.target.closest && ev.target.closest('[data-support-card-action]')) return;
        if (ev.target && ev.target.closest && ev.target.closest('[data-support-contact-link]')) return;
        var row = ev.target && ev.target.closest
          ? ev.target.closest('[data-support-message-key]')
          : null;
        if (!row) return;
        ev.preventDefault();
        toggleSupportMessageSelection(row.getAttribute('data-support-message-key') || '');
      });
      panel.querySelector('#siteSupportChatAttach').addEventListener('click', function(){
        var fileInput = document.getElementById('siteSupportChatImage');
        try { if (fileInput) fileInput.click(); } catch (_) {}
      });
      var voiceBtn = panel.querySelector('#siteSupportChatVoice');
      if (voiceBtn) {
        voiceBtn.addEventListener('click', function(){ toggleSupportVoiceRecording(); });
      }
      panel.querySelector('#siteSupportChatImage').addEventListener('change', function(ev){
        var file = ev && ev.target && ev.target.files && ev.target.files[0] ? ev.target.files[0] : null;
        if (!file) {
          clearSupportSelectedImage();
          return;
        }
        if (!String(file.type || '').toLowerCase().startsWith('image/')) {
          clearSupportSelectedImage();
          setSupportChatStatus('اختر ملف صورة فقط.');
          return;
        }
        if (Number(file.size || 0) > (5 * 1024 * 1024)) {
          clearSupportSelectedImage();
          setSupportChatStatus('حجم الصورة يتجاوز 5MB.');
          return;
        }
        setSupportSelectedImage(file);
        setSupportChatStatus('');
      });
      panel.querySelector('#siteSupportChatForm').addEventListener('submit', function(ev){
        ev.preventDefault();
        submitSupportMessage().catch(function(){});
      });
      document.addEventListener('keydown', function(ev){
        if (!ev) return;
        var viewer = document.getElementById('siteSupportImageViewer');
        if (viewer && !viewer.hidden) {
          if (ev.key === 'Escape') {
            ev.preventDefault();
            closeSupportImageViewer();
          } else if (ev.key === '+' || ev.key === '=') {
            ev.preventDefault();
            supportImageViewerState.scale = clampSupportImageScale(supportImageViewerState.scale + .25);
            updateSupportImageViewerScale();
          } else if (ev.key === '-' || ev.key === '_') {
            ev.preventDefault();
            supportImageViewerState.scale = clampSupportImageScale(supportImageViewerState.scale - .25);
            updateSupportImageViewerScale();
          }
          return;
        }
        if (supportChatState.open && ev.key === 'Escape') setSupportChatOpen(false);
      });
      document.addEventListener('visibilitychange', function(){
        if (!isSupportChatDocumentVisible()) {
          stopSupportPolling();
          stopSupportBadgePolling();
          stopSupportRealtime();
          return;
        }
        if (supportChatState.open) {
          if (isSupportThreadTicketOpen(supportChatState.thread)) {
            if (supportChatState.realtimeDisabled) startSupportPolling();
            else startSupportRealtime().catch(function(){});
          }
          loadSupportThread(true, { markRead: true, notify: false, force: true }).catch(function(){});
        }
      });
      window.addEventListener('resize', syncSupportChatViewportHeight);
      window.addEventListener('orientationchange', function(){
        setTimeout(syncSupportChatViewportHeight, 80);
        setTimeout(syncSupportChatViewportHeight, 320);
      });
      window.addEventListener('pagehide', function(){
        stopSupportPolling();
        stopSupportBadgePolling();
        stopSupportRealtime();
      });
      window.addEventListener('hashchange', function(){
        if (supportChatState.open) setSupportChatOpen(false);
      });
      window.addEventListener('site:icon', function(ev){
        applySupportChatSiteImage(ev && ev.detail ? ev.detail.url : '');
      });
      syncSupportChatViewportHeight();
      startSupportBadgePolling();
    }

    try {
      window.__syncSupportChatVisibility = syncSupportChatVisibility;
      window.addEventListener('auth:ui-state', function(ev){
        syncSupportChatVisibility(ev && ev.detail ? ev.detail.user : null);
      });
      window.addEventListener('auth:logout', function(){
        syncSupportChatVisibility(null);
      });
      window.addEventListener('sessionkey:updated', function(){
        syncSupportChatVisibility(window.__AUTH_LAST_USER__ || null);
      });
      window.addEventListener('storage', function(ev){
        var authBundleKey = '';
        try { authBundleKey = String(window.__AUTH_SESSION_BUNDLE_STORAGE_KEY__ || 'auth:session:bundle:v1'); } catch (_) { authBundleKey = 'auth:session:bundle:v1'; }
        if (!ev || ev.key === 'sessionKeyInfo' || ev.key === 'auth:lastLoggedIn' || ev.key === authBundleKey) {
          syncSupportChatVisibility(window.__AUTH_LAST_USER__ || null);
        }
        if (!ev || ev.key === 'site:media:v1') {
          applySupportChatSiteImage();
        }
      });
    } catch (_) {}

    mountSupportChat();
  } catch (_) {}
})();
