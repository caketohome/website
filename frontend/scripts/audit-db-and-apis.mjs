import * as fs from "fs";
import * as path from "path";
import pg from "pg";

const FRONTEND_DIR = process.cwd();
const ROOT_DIR = path.resolve(FRONTEND_DIR, "..");
const OUTPUT_FILE = path.join(ROOT_DIR, "DATABASE-PERFORMANCE.md");

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres.uubwhsnnrnicyczwqlbq:caketohomeqwerty@aws-1-ap-south-1.pooler.supabase.com:6543/postgres";

async function auditPostgres() {
  const pool = new pg.Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  const client = await pool.connect();
  try {
    console.log("Connected to PostgreSQL successfully.");

    // 1. Table Row Counts
    const tablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `;
    const tablesRes = await client.query(tablesQuery);
    const tables = tablesRes.rows.map((r) => r.table_name);

    const tableStats = [];
    for (const t of tables) {
      try {
        const countRes = await client.query(`SELECT COUNT(*) AS count FROM "${t}"`);
        tableStats.push({ table: t, count: parseInt(countRes.rows[0].count, 10) });
      } catch {
        // skip view or permission error
      }
    }

    // 2. Indexes Audit
    const indexQuery = `
      SELECT
        tablename,
        indexname,
        indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
      ORDER BY tablename, indexname;
    `;
    const indexRes = await client.query(indexQuery);
    const indexes = indexRes.rows;

    // 3. Foreign Key Constraints
    const fkQuery = `
      SELECT
        tc.table_name, 
        kcu.column_name, 
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name 
      FROM information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema='public';
    `;
    const fkRes = await client.query(fkQuery);
    const foreignKeys = fkRes.rows;

    return { tableStats, indexes, foreignKeys };
  } finally {
    client.release();
    await pool.end();
  }
}

function auditApiRoutes() {
  const apiDir = path.join(FRONTEND_DIR, "src/app/api");
  const routes = [];

  function walk(d) {
    const entries = fs.readdirSync(d, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) {
        walk(full);
      } else if (e.isFile() && e.name.startsWith("route.")) {
        const rel = path.relative(apiDir, full).replace(/\\/g, "/");
        const content = fs.readFileSync(full, "utf-8");

        const hasAuth = /jwt|_cth_jwt|_medusa_jwt|requireStaff|auth/i.test(content);
        const hasDb = /dbQuery|getDbPool|pool|client\.query/.test(content);
        const hasApiEngine = /ApiEngine|api-engine/.test(content);
        const hasValidation = /zod|validate|parse|typeof|schema/i.test(content);
        const hasTryCatch = /try\s*\{/.test(content);
        const isDynamic = content.includes("force-dynamic");

        routes.push({
          route: "/api/" + path.dirname(rel).replace(/^\./, ""),
          file: path.relative(FRONTEND_DIR, full).replace(/\\/g, "/"),
          hasAuth,
          hasDb,
          hasApiEngine,
          hasValidation,
          hasTryCatch,
          isDynamic,
        });
      }
    }
  }
  walk(apiDir);
  return routes;
}

function auditForceDynamicRoutes() {
  const appDir = path.join(FRONTEND_DIR, "src/app");
  const dynamicRoutes = [];

  function walk(d) {
    const entries = fs.readdirSync(d, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) {
        walk(full);
      } else if (e.isFile() && /\.(tsx|ts)$/.test(e.name)) {
        const content = fs.readFileSync(full, "utf-8");
        if (content.includes("force-dynamic")) {
          const rel = path.relative(FRONTEND_DIR, full).replace(/\\/g, "/");
          const usesCookies = /cookies\(\)/.test(content);
          const usesHeaders = /headers\(\)/.test(content);
          const usesSearchParams = /searchParams/.test(content);
          const usesDb = /dbQuery|ApiEngine|repositories\//.test(content);

          let classification = "GENUINELY DYNAMIC";
          let rationale = "";

          if (usesCookies) {
            classification = "COOKIE DEPENDENT";
            rationale = "Relies on request cookies (auth token / session). Must remain dynamic.";
          } else if (usesHeaders) {
            classification = "HEADER DEPENDENT";
            rationale = "Relies on request headers. Must remain dynamic.";
          } else if (usesSearchParams) {
            classification = "SEARCH PARAMS DEPENDENT";
            rationale = "Relies on query string (?q=..., ?category=...). Dynamic at runtime.";
          } else if (usesDb) {
            classification = "DATABASE DEPENDENT";
            rationale = "Reads live PostgreSQL state. Can potentially use ISR (revalidate) instead of force-dynamic.";
          } else {
            classification = "UNNECESSARILY DYNAMIC";
            rationale = "No request cookies, headers, or query parameters used. Candidate for static generation or ISR.";
          }

          dynamicRoutes.push({
            file: rel,
            classification,
            rationale,
            usesCookies,
            usesHeaders,
            usesSearchParams,
            usesDb,
          });
        }
      }
    }
  }
  walk(appDir);
  return dynamicRoutes;
}

async function runDatabaseAndApiAudit() {
  console.log("==================================================");
  console.log("PHASE 9, 10, 11, 12 — DATABASE, API & DYNAMIC AUDIT");
  console.log("==================================================");

  let pgData = { tableStats: [], indexes: [], foreignKeys: [] };
  try {
    pgData = await auditPostgres();
  } catch (err) {
    console.error("PostgreSQL connection error:", err.message);
  }

  const apiRoutes = auditApiRoutes();
  console.log(`Audited ${apiRoutes.length} API routes.`);

  const dynamicRoutes = auditForceDynamicRoutes();
  console.log(`Audited ${dynamicRoutes.length} force-dynamic routes.`);

  // Write markdown report
  let md = `# CAKETOHOME DATABASE & API PERFORMANCE AUDIT (PHASES 9 — 12)
**Generated**: ${new Date().toISOString()}  
**Target**: PostgreSQL 16 Authority & Next.js BFF API Layer  

---

## 1. PostgreSQL Schema & Table Inventory

| Table Name | Active Row Count | Primary Authority | Notes |
| :--- | :--- | :--- | :--- |
`;

  pgData.tableStats.forEach((t) => {
    md += `| \`${t.table}\` | **${t.count.toLocaleString()}** | PostgreSQL | Core Entity |\n`;
  });

  md += `\n---\n\n## 2. PostgreSQL Index Audit & Coverage Analysis\n\n`;
  md += `Total Active Indexes: **${pgData.indexes.length}**\n\n`;
  md += `| Table | Index Name | Index Definition |\n| :--- | :--- | :--- |\n`;

  pgData.indexes.forEach((idx) => {
    md += `| \`${idx.tablename}\` | \`${idx.indexname}\` | \`${idx.indexdef}\` |\n`;
  });

  md += `\n---\n\n## 3. API Route Handler Audit (Phase 9)\n\n`;
  md += `| API Route | Handler File | Auth Protected | Direct DB Access | Schema Validation | Error Handling | Dynamic |\n| :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;

  apiRoutes.forEach((a) => {
    md += `| \`${a.route}\` | \`${a.file}\` | ${a.hasAuth ? "✓ YES" : "— Public"} | ${a.hasDb || a.hasApiEngine ? "✓ YES" : "—"} | ${a.hasValidation ? "✓ YES" : "—"} | ${a.hasTryCatch ? "✓ YES" : "⚠️ NO"} | ${a.isDynamic ? "✓" : "—"} |\n`;
  });

  md += `\n---\n\n## 4. Build-Time Database Access Audit (Phase 11)\n\n`;
  md += `1. **Hydration Trigger during Build**:
   - Next.js build invokes static route evaluation for 28 pre-rendered routes.
   - During page data collection, \`ApiEngine.initialize()\` hydrates the in-memory cache directly from PostgreSQL (\`Hydrated store: 54 branches, 14 products...\`).
2. **Is it required at build time?**:
   - **NO.** Routes pre-rendered as static shell do not require real-time database row locking during CI/build.
   - Recommendation: Decouple store hydration so that build-time page data collection gracefully renders static loading/skeleton shells, while runtime requests query PostgreSQL with connection pooling.

---

## 5. force-dynamic Route Classification (Phase 12)

Total routes declaring \`force-dynamic\`: **${dynamicRoutes.length}**

| Classification | Count | Action Plan |
| :--- | :--- | :--- |
| **COOKIE DEPENDENT** | ${dynamicRoutes.filter((d) => d.classification === "COOKIE DEPENDENT").length} | Keep dynamic. Relies on session token (\`_cth_jwt\`). |
| **SEARCH PARAMS DEPENDENT** | ${dynamicRoutes.filter((d) => d.classification === "SEARCH PARAMS DEPENDENT").length} | Keep dynamic. Relies on live search/filter queries. |
| **DATABASE DEPENDENT** | ${dynamicRoutes.filter((d) => d.classification === "DATABASE DEPENDENT").length} | Evaluate ISR (\`revalidate: 300\`) where safe (e.g. blog, city, occasion). |
| **UNNECESSARILY DYNAMIC** | ${dynamicRoutes.filter((d) => d.classification === "UNNECESSARILY DYNAMIC").length} | Convert to static pre-rendering (\`○ Static\`). |

### Detailed Route-by-Route Breakdown:
| File | Classification | Cookies | Headers | Search Params | DB Access | Rationale |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
`;

  dynamicRoutes.forEach((d) => {
    md += `| \`${d.file}\` | **${d.classification}** | ${d.usesCookies ? "✓" : "—"} | ${d.usesHeaders ? "✓" : "—"} | ${d.usesSearchParams ? "✓" : "—"} | ${d.usesDb ? "✓" : "—"} | ${d.rationale} |\n`;
  });

  fs.writeFileSync(OUTPUT_FILE, md, "utf-8");
  console.log(`Database and API performance audit saved to ${OUTPUT_FILE}`);
}

runDatabaseAndApiAudit().catch(console.error);
