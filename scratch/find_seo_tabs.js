const fs = require('fs');
const content = fs.readFileSync('frontend/src/components/dashboard/admin/seo-panel.tsx', 'utf8');
const lines = content.split('\n');

lines.forEach((line, i) => {
  if (line.includes('activeTab ===')) {
    console.log(`L${i+1}: ${line.trim()}`);
  }
});
