/* Deposit inline subsystem — extracted from site-inline-app.js (2026-07-19). */
/* Ships as part of chunk-deposit.js (with deposit-app-blob.js), loaded by     */
/* __loadRouteChunk before the deposit/edaa route builds. Defines the real     */
/* window.depositRoute; the router keeps a template-based fallback and         */
/* late-binds via resolveDepositRouteImpl() at build time.                     */
(function () {
  if (window.depositRoute) return;

  const state = {
    container: null,
    app: null,
    styleEl: null,
    scriptLoaded: false,
    templateWorkerBase: '',
    loadPromise: null,
    mountPromise: null,
    shownOnce: false,
    countriesRecoveryAttempted: false,
    refreshPromise: null,
    lastCountriesRefreshAt: 0,
    lastRouteFlow: '',
    lastInlineAppClickAt: 0,
    suppressInlineMethodModalUntil: 0,
    recoveryPromiseByFlow: { deposit: null, withdraw: null },
  };

  document.addEventListener('click', function (event) {
    try {
      const target = event && event.target && event.target.closest ? event.target.closest('#depositInlineApp') : null;
      if (target) {
        state.lastInlineAppClickAt = Date.now();
        state.suppressInlineMethodModalUntil = 0;
      }
    } catch (_) {}
  }, true);

  function normalizeInlineFlow(value) {
    const v = String(value || '').trim().toLowerCase();
    return (v === 'withdraw' || v === 'sahb' || v === 'سحب') ? 'withdraw' : 'deposit';
  }
  function getInlineFlowFromHash(hashValue) {
    try {
      const raw = String(hashValue == null ? location.hash : hashValue).replace(/^#\/?/, '');
      const first = raw.split('/').filter(Boolean)[0] || '';
      return normalizeInlineFlow(first);
    } catch (_) {
      return 'deposit';
    }
  }
  function getInlineFlowPath(flow) {
    return normalizeInlineFlow(flow) === 'withdraw' ? 'withdraw' : 'deposit';
  }
  function isLocalLikeInlineHost(hostname) {
    const host = String(hostname || '').trim().toLowerCase();
    if (!host) return true;
    if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '[::1]') return true;
    return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host);
  }
  function isInlineWorkerDevPort(port) {
    const normalized = String(port || '').trim();
    return normalized === '8787' || normalized === '8788' || normalized === '8789' || normalized === '8790';
  }
  function isUnsafeLocalInlineBase(base) {
    const normalized = normalizeWorkerBase(base);
    if (!normalized) return true;
    try {
      const parsed = new URL(normalized);
      if (isInlineWorkerDevPort(parsed.port)) return false;
      return isLocalLikeInlineHost(parsed.hostname);
    } catch (_) {
      return false;
    }
  }
  function getInlineFlowCopy(flow) {
    return false
      ? {
          heading: 'خيارات السحب المتاحة',
        }
      : {
          heading: 'خيارات الإيداع المتاحة',
        };
  }
  function applyInlineFlowCopy(app, flow) {
    const host = app && app.querySelector ? app : state.app;
    if (!host) return;
    const copy = getInlineFlowCopy(flow || getInlineFlowFromHash());
    const whereText = host.querySelector('#whereText');
    if (whereText) whereText.textContent = copy.heading;
  }
  function releaseWalletBootLoaderIfAny() {
    try {
      if (typeof window.__releaseInlineWalletBootLoader === 'function') {
        window.__releaseInlineWalletBootLoader();
      }
    } catch (_) {}
  }

  let depositInlineCountriesLoadingCount = 0;
  let depositInlineCountriesLoaderHeld = false;
  function isDepositInlineCountriesLoading() {
    try {
      return depositInlineCountriesLoadingCount > 0 ||
        window.__DEPOSIT_INLINE_COUNTRIES_LOADING__ === true ||
        (document.documentElement && document.documentElement.classList.contains('deposit-countries-loader-pending')) ||
        (document.body && document.body.classList.contains('deposit-countries-loader-pending'));
    } catch (_) {
      return depositInlineCountriesLoadingCount > 0;
    }
  }
  function syncDepositInlineLoadingEmptyState(active) {
    const loading = active === true;
    try {
      if (document.documentElement) document.documentElement.classList.toggle('deposit-inline-loading', loading);
      if (document.body) document.body.classList.toggle('deposit-inline-loading', loading);
      const app = document.getElementById('depositInlineApp');
      if (app && app.classList) app.classList.toggle('deposit-inline-loading', loading);
      if (!app || !app.querySelectorAll) return;
      app.querySelectorAll('#noResults, .no-results').forEach(function (el) {
        try {
          if (loading) {
            el.style.display = 'none';
            el.setAttribute('aria-hidden', 'true');
          } else {
            el.removeAttribute('aria-hidden');
          }
        } catch (_) {}
      });
    } catch (_) {}
  }
  function forceDepositInlineCountriesLoaderVisible() {
    try {
      const pre = document.getElementById('preloader');
      if (!pre) return;
      pre.classList.remove('hidden');
      pre.classList.remove('closing');
      pre.removeAttribute('aria-hidden');
      pre.setAttribute('aria-busy', 'true');
      pre.style.display = 'flex';
      pre.style.opacity = '1';
      pre.style.visibility = 'visible';
      pre.style.pointerEvents = 'auto';
      pre.style.zIndex = '200000';
      let loader = pre.querySelector ? pre.querySelector('.loader') : null;
      if (!loader && document && typeof document.createElement === 'function') {
        loader = document.createElement('div');
        loader.className = 'loader';
        loader.setAttribute('aria-hidden', 'true');
        pre.appendChild(loader);
      }
      if (loader) {
        loader.removeAttribute('hidden');
        loader.style.display = 'grid';
        loader.style.visibility = 'visible';
        loader.style.opacity = '1';
        loader.style.transform = 'scale(1)';
        loader.style.animation = '';
        loader.style.width = '128px';
        loader.style.height = '128px';
        loader.style.position = 'relative';
        loader.style.borderRadius = '50%';
      }
      try { if (typeof window.__primePageLoaderIntro === 'function') window.__primePageLoaderIntro(pre); } catch (_) {}
    } catch (_) {}
  }
  function clearDepositInlineCountriesLoaderOverrides() {
    try {
      const pre = document.getElementById('preloader');
      if (!pre) return;
      pre.removeAttribute('aria-busy');
      pre.style.removeProperty('display');
      pre.style.removeProperty('opacity');
      pre.style.removeProperty('visibility');
      pre.style.removeProperty('pointer-events');
      pre.style.removeProperty('z-index');
      const loader = pre.querySelector ? pre.querySelector('.loader') : null;
      if (loader) {
        loader.style.removeProperty('display');
        loader.style.removeProperty('visibility');
        loader.style.removeProperty('opacity');
        loader.style.removeProperty('transform');
        loader.style.removeProperty('animation');
        loader.style.removeProperty('width');
        loader.style.removeProperty('height');
        loader.style.removeProperty('position');
        loader.style.removeProperty('border-radius');
      }
    } catch (_) {}
  }
  function shouldKeepInlineWalletPendingAfterCountries() {
    try { if (typeof inlineLoaderHeld !== 'undefined' && inlineLoaderHeld === true) return true; } catch (_) {}
    try { if (window.__INLINE_WALLET_BOOT_HOLD__ === true) return true; } catch (_) {}
    return false;
  }
  function showDepositInlineCountriesLoader() {
    try {
      if (typeof window.__setInlineWalletRoutePending === 'function') {
        window.__setInlineWalletRoutePending(true);
      }
    } catch (_) {}
    forceDepositInlineCountriesLoaderVisible();
    if (depositInlineCountriesLoaderHeld) return;
    try {
      if (typeof window.__holdPageLoader === 'function') {
        window.__holdPageLoader();
        depositInlineCountriesLoaderHeld = true;
        forceDepositInlineCountriesLoaderVisible();
        return;
      }
    } catch (_) {}
    try {
      if (typeof window.showPageLoader === 'function') {
        window.showPageLoader({ hold: true, replay: true });
        depositInlineCountriesLoaderHeld = true;
        forceDepositInlineCountriesLoaderVisible();
        return;
      }
    } catch (_) {}
    depositInlineCountriesLoaderHeld = true;
  }
  function releaseDepositInlineCountriesLoader() {
    const keepInlinePending = shouldKeepInlineWalletPendingAfterCountries();
    if (!keepInlinePending) clearDepositInlineCountriesLoaderOverrides();
    if (!keepInlinePending) {
      try {
        if (typeof window.__setInlineWalletRoutePending === 'function') {
          window.__setInlineWalletRoutePending(false);
        }
      } catch (_) {}
    }
    if (!depositInlineCountriesLoaderHeld) return;
    depositInlineCountriesLoaderHeld = false;
    try {
      if (typeof window.__releasePageLoader === 'function') {
        window.__releasePageLoader();
        return;
      }
    } catch (_) {}
    try {
      if (!keepInlinePending && typeof window.hidePageLoader === 'function') {
        window.hidePageLoader();
      }
    } catch (_) {}
  }
  function setDepositInlineCountriesLoading(active) {
    const wasLoading = depositInlineCountriesLoadingCount > 0;
    if (active) depositInlineCountriesLoadingCount += 1;
    else depositInlineCountriesLoadingCount = Math.max(0, depositInlineCountriesLoadingCount - 1);
    const next = depositInlineCountriesLoadingCount > 0;
    try { window.__DEPOSIT_INLINE_COUNTRIES_LOADING__ = next; } catch (_) {}
    try {
      if (document.documentElement) document.documentElement.classList.toggle('deposit-countries-loader-pending', next);
      if (document.body) document.body.classList.toggle('deposit-countries-loader-pending', next);
    } catch (_) {}
    syncDepositInlineLoadingEmptyState(next);
    if (next) {
      showDepositInlineCountriesLoader();
    } else if (wasLoading) {
      releaseDepositInlineCountriesLoader();
    }
  }
  try { window.__setDepositInlineCountriesLoading = setDepositInlineCountriesLoading; } catch (_) {}

  const EDAA_BASE64 = '';

  function scopeCss(css) {
    const prefix = 'body.deposit-inline-active ';
    return css.replace(/(^|})\s*([^{}@]+)\{/g, function (match, open, selector) {
      const trimmed = (selector || '').trim();
      if (!trimmed || trimmed.startsWith('@')) return match;
      const scoped = trimmed
        .split(',')
        .map(function (sel) {
          sel = sel.trim();
          if (!sel) return sel;
          if (sel.startsWith(prefix.trim()) || sel.startsWith('@')) return sel;
          if (sel.startsWith('body.deposit-inline-active')) return sel;
          if (sel.startsWith('body')) return sel.replace(/^body/, 'body.deposit-inline-active');
          if (sel.startsWith(':root')) return 'body.deposit-inline-active';
          if (sel.startsWith('html')) {
            const firstSpace = sel.indexOf(' ');
            if (firstSpace === -1) return sel + ' body.deposit-inline-active';
            const head = sel.slice(0, firstSpace);
            let tail = sel.slice(firstSpace);
            if (/^\s*body\b/.test(tail)) {
              tail = tail.replace(/^\s*body\b/, ' body.deposit-inline-active');
              return head + tail;
            }
            return head + ' body.deposit-inline-active' + tail;
          }
          return prefix + sel;
        })
        .join(', ');
      return open + ' ' + scoped + ' {';
    });
  }

  function createScopedDocument(root) {
    const realDoc = document;
    const hasEscape = typeof CSS !== 'undefined' && typeof CSS.escape === 'function';
    const query = function (selector) {
      const local = root.querySelector(selector);
      if (local) return local;
      try {
        return realDoc.querySelector(selector);
      } catch (_) {
        return null;
      }
    };
    const queryAll = function (selector) {
      const local = root.querySelectorAll(selector);
      if (local && local.length) return local;
      try {
        return realDoc.querySelectorAll(selector);
      } catch (_) {
        return local;
      }
    };
    const getById = function (id) {
      if (!id) return null;
      try {
        const targetId = hasEscape ? CSS.escape(id) : id;
        const local = root.querySelector('#' + targetId);
        if (local) return local;
        return realDoc.getElementById(id);
      } catch (_) {
        try {
          const fallbackLocal = root.querySelector('#' + id);
          if (fallbackLocal) return fallbackLocal;
        } catch (__) {}
        try {
          return realDoc.getElementById(id);
        } catch (__) {
          return null;
        }
      }
    };
    return new Proxy(realDoc, {
      get(target, prop, receiver) {
        if (prop === 'getElementById') return getById;
        if (prop === 'querySelector') return query;
        if (prop === 'querySelectorAll') return queryAll;
        const value = Reflect.get(target, prop, target);
        if (typeof value === 'function') {
          try {
            return value.bind(target);
          } catch (_) {
            return value;
          }
        }
        return value;
      },
    });
  }

  function buildInlineDepositTreeCardCss() {
    return `
#depositInlineApp #grid.categories,
#depositInlineApp .categories{
  display:grid !important;
  grid-template-columns:repeat(5, minmax(0, 1fr)) !important;
  gap:16px !important;
  justify-content:center !important;
  width:min(100%, var(--home-section-width, 1000px)) !important;
  max-width:var(--home-section-width, 1000px) !important;
  margin:0 auto !important;
  overflow:visible !important;
  box-sizing:border-box !important;
  align-items:start !important;
  align-content:start !important;
}
#depositInlineApp #grid.categories .card.depositTreeCard,
#depositInlineApp .categories .card.depositTreeCard{
  width:100% !important;
  max-width:none !important;
  justify-self:center !important;
  padding:0 !important;
  gap:10px !important;
  background:transparent !important;
  border:none !important;
  box-shadow:none !important;
  border-radius:0 !important;
  overflow:visible !important;
}
#depositInlineApp #grid.categories .card.depositTreeCard .catalog-card-media,
#depositInlineApp .categories .card.depositTreeCard .catalog-card-media{
  width:100% !important;
  aspect-ratio:1/1 !important;
  min-height:0 !important;
}
#depositInlineApp .depositTreeThumbFallback{
  width:100% !important;
  height:100% !important;
  display:flex !important;
  align-items:center !important;
  justify-content:center !important;
  color:rgba(148,163,184,.9) !important;
  font-size:2rem !important;
}
#depositInlineApp #grid.categories .card.depositTreeCard .catalog-card-media.is-empty,
#depositInlineApp .categories .card.depositTreeCard .catalog-card-media.is-empty{
  display:flex !important;
  align-items:center !important;
  justify-content:center !important;
}
#depositInlineApp #grid.categories .card.depositTreeCard h2.depositTreeTitle,
#depositInlineApp .categories .card.depositTreeCard h2.depositTreeTitle{
  margin:0 !important;
  min-height:0 !important;
  padding:0 !important;
  font-size:.95rem !important;
  line-height:1.3 !important;
}
#depositInlineApp #grid.categories .card.depositTreeCard .offer-price,
#depositInlineApp .categories .card.depositTreeCard .offer-price{
  font-size:.95rem !important;
  font-weight:700 !important;
  color:var(--card-text) !important;
  margin:0 !important;
  letter-spacing:0 !important;
  background:transparent !important;
  border-radius:0 !important;
  padding:0 !important;
  width:100% !important;
  display:block !important;
  line-height:1.3 !important;
}
html[data-theme="dark"] #depositInlineApp #grid.categories .card.depositTreeCard .offer-price,
html[data-theme="dark"] #depositInlineApp .categories .card.depositTreeCard .offer-price{
  color:#f0f1ff !important;
}
@media (max-width: 1100px){
  #depositInlineApp #grid.categories,
  #depositInlineApp .categories{
    grid-template-columns:repeat(4, minmax(0, 1fr)) !important;
    gap:14px !important;
  }
}
@media (max-width: 760px){
  #depositInlineApp #grid.categories,
  #depositInlineApp .categories{
    grid-template-columns:repeat(3, minmax(0, 1fr)) !important;
    gap:12px !important;
    width:calc(100% - 16px) !important;
  }
  #depositInlineApp #grid.categories .card.depositTreeCard,
  #depositInlineApp .categories .card.depositTreeCard{
    padding:0 !important;
  }
  #depositInlineApp #grid.categories .card.depositTreeCard h2.depositTreeTitle,
  #depositInlineApp .categories .card.depositTreeCard h2.depositTreeTitle{
    font-size:.84rem !important;
  }
}
@media (max-width: 480px){
  #depositInlineApp #grid.categories,
  #depositInlineApp .categories{
    grid-template-columns:repeat(3, minmax(0, 1fr)) !important;
    gap:10px !important;
  }
  #depositInlineApp #grid.categories .card.depositTreeCard,
  #depositInlineApp .categories .card.depositTreeCard{
    padding:0 !important;
  }
  #depositInlineApp #grid.categories .card.depositTreeCard h2.depositTreeTitle,
  #depositInlineApp .categories .card.depositTreeCard h2.depositTreeTitle{
    font-size:.78rem !important;
  }
}
@media (max-width: 768px){
  /* Clear the fixed mobile bottom dock (72px tall + safe area) so the last
     options row and the appended recharge-code card aren't hidden behind it. */
  #depositInlineApp #grid.categories,
  #depositInlineApp .categories{
    padding-bottom:calc(96px + env(safe-area-inset-bottom)) !important;
  }
}
`.trim().split('\n');
  }

  function ensureStyle(css) {
    if (state.styleEl) return;
    const style = document.createElement('style');
    style.id = 'deposit-inline-style';
    style.textContent = scopeCss(css) + '\n' + [
      '#depositInlineApp .where,',
      '#depositInlineApp #whereText{',
      '  color:var(--site-accent-runtime, var(--accent-theme, #5c5ebf)) !important;',
      '  text-shadow:none !important;',
      '  font-weight:900 !important;',
      '  margin:0 auto var(--catalog-search-stack-gap, 6px) !important;',
      '}',
      'body.deposit-inline-active #inlinePage,',
      '#depositInlineContainer,',
      '#depositInlineApp,',
      '#depositInlineApp main{',
      '  width:100% !important;',
      '  max-width:none !important;',
      '  margin-inline:auto !important;',
      '  padding-left:0 !important;',
      '  padding-right:0 !important;',
      '  box-sizing:border-box !important;',
      '}',
      '#depositInlineApp .search-container{',
      '  width:min(calc(100vw - 16px), var(--home-section-width, 1000px)) !important;',
      '  max-width:var(--home-section-width, 1000px) !important;',
      '  margin:0 auto 0 !important;',
      '  padding:0 !important;',
      '  box-sizing:border-box !important;',
      '}',
      'body.deposit-inline-active #inlinePage #depositInlineApp .search-container,',
      'body[data-inline-route="deposit"] #inlinePage #depositInlineApp .search-container,',
      'body[data-inline-route="edaa"] #inlinePage #depositInlineApp .search-container{',
      '  width:min(calc(100vw - 16px), var(--home-section-width, 1000px)) !important;',
      '  max-width:var(--home-section-width, 1000px) !important;',
      '  margin:0 auto 0 !important;',
      '  padding:0 !important;',
      '  box-sizing:border-box !important;',
      '}',
      '#depositInlineApp .search-container input[type="text"]{',
      '  border-color:var(--site-accent-runtime-light, var(--site-accent-runtime, var(--accent-theme, #64748b))) !important;',
      '  box-shadow:0 8px 18px rgba(var(--site-accent-rgb, 148, 163, 184), .14), inset 0 1px 0 rgba(255,255,255,.08) !important;',
      '}',
      '#depositInlineApp .search-container input[type="text"]:focus{',
      '  border-color:var(--site-accent-runtime-strong, var(--site-accent-runtime-light, var(--site-accent-runtime, var(--accent-theme, #64748b)))) !important;',
      '  box-shadow:0 0 0 3px rgba(var(--site-accent-rgb, 148, 163, 184), .22), 0 10px 24px rgba(var(--site-accent-rgb, 148, 163, 184), .18) !important;',
      '}',
      '#depositInlineApp .no-results,',
      '#depositInlineApp #noResults{',
      '  color:var(--site-accent-runtime-light, var(--site-accent-runtime, var(--accent-theme, #64748b))) !important;',
      '  text-shadow:0 1px 10px rgba(var(--site-accent-rgb, 148, 163, 184), .18) !important;',
      '}',
      'html.deposit-inline-loading #depositInlineApp .no-results,',
      'body.deposit-inline-loading #depositInlineApp .no-results,',
      'html.deposit-inline-loading #depositInlineApp #noResults,',
      'body.deposit-inline-loading #depositInlineApp #noResults,',
      'html.deposit-countries-loader-pending #depositInlineApp .no-results,',
      'body.deposit-countries-loader-pending #depositInlineApp .no-results,',
      'html.deposit-countries-loader-pending #depositInlineApp #noResults,',
      'body.deposit-countries-loader-pending #depositInlineApp #noResults,',
      'html.inline-wallet-route-pending #depositInlineApp .no-results,',
      'body.inline-wallet-route-pending #depositInlineApp .no-results,',
      'html.inline-wallet-route-pending #depositInlineApp #noResults,',
      'body.inline-wallet-route-pending #depositInlineApp #noResults,',
      '#depositInlineApp.deposit-inline-loading .no-results,',
      '#depositInlineApp.deposit-inline-loading #noResults{',
      '  display:none !important;',
      '}',
      '#depositInlineApp #grid.categories,',
      '#depositInlineApp .categories{',
      '  display:grid !important;',
      '  grid-template-columns:repeat(5, minmax(0, 1fr)) !important;',
      '  gap:18px !important;',
      '  width:min(calc(100vw - 16px), var(--home-section-width, 1000px)) !important;',
      '  max-width:var(--home-section-width, 1000px) !important;',
      '  margin:var(--catalog-search-card-gap, 18px) auto 0 !important;',
      '  justify-content:center !important;',
      '  align-items:start !important;',
      '  align-content:start !important;',
      '}',
      'body.deposit-inline-active #inlinePage #depositInlineApp #grid.categories,',
      'body.deposit-inline-active #inlinePage #depositInlineApp .categories,',
      'body[data-inline-route="deposit"] #inlinePage #depositInlineApp #grid.categories,',
      'body[data-inline-route="deposit"] #inlinePage #depositInlineApp .categories,',
      'body[data-inline-route="edaa"] #inlinePage #depositInlineApp #grid.categories,',
      'body[data-inline-route="edaa"] #inlinePage #depositInlineApp .categories{',
      '  width:min(calc(100vw - 16px), var(--home-section-width, 1000px)) !important;',
      '  max-width:var(--home-section-width, 1000px) !important;',
      '  margin:var(--catalog-search-card-gap, 18px) auto 0 !important;',
      '  box-sizing:border-box !important;',
      '}',
      '#depositInlineApp #grid.categories .card,',
      '#depositInlineApp .categories .card{',
      '  position:relative !important;',
      '  width:100% !important;',
      '  min-width:0 !important;',
      '  min-height:0 !important;',
      '  padding:0 !important;',
      '  border-radius:0 !important;',
      '  display:flex !important;',
      '  flex-direction:column !important;',
      '  align-items:stretch !important;',
      '  justify-content:flex-start !important;',
      '  gap:10px !important;',
      '  background:transparent !important;',
      '  border:none !important;',
      '  box-shadow:none !important;',
      '  overflow:visible !important;',
      '  text-align:center !important;',
      '}',
      '#depositInlineApp #grid.categories .card:hover,',
      '#depositInlineApp .categories .card:hover{',
      '  transform:none !important;',
      '  border-color:transparent !important;',
      '  box-shadow:none !important;',
      '}',
      '#depositInlineApp #grid.categories .card img,',
      '#depositInlineApp .categories .card img{',
      '  width:100% !important;',
      '  height:auto !important;',
      '  max-width:none !important;',
      '  aspect-ratio:var(--site-category-image-shape, 1/1) !important;',
      '  object-fit:cover !important;',
      '  object-position:center !important;',
      '  margin:0 auto !important;',
      '  border:none !important;',
      '  box-shadow:none !important;',
      '  border-radius:var(--site-category-image-radius, 18px 18px 0 0) !important;',
      '  display:block !important;',
      '  background:transparent !important;',
      '}',
      '#depositInlineApp #grid.categories .card[data-card-type="product"] img,',
      '#depositInlineApp .categories .card[data-card-type="product"] img{',
      '  aspect-ratio:var(--site-product-image-shape, 1/1) !important;',
      '  border-radius:var(--site-product-image-radius, 18px 18px 0 0) !important;',
      '}',
      '#depositInlineApp #grid.categories .card h2,',
      '#depositInlineApp .categories .card h2{',
      '  width:100% !important;',
      '  position:static !important;',
      '  margin:0 !important;',
      '  padding:0 !important;',
      '  background:transparent !important;',
      '  box-shadow:none !important;',
      '  font-size:var(--site-category-title-size, 1.05rem) !important;',
      '  line-height:1.3 !important;',
      '  min-height:0 !important;',
      '  word-break:break-word !important;',
      '  text-align:center !important;',
      '  color:var(--site-accent-runtime-strong, var(--site-accent-runtime, var(--accent-theme, #64748b))) !important;',
      '}',
      '#depositInlineApp #grid.categories .card[data-card-type="product"] h2,',
      '#depositInlineApp .categories .card[data-card-type="product"] h2{',
      '  font-size:var(--site-product-title-size, 1.05rem) !important;',
      '}',
      '#depositInlineApp #grid.categories .card .offer-price,',
      '#depositInlineApp .categories .card .offer-price{',
      '  font-size:.95rem !important;',
      '  font-weight:700 !important;',
      '  color:var(--card-text) !important;',
      '  margin:0 !important;',
      '  letter-spacing:0 !important;',
      '  background:transparent !important;',
      '  border-radius:0 !important;',
      '  padding:0 !important;',
      '  width:100% !important;',
      '  display:block !important;',
      '  line-height:1.3 !important;',
      '}',
      'html[data-theme="dark"] #depositInlineApp #grid.categories .card .offer-price,',
      'html[data-theme="dark"] #depositInlineApp .categories .card .offer-price{',
      '  color:#f0f1ff !important;',
      '}',
      'html[data-theme="dark"] #depositInlineApp #grid.categories .card h2,',
      'html[data-theme="dark"] #depositInlineApp .categories .card h2{',
      '  color:var(--site-accent-runtime-light, var(--site-accent-runtime, var(--accent-theme, #dbeafe))) !important;',
      '}',
      '@media (max-width: 1100px){',
      '  #depositInlineApp #grid.categories,',
      '  #depositInlineApp .categories{',
      '    grid-template-columns:repeat(4, minmax(0, 1fr)) !important;',
      '    gap:14px !important;',
      '  }',
      '}',
      '@media (max-width: 760px){',
      '  #depositInlineApp .search-container,',
      '  #depositInlineApp #grid.categories,',
      '  #depositInlineApp .categories{',
      '    grid-template-columns:repeat(3, minmax(0, 1fr)) !important;',
      '    gap:12px !important;',
      '    width:min(calc(100vw - 16px), var(--home-section-width, 1000px)) !important;',
      '  }',
      '  #depositInlineApp #grid.categories .card,',
      '  #depositInlineApp .categories .card{',
      '    padding:0 !important;',
      '  }',
      '  #depositInlineApp #grid.categories .card h2,',
      '  #depositInlineApp .categories .card h2{',
      '    font-size:var(--site-category-title-size, .78rem) !important;',
      '  }',
      '  #depositInlineApp #grid.categories .card[data-card-type="product"] h2,',
      '  #depositInlineApp .categories .card[data-card-type="product"] h2{',
      '    font-size:var(--site-product-title-size, .78rem) !important;',
      '  }',
      '}',
      '@media (max-width: 480px){',
      '  #depositInlineApp #grid.categories,',
      '  #depositInlineApp .categories{',
      '    gap:10px !important;',
      '  }',
      '}',
      '#depositInlineApp:has(#methodModal:not(.hidden)) #grid,',
      '#depositInlineApp:has(#methodModal:not(.hidden)) .categories,',
      '#depositInlineApp:has(#methodModal:not(.hidden)) .search-container,',
      '#depositInlineApp:has(#methodModal:not(.hidden)) .where,',
      '#depositInlineApp:has(#methodModal:not(.hidden)) #whereText{display:none !important;}',
      '#depositInlineApp.method-modal-open #grid,',
      '#depositInlineApp.method-modal-open .categories,',
      '#depositInlineApp.method-modal-open .search-container,',
      '#depositInlineApp.method-modal-open .where,',
      '#depositInlineApp.method-modal-open #whereText{display:none !important;}',
      '#depositInlineApp.recharge-page-open #grid,',
      '#depositInlineApp.recharge-page-open .categories,',
      '#depositInlineApp.recharge-page-open .search-container,',
      '#depositInlineApp.recharge-page-open .where,',
      '#depositInlineApp.recharge-page-open #whereText{display:none !important;}',
      '#depositInlineApp .recharge-inline-page{position:relative !important;display:block !important;width:min(720px,100%) !important;margin:0 auto !important;padding:clamp(14px,2.8vw,26px) 14px calc(96px + env(safe-area-inset-bottom)) !important;box-sizing:border-box !important;}',
      '#depositInlineApp .recharge-inline-page .recharge-inline-back{position:absolute !important;top:6px !important;inset-inline-start:6px !important;width:40px !important;height:40px !important;border-radius:50% !important;border:1px solid rgba(var(--site-accent-rgb,148,163,184),.32) !important;background:var(--bg-app) !important;color:var(--text) !important;display:inline-flex !important;align-items:center !important;justify-content:center !important;cursor:pointer !important;}',
      '#depositInlineApp .recharge-inline-page .recharge-inline-card{width:100% !important;max-width:480px !important;margin:0 auto !important;display:flex !important;flex-direction:column !important;gap:12px !important;}',
      '#depositInlineApp .recharge-inline-page .recharge-inline-head{display:flex !important;flex-direction:column !important;align-items:center !important;gap:6px !important;text-align:center !important;margin-bottom:4px !important;}',
      '#depositInlineApp .recharge-inline-page .recharge-inline-icon{width:64px !important;height:64px !important;border-radius:18px !important;display:inline-flex !important;align-items:center !important;justify-content:center !important;background:rgba(var(--site-accent-rgb,148,163,184),.16) !important;color:var(--site-accent-runtime,#38bdf8) !important;font-size:1.6rem !important;overflow:hidden !important;}',
      '#depositInlineApp .recharge-inline-page .recharge-inline-icon img{width:100% !important;height:100% !important;object-fit:cover !important;}',
      '#depositInlineApp .recharge-inline-page .recharge-inline-title{margin:0 !important;font-size:clamp(1.25rem,2.6vw,1.6rem) !important;font-weight:900 !important;color:var(--text) !important;}',
      '#depositInlineApp .recharge-inline-page .recharge-inline-sub{margin:0 !important;font-size:.9rem !important;color:var(--muted,#9aa4b2) !important;}',
      '#depositInlineApp .recharge-inline-page .recharge-inline-fee{margin:0 !important;text-align:center !important;font-size:.85rem !important;font-weight:800 !important;color:var(--site-accent-runtime,#38bdf8) !important;}',
      '#depositInlineApp .recharge-inline-page .recharge-inline-label{font-size:.8rem !important;font-weight:800 !important;color:var(--text) !important;align-self:flex-start !important;}',
      '#depositInlineApp .recharge-inline-page #rechargeRedeemInput{width:100% !important;height:50px !important;border-radius:999px !important;border:1px solid rgba(var(--site-accent-rgb,148,163,184),.40) !important;background:var(--bg-app) !important;color:var(--text) !important;text-align:center !important;letter-spacing:2px !important;font-size:1rem !important;font-family:monospace !important;box-sizing:border-box !important;}',
      '#depositInlineApp .recharge-inline-page .recharge-inline-status{min-height:18px !important;font-size:.85rem !important;color:#f87171 !important;text-align:center !important;}',
      '#depositInlineApp .recharge-inline-page .recharge-inline-actions{display:flex !important;flex-direction:column !important;gap:10px !important;margin-top:4px !important;}',
      '#depositInlineApp .recharge-inline-page .recharge-inline-actions .btn{width:100% !important;height:50px !important;border-radius:999px !important;font-weight:800 !important;cursor:pointer !important;border:1px solid rgba(var(--site-accent-rgb,148,163,184),.32) !important;background:transparent !important;color:var(--text) !important;}',
      '#depositInlineApp .recharge-inline-page .recharge-inline-actions .btn-primary{border:0 !important;background:var(--site-accent-runtime-strong,var(--site-accent-runtime,#0b6388)) !important;color:#fff !important;}',
      '#depositInlineApp #methodModal.hidden, body[data-inline-route="deposit"] #methodModal.hidden, body[data-inline-route="edaa"] #methodModal.hidden, #depositInlineApp #methodModal[aria-hidden="true"]{display:none !important;}',
      '#depositInlineApp #methodModal:not(.hidden){position:static !important;inset:auto !important;width:100% !important;min-height:auto !important;height:auto !important;display:block !important;padding:0 !important;margin:0 !important;background:transparent !important;overflow:visible !important;-webkit-backdrop-filter:none !important;backdrop-filter:none !important;}',
      'body[data-inline-route="deposit"] #methodModal:not(.hidden), body[data-inline-route="edaa"] #methodModal:not(.hidden){position:static !important;inset:auto !important;width:100% !important;min-height:auto !important;height:auto !important;display:block !important;padding:0 !important;margin:0 !important;background:transparent !important;overflow:visible !important;-webkit-backdrop-filter:none !important;backdrop-filter:none !important;}',
      '#depositInlineApp #methodModal.inline-method-page, body[data-inline-route="deposit"] #methodModal.inline-method-page, body[data-inline-route="edaa"] #methodModal.inline-method-page{position:static !important;inset:auto !important;width:100% !important;min-height:auto !important;height:auto !important;display:block !important;align-items:stretch !important;justify-content:normal !important;padding:0 !important;margin:0 !important;background:transparent !important;background-color:transparent !important;overflow:visible !important;-webkit-backdrop-filter:none !important;backdrop-filter:none !important;z-index:auto !important;}',
      '#depositInlineApp #methodModal:not(.hidden) .modal-content{width:min(760px,100%) !important;max-width:100% !important;max-height:none !important;min-height:auto !important;margin:12px auto 32px !important;overflow:visible !important;transform:none !important;}',
      'body[data-inline-route="deposit"] #methodModal:not(.hidden) .modal-content, body[data-inline-route="edaa"] #methodModal:not(.hidden) .modal-content{max-height:none !important;min-height:auto !important;overflow:visible !important;transform:none !important;}',
      '#depositInlineApp #methodModal.inline-method-page .modal-content, body[data-inline-route="deposit"] #methodModal.inline-method-page .modal-content, body[data-inline-route="edaa"] #methodModal.inline-method-page .modal-content{width:min(760px,100%) !important;max-width:100% !important;max-height:none !important;min-height:auto !important;margin:12px auto 32px !important;overflow:visible !important;transform:none !important;}',
      '#depositInlineApp #methodModal:not(.hidden) .modal-x{position:sticky !important;top:78px !important;z-index:5 !important;}',
      '#depositInlineApp #methodModal #dynamicExtraFields{margin-top:-6px !important;margin-bottom:0 !important;padding:0 !important;border:none !important;border-radius:0 !important;gap:10px !important;background:transparent !important;box-shadow:none !important;}',
      'html[data-theme="dark"] #depositInlineApp #methodModal #dynamicExtraFields, body.dark-mode #depositInlineApp #methodModal #dynamicExtraFields{background:transparent !important;border:none !important;box-shadow:none !important;}',
      'html[data-theme="light"] #depositInlineApp #methodModal #dynamicExtraFields, body.light-mode #depositInlineApp #methodModal #dynamicExtraFields{background:transparent !important;border:none !important;box-shadow:none !important;}',
      '#depositInlineApp #methodModal #dynamicExtraFields .dynamic-extra-head{display:none !important;}',
      '#depositInlineApp #methodModal #dynamicExtraFields .dynamic-extra-grid{display:grid !important;gap:10px !important;}',
      '#depositInlineApp #methodModal #dynamicExtraFields .dynamic-extra-field{position:relative !important;margin:0 !important;padding:10px 0 0 !important;border:none !important;background:transparent !important;box-shadow:none !important;gap:0 !important;display:block !important;min-height:auto !important;}',
      '#depositInlineApp #methodModal #dynamicExtraFields .dynamic-extra-label{position:absolute !important;inset-inline-start:12px !important;inset-inline-end:auto !important;left:12px !important;right:auto !important;top:10px !important;transform:translateY(-50%) !important;display:flex !important;align-items:center !important;gap:8px !important;margin:0 !important;padding:0 !important;font-size:0 !important;font-weight:800 !important;z-index:1 !important;pointer-events:none !important;}',
      'html[dir="rtl"] #depositInlineApp #methodModal #dynamicExtraFields .dynamic-extra-label, html[data-lang="ar"] #depositInlineApp #methodModal #dynamicExtraFields .dynamic-extra-label{inset-inline-start:auto !important;inset-inline-end:12px !important;left:auto !important;right:12px !important;}',
      'html[dir="ltr"] #depositInlineApp #methodModal #dynamicExtraFields .dynamic-extra-label, html[data-lang="en"] #depositInlineApp #methodModal #dynamicExtraFields .dynamic-extra-label{inset-inline-start:12px !important;inset-inline-end:auto !important;left:12px !important;right:auto !important;}',
      '#depositInlineApp #methodModal #dynamicExtraFields .dynamic-extra-label > :not(.dynamic-extra-badge){display:inline-flex !important;align-items:center !important;justify-content:center !important;min-height:26px !important;padding:0 8px !important;border-radius:999px !important;font-size:.8rem !important;font-weight:800 !important;line-height:1.45 !important;letter-spacing:0 !important;text-transform:none !important;opacity:1 !important;border:1px solid #e5e7eb !important;background:#ffffff !important;color:#5d6ba8 !important;}',
      '#depositInlineApp #methodModal #dynamicExtraFields .dynamic-extra-badge{display:none !important;}',
      '#depositInlineApp #methodModal #dynamicExtraFields .dynamic-extra-hint{display:none !important;}',
      '#depositInlineApp #methodModal #dynamicExtraFields .dynamic-extra-control{width:100% !important;height:46px !important;min-height:46px !important;padding:0 16px !important;font-size:1.02rem !important;font-weight:900 !important;border-radius:999px !important;border:1px solid #e5e7eb !important;background:#ffffff !important;color:#29315f !important;letter-spacing:.2px !important;transition:border-color .2s ease, box-shadow .2s ease !important;box-shadow:none !important;text-align:center !important;}',
      '#depositInlineApp #methodModal #dynamicExtraFields .dynamic-extra-control::placeholder{opacity:.45 !important;color:#94a3b8 !important;font-weight:600 !important;letter-spacing:0 !important;}',
      '#depositInlineApp #methodModal #dynamicExtraFields .dynamic-extra-control:focus{border-color:rgba(var(--site-accent-rgb, 148, 163, 184), .58) !important;box-shadow:0 0 0 2px rgba(var(--site-accent-rgb, 148, 163, 184), .12) !important;transform:none !important;}',
      '#depositInlineApp #methodModal #dynamicExtraFields .dynamic-extra-control[data-dir="ltr"]{direction:ltr !important;font-variant-numeric:tabular-nums !important;}',
      '#depositInlineApp #methodModal #dynamicExtraFields textarea.dynamic-extra-control{height:auto !important;min-height:92px !important;padding:14px 18px !important;border-radius:24px !important;resize:none !important;}',
      'html[data-theme="dark"] #depositInlineApp #methodModal #dynamicExtraFields .dynamic-extra-label > :not(.dynamic-extra-badge), body.dark-mode #depositInlineApp #methodModal #dynamicExtraFields .dynamic-extra-label > :not(.dynamic-extra-badge){color:var(--text) !important;background:var(--bg-app) !important;border-color:rgba(var(--site-accent-rgb, 148, 163, 184), .42) !important;}',
      'html[data-theme="dark"] #depositInlineApp #methodModal #dynamicExtraFields .dynamic-extra-control, body.dark-mode #depositInlineApp #methodModal #dynamicExtraFields .dynamic-extra-control{background:var(--bg-app) !important;border-color:rgba(var(--site-accent-rgb, 148, 163, 184), .36) !important;color:var(--text) !important;}',
      'html[data-theme="dark"] #depositInlineApp #methodModal #dynamicExtraFields .dynamic-extra-control::placeholder, body.dark-mode #depositInlineApp #methodModal #dynamicExtraFields .dynamic-extra-control::placeholder{color:#94a3b8 !important;}',
      '#depositInlineApp #methodModal #methodInfo .info-item{position:relative !important;display:block !important;gap:0 !important;padding:10px 0 0 !important;margin:0 !important;border:none !important;background:transparent !important;box-shadow:none !important;}',
      '#depositInlineApp #methodModal #methodInfo .info-item > strong{position:absolute !important;inset-inline-start:12px !important;inset-inline-end:auto !important;left:12px !important;right:auto !important;top:10px !important;transform:translateY(-50%) !important;margin:0 !important;padding:0 8px !important;border-radius:999px !important;font-size:.8rem !important;font-weight:800 !important;line-height:1.45 !important;letter-spacing:0 !important;pointer-events:none !important;direction:inherit !important;text-align:start !important;z-index:2 !important;}',
      'html[dir="rtl"] #depositInlineApp #methodModal #methodInfo .info-item > strong, html[dir="rtl"] #depositInlineApp #methodModal #methodInfo .inline-native-fee-item > strong, html[data-lang="ar"] #depositInlineApp #methodModal #methodInfo .info-item > strong, html[data-lang="ar"] #depositInlineApp #methodModal #methodInfo .inline-native-fee-item > strong{inset-inline-start:auto !important;inset-inline-end:12px !important;left:auto !important;right:12px !important;text-align:right !important;}',
      'html[dir="ltr"] #depositInlineApp #methodModal #methodInfo .info-item > strong, html[dir="ltr"] #depositInlineApp #methodModal #methodInfo .inline-native-fee-item > strong, html[data-lang="en"] #depositInlineApp #methodModal #methodInfo .info-item > strong, html[data-lang="en"] #depositInlineApp #methodModal #methodInfo .inline-native-fee-item > strong{inset-inline-start:12px !important;inset-inline-end:auto !important;left:12px !important;right:auto !important;text-align:left !important;}',
      'html[data-theme="dark"] #depositInlineApp #methodModal #methodInfo .info-item > strong{color:var(--text) !important;background:var(--bg-app) !important;border:1px solid rgba(var(--site-accent-rgb, 148, 163, 184), .42) !important;}',
      'html[data-theme="light"] #depositInlineApp #methodModal #methodInfo .info-item > strong{color:#5d6ba8 !important;background:#ffffff !important;border:1px solid #e5e7eb !important;}',
      '#depositInlineApp #methodModal #methodInfo .info-item .info-value{display:flex !important;align-items:center !important;justify-content:center !important;min-height:46px !important;padding:0 16px !important;border-radius:999px !important;font-size:1.02rem !important;font-weight:900 !important;text-align:center !important;border:1px solid rgba(var(--site-accent-rgb, 148, 163, 184), .36) !important;background:var(--bg-app) !important;color:var(--text) !important;}',
      '#depositInlineApp #methodModal #methodInfo .info-item .info-value .value-text{width:100% !important;text-align:center !important;direction:ltr !important;font-size:1.02rem !important;font-weight:900 !important;line-height:1.1 !important;white-space:nowrap !important;border:none !important;outline:none !important;box-shadow:none !important;user-select:text !important;-webkit-user-select:text !important;}',
      '#depositInlineApp #methodModal #methodInfo .info-item .info-value.copyable-row{position:relative !important;direction:ltr !important;justify-content:center !important;gap:0 !important;padding:0 52px !important;}',
      '#depositInlineApp #methodModal #methodInfo .info-item .info-value.copyable-row .value-text{flex:1 1 auto !important;min-width:0 !important;text-align:center !important;}',
      '#depositInlineApp #methodModal #methodInfo .info-item .info-value.copyable-long{cursor:pointer !important;padding:8px 18px !important;}',
      '#depositInlineApp #methodModal #methodInfo .info-item .info-value.copyable-long .copy-value-btn{display:none !important;}',
      '#depositInlineApp #methodModal #methodInfo .info-item .info-value.copyable-long .value-text{white-space:normal !important;overflow-wrap:anywhere !important;word-break:break-word !important;line-height:1.45 !important;display:-webkit-box !important;-webkit-line-clamp:2 !important;-webkit-box-orient:vertical !important;overflow:hidden !important;text-align:center !important;}',
      '#depositInlineApp #methodModal #methodInfo .info-item .copy-value-btn{position:absolute !important;left:10px !important;top:50% !important;display:inline-flex !important;align-items:center !important;justify-content:center !important;gap:0 !important;flex:0 0 auto !important;width:36px !important;min-width:36px !important;height:32px !important;padding:0 !important;border-radius:999px !important;border:1px solid rgba(var(--site-accent-rgb, 148, 163, 184), .32) !important;background:rgba(var(--site-accent-rgb, 148, 163, 184), .10) !important;color:var(--text) !important;box-shadow:none !important;cursor:pointer !important;appearance:none !important;-webkit-appearance:none !important;transform:translateY(-50%) !important;filter:none !important;font-size:.76rem !important;font-weight:800 !important;line-height:1 !important;}',
      '#depositInlineApp #methodModal #methodInfo .info-item .copy-value-btn .copy-value-icon{font-size:.86rem !important;line-height:1 !important;}',
      '#depositInlineApp #methodModal #methodInfo .info-item .copy-value-btn .copy-value-icon-check{display:none !important;}',
      '#depositInlineApp #methodModal #methodInfo .info-item .copy-value-btn:hover{transform:translateY(calc(-50% - 1px)) !important;box-shadow:0 10px 24px rgba(var(--site-accent-rgb, 148, 163, 184), .12) !important;background:linear-gradient(180deg,rgba(var(--site-accent-rgb, 148, 163, 184), .08),rgba(var(--site-accent-rgb, 148, 163, 184), .03)),var(--bg-app) !important;}',
      '#depositInlineApp #methodModal #methodInfo .info-item .copy-value-btn:focus, #depositInlineApp #methodModal #methodInfo .info-item .copy-value-btn:focus-visible{outline:none !important;box-shadow:none !important;}',
      '#depositInlineApp #methodModal #methodInfo .info-item .copy-value-btn.is-copied{background:rgba(22,163,74,.18) !important;border-color:rgba(34,197,94,.34) !important;color:#bbf7d0 !important;box-shadow:none !important;transform:translateY(-50%) !important;}',
      '#depositInlineApp #methodModal #methodInfo .info-item .copy-value-btn.is-copied .copy-value-icon-copy{display:none !important;}',
      '#depositInlineApp #methodModal #methodInfo .info-item .copy-value-btn.is-copied .copy-value-icon-check{display:inline-block !important;}',
      '#depositInlineApp #methodModal #methodInfo .info-item.inline-native-note-item .info-value, #depositInlineApp #methodModal #methodInfo .info-item[data-inline-kind="note"] .info-value{min-height:92px !important;padding:14px 18px !important;border-radius:24px !important;justify-content:flex-start !important;align-items:flex-start !important;}',
      '#depositInlineApp #methodModal #methodInfo .info-item.inline-native-note-item .info-value .value-text, #depositInlineApp #methodModal #methodInfo .info-item[data-inline-kind="note"] .info-value .value-text{text-align:right !important;direction:rtl !important;line-height:1.8 !important;white-space:normal !important;user-select:text !important;-webkit-user-select:text !important;}',
      'html[data-theme="light"] #depositInlineApp #methodModal #methodInfo .info-item .info-value{background:#ffffff !important;color:#29315f !important;border:1px solid #e5e7eb !important;}',
      'html[data-theme="light"] #depositInlineApp #methodModal #methodInfo .info-item .copy-value-btn{border-color:#d7defe !important;background:#f8fafc !important;color:#334155 !important;}',
      'html[data-theme="light"] #depositInlineApp #methodModal #proofTrigger.inline-proof-trigger{background:#ffffff !important;color:#29315f !important;border-color:#dbe3f3 !important;}',
      'html[data-theme="light"] #depositInlineApp #methodModal #proofTrigger.inline-proof-trigger:hover{background:#f8fbff !important;border-color:rgba(var(--site-accent-rgb, 148, 163, 184), .34) !important;}',
      'html[data-theme="light"] #depositInlineApp #methodModal #proofTrigger.inline-proof-trigger .inline-proof-trigger-label{color:#29315f !important;}',
      'html[data-theme="light"] #depositInlineApp #methodModal #proofTrigger.inline-proof-trigger .inline-proof-trigger-icon{color:var(--text) !important;}',
      'html[data-theme="light"] #depositInlineApp #methodModal #methodInfo .info-item .copy-value-btn:hover{background:rgba(var(--site-accent-rgb, 148, 163, 184), .08) !important;box-shadow:none !important;}',
      'html[data-theme="light"] #depositInlineApp #methodModal #methodInfo .info-item .copy-value-btn.is-copied{background:#ecfdf3 !important;color:#15803d !important;border-color:#86efac !important;}',
      '#depositInlineApp #methodModal #methodInfo .inline-native-fee-item{position:relative !important;display:block !important;gap:0 !important;padding:10px 0 0 !important;margin:0 !important;border:none !important;background:transparent !important;box-shadow:none !important;}',
      '#depositInlineApp #methodModal #methodInfo .inline-native-fee-item > strong{position:absolute !important;inset-inline-start:12px !important;inset-inline-end:auto !important;left:12px !important;right:auto !important;top:10px !important;transform:translateY(-50%) !important;margin:0 !important;padding:0 8px !important;border-radius:999px !important;font-size:.8rem !important;font-weight:800 !important;line-height:1.45 !important;letter-spacing:0 !important;pointer-events:none !important;direction:inherit !important;text-align:start !important;z-index:2 !important;}',
      'html[data-theme="dark"] #depositInlineApp #methodModal #methodInfo .inline-native-fee-item > strong{color:var(--text) !important;background:var(--bg-app) !important;border:1px solid rgba(var(--site-accent-rgb, 148, 163, 184), .42) !important;}',
      'html[data-theme="light"] #depositInlineApp #methodModal #methodInfo .inline-native-fee-item > strong{color:#5d6ba8 !important;background:#ffffff !important;border:1px solid #e5e7eb !important;}',
      '#depositInlineApp #methodModal #methodInfo .inline-native-fee-item .info-value{display:flex !important;align-items:center !important;justify-content:center !important;min-height:46px !important;padding:0 16px !important;border-radius:999px !important;font-size:1.02rem !important;font-weight:900 !important;text-align:center !important;}',
      'html[data-theme="dark"] #depositInlineApp #methodModal #methodInfo .inline-native-fee-item .info-value{background:var(--bg-app) !important;color:var(--text) !important;border:1px solid rgba(var(--site-accent-rgb, 148, 163, 184), .36) !important;}',
      'html[data-theme="light"] #depositInlineApp #methodModal #methodInfo .inline-native-fee-item .info-value{background:#ffffff !important;color:#29315f !important;border:1px solid #e5e7eb !important;}',
      '#depositInlineApp #methodModal #methodInfo .inline-native-fee-item .info-value .value-text{width:100% !important;text-align:center !important;direction:ltr !important;font-size:1.02rem !important;font-weight:900 !important;line-height:1.1 !important;white-space:nowrap !important;}',
      '#depositInlineApp #methodModal{z-index:80 !important;overflow:visible !important;}',
      '#depositInlineApp #methodModal .modal-content{gap:10px !important;padding:24px 20px 20px !important;border-radius:30px !important;overflow:visible !important;}',
      '#depositInlineApp #methodModal .calc{gap:12px !important;margin-bottom:2px !important;}',
      '#depositInlineApp #methodModal #methodInfo{display:grid !important;gap:10px !important;margin-top:0 !important;}',
      '#depositInlineApp #methodModal .actions{display:grid !important;grid-template-columns:repeat(2,minmax(0,1fr)) !important;gap:12px !important;margin-top:4px !important;align-items:stretch !important;}',
      '#depositInlineApp #methodModal .actions.inline-proof-stacked{grid-template-columns:1fr !important;}',
      '#depositInlineApp #methodModal .actions.inline-proof-stacked #proofTrigger, #depositInlineApp #methodModal .actions.inline-proof-stacked #submitDepositBtn{grid-column:1/-1 !important;}',
      '#depositInlineApp #methodModal #closeModal{display:none !important;}',
      '#depositInlineApp #methodModal .btn{min-height:48px !important;height:48px !important;border-radius:999px !important;padding:0 18px !important;font-size:.94rem !important;font-weight:900 !important;line-height:1.2 !important;box-shadow:none !important;display:inline-flex !important;align-items:center !important;justify-content:center !important;gap:9px !important;}',
      '#depositInlineApp #methodModal .btn i{display:inline-flex !important;align-items:center !important;justify-content:center !important;font-size:1rem !important;line-height:1 !important;margin:0 !important;}',
      '#depositInlineApp #methodModal .btn-primary{border:1px solid rgba(var(--site-accent-rgb, 148, 163, 184), .42) !important;background:linear-gradient(180deg,rgba(var(--site-accent-rgb, 148, 163, 184), .10),rgba(var(--site-accent-rgb, 148, 163, 184), .04)),var(--bg-app) !important;color:var(--text) !important;}',
      '#depositInlineApp #methodModal .btn-outline{border:1px solid rgba(var(--site-accent-rgb, 148, 163, 184), .34) !important;background:linear-gradient(180deg,rgba(var(--site-accent-rgb, 148, 163, 184), .08),rgba(var(--site-accent-rgb, 148, 163, 184), .03)),var(--bg-app) !important;color:var(--text) !important;}',
      '#depositInlineApp #methodModal .modal-x{border-radius:18px !important;}',
      '#depositInlineApp #methodModal #proofTrigger.inline-proof-trigger{gap:9px !important;display:inline-flex !important;align-items:center !important;justify-content:center !important;}',
      '#depositInlineApp #methodModal #proofTrigger.inline-proof-trigger .inline-proof-trigger-icon{width:auto !important;height:auto !important;flex:0 0 auto !important;border:0 !important;background:transparent !important;font-size:1.16rem !important;line-height:1 !important;transform:translateY(1px) !important;}',
      '#depositInlineApp #methodModal .is-inline-invalid, #depositInlineApp #methodModal .inline-extra-control.is-invalid, #depositInlineApp #methodModal .dynamic-extra-control.is-invalid{border-color:#ef4444 !important;box-shadow:0 0 0 2px rgba(239,68,68,.22) !important;}',
      '#depositInlineApp #methodModal .is-inline-shake{animation:inlineInvalidShake .34s ease both !important;}',
      '@keyframes inlineInvalidShake{0%,100%{transform:translateX(0)}20%{transform:translateX(-7px)}40%{transform:translateX(7px)}60%{transform:translateX(-5px)}80%{transform:translateX(5px)}}',
      '#depositInlineApp #methodModal .hint{margin-top:2px !important;min-height:0 !important;padding:4px 8px 0 !important;border-radius:0 !important;border:0 !important;background:transparent !important;color:#eaf0ff !important;font-size:.98rem !important;font-weight:900 !important;line-height:1.75 !important;text-align:center !important;display:block !important;}',
      '#depositInlineApp #methodModal .inline-method-link, #depositInlineApp #methodModal .hint .inline-method-link{position:relative !important;z-index:3 !important;pointer-events:auto !important;cursor:pointer !important;color:#3b82f6 !important;-webkit-text-fill-color:#3b82f6 !important;text-decoration:underline !important;text-underline-offset:2px !important;direction:ltr !important;unicode-bidi:plaintext !important;overflow-wrap:anywhere !important;}',
      '@media (max-width:640px){#depositInlineApp #methodModal .modal-content{gap:8px !important;padding:18px 18px 18px !important;}#depositInlineApp #methodModal .calc{gap:8px !important;margin-bottom:0 !important;}#depositInlineApp #methodModal #methodInfo{gap:7px !important;}#depositInlineApp #methodModal .actions{gap:8px !important;margin-top:0 !important;}#depositInlineApp #methodModal .btn{height:48px !important;min-height:48px !important;}#depositInlineApp #methodModal .hint{margin-top:0 !important;padding-top:2px !important;line-height:1.55 !important;}}',
      'html[data-theme="dark"] #depositInlineApp #methodModal .hint, body.dark-mode #depositInlineApp #methodModal .hint{background:transparent !important;border-color:transparent !important;color:#eaf0ff !important;}',
      'html[data-theme="light"] #depositInlineApp #methodModal .hint, body.light-mode #depositInlineApp #methodModal .hint{background:transparent !important;border-color:transparent !important;color:#29315f !important;}',
      '#depositInlineApp #methodModal #methodInfo .info-item .info-value, #depositInlineApp #methodModal #methodInfo .info-item .info-value.copyable-row, #depositInlineApp #methodModal #methodInfo .info-item .info-value.copyable-long, #depositInlineApp #methodModal #methodInfo .inline-native-fee-item .info-value, #depositInlineApp #methodModal #dynamicExtraFields .dynamic-extra-control{background:var(--bg-app) !important;background-image:none !important;color:var(--text) !important;border:1px solid rgba(var(--site-accent-rgb, 148, 163, 184), .36) !important;box-shadow:none !important;}',
      '#depositInlineApp #methodModal #methodInfo .info-item > strong, #depositInlineApp #methodModal #methodInfo .inline-native-fee-item > strong, #depositInlineApp #methodModal #dynamicExtraFields .dynamic-extra-label > :not(.dynamic-extra-badge){background:var(--bg-app) !important;background-image:none !important;color:var(--text) !important;border:1px solid rgba(var(--site-accent-rgb, 148, 163, 184), .42) !important;box-shadow:0 0 0 1px rgba(var(--site-accent-rgb, 148, 163, 184), .08) inset !important;}',
      '#depositInlineApp #methodModal #methodInfo .info-item .info-value .value-text, #depositInlineApp #methodModal #methodInfo .inline-native-fee-item .info-value .value-text, #depositInlineApp #methodModal #dynamicExtraFields .dynamic-extra-control{color:var(--text) !important;-webkit-text-fill-color:currentColor !important;}',
      'html[data-theme="dark"] #depositInlineApp #methodModal #dynamicExtraFields .dynamic-extra-control, body.dark-mode #depositInlineApp #methodModal #dynamicExtraFields .dynamic-extra-control, html[data-theme="dark"] #depositInlineApp #methodModal #methodInfo .info-item .info-value, body.dark-mode #depositInlineApp #methodModal #methodInfo .info-item .info-value, html[data-theme="dark"] #depositInlineApp #methodModal #methodInfo .inline-native-fee-item .info-value, body.dark-mode #depositInlineApp #methodModal #methodInfo .inline-native-fee-item .info-value{background:var(--bg-app) !important;background-image:none !important;color:var(--text) !important;border:1px solid rgba(var(--site-accent-rgb, 148, 163, 184), .36) !important;box-shadow:none !important;}',
      'html[data-theme="dark"] #depositInlineApp #methodModal #dynamicExtraFields .dynamic-extra-label > :not(.dynamic-extra-badge), body.dark-mode #depositInlineApp #methodModal #dynamicExtraFields .dynamic-extra-label > :not(.dynamic-extra-badge), html[data-theme="dark"] #depositInlineApp #methodModal #methodInfo .info-item > strong, body.dark-mode #depositInlineApp #methodModal #methodInfo .info-item > strong, html[data-theme="dark"] #depositInlineApp #methodModal #methodInfo .inline-native-fee-item > strong, body.dark-mode #depositInlineApp #methodModal #methodInfo .inline-native-fee-item > strong{background:var(--bg-app) !important;background-image:none !important;color:var(--text) !important;border:1px solid rgba(var(--site-accent-rgb, 148, 163, 184), .42) !important;box-shadow:0 0 0 1px rgba(var(--site-accent-rgb, 148, 163, 184), .08) inset !important;}',
      'html[data-theme="light"] #depositInlineApp #methodModal #dynamicExtraFields .dynamic-extra-control, body.light-mode #depositInlineApp #methodModal #dynamicExtraFields .dynamic-extra-control, html[data-theme="light"] #depositInlineApp #methodModal #methodInfo .info-item .info-value, body.light-mode #depositInlineApp #methodModal #methodInfo .info-item .info-value, html[data-theme="light"] #depositInlineApp #methodModal #methodInfo .inline-native-fee-item .info-value, body.light-mode #depositInlineApp #methodModal #methodInfo .inline-native-fee-item .info-value{background:var(--bg-app) !important;background-image:none !important;color:var(--text) !important;border:1px solid rgba(var(--site-accent-rgb, 148, 163, 184), .36) !important;box-shadow:none !important;}',
      'html[data-theme="light"] #depositInlineApp #methodModal #dynamicExtraFields .dynamic-extra-label > :not(.dynamic-extra-badge), body.light-mode #depositInlineApp #methodModal #dynamicExtraFields .dynamic-extra-label > :not(.dynamic-extra-badge), html[data-theme="light"] #depositInlineApp #methodModal #methodInfo .info-item > strong, body.light-mode #depositInlineApp #methodModal #methodInfo .info-item > strong, html[data-theme="light"] #depositInlineApp #methodModal #methodInfo .inline-native-fee-item > strong, body.light-mode #depositInlineApp #methodModal #methodInfo .inline-native-fee-item > strong{background:var(--bg-app) !important;background-image:none !important;color:var(--text) !important;border:1px solid rgba(var(--site-accent-rgb, 148, 163, 184), .42) !important;box-shadow:0 0 0 1px rgba(var(--site-accent-rgb, 148, 163, 184), .08) inset !important;}',
      '#depositInlineApp #methodModal .calc .field{background:var(--bg-app) !important;background-image:none !important;border-color:rgba(var(--site-accent-rgb, 148, 163, 184), .36) !important;box-shadow:none !important;}',
      '#depositInlineApp #methodModal .calc label{background:var(--bg-app) !important;color:var(--text) !important;border-color:rgba(var(--site-accent-rgb, 148, 163, 184), .42) !important;}',
      '#depositInlineApp #methodModal .calc input{color:var(--text) !important;-webkit-text-fill-color:currentColor !important;}',
      'html[data-theme="dark"] #depositInlineApp #methodModal .calc .field, body.dark-mode #depositInlineApp #methodModal .calc .field, html[data-theme="light"] #depositInlineApp #methodModal .calc .field, body.light-mode #depositInlineApp #methodModal .calc .field{background:var(--bg-app) !important;background-image:none !important;border:1px solid rgba(var(--site-accent-rgb, 148, 163, 184), .36) !important;box-shadow:none !important;}',
      'html[data-theme="dark"] #depositInlineApp #methodModal .calc label, body.dark-mode #depositInlineApp #methodModal .calc label, html[data-theme="light"] #depositInlineApp #methodModal .calc label, body.light-mode #depositInlineApp #methodModal .calc label{background:var(--bg-app) !important;background-image:none !important;color:var(--text) !important;border:1px solid rgba(var(--site-accent-rgb, 148, 163, 184), .42) !important;box-shadow:0 0 0 1px rgba(var(--site-accent-rgb, 148, 163, 184), .08) inset !important;}',
      'html[data-theme="dark"] #depositInlineApp #methodModal #dynamicExtraFields .dynamic-extra-control, body.dark-mode #depositInlineApp #methodModal #dynamicExtraFields .dynamic-extra-control, html[data-theme="light"] #depositInlineApp #methodModal #dynamicExtraFields .dynamic-extra-control, body.light-mode #depositInlineApp #methodModal #dynamicExtraFields .dynamic-extra-control{background:var(--bg-app) !important;background-image:none !important;color:var(--text) !important;-webkit-text-fill-color:currentColor !important;border:1px solid rgba(var(--site-accent-rgb, 148, 163, 184), .36) !important;box-shadow:none !important;}',
      'html[data-theme="dark"] #depositInlineApp #methodModal #dynamicExtraFields .dynamic-extra-label > :not(.dynamic-extra-badge), body.dark-mode #depositInlineApp #methodModal #dynamicExtraFields .dynamic-extra-label > :not(.dynamic-extra-badge), html[data-theme="light"] #depositInlineApp #methodModal #dynamicExtraFields .dynamic-extra-label > :not(.dynamic-extra-badge), body.light-mode #depositInlineApp #methodModal #dynamicExtraFields .dynamic-extra-label > :not(.dynamic-extra-badge){background:var(--bg-app) !important;background-image:none !important;color:var(--text) !important;border:1px solid rgba(var(--site-accent-rgb, 148, 163, 184), .42) !important;box-shadow:0 0 0 1px rgba(var(--site-accent-rgb, 148, 163, 184), .08) inset !important;}',
      'html[data-theme="dark"] #depositInlineApp #methodModal #methodInfo .info-item > strong, body.dark-mode #depositInlineApp #methodModal #methodInfo .info-item > strong, html[data-theme="light"] #depositInlineApp #methodModal #methodInfo .info-item > strong, body.light-mode #depositInlineApp #methodModal #methodInfo .info-item > strong, html[data-theme="dark"] #depositInlineApp #methodModal #methodInfo .inline-native-fee-item > strong, body.dark-mode #depositInlineApp #methodModal #methodInfo .inline-native-fee-item > strong, html[data-theme="light"] #depositInlineApp #methodModal #methodInfo .inline-native-fee-item > strong, body.light-mode #depositInlineApp #methodModal #methodInfo .inline-native-fee-item > strong{background:var(--bg-app) !important;background-image:none !important;color:var(--text) !important;border:1px solid rgba(var(--site-accent-rgb, 148, 163, 184), .42) !important;box-shadow:0 0 0 1px rgba(var(--site-accent-rgb, 148, 163, 184), .08) inset !important;}',
      'html[data-theme="dark"] #depositInlineApp #methodModal #methodInfo .info-item .info-value, body.dark-mode #depositInlineApp #methodModal #methodInfo .info-item .info-value, html[data-theme="light"] #depositInlineApp #methodModal #methodInfo .info-item .info-value, body.light-mode #depositInlineApp #methodModal #methodInfo .info-item .info-value, html[data-theme="dark"] #depositInlineApp #methodModal #methodInfo .inline-native-fee-item .info-value, body.dark-mode #depositInlineApp #methodModal #methodInfo .inline-native-fee-item .info-value, html[data-theme="light"] #depositInlineApp #methodModal #methodInfo .inline-native-fee-item .info-value, body.light-mode #depositInlineApp #methodModal #methodInfo .inline-native-fee-item .info-value{background:var(--bg-app) !important;background-image:none !important;color:var(--text) !important;border:1px solid rgba(var(--site-accent-rgb, 148, 163, 184), .36) !important;box-shadow:none !important;}',
      '#depositInlineApp #methodModal #methodInfo .info-item .copy-value-btn, html[data-theme="light"] #depositInlineApp #methodModal #methodInfo .info-item .copy-value-btn{background:var(--bg-app) !important;background-image:none !important;color:var(--text) !important;border-color:rgba(var(--site-accent-rgb, 148, 163, 184), .42) !important;box-shadow:none !important;}',
      '#depositInlineApp #methodModal #methodInfo .info-item .copy-value-btn:hover, html[data-theme="light"] #depositInlineApp #methodModal #methodInfo .info-item .copy-value-btn:hover{background:var(--bg-app) !important;box-shadow:none !important;}',
      '#depositInlineApp #methodModal .calc .field, html[data-theme="dark"] #depositInlineApp #methodModal .calc .field, body.dark-mode #depositInlineApp #methodModal .calc .field, html[data-theme="light"] #depositInlineApp #methodModal .calc .field, body.light-mode #depositInlineApp #methodModal .calc .field{padding:10px 0 0 !important;border:0 !important;background:transparent !important;background-image:none !important;box-shadow:none !important;border-radius:0 !important;}',
      '#depositInlineApp #methodModal .calc input, html[data-theme="dark"] #depositInlineApp #methodModal .calc input, body.dark-mode #depositInlineApp #methodModal .calc input, html[data-theme="light"] #depositInlineApp #methodModal .calc input, body.light-mode #depositInlineApp #methodModal .calc input{height:46px !important;min-height:46px !important;padding:0 16px !important;border-radius:999px !important;border:1px solid rgba(var(--site-accent-rgb, 148, 163, 184), .36) !important;background:var(--bg-app) !important;background-image:none !important;color:var(--text) !important;-webkit-text-fill-color:currentColor !important;box-shadow:none !important;}',
      '#depositInlineApp #methodModal :is(.btn-primary,.btn-outline,#proofTrigger.inline-proof-trigger,#submitDepositBtn), html[data-theme="light"] #depositInlineApp #methodModal :is(.btn-primary,.btn-outline,#proofTrigger.inline-proof-trigger,#submitDepositBtn), body.light-mode #depositInlineApp #methodModal :is(.btn-primary,.btn-outline,#proofTrigger.inline-proof-trigger,#submitDepositBtn){background:linear-gradient(180deg,rgba(var(--site-accent-rgb, 148, 163, 184), .10),rgba(var(--site-accent-rgb, 148, 163, 184), .04)),var(--bg-app) !important;color:var(--text) !important;border:1px solid rgba(var(--site-accent-rgb, 148, 163, 184), .42) !important;box-shadow:none !important;}',
      '#depositInlineApp #methodModal :is(.btn-primary,.btn-outline,#proofTrigger.inline-proof-trigger,#submitDepositBtn):hover, html[data-theme="light"] #depositInlineApp #methodModal :is(.btn-primary,.btn-outline,#proofTrigger.inline-proof-trigger,#submitDepositBtn):hover, body.light-mode #depositInlineApp #methodModal :is(.btn-primary,.btn-outline,#proofTrigger.inline-proof-trigger,#submitDepositBtn):hover{background:linear-gradient(180deg,rgba(var(--site-accent-rgb, 148, 163, 184), .14),rgba(var(--site-accent-rgb, 148, 163, 184), .06)),var(--bg-app) !important;border-color:rgba(var(--site-accent-rgb, 148, 163, 184), .50) !important;box-shadow:none !important;}',
      '#depositInlineApp #methodModal #proofTrigger.inline-proof-trigger :is(.inline-proof-trigger-label,.inline-proof-trigger-icon), html[data-theme="light"] #depositInlineApp #methodModal #proofTrigger.inline-proof-trigger :is(.inline-proof-trigger-label,.inline-proof-trigger-icon), body.light-mode #depositInlineApp #methodModal #proofTrigger.inline-proof-trigger :is(.inline-proof-trigger-label,.inline-proof-trigger-icon){color:var(--text) !important;}',
      '#depositInlineApp #methodModal #dynamicExtraFields .dynamic-extra-label, html[data-theme="dark"] #depositInlineApp #methodModal #dynamicExtraFields .dynamic-extra-label, body.dark-mode #depositInlineApp #methodModal #dynamicExtraFields .dynamic-extra-label, html[data-theme="light"] #depositInlineApp #methodModal #dynamicExtraFields .dynamic-extra-label, body.light-mode #depositInlineApp #methodModal #dynamicExtraFields .dynamic-extra-label{background:transparent !important;background-image:none !important;border:0 !important;box-shadow:none !important;outline:0 !important;}',
      '#depositInlineApp #methodModal #dynamicExtraFields .dynamic-extra-label > :not(.dynamic-extra-badge), html[data-theme="dark"] #depositInlineApp #methodModal #dynamicExtraFields .dynamic-extra-label > :not(.dynamic-extra-badge), body.dark-mode #depositInlineApp #methodModal #dynamicExtraFields .dynamic-extra-label > :not(.dynamic-extra-badge), html[data-theme="light"] #depositInlineApp #methodModal #dynamicExtraFields .dynamic-extra-label > :not(.dynamic-extra-badge), body.light-mode #depositInlineApp #methodModal #dynamicExtraFields .dynamic-extra-label > :not(.dynamic-extra-badge){background:transparent !important;background-image:none !important;border:0 !important;box-shadow:none !important;outline:0 !important;color:var(--text) !important;padding-inline:2px !important;}',
      '#depositInlineApp #methodModal #dynamicExtraFields .dynamic-extra-label > :not(.dynamic-extra-badge), html[data-theme="dark"] #depositInlineApp #methodModal #dynamicExtraFields .dynamic-extra-label > :not(.dynamic-extra-badge), body.dark-mode #depositInlineApp #methodModal #dynamicExtraFields .dynamic-extra-label > :not(.dynamic-extra-badge), html[data-theme="light"] #depositInlineApp #methodModal #dynamicExtraFields .dynamic-extra-label > :not(.dynamic-extra-badge), body.light-mode #depositInlineApp #methodModal #dynamicExtraFields .dynamic-extra-label > :not(.dynamic-extra-badge){display:inline-flex !important;align-items:center !important;justify-content:center !important;min-height:26px !important;padding:0 8px !important;border-radius:999px !important;background:var(--bg-app) !important;background-image:none !important;color:var(--text) !important;border:1px solid rgba(var(--site-accent-rgb, 148, 163, 184), .42) !important;box-shadow:0 0 0 1px rgba(var(--site-accent-rgb, 148, 163, 184), .08) inset !important;}',
      '#depositInlineApp #methodModal.inline-method-page{padding:clamp(14px,2.8vw,26px) 14px 38px !important;background:transparent !important;background-image:none !important;background-color:transparent !important;}',
      '#depositInlineApp #methodModal.inline-method-page .modal-content, html[data-theme="dark"] #depositInlineApp #methodModal.inline-method-page .modal-content, body.dark-mode #depositInlineApp #methodModal.inline-method-page .modal-content, html[data-theme="light"] #depositInlineApp #methodModal.inline-method-page .modal-content, body.light-mode #depositInlineApp #methodModal.inline-method-page .modal-content{width:min(720px,100%) !important;max-width:min(720px,100%) !important;margin:0 auto 38px !important;padding:0 !important;border:0 !important;border-radius:0 !important;background:transparent !important;background-image:none !important;background-color:transparent !important;box-shadow:none !important;outline:0 !important;overflow:visible !important;text-align:initial !important;}',
      '#depositInlineApp #methodModal.inline-method-page .modal-content::before{content:none !important;display:none !important;}',
      '#depositInlineApp #methodModal.inline-method-page .modal-x{display:none !important;}',
      '#depositInlineApp #methodModal.inline-method-page .modal-title{margin:0 0 14px !important;padding:0 !important;text-align:center !important;font-size:clamp(1.35rem,2.8vw,1.75rem) !important;line-height:1.25 !important;font-weight:900 !important;background:transparent !important;border:0 !important;box-shadow:none !important;}',
      '#depositInlineApp #methodModal.inline-method-page .rate-line, #depositInlineApp #methodModal.inline-method-page #fxBadge{display:none !important;}',
      '#depositInlineApp #methodModal.inline-method-page .calc{display:grid !important;grid-template-columns:1fr !important;gap:10px !important;margin:0 0 10px !important;padding:0 !important;background:transparent !important;border:0 !important;box-shadow:none !important;}',
      '#depositInlineApp #methodModal.inline-method-page #methodInfo, #depositInlineApp #methodModal.inline-method-page #dynamicExtraFields{display:grid !important;gap:10px !important;margin:0 0 10px !important;padding:0 !important;background:transparent !important;border:0 !important;box-shadow:none !important;}',
      '#depositInlineApp #methodModal.inline-method-page :is(.calc .field,#methodInfo .info-item,#methodInfo .inline-native-fee-item,#dynamicExtraFields .dynamic-extra-field){position:relative !important;display:block !important;margin:0 !important;padding:8px 0 0 !important;border:0 !important;border-radius:0 !important;background:transparent !important;background-image:none !important;box-shadow:none !important;min-height:0 !important;}',
      '#depositInlineApp #methodModal.inline-method-page :is(.calc label,#methodInfo .info-item > strong,#methodInfo .inline-native-fee-item > strong,#dynamicExtraFields .dynamic-extra-label){position:absolute !important;top:8px !important;inset-inline-end:12px !important;right:12px !important;left:auto !important;transform:translateY(-50%) !important;z-index:2 !important;margin:0 !important;}',
      '#depositInlineApp #methodModal.inline-method-page :is(.calc label,#methodInfo .info-item > strong,#methodInfo .inline-native-fee-item > strong,#dynamicExtraFields .dynamic-extra-label > :not(.dynamic-extra-badge)){min-height:22px !important;height:22px !important;padding:0 8px !important;border-radius:999px !important;font-size:.72rem !important;line-height:20px !important;font-weight:900 !important;display:inline-flex !important;align-items:center !important;justify-content:center !important;background:var(--bg-app) !important;background-image:none !important;color:var(--text) !important;border:1px solid rgba(var(--site-accent-rgb, 148, 163, 184), .42) !important;box-shadow:none !important;}',
      // «سيُضاف» (recvCUR) label border matches the recv input/chip dynamic accent border.
      '#depositInlineApp #methodModal.inline-method-page .calc #fieldRecv label[for="recvCUR"]{border-color:var(--site-accent-runtime, var(--accent-theme, rgba(var(--site-accent-rgb, 148, 163, 184), .8))) !important;}',
      '#depositInlineApp #methodModal.inline-method-page #dynamicExtraFields .dynamic-extra-label{background:transparent !important;border:0 !important;box-shadow:none !important;padding:0 !important;pointer-events:none !important;}',
      '#depositInlineApp #methodModal.inline-method-page #dynamicExtraFields .dynamic-extra-badge, #depositInlineApp #methodModal.inline-method-page #dynamicExtraFields .dynamic-extra-hint{display:none !important;}',
      '#depositInlineApp #methodModal.inline-method-page :is(.calc input,.info-value,.dynamic-extra-control){height:46px !important;min-height:46px !important;border-radius:999px !important;font-size:.98rem !important;font-weight:900 !important;padding:0 16px !important;}',
      '#depositInlineApp #methodModal.inline-method-page #fieldRecv{position:relative !important;}',
      '#depositInlineApp #methodModal.inline-method-page #fieldRecv .inline-recv-currency-chip{display:none;}',
      '#depositInlineApp #methodModal.inline-method-page #fieldRecv.has-recv-currency-chip .inline-recv-currency-chip{position:absolute !important;z-index:4 !important;left:0 !important;right:auto !important;top:0 !important;bottom:0 !important;min-width:76px !important;padding:0 12px !important;display:inline-flex !important;align-items:center !important;justify-content:center !important;gap:5px !important;border:0 !important;border-right:1.5px solid var(--site-accent-runtime, var(--accent-theme, rgba(var(--site-accent-rgb, 148, 163, 184), .8))) !important;border-radius:999px 0 0 999px !important;cursor:pointer !important;font-size:.84rem !important;font-weight:900 !important;line-height:1 !important;letter-spacing:.4px !important;color:#fff !important;-webkit-text-fill-color:#fff !important;background:var(--site-accent-runtime-strong, var(--site-accent-runtime, var(--accent-theme, #0b6388))) !important;box-shadow:none !important;}',
      '#depositInlineApp #methodModal.inline-method-page #fieldRecv.has-recv-currency-chip .inline-recv-currency-chip i{font-size:.6rem !important;opacity:.85 !important;}',
      '#depositInlineApp #methodModal.inline-method-page #fieldRecv.has-recv-currency-chip .inline-recv-currency-chip:hover, #depositInlineApp #methodModal.inline-method-page #fieldRecv.has-recv-currency-chip .inline-recv-currency-chip:focus, #depositInlineApp #methodModal.inline-method-page #fieldRecv.has-recv-currency-chip .inline-recv-currency-chip:focus-visible, #depositInlineApp #methodModal.inline-method-page #fieldRecv.has-recv-currency-chip .inline-recv-currency-chip:active{filter:none !important;transform:none !important;box-shadow:none !important;opacity:1 !important;outline:none !important;background:var(--site-accent-runtime-strong, var(--site-accent-runtime, var(--accent-theme, #0b6388))) !important;-webkit-tap-highlight-color:transparent !important;}',
      '#depositInlineApp #methodModal.inline-method-page #fieldRecv.has-recv-currency-chip input{padding-left:90px !important;padding-right:90px !important;text-align:center !important;border:1.5px solid var(--site-accent-runtime, var(--accent-theme, rgba(var(--site-accent-rgb, 148, 163, 184), .8))) !important;}',
      '#depositInlineApp #methodModal.inline-method-page #fieldRecv.has-recv-currency-chip input:focus{border-color:var(--site-accent-runtime-strong, var(--site-accent-runtime, var(--accent-theme, #0b6388))) !important;box-shadow:0 0 0 3px rgba(var(--site-accent-rgb, 148, 163, 184), .18) !important;}',
      '#depositInlineApp #methodModal.inline-method-page #fieldRecv .inline-recv-currency-menu{position:absolute !important;z-index:40 !important;left:0 !important;right:auto !important;top:calc(100% + 8px) !important;bottom:auto !important;width:238px !important;max-width:calc(100vw - 40px) !important;max-height:244px !important;overflow-y:auto !important;padding:7px !important;border-radius:18px !important;background:var(--bg-app, #0b1020) !important;border:1.5px solid var(--site-accent-runtime, rgba(var(--site-accent-rgb, 148, 163, 184), .5)) !important;box-shadow:0 22px 50px rgba(0,0,0,.5) !important;display:flex !important;flex-direction:column !important;gap:2px !important;}',
      '#depositInlineApp #methodModal.inline-method-page #fieldRecv .inline-recv-currency-menu[hidden]{display:none !important;}',
      '#depositInlineApp #methodModal.inline-method-page #fieldRecv .inline-recv-currency-option{display:flex !important;align-items:center !important;gap:10px !important;width:100% !important;padding:11px 12px !important;border:0 !important;border-radius:12px !important;cursor:pointer !important;background:transparent !important;color:var(--text) !important;font-size:.9rem !important;font-weight:800 !important;text-align:start !important;transition:background .15s ease !important;}',
      '#depositInlineApp #methodModal.inline-method-page #fieldRecv .inline-recv-currency-option:hover{background:rgba(var(--site-accent-rgb, 148, 163, 184), .16) !important;}',
      '#depositInlineApp #methodModal.inline-method-page #fieldRecv .inline-recv-currency-option.is-active{background:var(--site-accent-runtime-strong, var(--site-accent-runtime, var(--accent-theme, #0b6388))) !important;color:#fff !important;}',
      '#depositInlineApp #methodModal.inline-method-page #fieldRecv .inline-recv-currency-option.is-active .inline-recv-currency-option-code, #depositInlineApp #methodModal.inline-method-page #fieldRecv .inline-recv-currency-option.is-active .inline-recv-currency-option-name{color:#fff !important;opacity:1 !important;}',
      '#depositInlineApp #methodModal.inline-method-page #fieldRecv .inline-recv-currency-option-code{min-width:48px !important;font-weight:900 !important;font-size:.92rem !important;letter-spacing:.3px !important;color:var(--site-accent-runtime, var(--accent-theme, inherit)) !important;}',
      '#depositInlineApp #methodModal.inline-method-page #fieldRecv .inline-recv-currency-option-name{flex:1 1 auto !important;opacity:.78 !important;font-weight:700 !important;font-size:.82rem !important;white-space:nowrap !important;overflow:hidden !important;text-overflow:ellipsis !important;}',
      '#depositInlineApp #methodModal.inline-method-page #fieldRecv .inline-recv-currency-option-sym{display:none !important;}',
      '#depositInlineApp #methodModal.inline-method-page .actions{display:grid !important;grid-template-columns:1fr !important;gap:10px !important;margin:10px 0 0 !important;padding:0 !important;background:transparent !important;border:0 !important;box-shadow:none !important;}',
      '#depositInlineApp #methodModal.inline-method-page #proofTrigger, #depositInlineApp #methodModal.inline-method-page #submitDepositBtn, #depositInlineApp #methodModal.inline-method-page #closeModal{grid-column:1/-1 !important;width:100% !important;height:48px !important;min-height:48px !important;border-radius:999px !important;}',
      '#depositInlineApp #methodModal.inline-method-page #submitDepositBtn{background:var(--site-accent-runtime-strong, var(--site-accent-runtime, var(--accent-theme, #0b6388))) !important;color:#fff !important;border:0 !important;box-shadow:none !important;}',
      '#depositInlineApp #methodModal.inline-method-page #submitDepositBtn:disabled{opacity:.55 !important;cursor:not-allowed !important;}',
      '#depositInlineApp #methodModal.inline-method-page #closeModal{display:inline-flex !important;background:transparent !important;color:var(--text) !important;border:1px solid rgba(var(--site-accent-rgb, 148, 163, 184), .34) !important;}',
      '#depositInlineApp #methodModal.inline-method-page #methodHint, #depositInlineApp #methodModal.inline-method-page #proofPreview{text-align:center !important;background:transparent !important;border:0 !important;box-shadow:none !important;margin:12px auto 0 !important;padding:0 !important;font-size:.92rem !important;line-height:1.55 !important;}',
      '#depositInlineApp #methodModal.inline-method-page .modal-content{--inline-method-gap:14px !important;--inline-method-field-pad:8px !important;--inline-method-label-top:8px !important;}',
      '#depositInlineApp #methodModal.inline-method-page :is(.calc,#methodInfo,#dynamicExtraFields){gap:var(--inline-method-gap,14px) !important;margin:0 0 var(--inline-method-gap,14px) !important;}',
      '#depositInlineApp #methodModal.inline-method-page .actions{gap:var(--inline-method-gap,14px) !important;margin:0 !important;}',
      '#depositInlineApp #methodModal.inline-method-page :is(.calc .field,#methodInfo .info-item,#methodInfo .inline-native-fee-item,#dynamicExtraFields .dynamic-extra-field){padding:var(--inline-method-field-pad,8px) 0 0 !important;}',
      '#depositInlineApp #methodModal.inline-method-page :is(.calc label,#methodInfo .info-item > strong,#methodInfo .inline-native-fee-item > strong,#dynamicExtraFields .dynamic-extra-label){top:var(--inline-method-label-top,8px) !important;}',
      '#depositInlineApp #methodModal.inline-method-page #dynamicExtraFields[hidden], #depositInlineApp #methodModal.inline-method-page #dynamicExtraFields[aria-hidden="true"], #depositInlineApp #methodModal.inline-method-page #methodInfo:empty{display:none !important;margin:0 !important;padding:0 !important;gap:0 !important;}',
      '#depositInlineApp #methodModal.inline-method-page :is(.calc input,.info-value,.dynamic-extra-control,#proofTrigger,#submitDepositBtn,#closeModal){height:46px !important;min-height:46px !important;}',
      '@media (max-width: 640px){#depositInlineApp #methodModal.inline-method-page{padding:14px 10px 30px !important;}#depositInlineApp #methodModal.inline-method-page .modal-title{font-size:1.45rem !important;margin-bottom:12px !important;}#depositInlineApp #methodModal.inline-method-page .modal-content{width:min(340px,100%) !important;max-width:min(340px,100%) !important;--inline-method-gap:12px !important;--inline-method-field-pad:8px !important;--inline-method-label-top:8px !important;}#depositInlineApp #methodModal.inline-method-page :is(.calc,.actions,#methodInfo,#dynamicExtraFields){gap:var(--inline-method-gap,12px) !important;margin-bottom:var(--inline-method-gap,12px) !important;}#depositInlineApp #methodModal.inline-method-page :is(.calc input,.info-value,.dynamic-extra-control){height:44px !important;min-height:44px !important;font-size:.94rem !important;}#depositInlineApp #methodModal.inline-method-page :is(#proofTrigger,#submitDepositBtn,#closeModal){height:44px !important;min-height:44px !important;}}',
      '#depositInlineApp #methodModal.inline-method-page .modal-content{--inline-stack-gap:12px !important;--inline-label-clearance:8px !important;display:grid !important;grid-template-columns:1fr !important;row-gap:var(--inline-stack-gap,12px) !important;}',
      '#depositInlineApp #methodModal.inline-method-page .modal-title{margin:0 !important;}',
      '#depositInlineApp #methodModal.inline-method-page :is(.calc,#methodInfo,#dynamicExtraFields,.inline-extra-fields,.actions){display:contents !important;margin:0 !important;padding:0 !important;gap:0 !important;background:transparent !important;border:0 !important;box-shadow:none !important;}',
      '#depositInlineApp #methodModal.inline-method-page :is(#dynamicExtraFields .dynamic-extra-grid,.inline-extra-fields-grid){display:contents !important;margin:0 !important;padding:0 !important;gap:0 !important;}',
      '#depositInlineApp #methodModal.inline-method-page :is(#dynamicExtraFields[hidden],#dynamicExtraFields[aria-hidden="true"],.inline-extra-fields[hidden],#methodInfo:empty){display:none !important;}',
      '#depositInlineApp #methodModal.inline-method-page :is(.calc .field,#methodInfo .info-item,#methodInfo .inline-native-fee-item,#methodInfo .info-item-fee,#methodInfo .info-item-group,#dynamicExtraFields .dynamic-extra-field,.inline-extra-field){position:relative !important;margin:0 !important;padding:var(--inline-label-clearance,8px) 0 0 !important;background:transparent !important;border:0 !important;box-shadow:none !important;}',
      '#depositInlineApp #methodModal.inline-method-page :is(.calc label,#methodInfo .info-item > strong,#methodInfo .inline-native-fee-item > strong,#methodInfo .info-item-fee > strong,#methodInfo .info-item-group > strong,#dynamicExtraFields .dynamic-extra-label,.inline-extra-label){top:var(--inline-label-clearance,8px) !important;}',
      '#depositInlineApp #methodModal.inline-method-page :is(#proofTrigger,#submitDepositBtn,#closeModal){margin-top:var(--inline-label-clearance,8px) !important;height:46px !important;min-height:46px !important;}',
      '#depositInlineApp #methodModal.inline-method-page :is(.calc input,.info-value,.dynamic-extra-control,.inline-extra-control){height:46px !important;min-height:46px !important;}',
      '#depositInlineApp #methodModal.inline-method-page :is(#methodHint,#proofPreview){margin:0 auto !important;}',
      '@media (max-width:640px){#depositInlineApp #methodModal.inline-method-page .modal-content{--inline-stack-gap:10px !important;--inline-label-clearance:8px !important;}#depositInlineApp #methodModal.inline-method-page :is(.calc input,.info-value,.dynamic-extra-control,.inline-extra-control,#proofTrigger,#submitDepositBtn,#closeModal){height:44px !important;min-height:44px !important;}}',
      '#depositInlineApp #methodModal.inline-method-page .modal-content{--inline-control-gap:18px !important;--inline-control-height:46px !important;--inline-label-clearance:0px !important;position:relative !important;display:grid !important;grid-template-columns:1fr !important;row-gap:var(--inline-control-gap,18px) !important;padding-top:0 !important;}',
      '#depositInlineApp #methodModal.inline-method-page .modal-title{margin:0 !important;}',
      '#depositInlineApp #methodModal.inline-method-page :is(.calc,#methodInfo,#dynamicExtraFields,.inline-extra-fields,.actions,#dynamicExtraFields .dynamic-extra-grid,.inline-extra-fields-grid){display:contents !important;margin:0 !important;padding:0 !important;gap:0 !important;background:transparent !important;border:0 !important;box-shadow:none !important;}',
      '#depositInlineApp #methodModal.inline-method-page :is(#dynamicExtraFields[hidden],#dynamicExtraFields[aria-hidden="true"],.inline-extra-fields[hidden],#methodInfo:empty,#closeModal){display:none !important;margin:0 !important;padding:0 !important;gap:0 !important;}',
      '#depositInlineApp #methodModal.inline-method-page :is(.calc .field,#methodInfo .info-item,#methodInfo .inline-native-fee-item,#methodInfo .info-item-fee,#methodInfo .info-item-group,#dynamicExtraFields .dynamic-extra-field,.inline-extra-field){position:relative !important;margin:0 !important;padding:0 !important;background:transparent !important;border:0 !important;box-shadow:none !important;min-height:0 !important;}',
      '#depositInlineApp #methodModal.inline-method-page :is(.calc label,#methodInfo .info-item > strong,#methodInfo .inline-native-fee-item > strong,#methodInfo .info-item-fee > strong,#methodInfo .info-item-group > strong,#dynamicExtraFields .dynamic-extra-label,.inline-extra-label){top:0 !important;transform:translateY(-50%) !important;margin:0 !important;}',
      '#depositInlineApp #methodModal.inline-method-page :is(.calc input,.info-value,.dynamic-extra-control,.inline-extra-control,#proofTrigger,#submitDepositBtn){height:var(--inline-control-height,46px) !important;min-height:var(--inline-control-height,46px) !important;margin:0 !important;}',
      '#depositInlineApp #methodModal.inline-method-page :is(#proofTrigger,#submitDepositBtn){width:100% !important;border-radius:999px !important;}',
      '#depositInlineApp #methodModal.inline-method-page :is(#methodHint,#proofPreview){margin:0 auto !important;}',
      '#depositInlineApp #methodModal.inline-method-page .modal-x{display:inline-flex !important;position:absolute !important;top:0 !important;left:0 !important;right:auto !important;width:34px !important;min-width:34px !important;height:34px !important;min-height:34px !important;padding:0 !important;border-radius:999px !important;align-items:center !important;justify-content:center !important;background:transparent !important;border:1px solid rgba(var(--site-accent-rgb, 148, 163, 184), .34) !important;color:var(--text) !important;box-shadow:none !important;z-index:4 !important;}',
      '#depositInlineApp #methodModal.inline-method-page .modal-x i{font-size:.9rem !important;line-height:1 !important;}',
      '@media (max-width:640px){#depositInlineApp #methodModal.inline-method-page .modal-content{--inline-control-gap:16px !important;--inline-control-height:44px !important;}#depositInlineApp #methodModal.inline-method-page .modal-x{width:32px !important;min-width:32px !important;height:32px !important;min-height:32px !important;}}',
      '#depositInlineContainer, #depositInlineApp, #depositInlineApp main{margin-top:0 !important;padding-top:0 !important;}',
      '#depositInlineApp #methodModal.inline-method-page{padding:4px 12px 30px !important;}',
      '#depositInlineApp #methodModal.inline-method-page .modal-content{padding-top:34px !important;margin-top:0 !important;}',
      '#depositInlineApp #methodModal.inline-method-page .modal-title{margin:0 !important;}',
      '#depositInlineApp #methodModal.inline-method-page .modal-x{display:inline-flex !important;position:absolute !important;top:0 !important;left:0 !important;right:auto !important;inset-inline-start:auto !important;inset-inline-end:auto !important;margin-left:0 !important;margin-right:auto !important;transform:none !important;width:30px !important;min-width:30px !important;height:30px !important;min-height:30px !important;border-radius:999px !important;font-size:.82rem !important;}',
      '#depositInlineApp #methodModal.inline-method-page .modal-x .fa-xmark::before{content:"\\f060" !important;}',
      '#depositInlineApp #methodModal.inline-method-page .modal-x i{font-family:"Font Awesome 6 Free" !important;font-weight:900 !important;}',
      '@media (max-width:640px){#depositInlineApp #methodModal.inline-method-page{padding-top:2px !important;}#depositInlineApp #methodModal.inline-method-page .modal-content{padding-top:30px !important;}#depositInlineApp #methodModal.inline-method-page .modal-x{width:28px !important;min-width:28px !important;height:28px !important;min-height:28px !important;}}'
    ].concat(buildInlineDepositTreeCardCss()).join('\n');
    document.head.appendChild(style);
    state.styleEl = style;
  }

  function decodeBase64Utf8(b64) {
    const binary = atob(b64);
    if (typeof TextDecoder !== 'undefined') {
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }
      return new TextDecoder('utf-8').decode(bytes);
    }
    try {
      return decodeURIComponent(escape(binary));
    } catch (err) {
      console.warn('fallback UTF-8 decode failed, returning raw string', err);
      return binary;
    }
  }

  function readTemplateHtmlFromHost() {
    try {
      const tpl = document.getElementById('deposit-inline-template');
      if (!tpl) return '';
      const tag = String(tpl.tagName || '').toUpperCase();
      const raw = tag === 'TEXTAREA'
        ? String(tpl.value || tpl.textContent || '')
        : String(tpl.innerHTML || tpl.textContent || '');
      const html = raw.trim();
      if (!html) return '';
      if (/<html[\s>]/i.test(html) || /<!DOCTYPE\s+html/i.test(html)) return html;
      return '';
    } catch (_) {
      return '';
    }
  }

  function isDepositInlineDebugEnabled() {
    try {
      if (typeof window !== 'undefined' && window.__DEPOSIT_INLINE_DEBUG__ === true) return true;
    } catch (_) {}
    try {
      return typeof localStorage !== 'undefined' && localStorage.getItem('depositInlineDebug') === '1';
    } catch (_) {}
    return false;
  }

  function depositInlineLog(level) {
    const severity = String(level || '').trim().toLowerCase();
    if (severity !== 'error' && !isDepositInlineDebugEnabled()) return;
    try {
      const logger = (console && typeof console[severity] === 'function')
        ? console[severity]
        : (console && typeof console.log === 'function' ? console.log : null);
      if (!logger) return;
      const args = Array.prototype.slice.call(arguments, 1);
      logger.apply(console, args);
    } catch (_) {}
  }

  function loadEdAA() {
    if (state.loadPromise) return state.loadPromise;
    state.loadPromise = Promise.resolve().then(function () {
      const hostTemplateHtml = readTemplateHtmlFromHost();
      const source = hostTemplateHtml ? 'textarea-template' : 'embedded-base64';
      // The base64 app ships in chunk-deposit.js (window.__EDAA_B64__), loaded by
      // __loadRouteChunk before this route builds; the local const is an empty
      // fallback so a failed chunk still degrades to the #deposit-inline-template path.
      const html = hostTemplateHtml || decodeBase64Utf8(String(window.__EDAA_B64__ || EDAA_BASE64));
      try {
        depositInlineLog('info', '[deposit-inline] template source:', source);
      } catch (_) {}
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const styles = Array.from(doc.querySelectorAll('style'))
        .map(function (el) {
          return el.textContent || '';
        })
        .join('\n');
      const main = doc.querySelector('main');
      const modal = doc.querySelector('#methodModal');
      let markup =
        (main ? main.outerHTML : '') +
        (modal ? modal.outerHTML : '');
      markup = markup
        .replace(
          /<div class="dynamic-extra-head">\s*<strong>بيانات العميل<\/strong>\s*<span>[\s\S]*?<\/span>/,
          '<div class="dynamic-extra-head"><strong>بيانات العميل</strong>'
        )
        .replace(
          /<div id="methodHint" class="hint">[\s\S]*?<\/div>/,
          '<div id="methodHint" class="hint" hidden></div>'
        );
      const scripts = Array.from(doc.querySelectorAll('body > script'));
      const scriptText =
        scripts.length ? scripts[scripts.length - 1].textContent || '' : '';
      const templateWorkerBaseMatch = scriptText.match(/const WORKER_DEFAULT\s*=\s*["'](https:\/\/[^"'\\]+(?:workers\.dev|[a-z0-9.-]+\.[a-z]{2,})\/?)["'];/i)
        || scriptText.match(/const WORKER_BASE\s*=\s*["'](https:\/\/[^"'\\]+(?:workers\.dev|[a-z0-9.-]+\.[a-z]{2,})\/?)["'];/i);
      const templateWorkerBase = templateWorkerBaseMatch && templateWorkerBaseMatch[1]
        ? normalizeWorkerBase(templateWorkerBaseMatch[1])
        : '';
      if (!scriptText) {
        try { console.error('[deposit-inline] no body script found in deposit template'); } catch (_) {}
      }
      return { styles, markup, scriptText, source, templateWorkerBase };
    });
    return state.loadPromise;
  }

  let inlineLoaderHeld = false;
  let inlineHiddenMethodModal = null;
  let inlineLoaderShownAtMs = 0;
  let inlineLoaderHideTimer = 0;
  function setInlinePreloaderVisible(_app, visible) {
    const app = _app && _app.querySelector ? _app : (state && state.app && state.app.querySelector ? state.app : null);
    const clearHideTimer = function(){
      if (!inlineLoaderHideTimer) return;
      try { clearTimeout(inlineLoaderHideTimer); } catch (_) {}
      inlineLoaderHideTimer = 0;
    };
    try {
      if (visible) {
        try { syncDepositInlineLoadingEmptyState(true); } catch (_) {}
        clearHideTimer();
        try {
          if (typeof window.__setInlineWalletRoutePending === 'function') window.__setInlineWalletRoutePending(true);
        } catch (_) {}
        try {
          const methodModal = app && app.querySelector ? app.querySelector('#methodModal') : null;
          if (methodModal && methodModal.classList && methodModal.classList.contains('open')) {
            inlineHiddenMethodModal = methodModal;
            methodModal.style.opacity = '0';
            methodModal.style.visibility = 'hidden';
            methodModal.style.pointerEvents = 'none';
          }
        } catch (_) {}
        if (!inlineLoaderHeld) inlineLoaderShownAtMs = Date.now();
        if (inlineLoaderHeld) return;
        if (typeof window.__holdPageLoader === 'function') {
          window.__holdPageLoader();
          try {
            const pre = document.getElementById('preloader');
            if (pre) {
              pre.style.zIndex = '200000';
              pre.style.visibility = 'visible';
              pre.style.pointerEvents = 'auto';
            }
          } catch (_) {}
          inlineLoaderHeld = true;
          return;
        }
        if (typeof window.showPageLoader === 'function') {
          window.showPageLoader({ hold: true });
          try {
            const pre = document.getElementById('preloader');
            if (pre) {
              pre.style.zIndex = '200000';
              pre.style.visibility = 'visible';
              pre.style.pointerEvents = 'auto';
            }
          } catch (_) {}
          inlineLoaderHeld = true;
          return;
        }
        const pre = document.getElementById('preloader');
        if (pre) {
          pre.classList.remove('hidden');
          pre.classList.remove('closing');
          pre.style.display = 'flex';
          pre.style.opacity = '1';
          pre.style.visibility = 'visible';
          pre.style.pointerEvents = 'auto';
          pre.style.zIndex = '200000';
          try { if (typeof window.__primePageLoaderIntro === 'function') window.__primePageLoaderIntro(pre); } catch (_) {}
          inlineLoaderHeld = true;
        }
        return;
      }

      if (isDepositInlineCountriesLoading()) {
        try { syncDepositInlineLoadingEmptyState(true); } catch (_) {}
        clearHideTimer();
        try {
          if (typeof window.__setInlineWalletRoutePending === 'function') window.__setInlineWalletRoutePending(true);
        } catch (_) {}
        return;
      }
      clearHideTimer();

      try { syncDepositInlineLoadingEmptyState(false); } catch (_) {}
      try { clearDepositInlineCountriesLoaderOverrides(); } catch (_) {}
      try {
        if (typeof window.__setInlineWalletRoutePending === 'function') window.__setInlineWalletRoutePending(false);
      } catch (_) {}
      try {
        if (inlineHiddenMethodModal) {
          inlineHiddenMethodModal.style.removeProperty('opacity');
          inlineHiddenMethodModal.style.removeProperty('visibility');
          inlineHiddenMethodModal.style.removeProperty('pointer-events');
        }
        inlineHiddenMethodModal = null;
      } catch (_) {}
      inlineLoaderShownAtMs = 0;
      if (!inlineLoaderHeld) return;
      if (typeof window.__releasePageLoader === 'function') {
        window.__releasePageLoader();
        inlineLoaderHeld = false;
        return;
      }
      if (typeof window.hidePageLoader === 'function') {
        window.hidePageLoader({ force: true });
        inlineLoaderHeld = false;
        return;
      }
      const pre = document.getElementById('preloader');
      if (pre) {
        pre.classList.remove('entering');
        pre.classList.remove('hidden');
        pre.classList.add('closing');
        pre.style.opacity = '0';
        pre.style.visibility = 'hidden';
        pre.style.pointerEvents = 'none';
        setTimeout(function () {
          try {
            if (!pre.classList.contains('closing')) return;
            pre.classList.remove('closing');
            pre.classList.add('hidden');
            pre.style.display = 'none';
          } catch (_) {}
        }, 280);
      }
      inlineLoaderHeld = false;
    } catch (_) {}
  }

  function shouldRefreshInlineCountriesOnShow(_flow, app) {
    try {
      if (window.__INLINE_WALLET_ROUTE_PENDING__ === true) return true;
    } catch (_) {}
    try {
      if (document.documentElement && document.documentElement.classList.contains('inline-wallet-route-pending')) return true;
      if (document.body && document.body.classList.contains('inline-wallet-route-pending')) return true;
    } catch (_) {}
    try {
      const host = app && app.querySelector ? app : state.app;
      if (!host || !host.querySelector) return true;
      if (host.style && host.style.visibility === 'hidden') return true;
      const container = host.parentNode && host.parentNode.id === 'depositInlineContainer'
        ? host.parentNode
        : null;
      if (container && container.style && container.style.visibility === 'hidden') return true;
      const grid = host.querySelector('#grid');
      if (!grid) return true;
      if (grid.getAttribute && grid.getAttribute('data-flow-loading')) return true;
      return !grid.querySelector('.card');
    } catch (_) {
      return true;
    }
  }

  function bindInlineModalEnhancements(app) {
    if (!app || !app.querySelector) return;
    if (app.dataset && app.dataset.depositEnhanceBound === '1') return;
    if (app.dataset) app.dataset.depositEnhanceBound = '1';

    const grid = app.querySelector('#grid');
    const backBtn = app.querySelector('#backBtn');
    const methodModal = app.querySelector('#methodModal');
    const closeBtn = app.querySelector('#closeModal');
    const closeX = app.querySelector('.modal-x');
    const forceCloseMethodModal = function () {
      try {
        const modal =
          (app && app.querySelector && app.querySelector('#methodModal')) ||
          document.querySelector('#depositInlineApp #methodModal') ||
          methodModal;
        if (!modal) return false;
        modal.classList.add('hidden');
        modal.classList.remove('open');
        modal.classList.remove('inline-method-page');
        modal.removeAttribute('data-inline-method-page');
        modal.setAttribute('aria-hidden', 'true');
        modal.style.removeProperty('display');
        modal.style.removeProperty('opacity');
        modal.style.removeProperty('visibility');
        modal.style.removeProperty('pointer-events');
        try {
          if (modal.parentElement) {
            modal.parentElement.classList.remove('method-modal-open');
            modal.parentElement.classList.remove('modal-open');
          }
        } catch (_) {}
        return true;
      } catch (_) {
        return false;
      }
    };
    try { window.__depositInlineForceCloseMethodModal = forceCloseMethodModal; } catch (_) {}
    try {
      if (closeBtn) closeBtn.setAttribute('type', 'button');
      if (closeX) {
        closeX.setAttribute('type', 'button');
        // The embedded template ships with an inline onclick on the floating X.
        // Remove it so the close path stays single and predictable in inline mode.
        closeX.removeAttribute('onclick');
        closeX.onclick = null;
      }
    } catch (_) {}

    if (app && !app.dataset.boundInlineMethodCloseDelegate) {
      app.dataset.boundInlineMethodCloseDelegate = '1';
      app.addEventListener('click', function (event) {
        const target = event && event.target && event.target.closest
          ? event.target.closest('#methodModal .modal-x, #methodModal #closeModal, #methodModal [data-close-modal], #methodModal [data-modal-close]')
          : null;
        if (!target) return;
        try {
          event.preventDefault();
          event.stopPropagation();
        } catch (_) {}
        try {
          if (typeof window.__depositInlineCloseMethodModal === 'function') {
            window.__depositInlineCloseMethodModal();
          }
        } catch (_) {}
        forceCloseMethodModal();
        hideOpenWaitLoader();
      }, true);
    }
    try {
      if (methodModal && !methodModal.dataset.boundInlineAutoCloseObserver && typeof MutationObserver === 'function') {
        methodModal.dataset.boundInlineAutoCloseObserver = '1';
        const autoCloseObserver = new MutationObserver(function () {
          try {
            if (Date.now() > Number(state.suppressInlineMethodModalUntil || 0)) return;
            if (Date.now() - Number(state.lastInlineAppClickAt || 0) < 900) return;
            if (!methodModal.classList.contains('hidden') || methodModal.classList.contains('open')) {
              forceCloseMethodModal();
            }
          } catch (_) {}
        });
        autoCloseObserver.observe(methodModal, {
          attributes: true,
          attributeFilter: ['class', 'style', 'aria-hidden'],
          childList: false,
          subtree: false
        });
      }
    } catch (_) {}

    let openWaitTimer = null;
    const clearOpenWaitTimer = function () {
      if (!openWaitTimer) return;
      try { clearTimeout(openWaitTimer); } catch (_) {}
      openWaitTimer = null;
    };
    const showOpenWaitLoader = function () {
      setInlinePreloaderVisible(app, true);
      clearOpenWaitTimer();
      openWaitTimer = setTimeout(function () {
        setInlinePreloaderVisible(app, false);
      }, 12000);
    };
    const hideOpenWaitLoader = function () {
      clearOpenWaitTimer();
      setInlinePreloaderVisible(app, false);
    };
    const hideOpenWaitLoaderOnHashChange = function () {
      let walletHash = false;
      let keepVisible = false;
      try {
        walletHash = /^#\/(?:deposit|edaa)(?:\/|$)/.test(String(location.hash || '').toLowerCase());
      } catch (_) {}
      try {
        keepVisible = walletHash && (
          window.__INLINE_WALLET_ROUTE_PENDING__ === true ||
          window.__INLINE_WALLET_BOOT_HOLD__ === true ||
          window.__LOADER_HOLD_ACTIVE__ === true
        );
      } catch (_) {}
      if (keepVisible) return;
      hideOpenWaitLoader();
    };

    // Ensure X close always works, even if inline onclick cannot reach local scope.
    if (closeX && !closeX.dataset.boundCloseX) {
      closeX.dataset.boundCloseX = '1';
      closeX.addEventListener('click', function (event) {
        try {
          event.preventDefault();
          event.stopPropagation();
        } catch (_) {}
        try {
          let closeDispatched = false;
          if (typeof window.__depositInlineCloseMethodModal === 'function') {
            try {
              window.__depositInlineCloseMethodModal();
              closeDispatched = true;
            } catch (_) {}
          }
          if (!closeDispatched && closeBtn) {
            try {
              closeBtn.dispatchEvent(new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                view: window
              }));
              closeDispatched = true;
            } catch (_) {
              try {
                closeBtn.dispatchEvent(new Event('click', {
                  bubbles: true,
                  cancelable: true
                }));
                closeDispatched = true;
              } catch (__) {}
            }
            if (!closeDispatched && typeof closeBtn.click === 'function') {
              closeBtn.click();
              closeDispatched = true;
            }
          }
          forceCloseMethodModal();
        } catch (_) {}
        hideOpenWaitLoader();
      });
    }

    // Show loader when selecting a payment method card (methods view only).
    if (grid && !grid.dataset.boundOpenLoader) {
      grid.dataset.boundOpenLoader = '1';
      grid.addEventListener('click', function (event) {
        const card = event && event.target && event.target.closest
          ? event.target.closest('.card')
          : null;
        if (!card) return;
        let methodsView = false;
        try {
          const hash = String(location.hash || '').toLowerCase();
          methodsView = /^#\/(?:deposit|edaa)\/[^/]+/.test(hash);
          if (backBtn) methodsView = methodsView || window.getComputedStyle(backBtn).display !== 'none';
        } catch (_) {}
        if (methodsView) showOpenWaitLoader();
      }, true);
    }

    if (closeBtn && !closeBtn.dataset.boundHideLoader) {
      closeBtn.dataset.boundHideLoader = '1';
      closeBtn.addEventListener('click', hideOpenWaitLoader);
    }

    if (methodModal) {
      try {
        const observer = new MutationObserver(function () {
          try {
            if (methodModal.classList.contains('open')) {
              hideOpenWaitLoader();
            }
          } catch (_) {}
        });
        observer.observe(methodModal, { attributes: true, attributeFilter: ['class'] });
      } catch (_) {}
      methodModal.addEventListener('click', function (event) {
        try {
          if (event && event.target === methodModal) hideOpenWaitLoader();
        } catch (_) {}
      });
    }

    window.addEventListener('hashchange', hideOpenWaitLoaderOnHashChange);
  }

  const DEPOSIT_RECOVERY_WORKER_DEFAULT = (function(){
    try {
      if (window.__getSiteWorkerBaseDefault) {
        return window.__getSiteWorkerBaseDefault({ trailingSlash: false });
      }
    } catch(_) {}
    try { return String(location.origin || '').replace(/\/+$/, ''); } catch(_) {}
    return '';
  })();
  function recoveryFlowScope(flow) {
    return 'deposit';
  }
  function recoveryUnifiedCacheKey(flow) {
    return 'edaa:' + recoveryFlowScope(flow);
  }
  function readRecoveryFlowCache(flow) {
    const scope = recoveryFlowScope(flow);
    const key = recoveryUnifiedCacheKey(flow);
    let parsed = null;
    try {
      const raw = localStorage.getItem(key);
      if (raw) parsed = JSON.parse(raw);
    } catch (_) { parsed = null; }
    if (!parsed || typeof parsed !== 'object') parsed = {};
    const parsedScope = String(parsed.flowScope || '').trim().toLowerCase();
    if (parsedScope && parsedScope !== scope) parsed = {};
    if (!Array.isArray(parsed.countries)) parsed.countries = [];
    if (!parsed.methodsMapByCountry || typeof parsed.methodsMapByCountry !== 'object') {
      parsed.methodsMapByCountry = {};
    }
    parsed.flowScope = scope;
    return { key, cache: parsed };
  }
  function writeRecoveryFlowCache(flow, cache) {
    const { key } = readRecoveryFlowCache(flow);
    const next = (cache && typeof cache === 'object') ? { ...cache } : {};
    next.flowScope = recoveryFlowScope(flow);
    if (!Array.isArray(next.countries)) next.countries = [];
    if (!next.methodsMapByCountry || typeof next.methodsMapByCountry !== 'object') {
      next.methodsMapByCountry = {};
    }
    if (!Number.isFinite(Number(next.savedAt))) next.savedAt = Date.now();
    try { localStorage.setItem(key, JSON.stringify(next)); } catch (_) {}
    return next;
  }
  function normalizeWorkerBase(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (/^https?:\/\//i.test(raw)) return raw.replace(/\/+$/, '');
    return ('https://' + raw).replace(/\/+$/, '');
  }
  function getPreferredUnifiedWorkerBase() {
    try {
      if (window.__getSiteWorkerBase) {
        const liveBase = normalizeWorkerBase(window.__getSiteWorkerBase({
          trailingSlash: false,
          allowStorageOverride: false
        }));
        if (liveBase && !isUnsafeLocalInlineBase(liveBase)) return liveBase;
      }
    } catch (_) {}
    try {
      if (window.__getSiteWorkerBaseDefault) {
        const defaultBase = normalizeWorkerBase(window.__getSiteWorkerBaseDefault({ trailingSlash: false }));
        if (defaultBase && !isUnsafeLocalInlineBase(defaultBase)) return defaultBase;
      }
    } catch (_) {}
    try {
      const cfg = window.__getSiteWorkersConfig ? window.__getSiteWorkersConfig() : {};
      const runtimeRouterBase = normalizeWorkerBase(cfg && cfg.routerBase);
      if (runtimeRouterBase && !isUnsafeLocalInlineBase(runtimeRouterBase)) return runtimeRouterBase;
    } catch (_) {}
    return '';
  }
  function getRecoveryWorkerBase() {
    const unifiedBase = getPreferredUnifiedWorkerBase();
    if (unifiedBase) return unifiedBase;
    return '';
  }
  function resolveInlineDepositWorkerBase(templateBase) {
    const recoveryBase = getRecoveryWorkerBase();
    if (recoveryBase) return recoveryBase;
    return '';
  }
  try { window.__resolveInlineDepositWorkerBase = resolveInlineDepositWorkerBase; } catch (_) {}
  function isLikelyDepositCountryId(rawId) {
    const id = String(rawId || '').trim();
    if (!id) return false;
    if (!/^[A-Z0-9]{2,12}$/.test(id)) return false;
    if (!/[A-Z]/.test(id)) return false;
    const blocked = new Set([
      'games','game','subscriptions',
      'deposit','edaa','login','settings','security','orders','dafaati','reviews','transfer','wallet',
      'payments','payment','internet','numbers','applications','cards','vip','accounts','codes','vpn'
    ]);
    if (blocked.has(id.toLowerCase())) return false;
    return true;
  }
  function normalizeCountriesList(raw) {
    if (!Array.isArray(raw)) return [];
    return raw
      .map(function (entry) {
        const id = String((entry && entry.id) || '').trim();
        const data = entry && typeof entry.data === 'object' && entry.data ? entry.data : {};
        if (!isLikelyDepositCountryId(id) || data.active === false) return null;
        return { id: id, data: data };
      })
      .filter(Boolean);
  }
  function isLikelyDepositCountryEntry(entry) {
    const id = String((entry && entry.id) || '').trim();
    const data = entry && typeof entry.data === 'object' && entry.data ? entry.data : null;
    if (!isLikelyDepositCountryId(id) || !data) return false;
    if (Object.prototype.hasOwnProperty.call(data, 'methodsMap')) return true;
    if (Array.isArray(data.methods)) return true;
    return false;
  }
  function isLikelyDepositCountriesPayload(raw) {
    if (!Array.isArray(raw) || !raw.length) return false;
    return raw.some(isLikelyDepositCountryEntry);
  }
  function extractRecoveryCountriesFromPayload(payload, flow) {
    const data = (payload && typeof payload === 'object') ? payload : null;
    if (!data) return null;
    const scopedFlow = recoveryFlowScope(flow || getInlineFlowFromHash());
    const scopedList = Array.isArray(data[scopedFlow]) ? data[scopedFlow] : null;
    if (scopedList) return scopedList;
    const legacyList = Array.isArray(data.countries) ? data.countries : null;
    if (legacyList) return legacyList;
    return null;
  }
  function normalizeMethodsMap(raw) {
    const map = {};
    if (!raw || typeof raw !== 'object') return map;
    Object.keys(raw).forEach(function (methodId) {
      const cleanId = String(methodId || '').trim();
      if (!cleanId) return;
      const value = raw[methodId];
      map[cleanId] = (value && typeof value === 'object') ? value : {};
    });
    return map;
  }
  function saveRecoveryCountriesCache(responsePayload, normalizedCountries, base, source, flow) {
    try {
      const now = Date.now();
      const scopedFlow = recoveryFlowScope(flow || getInlineFlowFromHash());
      const rawPayload = (responsePayload && typeof responsePayload === 'object') ? responsePayload : {};
      if (!Array.isArray(rawPayload.countries)) rawPayload.countries = [];
      rawPayload.flowScope = scopedFlow;
      const { key, cache } = readRecoveryFlowCache(scopedFlow);
      cache.savedAt = now;
      cache.base = String(base || '');
      cache.source = String(rawPayload.source || source || 'deposit-inline-recovery');
      cache.countries = Array.isArray(normalizedCountries) ? normalizedCountries : [];
      cache.rawResponse = rawPayload;
      writeRecoveryFlowCache(scopedFlow, cache);
      try {
        depositInlineLog('info', '[deposit-inline][cache] countries saved', {
          key: key,
          source: cache.source,
          count: cache.countries.length
        });
      } catch (_) {}
    } catch (err) {
      try {
        depositInlineLog('warn', '[deposit-inline][cache] countries save failed', err);
      } catch (_) {}
    }
  }
  function saveRecoveryMethodsCache(list, source, flow) {
    try {
      const scopedFlow = recoveryFlowScope(flow || getInlineFlowFromHash());
      const countriesMap = {};
      (Array.isArray(list) ? list : []).forEach(function (country) {
        const countryId = String(country && country.id || '').trim().toUpperCase();
        const data = (country && typeof country.data === 'object' && country.data) ? country.data : {};
        if (!countryId) return;
        let methodsMap = normalizeMethodsMap(data.methodsMap);
        if (!Object.keys(methodsMap).length && Array.isArray(data.methods)) {
          data.methods.forEach(function (entry) {
            const methodId = String(entry && (entry.id || entry.methodId) || '').trim();
            if (!methodId) return;
            const methodData = (entry && typeof entry.data === 'object' && entry.data) ? entry.data : entry;
            methodsMap[methodId] = (methodData && typeof methodData === 'object') ? methodData : {};
          });
        }
        if (!Object.keys(methodsMap).length) return;
        countriesMap[countryId] = methodsMap;
      });
      const { key, cache } = readRecoveryFlowCache(scopedFlow);
      cache.savedAt = Date.now();
      cache.source = String(source || 'deposit-inline-recovery');
      cache.methodsMapByCountry = countriesMap;
      writeRecoveryFlowCache(scopedFlow, cache);
      try {
        depositInlineLog('info', '[deposit-inline][cache] methods saved', {
          key: key,
          countriesCount: Object.keys(countriesMap).length
        });
      } catch (_) {}
    } catch (err) {
      try {
        depositInlineLog('warn', '[deposit-inline][cache] methods save failed', err);
      } catch (_) {}
    }
  }
  function renderFallbackCountries(app, list) {
    if (!app || !app.querySelector) return;
    const grid = app.querySelector('#grid');
    const noResults = app.querySelector('#noResults');
    if (!grid) return;
    try { grid.removeAttribute('data-flow-loading'); } catch (_) {}
    if (noResults && noResults.dataset && noResults.dataset.originalText) {
      try { noResults.textContent = noResults.dataset.originalText; } catch (_) {}
    }
    const flowPrefix = getInlineFlowPath(getInlineFlowFromHash());
    grid.innerHTML = '';
    const countries = Array.isArray(list) ? list : [];
    countries.forEach(function (country) {
      const title = String((country.data && country.data.name) || '');
      const imageUrl = sanitizeInlineMediaUrl((country.data && country.data.imageUrl) || '');
      const a = document.createElement('a');
      a.href = '#/' + flowPrefix + '/' + encodeURIComponent(String(country.id || '').trim());
      a.className = 'card';
      a.dataset.countryId = String(country.id || '').trim();
      a.dataset.title = title;
      a.setAttribute('role', 'button');
      a.setAttribute('tabindex', '0');
      if (imageUrl) {
        const img = document.createElement('img');
        img.alt = title;
        img.loading = 'lazy';
        img.decoding = 'async';
        try { img.fetchPriority = 'low'; } catch (_) {}
        try {
          if (!(typeof window.__registerCatalogCardMediaImage === 'function' && window.__registerCatalogCardMediaImage(img, imageUrl, {
            loading: 'lazy',
            fetchPriority: 'low'
          }))) {
            img.src = imageUrl;
          }
        } catch (_) {
          img.src = imageUrl;
        }
        a.appendChild(img);
      }
      const heading = document.createElement('h2');
      heading.textContent = title;
      a.appendChild(heading);
      a.addEventListener('click', function () {
        try {
          const nextFlowPrefix = getInlineFlowPath(getInlineFlowFromHash());
          const safeId = encodeURIComponent(String(country.id || '').trim());
          if (safeId) location.hash = '#/' + nextFlowPrefix + '/' + safeId;
        } catch (_) {}
      });
      grid.appendChild(a);
    });
    if (noResults) noResults.style.display = (countries.length || isDepositInlineCountriesLoading()) ? 'none' : 'block';
  }
  function setFlowSwitchLoadingUi(app, flow) {
    if (!app || !app.querySelector) return;
    const flowPath = getInlineFlowPath(flow);
    try { window.__depositInlineActiveFlow = normalizeInlineFlow(flowPath); } catch (_) {}
    const grid = app.querySelector('#grid');
    const noResults = app.querySelector('#noResults');
    const backBtn = app.querySelector('#backBtn');
    const methodModal = app.querySelector('#methodModal');
    if (grid) {
      try { grid.innerHTML = ''; } catch (_) {}
      try { grid.setAttribute('data-flow-loading', flowPath); } catch (_) {}
    }
    if (noResults) {
      if (noResults.dataset && !noResults.dataset.originalText) {
        try { noResults.dataset.originalText = String(noResults.textContent || '').trim(); } catch (_) {}
      }
      try { noResults.style.display = 'none'; } catch (_) {}
    }
    if (backBtn) {
      try { backBtn.style.display = 'none'; } catch (_) {}
    }
    if (methodModal) {
      try { methodModal.classList.remove('open'); } catch (_) {}
    }
    try { app.style.visibility = 'hidden'; } catch (_) {}
    try {
      const container = app.parentNode;
      if (container && container.id === 'depositInlineContainer') {
        container.style.visibility = 'hidden';
      }
    } catch (_) {}
    setInlinePreloaderVisible(app, true);
  }
  function restoreFlowSwitchUiHints(app) {
    if (!app || !app.querySelector) return;
    const grid = app.querySelector('#grid');
    const noResults = app.querySelector('#noResults');
    const main = app.querySelector('main');
    const toolbar = app.querySelector('.toolbar');
    const searchBox = app.querySelector('.search-container');
    if (grid) {
      try { grid.removeAttribute('data-flow-loading'); } catch (_) {}
      try { grid.hidden = false; } catch (_) {}
      try { grid.style.removeProperty('display'); } catch (_) {}
      try { grid.style.removeProperty('opacity'); } catch (_) {}
      try { grid.style.removeProperty('visibility'); } catch (_) {}
      try { grid.style.removeProperty('pointer-events'); } catch (_) {}
    }
    if (noResults && noResults.dataset && noResults.dataset.originalText) {
      try { noResults.textContent = noResults.dataset.originalText; } catch (_) {}
    }
    if (noResults) {
      try { noResults.hidden = false; } catch (_) {}
      try { noResults.style.removeProperty('visibility'); } catch (_) {}
      try { noResults.style.removeProperty('opacity'); } catch (_) {}
    }
    if (main) {
      try { main.hidden = false; } catch (_) {}
      try { main.style.removeProperty('display'); } catch (_) {}
      try { main.style.removeProperty('opacity'); } catch (_) {}
      try { main.style.removeProperty('visibility'); } catch (_) {}
      try { main.style.removeProperty('pointer-events'); } catch (_) {}
    }
    if (toolbar) {
      try { toolbar.hidden = false; } catch (_) {}
      try { toolbar.style.removeProperty('display'); } catch (_) {}
      try { toolbar.style.removeProperty('opacity'); } catch (_) {}
      try { toolbar.style.removeProperty('visibility'); } catch (_) {}
    }
    if (searchBox) {
      try { searchBox.hidden = false; } catch (_) {}
      try { searchBox.style.removeProperty('display'); } catch (_) {}
      try { searchBox.style.removeProperty('opacity'); } catch (_) {}
      try { searchBox.style.removeProperty('visibility'); } catch (_) {}
    }
    try { app.hidden = false; } catch (_) {}
    try { app.style.removeProperty('display'); } catch (_) {}
    try { app.style.removeProperty('opacity'); } catch (_) {}
    try { app.style.visibility = ''; } catch (_) {}
    try { app.style.removeProperty('pointer-events'); } catch (_) {}
    try {
      const container = app.parentNode;
      if (container && container.id === 'depositInlineContainer') {
        try { container.hidden = false; } catch (_) {}
        try { container.style.removeProperty('display'); } catch (_) {}
        try { container.style.removeProperty('opacity'); } catch (_) {}
        container.style.visibility = '';
        try { container.style.removeProperty('pointer-events'); } catch (_) {}
      }
    } catch (_) {}
    setInlinePreloaderVisible(app, false);
  }
  async function retryCountriesViaRecovery(app, reason) {
    const base = getRecoveryWorkerBase();
    const flowNow = getInlineFlowFromHash();
    const flowPath = getInlineFlowPath(flowNow);
    const scopedFlow = recoveryFlowScope(flowNow);
    if (!base) {
      throw new Error('recovery_worker_base_missing');
    }
    const inflight = state.recoveryPromiseByFlow && state.recoveryPromiseByFlow[scopedFlow];
    if (inflight) {
      try {
        depositInlineLog('info', '[deposit-inline][recovery] using in-flight request', {
          reason: reason || '',
          flow: scopedFlow
        });
      } catch (_) {}
      return await inflight;
    }
    const task = (async function () {
    const urls = [
      base + '/' + flowPath + '/countries'
    ];
    let lastError = null;
    let selectedUrl = '';
    let selectedPayload = null;
    let selectedRawCountries = null;
    let list = [];
    for (let i = 0; i < urls.length; i += 1) {
      const url = urls[i];
      selectedUrl = url;
      try {
        depositInlineLog('info', '[deposit-inline][recovery] retry via recovery path', {
          reason: reason || '',
          flow: scopedFlow,
          url: url
        });
      } catch (_) {}
      try {
        const controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
        const timer = controller ? setTimeout(function(){
          try { controller.abort(); } catch (_) {}
        }, 12000) : null;
        const res = await fetch(url, {
          method: 'GET',
          signal: controller ? controller.signal : undefined
        }).finally(function(){
          if (timer) clearTimeout(timer);
        });
        const data = await res.json().catch(function () { return {}; });
        if (!res.ok || data.success !== true) {
          throw new Error((data && data.error) ? data.error : ('recovery_failed_status_' + res.status));
        }
        const declaredFlowRaw = String((data && data.flow) || '').trim();
        const declaredFlow = declaredFlowRaw ? normalizeInlineFlow(declaredFlowRaw) : '';
        if (declaredFlow && declaredFlow !== scopedFlow && !Array.isArray(data.countries)) {
          throw new Error('recovery_wrong_flow_' + declaredFlow);
        }
        const rawCountries = extractRecoveryCountriesFromPayload(data, scopedFlow);
        if (!Array.isArray(rawCountries)) {
          throw new Error('recovery_wrong_payload');
        }
        if (rawCountries.length && !isLikelyDepositCountriesPayload(rawCountries)) {
          throw new Error('recovery_wrong_payload');
        }
        list = normalizeCountriesList(rawCountries);
        selectedPayload = data;
        selectedRawCountries = rawCountries;
        lastError = null;
        break;
      } catch (err) {
        if (err && err.name === 'AbortError') {
          err = new Error('recovery_countries_timeout');
        }
        lastError = err;
        try {
          depositInlineLog('warn', '[deposit-inline][recovery] endpoint attempt failed', {
            flow: scopedFlow,
            url: url,
            error: err && err.message ? err.message : String(err || '')
          });
        } catch (_) {}
      }
    }
    if (lastError) throw lastError;
    const payloadForCache = (selectedPayload && typeof selectedPayload === 'object')
      ? { ...selectedPayload }
      : {};
    payloadForCache.flow = scopedFlow;
    payloadForCache[scopedFlow] = Array.isArray(selectedRawCountries) ? selectedRawCountries : [];
    payloadForCache.countries = Array.isArray(selectedRawCountries) ? selectedRawCountries : [];
    saveRecoveryCountriesCache(payloadForCache, list, base, 'deposit-inline-recovery', flowNow);
    saveRecoveryMethodsCache(list, 'deposit-inline-recovery', flowNow);
    renderFallbackCountries(app, list);
    try {
      const btn = app && app.querySelector ? app.querySelector('#countriesRetryBtn') : null;
      if (btn) btn.style.display = list.length ? 'none' : 'inline-flex';
    } catch (_) {}
    try {
      depositInlineLog('info', '[deposit-inline][recovery] countries rendered', {
        count: list.length,
        flow: scopedFlow,
        url: selectedUrl
      });
    } catch (_) {}
    return list.length > 0;
    })();
    if (!state.recoveryPromiseByFlow || typeof state.recoveryPromiseByFlow !== 'object') {
      state.recoveryPromiseByFlow = { deposit: null, withdraw: null };
    }
    state.recoveryPromiseByFlow[scopedFlow] = task;
    try {
      return await task;
    } finally {
      if (state.recoveryPromiseByFlow[scopedFlow] === task) {
        state.recoveryPromiseByFlow[scopedFlow] = null;
      }
    }
  }

  function ensureFallbackCountriesRetryButton(app) {
    if (!app || !app.querySelector) return;
    try {
      const btn = app.querySelector('#countriesRetryBtn');
      if (btn && btn.parentNode) btn.parentNode.removeChild(btn);
    } catch (_) {}
    try {
      const wrap = app.querySelector('.countries-retry-wrap');
      if (wrap && wrap.parentNode) wrap.parentNode.removeChild(wrap);
    } catch (_) {}
  }

  function buildWrappedInlineDepositScript(scriptText) {
    return (
      '(function(){' +
      'var scopedDoc = window.__DEPOSIT_INLINE_DOC__ || document;' +
      '(function(document, window){' +
      String(scriptText || '') +
      '\n})(scopedDoc, window);' +
      '})();\n//# sourceURL=deposit-inline-runtime.js'
    );
  }

  function shouldFallbackInlineScript(err) {
    const message = String((err && err.message) || err || '').toLowerCase();
    return (
      message.includes('unsafe-eval') ||
      message.includes('content security policy') ||
      message.includes('trustedscript') ||
      message.includes('trusted types') ||
      message.includes('refused to evaluate')
    );
  }

  function runInlineDepositScript(root, scriptText) {
    const scopedDoc = createScopedDocument(root);
    try {
      const fn = new Function('document', 'window', scriptText);
      fn(scopedDoc, window);
      return Promise.resolve('function');
    } catch (primaryErr) {
      if (!shouldFallbackInlineScript(primaryErr)) {
        return Promise.reject(primaryErr);
      }
      const mountNode = root || document.body || document.documentElement;
      const wrappedScript = buildWrappedInlineDepositScript(scriptText);
      function cleanupScriptNode(scriptEl, blobUrl) {
        try {
          if (scriptEl && scriptEl.parentNode) scriptEl.parentNode.removeChild(scriptEl);
        } catch (_) {}
        try {
          if (blobUrl && window.URL && typeof window.URL.revokeObjectURL === 'function') {
            window.URL.revokeObjectURL(blobUrl);
          }
        } catch (_) {}
        try { delete window.__DEPOSIT_INLINE_DOC__; } catch (_) { window.__DEPOSIT_INLINE_DOC__ = undefined; }
      }
      function runInlineTagFallback(previousErr) {
        let scriptEl = null;
        try {
          window.__DEPOSIT_INLINE_DOC__ = scopedDoc;
          scriptEl = document.createElement('script');
          scriptEl.textContent = wrappedScript;
          mountNode.appendChild(scriptEl);
          cleanupScriptNode(scriptEl, '');
          return 'script-tag';
        } catch (fallbackErr) {
          cleanupScriptNode(scriptEl, '');
          try { fallbackErr.__primary = primaryErr; } catch (_) {}
          try { fallbackErr.__blob = previousErr; } catch (_) {}
          throw fallbackErr;
        }
      }
      return new Promise(function (resolve, reject) {
        let scriptEl = null;
        let blobUrl = '';
        try {
          if (!(window.URL && typeof window.URL.createObjectURL === 'function' && typeof Blob === 'function')) {
            resolve(runInlineTagFallback(null));
            state.refs.list.innerHTML = '<div class="levels-empty">لا توجد مستويات مرئية متاحة للعرض الآن.</div>';
            return;
          }
          window.__DEPOSIT_INLINE_DOC__ = scopedDoc;
          scriptEl = document.createElement('script');
          scriptEl.async = false;
          scriptEl.onload = function () {
            cleanupScriptNode(scriptEl, blobUrl);
            resolve('blob-script');
          };
          scriptEl.onerror = function () {
            cleanupScriptNode(scriptEl, blobUrl);
            try {
              resolve(runInlineTagFallback(new Error('blob_script_load_failed')));
            } catch (inlineErr) {
              reject(inlineErr);
            }
          };
          blobUrl = window.URL.createObjectURL(new Blob([wrappedScript], { type: 'text/javascript' }));
          scriptEl.src = blobUrl;
          mountNode.appendChild(scriptEl);
        } catch (blobErr) {
          cleanupScriptNode(scriptEl, blobUrl);
          try {
            resolve(runInlineTagFallback(blobErr));
          } catch (inlineErr) {
            try { inlineErr.__primary = primaryErr; } catch (_) {}
            reject(inlineErr);
          }
        }
      });
    }
  }

  function buildInlineDepositWorkerBlock(templateWorkerBase) {
    const fallbackBase = normalizeWorkerBase(getRecoveryWorkerBase());
    const fallbackLiteral = JSON.stringify(fallbackBase || '');
    return [
      "const WORKER_DEFAULT = (function(){",
      "  try {",
      "    if (typeof window !== 'undefined' && window.__getSiteWorkerBaseDefault) {",
      "      const base = window.__getSiteWorkerBaseDefault({ trailingSlash: false });",
      "      if (base) return String(base).replace(/\\/+$/, '');",
      "    }",
      "  } catch (_) {}",
      "  return " + fallbackLiteral + ";",
      "})();",
      "function normalizeWorkerBase(value){",
      "  try {",
      "    if (typeof window !== 'undefined' && window.__normalizeSiteWorkerBase) {",
      "      return window.__normalizeSiteWorkerBase(value) || '';",
      "    }",
      "  } catch (_) {}",
      "  const raw = String(value || '').trim();",
      "  if (!raw) return '';",
      "  if (/^https?:\\/\\//i.test(raw)) return raw.replace(/\\/+$/, '');",
      "  return ('https://' + raw).replace(/\\/+$/, '');",
      "}",
      "const WORKER_BASE = (function(){",
      "  try {",
      "    if (typeof window !== 'undefined' && window.__getSiteWorkerBase) {",
      "      const base = window.__getSiteWorkerBase({ trailingSlash: false, allowStorageOverride: false });",
      "      if (base) return String(base).replace(/\\/+$/, '');",
      "    }",
      "  } catch (_) {}",
      "  return WORKER_DEFAULT;",
      "})();",
      "const WORKER = normalizeWorkerBase(WORKER_BASE) || WORKER_DEFAULT;"
    ].join('\n');
  }

  function buildInlineDepositFirebaseBlock() {
    return [
      "const depositFirebaseConfig = ((typeof window !== 'undefined' && window.__getSiteFirebaseConfig) ? window.__getSiteFirebaseConfig() : (window.__FIREBASE_CONFIG__ || null));",
      "let depositAuth = null;",
      "let depositDb = null;",
      "try {",
      "  if (typeof window !== 'undefined') {",
      "    try { window.__SKIP_FIREBASE__ = !depositFirebaseConfig; } catch (_) {}",
      "  }",
      "  if (typeof firebase !== 'undefined' && firebase && depositFirebaseConfig) {",
      "    let depositApp = null;",
      "    try { depositApp = firebase.app ? firebase.app() : null; } catch (_) {}",
      "    if (!depositApp) firebase.initializeApp(depositFirebaseConfig);",
      "    depositAuth = firebase.auth ? firebase.auth() : null;",
      "    depositDb = firebase.firestore ? firebase.firestore() : null;",
      "  } else if (typeof firebase !== 'undefined' && firebase) {",
      "    void 0;",
      "  } else {",
      "    void 0;",
      "  }",
      "} catch (firebaseInitError) {",
      "  void 0;",
      "  depositAuth = null;",
      "  depositDb = null;",
      "}"
    ].join('\n');
  }

  function buildInlineDepositEnhancementBlock() {
    return `
(function(){
  let directRootMethods = [];
  let inlineCountriesRefreshPromiseByFlow = { deposit: null };
  let lastInlineCountriesRefreshAtByFlow = { deposit: 0 };
  const INLINE_COUNTRIES_REFRESH_DEDUPE_MS = 5000;
  const INLINE_COUNTRIES_REQUEST_TIMEOUT_MS = 12000;
  const INLINE_EXTRA_FIELDS_STYLE_ID = 'deposit-inline-extra-fields-style';
  const INLINE_EXTRA_FIELDS_MOUNT_ID = 'inlineMethodExtraFields';
  const inlineExtraFieldDrafts = Object.create(null);
  const INLINE_CLIENT_NOTE_BLOCKLIST = [
    'مراجعة الطلبات يدوية وقد تستغرق من دقيقة إلى ساعتين في أوقات العمل.',
    'مراجعة الطلبات يدوية وقد تستغرق من دقيقة إلى ساعتين في اوقات العمل.'
  ];
  let inlineDepositAuthWaitPromise = null;

  function setInlineCountriesGlobalLoading(active){
    try {
      if (typeof window !== 'undefined' && window && typeof window.__setDepositInlineCountriesLoading === 'function') {
        window.__setDepositInlineCountriesLoading(active === true);
        return;
      }
    } catch (_) {}
    try {
      if (typeof window !== 'undefined' && window) {
        window.__DEPOSIT_INLINE_COUNTRIES_LOADING__ = active === true;
      }
    } catch (_) {}
    try {
      if (document.documentElement) document.documentElement.classList.toggle('deposit-inline-loading', active === true);
      if (document.body) document.body.classList.toggle('deposit-inline-loading', active === true);
      const app = document.getElementById('depositInlineApp');
      if (app && app.classList) app.classList.toggle('deposit-inline-loading', active === true);
    } catch (_) {}
  }

  function isInlineDepositEmptyStateLoading(){
    try {
      if (window.__DEPOSIT_INLINE_COUNTRIES_LOADING__ === true || window.__INLINE_WALLET_ROUTE_PENDING__ === true) return true;
    } catch (_) {}
    try {
      if (document.documentElement && (
        document.documentElement.classList.contains('deposit-inline-loading') ||
        document.documentElement.classList.contains('deposit-countries-loader-pending') ||
        document.documentElement.classList.contains('inline-wallet-route-pending')
      )) return true;
      if (document.body && (
        document.body.classList.contains('deposit-inline-loading') ||
        document.body.classList.contains('deposit-countries-loader-pending') ||
        document.body.classList.contains('inline-wallet-route-pending')
      )) return true;
    } catch (_) {}
    try {
      const app = document.getElementById('depositInlineApp');
      if (app && app.classList && app.classList.contains('deposit-inline-loading')) return true;
    } catch (_) {}
    return false;
  }

  function setInlineDepositNoResultsVisible(visible){
    const showEmpty = visible === true && !isInlineDepositEmptyStateLoading();
    try { showNoResults(showEmpty); } catch (_) {}
    try {
      const noResults = document.querySelector('#depositInlineApp #noResults') || document.getElementById('noResults');
      if (noResults) {
        noResults.style.display = showEmpty ? 'block' : 'none';
        if (showEmpty) noResults.removeAttribute('aria-hidden');
        else noResults.setAttribute('aria-hidden', 'true');
      }
    } catch (_) {}
    return showEmpty;
  }

  function getInlineDepositAuthInstance(){
    try {
      if (typeof depositAuth !== 'undefined' && depositAuth) return depositAuth;
    } catch (_) {}
    try {
      if (typeof firebase !== 'undefined' && firebase && typeof firebase.auth === 'function') {
        const authInst = firebase.auth();
        try {
          if (typeof depositAuth !== 'undefined' && !depositAuth) depositAuth = authInst;
        } catch (_) {}
        return authInst;
      }
    } catch (_) {}
    return null;
  }

  function waitForInlineDepositUser(timeoutMs){
    const authInst = getInlineDepositAuthInstance();
    if (!authInst || typeof authInst.onAuthStateChanged !== 'function') {
      try { return Promise.resolve(authInst && authInst.currentUser ? authInst.currentUser : null); } catch (_) {}
      return Promise.resolve(null);
    }
    try {
      if (authInst.currentUser) return Promise.resolve(authInst.currentUser);
    } catch (_) {}
    if (inlineDepositAuthWaitPromise) return inlineDepositAuthWaitPromise;
    inlineDepositAuthWaitPromise = new Promise(function(resolve){
      let done = false;
      let timer = null;
      let unsubscribe = null;
      const finish = function(user){
        if (done) return;
        done = true;
        try { if (timer) clearTimeout(timer); } catch (_) {}
        try { if (unsubscribe) unsubscribe(); } catch (_) {}
        inlineDepositAuthWaitPromise = null;
        resolve(user || null);
      };
      try {
        unsubscribe = authInst.onAuthStateChanged(function(user){
          finish(user || null);
        }, function(){
          finish(null);
        });
      } catch (_) {
        finish(null);
        return;
      }
      timer = setTimeout(function(){
        let current = null;
        try { current = authInst.currentUser || null; } catch (_) {}
        finish(current);
      }, Math.max(300, Number(timeoutMs) || 2500));
    });
    return inlineDepositAuthWaitPromise;
  }

  function getInlineDepositSearchInput(){
    try {
      if (typeof searchInput !== 'undefined' && searchInput) return searchInput;
    } catch (_) {}
    try {
      return document.querySelector('#depositInlineApp #depositSearchInput');
    } catch (_) {
      return null;
    }
  }

  function prepareInlineDepositSearchInput(){
    const input = getInlineDepositSearchInput();
    if (!input) return null;
    try { input.setAttribute('autocomplete', 'off'); } catch (_) {}
    try { input.setAttribute('autocorrect', 'off'); } catch (_) {}
    try { input.setAttribute('autocapitalize', 'off'); } catch (_) {}
    try { input.setAttribute('spellcheck', 'false'); } catch (_) {}
    try { input.setAttribute('data-lpignore', 'true'); } catch (_) {}
    try {
      if (input.dataset && input.dataset.inlineSearchBound !== '1') {
        input.dataset.inlineSearchBound = '1';
        input.addEventListener('input', function(){
          try { input.dataset.inlineSearchUserEdited = '1'; } catch (_) {}
        }, true);
      }
    } catch (_) {}
    return input;
  }

  function resetInlineDepositSearchInput(reason, force){
    const input = prepareInlineDepositSearchInput();
    if (!input) return false;
    let userEdited = false;
    try { userEdited = input.dataset && input.dataset.inlineSearchUserEdited === '1'; } catch (_) {}
    if (!force && userEdited) return false;
    if (!String(input.value || '').trim()) return false;
    try { input.value = ''; } catch (_) {}
    try { input.defaultValue = ''; } catch (_) {}
    try {
      if (input.dataset) {
        input.dataset.inlineSearchUserEdited = '';
        input.dataset.inlineSearchResetReason = String(reason || '').slice(0, 80);
      }
    } catch (_) {}
    return true;
  }

  function readInlinePostLoginPayload(){
    try {
      if (typeof readPostLoginPayload === 'function') {
        const payload = readPostLoginPayload();
        if (payload && typeof payload === 'object') return payload;
      }
    } catch (_) {}
    try {
      if (window && window.__POST_LOGIN_PAYLOAD__ && typeof window.__POST_LOGIN_PAYLOAD__ === 'object') {
        return window.__POST_LOGIN_PAYLOAD__;
      }
    } catch (_) {}
    try {
      const raw = localStorage.getItem('postLoginPayload');
      const payload = raw ? JSON.parse(raw) : null;
      return payload && typeof payload === 'object' ? payload : null;
    } catch (_) {
      return null;
    }
  }

  function decodeInlineJwtPayload(token){
    try {
      const parts = String(token || '').split('.');
      if (parts.length < 2) return null;
      let encoded = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const pad = encoded.length % 4;
      if (pad) encoded += '='.repeat(4 - pad);
      const json = atob(encoded);
      return json ? JSON.parse(json) : null;
    } catch (_) {
      return null;
    }
  }

  function isInlineJwtUsable(token, leewaySec){
    const raw = String(token || '').trim();
    if (!raw) return false;
    try {
      if (typeof isJwtUsable === 'function') return !!isJwtUsable(raw, leewaySec || 30);
    } catch (_) {}
    const payload = decodeInlineJwtPayload(raw);
    if (!payload || !payload.exp) return true;
    const expMs = Number(payload.exp) * 1000;
    if (!Number.isFinite(expMs)) return true;
    return expMs - Date.now() > (Number(leewaySec) || 30) * 1000;
  }

  function getUsableInlineStoredIdToken(){
    const payload = readInlinePostLoginPayload();
    const idToken = String((payload && (payload.idToken || payload.token)) || '').trim();
    return isInlineJwtUsable(idToken, 30) ? idToken : '';
  }

  async function getInlineDepositNonForcedIdToken(user){
    const storedToken = getUsableInlineStoredIdToken();
    if (storedToken) return storedToken;
    if (!user || typeof user.getIdToken !== 'function') return '';
    try {
      return String(await user.getIdToken(false) || '').trim();
    } catch (_) {
      return '';
    }
  }

  function clearInlineStoredCustomTokenIfMatches(token){
    const tokenText = String(token || '').trim();
    if (!tokenText) return;
    try {
      const payload = readInlinePostLoginPayload() || {};
      const stored = String(payload.customToken || payload.custom_token || '').trim();
      if (stored !== tokenText) return;
      const nextPayload = Object.assign({}, payload);
      delete nextPayload.customToken;
      delete nextPayload.custom_token;
      if (typeof writePostLoginPayload === 'function') {
        writePostLoginPayload(nextPayload);
      } else {
        localStorage.setItem('postLoginPayload', JSON.stringify(Object.assign({}, nextPayload, { ts: Date.now() })));
        try { window.__POST_LOGIN_PAYLOAD__ = Object.assign({}, nextPayload, { ts: Date.now() }); } catch (_) {}
      }
    } catch (_) {}
  }

  function isInlineStoredCustomTokenFreshEnough(token, maxAgeMs){
    const tokenText = String(token || '').trim();
    if (!tokenText) return false;
    try {
      const payload = readInlinePostLoginPayload() || {};
      const stored = String(payload.customToken || payload.custom_token || '').trim();
      if (stored !== tokenText) return true;
      const ts = Number(payload.ts || payload.savedAt || payload.updatedAt || 0);
      if (!Number.isFinite(ts) || ts <= 0) return false;
      return (Date.now() - ts) <= Math.max(30000, Number(maxAgeMs) || (5 * 60 * 1000));
    } catch (_) {
      return false;
    }
  }

  async function signInInlineDepositWithStoredCustomToken(){
    const authInst = getInlineDepositAuthInstance();
    if (!authInst || typeof authInst.signInWithCustomToken !== 'function') return null;
    const payload = readInlinePostLoginPayload();
    const customToken = String((payload && (payload.customToken || payload.custom_token)) || '').trim();
    if (!customToken) return null;
    if (!isInlineStoredCustomTokenFreshEnough(customToken, 5 * 60 * 1000)) {
      clearInlineStoredCustomTokenIfMatches(customToken);
      return null;
    }
    if (!isInlineJwtUsable(customToken, 30)) {
      clearInlineStoredCustomTokenIfMatches(customToken);
      return null;
    }
    try {
      await authInst.signInWithCustomToken(customToken);
      return authInst.currentUser || null;
    } catch (_) {
      clearInlineStoredCustomTokenIfMatches(customToken);
      return null;
    }
  }

  async function resolveInlineDepositUserForSubmit(){
    let user = await waitForInlineDepositUser(1200);
    if (user) return user;
    try {
      if (window && typeof window.__ensureAuthReady === 'function') {
        const restored = await window.__ensureAuthReady();
        if (restored) return restored;
      }
    } catch (_) {}
    user = await waitForInlineDepositUser(1800);
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
    user = await signInInlineDepositWithStoredCustomToken();
    if (user) return user;
    return await waitForInlineDepositUser(1200);
  }

  function installInlineDepositAuthRecovery(){
    try {
      if (typeof getIdTokenOrThrow !== 'function' || getIdTokenOrThrow.__inlineAuthRecovery) return;
      const recoveredGetIdTokenOrThrow = async function(){
        let user = await resolveInlineDepositUserForSubmit();
        const initialStoredToken = getUsableInlineStoredIdToken();
        if (initialStoredToken) return initialStoredToken;
        if (!user || typeof user.getIdToken !== 'function') {
          const storedToken = getUsableInlineStoredIdToken();
          if (storedToken) return storedToken;
          throw new Error('يجب تسجيل الدخول أولاً.');
        }
        const token = await getInlineDepositNonForcedIdToken(user);
        if (token) return token;
        const restored = await resolveInlineDepositUserForSubmit();
        if (restored && restored !== user && typeof restored.getIdToken === 'function') {
          const retryToken = await getInlineDepositNonForcedIdToken(restored);
          if (retryToken) return retryToken;
        }
        const storedToken = getUsableInlineStoredIdToken();
        if (storedToken) return storedToken;
        throw new Error('يجب تسجيل الدخول أولاً.');
      };
      recoveredGetIdTokenOrThrow.__inlineAuthRecovery = true;
      getIdTokenOrThrow = recoveredGetIdTokenOrThrow;
      try { window.__depositInlineResolveAuthUser = resolveInlineDepositUserForSubmit; } catch (_) {}
    } catch (_) {}
  }

  function sanitizeInlineClientMethodNote(value){
    let text = String(value || '').trim();
    if (!text) return '';
    INLINE_CLIENT_NOTE_BLOCKLIST.forEach(function(snippet){
      const raw = String(snippet || '').trim();
      if (!raw) return;
      text = text.split(raw).join(' ').trim();
    });
    return text.replace(/\s{2,}/g, ' ').trim();
  }

  function getNativeInlineDynamicExtraFieldsEl(){
    try {
      if (typeof dynamicExtraFields !== 'undefined' && dynamicExtraFields) return dynamicExtraFields;
    } catch (_) {}
    try {
      return (document && typeof document.getElementById === 'function')
        ? document.getElementById('dynamicExtraFields')
        : null;
    } catch (_) {
      return null;
    }
  }

  function getNativeInlineMethodHintEl(){
    try {
      if (typeof methodHint !== 'undefined' && methodHint) return methodHint;
    } catch (_) {}
    try {
      return (document && typeof document.getElementById === 'function')
        ? document.getElementById('methodHint')
        : null;
    } catch (_) {
      return null;
    }
  }

  function getNativeInlineMethodInfoEl(){
    try {
      if (typeof methodInfo !== 'undefined' && methodInfo) return methodInfo;
    } catch (_) {}
    try {
      return (document && typeof document.getElementById === 'function')
        ? document.getElementById('methodInfo')
        : null;
    } catch (_) {
      return null;
    }
  }

  function getNativeInlineCalcEl(){
    try {
      const recvField = (typeof recvCUR !== 'undefined' && recvCUR) ? recvCUR : null;
      if (recvField && typeof recvField.closest === 'function') {
        const calc = recvField.closest('.calc');
        if (calc) return calc;
      }
    } catch (_) {}
    try {
      const sendField = (typeof sendJOD !== 'undefined' && sendJOD) ? sendJOD : null;
      if (sendField && typeof sendField.closest === 'function') {
        const calc = sendField.closest('.calc');
        if (calc) return calc;
      }
    } catch (_) {}
    try {
      return (document && typeof document.querySelector === 'function')
        ? document.querySelector('#methodModal .calc')
        : null;
    } catch (_) {
      return null;
    }
  }

  function placeNativeInlineExtraFieldsBelowAmount(){
    try {
      const extraFieldsEl = getNativeInlineDynamicExtraFieldsEl();
      if (!extraFieldsEl) return;
      const infoEl = getNativeInlineMethodInfoEl();
      if (infoEl && typeof infoEl.insertAdjacentElement === 'function') {
        if (infoEl.nextElementSibling !== extraFieldsEl) {
          infoEl.insertAdjacentElement('afterend', extraFieldsEl);
        }
        return;
      }
      const calcEl = getNativeInlineCalcEl();
      if (calcEl && calcEl.parentNode) {
        calcEl.parentNode.appendChild(extraFieldsEl);
      }
    } catch (_) {}
  }

  function stripNativeClientExtraHeader(){
    try {
      const root = getNativeInlineDynamicExtraFieldsEl();
      if (!root || !root.querySelector) return;
      const head = root.querySelector('.dynamic-extra-head');
      if (head && head.parentNode) {
        head.parentNode.removeChild(head);
      }
    } catch (_) {}
  }

  function suppressNativeClientHint(){
    try {
      const hintEl = getNativeInlineMethodHintEl();
      if (!hintEl) return;
      hintEl.textContent = '';
      hintEl.hidden = true;
      if (hintEl.style) hintEl.style.display = 'none';
    } catch (_) {}
  }

  function resolveInlineMethodWindowNote(method){
    const methodData = method && method.data && typeof method.data === 'object'
      ? method.data
      : ((method && typeof method === 'object') ? method : {});
    return [
      methodData.modalNote,
      methodData.modal_note,
      methodData.methodHint,
      methodData.method_hint,
      methodData.windowDescription,
      methodData.window_description,
      methodData.windowNote,
      methodData.window_note
    ].map(function(value){
      return sanitizeInlineClientMethodNote(value);
    }).find(function(value){
      return value.length > 0;
    }) || '';
  }

  function applyNativeClientHint(method){
    try {
      const hintEl = getNativeInlineMethodHintEl();
      if (!hintEl) return '';
      const fallbackMethod = (typeof currentMethod !== 'undefined' && currentMethod) ? currentMethod : null;
      const text = resolveInlineMethodWindowNote(method || fallbackMethod);
      renderInlineMethodLinkedTextElement(hintEl, text);
      hintEl.hidden = !text;
      if (hintEl.style) hintEl.style.display = text ? '' : 'none';
      return text;
    } catch (_) {
      return '';
    }
  }

  function sanitizeInlineMediaUrl(value){
    var text = String(value == null ? '' : value).trim();
    if (!text) return '';
    var lower = text.toLowerCase();
    if (lower === 'undefined' || lower === 'null' || lower === 'nan' || lower === 'false' || lower === '[object object]') return '';
    if (/^javascript:/i.test(text)) return '';
    return text;
  }

  function parseInlineLooseBoolean(value){
    if (value === true || value === false) return value === true;
    var text = String(value == null ? '' : value).trim().toLowerCase();
    if (!text) return false;
    if (['1', 'true', 'yes', 'on', 'enabled', 'show', 'visible'].includes(text)) return true;
    if (['0', 'false', 'no', 'off', 'disabled', 'hide', 'hidden'].includes(text)) return false;
    return false;
  }

  function resolveInlineMethodDisplayName(method){
    var methodData = method && method.data && typeof method.data === 'object'
      ? method.data
      : ((method && typeof method === 'object') ? method : {});
    return String(methodData.name || methodData.title || methodData.id || methodData.methodId || '').trim() || 'طريقة';
  }

  function parseInlineOptionalBoolean(value){
    if (value === true || value === false) return value;
    if (typeof value === 'number' && isFinite(value)) return value !== 0;
    var text = String(value == null ? '' : value).trim().toLowerCase();
    if (!text) return null;
    if (['1', 'true', 'yes', 'on', 'enabled', 'required', 'require'].includes(text)) return true;
    if (['0', 'false', 'no', 'off', 'disabled', 'optional', 'none'].includes(text)) return false;
    return null;
  }

  function defaultInlineMethodRequiresProof(flow){
    return false;
  }

  function defaultInlineProofButtonLabel(flow){
    return 'رفع إثبات الدفع';
  }

  function resolveInlineMethodRequiresProof(method){
    var methodData = method && method.data && typeof method.data === 'object'
      ? method.data
      : ((method && typeof method === 'object') ? method : {});
    var parsed = parseInlineOptionalBoolean(
      methodData.requiresProofImage ??
      methodData.requireProofImage ??
      methodData.proofRequired ??
      methodData.requiresProof ??
      methodData.needProofImage ??
      methodData.needProof ??
      methodData.proofImageRequired ??
      methodData.showLogoInModal ??
      methodData.modalLogoEnabled ??
      methodData.modalImageEnabled ??
      methodData.showLogo ??
      methodData.showImageInModal
    );
    if (parsed != null) return parsed === true;
    return defaultInlineMethodRequiresProof(methodData.flow || getCurrentInlineFlowKind());
  }

  function resolveInlineMethodProofButtonLabel(method){
    var methodData = method && method.data && typeof method.data === 'object'
      ? method.data
      : ((method && typeof method === 'object') ? method : {});
    var text = String(
      methodData.proofButtonLabel ??
      methodData.proofButtonText ??
      methodData.proofLabel ??
      methodData.proofUploadLabel ??
      methodData.uploadProofLabel ??
      ''
    ).trim();
    return text || defaultInlineProofButtonLabel(methodData.flow || getCurrentInlineFlowKind());
  }

  function resolveInlineMethodModalLogoUrl(method){
    var methodData = method && method.data && typeof method.data === 'object'
      ? method.data
      : ((method && typeof method === 'object') ? method : {});
    return sanitizeInlineMediaUrl(methodData.logoUrl || methodData.imageUrl || methodData.iconUrl || '');
  }

  function getInlineMethodModalMediaMount(){
    try {
      var modal = document && typeof document.getElementById === 'function'
        ? document.getElementById('methodModal')
        : null;
      if (!modal || !modal.querySelector) return null;
      var content = modal.querySelector('.modal-content') || modal;
      var mount = content.querySelector('[data-inline-method-media]');
      if (mount) return mount;
      mount = document.createElement('div');
      mount.className = 'inline-method-media';
      mount.hidden = true;
      mount.setAttribute('data-inline-method-media', '1');
      var calcEl = getNativeInlineCalcEl();
      var infoEl = getNativeInlineMethodInfoEl();
      var anchor = (calcEl && calcEl.parentNode === content)
        ? calcEl
        : ((infoEl && infoEl.parentNode === content) ? infoEl : null);
      if (anchor && anchor.parentNode) {
        anchor.parentNode.insertBefore(mount, anchor);
      } else {
        content.appendChild(mount);
      }
      return mount;
    } catch (_) {
      return null;
    }
  }

  function renderInlineMethodModalMedia(method){
    try {
      var mount = getInlineMethodModalMediaMount();
      if (!mount) return;
      mount.hidden = true;
      mount.innerHTML = '';
    } catch (_) {}
  }

  function syncInlineProofTriggerLabel(method){
    try {
      var trigger = getInlineProofTriggerEl();
      if (!trigger) return;
      var activeMethod = method || ((typeof currentMethod !== 'undefined' && currentMethod) ? currentMethod : null);
      try {
        trigger.classList.add('inline-proof-trigger');
        trigger.setAttribute('data-inline-proof-trigger', '1');
        trigger.setAttribute('type', 'button');
      } catch (_) {}
      if (!resolveInlineMethodRequiresProof(activeMethod)) return;
      var pending = false;
      var uploaded = '';
      try { pending = typeof proofUploadPending !== 'undefined' && proofUploadPending === true; } catch (_) {}
      try { uploaded = String(typeof uploadedProofUrl !== 'undefined' ? (uploadedProofUrl || '') : '').trim(); } catch (_) {}
      if (pending || uploaded) return;
      var label = resolveInlineMethodProofButtonLabel(activeMethod);
      trigger.setAttribute('aria-label', label);
      trigger.innerHTML =
        '<span class="inline-proof-trigger-icon" aria-hidden="true"><i class="fa-solid fa-cloud-arrow-up"></i></span>' +
        '<span class="inline-proof-trigger-label">' + zEscHtml(label) + '</span>';
      try { scheduleInlineProofActionsLayoutCheck(); } catch (_) {}
    } catch (_) {}
  }

  function scheduleInlineProofActionsLayoutCheck(){
    try {
      const run = function(){
        updateInlineProofActionsLayout();
        try {
          if (typeof requestAnimationFrame === 'function') requestAnimationFrame(updateInlineProofActionsLayout);
        } catch (_) {}
      };
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run);
      else setTimeout(run, 0);
    } catch (_) {}
  }

  function updateInlineProofActionsLayout(){
    try {
      const proofTriggerEl = getInlineProofTriggerEl();
      const actionsEl = proofTriggerEl && proofTriggerEl.parentElement
        ? proofTriggerEl.parentElement
        : (submitDepositBtn && submitDepositBtn.parentElement ? submitDepositBtn.parentElement : null);
      if (!actionsEl || !proofTriggerEl || proofTriggerEl.hidden || proofTriggerEl.style.display === 'none') {
        if (actionsEl && actionsEl.classList) actionsEl.classList.remove('inline-proof-stacked');
        return;
      }
      if (actionsEl.classList) actionsEl.classList.remove('inline-proof-stacked');
      try { void actionsEl.offsetWidth; } catch (_) {}
      const labelEl = proofTriggerEl.querySelector ? proofTriggerEl.querySelector('.inline-proof-trigger-label') : null;
      const labelStyle = labelEl && window && typeof window.getComputedStyle === 'function'
        ? window.getComputedStyle(labelEl)
        : null;
      const fontSize = labelStyle ? parseFloat(labelStyle.fontSize || '0') : 0;
      const lineHeight = labelStyle ? (parseFloat(labelStyle.lineHeight || '0') || (fontSize ? fontSize * 1.3 : 0)) : 0;
      const labelRect = labelEl && labelEl.getBoundingClientRect ? labelEl.getBoundingClientRect() : null;
      const labelHeight = labelEl ? Math.max(labelRect ? labelRect.height : 0, labelEl.scrollHeight || 0) : 0;
      const wrapped = !!(labelEl && lineHeight > 0 && labelHeight > (lineHeight * 1.45));
      actionsEl.classList.toggle('inline-proof-stacked', wrapped);
    } catch (_) {}
  }

  function getInlineMethodModalEl(){
    try {
      return (document && typeof document.getElementById === 'function')
        ? document.getElementById('methodModal')
        : null;
    } catch (_) {
      return null;
    }
  }

  function getInlineMethodModalContentEl(){
    try {
      var modal = getInlineMethodModalEl();
      if (!modal || !modal.querySelector) return null;
      return modal.querySelector('.modal-content') || modal;
    } catch (_) {
      return null;
    }
  }

  function ensureInlineSubmitLoaderEl(){
    try {
      var content = getInlineMethodModalContentEl();
      if (!content || !content.appendChild || !document || typeof document.createElement !== 'function') return null;
      var loader = content.querySelector('[data-inline-submit-loader]');
      if (loader) return loader;
      loader = document.createElement('div');
      loader.className = 'inline-submit-loader';
      loader.hidden = true;
      loader.setAttribute('data-inline-submit-loader', '1');
      loader.setAttribute('aria-hidden', 'true');
      loader.innerHTML =
        '<div class="inline-submit-loader-card" role="status" aria-live="polite">' +
          '<span class="inline-submit-loader-spinner" aria-hidden="true"><i class="fa-solid fa-circle-notch fa-spin"></i></span>' +
          '<strong class="inline-submit-loader-title">جاري إرسال الطلب...</strong>' +
          '<span class="inline-submit-loader-copy">ننتظر رد الخادم والمزوّد، يرجى عدم إغلاق هذه النافذة.</span>' +
        '</div>';
      content.appendChild(loader);
      return loader;
    } catch (_) {
      return null;
    }
  }

  function setInlineSubmitAwaitVisual(active){
    try {
      var content = getInlineMethodModalContentEl();
      var loader = content && content.querySelector ? content.querySelector('[data-inline-submit-loader]') : null;
      if (loader) {
        loader.hidden = true;
        loader.setAttribute('aria-hidden', 'true');
      }
      if (content && content.classList) {
        content.classList.remove('is-submit-pending');
      }
      if (active) {
        if (typeof window.__holdPageLoader === 'function') {
          window.__holdPageLoader();
        } else if (typeof showPageLoader === 'function') {
          showPageLoader({ hold: true });
        } else {
          var preloader = document.getElementById('preloader');
          if (preloader) {
            preloader.classList.remove('hidden');
            preloader.style.display = 'flex';
            preloader.style.opacity = '1';
          }
        }
      } else {
        if (typeof window.__releasePageLoader === 'function') {
          window.__releasePageLoader();
        } else if (typeof hidePageLoader === 'function') {
          hidePageLoader();
        } else {
          var pageLoader = document.getElementById('preloader');
          if (pageLoader) {
            pageLoader.classList.add('hidden');
            pageLoader.style.opacity = '0';
            setTimeout(function(){ try { pageLoader.style.display = 'none'; } catch (_) {} }, 250);
          }
        }
      }
    } catch (_) {}
  }

  function decorateNativeInlineMethodInfo(){
    try {
      const infoEl = getNativeInlineMethodInfoEl();
      if (!infoEl || !infoEl.querySelectorAll) return;
      const items = Array.from(infoEl.querySelectorAll('.info-item'));
      items.forEach(function(item){
        if (!item || !item.classList) return;
        item.classList.remove('inline-native-fee-item');
        item.classList.remove('inline-native-note-item');
        const labelEl = item.querySelector ? item.querySelector('strong') : null;
        const labelText = String(labelEl && labelEl.textContent || '').trim();
        if (inlineLabelLooksLikeAdditionalNote(labelText)) {
          try {
            if (item.parentNode) item.parentNode.removeChild(item);
            else if (typeof item.remove === 'function') item.remove();
          } catch (_) {}
          return;
        }
        let inlineKind = 'field';
        if (/(?:fee|عمولة)/i.test(labelText)) {
          item.classList.add('inline-native-fee-item');
        }
      });
    } catch (_) {}
  }

  function refreshNativeInlineMethodUi(method){
    stripNativeClientExtraHeader();
    applyNativeClientHint(method);
    decorateNativeInlineMethodInfo();
    linkifyInlineMethodInfoLinks(getNativeInlineMethodInfoEl());
  }

  function decorateNativeInlineMethodInfo(method){
    try {
      const infoEl = getNativeInlineMethodInfoEl();
      if (!infoEl || !infoEl.querySelectorAll) return;
      const activeMethod = method || ((typeof currentMethod !== 'undefined' && currentMethod) ? currentMethod : null);
      const formatNativeInlineFeeValue = function(value){
        const rawText = String(value == null ? '' : value).trim();
        if (!rawText) return '';
        if (/[A-Za-z$أ¢â€ڑآ¬آآ£آآ¥]|[\u0600-\u06FF]/.test(rawText) && !/^[-+]?[\d.,]+$/.test(rawText)) {
          return rawText;
        }
        const currencyCode = resolveInlineModalMethodCurrency(activeMethod) || 'USD';
        const numeric = Number(rawText.replace(/,/g, ''));
        if (!Number.isFinite(numeric)) return rawText;
        if (typeof formatNumber === 'function' && typeof digitsForCurrency === 'function') {
          return formatNumber(numeric, digitsForCurrency(currencyCode)) + (currencyCode ? (' ' + currencyCode) : '');
        }
        return numeric.toFixed(3) + (currencyCode ? (' ' + currencyCode) : '');
      };
      const feeItems = [];
      const items = Array.from(infoEl.querySelectorAll('.info-item'));
      items.forEach(function(item){
        if (!item || !item.classList) return;
        item.classList.remove('inline-native-fee-item');
        item.classList.remove('inline-native-note-item');
        const labelEl = item.querySelector ? item.querySelector('strong') : null;
        const labelText = String(labelEl && labelEl.textContent || '').trim();
        if (inlineLabelLooksLikeAdditionalNote(labelText)) {
          try {
            if (item.parentNode) item.parentNode.removeChild(item);
            else if (typeof item.remove === 'function') item.remove();
          } catch (_) {}
          return;
        }
        let inlineKind = 'field';
        if (/(?:fee|\u0639\u0645\u0648\u0644\u0629)/i.test(labelText)) {
          inlineKind = 'fee';
          item.classList.add('inline-native-fee-item');
          if (labelEl) labelEl.textContent = '\u0627\u0644\u0639\u0645\u0648\u0644\u0629';
          feeItems.push(item);
        } else if (/(?:note|\u0645\u0644\u0627\u062d\u0638)/i.test(labelText)) {
          inlineKind = 'note';
          item.classList.add('inline-native-note-item');
        }
        try { item.dataset.inlineKind = inlineKind; } catch (_) {}
      });
      if (feeItems.length) {
        const primaryFeeItem = feeItems[0];
        const primaryLabelEl = primaryFeeItem && primaryFeeItem.querySelector
          ? primaryFeeItem.querySelector('strong')
          : null;
        const primaryValueEl = primaryFeeItem && primaryFeeItem.querySelector
          ? primaryFeeItem.querySelector('.value-text')
          : null;
        if (primaryLabelEl) primaryLabelEl.textContent = '\u0627\u0644\u0639\u0645\u0648\u0644\u0629';
        if (primaryValueEl) {
          const rawValue = String((primaryValueEl.dataset && primaryValueEl.dataset.rawValue) || primaryValueEl.textContent || '').trim();
          const formattedValue = formatNativeInlineFeeValue(rawValue);
          try {
            if (primaryValueEl.dataset) primaryValueEl.dataset.rawValue = rawValue;
          } catch (_) {}
          if (formattedValue) primaryValueEl.textContent = formattedValue;
        }
      }
    } catch (_) {}
  }

  function refreshNativeInlineMethodUi(method){
    stripNativeClientExtraHeader();
    applyNativeClientHint(method);
    placeNativeInlineExtraFieldsBelowAmount();
    renderInlineMethodModalMedia(method);
    try {
      const titleEl = document && typeof document.querySelector === 'function'
        ? document.querySelector('#methodModal .modal-title')
        : null;
      if (titleEl && titleEl.style) {
        const isDarkTheme = (function(){
          try {
            const theme = String(document && document.documentElement && document.documentElement.getAttribute('data-theme') || '').trim().toLowerCase();
            if (theme) return theme === 'dark';
          } catch (_) {}
          try {
            return !!(document && document.body && document.body.classList && document.body.classList.contains('dark-mode'));
          } catch (_) {}
          return false;
        })();
        titleEl.style.color = isDarkTheme
          ? 'var(--site-accent-runtime-light, var(--site-accent-runtime, var(--accent-theme, #dbeafe)))'
          : 'var(--site-accent-runtime-strong, var(--site-accent-runtime, var(--accent-theme, #4f46e5)))';
      }
    } catch (_) {}
    decorateNativeInlineMethodInfo(method);
    ensureInlineMethodInfoCopyButtons(method);
    syncInlineModalDirection();
  }

  function normalizeInlineFlow(value){
    const v = String(value || '').trim().toLowerCase();
    return (v === 'withdraw' || v === 'sahb' || v === 'سحب') ? 'withdraw' : 'deposit';
  }

  function getCurrentInlineHashPath(){
    try {
      const hash = String((window && window.location && window.location.hash) || '');
      if (hash.indexOf('#/') === 0) return hash.slice(2);
      if (hash.charAt(0) === '#') return hash.slice(1);
      return hash;
    } catch (_) {
      return '';
    }
  }

  function getCurrentInlineFlowKind(){
    if (typeof getEmbeddedInlineFlowKind === 'function') return getEmbeddedInlineFlowKind();
    try {
      const raw = getCurrentInlineHashPath();
      const first = raw.split('/').filter(Boolean)[0] || '';
      return (first === 'withdraw' || first === 'sahb') ? 'withdraw' : 'deposit';
    } catch (_) {
      return 'deposit';
    }
  }

  function getCurrentInlineFlowPath(){
    return normalizeInlineFlow(getCurrentInlineFlowKind()) === 'withdraw' ? 'withdraw' : 'deposit';
  }

  function getInlineFlowPathFor(flow){
    return normalizeInlineFlow(flow) === 'withdraw' ? 'withdraw' : 'deposit';
  }

  function getCurrentInlineRootHeading(){
    return getCurrentInlineFlowKind() === 'withdraw' ? 'خيارات السحب المتاحة' : 'خيارات الإيداع المتاحة';
  }

  function getCurrentInlineCountriesHeading(){
    return getCurrentInlineFlowKind() === 'withdraw' ? 'الدول المتاحة للسحب' : 'الدول المتاحة للإيداع';
  }

  function buildInlineCountryHash(countryId){
    const safeCountryId = String(countryId || '').trim();
    const flowPath = getCurrentInlineFlowPath();
    return safeCountryId
      ? ('#/' + flowPath + '/' + encodeURIComponent(safeCountryId))
      : ('#/' + flowPath);
  }

  function getCurrentInlineCountriesCacheKey(){
    return getInlineCountriesCacheKeyFor(getCurrentInlineFlowKind());
  }

  function getCurrentInlineCountriesCacheMetaKey(){
    return getInlineCountriesCacheMetaKeyFor(getCurrentInlineFlowKind());
  }

  function resolveInlineCountriesCacheViewerKey(){
    try {
      const currentUid = depositAuth && depositAuth.currentUser && depositAuth.currentUser.uid;
      if (currentUid) return 'uid:' + String(currentUid || '').trim().toLowerCase();
    } catch (_) {}
    try {
      const authInstance = (typeof firebase !== 'undefined' && firebase && typeof firebase.auth === 'function')
        ? firebase.auth()
        : null;
      const fallbackUid = authInstance && authInstance.currentUser && authInstance.currentUser.uid;
      if (fallbackUid) return 'uid:' + String(fallbackUid || '').trim().toLowerCase();
    } catch (_) {}
    return 'guest';
  }

  let inlineCountriesViewerScopeKey = '';
  function syncInlineCountriesViewerScope(){
    const nextKey = resolveInlineCountriesCacheViewerKey();
    if (inlineCountriesViewerScopeKey && inlineCountriesViewerScopeKey !== nextKey) {
      try { currentCountry = null; } catch (_) {}
      try { countries = []; } catch (_) {}
      try { methods = []; } catch (_) {}
      try { directRootMethods = []; } catch (_) {}
      try {
        if (typeof depositFxCache !== 'undefined' && depositFxCache && typeof depositFxCache.clear === 'function') {
          depositFxCache.clear();
        }
      } catch (_) {}
    }
    inlineCountriesViewerScopeKey = nextKey;
    return nextKey;
  }

  function getInlineCountriesCacheKeyFor(flow){
    return 'edaa:' + normalizeInlineFlow(flow) + ':countries:v4:' + syncInlineCountriesViewerScope();
  }

  function getInlineCountriesCacheMetaKeyFor(flow){
    return 'edaa:' + normalizeInlineFlow(flow) + ':countries:meta:v4:' + syncInlineCountriesViewerScope();
  }

  function normalizeInlineCurrencyCode(value){
    const raw = String(value || '').trim().toUpperCase();
    if (!raw) return '';
    const parts = raw.split('/').map(function(part){
      return String(part || '').trim().toUpperCase();
    }).filter(Boolean);
    if (!parts.length) return '';
    return parts.find(function(part){ return part !== 'USD'; }) || parts[0] || '';
  }

  function normalizeInlineCurrencyEntryId(value){
    const raw = String(value == null ? '' : value).trim();
    return raw ? raw.slice(0, 160) : '';
  }

  function getInlineCurrencyEntryIdFromData(source){
    const data = (source && typeof source === 'object') ? source : {};
    return normalizeInlineCurrencyEntryId(
      data.currencyId ||
      data.currency_id ||
      data.payCurrencyId ||
      data.pay_currency_id ||
      data.currencyKey ||
      data.currency_key ||
      data.currencySelectionKey ||
      data.currency_selection_key ||
      data.selectionKey ||
      data.selection_key ||
      ''
    );
  }

  function normalizeInlineRequiredFlag(value){
    if (value === true) return true;
    const raw = String(value == null ? '' : value).trim().toLowerCase();
    return raw === 'true' || raw === '1' || raw === 'yes' || raw === 'required' || raw === 'مطلوب';
  }

  function normalizeInlineExtraFieldKind(value){
    const raw = String(value || '').trim().toLowerCase();
    if (!raw) return 'text';
    if (raw === 'textarea' || raw === 'multiline' || raw === 'multi_line' || raw === 'text_area') return 'textarea';
    if (raw === 'select' || raw === 'dropdown' || raw === 'choice') return 'select';
    if (raw === 'number' || raw === 'numeric') return 'number';
    if (raw === 'phone' || raw === 'tel') return 'tel';
    if (raw === 'email') return 'email';
    if (raw === 'password') return 'password';
    return 'text';
  }

  function normalizeInlineExtraFieldOptions(rawOptions){
    const source = Array.isArray(rawOptions)
      ? rawOptions
      : (typeof rawOptions === 'string'
          ? rawOptions.split(/\\r?\\n|[,;]+/g).map(function(entry){
              return { value: entry, label: entry };
            })
          : []);
    return source.map(function(entry){
      if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
        const value = String(entry.value || entry.id || entry.key || entry.code || '').trim();
        const label = String(entry.label || entry.name || value).trim();
        if (!value && !label) return null;
        return {
          value: value || label,
          label: label || value || ''
        };
      }
      const text = String(entry || '').trim();
      if (!text) return null;
      return { value: text, label: text };
    }).filter(Boolean);
  }

  function normalizeInlineExtraFields(raw){
    const list = Array.isArray(raw) ? raw : [];
    return list.map(function(entry, idx){
      const source = (entry && typeof entry === 'object') ? entry : {};
      const key = String(source.key || source.id || source.name || ('field_' + (idx + 1))).trim();
      const label = String(source.label || source.title || source.name || key).trim();
      if (!key || !label) return null;
      const options = normalizeInlineExtraFieldOptions(source.options || source.choices || source.values || source.items);
      const kind = normalizeInlineExtraFieldKind(source.kind || source.type || source.inputType || source.fieldType);
      return {
        key: key,
        label: label,
        kind: (kind === 'select' && !options.length) ? 'text' : kind,
        required: normalizeInlineRequiredFlag(source.required),
        placeholder: String(source.placeholder || source.hint || source.helpText || '').trim(),
        options: options
      };
    }).filter(Boolean);
  }

  function getInlineMethodExtraFields(method){
    const root = (method && typeof method === 'object') ? method : {};
    const data = (root.data && typeof root.data === 'object')
      ? root.data
      : ((root && typeof root === 'object') ? root : {});
    const buckets = [
      data.extraFields,
      data.clientFields,
      data.formFields,
      data.fields,
      data.extraFieldDefs,
      data.extraFieldsDef,
      data.requiredFields,
      root.extraFields,
      root.clientFields,
      root.formFields,
      root.fields,
      root.extraFieldDefs,
      root.extraFieldsDef,
      root.requiredFields
    ];
    let base = [];
    for (let i = 0; i < buckets.length; i += 1) {
      const normalized = normalizeInlineExtraFields(buckets[i]);
      if (normalized.length) {
        base = normalized.filter(function(field){
          return !inlineExtraFieldLooksLikeLegacyPlaceholder(field);
        });
        break;
      }
    }
    // SMS deposit auto-confirmation: the customer must supply the transfer's
    // reference number. Inject it as a required field so it renders + is collected
    // like any extra field and rides along to /deposit/submit under key
    // referenceNumber (which the server matches the bank SMS against).
    const sms = (data && data.smsReceipt) || (root && root.smsReceipt);
    if (sms && sms.enabled === true) {
      const hasRef = base.some(function(field){
        return String(field && field.key || '').toLowerCase() === 'referencenumber';
      });
      if (!hasRef) {
        base = base.concat([{
          key: 'referenceNumber',
          label: 'الرقم المرجعي',
          required: true,
          kind: 'text',
          placeholder: 'الرقم المرجعي للحوالة'
        }]);
      }
    }
    return base;
  }

  function inlineExtraFieldLooksLikeLegacyPlaceholder(field){
    if (!field || typeof field !== 'object') return false;
    const key = String(field.key || '').trim().toLowerCase();
    const label = String(field.label || '').trim().toLowerCase();
    const placeholder = String(field.placeholder || '').trim();
    if (!/^(?:client_)?field_\d+$/.test(key)) return false;
    if (placeholder) return false;
    return !label || label === key;
  }

  function sortMethodEntries(list){
    return (Array.isArray(list) ? list.slice() : []).sort(function(a, b){
      const ao = Number.isFinite(Number(a && a.data && a.data.order)) ? Number(a.data.order) : Number.MAX_SAFE_INTEGER;
      const bo = Number.isFinite(Number(b && b.data && b.data.order)) ? Number(b.data.order) : Number.MAX_SAFE_INTEGER;
      if (ao !== bo) return ao - bo;
      return String(a && a.data && (a.data.name || a.id) || '').localeCompare(String(b && b.data && (b.data.name || b.id) || ''), 'ar');
    });
  }

  normalizeTransferTargets = function(raw){
    if (!Array.isArray(raw)) return [];
    const out = [];
    const pushEntry = function(entry, sectionMeta){
      if (typeof entry === 'string') {
        const text = entry.trim();
        if (!text) return;
        out.push({
          label: sectionMeta && sectionMeta.grouped ? '' : text,
          value: text,
          copyable: resolveInlineDisplayFieldCopyable(null, text, text, ''),
          sectionKey: sectionMeta && sectionMeta.key || '',
          sectionTitle: sectionMeta && sectionMeta.title || '',
          sectionGrouped: sectionMeta && sectionMeta.grouped === true
        });
        return;
      }
      if (entry && typeof entry === 'object') {
        const label = String(entry.label || entry.title || entry.name || '').trim();
        const value = String(entry.value || entry.number || entry.account || entry.wallet || entry.phone || entry.text || entry.content || '').trim();
        const resolvedValue = value || label || '';
        if (!resolvedValue) return;
        const resolvedLabel = (sectionMeta && sectionMeta.grouped === true) ? '' : (label || resolvedValue);
        out.push({
          label: resolvedLabel,
          value: resolvedValue,
          copyable: Object.prototype.hasOwnProperty.call(entry, 'copyable')
            ? entry.copyable !== false
            : resolveInlineDisplayFieldCopyable(entry, resolvedLabel, resolvedValue, entry.key || ''),
          sectionKey: String(entry.sectionKey || entry.sectionId || entry.groupKey || (sectionMeta && sectionMeta.key) || '').trim(),
          sectionTitle: String(entry.sectionTitle || entry.groupTitle || entry.sectionName || (sectionMeta && sectionMeta.title) || '').trim(),
          sectionGrouped: Object.prototype.hasOwnProperty.call(entry, 'sectionGrouped')
            ? entry.sectionGrouped === true
            : (Object.prototype.hasOwnProperty.call(entry, 'grouped')
              ? entry.grouped === true
              : (sectionMeta && sectionMeta.grouped === true))
        });
      }
    };
    raw.forEach(function(entry, index){
      if (entry && typeof entry === 'object' && !Array.isArray(entry) && Array.isArray(entry.values)) {
        const sectionMeta = {
          key: String(entry.sectionKey || entry.sectionId || entry.id || entry.key || ('transfer_section_' + String(index + 1))).trim(),
          title: String(entry.sectionTitle || entry.groupTitle || entry.sectionName || entry.title || entry.label || '').trim(),
          grouped: entry.sectionGrouped === true || entry.grouped === true || entry.groupTransferTargets === true
        };
        entry.values.forEach(function(row){
          pushEntry(row, sectionMeta);
        });
        return;
      }
      pushEntry(entry, null);
    });
    return out.filter(function(entry){
      return entry && String(entry.value || '').trim();
    });
  };

  function resolveInlineDisplayFieldCopyable(source, label, value, key){
    if (source && typeof source === 'object' && Object.prototype.hasOwnProperty.call(source, 'copyable')) {
      return source.copyable !== false;
    }
    const labelText = String(label || '').trim();
    const valueText = String(value || '').trim();
    const keyText = String(key || '').trim().toLowerCase();
    const haystack = (labelText + ' ' + valueText + ' ' + keyText).toLowerCase();
    if (!haystack) return false;
    return /wallet|iban|account|number|phone|transfer|target|telegram|webuid/.test(haystack) || /رقم|محفظ|حساب|iban|تحويل|معر|هاتف/i.test(labelText);
  }

  function normalizeInlineTransferSectionTitle(value){
    const text = String(value || '').trim();
    return text || 'عناوين التحويل';
  }

  function buildInlineTransferSections(transferTargets, options){
    const opts = (options && typeof options === 'object') ? options : {};
    const source = Array.isArray(transferTargets) ? transferTargets : [];
    const legacyGrouped = opts.groupEnabled === true;
    const legacyTitle = normalizeInlineTransferSectionTitle(opts.groupTitle || '');
    const sections = [];
    const sectionMap = new Map();
    const hasExplicitSections = source.some(function(item){
      return !!(
        item &&
        typeof item === 'object' &&
        !Array.isArray(item) &&
        (
          Array.isArray(item.values) ||
          String(item.sectionKey || item.sectionId || item.groupKey || '').trim() ||
          String(item.sectionTitle || item.groupTitle || item.sectionName || '').trim() ||
          Object.prototype.hasOwnProperty.call(item, 'sectionGrouped') ||
          Object.prototype.hasOwnProperty.call(item, 'grouped')
        )
      );
    });
    const ensureSection = function(sectionKeyValue, titleValue, groupedValue){
      const safeKey = String(sectionKeyValue || '').trim() || ('transfer_section_' + String(sections.length + 1));
      if (sectionMap.has(safeKey)) return sectionMap.get(safeKey);
      const section = {
        sectionKey: safeKey,
        sectionTitle: normalizeInlineTransferSectionTitle(titleValue || legacyTitle),
        sectionGrouped: groupedValue === true,
        values: []
      };
      sectionMap.set(safeKey, section);
      sections.push(section);
      return section;
    };
    const pushValue = function(section, entry, index){
      if (!section) return;
      if (typeof entry === 'string') {
        const text = entry.trim();
        if (!text) return;
        section.values.push({
          label: section.sectionGrouped ? '' : text,
          value: text,
          copyable: resolveInlineDisplayFieldCopyable(null, text, text, ''),
          index: index
        });
        return;
      }
      if (!entry || typeof entry !== 'object') return;
      const rawLabel = String(entry.label || entry.title || entry.name || '').trim();
      const rawValue = String(entry.value || entry.number || entry.account || entry.wallet || entry.phone || entry.text || entry.content || '').trim();
      const resolvedValue = rawValue || rawLabel || '';
      if (!resolvedValue) return;
      const resolvedLabel = section.sectionGrouped ? '' : (rawLabel || resolvedValue);
      section.values.push({
        label: resolvedLabel,
        value: resolvedValue,
        copyable: Object.prototype.hasOwnProperty.call(entry, 'copyable')
          ? entry.copyable !== false
          : (section.sectionGrouped || resolveInlineDisplayFieldCopyable(entry, resolvedLabel, resolvedValue, entry.key || '')),
        index: index
      });
    };
    source.forEach(function(entry, index){
      if (entry && typeof entry === 'object' && !Array.isArray(entry) && Array.isArray(entry.values)) {
        const section = ensureSection(
          entry.sectionKey || entry.sectionId || entry.id || entry.key || '',
          entry.sectionTitle || entry.groupTitle || entry.sectionName || entry.title || entry.label || legacyTitle,
          entry.sectionGrouped === true || entry.grouped === true || entry.groupTransferTargets === true
        );
        entry.values.forEach(function(row, rowIndex){
          pushValue(section, row, rowIndex);
        });
        return;
      }
      const current = entry && typeof entry === 'object' ? entry : {};
      const section = ensureSection(
        current.sectionKey || current.sectionId || current.groupKey || (hasExplicitSections ? ('transfer_section_' + String(index + 1)) : 'transfer_section_default'),
        current.sectionTitle || current.groupTitle || current.sectionName || legacyTitle,
        Object.prototype.hasOwnProperty.call(current, 'sectionGrouped')
          ? current.sectionGrouped === true
          : (Object.prototype.hasOwnProperty.call(current, 'grouped')
            ? current.grouped === true
            : legacyGrouped)
      );
      pushValue(section, entry, index);
    });
    return sections.map(function(section){
      return {
        sectionKey: section.sectionKey,
        sectionTitle: normalizeInlineTransferSectionTitle(section.sectionTitle || legacyTitle),
        sectionGrouped: section.sectionGrouped === true,
        values: (Array.isArray(section.values) ? section.values : []).filter(function(item){
          return item && String(item.value || '').trim();
        }).map(function(item){
          return {
            label: String(item.label || '').trim(),
            value: String(item.value || '').trim(),
            copyable: item.copyable !== false
          };
        })
      };
    }).filter(function(section){
      return Array.isArray(section.values) && section.values.length;
    });
  }

  function buildInlineTransferDisplayFields(transferTargets, options){
    const opts = (options && typeof options === 'object') ? options : {};
    const sections = buildInlineTransferSections(transferTargets, opts);
    const forceFlat = opts.forceFlat === true;
    const out = [];
    sections.forEach(function(section, sectionIndex){
      const values = Array.isArray(section && section.values) ? section.values : [];
      if (!values.length) return;
      if (section.sectionGrouped === true && !forceFlat) {
        const groupedValue = values.map(function(item){
          return String(item && item.value || '').trim();
        }).filter(Boolean).join('\\n');
        if (!groupedValue) return;
        out.push({
          key: 'transfer_targets_group_' + String(sectionIndex + 1),
          label: normalizeInlineTransferSectionTitle(section.sectionTitle || ''),
          value: groupedValue,
          copyable: values.some(function(item){ return item && item.copyable !== false; })
        });
        return;
      }
      values.forEach(function(item, valueIndex){
        const fallbackLabel = values.length > 1 ? ('جهة التحويل ' + (valueIndex + 1)) : 'جهة التحويل';
        const value = String(item && item.value || '').trim();
        if (!value) return;
        out.push({
          key: 'transfer_target_' + String(sectionIndex + 1) + '_' + String(valueIndex + 1),
          label: String(item && item.label || fallbackLabel).trim() || fallbackLabel,
          value: value,
          copyable: item && item.copyable !== false
        });
      });
    });
    return dedupeInlineFieldValueEntries(out);
  }

  function normalizeInlineDisplayLooseKey(value){
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[\s_-]+/g, '');
  }

  function buildInlineDisplayValueFingerprint(label, value){
    const normalizedLabel = normalizeInlineDisplayLooseKey(label);
    const normalizedValue = String(value || '').trim().toLowerCase();
    if (!normalizedValue) return '';
    return normalizedLabel + '|' + normalizedValue;
  }

  function dedupeInlineFieldValueEntries(list){
    const entries = Array.isArray(list) ? list : [];
    const out = [];
    const seen = Object.create(null);
    entries.forEach(function(entry){
      const source = (entry && typeof entry === 'object') ? entry : null;
      if (!source) return;
      const label = String(source.label || source.name || source.title || source.key || '').trim();
      const value = String(source.value || source.text || source.content || '').trim();
      const fingerprint = buildInlineDisplayValueFingerprint(label, value);
      if (!fingerprint || seen[fingerprint]) return;
      seen[fingerprint] = 1;
      out.push(source);
    });
    return out;
  }

  function getInlineRawDisplayFields(source){
    const raw = (source && typeof source === 'object') ? source : {};
    const data = (raw.data && typeof raw.data === 'object' && !Array.isArray(raw.data)) ? raw.data : {};
    if (Array.isArray(raw.displayFields)) return raw.displayFields;
    if (Array.isArray(data.displayFields)) return data.displayFields;
    return [];
  }

  function inlineLabelLooksLikeAdditionalNote(value){
    const normalized = normalizeInlineDisplayLooseKey(value);
    if (!normalized) return false;
    return normalized === normalizeInlineDisplayLooseKey('\u0645\u0644\u0627\u062d\u0638\u0627\u062a') ||
      normalized === normalizeInlineDisplayLooseKey('\u0645\u0644\u0627\u062d\u0638\u0627\u062a \u0625\u0636\u0627\u0641\u064a\u0629') ||
      normalized === 'additionalnotes' ||
      normalized === 'additionalnote';
  }

  function inlineDisplayFieldLooksLikeNote(entry){
    if (!entry || typeof entry !== 'object') return false;
    const haystack = [
      entry.key,
      entry.label,
      entry.name,
      entry.title
    ].map(normalizeInlineDisplayLooseKey).filter(Boolean).join(' ');
    if (!haystack) return false;
    return haystack.includes('note') ||
      haystack.includes(normalizeInlineDisplayLooseKey('ملاحظات')) ||
      haystack.includes(normalizeInlineDisplayLooseKey('ملاحظات إضافية'));
  }

  function inlineDisplayFieldLooksLikeTransferField(entry){
    if (!entry || typeof entry !== 'object') return false;
    const rawKey = String(entry.key || entry.id || '').trim();
    const keyNorm = normalizeInlineDisplayLooseKey(rawKey);
    return keyNorm === 'transfertargetsgroup' || keyNorm.indexOf('transfertarget') === 0;
  }

  function stripInlineNoteDisplayFields(displayFields){
    const list = Array.isArray(displayFields)
      ? displayFields.filter(function(entry){ return entry && typeof entry === 'object'; })
      : [];
    return list.filter(function(entry){
      return !inlineDisplayFieldLooksLikeNote(entry);
    });
  }

  function stripInlineTransferDisplayFields(displayFields, transferTargets){
    const list = Array.isArray(displayFields)
      ? displayFields.filter(function(entry){ return entry && typeof entry === 'object'; })
      : [];
    const targets = buildInlineTransferDisplayFields(transferTargets, { groupEnabled: false, forceFlat: true }).map(function(entry){
      return {
        label: normalizeInlineDisplayLooseKey(String(entry && entry.label || '').trim()),
        value: String(entry && entry.value || '').trim()
      };
    }).filter(function(entry){
      return entry.value;
    });
    return list.filter(function(entry){
      if (inlineDisplayFieldLooksLikeTransferField(entry)) return false;
      const label = normalizeInlineDisplayLooseKey(String(entry && (entry.label || entry.name || entry.title || '')).trim());
      const value = String(entry && (entry.value || entry.text || entry.content || '')).trim();
      if (!value || !targets.length) return true;
      return !targets.some(function(target){
        return target.value === value && target.label === label;
      });
    });
  }

  function extractInlineNoteFromDisplayFields(displayFields){
    const match = (Array.isArray(displayFields) ? displayFields : []).find(function(entry){
      return inlineDisplayFieldLooksLikeNote(entry) && String(entry && entry.value || '').trim();
    });
    return String(match && match.value || '').trim();
  }

  function buildInlineNoteDisplayField(noteValue){
    const value = String(noteValue || '').trim();
    if (!value) return null;
    return {
      key: 'note',
      label: 'ملاحظات إضافية',
      value: value
    };
  }

  function appendInlineNoteDisplayField(displayFields, noteValue){
    const baseList = stripInlineNoteDisplayFields(displayFields);
    const noteField = buildInlineNoteDisplayField(noteValue);
    if (!noteField) return baseList;
    return baseList.concat(noteField);
  }

  function resolveInlineClientNote(info, displayFields){
    return String(extractInlineNoteFromDisplayFields(displayFields) || '').trim();
  }

  function buildInlineInfoDisplayFields(info, flow){
    const source = (info && typeof info === 'object' && !Array.isArray(info)) ? info : {};
    const flowKey = normalizeInlineFlow(flow || getCurrentInlineFlowKind());
    
    const defs = [
      ['bank', 'اسم البنك'],
      ['accountName', 'اسم المستفيد'],
      ['accountNumber', 'رقم الحساب'],
      ['iban', 'IBAN'],
      ['wallet', 'المحفظة']
    ];
    return defs.map(function(entry){
      const key = entry[0];
      const label = entry[1];
      const value = String(source[key] || '').trim();
      if (!value) return null;
      return { key: key, label: label, value: value };
    }).filter(Boolean);
  }

  function mergeInlineDisplayFieldLists(primaryFields, secondaryFields){
    const merged = [];
    const seen = Object.create(null);
    const seenByLabelValue = Object.create(null);

    function append(list){
      (Array.isArray(list) ? list : []).forEach(function(entry, idx){
        const source = (entry && typeof entry === 'object') ? entry : null;
        if (!source) return;
        const key = String(source.key || '').trim();
        const label = String(source.label || source.name || source.title || key || ('تفصيل ' + (idx + 1))).trim();
        const value = String(source.value || source.text || source.content || '').trim();
        if (!value) return;
        const fingerprint = [
          normalizeInlineDisplayLooseKey(key || label),
          normalizeInlineDisplayLooseKey(label),
          value.toLowerCase()
        ].join('|');
        const labelValueFingerprint = buildInlineDisplayValueFingerprint(label, value);
        if (seen[fingerprint]) return;
        if (labelValueFingerprint && seenByLabelValue[labelValueFingerprint]) return;
        seen[fingerprint] = 1;
        if (labelValueFingerprint) seenByLabelValue[labelValueFingerprint] = 1;
        const nextEntry = {
          key: key || ('display_field_' + (merged.length + 1)),
          label: label || ('تفصيل ' + (merged.length + 1)),
          value: value
        };
        if (Object.prototype.hasOwnProperty.call(source, 'copyable')) {
          nextEntry.copyable = source.copyable !== false;
        }
        merged.push(nextEntry);
      });
    }

    append(primaryFields);
    append(secondaryFields);
    return merged;
  }

  function resolveInlineDisplayFields(displayFields, transferTargets, info, flow, options){
    const flowKey = normalizeInlineFlow(flow || getCurrentInlineFlowKind());
    const opts = (options && typeof options === 'object') ? options : {};
    const source = (opts.source && typeof opts.source === 'object' && !Array.isArray(opts.source)) ? opts.source : {};
    const includeClientNoteDisplay = opts.includeClientNoteDisplay !== false;
    const groupEnabled = opts.groupEnabled === true || (
      typeof parseInlineOptionalBoolean === 'function'
        ? parseInlineOptionalBoolean(source.transferTargetsGroupEnabled ?? source.targetsGroupEnabled ?? source.groupTransferTargets) === true
        : !!(source.transferTargetsGroupEnabled === true || source.targetsGroupEnabled === true || source.groupTransferTargets === true)
    );
    const groupTitle = String(
      opts.groupTitle ||
      source.transferTargetsGroupTitle ||
      source.targetsGroupTitle ||
      source.transferGroupTitle ||
      source.groupTitle ||
      source.groupLabel ||
      ''
    ).trim();
    const noteValue = resolveInlineClientNote(info, displayFields);
    const list = stripInlineNoteDisplayFields(displayFields);
    const transferTargetFields = buildInlineTransferDisplayFields(transferTargets, {
      groupEnabled: groupEnabled,
      groupTitle: groupTitle
    });
    const mergedList = transferTargetFields.length
      ? mergeInlineDisplayFieldLists(transferTargetFields, stripInlineTransferDisplayFields(list, transferTargets))
      : dedupeInlineFieldValueEntries(list);
    if (mergedList.length) {
      return includeClientNoteDisplay
        ? appendInlineNoteDisplayField(dedupeInlineFieldValueEntries(mergedList), noteValue)
        : stripInlineNoteDisplayFields(dedupeInlineFieldValueEntries(mergedList));
    }
    return buildInlineInfoDisplayFields(info, flowKey);
  }

  function normalizeMethodEntry(entry){
    const raw = (entry && typeof entry === 'object') ? entry : {};
    const methodId = String(raw.id || raw.methodId || raw.method_id || '').trim();
    if (!methodId) return null;
    const sourceData = (raw.data && typeof raw.data === 'object') ? raw.data : raw;
    const data = Object.assign({}, sourceData || {});
    if (raw.active !== undefined && data.active === undefined) data.active = raw.active;
    if (raw.name && !data.name) data.name = raw.name;
    if (raw.order !== undefined && data.order === undefined) data.order = raw.order;
    if (raw.sortOrder !== undefined && data.order === undefined) data.order = raw.sortOrder;
    if (raw.sort_order !== undefined && data.order === undefined) data.order = raw.sort_order;
    if (raw.position !== undefined && data.order === undefined) data.order = raw.position;
    if (raw.rank !== undefined && data.order === undefined) data.order = raw.rank;
    if (raw.logoUrl && !data.logoUrl) data.logoUrl = raw.logoUrl;
    if (raw.requiresProofImage !== undefined && data.requiresProofImage === undefined) data.requiresProofImage = raw.requiresProofImage;
    if (raw.requireProofImage !== undefined && data.requiresProofImage === undefined) data.requiresProofImage = raw.requireProofImage;
    if (raw.proofRequired !== undefined && data.requiresProofImage === undefined) data.requiresProofImage = raw.proofRequired;
    if (raw.requiresProof !== undefined && data.requiresProofImage === undefined) data.requiresProofImage = raw.requiresProof;
    if (raw.needProofImage !== undefined && data.requiresProofImage === undefined) data.requiresProofImage = raw.needProofImage;
    if (raw.needProof !== undefined && data.requiresProofImage === undefined) data.requiresProofImage = raw.needProof;
    if (raw.proofButtonLabel !== undefined && data.proofButtonLabel === undefined) data.proofButtonLabel = raw.proofButtonLabel;
    if (raw.proofButtonText !== undefined && data.proofButtonLabel === undefined) data.proofButtonLabel = raw.proofButtonText;
    if (raw.proofLabel !== undefined && data.proofButtonLabel === undefined) data.proofButtonLabel = raw.proofLabel;
    if (raw.proofUploadLabel !== undefined && data.proofButtonLabel === undefined) data.proofButtonLabel = raw.proofUploadLabel;
    if (raw.uploadProofLabel !== undefined && data.proofButtonLabel === undefined) data.proofButtonLabel = raw.uploadProofLabel;
    if (raw.showLogoInModal !== undefined && data.showLogoInModal === undefined) data.showLogoInModal = raw.showLogoInModal;
    if (raw.modalLogoEnabled !== undefined && data.showLogoInModal === undefined) data.showLogoInModal = raw.modalLogoEnabled;
    if (raw.modalImageEnabled !== undefined && data.showLogoInModal === undefined) data.showLogoInModal = raw.modalImageEnabled;
    if (raw.modalNote !== undefined && data.modalNote === undefined) data.modalNote = raw.modalNote;
    if (raw.methodHint !== undefined && data.methodHint === undefined) data.methodHint = raw.methodHint;
    if (raw.windowDescription !== undefined && data.windowDescription === undefined) data.windowDescription = raw.windowDescription;
    data.name = String(data.name || methodId).trim();
    data.logoUrl = sanitizeInlineMediaUrl(data.logoUrl || data.imageUrl || data.iconUrl || '');
    data.showLogoInModal = parseInlineOptionalBoolean(data.showLogoInModal);
    data.requiresProofImage = resolveInlineMethodRequiresProof({ data: data });
    data.proofButtonLabel = resolveInlineMethodProofButtonLabel({ data: data });
    data.currencyCode = normalizeInlineCurrencyCode(data.currencyCode || data.currency || '');
    data.modalNote = resolveInlineMethodWindowNote({ data: data });
    if (data.currencyCode) data.currency = data.currencyCode;
    data.transferTargets = normalizeTransferTargets(data.transferTargets || raw.transferTargets || raw.targets || raw.accounts || raw.wallets || []);
    data.extraFields = getInlineMethodExtraFields({ data: data, extraFields: raw.extraFields, clientFields: raw.clientFields, formFields: raw.formFields, fields: raw.fields });
    const inlineAutoDeposit = parseInlineLooseBoolean(data.autoDeposit ?? data.auto_deposit ?? data.usdtAutoDeposit ?? data.binanceAutoDeposit);
    if (inlineAutoDeposit && !String(raw.modalNote ?? raw.modal_note ?? sourceData.modalNote ?? sourceData.modal_note ?? '').trim()) {
      data.modalNote = '';
    }
    data.displayFields = resolveInlineDisplayFields(
      Array.isArray(data.displayFields) ? data.displayFields : (Array.isArray(raw.displayFields) ? raw.displayFields : []),
      data.transferTargets,
      data.info || raw.info || {},
      data.flow || raw.flow || getCurrentInlineFlowKind(),
      { source: data, includeClientNoteDisplay: !inlineAutoDeposit }
    );
    if (data.active === undefined) data.active = raw.active !== false;
    if (!data.countryId && raw.countryId) data.countryId = raw.countryId;
    if (!data.countryName && raw.countryName) data.countryName = raw.countryName;
    return { id: methodId, data: data, __rootType: 'method' };
  }

  const __originalInlineBuildTransferDisplayFields = buildInlineTransferDisplayFields;
  buildInlineTransferDisplayFields = function(transferTargets, options){
    return __originalInlineBuildTransferDisplayFields(transferTargets, options);
  };

  const __originalInlineNormalizeMethodEntry = normalizeMethodEntry;
  normalizeMethodEntry = function(entry){
    const normalized = __originalInlineNormalizeMethodEntry(entry);
    if (!normalized || !normalized.data || typeof normalized.data !== 'object') return normalized;
    const raw = (entry && typeof entry === 'object') ? entry : {};
    normalized.data.extraFields = getInlineMethodExtraFields({
      data: normalized.data,
      extraFields: raw.extraFields,
      clientFields: raw.clientFields,
      formFields: raw.formFields,
      fields: raw.fields
    });
    normalized.data.displayFields = resolveInlineDisplayFields(
      getInlineRawDisplayFields(raw),
      Array.isArray(normalized.data.transferTargets) ? normalized.data.transferTargets : [],
      normalized.data.info || raw.info || {},
      normalized.data.flow || raw.flow || getCurrentInlineFlowKind(),
      { source: normalized.data }
    );
    const derivedRate = deriveInlineRatePerUsdFromAllowedCurrencies(normalized.data);
    if (derivedRate && !(Number(normalized.data.ratePerUSD) > 0)) normalized.data.ratePerUSD = derivedRate;
    return normalized;
  };

  function deriveInlineRatePerUsdFromAllowedCurrencies(source){
    try {
      const data = (source && typeof source === 'object') ? source : {};
      const currencyId = getInlineCurrencyEntryIdFromData(data);
      const currencyCode = normalizeInlineCurrencyCode(
        data.currencyCode ||
        data.currency ||
        data.currency_code ||
        data.payCurrency ||
        data.payCurrencyCode ||
        ''
      );
      const list = Array.isArray(data.allowedCurrencies)
        ? data.allowedCurrencies
        : (Array.isArray(data.currencies) ? data.currencies : []);
      if ((!currencyCode && !currencyId) || !list.length) return null;
      let match = null;
      if (currencyId) {
        match = list.find(function(entry){
          return getInlineCurrencyEntryIdFromData(entry) === currencyId;
        }) || null;
      }
      if (!match && currencyCode) {
        match = list.find(function(entry){
          return normalizeInlineCurrencyCode(entry && (entry.code || entry.currencyCode || entry.currency || '')) === currencyCode;
        }) || null;
      }
      match = match || list[0];
      const rate = Number(match && (
        match.ratePerUSD != null ? match.ratePerUSD :
        (match.rate != null ? match.rate :
        (match.value != null ? match.value : match.fx))
      ));
      return Number.isFinite(rate) && rate > 0 ? rate : null;
    } catch (_) {
      return null;
    }
  }

  if (typeof sanitizeFxPayload === 'function') {
    const __originalInlineSanitizeFxPayload = sanitizeFxPayload;
    sanitizeFxPayload = function(raw){
      const normalized = __originalInlineSanitizeFxPayload(raw);
      if (!normalized || typeof normalized !== 'object') return normalized;
      const source = (raw && typeof raw === 'object') ? raw : {};
      const transferTargets = Array.isArray(source.transferTargets) && source.transferTargets.length
        ? normalizeTransferTargets(source.transferTargets)
        : (Array.isArray(source.targets) && source.targets.length
          ? normalizeTransferTargets(source.targets)
          : (Array.isArray(source.accounts) && source.accounts.length
            ? normalizeTransferTargets(source.accounts)
            : (Array.isArray(source.wallets) && source.wallets.length
              ? normalizeTransferTargets(source.wallets)
              : null)))
        || (Array.isArray(normalized.transferTargets) ? normalized.transferTargets : []);
      normalized.transferTargets = transferTargets;
      const feePercent = Number(
        source.feePercent != null ? source.feePercent :
        (source.fee_percent != null ? source.fee_percent :
        (normalized.feePercent != null ? normalized.feePercent : normalized.fee_percent))
      );
      if (isFinite(feePercent) && feePercent > 0) normalized.feePercent = feePercent;
      if (source.visibleLevels !== undefined && normalized.visibleLevels === undefined) normalized.visibleLevels = source.visibleLevels;
      if (source.visible_levels !== undefined && normalized.visibleLevels === undefined) normalized.visibleLevels = source.visible_levels;
      normalized.extraFields = getInlineMethodExtraFields({
        data: normalized,
        extraFields: source.extraFields,
        clientFields: source.clientFields,
        formFields: source.formFields,
        fields: source.fields
      });
      normalized.displayFields = resolveInlineDisplayFields(
        getInlineRawDisplayFields(source),
        transferTargets,
        source.info || {},
        normalized.flow || source.flow || getCurrentInlineFlowKind(),
        { source: source }
      );
      const derivedRate = deriveInlineRatePerUsdFromAllowedCurrencies(source);
      if (derivedRate && !(Number(normalized.ratePerUSD) > 0)) normalized.ratePerUSD = derivedRate;
      return normalized;
    };
  }

  function methodNeedsFreshInlineFx(entry){
    const data = (entry && entry.data && typeof entry.data === 'object') ? entry.data : {};
    const currencyId = getInlineCurrencyEntryIdFromData(data);
    const currencyCode = normalizeInlineCurrencyCode(data.currencyCode || data.currency || '');
    if (!currencyCode) return false;
    const ratePerUSD = Number(data.ratePerUSD);
    const ratePerJOD = Number(data.ratePerJOD);
    const rateToJOD = Number(data.rateToJOD);
    const hasDirectRate = (Number.isFinite(ratePerUSD) && ratePerUSD > 0)
      || (Number.isFinite(ratePerJOD) && ratePerJOD > 0)
      || (Number.isFinite(rateToJOD) && rateToJOD > 0);
    if (hasDirectRate) return false;
    if ((currencyCode === 'USD' && (!currencyId || currencyId === '1')) || currencyCode === 'JOD') return false;
    return true;
  }

  const __originalNormalizeWorkerCountries = normalizeWorkerCountries;
  normalizeWorkerCountries = function(list){
    return __originalNormalizeWorkerCountries(list).map(function(entry){
      const payload = (entry && entry.data && typeof entry.data === 'object') ? Object.assign({}, entry.data) : {};
      if (payload.methodsMap && typeof payload.methodsMap === 'object') {
        const nextMap = {};
        Object.keys(payload.methodsMap).forEach(function(methodId){
          const normalized = normalizeMethodEntry({ id: methodId, data: payload.methodsMap[methodId] });
          if (normalized) nextMap[normalized.id] = normalized.data;
        });
        payload.methodsMap = nextMap;
      }
      if (Array.isArray(payload.methods)) {
        payload.methods = sortMethodEntries(payload.methods.map(normalizeMethodEntry).filter(Boolean)).map(function(item){
          return { id: item.id, data: item.data };
        });
      }
      return { id: entry.id, data: payload, __rootType: 'country' };
    });
  };

  function extractWorkerCountriesPayload(data, flowOverride){
    const payload = (data && typeof data === 'object') ? data : {};
    const flowKey = normalizeInlineFlow(flowOverride || getCurrentInlineFlowKind());
    if (Array.isArray(payload.countries)) return payload.countries;
    if (flowKey && Array.isArray(payload[flowKey])) return payload[flowKey];
    return [];
  }

  function extractRootMethodsPayload(data, flowOverride){
    const payload = (data && typeof data === 'object') ? data : {};
    const flowKey = normalizeInlineFlow(flowOverride || payload.flow || getCurrentInlineFlowKind());
    const buckets = [];
    function looksLikeCountryEntry(entry){
      const dataEntry = entry && typeof entry.data === 'object' ? entry.data : null;
      if (!dataEntry) return false;
      if (dataEntry.methodsMap && typeof dataEntry.methodsMap === 'object') return true;
      if (Array.isArray(dataEntry.methods)) return true;
      if (dataEntry.imageUrl && !dataEntry.logoUrl) return true;
      return false;
    }
    if (Array.isArray(payload.rootMethods)) buckets.push(payload.rootMethods);
    if (Array.isArray(payload.globalMethods)) buckets.push(payload.globalMethods);
    if (Array.isArray(payload.methods) && !payload.methods.some(looksLikeCountryEntry)) buckets.push(payload.methods);
    const seen = Object.create(null);
    const out = [];
    buckets.forEach(function(list){
      list.forEach(function(entry){
        const normalized = normalizeMethodEntry(entry);
        if (!normalized || !normalized.data || normalized.data.active === false) return;
        normalized.data.flow = normalizeInlineFlow(normalized.data.flow || flowKey);
        const key = String(normalized.id || '').trim().toUpperCase();
        if (!key || seen[key]) return;
        seen[key] = 1;
        out.push(normalized);
      });
    });
    return sortMethodEntries(out);
  }

  function resolveRootEntries(list){
    const raw = Array.isArray(list) ? list : [];
    const flowKey = getCurrentInlineFlowKind();
    if (!directRootMethods.length) {
      try {
        const flowFallbacks = (window.__depositInlineLastRootMethodsByFlow && typeof window.__depositInlineLastRootMethodsByFlow === 'object')
          ? window.__depositInlineLastRootMethodsByFlow
          : {};
        const flowPayloads = (window.__depositInlineLastCountriesPayloadByFlow && typeof window.__depositInlineLastCountriesPayloadByFlow === 'object')
          ? window.__depositInlineLastCountriesPayloadByFlow
          : {};
        const fallbackMethods = Array.isArray(flowFallbacks[flowKey])
          ? flowFallbacks[flowKey]
          : extractRootMethodsPayload(flowPayloads[flowKey] || {}, flowKey);
        const normalizedFallback = sortMethodEntries(fallbackMethods.map(normalizeMethodEntry).filter(Boolean));
        if (normalizedFallback.length) {
          directRootMethods = normalizedFallback.slice();
          hydrateFxCacheFromRootMethods(directRootMethods);
          debugCountriesLog('warn', 'Recovered root methods while rendering empty countries list', {
            countriesCount: raw.length,
            directMethodsCount: directRootMethods.length
          });
        }
      } catch (_) {}
    }
    const hasTaggedEntries = raw.some(function(entry){
      return entry && (entry.__rootType === 'country' || entry.__rootType === 'method');
    });
    // Admin drag-reorder assigns one shared order sequence across countries AND
    // root methods, so the landing grid interleaves them by it. Entries without a
    // positive order keep the legacy placement (countries first) via a stable sort.
    const sortRootEntriesByDisplayOrder = function(entries){
      return entries.slice().sort(function(a, b){
        const ao = Number(a && a.data && a.data.order);
        const bo = Number(b && b.data && b.data.order);
        const av = (isFinite(ao) && ao > 0) ? ao : Number.MAX_SAFE_INTEGER;
        const bv = (isFinite(bo) && bo > 0) ? bo : Number.MAX_SAFE_INTEGER;
        return av - bv;
      });
    };
    const normalizedCountries = raw.filter(function(entry){
      const entryFlow = normalizeInlineFlow(entry && entry.data && entry.data.flow || flowKey);
      return entryFlow === flowKey;
    }).map(function(entry){
      return Object.assign({}, entry, { __rootType: 'country' });
    });
    const normalizedMethods = directRootMethods.filter(function(entry){
      const entryFlow = normalizeInlineFlow(entry && entry.data && entry.data.flow || flowKey);
      return entryFlow === flowKey;
    }).map(function(entry){
      return Object.assign({}, entry, { __rootType: 'method' });
    });
    if (!hasTaggedEntries) return sortRootEntriesByDisplayOrder(normalizedCountries.concat(normalizedMethods));
    const taggedCountries = raw.filter(function(entry){
      return entry && entry.__rootType === 'country';
    });
    const taggedMethods = raw.filter(function(entry){
      return entry && entry.__rootType === 'method';
    });
    if (taggedMethods.length) return sortRootEntriesByDisplayOrder(taggedCountries.concat(taggedMethods));
    return sortRootEntriesByDisplayOrder(taggedCountries.concat(normalizedMethods));
  }

  function getRootEntryMeta(entry){
    if (!entry || entry.__rootType !== 'method') return '';
    return '';
  }

  function findInlineCountryEntry(countryId, listOverride){
    const safeCountryId = String(countryId || '').trim().toLowerCase();
    const list = Array.isArray(listOverride) ? listOverride : (Array.isArray(countries) ? countries : []);
    if (!safeCountryId || !list.length) return null;
    return list.find(function(entry){
      return String(entry && entry.id || '').trim().toLowerCase() === safeCountryId;
    }) || null;
  }

  function normalizeInlineCountryMethodsList(countryEntry){
    const entryData = (countryEntry && countryEntry.data && typeof countryEntry.data === 'object')
      ? countryEntry.data
      : {};
    let list = [];

    if (entryData.methodsMap && typeof entryData.methodsMap === 'object') {
      list = Object.keys(entryData.methodsMap).map(function(methodId){
        return normalizeMethodEntry({ id: methodId, data: entryData.methodsMap[methodId] });
      }).filter(Boolean);
    }

    if (!list.length && Array.isArray(entryData.methods)) {
      list = entryData.methods.map(function(methodEntry){
        return normalizeMethodEntry(methodEntry);
      }).filter(Boolean);
    }

    return sortMethodEntries(list).filter(function(entry){
      return entry && entry.data && entry.data.active !== false;
    });
  }

  function syncInlineCountryMethods(entry, methodsList){
    const target = (entry && entry.data && typeof entry.data === 'object') ? entry : null;
    const normalized = sortMethodEntries((Array.isArray(methodsList) ? methodsList : []).map(function(methodEntry){
      return normalizeMethodEntry(methodEntry);
    }).filter(Boolean));
    if (!target || !normalized.length) return normalized;

    const nextMethodsMap = {};
    normalized.forEach(function(methodEntry){
      nextMethodsMap[methodEntry.id] = methodEntry.data;
    });

    target.data.methodsMap = nextMethodsMap;
    target.data.methods = normalized.map(function(methodEntry){
      return { id: methodEntry.id, data: methodEntry.data };
    });
    return normalized;
  }

  function readInlineRecoveryMethodsForCountry(countryId, flowOverride){
    const safeCountryId = String(countryId || '').trim().toUpperCase();
    if (!safeCountryId) return [];
    try {
      const cacheKey = 'edaa:' + normalizeInlineFlow(flowOverride || getCurrentInlineFlowKind());
      const raw = localStorage.getItem(cacheKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      const methodsMapByCountry = (parsed && typeof parsed.methodsMapByCountry === 'object' && parsed.methodsMapByCountry)
        ? parsed.methodsMapByCountry
        : {};
      const countryMethodsMap = (methodsMapByCountry && typeof methodsMapByCountry[safeCountryId] === 'object')
        ? methodsMapByCountry[safeCountryId]
        : null;
      if (!countryMethodsMap) return [];
      return sortMethodEntries(Object.keys(countryMethodsMap).map(function(methodId){
        return normalizeMethodEntry({ id: methodId, data: countryMethodsMap[methodId] });
      }).filter(Boolean));
    } catch (_) {
      return [];
    }
  }

  async function resolveInlineCountryMethods(countryEntry){
    const safeCountryId = String(countryEntry && countryEntry.id || '').trim();
    if (!safeCountryId) return [];

    let resolved = normalizeInlineCountryMethodsList(countryEntry);
    if (resolved.length) {
      return syncInlineCountryMethods(countryEntry, resolved);
    }

    const cachedBundle = readDepositCountriesCacheBundle(getCurrentInlineFlowKind());
    const cachedCountryEntry = findInlineCountryEntry(safeCountryId, cachedBundle.countries);
    resolved = normalizeInlineCountryMethodsList(cachedCountryEntry);
    if (resolved.length) {
      return syncInlineCountryMethods(countryEntry, resolved);
    }

    resolved = readInlineRecoveryMethodsForCountry(safeCountryId, getCurrentInlineFlowKind());
    if (resolved.length) {
      return syncInlineCountryMethods(countryEntry, resolved);
    }

    if (countriesLoadedFromWorker) {
      try {
        const latestPayload = await loadCountriesFromAvailableWorkers({
          forceRefresh: false,
          preferCache: true,
          flow: getCurrentInlineFlowKind()
        });
        const latestCountries = Array.isArray(latestPayload && latestPayload.countries)
          ? latestPayload.countries
          : (Array.isArray(latestPayload) ? latestPayload : []);
        const latestCountryEntry = findInlineCountryEntry(safeCountryId, latestCountries);
        resolved = normalizeInlineCountryMethodsList(latestCountryEntry);
        if (resolved.length) {
          return syncInlineCountryMethods(countryEntry, resolved);
        }
      } catch (_) {}
    }

    return [];
  }

  function buildDepositTreeCard(item, kind){
    const safeKind = kind === 'method' ? 'method' : 'country';
    const title = String(item && item.data && item.data.name || item && item.name || item && item.id || '').trim();
    const imageUrl = sanitizeInlineMediaUrl(safeKind === 'method'
      ? (item && item.data && (item.data.logoUrl || item.data.imageUrl || item.data.iconUrl))
      : (item && item.data && item.data.imageUrl) || '');
    const meta = getRootEntryMeta(item);
    const hasImage = !!imageUrl;
    const iconClass = safeKind === 'method' ? 'fa-wallet' : 'fa-earth-asia';
    return ''
      + '<div class="catalog-card-media' + (hasImage ? '' : ' is-empty') + '">'
      + (hasImage
        ? ('<img src="' + zEscHtml(imageUrl) + '" alt="' + zEscHtml(title) + '">')
        : ('<div class="depositTreeThumbFallback"><i class="fa-solid ' + iconClass + '"></i></div>'))
      + '</div>'
      + '<h2 class="depositTreeTitle">' + zEscHtml(title) + '</h2>'
      + (meta ? ('<span class="offer-price">' + zEscHtml(meta) + '</span>') : '');
  }

  function openRootMethod(entry){
    currentCountry = null;
    methods = directRootMethods.slice();
    try {
      if (whereText) whereText.textContent = getCurrentInlineRootHeading();
    } catch (_) {}
    openInlineMethodPage(entry, 'root_method_card');
  }

  function markInlineMethodOpenDiagnostic(entry, source){
    try {
      const data = entry && entry.data && typeof entry.data === 'object' ? entry.data : {};
      const methodId = String(entry && entry.id || data.methodId || data.id || '').trim();
      const normalized = (typeof sanitizeFxPayload === 'function') ? sanitizeFxPayload(data || {}) : data;
      const summary = (typeof summarizeInlineFxCandidate === 'function')
        ? summarizeInlineFxCandidate(data || {}, normalized || {})
        : {};
      window.__depositInlineLastMethodOpenDiagnostic = {
        at: new Date().toISOString(),
        source: source || '',
        flow: getCurrentInlineFlowKind(),
        methodId: methodId,
        countryId: String(data.countryId || data.countryCode || (currentCountry && currentCountry.id) || '').trim(),
        methodName: String(data.name || data.title || '').trim(),
        summary: summary
      };
      if (typeof isInlineDiagnosticDebugEnabled === 'function' && isInlineDiagnosticDebugEnabled()) {
        console.warn('[DepositInline] method open diagnostic', window.__depositInlineLastMethodOpenDiagnostic);
      }
    } catch (_) {}
  }

  function getInlineMethodOpenHandler(){
    try {
      if (typeof openMethodBound === 'function') return openMethodBound;
    } catch (_) {}
    try {
      if (typeof openMethod === 'function') return openMethod;
    } catch (_) {}
    try {
      if (typeof window !== 'undefined' && typeof window.openMethod === 'function') return window.openMethod;
    } catch (_) {}
    return null;
  }

  function bindInlineMethodPageBackdropGuard(){
    try {
      if (window.__depositInlineMethodBackdropGuardBound__) return;
      window.__depositInlineMethodBackdropGuardBound__ = true;
      document.addEventListener('click', function(event){
        try {
          const target = event && event.target;
          if (!target) return;
          const modal = (typeof getInlineMethodModalEl === 'function')
            ? getInlineMethodModalEl()
            : (
                (typeof state !== 'undefined' && state && state.app && state.app.querySelector && state.app.querySelector('#methodModal')) ||
                document.querySelector('#depositInlineApp #methodModal') ||
                document.getElementById('methodModal')
              );
          if (!modal || target !== modal) return;
          if (!(modal.classList && modal.classList.contains('inline-method-page'))) return;
          if (typeof event.preventDefault === 'function') event.preventDefault();
          if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
          else if (typeof event.stopPropagation === 'function') event.stopPropagation();
        } catch (_) {}
      }, true);
    } catch (_) {}
  }

  function clearInlineMethodInitialFocus(modal){
    try {
      if (!modal || !modal.querySelectorAll) return;
      modal.querySelectorAll('[autofocus]').forEach(function(control){
        try { control.removeAttribute('autofocus'); } catch (_) {}
      });
      modal.querySelectorAll('.is-inline-invalid,.is-inline-shake,.is-invalid').forEach(function(control){
        try { control.classList.remove('is-inline-invalid', 'is-inline-shake', 'is-invalid'); } catch (_) {}
      });
      const active = document && document.activeElement ? document.activeElement : null;
      if (!active || active === document.body || !modal.contains(active)) return;
      const tag = String(active.tagName || '').toUpperCase();
      const isEditable = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || active.isContentEditable;
      if (isEditable && typeof active.blur === 'function') active.blur();
    } catch (_) {}
  }

  function bindInlineMethodInitialFocusGuard(){
    try {
      if (window.__depositInlineInitialFocusGuardBound__) return;
      window.__depositInlineInitialFocusGuardBound__ = true;
      document.addEventListener('focusin', function(event){
        try {
          const until = Number(window.__depositInlineSuppressInitialFocusUntil || 0);
          if (!until || Date.now() > until) return;
          const target = event && event.target;
          if (!target || !target.closest) return;
          const modal = target.closest('#depositInlineApp #methodModal.inline-method-page');
          if (!modal) return;
          const tag = String(target.tagName || '').toUpperCase();
          const isEditable = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
          if (!isEditable) return;
          if (typeof target.blur === 'function') target.blur();
          clearInlineMethodInitialFocus(modal);
        } catch (_) {}
      }, true);
    } catch (_) {}
  }

  function scheduleInlineMethodInitialFocusClear(modal){
    try {
      if (!modal) return;
      bindInlineMethodInitialFocusGuard();
      try { window.__depositInlineSuppressInitialFocusUntil = Date.now() + 900; } catch (_) {}
      clearInlineMethodInitialFocus(modal);
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(function(){ clearInlineMethodInitialFocus(modal); });
      }
      setTimeout(function(){ clearInlineMethodInitialFocus(modal); }, 0);
      setTimeout(function(){ clearInlineMethodInitialFocus(modal); }, 80);
      setTimeout(function(){ clearInlineMethodInitialFocus(modal); }, 250);
      setTimeout(function(){ clearInlineMethodInitialFocus(modal); }, 600);
    } catch (_) {}
  }

  function ensureInlineMethodModalVisible(){
    try {
      bindInlineMethodPageBackdropGuard();
      const modal = (typeof getInlineMethodModalEl === 'function')
        ? getInlineMethodModalEl()
        : (
            (typeof state !== 'undefined' && state && state.app && state.app.querySelector && state.app.querySelector('#methodModal')) ||
            document.querySelector('#depositInlineApp #methodModal') ||
            document.getElementById('methodModal')
          );
      if (!modal) return false;
      modal.classList.remove('hidden');
      modal.classList.add('open');
      modal.classList.add('inline-method-page');
      modal.setAttribute('data-inline-method-page', '1');
      modal.setAttribute('aria-hidden', 'false');
      modal.style.removeProperty('display');
      modal.style.removeProperty('opacity');
      modal.style.removeProperty('visibility');
      modal.style.removeProperty('pointer-events');
      try {
        if (modal.parentElement) {
          modal.parentElement.classList.add('method-modal-open');
          modal.parentElement.classList.remove('modal-open');
        }
      } catch (_) {}
      try {
        const closeButton = modal.querySelector ? modal.querySelector('#closeModal') : null;
        if (closeButton) closeButton.textContent = 'رجوع للطرق';
      } catch (_) {}
      try {
        const closeArrow = modal.querySelector ? modal.querySelector('.modal-x') : null;
        if (closeArrow) {
          const icon = closeArrow.querySelector ? closeArrow.querySelector('i') : null;
          if (icon && icon.classList) {
            icon.classList.remove('fa-xmark');
            icon.classList.add('fa-arrow-left');
          } else {
            closeArrow.innerHTML = '<i class="fa-solid fa-arrow-left" aria-hidden="true"></i>';
          }
          closeArrow.setAttribute('aria-label', 'رجوع للطرق');
          closeArrow.setAttribute('title', 'رجوع للطرق');
        }
      } catch (_) {}
      try { bindInlineMethodGlobalCopyFallback(); } catch (_) {}
      try { ensureInlineMethodInfoCopyButtons(typeof currentMethod !== 'undefined' ? currentMethod : null); } catch (_) {}
      scheduleInlineMethodInitialFocusClear(modal);
      try {
        if (typeof modal.scrollIntoView === 'function') {
          modal.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      } catch (_) {}
      return true;
    } catch (_) {
      return false;
    }
  }

  function openInlineMethodPage(entry, source){
    try { markInlineMethodOpenDiagnostic(entry, source || 'method_card'); } catch (_) {}
    const handler = getInlineMethodOpenHandler();
    if (handler) {
      try {
        const result = handler(entry);
        if (result && typeof result.catch === 'function') {
          result.then(function(){
            ensureInlineMethodModalVisible();
          }).catch(function(err){
            try { console.error('[DepositInline] failed to open method', err); } catch (_) {}
          });
        } else {
          ensureInlineMethodModalVisible();
        }
        return result;
      } catch (err) {
        try { console.error('[DepositInline] failed to open method', err); } catch (_) {}
      }
    }
    ensureInlineMethodModalVisible();
    return null;
  }

  // ---- Recharge codes (أكواد الشحن): a redeem card at the end of the deposit
  // options + an inline code-entry modal. Credits the wallet via mode=redeem-code. ----
  function rechargeEscHtml(value){
    return String(value == null ? '' : value).replace(/[&<>"']/g, function(ch){
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  }
  function getInlineStoreBrandName(){
    try {
      var b = window.__SITE_BRAND__;
      var n = b && (b.storeName || b.siteName || b.name);
      if (n && String(n).trim()) return String(n).trim();
    } catch (_) {}
    try {
      var r = window.__SITE_RUNTIME__ && window.__SITE_RUNTIME__.brand;
      if (r && r.storeName && String(r.storeName).trim()) return String(r.storeName).trim();
    } catch (_) {}
    return 'المتجر';
  }
  function inlineRechargeToast(message, variant){
    try { if (typeof showToast === 'function') { showToast(message, variant || 'info', 4200); return; } } catch (_) {}
    try { if (window && typeof window.showToast === 'function') { window.showToast(message, variant || 'info', 4200); return; } } catch (_) {}
  }
  // A successful redeem shows the full success-animation page (the same overlay
  // used by Binance auto-deposit), not a toast. Falls back to a success toast only
  // if the overlay helper isn't available.
  function showInlineRechargeSuccessPage(amount){
    var amt = Number(amount);
    var hasAmt = Number.isFinite(amt) && amt > 0;
    var fn = (typeof showWalletActivityOverlay === 'function')
      ? showWalletActivityOverlay
      : ((window && typeof window.showWalletActivityOverlay === 'function') ? window.showWalletActivityOverlay : null);
    if (fn) {
      try {
        fn({
          title: 'تم شحن رصيدك',
          bannerText: 'تم شحن رصيدك',
          message: 'تمت إضافة المبلغ إلى رصيدك بنجاح.',
          note: 'يمكنك مراجعة الحركة من سجل المحفظة.',
          amount: hasAmt ? amt : undefined,
          currency: 'USD',
          primaryLabel: 'المحفظة',
          secondaryLabel: 'الرئيسية'
        });
        return;
      } catch (_) {}
    }
    inlineRechargeToast(hasAmt ? ('تم شحن رصيدك: $' + amt.toFixed(2)) : 'تم شحن رصيدك بنجاح', 'success');
  }
  // Errors are surfaced via toast (the inline status line was removed).
  async function submitInlineRechargeCode(code){
    var workerBase = normalizeWorkerBase(WORKER) || normalizeWorkerBase(WORKER_DEFAULT) || normalizeWorkerBase(WORKER_BASE);
    if (!workerBase) { inlineRechargeToast('تعذّر الاتصال بالخادم.', 'error'); return { ok: false }; }
    var auth = readInlineDepositUploadSessionInfo();
    if (!auth.uid || !auth.sessionKey) { inlineRechargeToast('يرجى تسجيل الدخول من جديد.', 'error'); return { ok: false }; }
    try {
      var url = new URL(String(workerBase).replace(/\\/+$/, '') + '/');
      url.searchParams.set('mode', 'redeem-code');
      var res = await fetch(url.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-useruid': auth.uid, 'x-sessionkey': auth.sessionKey },
        body: JSON.stringify({ code: code })
      });
      var data = await res.json().catch(function(){ return {}; });
      if (res.ok && data && data.ok !== false) {
        var amount = Number(data.amount || 0);
        try {
          if (data.newBalance != null) {
            var nb = Number(data.newBalance);
            if (Number.isFinite(nb)) {
              if (typeof window.setHeaderBalanceAmount === 'function') window.setHeaderBalanceAmount(nb);
              if (typeof window.broadcastBalance === 'function') window.broadcastBalance(nb);
            }
          }
        } catch (_) {}
        showInlineRechargeSuccessPage(amount);
        return { ok: true, data: data };
      }
      var msg = (data && data.error) ? String(data.error) : 'تعذّر استبدال الكود.';
      inlineRechargeToast(msg, 'error');
      return { ok: false };
    } catch (e) {
      inlineRechargeToast('تعذّر الاتصال بالخادم. حاول لاحقاً.', 'error');
      return { ok: false };
    }
  }
  // The recharge card config ships inside the deposit-methods payload
  // (/deposit/countries -> data.rechargeCard). The deposit grid often renders
  // from the warm localStorage countries cache (which does NOT carry the full
  // payload), so we mirror rechargeCard into a dedicated per-flow store on every
  // server fetch and read it back here — otherwise the card shows defaults.
  function rememberInlineRechargeCardForFlow(flowKind, card){
    try {
      var fk = normalizeInlineFlow(flowKind || getCurrentInlineFlowKind());
      var obj = (card && typeof card === 'object') ? card : null;
      if (!window.__depositInlineRechargeCardByFlow || typeof window.__depositInlineRechargeCardByFlow !== 'object') {
        window.__depositInlineRechargeCardByFlow = {};
      }
      if (obj) window.__depositInlineRechargeCardByFlow[fk] = obj;
      try {
        var key = 'edaa:' + fk + ':rechargeCard:v1';
        if (obj) localStorage.setItem(key, JSON.stringify(obj));
      } catch (_) {}
    } catch (_) {}
  }
  function readRememberedInlineRechargeCardForFlow(flowKind){
    var fk;
    try { fk = normalizeInlineFlow(flowKind || getCurrentInlineFlowKind()); } catch (_) { fk = 'deposit'; }
    try {
      var g = window.__depositInlineRechargeCardByFlow;
      if (g && typeof g === 'object' && g[fk] && typeof g[fk] === 'object') return g[fk];
    } catch (_) {}
    try {
      var raw = localStorage.getItem('edaa:' + fk + ':rechargeCard:v1');
      if (raw) { var p = JSON.parse(raw); if (p && typeof p === 'object') return p; }
    } catch (_) {}
    return null;
  }
  function getInlineRechargeCardConfig(){
    var cfg = null;
    // PRIMARY: the recharge card ships WITH the deposit methods payload from the
    // server (same /deposit/countries response as the methods).
    try {
      var payloads = window.__depositInlineLastCountriesPayloadByFlow;
      var fk = (typeof getCurrentInlineFlowKind === 'function') ? getCurrentInlineFlowKind() : 'deposit';
      var dp = (payloads && typeof payloads === 'object') ? (payloads[fk] || payloads.deposit) : null;
      if (dp && dp.rechargeCard && typeof dp.rechargeCard === 'object') cfg = dp.rechargeCard;
    } catch (_) {}
    // Survives the warm localStorage countries-cache render (no full payload).
    try {
      if (!cfg) {
        var remembered = readRememberedInlineRechargeCardForFlow();
        if (remembered && typeof remembered === 'object') cfg = remembered;
      }
    } catch (_) {}
    // Fallback: brand settings (window.__SITE_BRAND__.rechargeCard).
    try {
      if (!cfg) {
        var b = window.__SITE_BRAND__ || {};
        if (b && b.rechargeCard && typeof b.rechargeCard === 'object') cfg = b.rechargeCard;
      }
    } catch (_) {}
    try {
      if (!cfg && window.__SITE_RUNTIME__ && window.__SITE_RUNTIME__.brand && window.__SITE_RUNTIME__.brand.rechargeCard && typeof window.__SITE_RUNTIME__.brand.rechargeCard === 'object') {
        cfg = window.__SITE_RUNTIME__.brand.rechargeCard;
      }
    } catch (_) {}
    cfg = cfg && typeof cfg === 'object' ? cfg : {};
    var storeName = getInlineStoreBrandName();
    var name = String(cfg.name || cfg.title || '').trim() || ('كود شحن ' + storeName);
    var imageUrl = String(cfg.imageUrl || cfg.image || cfg.icon || '').trim();
    var feePercent = Number(cfg.feePercent != null ? cfg.feePercent : cfg.fee);
    if (!isFinite(feePercent) || feePercent < 0) feePercent = 0;
    if (feePercent > 100) feePercent = 100;
    var enabled = cfg.enabled !== false;
    var description = String(cfg.description || cfg.desc || '').trim();
    var order = Number(cfg.order);
    if (!isFinite(order)) order = 0;
    return { name: name, description: description, imageUrl: imageUrl, feePercent: feePercent, enabled: enabled, order: order };
  }
  function getInlineRechargeAppEl(){
    try { if (grid && grid.closest) return grid.closest('#depositInlineApp'); } catch (_) {}
    try { return document.getElementById('depositInlineApp'); } catch (_) {}
    return null;
  }
  // Hide/show the deposit options (grid + search) reliably via inline !important so
  // the recharge page takes over the screen like a normal deposit method page.
  // (CSS-only hiding loses the specificity war against the grid's display:grid !important.)
  function setInlineRechargeOptionsHidden(hidden){
    try {
      var app = getInlineRechargeAppEl();
      var scope = app || (grid && grid.parentNode) || (typeof document !== 'undefined' ? document : null);
      var nodes = [];
      try { if (grid) nodes.push(grid); } catch (_) {}
      if (scope && scope.querySelectorAll) {
        ['#grid', '.categories', '.search-container', '.where', '#whereText'].forEach(function(sel){
          try { Array.prototype.forEach.call(scope.querySelectorAll(sel), function(el){ nodes.push(el); }); } catch (_) {}
        });
      }
      nodes.forEach(function(el){
        if (!el || !el.style) return;
        if (hidden) el.style.setProperty('display', 'none', 'important');
        else el.style.removeProperty('display');
      });
    } catch (_) {}
  }
  function closeInlineRechargeRedeemPage(){
    try {
      var app = getInlineRechargeAppEl();
      if (app && app.classList) app.classList.remove('recharge-page-open');
      var existing = document.getElementById('rechargeInlinePage');
      if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
      setInlineRechargeOptionsHidden(false);
    } catch (_) {}
  }
  window.closeInlineRechargeRedeemPage = closeInlineRechargeRedeemPage;
  window.addEventListener('hashchange', closeInlineRechargeRedeemPage);
  window.closeInlineRechargeRedeemPage = closeInlineRechargeRedeemPage;
  window.addEventListener('hashchange', closeInlineRechargeRedeemPage);
  // Recharge redeem is shown as an inline page (like the deposit method forms),
  // not a popup overlay: hide the options grid and render a full-width panel.
  function openInlineRechargeRedeemModal(){
    try {
      var app = getInlineRechargeAppEl();
      var host = app || (grid && grid.parentNode) || document.body;
      closeInlineRechargeRedeemPage();
      var c = getInlineRechargeCardConfig();
      var page = document.createElement('section');
      page.id = 'rechargeInlinePage';
      page.className = 'recharge-inline-page';
      page.setAttribute('role', 'form');
      var iconHtml = c.imageUrl
        ? ('<img src="' + rechargeEscHtml(c.imageUrl) + '" alt="" loading="lazy">')
        : '<i class="fa-solid fa-credit-card"></i>';
      var feeNote = c.feePercent > 0
        ? ('<p class="recharge-inline-fee">' + rechargeEscHtml('عمولة الاستبدال: ' + c.feePercent + '%') + '</p>')
        : '';
      page.innerHTML = ''
        + '<div class="recharge-inline-card">'
        +   '<div class="recharge-inline-head">'
        +     '<span class="recharge-inline-icon">' + iconHtml + '</span>'
        +     '<h2 class="recharge-inline-title">' + rechargeEscHtml(c.name) + '</h2>'
        +     '<p class="recharge-inline-sub">' + rechargeEscHtml(c.description) + '</p>'
        +   '</div>'
        +   feeNote
        +   '<label class="recharge-inline-label" for="rechargeRedeemInput">' + rechargeEscHtml('كود الشحن') + '</label>'
        +   '<input id="rechargeRedeemInput" type="text" autocomplete="off" spellcheck="false" placeholder="XXXX-XXXX-XXXX-XXXX" dir="ltr">'
        +   '<div class="recharge-inline-actions">'
        +     '<button id="rechargeRedeemSubmit" type="button" class="btn btn-primary">' + rechargeEscHtml('استبدال') + '</button>'
        +     '<button id="rechargeRedeemCancel" type="button" class="btn">' + rechargeEscHtml('إلغاء') + '</button>'
        +   '</div>'
        + '</div>';
      host.appendChild(page);
      if (app && app.classList) app.classList.add('recharge-page-open');
      setInlineRechargeOptionsHidden(true);
      var input = page.querySelector('#rechargeRedeemInput');
      var submitBtn = page.querySelector('#rechargeRedeemSubmit');
      var cancelBtn = page.querySelector('#rechargeRedeemCancel');
      if (cancelBtn) cancelBtn.addEventListener('click', closeInlineRechargeRedeemPage);
      if (backBtn) backBtn.addEventListener('click', closeInlineRechargeRedeemPage);
      async function doSubmit(){
        var code = String((input && input.value) || '').trim();
        if (!code) { inlineRechargeToast('أدخل كود الشحن.', 'error'); return; }
        submitBtn.disabled = true;
        var prev = submitBtn.innerHTML;
        submitBtn.innerHTML = '...';
        var result = await submitInlineRechargeCode(code);
        submitBtn.disabled = false;
        submitBtn.innerHTML = prev;
        if (result && result.ok) closeInlineRechargeRedeemPage();
      }
      if (submitBtn) submitBtn.addEventListener('click', doSubmit);
      if (input) input.addEventListener('keydown', function(ev){ if (ev && ev.key === 'Enter') { try { ev.preventDefault(); } catch (_) {} doSubmit(); } });
      try { if (input && input.focus) input.focus(); } catch (_) {}
    } catch (_) {}
  }
  function buildInlineRechargeRedeemCardInner(){
    var c = getInlineRechargeCardConfig();
    var media = c.imageUrl
      ? ('<div class="catalog-card-media"><img src="' + rechargeEscHtml(c.imageUrl) + '" alt="" loading="lazy"></div>')
      : '<div class="catalog-card-media is-empty"><div class="depositTreeThumbFallback"><i class="fa-solid fa-credit-card"></i></div></div>';
    return ''
      + media
      + '<h2 class="depositTreeTitle">' + rechargeEscHtml(c.name) + '</h2>'
  }
  function appendInlineRechargeRedeemCard(activeFlow){
    try {
      if (!grid) return;
      var flow = normalizeInlineFlow(activeFlow || getCurrentInlineFlowKind());
      if (flow !== 'deposit') return; // recharge codes credit the wallet => deposit flow only
      if (!getInlineRechargeCardConfig().enabled) return; // admin can hide the card
      if (grid.querySelector('[data-recharge-redeem-card="1"]')) return;
      var node = document.createElement('a');
      node.href = 'javascript:void(0)';
      node.className = 'card catalog-card depositTreeCard walletFlowCard rechargeRedeemCard';
      node.dataset.rechargeRedeemCard = '1';
      node.dataset.skipCardStates = '1';
      node.dataset.cardStateScope = 'wallet';
      node.setAttribute('role', 'button');
      node.setAttribute('tabindex', '0');
      node.innerHTML = buildInlineRechargeRedeemCardInner();
      node.addEventListener('click', function(ev){ try { ev.preventDefault(); ev.stopPropagation(); } catch (_) {} openInlineRechargeRedeemModal(); });
      node.addEventListener('keydown', function(ev){ if (!ev || (ev.key !== 'Enter' && ev.key !== ' ')) return; try { ev.preventDefault(); ev.stopPropagation(); } catch (_) {} openInlineRechargeRedeemModal(); });
      // Position by the admin-set order: ترتيب N puts the card at the Nth slot
      // among the option cards; 0/empty keeps it last.
      var rcOrder = Number(getInlineRechargeCardConfig().order);
      var optionCards = grid.querySelectorAll('.card.depositTreeCard:not([data-recharge-redeem-card="1"])');
      if (isFinite(rcOrder) && rcOrder > 0 && optionCards.length && rcOrder <= optionCards.length) {
        grid.insertBefore(node, optionCards[rcOrder - 1]);
      } else {
        grid.appendChild(node);
      }
    } catch (_) {}
  }

  renderCountries = function(list){
    if (!grid) {
      debugCountriesLog('error', 'Grid element not found while rendering countries');
      const showGridMissing = setInlineDepositNoResultsVisible(true);
      setCountriesRetryButtonVisible(showGridMissing, 'grid_missing');
      return;
    }
      const activeFlow = getCurrentInlineFlowKind();
      try {
        if (window.__depositInlineActiveFlow && normalizeInlineFlow(window.__depositInlineActiveFlow) !== activeFlow) {
          clearGrid();
          showNoResults(false);
          return;
        }
        grid.setAttribute('data-active-flow', activeFlow);
      } catch (_) {}
      const rootEntries = resolveRootEntries(list);
      try {
        debugCountriesLog('info', 'Rendering inline wallet root entries', {
          inputCountriesCount: Array.isArray(list) ? list.length : 0,
          directMethodsCount: directRootMethods.length,
          renderedRootEntriesCount: rootEntries.length
        });
      } catch (_) {}
      clearGrid();
    rootEntries.forEach(function(entry){
      const isMethod = entry && entry.__rootType === 'method';
      const node = document.createElement('a');
      node.href = 'javascript:void(0)';
      node.className = 'card catalog-card depositTreeCard walletFlowCard';
      node.dataset.skipCardStates = '1';
      node.dataset.cardStateScope = 'wallet';
      node.dataset.title = String(entry && entry.data && entry.data.name || '').trim();
      node.dataset.rootKind = isMethod ? 'method' : 'country';
      node.dataset.flow = activeFlow;
      if (!isMethod) node.dataset.countryHash = buildInlineCountryHash(entry.id);
      if (!isMethod) node.dataset.countryId = String(entry && entry.id || '').trim();
      if (isMethod) node.dataset.methodId = String(entry && entry.id || '').trim();
      node.setAttribute('role', 'button');
      node.setAttribute('tabindex', '0');
      node.innerHTML = buildDepositTreeCard(entry, isMethod ? 'method' : 'country');
      node.addEventListener('click', function(ev){
        try { ev.preventDefault(); ev.stopPropagation(); } catch (_) {}
        if (isMethod) {
          openRootMethod(entry);
          return;
        }
        navigateToCountry(entry);
      });
      node.addEventListener('keydown', function(ev){
        if (!ev || (ev.key !== 'Enter' && ev.key !== ' ')) return;
        try { ev.preventDefault(); ev.stopPropagation(); } catch (_) {}
        if (isMethod) {
          openRootMethod(entry);
          return;
        }
        navigateToCountry(entry);
      });
      grid.appendChild(node);
    });
    // Recharge-code redeem card sits at the end of the deposit options, but only
    // once the real server methods have loaded — so it appears WITH the methods,
    // not from page entry, and the normal loading state shows first.
    if (rootEntries.length) appendInlineRechargeRedeemCard(activeFlow);
    const rootEmpty = rootEntries.length === 0;
    const rootEmptyVisible = setInlineDepositNoResultsVisible(rootEmpty);
    if (!currentCountry) setCountriesRetryButtonVisible(rootEmptyVisible, rootEntries.length ? '' : 'countries_empty');
  };

  renderMethods = function(list){
    const activeFlow = getCurrentInlineFlowKind();
    clearGrid();
    (Array.isArray(list) ? list : []).forEach(function(entry){
      const node = document.createElement('a');
      node.href = 'javascript:void(0)';
      node.className = 'card catalog-card depositTreeCard walletFlowCard';
      node.dataset.skipCardStates = '1';
      node.dataset.cardStateScope = 'wallet';
      node.dataset.title = String(entry && entry.data && entry.data.name || '').trim();
      node.dataset.methodId = String(entry && entry.id || '').trim();
      node.dataset.flow = activeFlow;
      node.setAttribute('role', 'button');
      node.setAttribute('tabindex', '0');
      node.innerHTML = buildDepositTreeCard(Object.assign({}, entry, { __rootType: 'method' }), 'method');
      node.addEventListener('click', function(ev){
        try { ev.preventDefault(); ev.stopPropagation(); } catch (_) {}
        openInlineMethodPage(entry, 'country_method_card');
      });
      node.addEventListener('keydown', function(ev){
        if (!ev || (ev.key !== 'Enter' && ev.key !== ' ')) return;
        try { ev.preventDefault(); ev.stopPropagation(); } catch (_) {}
        openInlineMethodPage(entry, 'country_method_keyboard');
      });
      grid.appendChild(node);
    });
    setInlineDepositNoResultsVisible((Array.isArray(list) ? list.length : 0) === 0);
  };

  applySearch = function(){
    try {
      if (!currentCountry) resetInlineDepositSearchInput('root_apply_search', false);
      else prepareInlineDepositSearchInput();
    } catch (_) {}
    const q = String(((searchInput && searchInput.value) || '')).trim().toLowerCase();
    const list = currentCountry ? (Array.isArray(methods) ? methods : []) : resolveRootEntries(countries);
    const filtered = list.filter(function(entry){
      return String(entry && entry.data && entry.data.name || '').toLowerCase().includes(q);
    });
    currentCountry ? renderMethods(filtered) : renderCountries(filtered);
  };

  showRoot = function(){
    currentCountry = null;
    methods = [];
    try { resetInlineDepositSearchInput('show_root', true); } catch (_) {}
    if (whereText) whereText.textContent = getCurrentInlineRootHeading();
    if (backBtn) backBtn.style.display = 'none';
    renderCountries(countries);
  };

  const __originalClearDepositCountriesCache = clearDepositCountriesCache;
  function readDepositCountriesCacheBundle(flowOverride){
    const flowKind = normalizeInlineFlow(flowOverride || getCurrentInlineFlowKind());
    try {
      const raw = localStorage.getItem(getInlineCountriesCacheKeyFor(flowKind));
      if (!raw) return { countries: [], rootMethods: [] };
      const parsed = JSON.parse(raw);
      const list = Array.isArray(parsed && parsed.countries)
        ? parsed.countries
        : (Array.isArray(parsed) ? parsed : []);
      const bundle = {
        countries: normalizeWorkerCountries(list).filter(function(entry){
          const entryFlow = normalizeInlineFlow(entry && entry.data && entry.data.flow || flowKind);
          return entryFlow === flowKind;
        }).map(function(entry){
          if (entry && entry.data && typeof entry.data === 'object') entry.data.flow = flowKind;
          return entry;
        }),
        rootMethods: sortMethodEntries((Array.isArray(parsed && parsed.directRootMethods) ? parsed.directRootMethods : []).map(normalizeMethodEntry).filter(Boolean).filter(function(entry){
          const entryFlow = normalizeInlineFlow(entry && entry.data && entry.data.flow || flowKind);
          return entryFlow === flowKind;
        }).map(function(entry){
          if (entry && entry.data && typeof entry.data === 'object') entry.data.flow = flowKind;
          return entry;
        }))
      };
      if (bundle.rootMethods.some(methodNeedsFreshInlineFx)) {
        return { countries: [], rootMethods: [] };
      }
      return bundle;
    } catch (_) {
      return { countries: [], rootMethods: [] };
    }
  }

  clearDepositCountriesCache = function(flowOverride){
    const flowKind = normalizeInlineFlow(flowOverride || getCurrentInlineFlowKind());
    if (flowKind === getCurrentInlineFlowKind()) {
      directRootMethods = [];
    }
    try {
      localStorage.removeItem(getInlineCountriesCacheKeyFor(flowKind));
      localStorage.removeItem(getInlineCountriesCacheMetaKeyFor(flowKind));
      localStorage.removeItem('edaa:' + flowKind + ':countries:v1');
      localStorage.removeItem('edaa:' + flowKind + ':countries:meta:v1');
      localStorage.removeItem('edaa:' + flowKind + ':countries:v2');
      localStorage.removeItem('edaa:' + flowKind + ':countries:meta:v2');
    } catch (_) {}
    if (!flowOverride || flowKind === getCurrentInlineFlowKind()) {
      return __originalClearDepositCountriesCache();
    }
    return true;
  };

  saveDepositCountriesCache = function(list, base, flowOverride, rootMethodsOverride){
    const flowKind = normalizeInlineFlow(flowOverride || getCurrentInlineFlowKind());
    const normalized = normalizeWorkerCountries(list).map(function(entry){
      if (entry && entry.data && typeof entry.data === 'object') entry.data.flow = normalizeInlineFlow(entry.data.flow || flowKind);
      return entry;
    });
    const safeRootMethods = sortMethodEntries((Array.isArray(rootMethodsOverride) ? rootMethodsOverride : directRootMethods).map(normalizeMethodEntry).filter(Boolean).map(function(entry){
      if (entry && entry.data && typeof entry.data === 'object') entry.data.flow = normalizeInlineFlow(entry.data.flow || flowKind);
      return entry;
    }));
    try {
      localStorage.setItem(getInlineCountriesCacheKeyFor(flowKind), JSON.stringify({
        savedAt: Date.now(),
        countries: normalized,
        directRootMethods: safeRootMethods
      }));
      localStorage.setItem(getInlineCountriesCacheMetaKeyFor(flowKind), JSON.stringify({
        savedAt: Date.now(),
        base: normalizeWorkerBase(base) || ''
      }));
    } catch (_) {}
    if (flowKind === getCurrentInlineFlowKind()) {
      directRootMethods = safeRootMethods.slice();
    }
    hydrateFxCacheFromCountries(normalized);
    hydrateFxCacheFromRootMethods(safeRootMethods);
    return {
      countries: normalized,
      rootMethods: safeRootMethods
    };
  };

  readDepositCountriesCache = function(flowOverride){
    const flowKind = normalizeInlineFlow(flowOverride || getCurrentInlineFlowKind());
    const bundle = readDepositCountriesCacheBundle(flowKind);
    if (flowKind === getCurrentInlineFlowKind()) {
      directRootMethods = bundle.rootMethods.slice();
    }
    return bundle.countries;
  };

  function findInlineRootMethodEntry(methodId, listOverride){
    const safeMethodId = String(methodId || '').trim().toLowerCase();
    if (!safeMethodId) return null;
    const list = Array.isArray(listOverride) ? listOverride : directRootMethods;
    return (Array.isArray(list) ? list : []).find(function(entry){
      return String(entry && entry.id || '').trim().toLowerCase() === safeMethodId;
    }) || null;
  }

  const __originalInlineBuildFxCacheKey = typeof buildFxCacheKey === 'function' ? buildFxCacheKey : null;
  if (__originalInlineBuildFxCacheKey) {
    buildFxCacheKey = function(countryId, methodId){
      const normalizedCountryId = String(countryId || '').trim() || '__ROOT__';
      return __originalInlineBuildFxCacheKey(normalizedCountryId, methodId);
    };
  }

  function hydrateFxCacheFromRootMethods(list){
    (Array.isArray(list) ? list : []).forEach(function(entry){
      const safeMethodId = String(entry && entry.id || '').trim();
      if (!safeMethodId) return;
      const methodData = (entry && entry.data && typeof entry.data === 'object') ? entry.data : {};
      const fx = sanitizeFxPayload(methodData);
      if (!hasUsableFxPayload(fx)) return;
      const fxKey = buildFxCacheKey('', safeMethodId);
      if (fxKey) depositFxCache.set(fxKey, fx);
    });
  }

  async function getOptionalInlineIdToken(){
    try {
      return getUsableInlineStoredIdToken();
    } catch (_) {}
    return '';
  }

  async function fetchInlineFxFromWorker(countryId, methodId, flowOverride){
    const flowKind = normalizeInlineFlow(flowOverride || getCurrentInlineFlowKind());
    const workerBase = normalizeWorkerBase(WORKER) || normalizeWorkerBase(WORKER_DEFAULT) || normalizeWorkerBase(WORKER_BASE);
    if (!workerBase) throw new Error('worker_base_missing');
    const requestUrl = new URL(workerBase + '/' + getInlineFlowPathFor(flowKind) + '/fx');
    if (countryId) requestUrl.searchParams.set('countryId', String(countryId || '').trim());
    requestUrl.searchParams.set('methodId', String(methodId || '').trim());
    const headers = {};
    const idToken = await getOptionalInlineIdToken();
    if (idToken) headers.Authorization = 'Bearer ' + idToken;
    const res = await fetch(requestUrl.toString(), {
      method: 'GET',
      headers: headers
    });
    const data = await res.json().catch(function(){ return {}; });
    if (!res.ok || !data || data.success === false) {
      throw new Error((data && (data.error || data.message)) ? (data.error || data.message) : ('worker_fx_failed_status_' + res.status));
    }
    return data;
  }

  function summarizeInlineFxCandidate(raw, normalized){
    const source = (raw && typeof raw === 'object') ? raw : {};
    const data = (normalized && typeof normalized === 'object') ? normalized : {};
    const currencyCode = normalizeInlineCurrencyCode(
      data.currencyCode ||
      data.currency ||
      source.currencyCode ||
      source.currency ||
      ''
    );
    const directRate = Number(
      data.ratePerUSD ??
      data.ratePerJOD ??
      data.rateToJOD ??
      data.usdPerJOD ??
      source.ratePerUSD ??
      source.ratePerJOD ??
      source.rateToJOD ??
      source.usdPerJOD
    );
    const derivedAllowedRate = deriveInlineRatePerUsdFromAllowedCurrencies(data) || deriveInlineRatePerUsdFromAllowedCurrencies(source);
    const allowedCurrencies = Array.isArray(data.allowedCurrencies)
      ? data.allowedCurrencies
      : (Array.isArray(source.allowedCurrencies) ? source.allowedCurrencies : []);
    const transferTargets = Array.isArray(data.transferTargets)
      ? data.transferTargets
      : (Array.isArray(source.transferTargets) ? source.transferTargets : []);
    const displayFields = Array.isArray(data.displayFields)
      ? data.displayFields
      : (Array.isArray(source.displayFields) ? source.displayFields : []);
    const extraFields = Array.isArray(data.extraFields)
      ? data.extraFields
      : (Array.isArray(source.extraFields) ? source.extraFields : []);
    const missing = [];
    if (!currencyCode) missing.push('currencyCode');
    if (!(Number.isFinite(directRate) && directRate > 0) && !(derivedAllowedRate > 0)) missing.push('ratePerUSD/rate');
    if (!transferTargets.length && !displayFields.length) missing.push('transferTargets/displayFields');
    return {
      usable: (typeof hasUsableFxPayload === 'function') ? hasUsableFxPayload(data) : false,
      missing: missing,
      currencyCode: currencyCode || '',
      ratePerUSD: Number.isFinite(Number(data.ratePerUSD)) ? Number(data.ratePerUSD) : null,
      derivedAllowedRate: derivedAllowedRate || null,
      allowedCurrenciesCount: allowedCurrencies.length,
      transferTargetsCount: transferTargets.length,
      displayFieldsCount: displayFields.length,
      extraFieldsCount: extraFields.length,
      hasModalNote: !!String(data.modalNote || source.modalNote || '').trim(),
      normalizedKeys: Object.keys(data).sort(),
      rawKeys: Object.keys(source).sort()
    };
  }

  function logInlineFxDiagnostic(stage, details){
    try {
      const payload = Object.assign({
        flow: getCurrentInlineFlowKind(),
        stage: stage
      }, details || {});
      if (typeof window !== 'undefined' && window) {
        window.__depositInlineLastFxDiagnostic = Object.assign({ at: new Date().toISOString() }, payload);
      }
      if (typeof debugCountriesLog === 'function') {
        debugCountriesLog('warn', 'FX fallback diagnostic', payload);
      }
      console.warn('[DepositInline] FX fallback diagnostic', payload);
    } catch (_) {}
  }

  const __originalInlineFetchFx = typeof fetchFx === 'function' ? fetchFx : null;
  if (__originalInlineFetchFx) {
    fetchFx = async function(countryId, methodId, methodData){
      const fxKey = buildFxCacheKey(countryId, methodId);
      const fromMethodData = sanitizeFxPayload(methodData || {});
      if (hasUsableFxPayload(fromMethodData)) {
        if (fxKey) depositFxCache.set(fxKey, fromMethodData);
        return fromMethodData;
      }
      logInlineFxDiagnostic('methodData_unusable_before_fx_request', {
        countryId: String(countryId || '').trim(),
        methodId: String(methodId || '').trim(),
        source: summarizeInlineFxCandidate(methodData || {}, fromMethodData)
      });

      const normalizedCountryId = String(countryId || '').trim();
      if (!normalizedCountryId) {
        const liveRootEntry = findInlineRootMethodEntry(methodId);
        const liveRootFx = sanitizeFxPayload(liveRootEntry && liveRootEntry.data || {});
        if (hasUsableFxPayload(liveRootFx)) {
          if (fxKey) depositFxCache.set(fxKey, liveRootFx);
          return liveRootFx;
        }
        logInlineFxDiagnostic('live_root_method_unusable', {
          countryId: '',
          methodId: String(methodId || '').trim(),
          found: !!liveRootEntry,
          source: summarizeInlineFxCandidate(liveRootEntry && liveRootEntry.data || {}, liveRootFx)
        });

        const cachedBundle = readDepositCountriesCacheBundle(getCurrentInlineFlowKind());
        const cachedRootEntry = findInlineRootMethodEntry(methodId, cachedBundle.rootMethods);
        const cachedRootFx = sanitizeFxPayload(cachedRootEntry && cachedRootEntry.data || {});
        if (hasUsableFxPayload(cachedRootFx)) {
          if (fxKey) depositFxCache.set(fxKey, cachedRootFx);
          return cachedRootFx;
        }
        logInlineFxDiagnostic('cached_root_method_unusable', {
          countryId: '',
          methodId: String(methodId || '').trim(),
          found: !!cachedRootEntry,
          source: summarizeInlineFxCandidate(cachedRootEntry && cachedRootEntry.data || {}, cachedRootFx)
        });
      }

      try {
        logInlineFxDiagnostic('requesting_worker_fx', {
          countryId: String(countryId || '').trim(),
          methodId: String(methodId || '').trim(),
          reason: 'local_fx_payload_not_usable'
        });
        const resolvedFx = await fetchInlineFxFromWorker(countryId, methodId, getCurrentInlineFlowKind());
        const normalizedFx = sanitizeFxPayload(resolvedFx || {});
        if (hasUsableFxPayload(normalizedFx)) {
          if (fxKey) depositFxCache.set(fxKey, normalizedFx);
          return normalizedFx;
        }
        logInlineFxDiagnostic('worker_fx_unusable_response', {
          countryId: String(countryId || '').trim(),
          methodId: String(methodId || '').trim(),
          source: summarizeInlineFxCandidate(resolvedFx || {}, normalizedFx)
        });
      } catch (err) {
        logInlineFxDiagnostic('worker_fx_failed', {
          countryId: String(countryId || '').trim(),
          methodId: String(methodId || '').trim(),
          error: err && err.message ? err.message : String(err || '')
        });
      }

      if (__originalInlineFetchFx) {
        const resolvedFx = await __originalInlineFetchFx(countryId, methodId, methodData);
        const normalizedFx = sanitizeFxPayload(resolvedFx || {});
        if (hasUsableFxPayload(normalizedFx)) {
          if (fxKey) depositFxCache.set(fxKey, normalizedFx);
          return normalizedFx;
        }
        logInlineFxDiagnostic('original_fetch_fx_unusable_response', {
          countryId: String(countryId || '').trim(),
          methodId: String(methodId || '').trim(),
          source: summarizeInlineFxCandidate(resolvedFx || {}, normalizedFx)
        });
        return resolvedFx;
      }
      throw new Error('worker_fx_failed');
    };
  }

  async function runCountriesRequestAttempt(url, attemptIndex, flowOverride){
    debugCountriesLog('info', 'Sending countries request', { url: url, attempt: attemptIndex });
    const controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    const timer = controller ? setTimeout(function(){
      try { controller.abort(); } catch (_) {}
    }, INLINE_COUNTRIES_REQUEST_TIMEOUT_MS) : null;
    const headers = {};
    const idToken = await getOptionalInlineIdToken();
    if (idToken) headers.Authorization = 'Bearer ' + idToken;
    return fetch(url, {
      method: 'GET',
      headers: headers,
      signal: controller ? controller.signal : undefined
    }).then(async function(res){
      const data = await res.json().catch(function(){ return {}; });
      if (!res.ok || !(data && data.success === true)) {
        throw new Error((data && data.error) ? data.error : ('worker_countries_failed_status_' + res.status));
      }
      const flowKind = normalizeInlineFlow(flowOverride || data.flow || getCurrentInlineFlowKind());
      const normalizedCountries = normalizeWorkerCountries(extractWorkerCountriesPayload(data, flowKind)).map(function(entry){
        if (entry && entry.data && typeof entry.data === 'object') entry.data.flow = normalizeInlineFlow(entry.data.flow || flowKind);
        return entry;
      });
      const rootMethods = extractRootMethodsPayload(data, flowKind);
      try {
        window.__depositInlineLastCountriesPayloadByFlow = window.__depositInlineLastCountriesPayloadByFlow || {};
        window.__depositInlineLastRootMethodsByFlow = window.__depositInlineLastRootMethodsByFlow || {};
        window.__depositInlineLastCountriesPayloadByFlow[flowKind] = data;
        window.__depositInlineLastRootMethodsByFlow[flowKind] = rootMethods.slice();
        try { rememberInlineRechargeCardForFlow(flowKind, data && data.rechargeCard); } catch (_) {}
        if (flowKind === getCurrentInlineFlowKind()) {
          window.__depositInlineLastCountriesPayload = data;
          window.__depositInlineLastRootMethods = rootMethods.slice();
          directRootMethods = rootMethods.slice();
          hydrateFxCacheFromRootMethods(directRootMethods);
        }
        debugCountriesLog('info', 'Extracted root payment methods from countries payload', {
          countriesCount: normalizedCountries.length,
          directMethodsCount: rootMethods.length,
          payloadKeys: Object.keys(data || {}).sort()
        });
      } catch (_) {}
      return {
        attemptIndex: attemptIndex,
        normalizedCountries: normalizedCountries,
        rootMethods: rootMethods
      };
    }).catch(function(err){
      if (err && err.name === 'AbortError') {
        throw new Error('worker_countries_timeout');
      }
      throw err;
    }).finally(function(){
      if (timer) clearTimeout(timer);
    });
  }

  function firstSuccessfulCountriesAttempt(tasks){
    return new Promise(function(resolve, reject){
      if (!Array.isArray(tasks) || !tasks.length) {
        reject(new Error('worker_countries_failed'));
        return;
      }
      let pending = tasks.length;
      let lastError = null;
      tasks.forEach(function(task){
        Promise.resolve().then(task).then(resolve).catch(function(err){
          lastError = err;
          pending -= 1;
          if (!pending) reject(lastError || new Error('worker_countries_failed'));
        });
      });
    });
  }

  loadCountriesFromWorker = async function(base, flowOverride){
    const flowKind = normalizeInlineFlow(flowOverride || getCurrentInlineFlowKind());
    const workerBase = normalizeWorkerBase(base || WORKER);
    if (!workerBase) {
      countriesLoadDebugState.lastError = 'worker_base_missing';
      debugCountriesLog('error', 'Worker base is missing', { base: base });
      throw new Error('worker_base_missing');
    }
    const url = workerBase + '/' + getInlineFlowPathFor(flowKind) + '/countries';
    countriesLoadDebugState.requestStarted = true;
    countriesLoadDebugState.lastRequestUrl = url;
    try {
      const winner = await runCountriesRequestAttempt(url, 1, flowKind);
      countriesLoadDebugState.lastSource = 'worker';
      debugCountriesLog('info', 'Countries request succeeded', {
        url: url,
        attempt: winner.attemptIndex,
        countriesCount: winner.normalizedCountries.length,
        directMethodsCount: winner.rootMethods.length,
        flow: flowKind
      });
      return {
        countries: winner.normalizedCountries,
        rootMethods: winner.rootMethods,
        flow: flowKind,
        base: workerBase
      };
    } catch (err) {
      countriesLoadDebugState.lastError = (err && err.message) ? err.message : 'worker_countries_failed';
      debugCountriesLog('error', 'Countries request responded with invalid payload', {
        url: url,
        error: countriesLoadDebugState.lastError,
        flow: flowKind
      });
      throw err;
    }
  };

  loadCountriesFromAvailableWorkers = async function(opts){
    const forceRefresh = opts && opts.forceRefresh === true;
    const preferCache = !opts || opts.preferCache !== false;
    const flowKind = normalizeInlineFlow(opts && opts.flow || getCurrentInlineFlowKind());
    syncInlineCountriesViewerScope();

    if (!forceRefresh && preferCache) {
      const cachedBundle = readDepositCountriesCacheBundle(flowKind);
      if (cachedBundle.countries.length || cachedBundle.rootMethods.length) {
        if (flowKind === getCurrentInlineFlowKind()) {
          directRootMethods = cachedBundle.rootMethods.slice();
        }
        debugCountriesLog('info', 'Using countries cache', {
          count: cachedBundle.countries.length,
          directMethodsCount: cachedBundle.rootMethods.length,
          flow: flowKind
        });
        hydrateFxCacheFromCountries(cachedBundle.countries);
        hydrateFxCacheFromRootMethods(cachedBundle.rootMethods);
        return cachedBundle;
      }
    }

    const tried = new Set();
    const bases = [WORKER, WORKER_DEFAULT]
      .map(function(base){ return normalizeWorkerBase(base); })
      .filter(function(base){
        if (!base || tried.has(base)) return false;
        tried.add(base);
        return true;
      });

    let lastErr = null;
    debugCountriesLog('info', 'Trying worker bases for countries', { bases: bases, flow: flowKind });
    for (const base of bases) {
      try {
        debugCountriesLog('info', 'Attempting countries request from base', { base: base, flow: flowKind });
        const payload = await loadCountriesFromWorker(base, flowKind);
        return saveDepositCountriesCache(payload.countries, base, flowKind, payload.rootMethods);
      } catch (err) {
        lastErr = err;
        debugCountriesLog('warn', 'Worker base failed while loading countries', {
          base: base,
          flow: flowKind,
          error: (err && err.message) ? err.message : String(err || 'unknown_error')
        });
      }
    }

    if (!forceRefresh && preferCache) {
      const cachedBundle = readDepositCountriesCacheBundle(flowKind);
      if (cachedBundle.countries.length || cachedBundle.rootMethods.length) {
        if (flowKind === getCurrentInlineFlowKind()) {
          directRootMethods = cachedBundle.rootMethods.slice();
        }
        debugCountriesLog('warn', 'All worker bases failed, fallback to cached countries', {
          count: cachedBundle.countries.length,
          directMethodsCount: cachedBundle.rootMethods.length,
          flow: flowKind
        });
        hydrateFxCacheFromCountries(cachedBundle.countries);
        hydrateFxCacheFromRootMethods(cachedBundle.rootMethods);
        return cachedBundle;
      }
    }

    if (flowKind === getCurrentInlineFlowKind()) {
      directRootMethods = [];
    }
    debugCountriesLog('error', 'All worker bases failed and cache unavailable', {
      error: (lastErr && lastErr.message) ? lastErr.message : 'worker_countries_failed',
      flow: flowKind
    });
    throw lastErr || new Error('worker_countries_failed');
  };

  function hasInlineRootEntries(){
    return !!((Array.isArray(countries) ? countries.length : 0) || directRootMethods.length);
  }

  function hasRenderedInlineRootEntries(app){
    try {
      const host = app && app.querySelector ? app : state.app;
      if (!host || !host.querySelector) return false;
      const grid = host.querySelector('#grid');
      if (!grid) return false;
      if (grid.getAttribute('data-flow-loading')) return false;
      return !!grid.querySelector('.card');
    } catch (_) {
      return false;
    }
  }

  function isInlineWalletUiPending(app){
    try {
      if (window.__INLINE_WALLET_ROUTE_PENDING__ === true) return true;
    } catch (_) {}
    try {
      if (document.documentElement && document.documentElement.classList.contains('inline-wallet-route-pending')) return true;
      if (document.body && document.body.classList.contains('inline-wallet-route-pending')) return true;
    } catch (_) {}
    try {
      const host = app && app.querySelector ? app : state.app;
      if (host && host.style && host.style.visibility === 'hidden') return true;
      const container = host && host.parentNode && host.parentNode.id === 'depositInlineContainer'
        ? host.parentNode
        : null;
      if (container && container.style && container.style.visibility === 'hidden') return true;
      const grid = host && host.querySelector ? host.querySelector('#grid') : null;
      if (grid && grid.getAttribute && grid.getAttribute('data-flow-loading')) return true;
    } catch (_) {}
    return false;
  }

  function shouldRefreshInlineCountriesOnShow(flow, app){
    if (hasInlineRootEntries()) return false;
    if (isInlineWalletUiPending(app)) return true;
    return !hasRenderedInlineRootEntries(app);
  }

  window.__depositInlinePrepareFlowSwitch = function(nextFlow){
    const flowKind = normalizeInlineFlow(nextFlow || getCurrentInlineFlowKind());
    try { debugCountriesLog('info', 'Preparing flow switch state', { flow: flowKind }); } catch (_) {}
    try { window.__depositInlineActiveFlow = flowKind; } catch (_) {}
    currentCountry = null;
    countries = [];
    methods = [];
    directRootMethods = [];
    try { resetInlineDepositSearchInput('flow_switch', true); } catch (_) {}
    try { pendingRoute = null; } catch (_) {}
    try { countriesLoadedFromWorker = false; } catch (_) {}
    try { depositFxCache.clear(); } catch (_) {}
    try {
      if (whereText) whereText.textContent = 'خيارات الإيداع المتاحة';
    } catch (_) {}
    try { if (backBtn) backBtn.style.display = 'none'; } catch (_) {}
    try { clearGrid(); } catch (_) {}
    try {
      if (grid && grid.setAttribute) grid.setAttribute('data-active-flow', flowKind);
    } catch (_) {}
    try { showNoResults(false); } catch (_) {}
    try { setCountriesRetryButtonVisible(false, ''); } catch (_) {}
    try {
      if (typeof window.__setInlineWalletRoutePending === 'function') window.__setInlineWalletRoutePending(true);
    } catch (_) {}
    return true;
  };

  window.__depositInlineRefreshCountries = async function(opts){
    const options = (opts && typeof opts === 'object') ? opts : {};
    const forceRefresh = options.forceRefresh === true;
    const reason = String(options.reason || '').trim();
    const flowKind = normalizeInlineFlow(options.flow || getCurrentInlineFlowKind());
    const now = Date.now();
    const flowPromise = inlineCountriesRefreshPromiseByFlow[flowKind];
    if (flowPromise) {
      debugCountriesLog('info', 'Reusing in-flight countries refresh', {
        reason: reason || 'deduped',
        forceRefresh: forceRefresh,
        flow: flowKind
      });
      return flowPromise;
    }
    if (!forceRefresh && lastInlineCountriesRefreshAtByFlow[flowKind] > 0 && (now - lastInlineCountriesRefreshAtByFlow[flowKind]) < INLINE_COUNTRIES_REFRESH_DEDUPE_MS) {
      debugCountriesLog('info', 'Skipping duplicate countries refresh', {
        reason: reason || 'cooldown',
        ageMs: now - lastInlineCountriesRefreshAtByFlow[flowKind],
        flow: flowKind
      });
      return hasInlineRootEntries();
    }
    setInlineCountriesGlobalLoading(true);
    try { setInlineDepositNoResultsVisible(false); } catch (_) {}
    inlineCountriesRefreshPromiseByFlow[flowKind] = Promise.resolve().then(async function(){
      debugCountriesLog('info', 'Guarded countries refresh requested', {
        reason: reason || 'manual',
        forceRefresh: forceRefresh,
        flow: flowKind
      });
      setCountriesRetryButtonVisible(false, '');
      try {
        clearDepositCountriesCache(flowKind);
        depositFxCache.clear();
        countriesLoadedFromWorker = false;
        const freshPayload = await loadCountriesFromAvailableWorkers({
          forceRefresh: true,
          preferCache: false,
          flow: flowKind
        });
        const freshCountries = Array.isArray(freshPayload && freshPayload.countries) ? freshPayload.countries : [];
        const freshRootMethods = Array.isArray(freshPayload && freshPayload.rootMethods) ? freshPayload.rootMethods : [];
        if (flowKind !== getCurrentInlineFlowKind()) {
          debugCountriesLog('warn', 'Discarding stale countries response for inactive flow', {
            requestedFlow: flowKind,
            activeFlow: getCurrentInlineFlowKind(),
            countriesCount: freshCountries.length,
            directMethodsCount: freshRootMethods.length
          });
          return false;
        }
        countries = freshCountries;
        directRootMethods = freshRootMethods.slice();
        countriesLoadedFromWorker = true;
        hydrateFxCacheFromCountries(countries);
        hydrateFxCacheFromRootMethods(directRootMethods);
        lastInlineCountriesRefreshAtByFlow[flowKind] = Date.now();
        debugCountriesLog('info', 'Guarded countries refresh completed', {
          count: countries.length,
          directMethodsCount: directRootMethods.length,
          flow: flowKind
        });
        if (!currentCountry) {
          try { resetInlineDepositSearchInput('refresh_completed', false); } catch (_) {}
        }
        try { applyRoute(true); } catch(_){ }
        try { applySearch(); } catch(_){ }
        if (!currentCountry) {
          setCountriesRetryButtonVisible(!hasInlineRootEntries(), hasInlineRootEntries() ? '' : 'manual_refresh_empty');
        }
        return hasInlineRootEntries();
      } catch (err) {
        countriesLoadDebugState.lastError = (err && err.message) ? err.message : String(err || 'manual_refresh_failed');
        debugCountriesLog('error', 'Guarded countries refresh failed', {
          reason: reason || 'manual',
          error: countriesLoadDebugState.lastError
        });
        setCountriesRetryButtonVisible(true, countriesLoadDebugState.lastError);
        depositInlineLog('warn', 'deposit refresh countries failed', err);
        return false;
      }
    }).finally(function(){
      inlineCountriesRefreshPromiseByFlow[flowKind] = null;
      const stillLoading = Object.keys(inlineCountriesRefreshPromiseByFlow).some(function(key){
        return !!inlineCountriesRefreshPromiseByFlow[key];
      });
      if (!stillLoading) setInlineCountriesGlobalLoading(false);
    });
    return inlineCountriesRefreshPromiseByFlow[flowKind];
  };

  window.__depositInlineRetryCountries = async function(){
    debugCountriesLog('info', 'Retry countries helper called');
    return window.__depositInlineRefreshCountries({
      forceRefresh: true,
      reason: 'retry_helper'
    });
  };

  window.__depositInlineApplyRoute = function(fromPop){
    try {
      applyRoute(fromPop === true);
      return true;
    } catch (_) {
      return false;
    }
  };

  if (typeof watchCountries === 'function') {
    const __originalInlineWatchCountries = watchCountries;
    watchCountries = function(){
      try { debugCountriesLog('info', 'Patched watchCountries invoked'); } catch (_) {}
      if (!grid) {
        return __originalInlineWatchCountries();
      }
      try {
        cardSkeleton();
        setCountriesRetryButtonVisible(false, '');
      } catch (_) {}
      Promise.resolve().then(async function(){
        if (typeof window.__depositInlineRefreshCountries === 'function') {
          const ok = await window.__depositInlineRefreshCountries({
            forceRefresh: true,
            reason: 'patched_watch_countries',
            flow: getCurrentInlineFlowKind()
          });
          if (ok) return;
        }
        return __originalInlineWatchCountries();
      }).catch(function(err){
        try { debugCountriesLog('error', 'Patched watchCountries failed', { error: err && err.message ? err.message : String(err || '') }); } catch (_) {}
        try { return __originalInlineWatchCountries(); } catch (_) {}
      });
      return function(){};
    };
  }

  if (typeof enterCountry === 'function') {
    const __originalInlineEnterCountry = enterCountry;
    enterCountry = async function(c, fromHistory){
      const countryEntry = (c && typeof c === 'object') ? c : null;
      if (!countryEntry) return __originalInlineEnterCountry(c, fromHistory);

      try { currentCountry = countryEntry; } catch (_) {}
      try { methods = []; } catch (_) {}
      try {
        if (whereText) {
          whereText.textContent = 'طرق الدفع - ' + String(countryEntry && countryEntry.data && countryEntry.data.name || countryEntry && countryEntry.name || countryEntry && countryEntry.id || '').trim();
        }
      } catch (_) {}
      try {
        if (backBtn) backBtn.style.display = 'inline-block';
      } catch (_) {}

      if (!fromHistory) {
        try {
          const nextHash = buildInlineCountryHash(countryEntry && countryEntry.id);
          if (String((window.location && window.location.hash) || '') !== nextHash) {
            try { history.pushState(null, '', nextHash); }
            catch (__){ try { window.location.hash = nextHash; } catch (___) {} }
          }
        } catch (_) {}
      }

      try { cardSkeleton(); } catch (_) {}

      try {
        const resolvedMethods = await resolveInlineCountryMethods(countryEntry);
        if (resolvedMethods.length) {
          methods = resolvedMethods.slice();
          renderMethods(methods);
          try { showNoResults(false); } catch (_) {}
          return methods;
        }
      } catch (_) {}

      return __originalInlineEnterCountry(countryEntry, true);
    };
  }

  function formatInlineMethodInfoAmountWithCurrency(value, currencyCode){
    const resolvedCurrency = normalizeInlineCurrencyCode(currencyCode || '') || 'USD';
    const rawText = String(value == null ? '' : value).trim();
    if (!rawText) return '';
    const numeric = Number(rawText.replace(/,/g, ''));
    if (!Number.isFinite(numeric)) return rawText;
    if (typeof formatNumber === 'function' && typeof digitsForCurrency === 'function') {
      return formatNumber(numeric, digitsForCurrency(resolvedCurrency)) + (resolvedCurrency ? (' ' + resolvedCurrency) : '');
    }
    return numeric.toFixed(3) + (resolvedCurrency ? (' ' + resolvedCurrency) : '');
  }

  function buildInlineMethodInfoEntries(method){
    const methodRoot = (method && typeof method === 'object') ? method : {};
    const methodData = methodRoot && methodRoot.data && typeof methodRoot.data === 'object' ? methodRoot.data : {};
    const methodCurrencyCode = resolveInlineModalMethodCurrency(method) || normalizeInlineCurrencyCode(methodData.currencyCode || methodData.currency || '');
    const info = (methodData.info && typeof methodData.info === 'object' && !Array.isArray(methodData.info)) ? methodData.info : {};
    const formatInlineMethodInfoAmount = function(value){
      return formatInlineMethodInfoAmountWithCurrency(value, methodCurrencyCode || 'USD');
    };
    const flowKey = methodData.flow || methodRoot.flow || getCurrentInlineFlowKind();
    const rawDisplayFields = Array.isArray(methodData.displayFields) ? methodData.displayFields : [];
    const rawTransferTargets = Array.isArray(methodData.transferTargets) ? methodData.transferTargets : [];
    const transferSections = buildInlineTransferSections(rawTransferTargets, {
      groupEnabled: parseInlineOptionalBoolean(methodData.transferTargetsGroupEnabled ?? methodData.targetsGroupEnabled ?? methodData.groupTransferTargets) === true,
      groupTitle: methodData.transferTargetsGroupTitle || methodData.targetsGroupTitle || methodData.transferGroupTitle || methodData.groupTitle || methodData.groupLabel || ''
    });
    const explicitDisplayFields = resolveInlineDisplayFields(
      stripInlineTransferDisplayFields(rawDisplayFields, rawTransferTargets),
      [],
      info,
      flowKey,
      {
        source: Object.assign({}, methodData, {
          transferTargets: [],
          transferTargetsGroupEnabled: false,
          targetsGroupEnabled: false,
          groupTransferTargets: false
        })
      }
    ).filter(function(entry){
      return !inlineDisplayFieldLooksLikeNote(entry) && !inlineDisplayFieldLooksLikeTransferField(entry);
    });
    const entries = [];
    const pushFieldEntry = function(source, idx){
      const item = (source && typeof source === 'object') ? source : {};
      const label = String(item.label || item.name || item.title || item.key || ('تفصيل ' + (idx + 1))).trim();
      const value = String(item.value || item.text || item.content || '').trim();
      if (!value) return;
      const keyText = String(item.key || '').trim().toLowerCase();
      const isFeeEntry = /fee|commission/i.test(keyText) || /\u0639\u0645\u0648\u0644/.test(label);
      const explicitCopyable = Object.prototype.hasOwnProperty.call(item, 'copyable')
        ? item.copyable !== false
        : (/wallet|iban|account|number|phone|transfer|target|telegram|webuid/.test(keyText) || /رقم|محفظ|حساب|iban|تحويل|معر|هاتف/i.test(label));
      entries.push({
        kind: 'field',
        label: label || ('تفصيل ' + (idx + 1)),
        value: isFeeEntry ? (formatInlineMethodInfoAmount(value) || value) : value,
        copyable: explicitCopyable
      });
    };
    transferSections.forEach(function(section, sectionIndex){
      const sectionValues = Array.isArray(section && section.values) ? section.values : [];
      if (!sectionValues.length) return;
      if (section.sectionGrouped === true) {
        entries.push({
          kind: 'group',
          label: normalizeInlineTransferSectionTitle(section.sectionTitle || ''),
          values: sectionValues.map(function(item){
            return {
              value: String(item && item.value || '').trim(),
              copyable: item && item.copyable !== false
            };
          }).filter(function(item){
            return item && item.value;
          })
        });
        return;
      }
      sectionValues.forEach(function(item, valueIndex){
        pushFieldEntry({
          key: 'transfer_target_' + String(sectionIndex + 1) + '_' + String(valueIndex + 1),
          label: String(item && item.label || '').trim() || (sectionValues.length > 1 ? ('جهة التحويل ' + (valueIndex + 1)) : 'جهة التحويل'),
          value: String(item && item.value || '').trim(),
          copyable: item && item.copyable !== false
        }, valueIndex);
      });
    });
    explicitDisplayFields.forEach(function(entry, idx){
      pushFieldEntry(entry, idx);
    });

    const blockedClientNoteSnippets = [
      'مراجعة الطلبات يدوية وقد تستغرق من دقيقة إلى ساعتين في أوقات العمل.',
      'مراجعة الطلبات يدوية وقد تستغرق من دقيقة إلى ساعتين في اوقات العمل.'
    ];
    const sanitizeClientNoteText = function(value){
      let text = String(value || '').trim();
      if (!text) return '';
      blockedClientNoteSnippets.forEach(function(snippet){
        const rawSnippet = String(snippet || '').trim();
        if (!rawSnippet) return;
        text = text.split(rawSnippet).join(' ').trim();
      });
      return text.replace(/\s{2,}/g, ' ').trim();
    };
    const noteText = [
      resolveInlineClientNote(info, rawDisplayFields)
    ].map(function(value){
      return sanitizeClientNoteText(value);
    }).find(function(value){
      return value.length > 0;
    }) || '';

    if (noteText) {
      entries.push({ kind: 'note', label: '\u0645\u0644\u0627\u062d\u0638\u0629', value: noteText, copyable: false });
    }

    const dedupedEntries = [];
    const seenEntries = Object.create(null);
    entries.forEach(function(entry){
      if (!entry || typeof entry !== 'object') return;
      if (entry.kind === 'group') {
        const nextValues = [];
        const seenGroupValues = Object.create(null);
        (Array.isArray(entry.values) ? entry.values : []).forEach(function(item){
          const value = String(item && item.value || '').trim();
          const fingerprint = buildInlineDisplayValueFingerprint(entry.label || '', value);
          if (!fingerprint || seenGroupValues[fingerprint]) return;
          seenGroupValues[fingerprint] = 1;
          nextValues.push({
            value: value,
            copyable: item && item.copyable !== false
          });
        });
        if (!nextValues.length) return;
        dedupedEntries.push(Object.assign({}, entry, { values: nextValues }));
        return;
      }
      const fingerprint = buildInlineDisplayValueFingerprint(entry.label || '', entry.value || '');
      if (!fingerprint || seenEntries[fingerprint]) return;
      seenEntries[fingerprint] = 1;
      dedupedEntries.push(entry);
    });
    return dedupedEntries;
  }

  function flattenInlineMethodInfoCopyableEntries(method){
    const entries = buildInlineMethodInfoEntries(method);
    const out = [];
    entries.forEach(function(entry){
      if (!entry || typeof entry !== 'object') return;
      if (entry.kind === 'group') {
        const sectionLabel = String(entry.label || '').trim();
        (Array.isArray(entry.values) ? entry.values : []).forEach(function(item){
          const value = String(item && item.value || '').trim();
          if (!value) return;
          out.push({
            label: sectionLabel,
            value: value,
            copyable: item && item.copyable !== false
          });
        });
        return;
      }
      const value = String(entry.value || '').trim();
      if (!value) return;
      out.push({
        label: String(entry.label || '').trim(),
        value: value,
        copyable: entry.copyable !== false
      });
    });
    return out;
  }

  function splitInlineMethodUrlToken(rawUrl) {
    const token = String(rawUrl || '');
    if (!token) return { href: '', trailing: '' };
    let cut = token.length;
    while (cut > 0) {
      const ch = token.charAt(cut - 1);
      if (/[).,;:!?]/.test(ch) || ch === '،' || ch === '؛' || ch === '؟') {
        cut -= 1;
        continue;
      }
      break;
    }
    const href = token.slice(0, cut);
    const trailing = token.slice(cut);
    if (!href) return { href: token, trailing: '' };
    return { href: href, trailing: trailing };
  }

  function normalizeInlineMethodLinkHref(rawUrl) {
    const url = String(rawUrl || '').trim();
    if (!url) return '';
    if (/^(?:https?:\\/\\/|mailto:|tel:|whatsapp:)/i.test(url)) return url;
    if (/^(?:www\\.|wa\\.me\\/|chat\\.whatsapp\\.com\\/|t\\.me\\/|telegram\\.me\\/)/i.test(url)) {
      return 'https://' + url;
    }
    if (/^[a-z0-9][a-z0-9.-]*\\.[a-z]{2,}(?:[/?#].*)?$/i.test(url)) {
      return 'https://' + url;
    }
    return url;
  }

  function appendInlineMethodLinkedTextFragment(fragment, text, createAnchor) {
    const source = String(text || '');
    const linkRegex = /(?:https?:\\/\\/|www\\.|wa\\.me\\/|chat\\.whatsapp\\.com\\/|t\\.me\\/|telegram\\.me\\/|[a-z0-9][a-z0-9.-]*\\.[a-z]{2,}(?:[/?#][^\\s<>"']*)?)[^\\s<>"']*/gi;
    source.replace(/\\r\\n?/g, '\\n').split('\\n').forEach(function(line, lineIndex){
      if (lineIndex > 0) fragment.appendChild(document.createElement('br'));
      let lastIndex = 0;
      let match;
      linkRegex.lastIndex = 0;
      while ((match = linkRegex.exec(line)) !== null) {
        if (match.index > lastIndex) fragment.appendChild(document.createTextNode(line.slice(lastIndex, match.index)));
        const rawUrl = match[0];
        const parsed = splitInlineMethodUrlToken(rawUrl);
        if (parsed.href) {
          const anchor = typeof createAnchor === 'function'
            ? createAnchor(parsed.href)
            : document.createElement('a');
          anchor.href = normalizeInlineMethodLinkHref(parsed.href);
          anchor.target = '_blank';
          anchor.rel = 'noopener noreferrer nofollow';
          anchor.textContent = parsed.href;
          fragment.appendChild(anchor);
        }
        if (parsed.trailing) fragment.appendChild(document.createTextNode(parsed.trailing));
        lastIndex = match.index + rawUrl.length;
      }
      if (lastIndex < line.length) fragment.appendChild(document.createTextNode(line.slice(lastIndex)));
    });
  }

  function inlineMethodTextHasLink(value){
    return /(?:https?:\\/\\/|www\\.|wa\\.me\\/|chat\\.whatsapp\\.com\\/|t\\.me\\/|telegram\\.me\\/|[a-z0-9][a-z0-9.-]*\\.[a-z]{2,})/i.test(String(value || ''));
  }

  function inlineMethodEscapeHtml(value){
    if (typeof zEscHtml === 'function') return zEscHtml(value);
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function linkifyInlineMethodInfoHtml(value){
    const source = String(value == null ? '' : value);
    if (!source) return '';
    if (!inlineMethodTextHasLink(source)) {
      return inlineMethodEscapeHtml(source).replace(/\\r?\\n/g, '<br>');
    }
    const linkRegex = /(?:https?:\\/\\/|www\\.|wa\\.me\\/|chat\\.whatsapp\\.com\\/|t\\.me\\/|telegram\\.me\\/|[a-z0-9][a-z0-9.-]*\\.[a-z]{2,}(?:[/?#][^\\s<>"']*)?)[^\\s<>"']*/gi;
    const out = [];
    source.replace(/\\r\\n?/g, '\\n').split('\\n').forEach(function(line, lineIndex){
      if (lineIndex > 0) out.push('<br>');
      let lastIndex = 0;
      let match;
      linkRegex.lastIndex = 0;
      while ((match = linkRegex.exec(line)) !== null) {
        if (match.index > lastIndex) out.push(inlineMethodEscapeHtml(line.slice(lastIndex, match.index)));
        const rawUrl = match[0];
        const parsed = splitInlineMethodUrlToken(rawUrl);
        if (parsed.href) {
          const href = normalizeInlineMethodLinkHref(parsed.href);
          out.push(
            '<a class="inline-method-link" href="' + inlineMethodEscapeHtml(href) + '" target="_blank" rel="noopener noreferrer nofollow">' +
            inlineMethodEscapeHtml(parsed.href) +
            '</a>'
          );
        }
        if (parsed.trailing) out.push(inlineMethodEscapeHtml(parsed.trailing));
        lastIndex = match.index + rawUrl.length;
      }
      if (lastIndex < line.length) out.push(inlineMethodEscapeHtml(line.slice(lastIndex)));
    });
    return out.join('');
  }

  function renderInlineMethodLinkedTextElement(targetEl, text){
    try {
      if (!targetEl || !targetEl.appendChild) return;
      const source = String(text == null ? '' : text);
      if (targetEl.dataset) targetEl.dataset.rawValue = source;
      targetEl.textContent = '';
      if (!source) return;
      if (!inlineMethodTextHasLink(source)) {
        targetEl.textContent = source;
        return;
      }
      const frag = document.createDocumentFragment();
      appendInlineMethodLinkedTextFragment(frag, source, function(){
        const anchor = document.createElement('a');
        anchor.className = 'inline-method-link';
        return anchor;
      });
      targetEl.appendChild(frag);
    } catch (_) {
      try { targetEl.textContent = String(text == null ? '' : text); } catch (_) {}
    }
  }

  function linkifyInlineMethodValueTextEl(valueTextEl){
    try {
      if (!valueTextEl || !valueTextEl.appendChild) return;
      const raw = String(
        (valueTextEl.dataset && valueTextEl.dataset.rawValue) ||
        valueTextEl.textContent ||
        ''
      );
      if (!raw || !inlineMethodTextHasLink(raw)) return;
      if (valueTextEl.dataset && valueTextEl.dataset.linkifiedRaw === raw) return;
      renderInlineMethodLinkedTextElement(valueTextEl, raw);
      if (valueTextEl.dataset) valueTextEl.dataset.linkifiedRaw = raw;
    } catch (_) {}
  }

  function linkifyInlineMethodInfoLinks(root){
    try {
      const host = root && root.querySelectorAll ? root : getNativeInlineMethodInfoEl();
      if (!host || !host.querySelectorAll) return;
      host.querySelectorAll('.info-value .value-text').forEach(function(valueTextEl){
        linkifyInlineMethodValueTextEl(valueTextEl);
      });
      const hintEl = getNativeInlineMethodHintEl();
      if (hintEl && !hintEl.hidden) {
        const rawHint = String(
          (hintEl.dataset && hintEl.dataset.rawValue) ||
          hintEl.textContent ||
          ''
        );
        if (rawHint && inlineMethodTextHasLink(rawHint)) {
          renderInlineMethodLinkedTextElement(hintEl, rawHint);
        }
      }
    } catch (_) {}
  }

  function getInlineMethodInfoValueText(valueEl){
    if (!valueEl) return '';
    try {
      const valueTextEl = valueEl.querySelector ? valueEl.querySelector('.value-text') : null;
      const rawValue = String((valueTextEl && valueTextEl.dataset && valueTextEl.dataset.rawValue) || '').trim();
      if (rawValue) return rawValue;
      if (valueTextEl) return String(valueTextEl.textContent || '').trim();
      const clone = valueEl.cloneNode(true);
      if (clone && clone.querySelectorAll) {
        clone.querySelectorAll('.copy-value-btn').forEach(function(node){
          try {
            if (node && node.parentNode) node.parentNode.removeChild(node);
            else if (node && typeof node.remove === 'function') node.remove();
          } catch (_) {}
        });
      }
      return String(clone && clone.textContent || '').trim();
    } catch (_) {
      return String(valueEl.textContent || '').trim();
    }
  }

  function ensureInlineMethodInfoValueTextEl(valueEl){
    if (!valueEl || !document || typeof document.createElement !== 'function') return null;
    let valueTextEl = valueEl.querySelector ? valueEl.querySelector('.value-text') : null;
    if (valueTextEl) return valueTextEl;
    valueTextEl = document.createElement('span');
    valueTextEl.className = 'value-text';
    const movableNodes = Array.from(valueEl.childNodes || []).filter(function(node){
      return !(node && node.nodeType === 1 && node.classList && node.classList.contains('copy-value-btn'));
    });
    movableNodes.forEach(function(node){
      try { valueTextEl.appendChild(node); } catch (_) {}
    });
    valueEl.appendChild(valueTextEl);
    return valueTextEl;
  }

  function syncInlineMethodInfoCopyButton(valueEl, label, rawValue, copyable){
    if (!valueEl) return;
    const normalizedValue = String(rawValue || '').trim();
    let button = valueEl.querySelector ? valueEl.querySelector('.copy-value-btn') : null;
    if (!(copyable && normalizedValue)) {
      try { valueEl.classList.remove('copyable-row'); } catch (_) {}
      if (button) {
        try {
          if (button.parentNode) button.parentNode.removeChild(button);
          else if (typeof button.remove === 'function') button.remove();
        } catch (_) {}
      }
      return;
    }
    const valueTextEl = ensureInlineMethodInfoValueTextEl(valueEl);
    if (valueTextEl && valueTextEl.dataset) valueTextEl.dataset.rawValue = normalizedValue;
    try { valueEl.classList.add('copyable-row'); } catch (_) {}
    if (!button && document && typeof document.createElement === 'function') {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'copy-value-btn';
      button.innerHTML =
        '<i class="fa-regular fa-copy copy-value-icon copy-value-icon-copy" aria-hidden="true"></i>' +
        '<i class="fa-solid fa-check copy-value-icon copy-value-icon-check" aria-hidden="true"></i>';
      if (valueEl.firstChild) valueEl.insertBefore(button, valueEl.firstChild);
      else valueEl.appendChild(button);
    }
    if (!button) return;
    button.setAttribute('data-copy-value', normalizedValue);
    button.setAttribute('aria-label', 'نسخ ' + (String(label || '').trim() || 'القيمة'));
  }

  function enhanceInlineLongCopyValues(root){
    try {
      const host = root && root.querySelectorAll ? root : getNativeInlineMethodInfoEl();
      if (!host || !host.querySelectorAll) return;
      host.querySelectorAll('.info-value.copyable-row').forEach(function(valueEl){
        const button = valueEl.querySelector ? valueEl.querySelector('.copy-value-btn[data-copy-value]') : null;
        const textEl = valueEl.querySelector ? valueEl.querySelector('.value-text') : null;
        const rawValue = String(
          (button && button.getAttribute('data-copy-value')) ||
          (textEl && textEl.dataset && textEl.dataset.rawValue) ||
          (textEl && textEl.textContent) ||
          ''
        ).trim();
        const isLong = rawValue.length > 24;
        valueEl.classList.toggle('copyable-long', isLong);
        if (isLong) {
          valueEl.setAttribute('role', 'button');
          valueEl.setAttribute('tabindex', '0');
          valueEl.setAttribute('aria-label', 'نسخ القيمة');
          valueEl.setAttribute('data-copy-value', rawValue);
        } else {
          valueEl.removeAttribute('role');
          valueEl.removeAttribute('tabindex');
          valueEl.removeAttribute('data-copy-value');
        }
      });
    } catch (_) {}
  }

  function resolveInlineMethodInfoCopyable(entries, label, rawValue){
    const normalizedValue = String(rawValue || '').trim();
    if (!normalizedValue) return false;
    const normalizedLabel = normalizeInlineDisplayLooseKey(label);
    const exact = (Array.isArray(entries) ? entries : []).find(function(entry){
      return entry &&
        String(entry.value || '').trim() === normalizedValue &&
        normalizeInlineDisplayLooseKey(entry.label) === normalizedLabel;
    });
    if (exact) return exact.copyable !== false;
    const byValue = (Array.isArray(entries) ? entries : []).find(function(entry){
      return entry && String(entry.value || '').trim() === normalizedValue;
    });
    if (byValue) return byValue.copyable !== false;
    return resolveInlineDisplayFieldCopyable(null, label, normalizedValue, '');
  }

  function ensureInlineMethodInfoCopyButtons(method){
    const infoHost = getNativeInlineMethodInfoEl();
    if (!infoHost || !infoHost.querySelectorAll) return;
    bindInlineMethodInfoCopy(infoHost);
    const copyableEntries = flattenInlineMethodInfoCopyableEntries(method);
    const items = Array.from(infoHost.querySelectorAll('.info-item, .info-item-fee, .info-item-note, .info-item-group'));
    items.forEach(function(item){
      if (!item || !item.querySelectorAll) return;
      const labelEl = item.querySelector('strong');
      const label = String(labelEl && labelEl.textContent || '').trim();
      const valueEls = item.classList && item.classList.contains('info-item-group')
        ? Array.from(item.querySelectorAll('.info-group-values .info-value'))
        : (() => {
            const single = item.querySelector('.info-value');
            return single ? [single] : [];
          })();
      valueEls.forEach(function(valueEl){
        const rawValue = getInlineMethodInfoValueText(valueEl);
        const copyable = resolveInlineMethodInfoCopyable(copyableEntries, label, rawValue);
        syncInlineMethodInfoCopyButton(valueEl, label, rawValue, copyable);
      });
    });
    enhanceInlineLongCopyValues(infoHost);
    linkifyInlineMethodInfoLinks(infoHost);
  }

  function copyInlineMethodInfoValue(text){
    const value = String(text || '').trim();
    if (!value) return Promise.reject(new Error('empty'));
    const fallbackCopy = function(){
      return new Promise(function(resolve, reject){
        try {
          const area = document.createElement('textarea');
          area.value = value;
          area.style.position = 'fixed';
          area.style.top = '-9999px';
          area.style.opacity = '0';
          area.setAttribute('readonly', 'readonly');
          document.body.appendChild(area);
          area.focus();
          area.select();
          area.setSelectionRange(0, area.value.length);
          const copied = document.execCommand('copy');
          try {
            if (area.parentNode) area.parentNode.removeChild(area);
            else if (typeof area.remove === 'function') area.remove();
          } catch (_) {}
          if (copied) resolve();
          else reject(new Error('copy_failed'));
        } catch (err) {
          reject(err);
        }
      });
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(value).catch(function(){
        return fallbackCopy();
      });
    }
    return fallbackCopy();
  }

  function findInlineMethodInfoValueByCopiedText(text){
    try {
      const normalized = String(text || '').trim();
      if (!normalized || normalized.length <= 24) return null;
      const values = document && document.querySelectorAll
        ? Array.from(document.querySelectorAll('#depositInlineApp #methodModal #methodInfo .info-value'))
        : [];
      for (let i = 0; i < values.length; i += 1) {
        const valueEl = values[i];
        const rawValue = getInlineMethodInfoValueCopyText(valueEl);
        if (!rawValue || rawValue.length <= 24) continue;
        if (rawValue === normalized || rawValue.indexOf(normalized) >= 0 || normalized.indexOf(rawValue) >= 0) {
          return valueEl;
        }
      }
    } catch (_) {}
    return null;
  }

  function getInlineMethodSelectionText(){
    try {
      const selection = window.getSelection ? window.getSelection() : null;
      return selection ? String(selection.toString() || '').trim() : '';
    } catch (_) {
      return '';
    }
  }

  function showInlineMethodCopyToastForValue(valueEl){
    try {
      if (!valueEl) return;
      const rawValue = getInlineMethodInfoValueCopyText(valueEl);
      if (!rawValue || rawValue.length <= 24) return;
      if (valueEl.__inlineCopyToastAt && Date.now() - valueEl.__inlineCopyToastAt < 500) return;
      valueEl.__inlineCopyToastAt = Date.now();
      markInlineMethodValueCopied(valueEl);
      showInlineMethodCopyToast('تم النسخ', true);
    } catch (_) {}
  }

  function showInlineMethodCopyToast(message, ok){
    const variant = ok === false ? 'error' : 'success';
    const text = String(message == null ? '' : message);
    try {
      const toast = document && typeof document.getElementById === 'function'
        ? document.getElementById('toast')
        : null;
      const toastMessage = document && typeof document.getElementById === 'function'
        ? document.getElementById('toast-message')
        : null;
      if (toast && toastMessage) {
        try {
          if (document.body && toast.parentNode !== document.body) {
            document.body.appendChild(toast);
          }
        } catch (_) {}
        try {
          toast.style.setProperty('position', 'fixed', 'important');
          toast.style.setProperty('z-index', '2147483647', 'important');
          toast.style.setProperty('display', 'flex', 'important');
          toast.style.setProperty('pointer-events', 'auto', 'important');
        } catch (_) {}
        toastMessage.textContent = text;
        toast.classList.remove(
          'app-toast--success',
          'app-toast--info',
          'app-toast--warning',
          'app-toast--error',
          'toast-center',
          'toast-compact',
          'is-visible'
        );
        toast.classList.add('app-toast', 'app-toast--' + variant);
        toast.style.visibility = 'visible';
        toast.style.opacity = '';
        try { clearTimeout(showInlineMethodCopyToast._timer); } catch (_) {}
        try { clearTimeout(showInlineMethodCopyToast._hideTimer); } catch (_) {}
        requestAnimationFrame(function(){
          try { toast.classList.add('is-visible'); } catch (_) {}
        });
        showInlineMethodCopyToast._timer = setTimeout(function(){
          try { toast.classList.remove('is-visible'); } catch (_) {}
          showInlineMethodCopyToast._hideTimer = setTimeout(function(){
            try {
              if (!toast.classList.contains('is-visible')) toast.style.visibility = 'hidden';
            } catch (_) {}
          }, 240);
        }, 2200);
        return;
      }
    } catch (_) {}
    try {
      if (typeof showToast === 'function') {
        showToast(text, variant, 2200);
        return;
      }
    } catch (_) {}
    try {
      if (typeof window !== 'undefined' && window && typeof window.showToast === 'function') {
        window.showToast(text, variant, 2200);
      }
    } catch (_) {}
  }

  function getInlineMethodInfoValueCopyText(valueEl){
    try {
      if (!valueEl) return '';
      return String(
        valueEl.getAttribute('data-copy-value') ||
        getInlineMethodInfoValueText(valueEl) ||
        ''
      ).trim();
    } catch (_) {
      return '';
    }
  }

  function findInlineMethodInfoValueFromEvent(event){
    try {
      const target = event && event.target;
      if (target && target.closest) {
        const direct = target.closest('#depositInlineApp #methodModal #methodInfo .info-value');
        if (direct) return direct;
      }
      const selection = window.getSelection ? window.getSelection() : null;
      if (selection && selection.rangeCount) {
        const anchor = selection.anchorNode;
        const focus = selection.focusNode;
        const anchorEl = anchor && (anchor.nodeType === 1 ? anchor : anchor.parentElement);
        const focusEl = focus && (focus.nodeType === 1 ? focus : focus.parentElement);
        const anchorValue = anchorEl && anchorEl.closest ? anchorEl.closest('#depositInlineApp #methodModal #methodInfo .info-value') : null;
        if (anchorValue) return anchorValue;
        const focusValue = focusEl && focusEl.closest ? focusEl.closest('#depositInlineApp #methodModal #methodInfo .info-value') : null;
        if (focusValue) return focusValue;
      }
      const selectedValue = findInlineMethodInfoValueByCopiedText(getInlineMethodSelectionText());
      if (selectedValue) return selectedValue;
      const active = document && document.activeElement;
      const activeValue = active && active.closest ? active.closest('#depositInlineApp #methodModal #methodInfo .info-value') : null;
      if (activeValue) return activeValue;
    } catch (_) {}
    return null;
  }

  function markInlineMethodValueCopied(valueEl){
    try {
      if (!valueEl) return;
      valueEl.classList.add('is-copied');
      if (valueEl.__copyVisualTimer) clearTimeout(valueEl.__copyVisualTimer);
      valueEl.__copyVisualTimer = setTimeout(function(){
        try { valueEl.classList.remove('is-copied'); } catch (_) {}
      }, 900);
    } catch (_) {}
  }

  function bindInlineMethodGlobalCopyFallback(){
    try {
      if (window.__depositInlineMethodGlobalCopyFallbackBound__) return;
      window.__depositInlineMethodGlobalCopyFallbackBound__ = true;
      document.addEventListener('click', function(event){
        try {
          const target = event && event.target;
          if (!target || typeof target.closest !== 'function') return;
          if (target.closest('a')) return;
          // النسخ الاحتياطي يعمل فقط عند النقر المباشر على القيمة نفسها داخل
          // نافذة معلومات طريقة الإيداع. لا مطابقة عبر التحديد النصي ولا عبر
          // activeElement: تلك المسارات كانت تكتب الحافظة وتبتلع نقرات في
          // أماكن أخرى من الصفحة (تلوث لصق + نقرة أولى لا تعمل على آيفون).
          const valueEl = target.closest('#depositInlineApp #methodModal #methodInfo .info-value');
          if (!valueEl) return;
          const rawValue = getInlineMethodInfoValueCopyText(valueEl);
          if (!rawValue || rawValue.length <= 24) return;
          if (target.closest('.copy-value-btn')) return;
          if (valueEl.__inlineCopyClickAt && Date.now() - valueEl.__inlineCopyClickAt < 700) return;
          valueEl.__inlineCopyClickAt = Date.now();
          if (typeof event.preventDefault === 'function') event.preventDefault();
          copyInlineMethodInfoValue(rawValue).then(function(){
            markInlineMethodValueCopied(valueEl);
            showInlineMethodCopyToast('تم النسخ', true);
          }).catch(function(){
            showInlineMethodCopyToast('تعذر النسخ', false);
          });
        } catch (_) {}
      }, true);
      document.addEventListener('copy', function(event){
        try {
          let valueEl = findInlineMethodInfoValueFromEvent(event);
          if (!valueEl && event && event.clipboardData && typeof event.clipboardData.getData === 'function') {
            valueEl = findInlineMethodInfoValueByCopiedText(event.clipboardData.getData('text/plain'));
          }
          if (!valueEl) return;
          const rawValue = getInlineMethodInfoValueCopyText(valueEl);
          if (!rawValue || rawValue.length <= 24) return;
          if (valueEl.__inlineNativeCopyAt && Date.now() - valueEl.__inlineNativeCopyAt < 500) return;
          valueEl.__inlineNativeCopyAt = Date.now();
          setTimeout(function(){
            showInlineMethodCopyToastForValue(valueEl);
          }, 0);
        } catch (_) {}
      }, true);
      document.addEventListener('keydown', function(event){
        try {
          const key = String(event && event.key || '').toLowerCase();
          if (key !== 'c' || !(event.ctrlKey || event.metaKey)) return;
          const valueEl = findInlineMethodInfoValueFromEvent(event);
          if (!valueEl) return;
          const rawValue = getInlineMethodInfoValueCopyText(valueEl);
          const selectedText = getInlineMethodSelectionText();
          if (!rawValue || rawValue.length <= 24) return;
          if (selectedText && rawValue.indexOf(selectedText) < 0 && selectedText.indexOf(rawValue) < 0) return;
          setTimeout(function(){
            showInlineMethodCopyToastForValue(valueEl);
          }, 80);
        } catch (_) {}
      }, true);
    } catch (_) {}
  }

  // hook اختبارات: يتيح ربط معالج النسخ العام بدون فتح نافذة طريقة إيداع
  // حقيقية (الربط الإنتاجي يحدث عند فتح النافذة؛ الدالة نفسها idempotent).
  try { window.__bindInlineMethodGlobalCopyFallback = bindInlineMethodGlobalCopyFallback; } catch (_) {}

  function bindInlineMethodInfoCopy(infoHost){
    if (!infoHost || infoHost.__inlineCopyBound) return;
    bindInlineMethodGlobalCopyFallback();
    infoHost.addEventListener('click', function(event){
      if (event && event.target && event.target.closest && event.target.closest('a')) return;
      const longValue = event && event.target && event.target.closest
        ? event.target.closest('.info-value.copyable-long[data-copy-value]')
        : null;
      if (longValue && infoHost.contains(longValue)) {
        event.preventDefault();
        const rawValue = String(longValue.getAttribute('data-copy-value') || '').trim();
        if (!rawValue) return;
        copyInlineMethodInfoValue(rawValue).then(function(){
          try { longValue.classList.add('is-copied'); } catch (_) {}
          showInlineMethodCopyToast('تم النسخ', true);
          setTimeout(function(){ try { longValue.classList.remove('is-copied'); } catch (_) {} }, 900);
        }).catch(function(){
          showInlineMethodCopyToast('تعذر النسخ', false);
        });
        return;
      }
      const button = event && event.target && event.target.closest
        ? event.target.closest('.copy-value-btn[data-copy-value]')
        : null;
      if (!button || !infoHost.contains(button)) return;
      event.preventDefault();
      const rawValue = String(button.getAttribute('data-copy-value') || '').trim();
      if (!rawValue) return;
      copyInlineMethodInfoValue(rawValue).then(function(){
        try { if (button.__copyTimer) clearTimeout(button.__copyTimer); } catch (_) {}
        try { button.classList.add('is-copied'); } catch (_) {}
        showInlineMethodCopyToast('تم النسخ', true);
        button.__copyTimer = setTimeout(function(){
          try { button.classList.remove('is-copied'); } catch (_) {}
        }, 1200);
      }).catch(function(){
        showInlineMethodCopyToast('تعذر النسخ', false);
      });
    });
    infoHost.addEventListener('keydown', function(event){
      if (!event || (event.key !== 'Enter' && event.key !== ' ')) return;
      const longValue = event.target && event.target.closest
        ? event.target.closest('.info-value.copyable-long[data-copy-value]')
        : null;
      if (!longValue || !infoHost.contains(longValue)) return;
      event.preventDefault();
      const rawValue = String(longValue.getAttribute('data-copy-value') || '').trim();
      if (!rawValue) return;
      copyInlineMethodInfoValue(rawValue).then(function(){
        showInlineMethodCopyToast('تم النسخ', true);
      }).catch(function(){
        showInlineMethodCopyToast('تعذر النسخ', false);
      });
    });
    infoHost.addEventListener('copy', function(event){
      const longValue = event && event.target && event.target.closest
        ? event.target.closest('.info-value.copyable-long[data-copy-value]')
        : null;
      if (!longValue || !infoHost.contains(longValue)) return;
      try {
        if (longValue.__nativeCopyToastTimer) clearTimeout(longValue.__nativeCopyToastTimer);
      } catch (_) {}
      longValue.__nativeCopyToastTimer = setTimeout(function(){
        try { longValue.classList.add('is-copied'); } catch (_) {}
        showInlineMethodCopyToast('تم النسخ', true);
        setTimeout(function(){ try { longValue.classList.remove('is-copied'); } catch (_) {} }, 900);
      }, 0);
    });
    infoHost.__inlineCopyBound = '1';
  }

  function hasNativeInlineMethodModal(){
    try {
      return !!(document && typeof document.getElementById === 'function' && document.getElementById('dynamicExtraFields'));
    } catch (_) {
      return false;
    }
  }

  function renderInlineMethodInfo(method){
    const infoHost = getNativeInlineMethodInfoEl();
    if (!infoHost) return;
    bindInlineMethodGlobalCopyFallback();
    bindInlineMethodInfoCopy(infoHost);
    const entries = buildInlineMethodInfoEntries(method);
    infoHost.innerHTML = entries.map(function(entry){
      if (entry && entry.kind === 'group') {
        const label = String(entry.label || 'عناوين التحويل').trim() || 'عناوين التحويل';
        const values = Array.isArray(entry.values) ? entry.values : [];
        if (!values.length) return '';
        return '<div class="info-item info-item-group" data-label="' + zEscHtml(label) + '" data-inline-kind="group">' +
          '<strong>' + zEscHtml(label) + '</strong>' +
          '<div class="info-group-values">' +
            values.map(function(item){
              const rawValue = String(item && item.value != null ? item.value : '');
              const htmlValue = linkifyInlineMethodInfoHtml(rawValue);
              const copyButtonHtml = item && item.copyable
                ? '<button type="button" class="copy-value-btn" data-copy-value="' + zEscHtml(rawValue) + '" aria-label="' + zEscHtml('نسخ ' + label) + '"><i class="fa-regular fa-copy copy-value-icon copy-value-icon-copy" aria-hidden="true"></i><i class="fa-solid fa-check copy-value-icon copy-value-icon-check" aria-hidden="true"></i></button>'
                : '';
              return '<div class="info-value' + (item && item.copyable ? ' copyable-row' : '') + '">' + copyButtonHtml + '<span class="value-text">' + htmlValue + '</span></div>';
            }).join('') +
          '</div>' +
        '</div>';
      }
      const label = String(entry && entry.label || '').trim();
      const rawValue = String(entry && entry.value != null ? entry.value : '');
      const htmlValue = linkifyInlineMethodInfoHtml(rawValue);
      const isFeeEntry = /عمولة|fee/i.test(label);
      const infoItemClass = isFeeEntry ? 'info-item info-item-fee' : 'info-item';
      const isNoteEntry = /note/i.test(label) || /\u0645\u0644\u0627\u062d\u0638/.test(label);
      const resolvedInfoItemClass = isFeeEntry
        ? 'info-item info-item-fee'
        : (isNoteEntry ? 'info-item info-item-note' : infoItemClass);
      const copyButtonHtml = entry && entry.copyable
        ? '<button type="button" class="copy-value-btn" data-copy-value="' + zEscHtml(rawValue) + '" aria-label="' + zEscHtml('نسخ ' + label) + '"><i class="fa-regular fa-copy copy-value-icon copy-value-icon-copy" aria-hidden="true"></i><i class="fa-solid fa-check copy-value-icon copy-value-icon-check" aria-hidden="true"></i></button>'
        : '';
      return '<div class="' + resolvedInfoItemClass + '" data-label="' + zEscHtml(label) + '" data-inline-kind="' + (isFeeEntry ? 'fee' : (isNoteEntry ? 'note' : 'field')) + '"><strong>' + zEscHtml(label) + '</strong><div class="info-value' + (entry && entry.copyable ? ' copyable-row' : '') + '">' + copyButtonHtml + '<span class="value-text">' + htmlValue + '</span></div></div>';
    }).join('');
    ensureInlineMethodInfoCopyButtons(method);
  }

  function collectNativeInlineExtraFields(method, silent){
    const fields = getInlineMethodExtraFields(method);
    if (!fields.length) return { ok: true, values: {} };
    const controls = (typeof dynamicExtraFieldsGrid !== 'undefined' && dynamicExtraFieldsGrid && dynamicExtraFieldsGrid.querySelectorAll)
      ? Array.from(dynamicExtraFieldsGrid.querySelectorAll('.dynamic-extra-control'))
      : [];
    const values = {};
    let firstInvalid = null;
    fields.forEach(function(field){
      const control = controls.find(function(entry){
        return String(entry && entry.dataset && entry.dataset.fieldKey || '') === String(field && field.key || '');
      }) || null;
      const value = control ? String(control.value || '').trim() : '';
      if (control) control.classList.remove('is-invalid');
      if (field.required && !value && !firstInvalid) {
        firstInvalid = { field: field, control: control };
      }
      if (value) values[field.key] = value;
    });
    if (firstInvalid) {
      if (firstInvalid.control) {
        if (!silent) {
          firstInvalid.control.classList.add('is-invalid');
          try { markInlineMissingControl(firstInvalid.control); } catch (_) {}
        }
      }
      if (!silent) {
        try {
          if (firstInvalid.control && typeof firstInvalid.control.focus === 'function') firstInvalid.control.focus();
        } catch (_) {}
      }
      return { ok: false, values: {} };
    }
    return { ok: true, values: values };
  }

  function ensureInlineExtraFieldsStyles(){
    if (hasNativeInlineMethodModal()) return null;
    if (!document || !document.head || document.getElementById(INLINE_EXTRA_FIELDS_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = INLINE_EXTRA_FIELDS_STYLE_ID;
    style.textContent = [
      '#depositInlineApp #methodModal{padding:18px;}',
      '#depositInlineApp #methodModal{z-index:80 !important;overflow:hidden !important;}',
      '#depositInlineApp #methodModal .modal-content{position:relative;width:min(560px,calc(100vw - 24px));max-width:560px;padding:24px 20px 20px;border-radius:30px;border:1px solid rgba(var(--site-accent-rgb, 148, 163, 184), .34);background:var(--bg-app);box-shadow:0 28px 70px rgba(2,6,23,.62);gap:10px;overflow:hidden !important;direction:inherit;text-align:inherit;}',
      '#depositInlineApp #methodModal .modal-title{font-size:1.9rem;font-weight:900;letter-spacing:0;color:var(--text);text-align:center;margin:2px 0 4px;}',
      '#depositInlineApp #methodModal .inline-method-media{display:flex;justify-content:center;align-items:center;margin:0;padding:0;}',
      '#depositInlineApp #methodModal .inline-method-media[hidden]{display:none !important;}',
      '#depositInlineApp #methodModal .inline-method-media img{display:block;width:min(100%,220px);max-height:132px;object-fit:contain;border-radius:22px;padding:14px;border:1px solid rgba(var(--site-accent-rgb, 148, 163, 184), .24);background:var(--bg-app);box-shadow:0 18px 34px rgba(2,6,23,.24);}',
      '#depositInlineApp #methodModal .modal-x{position:absolute;top:14px;left:14px;width:44px;height:44px;border-radius:18px;border:1px solid rgba(var(--site-accent-rgb, 148, 163, 184), .35);background:var(--bg-app);color:var(--text);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:none;}',
      '#depositInlineApp #methodModal .modal-x:hover{background:linear-gradient(180deg,rgba(var(--site-accent-rgb, 148, 163, 184), .08),rgba(var(--site-accent-rgb, 148, 163, 184), .03)),var(--bg-app);border-color:rgba(var(--site-accent-rgb, 148, 163, 184), .45);}',
      '#depositInlineApp #methodModal .rate-line{display:grid;gap:8px;padding:12px 14px;border-radius:18px;border:1px solid rgba(var(--site-accent-rgb, 148, 163, 184), .24);background:var(--bg-app);font-size:.88rem;color:var(--text);}',
      '#depositInlineApp #methodModal .rate-line .mini{font-weight:800;color:var(--text);}',
      '#depositInlineApp #methodModal .rate-line .chip{display:inline-flex;align-items:center;justify-content:center;min-height:38px;border-radius:14px;border:1px solid rgba(var(--site-accent-rgb, 148, 163, 184), .28);background:var(--bg-app);color:var(--text);font-weight:800;}',
      '#depositInlineApp #methodModal .calc{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;}',
      '#depositInlineApp #methodModal .calc .field{position:relative;display:flex;flex-direction:column;justify-content:center;padding:12px 14px;border-radius:20px;border:1px solid rgba(var(--site-accent-rgb, 148, 163, 184), .28);background:var(--bg-app);box-shadow:inset 0 1px 0 rgba(255,255,255,.04);direction:inherit;}',
      '#depositInlineApp #methodModal .calc label{position:absolute;inset-inline-start:12px;inset-inline-end:auto;left:12px;right:auto;top:10px;transform:translateY(-50%);display:inline-flex;align-items:center;justify-content:center;width:max-content;min-height:26px;margin:0;padding:0 10px;border-radius:999px;background:linear-gradient(180deg,rgba(var(--site-accent-rgb, 148, 163, 184), .07),rgba(var(--site-accent-rgb, 148, 163, 184), .03)),var(--bg-app);border:1px solid rgba(var(--site-accent-rgb, 148, 163, 184), .3);font-size:.82rem;font-weight:900;color:var(--text);direction:inherit;text-align:start;z-index:1;}',
      'html[dir="rtl"] #depositInlineApp #methodModal .calc label, html[data-lang="ar"] #depositInlineApp #methodModal .calc label, html[dir="rtl"] #depositInlineApp #methodModal .info-item strong, html[data-lang="ar"] #depositInlineApp #methodModal .info-item strong, html[dir="rtl"] #depositInlineApp #methodModal .info-item-fee strong, html[data-lang="ar"] #depositInlineApp #methodModal .info-item-fee strong, html[dir="rtl"] #depositInlineApp #methodModal .inline-extra-label, html[data-lang="ar"] #depositInlineApp #methodModal .inline-extra-label{inset-inline-start:auto;inset-inline-end:12px;left:auto;right:12px;text-align:right;}',
      'html[dir="ltr"] #depositInlineApp #methodModal .calc label, html[data-lang="en"] #depositInlineApp #methodModal .calc label, html[dir="ltr"] #depositInlineApp #methodModal .info-item strong, html[data-lang="en"] #depositInlineApp #methodModal .info-item strong, html[dir="ltr"] #depositInlineApp #methodModal .info-item-fee strong, html[data-lang="en"] #depositInlineApp #methodModal .info-item-fee strong, html[dir="ltr"] #depositInlineApp #methodModal .inline-extra-label, html[data-lang="en"] #depositInlineApp #methodModal .inline-extra-label{inset-inline-start:12px;inset-inline-end:auto;left:12px;right:auto;text-align:left;}',
      '#depositInlineApp #methodModal .calc input{width:100%;padding:0;border:none;outline:none;background:transparent;box-shadow:none;font-size:1.55rem;font-weight:900;color:#f8fafc;text-align:center;font-variant-numeric:tabular-nums;direction:ltr !important;unicode-bidi:plaintext !important;font-family:Arial,"Segoe UI",sans-serif !important;}',
      '#depositInlineApp #methodModal .calc input::placeholder{color:#64748b;}',
      '#depositInlineApp #methodModal .info-list{display:grid;gap:12px;margin-top:2px;}',
      '#depositInlineApp #methodModal .info-item{position:relative;display:block;gap:0;padding:10px 0 0;border:none;background:transparent;box-shadow:none;}',
      '#depositInlineApp #methodModal .info-item strong{position:absolute;inset-inline-start:12px;inset-inline-end:auto;left:12px;right:auto;top:10px;transform:translateY(-50%);display:inline-flex;align-items:center;justify-content:center;width:max-content;min-height:26px;margin:0;padding:0 8px;border-radius:999px;font-size:.8rem;font-weight:800;line-height:1.45;letter-spacing:0;border:1px solid rgba(var(--site-accent-rgb, 148, 163, 184), .3);background:linear-gradient(180deg,rgba(var(--site-accent-rgb, 148, 163, 184), .07),rgba(var(--site-accent-rgb, 148, 163, 184), .03)),var(--bg-app);color:var(--text);direction:inherit;text-align:start;z-index:2;}',
      '#depositInlineApp #methodModal .info-value{display:flex;align-items:center;justify-content:center;min-height:46px;padding:0 16px;border-radius:999px;border:1px solid rgba(var(--site-accent-rgb, 148, 163, 184), .36);background:var(--bg-app);}',
      '#depositInlineApp #methodModal .info-value .value-text{width:100%;font-size:1.02rem;font-weight:900;color:var(--text);line-height:1.1;white-space:nowrap;text-align:center;word-break:break-word;border:none;outline:none;box-shadow:none;user-select:text;-webkit-user-select:text;}',
      '#depositInlineApp #methodModal .info-value.copyable-row{position:relative;direction:ltr;justify-content:center;gap:0;padding:0 52px;}',
      '#depositInlineApp #methodModal .info-value.copyable-row .value-text{flex:1 1 auto;min-width:0;text-align:center;}',
      '#depositInlineApp #methodModal .info-value.copyable-long{cursor:pointer;padding:8px 18px;}',
      '#depositInlineApp #methodModal .info-value.copyable-long .copy-value-btn{display:none;}',
      '#depositInlineApp #methodModal .info-value.copyable-long .value-text{white-space:normal;overflow-wrap:anywhere;word-break:break-word;line-height:1.45;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;text-align:center;}',
      '#depositInlineApp #methodModal .copy-value-btn{position:absolute;left:10px;top:50%;display:inline-flex;align-items:center;justify-content:center;gap:0;flex:0 0 auto;width:36px;min-width:36px;height:32px;padding:0;border-radius:999px;border:1px solid rgba(var(--site-accent-rgb, 148, 163, 184), .32);background:rgba(var(--site-accent-rgb, 148, 163, 184), .10);color:var(--text);box-shadow:none;cursor:pointer;appearance:none;-webkit-appearance:none;transform:translateY(-50%);filter:none;font-size:.76rem;font-weight:800;line-height:1;}',
      '#depositInlineApp #methodModal .copy-value-btn .copy-value-icon{font-size:.86rem;line-height:1;}',
      '#depositInlineApp #methodModal .copy-value-btn .copy-value-icon-check{display:none;}',
      '#depositInlineApp #methodModal .copy-value-btn:hover{transform:translateY(calc(-50% - 1px));box-shadow:0 10px 24px rgba(var(--site-accent-rgb, 148, 163, 184), .12);background:linear-gradient(180deg,rgba(var(--site-accent-rgb, 148, 163, 184), .08),rgba(var(--site-accent-rgb, 148, 163, 184), .03)),var(--bg-app);}',
      '#depositInlineApp #methodModal .copy-value-btn:focus, #depositInlineApp #methodModal .copy-value-btn:focus-visible{outline:none;box-shadow:none;}',
      '#depositInlineApp #methodModal .copy-value-btn.is-copied{background:rgba(22,163,74,.18);border-color:rgba(34,197,94,.34);color:#bbf7d0;box-shadow:none;transform:translateY(-50%);}',
      '#depositInlineApp #methodModal .copy-value-btn.is-copied .copy-value-icon-copy{display:none;}',
      '#depositInlineApp #methodModal .copy-value-btn.is-copied .copy-value-icon-check{display:inline-block;}',
      '#depositInlineApp #methodModal .info-item-fee{position:relative;display:block;gap:0;padding:10px 0 0;border:none;background:transparent;box-shadow:none;}',
      '#depositInlineApp #methodModal .info-item-fee strong{position:absolute;inset-inline-start:12px;inset-inline-end:auto;left:12px;right:auto;top:10px;transform:translateY(-50%);display:inline-flex;align-items:center;justify-content:center;width:max-content;min-height:26px;margin:0;padding:0 8px;border-radius:999px;background:linear-gradient(180deg,rgba(var(--site-accent-rgb, 148, 163, 184), .07),rgba(var(--site-accent-rgb, 148, 163, 184), .03)),var(--bg-app);border:1px solid rgba(var(--site-accent-rgb, 148, 163, 184), .3);font-size:.8rem;font-weight:800;color:var(--text);direction:inherit;text-align:start;z-index:2;}',
      '#depositInlineApp #methodModal .info-item-fee .info-value{min-height:46px;padding:0 16px;border-radius:999px;border:1px solid rgba(var(--site-accent-rgb, 148, 163, 184), .36);background:var(--bg-app);justify-content:center;}',
      '#depositInlineApp #methodModal .info-item-fee .info-value .value-text{font-size:1.02rem;font-weight:900;line-height:1.1;text-align:center;font-variant-numeric:tabular-nums;white-space:nowrap;}',
      '#depositInlineApp #methodModal .info-item-note{position:relative;display:block;gap:0;padding:10px 0 0;border:none;background:transparent;box-shadow:none;}',
      '#depositInlineApp #methodModal .info-item-note .info-value{min-height:92px;padding:14px 18px;border-radius:24px;justify-content:flex-start;align-items:flex-start;}',
      '#depositInlineApp #methodModal .info-item-note .info-value .value-text{text-align:right;direction:rtl;line-height:1.8;white-space:normal;user-select:text;-webkit-user-select:text;}',
      '#depositInlineApp #methodModal .info-item-group{position:relative;display:block;gap:0;padding:10px 0 0;border:none;background:transparent;box-shadow:none;}',
      '#depositInlineApp #methodModal .info-item-group .info-group-values{display:grid;gap:8px;}',
      '#depositInlineApp #methodModal .info-item-group .info-value{min-height:46px;}',
      '#depositInlineApp #methodModal .info-item-group .info-value .value-text{white-space:normal;line-height:1.6;}',
      '#depositInlineApp #methodModal .actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:4px;align-items:stretch;}',
      '#depositInlineApp #methodModal .actions.inline-proof-stacked{grid-template-columns:1fr;}',
      '#depositInlineApp #methodModal .actions.inline-proof-stacked #proofTrigger, #depositInlineApp #methodModal .actions.inline-proof-stacked #submitDepositBtn{grid-column:1/-1;}',
      '#depositInlineApp #methodModal #closeModal{display:none;}',
      '#depositInlineApp #methodModal .btn{width:100%;min-height:48px;height:48px;border-radius:999px;padding:0 18px;font-size:.94rem;font-weight:900;line-height:1.2;box-shadow:none;display:inline-flex;align-items:center;justify-content:center;gap:9px;}',
      '#depositInlineApp #methodModal .btn i{display:inline-flex;align-items:center;justify-content:center;font-size:1rem;line-height:1;margin:0;}',
      '#depositInlineApp #methodModal .btn.is-loading{cursor:wait;opacity:.96;}',
      '#depositInlineApp #methodModal .btn.is-loading i{margin-inline-end:8px;}',
      '#depositInlineApp #methodModal .btn-primary{background:linear-gradient(180deg,rgba(var(--site-accent-rgb, 148, 163, 184), .10),rgba(var(--site-accent-rgb, 148, 163, 184), .04)),var(--bg-app);color:var(--text);border:1px solid rgba(var(--site-accent-rgb, 148, 163, 184), .42);}',
      '#depositInlineApp #methodModal .btn-outline{background:linear-gradient(180deg,rgba(var(--site-accent-rgb, 148, 163, 184), .08),rgba(var(--site-accent-rgb, 148, 163, 184), .03)),var(--bg-app);color:var(--text);border:1px solid rgba(var(--site-accent-rgb, 148, 163, 184), .34);}',
      '#depositInlineApp #methodModal #proofTrigger.inline-proof-trigger{display:inline-flex;align-items:center;justify-content:center;gap:10px;padding-inline:14px;}',
      '#depositInlineApp #methodModal #proofTrigger.inline-proof-trigger .inline-proof-trigger-icon{display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;width:auto;height:auto;border-radius:0;border:0;background:transparent;color:#dbeafe;font-size:1.16rem;line-height:1;transform:translateY(1px);}',
      '#depositInlineApp #methodModal #proofTrigger.inline-proof-trigger .inline-proof-trigger-label{display:inline-flex;align-items:center;justify-content:center;min-width:0;line-height:1.3;}',
      '#depositInlineApp #methodModal .inline-submit-loader{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:22px;background:rgba(3,7,18,.56);backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px);opacity:0;pointer-events:none;transition:opacity .18s ease;z-index:8;}',
      '#depositInlineApp #methodModal .modal-content.is-submit-pending .inline-submit-loader{opacity:1;pointer-events:auto;}',
      '#depositInlineApp #methodModal .modal-content.is-submit-pending > :not(.inline-submit-loader){filter:blur(1.6px);transform:scale(.992);transition:filter .18s ease, transform .18s ease;}',
      '#depositInlineApp #methodModal .inline-submit-loader-card{display:grid;justify-items:center;gap:10px;width:min(100%,320px);padding:18px 20px;border-radius:24px;border:1px solid rgba(var(--site-accent-rgb, 148, 163, 184), .26);background:var(--bg-app);box-shadow:0 24px 48px rgba(2,6,23,.32);text-align:center;}',
      '#depositInlineApp #methodModal .inline-submit-loader-spinner{display:inline-flex;align-items:center;justify-content:center;width:54px;height:54px;border-radius:999px;background:rgba(var(--site-accent-rgb, 148, 163, 184), .08);border:1px solid rgba(var(--site-accent-rgb, 148, 163, 184), .34);color:var(--text);font-size:1.35rem;}',
      '#depositInlineApp #methodModal .inline-submit-loader-title{font-size:1rem;font-weight:900;color:#f8fafc;line-height:1.5;}',
      '#depositInlineApp #methodModal .inline-submit-loader-copy{font-size:.84rem;line-height:1.9;color:#cbd5e1;}',
      '#depositInlineApp #methodModal .hint{margin-top:2px;min-height:0;padding:4px 8px 0;border-radius:0;border:0;background:transparent;color:#eaf0ff;font-size:.98rem;font-weight:900;line-height:1.75;text-align:center;display:block;}',
      '#depositInlineApp #methodModal .inline-method-link, #depositInlineApp #methodModal .hint .inline-method-link{position:relative;z-index:3;pointer-events:auto;cursor:pointer;color:#3b82f6;-webkit-text-fill-color:#3b82f6;text-decoration:underline;text-underline-offset:2px;direction:ltr;unicode-bidi:plaintext;overflow-wrap:anywhere;}',
      '#depositInlineApp #methodModal .preview{padding:8px 4px 0;color:#93c5fd;font-size:.82rem;line-height:1.8;overflow-wrap:anywhere;text-align:center;}',
      '#depositInlineApp #methodModal .inline-extra-fields{display:grid;gap:10px;margin:-6px 0 0;padding:0;background:transparent;border:none;box-shadow:none;}',
      '#depositInlineApp #methodModal .inline-extra-fields[hidden]{display:none !important;}',
      '#depositInlineApp #methodModal .inline-extra-fields-head{display:none !important;}',
      '#depositInlineApp #methodModal .inline-extra-fields-grid{display:grid;gap:10px;}',
      '#depositInlineApp #methodModal .inline-extra-field{position:relative;display:block;gap:0;padding:10px 0 0;border:none;background:transparent;box-shadow:none;}',
      '#depositInlineApp #methodModal .inline-extra-label{position:absolute;inset-inline-start:12px;inset-inline-end:auto;left:12px;right:auto;top:10px;transform:translateY(-50%);display:flex;align-items:center;gap:8px;margin:0;z-index:1;pointer-events:none;font-size:0;}',
      '#depositInlineApp #methodModal .inline-extra-label > :not(.inline-extra-badge){display:inline-flex;align-items:center;justify-content:center;min-height:26px;padding:0 8px;border-radius:999px;font-size:.8rem;font-weight:800;line-height:1.45;letter-spacing:0;border:1px solid #e5e7eb;background:#ffffff;color:#5d6ba8;}',
      '#depositInlineApp #methodModal .inline-extra-badge{display:none !important;}',
      '#depositInlineApp #methodModal .inline-extra-control{width:100%;height:46px;min-height:46px;padding:0 16px;border-radius:999px;border:1px solid #e5e7eb;background:#ffffff;color:#29315f;font-size:1.02rem;font-weight:900;outline:none;box-shadow:none;text-align:center;}',
      '#depositInlineApp #methodModal .inline-extra-control[data-dir="ltr"]{direction:ltr;font-variant-numeric:tabular-nums;}',
      '#depositInlineApp #methodModal textarea.inline-extra-control{height:auto;min-height:92px;padding:14px 18px;border-radius:24px;resize:vertical;}',
      '#depositInlineApp #methodModal .inline-extra-control:focus{border-color:rgba(var(--site-accent-rgb, 148, 163, 184), .58);box-shadow:0 0 0 2px rgba(var(--site-accent-rgb, 148, 163, 184), .12);}',
      '#depositInlineApp #methodModal .inline-extra-control.is-invalid{border-color:#ef4444;box-shadow:0 0 0 2px rgba(239,68,68,.14);}',
      '#depositInlineApp #methodModal .is-inline-invalid, #depositInlineApp #methodModal .inline-extra-control.is-invalid, #depositInlineApp #methodModal .dynamic-extra-control.is-invalid{border-color:#ef4444 !important;box-shadow:0 0 0 2px rgba(239,68,68,.22) !important;}',
      '#depositInlineApp #methodModal .is-inline-shake{animation:inlineInvalidShake .34s ease both;}',
      '@keyframes inlineInvalidShake{0%,100%{transform:translateX(0)}20%{transform:translateX(-7px)}40%{transform:translateX(7px)}60%{transform:translateX(-5px)}80%{transform:translateX(5px)}}',
      '@media (max-width:640px){#depositInlineApp #methodModal{padding:8px;}#depositInlineApp #methodModal .modal-content{width:min(100vw - 16px,560px);padding:18px 18px 18px;border-radius:24px;gap:8px;}#depositInlineApp #methodModal .modal-title{font-size:1.55rem;margin-bottom:0;}#depositInlineApp #methodModal .calc{grid-template-columns:1fr;gap:8px;margin-bottom:0;}#depositInlineApp #methodModal .calc input{font-size:1.35rem;}#depositInlineApp #methodModal .info-list,#depositInlineApp #methodModal #methodInfo{gap:7px;margin-top:0;}#depositInlineApp #methodModal .actions{gap:8px;margin-top:0;}#depositInlineApp #methodModal .btn{height:48px;min-height:48px;}#depositInlineApp #methodModal .hint{margin-top:0;padding-top:2px;line-height:1.55;}#depositInlineApp #methodModal .modal-x{top:12px;left:12px;width:40px;height:40px;}}',
      'html[data-theme="light"] #depositInlineApp #methodModal .modal-content{background:var(--bg-app);border-color:rgba(var(--site-accent-rgb, 148, 163, 184), .18);box-shadow:0 24px 54px rgba(15,23,42,.18);}',
      'html[data-theme="light"] #depositInlineApp #methodModal .modal-title{color:var(--text);}',
      'html[data-theme="light"] #depositInlineApp #methodModal .inline-method-media img{background:#ffffff;border-color:#dbe3f3;box-shadow:0 12px 26px rgba(15,23,42,.08);}',
      'html[data-theme="light"] #depositInlineApp #methodModal .modal-x{background:#f8fbff;color:#334155;border-color:#dbe3f3;}',
      'html[data-theme="light"] #depositInlineApp #methodModal .rate-line{background:#f8fbff;border-color:#dbe3f3;color:#475569;}',
      'html[data-theme="light"] #depositInlineApp #methodModal .rate-line .mini{color:#334155;}',
      'html[data-theme="light"] #depositInlineApp #methodModal .rate-line .chip{background:#ffffff;border-color:#dbe3f3;color:#0f172a;}',
      'html[data-theme="light"] #depositInlineApp #methodModal .calc .field{background:#f8fbff;border-color:#dbe3f3;box-shadow:none;}',
      'html[data-theme="light"] #depositInlineApp #methodModal .calc label{background:var(--bg-app);border-color:rgba(var(--site-accent-rgb, 148, 163, 184), .28);color:var(--text);}',
      'html[data-theme="light"] #depositInlineApp #methodModal .calc input{color:#0f172a;}',
      'html[data-theme="light"] #depositInlineApp #methodModal .info-item{background:transparent;box-shadow:none;}',
      'html[data-theme="light"] #depositInlineApp #methodModal .info-item strong{color:#5d6ba8;background:#ffffff;border-color:#e5e7eb;}',
      'html[data-theme="light"] #depositInlineApp #methodModal .info-value{background:#ffffff;border-color:#e5e7eb;}',
      'html[data-theme="light"] #depositInlineApp #methodModal .info-value .value-text{color:#29315f;}',
      'html[data-theme="light"] #depositInlineApp #methodModal .copy-value-btn{border-color:#d7defe;background:#f8fafc;color:#334155;}',
      'html[data-theme="light"] #depositInlineApp #methodModal .copy-value-btn:hover{background:rgba(var(--site-accent-rgb, 148, 163, 184), .08);box-shadow:none;}',
      'html[data-theme="light"] #depositInlineApp #methodModal .copy-value-btn.is-copied{background:#ecfdf3;color:#15803d;border-color:#86efac;}',
      'html[data-theme="light"] #depositInlineApp #methodModal .info-item-fee{background:transparent;box-shadow:none;}',
      'html[data-theme="light"] #depositInlineApp #methodModal .info-item-fee strong{background:#ffffff;border-color:#e5e7eb;color:#5d6ba8;}',
      'html[data-theme="light"] #depositInlineApp #methodModal .info-item-fee .info-value{background:#ffffff;border-color:#e5e7eb;}',
      'html[data-theme="light"] #depositInlineApp #methodModal .btn-outline{background:#ffffff;color:#0f172a;border-color:#dbe3f3;}',
      'html[data-theme="light"] #depositInlineApp #methodModal #proofTrigger.inline-proof-trigger{background:#ffffff;color:#29315f;border-color:#dbe3f3;}',
      'html[data-theme="light"] #depositInlineApp #methodModal #proofTrigger.inline-proof-trigger:hover{background:#f8fbff;border-color:rgba(var(--site-accent-rgb, 148, 163, 184), .34);}',
      'html[data-theme="light"] #depositInlineApp #methodModal #proofTrigger.inline-proof-trigger .inline-proof-trigger-label{color:#29315f;}',
      'html[data-theme="light"] #depositInlineApp #methodModal #proofTrigger.inline-proof-trigger .inline-proof-trigger-icon{background:transparent;border-color:transparent;color:var(--text);}',
      'html[data-theme="light"] #depositInlineApp #methodModal .inline-submit-loader{background:rgba(226,232,240,.56);}',
      'html[data-theme="light"] #depositInlineApp #methodModal .inline-submit-loader-card{background:linear-gradient(180deg,#ffffff,#f8fbff);border-color:#dbe3f3;box-shadow:0 22px 40px rgba(15,23,42,.14);}',
      'html[data-theme="light"] #depositInlineApp #methodModal .inline-submit-loader-spinner{background:rgba(var(--site-accent-rgb, 148, 163, 184), .08);border-color:rgba(var(--site-accent-rgb, 148, 163, 184), .26);color:var(--text);}',
      'html[data-theme="light"] #depositInlineApp #methodModal .inline-submit-loader-title{color:#0f172a;}',
      'html[data-theme="light"] #depositInlineApp #methodModal .inline-submit-loader-copy{color:#475569;}',
      'html[data-theme="light"] #depositInlineApp #methodModal .hint{background:transparent;border-color:transparent;color:#29315f;}',
      'html[data-theme="light"] #depositInlineApp #methodModal .inline-extra-badge{border-color:rgba(22,163,74,.18);background:#ecfdf3;color:#15803d;}',
      'html[data-theme="light"] #depositInlineApp #methodModal .inline-extra-control{border-color:#dbe3f3;background:#f8fbff;color:#0f172a;}',
      '#depositInlineApp #methodModal :is(.calc .field,.rate-line,.rate-line .chip,.info-value,.info-item-fee .info-value,.info-item-group .info-value,.inline-extra-control){background:var(--bg-app) !important;background-image:none !important;color:var(--text) !important;border-color:rgba(var(--site-accent-rgb, 148, 163, 184), .36) !important;box-shadow:none !important;}',
      '#depositInlineApp #methodModal :is(.calc label,.info-item strong,.info-item-fee strong,.info-item-group > strong,.inline-extra-label > :not(.inline-extra-badge)){background:var(--bg-app) !important;background-image:none !important;color:var(--text) !important;border-color:rgba(var(--site-accent-rgb, 148, 163, 184), .42) !important;box-shadow:0 0 0 1px rgba(var(--site-accent-rgb, 148, 163, 184), .08) inset !important;}',
      '#depositInlineApp #methodModal :is(.info-value .value-text,.inline-extra-control,.calc input){color:var(--text) !important;-webkit-text-fill-color:currentColor !important;}',
      'html[data-theme="dark"] #depositInlineApp #methodModal :is(.calc .field,.rate-line,.rate-line .chip,.info-value,.info-item-fee .info-value,.info-item-group .info-value,.inline-extra-control), body.dark-mode #depositInlineApp #methodModal :is(.calc .field,.rate-line,.rate-line .chip,.info-value,.info-item-fee .info-value,.info-item-group .info-value,.inline-extra-control){background:var(--bg-app) !important;background-image:none !important;color:var(--text) !important;border-color:rgba(var(--site-accent-rgb, 148, 163, 184), .36) !important;box-shadow:none !important;}',
      'html[data-theme="dark"] #depositInlineApp #methodModal :is(.calc label,.info-item strong,.info-item-fee strong,.info-item-group > strong,.inline-extra-label > :not(.inline-extra-badge)), body.dark-mode #depositInlineApp #methodModal :is(.calc label,.info-item strong,.info-item-fee strong,.info-item-group > strong,.inline-extra-label > :not(.inline-extra-badge)){background:var(--bg-app) !important;background-image:none !important;color:var(--text) !important;border-color:rgba(var(--site-accent-rgb, 148, 163, 184), .42) !important;box-shadow:0 0 0 1px rgba(var(--site-accent-rgb, 148, 163, 184), .08) inset !important;}',
      'html[data-theme="light"] #depositInlineApp #methodModal :is(.calc .field,.rate-line,.rate-line .chip,.info-value,.info-item-fee .info-value,.info-item-group .info-value,.inline-extra-control), body.light-mode #depositInlineApp #methodModal :is(.calc .field,.rate-line,.rate-line .chip,.info-value,.info-item-fee .info-value,.info-item-group .info-value,.inline-extra-control){background:var(--bg-app) !important;background-image:none !important;color:var(--text) !important;border-color:rgba(var(--site-accent-rgb, 148, 163, 184), .36) !important;box-shadow:none !important;}',
      'html[data-theme="light"] #depositInlineApp #methodModal :is(.calc label,.info-item strong,.info-item-fee strong,.info-item-group > strong,.inline-extra-label > :not(.inline-extra-badge)), body.light-mode #depositInlineApp #methodModal :is(.calc label,.info-item strong,.info-item-fee strong,.info-item-group > strong,.inline-extra-label > :not(.inline-extra-badge)){background:var(--bg-app) !important;background-image:none !important;color:var(--text) !important;border-color:rgba(var(--site-accent-rgb, 148, 163, 184), .42) !important;box-shadow:0 0 0 1px rgba(var(--site-accent-rgb, 148, 163, 184), .08) inset !important;}',
      'html[data-theme="dark"] #depositInlineApp #methodModal .calc .field, body.dark-mode #depositInlineApp #methodModal .calc .field, html[data-theme="light"] #depositInlineApp #methodModal .calc .field, body.light-mode #depositInlineApp #methodModal .calc .field, html[data-theme="dark"] #depositInlineApp #methodModal .info-value, body.dark-mode #depositInlineApp #methodModal .info-value, html[data-theme="light"] #depositInlineApp #methodModal .info-value, body.light-mode #depositInlineApp #methodModal .info-value, html[data-theme="dark"] #depositInlineApp #methodModal .inline-extra-control, body.dark-mode #depositInlineApp #methodModal .inline-extra-control, html[data-theme="light"] #depositInlineApp #methodModal .inline-extra-control, body.light-mode #depositInlineApp #methodModal .inline-extra-control{background:var(--bg-app) !important;background-image:none !important;color:var(--text) !important;-webkit-text-fill-color:currentColor !important;border:1px solid rgba(var(--site-accent-rgb, 148, 163, 184), .36) !important;box-shadow:none !important;}',
      'html[data-theme="dark"] #depositInlineApp #methodModal .calc label, body.dark-mode #depositInlineApp #methodModal .calc label, html[data-theme="light"] #depositInlineApp #methodModal .calc label, body.light-mode #depositInlineApp #methodModal .calc label, html[data-theme="dark"] #depositInlineApp #methodModal .info-item strong, body.dark-mode #depositInlineApp #methodModal .info-item strong, html[data-theme="light"] #depositInlineApp #methodModal .info-item strong, body.light-mode #depositInlineApp #methodModal .info-item strong, html[data-theme="dark"] #depositInlineApp #methodModal .info-item-fee strong, body.dark-mode #depositInlineApp #methodModal .info-item-fee strong, html[data-theme="light"] #depositInlineApp #methodModal .info-item-fee strong, body.light-mode #depositInlineApp #methodModal .info-item-fee strong, html[data-theme="dark"] #depositInlineApp #methodModal .inline-extra-label > :not(.inline-extra-badge), body.dark-mode #depositInlineApp #methodModal .inline-extra-label > :not(.inline-extra-badge), html[data-theme="light"] #depositInlineApp #methodModal .inline-extra-label > :not(.inline-extra-badge), body.light-mode #depositInlineApp #methodModal .inline-extra-label > :not(.inline-extra-badge){background:var(--bg-app) !important;background-image:none !important;color:var(--text) !important;border:1px solid rgba(var(--site-accent-rgb, 148, 163, 184), .42) !important;box-shadow:0 0 0 1px rgba(var(--site-accent-rgb, 148, 163, 184), .08) inset !important;}',
      '#depositInlineApp #methodModal .copy-value-btn, html[data-theme="light"] #depositInlineApp #methodModal .copy-value-btn, body.light-mode #depositInlineApp #methodModal .copy-value-btn{background:var(--bg-app) !important;background-image:none !important;color:var(--text) !important;border-color:rgba(var(--site-accent-rgb, 148, 163, 184), .42) !important;box-shadow:none !important;}',
      '#depositInlineApp #methodModal .copy-value-btn:hover, html[data-theme="light"] #depositInlineApp #methodModal .copy-value-btn:hover, body.light-mode #depositInlineApp #methodModal .copy-value-btn:hover{background:var(--bg-app) !important;box-shadow:none !important;}',
      '#depositInlineApp #methodModal .calc .field, html[data-theme="dark"] #depositInlineApp #methodModal .calc .field, body.dark-mode #depositInlineApp #methodModal .calc .field, html[data-theme="light"] #depositInlineApp #methodModal .calc .field, body.light-mode #depositInlineApp #methodModal .calc .field{padding:10px 0 0 !important;border:0 !important;background:transparent !important;background-image:none !important;box-shadow:none !important;border-radius:0 !important;}',
      '#depositInlineApp #methodModal .calc input, html[data-theme="dark"] #depositInlineApp #methodModal .calc input, body.dark-mode #depositInlineApp #methodModal .calc input, html[data-theme="light"] #depositInlineApp #methodModal .calc input, body.light-mode #depositInlineApp #methodModal .calc input{height:46px !important;min-height:46px !important;padding:0 16px !important;border-radius:999px !important;border:1px solid rgba(var(--site-accent-rgb, 148, 163, 184), .36) !important;background:var(--bg-app) !important;background-image:none !important;color:var(--text) !important;-webkit-text-fill-color:currentColor !important;box-shadow:none !important;}',
      '#depositInlineApp #methodModal :is(.btn-primary,.btn-outline,#proofTrigger.inline-proof-trigger,#submitDepositBtn), html[data-theme="light"] #depositInlineApp #methodModal :is(.btn-primary,.btn-outline,#proofTrigger.inline-proof-trigger,#submitDepositBtn), body.light-mode #depositInlineApp #methodModal :is(.btn-primary,.btn-outline,#proofTrigger.inline-proof-trigger,#submitDepositBtn){background:linear-gradient(180deg,rgba(var(--site-accent-rgb, 148, 163, 184), .10),rgba(var(--site-accent-rgb, 148, 163, 184), .04)),var(--bg-app) !important;color:var(--text) !important;border:1px solid rgba(var(--site-accent-rgb, 148, 163, 184), .42) !important;box-shadow:none !important;}',
      '#depositInlineApp #methodModal :is(.btn-primary,.btn-outline,#proofTrigger.inline-proof-trigger,#submitDepositBtn):hover, html[data-theme="light"] #depositInlineApp #methodModal :is(.btn-primary,.btn-outline,#proofTrigger.inline-proof-trigger,#submitDepositBtn):hover, body.light-mode #depositInlineApp #methodModal :is(.btn-primary,.btn-outline,#proofTrigger.inline-proof-trigger,#submitDepositBtn):hover{background:linear-gradient(180deg,rgba(var(--site-accent-rgb, 148, 163, 184), .14),rgba(var(--site-accent-rgb, 148, 163, 184), .06)),var(--bg-app) !important;border-color:rgba(var(--site-accent-rgb, 148, 163, 184), .50) !important;box-shadow:none !important;}',
      '#depositInlineApp #methodModal #proofTrigger.inline-proof-trigger :is(.inline-proof-trigger-label,.inline-proof-trigger-icon), html[data-theme="light"] #depositInlineApp #methodModal #proofTrigger.inline-proof-trigger :is(.inline-proof-trigger-label,.inline-proof-trigger-icon), body.light-mode #depositInlineApp #methodModal #proofTrigger.inline-proof-trigger :is(.inline-proof-trigger-label,.inline-proof-trigger-icon){color:var(--text) !important;}',
      '#depositInlineApp #methodModal .inline-extra-label, html[data-theme="dark"] #depositInlineApp #methodModal .inline-extra-label, body.dark-mode #depositInlineApp #methodModal .inline-extra-label, html[data-theme="light"] #depositInlineApp #methodModal .inline-extra-label, body.light-mode #depositInlineApp #methodModal .inline-extra-label{background:transparent !important;background-image:none !important;border:0 !important;box-shadow:none !important;outline:0 !important;}',
      '#depositInlineApp #methodModal .inline-extra-label > :not(.inline-extra-badge), html[data-theme="dark"] #depositInlineApp #methodModal .inline-extra-label > :not(.inline-extra-badge), body.dark-mode #depositInlineApp #methodModal .inline-extra-label > :not(.inline-extra-badge), html[data-theme="light"] #depositInlineApp #methodModal .inline-extra-label > :not(.inline-extra-badge), body.light-mode #depositInlineApp #methodModal .inline-extra-label > :not(.inline-extra-badge){background:transparent !important;background-image:none !important;border:0 !important;box-shadow:none !important;outline:0 !important;color:var(--text) !important;padding-inline:2px !important;}',
      '#depositInlineApp #methodModal .inline-extra-label > :not(.inline-extra-badge), html[data-theme="dark"] #depositInlineApp #methodModal .inline-extra-label > :not(.inline-extra-badge), body.dark-mode #depositInlineApp #methodModal .inline-extra-label > :not(.inline-extra-badge), html[data-theme="light"] #depositInlineApp #methodModal .inline-extra-label > :not(.inline-extra-badge), body.light-mode #depositInlineApp #methodModal .inline-extra-label > :not(.inline-extra-badge){display:inline-flex !important;align-items:center !important;justify-content:center !important;min-height:26px !important;padding:0 8px !important;border-radius:999px !important;background:var(--bg-app) !important;background-image:none !important;color:var(--text) !important;border:1px solid rgba(var(--site-accent-rgb, 148, 163, 184), .42) !important;box-shadow:0 0 0 1px rgba(var(--site-accent-rgb, 148, 163, 184), .08) inset !important;}'
    ].join('');
    document.head.appendChild(style);
  }

  function getInlineExtraDraftKey(method){
    return String(method && (method.id || method.methodId || (method.data && method.data.id)) || '').trim().toUpperCase();
  }

  function readInlineExtraDraftValues(method){
    const draftKey = getInlineExtraDraftKey(method);
    if (!draftKey || !inlineExtraFieldDrafts[draftKey] || typeof inlineExtraFieldDrafts[draftKey] !== 'object') {
      return {};
    }
    return inlineExtraFieldDrafts[draftKey];
  }

  function writeInlineExtraDraftValue(method, fieldKey, value){
    const draftKey = getInlineExtraDraftKey(method);
    if (!draftKey || !fieldKey) return;
    if (!inlineExtraFieldDrafts[draftKey] || typeof inlineExtraFieldDrafts[draftKey] !== 'object') {
      inlineExtraFieldDrafts[draftKey] = {};
    }
    inlineExtraFieldDrafts[draftKey][fieldKey] = String(value == null ? '' : value);
  }

  function clearInlineExtraDraft(method){
    const draftKey = getInlineExtraDraftKey(method);
    if (!draftKey) return;
    delete inlineExtraFieldDrafts[draftKey];
  }

  function ensureInlineExtraFieldsMount(){
    if (hasNativeInlineMethodModal()) return null;
    if (!methodInfo || !methodInfo.appendChild) return null;
    ensureInlineExtraFieldsStyles();
    let mount = (document && typeof document.getElementById === 'function')
      ? document.getElementById(INLINE_EXTRA_FIELDS_MOUNT_ID)
      : null;
    if (mount) {
      try {
        if (methodInfo && methodInfo.nextElementSibling !== mount) {
          if (typeof methodInfo.insertAdjacentElement === 'function') {
            methodInfo.insertAdjacentElement('afterend', mount);
          } else if (methodInfo.parentNode) {
            methodInfo.parentNode.insertBefore(mount, methodInfo.nextSibling);
          }
        }
      } catch (_) {}
      return mount;
    }
    mount = document.createElement('section');
    mount.id = INLINE_EXTRA_FIELDS_MOUNT_ID;
    mount.className = 'inline-extra-fields';
    mount.hidden = true;
    mount.innerHTML = '<div class="inline-extra-fields-head"><strong>بيانات العميل</strong></div><div class="inline-extra-fields-grid" data-inline-extra-grid></div>';
    mount.innerHTML = '<div class="inline-extra-fields-grid" data-inline-extra-grid></div>';
    if (methodInfo && typeof methodInfo.insertAdjacentElement === 'function') {
      methodInfo.insertAdjacentElement('afterend', mount);
    } else if (methodInfo.parentNode) {
      methodInfo.parentNode.insertBefore(mount, methodInfo.nextSibling);
    } else {
      methodInfo.appendChild(mount);
    }
    return mount;
  }

  function resolveInlineExtraFieldInputType(field){
    const kind = String(field && field.kind || '').trim().toLowerCase();
    if (kind === 'number') return 'number';
    if (kind === 'tel') return 'tel';
    if (kind === 'email') return 'email';
    if (kind === 'password') return 'password';
    return 'text';
  }

  function resolveInlineExtraFieldInputMode(field){
    const kind = String(field && field.kind || '').trim().toLowerCase();
    if (kind === 'number') return 'decimal';
    if (kind === 'tel') return 'tel';
    if (kind === 'email') return 'email';
    return '';
  }

  function inlineExtraFieldUsesLtr(field){
    const kind = String(field && field.kind || '').trim().toLowerCase();
    return kind === 'number' || kind === 'tel' || kind === 'email';
  }

  function findInlineExtraFieldControl(key){
    const mount = ensureInlineExtraFieldsMount();
    if (!mount || !key) return null;
    const controls = mount.querySelectorAll('[data-inline-extra-key]');
    for (let i = 0; i < controls.length; i += 1) {
      if (String(controls[i].dataset.inlineExtraKey || '') === String(key)) return controls[i];
    }
    return null;
  }

  function renderInlineExtraFields(method){
    if (hasNativeInlineMethodModal()) return;
    const mount = ensureInlineExtraFieldsMount();
    if (!mount) return;
    const grid = mount.querySelector('[data-inline-extra-grid]');
    if (!grid) return;
    const fields = getInlineMethodExtraFields(method);
    grid.innerHTML = '';
    if (!fields.length) {
      mount.hidden = true;
      return;
    }
    mount.hidden = false;
    const draftValues = readInlineExtraDraftValues(method);
    fields.forEach(function(field, idx){
      const row = document.createElement('div');
      row.className = 'inline-extra-field';

      const fieldId = 'inline-extra-' + String(field.key || ('field_' + (idx + 1))).replace(/[^a-z0-9_-]+/ig, '-');
      const label = document.createElement('label');
      label.className = 'inline-extra-label';
      label.setAttribute('for', fieldId);

      const labelText = document.createElement('span');
      labelText.textContent = field.label;
      label.appendChild(labelText);


      let control = null;
      if (field.kind === 'select') {
        control = document.createElement('select');
        const placeholderOption = document.createElement('option');
        placeholderOption.value = '';
        placeholderOption.textContent = field.placeholder || ('اختر ' + field.label);
        if (field.required) placeholderOption.disabled = true;
        control.appendChild(placeholderOption);
        (Array.isArray(field.options) ? field.options : []).forEach(function(option){
          const optionEl = document.createElement('option');
          optionEl.value = String(option && option.value != null ? option.value : '').trim();
          optionEl.textContent = String(option && option.label != null ? option.label : optionEl.value).trim();
          if (!optionEl.value && !optionEl.textContent) return;
          control.appendChild(optionEl);
        });
      } else if (field.kind === 'textarea') {
        control = document.createElement('textarea');
        control.rows = 3;
      } else {
        control = document.createElement('input');
        control.type = resolveInlineExtraFieldInputType(field);
        const inputMode = resolveInlineExtraFieldInputMode(field);
        if (inputMode) control.inputMode = inputMode;
      }

      control.id = fieldId;
      control.className = 'inline-extra-control';
      control.dataset.inlineExtraKey = field.key;
      if (inlineExtraFieldUsesLtr(field)) {
        control.dataset.dir = 'ltr';
        control.setAttribute('dir', 'ltr');
      } else {
        control.setAttribute('dir', 'rtl');
      }
      if (field.required) control.required = true;
      control.autocomplete = 'off';
      control.spellcheck = false;
      if (field.placeholder && control.tagName !== 'SELECT') control.placeholder = field.placeholder;

      const draftValue = Object.prototype.hasOwnProperty.call(draftValues, field.key) ? draftValues[field.key] : '';
      if (draftValue) {
        control.value = draftValue;
      } else if (control.tagName === 'SELECT') {
        control.value = '';
      }

      const onControlChange = function(){
        writeInlineExtraDraftValue(method, field.key, control.value);
        control.classList.remove('is-invalid');
        try { updateSubmitState(); } catch (_) {}
      };
      control.addEventListener('input', onControlChange);
      control.addEventListener('change', onControlChange);

      row.appendChild(label);
      row.appendChild(control);

      grid.appendChild(row);
    });
    syncInlineModalDirection();
  }

  function collectInlineExtraFields(method, silent){
    if (hasNativeInlineMethodModal()) return collectNativeInlineExtraFields(method, silent);
    const fields = getInlineMethodExtraFields(method);
    if (!fields.length) return { ok: true, values: {} };
    const mount = ensureInlineExtraFieldsMount();
    if (!mount || mount.hidden) return { ok: true, values: {} };
    const values = {};
    let firstInvalid = null;
    fields.forEach(function(field){
      const control = findInlineExtraFieldControl(field.key);
      const value = control ? String(control.value || '').trim() : '';
      if (control) control.classList.remove('is-invalid');
      if (field.required && !value && !firstInvalid) {
        firstInvalid = { field: field, control: control };
      }
      if (value) values[field.key] = value;
    });
    if (firstInvalid) {
      if (firstInvalid.control) {
        if (!silent) {
          firstInvalid.control.classList.add('is-invalid');
          try { markInlineMissingControl(firstInvalid.control); } catch (_) {}
        }
      }
      if (!silent) {
        try {
          if (firstInvalid.control && typeof firstInvalid.control.focus === 'function') firstInvalid.control.focus();
        } catch (_) {}
      }
      return { ok: false, values: {} };
    }
    return { ok: true, values: values };
  }

  function clearInlineExtraFields(method){
    if (hasNativeInlineMethodModal()) {
      clearInlineExtraDraft(method);
      return;
    }
    const mount = ensureInlineExtraFieldsMount();
    if (mount) {
      const grid = mount.querySelector('[data-inline-extra-grid]');
      if (grid) grid.innerHTML = '';
      mount.hidden = true;
    }
    clearInlineExtraDraft(method);
  }

  function bindInlineExtraFieldCleanup(){
    if (hasNativeInlineMethodModal()) return;
    const activeCloseX = methodModal && methodModal.querySelector ? methodModal.querySelector('.modal-x') : null;
    if (closeModal && !closeModal.dataset.boundInlineExtraCleanup) {
      closeModal.dataset.boundInlineExtraCleanup = '1';
      closeModal.addEventListener('click', function(){
        clearInlineExtraFields(currentMethod);
      }, true);
    }
    if (activeCloseX && !activeCloseX.dataset.boundInlineExtraCleanup) {
      activeCloseX.dataset.boundInlineExtraCleanup = '1';
      activeCloseX.addEventListener('click', function(){
        clearInlineExtraFields(currentMethod);
      }, true);
    }
    if (methodModal && !methodModal.dataset.boundInlineExtraCleanup) {
      methodModal.dataset.boundInlineExtraCleanup = '1';
      methodModal.addEventListener('click', function(event){
        if (event && event.target === methodModal) {
          if (methodModal.classList && methodModal.classList.contains('inline-method-page')) return;
          clearInlineExtraFields(currentMethod);
        }
      }, true);
    }
  }

  if (typeof collectDynamicExtraFields === 'function') {
    const __originalInlineCollectDynamicExtraFields = collectDynamicExtraFields;
    collectDynamicExtraFields = function(method, silent){
      const fields = getInlineMethodExtraFields(method);
      if (!fields.length) return { ok: true, values: {} };
      const quiet = silent === true;
      if (hasNativeInlineMethodModal()) return collectNativeInlineExtraFields(method, quiet);
      const mount = ensureInlineExtraFieldsMount();
      if (!mount || mount.hidden) return __originalInlineCollectDynamicExtraFields(method, quiet);
      return collectInlineExtraFields(method, quiet);
    };
  }

  function isInlineWithdrawFlowActive(){
    return false;
  }

  function getInlineCurrentExtraValidation(method){
    if (!method) return { ok: true, values: {} };
    return hasNativeInlineMethodModal()
      ? collectNativeInlineExtraFields(method, true)
      : collectInlineExtraFields(method, true);
  }

  function getInlineModalFieldLabel(fieldId){
    const safeFieldId = String(fieldId || '').trim();
    if (!safeFieldId) return null;
    try {
      return (document && typeof document.querySelector === 'function')
        ? document.querySelector('label[for="' + safeFieldId + '"]')
        : null;
    } catch (_) {
      return null;
    }
  }

  function getInlineProofTriggerEl(){
    try {
      if (typeof proofTrigger !== 'undefined' && proofTrigger) return proofTrigger;
    } catch (_) {}
    try {
      return (document && typeof document.getElementById === 'function')
        ? document.getElementById('proofTrigger')
        : null;
    } catch (_) {
      return null;
    }
  }

  function getInlineProofPreviewEl(){
    try {
      if (typeof proofPreview !== 'undefined' && proofPreview) return proofPreview;
    } catch (_) {}
    try {
      return (document && typeof document.getElementById === 'function')
        ? document.getElementById('proofPreview')
        : null;
    } catch (_) {
      return null;
    }
  }

  function getInlineProofFileEl(){
    try {
      if (typeof proofFileEl !== 'undefined' && proofFileEl) return proofFileEl;
    } catch (_) {}
    try {
      return (document && typeof document.getElementById === 'function')
        ? document.getElementById('proofFile')
        : null;
    } catch (_) {
      return null;
    }
  }

  function resolveInlineModalMethodCurrency(method){
    const data = method && method.data && typeof method.data === 'object' ? method.data : {};
    return normalizeInlineCurrencyCode(
      data.currencyCode ||
      data.currency ||
      data.currency_code ||
      data.payCurrency ||
      data.payCurrencyCode ||
      ''
    ) || 'USD';
  }

  function resolveInlineModalDirection(){
    try {
      const root = document && document.documentElement ? document.documentElement : null;
      const explicitDir = String(root && root.getAttribute ? (root.getAttribute('dir') || '') : '').trim().toLowerCase();
      if (explicitDir === 'rtl' || explicitDir === 'ltr') return explicitDir;
    } catch (_) {}
    return 'rtl';
  }

  function applyInlineModalChipDirection(target){
    if (!target || !target.style) return;
    const dir = resolveInlineModalDirection();
    const isRtl = dir === 'rtl';
    try { target.style.setProperty('inset-inline-start', isRtl ? 'auto' : '12px', 'important'); } catch (_) {}
    try { target.style.setProperty('inset-inline-end', isRtl ? '12px' : 'auto', 'important'); } catch (_) {}
    try { target.style.setProperty('left', isRtl ? 'auto' : '12px', 'important'); } catch (_) {}
    try { target.style.setProperty('right', isRtl ? '12px' : 'auto', 'important'); } catch (_) {}
    try { target.style.setProperty('text-align', isRtl ? 'right' : 'left', 'important'); } catch (_) {}
    try { target.style.setProperty('direction', dir, 'important'); } catch (_) {}
  }

  function syncInlineModalDirection(){
    try {
      const modal = (document && typeof document.getElementById === 'function')
        ? document.getElementById('methodModal')
        : null;
      if (!modal || !modal.querySelectorAll) return;
      const dir = resolveInlineModalDirection();
      try { modal.setAttribute('dir', dir); } catch (_) {}
      const modalContent = modal.querySelector('.modal-content');
      if (modalContent) {
        try { modalContent.setAttribute('dir', dir); } catch (_) {}
        try { modalContent.style.setProperty('direction', dir, 'important'); } catch (_) {}
      }
      const calcFields = modal.querySelectorAll('.calc .field');
      calcFields.forEach(function(field){
        try { field.setAttribute('dir', dir); } catch (_) {}
        try { field.style.setProperty('direction', dir, 'important'); } catch (_) {}
      });
      const labelTargets = modal.querySelectorAll('.calc label, #methodInfo .info-item > strong, #methodInfo .inline-native-fee-item > strong, .info-item strong, .info-item-fee strong, .inline-extra-label, #dynamicExtraFields .dynamic-extra-label');
      labelTargets.forEach(function(target){
        applyInlineModalChipDirection(target);
      });
    } catch (_) {}
  }

  function applyInlineFlowModalState(method){
    const isWithdraw = isInlineWithdrawFlowActive();
    const proofEnabled = resolveInlineMethodRequiresProof(method || null);
    const methodCurrency = resolveInlineModalMethodCurrency(method);
    const payLabel = getInlineModalFieldLabel('sendJOD');
    const recvLabel = getInlineModalFieldLabel('recvCUR');
    const proofTriggerEl = getInlineProofTriggerEl();
    const proofPreviewEl = getInlineProofPreviewEl();
    const proofFileInputEl = getInlineProofFileEl();
    const actionsEl = submitDepositBtn && submitDepositBtn.parentElement
      ? submitDepositBtn.parentElement
      : (proofTriggerEl && proofTriggerEl.parentElement ? proofTriggerEl.parentElement : null);

    if (payLabel) {
      payLabel.textContent = 'المبلغ (' + methodCurrency + ')';
    }
    if (recvLabel) {
      recvLabel.textContent = isWithdraw ? 'سيُضاف (USD)' : 'سيُضاف لحسابك';
    }
    try {
      if (isWithdraw) { if (typeof hideRecvCurrencyChip === 'function') hideRecvCurrencyChip(); }
      else if (typeof ensureRecvCurrencyChip === 'function') { ensureRecvCurrencyChip(); refreshRecvCurrencyChipLabel(); }
    } catch (_) {}
    if (submitDepositBtn) {
      submitDepositBtn.innerHTML = '<i class="fa-solid fa-paper-plane" aria-hidden="true"></i><span>طلب</span>';
    }
    syncInlineModalDirection();

    if (proofTriggerEl) {
      proofTriggerEl.hidden = !proofEnabled;
      if (!proofEnabled) proofTriggerEl.style.setProperty('display', 'none', 'important');
      else proofTriggerEl.style.removeProperty('display');
    }
    if (proofPreviewEl) {
      if (!proofEnabled) {
        proofPreviewEl.hidden = true;
        proofPreviewEl.textContent = '';
        proofPreviewEl.style.setProperty('display', 'none', 'important');
      } else {
        proofPreviewEl.hidden = false;
        proofPreviewEl.style.removeProperty('display');
      }
    }
    if (proofFileInputEl && !proofEnabled) {
      try { proofFileInputEl.value = ''; } catch (_) {}
    }

    if (!proofEnabled) {
      try { if (typeof currentProofFile !== 'undefined') currentProofFile = null; } catch (_) {}
      try { if (typeof uploadedProofUrl !== 'undefined') uploadedProofUrl = ''; } catch (_) {}
      try { if (typeof proofUploadPending !== 'undefined') proofUploadPending = false; } catch (_) {}
      if (actionsEl && actionsEl.style) actionsEl.style.gridTemplateColumns = '1fr';
      if (submitDepositBtn && submitDepositBtn.style) submitDepositBtn.style.gridColumn = '1 / -1';
      try { if (actionsEl && actionsEl.classList) actionsEl.classList.remove('inline-proof-stacked'); } catch (_) {}
    } else {
      if (actionsEl && actionsEl.style) actionsEl.style.removeProperty('grid-template-columns');
      if (submitDepositBtn && submitDepositBtn.style) submitDepositBtn.style.removeProperty('grid-column');
      try { if (typeof updateProofUI === 'function') updateProofUI(); } catch (_) {}
      syncInlineProofTriggerLabel(method || null);
      try { scheduleInlineProofActionsLayoutCheck(); } catch (_) {}
    }
  }

  if (typeof updateProofUI === 'function') {
    const __originalInlineUpdateProofUI = updateProofUI;
    updateProofUI = function(){
      const result = __originalInlineUpdateProofUI.apply(this, arguments);
      try { syncInlineProofTriggerLabel(typeof currentMethod !== 'undefined' ? currentMethod : null); } catch (_) {}
      try { clearInlineInvalidMarker(getInlineProofTriggerEl()); } catch (_) {}
      return result;
    };
  }

  function normalizeInlineEnglishDigits(value){
    return String(value == null ? '' : value)
      .replace(/[٠-٩]/g, function(digit){ return String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)); })
      .replace(/[۰-۹]/g, function(digit){ return String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)); })
      .replace(/\u066B/g, '.')
      .replace(/\u066C/g, '');
  }

  function normalizeInlineNumericControlValue(control){
    try {
      if (!control || typeof control.value !== 'string') return;
      const isCalcAmount = !!(control.closest && control.closest('#methodModal .calc'));
      if (isCalcAmount) {
        try { control.setAttribute('lang', 'en'); } catch (_) {}
        try { control.setAttribute('dir', 'ltr'); } catch (_) {}
        try { control.inputMode = 'decimal'; } catch (_) {}
        try { control.autocomplete = 'off'; } catch (_) {}
        try { control.style.setProperty('direction', 'ltr', 'important'); } catch (_) {}
        try { control.style.setProperty('unicode-bidi', 'plaintext', 'important'); } catch (_) {}
        try { control.style.setProperty('font-family', 'Arial, \"Segoe UI\", sans-serif', 'important'); } catch (_) {}
        try {
          if (String(control.type || '').toLowerCase() === 'number') control.type = 'text';
        } catch (_) {}
      }
      const normalized = normalizeInlineEnglishDigits(control.value);
      if (normalized !== control.value) control.value = normalized;
    } catch (_) {}
  }

  function bindInlineEnglishDigitInputs(){
    try {
      if (window.__depositInlineEnglishDigitInputsBound__) return;
      window.__depositInlineEnglishDigitInputsBound__ = true;
    } catch (_) {}
    const selector = '#depositInlineApp #methodModal input, #depositInlineApp #methodModal textarea';
    document.addEventListener('input', function(event){
      const target = event && event.target;
      if (!target || !target.matches || !target.matches(selector)) return;
      normalizeInlineNumericControlValue(target);
      clearInlineInvalidMarker(target);
    }, true);
  }

  function bindInlineNativeContextMenu(){
    try {
      if (window.__depositInlineNativeContextMenuBound__) return;
      window.__depositInlineNativeContextMenuBound__ = true;
    } catch (_) {}
    document.addEventListener('contextmenu', function(event){
      try {
        const target = event && event.target;
        if (!target || !target.closest) return;
        const modal = target.closest('#depositInlineApp #methodModal, #depositInlineApp .modal, .swal2-container, .swal2-popup');
        if (!modal) return;
        if (event.defaultPrevented && typeof event.preventDefault === 'function') {
          try { event.returnValue = true; } catch (_) {}
        }
        if (typeof event.stopPropagation === 'function') event.stopPropagation();
      } catch (_) {}
    }, true);
  }

  function refreshInlineModalNumericValues(){
    try {
      const modal = typeof methodModal !== 'undefined' ? methodModal : null;
      if (!modal || !modal.querySelectorAll) return;
      modal.querySelectorAll('input, textarea').forEach(function(control){
        normalizeInlineNumericControlValue(control);
      });
    } catch (_) {}
  }

  function clearInlineInvalidMarker(control){
    try {
      if (!control || !control.classList) return;
      control.classList.remove('is-inline-invalid', 'is-inline-shake');
      const holder = control.closest ? control.closest('.field, .inline-extra-field, .dynamic-extra-field') : null;
      if (holder && holder.classList) holder.classList.remove('is-inline-invalid', 'is-inline-shake');
    } catch (_) {}
  }

  function markInlineMissingControl(control){
    try {
      if (!control) return false;
      try {
        const until = Number(window.__depositInlineSuppressInitialFocusUntil || 0);
        const modal = control.closest ? control.closest('#depositInlineApp #methodModal.inline-method-page') : null;
        if (modal && until && Date.now() <= until) {
          clearInlineMethodInitialFocus(modal);
          return false;
        }
      } catch (_) {}
      const holder = control.closest ? control.closest('.field, .inline-extra-field, .dynamic-extra-field') : null;
      const target = holder || control;
      if (control.classList) control.classList.add('is-inline-invalid');
      if (target && target.classList) {
        target.classList.remove('is-inline-shake');
        void target.offsetWidth;
        target.classList.add('is-inline-invalid', 'is-inline-shake');
      }
      try { if (typeof control.focus === 'function') control.focus({ preventScroll: true }); } catch (_) {
        try { if (typeof control.focus === 'function') control.focus(); } catch (__) {}
      }
      try { if (target && typeof target.scrollIntoView === 'function') target.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (_) {}
      return true;
    } catch (_) {
      return false;
    }
  }

  function getInlineFirstMissingSubmitControl(method){
    try {
      if (!method) return null;
      refreshInlineModalNumericValues();
      if (typeof amountsValid === 'function' && !amountsValid()) {
        if (isInlineWithdrawFlowActive()) return (typeof recvCUR !== 'undefined' && recvCUR) ? recvCUR : null;
        return (typeof sendJOD !== 'undefined' && sendJOD) ? sendJOD : ((typeof recvCUR !== 'undefined' && recvCUR) ? recvCUR : null);
      }
      const fields = getInlineMethodExtraFields(method);
      for (let i = 0; i < fields.length; i += 1) {
        const field = fields[i];
        if (!field || !field.required) continue;
        let control = null;
        if (hasNativeInlineMethodModal()) {
          const controls = (typeof dynamicExtraFieldsGrid !== 'undefined' && dynamicExtraFieldsGrid && dynamicExtraFieldsGrid.querySelectorAll)
            ? Array.from(dynamicExtraFieldsGrid.querySelectorAll('.dynamic-extra-control'))
            : [];
          control = controls.find(function(entry){
            return String(entry && entry.dataset && entry.dataset.fieldKey || '') === String(field && field.key || '');
          }) || null;
        } else {
          control = findInlineExtraFieldControl(field.key);
        }
        if (control && !String(control.value || '').trim()) return control;
      }
      if (!isInlineWithdrawFlowActive() && resolveInlineMethodRequiresProof(method)) {
        let hasProof = false;
        try { hasProof = !!String(typeof uploadedProofUrl !== 'undefined' ? (uploadedProofUrl || '') : '').trim(); } catch (_) {}
        if (!hasProof) return getInlineProofTriggerEl();
      }
    } catch (_) {}
    return null;
  }

  bindInlineEnglishDigitInputs();
  bindInlineNativeContextMenu();

  if (typeof updateSubmitState === 'function') {
    const __originalInlineUpdateSubmitState = updateSubmitState;
    updateSubmitState = function(){
      const result = __originalInlineUpdateSubmitState.apply(this, arguments);
      try {
        refreshInlineModalNumericValues();
        if (submitDepositBtn && currentMethod) {
          const validation = getInlineCurrentExtraValidation(currentMethod);
          const okAmounts = (typeof amountsValid === 'function') ? !!amountsValid() : true;
          var hasProof = false;
          try { hasProof = !!String(typeof uploadedProofUrl !== 'undefined' ? (uploadedProofUrl || '') : '').trim(); } catch (_) {}
          const requiresProof = resolveInlineMethodRequiresProof(currentMethod);
          const missing = isInlineWithdrawFlowActive()
            ? !(okAmounts && validation.ok)
            : !(okAmounts && validation.ok && (!requiresProof || hasProof));
          submitDepositBtn.disabled = !currentMethod;
          try { submitDepositBtn.dataset.inlineMissing = missing ? '1' : '0'; } catch (_) {}
        }
        applyInlineFlowModalState(typeof currentMethod !== 'undefined' ? currentMethod : null);
      } catch (_) {}
      return result;
    };
  }

  try {
    if (submitDepositBtn && !submitDepositBtn.__inlineMissingClickBound) {
      submitDepositBtn.__inlineMissingClickBound = true;
      submitDepositBtn.addEventListener('click', function(event){
        try {
          const method = typeof currentMethod !== 'undefined' ? currentMethod : null;
          const missingControl = getInlineFirstMissingSubmitControl(method);
          if (!missingControl) return;
          event.preventDefault();
          event.stopPropagation();
          if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
          markInlineMissingControl(missingControl);
        } catch (_) {}
      }, true);
    }
  } catch (_) {}

  try { globalThis.resolveInlineMethodRequiresProof = resolveInlineMethodRequiresProof; } catch (_) {}
  try { globalThis.resolveInlineMethodProofButtonLabel = resolveInlineMethodProofButtonLabel; } catch (_) {}
  try { refreshNativeInlineMethodUi(typeof currentMethod !== 'undefined' ? currentMethod : null); } catch (_) {}
  try { applyInlineFlowModalState(typeof currentMethod !== 'undefined' ? currentMethod : null); } catch (_) {}
  if (!window.__inlineModalDirectionWatcherBound__) {
    try {
      window.addEventListener('language:change', syncInlineModalDirection);
    } catch (_) {}
    try {
      if (typeof MutationObserver !== 'undefined' && document && document.documentElement) {
        const inlineModalDirectionObserver = new MutationObserver(function(mutations){
          for (let i = 0; i < mutations.length; i += 1) {
            const attrName = String(mutations[i] && mutations[i].attributeName || '');
            if (attrName === 'lang' || attrName === 'dir' || attrName === 'data-lang') {
              syncInlineModalDirection();
              break;
            }
          }
        });
        inlineModalDirectionObserver.observe(document.documentElement, {
          attributes: true,
          attributeFilter: ['lang', 'dir', 'data-lang']
        });
      }
    } catch (_) {}
    try { window.__inlineModalDirectionWatcherBound__ = true; } catch (_) {}
  }

  if (typeof getMethodNoteText === 'function') {
    const __originalInlineGetMethodNoteText = getMethodNoteText;
    getMethodNoteText = function(data){
      return sanitizeInlineClientMethodNote(__originalInlineGetMethodNoteText.apply(this, arguments));
    };
  }

  if (typeof renderMethodInfo === 'function') {
    const __originalInlineRenderMethodInfo = renderMethodInfo;
    renderMethodInfo = function(){
      const result = __originalInlineRenderMethodInfo.apply(this, arguments);
      const method = typeof currentMethod !== 'undefined' ? currentMethod : null;
      try { renderInlineMethodInfo(method); } catch (_) {}
      refreshNativeInlineMethodUi(method);
      applyInlineFlowModalState(method);
      return result;
    };
  }

  if (typeof renderDynamicExtraFields === 'function') {
    const __originalInlineRenderDynamicExtraFields = renderDynamicExtraFields;
    renderDynamicExtraFields = function(){
      const result = __originalInlineRenderDynamicExtraFields.apply(this, arguments);
      const method = typeof currentMethod !== 'undefined' ? currentMethod : null;
      refreshNativeInlineMethodUi(method);
      applyInlineFlowModalState(method);
      return result;
    };
  }

  if (typeof applyMethodHintText === 'function') {
    applyMethodHintText = function(){
      const method = arguments.length ? arguments[0] : null;
      return applyNativeClientHint(method);
    };
  }

  if (typeof loadDepositHintFromSiteState === 'function') {
    loadDepositHintFromSiteState = async function(){
      return '';
    };
  }

  bindInlineExtraFieldCleanup();

  function normalizeInlineModalActionText(value){
    return String(value == null ? '' : value)
      .replace(/[\u064B-\u065F\u0670]/g, '')
      .replace(/[أإآ]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function looksLikeInlineDepositSuccessModal(node){
    if (!node || node.nodeType !== 1) return false;
    const rawText = String(node.textContent || '').trim();
    if (!rawText) return false;
    const text = normalizeInlineModalActionText(rawText);
    if (!text) return false;
    return (
      text.includes(normalizeInlineModalActionText('تم تقديم طلب الإيداع بنجاح')) ||
      text.includes(normalizeInlineModalActionText('Your deposit request has been submitted successfully')) ||
      (
        text.includes(normalizeInlineModalActionText('نسخ الكود')) &&
        /dep[a-z0-9]{6,}/i.test(rawText)
      )
    );
  }

  function findInlineDepositSuccessModal(target){
    if (!target) return null;
    const candidates = [];
    const seen = new Set();
    const push = function(node){
      if (!node || node.nodeType !== 1 || seen.has(node)) return;
      seen.add(node);
      candidates.push(node);
    };

    try {
      let node = target.nodeType === 1 ? target : target.parentElement;
      while (node) {
        push(node);
        node = node.parentElement;
      }
    } catch (_) {}

    try {
      const doc = target.ownerDocument || document;
      doc.querySelectorAll('[role="dialog"], [aria-modal="true"], .modal, .overlay, .popup, .dialog, .swal2-container, .swal2-popup, .transfer-modal-backdrop, .smm-inline-result-overlay')
        .forEach(push);
    } catch (_) {}

    for (let i = 0; i < candidates.length; i += 1) {
      if (looksLikeInlineDepositSuccessModal(candidates[i])) {
        return candidates[i];
      }
    }
    return null;
  }

  function dismissInlineDepositSuccessModal(root){
    if (!root) return false;
    const overlay =
      (root.id === 'zconfirm' ? root : null) ||
      (root.closest ? root.closest('#zconfirm') : null) ||
      root;

    try {
      if (typeof closeModalFn === 'function') {
        closeModalFn();
      }
    } catch (_) {}
    try {
      if (overlay && overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      } else if (overlay && typeof overlay.remove === 'function') {
        overlay.remove();
      }
    } catch (_) {
      try { if (overlay && typeof overlay.remove === 'function') overlay.remove(); } catch (__) {}
    }

    try {
      if (document.body) {
        document.body.classList.remove('modal-open', 'swal2-shown', 'swal2-height-auto', 'overflow-hidden', 'transfer-modal-open');
        document.body.style.removeProperty('overflow');
        document.body.style.removeProperty('padding-right');
      }
    } catch (_) {}
    try {
      if (document.documentElement) {
        document.documentElement.classList.remove('swal2-shown', 'swal2-height-auto', 'overflow-hidden', 'transfer-modal-open');
        document.documentElement.style.removeProperty('overflow');
      }
    } catch (_) {}
    try { setInlinePreloaderVisible(state.app, false); } catch (_) {}
    return true;
  }

  function bindInlineDepositSuccessDismiss(){
    try {
      if (window.__depositInlineSuccessDismissBound__) return;
      window.__depositInlineSuccessDismissBound__ = true;
    } catch (_) {}

    document.addEventListener('click', function(event){
      const button = event && event.target && event.target.closest
        ? event.target.closest('button, a, [role="button"], input[type="button"], input[type="submit"]')
        : null;
      if (!button) return;

      const actionText = normalizeInlineModalActionText(
        button.textContent ||
        button.value ||
        button.getAttribute('aria-label') ||
        ''
      );
      if (
        actionText !== 'حسنا' &&
        actionText !== 'ok' &&
        actionText !== 'okay' &&
        actionText !== 'اغلاق' &&
        actionText !== 'close'
      ) {
        return;
      }

      const successModal = findInlineDepositSuccessModal(button);
      if (!successModal) return;

      try { event.preventDefault(); } catch (_) {}
      try { event.stopPropagation(); } catch (_) {}
      try { if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation(); } catch (_) {}
      dismissInlineDepositSuccessModal(successModal);
    }, true);
  }

  let inlineAutoDepositLastPayload = null;
  let inlineAutoDepositLastPayloadAt = 0;
  let inlineAutoDepositLastAppliedKey = '';
  let inlineAutoDepositLastAppliedAt = 0;

  function getInlineAutoDepositMethodData(method){
    if (!method || typeof method !== 'object') return {};
    return method.data && typeof method.data === 'object' ? method.data : method;
  }

  function isInlineAutoDepositMethod(method){
    const data = getInlineAutoDepositMethodData(method);
    const methodId = String(
      (method && (method.id || method.methodId || method.method_id)) ||
      data.id ||
      data.methodId ||
      data.method_id ||
      ''
    ).trim().toLowerCase();
    if (methodId === 'usdt-auto' || methodId === 'usdtauto') return true;
    try {
      return parseInlineLooseBoolean(
        data.autoDeposit ??
        data.auto_deposit ??
        data.usdtAutoDeposit ??
        data.binanceAutoDeposit
      ) === true;
    } catch (_) {
      return !!(
        data.autoDeposit === true ||
        data.auto_deposit === true ||
        data.usdtAutoDeposit === true ||
        data.binanceAutoDeposit === true
      );
    }
  }

  function isCurrentInlineAutoDepositMethod(){
    try {
      const method = typeof currentMethod !== 'undefined' ? currentMethod : null;
      return isInlineAutoDepositMethod(method);
    } catch (_) {
      return false;
    }
  }

  function parseInlineAutoDepositConfirmAmount(value){
    const text = String(value == null ? '' : value).trim();
    if (!text) return null;
    const match = text.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
    if (!match) return null;
    const amount = Number(match[0]);
    return Number.isFinite(amount) && amount > 0 ? amount : null;
  }

  function rememberInlineAutoDepositPayload(data){
    if (!data || typeof data !== 'object') return;
    if (!isInlineAutoDepositResponse(data)) return;
    inlineAutoDepositLastPayload = data;
    inlineAutoDepositLastPayloadAt = Date.now();
    try {
      window.__lastInlineAutoDepositSuccessPayload__ = data;
      window.__lastInlineAutoDepositSuccessPayloadAt__ = inlineAutoDepositLastPayloadAt;
    } catch (_) {}
  }

  function getRecentInlineAutoDepositPayload(maxAgeMs = 8000){
    const now = Date.now();
    if (
      inlineAutoDepositLastPayload &&
      (now - Number(inlineAutoDepositLastPayloadAt || 0)) <= Math.max(1000, Number(maxAgeMs) || 8000)
    ) {
      return inlineAutoDepositLastPayload;
    }
    try {
      const globalPayload = window.__lastInlineAutoDepositSuccessPayload__;
      const globalPayloadAt = Number(window.__lastInlineAutoDepositSuccessPayloadAt__ || 0);
      if (
        globalPayload &&
        isInlineAutoDepositResponse(globalPayload) &&
        globalPayloadAt > 0 &&
        (now - globalPayloadAt) <= Math.max(1000, Number(maxAgeMs) || 8000)
      ) {
        return globalPayload;
      }
    } catch (_) {}
    return null;
  }

  function buildInlineAutoDepositPayloadFromConfirm(confirmPayload){
    const source = (confirmPayload && typeof confirmPayload === 'object') ? confirmPayload : {};
    const addedAmount = parseInlineAutoDepositConfirmAmount(source.addedUSD);
    return {
      success: true,
      autoDeposit: true,
      depositCode: String(source.code || '').trim(),
      amountUSD: addedAmount,
      addedAmount: addedAmount,
      addedCurrency: 'USD',
      currency: 'USD'
    };
  }

  function buildInlineAutoDepositApplyKey(data){
    const source = (data && typeof data === 'object') ? data : {};
    return String(
      source.depositCode ||
      source.code ||
      source.orderId ||
      source.networkTransactionId ||
      ''
    ).trim() || [
      resolveInlineAutoDepositAddedAmount(source) || '',
      resolveInlineAutoDepositBalance(source) || ''
    ].join('|');
  }

  function suppressInlineAutoDepositConfirm(confirmPayload){
    const recentPayload = getRecentInlineAutoDepositPayload();
    // Suppress the pending "submitted" modal for client-flagged auto methods
    // (Binance/USDT) AND when the server just auto-confirmed THIS deposit — e.g. an
    // SMS deposit whose bank receipt already arrived, so the submit response was
    // reshaped to the auto-deposit contract and the interceptor stashed it here.
    if (!isCurrentInlineAutoDepositMethod() && !recentPayload) return false;
    if (recentPayload) {
      applyInlineAutoDepositSuccessPayload(recentPayload);
    } else {
      const fallbackPayload = buildInlineAutoDepositPayloadFromConfirm(confirmPayload);
      const fallbackKey = buildInlineAutoDepositApplyKey(fallbackPayload);
      if (fallbackKey) {
        inlineAutoDepositLastAppliedKey = fallbackKey;
        inlineAutoDepositLastAppliedAt = Date.now();
      }
      showInlineAutoDepositAnimation(fallbackPayload);
    }
    try { closeModalFn(); } catch (_) {}
    try { setInlinePreloaderVisible(state.app, false); } catch (_) {}
    return true;
  }

  function normalizeInlineDepositRequestCodeText(value){
    return String(value == null ? '' : value)
      .replace(/\s+/g, '')
      .trim()
      .toUpperCase();
  }

  function polishInlineDepositSuccessCodes(target){
    try {
      const root = findInlineDepositSuccessModal(target || document.body);
      if (!root || !root.querySelectorAll) return false;
      let changed = false;
      root.querySelectorAll('*').forEach(function(el){
        if (!el || (el.children && el.children.length)) return;
        const raw = String(el.textContent || '');
        const code = normalizeInlineDepositRequestCodeText(raw);
        if (!/^DEP[A-Z0-9]{8,}$/i.test(code)) return;
        el.textContent = code;
        try { el.setAttribute('dir', 'ltr'); } catch (_) {}
        try { el.setAttribute('data-inline-deposit-request-code', '1'); } catch (_) {}
        try {
          el.style.direction = 'ltr';
          el.style.unicodeBidi = 'isolate';
          el.style.whiteSpace = 'nowrap';
          el.style.wordBreak = 'normal';
          el.style.overflowWrap = 'normal';
          el.style.display = 'inline-block';
          el.style.maxWidth = '100%';
          el.style.fontSize = '14px';
          el.style.lineHeight = '1.45';
          el.style.letterSpacing = '0';
        } catch (_) {}
        changed = true;
      });
      return changed;
    } catch (_) {
      return false;
    }
  }

  function scheduleInlineDepositSuccessCodePolish(){
    [0, 60, 180].forEach(function(delay){
      setTimeout(function(){
        polishInlineDepositSuccessCodes(document.body);
      }, delay);
    });
  }

  if (typeof showDepositConfirm === 'function') {
    const __originalInlineShowDepositConfirm = showDepositConfirm;
    showDepositConfirm = function(){
      try {
        if (suppressInlineAutoDepositConfirm(arguments && arguments[0])) {
          return false;
        }
        const result = __originalInlineShowDepositConfirm.apply(this, arguments);
        if (result === true) {
          try { beginInlineSubmitAwait(); } catch (_) {}
          try { scheduleInlineDepositSuccessCodePolish(); } catch (_) {}
        }
        return result;
      } catch (err) {
        const message = String(err && err.message ? err.message : err || '');
        const recoverable =
          message.includes('addEventListener') ||
          message.includes('Cannot read properties of null');
        if (!recoverable) throw err;
        try { console.warn('[deposit-inline] deposit confirm fallback', err); } catch (_) {}
        try { beginInlineSubmitAwait(); } catch (_) {}
        return true;
      }
    };
  }

  function setInlineSubmitBusy(active){
    let btn = null;
    try {
      btn = (typeof submitDepositBtn !== 'undefined' && submitDepositBtn) ? submitDepositBtn : null;
    } catch (_) {
      btn = null;
    }
    if (!btn) return;

    if (active) {
      try {
        if (btn.dataset.inlineBusy === '1') return;
        btn.dataset.inlineBusy = '1';
        if (!btn.dataset.inlineBusyHtml) btn.dataset.inlineBusyHtml = btn.innerHTML;
        btn.disabled = true;
        btn.setAttribute('aria-busy', 'true');
        btn.classList.add('is-loading');
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> جار التحقق...';
      } catch (_) {}
      return;
    }

    try {
      if (btn.dataset.inlineBusyHtml) btn.innerHTML = btn.dataset.inlineBusyHtml;
      delete btn.dataset.inlineBusy;
      delete btn.dataset.inlineBusyHtml;
      btn.removeAttribute('aria-busy');
      btn.classList.remove('is-loading');
    } catch (_) {}
  }

  function shouldTrackInlineSubmitRequest(resource){
    const url = String(
      typeof resource === 'string'
        ? resource
        : (resource && resource.url ? resource.url : '')
    ).trim();
    if (!url) return false;
    return isInlineWalletSubmitUrl(url) || isInlineAutoDepositSubmitUrl(url);
  }

  function isInlineWalletSubmitUrl(url){
    const text = String(url || '').toLowerCase();
    return text.indexOf('/deposit/upload') !== -1 ||
      text.indexOf('/deposit/submit') !== -1 ||
      false;
  }

  function isInlineDepositUploadUrl(url){
    return String(url || '').toLowerCase().indexOf('/deposit/upload') !== -1;
  }

  function isInlineAutoDepositSubmitUrl(url){
    const text = String(url || '').toLowerCase();
    return text.indexOf('/deposit/usdt-auto') !== -1 ||
      text.indexOf('/deposit/submit') !== -1;
  }

  function isInlineDepositSubmitRequestUrl(url){
    const text = String(url || '').toLowerCase();
    return text.indexOf('/deposit/submit') !== -1 ||
      text.indexOf('/deposit/usdt-auto') !== -1;
  }

  function closeInlineDepositMethodModalAfterSubmit(){
    try {
      if (typeof window.__depositInlineCloseMethodModal === 'function') {
        window.__depositInlineCloseMethodModal();
        return true;
      }
    } catch (_) {}
    try {
      const modal = document.querySelector('#depositInlineApp #methodModal') || document.getElementById('methodModal');
      if (!modal) return false;
      modal.classList.add('hidden');
      modal.classList.remove('open');
      modal.classList.remove('inline-method-page');
      modal.removeAttribute('data-inline-method-page');
      modal.setAttribute('aria-hidden', 'true');
      if (document.body) {
        document.body.classList.remove('modal-open', 'overflow-hidden');
        document.body.style.removeProperty('overflow');
        document.body.style.removeProperty('padding-right');
      }
      return true;
    } catch (_) {
      return false;
    }
  }

  function isInlineDiagnosticDebugEnabled(){
    try {
      if (typeof window !== 'undefined' && window.__DEPOSIT_INLINE_DEBUG__ === true) return true;
      if (typeof localStorage !== 'undefined' && localStorage.getItem('depositInlineDebug') === '1') return true;
    } catch (_) {}
    return false;
  }

  function shouldLogInlineDiagnosticRequest(resource){
    if (!isInlineDiagnosticDebugEnabled()) return false;
    const url = String(
      typeof resource === 'string'
        ? resource
        : (resource && resource.url ? resource.url : '')
    ).trim();
    if (!url) return false;
    return new RegExp('\\\\/(?:deposit)\\\\/fx(?:[/?#]|$)', 'i').test(url) || /(?:^|[/?&])channel(?:[/?&=]|$)/i.test(url);
  }

  function logInlineDiagnosticRequest(kind, resource){
    try {
      const url = String(
        typeof resource === 'string'
          ? resource
          : (resource && resource.url ? resource.url : '')
      ).trim();
      if (!url || !shouldLogInlineDiagnosticRequest(url)) return;
      const isFx = new RegExp('\\\\/(?:deposit)\\\\/fx(?:[/?#]|$)', 'i').test(url);
      const isChannel = /(?:^|[/?&])channel(?:[/?&=]|$)/i.test(url);
      const payload = {
        at: new Date().toISOString(),
        kind: kind,
        url: url,
        isFx: isFx,
        isChannel: isChannel,
        lastMethodOpen: (typeof window !== 'undefined' && window.__depositInlineLastMethodOpenDiagnostic) || null,
        lastFxDiagnostic: (typeof window !== 'undefined' && window.__depositInlineLastFxDiagnostic) || null,
        stack: (new Error('inline request stack')).stack
      };
      console.warn('[DepositInline] outgoing diagnostic request', payload);
    } catch (_) {}
  }

  let inlineTrackedSubmitRequests = 0;
  let inlinePendingSubmitTimer = 0;
  let inlineSubmitFeedbackActive = false;
  function waitForInlineLoaderPaint(){
    return new Promise(function(resolve){
      try {
        const raf = typeof requestAnimationFrame === 'function'
          ? requestAnimationFrame
          : function(callback){ return setTimeout(callback, 16); };
        raf(function(){
          raf(function(){
            resolve();
          });
        });
      } catch (_) {
        setTimeout(resolve, 32);
      }
    });
  }

  function clearInlinePendingSubmitTimer(){
    if (!inlinePendingSubmitTimer) return;
    try { clearTimeout(inlinePendingSubmitTimer); } catch (_) {}
    inlinePendingSubmitTimer = 0;
  }

  function beginInlineSubmitAwait(){
    clearInlinePendingSubmitTimer();
    if (!inlineSubmitFeedbackActive) {
      try { setInlinePreloaderVisible(state.app, true); } catch (_) {}
    }
    inlinePendingSubmitTimer = setTimeout(function(){
      inlinePendingSubmitTimer = 0;
      if (inlineTrackedSubmitRequests <= 0 && !inlineSubmitFeedbackActive) {
        try { setInlinePreloaderVisible(state.app, false); } catch (_) {}
      }
    }, 15000);
  }

  function finishInlineSubmitAwait(){
    clearInlinePendingSubmitTimer();
    if (inlineTrackedSubmitRequests <= 0 && !inlineSubmitFeedbackActive) {
      try { setInlinePreloaderVisible(state.app, false); } catch (_) {}
    }
  }

  function beginTrackedInlineSubmitRequest(){
    inlineTrackedSubmitRequests += 1;
    clearInlinePendingSubmitTimer();
    if (!inlineSubmitFeedbackActive) {
      try { setInlinePreloaderVisible(state.app, true); } catch (_) {}
    }
  }

  function finishTrackedInlineSubmitRequest(){
    inlineTrackedSubmitRequests = Math.max(0, inlineTrackedSubmitRequests - 1);
    if (!inlineTrackedSubmitRequests) {
      finishInlineSubmitAwait();
    }
  }

  function readInlineDepositUploadSessionInfo(){
    const out = { uid: '', sessionKey: '' };
    try {
      const raw = localStorage.getItem('sessionKeyInfo');
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && typeof parsed === 'object') {
        out.uid = String(parsed.uid || parsed.useruid || parsed.userUid || '').trim();
        out.sessionKey = String(parsed.sessionKey || parsed.session_key || '').trim();
      }
    } catch (_) {}
    if (!out.uid) {
      try {
        const authUser = (typeof depositAuth !== 'undefined' && depositAuth && depositAuth.currentUser)
          ? depositAuth.currentUser
          : null;
        if (authUser && authUser.uid) out.uid = String(authUser.uid || '').trim();
      } catch (_) {}
    }
    if (!out.uid) {
      try {
        const authInstance = (typeof firebase !== 'undefined' && firebase && typeof firebase.auth === 'function')
          ? firebase.auth()
          : null;
        const currentUser = authInstance && authInstance.currentUser;
        if (currentUser && currentUser.uid) out.uid = String(currentUser.uid || '').trim();
      } catch (_) {}
    }
    return out;
  }

  function appendInlineDepositUploadSession(body){
    try {
      if (!body || typeof FormData === 'undefined' || !(body instanceof FormData)) return body;
      const session = readInlineDepositUploadSessionInfo();
      const hasUid = !!String(body.get('useruid') || body.get('userUid') || body.get('uid') || '').trim();
      const hasSession = !!String(body.get('sessionKey') || body.get('session_key') || '').trim();
      if (!hasUid && session.uid) body.append('useruid', session.uid);
      if (!hasSession && session.sessionKey) body.append('sessionKey', session.sessionKey);
    } catch (_) {}
    return body;
  }

  function patchInlineDepositUploadFetchInit(resource, init){
    try {
      const url = String(
        typeof resource === 'string'
          ? resource
          : (resource && resource.url ? resource.url : '')
      );
      if (!isInlineDepositUploadUrl(url)) return init;
      if (init && init.body) {
        appendInlineDepositUploadSession(init.body);
      }
    } catch (_) {}
    return init;
  }

  function bindInlineSubmitPreloaderTracking(){
    let bound = false;

    try {
      const currentFetch = globalThis.fetch;
      const alreadyWrapped = !!(currentFetch && currentFetch.__depositInlineTrackedFetch === '1');
      if (!alreadyWrapped && typeof currentFetch === 'function') {
        const nativeFetch = currentFetch.bind(globalThis);
        const wrappedFetch = async function(resource, init){
          init = patchInlineDepositUploadFetchInit(resource, init);
          const tracked = shouldTrackInlineSubmitRequest(resource);
          logInlineDiagnosticRequest('fetch', resource);
          if (tracked) beginTrackedInlineSubmitRequest();
          try {
            const response = await nativeFetch(resource, init);
            try {
              const url = String(
                typeof resource === 'string'
                  ? resource
                  : (resource && resource.url ? resource.url : '')
              );
              if (
                response &&
                response.ok &&
                typeof response.clone === 'function' &&
                isInlineDepositSubmitRequestUrl(url)
              ) {
                response.clone().json().then(function(payload){
                  if (isInlineAutoDepositSubmitUrl(url)) applyInlineAutoDepositSuccessPayload(payload);
                  if (!payload || (payload.success !== false && payload.ok !== false)) {
                    closeInlineDepositMethodModalAfterSubmit();
                  }
                }).catch(function(){
                  closeInlineDepositMethodModalAfterSubmit();
                });
              }
            } catch (_) {}
            return response;
          } finally {
            if (tracked) finishTrackedInlineSubmitRequest();
          }
        };
        try { wrappedFetch.__depositInlineTrackedFetch = '1'; } catch (_) {}
        try { globalThis.fetch = wrappedFetch; } catch (_) {}
        try {
          if (typeof window !== 'undefined' && window) {
            window.fetch = wrappedFetch;
            window.__depositInlineTrackedFetchBound__ = true;
          }
        } catch (_) {}
        bound = true;
      } else if (alreadyWrapped) {
        bound = true;
      }
    } catch (_) {}

    try {
      const XHR = globalThis.XMLHttpRequest;
      const proto = XHR && XHR.prototype ? XHR.prototype : null;
      if (proto && proto.open && proto.send && !proto.__depositInlineTrackedXhrBound) {
        const nativeOpen = proto.open;
        const nativeSend = proto.send;
        proto.open = function(method, url){
          try { this.__depositInlineTrackedUrl = String(url || ''); } catch (_) {}
          try { this.__depositInlineTrackedRequest = shouldTrackInlineSubmitRequest(url); } catch (_) {}
          try { this.__depositInlineDiagnosticUrl = String(url || ''); } catch (_) {}
          return nativeOpen.apply(this, arguments);
        };
        proto.send = function(body){
          let tracked = false;
          try { tracked = this.__depositInlineTrackedRequest === true; } catch (_) {}
          try { logInlineDiagnosticRequest('xhr', this.__depositInlineDiagnosticUrl || this.__depositInlineTrackedUrl || ''); } catch (_) {}
          try {
            if (isInlineDepositUploadUrl(this.__depositInlineTrackedUrl || this.__depositInlineDiagnosticUrl || '')) {
              body = appendInlineDepositUploadSession(body);
            }
          } catch (_) {}
          if (tracked) {
            beginTrackedInlineSubmitRequest();
            let finalized = false;
            const xhr = this;
            const finalize = function(){
              if (finalized) return;
              finalized = true;
              try {
                const url = String(xhr.__depositInlineTrackedUrl || xhr.__depositInlineDiagnosticUrl || '');
                const okStatus = Number(xhr.status || 0);
                if (isInlineDepositSubmitRequestUrl(url) && okStatus >= 200 && okStatus < 300) {
                  let payload = null;
                  try { payload = JSON.parse(String(xhr.responseText || '')); } catch (_) {}
                  if (isInlineAutoDepositSubmitUrl(url)) applyInlineAutoDepositSuccessPayload(payload);
                  if (!payload || (payload.success !== false && payload.ok !== false)) {
                    closeInlineDepositMethodModalAfterSubmit();
                  }
                }
              } catch (_) {}
              finishTrackedInlineSubmitRequest();
            };
            try { this.addEventListener('loadend', finalize, { once: true }); } catch (_) {}
            try { this.addEventListener('error', finalize, { once: true }); } catch (_) {}
            try { this.addEventListener('abort', finalize, { once: true }); } catch (_) {}
            try { this.addEventListener('timeout', finalize, { once: true }); } catch (_) {}
          }
          return nativeSend.apply(this, arguments);
        };
        try { proto.__depositInlineTrackedXhrBound = true; } catch (_) {}
        try {
          if (typeof window !== 'undefined' && window) {
            window.__depositInlineTrackedXhrBound__ = true;
          }
        } catch (_) {}
        bound = true;
      } else if (proto && proto.__depositInlineTrackedXhrBound) {
        bound = true;
      }
    } catch (_) {}

    return bound;
  }

  async function withInlineSubmitFeedback(task){
    try { bindInlineSubmitPreloaderTracking(); } catch (_) {}
    inlineSubmitFeedbackActive = true;
    setInlineSubmitBusy(true);
    setInlineSubmitAwaitVisual(true);
    beginInlineSubmitAwait();
    try {
      await waitForInlineLoaderPaint();
      return await task();
    } finally {
      inlineSubmitFeedbackActive = false;
      setInlineSubmitAwaitVisual(false);
      setInlineSubmitBusy(false);
      if (!inlineTrackedSubmitRequests) finishInlineSubmitAwait();
    }
  }

  function ensureInlineStyledAlertStyles(){
    try {
      if (!document || !document.head || document.getElementById('deposit-inline-alert-style')) return;
      const style = document.createElement('style');
      style.id = 'deposit-inline-alert-style';
      style.textContent = [
        '.deposit-inline-alert-overlay{position:absolute;inset:14px;z-index:30;display:flex;align-items:center;justify-content:center;padding:12px;background:rgba(2,6,23,.18);backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px);direction:rtl;border-radius:24px;}',
        '.deposit-inline-alert-card{width:min(430px,100%);display:grid;gap:18px;padding:22px 20px 18px;border-radius:18px;border:1px solid rgba(103,232,249,.36);background:linear-gradient(180deg,#111827,#0b1120);box-shadow:0 18px 44px rgba(0,0,0,.34);color:#f8fafc;text-align:right;}',
        '.deposit-inline-alert-card[data-tone="error"]{border-color:rgba(103,232,249,.42);}',
        '.deposit-inline-alert-title{margin:0;font-size:1rem;font-weight:900;line-height:1.6;color:#e0f2fe;}',
        '.deposit-inline-alert-message{margin:0;color:#f8fafc;font-size:.95rem;font-weight:800;line-height:1.9;word-break:break-word;}',
        '.deposit-inline-alert-actions{display:flex;justify-content:flex-start;align-items:center;}',
        '.deposit-inline-alert-ok{min-width:72px;min-height:42px;border-radius:999px;border:2px solid #67e8f9;background:rgba(103,232,249,.2);color:#ecfeff;font-weight:900;cursor:pointer;box-shadow:0 10px 26px rgba(34,211,238,.2);}',
        '.deposit-inline-alert-ok:hover{background:rgba(103,232,249,.3);transform:translateY(-1px);}',
        '.deposit-inline-alert-ok:focus,.deposit-inline-alert-ok:focus-visible{outline:none;box-shadow:0 0 0 3px rgba(103,232,249,.24);}',
        'html[data-theme="light"] .deposit-inline-alert-overlay{background:rgba(15,23,42,.42);}',
        'html[data-theme="light"] .deposit-inline-alert-card{background:linear-gradient(180deg,#ffffff,#f8fbff);border-color:#67e8f9;color:#0f172a;box-shadow:0 24px 54px rgba(15,23,42,.2);}',
        'html[data-theme="light"] .deposit-inline-alert-title{color:#075985;}',
        'html[data-theme="light"] .deposit-inline-alert-message{color:#0f172a;}',
        'html[data-theme="light"] .deposit-inline-alert-ok{background:#cffafe;color:#0f172a;}'
      ].join('');
      document.head.appendChild(style);
    } catch (_) {}
  }

  function showInlineStyledAlert(message, tone){
    try {
      ensureInlineStyledAlertStyles();
      const methodModal = document.querySelector('#depositInlineApp #methodModal') || document.getElementById('methodModal');
      const mountTarget = (methodModal && methodModal.querySelector && methodModal.querySelector('.modal-content')) || methodModal;
      if (!mountTarget) return false;
      try {
        window.__depositInlineAlertActive__ = true;
        window.__depositInlineAlertBlockModalCloseUntil__ = Date.now() + 300;
      } catch (_) {}
      const old = mountTarget.querySelector ? mountTarget.querySelector('#deposit-inline-alert-overlay') : document.getElementById('deposit-inline-alert-overlay');
      if (old && old.parentNode) old.parentNode.removeChild(old);
      const overlay = document.createElement('div');
      overlay.id = 'deposit-inline-alert-overlay';
      overlay.className = 'deposit-inline-alert-overlay';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      const card = document.createElement('section');
      card.className = 'deposit-inline-alert-card';
      card.dataset.tone = String(tone || 'error');
      const title = document.createElement('h3');
      title.className = 'deposit-inline-alert-title';
      title.textContent = 'تنبيه الإيداع';
      const body = document.createElement('p');
      body.className = 'deposit-inline-alert-message';
      body.textContent = String(message || 'حدث خطأ غير متوقع.');
      const actions = document.createElement('div');
      actions.className = 'deposit-inline-alert-actions';
      const ok = document.createElement('button');
      ok.type = 'button';
      ok.className = 'deposit-inline-alert-ok';
      ok.textContent = 'حسنًا';
      actions.appendChild(ok);
      card.appendChild(title);
      card.appendChild(body);
      card.appendChild(actions);
      overlay.appendChild(card);
      const close = function(){
        try {
          window.__depositInlineAlertActive__ = false;
          window.__depositInlineAlertBlockModalCloseUntil__ = Date.now() + 300;
        } catch (_) {}
        try { if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay); } catch (_) {}
      };
      const absorbInlineAlertEvent = function(event){
        try { event.preventDefault(); } catch (_) {}
        try { event.stopPropagation(); } catch (_) {}
        try { event.stopImmediatePropagation(); } catch (_) {}
      };
      ok.addEventListener('pointerdown', absorbInlineAlertEvent, true);
      ok.addEventListener('pointerup', absorbInlineAlertEvent, true);
      ok.addEventListener('touchstart', absorbInlineAlertEvent, true);
      ok.addEventListener('touchend', absorbInlineAlertEvent, true);
      ok.addEventListener('mousedown', absorbInlineAlertEvent, true);
      ok.addEventListener('mouseup', absorbInlineAlertEvent, true);
      ok.addEventListener('click', function(event){
        absorbInlineAlertEvent(event);
        close();
      }, true);
      card.addEventListener('click', absorbInlineAlertEvent, true);
      card.addEventListener('pointerdown', absorbInlineAlertEvent, true);
      card.addEventListener('touchstart', absorbInlineAlertEvent, true);
      card.addEventListener('touchend', absorbInlineAlertEvent, true);
      overlay.addEventListener('click', function(event){
        absorbInlineAlertEvent(event);
        if (event && event.target === overlay) close();
      }, true);
      document.addEventListener('keydown', function onInlineAlertKey(event){
        if (!event || event.key !== 'Escape') return;
        absorbInlineAlertEvent(event);
        document.removeEventListener('keydown', onInlineAlertKey, true);
        close();
      }, true);
      try {
        if (getComputedStyle(mountTarget).position === 'static') {
          mountTarget.style.position = 'relative';
        }
      } catch (_) {}
      mountTarget.appendChild(overlay);
      setTimeout(function(){ try { ok.focus(); } catch (_) {} }, 0);
      return true;
    } catch (_) {
      return false;
    }
  }

  function bindInlineStyledAlert(){
    try {
      if (window.__depositInlineStyledAlertBound__) return;
      window.__depositInlineStyledAlertBound__ = true;
      const nativeAlert = typeof window.alert === 'function' ? window.alert.bind(window) : null;
      window.__depositInlineNativeAlert__ = nativeAlert;
      if (nativeAlert) window.alert = nativeAlert;
    } catch (_) {}
  }

  bindInlineStyledAlert();
  bindInlineSubmitPreloaderTracking();
  bindInlineDepositSuccessDismiss();
  bindInlineWithdrawAmountHooks();

  function clearInlineMethodAmounts(){
    try {
      if (sendJOD) sendJOD.value = '';
      if (recvCUR) recvCUR.value = '';
    } catch (_) {}
    try {
      const payField = document.getElementById('fieldPay');
      const recvField = document.getElementById('fieldRecv');
      if (payField && payField.classList) payField.classList.remove('filled');
      if (recvField && recvField.classList) recvField.classList.remove('filled');
    } catch (_) {}
  }

  function resolveInlinePositiveNumber(value){
    const num = Number(value);
    return Number.isFinite(num) && num > 0 ? num : null;
  }

  function resolveInlineMethodMinUsd(method){
    const data = method && method.data && typeof method.data === 'object' ? method.data : {};
    const candidates = [
      data.minAmountUSD,
      data.minAmountUsd,
      data.minimumUSD,
      data.minimumUsd,
      data.minUSD,
      data.minUsd
    ];
    for (let i = 0; i < candidates.length; i += 1) {
      const value = resolveInlinePositiveNumber(candidates[i]);
      if (value) return value;
    }
    return null;
  }

  function roundInlineAmount(value, digits){
    const num = Number(value);
    const precision = Number.isFinite(Number(digits)) ? Math.max(0, Math.trunc(Number(digits))) : 2;
    if (!Number.isFinite(num)) return 0;
    const factor = Math.pow(10, precision);
    return Math.round((num + Number.EPSILON) * factor) / factor;
  }

  function resolveInlineMethodFeePercentValue(method){
    const data = method && method.data && typeof method.data === 'object'
      ? method.data
      : ((method && typeof method === 'object') ? method : {});
    const feePercent = Number(
      data.feePercent != null ? data.feePercent :
      (data.fee_percent != null ? data.fee_percent :
      (data.feePct != null ? data.feePct :
      (data.fee_pct != null ? data.fee_pct :
      (data.commissionPercent != null ? data.commissionPercent : data.commission_percent))))
    );
    return Number.isFinite(feePercent) && feePercent > 0 ? feePercent : 0;
  }

  function resolveInlineWithdrawFixedFeeCurrencyAmount(method){
    const data = method && method.data && typeof method.data === 'object' ? method.data : {};
    const fee = Number(data.feeFixed);
    return Number.isFinite(fee) && fee > 0 ? fee : 0;
  }

  function resolveInlineWithdrawFeeCurrencyAmount(method, grossAmount){
    const fixedFee = resolveInlineWithdrawFixedFeeCurrencyAmount(method);
    const percent = resolveInlineMethodFeePercentValue(method);
    const gross = resolveInlinePositiveNumber(grossAmount);
    const percentAmount = (gross && percent > 0)
      ? roundInlineAmount((gross * percent) / 100, 6)
      : 0;
    return roundInlineAmount(fixedFee + percentAmount, 6);
  }

  function resolveInlineDepositFeeCurrencyAmount(grossAmount, method){
    const gross = resolveInlinePositiveNumber(grossAmount);
    if (!gross) return 0;
    const data = method && method.data && typeof method.data === 'object' ? method.data : {};
    const fixedFee = Number(data.feeFixed);
    const safeFixedFee = Number.isFinite(fixedFee) && fixedFee > 0 ? fixedFee : 0;
    const feePercent = resolveInlineMethodFeePercentValue(method);
    const percentAmount = feePercent > 0
      ? roundInlineAmount((gross * feePercent) / 100, 6)
      : 0;
    return roundInlineAmount(safeFixedFee + percentAmount, 6);
  }

  function resolveInlineWithdrawCurrencyPerUsd(method){
    const data = method && method.data && typeof method.data === 'object'
      ? method.data
      : ((method && typeof method === 'object') ? method : {});
    const directRate = resolveInlinePositiveNumber(data.ratePerUSD);
    if (directRate) return roundInlineAmount(directRate, 6);
    const allowedRate = deriveInlineRatePerUsdFromAllowedCurrencies(data);
    if (allowedRate) return roundInlineAmount(allowedRate, 6);

    const currencyCode = resolveInlineModalMethodCurrency(method);
    const currencyId = getInlineCurrencyEntryIdFromData(data);
    if (currencyCode === 'USD' && (!currencyId || currencyId === '1')) return 1;

    const usdPerJOD = resolveInlinePositiveNumber(data.usdPerJOD);
    const ratePerJOD = resolveInlinePositiveNumber(data.ratePerJOD);
    const rateToJOD = resolveInlinePositiveNumber(data.rateToJOD);

    if (ratePerJOD && usdPerJOD) {
      return roundInlineAmount(ratePerJOD / usdPerJOD, 6);
    }
    if (rateToJOD && usdPerJOD) {
      return roundInlineAmount((1 / rateToJOD) / usdPerJOD, 6);
    }
    if (currencyCode === 'JOD' && usdPerJOD) {
      return roundInlineAmount(1 / usdPerJOD, 6);
    }
    if (currencyCode === 'JOD' && ratePerJOD) {
      return roundInlineAmount(ratePerJOD, 6);
    }
    return null;
  }

  function resolveInlineWithdrawTotalUsdFromPayoutAmount(payoutAmount, method){
    const payout = resolveInlinePositiveNumber(payoutAmount);
    if (!payout) return null;
    const fixedFee = resolveInlineWithdrawFixedFeeCurrencyAmount(method);
    const feePercent = resolveInlineMethodFeePercentValue(method);
    const ratio = 1 - (feePercent / 100);
    if (!(ratio > 0)) return null;
    const totalCurrency = roundInlineAmount((payout + fixedFee) / ratio, 6);
    const currencyPerUsd = resolveInlineWithdrawCurrencyPerUsd(method);
    if (currencyPerUsd) {
      return roundInlineAmount(totalCurrency / currencyPerUsd, 6);
    }
    if (typeof computeUsdFromCur !== 'function') return null;
    const totalUsd = resolveInlinePositiveNumber(computeUsdFromCur(totalCurrency));
    return totalUsd ? roundInlineAmount(totalUsd, 6) : null;
  }

  function resolveInlineWithdrawPayoutAmountFromTotalUsd(totalUsd, method){
    const submittedUsd = resolveInlinePositiveNumber(totalUsd);
    if (!submittedUsd) return null;
    let totalCurrency = null;
    const currencyPerUsd = resolveInlineWithdrawCurrencyPerUsd(method);
    if (currencyPerUsd) {
      totalCurrency = roundInlineAmount(submittedUsd * currencyPerUsd, 6);
    } else if (typeof computeCurFromUsd === 'function') {
      totalCurrency = resolveInlinePositiveNumber(computeCurFromUsd(submittedUsd));
    }
    if (!totalCurrency) return null;
    const feeAmountCurrency = resolveInlineWithdrawFeeCurrencyAmount(method, totalCurrency);
    const payoutAmount = roundInlineAmount(totalCurrency - feeAmountCurrency, 6);
    return payoutAmount > 0 ? payoutAmount : null;
  }

  function resolveInlineDepositNetUsdFromGrossAmount(grossAmount, method){
    const gross = resolveInlinePositiveNumber(grossAmount);
    if (!gross) return null;
    const feeAmountCurrency = resolveInlineDepositFeeCurrencyAmount(gross, method);
    const netCurrency = roundInlineAmount(gross - feeAmountCurrency, 6);
    if (!(netCurrency > 0)) return null;
    const currencyPerUsd = resolveInlineWithdrawCurrencyPerUsd(method);
    if (currencyPerUsd) {
      return roundInlineAmount(netCurrency / currencyPerUsd, 6);
    }
    if (typeof computeUsdFromCur !== 'function') return null;
    const netUsd = resolveInlinePositiveNumber(computeUsdFromCur(netCurrency));
    return netUsd ? roundInlineAmount(netUsd, 6) : null;
  }

  function resolveInlineDepositGrossAmountFromNetUsd(netUsd, method){
    const targetUsd = resolveInlinePositiveNumber(netUsd);
    if (!targetUsd) return null;
    let netCurrency = null;
    const currencyPerUsd = resolveInlineWithdrawCurrencyPerUsd(method);
    if (currencyPerUsd) {
      netCurrency = roundInlineAmount(targetUsd * currencyPerUsd, 6);
    } else if (typeof computeCurFromUsd === 'function') {
      netCurrency = resolveInlinePositiveNumber(computeCurFromUsd(targetUsd));
    }
    if (!netCurrency) return null;
    const data = method && method.data && typeof method.data === 'object' ? method.data : {};
    const fixedFee = Number(data.feeFixed);
    const safeFixedFee = Number.isFinite(fixedFee) && fixedFee > 0 ? fixedFee : 0;
    const feePercent = resolveInlineMethodFeePercentValue(method);
    const ratio = 1 - (feePercent / 100);
    if (!(ratio > 0)) return null;
    const grossAmount = roundInlineAmount((netCurrency + safeFixedFee) / ratio, 6);
    return grossAmount > 0 ? grossAmount : null;
  }

  let inlineWithdrawAmountSyncing = false;
  function syncInlineWithdrawAmountsFromSource(source, methodOverride){
    if (inlineWithdrawAmountSyncing || !isInlineWithdrawFlowActive()) return false;
    if (!sendJOD || !recvCUR) return false;

    const activeMethod = methodOverride || (typeof currentMethod !== 'undefined' ? currentMethod : null);
    try {
      inlineWithdrawAmountSyncing = true;

      if (source === 'usd') {
        const totalUsd = resolveInlinePositiveNumber(recvCUR.value);
        if (!totalUsd) {
          sendJOD.value = '';
          return false;
        }
        const payoutAmount = resolveInlineWithdrawPayoutAmountFromTotalUsd(totalUsd, activeMethod);
        if (!payoutAmount) {
          sendJOD.value = '';
          try { updateSubmitState(); } catch (_) {}
          return false;
        }
        sendJOD.value = roundInlineAmount(payoutAmount, 2).toFixed(2);
        try { updateSubmitState(); } catch (_) {}
        return true;
      }

      const payoutAmount = resolveInlinePositiveNumber(sendJOD.value);
      if (!payoutAmount) {
        recvCUR.value = '';
        try { updateSubmitState(); } catch (_) {}
        return false;
      }
      const totalUsd = resolveInlineWithdrawTotalUsdFromPayoutAmount(payoutAmount, activeMethod);
      if (!totalUsd) {
        recvCUR.value = '';
        try { updateSubmitState(); } catch (_) {}
        return false;
      }
      recvCUR.value = roundInlineAmount(totalUsd, 2).toFixed(2);
      try { updateSubmitState(); } catch (_) {}
      return true;
    } finally {
      inlineWithdrawAmountSyncing = false;
    }
  }

  // ==== مُحدِّد عملة عرض حقل «سيُضاف» (recvCUR) — عرض فقط: يُرسَل payAmount دائمًا والسيرفر يحسب الدولار ====
  var recvDisplayCurrency = '';
  var recvCurrencyUserOverride = false;
  var recvCurrencyMenuOpen = false;
  var recvCurrencyDocBound = false;
  function inlineNormalizeCurrencyCode(code){
    var c = String(code == null ? '' : code).trim().toUpperCase();
    return /^[A-Z0-9]{2,8}$/.test(c) ? c : '';
  }
  function inlineResolveDefaultRecvCurrency(){
    try {
      if (typeof window !== 'undefined' && typeof window.getSelectedCurrencyCode === 'function') {
        var c = inlineNormalizeCurrencyCode(window.getSelectedCurrencyCode());
        if (c) return c;
      }
    } catch (_) {}
    return 'USD';
  }
  function inlineRecvActiveCurrency(){
    var c = inlineNormalizeCurrencyCode(recvDisplayCurrency);
    return c || inlineResolveDefaultRecvCurrency();
  }
  function inlineRecvCurrencyOptions(){
    try {
      if (typeof window !== 'undefined' && typeof window.getSiteCurrencyOptions === 'function') {
        var list = window.getSiteCurrencyOptions();
        if (Array.isArray(list) && list.length) return list;
      }
    } catch (_) {}
    return [{ code: 'USD', key: 'USD', symbol: '$', name: 'USD' }];
  }
  function inlineConvertUsdToDisplay(usd){
    var n = Number(usd);
    if (!Number.isFinite(n)) return NaN;
    var code = inlineRecvActiveCurrency();
    if (code === 'USD') return n;
    try {
      if (typeof window !== 'undefined' && typeof window.convertFromJOD === 'function') {
        var out = Number(window.convertFromJOD(n, code));
        if (Number.isFinite(out)) return out;
      }
    } catch (_) {}
    return n;
  }
  function inlineConvertDisplayToUsd(amount){
    var n = Number(amount);
    if (!Number.isFinite(n)) return NaN;
    var code = inlineRecvActiveCurrency();
    if (code === 'USD') return n;
    try {
      if (typeof window !== 'undefined' && typeof window.convertToBaseCurrency === 'function') {
        var out = Number(window.convertToBaseCurrency(n, code));
        if (Number.isFinite(out)) return out;
      }
    } catch (_) {}
    return n;
  }
  function inlineToggleRecvFilled(){
    try {
      var f = document.getElementById('fieldRecv');
      if (f && f.classList) {
        var rv = Number(recvCUR && recvCUR.value);
        f.classList.toggle('filled', Number.isFinite(rv) && rv > 0);
      }
    } catch (_) {}
  }
  function inlineDepositReadRecvNetUsd(){
    var typed = resolveInlinePositiveNumber(recvCUR.value);
    if (!typed) return 0;
    if (inlineRecvActiveCurrency() === 'USD') return typed;
    return resolveInlinePositiveNumber(inlineConvertDisplayToUsd(typed)) || 0;
  }
  function inlineDepositWriteRecvDisplay(netUsd){
    if (!recvCUR) return;
    var n = Number(netUsd);
    if (!Number.isFinite(n) || n <= 0) { recvCUR.value = ''; inlineToggleRecvFilled(); return; }
    var display = inlineConvertUsdToDisplay(n);
    if (!Number.isFinite(Number(display)) || Number(display) <= 0) { recvCUR.value = ''; inlineToggleRecvFilled(); return; }
    recvCUR.value = roundInlineAmount(Number(display), 2).toFixed(2);
    inlineToggleRecvFilled();
  }
  function inlineRecvCurrencySymbol(code){
    var target = inlineNormalizeCurrencyCode(code) || 'USD';
    var opts = inlineRecvCurrencyOptions();
    for (var i = 0; i < opts.length; i += 1) {
      if (inlineNormalizeCurrencyCode(opts[i] && opts[i].code) === target) return String(opts[i].symbol || target);
    }
    return target;
  }
  function refreshRecvCurrencyChipLabel(){
    try {
      var chip = document.getElementById('recvCurrencyChip');
      if (!chip) return;
      var codeEl = chip.querySelector('.inline-recv-currency-chip-code');
      if (codeEl) codeEl.textContent = inlineRecvActiveCurrency();
    } catch (_) {}
  }
  function closeRecvCurrencyMenu(){
    recvCurrencyMenuOpen = false;
    try {
      var menu = document.getElementById('recvCurrencyMenu');
      if (menu) menu.hidden = true;
      var chip = document.getElementById('recvCurrencyChip');
      if (chip) chip.setAttribute('aria-expanded', 'false');
    } catch (_) {}
  }
  function applyRecvCurrencySelection(code){
    var c = inlineNormalizeCurrencyCode(code);
    if (!c) return;
    recvDisplayCurrency = c;
    recvCurrencyUserOverride = true;
    refreshRecvCurrencyChipLabel();
    closeRecvCurrencyMenu();
    try { syncInlineDepositAmountsFromSource('pay'); } catch (_) {}
  }
  function buildRecvCurrencyMenu(menu){
    if (!menu) return;
    var opts = inlineRecvCurrencyOptions();
    var active = inlineRecvActiveCurrency();
    var html = '';
    for (var i = 0; i < opts.length; i += 1) {
      var code = inlineNormalizeCurrencyCode(opts[i] && opts[i].code);
      if (!code) continue;
      var sym = String(opts[i] && opts[i].symbol || code);
      var name = String(opts[i] && opts[i].name || code);
      html += '<button type="button" class="inline-recv-currency-option' + (code === active ? ' is-active' : '') + '" data-code="' + code + '">'
        + '<span class="inline-recv-currency-option-code">' + code + '</span>'
        + '<span class="inline-recv-currency-option-name">' + name + '</span>'
        + '<span class="inline-recv-currency-option-sym">' + sym + '</span>'
        + '</button>';
    }
    menu.innerHTML = html;
  }
  function toggleRecvCurrencyMenu(){
    var menu = document.getElementById('recvCurrencyMenu');
    var chip = document.getElementById('recvCurrencyChip');
    if (!menu || !chip) return;
    if (recvCurrencyMenuOpen) { closeRecvCurrencyMenu(); return; }
    buildRecvCurrencyMenu(menu);
    menu.hidden = false;
    recvCurrencyMenuOpen = true;
    chip.setAttribute('aria-expanded', 'true');
  }
  function hideRecvCurrencyChip(){
    try {
      closeRecvCurrencyMenu();
      var field = document.getElementById('fieldRecv');
      if (field && field.classList) field.classList.remove('has-recv-currency-chip');
    } catch (_) {}
  }
  function ensureRecvCurrencyChip(){
    try {
      var field = document.getElementById('fieldRecv');
      if (!field) return;
      if (!recvCurrencyUserOverride) recvDisplayCurrency = inlineResolveDefaultRecvCurrency();
      var chip = document.getElementById('recvCurrencyChip');
      if (!chip) {
        chip = document.createElement('button');
        chip.type = 'button';
        chip.id = 'recvCurrencyChip';
        chip.className = 'inline-recv-currency-chip';
        chip.setAttribute('aria-haspopup', 'listbox');
        chip.setAttribute('aria-expanded', 'false');
        chip.innerHTML = '<span class="inline-recv-currency-chip-code">USD</span><i class="fa-solid fa-angle-down" aria-hidden="true"></i>';
        chip.addEventListener('click', function(ev){
          try { ev.preventDefault(); ev.stopPropagation(); } catch (_) {}
          toggleRecvCurrencyMenu();
        });
        var menu = document.createElement('div');
        menu.id = 'recvCurrencyMenu';
        menu.className = 'inline-recv-currency-menu';
        menu.hidden = true;
        menu.addEventListener('click', function(ev){
          var btn = ev && ev.target && ev.target.closest ? ev.target.closest('.inline-recv-currency-option') : null;
          if (!btn) return;
          try { ev.preventDefault(); ev.stopPropagation(); } catch (_) {}
          applyRecvCurrencySelection(btn.getAttribute('data-code'));
        });
        field.appendChild(chip);
        field.appendChild(menu);
      }
      field.classList.add('has-recv-currency-chip');
      refreshRecvCurrencyChipLabel();
      if (!recvCurrencyDocBound) {
        recvCurrencyDocBound = true;
        try {
          document.addEventListener('click', function(ev){
            if (!recvCurrencyMenuOpen) return;
            var t = ev && ev.target;
            if (t && t.closest && (t.closest('#recvCurrencyMenu') || t.closest('#recvCurrencyChip'))) return;
            closeRecvCurrencyMenu();
          }, true);
        } catch (_) {}
        try {
          window.addEventListener('currency:change', function(){
            if (recvCurrencyUserOverride) return;
            recvDisplayCurrency = inlineResolveDefaultRecvCurrency();
            refreshRecvCurrencyChipLabel();
            try { syncInlineDepositAmountsFromSource('pay'); } catch (_) {}
          });
        } catch (_) {}
      }
    } catch (_) {}
  }

  let inlineDepositAmountSyncing = false;
  function syncInlineDepositAmountsFromSource(source, methodOverride){
    if (inlineDepositAmountSyncing || isInlineWithdrawFlowActive()) return false;
    if (!sendJOD || !recvCUR) return false;

    const activeMethod = methodOverride || (typeof currentMethod !== 'undefined' ? currentMethod : null);
    try {
      inlineDepositAmountSyncing = true;

      if (source === 'usd') {
        const netUsd = inlineDepositReadRecvNetUsd();
        if (!netUsd) {
          sendJOD.value = '';
          return false;
        }
        const grossAmount = resolveInlineDepositGrossAmountFromNetUsd(netUsd, activeMethod);
        if (!grossAmount) {
          sendJOD.value = '';
          try { updateSubmitState(); } catch (_) {}
          return false;
        }
        sendJOD.value = roundInlineAmount(grossAmount, 2).toFixed(2);
        try { updateSubmitState(); } catch (_) {}
        return true;
      }

      const grossAmount = resolveInlinePositiveNumber(sendJOD.value);
      if (!grossAmount) {
        recvCUR.value = '';
        try { updateSubmitState(); } catch (_) {}
        return false;
      }
      const netUsd = resolveInlineDepositNetUsdFromGrossAmount(grossAmount, activeMethod);
      if (!netUsd) {
        recvCUR.value = '';
        try { updateSubmitState(); } catch (_) {}
        return false;
      }
      inlineDepositWriteRecvDisplay(netUsd);
      try { updateSubmitState(); } catch (_) {}
      return true;
    } finally {
      inlineDepositAmountSyncing = false;
    }
  }

  function bindInlineWithdrawAmountHooks(){
    if (!sendJOD || !recvCUR) return;

    if (typeof sendJOD.oninput === 'function' && sendJOD.oninput.__inlineWithdrawFeeWrapped !== '1') {
      const originalSendInput = sendJOD.oninput;
      sendJOD.oninput = function(){
        const result = originalSendInput.apply(this, arguments);
        try {
          if (isInlineWithdrawFlowActive()) syncInlineWithdrawAmountsFromSource('pay');
          else syncInlineDepositAmountsFromSource('pay');
        } catch (_) {}
        return result;
      };
      try { sendJOD.oninput.__inlineWithdrawFeeWrapped = '1'; } catch (_) {}
    } else if (typeof sendJOD.oninput !== 'function' && !sendJOD.__inlineWithdrawFeeListenerBound) {
      sendJOD.addEventListener('input', function(){
        try {
          if (isInlineWithdrawFlowActive()) syncInlineWithdrawAmountsFromSource('pay');
          else syncInlineDepositAmountsFromSource('pay');
        } catch (_) {}
      });
      try { sendJOD.__inlineWithdrawFeeListenerBound = true; } catch (_) {}
    }

    if (typeof recvCUR.oninput === 'function' && recvCUR.oninput.__inlineWithdrawFeeWrapped !== '1') {
      const originalRecvInput = recvCUR.oninput;
      recvCUR.oninput = function(){
        const result = originalRecvInput.apply(this, arguments);
        try {
          if (isInlineWithdrawFlowActive()) syncInlineWithdrawAmountsFromSource('usd');
          else syncInlineDepositAmountsFromSource('usd');
        } catch (_) {}
        return result;
      };
      try { recvCUR.oninput.__inlineWithdrawFeeWrapped = '1'; } catch (_) {}
    } else if (typeof recvCUR.oninput !== 'function' && !recvCUR.__inlineWithdrawFeeListenerBound) {
      recvCUR.addEventListener('input', function(){
        try {
          if (isInlineWithdrawFlowActive()) syncInlineWithdrawAmountsFromSource('usd');
          else syncInlineDepositAmountsFromSource('usd');
        } catch (_) {}
      });
      try { recvCUR.__inlineWithdrawFeeListenerBound = true; } catch (_) {}
    }
  }

  function seedInlineMethodAmounts(method){
    if (!sendJOD || !recvCUR) return false;
    const minUsd = resolveInlineMethodMinUsd(method);
    const isWithdraw = isInlineWithdrawFlowActive();
    const currencyPerUsd = resolveInlineWithdrawCurrencyPerUsd(method);
    if (!minUsd) {
      clearInlineMethodAmounts();
      return false;
    }

    let payAmount = isWithdraw
      ? resolveInlineWithdrawPayoutAmountFromTotalUsd(minUsd, method)
      : resolveInlineDepositGrossAmountFromNetUsd(minUsd, method);
    if (!payAmount && !isWithdraw) {
      if (currencyPerUsd) {
        payAmount = roundInlineAmount(minUsd * currencyPerUsd, 6);
      } else if (typeof computeCurFromUsd === 'function') {
        payAmount = resolveInlinePositiveNumber(computeCurFromUsd(minUsd));
      }
    }
    if (isWithdraw && (!Number.isFinite(Number(payAmount)) || Number(payAmount) <= 0)) {
      payAmount = 0.01;
    }
    if (!payAmount) {
      clearInlineMethodAmounts();
      return false;
    }

    payAmount = Math.ceil((payAmount - 1e-9) * 100) / 100;
    if (!resolveInlinePositiveNumber(payAmount)) {
      clearInlineMethodAmounts();
      return false;
    }

    let usdAmount = isWithdraw
      ? resolveInlineWithdrawTotalUsdFromPayoutAmount(payAmount, method)
      : resolveInlineDepositNetUsdFromGrossAmount(payAmount, method);
    for (let step = 0; step < 20 && (!usdAmount || usdAmount + 1e-9 < minUsd); step += 1) {
      payAmount = Number((payAmount + 0.01).toFixed(2));
      usdAmount = isWithdraw
        ? resolveInlineWithdrawTotalUsdFromPayoutAmount(payAmount, method)
        : resolveInlineDepositNetUsdFromGrossAmount(payAmount, method);
    }

    if (!usdAmount) {
      clearInlineMethodAmounts();
      return false;
    }

    sendJOD.value = payAmount.toFixed(2);
    if (typeof sendJOD.oninput === 'function') {
      try {
        sendJOD.oninput();
      } catch (_) {
        if (isWithdraw) recvCUR.value = usdAmount.toFixed(2);
        else inlineDepositWriteRecvDisplay(usdAmount);
      }
    } else {
      if (isWithdraw) recvCUR.value = usdAmount.toFixed(2);
      else inlineDepositWriteRecvDisplay(usdAmount);
    }
    return true;
  }

  function normalizeInlineWithdrawLookupText(value){
    return String(value || '').trim().toLowerCase().replace(/[\s._-]+/g, '');
  }

  function buildInlineWithdrawFieldEntries(method, valuesMap){
    const values = (valuesMap && typeof valuesMap === 'object') ? valuesMap : {};
    const defs = getInlineMethodExtraFields(method);
    const entries = defs.map(function(def, index){
      const key = String(def && def.key || ('field_' + (index + 1))).trim();
      const label = String(def && def.label || key).trim();
      const value = String(values[key] == null ? '' : values[key]).trim();
      return { key: key, label: label, value: value };
    }).filter(function(entry){
      return !!entry.value;
    });

    Object.keys(values).forEach(function(rawKey){
      const key = String(rawKey || '').trim();
      if (!key || entries.some(function(entry){ return entry.key === key; })) return;
      const value = String(values[key] == null ? '' : values[key]).trim();
      if (!value) return;
      entries.push({ key: key, label: key, value: value });
    });

    return entries;
  }

  function scoreInlineWithdrawTargetEntry(entry){
    const key = normalizeInlineWithdrawLookupText(entry && entry.key);
    const label = String(entry && entry.label || '').trim();
    let score = 0;
    if (/^(payouttarget|receivertarget|recipienttarget|wallet|walletnumber|walletid|account|accountnumber|iban|phone|number|target|receiver|recipient|userid|userid|id)$/.test(key)) score += 160;
    if (/(payouttarget|receivertarget|recipienttarget|walletnumber|walletid|accountnumber|iban|phone|number|target|receiver|recipient)/.test(key)) score += 110;
    if (/(رقم|محفظ|حساب|آيبان|ايبان|iban|هاتف|جوال|واتساب|معرف|ايدي|المستلم|المحفظة|الحساب)/i.test(label)) score += 85;
    if (/(name|fullname|owner|اسم)/i.test(label) || /(name|fullname|owner)/.test(key)) score -= 120;
    return score;
  }

  function scoreInlineWithdrawNameEntry(entry){
    const key = normalizeInlineWithdrawLookupText(entry && entry.key);
    const label = String(entry && entry.label || '').trim();
    let score = 0;
    if (/^(payoutname|receivername|recipientname|accountname|ownername|fullname|name)$/.test(key)) score += 180;
    if (/(payoutname|receivername|recipientname|accountname|ownername|fullname|name)/.test(key)) score += 120;
    if (/(اسم|الاسم|اسم المستلم|اسم الحساب|اسم صاحب|الاسم الكامل)/i.test(label)) score += 90;
    if (/(wallet|accountnumber|iban|phone|number|target|رقم|محفظ|حساب|آيبان|ايبان|هاتف|جوال|واتساب|معرف|ايدي)/i.test(label) || /(wallet|accountnumber|iban|phone|number|target)/.test(key)) score -= 120;
    return score;
  }

  function inlineWithdrawFieldLooksLikeName(def){
    const key = normalizeInlineWithdrawLookupText(def && def.key);
    const label = String(def && def.label || '').trim();
    if (!key && !label) return false;
    if (/^(payoutname|receivername|recipientname|accountname|ownername|fullname|name)$/.test(key)) return true;
    if (/(payoutname|receivername|recipientname|accountname|ownername|fullname|name)/.test(key)) return true;
    return /(اسم|الاسم|اسم المستلم|اسم الحساب|اسم صاحب|الاسم الكامل)/i.test(label);
  }

  function inlineWithdrawMethodHasNameField(method){
    const defs = getInlineMethodExtraFields(method);
    return defs.some(function(def){
      return inlineWithdrawFieldLooksLikeName(def);
    });
  }

  function pickInlineWithdrawEntry(entries, scorer, excludeKey){
    const safeExcludeKey = String(excludeKey || '').trim();
    const ranked = (Array.isArray(entries) ? entries : [])
      .filter(function(entry){
        return entry && entry.value && (!safeExcludeKey || String(entry.key || '').trim() !== safeExcludeKey);
      })
      .map(function(entry, index){
        return {
          entry: entry,
          score: Number(scorer(entry)) || 0,
          index: index
        };
      })
      .filter(function(item){
        return item.score > 0;
      })
      .sort(function(a, b){
        if (b.score !== a.score) return b.score - a.score;
        return a.index - b.index;
      });
    return ranked.length ? ranked[0].entry : null;
  }

  function resolveInlineWithdrawPayoutFields(method, valuesMap){
    const values = (valuesMap && typeof valuesMap === 'object') ? valuesMap : {};
    const methodHasNameField = inlineWithdrawMethodHasNameField(method);
    const directTarget = [
      values.payoutTarget,
      values.payout_target,
      values.receiverTarget,
      values.receiver_target,
      values.recipientTarget,
      values.recipient_target
    ].map(function(value){
      return String(value == null ? '' : value).trim();
    }).find(Boolean) || '';
    const directName = [
      values.payoutName,
      values.payout_name,
      values.receiverName,
      values.receiver_name,
      values.recipientName,
      values.recipient_name
    ].map(function(value){
      return String(value == null ? '' : value).trim();
    }).find(Boolean) || '';
    if (directTarget && directName) {
      return { target: directTarget, name: directName };
    }

    const entries = buildInlineWithdrawFieldEntries(method, values);
    const targetEntry = directTarget ? null : pickInlineWithdrawEntry(entries, scoreInlineWithdrawTargetEntry, '');
    const nameEntry = directName ? null : pickInlineWithdrawEntry(entries, scoreInlineWithdrawNameEntry, targetEntry && targetEntry.key);
    const resolvedTarget = directTarget || String(targetEntry && targetEntry.value || '').trim();
    let resolvedName = directName || String(nameEntry && nameEntry.value || '').trim();
    if (resolvedTarget && resolvedName && resolvedTarget === resolvedName && !methodHasNameField) {
      resolvedName = '';
    }

    return {
      target: resolvedTarget,
      name: resolvedName,
      requiresName: methodHasNameField
    };
  }

  function getBalanceMemoryStore(){
    try {
      if (!window.__BALANCE_MEMORY__ || typeof window.__BALANCE_MEMORY__ !== 'object') {
        window.__BALANCE_MEMORY__ = {};
      }
      return window.__BALANCE_MEMORY__;
    } catch (_) {
      return {};
    }
  }

  function writeBalanceMemory(uid, value){
    const safeUid = String(uid || '').trim();
    const num = Number(value);
    if (!safeUid || !Number.isFinite(num)) return undefined;
    try {
      const store = getBalanceMemoryStore();
      store[safeUid] = num;
      store.lastUid = safeUid;
      store.lastValue = num;
    } catch (_) {}
    try { localStorage.setItem('balance:cache:' + safeUid, String(num)); } catch (_) {}
    return num;
  }

  function readBalanceMemory(uid){
    const safeUid = String(uid || '').trim();
    if (!safeUid) return null;
    try {
      const store = getBalanceMemoryStore();
      const val = Number(store[safeUid]);
      if (Number.isFinite(val)) return val;
    } catch (_) {}
    try {
      const cached = Number(localStorage.getItem('balance:cache:' + safeUid));
      if (Number.isFinite(cached)) return cached;
    } catch (_) {}
    return null;
  }

  function updateInlineWithdrawBalanceCache(value){
    const nextBalance = Number(value);
    if (!Number.isFinite(nextBalance)) return;
    const formatted = (typeof window.__formatHeaderBalanceDisplay === 'function')
      ? window.__formatHeaderBalanceDisplay(nextBalance)
      : ((typeof window.formatCurrencyFromJOD === 'function')
          ? window.formatCurrencyFromJOD(nextBalance)
          : (nextBalance.toFixed(3) + ' USD'));
    try { window.__BAL_BASE__ = nextBalance; window.__BALANCE__ = nextBalance; } catch (_) {}
    try {
      if (typeof window.__setHeaderBalanceDisplay === 'function') {
        window.__setHeaderBalanceDisplay(formatted);
      } else {
        const textEl = document.getElementById('headerBalanceText');
        const currencyEl = document.getElementById('headerBalanceCurrency');
        if (textEl) {
          const parts = String(formatted || '').trim().split(/\s+/);
          textEl.textContent = parts.shift() || formatted;
          if (currencyEl) currencyEl.textContent = parts.join(' ') || '';
        }
      }
    } catch (_) {}
    try {
      window.dispatchEvent(new CustomEvent('balance:change', {
        detail: { value: nextBalance, formatted: formatted }
      }));
    } catch (_) {}
    try {
      const currentUid = depositAuth && depositAuth.currentUser && depositAuth.currentUser.uid;
      if (currentUid) writeBalanceMemory(currentUid, nextBalance);
    } catch (_) {}
  }

  function isInlineAutoDepositResponse(data){
    return !!(
      data &&
      data.success === true &&
      (data.autoDeposit === true || data.usdtAutoDeposit === true || data.binanceAutoDeposit === true || data.network === 'BINANCE') &&
      (data.newBalance !== undefined || data.balanceAfter !== undefined) &&
      (data.addedAmount !== undefined || data.addedUSD !== undefined || data.amountUSD !== undefined)
    );
  }

  function resolveInlineAutoDepositBalance(data){
    const candidates = [data && data.newBalance, data && data.balanceAfter, data && data.balance];
    for (let i = 0; i < candidates.length; i += 1) {
      const num = Number(candidates[i]);
      if (Number.isFinite(num)) return num;
    }
    return null;
  }

  function resolveInlineAutoDepositAddedAmount(data){
    const candidates = [data && data.addedAmount, data && data.addedUSD, data && data.amountUSD, data && data.amount];
    for (let i = 0; i < candidates.length; i += 1) {
      const num = Number(candidates[i]);
      if (Number.isFinite(num) && num > 0) return num;
    }
    return null;
  }

  function showInlineAutoDepositAnimation(data){
    try {
      const amount = resolveInlineAutoDepositAddedAmount(data);
      const currency = String((data && (data.addedCurrency || data.currency || data.amountCurrency || data.currencyCode)) || 'USD').trim() || 'USD';
      const code = String(data && (data.depositCode || data.code || data.orderId || data.networkTransactionId) || '').trim();
      if (typeof showWalletActivityOverlay === 'function') {
        try {
          if (typeof suspendWalletCreditMotionWatcher === 'function') suspendWalletCreditMotionWatcher(14000);
        } catch (_) {}
        showWalletActivityOverlay({
          title: 'تم قبول الإيداع',
          bannerText: 'تم قبول الإيداع',
          message: 'تمت إضافة المبلغ إلى رصيدك بنجاح.',
          note: 'يمكنك مراجعة الحركة من سجل المحفظة.',
          detailLabel: code ? 'كود الإيداع' : '',
          detailText: code,
          detailCopyText: code,
          amount: amount,
          currency: currency,
          primaryLabel: 'المحفظة',
          secondaryLabel: 'الرئيسية'
        });
        return true;
      }
      const text = (typeof formatSuccessChargeText === 'function')
        ? formatSuccessChargeText(amount, currency)
        : ((Number.isFinite(amount) ? amount.toFixed(3) : '') + ' ' + currency).trim();
      if (typeof createSuccessOrderAnimation !== 'function') return false;
      const shell = createSuccessOrderAnimation(text);
      shell.id = 'inline-auto-deposit-success-animation';
      const old = document.getElementById(shell.id);
      if (old && old.parentNode) old.parentNode.removeChild(old);
      const host =
        (state && state.app && state.app.querySelector && state.app.querySelector('main')) ||
        (state && state.app && state.app.querySelector && state.app.querySelector('#methodModal .modal-content')) ||
        (document && document.body);
      if (!host || !host.insertBefore) return false;
      host.insertBefore(shell, host.firstChild || null);
      if (typeof shell.__play === 'function') shell.__play();
      setTimeout(function(){
        try { if (shell && shell.parentNode) shell.parentNode.removeChild(shell); } catch (_) {}
      }, 4200);
      return true;
    } catch (_) {
      return false;
    }
  }

  function applyInlineAutoDepositSuccessPayload(data){
    if (!isInlineAutoDepositResponse(data)) return false;
    rememberInlineAutoDepositPayload(data);
    const applyKey = buildInlineAutoDepositApplyKey(data);
    const now = Date.now();
    const duplicateAnimation = !!(
      applyKey &&
      applyKey === inlineAutoDepositLastAppliedKey &&
      (now - Number(inlineAutoDepositLastAppliedAt || 0)) < 10000
    );
    const nextBalance = resolveInlineAutoDepositBalance(data);
    if (nextBalance != null) updateInlineWithdrawBalanceCache(nextBalance);
    try { refreshInlineHistoryViews(); } catch (_) {}
    if (duplicateAnimation) return true;
    inlineAutoDepositLastAppliedKey = applyKey;
    inlineAutoDepositLastAppliedAt = now;
    let animationShown = false;
    try { animationShown = showInlineAutoDepositAnimation(data) === true; } catch (_) {}
    try {
      if (animationShown) return true;
      const code = String(data.depositCode || data.code || data.orderId || '').trim();
      const message = code
        ? ('تم قبول إيداع Binance تلقائيًا. كود الطلب: ' + code)
        : 'تم قبول إيداع Binance تلقائيًا.';
      if (typeof showToast === 'function') showToast(message, 'success', 5000);
    } catch (_) {}
    return true;
  }

  function resolveInlineHistoryUid(){
    try {
      const currentUid = depositAuth && depositAuth.currentUser && depositAuth.currentUser.uid;
      if (currentUid) return String(currentUid).trim();
    } catch (_) {}
    try {
      const authInstance = firebase && typeof firebase.auth === 'function' ? firebase.auth() : null;
      const fallbackUid = authInstance && authInstance.currentUser && authInstance.currentUser.uid;
      if (fallbackUid) return String(fallbackUid).trim();
    } catch (_) {}
    return '';
  }

  function refreshInlineHistoryViews(){
    try {
      if (typeof window.__PAYMENTS_REFRESH__ === 'function') {
        window.__PAYMENTS_REFRESH__({ force: true, skipSkeleton: true });
      }
    } catch (_) {}
    try {
      if (typeof window.__WALLET_REFRESH__ === 'function') {
        window.__WALLET_REFRESH__({ force: true, skipSkeleton: true });
      }
    } catch (_) {}
  }

  function isInlineDepositRouteActiveForScroll(){
    try {
      const routeKey = String((document.body && document.body.getAttribute('data-inline-route')) || '').toLowerCase();
      if (routeKey === 'deposit' || routeKey === 'edaa') return true;
    } catch (_) {}
    try {
      const rawHash = String(location.hash || '');
      let hashPath = rawHash.charAt(0) === '#' ? rawHash.slice(1) : rawHash;
      while (hashPath.charAt(0) === '/') hashPath = hashPath.slice(1);
      const hashKey = hashPath.split('/').filter(Boolean)[0] || '';
      return hashKey.toLowerCase() === 'deposit' || hashKey.toLowerCase() === 'edaa';
    } catch (_) {}
    return false;
  }

  function resetInlineMethodModalScrollToTop(modal){
    try {
      if (!isInlineDepositRouteActiveForScroll()) return;
      const targetModal = modal || (typeof document !== 'undefined' ? document.getElementById('methodModal') : null);
      const target = targetModal || (typeof document !== 'undefined' ? document.getElementById('methodModal') : null);
      const content = (targetModal && targetModal.querySelector && targetModal.querySelector('.modal-content')) || null;
      const getHeaderOffset = function(){
        try {
          const nodes = Array.from(document.querySelectorAll('.top-header, #topHeader, #siteHeader, .site-header, header'));
          let max = 0;
          nodes.forEach(function(node){
            try {
              const rect = node && node.getBoundingClientRect ? node.getBoundingClientRect() : null;
              const style = node ? getComputedStyle(node) : null;
              if (!rect || rect.height <= 0 || !style) return;
              if (style.position === 'fixed' || style.position === 'sticky') max = Math.max(max, rect.height);
            } catch (_) {}
          });
          return Math.max(0, Math.ceil(max || 0) + 10);
        } catch (_) {
          return 82;
        }
      };
      const run = function(){
        let top = 0;
        try {
          if (target && typeof target.getBoundingClientRect === 'function') {
            const rect = target.getBoundingClientRect();
            const scrollY = window.pageYOffset || (document.documentElement && document.documentElement.scrollTop) || 0;
            top = Math.max(0, Math.floor(scrollY + rect.top - getHeaderOffset()));
          }
        } catch (_) {}
        try {
          if (typeof window.scrollTo === 'function') window.scrollTo({ top: top, left: 0, behavior: 'auto' });
        } catch (_) {
          try { document.documentElement.scrollTop = top; } catch (__) {}
          try { document.body.scrollTop = top; } catch (__) {}
        }
        [targetModal, content, document.getElementById('inlinePage'), document.getElementById('depositInlineApp')].forEach(function(node){
          if (!node) return;
          try {
            if (typeof node.scrollTo === 'function') node.scrollTo({ top: 0, left: 0, behavior: 'auto' });
            else node.scrollTop = 0;
          } catch (_) {
            try { node.scrollTop = 0; } catch (__) {}
          }
        });
      };
      run();
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run);
      [40, 120, 260, 420].forEach(function(delay){
        setTimeout(run, delay);
      });
    } catch (_) {}
  }

  installInlineDepositAuthRecovery();

  if (typeof handleSubmitDeposit === 'function') {
    const __originalInlineHandleSubmitDeposit = handleSubmitDeposit;
    handleSubmitDeposit = async function(country, method){
      const args = arguments;
      const ctx = this;
      return withInlineSubmitFeedback(async function(){
        return await __originalInlineHandleSubmitDeposit.apply(ctx, args);
      });
    };
  }

  if (typeof openMethod === 'function') {
    const __originalInlineOpenMethod = openMethod;
    openMethod = async function(m){
      try { clearInlineMethodAmounts(); } catch (_) {}
      const result = await __originalInlineOpenMethod(m);
      try { bindInlineWithdrawAmountHooks(); } catch (_) {}
      try { seedInlineMethodAmounts(currentMethod || m); } catch (_) {}
      try { renderInlineMethodInfo(currentMethod || m); } catch (_) {}
      try { refreshNativeInlineMethodUi(currentMethod || m); } catch (_) {}
      try { applyInlineFlowModalState(currentMethod || m); } catch (_) {}
      try { syncInlineProofTriggerLabel(currentMethod || m); } catch (_) {}
      if (!hasNativeInlineMethodModal()) {
        try { renderInlineExtraFields(currentMethod || m); } catch (_) {}
      }
      try { scheduleInlineMethodInitialFocusClear(typeof methodModal !== 'undefined' ? methodModal : null); } catch (_) {}
      try { updateSubmitState(); } catch (_) {}
      try { resetInlineMethodModalScrollToTop(typeof methodModal !== 'undefined' ? methodModal : null); } catch (_) {}
      return result;
    };
  }

  try { globalThis.resolveInlineMethodRequiresProof = resolveInlineMethodRequiresProof; } catch (_) {}
  try { globalThis.resolveInlineMethodProofButtonLabel = resolveInlineMethodProofButtonLabel; } catch (_) {}
})();
`.trim();
  }

  function sanitizeInlineDepositScript(scriptText, templateWorkerBase) {
    const text = String(scriptText || '');
    const sanitized = text
      .replace(
        /const\s+DEPOSIT_COUNTRIES_CACHE_KEY\s*=\s*'edaa:deposit:countries:v1';\s*const\s+DEPOSIT_COUNTRIES_CACHE_META_KEY\s*=\s*'edaa:deposit:countries:meta:v1';/g,
        [
          "function getEmbeddedInlineHashPath(){",
          "  try {",
          "    const hash = String((typeof window !== 'undefined' && window.location && window.location.hash) || '');",
          "    if (hash.indexOf('#/') === 0) return hash.slice(2);",
          "    if (hash.charAt(0) === '#') return hash.slice(1);",
          "    return hash;",
          "  } catch (_) {",
          "    return '';",
          "  }",
          "}",
          "",
          "function getEmbeddedInlineFlowKind(){",
          "  try {",
          "    const raw = getEmbeddedInlineHashPath();",
          "    const first = raw.split('/').filter(Boolean)[0] || '';",
          "    return (first === 'withdraw' || first === 'sahb') ? 'withdraw' : 'deposit';",
          "  } catch (_) {",
          "    return 'deposit';",
          "  }",
          "}",
          "",
          "function getEmbeddedInlineFlowPath(){",
          "  return getEmbeddedInlineFlowKind() === 'withdraw' ? 'withdraw' : 'deposit';",
          "}",
          "",
          "function getEmbeddedCountriesCacheViewerKey(){",
          "  try {",
          "    const currentUid = (typeof depositAuth !== 'undefined' && depositAuth && depositAuth.currentUser && depositAuth.currentUser.uid)",
          "      ? depositAuth.currentUser.uid",
          "      : '';",
          "    if (currentUid) return 'uid:' + String(currentUid || '').trim().toLowerCase();",
          "  } catch (_) {}",
          "  try {",
          "    const authInstance = (typeof firebase !== 'undefined' && firebase && typeof firebase.auth === 'function')",
          "      ? firebase.auth()",
          "      : null;",
          "    const fallbackUid = authInstance && authInstance.currentUser && authInstance.currentUser.uid;",
          "    if (fallbackUid) return 'uid:' + String(fallbackUid || '').trim().toLowerCase();",
          "  } catch (_) {}",
          "  return 'guest';",
          "}",
          "",
          "function getEmbeddedCountriesCacheKey(){",
          "  return 'edaa:' + getEmbeddedInlineFlowKind() + ':countries:v4:' + getEmbeddedCountriesCacheViewerKey();",
          "}",
          "",
          "function getEmbeddedCountriesCacheMetaKey(){",
          "  return 'edaa:' + getEmbeddedInlineFlowKind() + ':countries:meta:v4:' + getEmbeddedCountriesCacheViewerKey();",
          "}",
          "",
          "const DEPOSIT_COUNTRIES_CACHE_KEY = getEmbeddedCountriesCacheKey();",
          "const DEPOSIT_COUNTRIES_CACHE_META_KEY = getEmbeddedCountriesCacheMetaKey();"
        ].join('\n')
      )
      .replace(/\`\$\{WORKER\}\/deposit\/upload\`/g, "`${WORKER}/${getEmbeddedInlineFlowPath()}/upload`")
      .replace(/\`\$\{WORKER\}\/deposit\/submit\`/g, "`${WORKER}/${getEmbeddedInlineFlowPath()}/submit`")
      .replace(
        /function\s+buildCountryHash\s*\(\s*id\s*\)\s*\{[\s\S]*?\}/g,
        [
          "function buildCountryHash(id){",
          "  const safeId = String(id || '').trim();",
          "  const flowPath = (typeof getEmbeddedInlineFlowPath === 'function') ? getEmbeddedInlineFlowPath() : 'deposit';",
          "  if (!safeId) return '#/' + flowPath;",
          "  return '#/' + flowPath + '/' + encodeURIComponent(safeId);",
          "}"
        ].join('\n')
      )
      .replace(
        /function\s+parseHash\s*\(\)\s*\{[\s\S]*?\}\s*(?=function\s+setHashForCountry)/g,
        [
          "function parseHash(){",
          "  try{",
          "    const raw = (typeof getEmbeddedInlineHashPath === 'function')",
          "      ? getEmbeddedInlineHashPath()",
          "      : String(location.hash || '').replace(/^#\\/?/, '');",
          "    const parts = raw.split('/').filter(Boolean);",
          "    if (!parts.length) return { type:'root', flow: getEmbeddedInlineFlowKind() };",
          "",
          "    const first = decodeHashPart(parts[0]).trim();",
          "    const firstLower = first.toLowerCase();",
          "    const routeFlow = 'deposit';",
          "",
          "    if (firstLower === 'deposit' || firstLower === 'edaa') {",
          "      const countryId = parts.length > 1 ? decodeHashPart(parts[1]).trim() : '';",
          "      if (countryId) return { type:'country', id: countryId, flow: routeFlow };",
          "      return { type:'root', flow: routeFlow };",
          "    }",
          "",
          "    if (parts.length === 1) {",
          "      const legacyId = decodeHashPart(parts[0]).trim();",
          "      const legacyLooksLikeCountry = /^[A-Z0-9]{2,12}$/.test(legacyId) && /[A-Z]/.test(legacyId);",
          "      if (legacyLooksLikeCountry && !DEPOSIT_HASH_ROUTE_KEYS.has(legacyId.toLowerCase())) {",
          "        return { type:'country', id: legacyId, legacy: true, flow: getEmbeddedInlineFlowKind() };",
          "      }",
          "    }",
          "    return { type:'root', flow: getEmbeddedInlineFlowKind() };",
          "  }catch(_){",
          "    return { type:'root', flow: (typeof getEmbeddedInlineFlowKind === 'function') ? getEmbeddedInlineFlowKind() : 'deposit' };",
          "  }",
          "}",
          ""
        ].join('\n')
      )
      .replace(/window\.location\.replace\([^)]*\);?/g, '')
      .replace(
        /const\s+WORKER_DEFAULT\s*=\s*["'][^"']+["'];[\s\S]*?const\s+WORKER\s*=\s*normalizeWorkerBase\(WORKER_BASE\)\s*\|\|\s*WORKER_DEFAULT\s*;/gi,
        buildInlineDepositWorkerBlock(templateWorkerBase)
      )
      .replace(
        /const\s+depositFirebaseConfig\s*=\s*\{[\s\S]*?depositDb\s*=\s*null;\s*\}/gi,
        buildInlineDepositFirebaseBlock()
      )
      .replace(
        /function\s+debugCountriesLog\s*\(\s*level\s*,\s*message\s*,\s*payload\s*\)\s*\{[\s\S]*?\}\s*(?=function\s+setCountriesRetryButtonVisible)/,
        [
          "function debugCountriesLog(level, message, payload){",
          "  try {",
          "    const severity = String(level || '').trim().toLowerCase();",
          "    let debugEnabled = false;",
          "    try {",
          "      if (typeof window !== 'undefined' && window.__DEPOSIT_INLINE_DEBUG__ === true) debugEnabled = true;",
          "      else if (typeof localStorage !== 'undefined' && localStorage.getItem('depositInlineDebug') === '1') debugEnabled = true;",
          "    } catch (_) {}",
          "    if (severity !== 'error' && !debugEnabled) return;",
          "    const logger = (console && typeof console[severity] === 'function') ? console[severity] : console.log;",
          "    if (payload !== undefined) logger(DEPOSIT_COUNTRIES_DEBUG_PREFIX + ' ' + message, payload);",
          "    else logger(DEPOSIT_COUNTRIES_DEBUG_PREFIX + ' ' + message);",
          "  } catch (_) {}",
          "}",
          ""
        ].join('\n')
      )
      .replace(
        /const\s+DEPOSIT_HASH_ROUTE_KEYS\s*=\s*new\s+Set\(\[[\s\S]*?\]\);/g,
        [
          "const DEPOSIT_HASH_ROUTE_KEYS = new Set([",
          "  '404','games','subscription','subscriptions',",
          "  'deposit','edaa',",
          "  'login','settings','telegram','security','orders','dafaati','api','reviews','favorites','privacy','terms','transfer','wallet',",
          "  'payments','payment','internet','numbers','currency','accounts','misc','units','chat','activations','applications','cards','vip','codes','vpn'",
          "]);"
        ].join('\n')
      )
      .replace(
        /if\s*\(parts\.length\s*===\s*1\)\s*\{\s*const\s+legacyId\s*=\s*decodeHashPart\(parts\[0\]\)\.trim\(\);\s*if\s*\(legacyId\s*&&\s*!DEPOSIT_HASH_ROUTE_KEYS\.has\(legacyId\.toLowerCase\(\)\)\)\s*\{\s*return\s*\{\s*type:'country',\s*id:\s*legacyId,\s*legacy:\s*true\s*\};\s*\}\s*\}/g,
        [
          "if (parts.length === 1) {",
          "  const legacyId = decodeHashPart(parts[0]).trim();",
          "  const legacyLooksLikeCountry = /^[A-Z0-9]{2,12}$/.test(legacyId) && /[A-Z]/.test(legacyId);",
          "  if (legacyLooksLikeCountry && !DEPOSIT_HASH_ROUTE_KEYS.has(legacyId.toLowerCase())) {",
          "    return { type:'country', id: legacyId, legacy: true };",
          "  }",
          "}"
        ].join('\n')
      )
      .replace(/localStorage\.getItem\('edaa:worker'\)/g, "''")
      .replace(
        /firebase\.initializeApp\(firebaseConfig\);/g,
        'if (!firebase.apps || !firebase.apps.length) { firebase.initializeApp(firebaseConfig); } else { firebase.app(); }'
      )
      .replace(
        /const\s+currencyCode\s*=\s*String\(raw\.currencyCode\s*\|\|\s*raw\.currency\s*\|\|\s*''\)\.trim\(\)\.toUpperCase\(\);/g,
        "const currencyCodeRaw = String(raw.currencyCode || raw.currency || '').trim().toUpperCase();\n      const currencyCode = currencyCodeRaw.includes('/') ? String((currencyCodeRaw.split('/')[0] || '')).trim().toUpperCase() : currencyCodeRaw;"
      )
      .replace(
        /const\s+fx\s*=\s*await\s+fetchFx\(currentCountry\.id,\s*m\.id,\s*m\?\.data\s*\|\|\s*\{\}\);/g,
        "const activeCountryId = String((currentCountry && currentCountry.id) || (m && m.data && (m.data.countryId || m.data.countryCode || '')) || '').trim();\n        const fx = await fetchFx(activeCountryId, m.id, m?.data || {});"
      )
      .replace(
        /extraFields:\s*normalizeExtraFields\(raw\.extraFields\)/g,
        "extraFields: normalizeExtraFields(raw.extraFields),\n        displayFields: Array.isArray(raw.displayFields) ? raw.displayFields : [],\n        requiresProofImage: raw.requiresProofImage,\n        proofButtonLabel: raw.proofButtonLabel,\n        feePercent: raw.feePercent"
      )
      .replace(
        /if\s*\(Array\.isArray\(fx\.extraFields\)\)\s*m\.data\.extraFields\s*=\s*fx\.extraFields;/g,
        "if (Array.isArray(fx.extraFields)) m.data.extraFields = fx.extraFields;\n          if (Array.isArray(fx.displayFields) && fx.displayFields.length) m.data.displayFields = fx.displayFields;\n          if (fx && Object.prototype.hasOwnProperty.call(fx, 'requiresProofImage')) m.data.requiresProofImage = fx.requiresProofImage;\n          if (fx && typeof fx.proofButtonLabel === 'string' && fx.proofButtonLabel.trim()) m.data.proofButtonLabel = fx.proofButtonLabel.trim();\n          if (fx && Object.prototype.hasOwnProperty.call(fx, 'feePercent')) m.data.feePercent = fx.feePercent;"
      )
      .replace(
        /const\s+okProof\s*=\s*!!uploadedProofUrl;/g,
        "const okProof = !resolveInlineMethodRequiresProof(currentMethod) || !!uploadedProofUrl;"
      )
      .replace(
        /if\s*\(!uploadedProofUrl\)\s*return\s+alert\('من فضلك ارفع الإثبات أولاً\.'\);/g,
        "if (resolveInlineMethodRequiresProof(method || currentMethod) && !uploadedProofUrl) return alert('من فضلك ارفع الإثبات أولاً.');"
      )
      .replace(
        /if\s*\(!currentCountry\s*\|\|\s*!currentMethod\)\s*\{\s*proofPreview\.textContent\s*=\s*'اختر الدولة والطريقة قبل رفع الإثبات\.';/g,
        "if (!currentMethod) {\n        proofPreview.textContent = 'اختر الطريقة قبل رفع الإثبات.';"
      )
      .replace(
        /if\(!currentCountry\s*\|\|\s*!currentCountry\.id\)\s*throw\s+new\s+Error\('اختر الدولة قبل رفع الإثبات\.'\);/g,
        "const uploadCountryId = String((currentCountry && currentCountry.id) || (currentMethod && currentMethod.data && (currentMethod.data.countryId || currentMethod.data.countryCode || '')) || '').trim();\n      const uploadCountryName = String((currentCountry && currentCountry.data && currentCountry.data.name) || (currentMethod && currentMethod.data && (currentMethod.data.countryName || currentMethod.data.countryLabel || '')) || '').trim();"
      )
      .replace(
        /fd\.append\('image',\s*currentProofFile\);/g,
        [
          "fd.append('image', currentProofFile);",
          "      try {",
          "        const sessionInfo = JSON.parse(localStorage.getItem('sessionKeyInfo') || 'null');",
          "        const uploadUserUid = String((depositAuth && depositAuth.currentUser && depositAuth.currentUser.uid) || (sessionInfo && (sessionInfo.uid || sessionInfo.useruid)) || '').trim();",
          "        const uploadSessionKey = String((sessionInfo && (sessionInfo.sessionKey || sessionInfo.session_key)) || '').trim();",
          "        if (uploadUserUid) fd.append('useruid', uploadUserUid);",
          "        if (uploadSessionKey) fd.append('sessionKey', uploadSessionKey);",
          "      } catch (_) {}"
        ].join('\n')
      )
      .replace(
        /fd\.append\("image",\s*currentProofFile\);/g,
        [
          "fd.append(\"image\", currentProofFile);",
          "      try {",
          "        const sessionInfo = JSON.parse(localStorage.getItem('sessionKeyInfo') || 'null');",
          "        const uploadUserUid = String((depositAuth && depositAuth.currentUser && depositAuth.currentUser.uid) || (sessionInfo && (sessionInfo.uid || sessionInfo.useruid)) || '').trim();",
          "        const uploadSessionKey = String((sessionInfo && (sessionInfo.sessionKey || sessionInfo.session_key)) || '').trim();",
          "        if (uploadUserUid) fd.append('useruid', uploadUserUid);",
          "        if (uploadSessionKey) fd.append('sessionKey', uploadSessionKey);",
          "      } catch (_) {}"
        ].join('\n')
      )
      .replace(/fd\.append\('countryId',\s*currentCountry\.id\);/g, "fd.append('countryId', uploadCountryId);")
      .replace(/fd\.append\('countryName',\s*currentCountry\?\.data\?\.name\s*\|\|\s*''\);/g, "fd.append('countryName', uploadCountryName);")
      .replace(/const\s+okMeta\s*=\s*!!currentMethod\s*&&\s*!!currentCountry;/g, 'const okMeta  = !!currentMethod;');
    const optimized = sanitized.replace(
      /if\s*\(!isPositiveNumber\(usdPerJOD\)\)\s*\{\s*const\s+fromCfg\s*=\s*await\s+fetchUsdPerJODFromConfig\(\);\s*if\s*\(Number\.isFinite\(fromCfg\)\s*&&\s*fromCfg\s*>\s*0\)\s*usdPerJOD\s*=\s*fromCfg;\s*\}/g,
      [
        "if (!isPositiveNumber(usdPerJOD) && !isPositiveNumber(fxRatePerUSD) && isPositiveNumber(fxRatePerJOD)) {",
        "  const fromCfg = await fetchUsdPerJODFromConfig();",
        "  if (Number.isFinite(fromCfg) && fromCfg>0) usdPerJOD = fromCfg;",
        "}"
      ].join('\n')
    );
    return optimized
      .replace(
        /if\s*\(closeModal\)\s*closeModal\.addEventListener\('click',\s*closeModalFn\);\s*if\s*\(methodModal\)\s*methodModal\.addEventListener\('click',\s*\(e\)\s*=>\s*\{\s*if\s*\(e\.target===methodModal\)\s*closeModalFn\(\);\s*\}\);/m,
        [
          "if (closeModal) closeModal.addEventListener('click', closeModalFn);",
          "if (methodModal) methodModal.addEventListener('click', (e)=>{ if(e.target===methodModal && !(methodModal.classList && methodModal.classList.contains('inline-method-page'))) closeModalFn(); });",
          "try { window.__depositInlineCloseMethodModal = function(){",
          "  try { closeModalFn(); } catch (_) {}",
          "  try {",
          "    const modal = document.querySelector('#depositInlineApp #methodModal') || methodModal;",
          "    if (modal) {",
          "      modal.classList.add('hidden');",
          "      modal.classList.remove('open');",
          "      modal.classList.remove('inline-method-page');",
          "      modal.removeAttribute('data-inline-method-page');",
          "      modal.setAttribute('aria-hidden', 'true');",
          "      modal.style.removeProperty('display');",
          "      modal.style.removeProperty('opacity');",
          "      modal.style.removeProperty('visibility');",
          "      modal.style.removeProperty('pointer-events');",
          "      try { if (modal.parentElement) { modal.parentElement.classList.remove('method-modal-open'); modal.parentElement.classList.remove('modal-open'); } } catch (_) {}",
          "    }",
          "  } catch (_) {}",
          "}; } catch (_) {}"
        ].join('\n')
      )
      .replace(
        /try\s*\{\s*applyRoute\(true\);\s*\}\s*catch\(_\)\{\}\s*watchCountries\(\);/m,
        function () {
          // Replacement function (not a string) so literal '$' sequences in the
          // generated block (e.g. currency labels like 'رصيدك: $') are inserted
          // verbatim instead of being treated as $-substitution patterns.
          return buildInlineDepositEnhancementBlock() + '\ntry { applyRoute(true); } catch(_){ }\ntry { watchCountries(); } catch(_){ }';
        }
      );
  }

  function mount(container) {
    if (state.mountPromise) return state.mountPromise;
    state.mountPromise = Promise.resolve()
      .then(function () {
        document.body.classList.add('deposit-inline-active');
        return loadEdAA();
      })
      .then(async function (payload) {
        ensureStyle(payload.styles);
        document.body.classList.add('deposit-inline-active');

        if (!state.app) {
          const wrap = document.createElement('div');
          wrap.id = 'depositInlineApp';
          wrap.className = 'deposit-inline-page';
          wrap.innerHTML = payload.markup;
          state.app = wrap;
        }

        if (container && state.app.parentNode !== container) {
          container.innerHTML = '';
          container.appendChild(state.app);
        }

        applyInlineFlowCopy(state.app, getInlineFlowFromHash());
        ensureFallbackCountriesRetryButton(state.app);
        bindInlineModalEnhancements(state.app);

        if (!state.scriptLoaded) {
          state.templateWorkerBase = normalizeWorkerBase(payload && payload.templateWorkerBase || '') || state.templateWorkerBase || '';
          const safeScript = sanitizeInlineDepositScript(payload.scriptText, payload && payload.templateWorkerBase || '');
          try {
            const runMode = await runInlineDepositScript(state.app, safeScript);
            ensureFallbackCountriesRetryButton(state.app);
            try {
              depositInlineLog('info', '[deposit-inline] script executed', {
                templateSource: payload && payload.source ? payload.source : 'unknown',
                runMode: runMode || 'unknown',
                resolvedWorkerBase: getRecoveryWorkerBase() || ''
              });
            } catch (_) {}
            try {
              depositInlineLog('info', '[deposit-inline] embedded refresh handlers preserved');
            } catch (_) {}
            state.scriptLoaded = true;
          } catch (err) {
            state.scriptLoaded = false;
            try {
              console.error('[deposit-inline] failed to execute embedded deposit script', {
                error: err && err.message ? err.message : String(err || ''),
                primaryError: err && err.__primary && err.__primary.message ? err.__primary.message : undefined
              });
            } catch (_) {}
            console.error('فشل تشغيل سكربت الإيداع داخل الصفحة الرئيسية', err);
          }
        }
      })
      .catch(function (err) {
        console.error('تعذر تحميل صفحة الإيداع المضمنة', err);
        if (container) {
          container.innerHTML = '<p class="no-results" style="text-align:center;padding:24px;">تعذر تحميل صفحة الإيداع حاليًا.</p>';
        }
      })
      .finally(function () {
        state.mountPromise = null;
      });
    return state.mountPromise;
  }

  function deactivateStyles() {
    document.body.classList.remove('deposit-inline-active');
  }

  function resetDepositInlineShellState() {
    try { state.lastHashFlow = ''; } catch (_) {}
    try { deactivateStyles(); } catch (_) {}
    try { if (typeof window.__setInlineWalletRoutePending === 'function') window.__setInlineWalletRoutePending(false); } catch (_) {}
    try { setInlinePreloaderVisible(state.app, false); } catch (_) {}
    try { restoreFlowSwitchUiHints(state.app); } catch (_) {}
    try {
      if (state.app && state.app.style) {
        state.app.classList.remove('method-modal-open');
        state.app.classList.remove('modal-open');
        state.app.style.removeProperty('display');
        state.app.style.removeProperty('opacity');
        state.app.style.removeProperty('visibility');
        state.app.style.removeProperty('pointer-events');
      }
    } catch (_) {}
    try {
      if (state.container && state.container.style) {
        state.container.style.removeProperty('display');
        state.container.style.removeProperty('opacity');
        state.container.style.removeProperty('visibility');
        state.container.style.removeProperty('pointer-events');
      }
    } catch (_) {}
  }
  try { window.__depositInlineResetShellState = resetDepositInlineShellState; } catch (_) {}

  function closeDepositInlineMethodModalForRouteEntry() {
    state.suppressInlineMethodModalUntil = Date.now() + 5000;
    const closeOnce = function () {
      try {
        if (Date.now() > Number(state.suppressInlineMethodModalUntil || 0)) return;
        if (Date.now() - Number(state.lastInlineAppClickAt || 0) < 900) return;
        const modal =
          (state.app && state.app.querySelector && state.app.querySelector('#methodModal')) ||
          document.querySelector('#depositInlineApp #methodModal') ||
          document.getElementById('methodModal');
        if (!modal) return;
        if (typeof window.__depositInlineForceCloseMethodModal === 'function') {
          try {
            window.__depositInlineForceCloseMethodModal();
            return;
          } catch (_) {}
        }
        if (typeof window.__depositInlineCloseMethodModal === 'function') {
          try {
            window.__depositInlineCloseMethodModal();
          } catch (_) {}
        }
        modal.classList.add('hidden');
        modal.classList.remove('open');
        modal.classList.remove('inline-method-page');
        modal.removeAttribute('data-inline-method-page');
        modal.setAttribute('aria-hidden', 'true');
        try {
          if (modal.parentElement) {
            modal.parentElement.classList.remove('method-modal-open');
            modal.parentElement.classList.remove('modal-open');
          }
        } catch (_) {}
      } catch (_) {}
    };
    closeOnce();
    [40, 160, 360, 800, 1500, 3000, 5000].forEach(function (delay) {
      try { window.setTimeout(closeOnce, delay); } catch (_) {}
    });
  }

  window.addEventListener('hashchange', function () {
    const hash = (location.hash || '').toLowerCase();
    const nextFlow = /^#\/(?:deposit|edaa)(?:\/|$)/.test(hash) ? 'deposit' : '';
    const prevFlow = String(state.lastHashFlow || '').trim().toLowerCase();
    state.lastHashFlow = nextFlow || '';
    if (nextFlow && nextFlow !== prevFlow) {
      try {
        if (typeof window.__setInlineWalletRoutePending === 'function') {
          window.__setInlineWalletRoutePending(true);
        }
      } catch (_) {}
      try {
        if (typeof window.__depositInlinePrepareFlowSwitch === 'function') {
          window.__depositInlinePrepareFlowSwitch(nextFlow);
        }
      } catch (_) {}
    }
    if (!nextFlow) {
      deactivateStyles();
    }
  });

  window.depositRoute = {
    build: function () {
      if (state.container) return state.container;
      const container = document.createElement('div');
      container.id = 'depositInlineContainer';
      state.container = container;
      return container;
    },
    onShow: function (ctx) {
      ctx = (ctx && typeof ctx === 'object') ? ctx : {};
      if (!state.container) {
        releaseWalletBootLoaderIfAny();
        return Promise.resolve();
      }
      const currentFlow = normalizeInlineFlow(getInlineFlowFromHash());
      const previousFlow = normalizeInlineFlow(state.lastRouteFlow || currentFlow);
      const activeInlineFlow = normalizeInlineFlow(window.__depositInlineActiveFlow || state.lastRouteFlow || currentFlow);
      const flowChanged = (!!state.lastRouteFlow && previousFlow !== currentFlow) || (state.app && activeInlineFlow !== currentFlow);
      const enteredFromOutside = !!ctx.__enteredWalletRoute;
      let flowSwitchUiPrepared = false;
      state.lastRouteFlow = currentFlow;

      if (flowChanged && state.app) {
        try {
          if (typeof window.__depositInlinePrepareFlowSwitch === 'function') {
            window.__depositInlinePrepareFlowSwitch(currentFlow);
          }
        } catch (_) {}
        try { window.__depositInlineActiveFlow = currentFlow; } catch (_) {}
        applyInlineFlowCopy(state.app, currentFlow);
        setFlowSwitchLoadingUi(state.app, currentFlow);
        flowSwitchUiPrepared = true;
      }

      const runRefresh = function (reason) {
        return Promise.resolve().then(async function () {
          state.lastCountriesRefreshAt = Date.now();
          const mustAwaitNetwork =
            flowChanged ||
            reason === 'on_show_flow_changed' ||
            reason === 'on_show_initial' ||
            reason === 'on_show_missing_data' ||
            reason === 'on_show_route_entry';
          if (mustAwaitNetwork) {
            try { setDepositInlineCountriesLoading(true); } catch (_) {}
            try {
              try { setInlinePreloaderVisible(state.app, true); } catch (_) {}
              if (typeof window.__depositInlineRefreshCountries === 'function') {
                await window.__depositInlineRefreshCountries({
                  forceRefresh: true,
                  reason: reason || 'on_show_flow_changed',
                  flow: currentFlow
                });
                return;
              }
              await retryCountriesViaRecovery(state.app, reason || 'on_show_flow_changed');
              return;
            } finally {
              try { setDepositInlineCountriesLoading(false); } catch (_) {}
              try { setInlinePreloaderVisible(state.app, false); } catch (_) {}
            }
          }
          releaseWalletBootLoaderIfAny();
        }).catch(function (err) {
          try { depositInlineLog('warn', '[deposit-inline] onShow refresh failed', err); } catch (_) {}
        }).finally(function () {
          restoreFlowSwitchUiHints(state.app);
          if (
            reason === 'on_show_initial' ||
            reason === 'on_show_route_entry' ||
            reason === 'on_show_flow_changed'
          ) {
            closeDepositInlineMethodModalForRouteEntry();
          }
          state.refreshPromise = null;
          releaseWalletBootLoaderIfAny();
        });
      };

      return mount(state.container).then(function () {
        applyInlineFlowCopy(state.app, currentFlow);
        if (!state.shownOnce || enteredFromOutside || flowChanged) {
          closeDepositInlineMethodModalForRouteEntry();
        }
        if (flowChanged && !flowSwitchUiPrepared) {
          setFlowSwitchLoadingUi(state.app, currentFlow);
        }
        if (state.refreshPromise) return state.refreshPromise;
        const shouldRefreshInitially = !state.shownOnce;
        const shouldRefreshOnRouteEntry =
          !shouldRefreshInitially &&
          !flowChanged &&
          enteredFromOutside;
        const shouldRefreshMissingData =
          !shouldRefreshInitially &&
          !flowChanged &&
          shouldRefreshInlineCountriesOnShow(currentFlow, state.app);
        if (shouldRefreshInitially) {
          try { depositInlineLog('info', '[deposit-inline] initial show; force countries refresh'); } catch (_) {}
          state.refreshPromise = runRefresh('on_show_initial');
          return state.refreshPromise;
        }
        if (shouldRefreshOnRouteEntry) {
          try { depositInlineLog('info', '[deposit-inline] route entry; force countries refresh'); } catch (_) {}
          state.refreshPromise = runRefresh('on_show_route_entry');
          return state.refreshPromise;
        }
        if (shouldRefreshMissingData) {
          try { depositInlineLog('info', '[deposit-inline] missing root entries on show; force countries refresh'); } catch (_) {}
          state.refreshPromise = runRefresh('on_show_missing_data');
          return state.refreshPromise;
        }
        if (!flowChanged) {
          try {
            if (typeof window.__depositInlineApplyRoute === 'function') {
              window.__depositInlineApplyRoute(true);
            }
          } catch (_) {}
          if (enteredFromOutside) closeDepositInlineMethodModalForRouteEntry();
          try { restoreFlowSwitchUiHints(state.app); } catch (_) {}
          releaseWalletBootLoaderIfAny();
          return;
        }
        state.refreshPromise = runRefresh(flowChanged ? 'on_show_flow_changed' : 'on_show_refresh');
        return state.refreshPromise;
      }).finally(function () {
        if (!state.shownOnce) state.shownOnce = true;
        if (!state.refreshPromise) releaseWalletBootLoaderIfAny();
      });
    },
    ready: function () {
      return true;
    },
  };
})();
