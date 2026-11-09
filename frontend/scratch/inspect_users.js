const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const env = fs.readFileSync(path.join(__dirname, '../.env'), 'utf8');
const lines = env.split('\n');
let dbUrl = '';
for (const line of lines) {
  if (line.trim().startsWith('DATABASE_URL=')) {
    dbUrl = line.trim().substring('DATABASE_URL='.length).replace(/['"]/g, '').trim();
    break;
  }
}
const pool = new Pool({ connectionString: dbUrl });
pool.query(`
  SELECT conname, pg_get_constraintdef(oid) as def
  FROM pg_constraint
  WHERE conrelid = 'public.notification'::regclass
`).then(res => {
  console.log('Notification constraints:', res.rows);
  return pool.end();
}).catch(err => {
  console.error(err);
  return pool.end();
});
