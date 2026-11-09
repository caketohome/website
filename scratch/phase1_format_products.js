const fs = require("fs");
const path = require("path");

const data = JSON.parse(fs.readFileSync(path.join(__dirname, "product_master_dump.json"), "utf8"));

const active = data.products.filter(p => !p.is_deleted);
const activeClassified = active.filter(p => p.hsn_code && p.hsn_code.trim() !== "");
const activeUnclassified = active.filter(p => !p.hsn_code || p.hsn_code.trim() === "");

console.log("=== 8 ACTIVE CLASSIFIED PRODUCTS ===");
for (const p of activeClassified) {
  console.log(`[${p.id}] "${p.title}"`);
  console.log(`  Category: ${p.category} (${p.category_slug})`);
  console.log(`  HSN: ${p.hsn_code} | HSN Desc: "${p.hsn_description}" | GST: ${p.gst_rate}% | Tax Class: ${p.tax_class} | UQC: ${p.uqc}`);
  console.log(`  Description: ${p.description}`);
  console.log(`  Flavour: ${p.flavour} | Brand: ${p.brand}`);
  console.log("");
}

console.log("=== 14 ACTIVE UNCLASSIFIED PRODUCTS ===");
for (const p of activeUnclassified) {
  console.log(`[${p.id}] "${p.title}"`);
  console.log(`  Handle: ${p.handle} | Status: ${p.status}`);
  console.log(`  Category: ${p.category} (${p.category_slug})`);
  console.log(`  HSN: ${p.hsn_code} | GST: ${p.gst_rate}% | Tax Class: ${p.tax_class} | UQC: ${p.uqc}`);
  console.log(`  Description: ${p.description}`);
  console.log(`  Flavour: ${p.flavour} | Cake Base: ${p.cake_base} | Filling: ${p.filling} | Cream: ${p.cream}`);
  console.log(`  Brand: ${p.brand} | Tags: ${p.tags}`);
  console.log(`  Price: ${p.price}`);
  console.log("");
}
