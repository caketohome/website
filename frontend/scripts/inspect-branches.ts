import { dbQuery, getDbPool } from "../src/lib/db";

async function main() {
  try {
    const sample = await dbQuery(`
      SELECT b.id, b.name, b.code, b.phone, b.email, b.address, b.city_id, b.is_open, b.deleted_at, b.metadata
      FROM "branch" b
      LIMIT 5
    `);
    console.log("Sample branches:", JSON.stringify(sample.rows, null, 2));

    const totalCount = await dbQuery(`SELECT count(*) FROM "branch"`);
    console.log("Total rows in branch:", totalCount.rows[0].count);

    const activeCount = await dbQuery(`SELECT count(*) FROM "branch" WHERE deleted_at IS NULL`);
    console.log("Active rows in branch (deleted_at IS NULL):", activeCount.rows[0].count);

    const archivedCount = await dbQuery(`SELECT count(*) FROM "branch" WHERE deleted_at IS NOT NULL`);
    console.log("Archived rows in branch (deleted_at IS NOT NULL):", archivedCount.rows[0].count);

    const cities = await dbQuery(`SELECT id, name, state FROM "city" LIMIT 5`);
    console.log("Cities sample:", cities.rows);

    const deliveryZones = await dbQuery(`
      SELECT id, pincode, branch_id, delivery_fee, is_serviceable, priority 
      FROM "delivery_zone" 
      LIMIT 5
    `);
    console.log("Delivery zones sample:", deliveryZones.rows);
  } catch (err) {
    console.error("Error inspecting branches:", err);
  } finally {
    const pool = getDbPool();
    await pool.end();
  }
}

main();
