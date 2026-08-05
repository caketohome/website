import { DeliveryService } from "../delivery.service";
import { validateCheckServiceabilityInput, validateReserveSlotInput, validateCompleteDeliveryInput } from "../delivery.validator";

describe("DeliveryService Capability 5.1, 5.2, & 8.1 Unit Tests", () => {
  let service: DeliveryService;

  beforeEach(() => {
    service = new DeliveryService();
  });

  it("Capability 5.1: should validate 6-digit pincode parameter", () => {
    expect(() => validateCheckServiceabilityInput({ pincode: "123" })).toThrow("Query parameter 'pincode' must be an exact 6-digit Indian Postal Pincode.");
    const valid = validateCheckServiceabilityInput({ pincode: "560038", subtotal: "699.00" });
    expect(valid.pincode).toBe("560038");
    expect(valid.subtotal).toBe(699.0);
  });

  it("Capability 5.1: should return true serviceability for serviced pincode with assigned branch and free delivery", async () => {
    const res = await service.checkServiceability({ pincode: "560038", subtotal: 699.0 });
    expect(res.isServiceable).toBe(true);
    expect(res.assignedBranchId).toBe("br_indiranagar_02");
    expect(res.isFreeDelivery).toBe(true);
    expect(res.deliveryFee).toBe(0.0);
    expect(res.estimatedMinutes).toBe(45);
  });

  it("Capability 5.1: should apply base delivery fee when subtotal is below free delivery threshold", async () => {
    const res = await service.checkServiceability({ pincode: "560034", subtotal: 299.0 });
    expect(res.isServiceable).toBe(true);
    expect(res.isFreeDelivery).toBe(false);
    expect(res.deliveryFee).toBe(49.0);
  });

  it("Capability 5.1: should apply rain and peak surge fees correctly", async () => {
    const res = await service.checkServiceability({ pincode: "560034", subtotal: 299.0, isRain: true, isPeak: true });
    expect(res.isServiceable).toBe(true);
    expect(res.deliveryFee).toBe(84.0); // 49 base + 15 rain + 20 peak
  });

  it("Capability 5.1: should return false serviceability for unserviced pincode", async () => {
    const res = await service.checkServiceability({ pincode: "999999" });
    expect(res.isServiceable).toBe(false);
    expect(res.estimatedMinutes).toBe(0);
    expect(res.deliveryFee).toBe(0);
  });

  it("Capability 5.2: should validate reserve slot input parameters", () => {
    expect(() => validateReserveSlotInput({})).toThrow("Property 'branchId' is required.");
    expect(() => validateReserveSlotInput({ branchId: "br_koramangala_01", slotId: "INVALID_SLOT" })).toThrow(
      "Property 'slotId' must be a valid delivery slot identifier."
    );

    const valid = validateReserveSlotInput({ branchId: "br_koramangala_01", slotId: "MIDNIGHT", date: "2026-07-31" });
    expect(valid.branchId).toBe("br_koramangala_01");
    expect(valid.slotId).toBe("MIDNIGHT");
    expect(valid.date).toBe("2026-07-31");
  });

  it("Capability 5.2: should return slot capacity grid for branch and date", async () => {
    const grid = await service.getSlotCapacityGrid("br_koramangala_01", "2026-07-31");
    expect(grid.branchId).toBe("br_koramangala_01");
    expect(grid.slots).toBeDefined();
    expect(grid.slots.length).toBe(6);

    const expressSlot = grid.slots.find((s) => s.slotId === "EXPRESS_45MIN");
    expect(expressSlot?.maxCapacity).toBe(5);
    expect(expressSlot?.isAvailable).toBe(true);
  });

  it("Capability 5.2: should reserve slot capacity and throw ConflictError when slot is overbooked", async () => {
    const branchId = "br_koramangala_01";
    const date = "2026-07-31";
    const slotId = "MIDNIGHT"; // Max capacity 4

    // Book 4 times to fill capacity
    for (let i = 0; i < 4; i++) {
      const res = await service.reserveSlot({ branchId, date, slotId });
      expect(res.reservationId).toBeDefined();
    }

    // 5th booking should fail with ConflictError
    await expect(service.reserveSlot({ branchId, date, slotId })).rejects.toThrow("is fully booked");
  });

  it("Capability 8.1: should validate complete delivery input parameters", () => {
    expect(() => validateCompleteDeliveryInput({})).toThrow("Property 'jobId' is required.");
    expect(() => validateCompleteDeliveryInput({ jobId: "dlv_100" })).toThrow("Property 'photoUrl' is required for Proof of Delivery (POD).");
    expect(() => validateCompleteDeliveryInput({ jobId: "dlv_100", photoUrl: "http://photo.jpg", otpVerified: false })).toThrow(
      "Customer delivery verification OTP must be verified"
    );

    const valid = validateCompleteDeliveryInput({ jobId: "dlv_100", photoUrl: "http://photo.jpg", otpVerified: true });
    expect(valid.jobId).toBe("dlv_100");
    expect(valid.otpVerified).toBe(true);
  });

  it("Capability 8.1: should create delivery job, assign driver, complete delivery with POD, and credit gig driver wallet", async () => {
    // 1. Dispatch delivery job
    const job = await service.createDeliveryJob({
      orderId: "ord_fleet_test",
      orderNumber: "CTH-20260731-000999",
      branchId: "br_koramangala_01",
      street: "80 Feet Road",
      pincode: "560034",
    });

    expect(job.id).toBeDefined();
    expect(job.status).toBe("DRIVER_ASSIGNED");
    expect(job.driverId).toBe("dlp_01_fixed");

    // 2. Complete delivery with Proof of Delivery (POD)
    const completeRes = await service.completeDelivery({
      jobId: job.id,
      photoUrl: "https://cakes2home.com/pod/pod_999.jpg",
      otpVerified: true,
    });

    expect(completeRes.job.status).toBe("DELIVERED");
    expect(completeRes.job.proofOfDelivery?.otpVerified).toBe(true);
    expect(completeRes.driver.deliveriesTodayCount).toBeGreaterThan(0);
  });
});
