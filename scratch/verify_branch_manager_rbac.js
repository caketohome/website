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

async function runRbacVerification() {
    console.log("==================================================================");
    console.log("VERIFYING ENTERPRISE BRANCH MANAGER ASSIGNMENT, AUTO-LINKING & RBAC");
    console.log("==================================================================");

    // 1. Assign Manager "Rahul Kumar" to Branch "br_indiranagar"
    console.log("\n1. Super Admin Assigning Manager to Branch ('br_indiranagar')...");
    const assignRes = await postJson('http://localhost:3001/api/v1/admin/branches', {
        type: "assign_manager",
        branchId: "br_indiranagar",
        manager: {
            employee_id: "EMP-9088",
            name: "Rahul Kumar",
            phone: "+91 98765 90888",
            email: "rahul.hsr@cakes2home.com",
            emergency_contact: "+91 98765 99999",
            status: "active"
        }
    });
    console.log(`   Assign Manager Status: ${assignRes.status}`);
    console.log(`   Assigned Account:`, assignRes.data?.manager);

    // 2. Test Automatic Phone/Email Login Linking for "rahul.hsr@cakes2home.com"
    console.log("\n2. Testing Automatic Login Linking for Assigned Manager...");
    const loginRes = await postJson('http://localhost:3001/api/v1/auth/verify-otp', {
        phone: "rahul.hsr@cakes2home.com",
        code: "123456"
    });
    console.log(`   Verification Status: ${loginRes.status}`);
    console.log(`   Detected Role: ${loginRes.data?.role}`);
    console.log(`   Auto-Linked Branch ID: ${loginRes.data?.branch_id}`);
    console.log(`   User Payload:`, loginRes.data?.user);

    // 3. Test Manager Account Suspension
    console.log("\n3. Testing Super Admin Manager Account Suspension...");
    const suspendRes = await postJson('http://localhost:3001/api/v1/admin/branches', {
        type: "suspend_manager",
        branchId: "br_indiranagar",
        suspend: true
    });
    console.log(`   Suspend Status: ${suspendRes.status}`);
    console.log(`   Updated Account Status: ${suspendRes.data?.manager?.status}`);

    // 4. Test Login Attempt while Suspended (Must Fail)
    console.log("\n4. Testing Login Attempt on Suspended Manager Account...");
    let suspendedLoginErr = false;
    try {
        const suspendedLogin = await postJson('http://localhost:3001/api/v1/auth/verify-otp', {
            phone: "rahul.hsr@cakes2home.com",
            code: "123456"
        });
        console.log(`   Suspended Login Response Status: ${suspendedLogin.status}`);
        console.log(`   Suspended Login Payload:`, suspendedLogin.data);
        if (suspendedLogin.data?.error?.includes("Suspended")) {
            suspendedLoginErr = true;
        }
    } catch {
        suspendedLoginErr = true;
    }

    // 5. Reactivate Manager Account
    console.log("\n5. Super Admin Reactivating Manager Account...");
    await postJson('http://localhost:3001/api/v1/admin/branches', {
        type: "suspend_manager",
        branchId: "br_indiranagar",
        suspend: false
    });

    // 6. Test Single-Branch Scoped Control Center Access (/dashboard/shop)
    console.log("\n6. Testing Branch Manager Dashboard Access (/dashboard/shop)...");
    const dashRes = await getUrl('http://localhost:3001/dashboard/shop', '_cth_role=shop; _cth_jwt=mock_jwt_access_token');
    console.log(`   Dashboard HTTP Status: ${dashRes.status}`);
    const isDashboardLoaded = dashRes.status === 200 && dashRes.text.includes("Shop Dashboard");
    console.log(`   Dashboard Loaded cleanly: ${isDashboardLoaded ? "YES ✅" : "NO ❌"}`);

    if (assignRes.status === 200 && loginRes.data?.role === "BRANCH_MANAGER" && loginRes.data?.branch_id === "br_indiranagar" && suspendedLoginErr && isDashboardLoaded) {
        console.log("\n✅ Enterprise Branch Manager Assignment, Auto-Linking & RBAC Verification Passed Successfully!");
    } else {
        console.error("❌ RBAC Verification Failed!");
        process.exit(1);
    }
}

runRbacVerification().catch(err => {
    console.error("❌ Verification error:", err);
    process.exit(1);
});
