const fs = require('fs');
const content = fs.readFileSync('frontend/src/app/api/v1/[...path]/route.ts', 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('GstReportingService') || line.includes('gst-reporting') || line.includes('reports/gst')) {
    console.log(`Line ${idx + 1}: ${line.trim()}`);
  }
});
