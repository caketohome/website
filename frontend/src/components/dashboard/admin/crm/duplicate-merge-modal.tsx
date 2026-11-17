"use client";

import { useState, useEffect } from "react";
import { X, Users, AlertTriangle, ArrowRight, CheckCircle2, ShieldCheck, RefreshCw } from "lucide-react";
import { Badge, Button, Heading, Text } from "@medusajs/ui";
import { CustomerDuplicateCandidate } from "@frontend/lib/crm/types";
import { formatDisplayPhone } from "@frontend/lib/crm/crm-engine";
import { apiClient } from "@frontend/lib/api-client";

interface DuplicateMergeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMergedSuccess?: () => void;
}

export function DuplicateMergeModal({ isOpen, onClose, onMergedSuccess }: DuplicateMergeModalProps) {
  const [duplicates, setDuplicates] = useState<CustomerDuplicateCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCandidate, setSelectedCandidate] = useState<CustomerDuplicateCandidate | null>(null);
  const [primaryChoice, setPrimaryChoice] = useState<"A" | "B">("A");
  const [merging, setMerging] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchDuplicates = async () => {
    setLoading(true);
    try {
      const res: any = await apiClient.getAdminCrmDuplicates();
      if (res?.duplicates) {
        setDuplicates(res.duplicates);
        if (res.duplicates.length > 0) {
          setSelectedCandidate(res.duplicates[0]);
        }
      }
    } catch (err) {
      console.error("Failed to fetch customer duplicates:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchDuplicates();
      setSuccessMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleMerge = async () => {
    if (!selectedCandidate) return;
    setMerging(true);
    const primary = primaryChoice === "A" ? selectedCandidate.customer_a : selectedCandidate.customer_b;
    const secondary = primaryChoice === "A" ? selectedCandidate.customer_b : selectedCandidate.customer_a;
    if (!primary || !secondary) return;

    try {
      const res: any = await apiClient.mergeAdminCustomers(primary.customer_uid, secondary.customer_uid);
      if (res?.success) {
        setSuccessMessage(`Successfully merged "${secondary.name || "secondary"}" into "${primary.name || "primary"}". All orders and data preserved.`);
        setTimeout(() => {
          fetchDuplicates();
          if (onMergedSuccess) onMergedSuccess();
        }, 1500);
      }
    } catch (err) {
      console.error("Merge error:", err);
    } finally {
      setMerging(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
      <div className="relative w-full max-w-4xl bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-brand-gold-light/50 dark:bg-brand-gold-dark/20">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-brand-gold flex items-center justify-center text-white">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <Heading level="h2" className="text-base font-bold text-neutral-900 dark:text-white">
                Customer Deduplication & Safe Merge Engine
              </Heading>
              <Text className="text-xs text-neutral-500">
                Identify duplicate customer identities, resolve duplicates, and preserve all orders, addresses, and history.
              </Text>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-neutral-200 dark:hover:bg-neutral-800 flex items-center justify-center text-neutral-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-48 text-neutral-400 gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-brand-gold" />
              <span className="text-xs">Scanning customer database for duplicates...</span>
            </div>
          ) : duplicates.length === 0 ? (
            <div className="p-12 text-center border border-dashed rounded-xl border-neutral-300 dark:border-neutral-700 flex flex-col items-center gap-2">
              <ShieldCheck className="w-10 h-10 text-emerald-600" />
              <Heading level="h3" className="text-sm font-bold text-neutral-900 dark:text-white">
                Zero Duplicates Found
              </Heading>
              <Text className="text-xs text-neutral-500 max-w-sm">
                All customer identities in Cakes2Home are unique and canonically verified by phone, account ID, and verified email.
              </Text>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {/* Candidate Selector List */}
              <div className="flex flex-col gap-2">
                <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
                  Potential Duplicates Detected ({duplicates.length})
                </span>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {duplicates.map((cand, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setSelectedCandidate(cand);
                        setSuccessMessage(null);
                      }}
                      className={`p-3 rounded-xl border text-left flex flex-col gap-1 min-w-[240px] transition-all ${
                        selectedCandidate === cand
                          ? "border-brand-gold bg-brand-gold-light/50 dark:bg-brand-gold-dark/30 ring-1 ring-brand-gold"
                          : "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-neutral-300"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold truncate text-neutral-900 dark:text-white">
                          {cand.customer_a?.name || "Candidate"}
                        </span>
                        <Badge color={cand.confidence_score >= 80 ? "red" : "orange"} className="text-[10px]">
                          {cand.confidence_score}% Match
                        </Badge>
                      </div>
                      <span className="text-[11px] text-neutral-500">
                        Matches on: {cand.match_reasons.join(", ")}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Side-by-Side Comparison */}
              {selectedCandidate && (
                <div className="flex flex-col gap-4">
                  <div className="p-4 rounded-xl bg-brand-gold-light dark:bg-brand-gold-dark/40 border border-brand-gold/40 dark:border-brand-gold-dark/60 text-xs text-brand-gold-dark dark:text-brand-gold/40 flex items-center justify-between">
                    <span>
                      Matching fields: <strong className="uppercase">{(selectedCandidate.matching_fields || []).join(", ")}</strong> • Confidence: <strong>{selectedCandidate.confidence_score}%</strong>
                    </span>
                    <span className="text-[11px] text-neutral-500">Select which record is the canonical Master:</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Customer A */}
                    <div
                      onClick={() => setPrimaryChoice("A")}
                      className={`p-5 rounded-2xl border cursor-pointer transition-all flex flex-col gap-3 relative ${
                        primaryChoice === "A"
                          ? "border-emerald-500 bg-emerald-50/30 dark:bg-emerald-950/20 ring-2 ring-emerald-500"
                          : "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 opacity-75 hover:opacity-100"
                      }`}
                    >
                      {primaryChoice === "A" && (
                        <div className="absolute top-3 right-3 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-600 text-white uppercase">
                          Keep as Master (Primary)
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-neutral-900 dark:text-white">
                          {selectedCandidate.customer_a?.name || "Customer A"}
                        </span>
                        <Badge color="blue" className="text-[10px]">
                          {selectedCandidate.customer_a?.customer_type || "UNKNOWN"}
                        </Badge>
                      </div>

                      <div className="flex flex-col gap-1.5 text-xs text-neutral-600 dark:text-neutral-300">
                        <div>Phone: <strong className="font-mono">{formatDisplayPhone(selectedCandidate.customer_a?.phone || "")}</strong></div>
                        <div>Email: <span>{selectedCandidate.customer_a?.email || "—"}</span></div>
                        <div>UID: <span className="font-mono text-neutral-400">{selectedCandidate.customer_a?.customer_uid || "—"}</span></div>
                        <div>Orders: <strong>{selectedCandidate.customer_a?.orders_count || 0}</strong> • Spend: <strong>₹{selectedCandidate.customer_a?.total_spend || 0}</strong></div>
                        <div>Tier: <strong>{selectedCandidate.customer_a?.tier || "STANDARD"}</strong></div>
                      </div>
                    </div>

                    {/* Customer B */}
                    <div
                      onClick={() => setPrimaryChoice("B")}
                      className={`p-5 rounded-2xl border cursor-pointer transition-all flex flex-col gap-3 relative ${
                        primaryChoice === "B"
                          ? "border-emerald-500 bg-emerald-50/30 dark:bg-emerald-950/20 ring-2 ring-emerald-500"
                          : "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 opacity-75 hover:opacity-100"
                      }`}
                    >
                      {primaryChoice === "B" && (
                        <div className="absolute top-3 right-3 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-600 text-white uppercase">
                          Keep as Master (Primary)
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-neutral-900 dark:text-white">
                          {selectedCandidate.customer_b?.name || "Customer B"}
                        </span>
                        <Badge color="blue" className="text-[10px]">
                          {selectedCandidate.customer_b?.customer_type || "UNKNOWN"}
                        </Badge>
                      </div>

                      <div className="flex flex-col gap-1.5 text-xs text-neutral-600 dark:text-neutral-300">
                        <div>Phone: <strong className="font-mono">{formatDisplayPhone(selectedCandidate.customer_b?.phone || "")}</strong></div>
                        <div>Email: <span>{selectedCandidate.customer_b?.email || "—"}</span></div>
                        <div>UID: <span className="font-mono text-neutral-400">{selectedCandidate.customer_b?.customer_uid || "—"}</span></div>
                        <div>Orders: <strong>{selectedCandidate.customer_b?.orders_count || 0}</strong> • Spend: <strong>₹{selectedCandidate.customer_b?.total_spend || 0}</strong></div>
                        <div>Tier: <strong>{selectedCandidate.customer_b?.tier || "STANDARD"}</strong></div>
                      </div>
                    </div>
                  </div>

                  {successMessage && (
                    <div className="p-3 bg-emerald-100 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      {successMessage}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-50 dark:bg-neutral-900/60">
          <Button variant="secondary" size="small" onClick={onClose} className="text-xs">
            Close
          </Button>

          {selectedCandidate && (
            <Button
              size="small"
              onClick={handleMerge}
              isLoading={merging}
              className="bg-brand-gold hover:bg-brand-gold-dark text-white text-xs flex items-center gap-1.5"
            >
              <ArrowRight className="w-3.5 h-3.5" /> Execute Safe Merge
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
