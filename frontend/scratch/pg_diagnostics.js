const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function main() {
  const envContent = fs.readFileSync(path.join(__dirname, '../../backend/.env'), 'utf8');
  const conn = envContent.split('\n').find(l => l.startsWith('DATABASE_URL=')).substring('DATABASE_URL='.length).trim();
  const c = new Client({ connectionString: conn });
  await c.connect();

  console.log('=== PG_STAT_ACTIVITY DIAGNOSTICS ===');
  const actRes = await c.query(`
    SELECT
      pid,
      usename,
      datname,
      client_addr,
      state,
      wait_event_type,
      wait_event,
      query_start,
      xact_start,
      state_change,
      backend_type,
      SUBSTRING(query, 1, 80) as query_snippet
    FROM pg_stat_activity
    WHERE datname = current_database()
    ORDER BY pid
  `);
  console.log('Sessions count:', actRes.rows.length);
  for (const s of actRes.rows) {
    console.log(JSON.stringify(s));
  }

  console.log('\n=== IDLE IN TRANSACTION SESSIONS ===');
  const idleInXact = actRes.rows.filter(r => r.state === 'idle in transaction');
  console.log('Count:', idleInXact.length);

  console.log('\n=== LOCKS & BLOCKING RELATIONSHIPS ===');
  const lockRes = await c.query(`
    SELECT
      blocked_locks.pid     AS blocked_pid,
      blocked_activity.usename  AS blocked_user,
      blocking_locks.pid    AS blocking_pid,
      blocking_activity.usename AS blocking_user,
      blocked_activity.query    AS blocked_statement,
      blocking_activity.query   AS current_statement_in_blocking_process
    FROM  pg_catalog.pg_locks         blocked_locks
    JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
    JOIN pg_catalog.pg_locks         blocking_locks 
        ON blocking_locks.locktype = blocked_locks.locktype
        AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database
        AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
        AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
        AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
        AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
        AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
        AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
        AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
        AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
        AND blocking_locks.pid != blocked_locks.pid
    JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
    WHERE NOT blocked_locks.granted;
  `);
  console.log('Blocked locks count:', lockRes.rows.length);

  console.log('\n=== ACTIVE ROW / TABLE LOCKS HELD ===');
  const heldLocks = await c.query(`
    SELECT
      l.pid,
      c.relname,
      l.mode,
      l.granted
    FROM pg_locks l
    LEFT JOIN pg_class c ON l.relation = c.oid
    WHERE l.database = (SELECT oid FROM pg_database WHERE datname = current_database())
      AND l.pid != pg_backend_pid()
  `);
  console.log('Held locks count:', heldLocks.rows.length);
  for (const l of heldLocks.rows) {
    console.log(JSON.stringify(l));
  }

  await c.end();
}

main().catch(console.error);
