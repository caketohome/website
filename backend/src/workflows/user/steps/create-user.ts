import { MedusaError } from "@medusajs/utils";
import { createStep, StepResponse } from "@medusajs/workflows-sdk";
import { DeliveryPartnerDTO } from "../../../modules/delivery/types/common";
import { ShopManagerDTO } from "../../../modules/shop/types/common";
import {
  CreateDeliveryPartnerInput,
  CreateShopManagerInput,
} from "../workflows/create-user";
import { SHOP_MODULE } from "../../../modules/shop";
import { DELIVERY_MODULE } from "../../../modules/delivery";

type CreateUserStepInput = (CreateShopManagerInput | CreateDeliveryPartnerInput) & {
  actor_type: "shop" | "delivery_partner";
};

type CompensationStepInput = {
  id: string;
  actor_type: string;
};

export const createUserStepId = "create-user-step";
export const createUserStep = createStep(
  createUserStepId,
  async (
    input: CreateUserStepInput,
    { container }
  ): Promise<
    StepResponse<ShopManagerDTO | DeliveryPartnerDTO, CompensationStepInput>
  > => {
    if (input.actor_type === "shop") {
      const service = container.resolve(SHOP_MODULE);

      const shopAdmin = await service.createShopManagers(
        input as CreateShopManagerInput
      );

      const compensationData = {
        id: shopAdmin.id,
        actor_type: "shop",
      };

      return new StepResponse(shopAdmin, compensationData);
    }

    if (input.actor_type === "delivery_partner") {
      const service = container.resolve(DELIVERY_MODULE);

      const delivery_partner = await service.createDeliveryPartners(input as CreateDeliveryPartnerInput);

      const delivery_partnerWithAvatar = await service.updateDeliveryPartners({
        id: delivery_partner.id,
        avatar_url: `https://robohash.org/${delivery_partner.id}?size=40x40&set=set1&bgset=bg1`,
      });

      const compensationData = {
        id: delivery_partnerWithAvatar.id,
        actor_type: "delivery_partner",
      };

      return new StepResponse(delivery_partnerWithAvatar, compensationData);
    }

    throw MedusaError.Types.INVALID_DATA;
  },
  function ({ id, actor_type }: CompensationStepInput, { container }) {
    if (actor_type === "shop") {
      const service = container.resolve(SHOP_MODULE);

      return service.deleteShopManagers(id);
    }

    if (actor_type === "delivery_partner") {
      const service = container.resolve(DELIVERY_MODULE);

      return service.deleteDeliveryPartners(id);
    }
  }
);
