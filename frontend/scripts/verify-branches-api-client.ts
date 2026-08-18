import { apiClient } from "../src/lib/api-client";

async function main() {
  console.log("Testing apiClient.getAdminBranches...");
  const branches = await apiClient.getAdminBranches();
  console.log("✓ getAdminBranches succeeded:", { count: branches?.branches?.length ?? (branches as any)?.length ?? 0 });

  console.log("Testing apiClient.getGstRegistrations...");
  const gst = await apiClient.getGstRegistrations();
  console.log("✓ getGstRegistrations succeeded:", { count: gst?.registrations?.length ?? 0 });

  console.log("Testing apiClient.getBranchCompliance...");
  const comp = await apiClient.getBranchCompliance();
  console.log("✓ getBranchCompliance succeeded:", { count: comp?.compliance?.length ?? 0 });

  console.log("\nALL BRANCH API CLIENT METHODS VERIFIED SUCCESSFULLY! ✨");
}

main().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
