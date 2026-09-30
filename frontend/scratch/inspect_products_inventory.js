const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'phase4e_forensic_data.json'), 'utf8'));

console.log("=== ROW COUNTS ===");
for (const [tbl, cnt] of Object.entries(data.rowCounts)) {
  if (cnt > 0 || ['purchase', 'purchase_item', 'purchase_payment', 'expense', 'fleet_fuel', 'accounting_voucher', 'accounting_journal_entry', 'accounting_journal_line'].includes(tbl)) {
    console.log(`${tbl}: ${cnt}`);
  }
}

console.log("\n=== ALL PRODUCTS (Total: " + data.allProducts.length + ") ===");
data.allProducts.forEach((p, idx) => {
  console.log(`${idx+1}. ID: ${p.id} | Title: "${p.title}" | Handle: ${p.handle} | IsGiftcard: ${p.is_giftcard} | Status: ${p.status}`);
});

console.log("\n=== BRANCH INVENTORY DETAILS ===");
console.log("Total inventory rows in DB:", data.rowCounts.branch_inventory);
console.log("Sample row:", JSON.stringify(data.branchInventorySample[0]));
