import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

const FRONTEND_DIR = path.resolve("e:/vig/cakes2home-main/cakes2home-main/frontend");

function getSysMem() {
  const total = os.totalmem();
  const free = os.freemem();
  return {
    totalMB: Math.round(total / (1024 * 1024)),
    freeMB: Math.round(free / (1024 * 1024)),
    usedMB: Math.round((total - free) / (1024 * 1024)),
  };
}

function runBuild(name, cleanCache = false) {
  return new Promise((resolve) => {
    if (cleanCache) {
      const nextDir = path.join(FRONTEND_DIR, ".next");
      if (fs.existsSync(nextDir)) {
        console.log(`Cleaning .next directory for ${name}...`);
        fs.rmSync(nextDir, { recursive: true, force: true });
      }
    }

    const memBefore = getSysMem();
    let minFree = memBefore.freeMB;
    console.log(`\n==================================================`);
    console.log(`RUNNING: ${name} (CleanCache: ${cleanCache})`);
    console.log(`Free RAM before: ${memBefore.freeMB} MB / ${memBefore.totalMB} MB`);
    console.log(`==================================================`);

    const t0 = Date.now();
    const child = spawn("cmd.exe", ["/c", "npx next build"], {
      cwd: FRONTEND_DIR,
      env: { ...process.env, NODE_ENV: "production" },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (d) => { stdout += d.toString(); });
    child.stderr.on("data", (d) => { stderr += d.toString(); });

    const sampler = setInterval(() => {
      const m = getSysMem();
      if (m.freeMB < minFree) minFree = m.freeMB;
    }, 250);

    child.on("close", (code) => {
      clearInterval(sampler);
      const durationSec = Number(((Date.now() - t0) / 1000).toFixed(2));
      const memAfter = getSysMem();
      const hasManifest = fs.existsSync(path.join(FRONTEND_DIR, ".next", "build-manifest.json"));
      const hasRoutes = stdout.includes("First Load JS shared by all");

      console.log(`[${name}] Finished:`);
      console.log(`  Duration:             ${durationSec}s`);
      console.log(`  Exit Code:            ${code}`);
      console.log(`  Manifest Exists:      ${hasManifest}`);
      console.log(`  Route Table Emitted:  ${hasRoutes}`);
      console.log(`  Min Free RAM:         ${minFree} MB`);
      console.log(`  Free RAM After:       ${memAfter.freeMB} MB`);

      resolve({
        name,
        cleanCache,
        durationSec,
        exitCode: code,
        hasManifest,
        hasRoutes,
        minFreeMB: minFree,
        freeBeforeMB: memBefore.freeMB,
        freeAfterMB: memAfter.freeMB,
      });
    });
  });
}

async function main() {
  console.log("==================================================");
  console.log("PHASE 6 EXPERIMENT: optimizePackageImports VERIFICATION");
  console.log("==================================================");

  // 1. Clean Cold Build
  const cold = await runBuild("Clean Cold Build", true);
  await new Promise((r) => setTimeout(r, 4000));

  // 2. Warm Build #1
  const warm1 = await runBuild("Warm Build #1", false);
  await new Promise((r) => setTimeout(r, 4000));

  // 3. Warm Build #2
  const warm2 = await runBuild("Warm Build #2", false);
  await new Promise((r) => setTimeout(r, 4000));

  // 4. Warm Build #3
  const warm3 = await runBuild("Warm Build #3", false);

  const warmDurations = [warm1.durationSec, warm2.durationSec, warm3.durationSec];
  warmDurations.sort((a, b) => a - b);
  const min = Math.min(...warmDurations);
  const max = Math.max(...warmDurations);
  const sum = warmDurations.reduce((a, b) => a + b, 0);
  const mean = sum / warmDurations.length;
  const median = warmDurations[1];

  console.log("\n==================================================");
  console.log("PHASE 6 EXPERIMENT RESULTS SUMMARY");
  console.log("==================================================");
  console.log(`Cold Build:  ${cold.durationSec}s [Exit: ${cold.exitCode}]`);
  console.log(`Warm #1:     ${warm1.durationSec}s [Exit: ${warm1.exitCode}]`);
  console.log(`Warm #2:     ${warm2.durationSec}s [Exit: ${warm2.exitCode}]`);
  console.log(`Warm #3:     ${warm3.durationSec}s [Exit: ${warm3.exitCode}]`);
  console.log("--------------------------------------------------");
  console.log(`Warm Min:    ${min.toFixed(2)}s`);
  console.log(`Warm Max:    ${max.toFixed(2)}s`);
  console.log(`Warm Median: ${median.toFixed(2)}s`);
  console.log(`Warm Mean:   ${mean.toFixed(2)}s`);
  console.log("==================================================");

  fs.writeFileSync(
    path.join(FRONTEND_DIR, "scripts", "phase6-experiment-results.json"),
    JSON.stringify({ cold, warmRuns: [warm1, warm2, warm3], stats: { min, max, median, mean } }, null, 2)
  );
}

main().catch(console.error);
