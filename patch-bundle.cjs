const fs = require('fs');
const file = 'e:/موقع نجاد/site-bundle.js';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  /function closeInlineRechargeRedeemPage\(\)\{[\s\S]*?catch \(_\) \{\}\r?\n  \}/,
  `function closeInlineRechargeRedeemPage(){
    try {
      var app = getInlineRechargeAppEl();
      if (app && app.classList) app.classList.remove('recharge-page-open');
      var existing = document.getElementById('rechargeInlinePage');
      if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
      setInlineRechargeOptionsHidden(false);
    } catch (_) {}
  }
  window.closeInlineRechargeRedeemPage = closeInlineRechargeRedeemPage;
  window.addEventListener('hashchange', closeInlineRechargeRedeemPage);`
);

code = code.replace(
  /          try \{\r?\n            loadInline\(routeKey, \{ routeValue: routeValue, routeParts: routeParts, __forceReload: true \}\);\r?\n          \} finally \{/,
  `          try {
            if (window.closeInlineRechargeRedeemPage) {
              window.closeInlineRechargeRedeemPage();
            }
            loadInline(routeKey, { routeValue: routeValue, routeParts: routeParts, __forceReload: true });
          } finally {`
);

fs.writeFileSync(file, code);
console.log('patched');
