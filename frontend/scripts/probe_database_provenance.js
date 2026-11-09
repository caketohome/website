const { Client } = require('pg');

const FORBIDDEN_HOSTS = ['aws-1-ap-south-1.pooler.supabase.com', 'supabase.com', 'supabase.co'];

function validateTarget(url) {
  const parsed = new URL(url);
  for (const fHost of FORBIDDEN_HOSTS) {
    if (parsed.hostname.includes(fHost)) {
      throw new Error('CRITICAL SECURITY ABORT: Target is production Supabase host!');
    }
  }
  if (parsed.hostname !== '127.0.0.1' && parsed.hostname !== 'localhost') {
    throw new Error('SECURITY ABORT: Remote test target not permitted! Must be 127.0.0.1');
  }
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || '5432', 10),
    database: parsed.pathname.replace(/^\//, '')
  };
}

const TEST_URL = 'postgresql://cth_test_user@127.0.0.1:5433/cth_test';
validateTarget(TEST_URL);

const client = new Client({ connectionString: TEST_URL });

async function probe() {
  await client.connect();
  const v = await client.query('SELECT version(), current_database(), current_user, inet_server_port(), inet_server_addr()');
  console.log('PostgreSQL Server Provenance:', v.rows[0]);

  const tbls = await client.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('invoice', 'invoice_sequence', 'invoice_allocation_log', 'order', 'gst_registration', 'company') ORDER BY table_name"
  );
  console.log('Tables found:', tbls.rows.map(r => r.table_name));

  const fns = await client.query(
    "SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name IN ('allocate_invoice_number', 'commit_invoice_allocation', 'void_invoice_allocation')"
  );
  console.log('Functions found:', fns.rows.map(r => r.routine_name));

  const seqs = await client.query(
    "SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = 'public'"
  );
  console.log('Sequences found:', seqs.rows.map(r => r.sequence_name));

  const seqData = await client.query('SELECT * FROM public.invoice_sequence');
  console.log('invoice_sequence rows count:', seqData.rows.length);
  for (const r of seqData.rows) {
    console.log('  Row:', { id: r.id, entity_id: r.entity_id, gstin: r.gstin, fiscal_year: r.fiscal_year, prefix: r.prefix, last_seq: r.last_seq });
  }

  const logCount = await client.query('SELECT count(*) FROM public.invoice_allocation_log');
  console.log('invoice_allocation_log count:', logCount.rows[0].count);

  // Check fail-closed behavior if isolated test DB is stopped/wrong port
  await client.end();
  console.log('Database probe completed cleanly.');
}

probe().catch(console.error);
