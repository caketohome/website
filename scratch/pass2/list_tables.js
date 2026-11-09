const L = require('./lib');
(async () => {
  const r = await L.q("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name");
  r.rows.forEach(r => console.log(r.table_name));
  await L.pool.end();
})();
