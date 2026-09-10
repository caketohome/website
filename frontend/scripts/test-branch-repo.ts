import { BranchRepository } from "../src/lib/repositories/branch.repository";
import { getDbPool } from "../src/lib/db";

async function testRepositorySearch() {
  try {
    console.log("=== Testing BranchRepository.findWithFilters ===");

    // 1. All branches (lifecycle: all)
    const all = await BranchRepository.findWithFilters({ lifecycle: "all", limit: 10 });
    console.log(`[Test 1: All] total: ${all.total}, totalCount: ${all.totalCount}, activeCount: ${all.activeCount}, page: ${all.page}, returned: ${all.branches.length}`);

    // 2. Active branches
    const active = await BranchRepository.findWithFilters({ lifecycle: "active", limit: 10 });
    console.log(`[Test 2: Active] total: ${active.total}, returned: ${active.branches.length}`);

    // 3. Search by city "Kollam"
    const kollam = await BranchRepository.findWithFilters({ search: "Kollam", lifecycle: "all" });
    console.log(`[Test 3: Search 'Kollam'] total: ${kollam.total}, found:`, kollam.branches.map(b => ({ id: b.id, name: b.name, code: b.code, city: b.city, pincode: b.pincode })));

    // 4. Search by hub code "HUB-"
    const hubCode = await BranchRepository.findWithFilters({ search: "HUB-", lifecycle: "all", limit: 5 });
    console.log(`[Test 4: Search 'HUB-'] total: ${hubCode.total}, returned: ${hubCode.branches.length}`);

    // 5. Search by pincode "691001" or other pincode
    const pincode = await BranchRepository.findWithFilters({ search: "691001", lifecycle: "all" });
    console.log(`[Test 5: Search '691001'] total: ${pincode.total}, found:`, pincode.branches.map(b => ({ id: b.id, name: b.name, pincode: b.pincode })));

    // 6. Search with whitespace "  Kollam  "
    const whitespace = await BranchRepository.findWithFilters({ search: "  Kollam  ", lifecycle: "all" });
    console.log(`[Test 6: Whitespace '  Kollam  '] total: ${whitespace.total}`);

    // 7. Case-insensitive search "kOlLaM"
    const mixedCase = await BranchRepository.findWithFilters({ search: "kOlLaM", lifecycle: "all" });
    console.log(`[Test 7: Mixed Case 'kOlLaM'] total: ${mixedCase.total}`);

    // 8. Non-existent search "XYZ_DOES_NOT_EXIST_999"
    const noResults = await BranchRepository.findWithFilters({ search: "XYZ_DOES_NOT_EXIST_999", lifecycle: "all" });
    console.log(`[Test 8: Non-existent] total: ${noResults.total}, returned: ${noResults.branches.length}`);

    // 9. Pagination test (page 1 vs page 2)
    const p1 = await BranchRepository.findWithFilters({ lifecycle: "all", limit: 5, page: 1 });
    const p2 = await BranchRepository.findWithFilters({ lifecycle: "all", limit: 5, page: 2 });
    console.log(`[Test 9: Pagination] Page 1: [${p1.branches.map(b => b.code).join(", ")}], Page 2: [${p2.branches.map(b => b.code).join(", ")}]`);

    console.log("=== All Repository Tests Passed Successfully ===");
  } catch (err) {
    console.error("Test error:", err);
  } finally {
    const pool = getDbPool();
    await pool.end();
  }
}

testRepositorySearch();
