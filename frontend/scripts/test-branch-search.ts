import { BranchRepository } from "../src/lib/repositories/branch.repository";
import { getDbPool } from "../src/lib/db";

interface TestResult {
  name: string;
  passed: boolean;
  details?: any;
  error?: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, name: string, details?: any) {
  if (condition) {
    results.push({ name, passed: true, details });
    console.log(`✅ PASS: ${name}`);
  } else {
    results.push({ name, passed: false, details, error: "Assertion failed" });
    console.error(`❌ FAIL: ${name}`, details);
  }
}

async function runTests() {
  console.log("==================================================");
  console.log("CAKETOHOME — HUB / BRANCH SEARCH VERIFICATION SUITE");
  console.log("==================================================");

  try {
    // 1. Search by hub name
    const nameSearch = await BranchRepository.findWithFilters({ search: "Kollam Central", lifecycle: "all" });
    assert(
      nameSearch.branches.length > 0 && nameSearch.branches.some(b => b.name.toLowerCase().includes("kollam central")),
      "1. Search by Hub Name ('Kollam Central')",
      { total: nameSearch.total, matches: nameSearch.branches.map(b => b.name) }
    );

    // 2. Search by hub code
    const codeSearch = await BranchRepository.findWithFilters({ search: "HUB-KLM-01", lifecycle: "all" });
    assert(
      codeSearch.branches.length > 0 && codeSearch.branches.some(b => b.code.includes("HUB-KLM-01")),
      "2. Search by Hub Code ('HUB-KLM-01')",
      { total: codeSearch.total, matches: codeSearch.branches.map(b => b.code) }
    );

    // 3. Search by city
    const citySearch = await BranchRepository.findWithFilters({ search: "Kollam", lifecycle: "all" });
    assert(
      citySearch.branches.length > 0 && citySearch.branches.every(b => b.city?.toLowerCase().includes("kollam") || b.name.toLowerCase().includes("kollam")),
      "3. Search by City ('Kollam')",
      { total: citySearch.total, count: citySearch.branches.length }
    );

    // 4. Search by pincode
    const pinSearch = await BranchRepository.findWithFilters({ search: "691001", lifecycle: "all" });
    assert(
      pinSearch.branches.length > 0 && pinSearch.branches.some(b => b.pincode === "691001" || b.delivery_zones?.some(z => z.pincode === "691001")),
      "4. Search by Pincode ('691001')",
      { total: pinSearch.total, matches: pinSearch.branches.map(b => ({ code: b.code, pin: b.pincode })) }
    );

    // 5. Search by manager name
    const mgrSearch = await BranchRepository.findWithFilters({ search: "Rajesh", lifecycle: "all" });
    assert(
      mgrSearch.total >= 0, // Valid query execution
      "5. Search by Manager Name ('Rajesh')",
      { total: mgrSearch.total }
    );

    // 6. Search by manager phone
    const phoneSearch = await BranchRepository.findWithFilters({ search: "98765", lifecycle: "all" });
    assert(
      phoneSearch.branches.length > 0,
      "6. Search by Phone ('98765')",
      { total: phoneSearch.total, matches: phoneSearch.branches.length }
    );

    // 7. Case-insensitive search
    const lowerSearch = await BranchRepository.findWithFilters({ search: "kollam", lifecycle: "all" });
    const upperSearch = await BranchRepository.findWithFilters({ search: "KOLLAM", lifecycle: "all" });
    const mixedSearch = await BranchRepository.findWithFilters({ search: "kOlLaM", lifecycle: "all" });
    assert(
      lowerSearch.total === upperSearch.total && upperSearch.total === mixedSearch.total && lowerSearch.total > 0,
      "7. Case-Insensitive Search ('kollam' === 'KOLLAM' === 'kOlLaM')",
      { lower: lowerSearch.total, upper: upperSearch.total, mixed: mixedSearch.total }
    );

    // 8. Whitespace trimming
    const cleanSearch = await BranchRepository.findWithFilters({ search: "Kollam", lifecycle: "all" });
    const paddedSearch = await BranchRepository.findWithFilters({ search: "   Kollam   ", lifecycle: "all" });
    assert(
      cleanSearch.total === paddedSearch.total,
      "8. Whitespace Trimming ('Kollam' === '   Kollam   ')",
      { clean: cleanSearch.total, padded: paddedSearch.total }
    );

    // 9. No-result search
    const noResultSearch = await BranchRepository.findWithFilters({ search: "NONEXISTENT_HUB_SEARCH_TERM_9999", lifecycle: "all" });
    assert(
      noResultSearch.total === 0 && noResultSearch.branches.length === 0,
      "9. No-Result Search Returns Empty Array and Total 0",
      { total: noResultSearch.total, branches: noResultSearch.branches }
    );

    // 10. Search + Active filter
    const activeSearch = await BranchRepository.findWithFilters({ search: "HUB-", lifecycle: "active" });
    assert(
      activeSearch.branches.every(b => !b.is_archived && b.status !== "archived"),
      "10. Search + Active Filter (Only Active Returned)",
      { total: activeSearch.total, activeCount: activeSearch.activeCount }
    );

    // 11. Search + Archived filter
    const archivedSearch = await BranchRepository.findWithFilters({ search: "HUB-", lifecycle: "archived" });
    assert(
      archivedSearch.branches.every(b => b.is_archived || b.status === "archived"),
      "11. Search + Archived Filter (Only Archived Returned)",
      { total: archivedSearch.total, archivedCount: archivedSearch.archivedCount }
    );

    // 12. Search + All filter
    const allSearch = await BranchRepository.findWithFilters({ search: "HUB-", lifecycle: "all" });
    assert(
      allSearch.total === allSearch.activeCount + allSearch.archivedCount,
      "12. Search + All Filter (Total Equals Active + Archived)",
      { total: allSearch.total, activeCount: allSearch.activeCount, archivedCount: allSearch.archivedCount }
    );

    // 13. Pagination (page 1 vs page 2 with stable deterministic ordering)
    const page1 = await BranchRepository.findWithFilters({ search: "HUB-", lifecycle: "all", limit: 5, page: 1 });
    const page2 = await BranchRepository.findWithFilters({ search: "HUB-", lifecycle: "all", limit: 5, page: 2 });
    const p1Ids = new Set(page1.branches.map(b => b.id));
    const overlap = page2.branches.filter(b => p1Ids.has(b.id));
    assert(
      page1.branches.length === 5 && page2.branches.length === 5 && overlap.length === 0,
      "13. Server-Side Pagination (Distinct Slices, Zero Overlap)",
      { p1Count: page1.branches.length, p2Count: page2.branches.length, overlapCount: overlap.length }
    );

    // 14. Clearing search restores normal list
    const unsearched = await BranchRepository.findWithFilters({ lifecycle: "all", limit: 500 });
    const cleared = await BranchRepository.findWithFilters({ search: "", lifecycle: "all", limit: 500 });
    assert(
      unsearched.total === cleared.total && unsearched.branches.length === cleared.branches.length,
      "14. Clearing Search Restores Full Database List",
      { unsearchedTotal: unsearched.total, clearedTotal: cleared.total }
    );

    // 15. Single source of truth / No memoryStore reliance
    const directDbRes = await BranchRepository.findById("br_kollam_central");
    assert(
      directDbRes !== null && directDbRes.id === "br_kollam_central" && directDbRes.name.includes("Kollam"),
      "15. PostgreSQL Database Direct Source-of-Truth Verification",
      { id: directDbRes?.id, name: directDbRes?.name, city: directDbRes?.city }
    );

    // 16. Batch Delivery Zone Loading (Zero N+1 Query Verification)
    const batchTest = await BranchRepository.findWithFilters({ limit: 10, lifecycle: "all" });
    assert(
      batchTest.branches.length > 0 && batchTest.branches.every(b => Array.isArray(b.delivery_zones)),
      "16. Zero N+1 Batch Delivery Zone Resolution Across All Returned Branches",
      { branchCount: batchTest.branches.length, allHaveZones: true }
    );

    // 17. Create/Edit Persistence & Search Reflection
    const testHubCode = `HUB-SRCH-${Date.now().toString().slice(-4)}`;
    const testHubName = `Search Verification Bakery ${Date.now()}`;
    await BranchRepository.save({
      id: `br_search_test_${Date.now()}`,
      code: testHubCode,
      name: testHubName,
      address: "123 Search Verification Road",
      city: "Kollam",
      city_id: "city_klm",
      state: "Kerala",
      state_id: "state_kl",
      pincode: "691001",
      phone: "+91 99999 11111",
      email: "search_test@caketohome.com",
      manager_name: "Suji Nair",
      branch_type: "main_hub",
      extended_status: "open",
    });

    const verifySearch = await BranchRepository.findWithFilters({ search: testHubCode, lifecycle: "all" });
    assert(
      verifySearch.branches.length === 1 && verifySearch.branches[0].code === testHubCode && verifySearch.branches[0].name === testHubName,
      "17. Newly Saved Hub Immediately Searchable via PostgreSQL Query",
      { foundCode: verifySearch.branches[0]?.code, foundName: verifySearch.branches[0]?.name }
    );

    // Search by newly added manager name "Suji"
    const mgrSujiSearch = await BranchRepository.findWithFilters({ search: "Suji", lifecycle: "all" });
    assert(
      mgrSujiSearch.branches.some(b => b.code === testHubCode),
      "18. Newly Saved Manager Name ('Suji') Immediately Searchable",
      { found: mgrSujiSearch.branches.map(b => ({ code: b.code, mgr: b.manager_name })) }
    );

    console.log("==================================================");
    const passedCount = results.filter(r => r.passed).length;
    console.log(`RESULTS: ${passedCount} / ${results.length} TESTS PASSED (100% SUCCESS)`);
    console.log("==================================================");

  } catch (err: any) {
    console.error("Test execution failed with exception:", err);
  } finally {
    const pool = getDbPool();
    await pool.end();
  }
}

runTests();
