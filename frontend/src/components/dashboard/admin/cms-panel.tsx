"use client";

import { useEffect, useState, memo } from "react";
import { Container, Heading, Text, Badge, Button } from "@medusajs/ui";
import { apiClient } from "@frontend/lib/api-client";
import Image from "next/image";
import { ChevronDown, ChevronUp, Layers, ImageIcon } from "lucide-react";
import { PageConfigurator } from "./page-configurator";

export const CmsPanel = memo(function CmsPanel() {
  const [blocks, setBlocks] = useState<any[]>([]);
  const [media, setMedia] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSecondaryAssets, setShowSecondaryAssets] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiClient.getAdminCmsBlocks().then((r: any) => setBlocks(r?.blocks || r?.data || [])).catch(() => null),
      apiClient.getAdminMedia().then((r: any) => setMedia(r?.media || r?.data || [])).catch(() => null),
    ]).finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col gap-6 w-full">
      <div>
        <Heading level="h2" className="text-xl font-bold">Content Management &amp; Website Page Configurator</Heading>
        <Text className="text-ui-fg-subtle text-xs sm:text-sm">
          Configure exactly what customers see on each page — sections, products, categories, SEO metadata, banners, visibility rules, and more.
        </Text>
      </div>

      {/* Website Page Configurator Module */}
      <PageConfigurator />

      {/* Secondary Assets Collapsible Panel */}
      <div className="border-t border-ui-border-base pt-3 mt-2">
        <button
          onClick={() => setShowSecondaryAssets(prev => !prev)}
          className="flex items-center justify-between w-full p-3 rounded-xl bg-ui-bg-subtle/60 hover:bg-ui-bg-subtle border border-ui-border-base transition-colors text-xs font-bold text-ui-fg-subtle"
        >
          <span className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-rose-500" />
            Secondary Assets ({blocks.length} Content Blocks · {media.length} Media Files)
          </span>
          {showSecondaryAssets ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showSecondaryAssets && (
          <div className="flex flex-col gap-4 mt-3 animate-in fade-in duration-200">
            {loading ? (
              <Container className="p-4 text-center"><Text className="text-xs text-ui-fg-muted">Loading secondary CMS assets...</Text></Container>
            ) : (
              <>
                <Container className="p-4">
                  <Text className="text-xs font-semibold text-ui-fg-subtle uppercase tracking-wider mb-2">Content Blocks ({blocks.length})</Text>
                  {blocks.length === 0 ? (
                    <Text className="text-xs text-ui-fg-muted">No content blocks. Create them via <code>/admin/cms/blocks</code>.</Text>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {blocks.map((b: any, i: number) => (
                        <div key={b.id || i} className="p-3 bg-ui-bg-subtle rounded-lg flex flex-col gap-1 text-xs">
                          <Text className="font-semibold text-xs">{b.title || b.name || `Block #${i + 1}`}</Text>
                          <Text className="text-[10px] text-ui-fg-muted">{b.type || "text"} — {b.placement || "homepage"}</Text>
                          <Badge color={b.is_published ? "green" : "grey"} className="w-fit text-[9px]">{b.is_published ? "Published" : "Draft"}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </Container>

                <Container className="p-4">
                  <Text className="text-xs font-semibold text-ui-fg-subtle uppercase tracking-wider mb-2">Media Library ({media.length})</Text>
                  {media.length === 0 ? (
                    <Text className="text-xs text-ui-fg-muted">No media uploads. Upload files via <code>/admin/media</code>.</Text>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-6 lg:grid-cols-8 gap-2">
                      {media.slice(0, 24).map((m: any, i: number) => (
                        <div key={m.id || i} className="aspect-square bg-ui-bg-subtle rounded-lg flex items-center justify-center text-[10px] text-ui-fg-muted overflow-hidden border border-ui-border-base">
                          {m.url ? <Image src={m.url} alt={m.name || ""} width={100} height={100} className="w-full h-full object-cover" /> : <span>📄 {m.name || `#${i + 1}`}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </Container>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
});
