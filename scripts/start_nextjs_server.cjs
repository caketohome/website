const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const frontendDir = path.resolve(__dirname, '../frontend');
const nextBin = path.join(frontendDir, 'node_modules', 'next', 'dist', 'bin', 'next');
console.log(`Starting Next.js dev server from: ${frontendDir}`);

// Resolve database URL from environment or .env.local
let dbUrl = process.env.DATABASE_URL;
const envLocalPath = path.join(frontendDir, '.env.local');
if (!dbUrl && fs.existsSync(envLocalPath)) {
  const match = fs.readFileSync(envLocalPath, 'utf8').match(/DATABASE_URL=([^\r\n]+)/);
  if (match) dbUrl = match[1].trim();
}
if (!dbUrl) {
  const scratchConn = path.resolve(__dirname, '../../scratch/.db_conn');
  if (fs.existsSync(scratchConn)) dbUrl = fs.readFileSync(scratchConn, 'utf8').trim();
}

const child = spawn(process.execPath, ['--max-old-space-size=4096', nextBin, 'dev', '-H', '0.0.0.0', '-p', '3000'], {
  cwd: frontendDir,
  env: {
    ...process.env,
    NODE_OPTIONS: '--max-old-space-size=4096',
    PORT: '3000',
    NODE_ENV: 'development',
    DATABASE_URL: dbUrl,
    TEST_DATABASE_URL: dbUrl,
    GATEWAY_SECRET_MASTER_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
  },
  stdio: 'inherit'
});

child.on('error', (err) => {
  console.error('Failed to start Next.js:', err);
});

child.on('exit', (code) => {
  console.log(`Next.js process exited with code ${code}`);
});
