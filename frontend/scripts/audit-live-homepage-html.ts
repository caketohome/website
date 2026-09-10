async function main() {
  const res = await fetch("http://localhost:3000/", { cache: "no-store" });
  const html = await res.text();

  console.log("=== LIVE HOMEPAGE (http://localhost:3000/) AUDIT ===");
  console.log("Status:", res.status);
  console.log("Headers:");
  for (const [k, v] of res.headers.entries()) {
    console.log(`  ${k}: ${v}`);
  }

  // Check section IDs in rendered HTML
  const sectionIdMatches = [...html.matchAll(/data-section-id="([^"]+)"/g)].map(m => m[1]);
  console.log("\nRendered data-section-id attributes:", sectionIdMatches);

  // Check section types in rendered HTML
  const sectionTypeMatches = [...html.matchAll(/data-section-type="([^"]+)"/g)].map(m => m[1]);
  console.log("Rendered data-section-type attributes:", sectionTypeMatches);

  // Check titles of products in rendered HTML
  const productMatches = [
    "Classic Chocolate Truffle Cake",
    "Classic Red Velvet Cream Cheese Cake",
    "Belgian Chocolate Truffle Cake",
    "Black Forest Gateau Special",
    "PISTACHIO GATEAU",
    "CHOCO RED",
    "RED BEE",
    "CHOCOLATE TRUFFLE"
  ];
  console.log("\nProduct presence on live rendered homepage:");
  for (const p of productMatches) {
    console.log(`  ${p}: ${html.includes(p) ? "PRESENT" : "ABSENT"}`);
  }

  // Check hardcoded fallback elements
  console.log("\nFallback StorefrontProductHomepage check:");
  console.log("  Contains 'CAKE100':", html.includes("CAKE100"));
  console.log("  Contains 'EXPRESS2H':", html.includes("EXPRESS2H"));
  console.log("  Contains 'SWEET15':", html.includes("SWEET15"));

  // Check categories rendered
  const categories = [
    "Birthday Cakes",
    "Anniversary Cakes",
    "Chocolate Cakes",
    "Red Velvet Cakes",
    "Fruit & Mousse Cakes",
    "Cheesecakes"
  ];
  console.log("\nCategory presence on live rendered homepage:");
  for (const c of categories) {
    console.log(`  ${c}: ${html.includes(c) ? "PRESENT" : "ABSENT"}`);
  }

  // Check SEO meta title
  const titleMatch = html.match(/<title>([^<]+)<\/title>/);
  console.log("\nRendered <title>:", titleMatch ? titleMatch[1] : "NONE");

  // Check meta description
  const descMatch = html.match(/<meta name="description" content="([^"]+)"/);
  console.log("Rendered description:", descMatch ? descMatch[1] : "NONE");

  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
