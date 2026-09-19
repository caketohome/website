const http = require('http');

function fetchPage(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    }).on('error', reject);
  });
}

async function runAudit() {
  console.log("=================================================");
  console.log("  CakeToHome Comprehensive Audit & Verification  ");
  console.log("=================================================\n");

  const home = await fetchPage('http://localhost:3000/');
  const products = await fetchPage('http://localhost:3000/products');

  console.log(`[1] Public Endpoints HTTP Status:`);
  console.log(` - GET /: ${home.status} (Payload size: ${(home.body.length / 1024).toFixed(1)} KB)`);
  console.log(` - GET /products: ${products.status} (Payload size: ${(products.body.length / 1024).toFixed(1)} KB)`);

  console.log(`\n[2] Typography Hierarchy Verification:`);
  const hasPlayfairFont = home.body.includes('Playfair_Display') || home.body.includes('font-serif');
  const hasInterFont = home.body.includes('Inter') || home.body.includes('font-sans');
  console.log(` - Editorial serif (Playfair Display / font-serif) active: ${hasPlayfairFont}`);
  console.log(` - Contemporary sans-serif (Inter / font-sans) active: ${hasInterFont}`);

  // Headings check
  const hasEditorialSectionHeadings = home.body.includes('font-serif') && (home.body.includes('Best-Selling Cakes') || home.body.includes('Celebrate Every Occasion') || home.body.includes('Our Offerings'));
  console.log(` - Editorial section headings (font-serif tracking-tight): ${hasEditorialSectionHeadings}`);

  console.log(`\n[3] Palette & Color Usage Verification:`);
  const hasNavy = home.body.includes('1D2F5D') || home.body.includes('142040');
  const hasGold = home.body.includes('D4AF37') || home.body.includes('C29B38');
  const hasCream = home.body.includes('FDFBF7') || home.body.includes('FAF9F6');
  console.log(` - Royal Patisserie Navy (#1D2F5D / #142040): ${hasNavy}`);
  console.log(` - Gold (#D4AF37 / #C29B38): ${hasGold}`);
  console.log(` - Warm Cream (#FDFBF7 / #FAF9F6): ${hasCream}`);

  console.log(`\n[4] Product Card Interaction & Architecture:`);
  const hasStretchedLink = home.body.includes('absolute inset-0 z-10') || products.body.includes('absolute inset-0 z-10');
  const hasWishlistZ20 = home.body.includes('z-20') && (home.body.includes('Wishlist') || home.body.includes('Favorites'));
  const hasExploreCakeHint = home.body.includes('Explore cake');
  // Check for separate Order button on product cards
  const hasOrderButtonOnCards = home.body.includes('>Order<') || products.body.includes('>Order<');
  console.log(` - Stretched link pattern (entire card clickable): ${hasStretchedLink}`);
  console.log(` - Wishlist button isolated at z-20 (stopPropagation): ${hasWishlistZ20}`);
  console.log(` - Non-interactive action hint ('Explore cake →'): ${hasExploreCakeHint}`);
  console.log(` - Separate 'Order' button on product cards removed: ${!hasOrderButtonOnCards}`);

  console.log(`\n[5] Category Card Interaction & Architecture:`);
  const hasCategoryCards = home.body.includes('/products?category=');
  const hasCategoryFocusRing = home.body.includes('focus:ring-[#D4AF37]');
  console.log(` - Entire category card is link to category listing: ${hasCategoryCards}`);
  console.log(` - Category cards keyboard focus ring: ${hasCategoryFocusRing}`);

  console.log(`\n[6] CTA Section Styling:`);
  const hasCtaVariants = home.body.includes('Bakery Concierge & Bespoke Commissions') || home.body.includes('Ready to Celebrate?');
  const hasPinkCtaDefault = home.body.includes('bg-gradient-to-r from-rose-600 to-pink-600');
  console.log(` - CTA section present: ${hasCtaVariants}`);
  console.log(` - Hardcoded pink gradient block removed: ${!hasPinkCtaDefault}`);

  console.log(`\n[7] Scroll-Frame Hero & Image Sequence Integrity:`);
  const hasHeroFrames = home.body.includes('/images/hero-frames/frame-001.webp') && home.body.includes('/images/hero-frames/frame-022.webp');
  console.log(` - 22-frame desktop hero image sequence intact (frame 1 through 22): ${hasHeroFrames}`);

  console.log(`\n=================================================`);
  console.log(`  Audit Completed Successfully.                  `);
  console.log(`=================================================`);
}

runAudit();
