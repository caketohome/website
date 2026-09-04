const fs = require('fs');
const path = require('path');

const dbPersist = fs.readFileSync(path.join(__dirname, '../src/lib/db-persistence.ts'), 'utf-8');
const regex = /CREATE TABLE IF NOT EXISTS "?([a-zA-Z0-9_]+)"?/g;
let m;
const tables = [];
while ((m = regex.exec(dbPersist)) !== null) {
  tables.push(m[1]);
}
console.log('Tables defined in db-persistence.ts:', tables);
