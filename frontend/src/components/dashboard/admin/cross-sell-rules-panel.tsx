"use client";

import { useState, useEffect } from "react";
import { Heading, Text, Badge, Input, Button, Label } from "@medusajs/ui";
import { apiClient } from "@frontend/lib/api-client";
import { Sliders, Plus, Edit3, Trash2, CheckCircle, Wand2 } from "lucide-react";
import { OccasionSelector } from "./occasion-selector";

export function CrossSellRulesPanel() {
  const [rules, setRules] = useState<any[]>([]);
  const [accessories, setAccessories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState<any | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [occasionIds, setOccasionIds] = useState<string[]>(["occ_birthday"]);
  const [selectedAccessoryIds, setSelectedAccessoryIds] = useState<string[]>([]);
  const [priority, setPriority] = useState("1");
  const [status, setStatus] = useState<"active" | "inactive">("active");

  const [submitting, setSubmitting] = useState(false);

  const fetchRules = async () => {
    setLoading(true);
    try {
      const res: any = await apiClient.getAdminAccessories();
      setRules(res?.rules || []);
      setAccessories(res?.accessories || []);
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, []);

  const handleOpenCreate = () => {
    setEditingRule(null);
    setName("Birthday Party Smart Cross-Sell");
    setOccasionIds(["occ_birthday"]);
    setSelectedAccessoryIds(accessories.slice(0, 4).map((a) => a.id));
    setPriority("1");
    setStatus("active");
    setShowModal(true);
  };

  const handleOpenEdit = (rule: any) => {
    setEditingRule(rule);
    setName(rule.name || "");
    const initialOccIds = Array.isArray(rule.occasion_ids) && rule.occasion_ids.length > 0
      ? rule.occasion_ids
      : (rule.occasion ? [rule.occasion.toLowerCase().includes("anniv") ? "occ_anniversary" : "occ_birthday"] : []);
    setOccasionIds(initialOccIds);
    setSelectedAccessoryIds(Array.isArray(rule.accessory_ids) ? rule.accessory_ids : []);
    setPriority(String(rule.priority || 1));
    setStatus(rule.status || "active");
    setShowModal(true);
  };

  const toggleAccessorySelection = (id: string) => {
    setSelectedAccessoryIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);

    const payload = {
      type: "rule",
      id: editingRule?.id,
      name,
      occasion: occasionIds.length > 0 ? occasionIds[0] : "General",
      occasion_ids: occasionIds,
      accessory_ids: selectedAccessoryIds,
      priority: parseInt(priority, 10) || 1,
      status,
    };

    try {
      await apiClient.createAdminAccessory(payload);
      setShowModal(false);
      fetchRules();
    } catch (err: any) {
      alert(err.message || "Failed to save rule");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-purple-50/60 dark:bg-purple-950/30 p-4 rounded-xl border border-purple-200 dark:border-purple-900">
        <div>
          <Heading level="h2" className="text-lg font-bold flex items-center gap-2 text-purple-900 dark:text-purple-200">
            <Wand2 className="w-5 h-5 text-purple-600" /> Smart Auto-Mapping Rule Engine ({rules.length})
          </Heading>
          <Text className="text-xs text-purple-700 dark:text-purple-300">
            Automatically maps accessories to cake products based on structured occasion taxonomy and category rules.
          </Text>
        </div>

        <Button onClick={handleOpenCreate} className="bg-purple-600 hover:bg-purple-700 text-white font-bold shrink-0">
          <Plus className="w-4 h-4 mr-1" /> Create Cross-Sell Rule
        </Button>
      </div>

      {/* Rules List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading ? (
          <div className="p-6 text-center text-xs text-slate-400 col-span-2">Loading cross-sell rules...</div>
        ) : rules.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400 col-span-2">No cross-sell rules configured.</div>
        ) : (
          rules.map((rule) => {
            const mappedAccs = accessories.filter((a) => (rule.accessory_ids || []).includes(a.id));
            const ruleOccs = Array.isArray(rule.occasion_ids) && rule.occasion_ids.length > 0
              ? rule.occasion_ids
              : (rule.occasion ? [rule.occasion] : []);

            return (
              <div key={rule.id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm text-slate-900 dark:text-white">{rule.name}</span>
                    {ruleOccs.map((occ: string) => (
                      <Badge key={occ} color="purple" className="text-[10px]">
                        {occ.replace(/^occ_/, "")}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="small" variant="transparent" onClick={() => handleOpenEdit(rule)}>
                      <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                    </Button>
                  </div>
                </div>

                <div className="text-xs text-slate-500 flex items-center justify-between">
                  <span>Priority: #{rule.priority}</span>
                  <Badge color={rule.status === "active" ? "green" : "grey"}>{rule.status}</Badge>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-[11px] font-bold text-slate-400 block mb-1">
                    Mapped Celebration Accessories ({mappedAccs.length}):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {mappedAccs.map((acc) => (
                      <span key={acc.id} className="inline-flex items-center px-2 py-0.5 rounded text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {acc.name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full border shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-b flex items-center justify-between">
              <Heading level="h3" className="text-sm font-bold flex items-center gap-2">
                <Sliders className="w-4 h-4 text-purple-600" />
                {editingRule ? "Edit Cross-Sell Rule" : "Create Smart Cross-Sell Rule"}
              </Heading>
              <Button size="small" variant="transparent" onClick={() => setShowModal(false)}>Close</Button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs overflow-y-auto max-h-[75vh]">
              <div>
                <Label>Rule Name *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Birthday Special" required />
              </div>

              <div>
                <OccasionSelector
                  label="Target Celebration Occasions"
                  selectedIds={occasionIds}
                  onChange={setOccasionIds}
                  helperText="Accessories in this rule trigger whenever a product matching these occasions is viewed or added to cart."
                />
              </div>

              <div>
                <Label className="font-bold mb-2">Select Mapped Accessories ({selectedAccessoryIds.length} chosen)</Label>
                <div className="space-y-1.5 max-h-48 overflow-y-auto p-2 border rounded-lg bg-slate-50 dark:bg-slate-800/40">
                  {accessories.map((acc) => {
                    const isSelected = selectedAccessoryIds.includes(acc.id);
                    return (
                      <div
                        key={acc.id}
                        onClick={() => toggleAccessorySelection(acc.id)}
                        className={`p-2 rounded-lg border cursor-pointer flex items-center justify-between text-xs transition ${
                          isSelected ? "border-purple-600 bg-purple-50 text-purple-900 font-bold" : "border-slate-200 bg-white hover:bg-slate-100 text-slate-800"
                        }`}
                      >
                        <span>{acc.name} • ₹{acc.price}</span>
                        {isSelected && <CheckCircle className="w-4 h-4 text-purple-600" />}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Priority Weight</Label>
                  <Input type="number" value={priority} onChange={(e) => setPriority(e.target.value)} />
                </div>
                <div>
                  <Label>Status</Label>
                  <select
                    value={status}
                    onChange={(e: any) => setStatus(e.target.value)}
                    className="w-full p-2.5 text-xs font-semibold rounded-lg border bg-white dark:bg-slate-900"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t flex justify-end gap-2">
                <Button type="button" variant="transparent" onClick={() => setShowModal(false)}>Cancel</Button>
                <Button type="submit" isLoading={submitting} className="bg-purple-600 hover:bg-purple-700 text-white font-bold">
                  {editingRule ? "Save Rule" : "Create Rule"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
