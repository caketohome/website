const { execSync } = require('child_process');

try {
  const out = execSync('powershell -NoProfile -Command "Get-Process -Id 6016 | Select-Object Id, ProcessName, StartTime, Responding, WorkingSet64 | ConvertTo-Json"', { encoding: 'utf8' });
  console.log('PID 6016 process info:', JSON.parse(out));
} catch (e) {
  console.error("Error:", e.message);
}
