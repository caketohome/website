const fs = require('fs');

const content = fs.readFileSync('frontend/src/app/api/v1/[...path]/route.ts', 'utf8');
const lines = content.split('\n');

function extractRoutes(startLine, endLine, method) {
  const routes = [];
  for (let i = startLine - 1; i < endLine; i++) {
    const line = lines[i];
    // Look for path matching patterns like path === "..." or path.startsWith("...")
    const matchEqual = line.match(/path\s*===?\s*["']([^"']+)["']/);
    const matchStarts = line.match(/path\.startsWith\(["']([^"']+)["']\)/);
    const matchSubPath = line.match(/acctSubPath\s*===?\s*["']([^"']+)["']/);
    const matchSubStarts = line.match(/acctSubPath\.startsWith\(["']([^"']+)["']\)/);
    const matchBrsSub = line.match(/brsSubPath\s*===?\s*["']([^"']+)["']/);
    const matchGwSub = line.match(/gwSubPath\s*===?\s*["']([^"']+)["']/);

    let found = null;
    let type = 'exact';
    if (matchEqual) {
      found = matchEqual[1];
    } else if (matchStarts) {
      found = matchStarts[1] + '*';
      type = 'prefix';
    } else if (matchSubPath) {
      found = 'admin/accounting/' + matchSubPath[1];
    } else if (matchSubStarts) {
      found = 'admin/accounting/' + matchSubStarts[1] + '*';
      type = 'prefix';
    } else if (matchBrsSub) {
      found = 'admin/bank-reconciliation/' + matchBrsSub[1];
    } else if (matchGwSub) {
      found = 'admin/gateway-settlements/' + matchGwSub[1];
    }

    if (found) {
      // Check if it belongs to accounting domains
      if (
        found.includes('accounting') ||
        found.includes('purchases') ||
        found.includes('suppliers') ||
        found.includes('bank') ||
        found.includes('teller') ||
        found.includes('cod') ||
        found.includes('gateway') ||
        found.includes('cost-allocation') ||
        found.includes('customer-receipts') ||
        found.includes('reports/ar') ||
        found.includes('reports/ap') ||
        found.includes('reports/general-ledger') ||
        found.includes('reports/trial-balance') ||
        found.includes('reports/profit-loss') ||
        found.includes('reports/balance-sheet') ||
        found.includes('reports/cash-flow')
      ) {
        routes.push({
          method,
          path: found,
          line: i + 1,
          type
        });
      }
    }
  }
  return routes;
}

const getRoutes = extractRoutes(894, 6115, 'GET');
const postRoutes = extractRoutes(6115, 10610, 'POST');
const putRoutes = extractRoutes(10610, 11381, 'PUT');
const deleteRoutes = extractRoutes(11381, 11841, 'DELETE');
const patchRoutes = extractRoutes(11841, lines.length, 'PATCH');

console.log(`=== EXTRACTED ACCOUNTING ROUTES ===`);
console.log(`GET: ${getRoutes.length}`);
console.log(`POST: ${postRoutes.length}`);
console.log(`PUT: ${putRoutes.length}`);
console.log(`DELETE: ${deleteRoutes.length}`);
console.log(`PATCH: ${patchRoutes.length}`);

const all = [...getRoutes, ...postRoutes, ...putRoutes, ...deleteRoutes, ...patchRoutes];
fs.writeFileSync('scratch/all_discovered_accounting_routes.json', JSON.stringify(all, null, 2));
console.log(`Total discovered accounting routes: ${all.length}`);
for (const r of all) {
  console.log(`[${r.method}] L${r.line}: /api/v1/${r.path}`);
}
