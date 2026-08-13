import { ApiEngine } from "../frontend/src/lib/api-engine";

async function verifyPhoneNumbers() {
  console.log("==================================================");
  console.log("RUNNING PHONE NUMBER AUTHENTICATION AUDIT");
  console.log("==================================================");

  const tests = [
    { label: "SUPER ADMIN (Phone: 9876500000)", phone: "9876500000", expectedRole: "SUPER_ADMIN", expectedUrl: "/dashboard" },
    { label: "SUPER ADMIN (Keyword: admin)", phone: "admin", expectedRole: "SUPER_ADMIN", expectedUrl: "/dashboard" },
    { label: "BRANCH MANAGER (Phone: 9876500001)", phone: "9876500001", expectedRole: "BRANCH_MANAGER", expectedUrl: "/dashboard/shop" },
    { label: "BRANCH MANAGER (Keyword: manager)", phone: "manager", expectedRole: "BRANCH_MANAGER", expectedUrl: "/dashboard/shop" },
    { label: "DELIVERY PARTNER (Phone: 9876500001 in DLP scope)", phone: "9876500001", expectedRole: "DELIVERY_PARTNER", expectedUrl: "/dashboard/delivery-partner", roleHint: "DELIVERY_PARTNER" },
    { label: "DELIVERY PARTNER (Keyword: driver)", phone: "driver", expectedRole: "DELIVERY_PARTNER", expectedUrl: "/dashboard/delivery-partner" },
    { label: "EXISTING CUSTOMER (Phone: 9876543210)", phone: "9876543210", expectedRole: "CUSTOMER", expectedUrl: "/account" },
  ];

  for (const t of tests) {
    try {
      const check = ApiEngine.checkAccountByPhone(t.phone);
      const res = ApiEngine.verifyOtp(t.phone, "123456");
      const otpAccepted = res.success === true;
      const roleResolved = res.role === t.expectedRole || check.role === t.expectedRole;
      const sessionCreated = Boolean(res.accessToken && res.user);
      const pass = otpAccepted && roleResolved && sessionCreated;
      
      console.log(`${t.label} | OTP Accepted: ${otpAccepted} | Role: ${res.role || check.role} | Redirect: ${t.expectedUrl} | Session: ${sessionCreated} | RESULT: ${pass ? "PASS" : "FAIL"}`);
    } catch (e: any) {
      console.log(`${t.label} | ERROR: ${e.message} | RESULT: FAIL`);
    }
  }
}

verifyPhoneNumbers();
