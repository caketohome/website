import postcss from "postcss";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";
import fs from "fs";
import path from "path";

async function testPostCss() {
  const cssPath = path.resolve(__dirname, "../src/app/globals.css");
  const css = fs.readFileSync(cssPath, "utf8");

  console.log("Compiling globals.css with PostCSS + Tailwind...");
  const result = await postcss([
    tailwindcss(path.resolve(__dirname, "../tailwind.config.ts")),
    autoprefixer(),
  ]).process(css, { from: cssPath });

  console.log("PostCSS compiled successfully!");
  console.log("Generated CSS output length:", result.css.length, "bytes");
  console.log("CSS warnings:", result.warnings().length);
  for (const w of result.warnings()) {
    console.warn("  Warning:", w.toString());
  }
}

testPostCss().catch(console.error);
