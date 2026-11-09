const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Client } = require(path.resolve(__dirname, '../frontend/node_modules/pg'));

function getConn() {
  const env = fs.readFileSync('.env', 'utf8');
  for (const line of env.split('\n')) {
    if (line.trim().startsWith('DATABASE_URL=')) {
      let val = line.trim().substring('DATABASE_URL='.length).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      return val;
    }
  }
}

function getJwtSecret() {
  const env = fs.readFileSync('.env', 'utf8');
  for (const line of env.split('\n')) {
    if (line.trim().startsWith('JWT_SECRET=')) {
      let val = line.trim().substring('JWT_SECRET='.length).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      return val;
    }
  }
  return 'supersecret';
}

function createSuperAdminToken() {
  const secret = getJwtSecret();
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 7 * 86400;

  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    userId: 'admin_01',
    role: 'SUPER_ADMIN',
    phone: '9876543210',
    customerId: 'admin_01',
    branchId: null,
    partnerId: null,
    name: 'Super Admin',
    email: 'admin@caketohome.com',
    permissions: ['*'],
    isSuperAdmin: true,
    iat: now,
    exp,
  };

  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const data = `${b64(header)}.${b64(payload)}`;
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

async function run() {
  console.log('=============================================================================');
  console.log('CakeToHome ERP — Management Provisioning: Accounting Start Date & Fiscal Year');
  console.log('=============================================================================\n');

  const client = new Client({ connectionString: getConn(), ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    await client.query('BEGIN');

    // 1. Audit Current State
    console.log('[1] Checking current setting and fiscal period status...');
    const currentSetting = await client.query("SELECT * FROM public.setting WHERE key = 'accounting_start_date' AND deleted_at IS NULL");
    const currentPeriods = await client.query("SELECT count(*)::int as count FROM public.accounting_fiscal_period");
    console.log(`    Current accounting_start_date: ${currentSetting.rows.length > 0 ? currentSetting.rows[0].value : 'UNSET (null)'}`);
    console.log(`    Current fiscal_period count: ${currentPeriods.rows[0].count}`);

    // 2. Provision accounting_start_date = '2026-04-01'
    const START_DATE = '2026-04-01';
    const FISCAL_YEAR = 'FY2026-27';
    console.log(`\n[2] Provisioning accounting_start_date = '${START_DATE}' for ${FISCAL_YEAR}...`);

    if (currentSetting.rows.length > 0) {
      await client.query(
        `UPDATE public.setting 
         SET value = $1, description = $2, updated_at = NOW() 
         WHERE id = $3`,
        [START_DATE, 'Accounting start date provisioned per management decision for FY 2026-27', currentSetting.rows[0].id]
      );
      console.log(`    Updated existing setting record ${currentSetting.rows[0].id}`);
    } else {
      await client.query(
        `INSERT INTO public.setting (id, "group", key, value, is_json, is_secret, description, created_at, updated_at)
         VALUES (gen_random_uuid()::text, 'accounting', 'accounting_start_date', $1, false, false, $2, NOW(), NOW())`,
        [START_DATE, 'Accounting start date provisioned per management decision for FY 2026-27']
      );
      console.log(`    Inserted new setting record for accounting_start_date`);
    }

    // 3. Generate and Insert 12 Monthly Fiscal Periods
    console.log(`\n[3] Provisioning 12 monthly periods for ${FISCAL_YEAR} (2026-04-01 to 2027-03-31)...`);
    
    const existingFY = await client.query(
      "SELECT id, period_name, start_date, end_date FROM public.accounting_fiscal_period WHERE fiscal_year = $1",
      [FISCAL_YEAR]
    );

    if (existingFY.rows.length > 0) {
      console.log(`    Found ${existingFY.rows.length} existing periods for ${FISCAL_YEAR}.`);
    } else {
      const periods = [
        { name: 'April 2026', start: '2026-04-01', end: '2026-04-30' },
        { name: 'May 2026', start: '2026-05-01', end: '2026-05-31' },
        { name: 'June 2026', start: '2026-06-01', end: '2026-06-30' },
        { name: 'July 2026', start: '2026-07-01', end: '2026-07-31' },
        { name: 'August 2026', start: '2026-08-01', end: '2026-08-31' },
        { name: 'September 2026', start: '2026-09-01', end: '2026-09-30' },
        { name: 'October 2026', start: '2026-10-01', end: '2026-10-31' },
        { name: 'November 2026', start: '2026-11-01', end: '2026-11-30' },
        { name: 'December 2026', start: '2026-12-01', end: '2026-12-31' },
        { name: 'January 2027', start: '2027-01-01', end: '2027-01-31' },
        { name: 'February 2027', start: '2027-02-01', end: '2027-02-28' },
        { name: 'March 2027', start: '2027-03-01', end: '2027-03-31' }
      ];

      for (const p of periods) {
        await client.query(
          `INSERT INTO public.accounting_fiscal_period
             (fiscal_year, period_name, start_date, end_date, is_locked, created_at)
           VALUES ($1, $2, $3::date, $4::date, false, NOW())`,
          [FISCAL_YEAR, p.name, p.start, p.end]
        );
        console.log(`    + Inserted period: ${p.name.padEnd(16)} | ${p.start} -> ${p.end} | Unlocked`);
      }
    }

    // 4. Verify Active Fiscal Period for Today (2026-10-16)
    console.log('\n[4] Testing Posting Safety Gates with Active Period Query...');
    const today = '2026-10-16';
    const activePeriod = await client.query(
      `SELECT * FROM public.accounting_fiscal_period 
       WHERE $1::date >= start_date AND $1::date <= end_date AND is_locked = false`,
      [today]
    );

    if (activePeriod.rows.length === 1) {
      console.log(`    SUCCESS: Today (${today}) maps to open period '${activePeriod.rows[0].period_name}' (ID: ${activePeriod.rows[0].id}).`);
      console.log(`    Posting safety gate is now OPERATIONALLY CLEARED for transactions on ${today}.`);
    } else {
      throw new Error(`Expected exactly 1 open period for ${today}, found ${activePeriod.rows.length}`);
    }

    await client.query('COMMIT');
    console.log('\n>>> TRANSACTION COMMITTED SUCCESSFULLY TO POSTGRESQL <<<\n');

    // 5. Query API Endpoints to verify UI and API service response
    console.log('[5] Verifying Accounting Setup via HTTP API (port 3001)...');
    const token = createSuperAdminToken();

    const res = await fetch('http://localhost:3001/api/v1/accounting/setup', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Cookie': `_cth_jwt=${token}`
      }
    });

    const body = await res.json();
    console.log(`    HTTP Status: ${res.status}`);
    console.log(`    API Response:`, JSON.stringify(body, null, 2));

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('FAILED during provisioning:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
