const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3001';

const ROUTES_TO_TEST = [
  // Storefront root & shop
  { path: '/', auth: null, label: 'Storefront Homepage' },
  { path: '/products', auth: null, label: 'Products Catalogue' },
  { path: '/shop', auth: null, label: 'Shop Base' },
  { path: '/catalog', auth: null, label: 'Catalog Route (Linked in Account)' },
  { path: '/categories', auth: null, label: 'Categories Index' },
  { path: '/category', auth: null, label: 'Category Base' },
  { path: '/category/birthday-cakes', auth: null, label: 'Category Birthday Cakes' },
  { path: '/category/anniversary-cakes', auth: null, label: 'Category Anniversary Cakes' },
  { path: '/category/pastries', auth: null, label: 'Category Pastries' },
  { path: '/occasions', auth: null, label: 'Occasions Base' },
  { path: '/occasions/birthday', auth: null, label: 'Occasions Birthday' },
  { path: '/occasions/anniversary', auth: null, label: 'Occasions Anniversary' },
  { path: '/search', auth: null, label: 'Search Page' },
  { path: '/compare', auth: null, label: 'Compare Page' },
  { path: '/cart', auth: null, label: 'Cart Page' },
  { path: '/checkout', auth: null, label: 'Checkout Page' },
  { path: '/your-order', auth: null, label: 'Your Order Page' },
  { path: '/login', auth: null, label: 'Login Page' },
  { path: '/signup', auth: null, label: 'Signup Page' },
  { path: '/track', auth: null, label: 'Track Order Page' },
  { path: '/blog', auth: null, label: 'Blog Index' },
  { path: '/campaigns', auth: null, label: 'Campaigns Index' },
  { path: '/offline', auth: null, label: 'Offline Fallback' },
  { path: '/about-us', auth: null, label: 'CMS About Us' },
  { path: '/privacy-policy', auth: null, label: 'CMS Privacy Policy' },
  { path: '/terms-conditions', auth: null, label: 'CMS Terms & Conditions' },
  { path: '/faq', auth: null, label: 'CMS FAQ' },
  { path: '/contact-us', auth: null, label: 'CMS Contact Us' },

  // Customer Account routes (with customer session)
  { path: '/account', auth: 'CUSTOMER', label: 'Customer Account Dashboard' },
  { path: '/account/orders', auth: 'CUSTOMER', label: 'Customer Account Orders' },
  { path: '/account/addresses', auth: 'CUSTOMER', label: 'Customer Account Addresses' },
  { path: '/account/wallet', auth: 'CUSTOMER', label: 'Customer Account Wallet' },
  { path: '/account/wishlist', auth: 'CUSTOMER', label: 'Customer Account Wishlist' },
  { path: '/account/subscriptions', auth: 'CUSTOMER', label: 'Customer Account Subscriptions' },

  // Dashboard Role Portals
  { path: '/dashboard', auth: 'SUPER_ADMIN', label: 'Super Admin Dashboard Root' },
  { path: '/dashboard', auth: 'ADMIN', label: 'Admin Dashboard Root' },
  { path: '/dashboard', auth: 'INTERNAL_ADMIN', label: 'Internal Admin Dashboard Root' },
  { path: '/dashboard', auth: 'FINANCE_CONTROLLER', label: 'Finance Controller Dashboard' },
  { path: '/dashboard', auth: 'PLANNER', label: 'Planner Dashboard' },
  { path: '/dashboard', auth: 'DELIVERY_MANAGER', label: 'Delivery Manager Dashboard' },
  { path: '/dashboard/shop', auth: 'BRANCH_MANAGER', label: 'Branch Manager Shop Root' },
  { path: '/dashboard/shop/menu', auth: 'BRANCH_MANAGER', label: 'Branch Shop Menu' },
  { path: '/dashboard/shop/expenses', auth: 'BRANCH_MANAGER', label: 'Branch Shop Expenses' },
  { path: '/dashboard/shop/fleet', auth: 'BRANCH_MANAGER', label: 'Branch Shop Fleet' },
  { path: '/dashboard/shop/purchases', auth: 'BRANCH_MANAGER', label: 'Branch Shop Purchases' },
  { path: '/dashboard/shop/suppliers', auth: 'BRANCH_MANAGER', label: 'Branch Shop Suppliers' },
  { path: '/dashboard/delivery-partner', auth: 'DELIVERY_PARTNER', label: 'Delivery Partner Console' },

  // Admin Dashboard Tabs (tested as SUPER_ADMIN)
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
  ].map(tabId => ({
    path: `/dashboard?tab=${tabId}`,
    auth: 'SUPER_ADMIN',
    label: `Admin Tab: ${tabId}`
  })),

  // API Endpoints
  { path: '/api/auth/me', auth: 'SUPER_ADMIN', label: 'API Auth Me' },
  { path: '/api/v1/branches', auth: 'SUPER_ADMIN', label: 'API v1 Branches' },
  { path: '/api/v1/accessories', auth: 'SUPER_ADMIN', label: 'API v1 Accessories' },
  { path: '/api/v1/admin/branches', auth: 'SUPER_ADMIN', label: 'API v1 Admin Branches' },
  { path: '/api/v1/admin/accessories', auth: 'SUPER_ADMIN', label: 'API v1 Admin Accessories' },
  { path: '/api/v1/admin/ai/analytics', auth: 'SUPER_ADMIN', label: 'API v1 AI Analytics' },
  { path: '/api/v1/accounting/trial-balance', auth: 'SUPER_ADMIN', label: 'API v1 Trial Balance' },
  { path: '/api/v1/accounting/chart-of-accounts', auth: 'SUPER_ADMIN', label: 'API v1 Chart of Accounts' },
  { path: '/api/v1/accounting/general-ledger?account_id=afdd90ab-7096-41fd-a268-7df89f7ed9b0', auth: 'SUPER_ADMIN', label: 'API v1 General Ledger' },
  { path: '/api/v1/orders', auth: 'SUPER_ADMIN', label: 'API v1 Orders List' },
  { path: '/api/v1/catalog/products', auth: 'SUPER_ADMIN', label: 'API v1 Catalog Products' },
  { path: '/api/v1/tax-master', auth: 'SUPER_ADMIN', label: 'API v1 Tax Master' },
];

const crypto = require('crypto');

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
    if (route.auth) {
      const token = signTestToken({ role: route.auth, userId: route.auth === 'SUPER_ADMIN' ? 'admin_01' : `usr_test_${route.auth.toLowerCase()}` });
      headers['Cookie'] = `_cth_role=${route.auth}; _cth_user_id=usr_test_${route.auth.toLowerCase()}; _cth_jwt=${token}`;
      headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(url, { method: 'GET', headers }, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        resolve({
          path: route.path,
          label: route.label,
          auth: route.auth || 'NONE',
          status: res.statusCode,
          location: res.headers['location'] || null,
          contentType: res.headers['content-type'] || '',
          bodyLength: body.length,
          bodySnippet: body.slice(0, 100).replace(/[\r\n]+/g, ' ')
        });
      });
    });

    req.on('error', (err) => {
      resolve({
        path: route.path,
        label: route.label,
        auth: route.auth || 'NONE',
        status: 'ERROR',
        error: err.message
      });
    });

    req.setTimeout(35000, () => {
      req.destroy();
      resolve({
        path: route.path,
        label: route.label,
        auth: route.auth || 'NONE',
        status: 'TIMEOUT'
      });
    });

    req.end();
  });
}

async function runAudit() {
  console.log(`Starting Live Forensic Probe of ${ROUTES_TO_TEST.length} routes...`);
  const results = [];
  const statusCounts = {};

  for (let i = 0; i < ROUTES_TO_TEST.length; i++) {
    const r = ROUTES_TO_TEST[i];
    const res = await makeRequest(r);
    results.push(res);
    statusCounts[res.status] = (statusCounts[res.status] || 0) + 1;

    const flag = res.status === 404 ? '❌ [404 NOT FOUND]' :
                 res.status === 200 ? '✅ [200 OK]' :
                 res.status >= 300 && res.status < 400 ? `↪️ [${res.status} REDIRECT -> ${res.location}]` :
                 `⚠️ [${res.status}]`;

    console.log(`[${i + 1}/${ROUTES_TO_TEST.length}] ${flag} ${res.path} (${res.label}, Role: ${res.auth})`);
  }

  console.log('\n================== SUMMARY ==================');
  console.log(JSON.stringify(statusCounts, null, 2));

  const notFoundList = results.filter(r => r.status === 404);
  console.log(`\nTOTAL 404s: ${notFoundList.length}`);
  notFoundList.forEach(n => console.log(`  ❌ 404 on ${n.path} (${n.label}, Role: ${n.auth})`));

  const redirectsList = results.filter(r => r.status >= 300 && r.status < 400);
  console.log(`\nTOTAL REDIRECTS: ${redirectsList.length}`);
  redirectsList.forEach(r => console.log(`  ↪️ ${r.status} on ${r.path} -> ${r.location} (Role: ${r.auth})`));

  fs.writeFileSync(
    path.join(__dirname, 'live_routes_audit_results.json'),
    JSON.stringify(results, null, 2)
  );
  console.log('\nSaved full results to scratch/live_routes_audit_results.json');
}

runAudit();
