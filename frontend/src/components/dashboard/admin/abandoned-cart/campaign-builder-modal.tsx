"use client";

import { useState, useEffect } from "react";
import { Badge, Button, Input, Label, Switch } from "@medusajs/ui";
import {
  X,
  Plus,
  Trash2,
  Edit2,
  Clock,
  MessageSquare,
  Sparkles,
  ShieldCheck,
  CheckCircle,
  AlertTriangle,
  Zap,
} from "lucide-react";
import { RecoveryCampaign } from "@/lib/cart-recovery/types";

interface CampaignBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

export function CampaignBuilderModal({ isOpen, onClose, onRefresh }: CampaignBuilderModalProps) {
  const [campaigns, setCampaigns] = useState<RecoveryCampaign[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingCamp, setEditingCamp] = useState<Partial<RecoveryCampaign> | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const fetchCampaigns = () => {
    setLoading(true);
    fetch("/api/v1/admin/abandoned-carts/campaigns")
      .then((res) => res.json())
      .then((data) => {
        if (data.campaigns) setCampaigns(data.campaigns);
      })
      .catch((err) => console.error("Error loading campaigns:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (isOpen) {
      fetchCampaigns();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveCampaign = async () => {
    if (!editingCamp?.name) return;
    setSaving(true);
    setFeedback(null);
    try {
      const isNew = !editingCamp.id;
      const url = isNew
        ? "/api/v1/admin/abandoned-carts/campaigns"
        : `/api/v1/admin/abandoned-carts/campaigns/${editingCamp.id}`;
      const method = isNew ? "POST" : "PUT";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingCamp),
      });
      const data = await res.json();
      if (data.success || data.campaign || data.id) {
        setFeedback("Campaign saved successfully!");
        setEditingCamp(null);
        fetchCampaigns();
        onRefresh();
      }
    } catch (err: any) {
      setFeedback(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (camp: RecoveryCampaign) => {
    try {
      await fetch(`/api/v1/admin/abandoned-carts/campaigns/${camp.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !camp.active }),
      });
      fetchCampaigns();
      onRefresh();
    } catch (err) {
      console.error("Error toggling campaign:", err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this recovery campaign?")) return;
    try {
      await fetch(`/api/v1/admin/abandoned-carts/campaigns/${id}`, {
        method: "DELETE",
      });
      fetchCampaigns();
      onRefresh();
    } catch (err) {
      console.error("Error deleting campaign:", err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl w-full max-w-3xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Top Title Bar */}
        <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-50 dark:bg-neutral-950">
          <div>
            <h2 className="text-base font-bold text-neutral-900 dark:text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-brand-gold" /> Automated Cart Recovery Workflows
            </h2>
            <p className="text-xs text-neutral-500">
              Configure multi-step WhatsApp, SMS, and Telecaller automation sequences for dropped checkouts.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-white rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {feedback && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{feedback}</span>
            </div>
          )}

          {/* New / Edit Form */}
          {editingCamp ? (
            <div className="bg-neutral-50 dark:bg-neutral-800/40 border border-brand-gold/80 dark:border-brand-gold-dark/60 p-4 rounded-xl space-y-4">
              <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-700 pb-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-brand-gold-dark dark:text-brand-gold/40">
                  {editingCamp.id ? "Edit Workflow Rule" : "Create New Recovery Rule"}
                </h3>
                <button
                  onClick={() => setEditingCamp(null)}
                  className="text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
                >
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label className="text-xs">Campaign Name *</Label>
                  <Input
                    size="small"
                    value={editingCamp.name || ""}
                    onChange={(e) => setEditingCamp({ ...editingCamp, name: e.target.value })}
                    placeholder="30-Min Post-Abandonment WhatsApp Ping"
                  />
                </div>
                <div>
                  <Label className="text-xs">Trigger Delay (Minutes)</Label>
                  <Input
                    size="small"
                    type="number"
                    value={editingCamp.delay_minutes ?? 30}
                    onChange={(e) => setEditingCamp({ ...editingCamp, delay_minutes: Number(e.target.value) })}
                    placeholder="30"
                  />
                </div>
                <div>
                  <Label className="text-xs">Dispatch Channel</Label>
                  <select
                    value={editingCamp.channel || "WHATSAPP"}
                    onChange={(e) => setEditingCamp({ ...editingCamp, channel: e.target.value as any })}
                    className="w-full p-2 text-xs border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800"
                  >
                    <option value="WHATSAPP">WhatsApp (Meta Business API)</option>
                    <option value="SMS">SMS Gateway</option>
                    <option value="EMAIL">Email Marketing</option>
                    <option value="TELECALLER">Telecaller Task Assignment</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Discount Incentive Code</Label>
                  <Input
                    size="small"
                    value={typeof editingCamp.discount_rule === "object" && editingCamp.discount_rule !== null ? editingCamp.discount_rule.code : String(editingCamp.discount_rule || "")}
                    onChange={(e) => setEditingCamp({ ...editingCamp, discount_rule: e.target.value })}
                    placeholder="SWEET10 (10% OFF)"
                    className="font-mono text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs">Minimum Cart Value (₹)</Label>
                  <Input
                    size="small"
                    type="number"
                    value={editingCamp.min_cart_value || ""}
                    onChange={(e) => setEditingCamp({ ...editingCamp, min_cart_value: Number(e.target.value) || null })}
                    placeholder="e.g. 1500 (Leave empty for all)"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button size="small" variant="secondary" onClick={() => setEditingCamp(null)}>
                  Cancel
                </Button>
                <Button size="small" variant="primary" onClick={handleSaveCampaign} disabled={saving}>
                  {saving ? "Saving..." : "Save Workflow"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
                Active Automation Pipelines ({campaigns.length})
              </span>
              <Button
                size="small"
                variant="primary"
                onClick={() =>
                  setEditingCamp({
                    name: "",
                    trigger_type: "TIME_DELAY",
                    delay_minutes: 30,
                    channel: "WHATSAPP",
                    discount_rule: "SWEET10",
                    active: true,
                  })
                }
                className="text-xs flex items-center gap-1.5 bg-brand-gold hover:bg-brand-gold-dark text-white"
              >
                <Plus className="w-3.5 h-3.5" /> Add Recovery Workflow
              </Button>
            </div>
          )}

          {/* Campaigns List */}
          <div className="space-y-3">
            {campaigns.map((camp) => (
              <div
                key={camp.id}
                className="p-4 bg-white dark:bg-neutral-800/60 rounded-xl border border-neutral-200 dark:border-neutral-700/60 flex items-center justify-between gap-4 transition-all hover:border-brand-gold dark:hover:border-brand-gold"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-neutral-900 dark:text-white">{camp.name}</span>
                    <Badge color={camp.active ? "green" : "grey"} className="text-[10px]">
                      {camp.active ? "ACTIVE" : "PAUSED"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-neutral-500 dark:text-neutral-400">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-brand-gold" />
                      Delay: {camp.delay_minutes >= 60 ? `${camp.delay_minutes / 60}h` : `${camp.delay_minutes}m`}
                    </span>
                    <span>&bull;</span>
                    <span className="font-semibold text-neutral-700 dark:text-neutral-300">
                      Channel: {camp.channel}
                    </span>
                    {camp.discount_rule && (
                      <>
                        <span>&bull;</span>
                        <span className="font-mono text-brand-gold dark:text-brand-gold">
                          Code: {typeof camp.discount_rule === "object" ? camp.discount_rule?.code : String(camp.discount_rule)}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="small"
                    variant="secondary"
                    onClick={() => handleToggleActive(camp)}
                    className="text-xs"
                  >
                    {camp.active ? "Pause" : "Enable"}
                  </Button>
                  <Button
                    size="small"
                    variant="secondary"
                    onClick={() => setEditingCamp(camp)}
                    className="p-1.5 text-neutral-600 dark:text-neutral-300"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="small"
                    variant="secondary"
                    onClick={() => handleDelete(camp.id)}
                    className="p-1.5 text-rose-600 hover:text-rose-700"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
