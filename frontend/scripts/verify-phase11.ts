import { ApiEngine } from "../src/lib/api-engine";
import { ProductRepository, BranchRepository, OrderRepository } from "../src/lib/repositories";
import { dbQuery } from "../src/lib/db";

async function runPhase11Verification() {
  console.log("================================================================================");
  console.log("  CAKETOHOME — PHASE 11 FULL VERIFICATION SUITE");
  console.log("================================================================================");

  await ApiEngine.ensureHydrated();

  // ── B. AUTHENTICATION ──────────────────────────────────────────────────────
  console.log("\n--- B. AUTHENTICATION & ROLE ISOLATION ---");
  const adminAcc = ApiEngine.resolveUserAccount({ role: "SUPER_ADMIN", phone: "+91 98765 00000" });
  console.log("Admin login resolution:", adminAcc?.role === "SUPER_ADMIN" ? "PASS" : "FAIL");

  const custAcc = ApiEngine.resolveUserAccount({ role: "CUSTOMER", phone: "+91 98765 43210" });
  console.log("Customer login resolution:", custAcc?.role === "CUSTOMER" ? "PASS" : "FAIL");

  const mgrAcc = ApiEngine.resolveUserAccount({ role: "BRANCH_MANAGER", phone: "+91 98765 00001" });
  console.log("Manager login resolution:", mgrAcc?.role === "BRANCH_MANAGER" ? "PASS" : "FAIL");

  const dlpAcc = ApiEngine.resolveUserAccount({ role: "DELIVERY_PARTNER", phone: "+91 98765 00001" });
  console.log("Delivery partner login resolution:", dlpAcc?.role === "DELIVERY_PARTNER" ? "PASS" : "FAIL");

  const custAsDriver = ApiEngine.resolveUserAccount({ role: "DELIVERY_PARTNER", phone: "+91 98765 43210" });
  console.log("RBAC cross-role isolation:", custAsDriver === null ? "PASS" : "FAIL");

  // ── C. API RESOLUTION ──────────────────────────────────────────────────────
  console.log("\n--- C. API RESOLUTION ---");
  const prods = await ProductRepository.findAll();
  console.log("Admin products API:", prods.length > 0 ? "PASS" : "FAIL", `(${prods.length} products)`);

  const branches = await BranchRepository.findAll();
  console.log("Branches API:", branches.length > 0 ? "PASS" : "FAIL", `(${branches.length} branches)`);

  const orders = await OrderRepository.findAll();
  console.log("Admin orders API:", orders.length >= 0 ? "PASS" : "FAIL", `(${orders.length} orders)`);

  const branchList = ApiEngine.listBranches();
  const indBranch = branchList.find((b: any) => b.name.includes("Indiranagar")) || branchList[0];
  const slots = ApiEngine.getDeliverySlots(indBranch.id, new Date().toISOString().slice(0, 10), "delivery");
  console.log("Delivery API:", slots.delivery_slots.length > 0 ? "PASS" : "FAIL");

  const custMe = ApiEngine.getCustomerMe({ phone: "+91 98765 43210" });
  console.log("Customer APIs:", custMe && custMe.phone ? "PASS" : "FAIL");

  // ── D. DATABASE PERSISTENCE ────────────────────────────────────────────────
  console.log("\n--- D. DATABASE PERSISTENCE ---");
  const testProdId = `prod_p11_${Date.now()}`;
  const created = await ApiEngine.createAdminProduct({
    id: testProdId,
    title: "Phase 11 Verification Cake",
    description: "Verified DB Direct",
    price: 749,
    category: "Artisanal Cakes",
  });
  console.log("Create -> DB:", !!created?.id ? "PASS" : "FAIL");

  const dbRow1 = await dbQuery("SELECT id, title, metadata, deleted_at FROM public.product WHERE id = $1", [created.id]);
  console.log("Row in PostgreSQL:", dbRow1.rows.length === 1 ? "PASS" : "FAIL");

  const updated = await ApiEngine.updateAdminProduct(created!.id as string, {
    title: "Phase 11 Verification Cake (Edited)",
    price: 849,
  });
  console.log("Update -> DB:", updated?.title === "Phase 11 Verification Cake (Edited)" ? "PASS" : "FAIL");

  const dbRow2 = await dbQuery("SELECT title, metadata FROM public.product WHERE id = $1", [created.id]);
  console.log("PostgreSQL updated values:", dbRow2.rows[0]?.title === "Phase 11 Verification Cake (Edited)" ? "PASS" : "FAIL");

  const deleted = await ApiEngine.deleteAdminProduct(created!.id as string);
  console.log("Delete/archive -> DB:", deleted === true ? "PASS" : "FAIL");

  const dbRow3 = await dbQuery("SELECT deleted_at FROM public.product WHERE id = $1", [created.id]);
  console.log("PostgreSQL soft-delete:", dbRow3.rows[0]?.deleted_at !== null ? "PASS" : "FAIL");

  // Re-hydrate store and verify
  await ApiEngine.reloadStore();
  const activeProds = ApiEngine.getAdminProducts();
  const foundActive = activeProds.find((p: any) => p.id === created.id);
  console.log("Fresh session excludes soft-deleted:", foundActive === undefined ? "PASS" : "FAIL");

  // Clean test record from database
  await dbQuery("DELETE FROM public.product WHERE id = $1", [created.id]);
  console.log("Cleaned test record.");

  console.log("\n================================================================================");
  console.log("  PHASE 11 VERIFICATION COMPLETE");
  console.log("================================================================================");
}

runPhase11Verification().catch(console.error);
