(async () => {
  const res = await fetch('http://localhost:3000/api/v1/products?limit=50');
  const data = await res.json();
  const prods = data.products || data.results || [];
  console.log(`Found ${prods.length} products:`);
  prods.forEach((p, idx) => {
    console.log(`${idx+1}. [${p.id}] "${p.title}" (handle: ${p.handle}) - Cat: "${p.category}" - Tags: "${p.tags || ''}" - Occ: "${p.occasion}"`);
  });
})();
