import { BranchRepository } from "../src/lib/repositories/branch.repository";
import { dbQuery, getDbPool } from "../src/lib/db";

async function verifySourceOfTruth() {
  console.log("==================================================");
  console.log("SOURCE OF TRUTH VERIFICATION: POSTGRESQL LIVE MUTATION TEST");
  console.log("==================================================");

  const probeId = `br_sot_probe_${Date.now()}`;
  const initialCode = `HUB-SOT-${Date.now().toString().slice(-4)}`;
  const initialName = `Original Hub Name ${Date.now()}`;

  try {
    // 1. Create probe hub directly in PostgreSQL
    console.log(`1. Inserting probe hub directly into PostgreSQL: ${probeId}`);
    await BranchRepository.save({
      id: probeId,
      code: initialCode,
      name: initialName,
      address: "100 Truth Lane",
      city: "Kollam",
      city_id: "city_klm",
      state: "Kerala",
      state_id: "state_kl",
      pincode: "691001",
      phone: "+91 91234 56789",
      manager_name: "Initial Manager",
      branch_type: "main_hub",
      extended_status: "open",
    });

    // 2. Search for initial name
    const initialFind = await BranchRepository.findWithFilters({ search: initialName });
    if (initialFind.branches.length !== 1 || initialFind.branches[0].id !== probeId) {
      throw new Error(`Initial hub lookup failed: expected 1 match, got ${initialFind.branches.length}`);
    }
    console.log("✅ Initial hub confirmed in PostgreSQL search results");

    // 3. Directly mutate PostgreSQL database record via raw SQL (bypassing any application caching)
    const mutatedName = `Mutated PostgreSQL Artisanal Hub ${Date.now()}`;
    const mutatedManager = `Live Mutated Manager ${Date.now().toString().slice(-4)}`;
    console.log(`2. Executing direct raw SQL UPDATE on PostgreSQL 'branch' table without server restart...`);
    await dbQuery(
      `
      UPDATE "branch" 
      SET 
        name = $1,
        metadata = jsonb_set(
          jsonb_set(metadata, '{manager_name}', to_jsonb($2::text)),
          '{formatted_address}',
          to_jsonb('999 Mutated Address Road'::text)
        ),
        updated_at = NOW()
      WHERE id = $3
      `,
      [mutatedName, mutatedManager, probeId]
    );

    // 4. Immediately query through BranchRepository without server restart
    console.log(`3. Querying search for mutated name: "${mutatedName}"`);
    const mutatedNameFind = await BranchRepository.findWithFilters({ search: mutatedName });
    if (mutatedNameFind.branches.length !== 1 || mutatedNameFind.branches[0].id !== probeId) {
      throw new Error(`Direct SQL mutation was not reflected in search! Got ${mutatedNameFind.branches.length} matches.`);
    }
    console.log(`✅ Mutated name immediately found: "${mutatedNameFind.branches[0].name}"`);

    // 5. Query search for mutated manager name
    console.log(`4. Querying search for mutated manager: "${mutatedManager}"`);
    const mutatedMgrFind = await BranchRepository.findWithFilters({ search: mutatedManager });
    if (mutatedMgrFind.branches.length !== 1 || mutatedMgrFind.branches[0].id !== probeId) {
      throw new Error(`Direct SQL manager mutation was not reflected in search! Got ${mutatedMgrFind.branches.length} matches.`);
    }
    console.log(`✅ Mutated manager immediately found: "${mutatedMgrFind.branches[0].manager_name}"`);

    // 6. Query search for mutated address
    console.log(`5. Querying search for mutated address: "999 Mutated Address Road"`);
    const mutatedAddrFind = await BranchRepository.findWithFilters({ search: "999 Mutated Address Road" });
    if (mutatedAddrFind.branches.length !== 1 || mutatedAddrFind.branches[0].id !== probeId) {
      throw new Error(`Direct SQL address mutation was not reflected in search! Got ${mutatedAddrFind.branches.length} matches.`);
    }
    console.log(`✅ Mutated address immediately found: "${mutatedAddrFind.branches[0].formatted_address}"`);

    // 7. Directly soft-delete in PostgreSQL and verify active vs archived status
    console.log(`6. Executing direct raw SQL soft-delete (archiving) in PostgreSQL...`);
    await dbQuery(`UPDATE "branch" SET deleted_at = NOW() WHERE id = $1`, [probeId]);

    const activeFind = await BranchRepository.findWithFilters({ search: mutatedName, lifecycle: "active" });
    const archivedFind = await BranchRepository.findWithFilters({ search: mutatedName, lifecycle: "archived" });
    const allFind = await BranchRepository.findWithFilters({ search: mutatedName, lifecycle: "all" });

    if (activeFind.branches.length !== 0) {
      throw new Error(`Archived hub incorrectly appeared in active search!`);
    }
    if (archivedFind.branches.length !== 1) {
      throw new Error(`Archived hub did not appear in archived search!`);
    }
    if (allFind.branches.length !== 1) {
      throw new Error(`Archived hub did not appear in 'all' search!`);
    }
    console.log("✅ Active / Archived / All status accurately reflects live PostgreSQL deleted_at state");

    console.log("==================================================");
    console.log("🎉 ALL POSTGRESQL SOURCE-OF-TRUTH TESTS PASSED (100%)");
    console.log("==================================================");

  } finally {
    // Clean up probe record
    console.log("Cleaning up probe record from PostgreSQL...");
    await dbQuery(`DELETE FROM "branch" WHERE id = $1`, [probeId]).catch(() => {});
    const pool = getDbPool();
    await pool.end();
  }
}

verifySourceOfTruth().catch(err => {
  console.error("FATAL SOT TEST ERROR:", err);
  process.exit(1);
});
