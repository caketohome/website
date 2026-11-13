import DeliveryModuleService from "../service";

function createMockService(stores: {
    deliverySlots?: Record<string, unknown>[];
    deliveries?: Record<string, unknown>[];
} = {}): {
    service: DeliveryModuleService;
    mocks: Record<string, jest.Mock>;
} {
    const service = Object.create(DeliveryModuleService.prototype) as DeliveryModuleService;
    const deliverySlotStore = [...(stores.deliverySlots ?? [])];
    const deliveryStore = [...(stores.deliveries ?? [])];

    const mocks: Record<string, jest.Mock> = {
        listDeliverySlots: jest.fn(async (selector: Record<string, unknown>) => {
            return deliverySlotStore.filter((m) =>
                Object.entries(selector).every(([k, v]) => m[k] === v)
            );
        }),
        retrieveDeliverySlot: jest.fn(async (id: string) => {
            return deliverySlotStore.find((m) => m.id === id);
        }),
        createDeliverySlots: jest.fn(async (data: unknown) => {
            const arr = Array.isArray(data) ? data : [data];
            const created = arr.map((d, index) => ({
                id: `delslot_${deliverySlotStore.length + index + 1}`,
                ...(d as any),
            }));
            deliverySlotStore.push(...created);
            return Array.isArray(data) ? created : created[0];
        }),
        updateDeliverySlots: jest.fn(async (data: unknown) => {
            const arr = Array.isArray(data) ? data : [data];
            const updated = arr.map((d: any) => {
                const record = deliverySlotStore.find((m) => m.id === d.id);
                if (record) {
                    Object.assign(record, d);
                    return record;
                }
                return d;
            });
            return Array.isArray(data) ? updated : updated[0];
        }),
        deleteDeliverySlots: jest.fn(async (ids: string | string[]) => {
            const idArr = Array.isArray(ids) ? ids : [ids];
            for (const id of idArr) {
                const idx = deliverySlotStore.findIndex((m) => m.id === id);
                if (idx !== -1) deliverySlotStore.splice(idx, 1);
            }
        }),
        listDeliveries: jest.fn(async (selector: Record<string, unknown>) => {
            return deliveryStore.filter((m) =>
                Object.entries(selector).every(([k, v]) => m[k] === v)
            );
        }),
    };

    (service as any).listDeliverySlots = mocks.listDeliverySlots;
    (service as any).retrieveDeliverySlot = mocks.retrieveDeliverySlot;
    (service as any).createDeliverySlots = mocks.createDeliverySlots;
    (service as any).updateDeliverySlots = mocks.updateDeliverySlots;
    (service as any).deleteDeliverySlots = mocks.deleteDeliverySlots;
    (service as any).listDeliveries = mocks.listDeliveries;

    return { service, mocks };
}

describe("DeliveryModuleService - Delivery Slot", () => {
    it("should list delivery slots for a branch", async () => {
        const { service } = createMockService({
            deliverySlots: [
                { id: "delslot_1", branch_id: "res_1", slot_name: "Morning", start_time: "09:00", end_time: "12:00", max_capacity: 5, extra_charge: 0 },
                { id: "delslot_2", branch_id: "res_1", slot_name: "Late Evening", start_time: "21:00", end_time: "22:30", max_capacity: 3, extra_charge: 150 },
            ],
        });

        const slots = await service.listDeliverySlots({ branch_id: "res_1" });
        expect(slots).toHaveLength(2);
        expect((slots[0] as any).slot_name).toBe("Morning");
    });

    it("should create, update, and delete delivery slots", async () => {
        const { service } = createMockService();
        const slot = await service.createDeliverySlots({
            branch_id: "res_1",
            slot_name: "Evening",
            start_time: "18:00",
            end_time: "21:00",
            max_capacity: 10,
            extra_charge: 50,
        });

        expect(slot).toBeDefined();
        expect((slot as any).slot_name).toBe("Evening");

        const slots = await service.listDeliverySlots({ branch_id: "res_1" });
        expect(slots).toHaveLength(1);

        await service.updateDeliverySlots({
            id: (slot as any).id,
            max_capacity: 15,
        });

        const updatedSlots = await service.listDeliverySlots({ branch_id: "res_1" });
        expect((updatedSlots[0] as any).max_capacity).toBe(15);

        await service.deleteDeliverySlots((slot as any).id);
        const deletedSlots = await service.listDeliverySlots({ branch_id: "res_1" });
        expect(deletedSlots).toHaveLength(0);
    });

    it("should retrieve a delivery slot by ID", async () => {
        const { service } = createMockService({
            deliverySlots: [
                { id: "delslot_10", branch_id: "res_1", slot_name: "Afternoon" },
            ],
        });
        const slot = await (service as any).retrieveDeliverySlot("delslot_10");
        expect(slot).toBeDefined();
        expect(slot.slot_name).toBe("Afternoon");
    });
});
