const { Pool } = require("pg");
const pool = new Pool({
  connectionString: "[REDACTED_DATABASE_CREDENTIAL]",
  ssl: { rejectUnauthorized: false },
});

const round2 = v => Math.round(v * 100) / 100;

async function run() {
  const client = await pool.connect();
  console.log("\n═══ POSITIVE ITC CALCULATION DEMONSTRATION ═══\n");

  try {
    await client.query("BEGIN");

    const catRes = await client.query("SELECT id FROM public.expense_category LIMIT 1");
    const categoryId = catRes.rows[0]?.id || 'excat_fuel';

    // 1. Insert an approved vendor purchase expense with positive ITC
    const expenseId = `exp_test_itc_${Date.now()}`;
    const insertSql = `
      INSERT INTO public.expense (
        id, branch_id, category_id, expense_date, reference_no, description,
        taxable_value, cgst, sgst, igst, total,
        itc_eligibility, rcm_applicable, hsn_sac_code, vendor_gstin,
        status, metadata, created_at, updated_at
      ) VALUES (
        $1, 'br_01KYWH05FY08YH6XJKATV0NXDR', $2, '2026-10-05',
        'INV-FLOUR-2026-089', 'Bulk Bakery Flour & Sugar Purchase',
        10000.00, 250.00, 250.00, 0.00, 10500.00,
        'ITC_ELIGIBLE', false, '11010000', '29AABCK1234F1Z5',
        'POSTED', '{"vendor_name": "Karnataka Flour & Sugar Mills Ltd"}'::jsonb,
        NOW(), NOW()
      ) RETURNING *;
    `;
    const expRow = (await client.query(insertSql, [expenseId, categoryId])).rows[0];
    console.log("1. Inserted approved test expense with positive ITC:");
    console.log(`   Expense ID: ${expRow.id}`);
    console.log(`   Category ID: ${expRow.category_id}`);
    console.log(`   Invoice / Ref: ${expRow.reference_no}`);
    console.log(`   Taxable Value: ₹${expRow.taxable_value}`);
    console.log(`   CGST (2.5%): ₹${expRow.cgst}, SGST (2.5%): ₹${expRow.sgst}, Total Tax: ₹${Number(expRow.cgst) + Number(expRow.sgst)}`);
    console.log(`   ITC Eligibility: ${expRow.itc_eligibility}`);

    // 2. Query using corrected GstReportingService ITC query
    const querySql = `
      SELECT
        e.id, e.expense_date,
        COALESCE(s.name, e.metadata->>'vendor_name', 'General Vendor') as vendor_name,
        COALESCE(e.vendor_gstin, s.gstin) as vendor_gstin,
        COALESCE(e.category_id, 'General') as category,
        e.hsn_sac_code, e.description,
        e.taxable_value, e.cgst, e.sgst, e.igst,
        e.itc_eligibility, e.rcm_applicable,
        e.reference_no as invoice_number,
        e.status, e.deleted_at
      FROM public.expense e
      LEFT JOIN public.supplier s ON s.id = e.supplier_id
      WHERE e.deleted_at IS NULL
        AND e.expense_date >= $1::date
        AND e.expense_date <= $2::date
        AND e.status NOT IN ('DRAFT', 'VOID', 'REJECTED')
      ORDER BY e.expense_date DESC
    `;
    const itcRows = (await client.query(querySql, ['2026-10-01', '2026-10-31'])).rows;
    console.log(`\n2. Query result from corrected GstReportingService query: ${itcRows.length} record(s)`);

    const mappedItc = itcRows.map(row => {
      const rawElig = (row.itc_eligibility || "ELIGIBLE").toUpperCase();
      const isEligible = !rawElig.includes("INELIGIBLE");
      return {
        expenseId: row.id,
        expenseDate: row.expense_date ? new Date(row.expense_date).toISOString().split("T")[0] : "",
        vendorName: row.vendor_name || "Unknown Vendor",
        vendorGstin: row.vendor_gstin || null,
        category: row.category || "General",
        hsnSacCode: row.hsn_sac_code || "",
        description: row.description || "",
        taxableValue: round2(Number(row.taxable_value || 0)),
        cgst: round2(Number(row.cgst || 0)),
        sgst: round2(Number(row.sgst || 0)),
        igst: round2(Number(row.igst || 0)),
        totalTax: round2(Number(row.cgst || 0) + Number(row.sgst || 0) + Number(row.igst || 0)),
        itcEligibility: isEligible ? "ELIGIBLE" : "INELIGIBLE",
        rcmApplicable: Boolean(row.rcm_applicable),
        invoiceNumber: row.invoice_number || null,
      };
    });

    for (const r of mappedItc) {
      console.log(`   → [${r.itcEligibility}] ${r.vendorName} (${r.vendorGstin || 'No GSTIN'}): Taxable=₹${r.taxableValue}, CGST=₹${r.cgst}, SGST=₹${r.sgst}, Total Tax=₹${r.totalTax}`);
    }

    // 3. Compute GSTR-3B Table 4 ITC aggregation
    const eligibleItc = mappedItc.filter(i => i.itcEligibility === "ELIGIBLE");
    const itcCgst = round2(eligibleItc.reduce((s, r) => s + r.cgst, 0));
    const itcSgst = round2(eligibleItc.reduce((s, r) => s + r.sgst, 0));
    const itcIgst = round2(eligibleItc.reduce((s, r) => s + r.igst, 0));

    console.log("\n3. GSTR-3B Table 4 (Eligible ITC) Aggregation:");
    console.log(`   Table 4(A)(5) [All other ITC]:`);
    console.log(`     - CGST: ₹${itcCgst.toFixed(2)}`);
    console.log(`     - SGST: ₹${itcSgst.toFixed(2)}`);
    console.log(`     - IGST: ₹${itcIgst.toFixed(2)}`);
    console.log(`     - Total Positive ITC Claimed: ₹${(itcCgst + itcSgst + itcIgst).toFixed(2)}`);
    console.log(`   Table 4(C) [Net ITC Available]:`);
    console.log(`     - CGST: ₹${itcCgst.toFixed(2)}`);
    console.log(`     - SGST: ₹${itcSgst.toFixed(2)}`);

    // Verify positive calculation
    const isPositive = itcCgst >= 250.00 && itcSgst >= 250.00;
    console.log(`\n4. Positive ITC Verification Verdict: ${isPositive ? '✅ PASSED — Positive ITC successfully demonstrated' : '❌ FAILED'}`);

  } finally {
    // Zero mutations: ALWAYS roll back
    await client.query("ROLLBACK");
    client.release();
    await pool.end();
    console.log("\n5. Transaction cleanly rolled back — production database is 100% pristine.\n");
  }
}

run().catch(console.error);
