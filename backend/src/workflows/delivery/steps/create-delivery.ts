import { StepResponse, createStep } from "@medusajs/workflows-sdk";
import { DeliveryDTO } from "../../../modules/delivery/types/common";
import { DELIVERY_MODULE } from "../../../modules/delivery";

type CreateDeliveryStepInput = {
  delivery_date?: string | null;
  delivery_slot_id?: string | null;
};

export const createDeliveryStepId = "create-delivery-step";
export const createDeliveryStep = createStep(
  createDeliveryStepId,
  async function (input: CreateDeliveryStepInput, { container }) {
    const service = container.resolve(DELIVERY_MODULE);

    // If slot ID and date are specified, perform a final capacity check
    if (input.delivery_slot_id && input.delivery_date) {
      try {
        const slot = await service.retrieveDeliverySlot(input.delivery_slot_id);
        if (slot) {
          const bookings = await service.listDeliveries({
            delivery_slot_id: input.delivery_slot_id,
            delivery_date: input.delivery_date,
          });
          if (bookings.length >= slot.max_capacity) {
            throw new Error("Selected time slot is no longer available. Please select another slot.");
          }
        }
      } catch (e: any) {
        // If it's our validation error, bubble it up. Otherwise, log it.
        if (e.message?.includes("no longer available")) {
          throw e;
        }
        console.error("Error verifying delivery slot capacity", e);
      }
    }

    const delivery = (await service.createDeliveries({
      delivery_date: input.delivery_date || null,
      delivery_slot_id: input.delivery_slot_id || null,
    })) as unknown as DeliveryDTO

    return new StepResponse(delivery, {
      delivery_id: delivery.id,
    });
  },
  async function (
    {
      delivery_id,
    },
    { container }
  ) {
    const service = container.resolve(DELIVERY_MODULE);

    await service.softDeleteDeliveries(delivery_id);
  }
);
