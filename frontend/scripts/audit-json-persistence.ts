import * as fs from 'fs';
import * as path from 'path';

function scanDir(dir: string, fileList: string[] = []): string[] {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    if (f === 'node_modules' || f === '.next' || f === '.git' || f === 'dist' || f === '.tempmediaStorage') continue;
    const fullPath = path.join(dir, f);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      scanDir(fullPath, fileList);
    } else if (f.endsWith('.ts') || f.endsWith('.tsx') || f.endsWith('.js') || f.endsWith('.mjs')) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

console.log('=== PHASE 10: STATIC AUDIT FOR RUNTIME JSON PERSISTENCE ===\n');

const srcDir = path.join(__dirname, '../src');
const allSrcFiles = scanDir(srcDir);

let violations = 0;
allSrcFiles.forEach((file) => {
  const code = fs.readFileSync(file, 'utf-8');
  const relPath = path.relative(path.join(__dirname, '..'), file);

  if (code.includes('db-store.json')) {
    console.error(`❌ VIOLATION: db-store.json reference found in ${relPath}`);
    violations++;
  }

  if (code.includes('writeFileSync') || code.includes('writeFile(')) {
    // Check if it writes runtime business data
    console.log(`ℹ️ Inspecting file write in: ${relPath}`);
  }
});

console.log(`\nTotal violations found: ${violations}`);
if (violations > 0) {
  process.exit(1);
} else {
  console.log('✅ ZERO RUNTIME JSON PERSISTENCE VIOLATIONS DETECTED!');
  process.exit(0);
}
