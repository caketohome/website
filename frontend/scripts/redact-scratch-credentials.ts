import fs from 'fs';
import path from 'path';

const SECRET_PATTERNS = [
  /postgresql:\/\/[^:]+:[^@]+@aws-1-ap-south-1\.pooler\.supabase\.com:6543\/postgres/g,
  /postgres:\/\/[^:]+:[^@]+@aws-1-ap-south-1\.pooler\.supabase\.com:6543\/postgres/g,
  /caketohomeqwerty/g
];

function sanitizeFile(filePath: string) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    let modified = content;
    let count = 0;
    for (const pat of SECRET_PATTERNS) {
      if (pat.test(modified)) {
        modified = modified.replace(pat, '[REDACTED_DATABASE_CREDENTIAL]');
        count++;
      }
    }
    if (modified !== content) {
      fs.writeFileSync(filePath, modified, 'utf8');
      console.log(`Sanitized: ${filePath}`);
    }
  } catch (err) {
    // Ignore binary or inaccessible files
  }
}

function walkDir(dir: string) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '.git' && entry.name !== '.isolated-pg-data') {
        walkDir(fullPath);
      }
    } else if (entry.isFile()) {
      if (entry.name.endsWith('.js') || entry.name.endsWith('.cjs') || entry.name.endsWith('.mjs') || entry.name.endsWith('.json') || entry.name.endsWith('.ts')) {
        sanitizeFile(fullPath);
      }
    }
  }
}

console.log('Scanning and redacting scratch directories...');
walkDir(path.resolve(__dirname, '../../scratch'));
walkDir(path.resolve(__dirname, '../scratch'));
console.log('Sanitization complete.');
