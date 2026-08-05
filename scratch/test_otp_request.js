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

async function testOtpFlow() {
    console.log("==================================================================");
    console.log("VERIFYING AUTH OTP API ROUTES (/api/v1/auth/request-otp)");
    console.log("==================================================================");

    // 1. Test Request OTP (/auth/request-otp)
    console.log("\n1. Testing POST http://localhost:3000/api/v1/auth/request-otp...");
    const reqRes = await postJson('http://localhost:3000/api/v1/auth/request-otp', { phone: "9876543210" });
    console.log(`   Status: ${reqRes.status}`);
    console.log(`   Response:`, reqRes.data);

    // 2. Test Verify OTP (/auth/verify-otp)
    console.log("\n2. Testing POST http://localhost:3000/api/v1/auth/verify-otp...");
    const verRes = await postJson('http://localhost:3000/api/v1/auth/verify-otp', { phone: "9876543210", code: "123456" });
    console.log(`   Status: ${verRes.status}`);
    console.log(`   Response:`, verRes.data);

    if (reqRes.status === 200 && verRes.status === 200 && reqRes.data?.success && verRes.data?.accessToken) {
        console.log("\n✅ Auth OTP Request & Verify API Flow Passed Successfully!");
    } else {
        console.error("❌ Auth OTP Verification Failed!");
        process.exit(1);
    }
}

testOtpFlow().catch(err => {
    console.error("❌ Error executing test:", err);
    process.exit(1);
});
