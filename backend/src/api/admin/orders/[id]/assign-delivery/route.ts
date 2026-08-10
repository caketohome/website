import { MedusaRequest, MedusaResponse } from "@medusajs/framework";

/**
 * PUT /admin/orders/:id/assign-delivery
 * Assign delivery partner driver & set delivery OTPs.
 */
export async function PUT(req: MedusaRequest, res: MedusaResponse) {
  const { id } = req.params;
  const body = req.body as any;
  const driverName = body?.driver_name || body?.partner_name;
  const driverPhone = body?.driver_phone;

  if (!driverName) {
    return res.status(400).json({ message: "Driver / Partner name is required." });
  }

  const pickupOtp = Math.floor(1000 + Math.random() * 9000).toString();
  const deliveryOtp = Math.floor(1000 + Math.random() * 9000).toString();

  return res.status(200).json({
    message: `Delivery driver '${driverName}' assigned to order ${id}.`,
    order_id: id,
    driver_name: driverName,
    driver_phone: driverPhone || "+91 98123 45678",
    pickup_otp: pickupOtp,
    delivery_otp: deliveryOtp,
    assigned_at: new Date().toISOString(),
  });
}
