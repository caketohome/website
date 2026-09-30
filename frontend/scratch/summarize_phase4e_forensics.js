const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'phase4e_forensic_data.json'), 'utf8'));

console.log("=== 1. ROW COUNTS ===");
console.log(JSON.stringify(data.rowCounts, null, 2));

console.log("\n=== 2. SETTINGS ===");
console.log(JSON.stringify(data.allSettings, null, 2));

console.log("\n=== 3. PRODUCT COLUMNS ===");
console.log(JSON.stringify(data.columnsByTable.product, null, 2));

console.log("\n=== 4. ALL PRODUCTS (Count: " + data.allProducts.length + ") ===");
data.allProducts.forEach(p => {
  console.log(`- ID: ${p.id} | Title: "${p.title || p.name}" | Handle: ${p.handle} | Type/Category: ${p.type_id || p.category_id || p.category || p.type} | Metadata: ${JSON.stringify(p.metadata || {})}`);
});

console.log("\n=== 5. BRANCH INVENTORY SAMPLE & COLUMNS ===");
console.log("Columns:", JSON.stringify(data.columnsByTable.branch_inventory, null, 2));
console.log("Sample:", JSON.stringify(data.branchInventorySample, null, 2));

console.log("\n=== 6. PURCHASE & PURCHASE_ITEM COLUMNS ===");
console.log("purchase cols:", JSON.stringify(data.columnsByTable.purchase, null, 2));
console.log("purchase_item cols:", JSON.stringify(data.columnsByTable.purchase_item, null, 2));
console.log("purchase_payment cols:", JSON.stringify(data.columnsByTable.purchase_payment, null, 2));

console.log("\n=== 7. ORDER COLUMNS & SAMPLE ===");
console.log("order cols:", JSON.stringify(data.columnsByTable.order, null, 2));
console.log("order sample:", JSON.stringify(data.orderSample, null, 2));

console.log("\n=== 8. PAYMENT TRANSACTION COLUMNS & SAMPLE ===");
console.log("pt cols:", JSON.stringify(data.columnsByTable.payment_transaction, null, 2));
console.log("pt sample:", JSON.stringify(data.paymentTransactionSample, null, 2));

console.log("\n=== 9. EXPENSE CATEGORIES ===");
console.log(JSON.stringify(data.expenseCategories, null, 2));
