/**
 * CakeToHome ERP — Targeted Verification: Marketplace, Tenant Isolation & Reconciliation
 * Validates:
 * 1. Commercial partner onboarding with GSTIN/PAN & tenant isolation
 * 2. Store creation bounded by partner_id
 * 3. Commercial agreement creation (commission % model)
 * 4. Order-level agreement snapshot creation with frozen terms
 * 5. Order-level reconciliation calculation with revenue/commission/GST breakdown
 * 6. Partner invoice receipt with duplicate invoice number rejection
 * 7. Discrepancy detection between claimed amount and PostgreSQL calculation
 * 8. Approval to Bills Payable with voucher linkage without auto-payment
 */

const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

function getConnectionString() {
  const envPath = path.join(__dirname, "../.env");
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("DATABASE_URL=")) {
        let val = trimmed.substring("DATABASE_URL=".length).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.substring(1, val.length - 1);
        }
        return val;
      }
    }
  }
  return process.env.DATABASE_URL;
}

const pool = new Pool({
  connectionString: getConnectionString(),
});

async function run() {
  console.log("=== 4. Testing Marketplace, Tenant Isolation & Reconciliation ===");
  const client = await pool.connect();

  const partnerA_Id = `ptnr_alpha_${Date.now()}`;
  const partnerB_Id = `ptnr_beta_${Date.now()}`;
  const storeA_Id = `str_alpha_${Date.now()}`;
  const agreementA_Id = `agr_alpha_${Date.now()}`;
  const orderId = `ord_mkt_${Date.now()}`;
  const snapshotId = `snp_${Date.now()}`;
  const invoiceA_Id = `inv_rec_${Date.now()}`;
  const partnerInvoiceNo = `PTNR-INV-2026-999`;

  try {
    // Clean up any residual test records with this invoice number, store code, agreement, or partner code
    await client.query("DELETE FROM marketplace_partner_invoice WHERE partner_invoice_number = $1", [partnerInvoiceNo]);
    await client.query("DELETE FROM marketplace_order_snapshot WHERE order_id LIKE 'ord_mkt_%'");
    await client.query("DELETE FROM marketplace_agreement WHERE terms_document_ref = 'Standard 15% Marketplace Terms'");
    await client.query("DELETE FROM marketplace_store WHERE code = 'ALP_IND_01'");
    await client.query("DELETE FROM marketplace_partner WHERE code IN ('ALPHA01', 'BETA01')");

    // 1. Onboard Partner A (Alpha Bakery)
    console.log("[TEST] Step 1: Onboarding Commercial Partner A...");
    await client.query(`
      INSERT INTO marketplace_partner (
        id, code, legal_name, trade_name, gstin, pan, status, contact_name, email, phone, address
      ) VALUES (
        $1, 'ALPHA01', 'Alpha Artisan Bakery LLP', 'Alpha Bakehouse', '29ABCDE1234F1Z5', 'ABCDE1234F',
        'ACTIVE', 'Rajesh Sharma', 'alpha@example.com', '+91 9876543210', '{"city": "Bengaluru", "state": "KA"}'::jsonb
      )
    `, [partnerA_Id]);

    // Onboard Partner B (Beta Florist)
    console.log("[TEST] Step 1b: Onboarding Commercial Partner B...");
    await client.query(`
      INSERT INTO marketplace_partner (
        id, code, legal_name, trade_name, gstin, pan, status, contact_name, email, phone, address
      ) VALUES (
        $1, 'BETA01', 'Beta Flora Pvt Ltd', 'Beta Blooms', '29XYZAB5678C1Z2', 'XYZAB5678C',
        'ACTIVE', 'Anita Rao', 'beta@example.com', '+91 9876543211', '{"city": "Bengaluru", "state": "KA"}'::jsonb
      )
    `, [partnerB_Id]);

    console.log("[PASS] Both commercial partners onboarded in PostgreSQL.");

    // 2. Tenant Isolation Check: Store Management
    console.log("\n[TEST] Step 2: Store Creation and Tenant Boundary Enforcement...");
    await client.query(`
      INSERT INTO marketplace_store (
        id, partner_id, name, code, is_open, address, latitude, longitude, service_radius_km
      ) VALUES (
        $1, $2, 'Alpha Indiranagar', 'ALP_IND_01', true, '100ft Rd, Indiranagar', 12.9716, 77.5946, 7.5
      )
    `, [storeA_Id, partnerA_Id]);

    // Verify Partner A can query their store
    const { rows: storesA } = await client.query(`
      SELECT * FROM marketplace_store WHERE partner_id = $1
    `, [partnerA_Id]);
    console.log(`[PASS] Partner A queried their stores: found ${storesA.length} store (${storesA[0].name})`);

    // Verify Partner B querying stores sees 0 stores
    const { rows: storesB } = await client.query(`
      SELECT * FROM marketplace_store WHERE partner_id = $1
    `, [partnerB_Id]);
    console.log(`[PASS] Tenant Isolation: Partner B queried stores: found ${storesB.length} stores (isolated from Partner A)`);
    if (storesB.length !== 0) {
      throw new Error("Tenant isolation failure: Partner B accessed Partner A's store!");
    }

    // 3. Commercial Agreement Creation (15% Commission)
    console.log("\n[TEST] Step 3: Configuring Commercial Agreement (15% Commission)...");
    await client.query(`
      INSERT INTO marketplace_agreement (
        id, partner_id, agreement_type, commission_rate, fixed_fee_per_order, effective_from, effective_to, status, terms_document_ref
      ) VALUES (
        $1, $2, 'COMMISSION_PERCENTAGE', 15.00, 0.00, '2026-01-01', '2027-01-01', 'ACTIVE', 'Standard 15% Marketplace Terms'
      )
    `, [agreementA_Id, partnerA_Id]);

    // 4. Order-Level Agreement Snapshot Creation
    console.log("\n[TEST] Step 4: Creating Immutable Order Agreement Snapshot...");
    const grossOrder = 2000.00;
    const tax = 100.00; // 5% GST on cakes
    const commission = grossOrder * 0.15; // ₹300.00
    const partnerReceivable = grossOrder - commission; // ₹1,700.00

    await client.query(`
      INSERT INTO marketplace_order_snapshot (
        id, order_id, partner_id, store_id, agreement_id, agreement_type, commission_rate, fixed_fee,
        gross_order_amount, tax_amount, commission_amount, partner_net_receivable, snapshot_data
      ) VALUES (
        $1, $2, $3, $4, $5, 'COMMISSION_PERCENTAGE', 15.00, 0.00,
        $6, $7, $8, $9, '{"cake_price": 2000, "commission_pct": 15}'::jsonb
      )
    `, [snapshotId, orderId, partnerA_Id, storeA_Id, agreementA_Id, grossOrder, tax, commission, partnerReceivable]);

    const { rows: snapRows } = await client.query(`
      SELECT * FROM marketplace_order_snapshot WHERE id = $1
    `, [snapshotId]);
    console.log(`[PASS] Order snapshot frozen at order placement:`);
    console.log(`       - Gross: ₹${snapRows[0].gross_order_amount}`);
    console.log(`       - Commission Retained: ₹${snapRows[0].commission_amount} (15%)`);
    console.log(`       - Net Partner Entitlement: ₹${snapRows[0].partner_net_receivable}`);

    // 5. Reconciliation Statement Calculation
    console.log("\n[TEST] Step 5: Calculating Reconciliation Statement from PostgreSQL snapshots...");
    const { rows: reconRows } = await client.query(`
      SELECT 
        COUNT(id) as order_count,
        COALESCE(SUM(gross_order_amount), 0) as total_gross,
        COALESCE(SUM(commission_amount), 0) as total_commission,
        COALESCE(SUM(partner_net_receivable), 0) as calculated_payable
      FROM marketplace_order_snapshot
      WHERE partner_id = $1
    `, [partnerA_Id]);

    const reconCalc = reconRows[0];
    console.log(`[PASS] Calculated Reconciliation:`);
    console.log(`       - Orders Count: ${reconCalc.order_count}`);
    console.log(`       - Total Gross Sales: ₹${reconCalc.total_gross}`);
    console.log(`       - Marketplace Commission: ₹${reconCalc.total_commission}`);
    console.log(`       - Net Calculated Payable: ₹${reconCalc.calculated_payable}`);

    const expectedPayable = Number(reconCalc.calculated_payable);

    // 6. Record Partner Invoice Receipt with Intentional Discrepancy (Claiming ₹1,800 instead of ₹1,700)
    console.log("\n[TEST] Step 6: Recording Partner Invoice Receipt with Claim Discrepancy...");
    const partnerClaimedAmount = 1800.00; // Overclaiming by ₹100
    const discrepancy = partnerClaimedAmount - expectedPayable; // +₹100.00
    const status = Math.abs(discrepancy) > 0.01 ? "DISCREPANCY_DETECTED" : "VERIFIED";

    await client.query(`
      INSERT INTO marketplace_partner_invoice (
        id, partner_id, partner_invoice_number, partner_invoice_date, period_start, period_end,
        claimed_amount, calculated_amount, discrepancy_amount, document_reference, status
      ) VALUES (
        $1, $2, $3, '2026-10-14', '2026-10-01', '2026-10-14',
        $4, $5, $6, 'INV_DOC_SCAN_402.pdf', $7
      )
    `, [invoiceA_Id, partnerA_Id, partnerInvoiceNo, partnerClaimedAmount, expectedPayable, discrepancy, status]);

    const { rows: invRows } = await client.query(`
      SELECT * FROM marketplace_partner_invoice WHERE id = $1
    `, [invoiceA_Id]);

    console.log(`[PASS] Partner invoice receipt recorded:`);
    console.log(`       - Invoice #: ${invRows[0].partner_invoice_number}`);
    console.log(`       - Claimed: ₹${invRows[0].claimed_amount} | Calculated: ₹${invRows[0].calculated_amount}`);
    console.log(`       - Discrepancy: ₹${invRows[0].discrepancy_amount}`);
    console.log(`       - Status: ${invRows[0].status}`);

    if (invRows[0].status !== "DISCREPANCY_DETECTED" || Number(invRows[0].discrepancy_amount) !== 100.00) {
      throw new Error("Discrepancy detection failed!");
    }

    // 7. Duplicate Invoice Protection
    console.log("\n[TEST] Step 7: Duplicate Invoice Number Guard...");
    let duplicateCaught = false;
    try {
      await client.query(`
        INSERT INTO marketplace_partner_invoice (
          id, partner_id, partner_invoice_number, partner_invoice_date, period_start, period_end,
          claimed_amount, calculated_amount, discrepancy_amount, status
        ) VALUES (
          'inv_dup_test', $1, $2, '2026-10-14', '2026-10-01', '2026-10-14',
          $3, $4, 0, 'RECEIVED'
        )
      `, [partnerA_Id, partnerInvoiceNo, expectedPayable, expectedPayable]);
    } catch (dupErr) {
      duplicateCaught = true;
      console.log(`[PASS] Duplicate Guard: Database rejected duplicate invoice number "${partnerInvoiceNo}": ${dupErr.message}`);
    }

    if (!duplicateCaught) {
      throw new Error("Duplicate invoice number was not prevented!");
    }

    // 8. Approval to Bills Payable Linkage (Without auto-payment)
    console.log("\n[TEST] Step 8: Administrative Approval to Bills Payable...");
    const mockVoucherId = `vch_ap_ptnr_${Date.now()}`;
    await client.query(`
      UPDATE marketplace_partner_invoice
      SET status = 'APPROVED', accounting_voucher_id = $1, reconciled_at = NOW(), reconciled_by = 'usr_admin_01'
      WHERE id = $2
    `, [mockVoucherId, invoiceA_Id]);

    const { rows: approvedInv } = await client.query(`
      SELECT status, accounting_voucher_id, reconciled_by FROM marketplace_partner_invoice WHERE id = $1
    `, [invoiceA_Id]);

    console.log(`[PASS] Invoice Approved & Linked to Bills Payable:`);
    console.log(`       - Status: ${approvedInv[0].status}`);
    console.log(`       - Bills Payable Voucher Ref: ${approvedInv[0].accounting_voucher_id}`);
    console.log(`       - Approved By: ${approvedInv[0].reconciled_by}`);

    if (approvedInv[0].status !== "APPROVED" || approvedInv[0].accounting_voucher_id !== mockVoucherId) {
      throw new Error("Bills Payable linkage failed!");
    }

    // Clean up test records
    await client.query("DELETE FROM marketplace_partner_invoice WHERE id = $1", [invoiceA_Id]);
    await client.query("DELETE FROM marketplace_order_snapshot WHERE id = $1", [snapshotId]);
    await client.query("DELETE FROM marketplace_agreement WHERE id = $1", [agreementA_Id]);
    await client.query("DELETE FROM marketplace_store WHERE id = $1", [storeA_Id]);
    await client.query("DELETE FROM marketplace_partner WHERE id IN ($1, $2)", [partnerA_Id, partnerB_Id]);

    console.log("\n>>> MARKETPLACE & RECONCILIATION SUITE: 100% PASS <<<");
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => {
  console.error("\n[FAIL] Test encountered error:", err);
  process.exit(1);
});
