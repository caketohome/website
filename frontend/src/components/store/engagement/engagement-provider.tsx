"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { SmartLoginModal } from "../auth/smart-login-modal";
import { StorefrontPopupModal } from "./storefront-popup-modal";
import { apiClient } from "@frontend/lib/api-client";
import { PopupCampaign, EngagementContext, DeviceTarget, CustomerStatus } from "@frontend/lib/engagement/types";
import { selectWinningPopup } from "@frontend/lib/engagement/popup-priority-engine";
import { isFrequencyCapped, recordFrequencyDisplay } from "@frontend/lib/engagement/popup-frequency-manager";
import { evaluateCampaignTriggers } from "@frontend/lib/engagement/popup-trigger-engine";
import { hasClientAuthSession } from "@frontend/lib/auth-service";

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
  triggerCampaignCheck: (triggerHint?: string, eventValue?: any) => void;
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
  const [dismissedCampaignIds, setDismissedCampaignIds] = useState<Set<string>>(new Set());

  // Dynamic campaigns fetched from /api/v1/engagement/config
  const [publishedCampaigns, setPublishedCampaigns] = useState<PopupCampaign[]>([]);
  const [configLoaded, setConfigLoaded] = useState(false);

  // Authoritative runtime tracking refs
  const sessionStartTimeRef = useRef<number>(Date.now());
  const lastActivityTimeRef = useRef<number>(Date.now());
  const maxScrollDepthRef = useRef<number>(0);
  const exitIntentRef = useRef<boolean>(false);
  const backAttemptRef = useRef<boolean>(false);
  const lastActivityThrottleRef = useRef<number>(0);

  // Determine authoritative authentication state
  const checkAuthStatus = useCallback((): boolean => {
    if (typeof document === "undefined") return false;
    return hasClientAuthSession();
  }, []);

  // Sync auth state on mount and register live reactive event listeners
  useEffect(() => {
    const updateAuth = () => {
      const auth = checkAuthStatus();

      // If user is logged in, immediately suppress and close any active visitor popups
      if (auth) {
        setActiveCampaign((curr) => {
          if (!curr) return null;
          const ver = curr.current_version || curr.draft_version;
          const showToAuth = ver?.frequency?.showToAuthenticated === true;
          const custStatuses = ver?.audience?.customerStatus || [];
          const allowsAuth = custStatuses.some((s) => s === "logged_in" || s === "member" || s === "returning_customer");
          if (!showToAuth && !allowsAuth) {
            return null; // Close visitor popup immediately on login
          }
          return curr;
        });
      }
    };

    updateAuth();

    // Listen to custom auth changes, storage events, and window focus
    const handleAuthEvent = () => updateAuth();
    const handleStorage = (e: StorageEvent) => {
      if (
        e.key === "_cth_jwt" ||
        e.key === "_cth_role" ||
        e.key === "cth_access_token" ||
        e.key === "_cth_logout_event"
      ) {
        updateAuth();
      }
    };

    window.addEventListener("cth_auth_changed", handleAuthEvent);
    window.addEventListener("storage", handleStorage);
    window.addEventListener("focus", handleAuthEvent);

    return () => {
      window.removeEventListener("cth_auth_changed", handleAuthEvent);
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("focus", handleAuthEvent);
    };
  }, [checkAuthStatus]);

  // Fetch published engagement campaigns safely (fail-open)
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
        }
      } catch {
        // Safe fallback: if config API fails, storefront keeps functioning smoothly
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

  // Gather active runtime context
  const gatherActiveContext = useCallback((): EngagementContext => {
    const deviceType: DeviceTarget =
      typeof window !== "undefined"
        ? window.innerWidth < 768
          ? "mobile"
          : window.innerWidth < 1024
          ? "tablet"
          : "desktop"
        : "desktop";

    const isLoggedIn = typeof document !== "undefined" ? hasClientAuthSession() : false;
    const custStatus: CustomerStatus = isLoggedIn ? "logged_in" : "guest";
    let custName: string | undefined;
    let custId: string | undefined;
    let cityId: string | undefined;
    let branchId: string | undefined;

    if (typeof window !== "undefined") {
      cityId = localStorage.getItem("selected_city_id") || undefined;
      branchId = localStorage.getItem("selected_branch_id") || undefined;

      if (isLoggedIn) {
        try {
          const userStr = localStorage.getItem("cth_user") || localStorage.getItem("_cth_customer");
          if (userStr) {
            const u = JSON.parse(userStr);
            custName = u.name || u.first_name || u.full_name || "Valued Customer";
            custId = u.id;
          }
        } catch {
          // Ignore
        }
      }
    }

    // Cart Context
    let hasItems = false;
    let itemCount = 0;
    let cartTotal = 0;
    let cartItems: any[] = [];
    const cartCategoryIds: string[] = [];
    const cartProductIds: string[] = [];

    if (typeof window !== "undefined") {
      try {
        const cartItemsStr = localStorage.getItem("medusa_cart_items") || localStorage.getItem("_cth_cart_items");
        if (cartItemsStr) {
          const parsed = JSON.parse(cartItemsStr);
          if (Array.isArray(parsed) && parsed.length > 0) {
            hasItems = true;
            itemCount = parsed.reduce((sum: number, item: any) => sum + (Number(item.quantity) || 1), 0);
            cartTotal = parsed.reduce(
              (sum: number, item: any) =>
                sum + (Number(item.price || item.unit_price || 0) * (Number(item.quantity) || 1)),
              0
            );
            cartItems = parsed.map((it: any) => {
              const pId = it.id || it.product_id;
              const catId = it.category_id || it.categoryId || it.category;
              if (pId) cartProductIds.push(pId);
              if (catId) cartCategoryIds.push(catId);
              return {
                id: pId,
                title: it.title || it.name,
                thumbnail: it.thumbnail || it.image,
                price: Number(it.price || it.unit_price || 0),
                quantity: Number(it.quantity || 1),
                categoryId: catId,
              };
            });
          }
        }
      } catch {
        // Ignore
      }
    }

    // Navigation & Time Context
    const pathname = typeof window !== "undefined" ? window.location.pathname : "/";
    const isCheckout = pathname.includes("/checkout");
    const now = Date.now();
    const timeOnSite = Math.floor((now - sessionStartTimeRef.current) / 1000);
    const inactivitySeconds = Math.floor((now - lastActivityTimeRef.current) / 1000);

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
        id: "sess_active",
        pageViews: 1,
        timeOnSiteSeconds: timeOnSite,
        inactivitySeconds,
        visitCount: 1,
        deviceType,
      },
      cart: {
        hasItems,
        itemCount,
        total: cartTotal,
        changed: false,
        categoryIds: Array.from(new Set(cartCategoryIds)),
        productIds: Array.from(new Set(cartProductIds)),
        items: cartItems,
      },
      navigation: {
        pathname,
        exitIntent: exitIntentRef.current,
        backAttempt: backAttemptRef.current,
        maxScrollDepth: maxScrollDepthRef.current,
      },
      checkout: {
        active: isCheckout,
      },
    };
  }, []);

  const isSuppressed = useCallback(
    (key: string): boolean => {
      if (key === "AUTH_MODAL") return false;
      return dismissedCampaignIds.has(key);
    },
    [dismissedCampaignIds]
  );

  const dismissEngagement = useCallback(
    (type?: EngagementPopupType) => {
      if (activeCampaign) {
        const campId = activeCampaign.id;
        apiClient.recordEngagementImpression({
          campaign_id: campId,
          event_type: "dismissed",
          page_url: typeof window !== "undefined" ? window.location.pathname : "/",
        });

        setDismissedCampaignIds((prev) => {
          const next = new Set(prev);
          next.add(campId);
          return next;
        });

        setActiveCampaign(null);
      }

      if (type) {
        setActivePopup((curr) => (curr === type ? null : curr));
        setDismissedCampaignIds((prev) => {
          const next = new Set(prev);
          next.add(type);
          return next;
        });
      } else {
        setActivePopup(null);
      }
    },
    [activeCampaign]
  );

  // Main campaign arbitration trigger
  const triggerCampaignCheck = useCallback(
    (triggerHint?: string, eventValue?: any) => {
      if (activeCampaign || activePopup) return; // Already showing a popup

      try {
        const ctx = gatherActiveContext();
        if (
          ctx.checkout?.active ||
          ctx.navigation?.pathname === "/login" ||
          ctx.navigation?.pathname?.startsWith("/account")
        ) {
          return; // Never interrupt login, account hub or active checkout
        }

        // AUTHORITATIVE AUTHENTICATION RULE:
        // If customer is logged in, suppress visitor popups unless explicitly configured
        const isLoggedIn = Boolean(ctx.customer?.isLoggedIn);

        // Filter eligible campaigns from config
        const eligible = publishedCampaigns.filter((c) => {
          if (!c.enabled || c.status !== "published") {
            return false;
          }

          const version = c.current_version || c.draft_version;
          if (!version) return false;

          // Logged-in suppression check:
          if (isLoggedIn) {
            const freq = version.frequency || {};
            const audience = version.audience || {};
            const explicitlyAllowsAuth =
              freq.showToAuthenticated === true ||
              (Array.isArray(audience.customerStatus) &&
                audience.customerStatus.some(
                  (s) => s === "logged_in" || s === "member" || s === "returning_customer"
                ));

            if (!explicitlyAllowsAuth) {
              return false; // Suppressed for authenticated user
            }
          }

          // Check if dismissed in this immediate view
          if (isSuppressed(c.id)) {
            return false;
          }

          // Frequency check
          if (isFrequencyCapped(c, ctx)) {
            return false;
          }

          // Action-specific guards: do not fire specialized click-only popups on timer
          if (triggerHint === "time_on_page" || triggerHint === "immediate" || triggerHint === "page_load") {
            if (
              c.popup_type === "WISHLIST_AUTH" ||
              (c.popup_type === "LOGIN" &&
                !version.trigger?.timeOnPageSeconds &&
                !version.trigger?.immediate)
            ) {
              return false;
            }
          }

          return evaluateCampaignTriggers(c, ctx, {
            type: triggerHint || "time_on_page",
            value: eventValue,
          });
        });

        const winner = selectWinningPopup(eligible, ctx, isSuppressed);

        if (winner) {
          setActiveCampaign(winner);
          recordFrequencyDisplay(winner.id, ctx);
          apiClient.recordEngagementImpression({
            campaign_id: winner.id,
            version_id: winner.current_version?.id,
            event_type: "shown",
            page_url: typeof window !== "undefined" ? window.location.pathname : "/",
            device_type: ctx.session?.deviceType || "desktop",
            cart_value: ctx.cart?.total || 0,
          });

          // Reset consumed single-shot flags
          exitIntentRef.current = false;
          backAttemptRef.current = false;
        }
      } catch {
        // Fail-open: Never break storefront if an arbitration error occurs
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
          return false;
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
      const ctx = gatherActiveContext();
      if (activeCampaign) {
        apiClient.recordEngagementImpression({
          campaign_id: activeCampaign.id,
          version_id: activeCampaign.current_version?.id,
          event_type: "cta_clicked",
          page_url: typeof window !== "undefined" ? window.location.pathname : "/",
        });

        apiClient.recordEngagementConversion({
          campaign_id: activeCampaign.id,
          conversion_type: action === "APPLY_COUPON" ? "COUPON_APPLIED" : action,
          coupon_code: meta?.couponCode,
          revenue: ctx.cart?.total || 0,
        });
      }

      switch (action) {
        case "APPLY_COUPON":
          if (meta?.couponCode && typeof window !== "undefined") {
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
          if (typeof window !== "undefined") {
            window.location.href = "/cart";
          }
          break;

        case "CHECKOUT":
          dismissEngagement();
          if (typeof window !== "undefined") {
            window.location.href = "/checkout";
          }
          break;

        case "LOGIN":
        case "SIGNUP":
          dismissEngagement();
          openLoginModal();
          break;

        case "VIEW_PRODUCT":
          dismissEngagement();
          if (meta?.productId && typeof window !== "undefined") {
            window.location.href = `/product/${meta.productId}`;
          }
          break;

        case "CUSTOM_URL":
          dismissEngagement();
          if (meta?.targetUrl && typeof window !== "undefined") {
            window.location.href = meta.targetUrl;
          }
          break;

        case "CLOSE":
        default:
          dismissEngagement();
          break;
      }
    },
    [activeCampaign, dismissEngagement, openLoginModal, gatherActiveContext]
  );

  // 1. Immediate / Page Load trigger detector
  useEffect(() => {
    if (!configLoaded || publishedCampaigns.length === 0 || activeCampaign || activePopup) return;
    triggerCampaignCheck("immediate");
  }, [configLoaded, publishedCampaigns, activeCampaign, activePopup, triggerCampaignCheck]);

  // 2. Continuous 1-Second Timer for Time-on-Page & Inactivity Checks
  useEffect(() => {
    if (!configLoaded || publishedCampaigns.length === 0 || activeCampaign || activePopup) return;

    const interval = setInterval(() => {
      triggerCampaignCheck("time_on_page");
    }, 1000);

    return () => clearInterval(interval);
  }, [configLoaded, publishedCampaigns, activeCampaign, activePopup, triggerCampaignCheck]);

  // 3. User Activity Sensor (Resets inactivity counter with throttling)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const resetInactivity = () => {
      const now = Date.now();
      if (now - lastActivityThrottleRef.current > 500) {
        lastActivityThrottleRef.current = now;
        lastActivityTimeRef.current = now;
      }
    };

    window.addEventListener("pointermove", resetInactivity, { passive: true });
    window.addEventListener("keydown", resetInactivity, { passive: true });
    window.addEventListener("click", resetInactivity, { passive: true });
    window.addEventListener("touchstart", resetInactivity, { passive: true });

    return () => {
      window.removeEventListener("pointermove", resetInactivity);
      window.removeEventListener("keydown", resetInactivity);
      window.removeEventListener("click", resetInactivity);
      window.removeEventListener("touchstart", resetInactivity);
    };
  }, []);

  // 4. Desktop Exit Intent Detector
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 10 && !exitIntentRef.current) {
        const isCheckout = window.location.pathname.includes("/checkout");
        if (!isCheckout) {
          exitIntentRef.current = true;
          triggerCampaignCheck("exit_intent");
        }
      }
    };

    window.addEventListener("mouseleave", handleMouseLeave);
    return () => {
      window.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [triggerCampaignCheck]);

  // 5. Scroll Depth Sensor (Clamped 0 to 100%)
  useEffect(() => {
    if (typeof window === "undefined" || !configLoaded || publishedCampaigns.length === 0) return;

    let ticking = false;

    const handleScroll = () => {
      if (activeCampaign || activePopup) return;
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const scrollY = window.scrollY;
          const docHeight = document.documentElement.scrollHeight - window.innerHeight;
          if (docHeight > 0) {
            const scrollPct = Math.min(100, Math.max(0, Math.round((scrollY / docHeight) * 100)));
            if (scrollPct > maxScrollDepthRef.current) {
              maxScrollDepthRef.current = scrollPct;
              triggerCampaignCheck("scroll_depth", scrollPct);
            }
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [configLoaded, publishedCampaigns, activeCampaign, activePopup, triggerCampaignCheck]);

  // 6. Browser Back Navigation Sensor
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handlePopState = () => {
      if (activeCampaign || activePopup) return;
      backAttemptRef.current = true;
      triggerCampaignCheck("back_navigation");
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [activeCampaign, activePopup, triggerCampaignCheck]);

  // 7. Real Cart Update Listener
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleCartEvent = () => {
      triggerCampaignCheck("cart_condition");
    };

    window.addEventListener("cth_cart_updated", handleCartEvent);
    window.addEventListener("storage", (e) => {
      if (e.key === "medusa_cart_items" || e.key === "_cth_cart_items") {
        handleCartEvent();
      }
    });

    return () => {
      window.removeEventListener("cth_cart_updated", handleCartEvent);
    };
  }, [triggerCampaignCheck]);

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
