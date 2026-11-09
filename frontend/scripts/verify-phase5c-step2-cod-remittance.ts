import { dbQuery, dbTransaction } from "../src/lib/db";
import { ApiEngine } from "../src/lib/api-engine";
import { DeliveryInvoicingService } from "../src/lib/services/delivery-invoicing.service";
import { CodCollectionService } from "../src/lib/services/cod-collection.service";
import { persistOrderToDb } from "../src/lib/db-persistence";
import { AccountingConfigService } from "../src/lib/services/accounting-config.service";
import { FiscalPeriodService } from "../src/lib/services/fiscal-period.service";
import { AccountingFiscalPeriodRepository } from "../src/lib/repositories/accounting-fiscal-period.repository";

interface TestStats {
  passed: number;
  failed: number;
}

const stats: TestStats = { passed: 0, failed: 0 };

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`✅ [PASS] ${message}`);
    stats.passed++;
  } else {
    console.error(`❌ [FAIL] ${message}`);
    stats.failed++;
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function main() {
  console.log("══════════════════════════════════════════════════════════════════════════════");
  console.log("🧪 PHASE 5C STEP 2: COD COLLECTION & RIDER SHIFT REMITTANCE VERIFICATION");
  console.log("══════════════════════════════════════════════════════════════════════════════\n");

  const createdOrderIds: string[] = [];
  const createdInvoiceIds: string[] = [];
  const createdVoucherIds: string[] = [];
  const createdHistoryIds: string[] = [];

  let baselineOrderCount = 0;
  let baselineInvoiceCount = 0;
  let baselineVoucherCount = 0;
  let baselineJournalCount = 0;
  let baselinePeriodCount = 0;
  let createdSetting = false;
  let createdPeriodId: string | null = null;

  try {
    // Clean any prior test artifacts
    await dbQuery(`DELETE FROM public.accounting_journal_line WHERE journal_entry_id IN (SELECT id FROM public.accounting_journal_entry WHERE voucher_id IN (SELECT id FROM public.accounting_voucher WHERE reference_id LIKE 'order_cod_5c_%' OR reference_id LIKE 'shift_%'));`);
    await dbQuery(`DELETE FROM public.accounting_journal_entry WHERE voucher_id IN (SELECT id FROM public.accounting_voucher WHERE reference_id LIKE 'order_cod_5c_%' OR reference_id LIKE 'shift_%');`);
    await dbQuery(`DELETE FROM public.accounting_voucher WHERE reference_id LIKE 'order_cod_5c_%' OR reference_id LIKE 'shift_%';`);
    await dbQuery(`DELETE FROM public.invoice WHERE order_id LIKE 'order_cod_5c_%';`);
    await dbQuery(`DELETE FROM public.order_status_history WHERE order_id LIKE 'order_cod_5c_%';`);
    await dbQuery(`DELETE FROM public.order WHERE id LIKE 'order_cod_5c_%';`);

    // ── 0. Database Baseline Check ─────────────────────────────────────────────
    console.log("--- 0. Database Baseline Check ---");
    const baselineOrdersRes = await dbQuery<{ count: string }>(`SELECT COUNT(*) as count FROM public.order WHERE deleted_at IS NULL;`);
    const baselineInvoicesRes = await dbQuery<{ count: string }>(`SELECT COUNT(*) as count FROM public.invoice WHERE deleted_at IS NULL;`);
    const baselineVouchersRes = await dbQuery<{ count: string }>(`SELECT COUNT(*) as count FROM public.accounting_voucher WHERE deleted_at IS NULL;`);
    const baselineJournalsRes = await dbQuery<{ count: string }>(`SELECT COUNT(*) as count FROM public.accounting_journal_entry;`);
    const baselinePeriodRes = await dbQuery<{ count: string }>(`SELECT COUNT(*) as count FROM public.accounting_fiscal_period;`);

    baselineOrderCount = parseInt(baselineOrdersRes.rows[0].count, 10);
    baselineInvoiceCount = parseInt(baselineInvoicesRes.rows[0].count, 10);
    baselineVoucherCount = parseInt(baselineVouchersRes.rows[0].count, 10);
    baselineJournalCount = parseInt(baselineJournalsRes.rows[0].count, 10);
    baselinePeriodCount = parseInt(baselinePeriodRes.rows[0].count, 10);

    console.log(`Initial DB Rows — Orders: ${baselineOrderCount}, Invoices: ${baselineInvoiceCount}, Vouchers: ${baselineVoucherCount}, Journals: ${baselineJournalCount}, Fiscal Periods: ${baselinePeriodCount}`);

    // Setup test fiscal environment if unconfigured
    const initialConfig = await AccountingConfigService.getConfig();
    if (!initialConfig.configured) {
      await AccountingConfigService.setAccountingStartDate("2026-04-01", "usr_super_admin_test", "SUPER_ADMIN");
      createdSetting = true;
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const periodStatus = await AccountingFiscalPeriodRepository.getPeriodStatusForDate(todayStr);
    if (periodStatus.status === "PERIOD_NOT_CONFIGURED") {
      const periodRow = await FiscalPeriodService.createFiscalPeriod(
        {
          fiscal_year: "FY2026-27",
          period_name: "October 2026",
          start_date: "2026-10-01",
          end_date: "2026-10-31",
        },
        "usr_super_admin_test",
        "SUPER_ADMIN"
      );
      createdPeriodId = periodRow.id;
    }

    // Authoritative Product & Branch lookup
    const prodRes = await dbQuery<{ id: string; title: string; metadata: any }>(
      `SELECT id, title, metadata FROM public.product WHERE deleted_at IS NULL AND (metadata->>'merchandise_type' = 'CAKE' OR metadata->>'type' = 'CAKE' OR title ILIKE '%cake%') LIMIT 1;`
    );
    assert(prodRes.rows.length > 0, "Found authoritative Cake product in PostgreSQL");
    const testProduct = prodRes.rows[0];

    const branchRes = await dbQuery<{ id: string; name: string; code: string }>(
      `SELECT id, name, code FROM public.branch WHERE deleted_at IS NULL AND id = 'br_indiranagar_01' LIMIT 1;`
    );
    assert(branchRes.rows.length > 0, "Found authoritative Branch in PostgreSQL");
    const testBranch = branchRes.rows[0];

    const riderRes = await dbQuery<{ id: string; first_name: string; last_name: string }>(
      `SELECT id, first_name, last_name FROM public.delivery_partner WHERE deleted_at IS NULL LIMIT 1;`
    );
    assert(riderRes.rows.length > 0, "Found authoritative Delivery Partner in PostgreSQL");
    const testRider = riderRes.rows[0];
    const riderName = `${testRider.first_name} ${testRider.last_name}`.trim();

    // ── 1. Certified Online COD Order Creation ─────────────────────────────────
    console.log("\n--- 1. Certified Online COD Order Creation ---");
    const testOrderId = `order_cod_5c_${Date.now()}`;
    createdOrderIds.push(testOrderId);

    ApiEngine.ensureOrdersStore();
    const store = ApiEngine.getStore();
    if (!store.orders) store.orders = [];
    if (!store.invoices) store.invoices = [];

    const testOrder: any = {
      id: testOrderId,
      order_number: `CTH-COD-${Date.now().toString().slice(-6)}`,
      invoice_number: null,
      invoice_id: null,
      invoice: null,
      accounting_voucher_id: null,
      customer_id: "cust_cod_test_01",
      customer_name: "Rahul Dravid",
      customer_email: "rahul.dravid@example.com",
      customer_phone: "+91 98450 12345",
      branch_id: testBranch.id,
      branch_name: testBranch.name,
      branch_code: testBranch.code,
      seller_gstin: "29AAACC1234F1Z5",
      seller_legal_name: "CakeToHome India Private Limited",
      seller_state_code: "29",
      seller_state: "Karnataka",
      seller_is_verified: true,
      delivery_partner_id: testRider.id,
      delivery_partner_name: riderName,
      delivery_address: {
        address: "12 Church Street, MG Road",
        city: "Bengaluru",
        state: "Karnataka",
        pincode: "560001",
      },
      delivery_state: "Karnataka",
      payment_method: "cod",
      payment_status: "pending",
      status: "pending",
      subtotal: 850.00,
      discount_amount: 0,
      tax_amount: 42.50,
      total: 892.50,
      grand_total: 892.50,
      items: [
        {
          id: `item_${Date.now()}`,
          product_id: testProduct.id,
          title: testProduct.title,
          quantity: 1,
          unit_price: 850.00,
          total: 850.00,
          tax_amount: 42.50,
          tax_rate: 5,
          hsn_code: "19059090",
          merchandise_type: "CAKE",
        }
      ],
      metadata: {
        is_ledger_eligible: true,
        delivery_partner_id: testRider.id,
        delivery_partner_name: riderName,
        payment_method: "cod",
        payment_classification: "COD",
        customer_name: "Rahul Dravid",
        customer_phone: "+91 98450 12345",
        delivery_address: {
          address: "12 Church Street, MG Road",
          city: "Bengaluru",
          state: "Karnataka",
          pincode: "560001",
        },
        state: "Karnataka",
        total: 892.50,
        grand_total: 892.50,
      }
    };

    store.orders.push(testOrder);
    await persistOrderToDb(testOrder);

    assert(testOrder.invoice_number === null, "Order created with invoice_number === null (Order ≠ Bill)");
    assert(testOrder.metadata?.is_ledger_eligible === true, "Order created with metadata.is_ledger_eligible === true");
    assert(testOrder.payment_method === "cod", "Order created with payment_method === 'cod'");

    // ── 2. Order Progression to OUT_FOR_DELIVERY ───────────────────────────────
    console.log("\n--- 2. Order Progression to OUT_FOR_DELIVERY ---");
    testOrder.status = "out_for_delivery";
    if (testOrder.metadata) {
      testOrder.metadata.delivery_status = "out_for_delivery";
      testOrder.metadata.delivery_partner_id = testRider.id;
    }
    await persistOrderToDb(testOrder);

    const midInvoiceCheck = await dbQuery(`SELECT COUNT(*) as count FROM public.invoice WHERE order_id = $1`, [testOrderId]);
    assert(parseInt(midInvoiceCheck.rows[0].count) === 0, "No invoice exists while out_for_delivery");
    const midVoucherCheck = await dbQuery(`SELECT COUNT(*) as count FROM public.accounting_voucher WHERE reference_id = $1`, [testOrderId]);
    assert(parseInt(midVoucherCheck.rows[0].count) === 0, "No accounting voucher exists while out_for_delivery");

    // ── 3. Doorstep Delivery Confirmation & Cash Custody Handover ──────────────
    console.log("\n--- 3. Doorstep Delivery Confirmation & Cash Custody Handover ---");
    testOrder.status = "delivered";
    if (testOrder.metadata) {
      testOrder.metadata.delivery_status = "delivered";
    }

    const invoiceResult = await DeliveryInvoicingService.generateInvoiceOnDelivery(
      ApiEngine,
      testOrder
    );

    assert(invoiceResult.success === true, "generateInvoiceOnDelivery returned success: true");
    assert(typeof invoiceResult.invoice_number === "string", `Statutory invoice generated: ${invoiceResult.invoice_number}`);
    assert(/^CTH\/\d{2}-\d{2}\/\d{6}$/.test(invoiceResult.invoice_number), "Invoice number conforms to statutory format CTH/YY-YY/XXXXXX");
    assert(typeof invoiceResult.accounting_voucher_id === "string", `Sales voucher draft created: ${invoiceResult.accounting_voucher_id}`);
    createdInvoiceIds.push(invoiceResult.invoice_id);
    if (invoiceResult.accounting_voucher_id) {
      createdVoucherIds.push(invoiceResult.accounting_voucher_id);
    }

    // ── 4. Verify COD Cash Custody Event on Order ──────────────────────────────
    console.log("\n--- 4. Verify COD Cash Custody Event on Order ---");
    const dbOrderQ = await dbQuery<{ metadata: any }>(`SELECT metadata FROM public.order WHERE id = $1`, [testOrderId]);
    const orderMeta = dbOrderQ.rows[0].metadata;
    assert(orderMeta.cod_custody_event !== undefined, "Order has metadata.cod_custody_event populated");
    assert(orderMeta.cod_custody_event.delivery_partner_id === testRider.id, `Custody linked to Rider ${testRider.id}`);
    assert(orderMeta.cod_custody_event.collected_amount === 892.50, "Custody amount matches invoice total ₹892.50");
    assert(orderMeta.cod_custody_event.custody_status === "IDENTIFIED_RIDER_CUSTODY", "Custody status is 'IDENTIFIED_RIDER_CUSTODY'");
    assert(orderMeta.cod_custody_event.settlement_voucher_id === null, "Custody settlement_voucher_id is initially null");

    // Verify append-only audit trail in order_status_history
    const oshQ = await dbQuery<{ id: string; to_status: string }>(
      `SELECT id, to_status FROM public.order_status_history WHERE order_id = $1 AND to_status = 'COD_CASH_COLLECTED'`,
      [testOrderId]
    );
    assert(oshQ.rows.length >= 1, "public.order_status_history contains 'COD_CASH_COLLECTED' audit record");
    if (oshQ.rows.length > 0) {
      createdHistoryIds.push(oshQ.rows[0].id);
    }

    // ── 5. Verify Sales Voucher Draft Debit Side is Undeposited COD (CoA 1122) ─
    console.log("\n--- 5. Verify Sales Voucher Draft Debit Side is CoA 1122 ---");
    const salesVchQ = await dbQuery<{ total_amount: string; metadata: any }>(
      `SELECT total_amount, metadata FROM public.accounting_voucher WHERE id = $1`,
      [invoiceResult.accounting_voucher_id]
    );
    const vchMeta = salesVchQ.rows[0].metadata || {};
    const proposedLines = vchMeta.proposed_journal_lines || vchMeta.proposed_lines || [];
    const debitLine = proposedLines.find((l: any) => parseFloat(l.debit_amount ?? l.debit ?? 0) > 0);
    const arAccountCode = vchMeta.ar_account_code || debitLine?.metadata?.ar_account_code || debitLine?.account_code;
    assert(arAccountCode === "1122", `Sales voucher debits Undeposited COD Collections (Account: ${arAccountCode})`);

    // ── 6. Query Rider Authoritative Outstanding Custody ───────────────────────
    console.log("\n--- 6. Query Rider Authoritative Outstanding Custody ---");
    const custodyReport = await CodCollectionService.getRiderCustody(testRider.id, testBranch.id);
    assert(custodyReport.deliveryPartnerId === testRider.id, "Custody report matches delivery partner ID");
    assert(custodyReport.outstandingCustody === 892.50, `Outstanding custody matches ₹892.50 (Reported: ₹${custodyReport.outstandingCustody})`);
    assert(custodyReport.activeOrdersCount === 1, "Rider has exactly 1 active order awaiting remittance");
    assert(custodyReport.orders[0].orderId === testOrderId, "Order ID correctly present in rider custody order list");

    // ── 7. Execute Branch Manager Driver Shift Remittance ──────────────────────
    console.log("\n--- 7. Execute Branch Manager Driver Shift Remittance ---");
    const shiftId = `shift_${testRider.id}_${Date.now()}`;
    const settlementRes = await CodCollectionService.postRiderShiftSettlement({
      shiftId,
      deliveryPartnerId: testRider.id,
      branchId: testBranch.id,
      totalCashReceived: 892.50,
      settlementLines: [
        {
          orderId: testOrderId,
          amount: 892.50,
        }
      ],
      remittedByStaffId: "staff_teller_01",
      approvedBySupervisorId: "mgr_supervisor_01",
      postedByGlAccountantId: "acct_controller_01",
      voucherDate: new Date().toISOString().slice(0, 10),
      notes: "EOD driver shift cash remittance for Indiranagar Hub",
      supervisorActorContext: {
        id: "mgr_supervisor_01",
        user_id: "mgr_supervisor_01",
        role: "BRANCH_MANAGER",
        permissions: ["ACCOUNTING.APPROVE"],
      },
      accountantActorContext: {
        id: "acct_controller_01",
        user_id: "acct_controller_01",
        role: "ADMIN",
        permissions: ["ACCOUNTING.POST"],
      }
    });

    const settlementVoucherId = settlementRes.voucher?.id || (settlementRes as any).voucherId;
    assert(settlementRes.shiftId === shiftId, `Shift settlement completed: ${settlementRes.shiftId}`);
    assert(typeof settlementVoucherId === "string", `Receipt settlement voucher posted: ${settlementVoucherId}`);
    assert(settlementRes.totalSettled === 892.50, `Total settlement amount matches: ₹${settlementRes.totalSettled}`);
    createdVoucherIds.push(settlementVoucherId);

    // Verify posted RECEIPT voucher in PostgreSQL
    const rcptVchQ = await dbQuery<{ status: string; voucher_type: string; total_amount: string }>(
      `SELECT status, voucher_type, total_amount FROM public.accounting_voucher WHERE id = $1`,
      [settlementVoucherId]
    );
    assert(rcptVchQ.rows[0].status === "POSTED", "Settlement voucher status is strictly 'POSTED'");
    assert(rcptVchQ.rows[0].voucher_type === "RECEIPT", "Settlement voucher type is strictly 'RECEIPT'");
    assert(parseFloat(rcptVchQ.rows[0].total_amount) === 892.50, "Settlement voucher total amount matches ₹892.50");

    // Verify journal entry & lines in General Ledger:
    // Debit 1111 (Branch Cash in Hand)
    // Credit 1122 (Undeposited COD Collections)
    const journalQ = await dbQuery<{ id: string }>(
      `SELECT id FROM public.accounting_journal_entry WHERE voucher_id = $1`,
      [settlementVoucherId]
    );
    assert(journalQ.rows.length === 1, "Settlement voucher produced exactly 1 journal entry");
    const journalId = journalQ.rows[0].id;

    const linesQ = await dbQuery<{ account_code: string; debit_amount: string; credit_amount: string }>(
      `SELECT a.code as account_code, l.debit_amount, l.credit_amount 
       FROM public.accounting_journal_line l
       JOIN public.accounting_account a ON a.id = l.account_id
       WHERE l.journal_entry_id = $1
       ORDER BY l.debit_amount DESC;`,
      [journalId]
    );
    assert(linesQ.rows.length === 2, "Journal entry has exactly 2 lines (Dr Branch Cash, Cr Undeposited COD)");
    assert(linesQ.rows[0].account_code === "1111", "Debit line posts to Account 1111 (Branch Cash / Till)");
    assert(parseFloat(linesQ.rows[0].debit_amount) === 892.50, "Debit amount is ₹892.50");
    assert(linesQ.rows[1].account_code === "1122", "Credit line posts to Account 1122 (Undeposited COD Collections)");
    assert(parseFloat(linesQ.rows[1].credit_amount) === 892.50, "Credit amount is ₹892.50");

    // ── 8. Verify Custody Cleared ──────────────────────────────────────────────
    console.log("\n--- 8. Verify Custody Cleared ---");
    const clearedCustody = await CodCollectionService.getRiderCustody(testRider.id, testBranch.id);
    assert(clearedCustody.outstandingCustody === 0, `Rider outstanding custody is now ₹0.00 (Reported: ₹${clearedCustody.outstandingCustody})`);
    assert(clearedCustody.activeOrdersCount === 0, "Rider has 0 active orders awaiting remittance");

    const settledOrderQ = await dbQuery<{ metadata: any }>(`SELECT metadata FROM public.order WHERE id = $1`, [testOrderId]);
    assert(settledOrderQ.rows[0].metadata?.cod_custody_event?.settlement_voucher_id === settlementVoucherId, "Order metadata has settlement_voucher_id stamped");

    // ── 9. Idempotency & Fail-Closed Guard Verification ────────────────────────
    console.log("\n--- 9. Idempotency & Fail-Closed Guard Verification ---");
    let duplicateRejected = false;
    try {
      await CodCollectionService.postRiderShiftSettlement({
        shiftId,
        deliveryPartnerId: testRider.id,
        branchId: testBranch.id,
        totalCashReceived: 892.50,
        settlementLines: [{ orderId: testOrderId, amount: 892.50 }],
        remittedByStaffId: "staff_teller_01",
        approvedBySupervisorId: "mgr_supervisor_01",
        postedByGlAccountantId: "acct_controller_01",
      });
    } catch (e: any) {
      duplicateRejected = e.message.includes("Duplicate shift settlement rejected") || e.code === "DUPLICATE_SOURCE_EVENT";
    }
    assert(duplicateRejected, "Duplicate shift settlement is rejected with fail-closed error");

  } finally {
    // ── 10. Pristine Database Teardown & Audit ──────────────────────────────────
    console.log("\n--- 10. Pristine Database Teardown & Audit ---");
    for (const vId of createdVoucherIds) {
      await dbQuery(`DELETE FROM public.accounting_journal_line WHERE journal_entry_id IN (SELECT id FROM public.accounting_journal_entry WHERE voucher_id = $1);`, [vId]);
      await dbQuery(`DELETE FROM public.accounting_journal_entry WHERE voucher_id = $1;`, [vId]);
      await dbQuery(`DELETE FROM public.accounting_voucher WHERE id = $1;`, [vId]);
    }

    for (const oId of createdOrderIds) {
      await dbQuery(`DELETE FROM public.invoice WHERE order_id = $1;`, [oId]);
      await dbQuery(`DELETE FROM public.order_status_history WHERE order_id = $1;`, [oId]);
      await dbQuery(`DELETE FROM public.order_item WHERE order_id = $1;`, [oId]);
      await dbQuery(`DELETE FROM public.order WHERE id = $1;`, [oId]);
    }

    for (const invId of createdInvoiceIds) {
      await dbQuery(`DELETE FROM public.invoice WHERE id = $1;`, [invId]);
    }

    if (createdPeriodId) {
      await dbQuery(`DELETE FROM public.accounting_fiscal_period WHERE id = $1;`, [createdPeriodId]);
    }
    if (createdSetting) {
      await dbQuery(`DELETE FROM public.setting WHERE key = 'accounting_start_date';`);
    }

    const finalOrdersRes = await dbQuery<{ count: string }>(`SELECT COUNT(*) as count FROM public.order WHERE deleted_at IS NULL;`);
    const finalInvoicesRes = await dbQuery<{ count: string }>(`SELECT COUNT(*) as count FROM public.invoice WHERE deleted_at IS NULL;`);
    const finalVouchersRes = await dbQuery<{ count: string }>(`SELECT COUNT(*) as count FROM public.accounting_voucher WHERE deleted_at IS NULL;`);
    const finalJournalsRes = await dbQuery<{ count: string }>(`SELECT COUNT(*) as count FROM public.accounting_journal_entry;`);
    const finalPeriodRes = await dbQuery<{ count: string }>(`SELECT COUNT(*) as count FROM public.accounting_fiscal_period;`);

    const finalOrderCount = parseInt(finalOrdersRes.rows[0].count, 10);
    const finalInvoiceCount = parseInt(finalInvoicesRes.rows[0].count, 10);
    const finalVoucherCount = parseInt(finalVouchersRes.rows[0].count, 10);
    const finalJournalCount = parseInt(finalJournalsRes.rows[0].count, 10);
    const finalPeriodCount = parseInt(finalPeriodRes.rows[0].count, 10);

    assert(finalOrderCount === baselineOrderCount, `Final orders count (${finalOrderCount}) matches baseline (${baselineOrderCount})`);
    assert(finalInvoiceCount === baselineInvoiceCount, `Final invoices count (${finalInvoiceCount}) matches baseline (${baselineInvoiceCount})`);
    assert(finalVoucherCount === baselineVoucherCount, `Final vouchers count (${finalVoucherCount}) matches baseline (${baselineVoucherCount})`);
    assert(finalJournalCount === baselineJournalCount, `Final journals count (${finalJournalCount}) matches baseline (${baselineJournalCount})`);
    assert(finalPeriodCount === baselinePeriodCount, `Final fiscal periods count (${finalPeriodCount}) matches baseline (${baselinePeriodCount})`);
  }

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log(`📊 PHASE 5C STEP 2 TEST RESULTS: ${stats.passed}/${stats.passed + stats.failed} assertions passed (${Math.round((stats.passed / (stats.passed + stats.failed)) * 100)}%)`);
  console.log("═══════════════════════════════════════════════════════════════\n");
}

main().catch((err) => {
  console.error("TEST EXECUTION FAILED:", err);
  process.exit(1);
});
