"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { SmartLoginModal } from "../auth/smart-login-modal";
import { StorefrontPopupModal } from "./storefront-popup-modal";
import { apiClient } from "@frontend/lib/api-client";
import { PopupCampaign, EngagementContext, DeviceTarget, CustomerStatus } from "@frontend/lib/engagement/types";
import { selectWinningPopup } from "@frontend/lib/engagement/popup-priority-engine";
import { isFrequencyCapped, recordFrequencyDisplay } from "@frontend/lib/engagement/popup-frequency-manager";
import { evaluateCampaignTriggers } from "@frontend/lib/engagement/popup-trigger-engine";

export type EngagementPopupType =
  | "AUTH_MODAL"
  | "CHECKOUT_CRITICAL"
  | "CART_RECOVERY"
  | "PRODUCT_RECOVERY"
  | "WELCOME_OFFER"
  | "GENERIC_EXIT";

interface LoginModalOptions {
  title?: string;
  subtitle?: string;
  intentAction?: string;
  redirectUrl?: string;
  onSuccess?: (user: any) => void;
}

interface EngagementContextType {
  activePopup: EngagementPopupType | null;
  activeCampaign: PopupCampaign | null;
  openLoginModal: (options?: LoginModalOptions) => void;
  closeLoginModal: () => void;
  triggerEngagement: (type: EngagementPopupType, data?: any) => boolean;
  dismissEngagement: (type?: EngagementPopupType) => void;
  isSuppressed: (type: string) => boolean;
  triggerCampaignCheck: (triggerHint?: string) => void;
}

const EngagementContextState = createContext<EngagementContextType | null>(null);

const POPUP_PRIORITIES: Record<EngagementPopupType, number> = {
  AUTH_MODAL: 100,
  CHECKOUT_CRITICAL: 90,
  CART_RECOVERY: 80,
  PRODUCT_RECOVERY: 70,
  WELCOME_OFFER: 50,
  GENERIC_EXIT: 30,
};

export function EngagementProvider({ children }: { children: React.ReactNode }) {
  const [activePopup, setActivePopup] = useState<EngagementPopupType | null>(null);
  const [activeCampaign, setActiveCampaign] = useState<PopupCampaign | null>(null);
  const [loginOptions, setLoginOptions] = useState<LoginModalOptions>({});
  const [suppressedPopups, setSuppressedPopups] = useState<Set<string>>(new Set());

  // Dynamic campaigns fetched from /api/v1/engagement/config
  const [publishedCampaigns, setPublishedCampaigns] = useState<PopupCampaign[]>([]);
  const [configLoaded, setConfigLoaded] = useState(false);

  // Active runtime context
  const [contextState, setContextState] = useState<EngagementContext>({
    customer: { isLoggedIn: false, status: "guest" },
    session: { id: "sess_guest", pageViews: 1, timeOnSiteSeconds: 0, visitCount: 1, deviceType: "desktop" },
    cart: { hasItems: false, itemCount: 0, total: 0, changed: false, items: [] },
    navigation: { pathname: "/", exitIntent: false, backAttempt: false },
    checkout: { active: false },
  });

  const sessionStartTimeRef = useRef<number>(Date.now());
  const evaluatedCampaignIdsRef = useRef<Set<string>>(new Set());

  // Load suppression state from sessionStorage on mount
  useEffect(() => {
    console.log("[POPUP DEBUG] provider mounted");
    try {
      const stored = sessionStorage.getItem("_cth_suppressed_popups");
      if (stored) {
        setSuppressedPopups(new Set(JSON.parse(stored)));
      }
    } catch {
      // Ignore storage errors in private browsing
    }
  }, []);

  // Fetch published engagement campaigns safely
  useEffect(() => {
    let cancelled = false;
    const fetchConfig = async () => {
      try {
        const deviceType: DeviceTarget =
          window.innerWidth < 768 ? "mobile" : window.innerWidth < 1024 ? "tablet" : "desktop";
        const cityId = localStorage.getItem("selected_city_id") || undefined;

        const res: any = await apiClient.getStoreEngagementConfig({
          device: deviceType,
          city_id: cityId || "",
        });

        if (!cancelled && res?.campaigns && Array.isArray(res.campaigns)) {
          setPublishedCampaigns(res.campaigns);
          setConfigLoaded(true);
          console.log("[POPUP DEBUG] config loaded");
          console.log(`[POPUP DEBUG] campaign count: ${res.campaigns.length}`);
        }
      } catch (err: any) {
        console.warn("[POPUP DEBUG] config load failed:", err.message);
        // Safe fallback: if config API 500s or fails, storefront keeps functioning
        if (!cancelled) {
          setPublishedCampaigns([]);
          setConfigLoaded(true);
        }
      }
    };

    fetchConfig();
    return () => {
      cancelled = true;
    };
  }, []);

  // Gather active context on client
  const gatherActiveContext = useCallback((): EngagementContext => {
    if (typeof window === "undefined") return contextState;

    const deviceType: DeviceTarget =
      window.innerWidth < 768 ? "mobile" : window.innerWidth < 1024 ? "tablet" : "desktop";

    // 1. Customer
    let isLoggedIn = false;
    let custStatus: CustomerStatus = "guest";
    let custName: string | undefined;
    let custId: string | undefined;
    let cityId = localStorage.getItem("selected_city_id") || undefined;
    let branchId = localStorage.getItem("selected_branch_id") || undefined;

    try {
      const token = localStorage.getItem("cth_access_token") || localStorage.getItem("medusa_access_token");
      const userStr = localStorage.getItem("cth_user") || localStorage.getItem("_cth_customer");
      if (token || userStr) {
        isLoggedIn = true;
        custStatus = "logged_in";
        if (userStr) {
          const u = JSON.parse(userStr);
          custName = u.name || u.first_name || "Valued Customer";
          custId = u.id;
        }
      }
    } catch {
      // Ignore storage errors
    }

    // 2. Cart
    let hasItems = false;
    let itemCount = 0;
    let cartTotal = 0;
    let cartItems: any[] = [];
    try {
      const cartItemsStr = localStorage.getItem("medusa_cart_items") || localStorage.getItem("_cth_cart_items");
      if (cartItemsStr) {
        const parsed = JSON.parse(cartItemsStr);
        if (Array.isArray(parsed) && parsed.length > 0) {
          hasItems = true;
          itemCount = parsed.reduce((sum: number, item: any) => sum + (Number(item.quantity) || 1), 0);
          cartTotal = parsed.reduce(
            (sum: number, item: any) => sum + (Number(item.price || item.unit_price || 0) * (Number(item.quantity) || 1)),
            0
          );
          cartItems = parsed.map((it: any) => ({
            id: it.id || it.product_id,
            title: it.title || it.name,
            thumbnail: it.thumbnail || it.image,
            price: Number(it.price || it.unit_price || 0),
            quantity: Number(it.quantity || 1),
          }));
        }
      }
    } catch {
      // Ignore
    }

    // 3. Navigation & Checkout
    const pathname = window.location.pathname;
    const isCheckout = pathname.includes("/checkout");

    const timeOnSite = Math.floor((Date.now() - sessionStartTimeRef.current) / 1000);

    return {
      customer: {
        id: custId,
        name: custName,
        isLoggedIn,
        status: custStatus,
        cityId,
        branchId,
      },
      session: {
        id: "sess_guest",
        pageViews: 1,
        timeOnSiteSeconds: timeOnSite,
        visitCount: 1,
        deviceType,
      },
      cart: {
        hasItems,
        itemCount,
        total: cartTotal,
        changed: false,
        items: cartItems,
      },
      navigation: {
        pathname,
        exitIntent: false,
        backAttempt: false,
      },
      checkout: {
        active: isCheckout,
      },
    };
  }, [contextState]);

  const isSuppressed = useCallback(
    (key: string): boolean => {
      if (key === "AUTH_MODAL") return false;
      return suppressedPopups.has(key);
    },
    [suppressedPopups]
  );

  const dismissEngagement = useCallback((type?: EngagementPopupType) => {
    if (activeCampaign) {
      const campId = activeCampaign.id;
      apiClient.recordEngagementImpression({
        campaign_id: campId,
        event_type: "dismissed",
        page_url: window.location.pathname,
      });
      setSuppressedPopups((prev) => {
        const next = new Set(prev);
        next.add(campId);
        try {
          sessionStorage.setItem("_cth_suppressed_popups", JSON.stringify(Array.from(next)));
        } catch {
          // Ignore
        }
        return next;
      });
      setActiveCampaign(null);
    }

    if (type) {
      setActivePopup((curr) => (curr === type ? null : curr));
      setSuppressedPopups((prev) => {
        const next = new Set(prev);
        next.add(type);
        try {
          sessionStorage.setItem("_cth_suppressed_popups", JSON.stringify(Array.from(next)));
        } catch {
          // Ignore
        }
        return next;
      });
    } else {
      setActivePopup(null);
    }
  }, [activeCampaign]);

  // Main campaign arbitration trigger
  const triggerCampaignCheck = useCallback(
    (triggerHint?: string) => {
      if (activeCampaign || activePopup) return; // Already showing a popup

      console.log(`[POPUP DEBUG] trigger result: ${triggerHint || "manual"}`);

      const ctx = gatherActiveContext();
      if (ctx.checkout?.active) return; // Do not interrupt checkout

      // Filter eligible campaigns from config using evaluateCampaignTriggers
      const eligible = publishedCampaigns.filter((c) => {
        if (!c.enabled || c.status !== "published" || !c.current_version) {
          return false;
        }
        if (isSuppressed(c.id)) {
          return false;
        }
        const freqCapped = isFrequencyCapped(c, ctx);
        console.log(`[POPUP DEBUG] frequency result: ${c.name} -> ${freqCapped ? "capped" : "passed"}`);
        if (freqCapped) {
          return false;
        }

        // Action-specific guards: do not fire specialized click-only popups on timer
        if (triggerHint === "time_on_page" || triggerHint === "immediate" || triggerHint === "page_load") {
          if (c.popup_type === "WISHLIST_AUTH" || (c.popup_type === "LOGIN" && !c.current_version.trigger?.timeOnPageSeconds && !c.current_version.trigger?.immediate)) {
            return false;
          }
        }

        return evaluateCampaignTriggers(c, ctx, { type: triggerHint || "time_on_page" });
      });

      console.log(`[POPUP DEBUG] eligible campaigns: ${eligible.length}`);

      const winner = selectWinningPopup(eligible, ctx, isSuppressed);
      console.log(`[POPUP DEBUG] winner: ${winner ? winner.name : "none"}`);

      if (winner && !evaluatedCampaignIdsRef.current.has(winner.id)) {
        evaluatedCampaignIdsRef.current.add(winner.id);
        console.log(`[POPUP DEBUG] rendering popup: ${winner.name}`);
        setActiveCampaign(winner);
        recordFrequencyDisplay(winner.id, ctx);
        apiClient.recordEngagementImpression({
          campaign_id: winner.id,
          version_id: winner.current_version?.id,
          event_type: "shown",
          page_url: window.location.pathname,
          device_type: ctx.session?.deviceType || "desktop",
          cart_value: ctx.cart?.total || 0,
        });
      }
    },
    [activeCampaign, activePopup, publishedCampaigns, isSuppressed, gatherActiveContext]
  );

  const triggerEngagement = useCallback(
    (type: EngagementPopupType, _data?: any): boolean => {
      if (isSuppressed(type)) return false;

      // Priority arbitration
      if (activePopup) {
        const currentPriority = POPUP_PRIORITIES[activePopup] || 0;
        const newPriority = POPUP_PRIORITIES[type] || 0;
        if (newPriority <= currentPriority) {
          return false; // Lower or equal priority popup rejected
        }
      }

      setActivePopup(type);
      return true;
    },
    [activePopup, isSuppressed]
  );

  const openLoginModal = useCallback((options: LoginModalOptions = {}) => {
    setLoginOptions(options);
    setActivePopup("AUTH_MODAL");
  }, []);

  const closeLoginModal = useCallback(() => {
    if (activePopup === "AUTH_MODAL") {
      setActivePopup(null);
    }
  }, [activePopup]);

  // CTA Action dispatcher
  const handleCtaAction = useCallback(
    (action: string, meta?: any) => {
      if (activeCampaign) {
        apiClient.recordEngagementImpression({
          campaign_id: activeCampaign.id,
          version_id: activeCampaign.current_version?.id,
          event_type: "cta_clicked",
          page_url: window.location.pathname,
        });

        apiClient.recordEngagementConversion({
          campaign_id: activeCampaign.id,
          conversion_type: action === "APPLY_COUPON" ? "COUPON_APPLIED" : action,
          coupon_code: meta?.couponCode,
          revenue: contextState.cart?.total || 0,
        });
      }

      switch (action) {
        case "APPLY_COUPON":
          if (meta?.couponCode) {
            try {
              localStorage.setItem("applied_discount_code", meta.couponCode);
              localStorage.setItem("_cth_pending_coupon", meta.couponCode);
            } catch {
              // Ignore
            }
          }
          dismissEngagement();
          break;

        case "OPEN_CART":
          dismissEngagement();
          window.location.href = "/cart";
          break;

        case "CHECKOUT":
          dismissEngagement();
          window.location.href = "/checkout";
          break;

        case "LOGIN":
        case "SIGNUP":
          dismissEngagement();
          openLoginModal();
          break;

        case "VIEW_PRODUCT":
          dismissEngagement();
          if (meta?.productId) {
            window.location.href = `/product/${meta.productId}`;
          }
          break;

        case "CUSTOM_URL":
          dismissEngagement();
          if (meta?.targetUrl) {
            window.location.href = meta.targetUrl;
          }
          break;

        case "CLOSE":
        default:
          dismissEngagement();
          break;
      }
    },
    [activeCampaign, contextState.cart?.total, dismissEngagement, openLoginModal]
  );

  // Immediate / Page Load trigger detector
  useEffect(() => {
    if (!configLoaded || publishedCampaigns.length === 0 || activeCampaign || activePopup) return;
    triggerCampaignCheck("immediate");
  }, [configLoaded, publishedCampaigns, activeCampaign, activePopup, triggerCampaignCheck]);

  // Time-on-page timer detector
  useEffect(() => {
    if (!configLoaded || publishedCampaigns.length === 0 || activeCampaign || activePopup) return;

    const interval = setInterval(() => {
      triggerCampaignCheck("time_on_page");
    }, 1000);

    return () => clearInterval(interval);
  }, [configLoaded, publishedCampaigns, activeCampaign, activePopup, triggerCampaignCheck]);

  // Global Exit Intent Detector
  useEffect(() => {
    if (typeof window === "undefined") return;

    let hasTriggeredExit = false;

    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 10 && !hasTriggeredExit) {
        const isCheckout = window.location.pathname.includes("/checkout");
        if (!isCheckout) {
          hasTriggeredExit = true;
          triggerCampaignCheck("exit_intent");
        }
      }
    };

    window.addEventListener("mouseleave", handleMouseLeave);
    return () => {
      window.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [triggerCampaignCheck]);

  // Scroll depth detector
  useEffect(() => {
    if (typeof window === "undefined" || !configLoaded || publishedCampaigns.length === 0) return;

    let scrollTriggered = false;

    const handleScroll = () => {
      if (scrollTriggered || activeCampaign || activePopup) return;
      const scrollY = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight > 0) {
        const scrollPct = (scrollY / docHeight) * 100;
        if (scrollPct >= 40) {
          scrollTriggered = true;
          triggerCampaignCheck("scroll_depth");
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [configLoaded, publishedCampaigns, activeCampaign, activePopup, triggerCampaignCheck]);

  const activeContext = gatherActiveContext();

  return (
    <EngagementContextState.Provider
      value={{
        activePopup,
        activeCampaign,
        openLoginModal,
        closeLoginModal,
        triggerEngagement,
        dismissEngagement,
        isSuppressed,
        triggerCampaignCheck,
      }}
    >
      {children}

      {/* Dynamic Storefront Popup Modal */}
      {activeCampaign && (
        <StorefrontPopupModal
          campaign={activeCampaign}
          context={activeContext}
          onClose={() => dismissEngagement()}
          onCtaAction={handleCtaAction}
        />
      )}

      {/* Centralized Smart Login Modal */}
      <SmartLoginModal
        isOpen={activePopup === "AUTH_MODAL"}
        onClose={closeLoginModal}
        title={loginOptions.title}
        subtitle={loginOptions.subtitle}
        intentAction={loginOptions.intentAction}
        redirectUrl={loginOptions.redirectUrl}
        onSuccess={loginOptions.onSuccess}
      />
    </EngagementContextState.Provider>
  );
}

export function useEngagement() {
  const context = useContext(EngagementContextState);
  if (!context) {
    return {
      activePopup: null,
      activeCampaign: null,
      openLoginModal: () => {},
      closeLoginModal: () => {},
      triggerEngagement: () => false,
      dismissEngagement: () => {},
      isSuppressed: () => true,
      triggerCampaignCheck: () => {},
    };
  }
  return context;
}
