const { spawn } = require('child_process');
const path = require('path');

const frontendDir = path.resolve(__dirname, '../frontend');
const nextBin = path.join(frontendDir, 'node_modules', 'next', 'dist', 'bin', 'next');
console.log(`Starting Next.js dev server from: ${frontendDir}`);

const child = spawn(process.execPath, ['--max-old-space-size=4096', nextBin, 'dev', '-H', '0.0.0.0', '-p', '3000'], {
  cwd: frontendDir,
  env: {
    ...process.env,
    NODE_OPTIONS: '--max-old-space-size=4096',
    PORT: '3000',
    NODE_ENV: 'development',
    DATABASE_URL: 'postgresql://cth_test_user:cth_test_password@127.0.0.1:5433/cth_rehearsal_phase5',
    TEST_DATABASE_URL: 'postgresql://cth_test_user:cth_test_password@127.0.0.1:5433/cth_rehearsal_phase5'
  },
  stdio: 'inherit'
});

child.on('error', (err) => {
  console.error('Failed to start Next.js:', err);
});

child.on('exit', (code) => {
  console.log(`Next.js process exited with code ${code}`);
});
