/**
 * CakeToHome ERP — Phase 4F Step 4.3 Sales Voucher Approval & SoD Test Suite
 *
 * SCOPE:
 * Voucher SUBMITTED
 *       ↓
 * Canonical Accounting Permission Check (ACCOUNTING.APPROVE via hasEffectivePermission)
 *       ↓
 * Segregation of Duties (SoD) Validation (creator != approver, submitter != approver, etc.)
 *       ↓
 * Source Order & Customer Integrity Validation
 *       ↓
 * Double-Entry Balance Re-verification
 *       ↓
 * APPROVED
 *       ↓
 * Rejection / Cancellation Workflow (SUBMITTED -> CANCELLED with mandatory audit reason)
 *       ↓
 * STOP (Zero financial journal posting, zero inventory movements, zero COGS)
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('../node_modules/pg');

function getConnectionString() {
  if (process.env.PG_URL) return process.env.PG_URL;
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPath = path.join(__dirname, '../../backend/.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    if (line.startsWith('DATABASE_URL=')) return line.substring('DATABASE_URL='.length).trim();
  }
  throw new Error("No database connection string found");
}

async function runTests() {
  console.log('=============================================================================');
  console.log('CakeToHome ERP — Phase 4F Step 4.3 Sales Voucher Approval & SoD Test Suite');
  console.log('=============================================================================\n');

  // Register TypeScript transpile hook for .ts imports
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

  const { SalesPostingService } = require('../src/lib/services/sales-posting.service');
  const { hasEffectivePermission } = require('../src/lib/staff-access-control');

  const client = new Client({ connectionString: getConnectionString() });
  await client.connect();

  let passCount = 0;
  let failCount = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passCount++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failCount++;
    }
  }

  try {
    // ── Group 0: Pre-test baseline audit ─────────────────────────────────────
    console.log('[0/12] Verifying pre-test database baseline...');
    const b0 = await client.query(`
      SELECT
        (SELECT count(*)::int FROM public.accounting_voucher) AS vch_cnt,
        (SELECT count(*)::int FROM public.accounting_journal_entry) AS je_cnt,
        (SELECT count(*)::int FROM public.accounting_journal_line) AS jl_cnt,
        (SELECT count(*)::int FROM public.inventory_cost_lot) AS lot_cnt,
        (SELECT count(*)::int FROM public.inventory_movement) AS mov_cnt,
        (SELECT count(*)::int FROM public.branch_inventory) AS inv_cnt,
        (SELECT count(*)::int FROM public."order") AS ord_cnt,
        (SELECT count(*)::int FROM public.payment_transaction) AS pay_cnt,
        (SELECT count(*)::int FROM public.setting WHERE key = 'accounting_start_date') AS start_date_cnt
    `);
    const pre = b0.rows[0];
    assert(pre.vch_cnt === 0, `Pre-test accounting_voucher === 0 (actual: ${pre.vch_cnt})`);
    assert(pre.je_cnt === 0, `Pre-test accounting_journal_entry === 0 (actual: ${pre.je_cnt})`);
    assert(pre.jl_cnt === 0, `Pre-test accounting_journal_line === 0 (actual: ${pre.jl_cnt})`);
    assert(pre.lot_cnt === 0, `Pre-test inventory_cost_lot === 0 (actual: ${pre.lot_cnt})`);
    assert(pre.mov_cnt === 0, `Pre-test inventory_movement === 0 (actual: ${pre.mov_cnt})`);
    assert(pre.inv_cnt === 424, `Pre-test branch_inventory === 424 (actual: ${pre.inv_cnt})`);
    assert(pre.ord_cnt === 173, `Pre-test order === 173 (actual: ${pre.ord_cnt})`);
    assert(pre.pay_cnt === 53, `Pre-test payment_transaction === 53 (actual: ${pre.pay_cnt})`);
    assert(pre.start_date_cnt === 0, `Accounting start date unconfigured in baseline (actual: ${pre.start_date_cnt})`);

    // ── Group 1: Setup test harness inside isolated rollback transaction ─────
    console.log('\n[1/12] Setting up test harness inside an isolated ROLLBACK transaction...');
    await client.query('BEGIN');

    // 1. Resolve branch
    const brRes = await client.query(`SELECT * FROM public.branch WHERE deleted_at IS NULL LIMIT 2`);
    const branchA = brRes.rows[0];
    const branchB = brRes.rows[1] || brRes.rows[0];
    assert(!!branchA, `Resolved active branch A: ${branchA.name} (${branchA.id})`);

    // Ensure branchA has state 'Karnataka' and GSTIN prefix '29' in metadata
    await client.query(`
      UPDATE public.branch
      SET metadata = jsonb_set(
        COALESCE(metadata, '{}'::jsonb),
        '{state}',
        '"Karnataka"'::jsonb
      ) || jsonb_build_object('gstin', '29AABCU9603R1ZM')
      WHERE id = $1
    `, [branchA.id]);

    // Ensure branchB has state 'Maharashtra' in metadata if distinct
    if (branchB.id !== branchA.id) {
      await client.query(`
        UPDATE public.branch
        SET metadata = jsonb_set(
          COALESCE(metadata, '{}'::jsonb),
          '{state}',
          '"Maharashtra"'::jsonb
        ) || jsonb_build_object('gstin', '27AABCU9603R1ZM')
        WHERE id = $1
      `, [branchB.id]);
    }

    // 2. Resolve catalog products
    const cakeProdRes = await client.query(
      `SELECT p.id, p.title, p.merchandise_type 
       FROM public.product p 
       WHERE p.merchandise_type = 'CAKE' AND p.deleted_at IS NULL LIMIT 1`
    );
    const cakeProd = cakeProdRes.rows[0];
    assert(!!cakeProd, `Resolved catalog CAKE product: ${cakeProd.id}`);

    // Ensure cake has 5% gst_rate in metadata
    await client.query(`
      UPDATE public.product
      SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{gst_rate}', '5'::jsonb)
      WHERE id = $1
    `, [cakeProd.id]);

    // 3. Define actor contexts
    const clerkUser = {
      id: 'usr_clerk_01',
      user_id: 'usr_clerk_01',
      role: 'STAFF',
      permissions: ['SALES.CREATE', 'SALES.SUBMIT'],
    };

    const supervisorUser = {
      id: 'usr_accounting_supervisor_01',
      user_id: 'usr_accounting_supervisor_01',
      role: 'STAFF',
      permissions: ['ACCOUNTING.APPROVE', 'ACCOUNTING.VIEW'],
    };

    const unprivilegedUser = {
      id: 'usr_basic_staff_01',
      user_id: 'usr_basic_staff_01',
      role: 'STAFF',
      permissions: ['SALES.VIEW'],
    };

    const superAdminUser = {
      id: 'usr_super_admin_01',
      user_id: 'usr_super_admin_01',
      role: 'SUPER_ADMIN',
      permissions: ['*'],
    };

    const otherBranchSupervisor = {
      id: 'usr_other_branch_sup_01',
      user_id: 'usr_other_branch_sup_01',
      role: 'STAFF',
      permissions: ['ACCOUNTING.APPROVE'],
      branch_id: branchB.id,
    };

    // 4. Create customer & test order
    const ts = Date.now();
    const custId = `cust_test_appr_${ts}`;
    await client.query(
      `INSERT INTO public.customer (id, first_name, last_name, email, phone, has_account, created_at, updated_at)
       VALUES ($1, 'Test', 'Customer', $2, '9999988888', true, NOW(), NOW())`,
      [custId, `cust_${ts}@test.com`]
    );

    const orderId = `ord_test_appr_${ts}`;
    const orderMetadata = {
      is_ledger_eligible: true,
      branch_id: branchA.id,
      customer_name: 'Test Customer',
      payment_method: 'online',
      delivery_address: { state: 'Karnataka', city: 'Bengaluru' },
      items: [
        {
          product_id: cakeProd.id,
          quantity: 1,
          unit_price: 1000,
          gst_rate: 5,
        }
      ],
      total_amount: 1050,
      created_by: 'usr_commercial_creator_01',
    };

    await client.query(
      `INSERT INTO public."order" (
        id, display_id, customer_id, email, currency_code, status, metadata, created_at, updated_at
      ) VALUES ($1, 91001, $2, $3, 'inr', 'completed', $4, NOW(), NOW())`,
      [orderId, custId, `cust_${ts}@test.com`, JSON.stringify(orderMetadata)]
    );

    // Create draft voucher
    const draftRes = await SalesPostingService.createSalesVoucherDraft({
      orderId,
      createdBy: clerkUser.id,
      branchId: branchA.id,
      client,
    });
    assert(draftRes.success === true, `Created test sales voucher in DRAFT status (${draftRes.data?.id})`);
    const voucherDraft = draftRes.data;

    // ── Group 2: Premature approval guard (DRAFT -> APPROVED blocked) ────────
    console.log('\n[2/12] Testing premature approval guard (DRAFT cannot be approved)...');
    const premApprRes = await SalesPostingService.approveSalesVoucher({
      voucherId: voucherDraft.id,
      approvedBy: supervisorUser.id,
      branchId: branchA.id,
      actorContext: supervisorUser,
      client,
    });
    assert(premApprRes.success === false, 'Approval of DRAFT voucher is rejected');
    assert(premApprRes.code === 'INVALID_VOUCHER_STATE', `Returns INVALID_VOUCHER_STATE (got: ${premApprRes.code})`);

    // Submit voucher: DRAFT -> SUBMITTED
    const submitRes = await SalesPostingService.submitSalesVoucher({
      voucherId: voucherDraft.id,
      submittedBy: clerkUser.id,
      branchId: branchA.id,
      client,
    });
    assert(submitRes.success === true, `Submitted voucher successfully: status is now ${submitRes.data?.status}`);
    const submittedVoucher = submitRes.data;

    // ── Group 3: Canonical permission resolver check (ACCOUNTING.APPROVE) ────
    console.log('\n[3/12] Testing canonical permission resolver check (ACCOUNTING.APPROVE)...');
    const noPermApprRes = await SalesPostingService.approveSalesVoucher({
      voucherId: submittedVoucher.id,
      approvedBy: unprivilegedUser.id,
      branchId: branchA.id,
      actorContext: unprivilegedUser,
      client,
    });
    assert(noPermApprRes.success === false, 'Staff lacking ACCOUNTING.APPROVE is rejected');
    assert(noPermApprRes.code === 'PERMISSION_DENIED', `Returns PERMISSION_DENIED (got: ${noPermApprRes.code})`);

    // ── Group 4: Segregation of Duties (SoD) enforcement ─────────────────────
    console.log('\n[4/12] Testing Segregation of Duties (SoD) enforcement...');

    // 4.1: Voucher creator attempts approval
    const creatorApprRes = await SalesPostingService.approveSalesVoucher({
      voucherId: submittedVoucher.id,
      approvedBy: clerkUser.id,
      branchId: branchA.id,
      actorContext: { ...clerkUser, permissions: ['ACCOUNTING.APPROVE'] }, // simulate creator having approval perm
      client,
    });
    assert(creatorApprRes.success === false, 'Voucher creator cannot approve own voucher');
    assert(creatorApprRes.code === 'SEGREGATION_OF_DUTIES_VIOLATION', `Returns SEGREGATION_OF_DUTIES_VIOLATION for creator (got: ${creatorApprRes.code})`);

    // 4.2: Customer identity attempts approval
    const custApprRes = await SalesPostingService.approveSalesVoucher({
      voucherId: submittedVoucher.id,
      approvedBy: custId,
      branchId: branchA.id,
      actorContext: { id: custId, role: 'CUSTOMER', permissions: ['ACCOUNTING.APPROVE'] },
      client,
    });
    assert(custApprRes.success === false, 'Customer cannot approve sales accounting voucher');
    assert(custApprRes.code === 'SEGREGATION_OF_DUTIES_VIOLATION', `Returns SEGREGATION_OF_DUTIES_VIOLATION for customer (got: ${custApprRes.code})`);

    // 4.3: Commercial order creator attempts approval
    const ordCreatorApprRes = await SalesPostingService.approveSalesVoucher({
      voucherId: submittedVoucher.id,
      approvedBy: 'usr_commercial_creator_01',
      branchId: branchA.id,
      actorContext: { id: 'usr_commercial_creator_01', role: 'STAFF', permissions: ['ACCOUNTING.APPROVE'] },
      client,
    });
    assert(ordCreatorApprRes.success === false, 'Commercial order creator cannot approve voucher');
    assert(ordCreatorApprRes.code === 'SEGREGATION_OF_DUTIES_VIOLATION', `Returns SEGREGATION_OF_DUTIES_VIOLATION for commercial creator (got: ${ordCreatorApprRes.code})`);

    // 4.4: Super Admin who created the voucher cannot bypass SoD
    // Create a voucher drafted by Super Admin on another order
    const saOrderId = `ord_sa_test_${ts}`;
    const saOrderMeta = { ...orderMetadata, created_by: 'usr_some_other_creator' };
    await client.query(
      `INSERT INTO public."order" (
        id, display_id, customer_id, email, currency_code, status, metadata, created_at, updated_at
      ) VALUES ($1, 91002, $2, $3, 'inr', 'completed', $4, NOW(), NOW())`,
      [saOrderId, custId, `cust_${ts}@test.com`, JSON.stringify(saOrderMeta)]
    );

    const saVchRes = await SalesPostingService.createSalesVoucherDraft({
      orderId: saOrderId,
      createdBy: superAdminUser.id,
      branchId: branchA.id,
      client,
    });
    assert(saVchRes.success === true, `Created voucher with Super Admin as creator (${saVchRes.data?.id})`);

    await SalesPostingService.submitSalesVoucher({
      voucherId: saVchRes.data.id,
      submittedBy: superAdminUser.id,
      branchId: branchA.id,
      client,
    });

    const saSelfApprRes = await SalesPostingService.approveSalesVoucher({
      voucherId: saVchRes.data.id,
      approvedBy: superAdminUser.id,
      branchId: branchA.id,
      actorContext: superAdminUser,
      client,
    });
    assert(saSelfApprRes.success === false, 'Super Admin CANNOT self-approve own voucher');
    assert(saSelfApprRes.code === 'SEGREGATION_OF_DUTIES_VIOLATION', `Returns SEGREGATION_OF_DUTIES_VIOLATION for Super Admin self-approval (got: ${saSelfApprRes.code})`);

    // ── Group 5: Cross-branch guard (BOLA defense) ───────────────────────────
    console.log('\n[5/12] Testing cross-branch guard (BOLA defense)...');
    const xBranchApprRes = await SalesPostingService.approveSalesVoucher({
      voucherId: submittedVoucher.id,
      approvedBy: otherBranchSupervisor.id,
      branchId: 'br_mismatched_non_existent',
      actorContext: otherBranchSupervisor,
      client,
    });
    assert(xBranchApprRes.success === false, 'Cross-branch approval attempt is rejected');
    assert(xBranchApprRes.code === 'BRANCH_ACCESS_DENIED', `Returns BRANCH_ACCESS_DENIED (got: ${xBranchApprRes.code})`);

    // ── Group 6: Clean sales voucher approval execution ──────────────────────
    console.log('\n[6/12] Testing clean sales voucher approval execution...');
    const cleanApprRes = await SalesPostingService.approveSalesVoucher({
      voucherId: submittedVoucher.id,
      approvedBy: supervisorUser.id,
      branchId: branchA.id,
      approvalNotes: 'Approved by Finance Supervisor for sales posting.',
      actorContext: supervisorUser,
      client,
    });
    assert(cleanApprRes.success === true, 'Clean sales voucher approval succeeded');
    const approvedVch = cleanApprRes.data.voucher;
    assert(approvedVch.status === 'APPROVED', `Voucher status is APPROVED (actual: ${approvedVch.status})`);
    assert(approvedVch.approved_by === supervisorUser.id, `approved_by matches supervisor ID (actual: ${approvedVch.approved_by})`);
    assert(!!approvedVch.approved_at, `approved_at timestamp is populated (${approvedVch.approved_at})`);
    assert(Number(approvedVch.total_amount) === 1050, `total_amount preserved intact at 1050 (actual: ${approvedVch.total_amount})`);

    const apprMeta = approvedVch.metadata || {};
    assert(apprMeta.approval_notes === 'Approved by Finance Supervisor for sales posting.', 'approval_notes recorded in metadata');
    assert(apprMeta.approval_audit?.voucher_approved_by === supervisorUser.id, 'approval_audit records supervisor ID');
    assert(apprMeta.approval_audit?.voucher_created_by === clerkUser.id, 'approval_audit records creator ID');
    assert(cleanApprRes.data.auditTrail.order_id === orderId, 'Audit trail points to correct orderId');

    // ── Group 7: Re-approval & invalid state guards ──────────────────────────
    console.log('\n[7/12] Testing re-approval & invalid state guards...');
    const reApprRes = await SalesPostingService.approveSalesVoucher({
      voucherId: approvedVch.id,
      approvedBy: supervisorUser.id,
      branchId: branchA.id,
      actorContext: supervisorUser,
      client,
    });
    assert(reApprRes.success === false, 'Re-approval of already APPROVED voucher is rejected');
    assert(reApprRes.code === 'INVALID_VOUCHER_STATE', `Returns INVALID_VOUCHER_STATE for re-approval (got: ${reApprRes.code})`);

    // ── Group 8: Source order integrity & historical quarantine guards ───────
    console.log('\n[8/12] Testing source order integrity & historical quarantine guards...');

    // 8.1: Order canceled after submission
    const canceledOrdId = `ord_canc_test_${ts}`;
    await client.query(
      `INSERT INTO public."order" (
        id, display_id, customer_id, email, currency_code, status, metadata, created_at, updated_at
      ) VALUES ($1, 91003, $2, $3, 'inr', 'completed', $4, NOW(), NOW())`,
      [canceledOrdId, custId, `cust_${ts}@test.com`, JSON.stringify(orderMetadata)]
    );

    const cancVchRes = await SalesPostingService.createSalesVoucherDraft({
      orderId: canceledOrdId,
      createdBy: clerkUser.id,
      branchId: branchA.id,
      client,
    });
    await SalesPostingService.submitSalesVoucher({
      voucherId: cancVchRes.data.id,
      submittedBy: clerkUser.id,
      branchId: branchA.id,
      client,
    });

    // Now mark order canceled in DB
    await client.query(`UPDATE public."order" SET status = 'canceled' WHERE id = $1`, [canceledOrdId]);

    const cancApprRes = await SalesPostingService.approveSalesVoucher({
      voucherId: cancVchRes.data.id,
      approvedBy: supervisorUser.id,
      branchId: branchA.id,
      actorContext: supervisorUser,
      client,
    });
    assert(cancApprRes.success === false, 'Approval rejected when linked order was canceled');
    assert(cancApprRes.code === 'INVALID_ORDER_STATUS', `Returns INVALID_ORDER_STATUS (got: ${cancApprRes.code})`);

    // 8.2: Quarantined prototype order
    await client.query(
      `UPDATE public."order" SET status = 'completed', metadata = jsonb_set(metadata, '{legacy_prototype}', 'true') WHERE id = $1`,
      [canceledOrdId]
    );
    const protoApprRes = await SalesPostingService.approveSalesVoucher({
      voucherId: cancVchRes.data.id,
      approvedBy: supervisorUser.id,
      branchId: branchA.id,
      actorContext: supervisorUser,
      client,
    });
    assert(protoApprRes.success === false, 'Approval rejected for quarantined legacy prototype order');
    assert(protoApprRes.code === 'LEGACY_PROTOTYPE_ORDER_REJECTED', `Returns LEGACY_PROTOTYPE_ORDER_REJECTED (got: ${protoApprRes.code})`);

    // ── Group 9: Double-entry balance integrity check ────────────────────────
    console.log('\n[9/12] Testing double-entry balance integrity check...');
    const unbalOrdId = `ord_unbal_test_${ts}`;
    await client.query(
      `INSERT INTO public."order" (
        id, display_id, customer_id, email, currency_code, status, metadata, created_at, updated_at
      ) VALUES ($1, 91004, $2, $3, 'inr', 'completed', $4, NOW(), NOW())`,
      [unbalOrdId, custId, `cust_${ts}@test.com`, JSON.stringify(orderMetadata)]
    );

    const unbalVchRes = await SalesPostingService.createSalesVoucherDraft({
      orderId: unbalOrdId,
      createdBy: clerkUser.id,
      branchId: branchA.id,
      client,
    });
    await SalesPostingService.submitSalesVoucher({
      voucherId: unbalVchRes.data.id,
      submittedBy: clerkUser.id,
      branchId: branchA.id,
      client,
    });

    // Tamper with metadata to corrupt proposed journal lines
    await client.query(
      `UPDATE public.accounting_voucher 
       SET metadata = jsonb_set(metadata, '{proposed_journal_lines,0,debit_amount}', '9999.00')
       WHERE id = $1`,
      [unbalVchRes.data.id]
    );

    const unbalApprRes = await SalesPostingService.approveSalesVoucher({
      voucherId: unbalVchRes.data.id,
      approvedBy: supervisorUser.id,
      branchId: branchA.id,
      actorContext: supervisorUser,
      client,
    });
    assert(unbalApprRes.success === false, 'Approval rejected when proposed journal lines are unbalanced');
    assert(unbalApprRes.code === 'VOUCHER_UNBALANCED', `Returns VOUCHER_UNBALANCED (got: ${unbalApprRes.code})`);

    // ── Group 10: Rejection / cancellation workflow ──────────────────────────
    console.log('\n[10/12] Testing rejection / cancellation workflow (rejectSalesVoucher)...');

    // 10.1: Missing rejection reason
    const rejNoReasonRes = await SalesPostingService.rejectSalesVoucher({
      voucherId: unbalVchRes.data.id,
      rejectedBy: supervisorUser.id,
      rejectionReason: '   ',
      branchId: branchA.id,
      actorContext: supervisorUser,
      client,
    });
    assert(rejNoReasonRes.success === false, 'Rejection without reason is rejected');
    assert(rejNoReasonRes.code === 'INVALID_VOUCHER_STATE', `Returns INVALID_VOUCHER_STATE (got: ${rejNoReasonRes.code})`);

    // 10.2: Caller lacking permission
    const rejNoPermRes = await SalesPostingService.rejectSalesVoucher({
      voucherId: unbalVchRes.data.id,
      rejectedBy: unprivilegedUser.id,
      rejectionReason: 'Corrupted voucher lines.',
      branchId: branchA.id,
      actorContext: unprivilegedUser,
      client,
    });
    assert(rejNoPermRes.success === false, 'Staff lacking permission cannot reject voucher');
    assert(rejNoPermRes.code === 'PERMISSION_DENIED', `Returns PERMISSION_DENIED (got: ${rejNoPermRes.code})`);

    // 10.3: Clean rejection by authorized supervisor
    const cleanRejRes = await SalesPostingService.rejectSalesVoucher({
      voucherId: unbalVchRes.data.id,
      rejectedBy: supervisorUser.id,
      rejectionReason: 'Corrupted voucher lines detected by audit.',
      branchId: branchA.id,
      actorContext: supervisorUser,
      client,
    });
    assert(cleanRejRes.success === true, 'Authorized supervisor rejected submitted voucher');
    const cancelledVch = cleanRejRes.data;
    assert(cancelledVch.status === 'CANCELLED', `Voucher status transitioned to CANCELLED (got: ${cancelledVch.status})`);
    assert(cancelledVch.cancelled_by === supervisorUser.id, 'cancelled_by matches supervisor ID');
    assert(cancelledVch.metadata?.rejection_reason === 'Corrupted voucher lines detected by audit.', 'rejection_reason recorded in metadata');

    // 10.4: Attempt to approve a CANCELLED voucher
    const apprCancVchRes = await SalesPostingService.approveSalesVoucher({
      voucherId: cancelledVch.id,
      approvedBy: supervisorUser.id,
      branchId: branchA.id,
      actorContext: supervisorUser,
      client,
    });
    assert(apprCancVchRes.success === false, 'Cannot approve a CANCELLED voucher');
    assert(apprCancVchRes.code === 'INVALID_VOUCHER_STATE', `Returns INVALID_VOUCHER_STATE for cancelled voucher (got: ${apprCancVchRes.code})`);

    // ── Group 11: Strict non-posting & inventory isolation audit ─────────────
    console.log('\n[11/12] Auditing strict non-posting & inventory isolation...');
    const auditRes = await client.query(`
      SELECT
        (SELECT count(*)::int FROM public.accounting_journal_entry) AS je_cnt,
        (SELECT count(*)::int FROM public.accounting_journal_line) AS jl_cnt,
        (SELECT count(*)::int FROM public.inventory_cost_lot) AS lot_cnt,
        (SELECT count(*)::int FROM public.inventory_movement) AS mov_cnt,
        (SELECT count(*)::int FROM public.branch_inventory) AS inv_cnt
    `);
    const aud = auditRes.rows[0];
    assert(aud.je_cnt === 0, `ZERO journal entries created during approval (actual: ${aud.je_cnt})`);
    assert(aud.jl_cnt === 0, `ZERO journal lines created during approval (actual: ${aud.jl_cnt})`);
    assert(aud.lot_cnt === 0, `ZERO inventory cost lots created or consumed (actual: ${aud.lot_cnt})`);
    assert(aud.mov_cnt === 0, `ZERO inventory movements created (actual: ${aud.mov_cnt})`);
    assert(aud.inv_cnt === 424, `Branch inventory strictly preserved at 424 (actual: ${aud.inv_cnt})`);

    // ── Group 12: Rollback transaction & post-rollback baseline audit ────────
    console.log('\n[12/12] Rolling back test transaction and verifying pristine database baseline...');
    await client.query('ROLLBACK');

    const bPost = await client.query(`
      SELECT
        (SELECT count(*)::int FROM public.accounting_voucher) AS vch_cnt,
        (SELECT count(*)::int FROM public.accounting_journal_entry) AS je_cnt,
        (SELECT count(*)::int FROM public.accounting_journal_line) AS jl_cnt,
        (SELECT count(*)::int FROM public.inventory_cost_lot) AS lot_cnt,
        (SELECT count(*)::int FROM public.inventory_movement) AS mov_cnt,
        (SELECT count(*)::int FROM public.branch_inventory) AS inv_cnt,
        (SELECT count(*)::int FROM public."order") AS ord_cnt,
        (SELECT count(*)::int FROM public.payment_transaction) AS pay_cnt,
        (SELECT count(*)::int FROM public.setting WHERE key = 'accounting_start_date') AS start_date_cnt
    `);
    const post = bPost.rows[0];
    assert(post.vch_cnt === 0, `Post-rollback accounting_voucher returned to 0 (actual: ${post.vch_cnt})`);
    assert(post.je_cnt === 0, `Post-rollback accounting_journal_entry returned to 0 (actual: ${post.je_cnt})`);
    assert(post.jl_cnt === 0, `Post-rollback accounting_journal_line returned to 0 (actual: ${post.jl_cnt})`);
    assert(post.lot_cnt === 0, `Post-rollback inventory_cost_lot returned to 0 (actual: ${post.lot_cnt})`);
    assert(post.mov_cnt === 0, `Post-rollback inventory_movement returned to 0 (actual: ${post.mov_cnt})`);
    assert(post.inv_cnt === 424, `Post-rollback branch_inventory returned to 424 (actual: ${post.inv_cnt})`);
    assert(post.ord_cnt === 173, `Post-rollback order remained untouched at 173 (actual: ${post.ord_cnt})`);
    assert(post.pay_cnt === 53, `Post-rollback payment_transaction remained untouched at 53 (actual: ${post.pay_cnt})`);
    assert(post.start_date_cnt === 0, `Accounting start date remained unconfigured (actual: ${post.start_date_cnt})`);

  } catch (err) {
    console.error('Test suite encountered an unhandled exception:', err);
    try {
      await client.query('ROLLBACK');
    } catch {}
    failCount++;
  } finally {
    await client.end();
  }

  console.log('\n=============================================================================');
  console.log(`STEP 4.3 TEST SUITE SUMMARY: ${passCount} Passed, ${failCount} Failed (Total: ${passCount + failCount})`);
  console.log('=============================================================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

runTests();
