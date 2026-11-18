/**
 * Surprise / gift services (greeting card, surprise video, …) managed in the dashboard and offered at
 * checkout for gift orders. Paid services become order lines with GST; free ones are ₹0 lines.
 */

import { dbQuery } from "../db";

export interface GiftService {
  id: string;
  name: string;
  description: string;
  price: number;
  gst_rate: number;
  hsn_sac: string;
  needs_note: boolean;
  note_label: string;
  is_active: boolean;
  display_order: number;
}

const ALLOWED_GST = [0, 5, 12, 18, 28];

function mapRow(r: any): GiftService {
  return {
    id: r.id,
    name: r.name,
    description: r.description || "",
    price: Number(r.price || 0),
    gst_rate: Number(r.gst_rate || 0),
    hsn_sac: r.hsn_sac || "",
    needs_note: Boolean(r.needs_note),
    note_label: r.note_label || "",
    is_active: Boolean(r.is_active),
    display_order: Number(r.display_order || 0),
  };
}

export async function listGiftServices(opts: { activeOnly?: boolean } = {}): Promise<GiftService[]> {
  const res = await dbQuery(
    `SELECT * FROM public.gift_service
      WHERE deleted_at IS NULL ${opts.activeOnly ? "AND is_active" : ""}
      ORDER BY display_order ASC, created_at ASC`
  );
  return res.rows.map(mapRow);
}

export async function getActiveGiftServicesByIds(ids: string[]): Promise<GiftService[]> {
  if (!ids.length) return [];
  const res = await dbQuery(
    `SELECT * FROM public.gift_service WHERE id = ANY($1::text[]) AND deleted_at IS NULL AND is_active`,
    [ids]
  );
  return res.rows.map(mapRow);
}

export async function saveGiftService(input: Partial<GiftService>): Promise<GiftService> {
  const name = String(input.name || "").trim();
  if (!name) throw new Error("Service name is required.");
  const price = Math.round(Number(input.price || 0) * 100) / 100;
  if (!Number.isFinite(price) || price < 0) throw new Error("Price must be zero (free) or more.");
  const gst = Number(input.gst_rate ?? 18);
  if (!ALLOWED_GST.includes(gst)) throw new Error("GST rate must be 0, 5, 12, 18 or 28%.");
  // Tax invoices need a 4-8 digit HSN (goods, e.g. greeting card) or SAC (services, e.g. photo/video).
  const hsnSac = String(input.hsn_sac || "").replace(/\s/g, "");
  if (!/^\d{4,8}$/.test(hsnSac)) throw new Error("Enter a 4–8 digit HSN/SAC code (needed on the tax invoice).");
  input = { ...input, hsn_sac: hsnSac };
  const id = input.id && /^gsvc_[a-z0-9_]+$/i.test(input.id) ? input.id : `gsvc_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const res = await dbQuery(
    `INSERT INTO public.gift_service (id, name, description, price, gst_rate, hsn_sac, needs_note, note_label, is_active, display_order)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name, description = EXCLUDED.description, price = EXCLUDED.price, gst_rate = EXCLUDED.gst_rate,
       hsn_sac = EXCLUDED.hsn_sac, needs_note = EXCLUDED.needs_note, note_label = EXCLUDED.note_label,
       is_active = EXCLUDED.is_active, display_order = EXCLUDED.display_order, updated_at = NOW()
     RETURNING *`,
    [
      id,
      name.slice(0, 120),
      String(input.description || "").slice(0, 500),
      price,
      gst,
      String(input.hsn_sac || "").slice(0, 12),
      Boolean(input.needs_note),
      String(input.note_label || "").slice(0, 80),
      input.is_active !== false,
      Number(input.display_order || 0),
    ]
  );
  return mapRow(res.rows[0]);
}

export async function deleteGiftService(id: string): Promise<boolean> {
  const res = await dbQuery(
    `UPDATE public.gift_service SET deleted_at = NOW(), is_active = false, updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  );
  return (res.rowCount || 0) > 0;
}
