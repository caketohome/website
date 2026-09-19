const routes = [
  '/',
  '/occasions/anniversary',
  '/occasions/wedding',
  '/occasions/engagement',
  '/occasions/birthday',
  '/occasions/valentines-day',
  '/occasions/baby-shower',
  '/occasions/graduation',
  '/occasions/retirement',
  '/category/chocolate-cakes',
  '/products?occasion=anniversary',
  '/products?occasion=wedding',
  '/products?category=chocolate-cakes',
  '/products'
];

async function verify() {
  console.log('--- Verifying Storefront & Occasion Routes ---');
  for (const r of routes) {
    const start = Date.now();
    try {
      const res = await fetch(`http://localhost:3000${r}`);
      const duration = Date.now() - start;
      const html = await res.text();
      const titleMatch = html.match(/<title>([^<]*)<\/title>/);
      const title = titleMatch ? titleMatch[1] : 'No title';
      console.log(`[${res.status}] ${r.padEnd(35)} in ${duration}ms | Title: ${title}`);
    } catch (err) {
      console.error(`[ERR] ${r} -> ${err.message}`);
    }
  }
}

verify();
