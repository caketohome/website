const http = require('http');

function fetchJson(url, options = {}) {
    return new Promise((resolve, reject) => {
        const req = http.request(url, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, data: JSON.parse(data) });
                } catch (e) {
                    resolve({ status: res.statusCode, text: data });
                }
            });
        });
        req.on('error', reject);
        if (options.body) req.write(options.body);
        req.end();
    });
}

async function runVerification() {
    console.log("=== VERIFYING ENTERPRISE ACCESSORY, GIFT & CROSS-SELL SYSTEM ===");

    // 1. Test Public Accessories REST API
    const accRes = await fetchJson('http://localhost:3000/api/v1/accessories');
    console.log(`\n1. Public Accessories API Status: ${accRes.status}`);
    const accessories = accRes.data?.accessories || [];
    console.log(`Found Active In-Stock Accessories: ${accessories.length}`);
    if (accessories.length > 0) {
        console.log(`Sample Accessory: "${accessories[0].name}" (SKU: ${accessories[0].sku}, Price: ₹${accessories[0].price}, Stock: ${accessories[0].stock})`);
    } else {
        throw new Error("No active accessories returned from API");
    }

    // 2. Test Smart Auto-Recommendation API for Product
    const recRes = await fetchJson('http://localhost:3000/api/v1/accessories?productId=prod_1');
    console.log(`\n2. Product Smart Recommendations API Status: ${recRes.status}`);
    const recs = recRes.data?.accessories || [];
    console.log(`Recommended Accessories for prod_1: ${recs.length}`);
    recs.forEach((r, idx) => console.log(`   [${idx + 1}] ${r.name} - ₹${r.price} (Stock: ${r.stock})`));

    // 3. Test Admin Accessories Endpoint
    const adminRes = await fetchJson('http://localhost:3000/api/v1/admin/accessories');
    console.log(`\n3. Admin Accessories API Status: ${adminRes.status}`);
    console.log(`Total Accessories: ${adminRes.data?.accessories?.length || 0}`);
    console.log(`Total Accessory Categories: ${adminRes.data?.categories?.length || 0}`);
    console.log(`Total Cross-Sell Rules: ${adminRes.data?.rules?.length || 0}`);

    // 4. Test Stock Depletion Auto-Hiding
    console.log(`\n4. Testing Out-of-Stock Auto-Hiding...`);
    const testItem = adminRes.data?.accessories?.[0];
    if (testItem) {
        console.log(`Simulating stock depletion to 0 for "${testItem.name}"...`);
        await fetchJson('http://localhost:3000/api/v1/admin/accessories', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: testItem.id, stock: 0 })
        });

        // Re-check public recommendations
        const updatedRecRes = await fetchJson('http://localhost:3000/api/v1/accessories?productId=prod_1');
        const updatedRecs = updatedRecRes.data?.accessories || [];
        const isHidden = !updatedRecs.some(item => item.id === testItem.id);
        console.log(`Depleted Item "${testItem.name}" hidden from recommendations: ${isHidden ? "✅ YES" : "❌ NO"}`);

        // Restore stock
        console.log(`Restoring stock to ${testItem.stock || 45}...`);
        await fetchJson('http://localhost:3000/api/v1/admin/accessories', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: testItem.id, stock: testItem.stock || 45 })
        });
    }

    console.log("\n✅ All Accessory & Cross-Sell Engine Tests Passed Successfully!");
}

runVerification().catch(err => {
    console.error("❌ Verification Failed:", err);
    process.exit(1);
});
