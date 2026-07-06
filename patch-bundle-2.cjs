const fs = require('fs');
const file = 'e:/موقع نجاد/site-bundle.js';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  /if \(payload && payload\.realtime === false\) \{\s*setSupportChatStatus\('تم الإرسال، لكن التحديث الفوري غير جاهز للطرف الآخر\.'\);\s*\} else \{\s*setSupportChatStatus\(''\);\s*\}/g,
  "setSupportChatStatus('');"
);

code = code.replace(
  /pollDelayMs: 3000,\s*badgePollDelayMs: 30000,/g,
  "pollDelayMs: 60000,\n      badgePollDelayMs: 60000,"
);

code = code.replace(
  /var minThreadFetchMs = Math\.max\(3000, Number\(supportChatState\.pollDelayMs \|\| 0\) \|\| 3000\);/g,
  "var minThreadFetchMs = Math.max(60000, Number(supportChatState.pollDelayMs || 0) || 60000);"
);

code = code.replace(
  /delay = Math\.max\(3000, delay \|\| 3000\);/g,
  "delay = Math.max(60000, delay || 60000);"
);

fs.writeFileSync(file, code);
console.log('patched');
