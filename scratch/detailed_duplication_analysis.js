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

async function analyzeDetailedDuplications() {
  const rootDir = path.join(__dirname, "..");
  const srcDir = path.join(rootDir, "frontend/src");
  console.log("Analyzing detailed duplications in:", srcDir);

  const allFiles = walkDir(srcDir, [], (p) => p.endsWith(".ts") || p.endsWith(".tsx"));

  // 1. Check Haversine / Distance calculation duplication
  const haversineMatches = [];
  // 2. Check Order Total calculation duplication
  const totalCalcMatches = [];
  // 3. Check Session / Auth token signing / decoding
  const jwtMatches = [];
  // 4. Check Branch timing / slot generation
  const slotMatches = [];
  // 5. Check Data layer vs Repository callers
  const dataImports = new Map(); // importPath -> [files]

  for (const file of allFiles) {
    const rel = path.relative(rootDir, file).replace(/\\/g, "/");
    const content = fs.readFileSync(file, "utf8");
    const lines = content.split("\n");

    lines.forEach((line, idx) => {
      const lineNum = idx + 1;

      // Haversine / Distance
      if (/(Math\.atan2|Math\.sin\(dLat|6371|3958\.8)/.test(line) && !line.includes("//")) {
        haversineMatches.push({ file: rel, line: lineNum, snippet: line.trim() });
      }

      // Order total calculation
      if (/subtotal\s*\+\s*deliveryFee|items\.reduce\(.*price\s*\*/.test(line) && !line.includes("//")) {
        totalCalcMatches.push({ file: rel, line: lineNum, snippet: line.trim() });
      }

      // JWT or token creation
      if (/(jwt\.sign|createHmac\(["']sha256["']\)|base64url)/i.test(line) && !line.includes("//") && !line.includes("test")) {
        jwtMatches.push({ file: rel, line: lineNum, snippet: line.trim() });
      }

      // Slot generator
      if (/getDeliverySlots|generateDeliverySlots|formatSlot/i.test(line) && /function|const|class/.test(line)) {
        slotMatches.push({ file: rel, line: lineNum, snippet: line.trim() });
      }

      // Imports from lib/data/
      const importMatch = line.match(/from\s+["'](@frontend\/lib\/data\/[^"']+|(?:\.\.\/)+lib\/data\/[^"']+)["']/);
      if (importMatch) {
        const imp = importMatch[1];
        if (!dataImports.has(imp)) dataImports.set(imp, []);
        dataImports.get(imp).push(rel);
      }
    });
  }

  console.log(`\n1. Haversine distance calculations found in ${haversineMatches.length} places.`);
  console.log(`2. Order total formulas found in ${totalCalcMatches.length} places.`);
  console.log(`3. Token HMAC / signing operations found in ${jwtMatches.length} places.`);
  console.log(`4. Slot calculation functions found in ${slotMatches.length} places.`);
  console.log(`5. Discovered ${dataImports.size} unique data helper imports.`);

  const summary = {
    haversine_distance: haversineMatches,
    order_totals: totalCalcMatches,
    jwt_and_token: jwtMatches,
    delivery_slots: slotMatches,
    data_imports: Object.fromEntries(dataImports.entries())
  };

  fs.writeFileSync(
    path.join(__dirname, "detailed_duplication_summary.json"),
    JSON.stringify(summary, null, 2),
    "utf8"
  );
  console.log("Saved summary to scratch/detailed_duplication_summary.json");
}

analyzeDetailedDuplications().catch(err => {
  console.error(err);
  process.exit(1);
});
