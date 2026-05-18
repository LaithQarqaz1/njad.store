(function(){
  if (typeof window === 'undefined') return;
  if (window.__WALLET_SCRIPT_ATTACHED__) return;
  window.__WALLET_SCRIPT_ATTACHED__ = true;
  var WALLET_INLINE_MEMORY = window.__WALLET_INLINE_MEMORY__ || {
    historyCache: {},
    requestSource: {},
    lastCode: {},
    filters: {}
  };
  try { window.__WALLET_INLINE_MEMORY__ = WALLET_INLINE_MEMORY; } catch(_){ }

  function getWalletHistoryPageConfig(pageMode){
    var mode = String(pageMode || 'wallet').trim().toLowerCase() === 'payments' ? 'payments' : 'wallet';
    if (mode === 'payments') {
      return {
        pageKey: 'payments',
        routeKey: 'dafaati',
        activeFlag: '__PAYMENTS_PAGE_ACTIVE__',
        listId: 'paymentsList',
        toolbarId: 'paymentsToolbar',
        dateChipId: 'paymentsDateChip',
        datePickerId: 'paymentsDatePicker',
        refreshId: 'refreshPayments',
        refreshFnName: '__PAYMENTS_REFRESH__',
        cachePrefix: 'payments:cache:',
        filterPrefix: 'payments:filter:',
        lastCodePrefix: 'payments:lastCode:',
        emptyText: 'لا توجد طلبات إيداع أو سحب حتى الآن.',
        authRequiredText: 'يرجى تسجيل الدخول لعرض دفعاتك.'
      };
    }
    return {
      pageKey: 'wallet',
      routeKey: 'wallet',
      activeFlag: '__WALLET_PAGE_ACTIVE__',
      listId: 'walletList',
      toolbarId: 'walletToolbar',
      dateChipId: 'walletDateChip',
      datePickerId: 'walletDatePicker',
      refreshId: 'refreshWallet',
      refreshFnName: '__WALLET_REFRESH__',
      cachePrefix: 'wallet:cache:',
      filterPrefix: 'wallet:filter:',
      lastCodePrefix: 'wallet:lastCode:',
      emptyText: 'لا توجد معاملات للمحفظة حتى الآن.',
      authRequiredText: 'يرجى تسجيل الدخول لعرض معاملات محفظتك.'
    };
  }

  async function initWalletLikePage(pageMode){
    var pageConfig = getWalletHistoryPageConfig(pageMode);
    var activeFlag = pageConfig.activeFlag;
    if (window[activeFlag]) return;
    window[activeFlag] = true;

    try {
      if (typeof window.__FIREBASE_ENV_OK__ === 'boolean' && !window.__FIREBASE_ENV_OK__) {
        console.warn('المحفظة: تم تعطيل Firebase في هذه البيئة.');
        window[activeFlag] = false;
        return;
      }
    } catch(_){ }

    if (typeof firebase === 'undefined') {
      try {
        if (typeof window.initFirebaseApp === 'function') {
          await window.initFirebaseApp();
        } else if (typeof window.__loadFirebaseCompat === 'function') {
          await window.__loadFirebaseCompat();
        }
      } catch(_){ }
    }

    if (typeof firebase === 'undefined') {
      console.info('المحفظة: Firebase لم يجهز بعد، سيتم متابعة العرض بدون بيانات مباشرة.');
      window[activeFlag] = false;
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
      console.info('المحفظة: تعذر الوصول إلى Firebase الآن، سيتم متابعة العرض بدون بيانات مباشرة.');
      window[activeFlag] = false;
      return;
    }

    (function(auth, db, pageConfig){
      const listEl = document.getElementById(pageConfig.listId);
      const chipsWrap = document.getElementById(pageConfig.toolbarId);

      const refreshBtn = document.getElementById(pageConfig.refreshId);

      if (!listEl || !chipsWrap){
        window[activeFlag] = false;
        return;
      }

      const CACHE_PREFIX = pageConfig.cachePrefix;
      const FILTER_PREFIX = pageConfig.filterPrefix;
      const LAST_CODE_PREFIX = pageConfig.lastCodePrefix;
      const CACHE_SCHEMA_VERSION = 5;
      const PAGE_MODE = pageConfig.pageKey;
      const PENDING_AUTO_REFRESH_MS = 10000;
      const RECENT_SERVER_SYNC_TTL_MS = 5000;
      const IMMEDIATE_RELOAD_DEDUPE_MS = 1200;
      const REQUEST_SOURCE_CACHE_PREFIX = 'wallet:request-source:';
      const DATE_CHIP_ID = pageConfig.dateChipId;
      const DATE_PICKER_ID = pageConfig.datePickerId;
      const HISTORY_MEMORY = WALLET_INLINE_MEMORY.historyCache;
      const REQUEST_SOURCE_MEMORY = WALLET_INLINE_MEMORY.requestSource;
      const LAST_CODE_MEMORY = WALLET_INLINE_MEMORY.lastCode;
      const FILTER_MEMORY = WALLET_INLINE_MEMORY.filters;

      let ALL_ITEMS = [];
      let CURRENT_FILTER = 'all';
      let LAST_USER_ID = null;
      let FETCH_ALL_INFLIGHT_UID = '';
      let FETCH_ALL_INFLIGHT_PROMISE = null;
      let LAST_LOAD_REQUEST_UID = '';
      let LAST_LOAD_REQUEST_AT = 0;
      let DATE_FILTER_ENABLED = true;
      let SELECTED_DATE_STR = '';
      let DATE_MODE = 'single';
      let DATE_RANGE = { from: null, to: null };
      const HISTORY_CAL = { el: null, year: 0, month: 0 };
      const CALENDAR_OWNER = `wallet-like-${PAGE_MODE}`;
      let TRANSACTION_DETAILS_MODAL = null;
      let TRANSACTION_DETAILS_LAST_FOCUS = null;
      let TRANSACTION_DETAILS_REQUEST_TOKEN = '';
      let AUTO_REFRESH_BOUND = false;
      let PENDING_AUTO_REFRESH_ID = 0;

      function historyT(key, ar, en, fr){
        try {
          if (typeof ordersT === 'function') return ordersT(key, ar, en, fr);
        } catch(_){}
        return ar;
      }

      function getHistoryLocale(){
        try {
          if (typeof getUiLocale === 'function') return getUiLocale();
        } catch(_){}
        return 'ar-EG';
      }

      function getTodayDateStr(){
        const d = new Date();
        return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
      }

      function formatHistoryDateStr(str){
        try{
          const parts = String(str || '').split('-').map(Number);
          const d = new Date(parts[0] || 0, (parts[1] || 1) - 1, parts[2] || 1);
          return d.toLocaleDateString(getHistoryLocale(), { year:'numeric', month:'long', day:'numeric' });
        }catch(_){
          return String(str || '');
        }
      }

      function getItemTimeMs(item){
        const date = asDate(item && (item.createdAt || item.created_at || item.computedAt || item.timestamp));
        return date && !isNaN(date.getTime()) ? date.getTime() : 0;
      }

      function isSameHistoryDay(ms, ymd){
        if (!ms || !ymd) return false;
        try{
          const d = new Date(ms);
          return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}` === ymd;
        }catch(_){
          return false;
        }
      }

      function getHistoryMinDateStr(){
        let minMs = 0;
        (Array.isArray(ALL_ITEMS) ? ALL_ITEMS : []).forEach(function(item){
          const ms = getItemTimeMs(item);
          if (!ms) return;
          if (!minMs || ms < minMs) minMs = ms;
        });
        if (!minMs) return getTodayDateStr();
        const d = new Date(minMs);
        return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
      }

      function applyDefaultDateFilter(){
        DATE_FILTER_ENABLED = true;
        SELECTED_DATE_STR = getTodayDateStr();
        DATE_MODE = 'single';
        DATE_RANGE = { from: null, to: null };
      }

      function resetDateFilter(){
        DATE_FILTER_ENABLED = false;
        SELECTED_DATE_STR = null;
        DATE_MODE = 'single';
        DATE_RANGE = { from: null, to: null };
      }

      function getDateChipText(){
        const dateLabel = historyT("history.dateLabel", "التاريخ", "Date", "Date");
        if (!DATE_FILTER_ENABLED) return dateLabel;
        if (DATE_MODE === 'range'){
          const from = DATE_RANGE && DATE_RANGE.from ? String(DATE_RANGE.from) : '';
          const to = DATE_RANGE && DATE_RANGE.to ? String(DATE_RANGE.to) : '';
          if (from && to) return `${dateLabel}: ${formatHistoryDateStr(from)} - ${formatHistoryDateStr(to)}`;
          if (from) return `${dateLabel}: ${formatHistoryDateStr(from)}`;
          return dateLabel;
        }
        return `${dateLabel}: ${formatHistoryDateStr(SELECTED_DATE_STR || getTodayDateStr())}`;
      }

      function getActiveInlineRouteKey(){
        try {
          return String(document.body && document.body.getAttribute('data-inline-route') || '').toLowerCase();
        } catch(_){
          return '';
        }
      }

      function isPageRouteActive(){
        const routeKey = String(pageConfig.routeKey || PAGE_MODE || '').toLowerCase();
        return !!routeKey && getActiveInlineRouteKey() === routeKey;
      }

      function markLoadRequest(uid){
        LAST_LOAD_REQUEST_UID = String(uid || '').trim();
        LAST_LOAD_REQUEST_AT = Date.now();
      }

      function shouldSkipImmediateReload(uid, force){
        if (force) return false;
        const safeUid = String(uid || '').trim();
        if (!safeUid || LAST_LOAD_REQUEST_UID !== safeUid) return false;
        return (Date.now() - LAST_LOAD_REQUEST_AT) < IMMEDIATE_RELOAD_DEDUPE_MS;
      }

      function readRequestSourceHint(collectionName, uid){
        const collection = String(collectionName || '').trim();
        const safeUid = String(uid || '').trim();
        if (!collection || !safeUid) return '';
        try {
          const value = String(REQUEST_SOURCE_MEMORY[REQUEST_SOURCE_CACHE_PREFIX + collection + ':' + safeUid] || '').trim().toLowerCase();
          return value === 'doc' || value === 'query' || value === 'query-unordered' ? value : '';
        } catch(_){
          return '';
        }
      }

      function writeRequestSourceHint(collectionName, uid, source){
        const collection = String(collectionName || '').trim();
        const safeUid = String(uid || '').trim();
        const normalized = String(source || '').trim().toLowerCase();
        if (!collection || !safeUid) return;
        if (normalized !== 'doc' && normalized !== 'query' && normalized !== 'query-unordered') return;
        try { REQUEST_SOURCE_MEMORY[REQUEST_SOURCE_CACHE_PREFIX + collection + ':' + safeUid] = normalized; } catch(_){ }
      }

      function sortRequestItemsByNewest(arr){
        return (arr || []).slice().sort(function(a,b){
          const taDate = asDate(a && (a.createdAt || a.timestamp));
          const tbDate = asDate(b && (b.createdAt || b.timestamp));
          const ta = taDate && !isNaN(taDate.getTime()) ? taDate.getTime() : 0;
          const tb = tbDate && !isNaN(tbDate.getTime()) ? tbDate.getTime() : 0;
          return tb - ta;
        });
      }

      async function fetchRequestsByQuery(uid, collectionName, kind, filterFn){
        const baseRef = db.collection(collectionName).where('userId','==',uid);
        try{
          const snap = await baseRef.orderBy('createdAt','desc').get();
          let arr = snap.docs.map(function(d){ return docToItem(d, kind); });
          if (typeof filterFn === 'function') arr = arr.filter(filterFn);
          writeRequestSourceHint(collectionName, uid, 'query');
          return arr;
        }catch(e){
          const msg = String(e && e.message || e || '');
          if (msg.includes('requires an index') || msg.includes('FAILED_PRECONDITION')){
            try{
              const snap2 = await baseRef.get();
              let arr = snap2.docs.map(function(d){ return docToItem(d, kind); });
              if (typeof filterFn === 'function') arr = arr.filter(filterFn);
              arr = sortRequestItemsByNewest(arr);
              writeRequestSourceHint(collectionName, uid, 'query-unordered');
              return arr;
            }catch(_){ return []; }
          }
          return [];
        }
      }

      function cardSkeleton(){ const d=document.createElement('div'); d.className='card loading'; d.style.minHeight='118px'; return d; }
      function showSkeleton(n=3){ listEl.innerHTML=''; for(let i=0;i<n;i++) listEl.appendChild(cardSkeleton()); }
      function showEmpty(){
        listEl.innerHTML = '<div class="empty">' + String(pageConfig.emptyText || '').trim() + '</div>';
        closeTransactionDetailsModal();
      }
      function showRequiresAuth(){
        listEl.innerHTML = '<div class="empty">' + String(pageConfig.authRequiredText || '').trim() + '</div>';
        chipsWrap.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        ALL_ITEMS = [];
        CURRENT_FILTER = 'all';
        LAST_USER_ID = null;
        closeTransactionDetailsModal();
        applyDefaultDateFilter();
        syncWalletToolbarUI();
      }

      function asDate(ts){
        try{
          if (!ts) return null;
          if (ts.toDate) return ts.toDate();
          if (typeof ts === 'object' && ts.seconds) return new Date(ts.seconds * 1000);
          return new Date(ts);
        }catch(_){ return null; }
      }
      function formatDate(ts){
        const d = asDate(ts);
        if (!d || isNaN(d.getTime())) return ts || '-';
        try{
          return d.toLocaleString('ar-EG',{ weekday:'long', year:'numeric', month:'long', day:'numeric', hour:'2-digit', minute:'2-digit' });
        }catch(_){ return d.toString(); }
      }

      function normStatus(s){
        const v = (s||'').toString().toLowerCase();
        if (v.includes('reject') || v.includes('مرفوض') || v.includes('ط¸â€¦ط·آ±ط¸ظ¾ط¸ث†ط·آ¶')) return 'rejected';
        if (v.includes('approved') || v.includes('accept') || v.includes('accepted') || v.includes('done') || v.includes('completed') || v.includes('success') || v.includes('تم') || v.includes('مقبول') || v.includes('مقبولة') || v.includes('ط·ع¾ط¸â€¦') || v.includes('ط¸â€¦ط¸â€ڑط·آ¨ط¸ث†ط¸â€‍')) return 'approved';
        return 'pending';
      }
      function statusClass(s){
        const n = normStatus(s);
        if (n === 'rejected') return 'status rejected';
        if (n === 'approved') return 'status approved';
        return 'status pending';
      }
      function statusLabel(s){
        const n = normStatus(s);
        if (n === 'rejected') return 'مرفوضة';
        if (n === 'approved') return 'مقبولة';
        return 'قيد المراجعة';
      }

      function parseNumeric(value){
        if (value == null) return null;
        if (typeof value === 'number') return isFinite(value) ? value : null;
        if (typeof value === 'string'){
          var cleaned = value.replace(/[^\d\-,.]/g,'').replace(/,/g,'');
          if (!cleaned) return null;
          var num = Number(cleaned);
          return isFinite(num) ? num : null;
        }
        return null;
      }

      function escapeHtmlAttr(value){
        return String(value == null ? '' : value)
          .replace(/&/g, '&amp;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
      }

      function normalizeProofUrl(value){
        var raw = value;
        if (raw && typeof raw === 'object'){
          raw = raw.url || raw.href || raw.link || raw.proofUrl || raw.proofURL || '';
        }
        var txt = String(raw == null ? '' : raw).trim();
        if (!txt) return '';
        try{
          var base = (typeof location !== 'undefined' && location && location.origin) ? location.origin : '/';
          var url = new URL(txt, base);
          if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
          return url.href;
        }catch(_){
          return '';
        }
      }

      function resolveProofUrl(item){
        if (!item || typeof item !== 'object') return '';
        var keys = [
          'proofUrl', 'proofURL', 'proof_url',
          'proofImageUrl', 'proofImageURL', 'proof_image_url',
          'receiptUrl', 'receiptURL', 'receipt_url',
          'paymentProofUrl', 'paymentProofURL', 'payment_proof_url',
          'screenshotUrl', 'screenshotURL', 'screenshot_url',
          'attachmentUrl', 'attachmentURL', 'attachment_url',
          'slipUrl', 'slipURL', 'slip_url',
          'proof', 'receiptImage', 'receipt_image'
        ];
        for (var i = 0; i < keys.length; i++){
          var key = keys[i];
          var normalized = normalizeProofUrl(item[key]);
          if (normalized) return normalized;
        }
        return '';
      }

      function pickNumber(item, keys){
        if (!item || !keys || !keys.length) return null;
        for (var i = 0; i < keys.length; i++){
          var key = keys[i];
          if (!key) continue;
          var val = item[key];
          var num = parseNumeric(val);
          if (num != null) return num;
        }
        return null;
      }

      function digitsForCurrency(cur){
        return 3;
      }

      function roundForDisplay(value, digits){
        var num = Number(value);
        var precise = Math.max(0, Number.isFinite(Number(digits)) ? Number(digits) : 3);
        if (!isFinite(num)) return 0;
        var factor = Math.pow(10, precise);
        var rounded = Math.round((num + Number.EPSILON) * factor) / factor;
        if (!isFinite(rounded) || Math.abs(rounded) < (1 / factor)) return 0;
        return rounded;
      }

      function formatNumber(value, digits){
        if (value == null || !isFinite(value)) return '0';
        var precise = typeof digits === 'number' ? digits : 2;
        var displayValue = roundForDisplay(value, precise);
        try{
          return Number(displayValue).toLocaleString('ar-EG',{ minimumFractionDigits: precise, maximumFractionDigits: precise });
        }catch(_){
          try{
            return Number(displayValue).toLocaleString('en-US',{ minimumFractionDigits: precise, maximumFractionDigits: precise });
          }catch(__){
            return Number(displayValue).toFixed(precise);
          }
        }
      }

      function pad2(num){
        var n = Number(num) || 0;
        return n < 10 ? '0'+n : String(n);
      }

      function formatShortDate(ts){
        var d = asDate(ts);
        if (!d || isNaN(d.getTime())) return '';
        var timeStr = '';
        try{
          timeStr = d.toLocaleTimeString('ar-EG',{ hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false });
        }catch(_){
          timeStr = pad2(d.getHours())+':'+pad2(d.getMinutes())+':'+pad2(d.getSeconds());
        }
        var dateStr = d.getFullYear() + '-' + pad2(d.getMonth()+1) + '-' + pad2(d.getDate());
        return timeStr ? (timeStr + ' ' + dateStr) : dateStr;
      }

      function formatBalanceValue(value, currency){
        if (value == null || !isFinite(value)) return '';
        var cur = 'USD';
        return formatNumber(value, digitsForCurrency(cur)) + ' ' + cur;
      }

      function applyDateFilter(arr){
        const list = Array.isArray(arr) ? arr : [];
        if (!DATE_FILTER_ENABLED) return list.slice();
        if (DATE_MODE === 'range'){
          const fromRaw = DATE_RANGE && DATE_RANGE.from ? String(DATE_RANGE.from) : '';
          const toRaw = DATE_RANGE && DATE_RANGE.to ? String(DATE_RANGE.to) : '';
          if (fromRaw && toRaw){
            const from = fromRaw <= toRaw ? fromRaw : toRaw;
            const to = toRaw >= fromRaw ? toRaw : fromRaw;
            return list.filter(function(item){
              const ms = getItemTimeMs(item);
              if (!ms) return false;
              const d = new Date(ms);
              const ymd = `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
              return ymd >= from && ymd <= to;
            });
          }
          if (fromRaw && !toRaw){
            return list.filter(function(item){ return isSameHistoryDay(getItemTimeMs(item), fromRaw); });
          }
          return list.slice();
        }
        return list.filter(function(item){
          return isSameHistoryDay(getItemTimeMs(item), SELECTED_DATE_STR || getTodayDateStr());
        });
      }

      function getVisibleItems(){
        return applyDateFilter(applyFilter(ALL_ITEMS));
      }

      function computeHistoryDateCounts(){
        const filtered = applyFilter(ALL_ITEMS);
        const map = {};
        filtered.forEach(function(item){
          const ms = getItemTimeMs(item);
          if (!ms) return;
          const d = new Date(ms);
          const ymd = `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
          map[ymd] = (map[ymd] || 0) + 1;
        });
        return map;
      }

      function syncWalletToolbarUI(){
        try{
          chipsWrap.querySelectorAll('.chip[data-filter]').forEach(function(chip){
            chip.classList.toggle('active', (chip.dataset.filter || 'all') === CURRENT_FILTER);
          });
          const dateChip = document.getElementById(DATE_CHIP_ID);
          if (dateChip){
            dateChip.textContent = getDateChipText();
            dateChip.classList.toggle('active', DATE_FILTER_ENABLED);
          }
          const datePicker = document.getElementById(DATE_PICKER_ID);
          if (datePicker) {
            datePicker.value = DATE_FILTER_ENABLED && DATE_MODE === 'single' ? (SELECTED_DATE_STR || '') : '';
          }
        }catch(_){}
      }

      function renderVisibleItems(uid){
        renderDeposits(getVisibleItems());
        fixWalletTextNodes(listEl);
        syncWalletToolbarUI();
        if (uid) selectLastCard(uid);
      }

      function hasPendingHistoryItems(list){
        return (Array.isArray(list) ? list : []).some(function(item){
          return normStatus((item && (item.status || item.state || item.depositStatus)) || '') === 'pending';
        });
      }

      function requestSoftHistoryRefresh(){
        if (!isPageRouteActive()) return;
        try {
          loadWalletFor(auth.currentUser, { skipSkeleton: true });
        } catch(_){ }
      }

      function bindAutoHistoryRefresh(){
        if (AUTO_REFRESH_BOUND || typeof window === 'undefined') return;
        AUTO_REFRESH_BOUND = true;

        function refreshIfNeeded(){
          if (!isPageRouteActive()) return;
          try {
            if (document.hidden) return;
          } catch(_){ }
          if (!hasPendingHistoryItems(ALL_ITEMS)) return;
          requestSoftHistoryRefresh();
        }

        try {
          document.addEventListener('visibilitychange', function(){
            if (document.hidden) return;
            refreshIfNeeded();
          });
        } catch(_){ }

        try { window.addEventListener('focus', refreshIfNeeded); } catch(_){ }

        try {
          PENDING_AUTO_REFRESH_ID = window.setInterval(function(){
            refreshIfNeeded();
          }, PENDING_AUTO_REFRESH_MS);
        } catch(_){ }
      }

      function closeHistoryCalendar(){
        try{
          if (HISTORY_CAL.el){
            HISTORY_CAL.el.remove();
            HISTORY_CAL.el = null;
          }
        }catch(_){}
      }
      try{
        window.__WALLET_LIKE_CALENDAR_CLOSE__ = window.__WALLET_LIKE_CALENDAR_CLOSE__ || {};
        window.__WALLET_LIKE_CALENDAR_CLOSE__[PAGE_MODE] = function(){ closeHistoryCalendar(); };
      }catch(_){}

      function shiftHistoryCalendar(delta){
        let y = HISTORY_CAL.year;
        let m = HISTORY_CAL.month + delta;
        if (m < 0){ m = 11; y -= 1; }
        else if (m > 11){ m = 0; y += 1; }
        HISTORY_CAL.year = y;
        HISTORY_CAL.month = m;
        renderHistoryCalendar(y, m);
      }

      function renderHistoryCalendar(year, month){
        try{
          if (HISTORY_CAL.el && document.body && !document.body.contains(HISTORY_CAL.el)) {
            HISTORY_CAL.el = null;
          }
        }catch(_){}
        if (!HISTORY_CAL.el) return;
        const titleEl = HISTORY_CAL.el.querySelector('#historyCalTitle');
        const grid = HISTORY_CAL.el.querySelector('#historyCalGrid');
        const counts = computeHistoryDateCounts();
        const first = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0).getDate();
        const dow = first.getDay();
        const todayStr = getTodayDateStr();
        const minDateStr = getHistoryMinDateStr();
        try{
          const prevBtn = HISTORY_CAL.el.querySelector('#historyCalPrev');
          const nextBtn = HISTORY_CAL.el.querySelector('#historyCalNext');
          const now = new Date();
          const curY = now.getFullYear();
          const curM = now.getMonth();
          const minParts = minDateStr.split('-').map(Number);
          const minY = minParts[0] || curY;
          const minM = (minParts[1] || 1) - 1;
          const atMin = (year < minY) || (year === minY && month <= minM);
          const atMax = (year > curY) || (year === curY && month >= curM);
          if (prevBtn){
            prevBtn.disabled = atMin;
            prevBtn.setAttribute('aria-disabled', atMin ? 'true' : 'false');
            prevBtn.style.opacity = atMin ? '.5' : '1';
          }
          if (nextBtn){
            nextBtn.disabled = atMax;
            nextBtn.setAttribute('aria-disabled', atMax ? 'true' : 'false');
            nextBtn.style.opacity = atMax ? '.5' : '1';
          }
        }catch(_){}
        if (titleEl) titleEl.textContent = `${pad2(month + 1)}/${year}`;
        try{
          const btnSingle = HISTORY_CAL.el.querySelector('#historyCalModeSingle');
          const btnRange = HISTORY_CAL.el.querySelector('#historyCalModeRange');
          const btnClear = HISTORY_CAL.el.querySelector('#historyCalClear');
          if (btnSingle) btnSingle.classList.toggle('active', DATE_MODE === 'single');
          if (btnRange) btnRange.classList.toggle('active', DATE_MODE === 'range');
          if (btnClear) btnClear.classList.toggle('active', !DATE_FILTER_ENABLED);
          const selectionText = HISTORY_CAL.el.querySelector('#historyCalSelectionText');
          if (selectionText){
            if (!DATE_FILTER_ENABLED){
              selectionText.textContent = historyT("history.date.all", "كل التواريخ", "All dates", "Toutes les dates");
            } else if (DATE_MODE === 'range'){
              const from = DATE_RANGE && DATE_RANGE.from ? String(DATE_RANGE.from) : '';
              const to = DATE_RANGE && DATE_RANGE.to ? String(DATE_RANGE.to) : '';
              if (from && to) selectionText.textContent = `${historyT("history.date.from", "من", "From", "De")} ${formatHistoryDateStr(from)} ${historyT("history.date.to", "إلى", "to", "a")} ${formatHistoryDateStr(to)}`;
              else if (from) selectionText.textContent = `${historyT("history.date.start", "ابدأ", "Start", "Debut")}: ${formatHistoryDateStr(from)} - ${historyT("history.date.pickEnd", "اختر النهاية", "Pick end", "Choisir la fin")}`;
              else selectionText.textContent = historyT("history.date.pickRange", "اختر نطاق تاريخ", "Choose date range", "Choisir une plage");
            } else {
              selectionText.textContent = formatHistoryDateStr(SELECTED_DATE_STR || getTodayDateStr());
            }
          }
        }catch(_){}
        const weekdays = ['أحد','إثنين','ثلاثاء','أربعاء','خميس','جمعة','سبت'];
        let html = '';
        for (let i = 0; i < 7; i += 1) html += `<div class="calendar-weekday">${weekdays[i]}</div>`;
        for (let i = 0; i < dow; i += 1) html += `<div class="calendar-spacer"></div>`;
        const selected = SELECTED_DATE_STR || todayStr;
        const rawFrom = DATE_RANGE && DATE_RANGE.from ? String(DATE_RANGE.from) : '';
        const rawTo = DATE_RANGE && DATE_RANGE.to ? String(DATE_RANGE.to) : '';
        const from = rawFrom && rawTo && rawFrom > rawTo ? rawTo : rawFrom;
        const to = rawFrom && rawTo && rawFrom > rawTo ? rawFrom : rawTo;
        for (let day = 1; day <= lastDay; day += 1){
          const ymd = `${year}-${pad2(month + 1)}-${pad2(day)}`;
          const count = counts[ymd] || 0;
          const has = count > 0 ? ' has' : '';
          let active = '';
          let rangeCls = '';
          if (DATE_FILTER_ENABLED && DATE_MODE === 'range'){
            if (from && to && ymd > from && ymd < to) rangeCls += ' in-range';
            if (from && ymd === from) { rangeCls += ' range-start'; active = ' active'; }
            if (to && ymd === to) { rangeCls += ' range-end'; active = ' active'; }
          } else if (DATE_FILTER_ENABLED && DATE_MODE === 'single'){
            active = ymd === selected ? ' active' : '';
          }
          const disabled = (ymd > todayStr || ymd < minDateStr) ? ' disabled' : '';
          const disAttr = disabled ? ' disabled aria-disabled="true"' : '';
          html += `<button type="button" class="calendar-day${has}${rangeCls}${active}${disabled}" data-date="${ymd}"${disAttr}><span class="num">${day}</span>${count ? `<span class="count">${count}</span>` : ''}</button>`;
        }
        if (grid) grid.innerHTML = html;
        if (!grid) return;
        grid.querySelectorAll('.calendar-day').forEach(function(btn){
          if (btn.classList.contains('disabled')) return;
          btn.onclick = function(){
            const ymd = String(btn.getAttribute('data-date') || '').trim();
            if (!ymd) return;
            DATE_FILTER_ENABLED = true;
            if (DATE_MODE === 'range'){
              if (!DATE_RANGE.from || (DATE_RANGE.from && DATE_RANGE.to)){
                DATE_RANGE = { from: ymd, to: null };
                renderHistoryCalendar(year, month);
                return;
              }
              if (ymd < DATE_RANGE.from) DATE_RANGE = { from: ymd, to: DATE_RANGE.from };
              else DATE_RANGE.to = ymd;
              closeHistoryCalendar();
              renderVisibleItems(LAST_USER_ID);
              return;
            }
            SELECTED_DATE_STR = ymd;
            closeHistoryCalendar();
            renderVisibleItems(LAST_USER_ID);
          };
        });
      }

      function openHistoryCalendar(){
        try{
          if (HISTORY_CAL.el && document.body && !document.body.contains(HISTORY_CAL.el)) {
            HISTORY_CAL.el = null;
          }
        }catch(_){}
        const minDateStr = getHistoryMinDateStr();
        const baseDate = SELECTED_DATE_STR || (DATE_RANGE && DATE_RANGE.from) || minDateStr || getTodayDateStr();
        const parts = String(baseDate || getTodayDateStr()).split('-').map(Number);
        HISTORY_CAL.year = parts[0] || (new Date()).getFullYear();
        HISTORY_CAL.month = (parts[1] || 1) - 1;
        if (!HISTORY_CAL.el){
          const overlay = document.createElement('div');
          overlay.className = 'calendar-popover';
          overlay.dataset.calendarOwner = CALENDAR_OWNER;
          overlay.addEventListener('click', function(e){
            if (e.target === overlay) closeHistoryCalendar();
          });
          const panel = document.createElement('div');
          panel.className = 'calendar-panel';
          panel.innerHTML = `
            <div class="calendar-header">
              <button type="button" class="cal-nav" id="historyCalPrev">&#x2039;</button>
              <div class="cal-title" id="historyCalTitle"></div>
              <button type="button" class="cal-nav" id="historyCalNext">&#x203A;</button>
            </div>
            <div class="calendar-sub">
              <div class="calendar-mode">
                <button type="button" class="calendar-mode-btn" id="historyCalModeSingle">${historyT("history.date.single", "يوم واحد", "Single day", "Un jour")}</button>
                <button type="button" class="calendar-mode-btn" id="historyCalModeRange">${historyT("history.date.range", "نطاق", "Range", "Plage")}</button>
                <button type="button" class="calendar-mode-btn" id="historyCalClear">${historyT("history.date.clear", "الكل", "All", "Tout")}</button>
              </div>
              <div class="calendar-selection" id="historyCalSelectionText"></div>
            </div>
            <div class="calendar-grid" id="historyCalGrid"></div>
          `;
          overlay.appendChild(panel);
          document.body.appendChild(overlay);
          HISTORY_CAL.el = overlay;
          panel.querySelector('#historyCalPrev').onclick = function(){ shiftHistoryCalendar(-1); };
          panel.querySelector('#historyCalNext').onclick = function(){ shiftHistoryCalendar(1); };
          panel.querySelector('#historyCalModeSingle').onclick = function(){
            DATE_MODE = 'single';
            if (!SELECTED_DATE_STR) SELECTED_DATE_STR = (DATE_RANGE && DATE_RANGE.from) || getTodayDateStr();
            renderHistoryCalendar(HISTORY_CAL.year, HISTORY_CAL.month);
          };
          panel.querySelector('#historyCalModeRange').onclick = function(){
            DATE_MODE = 'range';
            if (!DATE_RANGE.from) DATE_RANGE.from = SELECTED_DATE_STR || getTodayDateStr();
            renderHistoryCalendar(HISTORY_CAL.year, HISTORY_CAL.month);
          };
          panel.querySelector('#historyCalClear').onclick = function(){
            resetDateFilter();
            closeHistoryCalendar();
            renderVisibleItems(LAST_USER_ID);
          };
        }
        renderHistoryCalendar(HISTORY_CAL.year, HISTORY_CAL.month);
      }

      function buildWin1256Map(){
        try{
          if (typeof TextDecoder === 'undefined') return null;
          var dec = new TextDecoder('windows-1256');
          var bytes = new Uint8Array(256);
          for (var i = 0; i < 256; i++) bytes[i] = i;
          var decoded = dec.decode(bytes);
          var map = {};
          for (var j = 0; j < decoded.length; j++){
            var ch = decoded.charAt(j);
            if (map[ch] === undefined) map[ch] = j;
          }
          return map;
        }catch(_){ return null; }
      }

      var fixWalletText = (function(){
        var map = buildWin1256Map();
        var utf8Dec = null;
        try { utf8Dec = new TextDecoder('utf-8'); } catch(_){ }
        function countArabic(str){
          var m = str && str.match(/[ط،-ظٹ]/g);
          return m ? m.length : 0;
        }
        function countLatin1(str){
          var m = str && str.match(/[\u00A0-\u00FF]/g);
          return m ? m.length : 0;
        }
        function decodeBroken(str){
          if (!map || !utf8Dec) return str;
          var bytes = new Uint8Array(str.length);
          for (var i = 0; i < str.length; i++){
            var b = map[str.charAt(i)];
            if (b == null) return str;
            bytes[i] = b;
          }
          return utf8Dec.decode(bytes);
        }
        return function(str){
          if (!str || typeof str !== 'string') return str;
          if (!/[\u00A0-\u00FF]/.test(str)) return str;
          var fixed = decodeBroken(str);
          if (!fixed || fixed === str) return str;
          if (countArabic(fixed) >= countArabic(str) && countLatin1(fixed) <= countLatin1(str)) return fixed;
          return str;
        };
      })();

      function fixWalletTextNodes(root){
        if (!root || typeof document === 'undefined' || !document.createTreeWalker) return;
        try{
          var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
          var node;
          while ((node = walker.nextNode())){
            node.nodeValue = fixWalletText(node.nodeValue);
          }
        }catch(_){ }
      }

      function normalizeLedgerText(value){
        return fixWalletText((value == null ? '' : value).toString()).replace(/\s+/g, ' ').trim();
      }

      function isAdminLedgerText(value){
        var txt = normalizeLedgerText(value);
        if (!txt) return false;
        return /إدارة\s*التلغرام|من\s*الإدارة|زيادة\s*رصيد|خصم\s*رصيد/.test(txt);
      }

      function isRefundLedgerText(value){
        var txt = normalizeLedgerText(value);
        if (!txt) return false;
        return /استرداد|إرجاع\s*بعد|ارجاع\s*بعد|عكس\s*(?:إيداع|ايداع|خصم|سحب|شراء)|رد\s*رصيد/.test(txt);
      }

      function isPurchaseLedgerText(value){
        var txt = normalizeLedgerText(value);
        if (!txt) return false;
        return /شراء|طلب\s*شراء/.test(txt);
      }

      function stripLedgerActionPrefix(value){
        var txt = normalizeLedgerText(value);
        if (!txt) return '';
        return txt.replace(/^(?:شراء|استرداد|إرجاع|ارجاع|رد\s*رصيد)\s*[-:طŒ]?\s*/i, '').trim();
      }

      function stripPurchaseLedgerPrefix(value){
        var txt = normalizeLedgerText(value);
        if (!txt) return '';
        return txt.replace(/^(?:شراء|طلب\s*شراء)\s*[-:•ـ]?\s*/i, '').trim();
      }

      function resolvePurchaseLedgerTitle(value, fallback){
        var base = stripPurchaseLedgerPrefix(value);
        if (base) return 'شراء: ' + base;
        var fallbackText = stripPurchaseLedgerPrefix(fallback) || normalizeLedgerText(fallback);
        if (!fallbackText) return 'شراء';
        return /^شراء/.test(fallbackText) ? fallbackText : ('شراء: ' + fallbackText);
      }

      function stripRefundAdminSuffix(value){
        var txt = stripLedgerActionPrefix(value);
        if (!txt) return '';
        return txt.replace(/\s+من\s+(?:لوحة\s+الإدارة|الإدارة)\s*$/i, '').trim();
      }

      function resolveRefundTitle(value, fallback){
        var base = stripRefundAdminSuffix(value);
        if (base) return 'استرداد - ' + base;
        var fallbackText = stripRefundAdminSuffix(fallback) || fixWalletText((fallback == null ? '' : fallback).toString()).trim();
        return fallbackText || 'استرداد';
      }

      function normalizeLedgerComparableText(value){
        return normalizeLedgerText(value).replace(/[•:ـ\-–—]+/g, ' ').replace(/\s+/g, ' ').trim();
      }

      function labelsLikelyDuplicate(left, right){
        var a = normalizeLedgerComparableText(left);
        var b = normalizeLedgerComparableText(right);
        if (!a || !b) return false;
        if (a === b) return true;
        var aPurchase = normalizeLedgerComparableText(stripPurchaseLedgerPrefix(a));
        var bPurchase = normalizeLedgerComparableText(stripPurchaseLedgerPrefix(b));
        if (aPurchase && bPurchase && aPurchase === bPurchase) return true;
        var aAction = normalizeLedgerComparableText(stripLedgerActionPrefix(a));
        var bAction = normalizeLedgerComparableText(stripLedgerActionPrefix(b));
        if (aAction && bAction && aAction === bAction) return true;
        return a.indexOf(b) >= 0 || b.indexOf(a) >= 0;
      }

      function statusLabelForWalletAction(status){
        var normalized = normStatus(status);
        if (normalized === 'rejected') return 'مرفوضة';
        if (normalized === 'approved') return 'مكتملة';
        return 'قيد المعالجة';
      }

      function isAdminLedgerAction(item){
        if (!item || typeof item !== 'object') return false;
        return isAdminLedgerText(item.methodName || item.method || '') ||
          isAdminLedgerText(
            item.description ||
            item.serviceName ||
            item.productName ||
            item.offerName ||
            item.offer ||
            item.title ||
            ''
          );
      }

      function isRefundLedgerEntry(item){
        if (!item || typeof item !== 'object') return false;
        var entryType = String(item.entryType || item.entry_type || item.reason || '').trim().toLowerCase();
        if (item.refund === true || item.isRefund === true || entryType === 'refund') return true;
        return isRefundLedgerText(item.methodName || item.method || '') ||
          isRefundLedgerText(
            item.description ||
            item.serviceName ||
            item.productName ||
            item.offerName ||
            item.offer ||
            item.title ||
            ''
          );
      }

      function getKind(item){
        if (!item) return 'deposit';
        if (item.__kind) return item.__kind;
        var code = getCode(item);
        if (typeof code === 'string' && code.toUpperCase().indexOf('WDR') === 0) return 'withdraw';
        return 'deposit';
      }

      function resolveDisplayKind(item){
        var kind = ensureKind(item, 'deposit');
        if (PAGE_MODE === 'payments') return kind;
        var balanceBefore = pickNumber(item, ['balanceBefore', 'balanceBeforeStr']);
        var balanceAfter = pickNumber(item, ['balanceAfter', 'balanceAfterStr']);
        if (balanceBefore != null && balanceAfter != null) {
          if (balanceAfter < balanceBefore) return 'withdraw';
          if (balanceAfter > balanceBefore) return 'deposit';
        }
        var debit = pickNumber(item, ['debited', 'debitedUSD', 'amountUSD', 'debitedJOD', 'amountJOD']);
        if (debit != null && Math.abs(Number(debit) || 0) > 0) return 'withdraw';
        var credit = pickNumber(item, ['added', 'addedAmount', 'addedUSD', 'client_payAmount', 'amountCurrency']);
        if (credit != null && Math.abs(Number(credit) || 0) > 0) return Number(credit) < 0 ? 'withdraw' : 'deposit';
        return kind === 'withdraw' ? 'withdraw' : 'deposit';
      }

      function ensureKind(item, fallback){
        var kind = getKind(item);
        if (item && !item.__kind) item.__kind = kind || fallback || 'deposit';
        return item && item.__kind ? item.__kind : (fallback || 'deposit');
      }

      function resolveChange(item, kindOverride){
        var kind = kindOverride || getKind(item);
        var amount = null;
        if (kind === 'withdraw'){
          amount = pickNumber(item, ['debited', 'debitedUSD', 'amountUSD', 'debitedJOD', 'amountJOD']);
          if (amount == null) amount = pickNumber(item, ['amountCurrency']);
        } else {
          amount = pickNumber(item, ['added', 'addedAmount', 'addedUSD', 'amountUSD']);
          if (amount == null) amount = pickNumber(item, ['client_payAmount', 'amountCurrency']);
        }
        if (amount == null) amount = pickNumber(item, ['amount', 'amountCurrency', 'added', 'addedAmount', 'addedUSD', 'debited', 'debitedUSD']);
        if (amount == null) amount = 0;
        var currency = 'USD';
        var digits = digitsForCurrency(currency);
        var absVal = Math.abs(amount);
        var roundedAbs = roundForDisplay(absVal, digits);
        var signSymbol = roundedAbs === 0 ? '' : (kind === 'withdraw' ? '-' : '+');
        return {
          signSymbol: signSymbol,
          numberText: formatNumber(absVal, digits),
          currency: currency || '',
          className: signSymbol === '+' ? 'positive' : (signSymbol === '-' ? 'negative' : 'neutral')
        };
      }

      function resolveDepositPaid(item){
        var amount = pickNumber(item, ['client_payAmount', 'amountCurrency', 'payAmount']);
        if (amount == null) return '';
        var currency = 'USD';
        return formatNumber(amount, digitsForCurrency(currency)) + (currency ? ' ' + currency : '');
      }

      function resolveDepositAdded(item){
        var amount = pickNumber(item, ['added', 'addedAmount', 'addedUSD', 'amountUSD']);
        if (amount == null) return '';
        var currency = 'USD';
        return formatNumber(amount, digitsForCurrency(currency)) + (currency ? ' ' + currency : '');
      }

      function resolveWithdrawPayout(item){
        var amount = pickNumber(item, ['amountCurrency']);
        if (amount == null) return '';
        var currency = 'USD';
        return formatNumber(amount, digitsForCurrency(currency)) + (currency ? ' ' + currency : '');
      }

      function resolveBalances(item){
        return {
          after: pickNumber(item, ['balanceAfter', 'balanceAfterStr']),
          before: pickNumber(item, ['balanceBefore', 'balanceBeforeStr'])
        };
      }

      function isGenericTransferPeer(value){
        var txt = fixWalletText((value == null ? '' : value).toString()).trim();
        if (!txt) return true;
        return txt === 'مستلم' || txt === 'مرسل' || txt === 'مستخدم' || txt === '-' || txt === 'â€”';
      }

      function resolveTransferPeer(item){
        if (!item || typeof item !== 'object') return '';
        var keys = [
          'transferPeer', 'transferPeerUid',
          'peerWebuid', 'receiverWebuid', 'recipientWebuid', 'targetWebuid',
          'peerUid', 'receiverUid', 'recipientUid', 'targetUid'
        ];
        for (var i = 0; i < keys.length; i++){
          var key = keys[i];
          var raw = item[key];
          var txt = fixWalletText((raw == null ? '' : raw).toString()).trim();
          if (!isGenericTransferPeer(txt)) return txt;
        }
        return '';
      }

      function resolveWalletOperationMeta(item, cardTitle){
        var data = item && typeof item === 'object' ? item : {};
        var kind = resolveDisplayKind(data);
        var code = String(getCode(data) || '').trim();
        var status = normStatus((data && (data.status || data.state || data.depositStatus)) || '');
        var relatedCode = normalizeLedgerText(data.relatedCode || data.related_code || data.orderCode || data.orderId || '');
        var countryName = normalizeLedgerText(data.countryName || data.country || data.countryLabel || '');
        var methodName = normalizeLedgerText(data.methodName || data.method || data.paymentMethodName || data.methodLabel || '');
        var description = normalizeLedgerText(data.description || '');
        var titleHint = normalizeLedgerText(
          cardTitle ||
          data.title ||
          data.serviceName ||
          data.productName ||
          data.offerName ||
          data.offer ||
          data.name ||
          ''
        );
        var purchaseSeed = normalizeLedgerText(
          data.serviceName ||
          data.productName ||
          data.offerName ||
          data.offer ||
          data.description ||
          data.itemName ||
          data.gameName ||
          data.game ||
          data.title ||
          data.name ||
          ''
        );
        var payoutTarget = normalizeLedgerText(data.payoutTarget || data.receiverTarget || data.recipientTarget || '');
        var payoutName = normalizeLedgerText(data.payoutName || data.receiverName || data.recipientName || '');
        var transferPeer = resolveTransferPeer(data);
        var entryType = normalizeLedgerText(data.entryType || data.entry_type || data.reason).toLowerCase();
        var textBag = [methodName, description, titleHint, purchaseSeed, countryName].filter(Boolean).join(' ');
        var isRefundReversal = entryType === 'refund_reversal' || /عكس\s*استرداد/.test(textBag);
        var isRefund = !isRefundReversal && isRefundLedgerEntry(data);
        var isAdmin = isAdminLedgerAction(data) || isAdminLedgerText(textBag);
        var hasPayout = !!(payoutTarget || payoutName) || /طلب\s*سحب|سحب\s*عبر/.test(textBag);
        var isTransfer = !!transferPeer || (/تحويل/.test(textBag) && !isRefund && !isAdmin);
        var isPurchase = kind === 'withdraw' &&
          !isRefund &&
          !isRefundReversal &&
          !isAdmin &&
          !hasPayout &&
          (
            entryType === 'purchase' ||
            /^ORD/i.test(code) ||
            isPurchaseLedgerText(purchaseSeed) ||
            isPurchaseLedgerText(titleHint) ||
            isPurchaseLedgerText(description)
          );
        var key = kind === 'withdraw' ? 'withdraw_request' : 'deposit_request';
        var label = kind === 'withdraw' ? 'سحب' : 'إيداع';
        var kicker = kind === 'withdraw' ? 'تفاصيل طلب السحب' : 'تفاصيل طلب الإيداع';
        var statusText = statusLabel(status);
        var basicSectionTitle = 'بيانات الطلب';
        var codeLabel = 'رمز الطلب';
        var emptyText = 'لا توجد تفاصيل إضافية متاحة لهذا الطلب.';

        if (isRefundReversal) {
          key = 'refund_reversal';
          label = 'عكس الاسترداد';
          kicker = 'تفاصيل عكس الاسترداد';
          statusText = statusLabelForWalletAction(status);
          basicSectionTitle = 'بيانات العملية';
          codeLabel = 'رمز العملية';
          emptyText = 'لا توجد تفاصيل إضافية متاحة لهذه العملية.';
        } else if (isRefund) {
          key = 'refund';
          label = 'استرداد';
          kicker = 'تفاصيل الاسترداد';
          statusText = statusLabelForWalletAction(status);
          basicSectionTitle = 'بيانات العملية';
          codeLabel = 'رمز العملية';
          emptyText = 'لا توجد تفاصيل إضافية متاحة لهذه العملية.';
        } else if (isPurchase) {
          key = 'purchase';
          label = 'شراء';
          kicker = 'تفاصيل عملية الشراء';
          statusText = statusLabelForWalletAction(status);
          basicSectionTitle = 'بيانات العملية';
          codeLabel = 'رمز العملية';
          emptyText = 'لا توجد تفاصيل إضافية متاحة لهذه العملية.';
        } else if (isAdmin) {
          key = kind === 'withdraw' ? 'admin_debit' : 'admin_credit';
          label = kind === 'withdraw' ? 'خصم إداري' : 'إضافة إدارية';
          kicker = 'تفاصيل تعديل الرصيد';
          statusText = statusLabelForWalletAction(status);
          basicSectionTitle = 'بيانات العملية';
          codeLabel = 'رمز العملية';
          emptyText = 'لا توجد تفاصيل إضافية متاحة لهذه العملية.';
        } else if (isTransfer) {
          key = kind === 'withdraw' ? 'transfer_out' : 'transfer_in';
          label = kind === 'withdraw' ? 'تحويل صادر' : 'تحويل وارد';
          kicker = 'تفاصيل التحويل';
          statusText = statusLabelForWalletAction(status);
          basicSectionTitle = 'بيانات العملية';
          codeLabel = 'رمز العملية';
          emptyText = 'لا توجد تفاصيل إضافية متاحة لهذه العملية.';
        }

        var showCountry = !!countryName && !(countryName === 'تحويل داخلي' && !isTransfer);
        var showMethod = !!methodName;
        if (key === 'refund' && (!methodName || /^(استرداد|إرجاع|ارجاع)$/.test(methodName) || labelsLikelyDuplicate(methodName, titleHint))) {
          showMethod = false;
        }
        if (key === 'refund_reversal' && (!methodName || /^(عكس\s*استرداد)$/.test(methodName) || labelsLikelyDuplicate(methodName, titleHint))) {
          showMethod = false;
        }
        if (key === 'purchase' && (!methodName || labelsLikelyDuplicate(methodName, titleHint) || labelsLikelyDuplicate(methodName, purchaseSeed))) {
          showMethod = false;
        }
        if ((key === 'admin_credit' || key === 'admin_debit') && (!methodName || isAdminLedgerText(methodName))) {
          methodName = 'الإدارة';
          showMethod = true;
        }

        return {
          key: key,
          kind: kind,
          code: code,
          relatedCode: relatedCode,
          label: label,
          kicker: kicker,
          status: status,
          statusText: statusText,
          basicSectionTitle: basicSectionTitle,
          codeLabel: codeLabel,
          emptyText: emptyText,
          showCountry: showCountry,
          showMethod: showMethod,
          countryName: showCountry ? countryName : '',
          methodName: showMethod ? methodName : '',
          isRefund: isRefund,
          isPurchase: isPurchase,
          isAdmin: isAdmin,
          isTransfer: isTransfer,
          hasPayout: hasPayout,
          transferPeer: transferPeer,
          payoutTarget: payoutTarget,
          payoutName: payoutName
        };
      }

      function buildMetaParts(item, kind){
        var parts = [];
        var country = fixWalletText(item.countryName || item.country || item.countryLabel || '');
        var method = fixWalletText(item.methodName || item.method || item.paymentMethodName || item.methodLabel || '');
        var transferPeer = resolveTransferPeer(item);
        var transferNote = fixWalletText(item.transferNote || '');
        if (country){
          parts.push('<span><i class="fas fa-location-dot"></i> ' + country + '</span>');
        }
        if (method && PAGE_MODE !== 'payments'){
          parts.push('<span><i class="fas fa-building-columns"></i> ' + method + '</span>');
        }
        if (PAGE_MODE !== 'payments'){
          if (kind === 'deposit'){
            var paidText = resolveDepositPaid(item);
            var addedText = resolveDepositAdded(item);
            if (paidText) parts.push('<span><i class="fas fa-money-bill-wave"></i> ' + paidText + '</span>');
            if (addedText && addedText !== paidText) parts.push('<span><i class="fas fa-circle-plus"></i> ' + addedText + '</span>');
          } else {
            var payout = resolveWithdrawPayout(item);
            if (payout) parts.push('<span><i class="fas fa-wallet"></i> ' + payout + '</span>');
            var payoutName = fixWalletText(item.payoutName || item.receiverName || '');
            if (payoutName && payoutName !== payout) parts.push('<span><i class="fas fa-user"></i> ' + payoutName + '</span>');
          }
        }
        if (transferPeer){
          parts.push('<span><i class="fas fa-right-left"></i> ' + transferPeer + '</span>');
        }
        if (transferNote){
          parts.push('<span><i class="fas fa-note-sticky"></i> ' + transferNote + '</span>');
        }
        return parts.join('');
      }

      function normalizeTransactionDetailText(value){
        return fixWalletText((value == null ? '' : value).toString()).trim();
      }

      function formatTransactionDetailAmount(value, currency){
        var num = parseNumeric(value);
        if (num == null || !isFinite(num)) return '';
        var cur = normalizeTransactionDetailText(currency || '') || 'USD';
        return formatNumber(num, digitsForCurrency(cur)) + (cur ? ' ' + cur : '');
      }

      function formatTransactionRateText(rate, currency){
        var num = parseNumeric(rate);
        var cur = normalizeTransactionDetailText(currency || '');
        if (num == null || !isFinite(num) || num <= 0 || !cur) return '';
        return '1 USD = ' + formatNumber(num, digitsForCurrency(cur)) + ' ' + cur;
      }

      function buildTransactionExtraFieldLabelMap(item){
        var defs = Array.isArray(item && item.extraFieldsDef) ? item.extraFieldsDef : [];
        var map = {};
        defs.forEach(function(entry, idx){
          if (!entry || typeof entry !== 'object') return;
          var key = normalizeTransactionDetailText(entry.key || entry.id || entry.name || ('field_' + (idx + 1)));
          var label = normalizeTransactionDetailText(entry.label || entry.title || entry.name || key);
          if (key && label && !map[key]) map[key] = label;
        });
        return map;
      }

      function stringifyTransactionDetailValue(value){
        if (value == null) return '';
        if (Array.isArray(value)){
          return value.map(function(entry){
            return stringifyTransactionDetailValue(entry);
          }).filter(Boolean).join('طŒ ');
        }
        if (typeof value === 'object'){
          var direct = normalizeTransactionDetailText(
            value.value || value.text || value.label || value.name || value.title || value.id || ''
          );
          if (direct) return direct;
          try {
            return normalizeTransactionDetailText(JSON.stringify(value));
          } catch (_) {
            return '';
          }
        }
        return normalizeTransactionDetailText(value);
      }

      function buildTransactionExtraFieldEntries(item){
        var values = (item && item.extraFieldValues && typeof item.extraFieldValues === 'object' && !Array.isArray(item.extraFieldValues))
          ? item.extraFieldValues
          : {};
        var labelMap = buildTransactionExtraFieldLabelMap(item);
        return Object.keys(values).map(function(key){
          var value = stringifyTransactionDetailValue(values[key]);
          if (!value) return null;
          return {
            key: key,
            label: labelMap[key] || normalizeTransactionDetailText(key),
            value: value
          };
        }).filter(Boolean);
      }

      function normalizeTransactionDetailLookupKey(value){
        return normalizeTransactionDetailText(value).toLowerCase().replace(/[\s._-]+/g, '');
      }

      function scoreTransactionDetailTargetEntry(entry){
        var key = normalizeTransactionDetailLookupKey(entry && entry.key);
        var label = normalizeTransactionDetailText(entry && entry.label);
        var score = 0;
        if (/^(payouttarget|receivertarget|recipienttarget|wallet|walletnumber|walletid|account|accountnumber|iban|phone|number|target|receiver|recipient|userid|id)$/.test(key)) score += 160;
        if (/(payouttarget|receivertarget|recipienttarget|walletnumber|walletid|accountnumber|iban|phone|number|target|receiver|recipient)/.test(key)) score += 110;
        if (/(رقم|محفظ|حساب|آيبان|ايبان|iban|هاتف|جوال|واتساب|معرف|ايدي|المستلم|المحفظة)/i.test(label)) score += 85;
        if (/(name|fullname|owner|اسم)/i.test(label) || /(name|fullname|owner)/.test(key)) score -= 120;
        return score;
      }

      function scoreTransactionDetailNameEntry(entry){
        var key = normalizeTransactionDetailLookupKey(entry && entry.key);
        var label = normalizeTransactionDetailText(entry && entry.label);
        var score = 0;
        if (/^(payoutname|receivername|recipientname|accountname|ownername|fullname|name)$/.test(key)) score += 180;
        if (/(payoutname|receivername|recipientname|accountname|ownername|fullname|name)/.test(key)) score += 120;
        if (/(اسم|الاسم|اسم المستلم|اسم الحساب|اسم صاحب|الاسم الكامل)/i.test(label)) score += 90;
        if (/(wallet|accountnumber|iban|phone|number|target|رقم|محفظ|حساب|آيبان|ايبان|هاتف|جوال|واتساب|معرف|ايدي)/i.test(label) || /(wallet|accountnumber|iban|phone|number|target)/.test(key)) score -= 120;
        return score;
      }

      function buildTransactionTransferTargetEntries(item){
        var targets = Array.isArray(item && item.transferTargets) ? item.transferTargets : [];
        if (typeof buildInlineTransferDisplayFields === 'function'){
          try {
            return buildInlineTransferDisplayFields(targets).map(function(entry){
              return {
                label: normalizeTransactionDetailText(entry && entry.label),
                value: stringifyTransactionDetailValue(entry && entry.value)
              };
            }).filter(function(entry){
              return entry.label && entry.value;
            });
          } catch (_) {}
        }
        return targets.map(function(entry, idx){
          var value = stringifyTransactionDetailValue(entry);
          if (!value) return null;
          return {
            label: targets.length > 1 ? ('جهة التحويل ' + (idx + 1)) : 'جهة التحويل',
            value: value
          };
        }).filter(Boolean);
      }

      function makeTransactionDetailEntry(label, value, options){
        var text = stringifyTransactionDetailValue(value);
        if (!text) return null;
        var opts = options && typeof options === 'object' ? options : {};
        return {
          label: normalizeTransactionDetailText(label),
          value: text,
          full: !!opts.full,
          html: false
        };
      }

      function makeTransactionDetailAmountEntry(label, value, currency, options){
        var text = formatTransactionDetailAmount(value, currency);
        if (!text) return null;
        var opts = options && typeof options === 'object' ? options : {};
        return {
          label: normalizeTransactionDetailText(label),
          value: text,
          full: !!opts.full,
          html: false
        };
      }

      function makeTransactionDetailHtmlEntry(label, html, options){
        var markup = String(html || '').trim();
        if (!markup) return null;
        var opts = options && typeof options === 'object' ? options : {};
        return {
          label: normalizeTransactionDetailText(label),
          value: markup,
          full: opts.full !== false,
          html: true
        };
      }

      function buildTransactionDetailsModel(item, card){
        var data = Object.assign({}, item || {});
        var kind = resolveDisplayKind(data);
        ensureKind(data, kind);

        var code = getCode(data) || (card && card.dataset ? card.dataset.code : '');
        var status = normStatus((data && (data.status || data.state || data.depositStatus)) || '');
        var cardTitle = normalizeTransactionDetailText(
          card && card.querySelector && card.querySelector('.txn-title')
            ? (card.querySelector('.txn-title').textContent || '')
            : ''
        );
        var operation = resolveWalletOperationMeta(data, cardTitle);
        var title = cardTitle || (kind === 'withdraw' ? 'طلب سحب' : 'طلب إيداع');
        var createdText = formatDate(data.createdAt || data.created_at || data.computedAt || data.timestamp || '');
        var localCurrency = normalizeTransactionDetailText(data.currency || data.currencyCode || data.addedCurrency || '');
        var methodName = operation.methodName || '';
        var countryName = operation.countryName || '';
        var proofUrl = resolveProofUrl(data);
        var kindLabel = operation.label || (kind === 'withdraw' ? 'سحب' : 'إيداع');

        var paidLocalAmount = pickNumber(data, ['client_payAmount', 'amountCurrency', 'payAmount']);
        var netLocalAmount = pickNumber(data, ['netAmountCurrency']);
        var addedUsdAmount = pickNumber(data, ['added', 'addedAmount', 'addedUSD', 'amountUSD']);
        var debitedUsdAmount = pickNumber(data, ['debited', 'debitedUSD', 'amountUSD']);
        var payoutLocalAmount = pickNumber(data, ['payoutAmountCurrency', 'amountCurrency', 'netAmountCurrency']);
        var grossLocalAmount = pickNumber(data, ['grossAmountCurrency']);
        var feeLocalAmount = pickNumber(data, ['feeAmountCurrency']);
        var feeUsdAmount = pickNumber(data, ['feeAmountUSD']);
        var payoutUsdAmount = pickNumber(data, ['payoutAmountUSD']);
        var payoutTargetText = normalizeTransactionDetailText(data.payoutTarget || data.receiverTarget || data.recipientTarget || '');
        var payoutNameText = normalizeTransactionDetailText(data.payoutName || data.receiverName || data.recipientName || '');
        if (payoutTargetText && payoutNameText && payoutTargetText === payoutNameText) {
          payoutNameText = '';
        }

        var summary = [];
        var basic = [];
        var payout = [];
        var transfers = buildTransactionTransferTargetEntries(data).map(function(entry){
          return makeTransactionDetailEntry(entry.label, entry.value);
        }).filter(Boolean);
        var extra = buildTransactionExtraFieldEntries(data).filter(function(entry){
          if (!entry || !entry.value) return false;
          var valueText = normalizeTransactionDetailText(entry.value);
          if (!valueText) return false;
          var entryMeta = {
            key: entry.key || entry.label || '',
            label: entry.label || entry.key || ''
          };
          if (payoutTargetText && valueText === payoutTargetText && scoreTransactionDetailTargetEntry(entryMeta) > 0) return false;
          if (payoutNameText && valueText === payoutNameText && scoreTransactionDetailNameEntry(entryMeta) > 0) return false;
          return true;
        }).map(function(entry){
          return makeTransactionDetailEntry(entry.label, entry.value, { full: String(entry.value || '').length > 52 });
        }).filter(Boolean);

        function addSummary(label, text, tone){
          var value = normalizeTransactionDetailText(text);
          if (!value) return;
          summary.push({
            label: normalizeTransactionDetailText(label),
            value: value,
            tone: normalizeTransactionDetailText(tone || 'default') || 'default'
          });
        }

        function pushEntry(list, entry){
          if (entry) list.push(entry);
        }

        if (operation.key === 'purchase'){
          addSummary('قيمة الشراء', formatTransactionDetailAmount(debitedUsdAmount, 'USD'), 'danger');
        } else if (operation.key === 'refund'){
          addSummary('المبلغ المسترد', formatTransactionDetailAmount(addedUsdAmount, 'USD'), 'success');
        } else if (operation.key === 'refund_reversal'){
          addSummary('المبلغ المعكوس', formatTransactionDetailAmount(debitedUsdAmount, 'USD'), 'danger');
        } else if (operation.key === 'admin_credit'){
          addSummary('الرصيد المضاف', formatTransactionDetailAmount(addedUsdAmount, 'USD'), 'success');
        } else if (operation.key === 'admin_debit'){
          addSummary('الرصيد المخصوم', formatTransactionDetailAmount(debitedUsdAmount, 'USD'), 'danger');
        } else if (operation.key === 'transfer_in'){
          addSummary('المبلغ المحول', formatTransactionDetailAmount(addedUsdAmount, 'USD'), 'success');
        } else if (operation.key === 'transfer_out'){
          addSummary('المبلغ المحول', formatTransactionDetailAmount(debitedUsdAmount, 'USD'), 'danger');
        } else if (kind === 'withdraw'){
          addSummary('المبلغ المخصوم', formatTransactionDetailAmount(debitedUsdAmount, 'USD'), 'danger');
          addSummary('المبلغ المستلم', formatTransactionDetailAmount(payoutLocalAmount, localCurrency || 'USD'), 'success');
          if (feeLocalAmount != null) addSummary('العمولة', formatTransactionDetailAmount(feeLocalAmount, localCurrency || 'USD'), 'warn');
          else if (feeUsdAmount != null) addSummary('العمولة', formatTransactionDetailAmount(feeUsdAmount, 'USD'), 'warn');
        } else {
          addSummary('المبلغ المدفوع', formatTransactionDetailAmount(paidLocalAmount, localCurrency || 'USD'), 'primary');
          addSummary('الرصيد المضاف', formatTransactionDetailAmount(addedUsdAmount, 'USD'), 'success');
          if (netLocalAmount != null && (paidLocalAmount == null || Math.abs(Number(netLocalAmount) - Number(paidLocalAmount)) > 0.0005)) {
            addSummary('بعد العمولة', formatTransactionDetailAmount(netLocalAmount, localCurrency || 'USD'), 'warn');
          }
          if (feeLocalAmount != null) addSummary('العمولة', formatTransactionDetailAmount(feeLocalAmount, localCurrency || 'USD'), 'warn');
        }

        pushEntry(basic, makeTransactionDetailEntry(operation.codeLabel || 'رمز الطلب', code));
        if (operation.relatedCode && operation.relatedCode !== code) {
          pushEntry(basic, makeTransactionDetailEntry('الطلب الأصلي', operation.relatedCode));
        }
        pushEntry(basic, makeTransactionDetailEntry('نوع العملية', kindLabel));
        pushEntry(basic, makeTransactionDetailEntry('الحالة', operation.statusText || statusLabel(status)));
        pushEntry(basic, makeTransactionDetailEntry(operation.basicSectionTitle === 'بيانات الطلب' ? 'تاريخ الطلب' : 'تاريخ العملية', createdText && createdText !== '-' ? createdText : ''));
        if (countryName) pushEntry(basic, makeTransactionDetailEntry('الدولة', countryName));
        if (methodName) pushEntry(basic, makeTransactionDetailEntry('الطريقة', methodName));
        pushEntry(basic, makeTransactionDetailEntry('العملة', localCurrency));
        pushEntry(basic, makeTransactionDetailEntry('سعر الصرف', formatTransactionRateText(data.ratePerUSD, localCurrency)));
        pushEntry(basic, makeTransactionDetailAmountEntry('الرصيد قبل', pickNumber(data, ['balanceBefore', 'balanceBeforeStr']), 'USD'));
        pushEntry(basic, makeTransactionDetailAmountEntry('الرصيد بعد', pickNumber(data, ['balanceAfter', 'balanceAfterStr']), 'USD'));

        if (operation.key === 'purchase'){
          pushEntry(basic, makeTransactionDetailAmountEntry('قيمة الشراء', debitedUsdAmount, 'USD'));
        } else if (operation.key === 'refund'){
          pushEntry(basic, makeTransactionDetailAmountEntry('المبلغ المسترد', addedUsdAmount, 'USD'));
        } else if (operation.key === 'refund_reversal'){
          pushEntry(basic, makeTransactionDetailAmountEntry('المبلغ المعكوس', debitedUsdAmount, 'USD'));
        } else if (operation.key === 'admin_credit'){
          pushEntry(basic, makeTransactionDetailAmountEntry('الرصيد المضاف', addedUsdAmount, 'USD'));
        } else if (operation.key === 'admin_debit'){
          pushEntry(basic, makeTransactionDetailAmountEntry('الرصيد المخصوم', debitedUsdAmount, 'USD'));
        } else if (operation.key === 'transfer_in'){
          pushEntry(basic, makeTransactionDetailAmountEntry('المبلغ المحول', addedUsdAmount, 'USD'));
          pushEntry(payout, makeTransactionDetailEntry('من', operation.transferPeer || payoutNameText || payoutTargetText));
        } else if (operation.key === 'transfer_out'){
          pushEntry(basic, makeTransactionDetailAmountEntry('المبلغ المحول', debitedUsdAmount, 'USD'));
          pushEntry(payout, makeTransactionDetailEntry('إلى', operation.transferPeer || payoutNameText || payoutTargetText));
        } else if (kind === 'withdraw'){
          pushEntry(basic, makeTransactionDetailAmountEntry('المبلغ المخصوم', debitedUsdAmount, 'USD'));
          pushEntry(basic, makeTransactionDetailAmountEntry('المبلغ قبل العمولة', grossLocalAmount, localCurrency || 'USD'));
          pushEntry(basic, makeTransactionDetailAmountEntry('المبلغ المستلم', payoutLocalAmount, localCurrency || 'USD'));
          pushEntry(basic, makeTransactionDetailAmountEntry('العمولة', feeLocalAmount, localCurrency || 'USD'));
          pushEntry(basic, makeTransactionDetailAmountEntry('العمولة بالدولار', feeUsdAmount, 'USD'));
          pushEntry(basic, makeTransactionDetailAmountEntry('المبلغ المتوقع بالدولار', payoutUsdAmount, 'USD'));
          pushEntry(payout, makeTransactionDetailEntry('رقم/معرف المستلم', payoutTargetText));
          pushEntry(payout, makeTransactionDetailEntry('اسم المستلم', payoutNameText));
        } else {
          pushEntry(basic, makeTransactionDetailAmountEntry('المبلغ المدفوع', paidLocalAmount, localCurrency || 'USD'));
          if (netLocalAmount != null && (paidLocalAmount == null || Math.abs(Number(netLocalAmount) - Number(paidLocalAmount)) > 0.0005)) {
            pushEntry(basic, makeTransactionDetailAmountEntry('المبلغ بعد العمولة', netLocalAmount, localCurrency || 'USD'));
          }
          pushEntry(basic, makeTransactionDetailAmountEntry('الرصيد المضاف', addedUsdAmount, 'USD'));
          pushEntry(basic, makeTransactionDetailAmountEntry('العمولة', feeLocalAmount, localCurrency || 'USD'));
          pushEntry(basic, makeTransactionDetailAmountEntry('العمولة بالدولار', feeUsdAmount, 'USD'));
        }

        if (proofUrl){
          pushEntry(
            basic,
            makeTransactionDetailHtmlEntry(
              'صورة الإثبات',
              '<a class="wallet-history-modal-link" href="' + escapeHtmlAttr(proofUrl) + '" target="_blank" rel="noopener noreferrer">فتح الصورة</a>'
            )
          );
        }

        var subtitleParts = [];
        if (code) subtitleParts.push(code);
        if (createdText && createdText !== '-') subtitleParts.push(createdText);

        return {
          title: title,
          kicker: operation.kicker || (kind === 'withdraw' ? 'تفاصيل طلب السحب' : 'تفاصيل طلب الإيداع'),
          subtitle: subtitleParts.join(' • '),
          kindLabel: kindLabel,
          status: status,
          statusLabel: operation.statusText || statusLabel(status),
          basicSectionTitle: operation.basicSectionTitle || 'بيانات الطلب',
          emptyText: operation.emptyText || 'لا توجد تفاصيل إضافية متاحة لهذه العملية.',
          summary: summary,
          basic: basic,
          payout: payout,
          transfers: transfers,
          extra: extra
        };
      }

      function renderTransactionSummaryCards(cards){
        return (Array.isArray(cards) ? cards : []).map(function(entry){
          if (!entry || !entry.label || !entry.value) return '';
          return [
            '<div class="wallet-history-modal-summaryCard" data-tone="', escapeHtmlAttr(entry.tone || 'default'), '">',
              '<span>', escapeHtml(entry.label), '</span>',
              '<strong>', escapeHtml(entry.value), '</strong>',
            '</div>'
          ].join('');
        }).join('');
      }

      function renderTransactionDetailEntry(entry){
        if (!entry || !entry.label || !entry.value) return '';
        var valueHtml = entry.html
          ? String(entry.value || '')
          : escapeHtml(String(entry.value || '')).replace(/\n/g, '<br>');
        return [
          '<div class="wallet-history-modal-item', entry.full ? ' full' : '', '">',
            '<span>', escapeHtml(entry.label), '</span>',
            '<strong>', valueHtml, '</strong>',
          '</div>'
        ].join('');
      }

      function renderTransactionDetailSection(title, entries){
        var list = Array.isArray(entries) ? entries.filter(Boolean) : [];
        if (!list.length) return '';
        return [
          '<section class="wallet-history-modal-section">',
            '<h4>', escapeHtml(title), '</h4>',
            '<div class="wallet-history-modal-grid">',
              list.map(renderTransactionDetailEntry).join(''),
            '</div>',
          '</section>'
        ].join('');
      }

      function buildTransactionActionIcon(actionKind){
        var glyph = '-';
        if (actionKind === 'withdraw') glyph = '↑';
        else if (actionKind === 'deposit') glyph = '↓';
        else if (actionKind === 'approved') glyph = '✓';
        else if (actionKind === 'rejected') glyph = '×';
        else if (actionKind === 'pending') glyph = '…';
        return '<span class="txn-action-glyph" aria-hidden="true">' + glyph + '</span>';
      }

      function buildTransactionHTML(item){
        var data = Object.assign({}, item);
        var kind = resolveDisplayKind(data);
        ensureKind(data, kind);
        var code = getCode(data) || '';
        var change = resolveChange(data, kind);
        var balances = resolveBalances(data);
        var method = fixWalletText(data.methodName || data.method || data.paymentMethodName || data.methodLabel || '');
        var transferPeer = resolveTransferPeer(data);
        var titleHint = fixWalletText(data.title || data.serviceName || data.productName || data.name || '');
        var purchaseName = fixWalletText(
          data.serviceName ||
          data.productName ||
          data.offerName ||
          data.offer ||
          data.description ||
          data.itemName ||
          data.gameName ||
          data.game ||
          ''
        );
        var fallbackRefundTitle = data.relatedCode
          ? ('استرداد الطلب ' + String(data.relatedCode || '').trim())
          : (code ? ('استرداد الطلب ' + String(code || '').trim()) : 'استرداد');
        var orderLikeCode = /^ORD/i.test(String(code || '').trim());
        var hasPurchaseSignal = !!(purchaseName || orderLikeCode || data.orderCode || data.orderId || data.offers || data.offersText);
        var isTransfer = !!(transferPeer || data.transferPeer || data.transferNote) ||
          (typeof method === 'string' && method.indexOf('تحويل') >= 0) ||
          (typeof data.countryName === 'string' && data.countryName.indexOf('تحويل') >= 0);
        var isAdminAction = isAdminLedgerAction(data) || isAdminLedgerText(method) || isAdminLedgerText(purchaseName) || isAdminLedgerText(titleHint);
        var isRefundAction = kind !== 'withdraw' && isRefundLedgerEntry(data);
        var isPurchase = !isAdminAction && !isRefundAction && (!!titleHint || hasPurchaseSignal);
        var titleBase = PAGE_MODE === 'payments'
          ? (kind === 'withdraw' ? 'طلب سحب' : 'طلب إيداع')
          : (kind === 'withdraw' ? 'سحب' : 'إيداع');
        var transferTitle = '';
        if (isTransfer && transferPeer){
          transferTitle = kind === 'withdraw'
            ? ('تحويل إلى ' + transferPeer)
            : ('تحويل من ' + transferPeer);
        }
        var title = titleBase;
        var ts = data.createdAt || data.created_at || data.computedAt || data.timestamp || '';
        var shortDate = formatShortDate(ts);
        var longDate = formatDate(ts);
        var status = normStatus((data && (data.status || data.state || data.depositStatus)) || '');
        var isDepositWalletCredit = PAGE_MODE !== 'payments' && kind === 'deposit' && (
          /^(DEP|AUT)/i.test(String(code || '').trim()) ||
          /إيداع|طلب\s*إيداع|إضافة\s*رصيد\s*من\s*الإيداع/i.test([method, titleHint, purchaseName, String(data.description || '')].join(' '))
        );
        if (PAGE_MODE === 'payments'){
          if (method && method !== 'طلب إيداع' && method !== 'طلب سحب'){
            title = titleBase + ' / ' + method;
          }
        } else {
          if (isRefundAction){
            title = resolveRefundTitle(purchaseName || titleHint || method, fallbackRefundTitle);
          } else if (isDepositWalletCredit){
            title = method || titleHint || 'إضافة رصيد من الإيداع';
          } else if (titleHint){
            title = titleHint;
          } else if (isTransfer && transferTitle){
            title = transferTitle;
          } else if (isPurchase && purchaseName){
            title = 'شراء - ' + purchaseName;
          } else if (isAdminAction && purchaseName){
            title = purchaseName;
          }
        }
        title = fixWalletText(title);
        var isRejectedDeposit = (kind === 'deposit' && status === 'rejected');
        if (isRejectedDeposit){
          change.className = 'neutral';
          change.signSymbol = '';
        }
        if (PAGE_MODE === 'payments' && status === 'pending'){
          change.className = 'neutral';
          change.signSymbol = '';
        }
        var actionKind = isRejectedDeposit ? 'neutral' : (kind === 'withdraw' ? 'withdraw' : 'deposit');
        if (PAGE_MODE === 'payments'){
          if (status === 'approved'){
            actionKind = 'approved';
          } else if (status === 'rejected'){
            actionKind = 'rejected';
          } else {
            actionKind = 'pending';
          }
        }
        var actionIconHtml = buildTransactionActionIcon(actionKind);
        var codeLabel = code && code !== '-' ? code : '';
        var showCode = false;
        var codePrefix = isTransfer ? 'ID:' : (kind === 'withdraw' ? 'ID:' : 'Payment ID:');

        var balancePieces = [];
        var balanceCurrency = 'USD';
        if (balances.after != null) {
          balancePieces.push('<span class="balance-after">' + formatBalanceValue(balances.after, balanceCurrency) + '</span>');
        }
        if (balances.before != null) {
          balancePieces.push('<span class="balance-before">' + formatBalanceValue(balances.before, balanceCurrency) + '</span>');
        }
        var balancesHtml = balancePieces.length ? '<div class="txn-balances">' + balancePieces.join('') + '</div>' : '';

        var proofUrl = resolveProofUrl(data);
        var proofHtml = proofUrl
          ? '<span class="txn-proof"><a class="code-btn" href="' + escapeHtmlAttr(proofUrl) + '" target="_blank" rel="noopener noreferrer">فتح الصورة</a></span>'
          : '';
        var codeHtml = showCode ? '<span class="txn-code">' + codePrefix + ' <button class="code-btn" data-code="' + codeLabel + '">' + codeLabel + '</button></span>' : '';
        var dateHtml = shortDate ? '<span class="txn-date" title="' + longDate + '">' + shortDate + '</span>' : '';
        var statusHtml = (PAGE_MODE === 'payments' && status !== 'pending')
          ? '<span class="' + statusClass(status) + '">' + statusLabel(status) + '</span>'
          : '';
        var headerHtml = '<div class="txn-head"><div class="txn-title">' + title + '</div>' + statusHtml + '</div>';
        var detailsRow = '';
        var metaRow = (proofHtml || codeHtml || dateHtml) ? '<div class="txn-meta">' + [dateHtml, proofHtml, codeHtml].filter(Boolean).join('') + '</div>' : '';

        return [
          '<div class="txn-body">',
            '<div class="txn-amount ', change.className, '">',
              '<div class="txn-value">',
                '<span class="sign">', change.signSymbol, '</span>',
                '<span class="number">', change.numberText, '</span>',
                change.currency ? '<span class="currency">' + change.currency + '</span>' : '',
              '</div>',
              balancesHtml,
            '</div>',
            '<div class="txn-middle">',
              headerHtml,
              detailsRow,
              metaRow,
            '</div>',
            '<div class="txn-action ', actionKind, '">',
              '<span class="txn-action-symbol" aria-hidden="true">', actionIconHtml, '</span>',
            '</div>',
          '</div>'
        ].join('');
      }

      function populateTransactionCard(card, item){
        if (!card || !item) return;
        var copy = Object.assign({}, item);
        var kind = resolveDisplayKind(copy);
        ensureKind(copy, kind);
        var code = getCode(copy) || '-';
        var itemKey = getItemCacheKey(copy) || code;
        if (itemKey) copy.__cacheKey = itemKey;
        card.dataset.code = code;
        card.dataset.itemKey = itemKey || '';
        card.dataset.kind = kind;
        card.dataset.openable = code && code !== '-' ? '1' : '0';
        card.setAttribute('tabindex', code && code !== '-' ? '0' : '-1');
        card.setAttribute('role', code && code !== '-' ? 'button' : 'article');
        if (code && code !== '-') card.setAttribute('aria-haspopup', 'dialog');
        else card.removeAttribute('aria-haspopup');
        card.setAttribute('aria-label', code && code !== '-' ? ('عرض تفاصيل الطلب ' + code) : 'طلب مالي');
        card.innerHTML = buildTransactionHTML(copy);
      }

      function renderDeposits(items){
        listEl.innerHTML = '';
        if (!items.length) { showEmpty(); return; }
        items.forEach(function(it){
          var card = document.createElement('div');
          card.className = 'card';
          populateTransactionCard(card, it);
          listEl.appendChild(card);
        });
      }

      function readCache(uid){
        try{
          const parsed = HISTORY_MEMORY[CACHE_PREFIX + uid];
          if (!parsed || typeof parsed !== 'object') return { version:CACHE_SCHEMA_VERSION, order:[], byCode:{}, lastSync:0 };
          if (Number(parsed.version || 0) !== CACHE_SCHEMA_VERSION) {
            return { version:CACHE_SCHEMA_VERSION, order:[], byCode:{}, lastSync:0 };
          }
          parsed.order = Array.isArray(parsed.order) ? parsed.order : [];
          parsed.byCode = (parsed.byCode && typeof parsed.byCode === 'object') ? parsed.byCode : {};
          parsed.version = CACHE_SCHEMA_VERSION;
          return parsed;
        }catch(_){ return { version:CACHE_SCHEMA_VERSION, order:[], byCode:{}, lastSync:0 }; }
      }
      function saveCache(uid, obj){
        try{ HISTORY_MEMORY[CACHE_PREFIX + uid] = obj || {}; }catch(_){ }
      }
      function replaceCache(uid, arr){
        const sorted = sortByNewest(arr);
        const c = { version:CACHE_SCHEMA_VERSION, order:[], byCode:{}, lastSync: Date.now() };
        sorted.forEach(function(it){
          const item = Object.assign({}, it);
          const itemKey = getItemCacheKey(item);
          if (!itemKey) return;
          item.__cacheKey = itemKey;
          item.__kind = ensureKind(item, item.__kind || 'deposit');
          c.order.push(itemKey);
          c.byCode[itemKey] = item;
        });
        saveCache(uid, c);
      }
      function upsertCache(uid, cacheKey, data){
        const c = readCache(uid);
        c.version = CACHE_SCHEMA_VERSION;
        c.byCode = c.byCode || {};
        c.order = Array.isArray(c.order) ? c.order : [];
        const normalizedKey = String(cacheKey || getItemCacheKey(data) || getCode(data) || '').trim();
        if (!normalizedKey) return;
        const existing = c.byCode[normalizedKey] || {};
        const merged = Object.assign({}, existing, data || {}, { __cachedAt: Date.now() });
        if (!merged.code) merged.code = getCode(merged) || normalizedKey;
        merged.__cacheKey = normalizedKey;
        merged.__kind = ensureKind(merged, (data && data.__kind) || existing.__kind || (typeof merged.code === 'string' && merged.code.toUpperCase().indexOf('WDR') === 0 ? 'withdraw' : 'deposit'));
        c.byCode[normalizedKey] = merged;
        if (!c.order.includes(normalizedKey)) c.order.unshift(normalizedKey);
        c.lastSync = Date.now();
        saveCache(uid, c);
      }
      function cacheToArray(uid){
        const c = readCache(uid);
        const orderList = Array.isArray(c.order) ? c.order : [];
        const byCode = c.byCode || {};
        const arr = [];
        orderList.forEach(function(cacheKey){
          const stored = byCode[cacheKey];
          if (!stored) return;
          const item = Object.assign({}, stored);
          if (!item.code && PAGE_MODE === 'payments') item.code = cacheKey;
          item.__cacheKey = cacheKey;
          item.__kind = ensureKind(item, item.__kind);
          arr.push(item);
        });
        return sortByNewest(arr);
      }

      function getCode(item){
        if (!item) return '';
        return item.code || item.depositCode || item.id || '';
      }
      function getItemCacheKey(item){
        if (!item || typeof item !== 'object') return '';
        var explicitKey = String(item.__cacheKey || item.cacheKey || '').trim();
        if (explicitKey) return explicitKey;
        var code = String(getCode(item) || '').trim();
        if (PAGE_MODE === 'payments') return code;
        var entryKey = String(item.entryKey || item.entry_key || '').trim();
        if (entryKey) return entryKey;
        var createdValue = item.createdAt || item.created_at || item.computedAt || item.timestamp || '';
        var createdDate = asDate(createdValue);
        var created = createdDate && !isNaN(createdDate.getTime())
          ? createdDate.getTime()
          : String(createdValue || '').trim();
        if (!code && !created) return '';
        return [code || 'tx', getKind(item), created || '0'].join('|');
      }
      function findItemByCacheKey(list, key){
        var targetKey = String(key || '').trim();
        if (!targetKey) return null;
        var arr = Array.isArray(list) ? list : [];
        for (var i = 0; i < arr.length; i += 1){
          if (getItemCacheKey(arr[i]) === targetKey) return arr[i];
        }
        return null;
      }
      function sortByNewest(arr){
        return (arr || []).slice().sort(function(a,b){
          ensureKind(a, 'deposit');
          ensureKind(b, 'deposit');
          const da = asDate(a && (a.createdAt || a.computedAt || a.timestamp));
          const db = asDate(b && (b.createdAt || b.computedAt || b.timestamp));
          const ta = da && !isNaN(da.getTime()) ? da.getTime() : 0;
          const tb = db && !isNaN(db.getTime()) ? db.getTime() : 0;
          if (tb !== ta) return tb - ta;
          const ao = Number(a && a.__entryOrder);
          const bo = Number(b && b.__entryOrder);
          if (Number.isFinite(ao) && Number.isFinite(bo) && ao !== bo) {
            // Smaller entry order means newer inside persisted transfer arrays.
            return ao - bo;
          }
          return 0;
        });
      }
      function buildSnapshotSignature(list){
        function sig(val){
          const num = parseNumeric(val);
          return (num != null && isFinite(num)) ? num.toFixed(3) : '';
        }
        return sortByNewest(list).map(function(item){
          const kind = getKind(item);
          const code = getCode(item);
          const itemKey = getItemCacheKey(item) || code;
          const status = normStatus((item && (item.status || item.state || item.depositStatus)) || '');
          const createdDate = asDate(item && (item.createdAt || item.computedAt || item.timestamp));
          const created = createdDate && !isNaN(createdDate.getTime()) ? createdDate.getTime() : 0;
          const changeVal = kind === 'withdraw'
            ? pickNumber(item, ['debited', 'debitedUSD', 'amountUSD', 'debitedJOD', 'amountJOD', 'amountCurrency'])
            : pickNumber(item, ['added', 'addedAmount', 'addedUSD', 'amountUSD', 'client_payAmount']);
          const balanceAfterVal = pickNumber(item, ['balanceAfter', 'balanceAfterStr']);
          return [kind, itemKey, code, status, created, sig(changeVal), sig(balanceAfterVal)].join('|');
        }).join('||');
      }
      function selectLastCard(uid){
        try{
          const last = LAST_CODE_MEMORY[LAST_CODE_PREFIX + uid];
          if (!last) return;
          const cards = Array.from(listEl.querySelectorAll('.card'));
          const card = cards.find(function(entryCard){
            return String(entryCard.dataset && entryCard.dataset.itemKey || '') === last;
          }) || cards.find(function(entryCard){
            return String(entryCard.dataset && entryCard.dataset.code || '') === last;
          }) || null;
          if (!card) return;
          card.classList.add('selected');
          const item = findItemByCacheKey(ALL_ITEMS, last) || ALL_ITEMS.find(function(x){ return getCode(x) === last; });
          if (item) updateCardFromData(card, item);
        }catch(_){ }
      }
      function displayItems(uid, items){
        ALL_ITEMS = sortByNewest(items).map(function(item){
          var normalized = Object.assign({}, item);
          var itemKey = getItemCacheKey(normalized);
          if (itemKey) normalized.__cacheKey = itemKey;
          return normalized;
        });
        renderVisibleItems(uid);
      }

      function updateCardFromData(card, data){
        if (!card || !data) return;
        var code = card.dataset ? card.dataset.code : null;
        var itemKey = card.dataset ? String(card.dataset.itemKey || '').trim() : '';
        if (!code) code = getCode(data);
        var merged = Object.assign({}, data);
        var existing = findItemByCacheKey(ALL_ITEMS, itemKey);
        if (!existing && code){
          existing = ALL_ITEMS.find(function(x){ return getCode(x) === code; });
        }
        if (existing) merged = Object.assign({}, existing, data);
        if (!merged.code) merged.code = code;
        if (itemKey) merged.__cacheKey = itemKey;
        if (card.dataset && card.dataset.kind && !merged.__kind) merged.__kind = card.dataset.kind;
        populateTransactionCard(card, merged);
      }

      function ensureTransactionDetailsModal(){
        if (TRANSACTION_DETAILS_MODAL && document.body && document.body.contains(TRANSACTION_DETAILS_MODAL)) {
          return TRANSACTION_DETAILS_MODAL;
        }

        var overlay = document.createElement('div');
        overlay.className = 'wallet-history-modal';
        overlay.id = 'wallet-history-modal-' + PAGE_MODE;
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('tabindex', '-1');
        overlay.innerHTML = [
          '<div class="wallet-history-modal-card" role="document">',
            '<button type="button" class="wallet-history-modal-close" aria-label="إغلاق التفاصيل"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>',
            '<div class="wallet-history-modal-head">',
              '<div class="wallet-history-modal-kicker"></div>',
              '<h3 class="wallet-history-modal-title"></h3>',
              '<p class="wallet-history-modal-subtitle"></p>',
              '<div class="wallet-history-modal-badges"></div>',
            '</div>',
            '<div class="wallet-history-modal-loading"></div>',
            '<div class="wallet-history-modal-summary"></div>',
            '<div class="wallet-history-modal-sections"></div>',
          '</div>'
        ].join('');

        overlay.addEventListener('click', function(ev){
          if (ev.target === overlay) closeTransactionDetailsModal();
        });
        overlay.addEventListener('keydown', function(ev){
          if (!ev) return;
          if (ev.key === 'Escape' || ev.key === 'Esc'){
            ev.preventDefault();
            closeTransactionDetailsModal();
          }
        });

        var closeBtn = overlay.querySelector('.wallet-history-modal-close');
        if (closeBtn) closeBtn.addEventListener('click', closeTransactionDetailsModal);

        overlay.__refs = {
          kicker: overlay.querySelector('.wallet-history-modal-kicker'),
          title: overlay.querySelector('.wallet-history-modal-title'),
          subtitle: overlay.querySelector('.wallet-history-modal-subtitle'),
          badges: overlay.querySelector('.wallet-history-modal-badges'),
          loading: overlay.querySelector('.wallet-history-modal-loading'),
          summary: overlay.querySelector('.wallet-history-modal-summary'),
          sections: overlay.querySelector('.wallet-history-modal-sections')
        };

        document.body.appendChild(overlay);
        TRANSACTION_DETAILS_MODAL = overlay;
        return overlay;
      }

      function closeTransactionDetailsModal(){
        if (!TRANSACTION_DETAILS_MODAL) return;
        TRANSACTION_DETAILS_REQUEST_TOKEN = '';
        TRANSACTION_DETAILS_MODAL.classList.remove('show');
        try { document.documentElement.classList.remove('wallet-history-modal-open'); } catch (_) {}
        try { document.body.classList.remove('wallet-history-modal-open'); } catch (_) {}
        try {
          if (TRANSACTION_DETAILS_LAST_FOCUS && typeof TRANSACTION_DETAILS_LAST_FOCUS.focus === 'function') {
            TRANSACTION_DETAILS_LAST_FOCUS.focus();
          }
        } catch (_) {}
      }

      function openTransactionDetailsModal(card, item, options){
        var modal = ensureTransactionDetailsModal();
        var refs = modal.__refs || {};
        var model = buildTransactionDetailsModel(item, card);
        var opts = options && typeof options === 'object' ? options : {};
        var sectionsHtml = [
          renderTransactionDetailSection(model.basicSectionTitle || 'بيانات الطلب', model.basic),
          renderTransactionDetailSection('بيانات المستلم', model.payout),
          renderTransactionDetailSection('جهات التحويل', model.transfers),
          renderTransactionDetailSection('الحقول الإضافية', model.extra)
        ].filter(Boolean).join('');

        if (refs.kicker) refs.kicker.textContent = model.kicker;
        if (refs.title) refs.title.textContent = model.title;
        if (refs.subtitle){
          refs.subtitle.textContent = model.subtitle || '';
          refs.subtitle.style.display = model.subtitle ? '' : 'none';
        }
        if (refs.badges){
          refs.badges.innerHTML = [
            '<span class="wallet-history-modal-badge">' + escapeHtml(model.kindLabel) + '</span>',
            '<span class="' + statusClass(model.status) + '">' + escapeHtml(model.statusLabel || statusLabel(model.status)) + '</span>'
          ].join('');
        }
        if (refs.loading){
          refs.loading.textContent = opts.loading ? 'جاري تحديث التفاصيل...' : '';
          refs.loading.classList.toggle('show', !!opts.loading);
        }
        if (refs.summary) refs.summary.innerHTML = renderTransactionSummaryCards(model.summary);
        if (refs.sections){
          refs.sections.innerHTML = sectionsHtml || '<div class="wallet-history-modal-empty">' + escapeHtml(model.emptyText || 'لا توجد تفاصيل إضافية متاحة لهذه العملية.') + '</div>';
        }

        if (!modal.classList.contains('show')){
          TRANSACTION_DETAILS_LAST_FOCUS = document.activeElement;
        }
        modal.classList.add('show');
        try { document.documentElement.classList.add('wallet-history-modal-open'); } catch (_) {}
        try { document.body.classList.add('wallet-history-modal-open'); } catch (_) {}
        try { modal.focus(); } catch (_) {}
      }

      function mergeFreshTransactionIntoState(itemKey, fresh){
        var normalizedKey = String(itemKey || '').trim();
        var idx = normalizedKey
          ? ALL_ITEMS.findIndex(function(entry){ return getItemCacheKey(entry) === normalizedKey; })
          : -1;
        if (idx < 0){
          var code = getCode(fresh);
          idx = ALL_ITEMS.findIndex(function(entry){ return getCode(entry) === code; });
        }
        if (idx >= 0){
          ALL_ITEMS[idx] = Object.assign({}, ALL_ITEMS[idx], fresh);
          return ALL_ITEMS[idx];
        }
        ALL_ITEMS.unshift(fresh);
        return fresh;
      }

      async function openTransactionDetailsForCard(card){
        if (!card || !card.dataset) return;
        var code = String(card.dataset.code || '').trim();
        var itemKey = String(card.dataset.itemKey || '').trim();
        if (!code || code === '-') return;
        var user = auth.currentUser;
        if (!user || !user.uid) return;
        var uid = user.uid;

        var knownKind = card.dataset.kind || null;
        var currentItem = findItemByCacheKey(ALL_ITEMS, itemKey) || ALL_ITEMS.find(function(entry){ return getCode(entry) === code; }) || null;
        var cached = null;

        try{
          var cacheObj = readCache(uid);
          if (cacheObj && cacheObj.byCode && itemKey && cacheObj.byCode[itemKey]){
            cached = cacheObj.byCode[itemKey];
            if (!knownKind && cached.__kind) knownKind = cached.__kind;
          } else if (cacheObj && cacheObj.byCode && cacheObj.byCode[code]){
            cached = cacheObj.byCode[code];
            if (!knownKind && cached.__kind) knownKind = cached.__kind;
          }
        }catch(_){ }

        if (!currentItem && cached) currentItem = cached;
        if (!currentItem) currentItem = { code: code, __kind: knownKind || 'deposit' };
        if (cached) currentItem = Object.assign({}, currentItem, cached);

        listEl.querySelectorAll('.card.selected').forEach(function(el){
          if (el !== card) el.classList.remove('selected');
        });
        card.classList.add('selected');
        try { LAST_CODE_MEMORY[LAST_CODE_PREFIX + uid] = itemKey || code; } catch (_) {}

        openTransactionDetailsModal(card, currentItem, { loading: true });
        var requestToken = (itemKey || code) + ':' + Date.now();
        TRANSACTION_DETAILS_REQUEST_TOKEN = requestToken;

        var finalItem = currentItem;
        try{
          var fresh = await fetchSingleRequestForUser(uid, code, knownKind);
          if (fresh){
            if (fresh.__kind) knownKind = fresh.__kind;
            fresh = Object.assign({}, currentItem || {}, fresh);
            if (itemKey) fresh.__cacheKey = itemKey;
            updateCardFromData(card, fresh);
            upsertCache(uid, itemKey || getItemCacheKey(fresh) || code, fresh);
            finalItem = Object.assign({}, mergeFreshTransactionIntoState(itemKey || code, fresh));
          }
        }catch(_){ }

        if (card.dataset && knownKind) card.dataset.kind = knownKind;
        if (TRANSACTION_DETAILS_REQUEST_TOKEN === requestToken){
          openTransactionDetailsModal(card, finalItem, { loading: false });
        }
      }

      function docToItem(doc, kind){
        if (!doc) return null;
        var data = typeof doc.data === 'function' ? doc.data() : (doc || {});
        var item = Object.assign({ id: doc.id }, data || {});
        if (!item.code && doc.id) item.code = doc.id;
        item.__kind = ensureKind(item, kind || item.__kind || 'deposit');
        return item;
      }
      function byCodeMapToItems(byCode, kind){
        var map = (byCode && typeof byCode === 'object') ? byCode : {};
        return Object.keys(map).map(function(fieldKey){
          var data = map[fieldKey];
          if (!data || typeof data !== 'object') return null;
          var item = Object.assign({ id: fieldKey }, data);
          if (!item.code) item.code = fieldKey;
          item.__kind = ensureKind(item, kind || item.__kind || 'deposit');
          return item;
        }).filter(Boolean);
      }
      function docByCodeToItems(docSnap, kind){
        if (!docSnap || !docSnap.exists) return [];
        var data = docSnap.data() || {};
        return byCodeMapToItems(data.byCode || {}, kind);
      }

      function isDepositRequestCode(entry){
        const code = String(getCode(entry)).toUpperCase();
        return code.startsWith('DEP') || code.startsWith('AUT');
      }

      async function fetchFromDepositRequests(uid){
        try{
          const userSnap = await db.collection('depositRequests').doc(uid).get();
          let arr = docByCodeToItems(userSnap, 'deposit');
          arr = arr.filter(isDepositRequestCode);
          if (arr.length){
            arr.sort(function(a,b){
              const taDate = asDate(a && (a.createdAt || a.timestamp));
              const tbDate = asDate(b && (b.createdAt || b.timestamp));
              const ta = taDate && !isNaN(taDate.getTime()) ? taDate.getTime() : 0;
              const tb = tbDate && !isNaN(tbDate.getTime()) ? tbDate.getTime() : 0;
              return tb - ta;
            });
            return arr;
          }
        }catch(_){ }

        // fallback legacy (قبل الانتقال إلى byCode)
        const baseRef = db.collection('depositRequests').where('userId','==',uid);
        try{
          const snap = await baseRef.orderBy('createdAt','desc').get();
          let arr = snap.docs.map(function(d){ return docToItem(d, 'deposit'); });
          arr = arr.filter(isDepositRequestCode);
          return arr;
        }catch(e){
          const msg = String(e && e.message || e || '');
          if (msg.includes('requires an index') || msg.includes('FAILED_PRECONDITION')){
            try{
              const snap2 = await baseRef.get();
              let arr = snap2.docs.map(function(d){ return docToItem(d, 'deposit'); });
              arr = arr.filter(isDepositRequestCode);
              arr.sort(function(a,b){
                const taDate = asDate(a && (a.createdAt || a.timestamp));
                const tbDate = asDate(b && (b.createdAt || b.timestamp));
                const ta = taDate && !isNaN(taDate.getTime()) ? taDate.getTime() : 0;
                const tb = tbDate && !isNaN(tbDate.getTime()) ? tbDate.getTime() : 0;
                return tb - ta;
              });
              return arr;
            }catch(_){ return []; }
          }
          return [];
        }
      }

      async function fetchFromOrdersPrefix(uid){
        return [];
      }

      async function fetchFromWithdrawRequests(uid){
        try{
          const userSnap = await db.collection('withdrawRequests').doc(uid).get();
          let arr = docByCodeToItems(userSnap, 'withdraw');
          if (arr.length){
            arr.sort(function(a,b){
              const ta = asDate(a && (a.createdAt || a.timestamp));
              const tb = asDate(b && (b.createdAt || b.timestamp));
              const taMs = ta && !isNaN(ta.getTime()) ? ta.getTime() : 0;
              const tbMs = tb && !isNaN(tb.getTime()) ? tb.getTime() : 0;
              return tbMs - taMs;
            });
            return arr;
          }
        }catch(_){ }

        // fallback legacy (قبل الانتقال إلى byCode)
        const baseRef = db.collection('withdrawRequests').where('userId','==',uid);
        try{
          const snap = await baseRef.orderBy('createdAt','desc').get();
          return snap.docs.map(function(d){ return docToItem(d, 'withdraw'); });
        }catch(e){
          const msg = String(e && e.message || e || '');
          if (msg.includes('requires an index') || msg.includes('FAILED_PRECONDITION')){
            try{
              const snap2 = await baseRef.get();
              const arr = snap2.docs.map(function(d){ return docToItem(d, 'withdraw'); });
              arr.sort(function(a,b){
                const ta = asDate(a && (a.createdAt || a.timestamp));
                const tb = asDate(b && (b.createdAt || b.timestamp));
                const taMs = ta && !isNaN(ta.getTime()) ? ta.getTime() : 0;
                const tbMs = tb && !isNaN(tb.getTime()) ? tb.getTime() : 0;
                return tbMs - taMs;
              });
              return arr;
            }catch(_){ return []; }
          }
          return [];
        }
      }

      async function fetchFromDepositRequests(uid){
        const sourceHint = readRequestSourceHint('depositRequests', uid);
        const depositFilter = function(entry){
          return isDepositRequestCode(entry);
        };
        if (sourceHint === 'query' || sourceHint === 'query-unordered'){
          return fetchRequestsByQuery(uid, 'depositRequests', 'deposit', depositFilter);
        }
        try{
          const userSnap = await db.collection('depositRequests').doc(uid).get();
          let arr = docByCodeToItems(userSnap, 'deposit');
          arr = arr.filter(depositFilter);
          if (arr.length){
            arr = sortRequestItemsByNewest(arr);
            writeRequestSourceHint('depositRequests', uid, 'doc');
            return arr;
          }
          if (sourceHint === 'doc') return [];
        }catch(_){ }
        return fetchRequestsByQuery(uid, 'depositRequests', 'deposit', depositFilter);
      }

      async function fetchFromWithdrawRequests(uid){
        const sourceHint = readRequestSourceHint('withdrawRequests', uid);
        if (sourceHint === 'query' || sourceHint === 'query-unordered'){
          return fetchRequestsByQuery(uid, 'withdrawRequests', 'withdraw');
        }
        try{
          const userSnap = await db.collection('withdrawRequests').doc(uid).get();
          let arr = docByCodeToItems(userSnap, 'withdraw');
          if (arr.length){
            arr = sortRequestItemsByNewest(arr);
            writeRequestSourceHint('withdrawRequests', uid, 'doc');
            return arr;
          }
          if (sourceHint === 'doc') return [];
        }catch(_){ }
        return fetchRequestsByQuery(uid, 'withdrawRequests', 'withdraw');
      }

      function mergeByCode(list){
        const map = {};
        (list || []).forEach(function(item){
          const code = getCode(item);
          if (!code) return;
          const existing = map[code];
          if (existing){
            map[code] = Object.assign({}, existing, item);
          } else {
            map[code] = Object.assign({}, item);
          }
          map[code].__kind = ensureKind(map[code], item.__kind);
        });
        return Object.keys(map).map(function(code){
          const value = map[code];
          if (!value.code) value.code = code;
          value.__kind = ensureKind(value, value.__kind);
          return value;
        });
      }

      async function fetchTransfers(uid){
        try{
          const snap = await db.collection('userTransactions').doc(uid).get();
          if (!snap || !snap.exists) return [];
          return normalizeTransferEntries(snap.data() || {});
        }catch(err){
          console.warn('fetchTransfers failed', err);
          return [];
        }
      }
      async function fetchSingleRequestForUser(uid, code, preferredKind){
        const normalizedCode = String(code || '').trim().toUpperCase();
        const collections = preferredKind === 'withdraw'
          ? ['withdrawRequests', 'depositRequests']
          : ['depositRequests', 'withdrawRequests'];

        for (let i = 0; i < collections.length; i += 1){
          const col = collections[i];
          const kind = col === 'withdrawRequests' ? 'withdraw' : 'deposit';
          try{
            const userSnap = await db.collection(col).doc(uid).get();
            if (!userSnap || !userSnap.exists) continue;
            const items = docByCodeToItems(userSnap, kind);
            const hit = items.find(function(entry){
              return String(getCode(entry)).toUpperCase() === normalizedCode;
            });
            if (hit){
              hit.__kind = ensureKind(hit, kind);
              return hit;
            }
          }catch(_){ }
        }

        // fallback legacy: documentId = code
        for (let i = 0; i < collections.length; i += 1){
          const col = collections[i];
          const kind = col === 'withdrawRequests' ? 'withdraw' : 'deposit';
          try{
            const snap = await db.collection(col).doc(code).get();
            if (snap && snap.exists){
              const fresh = Object.assign({ id: snap.id }, snap.data() || {});
              if (!fresh.code) fresh.code = code;
              fresh.__kind = ensureKind(fresh, kind);
              return fresh;
            }
          }catch(_){ }
        }
        return null;
      }

      function normalizeTransferEntries(data){
        var raw = [];
        if (data && data.entriesMap && typeof data.entriesMap === 'object' && !Array.isArray(data.entriesMap)) {
          raw = Object.values(data.entriesMap);
        } else if (data && data.entries_map && typeof data.entries_map === 'object' && !Array.isArray(data.entries_map)) {
          raw = Object.values(data.entries_map);
        } else if (data && data.entriesById && typeof data.entriesById === 'object' && !Array.isArray(data.entriesById)) {
          raw = Object.values(data.entriesById);
        } else if (data && data.entriesMap && data.entriesMap.mapValue && data.entriesMap.mapValue.fields) {
          raw = Object.values(data.entriesMap.mapValue.fields).map(function(v){
            return (v && v.mapValue && v.mapValue.fields) || v;
          });
        } else if (Array.isArray(data.entries)) raw = data.entries;
        else if (data.entries && Array.isArray(data.entries.values)){
          raw = data.entries.values.map(function(v){
            return (v && v.mapValue && v.mapValue.fields) || v;
          });
        } else {
          raw = Array.isArray(data) ? data : [];
        }
        return raw.map(function(entry, idx){
          if (!entry) return null;
          var flat = entry;
          if (entry.mapValue && entry.mapValue.fields) flat = entry.mapValue.fields;
          function readField(obj, key){
            if (!obj) return undefined;
            if (typeof obj[key] === 'object' && obj[key] !== null){
              var valObj = obj[key];
              if (valObj.stringValue != null) return valObj.stringValue;
              if (valObj.doubleValue != null) return Number(valObj.doubleValue);
              if (valObj.integerValue != null) return Number(valObj.integerValue);
              if (valObj.booleanValue != null) return valObj.booleanValue === true;
              if (valObj.timestampValue != null) return valObj.timestampValue;
            }
            return obj[key];
          }
          var kind = (readField(flat,'kind') || 'deposit').toString().toLowerCase() === 'withdraw' ? 'withdraw' : 'deposit';
          var created =
            readField(flat,'createdAt') ||
            readField(flat,'timestamp') ||
            readField(flat,'created_at') ||
            readField(flat,'computedAt');
          var createdDate = null;
          if (created && typeof created.toDate === 'function') createdDate = created.toDate();
          else if (created instanceof Date) createdDate = created;
          else if (typeof created === 'string'){
            var parsed = Date.parse(created);
            if (!isNaN(parsed)) createdDate = new Date(parsed);
          } else if (created && typeof created.seconds === 'number'){
            createdDate = new Date(created.seconds * 1000);
          }
          var amount = parseNumeric(readField(flat,'amount'));
          var balanceBefore = parseNumeric(readField(flat,'balanceBefore'));
          var balanceAfter = parseNumeric(readField(flat,'balanceAfter'));
          var peer =
            readField(flat,'peerWebuid') ||
            readField(flat,'receiverWebuid') ||
            readField(flat,'recipientWebuid') ||
            readField(flat,'targetWebuid') ||
            readField(flat,'peerUid') ||
            readField(flat,'receiverUid') ||
            readField(flat,'recipientUid') ||
            readField(flat,'targetUid') ||
            '';
          var methodNameRaw = readField(flat,'methodName') || '';
          var methodName = fixWalletText(String(methodNameRaw || ''));
          var entryType = String(readField(flat,'entryType') || readField(flat,'entry_type') || '').trim().toLowerCase();
          var descriptionText = fixWalletText(String(readField(flat,'description') || ''));
          var genericWithdrawMethod = /تحويل\s*إلى\s*(مستلم|مستخدم|-|â€”)?\s*$/;
          var genericDepositMethod = /تحويل\s*من\s*(مرسل|مستخدم|-|â€”)?\s*$/;
          var countryNameRaw = readField(flat,'countryName') || readField(flat,'country') || readField(flat,'countryLabel') || '';
          var codeText = String(readField(flat,'code') || '').trim();
          var purchaseName = fixWalletText(String(
            readField(flat,'serviceName') ||
            readField(flat,'productName') ||
            readField(flat,'offerName') ||
            readField(flat,'offer') ||
            (entryType === 'deposit' ? '' : descriptionText) ||
            readField(flat,'name') ||
            readField(flat,'gameName') ||
            readField(flat,'game') ||
            readField(flat,'title') ||
            ''
          ));
          var explicitDepositEntry = kind === 'deposit' && (
            entryType === 'deposit' ||
            /إيداع|ايداع/i.test([methodName, descriptionText].join(' '))
          );
          if (explicitDepositEntry) purchaseName = '';
          var isRefundEntry =
            readField(flat,'refund') === true ||
            readField(flat,'isRefund') === true ||
            entryType === 'refund' ||
            isRefundLedgerText(methodName) ||
            isRefundLedgerText(purchaseName);
          var refundTitle = isRefundEntry
            ? resolveRefundTitle(purchaseName || methodName, codeText ? ('استرداد الطلب ' + codeText) : 'استرداد')
            : '';
          var isAdminAction = isAdminLedgerText(methodName) || isAdminLedgerText(purchaseName);
          var isOrderLike = !explicitDepositEntry && !isAdminAction && (entryType === 'purchase' || /^ORD/i.test(codeText) || !!purchaseName);
          var purchaseTitle = isOrderLike
            ? resolvePurchaseLedgerTitle(purchaseName, codeText ? ('شراء ' + codeText) : 'شراء')
            : purchaseName;
          if (isGenericTransferPeer(peer)) peer = '';
          if (!methodName ||
              (kind === 'withdraw' && genericWithdrawMethod.test(methodName)) ||
              (kind !== 'withdraw' && genericDepositMethod.test(methodName))){
            if (isRefundEntry) {
              methodName = refundTitle || methodName || 'استرداد';
            } else if (isAdminAction) {
              methodName = purchaseName || methodName || (kind === 'withdraw' ? 'خصم رصيد من إدارة التلغرام' : 'زيادة رصيد من الإدارة');
            } else if (isOrderLike) {
              methodName = purchaseTitle || 'شراء';
            } else {
              methodName = kind === 'withdraw'
                ? ('تحويل إلى ' + (peer || '-'))
                : ('تحويل من ' + (peer || '-'));
            }
          }
          var note = readField(flat,'note') || readField(flat,'transferNote') || '';
          var currency = 'USD';
          var item = {
            code: codeText || '',
            entryKey: String(readField(flat,'entryKey') || readField(flat,'entry_key') || '').trim(),
            relatedCode: String(readField(flat,'relatedCode') || readField(flat,'related_code') || '').trim(),
            status: readField(flat,'status') || 'completed',
            methodName: methodName,
            countryName: String(countryNameRaw || '').trim(),
            transferPeer: peer,
            transferNote: note,
            serviceName: isRefundEntry ? (refundTitle || "") : (purchaseTitle || ""),
            productName: isRefundEntry ? (refundTitle || "") : (purchaseTitle || ""),
            title: isRefundEntry ? (refundTitle || "") : (purchaseTitle || ""),
            createdAt: createdDate || null,
            timestamp: createdDate || null,
            __entryOrder: idx,
            __kind: kind,
            entryType: entryType || (isRefundEntry ? 'refund' : (isOrderLike ? 'purchase' : '')),
            refund: isRefundEntry,
            isRefund: isRefundEntry
          };
          if (kind === 'withdraw'){
            item.debited = amount;
            item.debitedUSD = amount;
            item.amountCurrency = amount;
            item.amountUSD = amount;
            item.currency = "USD";
            item.balanceBefore = balanceBefore;
            item.balanceAfter = balanceAfter;
          } else {
            item.added = amount;
            item.addedAmount = amount;
            item.addedUSD = amount;
            item.addedCurrency = "USD";
            item.amountUSD = amount;
            item.currency = "USD";
            item.balanceBefore = balanceBefore;
            item.balanceAfter = balanceAfter;
          }
          return item;
        }).filter(Boolean);
      }

      async function fetchAllTransactions(uid){
        if (PAGE_MODE === 'payments') {
          const depositsPromise = (async function(){
            let depositList = await fetchFromDepositRequests(uid);
            if (!depositList.length) depositList = await fetchFromOrdersPrefix(uid);
            return depositList;
          })();
          const withdrawPromise = fetchFromWithdrawRequests(uid);
          const paymentResults = await Promise.all([depositsPromise, withdrawPromise]);
          return sortByNewest(mergeByCode([].concat(paymentResults[0] || [], paymentResults[1] || [])));
        }
        const transfers = await fetchTransfers(uid);
        return sortByNewest(transfers || []);
      }

      async function fetchAllPayments(uid){
        const depositsPromise = (async function(){
          let depositList = await fetchFromDepositRequests(uid);
          if (!depositList.length) depositList = await fetchFromOrdersPrefix(uid);
          return depositList;
        })();
        const withdrawPromise = fetchFromWithdrawRequests(uid);
        const results = await Promise.all([depositsPromise, withdrawPromise]);
        return sortByNewest(mergeByCode([].concat(results[0] || [], results[1] || [])));
      }

      function fetchLatestTransactions(uid){
        const safeUid = String(uid || '').trim();
        if (!safeUid) return Promise.resolve([]);
        if (FETCH_ALL_INFLIGHT_PROMISE && FETCH_ALL_INFLIGHT_UID === safeUid) return FETCH_ALL_INFLIGHT_PROMISE;
        const task = Promise.resolve().then(function(){
          return fetchAllTransactions(safeUid);
        }).finally(function(){
          if (FETCH_ALL_INFLIGHT_PROMISE === task) {
            FETCH_ALL_INFLIGHT_PROMISE = null;
            FETCH_ALL_INFLIGHT_UID = '';
          }
        });
        FETCH_ALL_INFLIGHT_UID = safeUid;
        FETCH_ALL_INFLIGHT_PROMISE = task;
        return task;
      }

      function applyFilter(arr){
        if (CURRENT_FILTER === 'all') return arr.slice();
        return arr.filter(function(item){ return normStatus((item && (item.status || item.state || item.depositStatus)) || '') === CURRENT_FILTER; });
      }

      async function loadWalletFor(user, opts = {}){
        if (!user){ showRequiresAuth(); fixWalletTextNodes(listEl); return; }
        const force = !!opts.force;
        const skipSkeleton = !!opts.skipSkeleton;
        const skipServerSync = !!opts.skipServerSync;
        if (!skipSkeleton) showSkeleton();

        const uid = user.uid;
        const sameUserAsLastRender = LAST_USER_ID === uid;
        if (!force && !isPageRouteActive()) return;
        if (shouldSkipImmediateReload(uid, force)) return;
        markLoadRequest(uid);
        if (!LAST_USER_ID || LAST_USER_ID !== uid) {
          CURRENT_FILTER = 'all';
          applyDefaultDateFilter();
        }
        LAST_USER_ID = uid;

        let items = [];
        let usedCache = false;
        const cache = readCache(uid);
        const cacheLastSync = Number(cache && cache.lastSync || 0) || 0;
        const recentlySynced = !force && cacheLastSync > 0 && (Date.now() - cacheLastSync) < RECENT_SERVER_SYNC_TTL_MS;
        const hasMemoryItems = !force && sameUserAsLastRender && Array.isArray(ALL_ITEMS) && ALL_ITEMS.length > 0;

        if (!force && cache.order && cache.order.length){
          items = cacheToArray(uid);
          usedCache = true;
        } else if (hasMemoryItems){
          items = ALL_ITEMS.slice();
          usedCache = true;
        } else {
          items = await fetchLatestTransactions(uid);
          replaceCache(uid, items);
        }

        try{
          const savedFilter = FILTER_MEMORY[FILTER_PREFIX + uid];
          if (savedFilter) CURRENT_FILTER = savedFilter;
        }catch(_){ }

        displayItems(uid, items);
        const hasPendingItems = hasPendingHistoryItems(items);
        const previousSignature = buildSnapshotSignature(ALL_ITEMS);

        if (force || skipServerSync) return;

        if (usedCache && (!recentlySynced || hasPendingItems)){
          (async ()=>{
            try{
              const fresh = await fetchLatestTransactions(uid);
              replaceCache(uid, fresh);
              const newSignature = buildSnapshotSignature(fresh);
              if (newSignature !== previousSignature){
                displayItems(uid, fresh);
              }
            }catch(_){ }
          })();
        }
      }

      chipsWrap.addEventListener('click', (e)=>{
        const btn = e.target.closest('.chip');
        if (!btn) return;
        if (btn.id === DATE_CHIP_ID){
          openHistoryCalendar();
          return;
        }
        if (!btn.dataset || !btn.dataset.filter) return;
        CURRENT_FILTER = btn.dataset.filter || 'all';
        const user = auth.currentUser;
        if (user){
          try{ FILTER_MEMORY[FILTER_PREFIX + user.uid] = CURRENT_FILTER; }catch(_){ }
        }
        renderVisibleItems((user && user.uid) || LAST_USER_ID);
      });

      if (refreshBtn){
        refreshBtn.addEventListener('click', (e)=>{
          try{ e.preventDefault(); }catch(_){ }
          loadWalletFor(auth.currentUser, { force: true });
        });
      }

      listEl.addEventListener('click', async (e)=>{
        var codeBtn = e.target.closest('.code-btn[data-code], .code-status-btn[data-code]');
        if (codeBtn){
          e.preventDefault();
          var codeCard = codeBtn.closest('.card');
          if (!codeCard) return;
          await openTransactionDetailsForCard(codeCard);
          return;
        }

        var interactive = e.target.closest('a, button, input, select, textarea, label');
        if (interactive) return;

        var card = e.target.closest('.card[data-openable="1"]');
        if (!card) return;
        await openTransactionDetailsForCard(card);
      });

      listEl.addEventListener('keydown', async (e)=>{
        if (!e) return;
        if (e.key !== 'Enter' && e.key !== ' ') return;
        var card = e.target.closest('.card[data-openable="1"]');
        if (!card) return;
        e.preventDefault();
        await openTransactionDetailsForCard(card);
      });

      function init(){
        applyDefaultDateFilter();
        syncWalletToolbarUI();
        showSkeleton();
        bindAutoHistoryRefresh();

        const current = auth.currentUser;
        let firstAuthHandled = false;

        if (typeof auth.onAuthStateChanged === 'function'){
          try{
            auth.onAuthStateChanged(user => {
              const opts = { force: false, skipSkeleton: !firstAuthHandled };
              firstAuthHandled = true;
              if (!isPageRouteActive()) return;
              loadWalletFor(user, opts);
            });
          }catch(_){
            if (!current) showRequiresAuth();
          }
        } else if (current){
          loadWalletFor(current, { force: true, skipSkeleton: true });
          firstAuthHandled = true;
        } else {
          showRequiresAuth();
        }
      }

      window[pageConfig.refreshFnName] = function(opts){
        try {
          const refreshOpts = opts || {};
          if (!refreshOpts.force && !isPageRouteActive()) return;
          loadWalletFor(auth.currentUser, refreshOpts);
        }catch(_){ }
      };

      if (document.readyState === 'loading'){
        document.addEventListener('DOMContentLoaded', init, { once: true });
      } else {
        init();
      }
    })(authInstance, dbInstance, pageConfig);
  }

  window.__initWalletPage = function(){
    return initWalletLikePage('wallet');
  };

  window.__initPaymentsPage = function(){
    return initWalletLikePage('payments');
  };
})();
