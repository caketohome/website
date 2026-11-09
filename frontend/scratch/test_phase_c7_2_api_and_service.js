/**
 * CakeToHome ERP — Phase C7.2 API and Service End-to-End Verification Suite
 * 
 * Verifies BillsPayableService domain methods and Next.js /api/v1/admin/bills-payable/* API routes.
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function getConnectionString() {
  const envPath = path.join(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split('\n')) {
      if (line.trim().startsWith('DATABASE_URL=')) {
        let val = line.trim().substring('DATABASE_URL='.length).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        return val;
      }
    }
  }
  throw new Error("DATABASE_URL not found in .env");
}

const connStr = getConnectionString();
process.env.DATABASE_URL = connStr;

// Register TypeScript transpile hook for .ts and .tsx imports
const ts = require('../node_modules/typescript');
require.extensions['.ts'] = function(module, filename) {
  const content = fs.readFileSync(filename, 'utf8');
  const compiled = ts.transpileModule(content, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    }
  });
  return module._compile(compiled.outputText, filename);
};
require.extensions['.tsx'] = require.extensions['.ts'];

// Map @frontend alias
const Module = require('module');
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function(request, parent, isMain, options) {
  if (request.startsWith('@frontend/')) {
    const sub = request.substring('@frontend/'.length);
    const mapped = path.resolve(__dirname, '../src', sub);
    return originalResolveFilename.call(this, mapped, parent, isMain, options);
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

const { signAuthToken } = require('../src/lib/security/auth-session');
const { GET, POST } = require('../src/app/api/v1/[...path]/route');
const { NextRequest } = require('next/server');
const { BillsPayableService, BillsPayableError } = require('../src/lib/services/bills-payable.service');

async function runApiAndServiceSuite() {
  console.log('=============================================================================');
  console.log('  CAKETOHOME ERP — PHASE C7.2 SERVICE & API VERIFICATION SUITE');
  console.log('=============================================================================\n');

  const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
  await client.connect();

  let passed = 0;
  let failed = 0;

  function assert(cond, msg) {
    if (cond) {
      console.log(`  ✓ PASS: ${msg}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${msg}`);
      failed++;
    }
  }

  const createdPurchases = [];
  const createdPayments = [];
  const createdVouchers = [];
  const createdJournalEntries = [];
  const createdSuppliers = [];
  const createdBankAccounts = [];
  const createdCompanies = [];

  try {
    // ── Setup Test Fixtures ───
    const branchRes = await client.query(`SELECT id FROM public.branch LIMIT 1`);
    const branchId = branchRes.rows[0]?.id || 'br_main';

    let compRes = await client.query(`SELECT id FROM public.company LIMIT 1`);
    let compId = compRes.rows[0]?.id;
    if (!compId) {
      compId = `comp_c72_api_${Date.now()}`;
      await client.query(`
        INSERT INTO public.company (
          id, legal_name, trade_name, registered_address, city, state_code, pin_code,
          pan, currency, fy_start_month, invoice_prefix, phone, email, is_active, created_by, created_at, updated_at
        ) VALUES (
          $1, 'Cakes2Home Retail Pvt Ltd', 'Cakes2Home', '123 Baker St', 'Kochi', '32', '682001',
          'AAACC1234K', 'INR', 4, 'C2H', '9876543210', 'info@cakes2home.com', true, 'system', NOW(), NOW()
        )
      `, [compId]);
      createdCompanies.push(compId);
    }

    const supId = `sup_c72_api_${Date.now()}`;
    await client.query(`
      INSERT INTO public.supplier (id, name, gstin, phone, branch_id, is_active, created_at, updated_at)
      VALUES ($1, 'Premier Butter Suppliers', '32AABCP9999L1Z5', '9845012345', $2, true, NOW(), NOW());
    `, [supId, branchId]);
    createdSuppliers.push(supId);

    const bankId = `bank_c72_api_${Date.now()}`;
    await client.query(`
      INSERT INTO public.bank_account (id, company_id, bank_name, account_number_masked, ifsc_code, status, account_name, account_number, gl_account_id, branch_name, created_at, updated_at)
      VALUES ($1, $2, 'Kotak Mahindra Bank', 'XXXX5566', 'KKBK0001234', 'ACTIVE', 'Operating Current A/c', '50200055667788', (SELECT id FROM public.accounting_account WHERE code = '1112' LIMIT 1), 'Kochi', NOW(), NOW());
    `, [bankId, compId]);
    createdBankAccounts.push(bankId);

    // Create 2 Posted Bills
    const p1Id = `pur_c72_api1_${Date.now()}`;
    const v1Id = `v_c72_api1_${Date.now()}`;
    await client.query(`
      INSERT INTO public.accounting_voucher (id, voucher_no, voucher_type, voucher_date, branch_id, fiscal_year, status, total_amount, reference_type, reference_id, reference_event, narration, created_by, approved_by, posted_by, created_at, updated_at)
      VALUES ($1, 'JV-API-001', 'JOURNAL', CURRENT_DATE, $2, 'FY2026-27', 'POSTED', 8000.00, 'PURCHASE', $3, 'INVOICE_POSTED', 'Butter supplies', 'maker_bob', 'checker_alice', 'poster_dan', NOW(), NOW());
    `, [v1Id, branchId, p1Id]);
    createdVouchers.push(v1Id);

    await client.query(`
      INSERT INTO public.purchase (id, supplier_id, branch_id, invoice_no, invoice_date, due_date, subtotal, taxable_value, cgst, sgst, total, payment_method, status, voucher_id, posted_at, created_by, approved_by, created_at, updated_at)
      VALUES ($1, $2, $3, 'INV-API-8000', CURRENT_DATE, CURRENT_DATE + INTERVAL '20 days', 8000.00, 8000.00, 0.00, 0.00, 8000.00, 'CREDIT', 'POSTED', $4, NOW(), 'maker_bob', 'checker_alice', NOW(), NOW());
    `, [p1Id, supId, branchId, v1Id]);
    createdPurchases.push(p1Id);

    // Purchase Line Item for detail testing
    await client.query(`
      INSERT INTO public.purchase_item (id, purchase_id, description, quantity, rate, taxable_value, cgst, sgst, igst, total, hsn_code, item_type)
      VALUES ('pi_c72_1', $1, 'Cake Boxes 1kg', 40, 200.00, 8000.00, 0, 0, 0, 8000.00, '4819', 'PACKAGING');
    `, [p1Id]);

    // Bill 2 (₹5,000)
    const p2Id = `pur_c72_api2_${Date.now()}`;
    const v2Id = `v_c72_api2_${Date.now()}`;
    await client.query(`
      INSERT INTO public.accounting_voucher (id, voucher_no, voucher_type, voucher_date, branch_id, fiscal_year, status, total_amount, reference_type, reference_id, reference_event, narration, created_by, approved_by, posted_by, created_at, updated_at)
      VALUES ($1, 'JV-API-002', 'JOURNAL', CURRENT_DATE, $2, 'FY2026-27', 'POSTED', 5000.00, 'PURCHASE', $3, 'INVOICE_POSTED', 'Cream supplies', 'maker_bob', 'checker_alice', 'poster_dan', NOW(), NOW());
    `, [v2Id, branchId, p2Id]);
    createdVouchers.push(v2Id);

    await client.query(`
      INSERT INTO public.purchase (id, supplier_id, branch_id, invoice_no, invoice_date, due_date, subtotal, taxable_value, cgst, sgst, total, payment_method, status, voucher_id, posted_at, created_by, approved_by, created_at, updated_at)
      VALUES ($1, $2, $3, 'INV-API-5000', CURRENT_DATE, CURRENT_DATE + INTERVAL '10 days', 5000.00, 5000.00, 0.00, 0.00, 5000.00, 'CREDIT', 'POSTED', $4, NOW(), 'maker_bob', 'checker_alice', NOW(), NOW());
    `, [p2Id, supId, branchId, v2Id]);
    createdPurchases.push(p2Id);

    // ── 1. Test BillsPayableService.listBills ───
    console.log('[1/4] Testing BillsPayableService.listBills...');
    const listRes = await BillsPayableService.listBills({
      supplier_id: supId,
      branch_id: branchId,
    });
    assert(listRes.bills.length === 2, 'BillsPayableService.listBills returns 2 bills for supplier');
    assert(listRes.summary.total_payables_amount === 13000.00, 'Summary total_payables_amount is ₹13,000.00');
    assert(listRes.summary.unpaid_count === 2, 'Summary unpaid_count is 2');

    // ── 2. Test BillsPayableService.getBillDetail ───
    console.log('\n[2/4] Testing BillsPayableService.getBillDetail...');
    const detail = await BillsPayableService.getBillDetail(p1Id);
    assert(detail.bill.purchase_id === p1Id, 'getBillDetail returns target bill');
    assert(detail.bill.outstanding_amount === 8000.00, 'getBillDetail shows ₹8,000.00 outstanding');
    assert(detail.items.length === 1 && detail.items[0].description === 'Cake Boxes 1kg', 'getBillDetail returns invoice items');
    assert(detail.voucher && detail.voucher.voucher_no === 'JV-API-001', 'getBillDetail links GL voucher audit trail');

    // ── 3. Test BillsPayableService.settleBills Controls & Guards ───
    console.log('\n[3/4] Testing BillsPayableService.settleBills Controls & SoD...');

    // A. SoD violation: maker_bob tries to disburse
    let sodBobCaught = false;
    try {
      await BillsPayableService.settleBills({
        supplierId: supId,
        branchId: branchId,
        paymentDate: new Date().toISOString().slice(0, 10),
        paymentMethod: 'BANK_TRANSFER',
        bankAccountId: bankId,
        reference: 'UTR-TEST',
        paidBy: 'maker_bob',
        actorRole: 'SUPER_ADMIN',
        allocations: [{ purchaseId: p1Id, amount: 2000.00 }],
      });
    } catch (e) {
      if (e.code === 'SEGREGATION_OF_DUTIES_VIOLATION') sodBobCaught = true;
    }
    assert(sodBobCaught, 'settleBills rejects payment by purchase creator (maker_bob) with SEGREGATION_OF_DUTIES_VIOLATION');

    // B. SoD violation: checker_alice (approver) tries to disburse
    let sodAliceCaught = false;
    try {
      await BillsPayableService.settleBills({
        supplierId: supId,
        branchId: branchId,
        paymentDate: new Date().toISOString().slice(0, 10),
        paymentMethod: 'BANK_TRANSFER',
        bankAccountId: bankId,
        reference: 'UTR-TEST',
        paidBy: 'checker_alice',
        actorRole: 'SUPER_ADMIN',
        allocations: [{ purchaseId: p1Id, amount: 2000.00 }],
      });
    } catch (e) {
      if (e.code === 'SEGREGATION_OF_DUTIES_VIOLATION') sodAliceCaught = true;
    }
    assert(sodAliceCaught, 'settleBills rejects payment by purchase approver (checker_alice) with SEGREGATION_OF_DUTIES_VIOLATION');

    // C. Over-allocation violation: attempting ₹10,000 on ₹8,000 bill
    let overAllocCaught = false;
    try {
      await BillsPayableService.settleBills({
        supplierId: supId,
        branchId: branchId,
        paymentDate: new Date().toISOString().slice(0, 10),
        paymentMethod: 'BANK_TRANSFER',
        bankAccountId: bankId,
        reference: 'UTR-TEST',
        paidBy: 'disburser_dan',
        actorRole: 'SUPER_ADMIN',
        allocations: [{ purchaseId: p1Id, amount: 10000.00 }],
      });
    } catch (e) {
      if (e.code === 'ALLOCATION_EXCEEDS_OUTSTANDING') overAllocCaught = true;
    }
    assert(overAllocCaught, 'settleBills rejects payment exceeding outstanding with ALLOCATION_EXCEEDS_OUTSTANDING');

    // D. Valid partial disbursement of ₹3,000 by independent disburser_dan
    const settle1Res = await BillsPayableService.settleBills({
      supplierId: supId,
      branchId: branchId,
      paymentDate: new Date().toISOString().slice(0, 10),
      paymentMethod: 'BANK_TRANSFER',
      bankAccountId: bankId,
      reference: 'UTR-VALID-001',
      paidBy: 'disburser_dan',
      actorRole: 'SUPER_ADMIN',
      allocations: [{ purchaseId: p1Id, amount: 3000.00 }],
    });
    assert(settle1Res.total_paid === 3000.00, 'settleBills succeeds with ₹3,000.00 disbursed');
    assert(settle1Res.settled_bills[0].new_outstanding === 5000.00, 'Bill 1 remaining balance is ₹5,000.00 (PARTIALLY_PAID)');
    assert(Boolean(settle1Res.voucher.id), `GL payment voucher created: ${settle1Res.voucher.voucher_no}`);
    createdPayments.push(settle1Res.payment.id);
    createdVouchers.push(settle1Res.voucher.id);

    // E. Multi-bill settlement: Settle remaining ₹5,000 on Bill 1 + ₹5,000 on Bill 2 = ₹10,000 total
    const settle2Res = await BillsPayableService.settleBills({
      supplierId: supId,
      branchId: branchId,
      paymentDate: new Date().toISOString().slice(0, 10),
      paymentMethod: 'BANK_TRANSFER',
      bankAccountId: bankId,
      reference: 'UTR-MULTI-10000',
      paidBy: 'disburser_dan',
      actorRole: 'SUPER_ADMIN',
      allocations: [
        { purchaseId: p1Id, amount: 5000.00 },
        { purchaseId: p2Id, amount: 5000.00 },
      ],
    });
    assert(settle2Res.total_paid === 10000.00, 'Multi-bill settlement disbursed ₹10,000.00');
    assert(settle2Res.settled_bills[0].new_outstanding === 0.00, 'Bill 1 now fully PAID (₹0.00 remaining)');
    assert(settle2Res.settled_bills[1].new_outstanding === 0.00, 'Bill 2 now fully PAID (₹0.00 remaining)');
    createdPayments.push(settle2Res.payment.id);
    createdVouchers.push(settle2Res.voucher.id);

    // ── 4. Test HTTP API Routes via Next.js Route Handler ───
    console.log('\n[4/4] Testing Next.js Route Handlers (/api/v1/admin/bills-payable/*)...');

    const adminJwt = signAuthToken({ userId: 'admin_01', role: 'SUPER_ADMIN' });

    // A. GET /api/v1/admin/bills-payable/summary
    const reqSummary = new NextRequest('http://localhost:3000/api/v1/admin/bills-payable/summary', {
      method: 'GET',
      headers: { cookie: `_cth_jwt=${adminJwt}` },
    });
    const resSummary = await GET(reqSummary, { params: { path: ['admin', 'bills-payable', 'summary'] } });
    assert(resSummary.status === 200, 'GET /api/v1/admin/bills-payable/summary returns 200 OK');
    const summaryData = await resSummary.json();
    assert(typeof summaryData.total_payables_amount === 'number', 'Summary returns numeric total_payables_amount');

    // B. GET /api/v1/admin/bills-payable
    const reqList = new NextRequest(`http://localhost:3000/api/v1/admin/bills-payable?supplier_id=${supId}`, {
      method: 'GET',
      headers: { cookie: `_cth_jwt=${adminJwt}` },
    });
    const resList = await GET(reqList, { params: { path: ['admin', 'bills-payable'] } });
    assert(resList.status === 200, 'GET /api/v1/admin/bills-payable returns 200 OK');
    const listData = await resList.json();
    assert(listData.items.length === 2, 'API returns 2 supplier bills');
    assert(listData.items.every(b => b.status === 'PAID'), 'Both bills marked as PAID after disbursements');

    // C. GET /api/v1/admin/bills-payable/:id
    const reqDetail = new NextRequest(`http://localhost:3000/api/v1/admin/bills-payable/${p1Id}`, {
      method: 'GET',
      headers: { cookie: `_cth_jwt=${adminJwt}` },
    });
    const resDetail = await GET(reqDetail, { params: { path: ['admin', 'bills-payable', p1Id] } });
    assert(resDetail.status === 200, `GET /api/v1/admin/bills-payable/${p1Id} returns 200 OK`);
    const detailData = await resDetail.json();
    assert(detailData.bill.purchase_id === p1Id, 'Detail response includes requested bill');
    assert(detailData.payments.length >= 2, 'Detail response includes multiple payment history records');

  } catch (err) {
    console.error('API / Service test failed:', err);
    failed++;
  } finally {
    console.log('\n[Teardown] Cleaning up test fixtures...');
    try {
      if (createdPayments.length > 0) {
        const payVouchers = await client.query(`SELECT voucher_id FROM public.purchase_payment WHERE id = ANY($1) AND voucher_id IS NOT NULL`, [createdPayments]);
        for (const pv of payVouchers.rows) {
          if (pv.voucher_id && !createdVouchers.includes(pv.voucher_id)) {
            createdVouchers.push(pv.voucher_id);
          }
        }
        await client.query(`DELETE FROM public.purchase_payment_allocation WHERE payment_id = ANY($1)`, [createdPayments]);
        await client.query(`DELETE FROM public.purchase_payment WHERE id = ANY($1)`, [createdPayments]);
      }
      if (createdPurchases.length > 0) {
        await client.query(`DELETE FROM public.purchase_item WHERE purchase_id = ANY($1)`, [createdPurchases]);
        await client.query(`DELETE FROM public.purchase_payment_allocation WHERE purchase_id = ANY($1)`, [createdPurchases]);
        await client.query(`DELETE FROM public.purchase WHERE id = ANY($1)`, [createdPurchases]);
      }
      if (createdVouchers.length > 0) {
        const jeRes = await client.query(`SELECT id FROM public.accounting_journal_entry WHERE voucher_id = ANY($1)`, [createdVouchers]);
        const jeIds = jeRes.rows.map(r => r.id);
        if (jeIds.length > 0) {
          await client.query(`DELETE FROM public.accounting_journal_line WHERE journal_entry_id = ANY($1)`, [jeIds]);
          await client.query(`DELETE FROM public.accounting_journal_entry WHERE id = ANY($1)`, [jeIds]);
        }
        await client.query(`DELETE FROM public.accounting_voucher WHERE id = ANY($1)`, [createdVouchers]);
      }
      if (createdBankAccounts.length > 0) {
        await client.query(`DELETE FROM public.bank_account WHERE id = ANY($1)`, [createdBankAccounts]);
      }
      if (createdSuppliers.length > 0) {
        await client.query(`DELETE FROM public.accounting_journal_line WHERE supplier_id = ANY($1)`, [createdSuppliers]);
        await client.query(`DELETE FROM public.supplier WHERE id = ANY($1)`, [createdSuppliers]);
      }
      if (createdCompanies.length > 0) {
        await client.query(`DELETE FROM public.company WHERE id = ANY($1)`, [createdCompanies]);
      }
      console.log('✓ Teardown complete. Restored baseline.');
    } catch (tdErr) {
      console.error('Teardown error:', tdErr);
    } finally {
      await client.end();
    }
  }

  console.log('\n=============================================================================');
  console.log(`  PHASE C7.2 SERVICE & API SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('=============================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runApiAndServiceSuite().catch(err => {
  console.error("Fatal test crash:", err);
  process.exit(1);
});
