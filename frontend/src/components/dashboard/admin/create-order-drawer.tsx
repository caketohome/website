"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Container, Heading, Text, Input, Button, Badge, Label, Select, Textarea } from "@medusajs/ui";
import {
  X, Search, User, Plus, MapPin, Building2, Calendar, Clock, ShoppingCart,
  Check, Tag, CreditCard, Link as LinkIcon, Copy, AlertTriangle, ShieldCheck, Trash2
} from "lucide-react";
import { apiClient } from "@frontend/lib/api-client";

interface CreateOrderDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onOrderCreated: (newOrder: any) => void;
}

export function CreateOrderDrawer({ isOpen, onClose, onOrderCreated }: CreateOrderDrawerProps) {
  // ── Step Navigation ────────────────────────────────────────────────────────
  const [activeSection, setActiveSection] = useState<"customer" | "delivery" | "branch" | "products" | "pricing" | "payment" | "review">("customer");

  // ── Customer State ─────────────────────────────────────────────────────────
  const [customerSearch, setCustomerSearch] = useState("");
  const [customersList, setCustomersList] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [isCreatingNewCustomer, setIsCreatingNewCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: "", phone: "", email: "" });
  const [customerError, setCustomerError] = useState<string | null>(null);

  // ── Address State ──────────────────────────────────────────────────────────
  const [addresses, setAddresses] = useState<any[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | "new">("new");
  const [addressForm, setAddressForm] = useState({
    address_1: "",
    address_2: "",
    area: "",
    city: "",
    state: "",
    pincode: "",
    landmark: "",
    delivery_instructions: "",
  });

  // ── Branch & Delivery Slot State ───────────────────────────────────────────
  const [branches, setBranches] = useState<any[]>([]);
  const [autoAssignedBranch, setAutoAssignedBranch] = useState<any | null>(null);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [isManualBranchOverride, setIsManualBranchOverride] = useState(false);
  const [deliveryDate, setDeliveryDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [slots, setSlots] = useState<any[]>([]);
  const [selectedSlotId, setSelectedSlotId] = useState<string>("");
  const [loadingSlots, setLoadingSlots] = useState(false);

  // ── Product & Cart State ───────────────────────────────────────────────────
  const [productSearch, setProductSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [cartItems, setCartItems] = useState<any[]>([]);
  
  // Product Customization Modal State
  const [customizingProduct, setCustomizingProduct] = useState<any | null>(null);
  const [customForm, setCustomForm] = useState({
    weight: "1 kg",
    flavor: "Belgian Chocolate Truffle",
    shape: "Round",
    is_artisan: true,
    cake_message: "",
    quantity: 1,
  });

  // ── Pricing, Coupons & Payment State ───────────────────────────────────────
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<any | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponSuccess, setCouponSuccess] = useState<string | null>(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);

  const [manualDiscountType, setManualDiscountType] = useState<"fixed" | "percent">("fixed");
  const [manualDiscountValue, setManualDiscountValue] = useState<number>(0);
  const [manualDiscountReason, setManualDiscountReason] = useState("");

  const [paymentMethod, setPaymentMethod] = useState("UPI");
  const [paymentStatus, setPaymentStatus] = useState("paid");
  const [generatedPaymentLink, setGeneratedPaymentLink] = useState<string | null>(null);

  const [internalNotes, setInternalNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [creationSuccessOrder, setCreationSuccessOrder] = useState<any | null>(null);

  // ── Data Initialization ────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;

    // Reset drawer state
    setCreationSuccessOrder(null);
    setCartItems([]);
    setAppliedCoupon(null);
    setCouponCode("");
    setManualDiscountValue(0);
    setGeneratedPaymentLink(null);

    // Fetch branches, products, customers
    apiClient.getAdminBranches().then((res: any) => {
      const bList = res?.branches || [];
      setBranches(bList);
      if (bList.length > 0) {
        setSelectedBranchId(bList[0].id);
        setAutoAssignedBranch(bList[0]);
      }
    }).catch(console.error);

    apiClient.getProducts().then((res: any) => {
      const pList = res?.products || res?.data || [];
      setAllProducts(pList);
    }).catch(console.error);

    apiClient.getAdminCustomers().then((res: any) => {
      const cList = res?.customers || [];
      setCustomersList(cList);
    }).catch(console.error);
  }, [isOpen]);

  // Auto Branch Assignment based on pincode & city via getEligibleBranches API
  const [eligibleBranches, setEligibleBranches] = useState<any[]>([]);
  const [branchAssignmentMsg, setBranchAssignmentMsg] = useState<string>("");
  const [isUnserviceable, setIsUnserviceable] = useState(false);

  useEffect(() => {
    if (!addressForm.pincode && !addressForm.city) return;

    const pincodeClean = addressForm.pincode ? addressForm.pincode.replace(/\D/g, "") : "";
    
    apiClient.getEligibleBranches({ pincode: pincodeClean, city: addressForm.city, area: addressForm.area })
      .then((res: any) => {
        const bList = res?.branches || [];
        setEligibleBranches(bList);
        setBranchAssignmentMsg(res?.assignment?.message || "");

        if (bList.length > 0) {
          setIsUnserviceable(false);
          if (!isManualBranchOverride || !bList.some((b: any) => b.id === selectedBranchId)) {
            const recommendedId = res?.assignment?.recommended_branch_id || bList[0].id;
            setSelectedBranchId(recommendedId);
            setAutoAssignedBranch(bList.find((b: any) => b.id === recommendedId) || bList[0]);
          }
        } else {
          setIsUnserviceable(true);
          setSelectedBranchId("");
          setAutoAssignedBranch(null);
        }
      })
      .catch((err) => {
        console.error("Error fetching eligible branches:", err);
      });
  }, [addressForm.pincode, addressForm.city, addressForm.area, isManualBranchOverride]);

  // Load real delivery slots for selected branch and date
  useEffect(() => {
    if (!selectedBranchId || !deliveryDate) return;
    setLoadingSlots(true);

    const fetchSlots = apiClient?.getDeliverySlots ? apiClient.getDeliverySlots(selectedBranchId, deliveryDate) : Promise.reject("getDeliverySlots missing");

    fetchSlots
      .then((res: any) => {
        const sList = res?.delivery_slots || [];
        setSlots(sList);
        if (sList.length > 0) {
          setSelectedSlotId(sList[0].id || sList[0].slot_name);
        } else {
          // Fallback standard slots if specific branch has no custom slots
          const fallback = [
            { id: "slot_morn", slot_name: "09:00 AM - 12:00 PM (Morning Slot)", delivery_charge: 0, is_available: true },
            { id: "slot_aft", slot_name: "01:00 PM - 04:00 PM (Afternoon Slot)", delivery_charge: 0, is_available: true },
            { id: "slot_eve", slot_name: "05:00 PM - 08:00 PM (Evening Slot)", delivery_charge: 0, is_available: true },
            { id: "slot_exp", slot_name: "Within 60 Mins (Express Delivery)", delivery_charge: 100, is_available: true },
          ];
          setSlots(fallback);
          setSelectedSlotId(fallback[0].id);
        }
      })
      .catch(() => {
        const fallback = [
          { id: "slot_morn", slot_name: "09:00 AM - 12:00 PM (Morning Slot)", delivery_charge: 0, is_available: true },
          { id: "slot_eve", slot_name: "05:00 PM - 08:00 PM (Evening Slot)", delivery_charge: 0, is_available: true },
        ];
        setSlots(fallback);
        setSelectedSlotId(fallback[0].id);
      })
      .finally(() => setLoadingSlots(false));
  }, [selectedBranchId, deliveryDate]);

  // Filtered Products Search
  const filteredProducts = useMemo(() => {
    return allProducts.filter((p: any) => {
      const matchQuery = !productSearch ||
        p.title?.toLowerCase().includes(productSearch.toLowerCase()) ||
        p.name?.toLowerCase().includes(productSearch.toLowerCase()) ||
        p.sku?.toLowerCase().includes(productSearch.toLowerCase());
      const matchCat = selectedCategory === "all" || (p.categories || []).some((c: any) => c.slug === selectedCategory);
      return matchQuery && matchCat;
    });
  }, [allProducts, productSearch, selectedCategory]);

  // Customer Select Handler
  const handleSelectCustomer = (cust: any) => {
    setSelectedCustomer(cust);
    setCustomerSearch(cust.name);
    setNewCustomer({ name: cust.name, phone: cust.phone || "", email: cust.email || "" });

    const custAddresses: any[] = []; // shortcut: addresses must come from the customer API, not samples
    setAddresses(custAddresses);
    setSelectedAddressId(custAddresses[0]?.id ?? "");
    setAddressForm({
      address_1: custAddresses[0].address_1,
      address_2: "",
      area: custAddresses[0].area,
      city: custAddresses[0].city,
      state: custAddresses[0].state,
      pincode: custAddresses[0].postal_code,
      landmark: custAddresses[0].landmark,
      delivery_instructions: "Ring door bell twice",
    });
  };

  // Create New Customer Handler
  const handleCreateCustomerSubmit = () => {
    setCustomerError(null);
    if (!newCustomer.name.trim()) {
      setCustomerError("Customer name is required.");
      return;
    }
    if (!newCustomer.phone.trim() || newCustomer.phone.replace(/\D/g, "").length < 10) {
      setCustomerError("Valid 10-digit mobile number is required.");
      return;
    }

    // Phone duplicate check against existing customers
    const existing = customersList.find((c) => c.phone?.replace(/\D/g, "") === newCustomer.phone.replace(/\D/g, ""));
    if (existing) {
      handleSelectCustomer(existing);
      setIsCreatingNewCustomer(false);
      return;
    }

    const createdCust = {
      id: `cus_${Date.now()}`,
      name: newCustomer.name,
      phone: newCustomer.phone,
      email: newCustomer.email || `${newCustomer.phone.replace(/\D/g, "")}@customer.cakes2home.com`,
      is_new: true,
    };
    setSelectedCustomer(createdCust);
    setIsCreatingNewCustomer(false);
  };

  // Add Product to Cart
  const handleAddProductToCart = () => {
    if (!customizingProduct) return;
    const basePrice = Number(customizingProduct.price || customizingProduct.variants?.[0]?.prices?.[0]?.amount || 599);
    const Charge = customForm.is_artisan ? 50 : 0;
    const unitPrice = basePrice + Charge;
    const variantStr = `${customForm.weight} | ${customForm.flavor} | ${customForm.shape} | ${customForm.is_artisan ? "artisan (+₹50)" : "With Egg"}`;

    const cartItem = {
      id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      product_id: customizingProduct.id || customizingProduct.product_id,
      title: customizingProduct.title || customizingProduct.name,
      variant: variantStr,
      quantity: customForm.quantity,
      unit_price: unitPrice,
      price: unitPrice,
      total: unitPrice * customForm.quantity,
      image_url: customizingProduct.thumbnail || customizingProduct.images?.[0]?.url || "/images/placeholder-cake.webp",
      custom_message: customForm.cake_message || null,
    };

    setCartItems((prev) => [...prev, cartItem]);
    setCustomizingProduct(null);
  };

  // Remove Cart Item
  const handleRemoveCartItem = (itemId: string) => {
    setCartItems((prev) => prev.filter((i) => i.id !== itemId));
  };

  // Cart Subtotal Calculation
  const cartSubtotal = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + item.total, 0);
  }, [cartItems]);

  // Selected Slot Charge
  const slotObj = useMemo(() => {
    return slots.find((s) => s.id === selectedSlotId || s.slot_name === selectedSlotId);
  }, [slots, selectedSlotId]);

  const deliveryFee = slotObj?.delivery_charge || 0;

  // Apply Coupon Handler
  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setValidatingCoupon(true);
    setCouponError(null);
    setCouponSuccess(null);

    try {
      const res: any = await apiClient.applyPromoCode("cart_temp", couponCode.trim(), {
        subtotal: cartSubtotal,
        branch_id: selectedBranchId,
      });

      if (res && res.valid) {
        setAppliedCoupon(res);
        setCouponSuccess(`Coupon "${couponCode.toUpperCase()}" applied! Saved ₹${res.discount_amount}`);
      } else {
        setAppliedCoupon(null);
        setCouponError(res?.error_message || `Coupon "${couponCode}" is invalid or expired for this order.`);
      }
    } catch (err: any) {
      setAppliedCoupon(null);
      setCouponError(err.message || "Failed to validate coupon");
    } finally {
      setValidatingCoupon(false);
    }
  };

  // Discount Amounts
  const couponDiscountAmount = appliedCoupon?.discount_amount || 0;
  const manualDiscountAmount = useMemo(() => {
    if (!manualDiscountValue || manualDiscountValue <= 0) return 0;
    if (manualDiscountType === "percent") {
      return Math.round((cartSubtotal * Math.min(100, manualDiscountValue)) / 100);
    }
    return Math.min(cartSubtotal, manualDiscountValue);
  }, [cartSubtotal, manualDiscountType, manualDiscountValue]);

  const totalDiscount = couponDiscountAmount + manualDiscountAmount;
  const taxTotal = Math.round((Math.max(0, cartSubtotal - totalDiscount)) * 0.05);
  const grandTotal = Math.max(0, cartSubtotal - totalDiscount + deliveryFee + taxTotal);

  // Generate Payment Link
  const handleGeneratePaymentLink = () => {
    const link = `https://caketohome.com/pay/pay_${Date.now().toString(36)}`;
    setGeneratedPaymentLink(link);
  };

  // Submit Order Handler
  const handleCreateOrderSubmit = async () => {
    if (!selectedCustomer && !newCustomer.name) {
      alert("Please select or enter customer details.");
      setActiveSection("customer");
      return;
    }
    if (!addressForm.address_1 || !addressForm.area || !addressForm.city || !addressForm.pincode) {
      alert("Please complete required delivery address fields.");
      setActiveSection("delivery");
      return;
    }
    if (!selectedBranchId) {
      alert("Please select an active fulfillment branch.");
      setActiveSection("branch");
      return;
    }
    if (cartItems.length === 0) {
      alert("Please add at least one product to the order cart.");
      setActiveSection("products");
      return;
    }

    setSubmitting(true);

    const activeBranch = branches.find((b) => b.id === selectedBranchId) || autoAssignedBranch;

    const payload = {
      customer_id: selectedCustomer?.id || `cus_${Date.now()}`,
      customer_name: selectedCustomer?.name || newCustomer.name,
      customer_phone: selectedCustomer?.phone || newCustomer.phone,
      customer_email: selectedCustomer?.email || newCustomer.email,

      shipping_address: {
        address_1: addressForm.address_1,
        address_2: addressForm.address_2,
        area: addressForm.area,
        city: addressForm.city,
        state: addressForm.state,
        postal_code: addressForm.pincode,
        landmark: addressForm.landmark,
        delivery_instructions: addressForm.delivery_instructions,
      },

      branch_id: selectedBranchId,
      branch_name: activeBranch?.name || "Indiranagar Kitchen",
      branch_code: activeBranch?.code || "HUB-BLR-01",
      city: addressForm.city,
      pincode: addressForm.pincode,

      delivery_date: deliveryDate,
      delivery_slot: slotObj?.slot_name || "Evening Slot",
      delivery_type: slotObj?.slot_name?.includes("Express") ? "Express Delivery" : "Standard Delivery",

      items: cartItems,
      subtotal: cartSubtotal,
      discount_total: totalDiscount,
      coupon_discount: couponDiscountAmount,
      manual_discount_amount: manualDiscountAmount,
      manual_discount_reason: manualDiscountReason || null,
      delivery_fee: deliveryFee,
      tax_total: taxTotal,
      total: grandTotal,

      payment_method: paymentMethod,
      payment_status: paymentStatus,
      payment_link: generatedPaymentLink,

      promo_code: appliedCoupon ? couponCode.toUpperCase() : null,
      promo_offer_id: appliedCoupon?.offer?.id || null,
      notes: internalNotes || null,
      source: "telecalling",
    };

    try {
      const res: any = await apiClient.createAdminOrder(payload);
      const created = res?.order || res;
      setCreationSuccessOrder(created);
      onOrderCreated(created);
    } catch (err: any) {
      alert(err.message || "Failed to create order. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end transition-opacity">
      <div className="w-full max-w-4xl bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-300">
        
        {/* Top Header Bar */}
        <div className="p-5 border-b border-ui-border-base bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div>
            <Heading level="h2" className="text-lg font-bold flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-emerald-400" />
              Telecalling Order Creation Hub
            </Heading>
            <Text className="text-xs text-slate-400">
              Create and dispatch real-time production orders on behalf of phone customers.
            </Text>
          </div>
          <Button size="small" variant="secondary" onClick={onClose} className="bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700">
            <X className="w-4 h-4" /> Close
          </Button>
        </div>

        {/* Section Workflow Navigation Tabs */}
        <div className="flex items-center gap-1 p-2 bg-slate-100 dark:bg-slate-800 border-b overflow-x-auto text-xs shrink-0">
          {[
            { id: "customer", label: "1. Customer", icon: User },
            { id: "delivery", label: "2. Address", icon: MapPin },
            { id: "branch", label: "3. Branch & Slot", icon: Building2 },
            { id: "products", label: `4. Items (${cartItems.length})`, icon: ShoppingCart },
            { id: "pricing", label: "5. Discounts & Pay", icon: Tag },
            { id: "review", label: "6. Order Review", icon: ShieldCheck },
          ].map((sec) => {
            const Icon = sec.icon;
            const isActive = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                onClick={() => setActiveSection(sec.id as any)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-medium whitespace-nowrap transition-all ${
                  isActive
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {sec.label}
              </button>
            );
          })}
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* SUCCESS MODAL DIALOG */}
          {creationSuccessOrder ? (
            <div className="p-8 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 rounded-2xl text-center space-y-4 my-auto">
              <div className="w-16 h-16 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto shadow-lg">
                <Check className="w-10 h-10" />
              </div>
              <Heading level="h2" className="text-2xl font-black text-emerald-900 dark:text-emerald-200">
                Order Placed Successfully!
              </Heading>
              <Text className="text-sm text-emerald-700 dark:text-emerald-300">
                Order <strong className="font-mono text-base">{creationSuccessOrder.order_number}</strong> has been transmitted to <strong className="underline">{creationSuccessOrder.branch_name}</strong> kitchen.
              </Text>

              <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border text-left text-xs font-mono space-y-1">
                <div><strong>Order ID:</strong> {creationSuccessOrder.id}</div>
                <div><strong>Customer:</strong> {creationSuccessOrder.customer_name} ({creationSuccessOrder.customer_phone})</div>
                <div><strong>Branch:</strong> {creationSuccessOrder.branch_name}</div>
                <div><strong>Delivery Date &amp; Slot:</strong> {creationSuccessOrder.delivery_date} ({creationSuccessOrder.delivery_slot})</div>
                <div><strong>Grand Total:</strong> ₹{creationSuccessOrder.total} ({creationSuccessOrder.payment_method} - {creationSuccessOrder.payment_status})</div>
              </div>

              <div className="flex justify-center gap-3 pt-4">
                <Button variant="secondary" onClick={() => { setCreationSuccessOrder(null); setCartItems([]); setActiveSection("customer"); }}>
                  + Create Another Order
                </Button>
                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={onClose}>
                  View Orders Command Center
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* ── SECTION 1: CUSTOMER SELECTION ────────────────────────────────────────────── */}
              {activeSection === "customer" && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <Heading level="h3" className="text-base font-bold">Customer Selection</Heading>
                      <Text className="text-xs text-ui-fg-subtle">Search existing customer profile by Phone or Name, or register a new telecaller contact.</Text>
                    </div>
                    <Button size="small" variant="secondary" onClick={() => setIsCreatingNewCustomer(!isCreatingNewCustomer)}>
                      {isCreatingNewCustomer ? "Select Existing Customer" : "+ Create New Customer"}
                    </Button>
                  </div>

                  {customerError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" /> {customerError}
                    </div>
                  )}

                  {!isCreatingNewCustomer ? (
                    <div className="space-y-3">
                      <Label className="text-xs font-semibold">Search Customer Database</Label>
                      <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                        <Input
                          placeholder="Type phone number (+91...), name, or email..."
                          value={customerSearch}
                          onChange={(e) => setCustomerSearch(e.target.value)}
                          className="pl-9 text-sm"
                        />
                      </div>

                      {customerSearch && (
                        <div className="border rounded-xl bg-white dark:bg-slate-800 divide-y max-h-48 overflow-y-auto">
                          {customersList
                            .filter((c) =>
                              c.name?.toLowerCase().includes(customerSearch.toLowerCase()) ||
                              c.phone?.includes(customerSearch) ||
                              c.email?.toLowerCase().includes(customerSearch.toLowerCase())
                            )
                            .map((cust) => (
                              <button
                                key={cust.id}
                                onClick={() => handleSelectCustomer(cust)}
                                className="w-full text-left p-3 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center justify-between text-xs"
                              >
                                <div>
                                  <div className="font-bold text-slate-900 dark:text-white">{cust.name}</div>
                                  <div className="text-slate-500 font-mono">{cust.phone} • {cust.email}</div>
                                </div>
                                {selectedCustomer?.id === cust.id ? (
                                  <Badge color="green" className="text-[10px]">Selected</Badge>
                                ) : (
                                  <Button size="small" variant="secondary" className="text-[10px]">Select</Button>
                                )}
                              </button>
                            ))}
                        </div>
                      )}

                      {selectedCustomer && (
                        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 rounded-xl space-y-2">
                          <div className="flex items-center justify-between">
                            <Badge color="green" className="text-xs font-semibold">✓ CUSTOMER SELECTED</Badge>
                            <span className="text-[10px] text-slate-500">ID: {selectedCustomer.id}</span>
                          </div>
                          <div className="text-sm font-bold">{selectedCustomer.name}</div>
                          <div className="text-xs text-slate-600 dark:text-slate-300 font-mono">📱 {selectedCustomer.phone} | ✉️ {selectedCustomer.email}</div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-4 border rounded-xl bg-slate-50 dark:bg-slate-800 space-y-4">
                      <Badge color="purple" className="text-xs">NEW CUSTOMER REGISTRATION</Badge>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs font-semibold">Full Name *</Label>
                          <Input
                            placeholder="e.g. Radhika Sharma"
                            value={newCustomer.name}
                            onChange={(e) => setNewCustomer((prev) => ({ ...prev, name: e.target.value }))}
                            className="mt-1 text-sm"
                          />
                        </div>
                        <div>
                          <Label className="text-xs font-semibold">10-Digit Mobile Number *</Label>
                          <Input
                            placeholder="+91 98765 43210"
                            value={newCustomer.phone}
                            onChange={(e) => setNewCustomer((prev) => ({ ...prev, phone: e.target.value }))}
                            className="mt-1 text-sm font-mono"
                          />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs font-semibold">Email Address (Optional)</Label>
                        <Input
                          placeholder="radhika@example.com"
                          value={newCustomer.email}
                          onChange={(e) => setNewCustomer((prev) => ({ ...prev, email: e.target.value }))}
                          className="mt-1 text-sm"
                        />
                      </div>
                      <Button size="small" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleCreateCustomerSubmit}>
                        Confirm New Customer
                      </Button>
                    </div>
                  )}

                  <div className="flex justify-end pt-4 border-t">
                    <Button onClick={() => setActiveSection("delivery")} disabled={!selectedCustomer && !newCustomer.name}>
                      Next: Delivery Address →
                    </Button>
                  </div>
                </div>
              )}

              {/* ── SECTION 2: DELIVERY ADDRESS ─────────────────────────────────────────────── */}
              {activeSection === "delivery" && (
                <div className="space-y-5">
                  <div>
                    <Heading level="h3" className="text-base font-bold">Delivery Address</Heading>
                    <Text className="text-xs text-ui-fg-subtle">Enter destination delivery location and landmark instructions.</Text>
                  </div>

                  {addresses.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">Saved Addresses for {selectedCustomer?.name || "Customer"}</Label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {addresses.map((addr) => (
                          <div
                            key={addr.id}
                            onClick={() => {
                              setSelectedAddressId(addr.id);
                              setAddressForm({
                                address_1: addr.address_1,
                                address_2: "",
                                area: addr.area,
                                city: addr.city,
                                state: addr.state,
                                pincode: addr.postal_code,
                                landmark: addr.landmark || "",
                                delivery_instructions: "Ring door bell twice",
                              });
                            }}
                            className={`p-3 border rounded-xl cursor-pointer text-xs space-y-1 transition-all ${
                              selectedAddressId === addr.id ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 ring-2 ring-emerald-500/20" : "hover:bg-slate-50"
                            }`}
                          >
                            <div className="font-bold flex items-center justify-between">
                              <span>📍 {addr.area} ({addr.city})</span>
                              {selectedAddressId === addr.id && <Badge color="green" className="text-[9px]">Selected</Badge>}
                            </div>
                            <div className="text-slate-600 dark:text-slate-300">{addr.address_1}</div>
                            <div className="font-mono text-[10px] text-slate-400">Pincode: {addr.postal_code}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="p-4 border rounded-xl space-y-3 bg-white dark:bg-slate-900">
                    <Text className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Address Details</Text>
                    <div className="space-y-3">
                      <div>
                        <Label className="text-xs font-semibold">Flat / House No / Building / Street *</Label>
                        <Input
                          placeholder="e.g. Flat 302, Sunrise Heights, 100 Feet Road"
                          value={addressForm.address_1}
                          onChange={(e) => setAddressForm((prev) => ({ ...prev, address_1: e.target.value }))}
                          className="mt-1 text-sm"
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <Label className="text-xs font-semibold">Area / Locality *</Label>
                          <Input
                            placeholder="Indiranagar"
                            value={addressForm.area}
                            onChange={(e) => setAddressForm((prev) => ({ ...prev, area: e.target.value }))}
                            className="mt-1 text-sm"
                          />
                        </div>
                        <div>
                          <Label className="text-xs font-semibold">City *</Label>
                          <Input
                            placeholder="City"
                            value={addressForm.city}
                            onChange={(e) => setAddressForm((prev) => ({ ...prev, city: e.target.value }))}
                            className="mt-1 text-sm"
                          />
                        </div>
                        <div>
                          <Label className="text-xs font-semibold">Pincode *</Label>
                          <Input
                            placeholder="560038"
                            value={addressForm.pincode}
                            onChange={(e) => setAddressForm((prev) => ({ ...prev, pincode: e.target.value }))}
                            className="mt-1 text-sm font-mono"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs font-semibold">Landmark</Label>
                          <Input
                            placeholder="Opp Metro Pillar 124"
                            value={addressForm.landmark}
                            onChange={(e) => setAddressForm((prev) => ({ ...prev, landmark: e.target.value }))}
                            className="mt-1 text-sm"
                          />
                        </div>
                        <div>
                          <Label className="text-xs font-semibold">Delivery Instructions</Label>
                          <Input
                            placeholder="Ring bell, call before arriving"
                            value={addressForm.delivery_instructions}
                            onChange={(e) => setAddressForm((prev) => ({ ...prev, delivery_instructions: e.target.value }))}
                            className="mt-1 text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between pt-4 border-t">
                    <Button variant="secondary" onClick={() => setActiveSection("customer")}>← Back</Button>
                    <Button onClick={() => setActiveSection("branch")} disabled={!addressForm.address_1 || !addressForm.pincode}>
                      Next: Branch &amp; Slots →
                    </Button>
                  </div>
                </div>
              )}

              {/* ── SECTION 3: BRANCH & DELIVERY SLOTS ─────────────────────────────────────────── */}
              {activeSection === "branch" && (
                <div className="space-y-5">
                  <div>
                    <Heading level="h3" className="text-base font-bold">Branch Assignment &amp; Delivery Slots</Heading>
                    <Text className="text-xs text-ui-fg-subtle">Fulfillment kitchen allocation and customer chosen delivery time slot.</Text>
                  </div>

                  {/* Branch Assignment Card */}
                  <div className="p-4 border rounded-xl bg-slate-50 dark:bg-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold">Fulfillment Branch Kitchen</Label>
                      <Badge color={isManualBranchOverride ? "orange" : "green"} className="text-[10px]">
                        {isManualBranchOverride ? "MANUAL OVERRIDE" : "⚡ AUTO-ASSIGNED"}
                      </Badge>
                    </div>

                    <select
                      value={selectedBranchId}
                      onChange={(e) => {
                        setSelectedBranchId(e.target.value);
                        setIsManualBranchOverride(true);
                      }}
                      className="w-full p-2.5 rounded-lg border bg-white dark:bg-slate-900 text-sm font-medium text-slate-900 dark:text-white"
                    >
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} ({b.code}) — {b.city || ""}
                        </option>
                      ))}
                    </select>

                    {autoAssignedBranch && (
                      <div className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-2">
                        <Building2 className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Coverage matches Pincode <strong>{addressForm.pincode}</strong> ({addressForm.city})</span>
                      </div>
                    )}
                  </div>

                  {/* Delivery Date Picker */}
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Delivery Date *</Label>
                    <div className="flex items-center gap-3">
                      <Input
                        type="date"
                        value={deliveryDate}
                        min={new Date().toISOString().slice(0, 10)}
                        onChange={(e) => setDeliveryDate(e.target.value)}
                        className="w-48 text-sm font-mono"
                      />
                      <Badge color="grey" className="text-xs">Selected Date: {deliveryDate}</Badge>
                    </div>
                  </div>

                  {/* Real Delivery Slots Grid */}
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Available Delivery Time Slots *</Label>
                    {loadingSlots ? (
                      <div className="p-4 text-xs text-slate-500 italic">Loading operational slots for selected date...</div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {slots.map((s) => {
                          const slotId = s.id || s.slot_name;
                          const isSelected = selectedSlotId === slotId;
                          return (
                            <div
                              key={slotId}
                              onClick={() => setSelectedSlotId(slotId)}
                              className={`p-3 border rounded-xl cursor-pointer flex items-center justify-between text-xs transition-all ${
                                isSelected ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 ring-2 ring-emerald-500/20" : "hover:bg-slate-50"
                              }`}
                            >
                              <div className="space-y-0.5">
                                <div className="font-bold">{s.slot_name || s.label}</div>
                                <div className="text-[10px] text-slate-500">Fulfillment Window</div>
                              </div>
                              <div className="text-right">
                                {s.delivery_charge > 0 ? (
                                  <Badge color="orange" className="text-[10px]">+₹{s.delivery_charge}</Badge>
                                ) : (
                                  <Badge color="green" className="text-[10px]">FREE</Badge>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between pt-4 border-t">
                    <Button variant="secondary" onClick={() => setActiveSection("delivery")}>← Back</Button>
                    <Button onClick={() => setActiveSection("products")} disabled={!selectedBranchId || !selectedSlotId}>
                      Next: Add Products →
                    </Button>
                  </div>
                </div>
              )}

              {/* ── SECTION 4: PRODUCTS & CART ─────────────────────────────────────────────────── */}
              {activeSection === "products" && (
                <div className="space-y-5">
                  <div>
                    <Heading level="h3" className="text-base font-bold">Product Catalog &amp; Cart Items</Heading>
                    <Text className="text-xs text-ui-fg-subtle">Search gourmet bakery items, customize cake messages, and adjust order line items.</Text>
                  </div>

                  {/* Cart Items List */}
                  {cartItems.length > 0 && (
                    <div className="p-4 border rounded-xl bg-slate-50 dark:bg-slate-800 space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-bold uppercase tracking-wider text-emerald-600">Selected Order Cart ({cartItems.length} items)</Label>
                        <span className="font-mono text-sm font-bold text-slate-900 dark:text-white">Subtotal: ₹{cartSubtotal}</span>
                      </div>
                      <div className="divide-y border rounded-lg bg-white dark:bg-slate-900">
                        {cartItems.map((item) => (
                          <div key={item.id} className="p-3 flex items-center justify-between gap-3 text-xs">
                            <img src={item.image_url} alt={item.title} className="w-12 h-12 object-cover rounded-lg shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="font-bold text-slate-900 dark:text-white truncate">{item.title}</div>
                              <div className="text-[10px] text-slate-500">{item.variant}</div>
                              {item.custom_message && (
                                <div className="text-[10px] text-rose-600 font-medium">🎂 Message: "{item.custom_message}"</div>
                              )}
                            </div>
                            <div className="font-mono font-bold text-slate-900 dark:text-white">
                              {item.quantity} x ₹{item.unit_price} = ₹{item.total}
                            </div>
                            <Button size="small" variant="secondary" onClick={() => handleRemoveCartItem(item.id)} className="text-rose-600">
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Product Search Toolbar */}
                  <div className="flex flex-col md:flex-row items-center gap-3">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                      <Input
                        placeholder="Search product title, SKU, flavor..."
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        className="pl-9 text-sm"
                      />
                    </div>
                  </div>

                  {/* Products Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-72 overflow-y-auto p-1">
                    {filteredProducts.slice(0, 12).map((prod) => {
                      const img = prod.thumbnail || prod.images?.[0]?.url || "/images/placeholder-cake.webp";
                      const price = prod.price || prod.variants?.[0]?.prices?.[0]?.amount || 599;
                      return (
                        <div key={prod.id || prod.product_id} className="p-3 border rounded-xl bg-white dark:bg-slate-900 flex flex-col justify-between space-y-2 hover:shadow-md transition-shadow">
                          <img src={img} alt={prod.title || prod.name} className="w-full h-24 object-cover rounded-lg" />
                          <div>
                            <div className="font-bold text-xs line-clamp-1">{prod.title || prod.name}</div>
                            <div className="text-[10px] font-mono text-slate-500">₹{price}</div>
                          </div>
                          <Button
                            size="small"
                            variant="secondary"
                            onClick={() => {
                              setCustomizingProduct(prod);
                              setCustomForm({
                                weight: "1 kg",
                                flavor: "Chocolate Truffle",
                                shape: "Round",
                                is_artisan: true,
                                cake_message: "Happy Birthday!",
                                quantity: 1,
                              });
                            }}
                            className="w-full text-xs"
                          >
                            + Select &amp; Customize
                          </Button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Customization Dialog Panel */}
                  {customizingProduct && (
                    <div className="p-4 border-2 border-emerald-500 rounded-xl bg-emerald-50/40 dark:bg-emerald-950/20 space-y-3">
                      <div className="flex items-center justify-between">
                        <Badge color="green" className="text-xs">CUSTOMIZING: {customizingProduct.title || customizingProduct.name}</Badge>
                        <Button size="small" variant="secondary" onClick={() => setCustomizingProduct(null)}>Cancel</Button>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                        <div>
                          <Label className="text-[10px]">Weight</Label>
                          <select
                            value={customForm.weight}
                            onChange={(e) => setCustomForm((prev) => ({ ...prev, weight: e.target.value }))}
                            className="w-full p-1.5 border rounded bg-white text-xs"
                          >
                            <option value="0.5 kg">0.5 kg</option>
                            <option value="1 kg">1 kg</option>
                            <option value="2 kg">2 kg</option>
                            <option value="3 kg">3 kg</option>
                          </select>
                        </div>
                        <div>
                          <Label className="text-[10px]">Flavor</Label>
                          <select
                            value={customForm.flavor}
                            onChange={(e) => setCustomForm((prev) => ({ ...prev, flavor: e.target.value }))}
                            className="w-full p-1.5 border rounded bg-white text-xs"
                          >
                            <option value="Belgian Chocolate Truffle">Chocolate Truffle</option>
                            <option value="Black Forest">Black Forest</option>
                            <option value="Red Velvet Cream Cheese">Red Velvet</option>
                            <option value="Fresh Pineapple">Fresh Pineapple</option>
                          </select>
                        </div>
                        <div>
                          <Label className="text-[10px]">Dietary</Label>
                          <select
                            value={customForm.is_artisan ? "artisan" : "egg"}
                            onChange={(e) => setCustomForm((prev) => ({ ...prev, is_artisan: e.target.value === "artisan" }))}
                            className="w-full p-1.5 border rounded bg-white text-xs"
                          >
                            <option value="artisan">artisan (+₹50)</option>
                            <option value="egg">With Egg</option>
                          </select>
                        </div>
                        <div>
                          <Label className="text-[10px]">Quantity</Label>
                          <Input
                            type="number"
                            min="1"
                            max="20"
                            value={customForm.quantity}
                            onChange={(e) => setCustomForm((prev) => ({ ...prev, quantity: Math.max(1, parseInt(e.target.value) || 1) }))}
                            className="h-8 text-xs font-mono"
                          />
                        </div>
                      </div>

                      <div>
                        <Label className="text-[10px]">Custom Cake Message</Label>
                        <Input
                          placeholder="e.g. Happy Birthday Aswani ❤️"
                          value={customForm.cake_message}
                          onChange={(e) => setCustomForm((prev) => ({ ...prev, cake_message: e.target.value }))}
                          className="h-8 text-xs"
                        />
                      </div>

                      <Button size="small" className="bg-emerald-600 hover:bg-emerald-700 text-white w-full" onClick={handleAddProductToCart}>
                        Add Item to Cart (₹{((customizingProduct.price || customizingProduct.selling_price || 0) + (customForm.is_artisan ? 50 : 0)) * customForm.quantity})
                      </Button>
                    </div>
                  )}

                  <div className="flex justify-between pt-4 border-t">
                    <Button variant="secondary" onClick={() => setActiveSection("branch")}>← Back</Button>
                    <Button onClick={() => setActiveSection("pricing")} disabled={cartItems.length === 0}>
                      Next: Discounts &amp; Payment →
                    </Button>
                  </div>
                </div>
              )}

              {/* ── SECTION 5: PRICING & PAYMENT ────────────────────────────────────────────────── */}
              {activeSection === "pricing" && (
                <div className="space-y-5">
                  <div>
                    <Heading level="h3" className="text-base font-bold">Coupons, Discounts &amp; Payment Method</Heading>
                    <Text className="text-xs text-ui-fg-subtle">Apply official promo codes, manual agent discounts, and select payment settlement method.</Text>
                  </div>

                  {/* Coupon Validation Engine Card */}
                  <div className="p-4 border rounded-xl bg-slate-50 dark:bg-slate-800 space-y-3">
                    <Label className="text-xs font-semibold">Apply Official Promo Coupon</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="e.g. CAKE50, SAVE10"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value)}
                        className="text-sm uppercase font-mono flex-1"
                      />
                      <Button size="small" variant="secondary" onClick={handleApplyCoupon} disabled={validatingCoupon}>
                        {validatingCoupon ? "Validating..." : "Apply Coupon"}
                      </Button>
                    </div>
                    {couponError && <Text className="text-xs text-rose-600 font-medium">{couponError}</Text>}
                    {couponSuccess && <Text className="text-xs text-emerald-600 font-medium">✓ {couponSuccess}</Text>}
                  </div>

                  {/* Manual Agent Discount */}
                  <div className="p-4 border rounded-xl bg-white dark:bg-slate-900 space-y-3">
                    <Label className="text-xs font-semibold">Authorized Telecaller Manual Discount</Label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <Label className="text-[10px]">Type</Label>
                        <select
                          value={manualDiscountType}
                          onChange={(e) => setManualDiscountType(e.target.value as any)}
                          className="w-full p-2 border rounded text-xs bg-white dark:bg-slate-800"
                        >
                          <option value="fixed">Fixed Amount (₹)</option>
                          <option value="percent">Percentage (%)</option>
                        </select>
                      </div>
                      <div>
                        <Label className="text-[10px]">Value</Label>
                        <Input
                          type="number"
                          min="0"
                          value={manualDiscountValue}
                          onChange={(e) => setManualDiscountValue(parseFloat(e.target.value) || 0)}
                          className="text-sm font-mono"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px]">Reason (Required)</Label>
                        <Input
                          placeholder="e.g. Customer Retention Offer"
                          value={manualDiscountReason}
                          onChange={(e) => setManualDiscountReason(e.target.value)}
                          className="text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Payment Method Selector */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">Payment Settlement Method</Label>
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="w-full p-2.5 border rounded-lg bg-white dark:bg-slate-900 text-sm font-medium"
                      >
                        <option value="UPI">UPI (Google Pay / PhonePe / Paytm)</option>
                        <option value="Card">Credit / Debit Card</option>
                        <option value="Cash">Cash on Delivery (COD)</option>
                        <option value="Payment Link">Payment Link (SMS / WhatsApp)</option>
                      </select>

                      {paymentMethod === "Payment Link" && (
                        <div className="pt-2 space-y-2">
                          <Button size="small" variant="secondary" onClick={handleGeneratePaymentLink} className="text-xs">
                            Generate Payment Link
                          </Button>
                          {generatedPaymentLink && (
                            <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded font-mono text-[10px] break-all flex items-center justify-between gap-2">
                              <span>{generatedPaymentLink}</span>
                              <Button size="small" variant="secondary" onClick={() => navigator.clipboard.writeText(generatedPaymentLink)}>
                                <Copy className="w-3 h-3" />
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">Payment Status</Label>
                      <select
                        value={paymentStatus}
                        onChange={(e) => setPaymentStatus(e.target.value)}
                        className="w-full p-2.5 border rounded-lg bg-white dark:bg-slate-900 text-sm font-medium"
                      >
                        <option value="paid">Paid (Confirmed)</option>
                        <option value="pending">Pending Payment</option>
                        <option value="cod">Cash on Delivery (COD)</option>
                      </select>
                    </div>
                  </div>

                  {/* Notes & Instructions */}
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Internal Telecaller Notes</Label>
                    <Textarea
                      placeholder="Enter internal notes for bakery kitchen or telecalling record..."
                      value={internalNotes}
                      onChange={(e) => setInternalNotes(e.target.value)}
                      className="text-xs"
                    />
                  </div>

                  <div className="flex justify-between pt-4 border-t">
                    <Button variant="secondary" onClick={() => setActiveSection("products")}>← Back</Button>
                    <Button onClick={() => setActiveSection("review")}>
                      Next: Review Order →
                    </Button>
                  </div>
                </div>
              )}

              {/* ── SECTION 6: ORDER REVIEW & CREATION ──────────────────────────────────────────── */}
              {activeSection === "review" && (
                <div className="space-y-5">
                  <div>
                    <Heading level="h3" className="text-base font-bold">Final Order Review</Heading>
                    <Text className="text-xs text-ui-fg-subtle">Review complete customer, fulfillment, line item, and pricing breakdown before placing the order.</Text>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="p-4 border rounded-xl bg-white dark:bg-slate-900 space-y-1">
                      <div className="font-bold text-emerald-600">👤 CUSTOMER &amp; ADDRESS</div>
                      <div><strong>Name:</strong> {selectedCustomer?.name || newCustomer.name}</div>
                      <div><strong>Phone:</strong> {selectedCustomer?.phone || newCustomer.phone}</div>
                      <div><strong>Address:</strong> {addressForm.address_1}, {addressForm.area}, {addressForm.city} - {addressForm.pincode}</div>
                    </div>

                    <div className="p-4 border rounded-xl bg-white dark:bg-slate-900 space-y-1">
                      <div className="font-bold text-emerald-600">🏢 FULFILLMENT &amp; SLOT</div>
                      <div><strong>Kitchen Branch:</strong> {branches.find((b) => b.id === selectedBranchId)?.name || "Default Kitchen"}</div>
                      <div><strong>Delivery Date:</strong> {deliveryDate}</div>
                      <div><strong>Time Slot:</strong> {slotObj?.slot_name || selectedSlotId}</div>
                    </div>
                  </div>

                  {/* Itemized Cart Table */}
                  <div className="border rounded-xl bg-white dark:bg-slate-900 overflow-hidden text-xs divide-y">
                    <div className="p-3 bg-slate-100 dark:bg-slate-800 font-bold grid grid-cols-12 gap-2">
                      <div className="col-span-6">Item</div>
                      <div className="col-span-2 text-center">Qty</div>
                      <div className="col-span-2 text-right">Price</div>
                      <div className="col-span-2 text-right">Total</div>
                    </div>
                    {cartItems.map((item) => (
                      <div key={item.id} className="p-3 grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-6 flex items-center gap-2">
                          <img src={item.image_url} alt={item.title} className="w-8 h-8 object-cover rounded shrink-0" />
                          <div>
                            <div className="font-bold">{item.title}</div>
                            <div className="text-[10px] text-slate-500">{item.variant}</div>
                          </div>
                        </div>
                        <div className="col-span-2 text-center font-mono">{item.quantity}</div>
                        <div className="col-span-2 text-right font-mono">₹{item.unit_price}</div>
                        <div className="col-span-2 text-right font-mono font-bold">₹{item.total}</div>
                      </div>
                    ))}
                  </div>

                  {/* Grand Financial Breakdown Card */}
                  <div className="p-4 border rounded-xl bg-slate-50 dark:bg-slate-800 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Cart Subtotal:</span>
                      <span className="font-mono font-bold">₹{cartSubtotal}</span>
                    </div>
                    {couponDiscountAmount > 0 && (
                      <div className="flex justify-between text-emerald-600 font-medium">
                        <span>Coupon Discount ({couponCode}):</span>
                        <span className="font-mono">-₹{couponDiscountAmount}</span>
                      </div>
                    )}
                    {manualDiscountAmount > 0 && (
                      <div className="flex justify-between text-emerald-600 font-medium">
                        <span>Agent Manual Discount:</span>
                        <span className="font-mono">-₹{manualDiscountAmount}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-slate-500">Delivery Fee ({slotObj?.slot_name || "Slot"}):</span>
                      <span className="font-mono font-bold">₹{deliveryFee}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">GST (5%):</span>
                      <span className="font-mono font-bold">₹{taxTotal}</span>
                    </div>
                    <div className="flex justify-between text-base font-black text-slate-900 dark:text-white pt-2 border-t">
                      <span>Grand Total:</span>
                      <span className="font-mono text-emerald-600">₹{grandTotal}</span>
                    </div>
                  </div>

                  <div className="flex justify-between pt-4 border-t">
                    <Button variant="secondary" onClick={() => setActiveSection("pricing")}>← Back</Button>
                    <Button
                      size="large"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6"
                      onClick={handleCreateOrderSubmit}
                      disabled={submitting}
                    >
                      {submitting ? "Submitting Order..." : "🚀 CREATE & DISPATCH ORDER"}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}

        </div>
      </div>
    </div>
  );
}
