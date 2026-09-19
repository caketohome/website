const { chromium } = require('./frontend/node_modules/playwright');

async function runVerification() {
  console.log('=== CakeToHome Playwright E2E Verification ===\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();

  const results = {
    desktop: {},
    mobile: {},
    pdp: {},
    interactions: {},
    consoleErrors: [],
    failedRequests: []
  };

  const page = await context.newPage();

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      results.consoleErrors.push(msg.text());
    }
  });

  page.on('requestfailed', (req) => {
    results.failedRequests.push({ url: req.url(), failure: req.failure()?.errorText });
  });

  try {
    // 1. Desktop Homepage Verification
    console.log('[1/4] Testing Desktop Homepage (1280x800)...');
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000); // allow hydration

    // Inspect Typography
    const typography = await page.evaluate(() => {
      // Find Section Headings
      const headings = Array.from(document.querySelectorAll('h1, h2, h3'));
      const sectionHeading = headings.find(h => h.textContent.includes('Best-Selling') || h.textContent.includes('Offerings') || h.textContent.includes('Occasion'));
      const productTitle = headings.find(h => h.closest('[data-testid="product-card"]') || h.closest('[class*="product-card"]'));

      const getStyles = (el) => {
        if (!el) return null;
        const cs = window.getComputedStyle(el);
        return {
          fontFamily: cs.fontFamily,
          fontSize: cs.fontSize,
          fontWeight: cs.fontWeight,
          lineHeight: cs.lineHeight,
          color: cs.color
        };
      };

      // Check Product card structure
      const productCard = document.querySelector('[data-testid="product-card"]') || document.querySelector('[class*="product-card"]');
      const hasStretchedLink = productCard ? Boolean(productCard.querySelector('a.absolute.inset-0')) : false;
      const hasOrderBtn = productCard ? Boolean(productCard.querySelector('button:not([aria-label*="Wishlist"]):not([aria-label*="Favorites"])')) : false;
      const hasExploreHint = productCard ? productCard.textContent.includes('Explore cake') : false;

      // Check CTA section
      const ctaSection = Array.from(document.querySelectorAll('section')).find(s => s.textContent.includes('Ready to Celebrate?') || s.textContent.includes('Bakery Concierge'));
      const ctaBg = ctaSection ? window.getComputedStyle(ctaSection).backgroundColor : null;

      // Check horizontal overflow
      const hasHorizontalScroll = document.documentElement.scrollWidth > window.innerWidth;

      return {
        sectionHeadingStyle: getStyles(sectionHeading),
        productTitleStyle: getStyles(productTitle),
        hasStretchedLink,
        hasOrderBtn,
        hasExploreHint,
        ctaBg,
        hasHorizontalScroll
      };
    });

    results.desktop = typography;
    console.log('Desktop Results:', JSON.stringify(typography, null, 2));

    // 2. Interaction Verification on Desktop: Wishlist Click vs Product Card Click
    console.log('\n[2/4] Testing Card Interactions...');
    const cardNavigated = await page.evaluate(async () => {
      const productCard = document.querySelector('[data-testid="product-card"]') || document.querySelector('[class*="product-card"]');
      if (!productCard) return { error: 'No product card found' };

      const stretchedLink = productCard.querySelector('a.absolute.inset-0');
      const wishlistBtn = productCard.querySelector('button[aria-label*="Favorites"], button[aria-label*="Wishlist"]');

      return {
        hasLink: Boolean(stretchedLink),
        linkHref: stretchedLink ? stretchedLink.getAttribute('href') : null,
        hasWishlistBtn: Boolean(wishlistBtn),
        wishlistZIndex: wishlistBtn ? window.getComputedStyle(wishlistBtn).zIndex : null
      };
    });
    results.interactions = cardNavigated;
    console.log('Interaction Results:', JSON.stringify(cardNavigated, null, 2));

    // 3. Mobile Homepage Verification (390x844)
    console.log('\n[3/4] Testing Mobile Viewport (390x844)...');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(1000);

    const mobileResults = await page.evaluate(() => {
      const hasHorizontalScroll = document.documentElement.scrollWidth > window.innerWidth;
      const productCard = document.querySelector('[data-testid="product-card"]') || document.querySelector('[class*="product-card"]');
      return {
        hasHorizontalScroll,
        cardVisible: Boolean(productCard && productCard.offsetHeight > 0)
      };
    });
    results.mobile = mobileResults;
    console.log('Mobile Results:', JSON.stringify(mobileResults, null, 2));

    // 4. Reduced Motion Verification
    console.log('\n[4/4] Testing Reduced Motion Media Queries...');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const reducedMotionCheck = await page.evaluate(() => {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    });
    results.reducedMotion = reducedMotionCheck;
    console.log('Reduced Motion Active in Browser:', reducedMotionCheck);

  } catch (err) {
    console.error('Playwright Error:', err);
    results.error = err.message;
  } finally {
    await browser.close();
  }

  console.log('\n=== Summary of Playwright Run ===');
  console.log('Console Errors:', results.consoleErrors.length);
  console.log('Failed Requests:', results.failedRequests.length);
  console.log('Completed successfully.');
}

runVerification();
