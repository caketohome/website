const fs = require('fs');
const path = require('path');

const APP_DIR = path.join(__dirname, '../frontend/src/app');
const COMPONENTS_DIR = path.join(__dirname, '../frontend/src/components');

function walk(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walk(fullPath, fileList);
    } else {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

// 1. Discover all Next.js App Router Page & API routes
const allAppFiles = walk(APP_DIR);
const pageRoutes = [];
const apiRoutes = [];

for (const f of allAppFiles) {
  const rel = path.relative(APP_DIR, f).replace(/\\/g, '/');
  if (rel.endsWith('/page.tsx') || rel.endsWith('/page.ts') || rel.endsWith('/page.jsx') || rel.endsWith('/page.js')) {
    let route = '/' + rel.replace(/\/page\.[a-z]+$/, '');
    // remove route groups like (store), (checkout)
    route = route.replace(/\/\([^)]+\)/g, '');
    if (route === '') route = '/';
    pageRoutes.push({ file: rel, route });
  } else if (rel.endsWith('/route.ts') || rel.endsWith('/route.js')) {
    let route = '/' + rel.replace(/\/route\.[a-z]+$/, '');
    route = route.replace(/\/\([^)]+\)/g, '');
    apiRoutes.push({ file: rel, route });
  }
}

// 2. Discover all href attributes in JSX/TSX
const allCompFiles = [...walk(COMPONENTS_DIR), ...allAppFiles.filter(f => !f.endsWith('.css') && !f.endsWith('.ico'))];
const hrefsFound = new Set();
const hrefSources = {};

const hrefRegex = /href=["']([^"']+)["']/g;
const linkToRegex = /to=["']([^"']+)["']/g;

for (const f of allCompFiles) {
  if (!f.endsWith('.tsx') && !f.endsWith('.ts') && !f.endsWith('.jsx') && !f.endsWith('.js')) continue;
  const content = fs.readFileSync(f, 'utf8');
  let match;
  while ((match = hrefRegex.exec(content)) !== null) {
    const target = match[1];
    hrefsFound.add(target);
    if (!hrefSources[target]) hrefSources[target] = [];
    hrefSources[target].push(path.relative(path.join(__dirname, '..'), f).replace(/\\/g, '/'));
  }
  while ((match = linkToRegex.exec(content)) !== null) {
    const target = match[1];
    hrefsFound.add(target);
    if (!hrefSources[target]) hrefSources[target] = [];
    hrefSources[target].push(path.relative(path.join(__dirname, '..'), f).replace(/\\/g, '/'));
  }
}

console.log('=== APP ROUTER PAGE ROUTES DISCOVERED ===');
console.log(`Total Pages: ${pageRoutes.length}`);
pageRoutes.forEach(p => console.log(`  ${p.route.padEnd(35)} -> ${p.file}`));

console.log('\n=== APP ROUTER API ROUTES DISCOVERED ===');
console.log(`Total API Routes: ${apiRoutes.length}`);
apiRoutes.forEach(a => console.log(`  ${a.route.padEnd(35)} -> ${a.file}`));

console.log('\n=== UNIQUE HREF TARGETS DISCOVERED ===');
const internalHrefs = Array.from(hrefsFound).filter(h => h.startsWith('/') && !h.startsWith('//'));
console.log(`Total Internal Hrefs: ${internalHrefs.length}`);

// Match hrefs against pages
const unmatchedHrefs = [];
for (const h of internalHrefs) {
  const cleanPath = h.split('?')[0].split('#')[0];
  // check if matches any pageRoute pattern
  const matched = pageRoutes.some(p => {
    if (p.route === cleanPath) return true;
    // dynamic segment match e.g. /product/[slug] vs /product/chocolate-truffle-cake
    const pParts = p.route.split('/').filter(Boolean);
    const hParts = cleanPath.split('/').filter(Boolean);
    if (pParts.length !== hParts.length) return false;
    return pParts.every((part, idx) => {
      if (part.startsWith('[') && part.endsWith(']')) return true;
      return part === hParts[idx];
    });
  });
  if (!matched) {
    unmatchedHrefs.push({ href: h, sources: hrefSources[h] });
  }
}

console.log('\n=== POTENTIAL 404 UNMATCHED HREF TARGETS ===');
console.log(`Count: ${unmatchedHrefs.length}`);
unmatchedHrefs.forEach(u => {
  console.log(`  BROKEN LINK: ${u.href}`);
  console.log(`    Found in: ${u.sources.slice(0, 3).join(', ')}`);
});

fs.writeFileSync(
  path.join(__dirname, 'discovered_routes_inventory.json'),
  JSON.stringify({ pageRoutes, apiRoutes, internalHrefs, unmatchedHrefs }, null, 2)
);
console.log('\nSaved inventory to scratch/discovered_routes_inventory.json');
