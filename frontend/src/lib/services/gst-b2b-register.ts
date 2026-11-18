/**
 * GST B2B register — tax invoices issued to GST-registered buyers (GSTR-1 B2B / Table 4A), rate-wise.
 *
 * Covers:
 *  - our own sales (seller = our GSTIN) → our GSTR-1 B2B
 *  - cakes sold by marketplace partners (seller = partner GSTIN) → the partner's GSTR-1 B2B + Table 14;
 *    the buyer uses these for input tax credit
 *  - corporate (Bills Receivable) invoices, whose buyer GSTIN comes from the customer record
 */

import { dbQuery } from "../db";

export interface B2bRegisterRow {
  invoice_number: string;
  invoice_date: string;
  seller_gstin: string | null;
  seller_name: string | null;
  is_partner_sale: boolean;
  buyer_gstin: string;
  buyer_name: string | null;
  place_of_supply: string | null;
  gst_rate: number;
  taxable_value: number;
  cgst: number;
  sgst: number;
  igst: number;
  invoice_value: number;
}

const n = (v: any) => Math.round(Number(v || 0) * 100) / 100;

export async function getB2bRegister(params: { from: string; to: string; seller?: "all" | "own" | "partner"; sellerGstin?: string; partnerId?: string }, q: (sql: string, params: any[]) => Promise<{ rows: any[] }> = dbQuery) {
  const res = await q(
    `SELECT i.invoice_number,
            (i.created_at AT TIME ZONE 'Asia/Kolkata')::date::text AS invoice_date,
            COALESCE(i.seller_gstin, i.metadata->>'seller_gstin') AS seller_gstin,
            COALESCE(i.seller_legal_name, i.metadata->>'seller_legal_name') AS seller_name,
            (mos.order_id IS NOT NULL) AS is_partner_sale,
            COALESCE(i.customer_gstin, CASE WHEN i.is_corporate THEN c.gstin END) AS buyer_gstin,
            COALESCE(i.customer_legal_name, c.company_name, i.customer_name) AS buyer_name,
            NULLIF(i.metadata->>'customer_state', '') AS place_of_supply,
            COALESCE(NULLIF(it->>'gst_rate_pct', '')::numeric, NULLIF(it->>'tax_rate', '')::numeric, 0) AS gst_rate,
            SUM(COALESCE(NULLIF(it->>'taxable_value', '')::numeric, 0)) AS taxable_value,
            SUM(COALESCE(NULLIF(it->>'cgst', '')::numeric, 0)) AS cgst,
            SUM(COALESCE(NULLIF(it->>'sgst', '')::numeric, 0)) AS sgst,
            SUM(COALESCE(NULLIF(it->>'igst', '')::numeric, 0)) AS igst,
            i.grand_total AS invoice_value
     FROM public.invoice i
     LEFT JOIN public.customer c ON c.id = i.customer_id
     LEFT JOIN public.marketplace_order_snapshot mos ON mos.order_id = i.order_id
     CROSS JOIN LATERAL jsonb_array_elements(
       CASE WHEN jsonb_typeof(i.metadata->'items') = 'array' THEN i.metadata->'items' ELSE '[]'::jsonb END
     ) AS it
     WHERE i.deleted_at IS NULL
       AND COALESCE(i.status, '') NOT IN ('CANCELLED', 'VOID')
       AND COALESCE(i.customer_gstin, CASE WHEN i.is_corporate THEN c.gstin END) IS NOT NULL
       AND (i.created_at AT TIME ZONE 'Asia/Kolkata')::date BETWEEN $1::date AND $2::date
       AND ($3::text = 'all' OR ($3 = 'partner') = (mos.order_id IS NOT NULL))
       AND ($4::text IS NULL OR COALESCE(i.seller_gstin, i.metadata->>'seller_gstin') = $4)
       AND ($5::text IS NULL OR mos.partner_id = $5)
     GROUP BY i.id, i.invoice_number, i.created_at, i.metadata, i.seller_gstin, i.seller_legal_name, mos.order_id, i.customer_gstin, i.is_corporate, c.gstin,
              i.customer_legal_name, c.company_name, i.customer_name, gst_rate, i.grand_total
     ORDER BY i.created_at ASC, i.invoice_number ASC, gst_rate ASC`,
    [params.from, params.to, params.seller || "all", params.sellerGstin || null, params.partnerId || null]
  );

  const rows: B2bRegisterRow[] = res.rows.map((r: any) => ({
    invoice_number: r.invoice_number,
    invoice_date: r.invoice_date,
    seller_gstin: r.seller_gstin,
    seller_name: r.seller_name,
    is_partner_sale: Boolean(r.is_partner_sale),
    buyer_gstin: r.buyer_gstin,
    buyer_name: r.buyer_name,
    place_of_supply: r.place_of_supply,
    gst_rate: Number(r.gst_rate),
    taxable_value: n(r.taxable_value),
    cgst: n(r.cgst),
    sgst: n(r.sgst),
    igst: n(r.igst),
    invoice_value: n(r.invoice_value),
  }));

  const sum = (k: keyof B2bRegisterRow) => n(rows.reduce((s, r) => s + Number(r[k] || 0), 0));
  return {
    rows,
    totals: {
      invoices: new Set(rows.map((r) => r.invoice_number)).size,
      taxable_value: sum("taxable_value"),
      cgst: sum("cgst"),
      sgst: sum("sgst"),
      igst: sum("igst"),
    },
  };
}
