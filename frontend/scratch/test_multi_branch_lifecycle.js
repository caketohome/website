/**
 * CakeToHome ERP — Comprehensive Multi-Branch Cash Collection, Expense Approval,
 * Settlement and Bank Reconciliation Workflow Test
 */

const { Pool } = require('pg');

const BASE_URL = 'http://localhost:3001/api/v1';
const DB_CONN = '[REDACTED_DATABASE_CREDENTIAL]';

const pool = new Pool({
  connectionString: DB_CONN,
  ssl: { rejectUnauthorized: false }
});

const BRANCH_A = 'br_indiranagar';
const BRANCH_B = 'br_koramangala';
const MANAGER_A = 'mgr_indiranagar';
const MANAGER_B = 'mgr_koramangala';

async function fetchApi(path, options = {}) {
  const url = `${BASE_URL}/${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  const res = await fetch(url, { ...options, headers });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, ok: res.ok, data };
}

const crypto = require('crypto');

function signAuthToken(payload, secret = 'supersecret') {
  const header = { alg: 'HS256', typ: 'JWT' };
  const fullPayload = {
    userId: payload.userId || 'anonymous',
    role: (payload.role || 'CUSTOMER').toUpperCase(),
    phone: payload.phone || '',
    branchId: payload.branchId || null,
    partnerId: payload.partnerId || null,
    permissions: payload.permissions || [
      'TELLER.VIEW', 'TELLER.SESSION_OPEN', 'TELLER.SESSION_CLOSE', 'TELLER.MOVEMENT_CREATE',
      'EXPENSE.VIEW', 'EXPENSE.CREATE', 'EXPENSE.APPROVE', 'EXPENSE.EDIT',
      'ACCOUNTING.VIEW', 'ACCOUNTING.CREATE', 'ACCOUNTING.APPROVE', 'ACCOUNTING.POST', 'ACCOUNTING.MANAGE'
    ],
    isSuperAdmin: payload.role === 'SUPER_ADMIN' || payload.userId === 'admin_01',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 86400,
  };
  const headerB64 = Buffer.from(JSON.stringify(header), 'utf8').toString('base64url');
  const payloadB64 = Buffer.from(JSON.stringify(fullPayload), 'utf8').toString('base64url');
  const data = `${headerB64}.${payloadB64}`;
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

function managerHeaders(branchId = BRANCH_A, userId = MANAGER_A) {
  const token = signAuthToken({ userId, role: 'BRANCH_MANAGER', branchId });
  return {
    'Authorization': `Bearer ${token}`,
    'Cookie': `_cth_jwt=${token}; _cth_role=BRANCH_MANAGER; _cth_user_id=${userId}; _cth_branch_id=${branchId}`
  };
}

function adminHeaders() {
  const token = signAuthToken({ userId: 'admin_01', role: 'SUPER_ADMIN' });
  return {
    'Authorization': `Bearer ${token}`,
    'Cookie': `_cth_jwt=${token}; _cth_role=SUPER_ADMIN; _cth_user_id=admin_01`
  };
}

async function runTests() {
  console.log('================================================================');
  console.log('CakeToHome ERP — Multi-Branch Cash & Accounting Verification Suite');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, detail = '') {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName} - ${detail}`);
      failed++;
    }
  }

  try {
    // 0. Ensure test delivery partner and order exist
    console.log('--- Step 0: Ensuring Test Delivery Partner & Eligible Order ---');
    const partnerId = 'dp_test_indiranagar_01';
    await pool.query(`
      INSERT INTO public.delivery_partner (id, first_name, last_name, email, phone, created_at, updated_at)
      VALUES ($1, 'Ramesh', 'Rider', 'ramesh.rider@example.com', '9876543210', NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET first_name = 'Ramesh', last_name = 'Rider', email = 'ramesh.rider@example.com';
    `, [partnerId]);

    const orderId = `ord_test_cod_${Date.now()}`;
    const orderMetadata = {
      branch_id: BRANCH_A,
      payment_method: 'COD',
      total: 350.00,
      is_ledger_eligible: true,
      delivery_status: 'delivered',
      delivery_partner_id: partnerId,
      cod_custody_event: {
        custody_id: `cust_${orderId}`,
        delivery_partner_id: partnerId,
        branch_id: BRANCH_A,
        collected_amount: 350.00,
        collected_at: new Date().toISOString(),
        settlement_voucher_id: null
      }
    };

    await pool.query(`
      INSERT INTO public."order" (id, display_id, currency_code, status, metadata, created_at, updated_at)
      VALUES ($1, 99991, 'inr', 'completed', $2, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET metadata = $2, status = 'completed', currency_code = 'inr';
    `, [orderId, JSON.stringify(orderMetadata)]);

    console.log(`Test order ${orderId} created with ₹350.00 COD custody.\n`);

    // 1. Retrieve Eligible Collections for Delivery Boy
    console.log('--- Step 1: Querying Delivery Boy Eligible Collections ---');
    const eligRes = await fetchApi(`admin/delivery-handovers/eligible?delivery_partner_id=${partnerId}&branch_id=${BRANCH_A}`, {
      headers: managerHeaders()
    });
    assert(eligRes.status === 200 && eligRes.data.success, 'Fetch eligible collections succeeds (HTTP 200)');
    assert(eligRes.data.data.expectedCash >= 350, `Expected cash is >= ₹350 (Got: ₹${eligRes.data.data?.expectedCash})`);
    assert(Array.isArray(eligRes.data.data.orders) && eligRes.data.data.orders.length > 0, 'Orders list returned');

    // 2. Submit Handover Declaration (State: SUBMITTED, cash drawer balance UNCHANGED)
    console.log('\n--- Step 2: Submitting Handover Declaration (State: SUBMITTED) ---');
    const subRes = await fetchApi('admin/delivery-handovers/submit', {
      method: 'POST',
      headers: managerHeaders(),
      body: JSON.stringify({
        branch_id: BRANCH_A,
        delivery_partner_id: partnerId,
        declared_amount: 350.00,
        order_ids: [orderId],
        notes: 'Shift 1 collection handover'
      })
    });
    console.log('subRes response:', subRes.status, subRes.data);
    assert(subRes.status === 201 && subRes.data.success, 'Submit handover succeeds (HTTP 201)');
    const handover = subRes.data.data;
    if (!handover) throw new Error(`Submit handover failed: ${JSON.stringify(subRes.data)}`);
    assert(handover.status === 'SUBMITTED', 'Handover status is SUBMITTED');
    assert(Number(handover.acknowledged_amount) === 0, 'Acknowledged amount is initially 0 (not received yet)');

    // 3. Ensure an active cash shift is OPEN for Branch Manager
    console.log('\n--- Step 3: Ensuring Active Cash Shift is OPEN for Manager ---');
    // If there is an existing session in CLOSING or PENDING_VERIFICATION state, finalize it with proper SoD
    const closingCheck = await pool.query(`
      SELECT id, status, closed_by, verified_by FROM public.teller_session 
      WHERE branch_id = $1 AND status IN ('CLOSING', 'PENDING_VERIFICATION') 
      ORDER BY created_at DESC;
    `, [BRANCH_A]);
    for (const row of closingCheck.rows) {
      console.log(`Finalizing previous session ${row.id} (${row.status})...`);
      if (row.status === 'CLOSING') {
        const verifierToken = signAuthToken({ userId: 'usr_verifier_99', role: 'SUPER_ADMIN' });
        await fetchApi(`admin/teller/sessions/${row.id}/verify`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${verifierToken}` },
          body: JSON.stringify({ notes: 'Verified for test run' })
        });
      }
      const settlerToken = signAuthToken({ userId: 'usr_settler_99', role: 'SUPER_ADMIN' });
      await fetchApi(`admin/teller/sessions/${row.id}/settle`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${settlerToken}` },
        body: JSON.stringify({ notes: 'Settled for test run' })
      });
    }

    let activeSessRes = await fetchApi(`admin/teller/sessions/active?branch_id=${BRANCH_A}`, {
      headers: managerHeaders()
    });
    let activeSession = activeSessRes.data?.session || activeSessRes.data?.data?.session;
    if (!activeSession || activeSession.status !== 'OPEN') {
      const openRes = await fetchApi('admin/teller/sessions/open', {
        method: 'POST',
        headers: managerHeaders(),
        body: JSON.stringify({
          branch_id: BRANCH_A,
          opening_float: 500.00,
          notes: 'Test shift opening'
        })
      });
      console.log('openRes status:', openRes.status, openRes.data);
      assert((openRes.status === 200 || openRes.status === 201) && openRes.data.success, 'Shift opened with ₹500 float');
      activeSession = openRes.data.session || openRes.data.data?.session;
    } else {
      console.log(`Active session ${activeSession.id} already open.`);
    }

    const baselineCashRes = await pool.query(`
      SELECT opening_float, 
             COALESCE(SUM(CASE WHEN direction = 'IN' THEN amount ELSE -amount END), 0) AS net_movement
      FROM public.teller_session s
      LEFT JOIN public.teller_movement m ON m.teller_session_id = s.id
      WHERE s.id = $1
      GROUP BY s.id, s.opening_float;
    `, [activeSession.id]);
    const baselineExpected = Number(baselineCashRes.rows[0].opening_float) + Number(baselineCashRes.rows[0].net_movement);
    console.log(`Baseline Expected Cash in Till: ₹${baselineExpected.toFixed(2)}`);

    // 4. Manager Counts & Acknowledges Handover (Transactionally updates drawer cash & GL)
    console.log('\n--- Step 4: Manager Acknowledges Handover (State: ACKNOWLEDGED) ---');
    const ackRes = await fetchApi('admin/delivery-handovers/acknowledge', {
      method: 'POST',
      headers: managerHeaders(),
      body: JSON.stringify({
        handover_id: handover.id,
        branch_id: BRANCH_A,
        acknowledged_amount: 350.00,
        teller_session_id: activeSession.id,
        discrepancy_explanation: 'Counted and verified full cash'
      })
    });
    assert(ackRes.status === 200 && ackRes.data.success, 'Acknowledge handover succeeds (HTTP 200)');
    assert(ackRes.data.data.handover.status === 'ACKNOWLEDGED', 'Handover transitioned to ACKNOWLEDGED');
    assert(Number(ackRes.data.data.handover.acknowledged_amount) === 350, 'Acknowledged amount persisted as ₹350.00');
    assert(Boolean(ackRes.data.data.voucherId), `GL Settlement voucher created: ${ackRes.data.data.voucherId}`);
    assert(Boolean(ackRes.data.data.tellerMovementId), `Teller movement projected: ${ackRes.data.data.tellerMovementId}`);

    // Verify DB cash balance increased by ₹350
    const postAckCashRes = await pool.query(`
      SELECT opening_float, 
             COALESCE(SUM(CASE WHEN direction = 'IN' THEN amount ELSE -amount END), 0) AS net_movement
      FROM public.teller_session s
      LEFT JOIN public.teller_movement m ON m.teller_session_id = s.id
      WHERE s.id = $1
      GROUP BY s.id, s.opening_float;
    `, [activeSession.id]);
    const postAckExpected = Number(postAckCashRes.rows[0].opening_float) + Number(postAckCashRes.rows[0].net_movement);
    console.log(`New Expected Cash in Till: ₹${postAckExpected.toFixed(2)}`);
    assert(Math.abs(postAckExpected - (baselineExpected + 350)) < 0.01, `Till cash increased by ₹350.00 (from ₹${baselineExpected} to ₹${postAckExpected})`);

    // Verify order marked settled
    const orderCheck = await pool.query(`SELECT metadata FROM public."order" WHERE id = $1`, [orderId]);
    const ordCust = orderCheck.rows[0].metadata?.cod_custody_event;
    assert(Boolean(ordCust?.settlement_voucher_id), `Order cod_custody_event linked to voucher: ${ordCust?.settlement_voucher_id}`);

    // 5. Duplicate Handover Prevention
    console.log('\n--- Step 5: Testing Duplicate Handover Prevention ---');
    const dupRes = await fetchApi('admin/delivery-handovers/submit', {
      method: 'POST',
      headers: managerHeaders(),
      body: JSON.stringify({
        branch_id: BRANCH_A,
        delivery_partner_id: partnerId,
        declared_amount: 350.00,
        order_ids: [orderId]
      })
    });
    assert(dupRes.status === 400 && !dupRes.data.success, 'Duplicate order handover rejected (HTTP 400)');

    // 6. Expense Request & Rejection (No cash deduction)
    console.log('\n--- Step 6: Expense Request & Rejection (No cash deduction) ---');
    const exp1Res = await fetchApi('admin/expenses', {
      method: 'POST',
      headers: managerHeaders(),
      body: JSON.stringify({
        branch_id: BRANCH_A,
        description: 'Store maintenance supplies',
        subtotal: 120.00,
        total: 120.00,
        payment_method: 'CASH',
        settlement_type: 'DIRECT_PAYMENT',
        expense_date: new Date().toISOString().slice(0, 10)
      })
    });
    console.log('exp1Res:', exp1Res.status, exp1Res.data);
    assert(exp1Res.status === 201 && exp1Res.data.success, 'Expense created (HTTP 201)');
    const exp1Id = exp1Res.data.data.id;

    // Submit for review
    await fetchApi(`admin/expenses/${exp1Id}/status`, {
      method: 'POST',
      headers: managerHeaders(),
      body: JSON.stringify({ status: 'SUBMITTED' })
    });

    // Reject expense
    const rejRes = await fetchApi(`admin/expenses/${exp1Id}/reject`, {
      method: 'POST',
      headers: managerHeaders(),
      body: JSON.stringify({ rejection_reason: 'Unapproved supplier selected' })
    });
    console.log('rejRes status:', rejRes.status, rejRes.data);
    assert(rejRes.status === 200 && rejRes.data.success, 'Expense rejected (HTTP 200)');

    // Verify expense status in DB
    const exp1Db = await pool.query(`SELECT status, reversal_reason FROM public.expense WHERE id = $1`, [exp1Id]);
    assert(exp1Db.rows[0].status === 'REJECTED', 'Expense status is REJECTED in DB');
    assert(exp1Db.rows[0].reversal_reason === 'Unapproved supplier selected', 'Rejection reason persisted');

    // 7. Expense Approval & Single Cash Deduction
    console.log('\n--- Step 7: Expense Approval & Payment from Cash Drawer ---');
    const exp2Res = await fetchApi('admin/expenses', {
      method: 'POST',
      headers: managerHeaders(),
      body: JSON.stringify({
        branch_id: BRANCH_A,
        description: 'Emergency dairy purchase',
        subtotal: 80.00,
        taxable_value: 80.00,
        total: 80.00,
        payment_method: 'CASH',
        settlement_type: 'DIRECT_PAYMENT',
        expense_date: new Date().toISOString().slice(0, 10),
        metadata: { bill_attachment_url: 'https://example.com/receipt123.pdf' }
      })
    });
    assert(exp2Res.status === 201 && exp2Res.data.success, 'Expense 2 created (HTTP 201)');
    const exp2Id = exp2Res.data.data.id;

    // Submit
    await fetchApi(`admin/expenses/${exp2Id}/status`, {
      method: 'POST',
      headers: managerHeaders(),
      body: JSON.stringify({ status: 'SUBMITTED' })
    });

    // Approve as Super Admin (SoD: creator != approver)
    const appRes = await fetchApi(`admin/expenses/${exp2Id}/approve`, {
      method: 'POST',
      headers: adminHeaders(),
      body: JSON.stringify({})
    });
    assert(appRes.status === 200 && appRes.data.success, 'Expense 2 approved by Supervisor (HTTP 200)');

    // Verify cash unchanged after approval
    const prePayCashRes = await pool.query(`
      SELECT opening_float, 
             COALESCE(SUM(CASE WHEN direction = 'IN' THEN amount ELSE -amount END), 0) AS net_movement
      FROM public.teller_session s
      LEFT JOIN public.teller_movement m ON m.teller_session_id = s.id
      WHERE s.id = $1
      GROUP BY s.id, s.opening_float;
    `, [activeSession.id]);
    const prePayExpected = Number(prePayCashRes.rows[0].opening_float) + Number(prePayCashRes.rows[0].net_movement);
    assert(Math.abs(prePayExpected - postAckExpected) < 0.01, 'Cash drawer balance UNCHANGED after approval');

    // Overdraft test: attempt to disburse ₹999,999
    console.log('\n--- Step 8: Overdraft Protection Test ---');
    const expOverdraft = await pool.query(`
      INSERT INTO public.expense (id, branch_id, description, subtotal, taxable_value, total, status, payment_method, settlement_type, expense_date, created_by, approved_by, created_at, updated_at)
      VALUES ($1, $2, 'Excessive disbursement attempt', 999999, 999999, 999999, 'APPROVED', 'CASH', 'DIRECT_PAYMENT', NOW(), 'staff_01', 'admin_01', NOW(), NOW())
      RETURNING id;
    `, [`exp_ovd_${Date.now()}`, BRANCH_A]);
    const ovdId = expOverdraft.rows[0].id;

    const ovdRes = await fetchApi(`admin/expenses/${ovdId}/pay-drawer`, {
      method: 'POST',
      headers: adminHeaders(),
      body: JSON.stringify({ branch_id: BRANCH_A, teller_session_id: activeSession.id })
    });
    console.log('ovdRes status:', ovdRes.status, ovdRes.data);
    assert(ovdRes.status === 422, 'Overdraft payment rejected with HTTP 422 Unprocessable Entity');

    // Pay approved ₹80 expense from drawer cash
    console.log('\n--- Step 9: Paying Approved Expense from Drawer Cash ---');
    const payRes = await fetchApi(`admin/expenses/${exp2Id}/pay-drawer`, {
      method: 'POST',
      headers: adminHeaders(),
      body: JSON.stringify({ branch_id: BRANCH_A, teller_session_id: activeSession.id })
    });
    assert(payRes.status === 200 && payRes.data.success, 'Expense paid and posted from drawer (HTTP 200)');

    // Verify cash decreased by ₹80 in DB
    const postPayCashRes = await pool.query(`
      SELECT opening_float, 
             COALESCE(SUM(CASE WHEN direction = 'IN' THEN amount ELSE -amount END), 0) AS net_movement
      FROM public.teller_session s
      LEFT JOIN public.teller_movement m ON m.teller_session_id = s.id
      WHERE s.id = $1
      GROUP BY s.id, s.opening_float;
    `, [activeSession.id]);
    const postPayExpected = Number(postPayCashRes.rows[0].opening_float) + Number(postPayCashRes.rows[0].net_movement);
    console.log(`Cash after paying ₹80 expense: ₹${postPayExpected.toFixed(2)}`);
    assert(Math.abs(postPayExpected - (prePayExpected - 80)) < 0.01, `Cash drawer decreased exactly by ₹80.00`);

    // Verify GL Journal Entry for Expense
    const expGlRes = await pool.query(`
      SELECT jl.account_id, jl.debit_amount, jl.credit_amount, a.code
      FROM public.accounting_journal_line jl
      JOIN public.accounting_account a ON a.id = jl.account_id
      JOIN public.accounting_journal_entry je ON je.id = jl.journal_entry_id
      JOIN public.accounting_voucher v ON v.id = je.voucher_id
      JOIN public.expense e ON e.voucher_id = v.id
      WHERE e.id = $1;
    `, [exp2Id]);
    assert(expGlRes.rows.length >= 2, 'GL Journal lines exist for expense payment');
    const credit1111 = expGlRes.rows.find(r => r.code === '1111' && Number(r.credit_amount) === 80);
    assert(Boolean(credit1111), 'Cr 1111 (Cash in Hand) recorded for ₹80.00');

    // 10. Cross-Branch Security Isolation
    console.log('\n--- Step 10: Cross-Branch Security Isolation Test ---');
    const crossBranchRes = await fetchApi('admin/delivery-handovers/acknowledge', {
      method: 'POST',
      headers: managerHeaders(BRANCH_B, MANAGER_B), // Manager of Branch B
      body: JSON.stringify({
        handover_id: handover.id, // Handover belongs to Branch A
        branch_id: BRANCH_B,
        acknowledged_amount: 350.00
      })
    });
    assert(crossBranchRes.status === 400 || crossBranchRes.status === 403, 'Cross-branch handover mutation rejected');

    console.log('\n================================================================');
    console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
    console.log('================================================================\n');

  } catch (err) {
    console.error('Fatal test runner exception:', err);
  } finally {
    await pool.end();
  }
}

runTests();
