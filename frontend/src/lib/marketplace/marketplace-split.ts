/**
 * Commission-marketplace split of one partner order (pure function — no DB).
 *
 * The partner is the seller of the goods: the goods' GST is the partner's liability, so it is part of
 * what we owe the partner. We (the e-commerce operator) earn the commission, charge 18% GST on it,
 * collect GST TCS u/s 52 (0.5% of the net taxable value of the partner's supply) and deduct income-tax
 * TDS u/s 194-O (0.1% of the gross amount of sales; GST excluded when shown separately).
 *
 *   partnerSaleGross = itemsTaxable + itemsGst
 *   partnerNet       = partnerSaleGross − commission − commissionGst − tcs − tds194O
 */

export const MARKETPLACE_ACCOUNTS = {
  PARTNER_PAYABLE: "2112",
  COMMISSION_INCOME: "4150",
  GST_TCS_PAYABLE: "2131",
  TDS_PAYABLE: "2130",
  // 18% GST on commission: CGST 9 + SGST 9 (intra-state) or IGST 18 (inter-state)
  CGST_9: "2123",
  SGST_9: "2124",
  IGST_18: "2126",
} as const;

export const COMMISSION_GST_RATE = 18;
export const GST_TCS_RATE = 0.5; // % — Notification 15/2024-CT, from 10 Jul 2024
export const TDS_194O_RATE = 0.1; // % — from 1 Oct 2024

const r2 = (n: number) => Math.round(n * 100) / 100;

/** 194-O small-seller exemption limit: resident individual/HUF with PAN, gross sales via the operator per FY. */
export const TDS_194O_EXEMPTION_LIMIT = 500000;

/**
 * Section 194-O(4): no TDS for a resident individual/HUF participant (PAN 4th char P/H, PAN furnished) while
 * gross sales through the operator in the financial year do not exceed ₹5 lakh. Per CBDT Circular 17/2020,
 * once the limit is crossed TDS applies to the full amount of every credit from that order onward
 * (earlier sales count toward the limit but are not deducted retrospectively).
 */
export function is194oExempt(params: { pan: string | null | undefined; fyGrossBefore: number; thisOrderGross: number }): boolean {
  const pan = String(params.pan || "").toUpperCase();
  if (!/^[A-Z]{3}[PH][A-Z][0-9]{4}[A-Z]$/.test(pan)) return false;
  return r2(Number(params.fyGrossBefore || 0) + Number(params.thisOrderGross || 0)) <= TDS_194O_EXEMPTION_LIMIT;
}

export interface MarketplaceSplit {
  partnerSaleGross: number;
  itemsTaxable: number;
  itemsGst: number;
  commission: number;
  commissionCgst: number;
  commissionSgst: number;
  commissionIgst: number;
  commissionGst: number;
  tcs: number;
  tds194o: number;
  partnerNet: number;
}

export function computeMarketplaceSplit(input: {
  itemsTaxable: number;
  itemsGst: number;
  agreementType: string;
  commissionRate: number; // percent
  fixedFee: number; // per order, excl. GST
  /** true when partner and operator GST registrations are in the same state */
  intraState: boolean;
  /** false when the 194-O small-seller exemption applies (see is194oExempt); defaults to true */
  tds194oApplies?: boolean;
}): MarketplaceSplit {
  const itemsTaxable = r2(Math.max(0, input.itemsTaxable));
  const itemsGst = r2(Math.max(0, input.itemsGst));
  const partnerSaleGross = r2(itemsTaxable + itemsGst);

  const rate = Math.max(0, Number(input.commissionRate) || 0);
  const fee = Math.max(0, Number(input.fixedFee) || 0);
  let commission = 0;
  switch (input.agreementType) {
    case "FIXED_PER_ORDER":
      commission = fee;
      break;
    case "HYBRID":
      commission = (partnerSaleGross * rate) / 100 + fee;
      break;
    case "WHOLESALE_TRANSFER":
      commission = 0;
      break;
    default: // COMMISSION_PERCENTAGE
      commission = (partnerSaleGross * rate) / 100;
  }
  commission = r2(commission);

  let commissionCgst = 0, commissionSgst = 0, commissionIgst = 0;
  if (input.intraState) {
    commissionCgst = r2((commission * COMMISSION_GST_RATE) / 200);
    commissionSgst = r2((commission * COMMISSION_GST_RATE) / 200);
  } else {
    commissionIgst = r2((commission * COMMISSION_GST_RATE) / 100);
  }
  const commissionGst = r2(commissionCgst + commissionSgst + commissionIgst);
  const tcs = r2((itemsTaxable * GST_TCS_RATE) / 100);
  const tds194o = input.tds194oApplies === false ? 0 : r2((itemsTaxable * TDS_194O_RATE) / 100);
  const partnerNet = r2(partnerSaleGross - commission - commissionGst - tcs - tds194o);

  if (partnerNet < 0) {
    throw new Error(
      `Marketplace split invalid: deductions (₹${r2(commission + commissionGst + tcs + tds194o)}) exceed the partner's sale (₹${partnerSaleGross}). Check the commission agreement.`
    );
  }
  return { partnerSaleGross, itemsTaxable, itemsGst, commission, commissionCgst, commissionSgst, commissionIgst, commissionGst, tcs, tds194o, partnerNet };
}
