# Fiscal-Year Boundary Audit — Phase 4.2 Independent Forensic Audit

## 1. Engine Specification & Business Timezone Alignment

Statutory Indian fiscal periods under the Central Goods and Services Tax (CGST) Act and Income Tax Act operate from April 1 (00:00:00 IST) through March 31 (23:59:59.999 IST). Interpreting issue dates using UTC or local server time creates boundary skew where transactions occurring in India between 00:00:00 and 05:29:59 on April 1 are erroneously assigned to the previous fiscal year.

The authoritative engine is implemented in [`frontend/src/lib/fiscal-period.ts`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/fiscal-period.ts) using `Intl.DateTimeFormat` pinned to `timeZone: 'Asia/Kolkata'`.

---

## 2. Boundary Test Matrix & Execution Evidence

The test suite [`test_fiscal_boundary.cjs`](file:///e:/vig/.arena/scratch/test_fiscal_boundary.cjs) executed the complete boundary matrix.

Evidence artifact: [`artifacts/compliance/phase-4.2/run-20261031-140708-s523462/evidence/fiscal_boundary_results.json`](file:///e:/vig/cakes2home-main/cakes2home-main/artifacts/compliance/phase-4.2/run-20261031-140708-s523462/evidence/fiscal_boundary_results.json)

| Test Case Scenario | Input Value | Expected FY / String | Actual Resolved FY | Status |
| :--- | :--- | :---: | :---: | :---: |
| **Year-End Millisecond** | `2026-03-31T23:59:59.999+05:30` | 2025 (`25-26`) | 2025 (`25-26`) | **PASS** |
| **Equivalent UTC Boundary** | `2026-03-31T18:29:59.999Z` | 2025 (`25-26`) | 2025 (`25-26`) | **PASS** |
| **Fiscal Year Midnight Rollover** | `2026-04-01T00:00:00.000+05:30` | 2026 (`26-27`) | 2026 (`26-27`) | **PASS** |
| **UTC Cross-Calendar Skew Test** | `2026-03-31T18:30:00.000Z` (March 31 UTC) | 2026 (`26-27`) | 2026 (`26-27`) | **PASS** |
| **First Millisecond of FY** | `2026-04-01T00:00:00.001+05:30` | 2026 (`26-27`) | 2026 (`26-27`) | **PASS** |
| **Leap Day Test** | `2024-02-29T12:00:00+05:30` | 2023 (`23-24`) | 2023 (`23-24`) | **PASS** |
| **Calendar Year Rollover** | `2026-12-31T23:59:59+05:30` | 2026 (`26-27`) | 2026 (`26-27`) | **PASS** |
| **New Calendar Year Entry** | `2027-01-01T00:00:01+05:30` | 2026 (`26-27`) | 2026 (`26-27`) | **PASS** |
| **Numeric Timestamp** | `1775000000000` (Epoch timestamp) | 2026 (`26-27`) | 2026 (`26-27`) | **PASS** |
| **Native Date Object** | `new Date("2026-08-15T10:00:00+05:30")` | 2026 (`26-27`) | 2026 (`26-27`) | **PASS** |
| **Invalid String Rejection** | `'invalid-date-string'` | Throws `INVALID_ISSUE_DATE` | Threw `INVALID_ISSUE_DATE` | **PASS** |
| **Empty String Rejection** | `''` | Throws `INVALID_ISSUE_DATE` | Threw `INVALID_ISSUE_DATE` | **PASS** |
| **NaN Rejection** | `NaN` | Throws `INVALID_ISSUE_DATE` | Threw `INVALID_ISSUE_DATE` | **PASS** |
| **Null Input Rejection** | `null` | Throws `INVALID_ISSUE_DATE` | Threw `INVALID_ISSUE_DATE` | **PASS (REMEDIATED)** |
| **Default Parameter** | `undefined` | Current FY | Current FY | **PASS** |

---

## 3. Discovered Edge-Case Defect and Remediation

### Defect Identified
During the boundary audit, passing `null` to `resolveIndianFiscalYear(null)` caused JavaScript to evaluate `new Date(null)` as Unix epoch 0 (`1970-01-01T00:00:00.000Z`), resulting in `isNaN(d.getTime()) === false` and resolving to **FY 1969 (`69-70`)** instead of rejecting the input. If an order with `order.delivered_at = null` were processed, this would have generated an invalid 1969 fiscal year sequence lookup.

### Minimal Remediation Applied
In [`frontend/src/lib/fiscal-period.ts`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/fiscal-period.ts#L23-L28):
```ts
export function resolveIndianFiscalYear(issueDate: Date | string | number = new Date()): IndianFiscalYearInfo {
  if (issueDate === null || (typeof issueDate === "string" && issueDate.trim() === "")) {
    throw new Error(`INVALID_ISSUE_DATE: Cannot resolve fiscal year for empty or null date '${issueDate}'`);
  }

  const d = issueDate instanceof Date ? issueDate : new Date(issueDate);

  if (isNaN(d.getTime())) {
    throw new Error(`INVALID_ISSUE_DATE: Cannot resolve fiscal year for invalid date '${issueDate}'`);
  }
```
Re-testing confirmed that `null` now strictly raises `INVALID_ISSUE_DATE`, failing closed safely.

