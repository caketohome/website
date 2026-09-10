import fs from "fs";
import path from "path";

const FRONTEND_DIR = path.resolve("e:/vig/cakes2home-main/cakes2home-main/frontend");
const SCRIPTS_DIR = path.join(FRONTEND_DIR, "scripts");
const SRC_DIR = path.join(FRONTEND_DIR, "src");
const E2E_DIR = path.join(FRONTEND_DIR, "e2e");

function getFiles(dir, exts = [".ts", ".tsx", ".js", ".mjs"]) {
  if (!fs.existsSync(dir)) return [];
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getFiles(full, exts));
    } else if (exts.some(ext => entry.name.endsWith(ext))) {
      files.push(full);
    }
  }
  return files;
}

const scriptFiles = getFiles(SCRIPTS_DIR);
const srcFiles = getFiles(SRC_DIR);
const e2eFiles = getFiles(E2E_DIR);

console.log("==================================================");
console.log("PHASE 8: TYPESCRIPT GRAPH AUDIT");
console.log("==================================================");
console.log(`Total files in frontend/src/:     ${srcFiles.length}`);
console.log(`Total files in frontend/scripts/: ${scriptFiles.length}`);
console.log(`Total files in frontend/e2e/:     ${e2eFiles.length}`);

// Classify scripts
const scriptTs = scriptFiles.filter(f => f.endsWith(".ts"));
const scriptJs = scriptFiles.filter(f => f.endsWith(".js") || f.endsWith(".mjs"));
console.log(`  - TypeScript scripts (.ts):     ${scriptTs.length}`);
console.log(`  - JavaScript scripts (.js/.mjs):${scriptJs.length}`);

// Check if any script imports application code
const scriptsImportingSrc = [];
for (const f of scriptTs) {
  const content = fs.readFileSync(f, "utf-8");
  if (content.includes("@/") || content.includes("@frontend/") || content.includes("../src/")) {
    scriptsImportingSrc.push(path.relative(FRONTEND_DIR, f));
  }
}
console.log(`Scripts importing application code (src/): ${scriptsImportingSrc.length}`);
scriptsImportingSrc.forEach(s => console.log(`    ${s}`));

// Check if any application code imports scripts
const srcImportingScripts = [];
for (const f of srcFiles) {
  const content = fs.readFileSync(f, "utf-8");
  if (content.includes("scripts/") || content.includes("../scripts/")) {
    srcImportingScripts.push(path.relative(FRONTEND_DIR, f));
  }
}
console.log(`Application code importing scripts: ${srcImportingScripts.length}`);

// Check e2e imports
const e2eImportingSrc = [];
for (const f of e2eFiles) {
  const content = fs.readFileSync(f, "utf-8");
  if (content.includes("@/") || content.includes("../src/")) {
    e2eImportingSrc.push(path.relative(FRONTEND_DIR, f));
  }
}
console.log(`E2E tests importing src: ${e2eImportingSrc.length}`);

// Write JSON summary
fs.writeFileSync(
  path.join(FRONTEND_DIR, "scripts", "tsc-graph-audit.json"),
  JSON.stringify({
    srcCount: srcFiles.length,
    scriptCount: scriptFiles.length,
    scriptTsCount: scriptTs.length,
    scriptJsCount: scriptJs.length,
    e2eCount: e2eFiles.length,
    scriptsImportingSrc,
    srcImportingScripts,
    e2eImportingSrc,
    scriptSample: scriptTs.slice(0, 20).map(s => path.relative(FRONTEND_DIR, s)),
  }, null, 2)
);
