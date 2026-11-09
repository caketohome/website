const fs = require('fs');

const tsconfigs = ['tsconfig.json', 'cakes2home-main/cakes2home-main/tsconfig.json', 'cakes2home-main/cakes2home-main/frontend/tsconfig.json'];
tsconfigs.forEach(t => {
  if (fs.existsSync(t)) {
    console.log('--- ' + t + ' ---');
    console.log(fs.readFileSync(t, 'utf8').substring(0, 500));
  } else {
    console.log(t + ' does not exist');
  }
});

