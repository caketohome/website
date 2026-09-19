async function test() {
  console.log('Fetching http://localhost:3000/products...');
  const res = await fetch('http://localhost:3000/products');
  console.log('HTTP Status:', res.status);
  const text = await res.text();
  console.log('HTML Length:', text.length);
  
  // Find stylesheets
  const cssMatches = text.match(/<link[^>]+>/g) || [];
  const stylesheets = cssMatches.filter(x => x.includes('stylesheet'));
  console.log('Stylesheets in HTML:', stylesheets);

  // If stylesheet link exists, fetch it directly!
  for (const s of stylesheets) {
    const hrefMatch = s.match(/href="([^"]+)"/);
    if (hrefMatch) {
      const cssUrl = `http://localhost:3000${hrefMatch[1]}`;
      console.log('Fetching CSS URL:', cssUrl);
      const cssRes = await fetch(cssUrl);
      console.log('CSS Status:', cssRes.status, 'Content-Type:', cssRes.headers.get('content-type'));
      const cssText = await cssRes.text();
      console.log('CSS length:', cssText.length, 'Contains Tailwind utility:', cssText.includes('hidden'));
    }
  }

  // Count product card mentions
  const cardMatches = text.match(/product-card/g) || [];
  console.log('Product card occurrences:', cardMatches.length);
}

test().catch(console.error);
