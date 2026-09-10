import { dbQuery } from "../src/lib/db";

async function seedBranchInventory() {
  console.log("=== Seeding Branch Inventory for PostgreSQL Authority ===");

  // 1. Fetch active branches
  const branchRes = await dbQuery(`SELECT id, name FROM "branch" WHERE deleted_at IS NULL`);
  const branches = branchRes.rows;
  console.log(`Found ${branches.length} active branches.`);

  // 2. Fetch active products
  const prodRes = await dbQuery(`SELECT id, title, metadata FROM "product" WHERE deleted_at IS NULL`);
  const products = prodRes.rows;
  console.log(`Found ${products.length} active products.`);

  // 3. Ensure each active product has at least one variant in product_variant
  for (const prod of products) {
    const varRes = await dbQuery(
      `SELECT id FROM "product_variant" WHERE product_id = $1 AND deleted_at IS NULL`,
      [prod.id]
    );
    if (varRes.rows.length === 0) {
      const defaultVarId = `variant_def_${prod.id.slice(-12)}`;
      console.log(`Product ${prod.id} (${prod.title}) has no variant. Inserting default variant ${defaultVarId}...`);
      await dbQuery(
        `INSERT INTO "product_variant" (id, product_id, title, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())
         ON CONFLICT (id) DO NOTHING`,
        [defaultVarId, prod.id, `${prod.title} - Standard`]
      );
    }
  }

  // 4. Fetch all active variants
  const allVariantsRes = await dbQuery(
    `SELECT v.id as variant_id, v.product_id, p.metadata
     FROM "product_variant" v
     JOIN "product" p ON v.product_id = p.id
     WHERE p.deleted_at IS NULL AND v.deleted_at IS NULL`
  );
  const variants = allVariantsRes.rows;
  console.log(`Found ${variants.length} active variants across active products.`);

  // 5. Seed branch_inventory for each branch + variant
  let inserted = 0;
  for (const branch of branches) {
    for (const v of variants) {
      const invId = `binv_${branch.id}_${v.variant_id}`.slice(0, 60);
      const initialQty = Number(v.metadata?.daily_capacity || 50);

      const res = await dbQuery(
        `INSERT INTO "branch_inventory" (id, product_id, variant_id, quantity, reserved, branch_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 0, $5, NOW(), NOW())
         ON CONFLICT (id) DO UPDATE SET
           product_id = EXCLUDED.product_id,
           quantity = EXCLUDED.quantity,
           deleted_at = NULL
         RETURNING id`,
        [invId, v.product_id, v.variant_id, initialQty, branch.id]
      );
      if (res.rows.length > 0) inserted++;
    }
  }

  console.log(`Successfully ensured ${inserted} branch_inventory records across ${branches.length} branches!`);

  // Verification count
  const countRes = await dbQuery(`SELECT COUNT(*)::int as count FROM "branch_inventory" WHERE deleted_at IS NULL`);
  console.log(`Total active branch_inventory records in PostgreSQL: ${countRes.rows[0].count}`);

  process.exit(0);
}

seedBranchInventory().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
