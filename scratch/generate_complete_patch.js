const fs = require('fs');
const path = require('path');

// Helper to compute a unified diff chunk
function makeUnifiedDiff(oldPath, newPath, oldContent, newContent) {
  const oldLines = oldContent ? oldContent.split('\n') : [];
  const newLines = newContent ? newContent.split('\n') : [];

  const header = [
    `diff --git a/${oldPath} b/${newPath}`,
    oldContent === null ? 'new file mode 100644' : 'index 0000000..1111111 100644',
    `--- ${oldContent === null ? '/dev/null' : 'a/' + oldPath}`,
    `+++ b/${newPath}`,
    `@@ -1,${oldLines.length} +1,${newLines.length} @@`,
  ];

  const body = [];
  if (oldContent !== null) {
    for (const l of oldLines) {
      body.push('-' + l);
    }
  }
  for (const l of newLines) {
    body.push('+' + l);
  }

  return [...header, ...body].join('\n');
}

// Let's read the existing patch to keep existing diffs and append/update the new ones
const existingPatchPath = path.resolve(__dirname, 'numbering_and_gst_diff.patch');
let existingPatch = fs.existsSync(existingPatchPath) ? fs.readFileSync(existingPatchPath, 'utf8') : '';

// 1. New file: frontend/src/lib/services/invoice-queue.service.ts
const queueServiceContent = fs.readFileSync(
  path.resolve(__dirname, '../frontend/src/lib/services/invoice-queue.service.ts'),
  'utf8'
);
const queueDiff = makeUnifiedDiff(
  'frontend/src/lib/services/invoice-queue.service.ts',
  'frontend/src/lib/services/invoice-queue.service.ts',
  null,
  queueServiceContent
);

// 2. Updated migration: migration/Migration_Unique_Order_Invoice_Numbering_V2.sql
const migrationV2Content = fs.readFileSync(
  path.resolve(__dirname, '../migration/Migration_Unique_Order_Invoice_Numbering_V2.sql'),
  'utf8'
);
const migrationDiff = makeUnifiedDiff(
  'migration/Migration_Unique_Order_Invoice_Numbering_V2.sql',
  'migration/Migration_Unique_Order_Invoice_Numbering_V2.sql',
  null,
  migrationV2Content
);

// 3. Updated frontend/src/lib/services/delivery-invoicing.service.ts
const deliveryInvoicingContent = fs.readFileSync(
  path.resolve(__dirname, '../frontend/src/lib/services/delivery-invoicing.service.ts'),
  'utf8'
);

// 4. Updated frontend/src/lib/services/gst-reporting.service.ts
const gstReportingContent = fs.readFileSync(
  path.resolve(__dirname, '../frontend/src/lib/services/gst-reporting.service.ts'),
  'utf8'
);
const gstDiff = makeUnifiedDiff(
  'frontend/src/lib/services/gst-reporting.service.ts',
  'frontend/src/lib/services/gst-reporting.service.ts',
  null,
  gstReportingContent
);

// Remove any prior section for invoice-queue.service.ts, migration SQL, or gst-reporting.service.ts from existing patch
let cleanedPatch = existingPatch;
const markers = [
  'diff --git a/frontend/src/lib/services/invoice-queue.service.ts',
  'diff --git a/migration/Migration_Unique_Order_Invoice_Numbering_V2.sql',
  'diff --git a/frontend/src/lib/services/gst-reporting.service.ts'
];
for (const m of markers) {
  const idx = cleanedPatch.indexOf(m);
  if (idx !== -1) {
    const nextDiff = cleanedPatch.indexOf('diff --git', idx + 10);
    if (nextDiff !== -1) {
      cleanedPatch = cleanedPatch.slice(0, idx) + cleanedPatch.slice(nextDiff);
    } else {
      cleanedPatch = cleanedPatch.slice(0, idx);
    }
  }
}

const finalPatch = cleanedPatch.trim() + '\n\n' + queueDiff + '\n\n' + gstDiff + '\n\n' + migrationDiff + '\n';
fs.writeFileSync(existingPatchPath, finalPatch, 'utf8');
console.log('Successfully updated numbering_and_gst_diff.patch. Total size:', fs.statSync(existingPatchPath).size, 'bytes.');
