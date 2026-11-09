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

async function inspect() {
  const client = new Client({ connectionString: getConnectionString(), ssl: { rejectUnauthorized: false } });
  await client.connect();

  const total = await client.query('SELECT count(*)::int as total, count(*) FILTER (WHERE deleted_at IS NULL)::int as active, count(*) FILTER (WHERE deleted_at IS NOT NULL)::int as deleted FROM public.branch;');
  console.log('Branch Summary:', total.rows[0]);

  const deletedRows = await client.query('SELECT id, name, code, created_at, updated_at, deleted_at FROM public.branch WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC;');
  console.log('Deleted Branches count:', deletedRows.rows.length);
  deletedRows.rows.forEach(r => console.log(`  - [${r.id}] code: ${r.code}, name: ${r.name}, created: ${r.created_at}, deleted: ${r.deleted_at}`));

  const allCount = await client.query('SELECT count(*)::int as total FROM public.branch;');
  console.log('Total branch rows in DB:', allCount.rows[0].total);

  await client.end();
}

inspect();
