const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const IGNORE_DIRS = new Set(['node_modules', '.git', '.next', 'dist', 'build', '.isolated-pg-data', 'artifacts']);

const findings = [];

function scanDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (IGNORE_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDir(fullPath);
    } else if (entry.isFile()) {
      // Check text files
      const ext = path.extname(entry.name).toLowerCase();
      if (['.ts', '.tsx', '.js', '.jsx', '.cjs', '.mjs', '.json', '.env', '.md', '.sql'].includes(ext) || entry.name.startsWith('.env')) {
        try {
          const content = fs.readFileSync(fullPath, 'utf8');
          const lines = content.split('\n');
          lines.forEach((line, idx) => {
            if (line.match(/razorpay/i)) {
              findings.push({
                file: path.relative(ROOT_DIR, fullPath).replace(/\\/g, '/'),
                line: idx + 1,
                content: line.trim().substring(0, 160)
              });
            }
          });
        } catch (e) {}
      }
    }
  }
}

scanDir(ROOT_DIR);

console.log(`Total Razorpay occurrences found: ${findings.length}`);
const fileSet = new Set(findings.map(f => f.file));
console.log(`Unique files containing Razorpay: ${fileSet.size}`);

// Group by top-level folder
const summary = {};
findings.forEach(f => {
  const top = f.file.split('/')[0];
  summary[top] = (summary[top] || 0) + 1;
});
console.log('Occurrences by folder:', summary);

// Print files
console.log('\n--- Files List ---');
Array.from(fileSet).sort().forEach(f => {
  console.log(f);
});

fs.writeFileSync(path.resolve(__dirname, 'razorpay_inventory.json'), JSON.stringify(findings, null, 2));

