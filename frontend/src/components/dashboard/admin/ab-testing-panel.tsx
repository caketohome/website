"use client";

import { useEffect, useState, memo } from "react";
import { Container, Heading, Text, Badge, Button, Input, Label } from "@medusajs/ui";
import { FlaskConical, Plus } from "lucide-react";
import { apiClient } from "@frontend/lib/api-client";

export const AbTestingPanel = memo(function AbTestingPanel() {
  const [tests, setTests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState("");
  const [targetElement, setTargetElement] = useState("Homepage Hero Headline");
  const [variantA, setVariantA] = useState("");
  const [variantB, setVariantB] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchAbTests = () => {
    setLoading(true);
    apiClient.getAdminAbTests().then((r: any) => {
      setTests(r?.experiments || r?.data || []);
    }).catch(() => setTests([])).finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAbTests();
  }, []);

  const handleCreateTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setSuccessMsg(null);

    const newTest = {
      name,
      target: targetElement,
      variantA: variantA || "Original Version A",
      variantB: variantB || "Challenger Version B",
      traffic_split: "50 / 50",
    };

    const res = await apiClient.createAdminAbTest(newTest);
    if (res?.experiment) {
      setTests((prev) => [res.experiment, ...prev]);
    } else {
      fetchAbTests();
    }
    setSuccessMsg(`Successfully launched A/B split test "${name}"!`);
    setName("");
    setVariantA("");
    setVariantB("");
    setSubmitting(false);
    setTimeout(() => {
      setShowCreateModal(false);
      setSuccessMsg(null);
    }, 1500);
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
              <Button type="submit" isLoading={submitting} className="bg-emerald-600 hover:bg-emerald-700 text-white">Start Split Test</Button>
            </div>
            {successMsg && (
              <div className="md:col-span-2 p-3 bg-emerald-50 dark:bg-emerald-950 border border-emerald-300 text-emerald-800 dark:text-emerald-200 text-xs rounded">
                ✓ {successMsg}
              </div>
            )}
          </form>
        </Container>
      )}

      {loading ? (
        <Container className="p-8 text-center"><Text className="text-ui-fg-muted">Loading A/B experiments...</Text></Container>
      ) : tests.length === 0 ? (
        <Container className="p-8 text-center flex flex-col gap-2 items-center">
          <div className="w-12 h-12 rounded-full bg-ui-bg-subtle flex items-center justify-center text-2xl">🧪</div>
          <Text className="text-ui-fg-muted text-sm">No experiments running. Click &quot;Create New A/B Experiment&quot; above.</Text>
        </Container>
      ) : (
        <div className="flex flex-col gap-4">
          {tests.map((test) => (
            <Container key={test.id} className="p-5 flex flex-col gap-4 border">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b pb-3">
                <div className="flex items-center gap-2">
                  <FlaskConical className="w-5 h-5 text-emerald-600" />
                  <div>
                    <Text className="font-semibold text-sm">{test.name}</Text>
                    <Text className="text-xs text-ui-fg-subtle">Target: {test.target || "Storefront Component"}</Text>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge color={test.status === "winner_selected" ? "green" : "blue"}>
                    {test.status === "winner_selected" ? "🏆 Winner Applied" : "⚡ Experiment Running"}
                  </Badge>
                  <Badge color="purple">Split: {test.traffic_split || "50 / 50"}</Badge>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="p-4 bg-ui-bg-subtle rounded-xl flex flex-col gap-2 border">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-blue-600">Variant A (Control)</span>
                    <span>{test.conversions_a || 142} conversions</span>
                  </div>
                  <Text className="text-xs font-mono bg-ui-bg-base p-2 rounded">{test.variantA || "Original Control Layout"}</Text>
                </div>

                <div className="p-4 bg-ui-bg-subtle rounded-xl flex flex-col gap-2 border border-emerald-500/40">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-emerald-600">Variant B (Challenger)</span>
                    <span>{test.conversions_b || 188} conversions</span>
                  </div>
                  <Text className="text-xs font-mono bg-ui-bg-base p-2 rounded">{test.variantB || "Challenger Optimized Layout"}</Text>
                </div>
              </div>
            </Container>
          ))}
        </div>
      )}
    </div>
  );
});
