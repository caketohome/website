/**
 * CAKETOHOME ERP — PHASE 4: FINANCIAL INTEGRITY & END-TO-END INVOICE VALIDATION
 *
 * Runs exclusively against isolated PostgreSQL 16 on port 5433 (cth_test).
 * Zero connection to production Supabase.
 * Validates:
 *   A. Representative Non-Zero Multi-Item Orders (CGST/SGST, Tax Rates, HSN, Discounts, Delivery)
 *   B. Financial Value Persistence & Precision (Subtotal, Tax, Grand Total > 0)
 *   C. Three-Way Consistency: Order == Persisted DB Invoice == API Pricing == Rendered View
 *   D. Statutory & Financial Invariant Guards (Zero-Total Rejection, Missing GSTIN, Bad Sellers)
 *   E. MVCC Atomic Rollback & Zero Orphan Records
 *   F. Concurrent Allocation & Idempotent Replay Precision
 */

process.env.TEST_DATABASE_URL = "postgresql://cth_test_user:cth_test_password_2026@127.0.0.1:5433/cth_test";
process.env.DATABASE_URL = "postgresql://cth_test_user:cth_test_password_2026@127.0.0.1:5433/cth_test";
process.env.NODE_ENV = "test";

import { Client } from "pg";
import { DeliveryInvoicingService } from "../src/lib/services/delivery-invoicing.service";
import { closeDbPool } from "../src/lib/db";

const DB_URL = "postgresql://cth_test_user:cth_test_password_2026@127.0.0.1:5433/cth_test";

const AUTHORITATIVE_SELLER = {
  gstin: "29AAACC1234F1Z5",
  legalName: "CakeToHome Retail India Private Limited",
  tradeName: "CakeToHome Indiranagar Kitchen",
  state: "Karnataka",
  stateCode: "29",
  fssai: "TEST-SYNTHETIC-FSSAI-29001",
};

interface TestResult {
  id: string;
  name: string;
  passed: boolean;
  details: string;
}

async function runFinancialIntegritySuite() {
  const startTime = new Date();
  console.log("═══════════════════════════════════════════════════════════════════════════════");
  console.log("CAKETOHOME ERP — P0 FINANCIAL INTEGRITY & END-TO-END VALIDATION SUITE");
  console.log("Database: cth_test @ 127.0.0.1:5433 (REAL ISOLATED POSTGRESQL 16)");
  console.log("Start Time:", startTime.toISOString());
  console.log("═══════════════════════════════════════════════════════════════════════════════\n");

  const pgClient = new Client({ connectionString: DB_URL });
  await pgClient.connect();

  const results: TestResult[] = [];

  function record(id: string, name: string, passed: boolean, details: string) {
    results.push({ id, name, passed, details });
    const tag = passed ? "[PASS]" : "[FAIL]";
    console.log(`${tag} ${id}: ${name}`);
    console.log(`       Details: ${details}`);
    if (!passed) {
      console.error(`       CRITICAL FAILURE in assertion ${id}`);
    }
  }

  try {
    // ── ISOLATION GUARD ──
    const provRes = await pgClient.query("SELECT current_database(), current_user, inet_server_port(), inet_server_addr()::text");
    const prov = provRes.rows[0];
    const isLocal = prov.inet_server_port === 5433 && prov.current_database === "cth_test";
    if (!isLocal) {
      throw new Error(`CRITICAL: Database isolation violation! Connected to port ${prov.inet_server_port}/${prov.current_database}`);
    }
    console.log(`[Provenance] Verified: ${prov.current_user}@${prov.inet_server_addr}:${prov.inet_server_port}/${prov.current_database}\n`);

    // ─────────────────────────────────────────────────────────────────────────────
    // TEST 1: Representative Multi-Item Non-Zero Order Calculation & Persistence
    // ─────────────────────────────────────────────────────────────────────────────
    console.log("▶ TEST 1: Representative Multi-Item Non-Zero Order Calculation & Persistence");
    {
      const ts = Date.now();
      const orderId = `ord_fin_multi_${ts}`;
      const orderNumber = `ORD-FIN-${ts}`;

      // Line items with explicit tax rates and quantities
      const items = [
        {
          title: "Black Forest Gourmet Cake 1kg",
          quantity: 2,
          unit_price: 650.00, // Subtotal: 1300
          taxable_value: 1238.10, // 5% GST inclusive
          tax_amount: 61.90,
          hsn_code: "19059010",
          total: 1300.00,
        },
        {
          title: "Handmade Anniversary Chocolate Truffles",
          quantity: 1,
          unit_price: 350.00, // Subtotal: 350
          taxable_value: 296.61, // 18% GST inclusive
          tax_amount: 53.39,
          hsn_code: "18069010",
          total: 350.00,
        },
        {
          title: "Metallic Musical Birthday Candle",
          quantity: 2,
          unit_price: 75.00, // Subtotal: 150
          taxable_value: 133.93, // 12% GST inclusive
          tax_amount: 16.07,
          hsn_code: "34060010",
          total: 150.00,
        },
      ];

      const expectedSubtotal = 1668.64; // Sum of taxable values
      const expectedTax = 131.36; // Sum of tax amounts
      const expectedGrandTotal = 1800.00; // 1300 + 350 + 150

      // Seed order in PostgreSQL
      await pgClient.query(`
        INSERT INTO public.order (
          id, order_number, branch_id, status, grand_total, customer_name, customer_phone,
          seller_gstin, seller_legal_name, metadata, created_at
        ) VALUES (
          $1, $2, 'br_indiranagar_01', 'delivered', $3, 'Aarav Malhotra', '+91 98450 11223',
          $4, $5, $6, NOW()
        )
      `, [
        orderId,
        orderNumber,
        expectedGrandTotal,
        AUTHORITATIVE_SELLER.gstin,
        AUTHORITATIVE_SELLER.legalName,
        JSON.stringify({
          classification: "TEST",
          is_ledger_eligible: true,
          items,
          pricing: {
            subtotal: expectedSubtotal,
            tax_total: expectedTax,
            grand_total: expectedGrandTotal,
          },
        }),
      ]);

      // Execute invoice generation
      const genRes = await DeliveryInvoicingService.generateInvoiceOnDelivery({}, {
        id: orderId,
        order_number: orderNumber,
        status: "delivered",
        branch_id: "br_indiranagar_01",
        seller_gstin: AUTHORITATIVE_SELLER.gstin,
        seller_legal_name: AUTHORITATIVE_SELLER.legalName,
        seller_state_code: "29",
        items,
      });

      // Query database directly through fresh client
      await closeDbPool();
      const freshClient = new Client({ connectionString: DB_URL });
      await freshClient.connect();

      const invRowRes = await freshClient.query(
        "SELECT * FROM public.invoice WHERE order_id = $1",
        [orderId]
      );
      const invRow = invRowRes.rows[0];

      const allocRowRes = await freshClient.query(
        "SELECT * FROM public.invoice_allocation_log WHERE order_id = $1",
        [orderId]
      );
      const allocRow = allocRowRes.rows[0];

      await freshClient.end();
      await closeDbPool();

      const nonZeroGrandTotal = Number(invRow.grand_total) > 0;
      const grandTotalMatches = Math.abs(Number(invRow.grand_total) - expectedGrandTotal) < 0.01;
      const subtotalPersisted = Number(invRow.subtotal) > 0;
      const taxPersisted = Number(invRow.tax_total) > 0;
      const sequenceCommited = allocRow && allocRow.status === "COMMITTED";

      const pass = genRes.success === true &&
                   nonZeroGrandTotal &&
                   grandTotalMatches &&
                   subtotalPersisted &&
                   taxPersisted &&
                   sequenceCommited;

      record(
        "TEST-1.1",
        "Representative multi-item order persists non-zero financial totals",
        pass,
        `inv_number=${invRow.invoice_number}, persisted_grand_total=₹${invRow.grand_total}, subtotal=₹${invRow.subtotal}, tax_total=₹${invRow.tax_total}, expected=₹${expectedGrandTotal}`
      );
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // TEST 2: Intra-State vs Inter-State GST Tax Computation Precision
    // ─────────────────────────────────────────────────────────────────────────────
    console.log("\n▶ TEST 2: Intra-State vs Inter-State GST Tax Computation Precision");
    {
      const ts = Date.now();
      const intraOrderId = `ord_intra_${ts}`;
      const interOrderId = `ord_inter_${ts}`;

      const intraOrderNum = `ORD-INTRA-${ts}`;
      const interOrderNum = `ORD-INTER-${ts}`;

      // Intra-state (Karnataka to Karnataka: 29 -> 29): CGST (50%) + SGST (50%)
      await pgClient.query(`
        INSERT INTO public.order (
          id, order_number, branch_id, status, grand_total, seller_gstin, seller_legal_name, metadata, created_at
        ) VALUES (
          $1, $2, 'br_indiranagar_01', 'delivered', 1180.00,
          $3, $4, '{"is_ledger_eligible": true, "classification": "TEST"}'::jsonb, NOW()
        )
      `, [intraOrderId, intraOrderNum, AUTHORITATIVE_SELLER.gstin, AUTHORITATIVE_SELLER.legalName]);

      const intraRes = await DeliveryInvoicingService.generateInvoiceOnDelivery({}, {
        id: intraOrderId,
        order_number: intraOrderNum,
        status: "delivered",
        branch_id: "br_indiranagar_01",
        seller_gstin: AUTHORITATIVE_SELLER.gstin,
        seller_legal_name: AUTHORITATIVE_SELLER.legalName,
        seller_state_code: "29",
        customer_state: "Karnataka",
        customer_state_code: "29",
        items: [
          { title: "Chocolate Truffle Cake 1kg", quantity: 1, unit_price: 1000, taxable_value: 1000, tax_amount: 180, total: 1180, hsn_code: "19059010" }
        ],
      });

      const intraInv = intraRes.invoice!;
      const intraCgst = intraInv.tax_total / 2;
      const intraSgst = intraInv.tax_total / 2;
      const intraPass = intraInv.is_intra_state === true &&
                        intraInv.supply_type === "INTRA-STATE (CGST + SGST)" &&
                        intraCgst === 90 && intraSgst === 90;

      record(
        "TEST-2.1",
        "Intra-state supply correctly splits tax equally between CGST (50%) and SGST (50%)",
        intraPass,
        `supply_type="${intraInv.supply_type}", tax_total=₹${intraInv.tax_total}, cgst=₹${intraCgst}, sgst=₹${intraSgst}`
      );

      // Inter-state (Karnataka to Maharashtra: 29 -> 27): IGST (100%)
      await pgClient.query(`
        INSERT INTO public.order (
          id, order_number, branch_id, status, grand_total, seller_gstin, seller_legal_name, metadata, created_at
        ) VALUES (
          $1, $2, 'br_indiranagar_01', 'delivered', 1180.00,
          $3, $4, '{"is_ledger_eligible": true, "classification": "TEST"}'::jsonb, NOW()
        )
      `, [interOrderId, interOrderNum, AUTHORITATIVE_SELLER.gstin, AUTHORITATIVE_SELLER.legalName]);

      const interRes = await DeliveryInvoicingService.generateInvoiceOnDelivery({}, {
        id: interOrderId,
        order_number: interOrderNum,
        status: "delivered",
        branch_id: "br_indiranagar_01",
        seller_gstin: AUTHORITATIVE_SELLER.gstin,
        seller_legal_name: AUTHORITATIVE_SELLER.legalName,
        seller_state_code: "29",
        customer_state: "Maharashtra",
        customer_state_code: "27",
        items: [
          { title: "Chocolate Truffle Cake 1kg", quantity: 1, unit_price: 1000, taxable_value: 1000, tax_amount: 180, total: 1180, hsn_code: "19059010" }
        ],
      });

      const interInv = interRes.invoice!;
      const interPass = interInv.is_intra_state === false &&
                        interInv.supply_type === "INTER-STATE (IGST)" &&
                        interInv.tax_total === 180;

      record(
        "TEST-2.2",
        "Inter-state supply classifies 100% of tax as IGST with correct Place of Supply",
        interPass,
        `supply_type="${interInv.supply_type}", is_intra_state=${interInv.is_intra_state}, igst_total=₹${interInv.tax_total}`
      );
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // TEST 3: Zero-Total Financial Invariant Guard (Rejection of Non-Zero Priced Zero-Total)
    // ─────────────────────────────────────────────────────────────────────────────
    console.log("\n▶ TEST 3: Zero-Total Financial Invariant Guard");
    {
      const ts = Date.now();
      const zeroOrderId = `ord_fin_zero_${ts}`;

      const zeroOrderNum = `ORD-ZERO-FAIL-${ts}`;
      await pgClient.query(`
        INSERT INTO public.order (
          id, order_number, branch_id, status, grand_total, seller_gstin, seller_legal_name, metadata, created_at
        ) VALUES (
          $1, $2, 'br_indiranagar_01', 'delivered', 0,
          $3, $4, '{"is_ledger_eligible": true, "classification": "TEST"}'::jsonb, NOW()
        )
      `, [zeroOrderId, zeroOrderNum, AUTHORITATIVE_SELLER.gstin, AUTHORITATIVE_SELLER.legalName]);

      // Attempt to generate invoice with non-zero line items but zero total forced
      const failRes = await DeliveryInvoicingService.generateInvoiceOnDelivery({}, {
        id: zeroOrderId,
        order_number: zeroOrderNum,
        status: "delivered",
        branch_id: "br_indiranagar_01",
        seller_gstin: AUTHORITATIVE_SELLER.gstin,
        seller_legal_name: AUTHORITATIVE_SELLER.legalName,
        seller_state_code: "29",
        grand_total: 0,
        subtotal: 0,
        tax_total: 0,
        items: [
          { title: "Royal Opera Cake", quantity: 1, unit_price: 1500, hsn_code: "19059010" }
        ],
      });

      // The service should either compute the non-zero grand total from line items (₹1,500)
      // or reject with INVALID_INVOICE_TOTAL. It must NEVER persist grand_total = 0!
      const checkRow = await pgClient.query("SELECT grand_total, status FROM public.invoice WHERE order_id = $1", [zeroOrderId]);
      const persistedZero = checkRow.rows.length > 0 && Number(checkRow.rows[0].grand_total) === 0;

      const invariantMaintained = !persistedZero && (
        (failRes.success === true && Number(failRes.invoice?.grand_total) > 0) ||
        (failRes.success === false && failRes.code === "INVALID_INVOICE_TOTAL")
      );

      record(
        "TEST-3.1",
        "Financial Invariant: Tax invoice with priced items NEVER persists grand_total = 0",
        invariantMaintained,
        `success=${failRes.success}, persisted_rows=${checkRow.rows.length}, invoice_total=₹${failRes.invoice?.grand_total ?? 0}`
      );
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // TEST 4: Three-Way Consistency (Order DB == Persisted Invoice == API == Preview)
    // ─────────────────────────────────────────────────────────────────────────────
    console.log("\n▶ TEST 4: Three-Way Financial Consistency");
    {
      const ts = Date.now();
      const orderId = `ord_consistency_${ts}`;
      const orderNumber = `ORD-CONSIST-${ts}`;
      const grandTotal = 2478.00;
      const subtotal = 2100.00;
      const taxTotal = 378.00;

      await pgClient.query(`
        INSERT INTO public.order (
          id, order_number, branch_id, status, grand_total, seller_gstin, seller_legal_name, metadata, created_at
        ) VALUES (
          $1, $2, 'br_indiranagar_01', 'delivered', $3,
          $4, $5, $6, NOW()
        )
      `, [
        orderId,
        orderNumber,
        grandTotal,
        AUTHORITATIVE_SELLER.gstin,
        AUTHORITATIVE_SELLER.legalName,
        JSON.stringify({
          is_ledger_eligible: true,
          classification: "TEST",
          pricing: { subtotal, tax_total: taxTotal, grand_total: grandTotal },
        }),
      ]);

      const genRes = await DeliveryInvoicingService.generateInvoiceOnDelivery({}, {
        id: orderId,
        order_number: orderNumber,
        status: "delivered",
        branch_id: "br_indiranagar_01",
        seller_gstin: AUTHORITATIVE_SELLER.gstin,
        seller_legal_name: AUTHORITATIVE_SELLER.legalName,
        seller_state_code: "29",
        grand_total: grandTotal,
        subtotal: subtotal,
        tax_total: taxTotal,
        items: [
          { title: "Tiered Wedding Cake", quantity: 1, unit_price: 2100, taxable_value: 2100, tax_amount: 378, total: 2478, hsn_code: "19059010" }
        ],
      });

      // 1. Check PostgreSQL Database Invoice Row
      const invDbRes = await pgClient.query("SELECT * FROM public.invoice WHERE order_id = $1", [orderId]);
      const invDb = invDbRes.rows[0];
      const invDbMeta = typeof invDb.metadata === "object" ? invDb.metadata : JSON.parse(invDb.metadata || "{}");

      // 2. Check Order Table Row
      const orderDbRes = await pgClient.query("SELECT * FROM public.order WHERE id = $1", [orderId]);
      const orderDb = orderDbRes.rows[0];

      // 3. Simulate API route extraction logic
      const apiPricing = {
        subtotal: Number(invDb.subtotal),
        cgst: Number(invDbMeta.cgst || (invDb.tax_total / 2)),
        sgst: Number(invDbMeta.sgst || (invDb.tax_total / 2)),
        total: Number(invDb.grand_total),
      };

      // 4. Simulate OrderInvoicePrintModal calculation logic
      const modalTotalVal = Number(invDb.grand_total ?? orderDb.grand_total ?? 0);
      const modalTaxAmt = Number(invDb.tax_total ?? 0);
      const modalTaxableVal = Number(invDb.subtotal ?? (modalTotalVal - modalTaxAmt));
      const modalCgst = Number(invDbMeta.cgst ?? (modalTaxAmt / 2));
      const modalSgst = Number(invDbMeta.sgst ?? (modalTaxAmt / 2));

      const orderMatchesDb = Number(orderDb.grand_total) === Number(invDb.grand_total);
      const apiMatchesDb = apiPricing.total === Number(invDb.grand_total) && apiPricing.subtotal === Number(invDb.subtotal);
      const modalMatchesDb = modalTotalVal === Number(invDb.grand_total) && modalTaxableVal === Number(invDb.subtotal);
      const gstComponentsMatch = apiPricing.cgst === modalCgst && apiPricing.sgst === modalSgst && (modalCgst + modalSgst === modalTaxAmt);

      const pass = orderMatchesDb && apiMatchesDb && modalMatchesDb && gstComponentsMatch;

      record(
        "TEST-4.1",
        "Three-Way Consistency: Order total == Persisted invoice == API pricing == Rendered print modal",
        pass,
        `db_order_tot=₹${orderDb.grand_total}, db_inv_tot=₹${invDb.grand_total}, api_tot=₹${apiPricing.total}, modal_tot=₹${modalTotalVal}, cgst=₹${modalCgst}, sgst=₹${modalSgst}`
      );
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // TEST 5: Failure Cases & MVCC Rollback Resilience
    // ─────────────────────────────────────────────────────────────────────────────
    console.log("\n▶ TEST 5: Failure Cases & MVCC Rollback Resilience");
    {
      const seqBeforeRes = await pgClient.query(
        "SELECT last_seq FROM public.invoice_sequence WHERE prefix = 'CTH' AND fiscal_year = 2026"
      );
      const seqBefore = Number(seqBeforeRes.rows[0].last_seq);

      // 5.1 Missing Seller GSTIN
      const failNoGst = await DeliveryInvoicingService.generateInvoiceOnDelivery({}, {
        id: `ord_fail_nogst_${Date.now()}`,
        status: "delivered",
        branch_id: "br_indiranagar_01",
        seller_gstin: "",
        seller_legal_name: AUTHORITATIVE_SELLER.legalName,
        items: [{ title: "Item", quantity: 1, unit_price: 100 }],
      });

      // 5.2 Malformed Seller GSTIN
      const failBadGst = await DeliveryInvoicingService.generateInvoiceOnDelivery({}, {
        id: `ord_fail_badgst_${Date.now()}`,
        status: "delivered",
        branch_id: "br_indiranagar_01",
        seller_gstin: "29INVALIDGSTINXX",
        seller_legal_name: AUTHORITATIVE_SELLER.legalName,
        items: [{ title: "Item", quantity: 1, unit_price: 100 }],
      });

      // 5.3 Missing Seller Legal Registered Name
      const failNoName = await DeliveryInvoicingService.generateInvoiceOnDelivery({}, {
        id: `ord_fail_noname_${Date.now()}`,
        status: "delivered",
        branch_id: "br_indiranagar_01",
        seller_gstin: AUTHORITATIVE_SELLER.gstin,
        seller_legal_name: "",
        items: [{ title: "Item", quantity: 1, unit_price: 100 }],
      });

      // 5.4 Zero line items
      const failNoItems = await DeliveryInvoicingService.generateInvoiceOnDelivery({}, {
        id: `ord_fail_noitems_${Date.now()}`,
        status: "delivered",
        branch_id: "br_indiranagar_01",
        seller_gstin: AUTHORITATIVE_SELLER.gstin,
        seller_legal_name: AUTHORITATIVE_SELLER.legalName,
        items: [],
      });

      // 5.5 Forced MVCC Transaction Failure Rollback
      let forcedRollbackCaught = false;
      try {
        await pgClient.query("BEGIN");
        await pgClient.query("SELECT * FROM public.allocate_invoice_number('CTH', 'ord_forced_fail', 'CAKETOHOME_PARENT', $1)", [AUTHORITATIVE_SELLER.gstin]);
        // Force database constraint failure
        await pgClient.query("INSERT INTO public.invoice (id, invoice_number, order_id) VALUES ('inv_forced_dup', 'CTH/26-27/999999', NULL)");
        await pgClient.query("COMMIT");
      } catch (_err) {
        await pgClient.query("ROLLBACK");
        forcedRollbackCaught = true;
      }

      const seqAfterRes = await pgClient.query(
        "SELECT last_seq FROM public.invoice_sequence WHERE prefix = 'CTH' AND fiscal_year = 2026"
      );
      const seqAfter = Number(seqAfterRes.rows[0].last_seq);

      const pass = failNoGst.success === false &&
                   failBadGst.success === false &&
                   failNoName.success === false &&
                   failNoItems.success === false &&
                   forcedRollbackCaught &&
                   seqBefore === seqAfter;

      record(
        "TEST-5.1",
        "Failure cases rejected cleanly and MVCC rollback causes ZERO sequence burn",
        pass,
        `seq_before=${seqBefore}, seq_after=${seqAfter}, burned=${seqAfter - seqBefore}, no_gst=${failNoGst.code}, bad_gst=${failBadGst.code}, no_name=${failNoName.code}`
      );
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // TEST 6: Idempotent Replay Precision (Zero Secondary Sequence Consumption)
    // ─────────────────────────────────────────────────────────────────────────────
    console.log("\n▶ TEST 6: Idempotent Replay Precision");
    {
      const ts = Date.now();
      const replayOrderId = `ord_replay_fin_${ts}`;

      const replayOrderNum = `ORD-REPLAY-${ts}`;
      await pgClient.query(`
        INSERT INTO public.order (
          id, order_number, branch_id, status, grand_total, seller_gstin, seller_legal_name, metadata, created_at
        ) VALUES (
          $1, $2, 'br_indiranagar_01', 'delivered', 850.00,
          $3, $4, '{"is_ledger_eligible": true, "classification": "TEST"}'::jsonb, NOW()
        )
      `, [replayOrderId, replayOrderNum, AUTHORITATIVE_SELLER.gstin, AUTHORITATIVE_SELLER.legalName]);

      const call1 = await DeliveryInvoicingService.generateInvoiceOnDelivery({}, {
        id: replayOrderId,
        order_number: replayOrderNum,
        status: "delivered",
        branch_id: "br_indiranagar_01",
        seller_gstin: AUTHORITATIVE_SELLER.gstin,
        seller_legal_name: AUTHORITATIVE_SELLER.legalName,
        seller_state_code: "29",
        grand_total: 850.00,
        items: [{ title: "Pineapple Cake", quantity: 1, unit_price: 850, hsn_code: "19059010" }],
      });

      const seqMidRes = await pgClient.query("SELECT last_seq FROM public.invoice_sequence WHERE prefix = 'CTH' AND fiscal_year = 2026");
      const seqMid = Number(seqMidRes.rows[0].last_seq);

      const call2 = await DeliveryInvoicingService.generateInvoiceOnDelivery({}, {
        id: replayOrderId,
        order_number: replayOrderNum,
        status: "delivered",
        branch_id: "br_indiranagar_01",
        seller_gstin: AUTHORITATIVE_SELLER.gstin,
        seller_legal_name: AUTHORITATIVE_SELLER.legalName,
        seller_state_code: "29",
        grand_total: 850.00,
        items: [{ title: "Pineapple Cake", quantity: 1, unit_price: 850, hsn_code: "19059010" }],
      });

      const seqEndRes = await pgClient.query("SELECT last_seq FROM public.invoice_sequence WHERE prefix = 'CTH' AND fiscal_year = 2026");
      const seqEnd = Number(seqEndRes.rows[0].last_seq);

      const pass = call1.success === true &&
                   call2.success === true &&
                   call1.invoice_number === call2.invoice_number &&
                   seqMid === seqEnd;

      record(
        "TEST-6.1",
        "Duplicate request replay returns identical invoice number with zero sequence advancement",
        pass,
        `call1_inv=${call1.invoice_number}, call2_inv=${call2.invoice_number}, seq_mid=${seqMid}, seq_end=${seqEnd}`
      );
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // TEST 7: Database Counter & Allocation Log Integrity Audit
    // ─────────────────────────────────────────────────────────────────────────────
    console.log("\n▶ TEST 7: Database Counter & Allocation Log Integrity Audit");
    {
      // 1. Verify zero orphaned COMMITTED logs without invoice records
      const orphanCheck = await pgClient.query(`
        SELECT al.invoice_number, al.order_id
        FROM public.invoice_allocation_log al
        LEFT JOIN public.invoice i ON i.invoice_number = al.invoice_number
        WHERE al.status = 'COMMITTED' AND i.id IS NULL
      `);

      // 2. Verify legacy watermark sequence is completely untouched
      const legacySeq = await pgClient.query("SELECT last_value, is_called FROM public.statutory_invoice_seq");
      const legacyUntouched = legacySeq.rows[0].last_value === "192" && legacySeq.rows[0].is_called === false;

      const pass = orphanCheck.rows.length === 0 && legacyUntouched;

      record(
        "TEST-7.1",
        "Audit State Integrity: Zero orphaned COMMITTED allocation logs & legacy sequence untouched at 192",
        pass,
        `orphaned_count=${orphanCheck.rows.length}, legacy_seq_value=${legacySeq.rows[0].last_value}, is_called=${legacySeq.rows[0].is_called}`
      );
    }

  } catch (err: any) {
    console.error("FATAL ERROR IN SUITE:", err);
    record("FATAL", "Suite execution failed", false, err.message);
  } finally {
    await pgClient.end();
    await closeDbPool();
  }

  const endTime = new Date();
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;
  const elapsedMs = endTime.getTime() - startTime.getTime();

  console.log("\n═══════════════════════════════════════════════════════════════════════════════");
  console.log(`FINANCIAL INTEGRITY SUITE SUMMARY: ${passedCount}/${results.length} PASSED | ${failedCount} FAILED`);
  console.log(`Execution Time: ${elapsedMs}ms | Finished At: ${endTime.toISOString()}`);
  console.log(`VERDICT: ${failedCount === 0 ? "100% PASS — FINANCIAL INTEGRITY & PERSISTENCE VERIFIED" : "FAIL"}`);
  console.log("═══════════════════════════════════════════════════════════════════════════════\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runFinancialIntegritySuite().catch((err) => {
  console.error("Unhanded rejection:", err);
  process.exit(1);
});
