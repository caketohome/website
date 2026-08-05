const BASE_URL = 'http://localhost:9000';
const PUBLISHABLE_KEY = 'pk_7940766aa25f0496301693153851a2fa3fab6101b56602b448aab07e5021e554';

async function testInventoryConcurrency(concurrency = 25) {
  console.log(`Starting Inventory Concurrency Test: ${concurrency} simultaneous payment initiation requests with identical idempotency key...`);

  const storeHeaders = {
    'Content-Type': 'application/json',
    'x-publishable-api-key': PUBLISHABLE_KEY,
  };

  const idemKey = `concurrency_idem_${Date.now()}`;
  const payload = {
    amount: 1500,
    currency: 'INR',
    order_id: `order_conc_${Date.now()}`,
    branch_id: 'res_01KXYMAHGFPRY1G9TZKEVGAGAT',
    customer_id: 'cus_01KYWJADM819171B7VST0JKQWR',
    provider: 'cod',
    idempotency_key: idemKey,
  };

  const requests = Array.from({ length: concurrency }, () =>
    fetch(`${BASE_URL}/store/payments/initiate`, {
      method: 'POST',
      headers: storeHeaders,
      body: JSON.stringify(payload),
    }).then(async res => ({ status: res.status, data: await res.json() }))
  );

  const responses = await Promise.all(requests);
  const okResponses = responses.filter(r => r.status === 200);
  const txnIds = new Set(okResponses.map(r => r.data.session?.id).filter(Boolean));

  console.log('\n--- CONCURRENCY TEST RESULTS ---');
  console.log(`Simultaneous Requests: ${concurrency}`);
  console.log(`HTTP 200 Responses: ${okResponses.length}`);
  console.log(`Unique Payment Transaction IDs Created: ${txnIds.size}`);
  console.log(`Transaction ID: ${Array.from(txnIds)[0]}`);
  console.log('--------------------------------\n');

  if (txnIds.size === 1 && okResponses.length === concurrency) {
    console.log('PASS: Concurrency row-locking & idempotency validation succeeded! Exactly 1 transaction created across 25 simultaneous parallel requests.');
  } else {
    console.error('FAILED: Concurrency violation — multiple transactions created for same idempotency key!');
    process.exit(1);
  }
}

testInventoryConcurrency().catch(console.error);
