const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

function getConnectionString() {
  const envPath = path.join(__dirname, '../.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    if (line.trim().startsWith('DATABASE_URL=')) {
      let val = line.trim().substring('DATABASE_URL='.length).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      return val;
    }
  }
  throw new Error("DATABASE_URL not found");
}

const pool = new Pool({ connectionString: getConnectionString() });

async function deepDive() {
  const client = await pool.connect();
  try {
    console.log('=== TARGETED DEEP DIVE INTO EXISTING SCHEMAS ===\n');

    // 1. All tables list
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);
    console.log('ALL TABLES IN DB:');
    console.log(tablesRes.rows.map(r => r.table_name).join(', '));
    console.log('\n-----------------------------------------------\n');

    // 2. Specific Table Schemas
    const targetTables = [
      'accounting_account',
      'accounting_voucher',
      'accounting_journal_entry',
      'accounting_journal_line',
      'purchase',
      'purchase_item',
      'supplier',
      'customer',
      'orders',
      'order_item',
      'expense',
      'bank_account',
      'teller',
      'teller_session',
      'teller_movement',
      'branch',
    ];

    for (const t of targetTables) {
      const exists = tablesRes.rows.some(r => r.table_name === t);
      if (!exists) {
        console.log(`[!] Table "${t}" DOES NOT EXIST in database!`);
        continue;
      }
      const cols = await client.query(`
        SELECT column_name, data_type, character_maximum_length, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position;
      `, [t]);
      const count = await client.query(`SELECT count(*)::int as cnt FROM public."${t}"`);
      console.log(`TABLE: ${t} (Count: ${count.rows[0].cnt})`);
      for (const c of cols.rows) {
        console.log(`  - ${c.column_name}: ${c.data_type} (null: ${c.is_nullable}, def: ${c.column_default})`);
      }
      // Check foreign keys
      const fks = await client.query(`
        SELECT
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = $1;
      `, [t]);
      if (fks.rows.length > 0) {
        console.log('  Foreign Keys:');
        for (const fk of fks.rows) {
          console.log(`    ${fk.column_name} -> ${fk.foreign_table_name}(${fk.foreign_column_name})`);
        }
      }
      console.log('');
    }

  } finally {
    client.release();
    await pool.end();
  }
}

deepDive().catch(console.error);
