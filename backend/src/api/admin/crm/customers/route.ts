import { MedusaRequest, MedusaResponse } from "@medusajs/framework";

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const customerService = req.scope.resolve("customer") as any;
  try {
    const customers = await customerService.listCustomers({});
    return res.status(200).json({ customers });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const body = req.body as any;
  const fName = body.first_name || body.name?.split(" ")[0] || "Customer";
  const lName = body.last_name || body.name?.split(" ").slice(1).join(" ") || "";
  const email = body.email || `customer_${Date.now()}@example.com`;
  const phone = body.phone || "+91 98765 00000";

  const customerService = req.scope.resolve("customer") as any;
  try {
    const customer = await customerService.createCustomers({
      first_name: fName,
      last_name: lName,
      email,
      phone,
      has_account: true,
    });
    return res.status(200).json({ customer });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}
