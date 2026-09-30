/**
 * Phase 4F Step 4.6 Forensic Inspection Script (Read-Only)
 */
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
    console.log('=== Step 4.6 Forensic Database Inspection ===\n');

    // 1. Chart of Accounts Inspection for 4190 and related accounts
    console.log('\n--- 1. Chart of Accounts Inspection ---');
    const coaRes = await client.query(`
      SELECT id, code, name, type, subtype, level, is_group, is_system, is_active, tax_rate, tax_class
      FROM public.accounting_account
      WHERE code IN ('4190', '4110', '4120', '4130', '1121', '1122', '1111', '1112', '1113', '1131', '1132', '1133', '5110', '5120', '5130', '2121', '2122', '2123', '2124', '2125', '2126', '2127', '2128', '2129', '2170', '2180', '5290')
      ORDER BY code;
    `);
    console.table(coaRes.rows);

    // Check specifically if 4190 exists
    const acc4190 = coaRes.rows.find(r => r.code === '4190');
    console.log('\nAccount 4190 inspection:', acc4190 ? `EXISTS: name="${acc4190.name}", type=${acc4190.type}, subtype=${acc4190.subtype}, is_group=${acc4190.is_group} (is_leaf=${!acc4190.is_group}), active=${acc4190.is_active}, is_system=${acc4190.is_system}` : 'DOES NOT EXIST');

    // Also check all 4xxx accounts
    const all4xxx = await client.query(`
      SELECT code, name, type, subtype, is_group, is_system, is_active
      FROM public.accounting_account
      WHERE code LIKE '4%'
      ORDER BY code;
    `);
    console.log('\nAll 4xxx revenue accounts:');
    console.table(all4xxx.rows);

    // Also check all 21xx liability accounts
    const all21xx = await client.query(`
      SELECT code, name, type, subtype, is_group, is_system, is_active
      FROM public.accounting_account
      WHERE code LIKE '21%'
      ORDER BY code;
    `);
    console.log('\nAll 21xx liability accounts:');
    console.table(all21xx.rows);

    // 2. Payment Transaction Columns & Constraints
    console.log('\n--- 2. payment_transaction Schema ---');
    const ptCols = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'payment_transaction'
      ORDER BY ordinal_position;
    `);
    console.table(ptCols.rows);

    // Check payment_transaction check constraints & enums
    const ptConstraints = await client.query(`
      SELECT conname, pg_get_constraintdef(c.oid) as def
      FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
      JOIN pg_class cl ON cl.oid = c.conrelid
      WHERE n.nspname = 'public' AND cl.relname = 'payment_transaction';
    `);
    console.log('\npayment_transaction constraints:');
    console.table(ptConstraints.rows);

    // Existing payment_transaction distinct statuses
    const ptStatuses = await client.query(`
      SELECT status, settlement_status, count(*) as count
      FROM public.payment_transaction
      GROUP BY status, settlement_status;
    `);
    console.log('\npayment_transaction distinct statuses in live DB:');
    console.table(ptStatuses.rows);

    // 3. accounting_voucher Voucher Types & Constraints
    console.log('\n--- 3. accounting_voucher Schema & Constraints ---');
    const avConstraints = await client.query(`
      SELECT conname, pg_get_constraintdef(c.oid) as def
      FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
      JOIN pg_class cl ON cl.oid = c.conrelid
      WHERE n.nspname = 'public' AND cl.relname = 'accounting_voucher';
    `);
    console.log('accounting_voucher constraints:');
    console.table(avConstraints.rows);

    // 4. inventory_movement Movement Types & Constraints
    console.log('\n--- 4. inventory_movement Schema & Constraints ---');
    const imConstraints = await client.query(`
      SELECT conname, pg_get_constraintdef(c.oid) as def
      FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
      JOIN pg_class cl ON cl.oid = c.conrelid
      WHERE n.nspname = 'public' AND cl.relname = 'inventory_movement';
    `);
    console.log('inventory_movement constraints:');
    console.table(imConstraints.rows);

    // 5. inventory_cost_lot & consumption constraints
    console.log('\n--- 5. inventory_cost_consumption Schema & Constraints ---');
    const iccCols = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'inventory_cost_consumption'
      ORDER BY ordinal_position;
    `);
    console.table(iccCols.rows);

    const iclConstraints = await client.query(`
      SELECT conname, pg_get_constraintdef(c.oid) as def
      FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
      JOIN pg_class cl ON cl.oid = c.conrelid
      WHERE n.nspname = 'public' AND cl.relname = 'inventory_cost_lot';
    `);
    console.log('inventory_cost_lot constraints:');
    console.table(iclConstraints.rows);

    // 6. Order columns and structure
    console.log('\n--- 6. order Schema & Columns ---');
    const ordCols = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'order'
      ORDER BY ordinal_position;
    `);
    console.table(ordCols.rows);

    // Order status distinct values in live DB
    const ordStatuses = await client.query(`
      SELECT status, count(*) as count
      FROM public."order"
      GROUP BY status;
    `);
    console.log('\norder distinct statuses in live DB:');
    console.table(ordStatuses.rows);

    // 7. Inspect Medusa / legacy return/refund tables: return, return_item, refund, order_item, etc.
    console.log('\n--- 7. Inspect return, return_item, refund tables ---');
    for (const t of ['return', 'return_item', 'refund', 'order_item', 'order_lifecycle_refund']) {
      const exists = await client.query(`
        SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1;
      `, [t]);
      if (parseInt(exists.rows[0].count) > 0) {
        const count = await client.query(`SELECT count(*) FROM public."${t}";`);
        const cols = await client.query(`
          SELECT column_name, data_type 
          FROM information_schema.columns 
          WHERE table_schema = 'public' AND table_name = $1;
        `, [t]);
        console.log(`Table "${t}": row count = ${count.rows[0].count}, columns = [${cols.rows.map(c => c.column_name).join(', ')}]`);
      } else {
        console.log(`Table "${t}": DOES NOT EXIST`);
      }
    }

  } finally {
    await client.end();
  }
}

runForensics().catch(err => {
  console.error('Forensics error:', err);
  process.exit(1);
});
