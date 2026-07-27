import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/utils";

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  try {
    const delivery_partnerQuery = {
      entity: "delivery_partner",
      fields: ["*"],
      pagination: {
        take: null,
        skip: 0,
      },
    };

    const { data: delivery_partners } = await query.graph(delivery_partnerQuery);

    return res.status(200).json({ delivery_partners });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}
