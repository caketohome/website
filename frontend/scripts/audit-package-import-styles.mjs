import fs from "fs";
import path from "path";

const SRC_DIR = path.resolve("e:/vig/cakes2home-main/cakes2home-main/frontend/src");

function scanDir(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...scanDir(full));
    } else if (/\.(tsx|ts|jsx|js)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

const allFiles = scanDir(SRC_DIR);

function analyzePackage(pkgName) {
  let importingFiles = 0;
  let barrelImports = 0;
  let directImports = 0;
  let clientImports = 0;
  let serverImports = 0;
  const importedMembers = new Set();
  const sampleImports = [];

  for (const file of allFiles) {
    const content = fs.readFileSync(file, "utf-8");
    const isClient = content.includes('"use client"') || content.includes("'use client'");

    // Match import statements
    const regex = new RegExp(`import\\s+(?:(\\{[^\\}]+\\})|([^\\s]+))\\s+from\\s+['"](${pkgName}(?:/[^'"]*)?)['"]`, "g");
    let match;
    let fileImported = false;

    while ((match = regex.exec(content)) !== null) {
      fileImported = true;
      const namedImports = match[1];
      const defaultImport = match[2];
      const importPath = match[3];

      if (importPath === pkgName) {
        barrelImports++;
        if (namedImports) {
          namedImports
            .replace(/[{}]/g, "")
            .split(",")
            .map((s) => s.trim().split(/\s+as\s+/)[0])
            .filter(Boolean)
            .forEach((m) => importedMembers.add(m));
        }
      } else {
        directImports++;
      }

      if (sampleImports.length < 5) {
        sampleImports.push({ file: path.relative(SRC_DIR, file), statement: match[0] });
      }
    }

    if (fileImported) {
      importingFiles++;
      if (isClient) clientImports++;
      else serverImports++;
    }
  }

  return {
    pkgName,
    importingFiles,
    clientImports,
    serverImports,
    barrelImports,
    directImports,
    uniqueMembersCount: importedMembers.size,
    sampleImports,
    uniqueMembers: Array.from(importedMembers).slice(0, 20),
  };
}

const packages = ["lucide-react", "@medusajs/ui", "@medusajs/icons"];
const analysis = packages.map(analyzePackage);

console.log("==================================================");
console.log("PACKAGE IMPORT STYLE AUDIT");
console.log("==================================================");
for (const res of analysis) {
  console.log(`\nPackage: ${res.pkgName}`);
  console.log(`  Total Importing Files: ${res.importingFiles}`);
  console.log(`  Client Files:          ${res.clientImports}`);
  console.log(`  Server Files:          ${res.serverImports}`);
  console.log(`  Barrel Imports:        ${res.barrelImports}`);
  console.log(`  Direct Path Imports:   ${res.directImports}`);
  console.log(`  Unique Members Used:   ${res.uniqueMembersCount}`);
  console.log(`  Sample Members:        ${res.uniqueMembers.join(", ")}`);
  console.log(`  Sample Usage:`);
  res.sampleImports.forEach((s) => console.log(`    [${s.file}]: ${s.statement}`));
}

fs.writeFileSync(
  path.resolve("e:/vig/cakes2home-main/cakes2home-main/frontend/scripts/package-import-analysis.json"),
  JSON.stringify(analysis, null, 2)
);
