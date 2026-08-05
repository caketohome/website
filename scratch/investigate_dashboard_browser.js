const path = require("path");
const { chromium } = require(path.join(__dirname, "../frontend/node_modules/playwright"));

(async () => {
  console.log("Starting dashboard browser investigation...");
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (e) {
    console.log("Chromium launch failed:", e.message);
    process.exit(1);
  }
  const page = await browser.newPage();

  const consoleLogs = [];
  const networkRequests = [];
  const uncaughtErrors = [];

  page.on("console", (msg) => {
    consoleLogs.push({
      type: msg.type(),
      text: msg.text(),
      location: msg.location(),
    });
    console.log(`[BROWSER CONSOLE ${msg.type().toUpperCase()}]`, msg.text());
  });

  page.on("pageerror", (err) => {
    uncaughtErrors.push({
      message: err.message,
      stack: err.stack,
    });
    console.log("[BROWSER PAGE ERROR]", err.message, err.stack);
  });

  page.on("request", (req) => {
    networkRequests.push({
      url: req.url(),
      method: req.method(),
      headers: req.headers(),
      timestamp: Date.now(),
    });
  });

  page.on("response", async (res) => {
    const req = networkRequests.find(r => r.url === res.url());
    if (req) {
      req.status = res.status();
      req.statusText = res.statusText();
      try {
        req.responseBody = await res.text();
      } catch (e) {
        req.responseBody = "<failed to read body>";
      }
    }
  });

  try {
    console.log("Navigating to http://localhost:3000/dashboard...");
    await page.goto("http://localhost:3000/dashboard", { waitUntil: "networkidle", timeout: 15000 });
  } catch (err) {
    console.log("Navigation error / timeout:", err.message);
  }

  await page.waitForTimeout(3000);

  console.log("\n=== NETWORK REQUESTS SUMMARY ===");
  networkRequests.forEach((req, idx) => {
    console.log(`${idx + 1}. [${req.method}] ${req.url} -> Status: ${req.status || 'PENDING'}`);
    if (req.responseBody && req.responseBody.length < 500) {
      console.log(`   Response: ${req.responseBody}`);
    }
  });

  console.log("\n=== UNCAUGHT ERRORS ===");
  console.log(JSON.stringify(uncaughtErrors, null, 2));

  console.log("\n=== CONSOLE LOGS (ERRORS & WARNS) ===");
  consoleLogs.filter(l => l.type === 'error' || l.type === 'warning').forEach(l => {
    console.log(`[${l.type}] ${l.text} (${l.location.url}:${l.location.lineNumber}:${l.location.columnNumber})`);
  });

  await browser.close();
})();
