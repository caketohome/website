/**
 * Indian Fiscal Year Resolution Engine
 *
 * Implements statutory Indian financial year calculation (April 1 – March 31)
 * aligned with the Goods and Services Tax (GST) Act and Income Tax Act rules.
 * All date interpretations strictly respect the Asia/Kolkata business timezone.
 */

export interface IndianFiscalYearInfo {
  fiscalYear: number; // e.g. 2026 for FY 2026-27
  startYear: number;  // 2026
  endYear: number;    // 2027
  fyString: string;   // "26-27"
  fullFyString: string; // "2026-2027"
  startDate: Date;    // 2026-04-01T00:00:00.000+05:30
  endDate: Date;      // 2027-03-31T23:59:59.999+05:30
}

/**
 * Resolves the Indian Fiscal Year from an issue date or timestamp.
 * Uses Intl.DateTimeFormat with Asia/Kolkata timezone to avoid UTC boundary skew.
 */
export function resolveIndianFiscalYear(issueDate: Date | string | number = new Date()): IndianFiscalYearInfo {
  if (issueDate === null || (typeof issueDate === "string" && issueDate.trim() === "")) {
    throw new Error(`INVALID_ISSUE_DATE: Cannot resolve fiscal year for empty or null date '${issueDate}'`);
  }

  const d = issueDate instanceof Date ? issueDate : new Date(issueDate);

  if (isNaN(d.getTime())) {
    throw new Error(`INVALID_ISSUE_DATE: Cannot resolve fiscal year for invalid date '${issueDate}'`);
  }

  // Format parts in Asia/Kolkata timezone
  const formatter = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric'
  });

  const parts = formatter.formatToParts(d);
  const month = parseInt(parts.find(p => p.type === 'month')!.value, 10);
  const year = parseInt(parts.find(p => p.type === 'year')!.value, 10);

  // In India: April (month 4) to December (month 12) belongs to startYear = year
  // January (month 1) to March (month 3) belongs to startYear = year - 1
  const startYear = month >= 4 ? year : year - 1;
  const endYear = startYear + 1;

  const startYearShort = String(startYear % 100).padStart(2, '0');
  const endYearShort = String(endYear % 100).padStart(2, '0');

  return {
    fiscalYear: startYear,
    startYear,
    endYear,
    fyString: `${startYearShort}-${endYearShort}`,
    fullFyString: `${startYear}-${endYear}`,
    startDate: new Date(`${startYear}-04-01T00:00:00+05:30`),
    endDate: new Date(`${endYear}-03-31T23:59:59.999+05:30`),
  };
}


/**
 * Fiscal year label used on vouchers and journal entries, in the same format as
 * public.accounting_fiscal_period.fiscal_year (e.g. "FY2026-27"), so year-end close matches them.
 */
export function voucherFiscalYear(date: Date | string | number = new Date()): string {
  const fy = resolveIndianFiscalYear(date);
  return `FY${fy.startYear}-${String(fy.endYear % 100).padStart(2, "0")}`;
}
