import * as fs from "fs";
import * as path from "path";

interface Finding {
  file: string;
  line: number;
  snippet: string;
  loopType: string;
  asyncCall: string;
}

const ROOT_DIRS = [
  path.resolve(__dirname, "../../backend/src"),
  path.resolve(__dirname, "../../frontend/src"),
  path.resolve(__dirname, "../../apps/api/src"),
  path.resolve(__dirname, "../../packages"),
];

const findings: Finding[] = [];

function walkDir(dir: string, fileList: string[] = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const f of files) {
    if (f === "node_modules" || f === ".next" || f === "dist" || f === ".git" || f === "__tests__" || f === "test" || f === ".medusa") continue;
    const fullPath = path.join(dir, f);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      walkDir(fullPath, fileList);
    } else if (/\.(ts|tsx|js|mjs)$/.test(f)) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

function analyzeFile(filePath: string) {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");

  // Track loops: for, while, for...of, for...in, for await
  // Also track .map(async, .forEach(async
  let loopStack: { type: string; startLine: number; depth: number }[] = [];
  let currentBraceDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Check for start of loop or async iteration
    const isLoop = /\b(for\s*\(|for\s+await\s*\(|while\s*\(|(\.map|\.forEach|\.reduce)\s*\(\s*async)/i.test(trimmed);
    if (isLoop) {
      loopStack.push({
        type: trimmed.slice(0, 50),
        startLine: i + 1,
        depth: currentBraceDepth,
      });
    }

    // Check brace increments/decrements
    const openBraces = (line.match(/\{/g) || []).length;
    const closeBraces = (line.match(/\}/g) || []).length;
    currentBraceDepth += openBraces - closeBraces;

    // Pop loops that have exited
    while (loopStack.length > 0 && currentBraceDepth <= loopStack[loopStack.length - 1].depth && i > loopStack[loopStack.length - 1].startLine) {
      loopStack.pop();
    }

    // If inside a loop and line contains await
    if (loopStack.length > 0 && /\bawait\b/.test(line)) {
      // Exclude simple timer sleeps, setTimeout, etc.
      const isSleep = /await\s+(new\s+Promise.*setTimeout|sleep|delay)/i.test(line);
      if (!isSleep) {
        const currentLoop = loopStack[loopStack.length - 1];
        findings.push({
          file: path.relative(path.resolve(__dirname, "../../"), filePath),
          line: i + 1,
          snippet: trimmed.slice(0, 140),
          loopType: `${currentLoop.type} (line ${currentLoop.startLine})`,
          asyncCall: line.match(/await\s+([^\(\;\,\{\}]+)/)?.[1] || "await",
        });
      }
    }
  }
}

console.log("Starting repository-wide exhaustive loop await scan...");
let totalFiles = 0;
for (const r of ROOT_DIRS) {
  const files = walkDir(r);
  totalFiles += files.length;
  for (const f of files) {
    analyzeFile(f);
  }
}

console.log(`Scanned ${totalFiles} files.`);
console.log(`Found ${findings.length} loop-await occurrences.\n`);

// Group by directory/domain
const byDir: Record<string, Finding[]> = {};
for (const f of findings) {
  const topDir = f.file.split(/[\\/]/).slice(0, 2).join("/");
  byDir[topDir] = byDir[topDir] || [];
  byDir[topDir].push(f);
}

for (const [dir, list] of Object.entries(byDir)) {
  console.log(`\n=== Directory: ${dir} (${list.length} occurrences) ===`);
  for (const item of list) {
    console.log(`  [${item.file}:${item.line}]`);
    console.log(`    Loop: ${item.loopType}`);
    console.log(`    Code: ${item.snippet}`);
  }
}
