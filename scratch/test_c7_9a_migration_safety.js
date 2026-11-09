/**
 * CakeToHome ERP — Phase C7.9a Migration Safety & Constraint Test
 * Tests DDL execution, all 7 tables, all CHECK constraints, UNIQUE constraints,
 * FK references, and security triggers within an isolated BEGIN ... ROLLBACK transaction.
 */

const fs = require('fs');
const path = require('path');
const { Client } = require(path.join(__dirname, '../frontend/node_modules/pg'));

function getConnectionString() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPath = path.join(__dirname, '../frontend/.env');
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

async function runSafetyTest() {
  console.log('=============================================================================');
  console.log('Testing C7.9a DDL & Constraints in Isolated Rollback Transaction');
  console.log('=============================================================================\n');

  const conn = getConnectionString();
  const client = new Client({
    connectionString: conn,
    ssl: conn.includes('supabase') ? { rejectUnauthorized: false } : false
  });
  await client.connect();

  try {
    await client.query('BEGIN;');

    const sqlPath = path.join(__dirname, '../backend/src/migrations/20261012_phase_c7_9_corporate_account_roster_schema.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('[1/8] Executing DDL in transaction...');
    await client.query(sql);
    assert(true, 'DDL executed without error');

    console.log('\n[2/8] Testing Idempotency (Re-running DDL)...');
    await client.query(sql);
    assert(true, 'DDL is idempotent and can be safely re-run');

    console.log('\n[3/8] Verifying 7 tables exist...');
    const tables = [
      'corporate_account',
      'corporate_account_contact',
      'corporate_account_member',
      'corporate_employee',
      'corporate_employee_event',
      'corporate_account_event',
      'corporate_employee_import_batch'
    ];
    for (const t of tables) {
      const ex = (await client.query(`
        SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1)
      `, [t])).rows[0].exists;
      assert(ex, `Table public.${t} exists`);
    }

    // Grab a valid customer and user for test inserts
    const testCust = (await client.query('SELECT id FROM public.customer LIMIT 1')).rows[0].id;
    const testUser = (await client.query('SELECT id FROM public."user" LIMIT 1')).rows[0].id;

    console.log('\n[4/8] Testing corporate_account constraints...');
    // Valid account
    const accRes = await client.query(`
      INSERT INTO public.corporate_account (
        customer_id, legal_name, legal_name_key, gstin, pan, created_by
      ) VALUES (
        $1, 'Test Corp Ltd', 'TEST CORP LTD', '29AABCT1332L1ZV', 'AABCT1332L', $2
      ) RETURNING id;
    `, [testCust, testUser]);
    const accId = accRes.rows[0].id;
    assert(accId.startsWith('ca_'), `Account created with ca_ prefix: ${accId}`);

    // Reject duplicate customer_id (1:1 constraint)
    try {
      await client.query('SAVEPOINT s1');
      await client.query(`
        INSERT INTO public.corporate_account (
          customer_id, legal_name, legal_name_key, created_by
        ) VALUES ($1, 'Another Corp', 'ANOTHER CORP', $2);
      `, [testCust, testUser]);
      assert(false, 'Should have rejected duplicate customer_id');
      await client.query('RELEASE SAVEPOINT s1');
    } catch (e) {
      await client.query('ROLLBACK TO SAVEPOINT s1');
      assert(e.message.includes('unique') || e.message.includes('duplicate'), '1:1 customer_id constraint properly rejected duplicate');
    }

    // Reject mismatched PAN and GSTIN
    try {
      await client.query('SAVEPOINT s2');
      const cust2 = (await client.query('SELECT id FROM public.customer OFFSET 1 LIMIT 1')).rows[0].id;
      await client.query(`
        INSERT INTO public.corporate_account (
          customer_id, legal_name, legal_name_key, gstin, pan, created_by
        ) VALUES ($1, 'Mismatch Corp', 'MISMATCH CORP', '29AABCT1332L1ZV', 'ZZZTT9999X', $2);
      `, [cust2, testUser]);
      assert(false, 'Should have rejected PAN-GSTIN mismatch');
      await client.query('RELEASE SAVEPOINT s2');
    } catch (e) {
      await client.query('ROLLBACK TO SAVEPOINT s2');
      assert(e.message.includes('chk_ca_pan_gstin_match'), 'chk_ca_pan_gstin_match properly rejected PAN mismatch');
    }

    console.log('\n[5/8] Testing corporate_employee code uniqueness & coordinates...');
    const empRes = await client.query(`
      INSERT INTO public.corporate_employee (
        account_id, employee_code, employee_code_key, full_name, phone,
        default_latitude, default_longitude, coordinate_source, created_by
      ) VALUES (
        $1, 'EMP001', 'EMP001', 'Rohan Sharma', '+919876543210',
        12.9716, 77.5946, 'ADMIN_VERIFIED', $2
      ) RETURNING id;
    `, [accId, testUser]);
    const empId = empRes.rows[0].id;
    assert(empId.startsWith('ce_'), `Employee created with ce_ prefix: ${empId}`);

    // Duplicate employee_code_key rejected
    try {
      await client.query('SAVEPOINT s3');
      await client.query(`
        INSERT INTO public.corporate_employee (
          account_id, employee_code, employee_code_key, full_name, phone, created_by
        ) VALUES ($1, 'EMP001', 'EMP001', 'Duplicate Rohan', '+919876543211', $2);
      `, [accId, testUser]);
      assert(false, 'Should have rejected duplicate employee_code_key');
      await client.query('RELEASE SAVEPOINT s3');
    } catch (e) {
      await client.query('ROLLBACK TO SAVEPOINT s3');
      assert(e.message.includes('uq_ce_account_employee_code') || e.message.includes('unique'), 'Employee code unique constraint enforced');
    }

    // Invalid coordinates (outside India bounding box) rejected
    try {
      await client.query('SAVEPOINT s4');
      await client.query(`
        INSERT INTO public.corporate_employee (
          account_id, employee_code, employee_code_key, full_name, phone,
          default_latitude, default_longitude, created_by
        ) VALUES (
          $1, 'EMP002', 'EMP002', 'Alice Smith', '+919876543212',
          51.5074, -0.1278, $2 -- London coordinates
        );
      `, [accId, testUser]);
      assert(false, 'Should have rejected non-India coordinates');
      await client.query('RELEASE SAVEPOINT s4');
    } catch (e) {
      await client.query('ROLLBACK TO SAVEPOINT s4');
      assert(e.message.includes('chk_ce_coords_india_bbox'), 'chk_ce_coords_india_bbox rejected non-India coordinates');
    }

    console.log('\n[6/8] Testing corporate_employee DELETE prevention trigger...');
    try {
      await client.query('SAVEPOINT s5');
      await client.query('DELETE FROM public.corporate_employee WHERE id = $1', [empId]);
      assert(false, 'Should have blocked DELETE on corporate_employee');
      await client.query('RELEASE SAVEPOINT s5');
    } catch (e) {
      await client.query('ROLLBACK TO SAVEPOINT s5');
      assert(e.message.includes('Hard deletion of corporate_employee is prohibited'), 'trg_ce_prevent_delete properly blocked hard delete');
    }

    console.log('\n[7/8] Testing audit event immutability triggers...');
    // Account event insert
    const caxRes = await client.query(`
      INSERT INTO public.corporate_account_event (
        account_id, event_type, actor_id, actor_role, reason
      ) VALUES ($1, 'CREATED', $2, 'SUPER_ADMIN', 'Initial account creation')
      RETURNING id;
    `, [accId, testUser]);
    const caxId = caxRes.rows[0].id;
    assert(caxId.startsWith('cax_'), `Account event created: ${caxId}`);

    // Update blocked on account event
    try {
      await client.query('SAVEPOINT s6');
      await client.query("UPDATE public.corporate_account_event SET reason = 'Tampered' WHERE id = $1", [caxId]);
      assert(false, 'Should have blocked UPDATE on corporate_account_event');
      await client.query('RELEASE SAVEPOINT s6');
    } catch (e) {
      await client.query('ROLLBACK TO SAVEPOINT s6');
      assert(e.message.includes('corporate_account_event is append-only'), 'trg_cax_append_only blocked UPDATE');
    }

    // Delete blocked on account event
    try {
      await client.query('SAVEPOINT s7');
      await client.query('DELETE FROM public.corporate_account_event WHERE id = $1', [caxId]);
      assert(false, 'Should have blocked DELETE on corporate_account_event');
      await client.query('RELEASE SAVEPOINT s7');
    } catch (e) {
      await client.query('ROLLBACK TO SAVEPOINT s7');
      assert(e.message.includes('corporate_account_event is append-only'), 'trg_cax_append_only blocked DELETE');
    }

    // Employee event insert
    const ceeRes = await client.query(`
      INSERT INTO public.corporate_employee_event (
        employee_id, account_id, event_type, actor_id, reason
      ) VALUES ($1, $2, 'CREATED', $3, 'Roster onboarding')
      RETURNING id;
    `, [empId, accId, testUser]);
    const ceeId = ceeRes.rows[0].id;
    assert(ceeId.startsWith('cee_'), `Employee event created: ${ceeId}`);

    // Update blocked on employee event
    try {
      await client.query('SAVEPOINT s8');
      await client.query("UPDATE public.corporate_employee_event SET reason = 'Tampered' WHERE id = $1", [ceeId]);
      assert(false, 'Should have blocked UPDATE on corporate_employee_event');
      await client.query('RELEASE SAVEPOINT s8');
    } catch (e) {
      await client.query('ROLLBACK TO SAVEPOINT s8');
      assert(e.message.includes('corporate_employee_event is append-only'), 'trg_cee_append_only blocked UPDATE');
    }

    console.log('\n[8/8] Testing corporate_account_member partial unique index...');
    await client.query(`
      INSERT INTO public.corporate_account_member (
        account_id, user_id, member_role, status, granted_by
      ) VALUES ($1, $2, 'ROSTER_MANAGER', 'ACTIVE', $2);
    `, [accId, testUser]);
    assert(true, 'Member inserted successfully');

    try {
      await client.query('SAVEPOINT s9');
      await client.query(`
        INSERT INTO public.corporate_account_member (
          account_id, user_id, member_role, status, granted_by
        ) VALUES ($1, $2, 'ROSTER_VIEWER', 'ACTIVE', $2);
      `, [accId, testUser]);
      assert(false, 'Should have rejected duplicate active member');
      await client.query('RELEASE SAVEPOINT s9');
    } catch (e) {
      await client.query('ROLLBACK TO SAVEPOINT s9');
      assert(e.message.includes('idx_cam_account_user_active') || e.message.includes('unique'), 'idx_cam_account_user_active enforced partial unique');
    }

    console.log('\nRolling back test transaction (leaving database clean)...');
    await client.query('ROLLBACK;');
    console.log('✓ Transaction rolled back cleanly.');

    console.log(`\nResults: ${passed} passed, ${failed} failed.`);
    if (failed > 0) process.exit(1);

  } catch (err) {
    try { await client.query('ROLLBACK;'); } catch (_) {}
    console.error('Test execution failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runSafetyTest();
