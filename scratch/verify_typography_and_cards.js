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

async function main() {
  console.log("=== CakeToHome Runtime Verification ===");
  try {
    const homeRes = await fetchPage('http://localhost:3000/');
    console.log(`GET /: status=${homeRes.status}, size=${homeRes.body.length}`);

    // Check Playfair Display / Font loading in HTML
    const hasPlayfair = homeRes.body.includes('Playfair_Display') || homeRes.body.includes('Playfair Display') || homeRes.body.includes('font-serif');
    console.log(`Playfair Display / font-serif in DOM: ${hasPlayfair}`);

    // Check brand color tokens in HTML / CSS
    const hasBrandNavy = homeRes.body.includes('1D2F5D') || homeRes.body.includes('142040');
    const hasBrandGold = homeRes.body.includes('D4AF37') || homeRes.body.includes('C29B38');
    console.log(`Brand Navy (#1D2F5D / #142040) in DOM: ${hasBrandNavy}`);
    console.log(`Brand Gold (#D4AF37 / #C29B38) in DOM: ${hasBrandGold}`);

    // Check Product Card stretched link & no order button
    const hasExploreCake = homeRes.body.includes('Explore cake');
    const hasSeparateOrderBtn = homeRes.body.includes('<button>Order</button>') || homeRes.body.includes('>Order<');
    console.log(`Non-interactive hint 'Explore cake' in DOM: ${hasExploreCake}`);
    console.log(`Separate Order Button on product card in DOM: ${hasSeparateOrderBtn}`);

    // Check CTA section
    const hasCtaHeading = homeRes.body.includes('Ready to Celebrate?') || homeRes.body.includes('Bakery Concierge');
    console.log(`CTA section in DOM: ${hasCtaHeading}`);

    // Check Products listing
    const prodRes = await fetchPage('http://localhost:3000/products');
    console.log(`GET /products: status=${prodRes.status}, size=${prodRes.body.length}`);

    console.log("\nRuntime Verification Complete.");
  } catch (err) {
    console.error("Verification error:", err.message);
  }
}

main();
