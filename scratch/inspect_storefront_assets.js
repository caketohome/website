(async () => {
  try {
    const htmlRes = await fetch('http://localhost:3000/');
    console.log('Document Status:', htmlRes.status);
    const html = await htmlRes.text();
    console.log('Document Length:', html.length);
    
    // Find all script tags with src
    const scriptRegex = /<script[^>]+src=["']([^"']+)["']/g;
    // Find all link tags with href
    const linkRegex = /<link[^>]+href=["']([^"']+)["'][^>]*>/g;
    
    let match;
    const assets = [];
    while ((match = scriptRegex.exec(html)) !== null) {
      assets.push({ type: 'script', url: match[1] });
    }
    while ((match = linkRegex.exec(html)) !== null) {
      if (match[0].includes('stylesheet') || match[1].includes('_next')) {
        assets.push({ type: 'stylesheet', url: match[1] });
      }
    }
    
    console.log(`Found ${assets.length} assets referenced in HTML:\n`);
    let failedCount = 0;
    for (const a of assets) {
      const fullUrl = a.url.startsWith('http') ? a.url : 'http://localhost:3000' + a.url;
      try {
        const res = await fetch(fullUrl);
        const status = res.status;
        if (status >= 400) failedCount++;
        console.log(`${a.type.padEnd(10)} [${status}] ${a.url}`);
      } catch (e) {
        failedCount++;
        console.log(`${a.type.padEnd(10)} [ERR] ${a.url} - ${e.message}`);
      }
    }
    console.log(`\nTotal assets: ${assets.length}, Failed (>=400): ${failedCount}`);
  } catch (err) {
    console.error('Fatal error:', err);
  }
})();
