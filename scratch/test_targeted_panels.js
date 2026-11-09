const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { chromium } = require('../frontend/node_modules/playwright');

const ARTIFACT_DIR = 'C:/Users/alexc/.gemini/antigravity-ide/brain/bd4c3032-9680-4184-a5d5-db6eac6b478f';

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

const TARGETS = [
  { id: 'expenses', name: 'Expenses & Cash Disbursements', keyText: 'Expense Management' },
  { id: 'bank_accounts', name: 'Bank Accounts Master', keyText: 'Bank' },
  { id: 'bank_reconciliation', name: 'Bank Reconciliation (BRS)', keyText: 'Reconciliation' },
  { id: 'gateway_settlements', name: 'Gateway Settlements', keyText: 'Gateway' },
];

async function run() {
  const token = createSuperAdminToken();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addCookies([
    { name: '_cth_jwt', value: token, domain: 'localhost', path: '/' },
    { name: '_cth_role', value: 'SUPER_ADMIN', domain: 'localhost', path: '/' },
    { name: '_cth_user_id', value: 'admin_01', domain: 'localhost', path: '/' },
  ]);

  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('  [Console Error]:', msg.text());
    }
  });

  page.on('pageerror', err => {
    console.log('  [Page Error]:', err.message);
  });

  for (const t of TARGETS) {
    console.log(`\nNavigating to ${t.name} (tab=${t.id})...`);
    await page.goto(`http://localhost:3001/dashboard?tab=${t.id}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    // Wait up to 10s for chunk compilation and rendering
    await page.waitForTimeout(8000);

    const bodyText = await page.innerText('body');
    console.log(`  Rendered text length: ${bodyText.length}`);
    console.log(`  Snippet: "${bodyText.replace(/\s+/g, ' ').substring(0, 200)}..."`);

    await page.screenshot({ path: path.join(ARTIFACT_DIR, `e2e_accounting_${t.id}.png`), fullPage: false });
    console.log(`  Updated screenshot saved: e2e_accounting_${t.id}.png`);
  }

  await browser.close();
  console.log('\nDone.');
}

run().catch(console.error);
