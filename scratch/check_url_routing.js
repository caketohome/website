/**
 * Check exact URL patterns to find where leaking endpoints are handled
 */
const BASE = 'http://localhost:3000';

async function test() {
  const paths = [
    '/api/v1/admin/staff',
    '/api/v1/admin/staff/members',  
    '/api/v1/admin/staff/profiles',
    '/api/v1/admin/staff-profiles/staff',
    '/api/v1/admin/branches',
    '/api/v1/branches',
    '/api/v1/admin/tax-configurations',
    '/api/v1/admin/gateway-settlements',
    '/api/v1/admin/gateway-settlements/batches',
  ];

  for (const p of paths) {
    const resp = await fetch(`${BASE}${p}`, { redirect: 'manual' });
    const ct = resp.headers.get('content-type') || '';
    let snippet = '';
    if (ct.includes('json')) {
      const body = await resp.json();
      snippet = JSON.stringify(body).substring(0, 200);
    } else {
      snippet = (await resp.text()).substring(0, 100);
    }
    console.log(`${resp.status} ${p}`);
    console.log(`  ${snippet}`);
    console.log();
  }
}

test().catch(console.error);
