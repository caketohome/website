/**
 * Phase C.2 — Admin Tab Rendering Audit (Fixed)
 * Tests all 22 admin dashboard tabs for proper rendering.
 * Fixed: stricter 500 error detection to avoid false positives from CSS/data values.
 */
const TABS = [
  'orders', 'catalog', 'search_engine', 'branches', 'delivery',
  'fulfillment', 'tax_master', 'abandoned_carts', 'telemarketing',
  'crm', 'login_activity', 'marketing', 'popups', 'seo',
  'automation', 'webhooks', 'cms', 'analytics', 'ai_concierge',
  'staff_profiles', 'notifications', 'settings'
];

const BASE = 'http://localhost:3000/dashboard';
const COOKIES = '_cth_role=SUPER_ADMIN; _cth_user_id=admin_01';

async function testTab(tab) {
  const url = `${BASE}?tab=${tab}`;
  const start = Date.now();
  try {
    const res = await fetch(url, {
      headers: { 'Cookie': COOKIES },
      redirect: 'follow'
    });
    const elapsed = Date.now() - start;
    const html = await res.text();
    
    // Stricter error checks — look for actual error page markers, not just "500"
    const hasError500 = /Internal Server Error/i.test(html) || /<h1[^>]*>500<\/h1>/i.test(html);
    const hasModuleError = /Module not found|Cannot find module/i.test(html);
    const hasChunkError = /ChunkLoadError|Loading chunk.*failed/i.test(html);
    const hasRuntimeError = /Unhandled Runtime Error|Application error: a (client|server)-side exception/i.test(html);
    const hasDashboardHeading = /Bakery Management|Operations Control/i.test(html);
    const htmlLength = html.length;
    const hasContent = htmlLength > 5000;
    
    // Check for Next.js error overlay
    const hasNextError = /nextjs-portal|__next-error/i.test(html);
    
    const issues = [];
    if (hasError500) issues.push('500_ERROR');
    if (hasModuleError) issues.push('MODULE_NOT_FOUND');
    if (hasChunkError) issues.push('CHUNK_LOAD_ERROR');
    if (hasRuntimeError) issues.push('RUNTIME_ERROR');
    if (hasNextError) issues.push('NEXT_ERROR_OVERLAY');
    if (!hasDashboardHeading) issues.push('MISSING_DASHBOARD_HEADING');
    if (!hasContent) issues.push('EMPTY_PAGE');
    
    return {
      tab,
      status: res.status,
      elapsed,
      htmlLength,
      hasDashboardHeading,
      issues: issues.length > 0 ? issues : ['NONE'],
      verdict: res.status === 200 && issues.length === 0 ? 'PASS' : (res.status !== 200 ? 'FAIL' : 'CHECK')
    };
  } catch (err) {
    return {
      tab, status: 'ERROR', elapsed: Date.now() - start, htmlLength: 0,
      hasDashboardHeading: false, issues: [err.message], verdict: 'FAIL'
    };
  }
}

async function main() {
  console.log('=== PHASE C.2: Admin Tab Rendering Audit (Fixed) ===');
  console.log(`Testing ${TABS.length} tabs against ${BASE}\n`);
  
  const results = [];
  for (const tab of TABS) {
    const result = await testTab(tab);
    const icon = result.verdict === 'PASS' ? '✓' : result.verdict === 'CHECK' ? '⚠' : '✗';
    console.log(`${icon} ${tab.padEnd(20)} | HTTP ${String(result.status).padEnd(4)} | ${String(result.elapsed).padStart(5)}ms | ${result.htmlLength} bytes | ${result.issues.join(', ')}`);
    results.push(result);
  }
  
  console.log('\n=== SUMMARY ===');
  const passed = results.filter(r => r.verdict === 'PASS').length;
  const checks = results.filter(r => r.verdict === 'CHECK').length;
  const failed = results.filter(r => r.verdict === 'FAIL').length;
  console.log(`PASS: ${passed}/${TABS.length}  |  CHECK: ${checks}/${TABS.length}  |  FAIL: ${failed}/${TABS.length}`);
  
  if (checks > 0 || failed > 0) {
    console.log('\nIssues:');
    results.filter(r => r.verdict !== 'PASS').forEach(r => {
      console.log(`  ${r.tab}: ${r.issues.join(', ')}`);
    });
  }
  
  require('fs').writeFileSync(
    require('path').join(__dirname, 'admin_tab_audit_results.json'),
    JSON.stringify({ timestamp: new Date().toISOString(), results }, null, 2)
  );
  console.log('\nResults saved to scratch/admin_tab_audit_results.json');
}

main().catch(console.error);
