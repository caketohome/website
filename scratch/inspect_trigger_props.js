const fs = require('fs');
const path = require('path');
const { Client } = require(path.resolve(__dirname, '../frontend/node_modules/pg'));

const env = fs.readFileSync('.env', 'utf8');
const dbUrl = env.split('\n').find(l => l.startsWith('DATABASE_URL=')).replace('DATABASE_URL=', '').trim().replace(/^['\"]|['\"]$/g, '');
const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

async function run() {
  await client.connect();
  const res = await client.query(`
    SELECT tgname, tgdeferrable, tginitdeferred, tgenabled, tgtype, relname
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE tgname ILIKE '%journal%' OR tgname ILIKE '%balance%'
  `);
  console.log('Triggers:', res.rows);
  await client.end();
}
run().catch(console.error);
