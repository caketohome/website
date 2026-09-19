const { chromium } = require(require('path').resolve(__dirname, '../frontend/node_modules/playwright'));
const path = require('path');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  
  const viewports = [
    { name: '320x568', width: 320, height: 568 },
    { name: '360x640', width: 360, height: 640 },
    { name: '375x667', width: 375, height: 667 },
    { name: '390x844', width: 390, height: 844 },
    { name: '412x915', width: 412, height: 915 },
    { name: '430x932', width: 430, height: 932 },
    { name: '768x1024', width: 768, height: 1024 },
    { name: '820x1180', width: 820, height: 1180 },
    { name: '1024x768', width: 1024, height: 768 },
    { name: '1280x720', width: 1280, height: 720 },
    { name: '1440x900', width: 1440, height: 900 },
    { name: '1920x1080', width: 1920, height: 1080 },
  ];

  const outDir = path.join(__dirname, 'screenshots_responsive');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const results = [];

  for (const vp of viewports) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    // Apply the proposed layout fix in the DOM dynamically for preview verification
    await page.evaluate(() => {
      // 1. Wrap layout in flex min-h-screen
      const main = document.querySelector('main');
      const footer = document.querySelector('footer');
      const header = document.querySelector('header');
      
      if (main) {
        main.className = 'flex-1 flex flex-col w-full max-w-full min-w-0';
      }

      if (footer) {
        footer.className = 'w-full flex flex-col gap-3 justify-center items-center py-6 px-4 bg-[#07090E] border-t border-white/10 text-slate-400 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] sm:pb-8 transition-colors duration-200';
        const text = footer.querySelector('p, span, .text-ui-fg');
        if (text) {
          text.className = 'flex flex-wrap gap-1 text-xs sm:text-sm text-center px-4 justify-center text-slate-400 leading-relaxed';
        }
      }
    });

    // Check measurements
    const metrics = await page.evaluate(() => {
      const body = document.body;
      const html = document.documentElement;
      const footer = document.querySelector('footer');
      const sommelier = document.querySelector('button[aria-label="Open AI Bakery Concierge"]');
      const whatsapp = document.querySelector('button[aria-label="Contact CakeToHome on WhatsApp"]');

      return {
        hasHorizontalOverflow: html.scrollWidth > html.clientWidth,
        scrollWidth: html.scrollWidth,
        clientWidth: html.clientWidth,
        footerVisible: footer ? window.getComputedStyle(footer).display !== 'none' : false,
        footerOffsetTop: footer ? footer.offsetTop : null,
        footerHeight: footer ? footer.offsetHeight : null,
        sommelierVisible: sommelier ? window.getComputedStyle(sommelier).display !== 'none' : false,
        whatsappVisible: whatsapp ? window.getComputedStyle(whatsapp).display !== 'none' : false
      };
    });

    results.push({ viewport: vp.name, ...metrics });

    // Scroll to bottom
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(300);

    await page.screenshot({ path: path.join(outDir, `vp_${vp.name}.png`), fullPage: false });
    await page.close();
  }

  console.log('Responsive Metrics Summary:');
  console.log(JSON.stringify(results, null, 2));

  await browser.close();
})();
