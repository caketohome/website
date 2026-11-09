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

async function runForensicAudit() {
  const client = await pool.connect();
  try {
    console.log('==================================================================');
    console.log('  CAKETOHOME ERP — C7 DATABASE FORENSIC AUDIT (READ-ONLY)');
    console.log('==================================================================\n');

    // 1. All public tables
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);
    const tableNames = tablesRes.rows.map(r => r.table_name);
    console.log(`1. Total Public Tables Found: ${tableNames.length}`);
    console.log('Tables:', tableNames.join(', '));
    console.log('');

    // 2. Accounting Tables & Structure
    console.log('2. Accounting Core Tables:');
    const accTables = tableNames.filter(t => t.startsWith('accounting_'));
    for (const t of accTables) {
      const colRes = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position;
      `, [t]);
      const countRes = await client.query(`SELECT count(*)::int as count FROM public."${t}"`);
      console.log(`  - ${t} (Rows: ${countRes.rows[0].count}):`);
      colRes.rows.forEach(c => {
        console.log(`      ${c.column_name}: ${c.data_type} (nullable: ${c.is_nullable})`);
      });
    }
    console.log('');

    // 3. Purchase & Supplier Tables
    console.log('3. Purchase & Supplier Tables:');
    const purTables = tableNames.filter(t => t.includes('purchase') || t.includes('supplier') || t.includes('vendor') || t.includes('bill') || t.includes('gnr') || t.includes('grn'));
    console.log('Matching tables:', purTables.join(', '));
    for (const t of purTables) {
      const colRes = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position;
      `, [t]);
      const countRes = await client.query(`SELECT count(*)::int as count FROM public."${t}"`);
      console.log(`  - ${t} (Rows: ${countRes.rows[0].count}):`);
      colRes.rows.forEach(c => {
        console.log(`      ${c.column_name}: ${c.data_type}`);
      });
    }
    console.log('');

    // 4. Customer & Order Tables
    console.log('4. Customer & Order Tables:');
    const custTables = tableNames.filter(t => t === 'customer' || t.includes('order') || t.includes('invoice') || t.includes('receivable'));
    console.log('Matching tables:', custTables.join(', '));
    for (const t of custTables) {
      const colRes = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position;
      `, [t]);
      const countRes = await client.query(`SELECT count(*)::int as count FROM public."${t}"`);
      console.log(`  - ${t} (Rows: ${countRes.rows[0].count}):`);
      colRes.rows.forEach(c => {
        console.log(`      ${c.column_name}: ${c.data_type}`);
      });
    }
    console.log('');

    // 5. Teller & Cash & Bank Tables
    console.log('5. Teller, Cash & Bank Tables:');
    const cashBankTables = tableNames.filter(t => t.includes('teller') || t.includes('bank') || t.includes('deposit') || t.includes('settle') || t.includes('payout'));
    console.log('Matching tables:', cashBankTables.join(', '));
    for (const t of cashBankTables) {
      const colRes = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position;
      `, [t]);
      const countRes = await client.query(`SELECT count(*)::int as count FROM public."${t}"`);
      console.log(`  - ${t} (Rows: ${countRes.rows[0].count}):`);
      colRes.rows.forEach(c => {
        console.log(`      ${c.column_name}: ${c.data_type}`);
      });
    }
    console.log('');

    // 6. Branch & Cost Centre & Dimensions
    console.log('6. Branch & Cost Centre Tables:');
    const branchTables = tableNames.filter(t => t.includes('branch') || t.includes('cost_centre') || t.includes('department'));
    console.log('Matching tables:', branchTables.join(', '));
    for (const t of branchTables) {
      const colRes = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position;
      `, [t]);
      const countRes = await client.query(`SELECT count(*)::int as count FROM public."${t}"`);
      console.log(`  - ${t} (Rows: ${countRes.rows[0].count}):`);
      colRes.rows.forEach(c => {
        console.log(`      ${c.column_name}: ${c.data_type}`);
      });
    }
    console.log('');

    // 7. Verify Specific CoA Accounts
    console.log('7. Chart of Accounts Key Targets:');
    const coaRes = await client.query(`
      SELECT code, name, type, subtype, is_group, is_active
      FROM public.accounting_account
      WHERE code IN ('1111', '1112', '1113', '1114', '1118', '1119', '1121', '1122', '1131', '1132', '1133', '1141', '1142', '1143', '1144', '2111', '4110', '4120', '4190', '5110', '5120', '5130', '5190', '5240', '5280', '5290', '5295', '5296', '5310', '3300')
      ORDER BY code;
    `);
    console.table(coaRes.rows);

    const totalAccounts = await client.query('SELECT count(*)::int as count FROM public.accounting_account');
    console.log(`Total Chart of Accounts count in DB: ${totalAccounts.rows[0].count}`);

    // Check if 5150 exists
    const acc5150 = await client.query("SELECT * FROM public.accounting_account WHERE code = '5150'");
    console.log(`Account 5150 exists?: ${acc5150.rows.length > 0}`);

    // Check if 2119 exists
    const acc2119 = await client.query("SELECT * FROM public.accounting_account WHERE code = '2119'");
    console.log(`Account 2119 exists?: ${acc2119.rows.length > 0}`);

    // 8. Cost Centre / Dimension fields in Journal Line or Voucher or Expense
    console.log('\n8. Checking for Cost Centre / Dimension fields in core tables:');
    const dimCheck = await client.query(`
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' 
        AND column_name ~* 'cost_centre|cost_center|department|dimension|division|segment'
      ORDER BY table_name, column_name;
    `);
    console.log('Dimension columns found:', dimCheck.rows);

    // 9. Due date / reminder / payment allocation columns
    console.log('\n9. Checking for Due Date / Payment / Reminder / Bill columns:');
    const billCheck = await client.query(`
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' 
        AND column_name ~* 'due_date|due_days|overdue|reminder|bill_no|bill_date|allocated_amount|outstanding'
      ORDER BY table_name, column_name;
    `);
    console.log('Due/Bill/Reminder columns found:', billCheck.rows);

  } finally {
    client.release();
    await pool.end();
  }
}

runForensicAudit().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
