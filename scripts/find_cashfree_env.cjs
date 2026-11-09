const fs = require('fs');
const path = require('path');

const targets = [
  'E:/vig/cakes2home-main/cakes2home-main/.env',
  'E:/vig/cakes2home-main/cakes2home-main/.env.local',
  'E:/vig/cakes2home-main/cakes2home-main/frontend/.env',
  'E:/vig/cakes2home-main/cakes2home-main/frontend/.env.local',
  'E:/vig/cakes2home-main/cakes2home-main/frontend/.env.development',
  'E:/vig/cakes2home-main/cakes2home-main/apps/api/.env',
  'E:/vig/cakes2home-main/cakes2home-main/backend/.env',
  'E:/vig/cakes2home-main/cakes2home-main/backend/.env.local',
  'E:/vig/.env',
];

for (const t of targets) {
  if (fs.existsSync(t)) {
    const lines = fs.readFileSync(t, 'utf8').split('\n');
    const matches = lines.filter(l => /CASHFREE/i.test(l));
    console.log(`File ${t}: found ${matches.length} matches`);
    matches.forEach(m => {
      const parts = m.split('=');
      console.log(`   ${parts[0].trim()} = ${parts[1] ? '[PRESENT - length ' + parts[1].trim().length + ']' : '[EMPTY]'}`);
    });
  }
}
