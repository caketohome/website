"use client";

import { useEffect, useState, memo } from "react";
import { Container, Heading, Text, Button, Input, Badge, StatusBadge } from "@medusajs/ui";
import {
  Plug, Zap, RefreshCw, Send, CheckCircle2, AlertTriangle, ShieldCheck,
  Key, Eye, EyeOff, Check, X, Clock, ArrowRight, RotateCw, Server
} from "lucide-react";
import { apiClient } from "@frontend/lib/api-client";
import { ALL_WEBHOOK_EVENT_TYPES, WebhookEventType } from "@frontend/lib/webhook-engine";

export const WebhooksPanel = memo(function WebhooksPanel() {
  const [endpoints, setEndpoints] = useState<any[]>([]);
  const [selectedEndpoint, setSelectedEndpoint] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState("all");
  const [eventTypeFilter, setEventTypeFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Inspect Modal
  const [inspectLog, setInspectLog] = useState<any>(null);
  const [showSecret, setShowSecret] = useState(false);

  // Form State
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [subscribedEvents, setSubscribedEvents] = useState<WebhookEventType[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [retryLimit, setRetryLimit] = useState(5);
  const [timeoutMs, setTimeoutMs] = useState(8000);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [epRes, logsRes] = await Promise.all([
        apiClient.getAdminWebhookEndpoints(),
        apiClient.getAdminWebhookLogs({ status: statusFilter, event_type: eventTypeFilter, search: searchQuery }),
      ]);

      const eps = (epRes as any)?.endpoints || [];
      setEndpoints(eps);
      if (eps.length > 0) {
        const activeEp = eps[0];
        setSelectedEndpoint(activeEp);
        setUrl(activeEp.url || "");
        setName(activeEp.name || "");
        setSubscribedEvents(activeEp.subscribed_events || []);
        setIsActive(activeEp.active ?? true);
        setRetryLimit(activeEp.retry_limit || 5);
        setTimeoutMs(activeEp.timeout_ms || 8000);
      }

      setLogs((logsRes as any)?.logs || []);
      setMetrics((logsRes as any)?.metrics || null);
    } catch (err: any) {
      console.error("Failed to load webhook data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [statusFilter, eventTypeFilter]);

  const handleSaveEndpoint = async () => {
    if (!selectedEndpoint) return;
    setIsSaving(true);
    setFeedback(null);
    try {
      await apiClient.updateAdminWebhookEndpoint(selectedEndpoint.id, {
        name,
        url,
        subscribed_events: subscribedEvents,
        active: isActive,
        retry_limit: Number(retryLimit),
        timeout_ms: Number(timeoutMs),
      });
      setFeedback({ type: "success", message: "Webhook endpoint configuration updated successfully!" });
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
    if (!confirm("Are you sure you want to rotate the webhook signing secret? You will need to update your n8n HMAC validation node.")) {
      return;
    }
    setIsRotating(true);
    try {
      const res = await apiClient.rotateAdminWebhookSecret(selectedEndpoint.id);
      setSelectedEndpoint((res as any)?.endpoint);
      setFeedback({ type: "success", message: "Webhook HMAC secret rotated successfully!" });
      setTimeout(() => setFeedback(null), 4000);
      fetchData();
    } catch (err: any) {
      setFeedback({ type: "error", message: err?.message || "Failed to rotate secret" });
    } finally {
      setIsRotating(false);
    }
  };

  const handleTestWebhook = async () => {
    if (!selectedEndpoint) return;
    setIsTesting(true);
    setFeedback(null);
    try {
      const res: any = await apiClient.triggerAdminTestWebhook(selectedEndpoint.id);
      if (res?.success) {
        setFeedback({
          type: "success",
          message: `Test webhook delivered successfully in ${res.latency_ms}ms (HTTP ${res.http_status})!`,
        });
      } else {
        setFeedback({
          type: "error",
          message: `Test webhook failed: ${res.message || "Unknown error"}`,
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

  const handleRetryLog = async (outboxId: string) => {
    try {
      await apiClient.retryAdminWebhookOutbox(outboxId);
      setFeedback({ type: "success", message: "Webhook re-queued for delivery!" });
      setTimeout(() => setFeedback(null), 3000);
      fetchData();
    } catch (err: any) {
      alert("Failed to retry webhook: " + err?.message);
    }
  };

  const toggleEventSubscription = (eventType: WebhookEventType) => {
    setSubscribedEvents((prev) =>
      prev.includes(eventType) ? prev.filter((e) => e !== eventType) : [...prev, eventType]
    );
  };

  const selectAllEvents = () => {
    setSubscribedEvents(ALL_WEBHOOK_EVENT_TYPES.map((e) => e.type));
  };

  const clearAllEvents = () => {
    setSubscribedEvents([]);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <Plug className="w-5 h-5 text-purple-600" />
            <Heading level="h2" className="text-xl font-bold">
              n8n & External Webhooks Outbox Integration
            </Heading>
          </div>
          <Text className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real-time customer events, transactional outbox with HMAC-SHA256 signatures, exponential backoff retries, and dead-letter queue.
          </Text>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="small"
            onClick={fetchData}
            isLoading={loading}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
          <Button
            size="small"
            onClick={handleTestWebhook}
            isLoading={isTesting}
            className="bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" /> Send Test Webhook
          </Button>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl text-sm flex items-center gap-2 border ${
            feedback.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
              : "bg-red-50 dark:bg-red-950/60 border-red-300 dark:border-red-800 text-red-800 dark:text-red-200"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Container className="p-4 flex flex-col gap-1">
          <Text className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Delivered</Text>
          <Text className="text-2xl font-bold text-emerald-600">{metrics?.total_delivered ?? logs.length}</Text>
          <Text className="text-[10px] text-slate-400">Events processed to n8n</Text>
        </Container>
        <Container className="p-4 flex flex-col gap-1">
          <Text className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Success Rate</Text>
          <Text className="text-2xl font-bold text-blue-600">{metrics?.success_rate_pct ?? 100}%</Text>
          <Text className="text-[10px] text-slate-400">Zero data loss guaranteed</Text>
        </Container>
        <Container className="p-4 flex flex-col gap-1">
          <Text className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pending Outbox</Text>
          <Text className="text-2xl font-bold text-amber-600">{metrics?.pending_outbox ?? 0}</Text>
          <Text className="text-[10px] text-slate-400">In asynchronous dispatch pipeline</Text>
        </Container>
        <Container className="p-4 flex flex-col gap-1">
          <Text className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Dead Letter Queue</Text>
          <Text className="text-2xl font-bold text-red-600">{metrics?.dead_letter_count ?? 0}</Text>
          <Text className="text-[10px] text-slate-400">Max retries exceeded</Text>
        </Container>
      </div>

      {/* Webhook Configuration & Endpoint Form */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col gap-4">
          <Container className="p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-purple-600" />
                <Heading level="h3" className="text-sm font-bold">
                  Endpoint & Authentication Configuration
                </Heading>
              </div>
              <Badge color={isActive ? "green" : "grey"} size="small">
                {isActive ? "ACTIVE ENDPOINT" : "DISABLED"}
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Endpoint Name</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Primary n8n Webhook"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Target Webhook URL</label>
                <Input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://n8n.yourdomain.com/webhook/..."
                  className="mt-1 font-mono text-xs"
                />
              </div>
            </div>

            {/* Secret Display & Rotation */}
            <div className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <div>
                  <Text className="text-xs font-bold text-slate-700 dark:text-slate-200">HMAC SHA-256 Signing Secret</Text>
                  <Text className="text-[11px] font-mono text-slate-500">
                    {showSecret ? selectedEndpoint?.signing_secret : "••••••••••••••••••••••••••••••••"}
                  </Text>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowSecret(!showSecret)}
                  className="p-1.5 text-xs text-slate-500 hover:text-slate-800 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800"
                >
                  {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <Button
                  variant="secondary"
                  size="small"
                  onClick={handleRotateSecret}
                  isLoading={isRotating}
                  className="text-xs flex items-center gap-1"
                >
                  <RotateCw className="w-3 h-3" /> Rotate Secret
                </Button>
              </div>
            </div>

            {/* Retry & Timeout Settings */}
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Max Retry Attempts</label>
                <Input
                  type="number"
                  value={retryLimit}
                  onChange={(e) => setRetryLimit(Number(e.target.value))}
                  min={1}
                  max={10}
                  className="mt-1 text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Timeout (ms)</label>
                <Input
                  type="number"
                  value={timeoutMs}
                  onChange={(e) => setTimeoutMs(Number(e.target.value))}
                  min={1000}
                  max={30000}
                  step={1000}
                  className="mt-1 text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                onClick={handleSaveEndpoint}
                isLoading={isSaving}
                className="bg-purple-600 hover:bg-purple-700 text-white text-xs"
              >
                Save Endpoint Configuration
              </Button>
            </div>
          </Container>

          {/* Event Subscriptions Matrix */}
          <Container className="p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <Heading level="h3" className="text-sm font-bold">
                  Event Subscriptions ({subscribedEvents.length} Active)
                </Heading>
                <Text className="text-xs text-slate-400">Select which customer events trigger outbound webhooks</Text>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={selectAllEvents}
                  className="text-xs text-purple-600 hover:underline font-semibold"
                >
                  Select All
                </button>
                <span className="text-slate-300">|</span>
                <button
                  onClick={clearAllEvents}
                  className="text-xs text-slate-500 hover:underline font-semibold"
                >
                  Clear All
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-[360px] overflow-y-auto pr-1">
              {ALL_WEBHOOK_EVENT_TYPES.map((ev) => {
                const isSubscribed = subscribedEvents.includes(ev.type);
                return (
                  <div
                    key={ev.type}
                    onClick={() => toggleEventSubscription(ev.type)}
                    className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all flex items-start gap-2.5 select-none ${
                      isSubscribed
                        ? "bg-purple-50/70 dark:bg-purple-950/40 border-purple-300 dark:border-purple-800"
                        : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300"
                    }`}
                  >
                    <div
                      className={`w-4 h-4 mt-0.5 rounded flex items-center justify-center shrink-0 border ${
                        isSubscribed ? "bg-purple-600 border-purple-600 text-white" : "border-slate-300 bg-white"
                      }`}
                    >
                      {isSubscribed && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-semibold text-slate-800 dark:text-slate-100">{ev.label}</span>
                        <span className="text-[10px] font-mono text-purple-600 font-medium">{ev.category}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">{ev.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Container>
        </div>

        {/* Security & Header Signature Reference Box */}
        <div className="flex flex-col gap-4">
          <Container className="p-5 flex flex-col gap-3 bg-slate-900 text-slate-100 border-slate-800">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <Text className="text-xs font-bold text-white uppercase tracking-wider">
                Cryptographic Signature Spec
              </Text>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Every webhook sent to n8n includes an HMAC-SHA256 signature generated with your private secret:
            </p>
            <div className="p-3 bg-slate-950 rounded-lg font-mono text-[11px] text-emerald-400 flex flex-col gap-1">
              <div><span className="text-slate-400">X-CakeToHome-Event-ID:</span> evt_102938472</div>
              <div><span className="text-slate-400">X-CakeToHome-Event-Type:</span> cart.abandoned</div>
              <div><span className="text-slate-400">X-CakeToHome-Timestamp:</span> 1786874920</div>
              <div><span className="text-slate-400">X-CakeToHome-Signature:</span> t=...,v1=4f8a...</div>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Validate with: <code className="text-amber-300">{"crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex')"}</code>
            </p>
          </Container>

          <Container className="p-5 flex flex-col gap-2">
            <Text className="text-xs font-bold text-slate-700 dark:text-slate-200">Zero-Impact Resilience</Text>
            <p className="text-xs text-slate-500 leading-relaxed">
              Business operations (checkout, customer login, order creation) execute unhindered regardless of n8n availability.
              Events queue safely in the transactional outbox and retry automatically with exponential backoff.
            </p>
          </Container>
        </div>
      </div>

      {/* Webhook Delivery Logs Table */}
      <Container className="p-0 overflow-hidden">
        <div className="p-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <Text className="font-semibold text-sm">Outbound Webhook Delivery Logs</Text>
            <Text className="text-xs text-slate-400">Recent events dispatched to external automation workflows</Text>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg"
            >
              <option value="all">All Statuses</option>
              <option value="DELIVERED">Delivered (200 OK)</option>
              <option value="FAILED">Failed</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50/50 dark:bg-slate-900/50">
                <th className="text-left p-3 text-xs font-semibold text-slate-500">Event ID</th>
                <th className="text-left p-3 text-xs font-semibold text-slate-500">Event Type</th>
                <th className="text-left p-3 text-xs font-semibold text-slate-500">Dispatched At</th>
                <th className="text-left p-3 text-xs font-semibold text-slate-500">HTTP Status</th>
                <th className="text-left p-3 text-xs font-semibold text-slate-500">Latency</th>
                <th className="text-left p-3 text-xs font-semibold text-slate-500">Delivery Status</th>
                <th className="text-right p-3 text-xs font-semibold text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-400 text-xs">
                    No webhook delivery records found matching filters.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="border-b hover:bg-slate-50/80 dark:hover:bg-slate-900/80 transition-colors">
                    <td className="p-3 font-mono text-xs font-semibold text-slate-700 dark:text-slate-200">
                      {log.event_id}
                    </td>
                    <td className="p-3">
                      <span className="font-mono text-xs px-2 py-0.5 bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 rounded border border-purple-200 dark:border-purple-800">
                        {log.event_type}
                      </span>
                    </td>
                    <td className="p-3 text-xs text-slate-500">
                      {new Date(log.dispatched_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </td>
                    <td className="p-3 text-xs font-mono">
                      {log.http_status ? (
                        <span className={log.http_status >= 200 && log.http_status < 300 ? "text-emerald-600 font-bold" : "text-red-600 font-bold"}>
                          {log.http_status}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="p-3 text-xs text-slate-500 font-mono">
                      {log.duration_ms}ms
                    </td>
                    <td className="p-3">
                      <StatusBadge
                        color={log.status === "DELIVERED" ? "green" : "red"}
                        className="text-[10px]"
                      >
                        {log.status === "DELIVERED" ? "Delivered" : "Failed"}
                      </StatusBadge>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setInspectLog(log)}
                          className="px-2 py-1 text-xs text-purple-600 hover:bg-purple-50 rounded"
                        >
                          View Payload
                        </button>
                        {log.status === "FAILED" && (
                          <button
                            onClick={() => handleRetryLog(log.outbox_id)}
                            className="px-2 py-1 text-xs bg-amber-50 text-amber-700 hover:bg-amber-100 rounded"
                          >
                            Retry
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
      </Container>

      {/* Payload Inspector Modal */}
      {inspectLog && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full p-6 flex flex-col gap-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <Heading level="h3" className="text-base font-bold">
                  Webhook Payload Inspector
                </Heading>
                <Text className="text-xs font-mono text-purple-600">{inspectLog.event_type} ({inspectLog.event_id})</Text>
              </div>
              <button
                onClick={() => setInspectLog(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col gap-2">
              <Text className="text-xs font-semibold text-slate-600 dark:text-slate-300">HTTP Request Headers</Text>
              <pre className="p-3 bg-slate-950 text-emerald-400 rounded-xl font-mono text-xs overflow-x-auto">
                {JSON.stringify(inspectLog.request_headers || {}, null, 2)}
              </pre>
            </div>

            <div className="flex flex-col gap-2">
              <Text className="text-xs font-semibold text-slate-600 dark:text-slate-300">Sanitized Event Payload (Envelope)</Text>
              <pre className="p-3 bg-slate-950 text-slate-100 rounded-xl font-mono text-xs overflow-x-auto max-h-60">
                {JSON.stringify(inspectLog.request_payload || {}, null, 2)}
              </pre>
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="secondary" onClick={() => setInspectLog(null)}>
                Close Inspector
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
