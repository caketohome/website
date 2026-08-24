import fs from "fs";
import path from "path";

function scanDir(dir: string, depth = 0) {
  if (!fs.existsSync(dir)) return;
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const full = path.join(dir, item);
    const stat = fs.statSync(full);
    const indent = "  ".repeat(depth);
    if (stat.isDirectory()) {
      console.log(`${indent}📁 ${item}/`);
      if (depth < 4) scanDir(full, depth + 1);
    } else {
      console.log(`${indent}📄 ${item} (${stat.size}B) - mod: ${stat.mtime.toISOString()}`);
    }
  }
}

console.log("=== SCANNING .next/static/chunks ===");
scanDir(path.resolve("./.next/static/chunks"));

console.log("\n=== SCANNING .next/server/app ===");
scanDir(path.resolve("./.next/server/app"));
