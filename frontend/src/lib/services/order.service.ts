import { CrossAppEventService } from "./cross-app-event.service";
import { resolveCompanyId } from "../org-defaults";
import { notifyOrderCreated } from "./push-notification.service";
import { dbQuery, dbTransaction } from "../db";
import { OrderRepository } from "../repositories/order.repository";
import { ProductRepository } from "../repositories/product.repository";
import { BranchRepository } from "../repositories/branch.repository";
import { OfferRepository } from "../repositories/offer.repository";
import { DeliveryService } from "./delivery.service";
import { InventoryService } from "./inventory.service";
import { OrderDomain, OrderItemDomain, ProductDomain, resolveProductInventoryMode } from "../types/domain";
import { TaxResolverService, ResolvedTaxRate } from "./tax-resolver.service";


export interface CreateOrderParams {
  /** Surprise / gift services chosen at checkout (priced from gift_service, never from the client). */
  gift_services?: Array<string | { id: string; note?: string }>;
  gift_message?: string;
  idempotency_key?: string;
  customer_id?: string;
  customer_uid?: string;
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  branch_id: string;
  partner_id?: string;
  store_id?: string;
  items: {
    product_id: string;
    variant_id?: string;
    weight?: string;
    variant_name?: string;
    quantity: number;
    unit_price?: number;
    price?: number;
    customization?: any;
  }[];
  coupon_code?: string;
  delivery_type: "standard" | "express" | "midnight" | "pickup";
  delivery_date: string;
  delivery_slot: string;
  delivery_address?: any;
  delivery_latitude?: number;
  delivery_longitude?: number;
  payment_method?: "cash" | "card" | "upi" | "wallet" | "cod" | "online" | "test_mode";
  payment_status?: "pending" | "captured" | "failed" | "awaiting_payment";
}

export class OrderService {
  /**
   * Authoritative, atomic database checkout and order creation
   */
  static async createOrder(params: CreateOrderParams): Promise<{ success: boolean; order?: OrderDomain; error?: string }> {
    const customer_name = params.customer_name || (params as any).name || "Valued Customer";
    const customer_phone = params.customer_phone || (params as any).phone || "";
    const customer_email = params.customer_email || (params as any).email;
    const branch_id = params.branch_id || (params as any).branchId || "";
    const items = params.items || [];
    const coupon_code = params.coupon_code || (params as any).promo_code || (params as any).coupon;
    const delivery_type = (params.delivery_type || (params as any).deliveryType || "standard") as any;
    const delivery_date = params.delivery_date || (params as any).deliveryDate || new Date().toISOString().split("T")[0];
    const rawDeliveryAddr = params.delivery_address || (params as any).address;
    const delivery_address = typeof rawDeliveryAddr === "string" && rawDeliveryAddr.trim()
      ? rawDeliveryAddr.trim()
      : (rawDeliveryAddr && typeof rawDeliveryAddr === "object"
          ? [
              rawDeliveryAddr.line1 || rawDeliveryAddr.address_1 || rawDeliveryAddr.address,
              rawDeliveryAddr.line2 || rawDeliveryAddr.address_2,
              rawDeliveryAddr.landmark,
              rawDeliveryAddr.city,
              rawDeliveryAddr.state,
              rawDeliveryAddr.pincode || rawDeliveryAddr.postal_code,
            ].filter(Boolean).join(", ")
          : "Delivery Address on File");
    const delivery_latitude = typeof params.delivery_latitude === "number" ? params.delivery_latitude : (typeof (params as any).latitude === "number" ? (params as any).latitude : undefined);
    const delivery_longitude = typeof params.delivery_longitude === "number" ? params.delivery_longitude : (typeof (params as any).longitude === "number" ? (params as any).longitude : undefined);
    const delivery_slot = params.delivery_slot || (params as any).delivery_slot_id || (params as any).slot || "Standard Slot";
    const payment_method = (params.payment_method || (params as any).paymentMethod || "cod") as any;

    // Idempotency pre-check (fast path — authoritative check is inside transaction below)
    if (params.idempotency_key) {
      const existingRes = await dbQuery(
        `SELECT * FROM "order" WHERE metadata->>'idempotency_key' = $1 AND deleted_at IS NULL LIMIT 1`,
        [params.idempotency_key]
      );
      if (existingRes.rows && existingRes.rows.length > 0) {
        return { success: true, order: OrderRepository.mapRowToDomain(existingRes.rows[0]) };
      }
    }

    if (!items || items.length === 0) {
      return { success: false, error: "Order must contain at least one item." };
    }

    const partner_id = params.partner_id || (params as any).partnerId || undefined;
    const store_id = params.store_id || (params as any).storeId || undefined;

    // 1. Verify branch exists and is operational
    const branch = await BranchRepository.findById(branch_id);
    if (!branch || !branch.is_open || branch.is_archived) {
      return { success: false, error: `Branch ${branch_id} is currently closed or inactive.` };
    }

    // 2. Validate Store Pickup toggle
    if (delivery_type === "pickup") {
      const allowPickup = branch.fulfillment_rules?.allow_pickup !== false;
      if (!allowPickup) {
        return { success: false, error: "Store Pickup is currently disabled for this branch." };
      }
    }

    // 3. Delivery eligibility + fee (zones, radius and distance brackets are checked inside the quote)
    let deliveryFee = 0;
    if (delivery_type !== "pickup" && branch.fulfillment_rules?.allow_delivery === false) {
      return { success: false, error: "Home delivery is currently disabled for this branch." };
    }
    if (delivery_type !== "pickup") {
      // Same calculation the customer saw at checkout: branch zones / distance brackets / Supabase delivery defaults.
      const { ApiEngine } = await import("../api-engine");
      await ApiEngine.ensureHydrated();
      const hasCoords = typeof delivery_latitude === "number" && typeof delivery_longitude === "number";
      const quote = ApiEngine.resolveSmartBranch({
        ...(hasCoords ? { lat: delivery_latitude, lng: delivery_longitude } : {}),
        branchId: branch.id,
        isExpress: delivery_type === "express",
        isMidnight: delivery_type === "midnight",
      });
      if (quote.blockedReason || !quote.branch) {
        return { success: false, error: quote.blockedReason || "We currently don't deliver to this location." };
      }
      deliveryFee = Math.max(0, Number(quote.deliveryFee) || 0);
    }

    // 4. Validate Delivery Cutoff Time
    const cutoffCheck = DeliveryService.isCutoffPassed(delivery_date, delivery_type, branch);
    if (cutoffCheck.passed) {
      return { success: false, error: cutoffCheck.reason || "Same-day delivery cutoff has passed for today." };
    }

    // 5. Authoritative Price Snapshots & Item Calculation
    let subtotal = 0;
    let totalTax = 0;
    const snapshottedItems: OrderItemDomain[] = [];

    // Batch fetch all cart products in a single database query (N queries -> 1 query)
    const productIds = items.map((i) => i.product_id).filter(Boolean);
    const products = await ProductRepository.findByIds(productIds);
    const productMap = new Map<string, ProductDomain>();
    for (const p of products) {
      productMap.set(p.id, p);
      if (p.product_id) productMap.set(p.product_id, p);
      if (p.handle) productMap.set(p.handle, p);
    }

    for (const reqItem of items) {
      let product = productMap.get(reqItem.product_id);
      if (!product) {
        product = (await ProductRepository.findById(reqItem.product_id)) || undefined;
      }
      if (!product || product.status !== "published" || (product as any).deleted_at) {
        return { success: false, error: `Product '${product?.title || reqItem.product_id}' is inactive or not found in catalog.` };
      }

      let unitPrice = Number(product.price || product.selling_price || 0);
      if (unitPrice <= 0 && ((reqItem as any).unit_price || (reqItem as any).price)) {
        unitPrice = Number((reqItem as any).unit_price || (reqItem as any).price);
      }
      if (unitPrice <= 0) {
        return { success: false, error: `Product ${reqItem.product_id} has invalid or missing pricing in database.` };
      }

      let itemSku = (product as any).sku || (product.metadata as any)?.sku || `${product.handle?.toUpperCase() || product.id}`;
      let itemBarcode = (product as any).barcode || (product.metadata as any)?.barcode || null;
      let variantName = reqItem.variant_name || reqItem.weight || product.weight || "1 kg";

      // 5.a Authoritative Variant Validation & Resolution
      if (reqItem.variant_id) {
        const vRes = await dbQuery(
          `SELECT id, product_id, title, sku, barcode, metadata FROM public.product_variant WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
          [reqItem.variant_id]
        );
        if (!vRes.rows || vRes.rows.length === 0) {
          return {
            success: false,
            error: `Invalid or non-existent variant ID '${reqItem.variant_id}' for product '${product.title}'.`,
          };
        }
        const vRow = vRes.rows[0];
        if (vRow.product_id && vRow.product_id !== product.id) {
          return {
            success: false,
            error: `Variant '${reqItem.variant_id}' does not belong to product '${product.id}' (${product.title}).`,
          };
        }
        variantName = vRow.title || variantName;
        itemSku = vRow.sku || itemSku;
        itemBarcode = vRow.barcode || itemBarcode;
        const vPrice = Number(vRow.metadata?.selling_price ?? vRow.metadata?.price);
        if (vPrice > 0) {
          unitPrice = vPrice;
        }
      }

      // Check weight price matrix
      if (reqItem.weight && Array.isArray(product.weight_prices)) {
        const wp = (product.weight_prices as any[]).find((w: any) => w.weight_name === reqItem.weight);
        if (wp && wp.selling_price > 0) {
          unitPrice = wp.selling_price;
        }
      }

      if ((reqItem as any).expected_unit_price !== undefined && (reqItem as any).expected_unit_price !== null) {
        const expectedPrice = Number((reqItem as any).expected_unit_price);
        if (!Number.isFinite(expectedPrice) || Math.abs(expectedPrice - unitPrice) > 0.01) {
          return {
            success: false,
            error: `PRODUCT_PRICE_MISMATCH: Expected unit price (${expectedPrice}) does not match authoritative catalogue price (${unitPrice}) for '${product.title}'.`,
          };
        }
      }

      const rawQty = reqItem.quantity !== undefined ? Number(reqItem.quantity) : 1;
      if (!Number.isFinite(rawQty) || rawQty <= 0 || !Number.isInteger(rawQty)) {
        return {
          success: false,
          error: `INVALID_ITEM_QUANTITY: Quantity for '${product.title}' must be a positive integer (received ${reqItem.quantity}).`,
        };
      }
      const qty = rawQty;
      
      // Authoritative GST rate resolution from Tax Master
      let lineTaxRate = 0;
      let resolvedTax: ResolvedTaxRate | null = null;
      try {
        resolvedTax = await TaxResolverService.resolveProductTax(product.id, reqItem.variant_id);
        lineTaxRate = resolvedTax.rate;
      } catch (err: any) {
        const rawGst = product.metadata?.gst_rate;
        if (typeof (reqItem as any).tax_rate === "number") {
          lineTaxRate = Number((reqItem as any).tax_rate);
        } else if (rawGst !== undefined && rawGst !== null && rawGst !== "" && !isNaN(Number(rawGst))) {
          lineTaxRate = Number(rawGst);
        } else {
          // Statutory fallback: 18% for accessories, 5% for bakery/food items
          lineTaxRate = (product.id.startsWith("acc_") || (product.merchandise_type || "").toUpperCase() === "ACCESSORY") ? 18 : 5;
        }
      }

      const lineTotal = Math.round(unitPrice * qty * 100) / 100;
      // Statutory Intra-State GST component calculation (CGST + SGST parity under Section 9 CGST/KGST Act)
      const cgstRate = Math.round((lineTaxRate / 2) * 100) / 100;
      const sgstRate = Math.round((lineTaxRate / 2) * 100) / 100;
      const lineCgst = Math.round(lineTotal * (cgstRate / 100) * 100) / 100;
      const lineSgst = Math.round(lineTotal * (sgstRate / 100) * 100) / 100;
      const lineTax = Math.round((lineCgst + lineSgst) * 100) / 100;

      subtotal = Math.round((subtotal + lineTotal) * 100) / 100;
      totalTax = Math.round((totalTax + lineTax) * 100) / 100;

      // Resolve attached accessory addons for this line item
      const itemCustomization = { ...(reqItem.customization || {}) };
      let addonsDetail: any[] = Array.isArray(itemCustomization.selected_addons_detail) ? [...itemCustomization.selected_addons_detail] : [];

      if (addonsDetail.length === 0 && Array.isArray(itemCustomization.selected_addons) && itemCustomization.selected_addons.length > 0) {
        // Resolve legacy string addon names to authentic PostgreSQL accessory products
        for (const addonName of itemCustomization.selected_addons) {
          if (typeof addonName === "string") {
            const accProd = await dbQuery(
              `SELECT p.id, pv.id as variant_id, p.title, COALESCE((p.metadata->>'selling_price')::numeric, (p.metadata->>'price')::numeric, 0) as price 
               FROM product p 
               LEFT JOIN product_variant pv ON pv.product_id = p.id
               WHERE (p.title ILIKE $1 OR p.id = $1 OR pv.sku = $1)
                 AND (p.metadata->'pim_config'->>'inventory_mode' = 'STOCK_CONTROLLED' OR p.metadata->>'category_slug' = 'accessories')
                 AND p.deleted_at IS NULL
               LIMIT 1`,
              [addonName]
            );
            if (accProd.rows && accProd.rows[0]) {
              const row = accProd.rows[0];
              addonsDetail.push({
                id: row.id,
                product_id: row.id,
                variant_id: row.variant_id || `var_${row.id}`,
                title: row.title,
                price: Number(row.price || 0),
                quantity: 1,
              });
            }
          } else if (addonName && typeof addonName === "object") {
            addonsDetail.push(addonName);
          }
        }
      }

      // Ensure stable IDs are preserved in customization
      itemCustomization.selected_addons_detail = addonsDetail;

      snapshottedItems.push({
        id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        product_id: product.id,
        variant_id: reqItem.variant_id || (reqItem as any).variantId || undefined,
        merchandise_type: (product.merchandise_type || (product.metadata as any)?.merchandise_type || "CAKE").toUpperCase() as any,
        hsn_code: product.hsn_code || (product as any).hsnCode || (product.metadata as any)?.hsn_code || ((product.merchandise_type === "ACCESSORY" || product.id?.startsWith("acc_")) ? "95059000" : "1905"),
        product_name: product.title || product.name || "Cake",
        title: product.title || product.name || "Cake",
        thumbnail: product.thumbnail || "",
        variant_name: variantName,
        weight: reqItem.weight || product.weight || "1 kg",
        quantity: qty,
        unit_price: unitPrice,
        price: unitPrice,
        selling_price: unitPrice,
        mrp: product.mrp || unitPrice,
        discount: 0,
        tax_rate: lineTaxRate,
        tax_amount: lineTax,
        cgst: lineCgst,
        sgst: lineSgst,
        tax_rate_id: resolvedTax?.taxRateId,
        tax_code: resolvedTax?.code,
        customization: itemCustomization,
        total_line_amount: lineTotal,
      });
    }

    // 5.b Surprise / gift services (card, video shoot, …): authoritative price + GST from gift_service.
    const requestedServices = (Array.isArray(params.gift_services) ? params.gift_services : [])
      .map((g: any) => (typeof g === "string" ? { id: g, note: "" } : { id: String(g?.id || ""), note: String(g?.note || "") }))
      .filter((g) => g.id);
    const serviceNotes: string[] = [];
    if (requestedServices.length > 0) {
      const { getActiveGiftServicesByIds } = await import("./gift-service.service");
      const found = await getActiveGiftServicesByIds([...new Set(requestedServices.map((g) => g.id))]);
      const byId = new Map(found.map((g) => [g.id, g]));
      for (const req of requestedServices) {
        const svc = byId.get(req.id);
        if (!svc) {
          return { success: false, error: `GIFT_SERVICE_UNAVAILABLE: The selected surprise service is no longer available. Please refresh checkout.` };
        }
        if (snapshottedItems.some((i: any) => i.product_id === svc.id)) continue; // once per order
        const note = req.note.trim().slice(0, 300);
        if (svc.needs_note && !note) {
          return { success: false, error: `GIFT_SERVICE_NOTE_REQUIRED: Please fill in "${svc.note_label || svc.name}".` };
        }
        if (note) serviceNotes.push(`${svc.name}: ${note}`);
        const lineTotal = Math.round(svc.price * 100) / 100;
        const half = Math.round((svc.gst_rate / 2) * 100) / 100;
        const lineCgst = Math.round(lineTotal * (half / 100) * 100) / 100;
        const lineSgst = Math.round(lineTotal * (half / 100) * 100) / 100;
        const lineTax = Math.round((lineCgst + lineSgst) * 100) / 100;
        subtotal = Math.round((subtotal + lineTotal) * 100) / 100;
        totalTax = Math.round((totalTax + lineTax) * 100) / 100;
        snapshottedItems.push({
          id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          product_id: svc.id,
          merchandise_type: "SERVICE" as any,
          sku: svc.id,
          hsn_code: svc.hsn_sac || undefined,
          product_name: svc.name,
          title: svc.name,
          thumbnail: "",
          variant_name: svc.price > 0 ? "Service" : "Free service",
          quantity: 1,
          unit_price: lineTotal,
          price: lineTotal,
          selling_price: lineTotal,
          mrp: lineTotal,
          discount: 0,
          tax_rate: svc.gst_rate,
          tax_amount: lineTax,
          cgst: lineCgst,
          sgst: lineSgst,
          customization: note ? ({ note } as any) : ({} as any),
          total_line_amount: lineTotal,
        } as any);
      }
    }

    // 6. Authoritative Coupon / Discount Validation (Strict Single Source of Truth)
    let discountAmount = 0;
    if (coupon_code) {
      const offer = await OfferRepository.findByCode(coupon_code);
      if (!offer || (!offer.is_active && offer.status !== "active")) {
        return {
          success: false,
          error: `INVALID_COUPON: Coupon "${coupon_code}" is invalid or inactive.`,
        };
      }
      const now = new Date();
      if (!(offer as any).never_expires && offer.ends_at && now > new Date(offer.ends_at)) {
        return {
          success: false,
          error: `EXPIRED_COUPON: Coupon "${coupon_code}" has expired.`,
        };
      }
      const minOrder = Number(offer.min_order_value ?? offer.min_order ?? 0);
      if (minOrder > 0 && subtotal < minOrder) {
        return {
          success: false,
          error: `MIN_ORDER_NOT_MET: Minimum cart value of ₹${minOrder} required for coupon "${coupon_code}".`,
        };
      }
      const discountVal = Number(offer.discount_value || 10);
      const isPercentage = (offer as any).type === "percentage" || (offer as any).discount_type === "percentage";
      const isFreeDelivery = (offer as any).type === "free_delivery" || (offer as any).discount_type === "free_delivery";
      if (isPercentage) {
        discountAmount = Math.round((subtotal * discountVal) / 100);
        if (offer.max_discount_value && discountAmount > offer.max_discount_value) {
          discountAmount = offer.max_discount_value;
        }
      } else if (isFreeDelivery) {
        discountAmount = deliveryFee;
      } else {
        discountAmount = Math.min(discountVal, subtotal);
        if (offer.max_discount_value && discountAmount > offer.max_discount_value) {
          discountAmount = offer.max_discount_value;
        }
      }
    }

    const finalTotal = Math.round(Math.max(0, subtotal - discountAmount + totalTax + deliveryFee) * 100) / 100;

    if (subtotal <= 0 || finalTotal <= 0) {
      return {
        success: false,
        error: "INVALID_ORDER_AMOUNT: Order subtotal and grand total must be greater than zero.",
      };
    }

    // 7. Atomic Database Transaction: Deduct Inventory, Persist Order, Record Status History
    // Generate authentic secure numeric delivery and pickup OTPs
    const deliveryOtp = String(Math.floor(100000 + Math.random() * 900000));
    const pickupOtp = String(Math.floor(100000 + Math.random() * 900000));

    const orderId = `order_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    // Order number will be allocated atomically inside the transaction via allocate_order_number()
    let orderNumber = "";
    let displayIdNum = 0;
    const custUid = params.customer_uid || params.customer_id || "guest";
    const email = customer_email || `${custUid}@caketohome.internal`;
    const initialPaymentStatus = params.payment_status || (payment_method === "test_mode" ? "captured" : "pending");
    const isOnlineGatewayPending = ["razorpay", "online"].includes(String(payment_method || "").toLowerCase()) && initialPaymentStatus !== "captured" && (initialPaymentStatus as string) !== "paid";
    const initialOrderStatus = isOnlineGatewayPending ? "pending" : "confirmed";
    const initialSettlementStatus = initialPaymentStatus === "captured" ? "settled" : "pending";

    const metadata = {
      order_number: orderNumber,
      customer_uid: custUid,
      customer_name: customer_name || "Valued Customer",
      customer_phone: customer_phone || "",
      branch_id: branch.id,
      branch_name: branch.name,
      bakery_status: initialOrderStatus,
      payment_status: initialPaymentStatus,
      payment_method: payment_method || "card",
      // Gift message + notes for chosen surprise services (card text, video brief) for kitchen/delivery
      gift_message: [String(params.gift_message || "").trim().slice(0, 500), ...serviceNotes].filter(Boolean).join(" | ") || undefined,
      is_ledger_eligible: true,
      subtotal,
      total_amount: finalTotal,
      grand_total: finalTotal,
      total: finalTotal,
      discount_amount: discountAmount,
      tax_amount: totalTax,
      delivery: {
        type: delivery_type,
        date: delivery_date,
        slot: delivery_slot,
        fee: deliveryFee,
        delivery_otp: deliveryOtp,
        pickup_otp: pickupOtp,
      },
      delivery_otp: deliveryOtp,
      pickup_otp: pickupOtp,
      delivery_date,
      delivery_slot_time: delivery_slot,
      delivery_address,
      delivery_latitude,
      delivery_longitude,
      partner_id: partner_id || null,
      store_id: store_id || null,
      items: snapshottedItems,
      idempotency_key: params.idempotency_key || null,
    };

    const newOrder: OrderDomain = {
      id: orderId,
      order_id: orderId,
      display_id: orderNumber,
      order_number: orderNumber,
      customer_id: custUid,
      customer_uid: custUid,
      customer_name: customer_name || "Valued Customer",
      customer_email: email,
      customer_phone: customer_phone || "",
      branch_id: branch.id,
      branch_name: branch.name,
      total_amount: finalTotal,
      total: finalTotal,
      subtotal,
      discount_amount: discountAmount,
      tax_amount: totalTax,
      delivery_fee: deliveryFee,
      currency: "INR",
      status: initialOrderStatus as any,
      payment_status: initialPaymentStatus === "awaiting_payment" ? "pending" : (initialPaymentStatus as any),
      payment_method: payment_method || "card",
      delivery: {
        type: delivery_type,
        date: delivery_date,
        slot: delivery_slot,
        fee: deliveryFee,
        delivery_otp: deliveryOtp,
        pickup_otp: pickupOtp,
      },
      delivery_address: delivery_address as any,
      delivery_latitude,
      delivery_longitude,
      items: snapshottedItems,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    try {
      await dbTransaction(async (client) => {
        // Step 0: Authoritative idempotency check inside transaction (closes TOCTOU gap)
        if (params.idempotency_key) {
          const txnIdemRes = await client.query(
            `SELECT id FROM "order" WHERE metadata->>'idempotency_key' = $1 AND deleted_at IS NULL LIMIT 1 FOR UPDATE`,
            [params.idempotency_key]
          );
          if (txnIdemRes.rows.length > 0) {
            // Already created — transaction will commit harmlessly
            return;
          }
        }

        // Step 0.1: Allocate unique order number safely
        let orderNumber: string;
        let displayIdNum: number;
        const procCheck = await client.query("SELECT to_regprocedure('public.allocate_order_number(text)') as proc");
        if (procCheck.rows[0]?.proc) {
          const seqRes = await client.query(`SELECT * FROM public.allocate_order_number('CTH')`);
          orderNumber = seqRes.rows[0].order_number;
          displayIdNum = seqRes.rows[0].sequence_value;
        } else {
          const seqCheck = await client.query("SELECT to_regclass('public.order_display_id_seq') as seq");
          if (!seqCheck.rows[0]?.seq) {
            const maxRes = await client.query(`SELECT COALESCE(MAX(display_id), 98544) as max_val FROM "order"`);
            const startVal = Math.max(98545, (Number(maxRes.rows[0]?.max_val) || 98544) + 1);
            await client.query(`CREATE SEQUENCE IF NOT EXISTS public.order_display_id_seq START WITH ${startVal}`);
          }
          const seqValRes = await client.query(`SELECT nextval('public.order_display_id_seq') as next_val`);
          displayIdNum = Number(seqValRes.rows[0].next_val);
          orderNumber = `CTH-${displayIdNum}`;
        }

        // Stamp the allocated order number into metadata and domain object
        metadata.order_number = orderNumber;
        newOrder.display_id = orderNumber;
        newOrder.order_number = orderNumber;

        // Step A: Authoritative Inventory & Kitchen Availability Validation
        for (const item of snapshottedItems) {
          if (String((item as any).merchandise_type || "").toUpperCase() === "SERVICE") continue; // gift services carry no stock
          const product = productMap.get(item.product_id) || (await ProductRepository.findById(item.product_id));
          if (!product) {
            throw new Error(`Product ${item.product_id} not found in catalog.`);
          }

          const merchType = (
            item.merchandise_type ||
            product.merchandise_type ||
            (product.metadata as any)?.merchandise_type ||
            "CAKE"
          ).toUpperCase();

          if (merchType === "CAKE") {
            // Made-to-order cakes:
            // 1. Do not require fabricated on-hand physical stock.
            // 2. Validate branch kitchen availability, cutoff, and readiness.
            const liveBranchRes = await client.query(
              `SELECT metadata FROM branch WHERE id = $1 AND deleted_at IS NULL`,
              [branch.id]
            );
            const liveBranchMeta = liveBranchRes.rows[0]?.metadata || (branch as any).metadata || {};
            const availRecord = liveBranchMeta.product_availability?.[product.id] || (branch as any).product_availability?.[product.id];
            const availStatus = (typeof availRecord === "string" ? availRecord : (availRecord?.status || (availRecord?.is_available === false ? "UNAVAILABLE" : "AVAILABLE"))).toUpperCase();

            if (availStatus === "UNAVAILABLE" || availStatus === "OUT_OF_STOCK" || availStatus === "TEMPORARILY_HIDDEN" || availStatus === "OUT_TODAY" || availStatus === "OFF") {
              const reasonMsg = typeof availRecord === "object" && availRecord?.reason ? ` (${availRecord.reason})` : "";
              throw new Error(
                `Cannot place order: "${product.title}" is currently marked as ${availStatus.replace(/_/g, " ")} at ${branch.name}${reasonMsg}.`
              );
            }

            const cakeFulfil = liveBranchMeta.cake_fulfilment?.[product.id] || (branch as any).cake_fulfilment?.[product.id] || liveBranchMeta.cake_fulfilment || (branch as any).cake_fulfilment;
            if (cakeFulfil && cakeFulfil.can_fulfil === false) {
              const reasonMsg = cakeFulfil.reason ? ` Reason: "${cakeFulfil.reason}"` : "";
              throw new Error(
                `Cannot place order: Kitchen at ${branch.name} is not currently fulfilling "${product.title}".${reasonMsg}`
              );
            }
          } else {
            // Physical accessory or packaging:
            // Use actual inventory records in branch_inventory and deduct atomically, preventing overselling
            await InventoryService.deductStockAtomic(
              client,
              branch.id,
              item.product_id,
              item.quantity,
              (item as any).variant_id
            );
          }

          // Step A.2: Deduct physical accessory addons attached to this item
          const addons = (item.customization as any)?.selected_addons_detail;
          if (Array.isArray(addons) && addons.length > 0) {
            for (const addon of addons) {
              const addonProdId = addon.product_id || addon.id;
              const addonVariantId = addon.variant_id;
              const addonQty = Math.max(1, Number(addon.quantity || 1)) * item.quantity;
              if (addonProdId) {
                await InventoryService.deductStockAtomic(
                  client,
                  branch.id,
                  addonProdId,
                  addonQty,
                  addonVariantId
                );
              }
            }
          }
        }

        // Step B: Persist order and relational order lines atomically with all first-class schema columns
        // Authoritative seller identity lookup from public.gst_registration
        // GST numeric state code (matches gst_registration.state_code); older branches only stored letter codes.
        const branchState = (branch as any).metadata?.gst_state_code || (branch as any).metadata?.state_code || "";
        const gstRes = await client.query(
          `SELECT gstin, legal_name FROM public.gst_registration WHERE is_active = true AND state_code = $1 LIMIT 1`,
          [branchState]
        );
        const activeGst = gstRes.rows[0] || (
          await client.query(`SELECT gstin, legal_name FROM public.gst_registration WHERE is_active = true ORDER BY created_at ASC LIMIT 1`)
        ).rows[0];

        // Dynamic seller-of-record resolution from branch -> gst_registration & company
        let sellerGstin: string | null = null;
        let sellerLegalName: string | null = null;

        if ((branch as any)?.gst_registration_id) {
          const branchGstRes = await client.query(
            `SELECT g.gstin, g.legal_name as gst_legal_name, c.legal_name as comp_legal_name
             FROM public.gst_registration g
             LEFT JOIN public.company c ON c.id = g.company_id
             WHERE g.id = $1 AND g.is_active = true LIMIT 1`,
            [(branch as any).gst_registration_id]
          );
          if (branchGstRes.rows.length > 0) {
            sellerGstin = branchGstRes.rows[0].gstin;
            sellerLegalName = branchGstRes.rows[0].comp_legal_name || branchGstRes.rows[0].gst_legal_name;
          }
        }

        if (!sellerGstin && activeGst) {
          sellerGstin = activeGst.gstin;
          sellerLegalName = activeGst.legal_name;
        }

        if (!sellerGstin || !sellerLegalName) {
          throw new Error("AMBIGUOUS_SELLER_CONTEXT: Cannot place order without active legal entity and GST registration.");
        }

        await client.query(
          `INSERT INTO "order" (
             id, display_id, order_number, customer_id, email, currency_code, status,
             subtotal, tax_total, grand_total, customer_name, customer_phone, branch_id,
             seller_gstin, seller_legal_name, payment_status, payment_method, metadata,
             created_at, updated_at
           ) VALUES (
             $1, $2, $3, $4, $5, $6, $18,
             $7, $8, $9, $10, $11, $12,
             $13, $14, $15, $16, $17,
             NOW(), NOW()
           )
           ON CONFLICT (id) DO UPDATE SET
             status = EXCLUDED.status,
             grand_total = EXCLUDED.grand_total,
             payment_status = EXCLUDED.payment_status,
             metadata = EXCLUDED.metadata,
             updated_at = NOW()`,
          [
            orderId,
            displayIdNum,
            orderNumber,
            custUid || null,
            email,
            "INR",
            subtotal,
            totalTax,
            finalTotal,
            customer_name || "Valued Customer",
            customer_phone || "",
            branch.id,
            sellerGstin,
            sellerLegalName,
            initialPaymentStatus,
            payment_method || "card",
            JSON.stringify(metadata),
            initialOrderStatus,
          ]
        );

        if (snapshottedItems.length > 0) {
          for (let idx = 0; idx < snapshottedItems.length; idx++) {
            const item = snapshottedItems[idx];
            const lineItemId = item.id || `oli_${orderId}_${idx}`;
            const orderItemId = `oi_${orderId}_${idx}`;
            const unitPrice = Number(item.unit_price ?? item.price ?? item.selling_price ?? 0);
            const qty = Number(item.quantity || 1);
            const title = item.title || item.product_name || "Custom Cake";
            const variantId = item.variant_id || null;
            const productId = item.product_id || null;
            const sku = item.sku || null;
            const lineTotal = Math.round(Number(item.total_line_amount || (unitPrice * qty)) * 100) / 100;
            const itemTaxRate = Number(item.tax_rate ?? 5);
            const itemTaxAmount = Number(item.tax_amount ?? Math.round(((lineTotal * itemTaxRate) / 100) * 100) / 100);
            const lineTotalWithTax = Math.round((lineTotal + itemTaxAmount) * 100) / 100;

            await client.query(
              `
              INSERT INTO public.order_line_item (
                "id", "totals_id", "title", "thumbnail", "variant_id", "product_id",
                "product_title", "variant_sku", "requires_shipping", "is_discountable",
                "is_tax_inclusive", "compare_at_unit_price", "raw_compare_at_unit_price",
                "unit_price", "raw_unit_price", "metadata", "created_at", "updated_at"
              ) VALUES (
                $1, NULL, $2, $3, $4, $5, $2, $6, TRUE, TRUE, FALSE,
                $7, $8, $7, $8, $9, NOW(), NOW()
              )
              ON CONFLICT ("id") DO UPDATE SET
                "title" = EXCLUDED.title,
                "unit_price" = EXCLUDED.unit_price,
                "raw_unit_price" = EXCLUDED.raw_unit_price,
                "metadata" = EXCLUDED.metadata,
                "updated_at" = NOW();
            `,
              [
                lineItemId,
                title,
                item.thumbnail || null,
                variantId,
                productId,
                sku,
                unitPrice,
                JSON.stringify({ value: String(unitPrice), precision: 20 }),
                JSON.stringify({
                  order_id: orderId,
                  variant_name: item.variant_name || item.weight || null,
                  discount: Number(item.discount || 0),
                  tax_rate: itemTaxRate,
                  tax_amount: itemTaxAmount,
                  cgst: item.cgst != null ? item.cgst : Math.round(lineTotal * ((itemTaxRate / 2) / 100) * 100) / 100,
                  sgst: item.sgst != null ? item.sgst : Math.round(lineTotal * ((itemTaxRate / 2) / 100) * 100) / 100,
                  total_line_amount: lineTotal,
                  hsn_code: item.hsn_code || "1905",
                  merchandise_type: item.merchandise_type || "CAKE",
                  customization: item.customization || {},
                }),
              ]
            );

            await client.query(
              `
              INSERT INTO public.order_item (
                "id", "order_id", "product_id", "title", "quantity", "unit_price",
                "taxable_value", "gst_rate_pct", "tax_amount", "total",
                "version", "item_id", "raw_quantity",
                "fulfilled_quantity", "shipped_quantity",
                "return_requested_quantity", "return_received_quantity",
                "return_dismissed_quantity", "written_off_quantity",
                "raw_unit_price", "metadata", "created_at", "updated_at"
              ) VALUES (
                $1, $2, $3, $4, $5, $6,
                $7, $8, $9, $10,
                1, $11, $12,
                0, 0,
                0, 0,
                0, 0,
                $13, $14, NOW(), NOW()
              )
              ON CONFLICT ("id") DO UPDATE SET
                "product_id" = EXCLUDED.product_id,
                "title" = EXCLUDED.title,
                "quantity" = EXCLUDED.quantity,
                "unit_price" = EXCLUDED.unit_price,
                "taxable_value" = EXCLUDED.taxable_value,
                "gst_rate_pct" = EXCLUDED.gst_rate_pct,
                "tax_amount" = EXCLUDED.tax_amount,
                "total" = EXCLUDED.total,
                "raw_quantity" = EXCLUDED.raw_quantity,
                "raw_unit_price" = EXCLUDED.raw_unit_price,
                "metadata" = EXCLUDED.metadata,
                "updated_at" = NOW();
            `,
              [
                orderItemId,
                orderId,
                productId,
                title,
                qty,
                unitPrice,
                lineTotal,
                itemTaxRate,
                itemTaxAmount,
                lineTotalWithTax,
                lineItemId,
                JSON.stringify({ value: String(qty), precision: 20 }),
                JSON.stringify({ value: String(unitPrice), precision: 20 }),
                JSON.stringify({
                  line_total: lineTotal,
                  tax_rate: itemTaxRate,
                  tax_amount: itemTaxAmount,
                  cgst: item.cgst != null ? item.cgst : Math.round(lineTotal * ((itemTaxRate / 2) / 100) * 100) / 100,
                  sgst: item.sgst != null ? item.sgst : Math.round(lineTotal * ((itemTaxRate / 2) / 100) * 100) / 100,
                  total: lineTotalWithTax,
                  hsn_code: item.hsn_code || "1905",
                  merchandise_type: item.merchandise_type || "CAKE",
                }),
              ]
            );

            await client.query(`UPDATE public.order_line_item SET "totals_id" = $1 WHERE "id" = $2;`, [orderItemId, lineItemId]);
          }
        }

        // Step B.2: Marketplace agreements omitted in standalone cth_test baseline

        // Step C: Insert initial order status history
        const historyId = `osh_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        await client.query(
          `INSERT INTO "order_status_history" (
             id, order_id, to_status, from_status, actor_type, actor_id, reason, metadata, created_at, updated_at
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
          [
            historyId,
            orderId,
            "confirmed",
            "pending",
            "system",
            custUid,
            "Order created and confirmed with inventory lock",
            JSON.stringify({ branch_id: branch.id, items_count: snapshottedItems.length }),
          ]
        );

        // Step D: Insert into PostgreSQL payment_transaction table
        const paymentTxnId = `ptxn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        await client.query(
          `INSERT INTO "payment_transaction" (
             id, company_id, branch_id, order_id, customer_id, amount, currency,
             idempotency_key, status, settlement_status, provider, provider_ref, created_at, updated_at
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())`,
          [
            paymentTxnId,
            await resolveCompanyId(client),
            branch.id,
            orderId,
            custUid,
            finalTotal,
            "INR",
            params.idempotency_key || `idem_${orderId}`,
            initialPaymentStatus,
            initialPaymentStatus === "captured" ? "settled" : "pending",
            payment_method || "card",
            `ref_${orderId}`,
          ]
        );

        // Step E: Insert into PostgreSQL delivery table (if table exists)
        const delCheck = await client.query("SELECT to_regclass('public.delivery') as tbl");
        if (delCheck.rows[0]?.tbl) {
          const deliveryRecordId = `del_${orderId}`;
          const formattedAddress = delivery_address || (customer_name ? `Delivery address for ${customer_name}` : "Address on File");
          await client.query(
            `INSERT INTO "delivery" (
               id, transaction_id, delivery_status, delivery_date, delivery_slot_id,
               recipient_name, recipient_phone, recipient_address, recipient_pincode,
               delivery_otp, created_at, updated_at
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
             ON CONFLICT (id) DO UPDATE SET
               delivery_status = EXCLUDED.delivery_status,
               delivery_date = EXCLUDED.delivery_date,
               delivery_slot_id = EXCLUDED.delivery_slot_id,
               recipient_name = EXCLUDED.recipient_name,
               recipient_phone = EXCLUDED.recipient_phone,
               recipient_address = EXCLUDED.recipient_address,
               recipient_pincode = EXCLUDED.recipient_pincode,
               delivery_otp = EXCLUDED.delivery_otp,
               updated_at = NOW()`,
            [
              deliveryRecordId,
              orderId,
              "pending",
              delivery_date,
              delivery_slot,
              customer_name || "Valued Customer",
              customer_phone || "",
              formattedAddress,
              (delivery_address as any)?.postal_code || (delivery_address as any)?.pincode || "560038",
              deliveryOtp,
            ]
          );
        }

        await CrossAppEventService.publishInTransaction(client, {
          event_type: "order.created",
          aggregate_type: "ORDER",
          aggregate_id: orderId,
          branch_id: branch.id,
          payload: {
            order_id: orderId,
            order_number: orderNumber,
            customer_id: custUid,
            customer_name: customer_name || "Valued Customer",
            branch_id: branch.id,
            total_amount: finalTotal,
            status: "confirmed",
            payment_status: initialPaymentStatus,
            payment_method: payment_method || "card",
          },
        });
      });
      CrossAppEventService.processPendingOutboxEvents().catch(() => {});
    } catch (txErr: any) {
      return { success: false, error: txErr.message || "Failed to finalize order transaction." };
    }

    notifyOrderCreated({ id: orderId, order_number: orderNumber, customer_uid: custUid, branch_id: branch.id });
    return { success: true, order: newOrder };
  }
}
