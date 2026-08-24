async function checkDirect() {
  const url = "http://localhost:3000/_next/static/chunks/app/dashboard/page.js";
  const res = await fetch(url);
  console.log(`Direct fetch ${url}:`);
  console.log(`  Status: ${res.status} ${res.statusText}`);
  console.log(`  Content-Type: ${res.headers.get("content-type")}`);
  console.log(`  Body preview:\n${(await res.text()).substring(0, 300)}`);

  const url2 = "http://localhost:3000/_next/static/chunks/app/dashboard/layout.js";
  const res2 = await fetch(url2);
  console.log(`\nDirect fetch ${url2}:`);
  console.log(`  Status: ${res2.status} ${res2.statusText}`);
  console.log(`  Content-Type: ${res2.headers.get("content-type")}`);
  console.log(`  Body preview:\n${(await res2.text()).substring(0, 300)}`);
}

checkDirect().catch(console.error);
