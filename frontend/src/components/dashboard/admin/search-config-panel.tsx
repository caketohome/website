"use client";

import React, { useState, useEffect } from "react";
import {
  Heading,
  Text,
  Badge,
  Button,
  Input,
  Label,
  Select,
} from "@medusajs/ui";
import {
  Search,
  Sliders,
  Tag,
  BookOpen,
  TrendingUp,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Trash2,
  Pin,
  ArrowUpRight,
  ArrowDownRight,
  Layers,
  Sparkles,
  RefreshCw,
  Eye,
  Calendar,
  Shuffle,
  Percent,
} from "lucide-react";
import {
  SearchRankingWeights,
  ProductTag,
  SearchSynonym,
  MerchandisingRule,
  CanonicalProduct,
  DEFAULT_RANKING_WEIGHTS,
} from "../../../lib/search/search-engine";
import { apiClient } from "../../../lib/api-client";

type AdminSearchTab = "mapping" | "ranking" | "merchandising" | "tags" | "synonyms" | "analytics";

export function SearchConfigPanel() {
  const [activeTab, setActiveTab] = useState<AdminSearchTab>("mapping");
  const [loading, setLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Search Engine Data State
  const [weights, setWeights] = useState<SearchRankingWeights>(DEFAULT_RANKING_WEIGHTS);
  const [tags, setTags] = useState<ProductTag[]>([]);
  const [synonyms, setSynonyms] = useState<SearchSynonym[]>([]);
  const [rules, setRules] = useState<MerchandisingRule[]>([]);
  const [canonicalProducts, setCanonicalProducts] = useState<CanonicalProduct[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);

  // New Tag Form State
  const [newTagName, setNewTagName] = useState("");
  const [newTagSlug, setNewTagSlug] = useState("");
  const [newTagType, setNewTagType] = useState<ProductTag["type"]>("flavour");
  const [newTagWeight, setNewTagWeight] = useState(50);

  // New Synonym Form State
  const [newSynTerm, setNewSynTerm] = useState("");
  const [newSynList, setNewSynList] = useState("");
  const [newSynOneWay, setNewSynOneWay] = useState(true);

  // New Merchandising Rule Form State
  const [newRuleName, setNewRuleName] = useState("");
  const [newRuleType, setNewRuleType] = useState<"boost" | "bury" | "pin">("boost");
  const [newRuleQuery, setNewRuleQuery] = useState("");
  const [newRuleTargetType, setNewRuleTargetType] = useState<"product" | "category" | "tag">("product");
  const [newRuleTargetId, setNewRuleTargetId] = useState("");
  const [newRuleScoreDelta, setNewRuleScoreDelta] = useState(30);

  const fetchSearchData = async () => {
    setLoading(true);
    try {
      const [configRes, productsRes] = await Promise.all([
        fetch("/api/v1/search/config").then((r) => r.json()),
        fetch("/api/v1/search/canonical-products").then((r) => r.json()),
      ]);

      if (configRes?.config) {
        setWeights(configRes.config.weights || DEFAULT_RANKING_WEIGHTS);
        setTags(configRes.config.tags || []);
        setSynonyms(configRes.config.synonyms || []);
        setRules(configRes.config.rules || []);
        setAnalytics(configRes.config.analytics || null);
      }

      if (productsRes?.products) {
        setCanonicalProducts(productsRes.products);
      }
    } catch (err) {
      console.error("Failed to load search engine admin data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSearchData();
  }, []);

  const showSuccessNotice = () => {
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  // ── Save Ranking Weights ──────────────────────────────────────────────────
  const handleSaveWeights = async () => {
    try {
      await fetch("/api/v1/search/weights", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(weights),
      });
      showSuccessNotice();
    } catch (err) {
      console.error("Failed to save ranking weights:", err);
    }
  };

  // ── Tag Handlers ──────────────────────────────────────────────────────────
  const handleCreateTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagName.trim()) return;
    const tag: ProductTag = {
      tag_id: `tag_${Date.now()}`,
      name: newTagName.trim(),
      slug: newTagSlug.trim() || newTagName.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      type: newTagType,
      display_name: newTagName.trim(),
      search_weight: newTagWeight,
      status: "active",
    };

    try {
      await fetch("/api/v1/search/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tag),
      });
      setTags((prev) => [...prev, tag]);
      setNewTagName("");
      setNewTagSlug("");
      showSuccessNotice();
    } catch (err) {
      console.error("Failed to create tag:", err);
    }
  };

  const handleDeleteTag = async (tagId: string) => {
    try {
      await fetch(`/api/v1/search/tags/${tagId}`, { method: "DELETE" });
      setTags((prev) => prev.filter((t) => t.tag_id !== tagId));
      showSuccessNotice();
    } catch (err) {
      console.error("Failed to delete tag:", err);
    }
  };

  // ── Synonym Handlers ──────────────────────────────────────────────────────
  const handleCreateSynonym = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSynTerm.trim() || !newSynList.trim()) return;
    const syn: SearchSynonym = {
      id: `syn_${Date.now()}`,
      term: newSynTerm.trim().toLowerCase(),
      synonyms: newSynList.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
      is_bidirectional: !newSynOneWay,
    };

    try {
      await fetch("/api/v1/search/synonyms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(syn),
      });
      setSynonyms((prev) => [...prev, syn]);
      setNewSynTerm("");
      setNewSynList("");
      showSuccessNotice();
    } catch (err) {
      console.error("Failed to create synonym:", err);
    }
  };

  const handleDeleteSynonym = async (id: string) => {
    try {
      await fetch(`/api/v1/search/synonyms/${id}`, { method: "DELETE" });
      setSynonyms((prev) => prev.filter((s) => s.id !== id));
      showSuccessNotice();
    } catch (err) {
      console.error("Failed to delete synonym:", err);
    }
  };

  // ── Merchandising Rule Handlers ───────────────────────────────────────────
  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRuleName.trim() || !newRuleQuery.trim() || !newRuleTargetId.trim()) return;
    const rule: MerchandisingRule = {
      id: `rule_${Date.now()}`,
      name: newRuleName.trim(),
      type: newRuleType,
      query_pattern: newRuleQuery.trim().toLowerCase(),
      target_type: newRuleTargetType,
      target_id: newRuleTargetId.trim(),
      score_delta: newRuleType === "pin" ? 1000 : newRuleType === "bury" ? -Math.abs(newRuleScoreDelta) : Math.abs(newRuleScoreDelta),
      status: "active",
    };

    try {
      await fetch("/api/v1/search/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rule),
      });
      setRules((prev) => [...prev, rule]);
      setNewRuleName("");
      setNewRuleQuery("");
      setNewRuleTargetId("");
      showSuccessNotice();
    } catch (err) {
      console.error("Failed to create merchandising rule:", err);
    }
  };

  const handleDeleteRule = async (id: string) => {
    try {
      await fetch(`/api/v1/search/rules/${id}`, { method: "DELETE" });
      setRules((prev) => prev.filter((r) => r.id !== id));
      showSuccessNotice();
    } catch (err) {
      console.error("Failed to delete rule:", err);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-7xl mx-auto">
      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-ui-border-base">
        <div>
          <div className="flex items-center gap-2">
            <Search className="w-6 h-6 text-rose-600" />
            <Heading level="h1" className="text-xl sm:text-2xl font-black tracking-tight">
              Enterprise Search & Product Mapping Engine
            </Heading>
          </div>
          <Text className="text-xs sm:text-sm text-ui-fg-muted mt-1">
            Canonical multi-source ingestion, query normalization, dynamic ranking weights, merchandising boosts & analytics.
          </Text>
        </div>

        <div className="flex items-center gap-2">
          {saveSuccess && (
            <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5" /> Saved & Synchronized
            </span>
          )}
          <Button variant="secondary" size="small" onClick={fetchSearchData} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </div>

      {/* ── NAVIGATION TABS ── */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-ui-border-base scrollbar-none text-xs font-bold">
        {[
          { id: "mapping" as const, label: "Product Mapping & Deduplication", icon: Layers, count: canonicalProducts.length },
          { id: "ranking" as const, label: "Ranking & Weights", icon: Sliders },
          { id: "merchandising" as const, label: "Merchandising Rules (Pin/Boost)", icon: Zap, count: rules.length },
          { id: "tags" as const, label: "Tags & Taxonomies", icon: Tag, count: tags.length },
          { id: "synonyms" as const, label: "Synonyms & Aliases", icon: BookOpen, count: synonyms.length },
          { id: "analytics" as const, label: "Search & Zero-Result Analytics", icon: TrendingUp },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-2 rounded-xl flex items-center gap-2 whitespace-nowrap transition-all text-xs font-bold ${
                isActive
                  ? "bg-rose-500 text-white shadow-sm"
                  : "text-ui-fg-muted hover:bg-ui-bg-subtle hover:text-ui-fg-base"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${isActive ? "bg-white/20 text-white" : "bg-ui-bg-subtle text-ui-fg-muted"}`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* 1. PRODUCT MAPPING & DEDUPLICATION */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeTab === "mapping" && (
        <div className="flex flex-col gap-4">
          <div className="p-4 bg-ui-bg-subtle rounded-2xl border border-ui-border-base flex flex-col gap-1.5">
            <Text className="text-xs font-bold text-rose-600 uppercase">Single Canonical Product Identity</Text>
            <Text className="text-xs text-ui-fg-muted leading-relaxed">
              Every real-world cake maps to <strong>ONE canonical product</strong> with aggregated variants (0.5kg, 1kg, 2kg). Customers never see duplicate search result cards for the same product across Medusa, CMS, and local inventory.
            </Text>
          </div>

          <div className="border border-ui-border-base rounded-2xl overflow-hidden bg-ui-bg-base shadow-sm">
            <div className="p-3 bg-ui-bg-subtle border-b border-ui-border-base flex items-center justify-between text-xs font-bold">
              <span>Canonical Products & Multi-Source Mappings ({canonicalProducts.length})</span>
              <span className="text-[11px] text-ui-fg-muted font-normal">All variants grouped into single search documents</span>
            </div>

            <div className="divide-y divide-ui-border-base max-h-[550px] overflow-y-auto">
              {canonicalProducts.map((p) => (
                <div key={p.canonical_product_id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-ui-bg-subtle/50 transition-colors">
                  <div className="flex items-center gap-3.5 min-w-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.image}
                      alt={p.name}
                      className="w-12 h-12 rounded-xl object-cover border shrink-0"
                    />
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs sm:text-sm text-ui-fg-base truncate">{p.name}</span>
                        <Badge color="blue" className="text-[9px] font-mono shrink-0">
                          {p.category}
                        </Badge>
                        {p.is_bestseller && (
                          <Badge color="green" className="text-[9px] shrink-0">Bestseller</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-ui-fg-muted mt-0.5">
                        <span className="font-mono text-[10px] text-ui-fg-subtle">{p.canonical_product_id}</span>
                        <span>•</span>
                        <span>₹{p.selling_price}</span>
                        <span>•</span>
                        <span>{p.variants.length} Weight Variants ({p.variants.map((v) => v.weight).join(", ")})</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      ✓ 100% Match Approved
                    </span>
                    <Button variant="secondary" size="small" className="text-xs">
                      Inspect
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* 2. RANKING & WEIGHTS */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeTab === "ranking" && (
        <div className="flex flex-col gap-5">
          <div className="p-4 bg-ui-bg-subtle rounded-2xl border border-ui-border-base flex items-center justify-between">
            <div>
              <Text className="text-xs font-bold text-rose-600 uppercase">Search Relevance Scoring Matrix</Text>
              <Text className="text-xs text-ui-fg-muted">
                Adjust the dynamic weight parameters (0–100) that determine search rank ordering.
              </Text>
            </div>
            <Button variant="primary" size="small" onClick={handleSaveWeights} className="font-bold">
              Save Ranking Weights
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { key: "exact_match_weight" as const, label: "Exact Title Match Weight", hint: "Boost when title matches search query exactly", val: weights.exact_match_weight },
              { key: "phrase_match_weight" as const, label: "Phrase Match Weight", hint: "Boost when full search phrase appears in title", val: weights.phrase_match_weight },
              { key: "name_match_weight" as const, label: "Name Token Match Weight", hint: "Relevance score per matched keyword token in name", val: weights.name_match_weight },
              { key: "category_match_weight" as const, label: "Category Match Weight", hint: "Boost when query matches category name or slug", val: weights.category_match_weight },
              { key: "flavour_match_weight" as const, label: "Flavour Match Weight", hint: "Boost when query matches cake flavour (Mango, Truffle, etc.)", val: weights.flavour_match_weight },
              { key: "tag_match_weight" as const, label: "Tag Match Weight", hint: "Relevance boost for matched tags", val: weights.tag_match_weight },
              { key: "synonym_match_weight" as const, label: "Synonym Match Weight", hint: "Boost for matched synonyms ('choc' -> 'chocolate')", val: weights.synonym_match_weight },
              { key: "availability_weight" as const, label: "Availability & In-Stock Boost", hint: "Promotes items in stock and deprioritizes out of stock", val: weights.availability_weight },
              { key: "popularity_weight" as const, label: "Popularity Score Weight", hint: "Boost items with high overall view counts", val: weights.popularity_weight },
              { key: "rating_weight" as const, label: "Customer Rating Weight", hint: "Promotes 4.8+ star rated celebration cakes", val: weights.rating_weight },
              { key: "sales_velocity_weight" as const, label: "Sales Velocity Weight", hint: "Promotes trending items ordered most frequently today", val: weights.sales_velocity_weight },
              { key: "top_results_count" as const, label: "Top Results Display Count", hint: "Number of dynamic top results returned by default (6-24)", val: weights.top_results_count, min: 4, max: 48 },
            ].map((item) => (
              <div key={item.key} className="p-4 bg-ui-bg-base border border-ui-border-base rounded-2xl flex flex-col gap-2 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-ui-fg-base">{item.label}</span>
                  <span className="text-xs font-mono font-black text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded-lg border border-rose-200">
                    {item.val}
                  </span>
                </div>
                <input
                  type="range"
                  min={item.min || 0}
                  max={item.max || 100}
                  value={item.val}
                  onChange={(e) => setWeights({ ...weights, [item.key]: Number(e.target.value) })}
                  className="w-full accent-rose-500 cursor-pointer"
                />
                <Text className="text-[11px] text-ui-fg-muted">{item.hint}</Text>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* 3. MERCHANDISING RULES (PIN, BOOST, BURY) */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeTab === "merchandising" && (
        <div className="flex flex-col gap-5">
          {/* Create Rule Form */}
          <form onSubmit={handleCreateRule} className="p-4 bg-ui-bg-subtle rounded-2xl border border-ui-border-base flex flex-col gap-3">
            <Text className="text-xs font-bold text-rose-600 uppercase">Create Dynamic Merchandising Rule</Text>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex flex-col gap-1">
                <Label className="text-xs font-semibold">Rule Name</Label>
                <Input value={newRuleName} onChange={(e) => setNewRuleName(e.target.value)} placeholder="e.g. Birthday Hero Boost" />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs font-semibold">Action Type</Label>
                <Select value={newRuleType} onValueChange={(v) => setNewRuleType(v as any)}>
                  <Select.Trigger><Select.Value /></Select.Trigger>
                  <Select.Content>
                    <Select.Item value="boost">⚡ Boost (+ Score)</Select.Item>
                    <Select.Item value="pin">📌 Pin to Top (Pos 1)</Select.Item>
                    <Select.Item value="bury">⬇️ Bury (- Score)</Select.Item>
                  </Select.Content>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs font-semibold">When Search Query Contains</Label>
                <Input value={newRuleQuery} onChange={(e) => setNewRuleQuery(e.target.value)} placeholder="e.g. birthday, chocolate, *" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex flex-col gap-1">
                <Label className="text-xs font-semibold">Target Type</Label>
                <Select value={newRuleTargetType} onValueChange={(v) => setNewRuleTargetType(v as any)}>
                  <Select.Trigger><Select.Value /></Select.Trigger>
                  <Select.Content>
                    <Select.Item value="product">Specific Product</Select.Item>
                    <Select.Item value="category">Category Slug</Select.Item>
                    <Select.Item value="tag">Product Tag</Select.Item>
                  </Select.Content>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs font-semibold">Target Value / Slug / ID</Label>
                <Input value={newRuleTargetId} onChange={(e) => setNewRuleTargetId(e.target.value)} placeholder="e.g. prod_1, chocolate-cakes, bestseller" />
              </div>
              <div className="flex items-end">
                <Button type="submit" variant="primary" className="w-full font-bold">
                  <Plus className="w-4 h-4 mr-1" /> Add Merchandising Rule
                </Button>
              </div>
            </div>
          </form>

          {/* Rules List */}
          <div className="border border-ui-border-base rounded-2xl overflow-hidden bg-ui-bg-base shadow-sm">
            <div className="p-3 bg-ui-bg-subtle border-b border-ui-border-base flex items-center justify-between text-xs font-bold">
              <span>Active Merchandising Rules ({rules.length})</span>
              <span className="text-[11px] text-ui-fg-muted font-normal">Controlled ranking boosts applied dynamically</span>
            </div>

            <div className="divide-y divide-ui-border-base">
              {rules.length === 0 ? (
                <div className="p-8 text-center text-xs text-ui-fg-muted">
                  No custom boost/pin rules created yet. Default relevance scoring active.
                </div>
              ) : (
                rules.map((rule) => (
                  <div key={rule.id} className="p-4 flex items-center justify-between gap-3 hover:bg-ui-bg-subtle/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl ${rule.type === "pin" ? "bg-brand-light text-brand-navy" : rule.type === "boost" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                        {rule.type === "pin" ? <Pin className="w-4 h-4" /> : rule.type === "boost" ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-ui-fg-base">{rule.name}</span>
                        <div className="flex items-center gap-2 text-[11px] text-ui-fg-muted mt-0.5">
                          <span>Query: <strong className="text-ui-fg-base font-mono">"{rule.query_pattern}"</strong></span>
                          <span>•</span>
                          <span>Target: <strong className="text-ui-fg-base font-mono">{rule.target_type}:{rule.target_id}</strong></span>
                          <span>•</span>
                          <span className="font-bold text-rose-600">{rule.type === "pin" ? "PINNED" : `${rule.score_delta > 0 ? "+" : ""}${rule.score_delta} Score`}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteRule(rule.id)}
                      className="p-1.5 rounded-lg text-ui-fg-muted hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                      title="Delete Rule"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* 4. TAGS & TAXONOMIES */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeTab === "tags" && (
        <div className="flex flex-col gap-5">
          {/* Create Tag Form */}
          <form onSubmit={handleCreateTag} className="p-4 bg-ui-bg-subtle rounded-2xl border border-ui-border-base flex flex-col gap-3">
            <Text className="text-xs font-bold text-rose-600 uppercase">Create Managed Product Tag</Text>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="flex flex-col gap-1">
                <Label className="text-xs font-semibold">Tag Name</Label>
                <Input value={newTagName} onChange={(e) => setNewTagName(e.target.value)} placeholder="e.g. Belgian Truffle" />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs font-semibold">Tag Type</Label>
                <Select value={newTagType} onValueChange={(v) => setNewTagType(v as any)}>
                  <Select.Trigger><Select.Value /></Select.Trigger>
                  <Select.Content>
                    <Select.Item value="occasion">Occasion</Select.Item>
                    <Select.Item value="flavour">Flavour</Select.Item>
                    <Select.Item value="dietary">Dietary (Eggless, etc.)</Select.Item>
                    <Select.Item value="style">Style / Artisan</Select.Item>
                    <Select.Item value="marketing">Marketing (Bestseller)</Select.Item>
                    <Select.Item value="delivery">Delivery Slot</Select.Item>
                  </Select.Content>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs font-semibold">Search Weight ({newTagWeight})</Label>
                <input
                  type="range"
                  min={1}
                  max={100}
                  value={newTagWeight}
                  onChange={(e) => setNewTagWeight(Number(e.target.value))}
                  className="accent-rose-500 cursor-pointer mt-2"
                />
              </div>
              <div className="flex items-end">
                <Button type="submit" variant="primary" className="w-full font-bold">
                  <Plus className="w-4 h-4 mr-1" /> Add Tag
                </Button>
              </div>
            </div>
          </form>

          {/* Tags Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {tags.map((tag) => (
              <div key={tag.tag_id} className="p-3.5 bg-ui-bg-base border border-ui-border-base rounded-2xl flex items-center justify-between gap-3 shadow-xs">
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    <span className="text-xs font-bold text-ui-fg-base truncate">{tag.name}</span>
                    <Badge color="purple" className="text-[9px] uppercase tracking-wider shrink-0">
                      {tag.type}
                    </Badge>
                  </div>
                  <span className="text-[10px] text-ui-fg-muted font-mono mt-0.5">
                    slug: {tag.slug} • weight: {tag.search_weight}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleDeleteTag(tag.tag_id)}
                  className="p-1 rounded-lg text-ui-fg-muted hover:text-red-600 hover:bg-red-50 cursor-pointer"
                  title="Delete Tag"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* 5. SYNONYMS & ALIASES */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeTab === "synonyms" && (
        <div className="flex flex-col gap-5">
          {/* Create Synonym Form */}
          <form onSubmit={handleCreateSynonym} className="p-4 bg-ui-bg-subtle rounded-2xl border border-ui-border-base flex flex-col gap-3">
            <Text className="text-xs font-bold text-brand-navy uppercase">Add keyword mapping</Text>
            <Text className="text-xs text-brand-text-muted">
              When a customer searches the keyword, products matching any of the mapped words are shown too.
              Example: keyword <b>chocolate</b> → <b>black forest, truffle, ferrero</b>.
            </Text>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex flex-col gap-1">
                <Label className="text-xs font-semibold">Customer searches</Label>
                <Input value={newSynTerm} onChange={(e) => setNewSynTerm(e.target.value)} placeholder="e.g. chocolate" />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs font-semibold">Also show products matching (comma separated)</Label>
                <Input value={newSynList} onChange={(e) => setNewSynList(e.target.value)} placeholder="e.g. black forest, truffle, ferrero" />
                <label className="mt-1 flex items-center gap-2 text-xs text-brand-text">
                  <input type="checkbox" checked={newSynOneWay} onChange={(e) => setNewSynOneWay(e.target.checked)} />
                  One-way (searching "black forest" won&apos;t show all chocolate cakes)
                </label>
              </div>
              <div className="flex items-end">
                <Button type="submit" variant="primary" className="w-full font-bold">
                  <Plus className="w-4 h-4 mr-1" /> Add mapping
                </Button>
              </div>
            </div>
          </form>

          {/* Synonyms List */}
          <div className="border border-ui-border-base rounded-2xl overflow-hidden bg-ui-bg-base shadow-sm">
            <div className="divide-y divide-ui-border-base">
              {synonyms.map((syn) => (
                <div key={syn.id} className="p-4 flex items-center justify-between gap-3 hover:bg-ui-bg-subtle/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <Shuffle className="w-4 h-4 text-rose-600 shrink-0" />
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-ui-fg-base bg-stone-100 dark:bg-stone-800 px-2 py-0.5 rounded-md">
                          "{syn.term}"
                        </span>
                        <span className="text-xs text-ui-fg-muted" title={syn.is_bidirectional ? "Two-way" : "One-way"}>{syn.is_bidirectional ? "⇄" : "→"}</span>
                        <div className="flex flex-wrap gap-1">
                          {syn.synonyms.map((s, si) => (
                            <span key={si} className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200">
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteSynonym(syn.id)}
                    className="p-1.5 rounded-lg text-ui-fg-muted hover:text-red-600 hover:bg-red-50 cursor-pointer"
                    title="Delete Synonym"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* 6. SEARCH & ZERO-RESULT ANALYTICS */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeTab === "analytics" && (
        <div className="flex flex-col gap-5">
          {/* Analytics Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 bg-ui-bg-base border border-ui-border-base rounded-2xl flex flex-col gap-1 shadow-xs">
              <span className="text-[11px] font-bold text-ui-fg-muted uppercase">Total Search Queries</span>
              <span className="text-2xl font-black text-ui-fg-base">{analytics?.totalQueries || 0}</span>
            </div>
            <div className="p-4 bg-ui-bg-base border border-ui-border-base rounded-2xl flex flex-col gap-1 shadow-xs">
              <span className="text-[11px] font-bold text-ui-fg-muted uppercase">Zero-Result Queries</span>
              <span className="text-2xl font-black text-brand-gold">{analytics?.zeroResultCount || 0}</span>
            </div>
            <div className="p-4 bg-ui-bg-base border border-ui-border-base rounded-2xl flex flex-col gap-1 shadow-xs">
              <span className="text-[11px] font-bold text-ui-fg-muted uppercase">Zero-Result Rate</span>
              <span className="text-2xl font-black text-emerald-600">{analytics?.zeroResultRate || 0}%</span>
            </div>
          </div>

          {/* Top Searches & Zero Results Tables */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-ui-border-base rounded-2xl overflow-hidden bg-ui-bg-base shadow-sm">
              <div className="p-3 bg-ui-bg-subtle border-b border-ui-border-base text-xs font-bold">
                🔥 Top Search Queries
              </div>
              <div className="divide-y divide-ui-border-base max-h-72 overflow-y-auto">
                {(analytics?.topQueries || []).map((q: any, qi: number) => (
                  <div key={qi} className="p-3 flex items-center justify-between text-xs">
                    <span className="font-mono font-medium">"{q.query}"</span>
                    <Badge color="blue" className="text-[10px]">{q.count} searches</Badge>
                  </div>
                ))}
              </div>
            </div>

            <div className="border border-ui-border-base rounded-2xl overflow-hidden bg-ui-bg-base shadow-sm">
              <div className="p-3 bg-ui-bg-subtle border-b border-ui-border-base text-xs font-bold text-brand-gold">
                ⚠️ Top Zero-Result Queries (Opportunities)
              </div>
              <div className="divide-y divide-ui-border-base max-h-72 overflow-y-auto">
                {(analytics?.topZeroResultQueries || []).length === 0 ? (
                  <div className="p-6 text-center text-xs text-ui-fg-muted">
                    No zero-result searches recorded yet! All queries found matches.
                  </div>
                ) : (
                  (analytics?.topZeroResultQueries || []).map((q: any, qi: number) => (
                    <div key={qi} className="p-3 flex items-center justify-between text-xs">
                      <span className="font-mono font-bold text-red-600">"{q.query}"</span>
                      <div className="flex items-center gap-2">
                        <Badge color="orange" className="text-[10px]">{q.count} miss</Badge>
                        <Button
                          variant="secondary"
                          size="small"
                          onClick={() => {
                            setNewSynTerm(q.query);
                            setActiveTab("synonyms");
                          }}
                          className="text-[10px] py-0 px-1.5 h-6"
                        >
                          + Synonym
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
