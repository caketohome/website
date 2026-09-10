import * as fs from "fs";
import * as path from "path";

const FRONTEND_DIR = process.cwd();
const ROOT_DIR = path.resolve(FRONTEND_DIR, "..");
const OUTPUT_FILE = path.join(ROOT_DIR, "CLIENT-SERVER-AUDIT.md");

function scanForUseClientFiles(dir) {
  const files = [];
  function walk(d) {
    const entries = fs.readdirSync(d, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory() && e.name !== "node_modules" && e.name !== ".next" && e.name !== ".git") {
        walk(full);
      } else if (e.isFile() && /\.(tsx|ts|jsx|js)$/.test(e.name)) {
        const content = fs.readFileSync(full, "utf-8");
        if (content.slice(0, 150).includes("use client")) {
          files.push(full);
        }
      }
    }
  }
  walk(dir);
  return files;
}

function analyzeComponent(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const relPath = path.relative(FRONTEND_DIR, filePath).replace(/\\/g, "/");

  const hasHooks = /use(State|Effect|Callback|Memo|Ref|Context|Reducer|Id|Transition|DeferredValue|Router|Pathname|SearchParams)/.test(content);
  const hasEventHandlers = /on(Click|Change|Submit|KeyDown|KeyUp|KeyPress|MouseEnter|MouseLeave|Scroll|Focus|Blur)\s*=/.test(content);
  const hasBrowserGlobals = /\b(window|document|localStorage|sessionStorage|navigator|geolocation)\b/.test(content);
  const hasLeaflet = /leaflet|react-leaflet/.test(content);
  const hasExcel = /exceljs/.test(content);
  const hasLottie = /@dotlottie\/react-player|Lottie/.test(content);
  const hasFramer = /framer-motion/.test(content);
  const isPage = relPath.includes("/app/") && (relPath.endsWith("page.tsx") || relPath.endsWith("layout.tsx"));

  let classification = "KEEP CLIENT";
  let rationale = "";

  if (hasLeaflet || hasExcel || hasLottie) {
    classification = "DYNAMIC IMPORT";
    rationale = `Heavy library detected (${hasLeaflet ? "Leaflet " : ""}${hasExcel ? "ExcelJS " : ""}${hasLottie ? "Lottie" : ""}). Should be lazy-loaded via next/dynamic with ssr: false.`;
  } else if (isPage && !hasHooks && !hasBrowserGlobals) {
    classification = "PUSH CLIENT BOUNDARY DOWN";
    rationale = "Top-level route page/layout marked as client. Should be Server Component with interactive children pushed down.";
  } else if (!hasHooks && !hasEventHandlers && !hasBrowserGlobals && !hasFramer) {
    classification = "MOVE TO SERVER";
    rationale = "Pure presentational component with no React hooks, DOM events, or browser APIs. Safe to render as Server Component.";
  } else if (isPage && (hasHooks || hasEventHandlers)) {
    classification = "PUSH CLIENT BOUNDARY DOWN";
    rationale = "Page contains inline client state/handlers. Extract interactive logic into a leaf client component to allow page to remain RSC.";
  } else {
    classification = "KEEP CLIENT";
    rationale = `Legitimate client component using ${hasHooks ? "React hooks " : ""}${hasEventHandlers ? "event handlers " : ""}${hasBrowserGlobals ? "browser APIs " : ""}${hasFramer ? "animations" : ""}.`;
  }

  return {
    filePath: relPath,
    classification,
    rationale,
    hasHooks,
    hasEventHandlers,
    hasBrowserGlobals,
    hasLeaflet,
    hasExcel,
    hasLottie,
    hasFramer,
    isPage,
  };
}

async function runClientAudit() {
  console.log("==================================================");
  console.log("PHASE 4 — SERVER/CLIENT BOUNDARY COMPONENT AUDIT");
  console.log("==================================================");

  const clientFiles = scanForUseClientFiles(path.join(FRONTEND_DIR, "src"));
  console.log(`Found ${clientFiles.length} total "use client" files.`);

  const analyzed = clientFiles.map(analyzeComponent);

  const counts = {
    "KEEP CLIENT": 0,
    "PUSH CLIENT BOUNDARY DOWN": 0,
    "MOVE TO SERVER": 0,
    "DYNAMIC IMPORT": 0,
    "SHARED HEAVY COMPONENT": 0,
  };

  analyzed.forEach((a) => {
    counts[a.classification] = (counts[a.classification] || 0) + 1;
  });

  console.log("\nClassification Summary:");
  for (const [k, v] of Object.entries(counts)) {
    console.log(`  - ${k}: ${v} files`);
  }

  let md = `# CAKETOHOME SERVER/CLIENT BOUNDARY AUDIT (PHASE 4)
**Generated**: ${new Date().toISOString()}  
**Total "use client" Files Audited**: ${analyzed.length}  

---

## 1. Classification Summary

| Classification | File Count | Percentage | Action Plan |
| :--- | :--- | :--- | :--- |
| **KEEP CLIENT** | **${counts["KEEP CLIENT"]}** | ${Math.round((counts["KEEP CLIENT"] / analyzed.length) * 100)}% | Legitimate interactive leaves (forms, active buttons, state hooks). Retain as client components. |
| **PUSH CLIENT BOUNDARY DOWN** | **${counts["PUSH CLIENT BOUNDARY DOWN"]}** | ${Math.round((counts["PUSH CLIENT BOUNDARY DOWN"] / analyzed.length) * 100)}% | Route pages or large wrappers. Extract interactive parts to leaf components; convert wrapper to Server Component. |
| **MOVE TO SERVER** | **${counts["MOVE TO SERVER"]}** | ${Math.round((counts["MOVE TO SERVER"] / analyzed.length) * 100)}% | Static presentation components without state/hooks. Remove \`"use client"\` directive. |
| **DYNAMIC IMPORT** | **${counts["DYNAMIC IMPORT"]}** | ${Math.round((counts["DYNAMIC IMPORT"] / analyzed.length) * 100)}% | Heavy dependencies (Leaflet, ExcelJS, Lottie). Lazy-load with \`next/dynamic\` (\`ssr: false\`). |

---

## 2. High-Impact Refactoring Targets

### A. Dynamic Imports (Heavy Libraries)
These components bundle heavy JavaScript into the initial client graph. Converting them to \`next/dynamic\` saves hundreds of kilobytes:
`;

  analyzed
    .filter((a) => a.classification === "DYNAMIC IMPORT")
    .forEach((a) => {
      md += `- **\`${a.filePath}\`**: ${a.rationale}\n`;
    });

  md += `\n### B. Push Client Boundary Down (Route Pages & Layouts)
Converting these route wrappers to Server Components reduces initial hydration overhead:
`;

  analyzed
    .filter((a) => a.classification === "PUSH CLIENT BOUNDARY DOWN")
    .forEach((a) => {
      md += `- **\`${a.filePath}\`**: ${a.rationale}\n`;
    });

  md += `\n### C. Move to Server (Pure Presentational Components)
These components contain no hooks, events, or browser APIs and should be pure Server Components:
`;

  analyzed
    .filter((a) => a.classification === "MOVE TO SERVER")
    .forEach((a) => {
      md += `- **\`${a.filePath}\`**: ${a.rationale}\n`;
    });

  md += `\n---\n\n## 3. Complete Audit of All ${analyzed.length} Client Files\n\n| File Path | Classification | Hooks | Events | Browser APIs | Details |\n| :--- | :--- | :--- | :--- | :--- | :--- |\n`;

  analyzed.forEach((a) => {
    md += `| \`${a.filePath}\` | **${a.classification}** | ${a.hasHooks ? "✓" : "—"} | ${a.hasEventHandlers ? "✓" : "—"} | ${a.hasBrowserGlobals ? "✓" : "—"} | ${a.rationale} |\n`;
  });

  fs.writeFileSync(OUTPUT_FILE, md, "utf-8");
  console.log(`Client-server audit saved to ${OUTPUT_FILE}`);
}

runClientAudit().catch(console.error);
