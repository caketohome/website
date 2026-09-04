async function testRoutes() {
  const routes = [
    '/',
    '/products',
    '/products/search?search=Chocolate',
    '/admin',
    '/admin/products',
    '/admin/reviews',
    '/api/auth/me',
    '/api/customer/me',
    '/api/v1/health',
    '/api/v1/ai/context'
  ];

  console.log('=== VERIFYING ROUTES FOR 500 / INTERNAL SERVER ERROR ===\n');

  let failCount = 0;
  for (const r of routes) {
    const url = `http://localhost:3000${r}`;
    const t0 = Date.now();
    try {
      const res = await fetch(url, {
        headers: {
          'Cookie': '_cth_role=SUPER_ADMIN; _cth_user_id=admin_01'
        }
      });
      const duration = Date.now() - t0;
      console.log(`[HTTP ${res.status}] ${r.padEnd(35)} (${duration}ms)`);
      if (res.status >= 500) {
        const text = await res.text().catch(() => '');
        console.error(`  ❌ 500 ERROR on ${r}:\n  ${text.substring(0, 300)}...\n`);
        failCount++;
      }
    } catch (err: any) {
      console.error(`  ❌ NETWORK ERROR on ${r}:`, err.message);
      failCount++;
    }
  }

  console.log(`\nVerification finished with ${failCount} errors.`);
  if (failCount > 0) process.exit(1);
  process.exit(0);
}

testRoutes();
