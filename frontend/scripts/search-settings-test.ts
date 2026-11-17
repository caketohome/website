/**
 * Round-trip test for search settings persistence (public.search_setting).
 *   npx tsx scripts/search-settings-test.ts save   -> set exact_match_weight=77 and save
 *   npx tsx scripts/search-settings-test.ts load   -> fresh process: load and print it
 *   npx tsx scripts/search-settings-test.ts clean  -> delete the test row (back to defaults)
 */
import { SearchEngine } from "../src/lib/search/search-engine";
import { loadSearchSettings, saveSearchSettings } from "../src/lib/search/search-settings-store";
import { dbQuery } from "../src/lib/db";

async function main() {
  const step = process.argv[2];
  if (step === "save") {
    SearchEngine.updateRankingWeights({ exact_match_weight: 77 });
    await saveSearchSettings();
    console.log("saved exact_match_weight =", SearchEngine.getRankingWeights().exact_match_weight);
  } else if (step === "load") {
    console.log("before load (default) =", SearchEngine.getRankingWeights().exact_match_weight);
    const found = await loadSearchSettings();
    console.log("row found:", found, "| after load =", SearchEngine.getRankingWeights().exact_match_weight,
      "| tags:", SearchEngine.getTags().length, "| synonyms:", SearchEngine.getSynonyms().length);
  } else if (step === "clean") {
    const r = await dbQuery(`DELETE FROM public.search_setting WHERE id = 'default'`);
    console.log("test row removed:", r.rowCount);
  }
  process.exit(0);
}
main().catch((e) => { console.error(e.message); process.exit(1); });
