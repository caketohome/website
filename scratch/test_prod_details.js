const http = require('http');

http.get('http://localhost:3000/products/prod_1', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log("Status Code:", res.statusCode);
    console.log("Body snippet:", data.slice(0, 1500));
  });
}).on('error', err => {
  console.error("Error:", err.message);
});
