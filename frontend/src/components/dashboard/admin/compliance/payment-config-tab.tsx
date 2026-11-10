"use client";

import { useState, useEffect } from "react";
import { Container, Heading, Text, Button, Input, Label, Badge } from "@medusajs/ui";
import { 
  CreditCard, Save, CheckCircle2, AlertTriangle, ShieldCheck, 
  Activity, Key, Lock, Eye, EyeOff, RefreshCw, Zap, Archive
} from "lucide-react";

export function PaymentConfigTab({
  paymentSettings,
  onUpdated,
}: {
  paymentSettings?: any;
  onUpdated?: (updated: any) => void;
}) {
  // State for Razorpay Gateway Config
  const [environment, setEnvironment] = useState<"TEST" | "LIVE">("TEST");
  const [keyId, setKeyId] = useState("");
  const [keySecret, setKeySecret] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [hasKeySecret, setHasKeySecret] = useState(false);
  const [hasWebhookSecret, setHasWebhookSecret] = useState(false);
  const [isReplacingSecret, setIsReplacingSecret] = useState(false);
  const [isReplacingWebhookSecret, setIsReplacingWebhookSecret] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  // Status & Diagnostics
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [lastTestedAt, setLastTestedAt] = useState<string | null>(null);
  const [diagnosticResult, setDiagnosticResult] = useState<any>(null);

  // Actions Loading States
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fetch active Razorpay configuration on mount
  useEffect(() => {
    fetchRazorpayConfig();
  }, []);

  const fetchRazorpayConfig = async () => {
    setLoadingConfig(true);
    try {
      const res = await fetch("/api/v1/admin/payments/razorpay/config");
      if (res.ok) {
        const data = await res.json();
        if (data.config) {
          setEnvironment(data.config.environment || "TEST");
          setKeyId(data.config.key_id || "");
          setIsActive(data.config.is_active ?? true);
          setHasKeySecret(Boolean(data.config.has_key_secret));
          setHasWebhookSecret(Boolean(data.config.has_webhook_secret));
          setLastUpdated(data.config.updated_at || data.config.created_at || null);
          setLastTestedAt(data.config.last_tested_at || null);
          setDiagnosticResult(data.config.last_test_result || null);
        }
      }
    } catch (err: any) {
      console.error("[PaymentConfigTab] Failed to fetch Razorpay config:", err);
    } finally {
      setLoadingConfig(false);
    }
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setErrorMsg(null);
    try {
      const payload: any = { environment, key_id: keyId };
      if (isReplacingSecret && keySecret) {
        payload.key_secret = keySecret;
      }
      const res = await fetch("/api/v1/admin/payments/razorpay/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = await res.json();
      setDiagnosticResult(result);
      setLastTestedAt(result.tested_at || new Date().toISOString());
      if (result.success) {
        setSuccessMsg(`Diagnostic connection succeeded! (${result.message})`);
        setTimeout(() => setSuccessMsg(null), 5000);
      } else {
        setErrorMsg(`Diagnostic probe returned: ${result.category} - ${result.message}`);
      }
    } catch (err: any) {
      setErrorMsg("Failed to execute connection test: " + err.message);
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyId.trim()) {
      setErrorMsg("Razorpay Key ID is required.");
      return;
    }
    if (!hasKeySecret && !keySecret.trim()) {
      setErrorMsg("Razorpay Key Secret is required.");
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const payload: any = {
        provider: "razorpay",
        environment,
        key_id: keyId.trim(),
        is_active: isActive
      };
      if (keySecret.trim()) {
        payload.key_secret = keySecret.trim();
      }
      if (webhookSecret.trim()) {
        payload.webhook_secret = webhookSecret.trim();
      }

      const res = await fetch("/api/v1/admin/payments/razorpay/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.success) {
        setSuccessMsg("Razorpay credentials saved securely with AES-256-GCM authenticated encryption envelope.");
        setIsReplacingSecret(false);
        setIsReplacingWebhookSecret(false);
        setKeySecret("");
        setWebhookSecret("");
        setHasKeySecret(true);
        if (webhookSecret.trim()) setHasWebhookSecret(true);
        setLastUpdated(new Date().toISOString());
        setTimeout(() => setSuccessMsg(null), 5000);
        if (onUpdated) onUpdated({ provider: "razorpay", is_active: isActive, environment });
      } else {
        setErrorMsg(data.message || "Failed to save gateway configuration.");
      }
    } catch (err: any) {
      setErrorMsg("Failed to save configuration: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Notifications */}
      {successMsg && (
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-sm rounded-xl flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-3.5 bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-sm rounded-xl flex items-center gap-2 animate-in fade-in">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Primary Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-blue-600" />
            <Heading level="h3" className="text-base font-bold">Settings &rarr; Payment Gateway &rarr; Razorpay</Heading>
            <Badge color={isActive ? "green" : "grey"} size="small" className="gap-1">
              <ShieldCheck className="w-3 h-3" /> {isActive ? `ACTIVE (${environment} MODE)` : "INACTIVE"}
            </Badge>
          </div>
          <Text className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Configure genuine Razorpay Standard Web Checkout credentials, AES-256-GCM encryption envelope, and non-mutating diagnostics.
          </Text>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="secondary"
            onClick={handleTestConnection}
            isLoading={testingConnection}
            className="flex items-center gap-1.5 text-xs font-semibold"
          >
            <Zap className="w-3.5 h-3.5 text-blue-600" /> Test Connection
          </Button>
          <Button
            type="button"
            onClick={handleSaveConfig}
            isLoading={saving}
            className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 text-xs font-semibold"
          >
            <Save className="w-3.5 h-3.5" /> Save Settings
          </Button>
        </div>
      </div>

      {/* Decommissioning Notice */}
      <div className="p-4 bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 rounded-2xl flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <div className="text-xs text-blue-950 dark:text-blue-200 leading-relaxed">
          <span className="font-bold">Phase 9 Payment Architecture Mandate:</span> Razorpay Standard Web Checkout is the sole authoritative payment gateway for CakeToHome. Cashfree has been completely decommissioned from customer-facing checkout. Historical Cashfree accounting vouchers and audit logs are preserved immutable for statutory financial compliance.
        </div>
      </div>

      {/* Main Configuration Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Credentials Form (2 cols) */}
        <Container className="lg:col-span-2 p-6 flex flex-col gap-5">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <Text className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                Razorpay API Credentials
              </Text>
              <Text className="text-[11px] text-slate-400">
                Secrets are encrypted at rest with versioned AES-256-GCM (v1$iv$authTag$cipher).
              </Text>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-600 dark:text-slate-400">Gateway Status:</span>
              <button
                type="button"
                onClick={() => setIsActive(!isActive)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  isActive ? "bg-emerald-600" : "bg-slate-300 dark:bg-slate-700"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    isActive ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Gate E Administrative Blocker Banner */}
          <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-900 rounded-xl flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
              <span className="font-bold">Release Gate E Active (Merchant Identity & KYC Lock):</span> Live payment activation is strictly blocked until formal confirmation of merchant KYC, legal contracting entity alignment (Kerala Proprietorship vs Karnataka Pvt Ltd), and settlement bank verification. Gateway is locked to Test Mode.
            </div>
          </div>

          {/* Environment Selector */}
          <div>
            <Label className="text-xs font-semibold">Configuration Environment</Label>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <button
                type="button"
                onClick={() => setEnvironment("TEST")}
                className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all ${
                  environment === "TEST"
                    ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/30 text-blue-900 dark:text-blue-200"
                    : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <input
                  type="radio"
                  name="env_choice"
                  checked={environment === "TEST"}
                  onChange={() => setEnvironment("TEST")}
                  className="mt-0.5 text-blue-600"
                />
                <div>
                  <span className="text-xs font-bold block">Test Mode (Active Sandbox)</span>
                  <span className="text-[11px] text-slate-500">rzp_test_* credentials for verified testing</span>
                </div>
              </button>

              <button
                type="button"
                disabled={true}
                className="p-3 rounded-xl border border-amber-300 dark:border-amber-900/60 bg-amber-50/30 dark:bg-amber-950/20 text-left flex items-start gap-2.5 opacity-75 cursor-not-allowed"
                title="Live Mode is locked pending Merchant KYC and Legal Entity Alignment (Gate E)"
              >
                <input
                  type="radio"
                  name="env_choice"
                  disabled={true}
                  checked={false}
                  className="mt-0.5 text-slate-400"
                />
                <div>
                  <span className="text-xs font-bold block text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Lock className="w-3 h-3 text-amber-600" /> Live Mode (Gate E Blocked)
                  </span>
                  <span className="text-[11px] text-amber-800 dark:text-amber-400">Locked pending Merchant KYC signoff</span>
                </div>
              </button>
            </div>
          </div>

          {/* Key ID */}
          <div>
            <Label htmlFor="key_id" className="text-xs font-semibold flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-slate-500" /> Razorpay Key ID
            </Label>
            <Input
              id="key_id"
              placeholder={environment === "TEST" ? "rzp_test_..." : "rzp_live_..."}
              value={keyId}
              onChange={(e) => setKeyId(e.target.value)}
              className="mt-1 font-mono text-xs"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Public Key identifier used by checkout.js modal on storefront.
            </p>
          </div>

          {/* Key Secret */}
          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="key_secret" className="text-xs font-semibold flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-slate-500" /> Razorpay Key Secret
              </Label>
              {hasKeySecret && (
                <button
                  type="button"
                  onClick={() => setIsReplacingSecret(!isReplacingSecret)}
                  className="text-[11px] text-blue-600 hover:underline font-semibold"
                >
                  {isReplacingSecret ? "Keep Existing Secret" : "Replace Secret"}
                </button>
              )}
            </div>

            {hasKeySecret && !isReplacingSecret ? (
              <div className="mt-1 flex items-center justify-between p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 font-mono text-xs text-slate-600 dark:text-slate-300">
                <span className="tracking-widest">••••••••••••••••••••••••••••••••</span>
                <Badge color="green" size="small">Encrypted (v1)</Badge>
              </div>
            ) : (
              <div className="relative mt-1">
                <Input
                  id="key_secret"
                  type={showSecret ? "text" : "password"}
                  placeholder="Enter Razorpay Key Secret..."
                  value={keySecret}
                  onChange={(e) => setKeySecret(e.target.value)}
                  className="font-mono text-xs pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret(!showSecret)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            )}
            <p className="text-[11px] text-slate-400 mt-1">
              Secret used exclusively on backend for server-side HMAC-SHA256 signature verification.
            </p>
          </div>

          {/* Webhook Secret */}
          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="webhook_secret" className="text-xs font-semibold flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-slate-500" /> Razorpay Webhook Secret (Optional)
              </Label>
              {hasWebhookSecret && (
                <button
                  type="button"
                  onClick={() => setIsReplacingWebhookSecret(!isReplacingWebhookSecret)}
                  className="text-[11px] text-blue-600 hover:underline font-semibold"
                >
                  {isReplacingWebhookSecret ? "Keep Existing" : "Replace Webhook Secret"}
                </button>
              )}
            </div>

            {hasWebhookSecret && !isReplacingWebhookSecret ? (
              <div className="mt-1 flex items-center justify-between p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 font-mono text-xs text-slate-600 dark:text-slate-300">
                <span className="tracking-widest">••••••••••••••••••••••••</span>
                <Badge color="green" size="small">Encrypted (v1)</Badge>
              </div>
            ) : (
              <Input
                id="webhook_secret"
                type="password"
                placeholder="Enter Webhook Secret (if configured in Razorpay Dashboard)..."
                value={webhookSecret}
                onChange={(e) => setWebhookSecret(e.target.value)}
                className="mt-1 font-mono text-xs"
              />
            )}
            <p className="text-[11px] text-slate-400 mt-1">
              Authorizes incoming payment.captured and payment.failed events at /api/v1/payments/razorpay/webhook.
            </p>
          </div>
        </Container>

        {/* Diagnostics & Historical Audit (1 col) */}
        <div className="flex flex-col gap-6">
          {/* Diagnostic Probe Card */}
          <Container className="p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <Text className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-blue-600" /> Diagnostic Probe Status
              </Text>
              {diagnosticResult && (
                <Badge color={diagnosticResult.success ? "green" : "red"} size="small">
                  {diagnosticResult.category || (diagnosticResult.success ? "SUCCESS" : "FAILED")}
                </Badge>
              )}
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-xs flex flex-col gap-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Destination:</span>
                <span className="font-mono text-[11px]">api.razorpay.com</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Timeout Guard:</span>
                <span className="font-mono text-[11px]">5000ms strict</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">SSRF Protection:</span>
                <span className="text-emerald-600 font-bold text-[11px]">Hardcoded (No Redirects)</span>
              </div>
              {lastTestedAt && (
                <div className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-1.5">
                  <span className="text-slate-500">Last Probed:</span>
                  <span className="text-[11px]">{new Date(lastTestedAt).toLocaleString()}</span>
                </div>
              )}
            </div>

            {diagnosticResult && (
              <div className={`p-3 rounded-xl text-xs border ${
                diagnosticResult.success
                  ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 text-emerald-800 dark:text-emerald-300"
                  : "bg-rose-50 dark:bg-rose-950/40 border-rose-200 text-rose-800 dark:text-rose-300"
              }`}>
                <span className="font-bold block mb-0.5">{diagnosticResult.category}:</span>
                <span className="text-[11px] leading-relaxed">{diagnosticResult.message}</span>
              </div>
            )}

            <Button
              type="button"
              variant="secondary"
              onClick={handleTestConnection}
              isLoading={testingConnection}
              className="w-full mt-1 text-xs font-semibold"
            >
              Run Diagnostic Probe
            </Button>
          </Container>

          {/* Cashfree Archival Status */}
          <Container className="p-5 flex flex-col gap-3 bg-slate-50/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800">
            <Text className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
              <Archive className="w-3.5 h-3.5 text-slate-400" /> Decommissioned Gateways
            </Text>

            <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="font-bold">Cashfree Payments</span>
                <Badge color="grey" size="small">DECOMMISSIONED</Badge>
              </div>
              <p className="text-[11px] text-slate-500">
                Customer checkout disabled. 35 historical transactions preserved in double-entry ledger for statutory tax audit.
              </p>
            </div>
          </Container>
        </div>
      </div>
    </div>
  );
}
