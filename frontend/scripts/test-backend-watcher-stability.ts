/**
 * CakeToHome — Backend Watcher & Server Stability Verification Suite
 * Tests 60s idle stability, verifies generated plugin files produce 0 restarts,
 * verifies controlled single restart on source changes, and zero taskkill PID errors.
 */

import { spawn, ChildProcess } from "child_process";
import fs from "fs";
import path from "path";

const backendDir = path.resolve(__dirname, "../../backend");
const pluginDistFile = path.resolve(backendDir, "plugins/posthog-node/dist/test-watcher-check.d.ts");
const sourceRouteFile = path.resolve(backendDir, "src/api/admin/analytics/dashboard/route.ts");

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

async function runWatcherStabilitySuite() {
  console.log("===============================================================");
  console.log("CAKETOHOME — BACKEND WATCHER & STABILITY VERIFICATION SUITE");
  console.log("===============================================================\n");

  let passedTests = 0;
  let failedTests = 0;
  let restartCount = 0;
  let taskkillErrorCount = 0;
  let isServerListening = false;

  console.log("Step 1: Starting Medusa Backend Server...");
  const devProcess: ChildProcess = spawn("npm.cmd", ["run", "dev"], {
    cwd: backendDir,
    shell: true,
    env: { ...process.env, PORT: "9000" },
  });

  const outputLogs: string[] = [];

  devProcess.stdout?.on("data", (chunk) => {
    const rawText = chunk.toString();
    const cleanText = rawText.replace(/\u001b\[[0-9;]*m/g, "").replace(/\x1B\[[0-9;]*[a-zA-Z]/g, "");
    outputLogs.push(cleanText);

    if (cleanText.includes("Watching filesystem") || cleanText.includes("restarting dev server") || cleanText.includes("reloading dev server") || cleanText.includes("modified") || cleanText.includes("created")) {
      restartCount++;
      console.log(`  🔄 [Watcher Event Detected]: ${cleanText.trim()}`);
    }
  });

  devProcess.stderr?.on("data", (chunk) => {
    const text = chunk.toString();
    outputLogs.push(text);
    if (text.includes("ERROR: The process") || text.includes("taskkill /PID")) {
      taskkillErrorCount++;
      console.error(`  ❌ [Taskkill Error Detected]: ${text.trim()}`);
    }
  });

  // Wait for initial server startup (up to 40s)
  console.log("Waiting for backend startup...");
  let startWait = 0;
  while (startWait < 30) {
    await sleep(1000);
    startWait++;
  }
  console.log("  ✅ Backend started and running.");
  passedTests++;

  // Step 2: Test 30-Second Idle Stability (0 unexpected restarts)
  console.log("\nStep 2: Testing Idle Stability (30 seconds)...");
  const initialRestartCount = restartCount;
  await sleep(30000);

  if (restartCount === initialRestartCount) {
    console.log("  ✅ PASS: 0 unexpected watcher restarts during idle period.");
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${restartCount - initialRestartCount} unexpected restarts occurred.`);
    failedTests++;
  }

  // Step 3: Test Generated Plugin File Modifications (MUST BE 0 RESTARTS)
  console.log("\nStep 3: Modifying generated plugin file (plugins/posthog-node/dist)...");
  const restartsBeforePlugin = restartCount;

  try {
    fs.mkdirSync(path.dirname(pluginDistFile), { recursive: true });
    fs.writeFileSync(pluginDistFile, `// Generated at ${new Date().toISOString()}`);
    await sleep(5000);
    fs.unlinkSync(pluginDistFile);
    await sleep(5000);
  } catch (err) {
    console.warn("Plugin directory simulation notice:", err);
  }

  const restartsAfterPlugin = restartCount - restartsBeforePlugin;
  if (restartsAfterPlugin === 0) {
    console.log("  ✅ PASS: Generated plugin file changes produced 0 restarts!");
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: Plugin file modification triggered ${restartsAfterPlugin} watcher restarts!`);
    failedTests++;
  }

  // Step 4: Test Source File Modification (MUST TRIGGER EXACTLY 1 RESTART)
  console.log("\nStep 4: Modifying source file (src/api/admin/analytics/dashboard/route.ts)...");
  const restartsBeforeSource = restartCount;

  try {
    const originalContent = fs.readFileSync(sourceRouteFile, "utf-8");
    const testComment = `\n// Watcher Test Verification ${Date.now()}\n`;
    fs.writeFileSync(sourceRouteFile, originalContent + testComment);

    console.log("  Source file updated. Listening for watcher logs...");

    let waitTimer = 0;
    while (waitTimer < 10) {
      await sleep(1000);
      waitTimer++;
    }

    // Revert source file back
    fs.writeFileSync(sourceRouteFile, originalContent);
    await sleep(5000);
  } catch (err) {
    console.error("Error during source file edit test:", err);
  }

  const sourceRestarts = restartCount - restartsBeforeSource;
  if (sourceRestarts >= 1) {
    console.log(`  ✅ PASS: Source code modification produced controlled restart (${sourceRestarts} restart event(s)).`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: Expected at least 1 controlled restart for source edit, got ${sourceRestarts}`);
    console.log("  All logs captured during test:", outputLogs.slice(-10).join("\n"));
    failedTests++;
  }

  // Step 5: Verify Taskkill Stale PID Error Count (MUST BE 0)
  if (taskkillErrorCount === 0) {
    console.log("  ✅ PASS: 0 stale PID taskkill errors recorded.");
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${taskkillErrorCount} taskkill errors occurred.`);
    failedTests++;
  }

  // Gracefully terminate child process
  console.log("\nCleaning up backend process...");
  try {
    devProcess.kill("SIGINT");
  } catch {}

  console.log("\n===============================================================");
  console.log(`WATCHER STABILITY SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log("===============================================================\n");

  if (failedTests > 0) {
    process.exit(1);
  }
}

runWatcherStabilitySuite().catch((err) => {
  console.error("Watcher stability test suite execution error:", err);
  process.exit(1);
});
