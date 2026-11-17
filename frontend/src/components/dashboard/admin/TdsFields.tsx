"use client";

import { TDS_SECTIONS } from "@frontend/lib/accounting/tds";

/**
 * Optional TDS inputs for a payment or receipt. "No TDS" by default; the amount field only
 * appears once a section is chosen. Shows the net that actually moves through bank/cash.
 */
export function TdsFields({
  section,
  amount,
  onSectionChange,
  onAmountChange,
  grossAmount,
  netLabel,
}: {
  section: string;
  amount: string;
  onSectionChange: (v: string) => void;
  onAmountChange: (v: string) => void;
  grossAmount: number;
  netLabel: string;
}) {
  const tds = section ? Math.max(0, parseFloat(amount) || 0) : 0;
  const net = Math.max(0, Math.round((grossAmount - tds) * 100) / 100);
  const inputCls =
    "w-full px-3 py-2 text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800/60 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-primary";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div>
        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">TDS section</label>
        <select
          value={section}
          onChange={(e) => {
            onSectionChange(e.target.value);
            if (!e.target.value) onAmountChange("");
          }}
          className={inputCls}
        >
          <option value="">No TDS</option>
          {Object.entries(TDS_SECTIONS).map(([code, label]) => (
            <option key={code} value={code}>
              {code} — {label}
            </option>
          ))}
        </select>
      </div>
      {section && (
        <div>
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">TDS amount (₹)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => onAmountChange(e.target.value)}
            className={inputCls}
            placeholder="0.00"
          />
        </div>
      )}
      {section && tds > 0 && (
        <p className="sm:col-span-2 text-[11px] text-zinc-600 dark:text-zinc-400">
          {netLabel}: <span className="font-semibold">₹{net.toFixed(2)}</span> (₹{grossAmount.toFixed(2)} settled − ₹{tds.toFixed(2)} TDS u/s {section})
        </p>
      )}
    </div>
  );
}
