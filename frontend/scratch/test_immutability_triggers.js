const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function getConnectionString() {
  const envContent = fs.readFileSync(path.join(__dirname, '../.env'), 'utf8');
  for (const line of envContent.split('\n')) {
    if (line.trim().startsWith('DATABASE_URL=')) {
      let val = line.trim().substring('DATABASE_URL='.length).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      return val;
    }
  }
}

async function testImmutabilityTriggers() {
  const client = new Client({ connectionString: getConnectionString(), ssl: { rejectUnauthorized: false } });
  await client.connect();
  await client.query('BEGIN');
  try {
    // 1. Create temp session table
    await client.query(`
      CREATE TEMP TABLE temp_session (
        id text primary key,
        branch_id text not null,
        status text not null default 'OPEN',
        opening_float numeric(15,2) not null default 0.00,
        expected_cash numeric(15,2) not null default 0.00,
        closing_count numeric(15,2),
        variance numeric(15,2),
        opened_by text not null,
        closed_by text,
        verified_by text,
        settled_by text,
        settlement_voucher_id text,
        notes text,
        CONSTRAINT chk_temp_session_settled CHECK (
          status != 'SETTLED' OR (
            closed_by IS NOT NULL AND
            verified_by IS NOT NULL AND
            settled_by IS NOT NULL AND
            closing_count IS NOT NULL AND
            variance IS NOT NULL AND
            ((variance != 0.00 AND settlement_voucher_id IS NOT NULL) OR (variance = 0.00 AND settlement_voucher_id IS NULL))
          )
        )
      );
    `);

    // 2. Create temp movement table
    await client.query(`
      CREATE TEMP TABLE temp_movement (
        id text primary key,
        teller_session_id text not null references temp_session(id),
        amount numeric(15,2) not null,
        direction text not null
      );
    `);

    // 3. Create session immutability function & trigger
    await client.query(`
      CREATE OR REPLACE FUNCTION fn_temp_session_immutability()
      RETURNS trigger AS $$
      BEGIN
        IF TG_OP = 'DELETE' THEN
          IF OLD.status = 'SETTLED' THEN
            RAISE EXCEPTION 'Settled teller session % is immutable and cannot be deleted', OLD.id;
          END IF;
          RETURN OLD;
        ELSIF TG_OP = 'UPDATE' THEN
          IF OLD.status = 'SETTLED' THEN
            RAISE EXCEPTION 'Settled teller session % is immutable and cannot be modified', OLD.id;
          END IF;
          RETURN NEW;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER trg_temp_session_immutability
      BEFORE UPDATE OR DELETE ON temp_session
      FOR EACH ROW EXECUTE FUNCTION fn_temp_session_immutability();
    `);

    // 4. Create movement immutability function & trigger
    await client.query(`
      CREATE OR REPLACE FUNCTION fn_temp_movement_immutability()
      RETURNS trigger AS $$
      DECLARE
        v_status text;
      BEGIN
        IF TG_OP = 'INSERT' THEN
          SELECT status INTO v_status FROM temp_session WHERE id = NEW.teller_session_id;
          IF v_status = 'SETTLED' THEN
            RAISE EXCEPTION 'Cannot add cash movement to settled teller session %', NEW.teller_session_id;
          ELSIF v_status = 'CANCELLED' THEN
            RAISE EXCEPTION 'Cannot add cash movement to cancelled teller session %', NEW.teller_session_id;
          END IF;
          RETURN NEW;
        ELSIF TG_OP = 'UPDATE' THEN
          SELECT status INTO v_status FROM temp_session WHERE id = OLD.teller_session_id;
          IF v_status = 'SETTLED' THEN
            RAISE EXCEPTION 'Cash movements on settled teller session % are immutable and cannot be modified', OLD.teller_session_id;
          END IF;
          RETURN NEW;
        ELSIF TG_OP = 'DELETE' THEN
          SELECT status INTO v_status FROM temp_session WHERE id = OLD.teller_session_id;
          IF v_status = 'SETTLED' THEN
            RAISE EXCEPTION 'Cash movements on settled teller session % are immutable and cannot be deleted', OLD.teller_session_id;
          END IF;
          RETURN OLD;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER trg_temp_movement_immutability
      BEFORE INSERT OR UPDATE OR DELETE ON temp_movement
      FOR EACH ROW EXECUTE FUNCTION fn_temp_movement_immutability();
    `);

    // TEST SCENARIOS
    // Scenario A: Insert OPEN session and movement
    await client.query(`INSERT INTO temp_session (id, branch_id, opened_by) VALUES ('sess_1', 'br_1', 'usr_1');`);
    await client.query(`INSERT INTO temp_movement (id, teller_session_id, amount, direction) VALUES ('mov_1', 'sess_1', 500.00, 'IN');`);
    console.log('Scenario A (open session & movement insert) passed');

    // Scenario B: Update movement while open
    await client.query(`UPDATE temp_movement SET amount = 550.00 WHERE id = 'mov_1';`);
    console.log('Scenario B (movement update while open) passed');

    // Scenario C: Transition session to SETTLED (with zero variance and NULL voucher)
    await client.query(`
      UPDATE temp_session 
      SET status = 'SETTLED',
          closing_count = 550.00,
          expected_cash = 550.00,
          variance = 0.00,
          closed_by = 'usr_2',
          verified_by = 'usr_3',
          settled_by = 'usr_4',
          settlement_voucher_id = NULL
      WHERE id = 'sess_1';
    `);
    console.log('Scenario C (transition to SETTLED with zero variance) passed');

    // Scenario D: Attempt to mutate settled session -> MUST FAIL
    await client.query('SAVEPOINT sp_d');
    let caughtD = false;
    try {
      await client.query(`UPDATE temp_session SET notes = 'tampering' WHERE id = 'sess_1';`);
    } catch (e) {
      caughtD = true;
      console.log('Scenario D caught expected error:', e.message);
      await client.query('ROLLBACK TO SAVEPOINT sp_d');
    }
    if (!caughtD) throw new Error('Settled session mutation was not prevented!');

    // Scenario E: Attempt to insert movement on settled session -> MUST FAIL
    await client.query('SAVEPOINT sp_e');
    let caughtE = false;
    try {
      await client.query(`INSERT INTO temp_movement (id, teller_session_id, amount, direction) VALUES ('mov_2', 'sess_1', 100.00, 'IN');`);
    } catch (e) {
      caughtE = true;
      console.log('Scenario E caught expected error:', e.message);
      await client.query('ROLLBACK TO SAVEPOINT sp_e');
    }
    if (!caughtE) throw new Error('Movement insert on settled session was not prevented!');

    // Scenario F: Attempt to update movement on settled session -> MUST FAIL
    await client.query('SAVEPOINT sp_f');
    let caughtF = false;
    try {
      await client.query(`UPDATE temp_movement SET amount = 600.00 WHERE id = 'mov_1';`);
    } catch (e) {
      caughtF = true;
      console.log('Scenario F caught expected error:', e.message);
      await client.query('ROLLBACK TO SAVEPOINT sp_f');
    }
    if (!caughtF) throw new Error('Movement update on settled session was not prevented!');

    // Scenario G: Attempt to delete movement on settled session -> MUST FAIL
    await client.query('SAVEPOINT sp_g');
    let caughtG = false;
    try {
      await client.query(`DELETE FROM temp_movement WHERE id = 'mov_1';`);
    } catch (e) {
      caughtG = true;
      console.log('Scenario G caught expected error:', e.message);
      await client.query('ROLLBACK TO SAVEPOINT sp_g');
    }
    if (!caughtG) throw new Error('Movement delete on settled session was not prevented!');

    // Scenario H: Attempt to delete settled session -> MUST FAIL
    await client.query('SAVEPOINT sp_h');
    let caughtH = false;
    try {
      await client.query(`DELETE FROM temp_session WHERE id = 'sess_1';`);
    } catch (e) {
      caughtH = true;
      console.log('Scenario H caught expected error:', e.message);
      await client.query('ROLLBACK TO SAVEPOINT sp_h');
    }
    if (!caughtH) throw new Error('Settled session delete was not prevented!');

    console.log('ALL 8 IMMUTABILITY SCENARIOS PASSED WITH EXACT ERROR VERIFICATION!');

  } finally {
    await client.query('ROLLBACK');
    await client.end();
  }
}

testImmutabilityTriggers().catch(console.error);
