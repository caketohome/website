const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

function getConnectionString() {
  const envPath = path.join(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('DATABASE_URL=')) {
        let val = trimmed.substring('DATABASE_URL='.length).trim();
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
        return val;
      }
    }
  }
  return process.env.DATABASE_URL;
}

const pool = new Pool({
  connectionString: getConnectionString(),
  ssl: { rejectUnauthorized: false }
});

async function main() {
  console.log('=== PRODUCTION READINESS AUDIT ===\n');

  // 1. Database Connection & Server Info
  const vRes = await pool.query('SELECT version();');
  console.log('PostgreSQL Version:', vRes.rows[0].version);

  // 2. Migration tables
  const migRes = await pool.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name LIKE '%migrat%'
  `);
  console.log('\nMigration tables found:', migRes.rows.map(r => r.table_name));

  for (const m of migRes.rows) {
    const countRes = await pool.query(`SELECT COUNT(*) FROM "${m.table_name}"`);
    console.log(`- ${m.table_name}: ${countRes.rows[0].count} applied records`);
  }

  // 3. RLS status on core public tables
  const rlsRes = await pool.query(`
    SELECT tablename, rowsecurity 
    FROM pg_tables 
    WHERE schemaname = 'public' 
      AND tablename IN (
        'accounting_voucher', 'accounting_journal_entry', 'accounting_account',
        'orders', 'marketplace_partner', 'marketplace_store', 'marketplace_partner_invoice',
        'branch', 'customer', 'inventory_movement'
      )
    ORDER BY tablename;
  `);
  console.log('\nCore Tables RLS status:');
  rlsRes.rows.forEach(r => {
    console.log(`- ${r.tablename.padEnd(30)}: RLS = ${r.rowsecurity}`);
  });

  // 4. Advisory locks
  const lockRes = await pool.query(`
    SELECT locktype, objid, mode, granted 
    FROM pg_locks 
    WHERE locktype = 'advisory'
  `);
  console.log('\nActive Advisory Locks:', lockRes.rows.length);

  // 5. Total table count & size
  const statRes = await pool.query(`
    SELECT count(*) as total_tables 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
  `);
  console.log('Total Public Tables:', statRes.rows[0].total_tables);

  // 6. Check environment variables in .env
  console.log('\nEnvironment File Audit (.env):');
  const envPath = path.join(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    lines.forEach(l => {
      const trimmed = l.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const parts = trimmed.split('=');
        console.log(`- ${parts[0].padEnd(25)}: Configured (Masked)`);
      }
    });
  }

  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
