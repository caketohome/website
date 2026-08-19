const config = require('./medusa-config.ts');
console.log('Medusa config loaded. Modules defined:', Object.keys(config.modules || {}).length);

let failed = 0;
for (const [key, val] of Object.entries(config.modules || {})) {
  try {
    if (val.resolve && val.resolve.startsWith('.')) {
      const mod = require('./src/' + val.resolve.replace('./', '')).default;
      console.log('PASS:', key, '->', typeof mod);
    }
  } catch(e) {
    console.error('FAIL:', key, '->', e.message);
    failed++;
  }
}

if (failed === 0) {
  console.log('ALL CUSTOM MEDUSA MODULES LOADED WITH 100% SUCCESS!');
} else {
  console.error(failed + ' MODULES FAILED TO LOAD.');
}
