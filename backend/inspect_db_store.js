const fs = require("fs");
const path = require("path");

const dbStorePath = path.join(__dirname, "../frontend/data/db-store.json");
console.log("Reading db-store.json from:", dbStorePath);

if (!fs.existsSync(dbStorePath)) {
  console.error("❌ db-store.json not found!");
  process.exit(1);
}

const raw = fs.readFileSync(dbStorePath, "utf-8");
const data = JSON.parse(raw);

console.log("=== DB-STORE.JSON TOP-LEVEL ENTITIES & RECORD COUNTS ===");
const inventory = {};
for (const [key, val] of Object.entries(data)) {
  if (Array.isArray(val)) {
    inventory[key] = { type: "array", count: val.length };
    console.log(` - ${key}: Array (${val.length} items)`);
  } else if (typeof val === "object" && val !== null) {
    inventory[key] = { type: "object", keys: Object.keys(val).length };
    console.log(` - ${key}: Object (${Object.keys(val).length} keys)`);
  } else {
    inventory[key] = { type: typeof val, val };
    console.log(` - ${key}: ${typeof val}`);
  }
}

fs.writeFileSync(path.join(__dirname, "../scratch/db-store-inventory.json"), JSON.stringify(inventory, null, 2));
console.log("\n✅ Inventory saved to scratch/db-store-inventory.json");
