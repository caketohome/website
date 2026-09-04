import { execSync } from "child_process";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Execute the TS test script via tsx
try {
  execSync("npx tsx scripts/test-product-db-persistence.ts", {
    stdio: "inherit",
    cwd: path.resolve(__dirname, ".."),
  });
} catch (err) {
  process.exit(1);
}
