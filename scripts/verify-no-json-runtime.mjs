import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let passCount = 0;
let failCount = 0;

function pass(name, detail = "") {
  passCount++;
  console.log(`  \x1b[32m[PASS]\x1b[0m ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(name, error = "") {
  failCount++;
  console.error(`  \x1b[31m[FAIL]\x1b[0m ${name}${error ? ` — ${error}` : ""}`);
}

function scanDir(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const fullPath = path.join(dir, f);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (f !== "node_modules" && f !== ".next" && f !== ".git") {
        scanDir(fullPath, fileList);
      }
    } else if (/\.(ts|tsx|js|mjs)$/.test(f)) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

function main() {
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log(" CakeToHome: Zero JSON Runtime / Pure PostgreSQL Architecture Audit");
  console.log("════════════════════════════════════════════════════════════════════════════════\n");

  const repoRoot = path.resolve(__dirname, "..");
  const frontendSrcDir = path.join(repoRoot, "frontend", "src");

  // Check 1: Physical absence of runtime JSON database files
  console.log("[CHECK 1] Absence of Physical JSON Store Files");
  const bannedFiles = [
    path.join(repoRoot, "frontend", "data", "db-store.json"),
    path.join(repoRoot, "frontend", "data", "db-store.json.bak"),
    path.join(repoRoot, "frontend", "src", "lib", "db-store.json"),
  ];

  for (const bf of bannedFiles) {
    if (!fs.existsSync(bf)) {
      pass(`Banned file does not exist: ${path.relative(repoRoot, bf)}`);
    } else {
      fail(`Banned file exists: ${path.relative(repoRoot, bf)}`);
    }
  }

  // Check 2: Scan source files for JSON database writebacks
  console.log("\n[CHECK 2] Source Code JSON Runtime Persistence Audit");
  const srcFiles = scanDir(frontendSrcDir);
  let badRefs = 0;

  for (const file of srcFiles) {
    const content = fs.readFileSync(file, "utf-8");
    const rel = path.relative(repoRoot, file);

    if (content.includes("db-store.json")) {
      fail(`Found "db-store.json" string in ${rel}`);
      badRefs++;
    }

    if (content.includes("writeFileSync") && content.includes("StoreData")) {
      fail(`Found synchronous store file write in ${rel}`);
      badRefs++;
    }
  }

  if (badRefs === 0) {
    pass(`Scanned ${srcFiles.length} source files: Zero runtime JSON persistence references found`);
  }

  console.log("\n════════════════════════════════════════════════════════════════════════════════");
  console.log(` RESULT: ${passCount} PASSED, ${failCount} FAILED`);
  console.log("════════════════════════════════════════════════════════════════════════════════\n");

  process.exit(failCount > 0 ? 1 : 0);
}

main();
