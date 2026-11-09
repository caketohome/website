const { Client } = require('pg');

const connStr = process.env.DATABASE_URL || "[REDACTED_DATABASE_CREDENTIAL]";
const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });

async function runReadOnlyChecks() {
  await client.connect();
  console.log("=== CONNECTED TO SUPABASE POSTGRESQL (READ-ONLY INSPECTION) ===\n");

  const hr = () => console.log('─'.repeat(70));

  // 1. Table & Column Existence
  hr();
  console.log("CHECK 1: ORDER & INVOICE TABLE COLUMNS");
  const orderCols = await client.query(`
    SELECT column_name, data_type, is_nullable 
    FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'order'
    ORDER BY ordinal_position;
  `);
  console.log("public.order columns:", orderCols.rows.map(r => r.column_name).join(', '));
  const hasOrderNumberCol = orderCols.rows.some(r => r.column_name === 'order_number');
  console.log("Has 'order_number' column on public.order:", hasOrderNumberCol);

  const invCols = await client.query(`
    SELECT column_name, data_type, is_nullable 
    FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'invoice'
    ORDER BY ordinal_position;
  `);
  console.log("public.invoice columns:", invCols.rows.map(r => r.column_name).join(', '));

  // Check sequence / new tables
  const newTables = await client.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' 
      AND table_name IN ('order_sequence', 'invoice_sequence', 'invoice_allocation_log', 'invoice_generation_queue');
  `);
  console.log("New numbering tables present:", newTables.rows.map(r => r.table_name).join(', ') || 'NONE');

  // Check pg_sequences for statutory_invoice_seq
  const seqs = await client.query(`
    SELECT sequencename, last_value, start_value, increment_by 
    FROM pg_sequences 
    WHERE schemaname = 'public';
  `);
  console.log("Existing PostgreSQL sequences:", seqs.rows);

  // 2. Orders Analysis: Counts, Nulls, Duplicates, Formats
  hr();
  console.log("CHECK 2: ORDER NUMBER DATA ANALYSIS");
  const orderStats = await client.query(`
    SELECT 
      COUNT(*) AS total_orders,
      COUNT(CASE WHEN deleted_at IS NOT NULL THEN 1 END) AS soft_deleted_orders,
      COUNT(CASE WHEN metadata->>'order_number' IS NOT NULL THEN 1 END) AS orders_with_metadata_order_number,
      COUNT(CASE WHEN metadata->>'order_number' IS NULL THEN 1 END) AS orders_without_metadata_order_number,
      COUNT(DISTINCT metadata->>'order_number') AS distinct_metadata_order_numbers
    FROM public."order";
  `);
  console.log("Order counts:", orderStats.rows[0]);

  // Check duplicates in metadata->>'order_number'
  const dupOrders = await client.query(`
    SELECT metadata->>'order_number' AS order_num, COUNT(*) as cnt
    FROM public."order"
    WHERE metadata->>'order_number' IS NOT NULL
    GROUP BY metadata->>'order_number'
    HAVING COUNT(*) > 1;
  `);
  console.log("Duplicate metadata order numbers count:", dupOrders.rows.length);
  if (dupOrders.rows.length > 0) {
    console.log("Duplicate order numbers sample:", dupOrders.rows.slice(0, 5));
  }

  // Sample existing order numbers
  const sampleOrders = await client.query(`
    SELECT id, display_id, metadata->>'order_number' AS meta_order_number, created_at, status
    FROM public."order"
    ORDER BY created_at DESC
    LIMIT 10;
  `);
  console.log("Sample 10 recent orders:", sampleOrders.rows);

  // Analyze order number patterns / prefixes / sequences
  const orderPatterns = await client.query(`
    SELECT 
      SUBSTRING(metadata->>'order_number' FROM '^[A-Za-z]+') AS prefix,
      COUNT(*) AS cnt,
      MIN(metadata->>'order_number') AS min_val,
      MAX(metadata->>'order_number') AS max_val
    FROM public."order"
    WHERE metadata->>'order_number' IS NOT NULL
    GROUP BY SUBSTRING(metadata->>'order_number' FROM '^[A-Za-z]+');
  `);
  console.log("Order number patterns:", orderPatterns.rows);

  // Display ID max value
  const displayIdMax = await client.query(`
    SELECT MAX(display_id) as max_display_id, MIN(display_id) as min_display_id
    FROM public."order";
  `);
  console.log("Display ID range:", displayIdMax.rows[0]);

  // 3. Invoices Analysis: Counts, Formats, Duplicates, Dates
  hr();
  console.log("CHECK 3: INVOICE DATA ANALYSIS");
  const invStats = await client.query(`
    SELECT 
      COUNT(*) AS total_invoices,
      COUNT(CASE WHEN deleted_at IS NOT NULL THEN 1 END) AS soft_deleted_invoices,
      COUNT(CASE WHEN invoice_number IS NULL THEN 1 END) AS null_invoice_numbers,
      COUNT(DISTINCT invoice_number) AS distinct_invoice_numbers
    FROM public.invoice;
  `);
  console.log("Invoice counts:", invStats.rows[0]);

  const allInvoices = await client.query(`
    SELECT id, invoice_number, order_id, created_at, updated_at, deleted_at, status, grand_total
    FROM public.invoice
    ORDER BY created_at ASC;
  `);
  console.log("All existing invoices in database:", allInvoices.rows);

  // Check duplicate invoice numbers
  const dupInvoices = await client.query(`
    SELECT invoice_number, COUNT(*) as cnt
    FROM public.invoice
    GROUP BY invoice_number
    HAVING COUNT(*) > 1;
  `);
  console.log("Duplicate invoice numbers:", dupInvoices.rows);

  // 4. GST Registrations & Branch Entities
  hr();
  console.log("CHECK 4: GST REGISTRATIONS & ISSUING ENTITIES");
  try {
    const gstRegs = await client.query(`
      SELECT * FROM public.gst_registration;
    `);
    console.log("GST Registrations:", gstRegs.rows);
  } catch (e) {
    console.log("No public.gst_registration table or error:", e.message);
  }

  try {
    const branches = await client.query(`
      SELECT id, name, code, gstin, state, is_active FROM public.branch;
    `);
    console.log("Branches & GSTINs:", branches.rows);
  } catch (e) {
    console.log("Branch query error:", e.message);
  }

  // 5. Existing Indexes on order and invoice
  hr();
  console.log("CHECK 5: EXISTING INDEXES ON ORDER & INVOICE");
  const indexes = await client.query(`
    SELECT tablename, indexname, indexdef 
    FROM pg_indexes 
    WHERE schemaname = 'public' AND tablename IN ('order', 'invoice');
  `);
  indexes.rows.forEach(r => console.log(`[${r.tablename}] ${r.indexname}: ${r.indexdef}`));

  await client.end();
  console.log("\n=== READ-ONLY CHECK COMPLETE ===");
}

runReadOnlyChecks().catch(err => {
  console.error("FATAL CHECK ERROR:", err);
  process.exit(1);
});
