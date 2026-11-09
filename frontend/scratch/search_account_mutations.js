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
        results.push({ fullPath, matches: content.match(pattern) });
      }
    }
  }
  return results;
}

console.log("=== SEARCHING FOR MUTATION PATTERNS ON accounting_account ===");
const insertMatches = searchDir('.', /INSERT\s+INTO\s+(public\.)?accounting_account/i);
console.log("INSERT matches:", insertMatches.map(m => m.fullPath));

const updateMatches = searchDir('.', /UPDATE\s+(public\.)?accounting_account/i);
console.log("UPDATE matches:", updateMatches.map(m => m.fullPath));

const deleteMatches = searchDir('.', /DELETE\s+FROM\s+(public\.)?accounting_account/i);
console.log("DELETE matches:", deleteMatches.map(m => m.fullPath));

const createAccMatches = searchDir('.', /createAccount|updateAccount|deleteAccount/i);
console.log("createAccount/updateAccount matches:", createAccMatches.map(m => m.fullPath));
