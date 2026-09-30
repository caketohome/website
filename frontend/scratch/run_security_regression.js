// Node wrapper for security regression suite
const { execFileSync } = require('child_process');
const path = require('path');

const scriptPath = path.resolve(__dirname, '../../scripts/run-security-regression-tests.ps1');
try {
  const output = execFileSync('pwsh', ['-File', scriptPath], { encoding: 'utf8' });
  console.log(output);
  process.exit(0);
} catch (err) {
  if (err.stdout) console.log(err.stdout);
  if (err.stderr) console.error(err.stderr);
  process.exit(err.status || 1);
}
