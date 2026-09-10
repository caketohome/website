import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/utils";

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  try {
    const take = Math.min(Math.max(1, parseInt(req.query.take as string) || 20), 100);
    const skip = Math.max(0, parseInt(req.query.skip as string) || 0);

    const delivery_partnerQuery = {
      entity: "delivery_partner",
      fields: ["*"],
      pagination: {
        take,
        skip,
        order: { id: "ASC" },
      },
    };

    const { data: delivery_partners } = await query.graph(delivery_partnerQuery);

    return res.status(200).json({
      delivery_partners,
      count: (delivery_partners || []).length,
      limit: take,
      offset: skip,
      pagination: {
        page: Math.floor(skip / take) + 1,
        pageSize: take,
        hasNextPage: (delivery_partners || []).length >= take,
        hasPreviousPage: skip > 0,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}
