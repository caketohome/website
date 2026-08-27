const path = require('path');
const Module = require('module');

const backendDir = path.resolve(__dirname, '../backend');
const backendNodeModules = path.join(backendDir, 'node_modules');

module.paths.unshift(backendNodeModules);
Module.globalPaths.unshift(backendNodeModules);
process.env.NODE_PATH = backendNodeModules;

process.chdir(backendDir);

console.log('1. Loading dotenv...');
require(path.join(backendNodeModules, 'dotenv')).config({ path: path.join(backendDir, '.env') });

console.log('2. Registering ts-node with transpileOnly...');
require(path.join(backendNodeModules, 'ts-node')).register({
  transpileOnly: true,
  project: path.join(backendDir, 'tsconfig.json')
});

console.log('3. Registering tsconfig-paths...');
require(path.join(backendNodeModules, 'tsconfig-paths')).register({
  baseUrl: backendDir,
  paths: {}
});

console.log('4. Loading Medusa start command from dist/commands/start...');
try {
  const start = require(path.join(backendNodeModules, '@medusajs/medusa/dist/commands/start')).default;
  console.log('5. Invoking Medusa start in directory:', backendDir);
  start({ directory: backendDir }).then((res) => {
    console.log('6. Medusa start promise resolved! Server listening on port 9000.');
  }).catch((err) => {
    console.error('MEDUSA START PROMISE REJECTED:', err);
  });
} catch (err) {
  console.error('ERROR LOADING MEDUSA START:', err);
}
