const fs = require('fs');

const p = 'generate_phase5_7_deliverables.cjs';
if (fs.existsSync(p)) {
  const content = fs.readFileSync(p, 'utf8');
  console.log('Sample from ' + p + ':\n' + content.substring(0, 1000));
} else {
  console.log('File does not exist');
}

