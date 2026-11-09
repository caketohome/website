const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function getConnectionString() {
  const envPath = path.join(__dirname, '../.env');
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const l of lines) {
    if (l.trim().startsWith('DATABASE_URL=')) {
      let v = l.trim().substring('DATABASE_URL='.length).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      return v;
    }
  }
}

async function run() {
  const client = new Client({ connectionString: getConnectionString(), ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    const res = await client.query('SELECT id, code, name, latitude, longitude, deleted_at FROM public.branch WHERE latitude = 12.9716 AND longitude = 77.5946;');
    console.log('Matches at 12.9716, 77.5946 count:', res.rowCount);
    console.log(res.rows);

    const zjson = await client.query("SELECT id, code, name, deleted_at FROM public.branch WHERE code LIKE '%ZJSON%' OR name LIKE '%ZJSON%'");
    console.log('Any ZJSON branches in public.branch:', zjson.rows);

    // Also check if any table in public schema has references to ZJSON
    const tables = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    console.log('\nChecking all tables for ZJSON references...');
    for (const t of tables.rows) {
      const tName = t.table_name;
      // check text columns
      const cols = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND data_type IN ('text', 'character varying')`, [tName]);
      for (const col of cols.rows) {
        try {
          const q = `SELECT count(*) FROM public."${tName}" WHERE "${col.column_name}" LIKE '%ZJSON%'`;
          const cnt = await client.query(q);
          if (parseInt(cnt.rows[0].count, 10) > 0) {
            console.log(`Found ZJSON in ${tName}.${col.column_name}: ${cnt.rows[0].count} matches`);
          }
        } catch (e) {}
      }
    }
  } finally {
    await client.end();
  }
}

run().catch(console.error);
