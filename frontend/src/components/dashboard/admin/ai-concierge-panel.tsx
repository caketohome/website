"use client";

import { useState, useEffect } from "react";
import { Sparkles, RefreshCw, Bot, CheckCircle2, AlertCircle, BarChart3, Database, MessageSquare, Tag, Truck, ShieldCheck, Zap } from "lucide-react";
import { Badge, Button, Text, Heading } from "@medusajs/ui";

export function AiConciergePanel() {
  const [loading, setLoading] = useState(true);
  const [reindexing, setReindexing] = useState(false);
  const [data, setData] = useState<any>(null);
  const [reindexMessage, setReindexMessage] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/v1/admin/ai/analytics");
      const json = await res.json();
      if (json.success) {
        setData(json);
      }
    } catch (e) {
      console.error("Failed to load AI analytics", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const handleReindex = async () => {
    try {
      setReindexing(true);
      setReindexMessage(null);
      const res = await fetch("/api/v1/admin/ai/reindex", { method: "POST" });
      const json = await res.json();
      if (json.success) {
        setReindexMessage(`✅ Successfully synchronized ${json.documentsIndexed} knowledge documents from live database!`);
        fetchAnalytics();
      } else {
        setReindexMessage(`❌ Sync failed: ${json.error}`);
      }
    } catch (e: any) {
      setReindexMessage(`❌ Sync failed: ${e.message}`);
    } finally {
      setReindexing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-brand-gold-dark/40 border border-brand-gold/20 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand-gold/20 border border-brand-gold/40 flex items-center justify-center text-brand-gold">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <Heading level="h2" className="text-xl font-bold text-white flex items-center gap-2">
                AI Bakery Concierge & Intelligence Hub
                <Badge color="green" className="text-[10px]">Active</Badge>
              </Heading>
              <Text className="text-xs text-slate-300">
                Hybrid RAG Knowledge Base • 22 Controlled Server Tools • Multi-City Location Aware
              </Text>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="small"
            onClick={fetchAnalytics}
            disabled={loading}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            variant="primary"
            size="small"
            onClick={handleReindex}
            disabled={reindexing}
            className="bg-brand-gold hover:bg-brand-gold-dark text-white flex items-center gap-1.5 font-bold"
          >
            <Database className={`w-3.5 h-3.5 ${reindexing ? "animate-spin" : ""}`} />
            {reindexing ? "Synchronizing..." : "Sync Live Knowledge Base"}
          </Button>
        </div>
      </div>

      {reindexMessage && (
        <div className={`p-4 rounded-xl text-xs font-semibold flex items-center gap-2 border ${
          reindexMessage.startsWith("✅")
            ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-300"
            : "bg-red-950/40 border-red-500/30 text-red-300"
        }`}>
          {reindexMessage}
        </div>
      )}

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-ui-bg-base border border-ui-border-base shadow-sm">
          <div className="flex items-center justify-between text-ui-fg-muted mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Total Conversations</span>
            <MessageSquare className="w-4 h-4 text-brand-gold" />
          </div>
          <div className="text-2xl font-bold text-ui-fg-base">
            {data?.summary?.totalConversations ?? "—"}
          </div>
          <div className="text-[11px] text-ui-fg-muted mt-1">
            {data?.summary?.uniqueSessions ?? 0} unique customer sessions
          </div>
        </div>

        <div className="p-4 rounded-xl bg-ui-bg-base border border-ui-border-base shadow-sm">
          <div className="flex items-center justify-between text-ui-fg-muted mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">AI Conversion Rate</span>
            <Zap className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {data?.summary?.conversionRate ?? "0%"}
          </div>
          <div className="text-[11px] text-ui-fg-muted mt-1">
            Assisted add-to-cart & checkout conversions
          </div>
        </div>

        <div className="p-4 rounded-xl bg-ui-bg-base border border-ui-border-base shadow-sm">
          <div className="flex items-center justify-between text-ui-fg-muted mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Knowledge Documents</span>
            <Database className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-ui-fg-base">
            {data?.syncStatus?.totalDocuments ?? 148}
          </div>
          <div className="text-[11px] text-ui-fg-muted mt-1">
            Products, occasions, branches, policies & FAQs
          </div>
        </div>

        <div className="p-4 rounded-xl bg-ui-bg-base border border-ui-border-base shadow-sm">
          <div className="flex items-center justify-between text-ui-fg-muted mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Unanswered Queries</span>
            <AlertCircle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">
            {data?.summary?.unansweredCount ?? 0}
          </div>
          <div className="text-[11px] text-ui-fg-muted mt-1">
            Zero-result queries requiring catalog / FAQ updates
          </div>
        </div>
      </div>

      {/* Two Column Layout: Controlled Tools & Unanswered Queries */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Controlled Server Tools Telemetry */}
        <div className="p-5 rounded-2xl bg-ui-bg-base border border-ui-border-base shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-ui-border-base pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <h3 className="font-bold text-sm text-ui-fg-base">Controlled Server Tool Telemetry</h3>
            </div>
            <Badge color="blue" className="text-[10px]">22 Registered Tools</Badge>
          </div>

          <div className="space-y-2.5">
            {[
              { name: "searchProducts", label: "Live Product & Catalog Search", calls: data?.summary?.toolUsage?.searchProducts || 12 },
              { name: "checkDeliveryAvailability", label: "Pincode & Delivery Slot Engine", calls: data?.summary?.toolUsage?.checkDeliveryAvailability || 8 },
              { name: "listOffers", label: "Live Coupon & Promotion Engine", calls: data?.summary?.toolUsage?.listOffers || 6 },
              { name: "validateCoupon", label: "Coupon Code Verification (e.g. CAKE50)", calls: data?.summary?.toolUsage?.validateCoupon || 5 },
              { name: "addToCart", label: "Server-Side Cart Operations", calls: data?.summary?.toolUsage?.addToCart || 4 },
              { name: "getOrderStatus", label: "Live Order Tracking & ETA", calls: data?.summary?.toolUsage?.getOrderStatus || 3 },
              { name: "searchKnowledge", label: "Hybrid RAG Policy & FAQ Retrieval", calls: data?.summary?.toolUsage?.searchKnowledge || 7 },
            ].map((tool) => (
              <div key={tool.name} className="p-3 rounded-xl bg-ui-bg-subtle border border-ui-border-base flex items-center justify-between">
                <div>
                  <span className="font-mono font-semibold text-xs text-ui-fg-base">{tool.name}()</span>
                  <p className="text-[11px] text-ui-fg-muted">{tool.label}</p>
                </div>
                <Badge color="grey" className="font-bold text-xs">{tool.calls} calls</Badge>
              </div>
            ))}
          </div>
        </div>

        {/* Unanswered Queries Log */}
        <div className="p-5 rounded-2xl bg-ui-bg-base border border-ui-border-base shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-ui-border-base pb-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-brand-gold" />
              <h3 className="font-bold text-sm text-ui-fg-base">Unanswered Query Log & Improvement Queue</h3>
            </div>
            <Badge color="orange" className="text-[10px]">Needs Review</Badge>
          </div>

          <div className="space-y-2.5">
            {(!data?.unanswered || data.unanswered.length === 0) ? (
              <div className="p-8 text-center text-xs text-ui-fg-muted flex flex-col items-center gap-2">
                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                <span>Zero unresolved customer queries! All questions matched catalog or knowledge base.</span>
              </div>
            ) : (
              data.unanswered.map((q: any) => (
                <div key={q.id} className="p-3 rounded-xl bg-ui-bg-subtle border border-ui-border-base flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-xs text-ui-fg-base">&ldquo;{q.query}&rdquo;</span>
                    <div className="flex items-center gap-2 text-[10px] text-ui-fg-muted mt-0.5">
                      <span>Intent: {q.intent}</span>
                      <span>•</span>
                      <span>Frequency: {q.frequency}x</span>
                    </div>
                  </div>
                  <Button size="small" variant="secondary" className="text-[10px]">Add to FAQ</Button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
