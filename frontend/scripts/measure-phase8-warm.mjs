import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

const FRONTEND_DIR = path.resolve("e:/vig/cakes2home-main/cakes2home-main/frontend");

function getSystemMemory() {
  const total = os.totalmem();
  const free = os.freemem();
  return {
    totalMB: Math.round(total / 1024 / 1024),
    freeMB: Math.round(free / 1024 / 1024),
    usedMB: Math.round((total - free) / 1024 / 1024),
  };
}

function runSingleBuild(buildIndex) {
  return new Promise((resolve) => {
    const memBefore = getSystemMemory();
    let minFreeMB = memBefore.freeMB;
    let peakRssMB = 0;

    console.log(`\n==================================================`);
    console.log(`STARTING PHASE 8 WARM BUILD #${buildIndex}`);
    console.log(`Free RAM before: ${memBefore.freeMB} MB / ${memBefore.totalMB} MB`);
    console.log(`==================================================`);

    const startTime = Date.now();
    const child = spawn("cmd.exe", ["/c", "npx next build"], {
      cwd: FRONTEND_DIR,
      env: { ...process.env, NODE_ENV: "production" },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    const sampler = setInterval(() => {
      const currentMem = getSystemMemory();
      if (currentMem.freeMB < minFreeMB) {
        minFreeMB = currentMem.freeMB;
      }
      try {
        const usage = process.memoryUsage();
        const rss = Math.round(usage.rss / 1024 / 1024);
        if (rss > peakRssMB) peakRssMB = rss;
      } catch (e) {}
    }, 250);

    child.on("close", (code) => {
      clearInterval(sampler);
      const durationMs = Date.now() - startTime;
      const durationSec = durationMs / 1000;
      const memAfter = getSystemMemory();

      const hasCompiledSuccessfully = stdout.includes("Compiled successfully");
      const hasRouteTable = stdout.includes("First Load JS shared by all");
      const buildManifestPath = path.join(FRONTEND_DIR, ".next", "build-manifest.json");
      const hasBuildManifest = fs.existsSync(buildManifestPath);

      console.log(`Warm Build #${buildIndex} Completed:`);
      console.log(`  Duration:             ${durationSec.toFixed(2)}s (${durationMs} ms)`);
      console.log(`  Exit Code:            ${code}`);
      console.log(`  Compiled Successfully:${hasCompiledSuccessfully}`);
      console.log(`  Route Table Emitted:  ${hasRouteTable}`);
      console.log(`  Build Manifest Exists:${hasBuildManifest}`);
      console.log(`  Min Free RAM During:  ${minFreeMB} MB`);
      console.log(`  Free RAM After:       ${memAfter.freeMB} MB`);

      resolve({
        index: buildIndex,
        durationSec,
        durationMs,
        exitCode: code,
        hasCompiledSuccessfully,
        hasRouteTable,
        hasBuildManifest,
        minFreeMB,
        freeBeforeMB: memBefore.freeMB,
        freeAfterMB: memAfter.freeMB,
        peakRssMB,
      });
    });
  });
}

async function main() {
  console.log("Measuring 3 Sequential Warm Builds for Phase 8...");
  const results = [];

  for (let i = 1; i <= 3; i++) {
    const result = await runSingleBuild(i);
    results.push(result);
    await new Promise((r) => setTimeout(r, 3000));
  }

  const durations = results.map((r) => r.durationSec);
  durations.sort((a, b) => a - b);

  const min = Math.min(...durations);
  const max = Math.max(...durations);
  const sum = durations.reduce((acc, d) => acc + d, 0);
  const mean = sum / durations.length;
  const median = durations[Math.floor(durations.length / 2)];
  const variance = durations.reduce((acc, d) => acc + Math.pow(d - mean, 2), 0) / durations.length;
  const stdDev = Math.sqrt(variance);

  console.log("\n==================================================");
  console.log("PHASE 8 WARM-BUILD STATISTICAL ANALYSIS");
  console.log("==================================================");
  results.forEach((r) => {
    console.log(`Warm #${r.index}: ${r.durationSec.toFixed(2)}s | Exit: ${r.exitCode} | Min Free RAM: ${r.minFreeMB} MB`);
  });
  console.log("--------------------------------------------------");
  console.log(`Minimum:            ${min.toFixed(2)}s`);
  console.log(`Maximum:            ${max.toFixed(2)}s`);
  console.log(`Median:             ${median.toFixed(2)}s`);
  console.log(`Mean:               ${mean.toFixed(2)}s`);
  console.log(`Standard Deviation: ${stdDev.toFixed(2)}s`);
  console.log("==================================================");

  fs.writeFileSync(
    path.join(FRONTEND_DIR, "scripts", "phase8-warm-build-stats.json"),
    JSON.stringify({ results, stats: { min, max, median, mean, stdDev } }, null, 2)
  );
}

main().catch(console.error);
