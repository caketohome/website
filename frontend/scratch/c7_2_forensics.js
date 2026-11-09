const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

function getConnectionString() {
  const envPath = path.join(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
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
  }
  throw new Error("DATABASE_URL not found in .env");
}

const pool = new Pool({ connectionString: getConnectionString() });

async function inspectC72Forensics() {
  const client = await pool.connect();
  try {
    console.log('==================================================================');
    console.log('  CAKETOHOME ERP — PHASE C7.2 FORENSIC INSPECTION');
    console.log('==================================================================\n');

    // 1. Columns of purchase, purchase_payment, purchase_payment_allocation, supplier, bank_account
    const tables = [
      'purchase',
      'purchase_payment',
      'purchase_payment_allocation',
      'purchase_item',
      'supplier',
      'bank_account',
      'accounting_account',
      'accounting_voucher',
      'accounting_journal_entry',
      'accounting_journal_line'
    ];

    for (const tbl of tables) {
      console.log(`>>> TABLE: ${tbl}`);
      const cols = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position;
      `, [tbl]);
      cols.rows.forEach(c => {
        console.log(`    - ${c.column_name}: ${c.data_type} (nullable: ${c.is_nullable}, default: ${c.column_default})`);
      });

      const count = await client.query(`SELECT count(*)::int as count FROM public."${tbl}"`);
      console.log(`  Row count: ${count.rows[0].count}`);

      // Sample first row if exists
      if (count.rows[0].count > 0) {
        const sample = await client.query(`SELECT * FROM public."${tbl}" LIMIT 1`);
        console.log(`  Sample row keys:`, Object.keys(sample.rows[0]));
      }
      console.log('');
    }

    // 2. Check CoA for 2111, 1131, 1132, 1133, 1111, 1112, 1114
    console.log('>>> CHART OF ACCOUNTS CANONICAL VERIFICATION:');
    const coaRes = await client.query(`
      SELECT code, name, type, is_active
      FROM public.accounting_account
      WHERE code IN ('2111', '1131', '1132', '1133', '1111', '1112', '1114', '1141', '5240')
      ORDER BY code;
    `);
    coaRes.rows.forEach(a => {
      console.log(`  [${a.code}] ${a.name} (${a.type}) active=${a.is_active}`);
    });
    console.log('');

    // 3. Bank Account Master details
    console.log('>>> BANK ACCOUNTS:');
    const banks = await client.query(`SELECT id, account_name, account_number, bank_name, branch_name, gl_account_id, status FROM public.bank_account`);
    banks.rows.forEach(b => {
      console.log(`  Bank ID: ${b.id}, Name: ${b.account_name}, GL Account: ${b.gl_account_id}, Branch: ${b.branch_name}, Status: ${b.status}`);
    });
    console.log('');

    // 4. Existing Foreign Keys on purchase, purchase_payment, purchase_payment_allocation
    console.log('>>> FOREIGN KEYS on Purchase & Payment tables:');
    const fks = await client.query(`
      SELECT
        tc.table_name, kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        rc.delete_rule
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      JOIN information_schema.referential_constraints AS rc
        ON rc.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name IN ('purchase', 'purchase_payment', 'purchase_payment_allocation')
      ORDER BY tc.table_name, kcu.column_name;
    `);
    fks.rows.forEach(fk => {
      console.log(`  ${fk.table_name}.${fk.column_name} -> ${fk.foreign_table_name}.${fk.foreign_column_name} [ON DELETE ${fk.delete_rule}]`);
    });

  } finally {
    client.release();
    await pool.end();
  }
}

inspectC72Forensics().catch(console.error);
