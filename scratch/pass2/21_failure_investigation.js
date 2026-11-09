const L = require('./lib');
const ADMIN = L.signJWT({userId:'admin_01',role:'SUPER_ADMIN',phone:'9999999999',branchId:'br_01KYWH9YFVV5AK15D6313HB1NC'});
const DP = L.signJWT({userId:'dp_01',role:'DELIVERY_PARTNER',phone:'7777777777',branchId:'br_01KYWH9YFVV5AK15D6313HB1NC'});

(async () => {
  // 1. Account Ledger - needs UUID, not code
  const acctRow = (await L.q("SELECT id FROM accounting_account WHERE code='1121' LIMIT 1")).rows[0];
  const acctId = acctRow ? acctRow.id : null;
  console.log('Account 1121 ID:', acctId);
  if (acctId) {
    const r1 = await L.api('GET', `/api/v1/admin/accounting/ledger?account_id=${acctId}`, { token: ADMIN });
    console.log('Ledger by UUID:', r1.status, JSON.stringify(r1.data).slice(0, 500));
  }

  // 2. Period Close History - needs fiscal_year param
  const r2 = await L.api('GET', '/api/v1/admin/accounting/period-close/history?fiscal_year=2025-2026', { token: ADMIN });
  console.log('Period Close History 2025-2026:', r2.status, JSON.stringify(r2.data).slice(0, 500));

  const r2b = await L.api('GET', '/api/v1/admin/accounting/period-close/history?fiscal_year=2026-2027', { token: ADMIN });
  console.log('Period Close History 2026-2027:', r2b.status, JSON.stringify(r2b.data).slice(0, 500));

  // 3. Retained Earnings Roll-Forward
  const r3 = await L.api('GET', '/api/v1/admin/accounting/reports/retained-earnings-rollforward?fiscal_year=2025-2026', { token: ADMIN });
  console.log('RE Rollforward 2025-2026:', r3.status, JSON.stringify(r3.data).slice(0, 500));

  const r3b = await L.api('GET', '/api/v1/admin/accounting/reports/retained-earnings-rollforward?fiscal_year=2026-2027', { token: ADMIN });
  console.log('RE Rollforward 2026-2027:', r3b.status, JSON.stringify(r3b.data).slice(0, 500));

  // 4. DP Jobs - check RBAC
  const dpj = await L.api('GET', '/api/v1/delivery-partner/jobs', { token: DP });
  console.log('DP jobs:', dpj.status, JSON.stringify(dpj.data).slice(0, 500));

  await L.pool.end();
})().catch(e => { console.error('FAILED', e); process.exit(1); });
