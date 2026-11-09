const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const SOURCE_DIRS = ['apps', 'frontend/src', 'backend/src', 'packages'];

const findings = [];

function scan(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === 'dist') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scan(full);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (['.ts', '.tsx', '.js', '.jsx', '.json'].includes(ext)) {
        try {
          const content = fs.readFileSync(full, 'utf8');
          const lines = content.split('\n');
          lines.forEach((line, idx) => {
            if (/razorpay/i.test(line)) {
              findings.push({
                file: path.relative(ROOT_DIR, full).replace(/\\/g, '/'),
                line: idx + 1,
                snippet: line.trim().substring(0, 140)
              });
            }
          });
        } catch (e) {}
      }
    }
  }
}

for (const s of SOURCE_DIRS) {
  scan(path.join(ROOT_DIR, s));
}

console.log(`Found ${findings.length} Razorpay occurrences across source directories:`);
const byFile = {};
for (const f of findings) {
  byFile[f.file] = byFile[f.file] || [];
  byFile[f.file].push({ line: f.line, snippet: f.snippet });
}

for (const [file, list] of Object.entries(byFile)) {
  console.log(`\n=== ${file} (${list.length} matches) ===`);
  list.slice(0, 8).forEach(m => console.log(`  L${m.line}: ${m.snippet}`));
  if (list.length > 8) console.log(`  ... and ${list.length - 8} more matches`);
}

fs.writeFileSync(path.resolve(__dirname, 'razorpay_source_inventory.json'), JSON.stringify(byFile, null, 2));

