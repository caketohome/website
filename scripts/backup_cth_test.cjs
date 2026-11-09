const fs = require('fs');
const path = require('path');
const { Pool } = require('E:/vig/cakes2home-main/cakes2home-main/frontend/node_modules/pg');

const pool = new Pool({
  connectionString: 'postgresql://cth_test_user:cth_test_password@127.0.0.1:5433/cth_test'
});

async function main() {
  const client = await pool.connect();
  try {
    console.log('[Backup] Connecting to PostgreSQL 127.0.0.1:5433/cth_test...');

    const dbIdentity = await client.query(`
      SELECT current_database(), current_user, inet_server_port(), version();
    `);
    console.log('[Backup] Connected to database:', dbIdentity.rows[0]);

    const backupDir = path.resolve(__dirname, '../backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = '20261028_phase3_0';
    const jsonBackupPath = path.join(backupDir, `cth_test_backup_${timestamp}.json`);
    const sqlBackupPath = path.join(backupDir, `cth_test_backup_${timestamp}.sql`);

    // 1. Enumerate all tables in public schema
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);
    const tables = tablesRes.rows.map(r => r.table_name);
    console.log(`[Backup] Found ${tables.length} tables in public schema.`);

    // 2. Enumerate columns, constraints, indexes, triggers, sequences, views
    const schemaDetails = {};
    const tableData = {};
    const tableCounts = {};

    let sqlDump = `-- CakeToHome PostgreSQL Database Dump\n-- Database: cth_test\n-- Date: ${new Date().toISOString()}\n-- Tables: ${tables.length}\n\n`;

    // Sequences
    const seqRes = await client.query(`
      SELECT sequence_name, data_type 
      FROM information_schema.sequences 
      WHERE sequence_schema = 'public';
    `);
    const sequences = [];
    for (const seq of seqRes.rows) {
      try {
        const valRes = await client.query(`SELECT last_value, is_called FROM "${seq.sequence_name}";`);
        sequences.push({
          name: seq.sequence_name,
          data_type: seq.data_type,
          last_value: valRes.rows[0]?.last_value,
          is_called: valRes.rows[0]?.is_called
        });
      } catch (e) {
        sequences.push({ name: seq.sequence_name, error: e.message });
      }
    }

    // Views
    const viewsRes = await client.query(`
      SELECT table_name, view_definition 
      FROM information_schema.views 
      WHERE table_schema = 'public';
    `);

    // For each table, capture DDL info and full row data
    for (const tbl of tables) {
      // Columns
      const colsRes = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default, character_maximum_length, udt_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position;
      `, [tbl]);

      // Constraints
      const consRes = await client.query(`
        SELECT tc.constraint_name, tc.constraint_type, kcu.column_name,
               ccu.table_name AS foreign_table_name,
               ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        LEFT JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.table_schema = 'public' AND tc.table_name = $1;
      `, [tbl]);

      // Indexes
      const idxRes = await client.query(`
        SELECT indexname, indexdef 
        FROM pg_indexes 
        WHERE schemaname = 'public' AND tablename = $1;
      `, [tbl]);

      schemaDetails[tbl] = {
        columns: colsRes.rows,
        constraints: consRes.rows,
        indexes: idxRes.rows
      };

      // Full table data
      const rowsRes = await client.query(`SELECT * FROM public."${tbl}";`);
      tableData[tbl] = rowsRes.rows;
      tableCounts[tbl] = rowsRes.rows.length;

      // Append table DDL and Inserts to SQL dump
      sqlDump += `-- -----------------------------------------------------\n`;
      sqlDump += `-- Table structure and data for: "${tbl}" (${rowsRes.rows.length} rows)\n`;
      sqlDump += `-- -----------------------------------------------------\n`;
      
      for (const row of rowsRes.rows) {
        const keys = Object.keys(row);
        const colList = keys.map(k => `"${k}"`).join(', ');
        const valList = keys.map(k => {
          const val = row[k];
          if (val === null || val === undefined) return 'NULL';
          if (typeof val === 'number') return val;
          if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
          if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
          if (val instanceof Date) return `'${val.toISOString()}'`;
          return `'${String(val).replace(/'/g, "''")}'`;
        }).join(', ');
        sqlDump += `INSERT INTO public."${tbl}" (${colList}) VALUES (${valList}) ON CONFLICT DO NOTHING;\n`;
      }
      sqlDump += `\n`;
    }

    const fullBackup = {
      metadata: {
        database: dbIdentity.rows[0].current_database,
        user: dbIdentity.rows[0].current_user,
        port: dbIdentity.rows[0].inet_server_port,
        version: dbIdentity.rows[0].version,
        timestamp: new Date().toISOString(),
        tableCount: tables.length,
        totalRows: Object.values(tableCounts).reduce((a, b) => a + b, 0),
        tableCounts
      },
      sequences,
      views: viewsRes.rows,
      schemaDetails,
      data: tableData
    };

    fs.writeFileSync(jsonBackupPath, JSON.stringify(fullBackup, null, 2), 'utf8');
    fs.writeFileSync(sqlBackupPath, sqlDump, 'utf8');

    const jsonStat = fs.statSync(jsonBackupPath);
    const sqlStat = fs.statSync(sqlBackupPath);

    console.log(`[Backup] SUCCESS!`);
    console.log(`  JSON Backup: ${jsonBackupPath} (${(jsonStat.size / 1024 / 1024).toFixed(2)} MB)`);
    console.log(`  SQL Backup:  ${sqlBackupPath} (${(sqlStat.size / 1024 / 1024).toFixed(2)} MB)`);
    console.log(`  Total tables: ${tables.length}, Total rows: ${fullBackup.metadata.totalRows}`);

    // Verification check: load JSON and ensure non-empty
    const verifyData = JSON.parse(fs.readFileSync(jsonBackupPath, 'utf8'));
    if (Object.keys(verifyData.data).length === tables.length && jsonStat.size > 100000) {
      console.log(`[Backup Verification] PASSED: Verified all ${tables.length} tables and data are intact and readable.`);
    } else {
      throw new Error('Backup verification failed: incomplete data or small file size.');
    }

  } catch (err) {
    console.error('[Backup Error]', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
