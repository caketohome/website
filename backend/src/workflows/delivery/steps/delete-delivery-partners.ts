import { remoteQueryObjectFromString } from "@medusajs/utils";
import { StepResponse, createStep } from "@medusajs/workflows-sdk";
import { DeliveryDeliveryPartnerDTO } from "../../../modules/delivery/types/common";
import { DELIVERY_MODULE } from "../../../modules/delivery";

export type DeleteDeliveryPartnersStepInput = {
  delivery_id: string;
  delivery_partner_id?: string;
};

export const deleteDeliveryPartnersStepId = "delete-delivery-partners-step";
export const deleteDeliveryPartnersStep = createStep(
  deleteDeliveryPartnersStepId,
  async function (input: DeleteDeliveryPartnersStepInput, { container }) {
    const remoteQuery = container.resolve("remoteQuery");

    const delivery_partnerQuery = remoteQueryObjectFromString({
      entryPoint: "delivery_delivery_partner",
      filters: {
        id: input.delivery_partner_id,
      },
      fields: ["id"],
    });

    const delivery_partners = await remoteQuery(delivery_partnerQuery)
      .then((res) => res.map((d: DeliveryDeliveryPartnerDTO) => d.id))
      .catch(() => []);

    const deliveryModuleService = container.resolve(DELIVERY_MODULE);

    await deliveryModuleService.softDeleteDeliveryDeliveryPartners(delivery_partners);

    return new StepResponse(delivery_partners, delivery_partners);
  },
  (deletedDeliveryPartners: string[], { container }) => {}
);
