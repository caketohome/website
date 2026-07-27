import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { PAYMENT_MODULE } from "../../../../modules/payment";
import zod from "zod";

const initiateSchema = zod.object({
  amount: zod.number(),
  currency: zod.string(),
  order_id: zod.string(),
  branch_id: zod.string(),
  customer_id: zod.string(),
  provider: zod.string().default("cod"),
  idempotency_key: zod.string().optional(),
});

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const validated = initiateSchema.safeParse(req.body);
  if (!validated.success) {
    return res.status(400).json({ message: "Invalid payment initiation params.", errors: validated.error.format() });
  }

  const paymentService = req.scope.resolve(PAYMENT_MODULE) as any;
  const ipAddress = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress;
  const userAgent = req.headers["user-agent"];

  try {
    const session = await paymentService.initiatePaymentSession({
      amount: validated.data.amount,
      currency: validated.data.currency,
      orderId: validated.data.order_id,
      branchId: validated.data.branch_id,
      customerId: validated.data.customer_id,
      provider: validated.data.provider,
      idempotencyKey: validated.data.idempotency_key,
      ipAddress,
      userAgent,
    });

    return res.status(200).json({ session });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}
