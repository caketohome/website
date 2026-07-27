import {
  ModuleRegistrationName,
  remoteQueryObjectFromString,
} from "@medusajs/utils";
import { createStep } from "@medusajs/workflows-sdk";
import { DeliveryPartnerDTO } from "../../../modules/delivery/types/common";
import { DELIVERY_MODULE } from "../../../modules/delivery";

export const findDeliveryPartnerStepId = "await-delivery_partner-response-step";
export const findDeliveryPartnerStep = createStep<string, DeliveryPartnerDTO, string>(
  { name: findDeliveryPartnerStepId, async: true, timeout: 60 * 15, maxRetries: 2 },
  async function (deliveryId: string, { container }) {
    const remoteQuery = container.resolve("remoteQuery");

    const delivery_partnersQuery = remoteQueryObjectFromString({
      entryPoint: "delivery_partners",
      fields: ["id"],
      pagination: {
        skip: 0,
        take: null,
      },
    });

    const { rows: delivery_partners } = await remoteQuery(delivery_partnersQuery).catch((e) => []);

    const idsToNotify = delivery_partners.map((d: DeliveryPartnerDTO) => d.id);

    const createData = idsToNotify.map((delivery_partnerId: string) => ({
      delivery_id: deliveryId,
      delivery_partner_id: delivery_partnerId,
    }));

    const deliveryService = container.resolve(DELIVERY_MODULE);

    await deliveryService.createDeliveryDeliveryPartners(createData);

    const eventBus = container.resolve(ModuleRegistrationName.EVENT_BUS);

    await eventBus.emit({
      name: "notify.delivery_partners",
      data: {
        delivery_partners: idsToNotify,
        delivery_id: deliveryId,
      },
    });
  },
  (input, { container }) => {
    const deliveryService = container.resolve(DELIVERY_MODULE);

    return deliveryService.softDeleteDeliveryDeliveryPartners(input);
  }
);
