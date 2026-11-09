const path = require('path');
const Client = require(path.resolve('E:/vig/cakes2home-main/cakes2home-main/frontend/node_modules/pg')).Client;

async function checkTrg() {
  const client = new Client({
    connectionString: 'postgresql://cth_test_user:cth_test_password@127.0.0.1:5433/cth_rehearsal_phase5'
  });
  await client.connect();
  const trg = await client.query(`
    SELECT tgname, pg_get_triggerdef(oid) AS def
    FROM pg_trigger
    WHERE tgname = 'trg_check_journal_balance';
  `);
  console.log(trg.rows[0]?.def);
  await client.end();
}

checkTrg().catch(console.error);
