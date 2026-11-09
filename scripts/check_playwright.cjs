const path = require('path');
try {
  const playwright = require(path.resolve('E:/vig/cakes2home-main/cakes2home-main/frontend/node_modules/playwright'));
  console.log('Playwright installed!');
} catch (e) {
  try {
    const pwTest = require(path.resolve('E:/vig/cakes2home-main/cakes2home-main/frontend/node_modules/@playwright/test'));
    console.log('@playwright/test installed!');
  } catch (e2) {
    console.log('Playwright require failed:', e2.message);
  }
}
