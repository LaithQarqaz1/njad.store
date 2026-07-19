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
        emptyText: 'لا توجد طلبات إيداع حتى الآن.',
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

  function ensureWalletModernStyles(){
    if (document.getElementById('wallet-modern-redesign-style')) return;
    var style = document.createElement('style');
    style.id = 'wallet-modern-redesign-style';
    style.textContent = `
.wallet-page{
  --wallet-bg:var(--bg-app, var(--site-accent-runtime-surface, #f1f1f4));
  --wallet-surface:#ffffff;
  --wallet-soft:#e9ebf3;
  --wallet-line:#cfd3e4;
  --wallet-dashed:#d8dbea;
  --wallet-text:#18233f;
  --wallet-muted:#777d8e;
  --wallet-primary:#18233f;
  --wallet-green:#53b69c;
  --wallet-red:#d60945;
  --wallet-gold:#e8b90f;
  --wallet-card-bg:rgba(255,255,255,.98);
  --wallet-card-border:rgba(var(--site-accent-rgb, 148, 163, 184), .22);
  --wallet-card-shadow:0 14px 32px rgba(var(--site-accent-rgb, 148, 163, 184), .10);
  direction:rtl;
}
.wallet-filter-modal,
.wallet-history-modal,
.wallet-search-modal{
  --wallet-bg:var(--bg-app, var(--site-accent-runtime-surface, #f1f1f4));
  --wallet-surface:#ffffff;
  --wallet-soft:#e9ebf3;
  --wallet-line:#cfd3e4;
  --wallet-dashed:#d8dbea;
  --wallet-text:#18233f;
  --wallet-muted:#777d8e;
  --wallet-primary:#18233f;
  --wallet-green:#53b69c;
  --wallet-red:#d60945;
  --wallet-gold:#e8b90f;
  direction:rtl;
}
html[data-theme="dark"] .wallet-page,
body.dark-mode .wallet-page,
html[data-theme="dark"] .wallet-filter-modal,
html[data-theme="dark"] .wallet-history-modal,
html[data-theme="dark"] .wallet-search-modal,
body.dark-mode .wallet-filter-modal,
body.dark-mode .wallet-history-modal,
body.dark-mode .wallet-search-modal{
  --wallet-bg:#07090f;
  --wallet-surface:#0d111b;
  --wallet-soft:#171b27;
  --wallet-line:#2a3045;
  --wallet-dashed:#33394f;
  --wallet-text:#f5f7ff;
  --wallet-muted:#a3a7b6;
  --wallet-primary:#dfe6ff;
  --wallet-card-bg:rgba(13,22,44,.96);
  --wallet-card-border:rgba(var(--site-accent-rgb, 125, 140, 175), .24);
  --wallet-card-shadow:0 16px 34px rgba(0,0,0,.24);
}
.wallet-page .wallet-modern-shell{
  width:min(100%, 980px);
  min-height:auto;
  margin:0 auto;
  padding:22px clamp(10px, 3vw, 28px) 72px;
  background:transparent !important;
  border:0 !important;
  border-radius:0 !important;
  box-shadow:none !important;
  background-image:none !important;
  outline:0 !important;
}
.wallet-modern-logo{
  display:none !important;
  place-items:center;
  color:var(--wallet-gold);
  font-size:18px;
  margin:0 0 18px;
}
.wallet-modern-topbar{
  display:grid;
  grid-template-columns:minmax(110px,1fr) auto minmax(110px,1fr);
  align-items:center;
  gap:12px;
  margin-bottom:30px;
  direction:ltr;
}
.wallet-modern-topbar h2{
  margin:0 !important;
  color:var(--wallet-text) !important;
  font-size:clamp(23px, 4.1vw, 30px);
  line-height:1.2;
  font-weight:900;
  text-align:center;
  white-space:nowrap;
}
.wallet-modern-tools{
  grid-column:1;
  display:flex;
  align-items:center;
  justify-content:flex-start;
  gap:14px;
  direction:ltr;
}
.wallet-modern-icon,
.wallet-modern-back{
  width:38px;
  height:38px;
  display:inline-grid;
  place-items:center;
  border:0;
  border-radius:50%;
  background:transparent;
  color:var(--wallet-primary);
  font-size:24px;
  cursor:pointer;
}
.wallet-modern-topbar h2{ grid-column:2; }
.wallet-modern-back{ grid-column:3; justify-self:end; }
.wallet-page .txn-body,
.wallet-search-modal .txn-body,
#walletList .txn-body,
#paymentsList .txn-body{
  background:transparent !important;
  background-image:none !important;
  box-shadow:none !important;
}
.wallet-history-more{
  display:flex;
  justify-content:center;
  margin:18px 0 6px;
}
.wallet-history-more-btn{
  appearance:none;
  min-width:150px;
  min-height:44px;
  border-radius:999px;
  border:1px solid rgba(var(--site-accent-rgb,148,163,184),.34);
  background:var(--bg-app,#fff);
  color:var(--text,#111827);
  font-weight:900;
  cursor:pointer;
  box-shadow:0 10px 24px rgba(15,23,42,.08);
}
html[data-theme="dark"] .wallet-history-more-btn,
body.dark-mode .wallet-history-more-btn{
  background:rgba(15,23,42,.92);
  color:#f8fafc;
  box-shadow:none;
}
.wallet-search-box input,
.wallet-filter-field input,
.wallet-filter-field select{
  width:100%;
  min-height:58px;
  border:1px solid transparent;
  border-radius:14px;
  background:var(--wallet-soft);
  color:var(--wallet-text);
  padding:0 18px;
  font:inherit;
  outline:none;
}
.wallet-modern-hidden-toolbar{
  position:absolute !important;
  width:1px !important;
  height:1px !important;
  overflow:hidden !important;
  clip:rect(0 0 0 0) !important;
  white-space:nowrap !important;
}
.wallet-modern-list{
  display:block !important;
  min-height:auto !important;
  padding:0 !important;
  margin:0 !important;
  border:0 !important;
  border-radius:0 !important;
  background:transparent !important;
  background-image:none !important;
  box-shadow:none !important;
  outline:0 !important;
}
.wallet-page .wallet-modern-shell,
.wallet-page .wallet-modern-list,
.wallet-page .wallet-empty-state,
.wallet-page .wallet-modern-list > .empty{
  background:transparent !important;
  background-image:none !important;
  border:0 !important;
  border-radius:0 !important;
  box-shadow:none !important;
  outline:0 !important;
}
.wallet-date-group{
  margin:28px 0 14px;
  color:var(--wallet-muted);
  font-size:clamp(18px, 3.4vw, 24px);
  font-weight:800;
  text-align:right;
}
.wallet-page .wallet-modern-list .card{
  overflow:hidden;
  border:1px solid var(--wallet-card-border) !important;
  border-radius:18px !important;
  box-shadow:var(--wallet-card-shadow) !important;
  background:var(--wallet-card-bg) !important;
  padding:0 !important;
  margin:0 !important;
  max-width:100%;
  box-sizing:border-box;
  backdrop-filter:blur(8px);
  transition:transform .18s ease, box-shadow .18s ease, border-color .18s ease;
}
@media (hover:hover) and (pointer:fine){
  .wallet-page .wallet-modern-list .card:hover{
    transform:translateY(-2px);
    border-color:rgba(var(--site-accent-rgb, 148, 163, 184), .36) !important;
    box-shadow:0 18px 36px rgba(var(--site-accent-rgb, 148, 163, 184), .16) !important;
  }
}
.wallet-page .wallet-modern-list .card + .card{
  margin-top:12px !important;
}
.wallet-search-modal .wallet-modern-list .card{
  overflow:hidden;
  border:1px solid var(--wallet-card-border) !important;
  border-radius:18px !important;
  box-shadow:var(--wallet-card-shadow) !important;
  background:var(--wallet-card-bg) !important;
  padding:0 !important;
  margin:0 0 28px !important;
  max-width:100%;
  box-sizing:border-box;
}
.wallet-page .txn-body{
  display:grid;
  grid-template-columns:minmax(96px, 144px) minmax(0, 1fr) 44px;
  align-items:center;
  gap:14px;
  direction:ltr;
  padding:16px 18px;
  max-width:100%;
  box-sizing:border-box;
}
.wallet-search-modal .txn-body{
  display:grid;
  grid-template-columns:minmax(96px, 144px) minmax(0, 1fr) 44px;
  align-items:center;
  gap:14px;
  direction:ltr;
  padding:16px 18px;
  max-width:100%;
  box-sizing:border-box;
}
.wallet-page .txn-amount{
  text-align:left;
  direction:ltr;
  font-weight:900;
  min-width:0;
  display:grid;
  align-content:center;
  gap:7px;
  overflow:hidden;
}
.wallet-search-modal .txn-amount{
  text-align:left;
  direction:ltr;
  font-weight:900;
  min-width:0;
  display:grid;
  align-content:center;
  gap:7px;
  overflow:hidden;
}
.wallet-page .txn-value{
  display:inline-flex;
  align-items:baseline;
  gap:5px;
  direction:ltr;
  white-space:nowrap;
  max-width:100%;
}
.wallet-search-modal .txn-value{
  display:inline-flex;
  align-items:baseline;
  gap:5px;
  direction:ltr;
  white-space:nowrap;
  max-width:100%;
}
.wallet-page .txn-value .txn-value-text,
.wallet-search-modal .txn-value .txn-value-text{
  direction:ltr;
  unicode-bidi:isolate;
  white-space:nowrap;
}
.wallet-page .txn-amount.deposit,
.wallet-page .txn-amount.approved,
.wallet-page .txn-amount.positive,
.wallet-search-modal .txn-amount.deposit,
.wallet-search-modal .txn-amount.approved,
.wallet-search-modal .txn-amount.positive{
  color:var(--wallet-green) !important;
}
.wallet-page .txn-amount.withdraw,
.wallet-page .txn-amount.rejected,
.wallet-page .txn-amount.negative,
.wallet-search-modal .txn-amount.withdraw,
.wallet-search-modal .txn-amount.rejected,
.wallet-search-modal .txn-amount.negative{
  color:var(--wallet-red) !important;
}
.wallet-page .txn-amount.positive .sign{ color:var(--wallet-green) !important; }
.wallet-page .txn-amount.negative .sign{ color:var(--wallet-red) !important; }
.wallet-page .txn-value .number,
.wallet-page .txn-value .currency,
.wallet-page .txn-value .sign,
.wallet-page .txn-value .txn-value-text,
.wallet-search-modal .txn-value .number,
.wallet-search-modal .txn-value .currency,
.wallet-search-modal .txn-value .sign,
.wallet-search-modal .txn-value .txn-value-text{
  font-size:clamp(16px, 2.7vw, 23px);
  line-height:1.05;
  font-weight:900;
}
.wallet-page .txn-middle{
  text-align:right;
  direction:rtl;
  min-width:0;
}
.wallet-search-modal .txn-middle{
  text-align:right;
  direction:rtl;
  min-width:0;
}
.wallet-page .txn-head{
  display:block;
}
.wallet-page .txn-title,
.wallet-search-modal .txn-title{
  color:var(--wallet-text) !important;
  font-size:clamp(15.5px, 2.4vw, 21px);
  line-height:1.25;
  font-weight:900;
  overflow-wrap:anywhere;
}
.wallet-page .txn-meta{
  margin-top:4px;
  color:var(--wallet-muted) !important;
  font-size:clamp(13px, 2.2vw, 18px);
  line-height:1.2;
  justify-content:flex-end;
}
.wallet-search-modal .txn-meta{
  margin-top:4px;
  color:var(--wallet-muted) !important;
  font-size:clamp(13px, 2.2vw, 18px);
  line-height:1.2;
  justify-content:flex-end;
}
.wallet-page .txn-meta span,
.wallet-page .txn-date,
.wallet-search-modal .txn-meta span,
.wallet-search-modal .txn-date{
  color:var(--wallet-muted) !important;
}
.wallet-page .txn-balances,
.wallet-search-modal .txn-balances{
  display:grid !important;
  gap:4px;
  min-width:0;
  max-width:100%;
  font-size:clamp(10.5px, 1.8vw, 13px);
  line-height:1.2;
  font-weight:800;
}
.wallet-page .status,
.wallet-search-modal .status{
  display:none !important;
}
.wallet-page .txn-balance-row,
.wallet-search-modal .txn-balance-row{
  display:grid;
  grid-template-columns:auto minmax(0,1fr);
  align-items:center;
  gap:5px;
  min-width:0;
  color:var(--wallet-muted) !important;
}
.wallet-page .txn-balance-label,
.wallet-search-modal .txn-balance-label{
  color:var(--wallet-muted) !important;
  font-weight:900;
}
.wallet-page .txn-balance-value,
.wallet-search-modal .txn-balance-value{
  direction:ltr;
  unicode-bidi:plaintext;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
}
.wallet-page .balance-after .txn-balance-value,
.wallet-search-modal .balance-after .txn-balance-value{
  color:var(--wallet-primary) !important;
}
.wallet-page .balance-after.is-rejected .txn-balance-value,
.wallet-search-modal .balance-after.is-rejected .txn-balance-value{
  color:var(--wallet-red) !important;
}
.wallet-page .balance-before .txn-balance-value,
.wallet-search-modal .balance-before .txn-balance-value{
  color:var(--wallet-muted) !important;
  text-decoration:none !important;
}
.wallet-page .txn-action{
  width:44px;
  min-width:44px;
  height:44px;
  min-height:44px;
  border-radius:50%;
  border:0;
  padding:0;
  background:#e5e6ec;
  color:var(--wallet-primary);
  display:grid;
  place-items:center;
  justify-self:end;
  align-self:center;
  cursor:pointer;
  line-height:1;
}
.wallet-page .txn-action.neutral,
.wallet-page .txn-action.approved,
.wallet-page .txn-action.rejected,
.wallet-page .txn-action.pending,
.wallet-search-modal .txn-action.neutral,
.wallet-search-modal .txn-action.approved,
.wallet-search-modal .txn-action.rejected,
.wallet-search-modal .txn-action.pending{
  background:#e5e6ec !important;
  color:var(--wallet-primary) !important;
}
.wallet-search-modal .txn-action{
  width:44px;
  min-width:44px;
  height:44px;
  min-height:44px;
  border-radius:50%;
  border:0;
  padding:0;
  background:#e5e6ec;
  color:var(--wallet-primary);
  display:grid;
  place-items:center;
  justify-self:end;
  align-self:center;
  cursor:pointer;
  line-height:1;
}
html[data-theme="dark"] .wallet-page .txn-action,
body.dark-mode .wallet-page .txn-action,
html[data-theme="dark"] .wallet-search-modal .txn-action,
body.dark-mode .wallet-search-modal .txn-action{
  background:#202536;
}
html[data-theme="dark"] .wallet-page .txn-action.neutral,
html[data-theme="dark"] .wallet-page .txn-action.approved,
html[data-theme="dark"] .wallet-page .txn-action.rejected,
html[data-theme="dark"] .wallet-page .txn-action.pending,
body.dark-mode .wallet-page .txn-action.neutral,
body.dark-mode .wallet-page .txn-action.approved,
body.dark-mode .wallet-page .txn-action.rejected,
body.dark-mode .wallet-page .txn-action.pending,
html[data-theme="dark"] .wallet-search-modal .txn-action.neutral,
html[data-theme="dark"] .wallet-search-modal .txn-action.approved,
html[data-theme="dark"] .wallet-search-modal .txn-action.rejected,
html[data-theme="dark"] .wallet-search-modal .txn-action.pending,
body.dark-mode .wallet-search-modal .txn-action.neutral,
body.dark-mode .wallet-search-modal .txn-action.approved,
body.dark-mode .wallet-search-modal .txn-action.rejected,
body.dark-mode .wallet-search-modal .txn-action.pending{
  background:#202536 !important;
  color:var(--wallet-primary) !important;
}
.wallet-page .txn-action-symbol,
.wallet-page .txn-action-glyph,
.wallet-search-modal .txn-action-symbol,
.wallet-search-modal .txn-action-glyph{
  font-size:18px;
  line-height:1;
  font-weight:900;
}
.wallet-filter-actions .primary,
.wallet-receipt-primary,
.wallet-summary-share{
  width:100%;
  min-height:56px;
  border:0;
  border-radius:14px;
  background:var(--wallet-primary);
  color:var(--wallet-bg);
  font-size:clamp(17px, 2.7vw, 24px);
  font-weight:900;
  cursor:pointer;
}
.wallet-filter-modal,
.wallet-history-modal,
.wallet-search-modal{
  position:fixed;
  inset:0;
  z-index:10020;
  display:none;
  align-items:center;
  justify-content:center;
  background:rgba(10,14,28,.42);
  color:var(--wallet-text);
  overflow:auto;
  pointer-events:auto;
  width:100%;
  padding:18px;
}
.wallet-filter-modal.show,
.wallet-history-modal.show,
.wallet-search-modal.show{
  display:flex;
}
.wallet-filter-panel,
.wallet-history-modal-card,
.wallet-search-panel{
  width:min(100%, 720px);
  min-height:min(100dvh, 720px);
  padding:22px clamp(12px, 3.2vw, 28px) 72px;
  background:var(--wallet-bg) !important;
  color:var(--wallet-text) !important;
  border:0 !important;
  border-radius:0 !important;
  box-shadow:none !important;
  pointer-events:auto;
}
.wallet-modern-shell > .wallet-filter-modal,
.wallet-modern-shell > .wallet-history-modal,
.wallet-modern-shell > .wallet-search-modal{
  position:static;
  inset:auto;
  z-index:auto;
  display:none;
  align-items:initial;
  justify-content:initial;
  background:transparent;
  overflow:visible;
  width:100%;
  padding:0;
}
.wallet-modern-shell > .wallet-filter-modal.show,
.wallet-modern-shell > .wallet-history-modal.show,
.wallet-modern-shell > .wallet-search-modal.show{
  display:block;
}
.wallet-modern-shell > .wallet-filter-modal .wallet-filter-panel,
.wallet-modern-shell > .wallet-history-modal .wallet-history-modal-card,
.wallet-modern-shell > .wallet-search-modal .wallet-search-panel{
  width:100%;
  min-height:auto;
  padding:0 0 72px;
  background:transparent !important;
}
.wallet-page.wallet-subpage-active .wallet-modern-topbar,
.wallet-page.wallet-subpage-active #walletToolbar,
.wallet-page.wallet-subpage-active #walletList,
.wallet-page.wallet-subpage-active #paymentsToolbar,
.wallet-page.wallet-subpage-active #paymentsList{
  display:none !important;
}
body .wallet-page main.wallet-modern-shell,
html body .wallet-page .wallet-modern-shell{
  background:transparent !important;
  background-image:none !important;
  border:0 !important;
  box-shadow:none !important;
  outline:0 !important;
}
.wallet-filter-head,
.wallet-receipt-head,
.wallet-search-head{
  display:grid;
  grid-template-columns:1fr auto 1fr;
  align-items:center;
  gap:12px;
  margin-bottom:34px;
  direction:rtl;
}
.wallet-filter-head h3,
.wallet-history-modal-title,
.wallet-search-head h3{
  margin:0 !important;
  color:var(--wallet-text) !important;
  text-align:center;
  font-size:clamp(26px, 4.6vw, 34px);
  font-weight:900;
  white-space:nowrap;
}
.wallet-filter-back,
.wallet-history-modal-close,
.wallet-search-back{
  width:40px;
  height:40px;
  border:0;
  border-radius:50%;
  background:transparent;
  color:var(--wallet-primary);
  font-size:24px;
  cursor:pointer;
  justify-self:start;
}
.wallet-filter-logo,
.wallet-receipt-logo,
.wallet-search-logo{
  display:none !important;
}
.wallet-search-box{
  position:relative;
  margin:20px 0 26px;
}
.wallet-search-box i{
  position:absolute;
  right:22px;
  top:50%;
  transform:translateY(-50%);
  color:var(--wallet-primary);
  font-size:28px;
  pointer-events:none;
}
.wallet-search-box input{
  padding-inline:68px 18px;
  border-radius:12px;
  font-size:24px;
}
.wallet-search-group-label{
  margin:10px 0 22px;
  color:var(--wallet-muted);
  text-align:right;
  font-size:24px;
  font-weight:800;
}
.wallet-filter-account{
  display:none !important;
}
.wallet-filter-account strong{
  display:block;
  font-size:30px;
  color:var(--wallet-text);
}
.wallet-filter-account span{
  display:block;
  margin-top:8px;
  color:var(--wallet-muted);
  font-size:24px;
}
.wallet-filter-quick{
  display:flex;
  gap:8px;
  overflow:auto;
  padding-bottom:5px;
  margin:10px 0 18px;
  scrollbar-width:none;
}
.wallet-filter-quick::-webkit-scrollbar{ display:none; }
.wallet-filter-quick button{
  flex:0 0 auto;
  min-width:64px;
  min-height:36px;
  border:1px solid var(--wallet-line);
  border-radius:11px;
  background:var(--wallet-surface);
  color:var(--wallet-muted);
  font-size:13px;
  font-weight:800;
}
.wallet-filter-quick button.active{
  background:var(--wallet-primary);
  color:var(--wallet-bg);
}
.wallet-operation-strip{
  display:flex;
  gap:8px;
  overflow:auto;
  padding:2px 0 5px;
  scrollbar-width:none;
}
.wallet-operation-strip::-webkit-scrollbar{ display:none; }
.wallet-operation-strip button{
  flex:0 0 auto;
  min-height:34px;
  padding:0 11px;
  border:1px solid var(--wallet-line);
  border-radius:10px;
  background:var(--wallet-surface);
  color:var(--wallet-muted);
  font-size:12px;
  font-weight:900;
  cursor:pointer;
}
.wallet-operation-strip button.active{
  background:var(--wallet-primary);
  color:var(--wallet-bg);
}
.wallet-filter-calendar{
  border:1px solid var(--wallet-line);
  border-radius:18px;
  padding:16px;
  background:var(--wallet-surface);
  width:min(100%, 560px);
  max-height:calc(100dvh - 190px);
  overflow:auto;
}
.wallet-filter-calendar-popover{
  position:fixed;
  inset:64px 0 72px 0;
  z-index:1;
  display:none;
  align-items:center;
  justify-content:center;
  padding:18px;
  background:rgba(10,14,28,.24);
  pointer-events:auto;
}
.wallet-filter-calendar-popover.show{
  display:flex;
}
.wallet-filter-calendar-head{
  display:grid;
  grid-template-columns:44px 1fr 44px;
  align-items:center;
  gap:10px;
  margin-bottom:12px;
  direction:ltr;
}
.wallet-filter-calendar-head button{
  width:44px;
  height:44px;
  border:0;
  border-radius:50%;
  background:var(--wallet-soft);
  color:var(--wallet-primary);
  font-size:24px;
  cursor:pointer;
}
.wallet-filter-calendar-title{
  color:var(--wallet-text);
  font-size:22px;
  font-weight:900;
  text-align:center;
}
.wallet-filter-calendar-selected{
  margin:4px 0 12px;
  color:var(--wallet-muted);
  font-size:18px;
  font-weight:800;
  text-align:center;
}
.wallet-filter-calendar-grid{
  display:grid;
  grid-template-columns:repeat(7, minmax(0,1fr));
  gap:6px;
}
.wallet-filter-calendar-grid .calendar-weekday{
  color:var(--wallet-muted);
  font-size:12px;
  font-weight:900;
  text-align:center;
}
.wallet-filter-calendar-grid .calendar-spacer{
  min-height:38px;
}
.wallet-filter-calendar-grid .calendar-day{
  min-height:38px;
  border:0;
  border-radius:12px;
  background:transparent;
  color:var(--wallet-text);
  font-weight:900;
  cursor:pointer;
}
.wallet-filter-calendar-grid .calendar-day.has .num{
  text-decoration:underline;
  text-decoration-color:var(--wallet-gold);
  text-decoration-thickness:2px;
  text-underline-offset:4px;
}
.wallet-filter-calendar-grid .calendar-day.active,
.wallet-filter-calendar-grid .calendar-day.range-start,
.wallet-filter-calendar-grid .calendar-day.range-end{
  background:var(--wallet-primary);
  color:var(--wallet-bg);
}
.wallet-filter-calendar-grid .calendar-day.in-range{
  background:var(--wallet-soft);
}
.wallet-filter-calendar-grid .calendar-day.disabled{
  opacity:.35;
  cursor:not-allowed;
}
.wallet-filter-field{
  display:block;
  margin:16px 0;
  text-align:right;
}
.wallet-filter-field span{
  display:block;
  margin-bottom:8px;
  color:var(--wallet-text);
  font-size:18px;
  font-weight:800;
}
.wallet-filter-actions{
  display:grid;
  gap:10px;
  margin-top:32px;
}
.wallet-filter-actions .secondary,
.wallet-summary-close{
  width:100%;
  min-height:52px;
  border:1px solid var(--wallet-muted);
  border-radius:14px;
  background:transparent;
  color:var(--wallet-muted);
  font-size:clamp(17px, 2.7vw, 24px);
  font-weight:900;
  cursor:pointer;
}
.wallet-receipt-primary,
.wallet-summary-share{
  min-height:68px;
  border-radius:18px;
  font-size:clamp(22px, 4vw, 34px);
}
.wallet-summary-close{
  min-height:64px;
  border-radius:18px;
  font-size:clamp(22px, 4vw, 32px);
}
.wallet-history-modal-head{
  display:contents;
}
.wallet-history-modal-kicker,
.wallet-history-modal-subtitle,
.wallet-history-modal-badges,
.wallet-history-modal-loading{
  display:none !important;
}
.wallet-receipt-amount{
  margin:38px 0 34px;
  color:var(--wallet-red);
  direction:ltr;
  text-align:center;
  font-size:clamp(48px, 10vw, 78px);
  line-height:1;
  font-weight:900;
}
.wallet-receipt-rows{
  display:grid;
  gap:0;
}
.wallet-receipt-row{
  display:grid;
  grid-template-columns:minmax(0, 1fr) 150px;
  gap:18px;
  align-items:start;
  padding:12px 0;
  border-bottom:1px dashed transparent;
}
.wallet-receipt-row.is-divider{
  border-bottom-color:var(--wallet-dashed);
  padding-bottom:20px;
  margin-bottom:10px;
}
.wallet-receipt-row span{
  color:var(--wallet-muted) !important;
  font-size:clamp(21px, 4vw, 31px);
  text-align:right;
}
.wallet-receipt-row strong{
  color:var(--wallet-text) !important;
  font-size:clamp(19px, 3.4vw, 29px);
  font-weight:900;
  text-align:left;
  direction:ltr;
  overflow-wrap:anywhere;
}
.wallet-receipt-total{
  display:grid;
  grid-template-columns:minmax(0, 1fr) auto;
  align-items:center;
  gap:18px;
  min-height:72px;
  margin:24px 0 34px;
  padding:0 24px;
  border:1px solid var(--wallet-line);
  border-radius:18px;
}
.wallet-receipt-total span{
  color:var(--wallet-muted);
  font-size:clamp(22px, 4vw, 32px);
  text-align:right;
}
.wallet-receipt-total strong{
  color:var(--wallet-text);
  font-size:clamp(22px, 4vw, 32px);
  direction:ltr;
}
.wallet-transfer-success{
  width:max-content;
  margin:28px auto 36px;
  display:inline-flex;
  align-items:center;
  gap:10px;
  padding:8px 10px 8px 18px;
  border-radius:18px;
  background:var(--wallet-soft);
  color:var(--wallet-text);
  font-size:clamp(24px, 4vw, 34px);
  font-weight:800;
}
.wallet-transfer-success-img{
  display:block;
  width:min(190px,42vw);
  height:auto;
  margin:0 auto 26px;
  object-fit:contain;
}
.payment-inline-details{
  display:none;
  margin:0 !important;
  padding:14px 18px 16px;
  border-top:1px solid var(--wallet-card-border);
  background:rgba(248,250,252,.74);
  color:var(--wallet-text);
  text-align:right;
  direction:rtl;
}
.wallet-page .card.open .payment-inline-details{
  display:block;
}
.wallet-inline-details{
  margin:0 !important;
  padding:14px 18px 16px;
  border-top:1px solid var(--wallet-card-border);
  background:rgba(248,250,252,.74);
}
html[data-theme="dark"] .payment-inline-details,
body.dark-mode .payment-inline-details,
html[data-theme="dark"] .wallet-inline-details,
body.dark-mode .wallet-inline-details{
  background:rgba(7,13,28,.58);
}
.payment-inline-details p{
  margin:7px 0;
  color:var(--wallet-text) !important;
  font-size:clamp(14px,2.2vw,17px);
  line-height:1.55;
}
.payment-inline-details strong{
  color:var(--wallet-muted) !important;
  font-weight:800;
}
.payment-inline-details a{
  color:var(--wallet-primary) !important;
  font-weight:900;
}
.wallet-transfer-success i{
  width:42px;
  height:42px;
  display:grid;
  place-items:center;
  border-radius:14px;
  background:var(--wallet-green);
  color:#fff;
  font-size:24px;
}
.wallet-transfer-summary .wallet-receipt-row{
  min-height:62px;
}
.wallet-transfer-summary .wallet-receipt-total{
  margin-top:28px;
}
.wallet-history-modal-summary,
.wallet-history-modal-sections{
  display:block;
}
.wallet-summary-actions{
  display:grid;
  gap:14px;
}
.wallet-empty-state{
  min-height:220px;
  margin:40px auto;
  display:grid !important;
  place-items:center;
  align-content:center;
  gap:14px;
  border:0 !important;
  border-radius:0 !important;
  background:transparent !important;
  box-shadow:none !important;
  color:var(--wallet-text, var(--text, #1d2742)) !important;
  text-align:center;
  direction:rtl;
}
.catalog-games-empty{
  min-height:220px;
  margin:40px auto;
  display:none !important;
  place-items:center;
  align-content:center;
  gap:14px;
  border:0 !important;
  border-radius:0 !important;
  background:transparent !important;
  box-shadow:none !important;
  color:var(--wallet-text, var(--text, #1d2742)) !important;
  text-align:center;
  direction:rtl;
}
.catalog-games-empty.is-visible{
  display:grid !important;
}
.wallet-empty-state[hidden],
.wallet-empty-state[aria-hidden="true"],
.catalog-games-empty[hidden],
.catalog-games-empty[aria-hidden="true"],
body .categories:has(.card) > .catalog-games-empty,
body .categories:has([data-card-type]) > .catalog-games-empty{
  display:none !important;
}
.categories > .catalog-games-empty.is-visible,
body .categories > .catalog-games-empty.is-visible{
  display:grid !important;
}
.txn-status-side{
  display:block;
  margin-top:7px;
  color:var(--wallet-muted);
  font-size:clamp(12px, 2vw, 15px);
  line-height:1.2;
  font-weight:900;
  text-align:left;
  direction:rtl;
}
.txn-status-side.approved{ color:var(--wallet-green) !important; }
.txn-status-side.rejected{ color:var(--wallet-red) !important; }
.txn-status-side.pending{ color:var(--wallet-gold) !important; }
#paymentsList .txn-amount{
  display:flex !important;
  flex-direction:column !important;
  align-items:flex-start !important;
  justify-content:center !important;
  gap:4px !important;
}
#paymentsList .txn-status-side{
  order:1;
  margin-top:0 !important;
  text-align:left !important;
}
#paymentsList .txn-value{
  order:2;
}
#paymentsList .txn-balances{
  order:3;
}
.wallet-page .card.open .txn-action-symbol i,
.wallet-search-modal .card.open .txn-action-symbol i{
  transform:rotate(180deg);
}
.wallet-page .txn-action-symbol i,
.wallet-search-modal .txn-action-symbol i{
  transition:transform .18s ease;
}
.wallet-page .wallet-modern-list .card,
.wallet-search-modal .wallet-modern-list .card{
  overflow:visible !important;
  border:0 !important;
  border-radius:0 !important;
  box-shadow:none !important;
  background:transparent !important;
  background-image:none !important;
  backdrop-filter:none !important;
  padding:0 !important;
  margin:0 0 24px !important;
  color:var(--wallet-text) !important;
  transition:none !important;
}
.wallet-page .wallet-modern-list .card + .card,
.wallet-search-modal .wallet-modern-list .card + .card{
  margin-top:0 !important;
}
@media (hover:hover) and (pointer:fine){
  .wallet-page .wallet-modern-list .card:hover,
  .wallet-search-modal .wallet-modern-list .card:hover{
    transform:none !important;
    border-color:transparent !important;
    box-shadow:none !important;
  }
}
.wallet-page .txn-body,
.wallet-search-modal .txn-body{
  grid-template-columns:minmax(96px,132px) minmax(0,1fr) 44px !important;
  align-items:center !important;
  gap:12px !important;
  cursor:pointer;
  padding:0 !important;
  background:transparent !important;
  border:0 !important;
}
.wallet-page .txn-title,
.wallet-search-modal .txn-title{
  font-size:clamp(17.5px,3vw,23px) !important;
  line-height:1.3 !important;
  font-weight:900 !important;
}
.wallet-page .txn-subtitle,
.wallet-search-modal .txn-subtitle{
  margin-top:3px !important;
  color:var(--wallet-muted) !important;
  font-size:clamp(14px,2.25vw,17px) !important;
  line-height:1.45 !important;
  font-weight:850 !important;
  text-align:right !important;
  overflow-wrap:anywhere;
}
.wallet-page .txn-meta,
.wallet-search-modal .txn-meta{
  margin-top:2px !important;
  font-size:clamp(15px,2.45vw,18px) !important;
  line-height:1.45 !important;
  font-weight:850 !important;
  white-space:normal !important;
  overflow:visible !important;
  text-overflow:clip !important;
}
.wallet-page .code-btn,
.wallet-search-modal .code-btn{
  appearance:none !important;
  border:0 !important;
  border-radius:0 !important;
  background:transparent !important;
  box-shadow:none !important;
  padding:0 !important;
  color:var(--wallet-muted) !important;
  font:inherit !important;
  font-weight:850 !important;
  text-decoration:none !important;
}
.wallet-page .txn-value .number,
.wallet-page .txn-value .currency,
.wallet-page .txn-value .sign,
.wallet-page .txn-value .txn-value-text,
.wallet-search-modal .txn-value .number,
.wallet-search-modal .txn-value .currency,
.wallet-search-modal .txn-value .sign,
.wallet-search-modal .txn-value .txn-value-text{
  font-size:clamp(14px,2.35vw,17px) !important;
  line-height:1.25 !important;
}
.wallet-page .txn-action,
.wallet-search-modal .txn-action{
  background:#e4e6ee !important;
  color:var(--wallet-primary) !important;
  width:44px !important;
  min-width:44px !important;
  height:44px !important;
  min-height:44px !important;
}
html[data-theme="dark"] .wallet-page .txn-action,
body.dark-mode .wallet-page .txn-action,
html[data-theme="dark"] .wallet-search-modal .txn-action,
body.dark-mode .wallet-search-modal .txn-action{
  background:#202536 !important;
  color:#dbe4ff !important;
  border:0 !important;
  box-shadow:none !important;
  outline:0 !important;
}
html[data-theme="light"] .wallet-page .txn-action,
body.light-mode .wallet-page .txn-action,
body:not(.dark-mode) .wallet-page .txn-action,
html[data-theme="light"] .wallet-search-modal .txn-action,
body.light-mode .wallet-search-modal .txn-action,
body:not(.dark-mode) .wallet-search-modal .txn-action{
  background:#f8fafc !important;
  color:#334155 !important;
  border:0 !important;
  box-shadow:none !important;
  outline:0 !important;
}
.wallet-page .wallet-transaction-card,
.wallet-search-modal .wallet-transaction-card,
.wallet-page .wallet-transaction-card .txn-body,
.wallet-search-modal .wallet-transaction-card .txn-body,
.wallet-page .wallet-transaction-card .txn-middle,
.wallet-search-modal .wallet-transaction-card .txn-middle,
.wallet-page .wallet-transaction-card .txn-amount,
.wallet-search-modal .wallet-transaction-card .txn-amount,
.wallet-page .payment-inline-details,
.wallet-page .wallet-inline-details,
.wallet-search-modal .payment-inline-details,
.wallet-search-modal .wallet-inline-details{
  background:transparent !important;
  background-image:none !important;
  box-shadow:none !important;
  backdrop-filter:none !important;
}
.wallet-page .wallet-transaction-card::before,
.wallet-page .wallet-transaction-card::after,
.wallet-search-modal .wallet-transaction-card::before,
.wallet-search-modal .wallet-transaction-card::after,
.wallet-page .wallet-transaction-card .txn-body::before,
.wallet-page .wallet-transaction-card .txn-body::after,
.wallet-search-modal .wallet-transaction-card .txn-body::before,
.wallet-search-modal .wallet-transaction-card .txn-body::after{
  content:none !important;
  display:none !important;
}
#paymentsList .txn-amount.positive .txn-value,
#paymentsList .txn-amount.positive .txn-value :is(.number,.currency,.sign),
#paymentsList .txn-status-side.approved,
#paymentsList .balance-after.is-approved,
#paymentsList .balance-after.is-approved .txn-balance-value{
  color:var(--wallet-green,#53b69c) !important;
}
#paymentsList .txn-amount.neutral .txn-value,
#paymentsList .txn-amount.neutral .txn-value :is(.number,.currency,.sign),
#paymentsList .txn-status-side.pending,
#paymentsList .balance-after.is-pending,
#paymentsList .balance-after.is-pending .txn-balance-value{
  color:var(--wallet-gold,#facc15) !important;
}
#paymentsList .txn-amount.negative .txn-value,
#paymentsList .txn-amount.negative .txn-value :is(.number,.currency,.sign),
#paymentsList .txn-status-side.rejected,
#paymentsList .balance-after.is-rejected,
#paymentsList .balance-after.is-rejected .txn-balance-value{
  color:var(--wallet-red,#d60945) !important;
}
.payment-inline-details,
.wallet-inline-details{
  margin:16px 0 0 !important;
  padding:0 !important;
  border:0 !important;
  border-radius:0 !important;
  background:transparent !important;
  box-shadow:none !important;
  color:var(--wallet-text) !important;
  text-align:right;
  direction:rtl;
}
html[data-theme="dark"] .payment-inline-details,
body.dark-mode .payment-inline-details,
html[data-theme="dark"] .wallet-inline-details,
body.dark-mode .wallet-inline-details{
  background:transparent !important;
}
.payment-inline-details p,
.wallet-inline-details p{
  margin:0 !important;
  padding:9px 0 !important;
  border-bottom:1px solid rgba(var(--site-accent-rgb,125,140,175),.24) !important;
  font-size:clamp(17px,2.65vw,21px) !important;
  line-height:1.75 !important;
  color:var(--wallet-text) !important;
}
.payment-inline-details p:first-child,
.wallet-inline-details p:first-child{
  padding-top:0 !important;
}
.payment-inline-details p:last-child,
.wallet-inline-details p:last-child{
  padding-bottom:0 !important;
  border-bottom:0 !important;
}
.payment-inline-details strong,
.wallet-inline-details strong{
  color:var(--wallet-muted) !important;
  font-weight:850 !important;
}
@media (max-width:520px){
  .wallet-page .txn-body,
  .wallet-search-modal .txn-body{
    grid-template-columns:minmax(72px,84px) minmax(0,1fr) 42px !important;
    gap:8px !important;
  }
}
.wallet-empty-state i,
.catalog-games-empty i{
  color:var(--wallet-muted, #777);
  font-size:48px;
  line-height:1;
}
.wallet-empty-state span,
.catalog-games-empty span{
  color:var(--wallet-text, var(--text, #1d2742)) !important;
  font-size:16px;
  font-weight:900;
}
html[data-theme="dark"] .wallet-empty-state span,
body.dark-mode .wallet-empty-state span,
html[data-theme="dark"] .catalog-games-empty span,
body.dark-mode .catalog-games-empty span{
  color:var(--wallet-text, var(--text, #f5f7ff)) !important;
}
@media (max-width:520px){
  .wallet-page .wallet-modern-shell,
  .wallet-modern-shell > .wallet-filter-modal .wallet-filter-panel,
  .wallet-modern-shell > .wallet-history-modal .wallet-history-modal-card,
  .wallet-modern-shell > .wallet-search-modal .wallet-search-panel{
    padding-inline:6px !important;
  }
  .wallet-modern-topbar,
  .wallet-filter-head,
  .wallet-receipt-head,
  .wallet-search-head{
    margin-bottom:24px;
  }
  .wallet-page .txn-body,
  .wallet-search-modal .txn-body{
    grid-template-columns:minmax(72px,84px) minmax(0,1fr) 42px;
    gap:8px;
  }
  .wallet-page .txn-action,
  .wallet-search-modal .txn-action{
    width:42px;
    min-width:42px;
    height:42px;
    min-height:42px;
  }
  .wallet-receipt-row{
    grid-template-columns:minmax(0,1fr) 126px;
  }
}
`;
    document.head.appendChild(style);
  }

  async function initWalletLikePage(pageMode){
    ensureWalletModernStyles();
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

    if (!authInstance || (!dbInstance && pageConfig.pageKey === 'payments')) {
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
      const CACHE_SCHEMA_VERSION = 7;
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
      let SEARCH_QUERY = '';
      let OPERATION_FILTER = 'all';
      let WALLET_FILTER_MODAL = null;
      let WALLET_SEARCH_MODAL = null;
      const WALLET_FILTER_CAL = { year: 0, month: 0 };
      const HISTORY_CAL = { el: null, year: 0, month: 0 };
      const CALENDAR_OWNER = `wallet-like-${PAGE_MODE}`;
      let TRANSACTION_DETAILS_MODAL = null;
      let TRANSACTION_DETAILS_LAST_FOCUS = null;
      let TRANSACTION_DETAILS_REQUEST_TOKEN = '';
      let AUTO_REFRESH_BOUND = false;
      let PENDING_AUTO_REFRESH_ID = 0;
      const HISTORY_INITIAL_VISIBLE_COUNT = 50;
      const HISTORY_VISIBLE_STEP = 50;
      let VISIBLE_LIMIT = HISTORY_INITIAL_VISIBLE_COUNT;

      function historyT(key, ar){
        try {
          if (typeof ordersT === 'function') return ordersT(key, ar);
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

      function normalizeHistoryTimestampValue(value){
        var iso = __normalizeHistoryTimestampRaw(value);
        // Defensive clamp: no wallet movement is legitimately in the future. A corrupt
        // field (observed year-2034 createdAt) must never drive the display OR the
        // today-filter (which would otherwise hide the row). Pull any future value back
        // to "now". Non-date strings pass through unchanged.
        try {
          if (iso) {
            var ms = Date.parse(iso);
            if (Number.isFinite(ms) && ms > Date.now() + 86400000) {
              return new Date().toISOString();
            }
          }
        } catch(_){ }
        return iso;
      }
      function __normalizeHistoryTimestampRaw(value){
        try{
          if (value == null || value === '') return '';
          if (value && typeof value === 'object'){
            if (typeof value.toDate === 'function'){
              const d = value.toDate();
              return d && !isNaN(d.getTime()) ? d.toISOString() : '';
            }
            const seconds = Number(value.seconds != null ? value.seconds : value._seconds);
            if (Number.isFinite(seconds)){
              const nanos = Number(value.nanoseconds != null ? value.nanoseconds : value._nanoseconds);
              const ms = seconds * 1000 + (Number.isFinite(nanos) ? Math.floor(nanos / 1000000) : 0);
              return new Date(ms).toISOString();
            }
          }
          if (typeof value === 'number' && Number.isFinite(value)){
            const ms = Math.abs(value) < 100000000000 ? value * 1000 : value;
            return new Date(ms).toISOString();
          }
          const text = String(value || '').trim();
          if (!text) return '';
          if (/^-?\d+(?:\.\d+)?$/.test(text)){
            const numeric = Number(text);
            if (Number.isFinite(numeric)){
              const ms = Math.abs(numeric) < 100000000000 ? numeric * 1000 : numeric;
              return new Date(ms).toISOString();
            }
          }
          const parsed = Date.parse(text);
          return Number.isFinite(parsed) ? new Date(parsed).toISOString() : text;
        }catch(_){
          return '';
        }
      }

      function getItemRawTimeValue(item){
        const source = item && typeof item === 'object' ? item : {};
        const keys = [
          'createdAt',
          'created_at',
          'createdAtISO',
          'timestamp',
          'time',
          'date',
          'serverCreatedAt'
        ];
        for (let i = 0; i < keys.length; i += 1){
          const normalized = normalizeHistoryTimestampValue(source[keys[i]]);
          if (normalized) return normalized;
        }
        return '';
      }

      function getItemTimeMs(item){
        const date = asDate(getItemRawTimeValue(item));
        return date && !isNaN(date.getTime()) ? date.getTime() : 0;
      }

      function hasItemDisplayTime(item){
        return !!getItemRawTimeValue(item);
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

      function resetHistoryViewState(){
        CURRENT_FILTER = 'all';
        SEARCH_QUERY = '';
        OPERATION_FILTER = 'all';
        applyDefaultDateFilter();
        VISIBLE_LIMIT = HISTORY_INITIAL_VISIBLE_COUNT;
        try { closeTransactionDetailsModal(); } catch(_){}
        try { closeHistoryCalendar(); } catch(_){}
      }

      function resetHistoryViewStateForExit(){
        resetHistoryViewState();
        try {
          if (LAST_USER_ID) delete FILTER_MEMORY[FILTER_PREFIX + LAST_USER_ID];
        } catch(_){}
        try { syncWalletToolbarUI(); } catch(_){}
      }

      function getDateChipText(){
        const dateLabel = historyT("history.dateLabel", "التاريخ");
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
        const activeRouteKey = getActiveInlineRouteKey();
        if (PAGE_MODE === 'payments' && activeRouteKey === 'payments') return true;
        return !!routeKey && activeRouteKey === routeKey;
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

      function readWalletSessionInfo(){
        var out = { uid: '', sessionKey: '', idToken: '' };
        try {
          var raw = localStorage.getItem('sessionKeyInfo');
          if (raw) {
            var parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') {
              out.uid = String(parsed.uid || parsed.useruid || parsed.userUid || '').trim();
              out.sessionKey = String(parsed.sessionKey || parsed.session_key || '').trim();
              out.idToken = String(parsed.idToken || parsed.id_token || parsed.token || '').trim();
            }
          }
        } catch(_){}
        try {
          if (typeof readPostLoginPayload === 'function') {
            var payload = readPostLoginPayload() || {};
            out.uid = out.uid || String(payload.uid || payload.useruid || payload.userUid || '').trim();
            out.sessionKey = out.sessionKey || String(payload.sessionKey || payload.session_key || '').trim();
            out.idToken = out.idToken || String(payload.idToken || payload.id_token || payload.firebaseIdToken || payload.firebase_id_token || payload.token || '').trim();
          }
        } catch(_){}
        return out;
      }

      async function resolveWalletAuthContext(user){
        var session = readWalletSessionInfo();
        var activeUser = user || auth.currentUser || null;
        var uid = String((activeUser && activeUser.uid) || session.uid || '').trim();
        var idToken = String(session.idToken || '').trim();
        if (activeUser && typeof activeUser.getIdToken === 'function') {
          try { idToken = String(await activeUser.getIdToken(false) || '').trim(); }
          catch (_) {
            try { idToken = String(await activeUser.getIdToken(true) || '').trim(); }
            catch(__){}
          }
        }
        return {
          uid: uid,
          sessionKey: String(session.sessionKey || '').trim(),
          idToken: idToken
        };
      }

      function buildClientWalletRequestUrl(uid, options){
        var opts = options && typeof options === 'object' ? options : {};
        var requestUrl;
        try {
          var workerBase = window.__getSiteWorkerBaseDefault
            ? String(window.__getSiteWorkerBaseDefault({ trailingSlash: true }) || '').trim()
            : '';
          requestUrl = workerBase ? new URL(workerBase) : new URL('/', window.location.href);
        } catch (_) {
          requestUrl = new URL('/', window.location.href);
        }
        requestUrl.searchParams.set('mode', 'client-wallet');
        requestUrl.searchParams.set('useruid', String(uid || '').trim());
        requestUrl.searchParams.set('limit', String(opts.limit || 1000));
        if (opts.sessionKey) requestUrl.searchParams.set('sessionKey', String(opts.sessionKey));
        if (opts.code) requestUrl.searchParams.set('code', String(opts.code));
        if (opts.entryKey) requestUrl.searchParams.set('entryKey', String(opts.entryKey));
        requestUrl.searchParams.set('_', String(Date.now()));
        return requestUrl;
      }

      async function fetchWalletTransactionsFromServer(uid, options){
        var authCtx = await resolveWalletAuthContext(auth.currentUser);
        var safeUid = String(uid || authCtx.uid || '').trim();
        if (!safeUid || !authCtx.sessionKey) throw new Error('wallet_auth_missing');
        var requestUrl = buildClientWalletRequestUrl(safeUid, Object.assign({}, options || {}, { sessionKey: authCtx.sessionKey }));
        var response = await fetch(requestUrl.toString(), {
          method: 'GET',
          cache: 'no-store'
        });
        var payload = await response.json().catch(function(){ return {}; });
        if (!response.ok || !payload || payload.ok === false) {
          throw new Error((payload && (payload.error || payload.message)) || ('wallet_http_' + String(response.status || 0)));
        }
        var wallet = payload && payload.wallet && typeof payload.wallet === 'object' ? payload.wallet : {};
        var list = Array.isArray(wallet.items)
          ? wallet.items
          : (Array.isArray(payload.transactions)
            ? payload.transactions
            : (Array.isArray(payload.items) ? payload.items : []));
        return list.map(function(item){
          var normalized = Object.assign({}, item || {});
          normalized.__kind = ensureKind(normalized, normalized.kind || normalized.__kind || 'deposit');
          if (!normalized.code && normalized.entryKey) normalized.code = normalized.entryKey;
          return normalized;
        });
      }

      function sortRequestItemsByNewest(arr){
        return (arr || []).slice().sort(function(a,b){
          const ta = getItemTimeMs(a);
          const tb = getItemTimeMs(b);
          if (tb !== ta) return tb - ta;
          return String(getItemCacheKey(b) || getCode(b) || '').localeCompare(String(getItemCacheKey(a) || getCode(a) || ''));
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
        listEl.innerHTML = '';
        const empty = document.createElement('div');
        empty.className = 'empty';
        empty.textContent = String(pageConfig.emptyText || '').trim();
        listEl.appendChild(empty);
        closeTransactionDetailsModal();
      }
      function showRequiresAuth(){
        listEl.innerHTML = '';
        const empty = document.createElement('div');
        empty.className = 'empty';
        empty.textContent = String(pageConfig.authRequiredText || '').trim();
        listEl.appendChild(empty);
        chipsWrap.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        ALL_ITEMS = [];
        resetHistoryViewState();
        LAST_USER_ID = null;
        closeTransactionDetailsModal();
        syncWalletToolbarUI();
      }

      function asDate(ts){
        try{
          const normalized = normalizeHistoryTimestampValue(ts);
          if (!normalized) return null;
          return new Date(normalized);
        }catch(_){ return null; }
      }
      function formatDate(ts){
        const d = asDate(ts);
        if (!d || isNaN(d.getTime())) return ts || '-';
        try{
          return d.toLocaleString('ar-EG',{ weekday:'long', year:'numeric', month:'long', day:'numeric', hour:'2-digit', minute:'2-digit', second:'2-digit' });
        }catch(_){ return d.toString(); }
      }
      function formatWalletDetailDate(ts){
        const d = asDate(ts);
        if (!d || isNaN(d.getTime())) return ts || '-';
        return String(d.getFullYear()) + '/' +
          pad2(d.getMonth() + 1) + '/' +
          pad2(d.getDate()) + ' ' +
          pad2(d.getHours()) + ':' +
          pad2(d.getMinutes()) + ':' +
          pad2(d.getSeconds());
      }

      function formatWalletDayLabel(ts){
        var d = asDate(ts);
        if (!d || isNaN(d.getTime())) return '';
        var ymd = function(x){ return x.getFullYear() + '-' + pad2(x.getMonth() + 1) + '-' + pad2(x.getDate()); };
        var now = new Date();
        var yest = new Date(now.getTime()); yest.setDate(yest.getDate() - 1);
        var dStr = ymd(d);
        var time = pad2(d.getHours()) + ':' + pad2(d.getMinutes());
        if (dStr === ymd(now)) return 'اليوم ' + time;
        if (dStr === ymd(yest)) return 'أمس ' + time;
        return pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1) + '/' + d.getFullYear();
      }

      function normStatus(s){
        const v = (s||'').toString().toLowerCase();
        if (v.includes('reject') || v.includes('مرفوض') || v.includes('طآ¸أ¢â‚¬آ¦طآ·آآ±طآ¸ظآ¾طآ¸ثâ€ طآ·آآ¶')) return 'rejected';
        if (v.includes('approved') || v.includes('accept') || v.includes('accepted') || v.includes('done') || v.includes('completed') || v.includes('success') || v.includes('تم') || v.includes('مقبول') || v.includes('مقبولة') || v.includes('طآ·عآ¾طآ¸أ¢â‚¬آ¦') || v.includes('طآ¸أ¢â‚¬آ¦طآ¸أ¢â‚¬ڑطآ·آآ¨طآ¸ثâ€ طآ¸أ¢â‚¬â€چ')) return 'approved';
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

      function getWalletGroupLabel(ms){
        var d = new Date(ms);
        if (!d || isNaN(d.getTime())) return 'بدون تاريخ';
        var today = new Date();
        var yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
        var ymd = `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
        var todayYmd = `${today.getFullYear()}-${pad2(today.getMonth()+1)}-${pad2(today.getDate())}`;
        var yesterdayYmd = `${yesterday.getFullYear()}-${pad2(yesterday.getMonth()+1)}-${pad2(yesterday.getDate())}`;
        if (ymd === todayYmd) return 'اليوم';
        if (ymd === yesterdayYmd) return 'أمس';
        try {
          return d.toLocaleDateString('ar-EG', { day:'2-digit', month:'short', year:'numeric' });
        } catch(_) {
          return ymd;
        }
      }

      function formatBalanceValue(value, currency){
        if (value == null || !isFinite(value)) return '';
        var cur = 'USD';
        return formatNumber(value, digitsForCurrency(cur)) + ' ' + cur;
      }

      function getWalletEmptyTextForCurrentFilters(){
        if (PAGE_MODE === 'wallet' && DATE_FILTER_ENABLED){
          if (DATE_MODE === 'range') return 'لا توجد معاملات لهذا النطاق';
          return 'لا توجد معاملات لهذا اليوم';
        }
        return String(pageConfig.emptyText || '').trim();
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

      function isWalletOperationFilterKey(value){
        var key = String(value || 'all').trim();
        return [
          'all',
          'transfer',
          'purchase',
          'refund',
          'deposit',
          'withdraw',
          'admin',
          'other'
        ].indexOf(key) >= 0;
      }

      function resolveWalletOperationFilterKey(item){
        var meta = resolveWalletOperationMeta(item || {}, '');
        var key = String(meta && meta.key || '').trim();
        if (key === 'transfer_in' || key === 'transfer_out') return 'transfer';
        if (key === 'purchase') return 'purchase';
        if (key === 'refund' || key === 'refund_reversal') return 'refund';
        if (key === 'admin_credit' || key === 'admin_debit') return 'admin';
        if (key === 'deposit_request') return 'deposit';
        if (key === 'withdraw_request') return 'withdraw';
        return 'other';
      }

      function applyTextFilters(arr){
        var list = Array.isArray(arr) ? arr.slice() : [];
        var operation = String(OPERATION_FILTER || 'all').trim();
        if (!operation || operation === 'all') return list;
        return list.filter(function(item){
          return resolveWalletOperationFilterKey(item) === operation;
        });
      }

      function getVisibleItems(){
        return applyTextFilters(applyDateFilter(applyFilter(ALL_ITEMS.filter(hasItemDisplayTime))));
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
            var filterValue = String(chip.dataset.filter || 'all').trim() || 'all';
            var activeFilter = PAGE_MODE === 'wallet' ? String(OPERATION_FILTER || 'all') : String(CURRENT_FILTER || 'all');
            chip.classList.toggle('active', filterValue === activeFilter);
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

      function appendHistoryLoadMore(total, shown, uid){
        if (!listEl || total <= shown) return;
        const wrap = document.createElement('div');
        wrap.className = 'wallet-history-more';
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'wallet-history-more-btn';
        btn.textContent = historyT('history.showMore', 'اظهار المزيد');
        btn.setAttribute('aria-label', btn.textContent);
        btn.addEventListener('click', function(){
          VISIBLE_LIMIT = Math.min(total, (Number(VISIBLE_LIMIT) || HISTORY_INITIAL_VISIBLE_COUNT) + HISTORY_VISIBLE_STEP);
          renderVisibleItems(uid || LAST_USER_ID);
        });
        wrap.appendChild(btn);
        listEl.appendChild(wrap);
      }

      function renderVisibleItems(uid){
        const visibleItems = getVisibleItems();
        const limit = Math.max(HISTORY_INITIAL_VISIBLE_COUNT, Number(VISIBLE_LIMIT) || HISTORY_INITIAL_VISIBLE_COUNT);
        const pageItems = visibleItems.slice(0, limit);
        renderDeposits(pageItems);
        appendHistoryLoadMore(visibleItems.length, pageItems.length, uid);
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
        // Recurring wallet refresh is intentionally DISABLED per user request:
        // movements refresh ONLY when the wallet page is reloaded or (re-)entered —
        // never on a timer, window focus, or visibility change. Entry/reload refresh
        // is handled by init() and the route onShow hook; explicit refresh by the
        // refresh button. Kept as a no-op so the existing init() call stays valid.
        if (AUTO_REFRESH_BOUND || typeof window === 'undefined') return;
        AUTO_REFRESH_BOUND = true;
      }

      function getWalletAccountLabel(){
        try {
          var raw = localStorage.getItem('sessionKeyInfo');
          if (raw) {
            var parsed = JSON.parse(raw);
            var direct = String(parsed && (parsed.webuid || parsed.webUid || parsed.accountNo || parsed.uid || '') || '').trim();
            if (direct) return direct;
          }
        } catch(_){}
        return LAST_USER_ID || '';
      }

      function getWalletBalanceLabel(){
        try {
          var el = document.getElementById('headerBalanceText') || document.getElementById('balanceAmount') || document.querySelector('[data-user-balance]');
          var value = el ? String(el.textContent || '').trim() : '';
          if (value) return value;
        } catch(_){}
        return '';
      }

      function setQuickDateMode(mode){
        var today = getTodayDateStr();
        if (mode === 'all') {
          resetDateFilter();
          return;
        }
        if (mode === 'custom') {
          DATE_FILTER_ENABLED = true;
          DATE_MODE = 'range';
          DATE_RANGE = { from: null, to: null };
          SELECTED_DATE_STR = '';
          return;
        }
        if (mode === 'yesterday') {
          var d = new Date();
          d.setDate(d.getDate() - 1);
          today = `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
        }
        DATE_FILTER_ENABLED = true;
        DATE_MODE = 'single';
        SELECTED_DATE_STR = today;
        DATE_RANGE = { from: null, to: null };
      }

      function getWalletOperationFilterLabel(value){
        var key = String(value || 'all').trim();
        var labels = {
          all: 'الكل',
          transfer: 'تحويل',
          purchase: 'شراء',
          refund: 'استرداد',
          deposit: 'إيداع',
          withdraw: 'سحب',
          admin: 'إدارة'
        };
        return labels[key] || labels.all;
      }

      function syncWalletOperationButtons(root){
        if (!root) return;
        root.querySelectorAll('[data-wallet-operation]').forEach(function(btn){
          btn.classList.toggle('active', String(btn.getAttribute('data-wallet-operation') || 'all') === String(OPERATION_FILTER || 'all'));
        });
      }

      function syncWalletQuickDateButtons(root){
        if (!root) return;
        var mode = 'custom';
        if (!DATE_FILTER_ENABLED) mode = 'all';
        else if (DATE_MODE === 'single') {
          var selected = SELECTED_DATE_STR || getTodayDateStr();
          var today = getTodayDateStr();
          var d = new Date();
          d.setDate(d.getDate() - 1);
          var yesterday = `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
          if (selected === today) mode = 'today';
          else if (selected === yesterday) mode = 'yesterday';
        }
        root.querySelectorAll('[data-wallet-quick]').forEach(function(btn){
          btn.classList.toggle('active', String(btn.getAttribute('data-wallet-quick') || 'custom') === mode);
        });
      }

      function initWalletFilterCalendarBase(){
        var base = (DATE_RANGE && DATE_RANGE.from) || SELECTED_DATE_STR || getTodayDateStr();
        var parts = String(base || getTodayDateStr()).split('-').map(Number);
        WALLET_FILTER_CAL.year = parts[0] || (new Date()).getFullYear();
        WALLET_FILTER_CAL.month = (parts[1] || 1) - 1;
      }

      function shiftWalletFilterCalendar(delta){
        var y = WALLET_FILTER_CAL.year || (new Date()).getFullYear();
        var m = (WALLET_FILTER_CAL.month || 0) + delta;
        if (m < 0){ m = 11; y -= 1; }
        else if (m > 11){ m = 0; y += 1; }
        WALLET_FILTER_CAL.year = y;
        WALLET_FILTER_CAL.month = m;
        renderWalletFilterCalendar(WALLET_FILTER_MODAL);
      }

      function renderWalletFilterCalendar(modal){
        if (!modal) return;
        if (!WALLET_FILTER_CAL.year) initWalletFilterCalendarBase();
        var year = WALLET_FILTER_CAL.year;
        var month = WALLET_FILTER_CAL.month;
        var titleEl = modal.querySelector('#walletFilterCalTitle');
        var grid = modal.querySelector('#walletFilterCalGrid');
        var selection = modal.querySelector('#walletFilterCalSelection');
        var counts = computeHistoryDateCounts();
        if (titleEl) {
          try {
            titleEl.textContent = new Date(year, month, 1).toLocaleDateString(getHistoryLocale(), { month:'long', year:'numeric' });
          } catch (_) {
            titleEl.textContent = `${pad2(month + 1)}/${year}`;
          }
        }
        if (selection) {
          if (!DATE_FILTER_ENABLED) selection.textContent = 'كل التواريخ';
          else if (DATE_MODE === 'range') {
            var fromText = DATE_RANGE && DATE_RANGE.from ? formatHistoryDateStr(DATE_RANGE.from) : 'اختر البداية';
            var toText = DATE_RANGE && DATE_RANGE.to ? formatHistoryDateStr(DATE_RANGE.to) : 'اختر النهاية';
            selection.textContent = fromText + ' - ' + toText;
          } else {
            selection.textContent = formatHistoryDateStr(SELECTED_DATE_STR || getTodayDateStr());
          }
        }
        if (!grid) return;
        var first = new Date(year, month, 1);
        var lastDay = new Date(year, month + 1, 0).getDate();
        var dow = first.getDay();
        var todayStr = getTodayDateStr();
        var minDateStr = getHistoryMinDateStr();
        var weekdays = ['أحد','إثنين','ثلاثاء','أربعاء','خميس','جمعة','سبت'];
        var html = '';
        for (var w = 0; w < 7; w += 1) html += '<div class="calendar-weekday">' + weekdays[w] + '</div>';
        for (var s = 0; s < dow; s += 1) html += '<div class="calendar-spacer"></div>';
        var rawFrom = DATE_RANGE && DATE_RANGE.from ? String(DATE_RANGE.from) : '';
        var rawTo = DATE_RANGE && DATE_RANGE.to ? String(DATE_RANGE.to) : '';
        var from = rawFrom && rawTo && rawFrom > rawTo ? rawTo : rawFrom;
        var to = rawFrom && rawTo && rawFrom > rawTo ? rawFrom : rawTo;
        var selected = SELECTED_DATE_STR || todayStr;
        for (var day = 1; day <= lastDay; day += 1){
          var ymd = `${year}-${pad2(month + 1)}-${pad2(day)}`;
          var count = counts[ymd] || 0;
          var cls = count > 0 ? ' has' : '';
          if (DATE_FILTER_ENABLED && DATE_MODE === 'range') {
            if (from && to && ymd > from && ymd < to) cls += ' in-range';
            if (from && ymd === from) cls += ' range-start active';
            if (to && ymd === to) cls += ' range-end active';
          } else if (DATE_FILTER_ENABLED && DATE_MODE === 'single' && ymd === selected) {
            cls += ' active';
          }
          var disabled = (ymd > todayStr || ymd < minDateStr) ? ' disabled' : '';
          html += '<button type="button" class="calendar-day' + cls + disabled + '" data-date="' + ymd + '"' + (disabled ? ' disabled aria-disabled="true"' : '') + '><span class="num">' + day + '</span></button>';
        }
        grid.innerHTML = html;
        grid.querySelectorAll('.calendar-day').forEach(function(btn){
          if (btn.classList.contains('disabled')) return;
          btn.addEventListener('click', function(){
            var ymd = String(btn.getAttribute('data-date') || '').trim();
            if (!ymd) return;
            DATE_FILTER_ENABLED = true;
            if (DATE_MODE === 'range') {
              if (!DATE_RANGE.from || (DATE_RANGE.from && DATE_RANGE.to)) DATE_RANGE = { from: ymd, to: null };
              else if (ymd < DATE_RANGE.from) DATE_RANGE = { from: ymd, to: DATE_RANGE.from };
              else DATE_RANGE.to = ymd;
            } else {
              SELECTED_DATE_STR = ymd;
              DATE_RANGE = { from: null, to: null };
            }
            renderWalletFilterCalendar(modal);
            if (DATE_MODE === 'range' && DATE_RANGE && DATE_RANGE.from && DATE_RANGE.to) {
              setWalletCalendarPopoverOpen(modal, false);
            }
          });
        });
      }

      function setWalletCalendarPopoverOpen(modal, open){
        if (!modal) return;
        var popover = modal.querySelector('#walletFilterCalendarPopover');
        if (popover) popover.classList.toggle('show', !!open);
      }

      function filterWalletSearchItems(query){
        var needle = normalizeLedgerText(query || '').toLowerCase();
        if (!needle) return ALL_ITEMS.slice();
        return ALL_ITEMS.filter(function(item){
          var haystack = [
            getCode(item),
            item && item.entryKey,
            item && item.methodName,
            item && item.serviceName,
            item && item.productName,
            item && item.title,
            item && item.description,
            item && item.note,
            item && item.transferPeer,
            item && item.relatedCode
          ].map(function(value){ return normalizeLedgerText(value).toLowerCase(); }).join(' ');
          return haystack.indexOf(needle) >= 0;
        });
      }

      function getWalletModernShell(){
        return document.querySelector('.wallet-page .wallet-modern-shell') ||
          document.querySelector('.wallet-modern-shell') ||
          document.body;
      }

      function setWalletSubpageActive(active){
        var shell = getWalletModernShell();
        var page = shell && shell.closest ? shell.closest('.wallet-page') : document.querySelector('.wallet-page');
        if (page) page.classList.toggle('wallet-subpage-active', !!active);
      }

      function hasOpenWalletSubpage(){
        return !!(
          (WALLET_FILTER_MODAL && WALLET_FILTER_MODAL.classList.contains('show')) ||
          (WALLET_SEARCH_MODAL && WALLET_SEARCH_MODAL.classList.contains('show')) ||
          (TRANSACTION_DETAILS_MODAL && TRANSACTION_DETAILS_MODAL.classList.contains('show'))
        );
      }

      function mountWalletSubpage(node){
        if (!node) return;
        var host = getWalletModernShell();
        if (host && node.parentNode !== host) host.appendChild(node);
      }

      function ensureWalletFilterModal(){
        if (WALLET_FILTER_MODAL && document.body && document.body.contains(WALLET_FILTER_MODAL)) return WALLET_FILTER_MODAL;
        var overlay = document.createElement('div');
        overlay.className = 'wallet-filter-modal';
        overlay.setAttribute('role', 'region');
        overlay.setAttribute('aria-modal', 'false');
        if (PAGE_MODE === 'payments') OPERATION_FILTER = 'all';
        var operationFilterHtml = PAGE_MODE === 'payments'
          ? ''
          : [
            '<div class="wallet-filter-field"><span>اختر العملية</span><div class="wallet-operation-strip">',
              '<button type="button" data-wallet-operation="all" class="active">الكل</button>',
              '<button type="button" data-wallet-operation="transfer">تحويل</button>',
              '<button type="button" data-wallet-operation="purchase">شراء</button>',
              '<button type="button" data-wallet-operation="refund">استرداد</button>',
              '<button type="button" data-wallet-operation="deposit">إيداع</button>',
              '<button type="button" data-wallet-operation="admin">إدارة</button>',
            '</div></div>'
          ].join('');
        overlay.innerHTML = [
          '<div class="wallet-filter-panel">',
            '<div class="wallet-filter-head">',
              '<button type="button" class="wallet-filter-back" aria-label="رجوع"><i class="fa-solid fa-arrow-right" aria-hidden="true"></i></button>',
              '<div><h3>تصفية المعاملات</h3></div>',
              '<span></span>',
            '</div>',
            '<div class="wallet-filter-field"><span>اختر التاريخ</span><div class="wallet-filter-quick">',
              '<button type="button" data-wallet-quick="custom" class="active">مخصص</button>',
              '<button type="button" data-wallet-quick="all">الكل</button>',
              '<button type="button" data-wallet-quick="today">اليوم</button>',
              '<button type="button" data-wallet-quick="yesterday">أمس</button>',
            '</div></div>',
            '<div class="wallet-filter-calendar-popover" id="walletFilterCalendarPopover">',
              '<div class="wallet-filter-calendar">',
                '<div class="wallet-filter-calendar-head">',
                  '<button type="button" id="walletFilterCalPrev" aria-label="الشهر السابق"><i class="fa-solid fa-chevron-left" aria-hidden="true"></i></button>',
                  '<div class="wallet-filter-calendar-title" id="walletFilterCalTitle"></div>',
                  '<button type="button" id="walletFilterCalNext" aria-label="الشهر التالي"><i class="fa-solid fa-chevron-right" aria-hidden="true"></i></button>',
                '</div>',
                '<div class="wallet-filter-calendar-selected" id="walletFilterCalSelection"></div>',
                '<div class="wallet-filter-calendar-grid" id="walletFilterCalGrid"></div>',
              '</div>',
            '</div>',
            operationFilterHtml,
            '<div class="wallet-filter-actions"><button type="button" class="primary" id="walletFilterApply">تصفية</button><button type="button" class="secondary" id="walletFilterClear">مسح</button></div>',
          '</div>'
        ].join('');
        var closeBtn = overlay.querySelector('.wallet-filter-back');
        if (closeBtn) closeBtn.addEventListener('click', closeWalletFilterModal);
        overlay.querySelectorAll('[data-wallet-quick]').forEach(function(btn){
          btn.addEventListener('click', function(){
            overlay.querySelectorAll('[data-wallet-quick]').forEach(function(x){ x.classList.remove('active'); });
            btn.classList.add('active');
            var mode = String(btn.getAttribute('data-wallet-quick') || 'custom');
            setQuickDateMode(mode);
            VISIBLE_LIMIT = HISTORY_INITIAL_VISIBLE_COUNT;
            renderWalletFilterCalendar(overlay);
            syncWalletQuickDateButtons(overlay);
            setWalletCalendarPopoverOpen(overlay, mode === 'custom');
          });
        });
        overlay.querySelectorAll('[data-wallet-operation]').forEach(function(btn){
          btn.addEventListener('click', function(){
            OPERATION_FILTER = String(btn.getAttribute('data-wallet-operation') || 'all').trim() || 'all';
            VISIBLE_LIMIT = HISTORY_INITIAL_VISIBLE_COUNT;
            syncWalletOperationButtons(overlay);
          });
        });
        var prev = overlay.querySelector('#walletFilterCalPrev');
        var next = overlay.querySelector('#walletFilterCalNext');
        if (prev) prev.addEventListener('click', function(){ shiftWalletFilterCalendar(-1); });
        if (next) next.addEventListener('click', function(){ shiftWalletFilterCalendar(1); });
        var calPopover = overlay.querySelector('#walletFilterCalendarPopover');
        if (calPopover) {
          calPopover.addEventListener('click', function(ev){
            if (ev.target === calPopover) setWalletCalendarPopoverOpen(overlay, false);
          });
        }
        var apply = overlay.querySelector('#walletFilterApply');
        if (apply) apply.addEventListener('click', function(){
          setWalletCalendarPopoverOpen(overlay, false);
          closeWalletFilterModal();
          VISIBLE_LIMIT = HISTORY_INITIAL_VISIBLE_COUNT;
          renderVisibleItems(LAST_USER_ID);
        });
        var clear = overlay.querySelector('#walletFilterClear');
        if (clear) clear.addEventListener('click', function(){
          resetDateFilter();
          OPERATION_FILTER = 'all';
          SEARCH_QUERY = '';
          VISIBLE_LIMIT = HISTORY_INITIAL_VISIBLE_COUNT;
          syncWalletOperationButtons(overlay);
          renderWalletFilterCalendar(overlay);
          syncWalletQuickDateButtons(overlay);
          setWalletCalendarPopoverOpen(overlay, false);
          closeWalletFilterModal();
          renderVisibleItems(LAST_USER_ID);
        });
        mountWalletSubpage(overlay);
        WALLET_FILTER_MODAL = overlay;
        return overlay;
      }

      function openWalletFilterModal(){
        closeWalletSearchModal();
        var modal = ensureWalletFilterModal();
        mountWalletSubpage(modal);
        initWalletFilterCalendarBase();
        renderWalletFilterCalendar(modal);
        syncWalletOperationButtons(modal);
        syncWalletQuickDateButtons(modal);
        setWalletCalendarPopoverOpen(modal, false);
        modal.classList.add('show');
        setWalletSubpageActive(true);
      }

      function closeWalletFilterModal(){
        if (WALLET_FILTER_MODAL) {
          setWalletCalendarPopoverOpen(WALLET_FILTER_MODAL, false);
          WALLET_FILTER_MODAL.classList.remove('show');
        }
        if (!hasOpenWalletSubpage()) setWalletSubpageActive(false);
      }

      function ensureWalletSearchModal(){
        if (WALLET_SEARCH_MODAL && document.body && document.body.contains(WALLET_SEARCH_MODAL)) return WALLET_SEARCH_MODAL;
        var overlay = document.createElement('div');
        overlay.className = 'wallet-search-modal';
        overlay.setAttribute('role', 'region');
        overlay.setAttribute('aria-modal', 'false');
        overlay.innerHTML = [
          '<div class="wallet-search-panel">',
            '<div class="wallet-search-head">',
              '<button type="button" class="wallet-search-back" aria-label="رجوع"><i class="fa-solid fa-arrow-right" aria-hidden="true"></i></button>',
              '<div><h3>نتيجة البحث</h3></div>',
              '<span></span>',
            '</div>',
            '<div class="wallet-search-box"><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i><input type="search" id="walletSearchInput" placeholder="ابحث" autocomplete="off"></div>',
            '<div class="wallet-search-group-label" id="walletSearchGroupLabel">الكل</div>',
            '<div class="wallet-modern-list" id="walletSearchResults"></div>',
          '</div>'
        ].join('');
        var closeBtn = overlay.querySelector('.wallet-search-back');
        if (closeBtn) closeBtn.addEventListener('click', closeWalletSearchModal);
        var input = overlay.querySelector('#walletSearchInput');
        var results = overlay.querySelector('#walletSearchResults');
        if (input) {
          input.addEventListener('input', function(){
            var query = String(input.value || '').trim();
            SEARCH_QUERY = query;
            renderWalletItemsInto(results, filterWalletSearchItems(query), { grouped: false, emptyText: 'لا توجد نتائج مطابقة.' });
          });
        }
        if (results) {
          results.addEventListener('click', async function(e){
            var interactive = e.target.closest('a, button, input, select, textarea, label');
            if (interactive) return;
            var card = e.target.closest('.card[data-openable="1"]');
            if (!card) return;
            if (PAGE_MODE === 'payments' || PAGE_MODE === 'wallet') {
              setTransactionCardOpen(card, !card.classList.contains('open'));
              return;
            }
            await openTransactionDetailsForCard(card);
          });
        }
        mountWalletSubpage(overlay);
        WALLET_SEARCH_MODAL = overlay;
        return overlay;
      }

      function openWalletSearchModal(){
        closeWalletFilterModal();
        var modal = ensureWalletSearchModal();
        mountWalletSubpage(modal);
        var input = modal.querySelector('#walletSearchInput');
        var results = modal.querySelector('#walletSearchResults');
        SEARCH_QUERY = '';
        if (input) input.value = '';
        renderWalletItemsInto(results, ALL_ITEMS.slice(), { grouped: false, emptyText: 'لا توجد معاملات للبحث.' });
        modal.classList.add('show');
        setWalletSubpageActive(true);
        setTimeout(function(){ try { if (input) input.focus(); } catch(_){} }, 20);
      }

      function closeWalletSearchModal(){
        if (WALLET_SEARCH_MODAL) WALLET_SEARCH_MODAL.classList.remove('show');
        SEARCH_QUERY = '';
        if (!hasOpenWalletSubpage()) setWalletSubpageActive(false);
      }

      function bindWalletModernControls(){
        var filterBtn = document.getElementById('walletFilterOpen');
        var searchBtn = document.getElementById('walletSearchToggle');
        var backBtn = document.querySelector('.wallet-modern-back');
        if (filterBtn && !filterBtn.__walletBound) {
          filterBtn.__walletBound = true;
          filterBtn.addEventListener('click', openWalletFilterModal);
        }
        if (searchBtn && !searchBtn.__walletBound) {
          searchBtn.__walletBound = true;
          searchBtn.addEventListener('click', openWalletSearchModal);
        }
        if (backBtn && !backBtn.__walletBound) {
          backBtn.__walletBound = true;
          backBtn.addEventListener('click', function(){
            if (history.length > 1) history.back();
            else location.hash = '#/';
          });
        }
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
        window.__WALLET_LIKE_CALENDAR_CLOSE__[PAGE_MODE] = function(){
          closeHistoryCalendar();
          if (!isPageRouteActive()) resetHistoryViewStateForExit();
        };
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
              selectionText.textContent = historyT("history.date.all", "كل التواريخ");
            } else if (DATE_MODE === 'range'){
              const from = DATE_RANGE && DATE_RANGE.from ? String(DATE_RANGE.from) : '';
              const to = DATE_RANGE && DATE_RANGE.to ? String(DATE_RANGE.to) : '';
              if (from && to) selectionText.textContent = `${historyT("history.date.from", "من")} ${formatHistoryDateStr(from)} ${historyT("history.date.to", "إلى")} ${formatHistoryDateStr(to)}`;
              else if (from) selectionText.textContent = `${historyT("history.date.start", "ابدأ")}: ${formatHistoryDateStr(from)} - ${historyT("history.date.pickEnd", "اختر النهاية")}`;
              else selectionText.textContent = historyT("history.date.pickRange", "اختر نطاق تاريخ");
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
              VISIBLE_LIMIT = HISTORY_INITIAL_VISIBLE_COUNT;
              closeHistoryCalendar();
              renderVisibleItems(LAST_USER_ID);
              return;
            }
            SELECTED_DATE_STR = ymd;
            VISIBLE_LIMIT = HISTORY_INITIAL_VISIBLE_COUNT;
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
                <button type="button" class="calendar-mode-btn" id="historyCalModeSingle">${historyT("history.date.single", "يوم واحد")}</button>
                <button type="button" class="calendar-mode-btn" id="historyCalModeRange">${historyT("history.date.range", "نطاق")}</button>
                <button type="button" class="calendar-mode-btn" id="historyCalClear">${historyT("history.date.clear", "الكل")}</button>
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
            VISIBLE_LIMIT = HISTORY_INITIAL_VISIBLE_COUNT;
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
          var m = str && str.match(/[ء-ي]/g);
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
        return txt.replace(/^(?:شراء|استرداد|إرجاع|ارجاع|رد\s*رصيد)\s*[-:طإ’]?\s*/i, '').trim();
      }

      function stripPurchaseLedgerPrefix(value){
        var txt = normalizeLedgerText(value);
        if (!txt) return '';
        return txt.replace(/^(?:شراء|طلب\s*شراء)\s*[-:â€¢ـ]?\s*/i, '').trim();
      }

      function resolvePurchaseLedgerTitle(value, fallback){
        var base = stripPurchaseLedgerPrefix(value);
        if (base) return base;
        var fallbackText = stripPurchaseLedgerPrefix(fallback) || normalizeLedgerText(fallback);
        if (!fallbackText) return 'شراء';
        return stripPurchaseLedgerPrefix(fallbackText) || fallbackText;
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

      function stripWalletCodeLikeText(value){
        var txt = normalizeLedgerText(value);
        if (!txt) return '';
        txt = txt.replace(/\b(?:ORD|DEP|AUT)[A-Z0-9-]{6,}(?:-REFUND-[A-Z0-9-]+)?\b/ig, ' ');
        txt = txt.replace(/\bREFUND\b/ig, ' ');
        txt = txt.replace(/(?:رمز|كود|رقم)\s*(?:الطلب|العملية)?\s*[:：-]?\s*/ig, ' ');
        txt = txt.replace(/\b(?:Payment\s*ID|ID)\s*[:：-]?\s*/ig, ' ');
        return txt.replace(/\s+/g, ' ').trim();
      }

      function resolveRefundCardProductName(data, purchaseName, titleHint, method){
        var src = data && typeof data === 'object' ? data : {};
        var candidates = [
          src.refundProductName,
          src.originalProductName,
          src.originalServiceName,
          src.productName,
          src.serviceName,
          src.offerName,
          src.offer,
          src.itemName,
          src.gameName,
          src.game,
          src.description,
          src.title,
          purchaseName,
          titleHint,
          method
        ];
        for (var i = 0; i < candidates.length; i += 1){
          var txt = stripRefundAdminSuffix(candidates[i]);
          if (!txt) continue;
          txt = txt.replace(/^\s*(?:استرداد|إرجاع|ارجاع|رد\s*رصيد)\s*(?:الطلب)?\s*[-:،]?\s*/i, '').trim();
          txt = stripWalletCodeLikeText(txt);
          txt = txt.replace(/^(?:الطلب|طلب|استرداد|إرجاع|ارجاع|رد\s*رصيد)\s*$/i, '').trim();
          if (txt && !/^(?:-|:|،)+$/.test(txt)) return txt;
        }
        return '';
      }

      function normalizeLedgerComparableText(value){
        return normalizeLedgerText(value).replace(/[â€¢:ـ\-â€“—]+/g, ' ').replace(/\s+/g, ' ').trim();
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
        var currency = 'USD';
        if (kind === 'withdraw'){
          amount = pickNumber(item, ['debited', 'debitedUSD', 'amountUSD', 'debitedJOD', 'amountJOD']);
          if (amount == null) amount = pickNumber(item, ['amountCurrency']);
        } else {
          if (PAGE_MODE === 'payments') {
            var paidInfo = resolvePaymentPaidAmountInfo(item);
            amount = paidInfo.amount;
            currency = paidInfo.currency || currency;
          } else {
            amount = pickNumber(item, ['added', 'addedAmount', 'addedUSD', 'amountUSD']);
            if (amount == null) amount = pickNumber(item, ['client_payAmount', 'amountCurrency']);
          }
        }
        if (amount == null) amount = pickNumber(item, ['amount', 'amountCurrency', 'added', 'addedAmount', 'addedUSD', 'debited', 'debitedUSD']);
        if (amount == null) amount = 0;
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
        var paidInfo = resolvePaymentPaidAmountInfo(item);
        var amount = paidInfo.amount;
        if (amount == null) return '';
        var currency = paidInfo.currency || 'USD';
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

      function resolvePaymentCurrency(item){
        var data = item && typeof item === 'object' ? item : {};
        return normalizeTransactionDetailText(
          data.paymentCurrency ||
          data.paymentCurrencyCode ||
          data.payCurrency ||
          data.payCurrencyCode ||
          data.methodCurrency ||
          data.methodCurrencyCode ||
          data.currencyCode ||
          data.currency_code ||
          data.currency ||
          data.expectedCurrency ||
          ''
        ) || 'USD';
      }

      function resolvePaymentPaidAmountInfo(item){
        var amount = pickNumber(item, [
          'client_payAmount',
          'payAmount',
          'amountCurrency',
          'grossAmountCurrency',
          'paidAmountCurrency',
          'expectedAmount',
          'amount'
        ]);
        if (amount != null) {
          return { amount: amount, currency: resolvePaymentCurrency(item) };
        }
        amount = pickNumber(item, ['paidAmount', 'paidAmountUSD', 'amountUSD']);
        return { amount: amount, currency: 'USD' };
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
        return txt === 'مستلم' || txt === 'مرسل' || txt === 'مستخدم' || txt === '-' || txt === 'أ¢â‚¬â€‌';
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
          }).filter(Boolean).join('طإ’ ');
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
        var createdText = formatWalletDetailDate(getItemRawTimeValue(data));
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
        pushEntry(basic, makeTransactionDetailEntry('التاريخ', createdText && createdText !== '-' ? createdText : ''));
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
          subtitle: subtitleParts.join(' â€¢ '),
          kindLabel: kindLabel,
          status: status,
          statusLabel: operation.statusText || statusLabel(status),
          operationKey: operation.key,
          operationKind: operation.kind,
          isTransfer: operation.isTransfer === true || operation.key === 'transfer_in' || operation.key === 'transfer_out',
          transferPeer: operation.transferPeer || '',
          payoutTarget: operation.payoutTarget || '',
          payoutName: operation.payoutName || '',
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

      function flattenTransactionRows(model){
        var rows = [];
        function push(label, value, divider){
          var text = stringifyTransactionDetailValue(value);
          if (!label || !text) return;
          if (rows.some(function(row){ return row.label === label && row.value === text; })) return;
          rows.push({ label: label, value: text, divider: !!divider });
        }
        (Array.isArray(model.basic) ? model.basic : []).forEach(function(entry, index){
          push(entry.label, entry.value, index === 2);
        });
        (Array.isArray(model.payout) ? model.payout : []).forEach(function(entry, index){
          push(entry.label, entry.value, index === 1);
        });
        (Array.isArray(model.transfers) ? model.transfers : []).forEach(function(entry){
          push(entry.label, entry.value, false);
        });
        (Array.isArray(model.extra) ? model.extra : []).forEach(function(entry){
          push(entry.label, entry.value, false);
        });
        return rows;
      }

      function resolveReceiptAmountText(model, item){
        var kind = resolveDisplayKind(item || {});
        var change = resolveChange(item || {}, kind);
        var value = [change.signSymbol, change.numberText, change.currency].filter(Boolean).join(' ').trim();
        if (value && value !== '-') return value;
        var summary = Array.isArray(model.summary) ? model.summary : [];
        for (var i = 0; i < summary.length; i += 1){
          if (summary[i] && summary[i].value) return summary[i].value;
        }
        return '';
      }

      function renderReceiptRows(model){
        var rows = flattenTransactionRows(model);
        if (!rows.length) return '<div class="wallet-history-modal-empty">' + escapeHtml(model.emptyText || 'لا توجد تفاصيل إضافية متاحة لهذه العملية.') + '</div>';
        return [
          '<div class="wallet-receipt-rows">',
          rows.map(function(row){
            return '<div class="wallet-receipt-row' + (row.divider ? ' is-divider' : '') + '"><strong>' +
              escapeHtml(row.value).replace(/\n/g, '<br>') +
              '</strong><span>' + escapeHtml(row.label) + '</span></div>';
          }).join(''),
          '</div>'
        ].join('');
      }

      function renderReceiptSummary(model, item){
        var amount = resolveReceiptAmountText(model, item);
        return [
          amount ? '<div class="wallet-receipt-amount">' + escapeHtml(amount) + '</div>' : '',
          amount ? '<div class="wallet-receipt-total"><strong>' + escapeHtml(amount) + '</strong><span>المبلغ الإجمالي</span></div>' : '',
          '<div class="wallet-summary-actions">',
            '<button type="button" class="wallet-receipt-primary">تأكيد الرصيد</button>',
          '</div>'
        ].join('');
      }

      function resolveTransferReceiptAmount(item){
        var kind = resolveDisplayKind(item || {});
        var value = kind === 'withdraw'
          ? pickNumber(item, ['debited', 'debitedUSD', 'amountUSD', 'amount', 'amountCurrency'])
          : pickNumber(item, ['added', 'addedAmount', 'addedUSD', 'amountUSD', 'amount', 'amountCurrency']);
        if (value == null) value = 0;
        return formatTransactionDetailAmount(Math.abs(Number(value) || 0), 'USD') || '-';
      }

      function renderTransferSummaryHeader(model){
        return '<img class="wallet-transfer-success-img" src="https://files.catbox.moe/m6mfdt.png" alt="">';
      }

      function renderTransferSummaryContent(model, item){
        var account = getWalletAccountLabel() || '-';
        var peer = model.transferPeer || model.payoutName || model.payoutTarget || item.receiverWebuid || item.recipientWebuid || item.targetWebuid || '-';
        var receiverName = item.receiverName || item.recipientName || item.payoutName || model.payoutName || peer || '-';
        var amount = resolveTransferReceiptAmount(item);
        var fee = formatTransactionDetailAmount(pickNumber(item, ['feeAmountUSD', 'feeAmountCurrency']) || 0, 'USD');
        var tax = formatTransactionDetailAmount(pickNumber(item, ['taxAmountUSD', 'taxAmountCurrency', 'tax']) || 0, 'USD');
        var rows = [
          { label:'من حساب', value: model.operationKey === 'transfer_out' ? account : peer, divider:true },
          { label:'الى المستفيد', value: model.operationKey === 'transfer_out' ? peer : account },
          { label:'اسم المستفيد', value: receiverName },
          { label:'المبلغ', value: amount },
          { label:'الرسوم', value: fee },
          { label:'ضريبة', value: tax, divider:true }
        ];
        var rowsHtml = rows.map(function(row){
          return '<div class="wallet-receipt-row' + (row.divider ? ' is-divider' : '') + '"><strong>' +
            escapeHtml(row.value || '-') +
            '</strong><span>' + escapeHtml(row.label) + '</span></div>';
        }).join('');
        return [
          '<div class="wallet-transfer-summary">',
            '<div class="wallet-receipt-rows">', rowsHtml, '</div>',
            '<div class="wallet-receipt-total"><strong>', escapeHtml(amount), '</strong><span>المبلغ الإجمالي</span></div>',
            '<div class="wallet-summary-actions">',
              '<button type="button" class="wallet-summary-share"><i class="fa-solid fa-share-from-square" aria-hidden="true"></i> مشاركة</button>',
              '<button type="button" class="wallet-summary-close">إغلاق</button>',
            '</div>',
          '</div>'
        ].join('');
      }

      function buildTransferSummaryShareText(model, item){
        var amount = resolveTransferReceiptAmount(item);
        return [
          'ملخص التحويل',
          'الحالة: تم بنجاح',
          'من حساب: ' + (model.operationKey === 'transfer_out' ? (getWalletAccountLabel() || '-') : (model.transferPeer || '-')),
          'الى المستفيد: ' + (model.operationKey === 'transfer_out' ? (model.transferPeer || '-') : (getWalletAccountLabel() || '-')),
          'المبلغ: ' + amount
        ].join('\n');
      }

      function buildTransactionActionIcon(actionKind){
        var icon = 'fa-solid fa-receipt';
        if (actionKind === 'withdraw') icon = 'fa-solid fa-arrow-right-arrow-left';
        else if (actionKind === 'deposit') icon = 'fa-solid fa-arrow-right-arrow-left';
        else if (actionKind === 'approved') icon = 'fa-solid fa-check';
        else if (actionKind === 'rejected') icon = 'fa-solid fa-xmark';
        else if (actionKind === 'pending') icon = 'fa-solid fa-ellipsis';
        return '<i class="' + icon + '" aria-hidden="true"></i>';
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
        var ts = getItemRawTimeValue(data);
        var shortDate = formatShortDate(ts);
        var longDate = formatDate(ts);
        var status = normStatus((data && (data.status || data.state || data.depositStatus)) || '');
        var isDepositWalletCredit = PAGE_MODE !== 'payments' && kind === 'deposit' && (
          /^(DEP|AUT)/i.test(String(code || '').trim()) ||
          /إيداع|طلب\s*إيداع|إضافة\s*رصيد\s*من\s*الإيداع/i.test([method, titleHint, purchaseName, String(data.description || '')].join(' '))
        );
        var outerSubtitle = '';
        if (PAGE_MODE === 'payments'){
          title = method || titleHint || purchaseName || titleBase;
        } else {
          if (isRefundAction){
            outerSubtitle = resolveRefundCardProductName(data, purchaseName, titleHint, method);
            title = 'استرداد';
          } else if (isDepositWalletCredit){
            title = method || titleHint || 'إضافة رصيد من الإيداع';
          } else if (titleHint){
            title = titleHint;
          } else if (isTransfer && transferTitle){
            title = transferTitle;
          } else if (isPurchase && purchaseName){
            title = purchaseName;
          } else if (isAdminAction && purchaseName){
            title = purchaseName;
          }
        }
        title = fixWalletText(title);
        if (PAGE_MODE === 'payments') {
          title = title.replace(/^\s*طلب\s+(?:إيداع|سحب)\s*\/\s*/i, '').trim() || titleBase;
        }
        var isRejectedDeposit = (kind === 'deposit' && status === 'rejected');
        if (isRejectedDeposit){
          change.className = 'negative';
          change.signSymbol = '';
        }
        if (PAGE_MODE === 'payments' && status === 'pending'){
          change.className = 'neutral';
          change.signSymbol = '';
        }
        var actionKind = isRejectedDeposit ? 'neutral' : (kind === 'withdraw' ? 'withdraw' : 'deposit');
        if (PAGE_MODE === 'payments'){
          actionKind = 'neutral';
        }
        var actionIconHtml = '<i class="fa-solid fa-chevron-down" aria-hidden="true"></i>';
        var codeLabel = code && code !== '-' ? code : '';
        var hideOuterMeta = PAGE_MODE !== 'payments' && isRefundAction;
        var showCode = !!codeLabel && !hideOuterMeta;
        var codePrefix = PAGE_MODE === 'payments'
          ? ''
          : (isTransfer ? 'ID:' : (kind === 'withdraw' ? 'ID:' : 'Payment ID:'));

        var paymentStatusTone = status === 'approved' ? 'approved' : (status === 'rejected' ? 'rejected' : 'pending');
        var balanceAfterToneClass = isRejectedDeposit ? ' is-rejected' : '';
        if (PAGE_MODE === 'payments') {
          balanceAfterToneClass = ' is-' + paymentStatusTone;
        }
        var balancePieces = [];
        var balanceCurrency = 'USD';
        if (balances.before != null) {
          balancePieces.push(
            '<span class="txn-balance-row balance-before">' +
              '<span class="txn-balance-label">قبل</span>' +
              '<span class="txn-balance-value">' + formatBalanceValue(balances.before, balanceCurrency) + '</span>' +
            '</span>'
          );
        }
        if (balances.after != null) {
          balancePieces.push(
            '<span class="txn-balance-row balance-after' + balanceAfterToneClass + '">' +
              '<span class="txn-balance-label">بعد</span>' +
              '<span class="txn-balance-value">' + formatBalanceValue(balances.after, balanceCurrency) + '</span>' +
            '</span>'
          );
        }
        var balancesHtml = balancePieces.length ? '<div class="txn-balances">' + balancePieces.join('') + '</div>' : '';

        var proofUrl = resolveProofUrl(data);
        var proofHtml = proofUrl
          ? '<span class="txn-proof"><a class="code-btn" href="' + escapeHtmlAttr(proofUrl) + '" target="_blank" rel="noopener noreferrer">فتح الصورة</a></span>'
          : '';
        var codeHtml = showCode ? '<span class="txn-code">' + (codePrefix ? escapeHtml(codePrefix) + ' ' : '') + '<button class="code-btn" data-code="' + escapeHtmlAttr(codeLabel) + '">' + escapeHtml(codeLabel) + '</button></span>' : '';
        var dateHtml = (!hideOuterMeta && PAGE_MODE !== 'payments' && shortDate) ? '<span class="txn-date" title="' + escapeHtmlAttr(longDate) + '">' + escapeHtml(shortDate) + '</span>' : '';
        var statusHtml = '';
        var sideStatusHtml = PAGE_MODE === 'payments'
          ? '<div class="txn-status-side ' + paymentStatusTone + '">' + escapeHtml(statusLabel(status)) + '</div>'
          : '';
        var subtitleHtml = (PAGE_MODE !== 'wallet' && outerSubtitle) ? '<div class="txn-subtitle">' + escapeHtml(outerSubtitle) + '</div>' : '';
        var headerHtml = '<div class="txn-head"><div><div class="txn-title">' + escapeHtml(title) + '</div>' + subtitleHtml + '</div>' + statusHtml + '</div>';
        var detailsRow = '';
        var walletDateHtml = '';
        var metaItems = PAGE_MODE === 'wallet'
          ? [walletDateHtml]
          : (PAGE_MODE === 'payments'
            ? [codeHtml]
            : (hideOuterMeta ? [] : [dateHtml, proofHtml, codeHtml]));
        var metaRow = metaItems.filter(Boolean).length
          ? '<div class="txn-meta">' + metaItems.filter(Boolean).join('') + '</div>'
          : '';
        var amountSignText = change.signSymbol === '+' ? '' : (change.signSymbol || '');
        var amountText = (amountSignText + change.numberText) + (change.currency ? ' ' + change.currency : '');

        return [
          '<div class="txn-body">',
            '<div class="txn-amount ', change.className, '">',
              '<div class="txn-value">',
                '<span class="txn-value-text">', escapeHtml(amountText), '</span>',
              '</div>',
              sideStatusHtml,
              balancesHtml,
            '</div>',
            '<div class="txn-middle">',
              headerHtml,
              detailsRow,
              metaRow,
            '</div>',
            '<button type="button" class="txn-action ', actionKind, '" data-wallet-card-toggle aria-label="عرض التفاصيل" aria-expanded="false">',
              '<span class="txn-action-symbol" aria-hidden="true">', actionIconHtml, '</span>',
            '</button>',
          '</div>'
        ].join('');
      }

      function buildPaymentInlineDetailsHtml(item){
        if (PAGE_MODE !== 'payments') return '';
        var data = item && typeof item === 'object' ? item : {};
        var code = getCode(data) || '';
        var status = normStatus((data.status || data.state || data.depositStatus) || '');
        var isRejected = status === 'rejected';
        var isPending = status === 'pending';
        var method = fixWalletText(data.methodName || data.method || data.paymentMethodName || data.methodLabel || '')
          .replace(/^\s*طلب\s+(?:إيداع|سحب)\s*\/\s*/i, '')
          .trim() || 'إيداع';
        var ts = getItemRawTimeValue(data);
        var doneTs = data.statusUpdatedAt || data.status_updated_at || data.reviewedAt || data.reviewed_at || data.completedAt || data.completed_at || data.updatedAt || data.updated_at || '';
        var paidInfo = resolvePaymentPaidAmountInfo(data);
        var amountPaid = paidInfo.amount;
        var paidCurrency = paidInfo.currency || 'USD';
        var amountAdded = pickNumber(data, ['added', 'addedAmount', 'addedUSD', 'amountUSD']);
        var fee = pickNumber(data, ['fee', 'feeAmount', 'feeAmountUSD', 'commission', 'commissionUSD']);
        var proofUrl = resolveProofUrl(data);
        var durationText = '';
        try {
          var directDurationMs = Number(data.executionDurationMs || data.durationMs || 0);
          var startMs = ts ? Date.parse(String(ts)) : 0;
          var endMs = doneTs ? Date.parse(String(doneTs)) : 0;
          if (Number.isFinite(directDurationMs) && directDurationMs > 0) {
            durationText = formatOrderDurationMs(directDurationMs);
          } else if (Number.isFinite(startMs) && Number.isFinite(endMs) && startMs > 0 && endMs > startMs) {
            durationText = formatOrderDurationMs(endMs - startMs);
          }
        } catch (_) {}
        var rows = [];
        if (code) rows.push({ label: 'رمز الطلب', value: code });
        rows.push({ label: 'الحالة', value: statusLabel(status) });
        if (method && !isRejected) rows.push({ label: 'الطريقة', value: method });
        if (ts) rows.push({ label: 'التاريخ', value: formatWalletDetailDate(ts) });
        if (durationText) rows.push({ label: 'مدة التنفيذ', value: durationText });
        if (amountPaid != null) rows.push({ label: 'المبلغ المدفوع', value: formatTransactionDetailAmount(Math.abs(Number(amountPaid) || 0), paidCurrency) });
        if (amountAdded != null && !isRejected) rows.push({ label: isPending ? 'الرصيد الذي سيضاف' : 'الرصيد المضاف', value: formatTransactionDetailAmount(Math.abs(Number(amountAdded) || 0), 'USD') });
        if (fee != null && Math.abs(Number(fee) || 0) > 0) rows.push({ label: 'العمولة', value: formatTransactionDetailAmount(Math.abs(Number(fee) || 0), 'USD') });
        if (proofUrl) rows.push({ label: 'صورة الإثبات', html: '<a href="' + escapeHtmlAttr(proofUrl) + '" target="_blank" rel="noopener noreferrer">فتح الصورة</a>' });
        return '<div class="payment-inline-details">' + rows.map(function(row){
          var valueHtml = row.html || escapeHtml(row.value == null ? '' : row.value);
          return '<p><strong>' + escapeHtml(row.label) + ':</strong> ' + valueHtml + '</p>';
        }).join('') + '</div>';
      }

      function buildWalletInlineDetailsHtml(item){
        if (PAGE_MODE !== 'wallet') return '';
        var data = item && typeof item === 'object' ? item : {};
        var code = getCode(data) || '';
        var operation = resolveWalletOperationMeta(data, data.title || data.serviceName || data.productName || data.name || '');
        var status = normStatus((data.status || data.state || data.depositStatus) || '');
        var ts = getItemRawTimeValue(data);
        var balances = resolveBalances(data);
        var rows = [];
        if (code) rows.push({ label: operation.codeLabel || 'رمز العملية', value: code });
        if (operation.label) rows.push({ label: 'نوع العملية', value: operation.label });
        rows.push({ label: 'الحالة', value: operation.statusText || statusLabel(status) });
        if (operation.methodName) rows.push({ label: 'الطريقة', value: operation.methodName });
        if (operation.countryName) rows.push({ label: 'الدولة', value: operation.countryName });
        if (operation.transferPeer) rows.push({ label: operation.kind === 'withdraw' ? 'إلى' : 'من', value: operation.transferPeer });
        if (ts) rows.push({ label: 'التاريخ', value: formatWalletDetailDate(ts) });
        if (balances.before != null) rows.push({ label: 'الرصيد قبل', value: formatBalanceValue(balances.before, 'USD') });
        if (balances.after != null) rows.push({ label: 'الرصيد بعد', value: formatBalanceValue(balances.after, 'USD') });
        return '<div class="payment-inline-details wallet-inline-details">' + rows.map(function(row){
          return '<p><strong>' + escapeHtml(row.label) + ':</strong> ' + escapeHtml(row.value == null ? '' : row.value) + '</p>';
        }).join('') + '</div>';
      }

      function populateTransactionCard(card, item){
        if (!card || !item) return;
        var wasOpen = !!(card.classList && card.classList.contains('open'));
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
        if (code && code !== '-' && PAGE_MODE !== 'payments' && PAGE_MODE !== 'wallet') card.setAttribute('aria-haspopup', 'dialog');
        else card.removeAttribute('aria-haspopup');
        card.setAttribute('aria-label', code && code !== '-' ? ('عرض تفاصيل الطلب ' + code) : 'طلب مالي');
        try { card.classList.add('wallet-transaction-card'); } catch (_) {}
        card.innerHTML = buildTransactionHTML(copy) + buildWalletInlineDetailsHtml(copy) + buildPaymentInlineDetailsHtml(copy);
        setTransactionCardOpen(card, wasOpen);
      }

      function syncTransactionToggleButton(card){
        if (!card || !card.querySelector) return;
        var btn = card.querySelector('[data-wallet-card-toggle]');
        if (!btn) return;
        btn.setAttribute('aria-expanded', card.classList && card.classList.contains('open') ? 'true' : 'false');
      }

      function setTransactionCardOpen(card, open){
        if (!card || !card.classList) return;
        card.classList.toggle('open', !!open);
        syncTransactionToggleButton(card);
      }

      function renderDeposits(items){
        if (PAGE_MODE === 'wallet' || PAGE_MODE === 'payments'){
          renderWalletItemsInto(listEl, items, { grouped: true, emptyText: getWalletEmptyTextForCurrentFilters() });
          if (!items.length) closeTransactionDetailsModal();
          return;
        }
        listEl.innerHTML = '';
        if (!items.length) { showEmpty(); return; }
        items.forEach(function(it){
          var card = document.createElement('div');
          card.className = 'card';
          populateTransactionCard(card, it);
          listEl.appendChild(card);
        });
      }

      function renderWalletItemsInto(target, items, options){
        if (!target) return;
        var opts = options && typeof options === 'object' ? options : {};
        var list = Array.isArray(items) ? items : [];
        target.innerHTML = '';
        if (!list.length) {
          var emptyText = String(opts.emptyText || 'لا توجد عناصر').trim() || 'لا توجد عناصر';
          target.innerHTML = '<div class="wallet-empty-state" role="status" aria-live="polite"><i class="fa-solid fa-inbox" aria-hidden="true"></i><span>' + escapeHtml(emptyText) + '</span></div>';
          return;
        }
        if (PAGE_MODE === 'wallet' || PAGE_MODE === 'payments'){
          var currentGroup = '';
          list.forEach(function(it){
            var ms = getItemTimeMs(it);
            var label = ms ? getWalletGroupLabel(ms) : 'بدون تاريخ';
            if (opts.grouped !== false && label !== currentGroup){
              currentGroup = label;
              var group = document.createElement('div');
              group.className = 'wallet-date-group';
              group.textContent = label;
              target.appendChild(group);
            }
            var card = document.createElement('div');
            card.className = 'card';
            populateTransactionCard(card, it);
            target.appendChild(card);
          });
          return;
        }
        list.forEach(function(it){
          var card = document.createElement('div');
          card.className = 'card';
          populateTransactionCard(card, it);
          target.appendChild(card);
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
        const sorted = sortByNewest((arr || []).filter(hasItemDisplayTime));
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
        return sortByNewest(arr.filter(hasItemDisplayTime));
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
        var createdValue = getItemRawTimeValue(item);
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
          const ta = getItemTimeMs(a);
          const tb = getItemTimeMs(b);
          if (tb !== ta) return tb - ta;
          const ao = Number(a && a.__entryOrder);
          const bo = Number(b && b.__entryOrder);
          if (Number.isFinite(ao) && Number.isFinite(bo) && ao !== bo) return bo - ao;
          return String(getItemCacheKey(b) || getCode(b) || '').localeCompare(String(getItemCacheKey(a) || getCode(a) || ''));
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
          const created = getItemTimeMs(item);
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
      // Pending optimistic purchases: a just-placed order is surfaced in "حركاتي"
      // immediately and kept until the server list reports the same code (then it is
      // dropped as confirmed) or it ages out. This survives the revalidation that
      // would otherwise drop it while the orders list query hasn't caught up yet.
      var PENDING_OPTIMISTIC = Object.create(null); // codeUpper -> { item, atMs }
      var PENDING_OPTIMISTIC_TTL_MS = 90000;
      function noteOptimisticOrderItem(item){
        try {
          var code = String(getCode(item) || '').trim().toUpperCase();
          if (code) PENDING_OPTIMISTIC[code] = { item: item, atMs: Date.now() };
        } catch(_){ }
      }
      function mergePendingOptimistic(list){
        var arr = Array.isArray(list) ? list.slice() : [];
        var codes = Object.keys(PENDING_OPTIMISTIC);
        if (!codes.length) return arr;
        var now = Date.now();
        var present = Object.create(null);
        arr.forEach(function(it){ var c = String(getCode(it) || '').trim().toUpperCase(); if (c) present[c] = true; });
        codes.forEach(function(code){
          var rec = PENDING_OPTIMISTIC[code];
          if (!rec || (now - rec.atMs) > PENDING_OPTIMISTIC_TTL_MS) { delete PENDING_OPTIMISTIC[code]; return; }
          if (present[code]) { delete PENDING_OPTIMISTIC[code]; return; } // server confirmed → drop optimistic
          arr.unshift(rec.item);
        });
        return arr;
      }
      function displayItems(uid, items){
        ALL_ITEMS = sortByNewest((mergePendingOptimistic(items) || []).filter(hasItemDisplayTime)).map(function(item){
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
          if (PAGE_MODE === 'wallet') mountWalletSubpage(TRANSACTION_DETAILS_MODAL);
          return TRANSACTION_DETAILS_MODAL;
        }

        var overlay = document.createElement('div');
        overlay.className = 'wallet-history-modal';
        overlay.id = 'wallet-history-modal-' + PAGE_MODE;
        overlay.setAttribute('role', PAGE_MODE === 'wallet' ? 'region' : 'dialog');
        overlay.setAttribute('aria-modal', PAGE_MODE === 'wallet' ? 'false' : 'true');
        overlay.setAttribute('tabindex', '-1');
        overlay.innerHTML = [
          '<div class="wallet-history-modal-card" role="document">',
            '<div class="wallet-receipt-head">',
              '<span></span>',
              '<div><h3 class="wallet-history-modal-title"></h3></div>',
              '<button type="button" class="wallet-history-modal-close" aria-label="إغلاق التفاصيل"><i class="fa-solid fa-arrow-right" aria-hidden="true"></i></button>',
            '</div>',
            '<div class="wallet-history-modal-kicker"></div>',
            '<p class="wallet-history-modal-subtitle"></p>',
            '<div class="wallet-history-modal-badges"></div>',
            '<div class="wallet-history-modal-loading"></div>',
            '<div class="wallet-history-modal-summary"></div>',
            '<div class="wallet-history-modal-sections"></div>',
          '</div>'
        ].join('');

        overlay.addEventListener('click', function(ev){
          if (ev.target === overlay) closeTransactionDetailsModal();
          var confirmBtn = ev.target && ev.target.closest ? ev.target.closest('.wallet-receipt-primary') : null;
          if (confirmBtn) {
            ev.preventDefault();
            closeTransactionDetailsModal();
          }
          var closeSummaryBtn = ev.target && ev.target.closest ? ev.target.closest('.wallet-summary-close') : null;
          if (closeSummaryBtn) {
            ev.preventDefault();
            closeTransactionDetailsModal();
          }
          var shareBtn = ev.target && ev.target.closest ? ev.target.closest('.wallet-summary-share') : null;
          if (shareBtn) {
            ev.preventDefault();
            var text = String(overlay.__shareText || '').trim();
            if (!text) return;
            if (navigator.share) {
              navigator.share({ title: 'ملخص التحويل', text: text }).catch(function(){});
              return;
            }
            if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).catch(function(){});
          }
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

        if (PAGE_MODE === 'wallet') mountWalletSubpage(overlay);
        else document.body.appendChild(overlay);
        TRANSACTION_DETAILS_MODAL = overlay;
        return overlay;
      }

      function closeTransactionDetailsModal(){
        if (!TRANSACTION_DETAILS_MODAL) return;
        TRANSACTION_DETAILS_REQUEST_TOKEN = '';
        TRANSACTION_DETAILS_MODAL.classList.remove('show');
        if (PAGE_MODE === 'wallet' && !hasOpenWalletSubpage()) setWalletSubpageActive(false);
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
        if (PAGE_MODE === 'wallet') {
          closeWalletSearchModal();
          closeWalletFilterModal();
          mountWalletSubpage(modal);
        }
        var model = buildTransactionDetailsModel(item, card);
        var opts = options && typeof options === 'object' ? options : {};
        var isTransferSummary = PAGE_MODE === 'wallet' && model.isTransfer === true;
        var sectionsHtml = isTransferSummary
          ? renderTransferSummaryContent(model, item)
          : (PAGE_MODE === 'wallet'
            ? renderReceiptRows(model)
            : [
                renderTransactionDetailSection(model.basicSectionTitle || 'بيانات الطلب', model.basic),
                renderTransactionDetailSection('بيانات المستلم', model.payout),
                renderTransactionDetailSection('جهات التحويل', model.transfers),
                renderTransactionDetailSection('الحقول الإضافية', model.extra)
              ].filter(Boolean).join(''));

        if (refs.kicker) refs.kicker.textContent = model.kicker;
        if (refs.title) refs.title.textContent = isTransferSummary ? 'ملخص' : (PAGE_MODE === 'wallet' ? 'تفاصيل المعاملة' : model.title);
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
        if (refs.summary) refs.summary.innerHTML = isTransferSummary
          ? renderTransferSummaryHeader(model)
          : (PAGE_MODE === 'wallet'
            ? renderReceiptSummary(model, item)
            : renderTransactionSummaryCards(model.summary));
        modal.__shareText = isTransferSummary ? buildTransferSummaryShareText(model, item) : '';
        if (refs.sections){
          refs.sections.innerHTML = sectionsHtml || '<div class="wallet-history-modal-empty">' + escapeHtml(model.emptyText || 'لا توجد تفاصيل إضافية متاحة لهذه العملية.') + '</div>';
        }

        if (!modal.classList.contains('show')){
          TRANSACTION_DETAILS_LAST_FOCUS = document.activeElement;
        }
        modal.classList.add('show');
        if (PAGE_MODE === 'wallet') setWalletSubpageActive(true);
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
        if (PAGE_MODE === 'payments' || PAGE_MODE === 'wallet') {
          setTransactionCardOpen(card, !card.classList.contains('open'));
          return;
        }
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
        listEl.querySelectorAll('.card.open').forEach(function(el){
          if (el !== card) setTransactionCardOpen(el, false);
        });
        card.classList.add('selected');
        setTransactionCardOpen(card, true);
        try { LAST_CODE_MEMORY[LAST_CODE_PREFIX + uid] = itemKey || code; } catch (_) {}

        openTransactionDetailsModal(card, currentItem, { loading: true });
        var requestToken = (itemKey || code) + ':' + Date.now();
        TRANSACTION_DETAILS_REQUEST_TOKEN = requestToken;

        var finalItem = currentItem;
        try{
          var fresh = await fetchSingleRequestForUser(uid, code, PAGE_MODE === 'wallet' ? (itemKey || knownKind) : knownKind);
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
              const ta = getItemTimeMs(a);
              const tb = getItemTimeMs(b);
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
                const ta = getItemTimeMs(a);
                const tb = getItemTimeMs(b);
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
              const taMs = getItemTimeMs(a);
              const tbMs = getItemTimeMs(b);
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
                const taMs = getItemTimeMs(a);
                const tbMs = getItemTimeMs(b);
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
          if (!hasItemDisplayTime(item)) return;
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
          return await fetchWalletTransactionsFromServer(uid, { limit: 1000 });
        }catch(err){
          console.warn('fetchWalletTransactionsFromServer failed', err);
          return [];
        }
      }
      async function fetchSingleRequestForUser(uid, code, preferredKind){
        if (PAGE_MODE === 'wallet'){
          try{
            var preferred = String(preferredKind || '').trim();
            var serverItems = await fetchWalletTransactionsFromServer(uid, {
              code: code,
              entryKey: preferred && preferred !== 'deposit' && preferred !== 'withdraw' ? preferred : ''
            });
            if (serverItems && serverItems.length) return serverItems[0];
          }catch(_){ }
          return null;
        }
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
            readField(flat,'created_at');
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
          var genericWithdrawMethod = /تحويل\s*إلى\s*(مستلم|مستخدم|-|أ¢â‚¬â€‌)?\s*$/;
          var genericDepositMethod = /تحويل\s*من\s*(مرسل|مستخدم|-|أ¢â‚¬â€‌)?\s*$/;
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

      // Build a wallet "purchase" movement from a customer order. Wallet purchase
      // rows are no longer written on the purchase path (for checkout speed); the
      // wallet derives them from the user's orders when the page is opened.
      function buildWalletItemFromOrder(order){
        if (!order || typeof order !== 'object') return null;
        var code = String(order.code || '').trim();
        if (!code) return null;
        var priv = order.__priv && typeof order.__priv === 'object' ? order.__priv : {};
        var total = pickNumber(order, ['total', 'totalUSD', 'totalStr', 'amount', 'amountUSD']);
        if (total == null) total = pickNumber(order.__pub || {}, ['total', 'totalStr', 'amount']);
        if (total == null) total = pickNumber(priv, ['total', 'amount']);
        var amount = Math.abs(Number(total) || 0);
        if (!(amount > 0)) return null;
        var rawName = order.title || priv.serviceName || order.serviceName || order.productName || order.game || '';
        var name = fixWalletText(String(rawName == null ? '' : rawName)).trim() || 'شراء';
        // Date MUST come ONLY from order.timestamp — the exact field the orders page
        // renders — so the wallet date always matches it. Do NOT fall back to
        // createdAt/date here: some orders carry a corrupt createdAt (observed
        // year-2034) and getItemRawTimeValue reads createdAt FIRST, which is how that
        // 2034 leaks into the wallet card/modal. On any missing/garbage/out-of-range
        // value, keep the row VISIBLE dated "now" instead of dropping it or showing
        // a future date. (1262304000000 = 2010-01-01.)
        var nowMs = Date.now();
        var orderMs = (typeof getOrderTimeMs === 'function') ? getOrderTimeMs(order) : 0;
        if (!orderMs || !isFinite(orderMs) || orderMs > nowMs + 86400000 || orderMs < 1262304000000) {
          orderMs = nowMs;
        }
        var createdAt = new Date(orderMs).toISOString();
        return {
          code: code,
          kind: 'withdraw',
          __kind: 'withdraw',
          entryType: 'purchase',
          // The deduction itself completed when the order was placed; a rejected
          // order's refund shows as its own (+) ledger movement, so the purchase
          // row stays "completed" rather than inheriting the order status.
          status: 'completed',
          amount: amount,
          amountUSD: amount,
          debited: amount,
          debitedUSD: amount,
          currency: 'USD',
          title: name,
          serviceName: name,
          productName: name,
          methodName: name,
          description: name,
          createdAt: createdAt,
          __derivedFromOrder: true
        };
      }

      async function fetchWalletOrderMovements(uid){
        if (PAGE_MODE !== 'wallet') return [];
        var safeUid = String(uid || '').trim();
        // Reuse the orders page's proven fetch (correct worker base + session auth
        // + refresh). It is a top-level global; fall back to a direct client-orders
        // request only if it is not reachable from this scope.
        try{
          if (typeof fetchOrdersFromServer === 'function'){
            var primary = await fetchOrdersFromServer(safeUid, { limit: 1000 });
            return (Array.isArray(primary) ? primary : []).map(buildWalletItemFromOrder).filter(Boolean);
          }
        }catch(_){ /* fall through to direct request */ }
        try{
          var authCtx = await resolveWalletAuthContext(auth.currentUser);
          var reqUid = safeUid || String((authCtx && authCtx.uid) || '').trim();
          if (!reqUid || !authCtx || !authCtx.sessionKey) return [];
          var requestUrl;
          try{
            var workerBase = window.__getSiteWorkerBaseDefault
              ? String(window.__getSiteWorkerBaseDefault({ trailingSlash: true }) || '').trim()
              : '';
            requestUrl = workerBase ? new URL(workerBase) : new URL('/', window.location.href);
          }catch(_){ requestUrl = new URL('/', window.location.href); }
          requestUrl.searchParams.set('action', 'pru');
          requestUrl.searchParams.set('mode', 'client-orders');
          requestUrl.searchParams.set('useruid', reqUid);
          requestUrl.searchParams.set('sessionKey', authCtx.sessionKey);
          requestUrl.searchParams.set('limit', '1000');
          requestUrl.searchParams.set('_', String(Date.now()));
          var response = await fetch(requestUrl.toString(), { method: 'GET', cache: 'no-store' });
          var payload = await response.json().catch(function(){ return {}; });
          if (!response.ok || !payload || payload.ok === false) return [];
          var list = Array.isArray(payload.orders)
            ? payload.orders
            : (payload.byCode && typeof payload.byCode === 'object'
              ? Object.keys(payload.byCode).map(function(k){ return payload.byCode[k]; })
              : []);
          return list.map(buildWalletItemFromOrder).filter(Boolean);
        }catch(_){ return []; }
      }

      async function fetchAllTransactions(uid){
        if (PAGE_MODE === 'payments') {
          return fetchPaymentsFromServer(uid);
        }
        var results = await Promise.all([
          fetchTransfers(uid),
          fetchWalletOrderMovements(uid)
        ]);
        var transfers = Array.isArray(results[0]) ? results[0] : [];
        var orderMovements = Array.isArray(results[1]) ? results[1] : [];
        var list = transfers.slice();
        if (orderMovements.length){
          var seen = {};
          list.forEach(function(it){ var c = String(getCode(it) || '').trim().toUpperCase(); if (c) seen[c] = true; });
          orderMovements.forEach(function(mv){
            var c = String(getCode(mv) || '').trim().toUpperCase();
            if (c && seen[c]) return;
            list.push(mv);
          });
        }
        return sortByNewest(list);
      }

      async function fetchAllPayments(uid){
        return fetchPaymentsFromServer(uid);
      }

      function normalizeWalletApiBase(value){
        var raw = String(value == null ? '' : value).trim();
        if (!raw) return '';
        try {
          if (window.__normalizeSiteWorkerBase) {
            var normalized = String(window.__normalizeSiteWorkerBase(raw) || '').trim();
            if (normalized) return normalized.replace(/\/+$/, '') + '/';
          }
        } catch(_){ }
        try {
          var parsed = new URL(raw, window.location.href);
          if (!/^https?:$/i.test(parsed.protocol)) return '';
          parsed.search = '';
          parsed.hash = '';
          return parsed.toString().replace(/\/+$/, '') + '/';
        } catch(_){ return ''; }
      }

      function getWalletApiBase(){
        var candidates = [];
        try { if (window.__getSiteWorkerBase) candidates.push(window.__getSiteWorkerBase({ trailingSlash: true, allowStorageOverride: true })); } catch(_){ }
        try { if (window.__getSiteWorkerBaseDefault) candidates.push(window.__getSiteWorkerBaseDefault({ trailingSlash: true })); } catch(_){ }
        try {
          candidates.push(
            window.API_BASE_URL,
            window.__API_BASE__,
            window.API_BASE,
            document.documentElement && document.documentElement.getAttribute('data-api-base')
          );
        } catch(_){ }
        try {
          candidates.push(
            localStorage.getItem('MANWAL_ROUTER_BASE'),
            localStorage.getItem('apiBase'),
            localStorage.getItem('workerBase')
          );
        } catch(_){ }
        try { candidates.push(window.__getSiteSetting ? window.__getSiteSetting('workers.routerBase', '') : ''); } catch(_){ }
        for (var i = 0; i < candidates.length; i += 1) {
          var base = normalizeWalletApiBase(candidates[i]);
          if (base) return base;
        }
        return normalizeWalletApiBase(window.location.origin + '/');
      }

      function readWalletJsonStorage(key){
        try {
          var raw = localStorage.getItem(key) || sessionStorage.getItem(key);
          return raw ? JSON.parse(raw) : null;
        } catch(_){ return null; }
      }

      function readWalletSessionContext(uid){
        var wantedUid = String(uid || '').trim();
        var candidates = [];
        function pushCandidate(item){ if (item && typeof item === 'object') candidates.push(item); }
        pushCandidate(readWalletJsonStorage('sessionKeyInfo'));
        pushCandidate(readWalletJsonStorage('postLoginPayload'));
        try {
          var bundleKey = String(window.__AUTH_SESSION_BUNDLE_STORAGE_KEY__ || 'auth:session:bundle:v1');
          var bundle = readWalletJsonStorage(bundleKey);
          if (bundle && typeof bundle === 'object') {
            pushCandidate(bundle.sessionKeyInfo);
            pushCandidate(bundle.postLoginPayload);
          }
        } catch(_){ }
        try { pushCandidate(window.__AUTH_LAST_USER__); } catch(_){ }
        for (var i = 0; i < candidates.length; i += 1) {
          var item = candidates[i] || {};
          var itemUid = String(item.uid || item.useruid || item.userUid || item.user_id || '').trim();
          if (wantedUid && itemUid && itemUid !== wantedUid) continue;
          var sessionKey = String(item.sessionKey || item.session_key || item.sessionkey || '').trim();
          if (sessionKey) return { uid: itemUid || wantedUid, sessionKey: sessionKey, deviceId: String(item.deviceId || item.device_id || '').trim() };
        }
        return { uid: wantedUid, sessionKey: '', deviceId: '' };
      }

      function resolveWalletLoadUser(candidate){
        var activeUser = candidate || auth.currentUser || null;
        if (activeUser && String(activeUser.uid || '').trim()) return activeUser;
        var session = readWalletSessionContext('');
        var sessionUid = String(session && session.uid || '').trim();
        var sessionKey = String(session && session.sessionKey || '').trim();
        if (sessionUid && sessionKey) return { uid: sessionUid };
        return null;
      }

      function waitForWalletLoadUser(candidate, timeoutMs){
        var immediate = resolveWalletLoadUser(candidate);
        if (immediate) return Promise.resolve(immediate);
        var waitMs = Math.max(250, Math.min(8000, Number(timeoutMs) || 3500));
        if (!auth || typeof auth.onAuthStateChanged !== 'function') return Promise.resolve(null);
        return new Promise(function(resolve){
          var done = false;
          var timer = 0;
          var unsubscribe = null;
          function finish(user){
            if (done) return;
            done = true;
            try { if (timer) clearTimeout(timer); } catch(_){ }
            try { if (typeof unsubscribe === 'function') unsubscribe(); } catch(_){ }
            resolve(resolveWalletLoadUser(user));
          }
          try {
            unsubscribe = auth.onAuthStateChanged(function(user){
              finish(user || null);
            }, function(){
              finish(null);
            });
          } catch(_){
            finish(null);
            return;
          }
          try {
            timer = setTimeout(function(){
              finish(resolveWalletLoadUser());
            }, waitMs);
          } catch(_){ }
        });
      }

      async function buildWalletServerAuthContext(uid, forceToken){
        var wantedUid = String(uid || '').trim();
        var user = auth.currentUser || null;
        var userUid = String(user && user.uid || '').trim();
        var session = readWalletSessionContext(wantedUid || userUid);
        var resolvedUid = String(wantedUid || session.uid || userUid || '').trim();
        var idToken = '';
        if (user && typeof user.getIdToken === 'function') {
          try { idToken = String(await user.getIdToken(!!forceToken) || '').trim(); }
          catch(_){ if (!forceToken) { try { idToken = String(await user.getIdToken(true) || '').trim(); } catch(__){ } } }
        }
        return { user: user, uid: resolvedUid, sessionKey: String(session.sessionKey || '').trim(), deviceId: String(session.deviceId || '').trim(), idToken: idToken };
      }

      function buildWalletServerHeaders(authContext){
        return {};
      }

      async function refreshWalletSessionOnce(authContext){
        try {
          var user = authContext && authContext.user ? authContext.user : auth.currentUser;
          if (!user || typeof user.getIdToken !== 'function' || typeof window.__syncCatalogAuthFromToken !== 'function') return null;
          var freshToken = String(await user.getIdToken(true) || '').trim();
          if (!freshToken) return null;
          var basePayload = Object.assign({}, readWalletJsonStorage('postLoginPayload') || {}, {
            uid: String(authContext && authContext.uid || user.uid || '').trim(),
            idToken: freshToken,
            token: freshToken,
            sessionKey: String(authContext && authContext.sessionKey || '').trim(),
            session_key: String(authContext && authContext.sessionKey || '').trim(),
            deviceId: String(authContext && authContext.deviceId || '').trim()
          });
          var synced = await window.__syncCatalogAuthFromToken(freshToken, basePayload);
          if (!synced || !synced.sessionKey) return null;
          return buildWalletServerAuthContext(String(synced.uid || basePayload.uid || ''), false);
        } catch(_){ return null; }
      }

      function isWalletSessionRejectedPayload(data, res){
        var code = String(data && (data.error_code || data.errorCode || data.code) || '').trim().toLowerCase();
        if (code === 'session_required' || code === 'session_invalid' || code === 'session_expired') return true;
        var text = String(data && (data.message || data.error) || '').trim();
        return Number(res && res.status || 0) === 401 && /session|الجلسة|رمز الجلسة/i.test(text);
      }

      function buildPaymentsApiUrl(params){
        var url = new URL(getWalletApiBase(), window.location.href);
        url.search = '';
        url.hash = '';
        url.searchParams.set('action', 'pru');
        url.searchParams.set('mode', 'client-payments');
        Object.keys(params || {}).forEach(function(key){
          var text = String(params[key] == null ? '' : params[key]).trim();
          if (text) url.searchParams.set(key, text);
        });
        return url.toString();
      }

      // The "أكمل رقم هاتفك" form opened when the server reports a missing required
      // field (account-info → needsInput:true, missingFields:["phone"]). Self-contained
      // — injects its own styles + builds the modal lazily, so no template/CSS files
      // need to change. POSTs to mode=account-save-phone; the backend writes D1 and
      // (pre-cutover) mirrors Firestore.
      function ensureMissingPhoneStyles(){
        if (document.getElementById('account-missing-phone-style')) return;
        var style = document.createElement('style');
        style.id = 'account-missing-phone-style';
        style.textContent = [
          '#accountMissingPhoneModal{position:fixed;inset:0;background:rgba(8,12,28,.62);display:flex;align-items:center;justify-content:center;z-index:99999;padding:18px;backdrop-filter:blur(4px);}',
          '#accountMissingPhoneModal.is-hidden{display:none;}',
          '#accountMissingPhoneModal .amp-card{width:min(100%,420px);background:var(--surface,#fff);color:var(--text,#1b1d3b);border-radius:22px;padding:24px 22px;box-shadow:0 24px 60px rgba(8,12,28,.45);display:flex;flex-direction:column;gap:14px;border:1px solid rgba(94,113,216,.18);}',
          'body.dark-mode #accountMissingPhoneModal .amp-card,html[data-theme="dark"] #accountMissingPhoneModal .amp-card{background:#11142a;color:#f0f1ff;border-color:rgba(120,140,220,.22);}',
          '#accountMissingPhoneModal .amp-title{margin:0;font-size:1.15rem;font-weight:900;line-height:1.4;text-align:center;}',
          '#accountMissingPhoneModal .amp-desc{margin:0;font-size:.92rem;line-height:1.7;color:var(--muted,#65687a);text-align:center;}',
          'body.dark-mode #accountMissingPhoneModal .amp-desc,html[data-theme="dark"] #accountMissingPhoneModal .amp-desc{color:#a7abc7;}',
          '#accountMissingPhoneModal .amp-input{width:100%;height:52px;border-radius:14px;border:1px solid rgba(94,113,216,.28);background:rgba(255,255,255,.65);padding:0 16px;font-size:1.05rem;font-weight:700;direction:ltr;text-align:left;letter-spacing:.04em;color:inherit;}',
          'body.dark-mode #accountMissingPhoneModal .amp-input,html[data-theme="dark"] #accountMissingPhoneModal .amp-input{background:rgba(10,14,30,.6);border-color:rgba(120,140,220,.28);}',
          '#accountMissingPhoneModal .amp-input:focus-visible{outline:none;box-shadow:0 0 0 3px rgba(94,113,216,.35);}',
          '#accountMissingPhoneModal .amp-err{min-height:18px;font-size:.85rem;color:#dc2626;text-align:center;font-weight:700;}',
          '#accountMissingPhoneModal .amp-actions{display:grid;gap:10px;margin-top:4px;}',
          '#accountMissingPhoneModal .amp-btn{min-height:48px;border-radius:14px;font-size:1rem;font-weight:800;border:0;cursor:pointer;}',
          '#accountMissingPhoneModal .amp-btn-primary{background:#202a49;color:#fff;}',
          '#accountMissingPhoneModal .amp-btn-primary:disabled{background:#9ea1b2;cursor:not-allowed;}',
          '#accountMissingPhoneModal .amp-btn-ghost{background:transparent;color:var(--muted,#65687a);border:1px solid rgba(148,163,184,.32);}',
          'body.dark-mode #accountMissingPhoneModal .amp-btn-ghost,html[data-theme="dark"] #accountMissingPhoneModal .amp-btn-ghost{color:#a7abc7;border-color:rgba(120,140,220,.28);}'
        ].join('');
        document.head.appendChild(style);
      }

      window.__promptAccountMissingPhone = function(uid, missingFields){
        var safeUid = String(uid || '').trim();
        if (!safeUid) return;
        // Don't open twice and don't pester the user within a single page lifetime.
        if (document.getElementById('accountMissingPhoneModal')) return;
        if (window.__accountMissingPhonePrompted) return;
        window.__accountMissingPhonePrompted = true;

        ensureMissingPhoneStyles();

        var modal = document.createElement('div');
        modal.id = 'accountMissingPhoneModal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.innerHTML = [
          '<div class="amp-card">',
          '  <h3 class="amp-title">أكمل رقم هاتفك</h3>',
          '  <p class="amp-desc">نحتاج رقم هاتفك لإكمال طلبات الدعم والشحن. أدخل الرقم مع رمز الدولة.</p>',
          '  <input class="amp-input" type="tel" inputmode="tel" autocomplete="tel" placeholder="مثال: +9647xxxxxxxx" />',
          '  <div class="amp-err" aria-live="polite"></div>',
          '  <div class="amp-actions">',
          '    <button type="button" class="amp-btn amp-btn-primary">حفظ</button>',
          '    <button type="button" class="amp-btn amp-btn-ghost">لاحقاً</button>',
          '  </div>',
          '</div>'
        ].join('');
        document.body.appendChild(modal);

        var input = modal.querySelector('.amp-input');
        var errEl = modal.querySelector('.amp-err');
        var saveBtn = modal.querySelector('.amp-btn-primary');
        var skipBtn = modal.querySelector('.amp-btn-ghost');
        var prevOverflow = document.body && document.body.style.overflow;
        if (document.body) document.body.style.overflow = 'hidden';
        setTimeout(function(){ try { input && input.focus(); } catch(_){} }, 60);

        function close(){
          try { modal.remove(); } catch(_){ if (modal.parentNode) modal.parentNode.removeChild(modal); }
          if (document.body) document.body.style.overflow = prevOverflow || '';
        }

        skipBtn.addEventListener('click', close);
        modal.addEventListener('click', function(ev){ if (ev.target === modal) close(); });

        async function submit(){
          if (saveBtn.disabled) return;
          errEl.textContent = '';
          var value = String(input.value || '').trim();
          // Local pre-check mirrors the server (7–20 digits, optional +).
          var digits = value.replace(/\D+/g, '');
          if (!value || digits.length < 7 || digits.length > 20) {
            errEl.textContent = 'رقم الهاتف غير صالح. أدخل أرقاماً فقط (7–20 رقماً).';
            try { input.focus(); } catch(_){}
            return;
          }
          saveBtn.disabled = true;
          saveBtn.textContent = 'جاري الحفظ...';
          try {
            var authContext = await buildWalletServerAuthContext(safeUid, false);
            if (!authContext || !authContext.sessionKey) {
              var refreshed = await refreshWalletSessionOnce(authContext);
              if (refreshed && refreshed.sessionKey) authContext = refreshed;
            }
            if (!authContext || !authContext.sessionKey) {
              errEl.textContent = 'انتهت الجلسة، أعد تسجيل الدخول.';
              saveBtn.disabled = false;
              saveBtn.textContent = 'حفظ';
              return;
            }
            var u = new URL(getWalletApiBase(), window.location.href);
            u.search = ''; u.hash = '';
            u.searchParams.set('action', 'pru');
            u.searchParams.set('mode', 'account-save-phone');
            u.searchParams.set('useruid', String(authContext.uid || safeUid).trim());
            u.searchParams.set('sessionKey', authContext.sessionKey);
            var res = await fetch(u.toString(), {
              method: 'POST',
              cache: 'no-store',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ phone: value })
            });
            var data = await res.json().catch(function(){ return {}; });
            if (!res.ok || data.ok === false) {
              errEl.textContent = String(data && (data.error || data.message) || 'تعذر حفظ الرقم. حاول لاحقاً.');
              saveBtn.disabled = false;
              saveBtn.textContent = 'حفظ';
              return;
            }
            // Best-effort UI update — the account screen reads its own state from
            // refs, so reflect the saved value before closing.
            try {
              var phoneRefs = document.querySelectorAll('[data-account-field="phone"], #accountPhone, [data-field="phone"]');
              phoneRefs.forEach(function(el){ if (el) el.textContent = data.phone || value; });
            } catch(_){}
            try { if (typeof window.showToast === 'function') window.showToast('تم حفظ رقم الهاتف.', true); } catch(_){}
            close();
          } catch (e) {
            errEl.textContent = 'تعذر حفظ الرقم. حاول لاحقاً.';
            saveBtn.disabled = false;
            saveBtn.textContent = 'حفظ';
          }
        }

        saveBtn.addEventListener('click', submit);
        input.addEventListener('keydown', function(ev){
          if (ev.key === 'Enter') { ev.preventDefault(); submit(); }
          if (ev.key === 'Escape') { ev.preventDefault(); close(); }
        });
      };

      // Global so any screen/closure can read the account (balance + settings) from
      // the server using these same session helpers. Returns the server payload, or
      // null on any failure (the caller then falls back to Firebase).
      window.__fetchAccountInfoFromServer = async function(uid){
        var safeUid = String(uid || '').trim();
        if (!safeUid) return null;
        try {
          var authContext = await buildWalletServerAuthContext(safeUid, false);
          if (!authContext || !authContext.sessionKey) {
            var refreshed = await refreshWalletSessionOnce(authContext);
            if (refreshed && refreshed.sessionKey) authContext = refreshed;
          }
          if (!authContext || !authContext.sessionKey) return null;
          var buildUrl = function(ctx){
            var u = new URL(getWalletApiBase(), window.location.href);
            u.search = ''; u.hash = '';
            u.searchParams.set('action', 'pru');
            u.searchParams.set('mode', 'account-info');
            u.searchParams.set('useruid', String(ctx && ctx.uid || safeUid).trim());
            if (ctx && ctx.sessionKey) u.searchParams.set('sessionKey', ctx.sessionKey);
            return u.toString();
          };
          var send = async function(ctx){
            var res = await fetch(buildUrl(ctx), { method: 'GET', cache: 'no-store' });
            var data = await res.json().catch(function(){ return {}; });
            return { res: res, data: data };
          };
          var r = await send(authContext);
          if ((!r.res.ok || r.data.ok === false) && isWalletSessionRejectedPayload(r.data, r.res)) {
            var ref = await refreshWalletSessionOnce(authContext);
            if (ref && ref.sessionKey) { authContext = ref; r = await send(authContext); }
          }
          if (!r.res.ok || r.data.ok === false) return null;
          return r.data;
        } catch (_) { return null; }
      };

      async function fetchPaymentsFromServer(uid){
        var safeUid = String(uid || '').trim();
        if (!safeUid) return [];
        var authContext = await buildWalletServerAuthContext(safeUid, false);
        if (!authContext.sessionKey) {
          var refreshed = await refreshWalletSessionOnce(authContext);
          if (refreshed && refreshed.sessionKey) authContext = refreshed;
        }
        if (!authContext.sessionKey) throw new Error('رمز الجلسة غير متوفر. سجّل الدخول مرة أخرى ثم أعد المحاولة.');
        var send = async function(nextAuthContext){
          var requestUid = String(nextAuthContext && nextAuthContext.uid || safeUid).trim();
          var params = { useruid: requestUid, limit: 1000 };
          if (nextAuthContext && nextAuthContext.sessionKey) params.sessionKey = nextAuthContext.sessionKey;
          var res = await fetch(buildPaymentsApiUrl(params), {
            method: 'GET',
            cache: 'no-store'
          });
          var data = await res.json().catch(function(){ return {}; });
          return { res: res, data: data };
        };
        var result = await send(authContext);
        var res = result.res;
        var data = result.data;
        if ((!res.ok || data.success === false || data.ok === false) && isWalletSessionRejectedPayload(data, res)) {
          var refreshedAgain = await refreshWalletSessionOnce(authContext);
          if (refreshedAgain && refreshedAgain.sessionKey) {
            authContext = refreshedAgain;
            result = await send(authContext);
            res = result.res;
            data = result.data;
          }
        }
        if (!res.ok || data.success === false || data.ok === false) {
          throw new Error(data.error || data.message || 'تعذر تحميل دفعاتك من الخادم.');
        }
        var wallet = (data.wallet && typeof data.wallet === 'object') ? data.wallet : {};
        var items = Array.isArray(wallet.items)
          ? wallet.items
          : (Array.isArray(data.items) ? data.items : (Array.isArray(data.transactions) ? data.transactions : []));
        return sortByNewest(mergeByCode(items));
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
        if (PAGE_MODE === 'wallet') return Array.isArray(arr) ? arr.slice() : [];
        if (CURRENT_FILTER === 'all') return arr.slice();
        return arr.filter(function(item){ return normStatus((item && (item.status || item.state || item.depositStatus)) || '') === CURRENT_FILTER; });
      }

      async function loadWalletFor(user, opts = {}){
        const loadUser = resolveWalletLoadUser(user);
        if (!loadUser){ showRequiresAuth(); fixWalletTextNodes(listEl); return; }
        const force = !!opts.force;
        const skipSkeleton = !!opts.skipSkeleton;
        const skipServerSync = !!opts.skipServerSync;
        if (!skipSkeleton) showSkeleton();

        const uid = String(loadUser.uid || '').trim();
        if (!uid){ showRequiresAuth(); fixWalletTextNodes(listEl); return; }
        const sameUserAsLastRender = LAST_USER_ID === uid;
        if (!force && !isPageRouteActive()) return;
        if (shouldSkipImmediateReload(uid, force)) return;
        markLoadRequest(uid);
        if (!LAST_USER_ID || LAST_USER_ID !== uid) {
          resetHistoryViewState();
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
        } else if (recentlySynced){
          // The server was queried within the last few seconds (even if it
          // returned nothing). Don't re-hit it on every reload — this stops the
          // repeated client-wallet requests when the wallet has no items yet.
          items = cacheToArray(uid);
          usedCache = true;
        } else {
          items = await fetchLatestTransactions(uid);
          replaceCache(uid, items);
        }

        displayItems(uid, items);
        const hasPendingItems = hasPendingHistoryItems(items);
        const previousSignature = buildSnapshotSignature(ALL_ITEMS);

        if (force || skipServerSync) return items;

        if (usedCache && (!recentlySynced || hasPendingItems)){
          try{
            const fresh = await fetchLatestTransactions(uid);
            replaceCache(uid, fresh);
            const newSignature = buildSnapshotSignature(fresh);
            if (newSignature !== previousSignature){
              displayItems(uid, fresh);
            }
            return fresh;
          }catch(_){ }
        }
        return items;
      }

      chipsWrap.addEventListener('click', (e)=>{
        const btn = e.target.closest('.chip');
        if (!btn) return;
        if (btn.id === DATE_CHIP_ID){
          openHistoryCalendar();
          return;
        }
        if (!btn.dataset || !btn.dataset.filter) return;
        var nextFilter = String(btn.dataset.filter || 'all').trim() || 'all';
        if (PAGE_MODE === 'wallet' && isWalletOperationFilterKey(nextFilter)) {
          OPERATION_FILTER = nextFilter;
          CURRENT_FILTER = 'all';
        } else {
          CURRENT_FILTER = nextFilter;
          if (PAGE_MODE !== 'wallet') OPERATION_FILTER = 'all';
        }
        VISIBLE_LIMIT = HISTORY_INITIAL_VISIBLE_COUNT;
        const user = auth.currentUser;
        renderVisibleItems((user && user.uid) || LAST_USER_ID);
      });

      if (refreshBtn){
        refreshBtn.addEventListener('click', (e)=>{
          try{ e.preventDefault(); }catch(_){ }
          loadWalletFor(auth.currentUser, { force: true });
        });
      }

      listEl.addEventListener('click', async (e)=>{
        var toggleBtn = e.target.closest('[data-wallet-card-toggle]');
        if (toggleBtn){
          e.preventDefault();
          e.stopPropagation();
          var toggleCard = toggleBtn.closest('.card[data-openable="1"]');
          if (!toggleCard) return;
          if (PAGE_MODE === 'payments' || PAGE_MODE === 'wallet') {
            setTransactionCardOpen(toggleCard, !toggleCard.classList.contains('open'));
            return;
          }
          await openTransactionDetailsForCard(toggleCard);
          return;
        }

        var codeBtn = e.target.closest('.code-btn[data-code], .code-status-btn[data-code]');
        if (codeBtn){
          e.preventDefault();
          var codeCard = codeBtn.closest('.card');
          if (!codeCard) return;
          if (PAGE_MODE === 'payments' || PAGE_MODE === 'wallet') {
            setTransactionCardOpen(codeCard, !codeCard.classList.contains('open'));
            return;
          }
          await openTransactionDetailsForCard(codeCard);
          return;
        }

        var interactive = e.target.closest('a, button, input, select, textarea, label');
        if (interactive) return;

        var card = e.target.closest('.card[data-openable="1"]');
        if (!card) return;
        if (PAGE_MODE === 'payments' || PAGE_MODE === 'wallet') {
          setTransactionCardOpen(card, !card.classList.contains('open'));
          return;
        }
        await openTransactionDetailsForCard(card);
      });

      listEl.addEventListener('keydown', async (e)=>{
        if (!e) return;
        if (e.key !== 'Enter' && e.key !== ' ') return;
        var card = e.target.closest('.card[data-openable="1"]');
        if (!card) return;
        e.preventDefault();
        if (PAGE_MODE === 'payments' || PAGE_MODE === 'wallet') {
          setTransactionCardOpen(card, !card.classList.contains('open'));
          return;
        }
        await openTransactionDetailsForCard(card);
      });

      function init(){
        applyDefaultDateFilter();
        syncWalletToolbarUI();
        bindWalletModernControls();
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

      var __walletRefreshLastAt = 0;
      var WALLET_REFRESH_THROTTLE_MS = 2500;
      window[pageConfig.refreshFnName] = function(opts){
        try {
          const refreshOpts = opts || {};
          if (!refreshOpts.force && !isPageRouteActive()) return Promise.resolve();
          // Coalesce bursts of refresh calls (route re-shows, auto-deposit echoes,
          // balance updates) so we never fire client-wallet back-to-back. A genuine
          // refresh still goes through once the short window passes.
          var nowTs = Date.now();
          if (!refreshOpts.bypassThrottle && (nowTs - __walletRefreshLastAt) < WALLET_REFRESH_THROTTLE_MS){
            return Promise.resolve();
          }
          __walletRefreshLastAt = nowTs;
          const authWaitMs = refreshOpts.authWaitMs || (PAGE_MODE === 'payments' ? 6000 : 3500);
          return waitForWalletLoadUser(null, authWaitMs).then(function(loadUser){
            return loadWalletFor(loadUser, refreshOpts);
          }).catch(function(err){
            try { console.warn('wallet refresh failed', err); } catch(_){ }
          });
        }catch(_){ return Promise.resolve(); }
      };

      // Surface a just-placed purchase in "حركاتي" the instant it is made, before the
      // server order list catches up ("معاملات لا تظهر مع أنها مخصومة حديثاً"). The
      // catalog purchase flow calls this with the order it just created. Only the
      // wallet instance registers it; the next server sync reconciles the real row.
      if (PAGE_MODE === 'wallet') {
        window.__WALLET_NOTE_NEW_ORDER__ = function(orderLike){
          try {
            var o = (orderLike && typeof orderLike === 'object') ? orderLike : {};
            var code = String(o.code || o.orderCode || '').trim();
            var amt = Math.abs(Number(o.total != null ? o.total : o.price) || 0);
            if (!code || !(amt > 0)) return false;
            var item = buildWalletItemFromOrder({
              code: code,
              total: amt,
              timestamp: new Date().toISOString(),
              title: o.title || o.name || o.productName || '',
              status: o.status || 'wait'
            });
            if (!item) return false;
            item.__optimistic = true;
            noteOptimisticOrderItem(item);
            var uid = String(LAST_USER_ID || '').trim();
            if (!uid) { try { uid = String((readWalletSessionContext('') || {}).uid || '').trim(); } catch(_){ } }
            if (uid && isPageRouteActive()) displayItems(uid, ALL_ITEMS.slice());
            return true;
          } catch(_){ return false; }
        };
      }

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

;
