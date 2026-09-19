const http = require('http');

http.get('http://localhost:3000/', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    // Find all /products links in home
    const matches = data.match(/href="\/products[^"]*"/g) || [];
    console.log(`Found ${matches.length} /products links on homepage:`);
    const unique = Array.from(new Set(matches));
    console.log(unique.slice(0, 20));
  });
});
