import { retrieveUser } from "../src/lib/data/users";
import { getHomepage } from "../src/lib/data/cms";
import { listProducts, listPimCategories, listOccasions } from "../src/lib/data/catalog";
import { ApiEngine } from "../src/lib/api-engine";

async function main() {
  console.log("=== DIAGNOSTIC: ROOT ROUTE DATA LAYER ===");

  try {
    console.log("1. Testing retrieveUser()...");
    const user = await retrieveUser();
    console.log("   -> retrieveUser success:", user);
  } catch (e: any) {
    console.error("   -> retrieveUser ERROR:", e?.message, e?.stack);
  }

  try {
    console.log("2. Testing getHomepage()...");
    const cms = await getHomepage();
    console.log("   -> getHomepage success: page title =", cms?.page?.title, "sections count =", cms?.sections?.length);
  } catch (e: any) {
    console.error("   -> getHomepage ERROR:", e?.message, e?.stack);
  }

  try {
    console.log("3. Testing listProducts()...");
    const products = await listProducts();
    console.log("   -> listProducts success: count =", products?.length);
  } catch (e: any) {
    console.error("   -> listProducts ERROR:", e?.message, e?.stack);
  }

  try {
    console.log("4. Testing listPimCategories()...");
    const cats = await listPimCategories();
    console.log("   -> listPimCategories success: count =", cats?.length);
  } catch (e: any) {
    console.error("   -> listPimCategories ERROR:", e?.message, e?.stack);
  }

  try {
    console.log("5. Testing listOccasions()...");
    const occasions = await listOccasions();
    console.log("   -> listOccasions success: count =", occasions?.length);
  } catch (e: any) {
    console.error("   -> listOccasions ERROR:", e?.message, e?.stack);
  }

  try {
    console.log("6. Testing ApiEngine.getProducts()...");
    const apiProducts = ApiEngine.getProducts();
    console.log("   -> ApiEngine.getProducts success: count =", apiProducts?.length);
  } catch (e: any) {
    console.error("   -> ApiEngine.getProducts ERROR:", e?.message, e?.stack);
  }

  try {
    console.log("7. Testing ApiEngine.getCategories()...");
    const apiCats = ApiEngine.getCategories();
    console.log("   -> ApiEngine.getCategories success: count =", apiCats?.length);
  } catch (e: any) {
    console.error("   -> ApiEngine.getCategories ERROR:", e?.message, e?.stack);
  }

  console.log("=== DIAGNOSTIC COMPLETE ===");
}

main();
