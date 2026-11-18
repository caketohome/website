"use client";

import { useState, useEffect } from "react";
import {
  Heading,
  Text,
  Badge,
  Button,
  Input,
  Label,
} from "@medusajs/ui";
import {
  X,
  Sparkles,
  Save,
  Send,
  Image as ImageIcon,
  Tag,
  Clock,
  Users,
  Eye,
  Sliders,
  Calendar,
  Layers,
  Smartphone,
  Monitor,
  Check,
  Percent,
  AlertCircle,
  HelpCircle,
  Phone,
  Zap,
  CheckCircle2,
  RefreshCw,
  ShoppingBag,
  MapPin,
  Play,
  ArrowRight,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { MediaSelectorModal, MediaSelection } from "./media-selector-modal";
import { apiClient } from "@frontend/lib/api-client";
import {
  PopupCampaign,
  PopupType,
  CustomerStatus,
  DeviceTarget,
  DesktopLayout,
  MobileLayout,
  TabletLayout,
  PhonePurposeAction,
  EngagementContext,
} from "@frontend/lib/engagement/types";
import {
  evaluateCampaignTriggersDetailed,
} from "@frontend/lib/engagement/popup-trigger-engine";
import {
  explainAudienceMatch,
} from "@frontend/lib/engagement/popup-priority-engine";
import {
  explainFrequencyEligibility,
} from "@frontend/lib/engagement/popup-frequency-manager";

interface PopupEditorDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  campaign: PopupCampaign | null;
  onSaved: (campaign: PopupCampaign) => void;
  options: any;
}

export function PopupEditorDrawer({
  isOpen,
  onClose,
  campaign,
  onSaved,
  options,
}: PopupEditorDrawerProps) {
  const [activeTab, setActiveTab] = useState<
    "general" | "trigger" | "audience" | "content" | "phone" | "media" | "offer" | "design" | "frequency"
  >("general");

  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [mediaModalOpen, setMediaModalOpen] = useState(false);
  const [mediaTarget, setMediaTarget] = useState<"desktop" | "mobile">("desktop");
  const [showLivePreview, setShowLivePreview] = useState(true);

  // Form states initialized from campaign or defaults
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [popupType, setPopupType] = useState<PopupType>("WELCOME");
  const [priority, setPriority] = useState(100);
  const [enabled, setEnabled] = useState(true);

  // Trigger Configuration
  const [enabledTriggers, setEnabledTriggers] = useState<string[]>(["time_on_page"]);
  const [triggerCombinator, setTriggerCombinator] = useState<"ANY" | "ALL">("ANY");
  const [immediateTrigger, setImmediateTrigger] = useState(false);
  const [timeOnPageSeconds, setTimeOnPageSeconds] = useState<number | "">(3);
  const [exitIntent, setExitIntent] = useState(false);
  const [backNavigation, setBackNavigation] = useState(false);
  const [scrollDepthPercent, setScrollDepthPercent] = useState<number | "">("");
  const [inactivitySeconds, setInactivitySeconds] = useState<number | "">("");
  const [cartItemCountMin, setCartItemCountMin] = useState<number | "">("");
  const [cartMinValue, setCartMinValue] = useState<number | "">("");
  const [cartMaxValue, setCartMaxValue] = useState<number | "">("");
  const [pageContext, setPageContext] = useState<string[]>(["all"]);
  const [triggerLoginState, setTriggerLoginState] = useState<CustomerStatus[]>(["all"]);
  const [visitorTypes, setVisitorTypes] = useState<string[]>(["all"]);
  const [abandonedCartTrigger, setAbandonedCartTrigger] = useState(false);

  // Audience
  const [customerStatuses, setCustomerStatuses] = useState<CustomerStatus[]>(["all"]);
  const [devices, setDevices] = useState<DeviceTarget[]>(["desktop", "tablet", "mobile"]);
  const [selectedCityIds, setSelectedCityIds] = useState<string[]>([]);
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [selectedOccasionIds, setSelectedOccasionIds] = useState<string[]>([]);
  const [minCartValue, setMinCartValue] = useState<number | "">("");
  const [maxCartValue, setMaxCartValue] = useState<number | "">("");

  // Content
  const [templateId, setTemplateId] = useState<any>("LOGIN_OFFER");
  const [eyebrow, setEyebrow] = useState("SPECIAL OFFER");
  const [headline, setHeadline] = useState("Welcome to CakeToHome, {{customer_name}}");
  const [contentDesc, setContentDesc] = useState("Enjoy ₹150 OFF your first handcrafted cake order with complimentary delivery.");
  const [badge, setBadge] = useState("₹150 OFF");
  const [primaryLabel, setPrimaryLabel] = useState("Continue with Mobile Number");
  const [primaryAction, setPrimaryAction] = useState<any>("LOGIN_WITH_MOBILE");
  const [secondaryLabel, setSecondaryLabel] = useState("Continue Browsing");
  const [secondaryAction, setSecondaryAction] = useState<any>("CLOSE");
  const [legalText, setLegalText] = useState("Valid on online orders only.");

  // Direct Phone Login Configuration
  const [phoneEnabled, setPhoneEnabled] = useState(true);
  const [phoneMandatory, setPhoneMandatory] = useState(false);
  const [phoneAction, setPhoneAction] = useState<PhonePurposeAction>("LOGIN_COUPON");
  const [phonePlaceholder, setPhonePlaceholder] = useState("Enter your mobile number");
  const [phoneButtonLabel, setPhoneButtonLabel] = useState("Continue with Mobile Number");
  const [phoneGuestButtonLabel, setPhoneGuestButtonLabel] = useState("Continue as Guest");
  const [phoneDisclaimerText, setPhoneDisclaimerText] = useState("We'll use your number to securely sign you in.");
  const [phoneRedirectUrl, setPhoneRedirectUrl] = useState("");

  // Media
  const [mediaSource, setMediaSource] = useState<any>("MEDIA_LIBRARY");
  const [imageUrl, setImageUrl] = useState("/images/belgian-truffle.jpg");
  const [mobileImageUrl, setMobileImageUrl] = useState("");
  const [mediaId, setMediaId] = useState("");
  const [mediaFilename, setMediaFilename] = useState("belgian-truffle.jpg");
  const [mediaDimensions, setMediaDimensions] = useState("800 × 800 px");
  const [mediaSize, setMediaSize] = useState("142 KB");
  const [mediaMime, setMediaMime] = useState("image/jpeg");
  const [mobileMediaId, setMobileMediaId] = useState("");
  const [mobileMediaFilename, setMobileMediaFilename] = useState("");
  const [aspectRatio, setAspectRatio] = useState<any>("square");
  const [mediaPosition, setMediaPosition] = useState<any>("top");

  // Offer
  const [offerType, setOfferType] = useState<any>("COUPON");
  const [selectedCouponId, setSelectedCouponId] = useState("");
  const [couponCode, setCouponCode] = useState("SWEET10");
  const [autoApplyCoupon, setAutoApplyCoupon] = useState(true);

  // Design
  const [desktopLayout, setDesktopLayout] = useState<DesktopLayout>("CENTER_MODAL");
  const [tabletLayout, setTabletLayout] = useState<TabletLayout>("CENTER_MODAL");
  const [mobileLayout, setMobileLayout] = useState<MobileLayout>("BOTTOM_SHEET");
  const [modalWidth, setModalWidth] = useState(520);
  const [borderRadius, setBorderRadius] = useState(20);
  const [backdropOpacity, setBackdropOpacity] = useState(0.6);
  const [animation, setAnimation] = useState<any>("SLIDE_UP");
  const [accentColor, setAccentColor] = useState("#1D2F5D");

  // Schedule & Frequency
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [frequencyMode, setFrequencyMode] = useState<any>("every_page_load");
  const [frequencyScope, setFrequencyScope] = useState<any>("session");
  const [maxShows, setMaxShows] = useState(1);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [cooldownValue, setCooldownValue] = useState<number>(1);
  const [cooldownUnit, setCooldownUnit] = useState<"seconds" | "minutes" | "hours" | "days">("hours");
  const [showToGuests, setShowToGuests] = useState(true);
  const [showToAuthenticated, setShowToAuthenticated] = useState(false);
  const [cartChangeRequired, setCartChangeRequired] = useState(false);
  const [loginStateChangeRequired, setLoginStateChangeRequired] = useState(false);

  // Live Preview Simulator States
  const [simDevice, setSimDevice] = useState<DeviceTarget>("desktop");
  const [simPersona, setSimPersona] = useState<CustomerStatus>("guest");
  const [simVisitor, setSimVisitor] = useState<"first_visit" | "returning">("first_visit");
  const [simCart, setSimCart] = useState<"empty" | "has_items">("empty");
  const [simTime, setSimTime] = useState<number>(3);
  const [simScroll, setSimScroll] = useState<number>(0);
  const [simExitIntent, setSimExitIntent] = useState<boolean>(false);
  const [simBackNav, setSimBackNav] = useState<boolean>(false);
  const [simInactivity, setSimInactivity] = useState<number>(0);
  const [simPage, setSimPage] = useState<string>("home");
  const [simManualFired, setSimManualFired] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      if (campaign) {
        // Load existing campaign
        const v = campaign.draft_version || campaign.current_version;
        setName(campaign.name || "");
        setSlug(campaign.slug || "");
        setDescription(campaign.description || "");
        setPopupType(campaign.popup_type || "WELCOME");
        setPriority(Number(campaign.priority) || 100);
        setEnabled(campaign.enabled !== false);
        setStartAt(campaign.start_at || "");
        setEndAt(campaign.end_at || "");

        if (v) {
          // Trigger
          const tr = v.trigger || {};
          setEnabledTriggers(tr.enabled_triggers || (tr.exitIntent ? ["exit_intent"] : ["time_on_page"]));
          setTriggerCombinator(tr.combinator || "ANY");
          setImmediateTrigger(Boolean(tr.immediate));
          setExitIntent(Boolean(tr.exitIntent));
          setTimeOnPageSeconds(tr.timeOnPageSeconds ?? "");
          setScrollDepthPercent(tr.scrollDepthPercent ?? "");
          setInactivitySeconds(tr.inactivitySeconds ?? "");
          setBackNavigation(Boolean(tr.backNavigation));
          setCartItemCountMin(tr.cartItemCountMin ?? "");
          setCartMinValue(tr.cartMinValue ?? "");
          setCartMaxValue(tr.cartMaxValue ?? "");
          setPageContext(tr.pageContext || ["all"]);
          setTriggerLoginState(tr.loginState || ["all"]);
          setVisitorTypes(tr.visitorType || ["all"]);
          setAbandonedCartTrigger(Boolean(tr.abandonedCart));

          // Audience
          setCustomerStatuses(v.audience?.customerStatus || ["all"]);
          setDevices(v.audience?.devices || ["desktop", "tablet", "mobile"]);
          setSelectedCityIds(v.audience?.cityIds || []);
          setSelectedBranchIds(v.audience?.branchIds || []);
          setSelectedCategoryIds(v.audience?.categoryIds || []);
          setSelectedProductIds(v.audience?.productIds || []);
          setSelectedOccasionIds(v.audience?.occasionIds || []);
          setMinCartValue(v.audience?.minCartValue ?? "");
          setMaxCartValue(v.audience?.maxCartValue ?? "");

          // Content
          setTemplateId(v.content?.templateId || "LOGIN_OFFER");
          setEyebrow(v.content?.eyebrow || "");
          setHeadline(v.content?.headline || "");
          setContentDesc(v.content?.description || "");
          setBadge(v.content?.badge || "");
          setPrimaryLabel(v.content?.primaryButton?.label || "Continue with Mobile Number");
          setPrimaryAction(v.content?.primaryButton?.action || "LOGIN_WITH_MOBILE");
          setSecondaryLabel(v.content?.secondaryButton?.label || "Continue Browsing");
          setSecondaryAction(v.content?.secondaryButton?.action || "CLOSE");
          setLegalText(v.content?.legalText || "");

          // Phone Config
          if (v.content?.phoneConfig) {
            setPhoneEnabled(Boolean(v.content.phoneConfig.enabled));
            setPhoneMandatory(Boolean(v.content.phoneConfig.mandatory));
            setPhoneAction(v.content.phoneConfig.action || "LOGIN_COUPON");
            setPhonePlaceholder(v.content.phoneConfig.placeholder || "Enter your mobile number");
            setPhoneButtonLabel(v.content.phoneConfig.buttonLabel || "Continue with Mobile Number");
            setPhoneGuestButtonLabel(v.content.phoneConfig.guestButtonLabel || "Continue as Guest");
            setPhoneDisclaimerText(v.content.phoneConfig.disclaimerText || "We'll use your number to securely sign you in.");
            setPhoneRedirectUrl(v.content.phoneConfig.redirectUrl || "");
          }

          // Media
          setMediaSource(v.media?.source || "MEDIA_LIBRARY");
          setImageUrl(v.media?.imageUrl || "");
          setMobileImageUrl(v.media?.mobileImageUrl || "");
          setMediaId(v.media?.mediaId || "");
          setAspectRatio(v.media?.aspectRatio || "square");
          setMediaPosition(v.media?.position || "top");

          // Offer
          setOfferType(v.offer?.type || "COUPON");
          setSelectedCouponId(v.offer?.couponId || "");
          setCouponCode(v.offer?.couponCode || v.content?.primaryButton?.couponCode || "");
          setAutoApplyCoupon(v.offer?.autoApply !== false);

          // Design
          setDesktopLayout(v.design?.desktopLayout || "CENTER_MODAL");
          setTabletLayout(v.design?.tabletLayout || "CENTER_MODAL");
          setMobileLayout(v.design?.mobileLayout || "BOTTOM_SHEET");
          setModalWidth(v.design?.width || 520);
          setBorderRadius(v.design?.borderRadius || 20);
          setBackdropOpacity(v.design?.backdropOpacity ?? 0.6);
          setAnimation(v.design?.animation || "SLIDE_UP");
          setAccentColor(v.design?.accentColor || "#1D2F5D");

          // Frequency
          setFrequencyMode(v.frequency?.mode || (v.frequency?.scope === "session" ? "once_per_session" : "every_page_load"));
          setFrequencyScope(v.frequency?.scope || "session");
          setMaxShows(v.frequency?.maxShows ?? 1);
          setCooldownSeconds(v.frequency?.cooldownSeconds ?? 0);
          setCooldownValue(v.frequency?.cooldownValue ?? 1);
          setCooldownUnit(v.frequency?.cooldownUnit || "hours");
          setShowToGuests(v.frequency?.showToGuests !== false);
          setShowToAuthenticated(Boolean(v.frequency?.showToAuthenticated));
          setCartChangeRequired(Boolean(v.frequency?.cartChangeRequired));
          setLoginStateChangeRequired(Boolean(v.frequency?.loginStateChangeRequired));
        }
      } else {
        // Default Template: Login Offer
        applyTemplatePreset("LOGIN_OFFER");
      }
    } else {
      document.body.style.overflow = "unset";
      setErrorMsg(null);
      setSuccessMsg(null);
    }
  }, [isOpen, campaign]);

  const applyTemplatePreset = (preset: "LOGIN_OFFER" | "WELCOME_SIMPLE" | "ABANDONED_CART" | "EXIT_COUPON") => {
    setTemplateId(preset);
    if (preset === "LOGIN_OFFER") {
      setName("Welcome ₹150 OFF Special");
      setSlug(`welcome-special-${Date.now().toString().slice(-4)}`);
      setDescription("Captures visitor mobile number and provides instant ₹150 discount coupon.");
      setPopupType("LOGIN");
      setPriority(850);
      setEnabled(true);
      setEnabledTriggers(["time_on_page"]);
      setTriggerCombinator("ANY");
      setTimeOnPageSeconds(3);
      setImmediateTrigger(false);
      setCustomerStatuses(["guest"]);
      setEyebrow("WELCOME TO CAKETOHOME");
      setHeadline("Get ₹150 OFF Your First Cake Order");
      setContentDesc("Enter your mobile number to instantly unlock your ₹150 discount voucher.");
      setBadge("₹150 OFF");
      setPrimaryLabel("Continue with Mobile Number");
      setPrimaryAction("LOGIN_WITH_MOBILE");
      setSecondaryLabel("Continue Browsing");
      setSecondaryAction("CLOSE");
      setPhoneEnabled(true);
      setPhoneMandatory(false);
      setPhoneAction("LOGIN_COUPON");
      setPhonePlaceholder("Enter your mobile number");
      setPhoneButtonLabel("Continue with Mobile Number");
      setPhoneGuestButtonLabel("Continue as Guest");
      setPhoneDisclaimerText("We'll use your number to securely sign you in and apply your discount.");
      setOfferType("COUPON");
      setCouponCode("SWEET150");
    } else if (preset === "WELCOME_SIMPLE") {
      setName("Universal Welcome Banner");
      setSlug(`welcome-simple-${Date.now().toString().slice(-4)}`);
      setDescription("Automatic welcome banner displayed after 3 seconds on site.");
      setPopupType("WELCOME");
      setPriority(800);
      setEnabled(true);
      setEnabledTriggers(["time_on_page"]);
      setTriggerCombinator("ANY");
      setTimeOnPageSeconds(3);
      setImmediateTrigger(false);
      setCustomerStatuses(["all"]);
      setEyebrow("FRESH FROM THE OVEN");
      setHeadline("Handcrafted Artisanal Cakes Delivered in 2 Hours");
      setContentDesc("Explore Kerala's finest cakes, baked fresh with 100% pure vegetarian ingredients.");
      setBadge("FRESH TODAY");
      setPrimaryLabel("Explore Cakes");
      setPrimaryAction("VIEW_CATEGORY");
      setSecondaryLabel("Dismiss");
      setSecondaryAction("CLOSE");
      setPhoneEnabled(false);
    } else if (preset === "ABANDONED_CART") {
      setName("Cart Recovery Special");
      setSlug(`cart-recovery-${Date.now().toString().slice(-4)}`);
      setDescription("Re-engages customers with items in cart before they abandon.");
      setPopupType("ABANDONED_CART");
      setPriority(900);
      setEnabled(true);
      setEnabledTriggers(["cart_condition", "exit_intent"]);
      setTriggerCombinator("ANY");
      setCartItemCountMin(1);
      setExitIntent(true);
      setEyebrow("YOUR CAKE IS WAITING!");
      setHeadline("Complete Your Cake Order & Take 10% OFF");
      setContentDesc("Don't let your celebration wait! Finish your order now with coupon SWEET10.");
      setBadge("10% OFF");
      setPrimaryLabel("Checkout Now");
      setPrimaryAction("CHECKOUT");
      setSecondaryLabel("Continue Shopping");
      setSecondaryAction("CLOSE");
      setOfferType("COUPON");
      setCouponCode("SWEET10");
    } else if (preset === "EXIT_COUPON") {
      setName("Exit Intent Special Offer");
      setSlug(`exit-intent-${Date.now().toString().slice(-4)}`);
      setDescription("Triggers when visitor moves mouse towards browser close bar.");
      setPopupType("PROMOTIONAL");
      setPriority(750);
      setEnabled(true);
      setEnabledTriggers(["exit_intent"]);
      setTriggerCombinator("ANY");
      setExitIntent(true);
      setEyebrow("WAIT! BEFORE YOU GO");
      setHeadline("Take An Exclusive ₹100 Discount Voucher");
      setContentDesc("Use code TASTY100 at checkout for ₹100 OFF any celebration cake.");
      setBadge("₹100 OFF");
      setPrimaryLabel("Claim ₹100 Off");
      setPrimaryAction("APPLY_COUPON");
      setSecondaryLabel("No Thanks");
      setSecondaryAction("CLOSE");
      setOfferType("COUPON");
      setCouponCode("TASTY100");
    }
  };

  const toggleTriggerMode = (mode: string) => {
    setEnabledTriggers((prev) => {
      if (prev.includes(mode)) {
        return prev.filter((m) => m !== mode);
      } else {
        return [...prev, mode];
      }
    });
  };

  const buildPayload = (targetStatus: "draft" | "published") => {
    return {
      name: name.trim() || "Untitled Campaign",
      slug: slug.trim() || `popup-${Date.now()}`,
      description: description.trim(),
      popup_type: popupType,
      priority: Number(priority) || 100,
      enabled,
      status: targetStatus,
      start_at: startAt || null,
      end_at: endAt || null,
      timezone: "Asia/Kolkata",
      content: {
        templateId,
        eyebrow: eyebrow.trim(),
        headline: headline.trim() || "Special Offer",
        description: contentDesc.trim(),
        badge: badge.trim(),
        phoneConfig: {
          enabled: phoneEnabled,
          mandatory: phoneMandatory,
          action: phoneAction,
          placeholder: phonePlaceholder.trim(),
          buttonLabel: phoneButtonLabel.trim(),
          guestButtonLabel: phoneGuestButtonLabel.trim(),
          disclaimerText: phoneDisclaimerText.trim(),
          redirectUrl: phoneRedirectUrl.trim() || undefined,
          couponCode: couponCode.trim() || undefined,
        },
        primaryButton: {
          label: primaryLabel.trim() || "Claim Offer",
          action: primaryAction,
          couponCode: couponCode.trim() || undefined,
          targetUrl: phoneRedirectUrl.trim() || undefined,
        },
        secondaryButton: {
          label: secondaryLabel.trim() || "Close",
          action: secondaryAction,
        },
        legalText: legalText.trim(),
      },
      trigger: {
        enabled_triggers: enabledTriggers,
        combinator: triggerCombinator,
        immediate: immediateTrigger || enabledTriggers.includes("immediate"),
        exitIntent: exitIntent || enabledTriggers.includes("exit_intent"),
        backNavigation: backNavigation || enabledTriggers.includes("back_navigation"),
        timeOnPageSeconds: timeOnPageSeconds !== "" ? Number(timeOnPageSeconds) : 3,
        scrollDepthPercent: scrollDepthPercent !== "" ? Number(scrollDepthPercent) : undefined,
        inactivitySeconds: inactivitySeconds !== "" ? Number(inactivitySeconds) : undefined,
        cartItemCountMin: cartItemCountMin !== "" ? Number(cartItemCountMin) : undefined,
        cartMinValue: cartMinValue !== "" ? Number(cartMinValue) : undefined,
        cartMaxValue: cartMaxValue !== "" ? Number(cartMaxValue) : undefined,
        pageContext,
        loginState: triggerLoginState,
        visitorType: visitorTypes as any,
        abandonedCart: abandonedCartTrigger || enabledTriggers.includes("abandoned_cart"),
      },
      audience: {
        customerStatus: customerStatuses,
        devices,
        cityIds: selectedCityIds,
        branchIds: selectedBranchIds,
        categoryIds: selectedCategoryIds,
        productIds: selectedProductIds,
        occasionIds: selectedOccasionIds,
        minCartValue: minCartValue !== "" ? Number(minCartValue) : undefined,
        maxCartValue: maxCartValue !== "" ? Number(maxCartValue) : undefined,
      },
      media: {
        source: mediaSource,
        imageUrl: imageUrl.trim() || null,
        mobileImageUrl: mobileImageUrl.trim() || null,
        mediaId: mediaId || null,
        aspectRatio,
        position: mediaPosition,
      },
      offer: {
        type: offerType,
        couponId: selectedCouponId || null,
        couponCode: couponCode.trim() || null,
        autoApply: autoApplyCoupon,
        showCouponCode: true,
      },
      design: {
        desktopLayout,
        tabletLayout,
        mobileLayout,
        width: Number(modalWidth) || 520,
        borderRadius: Number(borderRadius) || 20,
        backdropOpacity: Number(backdropOpacity) || 0.6,
        animation,
        accentColor,
      },
      frequency: {
        mode: frequencyMode,
        scope: frequencyScope,
        maxShows: Number(maxShows) || 1,
        cooldownSeconds:
          frequencyMode === "once_per_day"
            ? 86400
            : frequencyMode === "cooldown" || frequencyMode === "custom"
            ? cooldownUnit === "minutes"
              ? Number(cooldownValue) * 60
              : cooldownUnit === "hours"
              ? Number(cooldownValue) * 3600
              : Number(cooldownValue) * 86400
            : 0,
        cooldownValue: Number(cooldownValue) || 1,
        cooldownUnit,
        sessionLimit: frequencyMode === "once_per_session" ? Number(maxShows) || 1 : undefined,
        cartChangeRequired,
        loginStateChangeRequired,
        showToGuests,
        showToAuthenticated,
      },
      schedule: {
        startAt: startAt || null,
        endAt: endAt || null,
        timezone: "Asia/Kolkata",
      },
      rules: [],
    };
  };

  const buildCurrentCampaignConfig = (): PopupCampaign => {
    const payload = buildPayload("published");
    return {
      id: campaign?.id || "pop_sim_preview",
      name: payload.name,
      slug: payload.slug,
      description: payload.description,
      popup_type: payload.popup_type,
      status: "published",
      priority: payload.priority,
      enabled: payload.enabled,
      start_at: payload.start_at,
      end_at: payload.end_at,
      timezone: payload.timezone,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      current_version: {
        id: "ver_sim_preview",
        popup_campaign_id: campaign?.id || "pop_sim_preview",
        version_number: 1,
        created_at: new Date().toISOString(),
        published_at: new Date().toISOString(),
        content: payload.content,
        trigger: payload.trigger,
        audience: payload.audience,
        frequency: payload.frequency,
        schedule: payload.schedule,
        offer: payload.offer,
        rules: payload.rules,
        media: payload.media,
        design: payload.design,
      },
    };
  };

  const buildSimulatorContext = (): EngagementContext => {
    const isLoggedIn = simPersona === "logged_in";
    const hasCartItems = simCart === "has_items";
    return {
      customer: {
        id: isLoggedIn ? "cust_sim_1" : undefined,
        name: isLoggedIn ? "Ananya" : undefined,
        isLoggedIn,
        status: isLoggedIn ? "logged_in" : "guest",
        cityId: selectedCityIds[0] || undefined,
        branchId: selectedBranchIds[0] || undefined,
      },
      session: {
        id: "sess_sim_1",
        pageViews: 1,
        timeOnSiteSeconds: Number(simTime) || 0,
        inactivitySeconds: Number(simInactivity) || 0,
        visitCount: simVisitor === "first_visit" ? 1 : 3,
        deviceType: simDevice,
      },
      cart: {
        hasItems: hasCartItems,
        itemCount: hasCartItems ? 2 : 0,
        total: hasCartItems ? 1200 : 0,
        changed: false,
        categoryIds: selectedCategoryIds,
        productIds: selectedProductIds,
        items: hasCartItems
          ? [
              { id: "prod_1", title: "Belgian Truffle Cake", price: 699, quantity: 1, categoryId: "cat_cakes" },
              { id: "prod_2", title: "Red Velvet Cake", price: 501, quantity: 1, categoryId: "cat_cakes" },
            ]
          : [],
      },
      navigation: {
        pathname: simPage === "home" ? "/" : `/${simPage}`,
        exitIntent: simExitIntent,
        backAttempt: simBackNav,
        maxScrollDepth: Number(simScroll) || 0,
      },
      checkout: {
        active: simPage === "checkout",
      },
    };
  };

  const handleSaveDraft = async () => {
    if (!name.trim()) {
      setErrorMsg("Campaign Name is required.");
      return;
    }
    if (!headline.trim()) {
      setErrorMsg("Headline text is required.");
      return;
    }
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const payload = buildPayload("draft");
      let res: any;
      if (campaign && campaign.id) {
        res = await apiClient.updateAdminPopup(campaign.id, payload);
      } else {
        res = await apiClient.createAdminPopup(payload);
      }

      const savedCampaign = res?.campaign || res;
      if (savedCampaign) {
        setSuccessMsg("Draft saved successfully.");
        onSaved(savedCampaign);
        setTimeout(() => onClose(), 600);
      } else {
        throw new Error(res?.error || "Failed to save draft popup");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save draft.");
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!name.trim()) {
      setErrorMsg("Campaign Name is required.");
      return;
    }
    if (!headline.trim()) {
      setErrorMsg("Headline text is required.");
      return;
    }
    setPublishing(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const payload = buildPayload("published");
      let savedCamp: any;
      if (campaign && campaign.id) {
        const updateRes: any = await apiClient.updateAdminPopup(campaign.id, payload);
        savedCamp = updateRes?.campaign || updateRes;
        const pubRes: any = await apiClient.publishAdminPopup(campaign.id, payload);
        savedCamp = pubRes?.campaign || savedCamp;
      } else {
        const createRes: any = await apiClient.createAdminPopup(payload);
        savedCamp = createRes?.campaign || createRes;
        if (savedCamp?.id) {
          const pubRes: any = await apiClient.publishAdminPopup(savedCamp.id, payload);
          savedCamp = pubRes?.campaign || savedCamp;
        }
      }

      if (savedCamp) {
        setSuccessMsg("Campaign published successfully.");
        onSaved(savedCamp);
        setTimeout(() => onClose(), 600);
      } else {
        throw new Error("Failed to publish popup");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to publish popup.");
    } finally {
      setPublishing(false);
    }
  };

  const handleMediaSelect = (sel: MediaSelection) => {
    if (mediaTarget === "mobile") {
      setMobileImageUrl(sel.url);
      setMobileMediaId(sel.media_id || "");
      setMobileMediaFilename(sel.name || sel.url.split("/").pop() || "mobile_artwork.jpg");
    } else {
      setImageUrl(sel.url);
      setMediaId(sel.media_id || "");
      setMediaFilename(sel.name || sel.url.split("/").pop() || "cake_banner.jpg");
      if (sel.width && sel.height) {
        setMediaDimensions(`${sel.width} × ${sel.height} px`);
      } else {
        setMediaDimensions("800 × 800 px");
      }
      setMediaMime("image/jpeg");
      setMediaSize("120 KB");
    }
    setMediaSource("MEDIA_LIBRARY");
    setMediaModalOpen(false);
  };

  const handleCouponSelect = (couponId: string) => {
    setSelectedCouponId(couponId);
    const found = (options.coupons || []).find((c: any) => c.id === couponId || c.value === couponId);
    if (found) {
      setCouponCode(found.code || "");
      if (!headline || headline === "Welcome to CakeToHome") {
        setHeadline(`Get ${found.discount || "Special Discount"} on Your Cake`);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs transition-opacity animate-fade-in">
      <div className="relative flex flex-col w-full max-w-5xl bg-ui-bg-base border-l border-ui-border-base h-full shadow-2xl overflow-hidden animate-slide-in-right">
        {/* Top Header */}
        <div className="p-4 sm:p-5 border-b border-ui-border-base bg-ui-bg-subtle flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-brand-navy/10 dark:bg-brand-gold/15 text-brand-navy dark:text-brand-gold flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Heading level="h2" className="text-base sm:text-lg font-bold truncate">
                  {campaign ? `Edit: ${name || "Popup"}` : "Create New Popup Campaign"}
                </Heading>
                <Badge color={campaign?.status === "published" ? "green" : "grey"} className="text-[10px]">
                  {campaign?.status || "DRAFT"}
                </Badge>
              </div>
              <Text className="text-xs text-ui-fg-subtle truncate">
                Configure triggers, direct mobile login, dynamic offers, and multi-device targeting.
              </Text>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="secondary"
              size="small"
              onClick={handleSaveDraft}
              disabled={saving || publishing}
              className="flex items-center gap-1 text-xs"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? "Saving..." : "Save Draft"}
            </Button>
            <Button
              variant="primary"
              size="small"
              onClick={handlePublish}
              disabled={saving || publishing}
              className="bg-brand-navy hover:bg-brand-deep text-white flex items-center gap-1 text-xs shadow-sm"
            >
              <Send className="w-3.5 h-3.5" />
              {publishing ? "Publishing..." : "Publish"}
            </Button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-ui-fg-subtle hover:text-ui-fg-base hover:bg-ui-bg-base transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Feedback Alert Banners */}
        {errorMsg && (
          <div className="mx-4 mt-3 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 animate-fade-in">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="mx-4 mt-3 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex gap-1 px-4 pt-2 border-b border-ui-border-base bg-ui-bg-subtle overflow-x-auto shrink-0">
          {[
            { id: "general", label: "General", icon: Sliders },
            { id: "trigger", label: "Trigger Mode", icon: Zap },
            { id: "phone", label: "Phone / Login", icon: Phone },
            { id: "audience", label: "Audience", icon: Users },
            { id: "content", label: "Content", icon: Sparkles },
            { id: "media", label: "Image / Media", icon: ImageIcon },
            { id: "offer", label: "Coupon / Offer", icon: Tag },
            { id: "design", label: "Design", icon: Layers },
            { id: "frequency", label: "Frequency", icon: Calendar },
          ].map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-lg transition-colors whitespace-nowrap ${
                  active
                    ? "bg-ui-bg-base text-brand-navy dark:text-brand-gold font-bold border-t-2 border-t-brand-navy dark:border-t-brand-gold border-x border-ui-border-base shadow-xs"
                    : "text-ui-fg-subtle hover:text-ui-fg-base hover:bg-ui-bg-base/60"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Content Body Grid */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Form Tabs */}
          <div className={`${showLivePreview ? "lg:col-span-7" : "lg:col-span-12"} flex flex-col gap-5`}>
            {/* GENERAL TAB */}
            {activeTab === "general" && (
              <div className="flex flex-col gap-4">
                {/* Template Preset Selector */}
                <div className="p-3 bg-brand-navy/5 dark:bg-slate-800/60 rounded-xl border border-brand-navy/15 dark:border-slate-700 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-brand-navy dark:text-brand-gold flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-brand-gold" />
                      Quick Campaign Presets
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { id: "LOGIN_OFFER", label: "Login + Offer", desc: "Phone OTP + Coupon" },
                      { id: "WELCOME_SIMPLE", label: "Simple Welcome", desc: "3s Auto Display" },
                      { id: "ABANDONED_CART", label: "Cart Recovery", desc: "Cart Items + SWEET10" },
                      { id: "EXIT_COUPON", label: "Exit Offer", desc: "Exit Intent Voucher" },
                    ].map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => applyTemplatePreset(p.id as any)}
                        className={`p-2 rounded-lg text-left border transition-all ${
                          templateId === p.id
                            ? "bg-white dark:bg-neutral-800 border-brand-navy dark:border-brand-gold shadow-xs font-semibold text-brand-navy dark:text-brand-gold"
                            : "bg-white/60 dark:bg-neutral-900 border-neutral-200 text-neutral-600 hover:border-neutral-300"
                        }`}
                      >
                        <span className="text-xs block font-bold">{p.label}</span>
                        <span className="text-[10px] text-neutral-400 block truncate">{p.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-semibold text-ui-fg-base mb-1 block">Campaign Name *</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. 15% First Order Welcome Special"
                    className="text-sm"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-semibold text-ui-fg-base mb-1 block">Slug</Label>
                    <Input
                      value={slug}
                      onChange={(e) => setSlug(e.target.value)}
                      placeholder="e.g. welcome-15-off"
                      className="text-xs font-mono"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-ui-fg-base mb-1 block">Popup Type *</Label>
                    <select
                      value={popupType}
                      onChange={(e) => setPopupType(e.target.value as any)}
                      className="w-full h-8 px-2.5 text-xs rounded-md bg-ui-bg-field border border-ui-border-base focus:border-ui-border-interactive focus:outline-none"
                    >
                      {(options.popup_types || [
                        { value: "WELCOME", label: "First-Time Visitor Welcome" },
                        { value: "LOGIN", label: "Login & Identity Popup" },
                        { value: "CART_EXIT", label: "Cart Exit & Recovery Popup" },
                        { value: "PRODUCT_EXIT", label: "Product-Specific Exit Intent" },
                        { value: "WISHLIST_AUTH", label: "Wishlist Authentication Guard" },
                        { value: "RETURNING", label: "Returning Customer Welcome Back" },
                        { value: "PROMOTIONAL", label: "Promotional Banner / Campaign" },
                        { value: "MEMBER", label: "VIP & Member Rewards" },
                        { value: "ABANDONED_CART", label: "Abandoned Cart Recovery" },
                      ]).map((opt: any) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-semibold text-ui-fg-base mb-1 block">Priority Rating (1 - 1000)</Label>
                    <Input
                      type="number"
                      value={priority}
                      onChange={(e) => setPriority(Number(e.target.value))}
                      placeholder="100"
                      className="text-sm"
                    />
                    <span className="text-[10px] text-ui-fg-muted mt-1 block">
                      Higher score wins when multiple popups qualify.
                    </span>
                  </div>
                  <div className="flex flex-col justify-center gap-2 pt-2">
                    <Label className="text-xs font-semibold text-ui-fg-base">Status & Visibility</Label>
                    <label className="flex items-center gap-2 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={enabled}
                        onChange={(e) => setEnabled(e.target.checked)}
                        className="rounded border-ui-border-base text-rose-600 focus:ring-rose-500"
                      />
                      <span>Campaign Active & Enabled</span>
                    </label>
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-semibold text-ui-fg-base mb-1 block">Internal Description</Label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                    placeholder="Brief description of the campaign objective..."
                    className="w-full p-2.5 text-xs rounded-md bg-ui-bg-field border border-ui-border-base focus:border-ui-border-interactive focus:outline-none"
                  />
                </div>
              </div>
            )}

            {/* TRIGGER TAB */}
            {activeTab === "trigger" && (
              <div className="flex flex-col gap-5">
                {/* Trigger Mode Header & Combinator */}
                <div className="p-3.5 bg-ui-bg-subtle rounded-xl border border-ui-border-base flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Text className="text-xs font-bold text-ui-fg-base">Trigger Mode Configuration</Text>
                      <Text className="text-[11px] text-ui-fg-subtle">
                        Select one or multiple conditions to activate this popup. Exit Intent is NOT mandatory.
                      </Text>
                    </div>
                    <div className="flex items-center gap-2 bg-white dark:bg-neutral-800 p-1 rounded-lg border border-neutral-200">
                      <button
                        type="button"
                        onClick={() => setTriggerCombinator("ANY")}
                        className={`px-2.5 py-1 text-xs font-bold rounded ${
                          triggerCombinator === "ANY"
                            ? "bg-rose-600 text-white"
                            : "text-neutral-500 hover:text-neutral-900"
                        }`}
                      >
                        ANY (OR)
                      </button>
                      <button
                        type="button"
                        onClick={() => setTriggerCombinator("ALL")}
                        className={`px-2.5 py-1 text-xs font-bold rounded ${
                          triggerCombinator === "ALL"
                            ? "bg-rose-600 text-white"
                            : "text-neutral-500 hover:text-neutral-900"
                        }`}
                      >
                        ALL (AND)
                      </button>
                    </div>
                  </div>

                  {/* Trigger Checkbox Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
                    {[
                      { id: "immediate", label: "Immediate (Page Load)" },
                      { id: "time_on_page", label: "Time on Page (Timer)" },
                      { id: "exit_intent", label: "Exit Intent" },
                      { id: "back_navigation", label: "Back Navigation" },
                      { id: "scroll_depth", label: "Scroll Depth (%)" },
                      { id: "inactivity", label: "User Inactivity" },
                      { id: "cart_condition", label: "Cart Condition" },
                      { id: "page_context", label: "Page Context" },
                      { id: "login_state", label: "Login State" },
                      { id: "visitor_type", label: "First / Returning Visit" },
                      { id: "abandoned_cart", label: "Abandoned Cart" },
                    ].map((trig) => {
                      const checked = enabledTriggers.includes(trig.id);
                      return (
                        <label
                          key={trig.id}
                          className={`p-2.5 rounded-lg border text-xs flex items-center gap-2 cursor-pointer transition-all ${
                            checked
                              ? "bg-rose-50 dark:bg-rose-950/40 border-rose-500 text-rose-900 dark:text-rose-200 font-semibold"
                              : "bg-white dark:bg-neutral-800 border-neutral-200 text-neutral-600 hover:border-neutral-300"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleTriggerMode(trig.id)}
                            className="rounded border-neutral-300 text-rose-600 focus:ring-rose-500"
                          />
                          <span className="truncate">{trig.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Fine-grained Trigger Settings */}
                <div className="flex flex-col gap-4">
                  {enabledTriggers.includes("time_on_page") && (
                    <div className="p-3 bg-ui-bg-subtle rounded-xl border border-ui-border-base flex flex-col gap-2">
                      <Label className="text-xs font-semibold text-ui-fg-base block">Time on Page Delay (Seconds)</Label>
                      <Input
                        type="number"
                        value={timeOnPageSeconds}
                        onChange={(e) => setTimeOnPageSeconds(e.target.value === "" ? "" : Number(e.target.value))}
                        placeholder="e.g. 3"
                        className="text-sm"
                      />
                      <span className="text-[10px] text-ui-fg-muted">
                        Popup appears automatically after visitor browses for this many seconds. (0 for immediate).
                      </span>
                    </div>
                  )}

                  {enabledTriggers.includes("scroll_depth") && (
                    <div className="p-3 bg-ui-bg-subtle rounded-xl border border-ui-border-base flex flex-col gap-2">
                      <Label className="text-xs font-semibold text-ui-fg-base block">Scroll Depth Threshold (%)</Label>
                      <Input
                        type="number"
                        value={scrollDepthPercent}
                        onChange={(e) => setScrollDepthPercent(e.target.value === "" ? "" : Number(e.target.value))}
                        placeholder="e.g. 40"
                        className="text-sm"
                      />
                      <span className="text-[10px] text-ui-fg-muted">
                        Triggers when user scrolls past this percentage of total page height.
                      </span>
                    </div>
                  )}

                  {enabledTriggers.includes("inactivity") && (
                    <div className="p-3 bg-ui-bg-subtle rounded-xl border border-ui-border-base flex flex-col gap-2">
                      <Label className="text-xs font-semibold text-ui-fg-base block">User Inactivity Delay (Seconds)</Label>
                      <Input
                        type="number"
                        value={inactivitySeconds}
                        onChange={(e) => setInactivitySeconds(e.target.value === "" ? "" : Number(e.target.value))}
                        placeholder="e.g. 30"
                        className="text-sm"
                      />
                      <span className="text-[10px] text-ui-fg-muted">
                        Triggers after mouse and keyboard idle duration exceeds this threshold.
                      </span>
                    </div>
                  )}

                  {enabledTriggers.includes("cart_condition") && (
                    <div className="p-3 bg-ui-bg-subtle rounded-xl border border-ui-border-base grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <Label className="text-xs font-semibold text-ui-fg-base mb-1 block">Min Cart Items</Label>
                        <Input
                          type="number"
                          value={cartItemCountMin}
                          onChange={(e) => setCartItemCountMin(e.target.value === "" ? "" : Number(e.target.value))}
                          placeholder="e.g. 1"
                          className="text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-semibold text-ui-fg-base mb-1 block">Min Cart Value (₹)</Label>
                        <Input
                          type="number"
                          value={cartMinValue}
                          onChange={(e) => setCartMinValue(e.target.value === "" ? "" : Number(e.target.value))}
                          placeholder="e.g. 500"
                          className="text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-semibold text-ui-fg-base mb-1 block">Max Cart Value (₹)</Label>
                        <Input
                          type="number"
                          value={cartMaxValue}
                          onChange={(e) => setCartMaxValue(e.target.value === "" ? "" : Number(e.target.value))}
                          placeholder="e.g. 5000"
                          className="text-sm"
                        />
                      </div>
                    </div>
                  )}

                  {enabledTriggers.includes("page_context") && (
                    <div className="p-3 bg-ui-bg-subtle rounded-xl border border-ui-border-base flex flex-col gap-2">
                      <Label className="text-xs font-semibold text-ui-fg-base block">Target Page Contexts</Label>
                      <div className="flex flex-wrap gap-2">
                        {["all", "home", "product", "category", "cart", "checkout"].map((p) => {
                          const active = pageContext.includes(p);
                          return (
                            <button
                              key={p}
                              type="button"
                              onClick={() => {
                                if (p === "all") setPageContext(["all"]);
                                else {
                                  const filtered = pageContext.filter((x) => x !== "all");
                                  if (filtered.includes(p)) {
                                    const n = filtered.filter((x) => x !== p);
                                    setPageContext(n.length === 0 ? ["all"] : n);
                                  } else {
                                    setPageContext([...filtered, p]);
                                  }
                                }
                              }}
                              className={`px-3 py-1.5 text-xs rounded-lg border font-medium uppercase ${
                                active
                                  ? "bg-rose-600 text-white border-rose-600"
                                  : "bg-white border-neutral-200 text-neutral-600 hover:border-neutral-300"
                              }`}
                            >
                              {p}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* PHONE & SMART LOGIN TAB */}
            {activeTab === "phone" && (
              <div className="flex flex-col gap-4">
                <div className="p-3.5 bg-rose-50/70 dark:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-900/50 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Text className="text-xs font-bold text-rose-950 dark:text-rose-100 flex items-center gap-1.5">
                        <Phone className="w-4 h-4 text-rose-600" />
                        Direct Mobile Number Collection & Smart Login
                      </Text>
                      <Text className="text-[11px] text-rose-800/80 dark:text-rose-300">
                        Collect Indian 10-digit mobile numbers with instant OTP verification directly in the popup.
                      </Text>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold">
                      <input
                        type="checkbox"
                        checked={phoneEnabled}
                        onChange={(e) => setPhoneEnabled(e.target.checked)}
                        className="rounded border-rose-300 text-rose-600 focus:ring-rose-500"
                      />
                      <span>Enable Mobile Number Input</span>
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-semibold text-ui-fg-base mb-1 block">Phone Action Purpose</Label>
                    <select
                      value={phoneAction}
                      onChange={(e) => setPhoneAction(e.target.value as any)}
                      className="w-full h-8 px-2.5 text-xs rounded-md bg-ui-bg-field border border-ui-border-base focus:border-ui-border-interactive focus:outline-none"
                    >
                      <option value="LOGIN_COUPON">LOGIN + AUTO-APPLY COUPON</option>
                      <option value="LOGIN_SIGNUP">LOGIN / SIGN UP (Smart Auth)</option>
                      <option value="LOGIN_ONLY">LOGIN ONLY</option>
                      <option value="CAPTURE_LEAD">CAPTURE LEAD / VIP OPT-IN</option>
                      <option value="CART_RECOVERY">SAVE FOR CART RECOVERY</option>
                      <option value="CHECKOUT">CONTINUE TO CHECKOUT</option>
                      <option value="WHATSAPP_OPTIN">WHATSAPP OPT-IN</option>
                      <option value="LOGIN_REDIRECT">LOGIN + REDIRECT TO URL</option>
                    </select>
                  </div>

                  <div className="flex flex-col justify-center gap-2 pt-2">
                    <Label className="text-xs font-semibold text-ui-fg-base">Mandatory Enforcement</Label>
                    <label className="flex items-center gap-2 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={phoneMandatory}
                        onChange={(e) => setPhoneMandatory(e.target.checked)}
                        className="rounded border-ui-border-base text-rose-600 focus:ring-rose-500"
                      />
                      <span>Number is strictly required (no guest close)</span>
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-semibold text-ui-fg-base mb-1 block">Phone Input Placeholder</Label>
                    <Input
                      value={phonePlaceholder}
                      onChange={(e) => setPhonePlaceholder(e.target.value)}
                      placeholder="e.g. Enter your mobile number"
                      className="text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-ui-fg-base mb-1 block">Primary Button Label</Label>
                    <Input
                      value={phoneButtonLabel}
                      onChange={(e) => setPhoneButtonLabel(e.target.value)}
                      placeholder="e.g. Continue with Mobile Number"
                      className="text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-semibold text-ui-fg-base mb-1 block">Guest Dismissal CTA Label</Label>
                    <Input
                      value={phoneGuestButtonLabel}
                      onChange={(e) => setPhoneGuestButtonLabel(e.target.value)}
                      placeholder="e.g. Continue as Guest"
                      className="text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-ui-fg-base mb-1 block">Redirect URL (Optional)</Label>
                    <Input
                      value={phoneRedirectUrl}
                      onChange={(e) => setPhoneRedirectUrl(e.target.value)}
                      placeholder="e.g. /cart or /categories/bestsellers"
                      className="text-xs font-mono"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-semibold text-ui-fg-base mb-1 block">Security Disclaimer / Small Text</Label>
                  <Input
                    value={phoneDisclaimerText}
                    onChange={(e) => setPhoneDisclaimerText(e.target.value)}
                    placeholder="e.g. We'll use your number to securely sign you in."
                    className="text-xs"
                  />
                </div>
              </div>
            )}

            {/* AUDIENCE TAB */}
            {activeTab === "audience" && (
              <div className="flex flex-col gap-4">
                <div>
                  <Label className="text-xs font-semibold text-ui-fg-base mb-2 block">Target Customer Persona</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {[
                      { id: "all", label: "All Personas (Universal)" },
                      { id: "guest", label: "Guest Visitors Only" },
                      { id: "logged_in", label: "Logged-In Users Only" },
                      { id: "new_customer", label: "First-Time Visitors" },
                      { id: "returning_customer", label: "Returning Customers" },
                      { id: "member", label: "VIP Club Members" },
                    ].map((persona) => {
                      const active = customerStatuses.includes(persona.id as any);
                      return (
                        <button
                          key={persona.id}
                          type="button"
                          onClick={() => {
                            if (persona.id === "all") setCustomerStatuses(["all"]);
                            else {
                              const f = customerStatuses.filter((s) => s !== "all");
                              if (f.includes(persona.id as any)) {
                                const n = f.filter((s) => s !== persona.id);
                                setCustomerStatuses(n.length === 0 ? ["all"] : n);
                              } else {
                                setCustomerStatuses([...f, persona.id as any]);
                              }
                            }
                          }}
                          className={`p-2.5 text-xs text-left rounded-lg border transition-all ${
                            active
                              ? "bg-rose-50 dark:bg-rose-950/40 border-rose-500 text-rose-700 font-semibold"
                              : "bg-ui-bg-subtle border-ui-border-base text-ui-fg-subtle hover:text-ui-fg-base"
                          }`}
                        >
                          {persona.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-semibold text-ui-fg-base mb-2 block">Target Devices</Label>
                  <div className="flex gap-2">
                    {[
                      { id: "desktop", label: "Desktop & Laptops", icon: Monitor },
                      { id: "tablet", label: "Tablets & iPads", icon: Smartphone },
                      { id: "mobile", label: "Mobile Phones", icon: Smartphone },
                    ].map((dev) => {
                      const Icon = dev.icon;
                      const active = devices.includes(dev.id as any);
                      return (
                        <button
                          key={dev.id}
                          type="button"
                          onClick={() => {
                            if (devices.includes(dev.id as any)) {
                              const n = devices.filter((d) => d !== dev.id);
                              setDevices(n.length === 0 ? ["desktop"] : n);
                            } else {
                              setDevices([...devices, dev.id as any]);
                            }
                          }}
                          className={`flex-1 p-2.5 text-xs flex items-center justify-center gap-1.5 rounded-lg border transition-all ${
                            active
                              ? "bg-rose-50 dark:bg-rose-950/40 border-rose-500 text-rose-700 font-semibold"
                              : "bg-ui-bg-subtle border-ui-border-base text-ui-fg-subtle hover:text-ui-fg-base"
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          {dev.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-semibold text-ui-fg-base mb-1 block">City Targeting (Optional)</Label>
                    <select
                      multiple
                      value={selectedCityIds}
                      onChange={(e) =>
                        setSelectedCityIds(Array.from(e.target.selectedOptions, (opt) => opt.value))
                      }
                      className="w-full h-24 p-2 text-xs rounded-md bg-ui-bg-field border border-ui-border-base focus:border-ui-border-interactive focus:outline-none"
                    >
                      {(options.cities || []).map((c: any) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-ui-fg-base mb-1 block">Branch Targeting (Optional)</Label>
                    <select
                      multiple
                      value={selectedBranchIds}
                      onChange={(e) =>
                        setSelectedBranchIds(Array.from(e.target.selectedOptions, (opt) => opt.value))
                      }
                      className="w-full h-24 p-2 text-xs rounded-md bg-ui-bg-field border border-ui-border-base focus:border-ui-border-interactive focus:outline-none"
                    >
                      {(options.branches || []).map((b: any) => (
                        <option key={b.value} value={b.value}>
                          {b.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* CONTENT TAB */}
            {activeTab === "content" && (
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-semibold text-ui-fg-base mb-1 block">Eyebrow Header</Label>
                    <Input
                      value={eyebrow}
                      onChange={(e) => setEyebrow(e.target.value)}
                      placeholder="e.g. SPECIAL OFFER"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-ui-fg-base mb-1 block">Badge Pill</Label>
                    <Input
                      value={badge}
                      onChange={(e) => setBadge(e.target.value)}
                      placeholder="e.g. ₹150 OFF"
                      className="text-sm"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-semibold text-ui-fg-base mb-1 block">Headline Text *</Label>
                  <Input
                    value={headline}
                    onChange={(e) => setHeadline(e.target.value)}
                    placeholder="e.g. Welcome to CakeToHome, {{customer_name}}"
                    className="text-sm font-semibold"
                  />
                  <span className="text-[10px] text-ui-fg-muted mt-1 block">
                    Dynamic placeholders supported: {"{{customer_name}}"}, {"{{city}}"}, {"{{product_name}}"}, {"{{coupon_code}}"}
                  </span>
                </div>

                <div>
                  <Label className="text-xs font-semibold text-ui-fg-base mb-1 block">Description Copy</Label>
                  <textarea
                    value={contentDesc}
                    onChange={(e) => setContentDesc(e.target.value)}
                    rows={3}
                    placeholder="e.g. Enjoy ₹150 OFF your first handcrafted cake order with complimentary delivery."
                    className="w-full p-2.5 text-xs rounded-md bg-ui-bg-field border border-ui-border-base focus:border-ui-border-interactive focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 bg-ui-bg-subtle rounded-xl border border-ui-border-base">
                  <div>
                    <Label className="text-xs font-semibold text-ui-fg-base mb-1 block">Primary CTA Button Label</Label>
                    <Input
                      value={primaryLabel}
                      onChange={(e) => setPrimaryLabel(e.target.value)}
                      placeholder="e.g. Continue with Mobile Number"
                      className="text-xs font-medium"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-ui-fg-base mb-1 block">Primary Button Action</Label>
                    <select
                      value={primaryAction}
                      onChange={(e) => setPrimaryAction(e.target.value)}
                      className="w-full h-8 px-2.5 text-xs rounded-md bg-ui-bg-field border border-ui-border-base focus:border-ui-border-interactive focus:outline-none"
                    >
                      <option value="LOGIN_WITH_MOBILE">Direct Mobile Phone Login & OTP</option>
                      <option value="APPLY_COUPON">Apply Discount Coupon Automatically</option>
                      <option value="OPEN_CART">Open Cart Drawer / Checkout</option>
                      <option value="CHECKOUT">Direct to Checkout Page</option>
                      <option value="LOGIN">Trigger Phone / OTP Smart Login Modal</option>
                      <option value="SIGNUP">Trigger Member Registration</option>
                      <option value="VIEW_PRODUCT">Navigate to Active Product Page</option>
                      <option value="VIEW_CATEGORY">Navigate to Category Collection</option>
                      <option value="CLOSE">Dismiss Popup</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-semibold text-ui-fg-base mb-1 block">Secondary Dismissal Label</Label>
                    <Input
                      value={secondaryLabel}
                      onChange={(e) => setSecondaryLabel(e.target.value)}
                      placeholder="e.g. Continue Browsing"
                      className="text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-ui-fg-base mb-1 block">Legal Disclaimer / Terms</Label>
                    <Input
                      value={legalText}
                      onChange={(e) => setLegalText(e.target.value)}
                      placeholder="e.g. Valid on online orders only."
                      className="text-xs"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* MEDIA TAB */}
            {activeTab === "media" && (
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-semibold text-ui-fg-base mb-1 block">Media Source</Label>
                    <select
                      value={mediaSource}
                      onChange={(e) => setMediaSource(e.target.value)}
                      className="w-full h-8 px-2.5 text-xs rounded-md bg-ui-bg-field border border-ui-border-base focus:border-ui-border-interactive focus:outline-none"
                    >
                      <option value="MEDIA_LIBRARY">Media Library / Local Assets</option>
                      <option value="PRODUCT_IMAGE">Dynamic Product Image (On Product Page)</option>
                      <option value="CART_IMAGES">Dynamic Cart Thumbnails (On Cart View)</option>
                      <option value="NO_IMAGE">No Artwork (Text-Only High Impact Banner)</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-ui-fg-base mb-1 block">Media Orientation</Label>
                    <select
                      value={mediaPosition}
                      onChange={(e) => setMediaPosition(e.target.value)}
                      className="w-full h-8 px-2.5 text-xs rounded-md bg-ui-bg-field border border-ui-border-base focus:border-ui-border-interactive focus:outline-none"
                    >
                      <option value="top">Top Header Banner</option>
                      <option value="left">Left Artwork (Split Layout)</option>
                      <option value="right">Right Artwork</option>
                    </select>
                  </div>
                </div>

                {mediaSource !== "NO_IMAGE" && (
                  <div className="flex flex-col gap-4">
                    {/* Desktop Artwork Card */}
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-bold text-brand-navy dark:text-white flex items-center gap-1.5">
                          <ImageIcon className="w-4 h-4 text-brand-gold" />
                          Desktop Artwork Banner *
                        </Label>
                        <Button
                          variant="secondary"
                          size="small"
                          onClick={() => {
                            setMediaTarget("desktop");
                            setMediaModalOpen(true);
                          }}
                          className="text-xs flex items-center gap-1 bg-brand-navy/5 hover:bg-brand-navy/10 text-brand-navy border-brand-navy/20 font-semibold"
                        >
                          <ImageIcon className="w-3.5 h-3.5 text-brand-gold" />
                          Select from Media Library
                        </Button>
                      </div>

                      {imageUrl ? (
                        <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-20 h-20 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shrink-0 bg-slate-100 dark:bg-slate-900 shadow-inner">
                              <img
                                src={imageUrl}
                                alt={mediaFilename || "Popup Artwork"}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="flex flex-col gap-1 min-w-0">
                              <span className="font-bold text-xs text-brand-navy dark:text-white truncate block">
                                {mediaFilename}
                              </span>
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                  {mediaDimensions}
                                </span>
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                  {mediaMime}
                                </span>
                                {mediaId && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                    ID: {mediaId.slice(0, 10)}...
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-400 font-mono truncate max-w-[280px]">
                                {imageUrl}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                            <Button
                              variant="secondary"
                              size="small"
                              onClick={() => {
                                setMediaTarget("desktop");
                                setMediaModalOpen(true);
                              }}
                              className="text-xs"
                            >
                              Replace
                            </Button>
                            <Button
                              variant="danger"
                              size="small"
                              onClick={() => {
                                setImageUrl("");
                                setMediaId("");
                                setMediaFilename("");
                              }}
                              className="text-xs flex items-center gap-1 text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 dark:bg-red-950/30 dark:border-red-900/50"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Remove
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="p-5 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl flex flex-col items-center justify-center gap-2 text-center bg-slate-50/50 dark:bg-slate-900/30">
                          <ImageIcon className="w-8 h-8 text-slate-400" />
                          <div>
                            <span className="font-semibold text-xs text-slate-700 dark:text-slate-200 block">No Artwork Selected</span>
                            <span className="text-[11px] text-slate-400">Choose an image from your CakeToHome Media Library or upload a fresh banner</span>
                          </div>
                          <Button
                            variant="secondary"
                            size="small"
                            onClick={() => {
                              setMediaTarget("desktop");
                              setMediaModalOpen(true);
                            }}
                            className="mt-1 text-xs bg-brand-navy text-white hover:bg-brand-deep font-semibold"
                          >
                            Select from Media Library
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Mobile Artwork Card (Optional) */}
                    <div className="flex flex-col gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-xs font-bold text-brand-navy dark:text-white flex items-center gap-1.5">
                            <Smartphone className="w-4 h-4 text-brand-gold" />
                            Mobile-Specific Artwork (Optional)
                          </Label>
                          <span className="text-[10px] text-slate-400">If unset, desktop artwork will scale responsively on mobile devices</span>
                        </div>
                        <Button
                          variant="secondary"
                          size="small"
                          onClick={() => {
                            setMediaTarget("mobile");
                            setMediaModalOpen(true);
                          }}
                          className="text-xs flex items-center gap-1 bg-brand-navy/5 hover:bg-brand-navy/10 text-brand-navy border-brand-navy/20 font-semibold"
                        >
                          <Smartphone className="w-3.5 h-3.5 text-brand-gold" />
                          {mobileImageUrl ? "Change Mobile Artwork" : "+ Add Mobile Artwork"}
                        </Button>
                      </div>

                      {mobileImageUrl && (
                        <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-16 h-16 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 shrink-0 bg-slate-100 dark:bg-slate-900">
                              <img
                                src={mobileImageUrl}
                                alt="Mobile Artwork"
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="flex flex-col gap-0.5 min-w-0">
                              <span className="font-bold text-xs text-brand-navy dark:text-white truncate">
                                {mobileMediaFilename || "mobile-banner.jpg"}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono truncate max-w-[240px]">
                                {mobileImageUrl}
                              </span>
                            </div>
                          </div>
                          <Button
                            variant="danger"
                            size="small"
                            onClick={() => {
                              setMobileImageUrl("");
                              setMobileMediaId("");
                              setMobileMediaFilename("");
                            }}
                            className="text-xs flex items-center gap-1 text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 dark:bg-red-950/30 dark:border-red-900/50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Remove
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* OFFER TAB */}
            {activeTab === "offer" && (
              <div className="flex flex-col gap-4">
                <div className="p-3 bg-ui-bg-subtle rounded-xl border border-ui-border-base flex flex-col gap-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs font-semibold text-ui-fg-base mb-1 block">Offer Type</Label>
                      <select
                        value={offerType}
                        onChange={(e) => setOfferType(e.target.value)}
                        className="w-full h-8 px-2.5 text-xs rounded-md bg-ui-bg-field border border-ui-border-base focus:border-ui-border-interactive focus:outline-none"
                      >
                        <option value="COUPON">Discount Coupon Code</option>
                        <option value="FREE_DELIVERY">Free Delivery Guarantee</option>
                        <option value="AUTO_DISCOUNT">Automatic Cart Discount</option>
                        <option value="NONE">No Direct Discount</option>
                      </select>
                    </div>
                    <div>
                      <Label className="text-xs font-semibold text-ui-fg-base mb-1 block">Link Existing Coupon</Label>
                      <select
                        value={selectedCouponId}
                        onChange={(e) => handleCouponSelect(e.target.value)}
                        className="w-full h-8 px-2.5 text-xs rounded-md bg-ui-bg-field border border-ui-border-base focus:border-ui-border-interactive focus:outline-none"
                      >
                        <option value="">-- Custom Code / No Link --</option>
                        {(options.coupons || []).map((c: any) => (
                          <option key={c.id || c.value} value={c.id || c.value}>
                            {c.label || c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-ui-fg-base mb-1 block">Coupon Promo Code</Label>
                    <Input
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                      placeholder="e.g. SWEET150"
                      className="text-xs font-mono font-bold"
                    />
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer text-xs pt-1">
                    <input
                      type="checkbox"
                      checked={autoApplyCoupon}
                      onChange={(e) => setAutoApplyCoupon(e.target.checked)}
                      className="rounded border-ui-border-base text-rose-600 focus:ring-rose-500"
                    />
                    <span>Automatically apply coupon code to customer cart session</span>
                  </label>
                </div>
              </div>
            )}

            {/* DESIGN TAB */}
            {activeTab === "design" && (
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-xs font-semibold text-ui-fg-base mb-1 block">Desktop Layout</Label>
                    <select
                      value={desktopLayout}
                      onChange={(e) => setDesktopLayout(e.target.value as any)}
                      className="w-full h-8 px-2.5 text-xs rounded-md bg-ui-bg-field border border-ui-border-base focus:border-ui-border-interactive focus:outline-none"
                    >
                      <option value="CENTER_MODAL">Center Modal</option>
                      <option value="SPLIT_LAYOUT">Split Artwork Layout</option>
                      <option value="SIDE_PANEL">Side Slide-In Panel</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-ui-fg-base mb-1 block">Mobile Layout</Label>
                    <select
                      value={mobileLayout}
                      onChange={(e) => setMobileLayout(e.target.value as any)}
                      className="w-full h-8 px-2.5 text-xs rounded-md bg-ui-bg-field border border-ui-border-base focus:border-ui-border-interactive focus:outline-none"
                    >
                      <option value="BOTTOM_SHEET">Mobile Bottom Sheet</option>
                      <option value="CENTER_MODAL">Center Dialog</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-ui-fg-base mb-1 block">Brand Accent Color</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={accentColor}
                        onChange={(e) => setAccentColor(e.target.value)}
                        className="w-8 h-8 rounded border border-neutral-300 cursor-pointer p-0"
                      />
                      <Input
                        value={accentColor}
                        onChange={(e) => setAccentColor(e.target.value)}
                        className="text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-xs font-semibold text-ui-fg-base mb-1 block">Modal Max Width (px)</Label>
                    <Input
                      type="number"
                      value={modalWidth}
                      onChange={(e) => setModalWidth(Number(e.target.value))}
                      placeholder="520"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-ui-fg-base mb-1 block">Border Radius (px)</Label>
                    <Input
                      type="number"
                      value={borderRadius}
                      onChange={(e) => setBorderRadius(Number(e.target.value))}
                      placeholder="20"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-ui-fg-base mb-1 block">Backdrop Opacity (0 - 1)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="1"
                      value={backdropOpacity}
                      onChange={(e) => setBackdropOpacity(Number(e.target.value))}
                      placeholder="0.6"
                      className="text-sm"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* FREQUENCY TAB */}
            {activeTab === "frequency" && (
              <div className="flex flex-col gap-5">
                {/* Frequency Mode Selector */}
                <div className="flex flex-col gap-2">
                  <Label className="text-xs font-semibold text-ui-fg-base block">Frequency Mode</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {[
                      { id: "every_page_load", label: "Every Page Load", desc: "Show on each eligible visit" },
                      { id: "once_per_session", label: "Once Per Session", desc: "1 display per browser session" },
                      { id: "once_per_day", label: "Once Per Day", desc: "24-hour interval" },
                      { id: "cooldown", label: "Cooldown", desc: "Wait fixed duration" },
                      { id: "custom", label: "Custom", desc: "Configurable interval" },
                    ].map((mode) => (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => setFrequencyMode(mode.id as any)}
                        className={`p-2.5 rounded-xl text-left border transition-all ${
                          frequencyMode === mode.id
                            ? "bg-rose-50 dark:bg-rose-950/40 border-rose-500 shadow-xs font-semibold text-rose-700 dark:text-rose-300 ring-1 ring-rose-500"
                            : "bg-ui-bg-subtle border-ui-border-base text-ui-fg-subtle hover:border-ui-border-interactive"
                        }`}
                      >
                        <span className="text-xs block font-bold">{mode.label}</span>
                        <span className="text-[10px] text-ui-fg-muted block truncate">{mode.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Cooldown Settings if Cooldown / Custom */}
                {(frequencyMode === "cooldown" || frequencyMode === "custom") && (
                  <div className="p-3.5 bg-ui-bg-subtle rounded-xl border border-ui-border-base flex flex-col gap-3 animate-fade-in">
                    <Label className="text-xs font-semibold text-ui-fg-base block">Cooldown Duration</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <Label className="text-[11px] text-ui-fg-subtle mb-1 block">Value</Label>
                        <Input
                          type="number"
                          min="1"
                          value={cooldownValue}
                          onChange={(e) => setCooldownValue(Math.max(1, Number(e.target.value)))}
                          className="text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-[11px] text-ui-fg-subtle mb-1 block">Unit</Label>
                        <select
                          value={cooldownUnit}
                          onChange={(e) => setCooldownUnit(e.target.value as any)}
                          className="w-full h-8 px-2.5 text-xs rounded-md bg-ui-bg-field border border-ui-border-base focus:border-ui-border-interactive focus:outline-none"
                        >
                          <option value="minutes">Minutes</option>
                          <option value="hours">Hours</option>
                          <option value="days">Days</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* Audience Eligibility Toggles */}
                <div className="p-3.5 bg-ui-bg-subtle rounded-xl border border-ui-border-base flex flex-col gap-3">
                  <span className="text-xs font-bold text-ui-fg-base">Customer & Visitor Eligibility</span>
                  <div className="flex flex-col gap-2.5">
                    <label className="flex items-center justify-between p-2 rounded-lg bg-ui-bg-base border border-ui-border-base cursor-pointer">
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-ui-fg-base">Show to logged-out visitors (Guests)</span>
                        <span className="text-[10px] text-ui-fg-muted">Eligible for anonymous storefront guests</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={showToGuests}
                        onChange={(e) => setShowToGuests(e.target.checked)}
                        className="w-4 h-4 rounded border-ui-border-base text-rose-600 focus:ring-rose-500 cursor-pointer"
                      />
                    </label>

                    <label className="flex items-center justify-between p-2 rounded-lg bg-ui-bg-base border border-ui-border-base cursor-pointer">
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-ui-fg-base">Show to authenticated customers (Logged-in)</span>
                        <span className="text-[10px] text-ui-fg-muted">Default OFF — suppresses promotional visitor popups for signed-in accounts</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={showToAuthenticated}
                        onChange={(e) => setShowToAuthenticated(e.target.checked)}
                        className="w-4 h-4 rounded border-ui-border-base text-rose-600 focus:ring-rose-500 cursor-pointer"
                      />
                    </label>
                  </div>
                </div>

                {/* Advanced Cart and State options */}
                <div className="flex flex-col gap-2 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-xs">
                    <input
                      type="checkbox"
                      checked={cartChangeRequired}
                      onChange={(e) => setCartChangeRequired(e.target.checked)}
                      className="rounded border-ui-border-base text-rose-600 focus:ring-rose-500"
                    />
                    <span>Re-display popup when customer changes or updates cart items</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-xs">
                    <input
                      type="checkbox"
                      checked={loginStateChangeRequired}
                      onChange={(e) => setLoginStateChangeRequired(e.target.checked)}
                      className="rounded border-ui-border-base text-rose-600 focus:ring-rose-500"
                    />
                    <span>Re-evaluate popup when customer login status transitions</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Right-Side Interactive AST Live Preview & Simulator */}
          {showLivePreview && (() => {
            const liveCampaign = buildCurrentCampaignConfig();
            const liveSimContext = buildSimulatorContext();
            const audienceEvaluation = explainAudienceMatch(liveCampaign, liveSimContext);
            const frequencyEvaluation = explainFrequencyEligibility(liveCampaign, liveSimContext);
            const triggerEvaluation = evaluateCampaignTriggersDetailed(
              liveCampaign,
              liveSimContext,
              simManualFired ? { type: "manual_test" } : undefined
            );

            const isSimEligible =
              audienceEvaluation.matched &&
              frequencyEvaluation.eligible &&
              (simManualFired || triggerEvaluation.isTriggered);

            return (
              <div className="lg:col-span-5 flex flex-col gap-3">
                {/* Simulator Controls Top Bar */}
                <div className="p-3 bg-neutral-900 text-white rounded-xl shadow-md flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold flex items-center gap-1.5">
                      <Eye className="w-3.5 h-3.5 text-brand-gold" />
                      Interactive AST Simulator
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSimManualFired(true);
                        setTimeout(() => setSimManualFired(false), 3000);
                      }}
                      title="Manual Test Mode: Bypasses session timing and frequency caps for instant design verification"
                      className="px-2.5 py-1 text-[11px] font-bold bg-brand-navy hover:bg-brand-deep text-white border border-brand-gold/40 rounded-lg flex items-center gap-1 transition-all shadow-xs"
                    >
                      <Play className="w-3 h-3 fill-current text-brand-gold" />
                      ⚡ Test Trigger (Manual Mode)
                    </button>
                  </div>

                  {/* Simulator Device & Persona Toggles */}
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="flex bg-neutral-800 p-1 rounded-lg">
                      <button
                        type="button"
                        onClick={() => setSimDevice("desktop")}
                        className={`flex-1 py-1 rounded text-center font-semibold transition-colors ${
                          simDevice === "desktop" ? "bg-brand-navy text-brand-gold shadow-xs" : "text-neutral-400 hover:text-white"
                        }`}
                      >
                        Desktop
                      </button>
                      <button
                        type="button"
                        onClick={() => setSimDevice("mobile")}
                        className={`flex-1 py-1 rounded text-center font-semibold transition-colors ${
                          simDevice === "mobile" ? "bg-brand-navy text-brand-gold shadow-xs" : "text-neutral-400 hover:text-white"
                        }`}
                      >
                        Mobile
                      </button>
                    </div>

                    <div className="flex bg-neutral-800 p-1 rounded-lg">
                      <button
                        type="button"
                        onClick={() => setSimPersona("guest")}
                        className={`flex-1 py-1 rounded text-center font-semibold transition-colors ${
                          simPersona === "guest" ? "bg-brand-navy text-brand-gold shadow-xs" : "text-neutral-400 hover:text-white"
                        }`}
                      >
                        Guest
                      </button>
                      <button
                        type="button"
                        onClick={() => setSimPersona("logged_in")}
                        className={`flex-1 py-1 rounded text-center font-semibold transition-colors ${
                          simPersona === "logged_in" ? "bg-brand-navy text-brand-gold shadow-xs" : "text-neutral-400 hover:text-white"
                        }`}
                      >
                        Logged In
                      </button>
                    </div>
                  </div>

                  {/* Simulator Cart, Visitor, & Page Controls */}
                  <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                    <div className="flex bg-neutral-800 p-0.5 rounded-lg">
                      <button
                        type="button"
                        onClick={() => setSimCart("empty")}
                        className={`flex-1 py-0.5 rounded text-center font-medium ${
                          simCart === "empty" ? "bg-neutral-700 text-white" : "text-neutral-400"
                        }`}
                      >
                        Cart: 0
                      </button>
                      <button
                        type="button"
                        onClick={() => setSimCart("has_items")}
                        className={`flex-1 py-0.5 rounded text-center font-medium ${
                          simCart === "has_items" ? "bg-neutral-700 text-white" : "text-neutral-400"
                        }`}
                      >
                        Cart: ₹1.2k
                      </button>
                    </div>

                    <div className="flex bg-neutral-800 p-0.5 rounded-lg">
                      <button
                        type="button"
                        onClick={() => setSimVisitor("first_visit")}
                        className={`flex-1 py-0.5 rounded text-center font-medium ${
                          simVisitor === "first_visit" ? "bg-neutral-700 text-white" : "text-neutral-400"
                        }`}
                      >
                        1st Visit
                      </button>
                      <button
                        type="button"
                        onClick={() => setSimVisitor("returning")}
                        className={`flex-1 py-0.5 rounded text-center font-medium ${
                          simVisitor === "returning" ? "bg-neutral-700 text-white" : "text-neutral-400"
                        }`}
                      >
                        Repeat
                      </button>
                    </div>

                    <select
                      value={simPage}
                      onChange={(e) => setSimPage(e.target.value)}
                      className="bg-neutral-800 text-neutral-200 text-[10px] rounded-lg px-1.5 py-1 border border-neutral-700 focus:outline-none"
                    >
                      <option value="home">Page: Home (/)</option>
                      <option value="products">Page: Products</option>
                      <option value="categories">Page: Categories</option>
                      <option value="cart">Page: Cart</option>
                      <option value="checkout">Page: Checkout</option>
                    </select>
                  </div>

                  {/* Fine-Tuning Slider Controls: Time & Scroll */}
                  <div className="grid grid-cols-3 gap-2 pt-1 text-[10px] border-t border-neutral-800">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-neutral-400">Time: {simTime}s</span>
                      <input
                        type="range"
                        min="0"
                        max="20"
                        step="1"
                        value={simTime}
                        onChange={(e) => setSimTime(Number(e.target.value))}
                        className="w-full h-1 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-rose-500"
                      />
                    </div>

                    <div className="flex flex-col gap-0.5">
                      <span className="text-neutral-400">Scroll: {simScroll}%</span>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="10"
                        value={simScroll}
                        onChange={(e) => setSimScroll(Number(e.target.value))}
                        className="w-full h-1 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-rose-500"
                      />
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <label className="flex items-center gap-1 cursor-pointer text-neutral-300">
                        <input
                          type="checkbox"
                          checked={simExitIntent}
                          onChange={(e) => setSimExitIntent(e.target.checked)}
                          className="w-3 h-3 rounded accent-brand-navy cursor-pointer"
                        />
                        <span>Exit Intent</span>
                      </label>
                    </div>
                  </div>

                  {/* Dynamic Diagnostic Evaluation Status */}
                  <div
                    className={`p-3 rounded-xl text-xs flex flex-col gap-2 transition-all shadow-xs ${
                      isSimEligible
                        ? "bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200"
                        : "bg-brand-gold-light dark:bg-brand-gold-dark/40 border border-brand-gold/40 dark:border-brand-gold-dark text-brand-gold-dark dark:text-brand-gold"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-bold">
                        {isSimEligible ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-brand-gold dark:text-brand-gold shrink-0" />
                        )}
                        <span className="text-xs">
                          {isSimEligible ? "ELIGIBLE & RENDERED" : "TRIGGER CRITERIA NOT MET IN CURRENT CONTEXT"}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/80 dark:bg-slate-900/80 border border-current">
                        {isSimEligible ? "Live Match" : "Preview Mode"}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] pt-1 border-t border-current/20">
                      <div>
                        <span className="font-bold block">Audience:</span>
                        <span className="opacity-90">
                          {audienceEvaluation.matched ? "✓ Matched" : `✗ ${audienceEvaluation.reason || "Not targeted"}`}
                        </span>
                      </div>
                      <div>
                        <span className="font-bold block">Frequency:</span>
                        <span className="opacity-90">
                          {frequencyEvaluation.eligible ? "✓ Eligible" : `✗ ${frequencyEvaluation.reason || "Capped"}`}
                        </span>
                      </div>
                      <div>
                        <span className="font-bold block">Trigger:</span>
                        <span className="opacity-90">
                          {simManualFired
                            ? "✓ Force-Fired"
                            : triggerEvaluation.isTriggered
                            ? `✓ ${triggerEvaluation.matchedTriggers?.join(", ") || "Satisfied"}`
                            : `✗ ${triggerEvaluation.reason || "Pending conditions"}`}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] pt-1">
                      <span className="text-[10px] opacity-80">
                        {simManualFired
                          ? "Manual preview test active. Production will evaluate live visitor triggers."
                          : isSimEligible
                          ? "All trigger and audience rules satisfied for this simulator persona."
                          : "Preview canvas is displayed below for design review. Click Trigger Now to test fire."}
                      </span>
                      {!isSimEligible && !simManualFired && (
                        <button
                          type="button"
                          onClick={() => setSimManualFired(true)}
                          className="px-2.5 py-1 rounded-lg bg-brand-navy hover:bg-brand-deep text-white font-bold text-[10px] transition-all shadow-xs shrink-0"
                        >
                          ⚡ Trigger Now
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Live Rendered Canvas Frame */}
                <div
                  className={`w-full bg-neutral-100 dark:bg-neutral-950 rounded-2xl border border-neutral-300 dark:border-neutral-800 p-4 flex items-center justify-center min-h-[420px] transition-all overflow-hidden relative ${
                    simDevice === "mobile" ? "max-w-[340px] mx-auto" : "w-full"
                  }`}
                >
                  {/* Subtle status indicator pill when in preview simulation */}
                  {!isSimEligible && (
                    <div className="absolute top-2.5 right-2.5 z-20">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-gold-light text-brand-gold-dark border border-brand-gold/40 dark:bg-brand-gold-dark/80 dark:text-brand-gold shadow-xs flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 text-brand-gold dark:text-brand-gold" />
                        Design Preview
                      </span>
                    </div>
                  )}

                  {/* Scaled Popup Simulation Box */}
                  <div
                    style={{
                      borderRadius: `${borderRadius}px`,
                      borderColor: accentColor,
                    }}
                    className="w-full bg-white dark:bg-neutral-900 rounded-2xl shadow-xl border overflow-hidden flex flex-col animate-scale-up transition-opacity opacity-100"
                  >
                    {/* Artwork Preview */}
                    {mediaSource !== "NO_IMAGE" && (imageUrl || mobileImageUrl) && (
                      <div className="w-full h-36 bg-neutral-200 relative overflow-hidden">
                        <img
                          src={simDevice === "mobile" && mobileImageUrl ? mobileImageUrl : imageUrl}
                          alt="Preview Artwork"
                          className="w-full h-full object-cover"
                        />
                        {badge && (
                          <span
                            style={{ backgroundColor: accentColor }}
                            className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold text-white shadow-xs"
                          >
                            {badge}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Text Body */}
                    <div className="p-4 flex flex-col gap-2.5">
                      {eyebrow && (
                        <span
                          style={{ color: accentColor }}
                          className="text-[10px] uppercase font-bold tracking-wider"
                        >
                          {eyebrow}
                        </span>
                      )}

                      <h4 className="text-sm font-bold text-neutral-900 dark:text-white leading-tight">
                        {headline
                          .replace("{{customer_name}}", simPersona === "logged_in" ? "Ananya" : "Guest")
                          .replace("{{coupon_code}}", couponCode)}
                      </h4>

                      {contentDesc && (
                        <p className="text-[11px] text-neutral-600 dark:text-neutral-300 leading-relaxed">
                          {contentDesc}
                        </p>
                      )}

                      {/* Offer Voucher Simulation */}
                      {offerType === "COUPON" && couponCode && (
                        <div className="p-2 rounded-lg bg-brand-gold-light dark:bg-brand-gold-dark/30 border border-dashed border-brand-gold/40 dark:border-brand-gold-dark/60 flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <Tag className="w-3.5 h-3.5 text-brand-gold dark:text-brand-gold" />
                            <span className="text-xs font-mono font-bold text-brand-navy dark:text-brand-gold">{couponCode}</span>
                          </div>
                          <span className="text-[10px] font-bold text-brand-gold-dark dark:text-brand-gold uppercase">
                            Apply at checkout
                          </span>
                        </div>
                      )}

                      {/* Phone Input Simulation */}
                      {phoneEnabled && (
                        <div className="flex flex-col gap-1.5 pt-1">
                          <span className="text-[10px] font-semibold text-neutral-600 dark:text-neutral-300">
                            {phonePlaceholder}
                          </span>
                          <div className="flex items-center rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 overflow-hidden">
                            <span className="px-2 py-1.5 text-[11px] font-bold text-neutral-600 dark:text-neutral-300 bg-neutral-200 dark:bg-neutral-700">
                              🇮🇳 +91
                            </span>
                            <span className="px-2 py-1.5 text-[11px] text-neutral-400">
                              98765 43210
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Action Button Simulation */}
                      <button
                        type="button"
                        style={{ backgroundColor: accentColor }}
                        className="w-full py-2 px-3 rounded-lg text-white font-bold text-xs shadow-xs flex items-center justify-center gap-1.5 mt-1 hover:opacity-90 transition-opacity"
                      >
                        <span>{phoneEnabled ? phoneButtonLabel : primaryLabel}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>

                      {!phoneMandatory && (
                        <span className="text-[10px] text-neutral-400 text-center cursor-pointer hover:underline">
                          {phoneEnabled ? phoneGuestButtonLabel : secondaryLabel}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Media Selector Modal */}
      <MediaSelectorModal
        isOpen={mediaModalOpen}
        onClose={() => setMediaModalOpen(false)}
        onSelect={handleMediaSelect}
      />
    </div>
  );
}
