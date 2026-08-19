import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { CATALOG_MODULE } from "../../../../../../modules/catalog";

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const catalogModule = req.scope.resolve(CATALOG_MODULE) as any;
  const { id } = req.params;
  try {
    const [meta] = await catalogModule.listProductMetas({ product_id: id });
    const enableFlavors = meta ? (meta.enable_flavor_selection ?? true) : true;
    const enableShapes = meta ? (meta.enable_shape_selection ?? true) : true;

    let flavors = [];
    if (enableFlavors) {
      const flavorMappings = await catalogModule.listProductFlavorMappings({ product_id: id, is_enabled: true });
      const allFlavors = await catalogModule.listFlavorMasters({ status: "active", is_enabled: true });
      if (flavorMappings.length > 0) {
        const allowedIds = new Set(flavorMappings.map((m: any) => m.flavor_id));
        flavors = allFlavors.filter((f: any) => allowedIds.has(f.id)).map((f: any) => {
          const map = flavorMappings.find((m: any) => m.flavor_id === f.id);
          return {
            ...f,
            price_modifier: map?.price_override ?? f.extra_price ?? 0,
          };
        });
      } else {
        // Fallback: return all active flavors if no specific mapping restricts it
        flavors = allFlavors.map((f: any) => ({
          ...f,
          price_modifier: f.extra_price ?? 0,
        }));
      }
    }

    let shapes = [];
    if (enableShapes) {
      const shapeMappings = await catalogModule.listProductShapeMappings({ product_id: id, is_enabled: true });
      const allShapes = await catalogModule.listShapeMasters({ status: "active", is_enabled: true });
      if (shapeMappings.length > 0) {
        const allowedIds = new Set(shapeMappings.map((m: any) => m.shape_id));
        shapes = allShapes.filter((s: any) => allowedIds.has(s.id)).map((s: any) => {
          const map = shapeMappings.find((m: any) => m.shape_id === s.id);
          return {
            ...s,
            price_modifier: map?.price_override ?? s.additional_price ?? 0,
          };
        });
      } else {
        shapes = allShapes.map((s: any) => ({
          ...s,
          price_modifier: s.additional_price ?? 0,
        }));
      }
    }

    return res.status(200).json({
      enable_flavor_selection: enableFlavors,
      enable_shape_selection: enableShapes,
      flavors,
      shapes,
    });
  } catch (e: any) {
    return res.status(500).json({ message: e.message || "Failed to fetch product storefront options" });
  }
}

