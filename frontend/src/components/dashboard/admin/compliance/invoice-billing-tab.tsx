"use client";

import { useState, useEffect } from "react";
import { Container, Heading, Text, Button, Input, Label, Badge } from "@medusajs/ui";
import { FileText, Save, CheckCircle2, Sliders, ToggleLeft, ToggleRight, Scale, Check, Plus, AlertCircle } from "lucide-react";
import { apiClient } from "@frontend/lib/api-client";

interface InvoiceSeriesRow {
  id: string;
  entity_id: string;
  gstin: string;
  fiscal_year: number;
  prefix: string;
  last_seq: number;
  document_type: string;
  is_active: boolean;
  approval_status: "APPROVED" | "PROPOSED" | "DEPRECATED_HISTORICAL" | "REJECTED";
  authorized_by: string | null;
  authorized_at: string | null;
}

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

  // Database-driven series state
  const [seriesList, setSeriesList] = useState<InvoiceSeriesRow[]>([]);
  const [loadingSeries, setLoadingSeries] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  // New series modal/form state
  const [showNewSeries, setShowNewSeries] = useState(false);
  const [newSeriesPrefix, setNewSeriesPrefix] = useState("");
  const [newSeriesGstin, setNewSeriesGstin] = useState("");
  const [newSeriesFy, setNewSeriesFy] = useState(new Date().getFullYear());
  const [proposing, setProposing] = useState(false);

  const fetchSeries = async () => {
    setLoadingSeries(true);
    try {
      const res = await fetch("/api/v1/admin/compliance/invoice-series");
      if (res.ok) {
        const json = await res.json();
        setSeriesList(json.series || []);
      }
    } catch (e) {
      console.error("Failed to load invoice series:", e);
    } finally {
      setLoadingSeries(false);
    }
  };

  useEffect(() => {
    fetchSeries();
  }, []);

  const handleApproveSeries = async (row: InvoiceSeriesRow) => {
    setApprovingId(row.id);
    try {
      const res = await fetch("/api/v1/admin/compliance/invoice-series/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id, prefix: row.prefix, gstin: row.gstin, fiscal_year: row.fiscal_year }),
      });
      if (res.ok) {
        setSuccessMsg(`Invoice series '${row.prefix}' in FY ${row.fiscal_year} approved!`);
        await fetchSeries();
      } else {
        const err = await res.json();
        alert(err.message || "Failed to approve series");
      }
    } catch (e: any) {
      alert("Error approving series: " + e.message);
    } finally {
      setApprovingId(null);
    }
  };

  const handleProposeSeries = async (e: React.FormEvent) => {
    e.preventDefault();
    setProposing(true);
    try {
      const res = await fetch("/api/v1/admin/compliance/invoice-series/propose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prefix: newSeriesPrefix.toUpperCase(),
          gstin: newSeriesGstin.toUpperCase(),
          fiscal_year: newSeriesFy,
          document_type: "TAX_INVOICE",
        }),
      });
      if (res.ok) {
        setSuccessMsg(`Proposed new invoice series '${newSeriesPrefix.toUpperCase()}'!`);
        setShowNewSeries(false);
        setNewSeriesPrefix("");
        setNewSeriesGstin("");
        await fetchSeries();
      } else {
        const err = await res.json();
        alert(err.message || err.error || "Failed to propose series");
      }
    } catch (e: any) {
      alert("Error proposing series: " + e.message);
    } finally {
      setProposing(false);
    }
  };

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
    <div className="flex flex-col gap-6">
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
            Database-driven statutory sequence registry, legal entity bindings, and CGST Rule 46 compliance governance.
          </Text>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setShowNewSeries(!showNewSeries)}
            className="flex items-center gap-1.5 text-xs"
          >
            <Plus className="w-3.5 h-3.5" /> Propose Series
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            isLoading={saving}
            className="bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-1.5 shrink-0 text-xs"
          >
            <Save className="w-4 h-4" /> Save Settings
          </Button>
        </div>
      </div>

      {/* Propose New Series Form */}
      {showNewSeries && (
        <Container className="p-5 border border-amber-300 bg-amber-50/50 dark:bg-amber-950/20 rounded-2xl flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4 text-amber-600" />
            <Text className="text-xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-200">
              Propose Statutory Invoice Series (CGST Rule 46)
            </Text>
          </div>
          <form onSubmit={handleProposeSeries} className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
            <div>
              <Label className="text-xs font-semibold">Series Prefix (1-16 chars)</Label>
              <Input
                placeholder="e.g. CTHI, SAFE-TEST"
                value={newSeriesPrefix}
                onChange={(e) => setNewSeriesPrefix(e.target.value)}
                required
                className="mt-1 font-mono uppercase"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Seller GSTIN (15 chars)</Label>
              <Input
                placeholder="29AABCC1234F1Z5"
                value={newSeriesGstin}
                onChange={(e) => setNewSeriesGstin(e.target.value)}
                required
                className="mt-1 font-mono uppercase"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Financial Year</Label>
              <Input
                type="number"
                value={String(newSeriesFy)}
                onChange={(e) => setNewSeriesFy(parseInt(e.target.value, 10))}
                required
                className="mt-1 font-mono"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" isLoading={proposing} className="bg-amber-600 hover:bg-amber-700 text-white text-xs">
                Submit Proposal
              </Button>
              <Button type="button" variant="secondary" onClick={() => setShowNewSeries(false)} className="text-xs">
                Cancel
              </Button>
            </div>
          </form>
        </Container>
      )}

      {/* Authorized Statutory Invoice Series Table */}
      <Container className="p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4 text-emerald-600" />
            <Text className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
              Authorized Statutory Invoice Series Registry (PostgreSQL Single Source of Truth)
            </Text>
          </div>
          <Button variant="transparent" size="small" onClick={fetchSeries} className="text-xs text-slate-500">
            Refresh
          </Button>
        </div>

        {loadingSeries ? (
          <div className="py-6 text-center text-xs text-slate-400">Loading authorized statutory series...</div>
        ) : seriesList.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400">No invoice series registered in PostgreSQL.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold">
                  <th className="py-2.5 px-3">Prefix</th>
                  <th className="py-2.5 px-3">Seller GSTIN</th>
                  <th className="py-2.5 px-3">FY</th>
                  <th className="py-2.5 px-3">Last Seq</th>
                  <th className="py-2.5 px-3">Document Type</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Authorized By</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {seriesList.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900 dark:text-white">{row.prefix}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-300">{row.gstin}</td>
                    <td className="py-2.5 px-3 font-mono">{row.fiscal_year}</td>
                    <td className="py-2.5 px-3 font-mono">{row.last_seq}</td>
                    <td className="py-2.5 px-3 text-slate-500">{row.document_type || "TAX_INVOICE"}</td>
                    <td className="py-2.5 px-3">
                      {row.approval_status === "APPROVED" ? (
                        <Badge color="green" className="text-[10px] font-bold">APPROVED</Badge>
                      ) : row.approval_status === "PROPOSED" ? (
                        <Badge color="orange" className="text-[10px] font-bold">PROPOSED</Badge>
                      ) : row.approval_status === "DEPRECATED_HISTORICAL" ? (
                        <Badge color="grey" className="text-[10px] font-bold">DEPRECATED HISTORICAL</Badge>
                      ) : (
                        <Badge color="red" className="text-[10px] font-bold">{row.approval_status}</Badge>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500">{row.authorized_by || "—"}</td>
                    <td className="py-2.5 px-3 text-right">
                      {row.approval_status === "PROPOSED" && (
                        <Button
                          size="small"
                          isLoading={approvingId === row.id}
                          onClick={() => handleApproveSeries(row)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] py-1 px-2.5"
                        >
                          <Check className="w-3 h-3 mr-1" /> Approve
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Container>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Invoice Numbering & Sequence */}
        <Container className="p-5 flex flex-col gap-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <Sliders className="w-4 h-4 text-amber-600" />
            <Text className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              Format Templates & Notes
            </Text>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <Label htmlFor="sig_title" className="text-xs font-semibold">Authorized Signatory Caption</Label>
              <Input
                id="sig_title"
                value={formData.authorized_signatory_title}
                onChange={(e) => setFormData({ ...formData, authorized_signatory_title: e.target.value })}
                required
                className="mt-1"
              />
            </div>
          </div>
        </Container>

        {/* Print Toggles */}
        <Container className="p-5 flex flex-col gap-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <Scale className="w-4 h-4 text-amber-600" />
            <Text className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              Statutory Field Print Toggles
            </Text>
          </div>

          <div className="flex flex-col gap-2.5">
            <label className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 cursor-pointer">
              <div>
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">Display Seller Registered Legal Name</span>
                <p className="text-[11px] text-slate-400">Prints incorporated entity name on invoice header</p>
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
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">Display Seller GSTIN</span>
                <p className="text-[11px] text-slate-400">Mandatory under GST Rule 46</p>
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
    </div>
  );
}
