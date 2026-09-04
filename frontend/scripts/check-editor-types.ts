import { SECTION_REGISTRY } from '../src/lib/cms/section-registry';
import * as fs from 'fs';
import * as path from 'path';

const editorFile = fs.readFileSync(path.join(__dirname, '../src/components/dashboard/admin/section-config-editor.tsx'), 'utf-8');

const distinctEditorTypes = new Set<string>();
const editorTypeToSections: Record<string, string[]> = {};

SECTION_REGISTRY.forEach(s => {
  distinctEditorTypes.add(s.editorType);
  if (!editorTypeToSections[s.editorType]) editorTypeToSections[s.editorType] = [];
  editorTypeToSections[s.editorType].push(s.value);
});

console.log(`Found ${distinctEditorTypes.size} distinct editorTypes:\n`);

distinctEditorTypes.forEach(et => {
  const isHandled = 
    editorFile.includes(`editorType === "${et}"`) ||
    editorFile.includes(`editorType === '${et}'`) ||
    editorFile.includes(`"${et}"`);
  
  console.log(`${et.padEnd(25)}: Handled = ${isHandled ? 'YES' : 'NO '} (${editorTypeToSections[et].length} sections: ${editorTypeToSections[et].slice(0, 3).join(', ')}...)`);
});
