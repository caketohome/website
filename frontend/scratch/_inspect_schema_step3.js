const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function getConnectionString() {
  const envPath = path.join(__dirname, '../.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    if (line.startsWith('DATABASE_URL=')) {
      let val = line.substring('DATABASE_URL='.length).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      return val;
    }
  }
  throw new Error("No DATABASE_URL found");
}

async function main() {
  const c = new Client({ connectionString: getConnectionString(), ssl: { rejectUnauthorized: false } });
  await c.connect();

  // 1. accounting_settings columns
  const r1 = await c.query(`SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='accounting_settings' AND table_schema='public' ORDER BY ordinal_position`);
  console.log('=== accounting_settings columns ===');
  r1.rows.forEach(r => console.log(`  ${r.column_name} (${r.data_type}, nullable=${r.is_nullable})`));

  // 2. audit_log columns
  const r2 = await c.query(`SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='audit_log' AND table_schema='public' ORDER BY ordinal_position`);
  console.log('\n=== audit_log columns ===');
  r2.rows.forEach(r => console.log(`  ${r.column_name} (${r.data_type}, nullable=${r.is_nullable})`));

  // 3. accounting_settings constraints
  const r3 = await c.query(`
    SELECT conname, pg_get_constraintdef(oid) as def 
    FROM pg_constraint 
    WHERE conrelid = 'public.accounting_settings'::regclass
    ORDER BY conname
  `);
  console.log('\n=== accounting_settings constraints ===');
  r3.rows.forEach(r => console.log(`  ${r.conname}: ${r.def}`));

  // 4. Check the dbTransaction import pattern
  const dbFile = fs.readFileSync(path.join(__dirname, '../src/lib/db.ts'), 'utf8');
  const lines = dbFile.split('\n');
  console.log('\n=== db.ts exports (first 30 lines) ===');
  lines.slice(0, 30).forEach((l, i) => console.log(`  ${i+1}: ${l}`));

  await c.end();
}

main().catch(e => { console.error(e); process.exit(1); });
