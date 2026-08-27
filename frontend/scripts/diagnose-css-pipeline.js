const fs = require('fs');

async function diagnose() {
  console.log('=== CSS PIPELINE DIAGNOSTIC ===');
  try {
    const res = await fetch('http://localhost:3000/');
    console.log('GET http://localhost:3000/ -> Status:', res.status);
    const html = await res.text();
    console.log('HTML length:', html.length);

    // Extract all <link rel="stylesheet" ...> and <script ...>
    const linkRegex = /<link[^>]+>/g;
    const scriptRegex = /<script[^>]+src=["']([^"']+)["'][^>]*>/g;

    const links = html.match(linkRegex) || [];
    console.log('\nFound <link> tags:', links.length);
    for (const link of links) {
      console.log('Link tag:', link);
      const hrefMatch = link.match(/href=["']([^"']+)["']/);
      if (hrefMatch) {
        const href = hrefMatch[1];
        const fullUrl = href.startsWith('http') ? href : 'http://localhost:3000' + href;
        const assetRes = await fetch(fullUrl);
        const text = await assetRes.text();
        console.log(` -> Fetch ${fullUrl} => Status: ${assetRes.status}, Length: ${text.length}, Content-Type: ${assetRes.headers.get('content-type')}`);
        if (assetRes.status >= 400) {
          console.log(`    ERROR RESPONSE:`, text.slice(0, 300));
        }
      }
    }

    const scripts = [];
    let m;
    while ((m = scriptRegex.exec(html)) !== null) {
      scripts.push(m[1]);
    }
    console.log('\nFound <script src> tags:', scripts.length);
    for (const src of scripts.slice(0, 5)) {
      const fullUrl = src.startsWith('http') ? src : 'http://localhost:3000' + src;
      const assetRes = await fetch(fullUrl);
      console.log(` -> Fetch ${fullUrl} => Status: ${assetRes.status}, Content-Type: ${assetRes.headers.get('content-type')}`);
      if (assetRes.status >= 400) {
        const text = await assetRes.text();
        console.log(`    ERROR RESPONSE:`, text.slice(0, 300));
      }
    }

  } catch (err) {
    console.error('Diagnosis failed:', err);
  }
}

diagnose();
