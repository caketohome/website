/**
 * CakeToHome — Bank & Cash Management live browser demonstration.
 *
 * Drives the real running Next.js app (port 3000) with Playwright Chromium against the
 * isolated rehearsal database (cth_rehearsal_phase5 on 127.0.0.1:5433):
 *   1. Opens /accounting/bank-management (dashboard)
 *   2. Opens "Add Bank Account", fills the form, submits
 *   3. Verifies the new account appears in the register (masked number)
 *   4. Opens account details
 *   5. Reloads the page and verifies persistence
 *   6. Verifies DB rows: bank_account, GL account, balanced opening-balance journal, bank_transaction
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { chromium } = require(path.resolve(__dirname, '../frontend/node_modules/@playwright/test'));
const { Client } = require(path.resolve(__dirname, '../frontend/node_modules/pg'));

const BASE_URL = 'http://localhost:3000';
const JWT_SECRET = 'supersecret';
const DB_URL = 'postgresql://cth_test_user:cth_test_password@127.0.0.1:5433/cth_rehearsal_phase5';
const SHOT_DIR = path.resolve(__dirname, '../artifacts/bank-management-screenshots');
const BRAIN_DIR = 'C:/Users/alexc/.gemini/antigravity/brain/ef41ec32-eb13-410b-aac0-36f4fec20a16';
fs.mkdirSync(SHOT_DIR, { recursive: true });

const results = [];
function check(title, ok, detail = '') {
  results.push({ title, ok, detail });
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${title}${detail ? ' — ' + detail : ''}`);
}

function signJwt() {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    userId: 'admin_01', role: 'SUPER_ADMIN', phone: '9999999999', customerUid: 'admin_01', customerId: 'admin_01',
    branchId: null, partnerId: null, name: 'Super Admin', email: 'superadmin@cakes2home.com',
    isSuperAdmin: true, iat: now, exp: now + 3600,
  };
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const data = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}`;
  return `${data}.${crypto.createHmac('sha256', JWT_SECRET).update(data).digest('base64url')}`;
}

(async () => {
  const db = new Client({ connectionString: DB_URL });
  await db.connect();

  const IFSC = 'SBIN0000813';
  const acctNo = '409911223344';
  const last4 = acctNo.slice(-4);
  const nickname = `SBI Operating ${last4}`;

  // Clean up any prior run of this demo account so we can demonstrate a clean creation with ₹1,00,000 opening balance
  const prior = await db.query('SELECT id, gl_account_id FROM public.bank_account WHERE ifsc_code=$1 AND account_number=$2', [IFSC, acctNo]);
  for (const row of prior.rows) {
    await db.query('DELETE FROM public.bank_transaction WHERE bank_account_id=$1', [row.id]);
    await db.query('DELETE FROM public.bank_account WHERE id=$1', [row.id]);
    if (row.gl_account_id) {
      const jeRes = await db.query('SELECT DISTINCT journal_entry_id FROM public.accounting_journal_line WHERE account_id=$1', [row.gl_account_id]);
      for (const je of jeRes.rows) {
        const vRes = await db.query('SELECT voucher_id FROM public.accounting_journal_entry WHERE id=$1', [je.journal_entry_id]);
        await db.query('DELETE FROM public.accounting_journal_line WHERE journal_entry_id=$1', [je.journal_entry_id]);
        await db.query('DELETE FROM public.accounting_journal_entry WHERE id=$1', [je.journal_entry_id]);
        if (vRes.rows[0]?.voucher_id) {
          await db.query('DELETE FROM public.accounting_voucher WHERE id=$1', [vRes.rows[0].voucher_id]);
        }
      }
      await db.query('DELETE FROM public.accounting_account WHERE id=$1 AND is_system=false', [row.gl_account_id]);
    }
  }

  console.log(`Demo account: SBI ${acctNo} (last4 ${last4}), nickname "${nickname}"`);
  const before = await db.query('SELECT COUNT(*)::int AS c FROM public.bank_account');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  await context.addCookies([{ name: '_cth_jwt', value: signJwt(), domain: 'localhost', path: '/' }]);
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('pageerror', (e) => consoleErrors.push(e.message));

  try {
    // 1. Dashboard
    const initBankPromise = page.waitForResponse((r) => r.url().includes('/api/v1/accounting/bank-accounts') && r.request().method() === 'GET', { timeout: 90000 }).catch(() => null);
    await page.goto(`${BASE_URL}/accounting/bank-management`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await initBankPromise;
    await page.getByText('Add Bank Account').first().waitFor({ timeout: 30000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SHOT_DIR, '01_dashboard.png'), fullPage: true });
    const dashText = await page.locator('body').innerText();
    check('Dashboard renders with seeded HDFC account', dashText.includes('HDFC Bank'));

    // 2. Open add form and fill
    await page.getByRole('button', { name: /Add Bank Account/ }).first().click();
    await page.getByPlaceholder('e.g. HDFC Bank, ICICI Bank, SBI').waitFor({ timeout: 15000 });
    await page.getByPlaceholder('e.g. HDFC Bank, ICICI Bank, SBI').fill('State Bank of India');
    await page.getByPlaceholder('e.g. CakeToHome India Private Limited').fill('CakeToHome India Private Limited');
    await page.getByPlaceholder('Full account number').fill(acctNo);
    await page.getByPlaceholder('Re-enter to verify').fill(acctNo);
    await page.getByPlaceholder('e.g. HDFC0000053').fill(IFSC);
    await page.getByPlaceholder('e.g. Indiranagar Bangalore').fill('Indiranagar Branch');
    await page.getByPlaceholder('e.g. Primary Ops A/c').fill(nickname);
    await page.locator('input[type="number"][placeholder="0.00"]').first().fill('100000');
    await page.screenshot({ path: path.join(SHOT_DIR, '02_add_bank_form.png'), fullPage: true });
    check('Add Bank form filled', true);

    // 3. Submit
    const respPromise = page.waitForResponse((r) => r.url().includes('/api/v1/accounting/bank-accounts') && r.request().method() === 'POST', { timeout: 60000 });
    await page.getByRole('button', { name: /^Save Bank Account$/ }).click();
    const resp = await respPromise;
    const body = await resp.json().catch(() => ({}));
    check('POST /api/v1/accounting/bank-accounts succeeded', resp.ok() && body.success, `HTTP ${resp.status()} ${body.message || ''}`);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(SHOT_DIR, '03_after_save.png'), fullPage: true });

    // 4. Register view (click the horizontal tab "Bank Accounts (2)")
    await page.getByRole('button', { name: /Bank Accounts \(\d+\)/ }).first().click();
    await page.waitForTimeout(1500);
    const regText = await page.locator('body').innerText();
    check('New account visible in register', regText.includes(nickname) && regText.includes('State Bank of India'));
    check('Account number masked in UI', regText.includes(last4) && !regText.includes(acctNo));
    await page.screenshot({ path: path.join(SHOT_DIR, '04_bank_register.png'), fullPage: true });

    // 5. Details modal
    const row = page.locator('tr', { hasText: nickname }).first();
    if (await row.count()) {
      await row.getByRole('button', { name: 'View' }).first().click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(SHOT_DIR, '05_account_details.png'), fullPage: true });
      check('Account details opened', true);
    } else {
      check('Account details opened', false, 'row not found');
    }

    // 6. Reload persistence
    const reloadBankPromise = page.waitForResponse((r) => r.url().includes('/api/v1/accounting/bank-accounts') && r.request().method() === 'GET', { timeout: 60000 }).catch(() => null);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await reloadBankPromise;
    await page.waitForTimeout(2000);
    await page.getByRole('button', { name: /Bank Accounts \(\d+\)/ }).first().click().catch(() => {});
    await page.waitForTimeout(1500);
    const afterReload = await page.locator('body').innerText();
    check('Account persists after page reload', afterReload.includes(nickname) && afterReload.includes('1,00,000.00'));
    await page.screenshot({ path: path.join(SHOT_DIR, '06_after_reload.png'), fullPage: true });

    // Copy screenshots to brain artifact directory for direct markdown embedding
    for (const file of ['01_dashboard.png', '02_add_bank_form.png', '03_after_save.png', '04_bank_register.png', '05_account_details.png', '06_after_reload.png']) {
      const src = path.join(SHOT_DIR, file);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, path.join(BRAIN_DIR, `bank_${file}`));
      }
    }
  } catch (err) {
    check('Browser flow completed without exception', false, err.message);
    await page.screenshot({ path: path.join(SHOT_DIR, 'zz_error.png'), fullPage: true }).catch(() => {});
  }
  check('No uncaught page errors', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));
  await browser.close();

  // 7. Database verification
  const after = await db.query('SELECT COUNT(*)::int AS c FROM public.bank_account');
  check('bank_account row count increased by 1', after.rows[0].c === before.rows[0].c + 1, `${before.rows[0].c} -> ${after.rows[0].c}`);
  const ba = await db.query(
    `SELECT ba.*, aa.code AS gl_code, aa.type AS gl_type, aa.subtype AS gl_subtype
       FROM public.bank_account ba JOIN public.accounting_account aa ON aa.id = ba.gl_account_id
      WHERE ba.ifsc_code=$1 AND ba.account_number=$2`, [IFSC, acctNo]);
  const acc = ba.rows[0];
  check('Bank account persisted in DB with ₹1,00,000 balance', !!acc && Number(acc.current_balance) === 100000, acc ? `${acc.id} masked=${acc.account_number_masked} balance=${acc.current_balance}` : '');
  if (acc) {
    check('Linked to ASSET/BANK GL account', acc.gl_type === 'ASSET' && acc.gl_subtype === 'BANK', `GL ${acc.gl_code}`);
    const jl = await db.query(
      `SELECT COALESCE(SUM(jl.debit_amount),0)::numeric AS dr, COALESCE(SUM(jl.credit_amount),0)::numeric AS cr, COUNT(DISTINCT je.id)::int AS entries
         FROM public.accounting_journal_line jl
         JOIN public.accounting_journal_entry je ON je.id = jl.journal_entry_id
        WHERE je.id IN (SELECT DISTINCT journal_entry_id FROM public.accounting_journal_line WHERE account_id = $1)`, [acc.gl_account_id]
    );
    const j = jl.rows[0];
    check('Opening balance journal balanced (Dr = Cr = 100000)', Number(j.dr) === 100000 && Number(j.cr) === 100000, `Dr ${j.dr} / Cr ${j.cr}, entries ${j.entries}`);
    const tx = await db.query('SELECT COUNT(*)::int AS c, COALESCE(SUM(debit_amount + credit_amount),0)::numeric AS amt FROM public.bank_transaction WHERE bank_account_id=$1', [acc.id]);
    check('Opening bank_transaction recorded', tx.rows[0].c >= 1 && Number(tx.rows[0].amt) === 100000, `count ${tx.rows[0].c}, amount ${tx.rows[0].amt}`);
  }
  await db.end();

  const passed = results.filter((r) => r.ok).length;
  console.log(`\nRESULT: ${passed}/${results.length} checks passed`);
  fs.writeFileSync(path.join(SHOT_DIR, 'demo_results.json'), JSON.stringify({ acctNo: `****${last4}`, results }, null, 2));
  process.exit(passed === results.length ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(2); });
