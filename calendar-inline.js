// تقويم منبثق بسيط مع إبراز الأيام
const CAL = { el: null, year: 0, month: 0 };
function openCalendar(){
  try{
    if (CAL.el && document.body && !document.body.contains(CAL.el)) {
      CAL.el = null;
    }
  }catch(_){}
  const minDateStr = getOrdersMinDateStr();
  if (!SELECTED_DATE_STR || SELECTED_DATE_STR < minDateStr) {
    SELECTED_DATE_STR = minDateStr;
    SELECTED_DATE_MANUAL = false; // تم تعيينه تلقائيًا كحد أدنى
  }
  const base = (SELECTED_DATE_STR || getTodayStr()).split('-').map(Number);
  CAL.year = base[0] || (new Date()).getFullYear();
  CAL.month = ((base[1]||1) - 1);
  if (!CAL.el){
    const overlay = document.createElement('div');
    overlay.className = 'calendar-popover';
    overlay.dataset.calendarOwner = 'orders';
    overlay.addEventListener('click', (e)=>{ if (e.target === overlay) closeCalendar(); });
    const panel = document.createElement('div');
    panel.className = 'calendar-panel';
    panel.innerHTML = `
      <div class="calendar-header">
        <button type="button" class="cal-nav" id="calPrev">&#x2039;</button>
        <div class="cal-title" id="calTitle"></div>
        <button type="button" class="cal-nav" id="calNext">&#x203A;</button>
      </div>
      <div class="calendar-sub">
        <div class="calendar-mode">
          <button type="button" class="calendar-mode-btn" id="calModeSingle">يوم واحد</button>
          <button type="button" class="calendar-mode-btn" id="calModeRange">نطاق</button>
        </div>
        <div class="calendar-selection" id="calSelectionText"></div>
      </div>
      <div class="calendar-grid" id="calGrid"></div>
    `;
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    CAL.el = overlay;
    panel.querySelector('#calPrev').onclick = ()=> shiftMonth(-1);
    panel.querySelector('#calNext').onclick = ()=> shiftMonth(+1);
    // تبديل وضع التاريخ
    const btnSingle = panel.querySelector('#calModeSingle');
    const btnRange = panel.querySelector('#calModeRange');
    if (btnSingle) btnSingle.onclick = () => {
      DATE_MODE = 'single';
      renderCalendar(CAL.year, CAL.month);
    };
    if (btnRange) btnRange.onclick = () => {
      DATE_MODE = 'range';
      // إن لم يكن من/إلى محددَين، عين البداية اليوم
      if (!DATE_RANGE.from){ DATE_RANGE.from = SELECTED_DATE_STR || getTodayStr(); }
      renderCalendar(CAL.year, CAL.month);
    };
  }
  renderCalendar(CAL.year, CAL.month);
}
function closeCalendar(){ try{ if (CAL.el){ CAL.el.remove(); CAL.el = null; } }catch(_){}}
function shiftMonth(delta){ let y=CAL.year, m=CAL.month+delta; if(m<0){m=11;y--;} else if(m>11){m=0;y++;} CAL.year=y; CAL.month=m; renderCalendar(y,m); }
function renderCalendar(year, month){
  try{
    if (CAL.el && document.body && !document.body.contains(CAL.el)) {
      CAL.el = null;
    }
  }catch(_){}
  if (!CAL.el) return;
  const titleEl = CAL.el.querySelector('#calTitle');
  const grid = CAL.el.querySelector('#calGrid');
  const counts = computeDateCounts();
  const first = new Date(year, month, 1);
  const lastDay = new Date(year, month+1, 0).getDate();
  const dow = first.getDay();
  const todayStr = getTodayStr();
  const minDateStr = getOrdersMinDateStr();
  // ضبط أزرار التنقل حسب الحدود (لا شهر قادم ولا قبل أول طلب)
  try{
    const prevBtn = CAL.el.querySelector('#calPrev');
    const nextBtn = CAL.el.querySelector('#calNext');
    const now = new Date();
    const curY = now.getFullYear();
    const curM = now.getMonth();
    const [minY, minM] = minDateStr.split('-').map(Number);
    const atMin = (year < minY) || (year === minY && month <= (minM-1));
    const atMax = (year > curY) || (year === curY && month >= curM);
    if (prevBtn){ prevBtn.disabled = atMin; prevBtn.setAttribute('aria-disabled', atMin?'true':'false'); prevBtn.style.opacity = atMin?'.5':'1'; prevBtn.onclick = () => { if (!prevBtn.disabled) shiftMonth(-1); }; }
    if (nextBtn){ nextBtn.disabled = atMax; nextBtn.setAttribute('aria-disabled', atMax?'true':'false'); nextBtn.style.opacity = atMax?'.5':'1'; nextBtn.onclick = () => { if (!nextBtn.disabled) shiftMonth(+1); }; }
  }catch{}
  try{ titleEl.textContent = `${pad2(month+1)}/${year}`; }catch{ titleEl.textContent = `${pad2(month+1)}/${year}`; }
  // وضع الأزرار ونص الاختيار
  try{
    const b1 = CAL.el.querySelector('#calModeSingle');
    const b2 = CAL.el.querySelector('#calModeRange');
    if (b1) b1.classList.toggle('active', DATE_MODE === 'single');
    if (b2) b2.classList.toggle('active', DATE_MODE === 'range');
    const sel = CAL.el.querySelector('#calSelectionText');
    if (sel){
      if (DATE_MODE === 'range'){
        const f = DATE_RANGE.from, t = DATE_RANGE.to;
        if (f && t) sel.textContent = `من ${formatArDateStr(f)} إلى ${formatArDateStr(t)}`;
        else if (f && !t) sel.textContent = `ابدأ: ${formatArDateStr(f)} — اختر النهاية`;
        else sel.textContent = 'اختر نطاق تاريخ';
      } else {
        const ymd = SELECTED_DATE_STR || getTodayStr();
        sel.textContent = `${formatArDateStr(ymd)}`;
      }
    }
  }catch{}
  const weekdays = ['أحد','إثنين','ثلاثاء','أربعاء','خميس','جمعة','سبت'];
  let html = '';
  for(let i=0;i<7;i++){ html += `<div class="calendar-weekday">${weekdays[i]}</div>`; }
  for(let i=0;i<dow;i++){ html += `<div class="calendar-spacer"></div>`; }
  const selected = SELECTED_DATE_STR || todayStr;
  const f = DATE_RANGE?.from || null;
  const t = DATE_RANGE?.to || null;
  const from = (f && t && f > t) ? t : f;
  const to = (f && t && f > t) ? f : t;
  for(let d=1; d<=lastDay; d++){
    const ymd = `${year}-${pad2(month+1)}-${pad2(d)}`;
    const cnt = counts[ymd]||0;
    const has = cnt>0 ? ' has' : '';
    let active = '';
    let rangeCls = '';
    if (DATE_MODE === 'range'){
      if (from && to && ymd > from && ymd < to) rangeCls += ' in-range';
      if (from && ymd === from) { rangeCls += ' range-start'; active = ' active'; }
      if (to && ymd === to) { rangeCls += ' range-end'; active = ' active'; }
    } else {
      active = (ymd===selected) ? ' active' : '';
    }
    const disabled = (ymd > todayStr || ymd < minDateStr) ? ' disabled' : '';
    const disAttr = disabled ? ' disabled aria-disabled="true"' : '';
    html += `<button type="button" class="calendar-day${has}${rangeCls}${active}${disabled}" data-date="${ymd}"${disAttr}><span class="num">${d}</span>${cnt? `<span class="count">${cnt}</span>`:''}</button>`;
  }
  grid.innerHTML = html;
  grid.querySelectorAll('.calendar-day').forEach(btn=>{
    if (btn.classList.contains('disabled')) return;
    btn.onclick = ()=>{
      const ymd = btn.getAttribute('data-date');
      if (DATE_MODE === 'range'){
        if (!DATE_RANGE.from || (DATE_RANGE.from && DATE_RANGE.to)){
          DATE_RANGE = { from: ymd, to: null };
          renderCalendar(year, month);
          return;
        } else if (DATE_RANGE.from && !DATE_RANGE.to){
          if (ymd < DATE_RANGE.from){ DATE_RANGE = { from: ymd, to: DATE_RANGE.from }; }
          else { DATE_RANGE.to = ymd; }
          closeCalendar();
          syncToolbarUI();
          recomputeAndRender();
          return;
        }
      } else {
        SELECTED_DATE_STR = ymd || getTodayStr();
        SELECTED_DATE_MANUAL = true; // تم اختيار التاريخ يدويًا من التقويم
        closeCalendar();
        syncToolbarUI();
        recomputeAndRender();
      }
    };
  });
}// ===== Firebase init =====
const ordersFirebaseConfig = (typeof window !== 'undefined' && window.__FIREBASE_CONFIG__)
  ? window.__FIREBASE_CONFIG__
  : ((typeof window !== 'undefined' && window.__getSiteFirebaseConfig)
      ? window.__getSiteFirebaseConfig()
      : null);

// Reuse existing app if already initialized on this page
let ordersFirebaseApp = (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length)
  ? firebase.app()
  : ((typeof firebase !== 'undefined' && ordersFirebaseConfig && typeof firebase.initializeApp === 'function')
      ? firebase.initializeApp(ordersFirebaseConfig)
      : null);
let ordersDb = (ordersFirebaseApp && typeof firebase !== 'undefined' && typeof firebase.firestore === 'function')
  ? firebase.firestore()
  : null;
let ordersAuth = (ordersFirebaseApp && typeof firebase !== 'undefined' && typeof firebase.auth === 'function')
  ? firebase.auth()
  : null;
async function ensureOrdersFirebaseReady(){
  if (ordersAuth) return true;
  try {
    if (typeof window.initFirebaseApp === 'function') {
      await window.initFirebaseApp();
    } else if (typeof window.__loadFirebaseCompat === 'function') {
      await window.__loadFirebaseCompat();
    }
  } catch (_) {}
  try {
    if (typeof firebase === 'undefined' || !firebase.auth) return false;
    if ((!firebase.apps || !firebase.apps.length) && ordersFirebaseConfig && typeof firebase.initializeApp === 'function') {
      ordersFirebaseApp = firebase.initializeApp(ordersFirebaseConfig);
    } else if (firebase.apps && firebase.apps.length && typeof firebase.app === 'function') {
      ordersFirebaseApp = firebase.app();
    }
    ordersAuth = typeof firebase.auth === 'function' ? firebase.auth() : null;
    ordersDb = typeof firebase.firestore === 'function' ? firebase.firestore() : null;
  } catch (_) {}
  return !!ordersAuth;
}
function getOrdersCurrentUser(){
  try {
    if (ordersAuth && ordersAuth.currentUser) return ordersAuth.currentUser;
  } catch (_) {}
  try {
    if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length && typeof firebase.auth === 'function') {
      return firebase.auth().currentUser || null;
    }
  } catch (_) {}
  return null;
}
let _ordersAuthWaitPromise = null;
function waitForOrdersCurrentUser(timeoutMs = 1800){
  try {
    const current = getOrdersCurrentUser();
    if (current) return Promise.resolve(current);
  } catch (_) {}
  const authInst = ordersAuth || (() => {
    try {
      return (typeof firebase !== 'undefined' && firebase.auth) ? firebase.auth() : null;
    } catch (_) {
      return null;
    }
  })();
  if (!authInst || typeof authInst.onAuthStateChanged !== 'function') return Promise.resolve(null);
  if (_ordersAuthWaitPromise) return _ordersAuthWaitPromise;
  _ordersAuthWaitPromise = new Promise((resolve) => {
    let done = false;
    let timer = null;
    let unsubscribe = null;
    const finish = (user) => {
      if (done) return;
      done = true;
      try { if (timer) clearTimeout(timer); } catch (_) {}
      try { if (unsubscribe) unsubscribe(); } catch (_) {}
      _ordersAuthWaitPromise = null;
      resolve(user || getOrdersCurrentUser() || null);
    };
    try {
      unsubscribe = authInst.onAuthStateChanged((user) => finish(user || null), () => finish(null));
    } catch (_) {
      finish(null);
      return;
    }
    timer = setTimeout(() => finish(null), Math.max(300, Number(timeoutMs) || 1800));
  });
  return _ordersAuthWaitPromise;
}
async function resolveOrdersCurrentUserForView(){
  let user = getOrdersCurrentUser();
  if (user) return user;
  user = await waitForOrdersCurrentUser(1200);
  if (user) return user;
  try {
    if (typeof window.__ensureAuthReady === 'function') {
      const restored = await window.__ensureAuthReady();
      if (restored) return restored;
    }
  } catch (_) {}
  user = await waitForOrdersCurrentUser(1800);
  if (user) return user;
  try {
    if (typeof tryRestoreAuthFromPostLogin === 'function') {
      const restored = await tryRestoreAuthFromPostLogin();
      if (restored) return restored;
    }
  } catch (_) {}
  try {
    if (typeof restoreAuthFromPostLogin === 'function') {
      const restored = await restoreAuthFromPostLogin();
      if (restored) return restored;
    }
  } catch (_) {}
  return getOrdersCurrentUser();
}

// ========= Manual Worker base (for provider-check) =========
const ORDERS_WORKER_DEFAULT = (function(){
  try {
    if (typeof window !== 'undefined' && window.__getSiteWorkerBaseDefault) {
      return window.__getSiteWorkerBaseDefault({ trailingSlash: true });
    }
  } catch(_) {}
  try { return String(location.origin || '').replace(/\/+$/, '') + '/'; } catch(_) {}
  return '/';
})();
function getManualBase() {
  try {
    if (typeof window !== 'undefined' && window.__getSiteWorkerBase) {
      const base = window.__getSiteWorkerBase({ trailingSlash: true });
      if (base) return base;
    }
  } catch (_) {}
  return ORDERS_WORKER_DEFAULT;
}
function buildProviderCheckUrl({ orderUuid = "", orderId = "" } = {}) {
  const uuid = String(orderUuid || "").trim();
  const id = String(orderId || "").trim();
  try {
    const url = new URL(getManualBase());
    url.searchParams.set("mode", "provider-check");
    if (uuid) url.searchParams.set("order_uuid", uuid);
    else if (id) url.searchParams.set("order_id", id);
    return url.toString();
  } catch (_) {
    if (uuid) return `${ORDERS_WORKER_DEFAULT}?mode=provider-check&order_uuid=${encodeURIComponent(uuid)}`;
    return `${ORDERS_WORKER_DEFAULT}?mode=provider-check&order_id=${encodeURIComponent(id)}`;
  }
}
function getStoredSessionKey(uid) {
  try {
    const raw = localStorage.getItem("sessionKeyInfo");
    const obj = raw ? JSON.parse(raw) : null;
    if (!obj || typeof obj !== "object") return "";
    if (uid && obj.uid && String(obj.uid) !== String(uid)) return "";
    return (obj.sessionKey || "").toString().trim();
  } catch (_) {
    return "";
  }
}

function buildOrdersApiUrl(params = {}) {
  try {
    const url = new URL(getManualBase());
    url.searchParams.set("mode", "client-orders");
    Object.entries(params || {}).forEach(([key, value]) => {
      const text = String(value ?? "").trim();
      if (text) url.searchParams.set(key, text);
    });
    return url.toString();
  } catch (_) {
    const query = new URLSearchParams({ mode: "client-orders" });
    Object.entries(params || {}).forEach(([key, value]) => {
      const text = String(value ?? "").trim();
      if (text) query.set(key, text);
    });
    return `${ORDERS_WORKER_DEFAULT}?${query.toString()}`;
  }
}

async function buildOrdersServerHeaders(uid) {
  const headers = { "Accept": "application/json" };
  const sessionKey = getStoredSessionKey(uid);
  if (sessionKey) headers["X-SessionKey"] = sessionKey;
  const user = getOrdersCurrentUser();
  if (user && typeof user.getIdToken === "function") {
    const idToken = await user.getIdToken();
    if (idToken) headers["Authorization"] = `Bearer ${idToken}`;
  }
  return headers;
}

async function fetchOrdersFromServer(uid, opts = {}) {
  const safeUid = String(uid || "").trim();
  if (!safeUid) return [];
  const params = {};
  if (opts && opts.code) params.orderCode = opts.code;
  if (opts && opts.limit) params.limit = opts.limit;
  const res = await fetch(buildOrdersApiUrl(params), {
    method: "GET",
    headers: await buildOrdersServerHeaders(safeUid),
    cache: "no-store"
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.success === false || data?.ok === false) {
    const err = new Error(data?.error || data?.message || "orders_load_failed");
    err.status = res.status;
    throw err;
  }
  const orders = Array.isArray(data?.orders)
    ? data.orders
    : (data?.byCode && typeof data.byCode === "object" ? Object.values(data.byCode) : []);
  const fetchedAt = Date.now();
  return sortOrdersByTimestamp(orders.map((order) => ({
    ...(order || {}),
    __fetchedAt: fetchedAt
  })));
}

// ========= إعدادات عامة =========
const STATUS_REFRESH_WINDOW_DAYS = 7; // عدد الأيام التي نحدّث فيها حالة الطلب عند كل دخول
const PAGINATION = { size: Number.MAX_SAFE_INTEGER, page: 1, orders: [] };
const ORDER_ANIM_EXIT_MS = 220;
// عند تغيّر الفلاتر/البحث نريد إعادة رسم فوري بدون أنيميشن (لتجنب القلتشات وإعادة التحريك).
let SUPPRESS_ORDER_ANIM = false;
// Keep order details open across re-renders (initial sync, filters, etc.).
const OPEN_ORDER_CODES = new Set();

// تفضيلات العرض (مثل المحفظة)
let ORDERS_FILTER = 'all';   // all | pending | approved | rejected
let SELECTED_DATE_STR = null; // 'YYYY-MM-DD' — التاريخ المختار (محلي)
let SELECTED_DATE_MANUAL = false; // هل اختاره المستخدم يدويًا؟
// وضع التاريخ: يوم واحد أو نطاق
let DATE_MODE = 'single'; // 'single' | 'range'
let DATE_RANGE = { from: null, to: null }; // في حال النطاق
let SEARCH_QUERY = ""; // نص البحث الحر (كود الطلب، الايدي، المزود، ... )

function pad2(n){ return (n<10? '0':'') + n; }
function getTodayStr(){ const d=new Date(); return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; }
function getOrdersMinDateStr(){
  try {
    const uid = getOrdersCurrentUser()?.uid;
    if (!uid) return getTodayStr();
    const byCode = LS.read(uid)?.byCode || {};
    let minMs = 0;
    Object.values(byCode).forEach((order) => {
      const ms = getOrderTimeMs(order);
      if (!ms) return;
      if (!minMs || ms < minMs) minMs = ms;
    });
    if (!minMs) return getTodayStr();
    const d = new Date(minMs);
    return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
  } catch {
    return getTodayStr();
  }
}
function getUiLang(){
  try {
    let raw = "";
    if (window.__I18N__ && typeof window.__I18N__.getLang === "function") raw = window.__I18N__.getLang() || "";
    if (!raw) raw = document.documentElement.getAttribute("data-lang") || document.documentElement.getAttribute("lang") || "ar";
    raw = String(raw || "").toLowerCase();
    if (raw === "off") raw = String(document.documentElement.getAttribute("lang") || "ar").toLowerCase();
    if (raw.startsWith("en")) return "en";
    if (raw.startsWith("fr")) return "fr";
    return "ar";
  } catch {
    return "ar";
  }
}
function getUiLocale(){
  const lang = getUiLang();
  if (lang === "en") return "en-US";
  if (lang === "fr") return "fr-FR";
  return "ar-EG";
}
function ordersT(key, ar, en, fr){
  const lang = getUiLang();
  const fallback = lang === "en"
    ? (en || ar)
    : (lang === "fr" ? (fr || en || ar) : ar);
  try {
    if (window.__I18N__ && typeof window.__I18N__.t === "function") {
      const out = window.__I18N__.t(key, fallback);
      if (out != null && String(out).trim() !== "") return String(out);
    }
  } catch {}
  return fallback;
}
function applyOrdersI18n(scope){
  try {
    if (window.__I18N__ && typeof window.__I18N__.applyTranslations === "function") {
      window.__I18N__.applyTranslations(scope || document);
    }
  } catch {}
}
function formatArDateStr(str){
  try {
    const [y,m,da] = str.split('-').map(Number);
    const d = new Date(y, (m||1)-1, da||1);
    return d.toLocaleDateString(getUiLocale(), { year:'numeric', month:'long', day:'numeric' });
  } catch {
    return str;
  }
}
function isSameDayMs(ms, ymd){ if(!ms||!ymd) return false; try{ const d=new Date(ms); const s=`${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; return s===ymd; }catch{ return false; } }

function escapeHtml(value){
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeJsonParse(str, fallback = null){
  if (!str) return fallback;
  try { return JSON.parse(str); } catch { return fallback; }
}

function formatLinkDisplay(raw){
  const trimmed = String(raw || "").trim();
  if (!trimmed) return "";
  const lowered = trimmed.toLowerCase();
  if (lowered.startsWith("javascript:") || lowered.startsWith("data:")) {
    return `<span>${escapeHtml(trimmed)}</span>`;
  }
  let href = trimmed;
  if (!/^https?:\/\//i.test(trimmed)) {
    if (trimmed.includes(".")) href = `https://${trimmed}`;
    else return `<span>${escapeHtml(trimmed)}</span>`;
  }
  return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(trimmed)}</a>`;
}

function pickTextValue(value){
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function pickFirstTextValue() {
  for (let i = 0; i < arguments.length; i += 1) {
    const text = pickTextValue(arguments[i]);
    if (text) return text;
  }
  return "";
}

function extractProviderResponseFromParsed(parsed){
  if (!parsed) return "";
  if (typeof parsed === "string") {
    const rawText = String(parsed || "").trim();
    if (!rawText) return "";
    const parsedJson = safeJsonParse(rawText, null);
    if (parsedJson && parsedJson !== rawText) {
      return extractProviderResponseFromParsed(parsedJson);
    }
    return rawText;
  }
  if (Array.isArray(parsed)) {
    const responses = parsed.map((entry) => {
      if (!entry || typeof entry !== "object") return "";
      return (
        pickFirstTextValue(
          entry.response,
          entry.note,
          entry.message,
          entry.reason,
          entry.error,
          entry.detail,
          entry.description
        )
      );
    }).filter(Boolean);
    return responses.length ? responses.join("\n") : "";
  }
  if (typeof parsed === "object") {
    const direct = pickFirstTextValue(
      parsed.response,
      parsed.note,
      parsed.message,
      parsed.reason,
      parsed.error,
      parsed.detail,
      parsed.description
    );
    if (direct) return direct;
    const nested =
      pickFirstTextValue(
        parsed.data?.response,
        parsed.data?.note,
        parsed.data?.message,
        parsed.data?.reason,
        parsed.data?.error,
        parsed.data?.detail,
        parsed.data?.description,
        parsed.data?.order?.response,
        parsed.data?.order?.note,
        parsed.data?.order?.message,
        parsed.data?.order?.reason,
        parsed.order?.response,
        parsed.order?.note,
        parsed.order?.message,
        parsed.order?.reason
      );
    if (nested) return nested;
  }
  return "";
}

// إخفاء معلومات حساسة قد تظهر في رد المزود (legacy data) مثل before/after/amount/uuid
function redactProviderUserText(raw) {
  const text = String(raw ?? "").trim();
  if (!text) return "";

  const SENSITIVE_KEYS = new Set(["before", "befor", "after", "amount", "uuid"]);
  const redactObject = (value) => {
    if (value == null) return value;
    if (Array.isArray(value)) return value.map(redactObject);
    if (typeof value !== "object") return value;
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      const key = String(k || "").trim().toLowerCase();
      if (SENSITIVE_KEYS.has(key)) out[k] = "[redacted]";
      else out[k] = redactObject(v);
    }
    return out;
  };

  try {
    const parsed = JSON.parse(text);
    return JSON.stringify(redactObject(parsed));
  } catch {}

  return text.replace(
    /(\b(?:after|befor|before|amount|uuid)\b\s*[:=]\s*)(\"[^\"]*\"|[^\s,]+)/gi,
    "$1[redacted]"
  );
}

function extractProviderCodes(parsed){
  const codes = new Set();
  const consume = (obj) => {
    if (!obj || typeof obj !== "object") return;
    const candidates = [
      obj.code, obj.Code, obj.CODE,
      obj.voucher, obj.voucher_code, obj.voucherCode,
      obj.serial, obj.serial_code, obj.serialCode,
      obj.pin, obj.pin_code, obj.pinCode,
      obj.coupon, obj.coupon_code, obj.couponCode,
      obj.key, obj.activationKey, obj.card, obj.card_number
    ];
    candidates.forEach((v)=>{ const s = pickTextValue(v); if (s) codes.add(s); });
    if (obj.data) consume(obj.data);
    if (obj.order) consume(obj.order);
    if (obj.result) consume(obj.result);
  };
  if (Array.isArray(parsed)) parsed.forEach(consume);
  else consume(parsed);
  return Array.from(codes);
}

function normalizeClientVisibleCodes(value) {
  const codes = new Set();
  const push = (entry) => {
    const text = String(entry ?? "").trim();
    if (text) codes.add(text);
  };
  const visit = (entry, depth = 0) => {
    if (entry == null || depth > 6) return;
    if (Array.isArray(entry)) {
      entry.forEach((item) => visit(item, depth + 1));
      return;
    }
    if (typeof entry === "string" || typeof entry === "number" || typeof entry === "boolean") {
      push(entry);
      return;
    }
    if (!entry || typeof entry !== "object") return;
    extractProviderCodes(entry).forEach(push);
    [
      entry.codes,
      entry.replay_api,
      entry.code,
      entry.pin,
      entry.serial,
      entry.voucher,
      entry.activationCode,
      entry.activation_code,
      entry.token
    ].forEach((item) => visit(item, depth + 1));
  };
  visit(value);
  return Array.from(codes);
}

function resolveOrderReplyText(order) {
  const current = order || {};
  const pub = current.__pub || {};
  const priv = current.__priv || {};

  const directReply = sanitizeProviderReplyForUser(
    pickFirstTextValue(
      current.response,
      pub.response,
      priv.response,
      current.note,
      pub.note,
      priv.note,
      current.reason,
      pub.reason,
      priv.reason,
      current.message,
      pub.message,
      priv.message,
      current.responseText,
      pub.responseText,
      priv.responseText,
      current.adminNote,
      pub.adminNote,
      priv.adminNote,
      current.providerNote,
      pub.providerNote,
      priv.providerNote,
      current.providerResponse,
      pub.providerResponse,
      priv.providerResponse,
      current.error,
      pub.error,
      priv.error,
      current.detail,
      pub.detail,
      priv.detail,
      current.description,
      pub.description,
      priv.description
    )
  );
  if (directReply) return directReply;

  const legacyCodes = normalizeClientVisibleCodes(
    current.codes ??
    pub.codes ??
    current.replay_api ??
    pub.replay_api ??
    null
  );
  if (legacyCodes.length) return legacyCodes.join("\n");

  const providerReply = sanitizeProviderReplyForUser(
    extractProviderResponseFromParsed(priv.providerResponse)
  );
  if (providerReply) return providerReply;

  const normalizedStatus = normOrderStatus(
    current.status ||
    pub.status ||
    priv.status ||
    current.providerStatus ||
    pub.providerStatus ||
    priv.providerStatus ||
    ""
  );
  if (normalizedStatus === "rejected") {
    return ordersT(
      "orders.reply.rejectedFallback",
      "\u0639\u0630\u0631\u064b\u0627\u060c \u062a\u0645 \u0631\u0641\u0636 \u0637\u0644\u0628\u0643.",
      "Your order was rejected.",
      "Votre commande a ete refusee."
    );
  }
  return "";
}

function normalizeOffersArray(raw){
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    const parsed = safeJsonParse(raw, null);
    if (Array.isArray(parsed)) return parsed;
  }
  return [];
}

function isValidPlayerId(value) {
  const v = String(value ?? "").trim();
  if (!v) return false;
  if (v === "-" || v === "--") return false;
  if (/^(?:n\/a|na|null|undefined)$/i.test(v)) return false;
  if (/^(?:غير\s*متوفر|غير\s*موجود|غير\s*مطلوب)$/i.test(v)) return false;
  return true;
}

function isPlayerLikeFieldKey(value) {
  const key = String(value || "").trim();
  if (!key) return false;
  const lowered = key.toLowerCase();
  if (
    /^(player(_)?id|playerid|player|playernumber|player_number|uid|user(_)?id|userid|user|account(_)?id|accountid|account|id|player_id)$/i
      .test(lowered)
  ) return true;
  if (/please\s*enter.*player|enter.*player\s*(id|number)/i.test(lowered)) return true;
  return /player(_)?id|player\s*number|uid|user(_)?id|account(_)?id|(^|[^a-z])id([^a-z]|$)|ايدي|آيدي|معرف/.test(lowered);
}

function extractPlayerIdFromPlayerFields(raw) {
  if (!raw) return "";
  let parsed = raw;
  if (typeof parsed === "string") parsed = safeJsonParse(parsed, null);
  if (!parsed || typeof parsed !== "object") return "";

  const readValue = (value) => {
    const text = String(value ?? "").trim();
    return isValidPlayerId(text) ? text : "";
  };

  if (Array.isArray(parsed)) {
    for (const entry of parsed) {
      if (!entry || typeof entry !== "object") continue;
      const key = entry.key ?? entry.name ?? entry.field ?? entry.id ?? "";
      if (!isPlayerLikeFieldKey(key)) continue;
      const value = entry.value ?? entry.val ?? entry.data ?? entry.input ?? entry.text ?? "";
      const hit = readValue(value);
      if (hit) return hit;
    }
    return "";
  }

  for (const key of Object.keys(parsed)) {
    if (!isPlayerLikeFieldKey(key)) continue;
    const hit = readValue(parsed[key]);
    if (hit) return hit;
  }
  return "";
}

function normalizeOrderFieldLabel(value) {
  const rawKey = String(value || "").trim();
  if (!rawKey) return "";
  const normalized = rawKey.toLowerCase().replace(/[\s_-]+/g, "");
  const known = {
    playerid: "معرف اللاعب",
    userid: "معرف المستخدم",
    uid: "UID",
    id: "معرف اللاعب",
    user: "معرف المستخدم",
    accountid: "معرف الحساب",
    account: "معرف الحساب",
    server: "السيرفر",
    region: "المنطقة",
    zone: "المنطقة",
    email: "البريد",
    phone: "الهاتف",
    whatsapp: "واتساب",
    link: "الرابط",
    url: "الرابط",
    quantity: "الكمية",
    qty: "الكمية"
  };
  if (known[normalized]) return known[normalized];
  return rawKey.replace(/[_-]+/g, " ").trim();
}

function normalizeOrderFieldLookupKey(value) {
  const safeKey = String(value || "").trim();
  if (!safeKey) return "";
  const compactKey = safeKey.toLowerCase().replace(/[\s_-]+/g, "");
  if (["playerid", "userid", "uid", "accountid", "player", "playernumber", "playeruid", "id", "user", "account"].includes(compactKey)) {
    return "playerid";
  }
  if (/[اأإآ]يدي|معرف|لاعب|حساب/i.test(safeKey) && !/بريد|ايميل|email/i.test(safeKey)) {
    return "playerid";
  }
  if (["quantity", "qty", "count"].includes(compactKey)) return "quantity";
  return compactKey;
}

function normalizeOrderFieldValue(value) {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeOrderFieldValue(entry)).filter(Boolean).join(" / ");
  }
  if (typeof value === "object") {
    return normalizeOrderFieldValue(
      value.value ??
      value.val ??
      value.data ??
      value.input ??
      value.text ??
      value.label ??
      ""
    );
  }
  return "";
}

function mergeOrderSubmittedFields(target, source) {
  if (!source) return target;
  let parsed = source;
  if (typeof parsed === "string") parsed = safeJsonParse(parsed, null);
  if (!parsed || typeof parsed !== "object") return target;

  const assign = (key, value) => {
    const safeKey = String(key || "").trim();
    const safeValue = normalizeOrderFieldValue(value);
    if (!safeKey || !safeValue) return;
    if (Object.prototype.hasOwnProperty.call(target, safeKey) && String(target[safeKey] || "").trim()) return;
    target[safeKey] = safeValue;
  };

  if (Array.isArray(parsed)) {
    parsed.forEach((entry) => {
      if (!entry || typeof entry !== "object") return;
      assign(entry.key ?? entry.name ?? entry.field ?? entry.id ?? entry.label ?? "", entry.value ?? entry.val ?? entry.data ?? entry.input ?? entry.text ?? "");
    });
    return target;
  }

  Object.keys(parsed).forEach((key) => assign(key, parsed[key]));
  return target;
}

function collectOrderSubmittedFields(order) {
  const current = order || {};
  const pub = current.__pub || {};
  const priv = current.__priv || {};
  const out = {};
  [
    current.data,
    current.submittedFields,
    current.submitted_fields,
    current.playerFields,
    current.player_fields,
    current.fields,
    current.inputs,
    pub.data,
    pub.submittedFields,
    pub.submitted_fields,
    pub.playerFields,
    pub.player_fields,
    pub.fields,
    pub.inputs,
    priv.data,
    priv.submittedFields,
    priv.submitted_fields,
    priv.playerFields,
    priv.player_fields,
    priv.fields,
    priv.inputs
  ].forEach((source) => mergeOrderSubmittedFields(out, source));

  const offersList = normalizeOffersArray(current.offers || current.offersList || current.offerItems);
  offersList.forEach((offer) => {
    mergeOrderSubmittedFields(out, offer?.data);
    mergeOrderSubmittedFields(out, offer?.submittedFields);
    mergeOrderSubmittedFields(out, offer?.submitted_fields);
    mergeOrderSubmittedFields(out, offer?.playerFields);
    mergeOrderSubmittedFields(out, offer?.player_fields);
    mergeOrderSubmittedFields(out, offer?.fields);
    mergeOrderSubmittedFields(out, offer?.inputs);
  });
  return out;
}

function normalizeOrderRequiredFields(raw) {
  if (!raw) return [];
  let parsed = raw;
  if (typeof parsed === "string") parsed = safeJsonParse(parsed, raw);
  if (Array.isArray(parsed)) {
    return parsed
      .map((entry) => String(entry || "").trim())
      .filter(Boolean);
  }
  if (parsed && typeof parsed === "object") {
    return Object.keys(parsed).map((key) => String(key || "").trim()).filter(Boolean);
  }
  const text = String(parsed || "").trim();
  return text ? [text] : [];
}

function collectOrderRequiredFields(order) {
  const current = order || {};
  const pub = current.__pub || {};
  const priv = current.__priv || {};
  const out = [];
  const seen = new Set();
  const push = (value) => {
    const text = String(value || "").trim();
    if (!text || seen.has(text)) return;
    seen.add(text);
    out.push(text);
  };
  [
    current.requiredFields,
    current.required_fields,
    pub.requiredFields,
    pub.required_fields,
    priv.requiredFields,
    priv.required_fields
  ].forEach((source) => {
    normalizeOrderRequiredFields(source).forEach(push);
  });
  const offersList = normalizeOffersArray(current.offers || current.offersList || current.offerItems);
  offersList.forEach((offer) => {
    normalizeOrderRequiredFields(offer?.requirements).forEach(push);
  });
  return out;
}

function buildOrderInputDisplayPairs({
  submittedFields = null,
  requiredFields = [],
  playerIdValue = "",
  playerIdLabel = ""
} = {}) {
  const source = submittedFields && typeof submittedFields === "object" ? submittedFields : {};
  const pairs = [];
  const seenLookup = new Set();

  const push = (label, value, lookupKey = "") => {
    const safeLabel = String(label || "").trim();
    const safeValue = normalizeOrderFieldValue(value);
    const safeLookup = String(lookupKey || "").trim();
    if (!safeLabel || !safeValue) return;
    if (safeLookup && seenLookup.has(safeLookup)) return;
    if (safeLookup) seenLookup.add(safeLookup);
    pairs.push([safeLabel, safeValue]);
  };

  const rawKeys = Object.keys(source);
  const findSubmittedValue = (needle) => {
    const lookupNeedle = normalizeOrderFieldLookupKey(needle);
    if (!lookupNeedle) return null;
    for (let i = 0; i < rawKeys.length; i += 1) {
      const rawKey = rawKeys[i];
      if (normalizeOrderFieldLookupKey(rawKey) !== lookupNeedle) continue;
      const value = normalizeOrderFieldValue(source[rawKey]);
      if (!value) continue;
      return { key: rawKey, value, lookupKey: lookupNeedle };
    }
    return null;
  };

  if (isValidPlayerId(playerIdValue)) {
    push(playerIdLabel || "ايدي اللاعب", playerIdValue, "playerid");
  }

  (Array.isArray(requiredFields) ? requiredFields : []).forEach((requiredKey) => {
    const lookupKey = normalizeOrderFieldLookupKey(requiredKey);
    if (!lookupKey || lookupKey === "quantity") return;
    if (lookupKey === "playerid") {
      if (isValidPlayerId(playerIdValue)) push(playerIdLabel || "ايدي اللاعب", playerIdValue, "playerid");
      return;
    }
    const hit = findSubmittedValue(requiredKey);
    if (!hit) return;
    push(normalizeOrderFieldLabel(requiredKey), hit.value, lookupKey);
  });

  rawKeys.forEach((rawKey) => {
    const lookupKey = normalizeOrderFieldLookupKey(rawKey);
    if (!lookupKey || lookupKey === "quantity" || lookupKey === "playerid") return;
    const value = normalizeOrderFieldValue(source[rawKey]);
    if (!value) return;
    push(normalizeOrderFieldLabel(rawKey), value, lookupKey);
  });

  return pairs;
}

function isInternalProviderPlaceholder(value) {
  const text = String(value ?? "").trim();
  if (!text) return true;
  const normalized = text.toLowerCase().replace(/[\s-]+/g, "_");
  const direct = new Set([
    "manual_telegram_order",
    "telegram",
    "pending",
    "processing",
    "in_progress",
    "queued",
    "queue",
    "provider_pending",
    "pending_provider",
    "queue_pending",
    "queued_pending",
    "order_pending_internal"
  ]);
  if (direct.has(normalized)) return true;

  // token-like internal values (without human sentence), e.g. manual_telegram_order_v2
  if (/^[a-z0-9_:.+-]+$/i.test(text) && /manual[_:]?telegram|telegram[_:]?order/i.test(normalized)) {
    return true;
  }
  return false;
}

function sanitizeProviderReplyForUser(raw) {
  const base = String(raw ?? "").trim();
  if (!base) return "";
  if (isInternalProviderPlaceholder(base)) return "";

  let cleaned = redactProviderUserText(base);
  cleaned = String(cleaned ?? "").trim();
  if (!cleaned) return "";
  if (isInternalProviderPlaceholder(cleaned)) return "";

  // If a JSON reply only carries internal placeholders, hide it.
  try {
    const parsed = JSON.parse(cleaned);
    if (parsed && typeof parsed === "object") {
      const candidate =
        pickTextValue(parsed.message) ||
        pickTextValue(parsed.response) ||
        pickTextValue(parsed.note) ||
        pickTextValue(parsed.status) ||
        pickTextValue(parsed.state);
      if (candidate && isInternalProviderPlaceholder(candidate)) return "";
    }
  } catch (_) {}

  // Remove repeated identical lines from provider reply.
  const lines = cleaned
    .split(/\r?\n+/)
    .map((line) => String(line || "").trim())
    .filter(Boolean);
  if (!lines.length) return "";
  const seen = new Set();
  const deduped = [];
  for (const line of lines) {
    const key = line.replace(/\s+/g, " ").trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push(line);
  }
  const finalText = deduped.join("\n").trim();
  if (!finalText) return "";
  if (isInternalProviderPlaceholder(finalText)) return "";
  return finalText;
}

function splitOffersText(raw){
  const text = String(raw || "").replace(/\r/g, "").trim();
  if (!text) return [];
  let parts = text.split("â€¢").map((p) => p.trim()).filter(Boolean);
  if (parts.length <= 1 && text.includes("\n")) {
    parts = text.split("\n").map((p) => p.trim()).filter(Boolean);
  }
  return parts
    .map((p) => p.replace(/^\s*-\s*/, "").trim())
    .filter(Boolean);
}

function normalizeGameLookupKey(value){
  return String(value || "")
    .toLowerCase()
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ظٹ")
    .replace(/ؤ/g, "ظˆ")
    .replace(/ئ/g, "ظٹ")
    .replace(/ة/g, "ه")
    .replace(/[\u064B-\u0652\u0640]/g, "")
    .replace(/[\s_:\-|>\/\\]+/g, "");
}

function normalizeGameLabelPart(value){
  var raw = String(value || "").trim();
  if (!raw) return "";
  var stripped = raw.replace(
    /^(\d+)\s*[:._-]?\s*(?=(?:products?|items?|categories?|sections?|services?|offers?|topups?|المنتجات|منتجات|الاقسام|أقسام|خدمات|العروض))/i,
    ""
  ).trim();
  return stripped || raw;
}

function mapGameDisplayName(value){
  const raw = String(value || "").trim();
  if (!raw) return "";
  const parts = raw
    .split(/::|:|>|\/|\|/)
    .map((p) => normalizeGameLabelPart(p))
    .filter(Boolean);
  const searchParts = parts.length ? parts.slice().reverse() : [normalizeGameLabelPart(raw)];
  for (const candidate of searchParts) {
    if (!candidate) continue;
    if (!/[a-zA-Z\u0600-\u06FF]/.test(candidate)) continue;
    if (isGenericGameCatalogLabel(candidate)) continue;
    return candidate;
  }
  return "";
}

function isGenericGameCatalogLabel(value){
  const norm = normalizeGameLookupKey(normalizeGameLabelPart(value));
  if (!norm) return true;
  if (/^\d+$/.test(norm)) return true;
  if (/^\d+(?:products?|items?|categories?|sections?|services?|offers?|topups?)$/.test(norm)) return true;
  return [
    "games",
    "game",
    "manual",
    "catalog",
    "category",
    "categories",
    "section",
    "sections",
    "product",
    "products",
    "item",
    "items",
    "service",
    "services",
    "offer",
    "offers",
    "topup",
    "topups",
    "الالعاب",
    "العاب",
    "قسمالالعاب",
    "الاقسام",
    "اقسام",
    "قسم",
    "المنتجات",
    "منتجات",
    "الخدمات",
    "خدمات",
    "العروض",
    "عروض",
    "طلباتيدوية"
  ].includes(norm);
}

function inferGameDisplayFromText(raw){
  const text = String(raw || "").toLowerCase();
  if (!text.trim()) return "";
  if (/(smm|سوشيال|followers|likes|views|رشق)/i.test(text)) return "سوشيال ميديا";
  return "";
}

function deriveGameFromOfferLikeText(raw){
  var text = String(raw || "").trim();
  if (!text) return "";
  if (!/(\d|gold|gems?|diamonds?|jewels?|uc|cp|coins?|points?|شدات?|جواهر|جوهرة|ذهب)/i.test(text)) {
    return "";
  }
  var cleaned = text
    .replace(/\([^)]*\d[^)]*\)\s*$/g, "")
    .replace(/\b\d+(?:[.,]\d+)?\s*(?:gold|gems?|diamonds?|jewels?|uc|cp|coins?|points?)\b.*$/i, "")
    .replace(/\b(?:gold|gems?|diamonds?|jewels?|uc|cp|coins?|points?)\b.*$/i, "")
    .replace(/\d+(?:[.,]\d+)?\s*(?:شدات?|جواهر|جوهرة|ذهب)\b.*$/i, "")
    .trim();
  if (!cleaned) return "";
  if (normalizeGameLookupKey(cleaned) === normalizeGameLookupKey(text)) return "";
  var mapped = mapGameDisplayName(cleaned) || cleaned;
  if (!mapped || isGenericGameCatalogLabel(mapped)) return "";
  return mapped;
}

function resolveOrderGameDisplay(order){
  const o = order || {};
  const pub = o.__pub || {};
  const priv = o.__priv || {};
  const offersList = normalizeOffersArray(o.offers || o.offersList || o.offerItems);
  const offerNameKeys = new Set();
  offersList.forEach((entry) => {
    if (!entry || typeof entry !== "object") return;
    const txt = String(
      entry?.name || entry?.title || entry?.label || entry?.offer || entry?.offerName || entry?.productName || entry?.product || ""
    ).trim();
    const key = normalizeGameLookupKey(txt);
    if (key) offerNameKeys.add(key);
  });
  splitOffersText(o["العروض"] || o.offersText || "").forEach((part) => {
    const key = normalizeGameLookupKey(part);
    if (key) offerNameKeys.add(key);
  });
  const providerRaw = String(
    o.provider ?? o.game ?? pub.provider ?? pub.game ?? priv.provider ?? priv.game ?? ""
  ).trim().toLowerCase();
  if (providerRaw === "smm") return "سوشيال ميديا";

  const directCandidates = [
    o.gameName, o.game_name, o.gameLabel, o.game_label, o.game,
    o.gameSlug, o.game_slug, o.categoryName, o.category_name, o.category,
    pub.gameName, pub.game_name, pub.game, pub.gameSlug, pub.game_slug, pub.categoryName, pub.category_name, pub.category,
    priv.gameName, priv.game_name, priv.game, priv.gameSlug, priv.game_slug, priv.categoryName, priv.category_name, priv.category
  ];
  for (const val of directCandidates) {
    const rawVal = String(val || "").trim();
    if (!rawVal) continue;
    const mapped = mapGameDisplayName(val);
    if (!mapped) continue;
    if (isGenericGameCatalogLabel(mapped) || isGenericGameCatalogLabel(val)) continue;
    const mappedKey = normalizeGameLookupKey(mapped);
    const rawKey = normalizeGameLookupKey(rawVal);
    if ((mappedKey && offerNameKeys.has(mappedKey)) || (rawKey && offerNameKeys.has(rawKey))) {
      const derived = deriveGameFromOfferLikeText(rawVal) || deriveGameFromOfferLikeText(mapped);
      if (derived) return derived;
      continue;
    }
    return mapped;
  }

  for (const entry of offersList) {
    const txt = String(
      entry?.name || entry?.title || entry?.label || entry?.offer || entry?.offerName || entry?.productName || entry?.product || ""
    ).trim();
    const inferred = inferGameDisplayFromText(txt);
    if (inferred) return inferred;
    const derived = deriveGameFromOfferLikeText(txt);
    if (derived) return derived;
  }

  const offersText = String(o["العروض"] || o.offersText || "").trim();
  const inferredFromOffers = inferGameDisplayFromText(offersText);
  if (inferredFromOffers) return inferredFromOffers;

  return "";
}

function formatOffersHtml(order){
  const offersList = normalizeOffersArray(order?.offers || order?.offersList || order?.offerItems);
  if (offersList.length) {
    const items = offersList.map((entry) => {
      if (!entry || typeof entry !== "object") return "";
      const name = entry.name || entry.title || entry.label || entry.offer || entry.offerName || entry.productName || entry.product || "";
      const qty = entry.qty ?? entry.quantity ?? entry.count;
      if (!name && (qty == null || qty === "")) return "";
      const safeName = escapeHtml(String(name || "-").trim());
      const qtyText = (qty == null || qty === "") ? "" : `<div class="offer-qty">الكمية: ${escapeHtml(String(qty))}</div>`;
      return `<li class="offer-item"><div class="offer-name">${safeName}</div>${qtyText}</li>`;
    }).filter(Boolean).join("");
    return items ? `<ul class="offers-list">${items}</ul>` : "";
  }
  const offersText = order?.["العروض"] || order?.offersText || "";
  const parts = splitOffersText(offersText);
  if (!parts.length) return "";
  const items = parts.map((part) => `<li>${escapeHtml(part)}</li>`).join("");
  return `<ul style="padding-right:20px;">${items}</ul>`;
}

function getCurrencyContext(){
  let rates = null;
  let base = null;
  let selected = null;
  try { rates = window.__CURRENCIES__ || null; } catch {}
  try { base = window.__CURRENCY_BASE__ || null; } catch {}
  try {
    if (typeof window.getSelectedCurrencyCode === "function") {
      selected = window.getSelectedCurrencyCode();
    }
  } catch {}
  if (!selected) {
    try { selected = localStorage.getItem("currency:selected"); } catch {}
  }
  if (selected) selected = String(selected).toUpperCase();
  if (base) base = String(base).toUpperCase();
  return { rates, base, selected };
}

function normalizeCurrencyCode(value, rates){
  if (!value || !rates) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const upper = raw.toUpperCase();
  if (rates[upper]) return upper;
  const rawLower = raw.toLowerCase();
  for (const cur of Object.values(rates)) {
    if (!cur || typeof cur !== "object") continue;
    const code = String(cur.code || "").toUpperCase();
    const symbol = String(cur.symbol || "").trim();
    const nameAr = String(cur.nameAr || "").trim();
    const name = String(cur.name || "").trim();
    if (code && rawLower === code.toLowerCase()) return code;
    if (symbol && raw === symbol) return code || null;
    if (nameAr && raw === nameAr) return code || null;
    if (name && rawLower === name.toLowerCase()) return code || null;
  }
  return null;
}

function convertAmountWithRates(amount, fromCode, toCode, rates, base){
  const n = Number(amount);
  if (!Number.isFinite(n)) return null;
  if (!fromCode || !toCode || !rates) return null;
  const baseCode = base || "";
  if (fromCode === toCode) return n;
  const rFrom = (fromCode === baseCode) ? 1 : Number(rates[fromCode]?.rate);
  const rTo = (toCode === baseCode) ? 1 : Number(rates[toCode]?.rate);
  if (!Number.isFinite(rFrom) || rFrom <= 0) return null;
  if (!Number.isFinite(rTo) || rTo <= 0) return null;
  const baseAmt = (fromCode === baseCode) ? n : (n / rFrom);
  return (toCode === baseCode) ? baseAmt : (baseAmt * rTo);
}

function getCurrencySymbol(code, rates){
  if (!code) return "";
  const cur = rates && rates[code];
  return (cur && (cur.symbol || cur.code)) ? (cur.symbol || cur.code) : code;
}

function formatAmountDisplay(totalStr, total, currency){
  const parseAmount = (value) => {
    if (value == null || value === "") return null;
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const cleaned = value.replace(/,/g, "").trim();
      if (!cleaned) return null;
      const num = Number(cleaned);
      if (Number.isFinite(num)) return num;
    }
    return null;
  };
  const fromStr = parseAmount(totalStr);
  const fromTotal = parseAmount(total);
  const rawAmount = fromStr != null ? fromStr : fromTotal;
  const ctx = getCurrencyContext();
  const rates = ctx.rates || null;
  const baseCode = normalizeCurrencyCode(ctx.base, rates) || "USD";
  const sourceCode = normalizeCurrencyCode(currency, rates) || baseCode;
  const selectedCode = normalizeCurrencyCode(ctx.selected, rates) || sourceCode;
  const displayCode = (rates && rates[selectedCode]) ? selectedCode : sourceCode;
  const displaySymbol = getCurrencySymbol(displayCode, rates) || displayCode || "USD";
  if (rawAmount != null && Number.isFinite(rawAmount)) {
    let amount = rawAmount;
    const converted = convertAmountWithRates(rawAmount, sourceCode, displayCode, rates, baseCode);
    if (converted != null && Number.isFinite(converted)) amount = converted;
    return `${amount.toFixed(3)} ${displaySymbol}`.trim();
  }
  const fallback = (totalStr != null && String(totalStr).trim())
    ? String(totalStr).trim()
    : ((total != null && String(total).trim()) ? String(total).trim() : "-");
  if (fallback === "-") return "-";
  if (/[A-Z]{3,8}/.test(fallback) || /[$â‚¬آ£]|ر\.س|د\.إ|د\.ظƒ|ر\.ق|د\.ب|ر\.ع|د\.ا/.test(fallback)) return fallback;
  return `${fallback} ${displaySymbol}`.trim();
}

// نص زر التاريخ: إن كان الاختيار يدويًا لا نعرض "اليوم" حتى لو كان نفس يوم اليوم
function getDateChipText(){
  const dateLabel = ordersT("orders.dateLabel", "التاريخ", "Date", "Date");
  if (DATE_MODE === 'range'){
    // لا نعرض تفاصيل النطاق في الأعلى — فقط عنوان مختصر
    return dateLabel;
  }
  const today = getTodayStr();
  const ymd = SELECTED_DATE_STR || today;
  return `${dateLabel}: ${formatArDateStr(ymd)}`;
}

function normOrderStatus(s){
  const v = String(s || '').toLowerCase();
  if (
    v.includes('تم_الشحن') ||
    v.includes('تم الشحن') ||
    v.includes('shipped') ||
    v.includes('تم-الشحن') ||
    v.includes('completed') ||
    v.includes('success') ||
    v.includes('partial') ||
    v.includes('مكتمل') ||
    v.includes('مكتمل جزئ')
  ) return 'approved';
  if (
    v.includes('reject') ||
    v.includes('رفض') ||
    v.includes('مرفوض') ||
    v.includes('cancel') ||
    v.includes('ملغي') ||
    v.includes('fail')
  ) return 'rejected';
  return 'pending';
}

function formatStatusLabel(value){
  const raw = String(value || '').trim();
  if (!raw) return ordersT("orders.status.processing", "قيد المعالجة", "Processing", "En cours");
  if (raw === 'تم_الشحن') return ordersT("orders.status.shipped", "تم الشحن", "Shipped", "Expedie");
  const normalized = raw.toLowerCase();
  if (normalized.includes('مكتمل') || normalized === 'completed' || normalized === 'success') {
    return ordersT("orders.status.completed", "مكتمل", "Completed", "Termine");
  }
  if (normalized === 'partial') return ordersT("orders.status.partial", "مكتمل جزئياً", "Partially completed", "Partiellement termine");
  if (normalized.includes('ملغي') || normalized === 'canceled' || normalized === 'cancelled') {
    return ordersT("orders.status.cancelled", "ملغي", "Cancelled", "Annule");
  }
  if (normalized.includes('مرفوض') || normalized.startsWith('reject') || normalized === 'failed' || normalized === 'fail') {
    return ordersT("orders.status.rejected", "مرفوض", "Rejected", "Rejete");
  }
  if (
    normalized.includes('pending') ||
    normalized.includes('processing') ||
    normalized.includes('progress') ||
    normalized.includes('running')
  ) return ordersT("orders.status.inProgress", "قيد التنفيذ", "In progress", "En progression");
  return raw;
}

function getOrderTimeMs(o){
  try {
    const t = o && o.timestamp; if (!t) return 0;
    if (t.toDate) return t.toDate().getTime();
    if (typeof t === 'object' && t.seconds) return (t.seconds * 1000) | 0;
    const ms = new Date(t).getTime();
    return Number.isFinite(ms) ? ms : 0;
  } catch { return 0; }
}

function applyOrdersFilter(list){
  if (ORDERS_FILTER === 'all') return list;
  return (list || []).filter(o => {
    const n = normOrderStatus(o?.status);
    if (ORDERS_FILTER === 'approved') return n === 'approved';
    if (ORDERS_FILTER === 'rejected') return n === 'rejected';
    return n === 'pending';
  });
}

function applyDateFilter(list){
  const arr = list || [];
  if (DATE_MODE === 'range'){
    const f = DATE_RANGE?.from, t = DATE_RANGE?.to;
    if (f && t){
      const from = f <= t ? f : t;
      const to = t >= f ? t : f;
      return arr.filter(o => {
        const ms = getOrderTimeMs(o); if(!ms) return false;
        const d = new Date(ms); const ymd = `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
        return (ymd >= from && ymd <= to);
      });
    }
    if (f && !t){
      return arr.filter(o => isSameDayMs(getOrderTimeMs(o), f));
    }
    return arr; // لا فلترة إن لم يُحدَّد شيء
  }
  const ymd = SELECTED_DATE_STR || getTodayStr();
  return arr.filter(o => isSameDayMs(getOrderTimeMs(o), ymd));
}

// فلترة نصية (كود الطلب، الايدي، المزود، المزود رقم الطلب، العروض)
function normalizeSearchText(v){
  return String(v || "")
    .toLowerCase()
    .replace(/[\u064B-\u0652\u0640]/g, "") // إزالة التشكيل
    .trim();
}

function orderMatchesSearch(o, qNorm){
  if (!qNorm) return true;
  const fields = [];
  fields.push(o?.code);
  fields.push(o?.playerId || o?.playerID);
  fields.push(o?.player || o?.playerName || o?.player_name || o?.playerUid || o?.player_uid);
  if (o?.__pub && typeof o.__pub === 'object'){
    fields.push(o.__pub.player);
    fields.push(o.__pub.playerId || o.__pub.playerID);
    fields.push(o.__pub.gameName || o.__pub.game);
  }
  if (o?.__priv && typeof o.__priv === 'object'){
    fields.push(o.__priv.gameName || o.__priv.game || o.__priv.serviceName);
  }
  fields.push(o?.gameName || o?.game || o?.title);
  // المبلغ
  const amtRaw = (o?.total ?? o?.amount ?? o?.price ?? o?.cost);
  const amtNum = Number(amtRaw);
  const symMap = { USD: "$", EUR: "â‚¬", GBP: "آ£", SAR: "ر.س", AED: "د.إ", KWD: "د.ظƒ", QAR: "ر.ق", BHD: "د.ب", OMR: "ر.ع", JOD: "د.ا" };
  const curCode = (o?.currency || "").toUpperCase();
  const sym = symMap[curCode] || "";
  if (Number.isFinite(amtNum)) {
    fields.push(String(amtNum));
    fields.push(amtNum.toFixed(3));
    fields.push(`${amtNum}`.replace('.', ',')); // دعم فواصل
    if (curCode) {
      fields.push(`${amtNum.toFixed(3)} ${curCode}`);
      if (sym) fields.push(`${sym}${amtNum.toFixed(3)}`);
    }
  }
  if (o?.currency) fields.push(o.currency);
  if (o?.totalStr || o?.totalDisplay) fields.push(o.totalStr || o.totalDisplay);

  const normFields = fields.filter(Boolean).map(normalizeSearchText);
  const isDigitsOnly = /^[0-9]+$/.test(qNorm);
  if (isDigitsOnly) {
    return normFields.some(f => f === qNorm || f.includes(qNorm));
  }
  return normFields.some(f => f.includes(qNorm));
}

function applySearchFilter(list){
  const q = normalizeSearchText(SEARCH_QUERY);
  if (!q) return list || [];
  return (list || []).filter(o => orderMatchesSearch(o, q));
}

// لم يعد هناك فرز زمني قابل للتبديل

function recomputeAndRender(){
  const uid = getOrdersCurrentUser()?.uid;
  if (!uid) return;
  SUPPRESS_ORDER_ANIM = true;
  try {
    renderOrders(cacheToSortedArray(uid));
  } finally {
    SUPPRESS_ORDER_ANIM = false;
  }
}

/* ===================== Theme (اختياري) ===================== */
document.addEventListener('DOMContentLoaded', () => {
  try {
    if (localStorage.getItem('theme') === 'dark') {
      document.body.classList.add('dark-mode');
    }
  } catch (e) {}
});

let __ORDERS_AUTH_BOUND__ = false;
let _ordersBootstrapPromise = null;
let _ordersBootstrapUid = "";
let _ordersRealtimeUid = "";
function isOrdersViewActive(){
  try{
    const path = (location.pathname || '').toLowerCase();
    if (path.endsWith('talabat.html')) return true;
    const hash = (location.hash || '').toLowerCase();
    return hash === '#/orders';
  }catch(_){ return false; }
}
function ordersUiReady(){
  return !!(document.getElementById('ordersToolbar') && document.getElementById('ordersList'));
}
function getCachedOrdersForUser(uid){
  const safeUid = String(uid || "").trim();
  if (!safeUid) return [];
  return cacheToSortedArray(safeUid);
}
function showOrdersCachedState(uid, opts){
  const ordersList = document.getElementById("ordersList");
  if (!ordersList) return;
  const cached = getCachedOrdersForUser(uid);
  if (cached.length) {
    renderOrders(cached);
    return;
  }
  if (opts && opts.skeleton) {
    ordersList.innerHTML = "";
    showOrdersSkeleton(1);
  }
}
function ensureOrdersRealtimeReady(uid, opts){
  const safeUid = String(uid || "").trim();
  if (!safeUid) return Promise.resolve([]);
  const force = !!(opts && opts.force);
  if (!force && _ordersBootstrapPromise && _ordersBootstrapUid === safeUid) {
    return _ordersBootstrapPromise;
  }
  if (!force && _ordersUnsub && _ordersRealtimeUid === safeUid) {
    const cachedState = LS.read(safeUid);
    if (cachedState && Date.now() - Number(cachedState.lastSync || 0) < 15000) {
      showOrdersCachedState(safeUid, { skeleton: false });
      return Promise.resolve(getCachedOrdersForUser(safeUid));
    }
  }
  showOrdersCachedState(safeUid, { skeleton: true });
  const task = Promise.resolve().then(function(){
    listenOrdersRealtime(safeUid, { force: force });
    return getCachedOrdersForUser(safeUid);
  }).finally(function(){
    if (_ordersBootstrapPromise === task) _ordersBootstrapPromise = null;
  });
  _ordersBootstrapUid = safeUid;
  _ordersBootstrapPromise = task;
  return task;
}
// عند تحقق تسجيل الدخول (يُفعّل فقط عندما تكون صفحة الطلبات نشطة)
async function bindOrdersAuthListener(){
  if (__ORDERS_AUTH_BOUND__) return;
  __ORDERS_AUTH_BOUND__ = true;
  const firebaseReady = await ensureOrdersFirebaseReady();
  if (!firebaseReady) {
    console.info('orders: firebase not ready yet');
    __ORDERS_AUTH_BOUND__ = false;
    return;
  }
  if (!ordersAuth || typeof ordersAuth.onAuthStateChanged !== 'function') {
    console.info('orders: firebase auth not configured yet');
    __ORDERS_AUTH_BOUND__ = false;
    return;
  }
  ordersAuth.onAuthStateChanged(async user => {
    if (!isOrdersViewActive()) return;
    if (!ordersUiReady()) return;
    if (!user) {
      user = await resolveOrdersCurrentUserForView();
    }
    if (!user) {
      try { if (_ordersUnsub) { _ordersUnsub(); _ordersUnsub = null; } } catch {}
      _ordersRealtimeUid = "";
      _ordersBootstrapUid = "";
      _ordersBootstrapPromise = null;
      alert("يجب تسجيل الدخول أولاً");
      window.location.href = "index.html";
      return;
    }
    // إعادة الضبط إلى القيم الافتراضية لكل جلسة جديدة
    ORDERS_FILTER = 'all';
    DATE_MODE = 'single';
    DATE_RANGE = { from: null, to: null };
    SELECTED_DATE_STR = getTodayStr();
    SELECTED_DATE_MANUAL = false;
    SEARCH_QUERY = '';
    const chipsWrap = document.getElementById('ordersToolbar');
    if (chipsWrap){
      chipsWrap.querySelectorAll('.chip').forEach(c=>c.classList.toggle('active', (c.dataset.filter||'all')===ORDERS_FILTER));
      const dc = document.getElementById('dateChip');
      if (dc){ dc.textContent = getDateChipText(); }
    }
    const searchEl = document.getElementById('ordersSearch');
    if (searchEl) searchEl.value = '';
    showOrdersCachedState(user.uid, { skeleton: true });
    await ensureOrdersRealtimeReady(user.uid, { force: false });
  });
}

// تهيئة صفحة الطلبات عند الطلب (مناسبة للـ SPA)
window.__initOrdersPage = function(){
  if (!ordersUiReady()) return false;
  if (window.__ORDERS_PAGE_ACTIVE__) return true;
  window.__ORDERS_PAGE_ACTIVE__ = true;
  try { syncToolbarUI(); } catch(_){}
  bindOrdersAuthListener().catch(function(){
    try { window.__ORDERS_PAGE_ACTIVE__ = false; } catch(_){}
  });
  return true;
};

// تحديث خفيف عند العودة للصفحة من الـ hash
window.__ORDERS_REFRESH__ = function(opts){
  if (!ordersUiReady()) return;
  if (!isOrdersViewActive()) return;
  const user = getOrdersCurrentUser();
  if (!user) return;
  const force = !!(opts && opts.force);
  try { syncToolbarUI(); } catch(_){}
  showOrdersCachedState(user.uid, { skeleton: force });
  try {
    ensureOrdersRealtimeReady(user.uid, { force: false }).catch(()=>{});
  } catch(_){ }
};

// تهيئة تلقائية فقط عند صفحة talabat.html (النسخة المنفصلة)
(function autoInitOrders(){
  try{
    const path = (location.pathname || '').toLowerCase();
    if (!path.endsWith('talabat.html')) return;
    const boot = () => { try { window.__initOrdersPage && window.__initOrdersPage(); } catch(_){ } };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', boot);
      return;
    }
    if (!ordersUiReady()) {
      document.addEventListener('DOMContentLoaded', boot);
      return;
    }
    boot();
  }catch(_){}
})();

/* ===================== LocalStorage Helpers ===================== */
const MEMORY_CACHE = new Map();

function sanitizeOrderPrivateForClient(priv) {
  const source = (priv && typeof priv === "object" && !Array.isArray(priv)) ? priv : {};
  const out = { ...source };
  Object.keys(out).forEach((key) => {
    const normalized = String(key || "").trim().toLowerCase().replace(/[\s_-]+/g, "");
    if (normalized.startsWith("admintelegram")) delete out[key];
  });
  return out;
}

function sanitizeOrderForClientCache(order) {
  const source = (order && typeof order === "object" && !Array.isArray(order)) ? order : {};
  const out = { ...source };
  out.__priv = sanitizeOrderPrivateForClient(out.__priv || {});
  return out;
}

const LS = {
  read(uid) {
    return MEMORY_CACHE.get(uid) || { byCode: {}, lastSync: 0 };
  },
  replace(uid, ordersArray) {
    const byCode = {};
    (ordersArray || []).forEach(o => { if (o?.code) byCode[o.code] = sanitizeOrderForClientCache(o); });
    LS._save(uid, { byCode, lastSync: Date.now() });
  },
  merge(uid, ordersArray) {
    const cur = LS.read(uid);
    (ordersArray || []).forEach(o => {
      if (!o?.code) return;
      cur.byCode[o.code] = sanitizeOrderForClientCache({ ...(cur.byCode[o.code] || {}), ...o });
    });
    cur.lastSync = Date.now();
    LS._save(uid, cur);
  },
  upsert(uid, orderObj) {
    if (!orderObj?.code) return;
    const cur = LS.read(uid);
    cur.byCode[orderObj.code] = sanitizeOrderForClientCache({ ...(cur.byCode[orderObj.code] || {}), ...orderObj });
    cur.lastSync = Date.now();
    LS._save(uid, cur);
  },
  _save(uid, obj) {
    MEMORY_CACHE.set(uid, obj);
  },
  clear(uid) {
    MEMORY_CACHE.delete(uid);
  }
};

// تحويل الكاش إلى مصفوفة مرتبة زمنياً
function cacheToSortedArray(uid) {
  const { byCode } = LS.read(uid);
  return sortOrdersByTimestamp(Object.values(byCode || {}));
}

// أداة: حساب إن كان الطلب حديثًا (â‰¤ N أيام)
function isWithinDays(ts, days) {
  if (!ts) return true; // إذا التاريخ غير معروف نعتبره حديثًا لتحديثه بحذر
  const t = new Date(ts).getTime();
  if (isNaN(t)) return true;
  const diffMs = Date.now() - t;
  return diffMs <= days * 24 * 60 * 60 * 1000;
}

function sortOrdersByTimestamp(list) {
  return (Array.isArray(list) ? list.slice() : []).sort((a, b) => {
    const tA = a && a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const tB = b && b.timestamp ? new Date(b.timestamp).getTime() : 0;
    return tB - tA;
  });
}

function buildOrderFromByCodeEntry(entry, fallbackCode, extra = null) {
  const node = entry || {};
  const pub = node.public || {};
  const priv = sanitizeOrderPrivateForClient(node.private || {});
  return {
    code: node.code || fallbackCode,
    ...pub,
    __pub: pub,
    __priv: priv,
    ...(extra || {})
  };
}

function mapByCodeOrdersToArray(byCode, extraFactory = null) {
  const map = (byCode && typeof byCode === "object") ? byCode : {};
  const arr = Object.keys(map).map((key) => {
    const entry = map[key] || {};
    const extra = (typeof extraFactory === "function")
      ? extraFactory(entry, key)
      : extraFactory;
    return buildOrderFromByCodeEntry(entry, key, extra);
  });
  return sortOrdersByTimestamp(arr);
}

function findByCodeOrderEntry(byCode, code) {
  const map = (byCode && typeof byCode === "object") ? byCode : {};
  if (map[code]) return map[code];
  const keys = Object.keys(map);
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    const entry = map[key] || {};
    if ((entry.code || key) === code) return entry;
  }
  return null;
}

/* ===================== Skeleton أثناء التحميل ===================== */
function showOrdersSkeleton(count = 3) {
  const list = document.getElementById("ordersList");
  if (!list) return;
  list.querySelectorAll(".order-card.loading").forEach(n => n.remove());
  for (let i = 0; i < count; i++) {
    const sk = document.createElement("div");
    sk.className = "order-card loading";
    list.appendChild(sk);
  }
}

/* ===================== تحميل الطلبات: Server-First ===================== */
async function loadOrdersCacheFirst(uid) {
  const ordersList = document.getElementById("ordersList");
  if (!ordersList) return;

  // دائمًا: اجلب أحدث نسخة من قاعدة البيانات أولًا
  ordersList.innerHTML = "";
  showOrdersSkeleton(1);

  try {
    const fresh = await fetchOrdersFromFirebaseOnce(uid);
    LS.replace(uid, fresh);
    renderOrders(fresh);
  } catch (e) {
    console.error(e);
    ordersList.querySelectorAll(".order-card.loading").forEach(n => n.remove());
    // fallback فقط عند فشل الشبكة: اعرض ما هو موجود في الذاكرة (إن وجد)
    const fallback = cacheToSortedArray(uid);
    if (fallback.length) {
      renderOrders(fallback);
      return;
    }
    handleOrdersFirestoreError(e);
  }
}

// قراءة مرّة واحدة لكل الطلبات الخاصة بالمستخدم من الخادم فقط.
async function fetchOrdersFromFirebaseOnce(uid) {
  return fetchOrdersFromServer(uid, { limit: 1000 });
}

// تحديث طلب واحد فقط من الخادم (بعد provider-check) بدون قراءة Firestore من المتصفح.
async function refreshSingleOrderFromFirebase(uid, code) {
  if (!uid || !code) return false;
  const fresh = await fetchOrdersFromServer(uid, { code });
  const entry = fresh.find((order) => String(order?.code || "").trim() === String(code || "").trim());
  if (!entry) return false;
  LS.upsert(uid, entry);
  return true;
}

// جلب جميع الطلبات ودمجها مع الكاش (يضمن ظهور الجديدة بعد كل دخول)
async function syncOrdersMerge(uid) {
  try {
    const fresh = await fetchOrdersFromServer(uid, { limit: 1000 });
    LS.merge(uid, fresh);
    renderOrders(cacheToSortedArray(uid));
  } catch(err){
    console.error('syncOrdersMerge error:', err);
    handleOrdersFirestoreError(err);
  }
}

/* ===================== تحديث حالة الطلبات الحديثة عند كل دخول ===================== */
/**
 * يجلب الطلبات الحديثة (â‰¤ 7 أيام) من المستند المجمّع لتحديث الحقول (خصوصًا status).
 * الأقدم من 7 أيام لا يُجلب ويُوثق من الكاش فقط.
 */
async function refreshRecentStatuses(uid) {
  const cache = LS.read(uid);
  const codes = Object.keys(cache.byCode || {});
  if (!codes.length) return;

  const recentCodes = codes.filter(code => {
    const o = cache.byCode[code];
    // نحدّث فقط إذا كان الطلب حديثًا (â‰¤ 7 أيام)
    return isWithinDays(o?.timestamp, STATUS_REFRESH_WINDOW_DAYS);
  });

  if (!recentCodes.length) return;

  try {
    const fresh = await fetchOrdersFromServer(uid, { limit: 1000 });
    const freshByCode = new Map(fresh.map((order) => [String(order?.code || "").trim(), order]));
    const refreshedAt = Date.now();
    const updates = recentCodes.map((code) => {
      const entry = freshByCode.get(String(code || "").trim());
      return entry ? { ...entry, __lastStatusRefreshAt: refreshedAt } : null;
    }).filter(Boolean);

    if (updates.length) {
      LS.merge(uid, updates);
      renderOrders(cacheToSortedArray(uid));
    }
  } catch (e) {
    console.error("refreshRecentStatuses error:", e);
  }
}

/* ===================== عرض الطلبات ===================== */
function renderOrders(orders) {
  const ordersList = document.getElementById("ordersList");
  if (!ordersList) return;

  // لو كان فيه Skeleton قديم (loading) احذفه عند وصول بيانات فعلية
  try { ordersList.querySelectorAll(".order-card.loading").forEach(n => n.remove()); } catch (_) {}

  // حفظ البيانات وتبديل إلى الصفحة الأولى
  let list = Array.isArray(orders) ? orders.slice() : [];
  const searchActive = normalizeSearchText(SEARCH_QUERY) !== '';

  const countOriginal = list.length;
  if (!searchActive) {
    list = applyOrdersFilter(list);
  }
  const countAfterStatus = list.length;

  if (!searchActive) {
    list = applyDateFilter(list);
  }
  const countAfterDate = list.length;

  list = applySearchFilter(list);
  const countAfterSearch = list.length;
  PAGINATION.orders = list;
  PAGINATION.page = 1;

  drawOrdersPage();
}

function drawOrdersPage() {
  const ordersList = document.getElementById("ordersList");
  if (!ordersList) return;

  // تأمين: احذف أي Skeleton متبقّي قبل رسم البطاقات
  try { ordersList.querySelectorAll(".order-card.loading").forEach(n => n.remove()); } catch (_) {}

  // احذف رسالة الفراغ القديمة إن وُجدت قبل إعادة الرسم
  const oldEmpty = document.getElementById('ordersEmptyMessage');
  if (oldEmpty) oldEmpty.remove();

  // خزّن البطاقات الحالية لمعرفة ما سيزال
  const prevMap = new Map();
  Array.from(ordersList.children).forEach(el => {
    if (el.id && el.id.startsWith('order-')) {
      prevMap.set(el.id.replace('order-',''), el);
    }
  });
  // ضع علامة خروج على البطاقات غير الموجودة في القائمة الجديدة
  const nextCodes = new Set(PAGINATION.orders.map(o => o?.code).filter(Boolean));
  prevMap.forEach((el, code) => {
    if (!nextCodes.has(code)) {
      if (SUPPRESS_ORDER_ANIM) {
        el.remove();
        return;
      }
      el.classList.add('anim-exit-right');
      const remover = () => { try { el.remove(); } catch (_) {} };
      el.addEventListener('animationend', (e)=>{ if (e.animationName === 'orderCardOutRight') remover(); }, { once: true });
      setTimeout(remover, ORDER_ANIM_EXIT_MS + 40); // تأمين في حال لم يُستدعَ الحدث
    }
  });
  // أزل سريعًا البطاقات التي ستبقى لإعادة بنائها، واترك الخارجة لتكمل التحريك
  prevMap.forEach((el, code) => { if (nextCodes.has(code)) el.remove(); });

  const total = PAGINATION.orders.length;
  // عرض رسالة مناسبة عند عدم وجود عناصر
  if (total === 0) {
    const wrapId = 'ordersEmptyMessage';
    let msgEl = document.getElementById(wrapId);
    if (!msgEl) { msgEl = document.createElement('div'); msgEl.id = wrapId; }
    let message = ordersT("orders.empty.all", "لا توجد طلبات", "No orders", "Aucune commande");
    if (ORDERS_FILTER === 'approved') {
      message = ordersT("orders.empty.approved", "لا توجد طلبات مشحونة", "No shipped orders", "Aucune commande expediee");
    } else if (ORDERS_FILTER === 'rejected') {
      message = ordersT("orders.empty.rejected", "لا توجد طلبات مرفوضة", "No rejected orders", "Aucune commande rejetee");
    } else if (ORDERS_FILTER === 'pending') {
      message = ordersT("orders.empty.pending", "لا توجد طلبات قيد الانتظار", "No pending orders", "Aucune commande en attente");
    }
    // عبارة بحسب وضع التاريخ
    message += (DATE_MODE === 'range'
      ? ordersT("orders.empty.rangeSuffix", " خلال هذه الفترة", " in this period", " dans cette periode")
      : ordersT("orders.empty.dateSuffix", " في هذا التاريخ", " on this date", " a cette date"));
    msgEl.innerHTML = `
      <svg class="illu" width="96" height="90" viewBox="0 0 96 90" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="overflow:visible">
        <!-- الخلفية: أزحناها قليلًا لليسار -->
        <g opacity="0.9" transform="translate(-8,2)">
          <rect x="20" y="8" rx="8" ry="8" width="56" height="68" class="paper paper-back" fill="currentColor"/>
          <rect x="34" y="4" width="28" height="10" rx="3" class="clip" fill="currentColor"/>
          <circle cx="48" cy="3" r="3" class="dot" fill="currentColor"/>
        </g>
        <!-- الأمامية: أزحناها قليلًا لليمين ليصبح المركز بينهما -->
        <g transform="translate(8,6)">
          <rect x="20" y="8" rx="8" ry="8" width="56" height="68" class="paper paper-front" fill="currentColor"/>
          <rect x="34" y="4" width="28" height="10" rx="3" class="clip" fill="currentColor"/>
          <circle cx="48" cy="3" r="3" class="dot" fill="currentColor"/>
        </g>
      </svg>
      <div class="caption">${message}</div>
    `;
    ordersList.innerHTML = '';
    ordersList.appendChild(msgEl);
    try { applyOrdersI18n(msgEl); } catch {}
    // اخفِ أي ترقيم موجود بعد القائمة إن وُجد
    const pager = document.getElementById('ordersPagination');
    if (pager) pager.remove();
    return;
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGINATION.size));
  const page = Math.min(Math.max(1, PAGINATION.page), totalPages);
  PAGINATION.page = page;

  const start = (page - 1) * PAGINATION.size;
  const end = Math.min(start + PAGINATION.size, total);
  const slice = PAGINATION.orders.slice(start, end);

  slice.forEach(order => {
    const {
      code,
      playerId,
      total,
      totalStr,
      currency,
      title,
      quantity,
      provider,
      game,
      providerOrderId,
      providerStatus,
      timestamp,
      status,
      proof
    } = order || {};
    if (!code) return;

    const existing = prevMap.get(code);
    if (existing) existing.remove(); // سنعيد إنشاءه بمحتوى محدث

    let formattedDate = "";
    try {
      formattedDate = new Date(timestamp).toLocaleString(getUiLocale(), {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit'
      });
    } catch {
      formattedDate = timestamp || ordersT("orders.unknownDate", "غير معروف", "Unknown", "Inconnu");
    }

    const offersFormatted = formatOffersHtml(order);

    const pub = order?.__pub || {};
    const priv = order?.__priv || {};
    const providerKey = String(provider || game || "").toLowerCase();
    const isSmm = providerKey === "smm";
    const serviceSnapshot = isSmm ? safeJsonParse(priv.serviceSnapshot, null) : null;
    const providerPayload = isSmm ? safeJsonParse(priv.providerPayload, null) : null;
    const smmServiceName = title || priv.serviceName || serviceSnapshot?.name || "";
    const smmQuantity = quantity ?? priv.quantity ?? providerPayload?.quantity ?? null;
    const smmLink = (priv.link || providerPayload?.link || "").trim();
    const smmRuns = priv.runs ?? providerPayload?.runs ?? null;
    const smmInterval = priv.interval ?? providerPayload?.interval ?? null;
    const smmProviderOrderId = providerOrderId || priv.providerOrderId || "";
    const smmProviderStatus = providerStatus || priv.providerStatus || "";
    const statusSource = status || smmProviderStatus;
    const normalizedStatus = normOrderStatus(statusSource);
    const statusText = formatStatusLabel(statusSource);
    const clientVisibleReply = resolveOrderReplyText(order);
    const labelReply = ordersT("orders.label.reply", "الرد", "Reply", "Reponse");
    const actionCopyReply = ordersT("orders.action.copyReply", "نسخ الرد", "Copy reply", "Copier la reponse");
    const orderReplyHtml = clientVisibleReply
      ? `<div class="order-reply-field">
           <p class="order-reply-label"><strong>${escapeHtml(labelReply)}:</strong></p>
           <button type="button" class="order-reply-value order-reply-copy" dir="auto" title="${escapeHtml(actionCopyReply)}" data-reply="${escapeHtml(encodeURIComponent(clientVisibleReply))}">${escapeHtml(clientVisibleReply).replace(/\n/g, "<br>")}</button>
         </div>`
      : "";

    const amountDisplay = formatAmountDisplay(totalStr, total, currency || priv.currency);

    // عنوان رأس الكرت: اسم اللعبة فقط (وفق طلب الواجهة).
    const productHeaderValue = (() => {
      if (smmServiceName) return smmServiceName;
      const offersListLocal = normalizeOffersArray(order?.offers || order?.offersList || order?.offerItems);
      for (const entry of offersListLocal) {
        if (!entry || typeof entry !== "object") continue;
        const n = String(entry.name || entry.title || entry.label || entry.offer || entry.offerName || entry.productName || entry.product || "").trim();
        if (n) return n;
      }
      const offersText = (order?.["العروض"] || order?.offersText || "").toString().trim();
      const parts = splitOffersText(offersText);
      if (parts.length) return parts[0];
      return "-";
    })();
    const gameHeaderValue = resolveOrderGameDisplay(order) || "";
    const headerDisplayValue = (() => {
      const gameValue = String(gameHeaderValue || "").trim();
      if (gameValue && gameValue !== "-") return gameValue;
      return "-";
    })();
    const productDisplayValue = (() => {
      const productValue = String(productHeaderValue || "").trim();
      if (productValue && productValue !== "-") return productValue;
      return "-";
    })();
    const safeHeaderDisplay = escapeHtml(headerDisplayValue || "-");
    const safeAmountDisplay = escapeHtml(amountDisplay);
    const safeStatusText = escapeHtml(statusText);
    const safeDateText = escapeHtml(formattedDate);
    const safeProofSrc = proof ? escapeHtml(proof) : "";
    const labelOrderCode = ordersT("orders.label.code", "كود الطلب", "Order code", "Code commande");
    const labelBuy = ordersT("orders.label.buy", "شراء", "Purchase", "Achat");
    const labelProduct = ordersT("orders.label.product", "المنتج", "Product", "Produit");
    const labelOffers = ordersT("orders.label.offers", "العروض", "Offers", "Offres");
    const labelRefund = ordersT("orders.label.refund", "حالة الاسترداد", "Refund status", "Statut remboursement");
    const labelTotal = ordersT("orders.label.total", "المجموع", "Total", "Total");
    const labelDate = ordersT("orders.label.sendDate", "تاريخ الإرسال", "Sent at", "Date envoi");
    const labelProof = ordersT("orders.label.proof", "إثبات التحويل", "Transfer proof", "Preuve de transfert");
    const labelPlayerId = ordersT("orders.label.playerId", "ايدي اللاعب", "Player ID", "ID joueur");
    const textShowProof = ordersT("orders.action.showProof", "عرض الصورة", "Show image", "Afficher l'image");
    const textHideProof = ordersT("orders.action.hideProof", "إخفاء الصورة", "Hide image", "Masquer l'image");
    const showOffersLine = !isSmm || !!offersFormatted;
    const productLineHtml = productDisplayValue
      ? `<p><strong>${escapeHtml(labelProduct)}:</strong> ${escapeHtml(productDisplayValue)}</p>`
      : "";
    const orderSubmittedFields = collectOrderSubmittedFields(order);
    const orderRequiredFields = collectOrderRequiredFields(order);
    const orderPlayerFieldsRaw = Object.keys(orderSubmittedFields).length ? orderSubmittedFields : null;
    const playerIdDisplay = (() => {
      const directCandidates = [
        playerId,
        order?.playerID,
        pub?.playerId,
        pub?.playerID,
        priv?.playerId,
        priv?.playerID
      ];
      for (const candidate of directCandidates) {
        const text = String(candidate ?? "").trim();
        if (isValidPlayerId(text)) return text;
      }
      return extractPlayerIdFromPlayerFields(orderPlayerFieldsRaw);
    })();
    const playerIdLineHtml = isValidPlayerId(playerIdDisplay)
      ? `<p><strong>${escapeHtml(labelPlayerId)}:</strong> ${escapeHtml(playerIdDisplay)}</p>`
      : "";
    const inputPairs = buildOrderInputDisplayPairs({
      submittedFields: orderPlayerFieldsRaw,
      requiredFields: orderRequiredFields,
      playerIdValue: playerIdDisplay,
      playerIdLabel: labelPlayerId
    });
    const fieldsHtml = inputPairs.length
      ? inputPairs.map(([label, value]) => `<p><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`).join("")
      : playerIdLineHtml;
    const offersLineHtml = showOffersLine ? `<p><strong>${escapeHtml(labelOffers)}:</strong> ${offersFormatted || "-"}</p>` : "";
    const refundAmountCandidate = priv.refundAmount ?? order?.refundAmount;
    let refundAmountNumber = null;
    if (refundAmountCandidate !== undefined && refundAmountCandidate !== null && refundAmountCandidate !== "") {
      const parsedRefund = typeof refundAmountCandidate === "number" ? refundAmountCandidate : Number(refundAmountCandidate);
      if (Number.isFinite(parsedRefund)) refundAmountNumber = parsedRefund;
    }
    const refundAmountHasValue = refundAmountNumber !== null;
    const refundAmountStr = priv.refundAmountStr || order?.refundAmountStr || "";
    const refundAmountDisplay = (refundAmountStr || refundAmountHasValue)
      ? formatAmountDisplay(refundAmountStr || null, refundAmountHasValue ? refundAmountNumber : null, currency || priv.currency)
      : "";
    const isRejectedStatus = normalizedStatus === "rejected";
    const refundIssuedFlag = priv.refunded === true || priv.refundIssued === true || order?.refunded === true || order?.refundIssued === true;
    let refundLineHtml = "";
    if (isRejectedStatus) {
      const refundText = refundIssuedFlag
        ? (refundAmountDisplay
          ? `${ordersT("orders.refund.done", "تمت إعادة", "Refunded", "Rembourse")}: ${refundAmountDisplay}`
          : ordersT("orders.refund.doneAmount", "تمت إعادة المبلغ", "Amount refunded", "Montant rembourse"))
        : ordersT("orders.refund.pending", "لم يتم إرجاع المبلغ بعد", "Refund not issued yet", "Remboursement non effectue");
      refundLineHtml = `<p><strong>${escapeHtml(labelRefund)}:</strong> ${escapeHtml(refundText)}</p>`;
    }

    const statusToneClass = normalizedStatus === "approved"
      ? " is-approved"
      : (normalizedStatus === "rejected" ? " is-rejected" : " is-pending");

    const smmDetailsParts = [];
    if (isSmm && smmServiceName) {
      smmDetailsParts.push(`<p><strong>الخدمة:</strong> ${escapeHtml(smmServiceName)}</p>`);
    }
    if (isSmm && smmQuantity !== null && smmQuantity !== undefined && smmQuantity !== "") {
      smmDetailsParts.push(`<p><strong>الكمية:</strong> ${escapeHtml(smmQuantity)}</p>`);
    }
    if (isSmm && smmLink) {
      const linkMarkup = formatLinkDisplay(smmLink) || escapeHtml(smmLink);
      smmDetailsParts.push(`<p><strong>الرابط:</strong> ${linkMarkup}</p>`);
    }
    if (isSmm && smmProviderOrderId) {
      smmDetailsParts.push(`<p><strong>رقم الطلب:</strong> ${escapeHtml(smmProviderOrderId)}</p>`);
    }
    if (isSmm && smmProviderStatus) {
      smmDetailsParts.push(`<p><strong>حالة الطلب:</strong> ${escapeHtml(formatStatusLabel(smmProviderStatus))}</p>`);
    }
    if (isSmm && (smmRuns || smmInterval)) {
      const bits = [];
      if (smmRuns) bits.push(`عدد الدفعات: ${escapeHtml(smmRuns)}`);
      if (smmInterval) bits.push(`الفاصل: ${escapeHtml(smmInterval)}`);
      smmDetailsParts.push(`<p><strong>التكرار:</strong> ${bits.join(" / ")}</p>`);
    }
    const smmDetailsBlock = smmDetailsParts.join("");

    const openKey = String(code || "");
    const isOpen = OPEN_ORDER_CODES.has(openKey);
    const safeCode = escapeHtml(code);

    const card = document.createElement("div");
    card.className = `order-card${isOpen ? " open" : ""}`;
    card.id = `order-${code}`;

    card.innerHTML = `
      <div class="order-header" onclick="toggleDetails('${code}')">
        <div class="order-header-text">
          <div class="order-code-line"><strong>${escapeHtml(labelOrderCode)}:</strong> <span class="order-code">${safeCode}</span></div>
          <div class="order-meta-line"><strong>${escapeHtml(labelBuy)}: ${safeHeaderDisplay}</strong></div>
        </div>
        <div class="order-status${statusToneClass}">
          ${safeStatusText}
        </div>
        <i class="fas fa-chevron-down"></i>
      </div>
      <div class="order-details" id="details-${code}" style="display:${isOpen ? "block" : "none"};">
        ${productLineHtml}
        ${fieldsHtml}
        ${smmDetailsBlock}
        ${offersLineHtml}
        ${refundLineHtml}
        <p><strong>${escapeHtml(labelTotal)}:</strong> ${safeAmountDisplay}</p>
        <p><strong>${escapeHtml(labelDate)}:</strong> ${safeDateText}</p>
        ${orderReplyHtml}
        ${
          proof
            ? `<p>
                 <strong>${escapeHtml(labelProof)}:</strong>
                 <button class="btn-show-proof" data-code="${safeCode}" data-show-text="${escapeHtml(textShowProof)}" data-hide-text="${escapeHtml(textHideProof)}">${escapeHtml(textShowProof)}</button><br>
                 <img id="proof-img-${safeCode}" src="${safeProofSrc}" alt="${escapeHtml(labelProof)}" style="display:none; max-width:100%; margin-top:10px;">
               </p>`
            : ``
        }
      </div>
    `;

    if (!existing && !SUPPRESS_ORDER_ANIM) {
      card.classList.add('anim-enter-right');
      card.addEventListener('animationend', (e)=>{ if (e.animationName === 'orderCardInRight') card.classList.remove('anim-enter-right'); }, { once:true });
    }

  ordersList.appendChild(card);
});

attachProofButtons();
attachCopyCodeButtons();
attachCopyReplyButtons();
attachRefreshOrderButtons();
renderPaginationControls(total, page, totalPages, start, end);
try { applyOrdersI18n(document.getElementById("ordersContainer") || ordersList); } catch {}
}

// مزامنة الواجهة مع التفضيلات الحالية (إذا وُجدت العناصر)
function syncToolbarUI(){
  try{
    const wrap = document.getElementById('ordersToolbar');
    if (!wrap) return false;
    wrap.querySelectorAll('.chip').forEach(c=>{
      if (!c.dataset || !c.dataset.filter) return;
      const f = c.dataset.filter;
      c.classList.toggle('active', f === ORDERS_FILTER);
    });
    // حدّث نص زر التاريخ دائمًا ليطابق الاختيار
    try{
      const dc = document.getElementById('dateChip');
      if (dc){ dc.textContent = getDateChipText(); }
    }catch{}
    try { applyOrdersI18n(wrap); } catch {}
    return true;
  }catch{ return false; }
}

// حساب عدد الطلبات لكل يوم (بالفلتر الحالي)
function computeDateCounts(){
  try{
    const uid = getOrdersCurrentUser()?.uid;
    if (!uid) return {};
    const { byCode } = LS.read(uid);
    const arr = Object.values(byCode || {});
    const filtered = applyOrdersFilter(arr);
    const map = {};
    for (const o of filtered){
      const ms = getOrderTimeMs(o);
      if (!ms) continue;
      const d = new Date(ms);
      const ymd = `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
      map[ymd] = (map[ymd]||0) + 1;
    }
    return map;
  }catch{ return {}; }
}

// مستمع نقرة عام (تفويض) للفلاتر
document.addEventListener('click', (e) => {
  const btn = e.target.closest('#ordersToolbar .chip');
  if (!btn) return;
  if (btn.id === 'dateChip') { openCalendar(); return; }
  ORDERS_FILTER = btn.dataset.filter || 'all';
  syncToolbarUI();
  recomputeAndRender();
});

// تغيير التاريخ عبر مُنتقي التاريخ
document.addEventListener('change', (e) => {
  const input = e.target && e.target.id === 'ordersDatePicker' ? e.target : null;
  if (!input) return;
  const val = String(input.value || '').trim();
  // التحويل إلى وضع اليوم الواحد عند استخدام حقل التاريخ العادي
  DATE_MODE = 'single';
  DATE_RANGE = { from: null, to: null };
  SELECTED_DATE_STR = val || getTodayStr();
  SELECTED_DATE_MANUAL = !!val; // اختيار يدوي فقط إذا كان هناك تاريخ محدد
  syncToolbarUI();
  recomputeAndRender();
});

// عند اكتمال تحميل DOM حاول مزامنة الواجهة (قد تكون العناصر أنشئت هناك)
function refreshOrdersCurrency() {
  if (!PAGINATION.orders || PAGINATION.orders.length === 0) return;
  SUPPRESS_ORDER_ANIM = true;
  try { drawOrdersPage(); }
  finally { SUPPRESS_ORDER_ANIM = false; }
}
try { window.addEventListener('currency:change', refreshOrdersCurrency); } catch {}
try { window.addEventListener('currency:rates:change', refreshOrdersCurrency); } catch {}
try { window.addEventListener('currency:ready', refreshOrdersCurrency); } catch {}
try {
  window.addEventListener('language:change', () => {
    try { syncToolbarUI(); } catch {}
    if (PAGINATION.orders && PAGINATION.orders.length) {
      try { refreshOrdersCurrency(); } catch {}
    } else {
      try { applyOrdersI18n(document.getElementById("ordersContainer") || document); } catch {}
    }
  });
} catch {}

document.addEventListener('DOMContentLoaded', () => { setTimeout(syncToolbarUI, 0); });

// نسخة تفويض للأزرار/الحقل لضمان العمل حتى لو لم يُلتقطت عند DOMContentLoaded
(function(){
  let debounceId = null;
  function applySearchFrom(val){
    SEARCH_QUERY = (val || '').trim();
    recomputeAndRender();
  }
  document.addEventListener('input', (e) => {
    const el = e.target;
    if (!el || el.id !== 'ordersSearch') return;
    clearTimeout(debounceId);
    const v = el.value;
    debounceId = setTimeout(() => applySearchFrom(v), 180);
  });
  document.addEventListener('keydown', (e) => {
    const el = e.target;
    if (!el || el.id !== 'ordersSearch') return;
    if (e.key === 'Enter') { e.preventDefault(); applySearchFrom(el.value); }
  });
})();

function attachProofButtons() {
  document.querySelectorAll('.btn-show-proof').forEach(btn => {
    btn.onclick = () => {
      const code = btn.dataset.code;
      const img = document.getElementById(`proof-img-${code}`);
      const showText = String(btn.dataset.showText || ordersT("orders.action.showProof", "عرض الصورة", "Show image", "Afficher l'image"));
      const hideText = String(btn.dataset.hideText || ordersT("orders.action.hideProof", "إخفاء الصورة", "Hide image", "Masquer l'image"));
      if (img.style.display === 'none' || !img.style.display) {
        img.style.display = 'block';
        btn.textContent = hideText;
      } else {
        img.style.display = 'none';
        btn.textContent = showText;
      }
    };
  });
}

function firestoreErrorCode(err) {
  return (err && err.code) ? String(err.code) : "";
}

function isFirestorePermissionDenied(err) {
  return firestoreErrorCode(err) === "permission-denied";
}

function attachRefreshOrderButtons() {
  document.querySelectorAll(".btn-refresh-order").forEach((btn) => {
    btn.onclick = async (e) => {
      e.preventDefault();
      const code = (btn.dataset.code || "").toString().trim();
      const orderUuid = (btn.dataset.orderuuid || "").toString().trim();
      const orderId = (btn.dataset.orderid || "").toString().trim();

      const uid = getOrdersCurrentUser()?.uid;
      if (!uid) return;

      if (!orderUuid && !orderId) {
        alert(ordersT("orders.alert.noProviderTracking", "لا يوجد رقم تتبع للمزود لهذا الطلب.", "No provider tracking ID for this order.", "Aucun numero de suivi fournisseur pour cette commande."));
        return;
      }

      const prevText = btn.textContent;
      try {
        btn.disabled = true;
        btn.textContent = ordersT("orders.action.updating", "جارٍ التحديث...", "Updating...", "Mise a jour...");

        const headers = {};
        const sessionKey = getStoredSessionKey(uid);
        if (sessionKey) headers["X-SessionKey"] = sessionKey;
        try {
          const user = getOrdersCurrentUser();
          if (user && typeof user.getIdToken === "function") {
            const idToken = await user.getIdToken();
            if (idToken) headers["Authorization"] = `Bearer ${idToken}`;
          }
        } catch (_) {}

        const url = buildProviderCheckUrl({ orderUuid, orderId });
        const res = await fetch(url, { method: "GET", headers });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data?.success === false || data?.ok === false) {
          throw new Error(data?.error || data?.message || ordersT("orders.error.refreshFailed", "فشل تحديث الرد", "Failed to refresh reply", "Echec de mise a jour de la reponse"));
        }

        await refreshSingleOrderFromFirebase(uid, code);
        // حافظ على فتح تفاصيل الطلب بعد التحديث
        OPEN_ORDER_CODES.add(code);
        renderOrders(cacheToSortedArray(uid));
      } catch (err) {
        alert(err?.message || ordersT("orders.error.refreshFailed", "فشل تحديث الرد", "Failed to refresh reply", "Echec de mise a jour de la reponse"));
      } finally {
        btn.disabled = false;
        btn.textContent = prevText || ordersT("orders.action.refreshReply", "تحديث الرد", "Refresh reply", "Rafraichir reponse");
      }
    };
  });
}

function attachCopyCodeButtons() {
  document.querySelectorAll('.btn-copy-code').forEach(btn => {
    btn.onclick = () => {
      const code = btn.dataset.code || "";
      if (!code) return;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code).then(() => {
          btn.textContent = "\u2714";
          setTimeout(() => { btn.textContent = "\u{1F4CB}"; }, 1200);
        }).catch(() => alert(ordersT("orders.error.copyFailed", "تعذر نسخ الكود، انسخه يدويًا.", "Could not copy the code, copy it manually.", "Impossible de copier le code, copiez-le manuellement.")));
      } else {
        alert(ordersT("orders.error.copyManualPrefix", "انسخ الكود يدويًا: ", "Copy manually: ", "Copiez manuellement: ") + code);
      }
    };
  });
}

function attachCopyReplyButtons() {
  const textCopyDone = ordersT("orders.toast.replyCopied", "تم نسخ الرد.", "Reply copied.", "Reponse copiee.");
  const textCopyFailed = ordersT("orders.error.copyReplyFailed", "تعذر نسخ الرد، انسخه يدويًا.", "Could not copy reply, copy it manually.", "Impossible de copier la reponse, copiez-la manuellement.");
  const textCopyManualPrefix = ordersT("orders.error.copyReplyManualPrefix", "انسخ الرد يدويًا: ", "Copy reply manually: ", "Copiez la reponse manuellement: ");
  const copyReplyText = (text) => {
    if (!text) return Promise.reject(new Error("empty"));
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise((resolve, reject) => {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.top = "-9999px";
        ta.style.opacity = "0";
        ta.setAttribute("readonly", "readonly");
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        ta.setSelectionRange(0, ta.value.length);
        const ok = document.execCommand("copy");
        try { document.body.removeChild(ta); } catch (_) {}
        return ok ? resolve() : reject(new Error("copy_failed"));
      } catch (err) {
        reject(err);
      }
    });
  };

  document.querySelectorAll('.order-reply-copy').forEach((node) => {
    if (node.dataset.copyBound === "1") return;
    node.dataset.copyBound = "1";

    const runCopy = () => {
      let decoded = "";
      try { decoded = decodeURIComponent(String(node.dataset.reply || "")); } catch (_) { decoded = String(node.dataset.reply || ""); }
      const reply = String(decoded || "").trim();
      if (!reply) return;

      const originalTitle = node.getAttribute("title") || "";
      copyReplyText(reply).then(() => {
        node.classList.add("copied");
        node.setAttribute("title", textCopyDone);
        try { if (node.__copiedTimer) clearTimeout(node.__copiedTimer); } catch (_) {}
        node.__copiedTimer = setTimeout(() => {
          try { node.classList.remove("copied"); } catch (_) {}
          node.setAttribute("title", originalTitle);
        }, 1200);
        try {
          if (typeof showToast === "function") showToast(textCopyDone, "success");
        } catch (_) {}
      }).catch(() => {
        alert(textCopyFailed + "\n" + textCopyManualPrefix + reply);
      });
    };

    node.onclick = (ev) => {
      try { ev.preventDefault(); } catch (_) {}
      try { ev.stopPropagation(); } catch (_) {}
      runCopy();
    };
    node.onkeydown = (ev) => {
      const key = String(ev?.key || "");
      if (key !== "Enter" && key !== " ") return;
      try { ev.preventDefault(); } catch (_) {}
      try { ev.stopPropagation(); } catch (_) {}
      runCopy();
    };
  });
}

function handleOrdersFirestoreError(err){
  const code = (err && err.code) ? String(err.code) : "";
  const status = Number(err && err.status);
  if (code !== "permission-denied" && code !== "unavailable" && status !== 401 && status !== 403) return;
  try { if (_ordersUnsub) { _ordersUnsub(); _ordersUnsub = null; } } catch {}
  const ordersList = document.getElementById("ordersList");
  if (!ordersList) return;
  const wrapId = 'ordersEmptyMessage';
  let msgEl = document.getElementById(wrapId);
  if (!msgEl) { msgEl = document.createElement('div'); msgEl.id = wrapId; }
  const message = (code === "permission-denied")
    ? "لا يمكن عرض الطلبات بسبب الصلاحيات. تأكد من تسجيل الدخول."
    : (status === 401 || status === 403)
      ? "يجب تسجيل الدخول لعرض الطلبات."
      : "تعذر تحميل الطلبات من الخادم مؤقتًا. حاول لاحقًا.";
  msgEl.innerHTML = `<div class="caption">${message}</div>`;
  ordersList.innerHTML = '';
  ordersList.appendChild(msgEl);
  const pager = document.getElementById('ordersPagination');
  if (pager) pager.remove();
}

/* ===================== استماع فوري لتغيرات الطلبات ===================== */
let _ordersUnsub = null;
function listenOrdersRealtime(uid, opts) {
  const safeUid = String(uid || "").trim();
  const force = !!(opts && opts.force);
  if (!safeUid) return false;
  if (!force && _ordersUnsub && _ordersRealtimeUid === safeUid) return true;
  try {
    if (_ordersUnsub && (_ordersRealtimeUid !== safeUid || force)) {
      _ordersUnsub();
      _ordersUnsub = null;
    }
  } catch {}
  try {
    _ordersRealtimeUid = safeUid;
    _ordersUnsub = function(){};
    fetchOrdersFromServer(safeUid, { limit: 1000 }).then((fresh)=>{
      try{
        const uidNow = String((getOrdersCurrentUser() && getOrdersCurrentUser().uid) || "").trim();
        if (uidNow && uidNow !== safeUid) return;
        if (!fresh.length) {
          LS.replace(safeUid, []);
          renderOrders([]);
          return;
        }
        LS.merge(safeUid, fresh);
        renderOrders(cacheToSortedArray(safeUid));
      }catch(e){ console.warn('orders merge failed', e); }
    }).catch((err)=>{
      console.warn('orders fetch failed', err);
      const cached = cacheToSortedArray(safeUid);
      if (!cached.length) {
        LS.replace(safeUid, []);
        renderOrders([]);
        return;
      }
      handleOrdersFirestoreError(err);
    });
    return true;
  } catch (e) {
    console.warn('listenOrdersRealtime failed', e);
    handleOrdersFirestoreError(e);
    return false;
  }
}

function renderPaginationControls(total, page, totalPages, start, end) {
  const ordersList = document.getElementById('ordersList');
  if (!ordersList) return;

  let pager = document.getElementById('ordersPagination');
  if (!pager) {
    pager = document.createElement('div');
    pager.id = 'ordersPagination';
    pager.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;margin:12px 0;flex-wrap:wrap';
    ordersList.insertAdjacentElement('afterend', pager);
  }

  if (total <= PAGINATION.size) {
    pager.innerHTML = '';
    pager.style.display = 'none';
    return;
  }
  pager.style.display = 'flex';

  const info = document.createElement('div');
  info.textContent = `عرض ${start + 1}â€“${end} من ${total}`;
  info.style.marginInlineStart = '8px';

  const controls = document.createElement('div');
  controls.style.display = 'flex';
  controls.style.gap = '6px';

  const mkBtn = (label, disabled, handler) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.style.cssText = 'padding:6px 10px;border:1px solid #ccc;border-radius:8px;background:#fff;cursor:pointer';
    if (document.body.classList.contains('dark-mode')) {
      b.style.background = '#0f1024'; b.style.color = '#f0f1ff'; b.style.borderColor = '#2b2d52';
    }
    b.disabled = !!disabled;
    if (disabled) { b.style.opacity = '0.6'; b.style.cursor = 'not-allowed'; }
    if (handler) b.addEventListener('click', handler);
    return b;
  };

  // Previous
  controls.appendChild(mkBtn('السابق', page <= 1, () => { PAGINATION.page = Math.max(1, page - 1); drawOrdersPage(); }));

  // Page numbers (compact: 1 ... p-1 p p+1 ... N)
  const addPageBtn = (p) => {
    const btn = mkBtn(String(p), false, () => { PAGINATION.page = p; drawOrdersPage(); });
    if (p === page) { btn.style.fontWeight = '800'; btn.style.borderColor = '#5c5ebf'; }
    controls.appendChild(btn);
  };
  const addEllipsis = () => {
    const span = document.createElement('span'); span.textContent = '...'; span.style.padding = '6px 4px';
    controls.appendChild(span);
  };
  if (totalPages <= 7) {
    for (let p = 1; p <= totalPages; p++) addPageBtn(p);
  } else {
    addPageBtn(1);
    if (page > 3) addEllipsis();
    for (let p = Math.max(2, page - 1); p <= Math.min(totalPages - 1, page + 1); p++) addPageBtn(p);
    if (page < totalPages - 2) addEllipsis();
    addPageBtn(totalPages);
  }

  // Next
  controls.appendChild(mkBtn('التالي', page >= totalPages, () => { PAGINATION.page = Math.min(totalPages, page + 1); drawOrdersPage(); }));

  pager.innerHTML = '';
  pager.appendChild(info);
  pager.appendChild(controls);
}

/* ===================== تفاصيل الطلب: Cache-First ثم Firebase لهذا الطلب ===================== */
async function showOrderDetails(code) {
  const detailsBox = document.getElementById("orderDetails");
  if (!detailsBox) return;

  if (!code) {
    detailsBox.style.display = "none";
    return;
  }

  const uid = getOrdersCurrentUser()?.uid;
  if (!uid) return;

  // حاول من الكاش أولاً
  let cache = LS.read(uid);
  let cachedOrder = cache.byCode[code];

  if (cachedOrder?.__pub && cachedOrder?.__priv) {
    renderDetailsTable(cachedOrder.__pub, cachedOrder.__priv, detailsBox);
    return;
  }

  try {
    const refreshed = await refreshSingleOrderFromFirebase(uid, code);
    if (!refreshed) {
      detailsBox.style.display = "none";
      return;
    }
    cache = LS.read(uid);
    cachedOrder = cache.byCode[code];
    if (cachedOrder?.__pub && cachedOrder?.__priv) {
      renderDetailsTable(cachedOrder.__pub, cachedOrder.__priv, detailsBox);
      return;
    }
  } catch (e) {
    console.error(e);
  }
  detailsBox.style.display = "none";
}

function renderDetailsTable(pub, priv, detailsBox) {
  let rows = '';
  const formatValue = (value) => {
    if (value === undefined || value === null) return "";
    if (typeof value === "string") return escapeHtml(value);
    if (typeof value === "number" || typeof value === "boolean") return escapeHtml(String(value));
    if (typeof value === "object") {
      try { return escapeHtml(JSON.stringify(value, null, 2)).replace(/\n/g, "<br>"); } catch {}
      return escapeHtml(String(value));
    }
    return escapeHtml(String(value));
  };
  const appendRow = (label, value) => {
    rows += `<tr>
               <td style="padding:10px;font-weight:bold;border:1px solid #ccc;">${formatValue(label)}</td>
               <td style="padding:10px;border:1px solid #ccc;">${formatValue(value)}</td>
             </tr>`;
  };
  const shouldHideField = (key) => {
    const normalized = String(key || "").trim().toLowerCase().replace(/[\s_-]+/g, "");
    if (!normalized) return true;
    if (
      normalized === "userid" ||
      normalized === "uid" ||
      normalized === "useruid" ||
      normalized === "replayapi" ||
      normalized === "providerorderid" ||
      normalized === "providerstatus" ||
      normalized === "response" ||
      normalized === "providernote" ||
      normalized === "note" ||
      normalized === "orderidsjson" ||
      normalized.startsWith("provider") ||
      normalized.startsWith("programmer")
    ) {
      return true;
    }
    return false;
  };
  const visiblePublicEntries = Object.entries(pub || {}).filter(([key]) => !shouldHideField(key));

  rows += `<tr><td colspan="2" style="background:#eee;padding:10px;font-weight:bold;">📂 تفاصيل الطلب</td></tr>`;
  if (visiblePublicEntries.length) {
    visiblePublicEntries.forEach(([k, v]) => appendRow(k, v));
  } else {
    appendRow("ملاحظة", "لا توجد تفاصيل إضافية.");
  }

  detailsBox.innerHTML = `<table style="width:100%;direction:rtl;border-collapse:collapse;">${rows}</table>`;
  detailsBox.style.display = "block";
}

/* ===================== اتفاقية المستخدم (كما لديك) ===================== */
// أبقِ هذا الحدث للاتفاقية فقط — بدون استدعاء تحميلات هنا
window.addEventListener("DOMContentLoaded", () => {
  const agreed = localStorage.getItem('userAgreementAccepted');
  if (agreed !== 'true') {
    const box = document.getElementById('user-agreement');
    if (box) {
      box.style.display = 'flex';
      box.style.alignItems = 'center';
      box.style.justifyContent = 'center';
    }
  }
});

/* ===================== أدوات واجهة بسيطة (اختيارية) ===================== */
// زر تحديت/مسح الكاش (إن أضفتهما في الصفحة)
document.addEventListener('DOMContentLoaded', () => {
  const btnRefresh = document.getElementById('btnRefresh');
  const btnClear = document.getElementById('btnClearCache');

  if (btnRefresh) {
    btnRefresh.onclick = async () => {
      const uid = getOrdersCurrentUser()?.uid;
      if (!uid) return;
      showOrdersSkeleton(1);
      try {
        const fresh = await fetchOrdersFromFirebaseOnce(uid);
        LS.replace(uid, fresh);
        renderOrders(fresh);
      } catch (e) {
        console.error(e);
      }
    };
  }

  if (btnClear) {
    btnClear.onclick = () => {
      const uid = getOrdersCurrentUser()?.uid;
      if (!uid) return;
      LS.clear(uid);
      const ordersList = document.getElementById("ordersList");
      if (ordersList) ordersList.innerHTML = "";
    };
  }
});

/* ===================== أدوات صغيرة ===================== */
function toggleDetails(code) {
  const d = document.getElementById(`details-${code}`);
  const card = document.getElementById(`order-${code}`);
  if (!d || !card) return;
  const isOpen = d.style.display === 'block';
  d.style.display = isOpen ? 'none' : 'block';
  card.classList.toggle('open', !isOpen);
  const key = String(code || "");
  if (key) {
    if (isOpen) OPEN_ORDER_CODES.delete(key);
    else OPEN_ORDER_CODES.add(key);
  }
}
