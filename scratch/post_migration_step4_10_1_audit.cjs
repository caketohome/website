const fs = require('fs');
const path = require('path');
const { Pool } = require('E:/vig/cakes2home-main/cakes2home-main/frontend/node_modules/pg');

function getConnectionString() {
  if (process.env.PG_URL) return process.env.PG_URL;
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const candidatePaths = [
    'E:/vig/cakes2home-main/cakes2home-main/frontend/.env',
    'E:/vig/cakes2home-main/cakes2home-main/backend/.env',
    'E:/vig/cakes2home-main/cakes2home-main/.env'
  ];
  for (const envPath of candidatePaths) {
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
  }
  throw new Error("No database connection string found in .env files");
}

async function auditPostMigration() {
  const pool = new Pool({
    connectionString: getConnectionString(),
    ssl: { rejectUnauthorized: false }
  });
  const client = await pool.connect();
  let passed = 0;
  let failed = 0;

  console.log('=============================================================================');
  console.log('CakeToHome ERP — Substep 4.10.1 Post-Migration Comprehensive Independent Audit');
  console.log('=============================================================================\n');

  try {
    // 1. CoA Total Count (99 expected)
    const accRes = await client.query('SELECT COUNT(*) FROM accounting_account;');
    const accCount = parseInt(accRes.rows[0].count, 10);
    if (accCount === 99) {
      console.log(`[PASS] [1/24] accounting_account: ${accCount} (expected 99)`);
      passed++;
    } else {
      console.error(`[FAIL] [1/24] accounting_account: ${accCount} (expected 99)`);
      failed++;
    }

    // 2. Account 1118 attributes
    const a1118Res = await client.query(`
      SELECT a.*, p.code as parent_code
      FROM accounting_account a
      LEFT JOIN accounting_account p ON a.parent_id = p.id
      WHERE a.code = '1118';
    `);
    if (a1118Res.rows.length === 1) {
      const a = a1118Res.rows[0];
      const match = a.name === 'Deposit in Transit' &&
                    a.type === 'ASSET' &&
                    a.subtype === 'CURRENT_ASSET' &&
                    a.parent_code === '1110' &&
                    a.level === 4 &&
                    a.is_group === false &&
                    a.is_active === true &&
                    a.is_system === true;
      if (match) {
        console.log(`[PASS] [2/24] Account 1118 attributes verified (name="${a.name}", parent=${a.parent_code}, level=${a.level}, leaf=true, active=true)`);
        passed++;
      } else {
        console.error(`[FAIL] [2/24] Account 1118 attribute mismatch: ${JSON.stringify(a)}`);
        failed++;
      }
    } else {
      console.error(`[FAIL] [2/24] Account 1118 not found!`);
      failed++;
    }

    // 3. New Tables Row Counts (Must be 0)
    const newTables = [
      'bank_account',
      'bank_deposit_slip',
      'gateway_payout_batch',
      'gateway_settlement_order'
    ];
    let step = 3;
    for (const t of newTables) {
      const res = await client.query(`SELECT COUNT(*) FROM "${t}"`);
      const cnt = parseInt(res.rows[0].count, 10);
      if (cnt === 0) {
        console.log(`[PASS] [${step}/24] Table ${t} exists and contains exactly 0 rows`);
        passed++;
      } else {
        console.error(`[FAIL] [${step}/24] Table ${t} contains ${cnt} rows (expected 0)`);
        failed++;
      }
      step++;
    }

    // 4. Financial and Operational Baseline Table Counts
    const baselineTables = [
      { name: 'accounting_voucher', expected: 0 },
      { name: 'accounting_journal_entry', expected: 0 },
      { name: 'accounting_journal_line', expected: 0 },
      { name: 'accounting_fiscal_period', expected: 0 },
      { name: 'purchase', expected: 0 },
      { name: 'purchase_item', expected: 0 },
      { name: 'purchase_payment', expected: 0 },
      { name: 'supplier', expected: 0 },
      { name: 'branch', expected: 57 },
      { name: 'branch_inventory', expected: 424 },
      { name: 'inventory_cost_lot', expected: 0 },
      { name: 'inventory_movement', expected: 0 },
      { name: 'inventory_cost_consumption', expected: 0 },
      { name: 'order', expected: 173 },
      { name: 'payment_transaction', expected: 53 },
    ];

    for (const b of baselineTables) {
      const q = b.name === 'order' ? 'SELECT COUNT(*) FROM "order"' : `SELECT COUNT(*) FROM "${b.name}"`;
      const res = await client.query(q);
      const cnt = parseInt(res.rows[0].count, 10);
      if (cnt === b.expected) {
        console.log(`[PASS] [${step}/24] ${b.name}: ${cnt} (expected ${b.expected})`);
        passed++;
      } else {
        console.error(`[FAIL] [${step}/24] ${b.name}: ${cnt} (expected ${b.expected})`);
        failed++;
      }
      step++;
    }

    // 5. Check accounting_start_date is unconfigured
    const setRes = await client.query(`SELECT COUNT(*) FROM setting WHERE key = 'accounting_start_date'`);
    const setCnt = parseInt(setRes.rows[0].count, 10);
    if (setCnt === 0) {
      console.log(`[PASS] [${step}/24] accounting_start_date: ${setCnt} (unconfigured)`);
      passed++;
    } else {
      console.error(`[FAIL] [${step}/24] accounting_start_date found: ${setCnt}`);
      failed++;
    }
    step++;

    // 6. Synthetic accounting rows
    const synthRes = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM accounting_account WHERE code LIKE '999%') +
        (SELECT COUNT(*) FROM accounting_account WHERE name ILIKE '%test%') as synth_accounts;
    `);
    const synthCnt = parseInt(synthRes.rows[0].synth_accounts, 10);
    if (synthCnt === 0) {
      console.log(`[PASS] [${step}/24] synthetic accounting rows: ${synthCnt} (expected 0)`);
      passed++;
    } else {
      console.error(`[FAIL] [${step}/24] synthetic accounting rows found: ${synthCnt}`);
      failed++;
    }
    step++;

    // 7. Verify Foreign Keys and Constraints on new tables
    const fkRes = await client.query(`
      SELECT
        tc.table_name, kcu.column_name, ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name IN ('bank_account', 'bank_deposit_slip', 'gateway_payout_batch', 'gateway_settlement_order')
      ORDER BY tc.table_name, kcu.column_name;
    `);
    console.log(`\nVerified ${fkRes.rows.length} foreign keys across new tables:`);
    for (const fk of fkRes.rows) {
      console.log(`  -> ${fk.table_name}.${fk.column_name} => ${fk.foreign_table_name}.${fk.foreign_column_name}`);
    }
    if (fkRes.rows.length >= 8) {
      console.log(`[PASS] [${step}/24] Foreign keys on new tables: ${fkRes.rows.length} verified.`);
      passed++;
    } else {
      console.error(`[FAIL] [${step}/24] Expected at least 8 FKs, found ${fkRes.rows.length}`);
      failed++;
    }

    console.log('\n=============================================================================');
    console.log(`POST-MIGRATION AUDIT SUMMARY: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
    console.log(`STATUS: ${failed === 0 ? '100% PRISTINE & COMPLIANT' : 'FAILURES DETECTED'}`);
    console.log('=============================================================================\n');

  } finally {
    client.release();
    await pool.end();
  }
}

auditPostMigration().catch(err => { console.error(err); process.exit(1); });
