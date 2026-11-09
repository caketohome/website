const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function getConnectionString() {
  const envPath = path.join(__dirname, '../.env');
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const l of lines) {
    if (l.trim().startsWith('DATABASE_URL=')) {
      let v = l.trim().substring('DATABASE_URL='.length).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      return v;
    }
  }
}

async function audit() {
  const client = new Client({ connectionString: getConnectionString(), ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('========================================================================');
  console.log('DATABASE SOURCE-OF-TRUTH FORENSIC AUDIT: POSTGRESQL CATALOG INSPECTION');
  console.log('========================================================================\n');

  try {
    // 1. List all tables in public schema and their row counts
    const tablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `;
    const tablesRes = await client.query(tablesQuery);
    console.log(`Discovered ${tablesRes.rowCount} public tables in PostgreSQL.\n`);

    const tableCounts = [];
    for (const row of tablesRes.rows) {
      const t = row.table_name;
      try {
        const countRes = await client.query(`SELECT count(*)::int as cnt FROM public."${t}"`);
        tableCounts.push({ table: t, count: countRes.rows[0].cnt });
      } catch (err) {
        tableCounts.push({ table: t, error: err.message });
      }
    }

    // Group tables by domain
    const domains = {
      'Catalog & PIM': ['product', 'product_variant', 'product_review', 'customer_favorite', 'variant_option', 'offer'],
      'Inventory': ['branch_inventory', 'inventory_movement', 'inventory_cost_lot', 'inventory_cost_consumption', 'inventory_transfer'],
      'Cart & Customer': ['cart', 'cart_item', 'customer', 'customer_address'],
      'Orders & Fulfillment': ['order', 'orders', 'order_item', 'delivery', 'delivery_partner', 'delivery_zone', 'delivery_partner_profile', 'delivery_partner_coverage', 'corporate_delivery_assignment', 'corporate_assignment_event'],
      'Billing & Receivables': ['invoice', 'invoice_item', 'customer_receipt', 'bills_receivable', 'cod_remittance', 'gateway_settlement_order', 'gateway_payout_batch'],
      'Purchasing & Payables': ['supplier', 'purchase', 'purchase_item', 'purchase_payment', 'bills_payable'],
      'Cash & Banking': ['bank_account', 'bank_deposit_slip', 'bank_statement_import', 'bank_statement_line', 'bank_reconciliation_session', 'bank_reconciliation_match', 'teller', 'teller_session', 'teller_movement', 'branch_vault_movement', 'petty_cash_request'],
      'Accounting & General Ledger': ['accounting_account', 'accounting_fiscal_period', 'accounting_voucher', 'accounting_journal_entry', 'accounting_journal_line', 'cost_centre', 'cost_allocation_rule', 'cost_allocation_run', 'expense', 'expense_category'],
      'Corporate & Gifting': ['corporate_account', 'corporate_roster_employee', 'corporate_gifting_batch', 'corporate_gifting_recipient', 'corporate_gifting_campaign'],
      'System & CMS': ['branch', 'city', 'state', 'setting', 'cms_page', 'cms_homepage_section', 'popup_campaigns', 'popup_versions', 'seo_metadata']
    };

    const categorized = new Set();
    for (const [dom, tbls] of Object.entries(domains)) {
      console.log(`\n── ${dom} ──`);
      for (const t of tbls) {
        const found = tableCounts.find(tc => tc.table === t);
        if (found) {
          categorized.add(t);
          console.log(`  • ${t.padEnd(35)} : ${found.count !== undefined ? found.count + ' rows' : 'ERR: ' + found.error}`);
        } else {
          console.log(`  • ${t.padEnd(35)} : [TABLE NOT FOUND IN POSTGRESQL]`);
        }
      }
    }

    const uncategorized = tableCounts.filter(tc => !categorized.has(tc.table));
    if (uncategorized.length > 0) {
      console.log(`\n── Other / Uncategorized Tables (${uncategorized.length}) ──`);
      uncategorized.forEach(u => {
        console.log(`  • ${u.table.padEnd(35)} : ${u.count !== undefined ? u.count + ' rows' : 'ERR: ' + u.error}`);
      });
    }

  } finally {
    await client.end();
  }
}

audit().catch(console.error);
