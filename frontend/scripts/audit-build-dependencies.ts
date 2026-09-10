import * as fs from "fs";
import * as path from "path";

interface RouteInfo {
  filePath: string;
  routePath: string;
  type: "page" | "layout" | "route_handler" | "sitemap" | "robots" | "loading" | "error" | "not_found";
  isClientComponent: boolean;
  hasGenerateStaticParams: boolean;
  hasGenerateMetadata: boolean;
  hasForceDynamic: boolean;
  hasRevalidate: boolean;
  importsDb: boolean;
  importsApiEngine: boolean;
  heavyImports: string[];
}

function scanAppDir(dir: string, baseDir: string = dir): RouteInfo[] {
  const results: RouteInfo[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...scanAppDir(fullPath, baseDir));
    } else if (entry.isFile() && /\.(tsx|ts|js|jsx)$/.test(entry.name)) {
      const relPath = path.relative(baseDir, fullPath).replace(/\\/g, "/");
      const content = fs.readFileSync(fullPath, "utf-8");

      let type: RouteInfo["type"] = "page";
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
      const importsApiEngine = content.includes("ApiEngine");

      const heavyDeps = ["exceljs", "leaflet", "react-leaflet", "lucide-react", "@medusajs/ui", "sharp", "jose", "@dotlottie/react-player"];
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

function countUseClientFiles(dir: string): { total: number; clientFiles: string[] } {
  const clientFiles: string[] = [];
  function walk(d: string) {
    const entries = fs.readdirSync(d, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory() && e.name !== "node_modules" && e.name !== ".next" && e.name !== ".git") {
        walk(full);
      } else if (e.isFile() && /\.(tsx|ts|jsx|js)$/.test(e.name)) {
        const content = fs.readFileSync(full, "utf-8");
        if (content.slice(0, 100).includes("use client")) {
          clientFiles.push(path.relative(dir, full).replace(/\\/g, "/"));
        }
      }
    }
  }
  walk(dir);
  return { total: clientFiles.length, clientFiles };
}

async function runStaticRouteAudit() {
  console.log("==================================================");
  console.log("5, 6, 7, 8. STATIC ROUTE, DB & BUNDLE DEPENDENCY AUDIT");
  console.log("==================================================");

  const appDir = path.join(process.cwd(), "src", "app");
  const routes = scanAppDir(appDir);

  const pages = routes.filter(r => r.type === "page");
  const apiRoutes = routes.filter(r => r.type === "route_handler");
  const layouts = routes.filter(r => r.type === "layout");

  console.log(`\n--- Route Breakdown ---`);
  console.log(`Total App Files Scanned: ${routes.length}`);
  console.log(`Page Routes (page.tsx):  ${pages.length}`);
  console.log(`API Route Handlers:      ${apiRoutes.length}`);
  console.log(`Layouts:                 ${layouts.length}`);

  console.log(`\n--- Build-Time Database / API Engine Access in Routes ---`);
  const dbAccessRoutes = routes.filter(r => r.importsDb || r.importsApiEngine);
  console.log(`Routes importing DB or ApiEngine directly: ${dbAccessRoutes.length}`);
  dbAccessRoutes.forEach(r => {
    console.log(`  - [${r.type}] ${r.routePath} (${r.filePath}) -> DB: ${r.importsDb}, ApiEngine: ${r.importsApiEngine}`);
  });

  console.log(`\n--- Dynamic vs Static Generation Markers ---`);
  const forceDynamic = routes.filter(r => r.hasForceDynamic);
  const staticParams = routes.filter(r => r.hasGenerateStaticParams);
  console.log(`Routes with 'force-dynamic':       ${forceDynamic.length}`);
  forceDynamic.forEach(r => console.log(`  - ${r.routePath} (${r.filePath})`));
  console.log(`Routes with 'generateStaticParams': ${staticParams.length}`);
  staticParams.forEach(r => console.log(`  - ${r.routePath} (${r.filePath})`));

  console.log(`\n--- Client Component ("use client") Analysis ---`);
  const clientInfo = countUseClientFiles(path.join(process.cwd(), "src"));
  console.log(`Total "use client" files across entire src: ${clientInfo.total}`);

  console.log(`\n--- Heavy Library Client Imports ---`);
  const heavyClientRoutes = routes.filter(r => r.isClientComponent && r.heavyImports.length > 0);
  console.log(`Client route files importing heavy dependencies: ${heavyClientRoutes.length}`);
  heavyClientRoutes.forEach(r => {
    console.log(`  - ${r.filePath} imports [${r.heavyImports.join(", ")}]`);
  });
}

runStaticRouteAudit().catch(console.error);
