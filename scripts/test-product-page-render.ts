import { ApiEngine } from "../frontend/src/lib/api-engine";

async function testRender() {
  try {
    const targetId = "prod_1";
    const fetched = ApiEngine.getProductById(targetId) || ApiEngine.getProductBySlug(targetId);
    console.log("Fetched product:", fetched?.title, fetched?.price);

    const weightPrices = (fetched as any)?.weight_prices || (fetched as any)?.weights || [];
    const masterVariantOptions = (fetched as any)?.variant_options || [];
    const pimConfig = (fetched as any)?.pim_config || {};
    console.log("PIM config:", pimConfig);
    console.log("Weight prices:", weightPrices);
    console.log("Variant options:", masterVariantOptions);
    console.log("✅ Server data fetching succeeded for product detail!");
  } catch (err: any) {
    console.error("❌ Error during testRender:", err);
  }
}
testRender();
