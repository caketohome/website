/**
 * CakeToHome Popup Engine Complete Functionality End-to-End Test Suite
 * Tests all 11 triggers, ANY/ALL combinators, default immediate fallback,
 * audience qualification, authoritative auth suppression, non-permanent frequency,
 * priority arbitration, and diagnostic AST simulation.
 */

import {
  evaluateCampaignTriggers,
  evaluateCampaignTriggersDetailed,
  evaluateSingleTrigger,
} from "../src/lib/engagement/popup-trigger-engine";
import {
  matchesAudience,
  explainAudienceMatch,
  selectWinningPopup,
  calculateEffectivePriority,
} from "../src/lib/engagement/popup-priority-engine";
import {
  isFrequencyCapped,
  explainFrequencyEligibility,
  resolveCooldownSeconds,
} from "../src/lib/engagement/popup-frequency-manager";
import { PopupCampaign, EngagementContext } from "../src/lib/engagement/types";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    passedCount++;
    console.log(`  ✅ PASS: ${testName}`);
  } else {
    failedCount++;
    console.error(`  ❌ FAIL: ${testName}${detail ? ` (${detail})` : ""}`);
  }
}

function runPopupCompleteEngineTests() {
  console.log("\n=======================================================");
  console.log("🍰 CAKETOHOME POPUP ENGINE COMPLETE VERIFICATION SUITE");
  console.log("=======================================================\n");

  // Helper context generator
  const createBaseContext = (overrides: Partial<EngagementContext> = {}): EngagementContext => ({
    customer: {
      isLoggedIn: false,
      status: "guest",
      name: "Guest Visitor",
      ...overrides.customer,
    },
    session: {
      id: "sess_test_1",
      pageViews: 1,
      timeOnSiteSeconds: 0,
      inactivitySeconds: 0,
      visitCount: 1,
      deviceType: "desktop",
      ...overrides.session,
    },
    cart: {
      hasItems: false,
      itemCount: 0,
      total: 0,
      changed: false,
      items: [],
      ...overrides.cart,
    },
    navigation: {
      pathname: "/",
      exitIntent: false,
      backAttempt: false,
      maxScrollDepth: 0,
      ...overrides.navigation,
    },
    checkout: {
      active: false,
      ...overrides.checkout,
    },
  });

  // =========================================================================
  // TEST GROUP 1: TRIGGER COMBINATORS (ANY vs ALL vs DEFAULT FALLBACK)
  // =========================================================================
  console.log("\n--- GROUP 1: Trigger Combinators (ANY vs ALL vs Default Fallback) ---");

  const anyCampaign: PopupCampaign = {
    id: "pop_any_1",
    name: "ANY Mode Campaign",
    slug: "any-mode",
    popup_type: "WELCOME",
    priority: 500,
    enabled: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    current_version: {
      id: "ver_any_1",
      popup_campaign_id: "pop_any_1",
      version_number: 1,
      created_at: new Date().toISOString(),
      content: { headline: "Welcome" },
      trigger: {
        enabled_triggers: ["time_on_page", "scroll_depth"],
        combinator: "ANY",
        timeOnPageSeconds: 5,
        scrollDepthPercent: 40,
      },
    },
  };

  const allCampaign: PopupCampaign = {
    id: "pop_all_1",
    name: "ALL Mode Campaign",
    slug: "all-mode",
    popup_type: "WELCOME",
    priority: 500,
    enabled: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    current_version: {
      id: "ver_all_1",
      popup_campaign_id: "pop_all_1",
      version_number: 1,
      created_at: new Date().toISOString(),
      content: { headline: "Welcome Multi" },
      trigger: {
        enabled_triggers: ["time_on_page", "scroll_depth"],
        combinator: "ALL",
        timeOnPageSeconds: 5,
        scrollDepthPercent: 40,
      },
    },
  };

  const emptyTriggerCampaign: PopupCampaign = {
    id: "pop_empty_trig",
    name: "Empty Trigger Campaign",
    slug: "empty-trigger",
    popup_type: "WELCOME",
    priority: 500,
    enabled: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    current_version: {
      id: "ver_empty_1",
      popup_campaign_id: "pop_empty_trig",
      version_number: 1,
      created_at: new Date().toISOString(),
      content: { headline: "Default Welcome" },
      trigger: {
        enabled_triggers: [], // Empty triggers should default to immediate
      },
    },
  };

  // 1.1 ANY mode at 0s, 0% scroll -> false
  const ctx0 = createBaseContext();
  assert(!evaluateCampaignTriggers(anyCampaign, ctx0), "ANY mode: 0s, 0% scroll is false");

  // 1.2 ANY mode at 5s, 0% scroll -> true
  const ctxTime5 = createBaseContext({ session: { id: "s1", pageViews: 1, timeOnSiteSeconds: 5, visitCount: 1, deviceType: "desktop" } });
  assert(evaluateCampaignTriggers(anyCampaign, ctxTime5), "ANY mode: 5s time alone satisfies ANY condition");

  // 1.3 ANY mode at 2s, 45% scroll -> true
  const ctxScroll45 = createBaseContext({
    session: { id: "s1", pageViews: 1, timeOnSiteSeconds: 2, visitCount: 1, deviceType: "desktop" },
    navigation: { pathname: "/", exitIntent: false, backAttempt: false, maxScrollDepth: 45 },
  });
  assert(evaluateCampaignTriggers(anyCampaign, ctxScroll45), "ANY mode: 45% scroll alone satisfies ANY condition");

  // 1.4 ALL mode at 5s, 0% scroll -> false (waiting for scroll)
  assert(!evaluateCampaignTriggers(allCampaign, ctxTime5), "ALL mode: 5s time alone is FALSE (waiting for scroll)");

  // 1.5 ALL mode at 2s, 45% scroll -> false (waiting for time)
  assert(!evaluateCampaignTriggers(allCampaign, ctxScroll45), "ALL mode: 45% scroll alone is FALSE (waiting for time)");

  // 1.6 ALL mode at 5s, 45% scroll -> true (both satisfied)
  const ctxTime5Scroll45 = createBaseContext({
    session: { id: "s1", pageViews: 1, timeOnSiteSeconds: 5, visitCount: 1, deviceType: "desktop" },
    navigation: { pathname: "/", exitIntent: false, backAttempt: false, maxScrollDepth: 45 },
  });
  assert(evaluateCampaignTriggers(allCampaign, ctxTime5Scroll45), "ALL mode: 5s time AND 45% scroll satisfies ALL condition");

  // 1.7 Empty triggers -> Defaults to Immediate (true on page load)
  assert(evaluateCampaignTriggers(emptyTriggerCampaign, ctx0), "Empty triggers: Defaults deterministically to Immediate (true)");

  // =========================================================================
  // TEST GROUP 2: ALL 11 INDIVIDUAL TRIGGER PREDICATES
  // =========================================================================
  console.log("\n--- GROUP 2: Verification of All 11 Individual Triggers ---");

  // 2.1 Immediate
  const resImm = evaluateSingleTrigger("immediate", {}, ctx0);
  assert(resImm.satisfied, "Trigger 1: Immediate is satisfied on load");

  // 2.2 Time on Page
  const resTimeUnmet = evaluateSingleTrigger("time_on_page", { timeOnPageSeconds: 5 }, ctx0);
  const resTimeMet = evaluateSingleTrigger("time_on_page", { timeOnPageSeconds: 5 }, ctxTime5);
  assert(!resTimeUnmet.satisfied && resTimeMet.satisfied, "Trigger 2: Time on page threshold evaluated accurately");

  // 2.3 Exit Intent
  const ctxExit = createBaseContext({ navigation: { pathname: "/", exitIntent: true, backAttempt: false, maxScrollDepth: 0 } });
  const resExit = evaluateSingleTrigger("exit_intent", {}, ctxExit);
  assert(resExit.satisfied, "Trigger 3: Exit intent detected when cursor leaves top boundary");

  // 2.4 Back Navigation
  const ctxBack = createBaseContext({ navigation: { pathname: "/", exitIntent: false, backAttempt: true, maxScrollDepth: 0 } });
  const resBack = evaluateSingleTrigger("back_navigation", {}, ctxBack);
  assert(resBack.satisfied, "Trigger 4: Back navigation detected on browser history event");

  // 2.5 Scroll Depth
  const resScrollUnmet = evaluateSingleTrigger("scroll_depth", { scrollDepthPercent: 50 }, ctx0);
  const resScrollMet = evaluateSingleTrigger("scroll_depth", { scrollDepthPercent: 50 }, createBaseContext({
    navigation: { pathname: "/", exitIntent: false, backAttempt: false, maxScrollDepth: 60 },
  }));
  assert(!resScrollUnmet.satisfied && resScrollMet.satisfied, "Trigger 5: Scroll depth evaluated accurately (60% >= 50%)");

  // 2.6 User Inactivity
  const ctxInactive = createBaseContext({ session: { id: "s1", pageViews: 1, timeOnSiteSeconds: 40, inactivitySeconds: 35, visitCount: 1, deviceType: "desktop" } });
  const resInact = evaluateSingleTrigger("inactivity", { inactivitySeconds: 30 }, ctxInactive);
  assert(resInact.satisfied, "Trigger 6: User inactivity threshold satisfied (35s >= 30s)");

  // 2.7 Cart Condition
  const ctxCartQual = createBaseContext({
    cart: { hasItems: true, itemCount: 2, total: 1200, changed: false, items: [{ id: "p1", title: "Cake", price: 1200, quantity: 2 }] },
  });
  const resCart = evaluateSingleTrigger("cart_condition", { cartItemCountMin: 2, cartMinValue: 1000, cartMaxValue: 2000 }, ctxCartQual);
  assert(resCart.satisfied, "Trigger 7: Cart condition satisfied (2 items >= 2, ₹1200 in [1000, 2000])");

  // 2.8 Page Context
  const ctxProductPage = createBaseContext({ navigation: { pathname: "/products/belgian-chocolate-cake", exitIntent: false, backAttempt: false, maxScrollDepth: 0 } });
  const resPage = evaluateSingleTrigger("page_context", { pageContext: ["product"] }, ctxProductPage);
  assert(resPage.satisfied, "Trigger 8: Page context matches /products/ path");

  // 2.9 Login State
  const ctxGuest = createBaseContext({ customer: { isLoggedIn: false, status: "guest" } });
  const resLoginGuest = evaluateSingleTrigger("login_state", { loginState: ["guest"] }, ctxGuest);
  assert(resLoginGuest.satisfied, "Trigger 9: Login state matches guest persona");

  // 2.10 Visitor Type
  const ctxFirstVisit = createBaseContext({ session: { id: "s1", pageViews: 1, timeOnSiteSeconds: 1, visitCount: 1, deviceType: "desktop" } });
  const ctxRepeatVisit = createBaseContext({ session: { id: "s2", pageViews: 5, timeOnSiteSeconds: 20, visitCount: 3, deviceType: "desktop" } });
  const resVisitFirst = evaluateSingleTrigger("visitor_type", { visitorType: ["first_visit"] }, ctxFirstVisit);
  const resVisitRepeat = evaluateSingleTrigger("visitor_type", { visitorType: ["returning"] }, ctxRepeatVisit);
  assert(resVisitFirst.satisfied && resVisitRepeat.satisfied, "Trigger 10: Visitor type matches first_visit and returning");

  // 2.11 Abandoned Cart
  const ctxAbandoned = createBaseContext({
    cart: { hasItems: true, itemCount: 1, total: 699, changed: false },
    checkout: { active: false },
  });
  const resAban = evaluateSingleTrigger("abandoned_cart", {}, ctxAbandoned);
  assert(resAban.satisfied, "Trigger 11: Abandoned cart detected with unpurchased items outside checkout");

  // =========================================================================
  // TEST GROUP 3: AUDIENCE MATCHING & AUTHENTICATED SUPPRESSION
  // =========================================================================
  console.log("\n--- GROUP 3: Audience Qualification & Authoritative Auth Suppression ---");

  const guestWelcomeCampaign: PopupCampaign = {
    id: "pop_guest_welc",
    name: "Guest Welcome",
    slug: "guest-welcome",
    popup_type: "WELCOME",
    priority: 600,
    enabled: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    current_version: {
      id: "ver_gw_1",
      popup_campaign_id: "pop_guest_welc",
      version_number: 1,
      created_at: new Date().toISOString(),
      content: { headline: "Welcome Guest" },
      audience: {
        customerStatus: ["guest"],
        devices: ["desktop", "mobile"],
      },
      frequency: {
        showToGuests: true,
        showToAuthenticated: false,
      },
    },
  };

  const memberRewardCampaign: PopupCampaign = {
    id: "pop_member_vip",
    name: "VIP Member Bonus",
    slug: "vip-bonus",
    popup_type: "MEMBER",
    priority: 500,
    enabled: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    current_version: {
      id: "ver_vip_1",
      popup_campaign_id: "pop_member_vip",
      version_number: 1,
      created_at: new Date().toISOString(),
      content: { headline: "VIP Exclusive" },
      audience: {
        customerStatus: ["logged_in", "member"],
        devices: ["desktop"],
      },
      frequency: {
        showToGuests: false,
        showToAuthenticated: true,
      },
    },
  };

  // 3.1 Guest user on guest campaign -> Allowed
  assert(matchesAudience(guestWelcomeCampaign, ctxGuest), "Audience: Guest visitor qualifies for Guest Welcome campaign");

  // 3.2 Logged-in customer on guest campaign -> Suppressed
  const ctxLoggedIn = createBaseContext({ customer: { isLoggedIn: true, status: "logged_in", name: "Rahul Sharma" } });
  const audExpl = explainAudienceMatch(guestWelcomeCampaign, ctxLoggedIn);
  assert(!matchesAudience(guestWelcomeCampaign, ctxLoggedIn), "Audience: Logged-in customer is SUPPRESSED on Guest Welcome campaign");
  assert(audExpl.reason.includes("Authenticated customer"), `Audience Explanation: Accurate rejection reason ("${audExpl.reason}")`);

  // 3.3 Logged-in customer on Member campaign -> Allowed
  assert(matchesAudience(memberRewardCampaign, ctxLoggedIn), "Audience: Logged-in customer qualifies for VIP Member campaign");

  // 3.4 Device mismatch: Mobile visitor on Desktop-only VIP campaign -> Suppressed
  const ctxMobile = createBaseContext({
    customer: { isLoggedIn: true, status: "logged_in" },
    session: { id: "s3", pageViews: 1, timeOnSiteSeconds: 1, visitCount: 1, deviceType: "mobile" },
  });
  const devExpl = explainAudienceMatch(memberRewardCampaign, ctxMobile);
  assert(!matchesAudience(memberRewardCampaign, ctxMobile), "Audience: Device mismatch suppresses Desktop-only campaign on mobile");
  assert(devExpl.reason.includes("Device mismatch"), `Device Explanation: Accurate mismatch reason ("${devExpl.reason}")`);

  // =========================================================================
  // TEST GROUP 4: FREQUENCY ENGINE & COOLDOWN (NO PERMANENT SUPPRESSION)
  // =========================================================================
  console.log("\n--- GROUP 4: Frequency Engine & Cooldown Calculations ---");

  const everyPageCampaign: PopupCampaign = {
    id: "pop_every_load",
    name: "Every Page Load Campaign",
    slug: "every-load",
    popup_type: "WELCOME",
    priority: 600,
    enabled: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    current_version: {
      id: "ver_ev_1",
      popup_campaign_id: "pop_every_load",
      version_number: 1,
      created_at: new Date().toISOString(),
      content: { headline: "Welcome Every Time" },
      frequency: {
        mode: "every_page_load",
        showToGuests: true,
        showToAuthenticated: false,
      },
    },
  };

  const cooldownCampaign: PopupCampaign = {
    id: "pop_cooldown_test",
    name: "Cooldown Campaign",
    slug: "cooldown-test",
    popup_type: "PROMOTIONAL",
    priority: 300,
    enabled: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    current_version: {
      id: "ver_cd_1",
      popup_campaign_id: "pop_cooldown_test",
      version_number: 1,
      created_at: new Date().toISOString(),
      content: { headline: "Promo Deal" },
      frequency: {
        mode: "cooldown",
        cooldownValue: 2,
        cooldownUnit: "hours",
        showToGuests: true,
        showToAuthenticated: false,
      },
    },
  };

  // 4.1 Cooldown seconds calculation
  const cdSecs = resolveCooldownSeconds(cooldownCampaign.current_version?.frequency);
  assert(cdSecs === 7200, "Frequency: 2 hours resolved correctly to 7200 seconds");

  // 4.2 Every page load campaign is never capped
  assert(!isFrequencyCapped(everyPageCampaign, ctxGuest), "Frequency: Every page load campaign is immediately eligible for guests");
  const freqExpl = explainFrequencyEligibility(everyPageCampaign, ctxGuest);
  assert(freqExpl.eligible, `Frequency Explanation: Mode explanation ("${freqExpl.reason}")`);

  // =========================================================================
  // TEST GROUP 5: PRIORITY ARBITRATION & WINNER SELECTION
  // =========================================================================
  console.log("\n--- GROUP 5: Priority Arbitration & Single Winner Selection ---");

  const cartExitCamp: PopupCampaign = {
    id: "pop_cart_exit",
    name: "Cart Exit Recovery",
    slug: "cart-exit",
    popup_type: "CART_EXIT",
    priority: 800,
    enabled: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    current_version: {
      id: "ver_ce_1",
      popup_campaign_id: "pop_cart_exit",
      version_number: 1,
      created_at: new Date().toISOString(),
      content: { headline: "Wait! Complete Your Cake Order" },
      audience: { customerStatus: ["all"] },
    },
  };

  const promoCamp: PopupCampaign = {
    id: "pop_promo_gen",
    name: "General Promo Banner",
    slug: "promo-banner",
    popup_type: "PROMOTIONAL",
    priority: 100,
    enabled: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    current_version: {
      id: "ver_pr_1",
      popup_campaign_id: "pop_promo_gen",
      version_number: 1,
      created_at: new Date().toISOString(),
      content: { headline: "Weekend Special" },
      audience: { customerStatus: ["all"] },
    },
  };

  const priCartExit = calculateEffectivePriority(cartExitCamp);
  const priPromo = calculateEffectivePriority(promoCamp);
  assert(priCartExit > priPromo, `Priority: CART_EXIT effective score (${priCartExit}) > PROMOTIONAL (${priPromo})`);

  // Candidate pool containing both cart exit and general promo
  const winner = selectWinningPopup([promoCamp, cartExitCamp], ctxCartQual, () => false);
  assert(winner?.id === "pop_cart_exit", `Priority Winner: Higher priority winner selected ("${winner?.name}")`);

  // =========================================================================
  // TEST GROUP 6: DETAILED AST SIMULATOR DIAGNOSTICS
  // =========================================================================
  console.log("\n--- GROUP 6: Diagnostic AST Simulator Output Verification ---");

  const diagResult = evaluateCampaignTriggersDetailed(allCampaign, ctxTime5);
  assert(!diagResult.isTriggered, "AST Simulator: ALL mode correctly marked unfulfilled");
  assert(diagResult.matchedTriggers.includes("time_on_page"), "AST Simulator: Matched trigger listed accurately (time_on_page)");
  assert(diagResult.unfulfilledTriggers.includes("scroll_depth"), "AST Simulator: Unfulfilled trigger listed accurately (scroll_depth)");
  assert(diagResult.reason.includes("Waiting for scroll_depth"), `AST Simulator: Diagnostic reason clear ("${diagResult.reason}")`);

  // Print Summary Matrix
  console.log("\n=======================================================");
  console.log(`🏁 VERIFICATION COMPLETE: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log("=======================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runPopupCompleteEngineTests();
