import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { Modules } from "@medusajs/framework/utils";

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const productService = req.scope.resolve(Modules.PRODUCT) as any;
    const products = await productService.listProducts({});
    return res.status(200).json({ products });
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const body = req.body as any;
  const title = body.title || body.name || "Custom Cake";
  const handle = body.handle || `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;

  try {
    const productService = req.scope.resolve(Modules.PRODUCT) as any;
    const product = await productService.createProducts({
      title,
      handle,
      description: body.description || "Freshly baked cake",
    });
    const created = Array.isArray(product) ? product[0] : product;
    return res.status(200).json({ product: created });
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
}
