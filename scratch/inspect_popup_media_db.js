const path = require('path');
const { Pool } = require(path.join(__dirname, '../frontend/node_modules/pg'));

const pool = new Pool({
  connectionString: '[REDACTED_DATABASE_CREDENTIAL]',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    const campaignCols = await pool.query("SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'popup_campaigns' ORDER BY ordinal_position;");
    console.log('popup_campaigns columns:', campaignCols.rows);

    const campRows = await pool.query("SELECT * FROM popup_campaigns LIMIT 2;");
    console.log('Sample popup_campaigns:', JSON.stringify(campRows.rows, null, 2));

    const verRows = await pool.query("SELECT id, popup_campaign_id, version_number, content_json, design_json, media_json FROM popup_versions LIMIT 2;");
    console.log('Sample popup_versions:', JSON.stringify(verRows.rows, null, 2));

    const mediaRows = await pool.query("SELECT id, name, url, mime_type, width, height, size FROM media LIMIT 5;");
    console.log('Sample media rows:', mediaRows.rows);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

run();
