const fs = require('fs');
const path = require('path');

const base = path.resolve(__dirname, '../../CHECKPOINTS/acceptance-test-evidence');
const subdirs = [
  'super-admin',
  'branch-manager',
  'accounting',
  'delivery',
  'orders',
  'billing',
  'purchases',
  'inventory',
  'cash-cod',
  'gateway',
  'reports',
  'gst',
  'rbac',
  'responsive',
  'video',
];

for (const dir of subdirs) {
  const p = path.join(base, dir);
  fs.mkdirSync(p, { recursive: true });
}

console.log('Successfully created all evidence directories at:', base);
