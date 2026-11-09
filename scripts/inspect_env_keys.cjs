const fs = require('fs');
const path = require('path');

const envFiles = [
  'E:/vig/cakes2home-main/cakes2home-main/.env',
  'E:/vig/cakes2home-main/cakes2home-main/.env.local',
  'E:/vig/cakes2home-main/cakes2home-main/frontend/.env',
  'E:/vig/cakes2home-main/cakes2home-main/frontend/.env.local',
  'E:/vig/cakes2home-main/cakes2home-main/apps/api/.env',
  'E:/vig/cakes2home-main/cakes2home-main/backend/.env',
];

for (const f of envFiles) {
  if (fs.existsSync(f)) {
    console.log(`\n=== File: ${f} ===`);
    const content = fs.readFileSync(f, 'utf8');
    const lines = content.split('\n');
    for (const l of lines) {
      const trimmed = l.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const key = trimmed.split('=')[0].trim();
      if (/CASHFREE|PAYMENT|RAZORPAY|PG|GATEWAY/i.test(key)) {
        console.log(`  KEY: ${key} (isSet=${Boolean(trimmed.split('=')[1]?.trim())})`);
      }
    }
  }
}
