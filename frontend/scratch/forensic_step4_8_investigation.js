const fs = require('fs');
const path = require('path');
const { Client } = require('../node_modules/pg');

function getConnectionString() {
  if (process.env.PG_URL) return process.env.PG_URL;
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPath = path.join(__dirname, '../../backend/.env');
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
  throw new Error("No database connection string found");
}

async function runForensics() {
  const client = new Client({ connectionString: getConnectionString() });
  await client.connect();

  try {
    console.log('=== 1. ALL INDEXES ON ACCOUNTING TABLES ===');
    const idxRes = await client.query(`
      SELECT tablename, indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public' AND tablename IN ('accounting_voucher', 'accounting_journal_entry', 'accounting_journal_line')
      ORDER BY tablename, indexname;
    `);
    for (const r of idxRes.rows) {
      console.log(`[${r.tablename}] ${r.indexname}: ${r.indexdef}`);
    }

    console.log('\n=== 2. PERMISSIONS CATALOG AUDIT ===');
    const permRes = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name IN ('role', 'permission', 'staff')
      ORDER BY table_name, ordinal_position;
    `);
    console.table(permRes.rows);

  } catch (err) {
    console.error('Error during forensics:', err);
  } finally {
    await client.end();
  }
}

runForensics();
