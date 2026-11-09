const fs = require('fs');
const path = require('path');
const { Client } = require('e:/vig/cakes2home-main/cakes2home-main/frontend/node_modules/pg');

async function inspectBaseline() {
  console.log('================================================================================');
  console.log('PHASE 5 MANDATORY INITIAL INSPECTION & DISCOVERY');
  console.log('================================================================================\n');

  // 1. Git HEAD inspection
  try {
    const gitHead = fs.readFileSync('e:/vig/cakes2home-main/cakes2home-main/.git/HEAD', 'utf8').trim();
    console.log('Git HEAD:', gitHead);
    if (gitHead.startsWith('ref: ')) {
      const refPath = path.join('e:/vig/cakes2home-main/cakes2home-main/.git', gitHead.slice(5));
      if (fs.existsSync(refPath)) {
        console.log('Current commit:', fs.readFileSync(refPath, 'utf8').trim());
      }
    }
  } catch (e) {
    console.log('Git read note:', e.message);
  }

  // 2. Apps directory
  if (fs.existsSync('e:/vig/cakes2home-main/cakes2home-main/apps')) {
    console.log('\nApps directory contents:', fs.readdirSync('e:/vig/cakes2home-main/cakes2home-main/apps'));
  }

  // 3. Backend directory
  if (fs.existsSync('e:/vig/cakes2home-main/cakes2home-main/backend')) {
    console.log('\nBackend directory contents:', fs.readdirSync('e:/vig/cakes2home-main/cakes2home-main/backend'));
    if (fs.existsSync('e:/vig/cakes2home-main/cakes2home-main/backend/package.json')) {
      const backendPkg = JSON.parse(fs.readFileSync('e:/vig/cakes2home-main/cakes2home-main/backend/package.json', 'utf8'));
      console.log('Backend package.json:', {
        name: backendPkg.name,
        version: backendPkg.version,
        dependencies: Object.keys(backendPkg.dependencies || {}),
        devDependencies: Object.keys(backendPkg.devDependencies || {})
      });
    }
  }

  // 4. Frontend package.json
  if (fs.existsSync('e:/vig/cakes2home-main/cakes2home-main/frontend/package.json')) {
    const fePkg = JSON.parse(fs.readFileSync('e:/vig/cakes2home-main/cakes2home-main/frontend/package.json', 'utf8'));
    console.log('\nFrontend package.json:', {
      name: fePkg.name,
      version: fePkg.version,
      next: (fePkg.dependencies || {})['next'],
      dependenciesCount: Object.keys(fePkg.dependencies || {}).length,
      devDependenciesCount: Object.keys(fePkg.devDependencies || {}).length
    });
  }

  // 5. Protected database cth_test baseline integrity check
  console.log('\n--- Protected Baseline Check (cth_test on port 5433) ---');
  const cthTestClient = new Client({
    connectionString: 'postgresql://cth_test_user:cth_test_password@127.0.0.1:5433/cth_test'
  });
  await cthTestClient.connect();
  const counts = await cthTestClient.query(`
    SELECT 
      (SELECT count(*) FROM public."order") as orders,
      (SELECT count(*) FROM public.invoice) as invoices,
      (SELECT count(*) FROM public.accounting_voucher) as vouchers,
      (SELECT count(*) FROM public.payment_transaction) as payments,
      (SELECT count(*) FROM public.product) as products
  `);
  console.log('cth_test verified counts:', counts.rows[0]);
  await cthTestClient.end();

  // 6. Inspect .env and search for Supabase and Cashfree / Razorpay config keys
  console.log('\n--- Environment & Configuration Keys Check (Values Masked) ---');
  const envPaths = [
    'e:/vig/cakes2home-main/cakes2home-main/.env',
    'e:/vig/cakes2home-main/cakes2home-main/frontend/.env.local',
    'e:/vig/cakes2home-main/cakes2home-main/frontend/.env',
    'e:/vig/cakes2home-main/cakes2home-main/backend/.env'
  ];

  for (const ep of envPaths) {
    if (fs.existsSync(ep)) {
      const content = fs.readFileSync(ep, 'utf8');
      const lines = content.split('\n').filter(l => l.trim() && !l.trim().startsWith('#'));
      const keys = lines.map(l => l.split('=')[0].trim());
      console.log(`Keys in ${ep}:`, keys);
      // Look for Supabase project URL / ref without exposing secrets
      lines.forEach(l => {
        const [k, ...vParts] = l.split('=');
        const v = vParts.join('=');
        if (k.includes('SUPABASE_URL') || k.includes('SUPABASE_PROJECT') || k.includes('CASHFREE') || k.includes('RAZORPAY')) {
          console.log(`  ${k}: ${v.includes('http') ? v.slice(0, 35) + '...' : (v ? '[SET, len=' + v.length + ']' : '[EMPTY]')}`);
        }
      });
    }
  }
}

inspectBaseline().catch(console.error);

