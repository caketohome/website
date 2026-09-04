import * as fs from "fs";
import * as path from "path";
import { SECTION_REGISTRY, SECTION_CATEGORIES, SectionTypeDefinition } from "../src/lib/cms/section-registry";

const pageRendererPath = path.resolve(__dirname, "../src/components/store/cms/page-renderer.tsx");
const sectionEditorPath = path.resolve(__dirname, "../src/components/dashboard/admin/section-config-editor.tsx");

const rendererCode = fs.readFileSync(pageRendererPath, "utf-8");
const editorCode = fs.readFileSync(sectionEditorPath, "utf-8");

console.log(`Total registered sections: ${SECTION_REGISTRY.length}`);

interface AuditResult {
  value: string;
  label: string;
  category: string;
  editorType: string;
  hasRendererCase: boolean;
  hasEditorSupport: boolean;
  hasDefaultConfig: boolean;
  status: "COMPLETE" | "PARTIAL" | "FALLBACK";
}

const audit: AuditResult[] = [];

for (const s of SECTION_REGISTRY) {
  // Check renderer
  const casePattern = new RegExp(`case\\s+["']${s.value}["']`, "m");
  const hasRendererCase = casePattern.test(rendererCode);

  // Check editor
  // Editor checks either section.type === s.value or editorType === s.editorType or dedicated sub-editors
  const editorTypePattern = new RegExp(`editorType\\s*===?\\s*["']${s.editorType}["']|section\\.type\\s*===?\\s*["']${s.value}["']|editorType\\s*===?\\s*["']${s.value}["']`, "m");
  const isDedicatedHandled = (s.value === "promotional_banner" || s.value === "promo") || (s.value === "kitchen_story" || s.value === "scroll_frame" || s.editorType === "scroll_story");
  const hasEditorSupport = isDedicatedHandled || editorTypePattern.test(editorCode);

  const hasDefaultConfig = !!s.defaultConfig && Object.keys(s.defaultConfig).length > 0;

  let status: "COMPLETE" | "PARTIAL" | "FALLBACK" = "FALLBACK";
  if (hasRendererCase && hasEditorSupport && hasDefaultConfig) {
    status = "COMPLETE";
  } else if (hasRendererCase || hasEditorSupport) {
    status = "PARTIAL";
  }

  audit.push({
    value: s.value,
    label: s.label,
    category: s.category,
    editorType: s.editorType,
    hasRendererCase,
    hasEditorSupport,
    hasDefaultConfig,
    status,
  });
}

const complete = audit.filter(a => a.status === "COMPLETE");
const partial = audit.filter(a => a.status === "PARTIAL");
const fallback = audit.filter(a => a.status === "FALLBACK");

console.log(`\nAUDIT SUMMARY:`);
console.log(`Total: ${audit.length}`);
console.log(`Fully Handled (explicit case + editor support + default config): ${complete.length}`);
console.log(`Partial (either renderer or editor): ${partial.length}`);
console.log(`Fallback (no explicit case or editor): ${fallback.length}`);

console.log("\nBY CATEGORY:");
for (const cat of SECTION_CATEGORIES) {
  const catSections = audit.filter(a => a.category === cat.id);
  const catComplete = catSections.filter(a => a.status === "COMPLETE");
  const catPartial = catSections.filter(a => a.status === "PARTIAL");
  const catFallback = catSections.filter(a => a.status === "FALLBACK");
  console.log(`[${cat.id}] ${cat.label}: ${catSections.length} total | ${catComplete.length} complete | ${catPartial.length} partial | ${catFallback.length} fallback`);
}

// Write detailed JSON audit
fs.writeFileSync(path.resolve(__dirname, "../audit-sections.json"), JSON.stringify(audit, null, 2));
