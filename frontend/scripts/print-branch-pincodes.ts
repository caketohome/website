import { ApiEngine } from "../src/lib/api-engine";

async function main() {
  await ApiEngine.ensureHydrated();
  const branches = ApiEngine.listBranches();
  console.log("Total branches:", branches.length);
  for (const b of branches.slice(0, 10)) {
    console.log(`Branch: ${b.name} (${b.id}) | Pincode: ${b.pincode} | City: ${b.city} | Open: ${b.is_open} | Status: ${b.operational_status}`);
    if (b.delivery_zones?.length) {
      console.log(`  Zones:`, b.delivery_zones.map((z: any) => ({ name: z.name, pincodes: z.pincodes })));
    }
  }
}
main().catch(console.error);
