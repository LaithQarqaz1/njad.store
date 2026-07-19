/* Account/API/transfer route builders — extracted from the router IIFE in
   site-inline-app.js (2026-07-19). Ships as chunk-account.js, loaded by
   __loadRouteChunk before these routes build. Each builder was verified
   closure-independent except queueI18nPrewarm, which the router exposes on
   window. The router keeps lazy thunks + the renderFromTemplate fallback. */
      var settingsRoute = (function(){
        var AUTH_BASE_DEFAULT = (window.__getSiteWorkerBaseDefault ? window.__getSiteWorkerBaseDefault({ trailingSlash: true }) : (String(window.location.origin || '').replace(/\/+$/, '') + "/"));
        function generateGuardToken(prefix){
          var tag = (prefix || 'guard');
          try{
            var cryptoSource = null;
            if (typeof window !== 'undefined' && window.crypto && typeof window.crypto.getRandomValues === 'function'){
              cryptoSource = window.crypto;
            } else if (typeof self !== 'undefined' && self.crypto && typeof self.crypto.getRandomValues === 'function'){
              cryptoSource = self.crypto;
            }
            if (cryptoSource){
              var buf = new Uint32Array(2);
              cryptoSource.getRandomValues(buf);
              var hex = Array.from(buf).map(function(n){ return n.toString(16).padStart(8,'0'); }).join('');
              return tag + '-' + Date.now().toString(36) + '-' + hex;
            }
          }catch(_){}
          return tag + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
        }
        var STATUS_AUTH_CACHE_TTL_MS = 4000;
        var state = {
          root: null,
          refs: null,
          unsubAuth: null,
          auth: null,
          db: null,
          balanceUsd: null,
          copyBound: false,
          resetBound: false,
          currencyBound: false,
          telegramBound: false,
          authRetry: 0,
          currentUid: null,
          authRequests: Object.create(null),
          authResponses: Object.create(null)
        };

        function ensureRoot(){
          if (state.root) return state.root;
          var root = document.createElement('div');
          root.className = 'settings-page';
          var markup = [
            '<div class="settings-spacer" aria-hidden="true"></div>',
            '<div class="main-content">',
            '  <div class="container">',
            '    <h2>إعدادات الحساب</h2>',
            '    <div class="info-list">',
            '      <div class="info-card col-6"><div class="label"><i class="fa-regular fa-id-badge"></i> الاسم</div><div class="value"><span id="username" class="copyable">--</span></div></div>',
            '      <div class="info-card col-6"><div class="label"><i class="fa-solid fa-signal"></i> المستوى</div><div class="value"><span id="level" class="copyable">--</span></div></div>',
            '      <div class="info-card col-6"><div class="label"><i class="fa-regular fa-envelope"></i> البريد</div><div class="value"><span id="email" class="copyable">--</span></div></div>',
            '      <div class="info-card col-6"><div class="label"><i class="fa-solid fa-mobile-screen"></i> الهاتف</div><div class="value"><span id="phone" class="copyable">--</span></div></div>',
            '      <div class="info-card col-6"><div class="label"><i class="fa-solid fa-wallet"></i> الرصيد</div><div class="value"><span id="balance" class="copyable">--</span></div></div>',
            '      <div class="info-card col-6"><div class="label"><i class="fa-solid fa-coins"></i>الإنفاق</div><div class="value"><span id="totalspent" class="copyable">--</span></div></div>',
            '      <div class="info-card col-12"><div class="label"><i class="fa-regular fa-hashtag"></i> الايدي</div><div class="value"><span id="webuid" class="copyable">--</span></div></div>',
            '    </div>',
            '    <button id="resetBtn" type="button"><i class="fa-solid fa-key"></i> إعادة تعيين كلمة المرور</button>',
            '    <div id="msg"></div>',
            '  </div>',
            '</div>'
          ].join('');
          root.innerHTML = markup;
          try { queueI18nPrewarm(root, { maxItems: 160 }); } catch(_){}
          state.root = root;
          state.refs = {
            username: root.querySelector('#username'),
            level: root.querySelector('#level'),
            email: root.querySelector('#email'),
            phone: root.querySelector('#phone'),
            balance: root.querySelector('#balance'),
            totalspent: root.querySelector('#totalspent'),
            webuid: root.querySelector('#webuid'),
            resetBtn: root.querySelector('#resetBtn'),
            msg: root.querySelector('#msg')
          };
          ['username','level','email','phone','balance','totalspent','webuid'].forEach(function(key){
            var el = state.refs[key];
            if (el && !el.dataset.copy){ el.dataset.copy = el.textContent || ''; }
          });
          updateMessage('', true);
          setupCopy();
          setupReset();
          ensureCurrencyListeners();
          return root;
        }

        function ensureFirebase(){
          if (window.__SKIP_FIREBASE__) return null;
          try {
            if (typeof window.__FIREBASE_ENV_OK__ === "boolean" && !window.__FIREBASE_ENV_OK__) {
              window.__SKIP_FIREBASE__ = true;
              return null;
            }
          } catch(_){}
          if (typeof firebase === 'undefined') return null;
          try {
            if (window.__ORIG_FIREBASE__){
              if (window.__ORIG_FIREBASE__.auth) firebase.auth = window.__ORIG_FIREBASE__.auth;
              if (window.__ORIG_FIREBASE__.firestore) firebase.firestore = window.__ORIG_FIREBASE__.firestore;
            }
            if (typeof window.__FIREBASE_ENV_OK__ !== "boolean" || window.__FIREBASE_ENV_OK__) {
              window.__SKIP_FIREBASE__ = false;
            }
          } catch(_){}
          try {
            if ((!firebase.apps || !firebase.apps.length) && window.__FIREBASE_CONFIG__){
              firebase.initializeApp(window.__FIREBASE_CONFIG__);
            }
          } catch(_){}
          var auth = null;
          var db = null;
          try { auth = firebase.auth(); } catch(_){}
          try { db = firebase.firestore(); } catch(_){}
          if (!auth || !db) return null;
          state.auth = auth;
          state.db = db;
          return { auth: auth, db: db };
        }

        function buildAuthUrl(){
          var base = window.__getSiteWorkerBase ? window.__getSiteWorkerBase({ trailingSlash: true }) : AUTH_BASE_DEFAULT;
          try {
            var url = new URL(base);
            url.searchParams.set('action', 'auth');
            return url.toString();
          } catch(_) {
            return AUTH_BASE_DEFAULT + (AUTH_BASE_DEFAULT.indexOf('?') >= 0 ? '&' : '?') + 'action=auth';
          }
        }

        function buildSettingsAuthRequestKey(action, payload){
          var normalizedAction = String(action || '').trim().toLowerCase();
          if (normalizedAction !== 'telegram_link_status') return '';
          var uid = String(payload && payload.uid || '').trim();
          if (!uid) return '';
          return normalizedAction + ':' + uid;
        }

        function readCachedSettingsAuthResponse(key){
          if (!key) return null;
          var entry = state.authResponses[key];
          if (!entry) return null;
          if ((Number(entry.expiresAt) || 0) <= Date.now()) {
            delete state.authResponses[key];
            return null;
          }
          return entry.data;
        }

        function writeCachedSettingsAuthResponse(key, data){
          if (!key) return data;
          state.authResponses[key] = {
            data: data,
            expiresAt: Date.now() + STATUS_AUTH_CACHE_TTL_MS
          };
          return data;
        }

        function clearCachedSettingsAuthResponse(action, payload){
          var normalizedAction = String(action || '').trim().toLowerCase();
          if (!normalizedAction || normalizedAction === 'telegram_link_status') return;
          if (normalizedAction.indexOf('telegram_link_') !== 0) return;
          try { if (window.__clearSharedAuthStatusCache) window.__clearSharedAuthStatusCache(normalizedAction, payload || {}); } catch(_){}
          var statusKey = buildSettingsAuthRequestKey('telegram_link_status', payload || {});
          if (!statusKey) return;
          delete state.authResponses[statusKey];
          delete state.authRequests[statusKey];
        }

        function callSettingsAuth(action, extra){
          var services = ensureFirebase();
          var auth = services ? services.auth : state.auth;
          var user = auth ? auth.currentUser : null;
          if (!user || typeof user.getIdToken !== 'function'){
            return Promise.reject(new Error('يرجى تسجيل الدخول أولاً'));
          }
          var requestPayload = Object.assign({}, extra || {}, {
            action: action,
            uid: user.uid
          });
          clearCachedSettingsAuthResponse(action, requestPayload);
          var requestKey = buildSettingsAuthRequestKey(action, requestPayload);
          if (requestKey && state.authRequests[requestKey]) return state.authRequests[requestKey];
          var cachedResponse = readCachedSettingsAuthResponse(requestKey);
          if (cachedResponse) return Promise.resolve(cachedResponse);
          var requestFactory = function(){
            return user.getIdToken(true).then(function(token){
              return fetch(buildAuthUrl(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(Object.assign({}, requestPayload, {
                  idToken: token
                }))
              });
            }).then(function(res){
            return res.json().catch(function(){ return {}; }).then(function(data){
              if (!res.ok || data.success === false){
                var err = new Error(data.error || data.message || 'تعذر تنفيذ الطلب.');
                err.code = String(data.code || '').trim();
                err.details = data.details || null;
                err.status = res.status || 0;
                throw err;
              }
              return writeCachedSettingsAuthResponse(requestKey, data);
            });
          });
          };
          var requestPromise = (window.__runSharedAuthStatusRequest || function(payload, ttlMs, factory){
            void payload;
            void ttlMs;
            return Promise.resolve().then(factory);
          })(requestPayload, STATUS_AUTH_CACHE_TTL_MS, requestFactory);
          requestPromise = requestPromise.finally(function(){
            if (requestKey && state.authRequests[requestKey] === requestPromise) {
              delete state.authRequests[requestKey];
            }
          });
          if (requestKey) state.authRequests[requestKey] = requestPromise;
          return requestPromise;
        }

        function isTelegramLinkMissingActionError(err){
          var code = String(err && err.code || '').trim().toLowerCase();
          if (code === 'missing_action') return true;
          var message = String(err && err.message || '').trim();
          return message.indexOf('حدد action=login أو register أو sync') >= 0;
        }

        function callTelegramLinkCompat(action, extra){
          return callSettingsAuth(action, extra).catch(function(err){
            if (!isTelegramLinkMissingActionError(err)) throw err;
            if (action !== 'telegram_link_request' && action !== 'telegram_link_verify') throw err;
            var fallbackPayload = Object.assign({}, extra || {}, {
              action: 'telegram_link_set'
            });
            return callSettingsAuth('telegram_link_set', fallbackPayload);
          });
        }

        function formatBalance(value){
          var v = Number(value || 0);
          if (typeof window.formatCurrencyFromJOD === 'function'){
            try { return window.formatCurrencyFromJOD(v); } catch(_){}
          }
          return v.toFixed(3) + ' $';
        }

        function renderBalance(value){
          state.balanceUsd = Number(value || 0);
          try { window.__BAL_BASE__ = state.balanceUsd; } catch(_){}
          var txt = formatBalance(state.balanceUsd);
          if (state.refs && state.refs.balance){
            state.refs.balance.textContent = txt;
            state.refs.balance.dataset.copy = txt;
          }
        }

        function tryRenderCachedBalance(uid){
          if (!uid) return;
          try{
            var val = (typeof readBalanceMemory === 'function') ? readBalanceMemory(uid) : null;
            if (Number.isFinite(val)) renderBalance(val);
          }catch(_){}
        }

        function updateField(el, value){
          if (!el) return;
          var val = value;
          if (val === undefined || val === null || (typeof val === 'string' && val.trim() === '')){
            val = '--';
          }
          el.textContent = String(val);
          el.dataset.copy = String(val);
        }

        function normalizeTelegramId(value){
          return String(value == null ? '' : value).replace(/[^\d]/g, '').trim();
        }

        function normalizeLinkCode(value){
          return String(value == null ? '' : value).replace(/[^\d]/g, '').slice(0, 6);
        }

        function renderTelegramLink(data){
          if (!state.refs) return;
          var telegramId = normalizeTelegramId((data && (data.telegramUserId || data.telegramChatId || data.telegramId)) || '');
          var linked = telegramId !== '';
          if (state.refs.telegramUserIdInput) state.refs.telegramUserIdInput.value = telegramId;
          if (state.refs.telegramStatus){
            state.refs.telegramStatus.textContent = linked ? ('مرتبط: ' + telegramId) : 'غير مربوط';
            state.refs.telegramStatus.classList.toggle('is-linked', linked);
          }
          if (state.refs.telegramUnlinkBtn) state.refs.telegramUnlinkBtn.disabled = !linked;
        }

        function refreshTelegramLinkState(silent){
          return callSettingsAuth('telegram_link_status').then(function(data){
            renderTelegramLink(data || {});
            return data || {};
          }).catch(function(err){
            if (!silent){
              var msg = err && err.message ? err.message : 'تعذر تحميل حالة ربط تيليغرام.';
              updateMessage(msg, false);
              showToast(msg, false);
            }
            return null;
          });
        }

        function showToast(text, ok){
          try{
            var isError = ok === false;
            var fallback = isError ? 'حدث خطأ غير معروف' : 'تم تنفيذ العملية';
            var message = text;
            if (message == null || (typeof message === 'string' && message.trim() === '')){
              message = fallback;
            } else if (typeof message !== 'string'){
              message = String(message);
            }

            var toast = document.createElement('div');
            toast.className = 'toast app-toast ' + (isError ? 'app-toast--error' : 'app-toast--success');
            toast.setAttribute('role', 'alert');
            toast.setAttribute('aria-live', 'polite');
            toast.setAttribute('aria-atomic', 'true');

            var icon = document.createElement('span');
            icon.className = 'toast-icon';
            icon.setAttribute('aria-hidden', 'true');
            icon.innerHTML = '<svg stroke="currentColor" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M13 16h-1v-4h1m0-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"></path></svg>';

            var textNode = document.createElement('p');
            textNode.className = 'toast-message';
            textNode.textContent = message;

            toast.appendChild(icon);
            toast.appendChild(textNode);
            document.body.appendChild(toast);

            if (isError && window.__ENABLE_ERROR_TOAST_SOUND__ === true) {
              try {
                if (typeof window.__playErrorToastSound === 'function') {
                  window.__playErrorToastSound();
                } else {
                  var a = new Audio('https://image2url.com/r2/default/audio/1775222006071-0c6196c2-357e-4a1c-9499-a3ada1f41078.mp3');
                  a.preload = 'auto';
                  a.volume = 0.95;
                  var p = a.play();
                  if (p && typeof p.catch === 'function') p.catch(function(){});
                }
              } catch(_){}
            }

            requestAnimationFrame(function(){
              try { toast.classList.add('is-visible'); } catch(_){}
            });

            setTimeout(function(){
              try { toast.classList.remove('is-visible'); } catch(_){}
              setTimeout(function(){
                try { toast.remove(); } catch(_){ if (toast.parentNode) toast.parentNode.removeChild(toast); }
              }, 240);
            }, 1800);
          }catch(_){}
        }
        try { window.showToast = showToast; } catch(_){}

        function copyText(text){
          var val = (text || '').trim();
          if (!val) return Promise.reject(new Error('empty'));
          if (navigator.clipboard && navigator.clipboard.writeText){
            return navigator.clipboard.writeText(val);
          }
          return new Promise(function(resolve, reject){
            try{
              var ta = document.createElement('textarea');
              ta.value = val;
              ta.style.position = 'fixed';
              ta.style.opacity = '0';
              document.body.appendChild(ta);
              ta.focus();
              ta.select();
              var ok = document.execCommand('copy');
              document.body.removeChild(ta);
              if (ok) resolve(); else reject(new Error('copy-failed'));
            }catch(err){
              reject(err);
            }
          });
        }

        function setupCopy(){
          if (state.copyBound || !state.root) return;
          state.root.addEventListener('click', function(e){
            if (!state.root) return;
            var target = e.target && e.target.closest ? e.target.closest('.copyable') : null;
            if (!target || !state.root.contains(target)) return;
            var val = (target.dataset && target.dataset.copy) ? target.dataset.copy : target.textContent;
            copyText(val).then(function(){
              try { target.classList.add('copied'); } catch(_){}
              showToast('تم النسخ', true);
              setTimeout(function(){
                try { target.classList.remove('copied'); } catch(_){}
              }, 1000);
            }).catch(function(){
              showToast('تعذر النسخ', false);
            });
          });
          state.copyBound = true;
        }

        function updateMessage(text, ok){
          if (!state.refs || !state.refs.msg) return;
          state.refs.msg.textContent = text || '';
          if (ok === false){
            state.refs.msg.style.color = 'var(--danger)';
          } else {
            state.refs.msg.style.color = 'var(--success)';
          }
        }

        function setupTelegramLink(){
          if (state.telegramBound || !state.refs || !state.refs.telegramSaveBtn || !state.refs.telegramUnlinkBtn || !state.refs.telegramUserIdInput) return;
          var setBusy = function(busy){
            state.refs.telegramSaveBtn.disabled = !!busy;
            state.refs.telegramUnlinkBtn.disabled = !!busy || !normalizeTelegramId(state.refs.telegramUserIdInput.value);
            state.refs.telegramUserIdInput.disabled = !!busy;
          };
          var saveTelegramId = function(){
            var services = ensureFirebase();
            var auth = services ? services.auth : null;
            var db = services ? services.db : null;
            var user = auth ? auth.currentUser : null;
            var uid = user && user.uid ? user.uid : state.currentUid;
            if (!db || !uid){
              showToast('يرجى تسجيل الدخول أولاً', false);
              return;
            }
            var telegramId = normalizeTelegramId(state.refs.telegramUserIdInput.value);
            if (!/^\d{5,20}$/.test(telegramId)){
              showToast('أدخل معرف تيليغرام رقمي صحيح', false);
              try { state.refs.telegramUserIdInput.focus(); } catch(_){}
              return;
            }
            setBusy(true);
            callSettingsAuth('telegram_link_set', {
              telegramUserId: telegramId
            }).then(function(data){
              renderTelegramLink(data || { telegramUserId: telegramId });
              updateMessage('تم حفظ معرف تيليغرام بنجاح.', true);
              showToast('تم حفظ المعرّف', true);
            }).catch(function(){
              showToast('تعذر حفظ معرف تيليغرام', false);
              updateMessage('تعذر حفظ معرف تيليغرام.', false);
            }).finally(function(){
              setBusy(false);
            });
          };
          var unlinkTelegramId = function(){
            var services = ensureFirebase();
            var auth = services ? services.auth : null;
            var db = services ? services.db : null;
            var user = auth ? auth.currentUser : null;
            var uid = user && user.uid ? user.uid : state.currentUid;
            if (!db || !uid){
              showToast('يرجى تسجيل الدخول أولاً', false);
              return;
            }
            if (!normalizeTelegramId(state.refs.telegramUserIdInput.value)){
              renderTelegramLink({});
              return;
            }
            setBusy(true);
            callSettingsAuth('telegram_link_remove').then(function(){
              renderTelegramLink({});
              updateMessage('تم فك ربط تيليغرام.', true);
              showToast('تم فك الربط', true);
            }).catch(function(){
              showToast('تعذر فك الربط', false);
              updateMessage('تعذر فك ربط تيليغرام.', false);
            }).finally(function(){
              setBusy(false);
            });
          };
          state.refs.telegramSaveBtn.addEventListener('click', saveTelegramId);
          state.refs.telegramUnlinkBtn.addEventListener('click', unlinkTelegramId);
          state.refs.telegramUserIdInput.addEventListener('input', function(){
            var telegramId = normalizeTelegramId(state.refs.telegramUserIdInput.value);
            state.refs.telegramUserIdInput.value = telegramId;
            if (state.refs.telegramUnlinkBtn) state.refs.telegramUnlinkBtn.disabled = !telegramId;
          });
          state.refs.telegramUserIdInput.addEventListener('keydown', function(e){
            if (e.key === 'Enter'){
              e.preventDefault();
              saveTelegramId();
            }
          });
          state.telegramBound = true;
        }

        function setupReset(){
          if (state.resetBound || !state.refs || !state.refs.resetBtn) return;
          state.refs.resetBtn.addEventListener('click', function(){
            var service = ensureFirebase();
            var auth = service ? service.auth : null;
            if (!auth){
              showToast('تعذر الوصول إلى الحساب', false);
              return;
            }
            var user = auth.currentUser;
            if (!user || !user.email){
              showToast('يرجى تسجيل الدخول أولاً', false);
              return;
            }
            state.refs.resetBtn.disabled = true;
            auth.sendPasswordResetEmail(user.email).then(function(){
              updateMessage('ًں“¨ تم إرسال رابط إعادة التعيين إلى بريدك.', true);
              showToast('تم إرسال البريد', true);
              state.refs.resetBtn.disabled = false;
            }).catch(function(){
              updateMessage('حدث خطأ أثناء الإرسال.', false);
              showToast('حدث خطأ أثناء الإرسال', false);
              state.refs.resetBtn.disabled = false;
            });
          });
          state.resetBound = true;
        }

        function ensureCurrencyListeners(){
          if (state.currencyBound) return;
          var rerender = function(){
            if (state.balanceUsd != null) renderBalance(state.balanceUsd);
          };
          window.addEventListener('currency:change', rerender);
          window.addEventListener('currency:rates:change', rerender);
          window.addEventListener('balance:change', function(ev){
            if (!ev || !ev.detail) return;
            var val = Number(ev.detail.value);
            if (Number.isFinite(val)) renderBalance(val);
          });
          state.currencyBound = true;
        }

        function readCachedDefaultThemeMode(){
          try {
            var raw = localStorage.getItem('site:theme:v1');
            if (!raw) return '';
            var parsed = JSON.parse(raw) || {};
            var mode = String(
              parsed.defaultMode ||
              parsed.default_mode ||
              parsed.defaultThemeMode ||
              parsed.default_theme_mode ||
              ''
            ).trim().toLowerCase();
            return mode === 'dark' || mode === 'light' ? mode : '';
          } catch(_){}
          return '';
        }

        function getCurrentTheme(){
          var attr = (document.documentElement.getAttribute('data-theme') || '').toLowerCase();
          if (attr === 'dark' || attr === 'light') return attr;
          var saved = null;
          try { saved = localStorage.getItem('theme'); } catch(_){}
          if (saved === 'dark' || saved === 'light') return saved;
          return readCachedDefaultThemeMode() || 'dark';
        }

        function syncBodyThemeClass(){
          var current = getCurrentTheme();
          document.body.classList.toggle('dark-mode', current === 'dark');
          document.body.classList.toggle('light-mode', current === 'light');
        }

        function setTheme(theme){
          if (!theme) return;
          document.documentElement.setAttribute('data-theme', theme);
          syncBodyThemeClass();
          try { localStorage.setItem('theme', theme); } catch(_){}
          try {
            var metaCS = document.querySelector('meta[name="color-scheme"]');
            if (metaCS) metaCS.setAttribute('content', theme === 'dark' ? 'dark light' : 'light dark');
          } catch(_){}
          try {
            var metaTC = document.querySelector('meta[name="theme-color"]');
            if (metaTC) {
              metaTC.setAttribute('content', theme === 'dark' ? '#0C0C0C' : '#DCDCDC');
            }
          } catch(_){}
          try {
            var evt = new CustomEvent('theme:change', { detail: { theme: theme } });
            window.dispatchEvent(evt);
          } catch(_){}
        }

        function attachAuth(){
          if (state.unsubAuth) return;
          var services = ensureFirebase();
          if (!services || !services.auth || !services.db){
            if (state.authRetry < 6){
              state.authRetry += 1;
              setTimeout(attachAuth, 600);
            }
            return;
          }
          state.authRetry = 0;
          state.auth = services.auth;
          state.db = services.db;
          state.unsubAuth = state.auth.onAuthStateChanged(function(user){
            if (!state.refs) return;
            if (!user){
              try {
                var currentHash = String(window.location.hash || '').toLowerCase();
                if (!/^#\/(?:privacy|terms)(?:\/|$)/i.test(currentHash)) {
                  if (typeof window.__redirectToLoginImmediately === 'function') window.__redirectToLoginImmediately();
                  else window.location.replace('#/login');
                }
              } catch(_){ }
              return;
            }
            state.currentUid = user.uid;
            updateField(state.refs.email, user.email || '--');
            tryRenderCachedBalance(user.uid);
            var renderAccountFields = function(data){
              if (!state.refs) return;
              var levelLabel = data.level || '--';
              try {
                var resolvedSiteState = (typeof window.__getResolvedSiteStateData === 'function')
                  ? window.__getResolvedSiteStateData()
                  : window.__SITE_STATE_DATA__;
                var levelsState = resolvedSiteState && typeof resolvedSiteState === 'object'
                  ? (resolvedSiteState.levels && typeof resolvedSiteState.levels === 'object'
                    ? resolvedSiteState.levels
                    : (resolvedSiteState.siteState && resolvedSiteState.siteState.levels && typeof resolvedSiteState.siteState.levels === 'object'
                      ? resolvedSiteState.siteState.levels
                      : null))
                  : null;
                var levelItems = levelsState
                  ? (Array.isArray(levelsState.items)
                    ? levelsState.items
                    : (Array.isArray(levelsState.levels) ? levelsState.levels : (Array.isArray(levelsState.entries) ? levelsState.entries : [])))
                  : [];
                if (!levelItems.length && levelsState && typeof levelsState === 'object') {
                  var reservedLevelKeys = { items: true, levels: true, entries: true, enabled: true, title: true, subtitle: true, description: true };
                  levelItems = Object.keys(levelsState).map(function(key){
                    if (reservedLevelKeys[key]) return null;
                    var value = levelsState[key];
                    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
                    var entry = Object.assign({ key: key, levelKey: key }, value);
                    return (entry.id != null || entry.label || entry.name || entry.title || entry.order != null || entry.rank != null || entry.requiredSpent != null || entry.minSpent != null) ? entry : null;
                  }).filter(Boolean);
                }
                var levelId = Number(data.levelId != null ? data.levelId : data.level_id);
                var levelOrder = Number(data.levelNo != null ? data.levelNo : data.level_no);
                var levelKey = String(data.level || '').trim().toLowerCase();
                var matchedLevel = null;
                if (Number.isFinite(levelId) && levelId > 0) {
                  matchedLevel = levelItems.find(function(entry){
                    var entryId = Number(entry && (entry.id != null ? entry.id : (entry.levelId != null ? entry.levelId : entry.level_id)));
                    return Number.isFinite(entryId) && Math.trunc(entryId) === Math.trunc(levelId);
                  }) || null;
                }
                if (!matchedLevel && Number.isFinite(levelOrder) && levelOrder > 0) {
                  matchedLevel = levelItems.find(function(entry){
                    var entryOrder = Number(entry && (entry.order != null ? entry.order : entry.rank));
                    return Number.isFinite(entryOrder) && Math.trunc(entryOrder) === Math.trunc(levelOrder);
                  }) || null;
                }
                if (!matchedLevel && levelKey) {
                  matchedLevel = levelItems.find(function(entry){
                    var entryKey = String(entry && (entry.key || entry.levelKey || entry.level || entry.code || '')).trim().toLowerCase();
                    return !!entryKey && entryKey === levelKey;
                  }) || null;
                }
                if (matchedLevel && matchedLevel.label) levelLabel = matchedLevel.label;
              } catch(_){}
              updateField(state.refs.username, data.username || '--');
              updateField(state.refs.level, levelLabel || '--');
              updateField(state.refs.totalspent, formatBalance(data.totalspent == null ? 0 : data.totalspent));
              updateField(state.refs.phone, data.phone || '--');
              updateField(state.refs.webuid, data.webuid || '--');
              renderBalance(data.balance == null ? 0 : data.balance);
              try { if (typeof writeBalanceMemory === 'function') writeBalanceMemory(user.uid, Number(data.balance == null ? 0 : data.balance) || 0); } catch(_){}
              // Propagate the authoritative server balance (Neon) to the SHARED header
              // display + its localStorage cache (balance:cache:<uid>) too — otherwise the
              // account screen shows the fresh balance while the header stays on the stale
              // boot-time value until the next reload ("لم يتحدث الرصيد في الهيدر/اللوكل ستوريج").
              try {
                var acctBalNum = Number(data.balance == null ? 0 : data.balance);
                if (Number.isFinite(acctBalNum)) {
                  var acctBalFmt = (typeof window.__formatHeaderBalanceDisplay === 'function')
                    ? window.__formatHeaderBalanceDisplay(acctBalNum)
                    : (acctBalNum.toFixed(3) + ' $');
                  try { window.__BAL_BASE__ = acctBalNum; window.__BALANCE__ = acctBalNum; } catch(_){}
                  try { if (typeof window.__setHeaderBalanceDisplay === 'function') window.__setHeaderBalanceDisplay(acctBalFmt); } catch(_){}
                  try { localStorage.setItem('balance:cache:' + user.uid, String(acctBalNum)); } catch(_){}
                  try { window.dispatchEvent(new CustomEvent('balance:change', { detail: { value: acctBalNum, formatted: acctBalFmt } })); } catch(_){}
                }
              } catch(_){}
            };
            // Customer account data comes ONLY from the server (D1 profile + Neon
            // balance) carrying the session key — never a direct Firebase users/{uid}
            // read (that path is closed on the rules side). On a hard miss we prompt
            // re-login instead of touching Firebase.
            var onAccountServerMiss = function(){
              if (!state.refs) return;
              showToast('تعذر تحميل البيانات من الخادم. أعد تسجيل الدخول وحاول مجدداً.', false);
            };
            // Read the account (balance + settings) FROM THE SERVER (D1 profile + Neon
            // balance). If the server reports required data missing (e.g. a skipped
            // phone) → open the input form.
            var applyAccountInfo = function(info){
              if (!state.refs) return false;
              if (!info || !info.account) return false;
              var acc = info.account;
              if (acc.email) updateField(state.refs.email, acc.email);
              renderAccountFields({
                username: acc.username,
                level: acc.level,
                levelId: acc.levelId,
                levelNo: acc.levelNo,
                phone: acc.phone,
                webuid: acc.webuid,
                totalspent: acc.totalspent,
                balance: (info.balance == null ? 0 : info.balance)
              });
              if (info.needsInput && Array.isArray(info.missingFields) && info.missingFields.indexOf('phone') !== -1) {
                try {
                  if (typeof window.__promptAccountMissingPhone === 'function') window.__promptAccountMissingPhone(user.uid, info.missingFields);
                  else if (typeof window.__loadRouteChunk === 'function') {
                    // The prompt lives in the lazily-loaded wallet chunk — pull it in.
                    window.__loadRouteChunk('wallet').then(function(){
                      if (typeof window.__promptAccountMissingPhone === 'function') window.__promptAccountMissingPhone(user.uid, info.missingFields);
                      else showToast('يرجى إكمال رقم هاتفك من إعدادات الحساب.', false);
                    }).catch(function(){ showToast('يرجى إكمال رقم هاتفك من إعدادات الحساب.', false); });
                  }
                  else showToast('يرجى إكمال رقم هاتفك من إعدادات الحساب.', false);
                } catch(_){}
              }
              return true;
            };
            var loadAccountFromServer = function(){
              if (typeof window.__fetchAccountInfoFromServer !== 'function') return Promise.resolve(null);
              return Promise.resolve(window.__fetchAccountInfoFromServer(user.uid)).catch(function(){ return null; });
            };
            // SINGLE server round-trip for the settings screen: the sync (?action=auth)
            // both (re)establishes the D1 session AND returns the full profile (account
            // block), so the page renders straight from it — NO separate account-info
            // request. Keep the Neon-sourced cached balance so the sync's D1 display-mirror
            // can't regress it. account-info is only a FALLBACK if the sync can't deliver a
            // profile (older worker / edge). This is what makes the page one request, not two.
            var applySyncedProfile = function(synced){
              if (!synced || !synced.info || !synced.info.account) return false;
              var info = synced.info;
              try {
                var rawBal = localStorage.getItem('balance:cache:' + user.uid);
                var cachedBal = (rawBal == null || rawBal === '') ? NaN : Number(rawBal);
                if (Number.isFinite(cachedBal)) info = Object.assign({}, info, { balance: cachedBal });
              } catch(_){}
              return applyAccountInfo(info);
            };
            if (typeof window.__syncCatalogAuthFromToken === 'function' && user && typeof user.getIdToken === 'function') {
              Promise.resolve(user.getIdToken(true)).then(function(idToken){
                if (!idToken) return null;
                return window.__syncCatalogAuthFromToken(idToken, { uid: user.uid, email: user.email || '' });
              }).then(function(synced){
                if (applySyncedProfile(synced)) return;
                return loadAccountFromServer().then(function(info){
                  if (!applyAccountInfo(info)) onAccountServerMiss();
                });
              }).catch(function(){ onAccountServerMiss(); });
            } else {
              loadAccountFromServer().then(function(info){
                if (!applyAccountInfo(info)) onAccountServerMiss();
              });
            }
          });
        }

        function build(){
          var root = ensureRoot();
          attachAuth();
          syncBodyThemeClass();
          var frag = document.createDocumentFragment();
          frag.appendChild(root);
          return frag;
        }

        function onShow(){
          syncBodyThemeClass();
        }

        function prewarm(){
          try { queueI18nPrewarm(state.root || ensureRoot, { maxItems: 160 }); } catch(_){}
        }

        return {
          build: build,
          onShow: onShow,
          prewarm: prewarm
        };
      })();

      var levelsRoute = (function(){
        var TELEGRAM_STATUS_AUTH_CACHE_TTL_MS = 4000;
        var state = {
          root: null,
          refs: null,
          auth: null,
          db: null,
          unsubAuth: null,
          authAttachPromise: null,
          unsubProfile: null,
          currentUid: null,
          profile: null,
          profileResolvedUid: '',
          clientLevelsResolvedUid: '',
          initialReadyPromise: null,
          initialReadyResolve: null,
          initialReadySettled: true,
          siteState: null,
          siteStateBound: false,
          siteStateRefreshPromise: null,
          levelsLoadCount: 0,
          styleReady: false
        };

        function ensureStyle(){
          if (state.styleReady) return;
          state.styleReady = true;
          if (document.getElementById('levels-route-style')) return;
          var style = document.createElement('style');
          style.id = 'levels-route-style';
          style.textContent = [
            '.levels-page{min-height:100%;color:var(--text);}',
            '.levels-spacer{height:12px;}',
            '.levels-shell{display:grid;gap:16px;padding-bottom:18px;}',
            '.levels-hero{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:16px;align-items:center;padding:20px;border-radius:28px;border:1px solid rgba(94,113,216,.16);background:linear-gradient(160deg,rgba(255,255,255,.96),rgba(238,243,255,.92));box-shadow:0 18px 42px rgba(17,24,39,.08);}',
            '.levels-hero-copy{display:grid;gap:8px;min-width:0;}',
            '.levels-eyebrow{font-size:.78rem;font-weight:900;color:#2563eb;letter-spacing:.05em;}',
            '.levels-hero h2{margin:0;font-size:1.7rem;line-height:1.35;}',
            '.levels-hero p{margin:0;color:var(--muted);line-height:1.9;}',
            '.levels-hero-badge{width:96px;height:96px;border-radius:28px;border:1px solid rgba(94,113,216,.18);background:linear-gradient(135deg,#f8fbff,#e9f0ff);display:flex;align-items:center;justify-content:center;overflow:hidden;box-shadow:inset 0 1px 0 rgba(255,255,255,.7);}',
            '.levels-hero-badge img{width:100%;height:100%;object-fit:cover;display:block;}',
            '.levels-hero-badge span{font-size:2rem;font-weight:900;color:#2563eb;}',
            '.levels-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;}',
            '.levels-stat{padding:16px 18px;border-radius:22px;border:1px solid rgba(94,113,216,.14);background:linear-gradient(180deg,#ffffff,#f6f8ff);box-shadow:0 12px 28px rgba(17,24,39,.06);display:grid;gap:6px;}',
            '.levels-stat span{font-size:.78rem;font-weight:800;color:var(--muted);}',
            '.levels-stat strong{font-size:1.02rem;line-height:1.55;color:var(--text);word-break:break-word;}',
            '.levels-status{padding:12px 14px;border-radius:18px;border:1px solid rgba(148,163,184,.2);background:rgba(255,255,255,.68);color:var(--muted);display:none;}',
            '.levels-status.is-visible{display:block;}',
            '.levels-status[data-tone=\"err\"]{color:#b91c1c;border-color:rgba(220,38,38,.24);background:rgba(254,242,242,.86);}',
            '.levels-status[data-tone=\"ok\"]{color:#047857;border-color:rgba(16,185,129,.24);background:rgba(236,253,245,.86);}',
            '.levels-actions{display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap;}',
            '.levels-refresh{min-height:42px;border-radius:16px;padding:0 16px;}',
            '.levels-list{display:grid;gap:12px;}',
            '.levels-empty{padding:24px 18px;border:1px dashed rgba(148,163,184,.28);border-radius:22px;background:rgba(255,255,255,.72);color:var(--muted);text-align:center;line-height:1.9;}',
            '.levels-card{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:14px;align-items:center;padding:16px 18px;border-radius:24px;border:1px solid rgba(94,113,216,.14);background:linear-gradient(180deg,#ffffff,#f7faff);box-shadow:0 16px 34px rgba(15,23,42,.06);}',
            '.levels-card-media{width:78px;height:78px;border-radius:22px;border:1px solid rgba(94,113,216,.14);background:linear-gradient(135deg,#f8fbff,#ecf2ff);display:flex;align-items:center;justify-content:center;overflow:hidden;box-shadow:inset 0 1px 0 rgba(255,255,255,.72);}',
            '.levels-card-media img{width:100%;height:100%;object-fit:cover;display:block;}',
            '.levels-card-media span{font-size:1.4rem;font-weight:900;color:#2563eb;}',
            '.levels-card-copy{display:grid;gap:8px;min-width:0;}',
            '.levels-card-title{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;}',
            '.levels-card-title h3{margin:0;font-size:1.05rem;line-height:1.4;}',
            '.levels-card-key{font-size:.76rem;color:var(--muted);direction:ltr;unicode-bidi:plaintext;}',
            '.levels-card-copy p{margin:0;color:var(--muted);line-height:1.85;}',
            '.levels-card-meta{display:flex;flex-wrap:wrap;gap:8px;}',
            '.levels-chip{display:inline-flex;align-items:center;justify-content:center;min-height:32px;padding:0 12px;border-radius:999px;background:#eef2ff;color:#26408b;font-size:.74rem;font-weight:800;border:1px solid rgba(94,113,216,.12);}',
            '.levels-card-state{display:grid;justify-items:end;gap:8px;text-align:left;}',
            '.levels-pill{display:inline-flex;align-items:center;justify-content:center;min-height:34px;padding:0 14px;border-radius:12px;border:1px solid transparent;font-size:.78rem;font-weight:900;white-space:nowrap;}',
            '.levels-pill[data-state=\"current\"]{background:rgba(37,99,235,.14);border-color:rgba(37,99,235,.22);color:#2563eb;}',
            '.levels-pill[data-state=\"completed\"]{background:rgba(22,163,74,.14);border-color:rgba(22,163,74,.22);color:#15803d;}',
            '.levels-pill[data-state=\"eligible\"]{background:rgba(245,158,11,.14);border-color:rgba(245,158,11,.22);color:#b45309;}',
            '.levels-pill[data-state=\"locked\"]{background:rgba(148,163,184,.14);border-color:rgba(148,163,184,.2);color:#64748b;}',
            '.levels-pill[data-state=\"manual\"]{background:rgba(139,92,246,.14);border-color:rgba(139,92,246,.22);color:#7c3aed;}',
            '.levels-note{font-size:.78rem;color:var(--muted);line-height:1.75;}',
            'body.dark-mode .levels-hero, html[data-theme=\"dark\"] .levels-hero{background:linear-gradient(160deg,rgba(13,22,52,.96),rgba(10,16,39,.94));border-color:rgba(124,147,255,.22);box-shadow:0 22px 50px rgba(2,6,18,.36);}',
            'body.dark-mode .levels-hero-badge, html[data-theme=\"dark\"] .levels-hero-badge{background:linear-gradient(135deg,#132245,#0f1a35);border-color:rgba(124,147,255,.22);}',
            'body.dark-mode .levels-hero-badge span, html[data-theme=\"dark\"] .levels-hero-badge span{color:#93c5fd;}',
            'body.dark-mode .levels-summary .levels-stat, html[data-theme=\"dark\"] .levels-summary .levels-stat, body.dark-mode .levels-card, html[data-theme=\"dark\"] .levels-card{background:linear-gradient(180deg,#111c39,#0d152d);border-color:rgba(124,147,255,.18);box-shadow:0 16px 36px rgba(2,6,18,.28);}',
            'body.dark-mode .levels-card-media, html[data-theme=\"dark\"] .levels-card-media{background:linear-gradient(135deg,#152444,#101a35);border-color:rgba(124,147,255,.18);}',
            'body.dark-mode .levels-chip, html[data-theme=\"dark\"] .levels-chip{background:rgba(125,140,255,.12);border-color:rgba(125,140,255,.18);color:#dbe7ff;}',
            'body.dark-mode .levels-empty, html[data-theme=\"dark\"] .levels-empty{background:rgba(10,18,42,.88);border-color:rgba(124,147,255,.22);color:#9fb4d9;}',
            '@media (max-width:920px){.levels-summary{grid-template-columns:1fr;}.levels-hero{grid-template-columns:1fr;}.levels-card{grid-template-columns:1fr;justify-items:start;}.levels-card-state{justify-items:start;text-align:right;}.levels-actions{justify-content:flex-start;}}',
            '@media (max-width:640px){.levels-card-media,.levels-hero-badge{width:72px;height:72px;border-radius:20px;}.levels-hero h2{font-size:1.4rem;}}'
          ].join('');
          style.textContent += [
            '.levels-page{min-height:100%;background:transparent;color:#11224f;--levels-line:#8ea0bf;--levels-title:#0f254f;--levels-muted:#23395d;--levels-card-bg:transparent;--levels-card-border:transparent;--levels-card-shadow:none;--levels-progress-bg:rgba(53,103,242,.14);--levels-progress-badge:transparent;--levels-theme-trans:var(--theme-trans, .24s);--levels-theme-ease:var(--ease-soft, ease);}',
            '.levels-spacer{height:4px;}',
            '.levels-main{padding:18px 0 34px;}',
            '.levels-shell{display:grid;gap:16px;padding-top:0;padding-bottom:0;}',
            '.levels-actions{display:flex;justify-content:flex-end;gap:10px;}',
            '.levels-refresh{min-height:40px;padding:0 18px;border-radius:16px;border:2px solid #3a3a3a !important;background:#fff !important;color:#222 !important;box-shadow:none !important;font-size:.88rem;font-weight:800;}',
            '.levels-refresh:hover{transform:none;filter:none;}',
            '.levels-hero{display:flex;flex-direction:column;align-items:stretch;gap:12px;padding:0;border:0;background:transparent;box-shadow:none;border-radius:0;}',
            '.levels-eyebrow{display:none !important;}',
            '.levels-hero-copy{display:grid;gap:0;min-width:0;padding-bottom:0;border-bottom:0;}',
            '.levels-current-head,.levels-hero-copy{width:100%;}',
            '.levels-current-head{display:flex;align-items:center;justify-content:center;gap:14px;flex-wrap:nowrap;width:100%;padding-bottom:14px;border-bottom:1px solid var(--levels-line);}',
            '.levels-hero h2{margin:0;font-size:2rem;font-weight:900;line-height:1.2;color:var(--levels-title);unicode-bidi:plaintext;text-align:center;}',
            '.levels-hero-badge{width:74px;height:74px;flex:0 0 74px;border-radius:50%;border:0;background:transparent;display:flex;align-items:center;justify-content:center;overflow:hidden;box-shadow:none;padding:0;}',
            '.levels-hero-badge img,.levels-hero-badge svg{width:100%;height:100%;display:block;object-fit:contain;object-position:center center;}',
            '.levels-hero p{margin:0;padding-top:14px;font-size:1rem;line-height:2;color:var(--levels-muted);text-align:right;}',
            '.levels-summary{display:none !important;}',
            '.levels-progress{display:none !important;}',
            '.levels-progress-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;}',
            '.levels-progress-head span{font-size:.82rem;font-weight:800;color:#5b6b8c;}',
            '.levels-progress-head strong{font-size:1rem;font-weight:900;color:#0f254f;}',
            '.levels-progress-track{position:relative;height:10px;border-radius:999px;background:rgba(53,103,242,.14);overflow:hidden;}',
            '.levels-progress-track span{display:block;width:0;height:100%;border-radius:inherit;background:linear-gradient(90deg,#3567f2,#6da8ff);transition:width .24s ease;}',
            '.levels-progress-text{margin:0;color:#23395d;font-size:.94rem;line-height:1.9;}',
            '.levels-warning{display:none;padding:10px 0 0;color:#ff452b;font-size:.95rem;font-weight:800;line-height:1.8;background:transparent;border:0;}',
            '.levels-warning.is-visible{display:block;}',
            '.levels-status{display:none;border:0;background:transparent;color:#b91c1c;padding:0;}',
            '.levels-status.is-visible{display:block;}',
            '.levels-status[data-tone=\"ok\"]{color:#15803d;}',
            '.levels-list{display:grid;gap:10px;padding-top:2px;}',
            '.levels-empty{padding:18px 0;color:var(--levels-muted);background:transparent;border:0;box-shadow:none;text-align:right;}',
            '.levels-card{display:flex;align-items:center;justify-content:flex-start;gap:14px;padding:10px 0;border:0;background:var(--levels-card-bg);box-shadow:var(--levels-card-shadow);min-height:0;direction:rtl;border-radius:0;}',
            '.levels-card.is-target{align-items:flex-start;}',
            '.levels-card-media{width:54px;height:54px;flex:0 0 54px;border-radius:0;border:0;background:transparent;box-shadow:none;display:flex;align-items:center;justify-content:center;overflow:visible;padding:0;}',
            '.levels-card-media img{width:54px;height:54px;object-fit:contain;object-position:center center;display:block;}',
            '.levels-card-media span{font-size:1.8rem;font-weight:900;color:#3567f2;}',
            '.levels-card-copy{display:grid;gap:8px;min-width:0;flex:1 1 auto;}',
            '.levels-card-title{display:block;}',
            '.levels-card-title h3{margin:0;font-size:1.04rem;font-weight:900;line-height:1.7;color:var(--levels-title);}',
            '.levels-card-key{display:none;}',
            '.levels-card-copy p{display:none;}',
            '.levels-card-meta{display:none;}',
            '.levels-card-progress{display:none;gap:8px;min-width:0;}',
            '.levels-card.is-target .levels-card-progress{display:grid;}',
            '.levels-card-progress-head{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:center;gap:10px;direction:ltr;}',
            '.levels-card-progress-boundary{font-size:.8rem;font-weight:800;color:var(--levels-muted);direction:ltr;unicode-bidi:plaintext;white-space:nowrap;}',
            '.levels-card-progress-boundary.is-current{justify-self:end;text-align:right;}',
            '.levels-card-progress-boundary.is-target{justify-self:start;text-align:left;}',
            '.levels-card-progress-percent{justify-self:center;font-size:.9rem;font-weight:900;color:var(--levels-title);background:var(--levels-progress-badge);padding:0;border-radius:0;line-height:1.2;}',
            '.levels-card-progress-track{position:relative;height:10px;border-radius:999px;background:var(--levels-progress-bg);overflow:hidden;}',
            '.levels-card-progress-fill{display:block;width:0;height:100%;border-radius:inherit;background:linear-gradient(90deg,#3567f2,#6da8ff);}',
            '.levels-card-progress-caption{margin:0;color:var(--levels-muted);font-size:.9rem;line-height:1.8;}',
            '.levels-card-state{display:flex;align-items:center;justify-content:center;min-width:36px;padding:0;margin:0 0 0 6px;order:2;align-self:center;}',
            '.levels-pill{width:auto;height:auto;min-height:0;flex:0 0 auto;padding:0;border-radius:0;background:transparent !important;border:0 !important;color:#64748b;font-size:0;display:inline-flex;align-items:center;justify-content:center;overflow:visible;box-shadow:none;}',
            '.levels-pill-icon{width:20px;height:20px;display:block;fill:currentColor;}',
            '.levels-pill[data-state=\"current\"]{color:#2563eb;}',
            '.levels-pill[data-state=\"completed\"]{color:#15803d;}',
            '.levels-pill[data-state=\"eligible\"]{color:#b45309;}',
            '.levels-pill[data-state=\"manual\"]{color:#7c3aed;}',
            '.levels-pill[data-state=\"locked\"]{color:#64748b;}',
            '.levels-note,.levels-sidekey{display:none !important;}',
            '.levels-page,.levels-page *,.levels-page *::before,.levels-page *::after{transition-property:background-color,color,border-color,box-shadow,opacity,fill,stroke;transition-duration:var(--levels-theme-trans);transition-timing-function:var(--levels-theme-ease);}',
            '.levels-progress-track span,.levels-card-progress-fill{transition:width .24s ease,background-color var(--levels-theme-trans) var(--levels-theme-ease),fill var(--levels-theme-trans) var(--levels-theme-ease),stroke var(--levels-theme-trans) var(--levels-theme-ease);}',
            'body.dark-mode .levels-page, html[data-theme=\"dark\"] .levels-page{background:transparent;color:#e5edff;--levels-line:rgba(124,147,255,.24);--levels-title:#f8fbff;--levels-muted:#c7d4f1;--levels-card-bg:transparent;--levels-card-border:transparent;--levels-card-shadow:none;--levels-progress-bg:rgba(103,127,214,.22);--levels-progress-badge:transparent;}',
            'body.dark-mode .levels-hero, html[data-theme=\"dark\"] .levels-hero{background:transparent !important;border:0 !important;box-shadow:none !important;}',
            'body.dark-mode .levels-current-head, html[data-theme=\"dark\"] .levels-current-head{border-bottom-color:rgba(124,147,255,.22);}',
            'body.dark-mode .levels-hero h2, html[data-theme=\"dark\"] .levels-hero h2{color:#f4f7ff;}',
            'body.dark-mode .levels-hero p, html[data-theme=\"dark\"] .levels-hero p{color:#c3d0ef;}',
            'body.dark-mode .levels-empty, html[data-theme=\"dark\"] .levels-empty{color:#9fb4d9;}',
            'body.dark-mode .levels-hero-badge, html[data-theme=\"dark\"] .levels-hero-badge{background:transparent;border-color:transparent;box-shadow:none;}',
            'body.dark-mode .levels-card, html[data-theme=\"dark\"] .levels-card{padding:10px 0;border-radius:0;background:var(--levels-card-bg);border:0;box-shadow:var(--levels-card-shadow);}',
            'body.dark-mode .levels-card-media, html[data-theme=\"dark\"] .levels-card-media{background:transparent;border-color:transparent;box-shadow:none;}',
            'body.dark-mode .levels-card-title h3, html[data-theme=\"dark\"] .levels-card-title h3{color:#f8fbff;}',
            'body.dark-mode .levels-progress-head span, html[data-theme=\"dark\"] .levels-progress-head span{color:#9fb4d9;}',
            'body.dark-mode .levels-progress-head strong, html[data-theme=\"dark\"] .levels-progress-head strong, body.dark-mode .levels-progress-text, html[data-theme=\"dark\"] .levels-progress-text{color:#e5edff;}',
            'body.dark-mode .levels-progress-track, html[data-theme=\"dark\"] .levels-progress-track{background:rgba(125,140,255,.18);}',
            'body.dark-mode .levels-card-progress-boundary, html[data-theme=\"dark\"] .levels-card-progress-boundary{color:#9fb4d9;}',
            'body.dark-mode .levels-card-progress-percent, html[data-theme=\"dark\"] .levels-card-progress-percent, body.dark-mode .levels-card-progress-caption, html[data-theme=\"dark\"] .levels-card-progress-caption{color:#e5edff;}',
            'body.dark-mode .levels-card-progress-percent, html[data-theme=\"dark\"] .levels-card-progress-percent{background:transparent;}',
            'body.dark-mode .levels-card-progress-track, html[data-theme=\"dark\"] .levels-card-progress-track{background:rgba(125,140,255,.18);}',
            'body.dark-mode .levels-pill{background:transparent !important;border:0 !important;color:#aab7d4;}',
            'body.dark-mode .levels-pill[data-state=\"current\"], html[data-theme=\"dark\"] .levels-pill[data-state=\"current\"]{color:#8bbcff;}',
            'body.dark-mode .levels-pill[data-state=\"completed\"], html[data-theme=\"dark\"] .levels-pill[data-state=\"completed\"]{color:#86efac;}',
            'body.dark-mode .levels-pill[data-state=\"eligible\"], html[data-theme=\"dark\"] .levels-pill[data-state=\"eligible\"]{color:#fbbf24;}',
            'body.dark-mode .levels-pill[data-state=\"manual\"], html[data-theme=\"dark\"] .levels-pill[data-state=\"manual\"]{color:#c4b5fd;}',
            'body.dark-mode .levels-pill[data-state=\"locked\"], html[data-theme=\"dark\"] .levels-pill[data-state=\"locked\"]{color:#b8c4dc;}',
            '@media (max-width:640px){.levels-main{padding-top:12px;}.levels-hero h2{font-size:1.72rem;}.levels-hero-badge{width:62px;height:62px;flex-basis:62px;}.levels-hero-copy{padding-bottom:12px;}.levels-hero p{font-size:.94rem;}.levels-card-media,.levels-card-media img{width:46px;height:46px;}.levels-card-media{flex-basis:46px;}.levels-card-title h3{font-size:.98rem;}.levels-card-progress{gap:10px;}.levels-card-progress-head{grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);gap:8px;align-items:center;}.levels-card-progress-boundary{font-size:.74rem;}.levels-card-progress-percent{justify-self:center;font-size:.82rem;padding:0;border-radius:0;background:var(--levels-progress-badge);line-height:1.2;}.levels-card-progress-track{height:12px;}.levels-card-progress-caption{font-size:.84rem;line-height:1.7;}.levels-pill-icon{width:18px;height:18px;}}'
          ].join('');
          (document.head || document.documentElement).appendChild(style);
        }

        function normalizeLevelKey(value){
          return String(value == null ? '' : value).trim().toLowerCase();
        }

        function normalizeLevelAsciiDigits(value){
          return String(value == null ? '' : value)
            .replace(/[\u0660-\u0669]/g, function(digit){
              return String(digit.charCodeAt(0) - 0x0660);
            })
            .replace(/[\u06F0-\u06F9]/g, function(digit){
              return String(digit.charCodeAt(0) - 0x06F0);
            });
        }

        function parseLevelNumber(value){
          if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
          var normalized = normalizeLevelAsciiDigits(value)
            .replace(/[\u200E\u200F\u061C]/g, '')
            .replace(/[\u00A0\u202F\s]/g, '')
            .replace(/[أ¢ث†â€™أ¢â‚¬â€œأ¢â‚¬â€‌]/g, '-')
            .replace(/[\u066B]/g, '.')
            .replace(/[\u066C\u060C]/g, ',')
            .trim();
          if (!normalized) return NaN;
          if (normalized.indexOf('.') !== -1 && normalized.indexOf(',') !== -1) {
            if (normalized.lastIndexOf('.') > normalized.lastIndexOf(',')) normalized = normalized.replace(/,/g, '');
            else normalized = normalized.replace(/\./g, '').replace(/,/g, '.');
          } else if (normalized.indexOf(',') !== -1) {
            if ((normalized.match(/,/g) || []).length > 1) normalized = normalized.replace(/,/g, '');
            else {
              var commaIndex = normalized.lastIndexOf(',');
              var decimalsLen = normalized.length - commaIndex - 1;
              normalized = decimalsLen > 0 && decimalsLen <= 3
                ? (normalized.slice(0, commaIndex).replace(/,/g, '') + '.' + normalized.slice(commaIndex + 1))
                : normalized.replace(/,/g, '');
            }
          }
          var num = Number(normalized);
          return Number.isFinite(num) ? num : NaN;
        }

        function escHtml(value){
          return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
        }

        function formatMoney(value){
          var num = parseLevelNumber(value);
          if (!Number.isFinite(num)) num = 0;
          try {
            if (typeof window.formatCurrencyFromJOD === 'function') return window.formatCurrencyFromJOD(num);
          } catch(_){}
          return num.toFixed(3) + ' $';
        }

        function normalizeLevelId(value){
          var num = parseLevelNumber(value);
          if (!Number.isFinite(num) || num <= 0) return null;
          return Math.trunc(num);
        }

        function readResolvedSiteState(){
          try {
            var raw = (typeof window.__getResolvedSiteStateData === 'function')
              ? window.__getResolvedSiteStateData()
              : window.__SITE_STATE_DATA__;
            if (!raw || typeof raw !== 'object') return null;
            if (raw.siteState && typeof raw.siteState === 'object' && !raw.levels) return raw.siteState;
            return raw;
          } catch(_) {
            return null;
          }
        }

        function sanitizeLevelBadgeMediaUrl(value){
          try {
            if (typeof sanitizeCatalogCardMediaUrl === 'function') {
              return sanitizeCatalogCardMediaUrl(value);
            }
          } catch (_) {}
          try {
            if (typeof window.sanitizeCatalogCardMediaUrl === 'function') {
              return window.sanitizeCatalogCardMediaUrl(value);
            }
          } catch (_) {}
          var text = String(value == null ? '' : value).trim();
          if (!text) return '';
          var lower = text.toLowerCase();
          if (lower === 'undefined' || lower === 'null' || lower === 'nan' || lower === 'false' || lower === '[object object]') return '';
          if (/^javascript:/i.test(text)) return '';
          return text;
        }

        function normalizeLevelEntry(rawKey, rawEntry, fallbackOrder){
          var src = (rawEntry && typeof rawEntry === 'object') ? rawEntry : {};
          var levelId = normalizeLevelId(src.id != null ? src.id : (src.levelId != null ? src.levelId : src.level_id));
          if (levelId == null) return null;
          var key = normalizeLevelKey(rawKey || src.key || src.levelKey || src.level || src.code || ('level_' + String(levelId)));
          var requiredSpent = parseLevelNumber(src.requiredSpent != null ? src.requiredSpent : (src.required_spent != null ? src.required_spent : (src.minSpent != null ? src.minSpent : src.threshold)));
          var order = parseLevelNumber(src.order != null ? src.order : (src.rank != null ? src.rank : fallbackOrder));
          var hiddenRaw = src.hidden != null ? src.hidden : (src.isHidden != null ? src.isHidden : (src.hide != null ? src.hide : src.hiddenFromUsers));
          var hiddenText = String(hiddenRaw == null ? '' : hiddenRaw).trim().toLowerCase();
          return {
            id: levelId,
            key: key,
            label: String(src.label || src.name || src.title || key).trim() || key,
            order: Number.isFinite(order) && order > 0 ? Math.trunc(order) : fallbackOrder,
            requiredSpent: Number.isFinite(requiredSpent) && requiredSpent > 0 ? requiredSpent : 0,
            imageUrl: String(src.imageUrl || src.image || src.badgeImage || src.badge || src.icon || '').trim(),
            manualUnlockOnly: !!(src.manualUnlockOnly === true || src.manual === true || src.autoUnlock === false),
            hidden: !!(hiddenRaw === true || hiddenText === 'true' || hiddenText === '1' || hiddenText === 'yes' || hiddenText === 'on')
          };
        }

        function getCatalogLevelEntries(siteState){
          var safeState = (siteState && typeof siteState === 'object') ? siteState : {};
          var levelsState = (safeState.levels && typeof safeState.levels === 'object') ? safeState.levels : {};
          var rawItems = Array.isArray(levelsState.items)
            ? levelsState.items
            : (Array.isArray(levelsState.levels) ? levelsState.levels : (Array.isArray(levelsState.entries) ? levelsState.entries : []));
          if (!rawItems.length && levelsState && typeof levelsState === 'object') {
            var reservedLevelKeys = { items: true, levels: true, entries: true, enabled: true, title: true, subtitle: true, description: true };
            rawItems = Object.keys(levelsState).map(function(key){
              if (reservedLevelKeys[key]) return null;
              var value = levelsState[key];
              if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
              var entry = Object.assign({ key: key, levelKey: key }, value);
              return (entry.id != null || entry.label || entry.name || entry.title || entry.order != null || entry.rank != null || entry.requiredSpent != null || entry.minSpent != null) ? entry : null;
            }).filter(Boolean);
          }
          var out = [];
          var seen = new Set();
          rawItems.forEach(function(rawEntry, index){
            var entry = normalizeLevelEntry((rawEntry && (rawEntry.key || rawEntry.levelKey || rawEntry.level || rawEntry.code)) || '', rawEntry, index + 1);
            if (!entry || seen.has(entry.id)) return;
            seen.add(entry.id);
            out.push(entry);
          });
          out = out.filter(Boolean).sort(function(a, b){
            if (a.order !== b.order) return a.order - b.order;
            if (a.requiredSpent !== b.requiredSpent) return a.requiredSpent - b.requiredSpent;
            if (a.id !== b.id) return a.id - b.id;
            return String(a.label || '').localeCompare(String(b.label || ''), 'ar', { sensitivity: 'base', numeric: true });
          });
          return out;
        }

        function normalizeLevelOrder(value){
          var num = parseLevelNumber(value);
          if (!Number.isFinite(num) || num <= 0) return null;
          return Math.trunc(num);
        }

        function readProfileLevelId(profile){
          var safeProfile = (profile && typeof profile === 'object') ? profile : {};
          return normalizeLevelId(
            safeProfile.levelId != null ? safeProfile.levelId : safeProfile.level_id
          );
        }

        function readProfileLevelOrder(profile){
          var safeProfile = (profile && typeof profile === 'object') ? profile : {};
          return normalizeLevelOrder(
            safeProfile.levelNo != null ? safeProfile.levelNo : safeProfile.level_no
          );
        }

        function resolveCurrentLevelEntry(allEntries, profile){
          var entries = Array.isArray(allEntries) ? allEntries : [];
          var safeProfile = (profile && typeof profile === 'object') ? profile : {};
          var currentLevelId = readProfileLevelId(safeProfile);
          var currentLevelKey = normalizeLevelKey(safeProfile.level || '');
          var currentLevelOrder = readProfileLevelOrder(safeProfile);
          var currentEntry = null;
          if (currentLevelId != null) {
            currentEntry = entries.find(function(entry){
              return normalizeLevelId(entry && entry.id) === currentLevelId;
            }) || null;
          }
          if (!currentEntry && currentLevelKey) {
            currentEntry = entries.find(function(entry){
              return normalizeLevelKey(entry && entry.key) === currentLevelKey;
            }) || null;
          }
          if (!currentEntry && currentLevelOrder != null) {
            currentEntry = entries.find(function(entry){
              return normalizeLevelOrder(entry && entry.order) === currentLevelOrder;
            }) || null;
          }
          return currentEntry || (entries[0] || null);
        }

        function resolveNextLevelEntry(allEntries, currentRank){
          var entries = Array.isArray(allEntries) ? allEntries : [];
          var safeRank = normalizeLevelOrder(currentRank) || 0;
          return entries.find(function(entry){
            if (!entry || entry.manualUnlockOnly === true) return false;
            return (normalizeLevelOrder(entry && entry.order) || 0) > safeRank;
          }) || null;
        }

        function buildNextLevelProgress(currentEntry, nextEntry, totalSpent){
          var spent = parseLevelNumber(totalSpent);
          if (!Number.isFinite(spent) || spent < 0) spent = 0;
          if (!nextEntry) {
            return {
              remaining: 0,
              ratio: 1,
              spentAmount: spent,
              startRequired: parseLevelNumber(currentEntry && currentEntry.requiredSpent || 0) || 0,
              endRequired: parseLevelNumber(currentEntry && currentEntry.requiredSpent || 0) || 0,
              percentage: 100,
              percentText: '100%',
              message: 'لا توجد ترقية تلقائية تالية حالياً.'
            };
          }
          var currentRequired = parseLevelNumber(currentEntry && currentEntry.requiredSpent || 0);
          if (!Number.isFinite(currentRequired) || currentRequired < 0) currentRequired = 0;
          var nextRequired = parseLevelNumber(nextEntry && nextEntry.requiredSpent || 0);
          if (!Number.isFinite(nextRequired) || nextRequired < currentRequired) nextRequired = currentRequired;
          var span = Math.max(0, nextRequired - currentRequired);
          var remaining = Math.max(0, nextRequired - spent);
          var ratio = span > 0 ? ((spent - currentRequired) / span) : (spent >= nextRequired ? 1 : 0);
          if (!Number.isFinite(ratio)) ratio = 0;
          ratio = Math.max(0, Math.min(1, ratio));
          var percentage = Math.max(0, Math.min(100, Math.round(ratio * 100)));
          var message = remaining > 0
            ? ('تحتاج إلى ' + formatMoney(remaining) + ' للوصول إلى ' + String(nextEntry.label || '').trim() + '.')
            : (nextEntry.manualUnlockOnly
              ? ('استوفيت شرط ' + String(nextEntry.label || '').trim() + ' وبانتظار تفعيل الإدارة.')
              : ('أنت مؤهل الآن للوصول إلى ' + String(nextEntry.label || '').trim() + '.'));
          return {
            remaining: remaining,
            ratio: ratio,
            spentAmount: spent,
            startRequired: currentRequired,
            endRequired: nextRequired,
            percentage: percentage,
            percentText: String(percentage) + '%',
            message: message
          };
        }

        function setStatus(text, tone){
          if (!state.refs || !state.refs.status) return;
          var msg = String(text || '').trim();
          state.refs.status.textContent = msg;
          state.refs.status.className = 'levels-status' + (msg ? ' is-visible' : '');
          if (msg) state.refs.status.setAttribute('data-tone', tone === 'err' ? 'err' : (tone === 'ok' ? 'ok' : 'info'));
          else state.refs.status.removeAttribute('data-tone');
        }

        function buildBadgeMedia(entry){
          var imageUrl = sanitizeLevelBadgeMediaUrl(entry && entry.imageUrl || '');
          if (imageUrl) {
            return '<img src="' + escHtml(imageUrl) + '" alt="' + escHtml(String(entry.label || entry.key || '')) + '" loading="lazy" />';
          }
          var text = String(entry && (entry.label || entry.key) || '?').trim();
          return '<span>' + escHtml((text.charAt(0) || '?').toUpperCase()) + '</span>';
        }

        function hasUsableLevelsSiteState(siteState){
          return getCatalogLevelEntries(siteState).length > 0;
        }

        function getRawLevelItemsForRequirements(siteState){
          var safeState = (siteState && typeof siteState === 'object') ? siteState : {};
          var levelsState = (safeState.levels && typeof safeState.levels === 'object') ? safeState.levels : {};
          var rawItems = Array.isArray(levelsState.items)
            ? levelsState.items
            : (Array.isArray(levelsState.levels) ? levelsState.levels : (Array.isArray(levelsState.entries) ? levelsState.entries : []));
          if (!rawItems.length && levelsState && typeof levelsState === 'object') {
            var reserved = { items: true, levels: true, entries: true, enabled: true, title: true, subtitle: true, description: true, version: true, updatedAt: true, defaultLevelId: true, defaultLevelKey: true };
            rawItems = Object.keys(levelsState).map(function(key){
              if (reserved[key]) return null;
              var value = levelsState[key];
              return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
            }).filter(Boolean);
          }
          return rawItems;
        }

        function hasClientLevelsRequirementData(siteState){
          return getRawLevelItemsForRequirements(siteState).some(function(entry){
            if (!entry || typeof entry !== 'object') return false;
            return Object.prototype.hasOwnProperty.call(entry, 'requiredSpent') ||
              Object.prototype.hasOwnProperty.call(entry, 'required_spent') ||
              Object.prototype.hasOwnProperty.call(entry, 'minSpent') ||
              Object.prototype.hasOwnProperty.call(entry, 'min_spent') ||
              Object.prototype.hasOwnProperty.call(entry, 'threshold');
          });
        }

        function applyClientLevelsProfileBalance(profile){
          var source = (profile && typeof profile === 'object') ? profile : {};
          var val = Number(source.balance != null ? source.balance : (source.balanceStr != null ? source.balanceStr : source.balance_str));
          if (!Number.isFinite(val)) return false;
          var formatted = (typeof window.__formatHeaderBalanceDisplay === 'function')
            ? window.__formatHeaderBalanceDisplay(val)
            : ((typeof window.formatCurrencyFromJOD === 'function')
              ? window.formatCurrencyFromJOD(val)
              : (val.toFixed(3) + ' USD'));
          try { window.__BAL_BASE__ = val; window.__BALANCE__ = val; } catch(_){}
          try {
            if (typeof window.__setHeaderBalanceDisplay === 'function') {
              window.__setHeaderBalanceDisplay(formatted);
            } else {
              var textEl = document.getElementById('headerBalanceText');
              var currencyEl = document.getElementById('headerBalanceCurrency');
              if (textEl) {
                var parts = String(formatted || '').trim().split(/\s+/);
                textEl.textContent = parts.shift() || formatted;
                if (currencyEl) currencyEl.textContent = parts.join(' ') || '';
              }
            }
          } catch(_){}
          try {
            window.dispatchEvent(new CustomEvent('balance:change', { detail: { value: val, formatted: formatted } }));
          } catch(_){}
          try {
            var uid = getCurrentAuthUid();
            if (uid && typeof writeBalanceMemory === 'function') writeBalanceMemory(uid, val);
          } catch(_){}
          return true;
        }

        function readLevelsSessionInfo(){
          var out = { uid: '', sessionKey: '', idToken: '' };
          try {
            var raw = localStorage.getItem('sessionKeyInfo');
            if (raw) {
              var parsed = JSON.parse(raw);
              if (parsed && typeof parsed === 'object') {
                out.uid = String(parsed.uid || parsed.useruid || parsed.userUid || '').trim();
                out.sessionKey = String(parsed.sessionKey || parsed.session_key || '').trim();
              }
            }
          } catch(_){}
          try {
            if (typeof readPostLoginPayload === 'function') {
              var payload = readPostLoginPayload() || {};
              out.uid = out.uid || String(payload.uid || payload.useruid || payload.userUid || '').trim();
              out.sessionKey = out.sessionKey || String(payload.sessionKey || payload.session_key || '').trim();
              out.idToken = String(payload.idToken || payload.id_token || payload.firebaseIdToken || payload.firebase_id_token || payload.token || '').trim();
            }
          } catch(_){}
          return out;
        }

        async function resolveLevelsAuthContext(){
          var session = readLevelsSessionInfo();
          var user = getCurrentAuthUser();
          var uid = String((user && user.uid) || session.uid || state.currentUid || '').trim();
          var idToken = String(session.idToken || '').trim();
          return {
            uid: uid,
            sessionKey: String(session.sessionKey || '').trim(),
            idToken: idToken
          };
        }

        function buildClientLevelsRequestUrl(uid){
          var requestUrl;
          try {
            var workerBase = window.__getSiteWorkerBaseDefault
              ? String(window.__getSiteWorkerBaseDefault({ trailingSlash: true }) || '').trim()
              : '';
            requestUrl = workerBase ? new URL(workerBase) : new URL('/', window.location.href);
          } catch (_) {
            requestUrl = new URL('/', window.location.href);
          }
          requestUrl.searchParams.set('mode', 'client-levels');
          requestUrl.searchParams.set('useruid', String(uid || '').trim());
          requestUrl.searchParams.set('_', String(Date.now()));
          return requestUrl;
        }

        async function fetchClientLevelsStateFromServer(){
          var auth = await resolveLevelsAuthContext();
          if (!auth.uid || !auth.sessionKey) {
            throw new Error('levels_auth_missing');
          }
          var requestUrl = buildClientLevelsRequestUrl(auth.uid);
          var headers = {
            'accept': 'application/json',
            'X-SessionKey': auth.sessionKey
          };
          if (auth.idToken) headers.Authorization = 'Bearer ' + auth.idToken;
          var response = await fetch(requestUrl.toString(), {
            method: 'GET',
            cache: 'no-store',
            headers: headers
          });
          if (!response.ok) throw new Error('levels_http_' + String(response.status || 0));
          var payload = await response.json();
          var levels = payload && payload.levels && typeof payload.levels === 'object' ? payload.levels : null;
          if (!levels || !Array.isArray(levels.items)) throw new Error('levels_payload_invalid');
          var baseState = readResolvedSiteState() || state.siteState || {};
          state.siteState = Object.assign({}, baseState, { levels: levels });
          if (payload && payload.profile && typeof payload.profile === 'object') {
            state.profile = Object.assign({}, state.profile || {}, payload.profile);
            state.profileResolvedUid = auth.uid;
            state.clientLevelsResolvedUid = auth.uid;
            applyClientLevelsProfileBalance(payload.profile);
          }
          return state.siteState;
        }

        function setLevelsPageLoaderPending(active){
          var next = !!active;
          try { window.__LEVELS_INLINE_LOADING__ = next; } catch(_){}
          try {
            if (document.documentElement) document.documentElement.classList.toggle('levels-loader-pending', next);
            if (document.body) document.body.classList.toggle('levels-loader-pending', next);
          } catch(_){}
          try {
            if (next) {
              if (typeof window.__holdPageLoader === 'function') window.__holdPageLoader();
              else if (typeof showPageLoader === 'function') showPageLoader({ hold: true, replay: true });
            } else if (typeof window.__releasePageLoader === 'function') {
              window.__releasePageLoader();
            } else if (typeof hidePageLoader === 'function') {
              hidePageLoader();
            }
          } catch(_){}
        }

        function beginLevelsPageLoader(){
          state.levelsLoadCount = Math.max(0, Number(state.levelsLoadCount) || 0) + 1;
          if (state.levelsLoadCount === 1) setLevelsPageLoaderPending(true);
        }

        function endLevelsPageLoader(){
          state.levelsLoadCount = Math.max(0, (Number(state.levelsLoadCount) || 0) - 1);
          if (state.levelsLoadCount === 0) setLevelsPageLoaderPending(false);
        }

        async function ensureLevelsSiteStateFromNetwork(force){
          var shouldForce = force === true;
          var currentState = readResolvedSiteState() || state.siteState || null;
          if (getCurrentAuthUid()) {
            if (state.siteStateRefreshPromise) {
              await state.siteStateRefreshPromise.catch(function(){ return false; });
              return state.siteState || readResolvedSiteState() || null;
            }
            state.siteStateRefreshPromise = fetchClientLevelsStateFromServer()
              .catch(function(err){
                try { console.warn('client_levels_fetch_failed', err && err.message ? err.message : err); } catch(_){}
                return null;
              })
              .finally(function(){
                state.siteStateRefreshPromise = null;
              });
            var loaded = await state.siteStateRefreshPromise;
            if (loaded) return loaded;
          }
          if (!shouldForce && hasUsableLevelsSiteState(currentState)) {
            state.siteState = currentState;
            return currentState;
          }
          if (state.siteStateRefreshPromise) {
            await state.siteStateRefreshPromise.catch(function(){ return false; });
            return readResolvedSiteState() || state.siteState || null;
          }
          if (typeof window.__refreshSiteStateNow !== 'function') {
            return currentState;
          }
          state.siteStateRefreshPromise = Promise.resolve()
            .then(function(){
              return window.__refreshSiteStateNow();
            })
            .catch(function(){
              return false;
            })
            .finally(function(){
              state.siteStateRefreshPromise = null;
            });
          await state.siteStateRefreshPromise;
          state.siteState = readResolvedSiteState() || state.siteState || null;
          return state.siteState;
        }

        function buildLevelStateIcon(stateKey){
          var key = String(stateKey || 'locked').trim().toLowerCase();
          var attrs = 'xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" focusable="false" class="levels-pill-icon"';
          if (key === 'current') {
            return '<svg ' + attrs + '><path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0m-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z"/></svg>';
          }
          if (key === 'completed') {
            return '<svg ' + attrs + '><path d="M10.067.87a2.89 2.89 0 0 0-4.134 0l-.622.638-.89-.011a2.89 2.89 0 0 0-2.924 2.924l.01.89-.636.622a2.89 2.89 0 0 0 0 4.134l.637.622-.011.89a2.89 2.89 0 0 0 2.924 2.924l.89-.01.622.636a2.89 2.89 0 0 0 4.134 0l.622-.637.89.011a2.89 2.89 0 0 0 2.924-2.924l-.01-.89.636-.622a2.89 2.89 0 0 0 0-4.134l-.637-.622.011-.89a2.89 2.89 0 0 0-2.924-2.924l-.89.01zm.287 5.984-3 3a.5.5 0 0 1-.708 0l-1.5-1.5a.5.5 0 1 1 .708-.708L7 8.793l2.646-2.647a.5.5 0 0 1 .708.708"/></svg>';
          }
          if (key === 'eligible') {
            return '<svg ' + attrs + '><path d="M16 8A8 8 0 1 0 0 8a8 8 0 0 0 16 0m-7.5 3.5a.5.5 0 0 1-1 0V5.707L5.354 7.854a.5.5 0 1 1-.708-.708l3-3a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 5.707z"/></svg>';
          }
          if (key === 'manual') {
            return '<svg ' + attrs + '><path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0M8 4a.905.905 0 0 0-.9.995l.35 3.507a.552.552 0 0 0 1.1 0l.35-3.507A.905.905 0 0 0 8 4m.002 6a1 1 0 1 0 0 2 1 1 0 0 0 0-2"/></svg>';
          }
          return '<svg ' + attrs + '><path fill-rule="evenodd" d="M8 0a4 4 0 0 1 4 4v2.05a2.5 2.5 0 0 1 2 2.45v5a2.5 2.5 0 0 1-2.5 2.5h-7A2.5 2.5 0 0 1 2 13.5v-5a2.5 2.5 0 0 1 2-2.45V4a4 4 0 0 1 4-4m0 1a3 3 0 0 0-3 3v2h6V4a3 3 0 0 0-3-3"/></svg>';
        }

        function buildLevelStatePill(cardState){
          var stateObj = (cardState && typeof cardState === 'object') ? cardState : {};
          var key = String(stateObj.key || 'locked').trim().toLowerCase() || 'locked';
          var label = String(stateObj.label || '').trim();
          return '<span class="levels-pill" data-state="' + escHtml(key) + '" title="' + escHtml(label) + '" aria-label="' + escHtml(label) + '">' + buildLevelStateIcon(key) + '</span>';
        }

        function isSameLevelEntry(a, b){
          var aId = normalizeLevelId(a && a.id);
          var bId = normalizeLevelId(b && b.id);
          if (aId != null && bId != null) return aId === bId;
          return normalizeLevelKey(a && a.key) === normalizeLevelKey(b && b.key);
        }

        function resolveVisibleLevelEntries(allEntries, currentEntry){
          var entries = Array.isArray(allEntries) ? allEntries : [];
          return entries.filter(function(entry){
            if (!entry) return false;
            if (entry.hidden !== true) return true;
            return !!(currentEntry && isSameLevelEntry(entry, currentEntry));
          });
        }

        function resolveCardState(entry, allEntries, currentEntry, totalSpent){
          var currentIndex = allEntries.findIndex(function(item){ return isSameLevelEntry(item, currentEntry); });
          var entryIndex = allEntries.findIndex(function(item){ return isSameLevelEntry(item, entry); });
          var key = currentEntry && isSameLevelEntry(entry, currentEntry);
          var currentLevelKey = true;
          if (key && key === currentLevelKey) return { key: 'current', label: 'مستواك الحالي' };
          if (currentIndex >= 0 && entryIndex >= 0 && entryIndex < currentIndex) return { key: 'completed', label: 'تم الوصول له' };
          if ((parseLevelNumber(totalSpent) || 0) >= (parseLevelNumber(entry && entry.requiredSpent || 0) || 0)) {
            if (entry && entry.manualUnlockOnly) return { key: 'manual', label: 'يتطلب تفعيلًا يدويًا' };
            return { key: 'eligible', label: 'مؤهل للترقية' };
          }
          return { key: 'locked', label: 'غير مفتوح بعد' };
        }

        function renderLevelsLegacy(){
          if (!state.refs) return;
          var profile = (state.profile && typeof state.profile === 'object') ? state.profile : {};
          var currentLevelKey = normalizeLevelKey(profile.level || '');
          var currentLevelId = normalizeLevelId(
            profile.levelId != null ? profile.levelId :
            (profile.level_id != null ? profile.level_id :
            (profile.levelNo != null ? profile.levelNo : profile.level_no))
          );
          var totalSpent = parseLevelNumber(profile.totalspent != null ? profile.totalspent : profile.totalSpent);
          if (!Number.isFinite(totalSpent)) totalSpent = 0;
          var siteState = state.siteState && typeof state.siteState === 'object' ? state.siteState : readResolvedSiteState();
          state.siteState = siteState || {};
          var allEntries = getCatalogLevelEntries(state.siteState || {});
          var currentEntry = allEntries.find(function(entry){
            return (
              (currentLevelId != null && normalizeLevelId(entry && entry.id) === currentLevelId) ||
              (currentLevelKey && normalizeLevelKey(entry && entry.key) === currentLevelKey)
            );
          }) || null;
          var visibleEntries = resolveVisibleLevelEntries(allEntries, currentEntry);
          var currentIndex = allEntries.findIndex(function(entry){
            return isSameLevelEntry(entry, currentEntry);
          });
          var nextEntry = allEntries.find(function(entry, index){
            if (!entry || entry.manualUnlockOnly === true) return false;
            if (currentIndex >= 0) return index > currentIndex;
            return (parseLevelNumber(entry.requiredSpent || 0) || 0) > totalSpent;
          }) || null;

          if (state.refs.currentLabel) state.refs.currentLabel.textContent = currentEntry ? currentEntry.label : (profile.level || '--');
          if (state.refs.currentBadge) state.refs.currentBadge.innerHTML = currentEntry ? buildBadgeMedia(currentEntry) : '<span>؟</span>';
          if (state.refs.spentValue) state.refs.spentValue.textContent = formatMoney(totalSpent);
          if (state.refs.nextValue) state.refs.nextValue.textContent = nextEntry ? (nextEntry.label + (nextEntry.requiredSpent > 0 ? ' - ' + formatMoney(nextEntry.requiredSpent) : '')) : 'لا يوجد مستوى تلقائي تالٍ';
          if (state.refs.autoValue) state.refs.autoValue.textContent = nextEntry ? (nextEntry.manualUnlockOnly ? 'يدوي فقط' : 'تلقائي عند الوصول') : 'لا توجد ترقية تلقائية تالية';
          if (state.refs.leadText) {
            state.refs.leadText.textContent = currentEntry
              ? ('شريحتك الحالية: ' + currentEntry.label + '. كلما زاد إنفاقك أو قام الأدمن بترقيتك ستظهر لك العضويات الأعلى هنا.')
              : 'يمكنك متابعة المستويات المتاحة وشروط فتح كل عضوية من هذه الصفحة.';
          }
          if (state.refs.currentBadge && !currentEntry) {
            state.refs.currentBadge.innerHTML = '<span>؟</span>';
          }
          if (state.refs.nextValue) {
            state.refs.nextValue.textContent = nextEntry
              ? (nextEntry.label + (nextEntry.requiredSpent > 0 ? ' - ' + formatMoney(nextEntry.requiredSpent) : ''))
              : 'لا يوجد مستوى تلقائي تالٍ';
          }
          if (state.refs.autoValue) {
            state.refs.autoValue.textContent = nextEntry
              ? (nextEntry.manualUnlockOnly ? 'يدوي فقط' : 'تلقائي عند الوصول')
              : 'لا توجد ترقية تلقائية تالية';
          }
          if (state.refs.leadText && currentEntry) {
            state.refs.leadText.textContent = 'شريحتك الحالية: ' + currentEntry.label + '. كلما زاد إنفاقك أو قام الأدمن بترقيتك ستظهر لك العضويات الأعلى هنا مع شروط فتحها.';
          }
          if (state.refs.warning) {
            var warningText = !allEntries.length
              ? 'تعذر العثور على إعدادات المستويات في الكتالوج.'
              : '';
            warningText = !allEntries.length ? 'تعذر العثور على إعدادات المستويات في siteState.' : '';
            state.refs.warning.textContent = warningText;
            state.refs.warning.className = 'levels-warning' + (warningText ? ' is-visible' : '');
          }
          if (state.refs.currentBadge) {
            state.refs.currentBadge.innerHTML = currentEntry ? buildBadgeMedia(currentEntry) : '<span>؟</span>';
          }
          if (state.refs.leadText) {
            var currentLevelLabel = currentEntry ? currentEntry.label : (profile.level || '--');
            state.refs.leadText.textContent = 'شريحتك الحالية : ' + currentLevelLabel + ' إذا كنت ترغب بترقية حسابك إلى شريحة أعلى والحصول على خصومات مميزة ما عليك إلا زيادة مبيعاتك';
          }

          if (!visibleEntries.length) {
            state.refs.list.innerHTML = '<div class="levels-empty">لا توجد مستويات متاحة للعرض الآن.</div>';
            return;
          }

          state.refs.list.innerHTML = visibleEntries.map(function(entry){
            var cardState = resolveCardState(entry, allEntries, currentEntry, totalSpent);
            var meta = [];
            meta.push('<span class="levels-chip">المطلوب: ' + escHtml(entry.requiredSpent > 0 ? formatMoney(entry.requiredSpent) : 'بدون حد أدنى') + '</span>');
            meta.push('<span class="levels-chip">' + escHtml(entry.manualUnlockOnly ? 'ترقية يدوية فقط' : 'ترقية تلقائية') + '</span>');
            var note = '';
            if (cardState.key === 'current') note = 'هذا هو مستواك الحالي ويظهر لك على الحساب مباشرة.';
            else if (cardState.key === 'completed') note = 'تم تجاوز هذا المستوى بالفعل ضمن رحلة الحساب الحالية.';
            else if (cardState.key === 'eligible') note = 'وصلت إلى الحد المطلوب، ويمكن للنظام فتح هذا المستوى تلقائيًا بحسب الإعدادات.';
            else if (cardState.key === 'manual') note = 'بلغت الحد المطلوب، لكن هذا المستوى لا يُفتح تلقائيًا ويحتاج تفعيلًا يدويًا من الإدارة.';
            else note = entry.requiredSpent > 0 ? ('يتطلب الوصول إلى إنفاق إجمالي قدره ' + formatMoney(entry.requiredSpent) + '.') : 'يمكن فتحه عند تعيينه من الإدارة.';
            return [
              '<article class="levels-card">',
              '  <div class="levels-card-media">' + buildBadgeMedia(entry) + '</div>',
              '  <div class="levels-card-copy">',
              '    <div class="levels-card-title"><h3>' + escHtml(entry.label) + '</h3><span class="levels-card-key">' + escHtml(entry.key) + '</span></div>',
              '    <p>' + escHtml(note) + '</p>',
              '    <div class="levels-card-meta">' + meta.join('') + '</div>',
              '  </div>',
              '  <div class="levels-card-state"><div class="levels-sidekey">' + escHtml(entry.key || entry.label || '') + '</div>' + buildLevelStatePill(cardState) + '</div>',
              '</article>'
            ].join('');
          }).join('');
        }

        function resolveCardStateByRank(entry, currentEntry, totalSpent, currentRank){
          if (currentEntry && isSameLevelEntry(entry, currentEntry)) {
            return { key: 'current', label: 'مستواك الحالي' };
          }
          var entryOrder = normalizeLevelOrder(entry && entry.order) || 0;
          var safeCurrentRank = normalizeLevelOrder(currentRank) || 0;
          if (safeCurrentRank > 0 && entryOrder > 0 && entryOrder < safeCurrentRank) {
            return { key: 'completed', label: 'تم تجاوزه' };
          }
          if ((parseLevelNumber(totalSpent) || 0) >= (parseLevelNumber(entry && entry.requiredSpent || 0) || 0)) {
            if (entry && entry.manualUnlockOnly) return { key: 'manual', label: 'بانتظار التفعيل' };
            return { key: 'eligible', label: 'مؤهل للترقية' };
          }
          return { key: 'locked', label: 'غير مفتوح بعد' };
        }

        function renderLevels(){
          if (!state.refs) return;
          var profile = (state.profile && typeof state.profile === 'object') ? state.profile : {};
          var totalSpent = parseLevelNumber(profile.totalspent != null ? profile.totalspent : profile.totalSpent);
          if (!Number.isFinite(totalSpent)) totalSpent = 0;
          var siteState = state.siteState && typeof state.siteState === 'object' ? state.siteState : readResolvedSiteState();
          state.siteState = siteState || {};
          var allEntries = getCatalogLevelEntries(state.siteState || {});
          var currentEntry = resolveCurrentLevelEntry(allEntries, profile);
          var visibleEntries = resolveVisibleLevelEntries(allEntries, currentEntry);
          var currentRank = normalizeLevelOrder(currentEntry && currentEntry.order) || readProfileLevelOrder(profile) || 0;
          var nextEntry = resolveNextLevelEntry(allEntries, currentRank);
          var progress = buildNextLevelProgress(currentEntry, nextEntry, totalSpent);

          if (state.refs.currentLabel) state.refs.currentLabel.textContent = currentEntry ? currentEntry.label : (profile.level || '--');
          if (state.refs.currentBadge) state.refs.currentBadge.innerHTML = currentEntry ? buildBadgeMedia(currentEntry) : '<span>?</span>';
          if (state.refs.spentValue) state.refs.spentValue.textContent = formatMoney(totalSpent);
          if (state.refs.nextValue) state.refs.nextValue.textContent = nextEntry ? nextEntry.label : 'لا يوجد مستوى تلقائي تالٍ';
          if (state.refs.autoValue) state.refs.autoValue.textContent = nextEntry ? (nextEntry.manualUnlockOnly ? 'يدوي فقط' : 'تلقائي عند الوصول') : 'لا توجد ترقية تلقائية تالية';
          if (state.refs.progressValue) state.refs.progressValue.textContent = nextEntry ? formatMoney(progress.remaining) : '0.000 $';
          if (state.refs.progressFill) {
            state.refs.progressFill.style.width = String(Math.max(0, Math.min(100, Math.round(progress.ratio * 1000) / 10))) + '%';
          }
          if (state.refs.progressText) state.refs.progressText.textContent = progress.message;
          if (state.refs.leadText) {
            state.refs.leadText.textContent = 'يجب زيادة مشترياتك لترقية مستوى الحساب و الحصول على خصومات مميزة';
          }
          if (state.refs.warning) {
            var warningText = !allEntries.length ? 'تعذر العثور على إعدادات المستويات في الموقع.' : '';
            state.refs.warning.textContent = warningText;
            state.refs.warning.className = 'levels-warning' + (warningText ? ' is-visible' : '');
          }

          if (!visibleEntries.length) {
            if (state.refs.progressValue) state.refs.progressValue.textContent = '--';
            if (state.refs.progressFill) state.refs.progressFill.style.width = '0%';
            if (state.refs.progressText) state.refs.progressText.textContent = 'تعذر تحميل بيانات المستويات حالياً.';
            state.refs.list.innerHTML = '<div class="levels-empty">لا توجد مستويات متاحة للعرض الآن.</div>';
            return;
          }

          state.refs.list.innerHTML = visibleEntries.map(function(entry){
            var cardState = resolveCardStateByRank(entry, currentEntry, totalSpent, currentRank);
            var isTarget = !!(nextEntry && isSameLevelEntry(entry, nextEntry));
            var progressMarkup = '';
            if (isTarget) {
              progressMarkup = [
                '<div class="levels-card-progress">',
                '  <div class="levels-card-progress-head">',
                '    <span class="levels-card-progress-boundary is-target">' + escHtml(formatMoney(progress.endRequired)) + '</span>',
                '    <strong class="levels-card-progress-percent">' + escHtml(progress.percentText) + '</strong>',
                '    <span class="levels-card-progress-boundary is-current">' + escHtml(formatMoney(progress.spentAmount)) + '</span>',
                '  </div>',
                '  <div class="levels-card-progress-track" aria-hidden="true"><span class="levels-card-progress-fill" style="width:' + escHtml(String(progress.percentage)) + '%;"></span></div>',
                '  <p class="levels-card-progress-caption">' + escHtml(progress.message) + '</p>',
                '</div>'
              ].join('');
            }
            return [
              '<article class="levels-card' + (isTarget ? ' is-target' : '') + '">',
              '  <div class="levels-card-media">' + buildBadgeMedia(entry) + '</div>',
              '  <div class="levels-card-copy">',
              '    <div class="levels-card-title"><h3>' + escHtml(entry.label) + '</h3><span class="levels-card-key">' + escHtml(entry.key) + '</span></div>',
              progressMarkup,
              '  </div>',
              '  <div class="levels-card-state"><div class="levels-sidekey">' + escHtml(entry.key || entry.label || '') + '</div>' + buildLevelStatePill(cardState) + '</div>',
              '</article>'
            ].join('');
          }).join('');
        }

        function ensureRoot(){
          ensureStyle();
          if (state.root) return state.root;
          var root = document.createElement('div');
          root.className = 'levels-page';
          root.innerHTML = [
            '<div class="levels-spacer" aria-hidden="true"></div>',
            '<div class="main-content levels-main">',
            '  <div class="container levels-shell">',
            '    <section class="levels-hero">',
            '      <div class="levels-current-head">',
            '        <div class="levels-hero-badge" id="levelsCurrentBadge"><span>؟</span></div>',
            '        <h2 id="levelsCurrentLabel">--</h2>',
            '      </div>',
            '      <div class="levels-hero-copy">',
            '        <div class="levels-eyebrow">المستويات والعضويات</div>',
            '        <p id="levelsLeadText">جاري تحميل بيانات المستويات...</p>',
            '      </div>',
            '    </section>',
            '    <section class="levels-summary">',
            '      <div class="levels-stat"><span>إجمالي الإنفاق</span><strong id="levelsSpentValue">--</strong></div>',
            '      <div class="levels-stat"><span>المستوى التالي</span><strong id="levelsNextValue">--</strong></div>',
            '      <div class="levels-stat"><span>طريقة الفتح</span><strong id="levelsAutoValue">--</strong></div>',
            '    </section>',
            '    <section id="levelsProgress" class="levels-progress">',
            '      <div class="levels-progress-head"><span>المتبقي للمستوى التالي</span><strong id="levelsProgressValue">--</strong></div>',
            '      <div class="levels-progress-track" aria-hidden="true"><span id="levelsProgressFill"></span></div>',
            '      <p id="levelsProgressText" class="levels-progress-text">--</p>',
            '    </section>',
            '    <div id="levelsWarning" class="levels-warning"></div>',
            '    <div id="levelsStatus" class="levels-status"></div>',
            '    <section id="levelsList" class="levels-list"><div class="levels-empty">جاري تجهيز القائمة...</div></section>',
          '  </div>',
          '</div>'
          ].join('');
          state.root = root;
          state.refs = {
            currentLabel: root.querySelector('#levelsCurrentLabel'),
            currentBadge: root.querySelector('#levelsCurrentBadge'),
            leadText: root.querySelector('#levelsLeadText'),
            spentValue: root.querySelector('#levelsSpentValue'),
            nextValue: root.querySelector('#levelsNextValue'),
            autoValue: root.querySelector('#levelsAutoValue'),
            progressSection: root.querySelector('#levelsProgress'),
            progressValue: root.querySelector('#levelsProgressValue'),
            progressFill: root.querySelector('#levelsProgressFill'),
            progressText: root.querySelector('#levelsProgressText'),
            warning: root.querySelector('#levelsWarning'),
            status: root.querySelector('#levelsStatus'),
            list: root.querySelector('#levelsList')
          };
          return root;
        }

        async function ensureFirebase(){
          try {
            if (typeof window.__ensureAuthReady === 'function') {
              await window.__ensureAuthReady();
            }
          } catch(_){}
          if (typeof firebase === 'undefined') return null;
          try {
            if (window.__ORIG_FIREBASE__){
              if (window.__ORIG_FIREBASE__.auth) firebase.auth = window.__ORIG_FIREBASE__.auth;
              if (window.__ORIG_FIREBASE__.firestore) firebase.firestore = window.__ORIG_FIREBASE__.firestore;
            }
          } catch(_){}
          try {
            if ((!firebase.apps || !firebase.apps.length) && window.__FIREBASE_CONFIG__){
              firebase.initializeApp(window.__FIREBASE_CONFIG__);
            }
          } catch(_){}
          try { state.auth = firebase.auth(); } catch(_) { state.auth = null; }
          state.db = null;
          return state.auth ? { auth: state.auth } : null;
        }

        function getCurrentAuthUser(){
          try {
            if (state.auth && state.auth.currentUser) return state.auth.currentUser;
          } catch(_){}
          try {
            if (typeof firebase !== 'undefined' && firebase && typeof firebase.auth === 'function') {
              var authInstance = firebase.auth();
              if (authInstance && authInstance.currentUser) return authInstance.currentUser;
            }
          } catch(_){}
          return null;
        }

        function getCurrentAuthUid(){
          var user = getCurrentAuthUser();
          if (user && user.uid) return String(user.uid || '').trim();
          return String(state.currentUid || '').trim();
        }

        function hasResolvedCurrentProfile(){
          var uid = getCurrentAuthUid();
          if (!uid) return false;
          if (String(state.clientLevelsResolvedUid || '').trim() === uid) return true;
          if (state.siteStateRefreshPromise) return false;
          return String(state.profileResolvedUid || '').trim() === uid;
        }

        function waitForInitialLevelsReady(){
          if (hasResolvedCurrentProfile()) return Promise.resolve();
          if (state.initialReadyPromise && !state.initialReadySettled) return state.initialReadyPromise;
          state.initialReadySettled = false;
          state.initialReadyPromise = new Promise(function(resolve){
            state.initialReadyResolve = resolve;
          });
          return state.initialReadyPromise;
        }

        function settleInitialLevelsReady(){
          if (state.initialReadySettled) return;
          state.initialReadySettled = true;
          var resolve = state.initialReadyResolve;
          state.initialReadyResolve = null;
          state.initialReadyPromise = null;
          if (typeof resolve === 'function') resolve();
        }

        function bindSiteState(){
          if (state.siteStateBound) return;
          state.siteStateBound = true;
          try {
            window.addEventListener('site-state-updated', function(event){
              var payload = event && event.detail;
              var incoming = null;
              if (payload && typeof payload === 'object') {
                incoming = (payload.siteState && typeof payload.siteState === 'object' && !payload.levels)
                  ? payload.siteState
                  : payload;
              } else {
                incoming = readResolvedSiteState() || {};
              }
              if (hasClientLevelsRequirementData(state.siteState) && !hasClientLevelsRequirementData(incoming)) {
                state.siteState = Object.assign({}, incoming || {}, { levels: state.siteState.levels });
              } else {
                state.siteState = incoming || {};
              }
              renderLevels();
            });
          } catch(_){}
        }

        async function refreshCatalog(force){
          state.siteState = readResolvedSiteState() || {};
          var hasUser = !!getCurrentAuthUid();
          var levelsLoaderStarted = false;
          try {
            if (hasUser) {
              levelsLoaderStarted = true;
              beginLevelsPageLoader();
              setStatus('جاري تحميل بيانات المستويات من الخادم...', 'info');
              await ensureLevelsSiteStateFromNetwork(true);
            } else if (force || !hasUsableLevelsSiteState(state.siteState)) {
              setStatus('جاري تحميل بيانات المستويات من siteState...', 'info');
              await ensureLevelsSiteStateFromNetwork(force === true);
              state.siteState = readResolvedSiteState() || state.siteState || {};
            }
            if (!hasUsableLevelsSiteState(state.siteState)) {
              setStatus('تعذر العثور على إعدادات المستويات في siteState.', 'err');
            } else {
              setStatus('', '');
            }
            renderLevels();
            if (hasUser) settleInitialLevelsReady();
          } finally {
            if (levelsLoaderStarted) endLevelsPageLoader();
          }
        }

        async function attachAuth(){
          if (state.authAttachPromise) return state.authAttachPromise;
          state.authAttachPromise = (async function(){
          var services = await ensureFirebase();
          if (!services || !services.auth) {
            state.currentUid = null;
            state.profile = null;
            state.profileResolvedUid = '';
            state.clientLevelsResolvedUid = '';
            renderLevels();
            settleInitialLevelsReady();
            setStatus('تعذر الوصول إلى بيانات الحساب.', 'err');
            return;
          }
          if (typeof state.unsubProfile === 'function') {
            try { state.unsubProfile(); } catch(_){}
            state.unsubProfile = null;
          }
          var user = getCurrentAuthUser();
          if (!user) {
            state.currentUid = null;
            state.profile = null;
            state.profileResolvedUid = '';
            state.clientLevelsResolvedUid = '';
            renderLevels();
            settleInitialLevelsReady();
            try {
              if (typeof window.__redirectToLoginImmediately === 'function') window.__redirectToLoginImmediately();
              else window.location.replace('#/login');
            } catch(_){}
            return;
          }
          state.currentUid = user.uid;
          state.profileResolvedUid = '';
          state.clientLevelsResolvedUid = '';
          setStatus('جاري تحميل عضويات الحساب...', 'info');
          Promise.resolve(refreshCatalog(false)).catch(function(){
            return null;
          }).finally(function(){
            if (state.currentUid === user.uid) settleInitialLevelsReady();
          });
          })();
          try {
            await state.authAttachPromise;
          } finally {
            state.authAttachPromise = null;
          }
        }

        function build(){
          var root = ensureRoot();
          bindSiteState();
          refreshCatalog(false);
          attachAuth();
          var frag = document.createDocumentFragment();
          frag.appendChild(root);
          return frag;
        }

        async function onShow(){
          ensureRoot();
          bindSiteState();
          refreshCatalog(false);
          var readyPromise = waitForInitialLevelsReady();
          await attachAuth();
          if (!getCurrentAuthUid() || hasResolvedCurrentProfile()) {
            settleInitialLevelsReady();
            return;
          }
          await readyPromise;
        }

        function prewarm(){
          try { queueI18nPrewarm(state.root || ensureRoot(), { maxItems: 120 }); } catch(_){}
        }

        return {
          build: build,
          onShow: onShow,
          prewarm: prewarm
        };
      })();

      var telegramLinkRoute = (function(){
        var TELEGRAM_STATUS_AUTH_CACHE_TTL_MS = 4000;
        var AUTH_BASE_DEFAULT = (window.__getSiteWorkerBaseDefault ? window.__getSiteWorkerBaseDefault({ trailingSlash: true }) : (String(window.location.origin || '').replace(/\/+$/, '') + "/"));
        var state = {
          root: null,
          refs: null,
          auth: null,
          unsubAuth: null,
          authRetry: 0,
          bound: false,
          currentUid: "",
          botLink: "",
          busy: false,
          statusLoading: true,
          statusLoadCount: 0,
          confirmedTelegramId: "",
          linkedTelegramId: "",
          pendingTelegramId: "",
          verifyRequired: false,
          codeModalMode: "",
          authRequests: Object.create(null),
          authResponses: Object.create(null)
        };

        function ensureRoot(){
          if (state.root) return state.root;
          var root = document.createElement('div');
          root.className = 'telegram-link-page';
          root.innerHTML = [
            '<div class="telegram-link-spacer" aria-hidden="true"></div>',
            '<div class="main-content">',
            '  <div class="container">',
            '    <h2>ربط تيليغرام</h2>',
            '    <div class="sub">افتح البوت واضغط <strong>/start</strong>، ثم أدخل المعرف الرقمي واضغط ربط.</div>',
            '    <div class="telegram-link-card">',
            '      <div class="telegram-link-head">',
            '        <div class="label"><i class="fa-brands fa-telegram"></i> معرف تيليغرام المستلم</div>',
            '        <div id="telegramLinkStatus" class="telegram-link-status" aria-live="polite">جاري التحقق...</div>',
            '      </div>',
            '      <a id="telegramOpenBotBtn" class="telegram-link-btn secondary is-disabled" href="#" target="_blank" rel="noopener noreferrer" aria-disabled="true"><i class="fa-brands fa-telegram"></i> فتح البوت</a>',
            '      <input id="telegramLinkUserIdInput" class="telegram-link-input" type="text" inputmode="numeric" autocomplete="off" placeholder="أدخل معرف تيليغرام الرقمي الذي ستصل عليه الرسائل مثل 123456789">',
            '      <div class="telegram-link-actions">',
            '        <button id="telegramLinkSaveBtn" class="telegram-link-btn" type="button"><i class="fa-solid fa-link"></i> ربط</button>',
            '        <button id="telegramLinkUnlinkBtn" class="telegram-link-btn secondary" type="button"><i class="fa-solid fa-link-slash"></i> فك الربط</button>',
            '      </div>',
            '      <div id="telegramLinkMsg" class="telegram-link-message"></div>',
            '    </div>',
            '    <div id="telegramLinkCodeModal" class="modal hidden" role="dialog" aria-modal="true" aria-labelledby="telegramLinkCodeTitle">',
            '      <div class="modal-content security-code-modal">',
            '        <button class="security-close" id="telegramLinkCodeClose" type="button" aria-label="إغلاق">&times;</button>',
            '        <h3 id="telegramLinkCodeTitle" class="security-code-title">أدخل رمز الربط</h3>',
            '        <p id="telegramLinkCodeSubtitle" class="security-code-subtitle">تم إرسال الرمز إلى تيليغرام.</p>',
            '        <input id="telegramLinkCodeInput" class="security-code-input" type="tel" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="123456">',
            '        <p id="telegramLinkCodeError" class="security-code-error"></p>',
            '        <div class="security-code-actions">',
            '          <button id="telegramLinkCodeSubmit" type="button" class="security-btn">تأكيد</button>',
            '          <button id="telegramLinkCodeCancel" type="button" class="security-btn ghost neutral">إلغاء</button>',
            '        </div>',
            '      </div>',
            '    </div>',
            '  </div>',
            '</div>'
          ].join('');
          try { queueI18nPrewarm(root, { maxItems: 180 }); } catch(_){}
          state.root = root;
          state.refs = {
            telegramLinkStatus: root.querySelector('#telegramLinkStatus'),
            telegramOpenBotBtn: root.querySelector('#telegramOpenBotBtn'),
            telegramBotLinkNote: root.querySelector('#telegramBotLinkNote'),
            telegramLinkUserIdInput: root.querySelector('#telegramLinkUserIdInput'),
            telegramLinkSaveBtn: root.querySelector('#telegramLinkSaveBtn'),
            telegramLinkUnlinkBtn: root.querySelector('#telegramLinkUnlinkBtn'),
            telegramLinkCodeInput: root.querySelector('#telegramLinkCodeInput'),
            telegramLinkMsg: root.querySelector('#telegramLinkMsg'),
            telegramLinkCodeModal: root.querySelector('#telegramLinkCodeModal'),
            telegramLinkCodeClose: root.querySelector('#telegramLinkCodeClose'),
            telegramLinkCodeTitle: root.querySelector('#telegramLinkCodeTitle'),
            telegramLinkCodeSubtitle: root.querySelector('#telegramLinkCodeSubtitle'),
            telegramLinkCodeError: root.querySelector('#telegramLinkCodeError'),
            telegramLinkCodeSubmit: root.querySelector('#telegramLinkCodeSubmit'),
            telegramLinkCodeCancel: root.querySelector('#telegramLinkCodeCancel')
          };
          renderTelegramLink({});
          renderBotLink();
          bindActions();
          return root;
        }

        function ensureFirebase(){
          try {
            if (typeof window.__FIREBASE_ENV_OK__ === "boolean" && !window.__FIREBASE_ENV_OK__) {
              window.__SKIP_FIREBASE__ = true;
              return null;
            }
          } catch(_){}
          if (window.__SKIP_FIREBASE__) return null;
          if (typeof firebase === 'undefined') return null;
          try {
            if (window.__ORIG_FIREBASE__ && window.__ORIG_FIREBASE__.auth) {
              firebase.auth = window.__ORIG_FIREBASE__.auth;
            }
          } catch(_){}
          try {
            if ((!firebase.apps || !firebase.apps.length) && window.__FIREBASE_CONFIG__){
              firebase.initializeApp(window.__FIREBASE_CONFIG__);
            }
          } catch(_){}
          try {
            state.auth = firebase.auth();
          } catch(_){
            state.auth = null;
          }
          return state.auth ? { auth: state.auth } : null;
        }

        function buildAuthUrl(){
          var base = window.__getSiteWorkerBase ? window.__getSiteWorkerBase({ trailingSlash: true }) : AUTH_BASE_DEFAULT;
          try {
            var url = new URL(base);
            url.searchParams.set('action', 'auth');
            return url.toString();
          } catch(_) {
            return AUTH_BASE_DEFAULT + (AUTH_BASE_DEFAULT.indexOf('?') >= 0 ? '&' : '?') + 'action=auth';
          }
        }

        function buildTelegramLinkAuthRequestKey(action, payload){
          var normalizedAction = String(action || '').trim().toLowerCase();
          if (normalizedAction !== 'telegram_link_status') return '';
          var uid = String(payload && payload.uid || '').trim();
          if (!uid) return '';
          return normalizedAction + ':' + uid;
        }

        function readCachedTelegramLinkAuthResponse(key){
          if (!key) return null;
          var entry = state.authResponses[key];
          if (!entry) return null;
          if ((Number(entry.expiresAt) || 0) <= Date.now()) {
            delete state.authResponses[key];
            return null;
          }
          return entry.data;
        }

        function writeCachedTelegramLinkAuthResponse(key, data){
          if (!key) return data;
          state.authResponses[key] = {
            data: data,
            expiresAt: Date.now() + TELEGRAM_STATUS_AUTH_CACHE_TTL_MS
          };
          return data;
        }

        function clearCachedTelegramLinkAuthResponse(action, payload){
          var normalizedAction = String(action || '').trim().toLowerCase();
          if (!normalizedAction || normalizedAction === 'telegram_link_status') return;
          if (normalizedAction.indexOf('telegram_link_') !== 0) return;
          try { if (window.__clearSharedAuthStatusCache) window.__clearSharedAuthStatusCache(normalizedAction, payload || {}); } catch(_){}
          var statusKey = buildTelegramLinkAuthRequestKey('telegram_link_status', payload || {});
          if (!statusKey) return;
          delete state.authResponses[statusKey];
          delete state.authRequests[statusKey];
        }

        function callSettingsAuth(action, extra){
          var services = ensureFirebase();
          var auth = services ? services.auth : state.auth;
          var user = auth ? auth.currentUser : null;
          if (!user || typeof user.getIdToken !== 'function'){
            return Promise.reject(new Error('يرجى تسجيل الدخول أولاً'));
          }
          var requestPayload = Object.assign({}, extra || {}, {
            action: action,
            uid: user.uid
          });
          clearCachedTelegramLinkAuthResponse(action, requestPayload);
          var requestKey = buildTelegramLinkAuthRequestKey(action, requestPayload);
          if (requestKey && state.authRequests[requestKey]) return state.authRequests[requestKey];
          var cachedResponse = readCachedTelegramLinkAuthResponse(requestKey);
          if (cachedResponse) return Promise.resolve(cachedResponse);
          var requestFactory = function(){
            return user.getIdToken(true).then(function(token){
              return fetch(buildAuthUrl(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(Object.assign({}, requestPayload, {
                  idToken: token
                }))
              });
            }).then(function(res){
              return res.json().catch(function(){ return {}; }).then(function(data){
                if (!res.ok || data.success === false){
                  var err = new Error(data.error || data.message || 'تعذر تنفيذ الطلب.');
                  err.code = String(data.code || '').trim();
                  err.details = data.details || null;
                  err.status = res.status || 0;
                  throw err;
                }
                return writeCachedTelegramLinkAuthResponse(requestKey, data);
              });
            });
          };
          var requestPromise = (window.__runSharedAuthStatusRequest || function(payload, ttlMs, factory){
            void payload;
            void ttlMs;
            return Promise.resolve().then(factory);
          })(requestPayload, TELEGRAM_STATUS_AUTH_CACHE_TTL_MS, requestFactory);
          requestPromise = requestPromise.finally(function(){
            if (requestKey && state.authRequests[requestKey] === requestPromise) {
              delete state.authRequests[requestKey];
            }
          });
          if (requestKey) state.authRequests[requestKey] = requestPromise;
          return requestPromise;
        }

        function isTelegramLinkMissingActionError(err){
          var code = String(err && err.code || '').trim().toLowerCase();
          if (code === 'missing_action') return true;
          var message = String(err && err.message || '').trim();
          return message.indexOf('حدد action=login أو register أو sync') >= 0;
        }

        function callTelegramLinkCompat(action, extra){
          return callSettingsAuth(action, extra).catch(function(err){
            if (!isTelegramLinkMissingActionError(err)) throw err;
            if (action !== 'telegram_link_request' && action !== 'telegram_link_verify') throw err;
            var fallbackPayload = Object.assign({}, extra || {}, {
              action: 'telegram_link_set'
            });
            return callSettingsAuth('telegram_link_set', fallbackPayload);
          });
        }

        function emitToast(text, ok){
          try {
            if (typeof window.showToast === 'function'){
              if ((window.showToast.length || 0) <= 2){
                window.showToast(text, ok !== false);
              } else {
                window.showToast(text, ok === false ? 'error' : 'success', 2200);
              }
              return;
            }
          } catch(_){}
        }

        function updateMessage(text, ok){
          if (!state.refs || !state.refs.telegramLinkMsg) return;
          state.refs.telegramLinkMsg.textContent = text || '';
          state.refs.telegramLinkMsg.style.color = ok === false ? 'var(--danger)' : 'var(--success)';
        }

        function normalizeTelegramId(value){
          return String(value == null ? '' : value).replace(/[^\d]/g, '').trim();
        }

        function normalizeLinkCode(value){
          return String(value == null ? '' : value).replace(/[^\d]/g, '').slice(0, 6);
        }

        function normalizeTelegramBotHref(value){
          var raw = String(value == null ? '' : value).trim();
          if (!raw) return '';
          if (/^tg:\/\/resolve\?/i.test(raw)) return raw;
          if (/^https?:\/\/t\.me\//i.test(raw)) return raw;
          if (/^@[\w.]{3,}$/i.test(raw)) return 'https://t.me/' + raw.slice(1);
          if (/^[\w.]{3,}$/i.test(raw) && !raw.includes('/')) return 'https://t.me/' + raw;
          return '';
        }

        function readJsonStorage(key){
          try {
            var raw = localStorage.getItem(key);
            if (!raw) return null;
            return JSON.parse(raw);
          } catch(_){
            return null;
          }
        }

        function readTelegramLinkFromContacts(raw){
          if (!Array.isArray(raw)) return '';
          for (var i = 0; i < raw.length; i += 1){
            var item = raw[i];
            if (!item || typeof item !== 'object') continue;
            var key = String(item.key || item.id || item.className || item.label || item.name || '').trim().toLowerCase();
            if (key && key.indexOf('telegram') === -1) continue;
            var href = normalizeTelegramBotHref(item.href || item.url || item.link || item.value || '');
            if (href) return href;
          }
          return '';
        }

        function extractTelegramLink(raw){
          if (!raw) return '';
          if (typeof raw === 'string') return normalizeTelegramBotHref(raw);
          if (Array.isArray(raw)) return readTelegramLinkFromContacts(raw);
          if (typeof raw !== 'object') return '';
          var direct = normalizeTelegramBotHref(
            raw.telegramBotLink ||
            raw.telegramLink ||
            raw.telegramUrl ||
            raw.telegramURL ||
            raw.telegram ||
            ''
          );
          if (direct) return direct;
          var maps = [raw.links, raw.contactLinks, raw.supportLinks, raw.linkMap, raw.map];
          for (var i = 0; i < maps.length; i += 1){
            var candidate = maps[i];
            if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) continue;
            direct = normalizeTelegramBotHref(candidate.telegram || candidate.telegramBotLink || candidate.telegramLink || '');
            if (direct) return direct;
          }
          return readTelegramLinkFromContacts(raw.contacts || raw.contactMethods || raw.items || raw.list);
        }

        function resolveTelegramBotLink(){
          var direct = normalizeTelegramBotHref(window.__TELEGRAM_LINK_BOT_URL__);
          if (direct) return direct;
          try {
            direct = normalizeTelegramBotHref(window.__SUPPORT_LINKS_MAP__ && window.__SUPPORT_LINKS_MAP__.telegram);
            if (direct) return direct;
          } catch(_){}
          try {
            direct = readTelegramLinkFromContacts(window.__SUPPORT_CONTACTS_RENDERED__);
            if (direct) return direct;
          } catch(_){}
          var storageKeys = ['site:support:v1', 'site:support:contacts:v1', 'site:support:links:v1'];
          for (var i = 0; i < storageKeys.length; i += 1){
            direct = extractTelegramLink(readJsonStorage(storageKeys[i]));
            if (direct) return direct;
          }
          return '';
        }

        function buildTelegramAppHref(href){
          var safeHref = String(href || '').trim();
          if (!/^https?:\/\/t\.me\//i.test(safeHref)) return safeHref;
          try {
            var parsed = new URL(safeHref);
            var segments = parsed.pathname.split('/').filter(Boolean);
            var handle = segments[0] || '';
            if (!handle || handle.charAt(0) === '+') return safeHref;
            var appHref = 'tg://resolve?domain=' + encodeURIComponent(handle);
            var start = parsed.searchParams.get('start');
            if (start) appHref += '&start=' + encodeURIComponent(start);
            return appHref;
          } catch(_){
            return safeHref;
          }
        }

        function renderBotLink(){
          if (!state.refs || !state.refs.telegramOpenBotBtn) return;
          var href = resolveTelegramBotLink();
          state.botLink = href;
          if (!href){
            state.refs.telegramOpenBotBtn.setAttribute('href', '#');
            state.refs.telegramOpenBotBtn.setAttribute('aria-disabled', 'true');
            state.refs.telegramOpenBotBtn.classList.add('is-disabled');
            if (state.refs.telegramBotLinkNote){
            }
            return;
          }
          state.refs.telegramOpenBotBtn.setAttribute('href', href);
          state.refs.telegramOpenBotBtn.setAttribute('aria-disabled', 'false');
          state.refs.telegramOpenBotBtn.classList.remove('is-disabled');
          if (state.refs.telegramBotLinkNote){
            state.refs.telegramBotLinkNote.textContent = 'افتح البوت، ثم انسخ منه المعرّف الرقمي الذي ستصل عليه الرسائل وضعه هنا.';
          }
        }

        function renderTelegramLink(data){
          if (!state.refs) return;
          var telegramId = normalizeTelegramId((data && (data.telegramUserId || data.telegramChatId || data.telegramId)) || '');
          var linked = telegramId !== '' && data && data.linked === true;
          state.confirmedTelegramId = linked ? telegramId : '';
          state.linkedTelegramId = state.confirmedTelegramId;
          if (linked && state.pendingTelegramId && telegramId === normalizeTelegramId(state.pendingTelegramId)) {
            state.pendingTelegramId = '';
            state.verifyRequired = false;
            state.codeModalMode = '';
          }
          syncTelegramLinkView();
        }

        function getCurrentAuthUid(){
          var auth = state.auth;
          var user = auth ? auth.currentUser : null;
          return String((user && user.uid) || state.currentUid || '').trim();
        }

        function setGlobalTelegramPageLoader(on){
          var active = !!on;
          try {
            if (active && typeof showPreloader === 'function'){
              showPreloader();
              return;
            }
            if (!active && typeof hidePreloader === 'function'){
              hidePreloader();
              return;
            }
          } catch(_){}
          try {
            if (active && typeof window.__holdPageLoader === 'function'){
              window.__holdPageLoader();
              return;
            }
            if (!active && typeof window.__releasePageLoader === 'function'){
              window.__releasePageLoader();
            }
          } catch(_){}
        }

        function beginTelegramStatusLoading(){
          state.statusLoadCount = Math.max(0, Number(state.statusLoadCount) || 0) + 1;
          state.statusLoading = true;
          if (state.statusLoadCount === 1) setGlobalTelegramPageLoader(true);
          syncTelegramLinkView();
        }

        function endTelegramStatusLoading(){
          state.statusLoadCount = Math.max(0, (Number(state.statusLoadCount) || 0) - 1);
          state.statusLoading = state.statusLoadCount > 0;
          if (!state.statusLoading) setGlobalTelegramPageLoader(false);
          syncTelegramLinkView();
        }

        function clearTelegramStatusLoading(){
          var count = Math.max(0, Number(state.statusLoadCount) || 0);
          state.statusLoadCount = 0;
          state.statusLoading = false;
          if (count > 0) {
            for (var i = 0; i < count; i += 1) setGlobalTelegramPageLoader(false);
          } else {
            setGlobalTelegramPageLoader(false);
          }
          syncTelegramLinkView();
        }

        function setTelegramStatus(kind, text){
          if (!state.refs || !state.refs.telegramLinkStatus) return;
          var el = state.refs.telegramLinkStatus;
          var mode = String(kind || '').trim().toLowerCase();
          el.textContent = '';
          el.classList.remove('is-linked', 'is-loading', 'is-pending');
          if (mode === 'linked') el.classList.add('is-linked');
          else if (mode === 'loading') el.classList.add('is-loading');
          else if (mode === 'pending') el.classList.add('is-pending');
          el.setAttribute('aria-busy', mode === 'loading' ? 'true' : 'false');
          var label = document.createElement('span');
          label.textContent = String(text || '').trim() || 'غير مربوط';
          el.appendChild(label);
        }

        function syncTelegramLinkView(){
          if (!state.refs) return;
          var confirmedId = normalizeTelegramId(state.confirmedTelegramId || state.linkedTelegramId || '');
          var pendingId = normalizeTelegramId(state.pendingTelegramId || '');
          var showPending = !!state.verifyRequired && !!pendingId;
          var linked = !!confirmedId;
          state.confirmedTelegramId = confirmedId;
          state.linkedTelegramId = confirmedId;
          if (state.refs.telegramLinkUserIdInput) {
            if (showPending) state.refs.telegramLinkUserIdInput.value = pendingId;
            else if (confirmedId) state.refs.telegramLinkUserIdInput.value = confirmedId;
            state.refs.telegramLinkUserIdInput.readOnly = !!state.statusLoading || showPending || linked;
          }
          if (state.statusLoading) setTelegramStatus('loading', 'جاري التحقق...');
          else if (showPending) setTelegramStatus('pending', state.codeModalMode === 'unlink' ? 'بانتظار تأكيد فك الربط' : 'بانتظار تأكيد الربط');
          else if (confirmedId) setTelegramStatus('linked', 'مرتبط');
          else setTelegramStatus('default', 'غير مربوط');
          updateLinkControls();
        }

        function resetLinkVerification(){
          state.pendingTelegramId = '';
          state.verifyRequired = false;
          state.codeModalMode = '';
          if (state.refs && state.refs.telegramLinkCodeInput) state.refs.telegramLinkCodeInput.value = '';
          if (state.refs && state.refs.telegramLinkCodeError) state.refs.telegramLinkCodeError.textContent = '';
          syncTelegramLinkView();
        }

        function startTelegramVerification(mode, telegramId){
          state.codeModalMode = mode === 'unlink' ? 'unlink' : 'link';
          state.pendingTelegramId = normalizeTelegramId(telegramId);
          state.verifyRequired = !!state.pendingTelegramId;
          if (state.refs && state.refs.telegramLinkCodeInput) state.refs.telegramLinkCodeInput.value = '';
          if (state.refs && state.refs.telegramLinkCodeError) state.refs.telegramLinkCodeError.textContent = '';
          syncTelegramLinkView();
        }

        function closeTelegramCodeModal(options){
          if (!state.refs || !state.refs.telegramLinkCodeModal) return;
          var keepPending = !!(options && options.keepPending);
          state.refs.telegramLinkCodeModal.classList.add('hidden');
          state.refs.telegramLinkCodeModal.setAttribute('aria-hidden', 'true');
          if (state.refs.telegramLinkCodeInput) state.refs.telegramLinkCodeInput.value = '';
          if (state.refs.telegramLinkCodeError) state.refs.telegramLinkCodeError.textContent = '';
          try {
            document.documentElement.classList.remove('transfer-modal-open');
            document.body.classList.remove('transfer-modal-open');
          } catch(_){}
          if (!keepPending) {
            resetLinkVerification();
          } else {
            updateLinkControls();
          }
        }

        function openTelegramCodeModal(options){
          if (!state.refs || !state.refs.telegramLinkCodeModal) return;
          var mode = (options && options.mode) === 'unlink' ? 'unlink' : 'link';
          var target = String(options && options.target || '').trim();
          state.codeModalMode = mode;
          if (state.refs.telegramLinkCodeTitle) {
            state.refs.telegramLinkCodeTitle.textContent = mode === 'unlink' ? 'أدخل رمز فك الربط' : 'أدخل رمز الربط';
          }
          if (state.refs.telegramLinkCodeSubtitle) {
            var baseText = mode === 'unlink'
              ? 'تم إرسال رمز فك الربط إلى تيليغرام.'
              : 'تم إرسال رمز الربط إلى تيليغرام.';
            state.refs.telegramLinkCodeSubtitle.textContent = target ? (baseText + ' ' + target) : baseText;
          }
          if (state.refs.telegramLinkCodeSubmit) {
            state.refs.telegramLinkCodeSubmit.textContent = mode === 'unlink' ? 'تأكيد فك الربط' : 'تأكيد الربط';
          }
          if (state.refs.telegramLinkCodeInput) state.refs.telegramLinkCodeInput.value = '';
          if (state.refs.telegramLinkCodeError) state.refs.telegramLinkCodeError.textContent = '';
          state.refs.telegramLinkCodeModal.classList.remove('hidden');
          state.refs.telegramLinkCodeModal.setAttribute('aria-hidden', 'false');
          try {
            document.documentElement.classList.add('transfer-modal-open');
            document.body.classList.add('transfer-modal-open');
          } catch(_){}
          updateLinkControls();
          setTimeout(function(){
            try { if (state.refs && state.refs.telegramLinkCodeInput) state.refs.telegramLinkCodeInput.focus(); } catch(_){}
          }, 30);
        }

        function submitTelegramCodeModal(){
          if (!state.refs || !state.refs.telegramLinkCodeInput) return;
          var code = normalizeLinkCode(state.refs.telegramLinkCodeInput.value || '');
          state.refs.telegramLinkCodeInput.value = code;
          if (!/^\d{6}$/.test(code)){
            if (state.refs.telegramLinkCodeError) state.refs.telegramLinkCodeError.textContent = 'أدخل رمزًا صحيحًا من 6 أرقام.';
            return;
          }
          var uid = (typeof getCurrentAuthUid === "function") ? getCurrentAuthUid() : "";
          var targetId = state.codeModalMode === 'unlink'
            ? normalizeTelegramId(state.confirmedTelegramId || state.linkedTelegramId || '')
            : normalizeTelegramId(state.pendingTelegramId || (state.refs.telegramLinkUserIdInput && state.refs.telegramLinkUserIdInput.value) || '');
          var attemptScope = 'telegram-link-attempt:' + uid + ':' + String(state.codeModalMode || 'link') + ':' + targetId;
          var blockedFor = window.__siteOtpLimits
            ? window.__siteOtpLimits.getAttemptRemaining(attemptScope, 3)
            : 0;
          if (blockedFor > 0) {
            if (state.refs.telegramLinkCodeError) {
              state.refs.telegramLinkCodeError.textContent = 'انتهت محاولات إدخال الرمز. حاول بعد ' + window.__siteOtpLimits.format(blockedFor) + '.';
            }
            return;
          }
          if (window.__siteOtpLimits) window.__siteOtpLimits.markAttempt(attemptScope);
          if (state.codeModalMode === 'unlink') {
            confirmTelegramUnlink(code);
            return;
          }
          confirmTelegramLink(code);
        }

        function toggleHidden(el, hidden){
          if (!el) return;
          if (hidden) el.setAttribute('hidden', 'hidden');
          else el.removeAttribute('hidden');
        }

        function updateLinkControls(){
          if (!state.refs) return;
          var hasAuth = !!getCurrentAuthUid();
          var telegramId = normalizeTelegramId(state.refs.telegramLinkUserIdInput && state.refs.telegramLinkUserIdInput.value);
          var code = normalizeLinkCode(state.refs.telegramLinkCodeInput && state.refs.telegramLinkCodeInput.value);
          var loadingState = !!state.statusLoading;
          var showPending = !!state.verifyRequired && !!normalizeTelegramId(state.pendingTelegramId || '');
          var linked = !!normalizeTelegramId(state.confirmedTelegramId || '');
          var canRequest = !!telegramId && !state.busy && hasAuth && !loadingState && !linked && !showPending;
          if (state.refs.telegramLinkSaveBtn) {
            state.refs.telegramLinkSaveBtn.disabled = !canRequest;
            toggleHidden(state.refs.telegramLinkSaveBtn, loadingState || linked || showPending);
          }
          if (state.refs.telegramLinkUserIdInput) state.refs.telegramLinkUserIdInput.disabled = !!state.busy || loadingState || linked || showPending;
          if (state.refs.telegramLinkCodeInput) state.refs.telegramLinkCodeInput.disabled = !!state.busy || loadingState;
          if (state.refs.telegramLinkCodeSubmit) state.refs.telegramLinkCodeSubmit.disabled = !!state.busy || loadingState || !state.verifyRequired || !/^\d{6}$/.test(code);
          if (state.refs.telegramLinkCodeCancel) state.refs.telegramLinkCodeCancel.disabled = !!state.busy;
          if (state.refs.telegramLinkUnlinkBtn) {
            state.refs.telegramLinkUnlinkBtn.disabled = !!state.busy || loadingState || !hasAuth || !linked || showPending;
            toggleHidden(state.refs.telegramLinkUnlinkBtn, loadingState || !linked);
          }
        }

        function refreshTelegramLinkState(silent){
          beginTelegramStatusLoading();
          return callSettingsAuth('telegram_link_status').then(function(data){
            renderTelegramLink(data || {});
            return data || {};
          }).catch(function(err){
            renderTelegramLink({});
            if (!silent){
              var msg = err && err.message ? err.message : 'تعذر تحميل حالة ربط تيليغرام.';
              updateMessage(msg, false);
              emitToast(msg, false);
            }
            return null;
          }).finally(function(){
            endTelegramStatusLoading();
          });
        }

        function setBusy(busy){
          state.busy = !!busy;
          if (!state.refs) return;
          updateLinkControls();
        }

        function saveTelegramId(){
          ensureFirebase();
          var uid = getCurrentAuthUid();
          if (!uid){
            updateMessage('يرجى تسجيل الدخول أولاً.', false);
            emitToast('يرجى تسجيل الدخول أولاً', false);
            return;
          }
          var telegramId = normalizeTelegramId(state.refs && state.refs.telegramLinkUserIdInput ? state.refs.telegramLinkUserIdInput.value : '');
          if (!/^\d{5,20}$/.test(telegramId)){
            emitToast('أدخل معرف تيليغرام رقمي صحيح', false);
            updateMessage('أدخل معرف تيليغرام رقمي صحيح.', false);
            try { state.refs.telegramLinkUserIdInput.focus(); } catch(_){}
            return;
          }
          var sendScope = 'telegram-link-send:' + uid + ':link:' + telegramId;
          var blockedFor = window.__siteOtpLimits ? window.__siteOtpLimits.getSendRemaining(sendScope) : 0;
          if (blockedFor > 0) {
            var waitText = window.__siteOtpLimits ? window.__siteOtpLimits.format(blockedFor) : (blockedFor + ' ثانية');
            updateMessage('يمكنك طلب رمز جديد بعد ' + waitText + '.', false);
            emitToast('انتظر قبل طلب رمز جديد', false);
            return;
          }
          setBusy(true);
          callTelegramLinkCompat('telegram_link_request', { telegramUserId: telegramId }).then(function(data){
            if (window.__siteOtpLimits) window.__siteOtpLimits.markSent(sendScope);
            startTelegramVerification('link', telegramId);
            openTelegramCodeModal({ mode: 'link', target: data && data.to });
            updateMessage((data && data.to) ? ('تم إرسال رمز الربط إلى ' + data.to + '.') : 'تم إرسال رمز الربط إلى تيليغرام.');
            emitToast('تم إرسال رمز الربط', true);
          }).catch(function(err){
            var msg = err && err.message ? err.message : 'تعذر إرسال رمز ربط تيليغرام.';
            updateMessage(msg, false);
            emitToast(msg, false);
          }).finally(function(){
            setBusy(false);
          });
        }

        function confirmTelegramLink(code){
          ensureFirebase();
          var uid = getCurrentAuthUid();
          if (!uid){
            updateMessage('يرجى تسجيل الدخول أولاً.', false);
            emitToast('يرجى تسجيل الدخول أولاً', false);
            return;
          }
          var telegramId = normalizeTelegramId(state.pendingTelegramId || (state.refs && state.refs.telegramLinkUserIdInput ? state.refs.telegramLinkUserIdInput.value : ''));
          if (!/^\d{5,20}$/.test(telegramId)){
            updateMessage('أدخل معرف تيليغرام رقمي صحيح.', false);
            emitToast('أدخل معرف تيليغرام صحيح', false);
            try { state.refs.telegramLinkUserIdInput.focus(); } catch(_){}
            return;
          }
          if (state.pendingTelegramId && telegramId !== state.pendingTelegramId){
            updateMessage('غيّرت المعرّف بعد إرسال الرمز. اطلب رمز ربط جديدًا.', false);
            emitToast('اطلب رمزًا جديدًا لهذا المعرّف', false);
            return;
          }
          if (!/^\d{6}$/.test(code)){
            if (state.refs && state.refs.telegramLinkCodeError) state.refs.telegramLinkCodeError.textContent = 'أدخل رمز الربط المكوّن من 6 أرقام.';
            return;
          }
          setBusy(true);
          callTelegramLinkCompat('telegram_link_verify', {
            telegramUserId: telegramId,
            telegramCode: code
          }).then(function(data){
            closeTelegramCodeModal({ keepPending: false });
            renderTelegramLink(data || { telegramUserId: telegramId, linked: true });
            updateMessage('تم ربط تيليغرام بنجاح بعد التحقق من الرمز.', true);
            emitToast('تم ربط تيليغرام', true);
          }).catch(function(err){
            var msg = err && err.message ? err.message : 'تعذر تأكيد ربط تيليغرام.';
            if (state.refs && state.refs.telegramLinkCodeError) state.refs.telegramLinkCodeError.textContent = msg;
            updateMessage(msg, false);
            emitToast(msg, false);
          }).finally(function(){
            setBusy(false);
          });
        }

        function unlinkTelegramId(){
          ensureFirebase();
          var uid = getCurrentAuthUid();
          if (!uid){
            updateMessage('يرجى تسجيل الدخول أولاً.', false);
            emitToast('يرجى تسجيل الدخول أولاً', false);
            return;
          }
          if (!state.confirmedTelegramId){
            renderTelegramLink({});
            resetLinkVerification();
            if (state.refs && state.refs.telegramLinkUserIdInput) state.refs.telegramLinkUserIdInput.value = '';
            updateMessage('', true);
            updateLinkControls();
            return;
          }
          var sendScope = 'telegram-link-send:' + uid + ':unlink:' + normalizeTelegramId(state.confirmedTelegramId || '');
          var blockedFor = window.__siteOtpLimits ? window.__siteOtpLimits.getSendRemaining(sendScope) : 0;
          if (blockedFor > 0) {
            var waitText = window.__siteOtpLimits ? window.__siteOtpLimits.format(blockedFor) : (blockedFor + ' ثانية');
            updateMessage('يمكنك طلب رمز جديد بعد ' + waitText + '.', false);
            emitToast('انتظر قبل طلب رمز جديد', false);
            return;
          }
          setBusy(true);
          callSettingsAuth('telegram_link_remove').then(function(data){
            if (window.__siteOtpLimits) window.__siteOtpLimits.markSent(sendScope);
            startTelegramVerification('unlink', state.confirmedTelegramId);
            openTelegramCodeModal({ mode: 'unlink', target: data && data.to });
            updateMessage((data && data.to) ? ('تم إرسال رمز فك الربط إلى ' + data.to + '.') : 'تم إرسال رمز فك الربط إلى تيليغرام.');
            emitToast('تم إرسال رمز فك الربط', true);
          }).catch(function(err){
            var msg = err && err.message ? err.message : 'تعذر فك ربط تيليغرام.';
            updateMessage(msg, false);
            emitToast(msg, false);
          }).finally(function(){
            setBusy(false);
          });
        }

        function confirmTelegramUnlink(code){
          ensureFirebase();
          var uid = getCurrentAuthUid();
          if (!uid){
            updateMessage('يرجى تسجيل الدخول أولاً.', false);
            emitToast('يرجى تسجيل الدخول أولاً', false);
            return;
          }
          var telegramId = normalizeTelegramId(state.confirmedTelegramId || state.linkedTelegramId || '');
          if (!telegramId){
            closeTelegramCodeModal({ keepPending: false });
            renderTelegramLink({});
            updateMessage('لا يوجد حساب تيليغرام مربوط حاليًا.', false);
            return;
          }
          if (!/^\d{6}$/.test(code)){
            if (state.refs && state.refs.telegramLinkCodeError) state.refs.telegramLinkCodeError.textContent = 'أدخل رمز فك الربط المكوّن من 6 أرقام.';
            return;
          }
          setBusy(true);
          callSettingsAuth('telegram_link_remove', {
            telegramCode: code
          }).then(function(data){
            closeTelegramCodeModal({ keepPending: false });
            state.confirmedTelegramId = '';
            state.linkedTelegramId = '';
            renderTelegramLink(data || {});
            if (state.refs && state.refs.telegramLinkUserIdInput) state.refs.telegramLinkUserIdInput.value = '';
            updateMessage('تم فك ربط تيليغرام بعد التحقق من الرمز.', true);
            emitToast('تم فك الربط', true);
          }).catch(function(err){
            var msg = err && err.message ? err.message : 'تعذر تأكيد فك ربط تيليغرام.';
            if (state.refs && state.refs.telegramLinkCodeError) state.refs.telegramLinkCodeError.textContent = msg;
            updateMessage(msg, false);
            emitToast(msg, false);
          }).finally(function(){
            setBusy(false);
          });
        }

        function bindActions(){
          if (state.bound || !state.refs) return;
          state.refs.telegramOpenBotBtn.addEventListener('click', function(ev){
            var href = String(state.botLink || '').trim();
            if (!href){
              ev.preventDefault();
              updateMessage('رابط البوت غير متاح الآن.', false);
              emitToast('رابط البوت غير متاح الآن.', false);
            }
          });
          state.refs.telegramLinkSaveBtn.addEventListener('click', saveTelegramId);
          state.refs.telegramLinkUnlinkBtn.addEventListener('click', unlinkTelegramId);
          state.refs.telegramLinkUserIdInput.addEventListener('input', function(){
            var telegramId = normalizeTelegramId(state.refs.telegramLinkUserIdInput.value);
            state.refs.telegramLinkUserIdInput.value = telegramId;
            if (state.pendingTelegramId && telegramId !== state.pendingTelegramId) {
              closeTelegramCodeModal({ keepPending: false });
            }
            updateLinkControls();
          });
          if (state.refs.telegramLinkCodeInput) {
            state.refs.telegramLinkCodeInput.addEventListener('input', function(){
              this.value = normalizeLinkCode(this.value);
              updateLinkControls();
            });
            state.refs.telegramLinkCodeInput.addEventListener('keydown', function(e){
              if (e.key === 'Enter'){
                e.preventDefault();
                submitTelegramCodeModal();
              }
            });
          }
          state.refs.telegramLinkUserIdInput.addEventListener('keydown', function(e){
            if (e.key === 'Enter'){
              e.preventDefault();
              saveTelegramId();
            }
          });
          if (state.refs.telegramLinkCodeSubmit) state.refs.telegramLinkCodeSubmit.addEventListener('click', submitTelegramCodeModal);
          if (state.refs.telegramLinkCodeCancel) state.refs.telegramLinkCodeCancel.addEventListener('click', function(){
            closeTelegramCodeModal({ keepPending: false });
          });
          if (state.refs.telegramLinkCodeClose) state.refs.telegramLinkCodeClose.addEventListener('click', function(){
            closeTelegramCodeModal({ keepPending: false });
          });
          if (state.refs.telegramLinkCodeModal) {
            state.refs.telegramLinkCodeModal.addEventListener('click', function(evt){
              if (evt.target === state.refs.telegramLinkCodeModal) {
                closeTelegramCodeModal({ keepPending: false });
              }
            });
          }
          state.bound = true;
        }

        function attachAuth(){
          if (state.unsubAuth) return;
          var services = ensureFirebase();
          if (!services || !services.auth){
            if (state.authRetry < 6){
              state.authRetry += 1;
              setTimeout(attachAuth, 600);
            }
            return;
          }
          state.authRetry = 0;
          state.auth = services.auth;
          if (!state.statusLoadCount) beginTelegramStatusLoading();
          state.unsubAuth = state.auth.onAuthStateChanged(function(user){
            if (!state.refs) return;
            if (!user){
              state.currentUid = "";
              clearTelegramStatusLoading();
              state.confirmedTelegramId = "";
              closeTelegramCodeModal({ keepPending: false });
              renderTelegramLink({});
              updateMessage('', true);
              updateLinkControls();
              try {
                if (typeof window.__redirectToLoginImmediately === 'function') window.__redirectToLoginImmediately();
                else window.location.replace('#/login');
              } catch(_){}
              return;
            }
            state.currentUid = user.uid;
            renderBotLink();
            updateLinkControls();
            refreshTelegramLinkState(true).finally(function(){
              endTelegramStatusLoading();
            });
          });
        }

        function build(){
          var root = ensureRoot();
          attachAuth();
          renderBotLink();
          var frag = document.createDocumentFragment();
          frag.appendChild(root);
          return frag;
        }

        function onShow(){
          renderBotLink();
          var refreshTask = Promise.resolve();
          if (state.currentUid) refreshTask = refreshTelegramLinkState(true);
          setTimeout(renderBotLink, 350);
          setTimeout(renderBotLink, 1200);
          setTimeout(renderBotLink, 2500);
          return refreshTask;
        }

        function prewarm(){
          try { queueI18nPrewarm(state.root || ensureRoot, { maxItems: 180 }); } catch(_){}
        }

        return {
          build: build,
          onShow: onShow,
          prewarm: prewarm
        };
      })();

      var securityRoute = (function(){
        var ISSUER_NAME = (function(){
          try {
            var brandName = String(window.__getCurrentStoreName ? window.__getCurrentStoreName() : '').trim();
            if (brandName) return brandName;
          } catch(_){}
          try {
            return String(window.location.hostname || '').trim() || 'Store';
          } catch(_) {
            return 'Store';
          }
        })();
        var STORAGE_PREFIX = "security:totp:";
        var AUTH_BASE_DEFAULT = (window.__getSiteWorkerBaseDefault ? window.__getSiteWorkerBaseDefault({ trailingSlash: true }) : (String(window.location.origin || '').replace(/\/+$/, '') + "/"));
        var EMAIL_OTP_RESEND_COOLDOWN_SECONDS = 5 * 60;
        var SECURITY_STATUS_AUTH_CACHE_TTL_MS = 4000;
        var state = {
          root: null,
          refs: null,
          auth: null,
          unsubAuth: null,
          authBindPromise: null,
          currentUser: null,
          enabled: false,
          enabledVia: "",
          secret: "",
          pendingSecret: "",
          loading: false,
          configLoading: false,
          configPromise: null,
          devices: [],
          devicesLoading: false,
          enableMethod: "",
          disableMethod: "",
          enableEmailRequested: false,
          enableTelegramRequested: false,
          disableEmailRequested: false,
          disableTelegramRequested: false,
          enableEmailTarget: "",
          enableTelegramTarget: "",
          disableEmailTarget: "",
          disableTelegramTarget: "",
          emailCodeFlow: "",
          enableEmailCooldownUntilMs: 0,
          disableEmailCooldownUntilMs: 0,
          emailCooldownTimer: null,
          botLink: "",
          linkedTelegramId: "",
          methodModalAutoPromptPending: false,
          bootLoaderHeld: false,
          configRequestToken: 0,
          authRequests: Object.create(null),
          authResponses: Object.create(null),
          lastConfigUid: "",
          lastConfigLoadedAt: 0
        };

        function buildAuthUrl(){
          var base = window.__getSiteWorkerBase ? window.__getSiteWorkerBase({ trailingSlash: true }) : AUTH_BASE_DEFAULT;
          try{
            var url = new URL(base);
            url.searchParams.set("action", "auth");
            return url.toString();
          }catch(_){
            return AUTH_BASE_DEFAULT + (AUTH_BASE_DEFAULT.indexOf("?") >= 0 ? "&" : "?") + "action=auth";
          }
        }

        function readSessionKeyInfo(){
          try{
            var raw = localStorage.getItem("sessionKeyInfo");
            if (!raw) return null;
            var data = JSON.parse(raw);
            if (data && data.sessionKey) return data;
          }catch(_){}
          return null;
        }

        function resolveAuthPayload(extra){
          var payload = Object.assign({}, extra || {});
          var info = readSessionKeyInfo();
          if (info && info.sessionKey && !payload.sessionKey) payload.sessionKey = info.sessionKey;
          if (info && info.uid && !payload.uid) payload.uid = info.uid;
          try {
            var deviceId = getDeviceId();
            if (deviceId && !payload.deviceId) payload.deviceId = deviceId;
          } catch(_){}
          try {
            var htmlEl = (typeof document !== "undefined" && document.documentElement) ? document.documentElement : null;
            var lang = String((payload.lang || payload.language || (htmlEl && htmlEl.lang) || (navigator && navigator.language) || "")).trim();
            if (lang) {
              if (!payload.language) payload.language = lang;
              if (!payload.lang) payload.lang = lang;
            }
            if (!payload.dir) {
              var dir = String((htmlEl && htmlEl.dir) || "").trim().toLowerCase();
              if (dir === "rtl" || dir === "ltr") payload.dir = dir;
            }
          } catch(_){}
          if (state.currentUser && typeof state.currentUser.getIdToken === "function") {
            return state.currentUser.getIdToken(true).then(function(token){
              if (token) payload.idToken = token;
              if (!payload.uid && state.currentUser && state.currentUser.uid) payload.uid = state.currentUser.uid;
              return payload;
            }).catch(function(){
              if (!payload.uid && state.currentUser && state.currentUser.uid) payload.uid = state.currentUser.uid;
              return payload;
            });
          }
          if (!payload.uid && state.currentUser && state.currentUser.uid) payload.uid = state.currentUser.uid;
          return Promise.resolve(payload);
        }

        function buildSecurityAuthRequestKey(action, payload){
          var normalizedAction = String(action || '').trim().toLowerCase();
          if (normalizedAction !== 'telegram_link_status' && normalizedAction !== 'totp_status') return '';
          var uid = String(payload && payload.uid || '').trim();
          if (!uid) return '';
          var sessionKey = String(payload && payload.sessionKey || '').trim();
          return normalizedAction + ':' + uid + ':' + sessionKey;
        }

        function readCachedSecurityAuthResponse(key){
          if (!key) return null;
          var entry = state.authResponses[key];
          if (!entry) return null;
          if ((Number(entry.expiresAt) || 0) <= Date.now()) {
            delete state.authResponses[key];
            return null;
          }
          return entry.data;
        }

        function writeCachedSecurityAuthResponse(key, data){
          if (!key) return data;
          state.authResponses[key] = {
            data: data,
            expiresAt: Date.now() + SECURITY_STATUS_AUTH_CACHE_TTL_MS
          };
          return data;
        }

        function clearSecurityAuthResponsePrefix(prefix, uid){
          var safePrefix = String(prefix || '').trim().toLowerCase();
          var safeUid = String(uid || '').trim();
          if (!safePrefix || !safeUid) return;
          var marker = safePrefix + ':' + safeUid + ':';
          Object.keys(state.authResponses).forEach(function(key){
            if (String(key || '').indexOf(marker) === 0) delete state.authResponses[key];
          });
          Object.keys(state.authRequests).forEach(function(key){
            if (String(key || '').indexOf(marker) === 0) delete state.authRequests[key];
          });
        }

        function clearCachedSecurityAuthResponse(action, payload){
          var normalizedAction = String(action || '').trim().toLowerCase();
          var uid = String(payload && payload.uid || '').trim();
          if (!normalizedAction || !uid) return;
          try { if (window.__clearSharedAuthStatusCache) window.__clearSharedAuthStatusCache(normalizedAction, payload || {}); } catch(_){}
          if (normalizedAction.indexOf('telegram_link_') === 0 && normalizedAction !== 'telegram_link_status') {
            clearSecurityAuthResponsePrefix('telegram_link_status', uid);
            return;
          }
          if (normalizedAction.indexOf('totp_') === 0 && normalizedAction !== 'totp_status') {
            clearSecurityAuthResponsePrefix('totp_status', uid);
          }
        }

        function callAuth(action, extra){
          var basePayload = Object.assign({}, extra || {}, { action: action });
          if (!basePayload.uid && state.currentUser && state.currentUser.uid) basePayload.uid = state.currentUser.uid;
          clearCachedSecurityAuthResponse(action, basePayload);
          var requestKey = buildSecurityAuthRequestKey(action, basePayload);
          if (requestKey && state.authRequests[requestKey]) return state.authRequests[requestKey];
          var cachedResponse = readCachedSecurityAuthResponse(requestKey);
          if (cachedResponse) return Promise.resolve(cachedResponse);
          var requestFactory = function(){
            return resolveAuthPayload(basePayload)
              .then(function(payload){
                return fetch(buildAuthUrl(), {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(payload)
                });
              })
              .then(function(res){
                return res.json().catch(function(){ return {}; }).then(function(data){
                  if (!res.ok || data.success === false) {
                    var msg = data.error || data.message || "تعذر تنفيذ الطلب.";
                    var err = new Error(msg);
                    err.code = data.code || "auth_failed";
                    throw err;
                  }
                  return writeCachedSecurityAuthResponse(requestKey, data);
                });
              });
          };
          var requestPromise = (window.__runSharedAuthStatusRequest || function(payload, ttlMs, factory){
            void payload;
            void ttlMs;
            return Promise.resolve().then(factory);
          })(basePayload, SECURITY_STATUS_AUTH_CACHE_TTL_MS, requestFactory);
          requestPromise = requestPromise.finally(function(){
              if (requestKey && state.authRequests[requestKey] === requestPromise) {
                delete state.authRequests[requestKey];
              }
            });
          if (requestKey) state.authRequests[requestKey] = requestPromise;
          return requestPromise;
        }

        function createError(code, message){
          var err = new Error(message || code || "security_error");
          err.code = code || "security_error";
          return err;
        }

        function getCrypto(){
          try{
            if (typeof window !== "undefined" && window.crypto) return window.crypto;
            if (typeof self !== "undefined" && self.crypto) return self.crypto;
          }catch(_){}
          return null;
        }

        var BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
        function base32Encode(bytes){
          var output = "";
          var bits = 0;
          var value = 0;
          for (var i = 0; i < bytes.length; i++){
            value = (value << 8) | bytes[i];
            bits += 8;
            while (bits >= 5){
              output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
              bits -= 5;
            }
          }
          if (bits > 0){
            output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
          }
          return output;
        }

        function base32Decode(str){
          var clean = (str || "").toString().toUpperCase().replace(/[^A-Z2-7]/g, "");
          var bits = 0;
          var value = 0;
          var out = [];
          for (var i = 0; i < clean.length; i++){
            var idx = BASE32_ALPHABET.indexOf(clean[i]);
            if (idx < 0) continue;
            value = (value << 5) | idx;
            bits += 5;
            if (bits >= 8){
              out.push((value >>> (bits - 8)) & 255);
              bits -= 8;
            }
          }
          return new Uint8Array(out);
        }

        function generateSecret(){
          var cryptoObj = getCrypto();
          var bytes = new Uint8Array(10);
          try{
            if (cryptoObj && cryptoObj.getRandomValues){
              cryptoObj.getRandomValues(bytes);
            } else {
              for (var i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
            }
          }catch(_){}
          return base32Encode(bytes);
        }

        function groupSecret(secret){
          var clean = (secret || "").toString().replace(/\s+/g, "");
          var parts = [];
          for (var i = 0; i < clean.length; i += 4){
            parts.push(clean.slice(i, i + 4));
          }
          return parts.join(" ");
        }

        function buildOtpAuthUrl(secret){
          var user = state.currentUser;
          var label = (user && user.email) ? user.email : (user && user.uid ? user.uid : "account");
          var issuer = ISSUER_NAME;
          var labelPart = encodeURIComponent(issuer + ":" + label);
          var params = "secret=" + encodeURIComponent(secret) +
            "&issuer=" + encodeURIComponent(issuer) +
            "&algorithm=SHA1&digits=6&period=30";
          return "otpauth://totp/" + labelPart + "?" + params;
        }

        function buildQrUrl(otpauth){
          return "https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=" + encodeURIComponent(otpauth);
        }

        function renderSecurityQr(otpauth){
          if (!state.refs || !state.refs.qr) return Promise.resolve("");
          var target = state.refs.qr;
          var value = String(otpauth || "").trim();
          function renderFallback(url){
            if (!url) return "";
            try {
              if (window.Za3emQr && typeof window.Za3emQr.renderFallbackQrCode === "function"){
                window.Za3emQr.renderFallbackQrCode(target, url, "QR Code");
              } else {
                target.innerHTML = "";
                var img = document.createElement("img");
                img.src = url;
                img.alt = "QR Code";
                img.loading = "lazy";
                img.decoding = "async";
                img.className = "qr-fallback-image";
                target.appendChild(img);
              }
            } catch(_){}
            return url;
          }
          if (!value){
            try {
              if (window.Za3emQr && typeof window.Za3emQr.clearQrTarget === "function") {
                window.Za3emQr.clearQrTarget(target);
              } else {
                target.innerHTML = "";
              }
            } catch(_){}
            return Promise.resolve("");
          }
          var fallbackUrl = buildQrUrl(value);
          if (window.Za3emQr && typeof window.Za3emQr.renderStyledQrCode === "function"){
            return window.Za3emQr.renderStyledQrCode(target, value, {
              size: 248,
              previewExtension: "svg"
            }).then(function(result){
              if (result && result.ok) return result.url || fallbackUrl;
              return renderFallback(fallbackUrl);
            }).catch(function(){
              return renderFallback(fallbackUrl);
            });
          }
          return Promise.resolve(renderFallback(fallbackUrl));
        }

        function computeTotp(secret, timeMs){
          return new Promise(function(resolve, reject){
            var cryptoObj = getCrypto();
            if (!cryptoObj || !cryptoObj.subtle){
              reject(createError("crypto_unavailable","متصفحك لا يدعم التحقق بهذا الشكل."));
              return;
            }
            var keyData = base32Decode(secret);
            var counter = Math.floor((timeMs || Date.now()) / 1000 / 30);
            var buffer = new ArrayBuffer(8);
            var view = new DataView(buffer);
            view.setUint32(0, 0, false);
            view.setUint32(4, counter, false);
            cryptoObj.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-1" }, false, ["sign"])
              .then(function(key){ return cryptoObj.subtle.sign("HMAC", key, buffer); })
              .then(function(sig){
                var bytes = new Uint8Array(sig);
                var offset = bytes[bytes.length - 1] & 0x0f;
                var code = ((bytes[offset] & 0x7f) << 24) |
                           ((bytes[offset + 1] & 0xff) << 16) |
                           ((bytes[offset + 2] & 0xff) << 8) |
                           (bytes[offset + 3] & 0xff);
                var otp = (code % 1000000).toString().padStart(6, "0");
                resolve(otp);
              })
              .catch(function(err){ reject(err); });
          });
        }

        function verifyTotp(code, secret){
          var clean = (code || "").toString().trim();
          if (!/^\d{6}$/.test(clean)) return Promise.resolve(false);
          var now = Date.now();
          var checks = [-1, 0, 1].map(function(offset){
            return computeTotp(secret, now + (offset * 30000)).catch(function(){ return ""; });
          });
          return Promise.all(checks).then(function(list){
            return list.indexOf(clean) >= 0;
          });
        }

        function getPendingKey(uid){ return STORAGE_PREFIX + "pending:" + uid; }
        function getLocalSecretKey(uid){ return STORAGE_PREFIX + "secret:" + uid; }
        function getLocalEnabledKey(uid){ return STORAGE_PREFIX + "enabled:" + uid; }

        function loadLocalConfig(uid){
          var out = { enabled: false, secret: "" };
          if (!uid) return out;
          try{
            out.enabled = localStorage.getItem(getLocalEnabledKey(uid)) === "1";
            out.secret = localStorage.getItem(getLocalSecretKey(uid)) || "";
          }catch(_){}
          return out;
        }

        function saveLocalConfig(uid, enabled, secret){
          if (!uid) return;
          try{
            if (enabled) localStorage.setItem(getLocalEnabledKey(uid), "1");
            else localStorage.removeItem(getLocalEnabledKey(uid));
            // Secrets policy (2026-07-19): the ACTIVE TOTP secret is never
            // persisted client-side — the server's user_secrets row is the
            // source and totp_status re-serves it on the normal path. Always
            // removing also self-cleans secrets stored by older builds. The
            // in-memory state.secret keeps the current view working, and the
            // enrollment-time PENDING secret has its own short-lived key.
            void secret;
            localStorage.removeItem(getLocalSecretKey(uid));
          }catch(_){}
        }

        function loadPendingSecret(uid){
          if (!uid) return "";
          try { return localStorage.getItem(getPendingKey(uid)) || ""; } catch(_){ return ""; }
        }

        function savePendingSecret(uid, secret){
          if (!uid) return;
          try{
            if (secret) localStorage.setItem(getPendingKey(uid), secret);
            else localStorage.removeItem(getPendingKey(uid));
          }catch(_){}
        }

        function ensurePendingSecret(){
          if (!state.currentUser || state.enabled) return "";
          var uid = state.currentUser.uid;
          var secret = loadPendingSecret(uid);
          if (!secret){
            secret = generateSecret();
            savePendingSecret(uid, secret);
          }
          state.pendingSecret = secret;
          return secret;
        }

        function ensureFirebase(){
          if (window.__SKIP_FIREBASE__) return null;
          try {
            if (typeof window.__FIREBASE_ENV_OK__ === "boolean" && !window.__FIREBASE_ENV_OK__) {
              window.__SKIP_FIREBASE__ = true;
              return null;
            }
          } catch(_){}
          if (typeof firebase === "undefined") return null;
          try{
            if (window.__ORIG_FIREBASE__){
              if (window.__ORIG_FIREBASE__.auth) firebase.auth = window.__ORIG_FIREBASE__.auth;
              if (window.__ORIG_FIREBASE__.firestore) firebase.firestore = window.__ORIG_FIREBASE__.firestore;
            }
          }catch(_){}
          try{
            if ((!firebase.apps || !firebase.apps.length) && window.__FIREBASE_CONFIG__){
              firebase.initializeApp(window.__FIREBASE_CONFIG__);
            }
          }catch(_){}
          var auth = null;
          try { auth = firebase.auth(); } catch(_){}
          if (!auth) return null;
          state.auth = auth;
          return { auth: auth };
        }

        function setStatus(type, message){
          if (!state.refs || !state.refs.status) return;
          state.refs.status.className = "security-status" + (type ? (" " + type) : "");
          state.refs.status.textContent = message || "";
          try {
            if (state.currentUser && state.enabled && type === "error" && message) {
              state.refs.status.hidden = false;
              state.refs.status.removeAttribute("hidden");
              state.refs.status.removeAttribute("aria-hidden");
              state.refs.status.style.removeProperty("display");
            }
          } catch(_){}
        }

        function getCurrentUserEmail(){
          var email = "";
          try { email = state.currentUser && state.currentUser.email ? String(state.currentUser.email) : ""; } catch(_){ email = ""; }
          return email.trim();
        }

        function normalizeTelegramTargetId(value){
          return String(value == null ? "" : value).replace(/[^\d]/g, "").trim();
        }

        function normalizeTelegramBotHref(value){
          var raw = String(value == null ? "" : value).trim();
          if (!raw) return "";
          if (/^tg:\/\/resolve\?/i.test(raw)) return raw;
          if (/^https?:\/\/t\.me\//i.test(raw)) return raw;
          if (/^@[\w.]{3,}$/i.test(raw)) return "https://t.me/" + raw.slice(1);
          if (/^[\w.]{3,}$/i.test(raw) && !raw.includes("/")) return "https://t.me/" + raw;
          return "";
        }

        function readSecurityJsonStorage(key){
          try {
            var raw = localStorage.getItem(key);
            if (!raw) return null;
            return JSON.parse(raw);
          } catch(_){
            return null;
          }
        }

        function readSecurityTelegramLinkFromContacts(raw){
          if (!Array.isArray(raw)) return "";
          for (var i = 0; i < raw.length; i += 1){
            var item = raw[i];
            if (!item || typeof item !== "object") continue;
            var key = String(item.key || item.id || item.className || item.label || item.name || "").trim().toLowerCase();
            if (key && key.indexOf("telegram") === -1) continue;
            var href = normalizeTelegramBotHref(item.href || item.url || item.link || item.value || "");
            if (href) return href;
          }
          return "";
        }

        function extractSecurityTelegramLink(raw){
          if (!raw) return "";
          if (typeof raw === "string") return normalizeTelegramBotHref(raw);
          if (Array.isArray(raw)) return readSecurityTelegramLinkFromContacts(raw);
          if (typeof raw !== "object") return "";
          var direct = normalizeTelegramBotHref(
            raw.telegramBotLink ||
            raw.telegramLink ||
            raw.telegramUrl ||
            raw.telegramURL ||
            raw.telegram ||
            ""
          );
          if (direct) return direct;
          var maps = [raw.links, raw.contactLinks, raw.supportLinks, raw.linkMap, raw.map];
          for (var i = 0; i < maps.length; i += 1){
            var candidate = maps[i];
            if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) continue;
            direct = normalizeTelegramBotHref(candidate.telegram || candidate.telegramBotLink || candidate.telegramLink || "");
            if (direct) return direct;
          }
          return readSecurityTelegramLinkFromContacts(raw.contacts || raw.contactMethods || raw.items || raw.list);
        }

        function resolveSecurityTelegramBotLink(){
          var direct = normalizeTelegramBotHref(window.__TELEGRAM_LINK_BOT_URL__);
          if (direct) return direct;
          try {
            direct = normalizeTelegramBotHref(window.__SUPPORT_LINKS_MAP__ && window.__SUPPORT_LINKS_MAP__.telegram);
            if (direct) return direct;
          } catch(_){}
          try {
            direct = readSecurityTelegramLinkFromContacts(window.__SUPPORT_CONTACTS_RENDERED__);
            if (direct) return direct;
          } catch(_){}
          var storageKeys = ["site:support:v1", "site:support:contacts:v1", "site:support:links:v1"];
          for (var i = 0; i < storageKeys.length; i += 1){
            direct = extractSecurityTelegramLink(readSecurityJsonStorage(storageKeys[i]));
            if (direct) return direct;
          }
          return "";
        }

        function renderSecurityTelegramBotLink(){
          if (!state.refs || !state.refs.telegramOpenBotBtn) return;
          var href = resolveSecurityTelegramBotLink();
          state.botLink = href;
          if (!href) {
            state.refs.telegramOpenBotBtn.setAttribute("href", "#");
            state.refs.telegramOpenBotBtn.setAttribute("aria-disabled", "true");
            state.refs.telegramOpenBotBtn.classList.add("is-disabled");
            return;
          }
          state.refs.telegramOpenBotBtn.setAttribute("href", href);
          state.refs.telegramOpenBotBtn.setAttribute("aria-disabled", "false");
          state.refs.telegramOpenBotBtn.classList.remove("is-disabled");
        }

        function getSecurityTelegramTargetId(){
          var direct = normalizeTelegramTargetId(state.refs && state.refs.telegramUserIdInput ? state.refs.telegramUserIdInput.value : "");
          return direct || normalizeTelegramTargetId(state.linkedTelegramId || "");
        }

        function hasValidSecurityTelegramTargetId(){
          return /^\d{5,20}$/.test(getSecurityTelegramTargetId());
        }

        function syncEnableRequestButtonVisibility(){
          if (!state.refs || !state.refs.enableRequestBtn) return;
          var method = isSecurityCodeDeliveryMethod(state.enableMethod) ? state.enableMethod : "";
          var shouldShow = method === "telegram" && hasValidSecurityTelegramTargetId() && !getEnableCodeRequested(method);
          state.refs.enableRequestBtn.style.display = shouldShow ? "flex" : "none";
          var actions = state.refs.enableRequestBtn.closest ? state.refs.enableRequestBtn.closest(".security-telegram-actions") : null;
          if (actions) actions.classList.toggle("has-request", shouldShow);
        }

        function renderSecurityTelegramTarget(telegramId){
          var clean = normalizeTelegramTargetId(telegramId);
          var previousLinked = normalizeTelegramTargetId(state.linkedTelegramId || "");
          state.linkedTelegramId = clean;
          if (!state.refs || !state.refs.telegramUserIdInput) return;
          var current = normalizeTelegramTargetId(state.refs.telegramUserIdInput.value);
          if (!current || current === previousLinked) {
            state.refs.telegramUserIdInput.value = clean;
          }
          syncEnableRequestButtonVisibility();
          renderEmailRequestButtons();
        }

        function refreshSecurityTelegramLinkState(silent){
          if (!state.currentUser) {
            state.linkedTelegramId = "";
            if (state.refs && state.refs.telegramUserIdInput && !state.enableTelegramRequested) {
              state.refs.telegramUserIdInput.value = "";
            }
            syncEnableRequestButtonVisibility();
            return Promise.resolve(null);
          }
          return callAuth("telegram_link_status").then(function(data){
            var telegramId = normalizeTelegramTargetId((data && (data.telegramUserId || data.telegramChatId || data.telegramId)) || "");
            renderSecurityTelegramTarget(telegramId);
            return data || {};
          }).catch(function(err){
            if (!silent) {
              setStatus("error", err && err.message ? err.message : "تعذر قراءة معرف تيليغرام.");
            }
            return null;
          });
        }

        function hasVisibleSecurityModal(){
          if (!state.refs) return false;
          var modals = [state.refs.methodModal, state.refs.alertModal, state.refs.emailCodeModal];
          for (var i = 0; i < modals.length; i += 1) {
            if (modals[i] && !modals[i].classList.contains("hidden")) return true;
          }
          return false;
        }

        function syncSecurityModalState(){
          var hasOpenModal = hasVisibleSecurityModal();
          var methodModalOpen = !!(state.refs && state.refs.methodModal && !state.refs.methodModal.classList.contains("hidden"));
          try{
            document.documentElement.classList.toggle("transfer-modal-open", hasOpenModal);
            document.body.classList.toggle("transfer-modal-open", hasOpenModal);
          }catch(_){}
          try{
            if (state.root) state.root.classList.toggle("security-method-picker-open", methodModalOpen);
          }catch(_){}
        }

        function closeMethodModal(){
          if (!state.refs || !state.refs.methodModal) return;
          state.refs.methodModal.classList.add("hidden");
          state.refs.methodModal.classList.remove("open");
          state.refs.methodModal.setAttribute("aria-hidden", "true");
          syncSecurityModalState();
        }

        function openMethodModal(){
          if (!state.refs || !state.refs.methodModal) return;
          if (!isSecurityRouteActive()) return;
          if (!state.currentUser) {
            setStatus("", "");
            showAlert("سجّل الدخول أولًا.");
            return;
          }
          if (state.enabled) return;
          state.methodModalAutoPromptPending = false;
          state.refs.methodModal.classList.remove("hidden");
          state.refs.methodModal.classList.add("open");
          state.refs.methodModal.setAttribute("aria-hidden", "false");
          syncSecurityModalState();
          setTimeout(function(){
            var targetBtn = null;
            if (state.enableMethod === "telegram") targetBtn = state.refs.enableMethodTelegram;
            else targetBtn = state.refs.enableMethodApp;
            if (!targetBtn) {
              targetBtn = state.refs.enableMethodApp || state.refs.enableMethodTelegram;
            }
            try {
              if (targetBtn) targetBtn.focus();
            } catch(_){}
          }, 30);
        }

        function closeAlert(){
          if (!state.refs || !state.refs.alertModal) return;
          state.refs.alertModal.classList.add("hidden");
          state.refs.alertModal.classList.remove("open");
          state.refs.alertModal.setAttribute("aria-hidden","true");
          syncSecurityModalState();
        }

        function closeEmailCodeModal(){
          if (!state.refs || !state.refs.emailCodeModal) return;
          state.refs.emailCodeModal.classList.add("hidden");
          state.refs.emailCodeModal.classList.remove("open");
          state.refs.emailCodeModal.setAttribute("aria-hidden","true");
          if (state.refs.emailCodeInput) state.refs.emailCodeInput.value = "";
          if (state.refs.emailCodeError) state.refs.emailCodeError.textContent = "";
          state.emailCodeFlow = "";
          renderEmailRequestButtons();
          syncSecurityModalState();
        }

        function openEmailCodeModal(options){
          if (!state.refs || !state.refs.emailCodeModal) return;
          if (!isSecurityRouteActive()) return;
          var flow = (options && options.flow) === "disable" ? "disable" : "enable";
          var target = (options && options.target) ? String(options.target) : "";
          var disableMethod = normalizeTotpEnabledVia(
            (options && options.method) || state.disableMethod || state.enabledVia || ""
          );
          var modalMethod = flow === "disable"
            ? disableMethod
            : normalizeTotpEnabledVia((options && options.method) || state.enableMethod || "");
          state.emailCodeFlow = flow;
          if (state.refs.emailCodeTitle) {
            if (flow === "disable") {
              state.refs.emailCodeTitle.textContent = disableMethod === "app"
                ? "أدخل رمز Google Authenticator"
                : "أدخل رمز تيليغرام لإلغاء المصادقة";
            } else {
              state.refs.emailCodeTitle.textContent = "أدخل رمز تيليغرام لتفعيل الحماية";
            }
          }
          if (state.refs.emailCodeSubtitle) {
            var baseText = "";
            if (flow === "disable") {
              baseText = disableMethod === "app"
                ? "أدخل رمز Google Authenticator المكوّن من 6 أرقام لإلغاء المصادقة."
                : "أدخل رمز تيليغرام المكوّن من 6 أرقام لإلغاء المصادقة.";
            } else {
              baseText = "أدخل رمز تيليغرام المكوّن من 6 أرقام لتفعيل الحماية.";
            }
            state.refs.emailCodeSubtitle.textContent = baseText;
          }
          if (state.refs.emailCodeSubmit) {
            state.refs.emailCodeSubmit.textContent = flow === "disable" ? "إلغاء المصادقة" : "تفعيل الآن";
          }
          if (state.refs.emailCodeInput) state.refs.emailCodeInput.value = "";
          if (state.refs.emailCodeError) {
            state.refs.emailCodeError.style.color = "var(--danger)";
            state.refs.emailCodeError.textContent = "";
          }
          state.refs.emailCodeModal.classList.remove("hidden");
          state.refs.emailCodeModal.classList.add("open");
          state.refs.emailCodeModal.setAttribute("aria-hidden","false");
          renderEmailRequestButtons();
          syncSecurityModalState();
          setTimeout(function(){
            if (!state.refs || !state.refs.emailCodeInput) return;
            try{
              state.refs.emailCodeInput.focus();
            }catch(_){}
          }, 30);
        }

        function submitEmailCodeModal(){
          if (!state.refs || !state.refs.emailCodeInput) return;
          var code = normalizeCodeValue(state.refs.emailCodeInput.value || "");
          state.refs.emailCodeInput.value = code;
          if (!/^\d{6}$/.test(code)){
            if (state.refs.emailCodeError) state.refs.emailCodeError.textContent = "أدخل رمزًا صحيحًا من 6 أرقام.";
            return;
          }
          var flow = state.emailCodeFlow || "";
          var method = flow === "disable"
            ? normalizeTotpEnabledVia(state.disableMethod || state.enabledVia || "")
            : normalizeTotpEnabledVia(state.enableMethod || "");
          var maxAttempts = method === "telegram" ? 3 : 5;
          var scope = "security-code-attempt:" + flow + ":" + method + ":" + String(state.currentUser && state.currentUser.uid || "");
          var blockedFor = window.__siteOtpLimits
            ? window.__siteOtpLimits.getAttemptRemaining(scope, maxAttempts)
            : 0;
          if (blockedFor > 0) {
            if (state.refs.emailCodeError) {
              state.refs.emailCodeError.style.color = "var(--danger)";
              state.refs.emailCodeError.textContent = "انتهت محاولات إدخال الرمز. حاول بعد " + window.__siteOtpLimits.format(blockedFor) + ".";
            }
            return;
          }
          if (window.__siteOtpLimits) window.__siteOtpLimits.markAttempt(scope);
          if (flow === "disable") {
            closeEmailCodeModal();
            handleDisableWithCode(code);
            return;
          }
          if (state.refs.otp) state.refs.otp.value = code;
          closeEmailCodeModal();
          handleEnable();
        }

        function handleEmailCodeResend(){
          if (state.loading || !state.currentUser) return;
          var flow = state.emailCodeFlow === "disable" ? "disable" : "enable";
          var method = flow === "disable"
            ? normalizeTotpEnabledVia(state.disableMethod || state.enabledVia || "")
            : normalizeTotpEnabledVia(state.enableMethod || "");
          if (!isSecurityCodeDeliveryMethod(method)) return;
          var remaining = getEmailCooldownRemaining(flow);
          if (remaining > 0) {
            if (state.refs && state.refs.emailCodeError) {
              state.refs.emailCodeError.style.color = "var(--muted)";
              state.refs.emailCodeError.textContent = "يمكنك إعادة الإرسال بعد " + remaining + " ثانية.";
            }
            renderEmailRequestButtons();
            return;
          }

          var purpose = flow === "disable" ? "totp_disable" : "totp_enable";
          var loaderHeld = false;
          setLoading(true);
          setGlobalPageLoader(true);
          loaderHeld = true;
          if (state.refs && state.refs.emailCodeError) {
            state.refs.emailCodeError.style.color = "var(--muted)";
            state.refs.emailCodeError.textContent = "";
          }

          requestSecurityTelegramCode(purpose).then(function(res){
            var target = (res && res.to ? String(res.to) : "");
            var cooldownSeconds = Number(
              (res && (res.resendAfterSeconds ?? res.retryAfterSeconds)) ?? EMAIL_OTP_RESEND_COOLDOWN_SECONDS
            );
            if (flow === "disable") {
              setDisableCodeState(method, true, target);
              startEmailCooldown("disable", cooldownSeconds);
            } else {
              setEnableCodeState(method, true, target);
              startEmailCooldown("enable", cooldownSeconds);
            }
            if (state.refs && state.refs.emailCodeSubtitle) {
              var baseText = flow === "disable"
                ? "تمت إعادة إرسال رمز الإلغاء إلى تيليغرام."
                : "تمت إعادة إرسال رمز التحقق إلى تيليغرام.";
              state.refs.emailCodeSubtitle.textContent = target ? (baseText + " " + target) : baseText;
            }
            if (state.refs && state.refs.emailCodeError) {
              state.refs.emailCodeError.style.color = "var(--sec-success, #16a34a)";
              state.refs.emailCodeError.textContent = "تم إرسال رمز جديد بنجاح.";
            }
          }).catch(function(err){
            if (state.refs && state.refs.emailCodeError) {
              state.refs.emailCodeError.style.color = "var(--danger)";
              state.refs.emailCodeError.textContent = err && err.message ? err.message : ("تعذر إعادة إرسال رمز " + getSecurityMethodLabel(method) + ".");
            }
          }).finally(function(){
            setLoading(false);
            if (loaderHeld) setGlobalPageLoader(false);
            renderEmailRequestButtons();
          });
        }

        function showAlert(message, title){
          if (!state.refs || !state.refs.alertModal) return;
          if (state.refs.alertMessage) state.refs.alertMessage.textContent = message || "";
          if (title && state.refs.alertModal){
            var titleEl = state.refs.alertModal.querySelector("#securityAlertTitle");
            if (titleEl) titleEl.textContent = title;
          }
          state.refs.alertModal.classList.remove("hidden");
          state.refs.alertModal.classList.add("open");
          state.refs.alertModal.setAttribute("aria-hidden","false");
          syncSecurityModalState();
        }

        function normalizeCodeValue(value){
          return String(value || "").replace(/\D/g, "").slice(0, 6);
        }

        function isSecurityCodeDeliveryMethod(method){
          return method === "telegram";
        }

        function getSecurityMethodLabel(method){
          if (method === "telegram") return "تيليغرام";
          return "التطبيق";
        }

        function getSecurityMethodCodeLabel(method){
          if (method === "telegram") return "رمز تيليغرام";
          return "رمز التطبيق";
        }

        function getSecurityRequestButtonHtml(method, requestedBefore){
          return requestedBefore
            ? '<i class="fa-solid fa-comment-sms" aria-hidden="true"></i> إعادة طلب رمز عبر تيليغرام'
            : '<i class="fa-solid fa-comment-sms" aria-hidden="true"></i> طلب رمز عبر تيليغرام';
        }

        function getEnableCodeRequested(method){
          return method === "telegram" ? state.enableTelegramRequested === true : state.enableEmailRequested === true;
        }

        function getDisableCodeRequested(method){
          return method === "telegram" ? state.disableTelegramRequested === true : state.disableEmailRequested === true;
        }

        function getEnableCodeTarget(method){
          return method === "telegram" ? (state.enableTelegramTarget || "") : (state.enableEmailTarget || "");
        }

        function getDisableCodeTarget(method){
          return method === "telegram" ? (state.disableTelegramTarget || "") : (state.disableEmailTarget || "");
        }

        function setEnableCodeState(method, requested, target){
          if (method === "telegram") {
            state.enableTelegramRequested = !!requested;
            state.enableTelegramTarget = target ? String(target) : "";
          } else if (method === "email") {
            state.enableEmailRequested = !!requested;
            state.enableEmailTarget = target ? String(target) : "";
          }
        }

        function setDisableCodeState(method, requested, target){
          if (method === "telegram") {
            state.disableTelegramRequested = !!requested;
            state.disableTelegramTarget = target ? String(target) : "";
          } else if (method === "email") {
            state.disableEmailRequested = !!requested;
            state.disableEmailTarget = target ? String(target) : "";
          }
        }

        function clearSecurityCodeState(flow){
          if (flow === "disable") {
            state.disableEmailRequested = false;
            state.disableTelegramRequested = false;
            state.disableEmailTarget = "";
            state.disableTelegramTarget = "";
            return;
          }
          state.enableEmailRequested = false;
          state.enableTelegramRequested = false;
          state.enableEmailTarget = "";
          state.enableTelegramTarget = "";
        }

        function getEmailCooldownUntil(flow){
          return flow === "disable"
            ? Number(state.disableEmailCooldownUntilMs || 0)
            : Number(state.enableEmailCooldownUntilMs || 0);
        }

        function setEmailCooldownUntil(flow, untilMs){
          var safeUntil = Number(untilMs) || 0;
          if (flow === "disable") state.disableEmailCooldownUntilMs = safeUntil;
          else state.enableEmailCooldownUntilMs = safeUntil;
        }

        function getEmailCooldownRemaining(){
          // Frontend resend timer removed: the server is the sole authority for the
          // resend cooldown and returns the retry message itself.
          return 0;
        }

        function stopEmailCooldownTimer(){
          if (!state.emailCooldownTimer) return;
          try { clearInterval(state.emailCooldownTimer); } catch(_){}
          state.emailCooldownTimer = null;
        }

        function renderEmailRequestButtons(){
          if (!state.refs) return;

          var enableRemaining = getEmailCooldownRemaining("enable");
          if (state.refs.enableRequestBtn) {
            var enableBaseDisabled =
              state.loading ||
              !state.currentUser ||
              state.enabled ||
              !isSecurityCodeDeliveryMethod(state.enableMethod) ||
              (state.enableMethod === "telegram" && !hasValidSecurityTelegramTargetId());
            state.refs.enableRequestBtn.disabled = enableBaseDisabled || enableRemaining > 0;
            if (enableRemaining > 0) {
              state.refs.enableRequestBtn.textContent = "إعادة الإرسال بعد " + enableRemaining + " ث";
            } else {
              state.refs.enableRequestBtn.innerHTML = getSecurityRequestButtonHtml(
                isSecurityCodeDeliveryMethod(state.enableMethod) ? state.enableMethod : "telegram",
                getEnableCodeRequested(state.enableMethod)
              );
            }
          }
          syncEnableRequestButtonVisibility();

          if (state.refs.emailCodeResend) {
            var flow = state.emailCodeFlow === "disable" ? "disable" : "enable";
            var disableMethod = normalizeTotpEnabledVia(state.disableMethod || state.enabledVia || "");
            var modalOpen = !!(state.refs.emailCodeModal && !state.refs.emailCodeModal.classList.contains("hidden"));
            var canShowResend = modalOpen && (
              flow === "enable" || (flow === "disable" && isSecurityCodeDeliveryMethod(disableMethod))
            );
            state.refs.emailCodeResend.style.display = canShowResend ? "inline-flex" : "none";
            if (canShowResend) {
              var flowRemaining = getEmailCooldownRemaining(flow);
              state.refs.emailCodeResend.disabled = state.loading || flowRemaining > 0;
              if (flowRemaining > 0) {
                state.refs.emailCodeResend.textContent = "إعادة الإرسال بعد " + flowRemaining + " ث";
              } else {
                state.refs.emailCodeResend.innerHTML =
                  getSecurityRequestButtonHtml(flow === "disable" ? disableMethod : state.enableMethod, true);
              }
            }
          }
        }

        function ensureEmailCooldownTimer(){
          renderEmailRequestButtons();
          var hasEnable = getEmailCooldownRemaining("enable") > 0;
          var hasDisable = getEmailCooldownRemaining("disable") > 0;
          if (!hasEnable && !hasDisable) {
            stopEmailCooldownTimer();
            return;
          }
          if (state.emailCooldownTimer) return;
          state.emailCooldownTimer = setInterval(function(){
            renderEmailRequestButtons();
            if (getEmailCooldownRemaining("enable") <= 0 && getEmailCooldownRemaining("disable") <= 0) {
              stopEmailCooldownTimer();
            }
          }, 1000);
        }

        function startEmailCooldown(){
          // Frontend resend timer removed: no local countdown is started after a send.
          // The server alone decides when a resend is allowed and returns that message.
        }

        function setMethodButtons(activeMethod, appBtn, emailBtn, telegramBtn){
          if (appBtn) appBtn.classList.toggle("active", activeMethod === "app");
          if (emailBtn) emailBtn.classList.toggle("active", activeMethod === "email");
          if (telegramBtn) telegramBtn.classList.toggle("active", activeMethod === "telegram");
        }

        function normalizeTotpEnabledVia(value){
          var raw = String(value || "").trim().toLowerCase();
          if (raw === "app" || raw === "telegram") return raw;
          if (raw === "tg" || raw === "telegram_bot" || raw === "bot") return "telegram";
          if (raw === "totp") return "app";
          return "";
        }

        function getEnableMethodSummaryLabel(method){
          var normalized = normalizeTotpEnabledVia(method);
          if (!normalized) return "لم يتم اختيار أي طريقة بعد";
          return "التحقق عبر " + getSecurityMethodLabel(normalized);
        }

        function renderEnableMethodSummary(){
          if (!state.refs) return;
          if (state.refs.selectedMethod) {
            state.refs.selectedMethod.textContent = getEnableMethodSummaryLabel(state.enableMethod);
            state.refs.selectedMethod.classList.toggle("is-empty", !state.enableMethod);
          }
          if (state.refs.openMethodModalBtn) {
            state.refs.openMethodModalBtn.textContent = "تبديل";
          }
        }

        function focusEnableMethodField(method){
          if (!state.refs) return;
          var normalized = normalizeTotpEnabledVia(method);
          var target = null;
          if (normalized === "telegram") target = state.refs.telegramUserIdInput || state.refs.enableRequestBtn;
          else if (normalized === "app") target = state.refs.otp;
          if (!target) return;
          setTimeout(function(){
            try {
              target.focus();
              if (typeof target.select === "function" && normalized === "app") target.select();
            } catch(_){}
          }, 40);
        }

        function chooseEnableMethod(method){
          var normalized = normalizeTotpEnabledVia(method);
          if (!normalized) return;
          state.methodModalAutoPromptPending = false;
          setEnableMethod(normalized);
          closeMethodModal();
          focusEnableMethodField(normalized);
        }

        function maybeAutoOpenMethodModal(){
          if (!state.methodModalAutoPromptPending) return;
          if (!isSecurityRouteActive()) return;
          if (!state.currentUser || state.enabled || state.loading || state.configLoading || state.enableMethod) return;
          state.methodModalAutoPromptPending = false;
          openMethodModal();
        }

        function setEnableCodeInputVisible(on, labelText){
          if (!state.refs) return;
          if (state.refs.otpWrap) state.refs.otpWrap.style.display = on ? "flex" : "none";
          if (state.refs.otpLabel && labelText) state.refs.otpLabel.textContent = labelText;
          if (!on && state.refs.otp) state.refs.otp.value = "";
        }

        function setEnableMethod(method){
          var normalized = (method === "app" || method === "telegram") ? method : "";
          var showEnableAction = false;
          if (!isSecurityCodeDeliveryMethod(normalized) && state.emailCodeFlow === "enable") {
            closeEmailCodeModal();
          }
          state.enableMethod = normalized;
          if (state.root) state.root.setAttribute("data-security-method", normalized || "none");
          if (normalized) {
            state.methodModalAutoPromptPending = false;
          }
          if (!normalized) {
            clearSecurityCodeState("enable");
          }
          setMethodButtons(normalized, state.refs && state.refs.enableMethodApp, null, state.refs && state.refs.enableMethodTelegram);
          renderEnableMethodSummary();
          if (state.refs && state.refs.appDetails) {
            state.refs.appDetails.style.display = normalized === "app" ? "block" : "none";
          }
          if (state.refs && state.refs.telegramTools) {
            state.refs.telegramTools.style.display = normalized === "telegram" ? "grid" : "none";
          }
          if (!state.refs) return;
          syncEnableRequestButtonVisibility();
          if (normalized === "app") {
            showEnableAction = true;
            setEnableCodeInputVisible(true, "رمز التطبيق");
            if (state.refs.enableMethodHint) {
              state.refs.enableMethodHint.textContent = "";
              state.refs.enableMethodHint.style.display = "none";
            }
          } else if (normalized === "telegram") {
            showEnableAction = false;
            setEnableCodeInputVisible(false, getSecurityMethodCodeLabel(normalized));
            if (state.refs.enableMethodHint) {
              state.refs.enableMethodHint.style.display = "block";
              state.refs.enableMethodHint.textContent = getEnableCodeRequested(normalized)
                ? "تم إرسال الرمز. أدخله في النموذج المنفصل لإكمال التفعيل."
                : "افتح البوت، أدخل المعرّف الرقمي، ثم اضغط طلب الرمز.";
            }
          } else {
            setEnableCodeInputVisible(false, "رمز التحقق");
            if (state.refs.enableMethodHint) {
              state.refs.enableMethodHint.style.display = "none";
              state.refs.enableMethodHint.textContent = "";
            }
          }
          if (state.refs.enableBtn && state.refs.enableBtn.parentElement) {
            state.refs.enableBtn.style.display = normalized === "telegram" ? "none" : "";
            state.refs.enableBtn.parentElement.style.display = showEnableAction ? "flex" : "none";
          }
          setLoading(state.loading);
          renderEmailRequestButtons();
        }

        function setDisableMethod(method){
          var normalized = (method === "app" || method === "telegram") ? method : "";
          if (!normalized && state.emailCodeFlow === "disable") {
            closeEmailCodeModal();
          }
          state.disableMethod = normalized;
          if (!normalized) {
            clearSecurityCodeState("disable");
          }
          if (!state.refs) return;
          if (state.refs.disableMethodHint) {
            if (normalized === "app") {
              state.refs.disableMethodHint.textContent = "سيُطلب رمز Google Authenticator لإلغاء المصادقة.";
            } else if (normalized === "telegram") {
              state.refs.disableMethodHint.textContent = "سيتم إرسال رمز تحقق إلى تيليغرام لإلغاء المصادقة.";
            } else {
              state.refs.disableMethodHint.textContent = "تعذر تحديد طريقة التحقق الحالية.";
            }
          }
          setLoading(state.loading);
          renderEmailRequestButtons();
        }

        function setLoading(on){
          state.loading = !!on;
          if (!state.refs) return;
          if (state.refs.openMethodModalBtn) {
            state.refs.openMethodModalBtn.disabled = !!on || !state.currentUser || state.enabled;
          }
          if (state.refs.enableBtn) {
            var canEnable =
              !!state.currentUser &&
              !state.enabled &&
              !!state.enableMethod &&
              (state.enableMethod === "app" || getEnableCodeRequested(state.enableMethod));
            state.refs.enableBtn.disabled = on || !canEnable;
          }
          if (state.refs.disableBtn) state.refs.disableBtn.disabled = on || !state.currentUser || !state.enabled || !state.disableMethod;
          if (state.refs.otp) {
            var canUseEnableCode = !!state.currentUser && !state.enabled && !!state.enableMethod &&
              (state.enableMethod === "app" || getEnableCodeRequested(state.enableMethod));
            state.refs.otp.disabled = on || !canUseEnableCode;
          }
          if (state.refs.enableMethodApp) {
            state.refs.enableMethodApp.disabled = !!on || !state.currentUser || state.enabled;
          }
          if (state.refs.enableMethodTelegram) {
            state.refs.enableMethodTelegram.disabled = !!on || !state.currentUser || state.enabled;
          }
          if (state.refs.telegramUserIdInput) {
            state.refs.telegramUserIdInput.disabled = !!on || !state.currentUser || state.enabled;
          }
          if (state.refs.telegramOpenBotBtn) {
            state.refs.telegramOpenBotBtn.classList.toggle("is-disabled", !!on || !state.botLink);
            state.refs.telegramOpenBotBtn.setAttribute("aria-disabled", (!state.botLink || !!on) ? "true" : "false");
          }
          renderEmailRequestButtons();
        }

        function setGlobalPageLoader(on){
          var active = !!on;
          try {
            if (typeof showLoader === "function") {
              showLoader(active);
              return;
            }
          } catch (_) {}
          try {
            if (active) {
              if (typeof window.__holdPageLoader === "function") {
                window.__holdPageLoader();
              } else {
                var elShow = document.getElementById("preloader");
                if (elShow) {
                  elShow.classList.remove("hidden");
                  elShow.style.display = "flex";
                  elShow.style.opacity = "1";
                }
              }
            } else if (typeof window.__releasePageLoader === "function") {
              window.__releasePageLoader();
            } else {
              var elHide = document.getElementById("preloader");
              if (elHide) {
                elHide.classList.add("hidden");
                elHide.style.opacity = "0";
                setTimeout(function(){ try { elHide.style.display = "none"; } catch (__){ } }, 250);
              }
            }
          } catch (_) {}
        }

        function setConfigReady(ready){
          if (!state.root) return;
          state.root.setAttribute("data-config-ready", ready ? "true" : "false");
        }

        function isSecurityRouteActive(){
          var routeKey = "";
          try { routeKey = String(document.body && document.body.getAttribute("data-inline-route") || "").toLowerCase(); } catch(_){ routeKey = ""; }
          if (routeKey === "security") return true;
          try {
            var hashKey = String(location.hash || "").replace(/^#\/?/, "").split("/").filter(Boolean)[0] || "";
            return hashKey.toLowerCase() === "security";
          } catch(_){}
          return false;
        }

        function invalidateSecurityConfigRequest(){
          try {
            state.configRequestToken = (Number(state.configRequestToken) || 0) + 1;
          } catch(_){
            state.configRequestToken = 1;
          }
        }

        function cleanupSecurityTransientState(){
          invalidateSecurityConfigRequest();
          state.methodModalAutoPromptPending = false;
          try { window.__SECURITY_CONFIG_LOADING__ = false; } catch(_){}
          if (state.bootLoaderHeld) {
            try { releaseSecurityBootLoader(); } catch(_){}
          }
          if (state.configLoading) {
            try {
              if (typeof window.__releasePageLoader === "function") {
                window.__releasePageLoader();
              } else if (typeof hidePageLoader === "function") {
                hidePageLoader();
              }
            } catch(_){}
          }
          state.bootLoaderHeld = false;
          state.configLoading = false;
          state.configPromise = null;
          state.loading = false;
          try { closeMethodModal(); } catch(_){}
          try { closeAlert(); } catch(_){}
          try { closeEmailCodeModal(); } catch(_){}
          try {
            document.documentElement.classList.remove("transfer-modal-open");
            document.body.classList.remove("transfer-modal-open");
          } catch(_){}
        }

        function holdSecurityBootLoader(){
          if (state.bootLoaderHeld) return;
          if (state.configLoading) return;
          state.bootLoaderHeld = true;
          try {
            if (typeof window.__holdPageLoader === "function") {
              window.__holdPageLoader();
            } else if (typeof showPageLoader === "function") {
              showPageLoader({ hold: true });
            }
          } catch(_){}
        }

        function releaseSecurityBootLoader(){
          if (!state.bootLoaderHeld) return;
          state.bootLoaderHeld = false;
          try {
            if (typeof window.__releasePageLoader === "function") {
              window.__releasePageLoader();
            } else if (typeof hidePageLoader === "function") {
              hidePageLoader();
            }
          } catch(_){}
        }

        function forceHideSecurityLoaderIfIdle(){
          try {
            if (state.configLoading || state.loading) return;
            var routeKey = "";
            try { routeKey = String(document.body && document.body.getAttribute("data-inline-route") || "").toLowerCase(); } catch(_){ routeKey = ""; }
            if (routeKey !== "security") return;
            try { window.__SECURITY_CONFIG_LOADING__ = false; } catch(_){}
            try {
              if (typeof window.__resetPageLoaderHold === "function") {
                window.__resetPageLoaderHold();
              } else if (typeof window.__releasePageLoader === "function") {
                window.__releasePageLoader();
              }
            } catch(_){}
            try { if (typeof hidePageLoader === "function") hidePageLoader(); } catch(_){}
            try {
              var el = document.getElementById("preloader");
              if (el) {
                el.classList.add("hidden");
                el.style.opacity = "0";
                el.style.visibility = "hidden";
                el.style.pointerEvents = "none";
                el.style.display = "none";
              }
            } catch(_){}
          } catch(_){}
        }

        function setConfigLoading(on, message){
          var active = !!on;
          state.configLoading = active;
          try { window.__SECURITY_CONFIG_LOADING__ = active; } catch (_) {}
          if (active) {
            setConfigReady(false);
            try {
              if (typeof window.__holdPageLoader === "function") {
                window.__holdPageLoader();
              } else if (typeof showPageLoader === "function") {
                showPageLoader({ hold: true });
              } else {
                var elShow = document.getElementById("preloader");
                if (elShow) {
                  elShow.classList.remove("hidden");
                  elShow.style.display = "flex";
                  elShow.style.opacity = "1";
                }
              }
            } catch (_) {}
            setLoading(true);
            return;
          }
          try {
            if (typeof window.__releasePageLoader === "function") {
              window.__releasePageLoader();
            } else if (typeof hidePageLoader === "function") {
              hidePageLoader();
            } else {
              var elHide = document.getElementById("preloader");
              if (elHide) {
                elHide.classList.add("hidden");
                elHide.style.opacity = "0";
                setTimeout(function(){ try { elHide.style.display = "none"; } catch (__){ } }, 250);
              }
            }
          } catch (_) {}
          try {
            setTimeout(forceHideSecurityLoaderIfIdle, 30);
            setTimeout(forceHideSecurityLoaderIfIdle, 180);
          } catch(_){}
        }

        function setDeviceStatus(type, message){
          if (!state.refs || !state.refs.deviceStatus) return;
          state.refs.deviceStatus.className = "security-status" + (type ? (" " + type) : "");
          state.refs.deviceStatus.textContent = message || "";
        }

        function setDevicesLoading(on){
          state.devicesLoading = !!on;
          if (!state.refs) return;
          if (state.refs.logoutAllBtn) state.refs.logoutAllBtn.disabled = on || !state.currentUser;
          if (state.refs.deviceList) {
            var deviceButtons = state.refs.deviceList.querySelectorAll("button[data-device-id]");
            for (var i = 0; i < deviceButtons.length; i++) {
              deviceButtons[i].disabled = !!on;
            }
          }
        }

        function formatDeviceDate(value){
          if (!value) return "";
          var ms = Date.parse(value);
          if (!isFinite(ms)) return value;
          try {
            return new Date(ms).toLocaleString("ar");
          } catch(_){
            return new Date(ms).toISOString().replace("T"," ").slice(0,19);
          }
        }

        function formatDeviceLabel(dev){
          var source = dev || {};
          var rawLabel = String(source.label || "").trim();
          var userAgent = String(source.userAgent || "").trim();
          var rawPlatform = String(source.platform || "").trim();
          var text = (rawLabel + " " + rawPlatform + " " + userAgent).toLowerCase();
          var platform = /android/.test(text) ? "Android"
            : /iphone/.test(text) ? "iPhone"
            : /ipad/.test(text) ? "iPad"
            : /ipod|ios/.test(text) ? "iOS"
            : /windows|win32|win64/.test(text) ? "Windows"
            : /mac os|macos|macintosh/.test(text) ? "macOS"
            : /linux|x11/.test(text) ? "Linux"
            : rawPlatform;
          var browser = /brave/.test(text) ? "Brave"
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
          return [platform, browser].filter(Boolean).join(" - ").trim() || rawLabel || rawPlatform || "جهاز غير معروف";
        }

        function formatDeviceApproxLocation(dev){
          var source = dev || {};
          var label = String(source.locationLabel || source.location || "").trim();
          if (label) return label;
          var city = String(source.locationCity || "").trim();
          var region = String(source.locationRegion || "").trim();
          var country = String(source.locationCountry || source.locationCountryCode || "").trim();
          return [city, region, country].filter(Boolean).join("طإ’ ").trim();
        }

        function renderDevices(){
          if (!state.refs || !state.refs.deviceList) return;
          var list = Array.isArray(state.devices) ? state.devices : [];
          var currentId = "";
          try { currentId = getDeviceId(); } catch(_){ currentId = ""; }
          state.refs.deviceList.innerHTML = "";
          if (!list.length){
            state.refs.deviceList.innerHTML = '<div class="device-empty">لا توجد أجهزة مسجلة بعد.</div>';
            return;
          }
          list.forEach(function(dev){
            if (!dev || !dev.deviceId) return;
            var card = document.createElement("div");
            card.className = "device-card";
            var meta = document.createElement("div");
            meta.className = "device-meta";
            var name = document.createElement("div");
            name.className = "device-name";
            name.textContent = formatDeviceLabel(dev);
            var sub = document.createElement("div");
            sub.className = "device-sub";
            var timeLabel = dev.lastSeenISO || dev.createdAtISO || "";
            sub.textContent = timeLabel ? ("آخر نشاط: " + formatDeviceDate(timeLabel)) : "أ¢â‚¬â€‌";
            var locationSub = null;
            var locationLabel = formatDeviceApproxLocation(dev);
            if (locationLabel) {
              locationSub = document.createElement("div");
              locationSub.className = "device-sub";
              locationSub.textContent = "الموقع التقريبي: " + locationLabel;
            }
            var tags = document.createElement("div");
            tags.className = "device-tags";
            if (dev.deviceId === currentId) {
              var currentTag = document.createElement("span");
              currentTag.className = "device-tag current";
              currentTag.textContent = "هذا الجهاز";
              tags.appendChild(currentTag);
            }
            if (dev.revoked) {
              var revokedTag = document.createElement("span");
              revokedTag.className = "device-tag revoked";
              revokedTag.textContent = "تم تسجيل الخروج";
              tags.appendChild(revokedTag);
            }
            if (dev.sessionLast4) {
              var keyTag = document.createElement("span");
              keyTag.className = "device-tag";
              keyTag.textContent = "رمز: ****" + dev.sessionLast4;
              tags.appendChild(keyTag);
            }
            meta.appendChild(name);
            meta.appendChild(sub);
            if (locationSub) meta.appendChild(locationSub);
            meta.appendChild(tags);

            var actions = document.createElement("div");
            actions.className = "device-actions";
            if (!dev.revoked) {
              var logoutBtn = document.createElement("button");
              logoutBtn.type = "button";
              logoutBtn.className = "device-btn logout";
              logoutBtn.textContent = "تسجيل خروج";
              logoutBtn.dataset.deviceId = dev.deviceId;
              if (state.devicesLoading) logoutBtn.disabled = true;
              actions.appendChild(logoutBtn);
            } else {
              var disabledBtn = document.createElement("button");
              disabledBtn.type = "button";
              disabledBtn.className = "device-btn ghost";
              disabledBtn.textContent = "غير نشط";
              disabledBtn.disabled = true;
              actions.appendChild(disabledBtn);
            }
            card.appendChild(meta);
            card.appendChild(actions);
            state.refs.deviceList.appendChild(card);
          });
        }

        function markDeviceRevoked(deviceId){
          if (!deviceId) return false;
          var list = Array.isArray(state.devices) ? state.devices : [];
          var changed = false;
          var nextList = list.map(function(dev){
            if (!dev || dev.deviceId !== deviceId) return dev;
            changed = true;
            var next = Object.assign({}, dev);
            next.revoked = true;
            if (!next.revokedAtISO) next.revokedAtISO = new Date().toISOString();
            return next;
          });
          if (changed) {
            state.devices = nextList;
            renderDevices();
          }
          return changed;
        }

        function fetchDevices(){
          state.devices = [];
          renderDevices();
          setDeviceStatus("", "");
          setDevicesLoading(false);
          forceHideSecurityLoaderIfIdle();
        }

        function handleLogoutAll(){
          if (state.devicesLoading) return;
          if (!state.currentUser){
            setDeviceStatus("info", "سجّل الدخول أولاً.");
            return;
          }
          if (!confirm("سيتم تسجيل الخروج من كل الحسابات عبر تغيير رمز الجلسة. هل أنت متأكد؟")) return;
          setDevicesLoading(true);
          setDeviceStatus("info", "جاري تسجيل الخروج من كل الحسابات...");
          callAuth("logout_all_accounts", { sessionKey: readSessionKey() })
            .then(function(){
              if (typeof window.performClientLogout === "function") {
                window.performClientLogout();
              } else {
                window.location.reload();
              }
            })
            .catch(function(){
              setDeviceStatus("error", "تعذر تسجيل الخروج من كل الحسابات.");
            })
            .finally(function(){ setDevicesLoading(false); });
        }

        function handleLogoutDevice(deviceId){
          if (!deviceId || state.devicesLoading) return;
          if (!confirm("هل تريد تسجيل الخروج من هذا الجهاز؟")) return;
          setDevicesLoading(true);
          setDeviceStatus("info", "جاري تسجيل الخروج من الجهاز...");
          callAuth("device_logout", { deviceId: deviceId })
            .then(function(){
              var currentId = "";
              try { currentId = getDeviceId(); } catch(_){}
              if (deviceId === currentId) {
                if (typeof window.performClientLogout === "function") {
                  window.performClientLogout();
                } else {
                  window.location.reload();
                }
                return;
              }
              markDeviceRevoked(deviceId);
              setDeviceStatus("success", "تم تسجيل الخروج من الجهاز.");
            })
            .catch(function(){
              setDeviceStatus("error", "تعذر تسجيل الخروج من الجهاز.");
            })
            .finally(function(){ setDevicesLoading(false); });
        }

        function updateBadge(enabled){
          if (!state.refs || !state.refs.badge) return;
          state.refs.badge.textContent = enabled ? "مفعل" : "غير مفعل";
          state.refs.badge.classList.toggle("active", !!enabled);
        }

        function updateQrAndSecret(secret){
          if (!state.refs) return;
          var cleanSecret = String(secret || "").replace(/\s+/g, "");
          if (state.refs.secret) state.refs.secret.textContent = groupSecret(cleanSecret);
          renderSecurityQr(cleanSecret ? buildOtpAuthUrl(cleanSecret) : "");
        }

        function setSecurityElementHidden(el, hidden){
          if (!el) return;
          if (hidden) {
            try { el.setAttribute("aria-hidden", "true"); } catch(_){}
            try { el.hidden = true; } catch(_){}
            try { el.style.setProperty("display", "none", "important"); } catch(_){}
            return;
          }
          try { el.hidden = false; } catch(_){}
          try { el.removeAttribute("hidden"); } catch(_){}
          try { el.removeAttribute("aria-hidden"); } catch(_){}
          try { el.style.removeProperty("display"); } catch(_){}
        }

        function syncSecurityEnabledOnlyView(){
          if (!state.refs) return;
          var enabled = !!(state.currentUser && state.enabled);
          if (state.root) state.root.setAttribute("data-security-enabled", enabled ? "true" : "false");
          var primaryCard = state.root && state.root.querySelector ? state.root.querySelector(".security-card:not(.security-devices-card)") : null;
          var header = state.root && state.root.querySelector ? state.root.querySelector(".security-header") : null;
          var headerMeta = state.root && state.root.querySelector ? state.root.querySelector(".security-header-meta") : null;
          var spacer = state.root && state.root.querySelector ? state.root.querySelector(".security-spacer") : null;
          var disableActions = state.refs.disableBtn && state.refs.disableBtn.closest ? state.refs.disableBtn.closest(".security-actions") : null;
          setSecurityElementHidden(spacer, enabled);
          setSecurityElementHidden(header, enabled);
          setSecurityElementHidden(headerMeta, enabled);
          setSecurityElementHidden(state.refs.badge, enabled);
          setSecurityElementHidden(state.refs.openMethodModalBtn, enabled);
          setSecurityElementHidden(state.refs.status, enabled);
          setSecurityElementHidden(state.refs.disableMethodHint, enabled);
          if (enabled) {
            if (primaryCard) primaryCard.style.setProperty("display", "contents", "important");
            if (state.refs.enabledBox) state.refs.enabledBox.style.setProperty("display", "contents", "important");
            if (disableActions) {
              disableActions.style.setProperty("width", "min(100%, 420px)", "important");
              disableActions.style.setProperty("margin", "24px auto 0", "important");
            }
            if (state.refs.enableMethodHint) state.refs.enableMethodHint.style.setProperty("display", "none", "important");
            if (state.refs.telegramTools) state.refs.telegramTools.style.setProperty("display", "none", "important");
            if (state.refs.appDetails) state.refs.appDetails.style.setProperty("display", "none", "important");
            if (state.refs.otpWrap) state.refs.otpWrap.style.setProperty("display", "none", "important");
            if (state.refs.enableBtn && state.refs.enableBtn.parentElement) {
              state.refs.enableBtn.parentElement.style.setProperty("display", "none", "important");
            }
          } else {
            if (primaryCard) primaryCard.style.removeProperty("display");
            if (state.refs.enabledBox) state.refs.enabledBox.style.removeProperty("display");
            if (disableActions) {
              disableActions.style.removeProperty("width");
              disableActions.style.removeProperty("margin");
            }
          }
        }

        function updateUiLoggedOut(){
          updateBadge(false);
          if (!state.refs) return;
          state.configLoading = false;
          try { window.__SECURITY_CONFIG_LOADING__ = false; } catch (_) {}
          closeMethodModal();
          closeEmailCodeModal();
          if (state.refs.setup) state.refs.setup.style.display = "block";
          if (state.refs.enabledBox) state.refs.enabledBox.style.display = "none";
          if (state.refs.otp) state.refs.otp.value = "";
          if (state.refs.qr){
            try {
              if (window.Za3emQr && typeof window.Za3emQr.clearQrTarget === "function") {
                window.Za3emQr.clearQrTarget(state.refs.qr);
              } else {
                state.refs.qr.innerHTML = "";
              }
            } catch(_){}
          }
          state.enableMethod = "";
          state.disableMethod = "";
          state.enabledVia = "";
          clearSecurityCodeState("enable");
          clearSecurityCodeState("disable");
          state.enableEmailCooldownUntilMs = 0;
          state.disableEmailCooldownUntilMs = 0;
          state.linkedTelegramId = "";
          state.methodModalAutoPromptPending = true;
          if (state.refs.openMethodModalBtn) state.refs.openMethodModalBtn.style.display = "inline-flex";
          stopEmailCooldownTimer();
          setEnableMethod("");
          setDisableMethod("");
          renderSecurityTelegramBotLink();
          if (state.refs.telegramUserIdInput) state.refs.telegramUserIdInput.value = "";
          updateQrAndSecret("---- ---- ----");
          setStatus("info", "سجّل الدخول لتفعيل حماية الحساب.");
          setLoading(true);
          setConfigReady(true);
          state.bootLoaderHeld = false;
          try {
            if (typeof window.__releasePageLoader === "function") {
              window.__releasePageLoader();
            } else if (typeof hidePageLoader === "function") {
              hidePageLoader();
            }
          } catch(_){}
          renderEmailRequestButtons();
          state.devices = [];
          renderDevices();
          setDeviceStatus("info", "سجّل الدخول لعرض الأجهزة.");
          setDevicesLoading(false);
          syncSecurityEnabledOnlyView();
        }

        function updateUi(){
          if (!state.refs) return;
          if (!state.currentUser){
            updateUiLoggedOut();
            return;
          }
          updateBadge(state.enabled);
          setLoading(false);
          if (state.enabled){
            if (state.refs.setup) state.refs.setup.style.display = "none";
            if (state.refs.enabledBox) state.refs.enabledBox.style.display = "block";
            if (state.refs.openMethodModalBtn) state.refs.openMethodModalBtn.style.display = "none";
            if (state.refs.otp) state.refs.otp.value = "";
            closeMethodModal();
            closeEmailCodeModal();
            state.enableMethod = "";
            clearSecurityCodeState("enable");
            clearSecurityCodeState("disable");
            setEnableMethod("");
            if (state.enabledVia === "telegram") setDisableMethod("telegram");
            else setDisableMethod("app");
            setStatus("success", "تم تفعيل التحقق بخطوتين لهذا الحساب.");
          } else {
            if (state.refs.setup) state.refs.setup.style.display = "block";
            if (state.refs.enabledBox) state.refs.enabledBox.style.display = "none";
            if (state.refs.openMethodModalBtn) state.refs.openMethodModalBtn.style.display = "inline-flex";
            state.enabledVia = "";
            state.disableMethod = "";
            clearSecurityCodeState("disable");
            setDisableMethod("");
            if (!state.enableMethod) setEnableMethod("");
            var pending = ensurePendingSecret();
            updateQrAndSecret(pending);
            setStatus("info", "");
            maybeAutoOpenMethodModal();
          }
          syncSecurityEnabledOnlyView();
          setConfigReady(true);
        }

        function fetchRemoteConfig(uid){
          if (!uid) return Promise.resolve(null);
          return callAuth("totp_status", { uid: uid })
            .then(function(res){ return res || null; });
        }

        function saveRemoteConfig(uid, enabled, secret, code, method, telegramUserId){
          if (!uid) return Promise.resolve();
          var normalizedMethod = (method === "app" || method === "telegram") ? method : "";
          var payload = { uid: uid, code: code };
          if (normalizedMethod) {
            payload.method = normalizedMethod;
            payload.enabledVia = normalizedMethod;
            payload.preferredFactor = normalizedMethod;
          }
          if (normalizedMethod === "telegram") payload.telegramCode = code;
          if (normalizedMethod === "telegram" && telegramUserId) payload.telegramUserId = normalizeTelegramTargetId(telegramUserId);
          if (normalizedMethod === "app") payload.totpCode = code;
          if (enabled) {
            if (normalizedMethod === "app") payload.secret = secret;
            return callAuth("totp_enable", payload);
          }
          return callAuth("totp_disable", payload);
        }

        function requestSecurityTelegramCode(purpose, telegramUserId){
          if (!state.currentUser) return Promise.reject(createError("auth_required", "سجّل الدخول أولاً."));
          var normalizedPurpose = String(purpose || "").trim() || "login";
          var payload = { purpose: normalizedPurpose };
          var cleanTelegramId = normalizeTelegramTargetId(telegramUserId || "");
          if (cleanTelegramId) payload.telegramUserId = cleanTelegramId;
          return callAuth("telegram_otp_request", payload);
        }

        function loadConfig(options){
          var opts = options && typeof options === "object" ? options : {};
          var force = !!opts.force;
          var user = state.currentUser;
          if (!user){ updateUiLoggedOut(); return Promise.resolve(false); }
          var uid = String(user.uid || "");
          if (!force && state.lastConfigUid === uid && state.lastConfigLoadedAt && (Date.now() - state.lastConfigLoadedAt) < 5000) {
            try { setConfigReady(true); } catch(_){}
            try { setConfigLoading(false); } catch(_){}
            try { releaseSecurityBootLoader(); } catch(_){}
            try { forceHideSecurityLoaderIfIdle(); } catch(_){}
            return Promise.resolve(true);
          }
          if (state.configLoading) return state.configPromise || Promise.resolve(false);
          clearSecurityAuthResponsePrefix('totp_status', uid);
          clearSecurityAuthResponsePrefix('telegram_link_status', uid);
          var requestToken = (Number(state.configRequestToken) || 0) + 1;
          state.configRequestToken = requestToken;
          renderSecurityTelegramBotLink();
          refreshSecurityTelegramLinkState(true);
          var local = loadLocalConfig(uid);
          setConfigLoading(true, "جاري تحميل إعدادات الحماية...");
          releaseSecurityBootLoader();
          setStatus("info", "جاري تحميل إعدادات الحماية...");
          var requestPromise = fetchRemoteConfig(uid).then(function(remote){
            if (requestToken !== state.configRequestToken) return;
            if (remote){
              state.enabled = !!remote.enabled;
              state.secret = remote.secret || "";
              var resolvedVia = normalizeTotpEnabledVia(remote.enabledVia || remote.preferredFactor);
              if (!resolvedVia) {
                var factors = Array.isArray(remote.factors) ? remote.factors.map(function(item){
                  return String(item || "").trim().toLowerCase();
                }) : [];
                var hasApp = factors.indexOf("totp") >= 0 || factors.indexOf("app") >= 0;
                var hasTelegram = factors.indexOf("telegram") >= 0;
                if (hasTelegram && !hasApp) resolvedVia = "telegram";
                else if (hasApp && !hasTelegram) resolvedVia = "app";
              }
              state.enabledVia = resolvedVia;
              if (state.enabled){
                saveLocalConfig(uid, true, state.secret || "");
              }
            } else {
              state.enabled = !!local.enabled;
              state.secret = local.secret || "";
              state.enabledVia = "";
            }
          }).catch(function(){
            if (requestToken !== state.configRequestToken) return;
            state.enabled = !!local.enabled;
            state.secret = local.secret || "";
            state.enabledVia = "";
          }).finally(function(){
            if (requestToken !== state.configRequestToken) return;
            if (!state.enabled) {
              state.secret = "";
              state.enabledVia = "";
            }
            state.lastConfigUid = uid;
            state.lastConfigLoadedAt = Date.now();
            updateUi();
            setConfigLoading(false);
            try{ setTimeout(maybeAutoOpenMethodModal, 0); }catch(_){}
            fetchDevices();
            forceHideSecurityLoaderIfIdle();
            if (state.configPromise === requestPromise) state.configPromise = null;
          });
          state.configPromise = requestPromise;
          return requestPromise;
        }

        function handleCopy(){
          var secret = state.enabled ? state.secret : (state.pendingSecret || "");
          if (!secret) return;
          var text = secret.replace(/\s+/g, "");
          if (navigator.clipboard && navigator.clipboard.writeText){
            navigator.clipboard.writeText(text).then(function(){
              setStatus("success", "تم نسخ المفتاح.");
            }).catch(function(){
              setStatus("error", "تعذر نسخ المفتاح.");
            });
          } else {
            setStatus("error", "تعذر نسخ المفتاح.");
          }
        }

        function handleEnable(){
          if (state.loading) return;
          var user = state.currentUser;
          if (!user){
            setStatus("", "");
            showAlert("سجّل الدخول أولاً.");
            return;
          }
          if (!state.enableMethod){
            setStatus("", "");
            showAlert("اختر طريقة التحقق أولًا (التطبيق أو تيليغرام).");
            return;
          }
          if (isSecurityCodeDeliveryMethod(state.enableMethod) && !getEnableCodeRequested(state.enableMethod)){
            setStatus("", "");
            showAlert("اضغط زر إرسال الرمز ثم أكمل التفعيل.");
            return;
          }
          var code = normalizeCodeValue(state.refs.otp && state.refs.otp.value || "");
          if (state.refs.otp) state.refs.otp.value = code;
          if (state.enableMethod === "telegram" && !/^\d{6}$/.test(code)){
            setStatus("", "");
            showAlert("أدخل رمز تيليغرام المكوّن من 6 أرقام.");
            try { if (state.refs && state.refs.otp) state.refs.otp.focus(); } catch(_){}
            return;
          }
          if (!/^\d{6}$/.test(code)){
            setStatus("", "");
            showAlert("أدخل رمز تحقق من 6 أرقام.");
            return;
          }
          var attemptScope = "security-enable-attempt:" + state.enableMethod + ":" + String(user.uid || "");
          var blockedFor = window.__siteOtpLimits
            ? window.__siteOtpLimits.getAttemptRemaining(attemptScope, state.enableMethod === "telegram" ? 3 : 5)
            : 0;
          if (blockedFor > 0) {
            setStatus("", "");
            showAlert("انتهت محاولات إدخال الرمز. حاول بعد " + window.__siteOtpLimits.format(blockedFor) + ".");
            return;
          }
          if (window.__siteOtpLimits) window.__siteOtpLimits.markAttempt(attemptScope);
          var secret = state.enableMethod === "app" ? ensurePendingSecret() : "";
          var telegramTargetId = state.enableMethod === "telegram" ? getSecurityTelegramTargetId() : "";
          if (state.enableMethod === "telegram" && !telegramTargetId){
            setStatus("", "");
            showAlert("أدخل Telegram ID الذي سيستقبل الرمز أولًا.");
            try { if (state.refs && state.refs.telegramUserIdInput) state.refs.telegramUserIdInput.focus(); } catch(_){}
            return;
          }
          if (state.enableMethod === "app" && !secret){
            setStatus("", "");
            showAlert("تعذر إنشاء مفتاح الحماية.");
            return;
          }
          setLoading(true);
          setStatus("info", state.enableMethod === "telegram"
            ? "جاري تفعيل الحماية عبر رمز تيليغرام..."
            : "جاري تفعيل الحماية عبر رمز التطبيق...");
          saveRemoteConfig(user.uid, true, secret, code, state.enableMethod, telegramTargetId).then(function(remote){
            if (window.__siteOtpLimits) window.__siteOtpLimits.clearAttempts(attemptScope);
            saveLocalConfig(user.uid, true, state.enableMethod === "app" ? secret : "");
            savePendingSecret(user.uid, "");
            state.enabled = true;
            state.secret = state.enableMethod === "app" ? secret : "";
            state.enabledVia = normalizeTotpEnabledVia(
              (remote && (remote.enabledVia || remote.preferredFactor)) ||
              state.enableMethod
            );
            if (!state.enabledVia) {
              state.enabledVia = state.enableMethod === "telegram" ? "telegram" : "app";
            }
            clearSecurityCodeState("enable");
            state.enableMethod = "";
            updateUi();
            setStatus("success", "تم تفعيل التحقق بخطوتين بنجاح.");
          }).catch(function(err){
            setStatus("", "");
            showAlert(err && err.message ? err.message : "فشل تفعيل الحماية. تأكد من صحة الرمز.");
          }).finally(function(){
            setLoading(false);
          });
        }

        function handleRequestEnableCode(){
          if (state.loading || !state.currentUser || state.enabled) return;
          var method = "telegram";
          if (state.enableMethod !== method) setEnableMethod(method);
          var telegramTargetId = "";
          telegramTargetId = getSecurityTelegramTargetId();
          if (!/^\d{5,20}$/.test(telegramTargetId)) {
            setStatus("", "");
            showAlert("افتح بوت تيليغرام ثم أدخل Telegram ID الرقمي الذي ستصل إليه الأكواد.");
            try { if (state.refs && state.refs.telegramUserIdInput) state.refs.telegramUserIdInput.focus(); } catch(_){}
            return;
          }
          var loaderHeld = false;
          setLoading(true);
          setStatus("", "");
          setGlobalPageLoader(true);
          loaderHeld = true;
          requestSecurityTelegramCode("totp_enable", telegramTargetId).then(function(res){
            var cooldownSeconds = Number(
              (res && (res.resendAfterSeconds ?? res.retryAfterSeconds)) ?? EMAIL_OTP_RESEND_COOLDOWN_SECONDS
            );
            setEnableCodeState(method, true, res && res.to ? String(res.to) : "");
            startEmailCooldown("enable", cooldownSeconds);
            setEnableMethod(method);
            setStatus("success", (res && res.to)
              ? ("تم إرسال رمز تيليغرام إلى " + res.to + ".")
              : "تم إرسال رمز تيليغرام.");
            openEmailCodeModal({ flow: "enable", method: method, target: getEnableCodeTarget(method) || "" });
          }).catch(function(err){
            setStatus("error", err && err.message ? err.message : ("تعذر إرسال رمز " + getSecurityMethodLabel(method) + "."));
          }).finally(function(){
            setLoading(false);
            if (loaderHeld) setGlobalPageLoader(false);
            renderEmailRequestButtons();
          });
        }

        function handleDisableWithCode(codeValue){
          var user = state.currentUser;
          if (!user) return;
          var method = normalizeTotpEnabledVia(state.disableMethod || state.enabledVia || "");
          if (!method) {
            setStatus("", "");
            showAlert("تعذر تحديد طريقة التحقق الحالية.");
            return;
          }
          var code = normalizeCodeValue(codeValue || "");
          if (!/^\d{6}$/.test(code)){
            setStatus("", "");
            showAlert("أدخل رمز تحقق صحيح من 6 أرقام.");
            return;
          }
          if (!confirm("هل تريد إلغاء المصادقة الثنائية لهذا الحساب؟")) return;
          setLoading(true);
          setStatus("info", method === "telegram"
            ? "جاري إلغاء المصادقة عبر رمز تيليغرام..."
            : "جاري إلغاء المصادقة عبر رمز التطبيق...");
          saveRemoteConfig(user.uid, false, "", code, method).then(function(){
            if (window.__siteOtpLimits) {
              window.__siteOtpLimits.clearAttempts("security-code-attempt:disable:" + method + ":" + String(user.uid || ""));
            }
            saveLocalConfig(user.uid, false, "");
            state.enabled = false;
            state.enabledVia = "";
            state.secret = "";
            state.pendingSecret = "";
            clearSecurityCodeState("disable");
            state.disableMethod = "";
            ensurePendingSecret();
            updateUi();
            setStatus("success", "تم إلغاء المصادقة الثنائية بنجاح.");
          }).catch(function(err){
            setStatus("", "");
            showAlert(err && err.message ? err.message : "تعذر إلغاء المصادقة. تأكد من صحة الرمز.");
          }).finally(function(){
            setLoading(false);
          });
        }

        function handleDisable(){
          if (state.loading) return;
          var user = state.currentUser;
          if (!user || !state.enabled) return;
          var method = normalizeTotpEnabledVia(state.enabledVia || state.disableMethod || "");
          if (!method) method = "app";
          setDisableMethod(method);

          if (isSecurityCodeDeliveryMethod(method)) {
            var shouldOpenModal = false;
            var loaderHeld = false;
            setLoading(true);
            setStatus("", "");
            setGlobalPageLoader(true);
            loaderHeld = true;
            requestSecurityTelegramCode("totp_disable").then(function(res){
              var cooldownSeconds = Number(
                (res && (res.resendAfterSeconds ?? res.retryAfterSeconds)) ?? EMAIL_OTP_RESEND_COOLDOWN_SECONDS
              );
              setDisableCodeState(method, true, res && res.to ? String(res.to) : "");
              startEmailCooldown("disable", cooldownSeconds);
              setStatus("", "");
              shouldOpenModal = true;
            }).catch(function(err){
              setStatus("error", err && err.message ? err.message : ("تعذر إرسال رمز " + getSecurityMethodLabel(method) + "."));
            }).finally(function(){
              setLoading(false);
              if (loaderHeld) setGlobalPageLoader(false);
              renderEmailRequestButtons();
              if (shouldOpenModal) {
                openEmailCodeModal({ flow: "disable", method: method, target: getDisableCodeTarget(method) || "" });
              }
            });
            return;
          }

          openEmailCodeModal({ flow: "disable", method: "app" });
        }

        function bindEvents(){
          if (!state.refs) return;
          if (state.refs.copyBtn) state.refs.copyBtn.addEventListener("click", handleCopy);
          if (state.refs.enableBtn) state.refs.enableBtn.addEventListener("click", handleEnable);
          if (state.refs.enableRequestBtn) state.refs.enableRequestBtn.addEventListener("click", handleRequestEnableCode);
          if (state.refs.openMethodModalBtn) state.refs.openMethodModalBtn.addEventListener("click", openMethodModal);
          if (state.refs.enableMethodApp) {
            state.refs.enableMethodApp.addEventListener("click", function(){ chooseEnableMethod("app"); });
          }
          if (state.refs.enableMethodTelegram) {
            state.refs.enableMethodTelegram.addEventListener("click", function(){ chooseEnableMethod("telegram"); });
          }
          if (state.refs.telegramOpenBotBtn) {
            state.refs.telegramOpenBotBtn.addEventListener("click", function(evt){
              if (!state.botLink || state.loading) {
                evt.preventDefault();
              }
            });
          }
          if (state.refs.telegramUserIdInput) {
            state.refs.telegramUserIdInput.addEventListener("input", function(){
              var cleaned = normalizeTelegramTargetId(this.value);
              if (cleaned !== this.value) this.value = cleaned;
              syncEnableRequestButtonVisibility();
              if (state.enableMethod === "telegram" && state.enableTelegramRequested) {
                setEnableCodeState("telegram", false, "");
                setEnableMethod("telegram");
              } else {
                renderEmailRequestButtons();
              }
            });
          }
          if (state.refs.disableBtn) state.refs.disableBtn.addEventListener("click", handleDisable);
          if (state.refs.otp) {
            state.refs.otp.addEventListener("input", function(){
              this.value = normalizeCodeValue(this.value);
            });
          }
          if (state.refs.logoutAllBtn) state.refs.logoutAllBtn.addEventListener("click", handleLogoutAll);
          if (state.refs.alertOk) state.refs.alertOk.addEventListener("click", closeAlert);
          if (state.refs.alertClose) state.refs.alertClose.addEventListener("click", closeAlert);
          if (state.refs.alertModal){
            state.refs.alertModal.addEventListener("click", function(evt){
              if (evt.target === state.refs.alertModal) closeAlert();
            });
          }
          if (state.refs.emailCodeSubmit) state.refs.emailCodeSubmit.addEventListener("click", submitEmailCodeModal);
          if (state.refs.emailCodeResend) state.refs.emailCodeResend.addEventListener("click", handleEmailCodeResend);
          if (state.refs.emailCodeCancel) state.refs.emailCodeCancel.addEventListener("click", closeEmailCodeModal);
          if (state.refs.emailCodeClose) state.refs.emailCodeClose.addEventListener("click", closeEmailCodeModal);
          if (state.refs.emailCodeModal){
            state.refs.emailCodeModal.addEventListener("click", function(evt){
              if (evt.target === state.refs.emailCodeModal) closeEmailCodeModal();
            });
          }
          if (state.refs.emailCodeInput){
            state.refs.emailCodeInput.addEventListener("input", function(){
              var cleaned = normalizeCodeValue(this.value);
              if (cleaned !== this.value) this.value = cleaned;
              if (state.refs && state.refs.emailCodeError) {
                state.refs.emailCodeError.style.color = "var(--danger)";
                state.refs.emailCodeError.textContent = "";
              }
            });
            state.refs.emailCodeInput.addEventListener("keydown", function(evt){
              if (evt.key === "Enter"){
                evt.preventDefault();
                submitEmailCodeModal();
              }
            });
          }
          if (state.refs.deviceList) {
            state.refs.deviceList.addEventListener("click", function(event){
              var target = event.target;
              if (!target) return;
              var btn = target.closest ? target.closest("button[data-device-id]") : null;
              if (!btn) return;
              var deviceId = btn.getAttribute("data-device-id") || "";
              if (deviceId) handleLogoutDevice(deviceId);
            });
          }
          document.addEventListener("keydown", function(evt){
            if (evt.key !== "Escape") return;
            if (state.refs && state.refs.alertModal && !state.refs.alertModal.classList.contains("hidden")) {
              closeAlert();
            }
            if (state.refs && state.refs.emailCodeModal && !state.refs.emailCodeModal.classList.contains("hidden")) {
              closeEmailCodeModal();
            }
          });
        }

        function ensureRoot(){
          if (state.root) return state.root;
          var root = document.createElement("div");
          root.className = "security-page";
          root.setAttribute("data-config-ready", "false");
          root.innerHTML = [
            '<div class="security-spacer" aria-hidden="true"></div>',
            '<main class="security-card">',
            '  <div class="security-header">',
            '    <div>',
            '      <h2>حماية الحساب</h2>',
            '      <p>بعد التفعيل راح يطلب منك كود بكل مره تحاول تسجل فيها</p>',
            '    </div>',
            '    <div class="security-header-meta">',
            '      <span id="securityBadge" class="security-badge">غير مفعل</span>',
            '      <button id="securityOpenMethodModalBtn" type="button" class="security-method-switch">تبديل</button>',
            '    </div>',
            '  </div>',
            '  <div id="securityStatus" class="security-status info"></div>',
            '  <div id="securitySetup">',
            '    <div id="securityEnableMethodHint" class="security-method-hint" style="display:none;"></div>',
            '    <div id="securityTelegramTools" class="security-telegram-tools" style="display:none;">',
            '      <label class="security-input security-telegram-id-wrap">',
            '        <span>معرّف تيليغرام</span>',
            '        <input id="securityTelegramUserIdInput" type="tel" inputmode="numeric" autocomplete="off" spellcheck="false" maxlength="20" placeholder="123456789" />',
            '      </label>',
            '      <div class="security-telegram-actions">',
            '        <a id="securityTelegramOpenBotBtn" class="security-btn ghost neutral security-telegram-open-btn is-disabled" href="#" target="_blank" rel="noopener noreferrer" aria-disabled="true"><i class="fa-brands fa-telegram"></i> فتح بوت تيليغرام</a>',
            '        <button id="securityEnableRequestBtn" type="button" class="security-btn ghost neutral security-request-btn" style="display:none;">طلب رمز تحقق</button>',
            '      </div>',
            '    </div>',
            '    <div id="securityAppDetails" class="security-app-details" style="display:none;">',
            '      <ol class="security-steps">',
            '        <li>تنزيل تطبيق <strong>Google Authenticator</strong> على هاتفك (Android أو iOS).</li>',
            '        <li>افتح التطبيق ثم امسح رمز <strong>QR</strong> التالي.</li>',
            '        <li>أدخل رمز التطبيق في الحقل بالأسفل ثم فعّل الحماية.</li>',
            '      </ol>',
            '      <div class="security-qr-box"><div id="securityQr" class="security-qr-art" role="img" aria-label="QR Code"></div></div>',
            '      <div class="security-secret">',
            '        <button id="securityCopy" type="button" class="copy-btn"><i class="fa-regular fa-copy"></i> نسخ</button>',
            '        <span id="securitySecret">----</span>',
            '      </div>',
            '    </div>',
            '    <label id="securityOtpWrap" class="security-input security-code-wrap" style="display:none;">',
            '      <span id="securityOtpLabel">رمز التحقق</span>',
            '      <input id="securityOtp" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="123456" />',
            '    </label>',
            '    <div class="security-actions">',
            '      <button id="securityEnableBtn" type="button" class="security-btn">تفعيل التحقق بخطوتين</button>',
            '    </div>',
            '  </div>',
            '  <div id="securityEnabled" class="security-enabled">',
            '    <div id="securityDisableMethodHint" class="security-method-hint" style="margin-top:14px;">سيُطلب رمز التحقق حسب طريقة التفعيل.</div>',
            '    <div class="security-actions" style="margin-top:12px;">',
            '      <button id="securityDisableBtn" type="button" class="security-btn ghost">إلغاء المصادقة</button>',
            '    </div>',
            '  </div>',
            '</main>',
            '<main class="security-card security-devices-card">',
            '  <div id="securityDevicesSection" class="security-devices security-logout-all">',
            '    <h3>تسجيل الخروج من كل الحسابات</h3>',
            '    <div class="device-toolbar">',
            '      <button id="logoutAllDevices" type="button" class="security-btn ghost">تسجيل الخروج من كل الحسابات</button>',
            '    </div>',
            '    <div id="deviceStatus" class="security-status info"></div>',
            '    <div id="deviceList" class="device-list" hidden></div>',
            '  </div>',
            '</main>',
            '  <div id="securityAlertModal" class="modal hidden" role="dialog" aria-modal="true" aria-labelledby="securityAlertTitle">',
            '    <div class="modal-content security-modal">',
            '      <button class="security-close" id="securityAlertClose" type="button" aria-label="إغلاق">&times;</button>',
            '      <h3 id="securityAlertTitle">تنبيه</h3>',
            '      <p class="security-message" id="securityAlertMessage"></p>',
            '      <button class="security-btn" id="securityAlertOk" type="button">حسنًا</button>',
            '    </div>',
            '  </div>',
            '  <div id="securityEmailCodeModal" class="modal hidden" role="dialog" aria-modal="true" aria-labelledby="securityEmailCodeTitle">',
            '    <div class="modal-content security-code-modal">',
            '      <button class="security-close" id="securityEmailCodeClose" type="button" aria-label="إغلاق">&times;</button>',
            '      <h3 id="securityEmailCodeTitle" class="security-code-title">أدخل رمز التحقق</h3>',
            '      <p id="securityEmailCodeSubtitle" class="security-code-subtitle">تم إرسال الرمز إلى تيليغرام.</p>',
            '      <input id="securityEmailCodeInput" class="security-code-input" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="123456" />',
            '      <p id="securityEmailCodeError" class="security-code-error"></p>',
            '      <div class="security-code-actions">',
            '        <button id="securityEmailCodeSubmit" type="button" class="security-btn">تأكيد</button>',
            '        <button id="securityEmailCodeResend" type="button" class="security-btn ghost neutral security-resend-btn">إعادة إرسال الرمز</button>',
            '      </div>',
            '    </div>',
            '  </div>',
            '  <div id="securityMethodModal" class="modal hidden" role="dialog" aria-modal="true" aria-label="اختر طريقة التحقق" aria-hidden="true">',
            '    <div class="modal-content security-method-modal" role="document">',
            '      <div class="security-methods security-methods-top" id="securityEnableMethods">',
            '        <button id="securityEnableMethodApp" type="button" class="security-method-btn security-method-btn-app">',
            '          <img class="security-method-icon" src="https://i.ibb.co/r2WN4gQY/4.png" alt="Google Authenticator" loading="lazy" decoding="async" />',
            '          <span class="security-method-copy"><strong>Google Authenticator</strong></span>',
            '        </button>',
            '        <button id="securityEnableMethodTelegram" type="button" class="security-method-btn">',
            '          <img class="security-method-icon" src="https://cdn.qrcode-ai.com/utils/logos/telegram.png" alt="Telegram verification" loading="lazy" decoding="async" />',
            '          <span class="security-method-copy"><strong>التحقق باستخدام تلغرام</strong></span>',
            '        </button>',
            '      </div>',
            '    </div>',
            '  </div>'
          ].join("");
          try { queueI18nPrewarm(root, { maxItems: 220 }); } catch(_){}
          state.root = root;
          state.refs = {
            badge: root.querySelector("#securityBadge"),
            openMethodModalBtn: root.querySelector("#securityOpenMethodModalBtn"),
            status: root.querySelector("#securityStatus"),
            setup: root.querySelector("#securitySetup"),
            enabledBox: root.querySelector("#securityEnabled"),
            qr: root.querySelector("#securityQr"),
            secret: root.querySelector("#securitySecret"),
            copyBtn: root.querySelector("#securityCopy"),
            appDetails: root.querySelector("#securityAppDetails"),
            otp: root.querySelector("#securityOtp"),
            otpWrap: root.querySelector("#securityOtpWrap"),
            otpLabel: root.querySelector("#securityOtpLabel"),
            enableMethodHint: root.querySelector("#securityEnableMethodHint"),
            methodModal: root.querySelector("#securityMethodModal"),
            telegramTools: root.querySelector("#securityTelegramTools"),
            telegramOpenBotBtn: root.querySelector("#securityTelegramOpenBotBtn"),
            telegramUserIdInput: root.querySelector("#securityTelegramUserIdInput"),
            enableMethodApp: root.querySelector("#securityEnableMethodApp"),
            enableMethodTelegram: root.querySelector("#securityEnableMethodTelegram"),
            enableRequestBtn: root.querySelector("#securityEnableRequestBtn"),
            enableBtn: root.querySelector("#securityEnableBtn"),
            disableBtn: root.querySelector("#securityDisableBtn"),
            disableMethodHint: root.querySelector("#securityDisableMethodHint"),
            deviceList: root.querySelector("#deviceList"),
            deviceStatus: root.querySelector("#deviceStatus"),
            logoutAllBtn: root.querySelector("#logoutAllDevices"),
            alertModal: root.querySelector("#securityAlertModal"),
            alertMessage: root.querySelector("#securityAlertMessage"),
            alertClose: root.querySelector("#securityAlertClose"),
            alertOk: root.querySelector("#securityAlertOk"),
            emailCodeModal: root.querySelector("#securityEmailCodeModal"),
            emailCodeClose: root.querySelector("#securityEmailCodeClose"),
            emailCodeTitle: root.querySelector("#securityEmailCodeTitle"),
            emailCodeSubtitle: root.querySelector("#securityEmailCodeSubtitle"),
            emailCodeInput: root.querySelector("#securityEmailCodeInput"),
            emailCodeError: root.querySelector("#securityEmailCodeError"),
            emailCodeSubmit: root.querySelector("#securityEmailCodeSubmit"),
            emailCodeResend: root.querySelector("#securityEmailCodeResend"),
            emailCodeCancel: root.querySelector("#securityEmailCodeCancel")
          };
          if (state.refs.logoutAllBtn) {
            state.refs.logoutAllBtn.textContent = "تسجيل خروج جميع الاجهزه";
            state.refs.logoutAllBtn.classList.add("security-logout-all-btn");
          }
          root.setAttribute("data-security-method", normalizeTotpEnabledVia(state.enableMethod || "") || "none");
          bindEvents();
          mountSecurityModalsToBody();
          renderSecurityTelegramBotLink();
          renderEnableMethodSummary();
          updateUi();
          return root;
        }

        function mountSecurityModalsToBody(){
          if (!state.refs || !document.body) return;
          var modals = [state.refs.alertModal, state.refs.emailCodeModal, state.refs.methodModal];
          for (var i = 0; i < modals.length; i += 1) {
            var modal = modals[i];
            if (!modal || modal.parentNode === document.body) continue;
            try { document.body.appendChild(modal); } catch(_){}
          }
        }

        function bindAuth(){
          if (state.unsubAuth) return Promise.resolve(true);
          var fb = ensureFirebase();
          if (!fb || !fb.auth){
            if (state.authBindPromise) return state.authBindPromise;
            if (state.refs) {
              setStatus("info", "جاري تجهيز اتصال Firebase...");
              setLoading(true);
            }
            var waitForFirebase = (typeof window.__ensureInlineFirebaseReady === "function")
              ? window.__ensureInlineFirebaseReady({ authOnly: true })
              : Promise.resolve(null);
            state.authBindPromise = waitForFirebase.then(function(){
              state.authBindPromise = null;
              var ready = ensureFirebase();
              if (!ready || !ready.auth){
                state.currentUser = null;
                updateUiLoggedOut();
                return false;
              }
              return bindAuth();
            }).catch(function(){
              state.authBindPromise = null;
              state.currentUser = null;
              updateUiLoggedOut();
              return false;
            });
            return state.authBindPromise;
          }
          state.unsubAuth = fb.auth.onAuthStateChanged(function(user){
            state.currentUser = user || null;
            state.enabled = false;
            state.enabledVia = "";
            state.secret = "";
            state.pendingSecret = "";
            state.enableMethod = "";
            state.disableMethod = "";
            clearSecurityCodeState("enable");
            clearSecurityCodeState("disable");
            state.emailCodeFlow = "";
            state.enableEmailCooldownUntilMs = 0;
            state.disableEmailCooldownUntilMs = 0;
            state.methodModalAutoPromptPending = true;
            stopEmailCooldownTimer();
            if (!isSecurityRouteActive()) {
              releaseSecurityBootLoader();
              return;
            }
            setConfigReady(false);
            loadConfig();
          });
          return Promise.resolve(true);
        }

        function build(){
          var frag = document.createDocumentFragment();
          frag.appendChild(ensureRoot());
          bindAuth();
          return frag;
        }

        function onShow(){
          ensureRoot();
          mountSecurityModalsToBody();
          try {
            if (state.root && state.root.getAttribute("data-config-ready") !== "true") {
              holdSecurityBootLoader();
            }
          } catch(_){
            holdSecurityBootLoader();
          }
          state.methodModalAutoPromptPending = !state.enableMethod;
          renderSecurityTelegramBotLink();
          return Promise.resolve(bindAuth()).then(function(){
            var configReady = Promise.resolve(true);
            if (state.currentUser) {
              holdSecurityBootLoader();
              setConfigReady(false);
              configReady = loadConfig();
            }
            setTimeout(forceHideSecurityLoaderIfIdle, 120);
            setTimeout(forceHideSecurityLoaderIfIdle, 450);
            return Promise.resolve(configReady).catch(function(){ return false; }).then(function(){ return true; });
          });
        }

        function prewarm(){
          try { queueI18nPrewarm(state.root || ensureRoot, { maxItems: 220 }); } catch(_){}
        }

        try { window.__cleanupSecurityRouteTransientState = cleanupSecurityTransientState; } catch(_){}

        return {
          build: build,
          onShow: onShow,
          ready: function(){ return true; },
          prewarm: prewarm
        };
      })();

      var transferRoute = (function(){
        var DEFAULT_BASE = (window.__getSiteWorkerBaseDefault ? window.__getSiteWorkerBaseDefault({ trailingSlash: true }) : (function(){ var base = (window.__getSiteSetting && window.__getSiteSetting("workers.routerBase", "")) || ""; return base ? String(base).replace(/\/+$/, "") + "/" : ""; })());
        var DEFAULT_TURNSTILE_SITEKEY = "0x4AAAAAABmiVmi7wosqeHQT";
        var DAILY_LIMIT = 3;
        var COOLDOWN_MS = 30 * 1000;
        var TRANSFER_FEE = 0.35;

        function resolveTurnstileSiteKey(){
          try{
            var meta = document.querySelector('meta[name="turnstile-sitekey"]');
            var fromMeta = meta && meta.content ? meta.content.trim() : "";
            var fromWindow = (window.TURNSTILE_SITE_KEY || window.__TURNSTILE_SITE_KEY__ || "").trim();
            return fromMeta || fromWindow || DEFAULT_TURNSTILE_SITEKEY;
          }catch(_){
            return DEFAULT_TURNSTILE_SITEKEY;
          }
        }

        var state = {
          root: null,
          refs: null,
          auth: null,
          db: null,
          unsubAuth: null,
          authBindPromise: null,
          currentUser: null,
          profile: null,
          profilePromise: null,
          profileUid: "",
          profileLoadedAt: 0,
          loading: false,
          eventsBound: false,
          balanceListenerBound: false,
          turnstileSiteKey: resolveTurnstileSiteKey(),
          turnstileReady: null,
          turnstileWidgetId: null,
          turnstileToken: "",
          turnstileResolver: null,
          turnstileRejecter: null,
          recipientInfo: null,
          lookupTimer: null,
          transferLimits: null,
          cooldownTimer: null,
          totpEnabled: null,
          totpVia: "",
          totpRequiredPrompted: false,
          totpLoading: false,
          totpCheckedAt: 0,
          totpPromise: null
        };
        var pendingTotpResolve = null;
        var pendingTotpEmailRequest = null;
        var pendingTotpEmailBusy = false;
        var pendingTotpMethod = "";
        var pendingTotpEmailSent = false;
        var pendingTotpEmailSentUntilMs = 0;
        var TOTP_EMAIL_RESEND_COOLDOWN_SECONDS = 5 * 60;
        var totpEmailCooldownUntilMs = 0;
        var totpEmailCooldownTimer = null;

        function getTotpEmailCooldownRemaining(){
          // Frontend resend timer removed: the server is the sole authority for the
          // resend cooldown and returns the retry message itself.
          return 0;
        }

        function hasTransferTotpEmailSent(){
          if (pendingTotpEmailSent) return true;
          if (pendingTotpEmailSentUntilMs > Date.now()) return true;
          if (pendingTotpEmailSentUntilMs > 0) pendingTotpEmailSentUntilMs = 0;
          return false;
        }

        function markTransferTotpEmailSent(expiresInSeconds){
          var sec = Number(expiresInSeconds);
          if (!Number.isFinite(sec) || sec <= 0) sec = 600;
          pendingTotpEmailSent = true;
          pendingTotpEmailSentUntilMs = Date.now() + (Math.trunc(sec) * 1000);
        }

        function stopTotpEmailCooldownTimer(){
          if (!totpEmailCooldownTimer) return;
          try { clearInterval(totpEmailCooldownTimer); } catch(_){}
          totpEmailCooldownTimer = null;
        }

        function setTransferTotpInputVisible(visible){
          var input = state.refs && state.refs.totpInput;
          if (!input) return;
          var wrap = input.closest(".input-group");
          if (wrap) wrap.style.display = visible ? "" : "none";
          input.disabled = !visible;
          if (!visible) input.value = "";
          var confirmBtn = state.refs && state.refs.totpConfirm;
          if (confirmBtn && !state.loading) {
            confirmBtn.disabled = !visible;
          }
        }

        function renderTotpEmailButton(){
          var btn = state.refs && state.refs.totpRequestBtn;
          var errEl = state.refs && state.refs.totpError;
          var remaining = getTotpEmailCooldownRemaining();
          var method = normalizeTotpChallengeMethod(pendingTotpMethod);
          if (errEl) {
            var errText = String(errEl.textContent || "").trim();
            if (/^يمكنك إعادة الإرسال بعد \d+ ثانية\.$/.test(errText) && remaining > 0) {
              errEl.style.color = "var(--muted, #6b7280)";
              errEl.textContent = "يمكنك إعادة الإرسال بعد " + remaining + " ثانية.";
            }
          }
          if (!btn) return;
          var canRequestEmail = !!pendingTotpEmailRequest;
          if (!canRequestEmail) {
            btn.style.display = "none";
            btn.disabled = false;
            btn.innerHTML = getTransferTotpButtonHtml(method || "telegram", false);
            return;
          }
          btn.style.display = "inline-flex";
          if (pendingTotpEmailBusy) {
            btn.disabled = true;
            btn.textContent = "جاري إرسال الرمز...";
            return;
          }
          if (remaining > 0) {
            btn.disabled = true;
            btn.textContent = "إعادة الإرسال بعد " + remaining + " ث";
            return;
          }
          btn.disabled = false;
          btn.innerHTML = getTransferTotpButtonHtml(method, hasTransferTotpEmailSent());
        }

        function ensureTotpEmailCooldownTimer(){
          renderTotpEmailButton();
          if (getTotpEmailCooldownRemaining() <= 0) {
            stopTotpEmailCooldownTimer();
            return;
          }
          if (totpEmailCooldownTimer) return;
          totpEmailCooldownTimer = setInterval(function(){
            renderTotpEmailButton();
            if (getTotpEmailCooldownRemaining() <= 0) stopTotpEmailCooldownTimer();
          }, 1000);
        }

        function startTotpEmailCooldown(){
          // Frontend resend timer removed: no local countdown is started after a send.
          // The server alone decides when a resend is allowed and returns that message.
        }

        function generateGuardToken(prefix){
          var tag = (prefix || "guard");
          try{
            var cryptoSource = null;
            if (typeof window !== "undefined" && window.crypto && typeof window.crypto.getRandomValues === "function"){
              cryptoSource = window.crypto;
            } else if (typeof self !== "undefined" && self.crypto && typeof self.crypto.getRandomValues === "function"){
              cryptoSource = self.crypto;
            }
            if (cryptoSource){
              var buf = new Uint32Array(2);
              cryptoSource.getRandomValues(buf);
              var hex = Array.from(buf).map(function(n){ return n.toString(16).padStart(8,"0"); }).join("");
              return tag + "-" + Date.now().toString(36) + "-" + hex;
            }
          }catch(_){}
          return tag + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
        }

        function copyText(value){
          var text = (value || "").toString();
          if (!text.trim()) return Promise.reject(new Error("empty"));
          if (navigator.clipboard && navigator.clipboard.writeText){
            return navigator.clipboard.writeText(text);
          }
          return new Promise(function(resolve, reject){
            try{
              var ta = document.createElement("textarea");
              ta.value = text;
              ta.style.position = "fixed";
              ta.style.opacity = "0";
              document.body.appendChild(ta);
              ta.focus();
              ta.select();
              var ok = document.execCommand("copy");
              document.body.removeChild(ta);
              if (ok) resolve(); else reject(new Error("copy_failed"));
            }catch(err){ reject(err); }
          });
        }

        function createError(code, message, details){
          var err = new Error(message || code || "transfer_error");
          err.code = code || "transfer_error";
          if (details && typeof details === "object") err.details = details;
          return err;
        }

        function parseNumber(value){
          if (value == null) return 0;
          if (typeof value === "number") return Number(value) || 0;
          if (typeof value === "string"){
            var cleaned = value.replace(/[^\d\-,.]/g, "").replace(/,/g, "");
            var num = Number(cleaned);
            return Number.isFinite(num) ? num : 0;
          }
          return 0;
        }

        function normalizeWebuid(value){
          return (value || "").toString().trim();
        }

        function formatBalance(value){
          var n = Number(value) || 0;
          if (typeof window.formatCurrencyFromJOD === "function"){
            try { return window.formatCurrencyFromJOD(n); } catch(_){}
          }
          try { return n.toFixed(3) + " $"; } catch(_){ return String(n); }
        }

        function escapeTransferHtml(value){
          return String(value == null ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
        }

        function ensureTransferReceiptStyles(){
          if (document.getElementById("transfer-receipt-style")) return;
          var style = document.createElement("style");
          style.id = "transfer-receipt-style";
          style.textContent = [
            ".transfer-modal-backdrop.transfer-receipt-backdrop{align-items:stretch;justify-content:center;background:var(--bg-app,#dcdcdc)!important;color:#202a49;overflow-y:auto;overflow-x:hidden;}",
            "html[data-theme='dark'] .transfer-modal-backdrop.transfer-receipt-backdrop,body.dark-mode .transfer-modal-backdrop.transfer-receipt-backdrop{background:#07090f!important;color:#f5f7ff;}",
            ".transfer-modal.transfer-receipt-modal{width:min(100%,540px);min-height:100dvh;margin:0 auto;padding:26px clamp(16px,4vw,28px) 24px;border:0!important;border-radius:0!important;box-shadow:none!important;background:transparent!important;color:inherit!important;direction:rtl;}",
            ".transfer-receipt-logo{display:none!important;}",
            ".transfer-receipt-title{margin:0 0 28px!important;text-align:center;color:inherit!important;font-size:clamp(22px,4vw,30px);line-height:1.2;font-weight:900;}",
            ".transfer-receipt-hero{display:block;width:min(190px,42vw);height:auto;margin:0 auto 26px;object-fit:contain;}",
            ".transfer-receipt-success{width:max-content;margin:0 auto 26px;display:inline-flex;align-items:center;gap:8px;padding:7px 9px 7px 14px;border-radius:16px;background:#f1f1f6;color:#202a49;font-size:clamp(18px,3.2vw,24px);font-weight:800;}",
            "html[data-theme='dark'] .transfer-receipt-success,body.dark-mode .transfer-receipt-success{background:#171b27;color:#f5f7ff;}",
            ".transfer-receipt-success i{width:34px;height:34px;display:grid;place-items:center;border-radius:10px;background:#53b69c;color:#fff;font-size:19px;}",
            ".transfer-receipt-rows{display:grid;gap:0;}",
            ".transfer-receipt-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(92px,128px);gap:12px;align-items:start;padding:9px 0;direction:ltr;}",
            ".transfer-receipt-row.is-divider{border-bottom:1px dashed #e6e7ee;padding-bottom:14px;margin-bottom:8px;}",
            "html[data-theme='dark'] .transfer-receipt-row.is-divider,body.dark-mode .transfer-receipt-row.is-divider{border-bottom-color:#33394f;}",
            ".transfer-receipt-row span{color:#8a8d96!important;font-size:clamp(14px,2.6vw,18px);text-align:right;direction:rtl;line-height:1.45;}",
            ".transfer-receipt-row strong{color:inherit!important;font-size:clamp(14px,2.6vw,18px);font-weight:900;text-align:left;direction:ltr;line-height:1.45;overflow-wrap:anywhere;}",
            ".transfer-receipt-total{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:12px;min-height:56px;margin:18px 0 26px;padding:0 16px;border:1px solid #e6e7ee;border-radius:14px;direction:ltr;}",
            "html[data-theme='dark'] .transfer-receipt-total,body.dark-mode .transfer-receipt-total{border-color:#2a3045;}",
            ".transfer-receipt-total span{color:#8a8d96;font-size:clamp(15px,2.8vw,20px);text-align:right;direction:rtl;}",
            ".transfer-receipt-total strong{color:inherit;font-size:clamp(16px,3vw,22px);direction:ltr;font-weight:900;}",
            ".transfer-receipt-actions{display:grid;gap:10px;margin-top:auto;}",
            ".transfer-receipt-share,.transfer-receipt-close{width:100%;min-height:54px;border-radius:14px;font-size:clamp(17px,3vw,22px);font-weight:900;cursor:pointer;}",
            ".transfer-receipt-share{border:0;background:#202a49;color:#fff;}",
            ".transfer-receipt-close{border:1px solid #8a8d96;background:transparent;color:#8a8d96;}",
            "html[data-theme='dark'] .transfer-receipt-share,body.dark-mode .transfer-receipt-share{background:#dfe6ff;color:#07090f;}",
            "@media(max-width:520px){.transfer-receipt-row{grid-template-columns:minmax(0,1fr) minmax(82px,112px);gap:10px;}.transfer-receipt-title{margin-bottom:24px!important;}}"
          ].join("");
          document.head.appendChild(style);
        }

        function renderTransferAlertDefault(message){
          if (!state.refs || !state.refs.alertModal) return;
          var box = state.refs.alertModal.querySelector(".transfer-modal");
          if (!box) return;
          box.className = "transfer-modal transfer-alert";
          box.innerHTML = [
            '<h3 id="transferAlertTitle"><i class="fa-solid fa-circle-exclamation"></i> تنبيه</h3>',
            '<div class="confirm-body">',
            '  <p class="confirm-note" id="transferAlertMessage"></p>',
            '</div>',
            '<div class="confirm-footer">',
            '  <button type="button" class="btn-primary" id="transferAlertOk" data-transfer-alert-close="1">حسنًا</button>',
            '</div>'
          ].join("");
          state.refs.alertMessage = box.querySelector("#transferAlertMessage");
          state.refs.alertOk = box.querySelector("#transferAlertOk");
          if (state.refs.alertMessage) state.refs.alertMessage.textContent = message || "";
        }

        function buildTransferReceiptRows(data){
          var payload = data && typeof data === "object" ? data : {};
          var senderWebuid = String(payload.senderWebuid || (state.profile && state.profile.webuid) || "").trim() || "-";
          var receiverWebuid = String(payload.receiverWebuid || payload.targetWebuid || "").trim() || "-";
          var receiverName = String(payload.receiverName || "").trim() || "-";
          var amountText = formatBalance(payload.amount || 0);
          var feeText = formatBalance(payload.fee || 0);
          var totalText = formatBalance(payload.totalAmount || ((Number(payload.amount) || 0) + (Number(payload.fee) || 0)));
          return {
            totalText: totalText,
            rows: [
              { label: "من حساب", value: senderWebuid, divider: true },
              { label: "الى المستفيد", value: receiverWebuid },
              { label: "اسم المستفيد", value: receiverName },
              { label: "المبلغ", value: amountText },
              { label: "الرسوم", value: feeText },
              { label: "ضريبة", value: formatBalance(0), divider: true }
            ]
          };
        }

        function buildTransferReceiptShareText(rows, totalText){
          var lines = ["ملخص", "تم بنجاح"];
          (rows || []).forEach(function(row){
            lines.push(String(row.label || "") + ": " + String(row.value || "-"));
          });
          lines.push("المبلغ الإجمالي: " + String(totalText || "-"));
          return lines.join("\n");
        }

        function openTransferReceiptModal(data){
          if (!state.refs || !state.refs.alertModal) return;
          ensureTransferReceiptStyles();
          mountAlertModalPortal();
          var payload = data && typeof data === "object" ? data : {};
          var model = buildTransferReceiptRows(payload);
          var rowsHtml = model.rows.map(function(row){
            return [
              '<div class="transfer-receipt-row', row.divider ? ' is-divider' : '', '">',
              '<strong>', escapeTransferHtml(row.value || "-"), '</strong>',
              '<span>', escapeTransferHtml(row.label || ""), '</span>',
              '</div>'
            ].join("");
          }).join("");
          var box = state.refs.alertModal.querySelector(".transfer-modal");
          if (!box) return;
          box.className = "transfer-modal transfer-receipt-modal";
          box.innerHTML = [
            '<h3 class="transfer-receipt-title" id="transferAlertTitle">ملخص</h3>',
            '<img class="transfer-receipt-hero" src="https://files.catbox.moe/m6mfdt.png" alt="">',
            '<div class="transfer-receipt-rows">', rowsHtml, '</div>',
            '<div class="transfer-receipt-total"><strong>', escapeTransferHtml(model.totalText), '</strong><span>المبلغ الإجمالي</span></div>',
            '<div class="transfer-receipt-actions">',
            '  <button type="button" class="transfer-receipt-share" data-transfer-receipt-share="1"><i class="fa-solid fa-share-from-square" aria-hidden="true"></i> مشاركة</button>',
            '  <button type="button" class="transfer-receipt-close" data-transfer-alert-close="1">إغلاق</button>',
            '</div>'
          ].join("");
          state.transferReceiptShareText = buildTransferReceiptShareText(model.rows, model.totalText);
          state.refs.alertModal.classList.add("transfer-receipt-backdrop");
          state.refs.alertModal.classList.add("show");
          state.refs.alertModal.setAttribute("aria-hidden","false");
          try{
            document.documentElement.classList.add("transfer-modal-open");
            document.body.classList.add("transfer-modal-open");
          }catch(_){}
        }

        function shareTransferReceipt(){
          var text = String(state.transferReceiptShareText || "").trim();
          if (!text) return;
          if (navigator.share){
            navigator.share({ text: text }).catch(function(){});
            return;
          }
          if (navigator.clipboard && navigator.clipboard.writeText){
            navigator.clipboard.writeText(text).catch(function(){});
          }
        }

        function readSessionKey(){
          try{
            var raw = localStorage.getItem("sessionKeyInfo");
            if (!raw) return "";
            var parsed = JSON.parse(raw);
            return parsed && parsed.sessionKey ? parsed.sessionKey : "";
          }catch(_){ return ""; }
        }

        function getTotpEnabledKey(uid){
          return "security:totp:enabled:" + uid;
        }

        function readLocalTotpEnabled(uid){
          if (!uid) return null;
          try{
            var raw = localStorage.getItem(getTotpEnabledKey(uid));
            if (raw == null) return null;
            return raw === "1";
          }catch(_){
            return null;
          }
        }

        function writeLocalTotpEnabled(uid, enabled){
          if (!uid) return;
          try{
            if (enabled) localStorage.setItem(getTotpEnabledKey(uid), "1");
            else localStorage.removeItem(getTotpEnabledKey(uid));
          }catch(_){}
        }

        function getTodayKey(){
          var d = new Date();
          var y = d.getFullYear();
          var m = String(d.getMonth() + 1).padStart(2, "0");
          var day = String(d.getDate()).padStart(2, "0");
          return y + "-" + m + "-" + day;
        }

        function getLimitsStorageKey(uid){
          return "transfer:limits:" + uid;
        }

        function loadTransferLimits(uid){
          if (!uid) return null;
          var today = getTodayKey();
          var base = { date: today, count: 0, lastAttemptAt: 0, lastSuccessAt: 0 };
          try{
            var raw = localStorage.getItem(getLimitsStorageKey(uid));
            if (raw){
              var parsed = JSON.parse(raw);
              if (parsed && typeof parsed === "object"){
                base = Object.assign(base, parsed);
              }
            }
          }catch(_){}
          if (base.date !== today){
            base.date = today;
            base.count = 0;
            base.lastAttemptAt = 0;
            base.lastSuccessAt = 0;
          }
          base.count = Number(base.count) || 0;
          base.lastAttemptAt = Number(base.lastAttemptAt) || 0;
          base.lastSuccessAt = Number(base.lastSuccessAt) || 0;
          return base;
        }

        function saveTransferLimits(uid, data){
          if (!uid || !data) return;
          try{
            localStorage.setItem(getLimitsStorageKey(uid), JSON.stringify(data));
          }catch(_){}
        }

        function syncTransferLimits(){
          var uid = state.currentUser && state.currentUser.uid;
          if (!uid){
            state.transferLimits = null;
            return null;
          }
          var data = loadTransferLimits(uid);
          state.transferLimits = data;
          return data;
        }

        function getCooldownRemaining(data){
          var last = data && data.lastAttemptAt ? Number(data.lastAttemptAt) : 0;
          if (!last) return 0;
          var remaining = COOLDOWN_MS - (Date.now() - last);
          return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
        }

        function getDailyRemaining(data){
          var count = data && Number(data.count) ? Number(data.count) : 0;
          var remaining = DAILY_LIMIT - count;
          return remaining > 0 ? remaining : 0;
        }

        function canStartTransfer(){
          var data = syncTransferLimits();
          if (!data){
            return { ok: false, code: "auth_required", message: "سجّل الدخول أولاً." };
          }
          if (state.totpLoading) {
            return { ok: false, code: "totp_checking", message: "جاري التحقق من المصادقة الثنائية..." };
          }
          if (state.totpEnabled !== true){
            return { ok: false, code: "totp_required", message: "يجب تفعيل المصادقة الثنائية قبل التحويل." };
          }
          if (data.count >= DAILY_LIMIT){
            return { ok: false, code: "daily_limit", message: "لقد وصلت إلى الحد اليومي (3 تحويلات). حاول غدًا." };
          }
          var cooldown = getCooldownRemaining(data);
          if (cooldown > 0){
            return { ok: false, code: "cooldown", remaining: cooldown, message: "يرجى الانتظار " + cooldown + " ثانية قبل تحويل جديد." };
          }
          return { ok: true, data: data };
        }

        function scheduleCooldownTick(){
          if (state.cooldownTimer) return;
          state.cooldownTimer = setInterval(function(){
            var data = syncTransferLimits();
            if (!data){
              clearInterval(state.cooldownTimer);
              state.cooldownTimer = null;
              return;
            }
            var remaining = getCooldownRemaining(data);
            if (remaining <= 0){
              clearInterval(state.cooldownTimer);
              state.cooldownTimer = null;
            }
            updateHelperText();
          }, 1000);
        }

        function markTransferAttempt(){
          var data = syncTransferLimits();
          if (!data || !state.currentUser) return;
          data.lastAttemptAt = Date.now();
          saveTransferLimits(state.currentUser.uid, data);
          state.transferLimits = data;
          scheduleCooldownTick();
        }

        function markTransferSuccess(){
          var data = syncTransferLimits();
          if (!data || !state.currentUser) return;
          data.count = (Number(data.count) || 0) + 1;
          data.lastSuccessAt = Date.now();
          saveTransferLimits(state.currentUser.uid, data);
          state.transferLimits = data;
        }

        function buildApiUrl(){
          var base = window.__getSiteWorkerBase ? window.__getSiteWorkerBase({ trailingSlash: true }) : DEFAULT_BASE;
          try{
            var url = new URL(base);
            url.searchParams.set("action","transfers");
            return url.toString();
          }catch(_){
            return DEFAULT_BASE + (DEFAULT_BASE.indexOf("?") >= 0 ? "&" : "?") + "action=transfers";
          }
        }

        function buildAuthUrl(){
          var base = window.__getSiteWorkerBase ? window.__getSiteWorkerBase({ trailingSlash: true }) : DEFAULT_BASE;
          try{
            var url = new URL(base);
            url.searchParams.set("action","auth");
            return url.toString();
          }catch(_){
            return DEFAULT_BASE + (DEFAULT_BASE.indexOf("?") >= 0 ? "&" : "?") + "action=auth";
          }
        }

        function ensureFirebase(){
          if (window.__SKIP_FIREBASE__) return;
          if (typeof firebase === "undefined") return;
          try{
            if (window.__ORIG_FIREBASE__){
              if (window.__ORIG_FIREBASE__.auth) firebase.auth = window.__ORIG_FIREBASE__.auth;
              if (window.__ORIG_FIREBASE__.firestore) firebase.firestore = window.__ORIG_FIREBASE__.firestore;
            }
          }catch(_){}
          try{
            if ((!firebase.apps || !firebase.apps.length) && window.__FIREBASE_CONFIG__){
              firebase.initializeApp(window.__FIREBASE_CONFIG__);
            }
          }catch(_){}
          try{
            if (!state.auth) state.auth = firebase.auth();
          }catch(_){}
          try{
            if (!state.db) state.db = firebase.firestore();
          }catch(_){}
        }

        function getSharedAuthStatusCacheTtlMs(){
          var ttl = Number(window.__SHARED_AUTH_STATUS_CACHE_TTL_MS || 4000);
          return ttl > 0 ? ttl : 4000;
        }

        function syncTotpStatus(force){
          var user = state.currentUser;
          if (!user){
            state.totpEnabled = null;
            state.totpVia = "";
            state.totpCheckedAt = 0;
            state.totpLoading = false;
            state.totpPromise = null;
            return Promise.resolve(null);
          }
          if (state.totpLoading && state.totpPromise) return state.totpPromise;
          var now = Date.now();
          if (!force && state.totpCheckedAt && (now - state.totpCheckedAt) < 60000 && state.totpEnabled !== null){
            return Promise.resolve(state.totpEnabled);
          }
          var local = readLocalTotpEnabled(user.uid);
          if (state.totpEnabled == null && local != null) state.totpEnabled = local;
          state.totpLoading = true;
          var promise = (window.__runSharedAuthStatusRequest || function(payload, ttlMs, factory){
            void payload;
            void ttlMs;
            return Promise.resolve().then(factory);
          })({
            action: "totp_status",
            uid: user.uid,
            sessionKey: readSessionKey()
          }, getSharedAuthStatusCacheTtlMs(), function(){
            return user.getIdToken(true).then(function(token){
              var payload = { action: "totp_status", idToken: token, uid: user.uid };
              var sessionKey = readSessionKey();
              if (sessionKey) payload.sessionKey = sessionKey;
              return fetch(buildAuthUrl(), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
              });
            }).then(async function(res){
              var data = await res.json().catch(function(){ return {}; });
              if (!res.ok || data.success === false){
                throw createError(data.code || "totp_status_failed", data.error || data.message || "تعذر التحقق من المصادقة الثنائية.");
              }
              var enabled = !!data.enabled;
              var via = normalizeTotpChallengeMethod(data && data.enabledVia);
              state.totpEnabled = enabled;
              state.totpVia = enabled ? via : "";
              state.totpCheckedAt = Date.now();
              writeLocalTotpEnabled(user.uid, enabled);
              if (enabled) {
                state.totpRequiredPrompted = false;
                closeTotpRequiredModal();
              }
              return enabled;
            }).catch(function(){
              var fallback = readLocalTotpEnabled(user.uid);
              state.totpEnabled = fallback === true;
              if (state.totpEnabled !== true) state.totpVia = "";
              state.totpCheckedAt = Date.now();
              if (state.totpEnabled === true) {
                state.totpRequiredPrompted = false;
                closeTotpRequiredModal();
              }
              return state.totpEnabled;
            });
          }).finally(function(){
            state.totpLoading = false;
            updateHelperText();
            updateSubmitState();
          });
          state.totpPromise = promise;
          return promise;
        }

        function themeIsDark(){
          try{
            var attr = document.documentElement.getAttribute('data-theme');
            if (attr === 'dark' || attr === 'light') return attr === 'dark';
            var stored = localStorage.getItem('theme');
            if (stored === 'dark' || stored === 'light') return stored === 'dark';
            var cachedRaw = localStorage.getItem('site:theme:v1');
            if (cachedRaw) {
              var cached = JSON.parse(cachedRaw) || {};
              var mode = String(
                cached.defaultMode ||
                cached.default_mode ||
                cached.defaultThemeMode ||
                cached.default_theme_mode ||
                ''
              ).trim().toLowerCase();
              if (mode === 'dark' || mode === 'light') return mode === 'dark';
            }
          }catch(_){}
          return true;
        }

        function ensureTransferPageStyles(){
          if (document.getElementById("transfer-page-clean-style")) return;
          var style = document.createElement("style");
          style.id = "transfer-page-clean-style";
          style.textContent = [
            ".transfer-page{background:transparent!important;color:var(--text,#1d2742)!important;}",
            ".transfer-page main{width:min(100%,980px);margin:0 auto;padding:24px clamp(16px,4vw,36px) 76px;background:transparent!important;background-image:none!important;border:0!important;border-radius:0!important;box-shadow:none!important;}",
            ".transfer-page h2{margin:0 0 24px!important;text-align:right;color:var(--site-accent-runtime,#5c5ebf)!important;font-weight:900!important;}",
            ".transfer-page h2 span{display:inline-flex;align-items:center;gap:10px;color:inherit!important;}",
            ".transfer-page .transfer-meta{display:none!important;}",
            ".transfer-page .transfer-form{display:grid;gap:18px;padding:20px clamp(16px,3vw,28px);border:1px solid rgba(var(--site-accent-rgb,148,163,184),.36)!important;border-radius:18px;background:transparent!important;background-image:none!important;box-shadow:none!important;}",
            ".transfer-page .transfer-field{display:block!important;margin:0!important;padding:0!important;border:0!important;border-radius:0!important;background:transparent!important;background-image:none!important;box-shadow:none!important;}",
            ".transfer-page .transfer-field span{position:static!important;display:block!important;width:auto!important;min-height:0!important;margin:0 0 8px!important;padding:0 2px!important;border:0!important;border-radius:0!important;background:transparent!important;background-image:none!important;box-shadow:none!important;color:var(--text,#1d2742)!important;-webkit-text-fill-color:currentColor!important;font-size:15px!important;font-weight:900!important;text-align:right!important;}",
            ".transfer-page .transfer-field input,.transfer-page .transfer-field textarea{width:100%!important;min-height:56px!important;border:1px solid rgba(var(--site-accent-rgb,148,163,184),.34)!important;border-radius:16px!important;background:var(--bg-app,#f4f5f8)!important;background-image:none!important;color:var(--text,#1d2742)!important;-webkit-text-fill-color:currentColor!important;box-shadow:none!important;text-align:center!important;font-weight:900!important;}",
            ".transfer-page .transfer-field input::placeholder,.transfer-page .transfer-field textarea::placeholder{color:rgba(29,39,66,.38)!important;-webkit-text-fill-color:rgba(29,39,66,.38)!important;}",
            ".transfer-page .transfer-helper,.transfer-page .transfer-status{border:0!important;background:transparent!important;background-image:none!important;box-shadow:none!important;color:var(--text,#1d2742)!important;text-align:right!important;font-weight:800!important;}",
            ".transfer-page .transfer-actions{display:grid;gap:12px;margin-top:8px;}",
            ".transfer-page .transfer-footnote{margin:0!important;color:var(--muted,#8a8d96)!important;text-align:right!important;}",
            ".transfer-page #transferSubmit{min-height:52px;border-radius:18px!important;}",
            "html[data-theme='dark'] .transfer-page,body.dark-mode .transfer-page{color:var(--text,#f5f7ff)!important;}",
            "html[data-theme='dark'] .transfer-page .transfer-field span,body.dark-mode .transfer-page .transfer-field span,html[data-theme='dark'] .transfer-page .transfer-helper,body.dark-mode .transfer-page .transfer-helper,html[data-theme='dark'] .transfer-page .transfer-status,body.dark-mode .transfer-page .transfer-status{color:var(--text,#f5f7ff)!important;}",
            "html[data-theme='dark'] .transfer-page .transfer-field input,body.dark-mode .transfer-page .transfer-field input,html[data-theme='dark'] .transfer-page .transfer-field textarea,body.dark-mode .transfer-page .transfer-field textarea{background:var(--bg-app,#07090f)!important;color:var(--text,#f5f7ff)!important;}",
            "html[data-theme='dark'] .transfer-page .transfer-field input::placeholder,body.dark-mode .transfer-page .transfer-field input::placeholder{color:rgba(245,247,255,.38)!important;-webkit-text-fill-color:rgba(245,247,255,.38)!important;}"
          ].join("");
          document.head.appendChild(style);
        }

        function ensureRoot(){
          if (state.root) return state.root;
          ensureTransferPageStyles();
          var root = document.createElement("div");
          root.className = "transfer-page";
          root.innerHTML = [
            "<main>",
            '  <h2><span><i class="fa-solid fa-right-left"></i> تحويل رصيد</span></h2>',
            '  <form id="transferForm" class="transfer-form" novalidate>',
            '    <label class="transfer-field">',
            '      <span>ايدي المستلم</span>',
            '      <input id="transferTarget" type="text" inputmode="text" autocomplete="off" maxlength="40" placeholder="مثال: ***********8454" required />',
            "    </label>",
            '    <label class="transfer-field">',
            '      <span>المبلغ بالدولار</span>',
            '      <input id="transferAmount" type="number" step="0.001" min="0.001" placeholder="0.000" required />',
            "    </label>",
            '    <div id="transferHelper" class="transfer-helper"></div>',
            '    <div id="transferStatus" class="transfer-status" role="status" aria-live="polite"></div>',
            '    <div id="transferTurnstile" class="transfer-turnstile" aria-hidden="true"></div>',
            '    <div class="transfer-actions">',
            '      <p class="transfer-footnote">لا يمكن التراجع عن التحويل نهائيا.</p>',
            '      <button id="transferSubmit" type="submit"><i class="fa-solid fa-paper-plane"></i> تأكيد التحويل</button>',
            "    </div>",
            "  </form>",
            '  <div id="transferConfirmBackdrop" class="transfer-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="transferConfirmTitle">',
            '    <div class="transfer-modal">',
            '      <h3 id="transferConfirmTitle"><i class="fa-solid fa-shield-halved"></i> تأكيد التحويل</h3>',
            '      <div class="confirm-body">',
            '        <div class="confirm-row"><span class="confirm-label">المستلم</span><span class="confirm-value" id="confirmReceiver"></span></div>',
            '        <div class="confirm-row"><span class="confirm-label">المعرف</span><span class="confirm-value" id="confirmWebuid"></span></div>',
            '        <div class="confirm-row"><span class="confirm-label">المبلغ</span><span class="confirm-value" id="confirmAmount"></span></div>',
            '        <div class="confirm-row"><span class="confirm-label">العمولة</span><span class="confirm-value" id="confirmFee"></span></div>',
            '        <div class="confirm-row"><span class="confirm-label">الإجمالي</span><span class="confirm-value" id="confirmTotal"></span></div>',
            '      </div>',
            '      <div class="confirm-footer">',
            '        <button type="button" class="btn-ghost" id="confirmCancel">إلغاء</button>',
            '        <button type="button" class="btn-primary" id="confirmApprove"><i class="fa-solid fa-check"></i> تأكيد</button>',
            '      </div>',
            '    </div>',
            '  </div>',
            '  <div id="transferAlertBackdrop" class="transfer-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="transferAlertTitle">',
            '    <div class="transfer-modal transfer-alert">',
            '      <h3 id="transferAlertTitle"><i class="fa-solid fa-circle-exclamation"></i> تنبيه</h3>',
            '      <div class="confirm-body">',
            '        <p class="confirm-note" id="transferAlertMessage"></p>',
            '      </div>',
            '      <div class="confirm-footer">',
            '        <button type="button" class="btn-primary" id="transferAlertOk">حسنًا</button>',
            '      </div>',
            '    </div>',
            '  </div>',
            '  <div id="transferTotpRequiredBackdrop" class="transfer-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="transferTotpRequiredTitle">',
            '    <div class="transfer-modal transfer-totp-required">',
            '      <h3 id="transferTotpRequiredTitle"><i class="fa-solid fa-shield-keyhole"></i> تفعيل المصادقة الثنائية</h3>',
            '      <div class="confirm-body">',
            '        <p class="confirm-note">يلزم تفعيل المصادقة الثنائية لإتمام التحويل. انتقل إلى حماية الحساب لتفعيلها ثم أعد المحاولة.</p>',
            '      </div>',
            '      <div class="confirm-footer">',
            '        <button type="button" class="btn-ghost" id="transferTotpRequiredLater">لاحقًا</button>',
            '        <button type="button" class="btn-primary" id="transferTotpRequiredGo"><i class="fa-solid fa-lock"></i> فتح حماية الحساب</button>',
            '      </div>',
            '    </div>',
            '  </div>',
            '  <div id="transferTotpModal" class="modal hidden" role="dialog" aria-modal="true" aria-labelledby="transferTotpTitle">',
            '    <div class="modal-content totp-modal">',
            '      <button class="totp-close" id="transferTotpClose" type="button" aria-label="إغلاق">&times;</button>',
            '      <h3 id="transferTotpTitle">أدخل رمز التحقق</h3>',
            '      <p class="totp-subtitle" id="transferTotpSubtitle">أدخل الرمز المكوّن من 6 أرقام لإكمال العملية.</p>',
            '      <div class="input-group">',
            '        <input id="transferTotpInput" type="text" inputmode="numeric" autocomplete="one-time-code" placeholder="123456" maxlength="6"/>',
            '      </div>',
            '      <p class="totp-error" id="transferTotpError"></p>',
            '      <button class="totp-email-btn" id="transferTotpRequestBtn" type="button">إرسال رمز التحقق عبر تيليغرام</button>',
            '      <button class="btn-login" id="transferTotpConfirm" type="button">تأكيد</button>',
            '    </div>',
            '  </div>',
            "</main>"
          ].join("");
          try { queueI18nPrewarm(root, { maxItems: 220 }); } catch(_){}
          state.root = root;
          state.refs = {
            balance: root.querySelector('[data-transfer-balance]'),
            senderWebuid: root.querySelector('[data-transfer-my-webuid]'),
            helper: root.querySelector("#transferHelper"),
            status: root.querySelector("#transferStatus"),
            turnstile: root.querySelector("#transferTurnstile"),
            form: root.querySelector("#transferForm"),
            target: root.querySelector("#transferTarget"),
            amount: root.querySelector("#transferAmount"),
            submit: root.querySelector("#transferSubmit"),
            copyWebuid: root.querySelector("#copyMyWebuid"),
            confirmModal: root.querySelector("#transferConfirmBackdrop"),
            confirmReceiver: root.querySelector("#confirmReceiver"),
            confirmWebuid: root.querySelector("#confirmWebuid"),
            confirmAmount: root.querySelector("#confirmAmount"),
            confirmFee: root.querySelector("#confirmFee"),
            confirmTotal: root.querySelector("#confirmTotal"),
            confirmApprove: root.querySelector("#confirmApprove"),
            confirmCancel: root.querySelector("#confirmCancel"),
            alertModal: root.querySelector("#transferAlertBackdrop"),
            alertMessage: root.querySelector("#transferAlertMessage"),
            alertOk: root.querySelector("#transferAlertOk"),
            totpRequiredModal: root.querySelector("#transferTotpRequiredBackdrop"),
            totpRequiredGo: root.querySelector("#transferTotpRequiredGo"),
            totpRequiredLater: root.querySelector("#transferTotpRequiredLater"),
            totpModal: root.querySelector("#transferTotpModal"),
            totpInput: root.querySelector("#transferTotpInput"),
            totpError: root.querySelector("#transferTotpError"),
            totpRequestBtn: root.querySelector("#transferTotpRequestBtn"),
            totpConfirm: root.querySelector("#transferTotpConfirm"),
            totpSubtitle: root.querySelector("#transferTotpSubtitle"),
            totpClose: root.querySelector("#transferTotpClose")
          };
          mountConfirmModalPortal();
          mountAlertModalPortal();
          mountTotpRequiredModalPortal();
          mountTotpModalPortal();
          bindFormEvents();
          bindBalanceListener();
          updateRecipientPreview("idle");
          updateHelperText();
          return root;
        }

        function ensureTurnstileScript(){
          if (typeof location !== "undefined" && location.protocol === "file:") return Promise.resolve(null);
          if (window.turnstile) return Promise.resolve(window.turnstile);
          if (state.turnstileReady) return state.turnstileReady;
          state.turnstileReady = new Promise(function(resolve){
            var existing = document.querySelector('script[data-transfer-turnstile]');
            var resolved = false;
            var finish = function(val){
              if (resolved) return;
              resolved = true;
              resolve(val || window.turnstile || null);
            };
            if (existing){
              existing.addEventListener("load", function(){ finish(window.turnstile || null); }, { once: true });
              existing.addEventListener("error", function(){ finish(null); }, { once: true });
            } else {
              var script = document.createElement("script");
              script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=__transferTurnstileInit&render=explicit";
              script.async = true;
              script.defer = true;
              script.dataset.transferTurnstile = "1";
              script.onload = function(){ finish(window.turnstile || null); };
              script.onerror = function(){ finish(null); };
              window.__transferTurnstileInit = function(){ finish(window.turnstile || null); };
              document.head.appendChild(script);
            }
            setTimeout(function(){ finish(window.turnstile || null); }, 8000);
          });
          return state.turnstileReady;
        }

        function acquireTurnstileToken(){
          return ensureTurnstileScript().then(function(turnstile){
            if (!turnstile || !state.refs || !state.refs.turnstile){
              throw createError("turnstile_unavailable","تعذر تحميل التحقق البشري، حاول تحديث الصفحة.");
            }
            var holder = state.refs.turnstile;
            holder.classList.add("active");
            if (!state.turnstileWidgetId){
              state.turnstileWidgetId = turnstile.render(holder, {
                sitekey: state.turnstileSiteKey,
                size: "invisible",
                action: "wallet-transfer",
                theme: themeIsDark() ? "dark" : "light",
                callback: function(token){
              state.turnstileToken = token || "";
              if (state.turnstileResolver) state.turnstileResolver(state.turnstileToken);
              state.turnstileResolver = null;
              state.turnstileRejecter = null;
            },
            "error-callback": function(){
              var err = createError("turnstile_failed","تعذر التحقق الأمني، جرّب مجدداً.");
              if (state.turnstileRejecter) state.turnstileRejecter(err);
              state.turnstileResolver = null;
              state.turnstileRejecter = null;
            },
            "expired-callback": function(){
              state.turnstileToken = "";
              if (state.turnstileRejecter) state.turnstileRejecter(createError("turnstile_timeout","انتهى وقت الحماية، حاول مجدداً."));
              state.turnstileResolver = null;
              state.turnstileRejecter = null;
            }
          });
        }
        return new Promise(function(resolve, reject){
          state.turnstileResolver = function(tok){
            if (state.turnstileTimer) clearTimeout(state.turnstileTimer);
            state.turnstileTimer = null;
            state.turnstileResolver = null;
            state.turnstileRejecter = null;
            if (!tok) {
              reject(createError("turnstile_failed","تعذر الحصول على رمز الحماية."));
              return;
            }
            resolve(tok);
          };
          state.turnstileRejecter = function(err){
            if (state.turnstileTimer) clearTimeout(state.turnstileTimer);
            state.turnstileTimer = null;
            state.turnstileResolver = null;
                state.turnstileRejecter = null;
                reject(err || createError("turnstile_failed","فشل الحصول على رمز الحماية."));
              };
              state.turnstileToken = "";
              try{
                turnstile.reset(state.turnstileWidgetId);
                turnstile.execute(state.turnstileWidgetId);
              }catch(err){
                state.turnstileRejecter(err);
              }
              state.turnstileTimer = setTimeout(function(){
                if (!state.turnstileToken && state.turnstileRejecter){
                  state.turnstileRejecter(createError("turnstile_timeout","انتهى وقت الحماية، حاول مجدداً."));
                }
              }, 25000);
            });
          });
        }

        function bindBalanceListener(){
          if (state.balanceListenerBound) return;
          try{
            window.addEventListener("balance:change", function(evt){
              if (!state.profile) return;
              var val = evt && evt.detail ? Number(evt.detail.value) : NaN;
              if (Number.isFinite(val)){
                state.profile.balance = val;
                updateProfileUI();
              }
            });
            state.balanceListenerBound = true;
          }catch(_){}
        }

        function mountConfirmModalPortal(){
          if (!state.refs || !state.refs.confirmModal) return;
          if (state.refs.confirmModal.dataset && state.refs.confirmModal.dataset.portaled === "1") return;
          try{
            document.body.appendChild(state.refs.confirmModal);
            if (state.refs.confirmModal.dataset) state.refs.confirmModal.dataset.portaled = "1";
          }catch(_){}
        }

        function mountAlertModalPortal(){
          if (!state.refs || !state.refs.alertModal) return;
          if (state.refs.alertModal.dataset && state.refs.alertModal.dataset.portaled === "1") return;
          try{
            document.body.appendChild(state.refs.alertModal);
            if (state.refs.alertModal.dataset) state.refs.alertModal.dataset.portaled = "1";
          }catch(_){}
        }

        function mountTotpRequiredModalPortal(){
          if (!state.refs || !state.refs.totpRequiredModal) return;
          if (state.refs.totpRequiredModal.dataset && state.refs.totpRequiredModal.dataset.portaled === "1") return;
          try{
            document.body.appendChild(state.refs.totpRequiredModal);
            if (state.refs.totpRequiredModal.dataset) state.refs.totpRequiredModal.dataset.portaled = "1";
          }catch(_){}
        }

        function closeAlertModal(){
          if (!state.refs || !state.refs.alertModal) return;
          state.refs.alertModal.classList.remove("show");
          state.refs.alertModal.classList.remove("transfer-receipt-backdrop");
          state.refs.alertModal.setAttribute("aria-hidden","true");
          state.transferReceiptShareText = "";
          try{
            document.documentElement.classList.remove("transfer-modal-open");
            document.body.classList.remove("transfer-modal-open");
          }catch(_){}
        }

        function openAlertModal(message){
          if (!state.refs || !state.refs.alertModal) return;
          mountAlertModalPortal();
          state.refs.alertModal.classList.remove("transfer-receipt-backdrop");
          renderTransferAlertDefault(message || "");
          state.refs.alertModal.classList.add("show");
          state.refs.alertModal.setAttribute("aria-hidden","false");
          try{
            document.documentElement.classList.add("transfer-modal-open");
            document.body.classList.add("transfer-modal-open");
          }catch(_){}
        }

        function mountTotpModalPortal(){
          if (!state.refs || !state.refs.totpModal) return;
          if (state.refs.totpModal.dataset && state.refs.totpModal.dataset.portaled === "1") return;
          try{
            document.body.appendChild(state.refs.totpModal);
            if (state.refs.totpModal.dataset) state.refs.totpModal.dataset.portaled = "1";
          }catch(_){}
        }

        function closeTotpRequiredModal(){
          if (!state.refs || !state.refs.totpRequiredModal) return;
          state.refs.totpRequiredModal.classList.remove("show");
          state.refs.totpRequiredModal.setAttribute("aria-hidden","true");
          try{
            document.documentElement.classList.remove("transfer-modal-open");
            document.body.classList.remove("transfer-modal-open");
          }catch(_){}
        }

        function openTotpRequiredModal(){
          if (!state.refs || !state.refs.totpRequiredModal) return;
          mountTotpRequiredModalPortal();
          state.refs.totpRequiredModal.classList.add("show");
          state.refs.totpRequiredModal.setAttribute("aria-hidden","false");
          try{
            document.documentElement.classList.add("transfer-modal-open");
            document.body.classList.add("transfer-modal-open");
          }catch(_){}
        }

        function promptTotpRequiredOnce(){
          if (state.totpRequiredPrompted) return;
          if (!state.refs || !state.refs.totpRequiredModal) return;
          if (state.refs.confirmModal && state.refs.confirmModal.classList.contains("show")) return;
          if (state.refs.totpModal && !state.refs.totpModal.classList.contains("hidden")) return;
          state.totpRequiredPrompted = true;
          openTotpRequiredModal();
        }

        function normalizeTotpCode(value){
          return String(value || "").replace(/\D/g, "").slice(0, 6);
        }

        function normalizeTotpChallengeMethod(value){
          var raw = String(value || "").trim().toLowerCase();
          if (raw === "totp") return "app";
          if (raw === "app" || raw === "telegram") return raw;
          if (raw === "tg" || raw === "telegram_bot" || raw === "bot") return "telegram";
          return "";
        }

        function isTransferTotpCodeDeliveryMethod(method){
          return method === "telegram";
        }

        function getTransferTotpChannelLabel(method){
          return method === "telegram" ? "تيليغرام" : "التطبيق";
        }

        function getTransferTotpButtonHtml(method, requestedBefore){
          return requestedBefore
            ? 'إعادة إرسال رمز التحقق عبر تيليغرام'
            : 'إرسال رمز التحقق عبر تيليغرام';
        }

        function resolveTransferTotpMethodFromError(err, fallback){
          var details = err && err.details && typeof err.details === "object" ? err.details : {};
          var direct = normalizeTotpChallengeMethod(details.preferredFactor || details.enabledVia || "");
          if (direct) return direct;
          var factors = Array.isArray(details.factors)
            ? details.factors.map(function(item){ return String(item || "").trim().toLowerCase(); })
            : [];
          var hasTotp = factors.indexOf("totp") >= 0 || factors.indexOf("app") >= 0;
          var hasTelegram = factors.indexOf("telegram") >= 0;
          if (hasTelegram && !hasTotp) return "telegram";
          if (hasTotp && !hasTelegram) return "app";
          var fallbackMethod = normalizeTotpChallengeMethod(fallback || "");
          var errCode = String(err && err.code || "").trim().toLowerCase();
          if (fallbackMethod) return fallbackMethod;
          if (errCode.indexOf("telegram_otp_") === 0) return "telegram";
          if (errCode.indexOf("totp_") === 0) return "app";
          if (hasTelegram) return "telegram";
          if (hasTotp) return "app";
          return fallbackMethod;
        }

        function resolveTotpRequest(value){
          if (!pendingTotpResolve) return;
          var resolver = pendingTotpResolve;
          pendingTotpResolve = null;
          resolver(value);
        }

        function requestTransferTelegramOtpCode(){
          if (!state.currentUser || typeof state.currentUser.getIdToken !== "function") {
            return Promise.reject(createError("auth_required", "سجّل الدخول أولاً."));
          }
          return state.currentUser.getIdToken(true).then(function(token){
            var payload = {
              action: "telegram_otp_request",
              purpose: "login",
              rateScope: "transfer",
              idToken: token
            };
            var sessionKey = readSessionKey();
            if (sessionKey) payload.sessionKey = sessionKey;
            return fetch(buildAuthUrl(), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload)
            });
          }).then(async function(res){
            var data = await res.json().catch(function(){ return {}; });
            if (!res.ok || data.success === false || data.ok === false) {
              throw createError(data.code || "telegram_otp_failed", data.error || data.message || "تعذر إرسال رمز تيليغرام.", data.details);
            }
            return data;
          });
        }

        function requestTransferTotpCodeFromModal(){
          if (!pendingTotpEmailRequest || pendingTotpEmailBusy) return Promise.resolve();
          var errEl = state.refs && state.refs.totpError;
          var method = normalizeTotpChallengeMethod(pendingTotpMethod);
          var otpScope = "transfer-send:" + method + ":" + String((state.currentUser && state.currentUser.uid) || (typeof getOtpCurrentUid === "function" ? getOtpCurrentUid() : ""));
          var localRemaining = (method === "telegram" && window.__siteOtpLimits)
            ? window.__siteOtpLimits.getSendRemaining(otpScope)
            : 0;
          var remaining = Math.max(getTotpEmailCooldownRemaining(), localRemaining);
          if (remaining > 0) {
            if (errEl) {
              errEl.style.color = "var(--muted, #6b7280)";
              errEl.textContent = "يمكنك إعادة الإرسال بعد " + (window.__siteOtpLimits ? window.__siteOtpLimits.format(remaining) : (remaining + " ثانية")) + ".";
            }
            renderTotpEmailButton();
            return Promise.resolve();
          }
          var loaderHeld = false;
          pendingTotpEmailBusy = true;
          renderTotpEmailButton();
          if (errEl) {
            errEl.style.color = "var(--muted, #6b7280)";
            errEl.textContent = "";
          }
          try {
            if (typeof showLoader === "function") {
              showLoader(true);
            } else if (typeof window.__holdPageLoader === "function") {
              window.__holdPageLoader();
            }
            loaderHeld = true;
          } catch (_){}
          return pendingTotpEmailRequest().then(function(payload){
            var rawDeliveryChannel = payload && String(payload.deliveryChannel || "").trim().toLowerCase();
            var deliveryChannel = rawDeliveryChannel === "push"
              ? "push"
              : "telegram";
            var target = payload && payload.to ? String(payload.to) : "";
            var cooldownSeconds = Number(
              (payload && (payload.resendAfterSeconds ?? payload.retryAfterSeconds)) ?? TOTP_EMAIL_RESEND_COOLDOWN_SECONDS
            );
            if (method === "telegram" && window.__siteOtpLimits) {
              window.__siteOtpLimits.markSent(otpScope);
            }
            var safeCooldownSeconds = Number.isFinite(cooldownSeconds) && cooldownSeconds > 0 ? cooldownSeconds : 300;
            startTotpEmailCooldown(Math.max(300, safeCooldownSeconds));
            markTransferTotpEmailSent(payload && payload.expiresInSeconds);
            setTransferTotpInputVisible(true);
            if (state.refs && state.refs.totpSubtitle) {
              state.refs.totpSubtitle.textContent = deliveryChannel === "push"
                ? "ادخل الكود الذي وصلك عبر إشعار Firebase على جهازك."
                : "ادخل الكود المستلم على تيليغرام.";
            }
            if (errEl) {
              errEl.style.color = "var(--success, #22c55e)";
              errEl.textContent = deliveryChannel === "push"
                ? "تم إرسال رمز التحقق عبر إشعار Firebase على جهازك."
                : "";
            }
          }).catch(function(err){
            if (errEl) {
              errEl.style.color = "var(--danger, #ef4444)";
              errEl.textContent = (err && err.message) ? err.message : ("تعذر إرسال رمز " + getTransferTotpChannelLabel(method) + ".");
            }
          }).finally(function(){
            pendingTotpEmailBusy = false;
            if (loaderHeld) {
              try {
                if (typeof showLoader === "function") {
                  showLoader(false);
                } else if (typeof window.__releasePageLoader === "function") {
                  window.__releasePageLoader();
                }
              } catch (_) {}
            }
            renderTotpEmailButton();
          });
        }

        function closeTotpModal(result){
          if (state.refs && state.refs.totpModal){
            state.refs.totpModal.classList.add("hidden");
            state.refs.totpModal.setAttribute("aria-hidden","true");
          }
          try{
            document.documentElement.classList.remove("transfer-modal-open");
            document.body.classList.remove("transfer-modal-open");
          }catch(_){}
          if (state.refs && state.refs.totpError) state.refs.totpError.textContent = "";
          if (state.refs && state.refs.totpInput) state.refs.totpInput.value = "";
          pendingTotpEmailRequest = null;
          pendingTotpEmailBusy = false;
          pendingTotpMethod = "";
          pendingTotpEmailSent = false;
          if (state.refs && state.refs.totpRequestBtn){
            state.refs.totpRequestBtn.style.display = "none";
          }
          setTransferTotpInputVisible(true);
          renderTotpEmailButton();
          resolveTotpRequest(result);
        }

        function openTotpModal(options){
          if (!state.refs || !state.refs.totpModal){
            return Promise.resolve("");
          }
          if (pendingTotpResolve) resolveTotpRequest("");
          mountTotpModalPortal();
          var method = normalizeTotpChallengeMethod(options && options.method);
          pendingTotpEmailRequest = (options && typeof options.requestEmailCode === "function")
            ? options.requestEmailCode
            : null;
          pendingTotpEmailBusy = false;
          pendingTotpMethod = method;
          if (method === "app") pendingTotpEmailRequest = null;
          var emailRequestedBefore = isTransferTotpCodeDeliveryMethod(method) && hasTransferTotpEmailSent();
          var emailCooldownActive = isTransferTotpCodeDeliveryMethod(method) && getTotpEmailCooldownRemaining() > 0;
          pendingTotpEmailSent = !isTransferTotpCodeDeliveryMethod(method) || emailRequestedBefore;
          var subtitle = options && options.subtitle ? options.subtitle : "";
          if (isTransferTotpCodeDeliveryMethod(method) && !pendingTotpEmailSent) {
            subtitle = emailCooldownActive
              ? "تعذر إرسال الرمز حاليًا. اتبع الرسالة الظاهرة بالأسفل."
              : "اضغط على زر إرسال رمز التحقق عبر تيليغرام أولاً.";
          } else if (!subtitle) {
            /*
            subtitle = method === "telegram"
              ? "ادخل الكود المستلم على تيليغرام."
              : (method === "app"
                ? "من فضلك افتح تطبيق Google Authenticator وأدخل الكود المكون من 6 أرقام."
                : "أدخل رمز التحقق المكوّن من 6 أرقام."));
          }
            */
            if (method === "telegram") {
              subtitle = "\u0627\u062f\u062e\u0644 \u0627\u0644\u0643\u0648\u062f \u0627\u0644\u0630\u064a \u0648\u0635\u0644\u0643 \u0639\u0644\u0649 \u062a\u064a\u0644\u064a\u063a\u0631\u0627\u0645.";
            } else if (method === "app") {
              subtitle = "\u0645\u0646 \u0641\u0636\u0644\u0643 \u0627\u0641\u062a\u062d \u062a\u0637\u0628\u064a\u0642 Google Authenticator \u0648\u0623\u062f\u062e\u0644 \u0627\u0644\u0643\u0648\u062f \u0627\u0644\u0645\u0643\u0648\u0646 \u0645\u0646 6 \u0623\u0631\u0642\u0627\u0645.";
            } else {
              subtitle = "\u0623\u062f\u062e\u0644 \u0631\u0645\u0632 \u0627\u0644\u062a\u062d\u0642\u0642 \u0627\u0644\u0645\u0643\u0648\u0651\u0646 \u0645\u0646 6 \u0623\u0631\u0642\u0627\u0645.";
            }
          }
          if (state.refs.totpSubtitle) state.refs.totpSubtitle.textContent = subtitle;
          if (state.refs.totpError) {
            state.refs.totpError.style.color = "var(--danger, #ef4444)";
            state.refs.totpError.textContent = (options && options.error) ? options.error : "";
          }
          if (state.refs.totpRequestBtn) {
            renderTotpEmailButton();
          }
          setTransferTotpInputVisible(!isTransferTotpCodeDeliveryMethod(method) || pendingTotpEmailSent);
          if (state.refs.totpInput){
            var prefill = options && options.prefill ? options.prefill : "";
            state.refs.totpInput.value = normalizeTotpCode(prefill);
          }
          state.refs.totpModal.classList.remove("hidden");
          state.refs.totpModal.setAttribute("aria-hidden","false");
          try{
            document.documentElement.classList.add("transfer-modal-open");
            document.body.classList.add("transfer-modal-open");
          }catch(_){}
          setTimeout(function(){
            if (state.refs && state.refs.totpInput && !state.refs.totpInput.disabled){
              try{
                state.refs.totpInput.focus();
                state.refs.totpInput.select();
              }catch(_){}
            }
          }, 30);
          return new Promise(function(resolve){
            pendingTotpResolve = resolve;
          });
        }

        function requestTotpCodeWithModal(options){
          return openTotpModal(options || {}).then(function(code){
            return code ? String(code).trim() : "";
          });
        }

        function confirmTotpModal(){
          if (!state.refs || !state.refs.totpInput) return;
          var code = normalizeTotpCode(state.refs.totpInput.value);
          state.refs.totpInput.value = code;
          if (!code || code.length < 6){
            if (state.refs.totpError) state.refs.totpError.textContent = "أدخل رمزًا من 6 أرقام.";
            try{ state.refs.totpInput.focus(); }catch(_){}
            return;
          }
          var method = normalizeTotpChallengeMethod(pendingTotpMethod) || "app";
          var maxAttempts = method === "telegram" ? 3 : 5;
          var attemptScope = "transfer-attempt:" + method + ":" + String((state.currentUser && state.currentUser.uid) || (typeof getOtpCurrentUid === "function" ? getOtpCurrentUid() : ""));
          var blockedFor = window.__siteOtpLimits
            ? window.__siteOtpLimits.getAttemptRemaining(attemptScope, maxAttempts)
            : 0;
          if (blockedFor > 0) {
            if (state.refs.totpError) {
              state.refs.totpError.textContent = "انتهت محاولات إدخال الرمز. حاول بعد " + window.__siteOtpLimits.format(blockedFor) + ".";
            }
            try{ state.refs.totpInput.focus(); }catch(_){}
            return;
          }
          if (window.__siteOtpLimits) window.__siteOtpLimits.markAttempt(attemptScope);
          closeTotpModal(code);
        }

        function bindFormEvents(){
          if (!state.refs || state.eventsBound) return;
          state.eventsBound = true;
          if (state.refs.form){
            state.refs.form.addEventListener("submit", handleSubmit);
          }
          if (state.refs.amount){
            state.refs.amount.addEventListener("input", updateHelperText);
          }
          if (state.refs.target){
            state.refs.target.addEventListener("input", function(){
              showStatus();
              var next = normalizeWebuid(this.value);
              if (state.lookupTimer) clearTimeout(state.lookupTimer);
              if (state.recipientInfo && state.recipientInfo.webuid !== next) state.recipientInfo = null;
              updateRecipientPreview(state.currentUser ? "idle" : "need-login");
            });
          }
          if (state.refs.copyWebuid){
            state.refs.copyWebuid.addEventListener("click", handleCopyMyWebuid);
          }
          if (state.refs.confirmCancel){
            state.refs.confirmCancel.addEventListener("click", function(){ closeConfirmModal(false); });
          }
          if (state.refs.confirmApprove){
            state.refs.confirmApprove.addEventListener("click", function(){ closeConfirmModal(true); });
          }
          if (state.refs.confirmModal){
            state.refs.confirmModal.addEventListener("click", function(evt){
              if (evt.target === state.refs.confirmModal) closeConfirmModal(false);
            });
          }
          if (state.refs.alertOk){
            state.refs.alertOk.addEventListener("click", closeAlertModal);
          }
          if (state.refs.alertModal){
            state.refs.alertModal.addEventListener("click", function(evt){
              var target = evt.target;
              var action = target && typeof target.closest === "function"
                ? target.closest("[data-transfer-alert-close], [data-transfer-receipt-share]")
                : null;
              if (action && action.hasAttribute("data-transfer-receipt-share")){
                shareTransferReceipt();
                return;
              }
              if (action && action.hasAttribute("data-transfer-alert-close")){
                closeAlertModal();
                return;
              }
              if (evt.target === state.refs.alertModal) closeAlertModal();
            });
          }
          if (state.refs.totpRequiredLater){
            state.refs.totpRequiredLater.addEventListener("click", function(){ closeTotpRequiredModal(); });
          }
          if (state.refs.totpRequiredGo){
            state.refs.totpRequiredGo.addEventListener("click", function(){
              closeTotpRequiredModal();
              try{ window.location.hash = "#/security"; }catch(_){}
            });
          }
          if (state.refs.totpRequiredModal){
            state.refs.totpRequiredModal.addEventListener("click", function(evt){
              if (evt.target === state.refs.totpRequiredModal) closeTotpRequiredModal();
            });
          }
          if (state.refs.totpConfirm){
            state.refs.totpConfirm.addEventListener("click", confirmTotpModal);
          }
          if (state.refs.totpClose){
            state.refs.totpClose.addEventListener("click", function(){ closeTotpModal(null); });
          }
          if (state.refs.totpRequestBtn){
            state.refs.totpRequestBtn.addEventListener("click", function(evt){
              if (evt) evt.preventDefault();
              requestTransferTotpCodeFromModal();
            });
          }
          if (state.refs.totpModal){
            state.refs.totpModal.addEventListener("click", function(evt){
              if (evt.target === state.refs.totpModal) closeTotpModal(null);
            });
          }
          if (state.refs.totpInput){
            state.refs.totpInput.addEventListener("input", function(){
              var cleaned = normalizeTotpCode(this.value);
              if (this.value !== cleaned) this.value = cleaned;
              if (state.refs && state.refs.totpError) state.refs.totpError.textContent = "";
            });
            state.refs.totpInput.addEventListener("keydown", function(evt){
              if (evt.key === "Enter"){
                evt.preventDefault();
                confirmTotpModal();
              }
            });
          }
          document.addEventListener("keydown", function(evt){
            if (evt.key !== "Escape" || !state.refs) return;
            if (state.refs.confirmModal && state.refs.confirmModal.classList.contains("show")){
              closeConfirmModal(false);
            }
            if (state.refs.alertModal && state.refs.alertModal.classList.contains("show")){
              closeAlertModal();
            }
            if (state.refs.totpRequiredModal && state.refs.totpRequiredModal.classList.contains("show")){
              closeTotpRequiredModal();
            }
            if (state.refs.totpModal && !state.refs.totpModal.classList.contains("hidden")){
              closeTotpModal(null);
            }
          });
        }

        function handleCopyMyWebuid(){
          var val = state.profile && state.profile.webuid;
          copyText(val || "").then(function(){
            showToast("تم نسخ الايدي", true);
          }).catch(function(){
            showToast("تعذر النسخ", false);
          });
        }

        function closeConfirmModal(approved){
          if (!state.refs || !state.refs.confirmModal) return;
          state.refs.confirmModal.classList.remove("show");
          state.refs.confirmModal.setAttribute("aria-hidden","true");
          document.documentElement.classList.remove("transfer-modal-open");
          document.body.classList.remove("transfer-modal-open");
          if (state.confirmResolver){
            state.confirmResolver(!!approved);
            state.confirmResolver = null;
          }
        }

        function showConfirmModal(params){
          if (!state.refs || !state.refs.confirmModal){
            return Promise.resolve(false);
          }
          mountConfirmModalPortal();
          var receiver = params && params.receiver ? params.receiver : "--";
          var webuid = params && params.webuid ? params.webuid : "--";
          var amount = params && params.amount ? params.amount : 0;
          var fee = (params && params.fee != null) ? params.fee : TRANSFER_FEE;
          var total = (params && params.total != null) ? params.total : (Number(amount) + Number(fee));
          state.refs.confirmReceiver.textContent = receiver;
          state.refs.confirmWebuid.textContent = webuid;
          state.refs.confirmAmount.textContent = formatBalance(amount);
          if (state.refs.confirmFee) state.refs.confirmFee.textContent = formatBalance(fee);
          if (state.refs.confirmTotal) state.refs.confirmTotal.textContent = formatBalance(total);
          state.refs.confirmModal.classList.add("show");
          state.refs.confirmModal.setAttribute("aria-hidden","false");
          document.documentElement.classList.add("transfer-modal-open");
          document.body.classList.add("transfer-modal-open");
          return new Promise(function(resolve){
            state.confirmResolver = resolve;
          });
        }

        function updateRecipientPreview(status, payload){
          var card = state.refs && state.refs.recipientCard;
          var nameEl = state.refs && state.refs.recipientName;
          var hintEl = state.refs && state.refs.recipientHint;
          if (!card || !nameEl || !hintEl) return;
          var stateName = status || "idle";
          card.setAttribute("data-state", stateName);
          if (stateName === "loading"){
            nameEl.textContent = "جارِ البحث عن المستلم...";
            hintEl.textContent = "نحتاج إلى الاسم قبل تأكيد التحويل.";
          } else if (stateName === "found"){
            var data = payload || state.recipientInfo || {};
            var username = data.username || "مستخدم بدون اسم";
            var webuid = data.webuid || "";
            nameEl.textContent = username;
            var hint = webuid ? ("المعرف: " + webuid) : "تم العثور على المستلم.";
            if (data.level) hint += " أ¢â‚¬آ¢ طآ§ظâ€‍ظ…طآ³تظث†ظâ€°: " + data.level;
            hintEl.textContent = hint;
          } else if (stateName === "error"){
            nameEl.textContent = "تعذر العثور على اسم المستلم.";
            hintEl.textContent = (payload && payload.message) ? payload.message : "تحقق من webuid وأعد المحاولة.";
          } else if (stateName === "need-login"){
            nameEl.textContent = "سجّل الدخول للبحث عن المستلم.";
            hintEl.textContent = "نسجّل الاسم فور تسجيل الدخول.";
          } else {
            nameEl.textContent = "أدخل webuid للتحقق من اسم المستلم.";
            hintEl.textContent = "لن نبدأ التحويل قبل ظهور الاسم.";
          }
        }

        function scheduleRecipientLookup(value, immediate){
          if (!state.refs || !state.refs.target) return;
          var next = normalizeWebuid(value != null ? value : state.refs.target.value);
          if (state.lookupTimer) clearTimeout(state.lookupTimer);
          if (state.recipientInfo && state.recipientInfo.webuid && state.recipientInfo.webuid !== next){
            state.recipientInfo = null;
          }
          if (!next){
            state.recipientInfo = null;
            updateRecipientPreview(state.currentUser ? "idle" : "need-login");
            return;
          }
          updateRecipientPreview("loading");
          var runner = function(){ lookupRecipient(next).catch(function(){}); };
          if (immediate){
            runner();
          } else {
            state.lookupTimer = setTimeout(runner, 350);
          }
        }

        function lookupRecipient(target){
          var webuid = normalizeWebuid(target);
          if (!webuid){
            state.recipientInfo = null;
            updateRecipientPreview(state.currentUser ? "idle" : "need-login");
            return Promise.resolve(null);
          }
          if (!state.currentUser){
            updateRecipientPreview("need-login");
            return Promise.resolve(null);
          }
          updateRecipientPreview("loading");
          return state.currentUser.getIdToken().then(function(token){
            var payload = {
              action: "lookup",
              targetWebuid: webuid,
              guardToken: generateGuardToken("lookup")
            };
            return fetch(buildApiUrl(), {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + token
              },
              body: JSON.stringify(payload)
            });
          }).then(async function(res){
            var data = await res.json().catch(function(){ return {}; });
            if (!res.ok || data.success === false){
              throw createError(data.code || "lookup_failed", data.error || "تعذر العثور على المستلم.");
            }
            var info = {
              webuid: data.webuid || webuid,
              username: data.username || data.name || "",
              level: data.level || null
            };
            state.recipientInfo = info;
            updateRecipientPreview("found", info);
            return info;
          }).catch(function(err){
            state.recipientInfo = null;
            updateRecipientPreview("error", { message: err && err.message ? err.message : "تعذر العثور على المستلم." });
            return null;
          });
        }

        function bindAuth(){
          ensureFirebase();
          if (!state.auth){
            if (state.authBindPromise) return state.authBindPromise;
            if (state.refs) {
              setFormDisabled(true);
              showStatus("info", "جاري تجهيز اتصال Firebase...");
            }
            var waitForFirebase = (typeof window.__ensureInlineFirebaseReady === "function")
              ? window.__ensureInlineFirebaseReady({ db: true })
              : Promise.resolve(null);
            state.authBindPromise = waitForFirebase.then(function(){
              state.authBindPromise = null;
              ensureFirebase();
              if (!state.auth){
                setNeedLogin();
                return false;
              }
              return bindAuth();
            }).catch(function(){
              state.authBindPromise = null;
              setNeedLogin();
              return false;
            });
            return state.authBindPromise;
          }
          if (state.unsubAuth) return Promise.resolve(true);
          state.unsubAuth = state.auth.onAuthStateChanged(function(user){
            state.currentUser = user || null;
            if (!user){
              state.totpEnabled = null;
              state.totpVia = "";
              state.totpRequiredPrompted = false;
              state.totpLoading = false;
              state.totpCheckedAt = 0;
              state.totpPromise = null;
              totpEmailCooldownUntilMs = 0;
              stopTotpEmailCooldownTimer();
              state.profile = null;
              state.profilePromise = null;
              state.profileUid = "";
              state.profileLoadedAt = 0;
              closeTotpRequiredModal();
              updateProfileUI();
              setNeedLogin();
              return;
            }
            state.totpEnabled = readLocalTotpEnabled(user.uid);
            state.totpVia = "";
            state.totpRequiredPrompted = false;
            totpEmailCooldownUntilMs = 0;
            stopTotpEmailCooldownTimer();
            closeTotpRequiredModal();
            syncTotpStatus(true);
            setFormDisabled(false);
            loadProfile(user);
          });
          return Promise.resolve(true);
        }

        function setNeedLogin(){
          state.recipientInfo = null;
          state.totpEnabled = null;
          state.totpVia = "";
          state.totpCheckedAt = 0;
          state.totpLoading = false;
          state.totpPromise = null;
          setFormDisabled(true);
          showStatus("info","سجّل الدخول لاستخدام تحويل الرصيد.");
          if (state.refs && state.refs.helper){
            renderHelperLines(["تحتاج إلى تسجيل الدخول لتستطيع التحويل."], false);
          }
          updateRecipientPreview("need-login");
        }

        function setFormDisabled(disabled){
          if (!state.refs) return;
          var lock = disabled || state.loading;
          if (state.refs.target) state.refs.target.disabled = lock;
          if (state.refs.amount) state.refs.amount.disabled = lock;
          if (state.refs.submit) state.refs.submit.disabled = lock;
          if (!lock) updateSubmitState();
        }

        function loadProfile(user, options){
          if (!user || !state.db){
            showStatus("error","تعذر تحميل معلومات المستخدم.");
            return Promise.resolve(null);
          }
          var uid = String(user.uid || "");
          var opts = options && typeof options === "object" ? options : {};
          var force = !!opts.force;
          if (!force && state.profile && state.profile.uid === uid && state.profileLoadedAt && (Date.now() - state.profileLoadedAt) < 10000) {
            return Promise.resolve(state.profile);
          }
          if (!force && state.profilePromise && state.profileUid === uid) return state.profilePromise;
          try{
            setFormDisabled(true);
            showStatus("info","جاري تحميل بياناتك...");
            var applyTransferProfile = function(webuid, balance){
              state.profile = {
                uid: uid,
                webuid: webuid || uid,
                balance: parseNumber(balance)
              };
              state.profileLoadedAt = Date.now();
              updateProfileUI();
              showStatus();
              setFormDisabled(false);
              return state.profile;
            };
            var onProfileFail = function(err){
              state.profile = null;
              state.profileLoadedAt = 0;
              updateProfileUI();
              setFormDisabled(true);
              showStatus("error", err && err.message ? err.message : "تعذر تحميل بيانات المستخدم.");
              return null;
            };
            // Customer balance + webuid come ONLY from the server (D1 + Neon) carrying
            // the session key — never a direct Firebase users/{uid} read (that path is
            // closed on the rules side). On a hard miss (dead session) we surface a
            // re-login prompt rather than touching Firebase.
            var onProfileServerMiss = function(){
              return onProfileFail(new Error("تعذر تحميل بياناتك من الخادم. أعد تسجيل الدخول وحاول مجدداً."));
            };
            var profilePromise = (typeof window.__fetchAccountInfoFromServer === "function"
              ? window.__fetchAccountInfoFromServer(uid).then(function(info){
                  if (info && info.account) {
                    return applyTransferProfile(info.account.webuid, info.balance);
                  }
                  return onProfileServerMiss();
                }).catch(onProfileServerMiss)
              : onProfileServerMiss()
            ).finally(function(){
              if (state.profilePromise === profilePromise) {
                state.profilePromise = null;
                state.profileUid = "";
              }
            });
            state.profileUid = uid;
            state.profilePromise = profilePromise;
            return profilePromise;
          }catch(_){
            setFormDisabled(true);
            showStatus("error","تعذر الوصول لقاعدة البيانات.");
            return Promise.resolve(null);
          }
        }

        function updateProfileUI(){
          if (!state.refs) return;
          if (state.profile){
            if (state.refs.balance) state.refs.balance.textContent = formatBalance(state.profile.balance);
            if (state.refs.senderWebuid) state.refs.senderWebuid.textContent = state.profile.webuid || "--";
            setFormDisabled(false);
            updateRecipientPreview("idle");
            if (state.totpEnabled == null) syncTotpStatus(false);
            if (state.refs.target && state.refs.target.value){
              scheduleRecipientLookup(state.refs.target.value, true);
            }
          } else {
            if (state.refs.balance) state.refs.balance.textContent = "--";
            if (state.refs.senderWebuid) state.refs.senderWebuid.textContent = "--";
            setFormDisabled(true);
            updateRecipientPreview("need-login");
          }
          updateHelperText();
        }

        function formatBdi(value){
          return '<bdi dir="ltr">' + String(value == null ? "" : value) + '</bdi>';
        }

        function renderHelperLines(lines, warn){
          var helper = state.refs && state.refs.helper;
          if (!helper) return;
          helper.innerHTML = "";
          (lines || []).forEach(function(line){
            var row = document.createElement("div");
            row.className = "transfer-helper-line";
            row.innerHTML = line;
            helper.appendChild(row);
          });
          helper.classList.toggle("warn", !!warn);
        }

        function updateHelperText(){
          if (!state.refs || !state.refs.helper) return;
          if (!state.profile){
            renderHelperLines(["أدخل بياناتك بعد تسجيل الدخول للبدء."], false);
            updateSubmitState();
            return;
          }
          if (state.totpLoading){
            renderHelperLines(["جاري التحقق من المصادقة الثنائية..."], false);
            updateSubmitState();
            return;
          }
          var totpMissing = state.totpEnabled !== true;
          if (totpMissing){
            promptTotpRequiredOnce();
          }
          var amount = Number(state.refs.amount && state.refs.amount.value);
          var limits = syncTransferLimits();
          var dailyRemaining = limits ? getDailyRemaining(limits) : DAILY_LIMIT;
          var cooldownRemaining = limits ? getCooldownRemaining(limits) : 0;
          if (cooldownRemaining > 0) scheduleCooldownTick();
          if (!Number.isFinite(amount) || amount <= 0){
            var baseMsg = "أدخل قيمة التحويل المطلوبة.";
            var lines = [baseMsg];
            if (limits){
              if (dailyRemaining <= 0) lines.push("لقد وصلت إلى الحد اليومي للتحويلات.");
              if (cooldownRemaining > 0) lines.push("التهدئة: " + formatBdi(cooldownRemaining) + " ثانية");
            }
            renderHelperLines(lines, dailyRemaining === 0 || cooldownRemaining > 0);
            updateSubmitState();
            return;
          }
          var fee = TRANSFER_FEE;
          var total = amount + fee;
          var remaining = (state.profile.balance || 0) - total;
          var linesWithAmount = [];
          if (remaining < -0.0001){
            linesWithAmount.push("القيمة المطلوبة تتجاوز رصيدك الحالي.");
          }
          linesWithAmount.push("العمولة: " + formatBdi(formatBalance(fee)));
          linesWithAmount.push("الإجمالي: " + formatBdi(formatBalance(total)));
          if (remaining >= -0.0001){
            linesWithAmount.push("الرصيد بعد التحويل: " + formatBdi(formatBalance(Math.max(remaining, 0))));
          }
          if (limits){
            if (dailyRemaining <= 0) linesWithAmount.push("لقد وصلت إلى الحد اليومي للتحويلات.");
            if (cooldownRemaining > 0) linesWithAmount.push("التهدئة: " + formatBdi(cooldownRemaining) + " ثانية");
          }
          renderHelperLines(linesWithAmount, remaining < -0.0001 || dailyRemaining === 0 || cooldownRemaining > 0);
          updateSubmitState();
        }

        function showStatus(type, message){
          var box = state.refs && state.refs.status;
          if (!box) return;
          if (!message){
            box.className = "transfer-status";
            box.textContent = "";
            return;
          }
          box.className = "transfer-status show " + (type || "info");
          box.textContent = message;
        }

        function updateSubmitState(){
          if (!state.refs || !state.refs.submit) return;
          if (!state.profile || state.loading){
            state.refs.submit.disabled = true;
            return;
          }
          var guard = canStartTransfer();
          if (!guard.ok){
            state.refs.submit.disabled = true;
            return;
          }
          state.refs.submit.disabled = false;
        }

        function setLoading(loading, hint){
          state.loading = !!loading;
          setFormDisabled(!state.profile || state.loading);
          try {
            if (state.loading) {
              if (typeof window.__holdPageLoader === "function") {
                window.__holdPageLoader();
              } else if (typeof showPageLoader === "function") {
                showPageLoader({ hold: true });
              }
            } else if (typeof window.__releasePageLoader === "function") {
              window.__releasePageLoader();
            } else if (typeof hidePageLoader === "function") {
              hidePageLoader();
            }
          } catch (_) {}
          if (loading && hint) showStatus("info", hint);
        }

        function submitTransfer(target, amount, factorPayload){
          return new Promise(function(resolve, reject){
            var user = state.currentUser;
            if (!user) { reject(createError("auth_required","سجّل الدخول أولاً.")); return; }
            var sessionKey = readSessionKey();
            if (!sessionKey) { reject(createError("session_missing","يرجى إعادة تسجيل الدخول لتجديد الجلسة.")); return; }
            Promise.all([user.getIdToken(true)]).then(function(results){
              var token = results[0];
              var guardToken = generateGuardToken("transfer");
              var amountNumber = Number(amount);
              var fee = TRANSFER_FEE;
              var total = amountNumber + fee;
              var payload = {
                action: "transfer",
                targetWebuid: target,
                amount: amountNumber,
                fee: fee,
                totalAmount: total,
                guardToken: guardToken,
                turnstileToken: guardToken,
                currentUrl: window.location.href
              };
              var factors = (factorPayload && typeof factorPayload === "object") ? factorPayload : {};
              var safeTotpCode = normalizeTotpCode(factors.totpCode);
              var safeTelegramCode = normalizeTotpCode(factors.telegramCode);
              if (safeTotpCode) payload.code = safeTotpCode;
              if (safeTelegramCode) payload.telegramCode = safeTelegramCode;
              return fetch(buildApiUrl(), {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": "Bearer " + token,
                  "X-SessionKey": sessionKey,
                  "X-Guard-Token": guardToken
                },
                body: JSON.stringify(payload)
              });
            }).then(async function(res){
              var data = await res.json().catch(function(){ return {}; });
              if (!res.ok || data.success === false || data.ok === false){
                var msg = (data && data.error) ? data.error : "فشل تنفيذ التحويل.";
                reject(createError(data && data.code, msg, data && data.details));
                return;
              }
              resolve({
                code: data.code || data.transferCode || "",
                transferCode: data.transferCode || data.code || "",
                amount: Number(data.amount != null ? data.amount : amount),
                fee: Number(data.fee != null ? data.fee : fee),
                totalAmount: Number(data.totalAmount != null ? data.totalAmount : total),
                currency: data.currency || "USD",
                senderBalance: Number(data.senderBalance),
                receiverWebuid: data.receiverWebuid || target,
                receiverName: data.receiverName || ""
              });
            }).catch(function(err){
              reject(createError(err && err.code, err && err.message ? err.message : "تعذر تنفيذ التحويل.", err && err.details));
            });
          });
        }

        function updateCachedBalance(value){
          var val = Number(value);
          if (!Number.isFinite(val)) return;
          try { window.__BAL_BASE__ = val; window.__BALANCE__ = val; } catch(_){}
          try {
            var formatted = (typeof window.formatCurrencyFromJOD === "function")
              ? window.formatCurrencyFromJOD(val)
              : (val.toFixed(3) + " $");
            if (typeof window.__setHeaderBalanceDisplay === "function") {
              window.__setHeaderBalanceDisplay(formatted);
            } else {
              var textEl = document.getElementById("headerBalanceText");
              var currencyEl = document.getElementById("headerBalanceCurrency");
              if (textEl){
                var parts = String(formatted || "").trim().split(/\s+/);
                textEl.textContent = parts.shift() || formatted;
                if (currencyEl) currencyEl.textContent = parts.join(" ") || "";
              }
            }
            window.dispatchEvent(new CustomEvent("balance:change", { detail: { value: val, formatted: formatted } }));
          } catch(_){}
          var uid = state.currentUser && state.currentUser.uid;
          if (uid){
            try { if (typeof writeBalanceMemory === "function") writeBalanceMemory(uid, val); } catch(_){}
            // Persist to the localStorage cache the header seeds from, so the new
            // balance survives reload / re-render without waiting for Firebase.
            try { localStorage.setItem('balance:cache:' + uid, String(val)); } catch(_){}
          }
        }

        async function handleSubmit(e){
          if (e && typeof e.preventDefault === "function") e.preventDefault();
          if (!state.refs || state.loading) return;
          var target = normalizeWebuid(state.refs.target && state.refs.target.value);
          var amount = Number(state.refs.amount && state.refs.amount.value);
          var fee = TRANSFER_FEE;
          var total = amount + fee;
          if (!target){
            showStatus("error","أدخل webuid المستلم.");
            updateRecipientPreview("error", { message: "أدخل webuid المستلم." });
            return;
          }
          if (!Number.isFinite(amount) || amount <= 0){
            showStatus("error","أدخل قيمة صالحة للتحويل.");
            return;
          }
          if (state.profile && total - (state.profile.balance || 0) > 0.0001){
            showStatus("error","القيمة المطلوبة تتجاوز رصيدك الحالي.");
            return;
          }
          var guard = canStartTransfer();
          if (!guard.ok){
            if (guard.code === "totp_required"){
              promptTotpRequiredOnce();
              showStatus();
            } else if (guard.code === "same_account"){
              showStatus();
              openAlertModal(guard.message || "لا يمكنك التحويل إلى حسابك نفسه");
            } else {
              showStatus("error", guard.message || "تعذر تنفيذ التحويل حالياً.");
            }
            updateHelperText();
            return;
          }
          showStatus("info","جارٍ تجهيز التحويل...");
          try{
            var recipientInfo = (state.recipientInfo && state.recipientInfo.webuid === target) ? state.recipientInfo : null;
            if (!recipientInfo){
              recipientInfo = await lookupRecipient(target);
            }
            if (!recipientInfo || recipientInfo.webuid !== target){
              showStatus("error","تعذر التحقق من اسم المستلم.");
              updateRecipientPreview("error", { message: "تحقق من الايدي ثم اضغط تأكيد التحويل مرة أخرى." });
              return;
            }
            var receiverLabel = recipientInfo && recipientInfo.username
              ? recipientInfo.username + " (" + (recipientInfo.webuid || target) + ")"
              : target;
            var approved = await showConfirmModal({
              receiver: (recipientInfo && recipientInfo.username) ? recipientInfo.username : "مستخدم",
              webuid: (recipientInfo && recipientInfo.webuid) ? recipientInfo.webuid : target,
              amount: amount,
              fee: fee,
              total: total
            });
            if (!approved){
              showStatus("info","تم إلغاء الطلب قبل الإرسال.");
              return;
            }
            var result = null;
            var totpError = "";
            var challengeMethod = normalizeTotpChallengeMethod(state.totpVia);
            while (true){
              var statusMessage = challengeMethod === "telegram"
                ? "يرجى إدخال رمز تيليغرام لإكمال التحويل."
                : (challengeMethod === "app"
                  ? "يرجى إدخال رمز التحقق من التطبيق لإكمال التحويل."
                  : "يرجى إدخال رمز التحقق لإكمال التحويل.");
              showStatus("info", statusMessage);
              var subtitle = challengeMethod === "telegram"
                ? "ادخل الكود المستلم على تيليغرام."
                : (challengeMethod === "app"
                  ? "من فضلك افتح تطبيق Google Authenticator وأدخل الكود المكوّن من 6 أرقام."
                  : "أدخل رمز التحقق المكوّن من 6 أرقام.");
              var requestEmailCode = (challengeMethod === "app")
                ? null
                : function(){ return requestTransferTelegramOtpCode(); };
              var enteredCode = await requestTotpCodeWithModal({
                method: challengeMethod,
                subtitle: subtitle,
                error: totpError,
                requestEmailCode: requestEmailCode
              });
              if (!enteredCode){
                showStatus("info","تم إلغاء الطلب قبل الإرسال.");
                return;
              }
              var factorPayload = {};
              if (challengeMethod === "telegram") {
                factorPayload.telegramCode = enteredCode;
              } else if (challengeMethod === "app") {
                factorPayload.totpCode = enteredCode;
              } else {
                factorPayload.totpCode = enteredCode;
                factorPayload.telegramCode = enteredCode;
              }
              markTransferAttempt();
              setLoading(true, "جاري تنفيذ التحويل...");
              try{
                result = await submitTransfer(target, amount, factorPayload);
                break;
              } catch(err){
                setLoading(false);
                if (err && (
                  err.code === "totp_required" ||
                  err.code === "totp_code_invalid" ||
                  err.code === "telegram_otp_required" ||
                  err.code === "telegram_otp_invalid" ||
                  err.code === "telegram_otp_expired"
                )){
                  var serverMethod = resolveTransferTotpMethodFromError(err, challengeMethod);
                  if (serverMethod) challengeMethod = serverMethod;
                  state.totpVia = challengeMethod || state.totpVia || "";
                  totpError = err.message || "رمز التحقق غير صحيح.";
                  continue;
                }
                throw err;
              }
            }
            if (state.refs && state.refs.form) state.refs.form.reset();
            markTransferSuccess();
            if (state.profile && Number.isFinite(result.senderBalance)){
              state.profile.balance = result.senderBalance;
              updateProfileUI();
              updateCachedBalance(result.senderBalance);
            } else if (state.profile){
              state.profile.balance = Math.max(0, (state.profile.balance || 0) - total);
              updateProfileUI();
            }
            var receiverDisplay = "";
            if (result && result.receiverName){
              receiverDisplay = result.receiverName + " (" + (result.receiverWebuid || target) + ")";
            } else if (recipientInfo && recipientInfo.username){
              receiverDisplay = recipientInfo.username + " (" + (result.receiverWebuid || target) + ")";
            } else {
              receiverDisplay = (result.receiverWebuid || target);
            }
            state.recipientInfo = null;
            updateRecipientPreview("idle");
            updateHelperText();
            showStatus("success","تم تحويل " + formatBalance(result.amount || amount) + " إلى " + receiverDisplay + " . (عمولة " + formatBalance(fee) + ")");
            try { suspendWalletCreditMotionWatcher(15000); } catch (_) {}
            openTransferReceiptModal({
              senderWebuid: state.profile && state.profile.webuid,
              receiverWebuid: result.receiverWebuid || target,
              receiverName: (result.receiverName || (recipientInfo && recipientInfo.username) || "").trim(),
              amount: result.amount != null ? result.amount : amount,
              fee: result.fee != null ? result.fee : fee,
              totalAmount: result.totalAmount != null ? result.totalAmount : total,
              currency: result.currency || "USD",
              transferCode: result.transferCode || result.code || ""
            });
          } catch(err){
            if (err && err.code === "same_account"){
              showStatus();
              openAlertModal(err.message || "لا يمكنك التحويل إلى حسابك نفسه");
            } else {
              showStatus("error", err && err.message ? err.message : "تعذر تنفيذ التحويل.");
            }
          } finally {
            setLoading(false);
          }
        }

        function build(){
          var frag = document.createDocumentFragment();
          frag.appendChild(ensureRoot());
          bindAuth();
          return frag;
        }

        function onShow(){
          ensureRoot();
          var authReady = bindAuth();
          var tasks = [];
          return Promise.resolve(authReady).then(function(){
            if (state.currentUser && !state.profile){
              tasks.push(loadProfile(state.currentUser));
            }
            if (state.currentUser) tasks.push(syncTotpStatus(false));
            updateHelperText();
            return Promise.all(tasks).catch(function(){
              return [];
            }).then(function(){
              updateHelperText();
              return true;
            });
          });
        }

        function prewarm(){
          try { queueI18nPrewarm(state.root || ensureRoot, { maxItems: 220 }); } catch(_){}
        }

        return {
          build: build,
          onShow: onShow,
          ready: function(){ return true; },
          prewarm: prewarm
        };
      })();
      var apiRoute = (function(){
        var state = {
          root: null,
          initialized: false,
          currentUser: null,
          currentUid: '',
          tokenStateCheckedUid: '',
          tokenStateAutoSyncUid: '',
          tokenStateAutoSyncAt: 0,
          authUnsub: null,
          authWaitPromise: null,
          authResumePromise: null,
          busy: false,
          docsBusy: false,
          docsRaw: {},
          docsExpanded: {},
          seq: 0,
          tokenStateInFlight: null,
          tokenStateLastData: null,
          tokenStateLastAt: 0,
          tokenStateLastAttemptAt: 0,
          tokenStateLastDeniedAt: 0,
          tokenStateAuthRejected: false
        };

        var API_FALLBACK_BASE = '';
        var API_DOCS_SHARE_PATH = '/api-docs';
        var API_ACCESS_CACHE_PREFIX = 'api:access:enabled:';
        var API_STATE_REQUEST_COOLDOWN_MS = 10000;

        function parseApiBool(value){
          if (value == null) return null;
          if (typeof value === 'boolean') return value;
          if (typeof value === 'number') return value !== 0;
          var raw = String(value || '').trim().toLowerCase();
          if (!raw) return null;
          if (['1', 'true', 'on', 'yes', 'enabled', 'active'].indexOf(raw) >= 0) return true;
          if (['0', 'false', 'off', 'no', 'disabled', 'inactive'].indexOf(raw) >= 0) return false;
          return null;
        }

        function readApiAccessCache(uid){
          var keyUid = String(uid || '').trim();
          if (!keyUid) return null;
          try {
            var raw = localStorage.getItem(API_ACCESS_CACHE_PREFIX + keyUid);
            var parsed = parseApiBool(raw);
            return parsed == null ? null : parsed;
          } catch (_) {
            return null;
          }
        }

        function writeApiAccessCache(uid, enabled){
          var keyUid = String(uid || '').trim();
          if (!keyUid) return;
          try { localStorage.setItem(API_ACCESS_CACHE_PREFIX + keyUid, enabled ? '1' : '0'); } catch (_){}
        }

        function resolveCurrentUid(){
          try {
            if (state.currentUser && state.currentUser.uid) return String(state.currentUser.uid || '').trim();
          } catch (_) {}
          try {
            if (typeof firebase !== 'undefined' && firebase && typeof firebase.auth === 'function') {
              var authInst = firebase.auth();
              var user = authInst && authInst.currentUser;
              if (user && user.uid) return String(user.uid || '').trim();
            }
          } catch (_) {}
          try {
            var rawInfo = localStorage.getItem('sessionKeyInfo');
            if (rawInfo) {
              var parsedInfo = JSON.parse(rawInfo);
              if (parsedInfo && parsedInfo.uid) return String(parsedInfo.uid || '').trim();
            }
          } catch (_) {}
          try {
            var lastUid = String(localStorage.getItem('auth:lastUid') || localStorage.getItem('session:lastUid') || '').trim();
            if (lastUid) return lastUid;
          } catch (_) {}
          return '';
        }

        function readCurrentApiAccessCache(){
          var uid = resolveCurrentUid();
          if (!uid) return null;
          return readApiAccessCache(uid);
        }

        function normalizeBaseUrl(value){
          if (!value) return '';
          var out = String(value).trim();
          if (!out) return '';
          if (!/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(out)) {
            if (out.indexOf('/') === 0) out = location.origin + out;
            else out = location.origin + '/' + out;
          }
          if (!/\/$/.test(out)) out += '/';
          return out;
        }

        function readPublicSiteOriginFromMeta(){
          var candidates = [];
          try {
            var canonical = document.querySelector('link[rel="canonical"]');
            if (canonical && canonical.href) candidates.push(canonical.href);
          } catch (_){}
          try {
            var og = document.querySelector('meta[property="og:url"]');
            var ogValue = og && og.getAttribute ? og.getAttribute('content') : '';
            if (ogValue) candidates.push(ogValue);
          } catch (_){}
          for (var i = 0; i < candidates.length; i += 1) {
            try {
              var parsed = new URL(String(candidates[i] || '').trim());
              var host = String(parsed.hostname || '').trim().toLowerCase();
              if (!host) continue;
              var isLocal = host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || /^0\.0\.0\.0$/.test(host) || /^\d+\.\d+\.\d+\.\d+$/.test(host);
              if (isLocal) continue;
              return parsed.origin;
            } catch (_){}
          }
          return '';
        }

        function deriveApiBaseFromOrigin(origin){
          var text = String(origin || '').trim();
          if (!text) return '';
          try {
            var parsed = new URL(text);
            var host = String(parsed.hostname || '').trim();
            if (!host) return '';
            if (host.indexOf('api.') === 0) return parsed.origin.replace(/\/+$/, '') + '/';
            parsed.hostname = 'api.' + host.replace(/^www\./i, '');
            return parsed.origin.replace(/\/+$/, '') + '/';
          } catch (_){
            return '';
          }
        }

        function defaultApiBase(){
          try {
            if (window.__getSiteWorkerBase) {
              var liveBase = String(window.__getSiteWorkerBase({ trailingSlash: true, allowStorageOverride: true }) || '').trim();
              if (liveBase) return liveBase;
            }
          } catch (_){}
          try {
            if (window.__getSiteWorkerBaseDefault) {
              var workerBase = String(window.__getSiteWorkerBaseDefault({ trailingSlash: true }) || '').trim();
              if (workerBase) return workerBase;
            }
          } catch (_){}
          var host = location.hostname || '';
          var protocol = location.protocol || 'https:';
          var metaOrigin = readPublicSiteOriginFromMeta();
          var metaBase = deriveApiBaseFromOrigin(metaOrigin);
          if (metaBase && (host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || /^\d+\.\d+\.\d+\.\d+$/.test(host))) {
            return metaBase;
          }
          if (!host) return '';
          var isLocal = host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || /^\d+\.\d+\.\d+\.\d+$/.test(host);
          if (isLocal) return location.origin + '/';
          if (host.indexOf('api.') === 0) return protocol + '//' + host + '/';
          var cleanHost = host.replace(/^www\./i, '');
          return protocol + '//api.' + cleanHost + '/';
        }

        function buildApiDocsShareUrl(baseValue){
          var normalizedBase = normalizeBaseUrl(baseValue) || defaultApiBase() || '';
          var docsUrl = API_DOCS_SHARE_PATH;
          try {
            docsUrl = new URL(API_DOCS_SHARE_PATH, normalizedBase || (location.origin + '/')).toString();
          } catch (_) {
            try { docsUrl = String(normalizedBase || location.origin || '').replace(/\/+$/, '') + '/api-docs'; } catch (__){}
          }
          return docsUrl;
        }

        function resolveApiCallUrl(path){
          var override = '';
          try { override = window.API_BASE_URL || document.documentElement.getAttribute('data-api-base'); } catch (_) {}
          var runtimeBase = '';
          try {
            if (window.__getSiteWorkerBase) {
              runtimeBase = String(window.__getSiteWorkerBase({ trailingSlash: true, allowStorageOverride: true }) || '').trim();
            }
          } catch (_){}
          var base = normalizeBaseUrl(override) || normalizeBaseUrl(runtimeBase) || defaultApiBase() || (location.origin ? (location.origin + '/') : '');
          var route = String(path || '').replace(/^\/+/, '');
          try { return new URL(route, base).toString(); }
          catch (_) { return String(base || '') + route; }
        }

        function ensureRoot(){
          if (state.root) return state.root;
          var root = document.createElement('div');
          root.id = 'apiInlineRoot';
          root.innerHTML = [
            '<section class="api-inline-card" id="apiInlineTokenCard">',
            '  <h3 class="api-inline-title" style="font-size:1.28rem">مفتاح API الخاص بك</h3>',
            '  <div class="api-inline-row">',
            '    <span class="api-inline-label">Token</span>',
            '    <input id="apiInlineTokenInput" class="api-inline-input" type="text" placeholder="سيظهر التوكن هنا عند جلسة صحيحة" readonly />',
            '    <button type="button" class="api-inline-btn outline" id="apiInlineCopyTokenBtn">نسخ</button>',
            '  </div>',
            '  <div class="api-inline-actions" style="margin-top:10px">',
            '    <button type="button" class="api-inline-btn" id="apiInlineGenerateBtn">توليد توكن</button>',
            '    <button type="button" class="api-inline-btn outline" id="apiInlineRegenBtn">إعادة توليد</button>',
            '  </div>',
            '  <div class="api-inline-meta">',
            '    <span id="apiInlineTokenCreated">تاريخ التوليد: --</span>',
            '  </div>',
            '  <div id="apiInlineLoginHint" class="api-inline-note" style="display:none">يجب تسجيل الدخول أولًا.</div>',
            '  <div id="apiInlineAccessHint" class="api-inline-note" style="display:none">وصول API غير مفعل لهذا الحساب من الإدارة.</div>',
            '  <div id="apiInlineStatus" class="api-inline-status"></div>',
            '</section>',
            '<section class="api-inline-card api-inline-docs" id="apiInlineDocsCard">',
            '  <h3 class="api-inline-title" style="font-size:1.24rem">API Docs</h3>',
            '  <p class="api-inline-note">مع تزويد المبرمج بالرابط الاتي</p>',
            '  <div class="api-inline-row" style="margin-top:0;">',
            '    <span class="api-inline-label">API Docs</span>',
            '    <input id="apiInlineDocsUrlInput" class="api-inline-input" type="text" readonly />',
            '    <button type="button" class="api-inline-btn outline" data-api-copy-target="apiInlineDocsUrlInput">نسخ</button>',
            '  </div>',
            '  <div id="apiInlineDocsStatus" class="api-inline-status"></div>',
            '</section>',
          ].join('');
          state.root = root;
          return root;
        }

        function build(){
          var frag = document.createDocumentFragment();
          frag.appendChild(ensureRoot());
          return frag;
        }

        function rootEl(){
          return ensureRoot();
        }

        function byId(id){
          try { return rootEl().querySelector('#' + id); } catch (_) { return null; }
        }

        function setStatus(text, tone){
          var el = byId('apiInlineStatus');
          if (!el) return;
          el.textContent = String(text || '').trim();
          el.className = 'api-inline-status' + (tone ? (' ' + tone) : '');
        }

        function emitApiToast(message, ok){
          var text = String(message || '').trim();
          if (!text) return;
          try {
            if (typeof showToast === 'function') {
              showToast(text, ok === false ? 'error' : 'success');
              return;
            }
          } catch (_) {}
          try {
            var toast = document.createElement('div');
            toast.className = 'toast app-toast ' + (ok === false ? 'app-toast--error' : 'app-toast--success');
            toast.setAttribute('role', 'alert');
            toast.setAttribute('aria-live', 'polite');
            toast.textContent = text;
            document.body.appendChild(toast);
            setTimeout(function(){ try { toast.classList.add('is-visible'); } catch(_){} }, 20);
            setTimeout(function(){
              try { toast.classList.remove('is-visible'); } catch(_){}
              setTimeout(function(){ try { toast.remove(); } catch(_){} }, 260);
            }, 1800);
          } catch (_) {}
        }

	        function setAccessSectionsVisible(enabled){
	          var on = enabled === true;
	          var tokenCard = byId('apiInlineTokenCard');
	          var docsCard = byId('apiInlineDocsCard');
	          // Keep token card visible so status/errors never render on a blank page.
	          if (tokenCard) tokenCard.style.display = '';
	          if (docsCard) docsCard.style.display = on ? '' : 'none';
	        }

        function setButtons(canGenerate, canCopy){
          var generateBtn = byId('apiInlineGenerateBtn');
          var regenBtn = byId('apiInlineRegenBtn');
          var copyBtn = byId('apiInlineCopyTokenBtn');
          if (generateBtn) generateBtn.disabled = !canGenerate || state.busy;
          if (regenBtn) regenBtn.disabled = !canGenerate || state.busy;
          if (copyBtn) copyBtn.disabled = !canCopy || state.busy;
        }

        function setBusy(busy){
          state.busy = !!busy;
          var canGenerate = !state.busy;
          var tokenInput = byId('apiInlineTokenInput');
          var canCopy = !!(tokenInput && String(tokenInput.value || '').trim());
          setButtons(canGenerate, canCopy);
          var generateBtn = byId('apiInlineGenerateBtn');
          if (generateBtn) generateBtn.textContent = state.busy ? 'جارٍ التحميل...' : 'توليد توكن';
        }

        function formatDate(value){
          if (!value) return '--';
          try { return new Date(value).toLocaleString('ar-EG'); } catch (_) {}
          return String(value || '--');
        }

        function waitMs(ms){
          var delay = Number(ms);
          if (!Number.isFinite(delay) || delay < 0) delay = 0;
          return new Promise(function(resolve){ setTimeout(resolve, delay); });
        }

        function applyBaseUrl(){
          var baseInput = byId('apiInlineBaseInput');
          var docsInput = byId('apiInlineDocsUrlInput');
          var override = '';
          try { override = window.API_BASE_URL || document.documentElement.getAttribute('data-api-base'); } catch (_) {}
          var base = normalizeBaseUrl(override) || defaultApiBase() || '';
          var fallback = base || 'SET_API_BASE_URL';
          if (baseInput) baseInput.value = fallback;
          if (docsInput) docsInput.value = buildApiDocsShareUrl(base);
        }

        function copyText(value){
          var text = String(value || '').trim();
          if (!text) return Promise.resolve(false);
          if (navigator.clipboard && navigator.clipboard.writeText) {
            return navigator.clipboard.writeText(text).then(function(){ return true; }).catch(function(){ return false; });
          }
          try {
            var ta = document.createElement('textarea');
            ta.value = text;
            ta.setAttribute('readonly', 'readonly');
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            var ok = document.execCommand('copy');
            document.body.removeChild(ta);
            return Promise.resolve(!!ok);
          } catch (_) {
            return Promise.resolve(false);
          }
        }

        function copyById(id){
          var input = byId(id);
          if (!input) return Promise.resolve(false);
          return copyText(input.value || input.textContent || '').then(function(ok){
            if (ok) {
              setStatus('تم النسخ.', 'ok');
              emitApiToast('تم النسخ', true);
            } else {
              setStatus('تعذر النسخ.', 'err');
              emitApiToast('تعذر النسخ', false);
            }
            return ok;
          });
        }

        function setDocsStatus(text, tone){
          var el = byId('apiInlineDocsStatus');
          if (!el) return;
          el.textContent = String(text || '').trim();
          el.className = 'api-inline-status' + (tone ? (' ' + tone) : '');
        }

        function setDocsBusy(busy){
          state.docsBusy = !!busy;
          var btn = byId('apiInlineFetchDocsBtn');
          if (!btn) return;
          btn.disabled = state.docsBusy;
          btn.textContent = state.docsBusy ? 'جار التحميل..' : 'اظهار الردود';
        }

        function normalizeDocsLines(text){
          return String(text == null ? '' : text)
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n')
            .split('\n');
        }

        function getDocsReadMoreButton(codeEl){
          var pre = codeEl && codeEl.parentElement;
          if (!pre || String(pre.tagName || '').toLowerCase() !== 'pre') return null;
          var key = codeEl && codeEl.id ? String(codeEl.id).trim() : '';
          var root = pre.parentElement;
          var selector = key ? ('button.api-inline-readmore[data-api-readmore-for="' + key + '"]') : 'button.api-inline-readmore';
          var existing = root && root.querySelector ? root.querySelector(selector) : null;
          if (existing) return existing;
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'api-inline-readmore';
          if (key) btn.setAttribute('data-api-readmore-for', key);
          btn.style.display = 'none';
          pre.insertAdjacentElement('beforebegin', btn);
          return btn;
        }

        function updateDocsReadMoreButton(codeEl, key, totalLines){
          var btn = getDocsReadMoreButton(codeEl);
          if (!btn) return;
          if (!(Number(totalLines || 0) > 30)) {
            btn.style.display = 'none';
            btn.onclick = null;
            return;
          }
          var expanded = state.docsExpanded[key] === true;
          btn.style.display = 'inline-flex';
          btn.textContent = expanded ? 'إغلاق العرض' : 'قراءة المزيد';
          btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
          btn.classList.toggle('is-expanded', expanded);
          btn.onclick = function(ev){
            if (ev) ev.preventDefault();
            state.docsExpanded[key] = !(state.docsExpanded[key] === true);
            setDocsResponseText(key, state.docsRaw[key] || '', { preserveExpanded: true });
          };
        }

        function setDocsResponseText(id, text, opts){
          var el = byId(id);
          if (!el) return;
          var key = String(id || '').trim();
          var options = opts || {};
          var rawText = String(text == null ? '' : text);

          if (!key) {
            el.textContent = rawText;
            return;
          }

          state.docsRaw[key] = rawText;
          if (typeof options.forceExpanded === 'boolean') {
            state.docsExpanded[key] = options.forceExpanded;
          } else if (!options.preserveExpanded) {
            state.docsExpanded[key] = false;
          }

          var lines = normalizeDocsLines(rawText);
          var shouldCollapse = lines.length > 30;
          var expanded = state.docsExpanded[key] === true;
          var rendered = rawText;
          if (shouldCollapse && !expanded) {
            rendered = lines.slice(0, 30).join('\n') + '\n...';
          }

          el.textContent = rendered;
          updateDocsReadMoreButton(el, key, lines.length);
        }

        function formatPreviewBody(payload, text){
          if (payload && typeof payload === 'object') {
            try { return JSON.stringify(payload, null, 2); } catch (_) {}
          }
          var raw = String(text || '').trim();
          return raw || '{}';
        }

        function normalizeProductIdCandidate(value){
          if (value == null) return '';
          if (typeof value === 'number' || typeof value === 'boolean') return String(value);
          var text = String(value || '').trim();
          if (!text) return '';
          var lower = text.toLowerCase();
          if (lower === 'null' || lower === 'undefined') return '';
          return text;
        }

        function extractProductIdFromEntry(entry){
          if (!entry || typeof entry !== 'object') return '';
          var candidates = [
            entry.id,
            entry.product_id,
            entry.productId
          ];
          for (var i = 0; i < candidates.length; i += 1) {
            var id = normalizeProductIdCandidate(candidates[i]);
            if (id) return id;
          }
          return '';
        }

        function looksLikeProductEntry(entry){
          if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false;
          var hasId = !!extractProductIdFromEntry(entry);
          if (!hasId) return false;
          return !!(
            entry.name != null ||
            entry.title != null ||
            entry.price != null ||
            entry.amount != null ||
            entry.category_id != null ||
            entry.categoryId != null
          );
        }

        function collectProductIdsFromPayload(payload){
          var out = [];
          var seen = new Set();
          function pushId(value){
            var id = normalizeProductIdCandidate(value);
            if (!id || seen.has(id)) return;
            seen.add(id);
            out.push(id);
          }

          var src = (payload && typeof payload === 'object') ? payload : null;
          var candidateArrays = [];
          function pushArray(arr){
            if (!Array.isArray(arr) || !arr.length) return;
            candidateArrays.push(arr);
          }

          if (Array.isArray(src)) pushArray(src);
          if (src && typeof src === 'object') {
            [
              src.data,
              src.products,
              src.items,
              src.list,
              src.result
            ].forEach(pushArray);
            var nestedData = (src.data && typeof src.data === 'object') ? src.data : null;
            if (nestedData) {
              [
                nestedData.products,
                nestedData.items,
                nestedData.list,
                nestedData.data,
                nestedData.result
              ].forEach(pushArray);
            }
          }

          candidateArrays.forEach(function(arr){
            arr.forEach(function(item){
              if (!looksLikeProductEntry(item)) return;
              pushId(extractProductIdFromEntry(item));
            });
          });
          if (out.length) return out;

          var queue = [{ node: payload, depth: 0 }];
          var seenObj = new Set();
          while (queue.length) {
            var current = queue.shift();
            var node = current && current.node;
            var depth = Number(current && current.depth || 0);
            if (node == null) continue;

            if (Array.isArray(node)) {
              if (depth > 6) continue;
              node.forEach(function(item){
                if (looksLikeProductEntry(item)) pushId(extractProductIdFromEntry(item));
                if (item && typeof item === 'object') queue.push({ node: item, depth: depth + 1 });
              });
              continue;
            }

            if (typeof node !== 'object') continue;
            if (seenObj.has(node)) continue;
            seenObj.add(node);
            if (depth > 6) continue;

            Object.keys(node).forEach(function(key){
              var value = node[key];
              if (value == null) return;
              if (key === 'id' || key === 'product_id' || key === 'productId') {
                pushId(value);
              }
              if (value && typeof value === 'object') queue.push({ node: value, depth: depth + 1 });
            });
          }

          return out;
        }

        function pickRandomItems(list, count){
          var source = Array.isArray(list) ? list.slice() : [];
          for (var i = source.length - 1; i > 0; i -= 1) {
            var j = Math.floor(Math.random() * (i + 1));
            var tmp = source[i];
            source[i] = source[j];
            source[j] = tmp;
          }
          var limit = Math.max(1, Number(count || 1));
          return source.slice(0, Math.min(limit, source.length));
        }

        function fetchApiPreview(path, apiToken){
          var token = String(apiToken || '').trim();
          if (!token) {
            return Promise.resolve({
              ok: false,
              status: 0,
              payload: { status: 'ERROR', message: 'Api token is required' },
              text: ''
            });
          }
          return fetch(resolveApiCallUrl(path), {
            method: 'GET',
            headers: {
              'api-token': token,
              'api-key': token,
              'x-api-key': token
            }
          }).then(function(res){
            return res.text().then(function(bodyText){
              var payload = null;
              try { payload = bodyText ? JSON.parse(bodyText) : null; } catch (_) { payload = null; }
              return {
                ok: !!res.ok,
                status: Number(res.status || 0),
                payload: payload,
                text: bodyText || ''
              };
            });
          }).catch(function(err){
            return {
              ok: false,
              status: 0,
              payload: { status: 'ERROR', message: String(err && err.message || 'Network error') },
              text: ''
            };
          });
        }

        function extractOrderRefFromEntry(entry, fallbackCode){
          var source = (entry && typeof entry === 'object') ? entry : {};
          var pub = (source.public && typeof source.public === 'object') ? source.public : {};
          var orderCode = String(
            pub.code ||
            pub.orderCode ||
            pub.order_code ||
            pub.order_id ||
            source.code ||
            source.orderCode ||
            source.order_code ||
            source.order_id ||
            ''
          ).trim();
          if (!orderCode) {
            var fb = String(fallbackCode || '').trim();
            if (/^ORD[A-Z0-9]{6,}$/i.test(fb)) orderCode = fb;
          }
          var orderUuid = String(
            pub.order_uuid ||
            pub.orderUuid ||
            source.order_uuid ||
            source.orderUuid ||
            ''
          ).trim();
          if (!orderCode) return null;
          return { orderCode: orderCode, orderUuid: orderUuid };
        }

        function extractOrderRefFromDocData(data){
          var src = (data && typeof data === 'object') ? data : {};
          var byCode = (src.byCode && typeof src.byCode === 'object') ? src.byCode : null;
          if (byCode) {
            var keys = Object.keys(byCode);
            for (var i = 0; i < keys.length; i += 1) {
              var key = keys[i];
              var ref = extractOrderRefFromEntry(byCode[key], key);
              if (ref && ref.orderCode) return ref;
            }
          }
          var list = Array.isArray(src.orders) ? src.orders : [];
          for (var j = 0; j < list.length; j += 1) {
            var itemRef = extractOrderRefFromEntry(list[j], '');
            if (itemRef && itemRef.orderCode) return itemRef;
          }
          return null;
        }

        function resolveAnyOwnedOrderRef(uid){
          var safeUid = String(uid || '').trim();
          if (!safeUid) return Promise.resolve(null);
          if (typeof fetchOrdersFromServer !== 'function') return Promise.resolve(null);
          return fetchOrdersFromServer(safeUid, { limit: 1 }).then(function(orders){
            var list = Array.isArray(orders) ? orders : [];
            for (var i = 0; i < list.length; i += 1) {
              var ref = extractOrderRefFromEntry(list[i], list[i] && list[i].code || '');
              if (ref && ref.orderCode) return ref;
            }
            return null;
          }).catch(function(){ return null; });
        }

        function loadLiveDocsResponses(opts){
          var options = opts || {};
          if (state.docsBusy) return Promise.resolve(false);

          var tokenInput = byId('apiInlineTokenInput');
          var token = String(tokenInput && tokenInput.value || '').trim();
          if (!token) {
            if (!options.silentNoToken) {
              setDocsStatus('لا يمكن جلب الردود الفعلية بدون التوكن. قم بتوليد أو إعادة توليد التوكن أولًا.', 'err');
              setDocsResponseText('apiInlineProfileResp', 'قم بتوليد التوكن ثم اضغط "جلب الردود الفعلية".');
              setDocsResponseText('apiInlineProductsResp', 'قم بتوليد التوكن ثم اضغط "جلب الردود الفعلية".');
              setDocsResponseText('apiInlineProductsFilterReq', 'قم بتوليد التوكن ثم اضغط "جلب الردود الفعلية".');
              setDocsResponseText('apiInlineProductsFilterResp', 'قم بتوليد التوكن ثم اضغط "جلب الردود الفعلية".');
              setDocsResponseText('apiInlineProductsBaseResp', 'قم بتوليد التوكن ثم اضغط "جلب الردود الفعلية".');
              setDocsResponseText('apiInlineContentResp', 'قم بتوليد التوكن ثم اضغط "جلب الردود الفعلية".');
              setDocsResponseText('apiInlineContentCategoryResp', 'قم بتوليد التوكن ثم اضغط "جلب الردود الفعلية".');
              setDocsResponseText('apiInlineContentTreeResp', 'قم بتوليد التوكن ثم اضغط "جلب الردود الفعلية".');
              setDocsResponseText('apiInlineCheckResp', 'قم بتوليد التوكن ثم اضغط "جلب الردود الفعلية".');
              setDocsResponseText('apiInlineCheckUuidResp', 'قم بتوليد التوكن ثم اضغط "جلب الردود الفعلية".');
            }
            return Promise.resolve(false);
          }

          setDocsBusy(true);
          setDocsStatus('جار جلب الردود الفعلية من الخادم...', '');
          setDocsResponseText('apiInlineProfileResp', 'جار التحميل...');
          setDocsResponseText('apiInlineProductsResp', 'جار التحميل...');
          setDocsResponseText('apiInlineProductsFilterReq', 'جار التحميل...');
          setDocsResponseText('apiInlineProductsFilterResp', 'جار التحميل...');
          setDocsResponseText('apiInlineProductsBaseResp', 'جار التحميل...');
          setDocsResponseText('apiInlineContentResp', 'جار التحميل...');
          setDocsResponseText('apiInlineContentCategoryResp', 'جار التحميل...');
          setDocsResponseText('apiInlineContentTreeResp', 'جار التحميل...');
          setDocsResponseText('apiInlineCheckResp', 'جار التحميل...');
          setDocsResponseText('apiInlineCheckUuidResp', 'جار التحميل...');

          var tasks = [];
          tasks.push(fetchApiPreview('client/api/profile', token).then(function(preview){
            setDocsResponseText('apiInlineProfileResp', formatPreviewBody(preview.payload, preview.text));
          }));
          tasks.push(fetchApiPreview('client/api/products', token).then(function(preview){
            setDocsResponseText('apiInlineProductsResp', formatPreviewBody(preview.payload, preview.text));
            var productIds = pickRandomItems(collectProductIdsFromPayload(preview.payload), 3);
            if (!productIds.length) {
              setDocsResponseText('apiInlineProductsFilterReq', 'تعذر توليد طلب حي: لا توجد معرفات منتجات متاحة في الرد الحالي.');
              setDocsResponseText('apiInlineProductsFilterResp', '{}');
              return true;
            }
            var idsQuery = productIds.map(function(id){ return encodeURIComponent(id); }).join(',');
            var filterPath = 'client/api/products?products_id=' + idsQuery;
            setDocsResponseText('apiInlineProductsFilterReq', 'GET /client/api/products?products_id=' + productIds.join(','));
            return fetchApiPreview(filterPath, token).then(function(filterPreview){
              setDocsResponseText('apiInlineProductsFilterResp', formatPreviewBody(filterPreview.payload, filterPreview.text));
              return true;
            });
          }));
          tasks.push(fetchApiPreview('client/api/products?base=1', token).then(function(preview){
            setDocsResponseText('apiInlineProductsBaseResp', formatPreviewBody(preview.payload, preview.text));
          }));
          tasks.push(fetchApiPreview('client/api/content/0', token).then(function(preview){
            setDocsResponseText('apiInlineContentResp', formatPreviewBody(preview.payload, preview.text));
            var categoryId = '';
            try {
              var categories = Array.isArray(preview && preview.payload && preview.payload.categories)
                ? preview.payload.categories
                : [];
              if (categories.length) {
                categoryId = String(
                  categories[0] && (categories[0].id != null ? categories[0].id : categories[0].category_id)
                ).trim();
              }
            } catch (_) { categoryId = ''; }
            if (!categoryId) {
              setDocsResponseText('apiInlineContentCategoryResp', 'لا يوجد category.id متاح حاليًا داخل رد content/0.');
              return true;
            }
            return fetchApiPreview('client/api/content/' + encodeURIComponent(categoryId), token).then(function(childPreview){
              setDocsResponseText('apiInlineContentCategoryResp', formatPreviewBody(childPreview.payload, childPreview.text));
              return true;
            });
          }));
          tasks.push(fetchApiPreview('client/api/content/0?tree=1', token).then(function(preview){
            setDocsResponseText('apiInlineContentTreeResp', formatPreviewBody(preview.payload, preview.text));
          }));

          var uid = resolveCurrentUid();
          tasks.push(resolveAnyOwnedOrderRef(uid).then(function(orderRef){
            if (!orderRef || !orderRef.orderCode) {
              setDocsResponseText('apiInlineCheckResp', 'لا توجد طلبات حالياً لهذا الحساب.\n(نص من الواجهة)');
              setDocsResponseText('apiInlineCheckUuidResp', 'لا يوجد order_uuid متاح للعرض.');
              return true;
            }
            var ordersByCode = encodeURIComponent('[' + String(orderRef.orderCode || '').trim() + ']');
            return fetchApiPreview('client/api/check?orders=' + ordersByCode, token).then(function(checkPreview){
              setDocsResponseText('apiInlineCheckResp', formatPreviewBody(checkPreview.payload, checkPreview.text));
              var orderUuid = String(orderRef.orderUuid || '').trim();
              if (!orderUuid) {
                setDocsResponseText('apiInlineCheckUuidResp', 'لا يوجد order_uuid محفوظ لهذا الطلب.');
                return true;
              }
              var ordersByUuid = encodeURIComponent('[' + orderUuid + ']');
              return fetchApiPreview('client/api/check?orders=' + ordersByUuid + '&uuid=1', token).then(function(uuidPreview){
                setDocsResponseText('apiInlineCheckUuidResp', formatPreviewBody(uuidPreview.payload, uuidPreview.text));
                return true;
              });
            });
          }));

          return Promise.allSettled(tasks).then(function(results){
            var failed = results.some(function(item){ return item && item.status === 'rejected'; });
            if (failed) {
              setDocsStatus('تم تحديث معظم الردود، لكن حدثت أخطاء في بعض الطلبات.', 'err');
              return false;
            }
            setDocsStatus('تم تحديث الردود الفعلية بنجاح.', 'ok');
            return true;
          }).finally(function(){
            setDocsBusy(false);
          });
        }

        function renderLoggedOutState(){
          var tokenInput = byId('apiInlineTokenInput');
          var statusEl = byId('apiInlineTokenStatus');
          var lastEl = byId('apiInlineTokenLast');
          var createdEl = byId('apiInlineTokenCreated');
          var loginHint = byId('apiInlineLoginHint');
          var accessHint = byId('apiInlineAccessHint');
          if (tokenInput) tokenInput.value = '';
          if (statusEl) statusEl.textContent = 'الحالة: يتطلب تسجيل الدخول';
          if (lastEl) lastEl.textContent = 'آخر 4 أرقام: ----';
          if (createdEl) createdEl.textContent = 'تاريخ التوليد: --';
          if (loginHint) loginHint.style.display = '';
          if (accessHint) accessHint.style.display = 'none';
          setAccessSectionsVisible(false);
          setButtons(false, false);
          setDocsBusy(false);
          setDocsStatus('', '');
          setStatus('سجّل الدخول أولًا لعرض إعدادات API.', '');
        }

        function renderCheckingState(){
          var loginHint = byId('apiInlineLoginHint');
          var accessHint = byId('apiInlineAccessHint');
          if (loginHint) loginHint.style.display = 'none';
          if (accessHint) accessHint.style.display = 'none';
          setAccessSectionsVisible(false);
          setButtons(false, false);
          setDocsBusy(false);
          setDocsStatus('', '');
          setStatus('جارٍ التحقق من تفعيل API لهذا الحساب...', '');
        }

	        function applyTokenState(data, opts){
	          var tokenInput = byId('apiInlineTokenInput');
	          var statusEl = byId('apiInlineTokenStatus');
	          var lastEl = byId('apiInlineTokenLast');
	          var createdEl = byId('apiInlineTokenCreated');
	          var loginHint = byId('apiInlineLoginHint');
	          var accessHint = byId('apiInlineAccessHint');
	          var keepToken = !!(opts && opts.keepToken);
	          var tokenText = data && data.token ? String(data.token) : '';
	          if (tokenInput) {
	            if (tokenText) tokenInput.value = tokenText;
	            else if (!keepToken) tokenInput.value = '';
	          }

	          var enabled = !!(data && data.enabled === true);
	          var hasToken = !!(data && data.hasToken === true);
          var disabled = !!(data && data.disabled === true);
          var last4 = data && data.last4 ? String(data.last4) : '----';
          var createdAt = data && data.createdAt ? String(data.createdAt) : '';

          if (enabled) {
            if (statusEl) statusEl.textContent = disabled ? 'الحالة: موقوف' : (hasToken ? 'الحالة: مفعّل' : 'الحالة: لا يوجد توكن');
            if (lastEl) lastEl.textContent = 'آخر 4 أرقام: ' + (last4 || '----');
            if (createdEl) createdEl.textContent = 'تاريخ التوليد: ' + formatDate(createdAt);
            if (loginHint) loginHint.style.display = 'none';
            if (accessHint) accessHint.style.display = 'none';
            setAccessSectionsVisible(true);
            setButtons(true, !!(tokenInput && String(tokenInput.value || '').trim()));
            setStatus('', '');
          } else {
            if (statusEl) statusEl.textContent = 'الحالة: غير مفعل من الإدارة';
            if (lastEl) lastEl.textContent = 'آخر 4 أرقام: ----';
            if (createdEl) createdEl.textContent = 'تاريخ التوليد: --';
            if (tokenInput) tokenInput.value = '';
            if (loginHint) loginHint.style.display = 'none';
            if (accessHint) accessHint.style.display = '';
            setAccessSectionsVisible(false);
            setButtons(false, false);
            setStatus('لا يمكن فتح صفحة API لأن الوصول غير مفعل لهذا الحساب.', 'err');
	          }
	        }

	        function resolveApiSessionUid(user){
	          try {
	            if (user && user.uid) return String(user.uid || '').trim();
	          } catch (_){}
	          try {
	            var info = (typeof readSessionInfo === 'function') ? readSessionInfo() : null;
	            if (info && info.uid) return String(info.uid || '').trim();
	          } catch (_){}
	          return String(resolveCurrentUid() || '').trim();
	        }

	        function resolveApiSessionKey(){
	          try {
	            var info = (typeof readSessionInfo === 'function') ? readSessionInfo() : null;
	            if (info) {
	              var keyFromInfo = String(info.sessionKey || info.session_key || '').trim();
	              if (keyFromInfo) return keyFromInfo;
	            }
	          } catch (_){}
	          try {
	            if (typeof getLocalSessionKey === 'function') {
	              var localKey = String(getLocalSessionKey() || '').trim();
	              if (localKey) return localKey;
	            }
	          } catch (_){}
	          try {
	            var raw = localStorage.getItem('sessionKeyInfo');
	            if (raw) {
	              var parsed = JSON.parse(raw);
	              var keyFromStorage = String((parsed && (parsed.sessionKey || parsed.session_key)) || '').trim();
	              if (keyFromStorage) return keyFromStorage;
	            }
	          } catch (_){}
	          return '';
	        }

	        function ensureApiSessionContext(user){
	          var uid = resolveApiSessionUid(user);
	          if (!uid) {
	            var uidErr = new Error('معرّف المستخدم غير متوفر. سجّل الدخول ثم أعد المحاولة.');
	            uidErr.code = 'uid_missing';
	            return Promise.reject(uidErr);
	          }
	          var sessionKey = resolveApiSessionKey();
	          if (!sessionKey) {
	            var sessionErr = new Error('رمز الجلسة غير متوفر. سجّل الدخول مرة أخرى ثم أعد المحاولة.');
	            sessionErr.code = 'session_missing';
	            return Promise.reject(sessionErr);
	          }
	          return Promise.resolve({ uid: uid, sessionKey: sessionKey });
	        }

	        function callWithIdToken(user, path, options){
	          var init = options ? Object.assign({}, options) : {};
            delete init.maxAttempts;
            delete init.retryDelayMs;

            var baseHeaders = new Headers(init.headers || {});
            return Promise.resolve()
              .then(function(){ return user.getIdToken(false); })
              .then(function(idToken){
                var headers = new Headers(baseHeaders);
                headers.set('Authorization', 'Bearer ' + idToken);
                if (!headers.has('Content-Type') && init.method && String(init.method).toUpperCase() !== 'GET') {
                  headers.set('Content-Type', 'application/json');
                }
                var reqInit = Object.assign({}, init, { headers: headers });
                return fetch(resolveApiCallUrl(path), reqInit);
              });
        }

	        function loadTokenState(user, opts){
	          return ensureApiSessionContext(user).then(function(session){
	            return callWithIdToken(user, 'client/api/token/state', {
	              method: 'GET',
	              headers: {
	                'X-SessionKey': session.sessionKey
	              }
	            }).then(function(res){
	              return res.json().catch(function(){ return {}; }).then(function(payload){
	                if (!res.ok || payload.status !== 'OK') {
	                  var stateErr = new Error(payload.message || 'تعذر تحميل حالة API.');
	                  try { stateErr.httpStatus = Number(res && res.status || 0); } catch (_) {}
	                  try { stateErr.payload = payload || {}; } catch (_) {}
	                  throw stateErr;
	                }
	                var data = payload.data || {};
	                applyTokenState(data, opts || {});
	                return data;
	              });
	            });
	          });
	        }

	        function createToken(user){
	          return ensureApiSessionContext(user).then(function(session){
	            return callWithIdToken(user, 'client/api/token/create', {
	              method: 'POST',
	              headers: {
	                'X-SessionKey': session.sessionKey
	              },
	              body: JSON.stringify({
	                sessionKey: session.sessionKey
	              })
	            }).then(function(res){
	              return res.json().catch(function(){ return {}; }).then(function(payload){
	                if (!res.ok || payload.status !== 'OK' || !payload.data || !payload.data.token) {
	                  throw new Error(payload.message || 'تعذر توليد التوكن.');
	                }
                  var generatedToken = String(payload.data.token || '').trim();
                  var optimisticState = {
                    enabled: true,
                    hasToken: !!generatedToken,
                    disabled: false,
                    token: generatedToken,
                    last4: String(payload.data.last4 || (generatedToken ? generatedToken.slice(-4) : '----')),
                    createdAt: String(payload.data.createdAt || '')
                  };
	                  state.tokenStateLastData = optimisticState;
	                  state.tokenStateLastAt = Date.now();
	                  try { writeApiAccessCache(user && user.uid ? user.uid : '', true); } catch (_) {}
	                  applyTokenState(optimisticState, { keepToken: true });
	                  return optimisticState;
	              });
	            });
	          });
	        }

        function denyApiRoute(message){
          state.tokenStateLastDeniedAt = Date.now();
          var text = String(message || 'وصول API غير مفعل لهذا الحساب.').trim();
          try { setStatus(text, 'err'); } catch (_) {}
          try { alert(text); } catch (_) {}
          try {
            if (typeof navigateHome === 'function') navigateHome();
            else location.hash = '#/';
          } catch (_) {
            try { location.hash = '#/'; } catch (__){}
          }
        }

        function refreshTokenState(opts){
          var options = opts || {};
          var user = state.currentUser;
          if (!user) return Promise.resolve(false);
          var uid = String((user && user.uid) || '').trim();
          if (!uid) return Promise.resolve(false);
          if (state.tokenStateInFlight) return state.tokenStateInFlight;
          if (state.tokenStateCheckedUid === uid && !options.forceNetwork) {
            var onceCachedEnabled = !!(state.tokenStateLastData && state.tokenStateLastData.enabled === true);
            return Promise.resolve(onceCachedEnabled);
          }
          var now = Date.now();
          if (state.tokenStateAuthRejected === true && !options.forceNetwork) {
            return Promise.resolve(false);
          }
          var deniedRecently = (now - Number(state.tokenStateLastDeniedAt || 0)) < API_STATE_REQUEST_COOLDOWN_MS;
          if (deniedRecently && !options.forceNetwork) {
            return Promise.resolve(false);
          }
          var inCooldown = (now - Number(state.tokenStateLastAttemptAt || 0)) < API_STATE_REQUEST_COOLDOWN_MS;
          if (!options.forceNetwork && inCooldown) {
            if (state.tokenStateLastData) {
              var cachedEnabledInCooldown = !!(state.tokenStateLastData && state.tokenStateLastData.enabled === true);
              return Promise.resolve(cachedEnabledInCooldown);
            }
            return Promise.resolve(false);
          }
          var hasFreshCache = !!(state.tokenStateLastData && (now - Number(state.tokenStateLastAt || 0) < API_STATE_REQUEST_COOLDOWN_MS));
          if (!options.forceNetwork && hasFreshCache) {
            var cachedEnabled = !!(state.tokenStateLastData && state.tokenStateLastData.enabled === true);
            return Promise.resolve(cachedEnabled);
          }
          state.tokenStateLastAttemptAt = now;
          state.tokenStateCheckedUid = uid;
          var seq = ++state.seq;
          if (!options.silent) setBusy(true);
          var promise = loadTokenState(user).then(function(data){
            if (seq !== state.seq) return false;
            state.tokenStateLastData = data || null;
            state.tokenStateLastAt = Date.now();
            var enabled = !!(data && data.enabled === true);
            if (enabled) {
              state.tokenStateLastDeniedAt = 0;
              state.tokenStateAuthRejected = false;
            }
            writeApiAccessCache(user.uid, enabled);
            if (!enabled && options.enforce !== false) {
              state.tokenStateAuthRejected = true;
              denyApiRoute('واجهة API غير مفعلة من الإدارة لهذا الحساب.');
              return false;
            }
            return enabled;
          }).catch(function(err){
            if (seq !== state.seq) return false;
            var statusCode = Number(err && err.httpStatus || 0);
            if ((statusCode === 401 || statusCode === 403) && options.enforce !== false) {
              state.tokenStateLastDeniedAt = Date.now();
              state.tokenStateAuthRejected = true;
              try { writeApiAccessCache(user && user.uid ? user.uid : '', false); } catch (_) {}
              denyApiRoute(err && err.message ? err.message : 'واجهة API غير مفعلة من الإدارة لهذا الحساب.');
              return false;
            }
            setStatus(err && err.message ? err.message : 'تعذر تحميل بيانات API.', 'err');
            return false;
          }).finally(function(){
            if (seq === state.seq && !options.silent) setBusy(false);
            state.tokenStateInFlight = null;
          });
          state.tokenStateInFlight = promise;
          return promise;
        }

        function refreshTokenStateAuto(opts){
          var options = opts || {};
          var user = state.currentUser;
          if (!user) return Promise.resolve(false);
          var uid = String((user && user.uid) || '').trim();
          if (!uid) return Promise.resolve(false);
          if (state.tokenStateInFlight) return state.tokenStateInFlight;
          var now = Date.now();
          var autoCooldownMs = API_STATE_REQUEST_COOLDOWN_MS;
          var sameUid = (state.tokenStateAutoSyncUid === uid);
          var inAutoCooldown = sameUid && ((now - Number(state.tokenStateAutoSyncAt || 0)) < autoCooldownMs);
          if (inAutoCooldown && !options.forceNetwork) {
            var cachedEnabled = !!(state.tokenStateLastData && state.tokenStateLastData.enabled === true);
            return Promise.resolve(cachedEnabled);
          }
          state.tokenStateAutoSyncUid = uid;
          state.tokenStateAutoSyncAt = now;
          return refreshTokenState(options);
        }

        function isApiRouteActiveHash(){
          return String(location.hash || '').toLowerCase() === '#/api';
        }

        function redirectToLoginFromApi(){
          try {
            if (typeof window.__redirectToLoginImmediately === 'function') window.__redirectToLoginImmediately();
            else if (typeof navigate === 'function') navigate('login');
            else window.location.replace('#/login');
          } catch (_) {
            try { window.location.replace('#/login'); } catch (__){}
          }
        }

        function readFirebaseCurrentUser(){
          try {
            if (state.currentUser && state.currentUser.uid) return state.currentUser;
          } catch (_) {}
          try {
            if (typeof firebase !== 'undefined' && firebase && typeof firebase.auth === 'function') {
              var authInst = firebase.auth();
              if (authInst && authInst.currentUser && authInst.currentUser.uid) return authInst.currentUser;
            }
          } catch (_) {}
          return null;
        }

        function waitForAuthStateChangeOnce(timeoutMs){
          var timeout = Number(timeoutMs || 1600);
          if (!Number.isFinite(timeout) || timeout <= 0) timeout = 1600;
          return new Promise(function(resolve){
            var done = false;
            var unsub = null;
            var timer = null;
            function finish(user){
              if (done) return;
              done = true;
              try { if (typeof unsub === 'function') unsub(); } catch (_){}
              try { if (timer) clearTimeout(timer); } catch (_){}
              resolve(user || null);
            }
            try { timer = setTimeout(function(){ finish(readFirebaseCurrentUser()); }, timeout); } catch (_) {}
            try {
              if (typeof firebase !== 'undefined' && firebase && typeof firebase.auth === 'function') {
                var authInst = firebase.auth();
                if (authInst && typeof authInst.onAuthStateChanged === 'function') {
                  unsub = authInst.onAuthStateChanged(function(user){
                    if (user && user.uid) finish(user);
                  });
                }
              }
            } catch (_) {}
          });
        }

        function waitForApiAuthReady(opts){
          var options = opts || {};
          if (state.authWaitPromise) return state.authWaitPromise;
          state.authWaitPromise = Promise.resolve().then(async function(){
            var user = readFirebaseCurrentUser();
            if (user && user.uid) return user;

            try {
              if (typeof window !== 'undefined' && typeof window.__ensureAuthReady === 'function') {
                await window.__ensureAuthReady();
              } else if (typeof window !== 'undefined' && window.__AUTH_RESTORE_PROMISE__) {
                await window.__AUTH_RESTORE_PROMISE__;
              }
            } catch (_) {}

            user = readFirebaseCurrentUser();
            if (user && user.uid) return user;

            var waited = await waitForAuthStateChangeOnce(options.timeoutMs || 1800).catch(function(){ return null; });
            if (waited && waited.uid) return waited;
            return readFirebaseCurrentUser();
          }).finally(function(){
            state.authWaitPromise = null;
          });
          return state.authWaitPromise;
        }

        function resumeApiRouteAfterAuthRestore(){
          if (state.authResumePromise) return state.authResumePromise;
          state.authResumePromise = waitForApiAuthReady({ timeoutMs: 1800 }).then(function(restoredUser){
            if (!isApiRouteActiveHash()) return false;
            state.currentUser = restoredUser || null;
            if (!state.currentUser) {
              renderLoggedOutState();
              redirectToLoginFromApi();
              return false;
            }
            var cached = readCurrentApiAccessCache();
            if (cached === false) {
              denyApiRoute('واجهة API غير مفعلة من الإدارة لهذا الحساب.');
              return false;
            }
            renderCheckingState();
            return refreshTokenStateAuto({ enforce: true });
          }).finally(function(){
            state.authResumePromise = null;
          });
          return state.authResumePromise;
        }

        function ensureAuthBinding(){
          if (state.authUnsub) return;
          var authInst = null;
          try {
            if (typeof firebase !== 'undefined' && firebase && typeof firebase.auth === 'function') {
              authInst = firebase.auth();
            }
          } catch (_) { authInst = null; }
          if (!authInst || typeof authInst.onAuthStateChanged !== 'function') return;
          state.currentUser = authInst.currentUser || null;
          state.currentUid = state.currentUser && state.currentUser.uid ? String(state.currentUser.uid) : '';
          state.authUnsub = authInst.onAuthStateChanged(function(user){
            var prevUid = String(state.currentUid || '');
            state.currentUser = user || null;
            state.currentUid = state.currentUser && state.currentUser.uid ? String(state.currentUser.uid) : '';
            if (state.currentUid !== prevUid) {
              state.tokenStateCheckedUid = '';
              state.tokenStateAutoSyncUid = '';
              state.tokenStateAutoSyncAt = 0;
              state.tokenStateInFlight = null;
              state.tokenStateLastData = null;
              state.tokenStateLastAt = 0;
              state.tokenStateLastAttemptAt = 0;
              state.tokenStateLastDeniedAt = 0;
              state.tokenStateAuthRejected = false;
            }
            if (!isApiRouteActiveHash()) return;
            if (!state.currentUser) {
              renderCheckingState();
              resumeApiRouteAfterAuthRestore();
              return;
            }
            var cached = readCurrentApiAccessCache();
            if (cached === false) {
              denyApiRoute('واجهة API غير مفعلة من الإدارة لهذا الحساب.');
              return;
            }
            renderCheckingState();
            refreshTokenStateAuto({ enforce: true });
          });
        }

        function init(){
          if (state.initialized) return true;
          var root = rootEl();
          if (!root) return false;
          applyBaseUrl();
          Array.prototype.forEach.call(root.querySelectorAll('[data-api-copy-target]'), function(btn){
            btn.addEventListener('click', function(ev){
              if (ev) ev.preventDefault();
              var target = String(btn.getAttribute('data-api-copy-target') || '').trim();
              if (!target) return;
              copyById(target);
            });
          });
          var generateBtn = byId('apiInlineGenerateBtn');
          var regenBtn = byId('apiInlineRegenBtn');
          var copyTokenBtn = byId('apiInlineCopyTokenBtn');
          if (generateBtn) {
            generateBtn.addEventListener('click', function(ev){
              if (ev) ev.preventDefault();
              if (!state.currentUser) return;
              if (state.busy) return;
              setBusy(true);
              createToken(state.currentUser).catch(function(err){
                setStatus(err && err.message ? err.message : 'تعذر توليد التوكن.', 'err');
              }).finally(function(){
                setBusy(false);
              });
            });
          }
          if (regenBtn) {
            regenBtn.addEventListener('click', function(ev){
              if (ev) ev.preventDefault();
              if (!state.currentUser) return;
              if (state.busy) return;
              setBusy(true);
              createToken(state.currentUser).catch(function(err){
                setStatus(err && err.message ? err.message : 'تعذر إعادة توليد التوكن.', 'err');
              }).finally(function(){
                setBusy(false);
              });
            });
          }
          if (copyTokenBtn) {
            copyTokenBtn.addEventListener('click', function(ev){
              if (ev) ev.preventDefault();
              copyById('apiInlineTokenInput');
            });
          }
          renderCheckingState();
          ensureAuthBinding();
          state.initialized = true;
          return true;
        }

        function onShow(){
          init();
          applyBaseUrl();
          var user = state.currentUser;
          if (!user) {
            renderCheckingState();
            resumeApiRouteAfterAuthRestore();
            return;
          }
          var cached = readCurrentApiAccessCache();
          if (cached === false) {
            denyApiRoute('واجهة API غير مفعلة من الإدارة لهذا الحساب.');
            return;
          }
          renderCheckingState();
          refreshTokenStateAuto({ enforce: true });
        }

        return {
          build: build,
          onShow: onShow,
          ready: function(){ return true; }
        };
      })();

window.__inlineRoutes = window.__inlineRoutes || {};
window.__inlineRoutes.settings = settingsRoute;
window.__inlineRoutes.levels = levelsRoute;
window.__inlineRoutes.telegram = telegramLinkRoute;
window.__inlineRoutes.security = securityRoute;
window.__inlineRoutes.transfer = transferRoute;
window.__inlineRoutes.api = apiRoute;
