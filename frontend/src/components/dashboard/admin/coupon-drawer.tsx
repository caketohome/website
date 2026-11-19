"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Save,
  Tag,
  Clock,
  ShieldAlert,
  MapPin,
  Users,
  Layers,
  BarChart3,
  History,
  FileText,
  Copy,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Percent,
  IndianRupee,
  Truck,
  Sparkles,
  ShoppingBag,
  CreditCard,
  Building,
  Upload,
  Calendar,
  Eye,
  Check,
} from "lucide-react";

export interface CouponDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  couponId?: string | null;
  onSaveSuccess?: () => void;
}

const COUPON_TYPES = [
  { value: "percentage", label: "Percentage Discount (%)", desc: "e.g. 20% off up to ₹500" },
  { value: "flat", label: "Fixed Amount Discount (₹)", desc: "e.g. Flat ₹100 off on cart" },
  { value: "free_delivery", label: "Free Doorstep Delivery", desc: "Waives 100% shipping charges" },
  { value: "buy_x_get_y", label: "Buy X Get Y (BOGO)", desc: "Buy 1 gourmet cake, get 1 free" },
  { value: "buy_x_get_discount", label: "Buy X Get Discount", desc: "Buy 2 get 30% off second item" },
  { value: "free_product", label: "Free Gift Product", desc: "Complimentary cupcake or dessert" },
  { value: "free_addon", label: "Free Add-on / Accessory", desc: "Complimentary candles or cake toppers" },
  { value: "category_discount", label: "Category Discount", desc: "Valid only on selected cake categories" },
  { value: "product_discount", label: "Product Specific Discount", desc: "Valid only on specific item SKUs" },
  { value: "bundle_discount", label: "Party Bundle Discount", desc: "Discounts on combo packs" },
  { value: "first_order", label: "First Order Discount", desc: "For new verified accounts only" },
  { value: "birthday_coupon", label: "Birthday Special", desc: "Triggered on customer birthday" },
  { value: "anniversary_coupon", label: "Anniversary Special", desc: "Triggered on customer anniversary" },
  { value: "referral_coupon", label: "Referral Reward", desc: "Earned by inviting friends" },
  { value: "wallet_coupon", label: "Wallet Cash Credit", desc: "Adds balance to customer wallet" },
  { value: "cashback_coupon", label: "Post-Order Cashback", desc: "Cashback credited after delivery" },
];

const BRANCH_OPTIONS = [
  { id: "br_kollam_01", name: "Kollam Central", city: "Kollam" },
  { id: "br_kottiyam_02", name: "Kottiyam Express", city: "Kollam" },
  { id: "br_kochi_01", name: "Kochi Marine Drive", city: "Kochi" },
  { id: "br_trivandrum_01", name: "Trivandrum City", city: "Trivandrum" },
  { id: "br_calicut_01", name: "Calicut Beach Road", city: "Kozhikode" },
];

const FLAVORS = ["Belgian Chocolate Truffle", "Red Velvet Cream Cheese", "Alphonso Mango Mousse", "Black Forest Deluxe", "Butterscotch Crunch", "Pineapple Blossom"];
const SHAPES = ["Classic Round", "Heart Shape", "Square", "2-Tier Tiered", "3-Tier Grand Celebration"];
const WEIGHTS = ["0.5 kg", "1.0 kg", "1.5 kg", "2.0 kg", "3.0 kg"];
const PAYMENT_METHODS = [
  { id: "cash", label: "Cash on Counter" },
  { id: "cod", label: "Cash on Delivery (COD)" },
  { id: "upi", label: "Instant UPI (GPay / PhonePe / Paytm)" },
  { id: "card", label: "Credit / Debit Cards" },
  { id: "wallet", label: "C2H Customer Wallet" },
  { id: "online", label: "NetBanking / Razorpay" },
];

export function CouponDrawer({ isOpen, onClose, couponId, onSaveSuccess }: CouponDrawerProps) {
  const [activeTab, setActiveTab] = useState<
    "general" | "schedule" | "restrictions" | "branches" | "pincodes" | "customers" | "products" | "limits" | "payments" | "analytics" | "history" | "audit"
  >("general");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [type, setType] = useState("percentage");
  const [status, setStatus] = useState("active");
  const [priority, setPriority] = useState(0);
  const [discountValue, setDiscountValue] = useState<number>(10);
  const [maxDiscountValue, setMaxDiscountValue] = useState<number | "">("");
  const [minOrderValue, setMinOrderValue] = useState<number>(0);
  const [minQuantity, setMinQuantity] = useState<number>(1);
  const [description, setDescription] = useState("");

  // Validity & Timers
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [neverExpires, setNeverExpires] = useState(false);

  // Restrictions & Stacking
  const [isStackable, setIsStackable] = useState(false);
  const [isPublic, setIsPublic] = useState(true);
  const [autoApply, setAutoApply] = useState(false);
  const [excludeDiscounted, setExcludeDiscounted] = useState(false);
  const [excludeFlashSales, setExcludeFlashSales] = useState(false);
  const [deliveryMode, setDeliveryMode] = useState("all");

  // Multi-tier targeting
  const [allBranches, setAllBranches] = useState(true);
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);
  const [allCities, setAllCities] = useState(true);
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [pincodesInput, setPincodesInput] = useState("all");
  const [excludedPincodesInput, setExcludedPincodesInput] = useState("");
  const [customerEligibility, setCustomerEligibility] = useState("all");
  const [allowedPhonesInput, setAllowedPhonesInput] = useState("");
  const [allowedEmailsInput, setAllowedEmailsInput] = useState("");
  const [allowedCustomerTags, setAllowedCustomerTags] = useState("");

  // Product targeting
  const [selectedFlavors, setSelectedFlavors] = useState<string[]>([]);
  const [selectedShapes, setSelectedShapes] = useState<string[]>([]);
  const [selectedWeights, setSelectedWeights] = useState<string[]>([]);
  const [allowedPaymentMethods, setAllowedPaymentMethods] = useState<string[]>(["cash", "card", "upi", "wallet", "cod", "online"]);

  // Limits
  const [usageLimit, setUsageLimit] = useState<number | "">("");
  const [perCustomerLimit, setPerCustomerLimit] = useState<number>(1);
  const [dailyLimit, setDailyLimit] = useState<number | "">("");
  const [monthlyLimit, setMonthlyLimit] = useState<number | "">("");

  // Analytics & History
  const [redemptionsList, setRedemptionsList] = useState<any[]>([]);
  const [auditLogsList, setAuditLogsList] = useState<any[]>([]);
  const [totalRedemptions, setTotalRedemptions] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalDiscountGiven, setTotalDiscountGiven] = useState(0);

  // Pin test tool
  const [testPincode, setTestPincode] = useState("");
  const [pinTestResult, setPinTestResult] = useState<{ valid: boolean; message: string } | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    if (couponId) {
      loadCouponData(couponId);
    } else {
      resetForm();
    }
  }, [isOpen, couponId]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const resetForm = () => {
    const randomCode = `PROMO${Math.floor(1000 + Math.random() * 9000)}`;
    setName("");
    setCode(randomCode);
    setType("percentage");
    setStatus("active");
    setPriority(0);
    setDiscountValue(15);
    setMaxDiscountValue("");
    setMinOrderValue(499);
    setMinQuantity(1);
    setDescription("");
    const now = new Date();
    setStartsAt(now.toISOString().slice(0, 16));
    const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    setEndsAt(nextMonth.toISOString().slice(0, 16));
    setStartTime("");
    setEndTime("");
    setTimezone("Asia/Kolkata");
    setNeverExpires(false);
    setIsStackable(false);
    setIsPublic(true);
    setAutoApply(false);
    setExcludeDiscounted(false);
    setExcludeFlashSales(false);
    setDeliveryMode("all");
    setAllBranches(true);
    setSelectedBranches([]);
    setAllCities(true);
    setSelectedCities([]);
    setPincodesInput("all");
    setExcludedPincodesInput("");
    setCustomerEligibility("all");
    setAllowedPhonesInput("");
    setAllowedEmailsInput("");
    setAllowedCustomerTags("");
    setSelectedFlavors([]);
    setSelectedShapes([]);
    setSelectedWeights([]);
    setAllowedPaymentMethods(["cash", "card", "upi", "wallet", "cod", "online"]);
    setUsageLimit("");
    setPerCustomerLimit(1);
    setDailyLimit("");
    setMonthlyLimit("");
    setRedemptionsList([]);
    setAuditLogsList([]);
    setTotalRedemptions(0);
    setTotalRevenue(0);
    setTotalDiscountGiven(0);
    setActiveTab("general");
    setPinTestResult(null);
  };

  const loadCouponData = async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/offers/${id}`);
      if (!res.ok) throw new Error("Failed to load coupon details");
      const data = await res.json();
      const o = data.offer || data;

      setName(o.name || "");
      setCode(o.code || "");
      setType(o.type || "percentage");
      setStatus(o.status || "active");
      setPriority(o.priority || 0);
      setDiscountValue(Number(o.metadata?.discount_value || o.discount_value) || 10);
      setMaxDiscountValue(o.max_discount_value ? Number(o.max_discount_value) : "");
      setMinOrderValue(Number(o.min_order_value || o.min_order) || 0);
      setMinQuantity(Number(o.min_quantity) || 1);
      setDescription(o.description || "");

      if (o.starts_at) setStartsAt(new Date(o.starts_at).toISOString().slice(0, 16));
      if (o.ends_at) setEndsAt(new Date(o.ends_at).toISOString().slice(0, 16));
      setStartTime(o.start_time || "");
      setEndTime(o.end_time || "");
      setTimezone(o.timezone || "Asia/Kolkata");
      setNeverExpires(Boolean(o.never_expires));

      setIsStackable(Boolean(o.is_stackable));
      setIsPublic(o.is_public !== undefined ? Boolean(o.is_public) : true);
      setAutoApply(Boolean(o.auto_apply));
      setExcludeDiscounted(Boolean(o.exclude_discounted_items));
      setExcludeFlashSales(Boolean(o.exclude_flash_sales));
      setDeliveryMode(o.delivery_mode || "all");

      // Branches & Cities
      const branches = Array.isArray(o.applicable_branches) ? o.applicable_branches : (o.applicable_branches ? JSON.parse(o.applicable_branches) : ["all"]);
      if (branches.includes("all")) {
        setAllBranches(true);
        setSelectedBranches([]);
      } else {
        setAllBranches(false);
        setSelectedBranches(branches);
      }

      const cities = Array.isArray(o.applicable_cities) ? o.applicable_cities : (o.applicable_cities ? JSON.parse(o.applicable_cities) : ["all"]);
      if (cities.includes("all")) {
        setAllCities(true);
        setSelectedCities([]);
      } else {
        setAllCities(false);
        setSelectedCities(cities);
      }

      // Pincodes
      const pincodes = Array.isArray(o.applicable_pincodes) ? o.applicable_pincodes : (o.applicable_pincodes ? JSON.parse(o.applicable_pincodes) : ["all"]);
      setPincodesInput(pincodes.join(", "));
      const excluded = Array.isArray(o.excluded_pincodes) ? o.excluded_pincodes : (o.excluded_pincodes ? JSON.parse(o.excluded_pincodes) : []);
      setExcludedPincodesInput(excluded.join(", "));

      // Customers
      setCustomerEligibility(o.customer_eligibility || "all");
      const phones = Array.isArray(o.allowed_phones) ? o.allowed_phones : (o.allowed_phones ? JSON.parse(o.allowed_phones) : []);
      setAllowedPhonesInput(phones.join(", "));
      const emails = Array.isArray(o.allowed_emails) ? o.allowed_emails : (o.allowed_emails ? JSON.parse(o.allowed_emails) : []);
      setAllowedEmailsInput(emails.join(", "));

      // Products & Payments
      const flavors = Array.isArray(o.applicable_flavors) ? o.applicable_flavors : (o.applicable_flavors ? JSON.parse(o.applicable_flavors) : []);
      setSelectedFlavors(flavors);
      const shapes = Array.isArray(o.applicable_shapes) ? o.applicable_shapes : (o.applicable_shapes ? JSON.parse(o.applicable_shapes) : []);
      setSelectedShapes(shapes);
      const weights = Array.isArray(o.applicable_weights) ? o.applicable_weights : (o.applicable_weights ? JSON.parse(o.applicable_weights) : []);
      setSelectedWeights(weights);
      const payments = Array.isArray(o.allowed_payment_methods) ? o.allowed_payment_methods : (o.allowed_payment_methods ? JSON.parse(o.allowed_payment_methods) : ["cash", "card", "upi", "wallet", "cod", "online"]);
      setAllowedPaymentMethods(payments);

      // Limits & Metrics
      setUsageLimit(o.usage_limit ? Number(o.usage_limit) : "");
      setPerCustomerLimit(o.per_customer_limit !== undefined ? Number(o.per_customer_limit) : 1);
      setDailyLimit(o.daily_limit ? Number(o.daily_limit) : "");
      setMonthlyLimit(o.monthly_limit ? Number(o.monthly_limit) : "");

      setTotalRedemptions(Number(o.total_redemptions) || (data.redemptions ? data.redemptions.length : 0));
      setTotalRevenue(Number(o.total_revenue_generated) || 0);
      setTotalDiscountGiven(Number(o.total_discount_given) || 0);
      setRedemptionsList(data.redemptions || []);
      setAuditLogsList(data.audit_logs || []);
    } catch (err: any) {
      showToast(err.message || "Failed to load coupon.");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      showToast("Coupon Name is required.");
      setActiveTab("general");
      return;
    }
    if (!code.trim()) {
      showToast("Coupon Code is required.");
      setActiveTab("general");
      return;
    }

    setSaving(true);
    try {
      const parsedPincodes = pincodesInput.split(",").map((s) => s.trim()).filter(Boolean);
      const parsedExcludedPins = excludedPincodesInput.split(",").map((s) => s.trim()).filter(Boolean);
      const parsedPhones = allowedPhonesInput.split(",").map((s) => s.trim()).filter(Boolean);
      const parsedEmails = allowedEmailsInput.split(",").map((s) => s.trim()).filter(Boolean);

      const payload: Record<string, any> = {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        type,
        status,
        priority: Number(priority) || 0,
        starts_at: startsAt ? new Date(startsAt).toISOString() : new Date().toISOString(),
        ends_at: endsAt ? new Date(endsAt).toISOString() : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        start_time: startTime || null,
        end_time: endTime || null,
        timezone,
        never_expires: neverExpires,
        usage_limit: usageLimit ? Number(usageLimit) : null,
        per_customer_limit: Number(perCustomerLimit) || 1,
        daily_limit: dailyLimit ? Number(dailyLimit) : null,
        monthly_limit: monthlyLimit ? Number(monthlyLimit) : null,
        is_stackable: isStackable,
        is_public: isPublic,
        auto_apply: autoApply,
        delivery_mode: deliveryMode,
        allowed_payment_methods: allowedPaymentMethods,
        min_order_value: Number(minOrderValue) || 0,
        max_discount_value: maxDiscountValue ? Number(maxDiscountValue) : null,
        min_quantity: Number(minQuantity) || 1,
        description: description.trim(),
        applicable_branches: allBranches ? ["all"] : selectedBranches,
        applicable_cities: allCities ? ["all"] : selectedCities,
        applicable_pincodes: parsedPincodes.length > 0 ? parsedPincodes : ["all"],
        excluded_pincodes: parsedExcludedPins,
        applicable_flavors: selectedFlavors,
        applicable_shapes: selectedShapes,
        applicable_weights: selectedWeights,
        customer_eligibility: customerEligibility,
        allowed_phones: parsedPhones,
        allowed_emails: parsedEmails,
        exclude_discounted_items: excludeDiscounted,
        exclude_flash_sales: excludeFlashSales,
        metadata: { discount_value: Number(discountValue) || 10 },
      };

      let res: Response;
      if (couponId) {
        res = await fetch(`/api/v1/admin/offers/${couponId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch("/api/v1/admin/offers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || "Failed to save coupon.");
      }

      showToast(couponId ? "Coupon updated successfully!" : "Enterprise Coupon created!");
      if (onSaveSuccess) onSaveSuccess();
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err: any) {
      showToast(err.message || "Error saving coupon");
    } finally {
      setSaving(false);
    }
  };

  const handleTestPincode = () => {
    if (!testPincode.trim()) return;
    const pin = testPincode.trim();
    const parsedExcluded = excludedPincodesInput.split(",").map((s) => s.trim()).filter(Boolean);
    const parsedAllowed = pincodesInput.split(",").map((s) => s.trim()).filter(Boolean);

    if (parsedExcluded.includes(pin)) {
      setPinTestResult({ valid: false, message: `Pincode ${pin} is EXCLUDED from this promotion.` });
      return;
    }

    if (parsedAllowed.includes("all") || parsedAllowed.length === 0 || parsedAllowed.includes(pin)) {
      setPinTestResult({ valid: true, message: `Pincode ${pin} is ELIGIBLE for this promotion!` });
    } else {
      setPinTestResult({ valid: false, message: `Pincode ${pin} is NOT in the allowed pincode whitelist.` });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm flex justify-end animate-in fade-in duration-200">
      <div className="w-full max-w-4xl bg-slate-900 border-l border-slate-800 text-slate-100 flex flex-col h-full shadow-2xl animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-brand-navy/15 text-brand-gold border border-brand-navy/30">
              <Tag className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">
                  {couponId ? `Configure Coupon: ${code || name}` : "Create Enterprise Promotion"}
                </h2>
                <span
                  className={`px-2 py-0.5 text-xs font-semibold rounded-full uppercase ${
                    status === "active"
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      : status === "scheduled"
                      ? "bg-brand-gold/10 text-brand-gold border border-brand-gold/20"
                      : "bg-slate-800 text-slate-400 border border-slate-700"
                  }`}
                >
                  {status}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Configure enterprise rules, multi-tier geographic restrictions, and usage limits.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-brand-navy hover:bg-brand-deep text-white text-sm font-semibold rounded-lg shadow-md border border-brand-gold/40 transition-all disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? "Saving..." : "Save Coupon"}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toast Alert */}
        {toastMessage && (
          <div className="mx-6 mt-4 p-3 bg-brand-navy/15 border border-brand-navy/40 text-slate-200 rounded-lg text-sm flex items-center gap-2 animate-in fade-in">
            <Sparkles className="w-4 h-4 flex-shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="px-6 border-b border-slate-800 bg-slate-950/40 flex gap-1 overflow-x-auto scrollbar-thin">
          {[
            { id: "general", label: "General", icon: Tag },
            { id: "schedule", label: "Validity & Timers", icon: Clock },
            { id: "restrictions", label: "Cart Rules", icon: ShieldAlert },
            { id: "branches", label: "Branches & Cities", icon: Building },
            { id: "pincodes", label: "Pincodes", icon: MapPin },
            { id: "customers", label: "Customers", icon: Users },
            { id: "products", label: "Products & Flavors", icon: Layers },
            { id: "limits", label: "Usage Limits", icon: BarChart3 },
            { id: "payments", label: "Delivery & Pay", icon: CreditCard },
            { id: "analytics", label: "Performance", icon: TrendingUp },
            { id: "history", label: "Redemptions", icon: History },
            { id: "audit", label: "Audit Logs", icon: FileText },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-1.5 px-3.5 py-3 text-xs font-medium border-b-2 whitespace-nowrap transition-colors ${
                  isActive
                    ? "border-brand-gold text-brand-gold bg-brand-navy/10 font-semibold"
                    : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Drawer Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-3">
              <div className="w-8 h-8 border-2 border-brand-gold border-t-transparent rounded-full animate-spin" />
              <p className="text-sm">Loading promotion configuration...</p>
            </div>
          ) : (
            <>
              {/* TAB 1: GENERAL */}
              {activeTab === "general" && (
                <div className="space-y-5 animate-in fade-in">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">Coupon Name *</label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Monsoon Celebration 50% Off"
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-gold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">Coupon Code *</label>
                      <div className="relative">
                        <input
                          type="text"
                          value={code}
                          onChange={(e) => setCode(e.target.value.toUpperCase())}
                          placeholder="e.g. MONSOON50"
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white uppercase font-mono tracking-wider focus:outline-none focus:border-brand-gold"
                        />
                        <button
                          type="button"
                          onClick={() => setCode(`PROMO${Math.floor(1000 + Math.random() * 9000)}`)}
                          className="absolute right-2 top-2 text-xs text-brand-gold hover:text-slate-200"
                        >
                          Generate
                        </button>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Promotion Type *</label>
                    <select
                      value={type}
                      onChange={(e) => setType(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-gold"
                    >
                      {COUPON_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label} — {t.desc}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        {type === "percentage" ? "Discount Percentage (%) *" : "Discount Amount (₹) *"}
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={discountValue}
                        onChange={(e) => setDiscountValue(Number(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-gold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">Max Discount Cap (₹)</label>
                      <input
                        type="number"
                        min="0"
                        value={maxDiscountValue}
                        onChange={(e) => setMaxDiscountValue(e.target.value ? Number(e.target.value) : "")}
                        placeholder="e.g. 200 (optional)"
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-gold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">Status</label>
                      <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-gold"
                      >
                        <option value="active">Active (Live on store)</option>
                        <option value="scheduled">Scheduled</option>
                        <option value="draft">Draft / Testing</option>
                        <option value="expired">Expired</option>
                        <option value="archived">Archived</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Customer Terms & Description</label>
                    <textarea
                      rows={3}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="e.g. Use code CAKE50 at checkout to get 50% discount on all cakes."
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-gold"
                    />
                  </div>

                  <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoApply}
                        onChange={(e) => setAutoApply(e.target.checked)}
                        className="w-4 h-4 text-brand-gold rounded bg-slate-900 border-slate-700 focus:ring-brand-gold"
                      />
                      <div>
                        <div className="text-xs font-semibold text-white">Auto-Apply at Checkout</div>
                        <div className="text-[11px] text-slate-400">Automatically applies coupon if cart qualifies.</div>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isPublic}
                        onChange={(e) => setIsPublic(e.target.checked)}
                        className="w-4 h-4 text-brand-gold rounded bg-slate-900 border-slate-700 focus:ring-brand-gold"
                      />
                      <div>
                        <div className="text-xs font-semibold text-white">Public Promo Banner</div>
                        <div className="text-[11px] text-slate-400">Show in available coupons drawer on website.</div>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isStackable}
                        onChange={(e) => setIsStackable(e.target.checked)}
                        className="w-4 h-4 text-brand-gold rounded bg-slate-900 border-slate-700 focus:ring-brand-gold"
                      />
                      <div>
                        <div className="text-xs font-semibold text-white">Stackable Promotion</div>
                        <div className="text-[11px] text-slate-400">Can be combined with other offers or free gifts.</div>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={excludeDiscounted}
                        onChange={(e) => setExcludeDiscounted(e.target.checked)}
                        className="w-4 h-4 text-brand-gold rounded bg-slate-900 border-slate-700 focus:ring-brand-gold"
                      />
                      <div>
                        <div className="text-xs font-semibold text-white">Exclude Discounted Items</div>
                        <div className="text-[11px] text-slate-400">Does not apply to products already on sale.</div>
                      </div>
                    </label>
                  </div>
                </div>
              )}

              {/* TAB 2: VALIDITY & TIMERS */}
              {activeTab === "schedule" && (
                <div className="space-y-5 animate-in fade-in">
                  <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-semibold text-white">Never Expires</h4>
                      <p className="text-xs text-slate-400">Enable this for evergreen promotions with no end date.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={neverExpires}
                      onChange={(e) => setNeverExpires(e.target.checked)}
                      className="w-5 h-5 text-brand-gold rounded bg-slate-900 border-slate-700 focus:ring-brand-gold cursor-pointer"
                    />
                  </div>

                  {!neverExpires && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5">Start Date & Time</label>
                        <input
                          type="datetime-local"
                          value={startsAt}
                          onChange={(e) => setStartsAt(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-gold"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5">End Date & Time</label>
                        <input
                          type="datetime-local"
                          value={endsAt}
                          onChange={(e) => setEndsAt(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-gold"
                        />
                      </div>
                    </div>
                  )}

                  <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 space-y-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-white">
                      <Clock className="w-4 h-4 text-brand-gold" />
                      Daily Happy Hour / Time Window Restriction (Optional)
                    </div>
                    <p className="text-xs text-slate-400">
                      Restrict redemption to specific hours (e.g. Evening Rush 18:00 to 22:00 or Afternoon Tea 14:00 to 18:00).
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5">Start Time (HH:mm)</label>
                        <input
                          type="time"
                          value={startTime}
                          onChange={(e) => setStartTime(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-gold"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5">End Time (HH:mm)</label>
                        <input
                          type="time"
                          value={endTime}
                          onChange={(e) => setEndTime(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-gold"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5">Timezone</label>
                        <input
                          type="text"
                          value={timezone}
                          onChange={(e) => setTimezone(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-gold"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: CART RULES & RESTRICTIONS */}
              {activeTab === "restrictions" && (
                <div className="space-y-5 animate-in fade-in">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">Minimum Order Subtotal (₹)</label>
                      <input
                        type="number"
                        min="0"
                        value={minOrderValue}
                        onChange={(e) => setMinOrderValue(Number(e.target.value))}
                        placeholder="e.g. 499"
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-gold"
                      />
                      <p className="text-[11px] text-slate-400 mt-1">Cart value before taxes and discounts.</p>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">Minimum Items in Cart</label>
                      <input
                        type="number"
                        min="1"
                        value={minQuantity}
                        onChange={(e) => setMinQuantity(Number(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-gold"
                      />
                      <p className="text-[11px] text-slate-400 mt-1">Total quantity of products required in cart.</p>
                    </div>
                  </div>

                  <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 space-y-3">
                    <h4 className="text-sm font-semibold text-white">Exclusions</h4>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={excludeFlashSales}
                        onChange={(e) => setExcludeFlashSales(e.target.checked)}
                        className="w-4 h-4 text-brand-gold rounded bg-slate-900 border-slate-700 focus:ring-brand-gold"
                      />
                      <div>
                        <div className="text-xs font-semibold text-white">Exclude Flash Sale Items</div>
                        <div className="text-[11px] text-slate-400">Coupon cannot be applied to special flash sale deals.</div>
                      </div>
                    </label>
                  </div>
                </div>
              )}

              {/* TAB 4: BRANCHES & CITIES */}
              {activeTab === "branches" && (
                <div className="space-y-5 animate-in fade-in">
                  <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-semibold text-white">Branch Eligibility</h4>
                        <p className="text-xs text-slate-400">Select which fulfillment kitchen branches can accept this coupon.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setAllBranches(!allBranches);
                          if (!allBranches) setSelectedBranches([]);
                        }}
                        className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                          allBranches ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-slate-800 text-slate-400"
                        }`}
                      >
                        {allBranches ? "All Branches Allowed" : "Specific Branches Only"}
                      </button>
                    </div>

                    {!allBranches && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                        {BRANCH_OPTIONS.map((b) => {
                          const isChecked = selectedBranches.includes(b.id);
                          return (
                            <label
                              key={b.id}
                              className={`p-3 rounded-lg border flex items-center justify-between cursor-pointer transition-all ${
                                isChecked
                                  ? "bg-brand-navy/15 border-brand-navy/50 text-slate-200"
                                  : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(e) => {
                                    if (e.target.checked) setSelectedBranches([...selectedBranches, b.id]);
                                    else setSelectedBranches(selectedBranches.filter((x) => x !== b.id));
                                  }}
                                  className="w-4 h-4 text-brand-gold rounded bg-slate-950 border-slate-700"
                                />
                                <div>
                                  <div className="text-xs font-semibold text-white">{b.name}</div>
                                  <div className="text-[10px] text-slate-400">{b.city}</div>
                                </div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-semibold text-white">City Restrictions</h4>
                        <p className="text-xs text-slate-400">Limit coupon redemption to customers ordering within specific cities.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setAllCities(!allCities);
                          if (!allCities) setSelectedCities([]);
                        }}
                        className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                          allCities ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-slate-800 text-slate-400"
                        }`}
                      >
                        {allCities ? "All Cities Allowed" : "Specific Cities Only"}
                      </button>
                    </div>

                    {!allCities && (
                      <div className="flex flex-wrap gap-2 pt-2">
                        {["Kollam", "Kochi", "Trivandrum", "Kozhikode", "Thrissur"].map((cityName) => {
                          const isSel = selectedCities.includes(cityName);
                          return (
                            <button
                              key={cityName}
                              type="button"
                              onClick={() => {
                                if (isSel) setSelectedCities(selectedCities.filter((c) => c !== cityName));
                                else setSelectedCities([...selectedCities, cityName]);
                              }}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                                isSel
                                  ? "bg-brand-navy/20 text-slate-200 border-brand-navy/50 shadow-sm"
                                  : "bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700"
                              }`}
                            >
                              {cityName} {isSel && "✓"}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 5: PINCODES */}
              {activeTab === "pincodes" && (
                <div className="space-y-5 animate-in fade-in">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Allowed Pincodes Whitelist</label>
                    <textarea
                      rows={3}
                      value={pincodesInput}
                      onChange={(e) => setPincodesInput(e.target.value)}
                      placeholder="e.g. 691001, 691002, 691003 or 'all'"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-brand-gold"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">Separate 6-digit Indian pincodes with commas, or write &apos;all&apos;.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Excluded Pincodes Blacklist (Optional)</label>
                    <textarea
                      rows={2}
                      value={excludedPincodesInput}
                      onChange={(e) => setExcludedPincodesInput(e.target.value)}
                      placeholder="e.g. 691020, 691021"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-brand-gold"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">These pincodes will be rejected even if city or branch matches.</p>
                  </div>

                  {/* Pincode Live Test Tool */}
                  <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800 space-y-3">
                    <h4 className="text-xs font-semibold text-slate-200 flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-brand-gold" />
                      Live Pincode Verification Simulator
                    </h4>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        maxLength={6}
                        value={testPincode}
                        onChange={(e) => setTestPincode(e.target.value)}
                        placeholder="Enter 6-digit pincode e.g. 691001"
                        className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono"
                      />
                      <button
                        type="button"
                        onClick={handleTestPincode}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700"
                      >
                        Verify Pincode
                      </button>
                    </div>

                    {pinTestResult && (
                      <div
                        className={`p-2.5 rounded-lg text-xs font-medium flex items-center gap-2 ${
                          pinTestResult.valid
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                            : "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                        }`}
                      >
                        {pinTestResult.valid ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                        <span>{pinTestResult.message}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 6: CUSTOMER RESTRICTIONS */}
              {activeTab === "customers" && (
                <div className="space-y-5 animate-in fade-in">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Customer Tier Eligibility</label>
                    <select
                      value={customerEligibility}
                      onChange={(e) => setCustomerEligibility(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-gold"
                    >
                      <option value="all">Everyone (All registered and guest customers)</option>
                      <option value="new_customers">New Customers Only (First order only)</option>
                      <option value="returning">Returning Repeat Customers</option>
                      <option value="vip">VIP Platinum Club Members</option>
                      <option value="wholesale">Wholesale & Corporate Accounts</option>
                      <option value="loyalty_tier">Gold / Diamond Loyalty Tier Members</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">Whitelist Allowed Phone Numbers</label>
                      <textarea
                        rows={3}
                        value={allowedPhonesInput}
                        onChange={(e) => setAllowedPhonesInput(e.target.value)}
                        placeholder="e.g. +91 9876543210, +91 9876543211"
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-brand-gold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">Whitelist Allowed Email Addresses</label>
                      <textarea
                        rows={3}
                        value={allowedEmailsInput}
                        onChange={(e) => setAllowedEmailsInput(e.target.value)}
                        placeholder="e.g. vip@customer.com, ceo@corporate.com"
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-brand-gold"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 7: PRODUCT & FLAVORS */}
              {activeTab === "products" && (
                <div className="space-y-5 animate-in fade-in">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-2">Restricted Flavors (Optional)</label>
                    <div className="flex flex-wrap gap-2">
                      {FLAVORS.map((flavor) => {
                        const isSel = selectedFlavors.includes(flavor);
                        return (
                          <button
                            key={flavor}
                            type="button"
                            onClick={() => {
                              if (isSel) setSelectedFlavors(selectedFlavors.filter((f) => f !== flavor));
                              else setSelectedFlavors([...selectedFlavors, flavor]);
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                              isSel
                                ? "bg-brand-navy/20 text-slate-200 border-brand-navy/50"
                                : "bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700"
                            }`}
                          >
                            {flavor} {isSel && "✓"}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-2">Restricted Cake Shapes (Optional)</label>
                    <div className="flex flex-wrap gap-2">
                      {SHAPES.map((shape) => {
                        const isSel = selectedShapes.includes(shape);
                        return (
                          <button
                            key={shape}
                            type="button"
                            onClick={() => {
                              if (isSel) setSelectedShapes(selectedShapes.filter((s) => s !== shape));
                              else setSelectedShapes([...selectedShapes, shape]);
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                              isSel
                                ? "bg-brand-navy/20 text-slate-200 border-brand-navy/50"
                                : "bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700"
                            }`}
                          >
                            {shape} {isSel && "✓"}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-2">Restricted Weight Variants (Optional)</label>
                    <div className="flex flex-wrap gap-2">
                      {WEIGHTS.map((weight) => {
                        const isSel = selectedWeights.includes(weight);
                        return (
                          <button
                            key={weight}
                            type="button"
                            onClick={() => {
                              if (isSel) setSelectedWeights(selectedWeights.filter((w) => w !== weight));
                              else setSelectedWeights([...selectedWeights, weight]);
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                              isSel
                                ? "bg-brand-navy/20 text-slate-200 border-brand-navy/50"
                                : "bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700"
                            }`}
                          >
                            {weight} {isSel && "✓"}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 8: USAGE LIMITS */}
              {activeTab === "limits" && (
                <div className="space-y-5 animate-in fade-in">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">Global Total Usage Limit</label>
                      <input
                        type="number"
                        min="1"
                        value={usageLimit}
                        onChange={(e) => setUsageLimit(e.target.value ? Number(e.target.value) : "")}
                        placeholder="e.g. 1000 (leave blank for unlimited)"
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-gold"
                      />
                      <p className="text-[11px] text-slate-400 mt-1">Total redemptions allowed across all customers before auto-expiring.</p>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">Per-Customer Redemption Limit</label>
                      <input
                        type="number"
                        min="1"
                        value={perCustomerLimit}
                        onChange={(e) => setPerCustomerLimit(Number(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-gold"
                      />
                      <p className="text-[11px] text-slate-400 mt-1">Max times each individual phone number/account can use this code.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">Daily Usage Cap (Auto-Resetting)</label>
                      <input
                        type="number"
                        min="1"
                        value={dailyLimit}
                        onChange={(e) => setDailyLimit(e.target.value ? Number(e.target.value) : "")}
                        placeholder="e.g. 50 per day"
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-gold"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">Monthly Usage Cap</label>
                      <input
                        type="number"
                        min="1"
                        value={monthlyLimit}
                        onChange={(e) => setMonthlyLimit(e.target.value ? Number(e.target.value) : "")}
                        placeholder="e.g. 500 per month"
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-gold"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 9: DELIVERY & PAYMENT RESTRICTIONS */}
              {activeTab === "payments" && (
                <div className="space-y-5 animate-in fade-in">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Fulfillment Mode Restriction</label>
                    <select
                      value={deliveryMode}
                      onChange={(e) => setDeliveryMode(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-gold"
                    >
                      <option value="all">Both Home Delivery & Counter Pickup</option>
                      <option value="delivery">Home Doorstep Delivery Only</option>
                      <option value="pickup">Bakery Counter Pickup Only</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-2">Allowed Payment Methods</label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {PAYMENT_METHODS.map((pm) => {
                        const isChecked = allowedPaymentMethods.includes(pm.id);
                        return (
                          <label
                            key={pm.id}
                            className={`p-3 rounded-lg border flex items-center justify-between cursor-pointer transition-all ${
                              isChecked
                                ? "bg-brand-navy/15 border-brand-navy/50 text-slate-200"
                                : "bg-slate-900 border-slate-800 text-slate-400"
                            }`}
                          >
                            <span className="text-xs font-medium">{pm.label}</span>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) setAllowedPaymentMethods([...allowedPaymentMethods, pm.id]);
                                else setAllowedPaymentMethods(allowedPaymentMethods.filter((x) => x !== pm.id));
                              }}
                              className="w-4 h-4 text-brand-gold rounded bg-slate-950 border-slate-700"
                            />
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 10: ANALYTICS & PERFORMANCE */}
              {activeTab === "analytics" && (
                <div className="space-y-5 animate-in fade-in">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800">
                      <div className="text-xs text-slate-400">Total Redemptions</div>
                      <div className="text-xl font-bold text-white mt-1">{totalRedemptions}</div>
                    </div>
                    <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800">
                      <div className="text-xs text-slate-400">Gross Sales Revenue</div>
                      <div className="text-xl font-bold text-emerald-400 mt-1">₹{totalRevenue.toLocaleString()}</div>
                    </div>
                    <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800">
                      <div className="text-xs text-slate-400">Total Discount Given</div>
                      <div className="text-xl font-bold text-rose-400 mt-1">₹{totalDiscountGiven.toLocaleString()}</div>
                    </div>
                    <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800">
                      <div className="text-xs text-slate-400">Marketing ROI</div>
                      <div className="text-xl font-bold text-brand-primary mt-1">
                        {totalDiscountGiven > 0 ? `${Math.round(((totalRevenue - totalDiscountGiven) / totalDiscountGiven) * 100)}%` : "N/A"}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 11: CUSTOMER REDEMPTION HISTORY */}
              {activeTab === "history" && (
                <div className="space-y-4 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-white">Customer Usage Log</h4>
                    <span className="text-xs text-slate-400">{redemptionsList.length} total redemptions</span>
                  </div>

                  {redemptionsList.length === 0 ? (
                    <div className="p-8 text-center bg-slate-950/40 rounded-xl border border-slate-800 text-slate-400 text-sm">
                      No redemptions recorded for this coupon yet.
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-800">
                      <table className="w-full text-left text-xs text-slate-300">
                        <thead className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800">
                          <tr>
                            <th className="px-3 py-2.5">Date</th>
                            <th className="px-3 py-2.5">Customer</th>
                            <th className="px-3 py-2.5">Order #</th>
                            <th className="px-3 py-2.5">Branch / City</th>
                            <th className="px-3 py-2.5 text-right">Discount</th>
                            <th className="px-3 py-2.5 text-right">Order Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 bg-slate-900/60">
                          {redemptionsList.map((r, idx) => (
                            <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                              <td className="px-3 py-2.5 text-slate-400">{new Date(r.created_at || Date.now()).toLocaleDateString()}</td>
                              <td className="px-3 py-2.5 font-medium text-white">{r.customer_phone || r.customer_id || "Guest User"}</td>
                              <td className="px-3 py-2.5 font-mono text-brand-gold">{r.order_number || r.order_id || "—"}</td>
                              <td className="px-3 py-2.5">{r.branch_name || r.city || "Kollam"}</td>
                              <td className="px-3 py-2.5 text-right font-semibold text-rose-400">₹{r.discount_amount}</td>
                              <td className="px-3 py-2.5 text-right font-semibold text-emerald-400">₹{r.order_total}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 12: AUDIT LOGS */}
              {activeTab === "audit" && (
                <div className="space-y-4 animate-in fade-in">
                  <h4 className="text-sm font-semibold text-white">Administrative Audit Trail</h4>
                  {auditLogsList.length === 0 ? (
                    <div className="p-8 text-center bg-slate-950/40 rounded-xl border border-slate-800 text-slate-400 text-sm">
                      No administrative changes recorded yet.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {auditLogsList.map((log, idx) => (
                        <div key={idx} className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold uppercase text-brand-gold">{log.action}</span>
                              <span className="text-slate-400">by {log.actor_email || log.actor_id || "Admin"}</span>
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">IP: {log.ip_address || "127.0.0.1"}</div>
                          </div>
                          <div className="text-slate-400 text-[11px]">{new Date(log.created_at).toLocaleString()}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-950/90 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            {couponId ? `ID: ${couponId}` : "Creating new promo configuration"}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 bg-brand-navy hover:bg-brand-deep text-white text-xs font-semibold rounded-lg shadow-md border border-brand-gold/40 transition-all disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? "Saving Changes..." : "Save & Publish"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
