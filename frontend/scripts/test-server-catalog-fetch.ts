import fs from "fs";
import path from "path";

// Load .env.local manually
const envPath = path.resolve(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf8");
  content.split("\n").forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const idx = trimmed.indexOf("=");
      if (idx !== -1) {
        const k = trimmed.substring(0, idx).trim();
        const v = trimmed.substring(idx + 1).trim();
        if (!process.env[k]) {
          process.env[k] = v;
        }
      }
    }
  });
}

import { dbQuery, closeDbPool } from "../src/lib/db";
import { listProducts, listPimCategories, listOccasions } from "../src/lib/data/catalog";

async function main() {
  const cols = await dbQuery("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'product'");
  console.log("Columns of 'product' table:");
  console.log(cols.rows.map(c => `${c.column_name} (${c.data_type})`).join(", "));

  const [products, categories, occasions] = await Promise.all([
    listProducts(),
    listPimCategories(),
    listOccasions(),
  ]);

  console.log(`Fetched products: ${products.length}`);
  console.log(`Fetched categories: ${categories.length}`);
  if (categories.length > 0) {
    console.log("Categories sample:", categories.slice(0, 3));
  }
  console.log(`Fetched occasions: ${occasions.length}`);
  await closeDbPool();
}

main().catch(err => {
  console.error("Fetch error:", err);
  process.exit(1);
});
