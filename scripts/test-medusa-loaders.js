const path = require('path');
const backendDir = path.resolve(__dirname, '../backend');
process.chdir(backendDir);

require('dotenv').config();
require('ts-node').register({ transpileOnly: true });
require('tsconfig-paths').register({});

console.log('Testing Medusa loaders step by step...');

async function testLoaders() {
  try {
    const { initializeContainer } = require('@medusajs/medusa/dist/loaders');
    console.log('1. Initializing container...');
    const container = await initializeContainer(backendDir, { skipDbConnection: false });
    console.log('2. Container initialized successfully!');

    const express = require('express');
    const app = express();
    
    console.log('3. Running medusa loaders...');
    const loaders = require('@medusajs/medusa/dist/loaders').default;
    const { shutdown } = await loaders({
      directory: backendDir,
      expressApp: app
    });
    console.log('4. Loaders finished successfully!');

    app.get('/health', (req, res) => res.status(200).send('OK'));

    const server = app.listen(9000, () => {
      console.log('5. Express server is listening on http://localhost:9000 !');
    });
  } catch (err) {
    console.error('FAILED IN TEST LOADERS:', err);
  }
}

testLoaders();
