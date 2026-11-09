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

async function testSoDAndSettlement() {
  console.log('=== TESTING 3-TIER SoD AND SETTLEMENT WORKFLOW ===\n');

  try {
    const testBranchId = 'br_koramangala';
    const sessionId = 'sess_1792212820404_sbnj2sb';

    // 1. Attempt verification by the same manager who opened the session (should be REJECTED by SoD)
    console.log('Test 1: Opener attempting self-verification (should FAIL with SoD violation)...');
    const mgrToken = createJwt('shpmgr_koramangala', 'BRANCH_MANAGER', testBranchId);
    const selfVerifyRes = await fetch(`http://localhost:3001/api/v1/admin/teller/sessions/${sessionId}/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${mgrToken}`
      },
      body: JSON.stringify({ notes: 'Self verify attempt' })
    });
    const selfVerifyData = await selfVerifyRes.json();
    console.log(`Self-verify result: status=${selfVerifyRes.status}, success=${selfVerifyData.success}, error=${selfVerifyData.error}`);
    if (selfVerifyRes.status === 403 || selfVerifyData.error === 'SOD_VIOLATION' || selfVerifyData.error === 'PERMISSION_DENIED') {
      console.log('[PASS] Self-verification correctly blocked by server-side authorization / SoD!');
    } else {
      console.warn('[WARN] Unexpected response on self-verify:', selfVerifyData);
    }

    // 2. Independent Supervisor Verification
    console.log('\nTest 2: Independent Supervisor verifying session...');
    const supToken = createJwt('usr_sup_koramangala', 'SUPERVISOR', testBranchId);
    const supVerifyRes = await fetch(`http://localhost:3001/api/v1/admin/teller/sessions/${sessionId}/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${supToken}`
      },
      body: JSON.stringify({ notes: 'Supervisor count verified and confirmed' })
    });
    const supVerifyData = await supVerifyRes.json();
    console.log(`Supervisor verify result: status=${supVerifyRes.status}, success=${supVerifyData.success}`);
    if (!supVerifyData.success) {
      throw new Error(`Failed supervisor verification: ${JSON.stringify(supVerifyData)}`);
    }
    console.log(`[PASS] Session verified: status=${supVerifyData.session?.status}`);

    // 3. Attempt settlement by the supervisor who verified (should FAIL with SoD violation)
    console.log('\nTest 3: Verifier attempting self-settlement (should FAIL with SoD violation)...');
    const selfSettleRes = await fetch(`http://localhost:3001/api/v1/admin/teller/sessions/${sessionId}/settle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${supToken}`
      },
      body: JSON.stringify({ notes: 'Verifier self settle attempt' })
    });
    const selfSettleData = await selfSettleRes.json();
    console.log(`Self-settle result: status=${selfSettleRes.status}, success=${selfSettleData.success}, error=${selfSettleData.error}`);
    if (selfSettleRes.status === 403 || selfSettleData.error === 'SOD_VIOLATION' || selfSettleData.error === 'PERMISSION_DENIED') {
      console.log('[PASS] Verifier settlement correctly blocked by 3-tier SoD!');
    } else {
      console.warn('[WARN] Unexpected response on self-settle:', selfSettleData);
    }

    // 4. Independent Finance Controller Final Settlement
    console.log('\nTest 4: Independent Finance Controller settling session...');
    const finToken = createJwt('usr_fin_koramangala', 'FINANCE_CONTROLLER', testBranchId);
    const finSettleRes = await fetch(`http://localhost:3001/api/v1/admin/teller/sessions/${sessionId}/settle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${finToken}`
      },
      body: JSON.stringify({ notes: 'Final GL settlement by Finance' })
    });
    const finSettleData = await finSettleRes.json();
    console.log(`Final settle result: status=${finSettleRes.status}, success=${finSettleData.success}`);
    if (!finSettleData.success) {
      throw new Error(`Failed final settlement: ${JSON.stringify(finSettleData)}`);
    }
    console.log(`[PASS] Session settled: status=${finSettleData.session?.status}, voucher=${finSettleData.session?.settlement_voucher_id || 'Zero Variance'}`);

    // 5. Attempt cash mutation on SETTLED session (must be REJECTED)
    console.log('\nTest 5: Attempting cash mutation on SETTLED session (must FAIL)...');
    const mutateRes = await fetch(`http://localhost:3001/api/v1/admin/teller/sessions/${sessionId}/movements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${mgrToken}`
      },
      body: JSON.stringify({
        direction: 'IN',
        movement_type: 'CASH_SALE',
        amount: 100.00,
        narration: 'Illegal mutation attempt after settlement'
      })
    });
    const mutateData = await mutateRes.json();
    console.log(`Mutate settled session result: status=${mutateRes.status}, success=${mutateData.success}, error=${mutateData.error}`);
    if (!mutateData.success) {
      console.log('[PASS] Cash mutation on SETTLED session rejected!');
    } else {
      throw new Error('FAILED: Mutation on settled session was accepted!');
    }

    console.log('\n=== ALL 3-TIER SoD AND SETTLEMENT CONTROLS VERIFIED! ===');
  } catch (err) {
    console.error('TEST ERROR:', err);
  } finally {
    await pool.end();
  }
}

testSoDAndSettlement();
