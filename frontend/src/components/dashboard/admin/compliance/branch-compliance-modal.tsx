"use client";

import { useState } from "react";
import { Container, Heading, Text, Button, Input, Label, Badge } from "@medusajs/ui";
import { ShieldCheck, Receipt, FileText, X, CheckCircle2, AlertCircle, Save, UploadCloud, Trash2 } from "lucide-react";
import { apiClient } from "@frontend/lib/api-client";

export function BranchComplianceModal({
  branch,
  compliance,
  gstRegistrations,
  onClose,
  onSaved,
}: {
  branch: any;
  compliance?: any;
  gstRegistrations: any[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [activeSubTab, setActiveSubTab] = useState<"gst" | "fssai" | "docs">("fssai");

  // Form State
  const [gstRegId, setGstRegId] = useState(
    compliance?.gst_registration_id ||
      gstRegistrations.find((g) => g.state_code === branch.state_code)?.id ||
      gstRegistrations[0]?.id ||
      "gst_ka"
  );
  const [fssaiNumber, setFssaiNumber] = useState(compliance?.fssai_number || "");
  const [licenseType, setLicenseType] = useState(compliance?.fssai_license_type || "STATE_LICENSE");
  const [fboName, setFboName] = useState(compliance?.fbo_name || "CakeToHome India Private Limited");
  const [premiseName, setPremiseName] = useState(compliance?.premise_name || branch.name || "");
  const [premiseAddress, setPremiseAddress] = useState(compliance?.premise_address || branch.address || "");
  const [issueDate, setIssueDate] = useState(compliance?.issue_date || new Date().toISOString().slice(0, 10));
  const [expiryDate, setExpiryDate] = useState(compliance?.expiry_date || new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().slice(0, 10));
  const [responsiblePerson, setResponsiblePerson] = useState(compliance?.responsible_person || branch.manager_name || "");
  const [contactNumber, setContactNumber] = useState(compliance?.contact_number || branch.phone || "");
  const [certNumber, setCertNumber] = useState(compliance?.certificate_number || "");

  // Documents state
  const [documents, setDocuments] = useState<any[]>([]);
  const [newDocType, setNewDocType] = useState("FSSAI_CERTIFICATE");
  const [newDocName, setNewDocName] = useState("");
  const [newDocUrl, setNewDocUrl] = useState("");

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const selectedGst = gstRegistrations.find((g) => g.id === gstRegId);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);

    const cleanLic = fssaiNumber.replace(/\D/g, "");
    if (cleanLic && cleanLic.length !== 14) {
      setErrorMsg(`FSSAI License number must be exactly 14 digits (received ${cleanLic.length}).`);
      setSaving(false);
      return;
    }

    const payload = {
      branch_id: branch.id,
      branch_name: branch.name,
      branch_code: branch.code,
      city_id: branch.city_id,
      city_name: branch.city,
      state: branch.state,
      state_code: branch.state_code,
      gst_registration_id: gstRegId,
      fssai_number: cleanLic || "11223344556677",
      fssai_license_type: licenseType,
      fbo_name: fboName,
      premise_name: premiseName,
      premise_address: premiseAddress,
      issue_date: issueDate,
      expiry_date: expiryDate,
      responsible_person: responsiblePerson,
      contact_number: contactNumber,
      certificate_number: certNumber,
    };

    try {
      if (compliance?.id) {
        await apiClient.updateBranchCompliance(compliance.id, payload);
      } else {
        await apiClient.createBranchCompliance(payload);
      }
      onSaved();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to update branch compliance");
    } finally {
      setSaving(false);
    }
  };

  const handleAddDocument = async () => {
    if (!newDocName) return;
    const docPayload = {
      document_type: newDocType,
      entity_type: "branch",
      entity_id: branch.id,
      file_name: newDocName,
      file_url: newDocUrl || `/docs/${newDocName.toLowerCase().replace(/\s+/g, "_")}.pdf`,
    };
    try {
      const res: any = await apiClient.createComplianceDocument(docPayload);
      const doc = res?.document || res?.data || docPayload;
      setDocuments([...documents, doc]);
      setNewDocName("");
      setNewDocUrl("");
    } catch (err: any) {
      alert("Failed to add document: " + err.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl p-6 flex flex-col gap-4 animate-in fade-in-50 zoom-in-95 max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-brand-gold" />
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                Branch Compliance: {branch.name}
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 font-mono">
              Hub Code: {branch.code} &bull; City: {branch.city} &bull; State: {branch.state}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
          <button
            type="button"
            onClick={() => setActiveSubTab("fssai")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              activeSubTab === "fssai"
                ? "bg-brand-gold/10 text-brand-gold-dark dark:text-brand-gold border border-brand-gold/30"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" /> FSSAI Food License
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab("gst")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              activeSubTab === "gst"
                ? "bg-brand-gold/10 text-brand-gold-dark dark:text-brand-gold border border-brand-gold/30"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Receipt className="w-3.5 h-3.5" /> State GST Registration
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab("docs")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              activeSubTab === "docs"
                ? "bg-brand-gold/10 text-brand-gold-dark dark:text-brand-gold border border-brand-gold/30"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <FileText className="w-3.5 h-3.5" /> Statutory Documents
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 text-rose-800 dark:text-rose-200 text-xs rounded-lg">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSave} className="flex flex-col gap-4">
          {/* FSSAI TAB */}
          {activeSubTab === "fssai" && (
            <div className="flex flex-col gap-3.5">
              <div>
                <Label htmlFor="branch_fssai_no" className="text-xs font-semibold">
                  14-Digit FSSAI License Number <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="branch_fssai_no"
                  value={fssaiNumber}
                  onChange={(e) => setFssaiNumber(e.target.value.replace(/\D/g, "").slice(0, 14))}
                  placeholder="e.g. 11223344556677"
                  maxLength={14}
                  required
                  className="mt-1 font-mono tracking-widest text-base"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="branch_fssai_type" className="text-xs font-semibold">License Category</Label>
                  <select
                    id="branch_fssai_type"
                    value={licenseType}
                    onChange={(e) => setLicenseType(e.target.value as any)}
                    className="w-full mt-1 px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg"
                  >
                    <option value="STATE_LICENSE">State License</option>
                    <option value="CENTRAL_LICENSE">Central License</option>
                    <option value="REGISTRATION">Basic Registration</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="branch_cert_no" className="text-xs font-semibold">Certificate Number</Label>
                  <Input
                    id="branch_cert_no"
                    value={certNumber}
                    onChange={(e) => setCertNumber(e.target.value)}
                    placeholder="e.g. FSSAI-KA-00142"
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="branch_issue_date" className="text-xs font-semibold">Issue Date</Label>
                  <Input
                    id="branch_issue_date"
                    type="date"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                    required
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="branch_exp_date" className="text-xs font-semibold">Expiry Date</Label>
                  <Input
                    id="branch_exp_date"
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    required
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="branch_resp_person" className="text-xs font-semibold">Responsible FBO In-Charge</Label>
                  <Input
                    id="branch_resp_person"
                    value={responsiblePerson}
                    onChange={(e) => setResponsiblePerson(e.target.value)}
                    required
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="branch_resp_phone" className="text-xs font-semibold">Contact Phone</Label>
                  <Input
                    id="branch_resp_phone"
                    value={contactNumber}
                    onChange={(e) => setContactNumber(e.target.value)}
                    required
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="branch_premise_addr" className="text-xs font-semibold">Premises Address</Label>
                <Input
                  id="branch_premise_addr"
                  value={premiseAddress}
                  onChange={(e) => setPremiseAddress(e.target.value)}
                  required
                  className="mt-1"
                />
              </div>
            </div>
          )}

          {/* GST LINKAGE TAB */}
          {activeSubTab === "gst" && (
            <div className="flex flex-col gap-4">
              <div>
                <Label htmlFor="branch_gst_reg" className="text-xs font-semibold">
                  Linked Company GST Registration <span className="text-rose-500">*</span>
                </Label>
                <select
                  id="branch_gst_reg"
                  value={gstRegId}
                  onChange={(e) => setGstRegId(e.target.value)}
                  className="w-full mt-1 px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg"
                >
                  {gstRegistrations.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.state} ({g.gstin}) - {g.trade_name}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  Orders fulfilled from {branch.name} will apply this state's GSTIN and state tax rules.
                </p>
              </div>

              {selectedGst && (
                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col gap-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Selected GSTIN:</span>
                    <span className="font-mono font-bold text-brand-gold-dark dark:text-brand-gold text-sm">{selectedGst.gstin}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">State & Code:</span>
                    <span className="font-semibold">{selectedGst.state} (Code {selectedGst.state_code})</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Legal Name:</span>
                    <span className="font-semibold">{selectedGst.legal_name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Verification:</span>
                    <Badge color={selectedGst.verification_status === "VERIFIED" ? "green" : "orange"} size="small">
                      {selectedGst.verification_status || "UNVERIFIED"}
                    </Badge>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STATUTORY DOCUMENTS TAB */}
          {activeSubTab === "docs" && (
            <div className="flex flex-col gap-4">
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col gap-2.5">
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Upload / Register Compliance Certificate</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <select
                    value={newDocType}
                    onChange={(e) => setNewDocType(e.target.value)}
                    className="text-xs px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg"
                  >
                    <option value="FSSAI_CERTIFICATE">FSSAI Certificate</option>
                    <option value="TRADE_LICENSE">Trade License</option>
                    <option value="GST_CERTIFICATE">GST Certificate</option>
                    <option value="OTHER">Municipal / Fire Permit</option>
                  </select>
                  <Input
                    placeholder="Document Title (e.g. FSSAI License 2026)"
                    value={newDocName}
                    onChange={(e) => setNewDocName(e.target.value)}
                    className="text-xs"
                  />
                  <Button type="button" size="small" onClick={handleAddDocument} className="bg-brand-gold hover:bg-brand-gold-dark text-white text-xs">
                    <UploadCloud className="w-3.5 h-3.5 mr-1" /> Add Record
                  </Button>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Registered Certificates for {branch.name}</p>
                {documents.length === 0 ? (
                  <p className="text-xs text-slate-400 py-3 text-center border border-dashed rounded-lg">
                    No documents uploaded yet for this branch.
                  </p>
                ) : (
                  documents.map((doc, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-lg text-xs border border-slate-200 dark:border-slate-700">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-brand-gold" />
                        <div>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{doc.file_name}</span>
                          <span className="text-[11px] text-slate-400 ml-2">({doc.document_type})</span>
                        </div>
                      </div>
                      <Badge color="green" size="small">Active</Badge>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" isLoading={saving} className="bg-brand-gold hover:bg-brand-gold-dark text-white flex items-center gap-1.5">
              <Save className="w-4 h-4" /> Save Branch Compliance
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
