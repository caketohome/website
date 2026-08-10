/**
 * Duplicate Content & Slug Auditor
 * 
 * Groups duplicate meta titles, meta descriptions, H1 headings, and URL slugs across
 * the entire platform and suggests unique variations.
 */

export interface DuplicateGroup {
  field: "meta_title" | "meta_description" | "h1_text" | "slug";
  value: string;
  count: number;
  competingPages: { id: string; url: string; title: string; entityType: string }[];
  suggestedVariations: string[];
}

export class DuplicateContentAuditor {

  static findDuplicates(pages: any[]): DuplicateGroup[] {
    const titleMap: Record<string, any[]> = {};
    const descMap: Record<string, any[]> = {};
    const h1Map: Record<string, any[]> = {};
    const slugMap: Record<string, any[]> = {};

    pages.forEach((p) => {
      const pageInfo = { id: p.id, url: p.url || `/${p.slug}`, title: p.meta_title || p.title || "", entityType: p.entity_type };

      if (p.meta_title && p.meta_title.trim() !== "") {
        const key = p.meta_title.trim().toLowerCase();
        if (!titleMap[key]) titleMap[key] = [];
        titleMap[key].push(pageInfo);
      }

      if (p.meta_description && p.meta_description.trim() !== "") {
        const key = p.meta_description.trim().toLowerCase();
        if (!descMap[key]) descMap[key] = [];
        descMap[key].push(pageInfo);
      }

      if (p.h1_text && p.h1_text.trim() !== "") {
        const key = p.h1_text.trim().toLowerCase();
        if (!h1Map[key]) h1Map[key] = [];
        h1Map[key].push(pageInfo);
      }

      if (p.slug && p.slug.trim() !== "") {
        const key = p.slug.trim().toLowerCase();
        if (!slugMap[key]) slugMap[key] = [];
        slugMap[key].push(pageInfo);
      }
    });

    const duplicateGroups: DuplicateGroup[] = [];

    // Helper
    const processMap = (map: Record<string, any[]>, field: "meta_title" | "meta_description" | "h1_text" | "slug") => {
      Object.entries(map).forEach(([val, list]) => {
        if (list.length > 1) {
          const originalVal = list[0].title || val;
          duplicateGroups.push({
            field,
            value: originalVal,
            count: list.length,
            competingPages: list,
            suggestedVariations: list.map((item, idx) => {
              if (field === "meta_title") {
                return `${originalVal} (${item.entityType || "Page"} ${idx + 1})`;
              } else if (field === "meta_description") {
                return `${originalVal} Order online with fast 2-hour delivery in ${idx === 0 ? "Kollam" : "Kerala"}.`;
              } else {
                return `${originalVal} - ${item.entityType || "Selection"}`;
              }
            }),
          });
        }
      });
    };

    processMap(titleMap, "meta_title");
    processMap(descMap, "meta_description");
    processMap(h1Map, "h1_text");
    processMap(slugMap, "slug");

    return duplicateGroups;
  }
}
