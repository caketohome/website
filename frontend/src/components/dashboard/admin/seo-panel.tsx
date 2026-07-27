"use client";

import { useEffect, useState } from "react";
import { Container, Heading, Text, Badge, Button, Input, Label, Textarea } from "@medusajs/ui";
import { apiClient } from "@frontend/lib/api-client";
import { Search, Globe, Share2, Code, Copy, Check, Save } from "lucide-react";
import { VisualPageBuilder } from "./page-builder";

export function SeoPanel() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // SEO Meta State
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDesc, setMetaDesc] = useState("");
  const [keywords, setKeywords] = useState("");
  const [canonicalUrl, setCanonicalUrl] = useState("");
  const [ogImage, setOgImage] = useState("");

  // Analytics State
  const [gaId, setGaId] = useState("");
  const [fbPixelId, setFbPixelId] = useState("");
  const [gtmId, setGtmId] = useState("");

  // Robots & Schema State
  const [robotsTxt, setRobotsTxt] = useState("");
  const [schemaType, setSchemaType] = useState("Bakery");

  // UTM Generator State
  const [utmUrl, setUtmUrl] = useState("https://cakes2home.com/products");
  const [utmSource, setUtmSource] = useState("instagram");
  const [utmMedium, setUtmMedium] = useState("story");
  const [utmCampaign, setUtmCampaign] = useState("monsoon_sale");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setLoading(true);
    apiClient.getAdminSeoConfig().then((data: any) => {
      setMetaTitle(data.meta_title || "");
      setMetaDesc(data.meta_description || "");
      setKeywords(data.keywords || "");
      setCanonicalUrl(data.canonical_url || "https://cakes2home.com");
      setOgImage(data.og_image || "");
      setGaId(data.ga_id || "");
      setFbPixelId(data.fb_pixel_id || "");
      setGtmId(data.gtm_id || "");
      setRobotsTxt(data.robots_txt || "User-agent: *\nAllow: /\nSitemap: https://cakes2home.com/sitemap.xml");
      setSchemaType(data.schema_type || "Bakery");
    }).catch(() => null).finally(() => setLoading(false));
  }, []);

  const handleSaveSeo = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSuccessMsg(null);

    const payload = {
      meta_title: metaTitle,
      meta_description: metaDesc,
      keywords,
      canonical_url: canonicalUrl,
      og_image: ogImage,
      ga_id: gaId,
      fb_pixel_id: fbPixelId,
      gtm_id: gtmId,
      robots_txt: robotsTxt,
      schema_type: schemaType,
      updated_at: new Date().toISOString(),
    };

    await apiClient.updateAdminSeoConfig(payload);
    setSuccessMsg("SEO & Digital Marketing Settings Successfully Saved!");
    setSubmitting(false);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const generatedUtm = `${utmUrl}?utm_source=${encodeURIComponent(utmSource)}&utm_medium=${encodeURIComponent(utmMedium)}&utm_campaign=${encodeURIComponent(utmCampaign)}`;

  const handleCopyUtm = () => {
    navigator.clipboard.writeText(generatedUtm);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return <Container className="p-8 text-center"><Text className="text-ui-fg-muted">Loading SEO & Digital Marketing Panel...</Text></Container>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <Heading level="h2" className="text-xl">Digital Marketing & SEO Management</Heading>
          <Text className="text-ui-fg-subtle text-sm">Configure search engine metadata, analytics pixels, robots.txt, and campaign links.</Text>
        </div>
        <Button onClick={handleSaveSeo} isLoading={submitting} className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white">
          <Save className="w-4 h-4" /> Save Marketing Settings
        </Button>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950 border border-emerald-300 text-emerald-800 dark:text-emerald-200 text-xs rounded flex items-center justify-between">
          <span>✓ {successMsg}</span>
        </div>
      )}

      {/* 🔍 On-Page SEO & Meta Settings */}
      <Container className="p-6 flex flex-col gap-4">
        <div className="flex items-center gap-2 border-b pb-3">
          <Search className="w-5 h-5 text-blue-600" />
          <Text className="font-semibold text-base">On-Page SEO & Search Engine Meta Tags</Text>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="flex justify-between items-center mb-1">
              <Label htmlFor="meta_title">Meta Title Tag</Label>
              <span className={`text-[11px] ${metaTitle.length > 60 ? "text-rose-500 font-bold" : "text-ui-fg-subtle"}`}>
                {metaTitle.length} / 60 chars
              </span>
            </div>
            <Input
              id="meta_title"
              value={metaTitle}
              onChange={(e) => setMetaTitle(e.target.value)}
              placeholder="CakeToHome — Premium Gourmet Cakes Delivered in 2 Hours"
            />
          </div>

          <div>
            <Label htmlFor="canonical">Canonical URL</Label>
            <Input
              id="canonical"
              value={canonicalUrl}
              onChange={(e) => setCanonicalUrl(e.target.value)}
              placeholder="https://cakes2home.com"
            />
          </div>

          <div className="md:col-span-2">
            <div className="flex justify-between items-center mb-1">
              <Label htmlFor="meta_desc">Meta Description</Label>
              <span className={`text-[11px] ${metaDesc.length > 160 ? "text-rose-500 font-bold" : "text-ui-fg-subtle"}`}>
                {metaDesc.length} / 160 chars
              </span>
            </div>
            <Textarea
              id="meta_desc"
              rows={2}
              value={metaDesc}
              onChange={(e) => setMetaDesc(e.target.value)}
              placeholder="Order handcrafted artisanal cakes online in Bangalore. Midnight delivery, customized birthday cakes, and same-day fresh delivery."
            />
          </div>

          <div>
            <Label htmlFor="keywords">Target Keywords (Comma Separated)</Label>
            <Input
              id="keywords"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="cakes online, birthday cake delivery, midnight cake"
            />
          </div>

          <div>
            <Label htmlFor="og_image">Social Sharing Image URL (OpenGraph)</Label>
            <Input
              id="og_image"
              value={ogImage}
              onChange={(e) => setOgImage(e.target.value)}
              placeholder="https://cakes2home.com/og-banner.jpg"
            />
          </div>
        </div>

        {/* Live Google Search Result Preview */}
        <div className="mt-2 p-4 bg-slate-50 dark:bg-slate-900 border rounded-lg flex flex-col gap-1">
          <Text className="text-xs font-semibold text-ui-fg-subtle uppercase tracking-wider mb-1">Google SERP Live Preview</Text>
          <Text className="text-xs text-emerald-700 dark:text-emerald-400 font-mono truncate">{canonicalUrl || "https://cakes2home.com"}</Text>
          <Text className="text-sm font-semibold text-blue-700 dark:text-blue-400 line-clamp-1 hover:underline cursor-pointer">
            {metaTitle || "CakeToHome — Premium Gourmet Cakes Delivered in 2 Hours"}
          </Text>
          <Text className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
            {metaDesc || "Order handcrafted artisanal cakes online in Bangalore. Midnight delivery, customized birthday cakes, and same-day fresh delivery."}
          </Text>
        </div>
      </Container>

      {/* 📈 Analytics & Tracking Pixels */}
      <Container className="p-6 flex flex-col gap-4">
        <div className="flex items-center gap-2 border-b pb-3">
          <Share2 className="w-5 h-5 text-purple-600" />
          <Text className="font-semibold text-base">Analytics & Social Tracking Pixels</Text>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="ga_id">Google Analytics 4 (GA4) ID</Label>
            <Input
              id="ga_id"
              value={gaId}
              onChange={(e) => setGaId(e.target.value)}
              placeholder="G-CTH987654321"
            />
          </div>

          <div>
            <Label htmlFor="fb_pixel">Facebook / Meta Pixel ID</Label>
            <Input
              id="fb_pixel"
              value={fbPixelId}
              onChange={(e) => setFbPixelId(e.target.value)}
              placeholder="123456789012345"
            />
          </div>

          <div>
            <Label htmlFor="gtm_id">Google Tag Manager (GTM) ID</Label>
            <Input
              id="gtm_id"
              value={gtmId}
              onChange={(e) => setGtmId(e.target.value)}
              placeholder="GTM-CTH2026"
            />
          </div>
        </div>
      </Container>

      {/* 🔗 Campaign UTM Tracking Link Generator */}
      <Container className="p-6 flex flex-col gap-4">
        <div className="flex items-center gap-2 border-b pb-3">
          <Globe className="w-5 h-5 text-emerald-600" />
          <Text className="font-semibold text-base">UTM Campaign URL Generator</Text>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <Label htmlFor="utm_url">Target Page URL</Label>
            <Input id="utm_url" value={utmUrl} onChange={(e) => setUtmUrl(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="utm_source">UTM Source (e.g. google, instagram)</Label>
            <Input id="utm_source" value={utmSource} onChange={(e) => setUtmSource(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="utm_medium">UTM Medium (e.g. cpc, story)</Label>
            <Input id="utm_medium" value={utmMedium} onChange={(e) => setUtmMedium(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="utm_campaign">UTM Campaign Name</Label>
            <Input id="utm_campaign" value={utmCampaign} onChange={(e) => setUtmCampaign(e.target.value)} />
          </div>
        </div>

        <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-between gap-3">
          <span className="font-mono text-xs text-ui-fg-base truncate">{generatedUtm}</span>
          <Button size="small" variant="secondary" onClick={handleCopyUtm} className="shrink-0 flex items-center gap-1">
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Copied!" : "Copy Campaign Link"}
          </Button>
        </div>
      </Container>

      {/* 🗺️ Robots.txt & Schema Markup */}
      <Container className="p-6 flex flex-col gap-4">
        <div className="flex items-center gap-2 border-b pb-3">
          <Code className="w-5 h-5 text-amber-600" />
          <Text className="font-semibold text-base">Indexing Controls & Rich Snippets (Schema.org)</Text>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="robots">Robots.txt Directives</Label>
            <Textarea
              id="robots"
              rows={4}
              value={robotsTxt}
              onChange={(e) => setRobotsTxt(e.target.value)}
              className="font-mono text-xs"
            />
          </div>

          <div className="flex flex-col gap-3">
            <div>
              <Label htmlFor="schema">Schema.org JSON-LD Type</Label>
              <Input id="schema" value={schemaType} onChange={(e) => setSchemaType(e.target.value)} placeholder="Bakery" />
            </div>
            <div className="p-3 bg-ui-bg-subtle rounded text-xs flex flex-col gap-1">
              <span className="font-semibold text-emerald-600">✓ Dynamic XML Sitemap Active:</span>
              <span className="font-mono text-[11px] text-ui-fg-subtle">https://cakes2home.com/sitemap.xml</span>
              <Text className="text-[10px] text-ui-fg-muted mt-1">Automatically includes all product slugs, category pages, and branch locations.</Text>
            </div>
          </div>
        </div>
      </Container>

      {/* 🎨 Drag & Drop Visual Page Builder & Image Alt Text Manager */}
      <div className="mt-4 pt-6 border-t border-ui-border-base">
        <VisualPageBuilder />
      </div>
    </div>
  );
}
