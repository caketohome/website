const { execSync } = require('child_process');
const os = require('os');

console.log('=== SYSTEM MEMORY ===');
console.log('Free RAM (MB):', Math.round(os.freemem() / 1024 / 1024));
console.log('Total RAM (MB):', Math.round(os.totalmem() / 1024 / 1024));

console.log('\n=== TOP MEMORY PROCESSES ===');
try {
  const out = execSync('tasklist', { encoding: 'utf8' });
  const lines = out.split('\n').filter(l => l.trim().length > 0);
  const procs = [];
  for (let i = 3; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/^(\S.+?)\s+(\d+)\s+(\S+)\s+(\d+)\s+([\d,]+)\s*K/);
    if (match) {
      const name = match[1].trim();
      const pid = match[2];
      const memK = parseInt(match[5].replace(/,/g, ''), 10);
      procs.push({ name, pid, memMB: Math.round(memK / 1024) });
    }
  }
  procs.sort((a, b) => b.memMB - a.memMB);
  console.log(procs.slice(0, 20));
} catch (e) {
  console.error("Error inspecting processes:", e);
}
