/**
 * Rider visibility rules (ApiEngine.canPartnerAccessOrder) with sample data. Read-only.
 *   npx tsx scripts/rider-visibility-test.ts
 */
import { ApiEngine } from "../src/lib/api-engine";

const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
const rider = { id: "dlp_A", partner_number: "DLV-A", full_name: "Rider A", primary_branch_id: "br_kollam", coverage: { pincodes: ["691001"] } };
const noBranchRider = { id: "dlp_B", partner_number: "DLV-B", full_name: "Rider B" };
const order = (o: any) => ({ status: "confirmed", payment_status: "paid", branch_id: "br_kollam", delivery_pincode: "691001", delivery_date: day(0), ...o });

const cases: Array<[string, any, any, boolean]> = [
  ["pool order, today, own branch & pincode", rider, order({ id: "o1" }), true],
  ["pool order, TOMORROW", rider, order({ id: "o2", delivery_date: day(1) }), false],
  ["ASSIGNED to rider but for tomorrow", rider, order({ id: "o3", delivery_date: day(1), delivery_partner_id: "dlp_A" }), false],
  ["assigned to rider, today", rider, order({ id: "o4", delivery_partner_id: "dlp_A" }), true],
  ["assigned, yesterday, still not delivered (overdue)", rider, order({ id: "o5", delivery_date: day(-1), delivery_partner_id: "dlp_A" }), true],
  ["yesterday, already delivered", rider, order({ id: "o6", delivery_date: day(-1), delivery_partner_id: "dlp_A", status: "delivered" }), false],
  ["pool order, OTHER branch (another region)", rider, order({ id: "o7", branch_id: "br_tvm" }), false],
  ["pool order, own branch but OUTSIDE rider pincodes", rider, order({ id: "o8", delivery_pincode: "695001" }), false],
  ["rider with NO branch mapping, pool order", noBranchRider, order({ id: "o9" }), false],
  ["assigned to ANOTHER rider", rider, order({ id: "o10", delivery_partner_id: "dlp_Z" }), false],
];

let failed = 0;
for (const [name, partner, ord, expected] of cases) {
  const got = ApiEngine.canPartnerAccessOrder(partner, ord);
  const ok = got === expected;
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}: visible=${got} (expected ${expected})`);
}
process.exit(failed ? 1 : 0);
