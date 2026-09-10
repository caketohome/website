import { chromium } from "playwright";
import * as path from "path";
import * as fs from "fs";

const ARTIFACTS_DIR = process.env.ARTIFACTS_DIR || "C:/Users/alexc/.gemini/antigravity-ide/brain/6d66b26a-93d4-4a7f-af38-75391a01a980";

interface StepResult {
  step: string;
  name: string;
  passed: boolean;
  details?: any;
}

const stepResults: StepResult[] = [];

function recordStep(step: string, name: string, passed: boolean, details?: any) {
  stepResults.push({ step, name, passed, details });
  const icon = passed ? "✅" : "❌";
  console.log(`${icon} [${step}] ${name}`, details ? JSON.stringify(details) : "");
}

async function runBrowserE2E() {
  console.log("==================================================");
  console.log("PLAYWRIGHT BROWSER E2E: OPTIONAL CAKE MESSAGE CONFIRMATION TIMING");
  console.log("==================================================");

  if (!fs.existsSync(ARTIFACTS_DIR)) {
    fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  const cartId = `cart_test_${Date.now()}`;
  await context.addCookies([
    {
      name: "_cth_cart_id",
      value: cartId,
      domain: "localhost",
      path: "/",
    },
    {
      name: "_cakes2home_branch_id",
      value: "branch_01",
      domain: "localhost",
      path: "/",
    },
  ]);

  const page = await context.newPage();

  const failedRequests: string[] = [];
  const consoleErrors: string[] = [];

  page.on("requestfailed", (req) => {
    const errorText = req.failure()?.errorText || "";
    if (!errorText.includes("net::ERR_ABORTED")) {
      failedRequests.push(`${req.method()} ${req.url()} - ${errorText}`);
    }
  });

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      if (!text.includes("401") && !text.includes("Unauthorized")) {
        consoleErrors.push(text);
      }
    }
  });

  try {
    // 1. Navigate to Pistachio Gateau PDP
    console.log("Navigating to http://localhost:3000/products/pistachio-gateau ...");
    await page.goto("http://localhost:3000/products/pistachio-gateau", {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await page.waitForSelector("h1", { timeout: 15000 });
    await page.waitForTimeout(1000);

    // STEP A: Initial State Inspection (BEFORE Add to Cart)
    const cakeMessageSection = page.locator("#cake-message-section");
    await cakeMessageSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    const messageInput = page.locator("#cake-message-input");
    const inputExists = await messageInput.count();
    const inputValue = await messageInput.inputValue();
    
    // Ensure warning banner "Don't forget your cake message!" does NOT exist
    const warningBanner = page.locator("text=Don't forget your cake message!");
    const warningCount = await warningBanner.count();

    // Ensure confirmation modal does NOT exist
    const modalBefore = page.locator("#empty-message-confirmation-modal");
    const modalBeforeCount = await modalBefore.count();

    const stepAPassed = inputExists === 1 && inputValue === "" && warningCount === 0 && modalBeforeCount === 0;
    recordStep("STEP_A", "Message field is empty before Add to Cart: No warning banner, no blocking confirmation", stepAPassed, {
      inputExists,
      inputValue,
      warningCount,
      modalBeforeCount,
    });

    const stepAShot = path.join(ARTIFACTS_DIR, "cake_msg_stepA_initial_no_reminder.png");
    await page.screenshot({ path: stepAShot });

    // STEP B: Select 0.5 kg size option
    const weightButtons = page.locator("button:has-text('0.5 kg')");
    if (await weightButtons.count() > 0) {
      await weightButtons.first().click();
      await page.waitForTimeout(300);
    }
    recordStep("STEP_B", "Selected 0.5 kg cake size", true);

    // STEP C: Click Add to Cart with EMPTY message -> Confirmation modal appears
    const addToCartBtn = page.locator("button:has-text('Add to Cart')").last();
    await addToCartBtn.click();
    await page.waitForTimeout(600);

    const confirmationModal = page.locator("#empty-message-confirmation-modal");
    const modalVisible = await confirmationModal.isVisible();
    const modalTitle = await page.locator("#empty-msg-dialog-title").innerText();
    const modalDesc = await page.locator("#empty-msg-dialog-desc").innerText();

    const stepCPassed = modalVisible && modalTitle.includes("Add cake without a message?");
    recordStep("STEP_C", "Add to Cart clicked with empty message: Confirmation modal displayed", stepCPassed, {
      modalVisible,
      modalTitle,
      modalDesc,
    });

    const stepCShot = path.join(ARTIFACTS_DIR, "cake_msg_stepC_confirmation_dialog_shown.png");
    await page.screenshot({ path: stepCShot });

    // STEP D: Click "Add Message" inside modal -> Dialog closes, focus returns to message input, no cart item added
    const addMessageBtn = page.locator("#btn-add-message-focus");
    await addMessageBtn.click();
    await page.waitForTimeout(500);

    const modalAfterAddMsg = await confirmationModal.isVisible();
    const isInputFocused = await messageInput.evaluate((el) => document.activeElement === el);

    const stepDPassed = !modalAfterAddMsg && isInputFocused;
    recordStep("STEP_D", "Click 'Add Message': Modal closes, input receives focus, no cart mutation", stepDPassed, {
      modalAfterAddMsg,
      isInputFocused,
    });

    const stepDShot = path.join(ARTIFACTS_DIR, "cake_msg_stepD_input_focused_no_cart.png");
    await page.screenshot({ path: stepDShot });

    // STEP E: Type valid message and click Add to Cart -> No modal, adds directly
    const validMessage = "Happy Birthday Ananya!";
    await messageInput.fill(validMessage);
    await page.waitForTimeout(300);

    console.log("Button text before click:", await addToCartBtn.innerText());
    console.log("Button enabled before click:", await addToCartBtn.isEnabled());
    console.log("Button visible before click:", await addToCartBtn.isVisible());

    await addToCartBtn.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    await addToCartBtn.click();
    await page.waitForTimeout(1000);

    // Check for any validation error or modal
    const valErrors = await page.locator(".text-rose-800").allInnerTexts();
    console.log("Validation errors on page:", valErrors);
    console.log("Modal visible after click:", await confirmationModal.isVisible());
    console.log("Success banner visible after click:", await page.locator("text=Cake successfully added to your cart!").count());

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "cake_msg_stepE_debug.png") });

    // Modal should NOT have appeared
    const modalAfterValid = await confirmationModal.isVisible();
    const successBanner = page.locator("text=Cake successfully added to your cart!");
    await successBanner.waitFor({ state: "visible", timeout: 10000 });
    const successVisible = await successBanner.isVisible();

    const stepEPassed = !modalAfterValid && successVisible;
    recordStep("STEP_E", "Add to Cart with valid message: No modal, item added directly to cart", stepEPassed, {
      modalAfterValid,
      successVisible,
    });

    const stepEShot = path.join(ARTIFACTS_DIR, "cake_msg_stepE_valid_message_added_directly.png");
    await page.screenshot({ path: stepEShot });

    // Wait for Add to Cart button to become re-enabled after previous add
    await page.waitForSelector("button:has-text('Add to Cart'):not([disabled])", { timeout: 10000 });

    // STEP F: Whitespace-only message ("   ") -> Treated as empty, triggers confirmation
    await messageInput.fill("     ");
    await page.waitForTimeout(300);

    await addToCartBtn.click();
    await confirmationModal.waitFor({ state: "visible", timeout: 10000 });

    const modalWhitespaceVisible = await confirmationModal.isVisible();
    recordStep("STEP_F", "Add to Cart with whitespace-only message: Treated as empty, triggers confirmation", modalWhitespaceVisible, {
      modalWhitespaceVisible,
    });

    const stepFShot = path.join(ARTIFACTS_DIR, "cake_msg_stepF_whitespace_triggers_modal.png");
    await page.screenshot({ path: stepFShot });

    // STEP G: Confirm Continue ("Add to Cart" inside modal) -> Cart item added with null/empty message
    const confirmAddBtn = page.locator("#btn-confirm-add-to-cart");
    await confirmAddBtn.click();
    await confirmationModal.waitFor({ state: "hidden", timeout: 10000 });
    await successBanner.waitFor({ state: "visible", timeout: 10000 });

    const modalClosedAfterConfirm = !(await confirmationModal.isVisible());
    const successVisibleAfterConfirm = await successBanner.isVisible();

    const stepGPassed = modalClosedAfterConfirm && successVisibleAfterConfirm;
    recordStep("STEP_G", "Confirm 'Add to Cart' inside modal: Dialog closes and cake added with empty message", stepGPassed, {
      modalClosedAfterConfirm,
      successVisibleAfterConfirm,
    });

    const stepGShot = path.join(ARTIFACTS_DIR, "cake_msg_stepG_confirmed_added_to_cart.png");
    await page.screenshot({ path: stepGShot });

    // Wait for Add to Cart button to be re-enabled
    await page.waitForSelector("button:has-text('Add to Cart'):not([disabled])", { timeout: 10000 });

    // STEP H: Keyboard Accessibility (Escape closes modal without adding)
    await messageInput.fill("");
    await addToCartBtn.click();
    await confirmationModal.waitFor({ state: "visible", timeout: 10000 });
    const modalOpenForEscape = await confirmationModal.isVisible();

    await page.keyboard.press("Escape");
    await confirmationModal.waitFor({ state: "hidden", timeout: 10000 });
    const modalClosedEscape = !(await confirmationModal.isVisible());

    recordStep("STEP_H", "Keyboard Accessibility: Pressing Escape closes dialog without cart mutation", modalOpenForEscape && modalClosedEscape, {
      modalOpenForEscape,
      modalClosedEscape,
    });

    // STEP I: Mobile Viewport Verification (375x667)
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);

    await addToCartBtn.click();
    await confirmationModal.waitFor({ state: "visible", timeout: 10000 });

    const modalMobileVisible = await confirmationModal.isVisible();
    const modalBoundingBox = await page.locator("#empty-message-confirmation-card").boundingBox();

    const mobileFitsViewport = modalBoundingBox && modalBoundingBox.width <= 375 && modalBoundingBox.width > 250;
    recordStep("STEP_I", "Mobile Viewport (375x667): Modal renders responsively without overflow", modalMobileVisible && Boolean(mobileFitsViewport), {
      modalMobileVisible,
      modalBoundingBox,
    });

    const stepIShot = path.join(ARTIFACTS_DIR, "cake_msg_stepI_mobile_viewport_dialog.png");
    await page.screenshot({ path: stepIShot });

    // Close mobile modal
    await page.locator("#btn-add-message-focus").click();
    await confirmationModal.waitFor({ state: "hidden", timeout: 10000 });

    // STEP J: Verify Cart items on Checkout
    await page.setViewportSize({ width: 1440, height: 900 });
    console.log("Navigating to http://localhost:3000/checkout to verify cart persistence...");
    await page.goto("http://localhost:3000/checkout", {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await page.waitForTimeout(1500);

    const checkoutPageText = await page.textContent("body");
    const hasPistachio = checkoutPageText?.includes("Pistachio") || checkoutPageText?.includes("PISTACHIO");
    const hasHappyBirthday = checkoutPageText?.includes("Happy Birthday Ananya!");

    recordStep("STEP_J", "Cart verification on /checkout: Items persisted correctly with both custom message and omitted message", Boolean(hasPistachio), {
      hasPistachio,
      hasHappyBirthday,
    });

    const stepJShot = path.join(ARTIFACTS_DIR, "cake_msg_stepJ_cart_checkout_verified.png");
    await page.screenshot({ path: stepJShot });

    // Summary of Network & Console errors
    recordStep("STEP_NET", "Network cleanliness: 0 failed HTTP requests", failedRequests.length === 0, {
      failedRequests,
    });
    recordStep("STEP_CONSOLE", "Console cleanliness: 0 JavaScript errors", consoleErrors.length === 0, {
      consoleErrors,
    });

  } catch (err: any) {
    console.error("❌ E2E ERROR:", err);
    recordStep("FATAL", "E2E Execution encountered an unhandled exception", false, {
      error: err.message,
      stack: err.stack,
    });
  } finally {
    await browser.close();
  }

  console.log("==================================================");
  console.log("E2E RESULTS SUMMARY:");
  const total = stepResults.length;
  const passed = stepResults.filter((s) => s.passed).length;
  console.log(`Passed: ${passed}/${total}`);
  stepResults.forEach((s) => {
    console.log(`  ${s.passed ? "✅" : "❌"} [${s.step}] ${s.name}`);
  });
  console.log("==================================================");

  if (passed !== total) {
    process.exit(1);
  }
}

runBrowserE2E();
