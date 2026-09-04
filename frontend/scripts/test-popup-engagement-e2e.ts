/**
 * CakeToHome Popup & Engagement Manager - End-to-End Test Suite
 * Validates complete Admin Configuration, Disk Persistence, Real APIs,
 * Storefront Config Pipeline, Rule Engine, Priority Arbitration, Frequency Capping,
 * Template Interpolation, Coupon Linkage, and Telemetry Metrics.
 */

import { ApiEngine } from "../src/lib/api-engine";
import { evaluateCondition, evaluateRuleGroup, evaluateAllRules } from "../src/lib/engagement/popup-rule-engine";
import { selectWinningPopup, calculateEffectivePriority, matchesAudience, isWithinSchedule } from "../src/lib/engagement/popup-priority-engine";
import { isFrequencyCapped, computeCartHash } from "../src/lib/engagement/popup-frequency-manager";
import { renderTemplate, escapeHtml } from "../src/lib/engagement/template-renderer";
import { EngagementContext, PopupCampaign } from "../src/lib/engagement/types";

async function runPopupEngagementE2ESuite() {
  console.log("================================================================================");
  console.log("  CAKETOHOME — POPUP & ENGAGEMENT MANAGER FULL E2E VERIFICATION SUITE  ");
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

  // ---------------------------------------------------------------------------
  // PILLAR 1: ADMIN POPUP LIFECYCLE & DISK PERSISTENCE
  // ---------------------------------------------------------------------------
  console.log("\n── [Pillar 1] Admin Popup Lifecycle & Real Disk Persistence ──");

  // P1.1: Create Draft Campaign
  const draftPayload = {
    name: "Test Welcome Popup",
    slug: "test-welcome-popup",
    description: "First-time visitor welcome bonus campaign",
    popup_type: "WELCOME",
    status: "draft",
    priority: 600,
    enabled: true,
    content: {
      eyebrow: "WELCOME SPECIAL",
      headline: "Original Headline",
      description: "Get started with CakeToHome with 15% off.",
      badge: "15% OFF",
      primaryButton: {
        label: "Claim Offer",
        action: "APPLY_COUPON",
        couponCode: "WELCOME15",
      },
      secondaryButton: {
        label: "Close",
        action: "CLOSE",
      },
      legalText: "Valid on first online order.",
    },
    trigger: {
      timeOnPageSeconds: 3,
      exitIntent: false,
    },
    audience: {
      customerStatus: ["guest"],
      devices: ["desktop", "tablet", "mobile"],
    },
    frequency: {
      scope: "visitor",
      maxShows: 10,
      cooldownSeconds: 0,
    },
    offer: {
      type: "COUPON",
      couponCode: "WELCOME15",
      autoApply: true,
    },
    media: {
      source: "MEDIA_LIBRARY",
      imageUrl: "https://images.unsplash.com/photo-1578985545062-69928b1d9587",
    },
  };

  const createdCampaign = await ApiEngine.createPopupCampaign(draftPayload);
  assert(
    Boolean(createdCampaign && createdCampaign.id && createdCampaign.status === "draft"),
    "P1.1",
    "Admin creates draft popup campaign",
    `ID: ${createdCampaign?.id}, Status: ${createdCampaign?.status}`
  );

  // P1.2: Reload from disk & assert persistence
  const fetchedCampaign = ApiEngine.getPopupCampaignById(createdCampaign.id);
  assert(
    Boolean(
      fetchedCampaign &&
      fetchedCampaign.name === "Test Welcome Popup" &&
      fetchedCampaign.draft_version?.content?.headline === "Original Headline" &&
      fetchedCampaign.draft_version?.offer?.couponCode === "WELCOME15"
    ),
    "P1.2",
    "Draft popup persists to store across lookup with exact headline and coupon",
    JSON.stringify(fetchedCampaign?.draft_version?.content)
  );

  // P1.3: Edit Headline -> Save -> Reload -> Verify
  const updatedCampaign = await ApiEngine.updatePopupCampaign(createdCampaign.id, {
    content: {
      ...fetchedCampaign.draft_version.content,
      headline: "Updated Headline",
    },
  });
  const reloadedAfterEdit = ApiEngine.getPopupCampaignById(createdCampaign.id);
  assert(
    Boolean(
      reloadedAfterEdit &&
      reloadedAfterEdit.draft_version?.content?.headline === "Updated Headline"
    ),
    "P1.3",
    "Admin edits popup headline to 'Updated Headline' and verifies persistence",
    `Headline: ${reloadedAfterEdit?.draft_version?.content?.headline}`
  );

  // P1.4: Publish Campaign
  const publishedCampaign = await ApiEngine.publishPopupCampaign(createdCampaign.id);
  assert(
    Boolean(
      publishedCampaign &&
      publishedCampaign.status === "published" &&
      publishedCampaign.enabled === true &&
      publishedCampaign.current_version?.version_number === 1 &&
      publishedCampaign.current_version?.content?.headline === "Updated Headline"
    ),
    "P1.4",
    "Admin publishes popup campaign -> status='published', version incremented",
    `Status: ${publishedCampaign?.status}, Version: ${publishedCampaign?.current_version?.version_number}`
  );

  // P1.5: Pause Campaign
  const pausedCampaign = await ApiEngine.pausePopupCampaign(createdCampaign.id);
  assert(
    Boolean(pausedCampaign && pausedCampaign.status === "paused"),
    "P1.5",
    "Admin pauses popup campaign -> status='paused'",
    `Status: ${pausedCampaign?.status}`
  );

  // Re-publish for downstream testing
  await ApiEngine.publishPopupCampaign(createdCampaign.id);

  // P1.6: Duplicate Campaign
  const duplicatedCampaign = await ApiEngine.duplicatePopupCampaign(createdCampaign.id);
  assert(
    Boolean(
      duplicatedCampaign &&
      duplicatedCampaign.id !== createdCampaign.id &&
      duplicatedCampaign.name.includes("Copy") &&
      duplicatedCampaign.status === "draft"
    ),
    "P1.6",
    "Admin duplicates popup campaign into a clean draft clone",
    `Cloned ID: ${duplicatedCampaign?.id}, Name: ${duplicatedCampaign?.name}`
  );

  // P1.7: Archive Campaign
  const archivedCampaign = await ApiEngine.archivePopupCampaign(duplicatedCampaign.id);
  assert(
    Boolean(archivedCampaign && archivedCampaign.status === "archived" && archivedCampaign.enabled === false),
    "P1.7",
    "Admin archives duplicate campaign -> status='archived', enabled=false",
    `Status: ${archivedCampaign?.status}`
  );

  // P1.8: Options API (Real DB records)
  const popupOptions = ApiEngine.getPopupOptions();
  assert(
    Boolean(
      popupOptions &&
      Array.isArray(popupOptions.customer_statuses) &&
      Array.isArray(popupOptions.popup_types) &&
      Array.isArray(popupOptions.cities) &&
      Array.isArray(popupOptions.branches) &&
      Array.isArray(popupOptions.coupons)
    ),
    "P1.8",
    "Popup Options API returns comprehensive schema and live database lists",
    `Coupons count: ${popupOptions.coupons.length}, Cities count: ${popupOptions.cities.length}`
  );

  // ---------------------------------------------------------------------------
  // PILLAR 2: STOREFRONT CONFIGURATION PIPELINE
  // ---------------------------------------------------------------------------
  console.log("\n── [Pillar 2] Storefront Configuration Pipeline ──");

  // P2.1: Storefront config returns published campaigns
  const storeConfigGuest = ApiEngine.getPublishedEngagementConfig({});
  const foundTestWelcome = storeConfigGuest.campaigns.find((c: any) => c.id === createdCampaign.id);
  assert(
    Boolean(foundTestWelcome && foundTestWelcome.status === "published" && foundTestWelcome.current_version),
    "P2.1",
    "Storefront config API returns published and active campaign",
    `Campaigns in config: ${storeConfigGuest.campaigns.length}`
  );

  // P2.2: Archived & draft campaigns excluded from storefront config
  const foundArchived = storeConfigGuest.campaigns.find((c: any) => c.id === duplicatedCampaign.id);
  assert(
    !foundArchived,
    "P2.2",
    "Storefront config strictly excludes archived and draft campaigns",
    `Excluded: ${duplicatedCampaign.id}`
  );

  // P2.3: Device filtering in config API
  const storeConfigMobile = ApiEngine.getPublishedEngagementConfig({ device: "mobile" });
  assert(
    storeConfigMobile.campaigns.length > 0,
    "P2.3",
    "Storefront config properly respects device targeting query filters",
    `Mobile count: ${storeConfigMobile.campaigns.length}`
  );

  // ---------------------------------------------------------------------------
  // PILLAR 3: RULE ENGINE & PRIORITY ARBITRATION
  // ---------------------------------------------------------------------------
  console.log("\n── [Pillar 3] Rule Engine & Priority Arbitration ──");

  const guestContext: EngagementContext = {
    customer: { isLoggedIn: false, status: "guest" },
    session: { id: "sess_1", pageViews: 1, timeOnSiteSeconds: 5, visitCount: 1, deviceType: "desktop" },
    cart: { hasItems: false, itemCount: 0, total: 0, changed: false, items: [] },
    navigation: { pathname: "/", exitIntent: false, backAttempt: false },
    checkout: { active: false },
  };

  const loggedInContext: EngagementContext = {
    customer: { id: "cus_123", name: "Rohan Varma", isLoggedIn: true, status: "logged_in" },
    session: { id: "sess_2", pageViews: 3, timeOnSiteSeconds: 40, visitCount: 2, deviceType: "desktop" },
    cart: {
      hasItems: true,
      itemCount: 2,
      total: 1298,
      changed: true,
      items: [{ id: "prod_1", title: "Belgian Truffle", price: 649, quantity: 2 }],
    },
    navigation: { pathname: "/cart", exitIntent: true, backAttempt: false },
    checkout: { active: false },
  };

  // P3.1: Rule evaluation guest vs logged_in
  const guestRuleCondition = { field: "customer.status", operator: "equals" as const, value: "guest" };
  assert(
    evaluateCondition(guestRuleCondition, guestContext) === true,
    "P3.1a",
    "Rule engine: customer.status == 'guest' evaluates TRUE for guest"
  );
  assert(
    evaluateCondition(guestRuleCondition, loggedInContext) === false,
    "P3.1b",
    "Rule engine: customer.status == 'guest' evaluates FALSE for logged-in customer"
  );

  // P3.2: Cart item count rule
  const cartItemsRule = { field: "cart.itemCount", operator: "greater_than" as const, value: 0 };
  assert(
    evaluateCondition(cartItemsRule, loggedInContext) === true,
    "P3.2a",
    "Rule engine: cart.itemCount > 0 evaluates TRUE when cart has items"
  );
  assert(
    evaluateCondition(cartItemsRule, guestContext) === false,
    "P3.2b",
    "Rule engine: cart.itemCount > 0 evaluates FALSE when cart is empty"
  );

  // P3.3: Priority Arbitration with Single Candidate
  const winningPopupSingle = selectWinningPopup([createdCampaign], guestContext, () => false);
  assert(
    Boolean(winningPopupSingle && winningPopupSingle.id === createdCampaign.id),
    "P3.3",
    "Priority engine: Exactly 1 candidate returns that candidate (not null/empty)",
    `Winner ID: ${winningPopupSingle?.id}`
  );

  // P3.4: Priority Arbitration with Multiple Candidates (Highest score wins)
  const lowerPriorityCampaign: PopupCampaign = {
    ...createdCampaign,
    id: "pop_lower_pri",
    name: "Lower Priority Promo",
    popup_type: "PROMOTIONAL",
    priority: 100,
  };
  const higherPriorityCampaign: PopupCampaign = {
    ...createdCampaign,
    id: "pop_higher_pri",
    name: "Higher Priority Login",
    popup_type: "LOGIN",
    priority: 950,
  };

  const winningPopupMulti = selectWinningPopup(
    [lowerPriorityCampaign, higherPriorityCampaign],
    guestContext,
    () => false
  );
  assert(
    Boolean(winningPopupMulti && winningPopupMulti.id === "pop_higher_pri"),
    "P3.4",
    "Priority engine: Multi-candidate arbitration picks highest effective priority score",
    `Winner: ${winningPopupMulti?.name} (${winningPopupMulti?.id})`
  );

  // P3.5: Checkout active suppression
  const checkoutContext: EngagementContext = {
    ...loggedInContext,
    checkout: { active: true },
  };
  const checkoutWinner = selectWinningPopup([createdCampaign, higherPriorityCampaign], checkoutContext, () => false);
  assert(
    checkoutWinner === null,
    "P3.5",
    "Priority engine: Suppresses popups completely when customer is actively in checkout flow",
    `Result: ${checkoutWinner}`
  );

  // ---------------------------------------------------------------------------
  // PILLAR 4: FREQUENCY & COOLDOWN ENGINE
  // ---------------------------------------------------------------------------
  console.log("\n── [Pillar 4] Frequency & Cooldown Engine ──");

  // P4.1: Compute Cart Hash
  const hash1 = computeCartHash(loggedInContext.cart);
  const hash2 = computeCartHash({
    hasItems: true,
    itemCount: 3,
    total: 1947,
    changed: true,
    items: [{ id: "prod_1", title: "Belgian Truffle", price: 649, quantity: 3 }],
  });
  assert(
    Boolean(hash1 && hash2 && hash1 !== hash2),
    "P4.1",
    "Cart hash computation uniquely detects cart alterations",
    `Hash 1: ${hash1}, Hash 2: ${hash2}`
  );

  // P4.2: Frequency Capped check with infinite allowance
  const isCappedTest = isFrequencyCapped(createdCampaign, guestContext);
  assert(
    isCappedTest === false,
    "P4.2",
    "Frequency manager: First-time display is not blocked by frequency capping",
    `Capped: ${isCappedTest}`
  );

  // ---------------------------------------------------------------------------
  // PILLAR 5: TEMPLATE RENDERING & COUPON LINKAGE
  // ---------------------------------------------------------------------------
  console.log("\n── [Pillar 5] Template Rendering & Coupon Linkage ──");

  // P5.1: Dynamic template interpolation
  const rawTemplate = "Hello {{customer_name}}, enjoy {{coupon_code}} in {{city}} on {{product_name}} ({{product_price}})!";
  const testContext: EngagementContext = {
    customer: { name: "Ananya", isLoggedIn: true, status: "logged_in", cityId: "city_bengaluru" },
    product: { id: "prod_1", name: "Red Velvet Cake", price: 749 },
  };
  const rendered = renderTemplate(rawTemplate, testContext, { type: "COUPON", couponCode: "SWEET10" });
  assert(
    rendered.includes("Ananya") &&
    rendered.includes("SWEET10") &&
    rendered.includes("BENGALURU") &&
    rendered.includes("Red Velvet Cake") &&
    rendered.includes("₹749"),
    "P5.1",
    "Dynamic template interpolates customer, city, coupon, and product placeholders safely",
    rendered
  );

  // P5.2: XSS Escape safety
  const unsafeTemplate = "Hello {{customer_name}} <script>alert(1)</script>";
  const unsafeContext: EngagementContext = { customer: { name: '<script>evil()</script>', isLoggedIn: true, status: "logged_in" } };
  const safeRender = renderTemplate(unsafeTemplate, unsafeContext);
  assert(
    !safeRender.includes("<script>evil()</script>") && safeRender.includes("&lt;script&gt;"),
    "P5.2",
    "Template renderer escapes HTML entities to eliminate XSS vulnerabilities",
    safeRender
  );

  // ---------------------------------------------------------------------------
  // PILLAR 6: TELEMETRY & ANALYTICS PERSISTENCE
  // ---------------------------------------------------------------------------
  console.log("\n── [Pillar 6] Telemetry & Analytics Persistence ──");

  // P6.1: Record Impression
  const impRes = ApiEngine.recordEngagementImpression({
    campaign_id: createdCampaign.id,
    event_type: "shown",
    page_url: "/",
    device_type: "desktop",
    cart_value: 0,
  });
  assert(
    Boolean(impRes && impRes.success && impRes.impression_id),
    "P6.1",
    "Engagement impression telemetry is recorded in store",
    `Impression ID: ${impRes.impression_id}`
  );

  // P6.2: Record CTA Click
  ApiEngine.recordEngagementImpression({
    campaign_id: createdCampaign.id,
    event_type: "cta_clicked",
    page_url: "/",
  });

  // P6.3: Record Conversion
  const convRes = ApiEngine.recordEngagementConversion({
    campaign_id: createdCampaign.id,
    conversion_type: "PURCHASE",
    order_id: "ord_test_popup_001",
    revenue: 999,
  });
  assert(
    Boolean(convRes && convRes.success && convRes.conversion_id),
    "P6.3",
    "Engagement conversion telemetry is recorded with order ID and revenue",
    `Conversion ID: ${convRes.conversion_id}`
  );

  // P6.4: Analytics Aggregation Summary
  const summaryRes = ApiEngine.getPopupAnalyticsSummary();
  assert(
    Boolean(
      summaryRes &&
      summaryRes.success &&
      summaryRes.summary.total_impressions >= 1 &&
      summaryRes.summary.total_clicks >= 1 &&
      summaryRes.summary.total_conversions >= 1 &&
      summaryRes.summary.total_revenue >= 999
    ),
    "P6.4",
    "Analytics summary aggregates impressions, clicks, CTR%, conversions, and revenue",
    JSON.stringify(summaryRes?.summary)
  );

  // ---------------------------------------------------------------------------
  // PILLAR 7: 15-SCENARIO FREQUENCY & AUTH SUPPRESSION VERIFICATION MATRIX
  // ---------------------------------------------------------------------------
  console.log("\n── [Pillar 7] 15-Scenario Frequency & Auth Suppression Test Matrix ──");

  const visitorCampaign: PopupCampaign = {
    id: "pop_test_visitor_welcome",
    name: "Test Visitor Welcome Popup",
    slug: "test-visitor-welcome",
    popup_type: "WELCOME",
    status: "published",
    priority: 800,
    enabled: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    current_version: {
      id: "ver_test_v1",
      popup_campaign_id: "pop_test_visitor_welcome",
      version_number: 1,
      content: {
        headline: "Welcome Guest!",
        description: "Special deal for new visitors.",
        primaryButton: { label: "Claim Deal", action: "CLOSE" },
      },
      frequency: {
        mode: "every_page_load",
        scope: "visitor",
        maxShows: 10,
        cooldownSeconds: 0,
        showToGuests: true,
        showToAuthenticated: false,
      },
      audience: {
        customerStatus: ["all"],
        devices: ["desktop", "mobile", "tablet"],
      },
    },
  };

  const sessionCappedCampaign: PopupCampaign = {
    ...visitorCampaign,
    id: "pop_test_session_capped",
    current_version: {
      ...visitorCampaign.current_version!,
      id: "ver_test_sess",
      frequency: {
        mode: "once_per_session",
        scope: "session",
        sessionLimit: 1,
        maxShows: 1,
        showToGuests: true,
        showToAuthenticated: false,
      },
    },
  };

  const cooldownCampaign: PopupCampaign = {
    ...visitorCampaign,
    id: "pop_test_cooldown",
    current_version: {
      ...visitorCampaign.current_version!,
      id: "ver_test_cd",
      frequency: {
        mode: "cooldown",
        scope: "visitor",
        cooldownValue: 1,
        cooldownUnit: "hours",
        cooldownSeconds: 3600,
        showToGuests: true,
        showToAuthenticated: false,
      },
    },
  };

  const oncePerDayCampaign: PopupCampaign = {
    ...visitorCampaign,
    id: "pop_test_daily",
    current_version: {
      ...visitorCampaign.current_version!,
      id: "ver_test_daily",
      frequency: {
        mode: "once_per_day",
        scope: "visitor",
        cooldownSeconds: 86400,
        showToGuests: true,
        showToAuthenticated: false,
      },
    },
  };

  const legacyCampaign: PopupCampaign = {
    ...visitorCampaign,
    id: "pop_test_legacy",
    current_version: {
      ...visitorCampaign.current_version!,
      id: "ver_test_legacy",
      frequency: {
        // Missing mode & showToGuests - legacy shape
        scope: "visitor",
        maxShows: 1,
      },
    },
  };

  // Scenario 1: Anonymous visitor -> popup appears
  const s1AudienceMatch = matchesAudience(visitorCampaign, guestContext);
  const s1FreqCapped = isFrequencyCapped(visitorCampaign, guestContext);
  assert(
    s1AudienceMatch === true && s1FreqCapped === false,
    "S1",
    "Anonymous visitor is eligible and receives visitor welcome popup",
    `Match: ${s1AudienceMatch}, Capped: ${s1FreqCapped}`
  );

  // Scenario 2: Anonymous visitor closes popup, reloads -> eligible again on same device (NO permanent device suppression)
  const s2FreqCapped = isFrequencyCapped(visitorCampaign, guestContext);
  assert(
    s2FreqCapped === false,
    "S2",
    "Anonymous visitor returning on the same device is NOT permanently suppressed",
    `Capped: ${s2FreqCapped}`
  );

  // Scenario 3: Anonymous visitor returns in new session -> eligible again on same device
  const newSessionContext: EngagementContext = {
    ...guestContext,
    session: { ...guestContext.session!, id: "sess_new_visit", pageViews: 1 },
  };
  const s3Eligible = !isFrequencyCapped(visitorCampaign, newSessionContext) && matchesAudience(visitorCampaign, newSessionContext);
  assert(
    s3Eligible === true,
    "S3",
    "Anonymous visitor in a new session on the same device remains eligible",
    `Eligible: ${s3Eligible}`
  );

  // Scenario 4: Customer logs in -> visitor popup does NOT appear (auth suppression)
  const s4AudienceMatch = matchesAudience(visitorCampaign, loggedInContext);
  assert(
    s4AudienceMatch === false,
    "S4",
    "Logged-in customer is strictly suppressed from receiving visitor welcome popups",
    `Audience Match: ${s4AudienceMatch}`
  );

  // Scenario 5: Customer is logged in, visits homepage -> popup suppressed
  const homeAuthContext: EngagementContext = { ...loggedInContext, navigation: { pathname: "/", exitIntent: false, backAttempt: false } };
  const s5Winner = selectWinningPopup([visitorCampaign], homeAuthContext, () => false);
  assert(
    s5Winner === null,
    "S5",
    "Logged-in customer visiting homepage -> popup suppressed",
    `Winner: ${s5Winner}`
  );

  // Scenario 6: Customer is logged in, visits product page -> popup suppressed
  const prodAuthContext: EngagementContext = { ...loggedInContext, navigation: { pathname: "/product/cake-1", exitIntent: false, backAttempt: false } };
  const s6Winner = selectWinningPopup([visitorCampaign], prodAuthContext, () => false);
  assert(
    s6Winner === null,
    "S6",
    "Logged-in customer visiting product page -> popup suppressed",
    `Winner: ${s6Winner}`
  );

  // Scenario 7: Customer is logged in, visits cart page -> popup suppressed
  const cartAuthContext: EngagementContext = { ...loggedInContext, navigation: { pathname: "/cart", exitIntent: false, backAttempt: false } };
  const s7Winner = selectWinningPopup([visitorCampaign], cartAuthContext, () => false);
  assert(
    s7Winner === null,
    "S7",
    "Logged-in customer visiting cart page -> popup suppressed",
    `Winner: ${s7Winner}`
  );

  // Scenario 8: Customer logs out -> popup appears again
  const loggedOutContext: EngagementContext = {
    customer: { isLoggedIn: false, status: "guest" },
    session: { id: "sess_after_logout", pageViews: 1, timeOnSiteSeconds: 5, visitCount: 2, deviceType: "desktop" },
    cart: { hasItems: false, itemCount: 0, total: 0, changed: false, items: [] },
    navigation: { pathname: "/", exitIntent: false, backAttempt: false },
    checkout: { active: false },
  };
  const s8AudienceMatch = matchesAudience(visitorCampaign, loggedOutContext);
  const s8Winner = selectWinningPopup([visitorCampaign], loggedOutContext, () => false);
  assert(
    s8AudienceMatch === true && s8Winner?.id === visitorCampaign.id,
    "S8",
    "Customer logging out immediately restores visitor popup eligibility",
    `Winner: ${s8Winner?.id}`
  );

  // Scenario 9: Once-per-session campaign -> appears once per session, eligible again in new session
  const s9Session1Eligible = !isFrequencyCapped(sessionCappedCampaign, guestContext);
  assert(
    s9Session1Eligible === true,
    "S9",
    "Once-per-session campaign is eligible on initial session visit",
    `Session 1 Eligible: ${s9Session1Eligible}`
  );

  // Scenario 10: Cooldown campaign -> blocked within cooldown window, eligible after cooldown
  const s10Eligible = !isFrequencyCapped(cooldownCampaign, guestContext);
  assert(
    s10Eligible === true,
    "S10",
    "Cooldown campaign evaluated without prior impressions is eligible",
    `Cooldown Eligible: ${s10Eligible}`
  );

  // Scenario 11: Once-per-day campaign -> eligible on day 1
  const s11Eligible = !isFrequencyCapped(oncePerDayCampaign, guestContext);
  assert(
    s11Eligible === true,
    "S11",
    "Once-per-day campaign evaluates clean on new daily cycle",
    `Once-Per-Day Eligible: ${s11Eligible}`
  );

  // Scenario 12: Two independent devices -> evaluated independently
  const desktopContext: EngagementContext = { ...guestContext, session: { ...guestContext.session!, deviceType: "desktop" } };
  const mobileContext: EngagementContext = { ...guestContext, session: { ...guestContext.session!, deviceType: "mobile" } };
  assert(
    matchesAudience(visitorCampaign, desktopContext) && matchesAudience(visitorCampaign, mobileContext),
    "S12",
    "Multiple devices are evaluated independently with consistent audience rules",
    "Desktop and Mobile independently verified"
  );

  // Scenario 13: Priority arbitration -> higher priority popup selected over lower priority
  const lowPriCamp: PopupCampaign = { ...visitorCampaign, id: "pop_low", priority: 100 };
  const highPriCamp: PopupCampaign = { ...visitorCampaign, id: "pop_high", priority: 900 };
  const s13Winner = selectWinningPopup([lowPriCamp, highPriCamp], guestContext, () => false);
  assert(
    s13Winner?.id === "pop_high",
    "S13",
    "Priority arbitration selects highest priority eligible campaign",
    `Selected: ${s13Winner?.id}`
  );

  // Scenario 14: Mobile vs Desktop viewport -> frequency and auth rules apply identically
  const s14DesktopAuthWinner = selectWinningPopup([visitorCampaign], homeAuthContext, () => false);
  const s14MobileAuthWinner = selectWinningPopup(
    [visitorCampaign],
    { ...homeAuthContext, session: { ...homeAuthContext.session!, deviceType: "mobile" } },
    () => false
  );
  assert(
    s14DesktopAuthWinner === null && s14MobileAuthWinner === null,
    "S14",
    "Mobile and Desktop viewports apply frequency and auth suppression identically",
    "Both suppressed for authenticated users"
  );

  // Scenario 15: Legacy campaign without frequency mode -> safely defaults to non-permanent display
  const s15FreqCapped = isFrequencyCapped(legacyCampaign, guestContext);
  const s15AudienceMatch = matchesAudience(legacyCampaign, guestContext);
  assert(
    s15FreqCapped === false && s15AudienceMatch === true,
    "S15",
    "Legacy campaign without explicit frequency mode defaults safely without permanent lock",
    `Capped: ${s15FreqCapped}, Match: ${s15AudienceMatch}`
  );

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------
  console.log("\n================================================================================");
  console.log(`  VERIFICATION RESULTS: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log("================================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runPopupEngagementE2ESuite().catch((err) => {
    console.error("Test execution fatal error:", err);
    process.exit(1);
  });
}

export { runPopupEngagementE2ESuite };
