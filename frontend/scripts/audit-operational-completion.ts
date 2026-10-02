import { dbQuery } from "../src/lib/db";

async function main() {
  console.log("===============================================================");
  console.log("🔍 COMPREHENSIVE OPERATIONAL COMPLETION AUDIT");
  console.log("===============================================================\n");

  // 1. Get all public tables and row counts
  const tablesRes = await dbQuery<{ table_name: string }>(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `);

  console.log(`--- Total Public Tables in PostgreSQL: ${tablesRes.rows.length} ---`);

  const tableCounts: Record<string, number> = {};
  for (const row of tablesRes.rows) {
    try {
      const countRes = await dbQuery<{ count: string }>(
        `SELECT COUNT(*) as count FROM public."${row.table_name}";`
      );
      tableCounts[row.table_name] = parseInt(countRes.rows[0].count, 10);
    } catch (err: any) {
      tableCounts[row.table_name] = -1;
    }
  }

  // Filter and display by domain categories
  const categories: Record<string, string[]> = {
    "1. Orders & Fulfillment": ["order", "order_item", "invoice", "delivery_partner", "delivery_trip", "driver_assignment"],
    "2. Catalog & Products": ["product", "product_variant", "variant_option", "category", "branch"],
    "3. Inventory, Movements & Stock": [
      "inventory_item", "inventory_movement", "stock_level", "stock_transfer", 
      "stock_transfer_item", "stock_adjustment", "inventory_batch", "inventory_location"
    ],
    "4. Procurement & Suppliers": [
      "supplier", "vendor", "purchase_order", "purchase_order_item", 
      "goods_receipt", "grn_receipt", "grn_item", "vendor_bill"
    ],
    "5. Cash on Delivery (COD) & Cash Control": [
      "cod_remittance", "cod_collection", "cash_handover", "cash_deposit", "cash_deposit_slip", "petty_cash"
    ],
    "6. Gateway Settlement & Banking": [
      "settlement_batch", "gateway_settlement", "bank_account", "bank_statement", 
      "bank_statement_line", "bank_reconciliation"
    ],
    "7. Financial Accounting & Ledger": [
      "accounting_account", "accounting_voucher", "journal_entry", "journal_entry_line", 
      "fiscal_period", "ap_subledger", "ar_subledger"
    ],
    "8. Operational Expenses & Payouts": [
      "expense_entry", "operational_expense", "delivery_payout", "staff_salary"
    ],
    "9. Customer, Marketing & Reviews": [
      "customer", "customer_address", "coupon", "coupon_code", "product_review", "custom_cake_request"
    ],
    "10. Communication & Notifications": [
      "notification_log", "whatsapp_log", "whatsapp_message", "communication_log", "audit_log"
    ]
  };

  for (const [catName, tableNames] of Object.entries(categories)) {
    console.log(`\n### ${catName}`);
    for (const name of tableNames) {
      if (name in tableCounts) {
        console.log(`  - [EXISTS] ${name}: ${tableCounts[name]} rows`);
      } else {
        console.log(`  - [MISSING TABLE] ${name}`);
      }
    }
  }

  // Find any tables not in above categories
  const categorizedSet = new Set(Object.values(categories).flat());
  const otherTables = Object.keys(tableCounts).filter(t => !categorizedSet.has(t));
  console.log(`\n### Other Uncategorized Tables (${otherTables.length}):`);
  for (const t of otherTables) {
    console.log(`  - ${t}: ${tableCounts[t]} rows`);
  }

  process.exit(0);
}

main().catch(err => {
  console.error("FATAL AUDIT ERROR:", err);
  process.exit(1);
});
