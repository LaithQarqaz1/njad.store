/* «موقع رشق» storefront route — the SMM services page.

   Ships as chunk-rashq.js, loaded by __loadRouteChunk before the `rashq` route
   builds (registered on window.__inlineRoutes.rashq, mirroring route-accounts.js).

   WHAT THIS IS NOT: a second catalog. Every service here is an ORDINARY catalog
   product living under the reserved `rashq` section, read in one shot from
   `mode=rashq-tree` (fail-closed behind siteState.rashqSite.enabled). The reseller
   client API keeps seeing those rows as a plain section — nothing about the catalog
   contract changes for this page.

   MONEY: this page places orders through window.__catalogPurchaseApi.submit —
   the SAME function the purchase modal uses (site-inline-app.js
   catalogPerformPurchase). There is no second money path here, and no price is
   ever computed for the server: the total shown is calcItemTotal, exactly what
   the modal shows, and the server re-prices the order itself.

   All core dependencies are window-qualified (this runs in its own <script>,
   not the core IIFE scope). */
      var rashqRoute = (function(){
        var state = {
          root: null,
          refs: null,
          loaded: false,
          loading: false,
          disabled: false,
          error: '',
          groups: [],          // [{ id, name, path, image, products: [...] }]
          config: null,        // { platforms, quickQty, selectors, notice }
          platform: '',        // active platform chip id ('' = الكل)
          showAllPlatforms: false,
          openSelect: '',      // 'group' | 'item' | 'qty' — render() rebuilds the DOM,
                               // so the open dropdown has to live in state, not the DOM.
          search: '',
          groupId: '',
          itemId: '',
          qty: 0,
          submitting: false
        };

        function esc(value){
          return String(value == null ? '' : value)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        }

        function toast(message, variant){
          try { if (window && typeof window.showToast === 'function') { window.showToast(message, variant || 'info', 4200); return; } } catch(_){ }
          try { console.info('[rashq]', message); } catch(_){ }
        }

        function num(value){
          var n = Number(value);
          return Number.isFinite(n) ? n : NaN;
        }

        function fmtInt(value){
          var n = num(value);
          if (!Number.isFinite(n)) return '';
          try { return n.toLocaleString('en-US'); } catch(_){ return String(n); }
        }

        // The core owns money formatting + qty semantics; a local copy would drift.
        function api(){
          try { return window.__catalogPurchaseApi || null; } catch(_){ return null; }
        }
        function fmtMoney(value, currency){
          var a = api();
          if (a && typeof a.formatMoney === 'function') return a.formatMoney(value, currency || 'USD');
          var n = num(value);
          return '$' + (Number.isFinite(n) ? n.toFixed(2) : '0.00');
        }

        // Same base resolution the core's catalogD1Url uses, but this chunk lives
        // in its own scope so it cannot call it.
        function readTreeUrl(){
          var originBase = '';
          try { if (location && location.origin) originBase = String(location.origin).replace(/\/+$/, '') + '/'; } catch(_){}
          var candidates = [];
          try { if (window.__getSiteWorkerBase) candidates.push(window.__getSiteWorkerBase({ trailingSlash: true, allowStorageOverride: true })); } catch(_){ }
          try { if (window.__getSiteWorkerBaseDefault) candidates.push(window.__getSiteWorkerBaseDefault({ trailingSlash: true })); } catch(_){ }
          try { candidates.push(window.API_BASE_URL, window.__API_BASE__, window.API_BASE); } catch(_){ }
          try { if (typeof window.__getSiteSetting === 'function') candidates.push(window.__getSiteSetting('workers.routerBase', '')); } catch(_){ }
          var base = originBase;
          for (var i = 0; i < candidates.length; i += 1) {
            var value = String(candidates[i] || '').trim();
            if (value) { base = value; break; }
          }
          var url;
          try { url = new URL(base); } catch(_){ url = new URL(originBase || 'http://localhost/'); }
          url.searchParams.set('mode', 'rashq-tree');
          return url.toString();
        }

        function currentUid(){
          try {
            var raw = localStorage.getItem('sessionKeyInfo');
            if (raw) { var parsed = JSON.parse(raw); if (parsed && parsed.uid) return String(parsed.uid); }
          } catch(_){ }
          try { var last = localStorage.getItem('auth:lastUid'); if (last) return String(last); } catch(_){ }
          return '';
        }

        /* -------------------------------------------------------------- */
        /* data                                                           */
        /* -------------------------------------------------------------- */

        async function loadTree(force){
          if (state.loading) return;
          if (state.loaded && !force) return;
          state.loading = true;
          state.error = '';
          render();
          try {
            var headers = {};
            var uid = currentUid();
            if (uid) headers['x-useruid'] = uid;
            var res = await fetch(readTreeUrl(), { headers: headers });
            var data = await res.json().catch(function(){ return null; });
            if (!res.ok || !data || data.ok !== true) {
              var code = String((data && data.error) || '').trim();
              if (code === 'rashq_disabled') {
                state.disabled = true;
                state.error = '';
              } else if (code === 'site_disabled') {
                state.error = 'الموقع متوقف مؤقتًا. حاول لاحقًا.';
              } else {
                state.error = 'تعذّر تحميل الخدمات. حدّث الصفحة.';
              }
              state.groups = [];
            } else {
              state.disabled = false;
              state.groups = Array.isArray(data.groups) ? data.groups : [];
              state.config = data.config && typeof data.config === 'object' ? data.config : null;
              state.loaded = true;
              // Keep any selection that still exists after a refresh.
              if (state.groupId && !groupById(state.groupId)) { state.groupId = ''; state.itemId = ''; }
            }
          } catch (err) {
            state.error = 'تعذّر الاتصال بالخادم. تحقّق من الشبكة.';
            state.groups = [];
          } finally {
            state.loading = false;
            render();
          }
        }

        function cfg(){
          var c = state.config || {};
          var sel = (c.selectors && typeof c.selectors === 'object') ? c.selectors : {};
          var icons = sel.icons !== false;
          var dropdowns = sel.dropdowns !== false;
          var search = sel.search !== false;
          // Every selector off would leave no way to pick a service — the
          // dropdowns are the guaranteed fallback (mirrors the admin editor).
          if (!icons && !dropdowns && !search) dropdowns = true;
          return {
            platforms: Array.isArray(c.platforms)
              ? c.platforms.filter(function(p){ return p && !p.hidden; })
                  .sort(function(a, b){ return (Number(a.order) || 0) - (Number(b.order) || 0); })
              : [],
            quickQty: Array.isArray(c.quickQty) ? c.quickQty.filter(function(n){ return num(n) > 0; }) : [],
            icons: icons, dropdowns: dropdowns, search: search
          };
        }

        function platformById(id){
          var list = cfg().platforms;
          for (var i = 0; i < list.length; i += 1) {
            if (String(list[i].id) === String(id)) return list[i];
          }
          return null;
        }

        // A platform is a KEYWORD FILTER over section + service names — never a
        // tree level. A platform with no keywords matches nothing (not everything),
        // so a half-configured chip can't silently show the whole catalog.
        function matchesPlatform(platform, names){
          if (!platform) return true;
          var hay = (names || []).map(function(n){ return String(n || '').toLowerCase(); }).join('   ');
          if (!hay.trim()) return false;
          var words = (Array.isArray(platform.keywords) && platform.keywords.length)
            ? platform.keywords
            : [String(platform.label || '').toLowerCase()].filter(Boolean);
          if (!words.length) return false;
          for (var i = 0; i < words.length; i += 1) {
            if (words[i] && hay.indexOf(String(words[i]).toLowerCase()) >= 0) return true;
          }
          return false;
        }

        function groupById(id){
          for (var i = 0; i < state.groups.length; i += 1) {
            if (String(state.groups[i].id) === String(id)) return state.groups[i];
          }
          return null;
        }

        function productsOf(group){
          return (group && Array.isArray(group.products)) ? group.products : [];
        }

        function itemById(group, id){
          var list = productsOf(group);
          for (var i = 0; i < list.length; i += 1) {
            var pid = String(list[i] && list[i].id != null ? list[i].id : '');
            if (pid && pid === String(id)) return list[i];
          }
          return null;
        }

        // Groups visible under the current platform + search. A search term keeps a
        // group when the group name matches OR any of its services does.
        function visibleGroups(){
          var platform = platformById(state.platform);
          var term = String(state.search || '').trim().toLowerCase();
          var out = [];
          for (var i = 0; i < state.groups.length; i += 1) {
            var g = state.groups[i];
            var groupNames = [g.name, g.path, g.id];
            var services = productsOf(g);
            var keptServices = [];
            for (var j = 0; j < services.length; j += 1) {
              var s = services[j];
              var sName = String((s && (s.name || s.label)) || '');
              var platformOk = matchesPlatform(platform, groupNames.concat([sName]));
              var termOk = !term || sName.toLowerCase().indexOf(term) >= 0 ||
                String(g.name || '').toLowerCase().indexOf(term) >= 0 ||
                String(g.path || '').toLowerCase().indexOf(term) >= 0;
              if (platformOk && termOk) keptServices.push(s);
            }
            if (keptServices.length) out.push({ id: g.id, name: g.name, path: g.path, image: g.image, products: keptServices });
          }
          return out;
        }

        function selectedGroup(){
          var groups = visibleGroups();
          if (!groups.length) return null;
          for (var i = 0; i < groups.length; i += 1) {
            if (String(groups[i].id) === String(state.groupId)) return groups[i];
          }
          return groups[0];
        }

        function selectedItem(){
          var group = selectedGroup();
          if (!group) return null;
          return itemById(group, state.itemId) || productsOf(group)[0] || null;
        }

        /* -------------------------------------------------------------- */
        /* qty + price (delegated to the core so the modal and this page agree) */
        /* -------------------------------------------------------------- */

        function qtyMeta(item){
          var a = api();
          if (a && typeof a.getItemQtyMeta === 'function') {
            try { return a.getItemQtyMeta(item) || {}; } catch(_){ }
          }
          var options = Array.isArray(item && item.qtyOptions) ? item.qtyOptions.map(num).filter(function(n){ return n > 0; }) : [];
          return {
            min: num(item && item.min),
            max: num(item && item.max),
            unit: num(item && item.unit),
            options: options
          };
        }

        function defaultQty(item){
          var meta = qtyMeta(item);
          if (Array.isArray(meta.options) && meta.options.length) return num(meta.options[0]);
          var min = num(meta.min);
          return Number.isFinite(min) && min > 0 ? min : 1;
        }

        function total(item, qty){
          var a = api();
          if (a && typeof a.calcItemTotal === 'function') {
            try { return num(a.calcItemTotal(item, qty)) || 0; } catch(_){ }
          }
          // Fallback mirrors calcItemTotal: price is per `unit` (e.g. per 1000).
          var price = num(item && item.price);
          if (!Number.isFinite(price)) return 0;
          var unit = num(item && item.unit);
          if (!Number.isFinite(unit) || unit <= 0) return price * (num(qty) || 0);
          return price * ((num(qty) || 0) / unit);
        }

        function inputFields(item){
          var a = api();
          if (a && typeof a.resolveItemInputFields === 'function') {
            try {
              var fields = a.resolveItemInputFields(item);
              if (Array.isArray(fields)) return fields;
            } catch(_){ }
          }
          var reqs = Array.isArray(item && item.requirements) ? item.requirements : [];
          return reqs.map(function(r, i){
            return {
              key: String((r && (r.key || r.id)) || ('field' + i)),
              label: String((r && (r.label || r.name)) || 'الرابط'),
              kind: String((r && (r.type || r.kind)) || 'text'),
              required: !(r && r.required === false),
              options: Array.isArray(r && r.options) ? r.options : []
            };
          });
        }

        // The quantity field is NOT a link field — the core folds a "quantity"
        // requirement into the requirements list for the modal, and this page has
        // its own quantity control, so those rows must not render twice.
        function isQtyFieldKey(key, label){
          var text = (String(key || '') + ' ' + String(label || '')).toLowerCase();
          return /(^|[^a-z])(qty|quantity|count|units?)([^a-z]|$)/.test(text) || /الكمية|كميه|كمية/.test(text);
        }

        function linkFields(item){
          return inputFields(item).filter(function(f){
            return !isQtyFieldKey(f && f.key, f && f.label);
          });
        }

        /* -------------------------------------------------------------- */
        /* styles                                                         */
        /* -------------------------------------------------------------- */

        // Design language lifted from the reference (js4card «قسم الرشق») after
        // measuring its computed styles: FILLED controls (not outlined) at 13px
        // radius / 52px tall with heavy weights (800 values, 900 labels), a
        // 20px-radius card, and a row of brand-tinted 44px pills for platforms.
        //
        // The accent comes from the STORE's own runtime token chain
        // (--site-accent-runtime -> --accent-theme -> --btn-bg), the same chain the
        // settings/telegram pages use. `--primary` does NOT exist at :root in this
        // template — relying on it is why this page first rendered grey and flat.
        function ensureStyles(){
          if (document.getElementById('rashq-style')) return;
          var css = '' +
            // ---- local token block: one place to retheme the whole page --------
            '.rashq{--rq-accent:var(--site-accent-runtime,var(--accent-theme,var(--btn-bg,#5c5ebf)));' +
              '--rq-accent-soft:rgba(var(--site-accent-rgb,148,163,184),.26);' +
              '--rq-accent-soft:color-mix(in srgb,var(--rq-accent) 26%,transparent);' +
              '--rq-tint-08:rgba(var(--site-accent-rgb,148,163,184),.08);' +
              '--rq-tint-08:color-mix(in srgb,var(--rq-accent) 8%,transparent);' +
              '--rq-tint-16:rgba(var(--site-accent-rgb,148,163,184),.16);' +
              '--rq-tint-16:color-mix(in srgb,var(--rq-accent) 16%,transparent);' +
              '--rq-tint-30:rgba(var(--site-accent-rgb,148,163,184),.30);' +
              '--rq-tint-30:color-mix(in srgb,var(--rq-accent) 30%,transparent);' +
              '--rq-tint-55:rgba(var(--site-accent-rgb,148,163,184),.55);' +
              '--rq-tint-55:color-mix(in srgb,var(--rq-accent) 55%,transparent);' +
              '--rq-surface:var(--card-bg,#fff);' +
              '--rq-line:var(--rq-tint-30,rgba(148,163,184,.28));' +
              // الصناديق بلون الخلفية نفسه لا بطبقة بيضاء شفافة: الطبقة كانت تجعل كل
              // صندوق يبدو رماديًا فوق الخلفية. التمييز يأتي من الحدّ لا من التعبئة.
              '--rq-fill:var(--bg-app,var(--bg,#ffffff));' +
              '--rq-fill-line:var(--rq-tint-30,rgba(148,163,184,.30));' +
              '--rq-text:var(--text,#0f172a);--rq-muted:var(--muted,#64748b);' +
              '--rq-shadow:0 10px 30px rgba(15,23,42,.06);' +
              'max-width:760px;margin:0 auto;padding:14px 14px 130px;direction:rtl;' +
              'color:var(--rq-text);font-family:inherit;position:relative;' +
              // نقشة خفيفة: ثلاثة تدرّجات CSS فقط (بلا صور ولا data-URI) — تكلفتها
              // على الجوال شبه معدومة، وتُطفأ لمن يطلب تقليل الحركة/الشفافية.
              // نقشة نقاط واحدة فقط. الهالتان الكبيرتان في الزاويتين كانتا تقرآن
              // كتدرّج عام من الأعلى للأسفل — وهو عكس المطلوب.
              'background-image:radial-gradient(var(--rq-tint-08,rgba(148,163,184,.07)) 1px,transparent 1px);' +
              'background-size:22px 22px;}' +
            // Dark theme: the reference is light-only, so the filled surfaces are
            // re-derived as white overlays instead of hardcoded greys.
            'html[data-theme="dark"] .rashq,body.dark-mode .rashq{--rq-shadow:0 10px 30px rgba(0,0,0,.35);}' +
            '@media (prefers-color-scheme:dark){html:not([data-theme="light"]) .rashq{' +
              '--rq-shadow:0 10px 30px rgba(0,0,0,.35);}}' +

            // ---- platform pills ------------------------------------------------
            '.rashq .rashq-plats{display:flex;gap:10px;overflow-x:auto;padding:6px 2px 14px;' +
              'scrollbar-width:none;-ms-overflow-style:none;}' +
            '.rashq .rashq-plats::-webkit-scrollbar{display:none;}' +
            '.rashq .rashq-plat{flex:0 0 auto;height:44px;min-width:62px;padding:0 14px;border-radius:999px;' +
              'display:inline-flex;align-items:center;justify-content:center;gap:8px;cursor:pointer;' +
              'border:1px solid var(--pf-line,var(--rq-fill-line));background:var(--pf-bg,var(--rq-fill));' +
              'color:var(--rq-text);font:inherit;font-weight:900;font-size:.95rem;' +
              'transition:transform .16s ease,box-shadow .16s ease,border-color .16s ease;}' +
            '.rashq .rashq-plat:hover{transform:translateY(-1px);}' +
            '.rashq .rashq-plat img{width:30px;height:30px;object-fit:contain;display:block;}' +
            '.rashq .rashq-plat i{font-size:21px;line-height:1;color:var(--pf-ink,inherit);}' +
            // A near-black brand (TikTok/Threads) disappears on a dark card, so the
            // dark theme uses the lightened variant of the same chip.
            'html[data-theme="dark"] .rashq .rashq-plat,body.dark-mode .rashq .rashq-plat{' +
              'background:var(--pf-bg-dark,var(--pf-bg,var(--rq-fill)));' +
              'border-color:var(--pf-line-dark,var(--pf-line,var(--rq-fill-line)));}' +
            'html[data-theme="dark"] .rashq .rashq-plat i,body.dark-mode .rashq .rashq-plat i{' +
              'color:var(--pf-ink-dark,var(--pf-ink,inherit));}' +
            '@media (prefers-color-scheme:dark){html:not([data-theme="light"]) .rashq .rashq-plat{' +
              'background:var(--pf-bg-dark,var(--pf-bg,var(--rq-fill)));' +
              'border-color:var(--pf-line-dark,var(--pf-line,var(--rq-fill-line)));}' +
              'html:not([data-theme="light"]) .rashq .rashq-plat i{' +
              'color:var(--pf-ink-dark,var(--pf-ink,inherit));}}' +
            '.rashq .rashq-plat b{font-weight:900;max-width:96px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}' +
            '.rashq .rashq-plat.is-active{border-color:var(--rq-accent);' +
              'box-shadow:0 0 0 2px var(--rq-accent) inset,0 8px 18px rgba(15,23,42,.10);}' +
            '.rashq .rashq-plat--all{padding:0 20px;background:var(--rq-accent);border-color:var(--rq-accent);color:#fff;}' +
            '.rashq .rashq-plat--all.is-active{box-shadow:0 8px 18px rgba(15,23,42,.16);}' +
            '.rashq .rashq-plat--more{background:transparent;border-style:dashed;color:var(--rq-muted);font-weight:800;}' +

            // ---- card + fields -------------------------------------------------
            '.rashq .rashq-card{background:var(--rq-surface);border:1px solid var(--rq-line);border-radius:20px;' +
              'padding:18px 14px 22px;box-shadow:var(--rq-shadow);}' +
            '.rashq .rashq-card-title{display:flex;align-items:center;gap:9px;font-size:1.05rem;font-weight:900;' +
              'margin:0 4px 16px;}' +
            '.rashq .rashq-card-title i{width:34px;height:34px;border-radius:11px;display:inline-flex;flex:0 0 auto;' +
              'align-items:center;justify-content:center;background:var(--rq-accent);color:#fff;font-size:14px;}' +
            '.rashq .rashq-block{margin:0 0 16px;}' +
            '.rashq .rashq-block > label,.rashq .rashq-title{display:block;font-size:14px;font-weight:900;' +
              'margin:0 4px 8px;text-align:right;}' +
            // Surface + border COLOUR + focus ring come from the store's global field
            // normalizer (see the note above); geometry and border STYLE are ours.
            //
            // `border:1px solid` is not decoration — without an explicit style the
            // input keeps the UA default `2px inset`, which the browser paints as a
            // bevel (light top-left, dark bottom-right). That was the 3D look; the
            // wanted treatment is a flat coloured edge, nothing more.
            '.rashq .rashq-control{width:100%;box-sizing:border-box;height:52px;padding:0 16px;' +
              'border:1px solid;border-radius:13px;font:inherit;font-weight:800;outline:none;' +
              'appearance:none;-webkit-appearance:none;}' +
            '.rashq .rashq-control::placeholder{color:var(--rq-muted);font-weight:700;opacity:.55;}' +
            '.rashq .rashq-control::-webkit-input-placeholder{color:var(--rq-muted);opacity:.55;}' +
            '.rashq textarea.rashq-control{height:auto;min-height:96px;padding:14px 16px;line-height:1.7;}' +
            // Native arrow removed so the control matches the reference gutter.
            '.rashq select.rashq-control{padding-inline-end:52px;-webkit-appearance:none;appearance:none;cursor:pointer;}' +
            '.rashq .rashq-select{position:relative;}' +
            // PHYSICAL borders on purpose: `border-inline-start` flips to the right
            // edge under RTL, which turns the L-corner into a RIGHT-pointing «>»
            // instead of a down chevron. left+bottom always rotates into «v».
            '.rashq .rashq-select::after{content:"";position:absolute;inset-inline-end:20px;top:50%;width:9px;height:9px;' +
              'margin-top:-7px;border-left:2px solid var(--rq-muted);border-bottom:2px solid var(--rq-muted);' +
              'transform:rotate(-45deg);pointer-events:none;}' +
            '.rashq .rashq-hint{display:block;margin:8px 4px 0;font-size:14px;font-weight:700;color:var(--rq-muted);}' +
            '.rashq .rashq-hint.is-invalid{color:#ef4444;}' +
            // The out-of-range field turns red but is NEVER corrected: the customer
            // keeps whatever they typed, and only the submit is blocked.
            // !important beats the global field normalizer, which forces border-color.
            // NOTE: the red border/text colour cannot live here — see flagQty().
            '.rashq .rashq-control.is-invalid::placeholder{color:#ef4444;opacity:.7;}' +
            '.rashq .rashq-rim.is-invalid{border-inline-start-color:#ef4444;}' +
            // A damped shake — amplitude decays to nothing across the 3s so it reads
            // as "settling down" instead of buzzing.
            '@keyframes rashq-shake{' +
              '0%{transform:translateX(0)}' +
              '3%{transform:translateX(-8px)}6%{transform:translateX(8px)}' +
              '9%{transform:translateX(-7px)}12%{transform:translateX(7px)}' +
              '16%{transform:translateX(-5px)}20%{transform:translateX(5px)}' +
              '25%{transform:translateX(-4px)}30%{transform:translateX(4px)}' +
              '36%{transform:translateX(-3px)}42%{transform:translateX(3px)}' +
              '50%{transform:translateX(-2px)}58%{transform:translateX(2px)}' +
              '68%{transform:translateX(-1px)}78%{transform:translateX(1px)}' +
              '88%{transform:translateX(-.5px)}100%{transform:translateX(0)}}' +
            '.rashq .rashq-shake{animation:rashq-shake 3s cubic-bezier(.36,.07,.19,.97) both;}' +
            '@media (prefers-reduced-motion:reduce){.rashq .rashq-shake{animation:none;}}' +

            // ---- custom dropdown ----------------------------------------------
            '.rashq .rashq-cs{position:relative;}' +
            '.rashq .rashq-cs-trigger{width:100%;box-sizing:border-box;height:52px;padding:0 16px;' +
              'border-radius:13px;font:inherit;font-weight:800;cursor:pointer;text-align:start;' +
              'display:flex;align-items:center;gap:10px;border:1px solid var(--rq-fill-line);' +
              'color:var(--rq-text);background:var(--rq-fill);}' +
            '.rashq .rashq-cs-trigger .rashq-cs-value{flex:1;min-width:0;overflow:hidden;' +
              'text-overflow:ellipsis;white-space:nowrap;}' +
            '.rashq .rashq-cs-arrow{flex:0 0 auto;width:9px;height:9px;margin-top:-4px;' +
              // حدود فيزيائية: border-inline-* ينقلب في RTL فيصير السهم «‹» لا «⌄».
              'border-left:2px solid var(--rq-muted);border-bottom:2px solid var(--rq-muted);' +
              'transform:rotate(-45deg);transition:transform .18s ease;}' +
            '.rashq .rashq-cs.is-open .rashq-cs-arrow{transform:rotate(135deg);margin-top:2px;}' +
            '.rashq .rashq-cs.is-open .rashq-cs-trigger{border-color:var(--rq-accent);}' +
            '.rashq .rashq-cs-panel{position:absolute;inset-inline:0;top:calc(100% + 6px);z-index:40;' +
              'border-radius:14px;border:1px solid var(--rq-fill-line);background:var(--rq-surface);' +
              'box-shadow:0 18px 40px rgba(0,0,0,.28);padding:6px;max-height:290px;overflow-y:auto;' +
              'display:grid;gap:4px;}' +
            '.rashq .rashq-cs-opt{width:100%;box-sizing:border-box;text-align:start;cursor:pointer;' +
              'border:1px solid transparent;border-radius:10px;padding:11px 12px;font:inherit;' +
              'font-weight:700;font-size:.9rem;line-height:1.5;color:var(--rq-text);background:transparent;' +
              'display:block;overflow-wrap:anywhere;}' +
            '.rashq .rashq-cs-empty{padding:14px;text-align:center;color:var(--rq-muted);font-size:.88rem;}' +

            // ---- description / notice -----------------------------------------
            // مطابق للمرجع: شريط 6px بلون التمييز على حافة البداية + تدرّج ينتهي
            // بنفس اللون عند 10%. (border-inline-start ينقلب في RTL فيقع على
            // اليمين — وهو المقصود، فهو «بداية» السطر لا يساره.)
            '.rashq .rashq-desc{border-radius:18px;padding:16px 18px;box-sizing:border-box;' +
              'background:linear-gradient(90deg,var(--rq-fill) 0%,var(--rq-fill) 72%,' +
                'var(--rq-tint-16,rgba(148,163,184,.16)) 100%);' +
              'border:0;border-inline-start:6px solid var(--rq-accent);' +
              'font-weight:700;line-height:1.9;font-size:.95rem;' +
              'max-height:330px;overflow-y:auto;white-space:pre-wrap;overflow-wrap:anywhere;}' +
            // نفس «طرفية» الوصف على حقل الرابط. الستايل العام يفرض خلفية الحقل
            // بـ!important فلا يمكن تلوينه، لذا الشريط يعيش على الغلاف.
            // height + box-sizing keep this field exactly as tall as every other
            // control (52px): the rim's own borders would otherwise add 2px and the
            // link field would sit a hair taller than the rest of the form.
            '.rashq .rashq-rim{display:flex;align-items:stretch;height:52px;box-sizing:border-box;' +
              'border-radius:13px;overflow:hidden;' +
              'border:1px solid var(--rq-fill-line);border-inline-start:6px solid var(--rq-accent);}' +
            '.rashq .rashq-rim .rashq-control{border-width:0;border-radius:0;flex:1;min-width:0;height:100%;' +
              // The Arabic placeholder must start on the RIGHT. dir="auto" resolves to
              // LTR while the field is empty (there is no strong character to sample),
              // which pushed it to the left; inheriting the page's RTL fixes that,
              // and `plaintext` still lets a typed URL read left-to-right.
              'text-align:start;unicode-bidi:plaintext;}' +

            // ---- quantity quick picks -----------------------------------------
            '.rashq .rashq-quick{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0 0;}' +
            '.rashq .rashq-quick button{height:38px;padding:0 15px;border-radius:999px;cursor:pointer;' +
              'background:var(--rq-fill);border:1px solid var(--rq-fill-line);color:var(--rq-text);' +
              'font:inherit;font-weight:800;font-size:.88rem;transition:all .15s ease;}' +
            '.rashq .rashq-quick button:hover{border-color:var(--rq-accent);}' +
            '.rashq .rashq-quick button.is-active{background:var(--rq-accent);border-color:var(--rq-accent);color:#fff;}' +

            // ---- price row + submit -------------------------------------------
            '.rashq .rashq-price{display:flex;align-items:center;justify-content:space-between;gap:12px;' +
              'background:var(--rq-fill);border-radius:13px;padding:11px 16px;min-height:52px;' +
              'box-sizing:border-box;margin:2px 0 14px;}' +
            '.rashq .rashq-price span{font-size:15px;font-weight:900;}' +
            '.rashq .rashq-price b{font-size:1.35rem;font-weight:900;color:var(--rq-accent);letter-spacing:.2px;}' +
            '.rashq .rashq-buy{width:100%;height:54px;border:0;border-radius:13px;cursor:pointer;' +
              'background:var(--rq-accent);color:#fff;font:inherit;font-weight:900;font-size:1.02rem;' +
              'display:inline-flex;align-items:center;justify-content:center;gap:9px;' +
              'transition:transform .16s ease,filter .16s ease;}' +
            '.rashq .rashq-buy:hover{filter:brightness(1.06);}' +
            '.rashq .rashq-buy:active{transform:translateY(1px);}' +
            '.rashq .rashq-buy[disabled]{opacity:.6;cursor:not-allowed;filter:none;transform:none;}' +

            // ---- search + states ----------------------------------------------
            '.rashq .rashq-search{position:relative;margin:0 0 14px;}' +
            '.rashq .rashq-search .rashq-control{padding-inline-start:46px;}' +
            '.rashq .rashq-search > i{position:absolute;inset-inline-start:18px;top:50%;transform:translateY(-50%);' +
              'color:var(--rq-muted);font-size:15px;pointer-events:none;}' +
            '.rashq .rashq-status{text-align:center;padding:44px 16px;color:var(--rq-muted);font-weight:700;font-size:.95rem;}' +
            '.rashq .rashq-status i{display:block;font-size:34px;margin:0 0 12px;opacity:.5;}' +
            '.rashq .rashq-retry{height:46px;padding:0 26px;border:0;border-radius:13px;cursor:pointer;' +
              'background:var(--rq-accent);color:#fff;font:inherit;font-weight:900;}' +
            '@media (max-width:480px){.rashq{padding:10px 10px 130px;}.rashq .rashq-card{padding:14px 12px 18px;}' +
              '.rashq .rashq-plat{min-width:56px;padding:0 12px;}.rashq .rashq-price b{font-size:1.2rem;}}';
          var style = document.createElement('style');
          style.id = 'rashq-style';
          style.textContent = css;
          (document.head || document.documentElement).appendChild(style);
        }

        // Real brand colours for the platforms a boost store almost always sells.
        // Without these the derived hue is arbitrary (TikTok came out red, X green),
        // which reads as a bug rather than a palette. Matched loosely on id/label so
        // «تيك توك» hits the same entry as «tiktok». An explicit admin colour and an
        // unknown platform both bypass this table.
        var BRAND_COLORS = [
          [/instagram|انستقرام|انستغرام|انستجرام|انستا/, '#e1306c'],
          [/tiktok|تيك ?توك/,                            '#111111'],
          [/youtube|يوتيوب/,                             '#ff0000'],
          [/facebook|فيسبوك|فيس ?بوك/,                   '#1877f2'],
          [/telegram|تلغرام|تليجرام|تيليجرام/,           '#229ed9'],
          [/snap|سناب/,                                  '#fffc00'],
          [/twitter|تويتر|(^|\s)x(\s|$)/,                '#1d9bf0'],
          [/twitch/,                                     '#9146ff'],
          [/spotify|سبوتيفاي/,                           '#1db954'],
          [/soundcloud/,                                 '#ff5500'],
          [/discord|ديسكورد/,                            '#5865f2'],
          [/whatsapp|واتس/,                              '#25d366'],
          [/linkedin/,                                   '#0a66c2'],
          [/reddit/,                                     '#ff4500'],
          [/threads/,                                    '#111111'],
          [/kick/,                                       '#53fc18'],
          [/kwai/,                                       '#ff5000'],
          [/quora/,                                      '#b92b27'],
          [/pinterest/,                                  '#e60023'],
          [/google|جوجل|قوقل/,                           '#4285f4']
        ];
        function knownBrandColor(platform){
          var hay = (String((platform && platform.id) || '') + ' ' + String((platform && platform.label) || ''))
            .trim().toLowerCase();
          if (!hay) return '';
          for (var i = 0; i < BRAND_COLORS.length; i += 1) {
            if (BRAND_COLORS[i][0].test(hay)) return BRAND_COLORS[i][1];
          }
          return '';
        }

        // Is this brand colour too dark to read on a dark card?
        //
        // Deliberately the MAX channel, not perceived luminance: YouTube red
        // (#ff0000) has a luminance of only 0.21 and a luma test wrongly bleached
        // it to white, losing the brand. Max-channel separates genuinely
        // near-black brands (TikTok/Threads #111 -> 0.07) from vivid ones
        // (#ff0000 -> 1.0), which is the question actually being asked.
        function hexIsNearBlack(value){
          var hex = String(value || '').trim().replace(/^#/, '');
          if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
          if (!/^[0-9a-f]{6}$/i.test(hex)) return false;
          var r = parseInt(hex.slice(0, 2), 16) / 255;
          var g = parseInt(hex.slice(2, 4), 16) / 255;
          var b = parseInt(hex.slice(4, 6), 16) / 255;
          return Math.max(r, g, b) < 0.30;
        }

        // Brand tint for a platform pill: explicit admin colour → known brand colour
        // → a stable hue derived from the id (so even an unknown platform is
        // distinctly coloured, and always the SAME colour across reloads).
        // Each result also carries *Dark variants: a near-black brand keeps its
        // identity on white but must go light on a dark card.
        function platformTint(platform){
          var explicit = String((platform && platform.color) || '').trim() || knownBrandColor(platform);
          if (explicit) {
            var dark = hexIsNearBlack(explicit);
            return {
              bg: hexTint(explicit, 0.14),
              line: hexTint(explicit, 0.34),
              ink: explicit,
              bgDark: dark ? 'rgba(255,255,255,.10)' : hexTint(explicit, 0.20),
              lineDark: dark ? 'rgba(255,255,255,.24)' : hexTint(explicit, 0.45),
              inkDark: dark ? '#f1f5f9' : explicit
            };
          }
          var seed = String((platform && (platform.id || platform.label)) || '');
          var hue = 0;
          for (var i = 0; i < seed.length; i += 1) hue = (hue * 31 + seed.charCodeAt(i)) % 360;
          return {
            bg: 'hsl(' + hue + ' 86% 92%)',
            line: 'hsl(' + hue + ' 62% 74%)',
            ink: 'hsl(' + hue + ' 62% 42%)',
            bgDark: 'hsl(' + hue + ' 60% 50% / .18)',
            lineDark: 'hsl(' + hue + ' 60% 60% / .38)',
            inkDark: 'hsl(' + hue + ' 80% 72%)'
          };
        }

        // #rrggbb (or #rgb) -> rgba() at the given alpha. Non-hex input is returned
        // untouched so a plain CSS colour name still works.
        function hexTint(value, alpha){
          var hex = String(value || '').trim().replace(/^#/, '');
          if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
          if (!/^[0-9a-f]{6}$/i.test(hex)) return value;
          var r = parseInt(hex.slice(0, 2), 16);
          var g = parseInt(hex.slice(2, 4), 16);
          var b = parseInt(hex.slice(4, 6), 16);
          return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
        }


        /* -------------------------------------------------------------- */
        /* render                                                         */
        /* -------------------------------------------------------------- */

        // Quantity rules, deliberately WARN-ONLY:
        //   • digits only — a boost quantity of 2.2 followers is meaningless, so the
        //     decimal separator is never accepted (not rounded, not reinterpreted);
        //   • out of range is flagged, never corrected. Auto-snapping to min/max
        //     silently changes what the customer asked to buy.
        // The submit is what enforces the range, so typing freely stays possible.
        function digitsOnly(value){
          var text = String(value == null ? '' : value);
          // Thousands separators are dropped (a pasted «1,000» means one thousand),
          // but a decimal point TRUNCATES: stripping it would turn a pasted «2.2»
          // into 22 — a tenfold change to what the customer asked for.
          text = text.replace(/[,٬\s ]/g, '');
          var cut = text.search(/[.٫،]/);
          if (cut >= 0) text = text.slice(0, cut);
          return text.replace(/[^\d]/g, '');
        }

        function qtyProblem(item, rawValue){
          var text = String(rawValue == null ? '' : rawValue).trim();
          if (!text) return 'أدخل الكمية.';
          if (!/^\d+$/.test(text)) return 'الكمية أرقام صحيحة فقط، بلا فواصل.';
          var value = Number(text);
          if (!Number.isFinite(value) || value <= 0) return 'أدخل كمية أكبر من صفر.';
          var meta = qtyMeta(item);
          var options = Array.isArray(meta.options) ? meta.options.map(num).filter(function(n){ return n > 0; }) : [];
          if (options.length) {
            for (var i = 0; i < options.length; i += 1) if (options[i] === value) return '';
            return 'اختر كمية من القائمة.';
          }
          if (num(meta.min) > 0 && value < num(meta.min)) return 'الحد الأدنى ' + fmtInt(meta.min) + '.';
          if (num(meta.max) > 0 && value > num(meta.max)) return 'الحد الأقصى ' + fmtInt(meta.max) + '.';
          return '';
        }

        // Paints the invalid state and (re)starts the shake. Restarting needs the
        // class removed and a reflow read, or the animation will not replay.
        function flagQty(problem, shake){
          var root = state.root;
          if (!root) return;
          var input = root.querySelector('#rashqQty');
          var hint = root.querySelector('.rashq-hint');
          var bad = !!problem;
          if (input) {
            input.classList.toggle('is-invalid', bad);
            // Inline !important: the store's global field rule is (2,1,1) with
            // !important (its :is() list contains a two-ID selector), so a
            // stylesheet rule of ours can never win on border-color/color.
            if (bad) {
              input.style.setProperty('border-color', '#ef4444', 'important');
              input.style.setProperty('color', '#ef4444', 'important');
            } else {
              input.style.removeProperty('border-color');
              input.style.removeProperty('color');
            }
            if (bad && shake) {
              input.classList.remove('rashq-shake');
              void input.offsetWidth;
              input.classList.add('rashq-shake');
            } else if (!bad) {
              input.classList.remove('rashq-shake');
            }
          }
          if (hint) {
            hint.classList.toggle('is-invalid', bad);
            if (bad) {
              if (!hint.dataset.baseText) hint.dataset.baseText = hint.textContent || '';
              hint.textContent = problem;
            } else if (hint.dataset.baseText) {
              hint.textContent = hint.dataset.baseText;
            }
          }
        }

        // Custom dropdown (the native <select> renders an OS list that ignores the
        // page's theme entirely — it looked pasted-in on a dark store).
        //
        // The class names are the TEMPLATE's own: header.js already themes
        // .smm-select-trigger / .smm-select-dropdown / .smm-option from the site
        // accent in both light and dark with !important, and the global focus rule
        // covers the trigger. Reusing them means this control matches the rest of
        // the store for free instead of carrying a parallel palette.
        function customSelect(name, options, selectedValue, emptyText){
          var list = Array.isArray(options) ? options : [];
          var open = state.openSelect === name;
          var current = null;
          for (var i = 0; i < list.length; i += 1) {
            if (String(list[i].value) === String(selectedValue)) { current = list[i]; break; }
          }
          if (!current) current = list[0] || null;

          var html = '<div class="rashq-cs' + (open ? ' is-open' : '') + '" data-rashq-cs="' + esc(name) + '">';
          html += '<button type="button" class="rashq-cs-trigger smm-select-trigger" data-rashq-cs-trigger="' + esc(name) + '"' +
            ' aria-haspopup="listbox" aria-expanded="' + (open ? 'true' : 'false') + '">' +
            '<span class="rashq-cs-value">' + esc(current ? current.text : (emptyText || '—')) + '</span>' +
            '<i class="rashq-cs-arrow"></i></button>';
          if (open) {
            html += '<div class="rashq-cs-panel smm-select-dropdown" role="listbox">';
            if (!list.length) {
              html += '<div class="rashq-cs-empty">' + esc(emptyText || 'لا توجد خيارات') + '</div>';
            } else {
              for (var j = 0; j < list.length; j += 1) {
                var opt = list[j];
                var on = current && String(opt.value) === String(current.value);
                html += '<button type="button" class="rashq-cs-opt smm-option' + (on ? ' is-selected' : '') + '"' +
                  ' role="option" aria-selected="' + (on ? 'true' : 'false') + '"' +
                  ' data-rashq-cs-opt="' + esc(name) + '" data-value="' + esc(opt.value) + '">' +
                  esc(opt.text) + '</button>';
              }
            }
            html += '</div>';
          }
          html += '</div>';
          return html;
        }

        function statusHtml(text, icon){
          return '<div class="rashq-status">' +
            (icon ? '<i class="' + esc(icon) + '"></i>' : '') + esc(text) + '</div>';
        }

        // How many platform chips show before «عرض المزيد» (the reference collapses
        // its tail the same way, so a store with 20 platforms does not turn the bar
        // into an endless scroll).
        var PLATFORMS_VISIBLE = 8;

        function render(){
          var root = state.root;
          if (!root) return;
          ensureStyles();

          if (state.disabled) {
            root.innerHTML = '<div class="rashq">' + statusHtml('هذا القسم غير متاح حاليًا.', 'fa-solid fa-lock') + '</div>';
            return;
          }
          if (state.loading && !state.loaded) {
            root.innerHTML = '<div class="rashq">' + statusHtml('جارٍ تحميل الخدمات…', 'fa-solid fa-spinner fa-spin') + '</div>';
            return;
          }
          if (state.error) {
            root.innerHTML = '<div class="rashq">' + statusHtml(state.error, 'fa-solid fa-triangle-exclamation') +
              '<div style="text-align:center"><button type="button" class="rashq-retry" data-rashq-retry="1">' +
              'إعادة المحاولة</button></div></div>';
            bind();
            return;
          }

          var c = cfg();
          var groups = visibleGroups();
          var group = selectedGroup();
          var item = selectedItem();
          var html = '<div class="rashq">';

          // ---- platform bar ------------------------------------------------
          if (c.icons && c.platforms.length) {
            var shown = state.showAllPlatforms ? c.platforms : c.platforms.slice(0, PLATFORMS_VISIBLE);
            var hidden = c.platforms.length - shown.length;
            html += '<div class="rashq-plats">';
            html += '<button type="button" class="rashq-plat rashq-plat--all' + (state.platform ? '' : ' is-active') +
              '" data-rashq-plat="" title="كل الخدمات"><b>الكل</b></button>';
            for (var i = 0; i < shown.length; i += 1) {
              var p = shown[i];
              var tint = platformTint(p);
              var label = String(p.label || p.id);
              // Icon-only when there IS artwork (the reference look); the label
              // stays in title/aria so it is still announced and hoverable.
              var visual = p.image
                ? '<img src="' + esc(p.image) + '" alt="' + esc(label) + '" loading="lazy" decoding="async">'
                : (p.icon
                    ? '<i class="' + esc(p.icon) + '"></i>'
                    : '<b>' + esc(label) + '</b>');
              html += '<button type="button" class="rashq-plat' +
                (String(state.platform) === String(p.id) ? ' is-active' : '') + '"' +
                ' data-rashq-plat="' + esc(p.id) + '"' +
                ' style="--pf-bg:' + esc(tint.bg) + ';--pf-line:' + esc(tint.line) + ';--pf-ink:' + esc(tint.ink) +
                  ';--pf-bg-dark:' + esc(tint.bgDark || tint.bg) + ';--pf-line-dark:' + esc(tint.lineDark || tint.line) +
                  ';--pf-ink-dark:' + esc(tint.inkDark || tint.ink) + '"' +
                ' title="' + esc(label) + '" aria-label="' + esc(label) + '"' +
                ' aria-pressed="' + (String(state.platform) === String(p.id) ? 'true' : 'false') + '">' +
                visual + '</button>';
            }
            if (hidden > 0) {
              html += '<button type="button" class="rashq-plat rashq-plat--more" data-rashq-more="1">' +
                '<b>عرض المزيد ' + hidden + '+</b></button>';
            } else if (state.showAllPlatforms && c.platforms.length > PLATFORMS_VISIBLE) {
              html += '<button type="button" class="rashq-plat rashq-plat--more" data-rashq-more="0">' +
                '<b>أقل</b></button>';
            }
            html += '</div>';
          }

          // ---- search ------------------------------------------------------
          if (c.search) {
            html += '<div class="rashq-search"><i class="fa-solid fa-magnifying-glass"></i>' +
              '<input type="search" id="rashqSearch" class="rashq-control" placeholder="ابحث عن خدمة…" value="' +
              esc(state.search) + '"></div>';
          }


          if (!groups.length) {
            html += statusHtml(
              state.groups.length ? 'لا توجد خدمات مطابقة لبحثك.' : 'لا توجد خدمات بعد.',
              state.groups.length ? 'fa-solid fa-magnifying-glass' : 'fa-solid fa-box-open'
            );
            html += '</div>';
            root.innerHTML = html;
            bind();
            return;
          }

          // ---- order card ---------------------------------------------------
          html += '<div class="rashq-card">';
          html += '<div class="rashq-card-title"><i class="fa-solid fa-bolt"></i><span>طلب جديد</span></div>';

          if (c.dropdowns) {
            var groupOpts = groups.map(function(gr){
              return { value: gr.id, text: (gr.path ? gr.path : gr.name) + ' (' + productsOf(gr).length + ')' };
            });
            html += '<div class="rashq-block"><span class="rashq-title">القسم</span>' +
              customSelect('group', groupOpts, group ? group.id : '', 'لا توجد أقسام') + '</div>';

            var serviceOpts = productsOf(group).map(function(sv){
              var svUnit = num(sv.unit);
              var priceText = Number.isFinite(svUnit) && svUnit > 1
                ? fmtMoney(sv.price, sv.currency) + ' لكل ' + fmtInt(svUnit)
                : fmtMoney(sv.price, sv.currency);
              return { value: sv.id, text: String(sv.name || sv.label || sv.id) + ' — ' + priceText };
            });
            html += '<div class="rashq-block"><span class="rashq-title">الخدمة</span>' +
              customSelect('item', serviceOpts, item ? item.id : '', 'لا توجد خدمات') + '</div>';
          }

          if (item) {
            var desc = String(item.description || '').trim();
            if (desc) {
              html += '<div class="rashq-block"><div class="rashq-title">وصف</div>' +
                '<div class="rashq-desc">' + esc(desc) + '</div></div>';
            }

            var fields = linkFields(item);
            for (var f = 0; f < fields.length; f += 1) {
              var fd = fields[f];
              var fieldId = 'rashqField_' + f;
              html += '<div class="rashq-block"><label for="' + fieldId + '">' + esc(fd.label || 'الرابط') + '</label>';
              if (String(fd.kind) === 'select' && Array.isArray(fd.options) && fd.options.length) {
                // Requirement dropdowns keep a native select on purpose: their value is
                // read straight back by readFieldValues, and they are rare enough that a
                // second stateful custom control would add risk for no visual gain.
                html += '<div class="rashq-select"><select id="' + fieldId + '" class="rashq-control" data-rashq-field="' + esc(fd.key) + '">';
                for (var o = 0; o < fd.options.length; o += 1) {
                  var opt = fd.options[o];
                  var ov = String((opt && (opt.value != null ? opt.value : opt.label)) != null ? (opt.value != null ? opt.value : opt.label) : opt);
                  var ol = String((opt && (opt.label != null ? opt.label : opt.value)) != null ? (opt.label != null ? opt.label : opt.value) : opt);
                  html += '<option value="' + esc(ov) + '">' + esc(ol) + '</option>';
                }
                html += '</select></div>';
              } else {
                var inputType = String(fd.kind) === 'number' ? 'number' : (String(fd.kind) === 'tel' ? 'tel' : 'text');
                html += '<div class="rashq-rim"><input type="' + inputType + '" id="' + fieldId + '" class="rashq-control" data-rashq-field="' + esc(fd.key) + '"' +
                  ' inputmode="' + (inputType === 'number' ? 'numeric' : 'text') + '" autocomplete="off"' +
                  ' placeholder="' + esc(fd.label || '') + '"></div>';
              }
              html += '</div>';
            }

            var meta = qtyMeta(item);
            var qty = num(state.qty) > 0 ? num(state.qty) : defaultQty(item);
            var fixed = Array.isArray(meta.options) && meta.options.length;
            html += '<div class="rashq-block">' + (fixed ? '<span class="rashq-title">الكمية</span>' : '<label for="rashqQty">الكمية</label>');
            if (fixed) {
              html += customSelect('qty', meta.options.map(function(o){
                return { value: String(num(o)), text: fmtInt(num(o)) };
              }), String(qty), 'لا توجد كميات');
            } else {
              html += '<input type="text" id="rashqQty" class="rashq-control" inputmode="numeric"' +
                ' autocomplete="off" pattern="[0-9]*" value="' + qty + '">';
              // Quick buttons, filtered to the service's own limits so a preset can
              // never produce a quantity the server would reject.
              var quick = c.quickQty.filter(function(n){
                var v = num(n);
                if (!(v > 0)) return false;
                if (num(meta.min) > 0 && v < num(meta.min)) return false;
                if (num(meta.max) > 0 && v > num(meta.max)) return false;
                return true;
              });
              if (quick.length) {
                html += '<div class="rashq-quick">';
                for (var k = 0; k < quick.length; k += 1) {
                  var qq = num(quick[k]);
                  html += '<button type="button" data-rashq-qty="' + qq + '"' + (qq === qty ? ' class="is-active"' : '') + '>' +
                    fmtInt(qq) + '</button>';
                }
                html += '</div>';
              }
            }
            var limitBits = [];
            if (num(meta.min) > 0) limitBits.push('الحد الأدنى: ' + fmtInt(meta.min));
            if (num(meta.max) > 0) limitBits.push('الحد الأقصى: ' + fmtInt(meta.max));
            if (limitBits.length) html += '<small class="rashq-hint">' + esc(limitBits.join(' — ')) + '</small>';
            html += '</div>';

            html += '<div class="rashq-price"><span>ثمن الطلب</span><b>' +
              esc(fmtMoney(total(item, qty), item.currency)) + '</b></div>';
            html += '<button type="button" class="rashq-buy" id="rashqBuy"' + (state.submitting ? ' disabled' : '') + '>' +
              (state.submitting
                ? '<i class="fa-solid fa-spinner fa-spin"></i><span>جارٍ التنفيذ…</span>'
                : '<i class="fa-solid fa-circle-check"></i><span>تأكيد الطلب</span>') +
              '</button>';
          } else {
            html += statusHtml('اختر خدمة لعرض التفاصيل.', 'fa-regular fa-hand-pointer');
          }

          html += '</div></div>';
          root.innerHTML = html;
          bind();
        }

        /* -------------------------------------------------------------- */
        /* events                                                         */
        /* -------------------------------------------------------------- */

        // Bound ONCE for the page's lifetime (bind() runs on every render, so a
        // per-render listener would stack up one handler per keystroke).
        var outsideBound = false;
        function bindOutsideClose(){
          if (outsideBound) return;
          outsideBound = true;
          document.addEventListener('click', function(){
            if (!state.openSelect) return;
            state.openSelect = '';
            render();
          });
        }

        function bind(){
          var root = state.root;
          if (!root) return;
          bindOutsideClose();

          var retry = root.querySelector('[data-rashq-retry]');
          if (retry) retry.addEventListener('click', function(){ state.error = ''; loadTree(true); });

          var more = root.querySelector('[data-rashq-more]');
          if (more) {
            more.addEventListener('click', function(){
              state.showAllPlatforms = String(this.getAttribute('data-rashq-more')) === '1';
              render();
            });
          }

          var plats = root.querySelectorAll('[data-rashq-plat]');
          for (var i = 0; i < plats.length; i += 1) {
            plats[i].addEventListener('click', function(){
              var id = String(this.getAttribute('data-rashq-plat') || '');
              state.platform = (String(state.platform) === id) ? '' : id;
              state.openSelect = '';
              // A filter change can hide the selected service; drop the selection
              // and let selectedGroup/Item fall back to the first visible one.
              state.groupId = ''; state.itemId = ''; state.qty = 0;
              render();
            });
          }

          var search = root.querySelector('#rashqSearch');
          if (search) {
            search.addEventListener('input', function(){
              state.search = String(this.value || '');
              state.openSelect = '';
              state.groupId = ''; state.itemId = ''; state.qty = 0;
              var caret = this.value.length;
              render();
              // Re-focus the (re-rendered) field so typing is not interrupted.
              try {
                var next = state.root.querySelector('#rashqSearch');
                if (next) { next.focus(); next.setSelectionRange(caret, caret); }
              } catch(_){ }
            });
          }

          var triggers = root.querySelectorAll('[data-rashq-cs-trigger]');
          for (var tg = 0; tg < triggers.length; tg += 1) {
            triggers[tg].addEventListener('click', function(e){
              e.stopPropagation();
              var name = String(this.getAttribute('data-rashq-cs-trigger') || '');
              state.openSelect = state.openSelect === name ? '' : name;
              render();
            });
          }

          var opts = root.querySelectorAll('[data-rashq-cs-opt]');
          for (var op = 0; op < opts.length; op += 1) {
            opts[op].addEventListener('click', function(e){
              e.stopPropagation();
              var name = String(this.getAttribute('data-rashq-cs-opt') || '');
              var value = String(this.getAttribute('data-value') || '');
              state.openSelect = '';
              if (name === 'group') { state.groupId = value; state.itemId = ''; state.qty = 0; }
              else if (name === 'item') { state.itemId = value; state.qty = 0; }
              else if (name === 'qty') { state.qty = num(value) > 0 ? num(value) : 0; }
              render();
            });
          }

          var qtyEl = root.querySelector('#rashqQty');
          if (qtyEl) {
            // No render() on input/change: rebuilding the DOM mid-typing loses the
            // caret, and re-deriving the value is what would clamp it.
            var syncQty = function(control, shake){
              var cleaned = digitsOnly(control.value);
              if (cleaned !== control.value) {
                var atEnd = control.selectionStart === control.value.length;
                control.value = cleaned;
                if (atEnd) { try { control.setSelectionRange(cleaned.length, cleaned.length); } catch(_){ } }
              }
              state.qty = cleaned ? Number(cleaned) : 0;
              refreshTotal();
              var item = selectedItem();
              var problem = item ? qtyProblem(item, cleaned) : '';
              // Shake only on the transition into an invalid value, never on every
              // keystroke while it stays invalid.
              var wasBad = control.classList.contains('is-invalid');
              flagQty(problem, shake && !wasBad);
            };
            qtyEl.addEventListener('input', function(){ syncQty(this, true); });
            qtyEl.addEventListener('blur', function(){ syncQty(this, false); });
            // Block the characters that would make a decimal in the first place.
            qtyEl.addEventListener('keydown', function(e){
              if (['.', ',', 'e', 'E', '+', '-'].indexOf(e.key) >= 0) e.preventDefault();
            });
            qtyEl.addEventListener('paste', function(){
              var control = this;
              setTimeout(function(){ syncQty(control, true); }, 0);
            });
          }

          var quicks = root.querySelectorAll('[data-rashq-qty]');
          for (var q = 0; q < quicks.length; q += 1) {
            quicks[q].addEventListener('click', function(){
              state.qty = num(this.getAttribute('data-rashq-qty')) || 0;
              var input = root.querySelector('#rashqQty');
              if (input) input.value = String(state.qty);
              refreshTotal();
              flagQty('', false);
            });
          }

          var buy = root.querySelector('#rashqBuy');
          if (buy) buy.addEventListener('click', confirmOrder);
        }

        // Live total without a full re-render, so typing in the quantity field does
        // not rebuild (and blur) the form on every keystroke.
        function refreshTotal(){
          var root = state.root;
          if (!root) return;
          var item = selectedItem();
          if (!item) return;
          var box = root.querySelector('.rashq-total b');
          var qty = num(state.qty) > 0 ? num(state.qty) : defaultQty(item);
          if (box) box.textContent = fmtMoney(total(item, qty), item.currency);
          var quicks = root.querySelectorAll('[data-rashq-qty]');
          for (var i = 0; i < quicks.length; i += 1) {
            var on = num(quicks[i].getAttribute('data-rashq-qty')) === qty;
            quicks[i].className = on ? 'is-active' : '';
          }
        }

        function readFieldValues(item){
          var out = {};
          var root = state.root;
          if (!root) return out;
          var fields = linkFields(item);
          for (var i = 0; i < fields.length; i += 1) {
            var control = root.querySelector('[data-rashq-field="' + String(fields[i].key).replace(/"/g, '\\"') + '"]');
            out[fields[i].key] = control ? String(control.value || '').trim() : '';
          }
          return out;
        }

        async function confirmOrder(){
          var a = api();
          if (!a || typeof a.submit !== 'function') {
            toast('تعذّر تجهيز الشراء، حدّث الصفحة.', 'error');
            return;
          }
          var group = selectedGroup();
          var item = selectedItem();
          if (!item) { toast('اختر خدمة أولًا.', 'warning'); return; }

          // The ONLY place the quantity is enforced. Everything before this warns.
          var qtyInput = state.root ? state.root.querySelector('#rashqQty') : null;
          var rawQty = qtyInput ? digitsOnly(qtyInput.value) : String(num(state.qty) > 0 ? num(state.qty) : '');
          if (!rawQty && num(state.qty) > 0) rawQty = String(num(state.qty));
          var problem = qtyProblem(item, rawQty);
          if (problem) {
            flagQty(problem, true);
            if (qtyInput && typeof qtyInput.focus === 'function') qtyInput.focus();
            toast(problem, 'warning');
            return;
          }
          var qty = Number(rawQty);
          flagQty('', false);

          var fields = linkFields(item);
          var values = readFieldValues(item);
          for (var i = 0; i < fields.length; i += 1) {
            if (fields[i].required !== false && !values[fields[i].key]) {
              toast('يرجى إدخال ' + (fields[i].label || 'الرابط') + '.', 'warning');
              return;
            }
          }

          // The purchase URL is keyed by the product's own catalog game slug, the
          // same value the modal sends (state.slug === gameKey).
          var slug = String(item.gameKey || item.game_key || (group && group.id) || '').trim();
          var allFields = inputFields(item);
          var primaryId = '';
          for (var p = 0; p < fields.length; p += 1) {
            if (values[fields[p].key]) { primaryId = values[fields[p].key]; break; }
          }

          state.submitting = true;
          render();
          try {
            var outcome = await a.submit({
              slug: slug,
              item: item,
              quantity: qty,
              fieldDefs: allFields,
              playerFields: values,
              playerId: primaryId,
              requiresPlayerId: fields.some(function(f){ return f.required !== false; })
            });
            if (outcome && outcome.ok === true) {
              // Clear only the entered link(s): keeping the service selected makes
              // a second order for another link one tap away.
              state.qty = 0;
              state.submitting = false;
              render();
              return;
            }
          } catch (err) {
            toast('حدث خطأ غير متوقع أثناء تنفيذ الطلب.', 'error');
          }
          state.submitting = false;
          render();
        }

        /* -------------------------------------------------------------- */
        /* route contract                                                 */
        /* -------------------------------------------------------------- */

        function build(){
          var host = document.createElement('div');
          host.className = 'rashq-host';
          state.root = host;
          ensureStyles();
          host.innerHTML = '<div class="rashq">' + statusHtml('جارٍ تحميل الخدمات…') + '</div>';
          loadTree(false);
          return host;
        }

        function onShow(){
          // Re-read on entry: prices/levels can change between visits, and the tree
          // response is small (one request) so a stale page is the worse trade.
          if (state.root) loadTree(true);
        }

        return { build: build, onShow: onShow };
      })();

window.__inlineRoutes = window.__inlineRoutes || {};
window.__inlineRoutes.rashq = rashqRoute;
