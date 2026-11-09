/**
 * Diagnostic & Regression Test Suite: Database Target Isolation Guardrail
 * Covers: missing, malformed, local, and forbidden remote targets.
 */

import { getConnectionString } from "../src/lib/db";

interface TestCase {
  name: string;
  env: {
    NODE_ENV?: string;
    TEST_DATABASE_URL?: string;
    DATABASE_URL?: string;
  };
  expectedResult: "PASS_LOCAL" | "THROW_SECURITY" | "THROW_MALFORMED";
  expectedErrorSubstrings?: string[];
}

const testCases: TestCase[] = [
  {
    name: "1. Missing TEST_DATABASE_URL in test mode must fail closed (no fallback to remote DATABASE_URL)",
    env: {
      NODE_ENV: "test",
      TEST_DATABASE_URL: undefined,
      DATABASE_URL: "postgresql://postgres.uubwhsnnrnicyczwqlbq:secret@aws-1-ap-south-1.pooler.supabase.com:6543/postgres",
    },
    expectedResult: "THROW_SECURITY",
    expectedErrorSubstrings: ["FAIL-CLOSED", "TEST_DATABASE_URL is required in test", "Refusing to fallback"],
  },
  {
    name: "2. Forbidden remote Supabase target in TEST_DATABASE_URL must abort immediately",
    env: {
      NODE_ENV: "test",
      TEST_DATABASE_URL: "postgresql://postgres:secret@aws-1-ap-south-1.pooler.supabase.com:6543/postgres",
      DATABASE_URL: undefined,
    },
    expectedResult: "THROW_SECURITY",
    expectedErrorSubstrings: ["CRITICAL SECURITY ABORT", "production Supabase host"],
  },
  {
    name: "3. Malformed database URL must fail validation cleanly",
    env: {
      NODE_ENV: "test",
      TEST_DATABASE_URL: "not_a_valid_url:::://??",
      DATABASE_URL: undefined,
    },
    expectedResult: "THROW_MALFORMED",
    expectedErrorSubstrings: ["Security validation failed", "Invalid URL"],
  },
  {
    name: "4. Non-localhost remote IP/domain in test mode must abort",
    env: {
      NODE_ENV: "test",
      TEST_DATABASE_URL: "postgresql://cth_user:secret@192.168.1.100:5432/cth_db",
      DATABASE_URL: undefined,
    },
    expectedResult: "THROW_SECURITY",
    expectedErrorSubstrings: ["SECURITY ABORT", "not an isolated localhost"],
  },
  {
    name: "5. Authorized isolated localhost target must resolve successfully",
    env: {
      NODE_ENV: "test",
      TEST_DATABASE_URL: "postgresql://cth_test_user@127.0.0.1:5433/cth_test",
      DATABASE_URL: undefined,
    },
    expectedResult: "PASS_LOCAL",
  },
];

async function runTests() {
  console.log("================================================================================");
  console.log("  DATABASE TARGET GUARDRAIL ISOLATION TEST SUITE");
  console.log("================================================================================\n");

  const originalEnv = { ...process.env };
  let passed = 0;
  let failed = 0;

  for (const tc of testCases) {
    // Setup environment for test case
    delete process.env.TEST_DATABASE_URL;
    delete process.env.DATABASE_URL;
    if (tc.env.NODE_ENV) process.env.NODE_ENV = tc.env.NODE_ENV;
    if (tc.env.TEST_DATABASE_URL) process.env.TEST_DATABASE_URL = tc.env.TEST_DATABASE_URL;
    if (tc.env.DATABASE_URL) process.env.DATABASE_URL = tc.env.DATABASE_URL;

    try {
      const resolved = getConnectionString();
      if (tc.expectedResult === "PASS_LOCAL") {
        if (resolved === tc.env.TEST_DATABASE_URL) {
          console.log(`✅ [PASS] ${tc.name}`);
          passed++;
        } else {
          console.error(`❌ [FAIL] ${tc.name} — Expected '${tc.env.TEST_DATABASE_URL}', got '${resolved}'`);
          failed++;
        }
      } else {
        console.error(`❌ [FAIL] ${tc.name} — Expected error but got resolved URL: ${resolved}`);
        failed++;
      }
    } catch (err: any) {
      if (tc.expectedResult === "PASS_LOCAL") {
        console.error(`❌ [FAIL] ${tc.name} — Unexpected error thrown: ${err.message}`);
        failed++;
      } else {
        const matches = tc.expectedErrorSubstrings?.some((sub) => err.message.includes(sub));
        if (matches) {
          console.log(`✅ [PASS] ${tc.name}`);
          console.log(`     Captured expected error: "${err.message}"`);
          passed++;
        } else {
          console.error(`❌ [FAIL] ${tc.name} — Error thrown but didn't match expected substrings: "${err.message}"`);
          failed++;
        }
      }
    }
  }

  // Restore environment
  process.env = originalEnv;

  console.log("\n--------------------------------------------------------------------------------");
  console.log(`  GUARDRAIL RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("--------------------------------------------------------------------------------\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
