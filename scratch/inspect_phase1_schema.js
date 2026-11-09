const { Client } = require('../backend/node_modules/pg');

async function inspectSchema() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || '[REDACTED_DATABASE_CREDENTIAL]'
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL successfully.');

    // 1. Columns of cms_page
    const cols = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'cms_page'
      ORDER BY ordinal_position ASC
    `);
    console.log('\n--- CMS_PAGE TABLE COLUMNS ---');
    cols.rows.forEach(c => console.log(`- ${c.column_name} (${c.data_type}, nullable: ${c.is_nullable})`));

    // 2. Inspect cmspg_home row
    const pageRes = await client.query(`SELECT * FROM cms_page WHERE id = 'cmspg_home' LIMIT 1`);
    if (pageRes.rows.length === 0) {
      console.log('cmspg_home not found!');
      return;
    }

    const page = pageRes.rows[0];
    console.log('\n--- CMSPG_HOME SUMMARY ---');
    console.log('ID:', page.id);
    console.log('Slug:', page.slug);
    console.log('Title:', page.title);
    console.log('Type:', page.type);
    console.log('Status:', page.status);
    console.log('Published At:', page.published_at);
    console.log('Meta Title:', page.meta_title);
    console.log('Meta Description:', page.meta_description);
    console.log('Canonical URL:', page.canonical_url);
    console.log('OG Image:', page.og_image);

    let blocks = page.blocks;
    if (typeof blocks === 'string') {
      try { blocks = JSON.parse(blocks); } catch (e) { console.error('Error parsing blocks JSON:', e); }
    }

    console.log('\n--- BLOCKS ROOT KEYS ---');
    console.log(Object.keys(blocks || {}));

    console.log('\n--- DRAFT_CONFIG KEYS ---');
    console.log(blocks.draft_config ? Object.keys(blocks.draft_config) : 'None');

    console.log('\n--- PUBLISHED_CONFIG KEYS ---');
    console.log(blocks.published_config ? Object.keys(blocks.published_config) : 'None');
    if (blocks.published_config?.theme) {
      console.log('published_config.theme:', blocks.published_config.theme);
    } else {
      console.log('published_config.theme: Not set');
    }

    console.log('\n--- VERSION_HISTORY COUNT ---');
    console.log(Array.isArray(blocks.version_history) ? blocks.version_history.length : 0);
    if (Array.isArray(blocks.version_history) && blocks.version_history.length > 0) {
      const v = blocks.version_history[blocks.version_history.length - 1];
      console.log('Latest Version Snapshot Keys:', Object.keys(v));
      console.log('Latest Version Snapshot Content Keys:', v.snapshot ? Object.keys(v.snapshot) : null);
    }

    console.log('\n--- PUBLISHED SECTIONS (Type & Order) ---');
    const sections = blocks.published_config?.sections || blocks.sections || [];
    sections.forEach((s, idx) => {
      console.log(`[#${idx + 1}] ID: ${s.id} | Type: ${s.type} | Name: "${s.name}" | Enabled: ${s.enabled !== false} | Config Keys: ${Object.keys(s.config || {}).join(', ')}`);
    });

    // Detailed check on Hero Section Config
    const heroSec = sections.find(s => s.type === 'hero');
    if (heroSec) {
      console.log('\n--- HERO SECTION DETAIL ---');
      console.log('Hero Config Keys:', Object.keys(heroSec.config || {}));
      console.log('Headline:', heroSec.config?.headline);
      console.log('Subheadline:', heroSec.config?.subheadline);
      console.log('Badge:', heroSec.config?.badge_text);
      console.log('Primary CTA:', heroSec.config?.cta_primary_text, '->', heroSec.config?.cta_primary_url);
      console.log('Secondary CTA:', heroSec.config?.cta_secondary_text, '->', heroSec.config?.cta_secondary_url);
      console.log('Disable scroll sequence:', heroSec.config?.disable_scroll_sequence);
      console.log('Scroll sequence frames desktop count:', heroSec.config?.scrollSequenceFrames?.desktop?.length || 0);
      console.log('Desktop frames in config.desktop:', heroSec.config?.desktop?.frames?.length || 0);
    }

  } catch (err) {
    console.error('Inspection error:', err);
  } finally {
    await client.end();
  }
}

inspectSchema();
