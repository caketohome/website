"use client";

import { useState } from "react";
import { Container, Heading, Text, Button, Badge } from "@medusajs/ui";
import { Store, ShieldCheck, AlertTriangle, AlertCircle, Edit2, CheckCircle2, FileText, Plus } from "lucide-react";
import { BranchComplianceModal } from "./branch-compliance-modal";

export function BranchComplianceTab({
  branches,
  complianceList,
  gstRegistrations,
  onReload,
}: {
  branches: any[];
  complianceList: any[];
  gstRegistrations: any[];
  onReload: () => void;
}) {
  const [selectedBranch, setSelectedBranch] = useState<any | null>(null);

  const getBranchComplianceRecord = (branchId: string) => {
    return complianceList.find((c) => c.branch_id === branchId);
  };

  const getBranchGstRegistration = (compRecord: any, branch: any) => {
    if (compRecord?.gst_registration_id) {
      const found = gstRegistrations.find((g) => g.id === compRecord.gst_registration_id);
      if (found) return found;
    }
    // Fallback match by state or state_code
    return gstRegistrations.find((g) => g.state_code === branch.state_code || g.state?.toLowerCase() === branch.state?.toLowerCase()) || gstRegistrations[0];
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <Store className="w-5 h-5 text-brand-gold" />
            <Heading level="h3" className="text-base font-bold">Branch & Store Statutory Compliance Matrix</Heading>
          </div>
          <Text className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Cross-functional statutory view linking City Hubs → State GST Registrations → Premises-specific FSSAI Licenses.
          </Text>
        </div>
      </div>

      {/* Matrix Table */}
      <Container className="p-0 overflow-hidden border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Fulfillment Branch</th>
                <th className="px-5 py-3.5">City & State</th>
                <th className="px-5 py-3.5">Linked State GSTIN</th>
                <th className="px-5 py-3.5">FSSAI License #</th>
                <th className="px-5 py-3.5">FSSAI Expiry</th>
                <th className="px-5 py-3.5">Compliance Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {branches.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                    No active fulfillment branches found.
                  </td>
                </tr>
              ) : (
                branches.map((b) => {
                  const comp = getBranchComplianceRecord(b.id);
                  const gst = getBranchGstRegistration(comp, b);

                  const hasFssai = Boolean(comp?.fssai_number);
                  const isExpired = comp?.status === "EXPIRED";
                  const isExpiring = comp?.status?.includes("EXPIRING");

                  return (
                    <tr key={b.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="px-5 py-4">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {b.name}
                        </div>
                        <div className="text-xs font-mono text-slate-400">
                          {b.code || "HUB"} &bull; {b.phone || "No phone"}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="text-slate-800 dark:text-slate-200 font-medium">
                          {b.city || "—"}
                        </div>
                        <div className="text-xs text-slate-500">
                          {b.state || "—"}{b.state_code ? ` (Code: ${b.state_code})` : ""}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        {gst ? (
                          <div>
                            <div className="font-mono text-xs font-bold text-brand-gold-dark dark:text-brand-gold">
                              {gst.gstin}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {gst.state} Registration
                            </div>
                          </div>
                        ) : (
                          <Badge color="orange" size="small">Missing GSTIN</Badge>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        {hasFssai ? (
                          <div>
                            <div className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                              {comp.fssai_number}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {comp.fssai_license_type || "STATE_LICENSE"}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-rose-600 font-medium">No FSSAI linked</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        {comp?.expiry_date ? (
                          <div className="text-xs">
                            <span className="font-semibold">{comp.expiry_date}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">N/A</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        {isExpired ? (
                          <Badge color="red" size="small">EXPIRED</Badge>
                        ) : isExpiring ? (
                          <Badge color="orange" size="small">{comp?.status}</Badge>
                        ) : hasFssai && gst ? (
                          <Badge color="green" size="small">COMPLIANT</Badge>
                        ) : (
                          <Badge color="grey" size="small">INCOMPLETE</Badge>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Button
                          variant="secondary"
                          size="small"
                          onClick={() => setSelectedBranch(b)}
                          className="text-xs"
                        >
                          <Edit2 className="w-3.5 h-3.5 mr-1" /> Edit Compliance
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Container>

      {/* Dedicated Branch Compliance Modal */}
      {selectedBranch && (
        <BranchComplianceModal
          branch={selectedBranch}
          compliance={getBranchComplianceRecord(selectedBranch.id)}
          gstRegistrations={gstRegistrations}
          onClose={() => setSelectedBranch(null)}
          onSaved={() => {
            setSelectedBranch(null);
            onReload();
          }}
        />
      )}
    </div>
  );
}
