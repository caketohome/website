const fs = require('fs');
const content = fs.readFileSync('frontend/src/app/api/v1/[...path]/route.ts', 'utf8');
const lines = content.split('\n');

console.log('Total lines in route.ts:', lines.length);

lines.forEach((line, i) => {
  if (line.includes('admin/seo') || line.includes('ApiEngine.getSeo') || line.includes('ApiEngine.saveSeo') || line.includes('SeoRepository')) {
    console.log(`L${i+1}: ${line.trim()}`);
  }
});
