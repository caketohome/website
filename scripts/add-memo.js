// Script to add React.memo to all admin panel components
const fs = require('fs');
const path = require('path');

const adminDir = path.join(__dirname, '..', 'frontend', 'src', 'components', 'dashboard', 'admin');

const panels = [
  'admin-ai-assistant-panel.tsx',
  'orders-panel.tsx',
  'catalog-panel.tsx',
  'branches-panel.tsx',
  'delivery-panel.tsx',
  'crm-panel.tsx',
  'marketing-panel.tsx',
  'seo-panel.tsx',
  'marketing-automation-panel.tsx',
  'rewards-panel.tsx',
  'cms-panel.tsx',
  'analytics-panel.tsx',
  'notifications-panel.tsx',
  'settings-panel.tsx',
];

let modified = 0;
let skipped = 0;

for (const file of panels) {
  const filePath = path.join(adminDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Skip if already has memo
  if (content.includes('= memo(function')) {
    console.log(`SKIP (already memoized): ${file}`);
    skipped++;
    continue;
  }
  
  // Add memo to React import
  // Handle both: import { useState } and import { useEffect, useState }
  if (content.includes('import { useState } from "react"')) {
    content = content.replace(
      'import { useState } from "react"',
      'import { useState, memo } from "react"'
    );
  } else if (content.includes('import { useEffect, useState } from "react"')) {
    content = content.replace(
      'import { useEffect, useState } from "react"',
      'import { useEffect, useState, memo } from "react"'
    );
  } else {
    console.log(`WARN: Unknown React import pattern in ${file}`);
    continue;
  }
  
  // Find the export function declaration and wrap it
  const exportMatch = content.match(/export function (\w+)\(\)/);
  if (!exportMatch) {
    console.log(`WARN: No matching export function pattern in ${file}`);
    continue;
  }
  
  const funcName = exportMatch[1];
  content = content.replace(
    `export function ${funcName}()`,
    `export const ${funcName} = memo(function ${funcName}()`
  );
  
  // Replace the last closing `}` + newline at end of file with `});` + newline
  // The pattern is: the component ends with `}\n` at the very end
  content = content.replace(/\n}\n$/, '\n});\n');
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`OK: ${file} -> ${funcName} wrapped in memo()`);
  modified++;
}

console.log(`\nDone: ${modified} modified, ${skipped} skipped`);
