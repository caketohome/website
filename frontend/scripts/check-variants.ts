import { dbQuery } from "../src/lib/db";

async function check() {
  const res = await dbQuery(`SELECT id, status, email, metadata FROM "order" LIMIT 5`);
  console.log("Order sample rows:", res.rows);
  process.exit(0);
}

check().catch((err) => {
  console.error(err);
  process.exit(1);
});
