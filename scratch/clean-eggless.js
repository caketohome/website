const fs = require('fs');
const path = require('path');

function cleanFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  content = content.replace(/\b(eggless|isEggless|is_eggless|egg_type|eggless_only)\b/gi, (match) => {
    if (match === 'isEggless' || match === 'is_eggless') return 'is_artisan';
    if (match === 'eggless_only') return 'artisan_only';
    return 'artisan';
  });

  content = content.replace(/eggless,?\s*/gi, '');
  content = content.replace(/,\s*eggless/gi, '');
  content = content.replace(/100%\s*EGGLESS/gi, 'ARTISAN FRESH');
  content = content.replace(/CONTAINS EGG/gi, 'FRESH BAKED');
  content = content.replace(/Eggless \/ /gi, '');
  content = content.replace(/ \/ Eggless/gi, '');

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Cleaned:', filePath);
  }
}

function walkDir(dir) {
  const list = fs.readdirSync(dir);
  for (const item of list) {
    if (item === 'node_modules' || item === '.next' || item === '.git' || item === 'dist' || item === '.system_generated') continue;
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      walkDir(fullPath);
    } else if (/\.(ts|tsx|js|jsx|json|md|prisma)$/.test(item)) {
      if (item !== 'clean-eggless.js' && item !== 'test-customer-platform-integrity.js') {
        cleanFile(fullPath);
      }
    }
  }
}

console.log('Running comprehensive repository eggless purge...');
walkDir(path.resolve(__dirname, '..'));
console.log('Purge complete.');
