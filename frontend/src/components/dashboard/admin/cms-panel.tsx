"use client";
import { useEffect, useState, memo } from "react";
import { Container, Heading, Text, Badge } from "@medusajs/ui";
import { apiClient } from "@frontend/lib/api-client";
import Image from "next/image";
import { PageConfigurator } from "./page-configurator";
import { VisualPageBuilder } from "./page-builder";

export const CmsPanel = memo(function CmsPanel() {
  const [blocks, setBlocks] = useState<any[]>([]);
  const [media, setMedia] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiClient.getAdminCmsBlocks().then((r: any) => setBlocks(r?.blocks || r?.data || [])).catch(() => null),
      apiClient.getAdminMedia().then((r: any) => setMedia(r?.media || r?.data || [])).catch(() => null),
    ]).finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Heading level="h2" className="text-xl">Content Management & Website Page Configurator</Heading>
        <Text className="text-ui-fg-subtle text-sm">Configure website pages, sections, SEO metadata, visibility rules, marketing banners, and media.</Text>
      </div>

      {/* Website Page Configurator Module */}
      <PageConfigurator />

      {loading ? (
        <Container className="p-8 text-center"><Text className="text-ui-fg-muted">Loading CMS data...</Text></Container>
      ) : (
        <>
          <Container className="p-5">
            <Text className="text-xs font-semibold text-ui-fg-subtle uppercase tracking-wider mb-3">Content Blocks ({blocks.length})</Text>
            {blocks.length === 0 ? (
              <Text className="text-sm text-ui-fg-muted">No content blocks. Create them via <code>/admin/cms/blocks</code>.</Text>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {blocks.map((b: any, i: number) => (
                  <div key={b.id || i} className="p-4 bg-ui-bg-subtle rounded-lg flex flex-col gap-2">
                    <Text className="font-semibold text-sm">{b.title || b.name || `Block #${i + 1}`}</Text>
                    <Text className="text-xs text-ui-fg-muted">{b.type || "text"} — {b.placement || "homepage"}</Text>
                    <Badge color={b.is_published ? "green" : "grey"} className="w-fit text-[10px]">{b.is_published ? "Published" : "Draft"}</Badge>
                  </div>
                ))}
              </div>
            )}
          </Container>

          <Container className="p-5">
            <Text className="text-xs font-semibold text-ui-fg-subtle uppercase tracking-wider mb-3">Media Library ({media.length})</Text>
            {media.length === 0 ? (
              <Text className="text-sm text-ui-fg-muted">No media uploads. Upload files via <code>/admin/media</code>.</Text>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {media.slice(0, 24).map((m: any, i: number) => (
                  <div key={m.id || i} className="aspect-square bg-ui-bg-subtle rounded-lg flex items-center justify-center text-xs text-ui-fg-muted overflow-hidden">
                    {m.url ? <Image src={m.url} alt={m.name || ""} width={120} height={120} className="w-full h-full object-cover" /> : <span>📄 {m.name || `File #${i + 1}`}</span>}
                  </div>
                ))}
              </div>
            )}
          </Container>
        </>
      )}

      {/* Visual Drag & Drop Page Builder & Alt Text Manager */}
      <div className="mt-4 pt-6 border-t border-ui-border-base">
        <VisualPageBuilder />
      </div>
    </div>
  );
});
