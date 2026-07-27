import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { PAYMENT_MODULE } from "../../../../../modules/payment";

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { id } = req.params;
  const paymentService = req.scope.resolve(PAYMENT_MODULE) as any;
  const ipAddress = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress;
  const userAgent = req.headers["user-agent"];

  try {
    const updatedTxn = await paymentService.capturePaymentSession({
      transactionId: id,
      ipAddress,
      userAgent,
    });
    return res.status(200).json({ transaction: updatedTxn });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}
