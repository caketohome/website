import { spawn } from "child_process";
import fs from "fs";
import path from "path";

const FRONTEND_DIR = path.resolve("e:/vig/cakes2home-main/cakes2home-main/frontend");

function runTscDiagnostics() {
  return new Promise((resolve, reject) => {
    console.log("==================================================");
    console.log("RUNNING POST-CHANGE TYPESCRIPT EXTENDED DIAGNOSTICS");
    console.log("==================================================");

    const t0 = Date.now();
    const child = spawn("cmd.exe", ["/c", "npx tsc --noEmit --extendedDiagnostics"], {
      cwd: FRONTEND_DIR,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (d) => { stdout += d.toString(); });
    child.stderr.on("data", (d) => { stderr += d.toString(); });

    child.on("close", (code) => {
      const wallClockSec = Number(((Date.now() - t0) / 1000).toFixed(2));
      console.log(stdout);
      if (stderr) console.error("STDERR:", stderr);

      const parseMetric = (label) => {
        const regex = new RegExp(`${label}:\\s*([0-9.]+)(s|K)?`, "i");
        const m = stdout.match(regex);
        return m ? m[1] + (m[2] || "") : "N/A";
      };

      const metrics = {
        wallClockSec,
        exitCode: code,
        files: parseMetric("Files"),
        linesLibrary: parseMetric("Lines of Library"),
        linesDefinitions: parseMetric("Lines of Definitions"),
        linesTypeScript: parseMetric("Lines of TypeScript"),
        memoryUsed: parseMetric("Memory used"),
        ioReadTime: parseMetric("I/O Read time"),
        parseTime: parseMetric("Parse time"),
        resolveModuleTime: parseMetric("ResolveModule time"),
        bindTime: parseMetric("Bind time"),
        checkTime: parseMetric("Check time"),
        totalCompilerTime: parseMetric("Total time"),
      };

      console.log("\nPARSED POST-CHANGE METRICS:");
      console.table(metrics);

      resolve(metrics);
    });
  });
}

async function main() {
  const metrics = await runTscDiagnostics();
  fs.writeFileSync(
    path.join(FRONTEND_DIR, "scripts", "phase8-post-results.json"),
    JSON.stringify(metrics, null, 2)
  );

  // Compare with pre
  const prePath = path.join(FRONTEND_DIR, "scripts", "phase8-pre-baseline.json");
  if (fs.existsSync(prePath)) {
    const pre = JSON.parse(fs.readFileSync(prePath, "utf-8"));
    console.log("\n==================================================");
    console.log("BEFORE VS AFTER COMPARISON (PHASE 8)");
    console.log("==================================================");
    console.log(`Files Scanned:   ${pre.files} -> ${metrics.files} (Delta: ${Number(metrics.files) - Number(pre.files)})`);
    console.log(`I/O Read Time:   ${pre.ioReadTime} -> ${metrics.ioReadTime}`);
    console.log(`Module Resolve:  ${pre.resolveModuleTime} -> ${metrics.resolveModuleTime}`);
    console.log(`Compiler Time:   ${pre.totalCompilerTime} -> ${metrics.totalCompilerTime}`);
    console.log(`Wall Clock Time: ${pre.wallClockSec}s -> ${metrics.wallClockSec}s`);
    console.log(`Exit Code:       ${pre.exitCode} -> ${metrics.exitCode}`);
    console.log("==================================================");
  }
}

main().catch(console.error);
