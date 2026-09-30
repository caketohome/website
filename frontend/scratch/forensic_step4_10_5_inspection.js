const fs = require('fs');
const path = require('path');
const { Client } = require('../node_modules/pg');

function getConnectionString() {
  const envPath = path.join(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
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
  }
  return 'postgresql://postgres:postgres@localhost:5432/cakes2home';
}

async function runForensicInspection() {
  const client = new Client({ connectionString: getConnectionString() });
  await client.connect();

  try {
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND (
          table_name LIKE '%bank%' OR 
          table_name LIKE '%deposit%' OR 
          table_name LIKE '%gateway%' OR 
          table_name LIKE '%settle%' OR 
          table_name LIKE '%account%' OR 
          table_name LIKE '%reconcil%' OR
          table_name LIKE '%statement%' OR
          table_name = 'payment_transaction'
        )
      ORDER BY table_name;
    `);

    console.log('RELEVANT TABLES:', tablesRes.rows.map(r => r.table_name));

    for (const t of tablesRes.rows.map(r => r.table_name)) {
      const cols = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position;
      `, [t]);
      console.log(`\n--- ${t} (${cols.rows.length} columns) ---`);
      console.log(cols.rows.map(c => `${c.column_name} (${c.data_type}${c.is_nullable === 'NO' ? ' NOT NULL' : ''})`).join(', '));
    }

    // Inspect Key Accounts: 1111, 1112, 1113, 1118, 1119, 5290, 5295
    console.log('\n=== KEY COA CONTROL ACCOUNTS (1111, 1112, 1113, 1118, 1119, 5290, 5295) ===');
    const accRes = await client.query(`
      SELECT id, code, name, type, subtype, is_active, is_group, description
      FROM public.accounting_account
      WHERE code IN ('1111', '1112', '1113', '1118', '1119', '5290', '5295')
      ORDER BY code;
    `);
    console.log(JSON.stringify(accRes.rows, null, 2));

    // Foreign Key constraints and unique indexes on bank/deposit/gateway tables
    console.log('\n=== CONSTRAINTS & INDEXES ON BANK / DEPOSIT / GATEWAY TABLES ===');
    const constraintsRes = await client.query(`
      SELECT tc.table_name, tc.constraint_name, tc.constraint_type, kcu.column_name,
             ccu.table_name AS foreign_table_name,
             ccu.column_name AS foreign_column_name 
      FROM information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      LEFT JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.table_schema = 'public'
        AND tc.table_name IN ('bank_account', 'bank_deposit_slip', 'gateway_payout_batch', 'gateway_settlement_order')
      ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name;
    `);
    console.table(constraintsRes.rows);

  } finally {
    await client.end();
  }
}

runForensicInspection().catch(err => {
  console.error('Forensic inspection error:', err);
  process.exit(1);
});
