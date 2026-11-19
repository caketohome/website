"use client";

import { useState, useEffect, useCallback } from "react";
import { Container, Heading, Text, Button, Input, Label, Badge } from "@medusajs/ui";
import { CreditCard, CheckCircle2, AlertTriangle, ShieldCheck, Activity, Key, Lock, Eye, EyeOff, Zap } from "lucide-react";

type Env = "TEST" | "LIVE";
type EnvStatus = "NOT_CONFIGURED" | "UNTESTED" | "VERIFIED" | "FAILED";
interface EnvConfig {
  environment: Env;
  configured: boolean;
  key_id: string;
  has_key_secret: boolean;
  has_webhook_secret: boolean;
  status: EnvStatus;
  last_tested_at: string | null;
  last_test_result: { success: boolean; category?: string; message?: string } | null;
  updated_at: string | null;
  is_active: boolean;
}
interface GatewayConfig {
  active_environment: Env | null;
  live_operational: boolean;
  kyc_status: string;
  settlement_status: string;
  environments: Record<Env, EnvConfig>;
}
interface Draft { keyId: string; keySecret: string; webhookSecret: string; replaceSecret: boolean; replaceWebhook: boolean; show: boolean }

const emptyDraft = (keyId = ""): Draft => ({ keyId, keySecret: "", webhookSecret: "", replaceSecret: false, replaceWebhook: false, show: false });
const LABEL: Record<Env, string> = { TEST: "Test Mode", LIVE: "Live Mode" };
const STATUS_BADGE: Record<EnvStatus, { color: "grey" | "green" | "red" | "orange"; text: string }> = {
  NOT_CONFIGURED: { color: "grey", text: "Not configured" },
  UNTESTED: { color: "orange", text: "Configured, not tested" },
  VERIFIED: { color: "green", text: "Authenticated with Razorpay" },
  FAILED: { color: "red", text: "Last probe failed" }
};

export function PaymentConfigTab({
  onUpdated,
}: {
  paymentSettings?: any;
  onUpdated?: (updated: any) => void;
}) {
  const [cfg, setCfg] = useState<GatewayConfig | null>(null);
  const [drafts, setDrafts] = useState<Record<Env, Draft>>({ TEST: emptyDraft(), LIVE: emptyDraft() });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null); // "save:TEST" | "probe:LIVE" | "activate:LIVE"
  const [confirmActivate, setConfirmActivate] = useState<Env | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const applyConfig = useCallback((c: GatewayConfig) => {
    setCfg(c);
    setDrafts({ TEST: emptyDraft(c.environments.TEST.key_id), LIVE: emptyDraft(c.environments.LIVE.key_id) });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/v1/admin/payments/razorpay/config");
      const data = await res.json().catch(() => ({}));
      if (res.status === 401 || res.status === 403) setErr("You are not authorized to view or change payment settings.");
      else if (!res.ok || !data.success) setErr(data.message || "Payment configuration could not be loaded.");
      else applyConfig(data.config);
    } catch {
      setErr("Payment configuration could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [applyConfig]);

  useEffect(() => { load(); }, [load]);

  const setDraft = (env: Env, patch: Partial<Draft>) => setDrafts((d) => ({ ...d, [env]: { ...d[env], ...patch } }));
  const isDirty = (env: Env) => {
    if (!cfg) return false;
    const d = drafts[env];
    return d.keyId.trim() !== cfg.environments[env].key_id || Boolean(d.keySecret.trim()) || Boolean(d.webhookSecret.trim());
  };

  const post = async (url: string, body: any, busyKey: string) => {
    if (busy) return null; // block duplicate submissions
    setBusy(busyKey);
    setOk(null);
    setErr(null);
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401 || res.status === 403) { setErr("You are not authorized to change payment settings."); return null; }
      return { res, data };
    } catch {
      setErr("The request failed. Nothing was changed.");
      return null;
    } finally {
      setBusy(null);
    }
  };

  const save = async (env: Env) => {
    const d = drafts[env];
    const body: any = { action: "save", environment: env, expected_updated_at: cfg?.environments[env].updated_at };
    if (d.keyId.trim()) body.key_id = d.keyId.trim();
    if (d.keySecret.trim()) body.key_secret = d.keySecret.trim();
    if (d.webhookSecret.trim()) body.webhook_secret = d.webhookSecret.trim();
    const r = await post("/api/v1/admin/payments/razorpay/config", body, `save:${env}`);
    if (!r) return;
    if (r.data.success) {
      applyConfig(r.data.config);
      setOk(`${LABEL[env]} credentials saved. Run Test Connection to verify them.`);
      onUpdated?.({ provider: "razorpay", environment: r.data.config.active_environment });
    } else setErr(r.data.message || "Configuration could not be saved.");
    if (r.data.error === "STALE_CONFIG") load();
  };

  const probe = async (env: Env) => {
    const r = await post("/api/v1/admin/payments/razorpay/test-connection", { environment: env }, `probe:${env}`);
    if (!r) return;
    const result = r.data;
    await load();
    if (result.success) setOk(`${LABEL[env]}: ${result.message}`);
    else setErr(`${LABEL[env]}: ${result.category || "FAILED"} - ${result.message || "Connection test failed."}`);
  };

  const activate = async (env: Env) => {
    setConfirmActivate(null);
    const r = await post("/api/v1/admin/payments/razorpay/config", { action: "activate", environment: env }, `activate:${env}`);
    if (!r) return;
    if (r.data.success) {
      applyConfig(r.data.config);
      const verified = r.data.config.environments[env].status === "VERIFIED";
      setOk(env === "LIVE" && !verified
        ? "Live Mode selected, but live payments are NOT operational until the Live credentials pass Test Connection."
        : `${LABEL[env]} is now the active environment.`);
      onUpdated?.({ provider: "razorpay", environment: env });
    } else setErr(r.data.message || "The environment could not be changed.");
  };

  const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : "never");

  const renderEnv = (env: Env) => {
    const c = cfg!.environments[env];
    const d = drafts[env];
    const isActive = cfg!.active_environment === env;
    const st = STATUS_BADGE[c.status];
    const pfx = env.toLowerCase();
    const secretInput = c.has_key_secret && !d.replaceSecret;
    const hookInput = c.has_webhook_secret && !d.replaceWebhook;
    return (
      <Container key={env} className="p-6 flex flex-col gap-4" aria-labelledby={`env-${pfx}`}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Text id={`env-${pfx}`} className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">{LABEL[env]} credentials</Text>
            {isActive && <Badge color="green" size="small">ACTIVE</Badge>}
          </div>
          <Badge color={st.color} size="small">{st.text}</Badge>
        </div>

        <div>
          <Label htmlFor={`${pfx}_key_id`} className="text-xs font-semibold flex items-center gap-1.5"><Key className="w-3.5 h-3.5 text-slate-500" /> Key ID</Label>
          <Input id={`${pfx}_key_id`} value={d.keyId} placeholder={`rzp_${pfx}_...`} autoComplete="off"
            onChange={(e) => setDraft(env, { keyId: e.target.value })} className="mt-1 font-mono text-xs" />
          <p className="text-[11px] text-slate-400 mt-1">Public identifier; the only value sent to the storefront checkout.</p>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor={`${pfx}_key_secret`} className="text-xs font-semibold flex items-center gap-1.5"><Lock className="w-3.5 h-3.5 text-slate-500" /> Key Secret</Label>
            {c.has_key_secret && (
              <button type="button" className="text-[11px] text-blue-600 hover:underline font-semibold"
                onClick={() => setDraft(env, { replaceSecret: !d.replaceSecret, keySecret: "" })}>
                {d.replaceSecret ? "Keep existing" : "Replace secret"}
              </button>
            )}
          </div>
          {secretInput ? (
            <div className="mt-1 flex items-center justify-between p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-xs">
              <span className="tracking-widest font-mono">••••••••••••••••</span><Badge color="green" size="small">Configured</Badge>
            </div>
          ) : (
            <div className="relative mt-1">
              <Input id={`${pfx}_key_secret`} type={d.show ? "text" : "password"} autoComplete="new-password" value={d.keySecret}
                placeholder="Enter Key Secret" onChange={(e) => setDraft(env, { keySecret: e.target.value })} className="font-mono text-xs pr-10" />
              <button type="button" aria-label={d.show ? "Hide secret" : "Show secret"} onClick={() => setDraft(env, { show: !d.show })}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600">{d.show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
            </div>
          )}
          <p className="text-[11px] text-slate-400 mt-1">Server-side only. Leave unchanged to keep the stored secret.</p>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor={`${pfx}_webhook_secret`} className="text-xs font-semibold flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-slate-500" /> Webhook Secret</Label>
            {c.has_webhook_secret && (
              <button type="button" className="text-[11px] text-blue-600 hover:underline font-semibold"
                onClick={() => setDraft(env, { replaceWebhook: !d.replaceWebhook, webhookSecret: "" })}>
                {d.replaceWebhook ? "Keep existing" : "Replace webhook secret"}
              </button>
            )}
          </div>
          {hookInput ? (
            <div className="mt-1 flex items-center justify-between p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-xs">
              <span className="tracking-widest font-mono">••••••••••••</span><Badge color="green" size="small">Configured</Badge>
            </div>
          ) : (
            <Input id={`${pfx}_webhook_secret`} type="password" autoComplete="new-password" value={d.webhookSecret}
              placeholder="Enter Webhook Secret" onChange={(e) => setDraft(env, { webhookSecret: e.target.value })} className="mt-1 font-mono text-xs" />
          )}
          <p className="text-[11px] text-slate-400 mt-1">Validates incoming Razorpay webhook signatures for this environment.</p>
        </div>

        <div className="text-[11px] text-slate-500 flex flex-col gap-0.5" aria-live="polite">
          <span>Last updated: {fmt(c.updated_at)}</span>
          <span>Last connection test: {fmt(c.last_tested_at)}{c.last_test_result ? ` - ${c.last_test_result.success ? "authenticated" : c.last_test_result.category}` : ""}</span>
          {isDirty(env) && <span className="text-brand-gold-dark font-semibold">Unsaved changes</span>}
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <Button type="button" size="small" onClick={() => save(env)} isLoading={busy === `save:${env}`} disabled={!!busy || !isDirty(env)}>Save {LABEL[env]} credentials</Button>
          <Button type="button" size="small" variant="secondary" onClick={() => probe(env)} isLoading={busy === `probe:${env}`} disabled={!!busy || !c.configured || isDirty(env)}>
            <Zap className="w-3.5 h-3.5 text-blue-600" /> Test connection
          </Button>
          <Button type="button" size="small" variant="secondary" onClick={() => setConfirmActivate(env)} disabled={!!busy || !c.configured || isActive || isDirty(env)}>
            Activate {LABEL[env]}
          </Button>
        </div>

        {confirmActivate === env && (
          <div role="alertdialog" aria-label={`Confirm activating ${LABEL[env]}`} className="p-3 rounded-xl border border-brand-gold/40 bg-brand-gold-light dark:bg-brand-gold-dark/40 text-xs flex flex-col gap-2">
            <span>
              Switch the active payment environment to <strong>{LABEL[env]}</strong>? New checkouts will use {env === "LIVE" ? "Live credentials and real money" : "Test credentials"}.
              {env === "LIVE" && c.status !== "VERIFIED" && " Live payments stay blocked until the Live credentials pass Test Connection."}
            </span>
            <div className="flex gap-2">
              <Button type="button" size="small" onClick={() => activate(env)}>Yes, activate</Button>
              <Button type="button" size="small" variant="secondary" onClick={() => setConfirmActivate(null)}>Cancel</Button>
            </div>
          </div>
        )}
      </Container>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <div aria-live="polite" className="flex flex-col gap-2">
        {ok && (
          <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-sm rounded-xl flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /><span>{ok}</span>
          </div>
        )}
        {err && (
          <div role="alert" className="p-3.5 bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-sm rounded-xl flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" /><span>{err}</span>
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <CreditCard className="w-5 h-5 text-blue-600" />
            <Heading level="h3" className="text-base font-bold">Settings &rarr; Payment Gateway &rarr; Razorpay</Heading>
            {cfg && (
              <Badge color={cfg.active_environment ? "green" : "grey"} size="small" className="gap-1">
                <ShieldCheck className="w-3 h-3" /> {cfg.active_environment ? `ACTIVE: ${LABEL[cfg.active_environment].toUpperCase()}` : "NO ACTIVE ENVIRONMENT"}
              </Badge>
            )}
          </div>
          <Text className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Test and Live credentials are stored separately and encrypted at rest. Changes apply immediately, with no redeploy.
          </Text>
        </div>
      </div>

      {loading && <Text className="text-sm text-slate-500">Loading payment configuration...</Text>}

      {cfg && (
        <>
          <div className="p-4 bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 rounded-2xl flex items-start gap-3">
            <Activity className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-xs text-blue-950 dark:text-blue-200 leading-relaxed flex flex-col gap-1">
              <span><span className="font-bold">Live readiness.</span> {cfg.live_operational
                ? "Live is active and its credentials authenticated with Razorpay."
                : "Live payments are not operational yet."} A successful connection test proves the Key ID and Secret work. It does <strong>not</strong> prove the merchant account is approved for live payments.</span>
              <span>Merchant KYC: <strong>not verified by this application</strong>. Settlement bank: <strong>not verified by this application</strong>. Confirm both in the Razorpay Dashboard.</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {renderEnv("TEST")}
            {renderEnv("LIVE")}
          </div>
        </>
      )}

    </div>
  );
}
