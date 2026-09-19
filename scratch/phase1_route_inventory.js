const http = require('http');

const routes = [
  // Customer-facing
  { path: '/', name: 'Homepage' },
  { path: '/products', name: 'Product Catalog' },
  { path: '/products/chocolate-truffle', name: 'PDP Chocolate Truffle' },
  { path: '/search?q=chocolate', name: 'Search Results' },
  { path: '/category/chocolate-cakes', name: 'Category Page' },
  { path: '/occasions/birthday-cakes', name: 'Occasion Page' },
  { path: '/cart', name: 'Cart' },
  { path: '/checkout', name: 'Checkout' },
  { path: '/your-order?orderId=ord_sample', name: 'Order Confirmation' },
  { path: '/login', name: 'Login' },
  { path: '/signup', name: 'Signup' },
  { path: '/account', name: 'Customer Profile' },
  { path: '/account/orders', name: 'Order History' },
  { path: '/account/wishlist', name: 'Wishlist' },
  { path: '/compare', name: 'Product Compare' },
  { path: '/track', name: 'Order Tracking' },
  // Admin & ERP
  { path: '/dashboard?tab=orders', name: 'Admin Orders' },
  { path: '/dashboard?tab=catalog', name: 'Admin Catalog & PIM' },
  { path: '/dashboard?tab=branches', name: 'Admin Branches' },
  { path: '/dashboard?tab=delivery', name: 'Admin Delivery' },
  { path: '/dashboard?tab=fulfillment', name: 'Admin Operations & Cutoff' },
  { path: '/dashboard?tab=tax_master', name: 'Admin Tax Master' },
  { path: '/dashboard?tab=abandoned_carts', name: 'Admin Cart Recovery' },
  { path: '/dashboard?tab=telemarketing', name: 'Admin Reorder Outreach' },
  { path: '/dashboard?tab=crm', name: 'Admin CRM & Customers' },
  { path: '/dashboard?tab=login_activity', name: 'Admin Login Security' },
  { path: '/dashboard?tab=marketing', name: 'Admin Marketing' },
  { path: '/dashboard?tab=popups', name: 'Admin Popup Manager' },
  { path: '/dashboard?tab=seo', name: 'Admin SEO & Digital' },
  { path: '/dashboard?tab=automation', name: 'Admin Messaging & Auto' },
  { path: '/dashboard?tab=webhooks', name: 'Admin Event Gateway' },
  { path: '/dashboard?tab=cms', name: 'Admin Content & CMS' },
  { path: '/dashboard?tab=analytics', name: 'Admin Analytics & Reports' },
  { path: '/dashboard?tab=staff_profiles', name: 'Admin Staff Profiles' },
  { path: '/dashboard?tab=notifications', name: 'Admin Alerts' },
  { path: '/dashboard?tab=settings', name: 'Admin Settings' },
  { path: '/dashboard/shop', name: 'Branch Kitchen Portal' },
  { path: '/dashboard/delivery-partner', name: 'Rider Portal' }
];

async function checkRoute(r) {
  return new Promise((resolve) => {
    const req = http.get({
      hostname: 'localhost',
      port: 3000,
      path: r.path,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Playwright Audit)',
        'Cookie': '_cth_role=SUPER_ADMIN; _cth_user_id=admin_01'
      },
      timeout: 8000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          path: r.path,
          name: r.name,
          status: res.statusCode,
          size: data.length,
          hasTitle: data.includes('<title'),
          hasError: data.includes('Internal Server Error') || data.includes('Application error'),
        });
      });
    });
    req.on('error', (err) => {
      resolve({ path: r.path, name: r.name, status: 'ERROR', error: err.message });
    });
    req.on('timeout', () => {
      req.destroy();
      resolve({ path: r.path, name: r.name, status: 'TIMEOUT' });
    });
  });
}

async function main() {
  console.log('Testing ' + routes.length + ' routes on localhost:3000...');
  const results = [];
  for (const r of routes) {
    const res = await checkRoute(r);
    console.log(`[${res.status}] ${r.name} (${r.path}) - ${res.size || 0} bytes`);
    results.push(res);
  }
  const passed = results.filter(r => r.status === 200).length;
  console.log(`\nSummary: ${passed}/${results.length} returned 200 OK`);
}

main();
