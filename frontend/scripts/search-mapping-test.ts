/**
 * Search mapping check with in-memory sample cakes (nothing is written to the database).
 *   npx tsx scripts/search-mapping-test.ts
 */
import { SearchEngine } from "../src/lib/search/search-engine";

const cake = (id: string, title: string, flavour: string, category: string, description = "") => ({
  id, title, name: title, handle: id, flavour, category, category_slug: category.toLowerCase().replace(/\s+/g, "-"),
  description, price: 600, selling_price: 600, status: "published", in_stock: true,
});

SearchEngine.initializeFromStore([
  cake("bf", "Black Forest Cake", "Black Forest", "Classic Cakes", "Layers of sponge, whipped cream and cherries."),
  cake("dt", "Dutch Truffle Cake", "Dutch Truffle", "Premium Cakes"),
  cake("cf", "Chocolate Fudge Cake", "Chocolate", "Classic Cakes"),
  cake("rv", "Red Velvet Cake", "Red Velvet", "Premium Cakes"),
  cake("pa", "Pineapple Cake", "Pineapple", "Fruit Cakes"),
  cake("bs", "Butterscotch Cake", "Butterscotch", "Classic Cakes"),
  cake("ms", "Midnight Sponge", "Vanilla", "Classic Cakes", "Rich chocolate ganache on soft sponge."),
  { ...cake("rb", "Rainbow Cake", "Vanilla", "Theme Cakes"), search_keywords: "kids, cartoon, unicorn" },
]);

const expectations: Array<[string, string[], string[]]> = [
  // query, must include, must NOT include
  ["chocolate", ["Black Forest Cake", "Dutch Truffle Cake", "Chocolate Fudge Cake", "Midnight Sponge"], ["Pineapple Cake", "Red Velvet Cake", "Butterscotch Cake"]],
  ["black forest", ["Black Forest Cake"], ["Dutch Truffle Cake", "Chocolate Fudge Cake"]],
  ["fruit", ["Pineapple Cake"], ["Black Forest Cake"]],
  ["vanilla", ["Butterscotch Cake", "Midnight Sponge"], ["Red Velvet Cake"]],
  ["red velvet", ["Red Velvet Cake"], ["Black Forest Cake"]],
  ["kids", ["Rainbow Cake"], ["Black Forest Cake", "Red Velvet Cake"]],
  ["unicorn", ["Rainbow Cake"], ["Pineapple Cake"]],
];

let failed = 0;
for (const [q, mustHave, mustNot] of expectations) {
  const names = SearchEngine.search({ query: q, limit: 20 }).results.map((p: any) => p.name || p.title);
  const missing = mustHave.filter((n) => !names.includes(n));
  const wrong = mustNot.filter((n) => names.includes(n));
  const ok = !missing.length && !wrong.length;
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  "${q}" -> ${names.join(", ") || "(nothing)"}${missing.length ? ` | missing: ${missing.join(", ")}` : ""}${wrong.length ? ` | wrongly included: ${wrong.join(", ")}` : ""}`);
}
process.exit(failed ? 1 : 0);
