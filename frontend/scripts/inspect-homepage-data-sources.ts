import fs from "fs";
import { getDbPool } from "../src/lib/db";
import { ProductRepository } from "../src/lib/repositories/product.repository";
import { CmsRepository } from "../src/lib/repositories/cms.repository";
import { BranchRepository } from "../src/lib/repositories/branch.repository";
import { OfferRepository } from "../src/lib/repositories/offer.repository";

async function main() {
  console.log("=== CHECKING POSTGRESQL TABLES ===");
  const pool = getDbPool();
  const tables = await pool.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name ASC`
  );
  console.log("Public tables:", tables.rows.map(r => r.table_name));

  // Check product count & sample
  const prodCount = await pool.query(`SELECT COUNT(*) FROM product WHERE deleted_at IS NULL`);
  console.log("Product count in DB:", prodCount.rows[0].count);

  // Check CMS page count & sample
  const cmsCount = await pool.query(`SELECT COUNT(*) FROM cms_page WHERE deleted_at IS NULL`);
  console.log("CMS page count in DB:", cmsCount.rows[0].count);

  // Check offer count & sample
  const offerCount = await pool.query(`SELECT COUNT(*) FROM offer WHERE deleted_at IS NULL`);
  console.log("Offer count in DB:", offerCount.rows[0].count);

  // Check branch count & sample
  const branchCount = await pool.query(`SELECT COUNT(*) FROM branch WHERE deleted_at IS NULL`);
  console.log("Branch count in DB:", branchCount.rows[0].count);

  // Check branch_inventory count
  const invCount = await pool.query(`SELECT COUNT(*) FROM branch_inventory`);
  console.log("Branch inventory rows in DB:", invCount.rows[0].count);

  // Search [...path]/route.ts for product routing
  const routeContent = fs.readFileSync("src/app/api/v1/[...path]/route.ts", "utf8");
  const lines = routeContent.split("\n");
  console.log("\n=== SEARCHING [...path]/route.ts FOR 'products' ROUTING ===");
  lines.forEach((line, idx) => {
    if (line.includes('"products"') || line.includes("'products'") || line.includes("path === \"store/products\"")) {
      console.log(`L${idx + 1}: ${line.trim()}`);
    }
  });

  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
