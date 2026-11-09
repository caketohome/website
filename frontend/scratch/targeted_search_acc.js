const fs = require('fs');
const path = require('path');

function searchDir(dir, pattern, results = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.next', '.git'].includes(entry.name)) continue;
      searchDir(fullPath, pattern, results);
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx') || entry.name.endsWith('.js'))) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (pattern.test(content)) {
        results.push(fullPath);
      }
    }
  }
  return results;
}

console.log("=== TARGETED SEARCH IN src ===");
console.log("UPDATE accounting_account in src:", searchDir('src', /UPDATE\s+(public\.)?accounting_account/i));
console.log("DELETE accounting_account in src:", searchDir('src', /DELETE\s+FROM\s+(public\.)?accounting_account/i));
console.log("accounting_account in api routes:", searchDir('src/app/api', /accounting_account/i));
