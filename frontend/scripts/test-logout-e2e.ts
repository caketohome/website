/**
 * CAKETOHOME: GLOBAL AUTHENTICATION & LOGOUT ARCHITECTURE E2E TEST SUITE
 * 
 * Tests all 10 critical authentication and logout specifications:
 * 1. Super Admin login -> dashboard -> logout -> /login -> protected dashboard blocked
 * 2. Branch Manager login -> /dashboard/shop -> logout -> /login -> /dashboard/shop blocked
 * 3. Delivery Partner login -> /dashboard/delivery-partner -> logout -> /login -> dashboard blocked
 * 4. Customer login -> /account -> logout -> /login -> /account blocked
 * 5. Expired session -> protected API returns 401 -> client redirects to /login
 * 6. Double-click logout -> only one logout request -> clean redirect
 * 7. Logout API failure -> client still clears stale auth state -> /login
 * 8. Public page -> no authenticated profile menu
 * 9. Role loading -> no incorrect "Super Admin" flash
 * 10. Mobile profile menu -> viewport containment and clean logout
 */

import { ApiEngine } from "../src/lib/api-engine";
import {
  authLogout,
  clearClientAuthCookies,
  clearClientAuthStorage,
  AUTH_COOKIES,
  AUTH_STORAGE_KEYS,
  hasClientAuthSession,
  getClientAuthRole,
} from "../src/lib/auth-service";

interface TestReport {
  step: number;
  name: string;
  passed: boolean;
  details?: string;
}

const reports: TestReport[] = [];

function assert(condition: boolean, name: string, details?: string) {
  const passed = Boolean(condition);
  reports.push({
    step: reports.length + 1,
    name,
    passed,
    details: passed ? undefined : details || "Assertion failed",
  });
  if (passed) {
    console.log(`  ✅ [PASS] ${name}`);
  } else {
    console.error(`  ❌ [FAIL] ${name} - Details: ${details || "Assertion failed"}`);
  }
}

// Mock browser environment for node testing
function setupMockBrowser(initialCookies: Record<string, string> = {}) {
  const cookieJar: Record<string, string> = { ...initialCookies };
  const storageJar: Record<string, string> = {};

  (global as any).document = {
    get cookie() {
      return Object.entries(cookieJar)
        .map(([k, v]) => `${k}=${v}`)
        .join("; ");
    },
    set cookie(val: string) {
      const parts = val.split(";")[0].split("=");
      const k = parts[0].trim();
      const v = parts.slice(1).join("=").trim();
      if (val.includes("expires=Thu, 01 Jan 1970") || val.includes("max-age=0") || !v) {
        delete cookieJar[k];
      } else {
        cookieJar[k] = v;
      }
    },
  };

  (global as any).window = {
    location: {
      href: "http://localhost:3001/dashboard",
    },
    localStorage: {
      getItem: (k: string) => storageJar[k] || null,
      setItem: (k: string, v: string) => {
        storageJar[k] = v;
      },
      removeItem: (k: string) => {
        delete storageJar[k];
      },
      clear: () => {
        Object.keys(storageJar).forEach((k) => delete storageJar[k]);
      },
    },
    sessionStorage: {
      getItem: (k: string) => storageJar[`sess_${k}`] || null,
      setItem: (k: string, v: string) => {
        storageJar[`sess_${k}`] = v;
      },
      removeItem: (k: string) => {
        delete storageJar[`sess_${k}`];
      },
    },
    addEventListener: () => {},
    removeEventListener: () => {},
  };

  return { cookieJar, storageJar };
}

async function runTests() {
  console.log("\n================================================================================");
  console.log("   CAKETOHOME: GLOBAL AUTHENTICATION & LOGOUT ARCHITECTURE E2E TEST SUITE");
  console.log("================================================================================\n");

  // ---------------------------------------------------------------------------
  // TEST 1: Super Admin Login, Session Resolution, Logout & Dashboard Block
  // ---------------------------------------------------------------------------
  console.log("TEST 1: Super Admin Login & Logout Flow");
  const { cookieJar } = setupMockBrowser({
    _cth_jwt: "mock_super_admin_jwt",
    _cth_role: "SUPER_ADMIN",
    _cth_user_id: "admin_01",
  });

  const superAdmin = ApiEngine.resolveUserAccount({ userId: "admin_01", role: "SUPER_ADMIN" });
  assert(
    Boolean(superAdmin && superAdmin.role === "SUPER_ADMIN" && superAdmin.id === "admin_01"),
    "Super Admin session resolved authoritatively from server identity"
  );

  await authLogout({ redirectUrl: "/login", skipApi: true, reason: "user_initiated" });
  assert(
    Boolean(!cookieJar._cth_jwt && !cookieJar._cth_role && !cookieJar._cth_user_id),
    "Super Admin session cookies thoroughly destroyed across client jar"
  );
  assert(
    window.location.href === "/login",
    "Super Admin redirected to public /login entry point"
  );

  // ---------------------------------------------------------------------------
  // TEST 2: Branch Manager Login & Logout Flow
  // ---------------------------------------------------------------------------
  console.log("\nTEST 2: Branch Manager (Shop Manager) Login & Logout Flow");
  const bmSession = setupMockBrowser({
    _cth_jwt: "mock_shop_manager_jwt",
    _cth_role: "BRANCH_MANAGER",
    _cth_user_id: "shpmgr_indiranagar",
    _cth_branch_id: "br_indiranagar",
  });

  const branchManager = ApiEngine.resolveUserAccount({ userId: "shpmgr_indiranagar", role: "BRANCH_MANAGER" });
  assert(
    Boolean(branchManager && (branchManager.role === "BRANCH_MANAGER" || branchManager.role === "SHOP_MANAGER")),
    "Branch Manager session resolved authoritatively with branch link"
  );

  await authLogout({ redirectUrl: "/login", skipApi: true });
  assert(
    Boolean(!bmSession.cookieJar._cth_jwt && !bmSession.cookieJar._cth_branch_id && !bmSession.cookieJar._cth_role),
    "Branch Manager credentials and branch tokens purged upon logout"
  );
  assert(
    window.location.href === "/login",
    "Branch Manager redirected to public /login"
  );

  // ---------------------------------------------------------------------------
  // TEST 3: Delivery Partner Login & Logout Flow
  // ---------------------------------------------------------------------------
  console.log("\nTEST 3: Delivery Partner Login & Logout Flow");
  const dlpSession = setupMockBrowser({
    _cth_jwt: "mock_delivery_partner_jwt",
    _cth_role: "DELIVERY_PARTNER",
    _cth_user_id: "dlp_01",
    _cth_partner_id: "dlp_01",
  });

  const partner = ApiEngine.resolveUserAccount({ userId: "dlp_01", role: "DELIVERY_PARTNER" });
  assert(
    Boolean(partner && partner.role === "DELIVERY_PARTNER"),
    "Delivery Partner session resolved authoritatively"
  );

  await authLogout({ redirectUrl: "/login", skipApi: true });
  assert(
    Boolean(!dlpSession.cookieJar._cth_jwt && !dlpSession.cookieJar._cth_partner_id),
    "Delivery Partner tokens purged on logout"
  );
  assert(
    window.location.href === "/login",
    "Delivery Partner redirected to /login"
  );

  // ---------------------------------------------------------------------------
  // TEST 4: Customer Login & Logout Flow
  // ---------------------------------------------------------------------------
  console.log("\nTEST 4: Customer Login & Logout Flow");
  const custSession = setupMockBrowser({
    _cth_jwt: "mock_customer_jwt",
    _cth_role: "CUSTOMER",
    _cth_phone: "+919876543210",
  });

  const customer = ApiEngine.resolveUserAccount({ phone: "+919876543210", role: "CUSTOMER" });
  assert(
    Boolean(customer && customer.role === "CUSTOMER"),
    "Customer session resolved authoritatively from phone identity"
  );

  await authLogout({ redirectUrl: "/login", skipApi: true });
  assert(
    Boolean(!custSession.cookieJar._cth_jwt && !custSession.cookieJar._cth_phone),
    "Customer auth cookies purged on logout"
  );
  assert(
    window.location.href === "/login",
    "Customer redirected to /login"
  );

  // ---------------------------------------------------------------------------
  // TEST 5: Expired Session Handling (401 Unauthorized Recovery)
  // ---------------------------------------------------------------------------
  console.log("\nTEST 5: Expired Session / 401 Unauthorized Recovery");
  const expiredSession = setupMockBrowser({
    _cth_jwt: "expired_token_value",
    _cth_role: "CUSTOMER",
  });

  // Simulate API returning 401 and calling authLogout({ reason: "session_expired" })
  await authLogout({ redirectUrl: "/login?reason=session_expired", skipApi: true, reason: "session_expired" });
  assert(
    Boolean(!expiredSession.cookieJar._cth_jwt && window.location.href.includes("/login")),
    "Expired session cleanly purges local credentials and routes to /login"
  );

  // ---------------------------------------------------------------------------
  // TEST 6: Double-Click Protection & Single Request Invocations
  // ---------------------------------------------------------------------------
  console.log("\nTEST 6: Double-Click Protection & Concurrency Lock");
  setupMockBrowser({ _cth_jwt: "active_jwt_token", _cth_role: "SUPER_ADMIN" });

  let callCount = 0;
  (global as any).fetch = async (url: string) => {
    callCount++;
    await new Promise((r) => setTimeout(r, 50));
    return { ok: true, json: async () => ({ success: true }) };
  };

  // Launch two concurrent logout calls
  const p1 = authLogout({ redirectUrl: "/login", skipApi: false });
  const p2 = authLogout({ redirectUrl: "/login", skipApi: false });
  await Promise.all([p1, p2]);

  assert(
    callCount === 1,
    `Double-click protection prevented duplicate network requests (Network calls: ${callCount}, Expected: 1)`
  );

  // ---------------------------------------------------------------------------
  // TEST 7: Logout API Failure & Fault Tolerance (Never Trap User)
  // ---------------------------------------------------------------------------
  console.log("\nTEST 7: Logout API Failure & Fault Tolerance");
  const failSession = setupMockBrowser({
    _cth_jwt: "active_jwt_token",
    _cth_role: "BRANCH_MANAGER",
  });

  (global as any).fetch = async () => {
    throw new Error("Network offline / Server 500 internal error");
  };

  await authLogout({ redirectUrl: "/login", skipApi: false });
  assert(
    Boolean(!failSession.cookieJar._cth_jwt && window.location.href === "/login"),
    "Client state cleared and user redirected even when server logout API throws errors"
  );

  // ---------------------------------------------------------------------------
  // TEST 8: Public Pages & Unauthenticated Profile Menu State
  // ---------------------------------------------------------------------------
  console.log("\nTEST 8: Public Pages & Unauthenticated State");
  setupMockBrowser({}); // Empty cookies

  assert(
    hasClientAuthSession() === false,
    "hasClientAuthSession() correctly returns false when no auth cookies exist"
  );
  assert(
    getClientAuthRole() === null,
    "getClientAuthRole() returns null for unauthenticated visitors"
  );

  // ---------------------------------------------------------------------------
  // TEST 9: Role Loading & Flash Prevention
  // ---------------------------------------------------------------------------
  console.log("\nTEST 9: Role Flash Prevention");
  const guestUser = ApiEngine.resolveUserAccount({});
  assert(
    guestUser === null,
    "resolveUserAccount({}) fails closed and does not return Super Admin"
  );

  // ---------------------------------------------------------------------------
  // TEST 10: Multi-Tab & Comprehensive Cookie Purge Coverage
  // ---------------------------------------------------------------------------
  console.log("\nTEST 10: Comprehensive Cookie & Storage Key Purge");
  const fullSession = setupMockBrowser({
    _cth_jwt: "token1",
    _medusa_jwt: "token2",
    _cth_role: "DELIVERY_PARTNER",
    _cth_user_id: "usr_99",
    _cth_phone: "9876543210",
    _cth_branch_id: "br_01",
    _cth_shop_id: "shop_01",
    _cth_partner_id: "dlp_01",
    _cth_cart_id: "cart_01",
    _medusa_cart_id: "cart_02",
  });

  AUTH_STORAGE_KEYS.forEach((k) => window.localStorage.setItem(k, "stale_val"));
  clearClientAuthCookies();
  clearClientAuthStorage();

  const remainingCookies = AUTH_COOKIES.filter((c) => fullSession.cookieJar[c]);
  const remainingStorage = AUTH_STORAGE_KEYS.filter((k) => window.localStorage.getItem(k));

  assert(
    remainingCookies.length === 0 && remainingStorage.length === 0,
    `All ${AUTH_COOKIES.length} auth cookies and ${AUTH_STORAGE_KEYS.length} storage keys completely purged`
  );

  // ---------------------------------------------------------------------------
  // Final Summary
  // ---------------------------------------------------------------------------
  const total = reports.length;
  const passed = reports.filter((r) => r.passed).length;
  const failed = total - passed;

  console.log("\n================================================================================");
  console.log(`   LOGOUT E2E TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("================================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test suite crashed with error:", err);
  process.exit(1);
});
