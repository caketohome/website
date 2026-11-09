const fs = require('fs');
const filePath = 'E:/vig/cakes2home-main/cakes2home-main/frontend/src/middleware.ts';
let content = fs.readFileSync(filePath, 'utf8');
if (content.includes('pathname.startsWith("/account")')) {
  content = content.replace(
    'pathname.startsWith("/account")',
    '(pathname === "/account" || pathname.startsWith("/account/"))'
  );
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Successfully patched middleware.ts to isolate /account from /accounting');
} else {
  console.log('Target string already replaced or not found');
}

