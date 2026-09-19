const fs = require('fs');
const content = fs.readFileSync('frontend/src/lib/api-client.ts', 'utf8');
const lines = content.split('\n');

lines.forEach((line, i) => {
  if (line.includes('getSeo') || line.includes('getAdminSeo') || line.includes('syncSeoPages') || line.includes('createSeoRedirect')) {
    console.log(`L${i+1}: ${line.trim()}`);
  }
});
