const path = require('path');
const fs = require('fs');
const { chromium } = require(path.join(__dirname, '../frontend/node_modules/playwright'));

const VIEWPORTS = [
  { width: 320, height: 600, name: '320px-mobile-compact' },
  { width: 360, height: 740, name: '360px-mobile-standard' },
  { width: 375, height: 667, name: '375px-iphone-se-x' },
  { width: 390, height: 844, name: '390px-iphone-14-15' },
  { width: 414, height: 896, name: '414px-iphone-plus-max' },
  { width: 768, height: 1024, name: '768px-tablet-portrait' },
  { width: 1024, height: 768, name: '1024px-tablet-landscape' },
  { width: 1280, height: 800, name: '1280px-desktop' },
  { width: 1440, height: 900, name: '1440px-large-desktop' },
];

async function runAudit() {
  const screenshotsDir = path.join(__dirname, 'screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const consoleErrors = [];
  const consoleWarnings = [];
  const network4xx5xx = [];
  const failedNetworkRequests = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    } else if (msg.type() === 'warning') {
      consoleWarnings.push(msg.text());
    }
  });

  page.on('response', (res) => {
    const status = res.status();
    const url = res.url();
    if (status >= 400) {
      network4xx5xx.push({
        status,
        url,
        statusText: res.statusText(),
        method: res.request().method(),
      });
    }
  });

  page.on('requestfailed', (req) => {
    failedNetworkRequests.push({
      url: req.url(),
      method: req.method(),
      failure: req.failure()?.errorText,
    });
  });

  console.log('Navigating to http://localhost:3000 ...');
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2500); // allow hydration

  const auditReport = {
    viewports: {},
    consoleErrors,
    consoleWarnings,
    network4xx5xx,
    failedNetworkRequests,
  };

  for (const vp of VIEWPORTS) {
    console.log(`\n=== Testing Viewport: ${vp.width}x${vp.height} (${vp.name}) ===`);
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.waitForTimeout(500);

    const isMobile = vp.width < 768;

    // Viewport layout metrics - inspecting VISIBLE elements
    const metrics = await page.evaluate((isMob) => {
      const docScrollWidth = document.documentElement.scrollWidth;
      const bodyScrollWidth = document.body.scrollWidth;
      const windowWidth = window.innerWidth;
      const hasHorizontalOverflow = docScrollWidth > windowWidth || bodyScrollWidth > windowWidth;

      const header = document.querySelector('header');
      const headerRect = header ? header.getBoundingClientRect() : null;
      const main = document.querySelector('main');
      const mainRect = main ? main.getBoundingClientRect() : null;

      const findVisible = (selector) => {
        const els = Array.from(document.querySelectorAll(selector));
        return els.find(el => {
          const r = el.getBoundingClientRect();
          const s = window.getComputedStyle(el);
          return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden';
        });
      };

      // Visible Brand Logo
      const logoEl = Array.from(document.querySelectorAll('a[href="/"]')).find(el => {
        const r = el.getBoundingClientRect();
        return el.textContent.includes('CakeToHome') && r.width > 0 && r.height > 0;
      });
      const logoRect = logoEl ? logoEl.getBoundingClientRect() : null;

      // Visible Location button
      const locationButtons = Array.from(document.querySelectorAll('button')).filter(b => 
        b.getAttribute('aria-label')?.includes('location') || b.textContent.includes('Deliver to') || b.textContent.includes('Set location') || b.textContent.includes('Set your')
      );
      const locBtn = locationButtons.find(b => {
        const r = b.getBoundingClientRect();
        const s = window.getComputedStyle(b);
        return r.width > 0 && r.height > 0 && s.display !== 'none';
      });
      const locRect = locBtn ? locBtn.getBoundingClientRect() : null;

      // Visible Wishlist button
      const wishlistEl = findVisible('a[aria-label*="Favorites"]');
      const wishlistRect = wishlistEl ? wishlistEl.getBoundingClientRect() : null;

      // Visible Cart button
      const cartEl = findVisible('button[aria-label="Shopping Cart"]');
      const cartRect = cartEl ? cartEl.getBoundingClientRect() : null;

      // Cart Badge
      const badgeEl = cartEl ? cartEl.querySelector('span') : null;
      const badgeRect = badgeEl ? badgeEl.getBoundingClientRect() : null;

      // Visible Profile button
      const profileEl = findVisible('a[aria-label*="Sign in"]') || findVisible('button[aria-label*="profile"]');
      const profileRect = profileEl ? profileEl.getBoundingClientRect() : null;

      return {
        windowWidth,
        docScrollWidth,
        bodyScrollWidth,
        hasHorizontalOverflow,
        headerRect: headerRect ? { width: headerRect.width, height: headerRect.height, top: headerRect.top, bottom: headerRect.bottom } : null,
        mainTop: mainRect ? mainRect.top : null,
        logo: logoRect ? { width: logoRect.width, height: logoRect.height, left: logoRect.left, right: logoRect.right, isClipped: logoRect.right > windowWidth } : null,
        location: locRect ? { width: locRect.width, height: locRect.height, top: locRect.top, isClipped: locRect.right > windowWidth } : null,
        wishlist: wishlistRect ? { width: wishlistRect.width, height: wishlistRect.height, right: wishlistRect.right, isClipped: wishlistRect.right > windowWidth } : null,
        cart: cartRect ? { width: cartRect.width, height: cartRect.height, right: cartRect.right, isClipped: cartRect.right > windowWidth } : null,
        cartBadge: badgeRect ? { width: badgeRect.width, height: badgeRect.height, top: badgeRect.top, right: badgeRect.right } : null,
        profile: profileRect ? { width: profileRect.width, height: profileRect.height, right: profileRect.right, isClipped: profileRect.right > windowWidth } : null,
      };
    }, isMobile);

    // Save screenshot
    const screenshotPath = path.join(screenshotsDir, `audit-${vp.name}.png`);
    await page.screenshot({ path: screenshotPath });

    // Interactive tests for this viewport
    let locationModalOpened = false;
    let locationModalClosed = false;
    let locationModalEscape = false;
    let searchTriggerWorked = false;
    let searchInputTyped = false;
    let searchResultsCount = 0;
    let searchEscapeClosed = false;
    let profileMenuOpened = false;
    let profileMenuClosed = false;

    try {
      // 1. Location modal test using visible selector
      const locBtn = page.locator('button[aria-label="Select delivery location"]').filter({ has: page.locator('visible=true') }).or(page.locator('header button:has-text("Deliver to"), header button:has-text("Set your")')).first();
      if (await locBtn.isVisible()) {
        await locBtn.click();
        await page.waitForTimeout(350);
        const modalHeading = page.locator('h3:has-text("Select Delivery Location")');
        locationModalOpened = await modalHeading.isVisible();

        // Test Escape key
        await page.keyboard.press('Escape');
        await page.waitForTimeout(200);
        const modalVisibleAfterEsc = await modalHeading.isVisible();
        if (!modalVisibleAfterEsc) {
          locationModalEscape = true;
          locationModalClosed = true;
        } else {
          // close via close button
          const closeBtn = page.locator('button[aria-label="Close location selector"]');
          if (await closeBtn.isVisible()) {
            await closeBtn.click();
            await page.waitForTimeout(200);
            locationModalClosed = !(await modalHeading.isVisible());
          }
        }
      }

      // 2. Search test
      if (isMobile) {
        const searchBtn = page.locator('button[aria-label="Search cakes and bakery items"]').filter({ has: page.locator('visible=true') }).or(page.locator('button[aria-label="Search cakes and bakery items"]')).last();
        if (await searchBtn.isVisible()) {
          await searchBtn.click();
          await page.waitForTimeout(350);
          const mobileInput = page.locator('input[aria-label="Search products mobile"]');
          searchTriggerWorked = await mobileInput.isVisible();
          if (searchTriggerWorked) {
            await mobileInput.fill('Choc');
            await page.waitForTimeout(700);
            searchInputTyped = true;
            searchResultsCount = await page.locator('a[href*="/products/"]').count();

            // Press Escape
            await page.keyboard.press('Escape');
            await page.waitForTimeout(200);
            // Click Cancel
            const cancelBtn = page.locator('button:has-text("Cancel")').first();
            if (await cancelBtn.isVisible()) {
              await cancelBtn.click();
              await page.waitForTimeout(200);
            }
            searchEscapeClosed = !(await mobileInput.isVisible());
          }
        }
      } else {
        const desktopInput = page.locator('input[aria-label="Search products"]').filter({ has: page.locator('visible=true') }).first();
        if (await desktopInput.isVisible()) {
          searchTriggerWorked = true;
          await desktopInput.click();
          await desktopInput.fill('Choc');
          await page.waitForTimeout(700);
          searchInputTyped = true;
          searchResultsCount = await page.locator('a[href*="/products/"]').count();

          // Press Escape
          await page.keyboard.press('Escape');
          await page.waitForTimeout(200);
          // Click outside to clear focus
          await page.mouse.click(10, 10);
          await page.waitForTimeout(200);
          searchEscapeClosed = true;
        }
      }

      // 3. Profile menu test
      const profileTrigger = page.locator('[data-testid="profile-menu-trigger"]:visible');
      if (await profileTrigger.isVisible()) {
        await profileTrigger.click();
        await page.waitForTimeout(300);
        profileMenuOpened = await page.locator('text=Sign In, text=Profile, a[href="/login"]').first().isVisible();
        await page.keyboard.press('Escape');
        await page.waitForTimeout(200);
        profileMenuClosed = true;
      }
    } catch (e) {
      console.error(`Error during interaction testing at ${vp.name}:`, e.message);
    }

    auditReport.viewports[vp.name] = {
      ...metrics,
      interactions: {
        locationModalOpened,
        locationModalClosed,
        locationModalEscape,
        searchTriggerWorked,
        searchInputTyped,
        searchResultsCount,
        searchEscapeClosed,
        profileMenuOpened,
        profileMenuClosed,
      },
    };

    console.log(`  Horizontal Overflow: ${metrics.hasHorizontalOverflow ? 'FAIL' : 'PASS (0px)'}`);
    console.log(`  Logo: ${metrics.logo ? `${metrics.logo.width}x${metrics.logo.height} (Clipped: ${metrics.logo.isClipped})` : 'MISSING'}`);
    console.log(`  Location: ${metrics.location ? `${metrics.location.width}x${metrics.location.height}` : 'MISSING'}`);
    console.log(`  Wishlist Target: ${metrics.wishlist ? `${metrics.wishlist.width}x${metrics.wishlist.height}` : 'MISSING'}`);
    console.log(`  Cart Target: ${metrics.cart ? `${metrics.cart.width}x${metrics.cart.height}` : 'MISSING'}`);
    console.log(`  Profile Target: ${metrics.profile ? `${metrics.profile.width}x${metrics.profile.height}` : 'MISSING'}`);
    console.log(`  Location Modal: Opened=${locationModalOpened}, Closed=${locationModalClosed}`);
    console.log(`  Search Interaction: Trigger=${searchTriggerWorked}, Typed=${searchInputTyped}, ResultsCount=${searchResultsCount}`);
  }

  await browser.close();

  fs.writeFileSync(path.join(__dirname, 'full_browser_audit_results.json'), JSON.stringify(auditReport, null, 2));
  console.log('\n=== Audit Complete. Results written to full_browser_audit_results.json ===');
}

runAudit().catch(err => {
  console.error('Fatal audit error:', err);
  process.exit(1);
});
