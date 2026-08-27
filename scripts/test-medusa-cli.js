const { spawn } = require('child_process');
const path = require('path');

const backendDir = path.resolve(__dirname, '../backend');
console.log('Spawning node node_modules/@medusajs/cli/cli.js in', backendDir);

const child = spawn(process.execPath, ['node_modules/@medusajs/cli/cli.js', '--help'], {
  cwd: backendDir,
  env: { ...process.env, TS_NODE_TRANSPILE_ONLY: 'true' },
  shell: false
});

child.stdout.on('data', data => console.log('STDOUT:', data.toString()));
child.stderr.on('data', data => console.error('STDERR:', data.toString()));
child.on('close', code => console.log('Exited with code:', code));
