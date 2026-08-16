import http from "http";

async function check() {
  const res = await fetch("http://localhost:3000/");
  console.log("Status:", res.status);
  const html = await res.text();
  console.log("HTML length:", html.length);
  
  const assetRegex = /\/_next\/static\/[^"'\s>]+/g;
  const matches = html.match(assetRegex) || [];
  console.log(`Found ${matches.length} static asset links in HTML`);

  for (const asset of matches.slice(0, 15)) {
    const assetRes = await fetch(`http://localhost:3000${asset}`);
    console.log(`Asset: ${asset} -> HTTP ${assetRes.status}`);
  }
}

check().catch(console.error);
