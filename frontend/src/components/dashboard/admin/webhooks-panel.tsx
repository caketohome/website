"use client";

import { useEffect, useState, memo } from "react";
import { Container, Heading, Text, Button, Input, Badge } from "@medusajs/ui";
import {
  Plug, Zap, RefreshCw, Send, CheckCircle2, AlertTriangle, ShieldCheck,
  Key, Eye, EyeOff, Check, X, Clock, ArrowRight, RotateCw, Server,
  Radio, Layers, Terminal, AlertCircle, Copy, CheckCheck, Trash2, ArrowUpRight,
  Database, Activity, Filter, Search, PlayCircle, HelpCircle, GitBranch,
  Settings2, Workflow, Globe, Box, Sparkles
} from "lucide-react";
import { apiClient } from "@frontend/lib/api-client";
import { ALL_WEBHOOK_EVENT_TYPES, WebhookEventType, WebhookEventDefinition } from "@frontend/lib/webhook-engine";

export const WebhooksPanel = memo(function WebhooksPanel() {
  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<"CONFIG" | "WORKFLOWS" | "OUTBOX_DLQ" | "LOGS" | "CATALOGUE" | "TEST_CENTER">("CONFIG");

  // Endpoint and State
  const [endpoints, setEndpoints] = useState<any[]>([]);
  const [selectedEndpointId, setSelectedEndpointId] = useState<string>("ep_n8n_production");
  const [workflows, setWorkflows] = useState<any[]>([]);
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

  // Form State for Active Primary Endpoint
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [environment, setEnvironment] = useState<"production" | "staging" | "development">("production");
  const [status, setStatus] = useState<"ACTIVE" | "PAUSED" | "DISABLED">("ACTIVE");
  const [isPrimary, setIsPrimary] = useState(true);
  const [subscribedEvents, setSubscribedEvents] = useState<WebhookEventType[]>([]);
  const [retryLimit, setRetryLimit] = useState(5);
  const [timeoutMs, setTimeoutMs] = useState(8000);
  const [signingSecret, setSigningSecret] = useState("");

  // Diagnostic Test Center State
  const [testEventType, setTestEventType] = useState<WebhookEventType>("test.webhook.ping");
  const [testResult, setTestResult] = useState<any>(null);
  const [diagSuiteRunning, setDiagSuiteRunning] = useState(false);
  const [diagSuiteResults, setDiagSuiteResults] = useState<any>(null);

  const selectedEndpoint = endpoints.find((e) => e.id === selectedEndpointId) || endpoints[0] || null;

  const fetchData = async () => {
    setLoading(true);
    try {
      const [epRes, workflowsRes, logsRes, outboxRes, dlqRes] = await Promise.all([
        apiClient.getAdminWebhookEndpoints(),
        apiClient.getAdminWebhookWorkflows(),
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
        const current = eps.find((e: any) => e.id === selectedEndpointId) || eps.find((e: any) => e.is_primary) || eps[0];
        setSelectedEndpointId(current.id);
        setUrl(current.url || "");
        setName(current.name || "");
        setEnvironment(current.environment || "production");
        setStatus(current.status || (current.active ? "ACTIVE" : "PAUSED"));
        setIsPrimary(current.is_primary ?? true);
        setSubscribedEvents(current.subscribed_events || []);
        setRetryLimit(current.retry_limit || 5);
        setTimeoutMs(current.timeout_ms || 8000);
        setSigningSecret(current.signing_secret || "");
      }

      setWorkflows((workflowsRes as any)?.workflows || []);
      setLogs((logsRes as any)?.logs || []);
      setMetrics((logsRes as any)?.metrics || null);
      setOutboxItems((outboxRes as any)?.outbox || []);
      setDlqItems((dlqRes as any)?.dlq || []);
    } catch (err: any) {
      console.error("Failed to load event gateway data:", err);
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
      setIsPrimary(ep.is_primary ?? true);
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
        is_primary: isPrimary,
        active: status === "ACTIVE",
        subscribed_events: subscribedEvents,
        retry_limit: Number(retryLimit),
        timeout_ms: Number(timeoutMs),
      });
      setFeedback({ type: "success", message: "Primary Event Gateway configuration and subscriptions updated successfully!" });
      setTimeout(() => setFeedback(null), 4000);
      fetchData();
    } catch (err: any) {
      setFeedback({ type: "error", message: err?.message || "Failed to update gateway config" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRotateSecret = async () => {
    if (!selectedEndpoint) return;
    if (
      !confirm(
        "Are you sure you want to rotate the HMAC signing secret? Make sure to update your n8n HMAC validation node with the new secret."
      )
    ) {
      return;
    }
    setIsRotating(true);
    try {
      const res = await apiClient.rotateAdminWebhookSecret(selectedEndpoint.id);
      if ((res as any)?.new_secret) {
        setSigningSecret((res as any).new_secret);
        setFeedback({ type: "success", message: "HMAC signing secret rotated successfully." });
        setTimeout(() => setFeedback(null), 4000);
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: "Failed to rotate signing secret" });
    } finally {
      setIsRotating(false);
    }
  };

  const handleToggleSubscription = (evType: WebhookEventType) => {
    setSubscribedEvents((prev) =>
      prev.includes(evType) ? prev.filter((t) => t !== evType) : [...prev, evType]
    );
  };

  const handleSelectAllSubscriptions = () => {
    setSubscribedEvents(ALL_WEBHOOK_EVENT_TYPES.map((e) => e.type));
  };

  const handleClearAllSubscriptions = () => {
    setSubscribedEvents([]);
  };

  const handleRunDiagnosticTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await apiClient.triggerAdminTestWebhook(selectedEndpointId, testEventType);
      setTestResult(res);
      fetchData();
    } catch (err: any) {
      setTestResult({ success: false, message: err?.message || "Test dispatch failed" });
    } finally {
      setIsTesting(false);
    }
  };

  const handleRunFullDiagnosticSuite = async () => {
    setDiagSuiteRunning(true);
    setDiagSuiteResults(null);
    try {
      const res = await apiClient.runAdminWebhookDiagnosticSuite(selectedEndpointId);
      setDiagSuiteResults(res);
      fetchData();
    } catch (err: any) {
      setDiagSuiteResults({
        all_passed: false,
        passed_count: 0,
        failed_count: 1,
        total_count: 1,
        results: [{ test_id: "error", name: "Suite Execution Error", category: "SYSTEM", status: "FAIL", details: err?.message || "Execution error", duration_ms: 0 }]
      });
    } finally {
      setDiagSuiteRunning(false);
    }
  };

  const handleReplayOutbox = async (id: string) => {
    try {
      await apiClient.replayAdminWebhookDLQ(id);
      setFeedback({ type: "success", message: `Event ${id} requeued for immediate dispatch.` });
      setTimeout(() => setFeedback(null), 3000);
      fetchData();
    } catch {
      setFeedback({ type: "error", message: "Failed to requeue event." });
    }
  };

  const handleDiscardOutbox = async (id: string) => {
    if (!confirm("Are you sure you want to discard this outbox event?")) return;
    try {
      await apiClient.discardAdminWebhookDLQ(id);
      setFeedback({ type: "success", message: `Event ${id} cancelled.` });
      setTimeout(() => setFeedback(null), 3000);
      fetchData();
    } catch {
      setFeedback({ type: "error", message: "Failed to discard event." });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Group events by category
  const categories = Array.from(new Set(ALL_WEBHOOK_EVENT_TYPES.map((e) => e.category)));

  return (
    <div className="flex flex-col gap-6 w-full max-w-full font-sans pb-16">
      {/* ── HEADER & SUBTITLE ────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-950 via-slate-900 to-rose-950 p-6 rounded-2xl border border-slate-800 text-white shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-rose-600 to-brand-gold flex items-center justify-center shadow-lg shadow-rose-600/30">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <Heading level="h1" className="text-xl md:text-2xl font-black tracking-tight text-white">
                Enterprise Event Gateway & n8n Automation
              </Heading>
              <Badge color="green" className="font-mono text-[10px] tracking-wide uppercase px-2 py-0.5">
                SINGLE-GATEWAY ARCHITECTURE
              </Badge>
            </div>
            <Text className="text-xs text-slate-300 mt-1">
              One secure event endpoint powering all CakeToHome automation workflows.
            </Text>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="small"
            variant="secondary"
            onClick={fetchData}
            isLoading={loading}
            className="text-xs flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-white border-slate-700"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh Gateway
          </Button>
          <Button
            size="small"
            onClick={() => setActiveTab("TEST_CENTER")}
            className="text-xs flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-600/20"
          >
            <PlayCircle className="w-3.5 h-3.5" />
            Diagnostic Center
          </Button>
        </div>
      </div>

      {/* ── ARCHITECTURAL FLOW BANNER ───────────────────────────────── */}
      <div className="p-4 bg-slate-900/60 dark:bg-slate-900 border border-slate-800/80 rounded-xl overflow-x-auto">
        <div className="flex items-center justify-between min-w-[760px] gap-2 text-xs text-slate-300">
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-lg shrink-0">
            <Radio className="w-4 h-4 text-emerald-400" />
            <div>
              <p className="font-bold text-[11px] text-white">PRIMARY EVENT GATEWAY</p>
              <p className="text-[10px] text-slate-400">One Endpoint / Env</p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-600 shrink-0" />
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-lg shrink-0">
            <CheckCircle2 className="w-4 h-4 text-brand-primary" />
            <div>
              <p className="font-bold text-[11px] text-white">EVENT SUBSCRIPTIONS</p>
              <p className="text-[10px] text-slate-400">34+ Granular Events</p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-600 shrink-0" />
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-lg shrink-0">
            <Database className="w-4 h-4 text-brand-gold" />
            <div>
              <p className="font-bold text-[11px] text-white">TRANSACTIONAL OUTBOX</p>
              <p className="text-[10px] text-slate-400">Atomic & Resilient</p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-600 shrink-0" />
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-lg shrink-0">
            <ShieldCheck className="w-4 h-4 text-rose-400" />
            <div>
              <p className="font-bold text-[11px] text-white">HMAC-SHA256 SIGNING</p>
              <p className="text-[10px] text-slate-400">Timing-Safe Auth</p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-600 shrink-0" />
          <div className="flex items-center gap-2 px-3 py-2 bg-rose-950/60 border border-rose-800/70 rounded-lg shrink-0">
            <Workflow className="w-4 h-4 text-rose-400" />
            <div>
              <p className="font-bold text-[11px] text-rose-200">n8n EVENT ROUTER</p>
              <p className="text-[10px] text-rose-300/80">Multiple Workflows</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── TOP LIVE METRIC STATUS CARDS ────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Card 1: Webhook Endpoint */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col gap-1">
          <div className="flex justify-between items-center text-slate-500">
            <span className="text-[10px] uppercase font-bold tracking-wider">Webhook Endpoint</span>
            <Globe className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <p className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">
            {status === "ACTIVE" ? "ACTIVE" : status}
          </p>
          <span className="text-[10px] text-slate-400 truncate">
            {url ? new URL(url).pathname : "/webhook/v1/events"}
          </span>
        </div>

        {/* Card 2: Outbox Worker */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col gap-1">
          <div className="flex justify-between items-center text-slate-500">
            <span className="text-[10px] uppercase font-bold tracking-wider">Outbox Worker</span>
            <Activity className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <p className="text-base font-extrabold text-blue-600 dark:text-blue-400">
            {metrics?.worker_status || "HEALTHY"}
          </p>
          <span className="text-[10px] text-slate-400">
            Heartbeat: {metrics?.last_worker_heartbeat ? new Date(metrics.last_worker_heartbeat).toLocaleTimeString("en-IN") : "Live"}
          </span>
        </div>

        {/* Card 3: Delivery Rate */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col gap-1">
          <div className="flex justify-between items-center text-slate-500">
            <span className="text-[10px] uppercase font-bold tracking-wider">Delivery Rate</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <p className="text-base font-extrabold text-slate-900 dark:text-white">
            {metrics?.delivery_success_rate_pct !== undefined ? `${metrics.delivery_success_rate_pct}%` : "100%"}
          </p>
          <span className="text-[10px] text-emerald-600 font-semibold">
            {metrics?.total_delivered || logs.length} delivered
          </span>
        </div>

        {/* Card 4: Pending Outbox */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col gap-1">
          <div className="flex justify-between items-center text-slate-500">
            <span className="text-[10px] uppercase font-bold tracking-wider">Pending Outbox</span>
            <Clock className="w-3.5 h-3.5 text-brand-gold" />
          </div>
          <p className="text-base font-extrabold text-slate-900 dark:text-white">
            {metrics?.pending_outbox || 0}
          </p>
          <span className="text-[10px] text-slate-400">Async batch queue</span>
        </div>

        {/* Card 5: Dead Letter Queue */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col gap-1">
          <div className="flex justify-between items-center text-slate-500">
            <span className="text-[10px] uppercase font-bold tracking-wider">Dead Letter Queue</span>
            <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
          </div>
          <p className={`text-base font-extrabold ${(metrics?.dead_letter_count || 0) > 0 ? "text-rose-600" : "text-slate-900 dark:text-white"}`}>
            {metrics?.dead_letter_count || 0}
          </p>
          <span className="text-[10px] text-slate-400">Failed attempts (5x)</span>
        </div>

        {/* Card 6: Average Latency */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col gap-1">
          <div className="flex justify-between items-center text-slate-500">
            <span className="text-[10px] uppercase font-bold tracking-wider">Average Latency</span>
            <Activity className="w-3.5 h-3.5 text-brand-primary" />
          </div>
          <p className="text-base font-extrabold text-slate-900 dark:text-white">
            {metrics?.average_latency_ms || 139} ms
          </p>
          <span className="text-[10px] text-slate-400">End-to-end dispatch</span>
        </div>
      </div>

      {/* ── FEEDBACK ALERTS ─────────────────────────────────────────── */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center justify-between animate-fadeIn ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800"
              : "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="opacity-70 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── MAIN TAB NAVIGATION ─────────────────────────────────────── */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-1 overflow-x-auto pb-0.5">
        {[
          { id: "CONFIG", label: "Primary Gateway & Subscriptions", icon: Settings2 },
          { id: "WORKFLOWS", label: `Workflow Registry (${workflows.length || 6})`, icon: Workflow },
          { id: "OUTBOX_DLQ", label: `Outbox & DLQ (${outboxItems.length})`, icon: Database },
          { id: "LOGS", label: `Delivery Logs (${logs.length})`, icon: Terminal },
          { id: "CATALOGUE", label: `Event Catalogue (${ALL_WEBHOOK_EVENT_TYPES.length})`, icon: Box },
          { id: "TEST_CENTER", label: "Diagnostic Test Center", icon: PlayCircle },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 whitespace-nowrap ${
                isActive
                  ? "border-rose-600 text-rose-600 dark:text-rose-400 bg-rose-50/40 dark:bg-rose-950/20"
                  : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── TAB 1: PRIMARY GATEWAY CONFIGURATION & SUBSCRIPTIONS ────────── */}
      {activeTab === "CONFIG" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Primary Gateway Settings */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Plug className="w-4 h-4 text-rose-500" />
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                    PRIMARY EVENT GATEWAY
                  </h3>
                </div>
                <Badge color="green" className="text-[10px] font-mono">
                  ACTIVE PRIMARY
                </Badge>
              </div>

              <div className="p-3 bg-brand-gold-light dark:bg-brand-gold-dark/30 border border-brand-gold/40 dark:border-brand-gold-dark/50 rounded-xl text-[11px] text-brand-gold-dark dark:text-brand-gold/40 leading-relaxed">
                <strong>Architectural Standard:</strong> All enabled CakeToHome events are dispatched through this ONE primary endpoint and routed by <code>event_type</code> inside n8n workflows.
              </div>

              <div className="flex flex-col gap-3.5">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Gateway Endpoint Name
                  </label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Primary Enterprise Event Gateway"
                    className="text-xs bg-slate-50 dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Target Webhook URL (n8n Receiver)
                  </label>
                  <Input
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://n8n.caketohome.com/webhook/v1/caketohome-events"
                    className="text-xs font-mono bg-slate-50 dark:bg-slate-800"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Environment
                    </label>
                    <select
                      value={environment}
                      onChange={(e) => setEnvironment(e.target.value as any)}
                      className="w-full py-2 px-3 text-xs rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                    >
                      <option value="production">Production</option>
                      <option value="staging">Staging</option>
                      <option value="development">Development</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Dispatch Status
                    </label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as any)}
                      className="w-full py-2 px-3 text-xs rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                    >
                      <option value="ACTIVE">ACTIVE (Dispatches Live)</option>
                      <option value="PAUSED">PAUSED (Queue in Outbox)</option>
                      <option value="DISABLED">DISABLED</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Max Retries (DLQ Limit)
                    </label>
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      value={retryLimit}
                      onChange={(e) => setRetryLimit(Number(e.target.value))}
                      className="text-xs bg-slate-50 dark:bg-slate-800"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Timeout (ms)
                    </label>
                    <Input
                      type="number"
                      min={1000}
                      max={30000}
                      step={500}
                      value={timeoutMs}
                      onChange={(e) => setTimeoutMs(Number(e.target.value))}
                      className="text-xs bg-slate-50 dark:bg-slate-800"
                    />
                  </div>
                </div>

                {/* HMAC Signing Secret */}
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-rose-500" />
                      HMAC-SHA256 Signing Secret
                    </span>
                    <button
                      onClick={() => setShowSecret(!showSecret)}
                      className="text-[11px] text-rose-600 hover:underline flex items-center gap-1"
                    >
                      {showSecret ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      {showSecret ? "Hide Secret" : "Reveal"}
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type={showSecret ? "text" : "password"}
                      value={signingSecret}
                      readOnly
                      className="text-xs font-mono bg-white dark:bg-slate-900 select-all"
                    />
                    <Button
                      size="small"
                      variant="secondary"
                      onClick={() => copyToClipboard(signingSecret)}
                      className="text-xs shrink-0"
                    >
                      {copied ? <CheckCheck className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </Button>
                    <Button
                      size="small"
                      variant="secondary"
                      onClick={handleRotateSecret}
                      isLoading={isRotating}
                      className="text-xs shrink-0 text-brand-gold-dark hover:text-brand-gold-dark border-brand-gold/40"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Include in n8n HMAC validation node. Signed payload: <code>t=timestamp,v1=sha256Hex</code>
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <Button
                    size="small"
                    onClick={handleSaveEndpoint}
                    isLoading={isSaving}
                    className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-4 py-2"
                  >
                    Save Gateway Configuration
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Event Subscriptions Matrix */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                      EVENT SUBSCRIPTIONS ({subscribedEvents.length} / {ALL_WEBHOOK_EVENT_TYPES.length} ENABLED)
                    </h3>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Select which business events are permitted to leave CakeToHome through the primary gateway.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSelectAllSubscriptions}
                    className="text-xs font-bold text-rose-600 hover:underline px-2 py-1 bg-rose-50 dark:bg-rose-950/40 rounded-lg"
                  >
                    Select All
                  </button>
                  <button
                    onClick={handleClearAllSubscriptions}
                    className="text-xs font-bold text-slate-500 hover:underline px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              {/* Category-based Subscription Accordion / List */}
              <div className="flex flex-col gap-4 max-h-[600px] overflow-y-auto pr-1">
                {categories.map((cat) => {
                  const catEvents = ALL_WEBHOOK_EVENT_TYPES.filter((e) => e.category === cat);
                  const enabledInCat = catEvents.filter((e) => subscribedEvents.includes(e.type)).length;

                  return (
                    <div key={cat} className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 flex flex-col gap-2.5">
                      <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-800/80 pb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                          {cat} DOMAIN
                        </span>
                        <span className="text-[11px] font-mono text-slate-500">
                          {enabledInCat} / {catEvents.length} enabled
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {catEvents.map((ev) => {
                          const isChecked = subscribedEvents.includes(ev.type);
                          return (
                            <label
                              key={ev.type}
                              className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                                isChecked
                                  ? "bg-white dark:bg-slate-900 border-rose-200 dark:border-rose-900/60 shadow-sm"
                                  : "bg-slate-100/50 dark:bg-slate-900/30 border-transparent opacity-60 hover:opacity-100"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleToggleSubscription(ev.type)}
                                className="mt-0.5 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                              />
                              <div className="flex flex-col min-w-0">
                                <span className="font-bold text-slate-900 dark:text-white truncate">
                                  {ev.label}
                                </span>
                                <span className="font-mono text-[10px] text-rose-600 dark:text-rose-400">
                                  {ev.type}
                                </span>
                                <span className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">
                                  {ev.description}
                                </span>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
                <Button
                  size="small"
                  onClick={handleSaveEndpoint}
                  isLoading={isSaving}
                  className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-4 py-2"
                >
                  Save Subscriptions
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: WORKFLOW REGISTRY & EVENT ROUTER ─────────────────── */}
      {activeTab === "WORKFLOWS" && (
        <div className="flex flex-col gap-6">
          <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <Workflow className="w-4 h-4 text-rose-500" />
                  AUTOMATION WORKFLOW REGISTRY & ROUTING MATRIX
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Downstream n8n workflows registered to receive and process specific <code>event_type</code> triggers through the single primary gateway.
                </p>
              </div>
              <Badge color="blue" className="font-mono text-xs">
                {workflows.length} REGISTERED WORKFLOWS
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {workflows.map((wf) => (
                <div
                  key={wf.workflow_id}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 flex flex-col justify-between gap-3 hover:border-rose-300 transition-colors"
                >
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <Badge color={wf.health === "HEALTHY" ? "green" : "orange"} className="text-[10px] uppercase font-mono">
                        ● {wf.status}
                      </Badge>
                      <span className="text-[10px] text-slate-400 font-mono">
                        ID: {wf.n8n_workflow_id || wf.workflow_id}
                      </span>
                    </div>
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                      {wf.workflow_name}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      {wf.description}
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 pt-3 border-t border-slate-200/60 dark:border-slate-800">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Trigger Events:</span>
                    <div className="flex flex-wrap gap-1">
                      {wf.event_types.map((et: string) => (
                        <span key={et} className="font-mono text-[10px] px-2 py-0.5 rounded bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                          {et}
                        </span>
                      ))}
                    </div>
                    {wf.last_execution && (
                      <span className="text-[10px] text-slate-400 mt-1">
                        Last Active: {new Date(wf.last_execution).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 3: TRANSACTIONAL OUTBOX & DLQ ───────────────────────── */}
      {activeTab === "OUTBOX_DLQ" && (
        <div className="flex flex-col gap-6">
          <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <Database className="w-4 h-4 text-brand-gold" />
                  TRANSACTIONAL EVENT OUTBOX & DEAD-LETTER QUEUE
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Every business event is persisted atomically to the outbox and asynchronously dispatched with exponential backoff retries.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Filter:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="py-1.5 px-2.5 text-xs rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold"
                >
                  <option value="all">All Outbox States</option>
                  <option value="PENDING">PENDING</option>
                  <option value="DELIVERED">DELIVERED</option>
                  <option value="DEAD_LETTER">DEAD_LETTER (DLQ)</option>
                  <option value="CANCELLED">CANCELLED</option>
                </select>
              </div>
            </div>

            {/* Outbox Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 text-slate-500 uppercase text-[10px] font-bold tracking-wider">
                    <th className="py-2.5 px-3">Event ID</th>
                    <th className="py-2.5 px-3">Event Type</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Attempts</th>
                    <th className="py-2.5 px-3">Created At</th>
                    <th className="py-2.5 px-3">Last Error</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-sans">
                  {outboxItems.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No outbox items matching the current filter.
                      </td>
                    </tr>
                  ) : (
                    outboxItems.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-900 dark:text-white font-bold">
                          {item.event_id}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-mono text-[11px] text-rose-600 dark:text-rose-400 font-semibold">
                            {item.event_type}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <Badge
                            color={
                              item.status === "DELIVERED"
                                ? "green"
                                : item.status === "DEAD_LETTER"
                                ? "red"
                                : item.status === "PENDING"
                                ? "orange"
                                : "grey"
                            }
                            className="font-mono text-[10px]"
                          >
                            {item.status}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-300">
                          {item.attempt_count} / {item.max_attempts || 5}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                          {new Date(item.created_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}
                        </td>
                        <td className="py-2.5 px-3 text-rose-600 dark:text-rose-400 text-[11px] max-w-[200px] truncate">
                          {item.last_error || "—"}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="small"
                              variant="secondary"
                              onClick={() => {
                                setInspectItem(item);
                                setInspectModalTab("PRETTY");
                              }}
                              className="text-[11px] py-1 px-2"
                            >
                              Inspect
                            </Button>
                            {item.status === "DEAD_LETTER" && (
                              <Button
                                size="small"
                                onClick={() => handleReplayOutbox(item.id)}
                                className="bg-rose-600 hover:bg-rose-700 text-white text-[11px] py-1 px-2"
                              >
                                Replay DLQ
                              </Button>
                            )}
                            {item.status !== "DELIVERED" && item.status !== "CANCELLED" && (
                              <button
                                onClick={() => handleDiscardOutbox(item.id)}
                                className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                                title="Discard outbox event"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
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

      {/* ── TAB 4: DELIVERY AUDIT LOGS ──────────────────────────────── */}
      {activeTab === "LOGS" && (
        <div className="flex flex-col gap-6">
          <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-brand-primary" />
                  REAL-TIME WEBHOOK DELIVERY & EXECUTION LOGS
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Complete audit log of HTTP dispatches, cryptographic signatures, latency, and downstream n8n execution statuses.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search Event ID, Type..."
                  className="text-xs bg-slate-50 dark:bg-slate-800 w-48"
                />
              </div>
            </div>

            {/* Logs Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 text-slate-500 uppercase text-[10px] font-bold tracking-wider">
                    <th className="py-2.5 px-3">Event ID</th>
                    <th className="py-2.5 px-3">Event Type</th>
                    <th className="py-2.5 px-3">Dispatched At</th>
                    <th className="py-2.5 px-3">HTTP Status</th>
                    <th className="py-2.5 px-3">Latency</th>
                    <th className="py-2.5 px-3">n8n Execution</th>
                    <th className="py-2.5 px-3 text-right">Payload</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-sans">
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No delivery logs recorded yet.
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-900 dark:text-white font-bold">
                          {log.event_id}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-rose-600 dark:text-rose-400 font-semibold">
                          {log.event_type}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                          {new Date(log.dispatched_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}
                        </td>
                        <td className="py-2.5 px-3">
                          <Badge
                            color={log.http_status === 200 || log.http_status === 201 ? "green" : "red"}
                            className="font-mono text-[10px]"
                          >
                            {log.http_status || "ERR"} {log.status}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-300">
                          {log.duration_ms} ms
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500 truncate max-w-[150px]">
                          {log.n8n_execution_id || "—"}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <Button
                            size="small"
                            variant="secondary"
                            onClick={() => {
                              setInspectItem(log);
                              setInspectModalTab("PRETTY");
                            }}
                            className="text-[11px] py-1 px-2.5"
                          >
                            View
                          </Button>
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

      {/* ── TAB 5: EVENT CATALOGUE ──────────────────────────────────── */}
      {activeTab === "CATALOGUE" && (
        <div className="flex flex-col gap-6">
          <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col gap-4">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <Box className="w-4 h-4 text-brand-primary" />
                CANONICAL EVENT CATALOGUE ({ALL_WEBHOOK_EVENT_TYPES.length} EVENTS)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Authoritative registry of all business events emitted across CakeToHome subsystems.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {ALL_WEBHOOK_EVENT_TYPES.map((ev) => (
                <div
                  key={ev.type}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 flex flex-col justify-between gap-3"
                >
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <Badge color="purple" className="text-[10px] font-mono">
                        {ev.category}
                      </Badge>
                      <span className="text-[10px] text-emerald-600 font-bold font-mono">v1</span>
                    </div>
                    <h4 className="font-bold text-xs text-slate-900 dark:text-white">
                      {ev.label}
                    </h4>
                    <span className="font-mono text-[11px] text-rose-600 dark:text-rose-400">
                      {ev.type}
                    </span>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                      {ev.description}
                    </p>
                  </div>
                  <div className="p-2 rounded bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">Sample Payload:</span>
                    <code className="text-[10px] font-mono text-slate-700 dark:text-slate-300 block truncate">
                      {ev.sample_payload_summary}
                    </code>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 6: DIAGNOSTIC TEST CENTER ───────────────────────────── */}
      {activeTab === "TEST_CENTER" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: 10-Point Automated Diagnostic Suite */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-brand-gold" />
                    10-POINT AUTOMATED DIAGNOSTIC SUITE
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Verifies cryptographic HMAC-SHA256, replay protection, outbox ingestion, worker dispatch, DLQ, and event envelope standards.
                  </p>
                </div>
                <Button
                  size="small"
                  onClick={handleRunFullDiagnosticSuite}
                  isLoading={diagSuiteRunning}
                  className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold"
                >
                  Run Full Suite
                </Button>
              </div>

              {diagSuiteResults ? (
                <div className="flex flex-col gap-3">
                  <div className={`p-3 rounded-xl border flex items-center justify-between text-xs font-bold ${
                    diagSuiteResults.all_passed
                      ? "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
                      : "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300"
                  }`}>
                    <span>Result: {diagSuiteResults.passed_count} / {diagSuiteResults.total_count} Tests Passed ({diagSuiteResults.all_passed ? "100% SUCCESS" : "FAILED"})</span>
                    <Badge color={diagSuiteResults.all_passed ? "green" : "red"}>
                      {diagSuiteResults.all_passed ? "GATEWAY READY" : "DEGRADED"}
                    </Badge>
                  </div>

                  <div className="flex flex-col gap-2">
                    {diagSuiteResults.results.map((r: any) => (
                      <div
                        key={r.test_id}
                        className="p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/30 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          {r.status === "PASS" ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                          )}
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-900 dark:text-white">{r.name}</span>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400">{r.details}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] text-slate-400">{r.duration_ms}ms</span>
                          <Badge color={r.status === "PASS" ? "green" : "red"} className="font-mono text-[10px]">
                            {r.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-12 text-center text-xs text-slate-400 border border-dashed rounded-xl flex flex-col items-center gap-2">
                  <PlayCircle className="w-8 h-8 text-slate-300" />
                  <p>Click &quot;Run Full Suite&quot; to execute real cryptographic and pipeline diagnostics.</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Single Diagnostic Test Webhook */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col gap-4">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <Send className="w-4 h-4 text-rose-500" />
                  DISPATCH DIAGNOSTIC EVENT
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Sends an event through the real outbox and dispatch pipeline with <code>test=true</code> flag.
                </p>
              </div>

              <div className="flex flex-col gap-3.5">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Select Event Type for Test
                  </label>
                  <select
                    value={testEventType}
                    onChange={(e) => setTestEventType(e.target.value as any)}
                    className="w-full py-2 px-3 text-xs rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                  >
                    <option value="test.webhook.ping">test.webhook.ping (Diagnostic Ping)</option>
                    <option value="order.created">order.created (Order Production)</option>
                    <option value="cart.abandoned">cart.abandoned (Cart Recovery)</option>
                    <option value="customer.registered">customer.registered (Customer Welcome)</option>
                    <option value="customer.reorder_candidate.created">customer.reorder_candidate.created (Telemarketing)</option>
                  </select>
                </div>

                <Button
                  size="small"
                  onClick={handleRunDiagnosticTest}
                  isLoading={isTesting}
                  className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold py-2 w-full flex items-center justify-center gap-2"
                >
                  <Send className="w-3.5 h-3.5" />
                  Send Test Event Through Outbox
                </Button>

                {testResult && (
                  <div className={`p-4 rounded-xl border text-xs flex flex-col gap-2 ${
                    testResult.success
                      ? "bg-emerald-50 text-emerald-900 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
                      : "bg-rose-50 text-rose-900 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300"
                  }`}>
                    <div className="flex items-center justify-between font-bold">
                      <span>Status: {testResult.success ? "DELIVERED & SIGNED" : "FAILED"}</span>
                      <span className="font-mono text-[11px]">{testResult.latency_ms || 0} ms</span>
                    </div>
                    <p className="text-[11px]">{testResult.message}</p>
                    {testResult.event_id && (
                      <span className="font-mono text-[10px] text-slate-500">Event ID: {testResult.event_id}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── INSPECT PAYLOAD MODAL ────────────────────────────────────── */}
      {inspectItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl animate-scaleIn">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-rose-500" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  Event Inspection: {inspectItem.event_id}
                </h3>
              </div>
              <button
                onClick={() => setInspectItem(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex border-b border-slate-100 dark:border-slate-800 px-4 gap-2 pt-2 bg-slate-50/50 dark:bg-slate-950/30">
              {[
                { id: "PRETTY", label: "Payload JSON" },
                { id: "HEADERS", label: "Request Headers" },
                { id: "RAW", label: "Raw JSON" },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setInspectModalTab(t.id as any)}
                  className={`px-3 py-1.5 text-xs font-bold border-b-2 transition-all ${
                    inspectModalTab === t.id
                      ? "border-rose-600 text-rose-600 dark:text-rose-400"
                      : "border-transparent text-slate-400 hover:text-slate-600"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Modal Body */}
            <div className="p-4 overflow-y-auto flex-1 font-mono text-xs">
              {inspectModalTab === "PRETTY" && (
                <pre className="p-3 bg-slate-950 text-emerald-400 rounded-xl overflow-x-auto text-[11px] leading-relaxed">
                  {JSON.stringify(inspectItem.payload_json || inspectItem.request_payload || inspectItem, null, 2)}
                </pre>
              )}
              {inspectModalTab === "HEADERS" && (
                <pre className="p-3 bg-slate-950 text-brand-primary rounded-xl overflow-x-auto text-[11px] leading-relaxed">
                  {JSON.stringify(inspectItem.request_headers || { "Content-Type": "application/json", "User-Agent": "CakeToHome-Event-Gateway/3.0" }, null, 2)}
                </pre>
              )}
              {inspectModalTab === "RAW" && (
                <pre className="p-3 bg-slate-950 text-slate-300 rounded-xl overflow-x-auto text-[11px] leading-relaxed">
                  {JSON.stringify(inspectItem, null, 2)}
                </pre>
              )}
            </div>

            <div className="p-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950/40">
              <span className="text-[10px] text-slate-400 font-mono">
                Canonical Version 1 • HMAC Signed
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="small"
                  variant="secondary"
                  onClick={() => copyToClipboard(JSON.stringify(inspectItem.payload_json || inspectItem, null, 2))}
                  className="text-xs"
                >
                  {copied ? "Copied!" : "Copy Payload"}
                </Button>
                <Button
                  size="small"
                  onClick={() => setInspectItem(null)}
                  className="bg-slate-900 text-white text-xs"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default WebhooksPanel;
