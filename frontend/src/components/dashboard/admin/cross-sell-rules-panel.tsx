"use client";

import { useState, useEffect } from "react";
import { Heading, Text, Badge, Input, Button, Label } from "@medusajs/ui";
import { apiClient } from "@frontend/lib/api-client";
import { Sliders, Plus, Edit3, Trash2, CheckCircle, Wand2 } from "lucide-react";

export function CrossSellRulesPanel() {
  const [rules, setRules] = useState<any[]>([]);
  const [accessories, setAccessories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState<any | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [occasion, setOccasion] = useState("Birthday");
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
    setOccasion("Birthday");
    setSelectedAccessoryIds(accessories.slice(0, 4).map((a) => a.id));
    setPriority("1");
    setStatus("active");
    setShowModal(true);
  };

  const handleOpenEdit = (rule: any) => {
    setEditingRule(rule);
    setName(rule.name || "");
    setOccasion(rule.occasion || "Birthday");
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
      occasion,
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
            Automatically maps accessories to cake products based on occasion (Birthday, Anniversary, Wedding, Kids) and category rules.
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
            return (
              <div key={rule.id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900 dark:text-white">{rule.name}</span>
                    <Badge color="purple">Occasion: {rule.occasion || "General"}</Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="small" variant="transparent" onClick={() => handleOpenEdit(rule)}>
                      <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                    </Button>
                  </div>
                </div>

                <div className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                  Mapped Accessories ({mappedAccs.length}):
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {mappedAccs.map((acc) => (
                    <span key={acc.id} className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded font-semibold text-[11px] flex items-center gap-1">
                      🎁 {acc.name} (₹{acc.price})
                    </span>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col my-8">
            <div className="p-4 border-b flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
              <Heading level="h3" className="text-base font-bold flex items-center gap-2">
                <Wand2 className="w-5 h-5 text-purple-600" />
                {editingRule ? `Edit Rule: ${editingRule.name}` : "Create Smart Cross-Sell Rule"}
              </Heading>
              <Button size="small" variant="transparent" onClick={() => setShowModal(false)}>Close</Button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs overflow-y-auto max-h-[75vh]">
              <div>
                <Label>Rule Name *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Birthday Special" required />
              </div>

              <div>
                <Label>Target Occasion</Label>
                <select
                  value={occasion}
                  onChange={(e) => setOccasion(e.target.value)}
                  className="w-full p-2.5 text-xs font-semibold rounded-lg border bg-white dark:bg-slate-900"
                >
                  <option value="Birthday">Birthday</option>
                  <option value="Anniversary">Anniversary</option>
                  <option value="Wedding">Wedding</option>
                  <option value="Kids">Kids Party</option>
                  <option value="General">General / All Occasions</option>
                </select>
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

              <div className="pt-4 border-t flex justify-end gap-2">
                <Button type="button" variant="transparent" onClick={() => setShowModal(false)}>Cancel</Button>
                <Button type="submit" isLoading={submitting} className="bg-purple-600 hover:bg-purple-700 text-white font-bold">
                  Save Rule
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
