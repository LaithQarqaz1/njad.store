/* Accounts marketplace route (سوق الحسابات) — the storefront for the escrow
   accounts marketplace. Ships as chunk-accounts.js, loaded by __loadRouteChunk
   before the `accounts` route builds (registered on window.__inlineRoutes.accounts,
   mirroring the account-family builders in route-account.js). Talks to the
   customer handler at  POST <workerBase>/accounts/  with { action }. Public
   browse/categories/detail need NO auth; my_listings/submit (later phases) use the
   session cookie. HARD RULE mirrored from the backend: this client never handles
   account login credentials — only public listing fields. All core dependencies
   are window-qualified (this runs in its own <script>, not the core IIFE scope). */
      var accountsMarketplaceRoute = (function(){
        var state = {
          root: null,
          refs: null,
          categories: [],
          categoriesLoaded: false,
          activeCategoryId: '',
          disabled: false,
          loadToken: 0,
          lastShowHash: '',
          lastShowAt: 0,
          modalBound: false,
          chat: null   // { orderId, timer, lastMs, canSend } while a deal thread is open
        };

        function esc(value){
          return String(value == null ? '' : value)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        }

        function toast(message, variant){
          try { if (window && typeof window.showToast === 'function') { window.showToast(message, variant || 'info', 4200); return; } } catch(_){ }
          try { console.info('[accounts]', message); } catch(_){ }
        }

        function fmtUsd(value){
          var n = Number(value);
          if (!Number.isFinite(n)) n = 0;
          return '$' + n.toFixed(2);
        }

        // Same canonical resolver order every working feature (wallet/support/
        // deposit/referral) uses. Falls back to same-origin only as a last resort;
        // callAccounts' ok:true guard turns an HTML fallback into an honest error.
        function workerBase(){
          var candidates = [];
          try { if (window.__getSiteWorkerBase) candidates.push(window.__getSiteWorkerBase({ trailingSlash: true, allowStorageOverride: true })); } catch(_){ }
          try { if (window.__getSiteWorkerBaseDefault) candidates.push(window.__getSiteWorkerBaseDefault({ trailingSlash: true })); } catch(_){ }
          try {
            candidates.push(window.API_BASE_URL, window.__API_BASE__, window.API_BASE,
              document.documentElement && document.documentElement.getAttribute('data-api-base'));
          } catch(_){ }
          try {
            candidates.push(localStorage.getItem('MANWAL_ROUTER_BASE'), localStorage.getItem('edaa:worker'),
              localStorage.getItem('apiBase'), localStorage.getItem('workerBase'));
          } catch(_){ }
          try { if (typeof window.__getSiteSetting === 'function') candidates.push(window.__getSiteSetting('workers.routerBase', '')); } catch(_){ }
          for (var i = 0; i < candidates.length; i += 1) {
            var value = String(candidates[i] || '').trim();
            if (value) return value.replace(/\/+$/, '');
          }
          try { return String(location.origin || '').replace(/\/+$/, ''); } catch(_){ return ''; }
        }

        // The customer session for authed actions. accounts.js resolveCustomer
        // reads the uid from the request body + the HttpOnly session cookie from
        // the request; localStorage only carries the uid (the cookie is the bearer,
        // same as wallet/transfers/referral).
        function readAccountsSession(){
          try {
            var raw = localStorage.getItem('sessionKeyInfo');
            if (!raw) return null;
            var parsed = JSON.parse(raw);
            if (parsed && parsed.uid) return { uid: String(parsed.uid) };
          } catch(_){ }
          return null;
        }

        // POST <base>/accounts/ with { action, ...payload }. Public actions
        // (categories/browse/detail) need no auth. For authed actions pass
        // { auth:true }: the request rides the session cookie (credentials:
        // 'include') and injects the uid into the body — resolveCustomer verifies
        // both. NO per-handler CORS change is needed: the Worker's single exit point
        // (applyCustomerCors) echoes the storefront origin + Allow-Credentials, and
        // the global router answers the OPTIONS preflight with the named
        // Allow-Headers list (workes.js), so credentialed cross-origin calls work.
        // Returns parsed JSON; throws (.code/.status) on network/!ok so callers show
        // an honest error instead of an empty grid.
        async function callAccounts(action, payload, opts){
          opts = opts || {};
          var base = workerBase();
          if (!base) { var e0 = new Error('no_worker'); e0.code = 'no_worker'; throw e0; }
          var body = Object.assign({ action: action }, payload || {});
          var init = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          };
          if (opts.auth){
            var sess = readAccountsSession();
            if (!sess){ var e1 = new Error('login_required'); e1.code = 'login_required'; e1.status = 401; throw e1; }
            body.useruid = sess.uid;
            init.credentials = 'include';
          }
          init.body = JSON.stringify(body);
          var res = await fetch(base + '/accounts/', init);
          var data = await res.json().catch(function(){ return null; });
          if (!res.ok || !data || data.ok !== true) {
            var err = new Error(String((data && (data.message || data.error)) || 'server_error'));
            err.code = String((data && data.error) || 'server_error');
            err.status = res.status;
            throw err;
          }
          return data;
        }

        // G2 in-site notification: the unread badge the server computes per deal
        // thread (messages newer than my last-seen, sent by someone else).
        function unreadBadge(count){
          var n = Number(count || 0);
          if (!(n > 0)) return '';
          return '<span class="acc-unread">' + esc(n > 99 ? '99+' : String(n)) + '</span>';
        }

        function ensureStyles(){
          if (document.getElementById('accounts-market-style')) return;
          var css = '' +
            '.acc-market{max-width:1040px;margin:0 auto;padding:16px 14px 120px;direction:rtl;' +
              'font-family:inherit;color:var(--text-color,inherit);}' +
            '.acc-market-head{text-align:center;margin:6px 0 18px;}' +
            '.acc-market-head h2{margin:0 0 6px;font-size:1.5rem;display:flex;align-items:center;justify-content:center;gap:10px;}' +
            '.acc-market-head p{margin:0;opacity:.72;font-size:.92rem;}' +
            '.acc-cats{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin:0 0 18px;}' +
            '.acc-chip{border:1px solid var(--border-color,rgba(109,40,217,.18));background:var(--card-bg,#fff);' +
              'color:var(--text-color,inherit);border-radius:999px;padding:7px 15px;font-size:.86rem;cursor:pointer;' +
              'transition:all .15s ease;white-space:nowrap;}' +
            '.acc-chip:hover{border-color:var(--primary,#6d28d9);}' +
            '.acc-chip.is-active{background:var(--primary,#6d28d9);border-color:var(--primary,#6d28d9);color:#fff;}' +
            '.acc-status{text-align:center;padding:38px 16px;opacity:.8;font-size:.95rem;}' +
            '.acc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:16px;}' +
            // «قسم» cards on the market home (image + name, like the recharge grid).
            '.acc-section-card{cursor:pointer;background:var(--card-bg,#fff);border:1px solid var(--border-color,rgba(109,40,217,.12));' +
            'border-radius:16px;overflow:hidden;transition:transform .15s,box-shadow .15s;}' +
            '.acc-section-card:hover{transform:translateY(-3px);box-shadow:0 12px 30px rgba(30,20,80,.12);}' +
            '.acc-section-media{position:relative;aspect-ratio:1/1;background:linear-gradient(135deg,rgba(109,40,217,.12),rgba(59,130,246,.12));' +
            'display:grid;place-items:center;}' +
            '.acc-section-media img{width:100%;height:100%;object-fit:cover;display:block;}' +
            '.acc-section-media .acc-ph{font-size:2rem;opacity:.35;}' +
            '.acc-section-name{padding:10px 12px;font-weight:800;text-align:center;font-size:.98rem;}' +
            // «قسم» PAGE: stacked «فرز» blocks — a heading with its accounts grid below.
            '.acc-sections{display:flex;flex-direction:column;gap:22px;}' +
            '.acc-section-head{display:flex;align-items:center;gap:12px;flex-wrap:wrap;}' +
            '.acc-ferz-title{margin:0 0 16px;font-size:1.25rem;font-weight:800;text-align:center;position:relative;padding-bottom:9px;}' +
            '.acc-ferz-title::after{content:"";position:absolute;bottom:0;inset-inline:0;margin-inline:auto;width:52px;height:3px;border-radius:3px;background:var(--primary,#6d28d9);}' +
            '.acc-card{position:relative;background:var(--card-bg,#fff);border:1px solid var(--border-color,rgba(109,40,217,.12));' +
              'border-radius:18px;overflow:hidden;text-align:right;box-shadow:0 6px 22px rgba(30,20,80,.06);' +
              'display:flex;flex-direction:column;}' +
            '.acc-card-media{position:relative;aspect-ratio:1/1;background:#0b0b16;' +
              'display:flex;align-items:center;justify-content:center;overflow:hidden;}' +
            // Admin-chosen card image shape (per قسم / top فرز). Image still whole (contain).
            '.acc-card-media.acc-shape-portrait{aspect-ratio:3/4;}' +
            '.acc-card-media.acc-shape-square{aspect-ratio:1/1;}' +
            '.acc-card-media.acc-shape-landscape{aspect-ratio:16/10;}' +
            // Full image — NEVER cropped (contain, not cover). Enlarge is details-only.
            '.acc-card-media img{width:100%;height:100%;object-fit:contain;display:block;}' +
            '.acc-card-media .acc-ph{font-size:2.4rem;opacity:.35;}' +
            // Carousel arrows + counter (shared with the detail stage). No hover state.
            '.acc-nav{position:absolute;top:50%;transform:translateY(-50%);width:34px;height:34px;border-radius:50%;border:none;' +
              'background:rgba(10,8,26,.55);color:#fff;cursor:pointer;display:grid;place-items:center;font-size:.9rem;z-index:2;}' +
            // Pin :hover to the base look so no global button:hover can change/move it.
            '.acc-nav:hover,.acc-nav:focus{background:rgba(10,8,26,.55);transform:translateY(-50%);}' +
            '.acc-nav-prev{inset-inline-start:8px;}' +
            '.acc-nav-next{inset-inline-end:8px;}' +
            '.acc-card-count{position:absolute;bottom:8px;inset-inline-start:8px;background:rgba(10,8,26,.6);color:#fff;direction:ltr;' +
              'border-radius:999px;padding:2px 9px;font-size:.72rem;font-weight:700;z-index:2;}' +
            '.acc-zoom{position:absolute;top:8px;inset-inline-end:8px;width:32px;height:32px;border-radius:50%;border:none;' +
              'background:rgba(10,8,26,.55);color:#fff;cursor:pointer;display:grid;place-items:center;font-size:.82rem;z-index:2;}' +
            '.acc-zoom:hover{background:rgba(10,8,26,.8);}' +
            '.acc-details-btn{margin-top:8px;width:100%;border:none;border-radius:12px;padding:9px 12px;cursor:pointer;font-weight:800;' +
              'font-size:.9rem;background:var(--primary,#6d28d9);color:#fff;display:flex;align-items:center;justify-content:center;gap:6px;}' +
            '.acc-details-btn:hover{filter:brightness(1.08);}' +
            // Full-screen lightbox — z-index ABOVE the site header so it fully covers it
            // (the close button was hidden behind the fixed header before).
            '.acc-lightbox{position:fixed;inset:0;z-index:2147483000;background:rgba(6,5,16,.94);display:flex;align-items:center;justify-content:center;padding:24px;}' +
            '.acc-lightbox[hidden]{display:none;}' +
            '.acc-lb-img{max-width:92vw;max-height:88vh;object-fit:contain;border-radius:10px;}' +
            '.acc-lb-nav{position:absolute;top:50%;transform:translateY(-50%);width:48px;height:48px;border-radius:50%;border:none;' +
              'background:rgba(255,255,255,.14);color:#fff;cursor:pointer;display:grid;place-items:center;font-size:1.2rem;}' +
            '.acc-lb-nav:hover,.acc-lb-nav:focus{background:rgba(255,255,255,.14);transform:translateY(-50%);}' +
            '.acc-lb-prev{inset-inline-start:18px;}' +
            '.acc-lb-next{inset-inline-end:18px;}' +
            '.acc-lb-close{position:absolute;top:16px;inset-inline-start:18px;width:44px;height:44px;border-radius:50%;border:none;' +
              'background:rgba(255,255,255,.14);color:#fff;cursor:pointer;font-size:1.3rem;display:grid;place-items:center;}' +
            '.acc-lb-close:hover{background:rgba(255,255,255,.28);}' +
            '.acc-lb-count{position:absolute;bottom:22px;inset-inline:0;margin-inline:auto;width:max-content;color:#fff;direction:ltr;' +
              'background:rgba(255,255,255,.14);border-radius:999px;padding:4px 14px;font-size:.85rem;font-weight:700;}' +
            // Detail stage (the large main image with its own arrows + zoom).
            '.acc-detail-stage{position:relative;background:#0b0b16;border-radius:16px;overflow:hidden;display:flex;align-items:center;justify-content:center;min-height:280px;max-height:60vh;}' +
            '.acc-detail-main-img{max-width:100%;max-height:60vh;object-fit:contain;display:block;cursor:zoom-in;}' +
            '.acc-badge{position:absolute;top:8px;inset-inline-start:8px;background:rgba(16,185,129,.95);color:#fff;' +
              'border-radius:999px;padding:3px 9px;font-size:.68rem;font-weight:700;display:flex;align-items:center;gap:4px;}' +
            '.acc-card-body{padding:11px 12px 13px;display:flex;flex-direction:column;gap:5px;flex:1;}' +
            '.acc-card-title{font-weight:700;font-size:.95rem;line-height:1.35;margin:0;' +
              'display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}' +
            '.acc-card-meta{font-size:.76rem;opacity:.66;display:flex;align-items:center;gap:5px;}' +
            '.acc-card-foot{margin-top:auto;display:flex;align-items:center;justify-content:space-between;padding-top:6px;}' +
            '.acc-card-price{font-weight:800;font-size:1.05rem;color:var(--primary,#6d28d9);}' +
            '.acc-modal{position:fixed;inset:0;z-index:9600;background:rgba(10,8,26,.62);backdrop-filter:blur(3px);' +
              'display:flex;align-items:center;justify-content:center;padding:18px;}' +
            '.acc-modal[hidden]{display:none;}' +
            '.acc-modal-card{background:var(--card-bg,#fff);color:var(--text-color,inherit);border-radius:22px;max-width:520px;width:100%;' +
              'max-height:88vh;overflow:auto;padding:20px 20px 24px;box-shadow:0 24px 60px rgba(10,8,26,.4);direction:rtl;}' +
            '.acc-modal-close{float:left;border:none;background:transparent;font-size:1.4rem;cursor:pointer;color:inherit;opacity:.6;line-height:1;}' +
            '.acc-modal-gallery{display:flex;gap:8px;overflow-x:auto;margin:10px 0 14px;padding-bottom:4px;}' +
            '.acc-modal-gallery img{height:150px;border-radius:12px;object-fit:cover;flex:0 0 auto;}' +
            '.acc-modal h3{margin:2px 0 8px;font-size:1.25rem;}' +
            '.acc-modal-desc{white-space:pre-wrap;line-height:1.6;font-size:.92rem;opacity:.9;margin:6px 0 14px;}' +
            '.acc-modal-row{display:flex;justify-content:space-between;gap:10px;padding:9px 0;border-top:1px solid var(--border-color,rgba(109,40,217,.1));font-size:.9rem;}' +
            '.acc-modal-row .k{opacity:.66;}' +
            '.acc-modal-note{margin-top:14px;padding:11px 13px;border-radius:12px;background:rgba(59,130,246,.1);' +
              'font-size:.85rem;line-height:1.55;opacity:.92;}' +
            '.acc-steps-h{font-size:.82rem;font-weight:700;opacity:.7;margin:16px 0 2px;}' +
            '.acc-modal-steps{margin:6px 0 4px;padding:0;list-style:none;counter-reset:accstep;}' +
            '.acc-modal-steps li{position:relative;padding:8px 36px 8px 4px;font-size:.88rem;line-height:1.5;' +
              'border-top:1px solid var(--border-color,rgba(109,40,217,.1));}' +
            '.acc-modal-steps li:before{counter-increment:accstep;content:counter(accstep);position:absolute;inset-inline-start:0;top:8px;' +
              'width:24px;height:24px;border-radius:50%;background:var(--primary,#6d28d9);color:#fff;font-size:.72rem;font-weight:700;' +
              'display:flex;align-items:center;justify-content:center;}' +
            '.acc-buy-btn{width:100%;margin-top:16px;border:none;border-radius:14px;padding:14px;font-size:1rem;font-weight:800;cursor:pointer;' +
              'color:#fff;background:linear-gradient(135deg,#10b981,#059669);box-shadow:0 8px 22px rgba(16,185,129,.32);transition:transform .12s ease;}' +
            '.acc-buy-btn:hover{transform:translateY(-2px);}' +
            '.acc-buy-btn[disabled]{background:#9ca3af;box-shadow:none;cursor:not-allowed;opacity:.7;transform:none;}' +
            '.acc-modal-loading{text-align:center;padding:40px 16px;opacity:.75;font-size:.95rem;}' +
            '.acc-status-pill{display:inline-block;border-radius:999px;padding:3px 10px;font-size:.72rem;font-weight:700;}' +
            '.acc-status-listed{background:rgba(16,185,129,.14);color:#059669;}' +
            '.acc-status-busy{background:rgba(245,158,11,.16);color:#b45309;}' +
            '.acc-status-sold{background:rgba(107,114,128,.16);color:#4b5563;}' +
            '.acc-actions{display:flex;justify-content:center;gap:10px;margin:0 0 16px;flex-wrap:wrap;}' +
            '.acc-action-btn{border:1px solid var(--primary,#6d28d9);background:var(--card-bg,#fff);color:var(--primary,#6d28d9);' +
              'border-radius:12px;padding:9px 18px;font-size:.9rem;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:7px;transition:all .15s ease;}' +
            '.acc-action-btn:hover{background:var(--primary,#6d28d9);color:#fff;}' +
            // The payout is the one money-moving action on this page — make it read as one.
            '.acc-withdraw-btn{border-color:#059669;color:#fff;background:#059669;}' +
            '.acc-withdraw-btn:hover{background:#047857;border-color:#047857;color:#fff;}' +
            '.acc-action-btn:disabled{opacity:.55;cursor:default;}' +
            '.acc-form{display:flex;flex-direction:column;gap:13px;margin-top:6px;}' +
            '.acc-field{display:flex;flex-direction:column;gap:5px;}' +
            '.acc-field label{font-size:.82rem;font-weight:700;opacity:.8;}' +
            '.acc-field input,.acc-field textarea,.acc-field select{width:100%;border:1px solid var(--border-color,rgba(109,40,217,.2));' +
              'border-radius:10px;padding:10px 12px;font-size:.92rem;font-family:inherit;background:var(--input-bg,#fff);color:inherit;box-sizing:border-box;}' +
            '.acc-field textarea{min-height:88px;resize:vertical;}' +
            '.acc-field .hint{font-size:.72rem;opacity:.6;font-weight:400;}' +
            '.acc-imgs{display:flex;flex-wrap:wrap;gap:8px;margin-top:6px;}' +
            '.acc-imgs .thumb{position:relative;width:64px;height:64px;border-radius:10px;overflow:hidden;border:1px solid var(--border-color,rgba(109,40,217,.2));}' +
            '.acc-imgs .thumb img{width:100%;height:100%;object-fit:cover;}' +
            '.acc-imgs .thumb button{position:absolute;top:2px;inset-inline-end:2px;width:18px;height:18px;border:none;border-radius:50%;' +
              'background:rgba(0,0,0,.6);color:#fff;font-size:.7rem;cursor:pointer;line-height:1;padding:0;}' +
            '.acc-upload{border:1px dashed var(--border-color,rgba(109,40,217,.4));border-radius:10px;padding:14px;text-align:center;cursor:pointer;font-size:.85rem;opacity:.85;display:block;}' +
            '.acc-warn{background:rgba(245,158,11,.12);color:#b45309;border-radius:10px;padding:10px 12px;font-size:.8rem;line-height:1.55;margin-bottom:4px;}' +
            '.acc-submit{width:100%;border:none;border-radius:12px;padding:13px;font-size:1rem;font-weight:800;cursor:pointer;color:#fff;' +
              'background:linear-gradient(135deg,#6d28d9,#4f46e5);box-shadow:0 8px 22px rgba(79,70,229,.3);transition:transform .12s ease;}' +
            '.acc-submit:hover{transform:translateY(-2px);}' +
            '.acc-submit[disabled]{opacity:.6;cursor:not-allowed;transform:none;}' +
            '.acc-my-list{display:flex;flex-direction:column;gap:9px;margin-top:8px;}' +
            '.acc-my-row{display:flex;align-items:center;gap:10px;border:1px solid var(--border-color,rgba(109,40,217,.12));' +
              'border-radius:12px;padding:10px 12px;}' +
            '.acc-my-info{flex:1;min-width:0;}' +
            '.acc-my-title{font-weight:700;font-size:.92rem;margin-bottom:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
            '.acc-my-reject{margin-top:5px;font-size:.8rem;color:#dc2626;background:rgba(220,38,38,.08);border-radius:8px;padding:4px 8px;}' +
            '.acc-my-meta{display:flex;align-items:center;gap:8px;font-size:.82rem;opacity:.85;}' +
            '.acc-my-del{border:none;background:rgba(239,68,68,.12);color:#dc2626;border-radius:10px;width:38px;height:38px;' +
              'cursor:pointer;flex:0 0 auto;font-size:.95rem;transition:background .15s ease;}' +
            '.acc-my-del:hover{background:rgba(239,68,68,.2);}' +
            '.acc-my-del[disabled]{opacity:.5;cursor:not-allowed;}' +
            // Deal chat (G1): a fixed-height column so the message list scrolls
            // inside the card instead of growing the modal.
            '.acc-chat-wrap{display:flex;flex-direction:column;height:min(66vh,520px);}' +
            '.acc-chat-meta{font-size:.8rem;opacity:.75;padding-bottom:8px;margin-bottom:8px;' +
              'border-bottom:1px solid var(--border-color,rgba(109,40,217,.12));}' +
            '.acc-chat-body{flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:8px;padding:2px;}' +
            '.acc-msg{max-width:78%;border-radius:14px;padding:8px 11px;font-size:.88rem;line-height:1.6;' +
              'word-break:break-word;white-space:pre-wrap;}' +
            '.acc-msg .who{display:block;font-size:.7rem;font-weight:700;opacity:.75;margin-bottom:3px;}' +
            '.acc-msg .at{display:block;font-size:.64rem;opacity:.55;margin-top:4px;}' +
            '.acc-msg img,.acc-msg video{max-width:100%;border-radius:10px;display:block;margin-top:5px;}' +
            // RTL: flex-end is the LEFT edge — outgoing messages sit left, mirroring
            // every Arabic messenger; incoming sit right.
            '.acc-msg-mine{align-self:flex-end;background:linear-gradient(135deg,#6d28d9,#4f46e5);color:#fff;}' +
            '.acc-msg-theirs{align-self:flex-start;background:rgba(109,40,217,.08);}' +
            '.acc-msg-admin{align-self:center;max-width:90%;text-align:center;background:rgba(245,158,11,.14);color:#b45309;}' +
            '.acc-chat-form{display:flex;gap:6px;align-items:center;margin-top:10px;}' +
            '.acc-chat-input{flex:1;min-width:0;border:1px solid var(--border-color,rgba(109,40,217,.2));border-radius:12px;' +
              'padding:10px 12px;font-size:.9rem;font-family:inherit;background:var(--input-bg,#fff);color:inherit;}' +
            '.acc-chat-btn{border:none;border-radius:12px;width:42px;height:42px;flex:0 0 auto;cursor:pointer;font-size:.95rem;}' +
            '.acc-chat-send{background:linear-gradient(135deg,#6d28d9,#4f46e5);color:#fff;}' +
            '.acc-chat-clip{background:rgba(109,40,217,.1);color:#6d28d9;}' +
            '.acc-chat-btn[disabled]{opacity:.55;cursor:not-allowed;}' +
            '.acc-chat-closed{margin-top:10px;padding:10px;border-radius:10px;text-align:center;font-size:.82rem;' +
              'background:rgba(148,163,184,.16);opacity:.85;}' +
            '.acc-unread{display:inline-block;min-width:18px;padding:0 5px;margin-inline-start:5px;border-radius:9px;' +
              'background:#dc2626;color:#fff;font-size:.7rem;font-weight:800;line-height:18px;text-align:center;}' +
            // Product PAGE (#/accounts/<id>): gallery beside title/price/CTA,
            // description underneath. Collapses to one column on a phone.
            '.acc-back-btn{border:1px solid var(--border-color,rgba(109,40,217,.2));background:transparent;color:inherit;' +
              'border-radius:10px;padding:8px 14px;font-size:.86rem;font-weight:700;cursor:pointer;margin-bottom:14px;' +
              'display:inline-flex;align-items:center;gap:6px;font-family:inherit;}' +
            '.acc-detail{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:20px;align-items:start;}' +
            '.acc-detail-media{border:1px solid var(--border-color,rgba(109,40,217,.14));border-radius:16px;overflow:hidden;' +
              'background:var(--card-bg,rgba(109,40,217,.04));}' +
            '.acc-detail-media > img{width:100%;aspect-ratio:1/1;object-fit:cover;display:block;}' +
            '.acc-detail-media .acc-ph{display:flex;align-items:center;justify-content:center;aspect-ratio:1/1;font-size:2.6rem;opacity:.35;}' +
            '.acc-detail-thumbs{display:flex;gap:8px;padding:8px;overflow-x:auto;}' +
            '.acc-detail-thumb{width:62px;height:62px;object-fit:contain;background:#0b0b16;border-radius:10px;cursor:pointer;flex:0 0 auto;' +
              'border:2px solid transparent;opacity:.75;transition:opacity .15s ease,border-color .15s ease;}' +
            '.acc-detail-thumb.is-active,.acc-detail-thumb:hover{opacity:1;border-color:#6d28d9;}' +
            '.acc-detail-title{margin:0 0 10px;font-size:1.35rem;line-height:1.5;}' +
            '.acc-detail-price{font-size:1.6rem;font-weight:800;color:#6d28d9;margin-bottom:18px;}' +
            '.acc-detail-desc{margin-top:22px;white-space:pre-wrap;line-height:1.9;font-size:.95rem;opacity:.92;}' +
            '@media (max-width:720px){.acc-detail{grid-template-columns:1fr;gap:14px;}}' +
            '.acc-badge-sold{background:rgba(107,114,128,.95);}' +
            '.acc-page-title{margin:0 0 16px;font-size:1.3rem;}' +
            '@media (max-width:520px){.acc-grid{grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:11px;}}';
          var style = document.createElement('style');
          style.id = 'accounts-market-style';
          style.textContent = css;
          (document.head || document.documentElement).appendChild(style);
        }

        function ensureRoot(){
          if (state.root) return state.root;
          ensureStyles();
          var root = document.createElement('div');
          root.className = 'acc-market';
          root.innerHTML = [
            // `accMarketView` holds the section browser; `accDetailView` is the
            // product PAGE (#/accounts/<id>) — one root, two views, no modal.
            '<div id="accMarketView">',
            '  <div class="acc-actions">',
            '    <button type="button" class="acc-action-btn" id="accSellBtn"><i class="fa-solid fa-plus"></i> اعرض حسابك</button>',
            '    <button type="button" class="acc-action-btn" id="accMineBtn"><i class="fa-solid fa-rectangle-list"></i> حساباتي</button>',
            '    <button type="button" class="acc-action-btn" id="accBuysBtn"><i class="fa-solid fa-bag-shopping"></i> مشترياتي</button>',
            '    <button type="button" class="acc-action-btn" id="accSalesBtn"><i class="fa-solid fa-money-bill-transfer"></i> مبيعاتي</button>',
            '  </div>',
            '  <div class="acc-cats" id="accCats"></div>',
            '  <div class="acc-status" id="accStatus">جارِ التحميل…</div>',
            '  <div class="acc-grid" id="accGrid" hidden></div>',
            '</div>',
            '<div id="accDetailView" hidden></div>'
          ].join('');
          state.root = root;
          state.refs = {
            cats: root.querySelector('#accCats'),
            status: root.querySelector('#accStatus'),
            grid: root.querySelector('#accGrid'),
            marketView: root.querySelector('#accMarketView'),
            detailView: root.querySelector('#accDetailView')
          };
          // Every panel is a PAGE now (#/accounts/sell|mine|purchases) — no modals.
          var sellBtn = root.querySelector('#accSellBtn');
          if (sellBtn) sellBtn.addEventListener('click', function(){ goToSub('sell'); });
          var mineBtn = root.querySelector('#accMineBtn');
          if (mineBtn) mineBtn.addEventListener('click', function(){ goToSub('mine'); });
          var buysBtn = root.querySelector('#accBuysBtn');
          if (buysBtn) buysBtn.addEventListener('click', function(){ goToSub('purchases'); });
          var salesBtn = root.querySelector('#accSalesBtn');
          if (salesBtn) salesBtn.addEventListener('click', function(){ goToSub('sales'); });
          return root;
        }

        function setStatus(message){
          if (!state.refs) return;
          if (message){
            state.refs.status.textContent = message;
            state.refs.status.hidden = false;
            state.refs.grid.hidden = true;
          } else {
            state.refs.status.hidden = true;
            state.refs.grid.hidden = false;
          }
        }

        function categoryName(categoryId){
          for (var i = 0; i < state.categories.length; i += 1){
            if (state.categories[i].categoryId === categoryId) return state.categories[i].name;
          }
          return '';
        }

        // A «قسم» (game) card on the market HOME — image + name, like the recharge grid.
        function buildSectionCard(section){
          var card = document.createElement('div');
          card.className = 'acc-section-card';
          card.setAttribute('role', 'button');
          card.setAttribute('tabindex', '0');
          var img = String(section.imageUrl || section.image || '');
          card.innerHTML = [
            '<div class="acc-section-media">',
            img ? '<img loading="lazy" alt="" src="' + esc(img) + '">' : '<span class="acc-ph"><i class="fa-solid fa-layer-group"></i></span>',
            '</div>',
            '<div class="acc-section-name">' + esc(section.name || '—') + '</div>'
          ].join('');
          function open(){ goToSection(section.categoryId); }
          card.addEventListener('click', open);
          card.addEventListener('keydown', function(ev){ if (ev.key === 'Enter' || ev.key === ' '){ ev.preventDefault(); open(); } });
          return card;
        }

        // Market HOME: «قسم» cards (click to open) + any standalone TOP-LEVEL «فرز»
        // drawn straight as a heading with its accounts (single-game store, no قسم).
        function renderHome(sections, sorts){
          if (!state.refs) return;
          if (state.refs.cats) state.refs.cats.hidden = true;
          var grid = state.refs.grid;
          grid.className = 'acc-sections';
          grid.innerHTML = '';
          var hasSections = sections && sections.length;
          var withListings = (sorts || []).filter(function(s){ return s.listings && s.listings.length; });
          if (!hasSections && !withListings.length){ setStatus('لا توجد أقسام معروضة حالياً.'); return; }
          setStatus('');
          if (hasSections){
            var cardsWrap = document.createElement('div');
            cardsWrap.className = 'acc-grid';
            sections.forEach(function(sec){ cardsWrap.appendChild(buildSectionCard(sec)); });
            grid.appendChild(cardsWrap);
          }
          withListings.forEach(function(ferz){
            var block = document.createElement('div');
            block.className = 'acc-ferz';
            var h = document.createElement('h3');
            h.className = 'acc-ferz-title';
            h.textContent = ferz.name || 'حسابات';
            block.appendChild(h);
            var fgrid = document.createElement('div');
            fgrid.className = 'acc-grid';
            ferz.listings.forEach(function(listing){ fgrid.appendChild(buildCard(listing, ferz.cardShape)); });
            block.appendChild(fgrid);
            grid.appendChild(block);
          });
        }

        async function loadHome(){
          var token = ++state.loadToken;
          setStatus('جارِ التحميل…');
          try {
            var data = await callAccounts('browse', { limit: 200 });
            if (token !== state.loadToken) return;
            renderHome(Array.isArray(data.sections) ? data.sections : [], Array.isArray(data.sorts) ? data.sorts : []);
          } catch (err){
            if (token !== state.loadToken) return;
            if (err && err.code === 'accounts_disabled'){ state.disabled = true; setStatus('قسم الحسابات غير متاح حالياً.'); return; }
            setStatus('تعذّر تحميل الحسابات. حاول مرة أخرى لاحقاً.');
          }
        }

        // A «قسم» PAGE: each «فرز» drawn as a heading with its accounts grid stacked
        // below it (اسم الفرز بالأعلى وأسفله الحسابات) — multiple فرز stack vertically.
        function renderSectionPage(section, sorts){
          if (!state.refs) return;
          if (state.refs.cats) state.refs.cats.hidden = true;
          var grid = state.refs.grid;
          grid.className = 'acc-sections';
          grid.innerHTML = '';
          var head = document.createElement('div');
          head.className = 'acc-section-head';
          head.innerHTML =
            '<button type="button" class="acc-back-btn" id="accSecBack"><i class="fa-solid fa-arrow-right"></i> رجوع للأقسام</button>' +
            '<h2 class="acc-page-title">' + esc((section && section.name) || 'الحسابات') + '</h2>';
          grid.appendChild(head);
          var backBtn = head.querySelector('#accSecBack');
          if (backBtn) backBtn.addEventListener('click', function(){ backToMarket(); });

          var withListings = (sorts || []).filter(function(s){ return s.listings && s.listings.length; });
          if (!withListings.length){
            var empty = document.createElement('div');
            empty.className = 'acc-status';
            empty.textContent = 'لا توجد حسابات معروضة في هذا القسم حالياً.';
            grid.appendChild(empty);
            return;
          }
          withListings.forEach(function(ferz){
            var block = document.createElement('div');
            block.className = 'acc-ferz';
            var h = document.createElement('h3');
            h.className = 'acc-ferz-title';
            h.textContent = ferz.name || 'حسابات';
            block.appendChild(h);
            var fgrid = document.createElement('div');
            fgrid.className = 'acc-grid';
            ferz.listings.forEach(function(listing){ fgrid.appendChild(buildCard(listing, ferz.cardShape)); });
            block.appendChild(fgrid);
            grid.appendChild(block);
          });
        }

        // Card «shape» = the admin-chosen aspect of the card image box (per قسم / top
        // فرز): portrait | square | landscape. Images are still shown whole (contain).
        function shapeClass(shape){
          var s = String(shape || 'square');
          if (s === 'portrait' || s === 'landscape') return 'acc-shape-' + s;
          return 'acc-shape-square';
        }
        function buildCard(listing, shape){
          var card = document.createElement('div');
          card.className = 'acc-card';
          var images = (Array.isArray(listing.images) ? listing.images : []).map(function(s){ return String(s || ''); }).filter(Boolean);
          var sold = String(listing.status || 'listed') !== 'listed';
          // The card shows ONE image (no arrows) — all photos are browsable in التفاصيل.
          card.innerHTML = [
            '<div class="acc-card-media ' + shapeClass(shape) + '">',
            sold ? '<span class="acc-badge acc-badge-sold">تم البيع</span>' : '',
            images.length
              ? '<img class="acc-card-img" loading="lazy" alt="" src="' + esc(images[0]) + '">'
              : '<span class="acc-ph"><i class="fa-solid fa-user-lock"></i></span>',
            '</div>',
            '<div class="acc-card-body">',
            '  <h3 class="acc-card-title">' + esc(listing.title || 'حساب') + '</h3>',
            '  <div class="acc-card-foot">',
            '    <span class="acc-card-price">' + esc(fmtUsd(listing.price)) + '</span>',
            '  </div>',
            '  <button type="button" class="acc-details-btn"><i class="fa-solid fa-circle-info"></i> عرض تفاصيل</button>',
            '</div>'
          ].join('');
          var detailsBtn = card.querySelector('.acc-details-btn');
          if (detailsBtn) detailsBtn.addEventListener('click', function(e){ e.stopPropagation(); goToDetail(listing.listingId || listing.id); });
          return card;
        }

        // Full-screen image viewer (lightbox) — enlarge + navigate an account's photos.
        // Shared by the cards and the detail page. Images are shown whole (contain).
        function openLightbox(images, startIndex){
          var imgs = (Array.isArray(images) ? images : []).map(function(s){ return String(s || ''); }).filter(Boolean);
          if (!imgs.length) return;
          var i = Math.max(0, Math.min(Number(startIndex) || 0, imgs.length - 1));
          var box = document.getElementById('accLightbox');
          if (!box){
            box = document.createElement('div');
            box.id = 'accLightbox';
            box.className = 'acc-lightbox';
            box.hidden = true;
            box.innerHTML =
              '<button type="button" class="acc-lb-close" aria-label="إغلاق"><i class="fa-solid fa-xmark"></i></button>' +
              '<button type="button" class="acc-lb-nav acc-lb-prev" aria-label="السابق"><i class="fa-solid fa-chevron-right"></i></button>' +
              '<img class="acc-lb-img" alt="">' +
              '<button type="button" class="acc-lb-nav acc-lb-next" aria-label="التالي"><i class="fa-solid fa-chevron-left"></i></button>' +
              '<span class="acc-lb-count"></span>';
            document.body.appendChild(box);
          }
          var imgEl = box.querySelector('.acc-lb-img');
          var countEl = box.querySelector('.acc-lb-count');
          var prevEl = box.querySelector('.acc-lb-prev');
          var nextEl = box.querySelector('.acc-lb-next');
          function render(){
            imgEl.src = imgs[i];
            countEl.textContent = (i + 1) + ' / ' + imgs.length;
            var m = imgs.length > 1 ? '' : 'none';
            prevEl.style.display = m; nextEl.style.display = m; countEl.style.display = m;
          }
          function step(d){ i = (i + d) % imgs.length; if (i < 0) i += imgs.length; render(); }
          function onKey(e){
            if (e.key === 'Escape') close();
            else if (e.key === 'ArrowRight') step(-1);
            else if (e.key === 'ArrowLeft') step(1);
          }
          function close(){ box.hidden = true; try { document.removeEventListener('keydown', onKey); } catch(_){ } }
          box.onclick = function(e){ if (e.target === box) close(); };
          box.querySelector('.acc-lb-close').onclick = close;
          // RTL: the RIGHT chevron goes to the previous image, the LEFT to the next.
          prevEl.onclick = function(e){ e.stopPropagation(); step(-1); };
          nextEl.onclick = function(e){ e.stopPropagation(); step(1); };
          document.addEventListener('keydown', onKey);
          box.hidden = false;
          render();
        }

        function renderCards(listings){
          if (!state.refs) return;
          var grid = state.refs.grid;
          grid.innerHTML = '';
          if (!listings.length){
            setStatus(state.activeCategoryId ? 'لا توجد حسابات في هذا القسم حالياً.' : 'لا توجد حسابات معروضة حالياً.');
            return;
          }
          listings.forEach(function(listing){ grid.appendChild(buildCard(listing)); });
          setStatus('');
        }

        // Public-state labels/classes for the storefront (only these three states
        // are ever exposed by the `detail`/`browse` actions).
        function ensureDetailModal(){
          var modal = document.getElementById('accDetailModal');
          if (!modal){
            modal = document.createElement('div');
            modal.id = 'accDetailModal';
            modal.className = 'acc-modal';
            modal.hidden = true;
            document.body.appendChild(modal);
            modal.addEventListener('click', function(ev){ if (ev.target === modal) closeDetail(); });
          }
          if (!state.modalBound){
            state.modalBound = true;
            document.addEventListener('keydown', function(ev){ if (ev.key === 'Escape') closeDetail(); });
          }
          return modal;
        }

        function bindClose(modal){
          var btn = modal.querySelector('.acc-modal-close');
          if (btn) btn.addEventListener('click', closeDetail);
        }

        // Detail is a PAGE (#/accounts/<id>), not a modal. Navigating sets the
        // hash; onShow() decides which view to render, so back/forward and a
        // shared link all work.
        function goToDetail(listingId){
          var id = String(listingId || '').trim();
          if (!id) return;
          try { location.hash = '#/accounts/' + encodeURIComponent(id); } catch(_){ }
        }
        function backToMarket(){
          try { location.hash = '#/accounts'; } catch(_){ }
        }
        // A «قسم» page lives at #/accounts/c/<sectionId> — the `c/` prefix keeps section
        // ids from colliding with listing ids (#/accounts/<listingId>) and reserved words.
        function goToSection(id){
          var sid = String(id || '').trim();
          if (!sid) return;
          try { location.hash = '#/accounts/c/' + encodeURIComponent(sid); } catch(_){ }
        }
        function goToSub(name){
          try { location.hash = '#/accounts/' + name; } catch(_){ }
        }
        // The path parts AFTER 'accounts' (decoded). [] on the market home.
        function subPartsFromHash(){
          try {
            var raw = String(location.hash || '').replace(/^#\/?/, '').split(/[?#]/)[0];
            var parts = raw.split('/').filter(Boolean);
            if (parts.length >= 1 && String(parts[0]).toLowerCase() === 'accounts') {
              return parts.slice(1).map(function(p){ return decodeURIComponent(p || ''); });
            }
          } catch(_){ }
          return [];
        }
        // First sub-route token ('' while on the market home).
        function detailIdFromHash(){
          var parts = subPartsFromHash();
          return parts.length ? parts[0] : '';
        }

        function showMarketView(){
          if (!state.refs) return;
          state.refs.detailView.hidden = true;
          state.refs.detailView.innerHTML = '';
          state.refs.marketView.hidden = false;
        }

        function detailShell(inner, heading){
          return '<button type="button" class="acc-back-btn" id="accBackBtn">' +
                 '<i class="fa-solid fa-arrow-right"></i> رجوع</button>' +
                 (heading ? '<h2 class="acc-page-title">' + esc(heading) + '</h2>' : '') + inner;
        }
        // Render a full-page sub-view (never a modal) into the route root.
        function showSubPage(inner, heading){
          if (!state.refs) return null;
          state.refs.marketView.hidden = true;
          state.refs.detailView.hidden = false;
          state.refs.detailView.innerHTML = detailShell(inner, heading);
          bindDetailBack();
          return state.refs.detailView;
        }
        function requireSessionPage(heading){
          if (readAccountsSession()) return true;
          showSubPage('<div class="acc-status">يجب تسجيل الدخول أولًا.</div>', heading);
          try { location.hash = '#/login'; } catch(_){ }
          return false;
        }

        function bindDetailBack(){
          var btn = document.getElementById('accBackBtn');
          if (btn) btn.addEventListener('click', backToMarket);
        }

        function renderDetailMessage(message){
          if (!state.refs) return;
          state.refs.marketView.hidden = true;
          state.refs.detailView.hidden = false;
          state.refs.detailView.innerHTML = detailShell('<div class="acc-status">' + esc(message) + '</div>');
          bindDetailBack();
        }

        // Fetch the AUTHORITATIVE listing (`detail`) so a sold-out account can
        // never be bought off a stale grid, then render gallery + title + price +
        // description + CTA. No guarantee wording, no seller, no section, no steps.
        async function openDetailPage(listingId){
          ensureStyles();
          var id = String(listingId || '').trim();
          if (!id) { showMarketView(); return; }
          renderDetailMessage('جارِ التحميل…');
          var listing = null;
          try {
            var data = await callAccounts('detail', { listingId: id });
            listing = data && data.listing ? data.listing : null;
          } catch (err){
            if (err && (err.status === 404 || err.code === 'listing_not_found')){
              renderDetailMessage('لم يعد هذا الحساب متاحًا.');
              return;
            }
            renderDetailMessage('تعذّر تحميل الحساب.');
            return;
          }
          if (!listing) { renderDetailMessage('لم يعد هذا الحساب متاحًا.'); return; }
          if (detailIdFromHash() !== id) return;   // navigated away while loading
          renderDetail(listing);
        }

        function renderDetail(listing){
          var images = (Array.isArray(listing.images) ? listing.images : []).map(function(s){ return String(s || ''); }).filter(Boolean);
          var sold = String(listing.status || 'listed') !== 'listed';
          var multi = images.length > 1;
          var stage = images.length
            ? ('<img id="accDetailMain" class="acc-detail-main-img" alt="" src="' + esc(images[0]) + '">' +
               (multi ? '<button type="button" class="acc-nav acc-nav-prev" id="accDetailPrev" aria-label="السابق"><i class="fa-solid fa-chevron-right"></i></button>' : '') +
               (multi ? '<button type="button" class="acc-nav acc-nav-next" id="accDetailNext" aria-label="التالي"><i class="fa-solid fa-chevron-left"></i></button>' : '') +
               (multi ? '<span class="acc-card-count" id="accDetailCount">1/' + images.length + '</span>' : ''))
            : '<span class="acc-ph"><i class="fa-solid fa-user-lock"></i></span>';
          var thumbs = multi
            ? '<div class="acc-detail-thumbs">' + images.map(function(src, i){
                return '<img class="acc-detail-thumb' + (i === 0 ? ' is-active' : '') + '" data-i="' + i + '" alt="" src="' + esc(src) + '">';
              }).join('') + '</div>'
            : '';
          state.refs.marketView.hidden = true;
          state.refs.detailView.hidden = false;
          state.refs.detailView.innerHTML = detailShell([
            '<div class="acc-detail">',
            '  <div class="acc-detail-media"><div class="acc-detail-stage">' + stage + '</div>' + thumbs + '</div>',
            '  <div class="acc-detail-info">',
            '    <h2 class="acc-detail-title">' + esc(listing.title || 'حساب') + '</h2>',
            '    <div class="acc-detail-price">' + esc(fmtUsd(listing.price)) + '</div>',
            sold
              ? '    <button type="button" class="acc-buy-btn" disabled>تم البيع</button>'
              : '    <button type="button" class="acc-buy-btn" data-buy="1"><i class="fa-solid fa-cart-shopping"></i> شراء</button>',
            '  </div>',
            '</div>',
            listing.description ? '<div class="acc-detail-desc">' + esc(listing.description) + '</div>' : ''
          ].join(''));
          bindDetailBack();
          // Gallery: arrows + thumbnails swap the main image; the image (or the زوم
          // button) opens the full-screen lightbox — images are shown whole, never cropped.
          var detIdx = 0;
          var mainImg = document.getElementById('accDetailMain');
          var detCount = document.getElementById('accDetailCount');
          var thumbEls = state.refs.detailView.querySelectorAll('.acc-detail-thumb');
          function detShow(i){
            if (!images.length) return;
            detIdx = (i % images.length + images.length) % images.length;
            if (mainImg) mainImg.src = images[detIdx];
            if (detCount) detCount.textContent = (detIdx + 1) + '/' + images.length;
            thumbEls.forEach(function(x, j){ x.classList.toggle('is-active', j === detIdx); });
          }
          // RTL: the RIGHT chevron goes to the previous image, the LEFT to the next.
          var dp = document.getElementById('accDetailPrev'); if (dp) dp.addEventListener('click', function(){ detShow(detIdx - 1); });
          var dn = document.getElementById('accDetailNext'); if (dn) dn.addEventListener('click', function(){ detShow(detIdx + 1); });
          if (mainImg) mainImg.addEventListener('click', function(){ openLightbox(images, detIdx); });
          thumbEls.forEach(function(t){ t.addEventListener('click', function(){ detShow(Number(t.getAttribute('data-i')) || 0); }); });
          var buyBtn = state.refs.detailView.querySelector('[data-buy="1"]');
          if (buyBtn) buyBtn.addEventListener('click', function(){ onPurchaseClick(listing, buyBtn); });
        }

        // Real purchase (F1): the SERVER reserves the listing atomically and holds
        // the buyer's balance in escrow. It rejects buying your own listing and one
        // someone else just took, so the button only has to report the outcome.
        async function onPurchaseClick(listing, btn){
          var id = String((listing && (listing.listingId || listing.id)) || '').trim();
          if (!id) return;
          if (!readAccountsSession()){
            toast('يجب تسجيل الدخول لإتمام الشراء.', 'info');
            try { location.hash = '#/login'; } catch(_){ }
            return;
          }
          if (typeof window.confirm === 'function' &&
              !window.confirm('شراء «' + (listing.title || 'حساب') + '» بمبلغ ' + fmtUsd(listing.price) + '؟')) return;
          if (btn) btn.disabled = true;
          try {
            await callAccounts('purchase', { listingId: id }, { auth: true });
            toast('تم تنفيذ الشراء. تابع التسليم من «مشترياتي».', 'success');
            openMyPurchasesPage();
          } catch (err){
            if (btn) btn.disabled = false;
            var code = String((err && err.code) || '');
            if (code === 'login_required' || (err && err.status === 401)){
              toast('يجب تسجيل الدخول لإتمام الشراء.', 'info');
              try { location.hash = '#/login'; } catch(_){ }
              return;
            }
            if (code === 'sold_out'){
              toast('عذرًا، بِيع هذا الحساب للتوّ.', 'error');
              openDetailPage(id);
              return;
            }
            toast(String((err && err.message) || 'تعذّر إتمام الشراء.'), 'error');
          }
        }

        // ---- «اعرض حسابك» — E4 seller submit (authed) ----------------------
        // Title + description + several images + category + price + a HIDDEN
        // contact only. HARD RULE: never ask for account login credentials — the
        // form states this explicitly and the payload has no credential field.
        // Submits at pending_review (the admin reviews before it goes live).
        var submitState = { images: [] };

        // Downscale + JPEG-compress client-side so the images_json payload stays
        // reasonable (falls back to the raw data URL on any canvas error).
        function compressImage(file, maxDim, quality){
          return new Promise(function(resolve){
            try {
              var reader = new FileReader();
              reader.onload = function(){
                var raw = String(reader.result || '');
                var img = new Image();
                img.onload = function(){
                  try {
                    var w = img.width, h = img.height;
                    var scale = Math.min(1, (maxDim || 1280) / Math.max(w, h));
                    var cw = Math.max(1, Math.round(w * scale));
                    var ch = Math.max(1, Math.round(h * scale));
                    var canvas = document.createElement('canvas');
                    canvas.width = cw; canvas.height = ch;
                    canvas.getContext('2d').drawImage(img, 0, 0, cw, ch);
                    resolve(canvas.toDataURL('image/jpeg', quality || 0.8));
                  } catch(_){ resolve(raw); }
                };
                img.onerror = function(){ resolve(raw); };
                img.src = raw;
              };
              reader.onerror = function(){ resolve(''); };
              reader.readAsDataURL(file);
            } catch(_){ resolve(''); }
          });
        }

        function renderSubmitThumbs(modal){
          var host = modal.querySelector('#accImgs');
          if (!host) return;
          host.innerHTML = submitState.images.map(function(src, i){
            return '<div class="thumb"><img alt="" src="' + esc(src) + '"><button type="button" data-rm="' + i + '" aria-label="حذف">&times;</button></div>';
          }).join('');
          host.querySelectorAll('[data-rm]').forEach(function(btn){
            btn.addEventListener('click', function(){
              var idx = parseInt(btn.getAttribute('data-rm'), 10);
              if (idx >= 0){ submitState.images.splice(idx, 1); renderSubmitThumbs(modal); }
            });
          });
        }

        // «اعرض حسابك» — a PAGE (#/accounts/sell). No hidden-contact field: the
        // seller hands the account over in the deal chat, so there was nothing
        // for a private handle to do. The no-credentials rule now lives as a
        // hint on the two fields where someone might actually type them.
        async function openSellPage(){
          ensureStyles();
          if (!requireSessionPage('اعرض حسابك للبيع')) return;
          submitState.images = [];
          if (!state.categoriesLoaded){ try { await loadCategories(); } catch(_){ } }
          if (detailIdFromHash() !== 'sell') return;
          var catOptions = state.categories.map(function(c){
            return '<option value="' + esc(c.categoryId) + '">' + esc(c.name || '—') + '</option>';
          }).join('');
          var host = showSubPage([
            '<div class="acc-form">',
            '  <div class="acc-field"><label>عنوان الحساب</label>',
            '    <input id="accfTitle" type="text" maxlength="120" placeholder="مثال: حساب لعبة رتبة أسطوري">',
            '    <span class="hint">لا تُدخل بيانات الدخول (اسم مستخدم/كلمة مرور).</span></div>',
            '  <div class="acc-field"><label>القسم</label><select id="accfCat">' + (catOptions || '<option value="">—</option>') + '</select></div>',
            '  <div class="acc-field"><label>الوصف</label>',
            '    <textarea id="accfDesc" maxlength="2000" placeholder="تفاصيل الحساب"></textarea>',
            '    <span class="hint">لا تُدخل بيانات الدخول (اسم مستخدم/كلمة مرور).</span></div>',
            '  <div class="acc-field"><label>السعر (بالدولار)</label><input id="accfPrice" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0.00"></div>',
            '  <div class="acc-field"><label>الصور (حتى 12)</label>',
            '    <label class="acc-upload" for="accfFile"><i class="fa-solid fa-cloud-arrow-up"></i> اختر صورًا</label>',
            '    <input id="accfFile" type="file" accept="image/*" multiple hidden>',
            '    <div class="acc-imgs" id="accImgs"></div>',
            '  </div>',
            '  <button type="button" class="acc-submit" id="accfSubmit"><i class="fa-solid fa-paper-plane"></i> إرسال للمراجعة</button>',
            '</div>'
          ].join(''), 'اعرض حسابك للبيع');
          if (!host) return;
          var fileInput = host.querySelector('#accfFile');
          fileInput.addEventListener('change', async function(){
            var files = Array.prototype.slice.call(fileInput.files || []);
            for (var i = 0; i < files.length && submitState.images.length < 12; i += 1){
              var durl = await compressImage(files[i], 1280, 0.8);
              if (durl) submitState.images.push(durl);
            }
            fileInput.value = '';
            renderSubmitThumbs(host);
          });
          var submitBtn = host.querySelector('#accfSubmit');
          submitBtn.addEventListener('click', function(){ submitListing(host, submitBtn); });
        }

        async function submitListing(host, submitBtn){
          var q = function(sel){ return host.querySelector(sel); };
          var title = String((q('#accfTitle') || {}).value || '').trim();
          var categoryId = String((q('#accfCat') || {}).value || '').trim();
          var description = String((q('#accfDesc') || {}).value || '').trim();
          var price = Number((q('#accfPrice') || {}).value);
          if (!title){ toast('أدخل عنوان الحساب.', 'error'); return; }
          if (!categoryId){ toast('اختر قسمًا.', 'error'); return; }
          if (!Number.isFinite(price) || price <= 0){ toast('أدخل سعرًا صحيحًا.', 'error'); return; }
          var prevHtml = submitBtn.innerHTML;
          submitBtn.disabled = true;
          submitBtn.innerHTML = 'جارِ الإرسال…';
          try {
            await callAccounts('submit', {
              listing: { title: title, categoryId: categoryId, description: description, price: price, images: submitState.images.slice(0, 12) }
            }, { auth: true });
            submitState.images = [];
            toast('تم إرسال حسابك للمراجعة. سيظهر بعد قبوله.', 'success');
            goToSub('mine');
          } catch (err){
            if (err && (err.code === 'login_required' || err.status === 401)){
              toast('انتهت الجلسة. سجّل الدخول من جديد.', 'error');
              try { location.hash = '#/login'; } catch(_){ }
            } else {
              toast(String((err && err.message) || 'تعذّر إرسال العرض.'), 'error');
            }
            submitBtn.disabled = false;
            submitBtn.innerHTML = prevHtml;
          }
        }

        // ---- «حساباتي المعروضة» — E5 seller's own listings (authed) ---------
        // All SIX states can appear here (unlike the public browse). Delete is
        // offered ONLY for pending_review/listed (states 1 & 2); the server
        // re-checks ownership + state — the client gate is just UX.
        var ALL_STATE_LABEL = {
          pending_review: 'بانتظار المراجعة', listed: 'معروض للبيع', in_order: 'طلب جارٍ',
          sold: 'تم البيع', rejected: 'مرفوض', refunded: 'مسترد'
        };
        var ALL_STATE_CLASS = {
          pending_review: 'acc-status-busy', listed: 'acc-status-listed', in_order: 'acc-status-busy',
          sold: 'acc-status-sold', rejected: 'acc-status-sold', refunded: 'acc-status-sold'
        };

        // «حساباتي المعروضة» — a PAGE (#/accounts/mine).
        async function openMyListingsPage(){
          ensureStyles();
          if (!requireSessionPage('حساباتي المعروضة')) return;
          showSubPage('<div class="acc-status">جارِ التحميل…</div>', 'حساباتي المعروضة');
          try {
            var data = await callAccounts('my_listings', {}, { auth: true });
            if (detailIdFromHash() !== 'mine') return;
            renderMyListings(Array.isArray(data.listings) ? data.listings : []);
          } catch (err){
            if (err && (err.code === 'login_required' || err.status === 401)){
              showSubPage('<div class="acc-status">انتهت الجلسة. سجّل الدخول من جديد.</div>', 'حساباتي المعروضة');
              try { location.hash = '#/login'; } catch(_){ }
            } else {
              showSubPage('<div class="acc-status">تعذّر تحميل حساباتك.</div>', 'حساباتي المعروضة');
            }
          }
        }

        function renderMyListings(listings){
          var rows = listings.length ? listings.map(function(l){
            var st = String(l.status || '');
            var label = ALL_STATE_LABEL[st] || st;
            var cls = ALL_STATE_CLASS[st] || 'acc-status-busy';
            var canDelete = (st === 'pending_review' || st === 'listed');
            // Once a listing is under an order, the seller reaches the SAME deal
            // thread the buyer sees, through the listing's active order.
            var orderId = String(l.activeOrderId || '');
            var rejectLine = (st === 'rejected' && l.rejectReason)
              ? '<div class="acc-my-reject"><i class="fa-solid fa-circle-xmark"></i> سبب الرفض: ' + esc(l.rejectReason) + '</div>'
              : '';
            return '<div class="acc-my-row">' +
              '<div class="acc-my-info"><div class="acc-my-title">' + esc(l.title || 'حساب') + '</div>' +
              '<div class="acc-my-meta"><span class="acc-status-pill ' + cls + '">' + esc(label) + '</span><span>' + esc(fmtUsd(l.price)) + '</span></div>' +
              rejectLine + '</div>' +
              (orderId ? '<button type="button" class="acc-action-btn" data-chat="' + esc(orderId) + '"><i class="fa-solid fa-comments"></i> محادثة' + unreadBadge(l.unread) + '</button>' : '') +
              (canDelete ? '<button type="button" class="acc-my-del" data-del="' + esc(l.listingId) + '" aria-label="حذف"><i class="fa-solid fa-trash"></i></button>' : '') +
              '</div>';
          }).join('') : '<div class="acc-status">لا توجد حسابات معروضة بعد.</div>';
          var host = showSubPage('<div class="acc-my-list">' + rows + '</div>', 'حساباتي المعروضة');
          if (!host) return;
          host.querySelectorAll('[data-del]').forEach(function(btn){
            btn.addEventListener('click', function(){ deleteMyListing(btn.getAttribute('data-del'), btn); });
          });
          host.querySelectorAll('[data-chat]').forEach(function(btn){
            btn.addEventListener('click', function(){ openDealChat(btn.getAttribute('data-chat')); });
          });
        }

        async function deleteMyListing(listingId, btn){
          if (!listingId) return;
          if (typeof window.confirm === 'function' && !window.confirm('حذف هذا الحساب من العرض؟')) return;
          btn.disabled = true;
          try {
            await callAccounts('delete_listing', { listingId: listingId }, { auth: true });
            var row = btn.closest ? btn.closest('.acc-my-row') : null;
            if (row) row.remove();
            toast('تم حذف الحساب.', 'success');
            // The market/قسم page re-loads its listings on next navigation, so no
            // in-place grid refresh is needed here.
          } catch (err){
            btn.disabled = false;
            toast(String((err && err.message) || 'تعذّر الحذف.'), 'error');
          }
        }

        // ---- «مشترياتي» — E6 buyer's escrow orders (authed) -----------------
        // Order states (distinct from listing states). The buyer confirms receipt
        // on a chat order (starts the server hold counter); the hold-remaining is
        // computed from the STORED deliveredAtMs + holdDays (display only — the
        // server re-checks the real gate on the seller's withdrawal).
        var ORDER_STATE_LABEL = {
          in_order: 'طلب جارٍ', delivered: 'بانتظار انتهاء الضمان', completed: 'مكتمل',
          refunded: 'مسترد', disputed: 'قيد التحكيم'
        };
        var ORDER_STATE_CLASS = {
          in_order: 'acc-status-busy', delivered: 'acc-status-busy', completed: 'acc-status-listed',
          refunded: 'acc-status-sold', disputed: 'acc-status-busy'
        };

        function holdRemainingText(order){
          var deliveredAt = Number(order.deliveredAtMs || 0);
          if (!deliveredAt) return '';
          var readyAt = deliveredAt + Math.max(0, Number(order.holdDays || 0)) * 86400000;
          var remain = readyAt - Date.now();
          if (remain <= 0) return 'انتهت مدة الضمان';
          return 'يُحرَّر للبائع خلال ~' + Math.ceil(remain / 86400000) + ' يوم';
        }

        // «مشترياتي» — a PAGE (#/accounts/purchases), like «طلباتي» on the
        // shipping side. No modal.
        async function openMyPurchasesPage(){
          ensureStyles();
          if (!requireSessionPage('مشترياتي')) return;
          showSubPage('<div class="acc-status">جارِ التحميل…</div>', 'مشترياتي');
          if (!state.categoriesLoaded){ try { await loadCategories(); } catch(_){ } }
          try {
            var data = await callAccounts('my_purchases', {}, { auth: true });
            if (detailIdFromHash() !== 'purchases') return;
            renderMyPurchases(Array.isArray(data.orders) ? data.orders : []);
          } catch (err){
            if (err && (err.code === 'login_required' || err.status === 401)){
              showSubPage('<div class="acc-status">انتهت الجلسة. سجّل الدخول من جديد.</div>', 'مشترياتي');
              try { location.hash = '#/login'; } catch(_){ }
            } else {
              showSubPage('<div class="acc-status">تعذّر تحميل مشترياتك.</div>', 'مشترياتي');
            }
          }
        }

        function renderMyPurchases(orders){
          var rows = orders.length ? orders.map(function(o){
            var st = String(o.status || '');
            var label = ORDER_STATE_LABEL[st] || st;
            var cls = ORDER_STATE_CLASS[st] || 'acc-status-busy';
            var catName = categoryName(o.categoryId);
            var canConfirm = (st === 'in_order' && o.deliveryMode === 'chat');
            var canRate = (st === 'completed' && o.hasSeller);
            // The dispute button unlocks 24h after the order — this check is for
            // DISPLAY only; the server re-checks the same window (open_dispute).
            var canDispute = (st === 'in_order' || st === 'delivered' || st === 'completed') &&
                             (Date.now() >= Number(o.createdAtMs || 0) + 86400000);
            var info = (st === 'delivered') ? holdRemainingText(o) : '';
            // What the buyer was actually CHARGED (price + the site's margin),
            // which the server hands over as amountMills — not the bare price.
            var paid = Number(o.amountMills || 0) > 0 ? Number(o.amountMills) / 1000 : Number(o.price || 0);
            return '<div class="acc-my-row">' +
              '<div class="acc-my-info">' +
                '<div class="acc-my-title">' + esc(catName || 'حساب') + ' — ' + esc(fmtUsd(paid)) + '</div>' +
                '<div class="acc-my-meta"><span class="acc-status-pill ' + cls + '">' + esc(label) + '</span>' +
                  (info ? '<span>' + esc(info) + '</span>' : '') +
                '</div>' +
              '</div>' +
              (canConfirm ? '<button type="button" class="acc-action-btn" data-recv="' + esc(o.orderId) + '">تم الاستلام</button>' : '') +
              (canRate ? '<button type="button" class="acc-action-btn" data-rate="' + esc(o.orderId) + '"><i class="fa-solid fa-star"></i> قيّم</button>' : '') +
              '<button type="button" class="acc-action-btn" data-chat="' + esc(o.orderId) + '"><i class="fa-solid fa-comments"></i> محادثة' + unreadBadge(o.unread) + '</button>' +
              (canDispute ? '<button type="button" class="acc-action-btn" data-dispute="' + esc(o.orderId) + '"><i class="fa-solid fa-scale-balanced"></i> فتح نزاع</button>' : '') +
              '</div>';
          }).join('') : '<div class="acc-status">لا مشتريات بعد.</div>';
          var host = showSubPage('<div class="acc-my-list">' + rows + '</div>', 'مشترياتي');
          if (!host) return;
          host.querySelectorAll('[data-recv]').forEach(function(btn){
            btn.addEventListener('click', function(){ confirmReceived(btn.getAttribute('data-recv'), btn); });
          });
          host.querySelectorAll('[data-rate]').forEach(function(btn){
            btn.addEventListener('click', function(){ rateSeller(btn.getAttribute('data-rate'), btn); });
          });
          host.querySelectorAll('[data-dispute]').forEach(function(btn){
            btn.addEventListener('click', function(){ openDispute(btn.getAttribute('data-dispute'), btn); });
          });
          host.querySelectorAll('[data-chat]').forEach(function(btn){
            btn.addEventListener('click', function(){ openDealChat(btn.getAttribute('data-chat')); });
          });
        }

        async function rateSeller(orderId, btn){
          if (!orderId) return;
          var raw = (typeof window.prompt === 'function') ? window.prompt('قيّم البائع من 1 إلى 5 نجوم:', '5') : '5';
          if (raw === null) return;
          var stars = Math.round(Number(raw));
          if (!(stars >= 1 && stars <= 5)) { toast('أدخل رقمًا من 1 إلى 5.', 'error'); return; }
          btn.disabled = true;
          try {
            await callAccounts('rate', { orderId: orderId, stars: stars }, { auth: true });
            toast('شكرًا! تم حفظ تقييمك.', 'success');
            openMyPurchasesPage();   // refresh
          } catch (err){
            btn.disabled = false;
            toast(String((err && err.message) || 'تعذّر حفظ التقييم.'), 'error');
          }
        }

        async function confirmReceived(orderId, btn){
          if (!orderId) return;
          if (typeof window.confirm === 'function' &&
              !window.confirm('تأكيد الاستلام يبدأ مدة الضمان ولا يمكن التراجع عنه. متابعة؟')) return;
          btn.disabled = true;
          try {
            await callAccounts('confirm_received', { orderId: orderId }, { auth: true });
            toast('تم تأكيد الاستلام. بدأت مدة الضمان.', 'success');
            openMyPurchasesPage();   // refresh
          } catch (err){
            btn.disabled = false;
            toast(String((err && err.message) || 'تعذّر تأكيد الاستلام.'), 'error');
          }
        }

        // ---- «مبيعاتي» — the SELLER's escrow orders + the payout ------------
        // The server action (F3 withdraw) shipped without any storefront path to
        // it, so a C2C seller's money stayed locked in escrow with no way out.
        // The gate itself is SERVER-side: `canWithdraw` / `readyAtMs` come from
        // the response, and `withdraw` re-checks the window before moving money —
        // this page only reflects that verdict (never the browser's clock).
        function sellerHoldText(order){
          var readyAt = Number(order.readyAtMs || 0);
          if (!readyAt) return '';
          var remain = readyAt - Date.now();
          if (remain <= 0) return 'انتهت مدة الضمان — يمكنك السحب';
          return 'تُحرَّر أرباحك خلال ~' + Math.ceil(remain / 86400000) + ' يوم';
        }

        async function openMySalesPage(){
          ensureStyles();
          if (!requireSessionPage('مبيعاتي')) return;
          showSubPage('<div class="acc-status">جارِ التحميل…</div>', 'مبيعاتي');
          if (!state.categoriesLoaded){ try { await loadCategories(); } catch(_){ } }
          try {
            var data = await callAccounts('my_sales', {}, { auth: true });
            if (detailIdFromHash() !== 'sales') return;
            renderMySales(Array.isArray(data.orders) ? data.orders : []);
          } catch (err){
            if (err && (err.code === 'login_required' || err.status === 401)){
              showSubPage('<div class="acc-status">انتهت الجلسة. سجّل الدخول من جديد.</div>', 'مبيعاتي');
              try { location.hash = '#/login'; } catch(_){ }
            } else {
              showSubPage('<div class="acc-status">تعذّر تحميل مبيعاتك.</div>', 'مبيعاتي');
            }
          }
        }

        function renderMySales(orders){
          var rows = orders.length ? orders.map(function(o){
            var st = String(o.status || '');
            var label = ORDER_STATE_LABEL[st] || st;
            var cls = ORDER_STATE_CLASS[st] || 'acc-status-busy';
            var catName = categoryName(o.categoryId);
            var net = fmtUsd(Number(o.amountMills || 0) / 1000);
            var info = (st === 'delivered') ? sellerHoldText(o) : '';
            // The dispute button mirrors «مشترياتي» (display-only 24h check).
            var canDispute = (st === 'in_order' || st === 'delivered' || st === 'completed') &&
                             (Date.now() >= Number(o.createdAtMs || 0) + 86400000);
            return '<div class="acc-my-row">' +
              '<div class="acc-my-info">' +
                '<div class="acc-my-title">' + esc(catName || 'حساب') + ' — صافي ' + esc(net) + '</div>' +
                '<div class="acc-my-meta"><span class="acc-status-pill ' + cls + '">' + esc(label) + '</span>' +
                  (info ? '<span>' + esc(info) + '</span>' : '') +
                '</div>' +
              '</div>' +
              (o.canWithdraw ? '<button type="button" class="acc-action-btn acc-withdraw-btn" data-wd="' + esc(o.orderId) + '"><i class="fa-solid fa-money-bill-transfer"></i> سحب الأرباح</button>' : '') +
              '<button type="button" class="acc-action-btn" data-chat="' + esc(o.orderId) + '"><i class="fa-solid fa-comments"></i> محادثة' + unreadBadge(o.unread) + '</button>' +
              (canDispute ? '<button type="button" class="acc-action-btn" data-dispute="' + esc(o.orderId) + '"><i class="fa-solid fa-scale-balanced"></i> فتح نزاع</button>' : '') +
              '</div>';
          }).join('') : '<div class="acc-status">لا مبيعات بعد.</div>';
          var host = showSubPage('<div class="acc-my-list">' + rows + '</div>', 'مبيعاتي');
          if (!host) return;
          host.querySelectorAll('[data-wd]').forEach(function(btn){
            btn.addEventListener('click', function(){ withdrawSale(btn.getAttribute('data-wd'), btn); });
          });
          host.querySelectorAll('[data-chat]').forEach(function(btn){
            btn.addEventListener('click', function(){ openDealChat(btn.getAttribute('data-chat')); });
          });
          host.querySelectorAll('[data-dispute]').forEach(function(btn){
            btn.addEventListener('click', function(){ openDispute(btn.getAttribute('data-dispute'), btn); });
          });
        }

        async function withdrawSale(orderId, btn){
          if (!orderId) return;
          if (typeof window.confirm === 'function' &&
              !window.confirm('سحب أرباح هذه الصفقة إلى رصيدك؟ تُغلق الصفقة نهائيًا بعد السحب.')) return;
          btn.disabled = true;
          try {
            var res = await callAccounts('withdraw', { orderId: orderId }, { auth: true });
            var net = fmtUsd(Number((res && res.sellerNetMills) || 0) / 1000);
            toast('تم تحويل ' + net + ' إلى رصيدك.', 'success');
            openMySalesPage();   // refresh
          } catch (err){
            btn.disabled = false;
            // The server owns the window: a client that got out of sync is told
            // exactly why (hold still running / already withdrawn) and re-reads.
            var code = String((err && err.code) || '');
            if (code === 'hold_active' || code === 'already_withdrawn' || code === 'not_deliverable'){
              toast(String((err && err.message) || 'تعذّر السحب.'), 'info');
              openMySalesPage();
              return;
            }
            toast(String((err && err.message) || 'تعذّر السحب.'), 'error');
          }
        }

        function closeDetail(){
          stopChatPolling();   // a deal thread may be the open modal
          var modal = document.getElementById('accDetailModal');
          if (modal) modal.hidden = true;
        }

        // ---- «محادثة الصفقة» — G1 deal chat (authed, both parties) -----------
        // One thread per ORDER, polled every 5s with a `sinceMs` delta (the same
        // per-message + polling design as the support chat, on the accounts
        // tables). The SERVER decides who may read/write and whether the thread is
        // still open (`canSend`) — this UI only reflects that.
        var CHAT_POLL_MS = 5000;

        function stopChatPolling(){
          if (state.chat && state.chat.timer){
            try { clearInterval(state.chat.timer); } catch(_){ }
          }
          state.chat = null;
        }

        function chatShell(inner, title){
          return '<div class="acc-modal-card"><button type="button" class="acc-modal-close" aria-label="إغلاق">&times;</button>' +
                 '<h3>' + esc(title || 'محادثة الصفقة') + '</h3>' + inner + '</div>';
        }

        function chatTime(ms){
          var n = Number(ms || 0);
          if (!n) return '';
          try { return new Date(n).toLocaleString('ar', { dateStyle: 'short', timeStyle: 'short' }); }
          catch(_){ return ''; }
        }

        function messageHtml(msg, myRole){
          var role = String(msg.senderRole || '');
          var mine = role === myRole;
          var cls = role === 'admin' || role === 'system'
            ? 'acc-msg-admin'
            : (mine ? 'acc-msg-mine' : 'acc-msg-theirs');
          var who = role === 'admin' ? 'إدارة الموقع' : String(msg.authorName || (mine ? 'أنا' : ''));
          var media = '';
          var url = String(msg.mediaUrl || '');
          if (url){
            if (String(msg.mediaType || '') === 'video') media = '<video src="' + esc(url) + '" controls playsinline></video>';
            else if (String(msg.mediaType || '') === 'audio') media = '<audio src="' + esc(url) + '" controls style="width:100%;margin-top:5px;"></audio>';
            else media = '<img src="' + esc(url) + '" alt="مرفق" loading="lazy">';
          }
          return '<div class="acc-msg ' + cls + '">' +
            (who ? '<span class="who">' + esc(who) + '</span>' : '') +
            esc(msg.text || '') + media +
            '<span class="at">' + esc(chatTime(msg.createdAtMs)) + '</span>' +
            '</div>';
        }

        function appendMessages(messages){
          var body = document.getElementById('accChatBody');
          if (!body || !state.chat) return;
          var myRole = state.chat.role;
          var html = '';
          for (var i = 0; i < messages.length; i += 1){
            html += messageHtml(messages[i], myRole);
            var at = Number(messages[i].createdAtMs || 0);
            if (at > state.chat.lastMs) state.chat.lastMs = at;
          }
          if (!html) return;
          body.insertAdjacentHTML('beforeend', html);
          body.scrollTop = body.scrollHeight;
        }

        async function openDealChat(orderId){
          if (!orderId) return;
          if (!readAccountsSession()){
            toast('يجب تسجيل الدخول لفتح المحادثة.', 'info');
            try { location.hash = '#/login'; } catch(_){ }
            return;
          }
          ensureStyles();
          stopChatPolling();
          var modal = ensureDetailModal();
          modal.innerHTML = chatShell('<div class="acc-modal-loading">جارِ فتح المحادثة…</div>');
          bindClose(modal);
          modal.hidden = false;
          var data;
          try {
            data = await callAccounts('chat_list', { orderId: orderId }, { auth: true });
          } catch (err){
            var msg = (err && (err.code === 'login_required' || err.status === 401))
              ? 'انتهت الجلسة. سجّل الدخول من جديد.'
              : String((err && err.message) || 'تعذّر فتح المحادثة.');
            modal.innerHTML = chatShell('<div class="acc-modal-loading">' + esc(msg) + '</div>');
            bindClose(modal);
            return;
          }
          state.chat = { orderId: orderId, role: String(data.role || 'buyer'), lastMs: 0, timer: null };
          var canSend = data.canSend === true;
          modal.innerHTML = chatShell(
            '<div class="acc-chat-wrap">' +
              '<div class="acc-chat-meta">الطرف الآخر: ' + esc(data.counterpartName || '—') + '</div>' +
              '<div class="acc-chat-body" id="accChatBody"></div>' +
              (canSend
                ? '<div class="acc-chat-form">' +
                    '<input type="file" id="accChatFile" accept="image/*" hidden>' +
                    '<button type="button" class="acc-chat-btn acc-chat-clip" id="accChatClip" aria-label="إرفاق صورة"><i class="fa-solid fa-paperclip"></i></button>' +
                    '<input type="text" class="acc-chat-input" id="accChatText" placeholder="اكتب رسالتك…" autocomplete="off">' +
                    '<button type="button" class="acc-chat-btn acc-chat-send" id="accChatSend" aria-label="إرسال"><i class="fa-solid fa-paper-plane"></i></button>' +
                  '</div>'
                : '<div class="acc-chat-closed">أُغلقت محادثة هذه الصفقة.</div>') +
            '</div>',
            'محادثة الصفقة'
          );
          bindClose(modal);
          appendMessages(Array.isArray(data.messages) ? data.messages : []);
          if (canSend){
            var sendBtn = document.getElementById('accChatSend');
            var input = document.getElementById('accChatText');
            var clip = document.getElementById('accChatClip');
            var file = document.getElementById('accChatFile');
            if (sendBtn) sendBtn.addEventListener('click', sendChatMessage);
            if (input) input.addEventListener('keydown', function(ev){ if (ev.key === 'Enter') sendChatMessage(); });
            if (clip && file) clip.addEventListener('click', function(){ file.click(); });
            if (file) file.addEventListener('change', function(){ sendChatImage(file.files && file.files[0]); file.value = ''; });
          }
          state.chat.timer = setInterval(pollChat, CHAT_POLL_MS);
        }

        // Poll the DELTA only (sinceMs = the newest message we already render).
        // Every poll also refreshes presence server-side, which is what keeps a
        // telegram/email push from firing while the party is watching (G2).
        async function pollChat(){
          if (!state.chat) return;
          var chat = state.chat;
          try {
            var data = await callAccounts('chat_list', { orderId: chat.orderId, sinceMs: chat.lastMs }, { auth: true });
            if (!state.chat || state.chat !== chat) return;   // the modal closed meanwhile
            appendMessages(Array.isArray(data.messages) ? data.messages : []);
          } catch(_){ /* a transient poll failure must not kill the thread */ }
        }

        async function sendChatMessage(){
          if (!state.chat) return;
          var input = document.getElementById('accChatText');
          var btn = document.getElementById('accChatSend');
          var text = String((input && input.value) || '').trim();
          if (!text) return;
          if (btn) btn.disabled = true;
          try {
            var data = await callAccounts('chat_send', { orderId: state.chat.orderId, text: text }, { auth: true });
            if (input) input.value = '';
            if (data && data.message) appendMessages([data.message]);
          } catch (err){
            toast(String((err && err.message) || 'تعذّر إرسال الرسالة.'), 'error');
          } finally {
            if (btn) btn.disabled = false;
          }
        }

        // Attachments go through the SAME upload endpoint the support chat uses
        // (mode=user-upload-image, entity=accounts-chat → the server picks the
        // folder and keys it by the authenticated uid). Only the resulting URL is
        // stored — a data: URL would blow past D1's ~1MB per-value limit.
        async function sendChatImage(file){
          if (!file || !state.chat) return;
          var type = String(file.type || '').toLowerCase();
          if (!type.indexOf || type.indexOf('image/') !== 0){ toast('اختر ملف صورة فقط.', 'error'); return; }
          if (Number(file.size || 0) > 5 * 1024 * 1024){ toast('حجم الصورة يتجاوز 5MB.', 'error'); return; }
          var clip = document.getElementById('accChatClip');
          if (clip) clip.disabled = true;
          try {
            var url = await uploadChatImage(file);
            if (!url) throw new Error('تعذّر رفع الصورة.');
            var data = await callAccounts('chat_send',
              { orderId: state.chat.orderId, mediaUrl: url, mediaType: 'image' }, { auth: true });
            if (data && data.message) appendMessages([data.message]);
          } catch (err){
            toast(String((err && err.message) || 'تعذّر إرسال الصورة.'), 'error');
          } finally {
            if (clip) clip.disabled = false;
          }
        }

        function fileToBase64(file){
          return new Promise(function(resolve, reject){
            var reader = new FileReader();
            reader.onload = function(){
              var raw = String(reader.result || '');
              var comma = raw.indexOf(',');
              resolve(comma >= 0 ? raw.slice(comma + 1) : raw);
            };
            reader.onerror = function(){ reject(new Error('تعذّر قراءة الصورة.')); };
            reader.readAsDataURL(file);
          });
        }

        // The upload endpoint authenticates with a Firebase ID token (it is NOT one
        // of the session-key-backed modes), exactly like the support chat upload.
        async function chatIdToken(){
          try { if (typeof window.__ensureAuthReady === 'function') await window.__ensureAuthReady(); } catch(_){ }
          try {
            var auth = (window.firebase && typeof window.firebase.auth === 'function') ? window.firebase.auth() : null;
            var user = auth && auth.currentUser;
            if (user && typeof user.getIdToken === 'function') return String((await user.getIdToken(false)) || '').trim();
          } catch(_){ }
          return '';
        }

        async function uploadChatImage(file){
          var base = workerBase();
          if (!base) throw new Error('تعذّر الوصول للخادم.');
          var idToken = await chatIdToken();
          if (!idToken) throw new Error('سجّل الدخول من جديد لإرسال الصور.');
          var data = await fileToBase64(file);
          if (!data) throw new Error('تعذّر قراءة الصورة.');
          var url = base + '/?action=pru&mode=user-upload-image';
          var res = await fetch(url, {
            method: 'POST',
            cache: 'no-store',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + idToken },
            body: JSON.stringify({
              filename: file.name || 'accounts-chat',
              mimeType: file.type || '',
              data: data,
              entity: 'accounts-chat'
            })
          });
          var payload = await res.json().catch(function(){ return null; });
          if (!res.ok || !payload) throw new Error(String((payload && (payload.message || payload.error)) || 'تعذّر رفع الصورة.'));
          return String(payload.imageUrl || payload.url || '').trim();
        }

        // Loads the «قسم» list (used by the home grid + the seller's «اعرض حسابك»
        // picker). Rendering is decided by onShow, not here.
        async function loadCategories(){
          if (state.categoriesLoaded) return true;
          try {
            var data = await callAccounts('categories', {});
            state.categories = Array.isArray(data.categories) ? data.categories : [];
            state.categoriesLoaded = true;
            state.disabled = false;
            return true;
          } catch (err){
            if (err && err.code === 'accounts_disabled'){
              state.disabled = true;
              setStatus('قسم الحسابات غير متاح حالياً.');
              return false;
            }
            state.categoriesLoaded = true; // non-fatal: home just shows «لا توجد أقسام»
            return true;
          }
        }

        // Loads + renders a «قسم» PAGE: its «فرز» buckets, each with its accounts.
        async function loadSectionPage(sectionId){
          var token = ++state.loadToken;
          setStatus('جارِ التحميل…');
          try {
            var data = await callAccounts('browse', { sectionId: sectionId, limit: 200 });
            if (token !== state.loadToken) return;
            var section = null;
            for (var i = 0; i < state.categories.length; i += 1){
              if (state.categories[i].categoryId === sectionId){ section = state.categories[i]; break; }
            }
            renderSectionPage(section, Array.isArray(data.sorts) ? data.sorts : []);
          } catch (err){
            if (token !== state.loadToken) return;
            if (err && err.code === 'accounts_disabled'){
              state.disabled = true;
              setStatus('قسم الحسابات غير متاح حالياً.');
              return;
            }
            setStatus('تعذّر تحميل الحسابات. حاول مرة أخرى لاحقاً.');
          }
        }

        function build(){
          var root = ensureRoot();
          var frag = document.createDocumentFragment();
          frag.appendChild(root);
          return frag;
        }

        async function onShow(){
          // The app router AND this route's own hashchange listener (below) can both
          // invoke onShow for the SAME navigation — which was firing duplicate
          // POST /accounts/ loads (categories + browse for the market, or detail for a
          // product page). Coalesce near-simultaneous calls for the same hash; any real
          // navigation to a different hash always proceeds.
          var showHash = String(location.hash || '');
          var showNow = Date.now();
          if (showHash === state.lastShowHash && (showNow - state.lastShowAt) < 600) return;
          state.lastShowHash = showHash;
          state.lastShowAt = showNow;
          ensureRoot();
          if (state.disabled){ showMarketView(); setStatus('قسم الحسابات غير متاح حالياً.'); return; }
          // Routing: #/accounts = home (قسم cards) · #/accounts/c/<id> = قسم page (فرز
          // stacks) · #/accounts/sell|mine|purchases = reserved pages · #/accounts/<id>
          // = product detail.
          var parts = subPartsFromHash();
          var first = parts[0] || '';
          if (first === 'sell'){ openSellPage(); return; }
          if (first === 'mine'){ openMyListingsPage(); return; }
          if (first === 'purchases'){ openMyPurchasesPage(); return; }
          if (first === 'sales'){ openMySalesPage(); return; }
          if (first === 'c'){
            showMarketView();
            var okc = await loadCategories();
            if (!okc) return;
            loadSectionPage(parts[1] || '');
            return;
          }
          if (first){ openDetailPage(first); return; }
          showMarketView();
          loadHome();
        }

        // The router keeps one route for both views, so react to in-route hash
        // changes (card tap, back button, browser back) ourselves.
        try {
          window.addEventListener('hashchange', function(){
            if (!state.root || !state.root.isConnected) return;
            var raw = String(location.hash || '').replace(/^#\/?/, '').split(/[?#]/)[0];
            if (String(raw.split('/')[0] || '').toLowerCase() !== 'accounts') return;
            onShow();
          });
        } catch(_){ }

        return {
          build: build,
          onShow: onShow,
          ready: function(){ return true; }
        };
      })();

window.__inlineRoutes = window.__inlineRoutes || {};
window.__inlineRoutes.accounts = accountsMarketplaceRoute;
