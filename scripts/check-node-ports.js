const { execSync } = require('child_process');

console.log('=== ALL LISTENING PORTS FOR NODE PROCESSES ===\n');

try {
  const netstat = execSync('netstat -ano', { encoding: 'utf8' });
  const lines = netstat.split('\n');
  
  const listening = lines.filter(l => l.includes('LISTENING'));
  
  const wmic = execSync('wmic process where "name=\'node.exe\'" get ProcessId,CommandLine /format:csv', { encoding: 'utf8' });
  const nodePids = new Map();
  wmic.split('\n').forEach(line => {
    const parts = line.trim().split(',');
    if (parts.length >= 3) {
      const pid = parts[parts.length - 1].trim();
      const cmd = parts.slice(1, parts.length - 1).join(',');
      if (pid && !isNaN(Number(pid))) {
        nodePids.set(pid, cmd);
      }
    }
  });

  for (const line of listening) {
    const parts = line.trim().split(/\s+/);
    const proto = parts[0];
    const localAddr = parts[1];
    const pid = parts[parts.length - 1];
    
    if (nodePids.has(pid)) {
      console.log(`Port binding: ${localAddr} -> PID ${pid}`);
      console.log(`  Command: ${nodePids.get(pid)}`);
    }
  }
} catch (err) {
  console.error('Error:', err.message);
}
