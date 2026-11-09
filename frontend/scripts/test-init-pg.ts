import EmbeddedPostgres from 'embedded-postgres';
import path from 'path';
import fs from 'fs';
import pg from 'pg';

async function main() {
  const dbDir = path.resolve(process.cwd(), '../.isolated-pg-data');
  console.log('Target test DB dir:', dbDir);

  const pgInstance = new EmbeddedPostgres({
    databaseDir: dbDir,
    port: 5433,
    user: 'cth_test_user',
    password: 'cth_test_password_2026',
    authMethod: 'password',
    persistent: true,
    onLog: (msg) => {
      // Avoid verbose logging but show errors
      if (msg.includes('error') || msg.includes('FATAL') || msg.includes('ready to accept')) {
        console.log('[PG]', msg.trim());
      }
    }
  });

  if (!fs.existsSync(dbDir)) {
    console.log('Initializing new cluster with initdb...');
    await pgInstance.initialise();
    console.log('Cluster initialized successfully.');
  } else {
    console.log('Existing cluster directory found.');
  }

  console.log('Starting PostgreSQL server on port 5433...');
  await pgInstance.start();
  console.log('PostgreSQL server started successfully!');

  // Test connection to postgres default DB to create cth_test
  const client = new pg.Client({
    host: '127.0.0.1',
    port: 5433,
    user: 'cth_test_user',
    password: 'cth_test_password_2026',
    database: 'postgres'
  });

  await client.connect();
  const ver = await client.query('SELECT version()');
  console.log('Connected! Server version:', ver.rows[0].version);

  // Check or create cth_test database
  const checkDb = await client.query("SELECT 1 FROM pg_database WHERE datname = 'cth_test'");
  if (checkDb.rows.length === 0) {
    console.log("Creating database 'cth_test'...");
    await client.query('CREATE DATABASE cth_test');
    console.log("Database 'cth_test' created.");
  } else {
    console.log("Database 'cth_test' already exists.");
  }

  await client.end();

  // Test connecting to cth_test
  const testClient = new pg.Client({
    host: '127.0.0.1',
    port: 5433,
    user: 'cth_test_user',
    password: 'cth_test_password_2026',
    database: 'cth_test'
  });
  await testClient.connect();
  const testInfo = await testClient.query('SELECT current_database(), current_user');
  console.log('cth_test info:', testInfo.rows[0]);
  await testClient.end();

  console.log('Stopping test instance for probe cleanup...');
  await pgInstance.stop();
  console.log('PostgreSQL stopped cleanly.');
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
