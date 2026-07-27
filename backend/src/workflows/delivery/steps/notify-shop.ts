import {
  ModuleRegistrationName,
  remoteQueryObjectFromString,
} from "@medusajs/utils";
import { createStep } from "@medusajs/workflows-sdk";

export const notifyShopStepId = "notify-shop-step";
export const notifyShopStep = createStep(
  {
    name: notifyShopStepId,
    async: true,
    timeout: 60 * 15,
    maxRetries: 2,
  },
  async function (deliveryId: string, { container }) {
    const remoteQuery = container.resolve("remoteQuery");

    const deliveryQuery = remoteQueryObjectFromString({
      entryPoint: "deliveries",
      filters: {
        id: deliveryId,
      },
      fields: ["id", "shop.id"],
    });

    const delivery = await remoteQuery(deliveryQuery).then((res) => res[0]);

    const eventBus = container.resolve(ModuleRegistrationName.EVENT_BUS);

    await eventBus.emit({
      name: "notify.shop",
      data: {
        shop_id: delivery.shop.id,
        delivery_id: delivery.id,
      },
    });
  },
  function (input: string, { container }) {
    const logger = container.resolve("logger");

     logger.error("Failed to notify shop", new Error(`Failed to notify shop: ${input}`));
  }
);
