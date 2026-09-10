import * as fs from "fs";
import * as path from "path";

function scanAppDir(dir, baseDir = dir) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...scanAppDir(fullPath, baseDir));
    } else if (entry.isFile() && /\.(tsx|ts|js|jsx)$/.test(entry.name)) {
      const relPath = path.relative(baseDir, fullPath).replace(/\\/g, "/");
      const content = fs.readFileSync(fullPath, "utf-8");

      let type = "page";
      if (entry.name.startsWith("layout")) type = "layout";
      else if (entry.name.startsWith("route")) type = "route_handler";
      else if (entry.name.startsWith("sitemap")) type = "sitemap";
      else if (entry.name.startsWith("robots")) type = "robots";
      else if (entry.name.startsWith("loading")) type = "loading";
      else if (entry.name.startsWith("error")) type = "error";
      else if (entry.name.startsWith("not-found")) type = "not_found";

      // Compute route path
      let routePath = "/" + path.dirname(relPath).replace(/^\./, "");
      routePath = routePath.replace(/\/\([^)]+\)/g, ""); // remove route groups like (store), (dashboard)
      if (routePath === "") routePath = "/";
      if (entry.name.startsWith("route")) routePath = "/api" + routePath.replace(/^\/api/, "");

      const isClientComponent = content.includes('"use client"') || content.includes("'use client'");
      const hasGenerateStaticParams = content.includes("generateStaticParams");
      const hasGenerateMetadata = content.includes("generateMetadata");
      const hasForceDynamic = content.includes("force-dynamic");
      const hasRevalidate = content.includes("revalidate");
      const importsDb = content.includes("dbQuery") || content.includes("/db") || content.includes("repositories/");
      const importsApiEngine = content.includes("ApiEngine") || content.includes("api-engine");

      const heavyDeps = ["exceljs", "leaflet", "react-leaflet", "lucide-react", "@medusajs/ui", "sharp", "jose", "@dotlottie/react-player", "framer-motion", "three"];
      const heavyImports = heavyDeps.filter(d => content.includes(`from "${d}"`) || content.includes(`from '${d}'`));

      results.push({
        filePath: relPath,
        routePath,
        type,
        isClientComponent,
        hasGenerateStaticParams,
        hasGenerateMetadata,
        hasForceDynamic,
        hasRevalidate,
        importsDb,
        importsApiEngine,
        heavyImports,
      });
    }
  }

  return results;
}

function countUseClientFiles(dir) {
  const clientFiles = [];
  function walk(d) {
    const entries = fs.readdirSync(d, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory() && e.name !== "node_modules" && e.name !== ".next" && e.name !== ".git") {
        walk(full);
      } else if (e.isFile() && /\.(tsx|ts|jsx|js)$/.test(e.name)) {
        const content = fs.readFileSync(full, "utf-8");
        if (content.slice(0, 150).includes("use client")) {
          clientFiles.push(path.relative(dir, full).replace(/\\/g, "/"));
        }
      }
    }
  }
  walk(dir);
  return { total: clientFiles.length, clientFiles };
}

function analyzeBundleStats() {
  const nextStaticDir = path.join(process.cwd(), ".next", "static");
  if (!fs.existsSync(nextStaticDir)) return null;

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
          name: path.relative(nextStaticDir, full).replace(/\\/g, "/"),
          sizeKB: Math.round(stat.size / 1024),
          sizeBytes: stat.size
        });
      }
    }
  }
  walk(nextStaticDir);
  chunks.sort((a, b) => b.sizeBytes - a.sizeBytes);
  return chunks;
}

async function runStaticRouteAudit() {
  console.log("==================================================");
  console.log("ROUTE, DB, CLIENT COMPONENT & BUNDLE AUDIT");
  console.log("==================================================");

  const appDir = path.join(process.cwd(), "src", "app");
  const routes = scanAppDir(appDir);

  const pages = routes.filter(r => r.type === "page");
  const apiRoutes = routes.filter(r => r.type === "route_handler");
  const layouts = routes.filter(r => r.type === "layout");
  const sitemaps = routes.filter(r => r.type === "sitemap");
  const robots = routes.filter(r => r.type === "robots");

  console.log(`\n--- 1. Route Breakdown ---`);
  console.log(`Total App Files Scanned: ${routes.length}`);
  console.log(`Page Routes (page.tsx):  ${pages.length}`);
  console.log(`API Route Handlers:      ${apiRoutes.length}`);
  console.log(`Layouts:                 ${layouts.length}`);
  console.log(`Sitemap / Robots:        ${sitemaps.length + robots.length}`);

  console.log(`\n--- 2. Build-Time Database / API Engine Access in Routes ---`);
  const dbAccessRoutes = routes.filter(r => r.importsDb || r.importsApiEngine);
  console.log(`Routes importing DB or ApiEngine: ${dbAccessRoutes.length}`);
  dbAccessRoutes.forEach(r => {
    console.log(`  - [${r.type}] ${r.routePath} (${r.filePath}) -> DB: ${r.importsDb}, ApiEngine: ${r.importsApiEngine}`);
  });

  console.log(`\n--- 3. Static vs Dynamic Route Markers ---`);
  const forceDynamic = routes.filter(r => r.hasForceDynamic);
  const staticParams = routes.filter(r => r.hasGenerateStaticParams);
  const revalidateRoutes = routes.filter(r => r.hasRevalidate);
  console.log(`Routes with 'force-dynamic':       ${forceDynamic.length}`);
  forceDynamic.forEach(r => console.log(`  - ${r.routePath} (${r.filePath})`));
  console.log(`Routes with 'generateStaticParams': ${staticParams.length}`);
  staticParams.forEach(r => console.log(`  - ${r.routePath} (${r.filePath})`));
  console.log(`Routes with 'revalidate':          ${revalidateRoutes.length}`);
  revalidateRoutes.forEach(r => console.log(`  - ${r.routePath} (${r.filePath})`));

  console.log(`\n--- 4. Client Component ("use client") Analysis ---`);
  const clientInfo = countUseClientFiles(path.join(process.cwd(), "src"));
  console.log(`Total "use client" files across entire src: ${clientInfo.total}`);

  console.log(`\n--- 5. Heavy Library Client Imports ---`);
  const heavyClientRoutes = routes.filter(r => r.isClientComponent && r.heavyImports.length > 0);
  console.log(`Client route files importing heavy dependencies: ${heavyClientRoutes.length}`);
  heavyClientRoutes.forEach(r => {
    console.log(`  - ${r.filePath} imports [${r.heavyImports.join(", ")}]`);
  });

  console.log(`\n--- 6. Largest Client Chunks (.next/static) ---`);
  const chunks = analyzeBundleStats();
  if (chunks) {
    console.log(`Top 15 Largest Client Chunks:`);
    chunks.slice(0, 15).forEach((c, i) => {
      console.log(`  ${i + 1}. ${c.name}: ${c.sizeKB} KB (${c.sizeBytes.toLocaleString()} bytes)`);
    });
  }
}

runStaticRouteAudit().catch(console.error);
