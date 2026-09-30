/**
 * CakeToHome ERP — Phase 4F Step 3D.3 Purchase Accounting Voucher Approval & SoD Test Suite
 *
 * SCOPE:
 * Voucher DRAFT
 *       ↓
 * SUBMITTED
 *       ↓
 * Accounting permission check (hasEffectivePermission)
 *       ↓
 * Segregation of Duties (SoD) validation
 *       ↓
 * APPROVED
 *       ↓
 * STOP (Zero financial/physical posting)
 *
 * INVARIANTS TESTED:
 * 1. Canonical Permission Resolution: Approver must possess ACCOUNTING.APPROVE
 *    evaluated through hasEffectivePermission (not merely arbitrary role strings).
 * 2. 5 Distinct Audit Identities:
 *    purchase.created_by (Buyer)
 *    purchase.approved_by (Store Manager / Commercial Approver)
 *    voucher.created_by (AP Clerk / Preparer)
 *    voucher.submitted_by (AP Submitter)
 *    voucher.approved_by (Accounting Supervisor)
 * 3. Segregation of Duties Enforcement:
 *    - approved_by !== voucher.created_by
 *    - approved_by !== voucher.submitted_by
 *    - approved_by !== purchase.created_by
 *    - approved_by !== purchase.approved_by
 *    - Super Admin cannot bypass SoD (self-approval strictly prohibited)
 * 4. Lifecycle state machine: DRAFT -> SUBMITTED -> APPROVED.
 *    No premature approval from DRAFT. No re-approval from APPROVED.
 * 5. Branch Boundary: Cross-branch approval rejected (BOLA defense).
 * 6. Rejection / Cancellation: SUBMITTED -> CANCELLED with mandatory audit reason.
 * 7. STRICT BOUNDARY:
 *    - NO permanent DB rows (full rollback)
 *    - NO journal entries or lines created
 *    - NO cost lots or inventory movements created
 *    - NO branch_inventory mutations (remains 424)
 *    - NO purchase status to POSTED
 *    - NO fiscal period or accounting start date configured
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
  console.log('CakeToHome ERP — Phase 4F Step 3D.3 Voucher Accounting Approval & SoD Tests');
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

  const { PurchasePostingService } = require('../src/lib/services/purchase-posting.service');
  const { StaffAccessControl, hasEffectivePermission } = require('../src/lib/staff-access-control');

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
    console.log('[1/8] Setting up isolated rollback transaction & test fixtures...');
    await client.query('BEGIN');

    // Resolve an existing active branch in Karnataka
    const bRes = await client.query(`
      SELECT b.id, b.name, b.metadata
      FROM public.branch b
      WHERE b.deleted_at IS NULL AND b.metadata->>'state' = 'Karnataka'
      LIMIT 1
    `);
    const branchKa = bRes.rows[0];
    assert(Boolean(branchKa), `Found active Karnataka branch (${branchKa.id})`);

    // Setup another branch for BOLA testing
    const b2Res = await client.query(`
      SELECT b.id, b.name
      FROM public.branch b
      WHERE b.deleted_at IS NULL AND b.id != $1
      LIMIT 1
    `, [branchKa.id]);
    const branchOther = b2Res.rows[0];
    assert(Boolean(branchOther), `Found second branch for cross-branch testing (${branchOther?.id})`);

    // Setup Test Supplier
    await client.query(`
      INSERT INTO public.supplier (id, name, gstin, state, is_active, created_at, updated_at)
      VALUES 
        ('sup_test_ka_3d3', 'Karnataka Approval Test Supplier Ltd', '29AABCU9603R1Z2', 'Karnataka', true, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET 
        name = EXCLUDED.name, gstin = EXCLUDED.gstin, state = EXCLUDED.state;
    `);

    // Setup Test Staff Accounts in StaffAccessControl for Permission Testing
    // 1. Accounting Supervisor with profile containing ACCOUNTING.APPROVE
    try {
      StaffAccessControl.createStaffMember({
        name: "Suresh Accounting Sup",
        phone: "+91 98888 11111",
        email: "suresh.sup@cakes2home.com",
        role: "STAFF",
        accessProfileIds: ["prof_catalog_admin"], // temporary
      }, "admin_01", "Super Admin");
    } catch {} // Ignore if already registered in in-memory singleton

    // Give explicit ALLOW override to supervisor for ACCOUNTING.APPROVE
    const supStaff = StaffAccessControl.getStaffMemberByEmail("suresh.sup@cakes2home.com");
    if (supStaff) {
      StaffAccessControl.setStaffOverride(supStaff.id, "ACCOUNTING.APPROVE", "ALLOW", "admin_01");
    }

    // 2. Staff Member with explicit DENY override
    try {
      StaffAccessControl.createStaffMember({
        name: "Ramesh Denied Clerk",
        phone: "+91 98888 22222",
        email: "ramesh.denied@cakes2home.com",
        role: "STAFF",
        accessProfileIds: ["prof_catalog_admin"],
      }, "admin_01", "Super Admin");
    } catch {}
    const deniedStaff = StaffAccessControl.getStaffMemberByEmail("ramesh.denied@cakes2home.com");
    if (deniedStaff) {
      StaffAccessControl.setStaffOverride(deniedStaff.id, "ACCOUNTING.APPROVE", "DENY", "admin_01");
    }

    // Helper to create an APPROVED commercial purchase header
    async function createTestPurchase(purchaseId, buyerId, storeMgrId, status = 'APPROVED') {
      await client.query(`
        INSERT INTO public.purchase (
          id, supplier_id, branch_id, invoice_no, invoice_date,
          subtotal, discount, taxable_value, cgst, sgst, igst, total,
          status, created_by, approved_by, created_at, updated_at
        ) VALUES (
          $1, 'sup_test_ka_3d3', $2, 'INV-' || $1, '2026-09-24',
          5000.00, 0.00, 5000.00, 125.00, 125.00, 0.00, 5250.00,
          $3, $4, $5, NOW(), NOW()
        )
      `, [purchaseId, branchKa.id, status, buyerId, storeMgrId]);

      await client.query(`
        INSERT INTO public.purchase_item (
          id, purchase_id, product_id, variant_id, description,
          quantity, rate, discount, taxable_value,
          cgst_rate, sgst_rate, igst_rate, cgst, sgst, igst, total,
          item_type, created_at, updated_at
        ) VALUES 
          ($1, $2, 'prod_01KXYMAJKNWZCFXJHESPTZE01G', NULL, 'Classic Chocolate Cake 1kg',
           10, 500.00, 0.00, 5000.00, 2.50, 2.50, 0.00, 125.00, 125.00, 0.00, 5250.00,
           'CAKE', NOW(), NOW())
      `, [`pi_${purchaseId}`, purchaseId]);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TEST GROUP 1: Canonical Permission Resolution (hasEffectivePermission)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[2/8] Testing Canonical Permission Resolution via hasEffectivePermission...');

    // 1. Super Admin resolves true
    const adminCheck = hasEffectivePermission({ id: "admin_01", role: "SUPER_ADMIN" }, "ACCOUNTING.APPROVE");
    assert(adminCheck === true, 'SUPER_ADMIN has effective ACCOUNTING.APPROVE permission');

    // 2. Supervisor with explicit ALLOW resolves true
    const supCheck = hasEffectivePermission({ id: supStaff.id, role: "STAFF" }, "ACCOUNTING.APPROVE");
    assert(supCheck === true, 'Staff member with explicit ALLOW override has ACCOUNTING.APPROVE');

    // 3. Staff with explicit DENY resolves false
    const deniedCheck = hasEffectivePermission({ id: deniedStaff.id, role: "STAFF" }, "ACCOUNTING.APPROVE");
    assert(deniedCheck === false, 'Staff member with explicit DENY override is denied ACCOUNTING.APPROVE');

    // 4. Standard staff (Telecaller) resolves false (fail closed)
    const telecallerCheck = hasEffectivePermission({ id: "staff_01", role: "STAFF" }, "ACCOUNTING.APPROVE");
    assert(telecallerCheck === false, 'Standard Telecaller staff lacks ACCOUNTING.APPROVE (fails closed)');

    // 5. Role spoofing: ordinary user passing arbitrary role string without verified profile fails
    const spoofCheck = hasEffectivePermission({ id: "staff_01", role: "ACCOUNTANT" }, "ACCOUNTING.APPROVE");
    assert(spoofCheck === false, 'Arbitrary role-name string spoofing fails closed');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST GROUP 2: Full Valid Lifecycle (DRAFT → SUBMITTED → APPROVED → STOP)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[3/8] Testing Full Valid Lifecycle & 5 Distinct Audit Identities...');

    const pMainId = 'pch_valid_lifecycle_3d3';
    await createTestPurchase(pMainId, 'usr_buyer_01', 'usr_store_mgr_01');

    // 1. Create DRAFT voucher by AP clerk
    const draftRes = await PurchasePostingService.createPurchaseVoucherDraft({
      purchaseId: pMainId,
      createdBy: 'usr_ap_clerk_01',
      branchId: branchKa.id,
      client,
    });
    assert(draftRes.success === true, 'createPurchaseVoucherDraft succeeds');
    const draftVoucher = draftRes.data;
    assert(draftVoucher.status === 'DRAFT', 'voucher created in DRAFT status');
    assert(draftVoucher.created_by === 'usr_ap_clerk_01', 'voucher.created_by is usr_ap_clerk_01');

    // 2. Submit voucher by AP submitter
    const submitRes = await PurchasePostingService.submitPurchaseVoucher({
      voucherId: draftVoucher.id,
      submittedBy: 'usr_ap_submitter_01',
      branchId: branchKa.id,
      client,
    });
    assert(submitRes.success === true, 'submitPurchaseVoucher succeeds');
    const submittedVoucher = submitRes.data;
    assert(submittedVoucher.status === 'SUBMITTED', 'voucher transitioned to SUBMITTED status');
    assert(submittedVoucher.submitted_by === 'usr_ap_submitter_01', 'voucher.submitted_by is usr_ap_submitter_01');
    assert(Boolean(submittedVoucher.submitted_at), 'voucher.submitted_at is recorded');

    // 3. Accounting Permission Check & Approval by Accounting Supervisor
    const approveRes = await PurchasePostingService.approvePurchaseVoucher({
      voucherId: submittedVoucher.id,
      approvedBy: supStaff.id,
      actorRole: 'STAFF',
      branchId: branchKa.id,
      approvalNotes: 'Invoice matches PO and physical goods inspection verified by Indiranagar kitchen',
      client,
    });
    assert(approveRes.success === true, `approvePurchaseVoucher succeeds (error: ${approveRes.error || 'none'})`);
    const approvedVoucher = approveRes.data.voucher;
    assert(approvedVoucher.status === 'APPROVED', 'voucher transitioned to APPROVED status');
    assert(approvedVoucher.approved_by === supStaff.id, `voucher.approved_by is ${supStaff.id}`);
    assert(Boolean(approvedVoucher.approved_at), 'voucher.approved_at timestamp is populated');

    // 4. Verify Preservation of 5 Distinct Audit Identities
    const audit = approveRes.data.auditTrail;
    assert(audit.purchase_created_by === 'usr_buyer_01', 'auditTrail preserves purchase_created_by (Buyer)');
    assert(audit.purchase_approved_by === 'usr_store_mgr_01', 'auditTrail preserves purchase_approved_by (Store Manager)');
    assert(audit.voucher_created_by === 'usr_ap_clerk_01', 'auditTrail preserves voucher_created_by (AP Clerk)');
    assert(audit.voucher_submitted_by === 'usr_ap_submitter_01', 'auditTrail preserves voucher_submitted_by (AP Submitter)');
    assert(audit.voucher_approved_by === supStaff.id, 'auditTrail preserves voucher_approved_by (Accounting Supervisor)');

    // 5. Verify Metadata Contains Full Audit Record
    assert(approvedVoucher.metadata?.approval_notes?.includes('physical goods inspection'), 'supervisor approval notes stored in metadata');
    assert(approvedVoucher.metadata?.approval_audit?.voucher_approved_by === supStaff.id, 'approval_audit embedded in voucher metadata');

    // 6. Verify Strict Boundaries (STOP at APPROVED)
    const pCheck = await client.query('SELECT status FROM public.purchase WHERE id = $1', [pMainId]);
    assert(pCheck.rows[0].status === 'APPROVED', 'Purchase status remains APPROVED (NOT POSTED)');

    const jCheck = await client.query('SELECT COUNT(*) FROM public.accounting_journal_entry');
    assert(parseInt(jCheck.rows[0].count, 10) === 0, 'No general ledger journal entries created (count = 0)');

    const lotCheck = await client.query('SELECT COUNT(*) FROM public.inventory_cost_lot');
    assert(parseInt(lotCheck.rows[0].count, 10) === 0, 'No inventory cost lots created (count = 0)');

    const mvtCheck = await client.query('SELECT COUNT(*) FROM public.inventory_movement');
    assert(parseInt(mvtCheck.rows[0].count, 10) === 0, 'No inventory movements created (count = 0)');

    const invCheck = await client.query('SELECT COUNT(*) FROM public.branch_inventory');
    assert(parseInt(invCheck.rows[0].count, 10) === 424, 'branch_inventory count remains exactly 424');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST GROUP 3: Segregation of Duties (SoD) Violations
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[4/8] Testing Segregation of Duties (SoD) Violations...');

    // Setup helper to create a SUBMITTED voucher with known identities
    async function createSubmittedVoucher(purchaseId, vId, buyer, storeMgr, apClerk, apSubmitter) {
      await createTestPurchase(purchaseId, buyer, storeMgr);
      const d = await PurchasePostingService.createPurchaseVoucherDraft({
        purchaseId,
        createdBy: apClerk,
        branchId: branchKa.id,
        client,
      });
      const s = await PurchasePostingService.submitPurchaseVoucher({
        voucherId: d.data.id,
        submittedBy: apSubmitter,
        branchId: branchKa.id,
        client,
      });
      return s.data;
    }

    // 3A: Self-Approval by Voucher Creator (AP Clerk cannot approve own voucher)
    const vSod1 = await createSubmittedVoucher('pch_sod_01', 'v_sod_01', 'usr_b1', 'usr_m1', supStaff.id, 'usr_sub1');
    const sodRes1 = await PurchasePostingService.approvePurchaseVoucher({
      voucherId: vSod1.id,
      approvedBy: supStaff.id,
      actorRole: 'STAFF',
      branchId: branchKa.id,
      client,
    });
    assert(sodRes1.success === false, 'Voucher creator self-approval rejected');
    assert(sodRes1.code === 'SEGREGATION_OF_DUTIES_VIOLATION', `Error code is SEGREGATION_OF_DUTIES_VIOLATION (got ${sodRes1.code})`);
    assert(sodRes1.error.includes('Voucher creator') && sodRes1.error.includes('cannot approve their own voucher'), 'Expected descriptive SoD error message');

    // 3B: Self-Approval by Voucher Submitter (AP Submitter cannot approve)
    const vSod2 = await createSubmittedVoucher('pch_sod_02', 'v_sod_02', 'usr_b2', 'usr_m2', 'usr_clerk2', supStaff.id);
    const sodRes2 = await PurchasePostingService.approvePurchaseVoucher({
      voucherId: vSod2.id,
      approvedBy: supStaff.id,
      actorRole: 'STAFF',
      branchId: branchKa.id,
      client,
    });
    assert(sodRes2.success === false, 'Voucher submitter approval rejected');
    assert(sodRes2.code === 'SEGREGATION_OF_DUTIES_VIOLATION', 'Voucher submitter rejected with SEGREGATION_OF_DUTIES_VIOLATION');
    assert(sodRes2.error.includes('Voucher submitter'), 'Expected voucher submitter SoD error message');

    // 3C: Approval by Commercial Purchase Creator (Buyer cannot approve accounting voucher)
    const vSod3 = await createSubmittedVoucher('pch_sod_03', 'v_sod_03', supStaff.id, 'usr_m3', 'usr_clerk3', 'usr_sub3');
    const sodRes3 = await PurchasePostingService.approvePurchaseVoucher({
      voucherId: vSod3.id,
      approvedBy: supStaff.id,
      actorRole: 'STAFF',
      branchId: branchKa.id,
      client,
    });
    assert(sodRes3.success === false, 'Purchase creator (Buyer) cannot approve accounting voucher');
    assert(sodRes3.code === 'SEGREGATION_OF_DUTIES_VIOLATION', 'Purchase creator rejected with SEGREGATION_OF_DUTIES_VIOLATION');
    assert(sodRes3.error.includes('Purchase creator'), 'Expected purchase creator SoD error message');

    // 3D: Approval by Commercial Purchase Approver (Store Manager != Accounting Approver)
    const vSod4 = await createSubmittedVoucher('pch_sod_04', 'v_sod_04', 'usr_b4', supStaff.id, 'usr_clerk4', 'usr_sub4');
    const sodRes4 = await PurchasePostingService.approvePurchaseVoucher({
      voucherId: vSod4.id,
      approvedBy: supStaff.id,
      actorRole: 'STAFF',
      branchId: branchKa.id,
      client,
    });
    assert(sodRes4.success === false, 'Commercial purchase approver cannot approve accounting voucher (dual control)');
    assert(sodRes4.code === 'SEGREGATION_OF_DUTIES_VIOLATION', 'Store manager rejected with SEGREGATION_OF_DUTIES_VIOLATION');
    assert(sodRes4.error.includes('Commercial purchase approver'), 'Expected commercial approver SoD error message');

    // 3E: Super Admin Cannot Bypass Segregation of Duties
    const vSod5 = await createSubmittedVoucher('pch_sod_05', 'v_sod_05', 'usr_b5', 'usr_m5', 'admin_01', 'usr_sub5');
    // admin_01 created the voucher draft, now tries to approve it
    const sodRes5 = await PurchasePostingService.approvePurchaseVoucher({
      voucherId: vSod5.id,
      approvedBy: 'admin_01',
      actorRole: 'SUPER_ADMIN',
      branchId: branchKa.id,
      client,
    });
    assert(sodRes5.success === false, 'SUPER_ADMIN cannot bypass SoD (cannot approve own voucher)');
    assert(sodRes5.code === 'SEGREGATION_OF_DUTIES_VIOLATION', 'SUPER_ADMIN self-approval rejected with SEGREGATION_OF_DUTIES_VIOLATION');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST GROUP 4: Permission-Resolver-Based Authorization Testing
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[5/8] Testing Permission-Resolver-Based Authorization...');

    const vPerm = await createSubmittedVoucher('pch_perm_01', 'v_perm_01', 'usr_b6', 'usr_m6', 'usr_c6', 'usr_s6');

    // 4A: Unauthorized staff member (no permission)
    const permRes1 = await PurchasePostingService.approvePurchaseVoucher({
      voucherId: vPerm.id,
      approvedBy: 'staff_01', // Priya Sharma (Telecaller)
      actorRole: 'STAFF',
      branchId: branchKa.id,
      client,
    });
    assert(permRes1.success === false, 'Staff lacking ACCOUNTING.APPROVE is rejected');
    assert(permRes1.code === 'PERMISSION_DENIED', `Error code is PERMISSION_DENIED (got ${permRes1.code})`);
    assert(permRes1.error.includes('lacks required permission'), 'Expected lack of permission error message');

    // 4B: Staff member with explicit DENY override
    const permRes2 = await PurchasePostingService.approvePurchaseVoucher({
      voucherId: vPerm.id,
      approvedBy: deniedStaff.id,
      actorRole: 'STAFF',
      branchId: branchKa.id,
      client,
    });
    assert(permRes2.success === false, 'Staff with explicit DENY override is rejected');
    assert(permRes2.code === 'PERMISSION_DENIED', 'Denied staff rejected with PERMISSION_DENIED');

    // 4C: Unregistered external identity
    const permRes3 = await PurchasePostingService.approvePurchaseVoucher({
      voucherId: vPerm.id,
      approvedBy: 'usr_completely_unknown_999',
      actorRole: 'STAFF',
      branchId: branchKa.id,
      client,
    });
    assert(permRes3.success === false, 'Unknown actor is rejected (fail closed)');
    assert(permRes3.code === 'PERMISSION_DENIED', 'Unknown actor rejected with PERMISSION_DENIED');

    // 4D: Super Admin distinct from creator succeeds
    const permRes4 = await PurchasePostingService.approvePurchaseVoucher({
      voucherId: vPerm.id,
      approvedBy: 'admin_01',
      actorRole: 'SUPER_ADMIN',
      branchId: branchKa.id,
      client,
    });
    assert(permRes4.success === true, 'SUPER_ADMIN distinct from creator succeeds');
    assert(permRes4.data?.voucher.status === 'APPROVED', 'Voucher is now APPROVED');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST GROUP 5: Lifecycle & State Machine Constraints
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[6/8] Testing Voucher Lifecycle & State Machine Constraints...');

    // 5A: Premature approval on DRAFT voucher (skipped submission)
    const pDraft = 'pch_lifecycle_draft_01';
    await createTestPurchase(pDraft, 'usr_b7', 'usr_m7');
    const draftOnly = await PurchasePostingService.createPurchaseVoucherDraft({
      purchaseId: pDraft,
      createdBy: 'usr_c7',
      branchId: branchKa.id,
      client,
    });
    const prematureRes = await PurchasePostingService.approvePurchaseVoucher({
      voucherId: draftOnly.data.id,
      approvedBy: 'admin_01',
      actorRole: 'SUPER_ADMIN',
      branchId: branchKa.id,
      client,
    });
    assert(prematureRes.success === false, 'Cannot approve voucher in DRAFT status');
    assert(prematureRes.code === 'INVALID_VOUCHER_STATE', `Error code is INVALID_VOUCHER_STATE (got ${prematureRes.code})`);
    assert(prematureRes.error.includes('must first be submitted'), 'Expected "must first be submitted" error');

    // 5B: Re-approval on already APPROVED voucher
    const reApproveRes = await PurchasePostingService.approvePurchaseVoucher({
      voucherId: vPerm.id, // vPerm is already APPROVED from Test 4D
      approvedBy: supStaff.id,
      actorRole: 'STAFF',
      branchId: branchKa.id,
      client,
    });
    assert(reApproveRes.success === false, 'Cannot re-approve already APPROVED voucher');
    assert(reApproveRes.code === 'INVALID_VOUCHER_STATE', 'Re-approval rejected with INVALID_VOUCHER_STATE');
    assert(reApproveRes.error.includes('already APPROVED'), 'Expected "already APPROVED" error');

    // 5C: Approval on voucher linked to non-APPROVED purchase
    const pUnapp = 'pch_unapproved_header_01';
    await createTestPurchase(pUnapp, 'usr_b8', 'usr_m8', 'SUBMITTED'); // purchase status is SUBMITTED, not APPROVED
    // Directly insert voucher linked to this purchase for testing
    const fakeVId = 'vch_test_unapp_pch';
    await client.query(`
      INSERT INTO public.accounting_voucher (
        id, voucher_no, voucher_type, voucher_date, branch_id, fiscal_year,
        status, total_amount, reference_type, reference_id, reference_event,
        narration, created_by, submitted_by, submitted_at, created_at, updated_at
      ) VALUES (
        $1, 'VCH-TEST-UNAPP', 'PURCHASE', '2026-09-24', $2, '2026-2027',
        'SUBMITTED', 5250.00, 'PURCHASE', $3, 'INVOICE_POSTED',
        'Test voucher for unapproved purchase', 'usr_c8', 'usr_s8', NOW(), NOW(), NOW()
      )
    `, [fakeVId, branchKa.id, pUnapp]);

    const unappPchRes = await PurchasePostingService.approvePurchaseVoucher({
      voucherId: fakeVId,
      approvedBy: 'admin_01',
      actorRole: 'SUPER_ADMIN',
      branchId: branchKa.id,
      client,
    });
    assert(unappPchRes.success === false, 'Cannot approve voucher for non-APPROVED purchase');
    assert(unappPchRes.code === 'INVALID_PURCHASE_STATUS', `Error code is INVALID_PURCHASE_STATUS (got ${unappPchRes.code})`);

    // ─────────────────────────────────────────────────────────────────────────
    // TEST GROUP 6: Branch Authorization Boundaries (BOLA / IDOR)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[7/8] Testing Branch Authorization Boundaries...');

    const vBola = await createSubmittedVoucher('pch_bola_01', 'v_bola_01', 'usr_b9', 'usr_m9', 'usr_c9', 'usr_s9');

    // Attempt approval with mismatching branchId
    const bolaRes = await PurchasePostingService.approvePurchaseVoucher({
      voucherId: vBola.id,
      approvedBy: 'admin_01',
      actorRole: 'SUPER_ADMIN',
      branchId: branchOther.id, // Different branch!
      client,
    });
    assert(bolaRes.success === false, 'Cross-branch voucher approval is blocked');
    assert(bolaRes.code === 'BRANCH_ACCESS_DENIED', `Error code is BRANCH_ACCESS_DENIED (got ${bolaRes.code})`);
    assert(bolaRes.error.includes('Access denied'), 'Expected access denied message');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST GROUP 7: Rejection & Cancellation Workflow
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[8/8] Testing Rejection & Cancellation Workflow...');

    const vReject = await createSubmittedVoucher('pch_rej_01', 'v_rej_01', 'usr_b10', 'usr_m10', 'usr_c10', 'usr_s10');

    // 7A: Rejection without mandatory reason
    const noReasonRes = await PurchasePostingService.rejectPurchaseVoucher({
      voucherId: vReject.id,
      rejectedBy: 'admin_01',
      actorRole: 'SUPER_ADMIN',
      branchId: branchKa.id,
      rejectionReason: '   ', // whitespace only
      client,
    });
    assert(noReasonRes.success === false, 'Rejection without reason is rejected');
    assert(noReasonRes.code === 'INVALID_ENTITY', 'Missing reason rejected with INVALID_ENTITY');

    // 7B: Rejection by unauthorized user
    const unauthRejRes = await PurchasePostingService.rejectPurchaseVoucher({
      voucherId: vReject.id,
      rejectedBy: 'staff_01', // unauthorized telecaller
      actorRole: 'STAFF',
      branchId: branchKa.id,
      rejectionReason: 'Supplier discount mismatch',
      client,
    });
    assert(unauthRejRes.success === false, 'Unauthorized staff cannot reject voucher');
    assert(unauthRejRes.code === 'PERMISSION_DENIED', 'Unauthorized rejection rejected with PERMISSION_DENIED');

    // 7C: Valid Rejection by Authorized Supervisor
    const validRejRes = await PurchasePostingService.rejectPurchaseVoucher({
      voucherId: vReject.id,
      rejectedBy: supStaff.id,
      actorRole: 'STAFF',
      branchId: branchKa.id,
      rejectionReason: 'Supplier applied incorrect GST rate on line 2 (billed 18%, actual 5%)',
      client,
    });
    assert(validRejRes.success === true, 'Authorized rejection succeeds');
    assert(validRejRes.data?.status === 'CANCELLED', 'Voucher transitioned to CANCELLED status');
    assert(validRejRes.data?.cancelled_by === supStaff.id, 'voucher.cancelled_by is recorded');
    assert(validRejRes.data?.metadata?.rejection?.rejection_reason?.includes('incorrect GST rate'), 'Rejection reason recorded in metadata');

    // 7D: Cannot approve a CANCELLED voucher
    const approveCancelledRes = await PurchasePostingService.approvePurchaseVoucher({
      voucherId: vReject.id,
      approvedBy: 'admin_01',
      actorRole: 'SUPER_ADMIN',
      branchId: branchKa.id,
      client,
    });
    assert(approveCancelledRes.success === false, 'Cannot approve CANCELLED voucher');
    assert(approveCancelledRes.code === 'INVALID_VOUCHER_STATE', 'Approval on CANCELLED rejected with INVALID_VOUCHER_STATE');

    // ─────────────────────────────────────────────────────────────────────────
    // ROLLBACK & POST-ROLLBACK ZERO PERSISTENCE CHECK
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\nExecuting ROLLBACK to ensure zero persistence...');
    await client.query('ROLLBACK');

    const vFinal = await client.query('SELECT COUNT(*) FROM public.accounting_voucher');
    const jFinal = await client.query('SELECT COUNT(*) FROM public.accounting_journal_entry');
    const lFinal = await client.query('SELECT COUNT(*) FROM public.accounting_journal_line');
    const pFinal = await client.query('SELECT COUNT(*) FROM public.purchase');
    const piFinal = await client.query('SELECT COUNT(*) FROM public.purchase_item');
    const lotFinal = await client.query('SELECT COUNT(*) FROM public.inventory_cost_lot');
    const mvtFinal = await client.query('SELECT COUNT(*) FROM public.inventory_movement');
    const invFinal = await client.query('SELECT COUNT(*) FROM public.branch_inventory');

    assert(parseInt(vFinal.rows[0].count, 10) === 0, 'Post-rollback accounting_voucher count === 0');
    assert(parseInt(jFinal.rows[0].count, 10) === 0, 'Post-rollback accounting_journal_entry count === 0');
    assert(parseInt(lFinal.rows[0].count, 10) === 0, 'Post-rollback accounting_journal_line count === 0');
    assert(parseInt(pFinal.rows[0].count, 10) === 0, 'Post-rollback purchase count === 0');
    assert(parseInt(piFinal.rows[0].count, 10) === 0, 'Post-rollback purchase_item count === 0');
    assert(parseInt(lotFinal.rows[0].count, 10) === 0, 'Post-rollback inventory_cost_lot count === 0');
    assert(parseInt(mvtFinal.rows[0].count, 10) === 0, 'Post-rollback inventory_movement count === 0');
    assert(parseInt(invFinal.rows[0].count, 10) === 424, 'Post-rollback branch_inventory count === 424');

  } catch (err) {
    console.error('Fatal error during test execution:', err);
    try {
      await client.query('ROLLBACK');
    } catch {}
    failCount++;
  } finally {
    await client.end();
  }

  console.log('\n=============================================================================');
  console.log(`STEP 3D.3 TEST SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('=============================================================================');

  if (failCount > 0) {
    process.exit(1);
  }
}

runTests();
