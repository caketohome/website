import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import zod from "zod";
import { CUSTOMER_MODULE } from "../../../../../modules/customer";

const schema = zod.object({
    label: zod.string().optional(),
    first_name: zod.string().optional(),
    last_name: zod.string().optional(),
    phone: zod.string().optional(),
    line1: zod.string().min(1).optional(),
    line2: zod.string().optional(),
    city: zod.string().min(1).optional(),
    state: zod.string().optional(),
    pincode: zod.string().optional(),
    country: zod.string().optional(),
    latitude: zod.number().optional(),
    longitude: zod.number().optional(),
    is_default_shipping: zod.boolean().optional(),
    is_default_billing: zod.boolean().optional(),
});

/**
 * GET /store/customers/addresses/:id
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
    const customerModule = req.scope.resolve(CUSTOMER_MODULE) as {
        listAddresses: (customerId: string) => Promise<{ id: string }[]>;
    };
    const customerId = (req as any).auth_context?.actor_id as string;
    const addressId = req.params.id as string;

    const addresses = await customerModule.listAddresses(customerId);
    const address = addresses.find((a) => a.id === addressId);
    if (!address) {
        return res.status(404).json({ message: "Address not found." });
    }
    return res.status(200).json({ address });
}

/**
 * POST /store/customers/addresses/:id
 * Update an address.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ message: "Invalid address.", errors: parsed.error.flatten() });
    }

    const customerModule = req.scope.resolve(CUSTOMER_MODULE) as {
        updateAddress: (id: string, data: Record<string, unknown>) => Promise<{ id: string }>;
    };
    const address = await customerModule.updateAddress(req.params.id as string, parsed.data);
    return res.status(200).json({ address });
}

/**
 * DELETE /store/customers/addresses/:id
 */
export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
    const customerModule = req.scope.resolve(CUSTOMER_MODULE) as {
        deleteAddress: (id: string) => Promise<void>;
    };
    await customerModule.deleteAddress(req.params.id as string);
    return res.status(204).end();
}
