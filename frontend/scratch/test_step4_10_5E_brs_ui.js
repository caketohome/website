/**
 * CakeToHome ERP — Phase 4F Step 4.10 Substep 4.10.5-E BRS UI Workspace Verification Suite
 *
 * Verifies:
 * 1. BankReconciliationPanel component structure, exports, and layout integrity
 * 2. Wiring across staff-access-control.ts, admin-tabs.tsx, AdminSidebar.tsx, and page.tsx
 * 3. Contract adherence to the 6 D-B GET endpoints + bank-accounts endpoint
 * 4. Read-only invariant: zero POST/PUT/DELETE mutations in UI code
 * 5. Multi-tenant RBAC enforcement via StaffAccessControl
 * 6. Mathematical BRS bridge visualization conformity
 * 7. Live PostgreSQL audit confirming zero mutations to ledger or reconciliation tables
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (condition) {
    passedTests++;
    console.log(`  ✓ ${message}`);
  } else {
    failedTests++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

async function run() {
  console.log('================================================================');
  console.log('  STARTING STEP 4.10.5-E BRS UI WORKSPACE VERIFICATION SUITE   ');
  console.log('================================================================\n');

  const frontendRoot = path.join(__dirname, '..');

  // ── GROUP 1: Component File & Source Code Integrity ─────────────────────────
  console.log('--- Group 1: Component File & Source Code Integrity ---');
  const panelPath = path.join(frontendRoot, 'src/components/dashboard/admin/bank-reconciliation-panel.tsx');
  assert(fs.existsSync(panelPath), 'bank-reconciliation-panel.tsx exists on disk');

  const panelContent = fs.readFileSync(panelPath, 'utf8');
  assert(panelContent.includes('export default function BankReconciliationPanel'), 'Exports default BankReconciliationPanel component');
  assert(panelContent.includes('"use client"'), 'Marked with "use client" directive');
  assert(panelContent.includes('Bank Reconciliation Statement (BRS)'), 'Contains canonical BRS workspace title');
  assert(panelContent.includes('formatPaiseToInr'), 'Includes integer-paise currency formatting helper');
  assert(panelContent.includes('RECONCILED & BALANCED'), 'Includes balanced status indicator (emerald)');
  assert(panelContent.includes('DISCREPANCY DETECTED'), 'Includes discrepancy status indicator (rose/amber)');
  assert(panelContent.includes('Reconciliation Mathematical Bridge'), 'Includes authoritative mathematical reconciliation bridge');

  // ── GROUP 2: Mathematical Bridge Formula Invariants ─────────────────────────
  console.log('\n--- Group 2: Mathematical Bridge Formula Invariants ---');
  assert(panelContent.includes('gl_closing_balance'), 'Displays GL Closing Book Balance (1112/1113)');
  assert(panelContent.includes('unmatched_statement_credits'), 'Displays Unmatched Statement Credits (+)');
  assert(panelContent.includes('unmatched_statement_debits'), 'Displays Unmatched Statement Debits (-)');
  assert(panelContent.includes('adjusted_book_balance'), 'Displays Adjusted Book Balance (=)');
  assert(panelContent.includes('outstanding_disbursements'), 'Displays Outstanding Disbursements (+)');
  assert(panelContent.includes('uncleared_deposits'), 'Displays Uncleared Deposits (-)');
  assert(panelContent.includes('computed_bank_balance'), 'Displays Computed Bank Balance (=)');
  assert(panelContent.includes('statement_closing_balance'), 'Displays Bank Statement Closing Balance');
  assert(panelContent.includes('discrepancy'), 'Displays Net Reconciliation Discrepancy Vector (Δ)');

  // ── GROUP 3: Four Itemized Schedules Tabs & Search ─────────────────────────
  console.log('\n--- Group 3: Four Itemized Schedules Tabs & Search ---');
  assert(panelContent.includes('activeTab === "uncleared"'), 'Contains Uncleared Deposits tab');
  assert(panelContent.includes('activeTab === "outstanding"'), 'Contains Outstanding Disbursements tab');
  assert(panelContent.includes('activeTab === "unmatched"'), 'Contains Unmatched Statement Lines tab');
  assert(panelContent.includes('activeTab === "sessions"'), 'Contains Reconciliation Sessions tab');
  assert(panelContent.includes('searchFilter'), 'Contains search filter for itemized schedules');
  assert(panelContent.includes('lineTypeFilter'), 'Contains line type filter (DEBIT / CREDIT) for statement lines');
  assert(panelContent.includes('sessionStatusFilter'), 'Contains session status filter');
  assert(panelContent.includes('detailModalOpen'), 'Contains session detail drawer/modal');

  // ── GROUP 4: Zero Mutation & Read-Only API Invariant ────────────────────────
  console.log('\n--- Group 4: Zero Mutation & Read-Only API Invariant ---');
  assert(!panelContent.includes('method: "POST"'), 'UI executes zero POST mutations');
  assert(!panelContent.includes('method: "PUT"'), 'UI executes zero PUT mutations');
  assert(!panelContent.includes('method: "DELETE"'), 'UI executes zero DELETE mutations');
  assert(!panelContent.includes('method: "PATCH"'), 'UI executes zero PATCH mutations');
  assert(panelContent.includes('/api/v1/admin/bank-accounts?status=ACTIVE'), 'Fetches active bank accounts');
  assert(panelContent.includes('/api/v1/admin/bank-reconciliation/statements/calculate'), 'Consumes BRS calculate endpoint');
  assert(panelContent.includes('/api/v1/admin/bank-reconciliation/statements/uncleared-deposits'), 'Consumes uncleared deposits endpoint');
  assert(panelContent.includes('/api/v1/admin/bank-reconciliation/statements/outstanding-disbursements'), 'Consumes outstanding disbursements endpoint');
  assert(panelContent.includes('/api/v1/admin/bank-reconciliation/statements/unmatched-lines'), 'Consumes unmatched statement lines endpoint');
  assert(panelContent.includes('/api/v1/admin/bank-reconciliation/sessions'), 'Consumes reconciliation sessions endpoint');

  // ── GROUP 5: Wiring in Navigation & Access Control ─────────────────────────
  console.log('\n--- Group 5: Wiring in Navigation & Access Control ---');
  // staff-access-control.ts
  const staffAccessPath = path.join(frontendRoot, 'src/lib/staff-access-control.ts');
  const staffAccessContent = fs.readFileSync(staffAccessPath, 'utf8');
  assert(
    staffAccessContent.includes('bank_reconciliation: { module: "BANK", action: "RECON_VIEW" }'),
    'staff-access-control.ts maps bank_reconciliation tab to BANK.RECON_VIEW'
  );

  // admin-tabs.tsx
  const adminTabsPath = path.join(frontendRoot, 'src/components/dashboard/admin/admin-tabs.tsx');
  const adminTabsContent = fs.readFileSync(adminTabsPath, 'utf8');
  assert(
    adminTabsContent.includes('{ id: "bank_reconciliation", label: "Bank Reconciliation", icon: Landmark }'),
    'admin-tabs.tsx registers bank_reconciliation in TABS array with Landmark icon'
  );

  // AdminSidebar.tsx
  const sidebarPath = path.join(frontendRoot, 'src/components/admin/AdminSidebar.tsx');
  const sidebarContent = fs.readFileSync(sidebarPath, 'utf8');
  assert(
    sidebarContent.includes('tabId: "bank_reconciliation"'),
    'AdminSidebar.tsx registers bank_reconciliation under Finance & Treasury group'
  );

  // page.tsx
  const pagePath = path.join(frontendRoot, 'src/app/dashboard/page.tsx');
  const pageContent = fs.readFileSync(pagePath, 'utf8');
  assert(
    pageContent.includes('const BankReconciliationPanel = createDynamicPanel'),
    'page.tsx creates lazy-loaded BankReconciliationPanel via createDynamicPanel'
  );
  assert(
    pageContent.includes('"bank_reconciliation"'),
    'page.tsx includes bank_reconciliation in AdminTabId union'
  );
  assert(
    pageContent.includes('bank_reconciliation: BankReconciliationPanel'),
    'page.tsx binds bank_reconciliation to BankReconciliationPanel in PANEL_MAP'
  );

  // ── GROUP 6: StaffAccessControl RBAC Logic Verification ────────────────────
  console.log('\n--- Group 6: StaffAccessControl RBAC Logic Verification ---');
  const { StaffAccessControl } = require(path.join(frontendRoot, 'src/lib/staff-access-control.ts'));
  const superAdmin = { role: 'SUPER_ADMIN', id: 'admin_01' };
  const authorizedStaff = { role: 'STAFF', permissions: ['BANK.RECON_VIEW'] };
  const unauthorizedStaff = { role: 'STAFF', permissions: ['ORDERS.VIEW'] };

  assert(StaffAccessControl.isTabPermitted(superAdmin, 'bank_reconciliation') === true, 'SUPER_ADMIN permitted for bank_reconciliation tab');
  assert(StaffAccessControl.isTabPermitted(authorizedStaff, 'bank_reconciliation') === true, 'Staff with BANK.RECON_VIEW permitted for bank_reconciliation tab');
  assert(StaffAccessControl.isTabPermitted(unauthorizedStaff, 'bank_reconciliation') === false, 'Staff without BANK.RECON_VIEW denied for bank_reconciliation tab');

  // ── GROUP 7: Live PostgreSQL Zero-Mutation Audit ───────────────────────────
  console.log('\n--- Group 7: Live PostgreSQL Zero-Mutation Audit ---');
  const envPath = path.join(frontendRoot, '.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  const match = envContent.match(/DATABASE_URL=["']?([^"'\r\n]+)/);
  const connStr = match ? match[1] : process.env.DATABASE_URL;

  const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const auditRes = await client.query(`
    SELECT
      (SELECT COUNT(*)::int FROM public.accounting_account WHERE deleted_at IS NULL) AS accounting_account,
      (SELECT COUNT(*)::int FROM public.gateway_payout_batch) AS gateway_payout_batch,
      (SELECT COUNT(*)::int FROM public.gateway_settlement_order) AS gateway_settlement_order,
      (SELECT COUNT(*)::int FROM public.bank_account) AS bank_account,
      (SELECT COUNT(*)::int FROM public.bank_deposit_slip) AS bank_deposit_slip,
      (SELECT COUNT(*)::int FROM public.bank_statement_import) AS bank_statement_import,
      (SELECT COUNT(*)::int FROM public.bank_statement_line) AS bank_statement_line,
      (SELECT COUNT(*)::int FROM public.bank_reconciliation_session) AS bank_reconciliation_session,
      (SELECT COUNT(*)::int FROM public.bank_reconciliation_match) AS bank_reconciliation_match,
      (SELECT COUNT(*)::int FROM public.accounting_voucher) AS accounting_voucher,
      (SELECT COUNT(*)::int FROM public.accounting_journal_entry) AS accounting_journal_entry,
      (SELECT COUNT(*)::int FROM public.accounting_journal_line) AS accounting_journal_line,
      (SELECT COUNT(*)::int FROM public."order" WHERE deleted_at IS NULL) AS "order",
      (SELECT COUNT(*)::int FROM public.payment_transaction WHERE deleted_at IS NULL) AS payment_transaction,
      (SELECT COUNT(*)::int FROM public.branch_inventory WHERE deleted_at IS NULL) AS branch_inventory
  `);

  const idleInTx = await client.query("SELECT count(*)::int AS count FROM pg_stat_activity WHERE state = 'idle in transaction'");
  const locks = await client.query("SELECT count(*)::int AS count FROM pg_locks l JOIN pg_class c ON l.relation = c.oid JOIN pg_namespace n ON c.relnamespace = n.oid WHERE n.nspname = 'public' AND l.mode LIKE '%ExclusiveLock'");

  const counts = auditRes.rows[0];
  assert(counts.accounting_account === 99, `Accounting accounts intact (${counts.accounting_account} = 99)`);
  assert(counts.accounting_voucher === 0, `Accounting vouchers zero (${counts.accounting_voucher} = 0)`);
  assert(counts.accounting_journal_entry === 0, `Accounting journal entries zero (${counts.accounting_journal_entry} = 0)`);
  assert(counts.accounting_journal_line === 0, `Accounting journal lines zero (${counts.accounting_journal_line} = 0)`);
  assert(counts.bank_reconciliation_session === 0, `Bank reconciliation sessions zero (${counts.bank_reconciliation_session} = 0)`);
  assert(counts.bank_reconciliation_match === 0, `Bank reconciliation matches zero (${counts.bank_reconciliation_match} = 0)`);
  assert(counts.bank_statement_import === 0, `Bank statement imports zero (${counts.bank_statement_import} = 0)`);
  assert(counts.bank_statement_line === 0, `Bank statement lines zero (${counts.bank_statement_line} = 0)`);
  assert(counts.bank_deposit_slip === 0, `Bank deposit slips zero (${counts.bank_deposit_slip} = 0)`);
  assert(counts.order === 173, `Historical orders untouched (${counts.order} = 173)`);
  assert(counts.payment_transaction === 53, `Prototype payments untouched (${counts.payment_transaction} = 53)`);
  assert(counts.branch_inventory === 424, `Branch inventory untouched (${counts.branch_inventory} = 424)`);
  assert(idleInTx.rows[0].count === 0, `Zero idle in transaction connections (${idleInTx.rows[0].count} = 0)`);
  assert(locks.rows[0].count === 0, `Zero exclusive public schema locks (${locks.rows[0].count} = 0)`);

  await client.end();

  // ── FINAL SUMMARY ──────────────────────────────────────────────────────────
  console.log('\n================================================================');
  console.log(`  STEP 4.10.5-E VERIFICATION COMPLETED: ${passedTests} PASSED / ${failedTests} FAILED`);
  console.log('================================================================');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

run().catch((err) => {
  console.error('Fatal error in Step 4.10.5-E verification:', err);
  process.exit(1);
});
