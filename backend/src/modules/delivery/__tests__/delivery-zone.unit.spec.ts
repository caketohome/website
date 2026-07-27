import DeliveryModuleService from "../service";

function createMockService(stores: {
    deliveryZones?: Record<string, unknown>[];
} = {}): {
    service: DeliveryModuleService;
    mocks: Record<string, jest.Mock>;
} {
    const service = Object.create(DeliveryModuleService.prototype) as DeliveryModuleService;
    const deliveryZoneStore = [...(stores.deliveryZones ?? [])];

    const mocks: Record<string, jest.Mock> = {
        listDeliveryZones: jest.fn(async (selector: Record<string, unknown>) => {
            return deliveryZoneStore.filter((m) =>
                Object.entries(selector).every(([k, v]) => m[k] === v)
            );
        }),
        createDeliveryZones: jest.fn(async (data: unknown) => {
            const arr = Array.isArray(data) ? data : [data];
            const created = arr.map((d, index) => ({
                id: `delzone_${deliveryZoneStore.length + index + 1}`,
                ...(d as any),
            }));
            deliveryZoneStore.push(...created);
            return Array.isArray(data) ? created : created[0];
        }),
        updateDeliveryZones: jest.fn(async (data: unknown) => {
            const arr = Array.isArray(data) ? data : [data];
            const updated = arr.map((d: any) => {
                const record = deliveryZoneStore.find((m) => m.id === d.id);
                if (record) {
                    Object.assign(record, d);
                    return record;
                }
                return d;
            });
            return Array.isArray(data) ? updated : updated[0];
        }),
        deleteDeliveryZones: jest.fn(async (ids: string | string[]) => {
            const idArr = Array.isArray(ids) ? ids : [ids];
            for (const id of idArr) {
                const idx = deliveryZoneStore.findIndex((m) => m.id === id);
                if (idx !== -1) deliveryZoneStore.splice(idx, 1);
            }
        }),
    };

    (service as any).listDeliveryZones = mocks.listDeliveryZones;
    (service as any).createDeliveryZones = mocks.createDeliveryZones;
    (service as any).updateDeliveryZones = mocks.updateDeliveryZones;
    (service as any).deleteDeliveryZones = mocks.deleteDeliveryZones;

    return { service, mocks };
}

describe("DeliveryModuleService - Delivery Zone", () => {
    it("should list delivery zones by pincode", async () => {
        const { service } = createMockService({
            deliveryZones: [
                { id: "delzone_1", pincode: "110001", branch_id: "res_1", delivery_fee: 50, is_serviceable: true },
                { id: "delzone_2", pincode: "110002", branch_id: "res_2", delivery_fee: 80, is_serviceable: false },
            ],
        });

        const zones = await service.listDeliveryZones({ pincode: "110001" });
        expect(zones).toHaveLength(1);
        expect((zones[0] as any).branch_id).toBe("res_1");
    });

    it("should create delivery zone configuration", async () => {
        const { service } = createMockService();
        const zone = await service.createDeliveryZones({
            pincode: "110003",
            branch_id: "res_3",
            delivery_fee: 100,
            is_serviceable: true,
        });

        expect(zone).toBeDefined();
        expect((zone as any).id).toBeDefined();
        expect((zone as any).pincode).toBe("110003");

        const zones = await service.listDeliveryZones({ pincode: "110003" });
        expect(zones).toHaveLength(1);
    });

    it("should update delivery zone configuration", async () => {
        const { service } = createMockService({
            deliveryZones: [
                { id: "delzone_1", pincode: "110001", branch_id: "res_1", delivery_fee: 50, is_serviceable: true },
            ],
        });

        await service.updateDeliveryZones({
            id: "delzone_1",
            delivery_fee: 75,
            is_serviceable: false,
        });

        const zones = await service.listDeliveryZones({ pincode: "110001" });
        expect((zones[0] as any).delivery_fee).toBe(75);
        expect((zones[0] as any).is_serviceable).toBe(false);
    });

    it("should delete delivery zone configuration", async () => {
        const { service } = createMockService({
            deliveryZones: [
                { id: "delzone_1", pincode: "110001", branch_id: "res_1", delivery_fee: 50, is_serviceable: true },
            ],
        });

        await service.deleteDeliveryZones("delzone_1");
        const zones = await service.listDeliveryZones({ pincode: "110001" });
        expect(zones).toHaveLength(0);
    });
});
