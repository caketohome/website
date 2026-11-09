const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

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

async function inspectExpenseSchema() {
  const client = new Client({ connectionString: getConnectionString(), ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log('=============================================================================');
  console.log('CakeToHome ERP — Phase C5 Expense Forensics: Database Inspection');
  console.log('=============================================================================\n');

  // 1. Tables matching 'expense%'
  const tablesRes = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name LIKE '%expense%'
    ORDER BY table_name;
  `);
  console.log('1. Tables related to expenses:');
  console.table(tablesRes.rows);

  // 2. Columns for each expense table
  for (const row of tablesRes.rows) {
    const tableName = row.table_name;
    console.log(`\nColumns for table: ${tableName}`);
    const colsRes = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default, udt_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position;
    `, [tableName]);
    console.table(colsRes.rows);

    // Row count
    const countRes = await client.query(`SELECT COUNT(*) as count FROM "${tableName}"`);
    console.log(`Current row count in ${tableName}: ${countRes.rows[0].count}`);

    // Constraints & Foreign Keys
    const fkRes = await client.query(`
      SELECT
        tc.constraint_name,
        tc.constraint_type,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      LEFT JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.table_schema = 'public' AND tc.table_name = $1;
    `, [tableName]);
    console.log(`Constraints for ${tableName}:`);
    console.table(fkRes.rows);
  }

  // 3. Enum types related to expense
  console.log('\n3. Enum types related to expense:');
  const enumRes = await client.query(`
    SELECT t.typname, e.enumlabel
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname LIKE '%expense%'
    ORDER BY t.typname, e.enumsortorder;
  `);
  console.table(enumRes.rows);

  // 3b. Existing expense categories
  console.log('\n3b. Pre-seeded expense categories in expense_category:');
  const catRowsRes = await client.query(`
    SELECT id, name, description, is_active FROM expense_category ORDER BY id;
  `);
  console.table(catRowsRes.rows);

  // 4. Accounting accounts related to expenses (Account code 5xxx or type EXPENSE)
  console.log('\n4. Accounting accounts in COA of type EXPENSE or code 5xxx:');
  const accountsRes = await client.query(`
    SELECT code, name, type, is_active
    FROM accounting_account
    WHERE type = 'EXPENSE' OR code LIKE '5%'
    ORDER BY code;
  `);
  console.table(accountsRes.rows);

  // 6. Asset & Liability Accounts in COA relevant to Expenses (Cash, Bank, GST Input, AP, Accruals)
  console.log('\n6. Asset & Liability Accounts relevant to Expenses (1xxx & 2xxx):');
  const assetLiabRes = await client.query(`
    SELECT code, name, type, is_active
    FROM accounting_account
    WHERE code LIKE '11%' OR code LIKE '13%' OR code LIKE '21%' OR code LIKE '22%'
    ORDER BY code;
  `);
  console.table(assetLiabRes.rows);

  // 7. Structure of accounting_voucher and valid voucher types
  console.log('\n7. Voucher schema & enum values:');
  const vColsRes = await client.query(`
    SELECT column_name, data_type, is_nullable, udt_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'accounting_voucher'
    ORDER BY ordinal_position;
  `);
  console.table(vColsRes.rows);

  const vEnumRes = await client.query(`
    SELECT t.typname, e.enumlabel
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'voucher_type' OR t.typname LIKE '%voucher%'
    ORDER BY t.typname, e.enumsortorder;
  `);
  console.table(vEnumRes.rows);

  await client.end();
}

inspectExpenseSchema().catch(err => {
  console.error("Forensic inspection failed:", err);
  process.exit(1);
});
