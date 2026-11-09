const fs = require('fs');

const pkgs = ['@nestjs/core', '@nestjs/common', '@nestjs/platform-express', 'reflect-metadata', 'rxjs', 'class-validator', 'class-transformer'];
pkgs.forEach(p => {
  const exists = fs.existsSync('node_modules/' + p);
  console.log(p + ': ' + exists);
});

