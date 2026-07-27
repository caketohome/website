import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { DELIVERY_MODULE } from "../../../../modules/delivery/service";

/**
 * GET /store/delivery_partners/wallet
 * Storefront — Retrieve driver's wallet ledger and transactions summary.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const deliveryService = req.scope.resolve(DELIVERY_MODULE) as any;
  const partnerId = (req as any).auth_context?.app_metadata?.delivery_partner_id || "dlp_1";

  try {
    let [wallet] = await deliveryService.listDriverWallets({ partner_id: partnerId });
    if (!wallet) {
      const created = await deliveryService.createDriverWallets([{ partner_id: partnerId, balance: "0.0" }]);
      wallet = created[0];
    }

    const transactions = await deliveryService.listDriverTransactions({ wallet_id: wallet.id });

    return res.status(200).json({ wallet, transactions });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}
