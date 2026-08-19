import fs from "fs";
import path from "path";

const complianceDir = path.resolve(__dirname, "../src/components/dashboard/admin/compliance");
const files = fs.readdirSync(complianceDir);

files.forEach((f) => {
  const content = fs.readFileSync(path.join(complianceDir, f), "utf8");
  const firstLine = content.split("\n")[0].trim();
  console.log(`${f}: First line is "${firstLine}"`);
  if (!firstLine.includes('"use client"') && !firstLine.includes("'use client'")) {
    console.log(`  -> Missing "use client" in ${f}`);
  }
});

const settingsPanelContent = fs.readFileSync(path.resolve(__dirname, "../src/components/dashboard/admin/settings-panel.tsx"), "utf8");
console.log(`settings-panel.tsx: First line is "${settingsPanelContent.split("\n")[0].trim()}"`);
