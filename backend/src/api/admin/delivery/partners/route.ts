import { MedusaRequest, MedusaResponse } from "@medusajs/framework";

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const deliveryService = req.scope.resolve("deliveryModuleService") as any;
  try {
    const partners = await deliveryService.listDeliveryPartners({});
    return res.status(200).json({ partners });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const body = req.body as any;
  const fName = body.first_name || body.name?.split(" ")[0] || "Rider";
  const lName = body.last_name || body.name?.split(" ").slice(1).join(" ") || "Driver";
  const phone = body.phone || "+91 99000 00000";
  const email = body.email || `driver_${Date.now()}@cakes2home.com`;

  const deliveryService = req.scope.resolve("deliveryModuleService") as any;
  try {
    const partner = await deliveryService.createDeliveryPartners({
      first_name: fName,
      last_name: lName,
      phone,
      email,
      status: "active",
    });
    return res.status(200).json({ partner });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}
