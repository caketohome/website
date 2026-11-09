/**
 * Starts the Next.js dev server, waits until it responds, runs the given node scripts
 * sequentially against it, then stops the server. Needed because a sandboxed server is
 * only reachable from the same command that started it.
 *
 * Usage: node scripts/run_with_nextjs.cjs scripts/a.cjs [scripts/b.cjs ...]
 */
const { spawn, execSync } = require('child_process');
const path = require('path');
const http = require('http');

const root = path.resolve(__dirname, '..');
const scripts = process.argv.slice(2);

function probe() {
  return new Promise((resolve) => {
    const req = http.get('http://localhost:3000/api/v1/health', (res) => { res.resume(); resolve(true); });
    req.on('error', () => resolve(false));
    req.setTimeout(5000, () => { req.destroy(); resolve(false); });
  });
}

function runScript(s) {
  return new Promise((resolve) => {
    console.log(`\n===== RUN ${s} =====`);
    const c = spawn(process.execPath, [path.resolve(root, s)], { stdio: 'inherit', cwd: root });
    c.on('exit', (code) => { console.log(`===== ${s} exited ${code} =====`); resolve(code); });
  });
}

(async () => {
  const next = spawn('npx.cmd next dev -p 3000', {
    cwd: path.join(root, 'frontend'), shell: true,
    env: { ...process.env, PORT: '3000', NODE_ENV: 'development' },
  });
  next.stdout.on('data', (d) => process.stdout.write('[next] ' + d));
  next.stderr.on('data', (d) => process.stdout.write('[next:err] ' + d));

  let ready = false;
  for (let i = 0; i < 120 && !ready; i++) { await new Promise((r) => setTimeout(r, 2000)); ready = await probe(); }
  console.log(ready ? '[runner] Next.js is responding' : '[runner] Next.js did not respond in time');

  let worst = ready ? 0 : 1;
  if (ready) for (const s of scripts) { const code = await runScript(s); if (code) worst = code; }

  try { execSync(`taskkill /pid ${next.pid} /T /F`, { stdio: 'ignore' }); } catch {}
  process.exit(worst);
})();

