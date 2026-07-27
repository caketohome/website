import { clientResolveQRCode } from "@frontend/lib/data/marketing-toolkit-client";
import { redirect } from "next/navigation";

/**
 * QR Code redirect — Phase 9.2 storefront route.
 *
 * Scanning a CakeToHome QR code hits /qr/<code>. This server component resolves
 * the code via /store/marketing/qr/:code (which increments the scan count and
 * returns the target URL) and redirects the visitor. If the code is unknown or
 * the feature flag is off, it falls back to the homepage.
 */
export default async function QRRedirectPage({
    params,
}: {
    params: { code: string };
}) {
    let targetUrl: string | null = null;
    try {
        const result = await clientResolveQRCode(params.code);
        targetUrl = result.qr_code?.target_url ?? null;
    } catch {
        // Code not found or feature disabled — fall back to homepage.
    }
    redirect(targetUrl ?? "/");
}
