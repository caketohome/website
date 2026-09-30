/**
 * Phase 5A.3 — P&L Forensic Audit
 * Discovery only — no mutations, no implementation.
 *
 * Examines:
 * 1. Revenue accounts (type REVENUE) — codes, subtypes, hierarchy
 * 2. Expense accounts (type EXPENSE) — codes, subtypes, hierarchy
 * 3. COGS accounts — specific codes 5110-5130
 * 4. Other Income/Expense accounts
 * 5. Tax-related expense/liability accounts
 * 6. Account hierarchy (groups vs leaves, levels)
 * 7. Opening balance treatment for P&L accounts
 * 8. Journal/voucher state (how many posted vs draft/reversed)
 * 9. Branch distribution in accounting data
 * 10. Existing SQL/service functions that could be reused
 * 11. Trial Balance structure (reconciliation baseline)
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const projectRoot = path.resolve(__dirname, '..');
const envContent = fs.readFileSync(path.join(projectRoot, '.env'), 'utf8');
let connStr = '';
for (const line of envContent.split('\n')) {
  if (line.startsWith('DATABASE_URL=')) {
    connStr = line.substring('DATABASE_URL='.length).trim().replace(/^['"]|['"]$/g, '');
  }
}

(async () => {
  const db = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
  await db.connect();

  console.log('══════════════════════════════════════════════════════════════════');
  console.log('Phase 5A.3 — Profit & Loss Statement — Forensic Audit');
  console.log('══════════════════════════════════════════════════════════════════\n');

  // 1. REVENUE accounts
  console.log('═══ 1. REVENUE Accounts ═══');
  const rev = await db.query(`
    SELECT code, name, type, subtype, is_group, level, parent_id, is_active
    FROM public.accounting_account
    WHERE type = 'REVENUE' AND deleted_at IS NULL
    ORDER BY code
  `);
  console.table(rev.rows);

  // 2. EXPENSE accounts
  console.log('\n═══ 2. EXPENSE Accounts ═══');
  const exp = await db.query(`
    SELECT code, name, type, subtype, is_group, level, parent_id, is_active
    FROM public.accounting_account
    WHERE type = 'EXPENSE' AND deleted_at IS NULL
    ORDER BY code
  `);
  console.table(exp.rows);

  // 3. COGS-specific accounts
  console.log('\n═══ 3. COGS Accounts (5110-5130) ═══');
  const cogs = await db.query(`
    SELECT code, name, type, subtype, is_group, level
    FROM public.accounting_account
    WHERE code IN ('5100', '5110', '5120', '5130') AND deleted_at IS NULL
    ORDER BY code
  `);
  console.table(cogs.rows);

  // 4. Full account type distribution
  console.log('\n═══ 4. Account Type Distribution ═══');
  const typeDist = await db.query(`
    SELECT type, subtype, is_group, count(*)::int AS cnt
    FROM public.accounting_account
    WHERE deleted_at IS NULL
    GROUP BY type, subtype, is_group
    ORDER BY type, subtype, is_group
  `);
  console.table(typeDist.rows);

  // 5. Account hierarchy (parent-child structure for P&L accounts)
  console.log('\n═══ 5. REVENUE + EXPENSE Hierarchy (parent → children) ═══');
  const hierarchy = await db.query(`
    SELECT a.code AS parent_code, a.name AS parent_name, a.type, a.is_group,
           c.code AS child_code, c.name AS child_name, c.is_group AS child_is_group, c.level AS child_level
    FROM public.accounting_account a
    LEFT JOIN public.accounting_account c ON c.parent_id = a.id AND c.deleted_at IS NULL
    WHERE a.type IN ('REVENUE', 'EXPENSE') AND a.deleted_at IS NULL AND a.is_group = true
    ORDER BY a.code, c.code
  `);
  console.table(hierarchy.rows);

  // 6. Current journal/voucher state
  console.log('\n═══ 6. Current Journal/Voucher State ═══');
  const voucherState = await db.query(`
    SELECT
      (SELECT count(*)::int FROM public.accounting_voucher WHERE deleted_at IS NULL) AS total_vouchers,
      (SELECT count(*)::int FROM public.accounting_voucher WHERE status = 'POSTED' AND deleted_at IS NULL) AS posted_vouchers,
      (SELECT count(*)::int FROM public.accounting_voucher WHERE status = 'DRAFT' AND deleted_at IS NULL) AS draft_vouchers,
      (SELECT count(*)::int FROM public.accounting_journal_entry) AS total_journal_entries,
      (SELECT count(*)::int FROM public.accounting_journal_entry WHERE is_reversed = true) AS reversed_journal_entries,
      (SELECT count(*)::int FROM public.accounting_journal_line) AS total_journal_lines
  `);
  console.table(voucherState.rows);

  // 7. Opening balance voucher type check
  console.log('\n═══ 7. Opening Balance Vouchers ═══');
  const obVouchers = await db.query(`
    SELECT count(*)::int AS cnt FROM public.accounting_voucher
    WHERE voucher_type = 'OPENING_BALANCE' AND deleted_at IS NULL
  `);
  console.log('Opening Balance vouchers:', obVouchers.rows[0].cnt);

  // 8. Fiscal period state
  console.log('\n═══ 8. Fiscal Period State ═══');
  const fpState = await db.query(`
    SELECT count(*)::int AS cnt FROM public.accounting_fiscal_period
  `);
  console.log('Fiscal periods:', fpState.rows[0].cnt);

  // 9. Accounting start date
  console.log('\n═══ 9. Accounting Start Date ═══');
  const asd = await db.query(`
    SELECT key, value FROM public.setting WHERE key = 'accounting_start_date' AND deleted_at IS NULL
  `);
  console.log('Setting rows:', asd.rows.length, asd.rows);

  // 10. Branch count
  console.log('\n═══ 10. Branch Distribution ═══');
  const branches = await db.query(`
    SELECT count(*)::int AS cnt FROM public.branch WHERE deleted_at IS NULL
  `);
  console.log('Active branches:', branches.rows[0].cnt);

  // 11. Trial Balance SQL structure check
  console.log('\n═══ 11. Existing Service Methods (file scan) ═══');
  const glServicePath = path.join(projectRoot, 'src/lib/services/general-ledger.service.ts');
  if (fs.existsSync(glServicePath)) {
    const glContent = fs.readFileSync(glServicePath, 'utf8');
    const methods = glContent.match(/static async \w+/g);
    console.log('GeneralLedgerService methods:', methods);
  }

  const journalRepoPath = path.join(projectRoot, 'src/lib/repositories/accounting-journal.repository.ts');
  if (fs.existsSync(journalRepoPath)) {
    const jrContent = fs.readFileSync(journalRepoPath, 'utf8');
    const methods = jrContent.match(/static async \w+/g);
    console.log('AccountingJournalRepository methods:', methods);
  }

  // 12. Existing VoucherType union
  console.log('\n═══ 12. VoucherType Union ═══');
  const typesPath = path.join(projectRoot, 'src/lib/types/accounting.types.ts');
  if (fs.existsSync(typesPath)) {
    const typesContent = fs.readFileSync(typesPath, 'utf8');
    const vtMatch = typesContent.match(/export type VoucherType\s*=\s*[^;]+;/);
    console.log(vtMatch ? vtMatch[0] : 'VoucherType not found');
  }

  // 13. Check for any existing P&L-related code
  console.log('\n═══ 13. Existing P&L References ═══');
  const srcDir = path.join(projectRoot, 'src');
  function searchFiles(dir, pattern) {
    const results = [];
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          results.push(...searchFiles(fullPath, pattern));
        } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
          const content = fs.readFileSync(fullPath, 'utf8');
          if (pattern.test(content)) {
            results.push({ file: fullPath.replace(projectRoot, ''), matches: content.match(pattern)?.length || 0 });
          }
        }
      }
    } catch (e) {}
    return results;
  }
  const plRefs = searchFiles(srcDir, /profit.and.loss|income.statement|P&L|profit_loss|profitLoss/gi);
  console.log('P&L references found:', plRefs.length ? plRefs : 'NONE');

  await db.end();
  console.log('\n══════════════════════════════════════════════════════════════════');
  console.log('Forensic audit complete. No mutations performed.');
  console.log('══════════════════════════════════════════════════════════════════');
})();
