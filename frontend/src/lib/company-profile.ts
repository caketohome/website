/**
 * Company details — single source of truth is public.company (edited in Settings → Business Profile).
 * Invoices, footer, contact sections, SEO and the engine all read from here; nothing is hardcoded.
 * Server-only (uses the database).
 */
import { dbQuery } from "./db";

const STATE_NAMES: Record<string, string> = {
  "01": "Jammu and Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh", "05": "Uttarakhand", "06": "Haryana",
  "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh", "10": "Bihar", "18": "Assam", "19": "West Bengal", "20": "Jharkhand",
  "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat", "27": "Maharashtra", "29": "Karnataka",
  "30": "Goa", "32": "Kerala", "33": "Tamil Nadu", "34": "Puducherry", "36": "Telangana", "37": "Andhra Pradesh",
};

export interface CompanyProfile {
  id: string | null;
  legal_name: string;
  trade_name: string;
  business_type: string;
  pan: string;
  tan: string;
  cin: string;
  fssai: string;
  gstin: string;
  registered_email: string;
  registered_phone: string;
  support_email: string;
  support_phone: string;
  support_whatsapp: string;
  website: string;
  invoice_prefix: string;
  logo_url: string;
  status: "ACTIVE" | "INACTIVE";
  registered_address: { line1: string; line2: string; city: string; state: string; state_code: string; country: string; country_code: string; pincode: string };
  /** One-line address for documents, e.g. "16/956, Thannimukku, Mayyanad, Kollam, Kerala - 691303" */
  address_text: string;
  primary_contact: { name: string; phone: string; email: string; designation: string };
  authorized_signatory: { name: string; designation: string; email: string; phone: string };
}

export const EMPTY_COMPANY_PROFILE: CompanyProfile = {
  id: null, legal_name: "", trade_name: "", business_type: "", pan: "", tan: "", cin: "", fssai: "", gstin: "",
  registered_email: "", registered_phone: "", support_email: "", support_phone: "", support_whatsapp: "", website: "", invoice_prefix: "",
  logo_url: "/logo.png", status: "INACTIVE",
  registered_address: { line1: "", line2: "", city: "", state: "", state_code: "", country: "India", country_code: "IN", pincode: "" },
  address_text: "",
  primary_contact: { name: "", phone: "", email: "", designation: "" },
  authorized_signatory: { name: "", designation: "Authorized Signatory", email: "", phone: "" },
};

/** Maps a public.company row (+ optional primary GSTIN) to the profile used everywhere. No invented values. */
export function mapCompanyRow(c: any, gstin = ""): CompanyProfile {
  if (!c) return { ...EMPTY_COMPANY_PROFILE };
  const m = c.metadata || {};
  const addr = m.registered_address || {};
  const stateCode = String(c.state_code || addr.state_code || "");
  const state = addr.state || STATE_NAMES[stateCode] || "";
  const line1 = addr.line1 ?? c.registered_address ?? "";
  const line2 = addr.line2 ?? "";
  const city = c.city || addr.city || "";
  const pincode = c.pin_code || addr.pincode || "";
  const street = [line1, line2].filter(Boolean).join(", ");
  const lower = street.toLowerCase();
  const address_text = pincode && street.includes(pincode)
    ? street
    : [street, city && !lower.includes(city.toLowerCase()) ? city : "", state && !lower.includes(state.toLowerCase()) ? state : ""].filter(Boolean).join(", ") + (pincode ? ` - ${pincode}` : "");
  const email = c.email || "";
  const phone = c.phone || "";
  return {
    id: c.id,
    legal_name: c.legal_name || "",
    trade_name: c.trade_name || c.legal_name || "",
    business_type: m.business_type || "",
    pan: c.pan || "",
    tan: m.tan || "",
    cin: c.cin || "",
    fssai: c.fssai || "",
    gstin,
    registered_email: email,
    registered_phone: phone,
    support_email: m.support_email || email,
    support_phone: m.support_phone || phone,
    support_whatsapp: m.support_whatsapp || "",
    website: c.website || "",
    invoice_prefix: c.invoice_prefix || "",
    logo_url: m.logo_url || "/logo.png",
    status: c.is_active ? "ACTIVE" : "INACTIVE",
    registered_address: { line1, line2, city, state, state_code: stateCode, country: addr.country || "India", country_code: addr.country_code || "IN", pincode },
    address_text: address_text.replace(/^,\s*/, ""),
    primary_contact: { name: m.primary_contact?.name || "", phone: m.primary_contact?.phone || phone, email: m.primary_contact?.email || email, designation: m.primary_contact?.designation || "" },
    authorized_signatory: { name: m.authorized_signatory?.name || "", designation: m.authorized_signatory?.designation || "Authorized Signatory", email: m.authorized_signatory?.email || email, phone: m.authorized_signatory?.phone || phone },
  };
}

const g = globalThis as any;
const TTL_MS = 15_000;

/** Current company profile from the database (cached briefly; cleared on every save). */
export async function getCompanyProfile(): Promise<CompanyProfile> {
  const cached = g.__cthCompanyProfile as { at: number; value: CompanyProfile } | undefined;
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;
  try {
    const r = await dbQuery(`SELECT * FROM public.company WHERE is_active = true ORDER BY created_at ASC LIMIT 1`);
    const c = r.rows[0];
    let gstin = "";
    if (c) {
      const gr = await dbQuery(
        `SELECT gstin FROM public.gst_registration WHERE company_id = $1 AND is_active = true ORDER BY (state_code = $2) DESC, created_at ASC LIMIT 1`,
        [c.id, c.state_code || ""]
      ).catch(() => ({ rows: [] as any[] }));
      gstin = gr.rows[0]?.gstin || "";
    }
    const value = mapCompanyRow(c, gstin);
    g.__cthCompanyProfile = { at: Date.now(), value };
    return value;
  } catch (e: any) {
    console.warn("[company-profile] load failed:", e?.message);
    return cached?.value || { ...EMPTY_COMPANY_PROFILE };
  }
}

export function invalidateCompanyProfile(): void {
  g.__cthCompanyProfile = undefined;
}

/** Fields safe to show publicly (storefront footer, contact, SEO, customer invoices). */
export function publicCompanyInfo(p: CompanyProfile) {
  return {
    legal_name: p.legal_name,
    trade_name: p.trade_name,
    gstin: p.gstin,
    cin: p.cin,
    fssai: p.fssai,
    support_email: p.support_email,
    support_phone: p.support_phone,
    support_whatsapp: p.support_whatsapp,
    website: p.website,
    logo_url: p.logo_url,
    address_text: p.address_text,
    registered_address: p.registered_address,
    authorized_signatory_name: p.authorized_signatory.name,
  };
}
export type PublicCompanyInfo = ReturnType<typeof publicCompanyInfo>;
