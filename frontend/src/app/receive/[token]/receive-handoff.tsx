"use client";

import { useCallback, useEffect, useState } from "react";
import { OtpLoginForm } from "@frontend/components/store/auth/otp-login-form";

interface Info {
  order_number: string;
  branch_name: string;
  rider_name: string;
  signed_in: boolean;
  already_confirmed: boolean;
  delivered: boolean;
}
interface Result { received_safely: boolean; delivery_otp?: string; gift_message?: string; care_note?: string }

export function ReceiveHandoff({ token }: { token: string }) {
  const [info, setInfo] = useState<Info | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [problemMode, setProblemMode] = useState(false);
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/v1/receive/${encodeURIComponent(token)}`, { cache: "no-store", credentials: "same-origin" });
      const j = await r.json();
      if (!r.ok || !j.success) throw new Error(j.error || "This QR code is not valid.");
      setInfo(j);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const confirm = async (safe: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/v1/receive/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ received_safely: safe, problem: safe ? undefined : problem }),
      });
      const j = await r.json();
      if (!r.ok || !j.success) throw new Error(j.error || `HTTP ${r.status}`);
      setResult(j);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-[100dvh] bg-white dark:bg-slate-950 flex flex-col" style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="flex-1 w-full max-w-md mx-auto px-5 py-8 flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Receive your cake</h1>
          {info && (
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Order #{info.order_number}{info.branch_name ? ` from ${info.branch_name}` : ""}{info.rider_name ? ` · rider ${info.rider_name}` : ""}
            </p>
          )}
        </div>

        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-sm p-4">{error}</div>}

        {info?.delivered && !result && (
          <div className="rounded-xl border border-slate-200 p-4 text-sm text-slate-700">This order has already been delivered.</div>
        )}

        {/* Step 1: sign in with your own phone */}
        {info && !info.delivered && !info.signed_in && !result && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-slate-700 dark:text-slate-300">Sign in with your mobile number to confirm you received the cake.</p>
            <div className="[&_input]:text-lg [&_input]:min-h-[52px] [&_button[type=submit]]:min-h-[52px]">
              <OtpLoginForm redirectUrl={`/receive/${token}`} onSuccess={() => setTimeout(load, 300)} />
            </div>
          </div>
        )}

        {/* Step 2: confirm condition */}
        {info && !info.delivered && info.signed_in && !result && !problemMode && (
          <div className="flex flex-col gap-4">
            <p className="text-base text-slate-800 dark:text-slate-200">Please check the cake. Did it arrive safely and in good condition?</p>
            <button type="button" disabled={busy} onClick={() => confirm(true)} className="w-full min-h-[56px] rounded-xl bg-emerald-600 text-white text-base font-semibold disabled:opacity-50">
              {busy ? "Please wait…" : "Yes, I received it safely"}
            </button>
            <button type="button" disabled={busy} onClick={() => setProblemMode(true)} className="w-full min-h-[52px] rounded-xl border border-slate-300 text-slate-800 dark:text-slate-200 text-base">
              There is a problem
            </button>
          </div>
        )}

        {problemMode && !result && (
          <div className="flex flex-col gap-3">
            <label className="text-sm text-slate-700 dark:text-slate-300" htmlFor="problem">What is wrong with the cake?</label>
            <textarea id="problem" value={problem} onChange={(e) => setProblem(e.target.value)} rows={3}
              className="w-full rounded-xl border border-slate-300 bg-transparent p-3 text-base" placeholder="e.g. box crushed, wrong cake" />
            <button type="button" disabled={busy || !problem.trim()} onClick={() => confirm(false)} className="w-full min-h-[52px] rounded-xl bg-rose-600 text-white text-base font-semibold disabled:opacity-50">
              Report problem
            </button>
            <button type="button" onClick={() => setProblemMode(false)} className="text-sm text-slate-500">Back</button>
          </div>
        )}

        {/* Step 3: code + message + care note (only after safe receipt) */}
        {result?.received_safely && (
          <div className="flex flex-col gap-5">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 p-5 text-center">
              <div className="text-sm text-emerald-800 dark:text-emerald-300">Tell this code to the rider</div>
              <div className="mt-2 text-5xl font-bold tracking-[0.3em] text-emerald-900 dark:text-emerald-200 font-mono">{result.delivery_otp}</div>
            </div>
            {result.gift_message && (
              <div className="rounded-2xl border border-slate-200 p-5">
                <div className="text-xs uppercase tracking-wide text-slate-500">Message for you</div>
                <p className="mt-2 text-base text-slate-900 dark:text-white whitespace-pre-line">{result.gift_message}</p>
              </div>
            )}
            {result.care_note && (
              <div className="rounded-2xl bg-sky-50 dark:bg-sky-950/30 border border-sky-200 p-4 text-sm text-sky-900 dark:text-sky-200">{result.care_note}</div>
            )}
          </div>
        )}

        {result && !result.received_safely && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Thanks for telling us. The branch has been alerted and will contact you. Do not give a delivery code to the rider.
          </div>
        )}
      </div>
    </main>
  );
}
