import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { Modules } from "@medusajs/framework/utils";

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const orderService = req.scope.resolve(Modules.ORDER) as any;
    const orders = await orderService.listOrders({});
    return res.status(200).json({ orders });
  } catch (err: any) {
    return res.status(200).json({ orders: [] });
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const body = req.body as any;
  try {
    const orderService = req.scope.resolve(Modules.ORDER) as any;
    const order = await orderService.createOrders({
      currency_code: body.currency_code || "inr",
      email: body.email || `order_${Date.now()}@cakes2home.com`,
      items: body.items || [],
      metadata: body.metadata || {},
    });
    const created = Array.isArray(order) ? order[0] : order;
    return res.status(200).json({ order: created });
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
}
