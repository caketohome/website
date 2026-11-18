"use client";

import { useState } from "react";
import { Container, Heading, Text, Button, Input, Label, Badge } from "@medusajs/ui";
import { Plug, Save, CheckCircle2, RefreshCw, Key, ShieldCheck, Database } from "lucide-react";
import { apiClient } from "@frontend/lib/api-client";

export function IntegrationsTab({
  integrationSettings,
  onUpdated,
}: {
  integrationSettings: any;
  onUpdated: (updated: any) => void;
}) {
  const [formData, setFormData] = useState({
    gst_api_configured: integrationSettings?.gst_api_configured ?? false,
    gst_api_provider: integrationSettings?.gst_api_provider || "manual_sandbox",
    fssai_api_configured: integrationSettings?.fssai_api_configured ?? false,
    fssai_api_provider: integrationSettings?.fssai_api_provider || "manual_sandbox",
    sms_gateway: integrationSettings?.sms_gateway || "configured",
    whatsapp_gateway: integrationSettings?.whatsapp_gateway || "configured",
  });

  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg(null);
    try {
      const res: any = await apiClient.updateIntegrationSettings(formData);
      const updated = res?.integrations || res?.data || formData;
      onUpdated(updated);
      setSuccessMsg("Third-party statutory integration settings saved!");
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      alert("Failed to save integration settings: " + (err.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
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
            <Plug className="w-5 h-5 text-brand-gold" />
            <Heading level="h3" className="text-base font-bold">Third-Party Compliance & API Integrations</Heading>
          </div>
          <Text className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Configure external API adapters for live GSTIN lookups (ClearTax / GSTN GSP) and FoSCoS FSSAI registries.
          </Text>
        </div>
        <Button
          type="submit"
          isLoading={saving}
          className="bg-brand-gold hover:bg-brand-gold-dark text-white flex items-center gap-1.5 shrink-0"
        >
          <Save className="w-4 h-4" /> Save Integration Config
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* GST Integration Provider */}
        <Container className="p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-brand-gold" />
              <Text className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                GSTIN Verification Provider
              </Text>
            </div>
            <Badge color={formData.gst_api_configured ? "green" : "grey"} size="small">
              {formData.gst_api_configured ? "LIVE API" : "STRUCTURE VALIDATOR"}
            </Badge>
          </div>

          <div className="flex flex-col gap-3">
            <div>
              <Label htmlFor="gst_provider" className="text-xs font-semibold">Active Provider Adapter</Label>
              <select
                id="gst_provider"
                value={formData.gst_api_provider}
                onChange={(e) => setFormData({ ...formData, gst_api_provider: e.target.value })}
                className="w-full mt-1 px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg"
              >
                <option value="manual_sandbox">Format Validator (Built-in Regex Sandbox)</option>
                <option value="cleartax">ClearTax GST API Adapter</option>
                <option value="gstn_gsp">GSTN GSP Direct Integration</option>
                <option value="karza">Karza Statutory Verification API</option>
              </select>
            </div>

            <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50/50 cursor-pointer">
              <div>
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">Enable Live External Verification</span>
                <p className="text-[11px] text-slate-400">Routes verification queries to external paid GSP endpoints</p>
              </div>
              <input
                type="checkbox"
                checked={formData.gst_api_configured}
                onChange={(e) => setFormData({ ...formData, gst_api_configured: e.target.checked })}
                className="w-4 h-4 rounded text-brand-gold focus:ring-brand-gold"
              />
            </label>
          </div>
        </Container>

        {/* FSSAI FoSCoS Provider */}
        <Container className="p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-brand-gold" />
              <Text className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                FSSAI / FoSCoS Verification Provider
              </Text>
            </div>
            <Badge color={formData.fssai_api_configured ? "green" : "grey"} size="small">
              {formData.fssai_api_configured ? "LIVE API" : "STRUCTURE VALIDATOR"}
            </Badge>
          </div>

          <div className="flex flex-col gap-3">
            <div>
              <Label htmlFor="fssai_provider" className="text-xs font-semibold">Active Provider Adapter</Label>
              <select
                id="fssai_provider"
                value={formData.fssai_api_provider}
                onChange={(e) => setFormData({ ...formData, fssai_api_provider: e.target.value })}
                className="w-full mt-1 px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg"
              >
                <option value="manual_sandbox">Format Validator (Built-in 14-Digit Registry)</option>
                <option value="foscos_portal">FoSCoS Public License API</option>
                <option value="karza">Karza FSSAI Compliance API</option>
              </select>
            </div>

            <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50/50 cursor-pointer">
              <div>
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">Enable Live FoSCoS Registry Lookup</span>
                <p className="text-[11px] text-slate-400">Verifies live FBO address and active status against Government FoSCoS database</p>
              </div>
              <input
                type="checkbox"
                checked={formData.fssai_api_configured}
                onChange={(e) => setFormData({ ...formData, fssai_api_configured: e.target.checked })}
                className="w-4 h-4 rounded text-brand-gold focus:ring-brand-gold"
              />
            </label>
          </div>
        </Container>

        {/* n8n Automation & Webhook Outbox Card */}
        <Container className="p-5 flex flex-col gap-4 lg:col-span-2 bg-slate-900 text-white border-slate-800">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Plug className="w-4 h-4 text-brand-primary" />
              <Text className="text-xs font-bold uppercase tracking-wider text-brand-primary">
                n8n Automation &amp; Transactional Webhook Outbox
              </Text>
            </div>
            <Badge color="purple" size="small">
              HMAC-SHA256 SIGNED
            </Badge>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <Text className="text-sm font-semibold text-white">
                Outbound Event Stream for CRM, Messaging &amp; Marketing
              </Text>
              <Text className="text-xs text-slate-300">
                Dispatches real-time customer lifecycle events (logins, registrations, cart abandonments, orders, telemarketing candidates) with zero downtime resilience.
              </Text>
            </div>
            <a
              href="?tab=webhooks"
              className="px-4 py-2 bg-brand-primary hover:bg-brand-navy text-white text-xs font-semibold rounded-lg shrink-0 flex items-center gap-1.5 transition-colors"
            >
              <Plug className="w-3.5 h-3.5" /> Manage n8n Webhooks &rarr;
            </a>
          </div>
        </Container>
      </div>
    </form>
  );
}
