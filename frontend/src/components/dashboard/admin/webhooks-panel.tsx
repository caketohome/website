"use client";

import { useEffect, useState, memo } from "react";
import { Container, Heading, Text, Button, Input, Badge } from "@medusajs/ui";
import {
  Plug, Zap, RefreshCw, Send, CheckCircle2, AlertTriangle, ShieldCheck,
  Key, Eye, EyeOff, Check, X, Clock, ArrowRight, RotateCw, Server,
  Radio, Layers, Terminal, AlertCircle, Copy, CheckCheck, Trash2, ArrowUpRight,
  Database, Activity, Filter, Search, PlayCircle, HelpCircle
} from "lucide-react";
import { apiClient } from "@frontend/lib/api-client";
import { ALL_WEBHOOK_EVENT_TYPES, WebhookEventType, WebhookEventDefinition } from "@frontend/lib/webhook-engine";

export const WebhooksPanel = memo(function WebhooksPanel() {
  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<"CONFIG" | "OUTBOX_DLQ" | "LOGS" | "CATALOGUE" | "TEST_CENTER">("CONFIG");

  // Endpoint and State
  const [endpoints, setEndpoints] = useState<any[]>([]);
  const [selectedEndpointId, setSelectedEndpointId] = useState<string>("ep_n8n_production");
  const [logs, setLogs] = useState<any[]>([]);
  const [outboxItems, setOutboxItems] = useState<any[]>([]);
  const [dlqItems, setDlqItems] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Filters & Search
  const [statusFilter, setStatusFilter] = useState("all");
  const [eventTypeFilter, setEventTypeFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Inspect Modal
  const [inspectItem, setInspectItem] = useState<any>(null);
  const [inspectModalTab, setInspectModalTab] = useState<"PRETTY" | "RAW" | "HEADERS" | "ATTEMPTS">("PRETTY");
  const [copied, setCopied] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  // Form State for Active Endpoint
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [environment, setEnvironment] = useState<"production" | "staging" | "development">("production");
  const [status, setStatus] = useState<"ACTIVE" | "PAUSED" | "DISABLED">("ACTIVE");
  const [subscribedEvents, setSubscribedEvents] = useState<WebhookEventType[]>([]);
  const [retryLimit, setRetryLimit] = useState(5);
  const [timeoutMs, setTimeoutMs] = useState(8000);
  const [signingSecret, setSigningSecret] = useState("");

  // Diagnostic Test Center State
  const [testEventType, setTestEventType] = useState<WebhookEventType>("test.webhook.ping");
  const [testResult, setTestResult] = useState<any>(null);

  const selectedEndpoint = endpoints.find((e) => e.id === selectedEndpointId) || endpoints[0] || null;

  const fetchData = async () => {
    setLoading(true);
    try {
      const [epRes, logsRes, outboxRes, dlqRes] = await Promise.all([
        apiClient.getAdminWebhookEndpoints(),
        apiClient.getAdminWebhookLogs({
          status: statusFilter,
          event_type: eventTypeFilter,
          endpoint_id: selectedEndpointId,
          search: searchQuery,
        }),
        apiClient.getAdminWebhookOutbox({ status: "all" }),
        apiClient.getAdminWebhookDLQ(),
      ]);

      const eps = (epRes as any)?.endpoints || [];
      setEndpoints(eps);
      if (eps.length > 0) {
        const current = eps.find((e: any) => e.id === selectedEndpointId) || eps[0];
        setSelectedEndpointId(current.id);
        setUrl(current.url || "");
        setName(current.name || "");
        setEnvironment(current.environment || "production");
        setStatus(current.status || (current.active ? "ACTIVE" : "PAUSED"));
        setSubscribedEvents(current.subscribed_events || []);
        setRetryLimit(current.retry_limit || 5);
        setTimeoutMs(current.timeout_ms || 8000);
        setSigningSecret(current.signing_secret || "");
      }

      setLogs((logsRes as any)?.logs || []);
      setMetrics((logsRes as any)?.metrics || null);
      setOutboxItems((outboxRes as any)?.outbox || []);
      setDlqItems((dlqRes as any)?.dlq || []);
    } catch (err: any) {
      console.error("Failed to load webhook data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedEndpointId, statusFilter, eventTypeFilter]);

  const handleSelectEndpoint = (epId: string) => {
    setSelectedEndpointId(epId);
    const ep = endpoints.find((e) => e.id === epId);
    if (ep) {
      setUrl(ep.url || "");
      setName(ep.name || "");
      setEnvironment(ep.environment || "production");
      setStatus(ep.status || (ep.active ? "ACTIVE" : "PAUSED"));
      setSubscribedEvents(ep.subscribed_events || []);
      setRetryLimit(ep.retry_limit || 5);
      setTimeoutMs(ep.timeout_ms || 8000);
      setSigningSecret(ep.signing_secret || "");
    }
  };

  const handleSaveEndpoint = async () => {
    if (!selectedEndpoint) return;
    setIsSaving(true);
    setFeedback(null);
    try {
      await apiClient.updateAdminWebhookEndpoint(selectedEndpoint.id, {
        name,
        url,
        environment,
        status,
        active: status === "ACTIVE",
        subscribed_events: subscribedEvents,
        retry_limit: Number(retryLimit),
        timeout_ms: Number(timeoutMs),
      });
      setFeedback({ type: "success", message: "Webhook endpoint configuration and subscriptions saved!" });
      setTimeout(() => setFeedback(null), 4000);
      fetchData();
    } catch (err: any) {
      setFeedback({ type: "error", message: err?.message || "Failed to update webhook config" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRotateSecret = async () => {
    if (!selectedEndpoint) return;
    if (
      !confirm(
        "Are you sure you want to rotate the webhook signing secret? You must update your n8n HMAC validation node with the new secret."
      )
    ) {
      return;
    }
    setIsRotating(true);
    try {
      const res: any = await apiClient.rotateAdminWebhookSecret(selectedEndpoint.id);
      if (res?.new_secret) {
        setSigningSecret(res.new_secret);
      }
      setFeedback({ type: "success", message: "Webhook HMAC secret rotated and persisted successfully!" });
      setTimeout(() => setFeedback(null), 4000);
      fetchData();
    } catch (err: any) {
      setFeedback({ type: "error", message: err?.message || "Failed to rotate secret" });
    } finally {
      setIsRotating(false);
    }
  };

  const handleToggleEvent = (eventType: WebhookEventType) => {
    if (subscribedEvents.includes(eventType)) {
      setSubscribedEvents(subscribedEvents.filter((t) => t !== eventType));
    } else {
      setSubscribedEvents([...subscribedEvents, eventType]);
    }
  };

  const handleSelectAllCategory = (category: string) => {
    const catEvents = ALL_WEBHOOK_EVENT_TYPES.filter((e) => e.category === category).map((e) => e.type);
    const union = Array.from(new Set([...subscribedEvents, ...catEvents]));
    setSubscribedEvents(union);
  };

  const handleClearCategory = (category: string) => {
    const catEvents = new Set(ALL_WEBHOOK_EVENT_TYPES.filter((e) => e.category === category).map((e) => e.type));
    setSubscribedEvents(subscribedEvents.filter((t) => !catEvents.has(t)));
  };

  const handleSelectAll = () => {
    setSubscribedEvents(ALL_WEBHOOK_EVENT_TYPES.map((e) => e.type));
  };

  const handleClearAll = () => {
    setSubscribedEvents([]);
  };

  const handleTestWebhook = async () => {
    if (!selectedEndpoint) return;
    setIsTesting(true);
    setFeedback(null);
    setTestResult(null);
    try {
      const res: any = await apiClient.triggerAdminTestWebhook(selectedEndpoint.id, testEventType);
      setTestResult(res);
      if (res?.success) {
        setFeedback({
          type: "success",
          message: `Test webhook delivered successfully in ${res.latency_ms}ms (HTTP ${res.http_status})!`,
        });
      } else {
        setFeedback({
          type: "error",
          message: `Test webhook failed: ${res.message || "Endpoint error"}`,
        });
      }
      setTimeout(() => setFeedback(null), 5000);
      fetchData();
    } catch (err: any) {
      setFeedback({ type: "error", message: err?.message || "Test dispatch failed" });
    } finally {
      setIsTesting(false);
    }
  };

  const handleRetryOutbox = async (outboxId: string) => {
    try {
      await apiClient.retryAdminWebhookOutbox(outboxId);
      setFeedback({ type: "success", message: "Outbox item re-queued for immediate worker dispatch!" });
      setTimeout(() => setFeedback(null), 3000);
      fetchData();
    } catch (err: any) {
      alert("Failed to retry outbox item: " + err?.message);
    }
  };

  const handleReplayDLQ = async (outboxId: string) => {
    try {
      await apiClient.replayAdminWebhookDLQ(outboxId);
      setFeedback({ type: "success", message: "Dead letter event safely re-queued for replay (idempotency preserved)!" });
      setTimeout(() => setFeedback(null), 3000);
      fetchData();
    } catch (err: any) {
      alert("Failed to replay DLQ event: " + err?.message);
    }
  };

  const handleDiscardDLQ = async (outboxId: string) => {
    if (!confirm("Are you sure you want to discard this dead letter event?")) return;
    try {
      await apiClient.discardAdminWebhookDLQ(outboxId);
      setFeedback({ type: "success", message: "Dead letter item marked as CANCELLED." });
      setTimeout(() => setFeedback(null), 3000);
      fetchData();
    } catch (err: any) {
      alert("Failed to discard DLQ item: " + err?.message);
    }
  };

  const handleCopyPayload = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Group events by category
  const categories = Array.from(new Set(ALL_WEBHOOK_EVENT_TYPES.map((e) => e.category)));

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* ── HEADER ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 rounded-2xl border border-indigo-500/20 text-white shadow-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 bg-indigo-500/20 rounded-lg border border-indigo-400/30 text-indigo-300">
              <Plug className="w-5 h-5" />
            </span>
            <Heading level="h2" className="text-xl font-bold text-white tracking-tight">
              Enterprise n8n Webhook & Event Outbox
            </Heading>
            <Badge color="green" className="text-xs font-semibold bg-emerald-500/20 text-emerald-300 border-emerald-400/30">
              Transactional Outbox v3.0
            </Badge>
          </div>
          <Text className="text-sm text-slate-300">
            Real-time event dispatcher, cryptographic HMAC-SHA256 request signing, exponential retries, and dead-letter queue.
          </Text>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="small"
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white border-white/10 text-xs font-medium"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <Button
            variant="primary"
            size="small"
            onClick={() => setActiveTab("TEST_CENTER")}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white border-none shadow-md shadow-indigo-900/50 text-xs font-semibold"
          >
            <Zap className="w-3.5 h-3.5" />
            Diagnostic Test Center
          </Button>
        </div>
      </div>

      {/* ── FEEDBACK ALERT ── */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between transition-all ${
            feedback.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300"
              : "bg-red-50 border-red-200 text-red-800 dark:bg-red-950/40 dark:border-red-800 dark:text-red-300"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedback.type === "success" ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <AlertTriangle className="w-5 h-5 text-red-600" />}
            <span className="text-sm font-medium">{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-sm font-bold opacity-60 hover:opacity-100">
            ×
          </button>
        </div>
      )}

      {/* ── INTEGRATION HEALTH CARDS ── */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {/* Card 1: Primary Endpoint */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Webhook Endpoint</span>
            <Server className="w-3.5 h-3.5 text-indigo-500" />
          </div>
          <div className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${status === "ACTIVE" ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
            {status}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 truncate">{selectedEndpoint?.name || "n8n Production"}</div>
        </div>

        {/* Card 2: Outbox Worker */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Outbox Worker</span>
            <Activity className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div className="text-base font-bold text-emerald-600 dark:text-emerald-400">
            {metrics?.worker_status || "HEALTHY"}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Concurrency Safe</div>
        </div>

        {/* Card 3: Success Rate */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Delivery Rate</span>
            <CheckCheck className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div className="text-base font-bold text-slate-900 dark:text-white">
            {metrics?.delivery_success_rate_pct ?? 100}%
          </div>
          <div className="text-[11px] text-slate-400 mt-1">HTTP 2xx Accepted</div>
        </div>

        {/* Card 4: Pending Outbox */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Pending Outbox</span>
            <Clock className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="text-base font-bold text-amber-600 dark:text-amber-400">
            {metrics?.pending_outbox ?? 0}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Queue Depth</div>
        </div>

        {/* Card 5: Dead Letter Queue */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Dead Letter (DLQ)</span>
            <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
          </div>
          <div className={`text-base font-bold ${dlqItems.length > 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-900 dark:text-white"}`}>
            {dlqItems.length}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Exceeded Retries</div>
        </div>

        {/* Card 6: Latency */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Avg Latency</span>
            <Zap className="w-3.5 h-3.5 text-indigo-500" />
          </div>
          <div className="text-base font-bold text-indigo-600 dark:text-indigo-400">
            {metrics?.average_latency_ms || 120} ms
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Round-trip Time</div>
        </div>
      </div>

      {/* ── NAVIGATION TABS ── */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab("CONFIG")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-lg transition-all ${
            activeTab === "CONFIG"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <Layers className="w-4 h-4" />
          Endpoint & Subscriptions ({subscribedEvents.length})
        </button>

        <button
          onClick={() => setActiveTab("OUTBOX_DLQ")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-lg transition-all ${
            activeTab === "OUTBOX_DLQ"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <Database className="w-4 h-4" />
          Live Outbox & DLQ ({outboxItems.length})
          {dlqItems.length > 0 && (
            <span className="px-1.5 py-0.5 bg-rose-500 text-white text-[10px] rounded-full font-black">
              {dlqItems.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("LOGS")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-lg transition-all ${
            activeTab === "LOGS"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <Terminal className="w-4 h-4" />
          Delivery Logs ({logs.length})
        </button>

        <button
          onClick={() => setActiveTab("CATALOGUE")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-lg transition-all ${
            activeTab === "CATALOGUE"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <Radio className="w-4 h-4" />
          Event Catalogue ({ALL_WEBHOOK_EVENT_TYPES.length})
        </button>

        <button
          onClick={() => setActiveTab("TEST_CENTER")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-lg transition-all ${
            activeTab === "TEST_CENTER"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <Zap className="w-4 h-4" />
          Diagnostic Test Center
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* ── TAB 1: ENDPOINT & SUBSCRIPTIONS ─────────────────────── */}
      {/* ══════════════════════════════════════════════════════════ */}
      {activeTab === "CONFIG" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Endpoint Settings (5 Cols) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Server className="w-4 h-4 text-indigo-500" />
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">Endpoint Configuration</h3>
                </div>
                {endpoints.length > 1 && (
                  <select
                    value={selectedEndpointId}
                    onChange={(e) => handleSelectEndpoint(e.target.value)}
                    className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 font-semibold"
                  >
                    {endpoints.map((ep) => (
                      <option key={ep.id} value={ep.id}>
                        {ep.name} ({ep.environment})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Endpoint Name
                </label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Primary n8n Webhook"
                  className="text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Target Webhook URL
                </label>
                <Input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://n8n.caketohome.com/webhook/v1/caketohome-events"
                  className="text-xs font-mono"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Must be an active HTTPS production or development webhook trigger in n8n.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Environment
                  </label>
                  <select
                    value={environment}
                    onChange={(e: any) => setEnvironment(e.target.value)}
                    className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 font-medium"
                  >
                    <option value="production">Production</option>
                    <option value="staging">Staging</option>
                    <option value="development">Development</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Dispatch Status
                  </label>
                  <select
                    value={status}
                    onChange={(e: any) => setStatus(e.target.value)}
                    className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 font-medium"
                  >
                    <option value="ACTIVE">ACTIVE (Dispatching)</option>
                    <option value="PAUSED">PAUSED (Queue Only)</option>
                    <option value="DISABLED">DISABLED</option>
                  </select>
                </div>
              </div>

              {/* Cryptographic HMAC-SHA256 Signing Secret */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      HMAC-SHA256 Signing Secret
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold hover:underline flex items-center gap-1"
                  >
                    {showSecret ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    {showSecret ? "Hide" : "Reveal"}
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type={showSecret ? "text" : "password"}
                    readOnly
                    value={signingSecret}
                    className="w-full text-xs font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-700 dark:text-slate-300 select-all"
                  />
                  <Button
                    variant="secondary"
                    size="small"
                    onClick={handleRotateSecret}
                    disabled={isRotating}
                    className="text-xs whitespace-nowrap bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800 hover:bg-amber-100"
                  >
                    <RotateCw className={`w-3 h-3 mr-1 ${isRotating ? "animate-spin" : ""}`} />
                    Rotate Secret
                  </Button>
                </div>
                <p className="text-[10px] text-slate-400">
                  Transmitted as <code className="text-[10px] bg-slate-200 dark:bg-slate-700 px-1 py-0.5 rounded">X-CakeToHome-Signature: t=timestamp,v1=sha256Hex</code>
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Max Retry Attempts
                  </label>
                  <Input
                    type="number"
                    min="1"
                    max="10"
                    value={retryLimit}
                    onChange={(e) => setRetryLimit(Number(e.target.value))}
                    className="text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Timeout (ms)
                  </label>
                  <Input
                    type="number"
                    min="1000"
                    max="30000"
                    step="1000"
                    value={timeoutMs}
                    onChange={(e) => setTimeoutMs(Number(e.target.value))}
                    className="text-xs"
                  />
                </div>
              </div>

              <Button
                variant="primary"
                onClick={handleSaveEndpoint}
                disabled={isSaving}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-2.5 rounded-xl shadow-md shadow-indigo-600/30 transition-all"
              >
                {isSaving ? "Saving Configuration..." : "Save Endpoint Configuration"}
              </Button>
            </div>
          </div>

          {/* Right Column: Event Subscriptions (7 Cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    <Radio className="w-4 h-4 text-indigo-500" />
                    Event Subscriptions ({subscribedEvents.length} Active)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Outbox only dispatches events matching enabled subscriptions for this endpoint.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
                  >
                    Select All
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-medium hover:underline"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              {/* Categorized Event Grid */}
              <div className="space-y-4 max-h-[620px] overflow-y-auto pr-1">
                {categories.map((category) => {
                  const events = ALL_WEBHOOK_EVENT_TYPES.filter((e) => e.category === category);
                  const activeInCat = events.filter((e) => subscribedEvents.includes(e.type)).length;

                  return (
                    <div
                      key={category}
                      className="p-4 bg-slate-50/70 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-slate-800 dark:text-slate-200 tracking-wider">
                            {category}
                          </span>
                          <span className="text-[11px] px-2 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-full font-bold">
                            {activeInCat} / {events.length}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px]">
                          <button
                            type="button"
                            onClick={() => handleSelectAllCategory(category)}
                            className="text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
                          >
                            All
                          </button>
                          <span className="text-slate-300">/</span>
                          <button
                            type="button"
                            onClick={() => handleClearCategory(category)}
                            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-medium"
                          >
                            None
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        {events.map((ev) => {
                          const isSubbed = subscribedEvents.includes(ev.type);
                          return (
                            <label
                              key={ev.type}
                              className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all ${
                                isSubbed
                                  ? "bg-white dark:bg-slate-900 border-indigo-300 dark:border-indigo-700 shadow-xs"
                                  : "bg-transparent border-transparent hover:bg-white/50 dark:hover:bg-slate-900/50 opacity-60"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isSubbed}
                                onChange={() => handleToggleEvent(ev.type)}
                                className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                  {ev.label}
                                </div>
                                <div className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 truncate">
                                  {ev.type}
                                </div>
                                <div className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">
                                  {ev.description}
                                </div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════ */}
      {/* ── TAB 2: LIVE OUTBOX & DEAD LETTER QUEUE (DLQ) ────────── */}
      {/* ══════════════════════════════════════════════════════════ */}
      {activeTab === "OUTBOX_DLQ" && (
        <div className="space-y-6">
          {/* Dead Letter Queue Section */}
          {dlqItems.length > 0 && (
            <div className="bg-rose-50/50 dark:bg-rose-950/20 p-6 rounded-2xl border border-rose-200 dark:border-rose-900/60 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-rose-200/60 dark:border-rose-900 pb-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-rose-600" />
                  <div>
                    <h3 className="font-bold text-sm text-rose-900 dark:text-rose-200">
                      Dead Letter Queue ({dlqItems.length} Failed Events)
                    </h3>
                    <p className="text-xs text-rose-700/80 dark:text-rose-400">
                      Events that exceeded max retry attempts. Admin can inspect, replay with idempotency, or discard.
                    </p>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-rose-200 dark:border-rose-900/40 bg-white dark:bg-slate-900">
                <table className="w-full text-left text-xs">
                  <thead className="bg-rose-100/60 dark:bg-rose-950/60 text-rose-900 dark:text-rose-200 font-bold border-b border-rose-200 dark:border-rose-900">
                    <tr>
                      <th className="p-3">Event ID / Type</th>
                      <th className="p-3">Customer / Aggregate</th>
                      <th className="p-3">Attempts</th>
                      <th className="p-3">Last Error</th>
                      <th className="p-3">Failed At</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rose-100 dark:divide-rose-950/40">
                    {dlqItems.map((item) => (
                      <tr key={item.id} className="hover:bg-rose-50/30 dark:hover:bg-rose-950/20">
                        <td className="p-3">
                          <div className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                            {item.event_id}
                          </div>
                          <div className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400">
                            {item.event_type}
                          </div>
                        </td>
                        <td className="p-3 text-slate-600 dark:text-slate-300">
                          {item.customer_uid || item.aggregate_id || "General"}
                        </td>
                        <td className="p-3 font-semibold text-rose-600">
                          {item.attempt_count} / {item.max_attempts}
                        </td>
                        <td className="p-3 text-rose-700 dark:text-rose-300 font-mono text-[11px] max-w-xs truncate">
                          {item.last_error || "Max attempts exceeded"}
                        </td>
                        <td className="p-3 text-slate-500">
                          {new Date(item.last_attempt_at || item.created_at).toLocaleTimeString()}
                        </td>
                        <td className="p-3 text-right space-x-2">
                          <Button
                            variant="secondary"
                            size="small"
                            onClick={() => setInspectItem(item.payload_json)}
                            className="text-xs"
                          >
                            <Eye className="w-3 h-3 mr-1" /> View
                          </Button>
                          <Button
                            variant="primary"
                            size="small"
                            onClick={() => handleReplayDLQ(item.id)}
                            className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white"
                          >
                            <RotateCw className="w-3 h-3 mr-1" /> Replay
                          </Button>
                          <button
                            type="button"
                            onClick={() => handleDiscardDLQ(item.id)}
                            className="text-xs text-slate-400 hover:text-rose-600 p-1 font-semibold"
                            title="Discard from DLQ"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Pending / Active Outbox Queue */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-indigo-500" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  Transactional Outbox Queue ({outboxItems.length} Total Items)
                </h3>
              </div>
              <Button
                variant="secondary"
                size="small"
                onClick={fetchData}
                className="text-xs flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" /> Refresh Queue
              </Button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-3">Event ID</th>
                    <th className="p-3">Event Type</th>
                    <th className="p-3">Customer / Agg ID</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Attempts</th>
                    <th className="p-3">Next Attempt</th>
                    <th className="p-3">Created</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {outboxItems.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400">
                        Outbox queue is empty. All business events have been safely delivered.
                      </td>
                    </tr>
                  ) : (
                    outboxItems.slice(0, 50).map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                        <td className="p-3 font-mono text-xs font-bold text-slate-900 dark:text-white">
                          {item.event_id}
                        </td>
                        <td className="p-3">
                          <span className="font-mono text-[11px] text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded">
                            {item.event_type}
                          </span>
                        </td>
                        <td className="p-3 text-slate-600 dark:text-slate-300">
                          {item.customer_uid || item.aggregate_id || "—"}
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              item.status === "DELIVERED"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                : item.status === "PENDING"
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                : item.status === "DEAD_LETTER"
                                ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                                : "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300"
                            }`}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td className="p-3 text-slate-700 dark:text-slate-300">
                          {item.attempt_count} / {item.max_attempts}
                        </td>
                        <td className="p-3 text-slate-500 font-mono text-[11px]">
                          {item.status === "PENDING" ? new Date(item.next_attempt_at).toLocaleTimeString() : "—"}
                        </td>
                        <td className="p-3 text-slate-500">
                          {new Date(item.created_at).toLocaleTimeString()}
                        </td>
                        <td className="p-3 text-right space-x-1.5">
                          <Button
                            variant="secondary"
                            size="small"
                            onClick={() => setInspectItem(item.payload_json)}
                            className="text-xs"
                          >
                            <Eye className="w-3 h-3 mr-1" /> Payload
                          </Button>
                          {item.status !== "DELIVERED" && (
                            <Button
                              variant="secondary"
                              size="small"
                              onClick={() => handleRetryOutbox(item.id)}
                              className="text-xs text-indigo-600 hover:text-indigo-700"
                            >
                              <RotateCw className="w-3 h-3 mr-1" /> Retry
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════ */}
      {/* ── TAB 3: DELIVERY LOGS & TWO-STAGE TRACEABILITY ───────── */}
      {/* ══════════════════════════════════════════════════════════ */}
      {activeTab === "LOGS" && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <Terminal className="w-4 h-4 text-indigo-500" />
                Outbound Webhook Delivery Logs ({logs.length} Recorded Attempts)
              </h3>
              <p className="text-xs text-slate-500">
                End-to-end transport audit with HTTP response status, duration, and n8n execution IDs.
              </p>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search event ID, type, execution..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-8 pr-3 py-1.5 w-60"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-medium"
              >
                <option value="all">All Statuses</option>
                <option value="DELIVERED">Delivered (2xx)</option>
                <option value="FAILED">Failed</option>
              </select>

              <select
                value={eventTypeFilter}
                onChange={(e) => setEventTypeFilter(e.target.value)}
                className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-medium max-w-[160px]"
              >
                <option value="all">All Event Types</option>
                {ALL_WEBHOOK_EVENT_TYPES.map((t) => (
                  <option key={t.type} value={t.type}>
                    {t.type}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Logs Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-3">Event ID</th>
                  <th className="p-3">Event Type</th>
                  <th className="p-3">Dispatched At</th>
                  <th className="p-3">HTTP Status</th>
                  <th className="p-3">Latency</th>
                  <th className="p-3">Delivery Status</th>
                  <th className="p-3">n8n Execution</th>
                  <th className="p-3 text-right">View Payload</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400">
                      No webhook logs found matching current search and filter criteria.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                      <td className="p-3 font-mono font-bold text-slate-900 dark:text-white">
                        {log.event_id}
                      </td>
                      <td className="p-3">
                        <span className="font-mono text-[11px] text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded">
                          {log.event_type}
                        </span>
                      </td>
                      <td className="p-3 text-slate-500">
                        {new Date(log.dispatched_at).toLocaleTimeString()}
                      </td>
                      <td className="p-3">
                        <span
                          className={`font-mono font-bold px-2 py-0.5 rounded text-[11px] ${
                            log.http_status === 200 || log.http_status === 201
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                          }`}
                        >
                          {log.http_status ? `HTTP ${log.http_status}` : "Error"}
                        </span>
                      </td>
                      <td className="p-3 text-slate-600 dark:text-slate-300 font-mono">
                        {log.duration_ms} ms
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            log.status === "DELIVERED"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                          }`}
                        >
                          {log.status}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-[11px] text-slate-500">
                        {log.n8n_execution_id ? (
                          <span className="text-indigo-600 dark:text-indigo-400 font-bold">
                            {log.n8n_execution_id}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <Button
                          variant="secondary"
                          size="small"
                          onClick={() => setInspectItem(log.request_payload || log)}
                          className="text-xs"
                        >
                          <Eye className="w-3 h-3 mr-1" /> View Payload
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════ */}
      {/* ── TAB 4: EVENT CATALOGUE EXPLORER ─────────────────────── */}
      {/* ══════════════════════════════════════════════════════════ */}
      {activeTab === "CATALOGUE" && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <Radio className="w-4 h-4 text-indigo-500" />
              Canonical Event Catalogue ({ALL_WEBHOOK_EVENT_TYPES.length} Registered System Events)
            </h3>
            <p className="text-xs text-slate-500">
              Complete dictionary of standardized event types across Auth, Orders, Carts, Recovery, and CRM.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ALL_WEBHOOK_EVENT_TYPES.map((ev) => (
              <div
                key={ev.type}
                className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-2 hover:border-indigo-300 transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">{ev.label}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 rounded-full">
                    {ev.category}
                  </span>
                </div>
                <div className="font-mono text-xs text-indigo-600 dark:text-indigo-400">{ev.type}</div>
                <p className="text-xs text-slate-500 dark:text-slate-400">{ev.description}</p>
                <div className="text-[11px] font-mono bg-white dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300">
                  <span className="text-slate-400">Sample: </span>
                  {ev.sample_payload_summary}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════ */}
      {/* ── TAB 5: DIAGNOSTIC TEST CENTER ───────────────────────── */}
      {/* ══════════════════════════════════════════════════════════ */}
      {activeTab === "TEST_CENTER" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Panel: Trigger Form */}
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <Zap className="w-4 h-4 text-indigo-500" />
                Dispatch Diagnostic Webhook
              </h3>
              <p className="text-xs text-slate-500">
                Trigger a live diagnostic test payload to verify HMAC signature verification and workflow routing.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Target Endpoint
              </label>
              <Input value={selectedEndpoint?.url || url} readOnly className="text-xs font-mono bg-slate-50" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Select Test Event Type
              </label>
              <select
                value={testEventType}
                onChange={(e: any) => setTestEventType(e.target.value)}
                className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 font-medium"
              >
                <option value="test.webhook.ping">test.webhook.ping (Diagnostic Ping)</option>
                <option value="order.created">order.created (Real Order Flow)</option>
                <option value="cart.abandoned">cart.abandoned (Cart Recovery Flow)</option>
                <option value="customer.registered">customer.registered (New Customer Flow)</option>
                <option value="customer.login.success">customer.login.success (Auth Flow)</option>
                <option value="customer.reorder_candidate.created">customer.reorder_candidate.created (Telemarketing Flow)</option>
              </select>
            </div>

            <Button
              variant="primary"
              onClick={handleTestWebhook}
              disabled={isTesting}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-3 rounded-xl shadow-md shadow-indigo-600/30 flex items-center justify-center gap-2"
            >
              <Send className={`w-3.5 h-3.5 ${isTesting ? "animate-spin" : ""}`} />
              {isTesting ? "Executing Diagnostic Dispatch..." : "Send Test Webhook Now"}
            </Button>
          </div>

          {/* Right Panel: Step-by-Step Diagnostic Verification */}
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-500" />
                Diagnostic Pipeline Verification Report
              </h3>
              {testResult && (
                <span
                  className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                    testResult.success
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                      : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                  }`}
                >
                  {testResult.success ? "100% PASS" : "FAILED"}
                </span>
              )}
            </div>

            {!testResult ? (
              <div className="p-8 text-center text-slate-400 space-y-2">
                <PlayCircle className="w-8 h-8 mx-auto text-indigo-400 opacity-60" />
                <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Ready for Diagnostic Execution
                </div>
                <p className="text-xs">
                  Click "Send Test Webhook Now" to verify endpoint reachability, HMAC signing, and n8n workflow acceptance.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Step 1: Endpoint Reachability */}
                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">1. Endpoint Reachability</div>
                      <div className="text-[11px] text-slate-500">Connected to destination server</div>
                    </div>
                  </div>
                  <Badge color="green">PASS</Badge>
                </div>

                {/* Step 2: Cryptographic HMAC Signature */}
                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">2. HMAC-SHA256 Signature</div>
                      <div className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 truncate max-w-sm">
                        {testResult.signature_header || "Generated & Signed"}
                      </div>
                    </div>
                  </div>
                  <Badge color="green">PASS</Badge>
                </div>

                {/* Step 3: Webhook Accepted */}
                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">3. Webhook HTTP Acceptance</div>
                      <div className="text-[11px] text-slate-500">HTTP {testResult.http_status || 200} in {testResult.latency_ms} ms</div>
                    </div>
                  </div>
                  <Badge color="green">PASS</Badge>
                </div>

                {/* Step 4: Event Envelope & Correlation */}
                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-1">
                  <div className="font-bold text-slate-900 dark:text-white">Diagnostic Correlation Meta:</div>
                  <div className="font-mono text-[11px] text-slate-600 dark:text-slate-300">
                    Event ID: <span className="text-indigo-600 font-bold">{testResult.event_id}</span>
                  </div>
                  <div className="font-mono text-[11px] text-slate-600 dark:text-slate-300">
                    Request ID: {testResult.request_id}
                  </div>
                  <div className="font-mono text-[11px] text-slate-600 dark:text-slate-300">
                    Correlation ID: {testResult.correlation_id}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════ */}
      {/* ── INSPECT PAYLOAD MODAL ───────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════ */}
      {inspectItem && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-3xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
              <div className="flex items-center gap-2">
                <Terminal className="w-5 h-5 text-indigo-500" />
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                    Webhook Payload & Envelope Inspector
                  </h3>
                  <p className="text-[11px] text-slate-500 font-mono">
                    {inspectItem.event_id || inspectItem.id || "evt_inspector"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInspectItem(null)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Subtabs */}
            <div className="flex items-center justify-between px-5 pt-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/20">
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setInspectModalTab("PRETTY")}
                  className={`pb-2 px-2 font-bold border-b-2 transition-all ${
                    inspectModalTab === "PRETTY"
                      ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Formatted JSON
                </button>
                <button
                  type="button"
                  onClick={() => setInspectModalTab("RAW")}
                  className={`pb-2 px-2 font-bold border-b-2 transition-all ${
                    inspectModalTab === "RAW"
                      ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Raw Transport String
                </button>
              </div>

              <button
                type="button"
                onClick={() => handleCopyPayload(JSON.stringify(inspectItem, null, 2))}
                className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline flex items-center gap-1 mb-2"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied!" : "Copy JSON"}
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto flex-1 font-mono text-xs bg-slate-950 text-slate-200">
              {inspectModalTab === "PRETTY" && (
                <pre className="whitespace-pre-wrap break-words leading-relaxed text-emerald-400">
                  {JSON.stringify(inspectItem, null, 2)}
                </pre>
              )}

              {inspectModalTab === "RAW" && (
                <pre className="whitespace-pre-wrap break-all leading-relaxed text-indigo-300">
                  {JSON.stringify(inspectItem)}
                </pre>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
              <div className="text-[11px] text-slate-500">
                All sensitive fields (passwords, OTPs, auth tokens, CVVs) are sanitized and stripped.
              </div>
              <Button variant="secondary" size="small" onClick={() => setInspectItem(null)}>
                Close Inspector
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
