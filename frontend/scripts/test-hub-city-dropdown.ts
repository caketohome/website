import { CityRepository, CANONICAL_STATES } from "../src/lib/repositories/city.repository";
import { BranchRepository } from "../src/lib/repositories/branch.repository";
import { dbQuery, closeDbPool } from "../src/lib/db";

const safetyTimeout = setTimeout(() => {
  console.error("[SAFETY_TIMEOUT] test-hub-city-dropdown timed out after 60s");
  process.exit(1);
}, 60000);
safetyTimeout.unref();

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passCount++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failCount++;
  }
}

async function run() {
  console.log("================================================================================");
  console.log("CAKETOHOME — HUB CONFIGURATION STATE → CITY DROPDOWN VERIFICATION SUITE");
  console.log("================================================================================");

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Canonical State Master List
    // -------------------------------------------------------------------------
    console.log("\n[TEST 1] Canonical State Master List");
    const states = CityRepository.listStates();
    assert(states.length >= 10, `Loaded ${states.length} canonical states (>= 10 expected)`);
    const keralaState = states.find((s) => s.code === "KL" || s.id === "state_kl");
    assert(!!keralaState, "Kerala state exists in master list");
    assert(keralaState?.id === "state_kl", `Kerala state id is '${keralaState?.id}' (expected 'state_kl')`);
    assert(keralaState?.name === "Kerala", `Kerala state name is '${keralaState?.name}'`);
    assert(keralaState?.gst_state_code === "32", `Kerala GST code is '${keralaState?.gst_state_code}' (expected '32')`);

    // -------------------------------------------------------------------------
    // TEST 2: Direct PostgreSQL City Retrieval & Domain Mapping
    // -------------------------------------------------------------------------
    console.log("\n[TEST 2] Direct PostgreSQL City Retrieval via CityRepository.findAll()");
    const allCities = await CityRepository.findAll();
    assert(allCities.length >= 20, `Loaded ${allCities.length} active cities from PostgreSQL`);

    console.log("  ALL DB CITIES:", allCities.map(c => `${c.name} (${c.state} / ${c.state_id})`));
    const unmappedStateId = allCities.filter((c) => !c.state_id);
    assert(unmappedStateId.length === 0, `All cities have state_id populated (${unmappedStateId.length} unmapped)`);

    const kollamCity = allCities.find((c) => c.id === "city_klm" || c.name.toLowerCase() === "kollam");
    assert(!!kollamCity, "Kollam ('city_klm') is present in PostgreSQL city list");
    assert(kollamCity?.state === "Kerala", `Kollam state is '${kollamCity?.state}' (expected 'Kerala')`);
    assert(kollamCity?.state_id === "state_kl", `Kollam state_id is '${kollamCity?.state_id}' (expected 'state_kl')`);
    assert(kollamCity?.state_code === "KL", `Kollam state_code is '${kollamCity?.state_code}' (expected 'KL')`);
    assert(kollamCity?.status === "active", `Kollam status is '${kollamCity?.status}' (expected 'active')`);

    const kochiCity = allCities.find((c) => c.id === "city_koc" || c.name.toLowerCase() === "kochi");
    assert(!!kochiCity, "Kochi ('city_koc') is present in PostgreSQL city list");
    assert(kochiCity?.state_id === "state_kl", `Kochi state_id is '${kochiCity?.state_id}' (expected 'state_kl')`);

    // -------------------------------------------------------------------------
    // TEST 3: State-Filtered City Query (findByState)
    // -------------------------------------------------------------------------
    console.log("\n[TEST 3] State-Filtered Query: CityRepository.findByState('Kerala')");
    const keralaCities = await CityRepository.findByState("Kerala");
    assert(keralaCities.length > 0, `Found ${keralaCities.length} cities for Kerala`);
    const hasKollamInKerala = keralaCities.some((c) => c.id === "city_klm" && c.name === "Kollam");
    assert(hasKollamInKerala, "Kollam is present in Kerala-filtered cities");
    const hasKochiInKerala = keralaCities.some((c) => c.id === "city_koc" && c.name === "Kochi");
    assert(hasKochiInKerala, "Kochi is present in Kerala-filtered cities");

    // -------------------------------------------------------------------------
    // TEST 4: Server-Side State ↔ City Validation Gate
    // -------------------------------------------------------------------------
    console.log("\n[TEST 4] Server-Side City Belongs to State Validation");
    const validCheck = await CityRepository.validateCityBelongsToState("city_klm", "Kerala");
    assert(validCheck.valid === true, "Validation passes for Kollam + Kerala");

    const validCheckByCode = await CityRepository.validateCityBelongsToState("city_klm", "KL");
    assert(validCheckByCode.valid === true, "Validation passes for Kollam + 'KL' code");

    const validCheckById = await CityRepository.validateCityBelongsToState("city_klm", "state_kl");
    assert(validCheckById.valid === true, "Validation passes for Kollam + 'state_kl' ID");

    const invalidMismatch = await CityRepository.validateCityBelongsToState("city_klm", "Karnataka");
    assert(invalidMismatch.valid === false, "Validation rejects Kollam + Karnataka mismatch");
    assert(typeof invalidMismatch.error === "string", `Validation returns descriptive error: "${invalidMismatch.error}"`);

    // -------------------------------------------------------------------------
    // TEST 5: BranchRepository.findAll() Mapping & Left Join with "city"
    // -------------------------------------------------------------------------
    console.log("\n[TEST 5] BranchRepository.findAll() with PostgreSQL 'city' Left Join");
    const branches = await BranchRepository.findAll();
    assert(branches.length > 0, `Loaded ${branches.length} branches from PostgreSQL`);

    const kollamBranch = branches.find((b) => b.id === "br_kollam_central" || b.code === "HUB-KLM-01");
    assert(!!kollamBranch, "Kollam Central Cake Studio ('HUB-KLM-01') branch found in DB");
    assert(kollamBranch?.city_id === "city_klm", `Kollam branch city_id is '${kollamBranch?.city_id}' (expected 'city_klm')`);
    assert(kollamBranch?.city === "Kollam", `Kollam branch city name is '${kollamBranch?.city}' (expected 'Kollam')`);
    assert(kollamBranch?.state === "Kerala", `Kollam branch state is '${kollamBranch?.state}' (expected 'Kerala')`);
    assert(kollamBranch?.state_id === "state_kl", `Kollam branch state_id is '${kollamBranch?.state_id}' (expected 'state_kl')`);
    assert(kollamBranch?.state_code === "KL", `Kollam branch state_code is '${kollamBranch?.state_code}' (expected 'KL')`);
    assert(kollamBranch?.pincode === "691001", `Kollam branch pincode is '${kollamBranch?.pincode}' (expected '691001')`);

    // -------------------------------------------------------------------------
    // TEST 6: API Endpoints (GET /cities, GET /admin/states)
    // -------------------------------------------------------------------------
    console.log("\n[TEST 6] Live API Endpoints: GET /api/v1/cities & GET /api/v1/admin/states");
    const [apiCitiesRes, apiStatesRes] = await Promise.all([
      fetch("http://localhost:3000/api/v1/cities").then((r) => r.json()).catch(() => null),
      fetch("http://localhost:3000/api/v1/admin/states").then((r) => r.json()).catch(() => null),
    ]);

    assert(!!apiCitiesRes && Array.isArray(apiCitiesRes.cities), "GET /api/v1/cities returns cities array");
    const apiKollam = (apiCitiesRes?.cities || []).find((c: any) => c.id === "city_klm");
    assert(!!apiKollam, "API /cities contains 'city_klm' (Kollam)");
    assert(apiKollam?.state_id === "state_kl", `API Kollam state_id is '${apiKollam?.state_id}' (expected 'state_kl')`);
    assert(apiKollam?.state === "Kerala", `API Kollam state is '${apiKollam?.state}' (expected 'Kerala')`);
    assert(apiKollam?.status === "active", `API Kollam status is '${apiKollam?.status}' (expected 'active')`);

    assert(!!apiStatesRes && Array.isArray(apiStatesRes.states), "GET /api/v1/admin/states returns states array");
    const apiKerala = (apiStatesRes?.states || []).find((s: any) => s.code === "KL");
    assert(!!apiKerala, "API /admin/states contains Kerala");
    assert(apiKerala?.id === "state_kl", `API Kerala id is '${apiKerala?.id}'`);

    // -------------------------------------------------------------------------
    // TEST 7: Frontend Filter Simulation
    // -------------------------------------------------------------------------
    console.log("\n[TEST 7] Frontend State → City Filter Logic Simulation");
    const stateId = "state_kl";
    const selectedState = apiStatesRes.states.find((s: any) => s.id === stateId || s.code === stateId);
    const filteredCities = apiCitiesRes.cities.filter((c: any) => {
      const isActive = c.status === "active" || c.is_active === true;
      if (!isActive) return false;
      if (!stateId) return false;
      if (c.state_id && c.state_id === stateId) return true;
      if (selectedState?.code && (c.state_code === selectedState.code || c.stateCode === selectedState.code)) return true;
      if (selectedState?.name && c.state?.toLowerCase() === selectedState.name.toLowerCase()) return true;
      return false;
    });

    assert(filteredCities.length > 0, `Frontend filter produces ${filteredCities.length} valid cities for Kerala`);
    const kollamInFiltered = filteredCities.find((c: any) => c.id === "city_klm");
    assert(!!kollamInFiltered, "Kollam is in the filtered list when Kerala is selected");
    assert(kollamInFiltered?.name === "Kollam", "Kollam name matches exactly");

    // Verify changing to Karnataka clears Kerala cities and shows Karnataka cities
    const kaStateId = "state_ka";
    const kaSelectedState = apiStatesRes.states.find((s: any) => s.id === kaStateId || s.code === kaStateId);
    const kaFilteredCities = apiCitiesRes.cities.filter((c: any) => {
      const isActive = c.status === "active" || c.is_active === true;
      if (!isActive) return false;
      if (!kaStateId) return false;
      if (c.state_id && c.state_id === kaStateId) return true;
      if (kaSelectedState?.code && (c.state_code === kaSelectedState.code || c.stateCode === kaSelectedState.code)) return true;
      if (kaSelectedState?.name && c.state?.toLowerCase() === kaSelectedState.name.toLowerCase()) return true;
      return false;
    });
    const hasKollamInKa = kaFilteredCities.some((c: any) => c.id === "city_klm");
    assert(!hasKollamInKa, "Kollam is NOT present when Karnataka is selected");
    const hasBengaluruInKa = kaFilteredCities.some((c: any) => c.name.toLowerCase().includes("bengaluru") || c.id.includes("bbr") || c.state === "Karnataka");
    assert(hasBengaluruInKa, "Karnataka cities appear when Karnataka is selected");

    // -------------------------------------------------------------------------
    // TEST 8: Server-Side Rejection of Mismatched State/City on Branch Mutation
    // -------------------------------------------------------------------------
    console.log("\n[TEST 8] Server-Side Mutation Security: Reject State/City Mismatch");
    const mismatchRes = await fetch("http://localhost:3000/api/v1/admin/branches", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: "br_kollam_central",
        name: "Kollam Central Cake Studio",
        code: "HUB-KLM-01",
        city: "Kollam",
        city_id: "city_klm",
        state: "Karnataka", // Intentionally mismatched!
        state_id: "state_ka",
        pincode: "691001",
        address: "Residency Rd, Chinnakada, Kollam",
      }),
    });
    const mismatchData = await mismatchRes.json();
    assert(mismatchRes.status === 400, `API rejected mismatched city/state with HTTP ${mismatchRes.status} (400 expected)`);
    assert(mismatchData.success === false, `API returned success: false on mismatch`);
    assert(typeof mismatchData.error === "string" && mismatchData.error.includes("does not belong"), `API returned error: "${mismatchData.error}"`);

    // -------------------------------------------------------------------------
    // TEST 9: Valid Persistence: Save Kerala / Kollam Hub to PostgreSQL
    // -------------------------------------------------------------------------
    console.log("\n[TEST 9] Valid Persistence: Save Kerala/Kollam to PostgreSQL");
    const saveRes = await fetch("http://localhost:3000/api/v1/admin/branches", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: "br_kollam_central",
        name: "Kollam Central Cake Studio",
        code: "HUB-KLM-01",
        city: "Kollam",
        city_id: "city_klm",
        state: "Kerala",
        state_id: "state_kl",
        pincode: "691001",
        address: "Residency Rd, Chinnakada, Kollam",
      }),
    });
    const saveData = await saveRes.json();
    assert(saveRes.status === 200, `API accepted valid Kerala/Kollam hub with HTTP ${saveRes.status} (200 expected)`);
    assert(saveData.success === true, "API returned success: true");

    // -------------------------------------------------------------------------
    // TEST 10: Direct Read-After-Write Database Verification
    // -------------------------------------------------------------------------
    console.log("\n[TEST 10] Direct Read-After-Write PostgreSQL Verification");
    const dbRowRes = await dbQuery(
      `SELECT id, name, code, city_id, address, metadata FROM "branch" WHERE id = 'br_kollam_central'`
    );
    assert(dbRowRes.rows.length === 1, "Direct SQL found 'br_kollam_central' row");
    const row = dbRowRes.rows[0];
    assert(row.city_id === "city_klm", `Direct SQL row.city_id is '${row.city_id}' (expected 'city_klm')`);
    assert(row.metadata?.city === "Kollam", `Direct SQL metadata.city is '${row.metadata?.city}' (expected 'Kollam')`);
    assert(row.metadata?.state === "Kerala", `Direct SQL metadata.state is '${row.metadata?.state}' (expected 'Kerala')`);
    assert(row.metadata?.state_id === "state_kl", `Direct SQL metadata.state_id is '${row.metadata?.state_id}' (expected 'state_kl')`);
    assert(row.metadata?.pincode === "691001", `Direct SQL metadata.pincode is '${row.metadata?.pincode}' (expected '691001')`);

    // Re-read via BranchRepository to guarantee application layer reflects DB
    const freshBranch = await BranchRepository.findById("br_kollam_central");
    assert(freshBranch?.city_id === "city_klm", `BranchRepository re-read city_id is '${freshBranch?.city_id}'`);
    assert(freshBranch?.city === "Kollam", `BranchRepository re-read city is '${freshBranch?.city}'`);
    assert(freshBranch?.state === "Kerala", `BranchRepository re-read state is '${freshBranch?.state}'`);

  } catch (err: any) {
    console.error("UNHANDLED ERROR in test suite:", err);
    failCount++;
  } finally {
    clearTimeout(safetyTimeout);
    await closeDbPool();
    console.log("\n================================================================================");
    console.log(`RESULTS: ${passCount} PASSED | ${failCount} FAILED`);
    console.log("================================================================================");
    process.exit(failCount === 0 ? 0 : 1);
  }
}

run();
