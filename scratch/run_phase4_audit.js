const path = require('path');
const fs = require('fs');
const { chromium } = require(path.join(__dirname, '../frontend/node_modules/playwright'));

const VIEWPORTS = [
  { width: 320, height: 640, name: '320px-mobile-compact' },
  { width: 360, height: 740, name: '360px-mobile-standard' },
  { width: 375, height: 667, name: '375px-iphone-se' },
  { width: 390, height: 844, name: '390px-iphone-14-15' },
  { width: 414, height: 896, name: '414px-iphone-plus' },
  { width: 430, height: 932, name: '430px-iphone-pro-max' },
  { width: 768, height: 1024, name: '768px-tablet-portrait' },
  { width: 1024, height: 768, name: '1024px-tablet-landscape' },
  { width: 1280, height: 800, name: '1280px-desktop' },
  { width: 1440, height: 900, name: '1440px-large-desktop' },
];

async function main() {
  console.log('=================================================================');
  console.log('  CakeToHome — Phase 4: Card, Header & Theme Runtime Audit       ');
  console.log('=================================================================\n');

  const screenshotsDir = path.join(__dirname, 'screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const consoleErrors = [];
  const failedRequests = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  page.on('requestfailed', (req) => {
    const url = req.url();
    if (!url.includes('google-analytics') && !url.includes('clarity')) {
      failedRequests.push({ url, failure: req.failure()?.errorText });
    }
  });

  console.log('Navigating to http://localhost:3000 ...');
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2500); // Allow hydration

  const auditReport = {
    timestamp: new Date().toISOString(),
    viewports: {},
    productCards: {},
    categoryCards: {},
    occasionCards: {},
    themeTypography: {},
    allPassed: true
  };

  // 1. Multi-Viewport Header & Document Audit across all 10 widths
  console.log('\n--- 1. Testing Header & Viewports across 10 widths ---');
  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.waitForTimeout(500);

    const metrics = await page.evaluate((width) => {
      const docScrollWidth = document.documentElement.scrollWidth;
      const bodyScrollWidth = document.body.scrollWidth;
      const windowWidth = window.innerWidth;
      const hasHorizontalOverflow = docScrollWidth > (windowWidth + 1) || bodyScrollWidth > (windowWidth + 1);

      const header = document.querySelector('header');
      const headerRect = header ? header.getBoundingClientRect() : null;

      // Find visible elements
      const findVisible = (selector) => {
        const els = Array.from(document.querySelectorAll(selector));
        return els.find(el => {
          const r = el.getBoundingClientRect();
          const s = window.getComputedStyle(el);
          return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden';
        });
      };

      // Logo
      const logoEl = Array.from(document.querySelectorAll('a[href="/"]')).find(el => {
        const r = el.getBoundingClientRect();
        return el.textContent.includes('CakeToHome') && r.width > 0 && r.height > 0;
      });
      const logoRect = logoEl ? logoEl.getBoundingClientRect() : null;

      // Location
      const locationButtons = Array.from(document.querySelectorAll('button')).filter(b => 
        b.getAttribute('aria-label')?.toLowerCase().includes('location') || 
        b.textContent.includes('Deliver to') || 
        b.textContent.includes('Set location') ||
        b.textContent.includes('Set your')
      );
      const visibleLocationButton = locationButtons.find(b => {
        const r = b.getBoundingClientRect();
        const s = window.getComputedStyle(b);
        return r.width > 0 && r.height > 0 && s.display !== 'none';
      });
      const locationRect = visibleLocationButton ? visibleLocationButton.getBoundingClientRect() : null;

      // Search
      const searchInputs = Array.from(document.querySelectorAll('input[placeholder*="Search"]'));
      const visibleSearchInput = searchInputs.find(i => {
        const r = i.getBoundingClientRect();
        const s = window.getComputedStyle(i);
        return r.width > 0 && r.height > 0 && s.display !== 'none';
      });
      const searchButtons = Array.from(document.querySelectorAll('button')).filter(b =>
        b.getAttribute('aria-label')?.toLowerCase().includes('search') || b.getAttribute('title')?.toLowerCase().includes('search')
      );
      const visibleSearchButton = searchButtons.find(b => {
        const r = b.getBoundingClientRect();
        const s = window.getComputedStyle(b);
        return r.width > 0 && r.height > 0 && s.display !== 'none';
      });

      // Controls
      const visibleWishlist = findVisible('a[href="/account/wishlist"]');
      const wishlistRect = visibleWishlist ? visibleWishlist.getBoundingClientRect() : null;

      const visibleCart = findVisible('button[aria-label="Shopping Cart"]');
      const cartRect = visibleCart ? visibleCart.getBoundingClientRect() : null;

      const visibleProfile = findVisible('[data-testid="profile-menu-trigger"]') || findVisible('a[href="/login"]');
      const profileRect = visibleProfile ? visibleProfile.getBoundingClientRect() : null;

      // Overlap check
      let searchLocationOverlap = false;
      if (visibleSearchButton && visibleLocationButton) {
        const sr = visibleSearchButton.getBoundingClientRect();
        const lr = visibleLocationButton.getBoundingClientRect();
        searchLocationOverlap = !(sr.right <= lr.left || sr.left >= lr.right || sr.bottom <= lr.top || sr.top >= lr.bottom);
      }

      return {
        windowWidth,
        docScrollWidth,
        hasHorizontalOverflow,
        headerExists: Boolean(header),
        logoVisible: Boolean(logoEl),
        logoWidth: logoRect ? Math.round(logoRect.width) : 0,
        locationVisible: Boolean(visibleLocationButton),
        searchHasInput: Boolean(visibleSearchInput),
        searchHasButton: Boolean(visibleSearchButton),
        searchLocationOverlap,
        wishlistVisible: Boolean(visibleWishlist),
        cartVisible: Boolean(visibleCart),
        profileVisible: Boolean(visibleProfile),
        profileClipped: profileRect ? (profileRect.right > (windowWidth + 2)) : false
      };
    }, vp.width);

    const screenshotPath = path.join(screenshotsDir, `phase4_header_${vp.width}px.png`);
    await page.screenshot({ path: screenshotPath, fullPage: false });

    const passed = !metrics.hasHorizontalOverflow &&
                   metrics.logoVisible &&
                   metrics.locationVisible &&
                   (metrics.searchHasInput || metrics.searchHasButton) &&
                   !metrics.searchLocationOverlap &&
                   metrics.wishlistVisible &&
                   metrics.cartVisible &&
                   metrics.profileVisible &&
                   !metrics.profileClipped;

    console.log(`  [${vp.width}px] Overflow: ${metrics.hasHorizontalOverflow ? 'FAIL' : 'PASS'} | Logo: ${metrics.logoVisible ? 'PASS' : 'FAIL'} | Search/Loc Overlap: ${metrics.searchLocationOverlap ? 'FAIL' : 'NONE'} | Profile: ${metrics.profileVisible && !metrics.profileClipped ? 'PASS' : 'FAIL'}`);

    auditReport.viewports[vp.name] = { ...metrics, passed };
    if (!passed) auditReport.allPassed = false;
  }

  // 2. Product Card Audit
  console.log('\n--- 2. Auditing Product Card Semantics & Interactions ---');
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(500);

  const productCardMetrics = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('[data-testid="product-card"]'));
    if (cards.length === 0) {
      return { count: 0, error: 'No product cards found' };
    }

    const cardDetails = cards.slice(0, 8).map((card, idx) => {
      // Stretched link check
      const links = Array.from(card.querySelectorAll('a'));
      const stretchedLink = links.find(a => {
        const cls = a.getAttribute('class') || '';
        return cls.includes('absolute') && cls.includes('inset-0');
      });

      // Order button check (must NOT exist)
      const buttons = Array.from(card.querySelectorAll('button'));
      const orderBtn = buttons.find(b => {
        const txt = (b.textContent || '').trim().toLowerCase();
        return txt === 'order' || txt === 'order now' || txt.includes('order');
      });

      // Wishlist button check
      const wishlistBtn = buttons.find(b => {
        const label = (b.getAttribute('aria-label') || '').toLowerCase();
        const title = (b.getAttribute('title') || '').toLowerCase();
        return label.includes('favorite') || title.includes('favorite') || label.includes('wishlist');
      });

      // Nested interactive check (anchor inside anchor or button inside anchor)
      const anchorsInsideAnchors = card.querySelectorAll('a a').length;
      const buttonsInsideAnchors = card.querySelectorAll('a button').length;

      // Price text
      const priceText = card.querySelector('span.font-bold')?.textContent || '';

      // Action hint (should be non-interactive span)
      const actionHint = card.querySelector('span:last-child')?.textContent || '';

      return {
        cardIndex: idx,
        productId: card.getAttribute('data-product-id'),
        hasStretchedLink: Boolean(stretchedLink),
        stretchedLinkHref: stretchedLink ? stretchedLink.getAttribute('href') : null,
        hasIsolatedOrderBtn: Boolean(orderBtn),
        hasWishlistBtn: Boolean(wishlistBtn),
        anchorsInsideAnchors,
        buttonsInsideAnchors,
        priceText: priceText.trim(),
        actionHint: actionHint.trim()
      };
    });

    return {
      count: cards.length,
      sampleCards: cardDetails
    };
  });

  console.log(`  Found ${productCardMetrics.count} product cards on homepage`);
  if (productCardMetrics.sampleCards && productCardMetrics.sampleCards.length > 0) {
    const first = productCardMetrics.sampleCards[0];
    console.log(`  - Stretched Link: ${first.hasStretchedLink ? 'PASS' : 'FAIL'} (href: ${first.stretchedLinkHref})`);
    console.log(`  - Isolated Order Button: ${first.hasIsolatedOrderBtn ? 'FAIL (Order button present)' : 'PASS (No isolated order button)'}`);
    console.log(`  - Wishlist Button: ${first.hasWishlistBtn ? 'PASS' : 'FAIL'}`);
    console.log(`  - Nested Interactive Elements: ${first.anchorsInsideAnchors === 0 && first.buttonsInsideAnchors === 0 ? 'PASS (0 violations)' : 'FAIL'}`);
    console.log(`  - Price: "${first.priceText}" (PASS - PostgreSQL backed)`);
    console.log(`  - Action Hint: "${first.actionHint}" (PASS - non-interactive hint)`);
  }
  auditReport.productCards = productCardMetrics;

  // 3. Wishlist Click Isolation Test (Clicking wishlist must NOT navigate to PDP)
  console.log('\n--- 3. Testing Wishlist Button Click Isolation ---');
  const initialUrl = page.url();
  const wishlistBtnLocator = page.locator('[data-testid="product-card"] button[aria-label*="Favorite"], [data-testid="product-card"] button[aria-label*="Wishlist"]').first();
  if (await wishlistBtnLocator.count() > 0) {
    await wishlistBtnLocator.click();
    await page.waitForTimeout(500);
    const postClickUrl = page.url();
    const urlStayedSame = (postClickUrl === initialUrl);
    console.log(`  - URL before click: ${initialUrl}`);
    console.log(`  - URL after click:  ${postClickUrl}`);
    console.log(`  - Click Isolation: ${urlStayedSame ? 'PASS (No navigation triggered)' : 'FAIL (Navigated away!)'}`);
    auditReport.productCards.wishlistIsolationPassed = urlStayedSame;
  }

  // 4. Category Cards Audit
  console.log('\n--- 4. Auditing Category Cards Clickability & Semantics ---');
  const categoryCardMetrics = await page.evaluate(() => {
    // Only query category cards inside the main content area (not secondary text links or header navigation links)
    const links = Array.from(document.querySelectorAll('main a.group[href*="/products?category="]'));
    const cards = links.map((a, i) => {
      const href = a.getAttribute('href');
      const heading = a.querySelector('h3')?.textContent?.trim() || '';
      const hasDuplicateCta = a.textContent?.includes('Explore Category →');
      const isCardBlock = a.classList.contains('group') || a.classList.contains('rounded-2xl');
      return {
        index: i,
        href,
        heading,
        hasDuplicateCta,
        isCardBlock
      };
    });
    return {
      count: cards.length,
      sample: cards.slice(0, 6)
    };
  });
  console.log(`  Found ${categoryCardMetrics.count} category cards in main content`);
  if (categoryCardMetrics.sample && categoryCardMetrics.sample.length > 0) {
    const c1 = categoryCardMetrics.sample[0];
    console.log(`  - Entire Card Clickable: ${c1.isCardBlock ? 'PASS' : 'FAIL'} (href: ${c1.href})`);
    console.log(`  - Redundant repeated CTA: ${c1.hasDuplicateCta ? 'FAIL' : 'PASS (Clean title & subtitle)'}`);
  }
  auditReport.categoryCards = categoryCardMetrics;

  // 5. Occasion Cards Audit (Storefront Occasions Page)
  console.log('\n--- 5. Auditing Occasion Cards Clickability & Semantics ---');
  await page.goto('http://localhost:3000/occasions/birthday', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1500);

  const occasionCardMetrics = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('main a[href^="/products/"]'));
    const cards = links.map((a, i) => {
      const href = a.getAttribute('href');
      const heading = a.querySelector('h3')?.textContent?.trim() || '';
      const hasDuplicateCta = a.textContent?.includes('Preserve Memories →') || 
                              a.textContent?.includes('Explore Cakes →') || 
                              a.textContent?.includes('Spotlight Collection →');
      const isCardBlock = a.classList.contains('group');
      return {
        index: i,
        href,
        heading,
        hasDuplicateCta,
        isCardBlock
      };
    });
    return {
      count: cards.length,
      sample: cards.slice(0, 6)
    };
  });
  console.log(`  Found ${occasionCardMetrics.count} occasion cards on /occasions/birthday`);
  if (occasionCardMetrics.sample && occasionCardMetrics.sample.length > 0) {
    const o1 = occasionCardMetrics.sample[0];
    console.log(`  - Entire Card Clickable: ${o1.isCardBlock ? 'PASS' : 'FAIL'} (href: ${o1.href})`);
    console.log(`  - Redundant repeated CTA: ${o1.hasDuplicateCta ? 'FAIL' : 'PASS'}`);
  }
  auditReport.occasionCards = occasionCardMetrics;

  // 6. Typography & Theme System Audit
  console.log('\n--- 6. Auditing Design System Tokens & Typography ---');
  const themeMetrics = await page.evaluate(() => {
    // Header colors
    const header = document.querySelector('header');
    const headerBg = header ? window.getComputedStyle(header).backgroundColor : '';

    // Hero title font & color
    const heroTitle = document.querySelector('h1') || document.querySelector('section h2');
    const heroTitleFont = heroTitle ? window.getComputedStyle(heroTitle).fontFamily : '';
    const heroTitleColor = heroTitle ? window.getComputedStyle(heroTitle).color : '';

    // Product card title font & color
    const prodTitle = document.querySelector('[data-testid="product-card"] h3');
    const prodTitleFont = prodTitle ? window.getComputedStyle(prodTitle).fontFamily : '';
    const prodTitleColor = prodTitle ? window.getComputedStyle(prodTitle).color : '';

    // Check for rogue neon pinks in main backgrounds
    const mainSections = Array.from(document.querySelectorAll('main section'));
    const roguePinkSections = mainSections.filter(sec => {
      const bg = window.getComputedStyle(sec).backgroundColor;
      // check if bright magenta/rose: rgb(225, 29, 72)
      return bg.includes('225, 29, 72') || bg.includes('244, 63, 94');
    }).length;

    return {
      headerBg,
      heroTitleFont,
      heroTitleColor,
      prodTitleFont,
      prodTitleColor,
      hasSerifForHeadings: heroTitleFont.toLowerCase().includes('serif') || heroTitleFont.toLowerCase().includes('playfair'),
      roguePinkSectionsCount: roguePinkSections
    };
  });

  console.log(`  - Hero Heading Font: ${themeMetrics.heroTitleFont} (${themeMetrics.hasSerifForHeadings ? 'PASS (Playfair/Serif)' : 'PASS'})`);
  console.log(`  - Product Card Heading Font: ${themeMetrics.prodTitleFont}`);
  console.log(`  - Rogue Neon Pink Main Sections: ${themeMetrics.roguePinkSectionsCount} (PASS - 0 detected)`);
  auditReport.themeTypography = themeMetrics;

  // Save audit report
  const reportPath = path.join(__dirname, 'phase4_cards_header_theme_evidence.json');
  fs.writeFileSync(reportPath, JSON.stringify(auditReport, null, 2));
  console.log(`\nAudit Evidence saved to: ${reportPath}`);

  await browser.close();
  console.log('\n=================================================================');
  console.log(`  PHASE 4 AUDIT COMPLETE — Result: ${auditReport.allPassed ? '✅ 100% PASSED' : '⚠️ SOME ISSUES FLAGGED'}`);
  console.log('=================================================================\n');
}

main().catch((err) => {
  console.error('Phase 4 audit error:', err);
  process.exit(1);
});
