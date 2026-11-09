const fs = require('fs');
const path = require('path');

const dump = JSON.parse(fs.readFileSync(path.join(__dirname, 'forensic_dump.json'), 'utf8'));

console.log("=== BRANCH INVENTORY ===");
const testBranches = [];
const operationalBranches = [];

dump.branches.forEach(b => {
  if (b.id.startsWith('br_tc_') || b.id.startsWith('br_conc_') || b.id.startsWith('br_test_')) {
    testBranches.push(b);
  } else {
    operationalBranches.push(b);
  }
});

console.log(`Operational branches count: ${operationalBranches.length}`);
console.log(`Test branches count: ${testBranches.length}`);
console.log(`Total: ${dump.branches.length}`);

// Operational branches:
operationalBranches.forEach((b, idx) => {
  console.log(`${idx+1}. ID: ${b.id} | Name: ${b.name} | Code: ${b.code} | Open: ${b.is_open}`);
});
