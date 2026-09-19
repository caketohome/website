const fs = require('fs');
const content = fs.readFileSync('frontend/src/app/api/v1/[...path]/route.ts', 'utf8');
const lines = content.split('\n');

lines.forEach((line, i) => {
  if (line.includes('updateAdminSeoConfig') || line.includes('admin/marketing/seo') || line.includes('admin/seo/config')) {
    console.log(`L${i+1}: ${line.trim()}`);
  }
});
