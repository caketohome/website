import { Client } from "pg";
import { OrderRepository } from "../src/lib/repositories/order.repository";
import { closeDbPool } from "../src/lib/db";

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres.uubwhsnnrnicyczwqlbq:caketohomeqwerty@aws-1-ap-south-1.pooler.supabase.com:6543/postgres";

const safetyTimeout = setTimeout(() => {
  console.error("[TIMEOUT] investigate-zero-totals timed out after 15s");
  process.exit(1);
}, 15000);
safetyTimeout.unref();

async function run() {
  const client = new Client({
    connectionString,
    ssl: connectionString.includes("supabase") ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 8000,
  });

  try {
    await client.connect();

    // Query 15 real orders covering diverse timeframes and statuses
    const res = await client.query(`
      SELECT id, display_id, status, created_at, metadata
      FROM "order"
      WHERE deleted_at IS NULL
      ORDER BY created_at DESC
      LIMIT 15;
    `);

    console.log(`\n================================================================================`);
    console.log(`FORENSIC FINANCIAL CLASSIFICATION OF 15 REAL ORDERS FROM POSTGRESQL`);
    console.log(`================================================================================`);

    const summaryTable: any[] = [];

    for (const [idx, row] of res.rows.entries()) {
      const meta = row.metadata || {};
      const rawItems: any[] = Array.isArray(meta.items) ? meta.items : [];

      const dbMetaTotal = meta.total ?? meta.grand_total ?? meta.total_amount ?? null;
      const dbMetaSubtotal = meta.subtotal ?? null;
      const dbMetaDiscount = meta.discount_amount ?? meta.discount ?? null;
      const dbMetaTax = meta.tax_amount ?? meta.tax_total ?? null;
      const dbMetaDelivery = meta.delivery?.fee ?? meta.delivery_fee ?? null;

      let itemCalculatedSubtotal = 0;
      let itemCalculatedTax = 0;
      for (const item of rawItems) {
        const qty = Number(item.quantity ?? 1);
        const up = Number(item.unit_price ?? item.price ?? item.selling_price ?? 0);
        const sub = Number(item.subtotal ?? (up * qty));
        const tax = Number(item.tax_amount ?? ((item.cgst || 0) + (item.sgst || 0)));
        itemCalculatedSubtotal += sub;
        itemCalculatedTax += tax;
      }

      const repoOrder = OrderRepository.mapRowToDomain(row);

      // Classification logic
      let classification = "UNKNOWN";
      if (rawItems.length === 0 && Number(dbMetaTotal || 0) === 0) {
        classification = "LEGITIMATE ZERO (Empty items / draft / test)";
      } else if (rawItems.length > 0 && itemCalculatedSubtotal > 0 && (dbMetaTotal === null || Number(dbMetaTotal) === 0)) {
        classification = "MAPPING ERROR (Historical prices exist in items; meta.total null/0, order.total column missing)";
      } else if (rawItems.length > 0 && itemCalculatedSubtotal > 0 && Number(dbMetaTotal) > 0) {
        classification = "PERSISTED NON-ZERO (Metadata total populated)";
      } else if (rawItems.length > 0 && itemCalculatedSubtotal === 0) {
        classification = "DATA CORRUPTION (Items present but unit prices are 0)";
      }

      summaryTable.push({
        "#": idx + 1,
        id: row.id.slice(0, 24),
        order_num: meta.order_number || row.display_id,
        items_cnt: rawItems.length,
        meta_tot: dbMetaTotal,
        meta_sub: dbMetaSubtotal,
        item_sub: itemCalculatedSubtotal,
        item_tax: itemCalculatedTax,
        repo_tot: repoOrder.total,
        classification,
      });
    }

    console.table(summaryTable);

    // Detailed tax snapshot examination for first 3 orders
    console.log(`\n--------------------------------------------------------------------------------`);
    console.log(`DETAILED TAX & HSN INSPECTION FOR REPRESENTATIVE ORDERS:`);
    console.log(`--------------------------------------------------------------------------------`);

    for (let i = 0; i < Math.min(3, res.rows.length); i++) {
      const row = res.rows[i];
      const meta = row.metadata || {};
      const rawItems: any[] = meta.items || [];
      console.log(`\nOrder #${i + 1}: ${row.id} (${meta.order_number || row.display_id})`);
      console.log(`  compliance_snapshot:`, JSON.stringify(meta.compliance_snapshot || null));
      console.log(`  tax_snapshot:`, JSON.stringify(meta.tax_snapshot || null));
      console.log(`  pricing:`, JSON.stringify(meta.pricing || null));
      rawItems.forEach((it, itIdx) => {
        console.log(`  Item [${itIdx}]: title="${it.title || it.name}", qty=${it.quantity}, unit_price=₹${it.unit_price}, subtotal=₹${it.subtotal}, hsn=${it.hsn_code}, gst_rate=${it.gst_rate_pct || it.tax_rate}%, cgst=₹${it.cgst}, sgst=₹${it.sgst}, igst=₹${it.igst}, tax_amount=₹${it.tax_amount}`);
      });
    }

  } catch (err: any) {
    console.error("ERROR:", err.message);
    process.exitCode = 1;
  } finally {
    await client.end();
    await closeDbPool();
    clearTimeout(safetyTimeout);
    process.exit(process.exitCode || 0);
  }
}

run();
