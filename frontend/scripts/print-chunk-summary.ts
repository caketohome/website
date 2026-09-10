import * as fs from "fs";
import * as path from "path";
import * as zlib from "zlib";

const FRONTEND_DIR = process.cwd();
const NEXT_DIR = path.join(FRONTEND_DIR, ".next");
const STATIC_CHUNKS_DIR = path.join(NEXT_DIR, "static", "chunks");

function getChunks() {
  const chunks: { name: string; rel: string; rawKB: number; gzKB: number }[] = [];
  function walk(d: string) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name.endsWith(".js")) {
        const buf = fs.readFileSync(full);
        const gz = zlib.gzipSync(buf);
        chunks.push({
          name: e.name,
          rel: path.relative(STATIC_CHUNKS_DIR, full).replace(/\\/g, "/"),
          rawKB: Number((buf.length / 1024).toFixed(1)),
          gzKB: Number((gz.length / 1024).toFixed(1)),
        });
      }
    }
  }
  walk(STATIC_CHUNKS_DIR);
  return chunks.sort((a, b) => b.rawKB - a.rawKB);
}

function getAppManifestRoutes() {
  const appManifest = JSON.parse(fs.readFileSync(path.join(NEXT_DIR, "app-build-manifest.json"), "utf-8"));
  const routes = appManifest.pages || {};
  const results: { route: string; chunksCount: number; rawKB: number; gzKB: number; chunks: string[] }[] = [];

  for (const [r, chunkList] of Object.entries(routes)) {
    let rawTotal = 0;
    let gzTotal = 0;
    const names: string[] = [];
    for (const ch of (chunkList as string[])) {
      const full = path.join(NEXT_DIR, ch);
      if (fs.existsSync(full)) {
        const buf = fs.readFileSync(full);
        const gz = zlib.gzipSync(buf);
        rawTotal += buf.length;
        gzTotal += gz.length;
        names.push(`${path.basename(ch)} (${(gz.length / 1024).toFixed(1)}k gz)`);
      }
    }
    results.push({
      route: r,
      chunksCount: (chunkList as string[]).length,
      rawKB: Number((rawTotal / 1024).toFixed(1)),
      gzKB: Number((gzTotal / 1024).toFixed(1)),
      chunks: names,
    });
  }
  return results.sort((a, b) => b.rawKB - a.rawKB);
}

const chunks = getChunks();
console.log("=== TOP 20 LARGEST CHUNKS IN .NEXT/STATIC/CHUNKS ===");
chunks.slice(0, 20).forEach((c, idx) => {
  console.log(`${idx + 1}. ${c.rel}: ${c.rawKB} KB uncompressed (${c.gzKB} KB gzip)`);
});

const routes = getAppManifestRoutes();
console.log("\n=== ALL APP ROUTE PAYLOADS (GZIP TRANSFER & RAW PARSED) ===");
routes.forEach((r) => {
  console.log(`${r.route.padEnd(35)} -> Gzip: ${r.gzKB} KB | Raw: ${r.rawKB} KB (${r.chunksCount} chunks)`);
});
