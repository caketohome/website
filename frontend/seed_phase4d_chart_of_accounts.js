/**
 * CakeToHome ERP — Phase 4D: Chart of Accounts Seeding
 * Seeds the authoritative 98 accounts designed in Phase 4C.
 *
 * SAFETY INVARIANTS:
 * - Deterministic topological insertion (Level 1 -> Level 2 -> Level 3 -> Level 4)
 * - Safe transaction with ROLLBACK on any error
 * - Idempotent upsert via ON CONFLICT (code)
 * - Zero mutation of historical orders (173), payment transactions (53), vouchers (0)
 * - Accounting start date remains unconfigured
 * - Zero credentials hardcoded or printed
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('./node_modules/pg');

function getConnectionString() {
  if (process.env.PG_URL) return process.env.PG_URL;
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPath = path.join(__dirname, '../backend/.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    if (line.startsWith('DATABASE_URL=')) return line.substring('DATABASE_URL='.length).trim();
  }
  throw new Error("No database connection string found in environment or backend/.env");
}

const AUTHORITATIVE_ACCOUNTS = [
  // ── 1000 ASSETS ─────────────────────────────────────────────────────────────
  { code: '1000', name: 'Assets', type: 'ASSET', subtype: 'CURRENT_ASSET', parent: null, level: 1, is_group: true, description: 'Top-level Asset Group' },
  { code: '1100', name: 'Current Assets', type: 'ASSET', subtype: 'CURRENT_ASSET', parent: '1000', level: 2, is_group: true, description: 'Current Assets Summary' },
  { code: '1110', name: 'Cash and Cash Equivalents', type: 'ASSET', subtype: 'CURRENT_ASSET', parent: '1100', level: 3, is_group: true, description: 'Liquid Funds Group' },
  { code: '1111', name: 'Cash in Hand', type: 'ASSET', subtype: 'CASH', parent: '1110', level: 4, is_group: false, description: 'Physical cash drawers at retail branches [Branch Dimension]' },
  { code: '1112', name: 'Bank Operating A/c', type: 'ASSET', subtype: 'BANK', parent: '1110', level: 4, is_group: false, description: 'Primary current bank account for settlements & vendor payments' },
  { code: '1113', name: 'Gateway Clearing', type: 'ASSET', subtype: 'GATEWAY_CLEARING', parent: '1110', level: 4, is_group: false, description: 'Online payment gateway transit clearing account' },
  { code: '1114', name: 'Petty Cash - Branches', type: 'ASSET', subtype: 'CASH', parent: '1110', level: 4, is_group: false, description: 'Branch manager petty cash imprest floats [Branch Dimension]' },
  { code: '1119', name: 'Unclassified Suspense', type: 'ASSET', subtype: 'CURRENT_ASSET', parent: '1110', level: 4, is_group: false, description: 'Temporary unallocated receipts awaiting reconciliation' },
  { code: '1120', name: 'Receivables and Advances', type: 'ASSET', subtype: 'CURRENT_ASSET', parent: '1100', level: 3, is_group: true, description: 'Debtors and short-term receivables group' },
  { code: '1121', name: 'Accounts Receivable', type: 'ASSET', subtype: 'RECEIVABLE', parent: '1120', level: 4, is_group: false, description: 'Trade debtors control ledger [Customer Dimension Required]' },
  { code: '1122', name: 'Undeposited COD', type: 'ASSET', subtype: 'CURRENT_ASSET', parent: '1120', level: 4, is_group: false, description: 'Cash collected by delivery fleet pending branch cash-in' },
  { code: '1123', name: 'Staff Advances', type: 'ASSET', subtype: 'CURRENT_ASSET', parent: '1120', level: 4, is_group: false, description: 'Short-term salary advances to kitchen/delivery staff' },
  { code: '1124', name: 'Security Deposits - Leases', type: 'ASSET', subtype: 'CURRENT_ASSET', parent: '1120', level: 4, is_group: false, description: 'Rental security deposits for cloud kitchens & retail outlets' },
  { code: '1130', name: 'Inventories', type: 'ASSET', subtype: 'CURRENT_ASSET', parent: '1100', level: 3, is_group: true, description: 'Stock and physical inventory group' },
  { code: '1131', name: 'Merchandise Inventory - Accessories', type: 'ASSET', subtype: 'INVENTORY', parent: '1130', level: 4, is_group: false, description: 'Physical quantity-controlled party accessories (candles, toppers)' },
  { code: '1132', name: 'Merchandise Inventory - Cakes', type: 'ASSET', subtype: 'INVENTORY', parent: '1130', level: 4, is_group: false, description: 'Authoritative balance sheet asset account for physically held cake merchandise purchased from commercial bakeries for resale.' },
  { code: '1133', name: 'Packaging Supplies Stock', type: 'ASSET', subtype: 'INVENTORY', parent: '1130', level: 4, is_group: false, description: 'Unused cake boxes, ribbons, boards, cutlery bags' },
  { code: '1140', name: 'Duties & Taxes - Input Tax Credit', type: 'ASSET', subtype: 'CURRENT_ASSET', parent: '1100', level: 3, is_group: true, description: 'GST Input Tax Credits (ITC) summary group' },
  { code: '1141', name: 'Input CGST 2.5% (Food/Bakery)', type: 'ASSET', subtype: 'INPUT_TAX', parent: '1140', level: 4, is_group: false, tax_rate: 2.5, tax_class: 'GST_FOOD_5', description: 'Intrastate CGST credit on 5% food/bakery purchases (2.5%)' },
  { code: '1142', name: 'Input SGST 2.5% (Food/Bakery)', type: 'ASSET', subtype: 'INPUT_TAX', parent: '1140', level: 4, is_group: false, tax_rate: 2.5, tax_class: 'GST_FOOD_5', description: 'Intrastate SGST credit on 5% food/bakery purchases (2.5%)' },
  { code: '1143', name: 'Input CGST 9.0% (Accessories/General)', type: 'ASSET', subtype: 'INPUT_TAX', parent: '1140', level: 4, is_group: false, tax_rate: 9.0, tax_class: 'GST_STANDARD_18', description: 'Intrastate CGST credit on 18% accessories/services (9.0%)' },
  { code: '1144', name: 'Input SGST 9.0% (Accessories/General)', type: 'ASSET', subtype: 'INPUT_TAX', parent: '1140', level: 4, is_group: false, tax_rate: 9.0, tax_class: 'GST_STANDARD_18', description: 'Intrastate SGST credit on 18% accessories/services (9.0%)' },
  { code: '1145', name: 'Input IGST 5.0% (Interstate Food)', type: 'ASSET', subtype: 'INPUT_TAX', parent: '1140', level: 4, is_group: false, tax_rate: 5.0, tax_class: 'GST_FOOD_5', description: 'Interstate IGST credit on 5% food/bakery purchases (5.0%)' },
  { code: '1146', name: 'Input IGST 18.0% (Interstate Accessories)', type: 'ASSET', subtype: 'INPUT_TAX', parent: '1140', level: 4, is_group: false, tax_rate: 18.0, tax_class: 'GST_STANDARD_18', description: 'Interstate IGST credit on 18% accessories/freight/services (18.0%)' },
  { code: '1147', name: 'Input CGST 6.0% (Toys/Novelties)', type: 'ASSET', subtype: 'INPUT_TAX', parent: '1140', level: 4, is_group: false, tax_rate: 6.0, tax_class: 'GST_TOYS_12', description: 'Intrastate CGST credit on 12% novelty/toy purchases (6.0%)' },
  { code: '1148', name: 'Input SGST 6.0% (Toys/Novelties)', type: 'ASSET', subtype: 'INPUT_TAX', parent: '1140', level: 4, is_group: false, tax_rate: 6.0, tax_class: 'GST_TOYS_12', description: 'Intrastate SGST credit on 12% novelty/toy purchases (6.0%)' },
  { code: '1149', name: 'Input IGST 12.0% (Interstate Toys)', type: 'ASSET', subtype: 'INPUT_TAX', parent: '1140', level: 4, is_group: false, tax_rate: 12.0, tax_class: 'GST_TOYS_12', description: 'Interstate IGST credit on 12% novelty/toy purchases (12.0%)' },
  { code: '1500', name: 'Fixed Assets (PP&E)', type: 'ASSET', subtype: 'FIXED_ASSET', parent: '1000', level: 2, is_group: true, description: 'Property, Plant and Equipment summary group' },
  { code: '1510', name: 'Bakery & Kitchen Equipment', type: 'ASSET', subtype: 'FIXED_ASSET', parent: '1500', level: 3, is_group: false, description: 'Commercial deck ovens, planetary mixers, blast freezers' },
  { code: '1520', name: 'Delivery Vehicles & Fleet', type: 'ASSET', subtype: 'FIXED_ASSET', parent: '1500', level: 3, is_group: false, description: 'Delivery vans and temperature-controlled two-wheelers' },
  { code: '1530', name: 'Computers & POS Hardware', type: 'ASSET', subtype: 'FIXED_ASSET', parent: '1500', level: 3, is_group: false, description: 'Thermal bill printers, tablets, kitchen display units' },
  { code: '1540', name: 'Furniture & Fixtures', type: 'ASSET', subtype: 'FIXED_ASSET', parent: '1500', level: 3, is_group: false, description: 'Retail display chillers, customer counters, kitchen stainless steel tables' },
  { code: '1590', name: 'Accumulated Depreciation', type: 'ASSET', subtype: 'FIXED_ASSET', parent: '1500', level: 3, is_group: false, description: 'Cumulative depreciation contra-asset account' },

  // ── 2000 LIABILITIES ────────────────────────────────────────────────────────
  { code: '2000', name: 'Liabilities', type: 'LIABILITY', subtype: 'CURRENT_LIABILITY', parent: null, level: 1, is_group: true, description: 'Top-level Liability Group' },
  { code: '2100', name: 'Current Liabilities', type: 'LIABILITY', subtype: 'CURRENT_LIABILITY', parent: '2000', level: 2, is_group: true, description: 'Current Obligations Group' },
  { code: '2110', name: 'Trade Payables', type: 'LIABILITY', subtype: 'CURRENT_LIABILITY', parent: '2100', level: 3, is_group: true, description: 'Creditors and trade payables group' },
  { code: '2111', name: 'Accounts Payable', type: 'LIABILITY', subtype: 'PAYABLE', parent: '2110', level: 4, is_group: false, description: 'Trade payables control ledger [Supplier Dimension Required]' },
  { code: '2120', name: 'Duties & Taxes - Output Tax Liability', type: 'LIABILITY', subtype: 'CURRENT_LIABILITY', parent: '2100', level: 3, is_group: true, description: 'GST Output tax liability summary group' },
  { code: '2121', name: 'Output CGST 2.5% (Food/Bakery)', type: 'LIABILITY', subtype: 'OUTPUT_TAX', parent: '2120', level: 4, is_group: false, tax_rate: 2.5, tax_class: 'GST_FOOD_5', description: 'Intrastate CGST collected on 5% bakery sales (2.5%)' },
  { code: '2122', name: 'Output SGST 2.5% (Food/Bakery)', type: 'LIABILITY', subtype: 'OUTPUT_TAX', parent: '2120', level: 4, is_group: false, tax_rate: 2.5, tax_class: 'GST_FOOD_5', description: 'Intrastate SGST collected on 5% bakery sales (2.5%)' },
  { code: '2123', name: 'Output CGST 9.0% (Accessories)', type: 'LIABILITY', subtype: 'OUTPUT_TAX', parent: '2120', level: 4, is_group: false, tax_rate: 9.0, tax_class: 'GST_STANDARD_18', description: 'Intrastate CGST collected on 18% accessory sales (9.0%)' },
  { code: '2124', name: 'Output SGST 9.0% (Accessories)', type: 'LIABILITY', subtype: 'OUTPUT_TAX', parent: '2120', level: 4, is_group: false, tax_rate: 9.0, tax_class: 'GST_STANDARD_18', description: 'Intrastate SGST collected on 18% accessory sales (9.0%)' },
  { code: '2125', name: 'Output IGST 5.0% (Interstate Food)', type: 'LIABILITY', subtype: 'OUTPUT_TAX', parent: '2120', level: 4, is_group: false, tax_rate: 5.0, tax_class: 'GST_FOOD_5', description: 'Interstate IGST collected on 5% bakery orders (5.0%)' },
  { code: '2126', name: 'Output IGST 18.0% (Interstate Accessories)', type: 'LIABILITY', subtype: 'OUTPUT_TAX', parent: '2120', level: 4, is_group: false, tax_rate: 18.0, tax_class: 'GST_STANDARD_18', description: 'Interstate IGST collected on 18% accessory orders (18.0%)' },
  { code: '2127', name: 'Output CGST 6.0% (Toys)', type: 'LIABILITY', subtype: 'OUTPUT_TAX', parent: '2120', level: 4, is_group: false, tax_rate: 6.0, tax_class: 'GST_TOYS_12', description: 'Intrastate CGST collected on 12% novelty sales (6.0%)' },
  { code: '2128', name: 'Output SGST 6.0% (Toys)', type: 'LIABILITY', subtype: 'OUTPUT_TAX', parent: '2120', level: 4, is_group: false, tax_rate: 6.0, tax_class: 'GST_TOYS_12', description: 'Intrastate SGST collected on 12% novelty sales (6.0%)' },
  { code: '2129', name: 'Output IGST 12.0% (Interstate Toys)', type: 'LIABILITY', subtype: 'OUTPUT_TAX', parent: '2120', level: 4, is_group: false, tax_rate: 12.0, tax_class: 'GST_TOYS_12', description: 'Interstate IGST collected on 12% novelty orders (12.0%)' },
  { code: '2130', name: 'TDS Payable', type: 'LIABILITY', subtype: 'CURRENT_LIABILITY', parent: '2100', level: 3, is_group: false, description: 'Tax Deducted at Source payable to government' },
  { code: '2140', name: 'Advances & Unearned Revenue', type: 'LIABILITY', subtype: 'CURRENT_LIABILITY', parent: '2100', level: 3, is_group: true, description: 'Customer advance bookings and stored value' },
  { code: '2141', name: 'Customer Advances', type: 'LIABILITY', subtype: 'CUSTOMER_ADVANCE', parent: '2140', level: 4, is_group: false, description: 'Prepaid customer cake deposits [Customer Dimension Required]' },
  { code: '2142', name: 'Gift Card / Wallet Liabilities', type: 'LIABILITY', subtype: 'CURRENT_LIABILITY', parent: '2140', level: 4, is_group: false, description: 'Store wallet balances and unredeemed gift cards' },
  { code: '2150', name: 'Operating Accruals & Staff Payables', type: 'LIABILITY', subtype: 'CURRENT_LIABILITY', parent: '2100', level: 3, is_group: true, description: 'Accrued expenses and payroll obligations' },
  { code: '2151', name: 'Salaries & Wages Payable', type: 'LIABILITY', subtype: 'STAFF_PAYABLE', parent: '2150', level: 4, is_group: false, description: 'Monthly unpaid salaries for bakery chefs and riders' },
  { code: '2152', name: 'Rent Payable', type: 'LIABILITY', subtype: 'CURRENT_LIABILITY', parent: '2150', level: 4, is_group: false, description: 'Accrued shop and central kitchen lease obligations' },
  { code: '2153', name: 'Accrued Operating Expenses', type: 'LIABILITY', subtype: 'CURRENT_LIABILITY', parent: '2150', level: 4, is_group: false, description: 'Accrued power, broadband, water, and vendor dues' },
  { code: '2500', name: 'Long-Term Liabilities', type: 'LIABILITY', subtype: 'LONG_TERM_LIABILITY', parent: '2000', level: 2, is_group: true, description: 'Term loans and non-current liabilities group' },
  { code: '2510', name: 'Bank Loans & Borrowings', type: 'LIABILITY', subtype: 'LONG_TERM_LIABILITY', parent: '2500', level: 3, is_group: false, description: 'Secured term loans and kitchen equipment financing' },

  // ── 3000 EQUITY ─────────────────────────────────────────────────────────────
  { code: '3000', name: 'Equity', type: 'EQUITY', subtype: 'CAPITAL', parent: null, level: 1, is_group: true, description: 'Top-level Equity Group' },
  { code: '3100', name: 'Capital & Reserves', type: 'EQUITY', subtype: 'CAPITAL', parent: '3000', level: 2, is_group: true, description: 'Owners equity group' },
  { code: '3110', name: 'Partner / Shareholder Capital', type: 'EQUITY', subtype: 'CAPITAL', parent: '3100', level: 3, is_group: false, description: 'Primary invested capital of founders/partners' },
  { code: '3120', name: 'Drawings / Distributions', type: 'EQUITY', subtype: 'CAPITAL', parent: '3100', level: 3, is_group: false, description: 'Partner capital withdrawals and dividends' },
  { code: '3200', name: 'Retained Earnings Group', type: 'EQUITY', subtype: 'RETAINED_EARNINGS', parent: '3000', level: 2, is_group: true, description: 'Cumulative retained earnings group' },
  { code: '3210', name: 'Retained Earnings (Prior Years)', type: 'EQUITY', subtype: 'RETAINED_EARNINGS', parent: '3200', level: 3, is_group: false, description: 'Accumulated profits from prior completed fiscal years' },
  { code: '3220', name: 'Current Year Net Earnings', type: 'EQUITY', subtype: 'RETAINED_EARNINGS', parent: '3200', level: 3, is_group: false, description: 'Current fiscal year P&L net income roll-up' },
  { code: '3300', name: 'Opening Balance Offset / Capital Reserve', type: 'EQUITY', subtype: 'OPENING_OFFSET', parent: '3000', level: 2, is_group: false, description: 'Balancing equity offset account for official opening cut-off' },

  // ── 4000 REVENUE ────────────────────────────────────────────────────────────
  { code: '4000', name: 'Revenue', type: 'REVENUE', subtype: 'DIRECT_REVENUE', parent: null, level: 1, is_group: true, description: 'Root Revenue Group' },
  { code: '4100', name: 'Operating Revenue', type: 'REVENUE', subtype: 'DIRECT_REVENUE', parent: '4000', level: 2, is_group: true, description: 'Sales and delivery revenue group' },
  { code: '4110', name: 'Cake & Bakery Sales Revenue (5% GST)', type: 'REVENUE', subtype: 'DIRECT_REVENUE', parent: '4100', level: 3, is_group: false, description: 'Net revenue from fresh cakes, pastries, cupcakes' },
  { code: '4120', name: 'Accessory & Merchandise Sales Revenue (18% GST)', type: 'REVENUE', subtype: 'DIRECT_REVENUE', parent: '4100', level: 3, is_group: false, description: 'Net revenue from party candles, toppers, toys' },
  { code: '4130', name: 'Delivery & Shipping Charges Collected', type: 'REVENUE', subtype: 'DELIVERY_REVENUE', parent: '4100', level: 3, is_group: false, description: 'Delivery and courier fees billed to customers' },
  { code: '4140', name: 'Customization & Midnight Surcharges', type: 'REVENUE', subtype: 'DIRECT_REVENUE', parent: '4100', level: 3, is_group: false, description: 'Midnight delivery slot charges, custom photo-cake fees' },
  { code: '4190', name: 'Sales Returns, Refunds & Allowances', type: 'REVENUE', subtype: 'DIRECT_REVENUE', parent: '4100', level: 3, is_group: false, description: 'Contra-revenue account for cancelled/refunded customer orders' },
  { code: '4200', name: 'Other / Indirect Income', type: 'REVENUE', subtype: 'INDIRECT_REVENUE', parent: '4000', level: 2, is_group: true, description: 'Non-operating revenue group' },
  { code: '4210', name: 'Interest Income', type: 'REVENUE', subtype: 'INDIRECT_REVENUE', parent: '4200', level: 3, is_group: false, description: 'Bank sweep account interest received' },
  { code: '4220', name: 'Scrap & By-product Sales', type: 'REVENUE', subtype: 'INDIRECT_REVENUE', parent: '4200', level: 3, is_group: false, description: 'Sale of empty edible oil tins, corrugated scrap, discarded trays' },

  // ── 5000 EXPENSES ───────────────────────────────────────────────────────────
  { code: '5000', name: 'Expenses', type: 'EXPENSE', subtype: 'OPERATING_EXPENSE', parent: null, level: 1, is_group: true, description: 'Root Expense Group' },
  { code: '5100', name: 'Cost of Goods Sold (COGS)', type: 'EXPENSE', subtype: 'COGS', parent: '5000', level: 2, is_group: true, description: 'Direct kitchen production costs group' },
  { code: '5110', name: 'COGS - Cakes', type: 'EXPENSE', subtype: 'COGS', parent: '5100', level: 3, is_group: false, description: 'Cost of Goods Sold recognized upon fulfillment of purchased cake merchandise to customers.' },
  { code: '5120', name: 'Accessory Merchandise Sold (Cost of Accessories)', type: 'EXPENSE', subtype: 'COGS', parent: '5100', level: 3, is_group: false, description: 'Cost of candles, toppers, and novelties sold to customers' },
  { code: '5130', name: 'Packaging Materials Consumed', type: 'EXPENSE', subtype: 'COGS', parent: '5100', level: 3, is_group: false, description: 'Printed cake boxes, cake base boards, ribbons, knives, tissue' },
  { code: '5140', name: 'Kitchen Direct Labour / Chef Wages', type: 'EXPENSE', subtype: 'COGS', parent: '5100', level: 3, is_group: false, description: 'Direct compensation for master pastry chefs and kitchen assistants' },
  { code: '5190', name: 'Purchase Discounts Received', type: 'EXPENSE', subtype: 'COGS', parent: '5100', level: 3, is_group: false, description: 'Contra-COGS vendor prompt payment/trade discounts' },
  { code: '5200', name: 'Operational & Administrative Expenses', type: 'EXPENSE', subtype: 'OPERATING_EXPENSE', parent: '5000', level: 2, is_group: true, description: 'Commercial overheads group' },
  { code: '5210', name: 'Store & Kitchen Rent', type: 'EXPENSE', subtype: 'OPERATING_EXPENSE', parent: '5200', level: 3, is_group: false, description: 'Monthly rent for retail shops, central bakery hubs [Branch Dim]' },
  { code: '5220', name: 'Electricity, Gas & Utilities', type: 'EXPENSE', subtype: 'OPERATING_EXPENSE', parent: '5200', level: 3, is_group: false, description: 'Commercial three-phase power, commercial LPG cylinders [Branch Dim]' },
  { code: '5230', name: 'Vehicle Fuel & Fleet Maintenance', type: 'EXPENSE', subtype: 'OPERATING_EXPENSE', parent: '5200', level: 3, is_group: false, description: 'Delivery vehicle petrol/diesel, engine servicing, tire repairs' },
  { code: '5240', name: 'Freight & Cartage Inward', type: 'EXPENSE', subtype: 'OPERATING_EXPENSE', parent: '5200', level: 3, is_group: false, description: 'Freight paid on raw materials, packaging, and store transfers' },
  { code: '5250', name: 'Staff Salaries & Store Personnel', type: 'EXPENSE', subtype: 'OPERATING_EXPENSE', parent: '5200', level: 3, is_group: false, description: 'Branch managers, cashiers, customer care staff compensation' },
  { code: '5260', name: 'Marketing & Customer Promotion', type: 'EXPENSE', subtype: 'OPERATING_EXPENSE', parent: '5200', level: 3, is_group: false, description: 'Digital advertising (Meta/Google), influencer cake promos' },
  { code: '5270', name: 'Repairs & Kitchen Maintenance', type: 'EXPENSE', subtype: 'OPERATING_EXPENSE', parent: '5200', level: 3, is_group: false, description: 'Chiller gas refills, oven element replacements, pest control' },
  { code: '5280', name: 'Software, Internet & Tech Infrastructure', type: 'EXPENSE', subtype: 'OPERATING_EXPENSE', parent: '5200', level: 3, is_group: false, description: 'Cloud server hosting, Supabase DB, branch high-speed broadband' },
  { code: '5290', name: 'Payment Gateway MDR Fees', type: 'EXPENSE', subtype: 'OPERATING_EXPENSE', parent: '5200', level: 3, is_group: false, description: 'Razorpay / Stripe transaction processing charges (1.8% to 2.0%)' },
  { code: '5295', name: 'Cash Rounding / Variance', type: 'EXPENSE', subtype: 'OPERATING_EXPENSE', parent: '5200', level: 3, is_group: false, description: 'Fractional currency rounding differences on sales and purchase bills' },
  { code: '5299', name: 'Miscellaneous Operating Expenses', type: 'EXPENSE', subtype: 'OPERATING_EXPENSE', parent: '5200', level: 3, is_group: false, description: 'Sundry cleaning, sanitation, municipal trade license renewals' },
  { code: '5300', name: 'Financial & Depreciation Expenses', type: 'EXPENSE', subtype: 'FINANCIAL_EXPENSE', parent: '5000', level: 2, is_group: true, description: 'Financial costs and asset write-downs group' },
  { code: '5310', name: 'Bank Charges & Processing Fees', type: 'EXPENSE', subtype: 'FINANCIAL_EXPENSE', parent: '5300', level: 3, is_group: false, description: 'Current account maintenance charges, RTGS/NEFT fees' },
  { code: '5320', name: 'Loan Interest Expense', type: 'EXPENSE', subtype: 'FINANCIAL_EXPENSE', parent: '5300', level: 3, is_group: false, description: 'Finance charges on working capital loans' },
  { code: '5330', name: 'Depreciation & Amortization', type: 'EXPENSE', subtype: 'OPERATING_EXPENSE', parent: '5300', level: 3, is_group: false, description: 'Periodic depreciation charge on ovens, POS machines, vehicles' }
];

async function seed() {
  const client = new Client({ connectionString: getConnectionString(), ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log("=== PHASE 4D: CHART OF ACCOUNTS DETERMINISTIC SEED ===");

  try {
    // 1. Pre-seed forensic check
    const preCountRes = await client.query(`SELECT count(*)::int as cnt FROM public.accounting_account;`);
    const preCount = preCountRes.rows[0].cnt;
    console.log(`Pre-seed accounting_account row count: ${preCount}`);

    if (preCount > 0) {
      console.warn(`NOTICE: accounting_account already contains ${preCount} rows. Executing idempotent seed.`);
    }

    // 2. Sort accounts strictly by level ascending (topological ordering: 1 -> 2 -> 3 -> 4)
    const sorted = [...AUTHORITATIVE_ACCOUNTS].sort((a, b) => a.level - b.level);
    console.log(`Total accounts prepared for seeding: ${sorted.length}`);

    await client.query('BEGIN;');

    const codeToIdMap = new Map();

    // If accounts already exist, preload their code -> id mapping
    const existingRows = await client.query(`SELECT id, code FROM public.accounting_account;`);
    for (const row of existingRows.rows) {
      codeToIdMap.set(row.code, row.id);
    }

    let insertedCount = 0;
    let updatedCount = 0;

    for (const acc of sorted) {
      let parentId = null;
      if (acc.parent) {
        parentId = codeToIdMap.get(acc.parent);
        if (!parentId) {
          throw new Error(`Topological failure: Parent ${acc.parent} not found for child ${acc.code} (${acc.name})`);
        }
      }

      const sql = `
        INSERT INTO public.accounting_account
          (code, name, type, subtype, parent_id, level, is_group, is_system, is_active, tax_rate, tax_class, description, created_by, created_at, updated_at)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8, true, $9, $10, $11, 'system_phase4d_seed', NOW(), NOW())
        ON CONFLICT (code) DO UPDATE SET
          name = EXCLUDED.name,
          type = EXCLUDED.type,
          subtype = EXCLUDED.subtype,
          parent_id = EXCLUDED.parent_id,
          level = EXCLUDED.level,
          is_group = EXCLUDED.is_group,
          is_system = EXCLUDED.is_system,
          tax_rate = EXCLUDED.tax_rate,
          tax_class = EXCLUDED.tax_class,
          description = EXCLUDED.description,
          updated_at = NOW()
        RETURNING id, (xmax = 0) AS is_insert;
      `;

      const params = [
        acc.code,
        acc.name,
        acc.type,
        acc.subtype,
        parentId,
        acc.level,
        acc.is_group,
        true, // is_system
        acc.tax_rate ?? null,
        acc.tax_class ?? null,
        acc.description ?? null
      ];

      const res = await client.query(sql, params);
      const row = res.rows[0];
      codeToIdMap.set(acc.code, row.id);

      if (row.is_insert) {
        insertedCount++;
      } else {
        updatedCount++;
      }
    }

    // In-transaction verification
    const postCountRes = await client.query(`SELECT count(*)::int as cnt FROM public.accounting_account;`);
    const postCount = postCountRes.rows[0].cnt;
    if (postCount !== 98) {
      throw new Error(`In-transaction assertion failed: Expected exactly 98 accounts, got ${postCount}`);
    }

    // Verify zero orphaned parents
    const orphanRes = await client.query(`
      SELECT count(*)::int as cnt 
      FROM public.accounting_account 
      WHERE parent_id IS NOT NULL 
        AND parent_id NOT IN (SELECT id FROM public.accounting_account);
    `);
    if (orphanRes.rows[0].cnt !== 0) {
      throw new Error(`In-transaction assertion failed: Found ${orphanRes.rows[0].cnt} orphaned parent references!`);
    }

    await client.query('COMMIT;');
    console.log(`TRANSACTION COMMITTED SUCCESSFULLY: Inserted=${insertedCount}, Updated=${updatedCount}, Total=${postCount}`);

  } catch (err) {
    await client.query('ROLLBACK;');
    console.error("TRANSACTION ROLLED BACK DUE TO ERROR:", err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

seed().catch(err => {
  console.error("Fatal seed error:", err);
  process.exit(1);
});
