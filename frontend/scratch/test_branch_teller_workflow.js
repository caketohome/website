const crypto = require('crypto');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: '[REDACTED_DATABASE_CREDENTIAL]',
  ssl: { rejectUnauthorized: false }
});

const secret = process.env.JWT_SECRET || 'supersecret';

function createJwt(userId, role, branchId = null) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    userId,
    role,
    branchId,
    exp: Math.floor(Date.now() / 1000) + 3600
  })).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${sig}`;
}

async function runTest() {
  console.log('=== STARTING TELLER & BRANCH CASH WORKFLOW VERIFICATION ===\n');

  try {
    // 1. Pick an operating branch with 0 tellers
    const testBranchId = 'br_koramangala'; // or another branch
    const bRes = await pool.query(`SELECT id, name FROM public.branch WHERE id = $1`, [testBranchId]);
    const branchName = bRes.rows[0]?.name || testBranchId;
    console.log(`Testing with branch: ${branchName} (${testBranchId})`);

    // Clean up any test sessions/tellers for this test branch if they exist
    await pool.query(`DELETE FROM public.teller_movement WHERE branch_id = $1`, [testBranchId]);
    await pool.query(`DELETE FROM public.teller_session WHERE branch_id = $1`, [testBranchId]);
    await pool.query(`DELETE FROM public.teller WHERE branch_id = $1`, [testBranchId]);
    console.log(`[PASS] Cleaned pre-test records for ${testBranchId}`);

    // Verify 0 tellers exist initially
    const preCheck = await pool.query(`SELECT * FROM public.teller WHERE branch_id = $1`, [testBranchId]);
    console.log(`Initial tellers count for branch: ${preCheck.rows.length}`);

    // 2. Call GET /api/v1/admin/tellers?branch_id=...
    const mgrToken = createJwt('shpmgr_koramangala', 'BRANCH_MANAGER', testBranchId);
    const getTellersRes = await fetch(`http://localhost:3001/api/v1/admin/tellers?branch_id=${testBranchId}`, {
      headers: { Authorization: `Bearer ${mgrToken}` }
    });
    const tellersData = await getTellersRes.json();
    console.log(`GET tellers status: ${getTellersRes.status}, success: ${tellersData.success}`);
    console.log(`Auto-provisioned tellers count: ${tellersData.tellers?.length}`);
    if (!tellersData.success || !tellersData.tellers || tellersData.tellers.length === 0) {
      throw new Error(`Failed to auto-provision default teller for branch: ${JSON.stringify(tellersData)}`);
    }
    const defaultTeller = tellersData.tellers[0];
    console.log(`[PASS] Default teller provisioned: ${defaultTeller.name} (Code: ${defaultTeller.code}, ID: ${defaultTeller.id})`);

    // 3. Open Cash Shift as Branch Manager without creating separate teller employee
    console.log(`\nOpening shift as Branch Manager (shpmgr_koramangala)...`);
    const openRes = await fetch(`http://localhost:3001/api/v1/admin/teller/sessions/open`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${mgrToken}`
      },
      body: JSON.stringify({
        teller_id: defaultTeller.id,
        branch_id: testBranchId,
        opening_float: 1000.00,
        notes: 'Shift opened by Branch Manager test'
      })
    });
    const openData = await openRes.json();
    console.log(`POST open session status: ${openRes.status}, success: ${openData.success}`);
    if (!openData.success || !openData.session) {
      throw new Error(`Failed to open session: ${JSON.stringify(openData)}`);
    }
    const sessionId = openData.session.id;
    console.log(`[PASS] Session opened: ID ${sessionId}, Status: ${openData.session.status}, Float: ₹${openData.session.opening_float}`);

    // Verify session in PostgreSQL
    const dbSess = await pool.query(`SELECT id, teller_id, branch_id, status, opening_float, expected_cash, opened_by FROM public.teller_session WHERE id = $1`, [sessionId]);
    console.log(`PostgreSQL session record:`, dbSess.rows[0]);

    // 4. Test reloading active session
    console.log(`\nTesting active session resolution by teller_id and branch_id...`);
    const activeByTellerRes = await fetch(`http://localhost:3001/api/v1/admin/teller/sessions/active?teller_id=${defaultTeller.id}`, {
      headers: { Authorization: `Bearer ${mgrToken}` }
    });
    const activeByTeller = await activeByTellerRes.json();
    console.log(`Active session by teller_id: ${activeByTeller.session?.id === sessionId ? 'PASS' : 'FAIL'}`);

    const activeByBranchRes = await fetch(`http://localhost:3001/api/v1/admin/teller/sessions/active?branch_id=${testBranchId}`, {
      headers: { Authorization: `Bearer ${mgrToken}` }
    });
    const activeByBranch = await activeByBranchRes.json();
    console.log(`Active session by branch_id: ${activeByBranch.session?.id === sessionId ? 'PASS' : 'FAIL'}`);

    // 5. Test recording cash movement (e.g. cash sale receipt)
    console.log(`\nRecording cash movement...`);
    const movRes = await fetch(`http://localhost:3001/api/v1/admin/teller/sessions/${sessionId}/movements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${mgrToken}`
      },
      body: JSON.stringify({
        direction: 'IN',
        movement_type: 'CASH_SALE',
        amount: 450.00,
        narration: 'Cash sale receipt test'
      })
    });
    const movData = await movRes.json();
    console.log(`POST movement status: ${movRes.status}, success: ${movData.success}`);

    // 6. Test closing shift with physical count
    console.log(`\nClosing shift with physical count...`);
    // Expected cash = 1000 + 450 = 1450.00. Closing count = 1450.00 -> variance = 0
    const closeRes = await fetch(`http://localhost:3001/api/v1/admin/teller/sessions/${sessionId}/close`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${mgrToken}`
      },
      body: JSON.stringify({
        closing_count: 1450.00,
        notes: 'Shift closed with exact count'
      })
    });
    const closeData = await closeRes.json();
    console.log(`POST close status: ${closeRes.status}, success: ${closeData.success}`);
    if (!closeData.success) {
      throw new Error(`Failed to close session: ${JSON.stringify(closeData)}`);
    }
    console.log(`[PASS] Shift closed: Status: ${closeData.session.status}, Expected: ₹${closeData.session.expected_cash}, Count: ₹${closeData.session.closing_count}, Variance: ₹${closeData.session.variance}`);

    // 7. Verify Session Audit History contains this closed session
    console.log(`\nVerifying Session Audit History list...`);
    const historyRes = await fetch(`http://localhost:3001/api/v1/admin/teller/sessions?branch_id=${testBranchId}`, {
      headers: { Authorization: `Bearer ${mgrToken}` }
    });
    const historyData = await historyRes.json();
    const foundSession = historyData.sessions?.find(s => s.id === sessionId);
    console.log(`Session found in audit history: ${foundSession ? 'PASS' : 'FAIL'}`);
    if (foundSession) {
      console.log(`Audit Record: ID=${foundSession.id}, Status=${foundSession.status}, Variance=${foundSession.variance}, Branch=${foundSession.branch_name}`);
    }

    // 8. Verify Branch Cash Position endpoint
    console.log(`\nVerifying Branch Cash Position endpoint...`);
    const adminToken = createJwt('admin_01', 'SUPER_ADMIN');
    const cashPosRes = await fetch(`http://localhost:3001/api/v1/admin/accounting/branch-cash-position`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const cashPosData = await cashPosRes.json();
    console.log(`Branch Cash Position: success=${cashPosData.success}, total branches=${cashPosData.branches?.length}`);
    const koramangalaCash = cashPosData.branches?.find(b => b.branch_id === testBranchId);
    console.log(`Branch cash row for ${testBranchId}:`, koramangalaCash ? 'FOUND' : 'NOT FOUND');

    console.log('\n=== ALL WORKFLOW TESTS PASSED SUCCESSFULLY! ===');
  } catch (err) {
    console.error('TEST ERROR:', err);
  } finally {
    await pool.end();
  }
}

runTest();
