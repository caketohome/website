/**
 * CakeToHome ERP — Phase B Step B8: Independent PostgreSQL Verification
 * Directly inspects information_schema, pg_catalog, constraints, columns,
 * foreign keys, indexes, and triggers on public.bank_account and accounting tables.
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('../node_modules/pg');

function getConnectionString() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
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
  throw new Error("No database connection string found");
}

async function verify() {
  console.log('=============================================================================');
  console.log('CakeToHome ERP — Phase B8: Independent PostgreSQL Verification');
  console.log('=============================================================================\n');

  const client = new Client({
    connectionString: getConnectionString(),
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  let passCount = 0;
  let failCount = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passCount++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failCount++;
    }
  }

  try {
    // 1. Verify bank_account columns
    console.log('[Check 1] Verifying public.bank_account Column Schema...');
    const colsRes = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'bank_account'
      ORDER BY ordinal_position
    `);
    const colNames = colsRes.rows.map(r => r.column_name);

    assert(!colNames.includes('branch_id'), 'Strict enterprise rule: branch_id column does NOT exist in public.bank_account');
    assert(colNames.includes('company_id'), 'company_id column exists in public.bank_account');
    assert(colNames.includes('account_name'), 'account_name column exists in public.bank_account');
    assert(colNames.includes('account_number'), 'account_number column exists in public.bank_account');
    assert(colNames.includes('account_type'), 'account_type column exists in public.bank_account');
    assert(colNames.includes('ifsc_code'), 'ifsc_code column exists in public.bank_account');
    assert(colNames.includes('bank_name'), 'bank_name column exists in public.bank_account');
    assert(colNames.includes('branch_name'), 'branch_name column exists in public.bank_account');
    assert(colNames.includes('gl_account_id'), 'gl_account_id column exists in public.bank_account');
    assert(colNames.includes('status'), 'status column exists in public.bank_account');
    assert(colNames.includes('metadata'), 'metadata column exists in public.bank_account');

    const companyIdCol = colsRes.rows.find(r => r.column_name === 'company_id');
    assert(companyIdCol?.is_nullable === 'NO', 'company_id column is NOT NULL');

    const glAccountIdCol = colsRes.rows.find(r => r.column_name === 'gl_account_id');
    assert(glAccountIdCol?.is_nullable === 'NO', 'gl_account_id column is NOT NULL');

    // 2. Verify Foreign Keys
    console.log('\n[Check 2] Verifying Foreign Key Constraints...');
    const fkRes = await client.query(`
      SELECT
        tc.constraint_name,
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
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name = 'bank_account'
    `);

    const companyFk = fkRes.rows.find(r => r.column_name === 'company_id');
    assert(companyFk && companyFk.foreign_table_name === 'company' && companyFk.foreign_column_name === 'id',
      `Foreign key bank_account.company_id references company(id) [Constraint: ${companyFk?.constraint_name}]`);

    const glFk = fkRes.rows.find(r => r.column_name === 'gl_account_id');
    assert(glFk && glFk.foreign_table_name === 'accounting_account' && glFk.foreign_column_name === 'id',
      `Foreign key bank_account.gl_account_id references accounting_account(id) [Constraint: ${glFk?.constraint_name}]`);

    // 3. Verify Unique Constraints
    console.log('\n[Check 3] Verifying Unique Constraints & Indexes...');
    const uniqueRes = await client.query(`
      SELECT
        tc.constraint_name,
        kcu.column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      WHERE tc.constraint_type = 'UNIQUE'
        AND tc.table_name = 'bank_account'
      ORDER BY tc.constraint_name, kcu.ordinal_position
    `);

    const uniqueMap = new Map();
    for (const row of uniqueRes.rows) {
      if (!uniqueMap.has(row.constraint_name)) uniqueMap.set(row.constraint_name, []);
      uniqueMap.get(row.constraint_name).push(row.column_name);
    }

    let hasGlUnique = false;
    let hasIfscAccUnique = false;
    for (const [cname, cols] of uniqueMap.entries()) {
      if (cols.length === 1 && cols[0] === 'gl_account_id') hasGlUnique = true;
      if (cols.length === 2 && cols.includes('ifsc_code') && cols.includes('account_number')) hasIfscAccUnique = true;
    }

    assert(hasGlUnique, '1:1 GL Ledger mapping enforced: UNIQUE constraint on gl_account_id exists');
    assert(hasIfscAccUnique, 'Duplicate account prevention: UNIQUE constraint on (ifsc_code, account_number) exists');

    // 4. Verify Check Constraints
    console.log('\n[Check 4] Verifying Check Constraints...');
    const chkRes = await client.query(`
      SELECT conname, pg_get_constraintdef(c.oid) AS def
      FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
      JOIN pg_class cl ON cl.oid = c.conrelid
      WHERE cl.relname = 'bank_account' AND c.contype = 'c'
    `);
    const chkNames = chkRes.rows.map(r => r.conname);

    assert(chkNames.includes('chk_bank_account_ifsc'), 'IFSC format check constraint (chk_bank_account_ifsc) exists');
    assert(chkNames.includes('chk_bank_account_type'), 'Account type check constraint (chk_bank_account_type) exists');
    assert(chkNames.includes('chk_bank_account_status'), 'Account status check constraint (chk_bank_account_status) exists');

    // 5. Verify Parent GL Account Structure (1110/1112)
    console.log('\n[Check 5] Verifying Bank GL Parent Structure...');
    const parentGlRes = await client.query(`
      SELECT id, code, name, type, subtype, is_active, is_group
      FROM public.accounting_account
      WHERE code IN ('1110', '1112') AND deleted_at IS NULL
    `);
    const acc1110 = parentGlRes.rows.find(r => r.code === '1110');
    const acc1112 = parentGlRes.rows.find(r => r.code === '1112');

    assert(acc1110 !== undefined, 'Parent Cash & Cash Equivalents Account 1110 exists');
    assert(acc1110?.type === 'ASSET' && acc1110?.is_group === true, 'Account 1110 has type=ASSET, is_group=true');
    assert(acc1112 !== undefined, 'Parent/Control Bank GL Account 1112 exists');
    assert(acc1112?.type === 'ASSET' && acc1112?.subtype === 'BANK', 'Account 1112 has type=ASSET, subtype=BANK');

    // 6. Verify Downstream Table Schema Intactness
    console.log('\n[Check 6] Verifying Downstream Settlement & Clearing Tables...');
    const gsoCols = (await client.query(`
      SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'gateway_settlement_order'
    `)).rows.map(r => r.column_name);
    assert(gsoCols.includes('voucher_id'), 'gateway_settlement_order has voucher_id');
    assert(gsoCols.includes('settlement_branch_id'), 'gateway_settlement_order has settlement_branch_id');

    const gpbCols = (await client.query(`
      SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'gateway_payout_batch'
    `)).rows.map(r => r.column_name);
    assert(gpbCols.includes('bank_account_id'), 'gateway_payout_batch has bank_account_id');
    assert(gpbCols.includes('company_id'), 'gateway_payout_batch has company_id');

    const bdsCols = (await client.query(`
      SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bank_deposit_slip'
    `)).rows.map(r => r.column_name);
    assert(bdsCols.includes('bank_account_id'), 'bank_deposit_slip has bank_account_id');
    assert(bdsCols.includes('transit_voucher_id'), 'bank_deposit_slip has transit_voucher_id');

    console.log('\n=============================================================================');
    console.log(`B8 POSTGRESQL VERIFICATION: ${passCount} PASSED, ${failCount} FAILED`);
    console.log('=============================================================================');

    await client.end();
    if (failCount > 0) process.exit(1);
  } catch (err) {
    console.error('B8 VERIFICATION FATAL ERROR:', err);
    await client.end();
    process.exit(1);
  }
}

verify();
