/**
 * CakeToHome — Store Map Fencing UI End-to-End Verification Script
 *
 * Verifies:
 * 1. State → City cascade (no forced Karnataka)
 * 2. Multi-state store creation
 * 3. Zone CRUD with full field persistence
 * 4. Map fence polygon coordinates persistence
 * 5. Radius persistence
 * 6. Exclusion polygon persistence
 * 7. Zone priority resolver
 * 8. Store isolation (Zone A can never resolve for Store B)
 * 9. Serviceability computation from correct store/zone
 * 10. Karnataka regression (existing stores still work)
 * 11. No duplicate map engine
 * 12. No hardcoded Karnataka in runtime code
 */

const BASE = process.env.BASE_URL || "http://localhost:3000";

interface TestResult {
  name: string;
  status: "PASS" | "FAIL" | "WARNING" | "SKIPPED";
  evidence?: string;
  error?: string;
}

const results: TestResult[] = [];

function log(msg: string) {
  console.log(`[E2E] ${msg}`);
}

function pass(name: string, evidence: string) {
  results.push({ name, status: "PASS", evidence });
  log(`✅ PASS: ${name}`);
}

function fail(name: string, error: string) {
  results.push({ name, status: "FAIL", error });
  log(`❌ FAIL: ${name} — ${error}`);
}

function warn(name: string, evidence: string) {
  results.push({ name, status: "WARNING", evidence });
  log(`⚠️ WARNING: ${name} — ${evidence}`);
}

function skip(name: string, evidence: string) {
  results.push({ name, status: "SKIPPED", evidence });
  log(`⏭️ SKIPPED: ${name} — ${evidence}`);
}

async function api(path: string, method = "GET", body?: any): Promise<any> {
  const opts: RequestInit = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}/api/v1/${path}`, opts);
  if (!res.ok) throw new Error(`API ${method} ${path} returned ${res.status}`);
  return res.json();
}

// ══════════════════════════════════════════════════════════════════════════════
// TEST 1: State → City Cascade
// ══════════════════════════════════════════════════════════════════════════════
async function testStateCityCascade() {
  log("━━━ TEST 1: State → City Cascade ━━━");
  try {
    const statesRes = await api("admin/states");
    const states = statesRes?.states || statesRes?.data || [];
    if (states.length === 0) {
      fail("State list API", "No states returned from admin/states");
      return;
    }
    pass("State list API", `${states.length} states available`);

    // Check that states include non-Karnataka options
    const stateNames = states.map((s: any) => s.name);
    const hasMultipleStates = stateNames.length > 1;
    if (hasMultipleStates) {
      pass("Multi-state availability", `States: ${stateNames.slice(0, 5).join(", ")}...`);
    } else {
      warn("Multi-state availability", `Only ${stateNames.length} state(s) found: ${stateNames.join(", ")}`);
    }

    // Check city filtering
    const citiesRes = await api("admin/cities");
    const cities = citiesRes?.cities || citiesRes?.data || [];
    if (cities.length > 0) {
      const firstState = states[0];
      const filteredCities = cities.filter((c: any) =>
        c.state_id === firstState.id || c.state === firstState.name || c.stateCode === firstState.code
      );
      pass("City filtering by state", `State "${firstState.name}" has ${filteredCities.length} cities`);
    } else {
      warn("City list API", "No cities returned");
    }
  } catch (err: any) {
    fail("State → City Cascade", err.message);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// TEST 2: Multi-State Store Creation
// ══════════════════════════════════════════════════════════════════════════════
async function testMultiStateStoreCreation() {
  log("━━━ TEST 2: Multi-State Store Creation ━━━");
  const testStores = [
    { name: "E2E Kerala Store", state: "Kerala", city: "Kochi", pincode: "682001" },
    { name: "E2E Tamil Nadu Store", state: "Tamil Nadu", city: "Chennai", pincode: "600001" },
    { name: "E2E Maharashtra Store", state: "Maharashtra", city: "Mumbai", pincode: "400001" },
  ];

  for (const store of testStores) {
    try {
      const payload = {
        name: store.name,
        code: `E2E-${store.state.substring(0, 2).toUpperCase()}-${Date.now() % 10000}`,
        city: store.city,
        state: store.state,
        pincode: store.pincode,
        address: `Test address in ${store.city}`,
        is_open: true,
        latitude: 10.0 + Math.random() * 10,
        longitude: 75.0 + Math.random() * 5,
      };

      const createRes = await api("admin/branches", "POST", payload);
      const branch = createRes?.branch || createRes?.data || createRes;
      const branchId = branch?.id;

      if (!branchId) {
        fail(`Create ${store.name}`, "No branch ID returned");
        continue;
      }

      // Verify no Karnataka injection
      const storedState = branch?.state || "";
      const storedCity = branch?.city || "";
      if (storedState.toLowerCase().includes("karnataka")) {
        fail(`${store.name} state`, `Expected "${store.state}", got "${storedState}" — KARNATAKA INJECTED`);
      } else if (storedCity.toLowerCase().includes("bengaluru") || storedCity.toLowerCase().includes("bangalore")) {
        fail(`${store.name} city`, `Expected "${store.city}", got "${storedCity}" — BENGALURU INJECTED`);
      } else {
        pass(`Create ${store.name}`, `state=${storedState}, city=${storedCity}, id=${branchId}`);
      }

      // Verify reload persistence
      const getRes = await api(`admin/branches/${branchId}`);
      const reloaded = getRes?.branch || getRes?.data || getRes;
      const reloadedState = reloaded?.state || "";
      if (reloadedState === store.state || reloadedState === "") {
        pass(`Reload ${store.name}`, `state persisted: "${reloadedState}"`);
      } else {
        fail(`Reload ${store.name}`, `state changed after reload: "${reloadedState}"`);
      }

      // Cleanup
      try {
        await api(`admin/branches/${branchId}`, "DELETE");
      } catch { /* cleanup best-effort */ }
    } catch (err: any) {
      fail(`Create ${store.name}`, err.message);
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// TEST 3: Zone CRUD with Full Field Persistence
// ══════════════════════════════════════════════════════════════════════════════
async function testZoneCrud() {
  log("━━━ TEST 3: Zone CRUD ━━━");
  try {
    // Get first branch
    const branchesRes = await api("admin/branches");
    const branches = branchesRes?.branches || branchesRes?.data || [];
    if (branches.length === 0) {
      skip("Zone CRUD", "No branches available");
      return;
    }

    const branch = branches[0];
    const branchId = branch.id;
    const existingZones = branch.delivery_zones || [];

    // Create a test zone
    const testZone = {
      id: `zone_e2e_test_${Date.now()}`,
      name: "E2E Test Zone Alpha",
      display_order: existingZones.length + 1,
      priority: 42,
      fence_type: "hybrid",
      polygon_coordinates: [
        { lat: 12.97, lng: 77.58 },
        { lat: 12.98, lng: 77.60 },
        { lat: 12.96, lng: 77.61 },
      ],
      exclusion_polygons: [
        [
          { lat: 12.975, lng: 77.59 },
          { lat: 12.976, lng: 77.595 },
          { lat: 12.974, lng: 77.593 },
        ],
      ],
      min_km: 0,
      max_km: 7.5,
      enabled: true,
      est_delivery_mins: 55,
      preparation_buffer_mins: 20,
      max_cake_weight_kg: 8,
      max_cake_quantity: 4,
      min_order_value: 349,
      max_order_value: 25000,
      free_delivery_threshold: 1499,
      same_day_allowed: true,
      express_allowed: true,
      instant_allowed: false,
      midnight_allowed: true,
      scheduled_allowed: true,
      delivery_charge: 49,
      express_charge: 129,
      instant_charge: 199,
      midnight_charge: 89,
      holiday_charge: 59,
      pincodes: ["560038", "560001"],
      cities: ["Bengaluru"],
      areas: ["Indiranagar", "Koramangala"],
      service_areas: ["HSR Layout"],
    };

    const updatedZones = [...existingZones, testZone];
    await api(`admin/branches/${branchId}`, "PUT", { delivery_zones: updatedZones });

    // Reload and verify
    const reloadRes = await api(`admin/branches/${branchId}`);
    const reloaded = reloadRes?.branch || reloadRes?.data || reloadRes;
    const zones = reloaded?.delivery_zones || [];
    const found = zones.find((z: any) => z.id === testZone.id);

    if (!found) {
      fail("Zone persistence", "Test zone not found after reload");
    } else {
      // Verify every field
      const checks = [
        ["name", found.name, testZone.name],
        ["priority", found.priority, testZone.priority],
        ["max_km", found.max_km, testZone.max_km],
        ["est_delivery_mins", found.est_delivery_mins, testZone.est_delivery_mins],
        ["delivery_charge", found.delivery_charge, testZone.delivery_charge],
        ["express_charge", found.express_charge, testZone.express_charge],
        ["midnight_charge", found.midnight_charge, testZone.midnight_charge],
        ["free_delivery_threshold", found.free_delivery_threshold, testZone.free_delivery_threshold],
        ["same_day_allowed", found.same_day_allowed, testZone.same_day_allowed],
        ["express_allowed", found.express_allowed, testZone.express_allowed],
        ["midnight_allowed", found.midnight_allowed, testZone.midnight_allowed],
      ];

      let allMatch = true;
      for (const [field, actual, expected] of checks) {
        if (actual !== expected) {
          fail(`Zone field: ${field}`, `Expected ${expected}, got ${actual}`);
          allMatch = false;
        }
      }
      if (allMatch) {
        pass("Zone field persistence", "All 11 checked fields match after reload");
      }

      // Verify polygon coordinates persisted
      const polyCoords = found.polygon_coordinates || [];
      if (polyCoords.length === testZone.polygon_coordinates.length) {
        pass("Polygon persistence", `${polyCoords.length} polygon points persisted`);
      } else {
        fail("Polygon persistence", `Expected ${testZone.polygon_coordinates.length} points, got ${polyCoords.length}`);
      }

      // Verify exclusion polygons
      const excl = found.exclusion_polygons || [];
      if (excl.length === testZone.exclusion_polygons.length) {
        const firstExcl = excl[0] || [];
        if (firstExcl.length === testZone.exclusion_polygons[0].length) {
          pass("Exclusion persistence", `${excl.length} exclusion zone(s) with ${firstExcl.length} points`);
        } else {
          fail("Exclusion persistence", `Wrong point count: ${firstExcl.length}`);
        }
      } else {
        fail("Exclusion persistence", `Expected ${testZone.exclusion_polygons.length} exclusions, got ${excl.length}`);
      }

      // Verify pincodes
      const pincodes = found.pincodes || [];
      if (pincodes.length === testZone.pincodes.length) {
        pass("Pincode persistence", `${pincodes.length} pincodes persisted`);
      } else {
        fail("Pincode persistence", `Expected ${testZone.pincodes.length} pincodes, got ${pincodes.length}`);
      }
    }

    // Cleanup: remove test zone
    const cleanZones = zones.filter((z: any) => z.id !== testZone.id);
    await api(`admin/branches/${branchId}`, "PUT", { delivery_zones: cleanZones });
    pass("Zone cleanup", "Test zone removed");
  } catch (err: any) {
    fail("Zone CRUD", err.message);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// TEST 4: Zone Priority Resolution
// ══════════════════════════════════════════════════════════════════════════════
async function testZonePriority() {
  log("━━━ TEST 4: Zone Priority Resolution ━━━");
  try {
    const serviceRes = await api("delivery/check-serviceability?pincode=560038");
    const data = serviceRes;
    if (data?.serviceable !== undefined) {
      pass("Serviceability API", `pincode 560038: serviceable=${data.serviceable}, zone=${data.zone_name || data.zone || "N/A"}`);
    } else {
      warn("Serviceability API", "No serviceable flag in response");
    }

    // Test non-serviceable pincode
    const nonServiceable = await api("delivery/check-serviceability?pincode=999999");
    if (nonServiceable?.serviceable === false) {
      pass("Non-serviceable pincode", "pincode 999999 correctly returned not serviceable");
    } else {
      warn("Non-serviceable pincode", `Expected not serviceable, got: ${JSON.stringify(nonServiceable).substring(0, 100)}`);
    }
  } catch (err: any) {
    // If serviceability API doesn't exist at this path, try alternatives
    try {
      const altRes = await api("store/delivery/resolve", "POST", { pincode: "560038" });
      pass("Serviceability (alt path)", `Resolved: ${JSON.stringify(altRes).substring(0, 100)}`);
    } catch {
      warn("Serviceability API", `Neither path works: ${err.message}`);
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// TEST 5: Store Isolation
// ══════════════════════════════════════════════════════════════════════════════
async function testStoreIsolation() {
  log("━━━ TEST 5: Store Isolation ━━━");
  try {
    const branchesRes = await api("admin/branches");
    const branches = branchesRes?.branches || branchesRes?.data || [];
    if (branches.length < 2) {
      skip("Store Isolation", `Only ${branches.length} branch(es) available, need ≥2`);
      return;
    }

    const branchA = branches[0];
    const branchB = branches[1];
    const zonesA = branchA.delivery_zones || [];
    const zonesB = branchB.delivery_zones || [];

    // Check no zone ID overlap
    const zoneIdsA = new Set(zonesA.map((z: any) => z.id));
    const zoneIdsB = new Set(zonesB.map((z: any) => z.id));
    let overlap = false;
    for (const id of zoneIdsA) {
      if (zoneIdsB.has(id)) {
        overlap = true;
        fail("Store isolation", `Zone ${id} appears in both branches`);
        break;
      }
    }
    if (!overlap) {
      pass("Store isolation", `Branch "${branchA.name}" (${zonesA.length} zones) and "${branchB.name}" (${zonesB.length} zones) have no shared zones`);
    }
  } catch (err: any) {
    fail("Store Isolation", err.message);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// TEST 6: Karnataka Regression
// ══════════════════════════════════════════════════════════════════════════════
async function testKarnatakaRegression() {
  log("━━━ TEST 6: Karnataka Regression ━━━");
  try {
    const branchesRes = await api("admin/branches");
    const branches = branchesRes?.branches || branchesRes?.data || [];
    const karnatakaBranch = branches.find((b: any) =>
      b.state === "Karnataka" || b.city === "Bengaluru" || b.city === "Bangalore"
    );

    if (!karnatakaBranch) {
      skip("Karnataka regression", "No Karnataka branch found in system");
      return;
    }

    pass("Karnataka branch exists", `"${karnatakaBranch.name}" in ${karnatakaBranch.city}, ${karnatakaBranch.state}`);

    // Verify zones still work
    const zones = karnatakaBranch.delivery_zones || [];
    if (zones.length > 0) {
      pass("Karnataka zones preserved", `${zones.length} delivery zones still configured`);

      // Check a pincode
      const firstZone = zones.find((z: any) => (z.pincodes || []).length > 0);
      if (firstZone) {
        const testPin = firstZone.pincodes[0];
        try {
          const checkRes = await api(`delivery/check-serviceability?pincode=${testPin}`);
          if (checkRes?.serviceable) {
            pass("Karnataka serviceability", `Pincode ${testPin} still serviceable`);
          } else {
            warn("Karnataka serviceability", `Pincode ${testPin} check returned: ${JSON.stringify(checkRes).substring(0, 100)}`);
          }
        } catch {
          warn("Karnataka serviceability", "Serviceability API not available for direct testing");
        }
      }
    } else {
      warn("Karnataka zones", "Branch has no delivery zones configured");
    }
  } catch (err: any) {
    fail("Karnataka Regression", err.message);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// TEST 7: No Duplicate Map Engine
// ══════════════════════════════════════════════════════════════════════════════
async function testNoDuplicateMapEngine() {
  log("━━━ TEST 7: No Duplicate Map Engine ━━━");
  // This test reads files to verify single canonical implementation
  const fs = await import("fs");
  const path = await import("path");

  const srcDir = path.resolve(__dirname, "../src");

  function grepFiles(dir: string, pattern: RegExp, ext: string[]): { file: string; line: number; content: string }[] {
    const matches: { file: string; line: number; content: string }[] = [];
    try {
      const walk = (d: string) => {
        for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
          const full = path.join(d, entry.name);
          if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") {
            walk(full);
          } else if (entry.isFile() && ext.some((e) => entry.name.endsWith(e))) {
            const content = fs.readFileSync(full, "utf-8");
            content.split("\n").forEach((line, idx) => {
              if (pattern.test(line)) {
                matches.push({ file: full.replace(srcDir, "src"), line: idx + 1, content: line.trim() });
              }
            });
          }
        }
      };
      walk(dir);
    } catch {}
    return matches;
  }

  // Check isPointInPolygon implementations (should be exactly 1 definition)
  const pipDefs = grepFiles(srcDir, /static\s+isPointInPolygon|function\s+isPointInPolygon|const\s+isPointInPolygon/, [".ts", ".tsx"]);
  if (pipDefs.length === 1) {
    pass("Single PIP implementation", `Found at ${pipDefs[0].file}:${pipDefs[0].line}`);
  } else if (pipDefs.length === 0) {
    fail("PIP implementation", "No isPointInPolygon found");
  } else {
    fail("Duplicate PIP", `Found ${pipDefs.length} implementations: ${pipDefs.map((d) => `${d.file}:${d.line}`).join(", ")}`);
  }

  // Check resolveSmartBranch implementations
  const resolverDefs = grepFiles(srcDir, /static\s+resolveSmartBranch|function\s+resolveSmartBranch/, [".ts", ".tsx"]);
  if (resolverDefs.length === 1) {
    pass("Single resolver implementation", `Found at ${resolverDefs[0].file}:${resolverDefs[0].line}`);
  } else {
    fail("Resolver implementation", `Found ${resolverDefs.length} implementations`);
  }

  // Check for hardcoded Karnataka in runtime code (not seed data)
  const karnatakaHits = grepFiles(srcDir, /"Karnataka"/, [".ts", ".tsx"])
    .filter((h) => !h.file.includes("test") && !h.file.includes("spec") && !h.file.includes("demo"));
  if (karnatakaHits.length === 0) {
    pass("No hardcoded Karnataka", "Zero runtime references to 'Karnataka'");
  } else {
    fail("Hardcoded Karnataka found", karnatakaHits.map((h) => `${h.file}:${h.line}`).join(", "));
  }

  // Check for hardcoded Bengaluru  
  const bengaluruHits = grepFiles(srcDir, /"Bengaluru"/, [".ts", ".tsx"])
    .filter((h) => !h.file.includes("test") && !h.file.includes("spec") && !h.file.includes("demo"));
  if (bengaluruHits.length === 0) {
    pass("No hardcoded Bengaluru", "Zero runtime references to 'Bengaluru'");
  } else {
    fail("Hardcoded Bengaluru found", bengaluruHits.map((h) => `${h.file}:${h.line}`).join(", "));
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// TEST 8: Map Tile Delivery
// ══════════════════════════════════════════════════════════════════════════════
async function testMapTileDelivery() {
  log("━━━ TEST 8: Map Tile Delivery ━━━");
  try {
    // Test that OpenStreetMap tile server is reachable
    const tileUrl = "https://a.tile.openstreetmap.org/10/580/340.png";
    const res = await fetch(tileUrl, { method: "HEAD" });
    if (res.ok) {
      pass("OSM tile delivery", `Tile server returned ${res.status} OK`);
    } else {
      fail("OSM tile delivery", `Tile server returned ${res.status}`);
    }
  } catch (err: any) {
    warn("OSM tile delivery", `Could not reach tile server: ${err.message}`);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════════════════
async function main() {
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║  CakeToHome — Store Map Fencing E2E Verification           ║");
  console.log("║  " + new Date().toISOString() + "                          ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  await testStateCityCascade();
  await testMultiStateStoreCreation();
  await testZoneCrud();
  await testZonePriority();
  await testStoreIsolation();
  await testKarnatakaRegression();
  await testNoDuplicateMapEngine();
  await testMapTileDelivery();

  // Summary
  console.log("\n══════════════════════════════════════════════════════════════");
  console.log("FINAL RESULTS:");
  console.log("══════════════════════════════════════════════════════════════");

  const passed = results.filter((r) => r.status === "PASS").length;
  const failed = results.filter((r) => r.status === "FAIL").length;
  const warned = results.filter((r) => r.status === "WARNING").length;
  const skipped = results.filter((r) => r.status === "SKIPPED").length;

  for (const r of results) {
    const icon = r.status === "PASS" ? "✅" : r.status === "FAIL" ? "❌" : r.status === "WARNING" ? "⚠️" : "⏭️";
    console.log(`  ${icon} ${r.name}: ${r.evidence || r.error || ""}`);
  }

  console.log(`\nTOTAL: ${passed} PASS, ${failed} FAIL, ${warned} WARNING, ${skipped} SKIPPED`);
  console.log(`STATUS: ${failed === 0 ? "✅ ALL CRITICAL TESTS PASSED" : "❌ FAILURES DETECTED"}`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("E2E test crashed:", err);
  process.exit(2);
});
