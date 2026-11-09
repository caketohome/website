const fs = require('fs');
const crypto = require('crypto');

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

function createToken() {
  const secret = getJwtSecret();
  const now = Math.floor(Date.now() / 1000);
  const h = { alg: 'HS256', typ: 'JWT' };
  const p = { userId: 'admin_01', role: 'SUPER_ADMIN', permissions: ['*'], isSuperAdmin: true, iat: now, exp: now + 86400 };
  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const d = `${b64(h)}.${b64(p)}`;
  const sig = crypto.createHmac('sha256', secret).update(d).digest('base64url');
  return `${d}.${sig}`;
}

async function run() {
  const token = createToken();
  const cookieHeader = `_cth_role=SUPER_ADMIN; _cth_user_id=admin_01; _cth_jwt=${token}; _medusa_jwt=${token}; auth_token=${token}`;
  
  const tabs = [
    'orders', 'catalog', 'branches', 'shared_inventory', 'delivery_coverage',
    'suppliers', 'purchases', 'bills_payable', 'bills_receivable', 'expenses',
    'teller_custody', 'accounting_work_queue', 'manual_journals', 'general_ledger',
    'profit_loss', 'balance_sheet', 'cash_flow', 'accounting_setup', 'bank_accounts',
    'bank_reconciliation', 'gateway_settlements', 'fleet', 'tax_master', 'crm',
    'cms', 'media', 'seo'
  ];

  console.log(`Starting warmup of ${tabs.length} admin dashboard tabs...`);
  for (const tab of tabs) {
    const u = `http://localhost:3001/dashboard?tab=${tab}`;
    const s = Date.now();
    try {
      const r = await fetch(u, { headers: { Cookie: cookieHeader } });
      console.log(`[Warmup Tab] ${r.status} ${tab.padEnd(24)} in ${Date.now() - s}ms`);
    } catch (e) {
      console.error(`[Warmup ERR] ${tab}: ${e.message}`);
    }
  }
  console.log('All tabs warmed up successfully!');
}

run().catch(console.error);
