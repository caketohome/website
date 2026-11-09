const fs = require('fs');

const routeContent = fs.readFileSync('frontend/src/app/api/v1/[...path]/route.ts', 'utf8');
const lines = routeContent.split('\n');

const endpoints = [];
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (
    line.includes('admin/accounting') ||
    line.includes('admin/purchases') ||
    line.includes('admin/suppliers') ||
    line.includes('admin/bank') ||
    line.includes('admin/gateway') ||
    line.includes('admin/cost-allocation') ||
    line.includes('manager/cod') ||
    line.includes('admin/teller') ||
    line.includes('admin/customer-receipts') ||
    line.includes('admin/reports/ar')
  ) {
    endpoints.push({ lineNum: i + 1, content: line.trim() });
  }
}

console.log(`Found ${endpoints.length} matching lines.`);
for (const ep of endpoints.slice(0, 50)) {
  console.log(`L${ep.lineNum}: ${ep.content}`);
}
