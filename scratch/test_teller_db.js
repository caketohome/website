const fs = require('fs');
const path = require('path');
const { Client } = require(path.resolve(__dirname, '../frontend/node_modules/pg'));

function getConn() {
  const env = fs.readFileSync('.env', 'utf8');
  for (const line of env.split('\n')) {
    if (line.trim().startsWith('DATABASE_URL=')) {
      let val = line.trim().substring('DATABASE_URL='.length).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
      return val;
    }
  }
}

async function run() {
  const client = new Client({ connectionString: getConn() });
  await client.connect();
  try {
    const res = await client.query(`SELECT id, name, code FROM public.branch WHERE id = 'br_indiranagar' OR code ILIKE '%indira%'`);
    console.log('Indiranagar branch:', res.rows);
    const count = await client.query(`SELECT count(*) FROM public.branch`);
    console.log('Total branches count:', count.rows[0].count);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

run();
