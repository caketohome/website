/**
 * CakeToHome ERP — Purchase & Supplier Types
 * Phase 1: Canonical TypeScript DTOs for the Purchase + Supplier module.
 *
 * CONVENTIONS:
 * - All monetary values in INR, stored as NUMERIC in DB
 * - IDs are TEXT with prefix: sup_*, pur_*, puri_*, purp_*
 * - Soft deletion via deleted_at TIMESTAMPTZ (nullable)
 * - Status lifecycle: DRAFT → SUBMITTED → APPROVED → POSTED
 * - Branch scope enforced server-side — never from client input
 * - No fabricated values — unavailable fields return null
 */

// ─── Purchase Status Lifecycle ──────────────────────────────────────────────

export type PurchaseStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "POSTED";

/** Valid forward-only status transitions */
export const PURCHASE_TRANSITIONS: Record<PurchaseStatus, PurchaseStatus[]> = {
  DRAFT:     ["SUBMITTED"],
  SUBMITTED: ["APPROVED", "DRAFT"],  // can be sent back to draft
  APPROVED:  ["POSTED"],
  POSTED:    [],                     // terminal — accounting integration
};

// ─── Supplier ────────────────────────────────────────────────────────────────

export interface SupplierRow {
  id: string;
  name: string;
  gstin: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  /** Primary branch association — may be NULL for cross-branch suppliers */
  branch_id: string | null;
  is_active: boolean;
  created_by: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface SupplierCreateInput {
  name: string;
  gstin?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  branch_id?: string | null;
  is_active?: boolean;
  metadata?: Record<string, unknown> | null;
}

export interface SupplierUpdateInput extends Partial<SupplierCreateInput> {
  is_active?: boolean;
}

export interface SupplierListFilters {
  branch_id?: string;
  is_active?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface SupplierListResult {
  suppliers: SupplierRow[];
  total: number;
}

// ─── Purchase Item ────────────────────────────────────────────────────────────

export interface PurchaseItemRow {
  id: string;
  purchase_id: string;
  product_id: string | null;
  variant_id: string | null;
  item_type: "CAKE" | "ACCESSORY" | "PACKAGING";
  description: string;
  quantity: number;
  rate: number;
  discount: number;
  taxable_value: number;
  cgst_rate: number | null;
  sgst_rate: number | null;
  igst_rate: number | null;
  cgst: number | null;
  sgst: number | null;
  igst: number | null;
  total: number;
  hsn_code: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface PurchaseItemInput {
  product_id?: string | null;
  variant_id?: string | null;
  item_type?: "CAKE" | "ACCESSORY" | "PACKAGING";
  description: string;
  quantity: number;
  rate: number;
  discount?: number;
  taxable_value: number;
  cgst_rate?: number | null;
  sgst_rate?: number | null;
  igst_rate?: number | null;
  cgst?: number | null;
  sgst?: number | null;
  igst?: number | null;
  total: number;
  hsn_code?: string | null;
}

// ─── Purchase Payment ─────────────────────────────────────────────────────────

export type PurchasePaymentMethod = "CASH" | "UPI" | "BANK_TRANSFER" | "CHEQUE" | "CARD" | "OTHER";

export interface PurchasePaymentRow {
  id: string;
  purchase_id: string;
  amount: number;
  method: PurchasePaymentMethod;
  payment_date: string;
  reference: string | null;
  created_by: string | null;
  voucher_id?: string | null;
  bank_account_id?: string | null;
  teller_session_id?: string | null;
  branch_id?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface PurchasePaymentAllocationRow {
  id: string;
  payment_id: string;
  purchase_id: string;
  allocated_amount: number;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface PurchasePaymentInput {
  amount: number;
  method: PurchasePaymentMethod;
  payment_date: string;
  reference?: string | null;
  voucher_id?: string | null;
  bank_account_id?: string | null;
  teller_session_id?: string | null;
  branch_id?: string | null;
}

// ─── Purchase (main) ──────────────────────────────────────────────────────────

export interface PurchaseRow {
  id: string;
  supplier_id: string | null;
  /** Branch scope — always server-enforced, never from client */
  branch_id: string;
  invoice_no: string | null;
  invoice_date: string | null;
  subtotal: number;
  discount: number;
  taxable_value: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
  payment_method: PurchasePaymentMethod | null;
  credit_terms_days: number | null;
  due_date: string | null;
  status: PurchaseStatus;
  voucher_id?: string | null;
  created_by: string | null;
  approved_by: string | null;
  /** Set when status transitions to POSTED — reserved for accounting Phase 7/8 */
  posted_at: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  // Joined fields (populated when fetched with relations)
  supplier_name?: string | null;
  branch_name?: string | null;
  items?: PurchaseItemRow[];
  payments?: PurchasePaymentRow[];
}

export interface PurchaseCreateInput {
  supplier_id?: string | null;
  invoice_no?: string | null;
  invoice_date?: string | null;
  subtotal: number;
  discount?: number;
  taxable_value: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
  total: number;
  payment_method?: PurchasePaymentMethod | null;
  credit_terms_days?: number | null;
  due_date?: string | null;
  metadata?: Record<string, unknown> | null;
  items: PurchaseItemInput[];
  payments?: PurchasePaymentInput[];
}

export interface PurchaseUpdateInput extends Partial<Omit<PurchaseCreateInput, "items">> {
  items?: PurchaseItemInput[];
}

export interface PurchaseListFilters {
  branch_id?: string;
  supplier_id?: string;
  status?: PurchaseStatus;
  startDate?: string;
  endDate?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface PurchaseListResult {
  purchases: PurchaseRow[];
  total: number;
}

// ─── Purchase Report DTOs ─────────────────────────────────────────────────────

export interface PurchaseRegisterRow {
  id: string;
  invoice_no: string | null;
  invoice_date: string | null;
  supplier_id: string | null;
  supplier_name: string | null;
  branch_id: string;
  branch_name: string | null;
  subtotal: number;
  discount: number;
  taxable_value: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
  status: PurchaseStatus;
  payment_method: string | null;
  due_date: string | null;
  created_at: string;
}

export interface SupplierPurchaseSummaryRow {
  supplier_id: string;
  supplier_name: string | null;
  supplier_gstin: string | null;
  total_bills: number;
  total_value: number;
  total_taxable: number;
  total_cgst: number;
  total_sgst: number;
  total_igst: number;
  total_paid: number | null;
  total_returns?: number | null;
  pending_value: number | null;
}

export interface ItemWisePurchaseRow {
  description: string;
  hsn_code: string | null;
  product_id: string | null;
  total_quantity: number;
  avg_rate: number;
  total_value: number;
  total_taxable: number;
  total_cgst: number | null;
  total_sgst: number | null;
  total_igst: number | null;
  bill_count: number;
}

export interface BillWisePurchaseRow {
  id: string;
  invoice_no: string | null;
  invoice_date: string | null;
  supplier_name: string | null;
  branch_name: string | null;
  total: number;
  status: PurchaseStatus;
  is_reversed?: boolean;
  total_paid: number | null;
  total_returns?: number | null;
  balance_due: number | null;
  due_date: string | null;
}

export interface PurchaseGstHsnRow {
  hsn_code: string | null;
  description: string | null;
  total_quantity: number;
  total_taxable: number;
  cgst_rate: number | null;
  sgst_rate: number | null;
  igst_rate: number | null;
  total_cgst: number;
  total_sgst: number;
  total_igst: number;
  total_tax: number;
  total_value: number;
}

export interface PurchaseReportFilters {
  branch_id?: string;
  supplier_id?: string;
  status?: PurchaseStatus;
  startDate?: string;
  endDate?: string;
}

// ─── API Response Wrappers ────────────────────────────────────────────────────

export interface PurchaseApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
