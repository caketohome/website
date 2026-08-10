"use client";

import { useState, memo } from "react";
import { Container, Heading, Text, Button, Input, Badge, Label } from "@medusajs/ui";
import { Plus, Percent, CheckCircle, AlertCircle, Edit3, Copy, Power, HelpCircle, RefreshCw, FileText, Search, ShieldCheck } from "lucide-react";
import { TaxMasterService, TaxConfigurationRecord } from "@backend/src/services/tax-engine";
import { WidgetErrorBoundary } from "./error-boundary";

export const TaxMasterPanel = memo(function TaxMasterPanel() {
  const [records, setRecords] = useState<TaxConfigurationRecord[]>(TaxMasterService.listTaxConfigurations());
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTaxability, setFilterTaxability] = useState<string>("ALL");
  const [filterActive, setFilterActive] = useState<string>("ALL");

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<TaxConfigurationRecord | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [taxability, setTaxability] = useState<"Taxable" | "Exempt" | "Nil Rated" | "Non-GST">("Taxable");
  const [gstRatePct, setGstRatePct] = useState<number>(5);
  const [cgstRatePct, setCgstRatePct] = useState<number>(2.5);
  const [sgstRatePct, setSgstRatePct] = useState<number>(2.5);
  const [igstRatePct, setIgstRatePct] = useState<number>(5);
  const [cessRatePct, setCessRatePct] = useState<number>(0);
  const [taxInclusive, setTaxInclusive] = useState<boolean>(true);
  const [applicableSupplyType, setApplicableSupplyType] = useState<"BOTH" | "INTRA-STATE" | "INTER-STATE">("BOTH");
  const [applicableCustomerType, setApplicableCustomerType] = useState<"BOTH" | "B2B" | "B2C">("BOTH");
  const [isActive, setIsActive] = useState<boolean>(true);
  const [effectiveFrom, setEffectiveFrom] = useState<string>(new Date().toISOString().split("T")[0]);
  const [effectiveTo, setEffectiveTo] = useState<string>("");

  const [validationError, setValidationError] = useState<string | null>(null);

  const refreshData = () => {
    setRecords(TaxMasterService.listTaxConfigurations());
  };

  const handleOpenCreate = () => {
    setEditingRecord(null);
    setName("");
    setCode("GST_FOOD_NEW");
    setDescription("");
    setTaxability("Taxable");
    setGstRatePct(5);
    setCgstRatePct(2.5);
    setSgstRatePct(2.5);
    setIgstRatePct(5);
    setCessRatePct(0);
    setTaxInclusive(true);
    setApplicableSupplyType("BOTH");
    setApplicableCustomerType("BOTH");
    setIsActive(true);
    setEffectiveFrom(new Date().toISOString().split("T")[0]);
    setEffectiveTo("");
    setValidationError(null);
    setShowModal(true);
  };

  const handleOpenEdit = (rec: TaxConfigurationRecord) => {
    setEditingRecord(rec);
    setName(rec.name);
    setCode(rec.code);
    setDescription(rec.description || "");
    setTaxability(rec.taxability);
    setGstRatePct(rec.gstRatePct);
    setCgstRatePct(rec.cgstRatePct);
    setSgstRatePct(rec.sgstRatePct);
    setIgstRatePct(rec.igstRatePct);
    setCessRatePct(rec.cessRatePct);
    setTaxInclusive(rec.taxInclusive);
    setApplicableSupplyType(rec.applicableSupplyType);
    setApplicableCustomerType(rec.applicableCustomerType);
    setIsActive(rec.isActive);
    setEffectiveFrom(rec.effectiveFrom);
    setEffectiveTo(rec.effectiveTo || "");
    setValidationError(null);
    setShowModal(true);
  };

  const handleDuplicate = (id: string) => {
    try {
      const dup = TaxMasterService.duplicateTaxConfiguration(id);
      refreshData();
      alert(`Tax configuration duplicated successfully: "${dup.name}" (${dup.code})`);
    } catch (err: any) {
      alert(err.message || "Failed to duplicate tax configuration.");
    }
  };

  const handleToggleActive = (id: string, currentActive: boolean) => {
    try {
      TaxMasterService.toggleActive(id, !currentActive);
      refreshData();
    } catch (err: any) {
      alert(err.message || "Failed to update tax configuration status.");
    }
  };

  const handleGstRateChange = (newRate: number) => {
    setGstRatePct(newRate);
    if (taxability === "Taxable") {
      setCgstRatePct(newRate / 2);
      setSgstRatePct(newRate / 2);
      setIgstRatePct(newRate);
    } else {
      setCgstRatePct(0);
      setSgstRatePct(0);
      setIgstRatePct(0);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) {
      setValidationError("Tax Name and Tax Code are required.");
      return;
    }

    if (taxability === "Taxable") {
      if (applicableSupplyType === "BOTH" || applicableSupplyType === "INTRA-STATE") {
        if (Math.abs(cgstRatePct + sgstRatePct - gstRatePct) > 0.01) {
          setValidationError(`Intra-State Tax Mismatch: CGST (${cgstRatePct}%) + SGST (${sgstRatePct}%) must equal Total GST (${gstRatePct}%).`);
          return;
        }
      }
      if (applicableSupplyType === "BOTH" || applicableSupplyType === "INTER-STATE") {
        if (Math.abs(igstRatePct - gstRatePct) > 0.01) {
          setValidationError(`Inter-State Tax Mismatch: IGST (${igstRatePct}%) must equal Total GST (${gstRatePct}%).`);
          return;
        }
      }
    }

    try {
      TaxMasterService.saveTaxConfiguration({
        id: editingRecord?.id,
        name,
        code,
        description,
        taxability,
        gstRatePct: taxability === "Taxable" ? gstRatePct : 0,
        cgstRatePct: taxability === "Taxable" ? cgstRatePct : 0,
        sgstRatePct: taxability === "Taxable" ? sgstRatePct : 0,
        igstRatePct: taxability === "Taxable" ? igstRatePct : 0,
        cessRatePct: taxability === "Taxable" ? cessRatePct : 0,
        taxInclusive,
        applicableSupplyType,
        applicableCustomerType,
        isActive,
        effectiveFrom,
        effectiveTo: effectiveTo || undefined,
      });

      refreshData();
      setShowModal(false);
    } catch (err: any) {
      setValidationError(err.message || "Failed to save tax configuration.");
    }
  };

  const filteredRecords = records.filter((r) => {
    const matchesSearch =
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.description || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTaxability = filterTaxability === "ALL" || r.taxability === filterTaxability;
    const matchesActive = filterActive === "ALL" || (filterActive === "ACTIVE" ? r.isActive : !r.isActive);
    return matchesSearch && matchesTaxability && matchesActive;
  });

  return (
    <WidgetErrorBoundary widgetName="Tax Master Central Configuration Panel">
      <div className="space-y-6 font-sans">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
          <div>
            <Heading level="h2" className="text-xl font-bold flex items-center gap-2 text-slate-900 dark:text-white">
              <Percent className="w-6 h-6 text-emerald-600" /> Statutory Tax Master & Reusable Tax Configurations
            </Heading>
            <Text className="text-xs text-ui-fg-subtle mt-1">
              Centralized reusable tax rules for PIM Products, Categories, Checkout, Order Snapshots, Invoices, and Statutory GST Reporting.
            </Text>
          </div>

          <div className="flex items-center gap-2">
            <Button size="small" onClick={handleOpenCreate} className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
              <Plus className="w-4 h-4" /> Create Tax Configuration
            </Button>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50 dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tax rules by name or code..."
              className="pl-9 text-xs"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={filterTaxability}
              onChange={(e) => setFilterTaxability(e.target.value)}
              className="p-2 text-xs font-semibold rounded-lg border bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
            >
              <option value="ALL">All Taxability</option>
              <option value="Taxable">Taxable</option>
              <option value="Exempt">Exempt</option>
              <option value="Nil Rated">Nil Rated</option>
              <option value="Non-GST">Non-GST</option>
            </select>

            <select
              value={filterActive}
              onChange={(e) => setFilterActive(e.target.value)}
              className="p-2 text-xs font-semibold rounded-lg border bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
            >
              <option value="ALL">All Status</option>
              <option value="ACTIVE">Active Only</option>
              <option value="INACTIVE">Inactive Only</option>
            </select>
          </div>
        </div>

        {/* Tax Master Table */}
        <Container className="p-6">
          <div className="flex items-center justify-between mb-4">
            <Text className="font-semibold text-base">Active Tax Master Configurations ({filteredRecords.length})</Text>
          </div>

          {filteredRecords.length === 0 ? (
            <div className="text-center py-8 text-ui-fg-subtle">
              <Percent className="w-8 h-8 mx-auto mb-2 opacity-50 text-emerald-600" />
              <Text>No tax configurations match the specified criteria.</Text>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider text-[11px]">
                    <th className="p-3">Tax Name & Code</th>
                    <th className="p-3">GST Rate</th>
                    <th className="p-3">CGST / SGST</th>
                    <th className="p-3">IGST</th>
                    <th className="p-3">CESS</th>
                    <th className="p-3">Taxability</th>
                    <th className="p-3">Effective From</th>
                    <th className="p-3">PIM Usage</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
                  {filteredRecords.map((r) => {
                    const statusColor = r.isActive ? "green" : "red";
                    return (
                      <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition">
                        <td className="p-3">
                          <div className="font-bold text-slate-900 dark:text-white text-sm">{r.name}</div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <Badge color="purple" className="text-[10px] font-mono font-bold">{r.code}</Badge>
                            {r.description && <span className="text-[11px] text-slate-500 truncate max-w-[200px]">{r.description}</span>}
                          </div>
                        </td>
                        <td className="p-3 font-bold text-emerald-600 font-mono text-sm">
                          {r.taxability === "Taxable" ? `${r.gstRatePct}%` : "0%"}
                        </td>
                        <td className="p-3 font-mono text-slate-700 dark:text-slate-300">
                          {r.taxability === "Taxable" ? `${r.cgstRatePct}% / ${r.sgstRatePct}%` : "0% / 0%"}
                        </td>
                        <td className="p-3 font-mono text-slate-700 dark:text-slate-300">
                          {r.taxability === "Taxable" ? `${r.igstRatePct}%` : "0%"}
                        </td>
                        <td className="p-3 font-mono text-slate-700 dark:text-slate-300">
                          {r.cessRatePct}%
                        </td>
                        <td className="p-3">
                          <Badge color={r.taxability === "Taxable" ? "blue" : "grey"} className="text-[10px] font-semibold">
                            {r.taxability}
                          </Badge>
                        </td>
                        <td className="p-3 font-mono text-slate-600 dark:text-slate-400">
                          {r.effectiveFrom}
                        </td>
                        <td className="p-3 font-mono font-bold text-slate-800 dark:text-slate-200">
                          {r.usageCount || 0} Products
                        </td>
                        <td className="p-3">
                          <Badge color={statusColor} className="text-[10px] font-bold">
                            {r.isActive ? "ACTIVE" : "INACTIVE"}
                          </Badge>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button size="small" variant="secondary" onClick={() => handleOpenEdit(r)} className="text-[11px] font-bold">
                              <Edit3 className="w-3.5 h-3.5 mr-1" /> Edit
                            </Button>
                            <Button size="small" variant="transparent" onClick={() => handleDuplicate(r.id)} className="text-[11px] font-bold text-purple-600">
                              <Copy className="w-3.5 h-3.5 mr-1" /> Duplicate
                            </Button>
                            <Button
                              size="small"
                              variant="transparent"
                              onClick={() => handleToggleActive(r.id, r.isActive)}
                              className={`text-[11px] font-bold ${r.isActive ? "text-rose-600" : "text-emerald-600"}`}
                            >
                              <Power className="w-3.5 h-3.5 mr-1" /> {r.isActive ? "Deactivate" : "Activate"}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Container>

        {/* Create / Edit Tax Configuration Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col my-8">
              <div className="p-4 border-b flex items-center justify-between bg-emerald-50 dark:bg-emerald-950/40">
                <Heading level="h3" className="text-base font-bold flex items-center gap-2">
                  <Percent className="w-5 h-5 text-emerald-600" />
                  {editingRecord ? `Edit Tax Configuration: ${editingRecord.name}` : "Create Reusable Tax Master Configuration"}
                </Heading>
                <Button size="small" variant="transparent" onClick={() => setShowModal(false)}>Close</Button>
              </div>

              <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs overflow-y-auto max-h-[75vh]">
                {validationError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>{validationError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label>Tax Configuration Name *</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. GST Food 5%" required />
                  </div>
                  <div>
                    <Label>Tax Configuration Code *</Label>
                    <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s+/g, "_"))} placeholder="e.g. GST_FOOD_5" required />
                  </div>

                  <div className="sm:col-span-2">
                    <Label>Description</Label>
                    <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Standard GST rate applicable for bakery items..." />
                  </div>

                  <div>
                    <Label>Taxability *</Label>
                    <select
                      value={taxability}
                      onChange={(e) => {
                        const val = e.target.value as any;
                        setTaxability(val);
                        if (val !== "Taxable") {
                          setGstRatePct(0);
                          setCgstRatePct(0);
                          setSgstRatePct(0);
                          setIgstRatePct(0);
                        }
                      }}
                      className="w-full p-2.5 text-xs font-semibold rounded-lg border bg-white dark:bg-slate-900"
                    >
                      <option value="Taxable">Taxable</option>
                      <option value="Exempt">Exempt</option>
                      <option value="Nil Rated">Nil Rated</option>
                      <option value="Non-GST">Non-GST</option>
                    </select>
                  </div>

                  <div>
                    <Label>Total GST Rate (%) *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={gstRatePct}
                      disabled={taxability !== "Taxable"}
                      onChange={(e) => handleGstRateChange(parseFloat(e.target.value) || 0)}
                      placeholder="5"
                      required
                    />
                  </div>

                  {taxability === "Taxable" && (
                    <>
                      <div>
                        <Label>CGST Rate (%)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={cgstRatePct}
                          onChange={(e) => setCgstRatePct(parseFloat(e.target.value) || 0)}
                          placeholder="2.5"
                        />
                      </div>

                      <div>
                        <Label>SGST Rate (%)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={sgstRatePct}
                          onChange={(e) => setSgstRatePct(parseFloat(e.target.value) || 0)}
                          placeholder="2.5"
                        />
                      </div>

                      <div>
                        <Label>IGST Rate (%)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={igstRatePct}
                          onChange={(e) => setIgstRatePct(parseFloat(e.target.value) || 0)}
                          placeholder="5"
                        />
                      </div>

                      <div>
                        <Label>CESS Rate (%)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={cessRatePct}
                          onChange={(e) => setCessRatePct(parseFloat(e.target.value) || 0)}
                          placeholder="0"
                        />
                      </div>
                    </>
                  )}

                  <div>
                    <Label>Applicable Supply Type</Label>
                    <select
                      value={applicableSupplyType}
                      onChange={(e) => setApplicableSupplyType(e.target.value as any)}
                      className="w-full p-2.5 text-xs font-semibold rounded-lg border bg-white dark:bg-slate-900"
                    >
                      <option value="BOTH">Both (Intra & Inter State)</option>
                      <option value="INTRA-STATE">Intra-State Only</option>
                      <option value="INTER-STATE">Inter-State Only</option>
                    </select>
                  </div>

                  <div>
                    <Label>Applicable Customer Type</Label>
                    <select
                      value={applicableCustomerType}
                      onChange={(e) => setApplicableCustomerType(e.target.value as any)}
                      className="w-full p-2.5 text-xs font-semibold rounded-lg border bg-white dark:bg-slate-900"
                    >
                      <option value="BOTH">Both (B2B & B2C)</option>
                      <option value="B2B">B2B Registered Only</option>
                      <option value="B2C">B2C Retail Only</option>
                    </select>
                  </div>

                  <div>
                    <Label>Effective From *</Label>
                    <Input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} required />
                  </div>

                  <div>
                    <Label>Effective To (Optional)</Label>
                    <Input type="date" value={effectiveTo} onChange={(e) => setEffectiveTo(e.target.value)} />
                  </div>
                </div>

                <div className="pt-4 border-t flex justify-end gap-2">
                  <Button type="button" variant="transparent" onClick={() => setShowModal(false)}>Cancel</Button>
                  <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
                    Save Tax Master Configuration
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </WidgetErrorBoundary>
  );
});
