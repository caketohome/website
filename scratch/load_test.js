const { performance } = require('perf_hooks');

const PROXY_URL = 'http://localhost:3000/api/v1';
const PUBLISHABLE_KEY = 'pk_7940766aa25f0496301693153851a2fa3fab6101b56602b448aab07e5021e554';

async function sendRequest(url, headers = {}) {
  const start = performance.now();
  try {
    const res = await fetch(url, { headers });
    const duration = performance.now() - start;
    return { status: res.status, duration, ok: res.ok };
  } catch (err) {
    const duration = performance.now() - start;
    return { status: 0, duration, ok: false, error: err.message };
  }
}

async function runLoadTest(concurrency = 15, totalRequests = 150) {
  console.log(`Starting Proxy Gateway Load Test: ${totalRequests} total requests across ${concurrency} concurrent virtual users...`);

  const storeHeaders = {
    'Content-Type': 'application/json',
    'x-publishable-api-key': PUBLISHABLE_KEY,
  };

  const results = [];
  const startTotal = performance.now();

  const worker = async () => {
    while (results.length < totalRequests) {
      const idx = results.length;
      results.push(null); // reserve spot

      let targetUrl = `${PROXY_URL}/health`;
      if (idx % 2 === 1) targetUrl = `${PROXY_URL}/store/products`;

      const res = await sendRequest(targetUrl, storeHeaders);
      results[idx] = res;
    }
  };

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);

  const totalTime = (performance.now() - startTotal) / 1000;
  const validResults = results.filter(Boolean);
  const successCount = validResults.filter(r => r.ok).length;
  const failureCount = validResults.filter(r => !r.ok).length;
  const durations = validResults.map(r => r.duration).sort((a, b) => a - b);

  const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
  const p95 = durations[Math.floor(durations.length * 0.95)] || 0;
  const p99 = durations[Math.floor(durations.length * 0.99)] || 0;
  const rps = totalRequests / totalTime;

  console.log('\n--- GATEWAY PROXY LOAD TEST RESULTS ---');
  console.log(`Total Duration: ${totalTime.toFixed(2)}s`);
  console.log(`Total Requests: ${totalRequests}`);
  console.log(`Successful (HTTP 2xx): ${successCount}`);
  console.log(`Failed (HTTP 5xx/Errors): ${failureCount}`);
  console.log(`Requests Per Second (RPS): ${rps.toFixed(2)}`);
  console.log(`Average Latency: ${avgDuration.toFixed(2)}ms`);
  console.log(`p95 Latency: ${p95.toFixed(2)}ms`);
  console.log(`p99 Latency: ${p99.toFixed(2)}ms`);
  console.log('----------------------------------------\n');
}

runLoadTest().catch(console.error);
