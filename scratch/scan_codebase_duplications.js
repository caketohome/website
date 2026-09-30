const fs = require("fs");
const path = require("path");

function walkDir(dir, fileList = [], filterFn = null) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file === "node_modules" || file === ".git" || file === ".next" || file === "dist" || file === "build" || file === "coverage") continue;
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      walkDir(fullPath, fileList, filterFn);
    } else {
      if (!filterFn || filterFn(fullPath)) {
        fileList.push(fullPath);
      }
    }
  }
  return fileList;
}

async function scanDuplications() {
  const rootDir = path.join(__dirname, "..");
  console.log("Starting Full Codebase Duplication Audit in:", rootDir);

  const targets = [
    path.join(rootDir, "frontend/src"),
    path.join(rootDir, "backend/src"),
    path.join(rootDir, "scripts")
  ];

  const allFiles = [];
  for (const t of targets) {
    walkDir(t, allFiles, (p) => p.endsWith(".ts") || p.endsWith(".tsx") || p.endsWith(".js") || p.endsWith(".mjs"));
  }

  console.log(`Found ${allFiles.length} code files to analyze.`);

  // 1. Inspect Repositories
  const repoDir = path.join(rootDir, "frontend/src/lib/repositories");
  const repoFiles = fs.readdirSync(repoDir).filter(f => f.endsWith(".ts"));
  console.log(`\nInspecting ${repoFiles.length} repositories in frontend/src/lib/repositories:`, repoFiles);

  // 2. Inspect Services
  const servicesDir = path.join(rootDir, "frontend/src/lib/services");
  const serviceFiles = fs.existsSync(servicesDir) ? fs.readdirSync(servicesDir).filter(f => f.endsWith(".ts")) : [];
  console.log(`\nInspecting ${serviceFiles.length} services in frontend/src/lib/services:`, serviceFiles);

  // 3. Search for Function Definitions & Exported Symbols
  const symbolMap = new Map(); // name -> [{ file, line, kind }]

  for (const f of allFiles) {
    const rel = path.relative(rootDir, f).replace(/\\/g, "/");
    const content = fs.readFileSync(f, "utf8");
    const lines = content.split("\n");

    lines.forEach((line, idx) => {
      const lineNum = idx + 1;
      // Match export function / function / export class / export const
      const fnMatch = line.match(/(?:export\s+)?(?:async\s+)?function\s+([a-zA-Z0-9_$]+)\s*\(/);
      if (fnMatch) {
        const name = fnMatch[1];
        if (!symbolMap.has(name)) symbolMap.set(name, []);
        symbolMap.get(name).push({ file: rel, line: lineNum, kind: "function", signature: line.trim() });
      }

      const classMatch = line.match(/(?:export\s+)?class\s+([a-zA-Z0-9_$]+)/);
      if (classMatch) {
        const name = classMatch[1];
        if (!symbolMap.has(name)) symbolMap.set(name, []);
        symbolMap.get(name).push({ file: rel, line: lineNum, kind: "class", signature: line.trim() });
      }
    });
  }

  // Find symbols defined in multiple places
  const duplicates = [];
  for (const [name, occurrences] of symbolMap.entries()) {
    // Filter out common test/generic names like 'run', 'test', 'Record-Test'
    if (occurrences.length > 1 && !["run", "test", "init", "handler", "GET", "POST", "PUT", "DELETE", "PATCH"].includes(name)) {
      duplicates.push({ name, count: occurrences.length, occurrences });
    }
  }

  console.log(`\nIdentified ${duplicates.length} potentially duplicated function/class names across codebase.`);

  // Write symbol report
  fs.writeFileSync(
    path.join(__dirname, "symbol_duplication_scan.json"),
    JSON.stringify(duplicates, null, 2),
    "utf8"
  );

  console.log("Saved raw scan to scratch/symbol_duplication_scan.json");
}

scanDuplications().catch(err => {
  console.error("Scan error:", err);
  process.exit(1);
});
