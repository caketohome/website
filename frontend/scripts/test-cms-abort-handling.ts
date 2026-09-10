import { apiClient } from "../src/lib/api-client";
import { ApiEngine } from "../src/lib/api-engine";
import assert from "assert";

async function runRegressionTests() {
  console.log("=== CMS Abort & Timeout Handling Regression Tests ===");

  // 1. Verify ApiClient timeout handling produces TimeoutError, NOT "signal is aborted without reason"
  console.log("\nTest 1: apiClient timeout throws TimeoutError with explicit reason");
  let timeoutErr: any = null;
  try {
    // Request a delay endpoint or mock that takes longer than 100ms
    await apiClient.request("/admin/health", { timeoutMs: 1 });
  } catch (err: any) {
    timeoutErr = err;
  }

  assert(timeoutErr, "Expected request to time out");
  console.log("  Caught error name:", timeoutErr.name);
  console.log("  Caught error message:", timeoutErr.message);

  assert.notStrictEqual(
    timeoutErr.message,
    "signal is aborted without reason",
    "REGRESSION: Error message MUST NOT be 'signal is aborted without reason'"
  );
  assert(
    timeoutErr.name === "TimeoutError" || timeoutErr.message.includes("timed out"),
    `Expected TimeoutError, got ${timeoutErr.name}: ${timeoutErr.message}`
  );
  console.log("  PASS: Timeout error correctly identified without generic abort message.");

  // 2. Verify caller-supplied AbortController is preserved
  console.log("\nTest 2: Caller-supplied AbortController throws recognizable cancellation");
  const callerController = new AbortController();
  callerController.abort("User navigated away");
  let callerErr: any = null;
  try {
    await apiClient.request("/cms/pages", { signal: callerController.signal, timeoutMs: 30000 });
  } catch (err: any) {
    callerErr = err;
  }

  assert(callerErr, "Expected aborted request to throw");
  console.log("  Caller abort name:", callerErr.name);
  assert(
    callerErr.name === "AbortError" || callerErr === "User navigated away" || callerErr.message?.includes("aborted"),
    "Expected AbortError from caller controller"
  );
  console.log("  PASS: Caller cancellation correctly preserved.");

  // 3. Verify ApiEngine CMS version history pruning and frame preservation
  console.log("\nTest 3: ApiEngine version history pruning & animation frame protection");
  await ApiEngine.ensureHydrated();
  const originalHome = ApiEngine.getCmsPage("cmspg_home");
  assert(originalHome, "cmspg_home must exist");

  const desktopFrames = originalHome.sections?.find((s: any) => s.type === "hero")?.config?.desktop?.frames;
  console.log("  Original hero desktop frames count:", desktopFrames?.length || 0);

  // Perform an update
  const updatedPage = await ApiEngine.updateCmsPage("cmspg_home", {
    meta_title: "Fresh Cakes Delivered Fast | Cakes2Home India",
  });

  assert(updatedPage, "updateCmsPage should return updated page");
  console.log("  Version history count after update:", updatedPage.version_history?.length);
  assert(
    (updatedPage.version_history?.length || 0) <= 5,
    "Version history must be pruned to at most 5 entries"
  );

  // Check that the latest snapshot in version_history does NOT have bloated frames
  const latestSnapshot = updatedPage.version_history[updatedPage.version_history.length - 1];
  const snapshotHero = latestSnapshot.snapshot.sections?.find((s: any) => s.type === "hero");
  const snapshotFrames = snapshotHero?.config?.desktop?.frames;
  assert(!snapshotFrames || snapshotFrames.length === 0, "Snapshot must not contain duplicated frame array");
  console.log("  PASS: Snapshot sections are lightweight (no frame duplicate bloat).");

  // Check that the ACTIVE page STILL has all its frames!
  const activeHero = updatedPage.sections?.find((s: any) => s.type === "hero");
  assert.strictEqual(
    activeHero?.config?.desktop?.frames?.length,
    desktopFrames?.length,
    "Active page must retain all original animation frames"
  );
  console.log("  PASS: Active page retains all original animation frames.");

  // 4. Verify rollback restores page and preserves frames
  console.log("\nTest 4: Rollback preserves animation frames");
  const currentVersion = latestSnapshot.version;
  const rolledBack = await ApiEngine.rollbackCmsPage("cmspg_home", currentVersion);
  assert(rolledBack, "rollbackCmsPage should succeed");
  const rolledBackHero = rolledBack.sections?.find((s: any) => s.type === "hero");
  assert.strictEqual(
    rolledBackHero?.config?.desktop?.frames?.length,
    desktopFrames?.length,
    "Rolled back page must preserve animation frames from existing section"
  );
  console.log("  PASS: Rollback preserved animation frames successfully.");

  // 5. Verify total size of cmspg_home blocks payload is now drastically reduced
  console.log("\nTest 5: Verify CMS page payload size");
  const finalPage = ApiEngine.getCmsPage("cmspg_home");
  const blockData = {
    sections: finalPage?.sections || [],
    draft_config: finalPage?.draft_config || {},
    published_config: finalPage?.published_config || null,
    version_history: finalPage?.version_history || [],
  };
  const jsonStr = JSON.stringify(blockData);
  const sizeKb = (jsonStr.length / 1024).toFixed(2);
  const sizeMb = (jsonStr.length / (1024 * 1024)).toFixed(2);
  console.log(`  New blockData JSON size: ${sizeKb} KB (${sizeMb} MB)`);
  // Previous size was 42.7 MB!
  assert(jsonStr.length < 15 * 1024 * 1024, "Payload must be drastically smaller than 42 MB");
  console.log("  PASS: Payload size significantly optimized.");

  console.log("\n=== ALL REGRESSION TESTS PASSED! ===");
}

runRegressionTests().then(() => process.exit(0)).catch((err) => {
  console.error("TEST FAILED:", err);
  process.exit(1);
});
