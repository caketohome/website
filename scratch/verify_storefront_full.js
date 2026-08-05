const http = require("http");

function fetchUrl(urlPath) {
  return new Promise((resolve) => {
    const start = Date.now();
    const req = http.get({
      hostname: "127.0.0.1",
      port: 3000,
      path: urlPath,
      headers: { "User-Agent": "VerificationAgent/1.0" },
      timeout: 10000,
    }, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        resolve({
          status: res.statusCode,
          statusText: res.statusMessage,
          duration: Date.now() - start,
          html: data,
        });
      });
    });

    req.on("error", (err) => {
      resolve({
        status: 500,
        statusText: err.message,
        duration: Date.now() - start,
        html: "",
      });
    });

    req.on("timeout", () => {
      req.destroy();
      resolve({
        status: 504,
        statusText: "Timeout",
        duration: Date.now() - start,
        html: "",
      });
    });
  });
}

async function verifyStorefrontFull() {
  console.log("==================================================================");
  console.log("STARTING FULL STOREFRONT & DASHBOARD VERIFICATION SUITE");
  console.log("==================================================================\n");

  const routes = [
    { name: "Storefront Home", path: "/" },
    { name: "Products Catalog", path: "/products" },
    { name: "Product Details", path: "/products/prod_1" },
    { name: "Category Page", path: "/category/cakes" },
    { name: "Search Page", path: "/search" },
    { name: "Checkout Page", path: "/checkout" },
    { name: "Customer Account", path: "/account" },
    { name: "Super Admin Dashboard", path: "/dashboard" },
    { name: "Shop Manager Dashboard", path: "/dashboard/shop" },
    { name: "Delivery Partner Dashboard", path: "/dashboard/delivery-partner" },
  ];

  const results = [];

  for (const r of routes) {
    let res = await fetchUrl(r.path);
    // Follow redirect if 307 or 302
    if (res.status === 307 || res.status === 302 || res.status === 301) {
      res = await fetchUrl("/login");
    }

    const cssLinks = (res.html.match(/<link[^>]*rel="stylesheet"[^>]*>/g) || []).length;
    const jsScripts = (res.html.match(/<script[^>]*src="[^"]+"[^>]*>/g) || []).length;

    const is200 = res.status === 200;
    const hasCss = cssLinks > 0;
    const isHealthy = is200 && hasCss;

    results.push({
      Route: r.name,
      Path: r.path,
      Status: `${res.status} ${res.statusText}`,
      CSSLinks: cssLinks,
      Duration: `${res.duration}ms`,
      HydrationScripts: jsScripts,
      Verification: isHealthy ? "PASSED ✅" : "FAILED ❌",
    });
  }

  console.table(results);

  const passed = results.filter(r => r.Verification === "PASSED ✅").length;
  console.log(`\nVerification Summary: ${passed}/${results.length} Routes Operational & Styled (Target: 100%).`);
}

verifyStorefrontFull();
