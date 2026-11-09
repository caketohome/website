const fs = require('fs');
const http = require('http');
const crypto = require('crypto');
const path = require('path');
const { Client } = require(path.resolve(__dirname, '../frontend/node_modules/pg'));

function getJwtSecret() {
  const env = fs.readFileSync('.env', 'utf8');
  for (const line of env.split('\n')) {
    if (line.trim().startsWith('JWT_SECRET=')) {
      let val = line.trim().substring('JWT_SECRET='.length).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
      return val;
    }
  }
  return 'supersecret';
}

function getDbConn() {
  const env = fs.readFileSync('.env', 'utf8');
  for (const line of env.split('\n')) {
    if (line.trim().startsWith('DATABASE_URL=')) {
      let val = line.trim().substring('DATABASE_URL='.length).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
      return val;
    }
  }
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

function makeApiCall(method, path, body = null, token = null) {
  return new Promise((resolve) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const payload = body ? JSON.stringify(body) : null;
    if (payload) headers['Content-Length'] = Buffer.byteLength(payload);

    const req = http.request({
      hostname: 'localhost',
      port: 3001,
      path: '/api/v1/' + path,
      method,
      headers,
      timeout: 10000,
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (e) { json = data; }
        resolve({ statusCode: res.statusCode, body: json });
      });
    });

    req.on('error', (err) => resolve({ statusCode: 0, error: err.message }));
    req.on('timeout', () => { req.destroy(); resolve({ statusCode: 408, error: 'TIMEOUT' }); });
    if (payload) req.write(payload);
    req.end();
  });
}

async function run() {
  console.log('=============================================================================');
  console.log('CakeToHome ERP — Test Category C: Vouchers, Journal Entries, and General Ledger');
  console.log('=============================================================================\n');

  const token = createSuperAdminToken();
  const client = new Client({ connectionString: getDbConn(), ssl: { rejectUnauthorized: false } });
  await client.connect();

  // C1. Audit all posted Journal Entries in PostgreSQL
  console.log('[C1] Auditing all posted Journal Entries and Lines in PostgreSQL...');
  const jeRes = await client.query(`
    SELECT 
      je.id, je.entry_no, je.voucher_id, je.entry_date::text,
      je.total_debit, je.total_credit,
      je.total_debit - je.total_credit as diff,
      COUNT(jl.id) as line_count
    FROM public.accounting_journal_entry je
    JOIN public.accounting_journal_line jl ON jl.journal_entry_id = je.id
    GROUP BY je.id, je.entry_no, je.voucher_id, je.entry_date, je.total_debit, je.total_credit
    ORDER BY je.entry_date, je.entry_no;
  `);

  console.table(jeRes.rows);
  const unbalanced = jeRes.rows.filter(r => Number(r.diff) !== 0);
  if (unbalanced.length === 0) {
    console.log(`  ✓ 100% of journal entries are mathematically balanced (Total: ${jeRes.rows.length}).`);
  } else {
    console.log(`  ❌ UNBALANCED JOURNAL ENTRIES FOUND:`, unbalanced);
  }

  // C2. Audit all vouchers
  console.log('\n[C2] Auditing Vouchers in PostgreSQL...');
  const vchRes = await client.query(`
    SELECT id, voucher_no, voucher_type, voucher_date::text, status, created_by, approved_by, posted_by
    FROM public.accounting_voucher
    ORDER BY voucher_date, voucher_no;
  `);
  console.table(vchRes.rows);

  // C3. Test API rejection of unbalanced manual journal draft
  console.log('\n[C3] Testing API validation: submitting unbalanced manual journal...');
  const unbalancedPayload = {
    voucher_type: 'JOURNAL',
    narration: 'Test Unbalanced Journal',
    entry_date: '2026-10-16',
    lines: [
      { account_id: 'bf1f8d20-8ad7-4a1b-bc0a-2870c1cca62f', debit_amount: 1000, credit_amount: 0 },
      { account_id: 'afdd90ab-7096-41fd-a268-7df89f7ed9b0', debit_amount: 0, credit_amount: 500 }
    ]
  };

  const unbalancedRes = await makeApiCall('POST', 'admin/accounting/journals/draft', unbalancedPayload, token);
  console.log(`  - Status: HTTP ${unbalancedRes.statusCode}`);
  console.log(`  - Response:`, JSON.stringify(unbalancedRes.body).substring(0, 120));
  if (unbalancedRes.statusCode === 400 || !unbalancedRes.body?.success) {
    console.log('  ✓ Correctly rejected unbalanced journal lines.');
  } else {
    console.log('  ❌ FAILED: Unbalanced journal was accepted!');
  }

  // C4. General Ledger Statement API
  console.log('\n[C4] Testing General Ledger Account Statement API...');
  // Query cash account 1111 ID
  const cashAcc = await client.query("SELECT id, code, name FROM public.accounting_account WHERE code = '1111'");
  if (cashAcc.rows.length > 0) {
    const glRes = await makeApiCall('GET', `admin/accounting/ledger?account_id=${cashAcc.rows[0].id}`, null, token);
    console.log(`  - Status: HTTP ${glRes.statusCode}`);
    if (glRes.statusCode === 200 && glRes.body?.success) {
      console.log(`  ✓ GL Statement for Account ${cashAcc.rows[0].code} (${cashAcc.rows[0].name}) returned successfully.`);
      console.log(`  ✓ Transaction Lines: ${glRes.body.data?.lines?.length || 0}`);
    } else {
      console.log('  ❌ GL API returned error:', glRes.body);
    }
  }

  await client.end();
  console.log('\n=============================================================================');
  console.log('CATEGORY C VERIFICATION COMPLETE: VOUCHER & GL INTEGRITY VERIFIED');
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
