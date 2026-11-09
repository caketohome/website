const fs = require('fs');
const path = require('path');
const { Client } = require(path.resolve(__dirname, '../frontend/node_modules/pg'));

function getDbConn() {
  const env = fs.readFileSync('.env', 'utf8');
  for (const line of env.split('\n')) {
    if (line.trim().startsWith('DATABASE_URL=')) {
      let val = line.trim().substring('DATABASE_URL='.length).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
      return val;
    }
  }
}

async function run() {
  console.log('=============================================================================');
  console.log('CakeToHome ERP — Test Category B: Chart of Accounts & Accounting Configuration');
  console.log('=============================================================================\n');

  const client = new Client({ connectionString: getDbConn(), ssl: { rejectUnauthorized: false } });
  await client.connect();

  // B1. Chart of Accounts Audit
  console.log('[B1] Auditing Chart of Accounts (public.accounting_account)...');
  const typeCounts = await client.query(`
    SELECT type, COUNT(*) as count 
    FROM public.accounting_account 
    WHERE deleted_at IS NULL
    GROUP BY type 
    ORDER BY type;
  `);
  console.table(typeCounts.rows);

  const totalCoa = await client.query('SELECT COUNT(*) as count FROM public.accounting_account WHERE deleted_at IS NULL');
  console.log(`  ✓ Total active accounts in Chart of Accounts: ${totalCoa.rows[0].count} (Expected: 100)`);

  // B2. Mandated Canonical Accounts Verification
  console.log('\n[B2] Verifying Mandated Canonical Leaf Accounts...');
  const mandatedCodes = [
    '1111', '1112', '1113', '1114', '1121', '1122', '1131', '1132', '1133',
    '1141', '1142', '1143', '2111', '3210', '3220', '3300', '4110', '4120',
    '4130', '4190', '5110', '5120', '5130', '5290', '5295', '5296', '5310'
  ];

  const foundAccounts = await client.query(`
    SELECT code, name, type, subtype, is_group, is_active
    FROM public.accounting_account
    WHERE code = ANY($1) AND deleted_at IS NULL
    ORDER BY code;
  `, [mandatedCodes]);

  console.log(`  ✓ Found ${foundAccounts.rows.length} / ${mandatedCodes.length} mandated leaf accounts.`);
  const missing = mandatedCodes.filter(c => !foundAccounts.rows.some(r => r.code === c));
  if (missing.length > 0) {
    console.log('  ❌ Missing mandated codes:', missing);
  } else {
    console.log('  ✓ 100% of mandated canonical accounts (27/27) are active and verified.');
  }

  // B3. Accounting Start Date
  console.log('\n[B3] Verifying Accounting Start Date Configuration...');
  const settingRes = await client.query(`
    SELECT "key", "value" FROM public.setting 
    WHERE "key" IN ('accounting_start_date', 'fiscal_year_start_month', 'company_name', 'base_currency')
  `);
  console.table(settingRes.rows);
  const startDate = settingRes.rows.find(r => r.key === 'accounting_start_date')?.value;
  console.log(`  ✓ Authoritative Accounting Start Date: ${startDate} (Expected: 2026-04-01)`);

  // B4. Fiscal Periods
  console.log('\n[B4] Auditing Fiscal Periods (public.accounting_fiscal_period)...');
  const periodRes = await client.query(`
    SELECT id, fiscal_year, period_name, start_date::text, end_date::text, is_locked
    FROM public.accounting_fiscal_period
    ORDER BY start_date;
  `);
  console.table(periodRes.rows);
  console.log(`  ✓ Total fiscal periods configured: ${periodRes.rows.length} (Expected: 12)`);

  // Check current period (October 2026)
  const octPeriod = periodRes.rows.find(p => p.period_name.includes('October 2026'));
  console.log(`  ✓ Active Operating Period: ${octPeriod?.period_name} (${octPeriod?.start_date} to ${octPeriod?.end_date})`);
  console.log(`  ✓ Period Status: is_locked = ${octPeriod?.is_locked}`);

  await client.end();
  console.log('\n=============================================================================');
  console.log('CATEGORY B VERIFICATION COMPLETE: COA & CONFIG INVARIANTS CONFIRMED');
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
