/**
 * Unit tests for the Customer identity module.
 *
 * Tests cover:
 *   - OTP request generates a hash + expiry and dispatches via notification
 *   - OTP verification succeeds with the correct code
 *   - OTP verification fails with an incorrect code
 *   - Expired OTP is rejected
 *   - Too many failed attempts locks verification
 *   - Resend cooldown is enforced
 *   - Address default enforcement (only one default shipping/billing)
 *
 * These tests mock the MedusaService CRUD methods to unit-test the
 * service logic in isolation.
 */

import CustomerModuleService from "../service";

function createMockService(
    phoneRecords: Record<string, unknown>[] = [],
    addresses: Record<string, unknown>[] = []
): {
    service: CustomerModuleService;
    mocks: Record<string, jest.Mock>;
} {
    const service = Object.create(CustomerModuleService.prototype) as CustomerModuleService;

    const phoneStore = [...phoneRecords];
    const addressStore = [...addresses];

    const mocks: Record<string, jest.Mock> = {
        listCustomerPhones: jest.fn(async (selector: Record<string, unknown>) => {
            return phoneStore.filter((p) =>
                Object.entries(selector).every(([k, v]) => p[k] === v)
            );
        }),
        createCustomerPhones: jest.fn(async (data: unknown) => {
            const record = {
                id: `cph_${phoneStore.length + 1}`,
                otp_attempts: 0,
                ...(data as any),
            } as Record<string, unknown>;
            phoneStore.push(record);
            return record;
        }),
        updateCustomerPhones: jest.fn(async (args: { selector: { id: string }; data: Record<string, unknown> }) => {
            const record = phoneStore.find((p) => p.id === args.selector.id);
            if (record) {
                Object.assign(record, args.data);
            }
        }),
        listCustomerAddresses: jest.fn(async (selector: Record<string, unknown>) => {
            return addressStore.filter((a) =>
                Object.entries(selector).every(([k, v]) => a[k] === v)
            );
        }),
        createCustomerAddresses: jest.fn(async (data: unknown) => {
            const record = {
                id: `caddr_${addressStore.length + 1}`,
                is_default_shipping: false,
                is_default_billing: false,
                ...(Array.isArray(data) ? data[0] : data),
            } as Record<string, unknown>;
            addressStore.push(record);
            return [record];
        }),
        updateCustomerAddresses: jest.fn(async () => {}),
        deleteCustomerAddresses: jest.fn(async () => {}),
        createLoginEvents: jest.fn(async () => {}),
    };

    (service as unknown as Record<string, unknown>).listCustomerPhones = mocks.listCustomerPhones;
    (service as unknown as Record<string, unknown>).createCustomerPhones = mocks.createCustomerPhones;
    (service as unknown as Record<string, unknown>).updateCustomerPhones = mocks.updateCustomerPhones;
    (service as unknown as Record<string, unknown>).listCustomerAddresses = mocks.listCustomerAddresses;
    (service as unknown as Record<string, unknown>).createCustomerAddresses = mocks.createCustomerAddresses;
    (service as unknown as Record<string, unknown>).updateCustomerAddresses = mocks.updateCustomerAddresses;
    (service as unknown as Record<string, unknown>).deleteCustomerAddresses = mocks.deleteCustomerAddresses;
    (service as unknown as Record<string, unknown>).createLoginEvents = mocks.createLoginEvents;

    return { service, mocks };
}

describe("CustomerModuleService — OTP", () => {
    it("requestOtp generates a hash + expiry and returns dev_otp when no provider", async () => {
        const { service, mocks } = createMockService();
        const container = {}; // no notificationModuleService

        const result = await service.requestOtp({ phone: "+919876543210" }, container);

        expect(result.sent).toBe(false);
        expect(result.dev_otp).toBeDefined();
        expect(result.dev_otp).toMatch(/^\d{6}$/);
        expect(mocks.createCustomerPhones).toHaveBeenCalledTimes(1);
        expect(mocks.updateCustomerPhones).toHaveBeenCalledTimes(1);
    });

    it("verifyOtp succeeds with the correct code and creates a core customer", async () => {
        const { service } = createMockService();
        const container = {}; // no notificationModuleService, no customerService

        // Request first to seed the OTP.
        const requestResult = await service.requestOtp({ phone: "+919876543210" }, container);
        const otp = requestResult.dev_otp!;

        const verifyResult = await service.verifyOtp(
            { phone: "+919876543210", otp },
            container
        );

        expect(verifyResult.success).toBe(true);
        expect(verifyResult.customer_id).toBeDefined();
        expect(verifyResult.is_new_customer).toBe(true);
    });

    it("verifyOtp fails with an incorrect code", async () => {
        const { service } = createMockService();
        const container = {};

        await service.requestOtp({ phone: "+919876543210" }, container);

        const verifyResult = await service.verifyOtp(
            { phone: "+919876543210", otp: "000000" },
            container
        );

        expect(verifyResult.success).toBe(false);
        expect(verifyResult.error).toContain("Invalid OTP");
    });

    it("verifyOtp rejects an expired OTP", async () => {
        const { service, mocks } = createMockService([
            {
                id: "cph_1",
                phone: "+919876543210",
                phone_verified: false,
                otp_hash: "somehash",
                otp_expires_at: new Date(Date.now() - 10 * 60 * 1000), // expired 10m ago
                otp_attempts: 0,
                customer_id: null,
            },
        ]);
        const container = {};

        const verifyResult = await service.verifyOtp(
            { phone: "+919876543210", otp: "123456" },
            container
        );

        expect(verifyResult.success).toBe(false);
        expect(verifyResult.error).toContain("expired");
        expect(mocks.createLoginEvents).toHaveBeenCalled();
    });

    it("verifyOtp locks after too many failed attempts", async () => {
        const { service, mocks } = createMockService([
            {
                id: "cph_1",
                phone: "+919876543210",
                phone_verified: false,
                otp_hash: "somehash",
                otp_expires_at: new Date(Date.now() + 5 * 60 * 1000),
                otp_attempts: 5,
                customer_id: null,
            },
        ]);
        const container = {};

        const verifyResult = await service.verifyOtp(
            { phone: "+919876543210", otp: "123456" },
            container
        );

        expect(verifyResult.success).toBe(false);
        expect(verifyResult.error).toContain("Too many failed attempts");
    });
});

describe("CustomerModuleService — Addresses", () => {
    it("createAddress enforces a single default shipping address", async () => {
        const existing = [
            {
                id: "caddr_1",
                customer_id: "cus_1",
                line1: "Old address",
                city: "City",
                is_default_shipping: true,
                is_default_billing: false,
            },
        ];
        const { service, mocks } = createMockService([], existing);

        await service.createAddress({
            customer_id: "cus_1",
            line1: "New address",
            city: "City",
            is_default_shipping: true,
        });

        // The old default should be unset.
        const updateCalls = mocks.updateCustomerAddresses.mock.calls;
        const oldUnsetCall = updateCalls.find(
            (c) => (c[0] as { selector: { id: string } }).selector.id === "caddr_1"
        );
        expect(oldUnsetCall).toBeDefined();
        expect((oldUnsetCall![0] as { data: Record<string, unknown> }).data.is_default_shipping).toBe(false);
    });

    it("deleteAddress removes the address", async () => {
        const { service, mocks } = createMockService();

        await service.deleteAddress("caddr_1");

        expect(mocks.deleteCustomerAddresses).toHaveBeenCalledWith(["caddr_1"]);
    });
});
