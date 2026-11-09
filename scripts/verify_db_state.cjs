const { Pool } = require('E:/vig/cakes2home-main/cakes2home-main/frontend/node_modules/pg');

const pool = new Pool({
  connectionString: 'postgresql://cth_test_user:cth_test_password@127.0.0.1:5433/cth_test'
});

async function run() {
  const tablesRes = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `);
  console.log(`Total public tables: ${tablesRes.rows.length}`);
  console.log('Tables:', tablesRes.rows.map(r => r.table_name).join(', '));

  const prodRes = await pool.query(`
    SELECT count(*) as total,
           count(*) FILTER (WHERE deleted_at IS NULL) as active,
           count(*) FILTER (WHERE deleted_at IS NOT NULL) as soft_deleted
    FROM public.product;
  `);
  console.log('Product stats:', prodRes.rows[0]);

  const activeProds = await pool.query(`
    SELECT id, title, merchandise_type, metadata->>'category' as category, metadata->>'thumbnail' as thumb
    FROM public.product
    WHERE deleted_at IS NULL
    ORDER BY merchandise_type, id;
  `);
  console.log('\nActive products:');
  activeProds.rows.forEach(p => {
    console.log(`- [${p.id}] (${p.merchandise_type}) "${p.title}" | Cat: ${p.category} | Thumb: ${p.thumb}`);
  });

  const businessCounts = await pool.query(`
    SELECT 
      (SELECT count(*) FROM public."order") as orders,
      (SELECT count(*) FROM public.order_line_item) as order_items,
      (SELECT count(*) FROM public.invoice) as invoices,
      (SELECT count(*) FROM public.payment_transaction) as payments,
      (SELECT count(*) FROM public.accounting_account) as accounts
  `);
  console.log('\nBusiness counts:', businessCounts.rows[0]);

  await pool.end();
}

run().catch(console.error);
