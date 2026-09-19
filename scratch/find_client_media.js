const fs = require('fs');
const content = fs.readFileSync('frontend/src/lib/api-client.ts', 'utf8');
const lines = content.split('\n');

lines.forEach((line, i) => {
  if (line.includes('getAdminMedia') || line.includes('uploadMedia') || line.includes('admin/media')) {
    console.log(`L${i+1}: ${line.trim()}`);
  }
});
