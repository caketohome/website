import * as fs from 'fs';
import * as path from 'path';
import { SECTION_REGISTRY } from '../src/lib/cms/section-registry';

const rendererFile = fs.readFileSync(path.join(__dirname, '../src/components/store/cms/page-renderer.tsx'), 'utf-8');
const editorFile = fs.readFileSync(path.join(__dirname, '../src/components/dashboard/admin/section-config-editor.tsx'), 'utf-8');

console.log(`Total sections in registry: ${SECTION_REGISTRY.length}\n`);

const missingInRenderer: any[] = [];
const missingInEditor: any[] = [];
const fullyCovered: any[] = [];

SECTION_REGISTRY.forEach(s => {
  const value = s.value;
  const label = s.label;
  const category = s.category;
  const editorType = s.editorType;

  const rendererHasValue = rendererFile.includes(`case "${value}":`) || rendererFile.includes(`case '${value}':`);
  
  // Check if Content subtab explicitly handles this section value OR its editorType
  // Search only in Subtab 1: Content
  const contentSubtabStart = editorFile.indexOf('{subTab === "content" && (');
  const contentSubtabEnd = editorFile.indexOf('{/* ═══════════════════════════════════════════════════════════ */\n      {/* SUBTAB 2: MOTION / ANIMATION */}');
  const contentSubtab = editorFile.substring(contentSubtabStart, contentSubtabEnd);

  const editorHasExplicit = 
    contentSubtab.includes(`"${value}"`) || 
    contentSubtab.includes(`'${value}'`) ||
    contentSubtab.includes(`editorType === "${editorType}"`) ||
    contentSubtab.includes(`editorType === '${editorType}'`) ||
    s.value === "promotional_banner" ||
    s.value === "promo" ||
    s.value === "kitchen_story" ||
    s.value === "scroll_frame" ||
    s.value === "announcement_bar" ||
    s.value === "announcement";

  if (!rendererHasValue) {
    missingInRenderer.push({ value, label, category, editorType });
  }
  if (!editorHasExplicit) {
    missingInEditor.push({ value, label, category, editorType });
  }
  if (rendererHasValue && editorHasExplicit) {
    fullyCovered.push({ value, label, category, editorType });
  }
});

console.log(`Missing in Renderer cases: ${missingInRenderer.length}`);
missingInRenderer.forEach(s => console.log(`  - [${s.category}] ${s.value} (${s.label})`));

console.log(`\nMissing explicit handling in Content Editor: ${missingInEditor.length}`);
missingInEditor.forEach(s => console.log(`  - [${s.category}] ${s.value} (editorType: ${s.editorType})`));

console.log(`\nTotal matched: ${fullyCovered.length} / ${SECTION_REGISTRY.length}`);
