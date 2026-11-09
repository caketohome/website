require('E:/vig/cakes2home-main/cakes2home-main/backend/node_modules/ts-node').register({
  transpileOnly: true,
  skipProject: true,
  compilerOptions: {
    module: 'commonjs',
    target: 'es2021',
    experimentalDecorators: true,
    emitDecoratorMetadata: true
  }
});
console.log('Registered ts-node with skipProject: true');
const t0 = Date.now();
const { AppModule } = require('../apps/api/src/nestjs/app.module');
console.log('AppModule loaded in ' + (Date.now() - t0) + 'ms:', Boolean(AppModule));
