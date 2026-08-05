const http = require('http');

function postJson(url, body) {
    return new Promise((resolve, reject) => {
        const payload = JSON.stringify(body);
        const req = http.request(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
            }
        }, (res) => {
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
        req.write(payload);
        req.end();
    });
}

function getUrl(url, cookieHeader) {
    return new Promise((resolve, reject) => {
        const req = http.get(url, {
            headers: {
                'Cookie': cookieHeader || ''
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                resolve({ status: res.statusCode, text: data });
            });
        });
        req.on('error', reject);
    });
}

async function testBranchManagerLogin() {
    console.log("==================================================================");
    console.log("VERIFYING BRANCH MANAGER LOGIN & DASHBOARD ROUTING (/dashboard/shop)");
    console.log("==================================================================");

    // 1. Test Request OTP for Branch Manager (using "manager" / "branch" / "shop")
    console.log("\n1. Requesting OTP for Branch Manager input ('manager@cakes2home.com')...");
    const reqRes = await postJson('http://localhost:3000/api/v1/auth/request-otp', { phone: "manager@cakes2home.com" });
    console.log(`   Status: ${reqRes.status}`);
    console.log(`   OTP Sent Response:`, reqRes.data);

    // 2. Test Verify OTP for Branch Manager
    console.log("\n2. Verifying OTP for Branch Manager...");
    const verRes = await postJson('http://localhost:3000/api/v1/auth/verify-otp', { phone: "manager@cakes2home.com", code: "123456" });
    console.log(`   Status: ${verRes.status}`);
    console.log(`   Verification Response:`, verRes.data);

    // 3. Verify Branch Manager Shop Dashboard HTTP Access (/dashboard/shop)
    console.log("\n3. Testing HTTP Access to Branch Manager Dashboard (/dashboard/shop)...");
    const dashRes = await getUrl('http://localhost:3000/dashboard/shop', '_cth_role=shop; _cth_jwt=mock_jwt_access_token_customer_2026');
    console.log(`   Status: ${dashRes.status}`);
    const isDashboardLoaded = dashRes.status === 200 && dashRes.text.includes("Shop Dashboard");
    console.log(`   Dashboard Loaded: ${isDashboardLoaded ? "YES ✅" : "NO ❌"}`);

    if (reqRes.status === 200 && verRes.status === 200 && isDashboardLoaded) {
        console.log("\n✅ Branch Manager Login & Dashboard Routing Flow Passed Successfully!");
    } else {
        console.error("❌ Branch Manager Login Test Failed!");
        process.exit(1);
    }
}

testBranchManagerLogin().catch(err => {
    console.error("❌ Error executing test:", err);
    process.exit(1);
});
