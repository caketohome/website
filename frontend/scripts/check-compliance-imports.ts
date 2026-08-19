import fs from "fs";
import path from "path";

const complianceDir = path.resolve(__dirname, "../src/components/dashboard/admin/compliance");
const files = fs.readdirSync(complianceDir);

console.log("Checking compliance tab files...");
files.forEach((f) => {
  const content = fs.readFileSync(path.join(complianceDir, f), "utf8");
  const lines = content.split("\n");
  const imports = lines.filter((l) => l.trim().startsWith("import ") || l.trim().startsWith("import("));
  console.log(`\nFile: ${f} (${lines.length} lines)`);
  imports.forEach((imp) => console.log(`  ${imp.trim()}`));

  // Check if any server imports exist
  const serverImports = imports.filter((i) => i.includes("fs") || i.includes("path") || i.includes("api-engine") || i.includes("server-only"));
  if (serverImports.length > 0) {
    console.error(`  ⚠️ POTENTIAL SERVER IMPORT in ${f}:`, serverImports);
  }
});
