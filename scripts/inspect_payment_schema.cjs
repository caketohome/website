const { Client } = require('E:/vig/cakes2home-main/cakes2home-main/frontend/node_modules/pg');

async function inspectPaymentSchema() {
  const client = new Client({ connectionString: 'postgresql://cth_test_user:cth_test_password@127.0.0.1:5433/cth_rehearsal_phase4' });
  await client.connect();
  const cols = await client.query(`
    SELECT column_name, data_type, is_nullable, column_default 
    FROM information_schema.columns 
    WHERE table_name = 'payment_transaction'
    ORDER BY ordinal_position;
  `);
  console.log('payment_transaction columns:');
  console.table(cols.rows);

  const constraints = await client.query(`
    SELECT conname, pg_get_constraintdef(oid) 
    FROM pg_constraint 
    WHERE conrelid = 'public.payment_transaction'::regclass;
  `);
  console.log('payment_transaction constraints:');
  console.table(constraints.rows);

  // Check unique values of provider
  const providers = await client.query('SELECT DISTINCT provider FROM public.payment_transaction');
  console.log('Existing providers in payment_transaction:', providers.rows);

  await client.end();
}

inspectPaymentSchema().catch(console.error);

