const http = require('http');

function req(path, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`http://localhost:3000${path}`);
    const reqOpts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: options.headers || { 'Content-Type': 'application/json' },
    };

    const request = http.request(reqOpts, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, raw: data });
        }
      });
    });

    request.on('error', reject);
    if (body) {
      request.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    request.end();
  });
}

async function main() {
  console.log('=== PHASE 6: SEARCH HEALTH & AI VISIBILITY VERIFICATION ===\n');

  // 1. Test SEO Audit
  console.log('1. Testing GET /api/v1/admin/seo/audit ...');
  const auditRes = await req('/api/v1/admin/seo/audit');
  console.log('   Status:', auditRes.status);
  console.log('   Overall Score:', auditRes.data?.overallScore, 'Grade:', auditRes.data?.grade);
  console.log('   Summary:', JSON.stringify(auditRes.data?.summary));
  console.log('   Metrics:', JSON.stringify(auditRes.data?.metrics));
  console.log('   Issues detected:', auditRes.data?.issues?.length);

  // 2. Test SEO Audit CSV Export
  console.log('\n2. Testing GET /api/v1/admin/seo/audit/export ...');
  const exportRes = await req('/api/v1/admin/seo/audit/export');
  console.log('   Status:', exportRes.status);
  console.log('   Content-Type:', exportRes.headers['content-type']);
  console.log('   CSV header:', exportRes.raw?.split('\n')[0]);
  console.log('   Total CSV rows:', exportRes.raw?.split('\n').length);

  // 3. Test Core Web Vitals
  console.log('\n3. Testing GET /api/v1/admin/seo/vitals ...');
  const vitalsRes = await req('/api/v1/admin/seo/vitals');
  console.log('   Status:', vitalsRes.status);
  console.log('   Metrics count:', vitalsRes.data?.vitals?.length);
  console.log('   Metrics:', vitalsRes.data?.vitals?.map((v) => `${v.metric}: ${v.value}${v.unit} (${v.status})`).join(', '));

  // 4. Test AI Crawler Policies (GET -> Mutation -> Verification -> Restoration)
  console.log('\n4. Testing AI Crawler Policies ...');
  const getCrawlerRes = await req('/api/v1/admin/seo/crawler-policies');
  console.log('   Initial Policies Status:', getCrawlerRes.status);
  const initialPolicies = getCrawlerRes.data?.policies || [];
  console.log('   Initial Policies:', initialPolicies.map((p) => `${p.bot}: ${p.allowed}`).join(', '));

  // Mutation: Toggle CCBot to true
  console.log('\n   Executing mutation: set CCBot allowed = true ...');
  const mutateRes = await req('/api/v1/admin/seo/crawler-policies', { method: 'POST' }, { bot: 'CCBot', allowed: true });
  console.log('   Mutation response status:', mutateRes.status);
  const mutatedCcBot = mutateRes.data?.policies?.find((p) => p.bot === 'CCBot');
  console.log('   CCBot after mutation:', mutatedCcBot?.allowed === true ? 'PASSED (true)' : 'FAILED');

  // Verify DB Read via separate GET
  const verifyRes = await req('/api/v1/admin/seo/crawler-policies');
  const readCcBot = verifyRes.data?.policies?.find((p) => p.bot === 'CCBot');
  console.log('   DB Read verification:', readCcBot?.allowed === true ? 'PASSED (persisted)' : 'FAILED');

  // Restoration: Restore CCBot to false
  console.log('\n   Executing restoration: set CCBot allowed = false ...');
  const restoreRes = await req('/api/v1/admin/seo/crawler-policies', { method: 'POST' }, { bot: 'CCBot', allowed: false });
  console.log('   Restoration response status:', restoreRes.status);
  const restoredCcBot = restoreRes.data?.policies?.find((p) => p.bot === 'CCBot');
  console.log('   CCBot restored:', restoredCcBot?.allowed === false ? 'PASSED (false)' : 'FAILED');

  console.log('\n=== PHASE 6 VERIFICATION COMPLETE ===');
}

main().catch(console.error);
