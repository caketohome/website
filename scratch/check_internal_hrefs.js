const fs = require('fs');
const path = require('path');

function getHrefs(dir) {
  let hrefs = new Set();
  const list = fs.readdirSync(dir);
  for (const item of list) {
    if (['node_modules', '.next', '.git'].includes(item)) continue;
    const full = path.join(dir, item);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      const sub = getHrefs(full);
      sub.forEach(h => hrefs.add(h));
    } else if (item.endsWith('.tsx') || item.endsWith('.ts') || item.endsWith('.jsx') || item.endsWith('.js')) {
      const content = fs.readFileSync(full, 'utf8');
      const matches = content.matchAll(/href=["'](\/[^"'?#]*)["']/g);
      for (const m of matches) {
        if (!m[1].startsWith('/_next') && !m[1].startsWith('/api')) {
          hrefs.add(m[1]);
        }
      }
    }
  }
  return hrefs;
}

const allHrefs = [...getHrefs(path.join(__dirname, '../frontend/src'))].sort();
console.log('Total internal href paths found in frontend source:', allHrefs.length);
allHrefs.forEach(h => console.log('  ', h));
