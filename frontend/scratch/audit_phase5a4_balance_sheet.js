/**
 * Phase 5A.4 — Balance Sheet Forensic Audit
 * Discovery only — strictly read-only, no mutations.
 *
 * Examines:
 * 1. All ASSET accounts (hierarchy, subtypes, levels, is_group, normal balance)
 * 2. All LIABILITY accounts (hierarchy, subtypes, levels, is_group, normal balance)
 * 3. All EQUITY accounts (hierarchy, subtypes, levels, is_group, normal balance)
 * 4. Specifically: 3300 Opening Balance Equity and any Retained Earnings accounts (code, subtype, hierarchy)
 * 5. Current vs Non-Current classification across Assets & Liabilities
 * 6. Contra accounts (accumulated depreciation, allowance, sales returns/purchase discounts or any BS contras)
 * 7. Control accounts: AR (1121, 1122), AP (2111), Inventory (1131, 1132, 1133), GST Input (1141-1149), GST Output (2121-2129)
 * 8. Cash & Bank & Clearing & Transit accounts (1111, 1112, 1113, 1118)
 * 9. Fixed Assets & Depreciation accounts (1500-1599, 5330, etc.)
 * 10. Existing fiscal periods and settings (accounting_start_date)
 * 11. Existing vouchers, journals, lines count (verify zero/clean baseline)
 * 12. Total accounts count and breakdown by type
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
  console.log('Phase 5A.4 — Balance Sheet — Comprehensive Forensic Audit');
  console.log('══════════════════════════════════════════════════════════════════\n');

  // Total accounts breakdown by type
  const typeCounts = await db.query(`
    SELECT type, count(*) as total, 
           count(*) FILTER (WHERE is_group = true) as groups,
           count(*) FILTER (WHERE is_group = false) as leaves
    FROM public.accounting_account
    WHERE deleted_at IS NULL
    GROUP BY type
    ORDER BY type;
  `);
  console.log('═══ 1. Total Accounts by Type ═══');
  console.table(typeCounts.rows);

  // All ASSET accounts with full hierarchy
  console.log('\n═══ 2. All ASSET Accounts ═══');
  const assets = await db.query(`
    SELECT a.id, a.code, a.name, a.type, a.subtype, a.is_group, a.level, a.parent_id,
           p.code as parent_code, p.name as parent_name
    FROM public.accounting_account a
    LEFT JOIN public.accounting_account p ON a.parent_id = p.id
    WHERE a.type = 'ASSET' AND a.deleted_at IS NULL
    ORDER BY a.code;
  `);
  console.table(assets.rows.map(r => ({
    code: r.code,
    name: r.name,
    subtype: r.subtype,
    grp: r.is_group,
    lvl: r.level,
    parent: r.parent_code ? `${r.parent_code} (${r.parent_name})` : 'ROOT'
  })));

  // All LIABILITY accounts with full hierarchy
  console.log('\n═══ 3. All LIABILITY Accounts ═══');
  const liabilities = await db.query(`
    SELECT a.id, a.code, a.name, a.type, a.subtype, a.is_group, a.level, a.parent_id,
           p.code as parent_code, p.name as parent_name
    FROM public.accounting_account a
    LEFT JOIN public.accounting_account p ON a.parent_id = p.id
    WHERE a.type = 'LIABILITY' AND a.deleted_at IS NULL
    ORDER BY a.code;
  `);
  console.table(liabilities.rows.map(r => ({
    code: r.code,
    name: r.name,
    subtype: r.subtype,
    grp: r.is_group,
    lvl: r.level,
    parent: r.parent_code ? `${r.parent_code} (${r.parent_name})` : 'ROOT'
  })));

  // All EQUITY accounts with full hierarchy
  console.log('\n═══ 4. All EQUITY Accounts ═══');
  const equity = await db.query(`
    SELECT a.id, a.code, a.name, a.type, a.subtype, a.is_group, a.level, a.parent_id,
           p.code as parent_code, p.name as parent_name
    FROM public.accounting_account a
    LEFT JOIN public.accounting_account p ON a.parent_id = p.id
    WHERE a.type = 'EQUITY' AND a.deleted_at IS NULL
    ORDER BY a.code;
  `);
  console.table(equity.rows.map(r => ({
    code: r.code,
    name: r.name,
    subtype: r.subtype,
    grp: r.is_group,
    lvl: r.level,
    parent: r.parent_code ? `${r.parent_code} (${r.parent_name})` : 'ROOT'
  })));

  // Specific look at Retained Earnings or Profit accounts across ALL types
  console.log('\n═══ 5. Search for Retained Earnings, Profit, Loss, Equity accounts ═══');
  const searchEquity = await db.query(`
    SELECT code, name, type, subtype, is_group, level, parent_id
    FROM public.accounting_account
    WHERE (name ILIKE '%retained%' OR name ILIKE '%profit%' OR name ILIKE '%loss%' OR name ILIKE '%equity%' OR name ILIKE '%capital%' OR name ILIKE '%reserve%')
      AND deleted_at IS NULL
    ORDER BY code;
  `);
  console.table(searchEquity.rows);

  // Search for Contra accounts across CoA
  console.log('\n═══ 6. Search for Contra / Allowance / Depreciation accounts ═══');
  const searchContra = await db.query(`
    SELECT code, name, type, subtype, is_group, level, parent_id
    FROM public.accounting_account
    WHERE (name ILIKE '%depreciation%' OR name ILIKE '%contra%' OR name ILIKE '%allowance%' OR name ILIKE '%accumulated%')
      AND deleted_at IS NULL
    ORDER BY code;
  `);
  console.table(searchContra.rows);

  // Cash / Bank / Transit / Gateway accounts
  console.log('\n═══ 7. Cash, Bank, Gateway, Clearing, Transit accounts ═══');
  const cashBank = await db.query(`
    SELECT code, name, type, subtype, is_group, level
    FROM public.accounting_account
    WHERE code LIKE '111%' AND deleted_at IS NULL
    ORDER BY code;
  `);
  console.table(cashBank.rows);

  // Receivables & Control accounts
  console.log('\n═══ 8. Receivables (AR) accounts ═══');
  const ar = await db.query(`
    SELECT code, name, type, subtype, is_group, level
    FROM public.accounting_account
    WHERE code LIKE '112%' AND deleted_at IS NULL
    ORDER BY code;
  `);
  console.table(ar.rows);

  // Inventory accounts
  console.log('\n═══ 9. Inventory accounts ═══');
  const inv = await db.query(`
    SELECT code, name, type, subtype, is_group, level
    FROM public.accounting_account
    WHERE code LIKE '113%' AND deleted_at IS NULL
    ORDER BY code;
  `);
  console.table(inv.rows);

  // GST Input (Asset) vs GST Output (Liability) accounts
  console.log('\n═══ 10. GST Input (114x) and Output (212x) accounts ═══');
  const gst = await db.query(`
    SELECT code, name, type, subtype, is_group, level
    FROM public.accounting_account
    WHERE (code LIKE '114%' OR code LIKE '212%') AND deleted_at IS NULL
    ORDER BY code;
  `);
  console.table(gst.rows);

  // Fixed Assets accounts (15xx or similar)
  console.log('\n═══ 11. Fixed Asset / Non-Current Asset accounts ═══');
  const fixedAssets = await db.query(`
    SELECT code, name, type, subtype, is_group, level
    FROM public.accounting_account
    WHERE type = 'ASSET' AND code NOT LIKE '11%' AND deleted_at IS NULL
    ORDER BY code;
  `);
  console.table(fixedAssets.rows);

  // Payables & Current Liabilities
  console.log('\n═══ 12. Payables (211x) and Other Liabilities ═══');
  const payables = await db.query(`
    SELECT code, name, type, subtype, is_group, level
    FROM public.accounting_account
    WHERE type = 'LIABILITY' AND deleted_at IS NULL
    ORDER BY code;
  `);
  console.table(payables.rows);

  // Baseline data state
  console.log('\n═══ 13. Baseline Data State ═══');
  const [vouchers, journals, lines, periods, settings, branches] = await Promise.all([
    db.query(`SELECT count(*) as count FROM public.accounting_voucher`),
    db.query(`SELECT count(*) as count FROM public.accounting_journal_entry`),
    db.query(`SELECT count(*) as count FROM public.accounting_journal_line`),
    db.query(`SELECT count(*) as count FROM public.accounting_fiscal_period`),
    db.query(`SELECT count(*) as count FROM public.setting WHERE key LIKE '%accounting%'`),
    db.query(`SELECT id, name, code FROM public.branch ORDER BY name`)
  ]);
  console.log({
    vouchers: vouchers.rows[0].count,
    journals: journals.rows[0].count,
    lines: lines.rows[0].count,
    periods: periods.rows[0].count,
    accounting_settings: settings.rows[0].count,
    branches: branches.rows
  });

  await db.end();
})();
