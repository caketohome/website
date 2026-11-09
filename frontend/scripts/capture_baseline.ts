import { dbQuery } from "../src/lib/db";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("=== CAPTURING POSTGRESQL DATABASE BASELINE ===");

  const queries: Record<string, string> = {
    orders: `SELECT count(*) as count FROM public."order"`,
    invoices: `SELECT count(*) as count FROM public.invoice`,
    vouchers: `SELECT count(*) as count FROM public.accounting_voucher`,
    journal_entries: `SELECT count(*) as count FROM public.accounting_journal_entry`,
    journal_lines: `SELECT count(*) as count FROM public.accounting_journal_line`,
    inventory_movements: `SELECT count(*) as count FROM public.inventory_movement`,
    inventory_lots: `SELECT count(*) as count FROM public.inventory_cost_lot`,
    branch_inventory: `SELECT count(*) as count FROM public.branch_inventory`,
    customers: `SELECT count(*) as count FROM public.customer`,
    products: `SELECT count(*) as count FROM public.product`,
    variants: `SELECT count(*) as count FROM public.product_variant`,
    suppliers: `SELECT count(*) as count FROM public.supplier`,
    fiscal_periods: `SELECT count(*) as count FROM public.accounting_fiscal_period`,
    accounts: `SELECT count(*) as count FROM public.accounting_account`,
    bank_deposit_slips: `SELECT count(*) as count FROM public.bank_deposit_slip`,
    gateway_payout_batches: `SELECT count(*) as count FROM public.gateway_payout_batch`,
    gateway_settlement_orders: `SELECT count(*) as count FROM public.gateway_settlement_order`,
    branches: `SELECT count(*) as count FROM public.branch`,
    purchases: `SELECT count(*) as count FROM public.purchase`,
    expenses: `SELECT count(*) as count FROM public.expense`,
  };

  const baseline: Record<string, any> = {
    timestamp: new Date().toISOString(),
    counts: {},
    totals: {},
  };

  for (const [key, sql] of Object.entries(queries)) {
    try {
      const res = await dbQuery<{ count: string }>(sql);
      const count = parseInt(res.rows[0].count, 10);
      baseline.counts[key] = count;
      console.log(`  ${key.padEnd(26)} : ${count}`);
    } catch (err: any) {
      baseline.counts[key] = `ERROR: ${err.message}`;
      console.error(`  ${key.padEnd(26)} : ERROR ${err.message}`);
    }
  }

  // GL totals check
  try {
    const glRes = await dbQuery<{ total_debit: string; total_credit: string }>(
      `SELECT COALESCE(SUM(debit_amount), 0) as total_debit, COALESCE(SUM(credit_amount), 0) as total_credit FROM public.accounting_journal_line`
    );
    baseline.totals.gl_debit = glRes.rows[0].total_debit;
    baseline.totals.gl_credit = glRes.rows[0].total_credit;
    baseline.totals.gl_balanced = baseline.totals.gl_debit === baseline.totals.gl_credit;
    console.log(`  GL Total Debit: ${baseline.totals.gl_debit}, Total Credit: ${baseline.totals.gl_credit}, Balanced: ${baseline.totals.gl_balanced}`);
  } catch (err: any) {
    console.error("  GL totals error:", err.message);
  }

  const outputPath = path.resolve(process.cwd(), "baseline_db_snapshot.json");
  fs.writeFileSync(outputPath, JSON.stringify(baseline, null, 2));
  console.log(`\nBaseline snapshot written to: ${outputPath}`);

  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal baseline capture error:", err);
  process.exit(1);
});
