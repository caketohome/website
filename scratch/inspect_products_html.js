const http = require('http');

http.get('http://localhost:3001/products', (res) => {
  let body = '';
  res.on('data', c => body += c);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    const regex = /<script[^>]*src=["']([^"']*)["'][^>]*>/gi;
    let match;
    const matches = [];
    while ((match = regex.exec(body)) !== null) {
      matches.push(match[1]);
    }
    console.log('Found script sources:', matches.length);
    matches.filter(s => s.includes('products')).forEach(s => console.log('Products script:', s));

    // Also check for link preloads
    const linkRegex = /<link[^>]*href=["']([^"']*)["'][^>]*>/gi;
    const linkMatches = [];
    while ((match = linkRegex.exec(body)) !== null) {
      linkMatches.push(match[1]);
    }
    linkMatches.filter(s => s.includes('products')).forEach(s => console.log('Products link preload:', s));
  });
});
