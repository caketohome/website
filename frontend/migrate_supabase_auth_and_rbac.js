/**
 * CakeToHome — Supabase Auth & RBAC Database Migration Runner
 * 
 * Safely applies 20261103_supabase_auth_and_rbac_schema.sql
 * Enforces transactional safety and verifies all resulting objects.
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

async function runMigration() {
  const targetDb = process.env.TEST_DATABASE || 'cth_rehearsal_phase5_7';
  console.log(`[AUTH-MIGRATION] Target database: ${targetDb}`);

  const pool = new Pool({
    host: process.env.PGHOST || '127.0.0.1',
    port: Number(process.env.PGPORT || 5433),
    user: process.env.PGUSER || 'cth_test_user',
    database: targetDb,
  });

  const sqlFile = path.resolve(__dirname, '../backend/src/migrations/20261103_supabase_auth_and_rbac_schema.sql');
  if (!fs.existsSync(sqlFile)) {
    throw new Error(`Migration SQL file not found at ${sqlFile}`);
  }

  const sql = fs.readFileSync(sqlFile, 'utf8');
  const client = await pool.connect();

  try {
    console.log('[AUTH-MIGRATION] Beginning transaction...');
    await client.query('BEGIN');

    console.log('[AUTH-MIGRATION] Applying SQL migration...');
    await client.query(sql);

    console.log('[AUTH-MIGRATION] Committing transaction...');
    await client.query('COMMIT');
    console.log('[AUTH-MIGRATION] Transaction committed successfully.');

    // Verification checks
    console.log('\n--- VERIFICATION OF CREATED OBJECTS ---');
    
    // 1. Check tables
    const expectedTables = [
      'roles',
      'permissions',
      'role_permissions',
      'profiles',
      'user_role_assignments',
      'user_branch_memberships',
      'user_company_memberships',
      'auth_audit_events'
    ];

    for (const tbl of expectedTables) {
      const res = await client.query(`
        SELECT count(*) FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = $1;
      `, [tbl]);
      const exists = Number(res.rows[0].count) === 1;
      console.log(`  Table public.${tbl}: ${exists ? 'EXISTS [PASS]' : 'MISSING [FAIL]'}`);
    }

    // 2. Check auth.users table
    const authUserRes = await client.query(`
      SELECT count(*) FROM information_schema.tables 
      WHERE table_schema = 'auth' AND table_name = 'users';
    `);
    console.log(`  Table auth.users: ${Number(authUserRes.rows[0].count) === 1 ? 'EXISTS [PASS]' : 'MISSING [FAIL]'}`);

    // 3. Check seeded roles
    const rolesRes = await client.query('SELECT count(*) FROM public.roles;');
    console.log(`  Seeded roles count: ${rolesRes.rows[0].count} (Expected: 8) [${Number(rolesRes.rows[0].count) >= 8 ? 'PASS' : 'FAIL'}]`);

    // 4. Check RLS status
    const rlsRes = await client.query(`
      SELECT tablename, rowsecurity 
      FROM pg_tables 
      WHERE schemaname = 'public' AND tablename = ANY($1)
      ORDER BY tablename;
    `, [expectedTables]);
    console.log('\n--- ROW LEVEL SECURITY STATUS ---');
    for (const r of rlsRes.rows) {
      console.log(`  ${r.tablename}: RLS ${r.rowsecurity ? 'ENABLED [PASS]' : 'DISABLED [FAIL]'}`);
    }

    // 5. Test trigger on auth.users
    console.log('\n--- TESTING AUTOMATIC PROFILE PROVISIONING TRIGGER ---');
    const testUserPhone = '+919876540001';
    
    // Clean up test user if exists
    await client.query("DELETE FROM auth.users WHERE phone = $1;", [testUserPhone]);

    // Insert test user into auth.users
    const insertRes = await client.query(`
      INSERT INTO auth.users (phone, email, raw_user_meta_data)
      VALUES ($1, 'test.user@caketohome.com', '{"full_name": "Test Customer", "phone": "+919876540001"}'::jsonb)
      RETURNING id, phone;
    `, [testUserPhone]);
    const createdUserId = insertRes.rows[0].id;
    console.log(`  Created auth.users record: ${createdUserId} (${insertRes.rows[0].phone})`);

    // Verify profile was automatically created
    const profileRes = await client.query("SELECT * FROM public.profiles WHERE id = $1;", [createdUserId]);
    if (profileRes.rows.length === 1) {
      const p = profileRes.rows[0];
      console.log(`  [PASS] Profile automatically provisioned: id=${p.id}, name=${p.full_name}, phone=${p.phone}, status=${p.status}`);
    } else {
      console.log('  [FAIL] Profile was not created by trigger!');
    }

    // Verify default CUSTOMER role assignment
    const roleAssignRes = await client.query("SELECT role_id FROM public.user_role_assignments WHERE user_id = $1;", [createdUserId]);
    if (roleAssignRes.rows.length >= 1 && roleAssignRes.rows[0].role_id === 'CUSTOMER') {
      console.log(`  [PASS] Default role assigned: ${roleAssignRes.rows[0].role_id}`);
    } else {
      console.log('  [FAIL] Default role assignment missing!');
    }

    // Verify audit event
    const auditRes = await client.query("SELECT event_type, status FROM public.auth_audit_events WHERE user_id = $1;", [createdUserId]);
    if (auditRes.rows.length >= 1) {
      console.log(`  [PASS] Audit event recorded: ${auditRes.rows[0].event_type} (${auditRes.rows[0].status})`);
    } else {
      console.log('  [FAIL] Audit event missing!');
    }

    // Clean up test user
    await client.query("DELETE FROM auth.users WHERE id = $1;", [createdUserId]);
    console.log('  Cleaned up test user.');

    console.log('\n[AUTH-MIGRATION] Migration and integrity verification COMPLETE.');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[AUTH-MIGRATION] ERROR, rolled back:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch((err) => {
  console.error(err);
  process.exit(1);
});
