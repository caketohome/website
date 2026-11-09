import { chromium, Browser, BrowserContext, Page } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';

const BASE_URL = 'http://localhost:3000';
const EVIDENCE_DIR = path.resolve(__dirname, '../../CHECKPOINTS/acceptance-test-evidence');
const VIDEO_DIR = path.join(EVIDENCE_DIR, 'video');

interface TestResult {
  role: string;
  panel: string;
  feature: string;
  action: string;
  expected: string;
  actual: string;
  status: 'PASS' | 'FAIL';
  screenshot?: string;
  error?: string;
}

const results: TestResult[] = [];

async function loginViaOtp(page: Page, phone: string, otp: string = '123456') {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2000); // Allow Next.js client hydration
  await page.waitForSelector('#phone_input', { timeout: 30000 });
  await page.click('#phone_input');
  await page.fill('#phone_input', phone);

  // Wait for phone submit button to become enabled
  await page.waitForFunction(() => {
    const btn = document.querySelector('button[type="submit"]') as HTMLButtonElement | null;
    return btn && !btn.disabled;
  }, { timeout: 15000 });

  await page.click('button[type="submit"]');

  // Wait for 6 OTP input boxes or numeric inputs
  await page.waitForSelector('input[inputmode="numeric"]', { timeout: 30000 });
  await page.waitForTimeout(500);
  const inputs = await page.$$('input[inputmode="numeric"]');
  for (let i = 0; i < Math.min(inputs.length, 6); i++) {
    await inputs[i].fill(otp[i]);
  }

  // If new customer onboarding step appears, fill the required name
  const nameInput = await page.$('input[placeholder="e.g. Alex R Ashok"]');
  if (nameInput) {
    await nameInput.fill('Verified Staff');
  }

  await page.waitForFunction(() => {
    const btns = Array.from(document.querySelectorAll('button[type="submit"]')) as HTMLButtonElement[];
    const activeBtn = btns.find(b => !b.disabled && b.offsetParent !== null);
    return !!activeBtn;
  }, { timeout: 15000 });

  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
}

async function runAuthAndRbacAcceptance() {
  console.log('══════════════════════════════════════════════════════════════════════════════');
  console.log('🧪 SUITE 1: AUTHENTICATION, RBAC & ROLE ISOLATION ACCEPTANCE');
  console.log('══════════════════════════════════════════════════════════════════════════════\n');

  const browser = await chromium.launch({ headless: true });

  // 1. Super Admin Authentication & Dashboard Access
  {
    console.log('▶ Test 1.1: Super Admin Login via OTP...');
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      recordVideo: { dir: VIDEO_DIR, size: { width: 1440, height: 900 } }
    });
    const page = await context.newPage();

    try {
      await loginViaOtp(page, '9999999999', '123456');
      await page.waitForFunction(() => window.location.pathname.startsWith('/dashboard'), { timeout: 30000 });
      await page.waitForTimeout(4000); // allow dashboard panels to hydrate
      const currentUrl = page.url();
      const hasDashboard = currentUrl.includes('/dashboard');

      const screenshot = 'rbac/01-super-admin-auth-success.png';
      await page.screenshot({ path: path.join(EVIDENCE_DIR, screenshot), fullPage: false });

      results.push({
        role: 'SUPER_ADMIN',
        panel: 'Admin Dashboard',
        feature: 'OTP Authentication',
        action: 'Login with 9999999999 and OTP 123456',
        expected: 'Redirect to /dashboard with full administrative access',
        actual: `Successfully landed on ${currentUrl}`,
        status: hasDashboard ? 'PASS' : 'FAIL',
        screenshot,
      });
      console.log(`  Status: ${hasDashboard ? '✅ PASS' : '❌ FAIL'} (${currentUrl})`);
    } catch (err: any) {
      console.error('  Failed:', err.message);
      results.push({
        role: 'SUPER_ADMIN',
        panel: 'Admin Dashboard',
        feature: 'OTP Authentication',
        action: 'Login with 9999999999',
        expected: 'Redirect to /dashboard',
        actual: `Error: ${err.message}`,
        status: 'FAIL',
        error: err.message,
      });
    } finally {
      await context.close();
    }
  }

  // 2. Branch Manager Authentication & Shop Dashboard Access
  {
    console.log('\n▶ Test 1.2: Branch Manager Login via OTP...');
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      recordVideo: { dir: VIDEO_DIR, size: { width: 1440, height: 900 } }
    });
    const page = await context.newPage();

    try {
      await loginViaOtp(page, '9876500001', '123456');
      await page.waitForFunction(() => window.location.pathname.startsWith('/dashboard/shop'), { timeout: 60000 });
      await page.waitForTimeout(4000);
      const currentUrl = page.url();
      const hasShopDashboard = currentUrl.includes('/dashboard/shop');

      const screenshot = 'rbac/02-branch-manager-auth-success.png';
      await page.screenshot({ path: path.join(EVIDENCE_DIR, screenshot), fullPage: false });

      results.push({
        role: 'BRANCH_MANAGER',
        panel: 'Shop Operations',
        feature: 'OTP Authentication',
        action: 'Login with 9876500001 (Rajesh Kumar)',
        expected: 'Redirect to /dashboard/shop with store management scope',
        actual: `Successfully landed on ${currentUrl}`,
        status: hasShopDashboard ? 'PASS' : 'FAIL',
        screenshot,
      });
      console.log(`  Status: ${hasShopDashboard ? '✅ PASS' : '❌ FAIL'} (${currentUrl})`);

      // Now test RBAC violation: Branch Manager attempting to access /dashboard (Central Admin)
      console.log('▶ Test 1.3: Branch Manager Access Restriction to Central Admin (/dashboard)...');
      await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(3000);
      const blockedUrl = page.url();
      const isBlocked = blockedUrl.includes('/dashboard/shop') || !blockedUrl.endsWith('/dashboard');

      const rbacScreenshot = 'rbac/03-branch-manager-blocked-from-admin.png';
      await page.screenshot({ path: path.join(EVIDENCE_DIR, rbacScreenshot) });

      results.push({
        role: 'BRANCH_MANAGER',
        panel: 'Central Admin',
        feature: 'Role Isolation Guard',
        action: 'Direct navigation to /dashboard',
        expected: 'Access blocked; fail-closed redirection back to /dashboard/shop',
        actual: `Redirected to ${blockedUrl}`,
        status: isBlocked ? 'PASS' : 'FAIL',
        screenshot: rbacScreenshot,
      });
      console.log(`  Status: ${isBlocked ? '✅ PASS' : '❌ FAIL'} (Landed on: ${blockedUrl})`);
    } catch (err: any) {
      console.error('  Failed:', err.message);
      results.push({
        role: 'BRANCH_MANAGER',
        panel: 'Shop Operations',
        feature: 'Role Guard',
        action: 'Login & navigate',
        expected: 'Branch scoped routing',
        actual: err.message,
        status: 'FAIL',
        error: err.message,
      });
    } finally {
      await context.close();
    }
  }

  // 3. Delivery Partner Authentication & Access
  {
    console.log('\n▶ Test 1.4: Delivery Partner Login via OTP...');
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      recordVideo: { dir: VIDEO_DIR, size: { width: 1440, height: 900 } }
    });
    const page = await context.newPage();

    try {
      await loginViaOtp(page, '9900011111', '123456');
      await page.waitForFunction(() => window.location.pathname.startsWith('/dashboard/delivery-partner'), { timeout: 60000 });
      await page.waitForTimeout(4000);
      const currentUrl = page.url();
      const hasDelivery = currentUrl.includes('/dashboard/delivery-partner');

      const screenshot = 'rbac/04-delivery-partner-auth-success.png';
      await page.screenshot({ path: path.join(EVIDENCE_DIR, screenshot), fullPage: false });

      results.push({
        role: 'DELIVERY_PARTNER',
        panel: 'Delivery Partner Dashboard',
        feature: 'OTP Authentication',
        action: 'Login with 9900011111 (Ramesh Rider)',
        expected: 'Redirect to /dashboard/delivery-partner with route & delivery controls',
        actual: `Successfully landed on ${currentUrl}`,
        status: hasDelivery ? 'PASS' : 'FAIL',
        screenshot,
      });
      console.log(`  Status: ${hasDelivery ? '✅ PASS' : '❌ FAIL'} (${currentUrl})`);

      // Test RBAC violation: Delivery Partner attempting to access /dashboard/shop and /dashboard
      console.log('▶ Test 1.5: Delivery Partner Access Restriction to /dashboard/shop...');
      await page.goto(`${BASE_URL}/dashboard/shop`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(3000);
      const shopBlockedUrl = page.url();
      const isShopBlocked = shopBlockedUrl.includes('/dashboard/delivery-partner') || !shopBlockedUrl.includes('/dashboard/shop');

      const rbacShopScreenshot = 'rbac/05-delivery-partner-blocked-from-shop.png';
      await page.screenshot({ path: path.join(EVIDENCE_DIR, rbacShopScreenshot) });

      results.push({
        role: 'DELIVERY_PARTNER',
        panel: 'Shop Dashboard',
        feature: 'Role Isolation Guard',
        action: 'Direct navigation to /dashboard/shop',
        expected: 'Access blocked; fail-closed redirection back to /dashboard/delivery-partner',
        actual: `Redirected to ${shopBlockedUrl}`,
        status: isShopBlocked ? 'PASS' : 'FAIL',
        screenshot: rbacShopScreenshot,
      });
      console.log(`  Status: ${isShopBlocked ? '✅ PASS' : '❌ FAIL'} (Landed on: ${shopBlockedUrl})`);
    } catch (err: any) {
      console.error('  Failed:', err.message);
      results.push({
        role: 'DELIVERY_PARTNER',
        panel: 'Delivery Partner',
        feature: 'Role Isolation',
        action: 'Login & navigate',
        expected: 'Delivery partner scoped routing',
        actual: err.message,
        status: 'FAIL',
        error: err.message,
      });
    } finally {
      await context.close();
    }
  }

  // 4. Unauthenticated Access Block (Fail-Closed)
  {
    console.log('\n▶ Test 1.6: Unauthenticated Access Guard on Protected Routes...');
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      recordVideo: { dir: VIDEO_DIR, size: { width: 1440, height: 900 } }
    });
    const page = await context.newPage();

    try {
      const protectedRoutes = ['/dashboard', '/dashboard/shop', '/dashboard/delivery-partner', '/account'];
      for (const route of protectedRoutes) {
        await page.goto(`${BASE_URL}${route}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(2000);
        const finalUrl = page.url();
        const isRedirectedToLogin = finalUrl.includes('/login');

        results.push({
          role: 'UNAUTHENTICATED',
          panel: route,
          feature: 'Fail-Closed Route Protection',
          action: `Direct unauthenticated navigation to ${route}`,
          expected: 'Redirect to /login with zero data leakage',
          actual: `Redirected to ${finalUrl}`,
          status: isRedirectedToLogin ? 'PASS' : 'FAIL',
        });
        console.log(`  Route ${route}: ${isRedirectedToLogin ? '✅ BLOCKED & REDIRECTED TO /login' : '❌ LEAKED'}`);
      }

      const screenshot = 'rbac/06-unauthenticated-redirect-login.png';
      await page.screenshot({ path: path.join(EVIDENCE_DIR, screenshot) });
    } catch (err: any) {
      console.error('  Failed:', err.message);
    } finally {
      await context.close();
    }
  }

  // 5. Responsive Testing across Viewports
  {
    console.log('\n▶ Test 1.7: Responsive Testing on Login & Public Storefront...');
    const viewports = [
      { name: 'Desktop (1440x900)', width: 1440, height: 900, slug: 'desktop' },
      { name: 'Tablet (768x1024)', width: 768, height: 1024, slug: 'tablet' },
      { name: 'Mobile (375x667)', width: 375, height: 667, slug: 'mobile' },
    ];

    for (const vp of viewports) {
      const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await context.newPage();
      await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);

      const shotPath = `responsive/01-login-${vp.slug}.png`;
      await page.screenshot({ path: path.join(EVIDENCE_DIR, shotPath) });

      // Check horizontal scrollbar
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });

      results.push({
        role: 'ANONYMOUS',
        panel: 'Login Page',
        feature: 'Responsive Layout',
        action: `Render at ${vp.name}`,
        expected: 'Clean responsive rendering, zero horizontal overflow',
        actual: hasHorizontalScroll ? 'Detected horizontal overflow' : 'Zero horizontal overflow',
        status: !hasHorizontalScroll ? 'PASS' : 'FAIL',
        screenshot: shotPath,
      });
      console.log(`  Viewport ${vp.name}: ${!hasHorizontalScroll ? '✅ PASS (No overflow)' : '❌ FAIL (Overflow detected)'}`);
      await context.close();
    }
  }

  await browser.close();

  // Write Suite 1 results
  const outPath = path.resolve(__dirname, '../../CHECKPOINTS/acceptance-test-evidence/suite1_auth_rbac_results.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`\nSuite 1 Complete! Results written to: ${outPath}`);
  console.log(`Total: ${results.length} | Passed: ${results.filter(r => r.status === 'PASS').length} | Failed: ${results.filter(r => r.status === 'FAIL').length}`);
}

runAuthAndRbacAcceptance().catch(err => {
  console.error('Suite 1 Fatal Error:', err);
  process.exit(1);
});
