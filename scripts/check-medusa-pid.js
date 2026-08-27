const { execSync } = require('child_process');

try {
  const result = execSync('tasklist /FI "PID eq 17456"', { encoding: 'utf8' });
  console.log('PID 17456:', result.trim());
} catch (e) {
  console.log('PID 17456 not found or error:', e.message);
}
