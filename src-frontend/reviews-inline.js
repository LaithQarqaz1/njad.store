(function(){
  if (typeof window === 'undefined') return;
  if (window.__REVIEWS_SCRIPT_ATTACHED__) return;
  window.__REVIEWS_SCRIPT_ATTACHED__ = true;

  window.__initReviewsPage = function(){
    if (window.__REVIEWS_PAGE_ACTIVE__) return;
    window.__REVIEWS_PAGE_ACTIVE__ = true;

    try {
      if (typeof window.__FIREBASE_ENV_OK__ === 'boolean' && !window.__FIREBASE_ENV_OK__) {
        console.warn('التقييمات: تم تعطيل Firebase في هذه البيئة.');
        window.__REVIEWS_PAGE_ACTIVE__ = false;
        return;
      }
    } catch(_){ }

    if (typeof firebase === 'undefined') {
      console.warn('التقييمات: Firebase غير متاح.');
      window.__REVIEWS_PAGE_ACTIVE__ = false;
      return;
    }

    try {
      if (window.__ORIG_FIREBASE__){
        if (window.__ORIG_FIREBASE__.auth) firebase.auth = window.__ORIG_FIREBASE__.auth;
        if (window.__ORIG_FIREBASE__.firestore) firebase.firestore = window.__ORIG_FIREBASE__.firestore;
      }
      if (typeof window.__FIREBASE_ENV_OK__ !== 'boolean' || window.__FIREBASE_ENV_OK__) {
        window.__SKIP_FIREBASE__ = false;
      }
    } catch(_){ }

    try {
      if ((!firebase.apps || !firebase.apps.length) && window.__FIREBASE_CONFIG__){
        firebase.initializeApp(window.__FIREBASE_CONFIG__);
      }
    } catch(_){ }

    var authInstance = null;
    var dbInstance = null;
    try { authInstance = (typeof window.auth !== 'undefined' && window.auth) ? window.auth : firebase.auth(); } catch(_){ }
    try { dbInstance = (typeof window.db !== 'undefined' && window.db) ? window.db : firebase.firestore(); } catch(_){ }

    if (!authInstance || !dbInstance) {
      console.warn('التقييمات: تعذر الوصول إلى Firebase.');
      window.__REVIEWS_PAGE_ACTIVE__ = false;
      return;
    }

    (function(auth, db){
      const starsNodeList = document.querySelectorAll('#starRating i');
      const stars = Array.prototype.slice.call(starsNodeList || []);
      const reviewText = document.getElementById('reviewText');
      const submitBtn = document.getElementById('submitReview');
      const codePreview = document.getElementById('codePreview');
      const currentUserName = document.getElementById('currentUserName');
      const ratingFilters = document.getElementById('ratingFilters');
      const reviewsList = document.getElementById('reviewsList');

      if (!stars.length || !reviewText || !submitBtn || !codePreview || !currentUserName || !ratingFilters || !reviewsList){
        window.__REVIEWS_PAGE_ACTIVE__ = false;
        return;
      }

      const countsElements = {
        1: document.getElementById('count-1'),
        2: document.getElementById('count-2'),
        3: document.getElementById('count-3'),
        4: document.getElementById('count-4'),
        5: document.getElementById('count-5')
      };
      let reviewsLoadedOnce = false;

      const REVIEWS_SECRET = String.fromCharCode(90, 97, 101, 101, 109) + 'Store$Reviews#2025!';
      const REVIEWS_SALT = String.fromCharCode(122, 51) + '-store-salt-2025';
      const REVIEWS_DOC = db.collection('comments').doc('all');
      const MANWAL_DEFAULT_BASE = (function(){
        try {
          if (window.__getSiteWorkerBaseDefault) {
            return window.__getSiteWorkerBaseDefault({ trailingSlash: true });
          }
        } catch(_){}
        try { return String(location.origin || '').replace(/\/+$/, '') + '/'; } catch(_){}
        return '/';
      })();
      const BAD_WORDS = [
        'shit','fuck','bitch','asshole','bastard','damn','porn','nude','dick','slut','pussy','whore',
        'قحبة','شرموطة','قذر','كس','زب','زبي','لعين','كلب','حيوان','منيوك','شرموط','خرا','كسم',
        'عاهرة','لوطي','وسخ','حقير','خنزير','زنده','طيز','نجس'
      ];
      function normalizeDisplayText(value){
        const str = String(value == null ? '' : value);
        if (!str) return '';
        const clean = (input) => {
          return String(input || '')
            .replace(/\uFFFD+/g, '')
            .replace(/[\u00EF\u00BF\u00BD]/g, '')
            .replace(/[\u00C2\u00C3\u00D8\u00D9\u00D0\u00DE\u00DD\u00C6\u00C7\u00D1]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        };
        const looksEncoded = /%[0-9A-Fa-f]{2}/.test(str);
        const hasBad = /[\u00C3\u00C2\u00D8\u00D9\u00D0\u00DE\u00DD\u00C6\u00C7\u00D1\u00EF\u00BF\u00BD\uFFFD]/.test(str) || looksEncoded;
        if (!hasBad) return str;

        const scoreText = (input) => {
          const s = String(input || '');
          const good = (s.match(/[A-Za-z0-9\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\u0660-\u0669\u06F0-\u06F9]/g) || []).length;
          const bad = (s.match(/[\uFFFD]/g) || []).length;
          return good - (bad * 5);
        };

        const candidates = [];
        const bytes = new Uint8Array(Array.from(str, ch => ch.charCodeAt(0) & 0xff));
        if (typeof TextDecoder !== 'undefined') {
          try { candidates.push(new TextDecoder('utf-8', { fatal: false }).decode(bytes)); } catch(_){ }
          try { candidates.push(new TextDecoder('windows-1256', { fatal: false }).decode(bytes)); } catch(_){ }
          try { candidates.push(new TextDecoder('iso-8859-6', { fatal: false }).decode(bytes)); } catch(_){ }
        }
        if (looksEncoded) {
          try { candidates.push(decodeURIComponent(str)); } catch(_){ }
        }
        try { candidates.push(decodeURIComponent(escape(str))); } catch(_){ }
        candidates.push(str);

        let best = str;
        let bestScore = scoreText(clean(str));
        for (let i = 0; i < candidates.length; i++) {
          const cleaned = clean(candidates[i]);
          if (!cleaned) continue;
          const sc = scoreText(cleaned);
          if (sc > bestScore) {
            bestScore = sc;
            best = cleaned;
          }
        }
        const cleaned = clean(best);
        return cleaned || str;
      }
      function normalizeDisplayName(value){
        const base = normalizeDisplayText(value);
        if (!base) return '';
        const cleaned = String(base)
          .replace(/[\uD800-\uDFFF]/g, '')
          .replace(/[^\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFFA-Za-z0-9\u0660-\u0669\u06F0-\u06F9 @._-]/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        return cleaned || String(base).replace(/[\uFFFD\uD800-\uDFFF]/g, '').trim();
      }
      function getManualRouterBase(){
        try{
          if (window.__getSiteWorkerBase) {
            const base = window.__getSiteWorkerBase({ trailingSlash: true });
            if (base) return base;
          }
        }catch(_){}
        return MANWAL_DEFAULT_BASE;
      }

      function buildReviewsUrl(action){
        let base = MANWAL_DEFAULT_BASE;
        try{
          const b = getManualRouterBase();
          if (b) base = b;
        }catch(_){}
        let url;
        try{ url = new URL(base); }
        catch(_){ url = new URL(MANWAL_DEFAULT_BASE); }
        url.searchParams.set('game','reviews');
        return url;
      }

      async function sendReviewRequest(action, payload, idToken){
        const url = buildReviewsUrl(action);
        const headers = {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'X-Game': 'reviews'
        };
        if (action) headers['X-Reviews-Action'] = String(action);
        if (idToken) headers.Authorization = `Bearer ${idToken}`;
        const res = await fetch(url.toString(), {
          method: 'POST',
          headers,
          body: JSON.stringify({ ...(payload||{}), action })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data?.success === false || data?.ok === false){
          throw new Error(data?.error || 'فشل الاتصال بالخادم.');
        }
        return data;
      }

      function normalizeForProfanity(text){
        try{
          return (text||'').toString().toLowerCase()
            .replace(/[\u0640\u200c\u200d]/g,'')
            .normalize('NFKD')
            .replace(/[\u0300-\u036f]/g,'')
            .replace(/[\u0610-\u061a\u064b-\u065f\u06d6-\u06ed]/g,'')
            .replace(/[^a-z0-9\u0600-\u06FF]+/g,' ')
            .replace(/\s+/g,' ')
            .trim();
        }catch(_){
          return (text||'').toString().toLowerCase();
        }
      }

      function containsBadWords(text){
        if (!text) return false;
        const normalized = normalizeForProfanity(text);
        if (!normalized) return false;
        const compact = normalized.replace(/\s+/g,'');
        return BAD_WORDS.some(word => normalized.includes(word) || compact.includes(word));
      }

      function bufToBase64(buf){
        try{
          const bytes = new Uint8Array(buf);
          let bin = '';
          for (let i=0;i<bytes.length;i++){ bin += String.fromCharCode(bytes[i]); }
          return btoa(bin);
        }catch(_){ return ''; }
      }
      function base64ToBuf(b64){
        try{
          const bin = atob(b64);
          const len = bin.length;
          const bytes = new Uint8Array(len);
          for (let i=0;i<len;i++){ bytes[i] = bin.charCodeAt(i); }
          return bytes.buffer;
        }catch(_){ return new ArrayBuffer(0); }
      }

      async function getAesKey(){
        if (!(window.crypto && crypto.subtle)) throw new Error('Crypto unavailable');
        const enc = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(REVIEWS_SECRET), 'PBKDF2', false, ['deriveKey']);
        return crypto.subtle.deriveKey(
          { name:'PBKDF2', salt: enc.encode(REVIEWS_SALT), iterations: 150000, hash: 'SHA-256' },
          keyMaterial,
          { name:'AES-GCM', length:256 },
          false,
          ['encrypt','decrypt']
        );
      }

      async function encryptBody(body){
        try{
          if (!(window.crypto && crypto.subtle)) return JSON.stringify(body);
          const key = await getAesKey();
          const iv = crypto.getRandomValues(new Uint8Array(12));
          const enc = new TextEncoder();
          const data = enc.encode(JSON.stringify(body||{}));
          const cipherBuf = await crypto.subtle.encrypt({ name:'AES-GCM', iv }, key, data);
          const ivAndCt = new Uint8Array(iv.length + cipherBuf.byteLength);
          ivAndCt.set(iv, 0);
          ivAndCt.set(new Uint8Array(cipherBuf), iv.length);
          return 'enc:v1:' + bufToBase64(ivAndCt.buffer);
        }catch(_){ return JSON.stringify(body||{}); }
      }

      async function decryptPayloadToObject(payload){
        try{
          if (typeof payload !== 'string') return {};
          if (payload.startsWith('enc:v1:') && window.crypto && crypto.subtle){
            const b64 = payload.slice(7);
            const buf = base64ToBuf(b64);
            const bytes = new Uint8Array(buf);
            if (bytes.length < 13) return {};
            const iv = bytes.slice(0,12);
            const ct = bytes.slice(12);
            const key = await getAesKey();
            const plainBuf = await crypto.subtle.decrypt({ name:'AES-GCM', iv }, key, ct);
            const dec = new TextDecoder().decode(plainBuf);
            try { return JSON.parse(dec); } catch(_){ return {}; }
          }
          try { return JSON.parse(payload); } catch(_){ }
          try { return parsePayloadSafe(payload)||{}; } catch(_){ }
          return {};
        }catch(_){ return {}; }
      }

      async function decodeDocDataToBody(data){
        try{
          if (data && typeof data.payload === 'string'){
            return await decryptPayloadToObject(data.payload);
          }
          return data || {};
        }catch(_){ return {}; }
      }

      function resolveSiteCommentsState(){
        try{
          const siteState = window.__getResolvedSiteStateData
            ? window.__getResolvedSiteStateData()
            : window.__SITE_STATE_DATA__;
          const raw = siteState && typeof siteState === 'object'
            ? (siteState.comments || siteState.reviews || null)
            : null;
          const src = raw && typeof raw === 'object' ? raw : null;
          const hasExplicitEnabled = !!(src && (
            Object.prototype.hasOwnProperty.call(src, 'enabled') ||
            Object.prototype.hasOwnProperty.call(src, 'on') ||
            Object.prototype.hasOwnProperty.call(src, 'active')
          ));
          const enabled = !!(src && (
            src.enabled === true ||
            src.on === true ||
            src.active === true ||
            String(src.enabled || src.on || src.active || '').toLowerCase() === 'true'
          ));
          const countRaw = Number(src && (
            src.count ??
            src.reviewsCount ??
            src.reviews_count ??
            src.itemsCount ??
            src.items_count ??
            0
          ));
          const count = Number.isFinite(countRaw) && countRaw > 0 ? Math.trunc(countRaw) : 0;
          const payload = src ? String(src.payload || '').trim() : '';
          const migratedAt = src ? String(src.migratedAt || src.migrated_at || '').trim() : '';
          const inlineReviews = src && Array.isArray(src.reviews) ? src.reviews : (src && Array.isArray(src.items) ? src.items : []);
          return {
            known: !!src,
            enabled: hasExplicitEnabled ? enabled : true,
            payload: payload,
            count: count,
            migratedAt: migratedAt,
            reviews: inlineReviews,
            authoritative: !!(payload || count > 0 || migratedAt || inlineReviews.length)
          };
        }catch(_){
          return {
            known: false,
            enabled: true,
            payload: '',
            count: 0,
            migratedAt: '',
            reviews: [],
            authoritative: false
          };
        }
      }

      function isSiteCommentsEnabled(){
        try {
          if (typeof window.__isSiteCommentsEnabled === 'function') {
            return window.__isSiteCommentsEnabled() !== false;
          }
        } catch(_){}
        return resolveSiteCommentsState().enabled !== false;
      }

      function isReviewsRouteActive(){
        try {
          return String(document.body && document.body.getAttribute('data-inline-route') || '').toLowerCase() === 'reviews';
        } catch(_){}
        return false;
      }

      function redirectDisabledReviewsRoute(){
        if (isSiteCommentsEnabled()) return false;
        if (!isReviewsRouteActive()) return false;
        try { location.hash = '#/'; } catch(_){}
        return true;
      }

      async function readReviewsFromResolvedSiteState(){
        const state = resolveSiteCommentsState();
        if (!state.authoritative) return null;
        if (state.payload) {
          const body = await decryptPayloadToObject(state.payload);
          return Array.isArray(body && body.reviews) ? body.reviews : [];
        }
        return Array.isArray(state.reviews) ? state.reviews : [];
      }

      let selectedRating = 0;
      let currentFilter = 0;
      let reviewsData = [];
      let currentReviewUser = null;
      let currentReviewActorId = '';

      function normalizeReviewActorId(value){
        return String(value == null ? '' : value).trim();
      }

      function getReviewFallbackUid(){
        return (auth && auth.currentUser && auth.currentUser.uid)
          ? String(auth.currentUser.uid).trim()
          : '';
      }

      function assignCurrentReviewActorId(user, data){
        currentReviewActorId = normalizeReviewActorId(
          (data && (data.webuid || data.webUid)) ||
          (user && user.uid) ||
          ''
        );
      }

      function resolveCurrentReviewActorId(){
        return normalizeReviewActorId(currentReviewActorId || getReviewFallbackUid());
      }

      function resolveCurrentReviewActorKeys(){
        const seen = new Set();
        const out = [];
        [resolveCurrentReviewActorId(), getReviewFallbackUid()].forEach((value) => {
          const normalized = normalizeReviewActorId(value);
          if (!normalized || seen.has(normalized)) return;
          seen.add(normalized);
          out.push(normalized);
        });
        return out;
      }

      function readCurrentReviewVoteValue(votes){
        const map = (votes && typeof votes === 'object') ? votes : {};
        const actorKeys = resolveCurrentReviewActorKeys();
        for (let i = 0; i < actorKeys.length; i += 1) {
          const key = actorKeys[i];
          const value = Number(map[key] || 0);
          if (value === 1 || value === -1) return value;
        }
        return 0;
      }

      function normalizeReplyEntry(entry){
        const src = entry && typeof entry === 'object' ? entry : {};
        const createdAtMillis = Number(src.createdAtMillis || Date.parse(src.createdAtISO) || 0);
        return {
          rid: String(src.rid || src.id || (createdAtMillis ? ('ms' + createdAtMillis) : '')),
          id: String(src.id || src.rid || ''),
          text: normalizeDisplayText(String(src.text || src.comment || '')),
          userName: normalizeDisplayName(String(src.userName || src.username || 'مستخدم')),
          createdAtMillis: createdAtMillis,
          createdAtISO: src.createdAtISO || (createdAtMillis ? new Date(createdAtMillis).toISOString() : ''),
          likes: Number(src.likes || 0),
          dislikes: Number(src.dislikes || 0),
          replies: normalizeReplyEntries(src.replies),
          votes: (src.votes && typeof src.votes === 'object') ? src.votes : {}
        };
      }

      function normalizeReplyEntries(list){
        return (Array.isArray(list) ? list : []).map(normalizeReplyEntry);
      }

      function normalizeReviewEntry(entry){
        const src = entry && typeof entry === 'object' ? entry : {};
        const createdAtMillis = Number(src.createdAtMillis || Date.parse(src.createdAtISO) || 0);
        return {
          id: String(src.id || ''),
          rating: Number(src.rating) || 0,
          comment: normalizeDisplayText(String(src.comment || src.text || '')),
          userName: normalizeDisplayName(String(src.userName || src.username || 'مستخدم')),
          createdAtMillis: createdAtMillis,
          createdAtISO: src.createdAtISO || (createdAtMillis ? new Date(createdAtMillis).toISOString() : ''),
          likes: Number(src.likes || 0),
          dislikes: Number(src.dislikes || 0),
          replies: normalizeReplyEntries(src.replies),
          votes: (src.votes && typeof src.votes === 'object') ? src.votes : {}
        };
      }

      function applyLoadedReviews(list){
        reviewsData = (Array.isArray(list) ? list : []).map(normalizeReviewEntry);
        try { reviewsData.sort((a,b) => (b.createdAtMillis||0) - (a.createdAtMillis||0)); } catch(_){ }
        updateRatingCounts();
        renderReviews();
        reviewsLoadedOnce = true;
      }

      async function refreshReviewsDataFromState(options){
        const opts = options || {};
        if (opts.forceNetwork && typeof window.__refreshSiteStateNow === 'function') {
          try { await window.__refreshSiteStateNow(); } catch(_){}
        }
        return loadReviews({ skipLoading: !!opts.skipLoading });
      }

      function syncReviewComposerState(user){
        currentReviewUser = user || null;
        assignCurrentReviewActorId(user || null, null);
        if (!isSiteCommentsEnabled()) {
          currentUserName.textContent = 'تم تعطيل قسم التعليقات حالياً.';
          reviewText.disabled = true;
          submitBtn.disabled = true;
          return;
        }
        reviewText.disabled = false;
        if (user) {
          const userDoc = db.collection('users').doc(user.uid);
          userDoc.get().then(doc => {
            if (doc.exists) {
              const data = doc.data() || {};
              assignCurrentReviewActorId(user, data);
              const name = normalizeDisplayName(data.username || user.displayName || 'مستخدم');
              currentUserName.textContent = `مرحباً ${name}`;
            } else {
              assignCurrentReviewActorId(user, null);
              currentUserName.textContent = 'مرحباً بك من جديد.';
            }
            if (reviewsLoadedOnce) renderReviews();
          }).catch(() => {
            assignCurrentReviewActorId(user, null);
            currentUserName.textContent = 'مرحباً بك من جديد.';
            if (reviewsLoadedOnce) renderReviews();
          });
        } else {
          currentReviewActorId = '';
          currentUserName.textContent = 'يجب تسجيل الدخول لإضافة تعليق.';
          if (reviewsLoadedOnce) renderReviews();
        }
        checkFormValid();
      }

      auth.onAuthStateChanged(function(user){
        syncReviewComposerState(user);
      });

      if (false) auth.onAuthStateChanged(user => {
        if (user) {
          submitBtn.disabled = false;
          const userDoc = db.collection('users').doc(user.uid);
          userDoc.get().then(doc => {
            if (doc.exists) {
              const data = doc.data() || {};
              const name = normalizeDisplayName(data.username || user.displayName || 'مستخدم');
              currentUserName.textContent = `مرحباً ${name}`;
            } else {
              currentUserName.textContent = 'مرحباً بك من جديد.';
            }
          }).catch(() => {
            currentUserName.textContent = 'مرحباً بك من جديد.';
          });
        } else {
          currentUserName.textContent = 'يجب تسجيل الدخول لإضافة تعليق.';
          submitBtn.disabled = true;
        }
      });

      submitBtn.addEventListener('click', async () => {
        const user = auth.currentUser;
        if (!isSiteCommentsEnabled()) {
          alert('تم تعطيل قسم التعليقات حالياً.');
          redirectDisabledReviewsRoute();
          return;
        }
        if (!user) {
          alert('يجب تسجيل الدخول لإرسال تعليق.');
          return;
        }
        if (!(selectedRating > 0)) {
          alert('يرجى اختيار عدد النجوم.');
          return;
        }
        const textValue = reviewText.value.trim();
        if (!textValue.length) {
          alert('يرجى كتابة تعليقك قبل الإرسال.');
          return;
        }
        if (containsBadWords(textValue)) {
          alert('تعذر إرسال التقييم بسبب وجود كلمات غير لائقة.');
          reviewText.focus();
          return;
        }
        submitBtn.disabled = true;
        submitBtn.textContent = 'جارٍ الإرسال...';
        try {
          const idToken = await user.getIdToken().catch(() => user.getIdToken(true));
          const response = await sendReviewRequest('create', {
            rating: Number(selectedRating) || 0,
            comment: normalizeDisplayText(textValue),
            clientTimestamp: Date.now(),
            source: location.href
          }, idToken);
          const reviewId = String(response?.reviewId || response?.review?.id || '').trim();
          if (reviewId) {
            codePreview.textContent = `كود التقييم: ${reviewId.substring(0, 8)}`;
            codePreview.style.display = 'block';
          } else {
            codePreview.style.display = 'none';
          }
          reviewText.value = '';
          selectedRating = 0;
          updateStars(0);
          checkFormValid();
          await refreshReviewsDataFromState({ forceNetwork: true });
          submitBtn.textContent = 'تم الإرسال';
          setTimeout(() => {
            submitBtn.textContent = 'إرسال التقييم';
            codePreview.style.display = 'none';
          }, 1500);
        } catch (err) {
          alert('حدث خطأ أثناء الإرسال: ' + (err?.message || 'تعذر الاتصال بالخادم.'));
          submitBtn.disabled = false;
          submitBtn.textContent = 'إرسال التقييم';
          codePreview.style.display = 'none';
        }
      });

      function updateStars(rating) {
        stars.forEach(star => {
          const val = Number(star.getAttribute('data-value'));
          if (val <= rating) {
            star.classList.remove('fa-regular');
            star.classList.add('fa-solid', 'selected');
            star.setAttribute('aria-checked', 'true');
            star.setAttribute('tabindex', '0');
          } else {
            star.classList.add('fa-regular');
            star.classList.remove('fa-solid', 'selected');
            star.setAttribute('aria-checked', 'false');
            star.setAttribute('tabindex', '-1');
          }
        });
      }

      function checkFormValid() {
        const value = reviewText.value.trim();
        const hasBad = /[\u00C3\u00C2\u00D8\u00D9\u00D0\u00DE\u00DD\u00C6\u00C7\u00D1\uFFFD]/.test(value);
        try {
          if (reviewText.setCustomValidity) {
            reviewText.setCustomValidity(hasBad ? 'يرجى تجنب استخدام الألفاظ غير اللائقة.' : '');
            if (hasBad && typeof reviewText.reportValidity === 'function') {
              reviewText.reportValidity();
            }
          }
        } catch(_){}
        const hasUser = !!(auth.currentUser || currentReviewUser);
        submitBtn.disabled = !isSiteCommentsEnabled() || !hasUser || !(selectedRating > 0 && value.length > 0) || hasBad;
      }

      function filterReviews(rating) {
        currentFilter = rating;
        renderReviews();
        ratingFilters.querySelectorAll('.rating-filter').forEach(btn => {
          if (Number(btn.getAttribute('data-rating')) === rating) {
            btn.classList.add('active');
          } else {
            btn.classList.remove('active');
          }
        });
      }

      function renderReviews() {
        reviewsList.innerHTML = '';

        if (!isSiteCommentsEnabled()) {
          reviewsList.innerHTML = '<p>تم تعطيل قسم التعليقات حالياً.</p>';
          return;
        }

        if (!reviewsData.length) {
          reviewsList.innerHTML = '<p>لا توجد تعليقات بعد.</p>';
          return;
        }

        const filteredReviews = currentFilter === 0
          ? reviewsData
          : reviewsData.filter(review => Number(review.rating) === Number(currentFilter));

        if (!filteredReviews.length) {
          reviewsList.innerHTML = '<p>لا توجد تعليقات مع التقييم المحدد.</p>';
          return;
        }

        filteredReviews.forEach(data => {
          const comment = data.comment || '';
          const d = data.createdAtMillis ? new Date(data.createdAtMillis) : (data.createdAtISO ? new Date(data.createdAtISO) : null);
          const rel = (d && !isNaN(d)) ? relativeTime(d.getTime()) : '';
          const userName = normalizeDisplayName(data.userName || 'مستخدم');
          const repliesCount = countReplies(data.replies);
          const reviewItem = document.createElement('article');
          reviewItem.className = 'review-item';
          const userVote = readCurrentReviewVoteValue(data.votes);
          const likeActive = userVote === 1 ? ' active' : '';
          const dislikeActive = userVote === -1 ? ' active' : '';
          const firstLetter = escapeHTML(String(userName).trim().charAt(0) || 'م');
          const toggleRepliesHTML = repliesCount > 0 
        ? '<button class="vote-btn toggle-replies" type="button" aria-label="إظهار الردود" aria-expanded="false"><span class="vote-count replies-count">'+repliesCount+'</span><i class="fa-regular fa-comments"></i></button>'
        : '';
          reviewItem.innerHTML = [
        '<div class="review-main">',
        '  <div class="review-header">',
        '    <div class="user-info">',
        '      <span class="header-avatar" aria-hidden="true">'+firstLetter+'</span>',
        '      <span class="username">@'+escapeHTML(userName)+'</span>',
        rel ? '<span class="sep">&nbsp;&nbsp;أ¢â‚¬آ¢&nbsp;&nbsp;</span><span class="time">'+rel+'</span>' : '',
        '    </div>',
        data.rating ? '    <span class="mini-stars" aria-label="'+data.rating+' نجوم">'+getStarsHTML(data.rating)+'</span>' : '',
        '  </div>',
        '  <p class="review-text">'+escapeHTML(comment)+'</p>',
        '  <div class="review-actions" data-id="'+escapeHTML(String(data.id||''))+'">',
        '    <button class="vote-btn like'+likeActive+'" type="button" aria-label="أعجبني"><span class="vote-count like-count">'+Number(data.likes||0)+'</span><i class="fa-regular fa-thumbs-up"></i></button>',
        '    <button class="vote-btn dislike'+dislikeActive+'" type="button" aria-label="لم يعجبني"><span class="vote-count dislike-count">'+Number(data.dislikes||0)+'</span><i class="fa-regular fa-thumbs-down"></i></button>',
        toggleRepliesHTML,
        '    <button class="vote-btn reply" type="button" aria-label="رد"><i class="fa-regular fa-comment"></i><span class="reply-label">رد</span></button>',
        '    <button class="vote-btn report" type="button" aria-label="الإبلاغ"><i class="fa-regular fa-flag"></i><span class="report-label">إبلاغ</span></button>',
        '    <div class="reply-box">',
        '      <textarea class="reply-input" placeholder="أكتب ردّك..."></textarea>',
        '      <div>',
        '        <button class="send-reply" type="button">إرسال الرد</button>',
        '        <button class="cancel-reply" type="button">إلغاء</button>',
        '      </div>',
        '    </div>',
        '  </div>',
        renderRepliesHTML(data.replies),
        '</div>'
          ].join('');
          reviewsList.appendChild(reviewItem);
        });
      }

      function updateRatingCounts() {
        const counts = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0};
        reviewsData.forEach(review => {
          const r = Number(review.rating) || 0;
          if (counts[r] != null) counts[r]++;
        });
        for (let i = 1; i <= 5; i++) {
          if (countsElements[i]) countsElements[i].textContent = String(counts[i]);
        }
      }

      stars.forEach(star => {
        star.addEventListener('click', () => {
          selectedRating = Number(star.getAttribute('data-value'));
          updateStars(selectedRating);
          checkFormValid();
        });

        star.addEventListener('keydown', e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            selectedRating = Number(star.getAttribute('data-value'));
            updateStars(selectedRating);
            checkFormValid();
          }
        });

        star.addEventListener('mouseover', () => {
          updateStars(Number(star.getAttribute('data-value')));
        });

        star.addEventListener('mouseout', () => {
          updateStars(selectedRating);
        });
      });

      reviewText.addEventListener('input', checkFormValid);

      ratingFilters.addEventListener('click', (e) => {
        const btn = e.target.closest('.rating-filter');
        if (!btn) return;
        const rating = Number(btn.getAttribute('data-rating'));
        filterReviews(Number.isFinite(rating) ? rating : 0);
      });

      async function loadReviews(options) {
        const opts = options || {};
        const showLoading = !reviewsLoadedOnce && !opts.skipLoading;
        if (!isSiteCommentsEnabled()) {
          reviewsData = [];
          updateRatingCounts();
          reviewsList.innerHTML = '<p>تم تعطيل قسم التعليقات حالياً.</p>';
          reviewsLoadedOnce = true;
          redirectDisabledReviewsRoute();
          return;
        }
        if (showLoading) reviewsList.innerHTML = '<p>جاري تحميل التعليقات...</p>';
        try {
          let arr = await readReviewsFromResolvedSiteState();
          if (arr === null) {
            const snap = await REVIEWS_DOC.get();
          if (!snap.exists) {
            reviewsList.innerHTML = '<p>لا توجد تعليقات بعد.</p>';
            return;
          }
          const raw = snap.data()||{};
          const body = await decodeDocDataToBody(raw);
          arr = Array.isArray(body.reviews) ? body.reviews : [];
          applyLoadedReviews(arr);
          return;
          reviewsData = arr.map(r => {
            const createdAtMillis = Number(r.createdAtMillis || Date.parse(r.createdAtISO) || 0);
            return {
              id: String(r.id||''),
              rating: Number(r.rating)||0,
              comment: normalizeDisplayText(String(r.comment||'')),
              userName: normalizeDisplayName(String(r.userName||'مستخدم')),
              createdAtMillis,
              createdAtISO: r.createdAtISO || (createdAtMillis ? new Date(createdAtMillis).toISOString() : ''),
              likes: Number(r.likes||0),
              dislikes: Number(r.dislikes||0),
              replies: Array.isArray(r.replies) ? r.replies : [],
              votes: (r.votes && typeof r.votes==='object') ? r.votes : {}
            };
          });
          try { reviewsData.sort((a,b) => (b.createdAtMillis||0) - (a.createdAtMillis||0)); } catch(_){ }
          updateRatingCounts();
          renderReviews();
          reviewsLoadedOnce = true;
          } else {
            applyLoadedReviews(arr);
          }
        } catch(err) {
          console.error(err);
          if (!reviewsLoadedOnce) {
            reviewsList.innerHTML = '<p>حدث خطأ في تحميل التعليقات.</p>';
          }
        }
      }

      function getStarsHTML(rating) {
        let html = '';
        for (let i = 1; i <= 5; i++) {
          html += i <= rating ? '<i class="fa-solid fa-star"></i>' : '<i class="fa-regular fa-star"></i>';
        }
        return html;
      }

      function countReplies(arr){
        try{
          let c = 0;
          if (Array.isArray(arr)){
            arr.forEach(r => {
              c += 1;
              if (Array.isArray(r && r.replies)) c += countReplies(r.replies);
            });
          }
          return c;
        }catch(_){ return 0; }
      }

      function relativeTime(ts){
        try{
          let diff = Math.max(0, now - Number(ts||0));
          const s = Math.floor(diff/1000);
          if (s < 10) return 'الآن';
          if (s < 60) return `قبل ${s} ثانية`;
          const m = Math.floor(s/60);
          if (m < 60) return `قبل ${m} دقيقة`;
          const h = Math.floor(m/60);
          if (h < 24) return `قبل ${h} ساعة`;
          const d = Math.floor(h/24);
          if (d < 30) return `قبل ${d} يوم`;
          const mo = Math.floor(d/30);
          if (mo < 12) return `قبل ${mo} شهر`;
          const y = Math.floor(mo/12);
          return `قبل ${y} سنة`;
        }catch(_){ return ''; }
      }

      function renderRepliesHTML(replies, prefix){
        try{
          var arr = Array.isArray(replies) ? replies : [];
          if (!arr.length) return '<div class="replies"></div>';
          var html = '<div class="replies collapsed"><div class="replies-list">';
          arr.forEach(function(r, i){
            var t = escapeHTML(normalizeDisplayText(String(r.text||'')));
            var n = escapeHTML(normalizeDisplayName(String(r.userName||'مستخدم')));
            var ms = Number(r.createdAtMillis || Date.parse(r.createdAtISO) || 0);
            var rel = ms ? relativeTime(ms) : '';
            var first = n.trim().charAt(0) || 'م';
            var rid = String(r.rid || r.id || (ms?('ms'+ms):''));
            var idxPath = (prefix==null||prefix==='') ? String(i) : (String(prefix)+'.'+String(i));
            var likes = Number(r.likes||0);
            var dislikes = Number(r.dislikes||0);
            var votes = (r && r.votes && typeof r.votes==='object') ? r.votes : {};
            var userVote = readCurrentReviewVoteValue(votes);
            var likeActive = (userVote===1) ? ' active' : '';
            var dislikeActive = (userVote===-1) ? ' active' : '';
            var childCount = Array.isArray(r.replies) ? r.replies.length : 0;
            html += '<article class="reply-item" data-rid="'+escapeHTML(rid)+'">'+
                      '<div class="review-header">'+
                        '<span class="header-avatar small" aria-hidden="true">'+escapeHTML(first)+'</span>'+ 
                        '<span class="username">@'+n+'</span>'+ 
                      '</div>'+ 
                      '<div class="reply-text">'+t+'</div>'+ 
                      '<div class="review-actions reply-actions" data-parent-rid="'+escapeHTML(rid)+'" data-parent-index="'+escapeHTML(idxPath)+'">'+
                        '<button class="vote-btn like'+likeActive+'" type="button" aria-label="أعجبني"><span class="vote-count like-count">'+likes+'</span><i class="fa-regular fa-thumbs-up"></i></button>'+ 
                        '<button class="vote-btn dislike'+dislikeActive+'" type="button" aria-label="لم يعجبني"><span class="vote-count dislike-count">'+dislikes+'</span><i class="fa-regular fa-thumbs-down"></i></button>'+ 
                        (childCount>0 ? '<button class="vote-btn toggle-replies" type="button" aria-label="إظهار الردود" aria-expanded="false"><span class="vote-count replies-count">'+childCount+'</span><i class="fa-regular fa-comments"></i></button>' : '')+
                      '</div>'+ 
                      (Array.isArray(r.replies) && r.replies.length ? renderRepliesHTML(r.replies, idxPath) : '')+
                    '</article>';
          });
          html +=   '</div></div>';
          return html;
        }catch(_){ return '<div class="replies"></div>'; }
      }

      function parsePayloadSafe(s){
        if (typeof s !== 'string') return null;
        try { return JSON.parse(s); } catch(e){}
        try {
          let fixed = s.replace(/;/g, ',');
          fixed = fixed.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
          return JSON.parse(fixed);
        } catch(e2){ return null; }
      }

      function escapeHTML(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
      }

      async function sendVoteRequest(payload){
        const user = auth.currentUser;
        if (!user) throw new Error("auth_required");
        const idToken = await user.getIdToken(true);
        return sendReviewRequest('vote', payload, idToken);
      }

      async function handleVote(reviewId, vote){
        try{
          const user = auth.currentUser;
          if (!user) { alert('يجب تسجيل الدخول للتصويت.'); return; }
          // تحديث فوري محليًا لتعزيز الاستجابة
          const target = applyVoteLocally({ reviewId, vote });
          // إرسال للخادم في الخلفية
          sendVoteRequest({ reviewId, vote })
            .then((res) => {
              if (target && res) applyServerCounts(target, res);
              try {
                if (typeof window.__refreshSiteStateNow === 'function') {
                  void window.__refreshSiteStateNow();
                }
              } catch(_){}
            })
            .catch((err)=>{ console.error(err); void refreshReviewsDataFromState({ forceNetwork: true, skipLoading: true }); });
        }catch(e){ console.error(e); alert('تعذر تطبيق التصويت حالياً.'); }
      }

      async function handleReplyVote(reviewId, rid, vote){
        try{
          const user = auth.currentUser;
          if (!user) { alert('يجب تسجيل الدخول للتصويت.'); return; }
          const target = applyVoteLocally({ reviewId, replyId: rid, vote });
          sendVoteRequest({ reviewId, replyId: rid, vote })
            .then((res) => {
              if (target && res) applyServerCounts(target, res);
              try {
                if (typeof window.__refreshSiteStateNow === 'function') {
                  void window.__refreshSiteStateNow();
                }
              } catch(_){}
            })
            .catch((err)=>{ console.error(err); void refreshReviewsDataFromState({ forceNetwork: true, skipLoading: true }); });
        }catch(e){ console.error(e); alert('تعذر تطبيق التصويت على الرد حالياً.'); }
      }

      function applyVoteLocally({ reviewId, replyId = null, vote }){
        if (!Array.isArray(reviewsData) || !reviewId || ![1,-1].includes(vote)) return;
        const actorKeys = resolveCurrentReviewActorKeys();
        const primaryActorKey = resolveCurrentReviewActorId();
        const review = reviewsData.find(r => String(r.id||'') === String(reviewId));
        if (!review) return;
        const target = replyId
          ? findReplyByRid(review.replies, replyId)
          : review;
        if (!target) return;
        target.likes = Number(target.likes||0);
        target.dislikes = Number(target.dislikes||0);
        target.votes = (target.votes && typeof target.votes==='object') ? target.votes : {};
        let prev = 0;
        actorKeys.forEach((key) => {
          if (prev) return;
          const stored = Number(target.votes[key]||0);
          if (stored === 1 || stored === -1) prev = stored;
        });
        actorKeys.forEach((key) => {
          if (!key) return;
          delete target.votes[key];
        });
        if (prev === vote){
          if (vote === 1 && target.likes>0) target.likes -= 1;
          if (vote === -1 && target.dislikes>0) target.dislikes -= 1;
        } else {
          if (prev === 1 && target.likes>0) target.likes -= 1;
          if (prev === -1 && target.dislikes>0) target.dislikes -= 1;
          if (vote === 1) target.likes += 1; else if (vote === -1) target.dislikes += 1;
          if (primaryActorKey) target.votes[primaryActorKey] = vote;
        }
        renderReviews();
        return target;
      }

      function applyServerCounts(target, res){
        if (!target || !res) return;
        if (typeof res.likes === 'number') target.likes = res.likes;
        if (typeof res.dislikes === 'number') target.dislikes = res.dislikes;
        renderReviews();
      }

      function genRid(){ try{ return 'r'+Date.now().toString(36)+Math.random().toString(36).slice(2,8); }catch(_){ return String(Date.now()); } }

      function findReplyByRid(arr, rid){
        try{
          if (!Array.isArray(arr)) return null;
          for (var i=0;i<arr.length;i++){
            var r = arr[i];
            if (r && String(r.rid||'') === String(rid||'')) return r;
            var c = findReplyByRid(r && r.replies, rid);
            if (c) return c;
          }
          return null;
        }catch(_){ return null; }
      }

      function getReplyByIndexPath(arr, path){
        try{
          var parts = String(path||'').split('.').filter(Boolean);
          var node = null;
          var list = arr;
          for (var i=0;i<parts.length;i++){
            var idx = parseInt(parts[i],10);
            if (!Array.isArray(list) || isNaN(idx) || idx<0 || idx>=list.length) return null;
            node = list[idx];
            list = node && node.replies;
          }
          return node;
        }catch(_){ return null; }
      }

      async function handleReply(reviewId, text, parentRid, parentIndexPath){
        try{
          const user = auth.currentUser;
          if (!user) { alert('يجب تسجيل الدخول للرد.'); return; }
          if (!isSiteCommentsEnabled()) {
            alert('تم تعطيل قسم التعليقات حالياً.');
            redirectDisabledReviewsRoute();
            return;
          }
          const cleanText = normalizeDisplayText(String(text || '').trim());
          if (!cleanText) return;
          if (containsBadWords(cleanText)) {
            alert('تعذر إرسال الرد بسبب وجود كلمات غير لائقة.');
            return;
          }
          const now = Date.now();

          const idToken = await user.getIdToken().catch(() => user.getIdToken(true));
          await sendReviewRequest('reply', {
            reviewId: String(reviewId || ''),
            text: cleanText,
            parentRid: String(parentRid || ''),
            parentIndexPath: String(parentIndexPath || '')
          }, idToken);
          await refreshReviewsDataFromState({ forceNetwork: true });
        }catch(e){ console.error(e); alert('تعذر إرسال الرد حالياً.'); }
      }

      try {
        window.addEventListener('site-state-updated', function(){
          if (!window.__REVIEWS_PAGE_ACTIVE__) return;
          syncReviewComposerState(auth.currentUser || currentReviewUser || null);
          if (!isReviewsRouteActive()) return;
          if (!isSiteCommentsEnabled()) {
            reviewsData = [];
            updateRatingCounts();
            reviewsList.innerHTML = '<p>تم تعطيل قسم التعليقات حالياً.</p>';
            redirectDisabledReviewsRoute();
            return;
          }
          void loadReviews({ skipLoading: reviewsLoadedOnce });
        });
      } catch(_){}

      async function reportReview(reviewId){
        if (!reviewId) return;
        const user = auth.currentUser;
        if (!user) {
          alert('يجب تسجيل الدخول قبل الإبلاغ.');
          return;
        }
        const confirmReport = window.confirm('هل تريد الإبلاغ عن هذا التعليق؟');
        if (!confirmReport) return;
        let reason = window.prompt('اذكر سبب الإبلاغ (اختياري):', '') || '';
        if (reason.length > 240) reason = reason.slice(0, 240);
        try{
          const token = await user.getIdToken().catch(() => user.getIdToken(true));
          await sendReviewRequest('report', { reviewId, reason }, token);
          alert('شكرًا لك، تم إرسال البلاغ للمراجعة.');
        }catch(err){
          alert('تعذر إرسال البلاغ: ' + (err?.message || 'خطأ غير معروف.'));
        }
      }

      function attachListEvents(){
        if (reviewsList.__reviewsBound) return;
        reviewsList.__reviewsBound = true;
        reviewsList.addEventListener('click', async (e) => {
          const likeBtn = e.target.closest('.vote-btn.like');
          const dislikeBtn = e.target.closest('.vote-btn.dislike');
          const toggleRepliesBtn = e.target.closest('.vote-btn.toggle-replies');
          const replyToggle = e.target.closest('.vote-btn.reply');
          const reportBtn = e.target.closest('.vote-btn.report');
          const sendReplyBtn = e.target.closest('.send-reply');
          const cancelReplyBtn = e.target.closest('.cancel-reply');
          const replyActionContainer = e.target.closest('.reply-actions');

          if (replyToggle) {
            const container = e.target.closest('.review-actions');
            if (container) {
              const box = container.querySelector('.reply-box');
              if (box) box.classList.toggle('open');
            }
            return;
          }

          const rootItem = e.target.closest('.review-item');
          const rootActions = rootItem ? rootItem.querySelector('.review-actions[data-id]') : null;
          const id = rootActions ? rootActions.getAttribute('data-id') : null;
          if (!id) return;

          if (reportBtn){
            await reportReview(id);
            return;
          }

          if (toggleRepliesBtn){
            const replyArticle = e.target.closest('.reply-item');
            if (replyArticle){
              let repliesEl = null;
              try {
                const children = Array.from(replyArticle.children || []);
                repliesEl = children.find(el => el.classList && el.classList.contains('replies')) || replyArticle.querySelector('.replies');
              } catch(_){ }
              if (repliesEl){
                const willOpen = repliesEl.classList.contains('collapsed');
                repliesEl.classList.toggle('collapsed');
                toggleRepliesBtn.setAttribute('aria-expanded', String(willOpen));
                toggleRepliesBtn.classList.toggle('active', willOpen);
              }
              return;
            }
            if (rootItem){
              const repliesEl = rootItem.querySelector('.review-main > .replies');
              if (repliesEl){
                const willOpen = repliesEl.classList.contains('collapsed');
                repliesEl.classList.toggle('collapsed');
                toggleRepliesBtn.setAttribute('aria-expanded', String(willOpen));
                toggleRepliesBtn.classList.toggle('active', willOpen);
              }
            }
            return;
          }

          if (likeBtn) {
            if (replyActionContainer){
              const rid = replyActionContainer.getAttribute('data-parent-rid') || '';
              if (rid) { await handleReplyVote(id, rid, 1); }
            } else {
              await handleVote(id, 1);
            }
            return;
          }
          if (dislikeBtn) {
            if (replyActionContainer){
              const rid = replyActionContainer.getAttribute('data-parent-rid') || '';
              if (rid) { await handleReplyVote(id, rid, -1); }
            } else {
              await handleVote(id, -1);
            }
            return;
          }
          if (sendReplyBtn) {
            const container = e.target.closest('.review-actions');
            if (!container) return;
            const ta = container.querySelector('.reply-input');
            const text = ta ? ta.value.trim() : '';
            if (!text) return;
            const parentRid = container.getAttribute('data-parent-rid') || '';
            const parentIndex = container.getAttribute('data-parent-index') || '';
            await handleReply(id, text, parentRid, parentIndex);
            return;
          }
          if (cancelReplyBtn) {
            const container = e.target.closest('.review-actions');
            if (!container) return;
            const box = container.querySelector('.reply-box');
            if (box) {
              const ta = box.querySelector('.reply-input');
              if (ta) ta.value = '';
              box.classList.remove('open');
            }
            return;
          }
        });
        reviewsList.addEventListener('keydown', async (e) => {
          const t = e.target;
          if (!t || !t.classList || (!t.classList.contains('reply-link') && !t.classList.contains('reply'))) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            const container = t.closest('.review-actions');
            if (!container) return;
            const box = container.querySelector('.reply-box');
            if (box) box.classList.toggle('open');
          }
        });
      }

      function start(){
        attachListEvents();
        filterReviews(0);
        void loadReviews();
      }

      window.__REVIEWS_REFRESH__ = function(){
        try { void loadReviews({ skipLoading: true }); } catch(_){ }
      };
      window.__REVIEWS_RELOAD__ = function(){
        try { void refreshReviewsDataFromState({ forceNetwork: true }); } catch(_){ }
      };

      if (document.readyState === 'loading'){
        document.addEventListener('DOMContentLoaded', start, { once: true });
      } else {
        start();
      }
    })(authInstance, dbInstance);
  };
})();

;
