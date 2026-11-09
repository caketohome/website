const fs = require('fs');
const content = fs.readFileSync('E:/vig/cakes2home-main/cakes2home-main/frontend/src/app/api/v1/[...path]/route.ts', 'utf8');
const lines = content.split('\n');
lines.forEach((line, i) => {
  if (line.includes('invoices') && (line.includes('path') || line.includes('if ('))) {
    console.log((i+1) + ': ' + line.trim());
  }
});

