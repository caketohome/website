"use client";

import { useState } from "react";
import { Container, Heading, Text, Badge, Button, Input, Label } from "@medusajs/ui";
import { FlaskConical, Trophy, Sparkles, Plus, TrendingUp, CheckCircle2 } from "lucide-react";

export function AbTestingPanel() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState("");
  const [targetElement, setTargetElement] = useState("Homepage Hero Headline");
  const [variantA, setVariantA] = useState("");
  const [variantB, setVariantB] = useState("");

  const [tests, setTests] = useState([
    {
      id: "ab_101",
      name: "Homepage Hero Headline Split Test",
      target: "Storefront Banner",
      variantA: "Handcrafted Gourmet Cakes Delivered in 2 Hours",
      variantB: "Order Fresh Birthday & Anniversary Cakes Online",
      trafficA: 520,
      trafficB: 512,
      convA: "4.2%",
      convB: "5.8%",
      winner: "Variant B",
      status: "winner_selected",
      confidence: "98.4%",
    },
    {
      id: "ab_102",
      name: "Checkout CTA Button Color",
      target: "Cart Drawer CTA",
      variantA: "Emerald Green (#10b981)",
      variantB: "Gold Amber (#f59e0b)",
      trafficA: 340,
      trafficB: 335,
      convA: "6.1%",
      convB: "6.4%",
      winner: "Variant B",
      status: "running",
      confidence: "82.1%",
    },
  ]);

  const handleCreateTest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newTest = {
      id: `ab_${Date.now()}`,
      name,
      target: targetElement,
      variantA: variantA || "Original Version A",
      variantB: variantB || "Challenger Version B",
      trafficA: 0,
      trafficB: 0,
      convA: "0%",
      convB: "0%",
      winner: "Running...",
      status: "running",
      confidence: "50%",
    };

    setTests((prev) => [newTest, ...prev]);
    setName("");
    setVariantA("");
    setVariantB("");
    setShowCreateModal(false);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Heading level="h2" className="text-xl">🧪 A/B Split Testing & Conversion Optimization Engine</Heading>
          <Text className="text-ui-fg-subtle text-sm">Run split tests on headlines, CTA buttons, banners, prices, and offers. AI auto-selects winning variants.</Text>
        </div>
        <Button size="small" onClick={() => setShowCreateModal(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shrink-0">
          <Plus className="w-4 h-4" /> Create New A/B Experiment
        </Button>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <Container className="p-6 border-2 border-emerald-500/40 bg-emerald-50/20 dark:bg-emerald-950/20">
          <div className="flex items-center justify-between mb-4">
            <Text className="font-semibold text-base">Launch New A/B Split Test</Text>
            <button onClick={() => setShowCreateModal(false)} className="text-xs text-ui-fg-subtle hover:underline">Close</button>
          </div>

          <form onSubmit={handleCreateTest} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="ab_name">Experiment Name</Label>
              <Input id="ab_name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Free Delivery Threshold Split Test" required />
            </div>
            <div>
              <Label htmlFor="ab_target">Target Component</Label>
              <Input id="ab_target" value={targetElement} onChange={(e) => setTargetElement(e.target.value)} placeholder="Homepage Hero Banner" />
            </div>
            <div>
              <Label htmlFor="var_a">Variant A (Control)</Label>
              <Input id="var_a" value={variantA} onChange={(e) => setVariantA(e.target.value)} placeholder="Original Copy / Style" required />
            </div>
            <div>
              <Label htmlFor="var_b">Variant B (Challenger)</Label>
              <Input id="var_b" value={variantB} onChange={(e) => setVariantB(e.target.value)} placeholder="New Hypothesis Copy / Style" required />
            </div>
            <div className="md:col-span-2 flex justify-end gap-3 mt-2">
              <Button type="button" variant="secondary" onClick={() => setShowCreateModal(false)}>Cancel</Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white">Start Split Test</Button>
            </div>
          </form>
        </Container>
      )}

      {/* Active Experiments Cards */}
      <div className="flex flex-col gap-4">
        {tests.map((test) => (
          <Container key={test.id} className="p-5 flex flex-col gap-4 border">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b pb-3">
              <div className="flex items-center gap-2">
                <FlaskConical className="w-5 h-5 text-emerald-600" />
                <div>
                  <Text className="font-semibold text-sm">{test.name}</Text>
                  <Text className="text-xs text-ui-fg-subtle">Target: {test.target}</Text>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge color={test.status === "winner_selected" ? "green" : "blue"}>
                  {test.status === "winner_selected" ? "🏆 Winner Applied (100% Traffic)" : "⚡ Experiment Running"}
                </Badge>
                <Badge color="purple">Confidence: {test.confidence}</Badge>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 bg-ui-bg-subtle rounded-xl flex flex-col gap-2 border">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-blue-600">Variant A (Control)</span>
                  <span>{test.trafficA} visitors</span>
                </div>
                <Text className="text-xs font-mono bg-ui-bg-base p-2 rounded">{test.variantA}</Text>
                <div className="flex items-center justify-between font-bold pt-1">
                  <span>Conversion Rate:</span>
                  <span className="text-blue-600 text-sm">{test.convA}</span>
                </div>
              </div>

              <div className="p-4 bg-ui-bg-subtle rounded-xl flex flex-col gap-2 border border-emerald-500/40">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-emerald-600">Variant B (Challenger)</span>
                  <span>{test.trafficB} visitors</span>
                </div>
                <Text className="text-xs font-mono bg-ui-bg-base p-2 rounded">{test.variantB}</Text>
                <div className="flex items-center justify-between font-bold pt-1">
                  <span>Conversion Rate:</span>
                  <span className="text-emerald-600 text-sm">{test.convB}</span>
                </div>
              </div>
            </div>
          </Container>
        ))}
      </div>
    </div>
  );
}
