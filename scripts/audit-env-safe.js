const fs = require('fs');
const path = require('path');

console.log('=== ENVIRONMENT AUDIT ===\n');

function auditEnvFile(filePath, label) {
  console.log(`Auditing: ${label} (${filePath})`);
  if (!fs.existsSync(filePath)) {
    console.log(`  Status: MISSING\n`);
    return;
  }
  
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const vars = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const key = trimmed.split('=')[0].trim();
      const val = trimmed.slice(trimmed.indexOf('=') + 1).trim();
      vars.push({ key, hasValue: val.length > 0 });
    }
  }
  
  console.log(`  Status: PRESENT (${vars.length} variables defined)`);
  vars.forEach(v => {
    console.log(`    ${v.key}: ${v.hasValue ? 'CONFIGURED' : 'EMPTY'}`);
  });
  console.log('');
}

const rootDir = path.resolve(__dirname, '..');
auditEnvFile(path.join(rootDir, '.env'), 'Root .env');
auditEnvFile(path.join(rootDir, '.env.local'), 'Root .env.local');
auditEnvFile(path.join(rootDir, 'backend', '.env'), 'Backend .env');
auditEnvFile(path.join(rootDir, 'backend', '.env.local'), 'Backend .env.local');
auditEnvFile(path.join(rootDir, 'frontend', '.env'), 'Frontend .env');
auditEnvFile(path.join(rootDir, 'frontend', '.env.local'), 'Frontend .env.local');
