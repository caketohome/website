const fs = require('fs');
const content = fs.readFileSync('frontend/src/lib/api-engine.ts', 'utf8');
const lines = content.split('\n');

lines.forEach((line, i) => {
  if (line.includes('getAdminSeoConfig') || line.includes('updateAdminSeoConfig')) {
    console.log(`L${i+1}: ${line.trim()}`);
  }
});
