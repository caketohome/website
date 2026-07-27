import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/utils";
import { ORDER_LIFECYCLE_MODULE } from "../../../../../modules/order-lifecycle";
import { SETTINGS_MODULE } from "../../../../../modules/settings";
import { AUDIT_MODULE } from "../../../../../modules/audit";

/**
 * GET /store/orders/:id/invoice
 * Customer-authenticated — generate and download a digital invoice (PDF) for
 * an order. The invoice prefix is configurable via Settings
 * (invoices.prefix). Returns a `application/pdf` stream.
 *
 * The PDF is generated server-side from the order data. It includes the
 * invoice number (prefix + display_id), line items, totals, billing/shipping
 * addresses, and the order lifecycle status.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
    const settingsModule = req.scope.resolve(SETTINGS_MODULE) as {
        isFeatureEnabled: (key: string) => Promise<boolean>;
        getValue: <T = string>(group: string, key: string) => Promise<T | null>;
        getGroup: (group: string) => Promise<Record<string, unknown>>;
    };
    if (!(await settingsModule.isFeatureEnabled("invoices"))) {
        return res.status(403).json({ message: "Invoices are not enabled." });
    }

    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
    const orderLifecycleModule = req.scope.resolve(ORDER_LIFECYCLE_MODULE) as {
        getCurrentStatus: (orderId: string) => Promise<string | null>;
    };
    const auditModule = req.scope.resolve(AUDIT_MODULE) as any;

    const orderId = req.params.id;
    const customerId = (req as any).auth_context?.actor_id as string;

    const { data: orders } = await query.graph({
        entity: "order",
        fields: [
            "id",
            "display_id",
            "status",
            "total",
            "subtotal",
            "shipping_total",
            "tax_total",
            "discount_total",
            "currency_code",
            "created_at",
            "email",
            "shipping_address.*",
            "billing_address.*",
            "items.*",
            "items.variant.product.title",
        ],
        filters: { id: orderId },
    });
    const order = (orders as Record<string, unknown>[])?.[0];
    if (!order) {
        return res.status(404).json({ message: "Order not found." });
    }
    if ((order as any).customer_id && (order as any).customer_id !== customerId) {
        return res.status(403).json({ message: "Forbidden." });
    }

    const invoiceConfig = await settingsModule.getGroup("invoices");
    const prefix = (invoiceConfig.prefix as string) ?? "INV-";
    const businessConfig = await settingsModule.getGroup("business");
    const businessName = (businessConfig.name as string) ?? "CakeToHome";
    const businessAddress = (businessConfig.address as string) ?? "";
    const businessGstin = (businessConfig.gstin as string) ?? "";
    const fssai = (businessConfig.fssai as string) ?? "";

    const currentStatus = (await orderLifecycleModule.getCurrentStatus(orderId)) ?? "pending";
    const invoiceNumber = `${prefix}${order.display_id ?? order.id}`;

    // Build a minimal, valid PDF document. This is a hand-rolled PDF generator
    // to avoid adding a heavy dependency (pdfkit/jsPDF) to the backend. It
    // produces a single-page invoice with the key fields. For richer layouts,
    // a future cycle can swap in a templating engine (e.g. puppeteer/Handlebars)
    // behind the same endpoint contract.
    const pdf = buildInvoicePdf({
        invoiceNumber,
        businessName,
        businessAddress,
        businessGstin,
        fssai,
        order,
        currentStatus,
    });

    await auditModule.log({
        actor_id: customerId,
        actor_type: "customer",
        action: "order.invoice_downloaded",
        entity: "order",
        entity_id: orderId,
        metadata: { invoice_number: invoiceNumber },
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
        "Content-Disposition",
        `attachment; filename="${invoiceNumber}.pdf"`
    );
    return res.status(200).send(Buffer.from(pdf, "binary"));
}

/**
 * Build a minimal valid single-page PDF containing the invoice text.
 * Uses the standard PDF text operators (BT/ET, Tf, Td, Tj).
 */
function buildInvoicePdf(input: {
    invoiceNumber: string;
    businessName: string;
    businessAddress: string;
    businessGstin: string;
    fssai: string;
    order: Record<string, unknown>;
    currentStatus: string;
}): string {
    const lines: string[] = [];
    lines.push(`${input.businessName} — Tax Invoice`);
    lines.push(`Invoice No: ${input.invoiceNumber}`);
    if (input.businessAddress) lines.push(`Address: ${input.businessAddress}`);
    if (input.businessGstin) lines.push(`GSTIN: ${input.businessGstin}`);
    if (input.fssai) lines.push(`FSSAI: ${input.fssai}`);
    lines.push("");
    lines.push(`Order ID: ${input.order.id as string}`);
    lines.push(`Status: ${input.currentStatus}`);
    lines.push(`Date: ${input.order.created_at as string}`);
    lines.push(`Currency: ${input.order.currency_code as string ?? "INR"}`);
    lines.push("");
    lines.push("Items:");
    const items = (input.order.items as Record<string, unknown>[]) ?? [];
    for (const item of items) {
        const title =
            ((item.variant as Record<string, unknown> | null)?.product as Record<string, unknown> | null)?.title ??
            "Item";
        const qty = item.quantity as number;
        lines.push(`  - ${title} x ${qty}`);
    }
    lines.push("");
    lines.push(`Subtotal: ${input.order.subtotal ?? input.order.total ?? 0}`);
    lines.push(`Shipping: ${input.order.shipping_total ?? 0}`);
    lines.push(`Tax: ${input.order.tax_total ?? 0}`);
    lines.push(`Discount: -${input.order.discount_total ?? 0}`);
    lines.push(`Total: ${input.order.total ?? 0}`);

    // Escape parentheses and backslashes for PDF string literals.
    const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

    let content = "";
    let y = 760;
    const lineHeight = 14;
    for (const line of lines) {
        content += `BT /F1 10 Tf 50 ${y} Td (${esc(line)}) Tj ET\n`;
        y -= lineHeight;
    }

    const header =
        "%PDF-1.4\n" +
        "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n" +
        "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n" +
        "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>\nendobj\n";

    const contentObj = `4 0 obj\n<< /Length ${content.length} >>\nstream\n${content}endstream\nendobj\n`;
    const fontObj =
        "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n";

    const objects = [header, contentObj, fontObj];
    const fullBody = objects.join("");
    // Build xref table.
    const xrefOffset = fullBody.length;
    let xref = `xref\n0 ${objects.length + 1}\n`;
    xref += "0000000000 65535 f \n";
    let offset = 0;
    for (let i = 0; i < objects.length; i++) {
        xref += `${offset.toString().padStart(10, "0")} 00000 n \n`;
        offset += objects[i].length;
    }
    const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

    return fullBody + xref + trailer;
}
