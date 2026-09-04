const fs = require('fs');
const path = require('path');

// Read section-registry.ts
const registryFile = fs.readFileSync(path.join(__dirname, '../src/lib/cms/section-registry.ts'), 'utf-8');
const rendererFile = fs.readFileSync(path.join(__dirname, '../src/components/store/cms/page-renderer.tsx'), 'utf-8');
const editorFile = fs.readFileSync(path.join(__dirname, '../src/components/dashboard/admin/section-config-editor.tsx'), 'utf-8');

// Parse SECTION_REGISTRY entries
const sectionMatches = [...registryFile.matchAll(/value:\s*["']([^"']+)["'],\s*label:\s*["']([^"']+)["'],\s*category:\s*["']([^"']+)["'],\s*editorType:\s*["']([^"']+)["']/g)];

console.log(`Found ${sectionMatches.length} sections in registry.\n`);

const missingInEditor = [];
const missingInRenderer = [];
const fullyCovered = [];

sectionMatches.forEach(m => {
  const [_, value, label, category, editorType] = m;

  // Check if renderer handles this exact value
  const rendererHasValue = rendererFile.includes(`case "${value}":`) || rendererFile.includes(`case '${value}':`);
  
  // Check if editor handles this value OR its editorType explicitly
  // Note: we want to know if it's explicitly matched in the switch/conditions of the Content tab
  const editorHasExplicit = 
    editorFile.includes(`"${value}"`) || 
    editorFile.includes(`'${value}'`) ||
    editorFile.includes(`"${editorType}"`) ||
    editorFile.includes(`'${editorType}'`);

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

console.log(`\nMissing explicit handling in Editor: ${missingInEditor.length}`);
missingInEditor.forEach(s => console.log(`  - [${s.category}] ${s.value} (editorType: ${s.editorType})`));

console.log(`\nTotal matched: ${fullyCovered.length} / ${sectionMatches.length}`);
