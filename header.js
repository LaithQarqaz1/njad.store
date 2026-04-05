// Deobfuscated and cleaned header logic

// Runtime config, router base, and Firebase bootstrap now come from site-core.js.
// Realtime Firestore toggle (to reduce "channel?VER=8" requests)
function shouldEnableRealtime(feature){
  return false;
}

// Force HTTPS when not local
(function(){
  try {
    const host = location.hostname || '';
    const isLocal = host === 'localhost' || host === '127.0.0.1' || /^0\.0\.0\.0$/.test(host) ||
      /^192\.168\./.test(host) || /^10\./.test(host) || /^172\.(1[6-9]|2\d|3[0-1])\./.test(host);
    if (location.protocol === 'http:' && !isLocal) {
      const to = 'https://' + location.host + location.pathname + location.search + location.hash;
      try { window.stop && window.stop(); } catch {}
      location.replace(to);
      return;
    }
  } catch {}
})();

// Sync theme across all pages (light/dark + body classes + meta)
(function(){
  function normalizeTheme(value){
    const t = String(value || '').toLowerCase().trim();
    return (t === 'light' || t === 'dark') ? t : '';
  }
  function readCachedSiteDefaultMode(){
    try {
      const raw = localStorage.getItem('site:theme:v1');
      if (!raw) return '';
      const parsed = JSON.parse(raw);
      return normalizeTheme(
        parsed && (
          parsed.defaultMode ||
          parsed.default_mode ||
          parsed.defaultThemeMode ||
          parsed.default_theme_mode
        )
      );
    } catch {}
    return '';
  }
  function readTheme(){
    let t = '';
    if (!t) {
      try { t = normalizeTheme(localStorage.getItem('theme')); } catch {}
    }
    if (!t) {
      t = readCachedSiteDefaultMode();
    }
    if (!t) {
      try { t = normalizeTheme(document.documentElement.getAttribute('data-theme')); } catch {}
    }
    return t || 'dark';
  }
  function ensureMeta(name){
    try {
      let meta = document.querySelector(`meta[name="${name}"]`);
      if (!meta) {
        meta = document.createElement('meta');
        meta.name = name;
        document.head && document.head.appendChild(meta);
      }
      return meta;
    } catch {
      return null;
    }
  }
  function applyTheme(theme){
    const t = normalizeTheme(theme) || 'dark';
    try { document.documentElement.setAttribute('data-theme', t); } catch {}
    try {
      if (document.body) {
        document.body.classList.toggle('dark-mode', t === 'dark');
        document.body.classList.toggle('light-mode', t === 'light');
      }
    } catch {}
    try {
      const cs = ensureMeta('color-scheme');
      if (cs) cs.setAttribute('content', t === 'dark' ? 'dark light' : 'light dark');
    } catch {}
    try {
      const tc = ensureMeta('theme-color');
      if (tc) tc.setAttribute('content', t === 'dark' ? '#05050b' : '#f8f9fa');
    } catch {}
  }
  function sync(){
    applyTheme(readTheme());
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', sync, { once: true });
  } else {
    sync();
  }
  try { window.addEventListener('load', sync); } catch {}
  try { window.addEventListener('pageshow', sync); } catch {}
  document.addEventListener('theme:change', function(e){
    try {
      const next = e && e.detail ? e.detail.theme : '';
      if (next) applyTheme(next);
      else sync();
    } catch {}
  });
  window.addEventListener('storage', function(e){
    if (e && (e.key === 'theme' || e.key === 'site:theme:v1')) sync();
  });
})();

// Add allow=1 on .html links when clicked (for from-home navigation)
(function(){
  function ensureAllowParam(a){
    try {
      const href = a.getAttribute('href');
      if (!href) return;
      const url = new URL(href, location.href);
      if (!url.searchParams.has('allow')) {
        url.searchParams.set('allow','1');
        a.setAttribute('href', url.pathname + url.search + url.hash);
      }
    } catch {}
  }
  function onNav(e){
    try {
      const link = e.target && e.target.closest ? e.target.closest('a[href$=".html"]') : null;
      if (!link) return;
      try { sessionStorage.setItem('nav:fromHome','1'); } catch {}
      ensureAllowParam(link);
    } catch {}
  }
  document.addEventListener('pointerdown', onNav, true);
  document.addEventListener('auxclick', onNav, true);
  document.addEventListener('click', onNav, true);
})();

function trimSiteMediaUrl(value){
  const text = String(value == null ? '' : value).trim();
  return text ? text.slice(0, 2000) : '';
}
function escapeSiteSvgText(value){
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
function buildSiteSvgDataUrl(svg){
  try {
    return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(String(svg || ''));
  } catch (_) {
    return '';
  }
}
function getSiteRuntimeBrandName(){
  try {
    const brand = window.__SITE_BRAND__ || (window.__getSiteBrandConfig ? window.__getSiteBrandConfig() : {});
    const value = String(brand && (brand.storeName || brand.name || window.__SITE_STORE_NAME__) || '').trim();
    if (value) return value;
  } catch {}
  return '';
}
const I18N_SITE_BRAND_PLACEHOLDER = '__SITE_BRAND__';
function escapeRegexText(value){
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function canonicalizeSiteBrandText(value){
  let text = String(value || '');
  const brandName = getSiteRuntimeBrandName();
  if (!text || !brandName) return text;
  try {
    text = text.replace(new RegExp(escapeRegexText(brandName), 'gi'), I18N_SITE_BRAND_PLACEHOLDER);
  } catch {}
  return text;
}
function restoreSiteBrandText(value){
  let text = String(value || '');
  if (!text || text.indexOf(I18N_SITE_BRAND_PLACEHOLDER) < 0) return text;
  const brandName = getSiteRuntimeBrandName();
  text = text.split(I18N_SITE_BRAND_PLACEHOLDER).join(brandName || '');
  return text
    .replace(/\(\s*\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
function buildSiteMediaPlaceholder(kind, label){
  const baseLabel = String(label || getSiteRuntimeBrandName() || '').trim();
  const safeLabel = escapeSiteSvgText(baseLabel);
  const safeInitial = escapeSiteSvgText(baseLabel.charAt(0) || '');
  const bannerTitle = safeLabel ? `<text x="80" y="188" fill="#ffffff" font-family="Arial,sans-serif" font-size="48" font-weight="700">${safeLabel.slice(0, 30)}</text>` : '';
  const headerTitle = safeLabel ? `<text x="110" y="41" text-anchor="middle" fill="#ffffff" font-family="Arial,sans-serif" font-size="24" font-weight="700">${safeLabel.slice(0, 16)}</text>` : '';
  const iconTitle = safeInitial ? `<text x="48" y="60" text-anchor="middle" fill="#ffffff" font-family="Arial,sans-serif" font-size="34" font-weight="700">${safeInitial}</text>` : '';
  if (kind === 'banner') {
    return buildSiteSvgDataUrl(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 420">
        <defs>
          <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#0f172a"/>
            <stop offset="55%" stop-color="#1d4ed8"/>
            <stop offset="100%" stop-color="#38bdf8"/>
          </linearGradient>
        </defs>
        <rect width="1200" height="420" rx="36" fill="url(#g)"/>
        <circle cx="1080" cy="76" r="164" fill="rgba(255,255,255,.12)"/>
        <circle cx="130" cy="354" r="210" fill="rgba(255,255,255,.08)"/>
        ${bannerTitle}
        <text x="80" y="242" fill="rgba(255,255,255,.86)" font-family="Arial,sans-serif" font-size="24">Firebase Media Ready</text>
      </svg>`
    );
  }
  if (kind === 'header') {
    return buildSiteSvgDataUrl(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 64">
        <defs>
          <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#0f172a"/>
            <stop offset="100%" stop-color="#2563eb"/>
          </linearGradient>
        </defs>
        <rect width="220" height="64" rx="18" fill="url(#g)"/>
        ${headerTitle}
      </svg>`
    );
  }
  return buildSiteSvgDataUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0f172a"/>
          <stop offset="100%" stop-color="#2563eb"/>
        </linearGradient>
      </defs>
      <rect width="96" height="96" rx="24" fill="url(#g)"/>
      <circle cx="48" cy="48" r="30" fill="rgba(255,255,255,.12)"/>
      ${iconTitle}
    </svg>`
  );
}
function readCachedSiteMediaObject(){
  try {
    const raw = localStorage.getItem('site:media:v1');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}
function readCachedSiteMediaCandidate(keys){
  const parsed = readCachedSiteMediaObject();
  if (!parsed || !Array.isArray(keys)) return '';
  for (let i = 0; i < keys.length; i += 1) {
    const key = String(keys[i] || '').trim();
    if (!key) continue;
    const value = trimSiteMediaUrl(parsed[key]);
    if (value) return value;
  }
  return '';
}
function resolveSiteMediaFallbackUrl(kind, label){
  const iconKeys = ['siteIcon', 'site_icon', 'icon', 'iconUrl', 'icon_url', 'favicon', 'faviconUrl', 'favicon_url', 'windowIcon', 'window_icon', 'windowImage', 'window_image'];
  const headerKeys = ['headerLogo', 'header_logo', 'logo', 'logoUrl', 'logo_url'];
  const loaderKeys = ['loaderLogo', 'loader_logo', 'loaderImage', 'loader_image', 'preloaderLogo', 'preloader_logo', 'loader'];
  const candidates = [];
  if (kind === 'loader') {
    candidates.push(window.__SITE_LOADER_IMAGE__);
    candidates.push(readCachedSiteMediaCandidate(loaderKeys));
  } else if (kind === 'header') {
    candidates.push(window.__SITE_HEADER_LOGO__);
    candidates.push(readCachedSiteMediaCandidate(headerKeys));
  } else if (kind === 'icon') {
    candidates.push(window.__SITE_ICON__);
    candidates.push(readCachedSiteMediaCandidate(iconKeys));
  } else if (kind === 'catalog') {
    candidates.push("");
  }
  for (let i = 0; i < candidates.length; i += 1) {
    const value = trimSiteMediaUrl(candidates[i]);
    if (value) return value;
  }
  return kind === 'icon' ? buildSiteMediaPlaceholder(kind, label) : '';
}
try { window.__createSiteMediaPlaceholderUrl = buildSiteMediaPlaceholder; } catch {}
try { window.__resolveSiteMediaFallbackUrl = resolveSiteMediaFallbackUrl; } catch {}

// Preload image asset used elsewhere
(function(){
  try {
    const imgHref = resolveSiteMediaFallbackUrl('loader');
    if (!imgHref) return;
    if (document.head && !document.querySelector(`link[rel='preload'][as='image'][href='${imgHref}']`)){
      const ln2 = document.createElement('link'); ln2.rel = 'preload'; ln2.as = 'image'; ln2.href = imgHref; document.head.appendChild(ln2);
    }
    const img = new Image(); img.decoding = 'async'; try { img.fetchPriority = 'high'; } catch {} img.loading = 'eager'; img.src = imgHref;
  } catch {}
})();

// Loader controls
// Inline loader CSS so pages no longer depend on a separate loader.css file.
(function injectInlineLoaderCss(){
  try {
    if (document.querySelector('style[data-inline-loader-css="1"]')) return;
    var style = document.createElement('style');
    style.setAttribute('data-inline-loader-css', '1');
    style.textContent = `
#preloader {
  position: fixed;
  inset: 0 !important;
  width: 100vw;
  height: 100dvh;
  --overlay: rgba(246, 247, 255, 0.65);
  background: var(--overlay);
  -webkit-backdrop-filter: blur(6px);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1700 !important;
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
  transition: opacity 0.28s ease, visibility 0.28s ease;
  will-change: opacity, visibility;
}

@keyframes preloaderAutoHide { to { opacity: 0; visibility: hidden; } }
#preloader.auto-hide { animation: preloaderAutoHide 0s linear 1.2s forwards; }
#preloader.preparing-intro {
  opacity: 1 !important;
  visibility: visible !important;
  pointer-events: auto !important;
}

#preloader.showing-instant {
  transition: none !important;
}

#preloader.entering {
  visibility: visible !important;
  pointer-events: auto !important;
}

html.pre-login-route #preloader,
body.login-route-active #preloader,
body[data-inline-route="login"] #preloader,
body:has(#loginInline:not(.hidden)) #preloader {
  inset: 0 !important;
  z-index: 200000 !important;
}

html[data-theme="dark"] #preloader,
body.dark-mode #preloader {
  --overlay: rgba(5, 5, 11, 0.72);
}

html.inline-wallet-route-pending #preloader,
body.inline-wallet-route-pending #preloader,
html.inline-wallet-route-pending #preloader.hidden,
body.inline-wallet-route-pending #preloader.hidden,
html.inline-wallet-route-pending #preloader.closing,
body.inline-wallet-route-pending #preloader.closing {
  display: flex !important;
  opacity: 1 !important;
  visibility: visible !important;
  pointer-events: auto !important;
  z-index: 200000 !important;
}

html.inline-wallet-route-pending #preloader.preparing-intro .loader,
body.inline-wallet-route-pending #preloader.preparing-intro .loader {
  opacity: 1 !important;
  transform: scale(1) !important;
  animation: loader-pulse 1.2s ease-in-out infinite !important;
}

html.inline-wallet-route-pending #preloader.entering .loader,
body.inline-wallet-route-pending #preloader.entering .loader {
  opacity: 1 !important;
  animation:
    loader-pop-in 0.34s cubic-bezier(0.16, 0.6, 0.35, 1) both,
    loader-pulse 1.2s ease-in-out 0.34s infinite !important;
}

html.inline-wallet-route-pending #preloader:not(.preparing-intro):not(.entering) .loader,
body.inline-wallet-route-pending #preloader:not(.preparing-intro):not(.entering) .loader {
  opacity: 1 !important;
  transform: scale(1) !important;
  animation: loader-pulse 1.2s ease-in-out infinite !important;
}

html.inline-wallet-route-pending #depositInlineContainer,
body.inline-wallet-route-pending #depositInlineContainer,
html.inline-wallet-route-pending #depositInlineApp,
body.inline-wallet-route-pending #depositInlineApp {
  visibility: visible !important;
  pointer-events: none !important;
}

#preloader.hidden { opacity: 0; visibility: hidden; pointer-events: none; }
#preloader.closing { opacity: 0; visibility: hidden; pointer-events: none; }

.loader {
  position: relative;
  width: 128px;
  height: 128px;
  border-radius: 50%;
  --c1: var(--site-accent-runtime, #6b7280);
  --c2: var(--site-accent-runtime-light, #94a3b8);
  --c3: var(--site-accent-runtime-strong, #475569);
  filter: drop-shadow(0 6px 18px rgba(var(--site-accent-rgb, 107, 114, 128), 0.35));
  transition: transform 0.4s ease, opacity 0.4s ease;
  opacity: 1;
  transform: scale(1);
  animation: loader-pulse 1.2s ease-in-out infinite;
  display: grid;
  place-items: center;
  background-image: none;
  background-repeat: no-repeat;
  background-position: center;
  background-size: 72px 72px;
}

#preloader.entering .loader {
  animation:
    loader-pop-in 0.34s cubic-bezier(0.16, 0.6, 0.35, 1) both,
    loader-pulse 1.2s ease-in-out 0.34s infinite;
}

#preloader.preparing-intro .loader {
  opacity: 1 !important;
  transform: scale(0.32) !important;
  animation: none !important;
}

#preloader.closing .loader {
  animation: loader-pop-out 0.22s cubic-bezier(0.32, 0.72, 0, 1) both;
}

html[data-theme="dark"] .loader,
body.dark-mode .loader {
  --c1: var(--site-accent-runtime, #6b7280);
  --c2: var(--site-accent-runtime-light, #cbd5e1);
  --c3: var(--site-accent-runtime-light, #cbd5e1);
}

.loader::before,
.loader::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: 50%;
  -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 8px), #000 calc(100% - 7px));
          mask: radial-gradient(farthest-side, transparent calc(100% - 8px), #000 calc(100% - 7px));
}

.loader::before {
  background: conic-gradient(from 0deg, var(--c1) 0 140deg, transparent 140deg 360deg);
  animation: ring-spin-a 0.8s linear infinite;
}

.loader::after {
  inset: 10px;
  background: conic-gradient(from 180deg, var(--c3) 0 110deg, transparent 110deg 360deg);
  animation: ring-spin-b 0.9s linear infinite reverse;
}

#preloader.hidden .loader {
  animation: none !important;
  transform: scale(0.84);
  opacity: 0;
}

@keyframes loader-pop-in {
  0% { transform: scale(0.18); opacity: 1; }
  68% { transform: scale(1.1); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}

@keyframes loader-pop-out {
  0% { transform: scale(1); opacity: 1; }
  100% { transform: scale(0.84); opacity: 0; }
}

@keyframes loader-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

@keyframes ring-spin-a { to { transform: rotate(1turn); } }
@keyframes ring-spin-b { to { transform: rotate(1turn); } }

@media (prefers-reduced-motion: reduce) {
  #preloader.entering { animation: none; }
  .loader { animation: none; }
  #preloader.entering .loader,
  #preloader.closing .loader { animation: none; }
  .loader::before { animation-duration: 1.4s; }
  .loader::after  { animation-duration: 1.6s; }
}

.loader img.loader-logo {
  width: 72px;
  height: 72px;
  object-fit: contain;
  border-radius: 12px;
  pointer-events: none;
  user-select: none;
  -webkit-user-drag: none;
}
.loader img.loader-logo[hidden] {
  display: none !important;
}

@media (max-width: 480px) {
  #preloader { -webkit-backdrop-filter: none; backdrop-filter: none; }
  .loader { filter: none; }
}
    `;
    (document.head || document.documentElement).appendChild(style);
  } catch {}
})();

function ensureSiteLoaderLogoNode(loaderNode){
  try {
    if (!loaderNode || !loaderNode.querySelector) return null;
    let img = loaderNode.querySelector('img.loader-logo');
    if (img) return img;
    img = document.createElement('img');
    img.className = 'loader-logo';
    img.alt = getSiteRuntimeBrandName();
    img.decoding = 'async';
    try { img.fetchPriority = 'high'; } catch {}
    img.loading = 'eager';
    img.addEventListener('error', function(){
      try { img.removeAttribute('src'); } catch {}
      try { img.removeAttribute('srcset'); } catch {}
      try { img.hidden = true; } catch {}
      try { img.style.display = 'none'; } catch {}
    });
    loaderNode.appendChild(img);
    return img;
  } catch {
    return null;
  }
}

// Ensure a preloader element exists so pages and older scripts can safely toggle it
(function ensurePreloader(){
  try {
    let el = document.getElementById('preloader');
    if (!el) {
      el = document.createElement('div');
      el.id = 'preloader';
      el.className = 'hidden';
      el.style.position = 'fixed';
      el.style.inset = '0';
      el.style.display = 'none';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';
      el.style.zIndex = '200000';
      (document.body || document.documentElement).appendChild(el);
    }
    if (!el.querySelector('.loader')) {
      try { el.innerHTML = ''; } catch {}
      const loaderRing = document.createElement('div');
      loaderRing.className = 'loader';
      loaderRing.setAttribute('aria-label', 'جارِ التحميل');
      ensureSiteLoaderLogoNode(loaderRing);
      el.appendChild(loaderRing);
    }
  } catch {}
})();

function cancelPageLoaderHideTimer(){
  try {
    clearTimeout(window.__PAGE_LOADER_HIDE_TIMER__);
    window.__PAGE_LOADER_HIDE_TIMER__ = null;
  } catch {}
}
function cancelPageLoaderEnterTimer(){
  try {
    clearTimeout(window.__PAGE_LOADER_ENTER_TIMER__);
    window.__PAGE_LOADER_ENTER_TIMER__ = null;
  } catch {}
}
function cancelPageLoaderIntroFrame(){
  try {
    if (window.__PAGE_LOADER_ENTER_RAF__) {
      cancelAnimationFrame(window.__PAGE_LOADER_ENTER_RAF__);
      window.__PAGE_LOADER_ENTER_RAF__ = 0;
    }
  } catch {}
}
function shouldSkipPageLoaderIntro(el){
  try {
    if (!el) return true;
    if (el.classList.contains('entering') || el.classList.contains('preparing-intro')) return true;
    var isVisible =
      !el.classList.contains('hidden') &&
      !el.classList.contains('closing') &&
      String(el.style.display || '').toLowerCase() !== 'none';
    if (!isVisible) return false;
    var lastIntroAt = Number(window.__PAGE_LOADER_LAST_INTRO_AT__ || 0) || 0;
    if (!lastIntroAt) return false;
    return (Date.now() - lastIntroAt) < 420;
  } catch {}
  return false;
}
function markPageLoaderIntroStarted(){
  try { window.__PAGE_LOADER_LAST_INTRO_AT__ = Date.now(); } catch {}
}
function schedulePageLoaderEnterCleanup(el, delay){
  try {
    cancelPageLoaderEnterTimer();
    window.__PAGE_LOADER_ENTER_TIMER__ = setTimeout(function(){
      try {
        if (!el || el.classList.contains('hidden') || el.classList.contains('closing')) return;
        el.classList.remove('entering', 'preparing-intro', 'showing-instant');
      } catch(_){}
    }, delay);
  } catch {}
}
function primePageLoaderIntro(el){
  try {
    const target = el || document.getElementById('preloader');
    if (!target) return;
    if (shouldSkipPageLoaderIntro(target)) return;
    cancelPageLoaderHideTimer();
    cancelPageLoaderEnterTimer();
    cancelPageLoaderIntroFrame();
    markPageLoaderIntroStarted();
    target.classList.remove('entering', 'showing-instant', 'hidden', 'closing', 'auto-hide');
    target.classList.add('preparing-intro', 'showing-instant');
    target.style.display = 'flex';
    target.style.transition = 'none';
    target.style.opacity = '1';
    target.style.visibility = 'visible';
    target.style.pointerEvents = 'auto';
    void target.offsetWidth;
    var startIntro = function(){
      try {
        target.classList.remove('preparing-intro');
        target.classList.add('entering');
        target.style.transition = '';
        schedulePageLoaderEnterCleanup(target, 380);
      } catch(_){}
    };
    if (typeof requestAnimationFrame === 'function') {
      window.__PAGE_LOADER_ENTER_RAF__ = requestAnimationFrame(function(){
        try { window.__PAGE_LOADER_ENTER_RAF__ = 0; } catch(_){}
        startIntro();
      });
    } else {
      startIntro();
    }
  } catch {}
}
function schedulePageLoaderHideDisplay(el, delay){
  try {
    cancelPageLoaderHideTimer();
    window.__PAGE_LOADER_HIDE_TIMER__ = setTimeout(function(){
      try {
        if (el) {
          el.classList.remove('entering', 'closing');
          el.classList.add('hidden');
          el.style.display = 'none';
        }
      } catch(_){}
    }, delay);
  } catch {}
}
try { window.__cancelPageLoaderHideTimer = cancelPageLoaderHideTimer; } catch {}
try { window.__cancelPageLoaderEnterTimer = cancelPageLoaderEnterTimer; } catch {}
try { window.__cancelPageLoaderIntroFrame = cancelPageLoaderIntroFrame; } catch {}
try { window.__shouldSkipPageLoaderIntro = shouldSkipPageLoaderIntro; } catch {}
try { window.__primePageLoaderIntro = primePageLoaderIntro; } catch {}
function showPageLoader(opts){
  try {
    const el = document.getElementById('preloader');
    if (!el) return;
    const hold = !!(opts && opts.hold);
    const replayIntro = !!(opts && opts.replay);
    const shouldAnimateIn =
      el.classList.contains('hidden') ||
      el.classList.contains('closing') ||
      String(el.style.display || '').toLowerCase() === 'none';
    try {
      sessionStorage.setItem('nav:loader:expected','1');
      sessionStorage.setItem('nav:loader:showAt', String(Date.now()));
    } catch {}
    cancelPageLoaderHideTimer();
    cancelPageLoaderEnterTimer();
    cancelPageLoaderIntroFrame();
    el.classList.remove('hidden', 'closing', 'auto-hide');
    el.style.display = 'flex';
    el.style.visibility = 'visible';
    el.style.pointerEvents = 'auto';
    if (shouldAnimateIn || replayIntro) {
      primePageLoaderIntro(el);
    } else {
      el.classList.remove('preparing-intro', 'showing-instant');
      el.style.transition = '';
      el.style.opacity = '1';
    }
    try {
      clearTimeout(window.__NAV_LOADER_TIMEOUT__);
      if (!hold) {
        window.__NAV_LOADER_TIMEOUT__ = setTimeout(function(){
          try { sessionStorage.removeItem('nav:loader:expected'); sessionStorage.removeItem('nav:loader:showAt'); } catch(_){ }
          try { hidePageLoader(); } catch(_){ }
        }, 300);
      }
    } catch {}
  } catch {}
}
function shouldKeepPageLoaderVisible(){
  try {
    try {
      if (window.__INLINE_WALLET_ROUTE_PENDING__ === true) return true;
      if (document.documentElement && document.documentElement.classList.contains('inline-wallet-route-pending')) return true;
      if (document.body && document.body.classList.contains('inline-wallet-route-pending')) return true;
    } catch {}
    let securityRoute = '';
    try {
      securityRoute = String(document.body && document.body.getAttribute('data-inline-route') || '').toLowerCase();
    } catch {}
    if (securityRoute === 'security') {
      try {
        if (window.__SECURITY_CONFIG_LOADING__ === true) return true;
      } catch {}
      try {
        const pendingSecurityPage = document.querySelector('.security-page[data-config-ready="false"]');
        if (pendingSecurityPage) return true;
      } catch {}
    }
  } catch {}
  return false;
}
function hidePageLoader(opts){
  try {
    const allowForceHide = !!(opts && opts.force);
    let holdActive = false;
    try { holdActive = !!window.__LOADER_HOLD_ACTIVE__; } catch {}
    if (!holdActive) {
      try { holdActive = shouldKeepPageLoaderVisible(); } catch {}
    }
    if (holdActive) {
      if (!allowForceHide) return;
      try { window.__LOADER_HOLD_ACTIVE__ = false; } catch {}
    }
    const el = document.getElementById('preloader');
    if (!el) return;
    try { sessionStorage.removeItem('nav:loader:expected'); sessionStorage.removeItem('nav:loader:showAt'); } catch(_){ }
    cancelPageLoaderHideTimer();
    cancelPageLoaderEnterTimer();
    cancelPageLoaderIntroFrame();
    el.classList.remove('entering', 'preparing-intro', 'showing-instant', 'hidden');
    el.classList.add('closing');
    el.style.transition = 'opacity 0.28s ease, visibility 0.28s ease';
    el.style.opacity = '0';
    el.style.visibility = 'hidden';
    el.style.pointerEvents = 'none';
    schedulePageLoaderHideDisplay(el, 260);
  } catch {}
}
window.addEventListener('pageshow', () => { try { if (sessionStorage.getItem('nav:loader:expected') === '1') return; } catch {} hidePageLoader(); });

// Suppress hover URL badge and block native dragging for links/images/buttons.
(function setupHoverHrefAndDragGuards(){
  const HOVER_HREF_ATTR = 'data-hover-href-suppressed';
  const DRAG_BLOCK_SELECTOR = 'a,button,img,[role="button"]';

  function supportsFineHover(){
    try {
      return !!(window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches);
    } catch {}
    return false;
  }

  function getAnchorFromTarget(target, selector){
    const element = target && target.closest ? target.closest(selector || 'a') : null;
    if (!element) return null;
    return String(element.tagName || '').toLowerCase() === 'a' ? element : null;
  }

  function getAnchorEffectiveHref(anchor){
    if (!anchor || !anchor.getAttribute) return '';
    return String(
      anchor.getAttribute('href') ||
      anchor.getAttribute(HOVER_HREF_ATTR) ||
      ''
    ).trim();
  }

  function shouldSuppressHoverHref(anchor){
    if (!anchor || !anchor.getAttribute) return false;
    if (anchor.hasAttribute('data-allow-hover-href')) return false;
    const href = getAnchorEffectiveHref(anchor);
    if (!href || href === '#') return false;
    if (/^javascript:/i.test(href)) return false;
    return true;
  }

  function suppressHoverHref(anchor){
    if (!shouldSuppressHoverHref(anchor)) return;
    if (anchor.hasAttribute(HOVER_HREF_ATTR)) return;
    const href = String(anchor.getAttribute('href') || '').trim();
    if (!href) return;
    anchor.setAttribute(HOVER_HREF_ATTR, href);
    anchor.removeAttribute('href');
  }

  function restoreHoverHref(anchor){
    if (!anchor || !anchor.getAttribute || !anchor.hasAttribute(HOVER_HREF_ATTR)) return;
    const href = String(anchor.getAttribute(HOVER_HREF_ATTR) || '').trim();
    if (href) anchor.setAttribute('href', href);
    anchor.removeAttribute(HOVER_HREF_ATTR);
  }

  function markUndraggable(scope){
    if (!scope) return;
    const apply = function(node){
      if (!node || node.nodeType !== 1) return;
      try { node.setAttribute('draggable', 'false'); } catch {}
    };
    if (scope.matches && scope.matches(DRAG_BLOCK_SELECTOR)) apply(scope);
    if (scope.querySelectorAll) {
      scope.querySelectorAll(DRAG_BLOCK_SELECTOR).forEach(apply);
    }
  }

  document.addEventListener('mouseover', function(event){
    if (!supportsFineHover()) return;
    const anchor = getAnchorFromTarget(event.target, 'a[href]');
    if (!anchor) return;
    if (event.relatedTarget && anchor.contains(event.relatedTarget)) return;
    suppressHoverHref(anchor);
  }, true);

  document.addEventListener('mouseout', function(event){
    if (!supportsFineHover()) return;
    const anchor = getAnchorFromTarget(event.target, 'a[' + HOVER_HREF_ATTR + ']');
    if (!anchor) return;
    if (event.relatedTarget && anchor.contains(event.relatedTarget)) return;
    restoreHoverHref(anchor);
  }, true);

  document.addEventListener('focusin', function(event){
    const anchor = getAnchorFromTarget(event.target, 'a[' + HOVER_HREF_ATTR + ']');
    if (anchor) restoreHoverHref(anchor);
  }, true);

  document.addEventListener('pointerdown', function(event){
    const anchor = getAnchorFromTarget(event.target, 'a[' + HOVER_HREF_ATTR + ']');
    if (anchor) restoreHoverHref(anchor);
  }, true);

  document.addEventListener('dragstart', function(event){
    const element = event.target && event.target.closest ? event.target.closest(DRAG_BLOCK_SELECTOR) : null;
    if (!element) return;
    try {
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
    } catch {}
  }, true);

  function boot(){
    markUndraggable(document.documentElement || document.body);
    try {
      const observer = new MutationObserver(function(mutations){
        mutations.forEach(function(mutation){
          (mutation.addedNodes || []).forEach(function(node){
            markUndraggable(node);
          });
        });
      });
      observer.observe(document.documentElement || document.body, {
        childList: true,
        subtree: true
      });
    } catch {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();

// Show loader during navigation for internal links
(function setupNavLoader(){
  function hasNoLoader(link){
    try {
      return link.hasAttribute('data-no-loader') || link.getAttribute('data-loader') === 'off';
    } catch { return false; }
  }
  function shouldSkipHref(href){
    if (!href) return true;
    const v = href.trim();
    if (!v || v === '#') return true;
    // Hash-only navigation handled by SPA router; don't block with loader.
    if (v.startsWith('#/')) return true;
    if (v.startsWith('javascript:')) return true;
    if (v.startsWith('mailto:') || v.startsWith('tel:')) return true;
    if (v.startsWith('#') && !v.startsWith('#/')) return true;
    return false;
  }
  function sameOrigin(url){
    try { return url.origin === location.origin; } catch { return false; }
  }
  function handleNav(e){
    try {
      const link = e.target && e.target.closest ? e.target.closest('a[href]') : null;
      if (!link || hasNoLoader(link)) return;
      const target = (link.getAttribute('target') || '').toLowerCase();
      if (target === '_blank') return;
      const href = link.getAttribute('href') || '';
      if (shouldSkipHref(href)) return;
      let url;
      try { url = new URL(href, location.href); } catch { return; }
      if (!sameOrigin(url)) return;
      if (url.pathname === location.pathname && url.search === location.search && url.hash === location.hash) return;
      showPageLoader();
    } catch {}
  }
  document.addEventListener('pointerdown', handleNav, true);
  document.addEventListener('click', handleNav, true);
  window.addEventListener('beforeunload', function(){ try { showPageLoader(); } catch {} });
})();

// Device fingerprint helpers (per-device session id)
const DEVICE_ID_STORAGE_KEY = 'session:device:id';
const DEVICE_INSTANCE_SEED_STORAGE_KEY = 'session:device:seed';
function generateDeviceId(){
  try {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
  } catch {}
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const size = 24;
  let out = '';
  try {
    if (window.crypto && typeof window.crypto.getRandomValues === 'function') {
      const buf = new Uint8Array(size);
      window.crypto.getRandomValues(buf);
      for (let i = 0; i < size; i++) out += alphabet[buf[i] % alphabet.length];
      return out;
    }
  } catch {}
  for (let i = 0; i < size; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}
function readStoredDeviceIdFromSession(){
  try {
    const raw = localStorage.getItem('sessionKeyInfo');
    if (!raw) return '';
    const parsed = JSON.parse(raw);
    const deviceId = String(parsed && parsed.deviceId || '').trim();
    if (deviceId) {
      try { localStorage.setItem(DEVICE_ID_STORAGE_KEY, deviceId); } catch {}
      return deviceId;
    }
  } catch {}
  return '';
}
function getDeviceInstanceSeed(){
  try {
    const cached = localStorage.getItem(DEVICE_INSTANCE_SEED_STORAGE_KEY);
    if (cached) return cached;
  } catch {}
  const seed = generateDeviceId();
  try { localStorage.setItem(DEVICE_INSTANCE_SEED_STORAGE_KEY, seed); } catch {}
  return seed;
}
function ensureDeviceFingerprint(){
  try {
    const cached = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (cached) return cached;
  } catch {}
  const fromSession = readStoredDeviceIdFromSession();
  if (fromSession) return fromSession;
  const id = generateDeviceId();
  try { localStorage.setItem(DEVICE_ID_STORAGE_KEY, id); } catch {}
  return id;
}
function getDeviceFingerprint(){
  return ensureDeviceFingerprint();
}
function collectDeviceInfo(){
  try {
    const nav = navigator || {};
    const uaData = nav.userAgentData || {};
    const scr = window.screen || {};
    const userAgent = String(nav.userAgent || '').trim();
    const rawPlatform = String(uaData.platform || nav.platform || '').trim();
    const brands = Array.isArray(uaData.brands) ? uaData.brands.map((b) => String(b && b.brand || '').trim()).filter(Boolean) : [];
    const text = `${rawPlatform} ${brands.join(', ')} ${userAgent}`.toLowerCase();
    const platform = /android/.test(text) ? 'Android'
      : /iphone/.test(text) ? 'iPhone'
      : /ipad/.test(text) ? 'iPad'
      : /ipod|ios/.test(text) ? 'iOS'
      : /windows|win32|win64/.test(text) ? 'Windows'
      : /mac os|macos|macintosh/.test(text) ? 'macOS'
      : /linux|x11/.test(text) ? 'Linux'
      : rawPlatform;
    const browser = /brave/.test(text) ? 'Brave'
      : (/edg\//.test(text) || /microsoft edge| edge\b/.test(text)) ? 'Edge'
      : /opr\/|opera/.test(text) ? 'Opera'
      : /vivaldi/.test(text) ? 'Vivaldi'
      : /samsungbrowser|samsung internet/.test(text) ? 'Samsung Internet'
      : /firefox|fxios/.test(text) ? 'Firefox'
      : /duckduckgo/.test(text) ? 'DuckDuckGo'
      : /yabrowser/.test(text) ? 'Yandex'
      : (/google chrome|chrome\//.test(text) || /chrome\b/.test(text)) ? 'Chrome'
      : (/safari/.test(text) && !/chrome|chromium|crios|edg|opr|brave|vivaldi/.test(text)) ? 'Safari'
      : /chromium/.test(text) ? 'Chromium'
      : '';
    const label = [platform, browser].filter(Boolean).join(' - ').trim();
    return {
      label: label || '',
      userAgent: userAgent,
      platform: platform,
      language: String(nav.language || ''),
      timezone: (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch { return ''; } })(),
      vendor: String(nav.vendor || '').trim(),
      screenWidth: Number(scr.width) || 0,
      screenHeight: Number(scr.height) || 0,
      viewportWidth: Number(window.innerWidth) || 0,
      viewportHeight: Number(window.innerHeight) || 0,
      pixelRatio: Number(window.devicePixelRatio) || 1,
      colorDepth: Number(scr.colorDepth) || 0,
      hardwareConcurrency: Number(nav.hardwareConcurrency) || 0,
      deviceMemory: Number(nav.deviceMemory) || 0,
      touchPoints: Number(nav.maxTouchPoints) || 0,
      fingerprintVersion: 'v2',
      instanceSeed: getDeviceInstanceSeed()
    };
  } catch (_) {
    return {};
  }
}
try { window.getDeviceFingerprint = getDeviceFingerprint; } catch {}

let sessionDocUnsubscribe = null;
let sessionConflictHandled = false;
function clearSessionDocWatcher(){
  if (sessionDocUnsubscribe){
    try { sessionDocUnsubscribe(); } catch {}
    sessionDocUnsubscribe = null;
  }
}
function ensureSessionConflictDialog(){
  try {
    let overlay = document.getElementById('session-conflict-overlay');
    if (overlay) return overlay;

    if (!document.getElementById('session-conflict-style')) {
      const style = document.createElement('style');
      style.id = 'session-conflict-style';
      style.textContent = `
      .session-conflict-overlay{
        position: fixed;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px;
        background: rgba(3,6,18,.58);
        backdrop-filter: blur(5px);
        z-index: 16000;
        opacity: 0;
        pointer-events: none;
        transition: opacity .18s ease;
      }
      .session-conflict-overlay.is-open{
        opacity: 1;
        pointer-events: auto;
      }
      .session-conflict-card{
        width: min(92vw, 560px);
        border-radius: 16px;
        border: 1px solid rgba(148,163,184,.28);
        background: linear-gradient(160deg, #151827 0%, #11131f 100%);
        box-shadow: 0 26px 70px rgba(0,0,0,.52);
        color: #f8fafc;
        padding: 20px 22px;
      }
      .session-conflict-title{
        margin: 0 0 10px;
        font-size: 1.34rem;
        font-weight: 800;
        line-height: 1.35;
        text-align: center;
      }
      .session-conflict-msg{
        margin: 0 0 18px;
        font-size: 1.02rem;
        line-height: 1.9;
        text-align: center;
        color: rgba(241,245,249,.98);
      }
      .session-conflict-actions{
        display: flex;
        justify-content: center;
      }
      .session-conflict-btn{
        border: 0;
        border-radius: 999px;
        min-width: 98px;
        padding: 10px 18px;
        font-size: 1rem;
        font-weight: 700;
        cursor: pointer;
        color: #10111a;
        background: linear-gradient(135deg,#dbe4ff,#a5b4fc);
        box-shadow: 0 8px 20px rgba(165,180,252,.34);
      }
      .session-conflict-btn:focus-visible{
        outline: 2px solid rgba(191,219,254,.95);
        outline-offset: 2px;
      }`;
      (document.head || document.documentElement).appendChild(style);
    }

    overlay = document.createElement('div');
    overlay.id = 'session-conflict-overlay';
    overlay.className = 'session-conflict-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = `
      <div class="session-conflict-card" role="alertdialog" aria-modal="true" aria-labelledby="sessionConflictTitle" aria-describedby="sessionConflictMessage">
        <h2 id="sessionConflictTitle" class="session-conflict-title">تنبيه أمني</h2>
        <p id="sessionConflictMessage" class="session-conflict-msg"></p>
        <div class="session-conflict-actions">
          <button type="button" id="sessionConflictOkBtn" class="session-conflict-btn">حسنًا</button>
        </div>
      </div>
    `;
    const finish = function(){
      if (!overlay || overlay.__dialogDone) return;
      overlay.__dialogDone = true;
      const cb = overlay.__onClose;
      overlay.__onClose = null;
      try { clearTimeout(overlay.__timer); } catch {}
      overlay.__timer = null;
      overlay.classList.remove('is-open');
      overlay.setAttribute('aria-hidden', 'true');
      if (typeof cb === 'function') {
        try { cb(); } catch {}
      }
    };
    overlay.__finish = finish;
    const okBtn = overlay.querySelector('#sessionConflictOkBtn');
    if (okBtn) {
      okBtn.addEventListener('click', function(){ finish(); });
    }
    overlay.addEventListener('click', function(ev){
      if (ev.target === overlay) finish();
    });
    overlay.addEventListener('keydown', function(ev){
      if (String(ev.key || '') === 'Escape') finish();
    });
    (document.body || document.documentElement).appendChild(overlay);
    return overlay;
  } catch {
    return null;
  }
}
function showSessionConflictDialog(message, { onClose = null, autoCloseMs = 3200 } = {}){
  const overlay = ensureSessionConflictDialog();
  if (!overlay) return false;
  overlay.__dialogDone = false;
  overlay.__onClose = typeof onClose === 'function' ? onClose : null;
  try { clearTimeout(overlay.__timer); } catch {}
  overlay.__timer = null;
  const msgEl = overlay.querySelector('#sessionConflictMessage');
  if (msgEl) msgEl.textContent = String(message || '').trim();
  overlay.setAttribute('aria-hidden', 'false');
  overlay.classList.add('is-open');
  const okBtn = overlay.querySelector('#sessionConflictOkBtn');
  if (okBtn) {
    try { okBtn.focus(); } catch {}
  }
  const timeoutMs = Number(autoCloseMs);
  if (Number.isFinite(timeoutMs) && timeoutMs > 0) {
    overlay.__timer = setTimeout(function(){
      try {
        if (typeof overlay.__finish === 'function') overlay.__finish();
      } catch {}
    }, timeoutMs);
  }
  return true;
}
function triggerSessionConflictLogout(reasonCode){
  if (sessionConflictHandled) return;
  sessionConflictHandled = true;
  clearSessionDocWatcher();
  clearAuthClientState();
  try { window.dispatchEvent(new CustomEvent('session:conflict')); } catch {}
  let message = 'انتهت الجلسة الحالية. يرجى تسجيل الدخول من جديد.';
  const code = String(reasonCode || '').trim();
  if (code === 'session_revoked') message = 'تم تسجيل الخروج من هذا الجهاز.';
  else if (code === 'session_expired') message = 'انتهت صلاحية الجلسة. يرجى تسجيل الدخول مرة أخرى.';
  else if (code === 'session_mismatch' || code === 'session_conflict') {
    message = 'تم تسجيل الدخول من جهاز آخر وتم إنهاء هذه الجلسة.';
  }
  const shown = showSessionConflictDialog(message, {
    autoCloseMs: 3200,
    onClose: function(){
      performClientLogout('index.html#/login');
    }
  });
  if (!shown) {
    try { alert(message); } catch {}
    performClientLogout('index.html#/login');
  }
}
function watchSessionDocForDevice(user){
  clearSessionDocWatcher();
}

// Observe auth/session failures without resending requests
(function setupSessionKeyGuard(){
  try {
    if (typeof window === 'undefined' || typeof window.fetch !== 'function') return;
    if (window.__SESSION_KEY_RETRY_PATCHED__) return;
    const nativeFetch = window.fetch.bind(window);
    window.__SESSION_KEY_RETRY_PATCHED__ = true;

    const SESSION_HEADER = 'X-SessionKey';
    const AUTH_HEADER = 'Authorization';
    const DEVICE_HEADER = 'X-DeviceId';
    const SESSION_ERROR_CODES = new Set(['session_missing','session_invalid','session_mismatch','session_expired','session_not_found','session_revoked','session_conflict']);
    const AUTH_ERROR_CODES = new Set([
      'auth_missing','auth_required','invalid_token','token_expired','invalid_alg','invalid_signature',
      'invalid_issuer','invalid_audience','jwk_not_found','sub_userid_mismatch','firestore_auth_missing','jwt_parse_error'
    ]);
    let authRefreshPromise = null;

    function requestCarriesSession(req){
      try { return !!req.headers.get(SESSION_HEADER); } catch { return false; }
    }
    function requestCarriesAuth(req){
      try {
        const header = req.headers.get(AUTH_HEADER) || '';
        return /^Bearer\s+\S+/i.test(header);
      } catch { return false; }
    }
    function isAuthActionRequest(req){
      try {
        const url = new URL(req.url, location.href);
        const action = String(url.searchParams.get('action') || '').trim().toLowerCase();
        if (action === 'auth') return true;
        const pathname = String(url.pathname || '').trim().toLowerCase();
        if (pathname === '/auth' || pathname.endsWith('/auth')) return true;
      } catch {}
      return false;
    }
    function shouldIntercept(req){
      if (isAuthActionRequest(req)) return false;
      return requestCarriesSession(req) || requestCarriesAuth(req);
    }
    function normalizeCode(val){
      return (typeof val === 'string' ? val : '').trim().toLowerCase();
    }
    function isSessionCode(code){
      if (!code) return false;
      return SESSION_ERROR_CODES.has(code) || code.startsWith('session_');
    }
    function isAuthCode(code){
      if (!code) return false;
      return AUTH_ERROR_CODES.has(code);
    }
    function grabSessionCode(payload){
      if (!payload || typeof payload !== 'object') return '';
      const fields = ['code','errorCode','error_code','error'];
      for (let i = 0; i < fields.length; i++){
        const code = normalizeCode(payload[fields[i]]);
        if (code) return code;
      }
      return '';
    }
    function extractTtl(payload){
      if (!payload || typeof payload !== 'object') return 0;
      const ttl = Number(payload.ttlSeconds ?? payload.ttl ?? payload.ttl_seconds ?? payload.ttlseconds ?? payload.sessionTtl ?? 0);
      return Number.isFinite(ttl) && ttl > 0 ? ttl : 0;
    }
    function rebuildRequestWithHeaders(request, mutateHeaders){
      try {
        const headers = new Headers(request.headers);
        mutateHeaders(headers);
        return new Request(request, { headers, signal: request.signal });
      } catch (err) {
        console.warn('Failed to rebuild request for retry:', err);
        return null;
      }
    }
    function readSessionDeviceId(){
      try {
        const cached = JSON.parse(localStorage.getItem('sessionKeyInfo') || 'null');
        const deviceId = cached && cached.deviceId ? String(cached.deviceId || '').trim() : '';
        return deviceId || '';
      } catch {
        return '';
      }
    }
    function ensureDeviceHeader(request){
      if (!requestCarriesSession(request)) return request;
      try {
        const current = request.headers.get(DEVICE_HEADER);
        if (current) return request;
      } catch {}
      const sessionDeviceId = readSessionDeviceId();
      if (!sessionDeviceId) return request;
      const updated = rebuildRequestWithHeaders(request, headers => { headers.set(DEVICE_HEADER, sessionDeviceId); });
      return updated || request;
    }
    async function classifyForRetry(resp, req){
      if (!resp || typeof resp.clone !== 'function') return null;
      let payload = null;
      try { payload = await resp.clone().json(); } catch {}
      const code = grabSessionCode(payload);
      const ttlSeconds = extractTtl(payload);
      const statusIs401 = Number(resp.status) === 401;
      const hasSession = requestCarriesSession(req);
      const hasAuth = requestCarriesAuth(req);

      if (hasSession && isSessionCode(code)) {
        return { kind: 'session', ttlSeconds, code: code || (statusIs401 ? 'session_http_401' : '') };
      }
      if (hasAuth && (isAuthCode(code) || (statusIs401 && !code))) {
        return { kind: 'auth', ttlSeconds: 0, code: code || (statusIs401 ? 'auth_http_401' : '') };
      }
      return null;
    }

    window.fetch = async function sessionAwareFetch(input, init){
      let request;
      try { request = new Request(input, init); }
      catch (_) { return nativeFetch(input, init); }
      request = ensureDeviceHeader(request);
      if (!shouldIntercept(request)) {
        return nativeFetch(request);
      }

      const response = await nativeFetch(request.clone());
      const action = await classifyForRetry(response, request);
      if (action && action.kind === 'session'){
        const conflictCodes = new Set(['session_conflict','session_mismatch','session_revoked']);
        if (conflictCodes.has(action.code)) {
          triggerSessionConflictLogout(action.code);
        }
      }
      return response;
    };
  } catch (err) {
    console.warn('Session auto-retry bootstrap failed:', err);
  }
})();

// =============================
// Currency utils and formatting
// =============================
(function setupCurrency(){
  try {
    const CURRENCY_KEY = 'currency:selected';
    const RATES_CACHE_KEY = 'currency:rates:cache';
    const RATES_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

    const STORE_BASE_CODE = 'USD'; // Balance stored in database is USD.
    // Rates map — filled from cache or Firebase
    const CURRENCIES = {};
    let ratesListenerStarted = false;
    let ratesRestLoadInFlight = false;
    let ratesCacheMeta = { updatedAt: 0 };
    function getFxBase(){ try { return window.__CURRENCY_BASE__ || null; } catch { return null; } }
    function getRates(){ try { return window.__CURRENCIES__ || CURRENCIES; } catch { return CURRENCIES; } }
    function normalizeCurrencyCode(value){
      const raw = String(value || '').trim().toUpperCase();
      if (!raw) return '';
      return /^[A-Z0-9]{2,8}$/.test(raw) ? raw : '';
    }
    function resolveFallbackCurrency(map){
      const MAP = map || getRates();
      const baseCode = normalizeCurrencyCode(getFxBase()) || STORE_BASE_CODE;
      if (MAP && MAP[baseCode]) return baseCode;
      const keys = Object.keys(MAP || {});
      if (keys.length) return keys[0];
      return baseCode || STORE_BASE_CODE;
    }

    function readCachedRates(){
      try {
        const raw = localStorage.getItem(RATES_CACHE_KEY);
        if (!raw) return null;
        const data = JSON.parse(raw);
        if (!data || typeof data !== 'object') return null;
        const updatedAt = Number(data.updatedAt);
        const rates = data.rates;
        const base = typeof data.base === 'string' ? data.base.toUpperCase() : 'USD';
        if (!updatedAt || !rates || typeof rates !== 'object') return null;
        ratesCacheMeta.updatedAt = updatedAt;
        return { updatedAt, rates, base };
      } catch { return null; }
    }
    function writeCachedRates(rates, base){
      try {
        const payload = {
          updatedAt: Date.now(),
          base: (base || 'USD'),
          rates
        };
        ratesCacheMeta.updatedAt = payload.updatedAt;
        localStorage.setItem(RATES_CACHE_KEY, JSON.stringify(payload));
      } catch {}
    }
    function isRatesCacheFresh(){
      if (!ratesCacheMeta.updatedAt) return false;
      try {
        return (Date.now() - ratesCacheMeta.updatedAt) < RATES_CACHE_TTL_MS;
      } catch { return false; }
    }

    function getSelected(){
      let stored = '';
      try { stored = normalizeCurrencyCode(localStorage.getItem(CURRENCY_KEY)); } catch {}
      const MAP = getRates();
      if (MAP && typeof MAP === 'object' && Object.keys(MAP).length) {
        if (stored && MAP[stored]) return stored;
        return resolveFallbackCurrency(MAP);
      }
      return stored || resolveFallbackCurrency(MAP);
    }
    function setSelected(code){
      const MAP = getRates();
      const requested = normalizeCurrencyCode(code);
      let next = requested || getSelected();
      if (MAP && typeof MAP === 'object' && Object.keys(MAP).length) {
        if (!MAP[next]) next = resolveFallbackCurrency(MAP);
      } else if (!next) {
        next = resolveFallbackCurrency(MAP);
      }
      try { localStorage.setItem(CURRENCY_KEY, next); } catch {}
      try { window.dispatchEvent(new CustomEvent('currency:change', { detail: { code: next } })); } catch {}
      try { applyCurrencyNow(); } catch {}
    }

    function convertAmount(amount, fromCode, toCode){
      const n = Number(amount || 0);
      if (!Number.isFinite(n)) return 0;
      const MAP = getRates();
      const BASE = getFxBase();
      if (fromCode === toCode) return n;
      const rFrom = (MAP[fromCode] && Number(MAP[fromCode].rate)) || (fromCode === BASE ? 1 : null);
      const rTo   = (MAP[toCode]   && Number(MAP[toCode].rate))   || (toCode   === BASE ? 1 : null);
      let baseAmt;
      if (fromCode === BASE) baseAmt = n; else baseAmt = rFrom ? (n / rFrom) : n;
      let out;
      if (toCode === BASE) out = baseAmt; else out = rTo ? (baseAmt * rTo) : baseAmt;
      return out;
    }
    function convertFromJOD(amountJOD, toCode){
      return convertAmount(amountJOD, STORE_BASE_CODE, toCode);
    }
    function convertToJOD(amount, fromCode){
      return convertAmount(amount, fromCode, STORE_BASE_CODE);
    }
    function formatAmountFromJOD(amountJOD, toCode){
      const MAP = getRates();
      const requested = normalizeCurrencyCode(toCode) || getSelected();
      const code = (MAP && MAP[requested]) ? requested : resolveFallbackCurrency(MAP);
      const cur = MAP[code] || MAP[STORE_BASE_CODE] || {};
      const val = convertFromJOD(amountJOD, code);
      const symbol = cur.symbol || cur.code || code || '$';
      return Number(val).toFixed(3) + ' ' + symbol;
    }

    // Expose for other scripts/pages if needed
    try {
      window.__CURRENCIES__ = CURRENCIES;
      window.__CURRENCY_BASE__ = null;
      window.getSelectedCurrencyCode = getSelected;
      window.setSelectedCurrencyCode = setSelected;
      window.convertFromJOD = convertFromJOD;
      window.formatCurrencyFromJOD = (v)=>formatAmountFromJOD(v);
    } catch {}

    // Price application helpers (best-effort DOM scan)
    function collectPriceNodes(root){
  const doc = root || document;
  const sels = [
    '#pm-price', '.pm-pill', '.offer-price', '.voucher .price',
    '.price', "[class*='price']", "[id*='price']", '#balanceAmount',
    '.buy', '.buy-btn', '.price-btn', '.card .btn', 'a.btn', 'button.btn',
    '[data-price]', '[data-price-jod]', '[data-price-usd]', '[data-amount]'
  ];
  const nodes = new Set();
  try { sels.forEach(sel => { doc.querySelectorAll(sel).forEach(el => nodes.add(el)); }); } catch {}
  return Array.from(nodes);
}
    function parseRatesJsonSafe(raw){
      try {
        if (!raw) return {};
        if (typeof raw === 'object') return raw;
        let s = String(raw)
          .replace(/\uFEFF/g,'')
          .replace(/[\u200f\u200e\u202a-\u202e]/g,'')
          .replace(/[“”«»]/g,'"')
          .replace(/[‘’]/g,"'")
          .replace(/،/g,',')
          .replace(/؛/g,',');
        // إذا كان النص ملفوفًا بعلامات اقتباس ويبدأ بـ {، أزل الاقتباس الزائد
        if (/^"\{/.test(s) && /\}"$/.test(s)) s = s.slice(1, -1);
        s = s.replace(/([\{,]\s*)([A-Za-z_][A-Za-z0-9_-]*)\s*:/g,'$1"$2":');
        s = s.replace(/([\{,]\s*)'([^']*)'\s*:/g,'$1"$2":');
        s = s.replace(/:\s*'([^']*)'/g,':"$1"');
        // إزالة الفواصل الزائدة
        s = s.replace(/,(\s*[}\]])/g,'$1');
        const obj = JSON.parse(s);
        return (obj && typeof obj === 'object') ? obj : {};
      } catch (e) {
        try { console.warn('Failed to parse ratesJson:', e); } catch {}
        return {};
      }
    }
    function guessCodeFromText(t){
      try {
        const s = String(t||'');
        if (/\$/.test(s)) return 'USD';
        if (/د\.أ|دينار/.test(s)) return 'JOD';
        if (/ر\.س|ريال/.test(s)) return 'SAR';
        if (/ج\.م|جنيه/.test(s)) return 'EGP';
      } catch {}
      return '';
    }
    function parseNumberFromText(t){
      if (!t) return null;
      const s = String(t).replace(/[\u0660-\u0669]/g, (d)=> String(d.charCodeAt(0) - 0x0660)) // Arabic-Indic digits ? Latin
                          .replace(/[^0-9.,]/g,'')
                          .replace(/,(?=\d{3}(\D|$))/g, '') // drop thousand commas
                          .replace(',', '.');
      const n = parseFloat(s);
      return Number.isFinite(n) ? n : null;
    }

    function applyCurrencyToPrices(root){
      const code = getSelected();
      const els = collectPriceNodes(root);
      els.forEach(el => {
        try {
          // Catalog game prices must stay exactly as provided by backend.
          // They are rendered in `.offer-price` cards and `#pm-price` modal pill.
          const catalogPriceElement = (
            (typeof el.matches === 'function' && (el.matches('.offer-price') || el.matches('#pm-price') || el.matches('.pm-pill'))) ||
            (typeof el.closest === 'function' && el.closest('.catalog-offer'))
          );
          if (catalogPriceElement) return;

          // Allow opting out for a specific element or an entire subtree.
          const scopeBlocked = (
            (typeof el.closest === 'function' && el.closest('[data-no-currency-convert="1"]')) ||
            (typeof el.closest === 'function' && el.closest('[data-no-currency-convert="true"]'))
          );
          const localBlock = String(el?.dataset?.noCurrencyConvert || '').toLowerCase();
          if (scopeBlocked || localBlock === '1' || localBlock === 'true') return;

          // Skip elements that are clearly not amounts (e.g., durations with 's')
          const txt = (el.textContent || '').trim();
          if (!el.dataset) return;

          let base = null;
          // 1) Explicit base in JOD
          if (el.dataset.priceJod != null) {
            const n = Number(el.dataset.priceJod);
            if (Number.isFinite(n)) base = n;
          }
          // 2) Explicit base in USD (or any): allow data-priceUsd or data-price and data-price-base / data-currency
          if (base == null && el.dataset.priceUsd != null) {
            const n = Number(el.dataset.priceUsd);
            if (Number.isFinite(n)) base = convertToJOD(n, 'USD');
          }
          if (base == null) {
            const v = Number(el.dataset.price || el.dataset.amount);
            const cur = (el.dataset.priceBase || el.dataset.currency || '').toUpperCase();
            if (Number.isFinite(v) && cur) base = convertToJOD(v, cur);
          }
          if (base == null) {
            const n = parseNumberFromText(txt);
            if (Number.isFinite(n)) {
              // Assume initial content is JOD-based when first seen unless overridden
              const curGuess = (el.dataset.priceBase || el.dataset.currency || guessCodeFromText(txt) || 'USD').toUpperCase();
              base = convertToJOD(n, curGuess);
              el.dataset.priceJod = String(base);
            }
          }
          if (base == null) return;
          el.textContent = formatAmountFromJOD(base, code);
        } catch {}
      });
    }

    let applyPending = false;
    function applyCurrencyNow(){
      try { if (!window.__CURRENCIES_READY__) return; } catch {}
      if (applyPending) return;
      applyPending = true;
      try {
        requestAnimationFrame(()=>{ try { applyCurrencyToPrices(document); } finally { applyPending = false; } });
      } catch { try { applyCurrencyToPrices(document); } finally { applyPending = false; } }
    }

    // Observe dynamic pages to keep prices in sync
    try {
      if (window.MutationObserver) {
        const mo = new MutationObserver(()=>{ applyCurrencyNow(); });
        mo.observe(document.documentElement, { childList: true, subtree: true });
      }
    } catch {}

    // Re-apply whenever currency changes
    window.addEventListener('currency:change', applyCurrencyNow);
    window.addEventListener('DOMContentLoaded', applyCurrencyNow);

    // Build sidebar currency selector as a regular row with custom menu style
    function attachSelector(){
      try {
        const ul = document.querySelector('#sidebar ul');
        if (!ul) return;
        const existingLi = document.getElementById('currencyLi');
        if (existingLi) {
          const hasCustomMenu = !!existingLi.querySelector('.currency-pm-select-menu');
          const hasCurrencySelect = !!existingLi.querySelector('#currencySelect, select');
          if (hasCustomMenu && hasCurrencySelect) return; // already attached correctly
          try { existingLi.remove(); } catch {}
        }

        const li = document.createElement('li');
        li.id = 'currencyLi';
        li.style.position = 'relative';
        li.tabIndex = 0;
        li.innerHTML = '<i class="fa-solid fa-sack-dollar"></i><a href="#" data-i18n="nav.currency">\u0627\u0644\u0639\u0645\u0644\u0629</a>';

        const labelA = li.querySelector('a');
        if (labelA) labelA.style.pointerEvents = 'none';

        function readMap(){
          try { return window.__CURRENCIES__ || CURRENCIES; } catch { return CURRENCIES; }
        }
        function optionText(code, cur){
          const name = (cur && (cur.nameAr || cur.name)) ? (cur.nameAr || cur.name) : code;
          const symbol = (cur && (cur.symbol || cur.code)) ? (cur.symbol || cur.code) : code;
          return `${name} (${symbol})`;
        }

        const select = document.createElement('select');
        select.id = 'currencySelect';
        select.className = 'currency-select-native';
        try { select.setAttribute('data-i18n-ignore', 'true'); } catch {}
        select.setAttribute('aria-hidden', 'true');
        select.tabIndex = -1;
        select.style.display = 'none';
        select.style.position = 'absolute';
        select.style.width = '0';
        select.style.height = '0';
        select.style.opacity = '0';
        select.style.pointerEvents = 'none';
        select.style.visibility = 'hidden';

        const menu = document.createElement('div');
        menu.className = 'currency-pm-select-menu';
        menu.setAttribute('role', 'listbox');
        menu.tabIndex = -1;
        li.appendChild(menu);

        let isOpen = false;
        function placeMenuBySpace(){
          try {
            const sidebar = document.getElementById('sidebar');
            if (!sidebar) return;
            li.classList.remove('menu-up', 'menu-down');

            const sideRect = sidebar.getBoundingClientRect();
            const liRect = li.getBoundingClientRect();
            const margin = 10;
            const spaceBelow = Math.max(0, Math.floor(sideRect.bottom - liRect.bottom - margin));
            const spaceAbove = Math.max(0, Math.floor(liRect.top - sideRect.top - margin));

            let preferredHeight = 200;
            try {
              const optionsCount = menu.querySelectorAll('.currency-pm-select-option').length;
              if (optionsCount > 0) preferredHeight = Math.min(240, Math.max(120, optionsCount * 42 + 12));
            } catch {}

            let openUp = false;
            if (spaceBelow >= preferredHeight) openUp = false;
            else if (spaceAbove >= preferredHeight) openUp = true;
            else openUp = spaceAbove > spaceBelow;

            const available = Math.max(110, openUp ? spaceAbove : spaceBelow);
            const finalMax = Math.max(110, Math.min(240, available));
            menu.style.maxHeight = `${finalMax}px`;
            li.classList.add(openUp ? 'menu-up' : 'menu-down');
          } catch {}
        }
        function closeMenu(){
          if (!isOpen) return;
          isOpen = false;
          li.classList.remove('open');
        }
        function openMenu(){
          if (isOpen) return;
          placeMenuBySpace();
          isOpen = true;
          li.classList.add('open');
          try { requestAnimationFrame(placeMenuBySpace); } catch {}
        }
        function toggleMenu(){
          if (isOpen) closeMenu();
          else openMenu();
        }

        function syncLabel(){
          try {
            const selected = select.options && select.options.length
              ? (select.options[select.selectedIndex] || select.options[0])
              : null;
            const text = selected ? String(selected.textContent || '').trim() : '';
            li.setAttribute('data-currency-label', text);
          } catch {}
        }

        function rebuildOptions(){
          try {
            while (select.firstChild) select.removeChild(select.firstChild);
            while (menu.firstChild) menu.removeChild(menu.firstChild);
            const map = readMap();
            const codes = Object.keys(map || {});
            codes.forEach((code) => {
              const cur = map[code];
              const opt = document.createElement('option');
              opt.value = code;
              opt.textContent = optionText(code, cur);
              select.appendChild(opt);

              const btn = document.createElement('button');
              btn.type = 'button';
              btn.className = 'currency-pm-select-option';
              btn.dataset.value = code;
              btn.setAttribute('role', 'option');
              btn.textContent = opt.textContent;
              btn.addEventListener('click', (ev) => {
                try { ev.preventDefault(); ev.stopPropagation(); } catch {}
                setSelected(code);
                syncLabel();
                syncSelectedOption();
                closeMenu();
              });
              menu.appendChild(btn);
            });
            const wanted = getSelected();
            if (map[wanted]) select.value = wanted;
            else if (codes.length) select.value = codes[0];
            syncLabel();
            syncSelectedOption();
          } catch {}
        }

        function syncSelectedOption(){
          try {
            const selected = select.options && select.options.length
              ? (select.options[select.selectedIndex] || select.options[0])
              : null;
            menu.querySelectorAll('.currency-pm-select-option').forEach((btn) => {
              const on = !!selected && btn.dataset.value === selected.value;
              btn.classList.toggle('selected', on);
              btn.setAttribute('aria-selected', on ? 'true' : 'false');
            });
          } catch {}
        }

        select.addEventListener('change', () => {
          try {
            setSelected(select.value);
            syncLabel();
            syncSelectedOption();
          } catch {}
        });

        li.addEventListener('click', (e) => {
          const option = e.target && e.target.closest ? e.target.closest('.currency-pm-select-option') : null;
          if (option) return;
          try { e.preventDefault(); e.stopPropagation(); } catch {}
          toggleMenu();
        });
        li.addEventListener('keydown', (e) => {
          try {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              toggleMenu();
              return;
            }
            if (e.key === 'Escape') closeMenu();
          } catch {}
        });
        document.addEventListener('click', (e) => {
          try {
            if (!li.contains(e.target)) closeMenu();
          } catch {}
        }, true);
        document.addEventListener('keydown', (e) => {
          try { if (e.key === 'Escape') closeMenu(); } catch {}
        });
        const repositionIfOpen = () => {
          try { if (isOpen) placeMenuBySpace(); } catch {}
        };
        try { window.addEventListener('resize', repositionIfOpen); } catch {}
        try {
          const side = document.getElementById('sidebar');
          if (side) side.addEventListener('scroll', repositionIfOpen, { passive: true });
        } catch {}

        li.appendChild(select);
        ul.appendChild(li);
        rebuildOptions();

        window.addEventListener('currency:change', () => {
          try {
            const wanted = getSelected();
            if (wanted && select.value !== wanted) select.value = wanted;
            syncLabel();
            syncSelectedOption();
            closeMenu();
          } catch {}
        });
        window.addEventListener('currency:rates:change', () => {
          try { rebuildOptions(); closeMenu(); } catch {}
        });
      } catch {}
    }
    window.addEventListener('DOMContentLoaded', attachSelector);
    // Retry a few times in case sidebar renders slightly later
    try { setTimeout(attachSelector, 200); setTimeout(attachSelector, 1000); } catch {}
    const cachedRatesPayload = readCachedRates();
    if (cachedRatesPayload && cachedRatesPayload.rates && Object.keys(cachedRatesPayload.rates).length) {
      const baseFromCache = (cachedRatesPayload.base || 'USD');
      try { window.__CURRENCY_BASE__ = baseFromCache; } catch {}
      applyRatesMap(cachedRatesPayload.rates, { base: baseFromCache, cache: false });
    }

    function ensureRatesFresh(){
      initRatesListener();
    }

    ensureRatesFresh();

    try { window.addEventListener('site-state-updated', function(ev){
      try {
        const payload = readRatesStateFromObject((ev && ev.detail) || {});
        if (hasRatesPayload(payload)) {
          applyRatesMap(payload.rates, { base: payload.base });
        }
      } catch {}
    }); } catch {}

    // Rates are derived from the resolved siteState payload to avoid duplicate
    // Firestore reads for config/siteState/config.currency.
    function normalizeRates(obj){
      const out = {};
      try {
        Object.entries(obj || {}).forEach(([code, v]) => {
          const C = String(code || '').toUpperCase();
          if (!C) return;
          if (v && typeof v === 'object') {
            const rate = Number(v.rate || v.RATE || v.value);
            const symbol = v.symbol || v.sym || '';
            const nameAr = v.nameAr || v.name || C;
            if (Number.isFinite(rate) && rate > 0) out[C] = { code: C, rate, symbol, nameAr };
          } else {
            const rate = Number(v);
            if (Number.isFinite(rate) && rate > 0) out[C] = { code: C, rate, symbol: '', nameAr: C };
          }
        });
      } catch {}
      return out;
    }
    function parseRatesJsonLoose(raw){
      if (raw && typeof raw === 'object') return raw;
      let parsed = {};
      try {
        let s = String(raw || '')
          .replace(/\uFEFF/g,'')
          .replace(/[\u200f\u200e\u202a-\u202e]/g,'')
          .replace(/[“”«»]/g,'"')
          .replace(/[‘’]/g,"'")
          .replace(/،/g,',').replace(/؛/g,',');
        s = s.replace(/([\{\[,]\s*)'([^']*)'\s*:/g,'$1"$2":');
        s = s.replace(/:\s*'([^']*)'/g,':"$1"');
        s = s.replace(/,(\s*[}\]])/g,'$1');
        parsed = JSON.parse(s);
      } catch { parsed = {}; }
      return (parsed && typeof parsed === 'object') ? parsed : {};
    }
    function fromNumberField(f){
      if (!f) return null;
      if (typeof f.doubleValue !== 'undefined') return Number(f.doubleValue);
      if (typeof f.integerValue !== 'undefined') return Number(f.integerValue);
      if (typeof f.stringValue !== 'undefined') {
        const n = Number(f.stringValue);
        return Number.isFinite(n) ? n : null;
      }
      return null;
    }
    function fromStringField(f){
      if (!f) return '';
      if (typeof f.stringValue !== 'undefined') return String(f.stringValue);
      if (typeof f.integerValue !== 'undefined' || typeof f.doubleValue !== 'undefined') return String(fromNumberField(f) ?? '');
      return '';
    }
    function mapValueToPlain(mv){
      const out = {};
      try {
        const mfields = (mv && mv.mapValue && mv.mapValue.fields) || {};
        Object.keys(mfields).forEach(code => {
          const entry = mfields[code];
          if (entry && entry.mapValue && entry.mapValue.fields){
            const ef = entry.mapValue.fields;
            const rate = fromNumberField(ef.rate ?? ef.RATE ?? ef.value);
            const symbol = fromStringField(ef.symbol ?? ef.sym);
            const nameAr = fromStringField(ef.nameAr ?? ef.name);
            if (Number.isFinite(rate) && rate > 0){
              out[String(code).toUpperCase()] = { code: String(code).toUpperCase(), rate, symbol, nameAr: nameAr || String(code).toUpperCase() };
            }
          } else {
            const rate = fromNumberField(entry);
            if (Number.isFinite(rate) && rate > 0){
              out[String(code).toUpperCase()] = { code: String(code).toUpperCase(), rate, symbol: '', nameAr: String(code).toUpperCase() };
            }
          }
        });
      } catch {}
      return out;
    }
    function readRatesStateFromObject(data){
      const root = (data && typeof data.currency === 'object' && !Array.isArray(data.currency)) ? data.currency : (data || {});
      const parsed = normalizeRates(parseRatesJsonLoose(root.ratesJson || root.rates || {}));
      let base = 'USD';
      try {
        const b = String(root.baseCode || root.base || '').trim().toUpperCase();
        base = b || 'USD';
      } catch { base = 'USD'; }
      return { rates: parsed, base };
    }
    function readRatesStateFromFirestoreFields(fields){
      const currencyFields = (fields && fields.currency && fields.currency.mapValue && fields.currency.mapValue.fields)
        ? fields.currency.mapValue.fields
        : (fields || {});
      const hasRJ = currencyFields.ratesJson;
      const hasR = currencyFields.rates;
      let parsed = {};
      try {
        if (hasRJ && typeof hasRJ.stringValue !== 'undefined') {
          parsed = parseRatesJsonLoose(hasRJ.stringValue);
        } else if (hasRJ && hasRJ.mapValue) {
          parsed = mapValueToPlain(hasRJ);
        } else if (hasR && hasR.mapValue) {
          parsed = mapValueToPlain(hasR);
        } else if (hasR && typeof hasR.stringValue !== 'undefined') {
          parsed = parseRatesJsonLoose(hasR.stringValue);
        }
      } catch { parsed = {}; }

      let base = 'USD';
      try {
        const b = (currencyFields.baseCode && currencyFields.baseCode.stringValue)
          ? String(currencyFields.baseCode.stringValue).toUpperCase()
          : (currencyFields.base && currencyFields.base.stringValue ? String(currencyFields.base.stringValue).toUpperCase() : 'USD');
        base = b || 'USD';
      } catch { base = 'USD'; }

      return { rates: normalizeRates(parsed), base };
    }
    function hasRatesPayload(payload){
      return !!payload && !!payload.rates && Object.keys(payload.rates).length > 0;
    }
    function applyRatesMap(map, options){
      try {
        const opts = options || {};
        const overrides = normalizeRates(map);
        const merged = Object.assign({}, overrides);
        Object.keys(overrides).forEach(k => { if (!merged[k]) merged[k] = overrides[k]; });
        if (opts.base) {
          try { window.__CURRENCY_BASE__ = opts.base; } catch {}
        }
        window.__CURRENCIES__ = merged;
        try { window.__CURRENCIES_READY__ = true; } catch {}
        try {
          const chosen = getSelected();
          if (chosen) localStorage.setItem(CURRENCY_KEY, chosen);
        } catch {}
        if (opts.cache !== false && Object.keys(merged).length) {
          const baseForCache = opts.base || getFxBase() || 'USD';
          writeCachedRates(merged, baseForCache);
        }
        try { applyCurrencyNow(); } catch {}
        try {
          const base = headerGetBaseBalanceValue();
          setHeaderBalanceAmount(base);
          broadcastBalance(base);
        } catch {}
        try { window.dispatchEvent(new CustomEvent('currency:rates:change')); } catch {}
        try { window.dispatchEvent(new Event('currency:ready')); } catch {}
      } catch {}
    }
    function initRatesListener(){
      if (ratesListenerStarted) return;
      ratesListenerStarted = true;
      try {
        const resolvedSiteState = window.__getResolvedSiteStateData ? window.__getResolvedSiteStateData() : null;
        const resolvedPayload = readRatesStateFromObject(resolvedSiteState || {});
        if (hasRatesPayload(resolvedPayload)) {
          applyRatesMap(resolvedPayload.rates, { base: resolvedPayload.base });
        }
      } catch {}
    }
  } catch {}
})();
document.addEventListener('visibilitychange', () => { try { if (sessionStorage.getItem('nav:loader:expected') === '1') return; } catch {} if (document.visibilityState === 'visible') hidePageLoader(); });

// i18n (language switcher + translations)
const I18N_TEXT = {
  ar: {
    'brand.name': '',
    'brand.home': '\u0627\u0644\u0639\u0648\u062F\u0629\u0020\u0644\u0644\u0631\u0626\u064A\u0633\u064A\u0629',
    'nav.home': '\u0627\u0644\u0631\u0626\u064A\u0633\u064A\u0629',
    'nav.deposit': '\u0627\u0644\u0625\u064A\u062F\u0627\u0639',
    'nav.orders': '\u0637\u0644\u0628\u0627\u062A\u064A',
    'nav.wallet': '\u0627\u0644\u0645\u062D\u0641\u0638\u0629',
    'nav.transfer': '\u062A\u062D\u0648\u064A\u0644\u0020\u0627\u0644\u0631\u0635\u064A\u062F',
    'nav.withdraw': '\u0633\u062D\u0628\u0020\u0627\u0644\u0631\u0635\u064A\u062F',
    'nav.reviews': '\u0627\u0644\u062A\u0642\u064A\u064A\u0645\u0627\u062A',
    'nav.agents': '\u0648\u0643\u0644\u0627\u0626\u0646\u0627',
    'nav.telegram': '\u0631\u0628\u0637\u0020\u062A\u064A\u0644\u064A\u063A\u0631\u0627\u0645',
    'nav.security': '\u062D\u0645\u0627\u064A\u0629\u0020\u0627\u0644\u062D\u0633\u0627\u0628',
    'nav.settings': '\u0627\u0644\u0625\u0639\u062F\u0627\u062F\u0627\u062A',
    'nav.api': '\u0648\u062C\u0647\u0629\u0020\u0627\u0644\u0628\u0631\u0645\u062C\u0629',
    'nav.login': '\u062A\u0633\u062C\u064A\u0644\u0020\u0627\u0644\u062F\u062E\u0648\u0644',
    'nav.logout': '\u062A\u0633\u062C\u064A\u0644\u0020\u0627\u0644\u062E\u0631\u0648\u062C',
    'nav.currency': '\u0627\u0644\u0639\u0645\u0644\u0629',
    'nav.language': '\u0627\u0644\u0644\u063A\u0629',
    'context.select': '\u062A\u062D\u062F\u064A\u062F',
    'context.copy': '\u0646\u0633\u062E',
    'context.paste': '\u0644\u0635\u0642',
    'context.selectAll': '\u062A\u062D\u062F\u064A\u062F\u0020\u0627\u0644\u0643\u0644',
    'support.title': '\u0637\u0631\u0642\u0020\u0627\u0644\u062A\u0648\u0627\u0635\u0644',
    'support.credit': '\uD83D\uDD17\u0020\u0631\u0627\u0628\u0637\u0020\u0627\u0644\u0645\u0637\u0648\u0631',
    'support.whatsappAlt': '\u0648\u0627\u062A\u0633\u0627\u0628\u00202',
    'notFound.title': '\u0627\u0644\u0635\u0641\u062D\u0629\u0020\u063A\u064A\u0631\u0020\u0645\u0648\u062C\u0648\u062F\u0629',
    'notFound.subtitle': '\u062A\u0639\u0630\u0631\u0020\u0627\u0644\u0639\u062B\u0648\u0631\u0020\u0639\u0644\u0649\u0020\u0627\u0644\u0635\u0641\u062D\u0629\u0020\u0623\u0648\u0020\u0627\u0644\u0645\u0633\u0627\u0631\u0020\u0627\u0644\u0630\u064A\u0020\u0637\u0644\u0628\u062A\u0647.',
    'notFound.pathLabel': '\u0627\u0644\u0645\u0633\u0627\u0631\u0020\u0627\u0644\u0645\u0637\u0644\u0648\u0628',
    'notFound.home': '\u0627\u0644\u0639\u0648\u062F\u0629\u0020\u0644\u0644\u0631\u0626\u064A\u0633\u064A\u0629',
    'notFound.login': '\u062A\u0633\u062C\u064A\u0644\u0020\u0627\u0644\u062F\u062E\u0648\u0644'
  },
  en: {
    'brand.name': '',
    'brand.home': 'Back to home',
    'nav.home': 'Home',
    'nav.deposit': 'Deposit',
    'nav.orders': 'My Orders',
    'nav.wallet': 'My Wallet',
    'nav.transfer': 'Balance Transfer',
    'nav.withdraw': 'Withdraw Balance',
    'nav.reviews': 'Reviews',
    'nav.agents': 'Agents',
    'nav.telegram': 'Telegram Link',
    'nav.security': 'Account Security',
    'nav.settings': 'Settings',
    'nav.api': 'API Docs',
    'nav.login': 'Log In',
    'nav.logout': 'Log Out',
    'nav.currency': 'Currency',
    'nav.language': 'Language',
    'context.select': 'Select',
    'context.copy': 'Copy',
    'context.paste': 'Paste',
    'context.selectAll': 'Select all',
    'support.title': "We're here to help",
    'support.credit': '\uD83D\uDD17 Developer credit',
    'support.whatsappAlt': 'WhatsApp 2',
    'notFound.title': 'Page Not Found',
    'notFound.subtitle': 'We could not find the page or path you requested.',
    'notFound.pathLabel': 'Requested path',
    'notFound.home': 'Back to home',
    'notFound.login': 'Log In'
  },
  fr: {
    'brand.name': '',
    'brand.home': 'Retour \u00E0 l\'accueil',
    'nav.home': 'Accueil',
    'nav.deposit': 'D\u00E9p\u00F4t',
    'nav.orders': 'Mes commandes',
    'nav.wallet': 'Mon portefeuille',
    'nav.transfer': 'Transfert de solde',
    'nav.withdraw': 'Retrait de solde',
    'nav.reviews': 'Avis',
    'nav.agents': 'Agents',
    'nav.telegram': 'Lien Telegram',
    'nav.security': 'Protection du compte',
    'nav.settings': 'Param\u00E8tres',
    'nav.api': 'API Docs',
    'nav.login': 'Connexion',
    'nav.logout': 'D\u00E9connexion',
    'nav.currency': 'Devise',
    'nav.language': 'Langue',
    'context.select': 'Selectionner',
    'context.copy': 'Copier',
    'context.paste': 'Coller',
    'context.selectAll': 'Tout selectionner',
    'support.title': 'Nous sommes l\u00E0 pour vous aider',
    'support.credit': '\uD83D\uDD17 Cr\u00E9dit d\u00E9veloppeur',
    'support.whatsappAlt': 'WhatsApp 2',
    'notFound.title': 'Page introuvable',
    'notFound.subtitle': 'Impossible de trouver la page ou le chemin demand\u00E9.',
    'notFound.pathLabel': 'Chemin demand\u00E9',
    'notFound.home': 'Retour \u00E0 l\'accueil',
    'notFound.login': 'Connexion'
  }
};
function normalizeKey(value){
  return canonicalizeSiteBrandText((value || '')
    .toString()
    .replace(/[\u00A0\u1680\u2000-\u200B\u202F\u205F\u3000]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim());
}
const ARABIC_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/;
function hasArabic(value){
  return ARABIC_RE.test(String(value || ''));
}
const LATIN_RE = /[A-Za-z]/;
function hasLatin(value){
  return LATIN_RE.test(String(value || ''));
}
const CURRENCY_TOKEN_RE = /(?:[$€£¥₺₽₿]|[A-Z]{2,8}|د\.ا|د\.إ|د\.ك|ر\.س|ر\.ق|ر\.ع|د\.ب|ج\.م|ل\.س|ل\.ل)/i;
const ARABIC_INDIC_DIGITS_RE = /[\u0660-\u0669]/g;
const EASTERN_ARABIC_INDIC_DIGITS_RE = /[\u06F0-\u06F9]/g;
function normalizeDigitsForCurrency(value){
  return String(value || '')
    .replace(ARABIC_INDIC_DIGITS_RE, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(EASTERN_ARABIC_INDIC_DIGITS_RE, (d) => String(d.charCodeAt(0) - 0x06F0));
}
function isCurrencyDisplayText(value){
  const raw = normalizeKey(value);
  if (!raw) return false;
  const txt = normalizeDigitsForCurrency(raw).replace(/\s+/g, ' ').trim();
  if (!txt) return false;
  if (CURRENCY_TOKEN_RE.test(txt) && txt.replace(CURRENCY_TOKEN_RE, '').trim() === '') return true;
  const amountThenCurrency = new RegExp(`^[+-]?\\d[\\d.,\\s]*\\s*${CURRENCY_TOKEN_RE.source}$`, 'i');
  const currencyThenAmount = new RegExp(`^${CURRENCY_TOKEN_RE.source}\\s*[+-]?\\d[\\d.,\\s]*$`, 'i');
  return amountThenCurrency.test(txt) || currencyThenAmount.test(txt);
}
function isShortLatinToken(value){
  const str = normalizeKey(value);
  if (!str) return false;
  if (!hasLatin(str) || hasArabic(str)) return false;
  if (/^[A-Za-z]{1,3}$/.test(str)) return true;
  if (/^[A-Z0-9._-]+$/.test(str) && str.length <= 4) return true;
  return false;
}
function toLatinDigits(value){
  return String(value || '')
    .replace(ARABIC_INDIC_DIGITS_RE, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(EASTERN_ARABIC_INDIC_DIGITS_RE, (d) => String(d.charCodeAt(0) - 0x06F0))
    .replace(/\u066B/g, '.')
    .replace(/\u066C/g, ',');
}
function normalizeDigitsInTextNode(node){
  try {
    if (!node || node.nodeType !== 3) return;
    const parent = node.parentElement;
    if (parent && /^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA)$/i.test(parent.tagName)) return;
    const current = String(node.nodeValue || '');
    const normalized = toLatinDigits(current);
    if (normalized !== current) node.nodeValue = normalized;
  } catch {}
}
function normalizeDigitsInScope(root){
  try {
    if (!root) return;
    if (root.nodeType === 3) {
      normalizeDigitsInTextNode(root);
      return;
    }
    const scope = (root && root.nodeType) ? root : document;
    if (!scope || !scope.nodeType) return;
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {
      acceptNode(node){
        if (!node || !node.parentElement) return NodeFilter.FILTER_REJECT;
        if (/^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA)$/i.test(node.parentElement.tagName)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    let node;
    while ((node = walker.nextNode())) normalizeDigitsInTextNode(node);
  } catch {}
}
function forceLatinDigitsInInputs(root){
  try {
    const scope = (root && root.nodeType) ? root : document;
    const controls = [];
    if (scope && scope.nodeType === 1 && typeof scope.matches === 'function' && scope.matches('input,textarea')) {
      controls.push(scope);
    }
    if (scope && typeof scope.querySelectorAll === 'function') {
      scope.querySelectorAll('input, textarea').forEach((el) => controls.push(el));
    }
    controls.forEach((el) => {
      try {
        if (!el || !el.tagName) return;
        const tag = String(el.tagName).toLowerCase();
        if (tag !== 'input' && tag !== 'textarea') return;
        const type = String(el.getAttribute('type') || '').toLowerCase();
        const inputMode = String(el.getAttribute('inputmode') || '').toLowerCase();
        const numericLike = (
          type === 'number' ||
          type === 'tel' ||
          inputMode === 'numeric' ||
          inputMode === 'decimal' ||
          el.hasAttribute('data-force-latin-digits')
        );
        if (!numericLike) return;
        el.setAttribute('lang', 'en');
        if (type === 'number' && !el.getAttribute('inputmode')) {
          el.setAttribute('inputmode', 'decimal');
        }
        try { el.style.fontVariantNumeric = 'tabular-nums'; } catch {}
        try { el.style.fontFeatureSettings = "'tnum' 1"; } catch {}
        try { el.style.direction = 'ltr'; } catch {}
        const normalizeValue = () => {
          try {
            const raw = String(el.value || '');
            const normalized = toLatinDigits(raw);
            if (normalized !== raw) el.value = normalized;
          } catch {}
        };
        if (el.dataset && el.dataset.latinDigitsBound !== '1') {
          el.addEventListener('input', normalizeValue);
          el.addEventListener('change', normalizeValue);
          el.dataset.latinDigitsBound = '1';
        }
        normalizeValue();
      } catch {}
    });
  } catch {}
}
function enforceLatinDigits(root){
  try { normalizeDigitsInScope(root || document); } catch {}
  try { forceLatinDigitsInInputs(root || document); } catch {}
}
const I18N_AR_OVERRIDES = {};
try {
  const arMap = I18N_TEXT.ar || {};
  Object.keys(arMap).forEach((key) => {
    const arText = normalizeKey(arMap[key]);
    if (!arText) return;
    I18N_AR_OVERRIDES[arText] = {
      en: (I18N_TEXT.en && I18N_TEXT.en[key]) || '',
      fr: (I18N_TEXT.fr && I18N_TEXT.fr[key]) || ''
    };
  });
} catch {}
const I18N_EN_OVERRIDES = {};
try {
  const enMap = I18N_TEXT.en || {};
  Object.keys(enMap).forEach((key) => {
    const enText = normalizeKey(enMap[key]);
    if (!enText) return;
    I18N_EN_OVERRIDES[enText] = {
      ar: (I18N_TEXT.ar && I18N_TEXT.ar[key]) || '',
      fr: (I18N_TEXT.fr && I18N_TEXT.fr[key]) || ''
    };
  });
} catch {}
try {
  I18N_AR_OVERRIDES['ابحث داخل القائمة الحالية.'] = {
    en: 'Search within the current list.',
    fr: 'Recherchez dans la liste actuelle.'
  };
  I18N_EN_OVERRIDES['Search within the current list.'] = {
    ar: 'ابحث داخل القائمة الحالية.',
    fr: 'Recherchez dans la liste actuelle.'
  };
  I18N_AR_OVERRIDES['ابحث عن الباقات...'] = {
    en: 'Search for packages...',
    fr: 'Recherchez les forfaits...'
  };
  I18N_EN_OVERRIDES['Search for packages...'] = {
    ar: 'ابحث عن الباقات...',
    fr: 'Recherchez les forfaits...'
  };
} catch {}

const I18N_RUNTIME = {
  loaded: false,
  byAr: {},
  byEn: {},
  pending: new Map(),
  timer: null,
  saveTimer: null,
  inFlight: false,
  nextAllowedAt: 0
};
const RUNTIME_STORAGE_KEY = 'i18n:runtime';
const RUNTIME_MAX_ITEMS = 600;
const RUNTIME_BATCH_MAX = 24;
const RUNTIME_BATCH_DELIM = '|||#|||';
const RUNTIME_QUEUE_DELAY = 80;
const RUNTIME_MIN_INTERVAL = 180;
const RUNTIME_BATCH_MAX_ENCODED_CHARS = 1400;
const RUNTIME_PREWARM_MAX_ITEMS = 420;
const RUNTIME_PREWARM_MAX_DEPTH = 7;
const RUNTIME_PREWARM_ATTRS = ['placeholder', 'title', 'aria-label', 'alt', 'data-title', 'data-label'];
const RUNTIME_PREWARM_TEXT_KEYS = /^(?:name|title|label|text|message|placeholder|hint|description|subtitle|summary|caption|content|copy|note|status|headline|categoryName|pathName)$/i;
const RUNTIME_PREWARM_SKIP_KEYS = /^(?:id|key|slug|uid|url|href|src|image|imageUrl|icon|path|route|routeKey|routeValue|hash|type|code|token|email|phone|value|class|className)$/i;

function loadRuntimeDict(){
  if (I18N_RUNTIME.loaded) return;
  I18N_RUNTIME.loaded = true;
  try {
    const raw = localStorage.getItem(RUNTIME_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      if (parsed.byAr && typeof parsed.byAr === 'object') I18N_RUNTIME.byAr = parsed.byAr;
      if (parsed.byEn && typeof parsed.byEn === 'object') I18N_RUNTIME.byEn = parsed.byEn;
    }
  } catch {}
}
function pruneRuntimeDict(map){
  try {
    const keys = Object.keys(map || {});
    if (keys.length <= RUNTIME_MAX_ITEMS) return;
    const drop = keys.length - RUNTIME_MAX_ITEMS;
    for (let i = 0; i < drop; i++) delete map[keys[i]];
  } catch {}
}
function scheduleRuntimeSave(){
  if (I18N_RUNTIME.saveTimer) return;
  I18N_RUNTIME.saveTimer = setTimeout(() => {
    I18N_RUNTIME.saveTimer = null;
    try {
      pruneRuntimeDict(I18N_RUNTIME.byAr);
      pruneRuntimeDict(I18N_RUNTIME.byEn);
      const payload = JSON.stringify({ byAr: I18N_RUNTIME.byAr, byEn: I18N_RUNTIME.byEn });
      localStorage.setItem(RUNTIME_STORAGE_KEY, payload);
    } catch {}
  }, 800);
}
function scheduleRuntimeFlush(delay){
  if (I18N_RUNTIME.timer) return;
  const wait = Math.max(0, delay || 0);
  I18N_RUNTIME.timer = setTimeout(() => {
    I18N_RUNTIME.timer = null;
    flushRuntimeTranslations();
  }, wait);
}
function shouldSkipRuntimeTranslation(source, text){
  if (!text || text.length < 2 || text.length > 180) return true;
  if (/https?:\/\//i.test(text) || /www\./i.test(text)) return true;
  if (/^[0-9\s.,:+\-()]+$/.test(text)) return true;
  if (isCurrencyDisplayText(text)) return true;
  if (source === 'en' && isShortLatinToken(text)) return true;
  return false;
}
function queueRuntimeTranslation(source, raw, target){
  try {
    if (!raw || !target || source === target) return;
    if (shouldSkipRuntimeTranslation(source, raw)) return;
    const key = `${source}|${target}`;
    let set = I18N_RUNTIME.pending.get(key);
    if (!set) { set = new Set(); I18N_RUNTIME.pending.set(key, set); }
    if (set.has(raw)) return;
    set.add(raw);
    scheduleRuntimeFlush(RUNTIME_QUEUE_DELAY);
  } catch {}
}
function pickRuntimeBatch(set){
  try {
    const items = Array.from(set || []);
    if (!items.length) return [];
    const batch = [];
    let encodedChars = 0;
    for (let i = 0; i < items.length; i++) {
      if (batch.length >= RUNTIME_BATCH_MAX) break;
      const item = items[i];
      const nextEncoded = encodeURIComponent(String(item || '')).length + (batch.length ? RUNTIME_BATCH_DELIM.length : 0);
      if (batch.length && (encodedChars + nextEncoded) > RUNTIME_BATCH_MAX_ENCODED_CHARS) break;
      batch.push(item);
      encodedChars += nextEncoded;
    }
    if (!batch.length) batch.push(items[0]);
    return batch;
  } catch {
    return Array.from(set || []).slice(0, RUNTIME_BATCH_MAX);
  }
}
function decodeRuntimeLiteral(raw){
  let text = String(raw == null ? '' : raw);
  try {
    text = text.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
    text = text.replace(/\\x([0-9a-fA-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
    text = text.replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t');
    text = text.replace(/\\"/g, '"').replace(/\\'/g, "'").replace(/\\\\/g, '\\');
  } catch {}
  return text;
}
function isLikelyRuntimeTranslationText(text){
  const value = normalizeKey(text);
  if (!value || value.length < 2 || value.length > 220) return false;
  if (/^<\/?[a-z]/i.test(value)) return false;
  if (/[<>{}=]/.test(value)) return false;
  if (/^(?:https?:|www\.|otpauth:|tg:\/\/|mailto:)/i.test(value)) return false;
  if (/^(?:data-|aria-|fa-|#[a-z])/i.test(value)) return false;
  if (/^[a-z0-9_.:-]+$/i.test(value) && value === value.toLowerCase() && value.indexOf(' ') < 0 && !/^(api|otp|qr|ios|android)$/i.test(value)) return false;
  if (!/[\u0600-\u06FFA-Za-z\u00C0-\u024F]/.test(value)) return false;
  if (hasArabic(value)) return true;
  if (/\s/.test(value)) return true;
  if (/^[A-Z][A-Za-z0-9 '&+()\/.-]{2,}$/.test(value)) return true;
  if (/^[A-Z]{2,}(?:\s+[A-Z]{2,})*$/.test(value)) return true;
  return false;
}
function addRuntimePrewarmText(store, text, limit){
  try {
    if (!store || store.size >= limit) return;
    const raw = normalizeKey(text);
    if (!raw || !isLikelyRuntimeTranslationText(raw)) return;
    const source = hasArabic(raw) ? 'ar' : ((hasLatin(raw) || /[A-Za-z\u00C0-\u024F]/.test(raw)) ? 'en' : null);
    if (!source || source === currentLang) return;
    if (shouldSkipRuntimeTranslation(source, raw)) return;
    const key = `${source}|${raw}`;
    if (!store.has(key)) store.set(key, { source, raw });
  } catch {}
}
function collectRuntimePrewarmFromFunction(fn, store, limit){
  try {
    const source = String(fn || '');
    if (!source) return;
    const regex = /'((?:\\.|[^'\\])*)'|"((?:\\.|[^"\\])*)"/g;
    let match;
    while (store.size < limit && (match = regex.exec(source))) {
      const body = match[1] != null ? match[1] : match[2];
      addRuntimePrewarmText(store, decodeRuntimeLiteral(body), limit);
    }
  } catch {}
}
function collectRuntimePrewarmFromNode(node, store, limit){
  try {
    if (!node || store.size >= limit) return;
    if (node.nodeType === 3) {
      addRuntimePrewarmText(store, node.nodeValue || '', limit);
      return;
    }
    const scope = node && node.nodeType ? node : null;
    if (!scope) return;
    if (scope.nodeType === 1) {
      RUNTIME_PREWARM_ATTRS.forEach((attr) => {
        try { addRuntimePrewarmText(store, scope.getAttribute(attr) || '', limit); } catch {}
      });
    }
    if (!(scope.nodeType === 1 || scope.nodeType === 9 || scope.nodeType === 11)) return;
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {
      acceptNode(textNode){
        try {
          if (!textNode || !textNode.parentElement) return NodeFilter.FILTER_REJECT;
          if (textNode.parentElement.closest && textNode.parentElement.closest('[data-i18n-ignore]')) return NodeFilter.FILTER_REJECT;
          if (/^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA)$/i.test(textNode.parentElement.tagName)) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        } catch {
          return NodeFilter.FILTER_REJECT;
        }
      }
    });
    let textNode;
    while (store.size < limit && (textNode = walker.nextNode())) {
      addRuntimePrewarmText(store, textNode.nodeValue || '', limit);
    }
    if (!scope.querySelectorAll) return;
    const elements = scope.querySelectorAll('*');
    for (let i = 0; i < elements.length && store.size < limit; i++) {
      const el = elements[i];
      if (!el || (el.closest && el.closest('[data-i18n-ignore]'))) continue;
      RUNTIME_PREWARM_ATTRS.forEach((attr) => {
        try { addRuntimePrewarmText(store, el.getAttribute(attr) || '', limit); } catch {}
      });
    }
  } catch {}
}
function collectRuntimePrewarmFromValue(value, store, seen, depth, limit){
  try {
    if (value == null || !store || store.size >= limit || depth > RUNTIME_PREWARM_MAX_DEPTH) return;
    if (typeof value === 'string') {
      addRuntimePrewarmText(store, value, limit);
      return;
    }
    if (typeof value === 'function') {
      collectRuntimePrewarmFromFunction(value, store, limit);
      return;
    }
    if (typeof value !== 'object') return;
    if (typeof value.nodeType === 'number') {
      collectRuntimePrewarmFromNode(value, store, limit);
      return;
    }
    if (seen && seen.has(value)) return;
    if (seen) seen.add(value);
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length && store.size < limit; i++) {
        collectRuntimePrewarmFromValue(value[i], store, seen, depth + 1, limit);
      }
      return;
    }
    if (value instanceof Set) {
      value.forEach((entry) => {
        if (store.size >= limit) return;
        collectRuntimePrewarmFromValue(entry, store, seen, depth + 1, limit);
      });
      return;
    }
    if (value instanceof Map) {
      value.forEach((entry) => {
        if (store.size >= limit) return;
        collectRuntimePrewarmFromValue(entry, store, seen, depth + 1, limit);
      });
      return;
    }
    Object.keys(value).forEach((key) => {
      if (store.size >= limit) return;
      const child = value[key];
      if (typeof child === 'string') {
        if (RUNTIME_PREWARM_SKIP_KEYS.test(key)) return;
        if (!RUNTIME_PREWARM_TEXT_KEYS.test(key) && !isLikelyRuntimeTranslationText(child)) return;
        addRuntimePrewarmText(store, child, limit);
        return;
      }
      collectRuntimePrewarmFromValue(child, store, seen, depth + 1, limit);
    });
  } catch {}
}
function prewarmRuntimeTranslations(input, opts){
  try {
    if (currentLang === LANG_OFF || currentLang === 'ar' || input == null) return 0;
    const limit = Math.max(1, Math.min(2000, Number(opts && opts.maxItems) || RUNTIME_PREWARM_MAX_ITEMS));
    const store = new Map();
    const seen = new WeakSet();
    collectRuntimePrewarmFromValue(input, store, seen, 0, limit);
    if (!store.size) return 0;
    store.forEach((entry) => {
      try { queueRuntimeTranslation(entry.source, entry.raw, currentLang); } catch {}
    });
    scheduleRuntimeFlush(0);
    return store.size;
  } catch {
    return 0;
  }
}
async function translateBatch(source, target, list){
  try {
    const joined = list.join(RUNTIME_BATCH_DELIM);
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(source)}&tl=${encodeURIComponent(target)}&dt=t&q=${encodeURIComponent(joined)}`;
    const res = await fetch(url);
    const data = await res.json();
    const translated = data && data[0] && data[0][0] && data[0][0][0];
    if (!translated || typeof translated !== 'string') return null;
    const parts = translated.split(RUNTIME_BATCH_DELIM);
    if (!parts || !parts.length) return null;
    return parts;
  } catch {
    return null;
  }
}
async function flushRuntimeTranslations(){
  if (currentLang === 'ar' || currentLang === 'off') {
    try { I18N_RUNTIME.pending.clear(); } catch {}
    return;
  }
  if (I18N_RUNTIME.inFlight) return;
  const now = Date.now();
  if (now < I18N_RUNTIME.nextAllowedAt) {
    scheduleRuntimeFlush(I18N_RUNTIME.nextAllowedAt - now);
    return;
  }
  const entries = Array.from(I18N_RUNTIME.pending.entries());
  if (!entries.length) return;
  let pickedKey = null;
  let pickedSet = null;
  for (const [key, set] of entries) {
    if (set && set.size) { pickedKey = key; pickedSet = set; break; }
    I18N_RUNTIME.pending.delete(key);
  }
  if (!pickedSet) return;
  const [source, target] = pickedKey.split('|');
  const batch = pickRuntimeBatch(pickedSet);
  batch.forEach(item => pickedSet.delete(item));
  if (!pickedSet.size) I18N_RUNTIME.pending.delete(pickedKey);
  I18N_RUNTIME.inFlight = true;
  I18N_RUNTIME.nextAllowedAt = now + RUNTIME_MIN_INTERVAL;
  const translatedParts = await translateBatch(source, target, batch);
  I18N_RUNTIME.inFlight = false;
  if (!translatedParts || translatedParts.length !== batch.length) {
    if (I18N_RUNTIME.pending.size) scheduleRuntimeFlush(RUNTIME_MIN_INTERVAL);
    return;
  }
  const runtimeMap = source === 'ar' ? I18N_RUNTIME.byAr : I18N_RUNTIME.byEn;
  for (let i = 0; i < batch.length; i++) {
    const raw = batch[i];
    const translated = translatedParts[i];
    if (!raw || !translated) continue;
    const entry = runtimeMap[raw] || {};
    entry[target] = translated;
    runtimeMap[raw] = entry;
  }
  try { rebuildPrefixList(); } catch {}
  scheduleRuntimeSave();
  try { setTimeout(() => { applyTranslations(document); }, 0); } catch {}
  if (I18N_RUNTIME.pending.size) scheduleRuntimeFlush(RUNTIME_MIN_INTERVAL);
}

const I18N_DICT_STATE = { loaded: false, prefixesBy: { ar: [], en: [] } };
let i18nDictPromise = null;
function getI18nDictByAr(){
  try { return (window.__I18N_DICT__ && window.__I18N_DICT__.byAr) || {}; } catch { return {}; }
}
function getI18nDictByEn(){
  try { return (window.__I18N_DICT__ && window.__I18N_DICT__.byEn) || {}; } catch { return {}; }
}
function buildPrefixList(dict, overrides, runtime){
  const set = new Set();
  Object.keys(dict || {}).forEach((k) => {
    const key = normalizeKey(k);
    if (key && key.length >= 6) set.add(key);
  });
  Object.keys(overrides || {}).forEach((k) => {
    const key = normalizeKey(k);
    if (key && key.length >= 6) set.add(key);
  });
  Object.keys(runtime || {}).forEach((k) => {
    const key = normalizeKey(k);
    if (key && key.length >= 6) set.add(key);
  });
  return Array.from(set).sort((a, b) => b.length - a.length);
}
function rebuildPrefixList(){
  try {
    loadRuntimeDict();
    I18N_DICT_STATE.prefixesBy = {
      ar: buildPrefixList(getI18nDictByAr(), I18N_AR_OVERRIDES, I18N_RUNTIME.byAr),
      en: buildPrefixList(getI18nDictByEn(), I18N_EN_OVERRIDES, I18N_RUNTIME.byEn)
    };
  } catch {}
}
function ensureI18nDictLoaded(){
  try {
    if (window.__I18N_DICT__ && window.__I18N_DICT__.byAr) {
      I18N_DICT_STATE.loaded = true;
      rebuildPrefixList();
      return Promise.resolve(true);
    }
  } catch {}
  if (i18nDictPromise) return i18nDictPromise;
  i18nDictPromise = Promise.resolve(false);
  return i18nDictPromise;
}
function translateRawText(raw){
  const norm = normalizeKey(raw);
  if (!norm) return null;
  if (currentLang === 'ar' || currentLang === 'off') return null;
  const source = hasArabic(norm) ? 'ar' : (hasLatin(norm) ? 'en' : null);
  if (!source || source === currentLang) return null;
  if (source === 'en' && isShortLatinToken(norm)) return null;
  loadRuntimeDict();
  const overrides = source === 'ar' ? I18N_AR_OVERRIDES : I18N_EN_OVERRIDES;
  const dict = source === 'ar' ? getI18nDictByAr() : getI18nDictByEn();
  const runtime = source === 'ar' ? I18N_RUNTIME.byAr : I18N_RUNTIME.byEn;
  const entry = runtime[norm] || overrides[norm] || dict[norm];
  if (entry && entry[currentLang]) return entry[currentLang];
  const prefixes = (I18N_DICT_STATE.prefixesBy && I18N_DICT_STATE.prefixesBy[source]) || [];
  for (let i = 0; i < prefixes.length; i++) {
    const prefix = prefixes[i];
    if (!norm.startsWith(prefix)) continue;
    const remainder = norm.slice(prefix.length);
    const remTrim = remainder.replace(/^\s+/, '');
    if (source === 'ar' && remTrim && /^[\u0600-\u06FF]/.test(remTrim)) continue;
    if (source === 'en' && remTrim && /^[A-Za-z]/.test(remTrim)) {
      if (!/^[A-Z0-9()$._\/\-\s]+$/.test(remTrim)) continue;
    }
    const prefixEntry = runtime[prefix] || overrides[prefix] || dict[prefix];
    if (prefixEntry && prefixEntry[currentLang]) {
      const tail = (source === 'ar' && currentLang !== 'ar') ? toLatinDigits(remainder) : remainder;
      return prefixEntry[currentLang] + tail;
    }
  }
  try { queueRuntimeTranslation(source, norm, currentLang); } catch {}
  return null;
}
function translateStringPreserveWhitespace(raw){
  if (raw == null) return raw;
  const str = String(raw);
  const normalizedSource = toLatinDigits(str);
  if (currentLang === LANG_OFF || currentLang === 'ar') return normalizedSource;
  if (isCurrencyDisplayText(str)) return normalizedSource;
  if (currentLang === 'en' && hasLatin(str) && !hasArabic(str)) return normalizedSource;
  const leading = (str.match(/^\s*/) || [''])[0];
  const trailing = (str.match(/\s*$/) || [''])[0];
  const translated = translateRawText(str);
  if (!translated) return normalizedSource;
  const finalText = toLatinDigits(restoreSiteBrandText(translated));
  return leading + finalText + trailing;
}
const TEXT_NODE_ORIG = new WeakMap();
const ATTR_ORIG = new WeakMap();
const META_ORIG = new WeakMap();
let docTitleOriginal = null;
let i18nApplying = false;
let i18nStabilizing = false;
function getAttrOriginal(el, attr){
  let record = ATTR_ORIG.get(el);
  if (!record) {
    record = {};
    ATTR_ORIG.set(el, record);
  }
  if (!(attr in record)) record[attr] = el.getAttribute(attr) || '';
  return record[attr];
}
function setTranslatedAttr(el, attr){
  try {
    const current = el.getAttribute(attr) || '';
    let raw = getAttrOriginal(el, attr);
    if (current !== raw) {
      const expected = translateStringPreserveWhitespace(raw);
      if (!expected || normalizeKey(expected) !== normalizeKey(current)) {
        const record = ATTR_ORIG.get(el);
        if (record) record[attr] = current;
        raw = current;
      }
    }
    if (!raw) return;
    const translated = translateStringPreserveWhitespace(raw);
    if (translated && el.getAttribute(attr) !== translated) el.setAttribute(attr, translated);
  } catch {}
}
function syncDatasetOriginalTitle(el){
  try {
    if (!el || !el.dataset || !el.dataset.originalTitle) return;
    if (!el.dataset.i18nOriginalTitle) el.dataset.i18nOriginalTitle = el.dataset.originalTitle;
    const raw = el.dataset.i18nOriginalTitle;
    const translated = translateStringPreserveWhitespace(raw);
    if (translated) el.dataset.originalTitle = translated;
  } catch {}
}
function translateTextNode(node){
  try {
    if (!node || node.nodeType !== 3) return;
    const parent = node.parentElement;
    if (parent && parent.closest && parent.closest('[data-i18n-ignore]')) return;
    if (parent && /^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA)$/i.test(parent.tagName)) return;
    const current = node.nodeValue || '';
    let raw = TEXT_NODE_ORIG.get(node);
    if (raw == null) {
      raw = current; TEXT_NODE_ORIG.set(node, raw);
    } else if (current !== raw) {
      const expected = translateStringPreserveWhitespace(raw);
      if (!expected || normalizeKey(expected) !== normalizeKey(current)) {
        raw = current; TEXT_NODE_ORIG.set(node, raw);
      }
    }
    const translated = translateStringPreserveWhitespace(raw);
    if (translated != null && node.nodeValue !== translated) node.nodeValue = translated;
  } catch {}
}
function applyAutoTranslations(root){
  if (i18nApplying) return;
  i18nApplying = true;
  try {
    const scope = root && root.nodeType ? root : document;
    if (scope.nodeType === 3) {
      translateTextNode(scope);
      return;
    }
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {
      acceptNode(node){
        if (!node || !node.parentElement) return NodeFilter.FILTER_REJECT;
        if (node.parentElement.closest && node.parentElement.closest('[data-i18n-ignore]')) return NodeFilter.FILTER_REJECT;
        if (/^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA)$/i.test(node.parentElement.tagName)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    let node;
    while ((node = walker.nextNode())) translateTextNode(node);

    const elements = scope.querySelectorAll ? scope.querySelectorAll('*') : [];
    if (scope.nodeType === 1) {
      setTranslatedAttr(scope, 'placeholder');
      setTranslatedAttr(scope, 'title');
      setTranslatedAttr(scope, 'aria-label');
      setTranslatedAttr(scope, 'alt');
      setTranslatedAttr(scope, 'data-title');
      setTranslatedAttr(scope, 'data-label');
      if (scope.tagName === 'INPUT') {
        const type = (scope.getAttribute('type') || '').toLowerCase();
        if (type === 'button' || type === 'submit' || type === 'reset') setTranslatedAttr(scope, 'value');
      }
      syncDatasetOriginalTitle(scope);
    }
    elements.forEach((el) => {
      if (el.closest && el.closest('[data-i18n-ignore]')) return;
      setTranslatedAttr(el, 'placeholder');
      setTranslatedAttr(el, 'title');
      setTranslatedAttr(el, 'aria-label');
      setTranslatedAttr(el, 'alt');
      setTranslatedAttr(el, 'data-title');
      setTranslatedAttr(el, 'data-label');
      if (el.tagName === 'INPUT') {
        const type = (el.getAttribute('type') || '').toLowerCase();
        if (type === 'button' || type === 'submit' || type === 'reset') setTranslatedAttr(el, 'value');
      }
      syncDatasetOriginalTitle(el);
    });
  } catch {} finally { i18nApplying = false; }
}
function applyMetaTranslations(){
  try {
    if (docTitleOriginal == null) docTitleOriginal = document.title || '';
    if (docTitleOriginal) {
      const translated = translateStringPreserveWhitespace(docTitleOriginal);
      if (translated != null) document.title = translated;
    }
  } catch {}
  try {
    const metas = document.querySelectorAll('meta[content]');
    metas.forEach((meta) => {
      const name = (meta.getAttribute('name') || meta.getAttribute('property') || '').toLowerCase();
      if (name === 'og:locale' || name === 'viewport') return;
      const current = meta.getAttribute('content') || '';
      let raw = META_ORIG.get(meta);
      if (raw == null) {
        raw = current; META_ORIG.set(meta, raw);
      } else if (current !== raw) {
        const expected = translateStringPreserveWhitespace(raw);
        if (!expected || normalizeKey(expected) !== normalizeKey(current)) {
          raw = current; META_ORIG.set(meta, raw);
        }
      }
      if (!raw) return;
      const translated = translateStringPreserveWhitespace(raw);
      if (translated && meta.getAttribute('content') !== translated) meta.setAttribute('content', translated);
    });
  } catch {}
}
function watchI18nMutations(){
  if (!window.MutationObserver || window.__I18N_MUTATIONS__) return;
  const observer = new MutationObserver((mutations) => {
    if (i18nApplying || i18nStabilizing) return;
    let needsFollowUp = false;
    mutations.forEach((m) => {
      if (m.type === 'childList') {
        m.addedNodes.forEach((node) => { applyAutoTranslations(node); });
        m.addedNodes.forEach((node) => { enforceLatinDigits(node); });
        if (m.addedNodes && m.addedNodes.length) needsFollowUp = true;
      } else if (m.type === 'characterData') {
        translateTextNode(m.target);
        enforceLatinDigits(m.target);
        needsFollowUp = true;
      } else if (m.type === 'attributes') {
        applyAutoTranslations(m.target);
        enforceLatinDigits(m.target);
        needsFollowUp = true;
      }
    });
    if (needsFollowUp) {
      try { scheduleI18nStabilize(document); } catch {}
      try {
        if (currentLang !== LANG_OFF && currentLang !== 'ar') scheduleRuntimeFlush(0);
      } catch {}
    }
  });
  try {
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['placeholder', 'title', 'aria-label', 'alt', 'data-title', 'data-label', 'value']
    });
    window.__I18N_MUTATIONS__ = observer;
  } catch {}
}
function patchI18nDialogs(){
  try {
    if (window.__I18N_DIALOGS__) return;
    window.__I18N_DIALOGS__ = true;
    if (typeof window.alert === 'function') {
      const nativeAlert = window.alert.bind(window);
      window.alert = (msg) => nativeAlert(translateStringPreserveWhitespace(String(msg || '')));
    }
    if (typeof window.confirm === 'function') {
      const nativeConfirm = window.confirm.bind(window);
      window.confirm = (msg) => nativeConfirm(translateStringPreserveWhitespace(String(msg || '')));
    }
    if (typeof window.prompt === 'function') {
      const nativePrompt = window.prompt.bind(window);
      window.prompt = (msg, def) => nativePrompt(
        translateStringPreserveWhitespace(String(msg || '')),
        translateStringPreserveWhitespace(String(def || ''))
      );
    }
  } catch {}
}
const LANG_KEY = 'site:lang';
const LANG_OFF = 'off';
const RTL_LANGS = new Set(['ar']);
const DEFAULT_LANG = (() => {
  try { return (document.documentElement.getAttribute('lang') || 'ar').toLowerCase(); } catch { return 'ar'; }
})();
const DEFAULT_DIR = (() => {
  try { return document.documentElement.getAttribute('dir') || (RTL_LANGS.has(DEFAULT_LANG) ? 'rtl' : 'ltr'); }
  catch { return RTL_LANGS.has(DEFAULT_LANG) ? 'rtl' : 'ltr'; }
})();
const langSelects = new Set();
let currentLang = null;

function normalizeLang(lang){
  const key = (lang || '').toString().toLowerCase();
  if (key === LANG_OFF) return LANG_OFF;
  return I18N_TEXT[key] ? key : DEFAULT_LANG;
}
function readStoredLang(){
  try { return localStorage.getItem(LANG_KEY); } catch { return null; }
}
function translateKey(key, fallback){
  if (!key) return toLatinDigits(fallback || '');
  if (currentLang === LANG_OFF || currentLang === 'ar') {
    return toLatinDigits((fallback != null) ? fallback : key);
  }
  const dict = I18N_TEXT[currentLang] || I18N_TEXT.ar || {};
  if (Object.prototype.hasOwnProperty.call(dict, key)) return toLatinDigits(restoreSiteBrandText(dict[key]));
  const rawFallback = (fallback != null) ? fallback : key;
  const rawTranslated = translateRawText(rawFallback);
  return toLatinDigits(restoreSiteBrandText(rawTranslated != null ? rawTranslated : rawFallback));
}
function applyTranslations(root){
  try {
    if (root && root.querySelectorAll) {
      root.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (!key) return;
      if (!el.dataset.i18nFallback) el.dataset.i18nFallback = el.textContent || '';
      const val = translateKey(key, el.dataset.i18nFallback);
      if (val != null) el.textContent = val;
      });
      root.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (!key) return;
      if (!el.dataset.i18nPlaceholderFallback) el.dataset.i18nPlaceholderFallback = el.getAttribute('placeholder') || '';
      const val = translateKey(key, el.dataset.i18nPlaceholderFallback);
      if (val != null) el.setAttribute('placeholder', val);
      });
      root.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
      const key = el.getAttribute('data-i18n-aria-label');
      if (!key) return;
      if (!el.dataset.i18nAriaFallback) el.dataset.i18nAriaFallback = el.getAttribute('aria-label') || '';
      const val = translateKey(key, el.dataset.i18nAriaFallback);
      if (val != null) el.setAttribute('aria-label', val);
      });
      root.querySelectorAll('[data-i18n-alt]').forEach(el => {
      const key = el.getAttribute('data-i18n-alt');
      if (!key) return;
      if (!el.dataset.i18nAltFallback) el.dataset.i18nAltFallback = el.getAttribute('alt') || '';
      const val = translateKey(key, el.dataset.i18nAltFallback);
      if (val != null) el.setAttribute('alt', val);
      });
      root.querySelectorAll('[data-i18n-title]').forEach(el => {
      const key = el.getAttribute('data-i18n-title');
      if (!key) return;
      if (!el.dataset.i18nTitleFallback) el.dataset.i18nTitleFallback = el.getAttribute('title') || '';
      const val = translateKey(key, el.dataset.i18nTitleFallback);
      if (val != null) el.setAttribute('title', val);
      });
      root.querySelectorAll('[data-i18n-data-title]').forEach(el => {
      const key = el.getAttribute('data-i18n-data-title');
      if (!key) return;
      if (!el.dataset.i18nDataTitleFallback) el.dataset.i18nDataTitleFallback = el.getAttribute('data-title') || '';
      const val = translateKey(key, el.dataset.i18nDataTitleFallback);
      if (val != null) el.setAttribute('data-title', val);
      });
    }
  } catch {}
  try { applyAutoTranslations(root); } catch {}
  try { applyMetaTranslations(); } catch {}
  try { enforceLatinDigits(root || document); } catch {}
}
const I18N_STABILIZE_DELAYS = [0, 32, 120, 360];
let i18nStabilizeScope = null;
let i18nStabilizeTimers = [];
function normalizeI18nScope(root){
  if (!root || !root.nodeType) return document;
  if (root === document || root === document.documentElement || root === document.body) return document;
  return root;
}
function clearI18nStabilizeTimers(){
  while (i18nStabilizeTimers.length) {
    const timer = i18nStabilizeTimers.pop();
    try { clearTimeout(timer); } catch {}
  }
}
function scheduleI18nStabilize(root){
  i18nStabilizeScope = normalizeI18nScope(root);
  clearI18nStabilizeTimers();
  I18N_STABILIZE_DELAYS.forEach((delay) => {
    const timer = setTimeout(() => {
      i18nStabilizeTimers = i18nStabilizeTimers.filter((entry) => entry !== timer);
      const scope = i18nStabilizeScope || document;
      i18nStabilizing = true;
      try { applyTranslations(scope); } catch {}
      i18nStabilizing = false;
      try {
        if (currentLang !== LANG_OFF && currentLang !== 'ar') scheduleRuntimeFlush(0);
      } catch {}
      if (!i18nStabilizeTimers.length) i18nStabilizeScope = null;
    }, delay);
    i18nStabilizeTimers.push(timer);
  });
}
function updateLangSelectorVisual(select){
  try {
    if (!select) return;
    const holder = select.closest('#langLi');
    if (!holder) return;
    const selected = (select.options && select.options.length)
      ? (select.options[select.selectedIndex] || select.options[0])
      : null;
    const label = selected ? String(selected.textContent || selected.label || '').trim() : '';
    holder.setAttribute('data-lang-label', label || String(select.value || '').trim());
    holder.setAttribute('data-lang-value', String(select.value || '').trim());
    const menu = holder.querySelector('.lang-pm-select-menu');
    if (menu) {
      menu.querySelectorAll('.lang-pm-select-option').forEach((btn) => {
        const on = btn.dataset.value === String(select.value || '');
        btn.classList.toggle('selected', on);
        btn.setAttribute('aria-selected', on ? 'true' : 'false');
      });
    }
  } catch {}
}
function syncLangSelects(){
  langSelects.forEach(select => {
    try { if (select.value !== currentLang) select.value = currentLang; } catch {}
    try { updateLangSelectorVisual(select); } catch {}
  });
}
function applyLang(lang, opts){
  const next = normalizeLang(lang);
  currentLang = next;
  const isOff = next === LANG_OFF;
  const langForDom = isOff ? DEFAULT_LANG : next;
  const dirForDom = isOff ? DEFAULT_DIR : (RTL_LANGS.has(next) ? 'rtl' : 'ltr');
  try {
    const root = document.documentElement;
    root.setAttribute('lang', langForDom);
    root.setAttribute('dir', dirForDom);
    root.setAttribute('data-lang', next);
  } catch {}
  try { if (!(opts && opts.store === false)) localStorage.setItem(LANG_KEY, next); } catch {}
  try {
    const localeMap = { ar: 'ar_AR', en: 'en_US', fr: 'fr_FR' };
    const metaLocale = document.querySelector('meta[property="og:locale"]');
    if (metaLocale) metaLocale.setAttribute('content', localeMap[langForDom] || 'ar_AR');
  } catch {}
  try {
    const autoText = translateKey('home.autoRibbon', langForDom === 'ar' ? '\u062A\u0644\u0642\u0627\u0626\u064A' : 'Auto');
    document.documentElement.style.setProperty('--auto-ribbon-text', `"${autoText}"`);
  } catch {}
  applyTranslations(document);
  try { ensureI18nDictLoaded().then(() => { applyTranslations(document); }); } catch {}
  try { scheduleI18nStabilize(document); } catch {}
  try {
    if (next !== LANG_OFF && next !== 'ar') scheduleRuntimeFlush(0);
  } catch {}
  try { watchI18nMutations(); } catch {}
  syncLangSelects();
  if (!opts || opts.emit !== false) {
    try { window.dispatchEvent(new CustomEvent('language:change', { detail: { lang: next } })); } catch {}
  }
}
function setLang(lang){ applyLang(lang); }
function getLang(){ return currentLang || DEFAULT_LANG; }

function setupLanguageSelect(select){
  try {
    if (!select) return;
    try { select.setAttribute('data-i18n-ignore','true'); } catch {}
    if (!select.dataset.langReady) {
      if (!select.querySelector('option')) {
        select.innerHTML = `
          <option value="ar">\u0627\u0644\u0639\u0631\u0628\u064A\u0629</option>
          <option value="en">English</option>
          <option value="fr">Fran\u00E7ais</option>
          <option value="off">\u0625\u064A\u0642\u0627\u0641\u0020\u0627\u0644\u062A\u0631\u062C\u0645\u0629</option>
        `;
      }
      if (!select.querySelector(`option[value="${LANG_OFF}"]`)) {
        const opt = document.createElement('option');
        opt.value = LANG_OFF;
        opt.textContent = '\u0625\u064A\u0642\u0627\u0641\u0020\u0627\u0644\u062A\u0631\u062C\u0645\u0629';
        select.appendChild(opt);
      }
      select.addEventListener('change', () => {
        try { updateLangSelectorVisual(select); } catch {}
        setLang(select.value);
      });
      select.dataset.langReady = '1';
    }
    langSelects.add(select);
    if (!currentLang) currentLang = normalizeLang(readStoredLang() || document.documentElement.getAttribute('data-lang') || DEFAULT_LANG);
    select.value = currentLang;
    updateLangSelectorVisual(select);
  } catch {}
}

function attachLanguageSelector(){
  try {
    const ul = document.querySelector('#sidebar ul');
    if (!ul) return;
    const existingLi = document.getElementById('langLi');
    if (existingLi) {
      const hasCustomMenu = !!existingLi.querySelector('.lang-pm-select-menu');
      const hasLangSelect = !!existingLi.querySelector('.lang-select--sidebar, select');
      if (hasCustomMenu && hasLangSelect) return;
      try { existingLi.remove(); } catch {}
    }
    const li = document.createElement('li');
    li.id = 'langLi';
    li.className = 'lang-item';
    li.style.position = 'relative';
    li.tabIndex = 0;
    li.innerHTML = '<i class="fa-solid fa-language"></i><a href="#" data-i18n="nav.language">\u0627\u0644\u0644\u063A\u0629</a>';
    const labelA = li.querySelector('a');
    if (labelA) labelA.style.pointerEvents = 'none';

    const select = document.createElement('select');
    select.className = 'lang-select lang-select--sidebar';
    try { select.setAttribute('data-i18n-ignore', 'true'); } catch {}
    select.setAttribute('aria-hidden', 'true');
    select.tabIndex = -1;
    select.style.position = 'absolute';
    select.style.width = '0';
    select.style.height = '0';
    select.style.opacity = '0';
    select.style.pointerEvents = 'none';
    select.style.visibility = 'hidden';
    select.style.display = 'none';

    const menu = document.createElement('div');
    menu.className = 'lang-pm-select-menu';
    menu.setAttribute('role', 'listbox');
    menu.tabIndex = -1;
    li.appendChild(menu);

    let isOpen = false;
    function placeMenuBySpace(){
      try {
        const sidebar = document.getElementById('sidebar');
        if (!sidebar) return;
        li.classList.remove('menu-up', 'menu-down');

        const sideRect = sidebar.getBoundingClientRect();
        const liRect = li.getBoundingClientRect();
        const margin = 10;
        const spaceBelow = Math.max(0, Math.floor(sideRect.bottom - liRect.bottom - margin));
        const spaceAbove = Math.max(0, Math.floor(liRect.top - sideRect.top - margin));

        let preferredHeight = 200;
        try {
          const optionsCount = menu.querySelectorAll('.lang-pm-select-option').length;
          if (optionsCount > 0) preferredHeight = Math.min(240, Math.max(120, optionsCount * 42 + 12));
        } catch {}

        let openUp = false;
        if (spaceBelow >= preferredHeight) openUp = false;
        else if (spaceAbove >= preferredHeight) openUp = true;
        else openUp = spaceAbove > spaceBelow;

        const available = Math.max(110, openUp ? spaceAbove : spaceBelow);
        const finalMax = Math.max(110, Math.min(240, available));
        menu.style.maxHeight = `${finalMax}px`;
        li.classList.add(openUp ? 'menu-up' : 'menu-down');
      } catch {}
    }
    function closeMenu(){
      if (!isOpen) return;
      isOpen = false;
      li.classList.remove('open');
    }
    function openMenu(){
      if (isOpen) return;
      placeMenuBySpace();
      isOpen = true;
      li.classList.add('open');
      try { requestAnimationFrame(placeMenuBySpace); } catch {}
    }
    function toggleMenu(){
      if (isOpen) closeMenu();
      else openMenu();
    }
    function rebuildMenuOptions(){
      try {
        while (menu.firstChild) menu.removeChild(menu.firstChild);
        const options = Array.from(select.options || []);
        options.forEach((opt) => {
          if (!opt || !opt.value) return;
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'lang-pm-select-option';
          btn.dataset.value = String(opt.value);
          btn.setAttribute('role', 'option');
          btn.textContent = String(opt.textContent || '').trim();
          btn.addEventListener('click', (ev) => {
            try { ev.preventDefault(); ev.stopPropagation(); } catch {}
            if (select.value === opt.value) {
              updateLangSelectorVisual(select);
              closeMenu();
              return;
            }
            select.value = opt.value;
            try { select.dispatchEvent(new Event('change', { bubbles: true })); } catch {}
            closeMenu();
          });
          menu.appendChild(btn);
        });
        updateLangSelectorVisual(select);
      } catch {}
    }

    setupLanguageSelect(select);
    rebuildMenuOptions();

    li.addEventListener('click', (e) => {
      const option = e.target && e.target.closest ? e.target.closest('.lang-pm-select-option') : null;
      if (option) return;
      try { e.preventDefault(); e.stopPropagation(); } catch {}
      toggleMenu();
    });
    li.addEventListener('keydown', (e) => {
      try {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggleMenu();
          return;
        }
        if (e.key === 'Escape') closeMenu();
      } catch {}
    });
    document.addEventListener('click', (e) => {
      try {
        if (!li.contains(e.target)) closeMenu();
      } catch {}
    }, true);
    document.addEventListener('keydown', (e) => {
      try { if (e.key === 'Escape') closeMenu(); } catch {}
    });
    const repositionIfOpen = () => {
      try { if (isOpen) placeMenuBySpace(); } catch {}
    };
    try { window.addEventListener('resize', repositionIfOpen); } catch {}
    try {
      const side = document.getElementById('sidebar');
      if (side) side.addEventListener('scroll', repositionIfOpen, { passive: true });
    } catch {}

    window.addEventListener('language:change', () => {
      try {
        if (select.value !== currentLang) select.value = currentLang;
        rebuildMenuOptions();
        closeMenu();
      } catch {}
    });

    li.appendChild(select);
    ul.appendChild(li);
    applyTranslations(li);
  } catch {}
}

(function initI18n(){
  const initial = normalizeLang(readStoredLang() || document.documentElement.getAttribute('data-lang') || DEFAULT_LANG);
  applyLang(initial, { store: false, emit: false });
  try { patchI18nDialogs(); } catch {}
  try { ensureI18nDictLoaded().then(() => { applyTranslations(document); }); } catch {}
  try { watchI18nMutations(); } catch {}
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      applyTranslations(document);
      scheduleI18nStabilize(document);
    });
  } else {
    applyTranslations(document);
    scheduleI18nStabilize(document);
  }
  try { window.addEventListener('load', () => { scheduleI18nStabilize(document); }); } catch {}
  try { window.addEventListener('pageshow', () => { scheduleI18nStabilize(document); }); } catch {}
  window.addEventListener('DOMContentLoaded', attachLanguageSelector);
  try { setTimeout(attachLanguageSelector, 200); setTimeout(attachLanguageSelector, 1000); } catch {}
})();

try { window.__I18N__ = { t: translateKey, setLang, getLang, applyTranslations, setupLanguageSelect, prewarm: prewarmRuntimeTranslations }; } catch {}

(function(){
  const CUSTOM_CONTEXT_MENU_ENABLED = (function(){
    try {
      const root = document && document.documentElement ? document.documentElement : null;
      const raw = String(root && root.getAttribute ? (root.getAttribute('data-custom-context-menu') || '') : '').trim().toLowerCase();
      if (!raw) return true;
      return !(raw === '0' || raw === 'false' || raw === 'off' || raw === 'disabled');
    } catch (_) {
      return true;
    }
  })();
  const CONTEXT_MENU_ID = 'appContextMenu';
  const CONTEXT_MENU_MARGIN = 10;
  const TOUCH_LONG_PRESS_MS = 420;
  const TOUCH_MOVE_TOLERANCE = 12;
  const TOUCH_CONTEXT_GRACE_MS = 1600;
  const TOUCH_SELECTION_ATTR = 'data-touch-text-selection';
  const TOUCH_SELECTION_HOST_ATTR = 'data-touch-text-selection-host';
  const TOUCH_SELECTION_UI_ID = 'appTouchSelectionUi';
  const NON_TEXT_INPUT_TYPES = new Set([
    'button', 'checkbox', 'color', 'file', 'hidden', 'image',
    'radio', 'range', 'reset', 'submit'
  ]);
  const STATIC_TEXT_TAGS = new Set([
    'article', 'blockquote', 'code', 'em', 'figcaption', 'h1', 'h2', 'h3',
    'h4', 'h5', 'h6', 'li', 'p', 'pre', 'small', 'span', 'strong', 'td', 'th'
  ]);
  let contextMenuState = {
    root: null,
    list: null,
    visible: false,
    context: null,
    touchSelectableTarget: null,
    touchSelectableHost: null,
    lastTouchTextPressAt: 0,
    selectionCleanupTimer: 0,
    touchLongPress: null
  };
  let touchTextSelectionState = {
    root: null,
    toolbar: null,
    startHandle: null,
    endHandle: null,
    active: false,
    target: null,
    text: '',
    textMap: [],
    start: 0,
    end: 0,
    dragHandle: '',
    dragPointerId: null
  };

  function getContextMenuLabel(key, fallback){
    try { return translateKey(key, fallback); } catch {}
    return fallback;
  }

  function normalizeContextMenuText(value){
    return String(value == null ? '' : value).replace(/\r/g, '').trim();
  }

  function normalizeContextMenuCopyText(value){
    return String(value == null ? '' : value).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  }

  function getContextMenuTarget(target){
    if (!target) return null;
    if (target.nodeType === 1) return target;
    return target.parentElement || null;
  }

  function isTouchLikePointer(event){
    const pointerType = String(event && event.pointerType || '').toLowerCase();
    return pointerType === 'touch' || pointerType === 'pen';
  }

  function getCurrentSelectionText(){
    try {
      const selection = window.getSelection();
      return normalizeContextMenuText(selection ? selection.toString() : '');
    } catch {}
    return '';
  }

  function getTouchSelectionHost(target){
    const element = getContextMenuTarget(target);
    if (!element || !element.closest) return null;
    return element.closest('a[href],button,[role="button"],summary,[data-catalog-card]');
  }

  function isTextualInput(element){
    if (!element || element.nodeType !== 1) return false;
    const tag = String(element.tagName || '').toLowerCase();
    if (tag === 'textarea') return true;
    if (tag !== 'input') return false;
    const type = String(element.getAttribute('type') || element.type || 'text').toLowerCase();
    return !NON_TEXT_INPUT_TYPES.has(type);
  }

  function isEditableElement(element){
    if (!element || element.nodeType !== 1) return false;
    return isTextualInput(element);
  }

  function isSensitiveEditable(element){
    if (!element || element.nodeType !== 1) return false;
    if (String(element.tagName || '').toLowerCase() !== 'input') return false;
    return String(element.getAttribute('type') || element.type || '').toLowerCase() === 'password';
  }

  function isDisabledEditable(element){
    try { return !!(element && element.disabled); } catch {}
    return false;
  }

  function isReadOnlyEditable(element){
    try { return !!(element && element.readOnly); } catch {}
    return false;
  }

  function closestEditableTarget(target){
    let element = getContextMenuTarget(target);
    while (element && element !== document.body && element !== document.documentElement) {
      if (isEditableElement(element)) return element;
      element = element.parentElement;
    }
    return null;
  }

  function getStaticTextCandidate(target){
    let element = getContextMenuTarget(target);
    while (element && element !== document.body && element !== document.documentElement) {
      if (isEditableElement(element)) return null;
      const tag = String(element.tagName || '').toLowerCase();
      if (!tag || ['audio', 'canvas', 'img', 'input', 'script', 'style', 'svg', 'textarea', 'video'].includes(tag)) {
        element = element.parentElement;
        continue;
      }
      const text = normalizeContextMenuText(element.innerText || element.textContent || '');
      if (!text) {
        element = element.parentElement;
        continue;
      }
      if (STATIC_TEXT_TAGS.has(tag)) return element;
      if (element.childElementCount <= 2 && text.length <= 700) return element;
      element = element.parentElement;
    }
    return null;
  }

  function isPointInsideTextRects(node, clientX, clientY){
    if (!node) return false;
    try {
      const range = document.createRange();
      if (node.nodeType === 3) range.selectNodeContents(node);
      else range.selectNodeContents(node);
      const x = Number(clientX);
      const y = Number(clientY);
      return Array.from(range.getClientRects ? range.getClientRects() : []).some(function(rect){
        return rect && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
      });
    } catch {}
    return false;
  }

  function findStaticTextTarget(target, clientX, clientY){
    const element = getContextMenuTarget(target);
    if (!element) return null;
    if (element.closest && element.closest(
      '#' + CONTEXT_MENU_ID + ',select,option,[data-native-context-menu],[data-context-menu-ignore]'
    )) {
      return null;
    }
    const hasPoint = Number.isFinite(Number(clientX)) && Number.isFinite(Number(clientY));
    if (!hasPoint) return getStaticTextCandidate(element);
    try {
      if (document.caretPositionFromPoint) {
        const pos = document.caretPositionFromPoint(Number(clientX), Number(clientY));
        const node = pos && pos.offsetNode ? pos.offsetNode : null;
        if (node) {
          const origin = node.nodeType === 1 ? node : (node.parentElement || null);
          if (origin && element.contains(origin) && isPointInsideTextRects(node, clientX, clientY)) {
            return getStaticTextCandidate(origin);
          }
        }
      }
    } catch {}
    try {
      if (document.caretRangeFromPoint) {
        const range = document.caretRangeFromPoint(Number(clientX), Number(clientY));
        const node = range && range.startContainer ? range.startContainer : null;
        if (node) {
          const origin = node.nodeType === 1 ? node : (node.parentElement || null);
          if (origin && element.contains(origin) && isPointInsideTextRects(node, clientX, clientY)) {
            return getStaticTextCandidate(origin);
          }
        }
      }
    } catch {}
    const directCandidate = getStaticTextCandidate(element);
    if (!directCandidate) return null;
    try {
      const x = Number(clientX);
      const y = Number(clientY);
      const walker = document.createTreeWalker(directCandidate, NodeFilter.SHOW_TEXT, {
        acceptNode: function(node){
          return normalizeContextMenuText(node && node.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        }
      });
      let current = null;
      while ((current = walker.nextNode())) {
        const range = document.createRange();
        range.selectNodeContents(current);
        const hit = Array.from(range.getClientRects ? range.getClientRects() : []).some(function(rect){
          return rect && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
        });
        if (hit) return directCandidate;
      }
    } catch {}
    return null;
  }

  function clearTouchSelectableTarget(force){
    const current = contextMenuState.touchSelectableTarget;
    const host = contextMenuState.touchSelectableHost;
    if (!current && !host) return;
    if (!force && getCurrentSelectionText()) return;
    if (current) {
      try { current.removeAttribute(TOUCH_SELECTION_ATTR); } catch {}
    }
    if (host) {
      try { host.removeAttribute(TOUCH_SELECTION_HOST_ATTR); } catch {}
    }
    contextMenuState.touchSelectableTarget = null;
    contextMenuState.touchSelectableHost = null;
  }

  function setTouchSelectableTarget(target){
    const element = getContextMenuTarget(target);
    if (!element) return;
    const host = getTouchSelectionHost(element);
    if (
      (contextMenuState.touchSelectableTarget && contextMenuState.touchSelectableTarget !== element) ||
      (contextMenuState.touchSelectableHost && contextMenuState.touchSelectableHost !== host)
    ) {
      clearTouchSelectableTarget(true);
    }
    contextMenuState.touchSelectableTarget = element;
    contextMenuState.touchSelectableHost = host || null;
    try { element.setAttribute(TOUCH_SELECTION_ATTR, '1'); } catch {}
    if (host) {
      try { host.setAttribute(TOUCH_SELECTION_HOST_ATTR, '1'); } catch {}
    }
  }

  function shouldSuppressTouchSelectionClick(target){
    const element = getContextMenuTarget(target);
    if (!element) return false;
    if (!getCurrentSelectionText()) return false;
    if (!contextMenuState.lastTouchTextPressAt) return false;
    if ((Date.now() - contextMenuState.lastTouchTextPressAt) > TOUCH_CONTEXT_GRACE_MS) return false;
    if (contextMenuState.touchSelectableTarget && contextMenuState.touchSelectableTarget.contains(element)) return true;
    if (contextMenuState.touchSelectableHost && contextMenuState.touchSelectableHost.contains(element)) return true;
    return false;
  }

  function isTargetInsideActiveTouchSelection(target){
    const element = getContextMenuTarget(target);
    if (!element || !isTouchTextSelectionActive()) return false;
    if (touchTextSelectionState.target && touchTextSelectionState.target.contains(element)) return true;
    if (contextMenuState.touchSelectableHost && contextMenuState.touchSelectableHost.contains(element)) return true;
    return false;
  }

  function scheduleTouchSelectionCleanup(){
    try { clearTimeout(contextMenuState.selectionCleanupTimer); } catch {}
    contextMenuState.selectionCleanupTimer = setTimeout(function(){
      if (!getCurrentSelectionText()) {
        clearTouchSelectableTarget(false);
      }
    }, 120);
  }

  function clearTouchLongPress(pointerId){
    const state = contextMenuState.touchLongPress;
    if (!state) return;
    if (pointerId != null && state.pointerId !== pointerId) return;
    try { clearTimeout(state.timer); } catch {}
    contextMenuState.touchLongPress = null;
  }

  function selectEditableForTouch(editable){
    if (!editable || isSensitiveEditable(editable) || isDisabledEditable(editable)) return false;
    const tag = String(editable.tagName || '').toLowerCase();
    try { editable.focus({ preventScroll: true }); } catch {}
    if (tag === 'input' || tag === 'textarea') {
      try {
        if (typeof editable.select === 'function') editable.select();
        if (typeof editable.setSelectionRange === 'function') {
          const valueLength = String(editable.value == null ? '' : editable.value).length;
          editable.setSelectionRange(0, valueLength);
        }
        return true;
      } catch {}
      return false;
    }
    selectElementContents(editable);
    return true;
  }

  function triggerTouchLongPressSelection(state){
    if (!state) return;
    contextMenuState.lastTouchTextPressAt = Date.now();
    if (state.staticTextTarget) {
      activateTouchTextSelection(state.staticTextTarget, state.startX, state.startY);
      return;
    }
    if (state.editable) {
      selectEditableForTouch(state.editable);
    }
  }

  function startTouchLongPress(event){
    if (!isTouchLikePointer(event)) return;
    clearTouchLongPress();
    const element = getContextMenuTarget(event.target);
    if (!element) return;
    const editable = closestEditableTarget(element);
    const staticTextTarget = editable ? null : findStaticTextTarget(
      element,
      Number(event.clientX),
      Number(event.clientY)
    );
    if (!editable && !staticTextTarget) return;
    const pointerId = Number(event.pointerId);
    const state = {
      pointerId: Number.isFinite(pointerId) ? pointerId : null,
      startX: Number(event.clientX) || 0,
      startY: Number(event.clientY) || 0,
      editable: editable || null,
      staticTextTarget: staticTextTarget || null,
      timer: 0
    };
    state.timer = setTimeout(function(){
      triggerTouchLongPressSelection(state);
      contextMenuState.touchLongPress = null;
    }, TOUCH_LONG_PRESS_MS);
    contextMenuState.touchLongPress = state;
  }

  function updateTouchLongPress(event){
    const state = contextMenuState.touchLongPress;
    if (!state) return;
    const pointerId = Number(event.pointerId);
    if (state.pointerId != null && Number.isFinite(pointerId) && state.pointerId !== pointerId) return;
    const dx = Math.abs((Number(event.clientX) || 0) - state.startX);
    const dy = Math.abs((Number(event.clientY) || 0) - state.startY);
    if (dx > TOUCH_MOVE_TOLERANCE || dy > TOUCH_MOVE_TOLERANCE) {
      clearTouchLongPress(state.pointerId);
    }
  }

  function rememberTouchSelectionTarget(eventOrTarget){
    const source = eventOrTarget && eventOrTarget.target ? eventOrTarget : { target: eventOrTarget };
    const element = getContextMenuTarget(source.target);
    if (!element) {
      contextMenuState.lastTouchTextPressAt = 0;
      clearTouchSelectableTarget(false);
      return;
    }
    const editable = closestEditableTarget(element);
    if (editable && !isSensitiveEditable(editable)) {
      contextMenuState.lastTouchTextPressAt = Date.now();
      clearTouchSelectableTarget(true);
      return;
    }
    const staticTextTarget = findStaticTextTarget(
      element,
      Number(source.clientX),
      Number(source.clientY)
    );
    if (staticTextTarget) {
      contextMenuState.lastTouchTextPressAt = Date.now();
      setTouchSelectableTarget(staticTextTarget);
      return;
    }
    contextMenuState.lastTouchTextPressAt = 0;
    clearTouchSelectableTarget(false);
  }

  function shouldAllowNativeTouchSelection(context){
    if (!context) return false;
    if (!contextMenuState.lastTouchTextPressAt) return false;
    if ((Date.now() - contextMenuState.lastTouchTextPressAt) > TOUCH_CONTEXT_GRACE_MS) return false;
    if (context.editable && !isSensitiveEditable(context.editable)) {
      return true;
    }
    if (context.staticTextTarget) {
      setTouchSelectableTarget(context.staticTextTarget);
      return true;
    }
    return false;
  }

  function snapshotEditableSelection(editable){
    const snapshot = { start: null, end: null, range: null };
    if (!editable) return snapshot;
    const tag = String(editable.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea') {
      const start = Number(editable.selectionStart);
      const end = Number(editable.selectionEnd);
      snapshot.start = Number.isFinite(start) ? start : null;
      snapshot.end = Number.isFinite(end) ? end : snapshot.start;
      return snapshot;
    }
    try {
      const selection = window.getSelection();
      if (selection && selection.rangeCount && editable.contains(selection.anchorNode) && editable.contains(selection.focusNode)) {
        snapshot.range = selection.getRangeAt(0).cloneRange();
      }
    } catch {}
    return snapshot;
  }

  function getEditableSelectionText(editable, snapshot){
    if (!editable || isSensitiveEditable(editable)) return '';
    const tag = String(editable.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea') {
      const value = String(editable.value == null ? '' : editable.value);
      const start = Number(snapshot && snapshot.start);
      const end = Number(snapshot && snapshot.end);
      if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
        return value.slice(start, end);
      }
      return '';
    }
    try {
      const selection = window.getSelection();
      if (selection && !selection.isCollapsed && editable.contains(selection.anchorNode) && editable.contains(selection.focusNode)) {
        return String(selection.toString() || '');
      }
    } catch {}
    try {
      return snapshot && snapshot.range ? String(snapshot.range.toString() || '') : '';
    } catch {}
    return '';
  }

  function getStaticSelectionText(target){
    const node = getContextMenuTarget(target);
    if (!node) return '';
    try {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !selection.rangeCount) return '';
      let intersects = false;
      for (let i = 0; i < selection.rangeCount; i += 1) {
        const range = selection.getRangeAt(i);
        if (range && typeof range.intersectsNode === 'function' && range.intersectsNode(node)) {
          intersects = true;
          break;
        }
      }
      if (!intersects && typeof selection.containsNode === 'function') {
        intersects = selection.containsNode(node, true);
      }
      return intersects ? String(selection.toString() || '') : '';
    } catch {}
    return '';
  }

  function getEditableWholeText(editable){
    if (!editable || isSensitiveEditable(editable)) return '';
    const tag = String(editable.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea') {
      return normalizeContextMenuCopyText(editable.value || '');
    }
    return normalizeContextMenuCopyText(editable.innerText || editable.textContent || '');
  }

  function getStaticWholeText(element){
    if (!element) return '';
    return normalizeContextMenuCopyText(element.innerText || element.textContent || '');
  }

  function buildContextSnapshot(target, clientX, clientY){
    const touchSelectionActiveHere = isTargetInsideActiveTouchSelection(target);
    const editable = touchSelectionActiveHere ? null : closestEditableTarget(target);
    const editableSelection = snapshotEditableSelection(editable);
    const editableSelectionText = getEditableSelectionText(editable, editableSelection);
    const staticTextTarget = editable
      ? null
      : (touchSelectionActiveHere && touchTextSelectionState.target
          ? touchTextSelectionState.target
          : findStaticTextTarget(target, clientX, clientY));
    const touchSelectionText = touchSelectionActiveHere ? getTouchTextSelectionText() : '';
    const staticSelectionText = normalizeContextMenuCopyText(
      touchSelectionText ||
      (staticTextTarget ? getStaticSelectionText(staticTextTarget) : '')
    );
    const editableWholeText = editable ? getEditableWholeText(editable) : '';
    const staticWholeText = staticTextTarget ? getStaticWholeText(staticTextTarget) : '';
    const selectedCopyText = normalizeContextMenuCopyText(
      editableSelectionText ||
      staticSelectionText
    );
    const editableText = normalizeContextMenuText(editableWholeText);
    const staticText = normalizeContextMenuText(staticWholeText);
    const editableSelectionValue = normalizeContextMenuText(editableSelectionText);
    const staticSelectionValue = normalizeContextMenuText(staticSelectionText);
    const hasSelectedText = !!normalizeContextMenuText(selectedCopyText);
    const hasFullEditableSelection = !!(editableText && editableSelectionValue && editableSelectionValue === editableText);
    const hasFullStaticSelection = !!(staticText && staticSelectionValue && staticSelectionValue === staticText);
    const canPaste = !!(
      editable &&
      !isDisabledEditable(editable) &&
      !isReadOnlyEditable(editable) &&
      navigator.clipboard &&
      typeof navigator.clipboard.readText === 'function'
    );
    const canSelect = !!(
      staticTextTarget &&
      staticText &&
      !staticSelectionValue
    );
    const canSelectAll = !!(
      (editable && !isDisabledEditable(editable) && editableText && !hasFullEditableSelection) ||
      (staticTextTarget && staticText && !hasFullStaticSelection)
    );
    return {
      target,
      clientX: Number(clientX),
      clientY: Number(clientY),
      editable,
      editableSelection,
      editableSelectionText: normalizeContextMenuCopyText(editableSelectionText),
      editableWholeText,
      staticTextTarget,
      staticSelectionText: normalizeContextMenuCopyText(staticSelectionText),
      staticWholeText,
      copyText: selectedCopyText,
      canCopy: hasSelectedText,
      canPaste,
      canSelect,
      canSelectAll
    };
  }

  function ensureContextMenu(){
    if (contextMenuState.root && contextMenuState.list) return contextMenuState.root;
    const root = document.createElement('div');
    root.id = CONTEXT_MENU_ID;
    root.className = 'app-context-menu';
    root.setAttribute('role', 'menu');
    root.setAttribute('aria-hidden', 'true');
    root.innerHTML = '<div class="app-context-menu__panel"><div class="app-context-menu__group" data-context-menu-list="1"></div></div>';
    root.addEventListener('contextmenu', function(event){
      try { event.preventDefault(); event.stopPropagation(); } catch {}
    });
    root.addEventListener('pointerdown', function(event){
      const actionBtn = event.target && event.target.closest ? event.target.closest('.app-context-menu__item') : null;
      if (actionBtn) {
        try { event.preventDefault(); } catch {}
      }
      try { event.stopPropagation(); } catch {}
    });
    root.addEventListener('click', function(event){
      const actionBtn = event.target && event.target.closest ? event.target.closest('.app-context-menu__item') : null;
      if (!actionBtn || actionBtn.disabled) return;
      try {
        event.preventDefault();
        event.stopPropagation();
      } catch {}
      handleContextMenuAction(String(actionBtn.getAttribute('data-context-action') || ''));
    });
    (document.body || document.documentElement).appendChild(root);
    contextMenuState.root = root;
    contextMenuState.list = root.querySelector('[data-context-menu-list]');
    return root;
  }

  function hideContextMenu(){
    if (!contextMenuState.root) return;
    contextMenuState.visible = false;
    contextMenuState.context = null;
    contextMenuState.root.classList.remove('is-visible');
    contextMenuState.root.setAttribute('aria-hidden', 'true');
    contextMenuState.root.style.left = '0px';
    contextMenuState.root.style.top = '0px';
  }

  function renderContextMenuItems(items){
    ensureContextMenu();
    if (!contextMenuState.list) return;
    while (contextMenuState.list.firstChild) contextMenuState.list.removeChild(contextMenuState.list.firstChild);
    items.forEach(function(item){
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'app-context-menu__item';
      btn.setAttribute('role', 'menuitem');
      btn.setAttribute('data-context-action', item.action);
      if (item.disabled) {
        btn.disabled = true;
        btn.setAttribute('aria-disabled', 'true');
      }
      const label = document.createElement('span');
      label.className = 'app-context-menu__label';
      label.textContent = item.label;
      const iconWrap = document.createElement('span');
      iconWrap.className = 'app-context-menu__icon';
      const icon = document.createElement('i');
      icon.className = item.icon;
      icon.setAttribute('aria-hidden', 'true');
      iconWrap.appendChild(icon);
      btn.appendChild(label);
      btn.appendChild(iconWrap);
      contextMenuState.list.appendChild(btn);
    });
  }

  function positionContextMenu(x, y){
    const root = ensureContextMenu();
    root.style.left = '0px';
    root.style.top = '0px';
    const rect = root.getBoundingClientRect();
    const viewportWidth = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
    const viewportHeight = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
    const left = Math.max(CONTEXT_MENU_MARGIN, Math.min(x, viewportWidth - rect.width - CONTEXT_MENU_MARGIN));
    const top = Math.max(CONTEXT_MENU_MARGIN, Math.min(y, viewportHeight - rect.height - CONTEXT_MENU_MARGIN));
    root.style.left = left + 'px';
    root.style.top = top + 'px';
  }

  function openContextMenu(context, items, x, y){
    renderContextMenuItems(items);
    const root = ensureContextMenu();
    contextMenuState.context = context;
    contextMenuState.visible = true;
    root.classList.add('is-visible');
    root.setAttribute('aria-hidden', 'false');
    positionContextMenu(x, y);
  }

  function copyTextWithFallback(value){
    return new Promise(function(resolve){
      const text = normalizeContextMenuCopyText(value);
      if (!normalizeContextMenuText(text)) {
        resolve(false);
        return;
      }
      try {
        const helper = document.createElement('textarea');
        helper.value = text;
        helper.setAttribute('readonly', 'true');
        helper.style.position = 'fixed';
        helper.style.opacity = '0';
        helper.style.pointerEvents = 'none';
        helper.style.inset = '0';
        (document.body || document.documentElement).appendChild(helper);
        helper.focus({ preventScroll: true });
        helper.select();
        const ok = !!(document.execCommand && document.execCommand('copy'));
        helper.remove();
        resolve(ok);
      } catch {
        resolve(false);
      }
    });
  }

  async function copyContextText(context){
    const text = normalizeContextMenuCopyText(context && context.copyText);
    if (!normalizeContextMenuText(text)) return false;
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {}
    return copyTextWithFallback(text);
  }

  function dispatchEditableInput(editable, inputType, data){
    try {
      const event = (typeof InputEvent === 'function')
        ? new InputEvent('input', {
            bubbles: true,
            cancelable: false,
            data: data == null ? null : String(data),
            inputType: inputType || 'insertText'
          })
        : new Event('input', { bubbles: true });
      editable.dispatchEvent(event);
    } catch {
      try { editable.dispatchEvent(new Event('input', { bubbles: true })); } catch {}
    }
  }

  function selectElementContents(element){
    if (!element) return;
    try {
      const range = document.createRange();
      range.selectNodeContents(element);
      applyDomRangeSelection(range);
    } catch {}
  }

  function applyDomRangeSelection(range){
    if (!range) return false;
    try {
      const selection = window.getSelection();
      if (!selection) return false;
      selection.removeAllRanges();
      selection.addRange(range);
      return true;
    } catch {}
    return false;
  }

  function clearDomSelection(){
    try {
      const selection = window.getSelection();
      if (selection) selection.removeAllRanges();
    } catch {}
  }

  function ensureTouchSelectionUi(){
    if (touchTextSelectionState.root) return touchTextSelectionState.root;
    const root = document.createElement('div');
    root.id = TOUCH_SELECTION_UI_ID;
    root.className = 'app-touch-selection';
    root.setAttribute('aria-hidden', 'true');
    root.innerHTML = [
      '<div class="app-touch-selection__toolbar" data-touch-selection-toolbar="1">',
      '  <button type="button" class="app-touch-selection__btn" data-touch-selection-action="copy">نسخ</button>',
      '</div>',
      '<button type="button" class="app-touch-selection__handle app-touch-selection__handle--start" data-touch-selection-handle="start" aria-label="بداية التحديد"></button>',
      '<button type="button" class="app-touch-selection__handle app-touch-selection__handle--end" data-touch-selection-handle="end" aria-label="نهاية التحديد"></button>'
    ].join('');
    root.addEventListener('pointerdown', function(event){
      const handle = event.target && event.target.closest ? event.target.closest('[data-touch-selection-handle]') : null;
      if (!handle) return;
      touchTextSelectionState.dragHandle = String(handle.getAttribute('data-touch-selection-handle') || '');
      touchTextSelectionState.dragPointerId = Number(event.pointerId);
      try {
        event.preventDefault();
        event.stopPropagation();
      } catch {}
    });
    root.addEventListener('click', function(event){
      const actionBtn = event.target && event.target.closest ? event.target.closest('[data-touch-selection-action]') : null;
      if (!actionBtn || actionBtn.disabled) return;
      try {
        event.preventDefault();
        event.stopPropagation();
      } catch {}
      handleTouchTextSelectionAction(String(actionBtn.getAttribute('data-touch-selection-action') || ''));
    });
    (document.body || document.documentElement).appendChild(root);
    touchTextSelectionState.root = root;
    touchTextSelectionState.toolbar = root.querySelector('[data-touch-selection-toolbar]');
    touchTextSelectionState.startHandle = root.querySelector('[data-touch-selection-handle="start"]');
    touchTextSelectionState.endHandle = root.querySelector('[data-touch-selection-handle="end"]');
    return root;
  }

  function isTouchTextSelectionUiTarget(target){
    const element = getContextMenuTarget(target);
    return !!(element && touchTextSelectionState.root && touchTextSelectionState.root.contains(element));
  }

  function isTouchTextSelectionActive(){
    return !!(touchTextSelectionState.active && touchTextSelectionState.target);
  }

  function collectTouchSelectionTextMap(target){
    if (!target || !document.createTreeWalker) return { text: '', map: [] };
    const out = [];
    let fullText = '';
    const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT, {
      acceptNode: function(node){
        const text = String(node && node.nodeValue || '');
        return normalizeContextMenuText(text) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    let current = null;
    while ((current = walker.nextNode())) {
      const value = String(current.nodeValue || '');
      const start = fullText.length;
      fullText += value;
      out.push({
        node: current,
        start: start,
        end: fullText.length
      });
    }
    return { text: fullText, map: out };
  }

  function getTouchSelectionTextLength(map){
    if (!Array.isArray(map) || !map.length) return 0;
    const last = map[map.length - 1];
    return Number(last && last.end) || 0;
  }

  function isTouchSelectionDirectionRtl(target){
    const element = getContextMenuTarget(target);
    if (!element) return false;
    try {
      const computed = window.getComputedStyle ? window.getComputedStyle(element) : null;
      if (computed && String(computed.direction || '').toLowerCase() === 'rtl') return true;
    } catch {}
    try {
      const dirHost = element.closest ? element.closest('[dir]') : null;
      if (dirHost) return String(dirHost.getAttribute('dir') || '').toLowerCase() === 'rtl';
    } catch {}
    try {
      return String(document.documentElement.getAttribute('dir') || '').toLowerCase() === 'rtl';
    } catch {}
    return false;
  }

  function resolveTouchSelectionPoint(map, index, isEndPoint){
    if (!Array.isArray(map) || !map.length) return null;
    const total = getTouchSelectionTextLength(map);
    const clamped = Math.max(0, Math.min(Number(index) || 0, total));
    if (clamped >= total) {
      const last = map[map.length - 1];
      const nodeValue = String(last && last.node && last.node.nodeValue || '');
      return { node: last.node, offset: nodeValue.length };
    }
    for (let i = 0; i < map.length; i += 1) {
      const segment = map[i];
      if (!segment || !segment.node) continue;
      if (clamped < segment.end || (isEndPoint && clamped === segment.end)) {
        return {
          node: segment.node,
          offset: Math.max(0, clamped - segment.start)
        };
      }
    }
    const first = map[0];
    return first ? { node: first.node, offset: 0 } : null;
  }

  function createTouchSelectionRange(target, map, start, end){
    if (!target || !Array.isArray(map) || !map.length) return null;
    const total = getTouchSelectionTextLength(map);
    const safeStart = Math.max(0, Math.min(Number(start) || 0, total));
    const safeEnd = Math.max(safeStart + 1, Math.min(Number(end) || 0, total));
    const startPoint = resolveTouchSelectionPoint(map, safeStart, false);
    const endPoint = resolveTouchSelectionPoint(map, safeEnd, true);
    if (!startPoint || !endPoint) return null;
    try {
      const range = document.createRange();
      range.setStart(startPoint.node, startPoint.offset);
      range.setEnd(endPoint.node, endPoint.offset);
      return range;
    } catch {
      return null;
    }
  }

  function applyTouchTextSelectionRange(){
    if (!isTouchTextSelectionActive()) return null;
    const range = createTouchSelectionRange(
      touchTextSelectionState.target,
      touchTextSelectionState.textMap,
      touchTextSelectionState.start,
      touchTextSelectionState.end
    );
    if (!range) return null;
    try {
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
      }
    } catch {}
    return range;
  }

  function getTouchTextSelectionText(){
    if (!isTouchTextSelectionActive()) return '';
    return String(touchTextSelectionState.text || '').slice(
      touchTextSelectionState.start,
      touchTextSelectionState.end
    );
  }

  function getTouchTextIndexFromPoint(target, map, x, y){
    const element = getContextMenuTarget(target);
    if (!element) return 0;
    const isRtl = isTouchSelectionDirectionRtl(element);
    try {
      if (document.caretPositionFromPoint) {
        const pos = document.caretPositionFromPoint(Number(x) || 0, Number(y) || 0);
        if (pos && pos.offsetNode && element.contains(pos.offsetNode)) {
          const range = document.createRange();
          range.selectNodeContents(element);
          range.setEnd(pos.offsetNode, Number(pos.offset) || 0);
          return Math.max(0, Math.min(range.toString().length, getTouchSelectionTextLength(map)));
        }
      }
    } catch {}
    try {
      if (document.caretRangeFromPoint) {
        const pointRange = document.caretRangeFromPoint(Number(x) || 0, Number(y) || 0);
        if (pointRange && pointRange.startContainer && element.contains(pointRange.startContainer)) {
          const range = document.createRange();
          range.selectNodeContents(element);
          range.setEnd(pointRange.startContainer, Number(pointRange.startOffset) || 0);
          return Math.max(0, Math.min(range.toString().length, getTouchSelectionTextLength(map)));
        }
      }
    } catch {}
    try {
      const rect = element.getBoundingClientRect();
      const rawRatio = rect.width > 0 ? ((Number(x) || rect.left) - rect.left) / rect.width : 0;
      const clampedRatio = Math.max(0, Math.min(rawRatio, 1));
      const ratio = isRtl ? (1 - clampedRatio) : clampedRatio;
      return Math.max(0, Math.min(Math.round(getTouchSelectionTextLength(map) * ratio), getTouchSelectionTextLength(map)));
    } catch {}
    return 0;
  }

  function findTouchWordBounds(text, index){
    const value = String(text || '');
    if (!value) return { start: 0, end: 0 };
    let cursor = Math.max(0, Math.min(Number(index) || 0, value.length));
    const isSeparator = function(char){
      return !char || /[\s.,!?;:'"(){}\[\]<>/@#$%^&*+=|\\`~_-]/.test(char);
    };
    if (cursor >= value.length) cursor = Math.max(0, value.length - 1);
    if (isSeparator(value.charAt(cursor)) && cursor > 0 && !isSeparator(value.charAt(cursor - 1))) {
      cursor -= 1;
    }
    if (isSeparator(value.charAt(cursor))) {
      for (let i = cursor + 1; i < value.length; i += 1) {
        if (!isSeparator(value.charAt(i))) {
          cursor = i;
          break;
        }
      }
    }
    let start = cursor;
    let end = cursor + 1;
    while (start > 0 && !isSeparator(value.charAt(start - 1))) start -= 1;
    while (end < value.length && !isSeparator(value.charAt(end))) end += 1;
    if (start === end) return { start: 0, end: value.length };
    return { start: start, end: end };
  }

  function getTouchSelectionProbeRect(target, map, start, end, isStart){
    const total = getTouchSelectionTextLength(map);
    if (!total) return null;
    const probeStart = isStart ? start : Math.max(start, end - 1);
    const probeEnd = isStart ? Math.min(end, start + 1) : end;
    const range = createTouchSelectionRange(target, map, probeStart, probeEnd);
    if (!range) return null;
    const rects = Array.from(range.getClientRects ? range.getClientRects() : []).filter(function(rect){
      return rect && (rect.width || rect.height);
    });
    if (rects.length) return isStart ? rects[0] : rects[rects.length - 1];
    try {
      const rect = range.getBoundingClientRect();
      if (rect && (rect.width || rect.height)) return rect;
    } catch {}
    return null;
  }

  function getTouchSelectionHandleX(rect, isStart, isRtl){
    if (!rect) return 0;
    if (isStart) return isRtl ? rect.right : rect.left;
    return isRtl ? rect.left : rect.right;
  }

  function positionTouchTextSelectionUi(){
    if (!isTouchTextSelectionActive()) return;
    const root = ensureTouchSelectionUi();
    const range = createTouchSelectionRange(
      touchTextSelectionState.target,
      touchTextSelectionState.textMap,
      touchTextSelectionState.start,
      touchTextSelectionState.end
    );
    if (!root || !range || !touchTextSelectionState.toolbar || !touchTextSelectionState.startHandle || !touchTextSelectionState.endHandle) return;
    const selectionRect = range.getBoundingClientRect ? range.getBoundingClientRect() : null;
    const startRect = getTouchSelectionProbeRect(
      touchTextSelectionState.target,
      touchTextSelectionState.textMap,
      touchTextSelectionState.start,
      touchTextSelectionState.end,
      true
    );
    const endRect = getTouchSelectionProbeRect(
      touchTextSelectionState.target,
      touchTextSelectionState.textMap,
      touchTextSelectionState.start,
      touchTextSelectionState.end,
      false
    );
    if (!selectionRect || !startRect || !endRect) return;
    const isRtl = isTouchSelectionDirectionRtl(touchTextSelectionState.target);

    const toolbar = touchTextSelectionState.toolbar;
    toolbar.style.left = '0px';
    toolbar.style.top = '0px';
    const toolbarRect = toolbar.getBoundingClientRect();
    const viewportWidth = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
    const viewportHeight = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
    const toolbarWidth = toolbarRect.width || 180;
    const toolbarHeight = toolbarRect.height || 44;
    let toolbarLeft = ((selectionRect.left + selectionRect.right) / 2) - (toolbarWidth / 2);
    let toolbarTop = selectionRect.top - toolbarHeight - 14;
    if (toolbarTop < 8) toolbarTop = Math.min(viewportHeight - toolbarHeight - 8, selectionRect.bottom + 14);
    toolbarLeft = Math.max(8, Math.min(toolbarLeft, viewportWidth - toolbarWidth - 8));
    toolbar.style.left = Math.round(toolbarLeft) + 'px';
    toolbar.style.top = Math.round(toolbarTop) + 'px';

    touchTextSelectionState.startHandle.style.left = Math.round(getTouchSelectionHandleX(startRect, true, isRtl) - 11) + 'px';
    touchTextSelectionState.startHandle.style.top = Math.round(startRect.bottom + 2) + 'px';
    touchTextSelectionState.endHandle.style.left = Math.round(getTouchSelectionHandleX(endRect, false, isRtl) - 11) + 'px';
    touchTextSelectionState.endHandle.style.top = Math.round(endRect.bottom + 2) + 'px';
  }

  function updateTouchTextSelectionButtons(){
    const root = ensureTouchSelectionUi();
    if (!root) return;
    root.querySelectorAll('[data-touch-selection-action]').forEach(function(btn){
      const action = String(btn.getAttribute('data-touch-selection-action') || '');
      let disabled = true;
      if (action === 'copy') disabled = !normalizeContextMenuText(getTouchTextSelectionText());
      btn.disabled = disabled;
      btn.setAttribute('aria-disabled', disabled ? 'true' : 'false');
    });
  }

  function showTouchTextSelection(target, mapResult, start, end){
    if (!target || !mapResult || !Array.isArray(mapResult.map) || !mapResult.map.length) return false;
    ensureTouchSelectionUi();
    touchTextSelectionState.active = true;
    touchTextSelectionState.target = target;
    touchTextSelectionState.text = String(mapResult.text || '');
    touchTextSelectionState.textMap = mapResult.map.slice();
    touchTextSelectionState.start = Math.max(0, Number(start) || 0);
    touchTextSelectionState.end = Math.max(touchTextSelectionState.start + 1, Number(end) || touchTextSelectionState.text.length);
    touchTextSelectionState.dragHandle = '';
    touchTextSelectionState.dragPointerId = null;
    if (touchTextSelectionState.root) {
      touchTextSelectionState.root.classList.add('is-visible');
      touchTextSelectionState.root.setAttribute('aria-hidden', 'false');
    }
    applyTouchTextSelectionRange();
    updateTouchTextSelectionButtons();
    positionTouchTextSelectionUi();
    return true;
  }

  function hideTouchTextSelection(options){
    const opts = options || {};
    if (touchTextSelectionState.root) {
      touchTextSelectionState.root.classList.remove('is-visible');
      touchTextSelectionState.root.setAttribute('aria-hidden', 'true');
    }
    touchTextSelectionState.active = false;
    touchTextSelectionState.target = null;
    touchTextSelectionState.text = '';
    touchTextSelectionState.textMap = [];
    touchTextSelectionState.start = 0;
    touchTextSelectionState.end = 0;
    touchTextSelectionState.dragHandle = '';
    touchTextSelectionState.dragPointerId = null;
    if (opts.clearSelection !== false) {
      clearDomSelection();
    }
  }

  function activateTouchTextSelection(target, clientX, clientY){
    const element = getContextMenuTarget(target);
    if (!element) return false;
    const mapResult = collectTouchSelectionTextMap(element);
    const total = getTouchSelectionTextLength(mapResult.map);
    if (!total) return false;
    const index = getTouchTextIndexFromPoint(element, mapResult.map, clientX, clientY);
    const bounds = findTouchWordBounds(mapResult.text, index);
    const start = Math.max(0, Math.min(bounds.start, total - 1));
    const end = Math.max(start + 1, Math.min(bounds.end, total));
    setTouchSelectableTarget(element);
    return showTouchTextSelection(element, mapResult, start, end);
  }

  async function handleTouchTextSelectionAction(action){
    if (!isTouchTextSelectionActive()) return;
    const text = getTouchTextSelectionText();
    if (action === 'copy') {
      try {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
          await navigator.clipboard.writeText(text);
        } else {
          await copyTextWithFallback(text);
        }
      } catch {
        await copyTextWithFallback(text);
      }
      hideTouchTextSelection();
      clearTouchSelectableTarget(true);
      return;
    }
    if (action === 'cut' || action === 'paste') return;
  }

  function updateTouchTextSelectionFromDrag(event){
    if (!isTouchTextSelectionActive()) return;
    if (!touchTextSelectionState.dragHandle) return;
    const pointerId = Number(event.pointerId);
    if (touchTextSelectionState.dragPointerId != null && Number.isFinite(pointerId) && touchTextSelectionState.dragPointerId !== pointerId) return;
    try {
      event.preventDefault();
      event.stopPropagation();
    } catch {}
    const nextIndex = getTouchTextIndexFromPoint(
      touchTextSelectionState.target,
      touchTextSelectionState.textMap,
      Number(event.clientX) || 0,
      Number(event.clientY) || 0
    );
    if (touchTextSelectionState.dragHandle === 'start') {
      touchTextSelectionState.start = Math.max(0, Math.min(nextIndex, touchTextSelectionState.end - 1));
    } else if (touchTextSelectionState.dragHandle === 'end') {
      touchTextSelectionState.end = Math.max(touchTextSelectionState.start + 1, Math.min(nextIndex, touchTextSelectionState.text.length));
    }
    applyTouchTextSelectionRange();
    updateTouchTextSelectionButtons();
    positionTouchTextSelectionUi();
  }

  function stopTouchTextSelectionDrag(pointerId){
    if (touchTextSelectionState.dragPointerId == null) return;
    if (pointerId != null && touchTextSelectionState.dragPointerId !== pointerId) return;
    touchTextSelectionState.dragHandle = '';
    touchTextSelectionState.dragPointerId = null;
  }

  function selectContextTarget(context){
    if (!context || !context.staticTextTarget) return;
    const mapResult = collectTouchSelectionTextMap(context.staticTextTarget);
    const total = getTouchSelectionTextLength(mapResult.map);
    if (total) {
      const hasPoint = Number.isFinite(Number(context.clientX)) && Number.isFinite(Number(context.clientY));
      if (hasPoint) {
        const index = getTouchTextIndexFromPoint(
          context.staticTextTarget,
          mapResult.map,
          Number(context.clientX),
          Number(context.clientY)
        );
        const bounds = findTouchWordBounds(mapResult.text, index);
        const start = Math.max(0, Math.min(Number(bounds.start) || 0, Math.max(total - 1, 0)));
        const end = Math.max(start + 1, Math.min(Number(bounds.end) || 0, total));
        const range = createTouchSelectionRange(context.staticTextTarget, mapResult.map, start, end);
        if (applyDomRangeSelection(range)) return;
      }
    }
    selectElementContents(context.staticTextTarget);
  }

  function selectAllContextTarget(context){
    if (!context) return;
    if (context.editable) {
      const editable = context.editable;
      const tag = String(editable.tagName || '').toLowerCase();
      try { editable.focus({ preventScroll: true }); } catch {}
      if (tag === 'input' || tag === 'textarea') {
        try {
          editable.select();
          if (typeof editable.setSelectionRange === 'function') {
            const valueLength = String(editable.value == null ? '' : editable.value).length;
            editable.setSelectionRange(0, valueLength);
          }
        } catch {}
        return;
      }
      selectElementContents(editable);
      return;
    }
    if (context.staticTextTarget) selectElementContents(context.staticTextTarget);
  }

  async function pasteIntoEditable(context){
    if (!context || !context.editable || !context.canPaste) return false;
    let clipText = '';
    try {
      clipText = await navigator.clipboard.readText();
    } catch {
      return false;
    }
    if (clipText == null) return false;
    const editable = context.editable;
    const tag = String(editable.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea') {
      const value = String(editable.value == null ? '' : editable.value);
      const start = Number(context.editableSelection && context.editableSelection.start);
      const end = Number(context.editableSelection && context.editableSelection.end);
      const safeStart = Number.isFinite(start) ? start : value.length;
      const safeEnd = Number.isFinite(end) ? end : safeStart;
      try { editable.focus({ preventScroll: true }); } catch {}
      if (typeof editable.setRangeText === 'function') {
        try {
          editable.setRangeText(String(clipText), safeStart, safeEnd, 'end');
          dispatchEditableInput(editable, 'insertFromPaste', clipText);
          return true;
        } catch {}
      }
      editable.value = value.slice(0, safeStart) + String(clipText) + value.slice(safeEnd);
      try {
        const caret = safeStart + String(clipText).length;
        if (typeof editable.setSelectionRange === 'function') editable.setSelectionRange(caret, caret);
      } catch {}
      dispatchEditableInput(editable, 'insertFromPaste', clipText);
      return true;
    }
    try { editable.focus({ preventScroll: true }); } catch {}
    let range = null;
    try {
      range = context.editableSelection && context.editableSelection.range
        ? context.editableSelection.range.cloneRange()
        : null;
    } catch {}
    if (!range || !editable.contains(range.commonAncestorContainer)) {
      try {
        range = document.createRange();
        range.selectNodeContents(editable);
        range.collapse(false);
      } catch {
        range = null;
      }
    }
    if (!range) return false;
    try {
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
      }
    } catch {}
    try {
      if (document.execCommand && document.execCommand('insertText', false, String(clipText))) {
        dispatchEditableInput(editable, 'insertFromPaste', clipText);
        return true;
      }
    } catch {}
    try {
      range.deleteContents();
      const textNode = document.createTextNode(String(clipText));
      range.insertNode(textNode);
      range.setStartAfter(textNode);
      range.collapse(true);
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
      }
      dispatchEditableInput(editable, 'insertFromPaste', clipText);
      return true;
    } catch {}
    return false;
  }

  function buildContextMenuItems(context){
    const items = [];
    if (!context) return items;
    if (context.canSelect) {
      items.push({
        action: 'select',
        label: getContextMenuLabel('context.select', '\u062A\u062D\u062F\u064A\u062F'),
        icon: 'fa-solid fa-i-cursor'
      });
    }
    if (context.canCopy) {
      items.push({
        action: 'copy',
        label: getContextMenuLabel('context.copy', '\u0646\u0633\u062E'),
        icon: 'fa-regular fa-copy'
      });
    }
    if (context.canPaste) {
      items.push({
        action: 'paste',
        label: getContextMenuLabel('context.paste', '\u0644\u0635\u0642'),
        icon: 'fa-regular fa-clipboard'
      });
    }
    if (context.canSelectAll) {
      items.push({
        action: 'select-all',
        label: getContextMenuLabel('context.selectAll', '\u062A\u062D\u062F\u064A\u062F\u0020\u0627\u0644\u0643\u0644'),
        icon: 'fa-solid fa-text-width'
      });
    }
    return items;
  }

  function handleContextMenuAction(action){
    const context = contextMenuState.context;
    hideContextMenu();
    if (!context) return;
    if (action === 'select') {
      selectContextTarget(context);
      return;
    }
    if (action === 'copy') {
      void copyContextText(context);
      return;
    }
    if (action === 'paste') {
      void pasteIntoEditable(context);
      return;
    }
    if (action === 'select-all') {
      selectAllContextTarget(context);
    }
  }

  function handleDocumentContextMenu(event){
    if (!event) return;
    const target = getContextMenuTarget(event.target);
    if (!target) return;
    if (target.closest && target.closest('#' + TOUCH_SELECTION_UI_ID)) return;
    if (target.closest && target.closest('#' + CONTEXT_MENU_ID + ',[data-native-context-menu]')) return;
    const context = buildContextSnapshot(target, Number(event.clientX), Number(event.clientY));
    if (shouldAllowNativeTouchSelection(context)) {
      try {
        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
      } catch {}
      hideContextMenu();
      return;
    }
    const items = buildContextMenuItems(context);
    const hasEnabledItem = items.some(function(item){ return !item.disabled; });
    if (!hasEnabledItem) {
      hideContextMenu();
      if (!isTouchTextSelectionUiTarget(target)) {
        try {
          event.preventDefault();
          event.stopPropagation();
          if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
        } catch {}
      }
      return;
    }
    try {
      event.preventDefault();
      event.stopPropagation();
    } catch {}
    openContextMenu(context, items, Number(event.clientX) || 0, Number(event.clientY) || 0);
  }

  function bootContextMenu(){
    if (!CUSTOM_CONTEXT_MENU_ENABLED) return;
    ensureContextMenu();
    ensureTouchSelectionUi();
    document.addEventListener('contextmenu', handleDocumentContextMenu, true);
    document.addEventListener('pointerdown', function(event){
      if (isTouchTextSelectionUiTarget(event.target)) return;
      if (isTouchTextSelectionActive()) {
        const targetEl = getContextMenuTarget(event.target);
        const insideSelectionTarget = !!(targetEl && touchTextSelectionState.target && touchTextSelectionState.target.contains(targetEl));
        if (!insideSelectionTarget) {
          hideTouchTextSelection();
          clearTouchSelectableTarget(true);
        }
      }
      if (isTouchLikePointer(event)) {
        rememberTouchSelectionTarget(event);
        startTouchLongPress(event);
      } else {
        contextMenuState.lastTouchTextPressAt = 0;
        clearTouchSelectableTarget(false);
        clearTouchLongPress();
      }
      if (!contextMenuState.visible) return;
      if (contextMenuState.root && contextMenuState.root.contains(event.target)) return;
      hideContextMenu();
    }, true);
    document.addEventListener('pointermove', function(event){
      updateTouchTextSelectionFromDrag(event);
      updateTouchLongPress(event);
    }, true);
    document.addEventListener('pointerup', function(event){
      stopTouchTextSelectionDrag(Number(event.pointerId));
      clearTouchLongPress(Number(event.pointerId));
    }, true);
    document.addEventListener('pointercancel', function(event){
      stopTouchTextSelectionDrag(Number(event.pointerId));
      clearTouchLongPress(Number(event.pointerId));
    }, true);
    document.addEventListener('click', function(event){
      if (isTouchTextSelectionUiTarget(event.target)) return;
      if (!shouldSuppressTouchSelectionClick(event.target)) return;
      try {
        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
      } catch {}
    }, true);
    document.addEventListener('selectionchange', function(){
      if (isTouchTextSelectionActive()) {
        if (!getCurrentSelectionText()) {
          hideTouchTextSelection({ clearSelection: false });
          clearTouchSelectableTarget(false);
        } else {
          positionTouchTextSelectionUi();
        }
      }
      scheduleTouchSelectionCleanup();
    }, true);
    document.addEventListener('scroll', function(){
      if (contextMenuState.visible) hideContextMenu();
      if (isTouchTextSelectionActive()) positionTouchTextSelectionUi();
    }, true);
    document.addEventListener('keydown', function(event){
      if (!event || event.key !== 'Escape') return;
      if (contextMenuState.visible) hideContextMenu();
      if (isTouchTextSelectionActive()) {
        hideTouchTextSelection();
        clearTouchSelectableTarget(true);
      }
    }, true);
    window.addEventListener('resize', function(){
      hideContextMenu();
      if (isTouchTextSelectionActive()) positionTouchTextSelectionUi();
    });
    window.addEventListener('blur', function(){
      hideContextMenu();
      hideTouchTextSelection();
      contextMenuState.lastTouchTextPressAt = 0;
      try { clearTimeout(contextMenuState.selectionCleanupTimer); } catch {}
      clearTouchLongPress();
      clearTouchSelectableTarget(true);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootContextMenu, { once: true });
  } else {
    bootContextMenu();
  }
})();

// Sidebar toggle
let __SIDEBAR_CLOSE_TIMER__ = null;
let __HAMBURGER_ANIM_TIMER__ = null;
function ensureSidebarBackdrop(){
  try {
    if (document.documentElement && document.documentElement.getAttribute('data-site-locked') === 'true') return null;
  } catch {}
  let backdrop = null;
  try { backdrop = document.getElementById('sidebarBackdrop'); } catch {}
  if (backdrop) return backdrop;
  try {
    backdrop = document.createElement('div');
    backdrop.id = 'sidebarBackdrop';
    backdrop.setAttribute('aria-hidden', 'true');
    backdrop.addEventListener('click', function(){ try { closeSidebarWithAnimation(240); } catch {} });
    (document.body || document.documentElement).appendChild(backdrop);
    return backdrop;
  } catch {
    return null;
  }
}
function setSidebarOpenState(open){
  const isOpen = !!open;
  try { if (document.body) document.body.classList.toggle('sidebar-open', isOpen); } catch {}
  try {
    const trigger = document.getElementById('hamburger');
    if (trigger) {
      const wasOpen = trigger.classList.contains('is-active');
      if (__HAMBURGER_ANIM_TIMER__) {
        clearTimeout(__HAMBURGER_ANIM_TIMER__);
        __HAMBURGER_ANIM_TIMER__ = null;
      }
      trigger.classList.remove('is-opening', 'is-closing');
      trigger.classList.toggle('is-active', isOpen);
      trigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      if (wasOpen !== isOpen) {
        // Force reflow so the keyframe animation always restarts cleanly.
        void trigger.offsetWidth;
        trigger.classList.add(isOpen ? 'is-opening' : 'is-closing');
        __HAMBURGER_ANIM_TIMER__ = setTimeout(() => {
          try { trigger.classList.remove('is-opening', 'is-closing'); } catch {}
          __HAMBURGER_ANIM_TIMER__ = null;
        }, 460);
      }
    }
  } catch {}
  try {
    const el = document.getElementById('sidebar');
    if (el) el.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
  } catch {}
}
function isSiteChromeLocked(){
  try {
    return document.documentElement && document.documentElement.getAttribute('data-site-locked') === 'true';
  } catch {
    return false;
  }
}
function openSidebarWithAnimation(){
  if (isSiteChromeLocked()) {
    try { setSidebarOpenState(false); } catch {}
    return false;
  }
  const el = document.getElementById('sidebar');
  if (!el) { console.warn('\u0627\u0644\u0634\u0631\u064A\u0637\u0020\u0627\u0644\u062C\u0627\u0646\u0628\u064A\u0020\u063A\u064A\u0631\u0020\u0645\u0648\u062C\u0648\u062F\u0020\u0628\u0639\u062F.'); return false; }
  ensureSidebarBackdrop();
  try { if (__SIDEBAR_CLOSE_TIMER__) { clearTimeout(__SIDEBAR_CLOSE_TIMER__); __SIDEBAR_CLOSE_TIMER__ = null; } } catch {}
  try {
    el.classList.remove('closing');
    el.classList.add('opening');
    // Force reflow so opening animation always restarts cleanly.
    void el.offsetWidth;
    el.classList.add('active');
  } catch {}
  setSidebarOpenState(true);
  setTimeout(() => { try { el.classList.remove('opening'); } catch {} }, 380);
  return true;
}
function toggleSidebar(){
  if (isSiteChromeLocked()) {
    try { closeSidebarWithAnimation(0); } catch {}
    return;
  }
  const el = document.getElementById('sidebar');
  if (!el) { console.warn('\u0627\u0644\u0634\u0631\u064A\u0637\u0020\u0627\u0644\u062C\u0627\u0646\u0628\u064A\u0020\u063A\u064A\u0631\u0020\u0645\u0648\u062C\u0648\u062F\u0020\u0628\u0639\u062F.'); return; }
  if (el.classList.contains('active') || el.classList.contains('opening')) {
    closeSidebarWithAnimation(240);
    return;
  }
  openSidebarWithAnimation();
}

function closeSidebarWithAnimation(durationMs){
  const el = document.getElementById('sidebar');
  if (!el) return Promise.resolve(false);
  const ms = Math.max(120, Number(durationMs) || 220);
  if (!el.classList.contains('active') && !el.classList.contains('opening')) {
    try { el.classList.remove('closing'); el.classList.remove('opening'); } catch {}
    setSidebarOpenState(false);
    return Promise.resolve(false);
  }
  try {
    if (__SIDEBAR_CLOSE_TIMER__) {
      clearTimeout(__SIDEBAR_CLOSE_TIMER__);
      __SIDEBAR_CLOSE_TIMER__ = null;
    }
  } catch {}
  try {
    el.classList.remove('opening');
    el.classList.add('closing');
    el.classList.remove('active');
  } catch {}
  setSidebarOpenState(false);
  return new Promise((resolve) => {
    __SIDEBAR_CLOSE_TIMER__ = setTimeout(() => {
      try { el.classList.remove('closing'); } catch {}
      try { __SIDEBAR_CLOSE_TIMER__ = null; } catch {}
      resolve(true);
    }, ms);
  });
}

function closeSidebarIfOpen(){
  try { return closeSidebarWithAnimation(220); } catch {}
  return Promise.resolve(false);
}
try {
  document.addEventListener('keydown', function(e){
    try {
      if (!e || e.key !== 'Escape') return;
      closeSidebarIfOpen();
    } catch {}
  });
} catch {}

function resolveHomeUrl(){
  try { if (window.__HOME_URL__) return String(window.__HOME_URL__); } catch {}
  try {
    const meta = document.querySelector('meta[name="home-url"]');
    if (meta && meta.content) return String(meta.content);
  } catch {}
  try {
    const url = new URL(location.href);
    url.hash = '';
    const params = new URLSearchParams(url.search || '');
    const keep = new URLSearchParams();
    if (params.has('firebase')) keep.set('firebase', params.get('firebase'));
    if (params.has('lang')) keep.set('lang', params.get('lang'));
    url.search = keep.toString();
    const path = url.pathname || '';
    const base = path.endsWith('/') ? path : path.replace(/[^/]*$/, '');
    url.pathname = (base || '/').replace(/\/?$/, '/') + 'index.html';
    return url.toString();
  } catch {}
  return 'index.html';
}

const SKIP_HEADER = !!(typeof window !== 'undefined' && window.__SKIP_HEADER__);
// Build header
const header = document.createElement('header');
header.className = 'top-header';

// Hamburger
const hamburger = document.createElement('div');
hamburger.id = 'hamburger';
hamburger.onclick = toggleSidebar;
hamburger.setAttribute('role', 'button');
hamburger.setAttribute('tabindex', '0');
hamburger.setAttribute('aria-label', 'فتح وإغلاق القائمة');
hamburger.setAttribute('aria-expanded', 'false');
hamburger.addEventListener('keydown', function(event){
  if (!event) return;
  if (event.key !== 'Enter' && event.key !== ' ') return;
  try { event.preventDefault(); } catch {}
  toggleSidebar();
});
for (let i=0;i<3;i++){ hamburger.appendChild(document.createElement('span')); }
header.appendChild(hamburger);

// Logo
function readCachedSiteMediaValue(key){
  try {
    const raw = localStorage.getItem('site:media:v1');
    if (!raw) return '';
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return '';
    const value = parsed[key];
    return typeof value === 'string' ? value.trim() : '';
  } catch {
    return '';
  }
}
const logo = document.createElement('img');
const initialHeaderLogo = readCachedSiteMediaValue('headerLogo') || resolveSiteMediaFallbackUrl('header');
logo.className = 'header-logo';
logo.alt = (function(){
  try {
    const brandCfg = window.__getSiteBrandConfig ? window.__getSiteBrandConfig() : null;
    return String(brandCfg && brandCfg.storeName || '').trim();
  } catch (_) {
    return '';
  }
})();
logo.setAttribute('data-i18n-alt', 'brand.name');
logo.setAttribute('fetchpriority','high');
logo.loading = 'eager';
logo.decoding = 'async';
logo.addEventListener('error', function(){
  try { logo.removeAttribute('src'); } catch {}
  try { logo.removeAttribute('srcset'); } catch {}
  try { logo.hidden = true; } catch {}
  try { logo.style.display = 'none'; } catch {}
  try {
    const parentLink = logo.closest('.header-logo-link');
    if (parentLink) parentLink.style.display = 'none';
  } catch {}
});
if (initialHeaderLogo) {
  logo.src = initialHeaderLogo;
}
(function(){ try { const href = initialHeaderLogo; if (href && document.head && !document.querySelector(`link[rel='preload'][as='image'][href='${href}']`)){ const l = document.createElement('link'); l.rel='preload'; l.as='image'; l.href=href; document.head.appendChild(l); } } catch {} })();
const logoLink = document.createElement('a');
logoLink.href = resolveHomeUrl();
logoLink.style.marginLeft = '0';
logoLink.style.marginRight = 'auto';
logoLink.className = 'header-logo-link';
logoLink.setAttribute('aria-label','\u0627\u0644\u0639\u0648\u062F\u0629\u0020\u0625\u0644\u0649\u0020\u0627\u0644\u0631\u0626\u064A\u0633\u064A\u0629');
logoLink.setAttribute('data-i18n-aria-label', 'brand.home');
logoLink.style.marginLeft = '';
logoLink.style.marginRight = '';
if (!initialHeaderLogo) {
  logo.hidden = true;
  logo.style.display = 'none';
  logoLink.style.display = 'none';
}
logoLink.appendChild(logo);
function navigateLogoHome(event) {
  const hasModifiers = event && (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey);
  if (hasModifiers) return;
  const isMiddle = event && typeof event.button === 'number' && event.button !== 0;
  if (isMiddle) return;
  const href = resolveHomeUrl();
  if (!href) return;
  try { sessionStorage.setItem('nav:fromHome','1'); } catch {}
  if (event && event.type === 'click') {
    try { event.preventDefault(); } catch {}
  }
  const proceed = () => {
    try {
      const current = new URL(location.href);
      const target = new URL(href, location.href);
      const sameBase = current.origin === target.origin &&
        current.pathname === target.pathname &&
        current.search === target.search;
      if (sameBase) {
        try {
          if (typeof window.navigateHome === 'function') {
            window.navigateHome();
            return;
          }
        } catch {}
        if (current.hash) {
          try { history.replaceState({}, '', target.pathname + target.search); } catch {}
        }
        try {
          sessionStorage.removeItem('nav:loader:expected');
          sessionStorage.removeItem('nav:loader:showAt');
        } catch {}
        try { hidePageLoader(); } catch {}
        return;
      }
    } catch {}
    try { showPageLoader(); } catch {}
    try { window.location.assign(href); } catch { window.location.href = href; }
  };
  try {
    const closing = closeSidebarIfOpen();
    if (closing && typeof closing.finally === 'function') {
      closing.finally(proceed);
      return;
    }
  } catch {}
  proceed();
}
logoLink.addEventListener('pointerdown', (e) => {
  try { logoLink.href = resolveHomeUrl(); } catch {}
  navigateLogoHome(e);
}, { passive: true });
logoLink.addEventListener('click', (e) => {
  try { logoLink.href = resolveHomeUrl(); } catch {}
  navigateLogoHome(e);
});

// Balance display with deposit shortcut
if (!document.getElementById('header-balance-style')) {
  try {
    const style = document.createElement('style');
    style.id = 'header-balance-style';
    style.textContent = `
      .header-balance {
        display: inline-flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 2px;
        direction: rtl;
        color: var(--balance-text, #e2e8f0);
        letter-spacing: 0.15px;
        padding: 0;
        margin: 0;
      }
      .header-balance__metrics {
        display: inline-flex;
        align-items: baseline;
        gap: 4px;
        direction: ltr;
      }
      .header-levels-btn {
        display:inline-flex;
        align-items:center;
        justify-content:center;
        width:34px;
        height:34px;
        border-radius:12px;
        border:1px solid rgba(255,255,255,.18);
        background:rgba(255,255,255,.08);
        color:#eef4ff;
        box-shadow:none;
        cursor:pointer;
        transition:transform .16s ease, background .16s ease, border-color .16s ease;
      }
      .header-levels-btn:hover {
        transform:translateY(-1px);
        background:rgba(255,255,255,.14);
        border-color:rgba(255,255,255,.26);
      }
      .header-levels-btn__fallback {
        display:inline-flex;
        align-items:center;
        justify-content:center;
        width:100%;
        height:100%;
      }
      .header-levels-btn--image {
        border:0 !important;
        background:transparent !important;
        border-radius:999px;
        box-shadow:none !important;
        padding:0;
        overflow:hidden;
      }
      .header-levels-btn--image:hover {
        background:transparent !important;
        border-color:transparent !important;
      }
      .header-levels-btn__img {
        width:100%;
        height:100%;
        max-width:100%;
        max-height:100%;
        display:block;
        margin:0;
        flex:0 0 auto;
        border-radius:50%;
        padding:0;
        box-sizing:border-box;
        object-fit:contain;
        object-position:center;
      }
      .header-levels-btn i {
        font-size:14px;
      }
      .header-balance__currency {
        font-size: 12px;
        font-weight: 700;
        color: inherit;
        letter-spacing: 0.3px;
        text-transform: uppercase;
        direction: ltr;
        unicode-bidi: plaintext;
      }
	      .header-balance__value {
	        direction: ltr;
	        font-size: 20px;
	        font-weight: 800;
	        letter-spacing: 0.35px;
	        color: var(--balance-text, #f8fafc);
	        background: transparent;
	        border: none;
	        border-radius: 0;
	        padding: 0;
	        font-feature-settings: 'tnum' 1, 'kern' 1;
	        text-shadow: none;
	        box-shadow: none;
	      }
	      html[data-theme="light"] .header-balance__value,
	      body.light-mode .header-balance__value {
	        color: var(--balance-text-light, #0f172a);
	        background: transparent;
	        border: none;
	        text-shadow: none;
	        box-shadow: none;
	      }
      html[data-theme="light"] .header-balance__currency,
      body.light-mode .header-balance__currency {
        color: inherit;
      }
      html[data-theme="light"] .header-balance,
      body.light-mode .header-balance {
        color: var(--balance-text-light, #0f172a);
      }
	      body.dark-mode .header-balance__value,
	      html[data-theme="dark"] .header-balance__value {
	        color: var(--balance-text-dark, #f8fafc);
	        background: transparent;
	        border: none;
	      }
      body.dark-mode .header-balance__currency,
      html[data-theme="dark"] .header-balance__currency {
        color: inherit;
      }
      html[data-theme="light"] .header-levels-btn,
      body.light-mode .header-levels-btn {
        color: var(--balance-text-light, #0f172a);
        border-color: rgba(15,23,42,.1);
        background: rgba(15,23,42,.04);
      }
      @media (max-width: 600px) {
        .header-balance__metrics {
          gap: 3px;
        }
        .header-levels-btn {
          width:30px;
          height:30px;
          border-radius:10px;
        }
        .header-balance__currency {
          font-size: 10px;
        }
        .header-balance__value {
          font-size: 17px;
          letter-spacing: 0.35px;
        }
      }
`;
    (document.head || document.documentElement).appendChild(style);
  } catch {}
}
const balanceSpan = document.createElement('span');
balanceSpan.id = 'balanceHeader';
balanceSpan.className = 'header-balance';
try { balanceSpan.setAttribute('data-i18n-ignore', 'true'); } catch {}
balanceSpan.style.marginRight = '0px';
balanceSpan.style.flex = '0 0 auto';
balanceSpan.style.padding = '0';
balanceSpan.style.minWidth = '0';
balanceSpan.innerHTML = `
  <span class="header-balance__metrics">
    <span class="header-balance__currency" id="headerBalanceCurrency">—</span>
    <span class="header-balance__value" id="headerBalanceText">…</span>
  </span>
`;

const headerLevelsBtn = document.createElement('button');
headerLevelsBtn.type = 'button';
headerLevelsBtn.className = 'header-levels-btn';
headerLevelsBtn.id = 'headerLevelsBtn';
headerLevelsBtn.setAttribute('aria-label', 'المستويات');
headerLevelsBtn.setAttribute('title', 'عرض المستويات');
headerLevelsBtn.innerHTML = '<span class="header-levels-btn__fallback"><i class="fa-solid fa-medal" aria-hidden="true"></i></span>';
headerLevelsBtn.hidden = true;
headerLevelsBtn.disabled = true;
headerLevelsBtn.setAttribute('aria-hidden', 'true');


const leftContainer = document.createElement('div');
leftContainer.className = 'header-left';
leftContainer.style.display = 'flex';
leftContainer.style.alignItems = 'center';
leftContainer.style.gap = '10px';
leftContainer.appendChild(hamburger);
leftContainer.appendChild(balanceSpan);
leftContainer.appendChild(headerLevelsBtn);

header.appendChild(leftContainer);
header.appendChild(logoLink);

// Balance helpers
let unsubscribeBalance = null;
let bannedSessionHandled = false;
const BAL_KEY = (uid) => `balance:cache:${uid}`;
const LAST_UID_KEY = 'auth:lastUid';
const LAST_ACCOUNT_NO_KEY = 'auth:lastAccountNo';
const PROFILE_CACHE_PREFIX = 'auth:profile:cache:';
const LAST_LOGGED_KEY = 'auth:lastLoggedIn';
let __HEADER_LEVEL_PROFILE_CACHE = null;
function normalizeAccountNoValue(value){
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.trunc(n);
}
function getProfileCacheKey(uid){
  const keyUid = String(uid || '').trim();
  if (!keyUid) return '';
  return PROFILE_CACHE_PREFIX + keyUid;
}
function readCachedProfile(uid){
  const key = getProfileCacheKey(uid);
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return (parsed && typeof parsed === 'object') ? parsed : null;
  } catch {
    return null;
  }
}
function writeCachedProfile(uid, profile){
  const key = getProfileCacheKey(uid);
  if (!key) return;
  try {
    const safe = {
      displayName: String(profile?.displayName || profile?.name || profile?.username || '').trim(),
      username: String(profile?.username || '').trim(),
      email: String(profile?.email || '').trim(),
      photoURL: String(profile?.photoURL || profile?.photoUrl || profile?.avatar || '').trim(),
      level: String(profile?.level || '').trim(),
      levelId: profile?.levelId ?? profile?.level_id ?? null,
      levelNo: profile?.levelNo ?? profile?.level_no ?? null
    };
    localStorage.setItem(key, JSON.stringify(safe));
  } catch {}
}
function removeCachedProfile(uid){
  const key = getProfileCacheKey(uid);
  if (!key) return;
  try { localStorage.removeItem(key); } catch {}
}
function resolveSidebarCachedProfile(user){
  let uid = '';
  try { uid = String(user && user.uid || '').trim(); } catch {}
  if (!uid) {
    try {
      const payload = readPostLoginPayload && readPostLoginPayload();
      uid = String(payload && payload.uid || '').trim();
    } catch {}
  }
  if (!uid) {
    try { uid = String(localStorage.getItem(LAST_UID_KEY) || '').trim(); } catch {}
  }
  if (!uid) return null;
  return readCachedProfile(uid);
}
function headerNormalizeLevelId(value){
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.trunc(n);
}
function headerNormalizeLevelOrder(value){
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.trunc(n);
}
function headerNormalizeLevelKey(value){
  return String(value || '').trim().toLowerCase();
}
function headerReadResolvedSiteState(){
  try {
    return typeof window.__getResolvedSiteStateData === 'function'
      ? window.__getResolvedSiteStateData()
      : window.__SITE_STATE_DATA__;
  } catch {
    return null;
  }
}
function headerNormalizeLevelEntry(rawKey, rawEntry, fallbackOrder){
  const src = rawEntry && typeof rawEntry === 'object' ? rawEntry : {};
  const levelId = headerNormalizeLevelId(src.id != null ? src.id : (src.levelId != null ? src.levelId : src.level_id));
  if (levelId == null) return null;
  const key = headerNormalizeLevelKey(rawKey || src.key || src.levelKey || src.level || src.code || ('level_' + String(levelId)));
  const order = headerNormalizeLevelOrder(src.order != null ? src.order : (src.rank != null ? src.rank : fallbackOrder)) || fallbackOrder;
  return {
    id: levelId,
    key,
    order,
    label: String(src.label || src.name || src.title || key).trim() || key,
    imageUrl: String(src.imageUrl || src.image || src.badgeImage || src.badge || src.icon || '').trim()
  };
}
function headerGetLevelEntries(){
  const safeState = headerReadResolvedSiteState();
  const levelsState = safeState && typeof safeState === 'object' && safeState.levels && typeof safeState.levels === 'object'
    ? safeState.levels
    : {};
  const rawItems = Array.isArray(levelsState.items)
    ? levelsState.items
    : (Array.isArray(levelsState.levels) ? levelsState.levels : (Array.isArray(levelsState.entries) ? levelsState.entries : []));
  const out = [];
  const seen = new Set();
  rawItems.forEach((rawEntry, index) => {
    const entry = headerNormalizeLevelEntry((rawEntry && (rawEntry.key || rawEntry.levelKey || rawEntry.level || rawEntry.code)) || '', rawEntry, index + 1);
    if (!entry || seen.has(entry.id)) return;
    seen.add(entry.id);
    out.push(entry);
  });
  return out.sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    if (a.id !== b.id) return a.id - b.id;
    return String(a.label || '').localeCompare(String(b.label || ''), 'ar', { sensitivity: 'base', numeric: true });
  });
}
function headerResolveCurrentLevelEntry(profile){
  const entries = headerGetLevelEntries();
  if (!entries.length) return null;
  const safeProfile = profile && typeof profile === 'object' ? profile : {};
  const levelId = headerNormalizeLevelId(safeProfile.levelId != null ? safeProfile.levelId : safeProfile.level_id);
  const levelOrder = headerNormalizeLevelOrder(safeProfile.levelNo != null ? safeProfile.levelNo : safeProfile.level_no);
  const levelKey = headerNormalizeLevelKey(safeProfile.level || '');
  if (levelId == null && levelOrder == null && !levelKey) return null;
  let currentEntry = null;
  if (levelId != null) currentEntry = entries.find((entry) => entry.id === levelId) || null;
  if (!currentEntry && levelKey) currentEntry = entries.find((entry) => entry.key === levelKey) || null;
  if (!currentEntry && levelOrder != null) currentEntry = entries.find((entry) => entry.order === levelOrder) || null;
  return currentEntry || null;
}
function headerGetSelectedCurrencyCode(){
  try {
    if (typeof window.getSelectedCurrencyCode === 'function') {
      const code = String(window.getSelectedCurrencyCode() || '').trim().toUpperCase();
      if (code) return code;
    }
  } catch {}
  try {
    const stored = String(localStorage.getItem('currency:selected') || '').trim().toUpperCase();
    if (stored) return stored;
  } catch {}
  return '';
}
function headerGetSelectedCurrencyText(rawCode){
  const code = String(rawCode || headerGetSelectedCurrencyCode() || '').trim().toUpperCase();
  if (!code) return '';
  let rates = null;
  try { rates = window.__CURRENCIES__ || null; } catch {}
  const rateEntry = rates && typeof rates === 'object' ? rates[code] : null;
  const symbol = String(rateEntry && (rateEntry.symbol || rateEntry.displaySymbol || rateEntry.sign) || '').trim();
  if (symbol) return symbol;
  const fallbackMap = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    JOD: 'د.أ',
    SAR: 'ر.س',
    AED: 'د.إ',
    KWD: 'د.ك',
    QAR: 'ر.ق',
    BHD: 'د.ب',
    OMR: 'ر.ع',
    EGP: 'EGP'
  };
  return fallbackMap[code] || String(rateEntry && (rateEntry.code || code) || code).trim().toUpperCase();
}
function headerNormalizeBalanceValue(value){
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}
function headerGetBaseBalanceValue(){
  try {
    if (typeof window.__BAL_BASE__ !== 'undefined') {
      return headerNormalizeBalanceValue(window.__BAL_BASE__);
    }
  } catch {}
  return 0;
}
function formatHeaderBalanceText(value){
  const safeValue = headerNormalizeBalanceValue(value);
  try {
    if (typeof window.formatCurrencyFromJOD === 'function') {
      const formatted = String(window.formatCurrencyFromJOD(safeValue) || '').trim();
      if (formatted) return formatted;
    }
  } catch {}
  const currencyText = headerGetSelectedCurrencyText();
  return safeValue.toFixed(3) + (currencyText ? (' ' + currencyText) : '');
}
function splitHeaderBalanceParts(text){
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return null;
  const prefixMatch = normalized.match(/^(\S+)\s+(.+)$/);
  if (prefixMatch && !/[0-9]/.test(prefixMatch[1]) && /[0-9]/.test(prefixMatch[2])) {
    return { currency: prefixMatch[1].trim(), value: prefixMatch[2].trim() };
  }
  const suffixMatch = normalized.match(/^(.+)\s+(\S+)$/);
  if (suffixMatch && /[0-9]/.test(suffixMatch[1]) && !/[0-9]/.test(suffixMatch[2])) {
    return { value: suffixMatch[1].trim(), currency: suffixMatch[2].trim() };
  }
  return null;
}
function setHeaderLevelsVisibility(visible){
  const show = !!visible;
  try { headerLevelsBtn.hidden = !show; } catch {}
  try { headerLevelsBtn.disabled = !show; } catch {}
  try { headerLevelsBtn.setAttribute('aria-hidden', show ? 'false' : 'true'); } catch {}
}
function renderHeaderLevelBadge(profile){
  if (profile && typeof profile === 'object') {
    __HEADER_LEVEL_PROFILE_CACHE = profile;
  } else if (profile === null) {
    __HEADER_LEVEL_PROFILE_CACHE = null;
  }
  const entry = headerResolveCurrentLevelEntry(__HEADER_LEVEL_PROFILE_CACHE);
  const imageUrl = String(entry && entry.imageUrl || '').trim();
  headerLevelsBtn.classList.toggle('header-levels-btn--image', !!imageUrl);
  headerLevelsBtn.innerHTML = '';
  if (imageUrl) {
    setHeaderLevelsVisibility(true);
    const img = document.createElement('img');
    img.className = 'header-levels-btn__img';
    img.src = imageUrl;
    img.alt = '';
    img.loading = 'lazy';
    img.setAttribute('aria-hidden', 'true');
    img.addEventListener('error', () => { renderHeaderLevelBadge(null); }, { once: true });
    headerLevelsBtn.appendChild(img);
    headerLevelsBtn.setAttribute('title', 'عرض المستويات - ' + String(entry && entry.label || '').trim());
    return;
  }
  setHeaderLevelsVisibility(false);
  try { headerLevelsBtn.removeAttribute('title'); } catch {}
}
function setHeaderBalance(text){
  const valueEl = document.getElementById('headerBalanceText') || balanceSpan.querySelector('#headerBalanceText');
  const currencyEl = document.getElementById('headerBalanceCurrency') || balanceSpan.querySelector('#headerBalanceCurrency');
  if (!valueEl) return;
  if (typeof text !== 'string') {
    const numeric = Number(text);
    if (Number.isFinite(numeric)) {
      text = formatHeaderBalanceText(numeric);
    } else {
      valueEl.textContent = text == null ? '—' : String(text);
      if (currencyEl) currencyEl.textContent = '—';
      return;
    }
  }
  const trimmed = text.trim();
  if (!trimmed) {
    valueEl.textContent = '—';
    if (currencyEl) currencyEl.textContent = '—';
    return;
  }
  const hasDigits = /[0-9]/.test(trimmed);
  if (!hasDigits) {
    valueEl.textContent = trimmed;
    if (currencyEl) currencyEl.textContent = '—';
    return;
  }
  const parts = splitHeaderBalanceParts(trimmed);
  if (parts) {
    valueEl.textContent = parts.value || trimmed;
    if (currencyEl) currencyEl.textContent = parts.currency || headerGetSelectedCurrencyText() || '—';
    return;
  }
  valueEl.textContent = trimmed;
  if (currencyEl) currencyEl.textContent = headerGetSelectedCurrencyText() || '—';
}
try {
  window.__setHeaderBalanceDisplay = setHeaderBalance;
  window.__formatHeaderBalanceDisplay = formatHeaderBalanceText;
} catch {}
function setHeaderBalanceAmount(value){
  setHeaderBalance(formatHeaderBalanceText(headerNormalizeBalanceValue(value)));
}
function readCachedBalance(uid){ try { const s = localStorage.getItem(BAL_KEY(uid)); if (s == null) return null; const n = Number(s); return Number.isFinite(n) ? n : null; } catch { return null; } }
function writeCachedBalance(uid, val){ try { localStorage.setItem(BAL_KEY(uid), String(val)); } catch {} }
function broadcastBalance(value){
  const safeValue = headerNormalizeBalanceValue(value);
  try { window.__BALANCE__ = safeValue; window.__BAL_BASE__ = safeValue; } catch {}
  try {
    const formatted = formatHeaderBalanceText(safeValue);
    window.dispatchEvent(new CustomEvent('balance:change', { detail: { value: safeValue, formatted } }));
  } catch {}
}
function seedHeaderFromCache(){
  try {
    const logged = localStorage.getItem(LAST_LOGGED_KEY) === '1';
    const uid = localStorage.getItem(LAST_UID_KEY);
    if (logged && uid){
      const cachedProfile = readCachedProfile(uid);
      if (cachedProfile) renderHeaderLevelBadge(cachedProfile);
      const cached = readCachedBalance(uid);
      if (cached != null){
        try { window.__BAL_BASE__ = cached; } catch {}
        setHeaderBalanceAmount(cached);
        broadcastBalance(cached);
      }
    } else {
      renderHeaderLevelBadge(null);
      setHeaderBalanceAmount(0);
      broadcastBalance(0);
    }
  } catch {}
}
seedHeaderFromCache();
try { window.addEventListener('site-state-updated', function(){ renderHeaderLevelBadge(); }); } catch {}
try { window.addEventListener('site-state-updated', function(){ syncReviewsSidebarVisibility(); }); } catch {}
try { window.addEventListener('site-state-updated', function(){ syncAgentsSidebarVisibility(); }); } catch {}

// Apply auth state to sidebar (fallback to in-memory nodes if DOM not yet attached)
function resolveSidebarNode(id, fallback){
  try { return document.getElementById(id) || fallback || null; } catch { return fallback || null; }
}
function setSidebarNodeVisibility(node, visible, displayValue){
  if (!node) return;
  try { node.style.display = visible ? (displayValue == null ? 'flex' : String(displayValue)) : 'none'; } catch {}
  try {
    if (visible) node.removeAttribute('hidden');
    else node.setAttribute('hidden', 'hidden');
  } catch {}
}
const API_ACCESS_CACHE_PREFIX = 'api:access:enabled:';
function parseApiAccessBool(value){
  if (value == null) return null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return null;
  if (['1','true','on','yes','enabled','active'].includes(raw)) return true;
  if (['0','false','off','no','disabled','inactive'].includes(raw)) return false;
  return null;
}
function resolveApiAccessEnabled(raw){
  const source = (raw && typeof raw === 'object') ? raw : {};
  const keys = ['apiAccessEnabled','api_access_enabled','apiEnabled','api_enabled','allowApi','allow_api','apiAllowed','api_allowed'];
  for (let i = 0; i < keys.length; i += 1){
    const key = keys[i];
    if (!Object.prototype.hasOwnProperty.call(source, key)) continue;
    const resolved = parseApiAccessBool(source[key]);
    if (resolved != null) return resolved;
  }
  return false;
}
function readApiAccessCache(uid){
  const keyUid = String(uid || '').trim();
  if (!keyUid) return null;
  try {
    const raw = localStorage.getItem(API_ACCESS_CACHE_PREFIX + keyUid);
    const resolved = parseApiAccessBool(raw);
    return resolved == null ? null : resolved;
  } catch { return null; }
}
function writeApiAccessCache(uid, enabled){
  const keyUid = String(uid || '').trim();
  if (!keyUid) return;
  try { localStorage.setItem(API_ACCESS_CACHE_PREFIX + keyUid, enabled ? '1' : '0'); } catch {}
}
function setApiSidebarVisibility(enabled){
  const apiBtn = resolveSidebarNode('apiBtn', typeof apiLi !== 'undefined' ? apiLi : null);
  if (!apiBtn) return;
  setSidebarNodeVisibility(apiBtn, enabled === true, 'flex');
}
function headerNormalizeSiteCommentsState(raw){
  const src = raw && typeof raw === 'object' ? raw : {};
  const hasExplicitEnabled =
    Object.prototype.hasOwnProperty.call(src, 'enabled') ||
    Object.prototype.hasOwnProperty.call(src, 'on') ||
    Object.prototype.hasOwnProperty.call(src, 'active');
  const enabled = !!(
    src.enabled === true ||
    src.on === true ||
    src.active === true ||
    String(src.enabled || src.on || src.active || '').toLowerCase() === 'true'
  );
  return {
    enabled: hasExplicitEnabled ? enabled : true,
    payload: String(src.payload || '').trim(),
    count: Number(
      src.count ??
      src.reviewsCount ??
      src.reviews_count ??
      src.itemsCount ??
      src.items_count ??
      0
    ) || 0,
    migratedAt: String(src.migratedAt || src.migrated_at || '').trim()
  };
}
function readHeaderSiteCommentsState(){
  const siteState = headerReadResolvedSiteState();
  const raw = siteState && typeof siteState === 'object'
    ? (siteState.comments || siteState.reviews || null)
    : null;
  return headerNormalizeSiteCommentsState(raw || {});
}
function headerNormalizeSiteAgentsState(raw){
  const src = raw && typeof raw === 'object' ? raw : {};
  var hasExplicitEnabled =
    Object.prototype.hasOwnProperty.call(src, 'enabled') ||
    Object.prototype.hasOwnProperty.call(src, 'on') ||
    Object.prototype.hasOwnProperty.call(src, 'active');
  var sourceItems = Array.isArray(src.items)
    ? src.items
    : (Array.isArray(src.agents) ? src.agents : (Array.isArray(src.rows) ? src.rows : []));
  var items = sourceItems.map(function(entry, index){
    var item = entry && typeof entry === 'object' ? entry : {};
    var name = String(item.name || item.agentName || item.agent_name || item.title || '').trim();
    if (!name) return null;
    return {
      id: String(item.id || item.key || item.agentId || item.agent_id || ('agent-' + String(index + 1))).trim(),
      name: name,
      description: String(item.description || item.desc || item.summary || item.note || item.text || '').trim(),
      address: String(item.address || item.location || item.place || item.city || '').trim(),
      phone: String(item.phone || item.number || item.mobile || item.tel || '').trim(),
      whatsapp: String(item.whatsapp || item.whatsApp || item.whatsappNumber || item.whatsapp_number || item.whatsappUrl || item.whatsapp_url || item.wa || '').trim(),
      order: Number(item.order || item.rank || item.position || (index + 1)) || (index + 1)
    };
  }).filter(Boolean).sort(function(a, b){
    if ((a.order || 0) !== (b.order || 0)) return (a.order || 0) - (b.order || 0);
    return String(a.name || '').localeCompare(String(b.name || ''), 'ar', { sensitivity: 'base', numeric: true });
  });
  return {
    enabled: hasExplicitEnabled
      ? !!(
        src.enabled === true ||
        src.on === true ||
        src.active === true ||
        String(src.enabled || src.on || src.active || '').toLowerCase() === 'true'
      )
      : true,
    updatedAt: String(src.updatedAt || src.updated_at || '').trim(),
    items: items
  };
}
function readHeaderSiteAgentsState(){
  const siteState = headerReadResolvedSiteState();
  const raw = siteState && typeof siteState === 'object'
    ? (siteState.agents || null)
    : null;
  return headerNormalizeSiteAgentsState(raw || {});
}
function setReviewsSidebarVisibility(enabled){
  const reviewsBtn = resolveSidebarNode('reviewsBtn', typeof reviewsLi !== 'undefined' ? reviewsLi : null);
  if (!reviewsBtn) return;
  reviewsBtn.style.display = enabled ? 'flex' : 'none';
}
function syncReviewsSidebarVisibility(){
  setReviewsSidebarVisibility(readHeaderSiteCommentsState().enabled !== false);
}
function setAgentsSidebarVisibility(enabled){
  const agentsBtn = resolveSidebarNode('agentsBtn', typeof agentsLi !== 'undefined' ? agentsLi : null);
  if (!agentsBtn) return;
  agentsBtn.style.display = enabled ? 'flex' : 'none';
}
function syncAgentsSidebarVisibility(){
  var agentsState = readHeaderSiteAgentsState();
  setAgentsSidebarVisibility(agentsState.enabled === true);
}
try {
  window.__isSiteCommentsEnabled = function(){
    return readHeaderSiteCommentsState().enabled !== false;
  };
} catch {}
try {
  window.__isSiteAgentsEnabled = function(){
    var agentsState = readHeaderSiteAgentsState();
    return agentsState.enabled === true;
  };
} catch {}
function headerNormalizeSiteBrandState(raw){
  var src = (raw && typeof raw === 'object') ? raw : {};
  var parseBoolLike = function(value, fallback){
    if (value == null || value === '') return !!fallback;
    if (value === true || value === false) return value;
    var text = String(value).trim().toLowerCase();
    if (!text) return !!fallback;
    if (['1', 'true', 'yes', 'on', 'enabled', 'active'].includes(text)) return true;
    if (['0', 'false', 'no', 'off', 'disabled', 'inactive'].includes(text)) return false;
    return !!fallback;
  };
  var normalizeWalletTreeEntry = function(entryRaw, fallbackTitle){
    var entry = (entryRaw && typeof entryRaw === 'object') ? entryRaw : {};
    return {
      enabled: parseBoolLike(
        entry.enabled ??
        entry.showInTree ??
        entry.show_in_tree ??
        entry.visible ??
        entry.active,
        false
      ),
      title: String(
        entry.title ??
        entry.name ??
        entry.label ??
        entry.text ??
        fallbackTitle
      ).trim().slice(0, 120) || fallbackTitle,
      imageUrl: String(
        entry.imageUrl ??
        entry.image_url ??
        entry.image ??
        entry.iconUrl ??
        entry.icon_url ??
        entry.icon ??
        ''
      ).trim(),
      hideFromSidebar: parseBoolLike(
        entry.hideFromSidebar ??
        entry.hide_from_sidebar ??
        entry.sidebarHidden ??
        entry.sidebar_hidden ??
        entry.hideSidebar ??
        entry.hide_sidebar,
        false
      )
    };
  };
  return {
    depositTree: normalizeWalletTreeEntry(
      src.depositTree ??
      src.deposit_tree ??
      src.depositItem ??
      src.deposit_item ??
      src.depositCategory ??
      src.deposit_category,
      'الإيداع'
    ),
    withdrawTree: normalizeWalletTreeEntry(
      src.withdrawTree ??
      src.withdraw_tree ??
      src.withdrawItem ??
      src.withdraw_item ??
      src.withdrawCategory ??
      src.withdraw_category,
      'سحب الرصيد'
    )
  };
}
function readHeaderSiteBrandState(){
  try {
    return headerNormalizeSiteBrandState(Object.assign(
      {},
      (window.__getSiteBrandConfig ? window.__getSiteBrandConfig() : {}),
      (window.__SITE_BRAND__ || {})
    ));
  } catch (_) {
    return headerNormalizeSiteBrandState({});
  }
}
function setSidebarNavLabel(node, title, fallbackI18nKey, fallbackText){
  if (!node) return;
  var anchor = null;
  try { anchor = node.querySelector('a'); } catch (_) { anchor = null; }
  if (!anchor) return;
  var nextText = String(title || '').trim() || String(fallbackText || '').trim();
  if (!nextText) return;
  try { anchor.textContent = nextText; } catch (_) {}
  if (String(nextText).trim() === String(fallbackText || '').trim()) {
    try { anchor.setAttribute('data-i18n', String(fallbackI18nKey || '').trim()); } catch (_) {}
    try { anchor.removeAttribute('data-i18n-ignore'); } catch (_) {}
  } else {
    try { anchor.removeAttribute('data-i18n'); } catch (_) {}
    try { anchor.setAttribute('data-i18n-ignore', 'true'); } catch (_) {}
  }
}
function hasSidebarUserIdentity(user){
  try {
    if (!user || typeof user !== 'object') return false;
    if (String(user.uid || '').trim()) return true;
    if (String(user.email || '').trim()) return true;
    if (String(user.phoneNumber || user.phone || '').trim()) return true;
    if (String(user.sessionKey || user.session_key || '').trim()) return true;
    if (normalizeAccountNoValue(user.accountNo ?? user.account_no ?? user.rank)) return true;
  } catch {}
  return false;
}
function readSidebarSessionInfo(){
  try {
    var raw = localStorage.getItem('sessionKeyInfo');
    if (!raw) return null;
    var parsed = JSON.parse(raw);
    return (parsed && typeof parsed === 'object') ? parsed : null;
  } catch {}
  return null;
}
function resolveEffectiveSidebarUser(user){
  if (hasSidebarUserIdentity(user)) return user;
  try {
    if (window.__LOGOUT_IN_PROGRESS__) return null;
  } catch {}
  try {
    if (hasSidebarUserIdentity(window.__AUTH_LAST_USER__)) return window.__AUTH_LAST_USER__;
  } catch {}
  try {
    var currentUser = (typeof firebase !== 'undefined' && firebase.auth) ? firebase.auth().currentUser : null;
    if (hasSidebarUserIdentity(currentUser)) return currentUser;
  } catch {}
  try {
    var payload = readPostLoginPayload && readPostLoginPayload();
    var fallbackUser = buildFallbackUserFromPayload && buildFallbackUserFromPayload(payload);
    if (hasSidebarUserIdentity(fallbackUser)) return fallbackUser;
    if (hasSidebarUserIdentity(payload)) return payload;
  } catch {}
  try {
    var sessionInfo = readSidebarSessionInfo();
    if (sessionInfo && (String(sessionInfo.uid || '').trim() || String(sessionInfo.sessionKey || '').trim())) {
      return sessionInfo;
    }
  } catch {}
  try {
    var cachedUid = String(localStorage.getItem(LAST_UID_KEY) || '').trim();
    if (cachedUid) {
      return {
        uid: cachedUid,
        accountNo: String(localStorage.getItem(LAST_ACCOUNT_NO_KEY) || '').trim()
      };
    }
  } catch {}
  return null;
}
function syncWalletTreeSidebarUi(user){
  var brand = readHeaderSiteBrandState();
  var depositBtn = resolveSidebarNode('depositBtn', typeof depositLi !== 'undefined' ? depositLi : null);
  var withdrawBtn = resolveSidebarNode('withdrawBtn', typeof withdrawLi !== 'undefined' ? withdrawLi : null);
  setSidebarNavLabel(depositBtn, brand.depositTree && brand.depositTree.title, 'nav.deposit', 'الإيداع');
  setSidebarNavLabel(withdrawBtn, brand.withdrawTree && brand.withdrawTree.title, 'nav.withdraw', 'سحب الرصيد');
  var effectiveUser = resolveEffectiveSidebarUser(user);
  var isLoggedIn = isSidebarLoggedIn(effectiveUser);
  var showDepositBtn = !!(isLoggedIn && !(brand.depositTree && brand.depositTree.hideFromSidebar));
  var showWithdrawBtn = !!(isLoggedIn && !(brand.withdrawTree && brand.withdrawTree.hideFromSidebar));
  setSidebarNodeVisibility(depositBtn, showDepositBtn, 'flex');
  setSidebarNodeVisibility(withdrawBtn, showWithdrawBtn, 'flex');
  try {
    var depositDockBtn = document.querySelector('.mobile-dock .dock-item[data-key="deposit"]');
    setSidebarNodeVisibility(depositDockBtn, showDepositBtn, '');
  } catch (_) {}
}
function applyAuthUi(user){
  var effectiveUser = resolveEffectiveSidebarUser(user);
  var logged = isSidebarLoggedIn(effectiveUser);
  try { window.__AUTH_LAST_USER__ = logged ? (effectiveUser || user || null) : null; } catch {}
  var brand = readHeaderSiteBrandState();
  var showDepositBtn = !(brand.depositTree && brand.depositTree.hideFromSidebar);
  var showWithdrawBtn = !(brand.withdrawTree && brand.withdrawTree.hideFromSidebar);
  const loginBtn = resolveSidebarNode('loginSidebarBtn', typeof loginLi !== 'undefined' ? loginLi : null);
  const depositBtn = resolveSidebarNode('depositBtn', typeof depositLi !== 'undefined' ? depositLi : null);
  const paymentsBtn = resolveSidebarNode('paymentsBtn', typeof paymentsLi !== 'undefined' ? paymentsLi : null);
  const walletBtn = resolveSidebarNode('walletBtn', typeof walletLi !== 'undefined' ? walletLi : null);
  const transferBtn = resolveSidebarNode('transferBtn', typeof transferLi !== 'undefined' ? transferLi : null);
  const withdrawBtn = resolveSidebarNode('withdrawBtn', typeof withdrawLi !== 'undefined' ? withdrawLi : null);
  const securityBtn = resolveSidebarNode('securityBtn', typeof securityLi !== 'undefined' ? securityLi : null);
  const telegramBtn = resolveSidebarNode('telegramBtn', typeof telegramLi !== 'undefined' ? telegramLi : null);
  var depositDockBtn = null;
  try { depositDockBtn = document.querySelector('.mobile-dock .dock-item[data-key="deposit"]'); } catch (_) { depositDockBtn = null; }

  if (logged) {
    var profileUser = effectiveUser || user || null;
    try { localStorage.setItem(LAST_LOGGED_KEY, '1'); } catch {}
    try { if (profileUser && profileUser.uid) localStorage.setItem(LAST_UID_KEY, profileUser.uid); } catch {}
    try { if (profileUser && profileUser.uid) writeCachedProfile(profileUser.uid, profileUser); } catch {}
    try {
      const accountNo = normalizeAccountNoValue(profileUser && (profileUser.accountNo ?? profileUser.account_no ?? profileUser.rank));
      if (accountNo) localStorage.setItem(LAST_ACCOUNT_NO_KEY, String(accountNo));
    } catch {}
    setSidebarNodeVisibility(loginBtn, false, 'flex');
    setSidebarNodeVisibility(depositBtn, showDepositBtn, 'flex');
    setSidebarNodeVisibility(paymentsBtn, true, 'flex');
    setSidebarNodeVisibility(walletBtn, true, 'flex');
    setSidebarNodeVisibility(transferBtn, true, 'flex');
    setSidebarNodeVisibility(withdrawBtn, showWithdrawBtn, 'flex');
    setSidebarNodeVisibility(securityBtn, true, 'flex');
    setSidebarNodeVisibility(telegramBtn, true, 'flex');
    setSidebarNodeVisibility(depositDockBtn, showDepositBtn, '');
    const apiEnabled = profileUser && profileUser.uid ? readApiAccessCache(profileUser.uid) : null;
    try { setApiSidebarVisibility(apiEnabled === true); } catch {}
  } else {
    try { localStorage.setItem(LAST_LOGGED_KEY, '0'); } catch {}
    try { localStorage.removeItem(LAST_UID_KEY); } catch {}
    try { localStorage.removeItem(LAST_ACCOUNT_NO_KEY); } catch {}
    setSidebarNodeVisibility(loginBtn, true, 'flex');
    setSidebarNodeVisibility(depositBtn, false, 'flex');
    setSidebarNodeVisibility(paymentsBtn, false, 'flex');
    setSidebarNodeVisibility(walletBtn, false, 'flex');
    setSidebarNodeVisibility(transferBtn, false, 'flex');
    setSidebarNodeVisibility(withdrawBtn, false, 'flex');
    setSidebarNodeVisibility(securityBtn, false, 'flex');
    setSidebarNodeVisibility(telegramBtn, false, 'flex');
    setSidebarNodeVisibility(depositDockBtn, false, '');
    try { setApiSidebarVisibility(false); } catch {}
  }
  try { applySidebarIdentity(logged ? (effectiveUser || user || null) : null); } catch {}
  try { setSidebarQuickAuthIcon(logged ? (effectiveUser || user || null) : null); } catch {}
  try { syncWalletTreeSidebarUi(logged ? (effectiveUser || user || null) : null); } catch {}
}
try { window.__applyAuthUi = applyAuthUi; } catch {}

function clearAuthClientState(){
  let uid = "";
  try { uid = localStorage.getItem(LAST_UID_KEY) || ""; } catch {}
  try {
    const cached = JSON.parse(localStorage.getItem('sessionKeyInfo') || 'null');
    if (cached && typeof cached === 'object' && cached.uid) uid = String(cached.uid || '');
  } catch {}
  try { localStorage.removeItem('sessionKeyInfo'); } catch {}
  try { localStorage.removeItem('postLoginPayload'); } catch {}
  try { localStorage.removeItem(LAST_LOGGED_KEY); } catch {}
  try { localStorage.removeItem(LAST_UID_KEY); } catch {}
  try { localStorage.removeItem(LAST_ACCOUNT_NO_KEY); } catch {}
  try { localStorage.removeItem('auth:lastLoggedIn'); } catch {}
  try { localStorage.removeItem('auth:lastUid'); } catch {}
  try { localStorage.removeItem('auth:lastAccountNo'); } catch {}
  if (uid) { try { removeCachedProfile(uid); } catch {} }
  if (uid) { try { localStorage.removeItem(BAL_KEY(uid)); } catch {} }
  try {
    if (typeof window.name === 'string' && window.name.startsWith('__SITE_AUTH__:')) window.name = '';
  } catch {}
  try { __AUTH_RESTORE_PROMISE__ = null; } catch {}
  try { __AUTH_RESTORE_ATTEMPTED__ = true; } catch {}
  try { window.__POST_LOGIN_PAYLOAD__ = null; } catch {}
  try { window.__AUTH_LAST_USER__ = null; } catch {}
  try { window.__AUTH_RESTORE_PROMISE__ = null; } catch {}
  try { window.__AUTH_RESTORE_ATTEMPTED__ = true; } catch {}
}

function hideBannedOverlay(){
  try {
    const overlay = document.getElementById('ban-block-overlay');
    if (overlay) {
      try {
        (Array.isArray(overlay.__banSupportRefreshTimers) ? overlay.__banSupportRefreshTimers : []).forEach(function(timerId){
          try { clearTimeout(timerId); } catch {}
        });
      } catch {}
      try {
        (Array.isArray(overlay.__banSupportObservers) ? overlay.__banSupportObservers : []).forEach(function(observer){
          try { observer.disconnect(); } catch {}
        });
      } catch {}
      try {
        if (overlay.__banSupportStateListener) {
          window.removeEventListener('site-state-updated', overlay.__banSupportStateListener);
        }
      } catch {}
    }
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
  } catch {}
}

function ensureBannedOverlaySupportStyle(){
  try {
    if (document.getElementById('ban-block-overlay-support-style')) return;
    const style = document.createElement('style');
    style.id = 'ban-block-overlay-support-style';
    style.textContent = `
      #ban-block-overlay .ban-support-note{
        margin:16px 0 10px;
        line-height:1.7;
        font-size:1rem;
        color:#ffe4d7;
        font-weight:800;
        text-align:center;
      }
      #ban-block-overlay .ban-support-section{
        display:block;
        margin:0 auto;
        padding:0;
        border-radius:0;
        background:transparent !important;
        border:none !important;
        box-shadow:none !important;
      }
      #ban-block-overlay .ban-support-section .support-icons{
        display:flex;
        flex-wrap:wrap;
        gap:8px;
        align-items:center;
        justify-content:center;
      }
      #ban-block-overlay .ban-support-section .support-icon{
        width:32px;
        height:32px;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        border-radius:50%;
        background:transparent !important;
        box-shadow:none !important;
        border:none !important;
        padding:0 !important;
        text-decoration:none;
        position:relative;
      }
      #ban-block-overlay .ban-support-section .support-icon img{
        width:24px !important;
        height:24px !important;
        object-fit:contain;
        display:block;
        filter:none !important;
      }
      #ban-block-overlay .ban-support-section .support-icon i{
        font-size:18px;
        color:#f8fafc;
      }
      #ban-block-overlay .ban-support-section .support-icon:hover{
        transform:none;
        box-shadow:none;
      }
      @media (max-width: 520px){
        #ban-block-overlay{
          padding:12px !important;
        }
        #ban-block-overlay .ban-card-title{
          font-size:1.4rem !important;
        }
        #ban-block-overlay .ban-card-body{
          padding:14px 14px 16px !important;
        }
        #ban-block-overlay .ban-main-text{
          font-size:.86rem !important;
          line-height:1.55 !important;
          margin-bottom:10px !important;
        }
        #ban-block-overlay #banReasonText{
          font-size:.85rem !important;
          line-height:1.5 !important;
          margin-bottom:6px !important;
        }
        #ban-block-overlay #banWebuidText{
          font-size:.84rem !important;
          line-height:1.5 !important;
          margin-bottom:12px !important;
        }
        #ban-block-overlay #banLogoutBtn{
          font-size:.9rem !important;
          padding:10px 12px !important;
        }
        #ban-block-overlay .ban-support-note{
          font-size:.84rem !important;
          line-height:1.45 !important;
          margin:12px 0 8px !important;
        }
      }
      @media (max-width: 390px){
        #ban-block-overlay .ban-card-title{
          font-size:1.28rem !important;
        }
        #ban-block-overlay .ban-card-body{
          padding:13px 12px 15px !important;
        }
        #ban-block-overlay .ban-main-text{
          font-size:.82rem !important;
        }
        #ban-block-overlay #banReasonText{
          font-size:.81rem !important;
        }
        #ban-block-overlay #banWebuidText{
          font-size:.8rem !important;
        }
        #ban-block-overlay #banLogoutBtn{
          font-size:.88rem !important;
        }
        #ban-block-overlay .ban-support-note{
          font-size:.8rem !important;
        }
      }
    `;
    (document.head || document.documentElement || document.body).appendChild(style);
  } catch {}
}

function readBannedOverlaySupportAnchors(){
  try {
    const collect = function(root, selector){
      const out = [];
      const seen = new Set();
      if (!root || typeof root.querySelectorAll !== 'function') return;
      Array.from(root.querySelectorAll(selector)).forEach(function(anchor){
        if (!anchor || typeof anchor.cloneNode !== 'function') return;
        const key = String(anchor.getAttribute('data-contact-key') || anchor.getAttribute('href') || '').trim().toLowerCase();
        if (!key) return;
        if (seen.has(key)) return;
        seen.add(key);
        out.push(anchor);
      });
      return out;
    };
    const sidebarAnchors =
      collect(document.querySelector('#sidebar .support-section'), '.support-icons a.support-icon[href], .support-icons a.support-icon[data-contact-key]') ||
      collect(document.querySelector('section.support-section'), '.support-icons a.support-icon[href], .support-icons a.support-icon[data-contact-key]') ||
      [];
    if (sidebarAnchors.length) return sidebarAnchors;
    return collect(document.getElementById('supportFloatingWidgetItems'), 'a.support-dock__link[href], a.support-dock__link[data-contact-key]') || [];
  } catch {
    return [];
  }
}

function readBannedOverlaySupportItems(){
  const META = {
    whatsapp: { label: 'واتساب', icon: 'fa-brands fa-whatsapp', iconURL: 'https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg' },
    telegram: { label: 'تيليغرام', icon: 'fa-brands fa-telegram', iconURL: 'https://upload.wikimedia.org/wikipedia/commons/8/82/Telegram_logo.svg' },
    instagram: { label: 'إنستغرام', icon: 'fa-brands fa-instagram', iconURL: 'https://upload.wikimedia.org/wikipedia/commons/a/a5/Instagram_icon.png' },
    facebook: { label: 'فيسبوك', icon: 'fa-brands fa-facebook-f', iconURL: 'https://upload.wikimedia.org/wikipedia/commons/5/51/Facebook_f_logo_%282019%29.svg' },
    email: { label: 'البريد', icon: 'fa-solid fa-envelope', iconURL: 'https://upload.wikimedia.org/wikipedia/commons/4/4e/Gmail_Icon.png' }
  };
  const out = [];
  const seen = new Set();
  const normalizeText = function(value){
    return String(value == null ? '' : value)
      .toLowerCase()
      .replace(/[ًٌٍَُِّْـ]/g, '')
      .replace(/[إأآا]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ة/g, 'ه')
      .replace(/\s+/g, ' ')
      .trim();
  };
  const inferType = function(labelLike, href){
    const text = normalizeText(String(labelLike || '') + ' ' + String(href || ''));
    if (!text) return '';
    if (/wa\.me|chat\.whatsapp|whatsapp|واتساب|واتس|واتس اب/.test(text) || /(?:^|\s)wa(?:\s|$)/.test(text)) return 'whatsapp';
    if (/t\.me|tg:\/\/|telegram|تيليجرام|تيليغرام|تليجرام|تليغرام/.test(text)) return 'telegram';
    if (/instagram|انستجرام|انستغرام|انستا/.test(text)) return 'instagram';
    if (/facebook|فيسبوك|fb\.com|m\.me/.test(text)) return 'facebook';
    if (/mailto:|email|mail|ايميل|بريد/.test(text) || /@/.test(String(href || ''))) return 'email';
    return '';
  };
  const normalizeHref = function(type, value){
    const raw = String(value == null ? '' : value).trim();
    if (!raw) return '';
    if (type === 'email') {
      const email = raw.replace(/^mailto:/i, '').trim();
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? ('mailto:' + email) : '';
    }
    if (type === 'whatsapp') {
      if (/^(https?:\/\/|whatsapp:)/i.test(raw)) return raw.slice(0, 2000);
      if (/^(wa\.me\/|chat\.whatsapp\.com\/)/i.test(raw)) return ('https://' + raw).slice(0, 2000);
      const digits = raw.replace(/[^\d]/g, '');
      return digits.length >= 8 ? ('https://wa.me/' + digits).slice(0, 2000) : '';
    }
    if (type === 'telegram') {
      if (/^tg:\/\/resolve\?/i.test(raw)) return raw;
      if (/^https?:\/\/t\.me\//i.test(raw)) return raw.slice(0, 2000);
      if (/^@[\w.]{3,}$/i.test(raw)) return 'https://t.me/' + raw.slice(1);
      if (/^[\w.]{3,}$/i.test(raw) && raw.indexOf('/') === -1) return 'https://t.me/' + raw;
      return '';
    }
    if (type === 'facebook') {
      if (/^https?:\/\//i.test(raw)) return raw.slice(0, 2000);
      const handle = raw.replace(/^@/, '').trim();
      return /^[\w.]{2,}$/i.test(handle) ? ('https://facebook.com/' + handle).slice(0, 2000) : '';
    }
    if (type === 'instagram') {
      if (/^https?:\/\//i.test(raw)) return raw.slice(0, 2000);
      const handle = raw.replace(/^@/, '').trim();
      return /^[\w.]{2,}$/i.test(handle) ? ('https://instagram.com/' + handle).slice(0, 2000) : '';
    }
    return /^https?:\/\//i.test(raw) ? raw.slice(0, 2000) : '';
  };
  const push = function(type, href){
    const meta = META[type];
    if (!meta) return;
    const safeHref = normalizeHref(type, href);
    if (!safeHref) return;
    const key = type + '|' + safeHref.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ key: type, href: safeHref, label: meta.label, icon: meta.icon, iconURL: meta.iconURL || '' });
  };
  const extract = function(raw){
    if (!raw) return;
    if (Array.isArray(raw)) {
      raw.forEach(function(item){
        if (!item) return;
        if (typeof item === 'string') {
          const type = inferType(item, item);
          push(type, item);
          return;
        }
        if (typeof item !== 'object') return;
        const labelLike = [
          item.platform, item.type, item.slug, item.key, item.id, item.className, item.label, item.name, item.title
        ].join(' ');
        const hrefLike = item.href ?? item.url ?? item.link ?? item.value ?? item.text ?? item.address ?? item.username ?? item.handle ?? item.account ?? item.email ?? '';
        push(inferType(labelLike, hrefLike), hrefLike);
      });
      return;
    }
    if (typeof raw !== 'object') {
      push(inferType(raw, raw), raw);
      return;
    }
    const labelLike = [
      raw.platform, raw.type, raw.slug, raw.key, raw.id, raw.className, raw.label, raw.name, raw.title
    ].join(' ');
    const hrefLike = raw.href ?? raw.url ?? raw.link ?? raw.value ?? raw.text ?? raw.address ?? raw.username ?? raw.handle ?? raw.account ?? raw.email ?? '';
    push(inferType(labelLike, hrefLike), hrefLike);
    push('whatsapp', raw.whatsappUrl ?? raw.whatsapp_url ?? raw.whatsappLink ?? raw.whatsapp_link ?? raw.whatsapp ?? raw.wa);
    push('telegram', raw.telegramBotLink ?? raw.telegram_bot_link ?? raw.telegramLink ?? raw.telegram_link ?? raw.telegramUrl ?? raw.telegram_url ?? raw.telegram);
    push('facebook', raw.facebookUrl ?? raw.facebook_url ?? raw.facebookLink ?? raw.facebook_link ?? raw.facebook);
    push('instagram', raw.instagramUrl ?? raw.instagram_url ?? raw.instagramLink ?? raw.instagram_link ?? raw.instagram);
    push('email', raw.email ?? raw.mail);
    [
      raw.siteState, raw.support, raw.links, raw.supportLinks, raw.contactLinks, raw.linkMap, raw.map,
      raw.contacts, raw.supportContacts, raw.contactMethods, raw.items, raw.list
    ].forEach(function(entry){
      if (!entry || entry === raw) return;
      extract(entry);
    });
  };
  try {
    if (typeof window.__applySupportContactsConfig === 'function') {
      const source = (typeof window.__getResolvedSiteStateData === 'function')
        ? window.__getResolvedSiteStateData()
        : window.__SITE_STATE_DATA__;
      if (source && typeof source === 'object') window.__applySupportContactsConfig(source);
    }
  } catch {}
  try { extract(window.__SUPPORT_CONTACTS_RENDERED__); } catch {}
  try { extract(window.__SUPPORT_LINKS_MAP__); } catch {}
  try { push('telegram', window.__TELEGRAM_LINK_BOT_URL__); } catch {}
  try { extract(JSON.parse(localStorage.getItem('site:support:v1') || 'null')); } catch {}
  try { extract(JSON.parse(localStorage.getItem('site:support:contacts:v1') || 'null')); } catch {}
  try { extract(JSON.parse(localStorage.getItem('site:support:links:v1') || 'null')); } catch {}
  const order = ['whatsapp', 'telegram', 'instagram', 'facebook', 'email'];
  return out.sort(function(a, b){ return order.indexOf(a.key) - order.indexOf(b.key); });
}

function renderBannedOverlaySupport(root){
  try {
    if (!root) return;
    ensureBannedOverlaySupportStyle();
    const noteEl = root.querySelector('#banSupportNote');
    const linksEl = root.querySelector('#banSupportLinks');
    if (!noteEl || !linksEl) return;
    const createIconsHost = function(){
      linksEl.className = 'ban-support-section';
      linksEl.innerHTML = '';
      const icons = document.createElement('div');
      icons.className = 'support-icons';
      linksEl.appendChild(icons);
      return icons;
    };
    const appendAnchor = function(host, config){
      if (!host || !config) return;
      const key = String(config.key || '').trim().toLowerCase();
      const href = String(config.href || '').trim();
      const label = String(config.label || key || '').trim();
      if (!key || !href) return;
      const anchor = document.createElement('a');
      anchor.className = 'support-icon ' + key;
      anchor.setAttribute('data-contact-key', key);
      anchor.setAttribute('data-contact-label', label);
      anchor.setAttribute('aria-label', label || key);
      anchor.setAttribute('href', href);
      if (!/^mailto:/i.test(href)) {
        anchor.setAttribute('target', '_blank');
        anchor.setAttribute('rel', 'noopener noreferrer');
      }
      if (config.anchorNode && typeof config.anchorNode.cloneNode === 'function') {
        const clone = config.anchorNode.cloneNode(true);
        try {
          clone.className = anchor.className;
          clone.setAttribute('data-contact-key', key);
          clone.setAttribute('data-contact-label', label);
          clone.setAttribute('aria-label', label || key);
          clone.setAttribute('href', href);
          if (!/^mailto:/i.test(href)) {
            clone.setAttribute('target', '_blank');
            clone.setAttribute('rel', 'noopener noreferrer');
          } else {
            clone.removeAttribute('target');
            clone.removeAttribute('rel');
          }
          const badge = clone.querySelector('.support-badge');
          if (badge && badge.parentNode) {
            badge.parentNode.removeChild(badge);
          }
        } catch {}
        host.appendChild(clone);
        return;
      }
      if (config.iconNode && typeof config.iconNode.cloneNode === 'function') {
        const clone = config.iconNode.cloneNode(true);
        if (clone.tagName && clone.tagName.toLowerCase() === 'img') {
          clone.setAttribute('alt', label ? (label + ' icon') : '');
          clone.setAttribute('loading', 'lazy');
          clone.setAttribute('decoding', 'async');
        } else {
          try { clone.setAttribute('aria-hidden', 'true'); } catch {}
        }
        anchor.appendChild(clone);
      } else if (config.iconURL) {
        const img = document.createElement('img');
        img.src = String(config.iconURL || '').trim();
        img.alt = label ? (label + ' icon') : '';
        img.loading = 'lazy';
        img.decoding = 'async';
        anchor.appendChild(img);
      } else if (config.iconClass) {
        const icon = document.createElement('i');
        icon.className = String(config.iconClass || '').trim();
        icon.setAttribute('aria-hidden', 'true');
        anchor.appendChild(icon);
      }
      host.appendChild(anchor);
    };
    const anchors = readBannedOverlaySupportAnchors();
    if (anchors.length) {
      const iconsHost = createIconsHost();
      anchors.forEach(function(anchor){
        try {
          const href = String(anchor.getAttribute('href') || '').trim();
          const key = String(anchor.getAttribute('data-contact-key') || '').trim().toLowerCase();
          if (!href || href === '#' || !key) return;
          appendAnchor(iconsHost, {
            key: key,
            href: href,
            label: String(anchor.getAttribute('data-contact-label') || anchor.getAttribute('aria-label') || key).trim(),
            anchorNode: anchor,
            iconNode: anchor.querySelector('img, i, svg')
          });
        } catch {}
      });
      if (!iconsHost.children.length) {
        noteEl.style.display = 'none';
        linksEl.style.display = 'none';
        linksEl.innerHTML = '';
        return;
      }
      noteEl.style.display = 'block';
      linksEl.style.display = 'block';
      return;
    }
    const items = readBannedOverlaySupportItems();
    if (!items.length) {
      noteEl.style.display = 'none';
      linksEl.style.display = 'none';
      linksEl.innerHTML = '';
      return;
    }
    const iconsHost = createIconsHost();
    items.forEach(function(item){
      appendAnchor(iconsHost, {
        key: item.key,
        href: item.href,
        label: item.label,
        iconURL: item.iconURL || '',
        iconClass: item.icon
      });
    });
    if (!iconsHost.children.length) {
      noteEl.style.display = 'none';
      linksEl.style.display = 'none';
      linksEl.innerHTML = '';
      return;
    }
    noteEl.style.display = 'block';
    linksEl.style.display = 'block';
  } catch {}
}

function scheduleBannedOverlaySupportRefresh(root){
  try {
    if (!root) return;
    const timers = Array.isArray(root.__banSupportRefreshTimers) ? root.__banSupportRefreshTimers : [];
    timers.forEach(function(timerId){ try { clearTimeout(timerId); } catch {} });
    root.__banSupportRefreshTimers = [180, 900, 2200].map(function(delay){
      return setTimeout(function(){
        try {
          if (!root.isConnected) return;
          renderBannedOverlaySupport(root);
        } catch {}
      }, delay);
    });
  } catch {}
}

function bindBannedOverlaySupportObservers(root){
  try {
    if (!root || root.__banSupportObserverBound) return;
    root.__banSupportObserverBound = true;
    const refresh = function(){
      try {
        if (!root.isConnected) return;
        renderBannedOverlaySupport(root);
      } catch {}
    };
    const targets = [
      { node: document.getElementById('supportFloatingWidgetItems'), options: { childList: true, subtree: true, attributes: true, attributeFilter: ['href', 'class', 'style', 'hidden'] } },
      { node: document.querySelector('#sidebar .support-section'), options: { childList: true, subtree: true, attributes: true, attributeFilter: ['href', 'class', 'style', 'hidden'] } },
      { node: document.querySelector('section.support-section'), options: { childList: true, subtree: true, attributes: true, attributeFilter: ['href', 'class', 'style', 'hidden'] } },
      { node: document.body, options: { childList: true, subtree: false } }
    ].filter(function(entry){ return !!entry.node; });
    root.__banSupportObservers = targets.map(function(entry){
      try {
        const observer = new MutationObserver(refresh);
        observer.observe(entry.node, entry.options);
        return observer;
      } catch {
        return null;
      }
    }).filter(Boolean);
    try {
      root.__banSupportStateListener = function(){
        refresh();
        scheduleBannedOverlaySupportRefresh(root);
      };
      window.addEventListener('site-state-updated', root.__banSupportStateListener);
    } catch {}
  } catch {}
}

function performClientLogout(redirectUrl){
  try { window.__LOGOUT_IN_PROGRESS__ = true; } catch {}
  try { clearSessionDocWatcher(); } catch {}
  if (typeof unsubscribeBalance === 'function') { try { unsubscribeBalance(); } catch {} unsubscribeBalance = null; }
  hideBannedOverlay();
  clearAuthClientState();
  try { applyAuthUi(null); } catch {}
  try { setHeaderBalanceAmount(0); } catch {}
  try { broadcastBalance(0); } catch {}
  var currentUrl = '';
  try { currentUrl = String(window.location.href || ''); } catch {}
  var target = redirectUrl;
  if (target == null || target === false || String(target).trim() === '') {
    target = currentUrl || 'index.html';
  }
  try { target = new URL(String(target), window.location.href).toString(); } catch {}
  var preserveCurrentUrl = false;
  try {
    preserveCurrentUrl = !!currentUrl && !!target && (String(target) === String(currentUrl));
  } catch {}
  var redirected = false;
  var go = function(){
    if (redirected) return;
    redirected = true;
    if (preserveCurrentUrl) {
      try {
        sessionStorage.removeItem('nav:loader:expected');
        sessionStorage.removeItem('nav:loader:showAt');
      } catch {}
      try { if (typeof window.__setInlineWalletRoutePending === 'function') window.__setInlineWalletRoutePending(false); } catch {}
      try { hidePageLoader(); } catch {}
      try { window.dispatchEvent(new CustomEvent('auth:logout')); } catch {}
      try { window.dispatchEvent(new Event('hashchange')); } catch {}
      try { window.dispatchEvent(new Event('popstate')); } catch {}
      return;
    }
    try { window.location.replace(target); return; } catch {}
    try { window.location.href = target; return; } catch {}
    try { window.location.hash = '#/login'; } catch {}
  };
  try { window.__LOGOUT_IN_PROGRESS__ = true; } catch {}
  try {
    if (typeof firebase !== 'undefined' && firebase.auth && typeof firebase.auth().signOut === 'function') {
      Promise.resolve(firebase.auth().signOut()).finally(go);
      setTimeout(go, 900);
      return;
    }
  } catch {}
  setTimeout(go, 10);
}

// Gracefully block banned accounts across the site
function showBannedOverlay(reason, webuid){
  try {
    let overlay = document.getElementById('ban-block-overlay');
    const applyMeta = (root) => {
      try {
        const reasonEl = root.querySelector('#banReasonText');
        const cleanReason = (typeof reason === 'string' ? reason.trim() : '');
        if (reasonEl) {
          reasonEl.textContent = cleanReason ? ('سبب الحظر: ' + cleanReason) : '';
          reasonEl.style.display = cleanReason ? 'block' : 'none';
        }
        const webuidEl = root.querySelector('#banWebuidText');
        const cleanWebuid = (webuid == null ? '' : String(webuid)).trim();
        if (webuidEl) {
          webuidEl.textContent = cleanWebuid ? ('الايدي: \u2066' + cleanWebuid + '\u2069') : '';
          webuidEl.style.display = cleanWebuid ? 'block' : 'none';
        }
        renderBannedOverlaySupport(root);
        bindBannedOverlaySupportObservers(root);
        scheduleBannedOverlaySupportRefresh(root);
      } catch {}
    };
    if (overlay) { applyMeta(overlay); return overlay; }
    ensureBannedOverlaySupportStyle();
    overlay = document.createElement('div');
    overlay.id = 'ban-block-overlay';
    overlay.setAttribute('role','alertdialog');
    overlay.setAttribute('aria-label','\u062A\u0645\u0020\u062D\u0638\u0631\u0020\u0627\u0644\u062D\u0633\u0627\u0628');
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.padding = '18px';
    overlay.style.background = 'linear-gradient(175deg,#010208 0%, #040812 56%, #02040a 100%)';
    overlay.style.backdropFilter = 'blur(2px)';
    overlay.style.zIndex = '15000';
    overlay.style.overflow = 'hidden';

    const lines = document.createElement('div');
    lines.style.position = 'absolute';
    lines.style.inset = '0';
    lines.style.pointerEvents = 'none';
    lines.style.opacity = '.93';
    lines.style.backgroundImage = [
      'radial-gradient(circle at 45% 40%, rgba(120,18,18,0.18), rgba(0,0,0,0) 62%)',
      'repeating-linear-gradient(-35deg, rgba(116,14,18,0.56) 0 44px, rgba(20,6,18,0.88) 44px 88px)'
    ].join(',');
    lines.style.mixBlendMode = 'normal';

    const card = document.createElement('div');
    card.style.position = 'relative';
    card.style.maxWidth = '520px';
    card.style.width = '100%';
    card.style.background = 'linear-gradient(180deg, rgba(27,4,6,0.96) 0%, rgba(16,3,5,0.98) 100%)';
    card.style.color = '#ffe0e0';
    card.style.borderRadius = '14px';
    card.style.boxShadow = '0 24px 70px rgba(0,0,0,0.65), inset 0 0 0 1px rgba(255,76,76,0.22)';
    card.style.border = '2px solid rgba(219,45,45,0.88)';
    card.style.overflow = 'hidden';
    card.innerHTML = `
      <div style="padding:18px 20px;background:linear-gradient(180deg,#c42929 0%, #9f1f1f 100%);border-bottom:1px solid rgba(255,120,120,0.42);text-align:center;">
        <h2 class="ban-card-title" style="margin:0;font-size:2rem;line-height:1.2;color:#fff8f8;font-weight:900;">\u062D\u0633\u0627\u0628\u0643 \u0645\u062D\u0638\u0648\u0631</h2>
      </div>
      <div class="ban-card-body" style="padding:20px 22px 22px;">
        <p class="ban-main-text" style="margin:0 0 14px;line-height:1.8;font-size:1rem;color:#ffcfcf;">\u062A\u0645 \u0625\u064A\u0642\u0627\u0641 \u0647\u0630\u0627 \u0627\u0644\u062D\u0633\u0627\u0628 \u0648\u0644\u0627 \u064A\u0645\u0643\u0646 \u0645\u062A\u0627\u0628\u0639\u0629 \u0627\u0644\u0627\u0633\u062A\u062E\u062F\u0627\u0645 \u062D\u0627\u0644\u064A\u064B\u0627.</p>
        <p id="banReasonText" style="margin:0 0 8px;line-height:1.7;font-size:1rem;color:#ff8f8f;display:none;"></p>
        <p id="banWebuidText" style="margin:0 0 16px;line-height:1.7;font-size:.95rem;color:#ffb9b9;opacity:.95;display:none;"></p>
        <button id="banLogoutBtn" type="button" style="width:100%;padding:12px 14px;border-radius:10px;border:1px solid rgba(255,145,145,0.45);background:linear-gradient(180deg,#ed3a3a 0%,#b11f1f 100%);color:#fff;font-weight:900;font-size:1rem;cursor:pointer;">\u062D\u0633\u0646\u064B\u0627</button>
        <p id="banSupportNote" class="ban-support-note" style="display:none;">يرجى التواصل مع الدعم لحل المشكلة.</p>
        <div id="banSupportLinks" class="ban-support-links" style="display:none;"></div>
      </div>
    `;
    overlay.appendChild(lines);
    overlay.appendChild(card);
    (document.body || document.documentElement).appendChild(overlay);
    applyMeta(overlay);
    return overlay;
  } catch { return null; }
}
function handleBannedAccount(reason, webuid){
  if (bannedSessionHandled) return;
  bannedSessionHandled = true;
  clearSessionDocWatcher();
  if (typeof unsubscribeBalance === 'function') { try { unsubscribeBalance(); } catch {} unsubscribeBalance = null; }
  const overlay = showBannedOverlay(reason, webuid);
  const logoutBtn = overlay ? overlay.querySelector('#banLogoutBtn') : null;
  let logoutTriggered = false;
  const forceLogout = () => {
    if (logoutTriggered) return;
    logoutTriggered = true;
    try {
      if (logoutBtn) {
        logoutBtn.disabled = true;
        logoutBtn.style.opacity = '.7';
        logoutBtn.textContent = 'جاري تسجيل الخروج...';
      }
    } catch {}
    hideBannedOverlay();
    try {
      try { sessionStorage.removeItem('nav:loader:expected'); sessionStorage.removeItem('nav:loader:showAt'); } catch {}
      performClientLogout();
    } catch {
      try { window.dispatchEvent(new Event('hashchange')); return; } catch {}
      try { window.location.reload(); } catch {}
    }
  };
  try { window.__forceBanLogout = forceLogout; } catch {}
  if (logoutBtn) {
    try { logoutBtn.onclick = forceLogout; } catch {}
    logoutBtn.addEventListener('click', function(e){ try { e.preventDefault(); e.stopPropagation(); } catch {} forceLogout(); }, true);
    logoutBtn.addEventListener('touchend', function(e){ try { e.preventDefault(); e.stopPropagation(); } catch {} forceLogout(); }, true);
    logoutBtn.addEventListener('keydown', function(e){
      if (!e) return;
      if (e.key === 'Enter' || e.key === ' ') {
        try { e.preventDefault(); e.stopPropagation(); } catch {}
        forceLogout();
      }
    }, true);
  }
}
try {
  window.showBannedOverlay = showBannedOverlay;
  window.handleBannedAccount = handleBannedAccount;
} catch {}

// Update header balance text when currency changes
try {
  window.addEventListener('currency:change', function(){
    try {
      const base = headerGetBaseBalanceValue();
      setHeaderBalanceAmount(base);
      broadcastBalance(base);
    } catch {}
  });
} catch {}

try {
  headerLevelsBtn.addEventListener('click', function(ev){
    try { ev.preventDefault(); } catch {}
    navigateHomeHash('#/levels', 'levels');
  });
} catch {}
//
// Sidebar
const sidebar = document.createElement('nav');
sidebar.id = 'sidebar';

// Add CSS for scrolling
sidebar.style.overflowY = 'auto'; // Enable vertical scrolling
sidebar.style.overflowX = 'hidden'; // Prevent horizontal scrolling
sidebar.style.maxHeight = '100vh'; // Full viewport height

const sidebarTop = document.createElement('div');
sidebarTop.className = 'sidebar-top-shell';
sidebarTop.innerHTML = `
  <div class="sidebar-profile-card">
    <div class="sidebar-user-avatar" id="sidebarUserAvatarWrap">
      <img id="sidebarUserAvatar" alt="User avatar" loading="lazy" referrerpolicy="no-referrer" />
      <span class="sidebar-user-avatar-fallback" id="sidebarUserAvatarFallback">
        <i class="fa-solid fa-user"></i>
      </span>
    </div>
    <div class="sidebar-user-meta">
      <div class="sidebar-user-name-row">
        <span class="sidebar-user-id" id="sidebarUserId">#----</span>
        <span class="sidebar-user-name" id="sidebarUserName">زائر</span>
      </div>
    </div>
  </div>
  <div class="sidebar-lang-row" role="group" aria-label="اختيار اللغة">
    <button type="button" class="sidebar-lang-btn" data-lang-code="en" aria-label="English">
      <img class="sidebar-lang-flag" src="https://flagcdn.com/w160/gb.png" srcset="https://flagcdn.com/w320/gb.png 2x" alt="" loading="lazy" referrerpolicy="no-referrer" />
    </button>
    <button type="button" class="sidebar-lang-btn" data-lang-code="fr" aria-label="Français">
      <img class="sidebar-lang-flag" src="https://flagcdn.com/w160/fr.png" srcset="https://flagcdn.com/w320/fr.png 2x" alt="" loading="lazy" referrerpolicy="no-referrer" />
    </button>
    <button type="button" class="sidebar-lang-btn" data-lang-code="ar" aria-label="العربية">
      <img class="sidebar-lang-flag" src="https://flagcdn.com/w160/sa.png" srcset="https://flagcdn.com/w320/sa.png 2x" alt="" loading="lazy" referrerpolicy="no-referrer" />
    </button>
  </div>
  <div class="sidebar-quick-row" role="group" aria-label="اختصارات سريعة">
    <button type="button" class="sidebar-quick-btn sidebar-quick-btn--heart" id="sidebarQuickFav" aria-label="المفضلة">
      <i class="fa-solid fa-heart"></i>
    </button>
    <button type="button" class="sidebar-quick-btn sidebar-quick-btn--account" id="sidebarQuickAccount" aria-label="الإعدادات">
      <i class="fa-solid fa-gear"></i>
    </button>
    <button type="button" class="sidebar-quick-btn sidebar-quick-btn--auth" id="sidebarQuickAuth" aria-label="الدخول أو الخروج">
      <i class="fa-solid fa-right-to-bracket"></i>
    </button>
  </div>
  <div class="sidebar-currency-wrap" id="sidebarCurrencyWrap">
    <button type="button" class="sidebar-currency-pill" id="sidebarCurrencyTrigger" aria-expanded="false" aria-controls="sidebarCurrencyMenu">
      <i class="fa-solid fa-coins"></i>
      <span class="sidebar-currency-pill__label" id="sidebarCurrencyLabel">USD</span>
    </button>
    <div class="sidebar-currency-menu" id="sidebarCurrencyMenu" role="listbox" aria-label="Currency list"></div>
  </div>
`;
sidebar.appendChild(sidebarTop);

function normalizeSidebarUserName(user){
  const safe = (value) => String(value == null ? '' : value).trim();
  const fromUser = safe(user && (user.displayName || user.name || user.username || user.email));
  if (fromUser) return fromUser;
  try {
    const payload = readPostLoginPayload && readPostLoginPayload();
    const fromPayload = safe(payload && (payload.displayName || payload.name || payload.username || payload.email));
    if (fromPayload) return fromPayload;
  } catch {}
  try {
    const cached = resolveSidebarCachedProfile(user);
    const fromCache = safe(cached && (cached.displayName || cached.name || cached.username || cached.email));
    if (fromCache) return fromCache;
  } catch {}
  return 'زائر';
}

function normalizeSidebarUserId(user){
  const asRankTag = (value) => {
    const n = normalizeAccountNoValue(value);
    if (!n) return '';
    return '#' + String(n);
  };
  const asTag = (value) => {
    const v = String(value == null ? '' : value).trim();
    if (!v) return '#----';
    const clean = v.replace(/[^0-9A-Za-z]/g, '');
    if (!clean) return '#----';
    return '#' + clean.slice(0, 4).toUpperCase();
  };
  try {
    const rank = asRankTag(user && (user.accountNo ?? user.account_no ?? user.rank));
    if (rank) return rank;
  } catch {}
  try {
    const payload = readPostLoginPayload && readPostLoginPayload();
    const rank = asRankTag(payload && (payload.accountNo ?? payload.account_no ?? payload.rank));
    if (rank) return rank;
    if (payload && payload.uid) return asTag(payload.uid);
  } catch {}
  try {
    const cachedRank = asRankTag(localStorage.getItem(LAST_ACCOUNT_NO_KEY));
    if (cachedRank) return cachedRank;
  } catch {}
  if (user && user.uid) return asTag(user.uid);
  try {
    const uid = localStorage.getItem(LAST_UID_KEY);
    if (uid) return asTag(uid);
  } catch {}
  return '#----';
}

function normalizeSidebarUserAvatar(user){
  const safe = (value) => String(value == null ? '' : value).trim();
  const fromUser = safe(user && (user.photoURL || user.photoUrl || user.avatar || user.image));
  if (fromUser) return fromUser;
  try {
    const payload = readPostLoginPayload && readPostLoginPayload();
    const fromPayload = safe(payload && (payload.photoURL || payload.photoUrl || payload.avatar));
    if (fromPayload) return fromPayload;
  } catch {}
  try {
    const cached = resolveSidebarCachedProfile(user);
    const fromCache = safe(cached && (cached.photoURL || cached.photoUrl || cached.avatar));
    if (fromCache) return fromCache;
  } catch {}
  return '';
}

function isSidebarLoggedIn(user){
  try { if (hasSidebarUserIdentity(user)) return true; } catch {}
  try {
    if (window.__LOGOUT_IN_PROGRESS__) return false;
  } catch {}
  try {
    var effectiveUser = resolveEffectiveSidebarUser(null);
    if (hasSidebarUserIdentity(effectiveUser)) return true;
  } catch {}
  try {
    var sessionInfo = readSidebarSessionInfo();
    if (sessionInfo && String(sessionInfo.uid || '').trim() && String(sessionInfo.sessionKey || '').trim()) return true;
  } catch {}
  try {
    var payload = readPostLoginPayload && readPostLoginPayload();
    if (payload && (String(payload.uid || '').trim() || String(payload.sessionKey || payload.session_key || '').trim() || String(payload.token || payload.idToken || '').trim())) return true;
  } catch {}
  try { return localStorage.getItem(LAST_LOGGED_KEY) === '1'; } catch {}
  return false;
}

function setSidebarQuickAuthIcon(user){
  try {
    const btn = sidebarTop.querySelector('#sidebarQuickAuth') || document.getElementById('sidebarQuickAuth');
    if (!btn) return;
    const icon = btn.querySelector('i');
    if (!icon) return;
    const logged = isSidebarLoggedIn(user);
    icon.className = logged ? 'fa-solid fa-right-from-bracket' : 'fa-solid fa-right-to-bracket';
    btn.setAttribute('aria-label', logged ? 'تسجيل الخروج' : 'تسجيل الدخول');
  } catch {}
}

function applySidebarIdentity(user){
  try {
    const nameEl = sidebarTop.querySelector('#sidebarUserName') || document.getElementById('sidebarUserName');
    const idEl = sidebarTop.querySelector('#sidebarUserId') || document.getElementById('sidebarUserId');
    const avatarEl = sidebarTop.querySelector('#sidebarUserAvatar') || document.getElementById('sidebarUserAvatar');
    const avatarFallback = sidebarTop.querySelector('#sidebarUserAvatarFallback') || document.getElementById('sidebarUserAvatarFallback');
    if (nameEl) nameEl.textContent = normalizeSidebarUserName(user);
    if (idEl) idEl.textContent = normalizeSidebarUserId(user);
    const avatar = normalizeSidebarUserAvatar(user);
    if (avatarEl) {
      if (avatar) {
        avatarEl.src = avatar;
        avatarEl.style.display = 'block';
        if (avatarFallback) avatarFallback.style.display = 'none';
      } else {
        avatarEl.removeAttribute('src');
        avatarEl.style.display = 'none';
        if (avatarFallback) avatarFallback.style.display = 'inline-flex';
      }
    }
  } catch {}
  try { setSidebarQuickAuthIcon(user); } catch {}
}

function setSidebarBalanceText(value){
  try {
    const balanceEl = sidebarTop.querySelector('#sidebarBalanceValue') || document.getElementById('sidebarBalanceValue');
    if (!balanceEl) return;
    let text = String(value == null ? '' : value).trim();
    if (!text) text = '0 $';
    balanceEl.textContent = text;
  } catch {}
}

function syncSidebarBalanceFromHeader(){
  try {
    const node = document.getElementById('headerBalanceText');
    const curNode = document.getElementById('headerBalanceCurrency');
    const val = node ? String(node.textContent || '').trim() : '';
    const cur = curNode ? String(curNode.textContent || '').trim() : '';
    if (!val && !cur) return;
    setSidebarBalanceText(cur && cur !== '—' ? `${val} ${cur}` : val);
  } catch {}
}

function getSidebarCurrentLanguage(){
  try {
    if (window.__I18N__ && typeof window.__I18N__.getLang === 'function') {
      const current = String(window.__I18N__.getLang() || '').toLowerCase();
      if (current && current !== 'off') return current;
    }
  } catch {}
  try {
    const htmlLang = String(document.documentElement.getAttribute('lang') || '').toLowerCase();
    if (htmlLang) return htmlLang;
  } catch {}
  return 'ar';
}

function syncSidebarLanguageButtons(){
  try {
    const current = getSidebarCurrentLanguage();
    sidebarTop.querySelectorAll('.sidebar-lang-btn').forEach((btn) => {
      const code = String(btn.getAttribute('data-lang-code') || '').toLowerCase();
      btn.classList.toggle('active', code === current);
    });
  } catch {}
}

function closeSidebarCurrencyMenu(){
  try {
    const menu = sidebarTop.querySelector('#sidebarCurrencyMenu') || document.getElementById('sidebarCurrencyMenu');
    const trigger = sidebarTop.querySelector('#sidebarCurrencyTrigger') || document.getElementById('sidebarCurrencyTrigger');
    if (menu) menu.classList.remove('open');
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
  } catch {}
}

function syncSidebarCurrencyLabel(){
  try {
    const label = sidebarTop.querySelector('#sidebarCurrencyLabel') || document.getElementById('sidebarCurrencyLabel');
    if (!label) return;
    const code = (typeof window.getSelectedCurrencyCode === 'function')
      ? String(window.getSelectedCurrencyCode() || '').toUpperCase()
      : '';
    label.textContent = code || 'USD';
    const menu = sidebarTop.querySelector('#sidebarCurrencyMenu') || document.getElementById('sidebarCurrencyMenu');
    if (menu) {
      menu.querySelectorAll('.sidebar-currency-option').forEach((btn) => {
        const active = String(btn.dataset.value || '').toUpperCase() === label.textContent;
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-selected', active ? 'true' : 'false');
      });
    }
  } catch {}
}

function rebuildSidebarCurrencyMenu(){
  try {
    const menu = sidebarTop.querySelector('#sidebarCurrencyMenu') || document.getElementById('sidebarCurrencyMenu');
    if (!menu) return;
    while (menu.firstChild) menu.removeChild(menu.firstChild);
    const rates = window.__CURRENCIES__ || {};
    const codes = Object.keys(rates || {}).filter((code) => {
      const curr = rates[code] || {};
      return !(curr && curr.visible === false);
    });
    if (!codes.length) return;
    codes.forEach((code) => {
      const curr = rates[code] || {};
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sidebar-currency-option';
      btn.setAttribute('role', 'option');
      btn.dataset.value = String(code || '').toUpperCase();
      const symbol = String(curr.symbol || curr.code || code || '').trim();
      btn.textContent = symbol ? `${code} (${symbol})` : String(code || '').toUpperCase();
      btn.addEventListener('click', (ev) => {
        try { ev.preventDefault(); ev.stopPropagation(); } catch {}
        try {
          if (typeof window.setSelectedCurrencyCode === 'function') {
            window.setSelectedCurrencyCode(code);
          }
        } catch {}
        syncSidebarCurrencyLabel();
        closeSidebarCurrencyMenu();
      });
      menu.appendChild(btn);
    });
    syncSidebarCurrencyLabel();
  } catch {}
}

const ul = document.createElement('ul');
function bindSidebarNavItem(li, targetHash, routeKey){
  if (!li) return;
  const hash = String(targetHash || '#/').trim() || '#/';
  const key = String(routeKey || '').trim();
  li.onclick = () => navigateHomeHash(hash, key);
  try {
    const link = li.querySelector('a[href]');
    if (link) {
      link.addEventListener('click', (ev) => {
        try {
          ev.preventDefault();
          ev.stopPropagation();
          if (typeof ev.stopImmediatePropagation === 'function') ev.stopImmediatePropagation();
        } catch {}
        navigateHomeHash(hash, key);
      });
    }
  } catch {}
}
// الرئيسية
const homeLi = document.createElement('li');
homeLi.id = 'homeBtn';
homeLi.className = 'sidebar-nav-item';
homeLi.style.setProperty('--sidebar-item-icon', '#22c55e');
homeLi.innerHTML = '<i class="fas fa-home"></i><a href="#" data-i18n="nav.home">\u0627\u0644\u0631\u0626\u064A\u0633\u064A\u0629</a>';
bindSidebarNavItem(homeLi, '#/');
ul.appendChild(homeLi);
// الرئيسية
const depositLi = document.createElement('li');
depositLi.id = 'depositBtn';
depositLi.className = 'sidebar-nav-item';
depositLi.style.setProperty('--sidebar-item-icon', '#0ea5e9');
depositLi.innerHTML = '<i class="fa-solid fa-circle-dollar-to-slot"></i><a href="#" data-i18n="nav.deposit">\u0627\u0644\u0625\u064A\u062F\u0627\u0639</a>';
bindSidebarNavItem(depositLi, '#/deposit', 'deposit');
depositLi.style.display = 'none';
ul.appendChild(depositLi);
// الرئيسية
const paymentsLi = document.createElement('li');
paymentsLi.id = 'paymentsBtn';
paymentsLi.className = 'sidebar-nav-item';
paymentsLi.style.setProperty('--sidebar-item-icon', '#f59e0b');
paymentsLi.innerHTML = '<i class="fa-solid fa-receipt"></i><a href="#">\u062F\u0641\u0639\u0627\u062A\u064A</a>';
bindSidebarNavItem(paymentsLi, '#/dafaati', 'dafaati');
paymentsLi.style.display = 'none';
ul.appendChild(paymentsLi);
// الرئيسية
const ordersLi = document.createElement('li');
ordersLi.id = 'ordersBtn';
ordersLi.className = 'sidebar-nav-item';
ordersLi.style.setProperty('--sidebar-item-icon', '#38bdf8');
ordersLi.innerHTML = '<i class="fas fa-list"></i><a href="#" data-i18n="nav.orders">\u0637\u0644\u0628\u0627\u062A\u064A</a>';
bindSidebarNavItem(ordersLi, '#/orders', 'orders');
ul.appendChild(ordersLi);
// الرئيسية
const walletLi = document.createElement('li');
walletLi.id = 'walletBtn';
walletLi.className = 'sidebar-nav-item';
walletLi.style.setProperty('--sidebar-item-icon', '#facc15');
walletLi.innerHTML = '<i class="fas fa-wallet"></i><a href="#" data-i18n="nav.wallet">\u0627\u0644\u0645\u062D\u0641\u0638\u0629</a>';
bindSidebarNavItem(walletLi, '#/wallet', 'wallet');
walletLi.style.display = 'none';
ul.appendChild(walletLi);
// تحويل الرصيد
const transferLi = document.createElement('li');
transferLi.id = 'transferBtn';
transferLi.className = 'sidebar-nav-item';
transferLi.style.setProperty('--sidebar-item-icon', '#3b82f6');
transferLi.innerHTML = '<i class="fa-solid fa-right-left"></i><a href="#" data-i18n="nav.transfer">\u062A\u062D\u0648\u064A\u0644\u0020\u0627\u0644\u0631\u0635\u064A\u062F</a>';
bindSidebarNavItem(transferLi, '#/transfer', 'transfer');
transferLi.style.display = 'none';
ul.appendChild(transferLi);
// سحب الرصيد
const withdrawLi = document.createElement('li');
withdrawLi.id = 'withdrawBtn';
withdrawLi.className = 'sidebar-nav-item';
withdrawLi.style.setProperty('--sidebar-item-icon', '#fb7185');
withdrawLi.innerHTML = '<i class="fa-solid fa-money-bill-transfer"></i><a href="#" data-i18n="nav.withdraw">\u0633\u062D\u0628\u0020\u0627\u0644\u0631\u0635\u064A\u062F</a>';
bindSidebarNavItem(withdrawLi, '#/withdraw', 'withdraw');
withdrawLi.style.display = 'none';
ul.appendChild(withdrawLi);
// الرئيسية
const reviewsLi = document.createElement('li');
reviewsLi.id = 'reviewsBtn';
reviewsLi.className = 'sidebar-nav-item';
reviewsLi.style.setProperty('--sidebar-item-icon', '#f43f5e');
reviewsLi.innerHTML = '<i class="fa-solid fa-star"></i><a href="#" data-i18n="nav.reviews">\u0627\u0644\u062A\u0642\u064A\u064A\u0645\u0627\u062A</a>';
bindSidebarNavItem(reviewsLi, '#/reviews', 'reviews');
ul.appendChild(reviewsLi);
try { syncReviewsSidebarVisibility(); } catch {}
// الوكلاء
const agentsLi = document.createElement('li');
agentsLi.id = 'agentsBtn';
agentsLi.className = 'sidebar-nav-item';
agentsLi.style.setProperty('--sidebar-item-icon', '#10b981');
agentsLi.innerHTML = '<i class="fa-solid fa-user-tie"></i><a href="#" data-i18n="nav.agents">\u0648\u0643\u0644\u0627\u0626\u0646\u0627</a>';
bindSidebarNavItem(agentsLi, '#/agents', 'agents');
ul.appendChild(agentsLi);
try { syncAgentsSidebarVisibility(); } catch {}
// حماية الحساب
const securityLi = document.createElement('li');
securityLi.id = 'securityBtn';
securityLi.className = 'sidebar-nav-item';
securityLi.style.setProperty('--sidebar-item-icon', '#f97316');
securityLi.innerHTML = '<i class="fa-solid fa-shield-halved"></i><a href="#" data-i18n="nav.security">\u062D\u0645\u0627\u064A\u0629\u0020\u0627\u0644\u062D\u0633\u0627\u0628</a>';
bindSidebarNavItem(securityLi, '#/security', 'security');
securityLi.style.display = 'none';
ul.appendChild(securityLi);
// ربط تيليغرام
const telegramLi = document.createElement('li');
telegramLi.id = 'telegramBtn';
telegramLi.className = 'sidebar-nav-item';
telegramLi.style.setProperty('--sidebar-item-icon', '#38bdf8');
telegramLi.innerHTML = '<i class="fa-brands fa-telegram"></i><a href="#" data-i18n="nav.telegram">\u0631\u0628\u0637\u0020\u062A\u064A\u0644\u064A\u063A\u0631\u0627\u0645</a>';
bindSidebarNavItem(telegramLi, '#/telegram', 'telegram');
telegramLi.style.display = 'none';
ul.appendChild(telegramLi);
// API docs
const apiLi = document.createElement('li');
apiLi.id = 'apiBtn';
apiLi.className = 'sidebar-nav-item';
apiLi.style.setProperty('--sidebar-item-icon', '#a78bfa');
apiLi.innerHTML = '<i class="fa-solid fa-code"></i><a href="#" data-i18n="nav.api">API</a>';
bindSidebarNavItem(apiLi, '#/api', 'api');
apiLi.style.display = 'none';
ul.appendChild(apiLi);
// تسجيل الدخول / الخروج
const loginLi = document.createElement('li');
loginLi.id = 'loginSidebarBtn';
loginLi.className = 'sidebar-nav-item';
loginLi.style.setProperty('--sidebar-item-icon', '#00dc82');
loginLi.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i><a href="#" data-i18n="nav.login">\u062A\u0633\u062C\u064A\u0644\u0020\u0627\u0644\u062F\u062E\u0648\u0644</a>';
bindSidebarNavItem(loginLi, '#/login', 'login');
ul.appendChild(loginLi);
sidebar.appendChild(ul);
try { applyAuthUi(window.__AUTH_LAST_USER__ || null); } catch {}
try { syncWalletTreeSidebarUi(window.__AUTH_LAST_USER__ || null); } catch {}

try {
  sidebarTop.querySelectorAll('.sidebar-lang-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      try {
        const code = String(btn.getAttribute('data-lang-code') || '').trim().toLowerCase();
        if (!code) return;
        if (window.__I18N__ && typeof window.__I18N__.setLang === 'function') {
          window.__I18N__.setLang(code);
          return;
        }
      } catch {}
    });
  });
} catch {}

try {
  const quickFav = sidebarTop.querySelector('#sidebarQuickFav') || document.getElementById('sidebarQuickFav');
  if (quickFav) quickFav.addEventListener('click', () => { try { navigateHomeHash('#/favorites','favorites'); } catch {} });
  const quickAccount = sidebarTop.querySelector('#sidebarQuickAccount') || document.getElementById('sidebarQuickAccount');
  if (quickAccount) quickAccount.addEventListener('click', () => {
    try {
      if (isSidebarLoggedIn()) navigateHomeHash('#/settings','settings');
      else navigateHomeHash('#/login','login');
    } catch {}
  });
  const quickAuth = sidebarTop.querySelector('#sidebarQuickAuth') || document.getElementById('sidebarQuickAuth');
  if (quickAuth) quickAuth.addEventListener('click', () => {
    try {
      if (isSidebarLoggedIn()) {
        showPageLoader();
        performClientLogout();
      } else {
        navigateHomeHash('#/login','login');
      }
    } catch {}
  });
} catch {}

try {
  const currencyTrigger = sidebarTop.querySelector('#sidebarCurrencyTrigger') || document.getElementById('sidebarCurrencyTrigger');
  if (currencyTrigger) {
    currencyTrigger.addEventListener('click', (ev) => {
      try { ev.preventDefault(); ev.stopPropagation(); } catch {}
      const menu = sidebarTop.querySelector('#sidebarCurrencyMenu') || document.getElementById('sidebarCurrencyMenu');
      if (!menu) return;
      const open = menu.classList.contains('open');
      if (open) {
        closeSidebarCurrencyMenu();
      } else {
        rebuildSidebarCurrencyMenu();
        menu.classList.add('open');
        currencyTrigger.setAttribute('aria-expanded', 'true');
      }
    });
  }
  document.addEventListener('click', (ev) => {
    try {
      const wrap = sidebarTop.querySelector('#sidebarCurrencyWrap') || document.getElementById('sidebarCurrencyWrap');
      if (!wrap) return;
      if (wrap.contains(ev.target)) return;
      closeSidebarCurrencyMenu();
    } catch {}
  }, true);
  document.addEventListener('keydown', (ev) => {
    try { if (ev.key === 'Escape') closeSidebarCurrencyMenu(); } catch {}
  });
} catch {}

try { window.addEventListener('language:change', syncSidebarLanguageButtons); } catch {}
try { window.addEventListener('currency:change', syncSidebarCurrencyLabel); } catch {}
try { window.addEventListener('currency:ready', () => { rebuildSidebarCurrencyMenu(); syncSidebarCurrencyLabel(); }); } catch {}
try { window.addEventListener('currency:rates:change', rebuildSidebarCurrencyMenu); } catch {}
try {
  window.addEventListener('balance:change', (ev) => {
    try {
      const formatted = String((ev && ev.detail && ev.detail.formatted) || '').trim();
      if (formatted) {
        setSidebarBalanceText(formatted);
      } else {
        syncSidebarBalanceFromHeader();
      }
    } catch {}
  });
} catch {}
try { applySidebarIdentity(null); } catch {}
try { syncSidebarLanguageButtons(); } catch {}
try { syncSidebarCurrencyLabel(); } catch {}
try { syncSidebarBalanceFromHeader(); } catch {}

function resolveHeaderExtraGapPx() {
  try {
    if (window.matchMedia && window.matchMedia('(max-width: 600px)').matches) return 14;
  } catch {}
  return 18;
}

function syncAppHeaderOffset() {
  if (SKIP_HEADER) return;
  try {
    const headerHeight = Math.max(
      0,
      Math.ceil(Number(header?.getBoundingClientRect?.().height) || 0),
      Math.ceil(Number(header?.offsetHeight) || 0),
      70
    );
    const headerGap = resolveHeaderExtraGapPx();
    const headerOffset = headerHeight + headerGap;
    const rootStyle = document.documentElement && document.documentElement.style;
    if (!rootStyle) return;
    rootStyle.setProperty('--app-header-height', `${headerHeight}px`);
    rootStyle.setProperty('--app-header-gap', `${headerGap}px`);
    rootStyle.setProperty('--app-header-offset', `${headerOffset}px`);
  } catch {}
}

// Attach to containers
window.addEventListener('DOMContentLoaded', () => {
  if (SKIP_HEADER) {
    try { if (window.__I18N__ && typeof window.__I18N__.applyTranslations === 'function') window.__I18N__.applyTranslations(document); } catch {}
    return;
  }
  const hc = document.getElementById('headerContainer'); if (hc) hc.appendChild(header);
  const sc = document.getElementById('sidebarContainer'); if (sc) sc.appendChild(sidebar);
  document.addEventListener('click', (e)=>{ const a = e.target.closest ? e.target.closest('a[href$=".html"]') : null; if (a) { try { sessionStorage.setItem('nav:fromHome','1'); } catch {} } });
  // Ensure support anchor exists for sidebar link
  try { const sec = document.querySelector('section.support-section'); if (sec && !sec.id) sec.id = 'support'; } catch {}
  try { if (window.__I18N__ && typeof window.__I18N__.applyTranslations === 'function') window.__I18N__.applyTranslations(document); } catch {}

  // Re-apply auth state after sidebar/header are attached (handles early auth events).
  try {
    let user = (window.__AUTH_LAST_USER__ != null)
      ? window.__AUTH_LAST_USER__
      : (typeof firebase !== 'undefined' && firebase.auth ? firebase.auth().currentUser : null);
    if (!user) user = buildFallbackUserFromPayload(readPostLoginPayload());
    if (typeof window.__applyAuthUi === 'function') window.__applyAuthUi(user);
  } catch {}
  try { syncSidebarLanguageButtons(); } catch {}
  try { rebuildSidebarCurrencyMenu(); } catch {}
  try { syncSidebarCurrencyLabel(); } catch {}
  try { syncSidebarBalanceFromHeader(); } catch {}
  try { syncAppHeaderOffset(); } catch {}
  try {
    requestAnimationFrame(() => {
      try { syncAppHeaderOffset(); } catch {}
    });
  } catch {}
  try {
    setTimeout(() => {
      try { syncAppHeaderOffset(); } catch {}
    }, 120);
  } catch {}
  try {
    if (typeof ResizeObserver !== 'undefined') {
      const headerResizeObserver = new ResizeObserver(() => {
        try { syncAppHeaderOffset(); } catch {}
      });
      headerResizeObserver.observe(header);
    }
  } catch {}
});
try { window.addEventListener('resize', syncAppHeaderOffset); } catch {}
try { window.addEventListener('pageshow', syncAppHeaderOffset); } catch {}
try { window.__syncAppHeaderOffset = syncAppHeaderOffset; } catch {}

// محاولة استعادة جلسة Firebase من بيانات مخزنة (postLoginPayload)
const POST_LOGIN_STORAGE_KEY = 'postLoginPayload';
const TRANSIENT_AUTH_PREFIX = '__SITE_AUTH__:';
const CATALOG_ROUTER_DEFAULT = (function(){
  try {
    if (window.__getSiteWorkerBaseDefault) {
      return window.__getSiteWorkerBaseDefault({ trailingSlash: true });
    }
  } catch {}
  try {
    return String(location.origin || '').replace(/\/+$/, '') + '/';
  } catch {}
  return '/';
})();
let __AUTH_RESTORE_ATTEMPTED__ = false;
let __AUTH_RESTORE_PROMISE__ = null;
let __AUTH_PERSISTENCE_READY__ = false;
let __AUTH_PERSISTENCE_PROMISE__ = null;

function readPostLoginPayload(){
  try {
    const raw = localStorage.getItem(POST_LOGIN_STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data && typeof data === 'object') return data;
    }
  } catch {}
  try {
    if (window.__POST_LOGIN_PAYLOAD__ && typeof window.__POST_LOGIN_PAYLOAD__ === 'object') {
      return window.__POST_LOGIN_PAYLOAD__;
    }
  } catch {}
  // Fallback: same-tab transfer via window.name (file:// safe)
  try {
    if (typeof window.name === 'string' && window.name.startsWith(TRANSIENT_AUTH_PREFIX)) {
      const json = window.name.slice(TRANSIENT_AUTH_PREFIX.length);
      const data = JSON.parse(json);
      if (data && typeof data === 'object') {
        try { localStorage.setItem(POST_LOGIN_STORAGE_KEY, JSON.stringify(data)); } catch {}
        try { window.__POST_LOGIN_PAYLOAD__ = data; } catch {}
        try { window.name = ''; } catch {}
        return data;
      }
    }
  } catch {}
  return null;
}
function writePostLoginPayload(payload){
  try {
    const data = { ...(payload || {}), ts: Date.now() };
    localStorage.setItem(POST_LOGIN_STORAGE_KEY, JSON.stringify(data));
    try { window.name = TRANSIENT_AUTH_PREFIX + JSON.stringify(data); } catch {}
    try { window.__POST_LOGIN_PAYLOAD__ = data; } catch {}
  } catch {}
}
function base64UrlDecode(input){
  try {
    let str = String(input || '').replace(/-/g, '+').replace(/_/g, '/');
    const pad = str.length % 4;
    if (pad) str += '='.repeat(4 - pad);
    return atob(str);
  } catch { return ''; }
}
function decodeJwtPayload(token){
  const parts = String(token || '').split('.');
  if (parts.length < 2) return null;
  try {
    const json = base64UrlDecode(parts[1]);
    return json ? JSON.parse(json) : null;
  } catch { return null; }
}
function isJwtUsable(token, leewaySec = 60){
  const payload = decodeJwtPayload(token);
  if (!payload || !payload.exp) return true;
  const expMs = Number(payload.exp) * 1000;
  if (!Number.isFinite(expMs)) return true;
  return expMs - Date.now() > (Number(leewaySec) || 0) * 1000;
}
function buildFallbackUserFromPayload(payload){
  if (!payload) return null;
  const idToken = payload.token || payload.idToken || '';
  const hasSession = !!(payload.sessionKey || payload.session_key);
  const hasAuthKey = !!(payload.authkey || payload.authKey);
  const accountNo = normalizeAccountNoValue(payload.accountNo ?? payload.account_no ?? payload.rank);
  const decoded = idToken ? (decodeJwtPayload(idToken) || {}) : {};
  const displayName = payload.displayName || payload.name || payload.username || decoded.name || '';
  const uid = payload.uid || decoded.user_id || decoded.sub || '';
  if (!uid) return null;
  if (idToken && isJwtUsable(idToken, 30)) {
    return {
      uid,
      email: payload.email || decoded.email || '',
      displayName,
      name: displayName,
      username: payload.username || '',
      photoURL: payload.photoURL || decoded.picture || '',
      accountNo: accountNo || undefined,
      isFallback: true,
      getIdToken: async () => idToken
    };
  }
  if (!hasSession && !hasAuthKey) return null;
  return {
    uid,
    email: payload.email || '',
    displayName,
    name: displayName,
    username: payload.username || '',
    photoURL: payload.photoURL || '',
    accountNo: accountNo || undefined,
    isFallback: true,
    getIdToken: async () => ''
  };
}
function getCatalogRouterBase(){
  try {
    if (window.__getSiteWorkerBase) {
      const base = window.__getSiteWorkerBase({ trailingSlash: true });
      if (base) return base;
    }
  } catch {}
  return CATALOG_ROUTER_DEFAULT;
}
function buildCatalogAuthUrl(){
  const base = getCatalogRouterBase();
  try {
    const url = new URL(base);
    if (!url.searchParams.has('action')) url.searchParams.set('action','auth');
    return url.toString();
  } catch { return CATALOG_ROUTER_DEFAULT + '?action=auth'; }
}
function writeSessionInfo(uid, sessionKey, ttlSeconds, deviceId){
  if (!uid || !sessionKey) return;
  try {
    const payload = {
      uid,
      sessionKey,
      ts: Date.now(),
      ttlSeconds: Number(ttlSeconds) || 0
    };
    if (deviceId) payload.deviceId = deviceId;
    if (deviceId) {
      try { localStorage.setItem(DEVICE_ID_STORAGE_KEY, String(deviceId)); } catch {}
    }
    localStorage.setItem('sessionKeyInfo', JSON.stringify(payload));
  } catch {}
}
async function ensureFirebaseAuthPersistenceLocal(){
  if (__AUTH_PERSISTENCE_READY__) return true;
  if (__AUTH_PERSISTENCE_PROMISE__) return __AUTH_PERSISTENCE_PROMISE__;
  __AUTH_PERSISTENCE_PROMISE__ = (async () => {
    try {
      await initFirebaseApp();
      if (typeof firebase === 'undefined' || !firebase.auth) {
        __AUTH_PERSISTENCE_READY__ = true;
        return true;
      }
      const auth = firebase.auth();
      if (!auth || typeof auth.setPersistence !== 'function') {
        __AUTH_PERSISTENCE_READY__ = true;
        return true;
      }
      const persistence = firebase?.auth?.Auth?.Persistence?.LOCAL || null;
      if (!persistence) {
        __AUTH_PERSISTENCE_READY__ = true;
        return true;
      }
      await auth.setPersistence(persistence);
      __AUTH_PERSISTENCE_READY__ = true;
      return true;
    } catch {
      return false;
    }
  })().finally(() => { __AUTH_PERSISTENCE_PROMISE__ = null; });
  return __AUTH_PERSISTENCE_PROMISE__;
}
async function syncCatalogAuthFromToken(idToken, payload){
  if (!idToken) return null;
  let sessionKey = "";
  let sessionUid = "";
  let deviceId = "";
  try {
    const cached = JSON.parse(localStorage.getItem('sessionKeyInfo') || 'null');
    if (cached && typeof cached === 'object') {
      sessionKey = String(cached.sessionKey || "");
      sessionUid = String(cached.uid || cached.useruid || "");
      deviceId = String(cached.deviceId || "");
    }
  } catch {}
  if (payload?.sessionKey) sessionKey = String(payload.sessionKey || "");
  if (payload?.uid) sessionUid = String(payload.uid || "");
  if (payload?.deviceId) deviceId = String(payload.deviceId || "");
  const emailHint = String(payload?.email || "").trim();
  const body = {
    action: 'sync',
    idToken: String(idToken || ''),
    ...(sessionUid ? { uid: sessionUid } : {}),
    ...(emailHint ? { email: emailHint } : {}),
    deviceId: deviceId || getDeviceFingerprint(),
    deviceInfo: collectDeviceInfo()
  };
  if (sessionKey) body.sessionKey = sessionKey;
  if (payload?.username) body.username = String(payload.username || '');
  if (payload?.displayName || payload?.name) body.displayName = String(payload.displayName || payload.name || '');
  if (payload?.photoURL) body.photoURL = String(payload.photoURL || '');
  try {
    const res = await fetch(buildCatalogAuthUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.success === false || data?.ok === false) return null;
    const nextSessionKey = String(data.sessionKey || sessionKey || '').trim();
    const nextDeviceId = String(data.deviceId || body.deviceId || '').trim();
    const nextUid = String(data.uid || sessionUid || payload?.uid || '').trim();
    const authkey = String(data.authkey || data.authKey || payload?.authkey || payload?.authKey || '').trim();
    const customToken = String(data.customToken || data.custom_token || '').trim();
    const ttlSeconds = Number(data.ttlSeconds) || 0;
    if (nextUid && nextSessionKey) writeSessionInfo(nextUid, nextSessionKey, ttlSeconds, nextDeviceId);
    const nextPayload = {
      ...(payload || {}),
      uid: nextUid || (payload?.uid || ''),
      email: String(data.email || payload?.email || ''),
      token: String(idToken || payload?.token || payload?.idToken || ''),
      idToken: String(idToken || payload?.idToken || payload?.token || ''),
      sessionKey: nextSessionKey || String(payload?.sessionKey || payload?.session_key || ''),
      session_key: nextSessionKey || String(payload?.session_key || payload?.sessionKey || ''),
      deviceId: nextDeviceId || String(payload?.deviceId || ''),
      authkey: authkey || String(payload?.authkey || payload?.authKey || ''),
      authKey: authkey || String(payload?.authKey || payload?.authkey || ''),
      customToken: customToken,
      custom_token: customToken || String(payload?.custom_token || payload?.customToken || ''),
      accountNo: normalizeAccountNoValue(data.accountNo ?? payload?.accountNo ?? payload?.account_no ?? payload?.rank),
      displayName: String(payload?.displayName || payload?.name || ''),
      name: String(payload?.name || payload?.displayName || ''),
      username: String(payload?.username || ''),
      photoURL: String(payload?.photoURL || '')
    };
    writePostLoginPayload(nextPayload);
    return { sessionKey: nextSessionKey, uid: nextUid, authkey, customToken, payload: nextPayload };
  } catch {
    return null;
  }
}
async function tryRestoreAuthFromPostLogin(){
  if (__AUTH_RESTORE_PROMISE__) return __AUTH_RESTORE_PROMISE__;
  if (__AUTH_RESTORE_ATTEMPTED__) return null;
  __AUTH_RESTORE_ATTEMPTED__ = true;
  __AUTH_RESTORE_PROMISE__ = (async () => {
    try {
      if (typeof firebase === 'undefined' || !firebase.auth) return null;
      const auth = firebase.auth();
      if (auth.currentUser) return auth.currentUser;
      const payload = readPostLoginPayload();
      if (!payload) return null;
      await ensureFirebaseAuthPersistenceLocal();
      const customToken = payload.customToken || payload.custom_token || '';
      if (customToken && isJwtUsable(customToken, 30) && typeof auth.signInWithCustomToken === 'function') {
        try {
          await auth.signInWithCustomToken(customToken);
          return auth.currentUser || null;
        } catch (_) {}
      }
      const idToken = payload.token || payload.idToken || '';
      if (idToken && isJwtUsable(idToken, 30)) {
        const synced = await syncCatalogAuthFromToken(idToken, payload).catch(() => null);
        const freshCustomToken = String(
          synced?.customToken ||
          synced?.payload?.customToken ||
          synced?.payload?.custom_token ||
          ''
        ).trim();
        if (freshCustomToken && typeof auth.signInWithCustomToken === 'function') {
          try {
            await auth.signInWithCustomToken(freshCustomToken);
            return auth.currentUser || null;
          } catch (_) {}
        }
      }
    } catch {}
    return null;
  })().finally(() => { __AUTH_RESTORE_PROMISE__ = null; });
  return __AUTH_RESTORE_PROMISE__;
}
try { window.__ensureAuthReady = async function(){ await initFirebaseApp(); return tryRestoreAuthFromPostLogin(); }; } catch {}

try {
  (async ()=>{
    const ok = await initFirebaseApp();
    if (!ok || typeof firebase === 'undefined' || !firebase.auth) return;
    let authRestoreChecked = false;
    firebase.auth().onAuthStateChanged(async user => {
    if (!user && !authRestoreChecked) {
      authRestoreChecked = true;
      const restored = await tryRestoreAuthFromPostLogin();
      if (restored) return;
    }
    clearSessionDocWatcher();
    sessionConflictHandled = false;
    bannedSessionHandled = false;
    if (typeof unsubscribeBalance === 'function') { try { unsubscribeBalance(); } catch (err) { console.warn('unsubscribeBalance error:', err); } unsubscribeBalance = null; }

    try {
      const displayUser = user || buildFallbackUserFromPayload(readPostLoginPayload());
      if (typeof window.__applyAuthUi === 'function') window.__applyAuthUi(displayUser);
    } catch {}

    if (user) {
      watchSessionDocForDevice(user);
      try { localStorage.setItem(LAST_UID_KEY, user.uid); } catch {}
      const cached = readCachedBalance(user.uid); if (cached != null) { try { window.__BAL_BASE__ = cached; } catch {}; setHeaderBalanceAmount(cached); broadcastBalance(cached); }
      const docRef = firebase.firestore().collection('users').doc(user.uid);
      const handleBalanceSnap = (snap) => {
        if (snap && snap.exists) {
          const data = snap.data() || {};
          const docDisplayName = String(data.displayName || data.name || data.username || user.displayName || user.email || '').trim();
          const docPhotoURL = String(data.photoURL || data.photoUrl || user.photoURL || '').trim();
          const docEmail = String(data.email || user.email || '').trim();
          const profilePayload = {
            displayName: docDisplayName,
            name: docDisplayName,
            username: String(data.username || '').trim(),
            email: docEmail,
            photoURL: docPhotoURL,
            level: String(data.level || '').trim(),
            levelId: data.levelId ?? data.level_id ?? null,
            levelNo: data.levelNo ?? data.level_no ?? null
          };
          try { writeCachedProfile(user.uid, profilePayload); } catch {}
          const accountNo = normalizeAccountNoValue(data.accountNo ?? data.account_no ?? data.rank);
          const sidebarIdentity = { ...(user || {}), ...profilePayload, ...(accountNo ? { accountNo } : {}) };
          if (accountNo) {
            try { localStorage.setItem(LAST_ACCOUNT_NO_KEY, String(accountNo)); } catch {}
            try {
              const payload = readPostLoginPayload();
              if (payload) {
                writePostLoginPayload({
                  ...payload,
                  accountNo,
                  ...(profilePayload.displayName ? { displayName: profilePayload.displayName, name: profilePayload.displayName } : {}),
                  ...(profilePayload.username ? { username: profilePayload.username } : {}),
                  ...(profilePayload.email ? { email: profilePayload.email } : {}),
                  ...(profilePayload.photoURL ? { photoURL: profilePayload.photoURL } : {})
                });
              }
            } catch {}
          } else {
            try {
              const payload = readPostLoginPayload();
              if (payload) {
                writePostLoginPayload({
                  ...payload,
                  ...(profilePayload.displayName ? { displayName: profilePayload.displayName, name: profilePayload.displayName } : {}),
                  ...(profilePayload.username ? { username: profilePayload.username } : {}),
                  ...(profilePayload.email ? { email: profilePayload.email } : {}),
                  ...(profilePayload.photoURL ? { photoURL: profilePayload.photoURL } : {})
                });
              }
            } catch {}
          }
          const apiEnabled = resolveApiAccessEnabled(data);
          writeApiAccessCache(user.uid, apiEnabled);
          try {
            if (typeof window.__applyAuthUi === 'function') window.__applyAuthUi(sidebarIdentity);
            else applyAuthUi(sidebarIdentity);
          } catch {}
          setApiSidebarVisibility(apiEnabled === true);
          if (data.isBanned === true) { handleBannedAccount(data.banReason, data.webuid || data.webUid || user.uid || ""); return; }
          const raw = data.balance ?? 0; const num = Number(raw); const val = Number.isFinite(num) ? num : 0;
          renderHeaderLevelBadge(data);
          try { window.__BAL_BASE__ = val; } catch {}
          setHeaderBalanceAmount(val);
          writeCachedBalance(user.uid, val); broadcastBalance(val);
        } else {
          try { localStorage.removeItem(LAST_ACCOUNT_NO_KEY); } catch {}
          writeApiAccessCache(user.uid, false);
          try {
            if (typeof window.__applyAuthUi === 'function') window.__applyAuthUi(user || null);
            else applyAuthUi(user || null);
          } catch {}
          setApiSidebarVisibility(false);
          renderHeaderLevelBadge(null);
          try { window.__BAL_BASE__ = 0; } catch {};
          setHeaderBalanceAmount(0);
          writeCachedBalance(user.uid, 0); broadcastBalance(0);
        }
      };
      if (shouldEnableRealtime('balance')) {
        unsubscribeBalance = docRef.onSnapshot(handleBalanceSnap, err => {
          console.error('Balance listener error:', err);
          setHeaderBalance('تعذر التحميل');
        });
      } else {
        docRef.get().then(handleBalanceSnap).catch(err => {
          console.error('Balance fetch error:', err);
          setHeaderBalance('تعذر التحميل');
        });
      }
    } else {
      try {
        if (typeof window.__applyAuthUi === 'function') window.__applyAuthUi(null);
        else applyAuthUi(null);
      } catch {}
      setApiSidebarVisibility(false);
      renderHeaderLevelBadge(null);
      setHeaderBalanceAmount(0);
      broadcastBalance(0);
    }
    try { window.__LOGOUT_IN_PROGRESS__ = false; } catch {}
    });
  })();
} catch {}

window.addEventListener('beforeunload', () => { if (typeof unsubscribeBalance === 'function') { try { unsubscribeBalance(); } catch {} } });

// Optional: mobile bottom dock (not auto-run)
function initMobileDock(){
  try {
    try { const hasFA = !!document.querySelector('link[href*="font-awesome"], link[href*="fontawesome"], link[href*="/fa"], link[href*="/all.min.css"]'); if (!hasFA) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css'; l.crossOrigin = 'anonymous'; document.head.appendChild(l); } } catch {}
    const dock = document.createElement('nav'); dock.className = 'mobile-dock'; dock.setAttribute('aria-label','الشريط السفلي للجوال');
    const makeItem = (html, key, href) => { if (href) { const a = document.createElement('a'); a.href = href; a.innerHTML = html; a.className = 'dock-item'; a.dataset.key = key; return a; } else { const b = document.createElement('button'); b.type = 'button'; b.innerHTML = html; b.className = 'dock-item'; b.dataset.key = key; return b; } };
    const wallet = makeItem('<i class="fa-solid fa-wallet" aria-hidden="true"></i>', 'wallet', 'index.html#/wallet'); wallet.setAttribute('aria-label','محفظتي');
    const store  = makeItem('<i class="fa-solid fa-cart-shopping" aria-hidden="true"></i>', 'store', 'index.html#/games'); store.setAttribute('aria-label','المتجر/الألعاب');
    const orders = makeItem('<i class="fa-solid fa-list" aria-hidden="true"></i>', 'orders', 'index.html#/orders'); orders.setAttribute('aria-label','طلباتي');
    const deposit= makeItem('<i class="fa-solid fa-circle-dollar-to-slot" aria-hidden="true"></i>', 'deposit', 'index.html#/deposit'); deposit.setAttribute('aria-label','شحن الرصيد');
    const home   = makeItem('<i class="fa-solid fa-house" aria-hidden="true"></i>', 'home', 'index.html#/'); home.setAttribute('aria-label','الرئيسية');
    dock.appendChild(wallet); dock.appendChild(store); dock.appendChild(orders); dock.appendChild(deposit); dock.appendChild(home);
    window.addEventListener('DOMContentLoaded', () => { try { document.body.appendChild(dock); document.body.classList.add('mobile-has-dock'); } catch {} });
    wallet.addEventListener('click', () => { try { sessionStorage.setItem('nav:fromHome','1'); showPageLoader(); } catch {} });
    home.addEventListener('click', (ev) => {
      try { if (ev) ev.preventDefault(); } catch {}
      try { navigateHomeHash('#/'); } catch {}
    });
    function updateActive(){
      try {
        const file = (location.pathname.split('/').pop() || '').toLowerCase();
        const hash = (location.hash || '').toLowerCase();
        const storePages = new Set(['games.html']);
        let key = 'home';
        if (hash === '#/wallet') key = 'wallet';
        else if (hash === '#/orders') key = 'orders';
        else if (hash === '#/reviews') key = 'home';
        else if (hash === '#/deposit' || hash === '#/edaa') key = 'deposit';
        else if (file === 'wallet.html') key = 'wallet';
        else if (hash === '#/games') key = 'store';
        else if (file === 'index.html') key = 'home';
        else if (file === 'talabat.html') key = 'orders';
        else if (file === 'edaa.html') key = 'deposit';
        else if (storePages.has(file)) key = 'store';
        dock.querySelectorAll('.dock-item').forEach(el => el.classList.remove('active'));
        if (key){
          const a = dock.querySelector(`.dock-item[data-key="${key}"]`);
          if (a) a.classList.add('active');
        }
      } catch {}
    }
    window.addEventListener('DOMContentLoaded', updateActive); window.addEventListener('pageshow', updateActive);
  } catch {}
}

// Page balance box wiring
function wirePageBalanceBox(){
  function setBox(val){
    try {
      const el = document.getElementById('balanceAmount');
      if (!el) return;
      if (val == null || !Number.isFinite(Number(val))) {
        el.textContent = 'يجب تسجيل الدخول اولا';
      } else {
        if (typeof window.formatCurrencyFromJOD === 'function') el.textContent = window.formatCurrencyFromJOD(val);
        else el.textContent = Number(val).toFixed(3) + ' $';
      }
    } catch {}
  }
  try {
    const logged = localStorage.getItem('auth:lastLoggedIn') === '1';
    const uid = localStorage.getItem('auth:lastUid');
    if (logged && uid){
      const cached = (function(){ try { const s = localStorage.getItem('balance:cache:' + uid); const n = Number(s); return Number.isFinite(n) ? n : null; } catch { return null; } })();
      if (cached != null) setBox(cached);
    }
  } catch {}
  try { window.addEventListener('balance:change', ev => { setBox(ev?.detail?.value ?? null); }); } catch {}
  try { window.addEventListener('currency:change', () => { try { setBox(window.__BAL_BASE__ ?? null); } catch {} }); } catch {}
}

// Support/contact section (customizable contacts + links)
(function(){
  try {
    const KNOWN_ICON_URLS = {
      whatsapp: 'https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg',
      telegram: 'https://upload.wikimedia.org/wikipedia/commons/8/82/Telegram_logo.svg',
      facebook: 'https://upload.wikimedia.org/wikipedia/commons/5/51/Facebook_f_logo_%282019%29.svg',
      email: 'https://upload.wikimedia.org/wikipedia/commons/4/4e/Gmail_Icon.png',
      instagram: 'https://upload.wikimedia.org/wikipedia/commons/a/a5/Instagram_icon.png'
    };

    function normalizeKey(value, fallback){
      const raw = String(value == null ? '' : value).trim().toLowerCase();
      const safe = raw.replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
      return safe || fallback || 'link';
    }

    function normalizeHref(value){
      const raw = String(value == null ? '' : value).trim();
      if (!raw) return '';
      if (/^(https?:|mailto:|tel:|tg:|whatsapp:)/i.test(raw)) return raw;
      if (/^[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}$/i.test(raw)) return 'mailto:' + raw;
      if (/^\+?\d{6,20}$/.test(raw.replace(/\s+/g, ''))) return 'tel:' + raw.replace(/\s+/g, '');
      if (/^@[\w.]+$/.test(raw)) return 'https://t.me/' + raw.slice(1);
      if (!/\s/.test(raw) && /^(?:www\.|[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+(?:[/?#]|$))/i.test(raw)) {
        return 'https://' + raw;
      }
      return raw;
    }

    const SUPPORT_BADGE_ICONS = {
      group: 'fa-solid fa-user-group',
      person: 'fa-solid fa-user',
      support: 'fa-solid fa-headset',
      chat: 'fa-solid fa-comment-dots',
      community: 'fa-solid fa-users',
      forum: 'fa-solid fa-comments',
      helpdesk: 'fa-solid fa-life-ring',
      call: 'fa-solid fa-phone',
      question: 'fa-solid fa-circle-question',
      star: 'fa-solid fa-star'
    };

    function normalizeBadgeType(value){
      const raw = String(value == null ? '' : value).trim().toLowerCase();
      if (!raw) return 'auto';
      const map = {
        auto: 'auto',
        automatic: 'auto',
        default: 'auto',
        number: 'number',
        num: 'number',
        numeric: 'number',
        digit: 'number',
        digits: 'number',
        group: 'group',
        team: 'group',
        users: 'group',
        channel: 'group',
        person: 'person',
        user: 'person',
        individual: 'person',
        support: 'support',
        help: 'support',
        headset: 'support',
        chat: 'chat',
        message: 'chat',
        conversation: 'chat',
        community: 'community',
        members: 'community',
        forum: 'forum',
        discussion: 'forum',
        discussions: 'forum',
        helpdesk: 'helpdesk',
        'help-desk': 'helpdesk',
        'helpdesk-center': 'helpdesk',
        call: 'call',
        phone: 'call',
        hotline: 'call',
        question: 'question',
        faq: 'question',
        inquiry: 'question',
        star: 'star',
        vip: 'star',
        custom: 'custom',
        text: 'custom',
        label: 'custom'
      };
      return map[raw] || 'auto';
    }

    function normalizeBadgeText(value, type){
      const text = String(value == null ? '' : value).trim();
      const normalizedType = normalizeBadgeType(type);
      if (normalizedType === 'number') {
        return text.replace(/[^\d]/g, '').slice(0, 4);
      }
      if (normalizedType === 'custom') {
        return text.slice(0, 12);
      }
      return '';
    }

    function normalizeContactEntry(raw, index){
      if (!raw || typeof raw !== 'object') return null;
      const fallbackKey = 'contact-' + String(index || 0);
      const key = normalizeKey(raw.key || raw.id || raw.slug || raw.name || raw.label || '', fallbackKey);
      const className = normalizeKey(raw.className || raw.class || raw.cssClass || key, key);
      const href = normalizeHref(raw.href || raw.url || raw.link || raw.value || '');
      const iconURL = String(raw.iconURL || raw.iconUrl || raw.icon || raw.image || KNOWN_ICON_URLS[key] || '').trim();
      const iconClass = String(raw.iconClass || raw.fa || '').trim();
      const label = String(raw.label || raw.name || key).trim();
      const badgeType = normalizeBadgeType(raw.badgeType || raw.badge_type || (raw.badge && raw.badge.type) || '');
      const badgeText = normalizeBadgeText(
        raw.badgeText || raw.badge_text || raw.badgeValue || raw.badge_value || (raw.badge && (raw.badge.text || raw.badge.value || raw.badge.label)) || '',
        badgeType
      );
      return { key, className, href, iconURL, iconClass, label, badgeType, badgeText };
    }

    function appendSupportEntries(out, key, value, index){
      if (value == null) return;
      if (Array.isArray(value)) {
        value.forEach((item, itemIndex) => {
          if (item == null) return;
          const entry = (item && typeof item === 'object' && !Array.isArray(item))
            ? Object.assign({}, item, { key })
            : { key, href: item };
          const normalized = normalizeContactEntry(entry, (index * 10) + itemIndex);
          if (normalized) out.push(normalized);
        });
        return;
      }
      const entry = (value && typeof value === 'object')
        ? Object.assign({}, value, { key })
        : { key, href: value };
      const normalized = normalizeContactEntry(entry, index);
      if (normalized) out.push(normalized);
    }

    function normalizeSupportContacts(raw){
      let source = raw;
      if (source && typeof source === 'object' && !Array.isArray(source)) {
        if (Array.isArray(source.contacts)) source = source.contacts;
        else if (Array.isArray(source.items)) source = source.items;
        else if (Array.isArray(source.list)) source = source.list;
      }

      const out = [];
      if (Array.isArray(source)) {
        source.forEach((item, idx) => {
          const normalized = normalizeContactEntry(item, idx);
          if (normalized) out.push(normalized);
        });
      } else if (source && typeof source === 'object') {
        Object.keys(source).forEach((key, idx) => {
          appendSupportEntries(out, key, source[key], idx);
        });
      }

      const dedupe = new Set();
      const unique = [];
      out.forEach((item) => {
        if (!item || !item.key || !item.href) return;
        const dedupeKey = String(item.key) + '|' + String(item.href);
        if (dedupe.has(dedupeKey)) return;
        dedupe.add(dedupeKey);
        unique.push(item);
      });

      return unique;
    }

    const section = document.createElement('section');
    section.className = 'support-section';
    section.id = 'support';
    section.setAttribute('aria-label', '\u0637\u0631\u0642\u0020\u0627\u0644\u062A\u0648\u0627\u0635\u0644');
    const iconsDiv = document.createElement('div');
    iconsDiv.className = 'support-icons';
    section.appendChild(iconsDiv);
    let supportMountScheduled = false;
    const floatingWidget = document.createElement('div');
    floatingWidget.id = 'supportFloatingWidget';
    floatingWidget.className = 'support-dock';
    floatingWidget.hidden = true;
    floatingWidget.setAttribute('data-i18n-ignore', 'true');
    floatingWidget.innerHTML = `
      <div class="support-dock__items" id="supportFloatingWidgetItems" aria-hidden="true"></div>
      <button
        type="button"
        class="support-dock__toggle"
        id="supportFloatingWidgetToggle"
        aria-controls="supportFloatingWidgetItems"
        aria-expanded="false"
        aria-label="فتح طرق التواصل مع الدعم"
      >
        <span class="support-dock__mark support-dock__mark--menu" aria-hidden="true">
          <span></span>
          <span></span>
          <span></span>
        </span>
        <span class="support-dock__mark support-dock__mark--close" aria-hidden="true">
          <span></span>
          <span></span>
        </span>
      </button>
    `;
    const floatingItems = floatingWidget.querySelector('.support-dock__items');
    const floatingToggle = floatingWidget.querySelector('.support-dock__toggle');
    let floatingOpen = false;
    let floatingMountScheduled = false;

    function buildTelegramAppHref(href){
      try {
        const parsed = new URL(String(href || '').trim());
        const handle = String(parsed.pathname || '').replace(/^\/+/, '').split('/')[0];
        if (!handle) return String(href || '').trim();
        const parts = ['domain=' + encodeURIComponent(handle)];
        const start = parsed.searchParams.get('start');
        if (start) parts.push('start=' + encodeURIComponent(start));
        const startGroup = parsed.searchParams.get('startgroup');
        if (startGroup) parts.push('startgroup=' + encodeURIComponent(startGroup));
        return 'tg://resolve?' + parts.join('&');
      } catch(_){
        return String(href || '').trim();
      }
    }

    function mountFloatingSupportWidget(){
      try {
        const host = document.body || document.documentElement;
        if (!host) return false;
        if (floatingWidget.parentElement !== host) host.appendChild(floatingWidget);
        return true;
      } catch(_){
        return false;
      }
    }

    function queueFloatingSupportMount(){
      if (floatingMountScheduled) return;
      floatingMountScheduled = true;
      const attempt = function(){
        floatingMountScheduled = false;
        if (!mountFloatingSupportWidget() && document.readyState === 'loading') {
          queueFloatingSupportMount();
        }
      };
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', attempt, { once: true });
      } else {
        setTimeout(attempt, 0);
      }
    }

    function updateFloatingSupportTabState(){
      try {
        if (!floatingItems) return;
        floatingItems.setAttribute('aria-hidden', floatingOpen ? 'false' : 'true');
        floatingItems.querySelectorAll('a.support-dock__link').forEach((link) => {
          if (!floatingOpen) {
            link.setAttribute('tabindex', '-1');
            return;
          }
          link.removeAttribute('tabindex');
        });
      } catch(_){}
    }

    function setFloatingSupportOpen(nextOpen){
      const hasItems = !!(floatingItems && floatingItems.children && floatingItems.children.length);
      const previousOpen = floatingOpen;
      floatingOpen = !!nextOpen && hasItems && !floatingWidget.hidden;
      try {
        if (previousOpen !== floatingOpen) floatingWidget.classList.add('is-animated');
        floatingWidget.classList.toggle('is-open', floatingOpen);
        floatingToggle.setAttribute('aria-expanded', floatingOpen ? 'true' : 'false');
        floatingToggle.setAttribute(
          'aria-label',
          floatingOpen ? 'إغلاق طرق التواصل مع الدعم' : 'فتح طرق التواصل مع الدعم'
        );
      } catch(_){}
      updateFloatingSupportTabState();
    }

    function buildFloatingSupportItem(anchor, index){
      if (!anchor) return null;
      const wrapper = document.createElement('div');
      wrapper.className = 'support-dock__item';
      wrapper.style.setProperty('--support-dock-index', String(index || 0));
      const clone = document.createElement('a');
      clone.className = 'support-dock__link';
      clone.setAttribute('aria-label', String(anchor.getAttribute('aria-label') || '').trim());
      ['data-contact-key', 'data-contact-order', 'data-contact-count', 'data-contact-label'].forEach((attr) => {
        const value = anchor.getAttribute(attr);
        if (value != null) clone.setAttribute(attr, value);
      });
      const key = String(anchor.getAttribute('data-contact-key') || '').trim().toLowerCase();
      const href = String(anchor.getAttribute('href') || '').trim();
      if (!href || href === '#') {
        clone.setAttribute('href', '#');
        clone.setAttribute('aria-disabled', 'true');
        clone.removeAttribute('target');
        clone.removeAttribute('rel');
      } else {
        clone.setAttribute('href', href);
        const target = String(anchor.getAttribute('target') || '').trim();
        const rel = String(anchor.getAttribute('rel') || '').trim();
        if (target) clone.setAttribute('target', target);
        if (rel) clone.setAttribute('rel', rel);
        clone.removeAttribute('aria-disabled');
      }
      const iconNode = anchor.querySelector('img, i, svg');
      if (iconNode) {
        const iconClone = iconNode.cloneNode(true);
        if (iconClone.tagName && iconClone.tagName.toLowerCase() === 'img') {
          iconClone.setAttribute('alt', '');
          iconClone.setAttribute('aria-hidden', 'true');
        }
        clone.appendChild(iconClone);
      }
      const badgeNode = anchor.querySelector('.support-badge');
      if (badgeNode) {
        const badgeClone = badgeNode.cloneNode(true);
        badgeClone.className = 'support-dock__badge';
        clone.appendChild(badgeClone);
      }
      if (key === 'telegram' && /^https?:\/\/t\.me\//i.test(href)) {
        clone.setAttribute('data-app-href', buildTelegramAppHref(href));
      }
      wrapper.appendChild(clone);
      return wrapper;
    }

    function syncFloatingSupportWidget(){
      if (!mountFloatingSupportWidget()) queueFloatingSupportMount();
      if (!floatingItems) return;
      const anchors = Array.from(iconsDiv.querySelectorAll('a.support-icon[data-contact-key]'));
      floatingItems.innerHTML = '';
      if (!anchors.length) {
        floatingWidget.hidden = true;
        setFloatingSupportOpen(false);
        return;
      }
      anchors.forEach((anchor, index) => {
        const item = buildFloatingSupportItem(anchor, index);
        if (item) floatingItems.appendChild(item);
      });
      floatingWidget.hidden = !floatingItems.children.length;
      setFloatingSupportOpen(floatingOpen);
    }

    function mountSupportSection(){
      try {
        const sidebarHost = document.getElementById('sidebar');
        const host = sidebarHost || document.body;
        if (!host) return false;
        if (section.parentElement !== host || host.lastElementChild !== section) {
          host.appendChild(section);
        }
        return true;
      } catch(_){
        return false;
      }
    }

    function queueSupportMount(){
      if (supportMountScheduled) return;
      supportMountScheduled = true;
      const attempt = function(){
        supportMountScheduled = false;
        const mounted = mountSupportSection();
        if (!mounted && document.readyState === 'loading') queueSupportMount();
      };
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', attempt, { once: true });
      } else {
        setTimeout(attempt, 0);
      }
    }

    function renderSupportContacts(raw){
      if (!mountSupportSection()) queueSupportMount();
      const contacts = normalizeSupportContacts(raw);
      const countsByKey = Object.create(null);
      const orderByKey = Object.create(null);
      contacts.forEach((contact) => {
        const key = normalizeKey(contact && contact.key, '');
        if (!key) return;
        countsByKey[key] = (countsByKey[key] || 0) + 1;
      });
      // Keep support block visible even when contact links are empty.
      section.style.display = '';
      iconsDiv.innerHTML = '';
      contacts.forEach((contact, idx) => {
        const a = document.createElement('a');
        const key = normalizeKey(contact.key, 'contact-' + String(idx));
        const href = normalizeHref(contact.href || '');
        const label = String(contact.label || key);
        const totalForKey = countsByKey[key] || 0;
        const orderForKey = (orderByKey[key] || 0) + 1;
        orderByKey[key] = orderForKey;
        a.className = 'support-icon ' + normalizeKey(contact.className || key, key);
        a.setAttribute('data-contact-key', key);
        a.setAttribute('data-contact-label', label);
        a.setAttribute('data-contact-order', String(orderForKey));
        a.setAttribute('data-contact-count', String(totalForKey || 1));
        if (href) {
          a.href = href;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
        } else {
          a.href = '#';
          a.removeAttribute('target');
          a.removeAttribute('rel');
        }
        a.setAttribute('aria-label', totalForKey > 1 ? (label + ' ' + String(orderForKey)) : label);

        const iconURL = String(contact.iconURL || '').trim();
        if (iconURL) {
          const img = document.createElement('img');
          img.src = iconURL;
          img.alt = label + ' icon';
          img.loading = 'lazy';
          img.decoding = 'async';
          img.style.width = '32px';
          img.style.height = '32px';
          a.appendChild(img);
        } else {
          const iconClass = String(contact.iconClass || 'fa-solid fa-link').trim();
          const icon = document.createElement('i');
          icon.className = iconClass;
          icon.setAttribute('aria-hidden', 'true');
          a.appendChild(icon);
        }

        const badgeType = normalizeBadgeType(contact.badgeType || '');
        const badgeText = normalizeBadgeText(contact.badgeText || '', badgeType);
        let badgeMode = null;
        let badgeValue = '';
        if (badgeType === 'auto') {
          if (totalForKey > 1) {
            badgeMode = 'text';
            badgeValue = String(orderForKey);
          }
        } else if (badgeType === 'number') {
          badgeMode = 'text';
          badgeValue = badgeText || String(orderForKey);
        } else if (badgeType === 'custom') {
          if (badgeText) {
            badgeMode = 'text';
            badgeValue = badgeText;
          }
        } else if (SUPPORT_BADGE_ICONS[badgeType]) {
          badgeMode = 'icon';
          badgeValue = SUPPORT_BADGE_ICONS[badgeType];
        }

        if (badgeMode) {
          const badge = document.createElement('span');
          badge.className = 'support-badge';
          badge.setAttribute('data-badge-mode', badgeMode);
          if (badgeMode === 'icon') {
            const icon = document.createElement('i');
            icon.className = badgeValue;
            icon.setAttribute('aria-hidden', 'true');
            badge.appendChild(icon);
          } else {
            const badgeTextEl = document.createElement('span');
            badgeTextEl.className = 'support-badge__text';
            badgeTextEl.textContent = String(badgeValue);
            badge.appendChild(badgeTextEl);
          }
          badge.setAttribute('aria-hidden', 'true');
          a.appendChild(badge);
        }

        iconsDiv.appendChild(a);
      });

      try {
        window.__SUPPORT_CONTACTS_RENDERED__ = contacts.map((item) => Object.assign({}, item));
      } catch {}
      syncFloatingSupportWidget();
    }

    function applySupportLinksMap(map){
      if (!map || typeof map !== 'object') return;
      try {
        const exportedMap = {};
        iconsDiv.querySelectorAll('a.support-icon[data-contact-key]').forEach((a) => {
          const key = normalizeKey(a.getAttribute('data-contact-key') || '', '');
          if (!key) return;
          var totalForKey = Number(a.getAttribute('data-contact-count') || '1');
          if (Number.isFinite(totalForKey) && totalForKey > 1) return;
          const nextHref = normalizeHref(map[key]);
          if (!nextHref) return;
          a.setAttribute('href', nextHref);
          a.setAttribute('target', '_blank');
          a.setAttribute('rel', 'noopener noreferrer');
          exportedMap[key] = nextHref;
        });
        try {
          const current = (window.__SUPPORT_LINKS_MAP__ && typeof window.__SUPPORT_LINKS_MAP__ === 'object')
            ? window.__SUPPORT_LINKS_MAP__
            : {};
          window.__SUPPORT_LINKS_MAP__ = Object.assign({}, current, exportedMap);
        } catch {}
      } catch {}
      syncFloatingSupportWidget();
    }

    renderSupportContacts([]);
    if (!mountFloatingSupportWidget()) queueFloatingSupportMount();
    function moveToSidebar(){
      try{
        const sidebarHost = document.getElementById('sidebar');
        if (sidebarHost && (section.parentElement !== sidebarHost || sidebarHost.lastElementChild !== section)){
          sidebarHost.appendChild(section);
        }
      } catch(_){}
    }
    if (!mountSupportSection()) queueSupportMount();
    moveToSidebar();
    const schedule = [0, 150, 500, 1200];
    schedule.forEach((ms) => {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
          setTimeout(function(){
            mountSupportSection();
            moveToSidebar();
          }, ms);
        }, { once: ms===schedule[schedule.length-1] });
      } else {
        setTimeout(function(){
          mountSupportSection();
          moveToSidebar();
        }, ms);
      }
    });

    const style = document.createElement('style');
    style.textContent = `
      #sidebar .support-section {
        background: transparent !important;
        padding: 14px 14px 8px !important;
        border: none !important;
        box-shadow: none !important;
        overflow: visible !important;
      }
      #sidebar .support-section .support-title {
        color: #e6edff;
        font-size: 1rem;
        margin: 0 0 10px;
      }
      #sidebar .support-section .support-icons {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: center;
        justify-content: center;
        padding: 8px 10px 6px;
        overflow: visible !important;
      }
      #sidebar .support-section .support-icon {
        width: 32px;
        height: 32px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        background: transparent !important;
        box-shadow: none !important;
        padding: 0 !important;
        position: relative;
        overflow: visible !important;
      }
      #sidebar .support-section .support-icon img {
        width: 32px !important;
        height: 32px !important;
        object-fit: contain;
        object-position: center;
        display: block;
        filter: none !important;
      }
      #sidebar .support-section .support-icon i {
        font-size: 18px;
        color: #f8fafc;
      }
      #sidebar .support-section .support-icon:hover {
        transform: none;
        box-shadow: none;
      }
      #sidebar .support-section .support-rights {
        margin-top: 12px !important;
        color: #e6edff;
        font-size: 11px;
        text-align: center;
      }
      #sidebar .support-section .support-rights a {
        color: #fff !important;
        text-decoration: none;
      }
    `;
    document.head.appendChild(style);

    const floatingStyle = document.createElement('style');
    floatingStyle.textContent = `
      #supportFloatingWidget {
        --support-dock-gradient: linear-gradient(
          145deg,
          var(--site-accent-runtime-light, var(--primary-light, var(--accent-theme, #969cff))) 0%,
          var(--site-accent-runtime, var(--accent-theme, #7076eb)) 54%,
          var(--site-accent-runtime-strong, var(--primary-dark, var(--accent-theme, #4f55cd))) 100%
        );
        --support-dock-shadow:
          0 16px 28px rgba(var(--site-accent-rgb, 106, 111, 232), 0.28),
          0 8px 18px rgba(9, 14, 38, 0.16);
        position: fixed;
        left: max(12px, calc(env(safe-area-inset-left, 0px) + 12px));
        bottom: max(14px, calc(env(safe-area-inset-bottom, 0px) + 14px));
        z-index: 9300;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
        pointer-events: none;
      }
      #supportFloatingWidget .support-dock__items {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
      }
      #supportFloatingWidget .support-dock__item {
        opacity: 0;
        transform: translate3d(0, 14px, 0) scale(0.82);
        transition:
          opacity 0.18s ease,
          transform 0.28s cubic-bezier(.22, 1, .36, 1);
        transition-delay: 0s;
        will-change: transform, opacity;
        pointer-events: none;
      }
      #supportFloatingWidget.is-open .support-dock__item {
        opacity: 1;
        transform: translate3d(0, 0, 0) scale(1);
        transition-delay: calc(var(--support-dock-index, 0) * 36ms);
        pointer-events: auto;
      }
      #supportFloatingWidget .support-dock__toggle,
      #supportFloatingWidget .support-dock__link {
        pointer-events: auto;
      }
      #supportFloatingWidget .support-dock__toggle {
        width: 56px;
        height: 54px;
        padding: 0;
        border: 0;
        border-radius: 50% 50% 50% 14px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        position: relative;
        overflow: visible;
        background: var(--support-dock-gradient);
        box-shadow: var(--support-dock-shadow);
        transition:
          transform 0.18s ease,
          box-shadow 0.18s ease,
          background 0.18s ease;
      }
      #supportFloatingWidget .support-dock__toggle:hover {
        transform: translateY(-1px);
        box-shadow:
          0 16px 30px rgba(var(--site-accent-rgb, 106, 111, 232), 0.32),
          0 8px 16px rgba(9, 14, 38, 0.18);
      }
      #supportFloatingWidget .support-dock__toggle:active {
        transform: translateY(0) scale(0.98);
      }
      #supportFloatingWidget .support-dock__toggle:focus-visible {
        outline: none;
        box-shadow:
          0 0 0 3px rgba(255, 255, 255, 0.9),
          0 0 0 6px rgba(var(--site-accent-rgb, 106, 111, 232), 0.24),
          0 14px 24px rgba(var(--site-accent-rgb, 106, 111, 232), 0.28);
      }
      #supportFloatingWidget .support-dock__mark {
        position: absolute;
        inset: 0;
        pointer-events: none;
      }
      #supportFloatingWidget .support-dock__mark--menu {
        position: absolute;
        inset: 0;
      }
      #supportFloatingWidget .support-dock__mark--menu span {
        position: absolute;
        top: 50%;
        left: 50%;
        width: 6px;
        height: 6px;
        margin: -3px 0 0 -3px;
        border-radius: 999px;
        background: #ffffff;
        box-shadow: none;
        transform-origin: center;
        animation-duration: 0.34s;
        animation-timing-function: cubic-bezier(.22, .9, .32, 1);
        animation-fill-mode: both;
      }
      #supportFloatingWidget .support-dock__mark--menu span:nth-child(1) {
        transform: translate(-9px, 0) rotate(0deg);
      }
      #supportFloatingWidget .support-dock__mark--menu span:nth-child(2) {
        transform: translate(0, 0) scale(1);
        opacity: 1;
      }
      #supportFloatingWidget .support-dock__mark--menu span:nth-child(3) {
        transform: translate(9px, 0) rotate(0deg);
      }
      #supportFloatingWidget .support-dock__mark--close {
        display: none;
      }
      #supportFloatingWidget .support-dock__mark--close span {
        position: absolute;
        width: 20px;
        height: 3.5px;
        border-radius: 999px;
        background: #ffffff;
        box-shadow: none;
      }
      #supportFloatingWidget .support-dock__mark--close span:first-child {
        transform: rotate(45deg);
      }
      #supportFloatingWidget .support-dock__mark--close span:last-child {
        transform: rotate(-45deg);
      }
      #supportFloatingWidget.is-open .support-dock__mark--menu span:nth-child(1) {
        width: 20px;
        height: 4px;
        margin: -2px 0 0 -10px;
        transform: translate(0, 0) rotate(45deg);
      }
      #supportFloatingWidget.is-open .support-dock__mark--menu span:nth-child(2) {
        opacity: 0;
        transform: translate(0, 0) scale(0.18);
      }
      #supportFloatingWidget.is-open .support-dock__mark--menu span:nth-child(3) {
        width: 20px;
        height: 4px;
        margin: -2px 0 0 -10px;
        transform: translate(0, 0) rotate(-45deg);
      }
      #supportFloatingWidget.is-animated.is-open .support-dock__mark--menu span:nth-child(1) {
        animation-name: supportDockDotsToXLeft;
      }
      #supportFloatingWidget.is-animated.is-open .support-dock__mark--menu span:nth-child(2) {
        animation-name: supportDockDotsToXCenter;
      }
      #supportFloatingWidget.is-animated.is-open .support-dock__mark--menu span:nth-child(3) {
        animation-name: supportDockDotsToXRight;
      }
      #supportFloatingWidget.is-animated:not(.is-open) .support-dock__mark--menu span:nth-child(1) {
        animation-name: supportDockXToDotsLeft;
      }
      #supportFloatingWidget.is-animated:not(.is-open) .support-dock__mark--menu span:nth-child(2) {
        animation-name: supportDockXToDotsCenter;
      }
      #supportFloatingWidget.is-animated:not(.is-open) .support-dock__mark--menu span:nth-child(3) {
        animation-name: supportDockXToDotsRight;
      }
      @keyframes supportDockDotsToXLeft {
        0% {
          width: 6px;
          height: 6px;
          margin: -3px 0 0 -3px;
          opacity: 1;
          transform: translate(-9px, 0) rotate(0deg);
        }
        46% {
          width: 6px;
          height: 6px;
          margin: -3px 0 0 -3px;
          opacity: 1;
          transform: translate(0, 0) rotate(0deg);
        }
        100% {
          width: 20px;
          height: 4px;
          margin: -2px 0 0 -10px;
          opacity: 1;
          transform: translate(0, 0) rotate(45deg);
        }
      }
      @keyframes supportDockDotsToXRight {
        0% {
          width: 6px;
          height: 6px;
          margin: -3px 0 0 -3px;
          opacity: 1;
          transform: translate(9px, 0) rotate(0deg);
        }
        46% {
          width: 6px;
          height: 6px;
          margin: -3px 0 0 -3px;
          opacity: 1;
          transform: translate(0, 0) rotate(0deg);
        }
        100% {
          width: 20px;
          height: 4px;
          margin: -2px 0 0 -10px;
          opacity: 1;
          transform: translate(0, 0) rotate(-45deg);
        }
      }
      @keyframes supportDockDotsToXCenter {
        0% {
          opacity: 1;
          transform: translate(0, 0) scale(1);
        }
        55% {
          opacity: 1;
          transform: translate(0, 0) scale(1);
        }
        100% {
          opacity: 0;
          transform: translate(0, 0) scale(0.18);
        }
      }
      @keyframes supportDockXToDotsLeft {
        0% {
          width: 20px;
          height: 4px;
          margin: -2px 0 0 -10px;
          opacity: 1;
          transform: translate(0, 0) rotate(45deg);
        }
        54% {
          width: 6px;
          height: 6px;
          margin: -3px 0 0 -3px;
          opacity: 1;
          transform: translate(0, 0) rotate(0deg);
        }
        100% {
          width: 6px;
          height: 6px;
          margin: -3px 0 0 -3px;
          opacity: 1;
          transform: translate(-9px, 0) rotate(0deg);
        }
      }
      @keyframes supportDockXToDotsRight {
        0% {
          width: 20px;
          height: 4px;
          margin: -2px 0 0 -10px;
          opacity: 1;
          transform: translate(0, 0) rotate(-45deg);
        }
        54% {
          width: 6px;
          height: 6px;
          margin: -3px 0 0 -3px;
          opacity: 1;
          transform: translate(0, 0) rotate(0deg);
        }
        100% {
          width: 6px;
          height: 6px;
          margin: -3px 0 0 -3px;
          opacity: 1;
          transform: translate(9px, 0) rotate(0deg);
        }
      }
      @keyframes supportDockXToDotsCenter {
        0% {
          opacity: 0;
          transform: translate(0, 0) scale(0.18);
        }
        45% {
          opacity: 0;
          transform: translate(0, 0) scale(0.18);
        }
        100% {
          opacity: 1;
          transform: translate(0, 0) scale(1);
        }
      }
      #supportFloatingWidget .support-dock__link {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        position: relative;
        overflow: visible;
        text-decoration: none;
        border: 0;
        padding: 0;
        background: var(--support-dock-gradient) !important;
        box-shadow:
          0 12px 22px rgba(var(--site-accent-rgb, 106, 111, 232), 0.22),
          0 5px 12px rgba(9, 14, 38, 0.14);
        transition:
          transform 0.18s ease,
          box-shadow 0.18s ease;
      }
      #supportFloatingWidget .support-dock__link:hover {
        transform: translateY(-1px) scale(1.02);
        box-shadow:
          0 14px 24px rgba(var(--site-accent-rgb, 106, 111, 232), 0.26),
          0 7px 14px rgba(9, 14, 38, 0.16);
      }
      #supportFloatingWidget .support-dock__link:focus-visible {
        outline: none;
        box-shadow:
          0 0 0 3px rgba(255, 255, 255, 0.92),
          0 0 0 5px rgba(var(--site-accent-rgb, 106, 111, 232), 0.22),
          0 12px 22px rgba(var(--site-accent-rgb, 106, 111, 232), 0.22);
      }
      #supportFloatingWidget .support-dock__link img {
        width: 24px !important;
        height: 24px !important;
        max-width: 24px !important;
        max-height: 24px !important;
        object-fit: contain;
        object-position: center;
        display: block;
        filter: none !important;
      }
      #supportFloatingWidget .support-dock__link i {
        font-size: 24px;
        color: #ffffff;
      }
      #supportFloatingWidget .support-dock__badge {
        position: absolute;
        top: -6px;
        right: -8px;
        min-width: 18px;
        height: 18px;
        padding: 0 5px;
        border-radius: 999px 999px 999px 6px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: var(--support-dock-gradient) !important;
        color: #ffffff;
        border: 2px solid #ffffff;
        box-shadow: 0 4px 10px rgba(var(--site-accent-rgb, 106, 111, 232), 0.18);
        font-size: 9px;
        font-weight: 900;
        line-height: 1;
        direction: ltr;
        white-space: nowrap;
      }
      #supportFloatingWidget .support-dock__badge[data-badge-mode="icon"] {
        top: 0;
        right: 0;
        min-width: 18px;
        width: 18px;
        height: 18px;
        padding: 0;
        border-radius: 50%;
        transform: translate(30%, -30%);
      }
      #supportFloatingWidget .support-dock__badge .support-badge__text {
        display: block;
        transform: translateY(-1px);
      }
      #supportFloatingWidget .support-dock__badge i {
        font-size: 8px;
        line-height: 1;
      }
      #supportFloatingWidget .support-dock__badge[data-badge-mode="icon"] i {
        display: block;
        font-size: 7px;
        line-height: 1;
        color: #ffffff;
        -webkit-text-stroke: 0;
        text-shadow: none;
        transform: translateY(-1px);
      }
      #supportFloatingWidget .support-dock__link[aria-disabled="true"] {
        opacity: 0.56;
        cursor: default;
      }
      html.pre-login-route #supportFloatingWidget,
      body.login-route-active #supportFloatingWidget,
      body[data-inline-route="login"] #supportFloatingWidget,
      body:has(#loginInline:not(.hidden)) #supportFloatingWidget {
        display: none !important;
      }
      @media (max-width: 640px) {
        #supportFloatingWidget {
          left: max(10px, calc(env(safe-area-inset-left, 0px) + 10px));
          bottom: max(10px, calc(env(safe-area-inset-bottom, 0px) + 10px));
          gap: 10px;
        }
        #supportFloatingWidget .support-dock__toggle {
          width: 54px;
          height: 52px;
          border-radius: 50% 50% 50% 13px;
        }
        #supportFloatingWidget .support-dock__link {
          width: 42px;
          height: 42px;
        }
        #supportFloatingWidget .support-dock__link img {
          width: 23px !important;
          height: 23px !important;
          max-width: 23px !important;
          max-height: 23px !important;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        #supportFloatingWidget .support-dock__item,
        #supportFloatingWidget .support-dock__toggle,
        #supportFloatingWidget .support-dock__mark,
        #supportFloatingWidget .support-dock__mark--menu span,
        #supportFloatingWidget .support-dock__link {
          transition: none !important;
          animation: none !important;
        }
      }
    `;
    document.head.appendChild(floatingStyle);

    try {
      floatingToggle.addEventListener('click', function(ev){
        try { ev.preventDefault(); } catch(_){}
        if (floatingWidget.hidden) return;
        setFloatingSupportOpen(!floatingOpen);
      });
      floatingItems.addEventListener('click', function(ev){
        const link = ev && ev.target && ev.target.closest
          ? ev.target.closest('a.support-dock__link')
          : null;
        if (!link) return;
        if (link.getAttribute('aria-disabled') === 'true') {
          try { ev.preventDefault(); } catch(_){}
          return;
        }
        const key = String(link.getAttribute('data-contact-key') || '').trim().toLowerCase();
        const href = String(link.getAttribute('href') || '').trim();
        if (key === 'telegram' && /^https?:\/\/t\.me\//i.test(href)) {
          try { ev.preventDefault(); } catch(_){}
          setFloatingSupportOpen(false);
          const appHref = String(link.getAttribute('data-app-href') || buildTelegramAppHref(href)).trim();
          try {
            const startedAt = Date.now();
            window.location.href = appHref;
            setTimeout(function(){
              if (Date.now() - startedAt < 1500) {
                try { window.open(href, '_blank', 'noopener,noreferrer'); } catch(__){}
              }
            }, 600);
          } catch(_){
            try { window.open(href, '_blank', 'noopener,noreferrer'); } catch(__){}
          }
          return;
        }
        setFloatingSupportOpen(false);
      });
      document.addEventListener('click', function(ev){
        if (!floatingOpen) return;
        if (floatingWidget.contains(ev.target)) return;
        setFloatingSupportOpen(false);
      });
      document.addEventListener('keydown', function(ev){
        if (!floatingOpen) return;
        if (ev && ev.key === 'Escape') setFloatingSupportOpen(false);
      });
      window.addEventListener('hashchange', function(){
        if (floatingOpen) setFloatingSupportOpen(false);
      });
    } catch(_){}

    try { window.__SUPPORT_DEFAULT_CONTACTS__ = []; } catch {}
    try { window.__normalizeSupportContacts = normalizeSupportContacts; } catch {}
    try { window.__renderSupportContacts = renderSupportContacts; } catch {}
    try { window.__setSupportLinksMap = applySupportLinksMap; } catch {}
    try { window.__ensureSupportSectionMounted = mountSupportSection; } catch {}
    try { applyTranslations(section); } catch {}
  } catch {}
})();

(function(){
  try{
    var KNOWN_KEYS = ['facebook', 'whatsapp', 'instagram', 'email', 'telegram'];

    function normalizeHref(value){
      var raw = String(value == null ? '' : value).trim();
      if (!raw) return '';
      if (/^(https?:|mailto:|tel:|tg:|whatsapp:)/i.test(raw)) return raw;
      if (/^[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}$/i.test(raw)) return 'mailto:' + raw;
      if (/^\+?\d{6,20}$/.test(raw.replace(/\s+/g, ''))) return 'tel:' + raw.replace(/\s+/g, '');
      if (/^@[\w.]+$/.test(raw)) return 'https://t.me/' + raw.slice(1);
      if (!/\s/.test(raw) && /^(?:www\.|[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+(?:[/?#]|$))/i.test(raw)) {
        return 'https://' + raw;
      }
      return raw;
    }

    function normalizePrimaryHref(value){
      if (Array.isArray(value)) {
        for (var i = 0; i < value.length; i += 1) {
          var nextHref = normalizePrimaryHref(value[i]);
          if (nextHref) return nextHref;
        }
        return '';
      }
      if (value && typeof value === 'object') {
        return normalizeHref(
          value.href ||
          value.url ||
          value.link ||
          value.value ||
          value.text ||
          ''
        );
      }
      return normalizeHref(value);
    }

    function collectContactsFromMap(map){
      var out = [];
      if (!map || typeof map !== 'object' || Array.isArray(map)) return out;
      Object.keys(map).forEach(function(key){
        var value = map[key];
        if (Array.isArray(value)) {
          value.forEach(function(item){
            if (item == null) return;
            if (item && typeof item === 'object' && !Array.isArray(item)) {
              out.push(Object.assign({}, item, { key: key }));
              return;
            }
            out.push({ key: key, href: item });
          });
          return;
        }
        if (value && typeof value === 'object') {
          out.push(Object.assign({}, value, { key: key }));
          return;
        }
        var href = normalizeHref(value);
        if (!href) return;
        out.push({ key: key, href: href });
      });
      return out;
    }

    function mergeLinks(base, extra){
      var next = Object.assign({}, base || {});
      if (!extra || typeof extra !== 'object') return next;
      Object.keys(extra).forEach(function(key){
        var safe = String(key || '').trim().toLowerCase();
        if (!safe) return;
        var href = normalizePrimaryHref(extra[key]);
        if (!href) return;
        next[safe] = href;
      });
      return next;
    }

    function extractSupportPayload(raw){
      var out = { links: {}, contacts: null };
      if (!raw) return out;
      if (Array.isArray(raw)) {
        out.contacts = raw;
        return out;
      }
      if (typeof raw !== 'object') return out;

      if (raw.support && typeof raw.support === 'object' && raw.support !== raw) {
        var nestedSupport = extractSupportPayload(raw.support);
        if (nestedSupport.contacts && nestedSupport.contacts.length) out.contacts = nestedSupport.contacts;
        out.links = mergeLinks(out.links, nestedSupport.links);
      }

      var contacts = null;
      if (Array.isArray(raw.contacts)) contacts = raw.contacts;
      else if (Array.isArray(raw.supportContacts)) contacts = raw.supportContacts;
      else if (Array.isArray(raw.contactMethods)) contacts = raw.contactMethods;
      else if (Array.isArray(raw.items)) contacts = raw.items;
      else if (Array.isArray(raw.list)) contacts = raw.list;
      if (contacts && contacts.length) out.contacts = contacts;

      var candidateMaps = [
        raw.links,
        raw.supportLinks,
        raw.contactLinks,
        raw.support && raw.support.links,
        raw.support && raw.support.supportLinks,
        raw.support && raw.support.contactLinks,
        raw.linkMap,
        raw.map
      ];
      var derivedContacts = [];
      candidateMaps.forEach(function(candidate){
        if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
          out.links = mergeLinks(out.links, candidate);
          derivedContacts = derivedContacts.concat(collectContactsFromMap(candidate));
        }
      });

      var telegramBotHref = normalizeHref(
        raw.telegramBotLink ||
        raw.telegram_bot_link ||
        raw.telegramLink ||
        raw.telegram_link ||
        raw.telegramUrl ||
        raw.telegram_url ||
        (raw.support && (
          raw.support.telegramBotLink ||
          raw.support.telegram_bot_link ||
          raw.support.telegramLink ||
          raw.support.telegram_link ||
          raw.support.telegramUrl ||
          raw.support.telegram_url
        )) ||
        ''
      );
      if (telegramBotHref) {
        out.links.telegram = telegramBotHref;
        derivedContacts.push({ key: 'telegram', href: telegramBotHref });
      }

      KNOWN_KEYS.forEach(function(key){
        if (!Object.prototype.hasOwnProperty.call(raw, key)) return;
        var href = normalizePrimaryHref(raw[key]);
        var singleKeyMap = {};
        if (href) out.links[key] = href;
        singleKeyMap[key] = raw[key];
        derivedContacts = derivedContacts.concat(collectContactsFromMap(singleKeyMap));
      });

      if ((!out.contacts || !out.contacts.length) && derivedContacts.length) {
        out.contacts = derivedContacts;
      }

      return out;
    }

    function writeJsonStorage(key, value){
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch(_){}
    }

    function cacheSupportPayload(payload){
      var normalized = payload && typeof payload === 'object' ? payload : { links: {}, contacts: null };
      var links = normalized.links && typeof normalized.links === 'object' && !Array.isArray(normalized.links)
        ? normalized.links
        : {};
      var contacts = Array.isArray(normalized.contacts) ? normalized.contacts : [];
      writeJsonStorage('site:support:v1', {
        contacts: contacts,
        links: links,
        supportLinks: links,
        contactLinks: links,
        telegramBotLink: String(links.telegram || '').trim()
      });
      writeJsonStorage('site:support:contacts:v1', contacts);
      writeJsonStorage('site:support:links:v1', links);
      try {
        window.__SUPPORT_LINKS_MAP__ = Object.assign({}, links);
      } catch(_){}
      try {
        window.__TELEGRAM_LINK_BOT_URL__ = String(links.telegram || '').trim();
      } catch(_){}
    }

    function applyTelegramDeepLinks(){
      try {
        document.querySelectorAll('a.support-icon[data-contact-key="telegram"]').forEach(function(a){
          if (!a || a.dataset.tgBound === '1') return;
          var href = String(a.getAttribute('href') || '').trim();
          if (!/^https?:\/\/t\.me\//i.test(href)) return;
          var appHref = (function(){
            try {
              var parsed = new URL(href);
              var handle = String(parsed.pathname || '').replace(/^\/+/, '').split('/')[0];
              if (!handle) return href;
              var parts = ['domain=' + encodeURIComponent(handle)];
              var start = parsed.searchParams.get('start');
              if (start) parts.push('start=' + encodeURIComponent(start));
              var startGroup = parsed.searchParams.get('startgroup');
              if (startGroup) parts.push('startgroup=' + encodeURIComponent(startGroup));
              return 'tg://resolve?' + parts.join('&');
            } catch(_){ return href; }
          })();
          a.dataset.tgBound = '1';
          a.setAttribute('data-app-href', appHref);
          a.addEventListener('click', function(ev){
            try{
              ev.preventDefault();
              var start = Date.now();
              window.location.href = appHref;
              setTimeout(function(){ if (Date.now() - start < 1500) { window.open(href, '_blank', 'noopener,noreferrer'); } }, 600);
            }catch(_){ try { window.open(href, '_blank', 'noopener,noreferrer'); } catch(__){} }
          });
        });
      } catch(_){}
    }

    function devCreditLog(level, message, details){
      try {
        var normalizedLevel = String(level || '').toLowerCase();
        var debugEnabled = false;
        try {
          debugEnabled = !!(
            window.__DEV_CREDIT_DEBUG__ === true ||
            localStorage.getItem('devCreditDebug') === '1'
          );
        } catch(_){}
        if (normalizedLevel !== 'error' && !debugEnabled) return;
        if (!window.console) return;
        var method = 'log';
        if (normalizedLevel === 'error' && typeof window.console.error === 'function') method = 'error';
        else if (normalizedLevel === 'warn' && typeof window.console.warn === 'function') method = 'warn';
        else if (normalizedLevel === 'info' && typeof window.console.info === 'function') method = 'info';
        if (typeof details !== 'undefined') window.console[method]('[developerCredit] ' + String(message || ''), details);
        else window.console[method]('[developerCredit] ' + String(message || ''));
      } catch(_){}
    }

    try { window.__DEV_CREDIT_LOG__ = devCreditLog; } catch(_){}

    function normalizeDeveloperCreditConfig(raw){
      var src = (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {};
      var hasExplicitEnabled =
        Object.prototype.hasOwnProperty.call(src, 'enabled') ||
        Object.prototype.hasOwnProperty.call(src, 'on') ||
        Object.prototype.hasOwnProperty.call(src, 'show');
      return {
        enabled: hasExplicitEnabled
          ? !(src.enabled === false || src.on === false || src.show === false)
          : false,
        text: String(src.text || src.label || src.title || '').trim().slice(0, 240),
        href: normalizeHref(src.href || src.link || src.url || '') || '',
        imageUrl: normalizeHref(src.imageUrl || src.image_url || src.image || src.logo || '') || '',
        updatedAt: String(src.updatedAt || src.updated_at || '').trim().slice(0, 120)
      };
    }

    function hasRenderableDeveloperCreditConfig(raw){
      var normalized = normalizeDeveloperCreditConfig(raw || {});
      return !!(normalized.text || normalized.href || normalized.imageUrl);
    }

    function scoreDeveloperCreditConfig(raw){
      var normalized = normalizeDeveloperCreditConfig(raw || {});
      return hasRenderableDeveloperCreditConfig(normalized) ? (normalized.enabled ? 2 : 1) : 0;
    }

    function clearDeveloperCreditCache(reason){
      try { localStorage.removeItem('site:developer-credit:v1'); } catch(_){}
      try { delete window.__SITE_DEVELOPER_CREDIT__; } catch(_){}
      if (reason) devCreditLog('warn', reason);
    }

    function extractDeveloperCreditConfig(raw){
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        return normalizeDeveloperCreditConfig({});
      }
      var hasOwn = function(key){
        return Object.prototype.hasOwnProperty.call(raw, key);
      };
      var nested = null;
      if (raw.developerCredit && typeof raw.developerCredit === 'object') nested = raw.developerCredit;
      else if (raw.developer_credit && typeof raw.developer_credit === 'object') nested = raw.developer_credit;
      else if (raw.supportCredit && typeof raw.supportCredit === 'object') nested = raw.supportCredit;
      else if (raw.support_credit && typeof raw.support_credit === 'object') nested = raw.support_credit;
      if (nested) return normalizeDeveloperCreditConfig(nested);
      return normalizeDeveloperCreditConfig({
        enabled: hasOwn('developerCreditEnabled')
          ? raw.developerCreditEnabled
          : (hasOwn('developer_credit_enabled') ? raw.developer_credit_enabled : undefined),
        text: raw.developerCreditText || raw.developer_credit_text,
        href: raw.developerCreditHref || raw.developer_credit_href,
        imageUrl: raw.developerCreditImageUrl || raw.developer_credit_image_url
      });
    }

    function hasDeveloperCreditConfig(raw){
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
      if (raw.developerCredit && typeof raw.developerCredit === 'object') return true;
      if (raw.developer_credit && typeof raw.developer_credit === 'object') return true;
      if (raw.supportCredit && typeof raw.supportCredit === 'object') return true;
      if (raw.support_credit && typeof raw.support_credit === 'object') return true;
      return [
        'developerCreditEnabled',
        'developer_credit_enabled',
        'developerCreditText',
        'developer_credit_text',
        'developerCreditHref',
        'developer_credit_href',
        'developerCreditImageUrl',
        'developer_credit_image_url'
      ].some(function(key){
        return Object.prototype.hasOwnProperty.call(raw, key);
      });
    }

    function readCachedDeveloperCreditSeed(){
      var windowCached = null;
      var storageCached = null;
      try {
        if (window.__SITE_DEVELOPER_CREDIT__ && typeof window.__SITE_DEVELOPER_CREDIT__ === 'object') {
          windowCached = window.__SITE_DEVELOPER_CREDIT__;
        }
      } catch(_){}
      try {
        var raw = localStorage.getItem('site:developer-credit:v1');
        storageCached = raw ? JSON.parse(raw) : null;
      } catch(_){
        storageCached = null;
      }
      try {
        var normalizedWindow = normalizeDeveloperCreditConfig(windowCached || {});
        var normalizedStorage = normalizeDeveloperCreditConfig(storageCached || {});
        var scoreWindow = scoreDeveloperCreditConfig(normalizedWindow);
        var scoreStorage = scoreDeveloperCreditConfig(normalizedStorage);
        var normalizedCached = scoreWindow >= scoreStorage ? normalizedWindow : normalizedStorage;
        var cachedScore = scoreWindow >= scoreStorage ? scoreWindow : scoreStorage;
        if (!cachedScore) {
          clearDeveloperCreditCache('Cleared stale developerCredit cache because it had no renderable values.');
          return null;
        }
        try { localStorage.setItem('site:developer-credit:v1', JSON.stringify(normalizedCached)); } catch(__){}
        try { window.__SITE_DEVELOPER_CREDIT__ = Object.assign({}, normalizedCached); } catch(__){}
        devCreditLog('info', 'Recovered developerCredit config from cache.', normalizedCached);
        return normalizedCached;
      } catch(err){
        devCreditLog('error', 'Failed while validating developerCredit cache.', err && err.message ? err.message : err);
      }
      return null;
    }

    function cacheDeveloperCreditConfig(raw){
      var hasIncoming = hasDeveloperCreditConfig(raw);
      var cachedSource = readCachedDeveloperCreditSeed();
      var source = hasIncoming ? extractDeveloperCreditConfig(raw) : cachedSource;
      if (!source) {
        devCreditLog('warn', 'No developerCredit source found in payload or cache.');
        return null;
      }
      var normalized = normalizeDeveloperCreditConfig(source);
      if (!hasRenderableDeveloperCreditConfig(normalized)) {
        if (hasIncoming && normalized.enabled === false) {
          clearDeveloperCreditCache('Incoming developerCredit payload disabled the credit and had no renderable values.');
          return normalized;
        }
        if (hasIncoming && cachedSource && hasRenderableDeveloperCreditConfig(cachedSource)) {
          devCreditLog('warn', 'Ignored incoming developerCredit payload because it had no renderable values; kept the cached version instead.', {
            incoming: normalized,
            cached: cachedSource
          });
          return cachedSource;
        }
        clearDeveloperCreditCache('Skipped developerCredit payload because it had no renderable values.');
        return null;
      }
      try { localStorage.setItem('site:developer-credit:v1', JSON.stringify(normalized)); } catch(_){}
      try { window.__SITE_DEVELOPER_CREDIT__ = Object.assign({}, normalized); } catch(_){}
      devCreditLog('info', 'Normalized developerCredit payload.', {
        source: hasIncoming ? 'payload' : 'cache',
        enabled: normalized.enabled,
        text: normalized.text,
        href: normalized.href,
        imageUrl: normalized.imageUrl,
        updatedAt: normalized.updatedAt
      });
      return normalized;
    }

    function applyDeveloperCreditPayload(raw){
      var normalized = cacheDeveloperCreditConfig(raw || {});
      try {
        if (typeof window.__applySupportDevCredit === 'function') {
          window.__applySupportDevCredit();
        } else {
          devCreditLog('warn', 'window.__applySupportDevCredit is not ready yet.');
        }
      } catch(err){
        devCreditLog('error', 'Failed while forcing developerCredit sidebar render.', err && err.message ? err.message : err);
      }
      if (!normalized) {
        devCreditLog('warn', 'developerCredit payload resolved to null after normalization.');
      }
      return normalized;
    }

    function applySupportPayload(raw){
      try {
        if (typeof window.__ensureSupportSectionMounted === 'function') {
          window.__ensureSupportSectionMounted();
        }
      } catch(_){}
      var payload = extractSupportPayload(raw);
      var hasContacts = payload.contacts && payload.contacts.length;
      var hasLinks = payload.links && Object.keys(payload.links).length > 0;
      cacheSupportPayload(payload);
      applyDeveloperCreditPayload(raw || {});
      if (typeof window.__renderSupportContacts === 'function') {
        try {
          if (hasContacts) {
            window.__renderSupportContacts(payload.contacts);
          } else if (hasLinks) {
            window.__renderSupportContacts(payload.links);
          } else {
            window.__renderSupportContacts([]);
          }
        } catch(_){}
      }
      if (typeof window.__setSupportLinksMap === 'function') {
        try {
          if (!hasContacts) window.__setSupportLinksMap(payload.links || {});
        } catch(_){}
      }
      try {
        window.__SUPPORT_LINKS_MAP__ = Object.assign({}, payload.links || {});
      } catch(_){}
      try {
        window.__TELEGRAM_LINK_BOT_URL__ = String((payload.links && payload.links.telegram) || '').trim();
      } catch(_){}
      applyTelegramDeepLinks();
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

    function readLocalSupportConfig(){
      var combined = { links: {}, contacts: null };
      [
        { key: 'site:support:v1', prefersContacts: true },
        { key: 'site:support:contacts:v1', prefersContacts: true },
        { key: 'site:support:links:v1', prefersContacts: false }
      ].forEach(function(source){
        var entry = readJsonStorage(source.key);
        if (!entry) return;
        var payload = extractSupportPayload(entry);
        if (payload.contacts && payload.contacts.length) {
          if (source.prefersContacts || !combined.contacts || !combined.contacts.length) {
            combined.contacts = payload.contacts;
          }
        }
        combined.links = mergeLinks(combined.links, payload.links);
      });
      return combined;
    }

    try {
      window.__applySupportContactsConfig = function(raw){
        applySupportPayload(raw || {});
      };
    } catch(_){}

    try {
      window.__applySupportDeveloperCreditConfig = function(raw){
        return applyDeveloperCreditPayload(raw || {});
      };
    } catch(_){}

    function applyAllSupportConfigs(){
      applySupportPayload(readLocalSupportConfig());
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function(){
        applyAllSupportConfigs();
        setTimeout(applyAllSupportConfigs, 200);
        setTimeout(applyAllSupportConfigs, 1000);
      });
    } else {
      applyAllSupportConfigs();
      setTimeout(applyAllSupportConfigs, 200);
      setTimeout(applyAllSupportConfigs, 1000);
    }
  }catch(_){ }
})();

(function ensureSupportDevCredit(){
  try{
    var CREDIT_DEFAULTS = {
      href: '',
      label: '',
      tagline: '',
      imageUrl: ''
    };

    function devCreditLog(level, message, details){
      try {
        if (typeof window.__DEV_CREDIT_LOG__ === 'function') {
          window.__DEV_CREDIT_LOG__(level, message, details);
          return;
        }
      } catch(_){}
      try {
        if (!window.console) return;
        var method = 'log';
        if (level === 'error' && typeof window.console.error === 'function') method = 'error';
        else if (level === 'warn' && typeof window.console.warn === 'function') method = 'warn';
        else if (level === 'info' && typeof window.console.info === 'function') method = 'info';
        if (typeof details !== 'undefined') window.console[method]('[developerCredit] ' + String(message || ''), details);
        else window.console[method]('[developerCredit] ' + String(message || ''));
      } catch(_){}
    }

    function readDeveloperCreditConfig(){
      var cached = null;
      try {
        if (window.__SITE_DEVELOPER_CREDIT__ && typeof window.__SITE_DEVELOPER_CREDIT__ === 'object') {
          cached = window.__SITE_DEVELOPER_CREDIT__;
        }
      } catch(_){}
      if (!cached) {
        try {
          var raw = localStorage.getItem('site:developer-credit:v1');
          cached = raw ? JSON.parse(raw) : null;
        } catch(_){
          cached = null;
        }
      }
      var src = (cached && typeof cached === 'object' && !Array.isArray(cached)) ? cached : {};
      var hasExplicitEnabled =
        Object.prototype.hasOwnProperty.call(src, 'enabled') ||
        Object.prototype.hasOwnProperty.call(src, 'on') ||
        Object.prototype.hasOwnProperty.call(src, 'show');
      return {
        enabled: hasExplicitEnabled
          ? !(src.enabled === false || src.on === false || src.show === false)
          : false,
        href: String(src.href || src.link || src.url || CREDIT_DEFAULTS.href).trim() || CREDIT_DEFAULTS.href,
        label: String(src.text || src.label || src.title || CREDIT_DEFAULTS.label).trim() || CREDIT_DEFAULTS.label,
        tagline: String(src.tagline || CREDIT_DEFAULTS.tagline || '').trim(),
        imageUrl: String(src.imageUrl || src.image_url || src.image || src.logo || CREDIT_DEFAULTS.imageUrl).trim() || CREDIT_DEFAULTS.imageUrl
      };
    }

    function normalizeTheme(value){
      var t = String(value || '').toLowerCase().trim();
      return (t === 'light' || t === 'dark') ? t : '';
    }
    function readCachedSiteDefaultMode(){
      try {
        var raw = localStorage.getItem('site:theme:v1');
        if (!raw) return '';
        var parsed = JSON.parse(raw);
        return normalizeTheme(
          parsed && (
            parsed.defaultMode ||
            parsed.default_mode ||
            parsed.defaultThemeMode ||
            parsed.default_theme_mode
          )
        );
      } catch {}
      return '';
    }
    function readTheme(){
      var t = '';
      try { t = normalizeTheme(document.documentElement.getAttribute('data-theme')); } catch {}
      if (!t) {
        try { t = normalizeTheme(localStorage.getItem('theme')); } catch {}
      }
      if (!t) {
        t = readCachedSiteDefaultMode();
      }
      return t || 'dark';
    }
    function applyTheme(nextTheme){
      var theme = normalizeTheme(nextTheme) || 'dark';
      try { localStorage.setItem('theme', theme); } catch {}
      try { document.documentElement.setAttribute('data-theme', theme); } catch {}
      try {
        if (document.body) {
          document.body.classList.toggle('dark-mode', theme === 'dark');
          document.body.classList.toggle('light-mode', theme === 'light');
        }
      } catch {}
      try {
        var evt = new CustomEvent('theme:change', { detail: { theme: theme } });
        document.dispatchEvent(evt);
      } catch {}
    }
    function syncThemeToggle(scope){
      try {
        var checked = readTheme() === 'dark';
        (scope || document).querySelectorAll('.support-theme-toggle .support-theme-switch__input').forEach(function(input){
          try { input.checked = checked; } catch {}
          try {
            var toggleEl = input && input.parentElement ? input.parentElement.querySelector('.support-theme-switch__track') : null;
            if (toggleEl) toggleEl.setAttribute('aria-checked', checked ? 'true' : 'false');
          } catch {}
        });
      } catch {}
    }

    // Add style to limit clickable area
    const creditStyle = document.createElement('style');
    creditStyle.textContent = `
      .support-icons { position: relative; }
      #sidebar .support-rights {
      pointer-events: none; /* Disable clicks on container */
      margin-top: 14px !important;
      padding-top: 10px;
      border-top: 1px solid rgba(230, 237, 255, 0.28);
      }
      #sidebar .support-rights a {
      pointer-events: auto; /* Re-enable clicks just on link */
      display: inline-block; /* Contains the clickable area */
      padding: 5px 10px; /* Add some padding for better touch target */
      }
      .support-icon .support-badge {
        position: absolute;
        right: -10px;
        bottom: -8px;
        min-width: 22px;
        height: 18px;
        padding: 0 5px;
        background: linear-gradient(145deg, #9aa4ff 0%, #7076eb 54%, #4f55cd 100%);
        color: #ffffff;
        border: 1px solid rgba(35, 58, 114, 0.14);
        font-size: 10px;
        font-weight: 900;
        line-height: 1;
        border-radius: 999px 999px 999px 6px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 10px rgba(0,0,0,0.22);
        direction: ltr;
        pointer-events: none;
        z-index: 1;
        white-space: nowrap;
      }
      .support-icon .support-badge[data-badge-mode="icon"] {
        top: 0;
        right: 0;
        bottom: auto;
        min-width: 19px;
        width: 19px;
        height: 19px;
        padding: 0;
        border-radius: 50%;
        transform: translate(32%, -32%);
      }
      .support-icon .support-badge .support-badge__text {
        display: block;
        transform: translateY(-1px);
      }
      .support-icon .support-badge i {
        font-size: 9px;
        line-height: 1;
      }
      .support-icon .support-badge[data-badge-mode="icon"] i {
        display: block;
        font-size: 7px;
        line-height: 1;
        color: #ffffff;
        -webkit-text-stroke: 0;
        text-shadow: none;
        transform: translateY(-1px);
      }
      #sidebar .support-section .support-icon .support-badge {
        top: 0;
        left: auto;
        right: 0;
        bottom: auto;
        min-width: 18px;
        height: 18px;
        padding: 0 5px;
        background: linear-gradient(
          145deg,
          var(--site-accent-runtime-light, var(--primary-light, var(--accent-theme, #969cff))) 0%,
          var(--site-accent-runtime, var(--accent-theme, #7076eb)) 54%,
          var(--site-accent-runtime-strong, var(--primary-dark, var(--accent-theme, #4f55cd))) 100%
        );
        color: #ffffff;
        border: 2px solid #ffffff;
        border-radius: 999px 999px 999px 6px;
        box-shadow: 0 4px 10px rgba(var(--site-accent-rgb, 106, 111, 232), 0.18);
        font-size: 9px;
        font-weight: 900;
        line-height: 1;
        direction: ltr;
        transform: translate(42%, -42%);
      }
      #sidebar .support-section .support-icon .support-badge[data-badge-mode="icon"] {
        min-width: 18px;
        width: 18px;
        height: 18px;
        padding: 0;
        transform: translate(34%, -34%);
        border-radius: 50%;
      }
      #sidebar .support-section .support-icon .support-badge .support-badge__text {
        display: block;
        transform: translateY(-1px);
      }
      #sidebar .support-section .support-icon .support-badge[data-badge-mode="icon"] i {
        display: block;
        font-size: 7px;
        line-height: 1;
        color: #ffffff;
        -webkit-text-stroke: 0;
        text-shadow: none;
        transform: translateY(-1px);
      }
      #sidebar .support-theme-toggle {
        margin: 8px 10px 10px;
        display: flex;
        justify-content: center;
        align-items: center;
        pointer-events: auto;
      }
      #sidebar .support-theme-toggle .support-theme-switch {
        position: relative;
        overflow: visible;
        padding: 0;
        transform: none;
        color: #fff;
      }
      #sidebar .support-theme-toggle .support-theme-switch__input {
        position: absolute !important;
        width: 1px !important;
        height: 1px !important;
        top: 0 !important;
        left: 0 !important;
        opacity: 0 !important;
        pointer-events: none !important;
        margin: 0 !important;
        padding: 0 !important;
        border: 0 !important;
        clip: rect(0 0 0 0) !important;
        clip-path: inset(50%) !important;
        overflow: hidden !important;
        appearance: none !important;
      }
      #sidebar .support-theme-toggle .support-theme-switch__track {
        cursor: pointer;
        display: block;
        position: relative;
        width: 78px;
        height: 42px;
        margin: 0;
        padding: 0;
        border: 0;
        box-sizing: border-box;
        line-height: 0;
        overflow: hidden;
        direction: ltr;
        font-size: 0;
        background-color: #83d8ff;
        border-radius: 84px;
        transition: background-color 200ms cubic-bezier(0.445, 0.05, 0.55, 0.95);
      }
      #sidebar .support-theme-toggle .support-theme-switch__track::before,
      #sidebar .support-theme-toggle .support-theme-switch__track::after {
        content: none;
      }
      #sidebar .support-theme-toggle .support-theme-switch__handler {
        display: block;
        position: absolute;
        z-index: 1;
        top: 3px;
        left: 3px;
        width: 36px;
        height: 36px;
        background-color: #ffcf96;
        border-radius: 50px;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
        transition: all 400ms cubic-bezier(0.68, -0.55, 0.265, 1.55);
        transform: rotate(-45deg);
      }
      #sidebar .support-theme-toggle .support-theme-switch__handler .support-theme-switch__crater {
        position: absolute;
        background-color: #e8cda5;
        opacity: 0;
        transition: opacity 200ms ease-in-out;
        border-radius: 100%;
      }
      #sidebar .support-theme-toggle .support-theme-switch__handler .support-theme-switch__crater--1 {
        top: 14px;
        left: 8px;
        width: 4px;
        height: 4px;
      }
      #sidebar .support-theme-toggle .support-theme-switch__handler .support-theme-switch__crater--2 {
        top: 22px;
        left: 17px;
        width: 6px;
        height: 6px;
      }
      #sidebar .support-theme-toggle .support-theme-switch__handler .support-theme-switch__crater--3 {
        top: 8px;
        left: 19px;
        width: 8px;
        height: 8px;
      }
      #sidebar .support-theme-toggle .support-theme-switch__star {
        position: absolute;
        background-color: #fff;
        transition: all 300ms cubic-bezier(0.445, 0.05, 0.55, 0.95);
        border-radius: 50%;
      }
      #sidebar .support-theme-toggle .support-theme-switch__star--1 {
        top: 9px;
        left: 28px;
        z-index: 0;
        width: 24px;
        height: 3px;
      }
      #sidebar .support-theme-toggle .support-theme-switch__star--2 {
        top: 16px;
        left: 23px;
        z-index: 1;
        width: 24px;
        height: 3px;
      }
      #sidebar .support-theme-toggle .support-theme-switch__star--3 {
        top: 24px;
        left: 31px;
        z-index: 0;
        width: 24px;
        height: 3px;
      }
      #sidebar .support-theme-toggle .support-theme-switch__star--4,
      #sidebar .support-theme-toggle .support-theme-switch__star--5,
      #sidebar .support-theme-toggle .support-theme-switch__star--6 {
        opacity: 0;
        transition: all 300ms 0 cubic-bezier(0.445, 0.05, 0.55, 0.95);
      }
      #sidebar .support-theme-toggle .support-theme-switch__star--4 {
        top: 13px;
        left: 10px;
        z-index: 0;
        width: 2px;
        height: 2px;
        transform: translate3d(3px, 0, 0);
      }
      #sidebar .support-theme-toggle .support-theme-switch__star--5 {
        top: 28px;
        left: 14px;
        z-index: 0;
        width: 3px;
        height: 3px;
        transform: translate3d(3px, 0, 0);
      }
      #sidebar .support-theme-toggle .support-theme-switch__star--6 {
        top: 31px;
        left: 21px;
        z-index: 0;
        width: 2px;
        height: 2px;
        transform: translate3d(3px, 0, 0);
      }
      #sidebar .support-theme-toggle .support-theme-switch__input:checked + .support-theme-switch__track {
        background-color: #749dd6;
      }
      #sidebar .support-theme-toggle .support-theme-switch__input:checked + .support-theme-switch__track .support-theme-switch__handler {
        background-color: #ffe5b5;
        transform: translate3d(36px, 0, 0) rotate(0);
      }
      #sidebar .support-theme-toggle .support-theme-switch__input:checked + .support-theme-switch__track .support-theme-switch__handler .support-theme-switch__crater {
        opacity: 1;
      }
      #sidebar .support-theme-toggle .support-theme-switch__input:checked + .support-theme-switch__track .support-theme-switch__star--1 {
        width: 2px;
        height: 2px;
      }
      #sidebar .support-theme-toggle .support-theme-switch__input:checked + .support-theme-switch__track .support-theme-switch__star--2 {
        width: 4px;
        height: 4px;
        transform: translate3d(-5px, 0, 0);
      }
      #sidebar .support-theme-toggle .support-theme-switch__input:checked + .support-theme-switch__track .support-theme-switch__star--3 {
        width: 2px;
        height: 2px;
        transform: translate3d(-7px, 0, 0);
      }
      #sidebar .support-theme-toggle .support-theme-switch__input:checked + .support-theme-switch__track .support-theme-switch__star--4,
      #sidebar .support-theme-toggle .support-theme-switch__input:checked + .support-theme-switch__track .support-theme-switch__star--5,
      #sidebar .support-theme-toggle .support-theme-switch__input:checked + .support-theme-switch__track .support-theme-switch__star--6 {
        opacity: 1;
        transform: translate3d(0, 0, 0);
      }
      #sidebar .support-theme-toggle .support-theme-switch__input:checked + .support-theme-switch__track .support-theme-switch__star--4 {
        transition: all 300ms 200ms cubic-bezier(0.445, 0.05, 0.55, 0.95);
      }
      #sidebar .support-theme-toggle .support-theme-switch__input:checked + .support-theme-switch__track .support-theme-switch__star--5 {
        transition: all 300ms 300ms cubic-bezier(0.445, 0.05, 0.55, 0.95);
      }
      #sidebar .support-theme-toggle .support-theme-switch__input:checked + .support-theme-switch__track .support-theme-switch__star--6 {
        transition: all 300ms 400ms cubic-bezier(0.445, 0.05, 0.55, 0.95);
      }
    `;
    document.head.appendChild(creditStyle);

    function ensureThemeToggle(section){
      try {
        if (!section) return;
        var sidebarHost = (section.closest && section.closest('#sidebar')) || document.getElementById('sidebar');
        var toggleHost = null;
        if (sidebarHost) {
          toggleHost = sidebarHost.querySelector('.support-theme-toggle');
        }
        if (!toggleHost) {
          toggleHost = section.querySelector('.support-theme-toggle');
        }
        if (!toggleHost) {
          toggleHost = document.createElement('div');
          toggleHost.className = 'support-theme-toggle';
          toggleHost.setAttribute('data-i18n-ignore', 'true');
          toggleHost.innerHTML = `
            <div class="support-theme-switch">
              <input class="support-theme-switch__input" type="checkbox" aria-hidden="true" tabindex="-1" />
              <label class="support-theme-switch__track" role="switch" aria-checked="false" tabindex="0" aria-label="تبديل الثيم">
                <span class="support-theme-switch__handler">
                  <span class="support-theme-switch__crater support-theme-switch__crater--1"></span>
                  <span class="support-theme-switch__crater support-theme-switch__crater--2"></span>
                  <span class="support-theme-switch__crater support-theme-switch__crater--3"></span>
                </span>
                <span class="support-theme-switch__star support-theme-switch__star--1"></span>
                <span class="support-theme-switch__star support-theme-switch__star--2"></span>
                <span class="support-theme-switch__star support-theme-switch__star--3"></span>
                <span class="support-theme-switch__star support-theme-switch__star--4"></span>
                <span class="support-theme-switch__star support-theme-switch__star--5"></span>
                <span class="support-theme-switch__star support-theme-switch__star--6"></span>
              </label>
            </div>
          `;
        }
        if (sidebarHost) {
          if (toggleHost.parentNode !== sidebarHost || toggleHost.nextElementSibling !== section) {
            sidebarHost.insertBefore(toggleHost, section);
          }
        } else if (toggleHost.parentNode !== section || section.firstElementChild !== toggleHost) {
          section.insertBefore(toggleHost, section.firstElementChild || null);
        }
        var input = toggleHost.querySelector('.support-theme-switch .support-theme-switch__input');
        var toggleBtn = toggleHost.querySelector('.support-theme-switch .support-theme-switch__track');
        if (input && toggleBtn && !toggleBtn.dataset.bound) {
          toggleBtn.dataset.bound = '1';
          var flipTheme = function(ev){
            try { if (ev) { ev.preventDefault(); ev.stopPropagation(); } } catch {}
            var next = !input.checked;
            try { input.checked = next; } catch {}
            try { toggleBtn.setAttribute('aria-checked', next ? 'true' : 'false'); } catch {}
            applyTheme(next ? 'dark' : 'light');
            syncThemeToggle(section);
          };
          toggleBtn.addEventListener('click', flipTheme);
          toggleBtn.addEventListener('keydown', function(ev){
            try {
              if (!ev) return;
              if (ev.key === ' ' || ev.key === 'Enter') flipTheme(ev);
            } catch {}
          });
        }
        syncThemeToggle(toggleHost);
      } catch {}
    }

    function syncSupportSectionOrder(section){
      try {
        if (!section) return;
        var supportTitle = section.querySelector('.support-title');
        var supportIcons = section.querySelector('.support-icons');
        var rights = section.querySelector('.support-rights');
        if (supportTitle && section.firstElementChild !== supportTitle) {
          section.insertBefore(supportTitle, section.firstElementChild || null);
        }
        var afterTitle = supportTitle && supportTitle.parentNode === section
          ? supportTitle.nextElementSibling
          : section.firstElementChild;
        if (supportIcons && afterTitle !== supportIcons) {
          section.insertBefore(supportIcons, afterTitle || null);
        }
        if (rights && rights.parentNode === section && section.lastElementChild !== rights) {
          section.appendChild(rights);
        }
      } catch {}
    }

    function applyCredit(){
      try{
        var CREDIT = readDeveloperCreditConfig();
        var hasRenderableCredit = CREDIT.enabled && !!(CREDIT.href || CREDIT.label || CREDIT.imageUrl);
        devCreditLog('info', 'Sidebar developerCredit render pass started.', {
          enabled: CREDIT.enabled,
          href: CREDIT.href,
          label: CREDIT.label,
          imageUrl: CREDIT.imageUrl,
          hasRenderableCredit: hasRenderableCredit
        });
        try {
          var legalLink = document.querySelector('.js-legal-developer-credit-link');
          var legalSeparator = document.querySelector('.js-legal-developer-credit-separator');
          if (legalLink) {
            if (!hasRenderableCredit || !CREDIT.href) {
              legalLink.style.display = 'none';
              if (legalSeparator) legalSeparator.style.display = 'none';
            } else {
              legalLink.style.display = '';
              if (legalSeparator) legalSeparator.style.display = '';
              legalLink.setAttribute('href', String(CREDIT.href || CREDIT_DEFAULTS.href).trim() || CREDIT_DEFAULTS.href);
              legalLink.setAttribute('aria-label', String(CREDIT.label || CREDIT_DEFAULTS.label).trim() || CREDIT_DEFAULTS.label);
            }
          }
        } catch(_){}
        try {
          if (typeof window.__ensureSupportSectionMounted === 'function') {
            window.__ensureSupportSectionMounted();
          }
        } catch(_){}
        var section = document.querySelector('#sidebar section.support-section') || document.querySelector('section.support-section');
        if (!section) {
          devCreditLog('warn', 'Support section was not found while rendering developerCredit.', {
            hasSidebar: !!document.getElementById('sidebar')
          });
          return;
        }

        var rightsNodes = section.querySelectorAll('.support-rights');
        var rights = rightsNodes && rightsNodes.length ? rightsNodes[0] : null;
        if (rightsNodes && rightsNodes.length > 1){
          for (var ri = 1; ri < rightsNodes.length; ri += 1){
            try { rightsNodes[ri].remove(); } catch(_){ }
          }
        }
        ensureThemeToggle(section);
        syncSupportSectionOrder(section);
        if (!hasRenderableCredit) {
          if (rights){
            try {
              rights.remove();
            } catch(_){
              try {
                rights.innerHTML = '';
                rights.hidden = true;
                rights.setAttribute('aria-hidden', 'true');
                rights.style.display = 'none';
              } catch(__){ }
            }
          }
          ensureThemeToggle(section);
          syncSupportSectionOrder(section);
          devCreditLog('warn', 'Developer credit was hidden because it is not renderable.', {
            enabled: CREDIT.enabled,
            href: CREDIT.href,
            label: CREDIT.label,
            imageUrl: CREDIT.imageUrl
          });
          return;
        }
        if (!rights){
          rights = document.createElement('div');
          rights.className = 'support-rights';
          rights.style.textAlign = 'center';
          rights.style.marginTop = '15px';
          section.appendChild(rights);
        }
        rights.hidden = false;
        rights.removeAttribute('aria-hidden');
        rights.style.display = '';

        ensureThemeToggle(section);
        syncSupportSectionOrder(section);

        var textAnchors = rights.querySelectorAll('a.support-dev-credit-text-link');
        var textAnchor = textAnchors && textAnchors.length ? textAnchors[0] : null;
        if (textAnchors && textAnchors.length > 1){
          for (var ta = 1; ta < textAnchors.length; ta += 1){
            try { textAnchors[ta].remove(); } catch(_){ }
          }
        }
        if (!textAnchor){
          textAnchor = document.createElement('a');
          textAnchor.className = 'support-dev-credit-text-link';
          // Add link styling
          textAnchor.style.color = '#3b82f6'; // Blue color
          textAnchor.style.textDecoration = 'none';
          textAnchor.style.transition = 'all 0.2s';

          // Hover effect
          textAnchor.addEventListener('mouseover', function() {
            textAnchor.style.color = '#2563eb';
            textAnchor.style.textDecoration = 'underline';
          });
          textAnchor.addEventListener('mouseout', function() {
            textAnchor.style.color = '#3b82f6';
            textAnchor.style.textDecoration = 'none';
          });
        }
        if (CREDIT.href) {
          textAnchor.href = CREDIT.href;
          textAnchor.target = '_blank';
          textAnchor.rel = 'noopener noreferrer';
        } else {
          textAnchor.removeAttribute('href');
          textAnchor.removeAttribute('target');
          textAnchor.removeAttribute('rel');
        }
        textAnchor.setAttribute('data-i18n-ignore', 'true');
        textAnchor.removeAttribute('data-i18n');
        textAnchor.textContent = CREDIT.label;
        textAnchor.style.display = CREDIT.label ? 'inline-block' : 'none';
        textAnchor.style.pointerEvents = CREDIT.href ? 'auto' : 'none';
        textAnchor.style.cursor = CREDIT.href ? 'pointer' : 'default';

        var devImage = rights.querySelector('img.support-dev-credit-image');
        if (!devImage){
          devImage = document.createElement('img');
          devImage.className = 'support-dev-credit-image';
        }
        if (CREDIT.imageUrl) devImage.src = CREDIT.imageUrl;
        else devImage.removeAttribute('src');
        devImage.alt = CREDIT.label || 'Developer credit';
        devImage.loading = 'lazy';
        devImage.decoding = 'async';
        devImage.referrerPolicy = 'no-referrer';
        if (!devImage.dataset.devCreditErrorBound) {
          devImage.dataset.devCreditErrorBound = '1';
          devImage.addEventListener('error', function(){
            try {
              devCreditLog('error', 'Developer credit image failed to load.', {
                imageUrl: devImage.currentSrc || devImage.src || ''
              });
            } catch(_){}
          });
        }
        devImage.style.display = 'block';
        devImage.style.width = '92px';
        devImage.style.maxWidth = '100%';
        devImage.style.height = 'auto';
        devImage.style.margin = '0 auto';
        devImage.style.borderRadius = '10px';
        devImage.style.pointerEvents = 'auto';

        var imageAnchors = rights.querySelectorAll('a.support-dev-credit-image-link');
        var imageAnchor = imageAnchors && imageAnchors.length ? imageAnchors[0] : null;
        if (imageAnchors && imageAnchors.length > 1){
          for (var ia = 1; ia < imageAnchors.length; ia += 1){
            try { imageAnchors[ia].remove(); } catch(_){ }
          }
        }
        if (!imageAnchor){
          imageAnchor = document.createElement('a');
          imageAnchor.className = 'support-dev-credit-image-link';
        }
        if (CREDIT.href) {
          imageAnchor.href = CREDIT.href;
          imageAnchor.target = '_blank';
          imageAnchor.rel = 'noopener noreferrer';
        } else {
          imageAnchor.removeAttribute('href');
          imageAnchor.removeAttribute('target');
          imageAnchor.removeAttribute('rel');
        }
        imageAnchor.setAttribute('aria-label', CREDIT.label || 'Developer credit');
        imageAnchor.style.display = CREDIT.imageUrl ? 'block' : 'none';
        imageAnchor.style.width = 'fit-content';
        imageAnchor.style.margin = '0 auto 8px';
        imageAnchor.style.padding = '0';
        imageAnchor.style.pointerEvents = CREDIT.href ? 'auto' : 'none';
        if (devImage.parentNode !== imageAnchor){
          imageAnchor.appendChild(devImage);
        }
        var legacyAnchors = rights.querySelectorAll('a:not(.support-dev-credit-image-link):not(.support-dev-credit-text-link)');
        legacyAnchors.forEach(function(legacyAnchor){
          try {
            if (legacyAnchor && legacyAnchor !== imageAnchor && legacyAnchor !== textAnchor) legacyAnchor.remove();
          } catch(_){ }
        });
        if (imageAnchor.parentNode !== rights){
          if (rights.firstChild) rights.insertBefore(imageAnchor, rights.firstChild);
          else rights.appendChild(imageAnchor);
        }
        if (textAnchor.parentNode !== rights){
          rights.appendChild(textAnchor);
        }
        if (imageAnchor.nextSibling !== textAnchor){
          rights.insertBefore(textAnchor, imageAnchor.nextSibling);
        }

        var tagline = rights.querySelector('p');
        if (!tagline){
          tagline = document.createElement('p');
          rights.appendChild(tagline);
        }
        tagline.textContent = CREDIT.tagline;
        tagline.style.display = CREDIT.tagline ? '' : 'none';
        devCreditLog('info', 'Developer credit rendered in sidebar successfully.', {
          hasSection: true,
          hasText: !!CREDIT.label,
          hasImage: !!CREDIT.imageUrl,
          hasHref: !!CREDIT.href
        });
        try { applyTranslations(rights); } catch {}
      }catch(err){
        devCreditLog('error', 'Unhandled error while rendering developerCredit in sidebar.', err && err.message ? err.message : err);
      }
    }

    try { window.__applySupportDevCredit = applyCredit; } catch(_){}

    function schedule(){
      applyCredit();
      setTimeout(applyCredit, 200);
      setTimeout(applyCredit, 1000);
    }

    if (document.readyState === 'loading'){
      document.addEventListener('DOMContentLoaded', schedule);
    } else {
      schedule();
    }
    if (!window.__SUPPORT_THEME_TOGGLE_SYNC__) {
      window.__SUPPORT_THEME_TOGGLE_SYNC__ = true;
      document.addEventListener('theme:change', function(){ syncThemeToggle(document); });
      window.addEventListener('storage', function(e){
        if (e && e.key === 'theme') syncThemeToggle(document);
      });
    }
  }catch(_){ }
})();

// =================== Site state (theme + maintenance) ===================
(function(){
  const log = () => {};
  try {
    let started = false;
    let siteLockRedirected = false;
        let siteStateRefreshInFlight = false;
        let lastSiteStateRefreshAt = 0;
        const SITE_STATE_PASSIVE_REFRESH_THROTTLE_MS = 60 * 1000;
        const SITE_STATE_PASSIVE_REFRESH_REASONS = new Set(["pageshow", "visible"]);

    const devCreditLog = (level, message, details) => {
      try {
        if (typeof window.__DEV_CREDIT_LOG__ === 'function') {
          window.__DEV_CREDIT_LOG__(level, message, details);
          return;
        }
      } catch {}
      try {
        if (!window.console) return;
        const method =
          level === 'error' && typeof window.console.error === 'function'
            ? 'error'
            : (level === 'warn' && typeof window.console.warn === 'function'
              ? 'warn'
              : (level === 'info' && typeof window.console.info === 'function' ? 'info' : 'log'));
        if (typeof details !== 'undefined') window.console[method]('[developerCredit] ' + String(message || ''), details);
        else window.console[method]('[developerCredit] ' + String(message || ''));
      } catch {}
    };

    const hasDeveloperCreditPayload = (data) => {
      if (!data || typeof data !== 'object') return false;
      if (data.developerCredit && typeof data.developerCredit === 'object') return true;
      if (data.developer_credit && typeof data.developer_credit === 'object') return true;
      if (data.supportCredit && typeof data.supportCredit === 'object') return true;
      if (data.support_credit && typeof data.support_credit === 'object') return true;
      return [
        'developerCreditEnabled',
        'developer_credit_enabled',
        'developerCreditText',
        'developer_credit_text',
        'developerCreditHref',
        'developer_credit_href',
        'developerCreditImageUrl',
        'developer_credit_image_url'
      ].some((key) => Object.prototype.hasOwnProperty.call(data, key));
    };

    const readDeveloperCreditPreview = (data) => {
      if (!data || typeof data !== 'object') return null;
      return data.developerCredit ||
        data.developer_credit ||
        data.supportCredit ||
        data.support_credit || {
          enabled: Object.prototype.hasOwnProperty.call(data, 'developerCreditEnabled')
            ? data.developerCreditEnabled
            : data.developer_credit_enabled,
          text: data.developerCreditText || data.developer_credit_text || '',
          href: data.developerCreditHref || data.developer_credit_href || '',
          imageUrl: data.developerCreditImageUrl || data.developer_credit_image_url || ''
        };
    };

    function ensureCss(){
      if (document.getElementById("site-state-style")) return;
      const st = document.createElement("style");
      st.id = "site-state-style";
      st.textContent = `
        #maintenance-overlay{
          --maintenance-text:#21356c;
          --maintenance-muted:#697aa3;
          --maintenance-bg:#eaf0fb;
          --maintenance-bg-image:radial-gradient(520px 300px at 50% 34%, rgba(255,255,255,1) 0%, rgba(244,247,255,1) 58%, rgba(234,240,251,1) 100%);
          --maintenance-scene-image:none;
          --maintenance-scene-opacity:0;
          --maintenance-glow:radial-gradient(circle, rgba(255,255,255,.92) 0%, rgba(255,255,255,.48) 42%, transparent 72%);
          --maintenance-logo-bg:rgba(255,255,255,.94);
          --maintenance-logo-border:rgba(255,255,255,.9);
          --maintenance-logo-shadow:0 24px 54px rgba(138, 152, 185, .26);
          --maintenance-countdown:#f59e0b;
          position:fixed;
          inset:0;
          z-index:1600;
          display:flex;
          align-items:center;
          justify-content:center;
          padding:calc(var(--app-header-offset, var(--app-header-height, 70px)) + 36px) 24px 64px;
          background-color:var(--maintenance-bg);
          background-image:var(--maintenance-bg-image);
          backdrop-filter:none !important;
          -webkit-backdrop-filter:none !important;
          color:var(--maintenance-text);
          font-family:'Cairo',sans-serif;
          direction:rtl;
          text-align:center;
          overflow:hidden;
          isolation:isolate;
        }
        #maintenance-overlay::before{
          content:none;
        }
        #maintenance-overlay::after{
          content:none;
        }
        #maintenance-overlay .maintenance-scene{
          position:absolute;
          left:0;
          right:0;
          bottom:0;
          height:18vh;
          min-height:110px;
          max-height:210px;
          pointer-events:none;
          z-index:0;
          overflow:visible;
          display:none;
          background-image:none;
          opacity:var(--maintenance-scene-opacity, 0);
          background-repeat:repeat-x;
          background-size:auto 100%;
          background-position:0 100%;
          animation:maintenance-scene-drift 8s ease-in-out infinite alternate;
        }
        #maintenance-overlay .maintenance-scene-image{
          display:block;
          width:100%;
          height:100%;
          object-fit:cover;
          object-position:center bottom;
        }
        body.theme-snow #maintenance-overlay .maintenance-scene,
        #maintenance-overlay[data-maintenance-theme="snow"] .maintenance-scene{
          display:block;
        }
        @keyframes maintenance-scene-drift{
          0%{transform:translateX(-14px);}
          100%{transform:translateX(14px);}
        }
        #maintenance-overlay .maintenance-shell{
          position:relative;
          z-index:1;
          width:min(560px, 100%);
          display:flex;
          flex-direction:column;
          align-items:center;
          justify-content:center;
          gap:14px;
        }
        #maintenance-overlay .maintenance-logo{
          width:152px;
          height:152px;
          border-radius:50%;
          display:grid;
          place-items:center;
          overflow:hidden;
          background:var(--maintenance-logo-bg);
          border:1px solid var(--maintenance-logo-border);
          box-shadow:var(--maintenance-logo-shadow);
        }
        #maintenance-overlay .maintenance-logo-image{
          width:100%;
          height:100%;
          object-fit:cover;
          border-radius:50%;
        }
        #maintenance-overlay .maintenance-logo-image[hidden]{
          display:none;
        }
        #maintenance-overlay .maintenance-logo-fallback{
          display:inline-flex;
          align-items:center;
          justify-content:center;
          width:100%;
          height:100%;
          padding:20px;
          text-align:center;
          color:#7c8bb2;
          font-size:1rem;
          font-weight:800;
          line-height:1.6;
        }
        #maintenance-overlay .maintenance-logo.has-image .maintenance-logo-fallback{
          display:none;
        }
        #maintenance-overlay .maintenance-title{
          margin:0;
          font-size:clamp(2rem, 4vw, 3rem);
          line-height:1.2;
          font-weight:900;
          letter-spacing:-.02em;
          color:var(--maintenance-text);
        }
        #maintenance-overlay .maintenance-copy{
          margin:0;
          max-width:28ch;
          font-size:1.06rem;
          line-height:1.9;
          color:var(--maintenance-muted);
        }
        #maintenance-overlay .maintenance-status{
          margin-top:4px;
          min-height:32px;
        }
        #maintenance-overlay .maintenance-status[hidden]{
          display:none !important;
        }
        #maintenance-overlay .maintenance-status-label{
          display:none;
        }
        #maintenance-overlay .countdown{
          margin:0;
          font-size:1.04rem;
          font-weight:800;
          color:var(--maintenance-countdown);
          line-height:1.8;
        }
        body.dark-mode #maintenance-overlay,
        html[data-theme="dark"] #maintenance-overlay,
        #maintenance-overlay[data-maintenance-mode="dark"]{
          --maintenance-text:#f3f6ff;
          --maintenance-muted:#c2d0f0;
          --maintenance-bg:#070b12;
          --maintenance-bg-image:
            radial-gradient(420px 260px at 50% 34%, rgba(var(--site-accent-rgb, 148, 163, 184), .16) 0%, rgba(7,11,18,.88) 58%, rgba(5,8,15,1) 100%),
            linear-gradient(180deg, rgba(10,14,24,1) 0%, rgba(6,10,18,1) 100%);
          --maintenance-glow:radial-gradient(circle, rgba(var(--site-accent-rgb, 148, 163, 184), .18) 0%, rgba(var(--site-accent-rgb, 148, 163, 184), .08) 42%, transparent 72%);
          --maintenance-logo-bg:rgba(9,15,28,.92);
          --maintenance-logo-border:rgba(189, 205, 243, .28);
          --maintenance-logo-shadow:0 24px 54px rgba(0, 0, 0, .42);
          --maintenance-countdown:#fbbf24;
        }
        body.theme-snow #maintenance-overlay,
        #maintenance-overlay[data-maintenance-theme="snow"]{
          --maintenance-text:#28406f;
          --maintenance-muted:#6981ac;
          --maintenance-bg:#eef5ff;
          --maintenance-bg-image:
            radial-gradient(500px 280px at 50% 34%, rgba(255,255,255,1) 0%, rgba(245,249,255,1) 56%, rgba(235,242,255,1) 100%);
          --maintenance-glow:radial-gradient(circle, rgba(255,255,255,.96) 0%, rgba(255,255,255,.54) 42%, transparent 72%);
          --maintenance-logo-bg:rgba(255,255,255,.96);
          --maintenance-logo-border:rgba(255,255,255,.94);
          --maintenance-logo-shadow:0 24px 54px rgba(151, 171, 210, .24);
          --maintenance-countdown:#d97706;
        }
        body.theme-ramadan #maintenance-overlay,
        #maintenance-overlay[data-maintenance-theme="ramadan"]{
          --maintenance-text:#f8f0d6;
          --maintenance-muted:#e2d8b5;
          --maintenance-bg:#07111f;
          --maintenance-bg-image:
            radial-gradient(460px 260px at 50% 32%, rgba(219,177,76,.16) 0%, rgba(7,17,31,.94) 58%, rgba(5,10,19,1) 100%),
            linear-gradient(180deg, rgba(10,22,38,1) 0%, rgba(6,14,25,1) 100%);
          --maintenance-glow:radial-gradient(circle, rgba(255,226,153,.16) 0%, rgba(255,226,153,.07) 42%, transparent 72%);
          --maintenance-logo-bg:rgba(12,24,41,.9);
          --maintenance-logo-border:rgba(229, 206, 142, .28);
          --maintenance-logo-shadow:0 24px 54px rgba(0, 0, 0, .4);
          --maintenance-countdown:#facc15;
        }
        body.theme-eid #maintenance-overlay,
        #maintenance-overlay[data-maintenance-theme="eid"]{
          --maintenance-text:#eefcf7;
          --maintenance-muted:#c8eee0;
          --maintenance-bg:#07161a;
          --maintenance-bg-image:
            radial-gradient(480px 280px at 50% 32%, rgba(52,211,153,.14) 0%, rgba(7,22,26,.94) 58%, rgba(4,12,15,1) 100%),
            linear-gradient(180deg, rgba(7,24,28,1) 0%, rgba(5,16,20,1) 100%);
          --maintenance-glow:radial-gradient(circle, rgba(110,231,183,.16) 0%, rgba(110,231,183,.07) 42%, transparent 72%);
          --maintenance-logo-bg:rgba(9,28,32,.9);
          --maintenance-logo-border:rgba(140, 240, 205, .24);
          --maintenance-logo-shadow:0 24px 54px rgba(0, 0, 0, .38);
          --maintenance-countdown:#facc15;
        }
        body.theme-fall #maintenance-overlay,
        #maintenance-overlay[data-maintenance-theme="fall"]{
          --maintenance-text:#fff4e6;
          --maintenance-muted:#f2d3b2;
          --maintenance-bg:#1a0d08;
          --maintenance-bg-image:
            radial-gradient(480px 280px at 50% 32%, rgba(245,158,11,.16) 0%, rgba(26,13,8,.94) 58%, rgba(18,9,5,1) 100%),
            linear-gradient(180deg, rgba(32,16,8,1) 0%, rgba(18,9,5,1) 100%);
          --maintenance-glow:radial-gradient(circle, rgba(251,191,36,.14) 0%, rgba(251,191,36,.06) 42%, transparent 72%);
          --maintenance-logo-bg:rgba(39,21,11,.9);
          --maintenance-logo-border:rgba(251, 191, 36, .24);
          --maintenance-logo-shadow:0 24px 54px rgba(0, 0, 0, .38);
          --maintenance-countdown:#fbbf24;
        }
        @media (max-width: 720px){
          #maintenance-overlay{
            padding:calc(var(--app-header-height, 70px) + 28px) 16px 48px;
          }
          #maintenance-overlay .maintenance-logo{
            width:128px;
            height:128px;
          }
          #maintenance-overlay .maintenance-copy{
            font-size:.98rem;
          }
        }
        #site-notice-overlay{position:fixed;inset:0;z-index:15100;display:none;align-items:center;justify-content:center;padding:22px;background:rgba(6,10,26,.56);backdrop-filter:blur(2px);}
        #site-notice-overlay.show{display:flex;}
        html[data-site-locked="true"]{
          overflow:hidden;
        }
        html[data-site-locked="true"] body{
          overflow:hidden !important;
        }
        #site-notice-overlay .notice-card{width:min(560px,94vw);background:linear-gradient(180deg,#ffffff,#f6f9ff);border:1px solid rgba(92,126,219,.28);border-radius:18px;padding:18px 16px 16px;box-shadow:0 24px 60px rgba(15,23,42,.24);direction:rtl;text-align:right;color:#1e293b;}
        html[data-theme="dark"] #site-notice-overlay .notice-card{background:linear-gradient(180deg,#0f1a35,#0b1329);border-color:rgba(120,143,232,.42);color:#eaf1ff;box-shadow:0 28px 70px rgba(2,8,23,.58);}
        #site-notice-overlay .notice-title{margin:0 0 8px;font-size:1.16rem;font-weight:900;text-align:center;}
        #site-notice-overlay .notice-message{margin:0 0 14px;line-height:1.8;font-size:.98rem;white-space:pre-wrap;word-break:break-word;color:#334155;}
        html[data-theme="dark"] #site-notice-overlay .notice-message{color:#d2defa;}
        #site-notice-overlay .notice-actions{display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap;}
        #site-notice-overlay .notice-mute{display:inline-flex;align-items:center;gap:8px;font-size:.9rem;color:#475569;cursor:pointer;user-select:none;}
        html[data-theme="dark"] #site-notice-overlay .notice-mute{color:#b5c7ef;}
        #site-notice-overlay .notice-mute input{width:16px;height:16px;accent-color:var(--site-accent-runtime, #5c5ebf);cursor:pointer;}
        #site-notice-overlay .notice-ok{border:1px solid rgba(var(--site-accent-rgb, 148, 163, 184), .45);background:linear-gradient(135deg,var(--site-accent-runtime, #5c5ebf),var(--site-accent-runtime-strong, #3b3e8c));color:#fff;border-radius:12px;padding:9px 18px;font-weight:800;cursor:pointer;transition:transform .12s ease, box-shadow .18s ease;box-shadow:0 12px 22px rgba(var(--site-accent-rgb, 148, 163, 184), .35);}
        #site-notice-overlay .notice-ok:hover{transform:translateY(-1px);}
        #site-notice-overlay .notice-ok:active{transform:translateY(0);}
        body.theme-fall .leaf{
          position:fixed;
          top:-12%;
          font-size:26px;
          line-height:1;
          opacity:.92;
          transform:rotate(12deg);
          /* Run once then JS removes the node on animationend (continuous spawner). */
          animation:falling-leaf 11s linear forwards;
          z-index:50;
          pointer-events:none;
          filter:drop-shadow(0 3px 6px rgba(0,0,0,.25));
          right:auto!important;
          font-family:"Segoe UI Symbol","Apple Color Emoji","Noto Color Emoji",sans-serif;
          color:#f59e0b;
          text-shadow:0 2px 6px rgba(0,0,0,.25);
          will-change:transform;
        }
        @keyframes falling-leaf{
          0%{transform:translate3d(0,-5%,0) rotate(0deg);}
          25%{transform:translate3d(-5vw,25vh,0) rotate(90deg);}
          50%{transform:translate3d(3vw,55vh,0) rotate(180deg);}
          75%{transform:translate3d(-8vw,85vh,0) rotate(270deg);}
          100%{transform:translate3d(-12vw,110vh,0) rotate(360deg);}
        }
        .snowflake{
          position:fixed;
          top:-8%;
          color:#e0e9ff;
          font-size:14px;
          line-height:1;
          opacity:.8;
          /* Run once then JS removes the node on animationend (continuous spawner). */
          animation:snowfall 11s linear forwards;
          pointer-events:none;
          z-index:50;
          text-shadow:0 0 6px rgba(255,255,255,.35);
          right:auto!important;
          font-family:"Segoe UI Symbol","Apple Color Emoji","Noto Color Emoji",sans-serif;
          will-change:transform;
        }
        html[data-theme="light"] .snowflake{
          color:#94a3b8;
          text-shadow:0 0 4px rgba(15,23,42,.12);
        }
        @keyframes snowfall{0%{transform:translateY(-10%) translateX(0);}100%{transform:translateY(115vh) translateX(var(--dx,20px));}}

        /* Ramadan: dual fanous (scoped implementation of provided design) */
        .ramadan-wrap{
          position:fixed;
          top:68px;
          right:2vw;
          width:600px;
          height:600px;
          z-index:60;
          pointer-events:none;
          transform-origin:top right;
          animation:none;
        }
        .ramadan-wrap .container{
          position:relative;
          display:block;
          background:none;
          width:600px;
          height:600px;
          margin:0 auto;
        }
        .ramadan-wrap .circle-1{
          position:absolute;
          top:20%;
          width:100%;
          height:100%;
          border-radius:50%;
          background:rgba(255,243,205,0.1);
        }
        .ramadan-wrap .circle-2{
          position:absolute;
          top:15%;
          left:-5%;
          width:110%;
          height:110%;
          border-radius:50%;
          background:rgba(255,243,205,.20);
        }
        .ramadan-wrap .circle-3{
          position:absolute;
          top:10%;
          left:-10%;
          width:120%;
          height:120%;
          border-radius:50%;
          background:rgba(255,243,205,0.2);
        }
        .ramadan-wrap .rope-1{
          position:absolute;
          left:30%;
          width:5%;
          height:60%;
        }
        .ramadan-wrap .rope-2{
          position:absolute;
          right:23%;
          width:5%;
          height:60%;
        }
        .ramadan-wrap .string{
          position:absolute;
          left:45%;
          width:10%;
          height:82.5%;
          background:#362113;
        }
        .ramadan-wrap .circle-string{
          position:absolute;
          bottom:10%;
          width:100%;
          height:8%;
          border-radius:50%;
          border:3px solid #362113;
        }
        .ramadan-wrap .fanous-1{
          position:absolute;
          left:20%;
          bottom:-10%;
          width:25%;
          height:55%;
        }
        .ramadan-wrap .circle-hold{
          position:absolute;
          top:-3%;
          left:45%;
          width:10%;
          height:5%;
          border-radius:50%;
          border:3px solid #362113;
          background:#f1ecd0;
        }
        .ramadan-wrap .top-layer{
          position:absolute;
          top:1%;
          left:10%;
          width:80%;
          height:20%;
          border-top-left-radius:50%;
          border-top-right-radius:50%;
          border:3px solid #362113;
          background:#8f7e70;
          overflow:hidden;
        }
        .ramadan-wrap .inner-top-layer{
          position:absolute;
          width:50%;
          top:-2px;
          left:25%;
          height:110%;
          border-top-left-radius:50%;
          border-top-right-radius:50%;
          border:3px solid #362113;
        }
        .ramadan-wrap .mid-layer{
          position:absolute;
          top:20.5%;
          width:100%;
          height:10%;
          background:#362113;
          -webkit-clip-path:polygon(10% 0, 90% 0, 100% 100%, 0 100%);
          clip-path:polygon(10% 0, 90% 0, 100% 100%, 0 100%);
        }
        .ramadan-wrap .mid-layer-left{
          position:absolute;
          left:1%;
          top:2%;
          width:30%;
          height:98%;
          background:#907f6f;
          -webkit-clip-path:polygon(40% 5%, 100% 5%, 100% 100%, 5% 100%);
          clip-path:polygon(40% 5%, 100% 5%, 100% 100%, 5% 100%);
        }
        .ramadan-wrap .mid-layer-mid{
          position:absolute;
          left:33%;
          top:2%;
          width:34%;
          height:98%;
          background:#907f6f;
          -webkit-clip-path:polygon(0 5%, 100% 5%, 100% 100%, 0 100%);
          clip-path:polygon(0 5%, 100% 5%, 100% 100%, 0 100%);
        }
        .ramadan-wrap .mid-layer-right{
          position:absolute;
          right:1%;
          top:2%;
          width:30%;
          height:98%;
          background:#907f6f;
          -webkit-clip-path:polygon(0 5%, 65% 5%, 95% 100%, 0 100%);
          clip-path:polygon(0 5%, 65% 5%, 95% 100%, 0 100%);
        }
        .ramadan-wrap .bottom-layer{
          position:absolute;
          bottom:0;
          width:100%;
          height:70%;
          border:3px solid #362113;
          background:#907f6f;
        }
        .ramadan-wrap .left-side{
          position:absolute;
          width:30%;
          height:100%;
        }
        .ramadan-wrap .mid-side{
          position:absolute;
          left:30.5%;
          width:39%;
          height:100%;
          border-left:3px solid #362113;
          border-right:3px solid #362113;
        }
        .ramadan-wrap .right-side{
          position:absolute;
          right:0;
          width:30%;
          height:100%;
        }
        .ramadan-wrap .left-glow{
          position:absolute;
          left:10%;
          top:2.5%;
          width:80%;
          height:95%;
          border:3px solid #362113;
          background:#ffd84f;
        }
        .ramadan-wrap .right-glow{
          position:absolute;
          left:10%;
          top:2.5%;
          width:80%;
          height:95%;
          border:3px solid #362113;
          background:#ffd84f;
        }
        .ramadan-wrap .mid-glow{
          position:absolute;
          left:10%;
          top:2.5%;
          width:80%;
          height:95%;
          border:3px solid #362113;
          background:#e60290;
        }
        .ramadan-wrap .fanous-2{
          position:absolute;
          top:30%;
          right:10.5%;
          width:30%;
          height:40%;
        }
        .ramadan-wrap .fanous-container{
          position:absolute;
          left:10%;
          width:80%;
          height:100%;
          border-radius:150px;
          overflow:hidden;
          border:3px solid #362113;
          background:#cab381;
        }
        .ramadan-wrap .inner-fanous-container{
          position:absolute;
          top:-1%;
          left:30%;
          width:40%;
          height:102%;
          border-radius:150px;
          border:3px solid #362113;
        }
        .ramadan-wrap .fanous-2-face{
          position:absolute;
          top:20%;
          width:100%;
          height:60%;
          border:3px solid #362113;
          background:#cab284;
        }
        .ramadan-wrap .pillar{
          position:absolute;
          top:-10%;
          width:15%;
          height:120%;
          border:3px solid #362113;
          background:#cab381;
        }
        .ramadan-wrap .pillar-copy{
          position:absolute;
          width:100%;
          height:100%;
          background:#cab381;
          z-index:2;
        }
        .ramadan-wrap .fanoos-pilar-1{ left:-2%; }
        .ramadan-wrap .fanoos-pilar-2{ left:43%; }
        .ramadan-wrap .fanoos-pilar-3{ right:-2%; }
        .ramadan-wrap .top-circle{
          position:absolute;
          top:-10%;
          left:12.5%;
          width:75%;
          height:10%;
          border:3px solid #362113;
          border-radius:50%;
          background:#cab284;
        }
        .ramadan-wrap .bottom-circle{
          position:absolute;
          bottom:-10%;
          left:12.5%;
          width:75%;
          height:10%;
          border:3px solid #362113;
          border-radius:50%;
          background:#cab284;
        }
        .ramadan-wrap .needle{
          position:absolute;
          left:42.5%;
          top:-15%;
          width:15%;
          height:130%;
          background:#362113;
        }
        .ramadan-wrap .glass-glow-l{
          position:absolute;
          left:13%;
          top:15%;
          width:30%;
          height:70%;
          border:3px solid #362113;
          border-radius:50%;
          background:#f88c20;
        }
        .ramadan-wrap .glass-glow-r{
          position:absolute;
          right:13%;
          top:15%;
          width:30%;
          height:70%;
          border:3px solid #362113;
          border-radius:50%;
          background:#f88c20;
        }
        .ramadan-wrap .circle-hold-fanous-2{
          position:absolute;
          top:-7%;
          left:46%;
          width:8%;
          height:10%;
          border:3px solid #362113;
          background:#cab284;
        }
        @media (max-width: 900px){
          .ramadan-wrap{ right:0; }
        }

        /* Eid: grass + fireworks */
        .eid-grass{
          position:fixed;left:0;right:0;bottom:0;
          height:16vh;min-height:90px;max-height:170px;
          pointer-events:none;z-index:45;overflow:visible;
          background:none;
        }
        .eid-grass::before{
          content:"";
          position:absolute;left:-80px;right:-80px;top:-18px;bottom:-2px;
          background-image:url('https://i.ibb.co/6R5ktnCy/pngegg-2.png');
          background-repeat:repeat-x;
          background-size:90px 120px;
          background-position:-30px 100%;
          mix-blend-mode:normal;
          opacity:1;
          filter:drop-shadow(0 -4px 10px rgba(0,0,0,.22));
          animation:grass-drift 6s ease-in-out infinite alternate;
        }
        @keyframes grass-drift{
          0%{transform:translateX(-12px);}
          100%{transform:translateX(12px);}
        }
        @keyframes grass-wind{
          0%{transform:translateX(-8px) skewX(-1deg);}
          100%{transform:translateX(8px) skewX(1deg);}
        }
        @media (prefers-reduced-motion: reduce){
          .eid-grass::before,
          .eid-grass::after{animation:none;}
        }
        .eid-firework{
          position:fixed;top:20vh;left:50vw;width:8px;height:8px;
          background:radial-gradient(circle,#fde68a 0%, #f59e0b 60%, rgba(0,0,0,0) 70%);
          border-radius:50%;opacity:0;pointer-events:none;z-index:65;
          animation:firework 1.8s ease-out forwards;
        }
        body.maintenance-active .snowflake,
        body.maintenance-active .leaf{
          z-index:1610;
        }
        body.maintenance-active .ramadan-wrap,
        body.maintenance-active .eid-grass{
          z-index:1610;
        }
        body.maintenance-active .eid-firework{
          z-index:1615;
        }
        @keyframes firework{
          0%{transform:scale(.2);opacity:0;}
          40%{opacity:1;}
          100%{transform:scale(3.2);opacity:0;}
        }
      `;
      document.head.appendChild(st);
    }

    let maintTimer = null;
    let siteMaintenanceActive = false;
    let siteNoticeConfig = { enabled:false, title:"", message:"", requiredViews:1, autoHideSeconds:0, version:"" };
    let siteNoticeDismissedOnce = false;
    let siteNoticeModalBound = false;
    let siteNoticeLastKey = "";
    let siteNoticeAutoHideTimer = null;
    const SITE_WA_JOIN_CACHE_KEY = "site:wa-join:v1";

    function normalizeSiteNoticeState(raw){
      const src = (raw && typeof raw === "object") ? raw : {};
      const enabledRaw = src.enabled ?? src.on ?? src.active;
      const enabled = enabledRaw === true || String(enabledRaw || "").toLowerCase() === "true";
      const title = String(src.title ?? src.headline ?? src.subject ?? "").trim().slice(0, 160);
      const message = String(src.message ?? src.text ?? src.body ?? "").trim().slice(0, 4000);
      const requiredViewsRaw = Number(src.requiredViews ?? src.required_views ?? src.readCount ?? src.read_count ?? src.count ?? src.views ?? 1);
      const requiredViews = Number.isFinite(requiredViewsRaw) ? Math.max(1, Math.min(20, Math.trunc(requiredViewsRaw))) : 1;
      const autoHideRaw = Number(
        src.autoHideSeconds ??
        src.auto_hide_seconds ??
        src.autoHide ??
        src.auto_hide ??
        src.hideAfter ??
        src.hide_after ??
        src.dismissAfter ??
        src.dismiss_after ??
        0
      );
      const autoHideSeconds = Number.isFinite(autoHideRaw) ? Math.max(0, Math.min(86400, Math.trunc(autoHideRaw))) : 0;
      const version = String(src.version ?? src.id ?? src.key ?? "").trim().slice(0, 120);
      return {
        enabled: !!enabled && !!message,
        title,
        message,
        requiredViews,
        autoHideSeconds,
        version
      };
    }

    function normalizeSiteWaJoinUrl(raw){
      const text = String(raw == null ? "" : raw).trim();
      if (!text) return "";
      if (/^(https?:\/\/|whatsapp:)/i.test(text)) return text.slice(0, 2000);
      if (/^(wa\.me\/|chat\.whatsapp\.com\/)/i.test(text)) return ("https://" + text).slice(0, 2000);
      const digits = text.replace(/[^\d]/g, "");
      if (digits.length >= 8) return ("https://wa.me/" + digits).slice(0, 2000);
      return text.slice(0, 2000);
    }

    function normalizeSiteWaJoinBenefits(raw){
      let source = [];
      if (Array.isArray(raw)) {
        source = raw;
      } else if (typeof raw === "string") {
        source = raw
          .split(/\r?\n|(?:\s*\|\s*)|(?:\s*;\s*)/g)
          .map((item) => String(item || "").trim())
          .filter(Boolean);
      } else if (raw != null) {
        source = [raw];
      }
      const out = [];
      source.forEach((entry) => {
        const text = String(entry == null ? "" : entry).trim().slice(0, 220);
        if (!text) return;
        if (out.includes(text)) return;
        out.push(text);
      });
      return out.slice(0, 6);
    }

    function normalizeSiteWaJoinState(raw){
      const src = (raw && typeof raw === "object") ? raw : {};
      const enabledRaw = src.enabled ?? src.on ?? src.active ?? src.show;
      const enabled = enabledRaw === true || String(enabledRaw || "").toLowerCase() === "true";
      const message = String(src.message ?? src.text ?? src.body ?? src.description ?? "").trim().slice(0, 4000);
      const whatsappUrl = normalizeSiteWaJoinUrl(
        src.whatsappUrl ??
        src.whatsapp_url ??
        src.whatsappLink ??
        src.whatsapp_link ??
        src.whatsapp ??
        src.url ??
        src.link ??
        ""
      );
      const autoHideRaw = Number(
        src.autoHideSeconds ??
        src.auto_hide_seconds ??
        src.autoHide ??
        src.auto_hide ??
        src.hideAfter ??
        src.hide_after ??
        src.dismissAfter ??
        src.dismiss_after ??
        0
      );
      const autoHideSeconds = Number.isFinite(autoHideRaw) ? Math.max(0, Math.min(86400, Math.trunc(autoHideRaw))) : 0;
      return {
        enabled: !!enabled && !!message && !!whatsappUrl,
        badgeSub: String(src.badgeSub ?? src.badge_sub ?? src.badgeTop ?? src.badge_top ?? "").trim().slice(0, 160),
        badgeBrand: String(src.badgeBrand ?? src.badge_brand ?? src.brand ?? src.storeName ?? src.store_name ?? "").trim().slice(0, 160),
        title: String(src.title ?? src.headline ?? src.subject ?? "").trim().slice(0, 160),
        message,
        benefits: normalizeSiteWaJoinBenefits(src.benefits ?? src.items ?? src.points ?? src.features ?? []),
        buttonText: String(src.buttonText ?? src.button_text ?? src.ctaText ?? src.cta_text ?? src.cta ?? src.joinText ?? src.join_text ?? "").trim().slice(0, 120),
        whatsappUrl,
        autoHideSeconds,
        version: String(src.version ?? src.id ?? src.key ?? "").trim().slice(0, 120),
        updatedAt: String(src.updatedAt ?? src.updated_at ?? "").trim()
      };
    }

    function applySiteWaJoin(raw){
      const source = (raw && typeof raw === "object") ? raw : { enabled: false };
      const config = normalizeSiteWaJoinState(source);
      try { localStorage.setItem(SITE_WA_JOIN_CACHE_KEY, JSON.stringify(config)); } catch {}
      try {
        if (typeof window.__applyWaJoinConfig === "function") {
          window.__applyWaJoinConfig(config);
        }
      } catch {}
    }

    function hashNoticeText(text){
      const str = String(text || "");
      let h = 2166136261;
      for (let i = 0; i < str.length; i += 1) {
        h ^= str.charCodeAt(i);
        h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
      }
      return (h >>> 0).toString(16);
    }

    function noticeStorageKey(config){
      const version = String(config?.version || "").trim();
      const base = version || hashNoticeText(
        String(config?.title || "") + "|" +
        String(config?.message || "") + "|" +
        String(config?.requiredViews || 1)
      );
      return "site:notice:v1:" + base;
    }

    function readNoticeProgress(config){
      const key = noticeStorageKey(config);
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return { reads: 0, muted: false };
        const parsed = JSON.parse(raw);
        const readsRaw = Number(parsed?.reads ?? 0);
        return {
          reads: Number.isFinite(readsRaw) ? Math.max(0, Math.trunc(readsRaw)) : 0,
          muted: !!parsed?.muted
        };
      } catch {
        return { reads: 0, muted: false };
      }
    }

    function writeNoticeProgress(config, progress){
      const key = noticeStorageKey(config);
      try {
        localStorage.setItem(key, JSON.stringify({
          reads: Math.max(0, Math.trunc(Number(progress?.reads) || 0)),
          muted: !!progress?.muted
        }));
      } catch {}
    }

    function ensureSiteNoticeModal(){
      let wrap = document.getElementById("site-notice-overlay");
      if (!wrap) {
        wrap = document.createElement("div");
        wrap.id = "site-notice-overlay";
        wrap.innerHTML = `
          <div class="notice-card" role="dialog" aria-modal="true" aria-labelledby="siteNoticeTitle" aria-describedby="siteNoticeMessage">
            <h3 id="siteNoticeTitle" class="notice-title" hidden></h3>
            <p id="siteNoticeMessage" class="notice-message"></p>
            <div class="notice-actions">
              <label class="notice-mute">
                <input id="siteNoticeMute" type="checkbox" />
                <span>لا تعرض هذه الرسالة مرة أخرى</span>
              </label>
              <button id="siteNoticeOk" class="notice-ok" type="button">حسنًا</button>
            </div>
          </div>
        `;
        document.body.appendChild(wrap);
      }
      if (!siteNoticeModalBound) {
        const okBtn = document.getElementById("siteNoticeOk");
        if (okBtn) {
          okBtn.addEventListener("click", function(){
            const config = siteNoticeConfig || {};
            const muteInput = document.getElementById("siteNoticeMute");
            const progress = readNoticeProgress(config);
            progress.reads = Math.max(0, progress.reads || 0) + 1;
            if (muteInput && muteInput.checked) progress.muted = true;
            writeNoticeProgress(config, progress);
            siteNoticeDismissedOnce = true;
            hideSiteNoticeModal();
          });
        }
        wrap.addEventListener("click", function(ev){
          if (ev && ev.target === wrap) {
            hideSiteNoticeModal();
          }
        });
        siteNoticeModalBound = true;
      }
      return wrap;
    }

    function hideSiteNoticeModal(){
      const wrap = document.getElementById("site-notice-overlay");
      if (!wrap) return;
      wrap.classList.remove("show");
      const muteInput = document.getElementById("siteNoticeMute");
      if (muteInput) muteInput.checked = false;
      if (siteNoticeAutoHideTimer) {
        clearTimeout(siteNoticeAutoHideTimer);
        siteNoticeAutoHideTimer = null;
      }
    }

    function applySiteNotice(raw){
      siteNoticeConfig = normalizeSiteNoticeState(raw || {});
      const currentKey = noticeStorageKey(siteNoticeConfig);
      if (currentKey !== siteNoticeLastKey) {
        siteNoticeLastKey = currentKey;
        siteNoticeDismissedOnce = false;
      }
      if (!siteNoticeConfig.enabled || !siteNoticeConfig.message) {
        hideSiteNoticeModal();
        return;
      }
      if (siteMaintenanceActive) {
        hideSiteNoticeModal();
        return;
      }
      if (siteNoticeDismissedOnce) return;
      const progress = readNoticeProgress(siteNoticeConfig);
      if (progress.muted) return;
      if (progress.reads >= siteNoticeConfig.requiredViews) return;
      const wrap = ensureSiteNoticeModal();
      const card = wrap ? wrap.querySelector(".notice-card") : null;
      const titleEl = document.getElementById("siteNoticeTitle");
      const body = document.getElementById("siteNoticeMessage");
      const muteInput = document.getElementById("siteNoticeMute");
      const titleText = String(siteNoticeConfig.title || "").trim();
      if (titleEl) {
        titleEl.textContent = titleText;
        titleEl.hidden = !titleText;
      }
      if (card) {
        if (titleText) card.setAttribute("aria-labelledby", "siteNoticeTitle");
        else card.removeAttribute("aria-labelledby");
      }
      if (body) body.textContent = siteNoticeConfig.message;
      if (muteInput) muteInput.checked = false;
      wrap.classList.add("show");
      if (siteNoticeAutoHideTimer) {
        clearTimeout(siteNoticeAutoHideTimer);
        siteNoticeAutoHideTimer = null;
      }
      if (siteNoticeConfig.autoHideSeconds > 0) {
        siteNoticeAutoHideTimer = setTimeout(function(){
          if (!siteNoticeConfig || !siteNoticeConfig.enabled) return;
          const progress = readNoticeProgress(siteNoticeConfig);
          progress.reads = Math.max(0, progress.reads || 0) + 1;
          writeNoticeProgress(siteNoticeConfig, progress);
          siteNoticeDismissedOnce = true;
          hideSiteNoticeModal();
        }, siteNoticeConfig.autoHideSeconds * 1000);
      }
    }

    function resolveMaintenanceLogoUrl(){
      try {
        if (typeof window.__resolveSiteMediaFallbackUrl === "function") {
          const resolved = String(window.__resolveSiteMediaFallbackUrl("icon", "شعار")).trim();
          if (resolved) return resolved;
        }
      } catch {}
      try {
        const direct = String(window.__SITE_ICON__ || "").trim();
        if (direct) return direct;
      } catch {}
      try {
        const raw = localStorage.getItem("site:media:v1");
        if (!raw) return "";
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object") return "";
        const keys = ["siteIcon", "site_icon", "icon", "iconUrl", "icon_url", "favicon", "faviconUrl", "favicon_url", "windowIcon", "window_icon", "windowImage", "window_image"];
        for (let i = 0; i < keys.length; i += 1) {
          const candidate = String(parsed[keys[i]] || "").trim();
          if (candidate) return candidate;
        }
      } catch {}
      return "";
    }

    function syncMaintenanceLogo(overlay){
      if (!overlay) return;
      const logoWrap = overlay.querySelector(".maintenance-logo");
      const logoImg = overlay.querySelector(".maintenance-logo-image");
      if (!logoWrap || !logoImg) return;
      const src = resolveMaintenanceLogoUrl();
      if (!src) {
        try { logoImg.hidden = true; } catch {}
        try { logoImg.removeAttribute("src"); } catch {}
        logoWrap.classList.remove("has-image");
        return;
      }
      try {
        if (logoImg.getAttribute("src") !== src) logoImg.setAttribute("src", src);
        logoImg.hidden = false;
        logoWrap.classList.add("has-image");
      } catch {}
    }

    const MAINTENANCE_SNOW_SCENE_URL = "/images/maintenance-snow.png?v=20260331-22";

    function normalizeMaintenanceThemeName(value){
      const raw = String(value || "").trim().toLowerCase();
      if (!raw) return "";
      if (["snow", "winter", "ثلج"].includes(raw)) return "snow";
      if (["ramadan", "رمضان"].includes(raw)) return "ramadan";
      if (["eid", "عيد"].includes(raw)) return "eid";
      if (["fall", "autumn", "خريف"].includes(raw)) return "fall";
      return raw;
    }

    function readStoredThemeMode(){
      try {
        const stored = String(localStorage.getItem("theme") || "").trim().toLowerCase();
        if (stored === "dark" || stored === "light") return stored;
      } catch {}
      return "";
    }

    function resolveMaintenanceThemeState(){
      let themeName = "";
      let mode = "light";
      let hasExplicitMode = false;
      try {
        const body = document.body;
        if (body && body.classList) {
          if (body.classList.contains("theme-snow")) themeName = "snow";
          else if (body.classList.contains("theme-ramadan")) themeName = "ramadan";
          else if (body.classList.contains("theme-eid")) themeName = "eid";
          else if (body.classList.contains("theme-fall")) themeName = "fall";
          if (body.classList.contains("dark-mode")) {
            mode = "dark";
            hasExplicitMode = true;
          } else if (body.classList.contains("light-mode")) {
            mode = "light";
            hasExplicitMode = true;
          }
        }
      } catch {}
      try {
        const htmlTheme = String(document.documentElement?.getAttribute("data-theme") || "").trim().toLowerCase();
        if (htmlTheme === "dark") {
          mode = "dark";
          hasExplicitMode = true;
        } else if (htmlTheme === "light") {
          mode = "light";
          hasExplicitMode = true;
        }
      } catch {}
      if (!hasExplicitMode) {
        const storedMode = readStoredThemeMode();
        if (storedMode === "dark" || storedMode === "light") mode = storedMode;
      }
      if (!themeName) {
        try {
          const pendingTheme = window.__PENDING_SITE_THEME__;
          themeName = normalizeMaintenanceThemeName(
            pendingTheme?.name ??
            pendingTheme?.theme ??
            pendingTheme?.themeName ??
            pendingTheme?.theme_name ??
            ""
          );
        } catch {}
      }
      if (!themeName) {
        try {
          const liveState = window.__getResolvedSiteStateData ? window.__getResolvedSiteStateData() : null;
          themeName = normalizeMaintenanceThemeName(
            liveState?.theme?.name ??
            liveState?.theme?.theme ??
            liveState?.theme?.themeName ??
            liveState?.theme?.theme_name ??
            liveState?.themeName ??
            liveState?.theme_name ??
            ""
          );
        } catch {}
      }
      if (!themeName) {
        try {
          const cachedTheme = readCachedSiteTheme();
          themeName = normalizeMaintenanceThemeName(cachedTheme?.name || "");
        } catch {}
      }
      return { themeName, mode };
    }

    function applyMaintenanceThemePalette(overlay, state){
      if (!overlay || !overlay.style) return;
      const resolvedState = (state && typeof state === "object") ? state : resolveMaintenanceThemeState();
      const themeName = normalizeMaintenanceThemeName(
        resolvedState.themeName ??
        resolvedState.name ??
        ""
      );
      const mode = String(resolvedState.mode || "").trim().toLowerCase() === "dark" ? "dark" : "light";
      const setVar = (name, value) => {
        try {
          if (value == null || value === "") overlay.style.removeProperty(name);
          else overlay.style.setProperty(name, String(value));
        } catch {}
      };
      const applyVars = (vars = {}) => {
        Object.entries(vars || {}).forEach(([name, value]) => setVar(name, value));
      };
      const snowSceneUrl = MAINTENANCE_SNOW_SCENE_URL;
      const snowSceneImage = `url("${snowSceneUrl}")`;

      const defaultsLight = {
        "--maintenance-text": "#233a71",
        "--maintenance-muted": "#6a7dab",
        "--maintenance-bg": "#ecf2ff",
        "--maintenance-bg-image": "radial-gradient(540px 300px at 50% 32%, rgba(255,255,255,1) 0%, rgba(255,255,255,.94) 34%, rgba(var(--site-accent-rgb, 92, 94, 191), .08) 100%), linear-gradient(180deg, #f8faff 0%, #edf3ff 100%)",
        "--maintenance-scene-image": "none",
        "--maintenance-scene-opacity": "0",
        "--maintenance-glow": "radial-gradient(circle, rgba(255,255,255,.92) 0%, rgba(var(--site-accent-rgb, 92, 94, 191), .12) 44%, transparent 72%)",
        "--maintenance-logo-bg": "rgba(255,255,255,.95)",
        "--maintenance-logo-border": "rgba(255,255,255,.92)",
        "--maintenance-logo-shadow": "0 24px 54px rgba(var(--site-accent-rgb, 92, 94, 191), .18)",
        "--maintenance-countdown": "#f59e0b"
      };
      const defaultsDark = {
        "--maintenance-text": "#eef3ff",
        "--maintenance-muted": "#c6d3f2",
        "--maintenance-bg": "var(--site-accent-runtime-surface, #05050b)",
        "--maintenance-bg-image": "linear-gradient(180deg, var(--site-accent-runtime-surface, #05050b) 0%, var(--site-accent-runtime-surface-alt, #101223) 100%)",
        "--maintenance-scene-image": "none",
        "--maintenance-scene-opacity": "0",
        "--maintenance-glow": "radial-gradient(circle, rgba(var(--site-accent-rgb, 92, 94, 191), .18) 0%, rgba(var(--site-accent-rgb, 92, 94, 191), .08) 44%, transparent 72%)",
        "--maintenance-logo-bg": "rgba(8,12,24,.92)",
        "--maintenance-logo-border": "rgba(var(--site-accent-rgb, 92, 94, 191), .28)",
        "--maintenance-logo-shadow": "0 24px 54px rgba(0, 0, 0, .42)",
        "--maintenance-countdown": "#fbbf24"
      };
      const themeVarsMap = {
        snow: {
          light: {
            "--maintenance-text": "#28406f",
            "--maintenance-muted": "#6e83b0",
            "--maintenance-bg": "#eef5ff",
            "--maintenance-bg-image": "linear-gradient(180deg, #f8fbff 0%, #edf4ff 50%, #e8f0ff 100%)",
            "--maintenance-scene-image": snowSceneImage,
            "--maintenance-scene-opacity": "1",
            "--maintenance-glow": "none",
            "--maintenance-logo-bg": "rgba(255,255,255,.96)",
            "--maintenance-logo-border": "rgba(214, 226, 255, .95)",
            "--maintenance-logo-shadow": "0 18px 38px rgba(151, 171, 210, .18)",
            "--maintenance-countdown": "#d97706"
          },
          dark: {
            "--maintenance-text": "#eef4ff",
            "--maintenance-muted": "#cbd8f4",
            "--maintenance-bg": "var(--site-accent-runtime-surface, #05050b)",
            "--maintenance-bg-image": "linear-gradient(180deg, var(--site-accent-runtime-surface, #05050b) 0%, var(--site-accent-runtime-surface-alt, #101223) 45%, var(--site-accent-runtime-surface, #05050b) 100%)",
            "--maintenance-scene-image": snowSceneImage,
            "--maintenance-scene-opacity": ".92",
            "--maintenance-glow": "none",
            "--maintenance-logo-bg": "rgba(8,12,24,.94)",
            "--maintenance-logo-border": "rgba(226, 234, 255, .24)",
            "--maintenance-logo-shadow": "0 18px 42px rgba(0, 0, 0, .38)",
            "--maintenance-countdown": "#fbbf24"
          }
        },
        ramadan: {
          light: {
            "--maintenance-text": "#5c4320",
            "--maintenance-muted": "#8c6f41",
            "--maintenance-bg": "#fff7e8",
            "--maintenance-bg-image": "linear-gradient(180deg, #fffdf7 0%, #fff5da 54%, #fdf0cf 100%)",
            "--maintenance-glow": "none",
            "--maintenance-logo-bg": "rgba(255,250,239,.96)",
            "--maintenance-logo-border": "rgba(239, 214, 160, .92)",
            "--maintenance-logo-shadow": "0 18px 38px rgba(194, 153, 67, .18)",
            "--maintenance-countdown": "#d97706"
          },
          dark: {
            "--maintenance-text": "#f7efd4",
            "--maintenance-muted": "#e5dab0",
            "--maintenance-bg": "#07111f",
            "--maintenance-bg-image": "linear-gradient(180deg, #0a1628 0%, #050d17 100%)",
            "--maintenance-glow": "none",
            "--maintenance-logo-bg": "rgba(10,18,34,.92)",
            "--maintenance-logo-border": "rgba(229, 206, 142, .30)",
            "--maintenance-logo-shadow": "0 18px 42px rgba(0, 0, 0, .40)",
            "--maintenance-countdown": "#facc15"
          }
        },
        eid: {
          light: {
            "--maintenance-text": "#1f5d4c",
            "--maintenance-muted": "#5f8e81",
            "--maintenance-bg": "#effcf7",
            "--maintenance-bg-image": "linear-gradient(135deg, #f7fffb 0%, #ecfbf4 58%, #e3f8ef 100%)",
            "--maintenance-glow": "none",
            "--maintenance-logo-bg": "rgba(255,255,255,.96)",
            "--maintenance-logo-border": "rgba(197, 241, 223, .94)",
            "--maintenance-logo-shadow": "0 18px 38px rgba(94, 191, 151, .16)",
            "--maintenance-countdown": "#d97706"
          },
          dark: {
            "--maintenance-text": "#eefcf7",
            "--maintenance-muted": "#ccefe3",
            "--maintenance-bg": "var(--site-accent-runtime-surface, #05050b)",
            "--maintenance-bg-image": "linear-gradient(135deg, var(--site-accent-runtime-surface, #05050b) 0%, var(--site-accent-runtime-surface-alt, #101223) 60%, var(--site-accent-runtime-surface, #05050b) 100%)",
            "--maintenance-glow": "none",
            "--maintenance-logo-bg": "rgba(8,18,22,.92)",
            "--maintenance-logo-border": "rgba(140, 240, 205, .24)",
            "--maintenance-logo-shadow": "0 18px 42px rgba(0, 0, 0, .38)",
            "--maintenance-countdown": "#facc15"
          }
        },
        fall: {
          light: {
            "--maintenance-text": "#7a3f12",
            "--maintenance-muted": "#9a6a41",
            "--maintenance-bg": "#fff4e8",
            "--maintenance-bg-image": "linear-gradient(180deg, #fffaf4 0%, #fff1df 54%, #ffe6c7 100%)",
            "--maintenance-glow": "none",
            "--maintenance-logo-bg": "rgba(255,250,245,.96)",
            "--maintenance-logo-border": "rgba(247, 209, 162, .92)",
            "--maintenance-logo-shadow": "0 18px 38px rgba(196, 124, 56, .18)",
            "--maintenance-countdown": "#d97706"
          },
          dark: {
            "--maintenance-text": "#fff4e6",
            "--maintenance-muted": "#f0d3b5",
            "--maintenance-bg": "#0a0b1a",
            "--maintenance-bg-image": "radial-gradient(circle at 20% 20%, rgba(255,165,0,.08), transparent 35%), linear-gradient(180deg, #0a0b1a 0%, #090913 100%)",
            "--maintenance-glow": "none",
            "--maintenance-logo-bg": "rgba(27,16,11,.92)",
            "--maintenance-logo-border": "rgba(251, 191, 36, .24)",
            "--maintenance-logo-shadow": "0 18px 42px rgba(0, 0, 0, .38)",
            "--maintenance-countdown": "#fbbf24"
          }
        }
      };

      let vars = mode === "dark" ? defaultsDark : defaultsLight;
      if (themeName && themeVarsMap[themeName]) {
        const themedVars = themeVarsMap[themeName];
        vars = themedVars[mode] || themedVars.dark || themedVars.light || vars;
      }
      if (themeName === "snow") {
        try { preloadImageAsset(snowSceneUrl); } catch {}
      }
      applyVars(vars);
    }

    function syncMaintenanceScene(overlay, state){
      if (!overlay) return;
      const sceneWrap = overlay.querySelector(".maintenance-scene");
      if (!sceneWrap) return;
      const sceneImage = overlay.querySelector(".maintenance-scene-image");
      if (sceneImage) {
        try {
          if (sceneImage.getAttribute("src") !== MAINTENANCE_SNOW_SCENE_URL) {
            sceneImage.setAttribute("src", MAINTENANCE_SNOW_SCENE_URL);
          }
        } catch {}
      }
      const resolvedState = (state && typeof state === "object") ? state : resolveMaintenanceThemeState();
      let themeName = normalizeMaintenanceThemeName(
        resolvedState.themeName ??
        resolvedState.name ??
        ""
      );
      if (!themeName) {
        try {
          const liveState = window.__getResolvedSiteStateData ? window.__getResolvedSiteStateData() : null;
          themeName = normalizeMaintenanceThemeName(
            liveState?.theme?.name ??
            liveState?.theme?.theme ??
            liveState?.themeName ??
            liveState?.theme_name ??
            ""
          );
        } catch {}
      }
      if (!themeName) {
        try {
          if (document.body?.classList?.contains("theme-snow")) themeName = "snow";
        } catch {}
      }
      let shouldShowSnowScene = themeName === "snow";
      if (!shouldShowSnowScene) {
        try {
          shouldShowSnowScene = !!document.querySelector(".snowflake");
        } catch {}
      }
      if (!shouldShowSnowScene) {
        try {
          shouldShowSnowScene = overlay.getAttribute("data-maintenance-theme") === "snow";
        } catch {}
      }
      if (!shouldShowSnowScene) {
        sceneWrap.style.display = "none";
        sceneWrap.style.removeProperty("background-image");
        sceneWrap.removeAttribute("data-scene-theme");
        return;
      }
      sceneWrap.style.display = "block";
      sceneWrap.style.removeProperty("background-image");
      sceneWrap.setAttribute("data-scene-theme", "snow");
    }

    function syncMaintenanceTheme(overlay, nextState){
      if (!overlay) return;
      const state = (nextState && typeof nextState === "object")
        ? {
            ...resolveMaintenanceThemeState(),
            ...nextState
          }
        : resolveMaintenanceThemeState();
      if (state.mode === "dark") overlay.setAttribute("data-maintenance-mode", "dark");
      else overlay.removeAttribute("data-maintenance-mode");
      if (state.themeName) overlay.setAttribute("data-maintenance-theme", state.themeName);
      else overlay.removeAttribute("data-maintenance-theme");
      applyMaintenanceThemePalette(overlay, state);
      syncMaintenanceScene(overlay, state);
    }

    function syncActiveMaintenanceTheme(){
      try { syncMaintenanceTheme(document.getElementById("maintenance-overlay")); } catch {}
    }

    function applyMaintenance(state){
      const on = state && state.on === true;
      const untilMs = state && state.until ? Date.parse(state.until) : null;
      // If maintenance expired, turn it off immediately.
      if (on && untilMs && Date.now() > untilMs) {
        log("maintenance expired", state.until);
        applyMaintenance({ on:false });
        return;
      }
      if (!on) {
        siteMaintenanceActive = false;
        try { document.body?.classList.remove("maintenance-active"); } catch {}
        document.getElementById("maintenance-overlay")?.remove();
        if (maintTimer) { clearInterval(maintTimer); maintTimer = null; }
        applySiteNotice(siteNoticeConfig);
        log("maintenance off");
        return;
      }
      siteMaintenanceActive = true;
      try { document.body?.classList.add("maintenance-active"); } catch {}
      let overlay = document.getElementById("maintenance-overlay");
      if (!overlay) {
        overlay = document.createElement("div");
        overlay.id = "maintenance-overlay";
        overlay.innerHTML = `
          <div class="maintenance-scene">
            <img class="maintenance-scene-image" src="${MAINTENANCE_SNOW_SCENE_URL}" alt="" aria-hidden="true" loading="eager" decoding="async">
          </div>
          <div class="maintenance-shell">
            <div class="maintenance-logo">
              <img class="maintenance-logo-image" alt="شعار المتجر" hidden>
              <span class="maintenance-logo-fallback">شعار المتجر</span>
            </div>
            <h2 class="maintenance-title">مغلق للصيانة</h2>
            <p class="maintenance-copy">الرجاء العودة لاحقاً.</p>
            <div class="maintenance-status">
              <p class="countdown"></p>
            </div>
          </div>
        `;
        syncMaintenanceTheme(overlay);
        syncMaintenanceScene(overlay);
        syncMaintenanceLogo(overlay);
        document.body.appendChild(overlay);
        const logoImg = overlay.querySelector(".maintenance-logo-image");
        const logoWrap = overlay.querySelector(".maintenance-logo");
        if (logoImg && logoWrap) {
          logoImg.addEventListener("error", function(){
            try { logoImg.hidden = true; } catch {}
            logoWrap.classList.remove("has-image");
          });
        }
      }
      syncMaintenanceTheme(overlay);
      syncMaintenanceScene(overlay);
      syncMaintenanceLogo(overlay);
      const cd = overlay.querySelector(".countdown");
      const status = overlay.querySelector(".maintenance-status");
      const renderCountdown = () => {
        if (!cd || !status) return;
        if (untilMs && Date.now() > untilMs) { applyMaintenance({ on:false }); return; }
        syncMaintenanceTheme(overlay);
        syncMaintenanceScene(overlay);
        syncMaintenanceLogo(overlay);
        if (untilMs) {
          status.hidden = false;
          const diff = Math.max(0, untilMs - Date.now());
          const m = Math.floor(diff/60000), s = Math.floor((diff%60000)/1000);
          cd.textContent = `الوقت المتبقي: ${m} دقيقة ${s} ثانية`;
        } else {
          status.hidden = true;
          cd.textContent = "";
        }
      };
      if (maintTimer) clearInterval(maintTimer);
      maintTimer = setInterval(() => {
        renderCountdown();
      }, 1000);
      renderCountdown();
      log("maintenance on", state);
    }

    let particleKind = null;
    let particleTimer = null;
    let particleStartTimer = null;
    let ramadanResizeBound = false;
    // Particle caps are per-theme. Leaves should be much lighter than snow.
    const PARTICLE_MAX = { snow: 42, leaf: 32 };
    const PARTICLE_INITIAL_BURST = { snow: { wide: 5, narrow: 4 }, leaf: 4 };
    function clearThemeParticles(){
      particleKind = null;
      if (particleTimer){ clearInterval(particleTimer); particleTimer = null; }
      if (particleStartTimer){ clearTimeout(particleStartTimer); particleStartTimer = null; }
      document.querySelectorAll(".leaf,.snowflake").forEach(el=>el.remove());
    }
    function clearSpecialEffects(){ document.querySelectorAll(".ramadan-wrap,.eid-grass,.eid-firework").forEach(el=>el.remove()); }

    try {
      document.addEventListener('theme:change', syncActiveMaintenanceTheme);
    } catch {}
    try {
      window.addEventListener('storage', function(e){
        if (e && e.key === 'theme') syncActiveMaintenanceTheme();
      });
    } catch {}

    function applyRamadanAutoLayout(target = null){
      const wrap = target || document.querySelector(".ramadan-wrap");
      if (!wrap) return;
      const vw = Math.max(
        Number(window.innerWidth || 0),
        Number(document.documentElement?.clientWidth || 0)
      );
      let scale = 0.34;
      if (vw <= 900) scale = 0.31;
      if (vw <= 768) scale = 0.28;
      if (vw <= 560) scale = 0.25;
      if (vw <= 420) scale = 0.22;
      const rightPx = vw <= 768 ? 0 : Math.round(vw * 0.02);
      const shiftX = vw <= 560 ? 6 : 0;
      wrap.style.right = `${rightPx}px`;
      wrap.style.transformOrigin = "top right";
      wrap.style.transform = `translateX(${shiftX}px) scale(${scale.toFixed(3)})`;
    }

    function spawnRamadan(){
      clearSpecialEffects();
      clearThemeParticles();
      const wrap = document.createElement("div");
      wrap.className = "ramadan-wrap";
      wrap.innerHTML = `
        <div class="container">
          <div class="circle-3"></div>
          <div class="circle-2"></div>
          <div class="circle-1"></div>

          <div class="rope-1">
            <div class="string"></div>
            <div class="circle-string"></div>
          </div>

          <div class="fanous-1">
            <div class="circle-hold"></div>
            <div class="top-layer">
              <div class="inner-top-layer"></div>
            </div>
            <div class="mid-layer">
              <div class="mid-layer-left"></div>
              <div class="mid-layer-mid"></div>
              <div class="mid-layer-right"></div>
            </div>
            <div class="bottom-layer">
              <div class="left-side">
                <div class="left-glow"></div>
              </div>
              <div class="mid-side">
                <div class="mid-glow"></div>
              </div>
              <div class="right-side">
                <div class="right-glow"></div>
              </div>
            </div>
          </div>

          <div class="rope-2">
            <div class="string"></div>
          </div>

          <div class="fanous-2">
            <div class="circle-hold-fanous-2"></div>
            <div class="fanous-container">
              <div class="inner-fanous-container"></div>
            </div>
            <div class="fanous-2-face">
              <div class="glass-glow-l"></div>
              <div class="glass-glow-r"></div>
              <div class="pillar fanoos-pilar-1">
                <div class="pillar-copy"></div>
                <div class="needle"></div>
                <div class="top-circle"></div>
                <div class="bottom-circle"></div>
              </div>
              <div class="pillar fanoos-pilar-2">
                <div class="pillar-copy"></div>
                <div class="needle"></div>
                <div class="top-circle"></div>
                <div class="bottom-circle"></div>
              </div>
              <div class="pillar fanoos-pilar-3">
                <div class="pillar-copy"></div>
                <div class="needle"></div>
                <div class="top-circle"></div>
                <div class="bottom-circle"></div>
              </div>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(wrap);
      applyRamadanAutoLayout(wrap);
      if (!ramadanResizeBound) {
        window.addEventListener("resize", () => {
          if (!document.body.classList.contains("theme-ramadan")) return;
          applyRamadanAutoLayout();
        }, { passive: true });
        ramadanResizeBound = true;
      }
    }

    function spawnEid(){
      clearSpecialEffects(); clearThemeParticles();
      const grass=document.createElement("div");
      grass.className="eid-grass";
      document.body.appendChild(grass);
      const count=8;
      const frag=document.createDocumentFragment();
      for(let i=0;i<count;i++){
        const fw=document.createElement("div");
        fw.className="eid-firework";
        fw.style.left=`${10+Math.random()*80}vw`;
        fw.style.top=`${10+Math.random()*45}vh`;
        fw.style.animationDelay=`${Math.random()*1.2}s`;
        fw.style.background='radial-gradient(circle at center, var(--site-accent-runtime-light, #fde68a) 0%, var(--site-accent-runtime, var(--accent-theme, #6366f1)) 55%, rgba(0,0,0,0) 70%)';
        frag.appendChild(fw);
      }
      document.body.appendChild(frag);
    }

    function spawnThemeParticles(kind,count){
      clearThemeParticles();
      clearSpecialEffects();
      particleKind = kind;
      const max = (kind === "leaf") ? PARTICLE_MAX.leaf : PARTICLE_MAX.snow;
      const isNarrow = (() => {
        try { return !!(window.matchMedia && window.matchMedia("(max-width: 768px)").matches); }
        catch (_) { return false; }
      })();
      const intervalMs = (kind === "leaf") ? 1500 : (isNarrow ? 820 : 680);

      const makeOne = (seeded = false) => {
        if (!particleKind) return;
        const selector = (kind === "leaf") ? ".leaf" : ".snowflake";
        if (document.querySelectorAll(selector).length >= max) return;
        // Leaves are intentionally sparse to avoid covering the UI.
        if (kind === "leaf" && Math.random() < 0.5) return;
        const el=document.createElement("div");
        if(kind==="leaf"){
          el.className="leaf";
          el.textContent="🍁";
          el.style.top=`-${5+Math.random()*15}%`;
          el.style.left=`${Math.random()*100}vw`;
          el.style.animationDelay=`${Math.random()*1.2}s`;
          el.style.animationDuration=`${10+Math.random()*8}s`;
          el.style.fontSize=`${20+Math.random()*10}px`;
          el.style.transform=`rotate(${Math.random()*40-20}deg)`;
        } else if(kind==="snow"){
          el.className="snowflake";
          el.textContent="❄";
          const durationSec = 14 + Math.random() * 9;
          el.style.top=`-${5+Math.random()*15}%`;
          el.style.left=`${Math.random()*100}vw`;
          // Keep the initial screen-fill gentle; a full negative duration makes the
          // first burst look much denser than the ongoing snowfall.
          el.style.animationDelay=`${seeded ? -(Math.random() * Math.min(durationSec * 0.28, 3.2)) : -(Math.random() * 1.4)}s`;
          el.style.animationDuration=`${durationSec}s`;
          el.style.fontSize=`${12+Math.random()*9}px`;
          el.style.setProperty('--dx', `${Math.random()*80-40}px`);
        }
        el.addEventListener("animationend", ()=> el.remove(), { once:true });
        document.body.appendChild(el);
      };

      const requestedBurst = Math.max(0, Number(count) || 0);
      let burst = requestedBurst;
      if (kind === "snow") burst = Math.min(requestedBurst, isNarrow ? PARTICLE_INITIAL_BURST.snow.narrow : PARTICLE_INITIAL_BURST.snow.wide);
      if (kind === "leaf") burst = Math.min(requestedBurst, PARTICLE_INITIAL_BURST.leaf);
      for(let i=0;i<burst;i++){
        const delay = (kind === "leaf" ? 240 : 220) * i + Math.random() * (kind === "leaf" ? 180 : 220);
        setTimeout(() => makeOne(kind === "snow"), delay);
      }
      particleStartTimer = setTimeout(() => {
        if (!particleKind) return;
        particleTimer = setInterval(makeOne, intervalMs);
      }, kind === "snow" ? 320 : 700);
    }

    function normalizeThemeHexColor(value){
      const raw = String(value == null ? "" : value).trim();
      if (!raw) return "";
      if (/^#[0-9a-f]{6}$/i.test(raw)) return raw.toLowerCase();
      if (/^#[0-9a-f]{3}$/i.test(raw)) {
        return ("#" + raw[1] + raw[1] + raw[2] + raw[2] + raw[3] + raw[3]).toLowerCase();
      }
      const compact = raw.toLowerCase().replace(/[^0-9a-f]/g, "");
      if (/^[0-9a-f]{6}$/.test(compact)) return ("#" + compact);
      if (/^[0-9a-f]{3}$/.test(compact)) {
        return ("#" + compact[0] + compact[0] + compact[1] + compact[1] + compact[2] + compact[2]).toLowerCase();
      }
      return "";
    }

    function hexToRgbColor(hex){
      const clean = normalizeThemeHexColor(hex);
      if (!clean) return null;
      return {
        r: parseInt(clean.slice(1, 3), 16),
        g: parseInt(clean.slice(3, 5), 16),
        b: parseInt(clean.slice(5, 7), 16)
      };
    }

    function clampColorChannel(value){
      const n = Number(value);
      if (!Number.isFinite(n)) return 0;
      return Math.max(0, Math.min(255, Math.round(n)));
    }

    function rgbToHexColor(r, g, b){
      return "#" + [r, g, b]
        .map((v) => clampColorChannel(v).toString(16).padStart(2, "0"))
        .join("");
    }

    function mixHexColor(baseHex, targetHex, ratio){
      const base = hexToRgbColor(baseHex);
      const target = hexToRgbColor(targetHex);
      if (!base || !target) return normalizeThemeHexColor(baseHex);
      const t = Math.max(0, Math.min(1, Number(ratio) || 0));
      return rgbToHexColor(
        base.r + (target.r - base.r) * t,
        base.g + (target.g - base.g) * t,
        base.b + (target.b - base.b) * t
      );
    }

    function channelToLinearColor(value){
      const n = Math.max(0, Math.min(255, Number(value) || 0)) / 255;
      return n <= 0.03928 ? (n / 12.92) : Math.pow((n + 0.055) / 1.055, 2.4);
    }

    function relativeLuminanceColor(rgb){
      if (!rgb) return 0;
      const r = channelToLinearColor(rgb.r);
      const g = channelToLinearColor(rgb.g);
      const b = channelToLinearColor(rgb.b);
      return (0.2126 * r) + (0.7152 * g) + (0.0722 * b);
    }

    const DEFAULT_SITE_THEME_COLOR = "#5c5ebf";
    const SITE_THEME_PRESET_COLORS = Object.freeze({
      snow: "#5c5ebf",
      winter: "#5c5ebf",
      "ثلج": "#5c5ebf",
      ramadan: "#3a936f",
      "رمضان": "#3a936f",
      eid: "#f59e0b",
      "عيد": "#f59e0b",
      fall: "#c97a22",
      autumn: "#c97a22",
      "خريف": "#c97a22"
    });

    function resolveSiteThemePresetColor(name){
      const key = String(name || "").trim().toLowerCase();
      if (!key) return "";
      return normalizeThemeHexColor(SITE_THEME_PRESET_COLORS[key] || "");
    }

    function sanitizeThemeHexColor(value){
      const clean = normalizeThemeHexColor(value);
      if (!clean) return "";
      return clean;
    }

    function deriveThemePalette(baseHex){
      const base = sanitizeThemeHexColor(baseHex);
      const rgb = hexToRgbColor(base);
      if (!base || !rgb) return null;
      const strong = mixHexColor(base, "#000000", 0.18);
      const deeper = mixHexColor(base, "#000000", 0.32);
      const light = mixHexColor(base, "#ffffff", 0.62);
      const surface = mixHexColor(base, "#000000", 0.88);
      const surfaceAlt = mixHexColor(base, "#000000", 0.82);
      return {
        base,
        strong,
        deeper,
        light,
        surface,
        surfaceAlt,
        rgb: `${rgb.r}, ${rgb.g}, ${rgb.b}`,
        soft: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, .18)`,
        softStrong: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, .35)`,
        shadow: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, .26)`,
        focus: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, .32)`
      };
    }

    const SITE_ACCENT_RUNTIME_STYLE_ID = "site-accent-runtime-style";
    function applySiteAccentRuntimeCss(palette){
      if (typeof document === "undefined") return;
      let styleEl = document.getElementById(SITE_ACCENT_RUNTIME_STYLE_ID);
      if (!palette) {
        if (styleEl && styleEl.parentNode) {
          try { styleEl.parentNode.removeChild(styleEl); } catch {}
        }
        return;
      }
      if (!styleEl) {
        styleEl = document.createElement("style");
        styleEl.id = SITE_ACCENT_RUNTIME_STYLE_ID;
        const host = document.head || document.documentElement;
        if (host) host.appendChild(styleEl);
      }
      if (!styleEl) return;
      styleEl.textContent = `
:root{
  --site-accent-rgb: ${palette.rgb};
  --site-accent-runtime: ${palette.base};
  --site-accent-runtime-strong: ${palette.strong};
  --site-accent-runtime-deep: ${palette.deeper};
  --site-accent-runtime-light: ${palette.light};
  --site-accent-runtime-surface: ${palette.surface};
  --site-accent-runtime-surface-alt: ${palette.surfaceAlt};
  --site-accent-runtime-soft: ${palette.soft};
  --site-accent-runtime-soft-2: ${palette.softStrong};
  --site-accent-runtime-shadow: ${palette.shadow};
  --site-accent-runtime-focus: ${palette.focus};
}
html[data-theme="light"]{
  --card-border: ${palette.softStrong};
  --card-border-strong: ${palette.softStrong};
  --card-border-hover: ${palette.base};
  --card-gradient: linear-gradient(160deg, rgba(${palette.rgb}, .14) 0%, rgba(255,255,255,.97) 100%);
  --card-shadow: 0 4px 12px rgba(${palette.rgb}, .09);
  --card-shadow-hover: 0 8px 18px rgba(${palette.rgb}, .14);
  --modal-shadow: 0 14px 34px rgba(${palette.rgb}, .22);
}
html[data-theme="dark"]{
  --card-border: ${palette.softStrong};
  --card-border-strong: ${palette.softStrong};
  --card-border-hover: ${palette.light};
  --card-gradient: linear-gradient(160deg, rgba(${palette.rgb}, .18) 0%, rgba(10,12,30,.92) 100%);
  --card-shadow: 0 4px 14px rgba(${palette.rgb}, .12);
  --card-shadow-hover: 0 8px 20px rgba(${palette.rgb}, .18);
  --modal-shadow: 0 16px 40px rgba(${palette.rgb}, .3);
}
.settings-page{
  --primary: ${palette.base} !important;
  --primary-2: ${palette.strong} !important;
  --border: ${palette.softStrong} !important;
  --ring: 0 0 0 3px ${palette.focus} !important;
}
html[data-theme="dark"] .settings-page{
  --primary: ${palette.light} !important;
  --primary-2: ${palette.base} !important;
}
.security-page{
  --sec-accent: ${palette.base} !important;
  --sec-border: ${palette.softStrong} !important;
}
html[data-theme="dark"] .security-page{
  --sec-accent: ${palette.light} !important;
}
.top-header{
  background: linear-gradient(135deg, ${palette.strong}, ${palette.base}) !important;
  box-shadow: 0 6px 14px ${palette.shadow} !important;
}
#sidebar{
  background: linear-gradient(135deg, ${palette.deeper}, ${palette.base}) !important;
}
#sidebar ul li:hover{
  background: ${palette.softStrong} !important;
}
#langLi .lang-pm-select-option:hover,
#langLi .lang-pm-select-option:focus,
#currencyLi .currency-pm-select-option:hover,
#currencyLi .currency-pm-select-option:focus{
  background: ${palette.softStrong} !important;
}
#langLi .lang-pm-select-option.selected,
#currencyLi .currency-pm-select-option.selected{
  background: linear-gradient(135deg, ${palette.base}, ${palette.strong}) !important;
  border-color: ${palette.light} !important;
  color: #ffffff !important;
}
body.dark-mode .top-header,
html[data-theme="dark"] .top-header{
  background: linear-gradient(135deg, ${palette.deeper}, ${palette.strong}) !important;
}
body.dark-mode #sidebar,
html[data-theme="dark"] #sidebar{
  background: linear-gradient(135deg, ${palette.deeper}, ${palette.strong}) !important;
}
body.dark-mode label i,
body.light-mode label i{
  color: ${palette.base} !important;
}
.categories .card,
.categories .offer-box.card,
a.card.auto,
.catalog-branch-card{
  border-color: transparent !important;
  box-shadow: none !important;
  background: transparent !important;
  background-image: none !important;
  background-color: transparent !important;
}
html[data-theme="light"] .categories .card,
html[data-theme="light"] .categories .offer-box.card,
html[data-theme="light"] a.card.auto,
html[data-theme="light"] .catalog-branch-card{
  background: transparent !important;
  background-image: none !important;
  background-color: transparent !important;
}
html[data-theme="dark"] .categories .card,
html[data-theme="dark"] .categories .offer-box.card,
html[data-theme="dark"] a.card.auto,
html[data-theme="dark"] .catalog-branch-card{
  background: transparent !important;
  background-image: none !important;
  background-color: transparent !important;
}
html[data-theme="light"] .categories .card h2,
html[data-theme="light"] .categories .offer-box.card h2,
html[data-theme="light"] a.card.auto h2,
html[data-theme="light"] .catalog-branch-card h2{
  color: ${palette.strong} !important;
}
html[data-theme="dark"] .categories .card h2,
html[data-theme="dark"] .categories .offer-box.card h2,
html[data-theme="dark"] a.card.auto h2,
html[data-theme="dark"] .catalog-branch-card h2{
  color: ${palette.light} !important;
}
.reviews-page .user-name,
.reviews-page .review-header .username,
.reviews-page .reply-link,
.wallet-page h2,
.settings-page h2,
.security-header h2,
.content-container h2,
.section-title,
.footer-title,
.icon-box i{
  color: ${palette.base} !important;
}
.reviews-page button,
.reviews-page .reply-box .send-reply,
.btn-show-proof,
.send-button,
.search-container button,
.transfer-modal .btn-primary,
.security-btn:not(.ghost),
.settings-page #resetBtn,
.smm-inline-submit{
  background: linear-gradient(135deg, ${palette.light}, ${palette.base}) !important;
  border-color: ${palette.base} !important;
  color: #ffffff !important;
}
.reviews-page .rating-filter.active,
.wallet-page .chip[data-filter="all"].active,
.content-container .chip[data-filter="all"].active,
.content-container #dateChip.active{
  background: linear-gradient(135deg, ${palette.softStrong}, ${palette.base}) !important;
  border-color: ${palette.base} !important;
  color: #ffffff !important;
}
.wallet-page .chip.active,
.content-container .chip.active{
  border-color: ${palette.base} !important;
  box-shadow: 0 0 0 2px ${palette.focus} !important;
}
.reviews-page .header-avatar{
  background: linear-gradient(135deg, ${palette.base}, ${palette.light}) !important;
}
.reviews-page .vote-count{
  color: ${palette.base} !important;
}
.reviews-page .reply-box,
.content-container,
.settings-page .container,
.settings-page .info-card,
.security-card,
.device-card,
.modal-content,
.reviews-page main,
.wallet-page main,
.wallet-page .card,
.transfer-recipient,
.transfer-field,
.transfer-modal{
  border-color: ${palette.softStrong} !important;
  box-shadow: 0 10px 28px ${palette.shadow} !important;
}
.content-container,
.settings-page .container,
.security-card,
.reviews-page main,
.wallet-page main{
  background-image: linear-gradient(165deg, rgba(${palette.rgb}, .08) 0%, transparent 100%) !important;
}
.wallet-page .card.selected{
  border-color: ${palette.base} !important;
  box-shadow: 0 0 0 2px ${palette.softStrong} !important;
}
body.dark-mode .wallet-page .card.selected,
html[data-theme="dark"] .wallet-page .card.selected{
  border-color: ${palette.light} !important;
  box-shadow: 0 0 0 2px ${palette.softStrong} !important;
}
input:focus,
textarea:focus,
select:focus,
input:focus-visible,
textarea:focus-visible,
select:focus-visible{
  border-color: ${palette.base} !important;
  box-shadow: 0 0 0 3px ${palette.focus} !important;
}
.reviews-page .reviews-list::-webkit-scrollbar-thumb{
  background: ${palette.base} !important;
}
.transfer-page,
.transfer-modal{
  --t-primary: ${palette.base} !important;
  --t-glow: ${palette.softStrong} !important;
}
html[data-theme="light"] .smm-inline-form,
html[data-theme="light"] .smm-inline-field,
html[data-theme="light"] .smm-inline-select,
html[data-theme="light"] .smm-select-trigger,
html[data-theme="light"] .smm-select-dropdown,
html[data-theme="light"] .smm-inline-description-body,
html[data-theme="light"] #wa-join-modal .wa-modal-content{
  background: linear-gradient(165deg, rgba(${palette.rgb}, .1) 0%, rgba(255,255,255,.98) 100%) !important;
  border-color: ${palette.softStrong} !important;
}
html[data-theme="dark"] .smm-inline-form,
html[data-theme="dark"] .smm-inline-field,
html[data-theme="dark"] .smm-inline-select,
html[data-theme="dark"] .smm-select-trigger,
html[data-theme="dark"] .smm-select-dropdown,
html[data-theme="dark"] .smm-inline-description-body,
html[data-theme="dark"] #wa-join-modal .wa-modal-content{
  background: linear-gradient(165deg, rgba(${palette.rgb}, .12) 0%, ${palette.surface} 100%) !important;
  border-color: ${palette.softStrong} !important;
}
.smm-inline-submit,
#wa-join-modal .wa-primary{
  background: linear-gradient(135deg, ${palette.light} 0%, ${palette.base} 55%, ${palette.strong} 100%) !important;
  box-shadow: 0 16px 34px ${palette.shadow} !important;
  border-color: ${palette.base} !important;
}
.smm-option-pill,
.smm-value-pill,
.smm-service-pill{
  background: linear-gradient(135deg, ${palette.softStrong}, ${palette.soft}) !important;
  border-color: ${palette.softStrong} !important;
}
`;
    }

    function applySiteAccentColor(rawColor){
      const root = document.documentElement;
      if (!root || !root.style) return;
      let palette = deriveThemePalette(rawColor);
      if (!palette) {
        let fallbackColor = normalizeThemeHexColor(root.style.getPropertyValue("--site-accent-runtime"));
        if (!fallbackColor) fallbackColor = normalizeThemeHexColor(root.style.getPropertyValue("--accent-theme"));
        if (!fallbackColor) {
          try {
            const computed = getComputedStyle(root);
            fallbackColor =
              normalizeThemeHexColor(computed.getPropertyValue("--site-accent-runtime")) ||
              normalizeThemeHexColor(computed.getPropertyValue("--accent-theme")) ||
              "";
          } catch {}
        }
        palette = deriveThemePalette(fallbackColor || DEFAULT_SITE_THEME_COLOR);
      }
      if (!palette) return;
      root.style.setProperty("--accent-theme", palette.base);
      root.style.setProperty("--accent", palette.base);
      root.style.setProperty("--sec-accent", palette.base);
      root.style.setProperty("--t-accent", palette.light);
      root.style.setProperty("--t-primary", palette.base);
      root.style.setProperty("--t-glow", palette.softStrong);
      root.style.setProperty("--btn-bg", palette.base);
      root.style.setProperty("--btn-bg-hover", palette.strong);
      root.style.setProperty("--primary", palette.base);
      root.style.setProperty("--primary-2", palette.strong);
      root.style.setProperty("--primary-dark", palette.deeper);
      root.style.setProperty("--primary-light", palette.light);
      root.style.setProperty("--input-border", palette.softStrong);
      root.style.setProperty("--input-border-focus", palette.strong);
      root.style.setProperty("--focus-ring", palette.focus);
      root.style.setProperty("--card-border", palette.softStrong);
      root.style.setProperty("--card-border-strong", palette.softStrong);
      root.style.setProperty("--card-border-hover", palette.softStrong);
      root.style.setProperty("--card-shadow", `0 4px 12px rgba(${palette.rgb}, .12)`);
      root.style.setProperty("--card-shadow-hover", `0 8px 18px rgba(${palette.rgb}, .18)`);
      root.style.setProperty("--modal-shadow", `0 16px 40px ${palette.shadow}`);
      root.style.setProperty("--site-accent-soft", palette.soft);
      root.style.setProperty("--site-accent-soft-2", palette.softStrong);
      root.style.setProperty("--site-accent-shadow", palette.shadow);
      root.style.setProperty("--site-accent-rgb", palette.rgb);
      root.style.setProperty("--site-accent-runtime-surface", palette.surface);
      root.style.setProperty("--site-accent-runtime-surface-alt", palette.surfaceAlt);
      applySiteAccentRuntimeCss(palette);
    }

    function syncActiveSiteTextColors(){
      const root = document.documentElement;
      if (!root || !root.style) return;
      const light = normalizeThemeHexColor(
        root.style.getPropertyValue("--site-text-light") ||
        root.style.getPropertyValue("--balance-text-light") ||
        ""
      );
      const dark = normalizeThemeHexColor(
        root.style.getPropertyValue("--site-text-dark") ||
        root.style.getPropertyValue("--balance-text-dark") ||
        ""
      );
      const isDark = String(root.getAttribute("data-theme") || "").toLowerCase() === "dark" ||
        (document.body && document.body.classList && document.body.classList.contains("dark-mode"));
      const active = isDark ? (dark || light) : (light || dark);
      const activeKeys = [
        "--text",
        "--muted",
        "--card-text",
        "--input-text",
        "--modal-text",
        "--balance-subtext",
        "--balance-text",
        "--balance-currency",
        "--legal-updated-color"
      ];
      if (!active) {
        activeKeys.forEach((key) => root.style.removeProperty(key));
        return;
      }
      root.style.setProperty("--text", active);
      root.style.setProperty("--muted", active);
      root.style.setProperty("--card-text", active);
      root.style.setProperty("--input-text", active);
      root.style.setProperty("--modal-text", active);
      root.style.setProperty("--balance-subtext", active);
      root.style.setProperty("--balance-text", active);
      root.style.setProperty("--balance-currency", active);
      root.style.setProperty("--legal-updated-color", active);
    }

    function applySiteBalanceTextColors(theme){
      const root = document.documentElement;
      if (!root || !root.style) return;
      const normalizedTheme = normalizeSiteThemeState(theme);
      const light = normalizeThemeHexColor(normalizedTheme.textColorLight || normalizedTheme.balanceColorLight || "");
      const dark = normalizeThemeHexColor(normalizedTheme.textColorDark || normalizedTheme.balanceColorDark || "");
      if (light) {
        root.style.setProperty("--site-text-light", light);
        root.style.setProperty("--site-muted-light", light);
        root.style.setProperty("--balance-text-light", light);
        root.style.setProperty("--balance-currency-light", light);
      } else {
        root.style.removeProperty("--site-text-light");
        root.style.removeProperty("--site-muted-light");
        root.style.removeProperty("--balance-text-light");
        root.style.removeProperty("--balance-currency-light");
      }
      if (dark) {
        root.style.setProperty("--site-text-dark", dark);
        root.style.setProperty("--site-muted-dark", dark);
        root.style.setProperty("--balance-text-dark", dark);
        root.style.setProperty("--balance-currency-dark", dark);
      } else {
        root.style.removeProperty("--site-text-dark");
        root.style.removeProperty("--site-muted-dark");
        root.style.removeProperty("--balance-text-dark");
        root.style.removeProperty("--balance-currency-dark");
      }
      syncActiveSiteTextColors();
    }

    const SITE_THEME_RUNTIME_STYLE_ID = "site-theme-runtime-style";
    function ensureSiteThemeRuntimeStyleTag(){
      try {
        let style = document.getElementById(SITE_THEME_RUNTIME_STYLE_ID);
        if (style) return style;
        style = document.createElement("style");
        style.id = SITE_THEME_RUNTIME_STYLE_ID;
        document.head && document.head.appendChild(style);
        return style;
      } catch {
        return null;
      }
    }
    function applySiteThemeDetailRuntimeCss(theme){
      const normalizedTheme = normalizeSiteThemeState(theme || {});
      const style = ensureSiteThemeRuntimeStyleTag();
      const root = document.documentElement;
      if (!style || !root || !root.style) return;
      const balanceAccentColor = normalizeThemeHexColor(normalizedTheme.balanceAccentColor || "");
      const sectionTitleColor = normalizeThemeHexColor(normalizedTheme.sectionTitleColor || "");
      const productTitleColor = normalizeThemeHexColor(normalizedTheme.productTitleColor || "");
      const productPriceColor = normalizeThemeHexColor(normalizedTheme.productPriceColor || "");
      if (balanceAccentColor) root.style.setProperty("--site-balance-accent", balanceAccentColor);
      else root.style.removeProperty("--site-balance-accent");
      if (sectionTitleColor) root.style.setProperty("--site-section-title", sectionTitleColor);
      else root.style.removeProperty("--site-section-title");
      if (productTitleColor) root.style.setProperty("--site-product-title", productTitleColor);
      else root.style.removeProperty("--site-product-title");
      if (productPriceColor) root.style.setProperty("--site-product-price", productPriceColor);
      else root.style.removeProperty("--site-product-price");
      const css = `
:root{
  --site-category-grid-desktop:${normalizedTheme.categoryGridDesktop};
  --site-category-grid-mobile:${normalizedTheme.categoryGridMobile};
  --site-category-image-shape:${normalizedTheme.categoryImageShape};
  --site-product-grid-desktop:${normalizedTheme.productGridDesktop};
  --site-product-grid-mobile:${normalizedTheme.productGridMobile};
  --site-product-image-shape:${normalizedTheme.productImageShape};
}
${balanceAccentColor ? `
.header-balance,
.header-balance__currency,
#balanceHeader,
#headerBalanceCurrency,
.header-balance__value,
#headerBalanceText,
#balanceAmount,
#sidebarBalanceValue,
[data-user-balance]{
  color:${balanceAccentColor} !important;
}
` : ``}
${sectionTitleColor ? `
.wallet-page h2,
.settings-page h2,
.security-header h2,
.content-container h2,
.section-title,
.footer-title{
  color:${sectionTitleColor} !important;
}
` : ``}
${productTitleColor ? `
.categories > .card h2,
.catalog-inline-host .categories .card h2,
.catalog-branch-card h2,
#catalogOffersContainer .card h2,
.offer-box.card h2,
#depositInlineApp .categories .card h2{
  color:${productTitleColor} !important;
}
` : ``}
${productPriceColor ? `
.offer-price,
#pm-price,
.pm-pill,
.voucher .price,
#depositInlineApp .categories .card .offer-price,
.card.catalog-card[data-card-type="product"] .offer-price{
  color:${productPriceColor} !important;
}
` : ``}
.categories,
.home-sections .categories,
.catalog-inline-host .categories,
#depositInlineApp #grid.categories,
#depositInlineApp .categories{
  grid-template-columns:repeat(${normalizedTheme.categoryGridDesktop},minmax(0,1fr)) !important;
}
#catalogOffersContainer,
.inline-favorites-grid{
  grid-template-columns:repeat(${normalizedTheme.productGridDesktop},minmax(0,1fr)) !important;
}
.categories > .card img,
.categories > .card .catalog-card-media,
.catalog-inline-host .categories .card img,
.catalog-inline-host .categories .card .catalog-card-media,
#depositInlineApp .categories .card img,
#depositInlineApp .categories .card .catalog-card-media{
  aspect-ratio:${normalizedTheme.categoryImageShape} !important;
  object-fit:cover !important;
}
#catalogOffersContainer .card img,
#catalogOffersContainer .card .catalog-card-media,
.offer-box.card img,
.offer-box.card .catalog-card-media{
  aspect-ratio:${normalizedTheme.productImageShape} !important;
  object-fit:cover !important;
}
@media (max-width:768px){
  .categories,
  .home-sections .categories,
  .catalog-inline-host .categories,
  #depositInlineApp #grid.categories,
  #depositInlineApp .categories{
    grid-template-columns:repeat(${normalizedTheme.categoryGridMobile},minmax(0,1fr)) !important;
  }
  #catalogOffersContainer,
  .inline-favorites-grid{
    grid-template-columns:repeat(${normalizedTheme.productGridMobile},minmax(0,1fr)) !important;
  }
}
`;
      style.textContent = css;
    }

    document.addEventListener("theme:change", function(){
      syncActiveSiteTextColors();
    });
    try {
      window.addEventListener("storage", function(e){
        if (e && e.key === "theme") syncActiveSiteTextColors();
      });
    } catch {}

    const SITE_THEME_CACHE_KEY = "site:theme:v1";
    function normalizeSiteThemeMode(value, fallback){
      const text = String(value == null ? "" : value).trim().toLowerCase();
      if (text === "dark") return "dark";
      if (text === "light") return "light";
      return String(fallback || "").trim().toLowerCase() === "dark" ? "dark" : "light";
    }
    function normalizeSiteLayoutCount(value, fallback){
      const num = Number(value);
      if (Number.isFinite(num)) return Math.max(1, Math.min(6, Math.trunc(num)));
      const fallbackNum = Number(fallback);
      return Number.isFinite(fallbackNum) ? Math.max(1, Math.min(6, Math.trunc(fallbackNum))) : 3;
    }
    function normalizeSiteLayoutShape(value, fallback){
      const raw = String(value == null ? "" : value).trim().toLowerCase();
      const map = {
        square: "1/1",
        "1:1": "1/1",
        "1/1": "1/1",
        portrait: "3/4",
        tall: "3/4",
        "3:4": "3/4",
        "3/4": "3/4",
        landscape: "4/3",
        wide: "4/3",
        "4:3": "4/3",
        "4/3": "4/3",
        banner: "16/9",
        hero: "16/9",
        "16:9": "16/9",
        "16/9": "16/9"
      };
      if (map[raw]) return map[raw];
      const fallbackKey = String(fallback == null ? "" : fallback).trim().toLowerCase();
      return map[fallbackKey] || "1/1";
    }
    function normalizeSiteThemeState(raw){
      const src = (raw && typeof raw === "object") ? raw : {};
      const name = String(
        src.name ??
        src.theme ??
        src.themeName ??
        src.theme_name ??
        src.type ??
        ""
      ).trim().slice(0, 80);
      const color = sanitizeThemeHexColor(
        src.siteMainColor ??
        src.site_main_color ??
        src.color ??
        src.accent ??
        src.primary ??
        resolveSiteThemePresetColor(name) ??
        ""
      ) || resolveSiteThemePresetColor(name);
      const textShared = normalizeThemeHexColor(
        src.textColor ??
        src.text_color ??
        src.balanceColor ??
        src.balance_color ??
        src.textColorValue ??
        src.text_color_value ??
        src.balanceTextColor ??
        src.balance_text_color ??
        src.textColorText ??
        src.text_color_text ??
        src.balanceText ??
        src.balance_text ??
        ""
      );
      const textColorLight = normalizeThemeHexColor(
        src.textColorLight ??
        src.text_color_light ??
        src.textLightColor ??
        src.text_light_color ??
        src.balanceColorLight ??
        src.balance_color_light ??
        src.textColorLightValue ??
        src.text_color_light_value ??
        src.balanceTextLight ??
        src.balance_text_light ??
        src.balanceLightColor ??
        src.balance_light_color ??
        textShared
      );
      const textColorDark = normalizeThemeHexColor(
        src.textColorDark ??
        src.text_color_dark ??
        src.textDarkColor ??
        src.text_dark_color ??
        src.balanceColorDark ??
        src.balance_color_dark ??
        src.textColorDarkValue ??
        src.text_color_dark_value ??
        src.balanceTextDark ??
        src.balance_text_dark ??
        src.balanceDarkColor ??
        src.balance_dark_color ??
        textShared
      );
      return {
        name,
        color,
        siteMainColor: color,
        balanceColorLight: textColorLight,
        balanceColorDark: textColorDark,
        textColorLight,
        textColorDark,
        defaultMode: normalizeSiteThemeMode(
          src.defaultMode ??
          src.default_mode ??
          src.defaultThemeMode ??
          src.default_theme_mode ??
          "",
          "light"
        ),
        balanceAccentColor: normalizeThemeHexColor(
          src.balanceAccentColor ??
          src.balance_accent_color ??
          src.userBalanceColor ??
          src.user_balance_color ??
          src.balanceAmountColor ??
          src.balance_amount_color ??
          ""
        ),
        sectionTitleColor: normalizeThemeHexColor(
          src.sectionTitleColor ??
          src.section_title_color ??
          src.categoryTitleColor ??
          src.category_title_color ??
          ""
        ),
        productTitleColor: normalizeThemeHexColor(
          src.productTitleColor ??
          src.product_title_color ??
          ""
        ),
        productPriceColor: normalizeThemeHexColor(
          src.productPriceColor ??
          src.product_price_color ??
          src.priceColor ??
          src.price_color ??
          ""
        ),
        categoryGridDesktop: normalizeSiteLayoutCount(
          src.categoryGridDesktop ??
          src.category_grid_desktop ??
          src.categoryCardsDesktop ??
          src.category_cards_desktop ??
          5,
          5
        ),
        categoryGridMobile: normalizeSiteLayoutCount(
          src.categoryGridMobile ??
          src.category_grid_mobile ??
          src.categoryCardsMobile ??
          src.category_cards_mobile ??
          3,
          3
        ),
        categoryImageShape: normalizeSiteLayoutShape(
          src.categoryImageShape ??
          src.category_image_shape ??
          src.categoryCardShape ??
          src.category_card_shape ??
          "1/1",
          "1/1"
        ),
        productGridDesktop: normalizeSiteLayoutCount(
          src.productGridDesktop ??
          src.product_grid_desktop ??
          src.productCardsDesktop ??
          src.product_cards_desktop ??
          5,
          5
        ),
        productGridMobile: normalizeSiteLayoutCount(
          src.productGridMobile ??
          src.product_grid_mobile ??
          src.productCardsMobile ??
          src.product_cards_mobile ??
          3,
          3
        ),
        productImageShape: normalizeSiteLayoutShape(
          src.productImageShape ??
          src.product_image_shape ??
          src.productCardShape ??
          src.product_card_shape ??
          "1/1",
          "1/1"
        )
      };
    }

    function cacheSiteTheme(theme){
      try {
        const normalized = normalizeSiteThemeState(theme);
        localStorage.setItem(SITE_THEME_CACHE_KEY, JSON.stringify(normalized));
      } catch {}
    }

    function isLegacyCachedThemeFallback(theme){
      const normalized = (theme && typeof theme === "object") ? theme : {};
      const name = String(normalized.name || "").trim();
      const color = normalizeThemeHexColor(normalized.color || "");
      const textColorLight = normalizeThemeHexColor(normalized.textColorLight || normalized.balanceColorLight || "");
      const textColorDark = normalizeThemeHexColor(normalized.textColorDark || normalized.balanceColorDark || "");
      return !name && color === "#64748b" && !textColorLight && !textColorDark;
    }

    function readCachedSiteTheme(){
      try {
        const raw = localStorage.getItem(SITE_THEME_CACHE_KEY);
        if (!raw) return null;
        const normalized = normalizeSiteThemeState(JSON.parse(raw));
        if (isLegacyCachedThemeFallback(normalized)) return null;
        return normalized;
      } catch {
        return null;
      }
    }

    let pendingThemeApplyBound = false;
    let pendingThemeApplyTimer = null;
    let activeSiteThemeSignature = "";
    function schedulePendingThemeApply(theme){
      try { window.__PENDING_SITE_THEME__ = normalizeSiteThemeState(theme || {}); } catch {}
      if (!pendingThemeApplyBound && document.readyState === "loading") {
        pendingThemeApplyBound = true;
        document.addEventListener("DOMContentLoaded", function(){
          pendingThemeApplyBound = false;
          const pending = window.__PENDING_SITE_THEME__;
          if (pending) applyTheme(pending);
        }, { once: true });
      }
      try { clearTimeout(pendingThemeApplyTimer); } catch {}
      pendingThemeApplyTimer = setTimeout(function(){
        try {
          if (!document.body) return;
          const pending = window.__PENDING_SITE_THEME__;
          if (pending) applyTheme(pending);
        } catch {}
      }, 120);
    }

    function resolveSiteThemeClassName(name){
      const normalized = String(name || "").trim().toLowerCase();
      if (["fall","autumn","خريف"].includes(normalized)) return "theme-fall";
      if (["snow","winter","ثلج"].includes(normalized)) return "theme-snow";
      if (["ramadan","رمضان"].includes(normalized)) return "theme-ramadan";
      if (["eid","عيد"].includes(normalized)) return "theme-eid";
      return "";
    }

    function bodyMatchesSeasonalTheme(body, name){
      if (!body || !body.classList) return false;
      const targetClass = resolveSiteThemeClassName(name);
      const currentThemeClasses = Array.from(body.classList).filter((cls) => cls.startsWith("theme-"));
      if (!targetClass) return currentThemeClasses.length === 0;
      return currentThemeClasses.length === 1 && body.classList.contains(targetClass);
    }

    function ensureSiteThemeMeta(name){
      try {
        let meta = document.querySelector(`meta[name="${name}"]`);
        if (!meta) {
          meta = document.createElement("meta");
          meta.name = name;
          document.head && document.head.appendChild(meta);
        }
        return meta;
      } catch {
        return null;
      }
    }

    function resolveAppliedSiteThemeMode(theme){
      const storedMode = readStoredThemeMode();
      if (storedMode === "dark" || storedMode === "light") return storedMode;
      return normalizeSiteThemeMode(
        theme && (
          theme.defaultMode ??
          theme.default_mode ??
          theme.defaultThemeMode ??
          theme.default_theme_mode
        ),
        "light"
      );
    }

    function applyDocumentThemeMode(theme){
      const mode = resolveAppliedSiteThemeMode(theme);
      let changed = false;
      try {
        const current = String(document.documentElement?.getAttribute("data-theme") || "").trim().toLowerCase();
        if (current !== mode) changed = true;
        document.documentElement.setAttribute("data-theme", mode);
      } catch {}
      try {
        const body = document.body;
        if (body && body.classList) {
          const hasDark = body.classList.contains("dark-mode");
          const hasLight = body.classList.contains("light-mode");
          if ((mode === "dark" && (!hasDark || hasLight)) || (mode === "light" && (!hasLight || hasDark))) {
            changed = true;
          }
          body.classList.toggle("dark-mode", mode === "dark");
          body.classList.toggle("light-mode", mode === "light");
        }
      } catch {}
      try {
        const colorSchemeMeta = ensureSiteThemeMeta("color-scheme");
        if (colorSchemeMeta) {
          colorSchemeMeta.setAttribute("content", mode === "dark" ? "dark light" : "light dark");
        }
      } catch {}
      try {
        const themeColorMeta = ensureSiteThemeMeta("theme-color");
        if (themeColorMeta) {
          themeColorMeta.setAttribute("content", mode === "dark" ? "#05050b" : "#f8f9fa");
        }
      } catch {}
      if (changed) {
        try {
          document.dispatchEvent(new CustomEvent("theme:change", { detail: { theme: mode } }));
        } catch {}
      }
      return mode;
    }

    function applyTheme(theme){
      const normalizedTheme = normalizeSiteThemeState(theme);
      const name = String(normalizedTheme?.name || "").toLowerCase().trim();
      const color = normalizedTheme?.color || "";
      const appliedMode = applyDocumentThemeMode(normalizedTheme);
      applySiteAccentColor(color);
      applySiteBalanceTextColors(normalizedTheme);
      applySiteThemeDetailRuntimeCss(normalizedTheme);
      cacheSiteTheme(normalizedTheme);
      const body = document.body;
      if (!body || !body.classList) {
        schedulePendingThemeApply(normalizedTheme);
        log("theme queued", name, color);
        return;
      }
      const nextThemeSignature = [
        name,
        color,
        appliedMode,
        String(normalizedTheme?.balanceColorLight || ""),
        String(normalizedTheme?.balanceColorDark || ""),
        String(normalizedTheme?.defaultMode || ""),
        String(normalizedTheme?.balanceAccentColor || ""),
        String(normalizedTheme?.sectionTitleColor || ""),
        String(normalizedTheme?.productTitleColor || ""),
        String(normalizedTheme?.productPriceColor || ""),
        String(normalizedTheme?.categoryGridDesktop || ""),
        String(normalizedTheme?.categoryGridMobile || ""),
        String(normalizedTheme?.categoryImageShape || ""),
        String(normalizedTheme?.productGridDesktop || ""),
        String(normalizedTheme?.productGridMobile || ""),
        String(normalizedTheme?.productImageShape || "")
      ].join("|");
      if (activeSiteThemeSignature === nextThemeSignature && bodyMatchesSeasonalTheme(body, name)) {
        try { syncMaintenanceTheme(document.getElementById("maintenance-overlay")); } catch {}
        try { window.__PENDING_SITE_THEME__ = null; } catch {}
        log("theme preserved", name, color);
        return;
      }
      body.classList.remove(...Array.from(body.classList).filter((cls) => cls.startsWith("theme-")));
      clearSpecialEffects(); clearThemeParticles();
      if (["fall","autumn","خريف"].includes(name)) { body.classList.add("theme-fall"); spawnThemeParticles("leaf",6); }
      else if (["snow","winter","ثلج"].includes(name)) { body.classList.add("theme-snow"); spawnThemeParticles("snow",5); }
      else if (["ramadan","رمضان"].includes(name)) { body.classList.add("theme-ramadan"); spawnRamadan(); }
      else if (["eid","عيد"].includes(name)) { body.classList.add("theme-eid"); spawnEid(); }
      activeSiteThemeSignature = nextThemeSignature;
      try { syncMaintenanceTheme(document.getElementById("maintenance-overlay")); } catch {}
      try { window.__PENDING_SITE_THEME__ = null; } catch {}
      log("theme applied", name, color);
    }

    const SITE_MEDIA_CACHE_KEY = "site:media:v1";
    const SITE_BRAND_CACHE_KEY = "site:brand:v1";
    const DEFAULT_SITE_LOADER_LOGO = resolveSiteMediaFallbackUrl("loader");
    const DEFAULT_SITE_HEADER_LOGO = resolveSiteMediaFallbackUrl("header");
    const DEFAULT_SITE_ICON = resolveSiteMediaFallbackUrl("icon");
    const DEFAULT_SITE_BRAND = (() => {
      try {
        return window.__getSiteBrandConfig ? window.__getSiteBrandConfig() : {};
      } catch (_) {
        return {};
      }
    })();
    const DEFAULT_SITE_STORE_NAME = String(DEFAULT_SITE_BRAND.storeName || "").trim();
    const DEFAULT_SITE_TICKER_TEXT = String(DEFAULT_SITE_BRAND.tickerText || "").trim();
    const DEFAULT_SITE_HERO_BANNERS = [];

    function normalizeSiteMediaUrl(value){
      const text = String(value == null ? "" : value).trim();
      if (!text) return "";
      return text.slice(0, 2000);
    }

    function normalizeSiteBannerLink(value){
      const text = String(value == null ? "" : value).trim();
      if (!text) return "";
      if (/^javascript:/i.test(text)) return "";
      if (/^(https?:\/\/|mailto:|tel:|tg:\/\/|whatsapp:)/i.test(text)) return text.slice(0, 2000);
      if (/^(\/|#|\.\/|\.\.\/)/.test(text)) return text.slice(0, 2000);
      if (/^[\w.-]+\.[a-z]{2,}(?:[/?#]|$)/i.test(text)) return ("https://" + text).slice(0, 2000);
      return text.slice(0, 2000);
    }

    function normalizeSiteCollectionId(value, fallback){
      const text = String(value == null ? "" : value).trim().toLowerCase()
        .replace(/[^a-z0-9_-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80);
      if (text) return text;
      const fallbackText = String(fallback == null ? "" : fallback).trim().toLowerCase()
        .replace(/[^a-z0-9_-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80);
      return fallbackText || ("banner-" + Date.now().toString(36));
    }

    function normalizeSiteCollectionOrder(value, fallback){
      const num = Number(value);
      if (Number.isFinite(num)) return Math.max(0, Math.min(999, Math.trunc(num)));
      const fallbackNum = Number(fallback);
      return Number.isFinite(fallbackNum) ? Math.max(0, Math.min(999, Math.trunc(fallbackNum))) : 0;
    }

    function normalizeSiteMediaBannerEntry(entry){
      const src = (entry && typeof entry === "object" && !Array.isArray(entry)) ? entry : null;
      const image = normalizeSiteMediaUrl(
        src
          ? (
            src.image ??
            src.imageUrl ??
            src.image_url ??
            src.src ??
            src.banner ??
            src.bannerUrl ??
            src.banner_url ??
            src.url ??
            ""
          )
          : entry
      );
      if (!image) return null;
      const href = normalizeSiteBannerLink(
        src
          ? (
            src.href ??
            src.link ??
            src.target ??
            src.clickUrl ??
            src.click_url ??
            src.openUrl ??
            src.open_url ??
            ""
          )
          : ""
      );
      const order = normalizeSiteCollectionOrder(
        src
          ? (
            src.order ??
            src.rank ??
            src.position ??
            src.sort ??
            src.sortOrder ??
            src.sort_order ??
            0
          )
          : 0,
        0
      );
      const enabled = !(
        src &&
        (
          src.enabled === false ||
          src.on === false ||
          src.active === false ||
          src.visible === false ||
          src.show === false ||
          String(src.enabled ?? src.on ?? src.active ?? src.visible ?? src.show ?? "").trim().toLowerCase() === "false"
        )
      );
      const id = normalizeSiteCollectionId(
        src
          ? (
            src.id ??
            src.key ??
            src.bannerId ??
            src.banner_id ??
            ""
          )
          : "",
        "banner-" + String(order)
      );
      return { id, image, href, order, enabled: !!enabled };
    }

    function normalizeSiteMediaBanners(list){
      const source = Array.isArray(list) ? list : (list != null ? [list] : []);
      const out = [];
      const seen = new Set();
      source.forEach((entry) => {
        const normalized = normalizeSiteMediaBannerEntry(entry);
        if (!normalized || !normalized.image) return;
        const key = [normalized.id, normalized.image, normalized.href].join("|");
        if (seen.has(key)) return;
        seen.add(key);
        out.push(normalized);
        if (out.length >= 8) return;
      });
      return out
        .sort((left, right) => {
          if (left.order !== right.order) return left.order - right.order;
          return String(left.id || "").localeCompare(String(right.id || ""));
        })
        .slice(0, 8);
    }

    function normalizeSiteMediaState(raw){
      const src = (raw && typeof raw === "object") ? raw : {};
      return {
        loaderLogo: normalizeSiteMediaUrl(
          src.loaderLogo ||
          src.loader_logo ||
          src.loaderImage ||
          src.loader_image ||
          src.preloaderLogo ||
          src.preloader_logo ||
          src.loader ||
          ""
        ),
        headerLogo: normalizeSiteMediaUrl(
          src.headerLogo ||
          src.header_logo ||
          src.logo ||
          src.logoUrl ||
          src.logo_url ||
          ""
        ),
        siteIcon: normalizeSiteMediaUrl(
          src.siteIcon ||
          src.site_icon ||
          src.icon ||
          src.iconUrl ||
          src.icon_url ||
          src.favicon ||
          src.faviconUrl ||
          src.favicon_url ||
          src.windowIcon ||
          src.window_icon ||
          src.windowImage ||
          src.window_image ||
          ""
        ),
        heroBanners: normalizeSiteMediaBanners(
          src.heroBanners ||
          src.hero_banners ||
          src.banners ||
          src.hero ||
          []
        )
      };
    }

    function normalizeSiteBrandState(raw){
      const src = (raw && typeof raw === "object") ? raw : {};
      const normalizeWalletTreeEntry = function(entryRaw, fallbackTitle){
        const entry = (entryRaw && typeof entryRaw === "object") ? entryRaw : {};
        const parseBoolLike = function(value, fallback){
          if (value == null || value === "") return !!fallback;
          if (value === true || value === false) return value;
          const text = String(value).trim().toLowerCase();
          if (!text) return !!fallback;
          if (["1", "true", "yes", "on", "enabled", "active"].includes(text)) return true;
          if (["0", "false", "no", "off", "disabled", "inactive"].includes(text)) return false;
          return !!fallback;
        };
        return {
          enabled: parseBoolLike(
            entry.enabled ??
              entry.showInTree ??
              entry.show_in_tree ??
              entry.visible ??
              entry.active,
            false
          ),
          title: String(
            entry.title ??
              entry.name ??
              entry.label ??
              entry.text ??
              fallbackTitle
          ).trim().slice(0, 120) || fallbackTitle,
          imageUrl: normalizeSiteMediaUrl(
            entry.imageUrl ??
              entry.image_url ??
              entry.image ??
              entry.iconUrl ??
              entry.icon_url ??
              entry.icon ??
              ""
          ),
          hideFromSidebar: parseBoolLike(
            entry.hideFromSidebar ??
              entry.hide_from_sidebar ??
              entry.sidebarHidden ??
              entry.sidebar_hidden ??
              entry.hideSidebar ??
              entry.hide_sidebar,
            false
          )
        };
      };
      const normalizeTickerMessageEntry = function(entryRaw, index){
        const entry = (entryRaw && typeof entryRaw === "object") ? entryRaw : { text: entryRaw };
        const text = String(
          entry.text ??
          entry.message ??
          entry.value ??
          entry.title ??
          ""
        ).trim().slice(0, 280);
        if (!text) return null;
        return {
          id: normalizeSiteCollectionId(
            entry.id ?? entry.key ?? entry.messageId ?? entry.message_id ?? "",
            "ticker-" + String(index + 1)
          ),
          text,
          enabled: !(
            entry.enabled === false ||
            entry.on === false ||
            entry.active === false ||
            entry.visible === false ||
            String(entry.enabled ?? entry.on ?? entry.active ?? entry.visible ?? "").trim().toLowerCase() === "false"
          ),
          order: normalizeSiteCollectionOrder(
            entry.order ?? entry.rank ?? entry.position ?? index,
            index
          )
        };
      };
      const normalizeTickerMessages = function(rawMessages, fallbackText){
        let source = [];
        if (Array.isArray(rawMessages)) source = rawMessages;
        else if (typeof rawMessages === "string") {
          source = rawMessages.split(/\r?\n/g).map((item) => String(item || "").trim()).filter(Boolean);
        } else if (rawMessages != null && rawMessages !== "") {
          source = [rawMessages];
        }
        const out = [];
        const seen = new Set();
        source.forEach((item, index) => {
          const normalized = normalizeTickerMessageEntry(item, index);
          if (!normalized) return;
          const key = [normalized.id, normalized.text].join("|");
          if (seen.has(key)) return;
          seen.add(key);
          out.push(normalized);
        });
        if (!out.length && fallbackText) {
          const fallbackEntry = normalizeTickerMessageEntry({
            id: "ticker-primary",
            text: fallbackText,
            enabled: true,
            order: 0
          }, 0);
          if (fallbackEntry) out.push(fallbackEntry);
        }
        return out
          .sort((left, right) => {
            if (left.order !== right.order) return left.order - right.order;
            return String(left.id || "").localeCompare(String(right.id || ""));
          })
          .slice(0, 12);
      };
      const resolvedTickerText = String(
        src.tickerText ??
        src.ticker_text ??
        src.noticeText ??
        src.notice_text ??
        src.marqueeText ??
        src.marquee_text ??
        src.homeTickerText ??
        src.home_ticker_text ??
        DEFAULT_SITE_TICKER_TEXT
      ).trim().slice(0, 1000) || DEFAULT_SITE_TICKER_TEXT;
      return {
        storeName: String(
          src.storeName ??
          src.store_name ??
          src.siteName ??
          src.site_name ??
          src.name ??
          src.title ??
          DEFAULT_SITE_STORE_NAME
        ).trim().slice(0, 160) || DEFAULT_SITE_STORE_NAME,
        tickerText: resolvedTickerText,
        tickerMessages: normalizeTickerMessages(
          src.tickerMessages ??
          src.ticker_messages ??
          src.newsMessages ??
          src.news_messages ??
          src.messages ??
          [],
          resolvedTickerText
        ),
        depositHint: String(
          src.depositHint ??
          src.deposit_hint ??
          src.depositDescription ??
          src.deposit_description ??
          src.depositModalHint ??
          src.deposit_modal_hint ??
          ""
        ).trim().slice(0, 1000),
        depositTree: normalizeWalletTreeEntry(
          src.depositTree ??
            src.deposit_tree ??
            src.depositItem ??
            src.deposit_item ??
            src.depositCategory ??
            src.deposit_category,
          "الإيداع"
        ),
        withdrawTree: normalizeWalletTreeEntry(
          src.withdrawTree ??
            src.withdraw_tree ??
            src.withdrawItem ??
            src.withdraw_item ??
            src.withdrawCategory ??
            src.withdraw_category,
          "سحب الرصيد"
        ),
        updatedAt: String(src.updatedAt ?? src.updated_at ?? "").trim().slice(0, 120)
      };
    }

    function resolveSiteBrandRaw(data){
      const src = (data && typeof data === "object") ? data : {};
      const brandRaw = (src.brand && typeof src.brand === "object")
        ? src.brand
        : ((src.siteBrand && typeof src.siteBrand === "object") ? src.siteBrand : {});
      return {
        ...brandRaw,
        storeName:
          brandRaw.storeName ??
          brandRaw.store_name ??
          src.storeName ??
          src.store_name ??
          src.siteName ??
          src.site_name ??
          src.brandName ??
          src.brand_name ??
          "",
        tickerText:
          brandRaw.tickerText ??
          brandRaw.ticker_text ??
          brandRaw.noticeText ??
          brandRaw.notice_text ??
          brandRaw.marqueeText ??
          brandRaw.marquee_text ??
          src.tickerText ??
          src.ticker_text ??
          src.noticeText ??
          src.notice_text ??
          src.homeTickerText ??
          src.home_ticker_text ??
          src.marqueeText ??
          src.marquee_text ??
          "",
        tickerMessages:
          brandRaw.tickerMessages ??
          brandRaw.ticker_messages ??
          brandRaw.newsMessages ??
          brandRaw.news_messages ??
          brandRaw.messages ??
          src.tickerMessages ??
          src.ticker_messages ??
          src.newsMessages ??
          src.news_messages ??
          src.messages ??
          [],
        depositHint:
          brandRaw.depositHint ??
          brandRaw.deposit_hint ??
          brandRaw.depositDescription ??
          brandRaw.deposit_description ??
          brandRaw.depositModalHint ??
          brandRaw.deposit_modal_hint ??
          src.depositHint ??
          src.deposit_hint ??
          src.depositDescription ??
          src.deposit_description ??
          src.depositModalHint ??
          src.deposit_modal_hint ??
          "",
        depositTree:
          brandRaw.depositTree ??
          brandRaw.deposit_tree ??
          brandRaw.depositItem ??
          brandRaw.deposit_item ??
          brandRaw.depositCategory ??
          brandRaw.deposit_category ??
          src.depositTree ??
          src.deposit_tree ??
          {},
        withdrawTree:
          brandRaw.withdrawTree ??
          brandRaw.withdraw_tree ??
          brandRaw.withdrawItem ??
          brandRaw.withdraw_item ??
          brandRaw.withdrawCategory ??
          brandRaw.withdraw_category ??
          src.withdrawTree ??
          src.withdraw_tree ??
          {}
      };
    }

    function preloadImageAsset(url){
      const src = normalizeSiteMediaUrl(url);
      if (!src) return;
      try {
        if (document.head && !document.querySelector("link[rel='preload'][as='image'][href='" + src.replace(/'/g, "\\'") + "']")) {
          const ln = document.createElement("link");
          ln.rel = "preload";
          ln.as = "image";
          ln.href = src;
          document.head.appendChild(ln);
        }
      } catch {}
      try {
        const img = new Image();
        img.decoding = "async";
        img.loading = "eager";
        img.src = src;
      } catch {}
    }

    function cacheSiteMedia(media){
      try {
        localStorage.setItem(SITE_MEDIA_CACHE_KEY, JSON.stringify({
          loaderLogo: normalizeSiteMediaUrl(media?.loaderLogo || ""),
          headerLogo: normalizeSiteMediaUrl(media?.headerLogo || ""),
          siteIcon: normalizeSiteMediaUrl(media?.siteIcon || ""),
          heroBanners: normalizeSiteMediaBanners(media?.heroBanners || [])
        }));
      } catch {}
    }

    function cacheSiteBrand(brand){
      try {
        localStorage.setItem(SITE_BRAND_CACHE_KEY, JSON.stringify(normalizeSiteBrandState(brand || {})));
      } catch {}
    }

    function setMetaContent(selector, value){
      try {
        const el = document.querySelector(selector);
        if (el) el.setAttribute("content", String(value == null ? "" : value));
      } catch {}
    }

    function applyHeaderLogo(url){
      const next = normalizeSiteMediaUrl(url) || DEFAULT_SITE_HEADER_LOGO;
      try { window.__SITE_HEADER_LOGO__ = next; } catch {}
      try {
        document.querySelectorAll(".header-logo").forEach((imgEl) => {
          if (!(imgEl instanceof HTMLImageElement)) return;
          const linkEl = imgEl.closest(".header-logo-link");
          if (!next) {
            try { imgEl.removeAttribute("src"); } catch {}
            try { imgEl.removeAttribute("srcset"); } catch {}
            try { imgEl.hidden = true; } catch {}
            try { imgEl.style.display = "none"; } catch {}
            if (linkEl instanceof HTMLElement) {
              try { linkEl.style.display = "none"; } catch {}
            }
            return;
          }
          if (imgEl.getAttribute("src") !== next) {
            imgEl.src = next;
          }
          try { imgEl.hidden = false; } catch {}
          try { imgEl.style.display = ""; } catch {}
          if (linkEl instanceof HTMLElement) {
            try { linkEl.style.display = ""; } catch {}
          }
        });
      } catch {}
      if (next) preloadImageAsset(next);
    }

    function guessSiteMediaMimeType(url){
      const src = normalizeSiteMediaUrl(url).toLowerCase();
      if (!src) return "image/png";
      if (src.indexOf("data:image/") === 0) {
        const end = src.indexOf(";");
        if (end > 11) return src.slice(5, end);
      }
      if (/\.gif(?:$|[?#])/.test(src)) return "image/gif";
      if (/\.svg(?:$|[?#])/.test(src)) return "image/svg+xml";
      if (/\.webp(?:$|[?#])/.test(src)) return "image/webp";
      if (/\.jpe?g(?:$|[?#])/.test(src)) return "image/jpeg";
      return "image/png";
    }

    function ensureSiteIconLink(rel){
      try {
        let link = document.querySelector(`link[rel="${rel}"]`);
        if (link) return link;
        link = document.createElement("link");
        link.rel = rel;
        document.head && document.head.appendChild(link);
        return link;
      } catch {
        return null;
      }
    }

    function applySiteIcon(url){
      const next = normalizeSiteMediaUrl(url) || DEFAULT_SITE_ICON;
      if (!next) return;
      try { window.__SITE_ICON__ = next; } catch {}
      const type = guessSiteMediaMimeType(next);
      try {
        document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]').forEach((linkEl) => {
          if (!(linkEl instanceof HTMLLinkElement)) return;
          linkEl.href = next;
          linkEl.type = type;
        });
      } catch {}
      const primaryIcon = ensureSiteIconLink("icon");
      if (primaryIcon) {
        primaryIcon.href = next;
        primaryIcon.type = type;
      }
      const shortcutIcon = ensureSiteIconLink("shortcut icon");
      if (shortcutIcon) {
        shortcutIcon.href = next;
        shortcutIcon.type = type;
      }
      const appleIcon = ensureSiteIconLink("apple-touch-icon");
      if (appleIcon) {
        appleIcon.href = next;
        appleIcon.type = type;
        appleIcon.setAttribute("sizes", "180x180");
      }
      setMetaContent('meta[property="og:image"]', next);
      setMetaContent('meta[name="twitter:image"]', next);
      preloadImageAsset(next);
      try {
        window.dispatchEvent(new CustomEvent("site:icon", { detail: { url: next } }));
      } catch {}
    }

    function applyLoaderLogo(url){
      const next = normalizeSiteMediaUrl(url) || DEFAULT_SITE_LOADER_LOGO;
      try { window.__SITE_LOADER_IMAGE__ = next; } catch {}
      try {
        const loaderNodes = document.querySelectorAll("#preloader .loader");
        loaderNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) return;
          node.style.backgroundImage = "none";
          const logo = ensureSiteLoaderLogoNode(node);
          if (!(logo instanceof HTMLImageElement)) return;
          if (!next) {
            try { logo.removeAttribute("src"); } catch {}
            try { logo.removeAttribute("srcset"); } catch {}
            try { logo.hidden = true; } catch {}
            try { logo.style.display = "none"; } catch {}
            return;
          }
          try { logo.hidden = false; } catch {}
          try { logo.style.display = ""; } catch {}
          logo.src = next;
        });
      } catch {}
      try {
        window.dispatchEvent(new CustomEvent("site:loader-logo", { detail: { url: next } }));
      } catch {}
      if (next) preloadImageAsset(next);
    }

    function applyHeroBanners(list){
      const banners = normalizeSiteMediaBanners(list).filter((item) => item && item.enabled !== false);
      const next = banners.slice();
      try { window.__SITE_HERO_BANNERS__ = next.slice(); } catch {}
      try {
        window.dispatchEvent(new CustomEvent("site:hero-banners", {
          detail: {
            images: next.map((item) => item.image),
            banners: next.slice(),
            items: next.slice()
          }
        }));
      } catch {}
      next.forEach((item) => preloadImageAsset(item.image));
    }

    function resolveActiveSiteTickerText(raw){
      const brand = normalizeSiteBrandState(raw || {});
      const activeEntry = (Array.isArray(brand.tickerMessages) ? brand.tickerMessages : []).find((entry) => {
        return entry && entry.enabled !== false && String(entry.text || "").trim();
      });
      return String(
        (activeEntry && activeEntry.text) ||
        brand.tickerText ||
        DEFAULT_SITE_TICKER_TEXT
      ).trim().slice(0, 1000) || DEFAULT_SITE_TICKER_TEXT;
    }

    function applySiteBrand(raw){
      const brand = normalizeSiteBrandState(raw || {});
      const activeTickerText = resolveActiveSiteTickerText(brand);
      try { window.__SITE_BRAND__ = { ...brand }; } catch {}
      try { window.__SITE_STORE_NAME__ = brand.storeName; } catch {}
      try { window.__SITE_TICKER_TEXT__ = activeTickerText; } catch {}
      try { window.__SITE_TICKER_MESSAGES__ = Array.isArray(brand.tickerMessages) ? brand.tickerMessages.slice() : []; } catch {}
      cacheSiteBrand(brand);
      setMetaContent('meta[name="application-name"]', brand.storeName);
      setMetaContent('meta[name="apple-mobile-web-app-title"]', brand.storeName);
      try {
        document.querySelectorAll(".header-logo").forEach((imgEl) => {
          if (imgEl instanceof HTMLImageElement) imgEl.alt = brand.storeName;
        });
      } catch {}
      try { syncWalletTreeSidebarUi(window.__AUTH_LAST_USER__ || null); } catch {}
      try {
        window.dispatchEvent(new CustomEvent("site:brand", { detail: { ...brand, activeTickerText } }));
      } catch {}
    }

    function applySiteMedia(raw){
      const media = normalizeSiteMediaState(raw || {});
      applySiteIcon(media.siteIcon);
      applyLoaderLogo(media.loaderLogo);
      applyHeaderLogo(media.headerLogo);
      applyHeroBanners(media.heroBanners);
      cacheSiteMedia({
        loaderLogo: media.loaderLogo,
        headerLogo: media.headerLogo,
        siteIcon: media.siteIcon,
        heroBanners: media.heroBanners
      });
    }

    function normalizeSiteAccessLockState(raw){
      const src = (raw && typeof raw === "object") ? raw : {};
      const hasExplicitEnabled =
        Object.prototype.hasOwnProperty.call(src, "enabled") ||
        Object.prototype.hasOwnProperty.call(src, "on") ||
        Object.prototype.hasOwnProperty.call(src, "active");
      const parseBoolLike = function(value, fallback){
        if (value == null || value === "") return !!fallback;
        if (value === true || value === false) return value;
        const text = String(value).trim().toLowerCase();
        if (!text) return !!fallback;
        if (["1", "true", "yes", "on"].includes(text)) return true;
        if (["0", "false", "no", "off"].includes(text)) return false;
        return !!fallback;
      };
      const enabled = hasExplicitEnabled
        ? parseBoolLike(src.enabled ?? src.on ?? src.active, false)
        : parseBoolLike(src.disabled ?? src.siteDisabled ?? src.site_disabled, false);
      return { enabled: !!enabled };
    }

    function is404RouteActive(){
      try {
        const path = String(window.location && window.location.pathname || "").trim().toLowerCase().replace(/\/+$/, "") || "/";
        return path === "/404" || path === "/404.html";
      } catch (_) {
        return false;
      }
    }

    function applySiteAccessLock(raw){
      const state = normalizeSiteAccessLockState(raw || {});
      try { window.__SITE_ACCESS_LOCK__ = { ...state }; } catch {}
      try {
        if (state.enabled) {
          document.documentElement.setAttribute("data-site-locked", "true");
        } else {
          document.documentElement.removeAttribute("data-site-locked");
        }
      } catch {}
      try { applySiteChromeLockedState(state.enabled); } catch {}
      try {
        if (state.enabled) {
          closeSidebarWithAnimation(0);
        }
      } catch {}
      if (!state.enabled) {
        siteLockRedirected = false;
        return;
      }
      if (is404RouteActive() || siteLockRedirected) return;
      siteLockRedirected = true;
      try {
        const targetUrl = new URL(window.location.href);
        targetUrl.pathname = "/404.html";
        targetUrl.search = "";
        targetUrl.hash = "";
        window.location.replace(targetUrl.toString());
        return;
      } catch (_) {}
      try {
        window.location.replace("/404.html");
      } catch (_) {}
    }

    function decodeFirestoreValue(val){
      if (!val || typeof val !== "object") return null;
      if (Object.prototype.hasOwnProperty.call(val, "stringValue")) return String(val.stringValue || "");
      if (Object.prototype.hasOwnProperty.call(val, "booleanValue")) return !!val.booleanValue;
      if (Object.prototype.hasOwnProperty.call(val, "integerValue")) return Number(val.integerValue);
      if (Object.prototype.hasOwnProperty.call(val, "doubleValue")) return Number(val.doubleValue);
      if (Object.prototype.hasOwnProperty.call(val, "mapValue")) {
        const out = {};
        const fields = (val.mapValue && val.mapValue.fields) ? val.mapValue.fields : {};
        Object.keys(fields).forEach(key => { out[key] = decodeFirestoreValue(fields[key]); });
        return out;
      }
      if (Object.prototype.hasOwnProperty.call(val, "arrayValue")) {
        const values = (val.arrayValue && Array.isArray(val.arrayValue.values)) ? val.arrayValue.values : [];
        return values.map(decodeFirestoreValue);
      }
      return null;
    }

    const SITE_STATE_CACHE_KEY = "site:state:secure:v1";
    const SITE_STATE_CACHE_VERSION = 1;

    function sortSiteStateCacheValue(value){
      if (Array.isArray(value)) return value.map(sortSiteStateCacheValue);
      if (!value || typeof value !== "object") return value;
      const out = {};
      Object.keys(value).sort().forEach((key) => {
        out[key] = sortSiteStateCacheValue(value[key]);
      });
      return out;
    }

    function stableSiteStateCacheStringify(value){
      try {
        return JSON.stringify(sortSiteStateCacheValue(value));
      } catch (_) {
        return "";
      }
    }

    function siteStateTextToBytes(text){
      const normalized = String(text == null ? "" : text);
      try {
        return new TextEncoder().encode(normalized);
      } catch (_) {
        let utf8 = "";
        try {
          utf8 = unescape(encodeURIComponent(normalized));
        } catch (__){
          utf8 = normalized;
        }
        const out = new Uint8Array(utf8.length);
        for (let i = 0; i < utf8.length; i += 1) out[i] = utf8.charCodeAt(i);
        return out;
      }
    }

    function siteStateBytesToText(bytes){
      const src = bytes instanceof Uint8Array ? bytes : new Uint8Array(0);
      try {
        return new TextDecoder().decode(src);
      } catch (_) {
        let raw = "";
        for (let i = 0; i < src.length; i += 1) raw += String.fromCharCode(src[i]);
        try {
          return decodeURIComponent(escape(raw));
        } catch (__){
          return raw;
        }
      }
    }

    function siteStateBytesToBase64(bytes){
      try {
        const src = bytes instanceof Uint8Array ? bytes : new Uint8Array(0);
        let binary = "";
        const chunkSize = 0x8000;
        for (let i = 0; i < src.length; i += chunkSize) {
          const chunk = src.subarray(i, i + chunkSize);
          binary += String.fromCharCode.apply(null, Array.from(chunk));
        }
        return btoa(binary);
      } catch (_) {
        return "";
      }
    }

    function siteStateBase64ToBytes(base64){
      try {
        const binary = atob(String(base64 || ""));
        const out = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
        return out;
      } catch (_) {
        return null;
      }
    }

    function xorSiteStateBytes(bytes, secret){
      const src = bytes instanceof Uint8Array ? bytes : new Uint8Array(0);
      const keyBytes = siteStateTextToBytes(secret || "site-state-cache");
      if (!keyBytes.length) return src.slice();
      const out = new Uint8Array(src.length);
      for (let i = 0; i < src.length; i += 1) {
        out[i] = src[i] ^ keyBytes[i % keyBytes.length] ^ ((i * 31 + keyBytes.length) & 255);
      }
      return out;
    }

    function hashSiteStateCacheText(text){
      const str = String(text || "");
      let h = 2166136261;
      for (let i = 0; i < str.length; i += 1) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      return (h >>> 0).toString(16).padStart(8, "0");
    }

    function getSiteStateCacheProjectId(explicitProjectId){
      try {
        const runtimeProjectId = window.__getSiteFirebaseProjectId
          ? window.__getSiteFirebaseProjectId()
          : ((window.__SITE_RUNTIME_CONFIG__ && window.__SITE_RUNTIME_CONFIG__.firebase && window.__SITE_RUNTIME_CONFIG__.firebase.projectId) || "");
        return String(explicitProjectId || runtimeProjectId || "").trim();
      } catch (_) {
        return String(explicitProjectId || "").trim();
      }
    }

    function buildSiteStateCacheSecret(projectId){
      const pid = getSiteStateCacheProjectId(projectId);
      const origin = String(window.location && window.location.origin || "").trim();
      const host = String(window.location && window.location.host || "").trim();
      return [
        "belo-site-state-cache",
        String(SITE_STATE_CACHE_VERSION),
        pid,
        origin,
        host,
        "sealed"
      ].join("|");
    }

    function clearSiteStateCache(){
      try { localStorage.removeItem(SITE_STATE_CACHE_KEY); } catch {}
    }

    function writeSiteStateCache(data, options){
      try {
        if (!data || typeof data !== "object") return false;
        const payload = {
          v: SITE_STATE_CACHE_VERSION,
          savedAt: Date.now(),
          projectId: getSiteStateCacheProjectId(options && options.projectId),
          data
        };
        const plain = stableSiteStateCacheStringify(payload);
        if (!plain) return false;
        const secret = buildSiteStateCacheSecret(payload.projectId);
        const sealed = siteStateBytesToBase64(
          xorSiteStateBytes(siteStateTextToBytes(plain), secret)
        );
        if (!sealed) return false;
        const envelope = {
          v: SITE_STATE_CACHE_VERSION,
          savedAt: payload.savedAt,
          projectId: payload.projectId,
          body: sealed,
          tag: hashSiteStateCacheText(secret + "|" + payload.savedAt + "|" + sealed)
        };
        localStorage.setItem(SITE_STATE_CACHE_KEY, JSON.stringify(envelope));
        try {
          window.__SITE_STATE_CACHE__ = {
            savedAt: payload.savedAt,
            projectId: payload.projectId
          };
        } catch {}
        return true;
      } catch (err) {
        devCreditLog('warn', 'Failed to store secure siteState cache.', err && err.message ? err.message : err);
        return false;
      }
    }

    function readSiteStateCache(){
      try {
        const raw = localStorage.getItem(SITE_STATE_CACHE_KEY);
        if (!raw) return null;
        const envelope = JSON.parse(raw);
        if (!envelope || typeof envelope !== "object") {
          clearSiteStateCache();
          return null;
        }
        const savedAt = Number(envelope.savedAt || 0);
        const projectId = getSiteStateCacheProjectId(envelope.projectId);
        const body = String(envelope.body || "").trim();
        if (!body) {
          clearSiteStateCache();
          return null;
        }
        const secret = buildSiteStateCacheSecret(projectId);
        const expectedTag = hashSiteStateCacheText(secret + "|" + savedAt + "|" + body);
        if (String(envelope.tag || "") !== expectedTag) {
          devCreditLog('warn', 'Secure siteState cache integrity check failed. Clearing cache.');
          clearSiteStateCache();
          return null;
        }
        const sealedBytes = siteStateBase64ToBytes(body);
        if (!(sealedBytes instanceof Uint8Array)) {
          clearSiteStateCache();
          return null;
        }
        const plain = siteStateBytesToText(xorSiteStateBytes(sealedBytes, secret));
        const payload = JSON.parse(plain);
        if (!payload || typeof payload !== "object" || payload.v !== SITE_STATE_CACHE_VERSION) {
          clearSiteStateCache();
          return null;
        }
        if (!payload.data || typeof payload.data !== "object") {
          clearSiteStateCache();
          return null;
        }
        return {
          data: payload.data,
          savedAt: Number(payload.savedAt || savedAt || 0),
          projectId: projectId
        };
      } catch (err) {
        devCreditLog('warn', 'Secure siteState cache could not be read. Clearing cache.', err && err.message ? err.message : err);
        clearSiteStateCache();
        return null;
      }
    }

    function getSiteStateNavigationType(){
      try {
        const entries = window.performance && typeof window.performance.getEntriesByType === "function"
          ? window.performance.getEntriesByType("navigation")
          : [];
        if (entries && entries[0] && entries[0].type) {
          return String(entries[0].type || "").trim().toLowerCase();
        }
      } catch (_) {}
      try {
        const nav = window.performance && window.performance.navigation;
        if (nav && typeof nav.type === "number") {
          if (nav.type === 1) return "reload";
          if (nav.type === 2) return "back_forward";
          return "navigate";
        }
      } catch (_) {}
      return "navigate";
    }

    function hasSameOriginReferrer(){
      try {
        const ref = String(document.referrer || "").trim();
        if (!ref) return false;
        return new URL(ref, window.location.href).origin === window.location.origin;
      } catch (_) {
        return false;
      }
    }

    function isLocalDevHost(){
      try {
        const host = String(window.location && window.location.hostname || "").trim().toLowerCase();
        return host === "127.0.0.1" || host === "localhost" || host === "::1";
      } catch (_) {
        return false;
      }
    }

    function resolveSiteStateRefreshDecision(cacheEntry){
      const navType = getSiteStateNavigationType();
      if (!cacheEntry || !cacheEntry.data) {
        return { refresh: true, reason: "cache-miss", navType };
      }
      if (isLocalDevHost()) {
        return { refresh: true, reason: "local-dev", navType };
      }
      if (navType === "reload") {
        return { refresh: true, reason: "reload", navType };
      }
      if (!hasSameOriginReferrer()) {
        return { refresh: true, reason: "direct-entry", navType };
      }
      return { refresh: false, reason: "same-origin-cache", navType };
    }

    function applySiteChromeLockedState(enabled){
      const locked = !!enabled;
      try {
        if (document.body) {
          if (locked) document.body.style.setProperty("padding-top", "0px", "important");
          else document.body.style.removeProperty("padding-top");
        }
      } catch {}
      try {
        const rootStyle = document.documentElement && document.documentElement.style;
        if (rootStyle) {
          if (locked) {
            rootStyle.setProperty("--app-header-height", "0px");
            rootStyle.setProperty("--app-header-gap", "0px");
            rootStyle.setProperty("--app-header-offset", "0px");
          } else if (typeof syncAppHeaderOffset === "function") {
            syncAppHeaderOffset();
          }
        }
      } catch {}
    }

    function runSiteStateStep(label, fn){
      try {
        fn();
      } catch (err) {
        devCreditLog('error', 'siteState step failed: ' + String(label || 'unknown'), err && err.message ? err.message : err);
      }
    }

    function runSiteStateBodyStep(label, fn){
      if (document.body) {
        runSiteStateStep(label, fn);
        return;
      }
      try {
        document.addEventListener('DOMContentLoaded', function(){
          runSiteStateStep(label, fn);
        }, { once: true });
      } catch (err) {
        devCreditLog('error', 'siteState deferred step failed to bind: ' + String(label || 'unknown'), err && err.message ? err.message : err);
      }
    }

    function readSiteStateAuthCommand(data){
      const root = data && typeof data === 'object' ? data : {};
      const nested = root.authCommand && typeof root.authCommand === 'object'
        ? root.authCommand
        : (root.auth_command && typeof root.auth_command === 'object' ? root.auth_command : {});
      const logoutAllAt = String(
        nested.logoutAllAt ??
        nested.logout_all_at ??
        nested.forceLogoutAt ??
        nested.force_logout_at ??
        root.logoutAllAt ??
        root.logout_all_at ??
        root.forceLogoutAt ??
        root.force_logout_at ??
        ''
      ).trim();
      const logoutAllAtMs = logoutAllAt ? Date.parse(logoutAllAt) : NaN;
      return {
        logoutAllAt,
        logoutAllAtMs: Number.isFinite(logoutAllAtMs) ? logoutAllAtMs : 0,
        reason: String(
          nested.reason ??
          nested.command ??
          nested.type ??
          ''
        ).trim()
      };
    }

    function readSiteStateSessionInfo(){
      try {
        const raw = localStorage.getItem('sessionKeyInfo');
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : null;
      } catch (_) {
        return null;
      }
    }

    function hasAnySiteAuthSession(user){
      if (user && user.uid) return true;
      try {
        const payload = readPostLoginPayload && readPostLoginPayload();
        if (payload && typeof payload === 'object' && String(payload.uid || '').trim()) return true;
      } catch {}
      try {
        const sessionInfo = readSiteStateSessionInfo();
        return !!(sessionInfo && String(sessionInfo.uid || '').trim() && String(sessionInfo.sessionKey || '').trim());
      } catch {}
      return false;
    }

    function resolveSiteAuthSessionStartedAt(user){
      const candidates = [];
      try {
        const lastSignInText = String(user && user.metadata && user.metadata.lastSignInTime || '').trim();
        const parsedLastSignIn = lastSignInText ? Date.parse(lastSignInText) : NaN;
        if (Number.isFinite(parsedLastSignIn) && parsedLastSignIn > 0) candidates.push(parsedLastSignIn);
      } catch {}
      try {
        const sessionInfo = readSiteStateSessionInfo();
        const sessionTs = Number(sessionInfo && sessionInfo.ts);
        if (Number.isFinite(sessionTs) && sessionTs > 0) candidates.push(sessionTs);
      } catch {}
      try {
        const payload = readPostLoginPayload && readPostLoginPayload();
        const payloadTs = Number(payload && payload.ts);
        if (Number.isFinite(payloadTs) && payloadTs > 0) candidates.push(payloadTs);
      } catch {}
      return candidates.length ? Math.max.apply(null, candidates) : 0;
    }

    function applySiteAuthCommand(data){
      const authCommand = readSiteStateAuthCommand(data);
      if (!authCommand.logoutAllAtMs) return false;
      if (window.__LOGOUT_IN_PROGRESS__ || window.__SITE_STATE_FORCE_LOGOUT_PENDING__) return false;
      let currentUser = null;
      try {
        currentUser = (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser)
          ? firebase.auth().currentUser
          : null;
      } catch {}
      let fallbackUser = null;
      try {
        fallbackUser = buildFallbackUserFromPayload(readPostLoginPayload());
      } catch {}
      const activeUser = currentUser || fallbackUser || null;
      const hasSession = hasAnySiteAuthSession(activeUser);
      if (!hasSession) return false;
      const sessionStartedAtMs = resolveSiteAuthSessionStartedAt(activeUser);
      if (sessionStartedAtMs && sessionStartedAtMs >= authCommand.logoutAllAtMs) return false;
      try { window.__SITE_STATE_FORCE_LOGOUT_PENDING__ = true; } catch {}
      devCreditLog('warn', 'siteState requested a forced logout for the current session.', {
        logoutAllAt: authCommand.logoutAllAt,
        reason: authCommand.reason || ''
      });
      setTimeout(function(){
        try { performClientLogout('index.html#/login'); }
        catch (_) { try { window.location.replace('index.html#/login'); } catch {} }
      }, 30);
      return true;
    }

    function applyResolvedSiteStateData(data){
      if (!data || typeof data !== 'object') {
        devCreditLog('warn', 'applyResolvedSiteStateData received an invalid payload.', data);
        return false;
      }
      try {
        window.__SITE_STATE_DATA__ = data;
        window.__getResolvedSiteStateData = function(){
          return window.__SITE_STATE_DATA__ && typeof window.__SITE_STATE_DATA__ === 'object'
            ? window.__SITE_STATE_DATA__
            : null;
        };
        const authCommandApplied = applySiteAuthCommand(data);
        if (typeof window.dispatchEvent === 'function' && typeof window.CustomEvent === 'function') {
          window.dispatchEvent(new CustomEvent('site-state-updated', { detail: data }));
        }
        if (authCommandApplied) return true;
      } catch {}
      devCreditLog('info', 'Resolved siteState payload reached the frontend.', {
        hasDeveloperCredit: hasDeveloperCreditPayload(data),
        developerCredit: readDeveloperCreditPreview(data)
      });
      runSiteStateStep('access-lock', function(){
        applySiteAccessLock(data.siteLock || data.site_lock || {
          enabled: data.siteDisabled || data.site_disabled || false
        });
      });
      runSiteStateStep('brand', function(){
        applySiteBrand(resolveSiteBrandRaw(data));
      });
      runSiteStateStep('theme', function(){
        applyTheme(data.theme || {});
      });
      runSiteStateBodyStep('maintenance', function(){
        applyMaintenance(data.maintenance || {});
      });
      runSiteStateStep('media', function(){
        applySiteMedia(data.media || data.siteMedia || data.branding || {});
      });
      runSiteStateBodyStep('notice', function(){
        applySiteNotice(data.notification || data.notice || {});
      });
      const waJoinState = data.waJoin ?? data.whatsappJoin ?? data.whatsappPopup ?? data.waPopup;
      runSiteStateStep('wa-join', function(){
        applySiteWaJoin(waJoinState);
      });
      runSiteStateStep('developer-credit', function(){
        if (typeof window.__applySupportDeveloperCreditConfig === 'function') {
          window.__applySupportDeveloperCreditConfig(data || {});
        }
      });
      runSiteStateStep('support-contacts', function(){
        if (typeof window.__applySupportContactsConfig === 'function') {
          window.__applySupportContactsConfig(data || {});
        }
      });
      return true;
    }

    function applyCachedSiteStateEntry(cacheEntry){
      if (!cacheEntry || !cacheEntry.data || typeof cacheEntry.data !== "object") return false;
      const applied = applyResolvedSiteStateData(cacheEntry.data);
      if (applied) {
        devCreditLog('info', 'Applied secure cached siteState.', {
          savedAt: cacheEntry.savedAt || 0,
          projectId: cacheEntry.projectId || ''
        });
      }
      return applied;
    }

    function fetchSiteStateViaFirestoreClient(options){
      devCreditLog('info', 'Firestore client fallback is disabled to avoid repeated realtime/database traffic.');
      return Promise.resolve(false);
    }

    function fetchSiteStateOnce(options){
      const opts = (options && typeof options === "object") ? options : {};
      try {
        const pid = window.__getSiteFirebaseProjectId
          ? String(window.__getSiteFirebaseProjectId() || "").trim()
          : String(opts.projectId || "").trim();
        if (!pid) {
          devCreditLog('warn', 'REST siteState fetch skipped because projectId is missing.');
          return fetchSiteStateViaFirestoreClient({
            projectId: opts.projectId || ''
          }).then((ok) => {
            if (!ok && !opts.hasUsableCache) applySiteWaJoin({ enabled: false });
            return ok;
          });
        }
        const requestUrl = `https://firestore.googleapis.com/v1/projects/${pid}/databases/(default)/documents/config/siteState`;
        return fetch(requestUrl, {
          cache: "no-store"
        })
          .then(r => {
            if (!r.ok) {
              devCreditLog('error', 'REST siteState fetch failed.', {
                projectId: pid,
                status: r.status || 0
              });
              throw new Error('site_state_http_' + String(r.status || '0'));
            }
            return r.json();
          })
          .then(doc => {
            if (!doc || doc.error || !doc.fields || typeof doc.fields !== 'object') {
              devCreditLog('warn', 'REST siteState payload was invalid.', {
                projectId: pid,
                hasError: !!(doc && doc.error),
                hasFields: !!(doc && doc.fields)
              });
              if (!opts.hasUsableCache) applySiteWaJoin({ enabled: false });
              return false;
            }
            const fields = (doc && doc.fields) ? doc.fields : {};
            const data = decodeFirestoreValue({ mapValue: { fields } }) || {};
            devCreditLog('info', 'REST siteState payload fetched successfully.', {
              projectId: pid,
              hasDeveloperCredit: hasDeveloperCreditPayload(data),
              developerCredit: readDeveloperCreditPreview(data)
            });
            writeSiteStateCache(data, { projectId: pid });
            return applyResolvedSiteStateData(data);
          })
          .catch((err) => {
            devCreditLog('error', 'REST siteState fetch crashed.', {
              projectId: pid,
              error: err && err.message ? err.message : String(err || '')
            });
            if (!opts.hasUsableCache) applySiteWaJoin({ enabled: false });
            return false;
          });
      } catch (err) {
        devCreditLog('error', 'fetchSiteStateOnce crashed before issuing the request.', err && err.message ? err.message : err);
        if (!opts.hasUsableCache) applySiteWaJoin({ enabled: false });
        return Promise.resolve(false);
      }
    }

    function refreshSiteStateFromNetwork(reason){
      const now = Date.now();
      const refreshReason = String(reason || '').trim() || 'manual';
      const cacheEntry = readSiteStateCache();
      const hasUsableCache = !!(cacheEntry && cacheEntry.data && typeof cacheEntry.data === "object");
      const cacheAgeMs = hasUsableCache
        ? Math.max(0, now - Number(cacheEntry.savedAt || 0))
        : Number.POSITIVE_INFINITY;
      if (siteStateRefreshInFlight) return Promise.resolve(false);
      if (SITE_STATE_PASSIVE_REFRESH_REASONS.has(refreshReason)) {
        if ((now - lastSiteStateRefreshAt) < SITE_STATE_PASSIVE_REFRESH_THROTTLE_MS) return Promise.resolve(false);
        if (hasUsableCache && cacheAgeMs < SITE_STATE_PASSIVE_REFRESH_THROTTLE_MS) return Promise.resolve(false);
      } else if ((now - lastSiteStateRefreshAt) < 1200) {
        return Promise.resolve(false);
      }
      siteStateRefreshInFlight = true;
      lastSiteStateRefreshAt = now;
      devCreditLog('info', 'Refreshing siteState from network.', {
        reason: refreshReason,
        hasUsableCache
      });
      return fetchSiteStateOnce({
        projectId: cacheEntry && cacheEntry.projectId ? cacheEntry.projectId : '',
        hasUsableCache
      }).catch((err) => {
        devCreditLog('error', 'refreshSiteStateFromNetwork failed.', err && err.message ? err.message : err);
        return false;
      }).finally(() => {
        siteStateRefreshInFlight = false;
      });
    }
    try {
      window.__refreshSiteStateNow = function(){
        return refreshSiteStateFromNetwork('manual-debug');
      };
    } catch {}

    function bootstrapSiteState() {
      if (started) return;
      started = true;
      ensureCss();
      const cacheEntry = readSiteStateCache();
      const cacheApplied = applyCachedSiteStateEntry(cacheEntry);
      const decision = resolveSiteStateRefreshDecision(cacheEntry);
      devCreditLog('info', 'siteState bootstrap decision.', {
        navType: decision.navType,
        reason: decision.reason,
        cacheApplied: cacheApplied,
        hasCache: !!(cacheEntry && cacheEntry.data)
      });
      if (!decision.refresh) return;
      refreshSiteStateFromNetwork(decision.reason).catch((err) => {
        devCreditLog('error', 'siteState bootstrap fetch failed.', err && err.message ? err.message : err);
      });
    }

    try {
      window.addEventListener('pageshow', function(){
        refreshSiteStateFromNetwork('pageshow').catch(function(){ return false; });
      });
    } catch {}
    try {
      document.addEventListener('visibilitychange', function(){
        try {
          if (document.visibilityState !== 'visible') return;
        } catch {}
        refreshSiteStateFromNetwork('visible').catch(function(){ return false; });
      });
    } catch {}
    try {
      window.addEventListener('focus', function(){
        refreshSiteStateFromNetwork('visible').catch(function(){ return false; });
      });
    } catch {}
    try {
      window.setInterval(function(){
        try {
          if (document.visibilityState && document.visibilityState !== 'visible') return;
        } catch {}
        refreshSiteStateFromNetwork('visible').catch(function(){ return false; });
      }, SITE_STATE_PASSIVE_REFRESH_THROTTLE_MS);
    } catch {}

    try {
      const cachedTheme = readCachedSiteTheme();
      if (cachedTheme && (cachedTheme.name || cachedTheme.color)) {
        applyTheme(cachedTheme);
      }
    } catch {}

    try {
      const cachedRaw = localStorage.getItem(SITE_BRAND_CACHE_KEY);
      if (cachedRaw) {
        const cached = JSON.parse(cachedRaw);
        applySiteBrand(cached || {});
      } else {
        applySiteBrand(DEFAULT_SITE_BRAND || {});
      }
    } catch {}

    try {
      const cachedRaw = localStorage.getItem(SITE_MEDIA_CACHE_KEY);
      if (cachedRaw) {
        const cached = JSON.parse(cachedRaw);
        applySiteMedia(cached || {});
      }
    } catch {}

    try {
      const cachedRaw = localStorage.getItem(SITE_WA_JOIN_CACHE_KEY);
      if (cachedRaw) {
        const cached = JSON.parse(cachedRaw);
        applySiteWaJoin(cached || {});
      }
    } catch {}

    bootstrapSiteState();
  } catch (err) {
    log("siteState listener failed", err?.message||err);
  }
})();





