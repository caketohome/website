require('E:/vig/cakes2home-main/cakes2home-main/backend/node_modules/ts-node').register({
  transpileOnly: true,
  compilerOptions: {
    module: 'commonjs',
    target: 'es2021',
    experimentalDecorators: true,
    emitDecoratorMetadata: true
  }
});
const { HealthController } = require('../apps/api/src/nestjs/modules/health/health.controller');
console.log('HealthController loaded:', Boolean(HealthController));
const h = new HealthController();
console.log('Health result:', h.getHealth());

