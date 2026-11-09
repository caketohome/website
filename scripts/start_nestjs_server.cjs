const path = require('path');
const moduleAlias = require('module');
const origResolve = moduleAlias._resolveFilename;

moduleAlias._resolveFilename = function (request, parent, isMain, options) {
  if (request === 'pg' || request.startsWith('pg/')) {
    try {
      return require.resolve(request, { paths: ['E:/vig/cakes2home-main/cakes2home-main/frontend/node_modules'] });
    } catch (e) {}
  }
  return origResolve.call(this, request, parent, isMain, options);
};

require('E:/vig/cakes2home-main/cakes2home-main/backend/node_modules/ts-node').register({
  transpileOnly: true,
  skipProject: true,
  compilerOptions: {
    module: 'commonjs',
    target: 'es2021',
    experimentalDecorators: true,
    emitDecoratorMetadata: true,
  },
});

require("reflect-metadata");
const { bootstrapNestStandalone } = require('E:/vig/cakes2home-main/cakes2home-main/apps/api/src/nestjs/bootstrap.ts');

const PORT = process.env.NEST_PORT ? parseInt(process.env.NEST_PORT, 10) : 9000;

bootstrapNestStandalone(PORT)
  .then(() => {
    console.log(`[NestJS Server] Running successfully on port ${PORT}`);
  })
  .catch((err) => {
    console.error('[NestJS Server] Fatal bootstrap error:', err);
    process.exit(1);
  });
