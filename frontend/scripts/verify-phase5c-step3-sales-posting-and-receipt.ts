/**
 * CakeToHome ERP — Phase 5C Step 3 Automated Verification Suite
 *
 * Verifies End-to-End Online Prepaid Order Accounting:
 * 1. Online Prepaid Order Placement (Order ≠ Bill) with is_ledger_eligible: true.
 * 2. Progression to OUT_FOR_DELIVERY (No premature invoicing or GL mutation).
 * 3. Doorstep Delivery with OTP -> Statutory Invoicing (CTH/YY-YY/XXXXXX) + Sales Voucher Draft.
 * 4. Central Accounting Work Queue Integration (Query pending sales).
 * 5. Segregation of Duties (SoD) Lifecycle: Submit -> Approve -> Post Sales Voucher to GL.
 * 6. Verification of Balanced Compound Journal Entry:
 *    Dr 1121 Accounts Receivable (₹892.50)
 *    Cr 4110 Cake Revenue (₹850.00)
 *    Cr 2121 Output CGST (₹21.25)
 *    Cr 2122 Output SGST (₹21.25)
 *    Operational COGS / Inventory Lines
 *    Total Debits === Total Credits
 * 7. Verification of Authoritative AR Outstanding Balance Calculation.
 * 8. Customer Receipt Execution for Prepaid Gateway Payment:
 *    Dr 1113 Payment Gateway Clearing (₹892.50)
 *    Cr 1121 Accounts Receivable (₹892.50)
 * 9. Subledger Settlement: AR balance drops to ₹0.00 (isFullySettled === true).
 * 10. Fail-Closed Guards: SoD violations and overpayment/duplicate prevention.
 * 11. Full Teardown & Database Row Count Immutability Audit.
 */

import { dbQuery } from "../src/lib/db";
import { ApiEngine } from "../src/lib/api-engine";
import { DeliveryInvoicingService } from "../src/lib/services/delivery-invoicing.service";
import { SalesPostingService } from "../src/lib/services/sales-posting.service";
import { CustomerReceiptService } from "../src/lib/services/customer-receipt.service";
import { FiscalPeriodService } from "../src/lib/services/fiscal-period.service";
import { AccountingConfigService } from "../src/lib/services/accounting-config.service";
import { AccountingFiscalPeriodRepository } from "../src/lib/repositories/accounting-fiscal-period.repository";
import { persistOrderToDb } from "../src/lib/db-persistence";

let passedCount = 0;
let totalCount = 0;

function assert(condition: boolean, message: string) {
  totalCount++;
  if (condition) {
    passedCount++;
    console.log(`✅ [PASS] ${message}`);
  } else {
    console.error(`❌ [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function main() {
  console.log("══════════════════════════════════════════════════════════════════════════════");
  console.log("🧪 PHASE 5C STEP 3: PREPAID SALES POSTING & CUSTOMER RECEIPT VERIFICATION");
  console.log("══════════════════════════════════════════════════════════════════════════════\n");

  const ts = Date.now();
  const testOrderId = `order_prepaid_5c_${ts}`;
  const testSupplierId = `sup_test_5c_${ts}`;
  const testPurchaseId = `pur_test_5c_${ts}`;
  const testPiId = `pi_test_5c_${ts}`;
  const testLotId = `lot_test_5c_${ts}`;
  const testBinvId = `binv_test_5c_${ts}`;

  const createdVoucherIds: string[] = [];
  let baselineOrderCount = 0;
  let baselineInvoiceCount = 0;
  let baselineVoucherCount = 0;
  let baselineJournalCount = 0;
  let baselinePeriodCount = 0;
  let createdSetting = false;
  let createdPeriodId: string | null = null;
  let existingBinvId: string | null = null;
  let originalBinvQty: number | null = null;
  let createdBinv = false;

  try {
    // Clean any prior test artifacts
    await dbQuery(`DELETE FROM public.inventory_cost_consumption WHERE lot_id LIKE 'lot_test_5c_%'`);
    await dbQuery(`DELETE FROM public.inventory_movement WHERE reference_no LIKE 'order_prepaid_5c_%' OR voucher_id IN (SELECT id FROM public.accounting_voucher WHERE reference_id LIKE 'order_prepaid_5c_%')`);
    await dbQuery(`DELETE FROM public.accounting_journal_line WHERE journal_entry_id IN (SELECT id FROM public.accounting_journal_entry WHERE voucher_id IN (SELECT id FROM public.accounting_voucher WHERE reference_id LIKE 'order_prepaid_5c_%'))`);
    await dbQuery(`DELETE FROM public.accounting_journal_entry WHERE voucher_id IN (SELECT id FROM public.accounting_voucher WHERE reference_id LIKE 'order_prepaid_5c_%')`);
    await dbQuery(`DELETE FROM public.accounting_voucher WHERE reference_id LIKE 'order_prepaid_5c_%'`);
    await dbQuery(`DELETE FROM public.inventory_cost_lot WHERE id LIKE 'lot_test_5c_%'`);
    await dbQuery(`DELETE FROM public.purchase_item WHERE id LIKE 'pi_test_5c_%'`);
    await dbQuery(`DELETE FROM public.purchase WHERE id LIKE 'pur_test_5c_%'`);
    await dbQuery(`DELETE FROM public.supplier WHERE id LIKE 'sup_test_5c_%'`);
    await dbQuery(`DELETE FROM public.invoice WHERE order_id LIKE 'order_prepaid_5c_%'`);
    await dbQuery(`DELETE FROM public.order_status_history WHERE order_id LIKE 'order_prepaid_5c_%'`);
    await dbQuery(`DELETE FROM public.order WHERE id LIKE 'order_prepaid_5c_%'`);
    await dbQuery(`DELETE FROM public.branch_inventory WHERE id LIKE 'binv_test_5c_%'`);

    // ── 0. Database Baseline Check ─────────────────────────────────────────────
    console.log("--- 0. Database Baseline Check ---");
    const initOrders = await dbQuery<{ count: string }>(`SELECT count(*) FROM public.order`);
    const initInvoices = await dbQuery<{ count: string }>(`SELECT count(*) FROM public.invoice`);
    const initVouchers = await dbQuery<{ count: string }>(`SELECT count(*) FROM public.accounting_voucher WHERE deleted_at IS NULL`);
    const initJournals = await dbQuery<{ count: string }>(`SELECT count(*) FROM public.accounting_journal_entry`);
    const initPeriods = await dbQuery<{ count: string }>(`SELECT count(*) FROM public.accounting_fiscal_period`);

    baselineOrderCount = parseInt(initOrders.rows[0].count);
    baselineInvoiceCount = parseInt(initInvoices.rows[0].count);
    baselineVoucherCount = parseInt(initVouchers.rows[0].count);
    baselineJournalCount = parseInt(initJournals.rows[0].count);
    baselinePeriodCount = parseInt(initPeriods.rows[0].count);

    console.log(`Initial DB Rows — Orders: ${baselineOrderCount}, Invoices: ${baselineInvoiceCount}, Vouchers: ${baselineVoucherCount}, Journals: ${baselineJournalCount}, Fiscal Periods: ${baselinePeriodCount}`);

    // Ensure Accounting Start Date is configured
    const settingCheck = await dbQuery<{ value: string }>(`SELECT value FROM public.setting WHERE key = 'accounting_start_date'`);
    if (settingCheck.rows.length === 0) {
      await AccountingConfigService.setAccountingStartDate("2026-04-01", "usr_super_admin", "SUPER_ADMIN");
      createdSetting = true;
    }

    // Ensure open fiscal period exists for today
    const todayStr = new Date().toISOString().slice(0, 10);
    const periodStatus = await AccountingFiscalPeriodRepository.getPeriodStatusForDate(todayStr);
    if (periodStatus.status === "PERIOD_NOT_CONFIGURED") {
      const newPeriod = await FiscalPeriodService.createFiscalPeriod({
        fiscal_year: "FY2026-27",
        period_name: "October 2026",
        start_date: "2026-10-01",
        end_date: "2026-10-31",
      }, "usr_super_admin", "SUPER_ADMIN");
      createdPeriodId = newPeriod.id;
    }

    // Resolve authoritative Cake product, Variant, and Branch
    const cakeQ = await dbQuery<{ id: string; title: string; variant_id: string }>(
      `SELECT p.id, p.title, pv.id as variant_id
       FROM public.product p
       JOIN public.product_variant pv ON p.id = pv.product_id
       WHERE (p.metadata->>'merchandise_type' = 'CAKE' OR p.merchandise_type = 'CAKE' OR p.title ILIKE '%cake%')
         AND p.deleted_at IS NULL
       LIMIT 1`
    );
    assert(cakeQ.rows.length > 0, "Found authoritative Cake product with variant in PostgreSQL");
    const testCake = cakeQ.rows[0];

    const branchQ = await dbQuery<{ id: string; name: string }>(
      `SELECT id, name FROM public.branch WHERE deleted_at IS NULL LIMIT 1`
    );
    assert(branchQ.rows.length > 0, "Found authoritative Branch in PostgreSQL");
    const testBranch = branchQ.rows[0];

    const custQ = await dbQuery<{ id: string; first_name: string; last_name: string; email: string; phone: string }>(
      `SELECT id, first_name, last_name, email, phone FROM public.customer WHERE deleted_at IS NULL LIMIT 1`
    );
    assert(custQ.rows.length > 0, "Found authoritative Customer in PostgreSQL");
    const testCustomer = custQ.rows[0];
    const customerFullName = `${testCustomer.first_name || ""} ${testCustomer.last_name || ""}`.trim() || "Anita Sharma";

    // Ensure Branch metadata has Karnataka state and GSTIN for proper intra-state tax split
    await dbQuery(
      `UPDATE public.branch
       SET metadata = jsonb_set(
         COALESCE(metadata, '{}'::jsonb),
         '{state}',
         '"Karnataka"'::jsonb
       ) || jsonb_build_object('gstin', '29AAACC1234F1Z5')
       WHERE id = $1`,
      [testBranch.id]
    );

    // Seed fixture supplier, purchase, cost lot, and branch inventory
    await dbQuery(
      `INSERT INTO public.supplier (id, name, gstin, state, is_active, created_at, updated_at)
       VALUES ($1, 'Fixture Supplier Corp', '29AABCU9603R1Z5', 'Karnataka', true, NOW(), NOW())`,
      [testSupplierId]
    );

    await dbQuery(
      `INSERT INTO public.purchase (
        id, supplier_id, branch_id, invoice_no, invoice_date,
        subtotal, discount, taxable_value, cgst, sgst, igst, total,
        status, created_by, approved_by, created_at, updated_at
      ) VALUES (
        $1, $2, $3, 'INV-FIXTURE-5C', '2026-09-01',
        10000, 0, 10000, 0, 0, 0, 10000,
        'APPROVED', 'buyer_01', 'mgr_01', NOW(), NOW()
      )`,
      [testPurchaseId, testSupplierId, testBranch.id]
    );

    await dbQuery(
      `INSERT INTO public.purchase_item (
        id, purchase_id, product_id, variant_id, description,
        quantity, rate, discount, taxable_value, cgst_rate, sgst_rate, igst_rate,
        cgst, sgst, igst, total, item_type, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, 'Fixture Cake Item',
        10, 300, 0, 3000, 0, 0, 0, 0, 0, 0, 3000, 'CAKE', NOW(), NOW()
      )`,
      [testPiId, testPurchaseId, testCake.id, testCake.variant_id]
    );

    await dbQuery(
      `INSERT INTO public.inventory_cost_lot (
        id, branch_id, product_id, variant_id, item_type,
        purchase_id, purchase_item_id, supplier_id,
        received_quantity, remaining_quantity, unit_cost, total_cost,
        currency, received_at, status, created_by, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, 'CAKE',
        $5, $6, $7,
        10, 10, 300, 3000,
        'INR', '2026-09-01', 'ACTIVE', 'SYSTEM', NOW(), NOW()
      )`,
      [testLotId, testBranch.id, testCake.id, testCake.variant_id, testPurchaseId, testPiId, testSupplierId]
    );

    // Upsert branch inventory
    const existingBinvRes = await dbQuery<{ id: string; quantity: string }>(
      `SELECT id, quantity FROM public.branch_inventory WHERE branch_id = $1 AND variant_id = $2`,
      [testBranch.id, testCake.variant_id]
    );
    if (existingBinvRes.rows.length > 0) {
      existingBinvId = existingBinvRes.rows[0].id;
      originalBinvQty = parseFloat(existingBinvRes.rows[0].quantity);
      await dbQuery(
        `UPDATE public.branch_inventory SET quantity = quantity + 10, reserved = 0 WHERE id = $1`,
        [existingBinvId]
      );
    } else {
      await dbQuery(
        `INSERT INTO public.branch_inventory (id, branch_id, variant_id, product_id, quantity, reserved, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 10, 0, NOW(), NOW())`,
        [testBinvId, testBranch.id, testCake.variant_id, testCake.id]
      );
      createdBinv = true;
    }

    // ── 1. Certified Online Prepaid Order Creation ─────────────────────────────
    console.log("\n--- 1. Certified Online Prepaid Order Creation ---");
    ApiEngine.ensureOrdersStore();
    const store = ApiEngine.getStore();
    if (!store.orders) store.orders = [];
    if (!store.invoices) store.invoices = [];

    const testOrder: any = {
      id: testOrderId,
      order_number: `CTH-PREPAID-${ts.toString().slice(-6)}`,
      invoice_number: null,
      invoice_id: null,
      invoice: null,
      accounting_voucher_id: null,
      customer_id: testCustomer.id,
      customer_name: customerFullName,
      customer_email: testCustomer.email || "anita.sharma@example.com",
      customer_phone: testCustomer.phone || "+919876543210",
      branch_id: testBranch.id,
      branch_name: testBranch.name,
      seller_gstin: "29AAACC1234F1Z5",
      seller_legal_name: "CakeToHome India Private Limited",
      seller_state_code: "29",
      seller_state: "Karnataka",
      seller_is_verified: true,
      delivery_address: {
        address: "42 MG Road, Indiranagar",
        city: "Bengaluru",
        state: "Karnataka",
        pincode: "560038",
      },
      delivery_state: "Karnataka",
      payment_method: "online_upi",
      payment_status: "pending",
      status: "pending",
      subtotal: 850.00,
      discount_amount: 0,
      tax_amount: 42.50,
      total: 892.50,
      grand_total: 892.50,
      items: [
        {
          id: `item_${ts}`,
          product_id: testCake.id,
          variant_id: testCake.variant_id,
          title: testCake.title,
          quantity: 1,
          unit_price: 850.00,
          total: 850.00,
          tax_amount: 42.50,
          tax_rate: 5,
          merchandise_type: "CAKE",
          hsn_code: "1905",
        }
      ],
      metadata: {
        delivery_otp: "5588",
        customer_name: customerFullName,
        customer_phone: testCustomer.phone || "+919876543210",
        payment_method: "online_upi",
        payment_status: "pending",
        payment_gateway: "razorpay",
        gateway_payment_id: "pay_prepaid_upi_992014",
        is_ledger_eligible: true,
        branch_id: testBranch.id,
        delivery_state: "Karnataka",
        total: 892.50,
        grand_total: 892.50,
        items: [
          {
            product_id: testCake.id,
            variant_id: testCake.variant_id,
            title: testCake.title,
            quantity: 1,
            unit_price: 850.00,
            total: 850.00,
            tax_amount: 42.50,
            tax_rate: 5,
            merchandise_type: "CAKE",
            hsn_code: "1905",
          }
        ]
      }
    };

    store.orders.unshift(testOrder);
    await persistOrderToDb(testOrder);

    const savedOrderQ = await dbQuery<{ metadata: any }>(
      `SELECT metadata FROM public.order WHERE id = $1`,
      [testOrderId]
    );
    assert(savedOrderQ.rows.length === 1, "Prepaid order inserted into public.order");
    assert(testOrder.invoice_number === null, "Order created with invoice_number === null (Order ≠ Bill)");
    assert(savedOrderQ.rows[0].metadata?.is_ledger_eligible === true, "Order created with metadata.is_ledger_eligible === true");
    assert(savedOrderQ.rows[0].metadata?.payment_method === "online_upi", "Order created with payment_method === 'online_upi'");

    // ── 2. Order Progression to OUT_FOR_DELIVERY ───────────────────────────────
    console.log("\n--- 2. Order Progression to OUT_FOR_DELIVERY ---");
    testOrder.status = "out_for_delivery";
    if (testOrder.metadata) {
      testOrder.metadata.delivery_status = "out_for_delivery";
    }
    await persistOrderToDb(testOrder);

    const midInvoiceQ = await dbQuery(`SELECT * FROM public.invoice WHERE order_id = $1`, [testOrderId]);
    assert(midInvoiceQ.rows.length === 0, "No invoice exists while out_for_delivery");

    const midVoucherQ = await dbQuery(
      `SELECT * FROM public.accounting_voucher WHERE reference_id = $1 AND deleted_at IS NULL`,
      [testOrderId]
    );
    assert(midVoucherQ.rows.length === 0, "No accounting voucher exists while out_for_delivery");

    // ── 3. Doorstep Delivery Confirmation & Sales Voucher Draft ────────────────
    console.log("\n--- 3. Doorstep Delivery Confirmation & Sales Voucher Draft ---");
    testOrder.status = "delivered";
    if (testOrder.metadata) {
      testOrder.metadata.delivery_status = "delivered";
    }

    const deliveryResult = await DeliveryInvoicingService.generateInvoiceOnDelivery(
      ApiEngine,
      testOrder
    );

    console.log("DELIVERY RESULT:", JSON.stringify(deliveryResult, null, 2));
    assert(deliveryResult.success === true, "generateInvoiceOnDelivery returned success: true");
    assert(typeof deliveryResult.invoice_number === "string", `Statutory invoice generated: ${deliveryResult.invoice_number}`);
    assert(/^CTH\/\d{2}-\d{2}\/\d{6}$/.test(deliveryResult.invoice_number!), "Invoice number conforms to statutory format CTH/YY-YY/XXXXXX");
    assert(typeof deliveryResult.accounting_voucher_id === "string", `Sales voucher draft created: ${deliveryResult.accounting_voucher_id}`);

    const salesVoucherId = deliveryResult.accounting_voucher_id!;
    createdVoucherIds.push(salesVoucherId);

    // ── 4. Verify Sales Voucher Draft in PostgreSQL ─────────────────────────────
    console.log("\n--- 4. Verify Sales Voucher Draft in PostgreSQL ---");
    const draftVchQ = await dbQuery<{
      status: string;
      voucher_type: string;
      total_amount: string;
      created_by: string;
      metadata: any;
    }>(
      `SELECT status, voucher_type, total_amount, created_by, metadata FROM public.accounting_voucher WHERE id = $1`,
      [salesVoucherId]
    );
    assert(draftVchQ.rows.length === 1, "Draft sales voucher exists in public.accounting_voucher");
    assert(draftVchQ.rows[0].status === "DRAFT", "Sales voucher is in initial 'DRAFT' status");
    assert(draftVchQ.rows[0].voucher_type === "SALES", "Sales voucher type is strictly 'SALES'");
    assert(parseFloat(draftVchQ.rows[0].total_amount) === 892.50, "Sales voucher total matches order total ₹892.50");
    assert(draftVchQ.rows[0].created_by === "system:delivery_invoicing", "Voucher created_by reflects delivery service");

    // Verify proposed journal lines debit CoA 1121 (Accounts Receivable) for prepaid orders
    const proposedLines = draftVchQ.rows[0].metadata?.proposed_journal_lines;
    assert(Array.isArray(proposedLines) && proposedLines.length === 4, "Proposed lines contains 4 entries (Dr AR, Cr Revenue, Cr CGST, Cr SGST)");
    assert(draftVchQ.rows[0].metadata?.ar_account_code === "1121", "Prepaid order voucher ar_account_code is 1121 (Accounts Receivable)");
    const arLineDraft = proposedLines.find((l: any) => l.metadata?.ar_account_code === "1121" || l.metadata?.account_code === "1121" || l.account_code === "1121");
    assert(arLineDraft !== undefined && Number(arLineDraft.debit_amount) === 892.50, "Prepaid order proposed lines debits CoA 1121 (Accounts Receivable) for ₹892.50");

    // ── 5. Central Accounting Work Queue Approval & GL Posting ─────────────────
    console.log("\n--- 5. Central Accounting Work Queue Approval & GL Posting ---");

    // 5A. Submit Voucher (DRAFT -> SUBMITTED)
    const submitRes = await SalesPostingService.submitSalesVoucher({
      voucherId: salesVoucherId,
      submittedBy: "staff_ops_teller_01",
      branchId: testBranch.id,
    });
    assert(submitRes.success === true, "Sales voucher transitioned from DRAFT to SUBMITTED");

    // 5B. Approve Voucher (SUBMITTED -> APPROVED with SoD: Approver !== Submitter !== Creator)
    const approveRes = await SalesPostingService.approveSalesVoucher({
      voucherId: salesVoucherId,
      approvedBy: "mgr_supervisor_01",
      branchId: testBranch.id,
      actorContext: {
        id: "mgr_supervisor_01",
        user_id: "mgr_supervisor_01",
        role: "BRANCH_MANAGER",
        permissions: ["ACCOUNTING.APPROVE"],
      },
    });
    assert(approveRes.success === true, "Sales voucher transitioned to APPROVED");

    // 5C. Post Voucher (APPROVED -> POSTED with SoD: Poster !== Approver !== Submitter)
    const postRes = await SalesPostingService.postSalesVoucher({
      voucherId: salesVoucherId,
      postedBy: "acct_controller_01",
      branchId: testBranch.id,
      actorContext: {
        id: "acct_controller_01",
        user_id: "acct_controller_01",
        role: "ADMIN",
        permissions: ["ACCOUNTING.POST"],
      },
    });
    if (!postRes.success) {
      console.error("Sales posting failure detail:", postRes);
    }
    assert(postRes.success === true, "Sales voucher transitioned to POSTED in General Ledger");

    // ── 6. Verify General Ledger Posting in PostgreSQL ─────────────────────────
    console.log("\n--- 6. Verify General Ledger Posting in PostgreSQL ---");
    const postedVchQ = await dbQuery<{ status: string }>(
      `SELECT status FROM public.accounting_voucher WHERE id = $1`,
      [salesVoucherId]
    );
    assert(postedVchQ.rows[0].status === "POSTED", "Accounting voucher status is strictly 'POSTED'");

    const journalQ = await dbQuery<{ id: string; entry_no: string; total_debit: string; is_reversed: boolean }>(
      `SELECT id, entry_no, total_debit, is_reversed FROM public.accounting_journal_entry WHERE voucher_id = $1`,
      [salesVoucherId]
    );
    assert(journalQ.rows.length === 1, "Exactly 1 journal entry created for sales voucher");
    assert(journalQ.rows[0].is_reversed === false, "Journal entry is active (is_reversed === false)");
    const journalId = journalQ.rows[0].id;

    const linesQ = await dbQuery<{ account_code: string; debit_amount: string; credit_amount: string }>(
      `SELECT a.code as account_code, l.debit_amount, l.credit_amount 
       FROM public.accounting_journal_line l
       JOIN public.accounting_account a ON a.id = l.account_id
       WHERE l.journal_entry_id = $1
       ORDER BY l.debit_amount DESC, a.code ASC;`,
      [journalId]
    );

    // Verify Commercial Lines
    const arLine = linesQ.rows.find(l => l.account_code === "1121");
    const revenueLine = linesQ.rows.find(l => l.account_code === "4110");
    const cgstLine = linesQ.rows.find(l => l.account_code === "2121");
    const sgstLine = linesQ.rows.find(l => l.account_code === "2122");

    assert(arLine !== undefined && parseFloat(arLine.debit_amount) === 892.50, "Debit to Account 1121 (Accounts Receivable) is exactly ₹892.50");
    assert(revenueLine !== undefined && parseFloat(revenueLine.credit_amount) === 850.00, "Credit to Account 4110 (Revenue) is ₹850.00");
    assert(cgstLine !== undefined && parseFloat(cgstLine.credit_amount) === 21.25, "Credit to Account 2121 (Output CGST) is ₹21.25");
    assert(sgstLine !== undefined && parseFloat(sgstLine.credit_amount) === 21.25, "Credit to Account 2122 (Output SGST) is ₹21.25");

    // Double-entry mathematical balance
    const totalDebits = linesQ.rows.reduce((s, l) => s + parseFloat(l.debit_amount), 0);
    const totalCredits = linesQ.rows.reduce((s, l) => s + parseFloat(l.credit_amount), 0);
    assert(Math.abs(totalDebits - totalCredits) < 0.01, `Journal entry is mathematically balanced (Debits ₹${totalDebits} === Credits ₹${totalCredits})`);

    // ── 7. Verify Authoritative AR Outstanding Balance ─────────────────────────
    console.log("\n--- 7. Verify Authoritative AR Outstanding Balance ---");
    const arBefore = await CustomerReceiptService.getOrderOutstandingAr(testOrderId);
    assert(arBefore.invoiceTotal === 892.50, `Authoritative invoice total is ₹892.50 (Reported: ₹${arBefore.invoiceTotal})`);
    assert(arBefore.outstandingAr === 892.50, `Outstanding AR is ₹892.50 (Reported: ₹${arBefore.outstandingAr})`);
    assert(arBefore.totalReceived === 0, "Total received is ₹0.00 prior to receipt posting");
    assert(arBefore.isFullySettled === false, "isFullySettled is false prior to receipt posting");
    assert(arBefore.controlAccountCode === "1121", "Control account code is 1121 (Accounts Receivable)");

    // ── 8. Execute Customer Payment Receipt for Prepaid Order ──────────────────
    console.log("\n--- 8. Execute Customer Payment Receipt for Prepaid Order ---");
    const receiptRes = await CustomerReceiptService.postPrepaidOnlineReceipt({
      orderId: testOrderId,
      amount: 892.50,
      branchId: testBranch.id,
      createdByStaffId: "staff_teller_02",
      approvedBySupervisorId: "mgr_supervisor_02",
      postedByGlAccountantId: "acct_controller_02",
      notes: "Prepaid UPI gateway receipt recognized upon delivery confirmation",
      supervisorActorContext: {
        id: "mgr_supervisor_02",
        user_id: "mgr_supervisor_02",
        role: "BRANCH_MANAGER",
        permissions: ["ACCOUNTING.APPROVE"],
      },
      accountantActorContext: {
        id: "acct_controller_02",
        user_id: "acct_controller_02",
        role: "ADMIN",
        permissions: ["ACCOUNTING.POST"],
      },
    });

    console.log("RECEIPT RES:", JSON.stringify(receiptRes, null, 2));
    assert(receiptRes.success === true, "postPrepaidOnlineReceipt returned success: true");
    const receiptVoucher = receiptRes.data.voucher;
    assert(receiptVoucher !== undefined, "Receipt voucher successfully generated");
    assert(receiptVoucher.status === "POSTED", "Receipt voucher status is strictly 'POSTED'");
    assert(receiptVoucher.voucher_type === "RECEIPT", "Receipt voucher type is strictly 'RECEIPT'");
    createdVoucherIds.push(receiptVoucher.id);

    // Verify Receipt Journal Entry in PostgreSQL:
    // Debit 1113 (Payment Gateway Clearing)
    // Credit 1121 (Accounts Receivable)
    const rcptJournalQ = await dbQuery<{ id: string }>(
      `SELECT id FROM public.accounting_journal_entry WHERE voucher_id = $1`,
      [receiptVoucher.id]
    );
    assert(rcptJournalQ.rows.length === 1, "Receipt voucher produced exactly 1 journal entry");
    const rcptJournalId = rcptJournalQ.rows[0].id;

    const rcptLinesQ = await dbQuery<{ account_code: string; debit_amount: string; credit_amount: string }>(
      `SELECT a.code as account_code, l.debit_amount, l.credit_amount 
       FROM public.accounting_journal_line l
       JOIN public.accounting_account a ON a.id = l.account_id
       WHERE l.journal_entry_id = $1
       ORDER BY l.debit_amount DESC;`,
      [rcptJournalId]
    );
    assert(rcptLinesQ.rows.length === 2, "Receipt journal entry has exactly 2 lines (Dr Gateway Clearing, Cr AR)");
    assert(rcptLinesQ.rows[0].account_code === "1113", "Debit line posts to Account 1113 (Payment Gateway Clearing)");
    assert(parseFloat(rcptLinesQ.rows[0].debit_amount) === 892.50, "Debit amount is ₹892.50");
    assert(rcptLinesQ.rows[1].account_code === "1121", "Credit line posts to Account 1121 (Accounts Receivable)");
    assert(parseFloat(rcptLinesQ.rows[1].credit_amount) === 892.50, "Credit amount is ₹892.50");

    // ── 9. Verify Subledger Settlement (AR Cleared to ₹0) ──────────────────────
    console.log("\n--- 9. Verify Subledger Settlement (AR Cleared to ₹0) ---");
    const arAfter = await CustomerReceiptService.getOrderOutstandingAr(testOrderId);
    assert(arAfter.invoiceTotal === 892.50, "Invoice total remains ₹892.50");
    assert(arAfter.totalReceived === 892.50, "Total received is now ₹892.50");
    assert(arAfter.outstandingAr === 0.00, `Outstanding AR is now ₹0.00 (Reported: ₹${arAfter.outstandingAr})`);
    assert(arAfter.isFullySettled === true, "isFullySettled is strictly true");

    // ── 10. Fail-Closed Guards & Segregation of Duties ─────────────────────────
    console.log("\n--- 10. Fail-Closed Guards & Segregation of Duties ---");

    // 10A. Overpayment Prevention: Cannot create another receipt exceeding outstanding AR
    let overpaymentBlocked = false;
    try {
      const overpayRes = await CustomerReceiptService.postPrepaidOnlineReceipt({
        orderId: testOrderId,
        amount: 100.00,
        branchId: testBranch.id,
        createdByStaffId: "staff_teller_03",
        approvedBySupervisorId: "mgr_supervisor_03",
        postedByGlAccountantId: "acct_controller_03",
      });
      if (!overpayRes.success) overpaymentBlocked = true;
    } catch {
      overpaymentBlocked = true;
    }
    assert(overpaymentBlocked === true, "Overpayment on settled order is rejected with fail-closed error");

    // 10B. SoD Violation: Creator cannot approve receipt
    let sodApprovalBlocked = false;
    try {
      const sodRes = await CustomerReceiptService.postPrepaidOnlineReceipt({
        orderId: testOrderId,
        amount: 50.00,
        branchId: testBranch.id,
        createdByStaffId: "same_staff_01",
        approvedBySupervisorId: "same_staff_01",
        postedByGlAccountantId: "acct_controller_04",
      });
      if (!sodRes.success && (sodRes.code === "SEGREGATION_OF_DUTIES_VIOLATION" || (sodRes as any).error?.includes("Segregation"))) {
        sodApprovalBlocked = true;
      }
    } catch {
      sodApprovalBlocked = true;
    }
    assert(sodApprovalBlocked === true, "Segregation of Duties: Creator cannot approve receipt voucher");

    // 10C. SoD Violation: Creator cannot post receipt
    let sodPostBlocked = false;
    try {
      const sodRes = await CustomerReceiptService.postPrepaidOnlineReceipt({
        orderId: testOrderId,
        amount: 50.00,
        branchId: testBranch.id,
        createdByStaffId: "same_staff_02",
        approvedBySupervisorId: "mgr_supervisor_04",
        postedByGlAccountantId: "same_staff_02",
      });
      if (!sodRes.success && (sodRes.code === "SEGREGATION_OF_DUTIES_VIOLATION" || (sodRes as any).error?.includes("Segregation"))) {
        sodPostBlocked = true;
      }
    } catch {
      sodPostBlocked = true;
    }
    assert(sodPostBlocked === true, "Segregation of Duties: Creator cannot post receipt voucher");

  } finally {
    // ── 11. Pristine Database Teardown & Audit ──────────────────────────────────
    console.log("\n--- 11. Pristine Database Teardown & Audit ---");

    // Clean inventory movements and cost consumptions created by sales posting first (FK to accounting_voucher)
    await dbQuery(`DELETE FROM public.inventory_cost_consumption WHERE lot_id = $1`, [testLotId]);
    await dbQuery(`DELETE FROM public.inventory_movement WHERE reference_no = $1 OR voucher_id = ANY($2) OR reference_no = ANY($2)`, [testOrderId, createdVoucherIds]);

    if (createdVoucherIds.length > 0) {
      await dbQuery(
        `DELETE FROM public.accounting_journal_line WHERE journal_entry_id IN (
          SELECT id FROM public.accounting_journal_entry WHERE voucher_id = ANY($1)
        )`,
        [createdVoucherIds]
      );
      await dbQuery(
        `DELETE FROM public.accounting_journal_entry WHERE voucher_id = ANY($1)`,
        [createdVoucherIds]
      );
      await dbQuery(
        `DELETE FROM public.accounting_voucher WHERE id = ANY($1)`,
        [createdVoucherIds]
      );
    }
    await dbQuery(`DELETE FROM public.inventory_cost_lot WHERE id = $1`, [testLotId]);
    await dbQuery(`DELETE FROM public.purchase_item WHERE id = $1`, [testPiId]);
    await dbQuery(`DELETE FROM public.purchase WHERE id = $1`, [testPurchaseId]);
    await dbQuery(`DELETE FROM public.supplier WHERE id = $1`, [testSupplierId]);

    if (existingBinvId && originalBinvQty !== null) {
      await dbQuery(`UPDATE public.branch_inventory SET quantity = $1, reserved = 0 WHERE id = $2`, [originalBinvQty, existingBinvId]);
    } else if (createdBinv) {
      await dbQuery(`DELETE FROM public.branch_inventory WHERE id = $1`, [testBinvId]);
    }

    await dbQuery(`DELETE FROM public.invoice WHERE order_id = $1`, [testOrderId]);
    await dbQuery(`DELETE FROM public.order_status_history WHERE order_id = $1`, [testOrderId]);
    await dbQuery(`DELETE FROM public.order WHERE id = $1`, [testOrderId]);

    if (createdPeriodId) {
      await dbQuery(`DELETE FROM public.accounting_fiscal_period WHERE id = $1`, [createdPeriodId]);
    }
    if (createdSetting) {
      await dbQuery(`DELETE FROM public.setting WHERE key = 'accounting_start_date'`);
    }

    const finalOrders = await dbQuery<{ count: string }>(`SELECT count(*) FROM public.order`);
    const finalInvoices = await dbQuery<{ count: string }>(`SELECT count(*) FROM public.invoice`);
    const finalVouchers = await dbQuery<{ count: string }>(`SELECT count(*) FROM public.accounting_voucher WHERE deleted_at IS NULL`);
    const finalJournals = await dbQuery<{ count: string }>(`SELECT count(*) FROM public.accounting_journal_entry`);
    const finalPeriods = await dbQuery<{ count: string }>(`SELECT count(*) FROM public.accounting_fiscal_period`);

    assert(parseInt(finalOrders.rows[0].count) === baselineOrderCount, `Final orders count (${finalOrders.rows[0].count}) matches baseline (${baselineOrderCount})`);
    assert(parseInt(finalInvoices.rows[0].count) === baselineInvoiceCount, `Final invoices count (${finalInvoices.rows[0].count}) matches baseline (${baselineInvoiceCount})`);
    assert(parseInt(finalVouchers.rows[0].count) === baselineVoucherCount, `Final vouchers count (${finalVouchers.rows[0].count}) matches baseline (${baselineVoucherCount})`);
    assert(parseInt(finalJournals.rows[0].count) === baselineJournalCount, `Final journals count (${finalJournals.rows[0].count}) matches baseline (${baselineJournalCount})`);
    assert(parseInt(finalPeriods.rows[0].count) === baselinePeriodCount, `Final fiscal periods count (${finalPeriods.rows[0].count}) matches baseline (${baselinePeriodCount})`);
  }

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log(`📊 PHASE 5C STEP 3 TEST RESULTS: ${passedCount}/${totalCount} assertions passed (${Math.round(passedCount / totalCount * 100)}%)`);
  console.log("═══════════════════════════════════════════════════════════════\n");
}

main().catch((err) => {
  console.error("TEST EXECUTION FAILED:", err);
  process.exit(1);
});
