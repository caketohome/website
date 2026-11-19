"use client";

import { useState, useEffect } from "react";
import { useCompanyInfo } from "@frontend/lib/hooks/use-company-info";
import { Container, Heading, Text, Button, Input, Label, Badge } from "@medusajs/ui";
import { ShieldAlert, Plus, CheckCircle2, AlertTriangle, AlertOctagon, RefreshCw, Edit2, Calendar, FileCheck, X, FileText, Trash2 } from "lucide-react";
import { apiClient } from "@frontend/lib/api-client";

export function FssaiComplianceTab({
  complianceList,
  overview,
  branches,
  onReload,
}: {
  complianceList: any[];
  overview: any;
  branches: any[];
  onReload: () => void;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingComp, setEditingComp] = useState<any | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [verifyResult, setVerifyResult] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form State
  const [formBranchId, setFormBranchId] = useState(branches[0]?.id || "");
  const [formFssaiNumber, setFormFssaiNumber] = useState("");
  const [formLicenseType, setFormLicenseType] = useState<"STATE_LICENSE" | "CENTRAL_LICENSE" | "REGISTRATION">("STATE_LICENSE");
  const [formFboName, setFormFboName] = useState("");
  const company = useCompanyInfo();
  useEffect(() => { if (company?.legal_name) setFormFboName((v) => v || company.legal_name); }, [company]);
  const [formPremiseName, setFormPremiseName] = useState("");
  const [formPremiseAddress, setFormPremiseAddress] = useState("");
  const [formIssueDate, setFormIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [formExpiryDate, setFormExpiryDate] = useState(new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().slice(0, 10));
  const [formResponsiblePerson, setFormResponsiblePerson] = useState("");
  const [formContactNumber, setFormContactNumber] = useState("");
  const [formCertNumber, setFormCertNumber] = useState("");

  const openCreateModal = () => {
    setEditingComp(null);
    const firstBranch = branches[0] || {};
    setFormBranchId(firstBranch.id || "");
    setFormFssaiNumber("");
    setFormLicenseType("STATE_LICENSE");
    setFormFboName(company?.legal_name || "");
    setFormPremiseName(firstBranch.name || "Bakery Kitchen");
    setFormPremiseAddress(firstBranch.address || "");
    setFormIssueDate(new Date().toISOString().slice(0, 10));
    setFormExpiryDate(new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().slice(0, 10));
    setFormResponsiblePerson(firstBranch.manager_name || "Branch Manager");
    setFormContactNumber(firstBranch.phone || "+91 98765 00000");
    setFormCertNumber("");
    setErrorMsg(null);
    setModalOpen(true);
  };

  const openEditModal = (comp: any) => {
    setEditingComp(comp);
    setFormBranchId(comp.branch_id);
    setFormFssaiNumber(comp.fssai_number || "");
    setFormLicenseType(comp.fssai_license_type || "STATE_LICENSE");
    setFormFboName(comp.fbo_name || company?.legal_name || "");
    setFormPremiseName(comp.premise_name || comp.branch_name || "");
    setFormPremiseAddress(comp.premise_address || "");
    setFormIssueDate(comp.issue_date || new Date().toISOString().slice(0, 10));
    setFormExpiryDate(comp.expiry_date || new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().slice(0, 10));
    setFormResponsiblePerson(comp.responsible_person || "");
    setFormContactNumber(comp.contact_number || "");
    setFormCertNumber(comp.certificate_number || "");
    setErrorMsg(null);
    setModalOpen(true);
  };

  const handleBranchSelect = (bId: string) => {
    setFormBranchId(bId);
    const selected = branches.find((b) => b.id === bId);
    if (selected) {
      setFormPremiseName(selected.name);
      setFormPremiseAddress(selected.address || "");
      if (selected.manager_name) setFormResponsiblePerson(selected.manager_name);
      if (selected.phone) setFormContactNumber(selected.phone);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);

    const cleanLic = formFssaiNumber.replace(/\D/g, "");
    if (cleanLic.length !== 14) {
      setErrorMsg(`FSSAI License number must be exactly 14 numeric digits (received ${cleanLic.length}).`);
      setSaving(false);
      return;
    }

    const branch = branches.find((b) => b.id === formBranchId);
    const payload = {
      branch_id: formBranchId,
      branch_name: branch?.name || formPremiseName,
      branch_code: branch?.code || "HUB",
      city_id: branch?.city_id,
      city_name: branch?.city || "",
      state: branch?.state || "",
      state_code: branch?.state_code || "",
      fssai_number: cleanLic,
      fssai_license_type: formLicenseType,
      fbo_name: formFboName,
      premise_name: formPremiseName,
      premise_address: formPremiseAddress,
      issue_date: formIssueDate,
      expiry_date: formExpiryDate,
      responsible_person: formResponsiblePerson,
      contact_number: formContactNumber,
      certificate_number: formCertNumber,
    };

    try {
      if (editingComp) {
        await apiClient.updateBranchCompliance(editingComp.id, payload);
        setSuccessMsg(`FSSAI License for ${payload.branch_name} updated successfully!`);
      } else {
        await apiClient.createBranchCompliance(payload);
        setSuccessMsg(`FSSAI License for ${payload.branch_name} registered successfully!`);
      }
      setModalOpen(false);
      onReload();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save FSSAI compliance");
    } finally {
      setSaving(false);
    }
  };

  const handleVerifyLicense = async (id: string) => {
    setVerifyingId(id);
    setVerifyResult(null);
    try {
      const res: any = await apiClient.verifyBranchCompliance(id);
      const comp = res?.compliance || res?.data || res;
      setVerifyResult(comp);
      onReload();
    } catch (err: any) {
      alert("Verification failed: " + (err.message || "Provider error"));
    } finally {
      setVerifyingId(null);
    }
  };

  const handleDeleteLicense = async (comp: any) => {
    if (!window.confirm(`Delete FSSAI license ${comp.fssai_number} for ${comp.branch_name}? This cannot be undone.`)) return;
    try {
      const res: any = await apiClient.deleteBranchCompliance(comp.id);
      if (res?.success === false) throw new Error(res.error || "Failed to delete FSSAI license");
      onReload();
    } catch (err: any) {
      window.alert(err.message || "Failed to delete FSSAI license");
    }
  };

  const getDaysLeft = (expiryDate?: string) => {
    if (!expiryDate) return null;
    const diff = Math.round((new Date(expiryDate).getTime() - Date.now()) / (1000 * 3600 * 24));
    return diff;
  };

  return (
    <div className="flex flex-col gap-6">
      {successMsg && (
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-sm rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <p className="text-xs text-slate-500 font-medium">Total Hub Licenses</p>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
            {overview?.totalBranches || branches.length}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">Across all fulfillment stores</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-emerald-200/70 dark:border-emerald-900/40 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">Active & Valid</p>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-300 mt-1">
            {overview?.valid ?? complianceList.filter((c) => c.status === "ACTIVE").length}
          </div>
          <p className="text-[11px] text-emerald-600/70 mt-0.5">100% compliant</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-brand-gold/70 dark:border-brand-gold-dark/40 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs text-brand-gold-dark dark:text-brand-gold font-medium">Expiring Soon (≤90d)</p>
            <AlertTriangle className="w-4 h-4 text-brand-gold" />
          </div>
          <div className="text-2xl font-extrabold text-brand-gold-dark dark:text-brand-gold mt-1">
            {overview?.expiringSoon ?? complianceList.filter((c) => c.status?.includes("EXPIRING")).length}
          </div>
          <p className="text-[11px] text-brand-gold/70 mt-0.5">Requires renewal</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-rose-200/70 dark:border-rose-900/40 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs text-rose-700 dark:text-rose-400 font-medium">Expired / Missing</p>
            <AlertOctagon className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-extrabold text-rose-700 dark:text-rose-300 mt-1">
            {(overview?.expired || 0) + (overview?.pendingVerification || 0)}
          </div>
          <p className="text-[11px] text-rose-600/70 mt-0.5">Action required</p>
        </div>
      </div>

      {/* Real-time Expiry & Compliance Alerts */}
      {overview?.alerts && overview.alerts.length > 0 && (
        <div className="flex flex-col gap-2.5">
          {overview.alerts.map((alert: any) => (
            <div
              key={alert.id}
              className={`p-3.5 rounded-xl border flex items-start justify-between gap-3 ${
                alert.severity === "critical"
                  ? "bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-900 text-rose-900 dark:text-rose-200"
                  : "bg-brand-gold-light dark:bg-brand-gold-dark/50 border-brand-gold/40 dark:border-brand-gold-dark text-brand-gold-dark dark:text-brand-gold"
              }`}
            >
              <div className="flex items-center gap-2.5">
                {alert.severity === "critical" ? (
                  <AlertOctagon className="w-4 h-4 text-rose-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-brand-gold shrink-0" />
                )}
                <span className="text-xs font-semibold">{alert.message}</span>
              </div>
              <Badge color={alert.severity === "critical" ? "red" : "orange"} size="small">
                {alert.daysLeft <= 0 ? "EXPIRED" : `${alert.daysLeft} Days Left`}
              </Badge>
            </div>
          ))}
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-brand-gold" />
            <Heading level="h3" className="text-base font-bold">FSSAI Food Safety Licenses (Branch-Level)</Heading>
          </div>
          <Text className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Every food-producing bakery and fulfillment kitchen must possess a valid 14-digit FoSCoS license displayed on customer invoices.
          </Text>
        </div>
        <Button onClick={openCreateModal} className="bg-brand-gold hover:bg-brand-gold-dark text-white flex items-center gap-1.5 shrink-0">
          <Plus className="w-4 h-4" /> Add FSSAI License
        </Button>
      </div>

      {/* FSSAI Licenses Table */}
      <Container className="p-0 overflow-hidden border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Branch & City</th>
                <th className="px-5 py-3.5">FSSAI Number</th>
                <th className="px-5 py-3.5">License Type</th>
                <th className="px-5 py-3.5">Expiry Date</th>
                <th className="px-5 py-3.5">Expiry Status</th>
                <th className="px-5 py-3.5">Verification</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {complianceList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                    No branch FSSAI licenses recorded.
                  </td>
                </tr>
              ) : (
                complianceList.map((comp) => {
                  const daysLeft = getDaysLeft(comp.expiry_date);
                  const isVerified = comp.verification_status === "VERIFIED";

                  let statusColor: "green" | "orange" | "red" | "grey" = "green";
                  if (comp.status === "EXPIRED" || (daysLeft !== null && daysLeft <= 0)) {
                    statusColor = "red";
                  } else if (comp.status?.includes("EXPIRING") || (daysLeft !== null && daysLeft <= 90)) {
                    statusColor = "orange";
                  }

                  return (
                    <tr key={comp.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="px-5 py-4">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {comp.branch_name || "Bakery Hub"}
                        </div>
                        <div className="text-xs text-slate-400">
                          {comp.city_name || "City Hub"} &bull; <span className="font-mono">{comp.branch_code}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-mono font-bold text-brand-gold-dark dark:text-brand-gold text-sm">
                          {comp.fssai_number}
                        </div>
                        <div className="text-xs text-slate-400 truncate max-w-xs">
                          {comp.responsible_person ? `FBO In-Charge: ${comp.responsible_person}` : comp.fbo_name}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <Badge color="grey" size="small" className="font-mono text-[11px]">
                          {comp.fssai_license_type || "STATE_LICENSE"}
                        </Badge>
                      </td>
                      <td className="px-5 py-4">
                        <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                          {comp.expiry_date || "N/A"}
                        </div>
                        {daysLeft !== null && (
                          <div className={`text-[11px] font-medium ${daysLeft <= 0 ? "text-rose-600 font-bold" : daysLeft <= 30 ? "text-brand-gold font-bold" : "text-slate-400"}`}>
                            {daysLeft <= 0 ? "Expired" : `${daysLeft} days left`}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <Badge color={statusColor} size="small" className="font-semibold">
                          {comp.status}
                        </Badge>
                      </td>
                      <td className="px-5 py-4">
                        {isVerified ? (
                          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Verified
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-brand-gold-light text-brand-gold-dark dark:bg-brand-gold-dark dark:text-brand-gold border border-brand-gold/40 dark:border-brand-gold-dark">
                            <AlertTriangle className="w-3 h-3 text-brand-gold" /> {comp.verification_status || "UNVERIFIED"}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="secondary"
                            size="small"
                            onClick={() => handleVerifyLicense(comp.id)}
                            isLoading={verifyingId === comp.id}
                            className="text-xs"
                          >
                            <RefreshCw className="w-3.5 h-3.5 mr-1" /> Verify
                          </Button>
                          <Button
                            variant="secondary"
                            size="small"
                            onClick={() => openEditModal(comp)}
                            className="text-xs"
                          >
                            <Edit2 className="w-3.5 h-3.5 mr-1" /> Edit
                          </Button>
                          <Button
                            variant="secondary"
                            size="small"
                            onClick={() => handleDeleteLicense(comp)}
                            className="text-xs text-rose-600 hover:text-rose-700"
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
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

      {/* Add / Edit FSSAI Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 flex flex-col gap-4 animate-in fade-in-50 zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-brand-gold" />
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  {editingComp ? "Edit FSSAI Food License" : "Add Branch FSSAI License"}
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
                <Label htmlFor="modal_fssai_branch" className="text-xs font-semibold">
                  Fulfillment Branch / Store <span className="text-rose-500">*</span>
                </Label>
                <select
                  id="modal_fssai_branch"
                  value={formBranchId}
                  onChange={(e) => handleBranchSelect(e.target.value)}
                  disabled={Boolean(editingComp)}
                  className="w-full mt-1 px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.city || "City Hub"})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="modal_fssai_no" className="text-xs font-semibold">
                  14-Digit FSSAI License Number <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="modal_fssai_no"
                  value={formFssaiNumber}
                  onChange={(e) => setFormFssaiNumber(e.target.value.replace(/\D/g, "").slice(0, 14))}
                  placeholder="e.g. 11223344556677"
                  maxLength={14}
                  required
                  className="mt-1 font-mono tracking-widest text-base"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  14 numeric digits as issued under the Food Safety and Standards Act.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="modal_fssai_type" className="text-xs font-semibold">License Category</Label>
                  <select
                    id="modal_fssai_type"
                    value={formLicenseType}
                    onChange={(e) => setFormLicenseType(e.target.value as any)}
                    className="w-full mt-1 px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg"
                  >
                    <option value="STATE_LICENSE">State License</option>
                    <option value="CENTRAL_LICENSE">Central License</option>
                    <option value="REGISTRATION">Basic Registration</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="modal_fssai_cert" className="text-xs font-semibold">Certificate / Ref No</Label>
                  <Input
                    id="modal_fssai_cert"
                    value={formCertNumber}
                    onChange={(e) => setFormCertNumber(e.target.value)}
                    placeholder="e.g. FSSAI-KA-001"
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="modal_issue_date" className="text-xs font-semibold">Issue Date</Label>
                  <Input
                    id="modal_issue_date"
                    type="date"
                    value={formIssueDate}
                    onChange={(e) => setFormIssueDate(e.target.value)}
                    required
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="modal_exp_date" className="text-xs font-semibold">Expiry Date</Label>
                  <Input
                    id="modal_exp_date"
                    type="date"
                    value={formExpiryDate}
                    onChange={(e) => setFormExpiryDate(e.target.value)}
                    required
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="modal_fbo_person" className="text-xs font-semibold">Responsible Person / In-Charge</Label>
                  <Input
                    id="modal_fbo_person"
                    value={formResponsiblePerson}
                    onChange={(e) => setFormResponsiblePerson(e.target.value)}
                    required
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="modal_fbo_contact" className="text-xs font-semibold">Contact Phone</Label>
                  <Input
                    id="modal_fbo_contact"
                    value={formContactNumber}
                    onChange={(e) => setFormContactNumber(e.target.value)}
                    required
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="modal_premise_addr" className="text-xs font-semibold">Licensed Premises Address</Label>
                <Input
                  id="modal_premise_addr"
                  value={formPremiseAddress}
                  onChange={(e) => setFormPremiseAddress(e.target.value)}
                  required
                  className="mt-1"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
                <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" isLoading={saving} className="bg-brand-gold hover:bg-brand-gold-dark text-white">
                  {editingComp ? "Save Changes" : "Save FSSAI Record"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
