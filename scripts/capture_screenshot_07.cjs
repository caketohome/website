/**
 * Capture Screenshot 07: Branch Manager Operations & KOT Queue (/branch-manager)
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { chromium } = require(path.resolve(__dirname, '../frontend/node_modules/@playwright/test'));

const BASE_URL = 'http://localhost:3000';
const JWT_SECRET = 'supersecret';
const BRAIN_DIR = 'C:/Users/alexc/.gemini/antigravity/brain/ef41ec32-eb13-410b-aac0-36f4fec20a16';
const SHOT_DIR = path.resolve(__dirname, '../artifacts/phase-6-1-2-screenshots');

fs.mkdirSync(SHOT_DIR, { recursive: true });
fs.mkdirSync(BRAIN_DIR, { recursive: true });

function signJwt(role = 'BRANCH_MANAGER', branchId = 'br_indiranagar_01') {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    userId: 'shpmgr_indiranagar_01',
    role,
    phone: '9999999999',
    customerUid: 'shpmgr_indiranagar_01',
    customerId: 'shpmgr_indiranagar_01',
    branchId,
    name: 'Branch Manager - Indiranagar',
    email: 'indiranagar@caketohome.in',
    isSuperAdmin: false,
    iat: now,
    exp: now + 7200,
  };
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const data = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}`;
  return `${data}.${crypto.createHmac('sha256', JWT_SECRET).update(data).digest('base64url')}`;
}

async function capture() {
  console.log('[7/7] Launching browser to capture /branch-manager...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1.5,
  });

  const branchToken = signJwt('BRANCH_MANAGER', 'br_indiranagar_01');
  await context.addCookies([
    { name: '_cth_jwt', value: branchToken, domain: 'localhost', path: '/' },
    { name: '_cth_role', value: 'BRANCH_MANAGER', domain: 'localhost', path: '/' },
    { name: '_cth_user_id', value: 'shpmgr_indiranagar_01', domain: 'localhost', path: '/' },
    { name: 'branch_id', value: 'br_indiranagar_01', domain: 'localhost', path: '/' },
  ]);

  const page = await context.newPage();
  try {
    console.log('Navigating to http://localhost:3000/branch-manager...');
    await page.goto(`${BASE_URL}/branch-manager`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(4000);

    const name = '07_branch_kitchen_queue_kot.png';
    const localPath = path.join(SHOT_DIR, name);
    const brainPath = path.join(BRAIN_DIR, name);

    await page.screenshot({ path: localPath, fullPage: true });
    fs.copyFileSync(localPath, brainPath);
    const stat = fs.statSync(localPath);
    console.log(`[SAVED] ${name} (${(stat.size / 1024).toFixed(1)} KB) to ${localPath} and ${brainPath}`);
  } catch (err) {
    console.error('Failed to capture /branch-manager:', err);
    throw err;
  } finally {
    await browser.close();
  }
}

capture().then(() => {
  console.log('Screenshot 07 capture complete.');
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});

