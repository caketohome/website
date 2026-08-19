import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework";
import { SHOP_MODULE } from "../../../../modules/shop";
import { DELIVERY_MODULE } from "../../../../modules/delivery";

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { user_id, actor_type } = req.user as {
    user_id: string;
    actor_type: "shop" | "delivery_partner";
  };

  if (actor_type === "shop") {
    const service = req.scope.resolve(SHOP_MODULE) as any;
    const user = await service.retrieveShopManager(user_id);
    return res.json({ user });
  }

  if (actor_type === "delivery_partner") {
    const service = req.scope.resolve(DELIVERY_MODULE) as any;
    const user = await service.retrieveDeliveryPartner(user_id);
    return res.json({ user });
  }

  return res.status(404).json({ message: "User not found" });
};
