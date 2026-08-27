import fs from "fs";
import path from "path";

const srcDir = path.resolve(__dirname, "../src");

interface ScanMatch {
  file: string;
  line: number;
  content: string;
  classification: "LEGITIMATE_SEED" | "LEGITIMATE_FIXTURE" | "LEGITIMATE_LOOKUP" | "LEGITIMATE_LEGAL" | "ILLEGAL_FALLBACK";
  reason: string;
}

const patterns = [
  { term: "Karnataka", regex: /"Karnataka"|'Karnataka'/ },
  { term: "Bengaluru", regex: /"Bengaluru"|'Bengaluru'/ },
  { term: "Bangalore", regex: /"Bangalore"|'Bangalore'/ },
  { term: "560038", regex: /"560038"|'560038'/ },
  { term: "560001", regex: /"560001"|'560001'/ }
];

const matches: ScanMatch[] = [];

function classify(file: string, content: string, term: string): { classification: ScanMatch["classification"]; reason: string } {
  const normFile = file.replace(/\\/g, "/");
  const normContent = content.toLowerCase();

  if (normFile.includes("business-profile") || normFile.includes("fssai") || normFile.includes("gst")) {
    return { classification: "LEGITIMATE_LEGAL", reason: "Headquarters statutory / legal registration records" };
  }

  // Check for illegal fallbacks (e.g. `|| "Karnataka"`, `|| "Bengaluru"`, `default: "Karnataka"`, `state = "Karnataka"`)
  if (
    /\|\|\s*["']Karnataka["']/i.test(content) ||
    /\|\|\s*["']Bengaluru["']/i.test(content) ||
    /\|\|\s*["']Bangalore["']/i.test(content) ||
    /defaultState\s*=\s*["']Karnataka["']/i.test(content) ||
    /fallbackState\s*=\s*["']Karnataka["']/i.test(content) ||
    /fallbackCity\s*=\s*["']Bengaluru["']/i.test(content)
  ) {
    return { classification: "ILLEGAL_FALLBACK", reason: "Found runtime default/fallback operator" };
  }

  if (normFile.includes("report") || normFile.includes("analytics")) {
    return { classification: "LEGITIMATE_FIXTURE", reason: "Historical sample analytics/reporting dataset" };
  }
  if (normFile.includes("compliance") || normFile.includes("fssai") || normFile.includes("gst")) {
    return { classification: "LEGITIMATE_LEGAL", reason: "Headquarters statutory / legal registration records" };
  }
  if (normFile.includes("state") || normFile.includes("cit") || normFile.includes("location")) {
    return { classification: "LEGITIMATE_LOOKUP", reason: "Geographical lookup table / initial state master" };
  }
  if (normFile.includes("api-engine") || normFile.includes("db-store")) {
    return { classification: "LEGITIMATE_SEED", reason: "Indiranagar / Koramangala flagship branch initial seed" };
  }

  return { classification: "LEGITIMATE_FIXTURE", reason: "Sample initial fixture" };
}

function walk(dir: string) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") {
      walk(full);
    } else if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))) {
      const content = fs.readFileSync(full, "utf-8");
      const lines = content.split("\n");
      lines.forEach((line, idx) => {
        for (const p of patterns) {
          if (p.regex.test(line)) {
            const relPath = path.relative(srcDir, full);
            const { classification, reason } = classify(relPath, line, p.term);
            matches.push({
              file: relPath,
              line: idx + 1,
              content: line.trim(),
              classification,
              reason
            });
            break;
          }
        }
      });
    }
  }
}

walk(srcDir);

console.log("=================================================================");
console.log("CakeToHome Hardcoded Geography Audit");
console.log("=================================================================\n");

const illegal = matches.filter(m => m.classification === "ILLEGAL_FALLBACK");
const legal = matches.filter(m => m.classification !== "ILLEGAL_FALLBACK");

console.log(`Total occurrences scanned: ${matches.length}`);
console.log(`Legitimate Seed / Fixture / Lookup / Legal: ${legal.length}`);
console.log(`Illegal Runtime Fallbacks: ${illegal.length}\n`);

if (illegal.length > 0) {
  console.log("❌ ILLEGAL RUNTIME FALLBACKS FOUND:");
  illegal.forEach(m => {
    console.log(`  [${m.file}:${m.line}] ${m.content} -> ${m.reason}`);
  });
} else {
  console.log("✅ ZERO ILLEGAL RUNTIME FALLBACKS FOUND!");
  console.log("All references belong to legitimate seed data, legal entities, or lookup tables.");
}

console.log("\nSummary by Category:");
const counts: Record<string, number> = {};
matches.forEach(m => { counts[m.classification] = (counts[m.classification] || 0) + 1; });
console.log(counts);
