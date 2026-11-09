const fs = require('fs');
const path = require('path');

// 1. Update cash-flow.service.ts to recognize 1112-* child bank GL accounts and 1115 Bank Settlement In Transit
const cfPath = path.resolve('E:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/services/cash-flow.service.ts');
let cfContent = fs.readFileSync(cfPath, 'utf8');

if (!cfContent.includes('isCashEquivalentCode')) {
  cfContent = cfContent.replace(
    /export const CASH_ACCOUNT_CODES = \[\r?\n  "1111", \/\/ Cash in Hand\r?\n  "1112", \/\/ Bank Operating A\/c\r?\n  "1113", \/\/ Gateway Clearing\r?\n  "1114", \/\/ Petty Cash - Branches\r?\n  "1118", \/\/ Deposit in Transit\r?\n  "1119", \/\/ Unclassified Suspense\r?\n\] as const;\r?\n\r?\nexport type CashAccountCode = typeof CASH_ACCOUNT_CODES\[number\];/,
    `export const CASH_ACCOUNT_CODES = [
  "1111", // Cash in Hand
  "1112", // Bank Operating A/c
  "1113", // Gateway Clearing
  "1114", // Petty Cash - Branches
  "1115", // Bank Settlement In Transit
  "1118", // Deposit in Transit
  "1119", // Unclassified Suspense
] as const;

export type CashAccountCode = typeof CASH_ACCOUNT_CODES[number];

export function isCashEquivalentCode(code: string | undefined | null): boolean {
  if (!code) return false;
  if (code.startsWith("1112")) return true;
  return (CASH_ACCOUNT_CODES as readonly string[]).includes(code);
}`
  );

  cfContent = cfContent.replace(
    /AND a\.code = ANY\(\$2::text\[\]\)/g,
    `AND (a.code = ANY($2::text[]) OR a.code LIKE '1112%' OR a.code = '1115')`
  );
  cfContent = cfContent.replace(
    /WHERE sub_a\.code = ANY\(\$4::text\[\]\)/g,
    `WHERE (sub_a.code = ANY($4::text[]) OR sub_a.code LIKE '1112%' OR sub_a.code = '1115')`
  );
  cfContent = cfContent.replace(
    /CASH_ACCOUNT_CODES\.includes\(row\.code as CashAccountCode\)/g,
    `isCashEquivalentCode(row.code)`
  );
  cfContent = cfContent.replace(
    /CASH_ACCOUNT_CODES\.includes\(line\.account_code as CashAccountCode\)/g,
    `isCashEquivalentCode(line.account_code)`
  );
  fs.writeFileSync(cfPath, cfContent, 'utf8');
  console.log('Updated cash-flow.service.ts successfully.');
}

// 2. Update route.ts to provide default dates for profit-loss, balance-sheet, and cash-flow when omitted
const routePath = path.resolve('E:/vig/cakes2home-main/cakes2home-main/frontend/src/app/api/v1/[...path]/route.ts');
let routeContent = fs.readFileSync(routePath, 'utf8');

routeContent = routeContent.replace(
  /if \(acctSubPath === "profit-loss"\) \{\r?\n\s*const startDate = url\.searchParams\.get\("startDate"\) \|\| url\.searchParams\.get\("start_date"\) \|\| undefined;\r?\n\s*const endDate = url\.searchParams\.get\("endDate"\) \|\| url\.searchParams\.get\("end_date"\) \|\| undefined;/,
  `if (acctSubPath === "profit-loss") {\n          const startDate = url.searchParams.get("startDate") || url.searchParams.get("start_date") || "2026-04-01";\n          const endDate = url.searchParams.get("endDate") || url.searchParams.get("end_date") || "2027-03-31";`
);

routeContent = routeContent.replace(
  /if \(acctSubPath === "balance-sheet"\) \{\r?\n\s*const asOfDate = url\.searchParams\.get\("as_of_date"\) \|\| url\.searchParams\.get\("asOfDate"\) \|\| undefined;/,
  `if (acctSubPath === "balance-sheet") {\n          const asOfDate = url.searchParams.get("as_of_date") || url.searchParams.get("asOfDate") || "2027-03-31";`
);

routeContent = routeContent.replace(
  /if \(acctSubPath === "cash-flow"\) \{\r?\n\s*const startDate = url\.searchParams\.get\("start_date"\) \|\| url\.searchParams\.get\("startDate"\) \|\| undefined;\r?\n\s*const endDate = url\.searchParams\.get\("end_date"\) \|\| url\.searchParams\.get\("endDate"\) \|\| undefined;/,
  `if (acctSubPath === "cash-flow") {\n          const startDate = url.searchParams.get("start_date") || url.searchParams.get("startDate") || "2026-04-01";\n          const endDate = url.searchParams.get("end_date") || url.searchParams.get("endDate") || "2027-03-31";`
);

fs.writeFileSync(routePath, routeContent, 'utf8');
console.log('Updated route.ts default date parameters successfully.');

