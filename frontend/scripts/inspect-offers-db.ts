import { getDbPool } from "../src/lib/db";
import { OfferRepository } from "../src/lib/repositories/offer.repository";

async function main() {
  const pool = getDbPool();
  console.log("=== CHECKING OFFERS IN POSTGRESQL ===");
  const offers = await pool.query(`SELECT id, code, name, type, status, is_public, metadata FROM offer WHERE deleted_at IS NULL AND status = 'active' LIMIT 10`);
  console.log("Active public offers in DB count:", offers.rows.length);
  offers.rows.forEach(o => {
    console.log(`  [${o.id}] Code: "${o.code}" | Name: "${o.name}" | Type: ${o.type} | Public: ${o.is_public}`);
  });

  console.log("\n=== CHECKING OfferRepository ===");
  const repoOffers = await OfferRepository.findAll();
  console.log("OfferRepository.findAll count:", repoOffers.length);
  if (repoOffers.length > 0) {
    console.log("Sample repo offer:", {
      id: repoOffers[0].id,
      code: repoOffers[0].code,
      name: repoOffers[0].name,
      status: repoOffers[0].status,
    });
  }

  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
