const path = require('path');
const Client = require(path.resolve('E:/vig/cakes2home-main/cakes2home-main/frontend/node_modules/pg')).Client;

async function checkTrigger() {
  const client = new Client({
    connectionString: 'postgresql://cth_test_user:cth_test_password@127.0.0.1:5433/cth_rehearsal_phase5'
  });
  await client.connect();
  const res = await client.query(`
    SELECT pg_get_functiondef(oid) AS def
    FROM pg_proc
    WHERE proname = 'fn_check_journal_balance';
  `);
  console.log(res.rows[0]?.def);

  const trg = await client.query(`
    SELECT tgname, tgtype, tgenabled, relname
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    WHERE tgname LIKE '%journal%' OR tgname LIKE '%balance%';
  `);
  console.log('Triggers:', trg.rows);

  await client.end();
}

checkTrigger().catch(console.error);
