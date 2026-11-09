const fs = require('fs');
const path = require('path');

function searchDir(dir, pattern, results = []) {
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.next', '.git'].includes(entry.name)) continue;
      searchDir(fullPath, pattern, results);
    } else if (entry.isFile()) {
      if (pattern.test(fullPath)) results.push(fullPath);
    }
  }
  return results;
}

console.log("=== CHECKING FOR ACCOUNT MANAGEMENT UI / PAGES ===");
console.log("Pages matching chart of accounts / coa / account management:", searchDir('src/app', /chart-of-accounts|coa|account-management/i));
