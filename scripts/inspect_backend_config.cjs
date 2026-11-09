const fs = require('fs');

const files = [
  'cakes2home-main/cakes2home-main/backend/package.json',
  'cakes2home-main/cakes2home-main/backend/medusa-config.js',
  'cakes2home-main/cakes2home-main/backend/medusa-config.ts'
];
files.forEach(f => {
  console.log(f + ': ' + fs.existsSync(f));
  if (fs.existsSync(f)) {
    console.log(fs.readFileSync(f, 'utf8').substring(0, 400));
  }
});

