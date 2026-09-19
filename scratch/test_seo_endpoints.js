const http = require('http');

const endpoints = [
  '/api/v1/admin/seo',
  '/api/v1/admin/seo/dashboard',
  '/api/v1/admin/seo/pages',
  '/api/v1/admin/seo/redirects',
  '/api/v1/admin/seo/keywords',
  '/api/v1/admin/seo/schema/templates',
  '/api/v1/admin/seo/geo/pages',
  '/api/v1/admin/seo/aeo/entries'
];

async function check(endpoint) {
  return new Promise((resolve) => {
    http.get(`http://localhost:3000${endpoint}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ endpoint, status: res.statusCode, source: json._dataSource || 'unknown', keys: Object.keys(json) });
        } catch (e) {
          resolve({ endpoint, status: res.statusCode, error: 'non-json', body: data.slice(0, 100) });
        }
      });
    }).on('error', (err) => resolve({ endpoint, error: err.message }));
  });
}

async function run() {
  for (const ep of endpoints) {
    const res = await check(ep);
    console.log(JSON.stringify(res));
  }
}

run();
