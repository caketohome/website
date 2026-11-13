"use client";

import { useState } from "react";
import { Container, Heading, Text, Button, Input, Label, Badge } from "@medusajs/ui";
import { Receipt, Plus, ShieldCheck, CheckCircle2, AlertCircle, RefreshCw, Edit2, Store, ExternalLink, X } from "lucide-react";
import { apiClient } from "@frontend/lib/api-client";

export function GstRegistrationsTab({
  registrations,
  branches,
  onReload,
}: {
  registrations: any[];
  branches: any[];
  onReload: () => void;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingReg, setEditingReg] = useState<any | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [verifyResult, setVerifyResult] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form State
  const [formGstin, setFormGstin] = useState("");
  const [formLegalName, setFormLegalName] = useState("");
  const [formTradeName, setFormTradeName] = useState("");
  const [formState, setFormState] = useState("Kerala");
  const [formStateCode, setFormStateCode] = useState("32");
  const [formType, setFormType] = useState<"REGULAR" | "COMPOSITION" | "OTHER">("REGULAR");
  const [formAddressLine, setFormAddressLine] = useState("");
  const [formCity, setFormCity] = useState("");
  const [formPincode, setFormPincode] = useState("");
  const [formStatus, setFormStatus] = useState<"active" | "inactive">("active");

  const openCreateModal = () => {
    setEditingReg(null);
    setFormGstin("");
    setFormLegalName("Baked Cakes & Pastries (CakeToHome)");
    setFormTradeName("CakeToHome");
    setFormState("Kerala");
    setFormStateCode("32");
    setFormType("REGULAR");
    setFormAddressLine("Branch Premises Address");
    setFormCity("");
    setFormPincode("");
    setFormStatus("active");
    setErrorMsg(null);
    setModalOpen(true);
  };

  const openEditModal = (reg: any) => {
    setEditingReg(reg);
    setFormGstin(reg.gstin || "");
    setFormLegalName(reg.legal_name || "Baked Cakes & Pastries (CakeToHome)");
    setFormTradeName(reg.trade_name || "CakeToHome");
    setFormState(reg.state || "");
    setFormStateCode(reg.state_code || "");
    setFormType(reg.registration_type || "REGULAR");
    setFormAddressLine(reg.address?.line1 || "");
    setFormCity(reg.address?.city || "");
    setFormPincode(reg.address?.pincode || "");
    setFormStatus(reg.status || "active");
    setErrorMsg(null);
    setModalOpen(true);
  };

  const handleGstinChange = (val: string) => {
    const clean = val.toUpperCase().trim();
    setFormGstin(clean);
    if (clean.length >= 2) {
      const code = clean.slice(0, 2);
      setFormStateCode(code);
      const codeMap: Record<string, string> = {
        "29": "Karnataka",
        "32": "Kerala",
        "33": "Tamil Nadu",
        "27": "Maharashtra",
        "07": "Delhi",
        "36": "Telangana",
        "19": "West Bengal",
        "24": "Gujarat",
      };
      if (codeMap[code]) {
        setFormState(codeMap[code]);
        if (!formTradeName || formTradeName.startsWith("CakeToHome")) {
          setFormTradeName(`CakeToHome ${codeMap[code]}`);
        }
      }
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);

    const payload = {
      gstin: formGstin,
      legal_name: formLegalName,
      trade_name: formTradeName,
      state: formState,
      state_code: formStateCode,
      registration_type: formType,
      status: formStatus,
      address: {
        line1: formAddressLine,
        city: formCity,
        state: formState,
        state_code: formStateCode,
        pincode: formPincode,
      },
    };

    try {
      if (editingReg) {
        await apiClient.updateGstRegistration(editingReg.id, payload);
        setSuccessMsg(`GST Registration "${formGstin}" updated successfully!`);
      } else {
        await apiClient.createGstRegistration(payload);
        setSuccessMsg(`GST Registration "${formGstin}" added successfully!`);
      }
      setModalOpen(false);
      onReload();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save GST registration");
    } finally {
      setSaving(false);
    }
  };

  const handleVerifyGstin = async (id: string) => {
    setVerifyingId(id);
    setVerifyResult(null);
    try {
      const res: any = await apiClient.verifyGstRegistration(id);
      const reg = res?.registration || res?.data || res;
      setVerifyResult(reg);
      onReload();
    } catch (err: any) {
      alert("Verification failed: " + (err.message || "Provider error"));
    } finally {
      setVerifyingId(null);
    }
  };

  const getAssignedBranches = (gstId: string) => {
    return branches.filter((b) => b.gst_registration_id === gstId || b.gstin_id === gstId || b.state_code === registrations.find((r) => r.id === gstId)?.state_code);
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
            <Receipt className="w-5 h-5 text-amber-600" />
            <Heading level="h3" className="text-base font-bold">Multi-State GST Registrations</Heading>
          </div>
          <Text className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Manage state-level GSTINs. Branches link to a GST registration based on their state to ensure compliant Place of Supply (POS) and CGST/SGST/IGST invoicing.
          </Text>
        </div>
        <Button onClick={openCreateModal} className="bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-1.5 shrink-0">
          <Plus className="w-4 h-4" /> Add GST Registration
        </Button>
      </div>

      {/* Verification Inspector Banner if verified */}
      {verifyResult && (
        <div className="p-4 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 rounded-xl flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <ShieldCheck className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                GSTIN Verification Completed: <span className="font-mono">{verifyResult.gstin}</span>
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">
                Provider: <span className="font-semibold">{verifyResult.verification_response?.provider || "GSTN Portal"}</span> &bull; Ref: <span className="font-mono">{verifyResult.verification_response?.reference_id || "N/A"}</span> &bull; Status: <span className="font-semibold uppercase">{verifyResult.verification_status}</span>
              </p>
              {verifyResult.verification_response?.message && (
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 italic">
                  "{verifyResult.verification_response.message}"
                </p>
              )}
            </div>
          </div>
          <button onClick={() => setVerifyResult(null)} className="text-blue-400 hover:text-blue-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* GST Registrations Table */}
      <Container className="p-0 overflow-hidden border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">State & Code</th>
                <th className="px-5 py-3.5">GSTIN</th>
                <th className="px-5 py-3.5">Trade Name</th>
                <th className="px-5 py-3.5">Assigned Branches</th>
                <th className="px-5 py-3.5">Verification</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {registrations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                    No GST registrations configured. Click "Add GST Registration" to get started.
                  </td>
                </tr>
              ) : (
                registrations.map((reg) => {
                  const assigned = getAssignedBranches(reg.id);
                  const isVerified = reg.verification_status === "VERIFIED";

                  return (
                    <tr key={reg.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="px-5 py-4">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {reg.state}
                        </div>
                        <div className="text-xs font-mono text-slate-500">
                          State Code: <span className="font-bold">{reg.state_code}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-mono font-bold text-amber-700 dark:text-amber-400 text-sm">
                          {reg.gstin}
                        </div>
                        <div className="text-xs text-slate-400">
                          {reg.registration_type || "REGULAR"}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-medium text-slate-800 dark:text-slate-200">
                          {reg.trade_name}
                        </div>
                        <div className="text-xs text-slate-400 truncate max-w-xs">
                          {reg.address?.city || reg.address?.line1 || "Registered address"}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                          <Store className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-semibold">{assigned.length} Hub{assigned.length !== 1 ? "s" : ""}</span>
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5 truncate max-w-[140px]">
                          {assigned.map((b) => b.name?.split(" ")[0]).join(", ") || "None mapped"}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        {isVerified ? (
                          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Verified
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            <AlertCircle className="w-3 h-3 text-amber-600" /> {reg.verification_status || "UNVERIFIED"}
                          </div>
                        )}
                        {reg.last_verified_at && (
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {new Date(reg.last_verified_at).toLocaleDateString()}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <Badge color={reg.status === "active" ? "green" : "grey"} size="small">
                          {reg.status}
                        </Badge>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="secondary"
                            size="small"
                            onClick={() => handleVerifyGstin(reg.id)}
                            isLoading={verifyingId === reg.id}
                            className="text-xs"
                          >
                            <RefreshCw className="w-3.5 h-3.5 mr-1" /> Verify
                          </Button>
                          <Button
                            variant="secondary"
                            size="small"
                            onClick={() => openEditModal(reg)}
                            className="text-xs"
                          >
                            <Edit2 className="w-3.5 h-3.5 mr-1" /> Edit
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Container>

      {/* Add / Edit GST Registration Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 flex flex-col gap-4 animate-in fade-in-50 zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-amber-600" />
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  {editingReg ? "Edit GST Registration" : "Add State GST Registration"}
                </h3>
              </div>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 text-rose-800 dark:text-rose-200 text-xs rounded-lg">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSave} className="flex flex-col gap-3.5">
              <div>
                <Label htmlFor="modal_gstin" className="text-xs font-semibold">
                  15-Digit GSTIN <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="modal_gstin"
                  value={formGstin}
                  onChange={(e) => handleGstinChange(e.target.value)}
                  placeholder="e.g. 29AAAAA0000A1Z5"
                  maxLength={15}
                  required
                  className="mt-1 font-mono uppercase tracking-wide"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  First 2 digits represent State Code. Characters 3-12 are Company PAN.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="modal_state" className="text-xs font-semibold">State Name</Label>
                  <Input
                    id="modal_state"
                    value={formState}
                    onChange={(e) => setFormState(e.target.value)}
                    required
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="modal_code" className="text-xs font-semibold">State Code (2 Digits)</Label>
                  <Input
                    id="modal_code"
                    value={formStateCode}
                    onChange={(e) => setFormStateCode(e.target.value)}
                    maxLength={2}
                    required
                    className="mt-1 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="modal_legal" className="text-xs font-semibold">Legal Name</Label>
                  <Input
                    id="modal_legal"
                    value={formLegalName}
                    onChange={(e) => setFormLegalName(e.target.value)}
                    required
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="modal_trade" className="text-xs font-semibold">Trade / State Name</Label>
                  <Input
                    id="modal_trade"
                    value={formTradeName}
                    onChange={(e) => setFormTradeName(e.target.value)}
                    required
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="modal_type" className="text-xs font-semibold">Registration Type</Label>
                  <select
                    id="modal_type"
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as any)}
                    className="w-full mt-1 px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg"
                  >
                    <option value="REGULAR">Regular Taxpayer</option>
                    <option value="COMPOSITION">Composition Scheme</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="modal_status" className="text-xs font-semibold">Status</Label>
                  <select
                    id="modal_status"
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    className="w-full mt-1 px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div>
                <Label htmlFor="modal_addr" className="text-xs font-semibold">Principal Place of Business Address</Label>
                <Input
                  id="modal_addr"
                  value={formAddressLine}
                  onChange={(e) => setFormAddressLine(e.target.value)}
                  placeholder="Street / Hub Location"
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="modal_city" className="text-xs font-semibold">City</Label>
                  <Input
                    id="modal_city"
                    value={formCity}
                    onChange={(e) => setFormCity(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="modal_pin" className="text-xs font-semibold">Pincode</Label>
                  <Input
                    id="modal_pin"
                    value={formPincode}
                    onChange={(e) => setFormPincode(e.target.value)}
                    maxLength={6}
                    className="mt-1 font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
                <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" isLoading={saving} className="bg-amber-600 hover:bg-amber-700 text-white">
                  {editingReg ? "Save Changes" : "Register GSTIN"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
