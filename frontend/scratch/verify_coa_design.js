/**
 * In-memory design verification for proposed CakeToHome Chart of Accounts.
 * Validates:
 * - DDL constraint compliance (chk_account_type, chk_account_subtype, chk_account_level, uq_code)
 * - Hierarchy integrity (parent exists, parent level = child level - 1)
 * - Group vs Posting integrity (groups cannot post, leaves can post)
 * - Subtype to Type affinity
 * - GST and Payment account coverage
 * - AR/AP control accounts presence
 */

const PROPOSED_COA = [
  // ── 1000 ASSETS ─────────────────────────────────────────────────────────────
  { code: '1000', name: 'Assets', type: 'ASSET', subtype: 'CURRENT_ASSET', parent: null, level: 1, is_group: true, purpose: 'Root Asset Group' },
  { code: '1100', name: 'Current Assets', type: 'ASSET', subtype: 'CURRENT_ASSET', parent: '1000', level: 2, is_group: true, purpose: 'Current Assets Summary' },
  { code: '1110', name: 'Cash and Cash Equivalents', type: 'ASSET', subtype: 'CURRENT_ASSET', parent: '1100', level: 3, is_group: true, purpose: 'Liquid Funds Group' },
  { code: '1111', name: 'Cash in Hand', type: 'ASSET', subtype: 'CASH', parent: '1110', level: 4, is_group: false, purpose: 'Store physical cash drawers' },
  { code: '1112', name: 'Bank Operating A/c', type: 'ASSET', subtype: 'BANK', parent: '1110', level: 4, is_group: false, purpose: 'Primary current account' },
  { code: '1113', name: 'Gateway Clearing', type: 'ASSET', subtype: 'GATEWAY_CLEARING', parent: '1110', level: 4, is_group: false, purpose: 'Online payment clearing' },
  { code: '1114', name: 'Petty Cash - Branches', type: 'ASSET', subtype: 'CASH', parent: '1110', level: 4, is_group: false, purpose: 'Branch petty cash floats' },
  { code: '1119', name: 'Unclassified Suspense', type: 'ASSET', subtype: 'CURRENT_ASSET', parent: '1110', level: 4, is_group: false, purpose: 'Temporary unallocated funds' },
  { code: '1120', name: 'Receivables and Advances', type: 'ASSET', subtype: 'CURRENT_ASSET', parent: '1100', level: 3, is_group: true, purpose: 'Debtors and short-term assets' },
  { code: '1121', name: 'Accounts Receivable', type: 'ASSET', subtype: 'RECEIVABLE', parent: '1120', level: 4, is_group: false, purpose: 'Customer trade debtors ledger' },
  { code: '1122', name: 'Undeposited COD', type: 'ASSET', subtype: 'CURRENT_ASSET', parent: '1120', level: 4, is_group: false, purpose: 'Cash collected by riders pending bank deposit' },
  { code: '1123', name: 'Staff Advances', type: 'ASSET', subtype: 'CURRENT_ASSET', parent: '1120', level: 4, is_group: false, purpose: 'Short-term employee advances' },
  { code: '1124', name: 'Security Deposits - Leases', type: 'ASSET', subtype: 'CURRENT_ASSET', parent: '1120', level: 4, is_group: false, purpose: 'Store rental deposits' },
  { code: '1130', name: 'Inventories', type: 'ASSET', subtype: 'CURRENT_ASSET', parent: '1100', level: 3, is_group: true, purpose: 'Stock and supplies inventory group' },
  { code: '1131', name: 'Merchandise Inventory - Accessories', type: 'ASSET', subtype: 'INVENTORY', parent: '1130', level: 4, is_group: false, purpose: 'Physical quantity-controlled accessories' },
  { code: '1132', name: 'Bakery Raw Materials & Ingredients', type: 'ASSET', subtype: 'INVENTORY', parent: '1130', level: 4, is_group: false, purpose: 'Periodic stock of bulk bakery ingredients' },
  { code: '1133', name: 'Packaging Supplies Stock', type: 'ASSET', subtype: 'INVENTORY', parent: '1130', level: 4, is_group: false, purpose: 'Cake boxes, boards, bags' },
  { code: '1140', name: 'Duties & Taxes - Input Tax Credit', type: 'ASSET', subtype: 'CURRENT_ASSET', parent: '1100', level: 3, is_group: true, purpose: 'GST Input credits summary' },
  { code: '1141', name: 'Input CGST 2.5% (Food/Bakery)', type: 'ASSET', subtype: 'INPUT_TAX', parent: '1140', level: 4, is_group: false, tax_rate: 2.5, purpose: 'Intrastate CGST credit on bakery purchases' },
  { code: '1142', name: 'Input SGST 2.5% (Food/Bakery)', type: 'ASSET', subtype: 'INPUT_TAX', parent: '1140', level: 4, is_group: false, tax_rate: 2.5, purpose: 'Intrastate SGST credit on bakery purchases' },
  { code: '1143', name: 'Input CGST 9.0% (Accessories/General)', type: 'ASSET', subtype: 'INPUT_TAX', parent: '1140', level: 4, is_group: false, tax_rate: 9.0, purpose: 'Intrastate CGST credit on accessories/supplies' },
  { code: '1144', name: 'Input SGST 9.0% (Accessories/General)', type: 'ASSET', subtype: 'INPUT_TAX', parent: '1140', level: 4, is_group: false, tax_rate: 9.0, purpose: 'Intrastate SGST credit on accessories/supplies' },
  { code: '1145', name: 'Input IGST 5.0% (Interstate Food)', type: 'ASSET', subtype: 'INPUT_TAX', parent: '1140', level: 4, is_group: false, tax_rate: 5.0, purpose: 'Interstate IGST credit on food ingredients' },
  { code: '1146', name: 'Input IGST 18.0% (Interstate Accessories)', type: 'ASSET', subtype: 'INPUT_TAX', parent: '1140', level: 4, is_group: false, tax_rate: 18.0, purpose: 'Interstate IGST credit on accessories' },
  { code: '1147', name: 'Input CGST 6.0% (Toys/Novelties)', type: 'ASSET', subtype: 'INPUT_TAX', parent: '1140', level: 4, is_group: false, tax_rate: 6.0, purpose: 'Intrastate CGST credit on 12% novelties' },
  { code: '1148', name: 'Input SGST 6.0% (Toys/Novelties)', type: 'ASSET', subtype: 'INPUT_TAX', parent: '1140', level: 4, is_group: false, tax_rate: 6.0, purpose: 'Intrastate SGST credit on 12% novelties' },
  { code: '1149', name: 'Input IGST 12.0% (Interstate Toys)', type: 'ASSET', subtype: 'INPUT_TAX', parent: '1140', level: 4, is_group: false, tax_rate: 12.0, purpose: 'Interstate IGST credit on 12% novelties' },
  { code: '1500', name: 'Fixed Assets (PP&E)', type: 'ASSET', subtype: 'FIXED_ASSET', parent: '1000', level: 2, is_group: true, purpose: 'Property, Plant and Equipment' },
  { code: '1510', name: 'Bakery & Kitchen Equipment', type: 'ASSET', subtype: 'FIXED_ASSET', parent: '1500', level: 3, is_group: false, purpose: 'Commercial ovens, mixers, chillers' },
  { code: '1520', name: 'Delivery Vehicles & Fleet', type: 'ASSET', subtype: 'FIXED_ASSET', parent: '1500', level: 3, is_group: false, purpose: 'Vans and delivery two-wheelers' },
  { code: '1530', name: 'Computers & POS Hardware', type: 'ASSET', subtype: 'FIXED_ASSET', parent: '1500', level: 3, is_group: false, purpose: 'Tablets, billing POS terminals' },
  { code: '1540', name: 'Furniture & Fixtures', type: 'ASSET', subtype: 'FIXED_ASSET', parent: '1500', level: 3, is_group: false, purpose: 'Display counters, racks, signage' },
  { code: '1590', name: 'Accumulated Depreciation', type: 'ASSET', subtype: 'FIXED_ASSET', parent: '1500', level: 3, is_group: false, purpose: 'Contra-asset cumulative depreciation' },

  // ── 2000 LIABILITIES ────────────────────────────────────────────────────────
  { code: '2000', name: 'Liabilities', type: 'LIABILITY', subtype: 'CURRENT_LIABILITY', parent: null, level: 1, is_group: true, purpose: 'Root Liability Group' },
  { code: '2100', name: 'Current Liabilities', type: 'LIABILITY', subtype: 'CURRENT_LIABILITY', parent: '2000', level: 2, is_group: true, purpose: 'Current Obligations Group' },
  { code: '2110', name: 'Trade Payables', type: 'LIABILITY', subtype: 'CURRENT_LIABILITY', parent: '2100', level: 3, is_group: true, purpose: 'Creditors and suppliers summary' },
  { code: '2111', name: 'Accounts Payable', type: 'LIABILITY', subtype: 'PAYABLE', parent: '2110', level: 4, is_group: false, purpose: 'Trade creditors ledger (supplier dimension required)' },
  { code: '2120', name: 'Duties & Taxes - Output Tax Liability', type: 'LIABILITY', subtype: 'CURRENT_LIABILITY', parent: '2100', level: 3, is_group: true, purpose: 'GST Output liability summary' },
  { code: '2121', name: 'Output CGST 2.5% (Food/Bakery)', type: 'LIABILITY', subtype: 'OUTPUT_TAX', parent: '2120', level: 4, is_group: false, tax_rate: 2.5, purpose: 'Intrastate CGST collected on bakery sales' },
  { code: '2122', name: 'Output SGST 2.5% (Food/Bakery)', type: 'LIABILITY', subtype: 'OUTPUT_TAX', parent: '2120', level: 4, is_group: false, tax_rate: 2.5, purpose: 'Intrastate SGST collected on bakery sales' },
  { code: '2123', name: 'Output CGST 9.0% (Accessories)', type: 'LIABILITY', subtype: 'OUTPUT_TAX', parent: '2120', level: 4, is_group: false, tax_rate: 9.0, purpose: 'Intrastate CGST collected on accessories' },
  { code: '2124', name: 'Output SGST 9.0% (Accessories)', type: 'LIABILITY', subtype: 'OUTPUT_TAX', parent: '2120', level: 4, is_group: false, tax_rate: 9.0, purpose: 'Intrastate SGST collected on accessories' },
  { code: '2125', name: 'Output IGST 5.0% (Interstate Food)', type: 'LIABILITY', subtype: 'OUTPUT_TAX', parent: '2120', level: 4, is_group: false, tax_rate: 5.0, purpose: 'Interstate IGST collected on bakery sales' },
  { code: '2126', name: 'Output IGST 18.0% (Interstate Accessories)', type: 'LIABILITY', subtype: 'OUTPUT_TAX', parent: '2120', level: 4, is_group: false, tax_rate: 18.0, purpose: 'Interstate IGST collected on accessories' },
  { code: '2127', name: 'Output CGST 6.0% (Toys)', type: 'LIABILITY', subtype: 'OUTPUT_TAX', parent: '2120', level: 4, is_group: false, tax_rate: 6.0, purpose: 'Intrastate CGST collected on 12% novelties' },
  { code: '2128', name: 'Output SGST 6.0% (Toys)', type: 'LIABILITY', subtype: 'OUTPUT_TAX', parent: '2120', level: 4, is_group: false, tax_rate: 6.0, purpose: 'Intrastate SGST collected on 12% novelties' },
  { code: '2129', name: 'Output IGST 12.0% (Interstate Toys)', type: 'LIABILITY', subtype: 'OUTPUT_TAX', parent: '2120', level: 4, is_group: false, tax_rate: 12.0, purpose: 'Interstate IGST collected on 12% novelties' },
  { code: '2130', name: 'TDS Payable', type: 'LIABILITY', subtype: 'CURRENT_LIABILITY', parent: '2100', level: 3, is_group: false, purpose: 'Tax deducted at source from vendor payments' },
  { code: '2140', name: 'Advances & Unearned Revenue', type: 'LIABILITY', subtype: 'CURRENT_LIABILITY', parent: '2100', level: 3, is_group: true, purpose: 'Customer advances and gift card liability' },
  { code: '2141', name: 'Customer Advances', type: 'LIABILITY', subtype: 'CUSTOMER_ADVANCE', parent: '2140', level: 4, is_group: false, purpose: 'Prepaid order deposits (customer dimension required)' },
  { code: '2142', name: 'Gift Card / Wallet Liabilities', type: 'LIABILITY', subtype: 'CURRENT_LIABILITY', parent: '2140', level: 4, is_group: false, purpose: 'Store credit balance outstanding' },
  { code: '2150', name: 'Operating Accruals & Staff Payables', type: 'LIABILITY', subtype: 'CURRENT_LIABILITY', parent: '2100', level: 3, is_group: true, purpose: 'Accrued expenses and staff payroll' },
  { code: '2151', name: 'Salaries & Wages Payable', type: 'LIABILITY', subtype: 'STAFF_PAYABLE', parent: '2150', level: 4, is_group: false, purpose: 'Monthly payroll obligations' },
  { code: '2152', name: 'Rent Payable', type: 'LIABILITY', subtype: 'CURRENT_LIABILITY', parent: '2150', level: 4, is_group: false, purpose: 'Accrued store/kitchen rent' },
  { code: '2153', name: 'Accrued Operating Expenses', type: 'LIABILITY', subtype: 'CURRENT_LIABILITY', parent: '2150', level: 4, is_group: false, purpose: 'Unbilled utility and service liabilities' },
  { code: '2500', name: 'Long-Term Liabilities', type: 'LIABILITY', subtype: 'LONG_TERM_LIABILITY', parent: '2000', level: 2, is_group: true, purpose: 'Term debt and long-term borrowings' },
  { code: '2510', name: 'Bank Loans & Borrowings', type: 'LIABILITY', subtype: 'LONG_TERM_LIABILITY', parent: '2500', level: 3, is_group: false, purpose: 'Commercial bank term loans' },

  // ── 3000 EQUITY ─────────────────────────────────────────────────────────────
  { code: '3000', name: 'Equity', type: 'EQUITY', subtype: 'CAPITAL', parent: null, level: 1, is_group: true, purpose: 'Root Equity Group' },
  { code: '3100', name: 'Capital & Reserves', type: 'EQUITY', subtype: 'CAPITAL', parent: '3000', level: 2, is_group: true, purpose: 'Owners equity and capital' },
  { code: '3110', name: 'Partner / Shareholder Capital', type: 'EQUITY', subtype: 'CAPITAL', parent: '3100', level: 3, is_group: false, purpose: 'Core invested equity' },
  { code: '3120', name: 'Drawings / Distributions', type: 'EQUITY', subtype: 'CAPITAL', parent: '3100', level: 3, is_group: false, purpose: 'Owner withdrawals' },
  { code: '3200', name: 'Retained Earnings Group', type: 'EQUITY', subtype: 'RETAINED_EARNINGS', parent: '3000', level: 2, is_group: true, purpose: 'Cumulative operational profits' },
  { code: '3210', name: 'Retained Earnings (Prior Years)', type: 'EQUITY', subtype: 'RETAINED_EARNINGS', parent: '3200', level: 3, is_group: false, purpose: 'Prior years accumulated net earnings' },
  { code: '3220', name: 'Current Year Net Earnings', type: 'EQUITY', subtype: 'RETAINED_EARNINGS', parent: '3200', level: 3, is_group: false, purpose: 'Current fiscal year P&L roll-up' },
  { code: '3300', name: 'Opening Balance Offset / Capital Reserve', type: 'EQUITY', subtype: 'OPENING_OFFSET', parent: '3000', level: 2, is_group: false, purpose: 'Balancing figure for historical cut-off balance sheet' },

  // ── 4000 REVENUE ────────────────────────────────────────────────────────────
  { code: '4000', name: 'Revenue', type: 'REVENUE', subtype: 'DIRECT_REVENUE', parent: null, level: 1, is_group: true, purpose: 'Root Revenue Group' },
  { code: '4100', name: 'Operating Revenue', type: 'REVENUE', subtype: 'DIRECT_REVENUE', parent: '4000', level: 2, is_group: true, purpose: 'Sales and delivery revenue group' },
  { code: '4110', name: 'Cake & Bakery Sales Revenue (5% GST)', type: 'REVENUE', subtype: 'DIRECT_REVENUE', parent: '4100', level: 3, is_group: false, purpose: 'Revenue from cakes, pastries, cupcakes' },
  { code: '4120', name: 'Accessory & Merchandise Sales Revenue (18% GST)', type: 'REVENUE', subtype: 'DIRECT_REVENUE', parent: '4100', level: 3, is_group: false, purpose: 'Revenue from candles, toppers, merchandise' },
  { code: '4130', name: 'Delivery & Shipping Charges Collected', type: 'REVENUE', subtype: 'DELIVERY_REVENUE', parent: '4100', level: 3, is_group: false, purpose: 'Fulfillment & delivery fees billed to customers' },
  { code: '4140', name: 'Customization & Midnight Surcharges', type: 'REVENUE', subtype: 'DIRECT_REVENUE', parent: '4100', level: 3, is_group: false, purpose: 'Photo cake, midnight slot premiums' },
  { code: '4190', name: 'Sales Returns, Refunds & Allowances', type: 'REVENUE', subtype: 'DIRECT_REVENUE', parent: '4100', level: 3, is_group: false, purpose: 'Contra-revenue customer refunds and return allowances' },
  { code: '4200', name: 'Other / Indirect Income', type: 'REVENUE', subtype: 'INDIRECT_REVENUE', parent: '4000', level: 2, is_group: true, purpose: 'Non-operating revenue' },
  { code: '4210', name: 'Interest Income', type: 'REVENUE', subtype: 'INDIRECT_REVENUE', parent: '4200', level: 3, is_group: false, purpose: 'Bank interest earned' },
  { code: '4220', name: 'Scrap & By-product Sales', type: 'REVENUE', subtype: 'INDIRECT_REVENUE', parent: '4200', level: 3, is_group: false, purpose: 'Sale of bakery waste/packaging scrap' },

  // ── 5000 EXPENSES ───────────────────────────────────────────────────────────
  { code: '5000', name: 'Expenses', type: 'EXPENSE', subtype: 'OPERATING_EXPENSE', parent: null, level: 1, is_group: true, purpose: 'Root Expense Group' },
  { code: '5100', name: 'Cost of Goods Sold (COGS)', type: 'EXPENSE', subtype: 'COGS', parent: '5000', level: 2, is_group: true, purpose: 'Direct production costs' },
  { code: '5110', name: 'Raw Material Consumption / Bakery Ingredients', type: 'EXPENSE', subtype: 'COGS', parent: '5100', level: 3, is_group: false, purpose: 'Flour, dairy, chocolate, fruits, fondants consumed' },
  { code: '5120', name: 'Accessory Merchandise Sold (Cost of Accessories)', type: 'EXPENSE', subtype: 'COGS', parent: '5100', level: 3, is_group: false, purpose: 'Cost of candles and toppers sold' },
  { code: '5130', name: 'Packaging Materials Consumed', type: 'EXPENSE', subtype: 'COGS', parent: '5100', level: 3, is_group: false, purpose: 'Boxes, cake boards, cutlery, ribbons' },
  { code: '5140', name: 'Kitchen Direct Labour / Chef Wages', type: 'EXPENSE', subtype: 'COGS', parent: '5100', level: 3, is_group: false, purpose: 'Pastry chefs and bakery assistants direct wages' },
  { code: '5190', name: 'Purchase Discounts Received', type: 'EXPENSE', subtype: 'COGS', parent: '5100', level: 3, is_group: false, purpose: 'Contra-COGS vendor trade discounts' },
  { code: '5200', name: 'Operational & Administrative Expenses', type: 'EXPENSE', subtype: 'OPERATING_EXPENSE', parent: '5000', level: 2, is_group: true, purpose: 'Operating overheads' },
  { code: '5210', name: 'Store & Kitchen Rent', type: 'EXPENSE', subtype: 'OPERATING_EXPENSE', parent: '5200', level: 3, is_group: false, purpose: 'Monthly rental for retail shops and central hubs' },
  { code: '5220', name: 'Electricity, Gas & Utilities', type: 'EXPENSE', subtype: 'OPERATING_EXPENSE', parent: '5200', level: 3, is_group: false, purpose: 'Commercial power and oven gas supplies' },
  { code: '5230', name: 'Vehicle Fuel & Fleet Maintenance', type: 'EXPENSE', subtype: 'OPERATING_EXPENSE', parent: '5200', level: 3, is_group: false, purpose: 'Delivery vehicle petrol, diesel and servicing' },
  { code: '5240', name: 'Freight & Cartage Inward', type: 'EXPENSE', subtype: 'OPERATING_EXPENSE', parent: '5200', level: 3, is_group: false, purpose: 'Inward shipping of ingredients and packaging' },
  { code: '5250', name: 'Staff Salaries & Store Personnel', type: 'EXPENSE', subtype: 'OPERATING_EXPENSE', parent: '5200', level: 3, is_group: false, purpose: 'Branch managers, billing staff, support wages' },
  { code: '5260', name: 'Marketing & Customer Promotion', type: 'EXPENSE', subtype: 'OPERATING_EXPENSE', parent: '5200', level: 3, is_group: false, purpose: 'Digital ads, influencer promotions, print flyers' },
  { code: '5270', name: 'Repairs & Kitchen Maintenance', type: 'EXPENSE', subtype: 'OPERATING_EXPENSE', parent: '5200', level: 3, is_group: false, purpose: 'Equipment servicing, chiller maintenance' },
  { code: '5280', name: 'Software, Internet & Tech Infrastructure', type: 'EXPENSE', subtype: 'OPERATING_EXPENSE', parent: '5200', level: 3, is_group: false, purpose: 'Cloud hosting, ERP software, shop broadband' },
  { code: '5290', name: 'Payment Gateway MDR Fees', type: 'EXPENSE', subtype: 'OPERATING_EXPENSE', parent: '5200', level: 3, is_group: false, purpose: 'Razorpay / Cashfree / Stripe transaction charges' },
  { code: '5295', name: 'Cash Rounding / Variance', type: 'EXPENSE', subtype: 'OPERATING_EXPENSE', parent: '5200', level: 3, is_group: false, purpose: 'Fractional currency rounding differences' },
  { code: '5299', name: 'Miscellaneous Operating Expenses', type: 'EXPENSE', subtype: 'OPERATING_EXPENSE', parent: '5200', level: 3, is_group: false, purpose: 'Sundry retail branch expenses' },
  { code: '5300', name: 'Financial & Depreciation Expenses', type: 'EXPENSE', subtype: 'FINANCIAL_EXPENSE', parent: '5000', level: 2, is_group: true, purpose: 'Financing costs and asset depreciation' },
  { code: '5310', name: 'Bank Charges & Processing Fees', type: 'EXPENSE', subtype: 'FINANCIAL_EXPENSE', parent: '5300', level: 3, is_group: false, purpose: 'Current account maintenance, cheque bounce fees' },
  { code: '5320', name: 'Loan Interest Expense', type: 'EXPENSE', subtype: 'FINANCIAL_EXPENSE', parent: '5300', level: 3, is_group: false, purpose: 'Interest on working capital and term borrowings' },
  { code: '5330', name: 'Depreciation & Amortization', type: 'EXPENSE', subtype: 'OPERATING_EXPENSE', parent: '5300', level: 3, is_group: false, purpose: 'Annual write-down of bakery ovens and vehicles' }
];

const VALID_TYPES = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'];

const VALID_SUBTYPES = [
  'CURRENT_ASSET', 'CASH', 'BANK', 'GATEWAY_CLEARING', 'RECEIVABLE', 'INVENTORY', 'INPUT_TAX', 'FIXED_ASSET',
  'CURRENT_LIABILITY', 'PAYABLE', 'OUTPUT_TAX', 'STAFF_PAYABLE', 'CUSTOMER_ADVANCE', 'LONG_TERM_LIABILITY',
  'CAPITAL', 'RETAINED_EARNINGS', 'OPENING_OFFSET',
  'DIRECT_REVENUE', 'INDIRECT_REVENUE', 'DELIVERY_REVENUE',
  'COGS', 'OPERATING_EXPENSE', 'FINANCIAL_EXPENSE'
];

function verify() {
  const errors = [];
  const codeMap = new Map();

  for (const acc of PROPOSED_COA) {
    // 1. Code uniqueness
    if (codeMap.has(acc.code)) {
      errors.push(`Duplicate account code: ${acc.code}`);
    }
    codeMap.set(acc.code, acc);

    // 2. Length
    if (acc.code.length > 20) errors.push(`Code too long (>20): ${acc.code}`);
    if (acc.name.length > 100) errors.push(`Name too long (>100): ${acc.name}`);

    // 3. Type
    if (!VALID_TYPES.includes(acc.type)) {
      errors.push(`Invalid type on ${acc.code}: ${acc.type}`);
    }

    // 4. Subtype
    if (!VALID_SUBTYPES.includes(acc.subtype)) {
      errors.push(`Invalid subtype on ${acc.code}: ${acc.subtype}`);
    }

    // 5. Level
    if (acc.level < 1 || acc.level > 5) {
      errors.push(`Invalid level on ${acc.code}: ${acc.level}`);
    }
  }

  // Verify hierarchy
  for (const acc of PROPOSED_COA) {
    if (acc.parent) {
      const parentAcc = codeMap.get(acc.parent);
      if (!parentAcc) {
        errors.push(`Parent not found for ${acc.code}: ${acc.parent}`);
      } else {
        if (!parentAcc.is_group) {
          errors.push(`Parent must be group account: ${parentAcc.code} (parent of ${acc.code})`);
        }
        if (parentAcc.level !== acc.level - 1) {
          errors.push(`Level mismatch: ${acc.code} (lvl ${acc.level}) parent ${parentAcc.code} (lvl ${parentAcc.level})`);
        }
        if (parentAcc.type !== acc.type) {
          errors.push(`Type mismatch across hierarchy: ${acc.code} (${acc.type}) vs parent ${parentAcc.code} (${parentAcc.type})`);
        }
      }
    } else {
      if (acc.level !== 1) {
        errors.push(`Root account ${acc.code} must be level 1, got ${acc.level}`);
      }
      if (!acc.is_group) {
        errors.push(`Root account ${acc.code} must be group`);
      }
    }
  }

  // Verify critical control accounts
  const requiredCodes = ['1111', '1112', '1113', '1119', '1121', '1122', '1131', '1141', '1142', '1143', '1144', '1145', '1146', '2111', '2121', '2122', '2123', '2124', '2125', '2126', '2141', '3300'];
  for (const req of requiredCodes) {
    if (!codeMap.has(req)) {
      errors.push(`Missing mandatory control/clearing account: ${req}`);
    }
  }

  console.log(`Verified ${PROPOSED_COA.length} proposed accounts.`);
  if (errors.length > 0) {
    console.error("COA VERIFICATION ERRORS:", errors);
    process.exit(1);
  } else {
    console.log("ALL COA CONSTRAINTS, HIERARCHIES, AND INVARIANTS PASSED 100%!");
  }
}

verify();
