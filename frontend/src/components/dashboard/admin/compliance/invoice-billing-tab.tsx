"use client";

import { useState } from "react";
import { Container, Heading, Text, Button, Input, Label, Badge } from "@medusajs/ui";
import { FileText, Save, CheckCircle2, Sliders, ToggleLeft, ToggleRight, Scale } from "lucide-react";
import { apiClient } from "@frontend/lib/api-client";

export function InvoiceBillingTab({
  invoiceSettings,
  onUpdated,
}: {
  invoiceSettings: any;
  onUpdated: (updated: any) => void;
}) {
  const [formData, setFormData] = useState({
    invoice_prefix: invoiceSettings?.invoice_prefix || "CTH",
    invoice_number_format: invoiceSettings?.invoice_number_format || "{PREFIX}/{FY}/{SEQ6}",
    next_invoice_number: invoiceSettings?.next_invoice_number || 102,
    credit_note_prefix: invoiceSettings?.credit_note_prefix || "CN-CTH",
    debit_note_prefix: invoiceSettings?.debit_note_prefix || "DN-CTH",
    show_legal_name: invoiceSettings?.show_legal_name !== false,
    show_gstin: invoiceSettings?.show_gstin !== false,
    show_registered_address: invoiceSettings?.show_registered_address !== false,
    show_branch_address: invoiceSettings?.show_branch_address !== false,
    show_fssai: invoiceSettings?.show_fssai !== false,
    invoice_footer:
      invoiceSettings?.invoice_footer ||
      "Thank you for celebrating with CakeToHome! Freshly baked with love & premium ingredients.",
    terms_and_conditions:
      invoiceSettings?.terms_and_conditions ||
      "1. Perishable confectionery goods. Consume within 24 hours of delivery.\n2. Subject to local jurisdiction.\n3. Goods once sold cannot be returned due to food safety & hygiene regulations.",
    authorized_signatory_title: invoiceSettings?.authorized_signatory_title || "For CakeToHome India Pvt Ltd",
  });

  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg(null);
    try {
      const res: any = await apiClient.updateInvoiceSettings(formData);
      const updated = res?.settings || res?.data || formData;
      onUpdated(updated);
      setSuccessMsg("Invoice & Statutory Billing Settings saved successfully!");
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      alert("Failed to save invoice settings: " + (err.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {successMsg && (
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-sm rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-600" />
            <Heading level="h3" className="text-base font-bold">Tax Invoices & Statutory Billing Rules</Heading>
          </div>
          <Text className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Configure automated sequence counters, legal disclaimer templates, and statutory fields embedded in PDF invoices.
          </Text>
        </div>
        <Button
          type="submit"
          isLoading={saving}
          className="bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-1.5 shrink-0"
        >
          <Save className="w-4 h-4" /> Save Invoice Settings
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Invoice Numbering & Sequence */}
        <Container className="p-5 flex flex-col gap-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <Sliders className="w-4 h-4 text-amber-600" />
            <Text className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              Numbering Sequences & Prefixes
            </Text>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="inv_prefix" className="text-xs font-semibold">Tax Invoice Prefix</Label>
              <Input
                id="inv_prefix"
                value={formData.invoice_prefix}
                onChange={(e) => setFormData({ ...formData, invoice_prefix: e.target.value })}
                required
                className="mt-1 font-mono uppercase"
              />
            </div>

            <div>
              <Label htmlFor="inv_format" className="text-xs font-semibold">Number Format Pattern</Label>
              <Input
                id="inv_format"
                value={formData.invoice_number_format}
                onChange={(e) => setFormData({ ...formData, invoice_number_format: e.target.value })}
                required
                className="mt-1 font-mono"
              />
            </div>

            <div>
              <Label htmlFor="next_inv" className="text-xs font-semibold">Next Invoice Sequence Counter</Label>
              <Input
                id="next_inv"
                type="number"
                value={String(formData.next_invoice_number)}
                onChange={(e) => setFormData({ ...formData, next_invoice_number: Number(e.target.value) || 1 })}
                required
                className="mt-1 font-mono"
              />
            </div>

            <div>
              <Label htmlFor="sig_title" className="text-xs font-semibold">Authorized Signatory Caption</Label>
              <Input
                id="sig_title"
                value={formData.authorized_signatory_title}
                onChange={(e) => setFormData({ ...formData, authorized_signatory_title: e.target.value })}
                required
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="cn_prefix" className="text-xs font-semibold">Credit Note Prefix</Label>
              <Input
                id="cn_prefix"
                value={formData.credit_note_prefix}
                onChange={(e) => setFormData({ ...formData, credit_note_prefix: e.target.value })}
                className="mt-1 font-mono uppercase"
              />
            </div>

            <div>
              <Label htmlFor="dn_prefix" className="text-xs font-semibold">Debit Note Prefix</Label>
              <Input
                id="dn_prefix"
                value={formData.debit_note_prefix}
                onChange={(e) => setFormData({ ...formData, debit_note_prefix: e.target.value })}
                className="mt-1 font-mono uppercase"
              />
            </div>
          </div>
        </Container>

        {/* Statutory Inclusions Toggles */}
        <Container className="p-5 flex flex-col gap-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <Scale className="w-4 h-4 text-amber-600" />
            <Text className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              Statutory Inclusions on Invoice Print
            </Text>
          </div>

          <div className="flex flex-col gap-3">
            <label className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 cursor-pointer">
              <div>
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">Display Legal Company Name</span>
                <p className="text-[11px] text-slate-400">Shows registered corporate name alongside trade brand</p>
              </div>
              <input
                type="checkbox"
                checked={formData.show_legal_name}
                onChange={(e) => setFormData({ ...formData, show_legal_name: e.target.checked })}
                className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
              />
            </label>

            <label className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 cursor-pointer">
              <div>
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">Display State GSTIN & Place of Supply</span>
                <p className="text-[11px] text-slate-400">Mandatory for GST compliant B2C / B2B billing</p>
              </div>
              <input
                type="checkbox"
                checked={formData.show_gstin}
                onChange={(e) => setFormData({ ...formData, show_gstin: e.target.checked })}
                className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
              />
            </label>

            <label className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 cursor-pointer">
              <div>
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">Display Branch FSSAI License Number</span>
                <p className="text-[11px] text-slate-400">Prints 14-digit FSSAI number of fulfilling bakery kitchen</p>
              </div>
              <input
                type="checkbox"
                checked={formData.show_fssai}
                onChange={(e) => setFormData({ ...formData, show_fssai: e.target.checked })}
                className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
              />
            </label>

            <label className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 cursor-pointer">
              <div>
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">Display Branch Fulfilling Kitchen Address</span>
                <p className="text-[11px] text-slate-400">Shows physical location where goods were baked and dispatched</p>
              </div>
              <input
                type="checkbox"
                checked={formData.show_branch_address}
                onChange={(e) => setFormData({ ...formData, show_branch_address: e.target.checked })}
                className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
              />
            </label>
          </div>
        </Container>
      </div>

      {/* Terms & Footer Disclaimers */}
      <Container className="p-5 flex flex-col gap-4">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
          <FileText className="w-4 h-4 text-amber-600" />
          <Text className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
            Terms, Conditions & Invoice Footer
          </Text>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="inv_terms" className="text-xs font-semibold">Terms & Conditions</Label>
            <textarea
              id="inv_terms"
              rows={4}
              value={formData.terms_and_conditions}
              onChange={(e) => setFormData({ ...formData, terms_and_conditions: e.target.value })}
              className="w-full mt-1 px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
            />
          </div>

          <div>
            <Label htmlFor="inv_footer" className="text-xs font-semibold">Invoice Footer Note / Greeting</Label>
            <textarea
              id="inv_footer"
              rows={4}
              value={formData.invoice_footer}
              onChange={(e) => setFormData({ ...formData, invoice_footer: e.target.value })}
              className="w-full mt-1 px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
        </div>
      </Container>
    </form>
  );
}
