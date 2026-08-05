import { CustomerService } from "../customer.service";
import { CustomerRole } from "../customer.constants";

describe("CustomerService Unit Tests", () => {
  let service: CustomerService;

  beforeEach(() => {
    service = new CustomerService();
  });

  it("should request OTP and return dev_otp in dev mode", async () => {
    const result = await service.requestOtp({ phone: "9876543210" });
    expect(result.sent).toBe(true);
    expect(result.dev_otp).toBeDefined();
    expect(result.dev_otp).toHaveLength(6);
  });

  it("should verify OTP and issue a valid JWT token", async () => {
    const requestRes = await service.requestOtp({ phone: "9876543210" });
    const otp = requestRes.dev_otp!;

    const verifyRes = await service.verifyOtp({ phone: "9876543210", otp });
    expect(verifyRes.customer_id).toBeDefined();
    expect(verifyRes.token).toBeDefined();
    expect(verifyRes.detected_role).toBe(CustomerRole.CUSTOMER);
  });

  it("should detect role accurately for shop manager numbers", () => {
    const detected = service.detectUserRole("9999999999");
    expect(detected.role).toBe(CustomerRole.SHOP_MANAGER);
    expect(detected.redirectPath).toBe("/dashboard/shop");
  });

  it("should detect role accurately for delivery drivers", () => {
    const detected = service.detectUserRole("1234512345");
    expect(detected.role).toBe(CustomerRole.DELIVERY_PARTNER);
    expect(detected.redirectPath).toBe("/dashboard/delivery-partner");
  });
});
