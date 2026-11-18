"use client";

import { useState } from "react";
import { Container, Heading, Text, Button, Input, Badge, Label } from "@medusajs/ui";
import { Clock, Calendar, AlertTriangle, Check, Plus, Trash2, X, ShieldAlert, Sparkles } from "lucide-react";
import { apiClient } from "@frontend/lib/api-client";

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function BranchOperationsModal({
  branch,
  onClose,
  onSaved,
}: {
  branch: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"hours" | "holidays" | "rules" | "pause">("hours");

  // Weekly Schedule State
  const [weeklySchedule, setWeeklySchedule] = useState<Record<string, any>>(
    branch.weekly_schedule || {
      Monday: { is_open: true, windows: [{ open: "09:00", close: "23:00" }], cutoff_buffer_mins: 30 },
      Tuesday: { is_open: true, windows: [{ open: "09:00", close: "23:00" }], cutoff_buffer_mins: 30 },
      Wednesday: { is_open: true, windows: [{ open: "09:00", close: "23:00" }], cutoff_buffer_mins: 30 },
      Thursday: { is_open: true, windows: [{ open: "09:00", close: "23:00" }], cutoff_buffer_mins: 30 },
      Friday: { is_open: true, windows: [{ open: "09:00", close: "23:30" }], cutoff_buffer_mins: 30 },
      Saturday: { is_open: true, windows: [{ open: "09:00", close: "23:30" }], cutoff_buffer_mins: 30 },
      Sunday: { is_open: true, windows: [{ open: "09:00", close: "23:30" }], cutoff_buffer_mins: 30 },
    }
  );

  // Holidays State
  const [holidays, setHolidays] = useState<Array<any>>(branch.holidays || []);
  const [newHolidayDate, setNewHolidayDate] = useState("");
  const [newHolidayName, setNewHolidayName] = useState("");
  const [newHolidayClosed, setNewHolidayClosed] = useState(true);

  // Fulfillment Rules State
  const [prepTime, setPrepTime] = useState(branch.fulfillment_rules?.prep_time_mins ?? 30);
  const [dispatchBuffer, setDispatchBuffer] = useState(branch.fulfillment_rules?.dispatch_buffer_mins ?? 15);
  const [maxAdvanceDays, setMaxAdvanceDays] = useState(branch.fulfillment_rules?.max_advance_days ?? 14);
  const [slotDuration, setSlotDuration] = useState(branch.fulfillment_rules?.slot_duration_mins ?? 60);
  const [slotInterval, setSlotInterval] = useState(branch.fulfillment_rules?.slot_interval_mins ?? 60);
  const [slotCapacity, setSlotCapacity] = useState(branch.fulfillment_rules?.slot_capacity ?? 15);
  const [orderCutoffTime, setOrderCutoffTime] = useState(branch.fulfillment_rules?.order_cutoff_time || branch.fulfillment_rules?.same_day_cutoff_time || "");
  const [expressEnabled, setExpressEnabled] = useState(branch.fulfillment_rules?.express_enabled ?? true);
  const [expressSurcharge, setExpressSurcharge] = useState(branch.fulfillment_rules?.express_surcharge ?? 49);
  const [expressCutoffTime, setExpressCutoffTime] = useState(branch.fulfillment_rules?.express_cutoff_time || "");
  const [midnightEnabled, setMidnightEnabled] = useState(false);
  const [midnightSurcharge, setMidnightSurcharge] = useState(0);
  const [midnightCutoffTime, setMidnightCutoffTime] = useState("");

  // Temporary Closure State
  const [isPaused, setIsPaused] = useState(Boolean(branch.temporary_closure?.is_paused));
  const [pauseReason, setPauseReason] = useState(branch.temporary_closure?.reason || "");
  const [pauseMins, setPauseMins] = useState(30);

  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleToggleDay = (day: string) => {
    setWeeklySchedule((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        is_open: !prev[day]?.is_open,
      },
    }));
  };

  const handleWindowChange = (day: string, idx: number, field: "open" | "close", val: string) => {
    setWeeklySchedule((prev) => {
      const windows = [...(prev[day]?.windows || [{ open: "09:00", close: "23:00" }])];
      windows[idx] = { ...windows[idx], [field]: val };
      return {
        ...prev,
        [day]: {
          ...prev[day],
          windows,
        },
      };
    });
  };

  const handleAddHoliday = () => {
    if (!newHolidayDate || !newHolidayName) return;
    setHolidays((prev) => [
      ...prev,
      {
        date: newHolidayDate,
        name: newHolidayName,
        is_closed: newHolidayClosed,
        reason: newHolidayClosed ? `${newHolidayName} Holiday Closure` : undefined,
      },
    ]);
    setNewHolidayDate("");
    setNewHolidayName("");
  };

  const handleRemoveHoliday = (idx: number) => {
    setHolidays((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    setSaving(true);
    setSuccessMsg(null);

    const operationsPayload = {
      weekly_schedule: weeklySchedule,
      holidays: holidays,
      fulfillment_rules: {
        ...branch.fulfillment_rules,
        prep_time_mins: Number(prepTime),
        dispatch_buffer_mins: Number(dispatchBuffer),
        max_advance_days: Number(maxAdvanceDays),
        slot_duration_mins: Number(slotDuration),
        slot_interval_mins: Number(slotInterval),
        slot_capacity: Number(slotCapacity),
        order_cutoff_time: orderCutoffTime || undefined,
        same_day_cutoff_time: orderCutoffTime || undefined,
        express_enabled: Boolean(expressEnabled),
        express_surcharge: Number(expressSurcharge),
        express_cutoff_time: expressCutoffTime || undefined,
        midnight_enabled: false,
        midnight_surcharge: 0,
        midnight_cutoff_time: undefined,
      },
      temporary_closure: {
        is_paused: isPaused,
        pause_until: isPaused ? new Date(Date.now() + pauseMins * 60000).toISOString() : null,
        reason: pauseReason || null,
        paused_at: isPaused ? new Date().toISOString() : null,
      },
    };

    try {
      await apiClient.updateBranchStoreOperations(branch.id, operationsPayload);
      setSuccessMsg("✓ Store Operations & Weekly Hours successfully persisted!");
      setTimeout(() => {
        onSaved();
        onClose();
      }, 1000);
    } catch (err: any) {
      console.error("Failed to save branch operations:", err);
      alert(err.message || "Failed to save operations");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-3xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden font-sans">
        {/* Header */}
        <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center text-xl">
              🕒
            </div>
            <div>
              <Heading level="h2" className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                Store Operations & Hours: {branch.name}
              </Heading>
              <p className="text-xs text-zinc-500">
                Branch Code: <b className="font-mono text-zinc-700 dark:text-zinc-300">{branch.code}</b> ({branch.city})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-zinc-100 dark:border-zinc-800 px-6 gap-2 bg-zinc-50/50 dark:bg-zinc-900/20 text-xs font-semibold">
          <button
            onClick={() => setActiveTab("hours")}
            className={`py-3 px-4 border-b-2 transition ${
              activeTab === "hours"
                ? "border-rose-600 text-rose-600 font-bold"
                : "border-transparent text-zinc-500 hover:text-zinc-800"
            }`}
          >
            🗓️ Weekly Operating Schedule
          </button>
          <button
            onClick={() => setActiveTab("holidays")}
            className={`py-3 px-4 border-b-2 transition ${
              activeTab === "holidays"
                ? "border-rose-600 text-rose-600 font-bold"
                : "border-transparent text-zinc-500 hover:text-zinc-800"
            }`}
          >
            🏖️ Holidays & Special Dates ({holidays.length})
          </button>
          <button
            onClick={() => setActiveTab("rules")}
            className={`py-3 px-4 border-b-2 transition ${
              activeTab === "rules"
                ? "border-rose-600 text-rose-600 font-bold"
                : "border-transparent text-zinc-500 hover:text-zinc-800"
            }`}
          >
            ⚙️ Slot & Fulfillment Engine
          </button>
          <button
            onClick={() => setActiveTab("pause")}
            className={`py-3 px-4 border-b-2 transition ${
              activeTab === "pause"
                ? "border-rose-600 text-rose-600 font-bold"
                : "border-transparent text-zinc-500 hover:text-zinc-800"
            }`}
          >
            ⏸️ Kitchen Pause / Closure
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* TAB 1: Weekly Hours */}
          {activeTab === "hours" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-rose-50/60 dark:bg-rose-950/30 p-3 rounded-2xl text-xs text-rose-900 dark:text-rose-200 border border-rose-200/50">
                <span>Configure branch open hours for checkout slot generation. Customer slots will automatically conform to these windows.</span>
              </div>

              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {DAYS_OF_WEEK.map((day) => {
                  const dayConfig = weeklySchedule[day] || { is_open: true, windows: [{ open: "09:00", close: "23:00" }] };
                  const isOpen = dayConfig.is_open !== false;
                  const win = dayConfig.windows?.[0] || { open: "09:00", close: "23:00" };

                  return (
                    <div key={day} className="py-3 flex items-center justify-between gap-4 text-xs">
                      <div className="w-28 flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isOpen}
                          onChange={() => handleToggleDay(day)}
                          className="rounded text-rose-600"
                        />
                        <span className={`font-bold ${isOpen ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-400 line-through"}`}>
                          {day}
                        </span>
                      </div>

                      {isOpen ? (
                        <div className="flex items-center gap-3 flex-1 justify-end">
                          <div className="flex items-center gap-1.5">
                            <span className="text-zinc-400">Open:</span>
                            <Input
                              type="time"
                              value={win.open}
                              onChange={(e) => handleWindowChange(day, 0, "open", e.target.value)}
                              className="w-28 text-xs py-1 px-2"
                            />
                          </div>
                          <span className="text-zinc-400">to</span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-zinc-400">Close:</span>
                            <Input
                              type="time"
                              value={win.close}
                              onChange={(e) => handleWindowChange(day, 0, "close", e.target.value)}
                              className="w-28 text-xs py-1 px-2"
                            />
                          </div>
                        </div>
                      ) : (
                        <span className="text-rose-500 font-semibold italic text-xs">Closed All Day</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: Holidays */}
          {activeTab === "holidays" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-2 items-end p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700/60">
                <div className="flex-1 w-full">
                  <Label className="text-xs font-semibold">Holiday / Special Date</Label>
                  <Input
                    type="date"
                    value={newHolidayDate}
                    onChange={(e) => setNewHolidayDate(e.target.value)}
                    className="mt-1 text-xs"
                  />
                </div>
                <div className="flex-1 w-full">
                  <Label className="text-xs font-semibold">Holiday Occasion / Reason</Label>
                  <Input
                    placeholder="e.g. Diwali Closure, Kitchen Renovation"
                    value={newHolidayName}
                    onChange={(e) => setNewHolidayName(e.target.value)}
                    className="mt-1 text-xs"
                  />
                </div>
                <Button
                  type="button"
                  onClick={handleAddHoliday}
                  disabled={!newHolidayDate || !newHolidayName}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs"
                >
                  <Plus className="w-4 h-4 mr-1" /> Add Holiday
                </Button>
              </div>

              <div className="space-y-2">
                <Heading level="h3" className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Configured Holidays & Closures
                </Heading>
                {holidays.length === 0 ? (
                  <p className="text-xs text-zinc-500 italic">No special holidays configured. Branch operates per weekly schedule.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {holidays.map((h, i) => (
                      <div
                        key={i}
                        className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-white dark:bg-zinc-900 text-xs"
                      >
                        <div>
                          <p className="font-bold text-zinc-900 dark:text-zinc-100">{h.name}</p>
                          <p className="text-[11px] text-zinc-500 font-mono">📅 {h.date}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge color="red" size="small">Full Closure</Badge>
                          <button
                            onClick={() => handleRemoveHoliday(i)}
                            className="text-zinc-400 hover:text-rose-600 p-1"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: Rules & Lead Times */}
          {activeTab === "rules" && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700/60 space-y-3">
                  <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100 block">⏱️ Slots & Cutoff Timing</span>
                  <div>
                    <Label className="text-xs">Slot Duration (Minutes)</Label>
                    <Input
                      type="number"
                      value={slotDuration}
                      onChange={(e) => setSlotDuration(Number(e.target.value))}
                      className="mt-1"
                      placeholder="60"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Slot Interval / Step (Minutes)</Label>
                    <Input
                      type="number"
                      value={slotInterval}
                      onChange={(e) => setSlotInterval(Number(e.target.value))}
                      className="mt-1"
                      placeholder="60"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Max Slot Capacity (Orders/Window)</Label>
                    <Input
                      type="number"
                      value={slotCapacity}
                      onChange={(e) => setSlotCapacity(Number(e.target.value))}
                      className="mt-1"
                      placeholder="15"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Same-Day Order Cutoff Time (Optional Override)</Label>
                    <Input
                      type="time"
                      value={orderCutoffTime}
                      onChange={(e) => setOrderCutoffTime(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700/60 space-y-3">
                  <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100 block">⚡ Express Delivery Surcharge</span>
                  <div className="flex items-center justify-between">
                    <span>⚡ Hyperlocal 45-Min Express</span>
                    <input
                      type="checkbox"
                      checked={expressEnabled}
                      onChange={(e) => setExpressEnabled(e.target.checked)}
                      className="rounded text-rose-600"
                    />
                  </div>
                  {expressEnabled && (
                    <div className="space-y-2">
                      <div>
                        <Label className="text-xs">Express Surcharge (₹)</Label>
                        <Input
                          type="number"
                          value={expressSurcharge}
                          onChange={(e) => setExpressSurcharge(Number(e.target.value))}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Express Cutoff Time (Optional Override)</Label>
                        <Input
                          type="time"
                          value={expressCutoffTime}
                          onChange={(e) => setExpressCutoffTime(e.target.value)}
                          className="mt-1"
                        />
                      </div>
                    </div>
                  )}
                  
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Temporary Kitchen Pause */}
          {activeTab === "pause" && (
            <div className="space-y-4 text-xs">
              <div className="p-4 rounded-2xl bg-brand-gold-light dark:bg-brand-gold-dark/30 border border-brand-gold/40 dark:border-brand-gold-dark/50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-brand-gold-dark dark:text-brand-gold text-sm flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-brand-gold" />
                    Temporary Kitchen Operational Pause
                  </span>
                  <input
                    type="checkbox"
                    checked={isPaused}
                    onChange={(e) => setIsPaused(e.target.checked)}
                    className="rounded text-brand-gold scale-125"
                  />
                </div>
                <p className="text-brand-gold-dark dark:text-brand-gold text-xs">
                  When paused, incoming customer checkout slots for today will display a kitchen pause message and temporarily prevent new orders from placing until resumed.
                </p>

                {isPaused && (
                  <div className="space-y-3 pt-2">
                    <div>
                      <Label className="text-xs">Customer Announcement Reason</Label>
                      <Input
                        placeholder="e.g. High order rush, short sanitization break"
                        value={pauseReason}
                        onChange={(e) => setPauseReason(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Auto-Resume After (Minutes)</Label>
                      <select
                        value={pauseMins}
                        onChange={(e) => setPauseMins(Number(e.target.value))}
                        className="w-full p-2 rounded-lg border text-xs bg-white dark:bg-black mt-1"
                      >
                        <option value={15}>15 Minutes</option>
                        <option value={30}>30 Minutes</option>
                        <option value={60}>60 Minutes (1 Hour)</option>
                        <option value={120}>120 Minutes (2 Hours)</option>
                        <option value={9999}>Indefinite (Manual Resume)</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2">
              <Check className="w-4 h-4" /> {successMsg}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50">
          <Button variant="secondary" onClick={onClose} className="rounded-xl">
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            isLoading={saving}
            className="bg-rose-600 hover:bg-rose-700 text-white font-bold px-6 py-2.5 rounded-xl shadow-lg shadow-rose-600/20"
          >
            Persist Store Operations
          </Button>
        </div>
      </div>
    </div>
  );
}
