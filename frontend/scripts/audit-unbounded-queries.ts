import * as fs from "fs";
import * as path from "path";

interface QueryFinding {
  filePath: string;
  lineNumber: number;
  snippet: string;
  hasLimit: boolean;
  tableOrSource: string;
}

const rootDirs = [
  path.resolve("e:/vig/cakes2home-main/cakes2home-main/frontend/src"),
  path.resolve("e:/vig/cakes2home-main/cakes2home-main/backend/src"),
];

const findings: QueryFinding[] = [];

function scanFile(filePath: string) {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const upper = line.toUpperCase();
    if (upper.includes("SELECT ") && (upper.includes(" FROM ") || upper.includes(" FROM\""))) {
      // Collect multi-line query string if template literal
      let queryBlock = line;
      let j = i;
      while (j < lines.length && !lines[j].includes("`") && !lines[j].includes(";") && (j - i) < 10) {
        j++;
        if (j < lines.length) queryBlock += " " + lines[j].trim();
      }

      const qUpper = queryBlock.toUpperCase();
      const hasLimit = qUpper.includes("LIMIT ");
      const fromMatch = queryBlock.match(/FROM\s+["']?([a-zA-Z0-9_\.]+)/i);
      const tableOrSource = fromMatch ? fromMatch[1] : "unknown";

      findings.push({
        filePath: path.relative("e:/vig/cakes2home-main/cakes2home-main", filePath).replace(/\\/g, "/"),
        lineNumber: i + 1,
        snippet: queryBlock.trim().replace(/\s+/g, " ").slice(0, 160),
        hasLimit,
        tableOrSource,
      });
    }
  }
}

function walkDir(dir: string) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules" && entry.name !== ".next" && entry.name !== ".git") {
        walkDir(fullPath);
      }
    } else if (/\.(ts|tsx|js|mjs)$/.test(entry.name)) {
      scanFile(fullPath);
    }
  }
}

for (const d of rootDirs) {
  if (fs.existsSync(d)) walkDir(d);
}

console.log(`\n=== SQL QUERY AUDIT FINDINGS (${findings.length} TOTAL) ===\n`);
const unbounded = findings.filter(f => !f.hasLimit);
console.log(`Unbounded Queries without LIMIT: ${unbounded.length}`);
console.log(`Bounded Queries with LIMIT: ${findings.length - unbounded.length}\n`);

console.log("--- UNBOUNDED SQL QUERIES ---");
for (const u of unbounded) {
  console.log(`[${u.filePath}:${u.lineNumber}] (${u.tableOrSource})`);
  console.log(`   ${u.snippet}\n`);
}
