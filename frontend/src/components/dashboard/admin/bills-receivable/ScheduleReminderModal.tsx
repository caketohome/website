"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Bell,
  Calendar,
  Mail,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
} from "lucide-react";

interface ScheduleReminderModalProps {
  invoiceId: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ScheduleReminderModal({
  invoiceId,
  onClose,
  onSuccess,
}: ScheduleReminderModalProps) {
  const [reminderDate, setReminderDate] = useState<string>(
    new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );
  const [reminderType, setReminderType] = useState<"PRE_DUE" | "DUE_DATE" | "OVERDUE">("DUE_DATE");
  const [channel, setChannel] = useState<"EMAIL" | "SMS" | "IN_APP">("EMAIL");
  const [existingReminders, setExistingReminders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingReminders, setFetchingReminders] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    async function loadReminders() {
      try {
        const res = await fetch(`/api/v1/admin/bills-receivable/${invoiceId}/reminders`).then((r) => r.json());
        if (res.success && Array.isArray(res.items)) {
          setExistingReminders(res.items);
        }
      } catch (err) {
        console.warn("Failed to load reminders:", err);
      } finally {
        setFetchingReminders(false);
      }
    }
    loadReminders();
  }, [invoiceId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`/api/v1/admin/bills-receivable/${invoiceId}/reminders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reminder_date: reminderDate,
          reminder_type: reminderType,
          channel,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || "Failed to schedule reminder.");
      }

      setSuccessMsg("Payment reminder successfully scheduled in notification pipeline.");
      setExistingReminders([data.data.notification, ...existingReminders]);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err.message || "Failed to schedule reminder");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-brand-primary/10 text-brand-primary dark:text-brand-primary">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Schedule Payment Reminder
              </h2>
              <p className="text-xs text-slate-500">Invoice ID: {invoiceId}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 text-xs rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 text-xs rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
              Scheduled Reminder Date *
            </label>
            <input
              type="date"
              value={reminderDate}
              onChange={(e) => setReminderDate(e.target.value)}
              required
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                Reminder Stage
              </label>
              <select
                value={reminderType}
                onChange={(e) => setReminderType(e.target.value as any)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-primary"
              >
                <option value="PRE_DUE">Pre-Due Reminder (3-7 days prior)</option>
                <option value="DUE_DATE">Due-Date Reminder (On due date)</option>
                <option value="OVERDUE">Overdue Escalation (Post due date)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                Channel
              </label>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value as any)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-primary"
              >
                <option value="EMAIL">Email Notification</option>
                <option value="SMS">SMS Alert</option>
                <option value="IN_APP">In-App Notification</option>
              </select>
            </div>
          </div>

          {/* Scheduled Reminders History */}
          <div className="pt-2">
            <span className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Scheduled Pipeline ({existingReminders.length})
            </span>
            {fetchingReminders ? (
              <p className="text-xs text-slate-400">Loading pipeline...</p>
            ) : existingReminders.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No reminders scheduled yet for this invoice.</p>
            ) : (
              <div className="max-h-36 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {existingReminders.map((rem: any) => (
                  <div key={rem.id} className="p-2.5 flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {rem.data?.reminder_type || rem.trigger_type} ({rem.channel})
                      </span>
                      <div className="text-[10px] text-slate-400">
                        Date: {rem.data?.scheduled_for || rem.created_at?.split("T")[0]} • To: {rem.to}
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-brand-gold-light dark:bg-brand-gold-dark/40 text-brand-gold-dark dark:text-brand-gold">
                      {rem.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-xs font-bold text-white bg-brand-primary hover:bg-brand-navy disabled:opacity-50 rounded-xl shadow-xs transition-colors"
            >
              {loading ? "Scheduling..." : "Schedule Reminder"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
