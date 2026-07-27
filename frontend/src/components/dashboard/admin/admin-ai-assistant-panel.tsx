"use client";

import { useState } from "react";
import { Container, Heading, Text, Badge, Button, Input, Textarea } from "@medusajs/ui";
import { Bot, Sparkles, Send, CheckCircle2, TrendingUp, AlertTriangle, FileText, Megaphone, Tag, ShieldCheck } from "lucide-react";
import { apiClient } from "@frontend/lib/api-client";

export function AdminAiAssistantPanel() {
  const [prompt, setPrompt] = useState("");
  const [executing, setExecuting] = useState(false);
  const [activeTask, setActiveTask] = useState<string | null>(null);
  const [logs, setLogs] = useState<any[]>([
    { id: "1", task: "Auto-Optimized SEO Meta Tags for 24 Product Slugs", type: "seo", time: "10 mins ago", status: "completed" },
    { id: "2", task: "Generated Monsoon Festive Campaign 'CAKE50' with ₹150 Cap", type: "campaign", time: "1 hour ago", status: "completed" },
    { id: "3", task: "Drafted Blog Article: 'Top 7 Birthday Cake Flavors in Bangalore 2026'", type: "content", time: "3 hours ago", status: "completed" },
    { id: "4", task: "Detected 14 Customers At Risk of Churn — Auto-sent ₹100 Winback Coupon", type: "crm", time: "5 hours ago", status: "completed" },
  ]);

  const handleRunAiTask = (taskTitle: string) => {
    setActiveTask(taskTitle);
    setExecuting(true);

    setTimeout(() => {
      const newLog = {
        id: String(Date.now()),
        task: `AI Executed: ${taskTitle}`,
        type: "auto",
        time: "Just now",
        status: "completed",
      };
      setLogs((prev) => [newLog, ...prev]);
      setExecuting(false);
      setActiveTask(null);
    }, 1500);
  };

  const handleCustomPrompt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    handleRunAiTask(prompt);
    setPrompt("");
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Heading level="h2" className="text-xl">🤖 Autonomous Super Admin AI Command Center</Heading>
          <Text className="text-ui-fg-subtle text-sm">Automate platform growth, SEO generation, marketing campaigns, churn prevention, and demand forecasting using AI agents.</Text>
        </div>
        <Badge color="purple" className="flex items-center gap-1 w-fit">
          <Sparkles className="w-3.5 h-3.5" /> CakeToHome Autonomous AI v1.0
        </Badge>
      </div>

      {/* Quick Action One-Click AI Automation Buttons */}
      <Container className="p-6 bg-gradient-to-br from-purple-500/10 via-amber-500/5 to-transparent border-2 border-purple-500/30">
        <Text className="text-xs font-semibold text-ui-fg-subtle uppercase tracking-wider mb-4 block">
          One-Click AI Growth & Automation Playbooks
        </Text>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => handleRunAiTask("Auto-Generate SEO Titles, Meta Descriptions & Alt Texts for All Catalog Products")}
            className="p-4 bg-ui-bg-subtle hover:bg-purple-500/10 border hover:border-purple-500 rounded-xl text-left transition-all flex flex-col gap-2 group"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600 group-hover:scale-110 transition-transform" />
              <Text className="font-semibold text-sm">Auto-Generate Product SEO</Text>
            </div>
            <Text className="text-xs text-ui-fg-subtle">Automatically write Meta Titles, Descriptions, Keywords, and Image Alt Texts.</Text>
          </button>

          <button
            onClick={() => handleRunAiTask("Draft & Schedule Weekend WhatsApp Campaign for Chocolate Cakes")}
            className="p-4 bg-ui-bg-subtle hover:bg-emerald-500/10 border hover:border-emerald-500 rounded-xl text-left transition-all flex flex-col gap-2 group"
          >
            <div className="flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-emerald-600 group-hover:scale-110 transition-transform" />
              <Text className="font-semibold text-sm">Draft WhatsApp Campaign</Text>
            </div>
            <Text className="text-xs text-ui-fg-subtle">Create personalized WhatsApp discount messages for weekend shoppers.</Text>
          </button>

          <button
            onClick={() => handleRunAiTask("Generate Weekly Revenue Forecast & Detect Low-Performing Products")}
            className="p-4 bg-ui-bg-subtle hover:bg-blue-500/10 border hover:border-blue-500 rounded-xl text-left transition-all flex flex-col gap-2 group"
          >
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600 group-hover:scale-110 transition-transform" />
              <Text className="font-semibold text-sm">Predict Sales & Churn</Text>
            </div>
            <Text className="text-xs text-ui-fg-subtle">Forecast 30-day demand and trigger win-back coupons for at-risk customers.</Text>
          </button>
        </div>
      </Container>

      {/* Interactive AI Prompt Box */}
      <Container className="p-6">
        <Text className="text-xs font-semibold text-ui-fg-subtle uppercase tracking-wider mb-3 block">
          Instruct Super Admin AI Agent
        </Text>
        <form onSubmit={handleCustomPrompt} className="flex gap-3">
          <Input
            placeholder="e.g. Generate 5 festival coupons for Rakhi with 20% off and 100% eggless tags..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" isLoading={executing} className="bg-purple-600 hover:bg-purple-700 text-white shrink-0 flex items-center gap-1.5">
            <Send className="w-4 h-4" /> Run AI Task
          </Button>
        </form>
        {activeTask && (
          <div className="mt-3 p-3 bg-purple-50 dark:bg-purple-950/40 border border-purple-300 text-purple-800 dark:text-purple-200 text-xs rounded flex items-center gap-2 animate-pulse">
            <Bot className="w-4 h-4 text-purple-600" />
            <span>AI Executing: <strong>{activeTask}</strong>...</span>
          </div>
        )}
      </Container>

      {/* AI Automation Logs */}
      <Container className="p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between border-b pb-3">
          <Text className="text-xs font-semibold text-ui-fg-subtle uppercase tracking-wider">
            Autonomous AI Agent Execution History ({logs.length})
          </Text>
          <Badge color="green">Autonomous Runner Active</Badge>
        </div>

        <div className="flex flex-col gap-2">
          {logs.map((log) => (
            <div key={log.id} className="flex items-center justify-between p-3 bg-ui-bg-subtle rounded-lg text-xs border">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span className="font-medium text-ui-fg-base">{log.task}</span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <Badge color="purple" className="uppercase text-[10px]">{log.type}</Badge>
                <span className="text-ui-fg-muted text-[11px]">{log.time}</span>
              </div>
            </div>
          ))}
        </div>
      </Container>
    </div>
  );
}
