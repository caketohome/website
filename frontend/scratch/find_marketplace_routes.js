const fs = require('fs');
const path = require('path');

const routePath = path.join(__dirname, '../src/app/api/v1/[...path]/route.ts');
const content = fs.readFileSync(routePath, 'utf8');

const regex = /path\s*===\s*["']([^"']*marketplace[^"']*)["']|path\.startsWith\(["']([^"']*marketplace[^"']*)["']\)/g;
let match;
const endpoints = new Set();
while ((match = regex.exec(content)) !== null) {
  endpoints.add(match[1] || match[2]);
}

console.log('Marketplace endpoints in route.ts:');
endpoints.forEach(e => console.log('-', e));
