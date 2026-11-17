/**
 * Server-only persistence for search admin settings (public.search_setting, single row).
 * Kept out of search-engine.ts because that file is also bundled into the admin UI.
 */
import { dbQuery } from "../db";
import { SearchEngine } from "./search-engine";

const ROW_ID = "default";

/** Load saved settings into the engine. No saved row yet = keep the built-in defaults. */
export async function loadSearchSettings(): Promise<boolean> {
  const { rows } = await dbQuery(`SELECT weights, tags, synonyms, rules FROM public.search_setting WHERE id = $1`, [ROW_ID]);
  if (!rows[0]) return false;
  SearchEngine.replaceSettings(rows[0]);
  return true;
}

/** Save the engine's current settings. Throws on failure so the admin sees the error. */
export async function saveSearchSettings(): Promise<void> {
  await dbQuery(
    `INSERT INTO public.search_setting (id, weights, tags, synonyms, rules, updated_at)
     VALUES ($1, $2::jsonb, $3::jsonb, $4::jsonb, $5::jsonb, NOW())
     ON CONFLICT (id) DO UPDATE SET
       weights = EXCLUDED.weights, tags = EXCLUDED.tags, synonyms = EXCLUDED.synonyms,
       rules = EXCLUDED.rules, updated_at = NOW()`,
    [
      ROW_ID,
      JSON.stringify(SearchEngine.getRankingWeights()),
      JSON.stringify(SearchEngine.getTags()),
      JSON.stringify(SearchEngine.getSynonyms()),
      JSON.stringify(SearchEngine.getMerchandisingRules()),
    ]
  );
}
