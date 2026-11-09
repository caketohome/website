const fs = require('fs');

console.log('ts-node in root:', fs.existsSync('node_modules/ts-node'));
console.log('ts-node in frontend:', fs.existsSync('cakes2home-main/cakes2home-main/frontend/node_modules/ts-node'));
console.log('ts-node in backend:', fs.existsSync('cakes2home-main/cakes2home-main/backend/node_modules/ts-node'));
console.log('tsx in root:', fs.existsSync('node_modules/tsx'));
console.log('typescript in root:', fs.existsSync('node_modules/typescript'));
console.log('typescript in backend:', fs.existsSync('cakes2home-main/cakes2home-main/backend/node_modules/typescript'));

