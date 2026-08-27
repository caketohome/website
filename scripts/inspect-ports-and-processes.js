const { execSync } = require('child_process');
const http = require('http');

console.log('=== PORT & PROCESS AUDIT ===\n');

try {
  const netstatOutput = execSync('netstat -ano', { encoding: 'utf8' });
  const lines = netstatOutput.split('\n');
  const targetPorts = ['3000', '3001', '9000'];
  
  const found = [];
  for (const line of lines) {
    for (const port of targetPorts) {
      if (line.includes(`:${port} `) || line.includes(`:${port}\t`)) {
        found.push({ port, raw: line.trim() });
      }
    }
  }

  if (found.length === 0) {
    console.log('No processes currently listening on ports 3000, 3001, or 9000.');
  } else {
    console.log('Active TCP connections / listeners on target ports:');
    for (const item of found) {
      console.log(`Port ${item.port}: ${item.raw}`);
      const parts = item.raw.split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && !isNaN(Number(pid))) {
        try {
          const tasklist = execSync(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`, { encoding: 'utf8' }).trim();
          console.log(`  -> Process Info: ${tasklist}`);
        } catch (e) {
          console.log(`  -> Could not get tasklist for PID ${pid}`);
        }
      }
    }
  }
} catch (err) {
  console.error('Error running netstat:', err.message);
}

console.log('\n=== RUNNING NODE PROCESSES ===');
try {
  const nodeProcesses = execSync('wmic process where "name=\'node.exe\'" get ProcessId,CommandLine,ExecutablePath /format:csv', { encoding: 'utf8' });
  console.log(nodeProcesses.trim());
} catch (e) {
  try {
    const tasklist = execSync('tasklist /FI "IMAGENAME eq node.exe"', { encoding: 'utf8' });
    console.log(tasklist);
  } catch (err) {
    console.log('Error querying node processes:', err.message);
  }
}
