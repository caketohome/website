import * as fs from "fs";
import * as path from "path";
import * as zlib from "zlib";

const FRONTEND_DIR = process.cwd();
const NEXT_DIR = path.join(FRONTEND_DIR, ".next");
const STATIC_CHUNKS_DIR = path.join(NEXT_DIR, "static", "chunks");

interface ChunkInfo {
  filename: string;
  relPath: string;
  uncompressedBytes: number;
  uncompressedKB: number;
  gzipBytes: number;
  gzipKB: number;
  type: "framework" | "main" | "shared-vendor" | "app-page" | "app-component" | "other";
}

function analyzeChunks(): ChunkInfo[] {
  if (!fs.existsSync(STATIC_CHUNKS_DIR)) return [];

  const chunks: ChunkInfo[] = [];
  function walk(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile() && entry.name.endsWith(".js")) {
        const buf = fs.readFileSync(full);
        const gz = zlib.gzipSync(buf);
        const rel = path.relative(STATIC_CHUNKS_DIR, full).replace(/\\/g, "/");

        let type: ChunkInfo["type"] = "other";
        if (rel.includes("framework") || entry.name.includes("framework")) type = "framework";
        else if (rel.includes("main") || entry.name.includes("main")) type = "main";
        else if (rel.startsWith("app/")) type = "app-page";
        else if (entry.name.startsWith("webpack-")) type = "framework";
        else if (/^\d+-[a-f0-9]+\.js$/.test(entry.name)) type = "shared-vendor";
        else if (/^[a-f0-9]{8,}\.js$/.test(entry.name)) type = "shared-vendor";

        chunks.push({
          filename: entry.name,
          relPath: rel,
          uncompressedBytes: buf.length,
          uncompressedKB: Number((buf.length / 1024).toFixed(1)),
          gzipBytes: gz.length,
          gzipKB: Number((gz.length / 1024).toFixed(1)),
          type,
        });
      }
    }
  }

  walk(STATIC_CHUNKS_DIR);
  return chunks.sort((a, b) => b.uncompressedBytes - a.uncompressedBytes);
}

function analyzeManifests() {
  const appManifestPath = path.join(NEXT_DIR, "app-build-manifest.json");
  const buildManifestPath = path.join(NEXT_DIR, "build-manifest.json");

  let appManifest: any = {};
  let buildManifest: any = {};

  if (fs.existsSync(appManifestPath)) {
    appManifest = JSON.parse(fs.readFileSync(appManifestPath, "utf-8"));
  }
  if (fs.existsSync(buildManifestPath)) {
    buildManifest = JSON.parse(fs.readFileSync(buildManifestPath, "utf-8"));
  }

  return { appManifest, buildManifest };
}

function findImports(targetPkg: string) {
  const srcDir = path.join(FRONTEND_DIR, "src");
  const matches: { file: string; isClient: boolean; line: string }[] = [];

  function walk(dir: string) {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        walk(full);
      } else if (/\.(tsx|ts|jsx|js)$/.test(e.name)) {
        const content = fs.readFileSync(full, "utf-8");
        const lines = content.split("\n");
        const isClient = content.slice(0, 200).includes("use client");
        for (const line of lines) {
          if (line.includes(`from "${targetPkg}`) || line.includes(`from '${targetPkg}`)) {
            matches.push({
              file: path.relative(FRONTEND_DIR, full).replace(/\\/g, "/"),
              isClient,
              line: line.trim(),
            });
          }
        }
      }
    }
  }
  walk(srcDir);
  return matches;
}

function analyzeBarrelExports() {
  const srcDir = path.join(FRONTEND_DIR, "src");
  const barrels: { file: string; exportsCount: number; exports: string[] }[] = [];

  function walk(dir: string) {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        walk(full);
      } else if (e.name === "index.ts" || e.name === "index.tsx") {
        const content = fs.readFileSync(full, "utf-8");
        const exportLines = content
          .split("\n")
          .filter((l) => l.trim().startsWith("export *") || l.trim().startsWith("export {"));
        if (exportLines.length > 0) {
          barrels.push({
            file: path.relative(FRONTEND_DIR, full).replace(/\\/g, "/"),
            exportsCount: exportLines.length,
            exports: exportLines.slice(0, 10),
          });
        }
      }
    }
  }
  walk(srcDir);
  return barrels;
}

async function main() {
  console.log("==================================================");
  console.log("PHASE 8.5 FORENSIC BUNDLE AUDIT & CHUNK ANALYSIS");
  console.log("==================================================");

  const chunks = analyzeChunks();
  console.log(`Total generated JS chunks: ${chunks.length}`);
  const totalUncomp = chunks.reduce((acc, c) => acc + c.uncompressedBytes, 0);
  const totalGzip = chunks.reduce((acc, c) => acc + c.gzipBytes, 0);
  console.log(`Total JS uncompressed: ${(totalUncomp / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Total JS gzip: ${(totalGzip / 1024 / 1024).toFixed(2)} MB`);

  console.log("\n--- Top 15 Largest Chunks (Uncompressed / Gzip) ---");
  chunks.slice(0, 15).forEach((c, idx) => {
    console.log(
      `${idx + 1}. [${c.type}] ${c.relPath}: ${c.uncompressedKB} KB uncompressed (${c.gzipKB} KB gzip)`
    );
  });

  const { appManifest } = analyzeManifests();
  console.log("\n--- Storefront Routes Chunk Analysis from App Manifest ---");
  const pages = appManifest.pages || {};
  const storefrontKeyRoutes = [
    "/page",
    "/(store)/[slug]/page",
    "/cart/page",
    "/checkout/page",
    "/products/page",
    "/products/[id]/page",
    "/account/page",
    "/account/orders/page",
    "/compare/page",
  ];

  for (const r of storefrontKeyRoutes) {
    const chunkList: string[] = pages[r] || [];
    let totalUncompRoute = 0;
    let totalGzipRoute = 0;
    const chunkDetails: { name: string; uncompKB: number; gzipKB: number }[] = [];

    for (const ch of chunkList) {
      const full = path.join(NEXT_DIR, ch);
      if (fs.existsSync(full)) {
        const buf = fs.readFileSync(full);
        const gz = zlib.gzipSync(buf);
        totalUncompRoute += buf.length;
        totalGzipRoute += gz.length;
        chunkDetails.push({
          name: path.basename(ch),
          uncompKB: Number((buf.length / 1024).toFixed(1)),
          gzipKB: Number((gz.length / 1024).toFixed(1)),
        });
      }
    }

    console.log(`\nRoute: ${r}`);
    console.log(`  Total Chunks: ${chunkList.length}`);
    console.log(`  Initial JS (Gzip / Transfer): ${(totalGzipRoute / 1024).toFixed(1)} KB`);
    console.log(`  Initial JS (Uncompressed / Parsed): ${(totalUncompRoute / 1024).toFixed(1)} KB`);
    console.log(`  Largest Chunks in Route:`);
    chunkDetails
      .sort((a, b) => b.uncompKB - a.uncompKB)
      .slice(0, 4)
      .forEach((cd) => console.log(`    - ${cd.name}: ${cd.uncompKB} KB (${cd.gzipKB} KB gzip)`));
  }

  console.log("\n--- Heavy Third-Party Libraries Usage ---");
  const heavyLibs = [
    "leaflet",
    "react-leaflet",
    "exceljs",
    "@dotlottie/react-player",
    "@medusajs/ui",
    "@medusajs/icons",
    "lucide-react",
  ];

  for (const lib of heavyLibs) {
    const imports = findImports(lib);
    console.log(`\nLibrary '${lib}': ${imports.length} imports`);
    imports.forEach((imp) => {
      console.log(`  [${imp.isClient ? "CLIENT" : "SERVER"}] ${imp.file}`);
    });
  }

  console.log("\n--- Barrel Exports Audit ---");
  const barrels = analyzeBarrelExports();
  console.log(`Found ${barrels.length} barrel files:`);
  barrels.forEach((b) => {
    console.log(`  ${b.file} (${b.exportsCount} export statements)`);
  });
}

main().catch(console.error);
