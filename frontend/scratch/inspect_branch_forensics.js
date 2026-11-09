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

async function check() {
  const client = new Client({ connectionString: getConnectionString(), ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    const cols = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'branch' 
      ORDER BY ordinal_position
    `);
    console.log('Columns of public.branch:');
    cols.rows.forEach(c => console.log(` - ${c.column_name} (${c.data_type}, nullable: ${c.is_nullable})`));

    const res = await client.query('SELECT * FROM public.branch ORDER BY deleted_at NULLS LAST, id');
    console.log('\nTotal branch records:', res.rowCount);
    const active = res.rows.filter(r => !r.deleted_at);
    const deleted = res.rows.filter(r => r.deleted_at);
    console.log('Active branches count:', active.length);
    console.log('Deleted branches count:', deleted.length);
    console.log('\nDeleted branches details:');
    deleted.forEach(b => {
      console.log(` - ID: ${b.id}, Code: ${b.code}, Name: "${b.name}", Created: ${b.created_at?.toISOString()}, Deleted: ${b.deleted_at?.toISOString()}`);
    });

    // Check FKs referencing branch
    const fkQuery = `
      SELECT tc.table_name, kcu.column_name 
      FROM information_schema.table_constraints tc 
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name 
      JOIN information_schema.constraint_column_usage ccu 
        ON ccu.constraint_name = tc.constraint_name 
      WHERE ccu.table_name = 'branch' AND tc.constraint_type = 'FOREIGN KEY';
    `;
    const fks = await client.query(fkQuery);
    console.log('\nForeign keys referencing branch:');
    for (const fk of fks.rows) {
      const delIds = deleted.map(d => `'${d.id}'`).join(',');
      const r = await client.query(`SELECT COUNT(*) FROM public.${fk.table_name} WHERE ${fk.column_name} IN (${delIds})`);
      console.log(` - ${fk.table_name}.${fk.column_name} -> References to soft-deleted branches: ${r.rows[0].count}`);
    }

    // Now let's see all unique branch codes
    console.log('\nAll branch codes:');
    console.log(res.rows.map(b => `${b.code} (${b.deleted_at ? 'DELETED' : 'ACTIVE'})`).join(', '));

  } finally {
    await client.end();
  }
}

check().catch(console.error);
