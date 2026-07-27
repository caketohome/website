import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { MedusaError } from "@medusajs/utils";
import { DeliveryStatus } from "../../../../../modules/delivery/types/common";
import { notifyShopStepId } from "../../../../../workflows/delivery/steps";
import { updateDeliveryWorkflow } from "../../../../../workflows/delivery/workflows";

const DEFAULT_PROCESSING_TIME = 30 * 60 * 1000; // 30 min

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { id } = req.params;

  const eta = new Date(new Date().getTime() + DEFAULT_PROCESSING_TIME);

  const data = {
    id,
    delivery_status: DeliveryStatus.SHOP_ACCEPTED,
    eta,
  };

  const updatedDelivery = await updateDeliveryWorkflow(req.scope)
    .run({
      input: {
        data,
        stepIdToSucceed: notifyShopStepId,
      },
    })
    .catch((error) => {
      console.error("[Delivery] Accept workflow error:", error?.message || error);
      return MedusaError.Types.UNEXPECTED_STATE;
    });

  return res.status(200).json({ delivery: updatedDelivery });
}
