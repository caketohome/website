import { spawn } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { performance } from "perf_hooks";

const FRONTEND_DIR = process.cwd();
const NEXT_CONFIG = path.join(FRONTEND_DIR, "next.config.mjs");

function getSysMemory() {
  const total = os.totalmem();
  const free = os.freemem();
  return {
    totalMB: Math.round(total / (1024 * 1024)),
    freeMB: Math.round(free / (1024 * 1024)),
    usedMB: Math.round((total - free) / (1024 * 1024)),
  };
}

function updateNextConfigCpu(cpuCount) {
  let content = fs.readFileSync(NEXT_CONFIG, "utf-8");
  content = content.replace(/cpus:\s*\d+/, `cpus: ${cpuCount}`);
  fs.writeFileSync(NEXT_CONFIG, content, "utf-8");
}

function runBuild() {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const initialMem = getSysMemory();
    let peakDelta = 0;

    const proc = spawn("npx.cmd", ["next", "build"], {
      cwd: FRONTEND_DIR,
      env: { ...process.env, PATH: "C:\\Program Files\\nodejs;" + (process.env.PATH || "") },
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const sampler = setInterval(() => {
      const cur = getSysMemory();
      const delta = cur.usedMB - initialMem.usedMB;
      if (delta > peakDelta) peakDelta = delta;
    }, 250);

    let output = "";
    proc.stdout.on("data", (d) => { output += d.toString(); });
    proc.stderr.on("data", (d) => { output += d.toString(); });

    proc.on("close", (exitCode) => {
      clearInterval(sampler);
      const t1 = performance.now();
      resolve({
        durationSec: Number(((t1 - t0) / 1000).toFixed(2)),
        exitCode,
        peakDeltaMB: peakDelta,
        success: exitCode === 0,
      });
    });
  });
}

async function runCpuBenchmark() {
  console.log("==================================================");
  console.log("PHASE 7 — CPU & MEMORY WORKER OPTIMIZATION BENCHMARK");
  console.log("==================================================");
  console.log(`System Memory: ${getSysMemory().totalMB} MB Total | ${getSysMemory().freeMB} MB Free`);

  const originalConfig = fs.readFileSync(NEXT_CONFIG, "utf-8");
  const candidates = [1, 2, 3, 4];
  const results = [];

  try {
    for (const c of candidates) {
      console.log(`\nTesting Next.js build with cpus: ${c}...`);
      updateNextConfigCpu(c);
      const res = await runBuild();
      console.log(`  -> cpus: ${c} | Duration: ${res.durationSec}s | Exit: ${res.exitCode} | Peak Delta: ~${res.peakDeltaMB} MB`);
      results.push({ cpus: c, ...res });
    }
  } finally {
    // Restore original config
    fs.writeFileSync(NEXT_CONFIG, originalConfig, "utf-8");
  }

  console.log("\n==================================================");
  console.log("CPU BENCHMARK SUMMARY");
  console.log("==================================================");
  for (const r of results) {
    console.log(`cpus = ${r.cpus} : ${r.durationSec}s [Exit: ${r.exitCode}, Peak: +${r.peakDeltaMB} MB, ${r.success ? "SUCCESS" : "CRASH"}]`);
  }
}

runCpuBenchmark().catch(console.error);
