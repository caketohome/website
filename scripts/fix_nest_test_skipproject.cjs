const fs = require('fs');

const path = 'cakes2home-main/cakes2home-main/scripts/test_phase5_nestjs_architecture.cjs';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  `require('E:/vig/cakes2home-main/cakes2home-main/backend/node_modules/ts-node').register({
  transpileOnly: true,
  compilerOptions: {`,
  `require('E:/vig/cakes2home-main/cakes2home-main/backend/node_modules/ts-node').register({
  transpileOnly: true,
  skipProject: true,
  compilerOptions: {`
);

fs.writeFileSync(path, content, 'utf8');
console.log('Added skipProject: true to test_phase5_nestjs_architecture.cjs');

