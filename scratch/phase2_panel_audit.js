// Phase 2 — Rapid panel data source audit
// Check if each admin panel fetches from apiClient/fetch or uses hardcoded data

const fs = require('fs');
const path = require('path');

const adminDir = path.join(__dirname, '..', 'frontend', 'src', 'components', 'dashboard', 'admin');

const panels = [
  'orders-panel.tsx',
  'catalog-panel.tsx',
  'branches-panel.tsx',
  'delivery-panel.tsx',
  'tax-master-panel.tsx',
  'abandoned-cart-panel.tsx',
  'telemarketing-panel.tsx',
  'crm-panel.tsx',
  'login-activity-panel.tsx',
  'marketing-panel.tsx',
  'popups-panel.tsx',
  'seo-panel.tsx',
  'marketing-automation-panel.tsx',
  'webhooks-panel.tsx',
  'cms-panel.tsx',
  'analytics-panel.tsx',
  'ai-concierge-panel.tsx',
  'staff-profiles-panel.tsx',
  'notifications-panel.tsx',
  'settings-panel.tsx',
  'fulfillment-config-panel.tsx',
  'search-config-panel.tsx',
];

const results = [];

for (const panel of panels) {
  const filePath = path.join(adminDir, panel);
  if (!fs.existsSync(filePath)) {
    results.push({ panel, exists: false });
    continue;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const size = content.length;
  const lines = content.split('\n').length;

  // Data source indicators
  const usesApiClient = content.includes('apiClient');
  const usesFetch = content.includes('fetch(') || content.includes('fetch(`');
  const usesUseEffect = content.includes('useEffect');
  const usesAsync = content.includes('async ');

  // Red flags — hardcoded data
  const hasHardcodedArray = (content.match(/const\s+\w+\s*=\s*\[[\s\S]{100,}?\]/g) || []).length;
  const hasHardcodedObj = (content.match(/const\s+\w+\s*=\s*\{[\s\S]{200,}?\}/g) || []).length;

  // API patterns
  const apiCalls = (content.match(/apiClient\.\w+/g) || []);
  const fetchCalls = (content.match(/fetch\(['"``]/g) || []);

  // Error/loading states
  const hasLoading = content.includes('loading') || content.includes('Loading') || content.includes('Skeleton');
  const hasError = content.includes('error') || content.includes('Error');
  const hasEmpty = content.includes('empty') || content.includes('Empty') || content.includes('No ') || content.includes('no ');

  // Mutations
  const hasSave = content.includes('save') || content.includes('Save') || content.includes('update') || content.includes('Update');
  const hasCreate = content.includes('create') || content.includes('Create') || content.includes('Add') || content.includes('add');
  const hasDelete = content.includes('delete') || content.includes('Delete') || content.includes('Remove') || content.includes('remove');

  results.push({
    panel: panel.replace('.tsx', ''),
    size: `${Math.round(size / 1024)}KB`,
    lines,
    usesApiClient,
    usesFetch,
    apiCalls: [...new Set(apiCalls)].slice(0, 5),
    hasLoading,
    hasError,
    hasEmpty,
    hasSave,
    hasCreate,
    hasDelete,
    dataSource: usesApiClient ? 'apiClient → PostgreSQL' : usesFetch ? 'fetch → API' : usesUseEffect ? 'useEffect (check manually)' : 'STATIC/UNKNOWN',
  });
}

// Print as table
console.log('=== ADMIN PANEL DATA SOURCE AUDIT ===\n');
console.log('Panel'.padEnd(30), 'Size'.padEnd(7), 'Data Source'.padEnd(28), 'Loading'.padEnd(9), 'Error'.padEnd(7), 'Save'.padEnd(6), 'Create'.padEnd(8), 'Key API Calls');
console.log('-'.repeat(140));

for (const r of results) {
  if (!r.exists && r.exists === false) {
    console.log(r.panel.padEnd(30), 'MISSING');
    continue;
  }
  console.log(
    r.panel.padEnd(30),
    r.size.padEnd(7),
    r.dataSource.padEnd(28),
    (r.hasLoading ? '✓' : '✗').padEnd(9),
    (r.hasError ? '✓' : '✗').padEnd(7),
    (r.hasSave ? '✓' : '✗').padEnd(6),
    (r.hasCreate ? '✓' : '✗').padEnd(8),
    (r.apiCalls || []).join(', ')
  );
}
