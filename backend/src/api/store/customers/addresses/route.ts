import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import zod from "zod";
import { CUSTOMER_MODULE } from "../../../../modules/customer";

const schema = zod.object({
    label: zod.string().optional(),
    first_name: zod.string().optional(),
    last_name: zod.string().optional(),
    phone: zod.string().optional(),
    line1: zod.string().min(1),
    line2: zod.string().optional(),
    city: zod.string().min(1),
    state: zod.string().optional(),
    pincode: zod.string().optional(),
    country: zod.string().optional(),
    latitude: zod.number().optional(),
    longitude: zod.number().optional(),
    is_default_shipping: zod.boolean().optional(),
    is_default_billing: zod.boolean().optional(),
});

/**
 * GET /store/customers/addresses
 * List the authenticated customer's addresses.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
    const customerModule = req.scope.resolve(CUSTOMER_MODULE) as {
        listAddresses: (customerId: string) => Promise<unknown[]>;
    };
    const customerId = (req as any).auth_context?.actor_id as string;
    const addresses = await customerModule.listAddresses(customerId);
    return res.status(200).json({ addresses });
}

/**
 * POST /store/customers/addresses
 * Create a new address for the authenticated customer.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ message: "Invalid address.", errors: parsed.error.flatten() });
    }

    const customerModule = req.scope.resolve(CUSTOMER_MODULE) as {
        createAddress: (input: Record<string, unknown>) => Promise<{ id: string }>;
    };
    const customerId = (req as any).auth_context?.actor_id as string;

    const address = await customerModule.createAddress({
        customer_id: customerId,
        ...parsed.data,
    });

    return res.status(201).json({ address });
}
