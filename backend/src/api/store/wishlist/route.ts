import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { CATALOG_MODULE } from "../../../modules/catalog";
import { SETTINGS_MODULE } from "../../../modules/settings";

/**
 * GET /store/wishlist
 * Customer-authenticated — list the authenticated customer's wishlist.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
    const settingsModule = req.scope.resolve(SETTINGS_MODULE) as {
        isFeatureEnabled: (key: string) => Promise<boolean>;
    };
    if (!(await settingsModule.isFeatureEnabled("wishlist"))) {
        return res.status(403).json({ message: "Wishlist is not enabled." });
    }

    const catalogModule = req.scope.resolve(CATALOG_MODULE) as {
        listWishlist: (customerId: string) => Promise<unknown[]>;
    };
    const customerId = (req as any).auth_context?.actor_id as string;
    const items = await catalogModule.listWishlist(customerId);
    return res.status(200).json({ items });
}

/**
 * POST /store/wishlist
 * Customer-authenticated — add a product to the wishlist.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
    const settingsModule = req.scope.resolve(SETTINGS_MODULE) as {
        isFeatureEnabled: (key: string) => Promise<boolean>;
    };
    if (!(await settingsModule.isFeatureEnabled("wishlist"))) {
        return res.status(403).json({ message: "Wishlist is not enabled." });
    }

    const { product_id } = req.body as { product_id?: string };
    if (!product_id) {
        return res.status(400).json({ message: "product_id is required." });
    }

    const catalogModule = req.scope.resolve(CATALOG_MODULE) as {
        addToWishlist: (input: Record<string, unknown>) => Promise<Record<string, unknown>>;
    };
    const customerId = (req as any).auth_context?.actor_id as string;
    const item = await catalogModule.addToWishlist({ customer_id: customerId, product_id });
    return res.status(201).json({ item });
}

/**
 * DELETE /store/wishlist
 * Customer-authenticated — remove a product from the wishlist.
 * Query param: product_id
 */
export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
    const settingsModule = req.scope.resolve(SETTINGS_MODULE) as {
        isFeatureEnabled: (key: string) => Promise<boolean>;
    };
    if (!(await settingsModule.isFeatureEnabled("wishlist"))) {
        return res.status(403).json({ message: "Wishlist is not enabled." });
    }

    const productId = req.query.product_id as string | undefined;
    if (!productId) {
        return res.status(400).json({ message: "product_id is required." });
    }

    const catalogModule = req.scope.resolve(CATALOG_MODULE) as {
        removeFromWishlist: (customerId: string, productId: string) => Promise<void>;
    };
    const customerId = (req as any).auth_context?.actor_id as string;
    await catalogModule.removeFromWishlist(customerId, productId);
    return res.status(200).json({ removed: true });
}
