/**
 * CakeToHome Popup & Engagement Manager V2
 * Automated E2E Verification Suite:
 * 1. Automatic Triggers (No Exit Intent required, 3s Time-on-page, Immediate load)
 * 2. Multi-Trigger Evaluation (ANY / ALL logic)
 * 3. Direct Phone Login & 6-digit OTP Verification Flow
 * 4. Audience, Persona & Geographic Multi-City Targeting
 * 5. Frequency Capping & Priority Arbitration
 * 6. Storefront Fail-Safe Non-Blocking Error Resilience
 */

import { ApiEngine } from "../src/lib/api-engine";
import {
  evaluateCampaignTriggers,
  selectWinningPopup,
  isFrequencyCapped,
  recordFrequencyDisplay,
  renderTemplate,
  PopupCampaign,
  EngagementContext,
} from "../src/lib/engagement";

async function runPopupAutoTriggerAndLoginE2ESuite() {
  console.log("================================================================================");
  console.log("  CAKETOHOME — POPUP V2 AUTOMATIC TRIGGERS & DIRECT PHONE LOGIN E2E TEST  ");
  console.log("================================================================================");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testId: string, testName: string, details?: string) {
    if (condition) {
      console.log(`  ✅ [PASS] ${testId}: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${testId}: ${testName} ${details ? `(${details})` : ""}`);
      failed++;
    }
  }

  // Reset store to fresh canonical state
  ApiEngine.resetStoreToCanonical();

  // ---------------------------------------------------------------------------
  // PILLAR 1: AUTOMATIC TRIGGERS (NO EXIT INTENT REQUIRED)
  // ---------------------------------------------------------------------------
  console.log("\n── [Pillar 1] Automatic Triggers Without Exit Intent ──");

  const config = ApiEngine.getPublishedEngagementConfig({ device: "desktop" });
  assert(config.campaigns.length >= 3, "P1.1", "Published engagement campaigns retrieved from API engine", `Count: ${config.campaigns.length}`);

  const welcomeCampaign = config.campaigns.find((c: any) => c.id === "pop_welcome_first_order");
  assert(Boolean(welcomeCampaign), "P1.2", "Default Welcome campaign exists and is active");

  // Context: Customer visiting homepage with 0s time on site
  const contextZeroSecs: EngagementContext = {
    session: { id: "sess_test_1", pageViews: 1, timeOnSiteSeconds: 0, visitCount: 1, deviceType: "desktop" },
    customer: { isLoggedIn: false, status: "guest" },
    navigation: { pathname: "/", exitIntent: false, backAttempt: false },
    cart: { hasItems: false, itemCount: 0, total: 0, changed: false },
  };

  // At 0s, 3-second timer should not yet trigger
  const trigAt0s = evaluateCampaignTriggers(welcomeCampaign, contextZeroSecs, { type: "time_on_page" });
  assert(trigAt0s === false, "P1.3", "3s Welcome popup does not prematurely trigger at 0 seconds");

  // At 3s, timer MUST trigger automatically with NO exit intent and NO mouse movement
  const contextThreeSecs: EngagementContext = {
    ...contextZeroSecs,
    session: { ...contextZeroSecs.session!, timeOnSiteSeconds: 3 },
  };

  const trigAt3s = evaluateCampaignTriggers(welcomeCampaign, contextThreeSecs, { type: "time_on_page" });
  assert(
    trigAt3s === true,
    "P1.4",
    "Welcome popup triggers automatically after 3 seconds on page with NO exit intent",
    `Triggered: ${trigAt3s}`
  );

  // Immediate page load trigger test
  const immediateCampaign: PopupCampaign = {
    id: "pop_immediate_flash",
    name: "Immediate Flash Sale",
    slug: "immediate-flash",
    popup_type: "PROMOTIONAL",
    status: "published",
    priority: 700,
    enabled: true,
    timezone: "Asia/Kolkata",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    current_version: {
      id: "ver_imm_1",
      popup_campaign_id: "pop_immediate_flash",
      version_number: 1,
      created_at: new Date().toISOString(),
      content: { headline: "Flash Sale", description: "Grab it now!", primaryButton: { label: "Shop", action: "OPEN_CART" } },
      design: { desktopLayout: "CENTER_MODAL", tabletLayout: "CENTER_MODAL", mobileLayout: "BOTTOM_SHEET" },
      trigger: { enabled_triggers: ["immediate"], immediate: true },
      audience: { customerStatus: ["all"], devices: ["desktop", "mobile"] },
      frequency: { scope: "session", maxShows: 1 },
      schedule: {},
      offer: { type: "NONE" },
      media: { source: "NO_IMAGE" },
      rules: [],
    },
  };

  const trigImmediate = evaluateCampaignTriggers(immediateCampaign, contextZeroSecs, { type: "immediate" });
  assert(trigImmediate === true, "P1.5", "Immediate trigger fires on page load at 0 seconds without delay");

  // ---------------------------------------------------------------------------
  // PILLAR 2: MULTI-TRIGGER COMBINATIONS (ANY vs ALL LOGIC)
  // ---------------------------------------------------------------------------
  console.log("\n── [Pillar 2] Multi-Trigger Combinations (ANY vs ALL) ──");

  // Campaign requiring Exit Intent OR Scroll Depth (ANY)
  const anyCampaign: PopupCampaign = {
    id: "pop_any_test",
    name: "ANY Trigger Test",
    slug: "any-test",
    popup_type: "PROMOTIONAL",
    status: "published",
    priority: 500,
    enabled: true,
    timezone: "Asia/Kolkata",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    current_version: {
      id: "ver_any_1",
      popup_campaign_id: "pop_any_test",
      version_number: 1,
      created_at: new Date().toISOString(),
      content: { headline: "Any Test", description: "", primaryButton: { label: "OK", action: "CLOSE" } },
      design: { desktopLayout: "CENTER_MODAL", tabletLayout: "CENTER_MODAL", mobileLayout: "BOTTOM_SHEET" },
      trigger: {
        enabled_triggers: ["exit_intent", "scroll_depth"],
        combinator: "ANY",
        exitIntent: true,
        scrollDepthPercent: 50,
      },
      audience: { customerStatus: ["all"] },
      frequency: { scope: "session", maxShows: 1 },
      schedule: {},
      offer: { type: "NONE" },
      media: { source: "NO_IMAGE" },
      rules: [],
    },
  };

  const trigAnyByExit = evaluateCampaignTriggers(anyCampaign, contextZeroSecs, { type: "exit_intent" });
  const trigAnyByScroll = evaluateCampaignTriggers(anyCampaign, contextZeroSecs, { type: "scroll_depth", value: 60 });
  assert(trigAnyByExit === true && trigAnyByScroll === true, "P2.1", "ANY combinator triggers when either exit intent OR scroll depth is met");

  // Campaign requiring Cart Condition AND Time on Page (ALL)
  const allCampaign: PopupCampaign = {
    id: "pop_all_test",
    name: "ALL Trigger Test",
    slug: "all-test",
    popup_type: "CART_EXIT",
    status: "published",
    priority: 950,
    enabled: true,
    timezone: "Asia/Kolkata",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    current_version: {
      id: "ver_all_1",
      popup_campaign_id: "pop_all_test",
      version_number: 1,
      created_at: new Date().toISOString(),
      content: { headline: "Cart Time Offer", description: "", primaryButton: { label: "Checkout", action: "CHECKOUT" } },
      design: { desktopLayout: "CENTER_MODAL", tabletLayout: "CENTER_MODAL", mobileLayout: "BOTTOM_SHEET" },
      trigger: {
        enabled_triggers: ["cart_condition", "time_on_page"],
        combinator: "ALL",
        cartItemCountMin: 2,
        timeOnPageSeconds: 10,
      },
      audience: { customerStatus: ["all"] },
      frequency: { scope: "session", maxShows: 1 },
      schedule: {},
      offer: { type: "NONE" },
      media: { source: "NO_IMAGE" },
      rules: [],
    },
  };

  const contextCart1Item: EngagementContext = {
    ...contextZeroSecs,
    cart: { hasItems: true, itemCount: 1, total: 499, changed: false },
    session: { ...contextZeroSecs.session!, timeOnSiteSeconds: 15 },
  };
  const trigAllFail = evaluateCampaignTriggers(allCampaign, contextCart1Item, { type: "time_on_page" });
  assert(trigAllFail === false, "P2.2", "ALL combinator correctly rejects when one condition is unmet (1 item < 2 min)");

  const contextCart2Items: EngagementContext = {
    ...contextZeroSecs,
    cart: { hasItems: true, itemCount: 2, total: 998, changed: false },
    session: { ...contextZeroSecs.session!, timeOnSiteSeconds: 15 },
  };
  const trigAllPass = evaluateCampaignTriggers(allCampaign, contextCart2Items, { type: "time_on_page" });
  assert(trigAllPass === true, "P2.3", "ALL combinator triggers successfully when all conditions are met (2 items + 15s >= 10s)");

  // ---------------------------------------------------------------------------
  // PILLAR 3: DIRECT PHONE LOGIN & OTP VERIFICATION FLOW
  // ---------------------------------------------------------------------------
  console.log("\n── [Pillar 3] Direct Phone Login & 6-Digit OTP Flow ──");

  const testMobile = "+91 98877 66554";
  const otpReq = ApiEngine.requestAuthOtp(testMobile, "OTP_SMS", "127.0.0.1", "Storefront-Popup-Modal");
  assert(
    Boolean(otpReq.success && otpReq.dev_otp),
    "P3.1",
    "Direct Phone Login OTP request generated via backend auth API",
    `Dev OTP: ${otpReq.dev_otp}`
  );

  const otpVerify = ApiEngine.verifyAuthOtp(testMobile, otpReq.dev_otp || "123456", { name: "Pooja Hegde" }, "127.0.0.1", "Storefront-Popup-Modal");
  assert(
    Boolean(otpVerify.success && otpVerify.role === "CUSTOMER" && otpVerify.token),
    "P3.2",
    "6-digit OTP verification authenticates user and returns scoped JWT session token",
    `Token prefix: ${otpVerify.token?.slice(0, 15)}...`
  );

  // Verification that template interpolation works seamlessly with auth state
  const renderedText = renderTemplate(
    "Hello {{customer_name}}, enjoy code {{coupon_code}} on your first order!",
    { customer: { isLoggedIn: true, name: "Pooja Hegde", status: "logged_in" } },
    { couponCode: "SWEET150" }
  );
  assert(
    renderedText === "Hello Pooja Hegde, enjoy code SWEET150 on your first order!",
    "P3.3",
    "Dynamic template tags ({{customer_name}}, {{coupon_code}}) interpolate authenticated state",
    renderedText
  );

  // ---------------------------------------------------------------------------
  // PILLAR 4: AUDIENCE, PERSONA & GEOGRAPHIC TARGETING
  // ---------------------------------------------------------------------------
  console.log("\n── [Pillar 4] Audience, Persona & Geographic Targeting ──");

  const blrCityCampaign: PopupCampaign = {
    id: "pop_blr_city",
    name: "Bangalore Express Welcome",
    slug: "blr-express",
    popup_type: "PROMOTIONAL",
    status: "published",
    priority: 800,
    enabled: true,
    timezone: "Asia/Kolkata",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    current_version: {
      id: "ver_blr_1",
      popup_campaign_id: "pop_blr_city",
      version_number: 1,
      created_at: new Date().toISOString(),
      content: { headline: "Bangalore Special", description: "", primaryButton: { label: "Order", action: "OPEN_CART" } },
      design: { desktopLayout: "CENTER_MODAL", tabletLayout: "CENTER_MODAL", mobileLayout: "BOTTOM_SHEET" },
      trigger: { enabled_triggers: ["time_on_page"], timeOnPageSeconds: 1 },
      audience: { customerStatus: ["all"], cityIds: ["city_blr"] },
      frequency: { scope: "session", maxShows: 1 },
      schedule: {},
      offer: { type: "NONE" },
      media: { source: "NO_IMAGE" },
      rules: [],
    },
  };

  const contextBlrCity: EngagementContext = {
    ...contextZeroSecs,
    customer: { isLoggedIn: false, status: "guest", cityId: "city_blr" },
    session: { ...contextZeroSecs.session!, timeOnSiteSeconds: 5 },
  };
  const contextDelCity: EngagementContext = {
    ...contextZeroSecs,
    customer: { isLoggedIn: false, status: "guest", cityId: "city_del" },
    session: { ...contextZeroSecs.session!, timeOnSiteSeconds: 5 },
  };

  const winnerBlr = selectWinningPopup([blrCityCampaign], contextBlrCity, () => false);
  const winnerDel = selectWinningPopup([blrCityCampaign], contextDelCity, () => false);

  assert(Boolean(winnerBlr && winnerBlr.id === "pop_blr_city"), "P4.1", "City targeting matches customer in Bangalore");
  assert(winnerDel === null, "P4.2", "City targeting rejects customer in Delhi when campaign is Bangalore-only");

  // ---------------------------------------------------------------------------
  // PILLAR 5: FREQUENCY CAPPING & PRIORITY CONFLICT ARBITRATION
  // ---------------------------------------------------------------------------
  console.log("\n── [Pillar 5] Frequency Capping & Priority Conflict Arbitration ──");

  // Record display
  recordFrequencyDisplay("pop_welcome_first_order", contextThreeSecs);
  const isCapped = isFrequencyCapped(welcomeCampaign, contextThreeSecs);
  assert(isCapped === true, "P5.1", "Frequency capping prevents popup from displaying twice in same session");

  // Priority arbitration between high and low priority candidates
  const lowPriorityCamp: PopupCampaign = {
    ...welcomeCampaign,
    id: "pop_low_prio",
    name: "Low Priority Campaign",
    priority: 100,
    popup_type: "PROMOTIONAL",
  };
  const highPriorityCamp: PopupCampaign = {
    ...welcomeCampaign,
    id: "pop_high_prio",
    name: "High Priority Campaign",
    priority: 950,
    popup_type: "ABANDONED_CART",
  };

  const arbitrationWinner = selectWinningPopup([lowPriorityCamp, highPriorityCamp], contextThreeSecs, () => false);
  assert(
    arbitrationWinner?.id === "pop_high_prio",
    "P5.2",
    "Priority arbitration selects highest priority campaign during conflict",
    `Winner: ${arbitrationWinner?.name}`
  );

  // ---------------------------------------------------------------------------
  // PILLAR 6: STOREFRONT FAIL-SAFE & NON-BLOCKING RESILIENCE
  // ---------------------------------------------------------------------------
  console.log("\n── [Pillar 6] Storefront Fail-Safe & Non-Blocking Resilience ──");

  // Simulate empty / suppressed campaigns list
  const emptyWinner = selectWinningPopup([], contextZeroSecs, () => false);
  assert(emptyWinner === null, "P6.1", "Zero published campaigns returns null gracefully with 0 exceptions");

  // Impression telemetry recording
  const impRes = ApiEngine.recordEngagementImpression({
    campaign_id: "pop_welcome_first_order",
    event_type: "shown",
    page_url: "/",
    device_type: "desktop",
  });
  assert(impRes.success === true, "P6.2", "Impression telemetry recorded in persistence store");

  const convRes = ApiEngine.recordEngagementConversion({
    campaign_id: "pop_welcome_first_order",
    conversion_type: "LOGIN",
    revenue: 0,
  });
  assert(convRes.success === true, "P6.3", "Conversion telemetry recorded in persistence store");

  const analytics = ApiEngine.getPopupAnalyticsSummary();
  assert(
    Boolean(analytics.success && analytics.summary.total_impressions >= 1),
    "P6.4",
    "Analytics summary aggregates impressions and conversions accurately",
    JSON.stringify(analytics.summary)
  );

  // ---------------------------------------------------------------------------
  // SUMMARY REPORT
  // ---------------------------------------------------------------------------
  console.log("\n================================================================================");
  console.log(`  E2E TEST SUMMARY: ${passed} PASSED | ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log("================================================================================");

  if (failed > 0) {
    throw new Error(`Popup V2 E2E Suite failed with ${failed} failing test(s).`);
  }
}

runPopupAutoTriggerAndLoginE2ESuite().catch((err) => {
  console.error("FATAL ERROR IN POPUP V2 E2E SUITE:", err);
  process.exit(1);
});
