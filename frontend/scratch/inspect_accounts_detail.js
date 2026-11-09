const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'forensic_c7_6_step3_data.json'), 'utf8'));

console.log("=== METADATA INSPECTION ===");
let metaCount = 0;
data.accounts.forEach(a => {
  if (a.metadata && Object.keys(a.metadata).length > 0) {
    metaCount++;
    console.log(`  ${a.code} ${a.name}: ${JSON.stringify(a.metadata)}`);
  }
});
console.log(`Accounts with non-empty metadata: ${metaCount}`);

console.log("\n=== GROUP VS LEAF COUNT ===");
const groups = data.accounts.filter(a => a.is_group);
const leaves = data.accounts.filter(a => !a.is_group);
console.log(`Total accounts: ${data.accounts.length}`);
console.log(`Groups (is_group=true, non-postable): ${groups.length}`);
console.log(`Leaves (is_group=false, postable): ${leaves.length}`);

console.log("\n=== SYSTEM VS NON-SYSTEM ===");
const systemAccs = data.accounts.filter(a => a.is_system);
console.log(`is_system=true: ${systemAccs.length}`);
console.log(`is_system=false: ${data.accounts.length - systemAccs.length}`);

console.log("\n=== ACTIVE VS INACTIVE / DELETED ===");
const inactiveAccs = data.accounts.filter(a => !a.is_active || a.deleted_at);
console.log(`Inactive or deleted: ${inactiveAccs.length}`);

console.log("\n=== LEVEL DISTRIBUTION ===");
const levelMap = {};
data.accounts.forEach(a => {
  levelMap[a.level] = (levelMap[a.level] || 0) + 1;
});
console.log(levelMap);
