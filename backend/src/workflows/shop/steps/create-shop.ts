import { StepResponse, createStep } from "@medusajs/workflows-sdk";
import { CreateShopDTO } from "../../../modules/shop/types/mutations";
import { SHOP_MODULE } from "../../../modules/shop";

export const createShopStepId = "create-shop-step";
export const createShopStep = createStep(
  createShopStepId,
  async function (data: CreateShopDTO, { container }) {
    const shopModuleService = container.resolve(
      SHOP_MODULE
    );

    const shop = await shopModuleService.createShops(data);

    return new StepResponse(shop, shop.id);
  },
  function (input: string, { container }) {
    const shopModuleService = container.resolve(
      SHOP_MODULE
    );

    return shopModuleService.deleteShops([input]);
  }
);
