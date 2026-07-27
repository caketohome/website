import { MedusaError } from "@medusajs/utils";
import { createStep, StepResponse } from "@medusajs/workflows-sdk";
import { DeliveryPartnerDTO } from "../../../modules/delivery/types/common";
import { ShopManagerDTO } from "../../../modules/shop/types/common";
import {
  UpdateShopsDTO,
  UpdateShopManagersDTO,
} from "../../../modules/shop/types/mutations";
import { SHOP_MODULE } from "../../../modules/shop";
import { DELIVERY_MODULE } from "../../../modules/delivery";

type UpdateUserStepInput = (
  | UpdateShopsDTO
  | UpdateShopManagersDTO
) & {
  actor_type: "shop" | "delivery_partner";
};

export const updateUserStepId = "update-user-step";
export const updateUserStep = createStep(
  updateUserStepId,
  async (
    input: UpdateUserStepInput,
    { container }
  ): Promise<
    StepResponse<ShopManagerDTO | DeliveryPartnerDTO, UpdateUserStepInput>
  > => {
    const { actor_type, ...data } = input;

    if (actor_type === "shop") {
      const service = container.resolve(SHOP_MODULE);

      const compensationData = {
        ...(await service.retrieveShopManager(data.id)),
        actor_type: "shop" as "shop",
      };

      const shopAdmin = await service.updateShopManagers(data);

      return new StepResponse(shopAdmin, compensationData);
    }

    if (actor_type === "delivery_partner") {
      const service = container.resolve(DELIVERY_MODULE);

      const compensationData = {
        ...(await service.retrieveDeliveryPartner(data.id)),
        actor_type: "delivery_partner" as "delivery_partner",
      };

      const delivery_partner = await service.updateDeliveryPartners(data);

      return new StepResponse(delivery_partner, compensationData);
    }

    throw MedusaError.Types.INVALID_DATA;
  },
  function ({ actor_type, ...data }: UpdateUserStepInput, { container }) {
    if (actor_type === "shop") {
      const service = container.resolve(SHOP_MODULE);

      return service.updateShopManagers(data);
    }

    if (actor_type === "delivery_partner") {
      const service = container.resolve(DELIVERY_MODULE);

      return service.updateDeliveryPartners(data);
    }
  }
);
