import { BranchService } from "../branches.service";
import { validateBranchSearchQuery } from "../branches.validator";

describe("BranchService Capability 4.1 Branch Directory Unit Tests", () => {
  let service: BranchService;

  beforeEach(() => {
    service = new BranchService();
  });

  it("Capability 4.1: should validate pincode format for branch search", () => {
    expect(() => validateBranchSearchQuery({ pincode: "5600" })).toThrow("Indian Postal Pincode must be exactly 6 digits.");
    const valid = validateBranchSearchQuery({ pincode: "560038", city: "Bengaluru" });
    expect(valid.pincode).toBe("560038");
    expect(valid.city).toBe("Bengaluru");
  });

  it("Capability 4.1: should list active bakery branches with serviced pincodes", async () => {
    const result = await service.listBranches({ isActive: true });
    expect(result.branches).toBeDefined();
    expect(result.branches.length).toBeGreaterThan(0);
    expect(result.branches[0].id).toBeDefined();
    expect(result.branches[0].servicedPincodes.length).toBeGreaterThan(0);
  });

  it("Capability 4.1: should find nearest serviceable branch by pincode", async () => {
    const result = await service.findServiceableBranch("560038");
    expect(result.serviceable).toBe(true);
    expect(result.assigned_branch).toBeDefined();
    expect(result.assigned_branch.servicedPincodes).toContain("560038");
  });

  it("Capability 4.1: should fetch branch details by branch ID", async () => {
    const branch = await service.getBranchById("br_koramangala_01");
    expect(branch.id).toBe("br_koramangala_01");
    expect(branch.isCentralKitchen).toBe(true);
    expect(branch.managerName).toBeDefined();
  });
});
