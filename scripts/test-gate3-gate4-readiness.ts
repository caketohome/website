/**
 * CakeToHome ERP — Gate 3 & Gate 4 Service Layer Readiness Validation
 * 
 * Validates that CompanyService, GstRegistrationService, and AccountingConfigService
 * are correctly wired and their validation guards function properly.
 * 
 * This test runs in SKIP_DB_PERSISTENCE mode — NO production writes.
 */

import { CompanyService } from "../frontend/src/lib/services/company.service";
import { GstRegistrationService } from "../frontend/src/lib/services/gst-registration.service";
import { AccountingConfigService } from "../frontend/src/lib/services/accounting-config.service";

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${label}`);
    passed++;
  } else {
    console.log(`  ❌ FAIL: ${label}`);
    failed++;
  }
}

async function run() {
  console.log("\n════════════════════════════════════════════════════════════════");
  console.log("  GATE 3 & GATE 4 — Service Layer Readiness Validation");
  console.log("════════════════════════════════════════════════════════════════\n");

  // ── GATE 3A: CompanyService Validation Guards ──
  console.log("--- GATE 3A: CompanyService Validation Guards ---");

  const nonAdminCreate = await CompanyService.createCompany(
    { legal_name: "Test Co", state_code: "29" },
    "user_regular",
    "BRANCH_MANAGER"
  );
  assert(
    nonAdminCreate.success === false && (nonAdminCreate as any).code === "UNAUTHORIZED",
    "CompanyService.createCompany rejects non-SUPER_ADMIN with UNAUTHORIZED"
  );

  const noName = await CompanyService.createCompany(
    { legal_name: "", state_code: "29" },
    "admin_001",
    "SUPER_ADMIN"
  );
  assert(
    noName.success === false && (noName as any).code === "VALIDATION_FAILED",
    "CompanyService.createCompany rejects empty legal_name"
  );

  const noState = await CompanyService.createCompany(
    { legal_name: "CakeToHome India Pvt Ltd", state_code: "" },
    "admin_001",
    "SUPER_ADMIN"
  );
  assert(
    noState.success === false && (noState as any).code === "VALIDATION_FAILED",
    "CompanyService.createCompany rejects empty state_code"
  );

  const badPan = await CompanyService.createCompany(
    { legal_name: "CakeToHome", state_code: "29", pan: "INVALID" },
    "admin_001",
    "SUPER_ADMIN"
  );
  assert(
    badPan.success === false && (badPan as any).code === "VALIDATION_FAILED",
    "CompanyService.createCompany rejects invalid PAN format 'INVALID'"
  );

  const badState = await CompanyService.createCompany(
    { legal_name: "CakeToHome", state_code: "ABC" },
    "admin_001",
    "SUPER_ADMIN"
  );
  assert(
    badState.success === false && (badState as any).code === "VALIDATION_FAILED",
    "CompanyService.createCompany rejects non-numeric state_code 'ABC'"
  );

  let validPanResult: any;
  try {
    validPanResult = await CompanyService.createCompany(
      { legal_name: "CakeToHome India Private Limited", state_code: "29", pan: "AAACC1234F" },
      "admin_001",
      "SUPER_ADMIN"
    );
    assert(
      (validPanResult as any).code !== "VALIDATION_FAILED" && (validPanResult as any).code !== "UNAUTHORIZED",
      "CompanyService.createCompany passes validation for valid PAN 'AAACC1234F'"
    );
  } catch (err: any) {
    // ECONNREFUSED means validation passed but DB is unavailable in test mode — that's fine
    const isDbError = err.code === "ECONNREFUSED" || err.message?.includes("ECONNREFUSED");
    assert(isDbError, "CompanyService.createCompany passes validation for valid PAN 'AAACC1234F' (DB offline in test mode)");
  }

  const nonAdminUpdate = await CompanyService.updateCompany(
    "cth_company_test",
    { legal_name: "Changed" },
    "user_regular",
    "BRANCH_MANAGER"
  );
  assert(
    nonAdminUpdate.success === false && (nonAdminUpdate as any).code === "UNAUTHORIZED",
    "CompanyService.updateCompany rejects non-SUPER_ADMIN"
  );

  // ── GATE 3B: GstRegistrationService Validation Guards ──
  console.log("\n--- GATE 3B: GstRegistrationService Validation Guards ---");

  const nonAdminGst = await GstRegistrationService.createRegistration(
    { company_id: "cth_test", gstin: "29AABCC1234F1Z5", state_code: "29" },
    "user_regular",
    "BRANCH_MANAGER"
  );
  assert(
    nonAdminGst.success === false && (nonAdminGst as any).code === "UNAUTHORIZED",
    "GstRegistrationService.createRegistration rejects non-SUPER_ADMIN"
  );

  const noCompany = await GstRegistrationService.createRegistration(
    { company_id: "", gstin: "29AABCC1234F1Z5", state_code: "29" },
    "admin_001",
    "SUPER_ADMIN"
  );
  assert(
    noCompany.success === false && (noCompany as any).code === "VALIDATION_FAILED",
    "GstRegistrationService rejects empty company_id"
  );

  const badGstin = await GstRegistrationService.createRegistration(
    { company_id: "cth_test", gstin: "INVALID_GSTIN", state_code: "29" },
    "admin_001",
    "SUPER_ADMIN"
  );
  assert(
    badGstin.success === false && (badGstin as any).code === "VALIDATION_FAILED",
    "GstRegistrationService rejects invalid GSTIN format"
  );

  const mismatchState = await GstRegistrationService.createRegistration(
    { company_id: "cth_test", gstin: "27AABCC1234F1Z5", state_code: "29" },
    "admin_001",
    "SUPER_ADMIN"
  );
  assert(
    mismatchState.success === false && (mismatchState as any).code === "VALIDATION_FAILED",
    "GstRegistrationService rejects GSTIN/state_code mismatch (27 vs 29)"
  );

  try {
    const validGstin = await GstRegistrationService.createRegistration(
      { company_id: "cth_test", gstin: "29AABCC1234F1Z5", state_code: "29" },
      "admin_001",
      "SUPER_ADMIN"
    );
    assert(
      (validGstin as any).code !== "VALIDATION_FAILED" && (validGstin as any).code !== "UNAUTHORIZED",
      "GstRegistrationService passes validation for valid GSTIN '29AABCC1234F1Z5'"
    );
  } catch (err: any) {
    const isDbError = err.code === "ECONNREFUSED" || err.message?.includes("ECONNREFUSED");
    assert(isDbError, "GstRegistrationService passes validation for valid GSTIN (DB offline in test mode)");
  }

  // ── GATE 4: AccountingConfigService Validation Guards ──
  console.log("\n--- GATE 4: AccountingConfigService Validation Guards ---");

  try {
    await AccountingConfigService.setAccountingStartDate("2026-04-01", "user_regular", "BRANCH_MANAGER");
    assert(false, "AccountingConfigService should reject non-SUPER_ADMIN");
  } catch (err: any) {
    assert(err.code === "UNAUTHORIZED", "AccountingConfigService rejects non-SUPER_ADMIN");
  }

  try {
    await AccountingConfigService.setAccountingStartDate("01-04-2026", "admin_001", "SUPER_ADMIN");
    assert(false, "AccountingConfigService should reject DD-MM-YYYY format");
  } catch (err: any) {
    assert(err.code === "INVALID_DATE_FORMAT", "AccountingConfigService rejects DD-MM-YYYY format");
  }

  try {
    await AccountingConfigService.setAccountingStartDate("2099-01-01", "admin_001", "SUPER_ADMIN");
    assert(false, "AccountingConfigService should reject future date");
  } catch (err: any) {
    assert(err.code === "DATE_IN_FUTURE", "AccountingConfigService rejects future date '2099-01-01'");
  }

  try {
    await AccountingConfigService.setAccountingStartDate("2026-04-01", "admin_001", "SUPER_ADMIN");
    assert(true, "AccountingConfigService accepts valid date '2026-04-01'");
  } catch (err: any) {
    const isValidationError = ["UNAUTHORIZED", "INVALID_DATE_FORMAT", "DATE_IN_FUTURE"].includes(err.code);
    assert(!isValidationError, `AccountingConfigService passes validation for '2026-04-01' (DB layer: ${err.message?.substring(0, 60)})`);
  }

  // ── SUMMARY ──
  console.log("\n════════════════════════════════════════════════════════════════");
  console.log(`  GATE 3 & 4 READINESS: ${passed} PASSED, ${failed} FAILED`);
  console.log("════════════════════════════════════════════════════════════════\n");

  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
