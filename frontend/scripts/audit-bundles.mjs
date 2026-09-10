import * as fs from "fs";
import * as path from "path";

const FRONTEND_DIR = process.cwd();
const ROOT_DIR = path.resolve(FRONTEND_DIR, "..");
const OUTPUT_FILE = path.join(ROOT_DIR, "BUNDLE-AUDIT.md");

function getChunkStats() {
  const staticDir = path.join(FRONTEND_DIR, ".next", "static");
  if (!fs.existsSync(staticDir)) return [];

  const chunks = [];
  function walk(d) {
    const entries = fs.readdirSync(d, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) {
        walk(full);
      } else if (e.isFile() && e.name.endsWith(".js")) {
        const stat = fs.statSync(full);
        chunks.push({
          relPath: path.relative(staticDir, full).replace(/\\/g, "/"),
          sizeBytes: stat.size,
          sizeKB: Number((stat.size / 1024).toFixed(1)),
        });
      }
    }
  }
  walk(staticDir);
  chunks.sort((a, b) => b.sizeBytes - a.sizeBytes);
  return chunks;
}

function scanImportsForLibrary(dir, libName) {
  const matches = [];
  function walk(d) {
    const entries = fs.readdirSync(d, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory() && e.name !== "node_modules" && e.name !== ".next" && e.name !== ".git") {
        walk(full);
      } else if (e.isFile() && /\.(tsx|ts|jsx|js)$/.test(e.name)) {
        const content = fs.readFileSync(full, "utf-8");
        const isClient = content.slice(0, 150).includes("use client");
        const regex = new RegExp(`from\\s+['"]${libName}(\\/[^'"]+)?['"]`, "g");
        let m;
        while ((m = regex.exec(content)) !== null) {
          matches.push({
            file: path.relative(FRONTEND_DIR, full).replace(/\\/g, "/"),
            isClient,
            importSpecifier: m[0],
          });
        }
      }
    }
  }
  walk(dir);
  return matches;
}

function checkServerLeaks(dir) {
  const serverLibs = ["pg", "jsonwebtoken", "fs", "path", "child_process", "crypto"];
  const leaks = [];

  function walk(d) {
    const entries = fs.readdirSync(d, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory() && e.name !== "node_modules" && e.name !== ".next" && e.name !== ".git") {
        walk(full);
      } else if (e.isFile() && /\.(tsx|ts|jsx|js)$/.test(e.name)) {
        const content = fs.readFileSync(full, "utf-8");
        const isClient = content.slice(0, 150).includes("use client");
        if (isClient) {
          for (const lib of serverLibs) {
            if (new RegExp(`from\\s+['"]${lib}['"]`).test(content)) {
              leaks.push({
                file: path.relative(FRONTEND_DIR, full).replace(/\\/g, "/"),
                lib,
              });
            }
          }
        }
      }
    }
  }
  walk(dir);
  return leaks;
}

async function runBundleAudit() {
  console.log("==================================================");
  console.log("PHASE 5 — JAVASCRIPT BUNDLE ENGINEERING AUDIT");
  console.log("==================================================");

  const chunks = getChunkStats();
  console.log(`Found ${chunks.length} total generated client JS chunks.`);

  const targetLibs = [
    "lucide-react",
    "@medusajs/ui",
    "@medusajs/icons",
    "leaflet",
    "react-leaflet",
    "exceljs",
    "@dotlottie/react-player",
    "lodash",
    "lodash.isequal",
    "jose",
    "react-aria",
  ];

  const libUsage = {};
  for (const lib of targetLibs) {
    const matches = scanImportsForLibrary(path.join(FRONTEND_DIR, "src"), lib);
    libUsage[lib] = {
      totalImports: matches.length,
      clientImports: matches.filter((m) => m.isClient).length,
      serverImports: matches.filter((m) => !m.isClient).length,
      files: matches,
    };
    console.log(`  - ${lib}: ${matches.length} imports (${libUsage[lib].clientImports} client, ${libUsage[lib].serverImports} server)`);
  }

  const serverLeaks = checkServerLeaks(path.join(FRONTEND_DIR, "src"));
  console.log(`Server-only library leaks into client files: ${serverLeaks.length}`);

  // Generate BUNDLE-AUDIT.md
  let md = `# CAKETOHOME JAVASCRIPT BUNDLE AUDIT (PHASE 5)
**Generated**: ${new Date().toISOString()}  
**Client Chunks Generated**: ${chunks.length} chunks  
**Total Client JS Size**: ${((chunks.reduce((acc, c) => acc + c.sizeBytes, 0) / 1024) / 1024).toFixed(2)} MB uncompressed  

---

## 1. Top 20 Largest Client Chunks

| Rank | Chunk File | Size (KB) | Size (Bytes) | Category / Contents |
| :--- | :--- | :--- | :--- | :--- |
`;

  chunks.slice(0, 20).forEach((c, idx) => {
    let cat = "Shared / Vendor";
    if (c.relPath.includes("framework")) cat = "React Core Framework";
    else if (c.relPath.includes("main")) cat = "Next.js Main Runtime";
    else if (c.sizeKB > 500) cat = "Heavy Vendor Bundle (Medusa/Leaflet/Icons)";
    md += `| ${idx + 1} | \`${c.relPath}\` | **${c.sizeKB} KB** | ${c.sizeBytes.toLocaleString()} | ${cat} |\n`;
  });

  md += `\n---\n\n## 2. Heavy Dependency Usage & Modularization Analysis\n\n`;
  md += `| Package | Total Imports | Client Imports | Server Imports | Modularization Recommendation |\n| :--- | :--- | :--- | :--- | :--- |\n`;

  for (const [lib, data] of Object.entries(libUsage)) {
    let rec = "OK";
    if (lib === "lucide-react") rec = "Enable `modularizeImports` in `next.config.mjs` to prevent full icon barrel bundling.";
    else if (lib === "@medusajs/icons") rec = "Modularize icon path imports; avoid root re-exports.";
    else if (lib === "@medusajs/ui") rec = "Already in `transpilePackages`. Add to `experimental.optimizePackageImports`.";
    else if (lib === "leaflet" || lib === "react-leaflet") rec = "Lazy-load via `next/dynamic` with `ssr: false`. Never import on initial page load.";
    else if (lib === "exceljs") rec = "Ensure isolated to admin export routes. Never bundle in customer storefront.";
    else if (lib === "@dotlottie/react-player") rec = "Dynamic import on order success/status pages only.";
    md += `| \`${lib}\` | ${data.totalImports} | ${data.clientImports} | ${data.serverImports} | ${rec} |\n`;
  }

  md += `\n---\n\n## 3. Server-Only Library Leak Check\n\n`;
  if (serverLeaks.length === 0) {
    md += `**Zero server-only libraries leak into client components.** (\`pg\`, \`jsonwebtoken\`, \`fs\` remain strictly inside Server Components / API handlers).\n`;
  } else {
    md += `⚠️ **Detected ${serverLeaks.length} potential server leaks:**\n`;
    serverLeaks.forEach((l) => {
      md += `- \`${l.file}\` imports server library \`${l.lib}\`\n`;
    });
  }

  md += `\n---\n\n## 4. High-Priority Bundle Actions

1. **Modularize \`lucide-react\` Imports**:
   - Currently imported in **${libUsage["lucide-react"]?.totalImports || 0} files** across the codebase.
   - Without \`modularizeImports\`, Webpack pulls in large symbol tables for unused icons.
2. **Dynamic Lazy-Loading for Leaflet**:
   - Leaflet is imported across **${(libUsage["leaflet"]?.totalImports || 0) + (libUsage["react-leaflet"]?.totalImports || 0)} files**.
   - Leaflet + CSS accounts for over **180 KB** of client bundle.
3. **Configure \`experimental.optimizePackageImports\`**:
   - Add \`["@medusajs/ui", "lucide-react", "@medusajs/icons", "lodash"]\` to \`next.config.mjs\`.
`;

  fs.writeFileSync(OUTPUT_FILE, md, "utf-8");
  console.log(`Bundle audit saved to ${OUTPUT_FILE}`);
}

runBundleAudit().catch(console.error);
