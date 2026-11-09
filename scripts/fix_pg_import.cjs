const fs = require('fs');
const filePath = 'E:/vig/cakes2home-main/cakes2home-main/apps/api/src/nestjs/modules/accounting/accounting.service.ts';
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(
  'import { Pool } from "pg";',
  `let Pool: any;
try {
  Pool = require("pg").Pool;
} catch (e) {
  try {
    Pool = require("E:/vig/cakes2home-main/cakes2home-main/frontend/node_modules/pg").Pool;
  } catch (e2) {
    console.error("Failed to load pg:", e2.message);
  }
}`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed pg import in accounting.service.ts!');
