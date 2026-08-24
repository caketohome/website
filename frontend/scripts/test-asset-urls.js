const http = require('http');

http.get('http://localhost:3000/', (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log('Document Status:', res.statusCode);
    const cssMatches = body.match(/href="([^"]+\.css[^"]*)"/g) || [];
    const jsMatches = body.match(/src="([^"]+\.js[^"]*)"/g) || [];
    console.log('CSS links found in HTML:', cssMatches);
    console.log('JS scripts found in HTML (first 5):', jsMatches.slice(0, 5));

    cssMatches.forEach(m => {
      const u = m.replace('href="', '').replace('"', '');
      http.get('http://localhost:3000' + u, cRes => {
        console.log('CSS [' + cRes.statusCode + ']: ' + u);
      });
    });

    jsMatches.forEach(m => {
      const u = m.replace('src="', '').replace('"', '');
      http.get('http://localhost:3000' + u, jRes => {
        console.log('JS [' + jRes.statusCode + ']: ' + u);
      });
    });
  });
}).on('error', err => console.error('Error fetching root:', err.message));
