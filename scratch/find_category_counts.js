const fs = require('fs');
const path = require('path');

function searchMd(dir) {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const full = path.join(dir, f);
    if (['node_modules', '.git', '.next'].includes(f)) continue;
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      searchMd(full);
    } else if (f.endsWith('.md')) {
      const text = fs.readFileSync(full, 'utf8');
      if (text.includes('Storefront') && text.includes('Customer Account') && text.includes('Dashboard')) {
        console.log('Matched file:', full);
        const lines = text.split('\n');
        lines.forEach((l, idx) => {
          if (l.toLowerCase().includes('route') || l.toLowerCase().includes('categor') || l.includes('108') || l.includes('113')) {
            console.log(`  L${idx+1}: ${l}`);
          }
        });
      }
    }
  }
}

searchMd(path.join(__dirname, '..'));
