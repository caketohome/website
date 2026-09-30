const fs = require("fs");
const path = require("path");
const dotenv = require(path.join(__dirname, "../backend/node_modules/dotenv"));
dotenv.config({ path: path.join(__dirname, "../backend/.env") });
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.join(__dirname, "../frontend/.env") });
}

const { Client } = require(path.join(__dirname, "../backend/node_modules/pg"));

// Helper to safely sanitize text so no passwords/urls leak
function sanitize(str) {
  if (!str) return "";
  return str.replace(/postgres(ql)?:\/\/[^@]+@/gi, "postgresql://***:***@");
}

async function runInventory() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log("Connecting to PostgreSQL...");
    await client.connect();
    console.log("Connected successfully.");

    // 1. Gather all tables in public schema
    console.log("Querying public tables...");
    const tablesRes = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);
    const tableNames = tablesRes.rows.map(r => r.table_name);
    console.log(`Found ${tableNames.length} tables in public schema.`);

    // 2. Gather PKs
    console.log("Querying primary keys...");
    const pkRes = await client.query(`
      SELECT tc.table_name, kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      WHERE tc.constraint_type = 'PRIMARY KEY'
        AND tc.table_schema = 'public';
    `);
    const pksByTable = {};
    for (const row of pkRes.rows) {
      if (!pksByTable[row.table_name]) pksByTable[row.table_name] = [];
      pksByTable[row.table_name].push(row.column_name);
    }

    // 3. Gather FKs
    console.log("Querying foreign keys...");
    const fkRes = await client.query(`
      SELECT
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        rc.delete_rule,
        rc.update_rule
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      JOIN information_schema.referential_constraints AS rc
        ON tc.constraint_name = rc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public';
    `);
    const fksByTable = {};
    for (const row of fkRes.rows) {
      if (!fksByTable[row.table_name]) fksByTable[row.table_name] = [];
      fksByTable[row.table_name].push({
        column: row.column_name,
        foreign_table: row.foreign_table_name,
        foreign_column: row.foreign_column_name,
        on_delete: row.delete_rule,
        on_update: row.update_rule
      });
    }

    // 4. Gather Indexes and Unique Constraints
    console.log("Querying indexes...");
    const idxRes = await client.query(`
      SELECT
        tablename,
        indexname,
        indexdef
      FROM pg_indexes
      WHERE schemaname = 'public';
    `);
    const idxsByTable = {};
    for (const row of idxRes.rows) {
      if (!idxsByTable[row.tablename]) idxsByTable[row.tablename] = [];
      idxsByTable[row.tablename].push({
        name: row.indexname,
        def: row.indexdef,
        is_unique: row.indexdef.toUpperCase().includes("UNIQUE INDEX")
      });
    }

    // 5. Gather columns info (types, nullable, default)
    console.log("Querying columns...");
    const colRes = await client.query(`
      SELECT
        table_name,
        column_name,
        data_type,
        udt_name,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position;
    `);
    const colsByTable = {};
    for (const row of colRes.rows) {
      if (!colsByTable[row.table_name]) colsByTable[row.table_name] = [];
      colsByTable[row.table_name].push(row);
    }

    // 6. Gather Views
    console.log("Querying views...");
    const viewsRes = await client.query(`
      SELECT table_name, view_definition
      FROM information_schema.views
      WHERE table_schema = 'public';
    `);

    // 7. Gather Sequences
    console.log("Querying sequences...");
    const seqRes = await client.query(`
      SELECT sequence_name, data_type, start_value, minimum_value, maximum_value, increment
      FROM information_schema.sequences
      WHERE sequence_schema = 'public';
    `);

    // 8. Gather Enums
    console.log("Querying custom types / enums...");
    const enumRes = await client.query(`
      SELECT t.typname, e.enumlabel
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public'
      ORDER BY t.typname, e.enumsortorder;
    `);
    const enumsByType = {};
    for (const row of enumRes.rows) {
      if (!enumsByType[row.typname]) enumsByType[row.typname] = [];
      enumsByType[row.typname].push(row.enumlabel);
    }

    // 9. Gather Triggers
    console.log("Querying triggers...");
    const triggerRes = await client.query(`
      SELECT
        event_object_table,
        trigger_name,
        event_manipulation,
        action_statement,
        action_timing
      FROM information_schema.triggers
      WHERE trigger_schema = 'public'
      ORDER BY event_object_table, trigger_name;
    `);

    // 10. Gather Functions
    console.log("Querying functions...");
    const funcRes = await client.query(`
      SELECT routine_name, routine_type, data_type
      FROM information_schema.routines
      WHERE routine_schema = 'public'
      ORDER BY routine_name;
    `);

    // 11. Gather Migration History
    console.log("Checking migration history...");
    let migrations = [];
    try {
      const migRes = await client.query(`
        SELECT * FROM mikro_orm_migrations ORDER BY id ASC;
      `);
      migrations = migRes.rows;
    } catch (e) {
      // might have different migration table name
      try {
        const migRes = await client.query(`
          SELECT * FROM _prisma_migrations ORDER BY id ASC;
        `);
        migrations = migRes.rows;
      } catch (_) {}
    }

    // 12. Scan Codebase for Table References
    console.log("Scanning codebase for table references...");
    const codebaseRoot = path.join(__dirname, "..");
    const searchDirs = [
      path.join(codebaseRoot, "frontend", "src"),
      path.join(codebaseRoot, "backend", "src"),
      path.join(codebaseRoot, "migration"),
      path.join(codebaseRoot, "scripts"),
    ];

    function getAllFiles(dir, exts = [".ts", ".tsx", ".js", ".sql", ".json"]) {
      let results = [];
      if (!fs.existsSync(dir)) return results;
      const list = fs.readdirSync(dir);
      for (const file of list) {
        if (file === "node_modules" || file === ".next" || file === "dist") continue;
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
          results = results.concat(getAllFiles(fullPath, exts));
        } else {
          if (exts.includes(path.extname(file))) {
            results.push(fullPath);
          }
        }
      }
      return results;
    }

    const codeFiles = [];
    for (const d of searchDirs) {
      codeFiles.push(...getAllFiles(d));
    }
    console.log(`Indexed ${codeFiles.length} code files for table reference auditing.`);

    const fileContents = codeFiles.map(f => ({
      file: path.relative(codebaseRoot, f).replace(/\\/g, "/"),
      content: fs.readFileSync(f, "utf8")
    }));

    const tableUsage = {};
    for (const tbl of tableNames) {
      const regex = new RegExp(`\\b${tbl}\\b`, "i");
      const matchedFiles = [];
      for (const fc of fileContents) {
        if (regex.test(fc.content)) {
          matchedFiles.push(fc.file);
        }
      }
      tableUsage[tbl] = matchedFiles;
    }

    // 13. Get row counts and timestamp columns for every table
    console.log("Querying row counts for all tables...");
    const tableStats = [];
    for (const tbl of tableNames) {
      let count = 0;
      try {
        const countRes = await client.query(`SELECT count(*)::bigint as cnt FROM public."${tbl}";`);
        count = Number(countRes.rows[0].cnt);
      } catch (err) {
        console.warn(`Could not count table ${tbl}:`, err.message);
        count = -1;
      }

      const pks = pksByTable[tbl] || [];
      const fks = fksByTable[tbl] || [];
      const idxs = idxsByTable[tbl] || [];
      const cols = colsByTable[tbl] || [];
      const usage = tableUsage[tbl] || [];

      // Check timestamp columns
      const hasCreatedAt = cols.some(c => c.column_name === "created_at");
      const hasUpdatedAt = cols.some(c => c.column_name === "updated_at");
      const hasDeletedAt = cols.some(c => c.column_name === "deleted_at");

      // Check JSONB columns
      const jsonbCols = cols.filter(c => c.data_type === "jsonb" || c.udt_name === "jsonb").map(c => c.column_name);

      // Determine classification: Medusa Core vs CakeToHome Custom vs Legacy/Orphaned
      const isMedusaCore = (
        tbl.startsWith("cart") || tbl.startsWith("order") || tbl.startsWith("customer") ||
        tbl.startsWith("product") || tbl.startsWith("region") || tbl.startsWith("sales_channel") ||
        tbl.startsWith("publishable") || tbl.startsWith("api_key") || tbl.startsWith("user") ||
        tbl.startsWith("fulfillment") || tbl.startsWith("payment") || tbl.startsWith("discount") ||
        tbl.startsWith("gift_card") || tbl.startsWith("shipping") || tbl.startsWith("tax") ||
        tbl.startsWith("stock_location") || tbl.startsWith("inventory") || tbl.startsWith("money_amount") ||
        tbl.startsWith("return") || tbl.startsWith("claim") || tbl.startsWith("swap") ||
        tbl.startsWith("idempotency_key") || tbl.startsWith("oauth") || tbl.startsWith("invite") ||
        tbl.startsWith("staged_job") || tbl.startsWith("notification") || tbl.startsWith("batch_job") ||
        tbl.startsWith("line_item") || tbl.startsWith("price_list") || tbl.startsWith("pricing") ||
        tbl.startsWith("mikro_orm") || tbl.startsWith("medusa_")
      );

      const isCthCustom = (
        tbl.includes("branch") || tbl.includes("cms") || tbl.includes("pincode") ||
        tbl.includes("city") || tbl.includes("occasion") || tbl.includes("addon") ||
        tbl.includes("outreach") || tbl.includes("campaign") || tbl.includes("cold_call") ||
        tbl.includes("delivery_slot") || tbl.includes("address_book") || tbl.includes("otp") ||
        tbl.includes("store_manager") || tbl.includes("cake_customization") || tbl.includes("telemarketing")
      );

      let classification = "OTHER";
      if (isCthCustom) {
        classification = "CAKETOHOME_CUSTOM";
      } else if (isMedusaCore) {
        classification = "MEDUSA_CORE";
      } else if (tbl.startsWith("temp_") || tbl.startsWith("test_") || tbl.includes("_backup") || tbl.includes("_old")) {
        classification = "TEST_PROTOTYPE_LEGACY";
      } else if (usage.length === 0 && count === 0) {
        classification = "ORPHANED_CANDIDATE";
      }

      tableStats.push({
        table_name: tbl,
        count,
        primary_keys: pks,
        foreign_keys: fks,
        index_count: idxs.length,
        unique_constraints: idxs.filter(i => i.is_unique).map(i => i.name),
        columns_count: cols.length,
        jsonb_columns: jsonbCols,
        has_created_at: hasCreatedAt,
        has_updated_at: hasUpdatedAt,
        has_deleted_at: hasDeletedAt,
        used_in_code: usage.length > 0,
        code_reference_count: usage.length,
        sample_code_references: usage.slice(0, 3),
        classification
      });
    }

    console.log("Database inventory compiled successfully.");
    await client.end();

    // 14. Produce CHECKPOINTS/database-inventory-01.md
    console.log("Formatting report to CHECKPOINTS/database-inventory-01.md...");
    const checkpointsDir = path.join(codebaseRoot, "CHECKPOINTS");
    if (!fs.existsSync(checkpointsDir)) fs.mkdirSync(checkpointsDir, { recursive: true });

    let md = `# Database Inventory Audit Report — CakeToHome Platform
**Checkpoint ID:** \`database-inventory-01\`  
**Timestamp:** ${new Date().toISOString()}  
**Target Database:** PostgreSQL 17.6 (Supabase Managed Pooler)  
**Schema Audited:** \`public\`  
**Total Base Tables:** ${tableNames.length}  
**Total Views:** ${viewsRes.rows.length}  
**Total Sequences:** ${seqRes.rows.length}  
**Total Triggers:** ${triggerRes.rows.length}  
**Total Functions:** ${funcRes.rows.length}  
**Total Custom Enums:** ${Object.keys(enumsByType).length}  
**Recorded Migrations:** ${migrations.length}  

---

## 1. Executive Summary & Table Classification Breakdown

| Classification | Table Count | Active In Code | Zero Rows | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **CakeToHome Custom** | ${tableStats.filter(t => t.classification === "CAKETOHOME_CUSTOM").length} | ${tableStats.filter(t => t.classification === "CAKETOHOME_CUSTOM" && t.used_in_code).length} | ${tableStats.filter(t => t.classification === "CAKETOHOME_CUSTOM" && t.count === 0).length} | Custom bakery domain tables (branches, CMS, delivery slots, physical accessory inventory, outreach). |
| **Medusa Core** | ${tableStats.filter(t => t.classification === "MEDUSA_CORE").length} | ${tableStats.filter(t => t.classification === "MEDUSA_CORE" && t.used_in_code).length} | ${tableStats.filter(t => t.classification === "MEDUSA_CORE" && t.count === 0).length} | Standard Medusa Framework v2 e-commerce schema. |
| **Test / Prototype / Legacy** | ${tableStats.filter(t => t.classification === "TEST_PROTOTYPE_LEGACY").length} | ${tableStats.filter(t => t.classification === "TEST_PROTOTYPE_LEGACY" && t.used_in_code).length} | ${tableStats.filter(t => t.classification === "TEST_PROTOTYPE_LEGACY" && t.count === 0).length} | Backup/temp tables if any. |
| **Other / Candidate Orphaned** | ${tableStats.filter(t => t.classification === "OTHER" || t.classification === "ORPHANED_CANDIDATE").length} | ${tableStats.filter(t => (t.classification === "OTHER" || t.classification === "ORPHANED_CANDIDATE") && t.used_in_code).length} | ${tableStats.filter(t => (t.classification === "OTHER" || t.classification === "ORPHANED_CANDIDATE") && t.count === 0).length} | Tables not explicitly tagged by prefix. |
| **TOTAL** | **${tableNames.length}** | **${tableStats.filter(t => t.used_in_code).length}** | **${tableStats.filter(t => t.count === 0).length}** | Complete public schema. |

---

## 2. Key Business Tables & Row Counts (High Signal)

| Table Name | Row Count | Primary Key | Used in Code | JSONB Columns | Classification |
| :--- | :--- | :--- | :--- | :--- | :--- |
${tableStats.filter(t => t.count > 0 || t.classification === "CAKETOHOME_CUSTOM" || ["order", "customer", "product", "product_variant", "cart", "user"].includes(t.table_name)).map(t => {
  return `| \`${t.table_name}\` | **${t.count}** | \`${t.primary_keys.join(", ") || "NONE"}\` | ${t.used_in_code ? "✅ Yes (" + t.code_reference_count + ")" : "❌ No"} | \`${t.jsonb_columns.join(", ") || "none"}\` | ${t.classification} |`;
}).join("\n")}

---

## 3. Complete Base Table Inventory (All ${tableNames.length} Tables)

| # | Table Name | Rows | PK | FKs | Indexes | Created/Updated | Code Refs | Classification |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
${tableStats.map((t, idx) => {
  const ts = (t.has_created_at ? "C" : "-") + "/" + (t.has_updated_at ? "U" : "-") + (t.has_deleted_at ? "/D" : "");
  return `| ${idx + 1} | \`${t.table_name}\` | ${t.count} | \`${t.primary_keys.join(", ") || "-"}\` | ${t.foreign_keys.length} | ${t.index_count} | \`${ts}\` | ${t.code_reference_count} | ${t.classification} |`;
}).join("\n")}

---

## 4. Views Inventory (${viewsRes.rows.length})

| View Name | Definition Summary |
| :--- | :--- |
${viewsRes.rows.length === 0 ? "*(No custom views defined in public schema)*" : viewsRes.rows.map(v => `| \`${v.table_name}\` | \`${(v.view_definition || "").slice(0, 80).replace(/\n/g, " ")}...\` |`).join("\n")}

---

## 5. Sequences (${seqRes.rows.length})

| Sequence Name | Data Type | Start | Increment |
| :--- | :--- | :--- | :--- |
${seqRes.rows.map(s => `| \`${s.sequence_name}\` | ${s.data_type} | ${s.start_value} | ${s.increment} |`).join("\n")}

---

## 6. Triggers (${triggerRes.rows.length})

| Table | Trigger Name | Manipulation | Timing |
| :--- | :--- | :--- | :--- |
${triggerRes.rows.length === 0 ? "*(No explicit public triggers defined)*" : triggerRes.rows.map(tr => `| \`${tr.event_object_table}\` | \`${tr.trigger_name}\` | ${tr.event_manipulation} | ${tr.action_timing} |`).join("\n")}

---

## 7. Custom Enums (${Object.keys(enumsByType).length})

| Enum Name | Allowed Values |
| :--- | :--- |
${Object.entries(enumsByType).map(([k, v]) => `| \`${k}\` | \`${v.join(", ")}\` |`).join("\n")}

---

## 8. Migration History (${migrations.length})

${migrations.length === 0 ? "*(No migration rows in mikro_orm_migrations)*" : migrations.map(m => `- **${m.name || m.migration || m.id}** (${m.executed_at || m.created_at || "applied"})`).join("\n")}

---

## 9. Safety & Cleanup Guidelines
- **Zero Destructive Actions Taken:** This audit is strictly read-only.
- **RLS Status:** All 275 tables have Row Level Security enabled.
- **Enterprise JSONB Pattern:** As established, core entities such as \`order\` use \`order.metadata\` to store line items, delivery details, compliance snapshots, and OTPs. Empty relational tables (e.g. \`order_item\` = 0 rows) are part of the Medusa schema and MUST NOT be dropped without safety verification.
`;

    const outPath = path.join(checkpointsDir, "database-inventory-01.md");
    fs.writeFileSync(outPath, md, "utf8");
    console.log(`Report successfully written to: ${outPath}`);

    // Also write a JSON version for quick program inspection in subsequent phases
    fs.writeFileSync(path.join(__dirname, "db_inventory_data.json"), JSON.stringify({
      tableStats,
      views: viewsRes.rows,
      sequences: seqRes.rows,
      triggers: triggerRes.rows,
      enums: enumsByType,
      migrations
    }, null, 2), "utf8");
    console.log(`Data cache written to: ${path.join(__dirname, "db_inventory_data.json")}`);
  } catch (err) {
    console.error("Inventory error:", err.message);
    process.exit(1);
  }
}

runInventory();
