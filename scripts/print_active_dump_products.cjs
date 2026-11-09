const fs = require('fs');
const dump = JSON.parse(fs.readFileSync('scratch/product_master_dump.json', 'utf8'));
const active = dump.products.filter(p => !p.is_deleted);
console.log('--- 22 ACTIVE PRODUCTS IN MASTER DUMP ---');
active.forEach((p, i) => {
  console.log(`${i + 1}. [${p.id}] "${p.title}" | cat: ${p.category} (${p.category_slug}) | price: ${p.price} | hsn: ${p.hsn_code}`);
});

console.log('\n--- 45 DELETED PRODUCTS IN MASTER DUMP ---');
const deleted = dump.products.filter(p => p.is_deleted);
deleted.forEach((p, i) => {
  console.log(`${i + 1}. [${p.id}] "${p.title}" | deleted_at: ${p.deleted_at}`);
});
