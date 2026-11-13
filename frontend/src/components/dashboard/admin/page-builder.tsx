"use client";

import { useEffect, useState } from "react";
import { Container, Heading, Text, Badge, Button, Input, Label, Textarea } from "@medusajs/ui";
import { apiClient } from "@frontend/lib/api-client";
import {
  Layout, Plus, Trash2, MoveUp, MoveDown, Eye, Save, Smartphone, Monitor,
  Image as ImageIcon, Sparkles, Check, ChevronDown, ChevronUp, Layers
} from "lucide-react";

export interface PageBlock {
  id: string;
  type: "hero" | "products" | "promo" | "testimonials" | "faq" | "locations";
  title: string;
  subtitle?: string;
  cta_text?: string;
  cta_link?: string;
  items?: any[];
}

export function VisualPageBuilder() {
  const [activeTab, setActiveTab] = useState<"builder" | "alt_texts">("builder");
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");
  const [selectedPage, setSelectedPage] = useState("page_home");

  // Page Builder Blocks State
  const [blocks, setBlocks] = useState<PageBlock[]>([
    {
      id: "b1",
      type: "hero",
      title: "🎂 Handcrafted Gourmet Cakes Delivered in 2 Hours",
      subtitle: "Order fresh artisanal cakes online in Kerala. Express 2-hour delivery available!",
      cta_text: "Browse Cake Catalog →",
      cta_link: "/products",
    },
    {
      id: "b2",
      type: "promo",
      title: "⚡ Monsoon Special: Get 50% Off Up to ₹150",
      subtitle: "Use coupon code CAKE50 on your first birthday or anniversary cake order.",
      cta_text: "Claim Discount",
      cta_link: "/products?promo=CAKE50",
    },
    {
      id: "b3",
      type: "products",
      title: "🍰 Best-Selling Artisanal Cakes",
      subtitle: "Freshly baked today using Belgian chocolate, Madagascar vanilla, and real fruit.",
    },
    {
      id: "b4",
      type: "faq",
      title: "❓ Frequently Asked Questions",
      items: [
        { q: "Do you deliver cakes on the same day?", a: "Yes! We offer 2-hour express delivery and scheduled celebration slots across Kerala." },
        { q: "Can I customize the cake message and flavor?", a: "Absolutly! You can select size (0.5kg, 1kg, 2kg), artisan option, flavor, and add a custom name message during checkout." },
      ],
    },
  ]);

  // Alt Text Manager State
  const [images, setImages] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    apiClient.getAdminImageAltTexts().then((r: any) => {
      setImages(r?.images || []);
    }).catch(() => null);
  }, []);

  const handleAddBlock = (type: PageBlock["type"]) => {
    const newBlock: PageBlock = {
      id: `b_${Date.now()}`,
      type,
      title: type === "hero" ? "New Hero Section Title" : type === "products" ? "Featured Product Grid" : type === "promo" ? "Special Promotion Banner" : "New Content Section",
      subtitle: "Add engaging subtitle text for search engines and visitors",
      cta_text: "Click Here",
      cta_link: "/",
    };
    setBlocks((prev) => [...prev, newBlock]);
  };

  const handleRemoveBlock = (id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
  };

  const handleMoveBlock = (index: number, direction: "up" | "down") => {
    const newBlocks = [...blocks];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newBlocks.length) return;
    const [moved] = newBlocks.splice(index, 1);
    newBlocks.splice(targetIndex, 0, moved);
    setBlocks(newBlocks);
  };

  const handleUpdateBlock = (id: string, field: keyof PageBlock, value: any) => {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, [field]: value } : b)));
  };

  const handleSavePage = async () => {
    setSaving(true);
    setSuccessMsg(null);
    await apiClient.savePageBuilderLayout(selectedPage, { blocks });
    setSuccessMsg("Page Layout & SEO Meta Blocks Saved Successfully!");
    setSaving(false);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleUpdateAltText = async (id: string, newAlt: string) => {
    setImages((prev) => prev.map((img) => (img.id === id ? { ...img, alt_text: newAlt, status: "optimized" } : img)));
    await apiClient.updateAdminImageAltText(id, newAlt);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Top Header & Mode Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Heading level="h2" className="text-xl">🎨 Visual Drag & Drop Page Builder & Image SEO</Heading>
          <Text className="text-ui-fg-subtle text-sm">Build landing pages visually, edit content blocks, and manage Image Alt Text for search engines.</Text>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="small"
            variant={activeTab === "builder" ? "primary" : "secondary"}
            onClick={() => setActiveTab("builder")}
            className="flex items-center gap-1.5"
          >
            <Layout className="w-4 h-4" /> Visual Page Builder
          </Button>
          <Button
            size="small"
            variant={activeTab === "alt_texts" ? "primary" : "secondary"}
            onClick={() => setActiveTab("alt_texts")}
            className="flex items-center gap-1.5"
          >
            <ImageIcon className="w-4 h-4" /> Image Alt Text Manager ({images.length})
          </Button>
        </div>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950 border border-emerald-300 text-emerald-800 dark:text-emerald-200 text-xs rounded">
          ✓ {successMsg}
        </div>
      )}

      {/* ── MODE 1: VISUAL PAGE BUILDER ── */}
      {activeTab === "builder" && (
        <div className="flex flex-col gap-6">
          {/* Builder Toolbar */}
          <Container className="p-4 flex flex-wrap items-center justify-between gap-4 bg-ui-bg-subtle">
            <div className="flex items-center gap-2">
              <Text className="text-xs font-semibold">Editing Page:</Text>
              <select
                value={selectedPage}
                onChange={(e) => setSelectedPage(e.target.value)}
                className="text-xs p-1.5 rounded border bg-ui-bg-base"
              >
                <option value="page_home">🏠 Storefront Homepage (/)</option>
                <option value="page_about">📖 About Bakery (/about)</option>
                <option value="page_offers">🎉 Festive Offers (/landing/monsoon)</option>
              </select>
            </div>

            {/* Viewport Switcher */}
            <div className="flex items-center gap-1 bg-ui-bg-base p-1 rounded-lg border">
              <button
                onClick={() => setViewport("desktop")}
                className={`p-1.5 rounded flex items-center gap-1 text-xs ${viewport === "desktop" ? "bg-emerald-600 text-white font-medium" : "text-ui-fg-subtle"}`}
              >
                <Monitor className="w-3.5 h-3.5" /> Desktop
              </button>
              <button
                onClick={() => setViewport("mobile")}
                className={`p-1.5 rounded flex items-center gap-1 text-xs ${viewport === "mobile" ? "bg-emerald-600 text-white font-medium" : "text-ui-fg-subtle"}`}
              >
                <Smartphone className="w-3.5 h-3.5" /> Mobile (375px)
              </button>
            </div>

            <Button size="small" onClick={handleSavePage} isLoading={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5">
              <Save className="w-4 h-4" /> Save Page Layout
            </Button>
          </Container>

          {/* Add Block Selector Bar */}
          <div className="flex flex-wrap gap-2 items-center p-3 bg-slate-100 dark:bg-slate-900 rounded-lg">
            <Text className="text-xs font-semibold text-ui-fg-subtle mr-2 flex items-center gap-1">
              <Plus className="w-4 h-4 text-emerald-600" /> Add Block:
            </Text>
            <Button size="small" variant="secondary" onClick={() => handleAddBlock("hero")}>+ Hero Banner</Button>
            <Button size="small" variant="secondary" onClick={() => handleAddBlock("products")}>+ Product Grid</Button>
            <Button size="small" variant="secondary" onClick={() => handleAddBlock("promo")}>+ Promo Banner</Button>
            <Button size="small" variant="secondary" onClick={() => handleAddBlock("faq")}>+ FAQ Accordion</Button>
          </div>

          {/* Visual Canvas Container */}
          <div className={`mx-auto transition-all duration-300 ${viewport === "mobile" ? "w-[380px] border-8 border-slate-800 rounded-3xl shadow-2xl overflow-hidden p-2 bg-white dark:bg-slate-950" : "w-full"}`}>
            <div className="flex flex-col gap-4">
              {blocks.map((block, index) => (
                <Container key={block.id} className="p-5 relative border-2 border-slate-200 dark:border-slate-800 hover:border-emerald-500 transition-colors group">
                  {/* Block Header & Reorder Controls */}
                  <div className="flex items-center justify-between mb-3 border-b pb-2">
                    <div className="flex items-center gap-2">
                      <Badge color="purple" className="uppercase text-[10px]">{block.type}</Badge>
                      <Text className="font-semibold text-xs text-ui-fg-subtle">Block #{index + 1}</Text>
                    </div>

                    <div className="flex items-center gap-1">
                      <button onClick={() => handleMoveBlock(index, "up")} disabled={index === 0} className="p-1 hover:bg-ui-bg-subtle rounded disabled:opacity-30">
                        <MoveUp className="w-3.5 h-3.5 text-ui-fg-subtle" />
                      </button>
                      <button onClick={() => handleMoveBlock(index, "down")} disabled={index === blocks.length - 1} className="p-1 hover:bg-ui-bg-subtle rounded disabled:opacity-30">
                        <MoveDown className="w-3.5 h-3.5 text-ui-fg-subtle" />
                      </button>
                      <button onClick={() => handleRemoveBlock(block.id)} className="p-1 hover:bg-rose-50 rounded text-rose-600 ml-2">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Inline Block Editor Form & Live Preview */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                      <div>
                        <Label className="text-[11px]">Block Headline</Label>
                        <Input
                          value={block.title}
                          onChange={(e) => handleUpdateBlock(block.id, "title", e.target.value)}
                          className="text-xs"
                        />
                      </div>
                      <div>
                        <Label className="text-[11px]">Subtitle / Description</Label>
                        <Input
                          value={block.subtitle || ""}
                          onChange={(e) => handleUpdateBlock(block.id, "subtitle", e.target.value)}
                          className="text-xs"
                        />
                      </div>
                      {block.type === "hero" || block.type === "promo" ? (
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-[11px]">Button Text</Label>
                            <Input value={block.cta_text || ""} onChange={(e) => handleUpdateBlock(block.id, "cta_text", e.target.value)} className="text-xs" />
                          </div>
                          <div>
                            <Label className="text-[11px]">Button Link</Label>
                            <Input value={block.cta_link || ""} onChange={(e) => handleUpdateBlock(block.id, "cta_link", e.target.value)} className="text-xs" />
                          </div>
                        </div>
                      ) : null}
                    </div>

                    {/* Live Block Preview Box */}
                    <div className="p-4 bg-slate-900 text-white rounded-lg flex flex-col justify-center gap-2 text-center">
                      <Text className="text-[10px] text-emerald-400 font-mono uppercase tracking-wider">Live Preview</Text>
                      <Text className="font-bold text-sm">{block.title}</Text>
                      <Text className="text-xs text-slate-300 line-clamp-2">{block.subtitle}</Text>
                      {block.cta_text && (
                        <span className="inline-block mx-auto mt-1 px-3 py-1 bg-emerald-500 text-slate-950 font-semibold text-xs rounded-full">
                          {block.cta_text}
                        </span>
                      )}
                    </div>
                  </div>
                </Container>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── MODE 2: IMAGE ALT TEXT MANAGER ── */}
      {activeTab === "alt_texts" && (
        <Container className="p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b pb-3">
            <div className="flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-blue-600" />
              <Heading level="h3" className="text-base">Website Images SEO Alt Text Directory</Heading>
            </div>
            <Badge color="purple">{images.length} Images Audited</Badge>
          </div>

          <Text className="text-xs text-ui-fg-subtle">
            Image Alt Text helps search engines understand image content and rank product photos in Google Images search.
          </Text>

          <Container className="p-0 overflow-hidden mt-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-ui-bg-subtle">
                  <th className="text-left p-3 text-xs font-semibold text-ui-fg-subtle">Asset Preview</th>
                  <th className="text-left p-3 text-xs font-semibold text-ui-fg-subtle">Target Page</th>
                  <th className="text-left p-3 text-xs font-semibold text-ui-fg-subtle">SEO Alt Text Tag</th>
                  <th className="text-left p-3 text-xs font-semibold text-ui-fg-subtle">SEO Status</th>
                </tr>
              </thead>
              <tbody>
                {images.map((img) => (
                  <tr key={img.id} className="border-b hover:bg-ui-bg-subtle-hover transition-colors">
                    <td className="p-3">
                      <div className="w-12 h-12 bg-slate-800 rounded flex items-center justify-center text-xs text-white overflow-hidden font-mono">
                        🍰 IMG
                      </div>
                    </td>
                    <td className="p-3 text-xs font-medium">{img.page}</td>
                    <td className="p-3">
                      <Input
                        value={img.alt_text}
                        onChange={(e) => handleUpdateAltText(img.id, e.target.value)}
                        className="text-xs"
                      />
                    </td>
                    <td className="p-3">
                      <Badge color={img.status === "optimized" ? "green" : "orange"} className="text-[10px]">
                        {img.status === "optimized" ? "✓ Optimized" : "Needs Review"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Container>
        </Container>
      )}
    </div>
  );
}
