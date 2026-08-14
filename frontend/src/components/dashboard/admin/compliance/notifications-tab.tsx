"use client";

import { useState } from "react";
import { Container, Heading, Text, Button, Badge } from "@medusajs/ui";
import { Bell, Save, CheckCircle2, Mail, MessageSquare, AlertTriangle } from "lucide-react";

export function NotificationsTab() {
  const [channels, setChannels] = useState({
    email_enabled: true,
    whatsapp_enabled: true,
    sms_enabled: true,
    fssai_expiry_90d: true,
    fssai_expiry_30d: true,
    invoice_dispatch_customer: true,
    kot_print_alert: true,
    high_value_order_alert: true,
  });

  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      setSuccessMsg("Notification preferences and statutory alerts updated!");
      setTimeout(() => setSuccessMsg(null), 3000);
    }, 400);
  };

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-6">
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
            <Bell className="w-5 h-5 text-amber-600" />
            <Heading level="h3" className="text-base font-bold">Notifications & Compliance Alerting</Heading>
          </div>
          <Text className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Configure automated event notifications, FSSAI renewal alerts, and customer invoice dispatch channels.
          </Text>
        </div>
        <Button
          type="submit"
          isLoading={saving}
          className="bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-1.5 shrink-0"
        >
          <Save className="w-4 h-4" /> Save Alert Settings
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Statutory Alerts */}
        <Container className="p-5 flex flex-col gap-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <Text className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              Statutory Expiry Alarms
            </Text>
          </div>

          <div className="flex flex-col gap-3">
            <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50/50 cursor-pointer">
              <div>
                <span className="text-sm font-semibold text-slate-900 dark:text-white">FSSAI 90-Day Early Warning</span>
                <p className="text-xs text-slate-500">Alert operations team 90 days before branch license expiry</p>
              </div>
              <input
                type="checkbox"
                checked={channels.fssai_expiry_90d}
                onChange={(e) => setChannels({ ...channels, fssai_expiry_90d: e.target.checked })}
                className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50/50 cursor-pointer">
              <div>
                <span className="text-sm font-semibold text-slate-900 dark:text-white">FSSAI 30-Day Critical Alarm</span>
                <p className="text-xs text-slate-500">High-priority warning when branch license has less than 30 days remaining</p>
              </div>
              <input
                type="checkbox"
                checked={channels.fssai_expiry_30d}
                onChange={(e) => setChannels({ ...channels, fssai_expiry_30d: e.target.checked })}
                className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50/50 cursor-pointer">
              <div>
                <span className="text-sm font-semibold text-slate-900 dark:text-white">Order GST Tax Invoice Dispatch</span>
                <p className="text-xs text-slate-500">Automatically send compliant PDF invoice link upon order completion</p>
              </div>
              <input
                type="checkbox"
                checked={channels.invoice_dispatch_customer}
                onChange={(e) => setChannels({ ...channels, invoice_dispatch_customer: e.target.checked })}
                className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
              />
            </label>
          </div>
        </Container>

        {/* Customer Channels */}
        <Container className="p-5 flex flex-col gap-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <MessageSquare className="w-4 h-4 text-amber-600" />
            <Text className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              Communication Gateways
            </Text>
          </div>

          <div className="flex flex-col gap-3">
            <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50/50 cursor-pointer">
              <div>
                <span className="text-sm font-semibold text-slate-900 dark:text-white">WhatsApp Business Messaging</span>
                <p className="text-xs text-slate-500">Dispatch live baking updates, OTP, and tracking links</p>
              </div>
              <input
                type="checkbox"
                checked={channels.whatsapp_enabled}
                onChange={(e) => setChannels({ ...channels, whatsapp_enabled: e.target.checked })}
                className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50/50 cursor-pointer">
              <div>
                <span className="text-sm font-semibold text-slate-900 dark:text-white">Email Notifications (SES / SendGrid)</span>
                <p className="text-xs text-slate-500">Order receipts, invoices, and statutory declarations</p>
              </div>
              <input
                type="checkbox"
                checked={channels.email_enabled}
                onChange={(e) => setChannels({ ...channels, email_enabled: e.target.checked })}
                className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50/50 cursor-pointer">
              <div>
                <span className="text-sm font-semibold text-slate-900 dark:text-white">SMS Gateway (Fast2SMS / Twilio)</span>
                <p className="text-xs text-slate-500">Fallback delivery OTP and critical driver dispatch alerts</p>
              </div>
              <input
                type="checkbox"
                checked={channels.sms_enabled}
                onChange={(e) => setChannels({ ...channels, sms_enabled: e.target.checked })}
                className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
              />
            </label>
          </div>
        </Container>
      </div>
    </form>
  );
}
