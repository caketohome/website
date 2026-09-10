const { spawn } = require('child_process');
const process = require('process');

async function measureTsc() {
  console.log("==================================================");
  console.log("1. TYPESCRIPT COMPILATION BENCHMARK");
  console.log("==================================================");

  const startTime = new Date();
  const startHr = process.hrtime.bigint();
  const cpuStart = process.cpuUsage();

  console.log(`START TIME: ${startTime.toISOString()}`);

  const child = spawn('npx.cmd', ['tsc', '--noEmit'], {
    cwd: process.cwd(),
    shell: true,
    stdio: ['inherit', 'pipe', 'pipe']
  });

  let stdout = '';
  let stderr = '';
  let maxMemory = 0;

  child.stdout.on('data', (d) => { stdout += d.toString(); });
  child.stderr.on('data', (d) => { stderr += d.toString(); });

  const exitCode = await new Promise((resolve) => {
    child.on('close', resolve);
  });

  const endHr = process.hrtime.bigint();
  const endTime = new Date();
  const cpuEnd = process.cpuUsage(cpuStart);

  const durationMs = Number(endHr - startHr) / 1e6;
  const durationSec = (durationMs / 1000).toFixed(3);
  const userCpuSec = (cpuEnd.user / 1e6).toFixed(3);
  const sysCpuSec = (cpuEnd.system / 1e6).toFixed(3);

  console.log(`END TIME:   ${endTime.toISOString()}`);
  console.log(`EXIT CODE:  ${exitCode}`);
  console.log(`TOTAL DURATION: ${durationSec}s (${durationMs.toFixed(0)} ms)`);
  console.log(`CPU TIME:   User: ${userCpuSec}s | System: ${sysCpuSec}s`);
  if (stdout.trim()) console.log(`STDOUT:\n${stdout.trim()}`);
  if (stderr.trim()) console.log(`STDERR:\n${stderr.trim()}`);

  return {
    startTime,
    endTime,
    durationMs,
    durationSec,
    exitCode,
    userCpuSec,
    sysCpuSec
  };
}

measureTsc().catch(console.error);
