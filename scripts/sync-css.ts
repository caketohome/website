/* Next.js layout.css sync script */
import fs from "fs";
import path from "path";

const cssDir = path.join(process.cwd(), "frontend", ".next", "static", "css");
const appDir = path.join(cssDir, "app");

if (!fs.existsSync(appDir)) {
  fs.mkdirSync(appDir, { recursive: true });
}

// Find the compiled CSS bundle
const files = fs.readdirSync(cssDir);
const mainCss = files.find(f => f.endsWith(".css"));

if (mainCss) {
  const cssContent = fs.readFileSync(path.join(cssDir, mainCss));
  fs.writeFileSync(path.join(appDir, "layout.css"), cssContent);
  console.log(`✅ Synced ${mainCss} (${cssContent.length} bytes) to ${path.join(appDir, "layout.css")}`);
} else {
  console.log("No compiled CSS found.");
}
