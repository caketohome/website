const fs = require('fs');

const tsconfigs = [
  'cakes2home-main/cakes2home-main/apps/api/tsconfig.json',
  'cakes2home-main/cakes2home-main/backend/tsconfig.json'
];
tsconfigs.forEach(t => {
  console.log(t + ': ' + fs.existsSync(t));
  if (fs.existsSync(t)) {
    console.log(fs.readFileSync(t, 'utf8'));
  }
});

