const fs = require('fs');
const path = require('path');

// Read scratch/test_all_live_routes.js
const testRoutesContent = fs.readFileSync(path.join(__dirname, 'test_all_live_routes.js'), 'utf8');

// Also load live_routes_audit_results.json if it exists
let auditResults = [];
try {
  auditResults = JSON.parse(fs.readFileSync(path.join(__dirname, 'live_routes_audit_results.json'), 'utf8'));
} catch (e) {}

console.log('--- AUDIT RESULTS IN JSON ---');
console.log('Total entries in live_routes_audit_results.json:', auditResults.length);

const uniquePathsInAudit = new Set(auditResults.map(r => r.path));
console.log('Unique path strings in live_routes_audit_results.json:', uniquePathsInAudit.size);

const uniquePathPlusAuth = new Set(auditResults.map(r => `${r.auth}:${r.path}`));
console.log('Unique (auth + path) combinations:', uniquePathPlusAuth.size);

// Analyze duplicate paths
const pathCounts = {};
auditResults.forEach(r => {
  pathCounts[r.path] = (pathCounts[r.path] || 0) + 1;
});
const duplicates = Object.entries(pathCounts).filter(([p, count]) => count > 1);
console.log('\nDuplicates in test list (path tested multiple times under different roles/labels):');
duplicates.forEach(([p, count]) => {
  const matches = auditResults.filter(r => r.path === p);
  console.log(`  Path: "${p}" x ${count}:`);
  matches.forEach(m => console.log(`     - Role: ${m.auth}, Label: "${m.label}"`));
});

// Now let's discover ALL real App Router routes in frontend/src/app
function walkDir(dir, baseDir = dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walkDir(fullPath, baseDir));
    } else {
      results.push(path.relative(baseDir, fullPath));
    }
  }
  return results;
}

const appFiles = walkDir(path.join(__dirname, '../frontend/src/app'));
const pageFiles = appFiles.filter(f => f.endsWith('page.tsx') || f.endsWith('page.ts') || f.endsWith('page.jsx') || f.endsWith('page.js'));
const routeFiles = appFiles.filter(f => f.endsWith('route.ts') || f.endsWith('route.js'));

console.log('\n--- PHYSICAL NEXT.JS APP ROUTER FILES ---');
console.log('Total page files:', pageFiles.length);
console.log('Total route (API) files:', routeFiles.length);

console.log('\nPage files found:');
pageFiles.forEach(f => console.log('  ', f));

console.log('\n--- ADMIN SIDEBAR TABS ---');
const sidebarContent = fs.readFileSync(path.join(__dirname, '../frontend/src/components/admin/AdminSidebar.tsx'), 'utf8');
const tabMatches = [...sidebarContent.matchAll(/tabId:\s*["']([^"']+)["']/g)].map(m => m[1]);
console.log('Total tabId occurrences in AdminSidebar:', tabMatches.length);
const uniqueSidebarTabs = [...new Set(tabMatches)];
console.log('Unique tabIds in AdminSidebar:', uniqueSidebarTabs.length);
console.log('Unique tabIds:', uniqueSidebarTabs);

const hrefMatches = [...sidebarContent.matchAll(/href:\s*["']([^"']+)["']/g)].map(m => m[1]);
console.log('Href links in AdminSidebar:', hrefMatches);

