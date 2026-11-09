async function test() {
  console.log('Sending request to http://127.0.0.1:3000/invoices/CH-26-27-000216 ...');
  const res = await fetch('http://127.0.0.1:3000/invoices/CH-26-27-000216', { signal: AbortSignal.timeout(15000) });
  console.log('Status:', res.status);
  const text = await res.text();
  console.log('Body length:', text.length);
  if (text.includes('STATUTORY TAX INVOICE')) {
    console.log('✅ Found STATUTORY TAX INVOICE!');
  } else if (text.includes('404')) {
    console.log('Got 404 in body!');
  } else {
    console.log('First 500 chars of body:', text.substring(0, 500));
  }
}
test().catch(console.error);
