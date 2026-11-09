const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const BASE_URL = 'http://localhost:3001';

function signTestToken(payload) {
  const secret = process.env.JWT_SECRET || 'supersecret';
  const header = { alg: 'HS256', typ: 'JWT' };
  const fullPayload = {
    userId: payload.userId || 'usr_test_admin',
    role: payload.role || 'SUPER_ADMIN',
    isSuperAdmin: payload.role === 'SUPER_ADMIN' || payload.userId === 'admin_01',
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
  };
  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const data = `${b64(header)}.${b64(fullPayload)}`;
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

function makeRequest(route) {
  return new Promise((resolve) => {
    const url = new URL(route.path, BASE_URL);
    const headers = {};
    if (route.auth && route.auth !== 'NONE') {
      const token = signTestToken({ role: route.auth, userId: route.auth === 'SUPER_ADMIN' ? 'admin_01' : `usr_test_${route.auth.toLowerCase()}` });
      headers['Cookie'] = `_cth_role=${route.auth}; _cth_user_id=usr_test_${route.auth.toLowerCase()}; _cth_jwt=${token}`;
      headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(url, { method: route.method || 'GET', headers }, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        resolve({
          path: route.path,
          label: route.label,
          category: route.category,
          auth: route.auth || 'NONE',
          status: res.statusCode,
          location: res.headers['location'] || null,
          contentType: res.headers['content-type'] || '',
          bodyLength: body.length,
          snippet: body.slice(0, 150).replace(/[\r\n]+/g, ' ')
        });
      });
    });

    req.on('error', (err) => {
      resolve({
        path: route.path,
        label: route.label,
        category: route.category,
        auth: route.auth || 'NONE',
        status: 'ERROR',
        error: err.message
      });
    });

    req.setTimeout(60000, () => {
      req.destroy();
      resolve({
        path: route.path,
        label: route.label,
        category: route.category,
        auth: route.auth || 'NONE',
        status: 'TIMEOUT'
      });
    });

    req.end();
  });
}

const ALL_ROUTES_SWEEP = [
  // ── 1. Storefront Root & Static Pages ─────────────────────────────────────
  { category: 'Storefront Static', path: '/', auth: 'NONE', label: 'Homepage' },
  { category: 'Storefront Static', path: '/products', auth: 'NONE', label: 'Products Index' },
  { category: 'Storefront Static', path: '/shop', auth: 'NONE', label: 'Shop Index' },
  { category: 'Storefront Static', path: '/catalog', auth: 'NONE', label: 'Catalog (Rewrite -> /products)' },
  { category: 'Storefront Static', path: '/categories', auth: 'NONE', label: 'Categories Index' },
  { category: 'Storefront Static', path: '/category', auth: 'NONE', label: 'Category Base' },
  { category: 'Storefront Static', path: '/occasions', auth: 'NONE', label: 'Occasions Index' },
  { category: 'Storefront Static', path: '/search', auth: 'NONE', label: 'Search Page' },
  { category: 'Storefront Static', path: '/compare', auth: 'NONE', label: 'Compare Page' },
  { category: 'Storefront Static', path: '/cart', auth: 'NONE', label: 'Cart Page' },
  { category: 'Storefront Static', path: '/checkout', auth: 'NONE', label: 'Checkout Page' },
  { category: 'Storefront Static', path: '/your-order', auth: 'NONE', label: 'Your Order Page' },
  { category: 'Storefront Static', path: '/login', auth: 'NONE', label: 'Login Page' },
  { category: 'Storefront Static', path: '/signup', auth: 'NONE', label: 'Signup Page' },
  { category: 'Storefront Static', path: '/track', auth: 'NONE', label: 'Track Order Page' },
  { category: 'Storefront Static', path: '/blog', auth: 'NONE', label: 'Blog Index' },
  { category: 'Storefront Static', path: '/campaigns', auth: 'NONE', label: 'Campaigns Index' },
  { category: 'Storefront Static', path: '/offline', auth: 'NONE', label: 'Offline Fallback' },

  // ── 2. Storefront Dynamic & Slugs ─────────────────────────────────────────
  { category: 'Storefront Dynamic', path: '/products/classic-chocolate-truffle-cake', auth: 'NONE', label: 'Product PDP: Chocolate Truffle' },
  { category: 'Storefront Dynamic', path: '/category/birthday-cakes', auth: 'NONE', label: 'Category: Birthday Cakes' },
  { category: 'Storefront Dynamic', path: '/category/anniversary-cakes', auth: 'NONE', label: 'Category: Anniversary Cakes' },
  { category: 'Storefront Dynamic', path: '/category/pastries', auth: 'NONE', label: 'Category: Pastries' },
  { category: 'Storefront Dynamic', path: '/occasions/birthday', auth: 'NONE', label: 'Occasion: Birthday' },
  { category: 'Storefront Dynamic', path: '/occasions/anniversary', auth: 'NONE', label: 'Occasion: Anniversary' },
  { category: 'Storefront Dynamic', path: '/occasions/wedding', auth: 'NONE', label: 'Occasion: Wedding' },
  { category: 'Storefront Dynamic', path: '/shop/classic-chocolate-truffle-cake', auth: 'NONE', label: 'Shop Handle PDP' },
  { category: 'Storefront Dynamic', path: '/city/bangalore', auth: 'NONE', label: 'City: Bangalore' },
  { category: 'Storefront Dynamic', path: '/blog/sample-post', auth: 'NONE', label: 'Blog Slug' },
  { category: 'Storefront Dynamic', path: '/campaigns/cmp_test_01', auth: 'NONE', label: 'Campaign ID' },
  { category: 'Storefront Dynamic', path: '/qr/TABLE-01', auth: 'NONE', label: 'QR Code' },

  // ── 3. CMS Managed Pages (/[slug]) ────────────────────────────────────────
  { category: 'CMS Slug', path: '/about-us', auth: 'NONE', label: 'CMS: About Us' },
  { category: 'CMS Slug', path: '/privacy-policy', auth: 'NONE', label: 'CMS: Privacy Policy' },
  { category: 'CMS Slug', path: '/terms-conditions', auth: 'NONE', label: 'CMS: Terms Conditions' },
  { category: 'CMS Slug', path: '/terms', auth: 'NONE', label: 'CMS: Terms (Rewrite)' },
  { category: 'CMS Slug', path: '/privacy', auth: 'NONE', label: 'CMS: Privacy (Rewrite)' },
  { category: 'CMS Slug', path: '/faq', auth: 'NONE', label: 'CMS: FAQ' },
  { category: 'CMS Slug', path: '/contact-us', auth: 'NONE', label: 'CMS: Contact Us' },

  // ── 4. Customer Account Portal ────────────────────────────────────────────
  { category: 'Customer Portal', path: '/account', auth: 'CUSTOMER', label: 'Customer Account Dashboard' },
  { category: 'Customer Portal', path: '/account/orders', auth: 'CUSTOMER', label: 'Customer Orders' },
  { category: 'Customer Portal', path: '/account/orders/ord_test_01', auth: 'CUSTOMER', label: 'Customer Order Detail' },
  { category: 'Customer Portal', path: '/account/addresses', auth: 'CUSTOMER', label: 'Customer Addresses' },
  { category: 'Customer Portal', path: '/account/wallet', auth: 'CUSTOMER', label: 'Customer Wallet' },
  { category: 'Customer Portal', path: '/account/wishlist', auth: 'CUSTOMER', label: 'Customer Wishlist' },
  { category: 'Customer Portal', path: '/account/subscriptions', auth: 'CUSTOMER', label: 'Customer Subscriptions' },
  { category: 'Customer Portal Unauth', path: '/account', auth: 'NONE', label: 'Unauth Customer Access (Expect 307)' },

  // ── 5. Role-Specific Dashboards & Consoles ────────────────────────────────
  { category: 'Role Dashboard', path: '/dashboard', auth: 'SUPER_ADMIN', label: 'Super Admin Dashboard' },
  { category: 'Role Dashboard', path: '/dashboard', auth: 'ADMIN', label: 'Internal Admin Dashboard' },
  { category: 'Role Dashboard', path: '/dashboard', auth: 'FINANCE_CONTROLLER', label: 'Finance Controller Dashboard' },
  { category: 'Role Dashboard', path: '/dashboard', auth: 'PLANNER', label: 'Planner Dashboard' },
  { category: 'Role Dashboard', path: '/dashboard', auth: 'DELIVERY_MANAGER', label: 'Delivery Manager Dashboard' },
  { category: 'Role Dashboard', path: '/dashboard', auth: 'NONE', label: 'Unauth Admin Dashboard (Expect 307)' },
  { category: 'Role Console', path: '/dashboard/shop', auth: 'BRANCH_MANAGER', label: 'Branch Manager Shop Root' },
  { category: 'Role Console', path: '/dashboard/shop/menu', auth: 'BRANCH_MANAGER', label: 'Branch Shop Menu' },
  { category: 'Role Console', path: '/dashboard/shop/expenses', auth: 'BRANCH_MANAGER', label: 'Branch Shop Expenses' },
  { category: 'Role Console', path: '/dashboard/shop/fleet', auth: 'BRANCH_MANAGER', label: 'Branch Shop Fleet' },
  { category: 'Role Console', path: '/dashboard/shop/purchases', auth: 'BRANCH_MANAGER', label: 'Branch Shop Purchases' },
  { category: 'Role Console', path: '/dashboard/shop/suppliers', auth: 'BRANCH_MANAGER', label: 'Branch Shop Suppliers' },
  { category: 'Role Console', path: '/dashboard/delivery-partner', auth: 'DELIVERY_PARTNER', label: 'Delivery Partner Console' },

  // ── 6. All 49 Admin Dashboard Tabs (as SUPER_ADMIN) ───────────────────────
  ...[
    "orders", "catalog", "search_engine", "branches", "delivery", "delivery_coverage",
    "fulfillment", "suppliers", "purchases", "bills_payable", "bills_receivable", "expenses",
    "accounting_work_queue", "teller_custody", "manual_journals", "cost_allocations",
    "corporate_accounts", "corporate_gifting", "corporate_routing_review", "gateway_settlements",
    "bank_accounts", "bank_reconciliation", "general_ledger", "profit_loss", "balance_sheet",
    "cash_flow", "accounting_setup", "fleet", "tax_master", "abandoned_carts", "telemarketing",
    "crm", "login_activity", "marketing", "popups", "seo",
    "automation", "webhooks", "cms", "media", "analytics", "ai_concierge",
    "staff_profiles", "notifications", "settings",
    "marketplace", "shared_inventory", "feature_flags", "operational_closures"
  ].map(t => ({
    category: 'Admin Tab',
    path: `/dashboard?tab=${t}`,
    auth: 'SUPER_ADMIN',
    label: `Admin Tab: ${t}`
  })),

  // ── 7. Core REST API Handlers ─────────────────────────────────────────────
  { category: 'API Endpoints', path: '/api/auth/me', auth: 'SUPER_ADMIN', label: 'API: Auth Me' },
  { category: 'API Endpoints', path: '/api/v1/branches', auth: 'SUPER_ADMIN', label: 'API: Branches List' },
  { category: 'API Endpoints', path: '/api/v1/accessories', auth: 'SUPER_ADMIN', label: 'API: Accessories' },
  { category: 'API Endpoints', path: '/api/v1/admin/branches', auth: 'SUPER_ADMIN', label: 'API: Admin Branches' },
  { category: 'API Endpoints', path: '/api/v1/admin/accessories', auth: 'SUPER_ADMIN', label: 'API: Admin Accessories' },
  { category: 'API Endpoints', path: '/api/v1/admin/ai/analytics', auth: 'SUPER_ADMIN', label: 'API: AI Analytics' },
  { category: 'API Endpoints', path: '/api/v1/accounting/chart-of-accounts', auth: 'SUPER_ADMIN', label: 'API: Chart of Accounts' },
  { category: 'API Endpoints', path: '/api/v1/accounting/trial-balance', auth: 'SUPER_ADMIN', label: 'API: Trial Balance' },
  { category: 'API Endpoints', path: '/api/v1/orders', auth: 'SUPER_ADMIN', label: 'API: Orders' },
  { category: 'API Endpoints', path: '/api/v1/catalog/products', auth: 'SUPER_ADMIN', label: 'API: Catalog Products' },
  { category: 'API Endpoints', path: '/api/v1/tax-master', auth: 'SUPER_ADMIN', label: 'API: Tax Master' },
  { category: 'API Endpoints', path: '/api/v1/admin/accounting/vouchers', auth: 'SUPER_ADMIN', label: 'API: Vouchers' },
  { category: 'API Endpoints', path: '/api/v1/admin/accounting/profit-loss', auth: 'SUPER_ADMIN', label: 'API: Profit & Loss' },
  { category: 'API Endpoints', path: '/api/v1/admin/accounting/balance-sheet', auth: 'SUPER_ADMIN', label: 'API: Balance Sheet' },
  { category: 'API Endpoints', path: '/api/v1/admin/accounting/cash-flow', auth: 'SUPER_ADMIN', label: 'API: Cash Flow' },
  { category: 'API Endpoints', path: '/api/v1/admin/purchases', auth: 'SUPER_ADMIN', label: 'API: Purchases' },
  { category: 'API Endpoints', path: '/api/v1/admin/bank-accounts', auth: 'SUPER_ADMIN', label: 'API: Bank Accounts' },
  { category: 'API Endpoints', path: '/api/v1/admin/tellers', auth: 'SUPER_ADMIN', label: 'API: Tellers' },
];

async function run() {
  console.log('================================================================================');
  console.log(`CAKETOHOME ERP — SYSTEMATIC ROUTE & INTERACTION SWEEP (${ALL_ROUTES_SWEEP.length} ROUTES)`);
  console.log('Target Base: ' + BASE_URL);
  console.log('================================================================================\n');

  const results = [];
  const statusCounts = {};
  const failures = [];

  for (let i = 0; i < ALL_ROUTES_SWEEP.length; i++) {
    const r = ALL_ROUTES_SWEEP[i];
    const res = await makeRequest(r);
    results.push(res);
    statusCounts[res.status] = (statusCounts[res.status] || 0) + 1;

    let flag = '✅';
    if (res.status === 404) {
      flag = '❌ [404 NOT FOUND]';
      failures.push(res);
    } else if (res.status === 500) {
      flag = '🔥 [500 SERVER ERROR]';
      failures.push(res);
    } else if (res.status >= 300 && res.status < 400) {
      flag = `↪️ [${res.status} -> ${res.location}]`;
    } else if (res.status === 'TIMEOUT' || res.status === 'ERROR') {
      flag = `⚠️ [${res.status}]`;
      failures.push(res);
    } else {
      flag = `✅ [${res.status} OK]`;
    }

    console.log(`[${String(i + 1).padStart(3, ' ')}/${ALL_ROUTES_SWEEP.length}] ${flag.padEnd(22, ' ')} [${res.category}] ${res.path} (Auth: ${res.auth}) - ${res.bodyLength} bytes`);
  }

  console.log('\n================================================================================');
  console.log('SWEEP SUMMARY:');
  console.log(JSON.stringify(statusCounts, null, 2));
  console.log(`TOTAL AUDITED: ${results.length}`);
  console.log(`CONFIRMED FAILURES: ${failures.length}`);
  console.log('================================================================================');

  if (failures.length > 0) {
    console.log('\nFAILURES BREAKDOWN:');
    failures.forEach(f => {
      console.log(`  ❌ ${f.status} on [${f.category}] ${f.path} (Auth: ${f.auth}): ${f.snippet || f.error}`);
    });
  }

  fs.writeFileSync(
    path.join(__dirname, 'systematic_route_sweep_results.json'),
    JSON.stringify({ summary: statusCounts, total: results.length, failures, results }, null, 2)
  );
  console.log('\nResults saved to scratch/systematic_route_sweep_results.json');
}

run().catch(console.error);
